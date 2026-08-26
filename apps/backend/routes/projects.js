// apps/backend/routes/projects.js

import express from "express";

import { investigarObjetivo } from "../services/osintEngine.js";
import { absolutizarAvatares } from "../services/avatar/avatarIntelligenceEngine.js";

/* P-CAND-UX-04 y P-CAND-AI-01 */
import { resolverFotoDeCandidato } from "../services/intelligence/candidatePhotoResolver.js";

import {
  observarCuentasDelCandidato,
  snapshotsDeObservaciones,
  actividadDePublicaciones,
  temasDeLasCuentas,
  resumenDeCuentas
} from "../services/intelligence/accountIntelligence.js";

/* Candidate Intelligence V1 */
import { resolverCuentasDelCandidato } from "../services/intelligence/accountResolution.js";

import {
  ventanasDe,
  crearSnapshotDeIdentidad,
  compararInventarios,
  procedenciaTemporal
} from "../services/intelligence/candidateTimeline.js";

import {
  amplificacionDeCandidato,
  separarConversacion
} from "../services/intelligence/candidateAmplification.js";

import {
  relacionesDeEvidencias,
  CONTRATO_MEDIA_RELATION,
  vincularLote
} from "../services/intelligence/candidateRelations.js";

import { presenciaDigitalObservada } from "../services/intelligence/digitalPresence.js";

import { solidezDelExpediente } from "../services/intelligence/expedienteSolidez.js";

import {
  crearProyecto,
  obtenerProyecto,
  listarProyectos,
  contenidoDeProyecto,
  renombrarProyecto,
  cambiarEstadoProyecto,
  inventarioConsolidado,
  editarCandidato,
  fichaIdentidad,
  guardarSnapshots,
  snapshotsDe,
  guardarSnapshotDeIdentidad,
  snapshotsDeIdentidadDe,
  evidenciasDe,
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

/*
-----------------------------------------------------------
FICHA DE IDENTIDAD — P-CAND-UX-01
-----------------------------------------------------------

Solo LEE. Devuelve las siete plataformas, tambien las vacias, con
el estado de cada cuenta y su procedencia. No lanza ninguna
investigacion y no gasta cuota.
-----------------------------------------------------------
*/
router.get("/:proyectoId/candidatos/:candidatoId/identidad", async (req, res) => {
  try {
    const f = await fichaIdentidad(
      req.params.proyectoId,
      req.params.candidatoId,
      "candidato"
    );

    if (!f) {
      return res.status(404).json({
        error: `el candidato ${req.params.candidatoId} no está en el proyecto ${req.params.proyectoId}`
      });
    }

    res.json(absolutizarAvatares(f, req));
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al leer la identidad" });
  }
});


/*
  EDITAR IDENTIDAD. No borra ni recrea: recrear perderia el
  expediente y el inventario consolidado, que es justo lo que el
  analista no quiere perder al corregir un nombre.
*/
router.patch("/:proyectoId/candidatos/:candidatoId", async (req, res) => {
  try {
    const r = await editarCandidato(
      req.params.proyectoId,
      req.params.candidatoId,
      req.body || {}
    );

    if (!r.editado) return res.status(400).json(r);

    const ficha = await fichaIdentidad(
      req.params.proyectoId,
      req.params.candidatoId,
      "candidato"
    );

    res.json(absolutizarAvatares({ ...r, ficha }, req));
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al editar el candidato" });
  }
});


/*
-----------------------------------------------------------
FOTOGRAFIA DESDE FUENTES DECLARADAS — P-CAND-UX-04
-----------------------------------------------------------

Se resuelve solo cuando el analista lo pide. Nunca en cada
render: una fotografia que se recalcula al pintar seria una
peticion por pintado.

Lee metadata publica de la pagina de la cuenta. Sin login, sin
cookies, sin bypass, con tope de fuentes. Y NO usa la URL de la
cuenta como imagen: lee lo que la pagina declara.
-----------------------------------------------------------
*/
router.post("/:proyectoId/candidatos/:candidatoId/foto", async (req, res) => {
  const { proyectoId, candidatoId } = req.params;

  try {
    const ficha = await fichaIdentidad(proyectoId, candidatoId, "candidato");

    if (!ficha) {
      return res.status(404).json({ error: `no existe el candidato ${candidatoId}` });
    }

    const cuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);

    const r = await resolverFotoDeCandidato({
      candidateId: candidatoId,

      /*
        Si el analista ya dio un enlace directo, manda el suyo y
        no se sale a la red. `forzar` permite recalcular desde las
        fuentes aunque haya una manual.
      */
      fotoManualUrl:
        req.body?.forzar === true
          ? null
          : ficha.foto?.utilizable
            ? ficha.foto.url
            : null,

      cuentas
    });

    /*
      Solo se persiste si se resolvio algo desde una fuente. Los
      intentos fallidos se devuelven para que la interfaz los
      muestre, pero no se guarda una foto que no existe.
    */
    let guardado = null;

    if (r.fotoActual?.imageUrl && r.fotoActual.sourceType === "cuenta") {
      guardado = await editarCandidato(proyectoId, candidatoId, {
        fotoUrl: r.fotoActual.imageUrl,
        fotoSourceUrl: r.fotoActual.sourceUrl,
        fotoOrigen: r.fotoActual.origen,
        fotoProvider: r.fotoActual.provider,
        fotoDerivadaDeCuenta: true,
        fotoCuentaId: r.fotoActual.cuentaId,
        fotoPlataformaId: r.fotoActual.plataformaId,
        fotoHandle: r.fotoActual.handle
      });
    }

    const actualizada = await fichaIdentidad(proyectoId, candidatoId, "candidato");

    res.json(
      absolutizarAvatares(
        {
          resuelta: !!r.fotoActual?.imageUrl,
          fotoActual: r.fotoActual,
          intentos: r.intentos,
          limitaciones: r.limitaciones,
          persistida: guardado?.editado === true,
          ficha: actualizada
        },
        req
      )
    );
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al resolver la fotografía" });
  }
});


/*
-----------------------------------------------------------
ACCOUNT INTELLIGENCE — FASE 1
-----------------------------------------------------------

GET  describe el estado SIN salir a la red: capacidad por
     plataforma, limitaciones y estados vacios honestos.

POST ejecuta la observacion y escribe snapshots. Solo cuando el
     analista lo pide.
-----------------------------------------------------------
*/
async function componerInteligencia(proyectoId, candidatoId, ejecutar) {
  const ficha = await fichaIdentidad(proyectoId, candidatoId, "candidato");

  if (!ficha) return null;

  const cuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);

  /*
    ---------------------------------------------------------
    1 · ACCOUNT RESOLUTION

    Antes de observar nada hay que saber de quien es cada cuenta,
    y con que se sostiene. Ninguna pasa a corroborada por
    parecerse el nombre.

    `enlacesCruzados` llega VACIO hoy y eso es un limite, no un
    olvido: para saber que la web declarada enlaza a una cuenta
    hay que leer esa web, y este panel no sale a la red al
    abrirse. La senal se calculara cuando la observacion recoja
    los enlaces salientes de las paginas que si puede leer.
    ---------------------------------------------------------
  */
  const anclas = [
    ficha.nombre,
    ...(ficha.aliases || []).map((a) => a?.valor || a)
  ].filter(Boolean);

  const resolucion = resolverCuentasDelCandidato({
    candidateId: candidatoId,
    projectId: proyectoId,
    cuentas,
    anclasIdentidad: anclas,
    enlacesCruzados: []
  });

  /*
    ---------------------------------------------------------
    2 · OBSERVACION Y SERIES LONGITUDINALES
    ---------------------------------------------------------
  */
  const r = await observarCuentasDelCandidato({
    candidateId: candidatoId,
    projectId: proyectoId,
    cuentas,
    ejecutar
  });

  const historico = await snapshotsDe(proyectoId, candidatoId);

  const identidadPrevia = await snapshotsDeIdentidadDe(proyectoId, candidatoId);

  let snapshots = [];

  let snapshotIdentidad = null;

  if (ejecutar) {
    snapshots = snapshotsDeObservaciones(r.observaciones, {});

    await guardarSnapshots(proyectoId, candidatoId, snapshots);

    /*
      Foto del inventario. Se escribe SIEMPRE que se observa, no
      solo cuando cambia: sin el punto de hoy no se puede decir
      manana que cuentas habia hoy.
    */
    snapshotIdentidad = crearSnapshotDeIdentidad({
      candidateId: candidatoId,
      projectId: proyectoId,
      cuentas: resolucion.cuentas,
      origen: "observacion_de_cuentas"
    });

    await guardarSnapshotDeIdentidad(proyectoId, candidatoId, snapshotIdentidad);
  }

  const serieIdentidad = snapshotIdentidad
    ? [snapshotIdentidad, ...identidadPrevia]
    : identidadPrevia;

  /*
    ---------------------------------------------------------
    3 · CORPUS Y AMPLIFICACION
    ---------------------------------------------------------

    El corpus lo escriben las investigaciones, no este panel:
    abrir Account Intelligence no sale a la red.
  */
  const corpus = await evidenciasDe(proyectoId, candidatoId);

  const amplificacion = amplificacionDeCandidato({
    evidencias: corpus.evidencias,
    cuentas
  });

  const conversacion = separarConversacion({
    evidencias: corpus.evidencias,
    cuentas
  });

  const relaciones = relacionesDeEvidencias({
    evidencias: corpus.evidencias,
    candidateId: candidatoId,
    cuentas
  });

  const territorio = vincularLote({
    candidateId: candidatoId,
    evidencias: corpus.evidencias
  });

  /*
    Publicaciones propias: hoy no hay ninguna fuente que las
    entregue. La lista vacia se declara y NO se rellena con
    evidencias web, que son menciones de terceros.
  */
  const publicaciones = [];

  return {
    candidatoId,
    nombre: ficha.nombre,

    resumen: resumenDeCuentas(cuentas, r.observaciones),

    /* ---- IDENTIDAD ---- */
    resolucion,

    solidez: solidezDelExpediente(
      resolucion.cuentas.map((c) => ({
        ...c,
        senalesIndependientes: c.solidez.senalesIndependientes,
        declaradaPorAnalista: c.procedencia.declaradaPorAnalista,
        proveedoresHistoricos: c.procedencia.proveedores,
        corroboradaPorSentinel: c.procedencia.corroboradaPorSentinel,
        seenInCurrentRun: !c.observacion.noReencontradaEnLaUltimaVerificacion
      }))
    ),

    cuentas: resolucion.cuentas,

    observaciones: r.observaciones,

    /* ---- ACTIVIDAD ---- */
    actividad: actividadDePublicaciones(publicaciones),

    publicaciones,
    notaPublicaciones:
      "Ninguna fuente disponible entrega publicaciones de estas plataformas sin API. La lista vacia NO significa que el candidato no publique.",

    temas: temasDeLasCuentas(publicaciones),

    /* ---- AMPLIFICACION, MEDIOS, CONVERSACION ---- */
    amplificacion,
    conversacion,
    relaciones,

    medios: {
      ...amplificacion.ganada.medios,
      contrato: CONTRATO_MEDIA_RELATION
    },

    territorio,

    /* ---- PRESENCIA DIGITAL OBSERVADA ---- */
    presencia: presenciaDigitalObservada({
      actividad: actividadDePublicaciones(publicaciones),
      amplificacion,
      conversacion,
      snapshots: historico,
      evidencias: corpus.evidencias
    }),

    /* ---- HISTORICO ---- */
    historico: {
      snapshots: historico,
      total: historico.length,

      ventanas: ventanasDe(historico),

      identidad: {
        snapshots: serieIdentidad,
        total: serieIdentidad.length,
        ultimoCambio:
          serieIdentidad.length > 1
            ? compararInventarios(serieIdentidad[1], serieIdentidad[0])
            : null,
        nota:
          serieIdentidad.length > 1
            ? null
            : "Hace falta mas de una foto del inventario para poder compararlas. La serie empieza en la primera observacion."
      },

      corpus: {
        total: corpus.total,
        lotes: corpus.lotes,
        truncadas: corpus.truncadas,
        nota: corpus.nota,

        /*
          Procedencia temporal de las piezas mas antiguas: sirve
          para no leer una nota recuperada como una observacion
          en directo.
          */
        muestraDeProcedencia: corpus.evidencias.slice(0, 10).map((e) => ({
          url: e.url,
          ...procedenciaTemporal({
            recuperadaEn: e.observadaEn,
            fechaDeclaradaPorLaFuente: e.fecha
          })
        }))
      },

      nota:
        "Los snapshots se acumulan desde la primera ejecucion real. No se reconstruye historia anterior ni se inventan dias."
    },

    /* ---- EVIDENCIAS ---- */
    evidencias: {
      total: corpus.total,
      muestra: corpus.evidencias.slice(0, 60),
      nota: corpus.nota
    },

    traza: {
      ejecutado: r.ejecutado,
      peticionesRealizadas: r.peticionesRealizadas,
      topePeticiones: r.topePeticiones,
      snapshotsEscritos: snapshots.length,
      snapshotDeIdentidadEscrito: snapshotIdentidad != null
    }
  };
}


router.get("/:proyectoId/candidatos/:candidatoId/inteligencia", async (req, res) => {
  try {
    const r = await componerInteligencia(
      req.params.proyectoId,
      req.params.candidatoId,
      false
    );

    if (!r) {
      return res.status(404).json({ error: `no existe el candidato ${req.params.candidatoId}` });
    }

    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al leer Account Intelligence" });
  }
});


router.post("/:proyectoId/candidatos/:candidatoId/inteligencia", async (req, res) => {
  try {
    const r = await componerInteligencia(
      req.params.proyectoId,
      req.params.candidatoId,
      true
    );

    if (!r) {
      return res.status(404).json({ error: `no existe el candidato ${req.params.candidatoId}` });
    }

    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al observar las cuentas" });
  }
});


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
        INVENTARIO CONSOLIDADO — BUG-17

        Son la mejor semilla de propagacion: ya pasaron el
        clasificador. Antes se leian de `candidato.expediente`,
        que NO EXISTE en este objeto: `obtenerCandidato` devuelve
        el registro crudo del Lake y el expediente lo ensambla
        `contenidoDeProyecto`. La lista llegaba siempre vacia y la
        propagacion salia con la semilla equivocada.

        Ahora se pide al store con la via autoritativa. Incluye
        las cuentas consolidadas que NO se reencontraron en la
        ultima corrida: una identidad no deja de existir porque un
        buscador callara.

        Que un handle este atribuido en una plataforma no lo
        atribuye en otra: solo sirve para ir a mirar.
      */
      handlesAtribuidos: await inventarioConsolidado(
        proyectoId,
        "candidato",
        candidatoId
      )
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
