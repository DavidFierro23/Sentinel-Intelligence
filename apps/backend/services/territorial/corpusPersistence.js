// apps/backend/services/territorial/corpusPersistence.js

/*
===========================================================
PERSISTENCIA DEL CORPUS OBSERVABLE
TERRITORIAL-CORPUS-PERSISTENCE-01
===========================================================

Base: TERRITORIAL-COLLECTOR-EXPANSION-01, commit bc2daae.

QUE HACE ESTE MODULO Y QUE NO
-----------------------------------------------------------

NO es un store nuevo. El store canonico sigue siendo el mismo:

    CANONICAL_STORE   territorial/evidenceLedger.js
                      JSONL append-only en
                      data/territorial-evidence/AAAA/MM/DD.jsonl
    DEDUP_KEY         evidenceId
    PROJECT_SCOPE     projectId + tenantId
    TEMPORAL_FIELDS   publishedAt, firstObservedAt,
                      lastObservedAt, retrievedAt
    PROVENANCE_FIELDS providers[], providerId, provenance{},
                      feedUrl, sourceId, domain, publisher

Esto es una envoltura fina sobre `registrarPasada` que hace tres
cosas que el escritor canonico no tiene por que saber:

    1. rechaza lo que no se puede persistir sin mentir
    2. cuenta insertado / deduplicado / descartado
    3. deriva la elegibilidad temporal sin inventar un campo

LA REGLA QUE ORGANIZA EL MODULO
-----------------------------------------------------------

    publishedAt   cuando se publico el contenido
    observedAt    cuando Sentinel lo vio

No son intercambiables y no se sustituyen. Medido en el gate
anterior: 32 de 60 resultados de busqueda no traen fecha de
publicacion. La tentacion es rellenarlos con el instante de la
peticion, porque asi «todo tiene fecha» y las ventanas cuadran.

Eso convierte incertidumbre en precision falsa, y despues es
indetectable: nadie puede distinguir «publicado hoy» de
«observado hoy» mirando el dato.

Asi que se queda en null y la pieza vive con esa limitacion. Una
evidencia sin fecha sigue siendo evidencia util —descubrimiento,
actores, universo de fuentes, corroboracion— pero **no puede
entrar en una ventana temporal**.

POR QUE NO HAY CAMPO NUEVO
-----------------------------------------------------------

`TEMPORAL_ELIGIBLE` se deriva: `publishedAt != null`. Anadir un
booleano seria una segunda fuente de verdad que puede
desincronizarse del dato que describe. La elegibilidad se
calcula, no se almacena.

Y no hace falta filtrar en la lectura porque el invariante ya
existe aguas abajo: `dentroDe(instante, ventana)` devuelve
`false` cuando el instante es nulo. Una pieza sin fecha no entra
en ninguna ventana por contrato, no por disciplina de quien
consulta.
===========================================================
*/

import { registrarPasada } from "./evidenceLedger.js";


export const CONTRATO_DE_ALMACEN = Object.freeze({
  CANONICAL_STORE: "territorial/evidenceLedger.js · JSONL append-only en data/territorial-evidence/AAAA/MM/DD.jsonl",
  DEDUP_KEY: "evidenceId",
  PROJECT_SCOPE: "projectId + tenantId",
  TEMPORAL_FIELDS: ["publishedAt", "firstObservedAt", "lastObservedAt", "retrievedAt"],
  PROVENANCE_FIELDS: ["providers", "providerId", "provenance", "feedUrl", "sourceId", "domain", "publisher"],
  nota: "No se crea ningún store paralelo. Ningún archivo temporal es fuente de verdad."
});


/*
  Motivos de descarte. Se enumeran para que «descartada» nunca
  sea una caja negra: cada pieza que no entra dice por que.
*/
export const MOTIVOS_DE_DESCARTE = Object.freeze({
  SIN_IDENTIDAD: "SIN_IDENTIDAD",
  SIN_CONTENIDO: "SIN_CONTENIDO"
});


/*
===========================================================
ELEGIBILIDAD TEMPORAL
===========================================================

Derivada, nunca almacenada.
===========================================================
*/

export function esTemporalmenteElegible(evidencia = {}) {
  const p = evidencia.publishedAt;

  if (!p) return false;

  /* Una fecha ilegible no es una fecha. */
  return !Number.isNaN(new Date(p).getTime());
}


export function elegibilidadTemporal(evidencias = []) {
  const elegibles = evidencias.filter(esTemporalmenteElegible);

  const noElegibles = evidencias.filter((e) => !esTemporalmenteElegible(e));

  return {
    total: evidencias.length,
    elegibles: elegibles.length,
    noElegibles: noElegibles.length,

    /*
      Por que no son elegibles. Distinguir «la fuente no declaro
      fecha» de «la fecha no se pudo leer» importa: la primera es
      un limite del proveedor, la segunda un fallo nuestro.
    */
    motivos: {
      sinFechaDeclarada: noElegibles.filter((e) => !e.publishedAt).length,
      fechaIlegible: noElegibles.filter(
        (e) => e.publishedAt && Number.isNaN(new Date(e.publishedAt).getTime())
      ).length
    },

    declaraciones: [
      "publishedAt es la fecha de publicación del contenido. observedAt es cuándo lo vio Sentinel. No se sustituyen.",
      "Una pieza sin publishedAt NO entra en HOY, 7D, 15D, 30D, 90D ni en ninguna comparación histórica.",
      "Sí sigue disponible como evidencia, para descubrimiento, para el universo de fuentes y para resolución de actores.",
      "La elegibilidad se deriva de publishedAt: no hay campo booleano que pueda desincronizarse."
    ]
  };
}


/*
  Lo que NO se hace nunca. Existe como funcion para poder
  probarlo: si alguien anade un fallback, esta lista lo delata.
*/
export const SUSTITUTOS_PROHIBIDOS = Object.freeze([
  "observedAt",
  "retrievedAt",
  "firstObservedAt",
  "lastObservedAt",
  "fecha de la peticion",
  "fecha del benchmark",
  "fecha actual"
]);


export function normalizarFechaDePublicacion(evidencia = {}) {
  /*
    Se leen SOLO campos que representan fecha editorial. Ningun
    timestamp tecnico de indexacion u observacion entra aqui.
  */
  const candidata = evidencia.publishedAt || evidencia.fecha || null;

  if (!candidata) return null;

  const t = new Date(candidata).getTime();

  return Number.isNaN(t) ? null : new Date(t).toISOString();
}


/*
===========================================================
PERSISTIR
===========================================================

Envoltura fina sobre `registrarPasada`. El conteo de
insertado/deduplicado sale del propio escritor canonico
—`esNuevaParaSentinel`— y no de una heuristica paralela.
===========================================================
*/

export async function persistirCorpus({
  ledger = null,
  evidencias = [],
  estadoPrevio = new Map(),
  retrievedAt = null,
  territoryId = null,
  projectId = null,
  tenantId = null,
  runId = null
} = {}) {
  if (!retrievedAt) {
    throw new Error(
      "persistirCorpus exige `retrievedAt`: sin instante de observación no se puede distinguir una pieza nueva de una repetida."
    );
  }

  if (!projectId) {
    throw new Error(
      "persistirCorpus exige `projectId`. Una evidencia sin proyecto se convierte en corpus territorial global por accidente, y eso rompe el aislamiento."
    );
  }

  const descartadas = [];

  const aceptadas = [];

  evidencias.forEach((ev) => {
    /*
      Sin identidad estable no se puede deduplicar, y sin
      deduplicacion la siguiente pasada infla el corpus.
    */
    if (!ev?.evidenceId && !ev?.canonicalUrl) {
      descartadas.push({ motivo: MOTIVOS_DE_DESCARTE.SIN_IDENTIDAD, titulo: ev?.title || null });
      return;
    }

    const texto = `${ev.title || ""}${ev.summary || ev.snippet || ""}`.trim();

    if (!texto) {
      descartadas.push({
        motivo: MOTIVOS_DE_DESCARTE.SIN_CONTENIDO,
        evidenceId: ev.evidenceId || null
      });
      return;
    }

    aceptadas.push({
      ...ev,

      evidenceId: ev.evidenceId || ev.canonicalUrl,

      /*
        Aqui se aplica la regla. `normalizarFechaDePublicacion`
        no mira ningun campo de observacion, asi que una pieza
        sin fecha editorial sale con null y se queda con null.
      */
      publishedAt: normalizarFechaDePublicacion(ev)
    });
  });

  const r = await registrarPasada({
    ledger,
    evidencias: aceptadas,
    estadoPrevio,
    retrievedAt,
    territoryId,
    runId,
    projectId,
    tenantId
  });

  /*
    Las cifras salen de `metricas` del escritor canonico, que es
    quien decide que es nuevo comparando contra `estadoPrevio`.

    Aqui hubo un error propio: se leian `r.nuevas` y `r.revistas`,
    que no existen. La primera pasada real reporto INSERTED 0 con
    40 piezas ya escritas en el libro, y solo se detecto porque
    `TOTAL_CORPUS_AFTER` subio de 421 a 461. Contar por una via
    distinta de la que escribe es como se producen esos huecos.
  */
  const insertadas = r.metricas?.nuevasParaSentinel ?? 0;

  const revistas = r.metricas?.yaConocidas ?? 0;

  const nuevas = (r.evidencias || []).filter((e) => e.esNuevaParaSentinel);

  return {
    ...r,

    informe: {
      INPUT_REAL: evidencias.length,
      ACEPTADAS: aceptadas.length,
      INSERTED: insertadas,
      DEDUPLICATED: revistas,
      SKIPPED: descartadas.length,
      TOTAL_AFTER: r.metricas?.corpusAcumulado ?? estadoPrevio.size + insertadas,

      idsInsertados: nuevas.map((e) => e.evidenceId),

      motivosDeDescarte: descartadas,

      temporal: elegibilidadTemporal(aceptadas),

      /*
        Comprobacion en el punto de escritura: ninguna pieza
        aceptada puede llevar un instante de observacion en su
        campo de publicacion. Si esto salta, hay un fallback
        silencioso en algun adapter.
      */
      sinSustitucionDeFecha: aceptadas.every(
        (e) =>
          !e.publishedAt ||
          (e.publishedAt !== retrievedAt &&
            e.publishedAt !== e.observedAt &&
            e.publishedAt !== e.firstObservedAt)
      ),

      declaraciones: [
        "La deduplicación es por evidenceId contra el estado previo del propio libro. Repetir la pasada no inserta nada nuevo.",
        "Las piezas sin fecha de publicación se guardan con publishedAt null y no entran en ventanas temporales.",
        "Ninguna pieza se descarta en silencio: cada descarte declara su motivo."
      ]
    }
  };
}


export default {
  CONTRATO_DE_ALMACEN,
  MOTIVOS_DE_DESCARTE,
  SUSTITUTOS_PROHIBIDOS,
  esTemporalmenteElegible,
  elegibilidadTemporal,
  normalizarFechaDePublicacion,
  persistirCorpus
};
