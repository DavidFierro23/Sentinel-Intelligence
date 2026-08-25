// apps/backend/routes/projects.js

import express from "express";

import { investigarObjetivo } from "../services/osintEngine.js";
import { absolutizarAvatares } from "../services/avatar/avatarIntelligenceEngine.js";

import {
  crearProyecto,
  obtenerProyecto,
  listarProyectos,
  contenidoDeProyecto,
  renombrarProyecto,
  cambiarEstadoProyecto,
  ESTADOS,
  agregarCandidato,
  obtenerCandidato,
  agregarActor,
  obtenerActor,
  activarComparativo,
  registrarInvestigacion
} from "../services/projects/projectStore.js";

import { correlacionObservable } from "../services/projects/actorCorrelation.js";

import {
  construirContextoMaestro,
  DIGNIDADES,
  TIPOS_ELECCION,
  NIVELES
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
  res.json({
    dignidades: DIGNIDADES,
    tiposEleccion: TIPOS_ELECCION,
    niveles: NIVELES
  });
});


/*
-----------------------------------------------------------
LISTAR PROYECTOS — lo que faltaba para que la recarga funcione
-----------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    /*
      Por defecto solo los activos. `?estado=archivado` o
      `?estado=eliminado` los pide explicitamente; un eliminado no
      puede aparecer por accidente.
    */
    const pedido = String(req.query.estado || "").trim();

    const estados = pedido
      ? pedido.split(",").filter((x) => Object.values(ESTADOS).includes(x))
      : [ESTADOS.ACTIVO];

    const proyectos = await listarProyectos({ estados });

    res.json({ total: proyectos.length, estados, proyectos });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al listar proyectos" });
  }
});


/*
-----------------------------------------------------------
CICLO DE VIDA
-----------------------------------------------------------
*/

router.post("/:proyectoId/renombrar", async (req, res) => {
  try {
    const r = await renombrarProyecto(req.params.proyectoId, req.body?.nombre);

    if (!r.renombrado) return res.status(400).json(r);

    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al renombrar" });
  }
});


router.post("/:proyectoId/estado", async (req, res) => {
  try {
    const r = await cambiarEstadoProyecto(
      req.params.proyectoId,
      String(req.body?.estado || "")
    );

    if (!r.actualizado) return res.status(400).json(r);

    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al cambiar el estado" });
  }
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


/*
  Devuelve el proyecto CON sus candidatos, actores y expedientes.

  Que el expediente venga aqui es lo que permite que una recarga
  muestre "investigacion completada" en lugar de volver a lanzar
  la investigacion: recargar recupera, no descubre, y no gasta
  cuota de SerpAPI.
*/
router.get("/:proyectoId", async (req, res) => {
  try {
    const c = await contenidoDeProyecto(req.params.proyectoId);

    if (!c) {
      return res
        .status(404)
        .json({ error: `no existe el proyecto ${req.params.proyectoId}` });
    }

    res.json({
      ...c,
      contextoMaestro: construirContextoMaestro(c.proyecto)
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al leer el proyecto" });
  }
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
      cuentasReferencia: candidato.cuentasReferencia || [],

      /* Amplian el descubrimiento; no deciden identidad. */
      aliases: candidato.aliases || [],

      /*
        HANDLES YA ATRIBUIDOS en investigaciones anteriores. Son
        la mejor semilla de propagacion disponible: ya pasaron el
        clasificador. Se leen del expediente, que es donde viven.

        Que un handle este atribuido en una plataforma no lo
        atribuye en otra: solo sirve para ir a mirar.
      */
      handlesAtribuidos: (candidato.expediente?.cuentas || []).map((c) => ({
        handle: c.handle,
        plataformaId: c.plataformaId,
        plataforma: c.plataforma,
        url: c.url
      }))
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


/*
-----------------------------------------------------------
ACTORES DE REFERENCIA — opcionales
-----------------------------------------------------------
*/

router.post("/:proyectoId/actores", async (req, res) => {
  try {
    const r = await agregarActor(req.params.proyectoId, req.body || {});

    if (!r.agregado) return res.status(400).json(r);

    res.json({
      ...r,
      contextoMaestro: construirContextoMaestro(r.proyecto, r.actor)
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al agregar actor" });
  }
});


router.post("/:proyectoId/actores/:actorId/comparativo", async (req, res) => {
  try {
    const r = await activarComparativo(
      req.params.proyectoId,
      req.params.actorId,
      req.body?.activar === true
    );

    if (!r.actualizado) return res.status(400).json(r);

    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al cambiar el estado" });
  }
});


/*
  Investigar un ACTOR. Expediente independiente y contexto segun
  SU nivel, no segun el territorio del proyecto.
*/
router.post("/:proyectoId/actores/:actorId/investigar", async (req, res) => {
  const { proyectoId, actorId } = req.params;

  try {
    const proyecto = await obtenerProyecto(proyectoId);

    if (!proyecto) {
      return res.status(404).json({ error: `no existe el proyecto ${proyectoId}` });
    }

    const actor = await obtenerActor(proyectoId, actorId);

    if (!actor) {
      return res.status(404).json({ error: `no existe el actor ${actorId}` });
    }

    const contextoMaestro = construirContextoMaestro(proyecto, actor);

    const resultado = await investigarObjetivo(actor.nombre, {
      contextoMaestro,
      cuentasReferencia: actor.cuentasReferencia || []
    });

    if (resultado?.error) return res.status(502).json(resultado);

    const expediente = await registrarInvestigacion(
      proyectoId,
      actorId,
      resultado,
      "actor"
    );

    res.json(
      absolutizarAvatares(
        {
          ...resultado,
          proyecto,
          actor,
          expediente,
          /*
            Aviso permanente: mientras el comparativo este
            desactivado, este expediente no toca a ningun
            candidato.
          */
          aislamiento: actor.incluirEnComparativo
            ? "Análisis comparativo ACTIVADO: se puede calcular correlación observable con los candidatos."
            : "Análisis comparativo desactivado: este actor no afecta a ningún candidato, ni a su cobertura, ni a su grafo."
        },
        req
      )
    );
  } catch (e) {
    console.error("[proyectos] investigación de actor falló:", e);

    res.status(500).json({ error: e?.message || "fallo la investigación" });
  }
});


/*
-----------------------------------------------------------
CORRELACIÓN OBSERVABLE — solo si el analista la activó
-----------------------------------------------------------
*/

router.post(
  "/:proyectoId/correlacion/:actorId/:candidatoId",
  async (req, res) => {
    const { proyectoId, actorId, candidatoId } = req.params;

    try {
      const actor = await obtenerActor(proyectoId, actorId);

      const candidato = await obtenerCandidato(proyectoId, candidatoId);

      if (!actor || !candidato) {
        return res
          .status(404)
          .json({ error: "actor o candidato inexistente en este proyecto" });
      }

      /*
        PUERTA. Sin activacion explicita del analista no se calcula
        nada: el actor no debe influir en el candidato mientras
        siga desactivado.
      */
      if (!actor.incluirEnComparativo) {
        return res.status(409).json({
          disponible: false,
          motivo:
            'El análisis comparativo de este actor está desactivado. Actívalo con "Incluir en análisis comparativo" para calcular la correlación observable.'
        });
      }

      res.json(
        correlacionObservable({
          actor,
          candidato,
          expedienteActor: req.body?.expedienteActor || null,
          expedienteCandidato: req.body?.expedienteCandidato || null
        })
      );
    } catch (e) {
      res.status(500).json({ error: e?.message || "fallo la correlación" });
    }
  }
);


export default router;
