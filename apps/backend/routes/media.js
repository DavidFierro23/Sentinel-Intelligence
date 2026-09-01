// apps/backend/routes/media.js

import express from "express";

import { analizarPieza, auditarAfirmaciones } from "../services/media/analyzePiece.js";

import { historialDePieza } from "../services/media/pieceStore.js";

import { planDeMetricas } from "../services/media/pieceMetrics.js";

import { construirConsultas } from "../services/media/pieceAmplification.js";

import { resolverPieza } from "../services/media/pieceResolver.js";

import { CONTRATO_ANALISIS_PIEZA } from "../services/media/pieceContracts.js";

import { matrizCompleta, matrizDePieza } from "../services/media/pieceFieldMatrix.js";

import { fichaCompleta } from "../services/media/commercialProviderBenchmark.js";

import { homeDeProyecto } from "../services/media/mediaHome.js";

import {
  universoDeProyecto,
  declararYGuardar,
  editarYGuardar,
  verificarYGuardar,
  cambiarActividad
} from "../services/media/mediaUniverseStore.js";

import {
  TIPOS_SOURCE,
  SUBTIPOS_MEDIA,
  ESTADOS_SOURCE,
  CLASES_ACTIVO,
  ORIGENES_ENTIDAD,
  ESTADOS_COBERTURA,
  CANALES
} from "../services/media/mediaSourceUniverse.js";

import {
  CONTRATO_MEDIA_HOME,
  SECCIONES,
  DIMENSIONES,
  ESTADOS_DATO,
  EXPLICACION_ESTADOS,
  VENTANAS_HOME,
  TERMINOS_PROHIBIDOS,
  REGLA_CORRESPONDENCIA,
  preguntasRespondibles
} from "../services/media/mediaVocabulary.js";

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
MATRIZ POR CAMPO — MEDIA-PIECE-02 §E

Que se puede obtener de cada campo en cada plataforma, y por
que via. Es la respuesta honesta a «¿por que este panel esta
vacio?» y la UI puede enlazarla.
-----------------------------------------------------------
*/
router.get("/campos", (req, res) => {
  const { plataforma = null } = req.query || {};

  res.json({
    gate: "MEDIA-PIECE-02",
    matriz: plataforma ? [matrizDePieza(String(plataforma))] : matrizCompleta()
  });
});


/*
-----------------------------------------------------------
BENCHMARK DE PROVEEDORES — §F

Ficha, no compra. Ningun proveedor evaluado ni contratado.
-----------------------------------------------------------
*/
router.get("/proveedores/benchmark", (req, res) => {
  res.json(fichaCompleta());
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


/*
===========================================================
MEDIA-UX-HOME-01 — MODULO Y HOME DEL PROYECTO
===========================================================

Se anaden al MISMO router. No hay una segunda API de Media:
`/api/media` sigue siendo el unico prefijo, y «Analizar
publicacion» pasa a ser una de sus herramientas en lugar de
ser todo el modulo.

    GET /modulo            vocabulario, secciones y contrato
    GET /:proyectoId/home  la vista principal de un proyecto

POR QUE LA HOME ES project-scoped EN LA RUTA
-----------------------------------------------------------

Porque el aislamiento tiene que ser imposible de olvidar. Con
`?projectId=` opcional, una llamada sin el parametro devolveria
el corpus de todos los proyectos —incluidos los dos de prueba
que hay en el Lake real— y nadie lo notaria hasta verlo en una
presentacion. En la ruta, la peticion sin proyecto no existe.
===========================================================
*/

router.get("/modulo", (req, res) => {
  res.json({
    modulo: "media_intelligence",
    gate: "MEDIA-UX-HOME-01",

    /*
      La frase que este gate existe para poder afirmar.
    */
    declaracion:
      "Media Intelligence NO es «Analizar publicacion». Analizar una publicacion es una herramienta interna del modulo.",

    contrato: CONTRATO_MEDIA_HOME,
    secciones: SECCIONES,
    dimensiones: DIMENSIONES,
    ventanas: VENTANAS_HOME,

    estados: {
      valores: ESTADOS_DATO,
      explicacion: EXPLICACION_ESTADOS
    },

    terminosProhibidos: TERMINOS_PROHIBIDOS,
    reglaCorrespondencia: REGLA_CORRESPONDENCIA,

    sentinelAI: {
      implementado: false,
      preguntas: preguntasRespondibles()
    }
  });
});


router.get("/:proyectoId/home", async (req, res) => {
  const proyectoId = String(req.params.proyectoId || "").trim();

  if (!proyectoId) {
    return res.status(400).json({
      ok: false,
      motivo: "Falta el proyecto en la ruta."
    });
  }

  const ventana = req.query.ventana ? String(req.query.ventana) : undefined;

  try {
    const home = await homeDeProyecto({
      projectId: proyectoId,
      ventana,
      tenantId: req.query.tenantId ? String(req.query.tenantId) : undefined
    });

    if (!home.ok) return res.status(422).json(home);

    res.json(home);
  } catch (error) {
    res.status(500).json({
      ok: false,
      motivo: `La vista de Media Intelligence fallo: ${error?.message || "error desconocido"}.`,
      stack: process.env.NODE_ENV === "production" ? undefined : error?.stack
    });
  }
});


/*
===========================================================
MEDIA-SOURCE-UNIVERSE-01 — UNIVERSO DE MEDIOS DEL PROYECTO
===========================================================

Mismo router. `/api/media` sigue siendo el unico prefijo.

    GET   /universo/contrato          vocabulario y campos
    GET   /:proyectoId/universo       el universo del proyecto
    POST  /:proyectoId/universo       declarar un medio
    PATCH /:proyectoId/universo/:id   editar
    POST  /:proyectoId/universo/:id/verificar
    POST  /:proyectoId/universo/:id/actividad

Todas project-scoped en la RUTA, por el mismo motivo que la
HOME: con el proyecto en un query opcional, una llamada sin el
mezclaria los medios de dos campanas y nadie lo notaria.
===========================================================
*/

router.get("/universo/contrato", (req, res) => {
  res.json({
    gate: "MEDIA-SOURCE-UNIVERSE-01",

    declaracion:
      "Estar en el universo significa que Sentinel conoce esta fuente dentro del proyecto. No significa importante, popular ni influyente.",

    reglas: [
      "ENTIDAD != DOMINIO != ACTIVO: una entidad puede tener varios dominios y varias cuentas.",
      "N activos por plataforma: la clave es plataforma + handle normalizado.",
      "DECLARAR NO ES VERIFICAR: una entidad escrita por el analista no nace verificada.",
      "NO se deduplica por nombre: hace falta dominio comun o alias declarado.",
      "La infraestructura y los agregadores no entran en el universo."
    ],

    vocabulario: {
      tipos: TIPOS_SOURCE,
      subtiposMedia: SUBTIPOS_MEDIA,
      estados: ESTADOS_SOURCE,
      clasesDeActivo: CLASES_ACTIVO,
      origenes: ORIGENES_ENTIDAD,
      cobertura: ESTADOS_COBERTURA,
      canales: CANALES
    },

    /*
      Contrato del alta manual, para que la UI se construya
      contra el y no al reves.
    */
    altaManual: {
      obligatorio: ["canonicalName o website"],
      opcional: [
        "tipo",
        "subtipo",
        "website",
        "aliases[]",
        "scopeDeclarado",
        "feeds[]",
        "activosSociales[] con {plataforma, url, handle}"
      ],
      efecto:
        "origen = analista, estado = DESCUBIERTA, verificacion = NO verificada. Verificar es una accion aparte y explicita."
    }
  });
});


router.get("/:proyectoId/universo", async (req, res) => {
  try {
    const u = await universoDeProyecto({
      projectId: String(req.params.proyectoId || "").trim(),
      tenantId: req.query.tenantId ? String(req.query.tenantId) : undefined
    });

    if (!u.ok) return res.status(422).json(u);

    res.json(u);
  } catch (error) {
    res.status(500).json({
      ok: false,
      motivo: `El universo de medios fallo: ${error?.message || "error desconocido"}.`
    });
  }
});


router.post("/:proyectoId/universo", async (req, res) => {
  const projectId = String(req.params.proyectoId || "").trim();

  const b = req.body || {};

  if (!b.canonicalName && !b.nombre && !b.website) {
    return res.status(400).json({
      ok: false,
      motivo: "Hace falta al menos un nombre o un sitio web para identificar el medio."
    });
  }

  try {
    const r = await declararYGuardar({ ...b, projectId });

    res.status(r.ok ? 201 : 422).json(r);
  } catch (error) {
    res.status(500).json({
      ok: false,
      motivo: `No se pudo declarar el medio: ${error?.message || "error desconocido"}.`
    });
  }
});


router.patch("/:proyectoId/universo/:mediaEntityId", async (req, res) => {
  try {
    const r = await editarYGuardar({
      projectId: String(req.params.proyectoId || "").trim(),
      mediaEntityId: String(req.params.mediaEntityId || "").trim(),
      cambios: req.body?.cambios || req.body || {},
      por: req.body?.por || null
    });

    res.status(r.ok ? 200 : 422).json(r);
  } catch (error) {
    res.status(500).json({ ok: false, motivo: error?.message || "error desconocido" });
  }
});


router.post("/:proyectoId/universo/:mediaEntityId/verificar", async (req, res) => {
  try {
    const r = await verificarYGuardar({
      projectId: String(req.params.proyectoId || "").trim(),
      mediaEntityId: String(req.params.mediaEntityId || "").trim(),
      por: req.body?.por || null,
      motivo: req.body?.motivo || null
    });

    res.status(r.ok ? 200 : 422).json(r);
  } catch (error) {
    res.status(500).json({ ok: false, motivo: error?.message || "error desconocido" });
  }
});


router.post("/:proyectoId/universo/:mediaEntityId/actividad", async (req, res) => {
  if (typeof req.body?.activa !== "boolean") {
    return res.status(400).json({
      ok: false,
      motivo: "Falta `activa` (true o false)."
    });
  }

  try {
    const r = await cambiarActividad({
      projectId: String(req.params.proyectoId || "").trim(),
      mediaEntityId: String(req.params.mediaEntityId || "").trim(),
      activa: req.body.activa,
      por: req.body?.por || null,
      motivo: req.body?.motivo || null
    });

    res.status(r.ok ? 200 : 422).json(r);
  } catch (error) {
    res.status(500).json({ ok: false, motivo: error?.message || "error desconocido" });
  }
});


export default router;
