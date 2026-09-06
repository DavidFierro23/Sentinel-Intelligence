// apps/backend/services/intelligence/candidateReportGenerator.js

/*
===========================================================
GENERADOR DE INFORME REAL DE CANDIDATE INTELLIGENCE
CANDIDATE-REAL-CAMPAIGN-REPORT-01
===========================================================

Produce un MODELO DE INFORME estructurado, determinista y
reproducible a partir de datos YA PERSISTIDOS. Markdown y HTML
consumen el MISMO modelo -no hay texto manual irreproducible-.

REUTILIZA, NO REIMPLEMENTA:

    contenidoDeProyecto          -> universo real de candidatos
    matrizDePlataformasDelProyecto -> 5 plataformas, multi-asset,
                                       identidad, ya certificado
                                       (CANDIDATE-MULTI-ASSET-UX-
                                       RESOLUTION-02, T3)
    calcularIPDO/extraerInsumosCandidato -> IPDO_V1.1, ya aprobado
    amplificacionDeCandidato/separarConversacion -> conversacion cruda
    evidenciasDe/publicacionesDe  -> evidencia destacada

Cero red. Cero recoleccion. El informe describe el estado actual
de lo ya observado; no mejora ningun resultado saliendo a buscar
mas datos.
===========================================================
*/

import {
  contenidoDeProyecto,
  fichaIdentidad,
  snapshotsDe,
  publicacionesDe,
  evidenciasDe
} from "../projects/projectStore.js";

import { matrizDePlataformasDelProyecto } from "./candidatePlatformMatrix.js";
import { calcularIPDO, extraerInsumosCandidato, IPDO_METHOD_VERSION } from "./digitalPresenceIndex.js";
import { amplificacionDeCandidato, separarConversacion } from "./candidateAmplification.js";

export const REPORT_CONTRACT_VERSION = "CANDIDATE-REAL-CAMPAIGN-REPORT-01.v1";

export const DISCLAIMER_IPDO =
  "El IPDO mide presencia digital observable dentro del universo comparado y las fuentes cubiertas. No representa intención de voto, aprobación ni predicción electoral.";

export const NO_SIGNIFICA_GLOBAL = Object.freeze([
  "intención de voto",
  "aprobación",
  "probabilidad electoral",
  "población alcanzada",
  "personas únicas",
  "apoyo político",
  "sentimiento favorable o crítico",
  "predicción de resultado"
]);

/*
  Reconstruye la referencia de conflictos conocidos. Reutiliza el
  mismo registro ya certificado en gates anteriores
  (P-CAND-SOCIAL-BENCH-02) -no se inventa uno nuevo, y se declara
  la deuda de persistencia igual que hace la matriz de T3-.
*/
const CONFLICTOS_CONOCIDOS = new Set(["instagram:leomoralez.1425"]);

function bandaMinMax(valor, min, max) {
  if (valor == null) return null;
  return valor === Math.max(min, max) ? "MAX" : valor === Math.min(min, max) ? "MIN" : null;
}

function evidenciasDestacadas(evidencias = [], max = 6) {
  return (evidencias || [])
    .filter((e) => e.url || e.enlace)
    .slice(0, max)
    .map((e) => ({
      url: e.url || e.enlace,
      titulo: e.titulo || e.title || null,
      descripcion: (e.descripcion || "").slice(0, 220) || null,
      tipo: e.tipo || null,
      fecha: e.fecha || null
    }));
}

function publicacionesDestacadas(publicaciones = [], max = 4) {
  return [...publicaciones]
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, max)
    .map((p) => ({
      platform: p.platformId,
      url: p.canonicalUrl || p.url,
      publishedAt: p.publishedAt || null,
      observedAt: p.metricsObservedAt || null,
      provider: p.provider || null,
      textoOSnippet: (p.text || p.title || "").slice(0, 200) || null
    }));
}

/*
===========================================================
GENERAR EL INFORME COMPLETO
===========================================================
*/
export async function generateCandidateIntelligenceReport(projectId, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();

  const contenido = await contenidoDeProyecto(projectId);
  if (!contenido) {
    return {
      ok: false,
      projectId,
      generatedAt,
      motivo: `no existe el proyecto ${projectId}`
    };
  }

  const candidatos = contenido.candidatos || [];

  /* ---------- MATRIZ DE PLATAFORMAS (T3, ya certificada) ---------- */
  const matriz = await matrizDePlataformasDelProyecto({
    projectId,
    candidatos,
    conflictosConocidos: CONFLICTOS_CONOCIDOS
  });

  /* ---------- INSUMOS + IPDO (mio, ya aprobado) ---------- */
  const filasIpdo = [];
  const porCandidato = {};

  for (const cand of candidatos) {
    const ficha = await fichaIdentidad(projectId, cand.id, "candidato");
    if (!ficha) continue;

    const snapshots = (await snapshotsDe(projectId, cand.id)) || [];
    const pubsSerie = await publicacionesDe(projectId, cand.id);
    const evid = await evidenciasDe(projectId, cand.id);
    const cuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);

    const amplificacion = amplificacionDeCandidato({ evidencias: evid.evidencias, cuentas });
    const conversacion = separarConversacion({ evidencias: evid.evidencias, cuentas });

    const insumos = extraerInsumosCandidato({
      candidateId: cand.id,
      ficha,
      snapshots,
      publicaciones: pubsSerie.publicaciones,
      amplificacion,
      conversacion,
      conflictosConocidos: CONFLICTOS_CONOCIDOS
    });

    filasIpdo.push(insumos);

    porCandidato[cand.id] = {
      candidateId: cand.id,
      nombre: ficha.nombre || cand.nombre,
      aliases: ficha.aliases || [],
      evidenciasDestacadas: evidenciasDestacadas(evid.evidencias),
      publicacionesDestacadas: publicacionesDestacadas(pubsSerie.publicaciones),
      totalEvidencias: (evid.evidencias || []).length,
      totalPublicaciones: (pubsSerie.publicaciones || []).length,
      snapshotsTotal: snapshots.length,
      amplificacion,
      conversacion
    };
  }

  const ipdo = calcularIPDO(filasIpdo);

  /*
    ---------- RANKING EN RUNTIME ----------
    Nunca se hardcodea. Se ordena por `score` (null al final: sin
    insumos, no puede compararse, no es 0).
  */
  const ranking = ipdo.estado === "OK"
    ? [...ipdo.resultados].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map(decorarConCaveatDeCero)
    : [];

  const scoresValidos = ranking.map((r) => r.score).filter((s) => s != null);
  const maxScore = scoresValidos.length ? Math.max(...scoresValidos) : null;
  const minScore = scoresValidos.length ? Math.min(...scoresValidos) : null;

  /* ---------- HALLAZGOS COMPARATIVOS (solo si derivables) ---------- */
  const mayor = (campo) => {
    const validos = ranking.filter((r) => r.dimensions[campo] != null);
    if (!validos.length) return null;
    return validos.reduce((a, b) => (b.dimensions[campo] > a.dimensions[campo] ? b : a));
  };
  const mayorCobertura = (() => {
    const conCobertura = matriz.ok ? matriz.candidatos.map((c) => ({ candidateId: c.candidateId, medidas: c.cobertura.medidas })) : [];
    if (!conCobertura.length) return null;
    return conCobertura.reduce((a, b) => (b.medidas > a.medidas ? b : a));
  })();

  const hallazgosComparativos = {
    mayorIPDO: ranking[0] ? { candidateId: ranking[0].candidateId, score: ranking[0].score } : null,
    mayorPresence: mayor("presence") ? { candidateId: mayor("presence").candidateId, valor: mayor("presence").dimensions.presence } : null,
    mayorInteraction: mayor("interaction") ? { candidateId: mayor("interaction").candidateId, valor: mayor("interaction").dimensions.interaction } : null,
    mayorConversation: mayor("conversation") ? { candidateId: mayor("conversation").candidateId, valor: mayor("conversation").dimensions.conversation } : null,
    mayorCoberturaPlataformas: mayorCobertura,
    relacionesEntreCandidatos: "RELATIONAL_ANALYSIS_PENDING"
  };

  /* ---------- HISTORICO / MOMENTUM ---------- */
  const historico = {
    momentum: "INSUFFICIENT_HISTORY",
    nota: "Histórico insuficiente para Momentum estable. No se calcula tendencia ni score de cambio en esta versión.",
    variacionesObservadasPreliminares: [] // se completaría solo si existieran ≥2 snapshots comparables por activo; fuera de alcance de este gate reportarlo por candidato aquí
  };

  /* ---------- RESUMEN EJECUTIVO (5-8 hallazgos, generado de datos reales) ---------- */
  const resumenEjecutivo = construirResumenEjecutivo({ ranking, matriz, hallazgosComparativos, candidatosTotal: candidatos.length });

  return {
    ok: true,
    contractVersion: REPORT_CONTRACT_VERSION,
    projectId,
    proyecto: { nombre: contenido.proyecto?.nombre || null },
    generatedAt,
    dataCutoff: generatedAt,
    methodVersion: IPDO_METHOD_VERSION,
    periodo: {
      presence: "CURRENT_PROFILE_STOCK (último snapshot real por activo)",
      interaction: "OBSERVATION_WINDOW (acumulado de publicaciones observadas hasta la fecha)",
      conversation: "OBSERVATION_WINDOW (corpus de evidencias acumulado hasta la fecha)",
      nota: "followers/subscribers son estado actual (stock); publicaciones/menciones son ventana acumulada. No comparten la misma base temporal."
    },
    universo: {
      candidatosTotal: candidatos.length,
      candidatos: candidatos.map((c) => ({ candidateId: c.id, nombre: c.nombre }))
    },
    disclaimerIpdo: DISCLAIMER_IPDO,
    noSignifica: NO_SIGNIFICA_GLOBAL,
    resumenEjecutivo,
    ranking,
    ipdoEstado: ipdo.estado,
    matrizPlataformas: matriz,
    hallazgosComparativos,
    historico,
    candidatosDetalle: porCandidato,
    limitacionesGlobales: [
      ...(matriz.ok ? matriz.limitaciones : []),
      {
        id: "MOMENTUM_NO_DISPONIBLE",
        texto: "Histórico insuficiente para calcular Momentum estable. Se reportan solo señales actuales."
      }
    ],
    aislamiento: { projectId, candidatosDelProyecto: candidatos.length }
  };
}

/*
  Seccion 14 del gate: un score relativo de 0 NUNCA debe leerse
  como "no hay senal". Si la dimension normalizada es exactamente
  0 pero existen senales crudas reales (rawInputs), se adjunta una
  nota explicita que los renderizadores muestran junto al numero
  -no se modifica digitalPresenceIndex.js, que ya esta aprobado y
  probado; esto es una decoracion de presentacion, no de calculo-.
*/
function decorarConCaveatDeCero(r) {
  const f = r.rawInputs || {};
  const caveats = {};

  if (r.dimensions.conversation === 0) {
    const señales = [f.thirdPartyVolume, f.mediaDiversity, f.publicConversation].filter((v) => v != null && v > 0);
    if (señales.length) {
      caveats.conversation = `0/100 es un valor RELATIVO al grupo comparado, no ausencia de conversación: existen ${f.thirdPartyVolume ?? 0} hechos de terceros, ${f.mediaDiversity ?? 0} medios distintos y ${f.publicConversation ?? 0} piezas de conversación pública observadas realmente — son la cifra más baja de los candidatos comparados, no cero absoluto.`;
    }
  }
  if (r.dimensions.interaction === 0) {
    const señales = [f.postCount, f.totalEngagement, f.totalAttention].filter((v) => v != null && v > 0);
    if (señales.length) {
      caveats.interaction = `0/100 es un valor RELATIVO al grupo comparado, no ausencia de actividad: existen ${f.postCount ?? 0} publicaciones observadas realmente — es la cifra más baja del grupo, no cero absoluto.`;
    }
  }
  if (r.dimensions.presence === 0) {
    const tieneAudiencia = Object.values(f.audienciaPorPlataforma || {}).some((v) => v != null && v > 0);
    if (tieneAudiencia || f.accountCoverageCount > 0) {
      caveats.presence = "0/100 es un valor RELATIVO al grupo comparado, no ausencia de presencia digital.";
    }
  }

  return Object.keys(caveats).length ? { ...r, dimensionCaveats: caveats } : r;
}

function construirResumenEjecutivo({ ranking, matriz, hallazgosComparativos, candidatosTotal }) {
  const hallazgos = [];

  if (ranking.length) {
    const lider = ranking[0];
    hallazgos.push(
      `${lider.candidateId} presenta la mayor Presencia Digital Observable dentro del universo comparado (IPDO ${lider.score}/100, cobertura metodológica ${lider.methodologicalCoverage}).`
    );
  }

  if (hallazgosComparativos.mayorInteraction) {
    hallazgos.push(
      `${hallazgosComparativos.mayorInteraction.candidateId} registra mayor actividad de interacción observable dentro del grupo (${hallazgosComparativos.mayorInteraction.valor}/100 relativo).`
    );
  }

  if (hallazgosComparativos.mayorConversation) {
    hallazgos.push(
      `${hallazgosComparativos.mayorConversation.candidateId} muestra la mayor conversación/amplificación de terceros observada dentro del grupo (${hallazgosComparativos.mayorConversation.valor}/100 relativo).`
    );
  }

  if (matriz.ok) {
    hallazgos.push(
      `De ${candidatosTotal * matriz.plataformas.length} celdas candidato×plataforma, ${matriz.distribucion.MEDIDO || 0} tienen medición real completa; ninguna celda quedó sin estado explícito.`
    );
  }

  hallazgos.push(
    "Histórico insuficiente para Momentum estable: este informe reporta presencia, actividad e interacción observadas hoy, no tendencia."
  );

  if (ranking.some((r) => r.methodologicalCoverage === "BAJA")) {
    hallazgos.push("Al menos un candidato presenta cobertura metodológica BAJA: su score debe leerse con esa limitación explícita.");
  }

  return hallazgos.slice(0, 8);
}

export default { generateCandidateIntelligenceReport, REPORT_CONTRACT_VERSION, DISCLAIMER_IPDO };
