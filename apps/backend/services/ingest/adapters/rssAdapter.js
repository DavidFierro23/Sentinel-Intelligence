// apps/backend/services/ingest/adapters/rssAdapter.js

import Parser from "rss-parser";

import { normalizarEvidencia, TIPOS_CONTENIDO, POLITICAS_ALMACENAMIENTO } from "../evidenceContract.js";
import { extraerDominio, limpiarHtml } from "../../textUtils.js";

/*
===========================================================
RSS / ATOM DIRECTO — INGEST-REAL-01
===========================================================

Leer al medio en su propia casa.

POR QUE ES LA MEJORA MAS BARATA QUE HAY
-----------------------------------------------------------

Google News entrega el enlace apuntando a `news.google.com` y
esconde al publicador: hay que rescatarlo del sufijo del
titular, un metodo que ya esta marcado como fragil en el
registro de medios. Medido sobre el corpus real, las 30
evidencias colapsaban a UN dominio.

Leyendo el RSS de El Mercurio, el publicador no hay que
adivinarlo: es el feed. Y el enlace es el del articulo, no el
del agregador.

Coste: cero. Sin credencial, sin cuota, sin contrato.

LO QUE ESTE ADAPTER NO HACE
-----------------------------------------------------------

NO adivina rutas de feed. Probar `/rss`, `/feed` y `/rss.xml`
contra un dominio es exactamente el patron de peticiones que un
servidor lee como escaneo, y ademas produce falsos positivos:
muchos sitios devuelven 200 con una pagina de error.

Un feed entra en el registro cuando el sitio lo DECLARA —en un
`<link rel="alternate" type="application/rss+xml">`— o cuando
lo aporta un analista. Si no hay feed declarado, el medio queda
`SIN_RSS` y se dice.

`SIN_RSS` no es un fallo: es un hecho sobre ese medio, y saberlo
evita reintentarlo cada hora.

NO sustituye el feed por raspado. Si un medio no publica RSS,
la respuesta es «no publica RSS», no «vamos a leerle el HTML».
===========================================================
*/


export const ID = "rss_directo";

export const NOMBRE = "RSS directo del medio";

export const TIPO = "noticias";

const TIEMPO_MAXIMO_MS = 10000;

const MAXIMO_ENTRADAS = 40;


export const ESTADOS_FEED = Object.freeze({
  OK: "OK",
  SIN_RSS: "SIN_RSS",
  INACCESIBLE: "INACCESIBLE",
  VACIO: "VACIO",
  MALFORMADO: "MALFORMADO"
});


/*
  `rss-parser` entiende RSS 2.0 y Atom con el mismo API, asi que
  no hacen falta dos rutas de codigo. Lo que si cambia es el
  nombre de los campos, y eso se resuelve al normalizar.
*/
const parser = new Parser({
  timeout: TIEMPO_MAXIMO_MS,
  customFields: {
    item: [
      ["content:encoded", "contenidoCompleto"],
      ["dc:creator", "autorDC"],
      ["media:content", "medio", { keepArray: true }]
    ]
  }
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
-----------------------------------------------------------
DESCUBRIR FEEDS DECLARADOS

Se lee el HTML de la portada UNA vez y se buscan los
`<link rel="alternate">` que el propio sitio publica. Es la
forma que el estandar previo para esto.

Una sola peticion, a la portada, con User-Agent identificado.
No es un escaneo.
-----------------------------------------------------------
*/

const RE_LINK_ALTERNATE =
  /<link[^>]+rel=["']alternate["'][^>]*>/gi;

const RE_TYPE = /type=["']([^"']+)["']/i;

const RE_HREF = /href=["']([^"']+)["']/i;

const RE_TITLE = /title=["']([^"']*)["']/i;

const TIPOS_FEED = [
  "application/rss+xml",
  "application/atom+xml",
  "application/feed+json"
];


export function extraerFeedsDeclarados(html, urlBase) {
  const encontrados = [];

  const enlaces = String(html || "").match(RE_LINK_ALTERNATE) || [];

  enlaces.forEach((etiqueta) => {
    const tipo = (etiqueta.match(RE_TYPE) || [])[1];

    if (!tipo || !TIPOS_FEED.includes(tipo.toLowerCase().trim())) return;

    const href = (etiqueta.match(RE_HREF) || [])[1];

    if (!href) return;

    let absoluta = href;

    try {
      absoluta = new URL(href, urlBase).toString();
    } catch {
      return;
    }

    if (encontrados.some((f) => f.url === absoluta)) return;

    encontrados.push({
      url: absoluta,
      tipo: tipo.toLowerCase().trim(),
      titulo: (etiqueta.match(RE_TITLE) || [])[1] || null,

      /*
        Declarado por el sitio. La distincion importa: un feed
        declarado es un compromiso del medio; uno adivinado es
        una suposicion nuestra.
      */
      origen: "declarado_por_el_sitio"
    });
  });

  return encontrados;
}


export async function descubrirFeeds(sitioWeb, opciones = {}) {
  if (!sitioWeb) {
    return {
      feeds: [],
      estado: ESTADOS_FEED.SIN_RSS,
      motivo: "No se declaró sitio web del medio."
    };
  }

  const fetchImpl = opciones.fetch || globalThis.fetch;

  try {
    const respuesta = await conTiempoLimite(
      fetchImpl(sitioWeb, {
        headers: {
          "user-agent":
            "SentinelIntelligence/1.0 (lector de feeds declarados; contacto en el sitio del operador)",
          accept: "text/html"
        }
      }),
      TIEMPO_MAXIMO_MS,
      "Descubrimiento de feeds"
    );

    if (!respuesta.ok) {
      return {
        feeds: [],
        estado: ESTADOS_FEED.INACCESIBLE,
        motivo: `El sitio respondió ${respuesta.status}.`
      };
    }

    const html = await respuesta.text();

    const feeds = extraerFeedsDeclarados(html, sitioWeb);

    return feeds.length > 0
      ? { feeds, estado: ESTADOS_FEED.OK, motivo: null }
      : {
          feeds: [],
          estado: ESTADOS_FEED.SIN_RSS,

          motivo:
            "El sitio no declara ningún feed en su HTML. NO se prueban rutas comunes: adivinar /rss o /feed es un patrón de escaneo y produce falsos positivos."
        };
  } catch (error) {
    return {
      feeds: [],
      estado: ESTADOS_FEED.INACCESIBLE,
      motivo: error?.message || "fallo de red"
    };
  }
}


/*
===========================================================
NORMALIZAR UNA ENTRADA DE FEED
===========================================================

`rss-parser` unifica RSS y Atom en el mismo objeto, pero no
todo: `guid` (RSS) e `id` (Atom) cumplen la misma funcion con
distinto nombre, y `isoDate` solo aparece si la fecha era
parseable.
===========================================================
*/

export function normalizarEntradaDeFeed(item, contexto = {}) {
  const url = item.link || item.guid || item.id || null;

  /*
    El `guid` de un feed suele ser la URL permanente del
    articulo. Cuando lo es, es MEJOR canonica que `link`, que a
    veces lleva parametros de campaña del propio medio.
  */
  const guidEsUrl = typeof item.guid === "string" && /^https?:\/\//i.test(item.guid);

  const bruto = {
    url,
    canonicalUrl: guidEsUrl ? item.guid : null,
    title: item.title || "",

    /*
      `content:encoded` trae el articulo completo. NO se usa
      como extracto por defecto: la politica de almacenamiento
      por defecto es SOLO_REFERENCIA y guardar el texto entero
      exige licencia que lo permita.
    */
    snippet: limpiarHtml(item.contentSnippet || item.summary || item.content || ""),

    publishedAt: item.isoDate || item.pubDate || item.published || null,

    author: item.creator || item.autorDC || item.author || null,

    /*
      El publicador NO se adivina: es el feed. Es justo la
      ventaja de leer al medio en su casa.
    */
    publisher: contexto.publisher || null,

    sourceId: contexto.sourceId || extraerDominio(url) || null,

    contentType: TIPOS_CONTENIDO.NOTICIA,

    language: contexto.language || null
  };

  return normalizarEvidencia(bruto, {
    providerId: ID,
    query: contexto.feedUrl || null,
    queryType: contexto.queryType || null,
    queryLabel: contexto.queryLabel || null,
    observedAt: contexto.observedAt || null,
    language: contexto.language || null,
    contentType: TIPOS_CONTENIDO.NOTICIA,

    /*
      EXTRACTO: lo que el propio feed publica como resumen es
      lo que el medio ofrece para sindicar. El articulo
      completo NO se guarda salvo licencia explicita.
    */
    politicaAlmacenamiento: POLITICAS_ALMACENAMIENTO.EXTRACTO,

    conservarBruto: contexto.conservarBruto === true
  });
}


/*
===========================================================
LEER UN FEED
===========================================================
*/

export async function leerFeed(feedUrl, contexto = {}) {
  const inicio = Date.now();

  if (!feedUrl) {
    return {
      estado: ESTADOS_FEED.SIN_RSS,
      evidencias: [],
      error: "No se indicó URL de feed.",
      latenciaMs: 0
    };
  }

  const leer = contexto.parseURL || ((u) => parser.parseURL(u));

  try {
    const feed = await conTiempoLimite(leer(feedUrl), TIEMPO_MAXIMO_MS, "RSS");

    const items = (feed?.items || []).slice(0, contexto.maximo || MAXIMO_ENTRADAS);

    if (items.length === 0) {
      return {
        estado: ESTADOS_FEED.VACIO,
        evidencias: [],
        feedTitulo: feed?.title || null,
        error: null,
        latenciaMs: Date.now() - inicio,

        aviso:
          "El feed responde pero no trae entradas. Vacío NO es silencio del medio: puede ser un feed abandonado."
      };
    }

    const evidencias = items.map((item) =>
      normalizarEntradaDeFeed(item, {
        ...contexto,

        /*
          El titulo del feed identifica al medio mejor que el
          dominio cuando el dominio es generico.
        */
        publisher: contexto.publisher || feed?.title || null,

        feedUrl
      })
    );

    return {
      estado: ESTADOS_FEED.OK,
      evidencias,
      feedTitulo: feed?.title || null,
      feedUrl,
      recibidas: items.length,
      error: null,
      latenciaMs: Date.now() - inicio
    };
  } catch (error) {
    const msg = error?.message || "error";

    return {
      estado: /parse|invalid|not a feed|unexpected/i.test(msg)
        ? ESTADOS_FEED.MALFORMADO
        : ESTADOS_FEED.INACCESIBLE,

      evidencias: [],
      error: msg,
      latenciaMs: Date.now() - inicio,

      /*
        Un feed caido NO significa que el medio no publique.
        La distincion es la misma que separa «bloqueado» de
        «0 resultados» en el Search Provider Layer.
      */
      declaracion:
        "El feed no respondió. Eso NO es ausencia de publicaciones del medio: es ausencia de lectura."
    };
  }
}


export function diagnostico() {
  return {
    id: ID,
    nombre: NOMBRE,
    tipo: TIPO,

    requiereCredencial: false,
    credencial: "no aplica",

    costoPorConsulta: 0,
    motivoCosto: "Feeds públicos del propio medio. Sin contrato ni cuota.",

    limitaciones: [
      "Solo lee feeds DECLARADOS por el sitio. No adivina rutas: probar /rss o /feed es un patrón de escaneo con falsos positivos.",
      "Un medio sin feed queda SIN_RSS. No se sustituye por raspado.",
      "La ventana la decide el medio: un feed suele traer entre 10 y 40 entradas recientes, no un archivo."
    ],

    ventaja:
      "El publicador no se adivina: es el feed. Resuelve el problema de Google News, que oculta al medio detrás de news.google.com."
  };
}


export default {
  ID,
  NOMBRE,
  TIPO,
  ESTADOS_FEED,
  descubrirFeeds,
  extraerFeedsDeclarados,
  leerFeed,
  normalizarEntradaDeFeed,
  diagnostico
};
