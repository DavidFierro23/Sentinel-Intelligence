// apps/backend/services/media/publicMetadata.js

import { limpiarHtml, extraerDominio } from "../textUtils.js";

/*
===========================================================
METADATA PUBLICA DE UNA PIEZA — MEDIA-PIECE-02
===========================================================

Lee lo que la propia pagina PUBLICA PARA SER COMPARTIDA:
Open Graph, Twitter Cards, `<link rel=canonical>` y JSON-LD.

POR QUE ESTO NO ES SCRAPING EVASIVO
-----------------------------------------------------------

Open Graph existe con un unico proposito: que un tercero
—Facebook, WhatsApp, Slack, un buscador— pueda mostrar una
tarjeta de la pagina. Leer esas etiquetas es usar el dato para
lo que fue publicado.

Lo que separa esto del scraping evasivo, punto por punto:

    · se comprueba robots.txt ANTES de pedir la pagina y se
      obedece; si prohibe la ruta, no se pide
    · el User-Agent dice quien somos, no imita a un navegador
    · no se envian cookies, ni sesion, ni cabeceras de consent
    · no se resuelve ningun captcha ni muro de login
    · una peticion por pieza, con tiempo y tamano limitados
    · si la plataforma responde con un muro, se DECLARA el muro
      en lugar de buscar la vuelta

Si la plataforma no quiere darnos la metadata, no se insiste.
Esa negativa es un dato y se reporta como tal.

LO QUE SE GUARDA
-----------------------------------------------------------

Titulo, descripcion corta, autor declarado, fecha declarada y
nombre del sitio. Es `EXTRACTO`, la misma politica que el
contrato de evidencia aplica a un feed. NO se guarda el cuerpo
del articulo: eso depende de la licencia del medio y no se ha
comprobado.

CADA CAMPO VIAJA CON SU PROCEDENCIA
-----------------------------------------------------------

`og:title` y `<title>` no valen lo mismo: el primero lo escribe
el editor para compartir, el segundo puede traer el nombre del
sitio y basura de SEO. Quien lea el dato tiene que poder saber
de que etiqueta salio.
===========================================================
*/


export const AGENTE =
  "SentinelIntelligence/1.0 (+lectura de metadata publica; sin autenticacion)";

const TIEMPO_MAXIMO_MS = 8000;

/* Tope de bytes leidos. La metadata vive en el <head>. */
const TOPE_BYTES = 320 * 1024;


export const ESTADOS_LECTURA = Object.freeze({
  OK: "OK",

  /* robots.txt prohibe la ruta: no se pidio la pagina. */
  PROHIBIDA_POR_ROBOTS: "PROHIBIDA_POR_ROBOTS",

  /*
    La plataforma respondio, pero con un muro de login o de
    consentimiento en lugar del documento. No se rodea.
  */
  BLOQUEADA_POR_LA_PLATAFORMA: "BLOQUEADA_POR_LA_PLATAFORMA",

  NO_ENCONTRADA: "NO_ENCONTRADA",
  ERROR_DE_RED: "ERROR_DE_RED",
  SIN_METADATA: "SIN_METADATA",

  /* Desactivada por el llamador: ni una peticion. */
  NO_INTENTADA: "NO_INTENTADA"
});


export const PROCEDENCIAS_CAMPO = Object.freeze({
  OG: "open_graph",
  TWITTER_CARD: "twitter_card",
  JSON_LD: "json_ld",
  TITLE: "etiqueta_title",
  META_NAME: "meta_name",
  CANONICAL: "link_canonical",
  URL: "forma_de_la_url",
  ANALISTA: "declarado_por_el_analista",
  PLATAFORMA_API: "api_de_la_plataforma",
  BUSCADOR: "snippet_de_buscador"
});


/*
-----------------------------------------------------------
ROBOTS.TXT

Implementacion deliberadamente conservadora: ante la duda, se
prohibe. Solo se aplican las reglas del grupo `*` y las del
grupo que nombre a nuestro agente.

El resultado se cachea por host con CADUCIDAD. Sin caducidad,
un `robots.txt` que cambie no surtiria efecto mientras el
proceso siga vivo —y este proceso vive dias—, que es
exactamente obedecer una regla derogada. Quince minutos es un
compromiso: no repite la peticion en cada analisis y no
sostiene una regla vieja mas de un cuarto de hora.
-----------------------------------------------------------
*/
const cacheRobots = new Map();

const TTL_ROBOTS_MS = 15 * 60 * 1000;


/* Purga explicita: la usan los tests y cualquier recarga manual. */
export function limpiarCacheRobots() {
  const n = cacheRobots.size;

  cacheRobots.clear();

  return { purgadas: n };
}


/*
  La `canonicalUrl` del contrato de evidencia es un IDENTIFICADOR
  y viene sin esquema (`medio.tld/nota`), a proposito: dos URLs
  que solo difieren en http/https son la misma pieza.

  Pero para PEDIR la pagina hace falta una direccion absoluta.
  Confundir las dos cosas es lo que hacia que la lectura fallara
  con «URL no utilizable» sin llegar a intentarlo.
*/
export function aUrlAbsoluta(url) {
  const s = String(url || "").trim();

  if (!s) return null;

  const conEsquema = /^https?:\/\//i.test(s) ? s : `https://${s}`;

  try {
    return new URL(conEsquema).toString();
  } catch {
    return null;
  }
}


export async function robotsPermite(url, opciones = {}) {
  const abs = aUrlAbsoluta(url);

  if (!abs) return { permite: false, motivo: "URL no utilizable." };

  let u;

  try {
    u = new URL(abs);
  } catch {
    return { permite: false, motivo: "URL no utilizable." };
  }

  const clave = `${u.protocol}//${u.host}`;

  const enCache = cacheRobots.get(clave);

  if (enCache && Date.now() - enCache.guardadoEn < TTL_ROBOTS_MS) {
    return evaluarRobots(enCache.reglas, u.pathname + u.search);
  }

  const fetchImpl = opciones.fetch || globalThis.fetch;

  let texto = null;

  try {
    const control = new AbortController();

    const t = setTimeout(() => control.abort(), 4000);

    const r = await fetchImpl(`${clave}/robots.txt`, {
      headers: { "User-Agent": AGENTE, Accept: "text/plain" },
      signal: control.signal,
      redirect: "follow"
    });

    clearTimeout(t);

    /*
      Sin robots.txt (404) se entiende que no hay restriccion.
      Es la interpretacion estandar del protocolo.
    */
    if (r.status === 404 || r.status === 410) {
      texto = "";
    } else if (!r.ok) {
      /*
        5xx o 403 sobre robots.txt: el estandar dice tratarlo
        como prohibicion total. Se obedece.
      */
      cacheRobots.set(clave, {
        guardadoEn: Date.now(),
        reglas: { indeterminado: true, status: r.status }
      });

      return {
        permite: false,
        motivo: `robots.txt respondio HTTP ${r.status}: ante la duda no se pide la pagina.`
      };
    } else {
      texto = (await r.text()).slice(0, 100 * 1024);
    }
  } catch (error) {
    cacheRobots.set(clave, {
      guardadoEn: Date.now(),
      reglas: { indeterminado: true, error: error?.message }
    });

    return {
      permite: false,
      motivo: `No se pudo leer robots.txt (${error?.message || "fallo de red"}): ante la duda no se pide la pagina.`
    };
  }

  const reglas = parsearRobots(texto);

  cacheRobots.set(clave, { guardadoEn: Date.now(), reglas });

  return evaluarRobots(reglas, u.pathname + u.search);
}


function parsearRobots(texto) {
  const lineas = String(texto || "").split(/\r?\n/);

  const grupos = [];

  let actual = null;

  lineas.forEach((linea) => {
    const l = linea.replace(/#.*$/, "").trim();

    if (!l) return;

    const m = l.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);

    if (!m) return;

    const campo = m[1].toLowerCase();

    const valor = m[2].trim();

    if (campo === "user-agent") {
      /* Varios user-agent seguidos comparten el mismo grupo. */
      if (!actual || actual.reglas.length) {
        actual = { agentes: [], reglas: [] };
        grupos.push(actual);
      }

      actual.agentes.push(valor.toLowerCase());

      return;
    }

    if (!actual) return;

    if (campo === "disallow" || campo === "allow") {
      actual.reglas.push({ tipo: campo, ruta: valor });
    }
  });

  return { grupos };
}


function evaluarRobots(reglas, ruta) {
  if (reglas?.indeterminado) {
    return {
      permite: false,
      motivo: "El estado de robots.txt es indeterminado: no se pide la pagina."
    };
  }

  const nuestro = AGENTE.split("/")[0].toLowerCase();

  const grupos = reglas?.grupos || [];

  /* Grupo especifico para nosotros; si no, el comodin. */
  const propio = grupos.find((g) => g.agentes.some((a) => a === nuestro));

  const comodin = grupos.find((g) => g.agentes.includes("*"));

  const grupo = propio || comodin;

  if (!grupo) return { permite: true, motivo: "robots.txt no restringe esta ruta." };

  /* La regla mas larga que coincide gana; Allow gana a Disallow. */
  let mejor = null;

  grupo.reglas.forEach((r) => {
    if (r.ruta === "") return;

    if (!ruta.startsWith(r.ruta)) return;

    if (!mejor || r.ruta.length > mejor.ruta.length ||
        (r.ruta.length === mejor.ruta.length && r.tipo === "allow")) {
      mejor = r;
    }
  });

  if (!mejor) return { permite: true, motivo: "Ninguna regla coincide con la ruta." };

  if (mejor.tipo === "allow") {
    return { permite: true, motivo: `robots.txt permite ${mejor.ruta}.` };
  }

  return {
    permite: false,
    motivo: `robots.txt prohibe ${mejor.ruta} para ${propio ? "nuestro agente" : "todos los agentes"}. No se pide la pagina.`
  };
}


/*
-----------------------------------------------------------
DETECCION DE MURO

Facebook, Instagram y X sirven a un agente no autenticado una
pagina de login o de consentimiento. Tiene HTTP 200 y HTML, y
si nadie lo comprueba se registra como "sin metadata" cuando en
realidad es "nos han cerrado la puerta". La diferencia importa:
la primera invita a reintentar, la segunda a no hacerlo.
-----------------------------------------------------------
*/
const SENALES_DE_MURO = [
  /log ?in to (continue|facebook|instagram)/i,
  /inicia sesi[oó]n para continuar/i,
  /you must log in to continue/i,
  /content isn'?t available/i,
  /this content isn'?t available right now/i,
  /\/x\/migrate\?tok=/i,
  /javascript is (not available|disabled)/i,
  /enable javascript/i,
  /consent[_-]?(page|form)/i
];


function pareceMuro(html, urlFinal, urlPedida) {
  const senal = SENALES_DE_MURO.find((re) => re.test(html));

  if (senal) return `La pagina devuelta contiene un muro (${senal}).`;

  try {
    const a = new URL(urlFinal);

    const b = new URL(urlPedida);

    const rutaLogin = /\/(login|consent|checkpoint|privacy\/consent)/i.test(a.pathname);

    if (rutaLogin && a.pathname !== b.pathname) {
      return `La peticion fue redirigida a ${a.pathname}: muro de acceso.`;
    }
  } catch {
    /* sin URL final utilizable no se concluye nada */
  }

  return null;
}


/*
-----------------------------------------------------------
EXTRACCION DE ETIQUETAS
-----------------------------------------------------------
*/
function meta(html, ...claves) {
  for (const clave of claves) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${clave.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}["'][^>]*>`,
      "i"
    );

    const etiqueta = html.match(re)?.[0];

    if (!etiqueta) continue;

    const valor = etiqueta.match(/content=["']([\s\S]*?)["']/i)?.[1];

    if (valor && valor.trim()) return limpiarHtml(valor).trim();
  }

  return null;
}


function jsonLd(html) {
  const bloques = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  for (const b of bloques) {
    try {
      const datos = JSON.parse(b[1].trim());

      const lista = Array.isArray(datos) ? datos : [datos, ...(datos["@graph"] || [])];

      for (const d of lista) {
        if (!d || typeof d !== "object") continue;

        const autor =
          typeof d.author === "string"
            ? d.author
            : d.author?.name || d.creator?.name || null;

        if (d.datePublished || autor || d.headline) {
          return {
            headline: d.headline || d.name || null,
            datePublished: d.datePublished || d.dateCreated || null,
            author: autor || null,
            tipo: d["@type"] || null
          };
        }
      }
    } catch {
      /* JSON-LD roto: se ignora, no se adivina */
    }
  }

  return null;
}


function campo(valor, procedencia, etiqueta) {
  return valor
    ? { valor, procedencia, etiqueta: etiqueta || null }
    : { valor: null, procedencia: null, etiqueta: null };
}


/*
===========================================================
LEER
===========================================================
*/
export async function leerMetadataPublica(url, opciones = {}) {
  const vacio = (estado, motivo) => ({
    estado,
    motivo,
    url,
    urlFinal: null,
    httpStatus: null,
    robots: null,
    campos: {
      titulo: campo(null),
      descripcion: campo(null),
      autor: campo(null),
      publishedAt: campo(null),
      sitio: campo(null),
      canonical: campo(null),
      tipo: campo(null)
    },
    peticiones: 0
  });

  if (opciones.desactivado === true) {
    return vacio(
      ESTADOS_LECTURA.NO_INTENTADA,
      "Lectura de metadata publica desactivada por el llamador."
    );
  }

  if (!url) return vacio(ESTADOS_LECTURA.ERROR_DE_RED, "No se recibio URL.");

  const objetivo = aUrlAbsoluta(url);

  if (!objetivo) {
    return vacio(
      ESTADOS_LECTURA.ERROR_DE_RED,
      `La URL "${url}" no se pudo convertir en una direccion absoluta.`
    );
  }

  /* --- 1. robots.txt PRIMERO --- */
  let robots = { permite: true, motivo: "no comprobado" };

  if (opciones.ignorarRobots !== true) {
    robots = await robotsPermite(objetivo, opciones);

    if (!robots.permite) {
      const r = vacio(ESTADOS_LECTURA.PROHIBIDA_POR_ROBOTS, robots.motivo);

      r.robots = robots;
      r.peticiones = 1;

      return r;
    }
  }

  /* --- 2. la pagina --- */
  const fetchImpl = opciones.fetch || globalThis.fetch;

  const control = new AbortController();

  const t = setTimeout(() => control.abort(), opciones.timeoutMs || TIEMPO_MAXIMO_MS);

  let respuesta;

  let html = "";

  try {
    respuesta = await fetchImpl(objetivo, {
      redirect: "follow",

      /*
        Cabeceras minimas y honestas. Ni cookies, ni Referer
        falso, ni User-Agent de navegador.
      */
      headers: {
        "User-Agent": AGENTE,
        Accept: "text/html,application/xhtml+xml"
      },

      signal: control.signal
    });

    html = (await respuesta.text()).slice(0, TOPE_BYTES);
  } catch (error) {
    clearTimeout(t);

    const r = vacio(
      ESTADOS_LECTURA.ERROR_DE_RED,
      `No se pudo leer la pagina: ${error?.message || "fallo de red"}.`
    );

    r.robots = robots;
    r.peticiones = 2;

    return r;
  }

  clearTimeout(t);

  const urlFinal = respuesta.url || objetivo;

  if (respuesta.status === 404 || respuesta.status === 410) {
    const r = vacio(
      ESTADOS_LECTURA.NO_ENCONTRADA,
      `La pagina respondio HTTP ${respuesta.status}.`
    );

    r.robots = robots;
    r.httpStatus = respuesta.status;
    r.peticiones = 2;

    return r;
  }

  if (!respuesta.ok) {
    const bloqueo = [401, 403, 429].includes(respuesta.status);

    const r = vacio(
      bloqueo
        ? ESTADOS_LECTURA.BLOQUEADA_POR_LA_PLATAFORMA
        : ESTADOS_LECTURA.ERROR_DE_RED,
      `La plataforma respondio HTTP ${respuesta.status}${
        bloqueo ? ": acceso restringido para un agente no autenticado." : "."
      }`
    );

    r.robots = robots;
    r.httpStatus = respuesta.status;
    r.peticiones = 2;

    return r;
  }

  const muro = pareceMuro(html, urlFinal, objetivo);

  if (muro) {
    const r = vacio(ESTADOS_LECTURA.BLOQUEADA_POR_LA_PLATAFORMA, muro);

    r.robots = robots;
    r.httpStatus = respuesta.status;
    r.urlFinal = urlFinal;
    r.peticiones = 2;

    return r;
  }

  /* --- 3. extraer --- */
  const ld = jsonLd(html);

  const ogTitulo = meta(html, "og:title");

  const twTitulo = meta(html, "twitter:title");

  const tituloEtiqueta = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
    .trim();

  const titulo = ogTitulo
    ? campo(ogTitulo, PROCEDENCIAS_CAMPO.OG, "og:title")
    : twTitulo
      ? campo(twTitulo, PROCEDENCIAS_CAMPO.TWITTER_CARD, "twitter:title")
      : ld?.headline
        ? campo(ld.headline, PROCEDENCIAS_CAMPO.JSON_LD, "headline")
        : tituloEtiqueta
          ? campo(limpiarHtml(tituloEtiqueta), PROCEDENCIAS_CAMPO.TITLE, "<title>")
          : campo(null);

  const desc = meta(html, "og:description");

  const descripcion = desc
    ? campo(desc, PROCEDENCIAS_CAMPO.OG, "og:description")
    : (() => {
        const tw = meta(html, "twitter:description");

        if (tw) return campo(tw, PROCEDENCIAS_CAMPO.TWITTER_CARD, "twitter:description");

        const dn = meta(html, "description");

        return dn ? campo(dn, PROCEDENCIAS_CAMPO.META_NAME, "description") : campo(null);
      })();

  const autorMeta = meta(html, "article:author", "author", "twitter:creator");

  const autor = autorMeta
    ? campo(
        autorMeta,
        autorMeta === meta(html, "twitter:creator")
          ? PROCEDENCIAS_CAMPO.TWITTER_CARD
          : PROCEDENCIAS_CAMPO.OG,
        "article:author|author|twitter:creator"
      )
    : ld?.author
      ? campo(ld.author, PROCEDENCIAS_CAMPO.JSON_LD, "author")
      : campo(null);

  const fechaMeta = meta(
    html,
    "article:published_time",
    "og:article:published_time",
    "date",
    "pubdate",
    "publish-date"
  );

  const publishedAt = fechaMeta
    ? campo(fechaMeta, PROCEDENCIAS_CAMPO.OG, "article:published_time")
    : ld?.datePublished
      ? campo(ld.datePublished, PROCEDENCIAS_CAMPO.JSON_LD, "datePublished")
      : campo(null);

  const sitioMeta = meta(html, "og:site_name");

  const sitio = sitioMeta
    ? campo(sitioMeta, PROCEDENCIAS_CAMPO.OG, "og:site_name")
    : campo(extraerDominio(urlFinal), PROCEDENCIAS_CAMPO.URL, "hostname");

  const canonHtml =
    html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0] || null;

  const canonValor = canonHtml
    ? canonHtml.match(/href=["']([^"']+)["']/i)?.[1] || null
    : meta(html, "og:url");

  const canonical = canonValor
    ? campo(
        canonValor,
        canonHtml ? PROCEDENCIAS_CAMPO.CANONICAL : PROCEDENCIAS_CAMPO.OG,
        canonHtml ? "link[rel=canonical]" : "og:url"
      )
    : campo(null);

  const tipoOg = meta(html, "og:type");

  const campos = {
    titulo,
    descripcion,
    autor,
    publishedAt,
    sitio,
    canonical,
    tipo: tipoOg
      ? campo(tipoOg, PROCEDENCIAS_CAMPO.OG, "og:type")
      : ld?.tipo
        ? campo(ld.tipo, PROCEDENCIAS_CAMPO.JSON_LD, "@type")
        : campo(null)
  };

  const algo = Object.values(campos).some((c) => c.valor);

  return {
    estado: algo ? ESTADOS_LECTURA.OK : ESTADOS_LECTURA.SIN_METADATA,

    motivo: algo
      ? null
      : "La pagina respondio, pero no publica etiquetas Open Graph, Twitter Card ni JSON-LD utilizables.",

    url,
    urlFinal,
    httpStatus: respuesta.status,
    robots,
    campos,
    peticiones: 2,

    politica:
      "Solo metadata declarada para compartir (EXTRACTO). No se guarda el cuerpo del documento.",

    declaracion:
      "Lectura sin autenticacion, sin cookies y respetando robots.txt. Un muro de la plataforma se declara, no se rodea."
  };
}


export default {
  AGENTE,
  ESTADOS_LECTURA,
  PROCEDENCIAS_CAMPO,
  aUrlAbsoluta,
  robotsPermite,
  limpiarCacheRobots,
  leerMetadataPublica
};
