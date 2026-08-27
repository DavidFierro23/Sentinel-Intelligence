// apps/backend/routes/media.js

import express from "express";

import { analizarPieza, auditarAfirmaciones } from "../services/media/analyzePiece.js";

import { historialDePieza } from "../services/media/pieceStore.js";

import { planDeMetricas } from "../services/media/pieceMetrics.js";

import { construirConsultas } from "../services/media/pieceAmplification.js";

import { resolverPieza } from "../services/media/pieceResolver.js";

import { CONTRATO_ANALISIS_PIEZA } from "../services/media/pieceContracts.js";

const router = express.Router();

/*
===========================================================
MEDIA INTELLIGENCE — RUTAS DE PIEZA (MEDIA-PIECE-01)
===========================================================

Cuatro endpoints y ninguno mas. Este gate analiza UNA pieza;
no es el modulo completo de Media Intelligence.

    GET  /contrato          que devuelve el analisis
    POST /pieza/plan        plan de peticiones, sin ejecutar
    POST /pieza/analizar    el analisis
    GET  /pieza/historial   snapshots guardados de una URL

POR QUE /pieza/plan EXISTE
-----------------------------------------------------------

§17 exige mostrar los requests planeados ANTES de ejecutarlos.
Un endpoint separado permite hacerlo sin gastar cuota y sin
depender de que el cliente recuerde pasar `dryRun`.
===========================================================
*/


router.get("/contrato", (req, res) => {
  res.json({
    modulo: "media_intelligence",
    gate: "MEDIA-PIECE-01",
    contrato: CONTRATO_ANALISIS_PIEZA
  });
});


/*
-----------------------------------------------------------
PLAN — no ejecuta nada
-----------------------------------------------------------
*/
router.post("/pieza/plan", (req, res) => {
  const { url, candidateId = null, projectId = null, nombreCandidato = null } =
    req.body || {};

  if (!url) {
    return res.status(400).json({
      ok: false,
      motivo: "Falta el campo obligatorio 'url'."
    });
  }

  const r = resolverPieza({ url });

  if (!r.ok) {
    return res.status(422).json({ ok: false, motivo: r.motivo });
  }

  const metricas = planDeMetricas(r.pieza);

  const consultas = construirConsultas(r.pieza, { nombreCandidato });

  res.json({
    ok: true,

    pieza: {
      pieceId: r.pieza.pieceId,
      canonicalUrl: r.pieza.canonicalUrl,
      plataforma: r.pieza.plataforma,
      publicationId: r.pieza.publicationId,
      dominio: r.pieza.dominio
    },

    emisor: r.emisor,

    requestsPlaneados: {
      metricas: metricas.requests,
      consultasWeb: consultas.consultas.map((c) => ({
        id: c.id,
        texto: c.texto,
        busca: c.busca
      })),
      consultasDescartadas: consultas.descartadas
    },

    cuotaEstimada: {
      youtube: metricas.requests.reduce((a, x) => a + (x.costeUnidades || 0), 0),
      consultasWeb: consultas.consultas.length
    },

    disponibilidadDeclarada: metricas.metricas.map((m) => ({
      id: m.id,
      availability: m.availability,
      motivo: m.motivo
    })),

    entrada: { url, candidateId, projectId },

    nota:
      "Ninguna peticion se ha ejecutado. Este endpoint solo declara lo que se pediria."
  });
});


/*
-----------------------------------------------------------
ANALIZAR
-----------------------------------------------------------
*/
router.post("/pieza/analizar", async (req, res) => {
  const {
    url,
    candidateId = null,
    projectId = null,
    ambitoId = null,
    dryRun = false,
    titulo = null,
    autor = null,
    publishedAt = null,
    snippet = null
  } = req.body || {};

  if (!url) {
    return res.status(400).json({
      ok: false,
      motivo: "Falta el campo obligatorio 'url'."
    });
  }

  try {
    const analisis = await analizarPieza({
      url,
      candidateId,
      projectId,
      ambitoId,
      dryRun: dryRun === true,
      titulo,
      autor,
      publishedAt,
      snippet
    });

    if (!analisis.ok) {
      return res.status(422).json(analisis);
    }

    /*
      La auditoria de higiene viaja en la respuesta: si algun dia
      se cuela un campo prohibido, se vera en el propio JSON y no
      solo en el test.
    */
    analisis.auditoriaAfirmaciones = auditarAfirmaciones(analisis);

    res.json(analisis);
  } catch (error) {
    res.status(500).json({
      ok: false,
      motivo: `El analisis fallo: ${error?.message || "error desconocido"}.`,
      stack: process.env.NODE_ENV === "production" ? undefined : error?.stack
    });
  }
});


/*
-----------------------------------------------------------
HISTORIAL
-----------------------------------------------------------
*/
router.get("/pieza/historial", async (req, res) => {
  const { url, pieceId = null, projectId = null } = req.query || {};

  if (!url) {
    return res.status(400).json({
      ok: false,
      motivo: "Falta el parametro obligatorio 'url'."
    });
  }

  try {
    const h = await historialDePieza(String(url), {
      pieceId,
      proyectoId: projectId
    });

    res.json({ ok: true, url, ...h });
  } catch (error) {
    res.status(500).json({
      ok: false,
      motivo: `No se pudo leer el historial: ${error?.message || "error desconocido"}.`
    });
  }
});


export default router;
