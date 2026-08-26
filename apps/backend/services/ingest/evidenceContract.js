// apps/backend/services/ingest/evidenceContract.js

import { createHash } from "node:crypto";

import { normalizarUrl, extraerDominio, limpiarHtml } from "../textUtils.js";

/*
===========================================================
CONTRATO COMUN DE EVIDENCIA — INGEST-REAL-01
===========================================================

Una evidencia, venga de donde venga, entra con la misma forma.

POR QUE HACE FALTA AHORA Y NO ANTES
-----------------------------------------------------------

Con un solo proveedor productivo —Google News RSS— el formato
del proveedor ERA el formato de la evidencia y nadie notaba la
diferencia. Con seis, cada uno trae su propio vocabulario:

    Google News   title, link, contentSnippet, pubDate
    Brave         title, url, description, age
    SerpAPI       title, link, snippet, date
    YouTube       snippet.title, id.videoId, publishedAt
    GDELT         title, url, seendate, domain
    RSS directo   title, link, summary|content, published

Sin un contrato, cada motor de analisis tendria que conocer los
seis. Peor: la deduplicacion entre proveedores seria imposible,
porque no habria un campo comun sobre el que comparar.

LO QUE NO SE PIERDE
-----------------------------------------------------------

`rawMetadataReference` guarda de donde salio cada campo. La
normalizacion no puede ser un embudo que tira la procedencia:
si manana hay que auditar por que una evidencia se atribuyo a
un medio, la respuesta tiene que estar aqui.

LO QUE ESTE CONTRATO NO HACE
-----------------------------------------------------------

No geolocaliza, no clasifica y no decide de que tema es. Eso lo
hacen los motores que ya existen. `territoryHints` son PISTAS
—lo que el proveedor dijo—, nunca una ubicacion resuelta: GEO-1
gobierna eso y no se toca desde aqui.
===========================================================
*/


export const TIPOS_CONTENIDO = Object.freeze({
  NOTICIA: "noticia",
  VIDEO: "video",
  PUBLICACION_SOCIAL: "publicacion_social",
  PAGINA_WEB: "pagina_web",
  COMUNICADO: "comunicado",
  PODCAST: "podcast",
  DESCONOCIDO: "desconocido"
});


/*
-----------------------------------------------------------
POLITICA DE ALMACENAMIENTO

No todo lo que se puede leer se puede guardar. Un titular y un
enlace son cita; el articulo entero puede no serlo segun la
licencia del medio.

`SOLO_REFERENCIA` es el valor por defecto DELIBERADAMENTE: si
nadie ha comprobado que se puede guardar el texto, no se
guarda. El mismo criterio que `usoComercialPermitido: null` en
el Source Universe.
-----------------------------------------------------------
*/

export const POLITICAS_ALMACENAMIENTO = Object.freeze({
  /* Solo URL, titulo y metadatos. El caso por defecto. */
  SOLO_REFERENCIA: "solo_referencia",

  /* Extracto corto, tal como lo publica el propio feed. */
  EXTRACTO: "extracto",

  /* Texto completo. Exige licencia que lo permita. */
  TEXTO_COMPLETO: "texto_completo"
});


/*
-----------------------------------------------------------
HUELLA

sha256 sobre URL canonica + titulo normalizado. No incluye la
fecha de observacion: la misma nota vista hoy y mañana tiene
que dar la misma huella, o la deduplicacion no funciona entre
ejecuciones.
-----------------------------------------------------------
*/

function normalizarTitulo(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


export function huellaDeEvidencia({ canonicalUrl, url, title }) {
  const base = `${canonicalUrl || url || ""}|${normalizarTitulo(title)}`;

  return createHash("sha256").update(base).digest("hex").slice(0, 24);
}


/*
-----------------------------------------------------------
URL CANONICA

Tres niveles, de mas a menos fiable:

  1. la que declara el propio documento (<link rel=canonical>,
     `guid` de un feed, `og:url`)
  2. la URL normalizada, sin parametros de rastreo
  3. nada

Google News es el caso que obliga a distinguirlos: su enlace
apunta a `news.google.com` y no al medio. Tratarlo como
canonico haria que TODAS las notas de Google News parecieran
del mismo sitio, que es exactamente el fallo que ya se midio
una vez.
-----------------------------------------------------------
*/

const AGREGADORES = ["news.google.com", "news.yahoo.com", "flipboard.com"];


export function resolverCanonical({ url, canonicalDeclarada }) {
  if (canonicalDeclarada) {
    const n = normalizarUrl(canonicalDeclarada);

    if (n) return { canonicalUrl: n, origen: "declarada_por_el_documento" };
  }

  const n = normalizarUrl(url);

  if (!n) return { canonicalUrl: null, origen: "no_resoluble" };

  const dominio = extraerDominio(url);

  if (AGREGADORES.some((a) => dominio === a || dominio?.endsWith(`.${a}`))) {
    return {
      canonicalUrl: n,

      origen: "url_de_agregador",

      aviso:
        "La URL es de un agregador, no del medio. No identifica al publicador: eso lo resuelve el registro de medios."
    };
  }

  return { canonicalUrl: n, origen: "url_normalizada" };
}


/*
===========================================================
NORMALIZAR
===========================================================

`bruto` es lo que devolvio el proveedor. `contexto` es lo que
sabe quien lo llamo: que proveedor, que consulta, que tipo de
consulta.

Todo campo que no se pueda afirmar sale `null`. Ninguno se
rellena con un valor por defecto plausible.
===========================================================
*/

export function normalizarEvidencia(bruto = {}, contexto = {}) {
  const url = bruto.url || bruto.enlace || bruto.link || null;

  const { canonicalUrl, origen: origenCanonical, aviso } = resolverCanonical({
    url,
    canonicalDeclarada: bruto.canonicalUrl || bruto.guid || null
  });

  const title = limpiarHtml(bruto.title || bruto.titulo || "");

  const snippet = limpiarHtml(
    bruto.snippet || bruto.descripcion || bruto.description || bruto.resumen || ""
  );

  const publishedAt = bruto.publishedAt || bruto.fecha || bruto.pubDate || null;

  const evidencia = {
    evidenceId: null,

    /* --- procedencia --- */
    sourceId: bruto.sourceId || extraerDominio(canonicalUrl || url) || null,
    providerId: contexto.providerId || null,
    platform: bruto.platform || null,

    /*
      Publicador: quien PUBLICA, que no siempre es el dueño del
      dominio. Se acepta lo que declare el proveedor y se marca
      como declarado; resolverlo es tarea del registro de
      medios, no de aqui.
    */
    publisher: bruto.publisher || bruto.fuenteDeclarada || null,
    publisherDeclaradoPor: bruto.publisher || bruto.fuenteDeclarada
      ? contexto.providerId || "proveedor"
      : null,

    author: bruto.author || null,

    /* --- localizacion del documento --- */
    url,
    canonicalUrl,
    origenCanonical,

    /* --- contenido --- */
    title,
    snippet: snippet || null,

    publishedAt,
    observedAt: contexto.observedAt || null,

    language: bruto.language || contexto.language || null,

    contentType: bruto.contentType || contexto.contentType || TIPOS_CONTENIDO.DESCONOCIDO,

    /*
      PISTAS, no ubicacion. GEO-1 decide despues hasta donde
      llega el dato; esto es solo lo que el proveedor dijo.
    */
    territoryHints: Array.isArray(bruto.territoryHints) ? bruto.territoryHints : [],

    entities: Array.isArray(bruto.entities) ? bruto.entities : [],

    /* --- auditoria --- */
    hash: null,

    politicaAlmacenamiento:
      contexto.politicaAlmacenamiento || POLITICAS_ALMACENAMIENTO.SOLO_REFERENCIA,

    provenance: {
      providerId: contexto.providerId || null,
      query: contexto.query || null,
      queryType: contexto.queryType || null,
      queryLabel: contexto.queryLabel || null,
      observedAt: contexto.observedAt || null,
      avisoCanonical: aviso || null
    },

    /*
      Referencia al bruto. No se guarda el objeto entero por
      defecto —puede ser grande y traer campos que no se pueden
      almacenar— pero si las claves que trajo, que es lo que
      hace falta para auditar de donde salio cada campo.
    */
    rawMetadataReference: {
      providerId: contexto.providerId || null,
      claves: Object.keys(bruto),
      conservado: contexto.conservarBruto === true ? bruto : null
    }
  };

  evidencia.hash = huellaDeEvidencia(evidencia);

  evidencia.evidenceId = `ev-${evidencia.hash}`;

  return evidencia;
}


/*
-----------------------------------------------------------
VALIDAR

Una evidencia sin titulo NI enlace no es evidencia de nada. Se
rechaza y se dice por que, en lugar de entrar al corpus como
una fila vacia que despues cuenta en las metricas.
-----------------------------------------------------------
*/

export function evidenciaValida(ev) {
  const motivos = [];

  if (!ev?.title && !ev?.snippet) motivos.push("sin título ni extracto");

  if (!ev?.url && !ev?.canonicalUrl) motivos.push("sin enlace");

  return { valida: motivos.length === 0, motivos };
}


export default {
  TIPOS_CONTENIDO,
  POLITICAS_ALMACENAMIENTO,
  normalizarEvidencia,
  evidenciaValida,
  resolverCanonical,
  huellaDeEvidencia
};
