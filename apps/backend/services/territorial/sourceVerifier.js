// apps/backend/services/territorial/sourceVerifier.js

import rssAdapter from "../ingest/adapters/rssAdapter.js";

import {
  ESTADOS_FUENTE,
  fichaDeFuente,
  candidatosPara,
  estadoUniverso,
  esFeedDeComentarios
} from "./verifiedSourceUniverse.js";

/*
===========================================================
COMPROBACION REAL DE FUENTES — TERRITORIAL-SOURCE-UNIVERSE-01
===========================================================

Ir al sitio, mirar si declara feed, leerlo, y anotar que paso.

LO QUE ESTE MODULO NO HACE
-----------------------------------------------------------

NO adivina rutas. No prueba `/rss`, `/feed`, `/rss.xml`. Esa
prohibicion ya vive en `rssAdapter` y aqui NO se relaja: probar
rutas contra un dominio es el patron que un servidor lee como
escaneo, y produce falsos positivos porque muchos sitios
devuelven 200 con una pagina de error.

NO raspa. Si un medio no publica feed, la respuesta es «no
publica feed», no «vamos a leerle el HTML».

NO reimplementa RSS. `descubrirFeeds` y `leerFeed` son del
adapter de INGEST-REAL-01 y se invocan tal cual.

NO autentica, no manda cookies, no evade nada.

EL PRESUPUESTO ES DEL SITIO, NO NUESTRO
-----------------------------------------------------------

Por fuente: 1 peticion a robots.txt + 1 a la portada + 1 por
cada feed que el sitio DECLARE. Un sitio que no declara feeds
cuesta dos peticiones y no vuelve a costar nada hasta que
alguien decida recomprobarlo.

ROBOTS.TXT SE LEE ANTES DE LA PORTADA
-----------------------------------------------------------

Y su ausencia NO es una prohibicion: un 404 en robots.txt
significa que el sitio no publica reglas, no que las tenga y
las oculte. Se anota `NO_PUBLICADO` y se sigue.

Si robots prohibe la ruta, la fuente queda NO_RESUELTO. No
comprobada, no inaccesible: no comprobada A PROPOSITO. La
diferencia importa, porque INACCESIBLE invita a reintentar y
esto no.
===========================================================
*/


const AGENTE =
  "SentinelIntelligence/1.0 (lector de feeds declarados; contacto en el sitio del operador)";

/* El token con el que este agente se identifica en robots.txt. */
const TOKEN_AGENTE = "sentinelintelligence";

const TIEMPO_MAXIMO_MS = 10000;


export const PRESUPUESTO_COMPROBACION = Object.freeze({
  /*
    Tope de fuentes por pasada. No es de dinero —todo esto es
    gratis— sino de cortesia y de tiempo de pared.
  */
  fuentesPorPasada: 30,

  /*
    Un sitio que declara ocho feeds no necesita ocho lecturas
    para demostrar que publica RSS.
  */
  feedsPorFuente: 3
});


export const ESTADOS_ROBOTS = Object.freeze({
  LEIDO: "LEIDO",
  NO_PUBLICADO: "NO_PUBLICADO",
  ILEGIBLE: "ILEGIBLE",
  PROHIBE: "PROHIBE"
});


function conTiempoLimite(promesa, ms, etiqueta) {
  let temporizador;

  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(new Error(`${etiqueta} no respondió en ${ms / 1000}s`)),
      ms
    );
  });

  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}


/*
===========================================================
ROBOTS.TXT
===========================================================

Se agrupan las reglas por `User-agent` y se elige el grupo mas
especifico que nos aplique: nuestro token si aparece, y `*` si
no. Es el orden del estandar, y evita obedecer una regla
escrita para Googlebot que a nosotros no nos concierne.
===========================================================
*/

export function analizarRobots(texto) {
  const grupos = new Map();

  let agentesActuales = [];

  /*
    Varios `User-agent` seguidos comparten un mismo bloque de
    reglas. En cuanto llega una regla, el siguiente `User-agent`
    abre grupo nuevo. Sin este flag, todo el fichero se leeria
    como un unico grupo y una regla de Googlebot nos aplicaria.
  */
  let grupoYaTieneReglas = false;

  String(texto || "")
    .split(/\r?\n/)
    .forEach((linea) => {
      const limpia = linea.replace(/#.*$/, "").trim();

      if (!limpia) return;

      const sep = limpia.indexOf(":");

      if (sep < 0) return;

      const campo = limpia.slice(0, sep).trim().toLowerCase();

      const valor = limpia.slice(sep + 1).trim();

      if (campo === "user-agent") {
        const agente = valor.toLowerCase();

        if (grupoYaTieneReglas) {
          agentesActuales = [];

          grupoYaTieneReglas = false;
        }

        agentesActuales.push(agente);

        if (!grupos.has(agente)) grupos.set(agente, { disallow: [], allow: [] });

        return;
      }

      if (campo !== "disallow" && campo !== "allow") return;

      grupoYaTieneReglas = true;

      agentesActuales.forEach((a) => {
        const g = grupos.get(a);

        if (!g) return;

        /*
          `Disallow:` vacio significa «nada prohibido». No es lo
          mismo que `Disallow: /`.
        */
        if (campo === "disallow" && valor === "") return;

        g[campo].push(valor);
      });
    });

  return grupos;
}


function grupoAplicable(grupos) {
  return grupos.get(TOKEN_AGENTE) || grupos.get("*") || null;
}


function coincide(patron, ruta) {
  if (!patron) return false;

  /*
    Se soporta el comodin `*` y el ancla `$`, que son los dos
    unicos que los buscadores implementan de facto.
  */
  const escapado = patron
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  const anclado = escapado.endsWith("\\$")
    ? `^${escapado.slice(0, -2)}$`
    : `^${escapado}`;

  try {
    return new RegExp(anclado).test(ruta);
  } catch {
    return false;
  }
}


export function rutaPermitida(grupos, ruta) {
  const grupo = grupoAplicable(grupos);

  if (!grupo) return true;

  const prohibiciones = grupo.disallow.filter((p) => coincide(p, ruta));

  if (prohibiciones.length === 0) return true;

  /*
    `Allow` mas especifico gana sobre `Disallow`: es como se
    resuelve en la practica y como los sitios esperan que se
    resuelva.
  */
  const permisos = grupo.allow.filter((p) => coincide(p, ruta));

  const masLargo = (lista) => lista.reduce((n, p) => Math.max(n, p.length), 0);

  return masLargo(permisos) > masLargo(prohibiciones);
}


export async function comprobarRobots(dominio, opciones = {}) {
  const fetchImpl = opciones.fetch || globalThis.fetch;

  const url = `https://${dominio}/robots.txt`;

  try {
    const respuesta = await conTiempoLimite(
      fetchImpl(url, { headers: { "user-agent": AGENTE, accept: "text/plain" } }),
      TIEMPO_MAXIMO_MS,
      "robots.txt"
    );

    if (respuesta.status === 404 || respuesta.status === 410) {
      return {
        estado: ESTADOS_ROBOTS.NO_PUBLICADO,
        url,
        grupos: new Map(),

        nota:
          "El sitio no publica robots.txt. Su ausencia NO es una prohibición: es ausencia de reglas."
      };
    }

    if (!respuesta.ok) {
      return {
        estado: ESTADOS_ROBOTS.ILEGIBLE,
        url,
        grupos: new Map(),
        nota: `robots.txt respondió ${respuesta.status}. No se deduce permiso ni prohibición.`
      };
    }

    const texto = await respuesta.text();

    return {
      estado: ESTADOS_ROBOTS.LEIDO,
      url,
      grupos: analizarRobots(texto),
      nota: null
    };
  } catch (error) {
    return {
      estado: ESTADOS_ROBOTS.ILEGIBLE,
      url,
      grupos: new Map(),
      nota: error?.message || "robots.txt no alcanzable"
    };
  }
}


/*
  Lo que se guarda en la ficha. El Map de reglas no se
  serializa: se guarda el hecho, no el fichero entero.
*/
function robotsParaFicha(robots, permitido) {
  return {
    estado: permitido ? robots.estado : ESTADOS_ROBOTS.PROHIBE,
    url: robots.url,
    portadaPermitida: permitido,
    nota: robots.nota
  };
}


/*
===========================================================
DIAGNOSTICO DEL HOST

Solo se usa cuando la portada YA fallo. El camino feliz sigue
costando una sola peticion.

DOS COSAS QUE «fetch failed» NO DISTINGUE
-----------------------------------------------------------

Es la misma leccion que dejo GDELT en TERRITORIAL-FRESH-01: el
mensaje es generico y la causa real vive en `error.cause.code`.

    ENOTFOUND      el dominio NO EXISTE en el DNS
    ECONNRESET     existe y corta la conexion
    ETIMEDOUT      existe y no contesta

La primera es un hecho sobre el CATALOGO —ese dominio esta mal
o esta muerto—. Las otras dos son sobre la RED, y pueden ser
nuestras. Tratarlas igual haria que una entrada equivocada del
catalogo pareciera un problema de conectividad para siempre.

Y `www` no es adivinar una ruta: es el host canonico del mismo
sitio. Medido en la comprobacion real, `cuenca.gob.ec` —el GAD
Municipal— falla y `www.cuenca.gob.ec` responde 200.
===========================================================
*/

export async function diagnosticarHost(url, opciones = {}) {
  const fetchImpl = opciones.fetch || globalThis.fetch;

  try {
    const respuesta = await conTiempoLimite(
      fetchImpl(url, { headers: { "user-agent": AGENTE, accept: "text/html" } }),
      TIEMPO_MAXIMO_MS,
      "Portada"
    );

    return { alcanzable: respuesta.ok, status: respuesta.status, causa: null };
  } catch (error) {
    return {
      alcanzable: false,
      status: null,

      /* La causa real, no el mensaje generico. */
      causa: error?.cause?.code || error?.code || error?.message || "desconocida"
    };
  }
}


function conHostWww(homepage) {
  try {
    const u = new URL(homepage);

    if (u.hostname.startsWith("www.")) return null;

    u.hostname = `www.${u.hostname}`;

    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}


/*
===========================================================
COMPROBAR UNA FUENTE
===========================================================
*/

export async function comprobarFuente(candidato, opciones = {}) {
  const instante = opciones.instante || new Date().toISOString();

  const inyeccion = {
    ...(opciones.fetch ? { fetch: opciones.fetch } : {}),
    ...(opciones.parseURL ? { parseURL: opciones.parseURL } : {})
  };

  const procedencia = [
    {
      afirmacion: "candidato",
      origen: candidato.metodoDescubrimiento,
      detalle: candidato.dominio,
      instante
    }
  ];

  const peticiones = { robots: 0, portada: 0, feeds: 0 };

  /*
    ---------------------------------------------------------
    1. ROBOTS
    ---------------------------------------------------------
  */
  const robots = await comprobarRobots(candidato.dominio, inyeccion);

  peticiones.robots += 1;

  const rutaPortada = (() => {
    try {
      return new URL(candidato.homepage).pathname || "/";
    } catch {
      return "/";
    }
  })();

  const portadaPermitida = rutaPermitida(robots.grupos, rutaPortada);

  procedencia.push({
    afirmacion: "robots.txt",
    origen: "http",
    detalle: `${robots.url} → ${robots.estado}`,
    instante
  });

  if (!portadaPermitida) {
    return {
      ficha: fichaDeFuente(candidato, {
        estado: ESTADOS_FUENTE.NO_RESUELTO,
        comprobadoEn: instante,
        procedencia,
        robots: robotsParaFicha(robots, false),

        restricciones: ["robots.txt del sitio no permite leer la portada a este agente."],

        motivo:
          "No se comprobó: robots.txt lo desaconseja. No es INACCESIBLE —eso invitaría a reintentar— sino no comprobado a propósito."
      }),
      peticiones
    };
  }

  /*
    ---------------------------------------------------------
    2. PORTADA — feeds DECLARADOS por el sitio
    ---------------------------------------------------------
  */
  let homepage = candidato.homepage;

  let descubrimiento = await rssAdapter.descubrirFeeds(homepage, inyeccion);

  peticiones.portada += 1;

  procedencia.push({
    afirmacion: "feeds declarados en el HTML",
    origen: "link rel=alternate",
    detalle: `${homepage} → ${descubrimiento.estado} · ${descubrimiento.feeds.length} declarado(s)`,
    instante
  });

  /*
    Fallo la portada: se diagnostica la causa y se prueba el
    host canonico `www` UNA vez. Solo en el camino de error.
  */
  let diagnostico = null;

  if (descubrimiento.estado === rssAdapter.ESTADOS_FEED.INACCESIBLE) {
    diagnostico = await diagnosticarHost(homepage, inyeccion);

    peticiones.portada += 1;

    const alterno = conHostWww(homepage);

    if (alterno) {
      const conWww = await diagnosticarHost(alterno, inyeccion);

      peticiones.portada += 1;

      procedencia.push({
        afirmacion: "host canónico",
        origen: "http",
        detalle: `${homepage} → ${diagnostico.causa || diagnostico.status} · ${alterno} → ${conWww.alcanzable ? "200" : conWww.causa || conWww.status}`,
        instante
      });

      if (conWww.alcanzable) {
        homepage = alterno;

        descubrimiento = await rssAdapter.descubrirFeeds(homepage, inyeccion);

        peticiones.portada += 1;

        procedencia.push({
          afirmacion: "feeds declarados en el HTML",
          origen: "link rel=alternate",
          detalle: `${homepage} → ${descubrimiento.estado} · ${descubrimiento.feeds.length} declarado(s)`,
          instante
        });
      }
    }
  }

  if (descubrimiento.estado === rssAdapter.ESTADOS_FEED.INACCESIBLE) {
    /*
      ENOTFOUND es un hecho sobre el CATALOGO: ese dominio no
      existe. No se confunde con «la red falla».
    */
    const dominioNoResuelve = diagnostico?.causa === "ENOTFOUND";

    return {
      ficha: fichaDeFuente(candidato, {
        estado: ESTADOS_FUENTE.INACCESIBLE,
        comprobadoEn: instante,
        procedencia,
        robots: robotsParaFicha(robots, true),

        restricciones: dominioNoResuelve
          ? [
              "El dominio no existe en el DNS (ENOTFOUND). La entrada del catálogo está equivocada o el sitio desapareció: NO se sustituye por un dominio inventado."
            ]
          : [],

        motivo: diagnostico?.causa
          ? `La portada no respondió: ${diagnostico.causa}. ${dominioNoResuelve ? "El dominio no existe en el DNS." : "El dominio existe; el fallo puede ser de red."} No se afirma nada sobre sus feeds.`
          : descubrimiento.motivo ||
            "La portada no respondió. No se afirma nada sobre sus feeds: no se llegó a mirar."
      }),
      peticiones
    };
  }

  if (descubrimiento.feeds.length === 0) {
    return {
      ficha: fichaDeFuente(candidato, {
        estado: ESTADOS_FUENTE.NO_PUBLICA_RSS,
        comprobadoEn: instante,
        procedencia,
        robots: robotsParaFicha(robots, true),

        motivo:
          descubrimiento.motivo ||
          "La portada respondió y no declara ningún feed. NO se prueban rutas comunes."
      }),
      peticiones
    };
  }

  /*
    ---------------------------------------------------------
    3. LEER LOS FEEDS DECLARADOS

    Declarado no es usable. Un `link rel=alternate` puede
    apuntar a una ruta muerta, y hasta que no se lee no se sabe.
    ---------------------------------------------------------
  */
  const tope = opciones.feedsPorFuente || PRESUPUESTO_COMPROBACION.feedsPorFuente;

  const validos = [];

  const descartados = [];

  for (const feed of descubrimiento.feeds.slice(0, tope)) {
    const ruta = (() => {
      try {
        return new URL(feed.url).pathname || "/";
      } catch {
        return "/";
      }
    })();

    if (!rutaPermitida(robots.grupos, ruta)) {
      descartados.push({
        url: feed.url,
        estado: "NO_PERMITIDO_POR_ROBOTS",
        motivo: "robots.txt del sitio no permite esta ruta a este agente.",
        comprobadoEn: instante
      });

      continue;
    }

    const lectura = await rssAdapter.leerFeed(feed.url, {
      ...(opciones.parseURL ? { parseURL: opciones.parseURL } : {}),
      publisher: candidato.nombre,
      sourceId: candidato.sourceId,
      observedAt: instante,
      queryType: "VERIFICACION_FEED",
      queryLabel: `verificacion:${candidato.sourceId}`,

      /* Comprobar no es recolectar: basta una muestra. */
      maximo: opciones.muestra || 5
    });

    peticiones.feeds += 1;

    procedencia.push({
      afirmacion: "lectura del feed",
      origen: "http",
      detalle: `${feed.url} → ${lectura.estado}`,
      instante
    });

    if (
      lectura.estado === rssAdapter.ESTADOS_FEED.OK ||
      lectura.estado === rssAdapter.ESTADOS_FEED.VACIO
    ) {
      validos.push({
        url: feed.url,
        tipo: feed.tipo || null,
        titulo: lectura.feedTitulo || feed.titulo || null,

        /* Declarado por el sitio, no aportado ni adivinado. */
        origen: feed.origen,

        estado: lectura.estado,

        /*
          Un feed de comentarios es la reaccion de los lectores,
          no la agenda del medio. Consta —el sitio lo declara—
          pero no se recolecta como noticia.
        */
        esDeComentarios: esFeedDeComentarios(feed.url),

        /*
          Un feed que responde y parsea pero no trae entradas es
          un feed VALIDO y VACIO. Vacio NO es silencio del medio:
          puede ser un feed abandonado. No alimenta al recolector.
        */
        conContenido: lectura.estado === rssAdapter.ESTADOS_FEED.OK,

        entradasEnLaMuestra: lectura.recibidas || 0,

        /*
          La fecha mas reciente que declara el feed. Es del
          MEDIO: no se confunde con cuando Sentinel lo miro.
        */
        publicacionMasReciente:
          (lectura.evidencias || [])
            .map((e) => e.publishedAt)
            .filter(Boolean)
            .sort()
            .reverse()[0] || null,

        comprobadoEn: instante,
        latenciaMs: lectura.latenciaMs ?? null
      });
    } else {
      descartados.push({
        url: feed.url,
        estado: lectura.estado,
        motivo: lectura.error || lectura.declaracion || null,
        comprobadoEn: instante
      });
    }
  }

  const conContenido = validos.filter((f) => f.conContenido);

  if (conContenido.length > 0) {
    return {
      ficha: fichaDeFuente(candidato, {
        estado: ESTADOS_FUENTE.VERIFICADO_FEED,
        comprobadoEn: instante,
        procedencia,
        robots: robotsParaFicha(robots, true),
        feeds: validos,
        feedsDescartados: descartados,

        motivo: null
      }),
      peticiones
    };
  }

  /*
    Declara feed y ninguno resulto usable. El SITIO queda
    comprobado; el feed no. Es distinto de NO_PUBLICA_RSS.
  */
  return {
    ficha: fichaDeFuente(candidato, {
      estado: ESTADOS_FUENTE.VERIFICADO_SIN_FEED,
      comprobadoEn: instante,
      procedencia,
      robots: robotsParaFicha(robots, true),
      feeds: validos,
      feedsDescartados: descartados,

      motivo:
        validos.length > 0
          ? "Declara feed y responde, pero sin entradas. Un feed vacío puede ser un feed abandonado: no se le pasa al recolector."
          : "Declara feed en su HTML y ninguno resultó legible. El sitio queda comprobado; el feed no."
    }),
    peticiones
  };
}


/*
===========================================================
COMPROBAR UN TERRITORIO
===========================================================
*/

export async function comprobarUniverso({
  territorioId,
  candidatos = null,
  instante = null,
  limite = null,
  incluirNacionales = true,
  fetch: fetchImpl = null,
  parseURL = null,
  feedsPorFuente = null,
  muestra = null
} = {}) {
  const inicio = instante || new Date().toISOString();

  const lista =
    candidatos || candidatosPara(territorioId, { incluirNacionales });

  const tope = limite || PRESUPUESTO_COMPROBACION.fuentesPorPasada;

  const fichas = [];

  const gasto = { robots: 0, portada: 0, feeds: 0 };

  for (const candidato of lista.slice(0, tope)) {
    const { ficha, peticiones } = await comprobarFuente(candidato, {
      instante: inicio,
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
      ...(parseURL ? { parseURL } : {}),
      ...(feedsPorFuente ? { feedsPorFuente } : {}),
      ...(muestra ? { muestra } : {})
    });

    fichas.push(ficha);

    gasto.robots += peticiones.robots;
    gasto.portada += peticiones.portada;
    gasto.feeds += peticiones.feeds;
  }

  /*
    Los candidatos que no cupieron en el presupuesto NO se
    omiten: entran como NO_RESUELTO y se dice por que. Omitirlos
    haria que el universo pareciera mas pequeño de lo que es.
  */
  lista.slice(tope).forEach((candidato) => {
    fichas.push(
      fichaDeFuente(candidato, {
        estado: ESTADOS_FUENTE.NO_RESUELTO,
        comprobadoEn: null,

        motivo: `No se comprobó en esta pasada: presupuesto de ${tope} fuentes agotado.`
      })
    );
  });

  return {
    territorioId: territorioId || null,
    comprobadoEn: inicio,

    fichas,

    resumen: estadoUniverso(fichas),

    coste: {
      usd: 0,
      motivo: "robots.txt, portadas y feeds públicos. Sin credencial, sin cuota, sin contrato.",
      peticionesHttp: gasto.robots + gasto.portada + gasto.feeds,
      desglose: gasto
    }
  };
}


export default {
  PRESUPUESTO_COMPROBACION,
  ESTADOS_ROBOTS,
  analizarRobots,
  rutaPermitida,
  comprobarRobots,
  diagnosticarHost,
  comprobarFuente,
  comprobarUniverso
};
