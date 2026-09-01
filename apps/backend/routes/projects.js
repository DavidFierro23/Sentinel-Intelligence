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
import {
  resolverCuentasDelCandidato,
  ESTADOS_RESOLUCION
} from "../services/intelligence/accountResolution.js";

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

/* P-CAND-02 */
import {
  observarEnlacesSalientes,
  enlacesParaResolucion,
  DIRECCIONES
} from "../services/intelligence/crossLinkEvidence.js";

import { estadoDeMetricas } from "../services/intelligence/evidenceFirst.js";

import {
  resumenDePublicaciones,
  serieDeMetrica
} from "../services/intelligence/publicationObservation.js";

import { preparacionParaObservacionReal } from "../services/intelligence/platformAdapterPort.js";

/* P-CAND-03 */
import { observarCandidato } from "../services/intelligence/candidateObservation.js";

import {
  contextoMetaDeObservacion,
  ESTADOS_CONTEXTO_META
} from "../services/intelligence/metaObservationContext.js";

import { matrizDeCapacidades } from "../services/intelligence/socialCapabilityMatrix.js";

/* P-CAND-BENCH-01 */
import { lineaBaseT0 } from "../services/intelligence/candidateBaseline.js";

import {
  activosDeCandidato,
  crearDeclaracionDeTipo,
  coberturaMetaDeclarada,
  TIPOS_POR_PLATAFORMA,
  ETIQUETA_TIPO
} from "../services/intelligence/candidateAssets.js";

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
  guardarSenalesCrossLink,
  senalesCrossLinkDe,
  guardarDeclaracionesDeTipo,
  declaracionesDeTipoDe,
  guardarPublicaciones,
  publicacionesDe,
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

    /*
      ---------------------------------------------------------
      TIPO DE ACTIVO EN LA FICHA — P-CAND-ASSET-TYPE-UI-FIX-01
      ---------------------------------------------------------

      El editor de identidad se alimenta de esta ruta, y sin
      esto no tenia forma de saber que tipo tiene cada activo:
      la clasificacion solo viajaba por `/inteligencia`, que
      alimenta otra pantalla.

      Se lee del Lake, no de la red. Va como bloque aparte y no
      mezclado dentro de cada cuenta, porque el TIPO DEL ACTIVO
      y el ESTADO DE IDENTIDAD son dos cosas distintas y la
      ficha ya lleva la segunda.
      ---------------------------------------------------------
    */
    const cuentasFicha = f.plataformas.flatMap((pl) => pl.cuentas || []);

    const tiposDeclarados = await declaracionesDeTipoDe(
      req.params.proyectoId,
      req.params.candidatoId
    );

    const inventario = activosDeCandidato({
      candidateId: req.params.candidatoId,
      cuentas: cuentasFicha,
      declaraciones: tiposDeclarados.declaraciones
    });

    /* Indexado por id de activo: la UI lo cruza con su cuenta. */
    const porActivo = {};

    inventario.activos
      .filter((a) => a.platform === "facebook" || a.platform === "instagram")
      .forEach((a) => {
        porActivo[a.accountId] = {
          assetType: a.assetType,
          assetTypeSource: a.assetTypeSource,
          assetTypeDeclared: a.assetTypeDeclared,
          assetTypeVerification: a.assetTypeVerification,
          assetTypeConflicto: a.assetTypeConflicto,
          tiposAdmitidos: a.tiposAdmitidos,
          elegibilidadMeta: a.elegibilidadMeta?.estado || null
        };
      });

    res.json({
      ...absolutizarAvatares(f, req),

      activosMeta: {
        porActivo,
        total: Object.keys(porActivo).length,
        declarados: tiposDeclarados.total,
        etiquetasDeTipo: ETIQUETA_TIPO,
        tiposPorPlataforma: TIPOS_POR_PLATAFORMA,

        separacion:
          "El estado de identidad dice si la cuenta es del candidato. El tipo de activo dice que clase de cuenta es. No son lo mismo y no se deducen uno del otro."
      }
    });
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

    P-CAND-02 CIERRA EL HUECO DE V1: `enlacesCruzados` ya no
    llega vacio. Sale de las senales de cross-link persistidas,
    que son observaciones reales de paginas que Sentinel puede
    leer. Se leen del Lake, no de la red: abrir el panel sigue
    sin salir a internet.
    ---------------------------------------------------------
  */
  const anclas = [
    ficha.nombre,
    ...(ficha.aliases || []).map((a) => a?.valor || a)
  ].filter(Boolean);

  const crossLinks = await senalesCrossLinkDe(proyectoId, candidatoId);

  /*
    Tipos de activo declarados por el analista. Se leen del Lake
    y no salen a la red: el HTML publico no distingue perfil de
    pagina —comprobado con control en META-COVERAGE-AUDIT-01— y
    esta es la unica fuente que hoy lo resuelve.
  */
  const tipos = await declaracionesDeTipoDe(proyectoId, candidatoId);

  const resolucion = resolverCuentasDelCandidato({
    candidateId: candidatoId,
    projectId: proyectoId,
    cuentas,
    anclasIdentidad: anclas,
    enlacesCruzados: enlacesParaResolucion(crossLinks.senales)
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
    ---------------------------------------------------------
    PUBLICACIONES PROPIAS
    ---------------------------------------------------------

    Ya NO son una lista vacia por decreto: se leen de la serie
    persistida. Sigue estando vacia mientras ninguna fuente las
    entregue —eso depende de la credencial y del adaptador—,
    pero el modelo ya las sostiene con sus metricas como
    snapshots.
  */
  const serieDePublicaciones = await publicacionesDe(proyectoId, candidatoId);

  const publicaciones = serieDePublicaciones.publicaciones;

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
    notaPublicaciones: publicaciones.length
      ? serieDePublicaciones.nota
      : "Ninguna fuente disponible entrega publicaciones de estas plataformas sin API. La lista vacia NO significa que el candidato no publique.",

    resumenPublicaciones: resumenDePublicaciones(publicaciones),

    /* ---- CROSS-LINK EVIDENCE (P-CAND-02) ---- */
    crossLinks: {
      senales: crossLinks.senales,
      total: crossLinks.total,
      lotes: crossLinks.lotes,
      ultimosIntentos: crossLinks.ultimosIntentos,
      nota: crossLinks.nota,

      porDireccion: crossLinks.senales.reduce((acc, s) => {
        acc[s.direccion] = (acc[s.direccion] || 0) + 1;

        return acc;
      }, {}),

      /*
        Cuantas senales independientes aporta REALMENTE al
        resolvedor. Es la cifra que explica por que una cuenta
        ascendio o por que sigue sin ascender.
      */
      aportanCorroboracion: enlacesParaResolucion(crossLinks.senales).length
    },

    /* ---- ACTIVOS META Y TIPO DECLARADO ---- */
    activos: {
      ...activosDeCandidato({
        candidateId: candidatoId,
        cuentas,
        declaraciones: tipos.declaraciones
      }),

      declaraciones: tipos.declaraciones,
      lotesDeDeclaracion: tipos.lotes,
      notaDeclaraciones: tipos.nota,

      tiposPorPlataforma: TIPOS_POR_PLATAFORMA,
      etiquetasDeTipo: ETIQUETA_TIPO,

      separacion:
        "El tipo declarado por el analista y el verificado tecnicamente son campos distintos y no se funden. Declarar no verifica."
    },

    /* ---- EVIDENCE-FIRST (P-CAND-02) ---- */
    metricas: estadoDeMetricas(),

    /* ---- PREPARACION PARA OBSERVACION REAL ---- */
    preparacion: await preparacionParaObservacionReal(["youtube"]),

    /* ---- MATRIZ MULTIPLATAFORMA (P-CAND-03) ---- */
    capacidades: matrizDeCapacidades(),

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

      /*
        SERIES DE METRICAS DE PUBLICACION — P-CAND-03.

        Las ventanas de arriba miran los snapshots de CUENTA. Sin
        esto, un expediente con nueve snapshots de metricas reales
        mostraba «sin observaciones» en Historico, que es falso:
        hay observaciones, lo que no hay es una segunda con la que
        comparar. Son dos cosas distintas y ahora se ven las dos.
      */
      metricas: {
        publicaciones: publicaciones.length,

        snapshots: publicaciones.reduce(
          (s, p) => s + (p.metricas || []).length,
          0
        ),

        series: publicaciones.flatMap((p) =>
          ["views", "likes", "comments"].map((m) => {
            const s = serieDeMetrica(p, m);

            return {
              publicationId: p.publicationId,
              canonicalUrl: p.canonicalUrl,
              metrica: m,
              observaciones: s.observaciones,
              comparable: s.comparable,
              estado: s.comparable ? "COMPARABLE" : "HISTORICO_INSUFICIENTE",
              delta: s.delta,
              velocidad: s.velocidad,
              motivo: s.motivo
            };
          })
        ),

        nota: publicaciones.length
          ? "Cada metrica de cada publicacion es una serie propia. Con una sola observacion el estado es HISTORICO_INSUFICIENTE: hay dato, no hay comparacion."
          : "No hay ninguna publicacion observada todavia."
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


/*
-----------------------------------------------------------
DECLARAR EL TIPO DE UN ACTIVO META — P-CAND-ASSET-TYPE-DECLARE-01
-----------------------------------------------------------

El analista clasifica un activo que ya existe. No crea cuentas,
no cambia URLs y no verifica nada: solo dice de que clase es la
cuenta que esta mirando.

No sale a la red. No consume cuota. No toca `cuentasReferencia`:
la declaracion se guarda en su propia serie para que clasificar
un activo no pueda alterar la identidad de otro ni la suya.
-----------------------------------------------------------
*/
router.post("/:proyectoId/candidatos/:candidatoId/tipos-activo", async (req, res) => {
  const { proyectoId, candidatoId } = req.params;

  try {
    const ficha = await fichaIdentidad(proyectoId, candidatoId, "candidato");

    if (!ficha) {
      return res.status(404).json({ error: `no existe el candidato ${candidatoId}` });
    }

    const cuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);

    const porId = new Map(cuentas.map((c) => [String(c.id), c]));

    const entrantes = Array.isArray(req.body?.declaraciones)
      ? req.body.declaraciones
      : req.body?.assetId
        ? [req.body]
        : [];

    if (!entrantes.length) {
      return res.status(400).json({
        error: "no se recibio ninguna declaracion",
        formato: "{ assetId, declaredType } o { declaraciones: [...] }"
      });
    }

    const aceptadas = [];

    const rechazadas = [];

    for (const e of entrantes) {
      const cuenta = porId.get(String(e?.assetId || ""));

      /*
        Un activo que no esta en la ficha no se declara. Lo
        contrario permitiria crear clasificaciones huerfanas
        que despues nadie sabe a que cuenta pertenecen.
      */
      if (!cuenta) {
        rechazadas.push({
          assetId: e?.assetId || null,
          motivo: "ese activo no esta en la ficha del candidato"
        });

        continue;
      }

      const r = crearDeclaracionDeTipo({
        candidateId: candidatoId,
        assetId: cuenta.id,
        platform: cuenta.plataformaId,
        url: cuenta.url,
        declaredType: e?.declaredType,
        declaredBy: e?.declaredBy || "analyst"
      });

      if (!r.valido) {
        rechazadas.push({ assetId: e?.assetId || null, motivo: r.motivo });

        continue;
      }

      aceptadas.push(r.declaracion);
    }

    let escritura = { escrito: false, total: 0 };

    if (aceptadas.length) {
      escritura = await guardarDeclaracionesDeTipo(proyectoId, candidatoId, aceptadas);
    }

    const r = await componerInteligencia(proyectoId, candidatoId, false);

    res.json({
      declaradas: aceptadas.length,
      rechazadas,
      escritura,

      /*
        La respuesta trae el estado recalculado para que la
        interfaz no tenga que adivinarlo ni pedirlo aparte.
      */
      activos: r?.activos || null,

      nota:
        "Tipo declarado por el analista. Sentinel no lo ha comprobado contra ninguna API: la cuenta sigue NO_VERIFICADA y el benchmark sigue sin habilitarse."
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al declarar el tipo de activo" });
  }
});


/*
-----------------------------------------------------------
COBERTURA META DEL PROYECTO — TRES NIVELES
-----------------------------------------------------------

Confirmada, declarada y desconocida no se suman. Ver
`coberturaMetaDeclarada` para por que son tres columnas y no
un porcentaje.
-----------------------------------------------------------
*/
router.get("/:proyectoId/cobertura-meta", async (req, res) => {
  const { proyectoId } = req.params;

  try {
    const contenido = await contenidoDeProyecto(proyectoId);

    if (!contenido?.proyecto) {
      return res.status(404).json({ error: `no existe el proyecto ${proyectoId}` });
    }

    const porCandidato = [];

    for (const cand of contenido.candidatos || []) {
      const ficha = await fichaIdentidad(proyectoId, cand.id, "candidato");

      if (!ficha) continue;

      const cuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);

      const tipos = await declaracionesDeTipoDe(proyectoId, cand.id);

      const r = activosDeCandidato({
        candidateId: cand.id,
        cuentas,
        declaraciones: tipos.declaraciones
      });

      porCandidato.push({ ...r, nombre: cand.nombre });
    }

    res.json({
      proyectoId,
      candidatos: porCandidato.length,

      cobertura: coberturaMetaDeclarada(porCandidato),

      porCandidato,

      tiposPorPlataforma: TIPOS_POR_PLATAFORMA,
      etiquetasDeTipo: ETIQUETA_TIPO
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al calcular la cobertura Meta" });
  }
});


/*
-----------------------------------------------------------
CROSS-LINK EVIDENCE — OBSERVAR ENLACES SALIENTES
-----------------------------------------------------------

Lee las paginas que Sentinel YA puede leer y busca enlaces a
cuentas sociales. Es la unica forma de conseguir una senal
independiente del nombre sin comprar acceso a nada.

Solo cuando el analista lo pide. Sin login, sin cookies, tope
de paginas, una peticion por pagina.
-----------------------------------------------------------
*/
router.post("/:proyectoId/candidatos/:candidatoId/enlaces", async (req, res) => {
  const { proyectoId, candidatoId } = req.params;

  try {
    const ficha = await fichaIdentidad(proyectoId, candidatoId, "candidato");

    if (!ficha) {
      return res.status(404).json({ error: `no existe el candidato ${candidatoId}` });
    }

    const cuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);

    /*
      QUE PAGINAS SE LEEN.

      Las webs del expediente, como WEB_TO_ACCOUNT. Y las
      cuentas ya corroboradas cuya plataforma admite lectura,
      como ACCOUNT_TO_ACCOUNT — solo esas: una cuenta sin
      corroborar no puede corroborar a otra.

      CORREGIDO EN P-CAND-03. Antes esto miraba
      `corroboradaPorSentinel` de la ficha, que solo significa
      «algun proveedor la devolvio». Eso es mas laxo que el
      veredicto de Account Resolution, que exige una senal
      INDEPENDIENTE del nombre — asi que una cuenta que el
      resolvedor considera CANDIDATA podia usarse como origen y
      debilitar la guarda de circularidad.

      Ahora el origen lo decide el resolvedor. Es la misma
      autoridad que decide si una cuenta esta corroborada, y no
      puede haber dos.
    */
    const veredicto = resolverCuentasDelCandidato({
      candidateId: candidatoId,
      projectId: proyectoId,
      cuentas,
      anclasIdentidad: [
        ficha.nombre,
        ...(ficha.aliases || []).map((a) => a?.valor || a)
      ].filter(Boolean),
      enlacesCruzados: enlacesParaResolucion(
        (await senalesCrossLinkDe(proyectoId, candidatoId)).senales
      )
    });

    const corroboradas = new Set(
      veredicto.cuentas
        .filter(
          (c) =>
            c.estado === ESTADOS_RESOLUCION.CORROBORADA ||
            c.estado === ESTADOS_RESOLUCION.CONSOLIDADA
        )
        .map((c) => c.accountId)
    );

    const fuentes = cuentas
      .filter((c) => c.plataformaId === "web")
      .map((c) => ({
        url: c.url,
        plataformaId: "web",
        sourceType: "web_del_expediente",
        direccion: DIRECCIONES.WEB_TO_ACCOUNT,
        declaradaPorAnalista: c.declaradaPorAnalista === true
      }));

    cuentas
      .filter((c) => c.plataformaId !== "web" && corroboradas.has(c.id))
      .forEach((c) =>
        fuentes.push({
          url: c.url,
          plataformaId: c.plataformaId,
          sourceType: "cuenta_corroborada",
          direccion: DIRECCIONES.ACCOUNT_TO_ACCOUNT,
          origenCorroborado: true,
          declaradaPorAnalista: c.declaradaPorAnalista === true
        })
      );

    const r = await observarEnlacesSalientes({
      candidateId: candidatoId,
      projectId: proyectoId,
      fuentes,
      cuentasConocidas: cuentas,
      ejecutar: req.body?.ejecutar !== false
    });

    let guardado = null;

    if (r.ejecutado) {
      guardado = await guardarSenalesCrossLink(
        proyectoId,
        candidatoId,
        r.senales,
        { intentos: r.intentos }
      );
    }

    /* Estado ya fusionado, para que la interfaz no lo recalcule. */
    const acumulado = await senalesCrossLinkDe(proyectoId, candidatoId);

    res.json({
      candidatoId,
      ejecutado: r.ejecutado,
      fuentesConsideradas: fuentes.length,
      paginasLeidas: r.paginasLeidas,
      topePaginas: r.topePaginas,

      senalesNuevas: r.senales.length,
      intentos: r.intentos,

      persistido: guardado?.escrito === true,

      acumulado: {
        total: acumulado.total,
        lotes: acumulado.lotes,
        senales: acumulado.senales,
        aportanCorroboracion: enlacesParaResolucion(acumulado.senales).length
      },

      regla: r.regla,
      prohibido: r.prohibido,

      nota: fuentes.length
        ? null
        : "No hay ninguna pagina legible en el expediente. Hace falta al menos una web declarada o una cuenta ya corroborada en una plataforma que admita lectura publica."
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al observar los enlaces" });
  }
});


/*
-----------------------------------------------------------
LINEA BASE T0 MULTICANDIDATO — P-CAND-BENCH-01
-----------------------------------------------------------

Se ARMA desde el Lake: no sale a la red ni consume cuota. Lo que
se observo ya esta persistido; esto solo lo lee y lo ordena.

T0 es el punto de partida, no un veredicto. No hay ranking ni
ganador: hay observaciones por plataforma, con su cobertura y su
comparabilidad declaradas.
-----------------------------------------------------------
*/
router.get("/:proyectoId/linea-base", async (req, res) => {
  const { proyectoId } = req.params;

  try {
    const contenido = await contenidoDeProyecto(proyectoId);

    if (!contenido?.proyecto) {
      return res.status(404).json({ error: `no existe el proyecto ${proyectoId}` });
    }

    const candidatos = [];

    for (const cand of contenido.candidatos || []) {
      const ficha = await fichaIdentidad(proyectoId, cand.id, "candidato");

      if (!ficha) continue;

      const cuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);

      const pubs = await publicacionesDe(proyectoId, cand.id);

      /*
        Metricas de cuenta: del snapshot mas reciente de cada
        plataforma. La serie es append-only, asi que el ultimo es
        el estado actual y los anteriores siguen ahi.
      */
      const serie = await snapshotsDe(proyectoId, cand.id);

      const metricasDeCuenta = {};

      serie.forEach((sn) => {
        if (!sn.platform) return;

        /* El primero que aparece es el mas reciente: la serie viene ordenada. */
        if (!metricasDeCuenta[sn.platform]) {
          metricasDeCuenta[sn.platform] = {
            followers: sn.followers ?? null,
            capturedAt: sn.capturedAt,
            provider: sn.provider,
            accountId: sn.accountId
          };
        }
      });

      candidatos.push({
        candidateId: cand.id,
        nombre: cand.nombre,
        foto: cand.foto || null,
        cuentas,
        publicaciones: pubs.publicaciones,
        metricasDeCuenta
      });
    }

    res.json(
      absolutizarAvatares(
        {
          proyectoId,
          proyecto: contenido.proyecto.nombre,
          ...lineaBaseT0(candidatos)
        },
        req
      )
    );
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al construir la linea base" });
  }
});


/*
-----------------------------------------------------------
OBSERVACION REAL DE PLATAFORMA — P-CAND-03
-----------------------------------------------------------

Consume cuota de proveedor. Solo cuando el analista lo pide, y
con una muestra pequena: validar el pipeline no exige recorrer
un canal entero.

La cuenta a observar sale del EXPEDIENTE, nunca de una busqueda
por nombre. Y observar NO corrobora: la identidad se sostiene
aparte.
-----------------------------------------------------------
*/
router.post("/:proyectoId/candidatos/:candidatoId/observar", async (req, res) => {
  const { proyectoId, candidatoId } = req.params;

  try {
    const ficha = await fichaIdentidad(proyectoId, candidatoId, "candidato");

    if (!ficha) {
      return res.status(404).json({ error: `no existe el candidato ${candidatoId}` });
    }

    const cuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);

    const plataformas = req.body?.plataformas || ["youtube"];

    /*
      ---------------------------------------------------------
      CONTEXTO META — P-CAND-IG-ROUTE-01
      ---------------------------------------------------------

      El motor de Instagram ya existia y por esta ruta devolvia
      NO_EJECUTABLE, porque los dos datos que `business_discovery`
      necesita no llegaban: desde que cuenta propia se pregunta y
      que handles administramos.

      Se resuelven AQUI, en el backend, porque los dos se derivan
      del token. Pedirselos al cliente exigiria mandarle la
      credencial al navegador.

      Una llamada, y solo si la ejecucion incluye Instagram.
      ---------------------------------------------------------
    */
    const contextoMeta = await contextoMetaDeObservacion({ plataformas });

    /*
      Tipo declarado por activo. Sale del Lake y no de la red: es
      lo que permite que un Instagram personal quede
      NO_SOPORTADO_PERSONAL sin gastar una llamada en confirmar
      lo que ya consta.
    */
    const tipos = await declaracionesDeTipoDe(proyectoId, candidatoId);

    const inventario = activosDeCandidato({
      candidateId: candidatoId,
      cuentas,
      declaraciones: tipos.declaraciones
    });

    const tiposDeActivo = {};

    (inventario.activos || []).forEach((a) => {
      if (a.accountId) tiposDeActivo[a.accountId] = a.assetType;
    });

    /*
      ---------------------------------------------------------
      FALLBACK DE PROVEEDOR — P-CAND-INSTAGRAM-HTTP-01
      ---------------------------------------------------------

      Opt-in EN DOS CAPAS, ninguna suficiente por si sola:

        1. El cliente lo pide explicitamente en el cuerpo de esta
           peticion POST. Una lectura (GET /identidad, GET
           /inteligencia) nunca pasa por aqui: no hay forma de
           que abrir una ficha o listar candidatos dispare esto.

        2. El servidor decide si de verdad sale a la red.
           `observarCandidato` no vuelve a preguntar si el
           cliente quiere: eso ya se decidio arriba. Lo que
           comprueba —sin duplicarlo aqui— es si el entorno lo
           permite: `SOCIAL_EXTERNAL_PROVIDER_ENABLED`, el
           proveedor aprobado en el registro y su credencial.
           Las tres siguen siendo obligatorias y no cambian.

      El entorno se lee del proceso, nunca del cuerpo de la
      peticion: un cliente no puede mandar su propia clave ni
      fingir que el entorno esta configurado.
      ---------------------------------------------------------
    */
    const proveedorInstagram =
      req.body?.proveedorInstagram === true
        ? { id: "scrapecreators", entorno: process.env }
        : null;

    const r = await observarCandidato({
      candidateId: candidatoId,
      projectId: proyectoId,
      cuentas,
      maximoPublicaciones: Math.min(Number(req.body?.maximo) || 5, 10),
      plataformas,

      idParaBusinessDiscovery: contextoMeta.idParaBusinessDiscovery,
      cuentasPropias: contextoMeta.cuentasPropias,
      tiposDeActivo,

      proveedorInstagram
    });

    /*
      SNAPSHOT DE CUENTA MEDIDA POR PROVEEDOR — P-CAND-SNAPSHOTS-01.

      Hallazgo de tres gates consecutivos (BENCH-02, BENCH-02A): esta
      ruta mide en vivo (`observarInstagramConFallback` y cualquier
      fallback de proveedor futuro sobre otras plataformas) pero
      nunca persistia el snapshot de la CUENTA -solo publicaciones,
      via `guardarPublicaciones`, mas abajo-. Sin esto, cada llamada
      real a `proveedorInstagram: true` se perdia en cuanto terminaba
      el request HTTP.

      Generico, no especifico de Instagram: cualquier resultado con
      estado MEDIDO_PROVEEDOR y `canalProveedor.followers` se
      persiste igual, sea cual sea la plataforma. No se inventa
      ningun campo que el proveedor no haya devuelto -`followers`
      llega `null` si el mapeador no lo tenia, nunca se convierte a 0-.
    */
    const medicionesDeProveedor = r.resultados.filter(
      (x) => x.estado === "MEDIDO_PROVEEDOR" && x.canalProveedor
    );

    let snapshotsDeProveedorGuardados = null;

    if (medicionesDeProveedor.length) {
      const snapshotsDeCuenta = medicionesDeProveedor.map((x) => ({
        candidateId: candidatoId,
        accountId: x.accountId,
        projectId: proyectoId,
        platform: x.plataformaId,
        capturedAt: r.observedAt,
        followers: x.canalProveedor.followers ?? null,
        postsObserved: 0,
        metricsAvailable: ["followers"],
        lastActivityAt: null,
        provider: x.provider || null,
        estado: x.estado,
        limitations: [
          "la via oficial no alcanza este activo (o no aplica); el estado oficial se conserva completo en `resultadoOficial`",
          "proveedor externo: no es dato licenciado por la plataforma",
          "persistido automaticamente por el flujo HTTP /observar (P-CAND-SNAPSHOTS-01); antes de este gate este snapshot solo se generaba manualmente"
        ],
        comparacion: {
          snapshotAnterior: null,
          delta: null,
          publicacionesDelPeriodo: null,
          temasActivos: [],
          nota: "Change Attribution no esta implementado."
        },
        candidatoId
      }));

      snapshotsDeProveedorGuardados = await guardarSnapshots(
        proyectoId,
        candidatoId,
        snapshotsDeCuenta
      );
    }

    /* Persistencia append-only: las metricas son snapshots. */
    let guardado = null;

    if (r.publicaciones.length) {
      /*
        El proveedor del LOTE se deriva de lo que se observo. Era
        fijo "youtube_data", asi que un lote de Instagram quedaba
        etiquetado como si viniera de YouTube. Cada publicacion
        lleva ademas su propio `provider`, que es el que manda;
        esto es la etiqueta del lote y tambien tiene que ser
        cierta.
      */
      const proveedores = [
        ...new Set(r.publicaciones.map((p) => p.provider).filter(Boolean))
      ];

      guardado = await guardarPublicaciones(
        proyectoId,
        candidatoId,
        r.publicaciones,
        {
          observadoEn: r.observedAt,
          provider: proveedores.length === 1 ? proveedores[0] : proveedores.join("+")
        }
      );
    }

    /* Relectura desde el Lake, no del objeto en memoria. */
    const desdeElLake = await publicacionesDe(proyectoId, candidatoId);

    res.json({
      candidatoId,
      observedAt: r.observedAt,

      /*
        Transparencia de persistencia -P-CAND-SNAPSHOTS-01-: cuantos
        snapshots de CUENTA medidos por proveedor se escribieron en
        esta llamada. `null` cuando ningun resultado de este request
        califico -no hay proveedor que reportar, no un fallo silencioso-.
      */
      snapshotsDeProveedorGuardados,

      resultados: r.resultados.map((x) => ({
        plataformaId: x.plataformaId,
        accountId: x.accountId,
        estado: x.estado,
        motivo: x.motivo || null,
        canal: x.canal
          ? {
              channelId: x.canal.channelId,
              displayName: x.canal.displayName,
              url: x.canal.url,
              handleConsultado: x.canal.handleConsultado,
              estadisticasPublicas: x.canal.estadisticasPublicas,
              territoryClaim: x.canal.territoryClaim
            }
          : null,
        metricasDeCuenta: x.metricasDeCuenta || [],
        publicaciones: (x.publicaciones || []).length,
        traza: x.traza || null,
        notaIdentidad: x.notaIdentidad || null,

        /*
          Sin estos dos campos la respuesta no distingue haber
          medido a un tercero de haber medido nuestra propia
          cuenta, y en pantalla las dos se verian «OBSERVADA».
        */
        alcanceDeLaMedicion: x.alcanceDeLaMedicion || null,
        notaAlcance: x.notaAlcance || null,

        /* Si el estado lo dijo Meta o lo dijo el analista. */
        procedenciaDelEstado: x.procedenciaDelEstado || null,
        assetType: x.assetType || null,

        /*
          P-CAND-INSTAGRAM-HTTP-01. Presentes SOLO cuando el
          activo se midio por proveedor de respaldo:
          `sourceKind`/`provider` son la marca de procedencia que
          distingue esto de una medicion oficial, y
          `estadoOficialConservado` es la razon por la que Meta no
          alcanzaba el activo -nunca se pierde, aunque el
          proveedor haya medido despues-.

          `canalProveedor` es del proveedor, nunca se mete dentro
          de `canal`: son formas distintas y compararlas como si
          fueran la misma medicion seria inventar una
          equivalencia que no existe.
        */
        sourceKind: x.sourceKind || null,
        provider: x.provider || null,
        canalProveedor: x.canalProveedor || null,
        estadoOficialConservado: x.estadoOficialConservado || null,

        /*
          El proveedor se intento y no pudo -sin aprobar, sin
          credencial, bloqueado, error de red-. El estado oficial
          de arriba sigue siendo el real; esto solo explica por
          que no hay `canalProveedor`.
        */
        proveedorIntentado: x.proveedorIntentado || false,
        proveedorError: x.proveedorError || null
      })),

      resumen: r.resumen,
      unidadesConsumidas: r.unidadesConsumidas,

      /*
        Estado del contexto Meta, SIN el id ni la credencial. Que
        la via este resuelta o no es lo que el analista necesita
        para leer un NO_EJECUTABLE.
      */
      contextoMeta: {
        estado: contextoMeta.estado,
        resuelto: contextoMeta.estado === ESTADOS_CONTEXTO_META.RESUELTO,
        cuentasPropiasDetectadas: (contextoMeta.cuentasPropias || []).length,
        llamadas: contextoMeta.llamadas || 0,
        motivo: contextoMeta.motivo || null,
        nota: contextoMeta.nota || null
      },

      persistido: guardado?.escrito === true,

      desdeElLake: {
        publicaciones: desdeElLake.total,
        lotes: desdeElLake.lotes,
        snapshotsDeMetricas: desdeElLake.snapshotsDeMetricas,
        nota: desdeElLake.nota
      }
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al observar el candidato" });
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
