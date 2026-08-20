// apps/backend/services/social/socialIntelligenceLayer.js

import { descubrirCandidatos } from "./discovery/discoveryEngine.js";
import { correlacionarCandidatos } from "./identity/identityMatcher.js";
import { generarFichas } from "./evidence/socialEvidenceEngine.js";

import { SENALES, SENALES_IMPLEMENTADAS } from "./socialContracts.js";

/*
===========================================================
SOCIAL INTELLIGENCE LAYER — orquestador
===========================================================

  PERFIL DE REFERENCIA
        ↓
  1 · DISCOVERY ENGINE        cuentas candidatas
        ↓
  2 · IDENTITY MATCHER        correspondencia explicada
        ↓
  3 · SOCIAL EVIDENCE ENGINE  ficha única + evidencias
        ↓
  salida al Fusion Engine / Knowledge Lake


ALCANCE DEL SPRINT 3.1:

Implementados: Discovery, Identity Matcher (S1, S2, S6, S7)
y Social Evidence Engine.

NO implementados: Platform Scanner (ninguna API de
plataforma), Activity Analyzer y Social Health Engine.

GARANTÍA: si cualquier submotor falla, devuelve null y la
investigación continúa. Igual que el Perfil de Referencia y
el Fusion Engine.
===========================================================
*/


export async function ejecutarSocialIntelligence(perfil, opciones = {}) {
  const inicio = Date.now();

  if (!perfil?.nombrePrincipal) {
    return null;
  }

  const etapas = [];

  /*
    ---------------------------------------------------------
    1 · DISCOVERY
    ---------------------------------------------------------
  */
  let descubrimiento = null;

  try {
    descubrimiento = await descubrirCandidatos(perfil, {
      evidenciasPrevias: opciones.evidenciasPrevias || [],
      omitirConsultas: opciones.omitirConsultas === true,
      sesion: opciones.sesion
    });

    etapas.push({
      etapa: "discovery_engine",
      estado: "ok",
      detalle: `${descubrimiento.metricas.candidatosUnicos} candidatos en ${descubrimiento.metricas.plataformasConCandidatos} plataformas`
    });
  } catch (error) {
    console.error("[SIL] discovery falló:", error);

    etapas.push({
      etapa: "discovery_engine",
      estado: "error",
      detalle: error?.message || "error desconocido"
    });

    return {
      version: "1.0",
      objetivo: perfil.nombrePrincipal,
      etapas,
      error: "El Discovery Engine falló; no hay candidatos que correlacionar.",
      generadoEn: new Date().toISOString()
    };
  }

  /*
    ---------------------------------------------------------
    2 · IDENTITY MATCHER
    ---------------------------------------------------------
  */
  let correlacion = null;

  try {
    correlacion = correlacionarCandidatos(descubrimiento.candidatos, perfil);

    etapas.push({
      etapa: "identity_matcher",
      estado: "ok",
      detalle: `${correlacion.metricas.evaluadas} evaluadas · ${correlacion.metricas.probables} probables · máx ${correlacion.metricas.puntuacionMaxima}/100`
    });
  } catch (error) {
    console.error("[SIL] identity matcher falló:", error);

    etapas.push({
      etapa: "identity_matcher",
      estado: "error",
      detalle: error?.message || "error desconocido"
    });
  }

  /*
    ---------------------------------------------------------
    3 · SOCIAL EVIDENCE ENGINE
    ---------------------------------------------------------
  */
  let evidencia = null;

  try {
    evidencia = generarFichas(
      descubrimiento.candidatos,
      correlacion?.correspondencias || [],
      {
        objetivo: perfil.nombrePrincipal,
        objetivoId: opciones.objetivoId || null,
        tenantId: opciones.tenantId || null
      }
    );

    etapas.push({
      etapa: "social_evidence_engine",
      estado: "ok",
      detalle: `${evidencia.metricas.fichas} fichas únicas (${evidencia.deduplicacion.fusionadas} fusionadas) · ${evidencia.metricas.evidencias} evidencias`
    });
  } catch (error) {
    console.error("[SIL] evidence engine falló:", error);

    etapas.push({
      etapa: "social_evidence_engine",
      estado: "error",
      detalle: error?.message || "error desconocido"
    });
  }

  /*
    ---------------------------------------------------------
    SALIDA
    ---------------------------------------------------------
  */
  return {
    version: "1.0",

    objetivo: perfil.nombrePrincipal,

    /* Fichas consolidadas: la salida principal. */
    fichas: evidencia?.fichas || [],

    evidencias: evidencia?.evidencias || [],

    cobertura: descubrimiento.cobertura,

    descubrimiento: {
      plan: descubrimiento.plan,
      anclas: descubrimiento.anclas,
      anclasUsadas: descubrimiento.anclasUsadas,
      adaptadores: descubrimiento.adaptadores,
      intentos: descubrimiento.intentos,
      trazas: descubrimiento.trazas,
      proveedores: descubrimiento.proveedores
    },

    deduplicacion: evidencia?.deduplicacion || null,

    metricas: {
      candidatos: descubrimiento.metricas.candidatosUnicos,
      fichasUnicas: evidencia?.metricas.fichas || 0,
      fusionadas: evidencia?.deduplicacion.fusionadas || 0,
      evidencias: evidencia?.metricas.evidencias || 0,
      probables: correlacion?.metricas.probables || 0,
      candidatas: correlacion?.metricas.candidatas || 0,
      conPresenciaCruzada: correlacion?.metricas.conPresenciaCruzada || 0,

      /* Sprint 3.2 — CB-1 */
      contextoCompatible: descubrimiento.metricas.contextoCompatible ?? 0,
      contextoIncompatible: descubrimiento.metricas.contextoIncompatible ?? 0,
      contextoNeutro: descubrimiento.metricas.contextoNeutro ?? 0,
      vetadasPorContexto: correlacion?.metricas.vetadasPorContexto || 0,
      consultasAncladas: descubrimiento.consultasAncladas ?? 0,
      consultasPorNombre: descubrimiento.consultasPorNombre ?? 0,
      puntuacionMaxima: correlacion?.metricas.puntuacionMaxima || 0,
      porCalidad: evidencia?.metricas.porCalidad || {},
      plataformasNoComprobadas:
        descubrimiento.metricas.plataformasNoComprobadas,
      violacionesDelTopeHumano:
        correlacion?.metricas.violacionesDelTopeHumano || 0,
      tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`
    },

    etapas,

    /*
      Estado declarado de las siete señales: qué se midió y
      qué no. Es lo que permite al panel explicar los huecos.
    */
    senales: {
      implementadas: SENALES_IMPLEMENTADAS,
      noImplementadas: SENALES.filter((s) => !s.implementada).map((s) => ({
        id: s.id,
        nombre: s.nombre,
        fuerza: s.fuerza,
        requiere: s.requiere
      })),
      catalogo: SENALES
    },

    advertencias: [
      ...(descubrimiento.advertencias || []),
      ...(correlacion
        ? []
        : ["El Identity Matcher no se ejecutó: las fichas no llevan correspondencia."])
    ],

    limites: {
      topeHumano:
        "El sistema no confirma identidades. Techo: «probable» / «Muy Alta Correspondencia». Confirmar o descartar es competencia del analista (IA2).",
      sinPlatformScanner:
        "Ninguna plataforma fue consultada por API. Toda presencia es inferida desde descubrimiento web.",
      senalesPendientes:
        "S3 (biografía), S4 (cargo) y S5 (país) requieren leer el perfil: Sprint 3.2."
    },

    generadoEn: new Date().toISOString()
  };
}


export { SENALES, SENALES_IMPLEMENTADAS };
