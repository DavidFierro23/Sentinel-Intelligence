// apps/backend/routes/projects.js

import express from "express";

import { investigarObjetivo } from "../services/osintEngine.js";
import { absolutizarAvatares } from "../services/avatar/avatarIntelligenceEngine.js";

import {
  crearProyecto,
  obtenerProyecto,
  agregarCandidato,
  obtenerCandidato,
  registrarInvestigacion
} from "../services/projects/projectStore.js";

import {
  construirContextoMaestro,
  DIGNIDADES,
  TIPOS_ELECCION
} from "../services/projects/projectContext.js";

/*
===========================================================
RUTAS DE PROYECTO — ARQ-INV-002
===========================================================

Un solo motor. Estas rutas no descubren nada por su cuenta:
construyen el contexto del proyecto y llaman al MISMO
investigarObjetivo() que usa la investigación individual.

La diferencia entre los dos modos es el contexto que se le
pasa, no el código que trabaja.
===========================================================
*/

const router = express.Router();


router.get("/catalogo", (req, res) => {
  res.json({ dignidades: DIGNIDADES, tiposEleccion: TIPOS_ELECCION });
});


/*
-----------------------------------------------------------
CREAR PROYECTO
-----------------------------------------------------------
*/

router.post("/", async (req, res) => {
  try {
    const r = await crearProyecto(req.body || {});

    if (!r.creado) return res.status(400).json(r);

    res.json({
      ...r,
      contextoMaestro: construirContextoMaestro(r.proyecto)
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al crear el proyecto" });
  }
});


router.get("/:proyectoId", async (req, res) => {
  const p = await obtenerProyecto(req.params.proyectoId);

  if (!p) {
    return res
      .status(404)
      .json({ error: `no existe el proyecto ${req.params.proyectoId}` });
  }

  res.json({ proyecto: p, contextoMaestro: construirContextoMaestro(p) });
});


/*
-----------------------------------------------------------
AGREGAR CANDIDATO
-----------------------------------------------------------
*/

router.post("/:proyectoId/candidatos", async (req, res) => {
  try {
    const r = await agregarCandidato(req.params.proyectoId, req.body || {});

    if (!r.agregado) return res.status(400).json(r);

    res.json({
      ...r,
      contextoMaestro: construirContextoMaestro(r.proyecto, r.candidato)
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al agregar candidato" });
  }
});


/*
-----------------------------------------------------------
INVESTIGAR UN CANDIDATO DENTRO DEL PROYECTO

Mismo motor, contexto del proyecto.
-----------------------------------------------------------
*/

router.post("/:proyectoId/candidatos/:candidatoId/investigar", async (req, res) => {
  const { proyectoId, candidatoId } = req.params;

  try {
    const proyecto = await obtenerProyecto(proyectoId);

    if (!proyecto) {
      return res.status(404).json({ error: `no existe el proyecto ${proyectoId}` });
    }

    const candidato = await obtenerCandidato(proyectoId, candidatoId);

    if (!candidato) {
      return res.status(404).json({
        error: `el candidato ${candidatoId} no está en el proyecto ${proyectoId}`
      });
    }

    const contextoMaestro = construirContextoMaestro(proyecto, candidato);

    /*
      EL MISMO MOTOR. Lo unico que cambia es el contexto y la
      semilla que aporto el analista.
    */
    const resultado = await investigarObjetivo(candidato.nombre, {
      contextoMaestro,
      cuentasReferencia: candidato.cuentasReferencia || []
    });

    if (resultado?.error) return res.status(502).json(resultado);

    /* Expediente vivo: actualiza, nunca duplica. */
    const expediente = await registrarInvestigacion(
      proyectoId,
      candidatoId,
      resultado
    );

    res.json(
      absolutizarAvatares(
        {
          ...resultado,
          proyecto,
          candidato,
          expediente
        },
        req
      )
    );
  } catch (e) {
    console.error("[proyectos] investigación falló:", e);

    res.status(500).json({ error: e?.message || "fallo la investigación" });
  }
});


export default router;
