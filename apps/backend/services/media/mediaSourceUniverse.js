// apps/backend/services/media/mediaSourceUniverse.js

import { extraerDominio, normalizarUrl } from "../textUtils.js";

import { identificarFuente } from "../conversation/mediaRegistry.js";

import {
  TIPOS_SOURCE,
  SUBTIPOS_MEDIA,
  ESTADOS_SOURCE,
  ORIGENES_SOURCE,
  esPlataforma,
  nombrePlataforma
} from "../conversation/sourceUniverse.js";

import { correspondenciasDeCuenta } from "./emitterCorrespondence.js";

import { esHostDeInfraestructura } from "./mediaVocabulary.js";

/*
===========================================================
MEDIA-SOURCE-UNIVERSE-01 — EL UNIVERSO DE MEDIOS DE UN PROYECTO
===========================================================

QUE FALTABA, DESPUES DE AUDITAR LO QUE YA HABIA
-----------------------------------------------------------

Cuatro estructuras cubren ya parte de esto y NO se duplican:

    conversation/mediaRegistry        catalogo semilla por dominio
    conversation/sourceUniverse       registro de fuentes por dominio
    ingest/mediaSourceRegistry        medios y sus feeds
    territorial/verifiedSourceUniverse  fuentes verificadas de un territorio

De `sourceUniverse` se REUTILIZA el vocabulario entero —tipos,
subtipos, estados y origenes—: crear una taxonomia paralela
habria producido dos verdades sobre la misma pregunta.

Lo que ninguna de las cuatro modela es la pieza que falta:

    UNA ENTIDAD MEDIA POR ENCIMA DE LOS DOMINIOS

Todas indexan por dominio. Pero «La Voz del Tomebamba» es UNA
entidad que posee un sitio, una Pagina de Facebook, un
Instagram, una cuenta de X, un canal de YouTube y un feed. Con
un registro por dominio, esa emisora son seis fuentes distintas
y ninguna de las seis sabe de las otras.

Y falta que eso PERSISTA y sea POR PROYECTO: `crearUniverso()`
vive en memoria y se reconstruye en cada llamada, asi que nada
de lo que un analista declare sobrevive a la peticion.

LAS CINCO REGLAS QUE SOSTIENEN EL MODELO
-----------------------------------------------------------

1 · ENTIDAD != DOMINIO != ACTIVO. Un activo es una cuenta o un
    dominio concreto; la entidad es quien publica. Colapsarlos
    pierde activos, y separarlos de mas duplica emisores.

2 · N ACTIVOS POR PLATAFORMA. Misma regla que Candidate desde
    P-CAND-FB-MULTI-ASSET-01: la clave de un activo es
    plataforma + handle normalizado, asi que dos Paginas de
    Facebook del mismo medio son dos activos.

3 · DECLARAR NO ES VERIFICAR. Un medio que escribe el analista
    entra ANALISTA/DECLARADA. Ninguna acumulacion de
    declaraciones asciende sola a VERIFICADA.

4 · NO SE DEDUPLICA POR NOMBRE. Dos dominios distintos con el
    mismo nombre pueden ser dos medios distintos —«El Diario»
    hay muchos—. La union exige dominio, URL canonica o un
    alias declarado explicitamente.

5 · LA INFRAESTRUCTURA NO ENTRA. Un balanceador de AWS o un
    redirector de buscador no son medios y no pueden estar en
    el universo: si entran, acaban en un ranking.

ESTAR EN EL UNIVERSO NO ES UN RANKING
-----------------------------------------------------------

Pertenecer al universo significa «Sentinel conoce esta fuente
dentro de este proyecto». No significa importante, ni popular,
ni leida. El orden lo calcula `mediaHome` con su ventana y su
evidencia, y este modulo no expone ninguna cifra de posicion.
===========================================================
*/

/*
  Se reexporta el vocabulario de `sourceUniverse` para que los
  consumidores del universo de medios no tengan que importar de
  dos sitios y arriesgarse a que uno quede desactualizado. Es un
  reexport, no una copia: la definicion sigue siendo unica.
*/
export { TIPOS_SOURCE, SUBTIPOS_MEDIA, ESTADOS_SOURCE, ORIGENES_SOURCE };


export const VERSION_UNIVERSO_MEDIOS = "1.0";

export const SUBMOTOR_UNIVERSO = "media_source_universe";


/*
-----------------------------------------------------------
CLASES DE ACTIVO

Un activo es algo que se puede observar. Se separan porque no
se observan igual: un dominio se lee por web, un feed por RSS y
una cuenta por API de plataforma.
-----------------------------------------------------------
*/
export const CLASES_ACTIVO = Object.freeze({
  DOMINIO: "DOMINIO",
  SOCIAL: "SOCIAL",
  FEED: "FEED"
});


/*
-----------------------------------------------------------
ORIGEN DE UNA ENTIDAD

Se mapea sobre `ORIGENES_SOURCE`, que ya existe, en lugar de
inventar cuatro constantes nuevas.
-----------------------------------------------------------
*/
export const ORIGENES_ENTIDAD = Object.freeze({
  DESCUBIERTO: ORIGENES_SOURCE.EVIDENCIA,
  DECLARADO_POR_ANALISTA: ORIGENES_SOURCE.ANALISTA,
  CATALOGO: ORIGENES_SOURCE.CATALOGO,
  ENLACE_SALIENTE: ORIGENES_SOURCE.ENLACE_SALIENTE
});


/*
-----------------------------------------------------------
COBERTURA POR CANAL

Los estados los pide el gate y coinciden con los que Candidate
ya usa para plataformas sociales. `SIN_ACTIVO_CONOCIDO` no es
`NO_PROBADO`: uno dice que no hay nada que mirar y el otro que
no hemos mirado.
-----------------------------------------------------------
*/
export const ESTADOS_COBERTURA = Object.freeze({
  ENCONTRADO: "ENCONTRADO",
  MEDIDO: "MEDIDO",
  NO_PROBADO: "NO_PROBADO",
  SIN_ACTIVO_CONOCIDO: "SIN_ACTIVO_CONOCIDO",
  BLOQUEADO: "BLOQUEADO",
  NO_SOPORTADO: "NO_SOPORTADO"
});


export const CANALES = Object.freeze([
  "website",
  "rss",
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "youtube"
]);


/* Plataformas sociales reconocidas desde el dominio. */
const PLATAFORMA_POR_DOMINIO = Object.freeze({
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "x.com": "x",
  "twitter.com": "x",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "threads.com": "threads",
  "threads.net": "threads",
  "linkedin.com": "linkedin"
});


export function plataformaDeDominio(dominio) {
  const d = String(dominio || "").toLowerCase().replace(/^www\./, "");

  return PLATAFORMA_POR_DOMINIO[d] || null;
}


/*
  `sourceUniverse.esPlataforma` no conoce `threads.com`, y ese
  fichero lo comparten conversation y territorial: ampliarlo
  desde aqui cambiaria el comportamiento de dos lineas ajenas.

  Se combina con la tabla local, que si lo conoce. El defecto
  que esto corrige es real y lo encontro el descubrimiento sobre
  el corpus: `threads.com` entraba como si fuera una cabecera,
  cuando la pieza era `threads.com/@notivozec/post/...` y el
  emisor es la cuenta.
*/
function esPlataformaConocida(dominio) {
  return esPlataforma(dominio) || Boolean(plataformaDeDominio(dominio));
}


/*
-----------------------------------------------------------
QUE NO PUEDE SER UNA ENTIDAD MEDIA

Se responde con un MOTIVO, no con un booleano: el analista
tiene derecho a saber por que un dominio de su corpus no
aparece en el universo.
-----------------------------------------------------------
*/
export function motivoDeExclusionDelUniverso(dominio) {
  if (!dominio) return "No hay dominio con el que identificar una fuente.";

  if (esHostDeInfraestructura(dominio)) {
    return "Es un host de infraestructura —balanceador o CDN—: describe desde que servidor se sirvio la pagina, no quien la publico.";
  }

  const catalogo = identificarFuente(`https://${dominio}`);

  if (catalogo?.tipo === "agregador") {
    return "Es un agregador o redirector de buscador: su presencia dice como recogimos la cobertura, no quien publico.";
  }

  if (catalogo?.tipo === "enciclopedico") {
    return "Es una fuente enciclopedica, no un emisor de cobertura.";
  }

  /*
    Una PLATAFORMA no es una entidad media: el emisor es la
    cuenta que hay dentro. `x.com` no es un medio; `@tomebamba`
    puede serlo, y entra como ACTIVO de su entidad.
  */
  if (esPlataformaConocida(dominio)) {
    return `${nombrePlataforma(dominio) || plataformaDeDominio(dominio) || dominio} es una plataforma: el emisor es la cuenta que publica, no el dominio.`;
  }

  return null;
}


export function puedeSerEntidadMedia(dominio) {
  return motivoDeExclusionDelUniverso(dominio) === null;
}


/*
-----------------------------------------------------------
IDENTIDAD ESTABLE

El id sale del DOMINIO principal, no del nombre. Un nombre
cambia —«Diario X» pasa a «X Digital»— y el id no puede
cambiar con el, porque es lo que ata las evidencias.
-----------------------------------------------------------
*/
export function idDeEntidad(dominioOSemilla) {
  const base = String(dominioOSemilla || "")
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base ? `media:${base}` : null;
}


/*
  Clave de un activo. plataforma + handle normalizado, igual que
  en Candidate: dos handles distintos son dos activos aunque
  compartan medio y plataforma.
*/
export function idDeActivo({ clase, plataforma, url, handle, dominio }) {
  if (clase === CLASES_ACTIVO.DOMINIO) {
    return `dominio:${String(dominio || extraerDominio(url || "") || "").toLowerCase().replace(/^www\./, "")}`;
  }

  if (clase === CLASES_ACTIVO.FEED) {
    return `feed:${normalizarUrl(url || "") || String(url || "").toLowerCase()}`;
  }

  const h = String(handle || "").toLowerCase().replace(/^@/, "");

  if (h) return `${plataforma}:${h}`;

  return `${plataforma}:${normalizarUrl(url || "") || String(url || "").toLowerCase()}`;
}


/*
  Handle de una URL social. Deliberadamente conservador: si la
  ruta no identifica una cuenta, devuelve null y el activo se
  guarda por URL. Inventar un handle produciria activos
  fantasma que luego se deduplican mal.
*/
export function handleDeUrlSocial(url) {
  const limpia = String(url || "").replace(/^https?:\/\//i, "").replace(/^www\./, "");

  const partes = limpia.split(/[/?#]/).filter(Boolean);

  if (partes.length < 2) return null;

  const primero = partes[1];

  /* Rutas de contenido, no de cuenta. */
  const noSonCuenta = [
    "p", "reel", "reels", "status", "watch", "posts", "photo", "video",
    "shorts", "channel", "c", "user", "hashtag", "explore", "share",
    "groups", "events", "pages", "pg", "profile.php", "i", "story", "t"
  ];

  if (noSonCuenta.includes(primero.toLowerCase())) return null;

  const handle = primero.replace(/^@/, "").toLowerCase();

  return /^[a-z0-9._-]{2,}$/.test(handle) ? handle : null;
}


/*
===========================================================
CREAR UNA ENTIDAD
===========================================================
*/
export function crearEntidad({
  projectId,
  dominio = null,
  canonicalName = null,
  tipo = TIPOS_SOURCE.MEDIA,
  subtipo = null,
  origen = ORIGENES_ENTIDAD.DESCUBIERTO,
  instante = null,
  evidenceIds = [],
  detalleProcedencia = null
} = {}) {
  const catalogo = dominio ? identificarFuente(`https://${dominio}`) : null;

  const ahora = instante || new Date().toISOString();

  return {
    esquema: "sentinel.media.entidad.v1",
    version: VERSION_UNIVERSO_MEDIOS,

    mediaEntityId: idDeEntidad(dominio || canonicalName),
    projectId: projectId || null,

    /*
      El nombre del catalogo gana al dominio, pero NUNCA gana a
      un nombre declarado por el analista.
    */
    canonicalName: canonicalName || catalogo?.nombre || dominio || null,

    aliases: [],

    tipo,
    subtipo: subtipo || null,

    /*
      Dos territorios distintos que no se mezclan. `declarado`
      sale del catalogo o del analista; `editorialInferido` se
      deja en null a proposito: haber publicado sobre Cuenca no
      convierte a nadie en medio de Cuenca, y ese es
      exactamente el criterio circular que `mediaRegistry` ya
      prohibe.
    */
    scope: {
      declarado: catalogo?.cobertura
        ? {
            unidadId: catalogo.cobertura.unidadId,
            resolucion: catalogo.cobertura.resolucion,
            procedencia: "catalogo_de_medios"
          }
        : null,

      editorialInferido: null,

      nota: "El alcance declarado sale del catalogo o del analista. Publicar sobre un territorio NO declara cobertura sobre el."
    },

    activos: [],

    origen,
    estado: ESTADOS_SOURCE.DESCUBIERTA,

    /*
      Verificar exige una fuente de respaldo. Se separa del
      estado porque una fuente puede estar muy OBSERVADA y
      seguir sin verificar.
    */
    verificacion: {
      estado: ESTADOS_SOURCE.DESCUBIERTA,
      verificadaPor: null,
      verificadaEn: null,
      motivo: null
    },

    activa: true,

    firstObservedAt: ahora,
    lastObservedAt: ahora,

    procedencia: [
      {
        origen,
        detalle: detalleProcedencia,
        instante: ahora
      }
    ],

    evidenceIds: [...new Set(evidenceIds.filter(Boolean))],

    piezasObservadas: 0,

    historial: []
  };
}


/*
===========================================================
AÑADIR UN ACTIVO
===========================================================

Idempotente por `assetId`. Volver a observar el mismo activo
mueve `lastObservedAt` y no crea uno nuevo.
===========================================================
*/
export function agregarActivo(entidad, entrada = {}) {
  const clase = entrada.clase || CLASES_ACTIVO.SOCIAL;

  const dominio =
    entrada.dominio || (entrada.url ? extraerDominio(entrada.url) : null);

  const plataforma =
    entrada.plataforma ||
    (clase === CLASES_ACTIVO.SOCIAL ? plataformaDeDominio(dominio) : null);

  const handle =
    entrada.handle ||
    (clase === CLASES_ACTIVO.SOCIAL ? handleDeUrlSocial(entrada.url) : null);

  const assetId = idDeActivo({ clase, plataforma, url: entrada.url, handle, dominio });

  if (!assetId) return entidad;

  const ahora = entrada.instante || new Date().toISOString();

  const existente = entidad.activos.find((a) => a.assetId === assetId);

  if (existente) {
    existente.lastObservedAt = ahora;

    existente.observaciones = (existente.observaciones || 1) + 1;

    if (entrada.evidenceId && !existente.evidenceIds.includes(entrada.evidenceId)) {
      existente.evidenceIds.push(entrada.evidenceId);
    }

    return entidad;
  }

  entidad.activos.push({
    assetId,
    clase,
    plataforma: plataforma || null,
    handle: handle || null,
    dominio: dominio || null,
    url: entrada.url || null,

    origen: entrada.origen || entidad.origen,

    /*
      Un activo declarado por el analista no nace verificado,
      igual que la entidad.
    */
    verificacion: entrada.verificacion || ESTADOS_SOURCE.DESCUBIERTA,

    firstObservedAt: ahora,
    lastObservedAt: ahora,
    observaciones: 1,

    evidenceIds: entrada.evidenceId ? [entrada.evidenceId] : []
  });

  return entidad;
}


/*
===========================================================
COBERTURA POR CANAL
===========================================================

Que canales de esta entidad conocemos, y en cual no hay nada.
No se inventa un activo que falte: `SIN_ACTIVO_CONOCIDO` es un
resultado, no un hueco por rellenar.
===========================================================
*/
export function coberturaDeEntidad(entidad) {
  const cobertura = {};

  CANALES.forEach((canal) => {
    let activos = [];

    if (canal === "website") {
      activos = entidad.activos.filter((a) => a.clase === CLASES_ACTIVO.DOMINIO);
    } else if (canal === "rss") {
      activos = entidad.activos.filter((a) => a.clase === CLASES_ACTIVO.FEED);
    } else {
      activos = entidad.activos.filter(
        (a) => a.clase === CLASES_ACTIVO.SOCIAL && a.plataforma === canal
      );
    }

    cobertura[canal] = {
      estado: activos.length
        ? ESTADOS_COBERTURA.ENCONTRADO
        : ESTADOS_COBERTURA.SIN_ACTIVO_CONOCIDO,

      activos: activos.length,

      /*
        ENCONTRADO no es MEDIDO. Saber que existe una cuenta no
        es haber leido una sola metrica de ella, y confundirlos
        haria creer que el universo ya observa lo que solo
        conoce.
      */
      nota: activos.length
        ? "Activo conocido. ENCONTRADO no es MEDIDO: todavia no se ha observado."
        : "No se conoce ningun activo de este canal para esta entidad."
    };
  });

  /*
    Activos en plataformas que NO estan en la lista de canales
    —threads, LinkedIn—. Se cuentan aparte en lugar de quedar
    invisibles: una entidad cuyo unico activo es de Threads
    aparecia con cero canales, como si no tuviera ninguno.
  */
  const fueraDeCanales = entidad.activos.filter(
    (a) =>
      a.clase === CLASES_ACTIVO.SOCIAL &&
      a.plataforma &&
      !CANALES.includes(a.plataforma)
  );

  return {
    porCanal: cobertura,

    activosFueraDeCanales: fueraDeCanales.map((a) => ({
      plataforma: a.plataforma,
      handle: a.handle,
      nota: "Plataforma observada que no esta en la lista de canales con cobertura declarada."
    })),

    canalesConActivo: CANALES.filter(
      (c) => cobertura[c].estado === ESTADOS_COBERTURA.ENCONTRADO
    ).length,

    canalesDeclarados: CANALES.length,

    declaracion:
      "Cobertura de ACTIVOS CONOCIDOS, no de datos obtenidos. Ningun canal pasa a MEDIDO en este gate."
  };
}


/*
===========================================================
DEDUPLICACION
===========================================================

Dos entidades se funden SOLO con una señal fuerte:

    mismo dominio principal
    un dominio de una aparece como activo de la otra
    un alias declarado explicitamente

El nombre NO es señal. «El Diario» existe en media docena de
paises, y unir por nombre produciria un medio inventado que
mezcla la cobertura de dos redacciones distintas.
===========================================================
*/
export function debenFundirse(a, b) {
  if (!a || !b) return { fundir: false, motivo: null };

  if (a.mediaEntityId === b.mediaEntityId) {
    return { fundir: true, motivo: "Misma identidad." };
  }

  const dominiosDe = (e) =>
    new Set(
      e.activos
        .filter((x) => x.clase === CLASES_ACTIVO.DOMINIO && x.dominio)
        .map((x) => x.dominio.toLowerCase().replace(/^www\./, ""))
    );

  const da = dominiosDe(a);

  const db = dominiosDe(b);

  const comun = [...da].find((d) => db.has(d));

  if (comun) {
    return { fundir: true, motivo: `Comparten el dominio ${comun}.` };
  }

  const aliasCruzado =
    (a.aliases || []).some((x) => db.has(String(x).toLowerCase())) ||
    (b.aliases || []).some((x) => da.has(String(x).toLowerCase()));

  if (aliasCruzado) {
    return { fundir: true, motivo: "Un alias declarado apunta al dominio de la otra." };
  }

  if (
    a.canonicalName &&
    b.canonicalName &&
    a.canonicalName.toLowerCase() === b.canonicalName.toLowerCase()
  ) {
    return {
      fundir: false,

      motivo: `Comparten el nombre «${a.canonicalName}» y NO se funden: dos dominios distintos con el mismo nombre pueden ser dos medios distintos. Hace falta un dominio comun o un alias declarado.`,

      mismoNombre: true
    };
  }

  return { fundir: false, motivo: null };
}


/*
  Funde `origen` dentro de `destino` sin perder nada: activos,
  evidencias, alias y procedencia se acumulan, y las fechas se
  amplian hacia fuera.
*/
export function fundir(destino, origen) {
  origen.activos.forEach((a) => {
    const existente = destino.activos.find((x) => x.assetId === a.assetId);

    if (!existente) {
      destino.activos.push(a);

      return;
    }

    existente.observaciones += a.observaciones || 0;

    a.evidenceIds.forEach((id) => {
      if (!existente.evidenceIds.includes(id)) existente.evidenceIds.push(id);
    });

    if (a.firstObservedAt < existente.firstObservedAt) {
      existente.firstObservedAt = a.firstObservedAt;
    }

    if (a.lastObservedAt > existente.lastObservedAt) {
      existente.lastObservedAt = a.lastObservedAt;
    }
  });

  destino.aliases = [
    ...new Set([
      ...destino.aliases,
      ...origen.aliases,
      ...(origen.canonicalName && origen.canonicalName !== destino.canonicalName
        ? [origen.canonicalName]
        : [])
    ])
  ];

  destino.evidenceIds = [...new Set([...destino.evidenceIds, ...origen.evidenceIds])];

  destino.procedencia = [...destino.procedencia, ...origen.procedencia];

  destino.piezasObservadas += origen.piezasObservadas;

  if (origen.firstObservedAt < destino.firstObservedAt) {
    destino.firstObservedAt = origen.firstObservedAt;
  }

  if (origen.lastObservedAt > destino.lastObservedAt) {
    destino.lastObservedAt = origen.lastObservedAt;
  }

  destino.historial.push({
    accion: "FUSION",
    con: origen.mediaEntityId,
    instante: new Date().toISOString()
  });

  return destino;
}


/*
===========================================================
DESCUBRIMIENTO DESDE EL CORPUS
===========================================================

Recorre las piezas ya observadas y deriva las entidades. No
hace ninguna peticion: solo lee lo que el Lake ya guardo.

La pieza clave del algoritmo: una publicacion de `x.com` NO
crea la entidad «x.com». Crea —o enriquece— la entidad de la
CUENTA, y la cuenta se ata a un medio del catalogo unicamente
si la correspondencia esta VERIFICADA. Mientras no lo este, la
cuenta es su propia entidad sin clasificar, que es la verdad.
===========================================================
*/
export function descubrirDesdeCorpus({ piezas = [], projectId = null, instante = null } = {}) {
  const entidades = new Map();

  const excluidos = new Map();

  const sinResolver = [];

  piezas.forEach((p) => {
    const dominio = p.dominio;

    const motivo = motivoDeExclusionDelUniverso(dominio);

    /*
      Una plataforma con handle NO se descarta: el emisor es la
      cuenta, y la cuenta si es una entidad.
    */
    const handle = esPlataformaConocida(dominio)
      ? p.emisor?.handle || handleDeUrlSocial(p.canonicalUrl || p.urlOriginal)
      : null;

    if (motivo && !handle) {
      if (!excluidos.has(dominio)) {
        excluidos.set(dominio, { dominio, motivo, piezas: 0 });
      }

      excluidos.get(dominio).piezas += 1;

      return;
    }

    if (motivo && handle) {
      /* Entidad de cuenta social, con id propio. */
      const plataforma = plataformaDeDominio(dominio) || "social";

      const semilla = `${plataforma}.${handle}`;

      const id = idDeEntidad(semilla);

      if (!entidades.has(id)) {
        /*
          El nombre del emisor a veces ES el dominio de la
          plataforma —el corpus real trae `nombreEmisor:
          "threads.com"`—, y usarlo dejaria una entidad llamada
          «threads.com» cuyo unico activo es `@notivozec`. Si el
          nombre no aporta nada sobre la cuenta, gana el handle.
        */
        const nombreUtil =
          p.nombreEmisor && p.nombreEmisor.toLowerCase() !== String(dominio).toLowerCase()
            ? p.nombreEmisor
            : null;

        const e = crearEntidad({
          projectId,
          canonicalName: nombreUtil || `@${handle}`,
          tipo: TIPOS_SOURCE.OTHER,
          origen: ORIGENES_ENTIDAD.DESCUBIERTO,
          instante: p.observedAt || instante,
          detalleProcedencia: `cuenta observada en ${dominio}`
        });

        e.mediaEntityId = id;

        /*
          La correspondencia con un medio del catalogo se
          arrastra como PROPUESTA y no cambia el tipo. Es la
          misma regla que MEDIA-REAL-DEMO-01 fijo para el
          emisor: un parecido de nombre no es una identidad.
        */
        /*
          Si la pieza no trae correspondencia, se calcula con el
          MISMO matcher que usa el analisis de una pieza
          —`emitterCorrespondence`—, en lugar de escribir una
          comparacion nueva. Lo encontro el corpus real:
          `@elmercurioec` no traia propuesta y quedaba huerfano
          al lado de la entidad de `elmercurio.com.ec`.
        */
        let corr = p.emisor?.correspondencia?.candidatos?.[0];

        if (!corr) {
          try {
            corr = correspondenciasDeCuenta(handle)?.candidatos?.[0] || null;
          } catch {
            corr = null;
          }
        }

        if (corr) {
          e.correspondenciaPropuesta = {
            medioId: corr.medioId,
            nombre: corr.nombre,
            fuerza: corr.fuerza,
            estado: corr.estado,
            requiereConfirmacion: true,
            nota: "Correspondencia observada. NO une esta cuenta al medio hasta que un analista lo confirme."
          };
        }

        entidades.set(id, e);
      }

      const e = entidades.get(id);

      agregarActivo(e, {
        clase: CLASES_ACTIVO.SOCIAL,
        plataforma,
        handle,
        url: p.canonicalUrl,
        dominio,
        evidenceId: p.evidenceId,
        instante: p.observedAt
      });

      acumular(e, p);

      return;
    }

    /* Entidad web normal, identificada por su dominio. */
    const id = idDeEntidad(dominio);

    if (!id) {
      sinResolver.push({
        clave: p.clave,
        evidenceId: p.evidenceId,
        motivo: "La pieza no tiene dominio utilizable para identificar un emisor."
      });

      return;
    }

    if (!entidades.has(id)) {
      entidades.set(
        id,
        crearEntidad({
          projectId,
          dominio,
          canonicalName: p.nombreEmisor || null,
          tipo: tipoDesdeCatalogo(dominio),
          origen: ORIGENES_ENTIDAD.DESCUBIERTO,
          instante: p.observedAt || instante,
          detalleProcedencia: "derivada de una pieza del corpus"
        })
      );
    }

    const e = entidades.get(id);

    agregarActivo(e, {
      clase: CLASES_ACTIVO.DOMINIO,
      dominio,
      url: `https://${dominio}`,
      evidenceId: p.evidenceId,
      instante: p.observedAt
    });

    acumular(e, p);
  });

  return {
    entidades: [...entidades.values()],

    artefactosExcluidos: [...excluidos.values()].sort((a, b) => b.piezas - a.piezas),

    sinResolver,

    declaracion:
      "Entidades derivadas de piezas ya observadas. Ninguna peticion externa: el descubrimiento lee el corpus, no Internet."
  };
}


function tipoDesdeCatalogo(dominio) {
  const c = identificarFuente(`https://${dominio}`);

  if (!c) return TIPOS_SOURCE.OTHER;

  if (String(c.tipo || "").startsWith("medio")) return TIPOS_SOURCE.MEDIA;

  if (c.tipo === "institucion") return TIPOS_SOURCE.INSTITUTION;

  return TIPOS_SOURCE.OTHER;
}


function acumular(entidad, pieza) {
  entidad.piezasObservadas += 1;

  if (pieza.evidenceId && !entidad.evidenceIds.includes(pieza.evidenceId)) {
    entidad.evidenceIds.push(pieza.evidenceId);
  }

  if (pieza.observedAt) {
    if (pieza.observedAt < entidad.firstObservedAt) {
      entidad.firstObservedAt = pieza.observedAt;
    }

    if (pieza.observedAt > entidad.lastObservedAt) {
      entidad.lastObservedAt = pieza.observedAt;
    }
  }

  /*
    El umbral de OBSERVADA lo define `sourceUniverse` y se
    reutiliza tal cual: una fuente repetida deja de ser un
    hallazgo suelto. No sube de ahi: VERIFICADA exige respaldo.
  */
  if (entidad.piezasObservadas >= 3 && entidad.estado === ESTADOS_SOURCE.DESCUBIERTA) {
    entidad.estado = ESTADOS_SOURCE.OBSERVADA;

    entidad.verificacion.estado = ESTADOS_SOURCE.OBSERVADA;
  }
}


/*
===========================================================
OPERACIONES DEL ANALISTA
===========================================================
*/

export function declararEntidad(entrada = {}) {
  const dominio =
    entrada.dominio ||
    (entrada.website ? extraerDominio(entrada.website) : null);

  const e = crearEntidad({
    projectId: entrada.projectId,
    dominio,
    canonicalName: entrada.canonicalName || entrada.nombre || null,
    tipo: entrada.tipo || TIPOS_SOURCE.MEDIA,
    subtipo: entrada.subtipo || null,
    origen: ORIGENES_ENTIDAD.DECLARADO_POR_ANALISTA,
    instante: entrada.instante,
    detalleProcedencia: entrada.declaradoPor
      ? `declarada por ${entrada.declaradoPor}`
      : "declarada por el analista"
  });

  /*
    LA REGLA DEL GATE. Escribir un medio a mano no lo verifica.
    Se deja explicito en el objeto, no solo en la documentacion,
    para que nadie pueda leerlo mal.
  */
  e.estado = ESTADOS_SOURCE.DESCUBIERTA;

  e.verificacion = {
    estado: ESTADOS_SOURCE.DESCUBIERTA,
    verificadaPor: null,
    verificadaEn: null,
    motivo:
      "Declarada por un analista. DECLARAR NO ES VERIFICAR: hace falta respaldo de catalogo o una comprobacion explicita."
  };

  e.aliases = [...new Set((entrada.aliases || []).filter(Boolean))];

  if (entrada.scopeDeclarado) {
    e.scope.declarado = {
      ...entrada.scopeDeclarado,
      procedencia: "declarado_por_el_analista"
    };
  }

  if (entrada.website) {
    agregarActivo(e, {
      clase: CLASES_ACTIVO.DOMINIO,
      url: entrada.website,
      dominio,
      origen: ORIGENES_ENTIDAD.DECLARADO_POR_ANALISTA,
      instante: entrada.instante
    });
  }

  (entrada.feeds || []).forEach((url) =>
    agregarActivo(e, {
      clase: CLASES_ACTIVO.FEED,
      url,
      origen: ORIGENES_ENTIDAD.DECLARADO_POR_ANALISTA,
      instante: entrada.instante
    })
  );

  /*
    Varias cuentas de la misma plataforma se conservan como
    activos distintos: la lista no se colapsa.
  */
  (entrada.activosSociales || []).forEach((a) =>
    agregarActivo(e, {
      clase: CLASES_ACTIVO.SOCIAL,
      plataforma: a.plataforma || plataformaDeDominio(extraerDominio(a.url || "")),
      url: a.url,
      handle: a.handle,
      origen: ORIGENES_ENTIDAD.DECLARADO_POR_ANALISTA,
      instante: entrada.instante
    })
  );

  e.historial.push({
    accion: "DECLARADA",
    por: entrada.declaradoPor || null,
    instante: e.firstObservedAt
  });

  return e;
}


export function editarEntidad(entidad, cambios = {}, { por = null, instante = null } = {}) {
  const antes = {
    canonicalName: entidad.canonicalName,
    tipo: entidad.tipo,
    subtipo: entidad.subtipo,
    aliases: [...entidad.aliases]
  };

  if (cambios.canonicalName) entidad.canonicalName = cambios.canonicalName;

  if (cambios.tipo) entidad.tipo = cambios.tipo;

  if (cambios.subtipo !== undefined) entidad.subtipo = cambios.subtipo;

  if (cambios.aliases) {
    entidad.aliases = [...new Set([...entidad.aliases, ...cambios.aliases])];
  }

  if (cambios.scopeDeclarado) {
    entidad.scope.declarado = {
      ...cambios.scopeDeclarado,
      procedencia: "declarado_por_el_analista"
    };
  }

  /*
    El id NO se toca nunca. Es lo que ata las evidencias, y
    renombrar un medio no lo convierte en otro.
  */
  entidad.historial.push({
    accion: "EDITADA",
    por,
    antes,
    instante: instante || new Date().toISOString()
  });

  return entidad;
}


export function verificarEntidad(entidad, { por, motivo, instante = null } = {}) {
  if (!por) {
    return {
      entidad,
      verificada: false,
      motivo: "Verificar exige declarar QUIEN verifica. Sin autor no hay verificacion."
    };
  }

  const ahora = instante || new Date().toISOString();

  entidad.estado = ESTADOS_SOURCE.VERIFICADA;

  entidad.verificacion = {
    estado: ESTADOS_SOURCE.VERIFICADA,
    verificadaPor: por,
    verificadaEn: ahora,
    motivo: motivo || null
  };

  entidad.historial.push({ accion: "VERIFICADA", por, motivo: motivo || null, instante: ahora });

  return { entidad, verificada: true };
}


/*
  Desactivar NO borra. La entidad sale del universo activo y
  conserva sus activos, sus evidencias y su historia: las piezas
  ya observadas siguen siendo ciertas.
*/
export function desactivarEntidad(entidad, { por = null, motivo = null, instante = null } = {}) {
  entidad.activa = false;

  entidad.historial.push({
    accion: "DESACTIVADA",
    por,
    motivo,
    instante: instante || new Date().toISOString()
  });

  return entidad;
}


export function reactivarEntidad(entidad, { por = null, instante = null } = {}) {
  entidad.activa = true;

  entidad.historial.push({
    accion: "REACTIVADA",
    por,
    instante: instante || new Date().toISOString()
  });

  return entidad;
}


/*
===========================================================
RESUMEN DEL UNIVERSO
===========================================================
*/
export function resumirUniverso(entidades = [], { artefactos = [], sinResolver = [] } = {}) {
  const activas = entidades.filter((e) => e.activa);

  const cuenta = (fn) => activas.filter(fn).length;

  const activos = activas.flatMap((e) => e.activos);

  return {
    entidades: activas.length,
    entidadesInactivas: entidades.length - activas.length,

    porTipo: [...new Set(activas.map((e) => e.tipo))].map((tipo) => ({
      tipo,
      entidades: cuenta((e) => e.tipo === tipo)
    })),

    porOrigen: [...new Set(activas.map((e) => e.origen))].map((origen) => ({
      origen,
      entidades: cuenta((e) => e.origen === origen)
    })),

    porEstado: [...new Set(activas.map((e) => e.estado))].map((estado) => ({
      estado,
      entidades: cuenta((e) => e.estado === estado)
    })),

    activos: {
      total: activos.length,
      dominios: activos.filter((a) => a.clase === CLASES_ACTIVO.DOMINIO).length,
      sociales: activos.filter((a) => a.clase === CLASES_ACTIVO.SOCIAL).length,
      feeds: activos.filter((a) => a.clase === CLASES_ACTIVO.FEED).length
    },

    verificadas: cuenta((e) => e.estado === ESTADOS_SOURCE.VERIFICADA),

    artefactosExcluidos: artefactos.length,

    sinResolver: sinResolver.length,

    /*
      La frase que impide leer esta lista como un ranking.
    */
    declaracion:
      "Estar en el universo significa que Sentinel conoce esta fuente dentro del proyecto. No significa importante, popular ni influyente: el orden lo calcula el ranking, con su ventana y su evidencia."
  };
}


export default {
  VERSION_UNIVERSO_MEDIOS,
  SUBMOTOR_UNIVERSO,
  CLASES_ACTIVO,
  ORIGENES_ENTIDAD,
  ESTADOS_COBERTURA,
  CANALES,
  TIPOS_SOURCE,
  SUBTIPOS_MEDIA,
  ESTADOS_SOURCE,
  plataformaDeDominio,
  handleDeUrlSocial,
  motivoDeExclusionDelUniverso,
  puedeSerEntidadMedia,
  idDeEntidad,
  idDeActivo,
  crearEntidad,
  agregarActivo,
  coberturaDeEntidad,
  debenFundirse,
  fundir,
  descubrirDesdeCorpus,
  declararEntidad,
  editarEntidad,
  verificarEntidad,
  desactivarEntidad,
  reactivarEntidad,
  resumirUniverso
};
