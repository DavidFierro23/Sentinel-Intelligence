// apps/backend/services/ingest/ingestOrchestrator.js

import { deduplicarMultifuente } from "./crossProviderDedup.js";
import { evidenciaValida } from "./evidenceContract.js";
import { registrarFuente, ORIGENES_SOURCE, TIPOS_SOURCE } from "../conversation/sourceUniverse.js";
import { registrarMedio, TIPOS_MEDIO } from "./mediaSourceRegistry.js";
import { extraerDominio } from "../textUtils.js";

/*
===========================================================
INGEST ORCHESTRATOR — INGEST-REAL-01
===========================================================

Un solo punto donde entra todo lo que recogen los adapters.

    adapters  →  normalizacion  →  dedup  →  registros  →  run

POR QUE UN ORQUESTADOR Y NO SEIS RUTAS
-----------------------------------------------------------

Con un proveedor productivo, «recolectar» y «normalizar» eran
lo mismo y vivian en el recolector. Con seis, cada uno tendria
que acordarse de deduplicar contra los otros cinco, de dar de
alta las fuentes nuevas y de anotar el resultado en el run.

Seis copias de esa logica divergen. Y la primera que divergiria
es la deduplicacion, que es justo la que no puede fallar: sin
ella, cada proveedor añadido INFLA el corpus sin aportar nada y
todas las metricas se mueven por razones ajenas al territorio.

LO QUE ESTE MODULO NO HACE
-----------------------------------------------------------

No ejecuta consultas. Recibe lo que los adapters ya trajeron.
Asi se puede probar entero sin red, que es lo que permite que
las 30+ comprobaciones de esta fase no gasten un centimo.

No decide temas, no geolocaliza y no clasifica territorio.
GEO-1 y los motores de analisis siguen donde estaban.

DESCUBRIR NO ES VERIFICAR
-----------------------------------------------------------

Una fuente nueva entra DESCUBIERTA. La repeticion la sube a
OBSERVADA y ahi se detiene. VERIFICADA exige un acto explicito
con autor y motivo, y este modulo no lo hace nunca.
===========================================================
*/


export const ESTADOS_RUN = Object.freeze({
  EN_CURSO: "EN_CURSO",
  COMPLETADO: "COMPLETADO",
  COMPLETADO_CON_ERRORES: "COMPLETADO_CON_ERRORES",
  FALLIDO: "FALLIDO"
});


export function iniciarRun({ runId, projectId = null, territoryId = null, startedAt = null }) {
  return {
    runId,
    projectId,
    territoryId,

    startedAt,
    finishedAt: null,

    estado: ESTADOS_RUN.EN_CURSO,

    providers: [],
    queries: [],

    /* Contadores. Se rellenan al cerrar. */
    evidenceCount: 0,
    uniqueEvidence: 0,
    duplicates: 0,
    sourcesObserved: 0,
    errors: 0,

    /* Coste: null se propaga y no se estima. */
    cost: null,
    quota: {}
  };
}


/*
-----------------------------------------------------------
ANOTAR LA EJECUCION DE UN PROVEEDOR

Se anota SIEMPRE, incluso —sobre todo— cuando no devolvio
nada. Un proveedor sin credencial que no aparece en el run se
lee como «no habia nada que encontrar», y no es eso: es «no se
le pregunto».
-----------------------------------------------------------
*/

export function anotarProveedor(run, resultado) {
  const fila = {
    providerId: resultado.providerId,
    estado: resultado.estado || "DESCONOCIDO",

    queries: resultado.queries ?? null,
    rawResults: resultado.recibidas ?? 0,

    latenciaMs: resultado.latenciaMs ?? null,

    error: resultado.motivo || resultado.error || null,

    unidadesConsumidas: resultado.unidadesConsumidas ?? null,

    /*
      null = no se sabe. Nunca 0 «porque no hemos pagado»:
      esa distincion la exige el benchmark.
    */
    costoConocido: typeof resultado.costo === "number" ? resultado.costo : null,

    permiteAfirmarAusencia: !["SIN_CREDENCIAL", "ERROR", "TIEMPO_AGOTADO", "CUOTA_AGOTADA", "BLOQUEADO", "INACCESIBLE", "LIMITE_DE_TASA", "RESPUESTA_NO_JSON"].includes(
      resultado.estado
    )
  };

  run.providers.push(fila);

  if (fila.error) run.errors += 1;

  if (resultado.unidadesConsumidas) {
    run.quota[resultado.providerId] =
      (run.quota[resultado.providerId] || 0) + resultado.unidadesConsumidas;
  }

  return fila;
}


/*
===========================================================
INGERIR

`lotes` es un array de { providerId, evidencias, ... } tal como
lo devuelven los adapters.
===========================================================
*/

export function ingerir({
  lotes = [],
  run = null,
  universo = null,
  registroMedios = null,
  observedAt = null
} = {}) {
  const todas = [];

  const rechazadas = [];

  lotes.forEach((lote) => {
    (lote.evidencias || []).forEach((ev) => {
      const v = evidenciaValida(ev);

      if (!v.valida) {
        rechazadas.push({
          providerId: lote.providerId,
          motivos: v.motivos,
          titulo: ev?.title || null
        });

        return;
      }

      todas.push({ ...ev, providerId: ev.providerId || lote.providerId });
    });

    if (run) {
      anotarProveedor(run, {
        providerId: lote.providerId,
        estado: lote.estado,
        recibidas: lote.recibidas ?? (lote.evidencias || []).length,
        latenciaMs: lote.latenciaMs,
        motivo: lote.motivo,
        unidadesConsumidas: lote.unidadesConsumidas,
        queries: lote.queries
      });
    }
  });

  const dedup = deduplicarMultifuente(todas);

  /*
    ---------------------------------------------------------
    DAR DE ALTA LAS FUENTES

    Se hace sobre las UNICAS, no sobre las brutas: si no, una
    nota traida por cinco proveedores contaria cinco
    observaciones de la misma fuente e inflaria su frecuencia.
    ---------------------------------------------------------
  */
  const nuevasFuentes = [];

  if (universo) {
    dedup.unicas.forEach((ev) => {
      const id = ev.sourceId || extraerDominio(ev.canonicalUrl || ev.url || "");

      if (!id) return;

      const yaExistia = universo.fuentes.has(id);

      /*
        Un canal de plataforma es un EMISOR: se registra con su
        propio sourceId (`youtube:UC...`), no con el dominio de
        la plataforma. Es la correccion del 40 % sin
        identificar.
      */
      const esCanal = /^[a-z]+:/i.test(id);

      registrarFuente(universo, {
        id,
        dominio: esCanal ? null : id,
        nombre: ev.publisher || ev.youtube?.channelTitle || id,
        url: ev.url || null,
        plataforma: ev.platform || null,

        tipo: esCanal ? TIPOS_SOURCE.CREATOR : undefined,

        displayName: ev.youtube?.channelTitle || null,

        origen: ORIGENES_SOURCE.EVIDENCIA,
        origenDescubrimiento: ev.providerId || null,
        provider: ev.providerId || null,

        instante: ev.publishedAt || observedAt || null,
        checkedAt: observedAt || null,

        idioma: ev.language || null
      });

      if (!yaExistia) {
        nuevasFuentes.push({
          sourceId: id,
          nombre: ev.publisher || id,
          descubiertaPor: ev.providerId || null,

          /*
            DESCUBIERTA. Nunca verificada por aparecer.
          */
          estado: "DESCUBIERTA"
        });
      }
    });
  }

  /*
    ---------------------------------------------------------
    REGISTRO DE MEDIOS

    Solo dominios web. Un canal de plataforma no es un medio
    con sitio y feeds: es un emisor de otra naturaleza y vive
    en el Source Universe, no aqui.
    ---------------------------------------------------------
  */
  if (registroMedios) {
    dedup.unicas.forEach((ev) => {
      const dominio = extraerDominio(ev.canonicalUrl || ev.url || "");

      if (!dominio || /^[a-z]+:/i.test(ev.sourceId || "")) return;

      registrarMedio(registroMedios, {
        dominio,
        nombre: ev.publisher || dominio,
        sitioWeb: `https://${dominio}`,
        tipoMedio: TIPOS_MEDIO.OTRO,
        origen: ORIGENES_SOURCE.EVIDENCIA,
        fuenteDescubrimiento: ev.providerId || null,
        instante: ev.publishedAt || observedAt || null
      });
    });
  }

  if (run) {
    run.evidenceCount = todas.length;
    run.uniqueEvidence = dedup.unicas.length;
    run.duplicates = dedup.metricas.duplicadosAbsorbidos;
    run.sourcesObserved = universo ? universo.fuentes.size : 0;
  }

  return {
    evidencias: dedup.unicas,

    dedup: dedup.metricas,
    trazaDedup: dedup.traza,

    nuevasFuentes,

    rechazadas,

    declaraciones: [
      ...dedup.declaraciones,

      "Las fuentes se dan de alta sobre las evidencias ÚNICAS. Contarlas sobre las brutas inflaría la frecuencia de un medio traído por varios proveedores.",

      "Toda fuente nueva entra DESCUBIERTA. Este módulo no verifica nada: verificar exige autor y motivo."
    ]
  };
}


export function cerrarRun(run, { finishedAt = null } = {}) {
  run.finishedAt = finishedAt;

  run.estado = run.errors > 0
    ? ESTADOS_RUN.COMPLETADO_CON_ERRORES
    : ESTADOS_RUN.COMPLETADO;

  /*
    El coste solo se afirma si TODOS los proveedores lo
    declararon. Si uno lo desconoce, el total es desconocido:
    sumar los conocidos e ignorar el resto daria un total falso
    con aspecto de exacto.
  */
  const costes = run.providers.map((p) => p.costoConocido);

  run.cost = costes.every((c) => typeof c === "number")
    ? Number(costes.reduce((s, c) => s + c, 0).toFixed(4))
    : null;

  run.motivoCosto =
    run.cost === null
      ? "Al menos un proveedor no declara coste. El total es desconocido: sumar solo los conocidos daría un total falso con aspecto de exacto."
      : null;

  return run;
}


export default {
  ESTADOS_RUN,
  iniciarRun,
  anotarProveedor,
  ingerir,
  cerrarRun
};
