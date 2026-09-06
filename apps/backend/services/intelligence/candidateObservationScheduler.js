// apps/backend/services/intelligence/candidateObservationScheduler.js

/*
===========================================================
OBSERVACION DIARIA AUTOMATICA DE CANDIDATOS
CANDIDATE-LONGITUDINAL-FOUNDATION-01
===========================================================

ANTES de este gate NO existia ningun mecanismo de ejecucion
continua para Candidate Intelligence: cero `setInterval`, cero
cron, cero worker, en todo el backend. `collectorScheduler.js`
(Territorial, de otra terminal) es un CONTRATO -"no arranca
nada"-, no un proceso real. La respuesta literal a "si Sentinel
hubiera quedado encendido los proximos 7 dias, ¿habria generado
observaciones diarias automaticas?" era NO.

Este modulo SI arranca algo: un `setInterval` en proceso que,
cada `intervaloDeChequeoMs`, comprueba si YA existe una corrida
exitosa para el proyecto en la fecha local de hoy
(America/Guayaquil por defecto) y, si no, ejecuta una.

NO ES UN MOTOR NUEVO DE OBSERVACION: reutiliza
`collectCandidateSnapshots` (candidateSnapshotCollection.js,
P-CAND-SNAPSHOT-COLLECTION-01) tal cual, mas
`calcularIPDO`/`extraerInsumosCandidato`
(digitalPresenceIndex.js, ya aprobado) para la observacion IPDO y
el ranking del corte.

ENROLLMENT DINAMICO
-----------------------------------------------------------

Nunca se hardcodea un candidateId. Cada corrida vuelve a leer
`contenidoDeProyecto(projectId)` y observa a TODOS los candidatos
que devuelva, con `activo !== false` -hoy ningun candidato tiene
ese campo, asi que todos cuentan como activos; si en el futuro se
agrega el campo, el enrollment ya lo respeta sin cambiar este
archivo-.

PRESUPUESTO DE LA CORRIDA AUTOMATICA
-----------------------------------------------------------

La corrida NORMAL_DAILY_RUN nunca activa fallback de proveedor
(`proveedorInstagram`/`proveedorFacebook`): solo vias oficiales, ya
autorizadas, sin costo de creditos. Gastar creditos de proveedor
automaticamente cada dia agotaria el saldo en dias. Una corrida
FORCED_MANUAL_RUN puede activar proveedor explicitamente, marcada
como tal.
===========================================================
*/

import {
  contenidoDeProyecto,
  guardarCollectionRun,
  collectionRunsDe,
  guardarObservacionIPDO,
  guardarRankingSnapshot,
  fichaIdentidad,
  snapshotsDe,
  publicacionesDe,
  evidenciasDe,
  listarProyectos
} from "../projects/projectStore.js";

import { collectCandidateSnapshots, PLATAFORMAS_COLECCION } from "./candidateSnapshotCollection.js";
import { calcularIPDO, extraerInsumosCandidato, IPDO_METHOD_VERSION } from "./digitalPresenceIndex.js";
import { amplificacionDeCandidato, separarConversacion } from "./candidateAmplification.js";

/*
  Lock distribuido (SENTINEL-HISTORICAL-CLOUD-01, Opcion A,
  autorizado explicitamente para esta sola integracion). Capa de
  infraestructura, no de logica Candidate: no cambia formulas,
  collectors, IPDO, multi-asset ni enrollment -solo decide si esta
  corrida NORMAL_DAILY_RUN entra o se detiene ANTES de tocar ningun
  collector, cuando hay mas de un worker.
*/
import { conLockDiario, obtenerPoolLockCompartido } from "../knowledgeLake/dailyRunLock.js";

export const TIMEZONE_OPERACIONAL = "America/Guayaquil";

export const TIPOS_DISPARO = Object.freeze({
  NORMAL_DAILY_RUN: "NORMAL_DAILY_RUN",
  FORCED_MANUAL_RUN: "FORCED_MANUAL_RUN"
});

export const ESTADOS_RUN = Object.freeze({
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
  SKIPPED_ALREADY_COLLECTED: "SKIPPED_ALREADY_COLLECTED",
  /*
    Distinto de SKIPPED_ALREADY_COLLECTED: no es que ya se supiera
    que hoy estaba hecho, es que OTRO worker tiene el lock
    distribuido de este proyecto+dia en este mismo instante. No es
    un error operativo -es la proteccion funcionando-, por eso es un
    estado propio y no se cuenta como FAILED.
    SENTINEL-HISTORICAL-CLOUD-01 (lock distribuido, Opcion A).
  */
  SKIPPED_LOCKED: "SKIPPED_LOCKED"
});

/*
  Registro de conflictos conocidos. Mismo registro reutilizado en
  todos los gates de IPDO/matriz -no se persiste todavia
  (IDENTITY_EXCLUSION_PERSISTENCE_DEBT, declarada, no resuelta
  aqui-, pero la observacion automatica SIGUE excluyendolo.
*/
const CONFLICTOS_CONOCIDOS = new Set(["instagram:leomoralez.1425"]);

/*
  Fecha local en formato YYYY-MM-DD, en la zona operacional. Es la
  clave de idempotencia: dos corridas con la misma
  `localObservationDate` para el mismo proyecto y el mismo
  `triggerType` NORMAL_DAILY_RUN nunca se duplican.
*/
export function fechaLocalObservacion(fecha = new Date(), timezone = TIMEZONE_OPERACIONAL) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(fecha);
}

/*
  ¿Ya existe una corrida NORMAL_DAILY_RUN exitosa o parcial para
  esta fecha local? Una corrida FALLIDA no cuenta como "ya
  recolectado" -se reintenta-. Una corrida FORCED_MANUAL_RUN
  tampoco bloquea la automatica del dia: son intenciones distintas.
*/
export async function yaSeColectoHoy(projectId, localObservationDate) {
  const runs = await collectionRunsDe(projectId);
  return runs.some(
    (r) =>
      r.localObservationDate === localObservationDate &&
      r.triggerType === TIPOS_DISPARO.NORMAL_DAILY_RUN &&
      (r.status === ESTADOS_RUN.SUCCESS || r.status === ESTADOS_RUN.PARTIAL)
  );
}

/*
  Enrollment dinamico: SIEMPRE se resuelve desde el store, nunca
  desde una lista fija. `activo !== false` es deliberado: el campo
  no existe hoy en ningun candidato, asi que todos son elegibles
  por defecto; el dia que se agregue un campo de desactivacion,
  este filtro ya lo respeta sin tocar este archivo.
*/
export async function resolverCandidatosActivos(projectId) {
  const contenido = await contenidoDeProyecto(projectId);
  if (!contenido) return [];
  return (contenido.candidatos || []).filter((c) => c.activo !== false);
}

/*
  Presupuesto real, no solo declarado: antes de lanzar la
  coleccion se cuenta cuantos activos (cuentas ya consolidadas)
  tiene cada candidato en las plataformas que va a tocar esta
  corrida, y si la suma excede `maxRequestsPerRun` se recorta la
  lista de candidatos -de forma greedy, candidato completo o
  ninguno- para no dejar a un candidato con solo parte de sus
  activos medidos en la misma corrida.
*/
export async function estimarActivosPorCandidato(projectId, candidatoId, plataformas) {
  const ficha = await fichaIdentidad(projectId, candidatoId, "candidato");
  if (!ficha) return 0;
  return ficha.plataformas.filter((p) => plataformas.includes(p.plataformaId)).reduce((n, p) => n + (p.cuentas || []).length, 0);
}

export async function aplicarPresupuesto(projectId, candidatosActivos, plataformas, maxRequestsPerRun) {
  let acumulado = 0;
  const admitidos = [];
  const excluidosPorPresupuesto = [];
  for (const cand of candidatosActivos) {
    const activosCand = await estimarActivosPorCandidato(projectId, cand.id, plataformas);
    if (acumulado + activosCand <= maxRequestsPerRun) {
      admitidos.push(cand);
      acumulado += activosCand;
    } else {
      excluidosPorPresupuesto.push(cand.id);
    }
  }
  return { admitidos, excluidosPorPresupuesto, activosEstimados: acumulado };
}

/*
===========================================================
EJECUTAR UNA OBSERVACION (diaria automatica o manual forzada)
===========================================================
*/
export async function ejecutarObservacionDiaria(projectId, opciones = {}) {
  const {
    ahora = new Date(),
    timezone = TIMEZONE_OPERACIONAL,
    triggerType = TIPOS_DISPARO.NORMAL_DAILY_RUN,
    forzar = false,
    proveedorInstagram = null,
    proveedorFacebook = null,
    maxRequestsPerRun = 500,
    maxProviderCreditsPerRun = 0
  } = opciones;

  const localObservationDate = fechaLocalObservacion(ahora, timezone);
  const collectionRunId = `run-${projectId}-${localObservationDate}-${ahora.getTime()}`;
  const startedAt = ahora.toISOString();

  /*
    Cuerpo real de la observacion -- identico, sin ningun cambio de
    logica, al que existia antes de este gate. Se convierte en una
    funcion interna (closure sobre las variables de arriba) unicamente
    para poder envolverla, o no, con el lock distribuido segun el
    adaptador activo, sin duplicar una sola linea de la logica de
    Candidate. SENTINEL-HISTORICAL-CLOUD-01 (lock distribuido, Opcion A).
  */
  async function cuerpoDeLaObservacion() {
  if (triggerType === TIPOS_DISPARO.NORMAL_DAILY_RUN && !forzar) {
    const yaHecho = await yaSeColectoHoy(projectId, localObservationDate);
    if (yaHecho) {
      return {
        collectionRunId,
        projectId,
        startedAt,
        completedAt: new Date().toISOString(),
        localObservationDate,
        triggerType,
        status: ESTADOS_RUN.SKIPPED_ALREADY_COLLECTED,
        candidatesPlanned: 0,
        candidatesObserved: 0,
        requestsUsed: 0,
        creditsUsed: 0
      };
    }
  }

  const candidatosActivos = await resolverCandidatosActivos(projectId);
  const plataformasDeEstaCorrida = PLATAFORMAS_COLECCION.filter((p) => p !== "tiktok"); // TikTok no tiene rama oficial en observarCandidato, deuda ya documentada

  /*
    Presupuesto de proveedor: la corrida NORMAL nunca lo activa,
    sin importar lo que llegue en opciones -blindaje explicito,
    seccion 25 del gate-.
  */
  const proveedorInstagramEfectivo =
    triggerType === TIPOS_DISPARO.FORCED_MANUAL_RUN && maxProviderCreditsPerRun > 0 ? proveedorInstagram : null;
  const proveedorFacebookEfectivo =
    triggerType === TIPOS_DISPARO.FORCED_MANUAL_RUN && maxProviderCreditsPerRun > 0 ? proveedorFacebook : null;

  /*
    Presupuesto de requests: se recorta ANTES de llamar al
    proveedor, nunca a mitad de camino -asi nunca se paga por un
    candidato a medias-.
  */
  const { admitidos: candidatosDentroDePresupuesto, excluidosPorPresupuesto } = await aplicarPresupuesto(
    projectId,
    candidatosActivos,
    plataformasDeEstaCorrida,
    maxRequestsPerRun
  );

  let resultadoColeccion;
  let errorColeccion = null;
  try {
    resultadoColeccion = await collectCandidateSnapshots(projectId, {
      plataformas: plataformasDeEstaCorrida,
      proveedorInstagram: proveedorInstagramEfectivo,
      proveedorFacebook: proveedorFacebookEfectivo,
      conflictosConocidos: CONFLICTOS_CONOCIDOS,
      candidatosFiltro: candidatosDentroDePresupuesto.map((c) => c.id)
    });
  } catch (e) {
    errorColeccion = e?.message || "fallo no clasificado en la coleccion";
    resultadoColeccion = null;
  }

  const completedAt = new Date().toISOString();

  const platformsAttempted = resultadoColeccion
    ? Object.entries(resultadoColeccion.porPlataforma).filter(([, v]) => v.assetsAttempted > 0).map(([p]) => p)
    : [];
  const platformsSucceeded = resultadoColeccion
    ? Object.entries(resultadoColeccion.porPlataforma).filter(([, v]) => v.assetsMeasured > 0 && v.assetsFailed === 0).map(([p]) => p)
    : [];
  const platformsPartial = resultadoColeccion
    ? Object.entries(resultadoColeccion.porPlataforma).filter(([, v]) => v.assetsMeasured > 0 && v.assetsFailed > 0).map(([p]) => p)
    : [];
  const platformsFailed = resultadoColeccion
    ? Object.entries(resultadoColeccion.porPlataforma).filter(([, v]) => v.assetsMeasured === 0 && v.assetsFailed > 0).map(([p]) => p)
    : [];

  let status;
  if (errorColeccion) status = ESTADOS_RUN.FAILED;
  else if (resultadoColeccion.assetsFailed > 0 || resultadoColeccion.assetsAttempted === 0 || excluidosPorPresupuesto.length > 0)
    status = ESTADOS_RUN.PARTIAL;
  else status = ESTADOS_RUN.SUCCESS;

  const perCandidato = resultadoColeccion
    ? resultadoColeccion.candidatos.map((c) => ({
        candidateId: c.candidatoId,
        candidateName: candidatosActivos.find((cc) => cc.id === c.candidatoId)?.nombre || c.candidatoId,
        plannedAssets: (c.resultadosPorActivo || []).length,
        observedAssets: (c.resultadosPorActivo || []).filter((a) => a.categoria === "MEASURED").length,
        successfulPlatforms: [...new Set((c.resultadosPorActivo || []).filter((a) => a.categoria === "MEASURED").map((a) => a.plataformaId))],
        partialPlatforms: [],
        failedPlatforms: [...new Set((c.resultadosPorActivo || []).filter((a) => a.categoria === "PROVIDER_ERROR" || a.categoria === "OFFICIAL_ERROR").map((a) => a.plataformaId))],
        identityInsufficientPlatforms: [...new Set((c.resultadosPorActivo || []).filter((a) => a.categoria === "SKIPPED_IDENTITY_INSUFFICIENT").map((a) => a.plataformaId))],
        identityConflictPlatforms: [...new Set((c.resultadosPorActivo || []).filter((a) => a.categoria === "SKIPPED_IDENTITY_CONFLICT").map((a) => a.plataformaId))],
        error: c.error || null
      }))
    : [];

  const run = {
    collectionRunId,
    projectId,
    startedAt,
    completedAt,
    localObservationDate,
    triggerType,
    status,
    candidatesPlanned: candidatosActivos.length,
    candidatesWithinBudget: candidatosDentroDePresupuesto.length,
    candidatesExcludedByBudget: excluidosPorPresupuesto,
    candidatesObserved: resultadoColeccion?.candidatesMeasured ?? 0,
    assetsPlanned: resultadoColeccion?.assetsAttempted ?? 0,
    assetsObserved: resultadoColeccion?.assetsMeasured ?? 0,
    platformsAttempted,
    platformsSucceeded,
    platformsPartial,
    platformsFailed,
    requestsUsed: resultadoColeccion?.assetsAttempted ?? 0,
    maxRequestsPerRun,
    maxProviderCreditsPerRun,
    creditsUsed: proveedorInstagramEfectivo || proveedorFacebookEfectivo ? null : 0,
    providerBreakdown: resultadoColeccion?.porPlataforma ?? {},
    errors: errorColeccion ? [errorColeccion] : [],
    limitations: [
      "TikTok no tiene rama oficial en observarCandidato: no participa en la observacion automatica diaria (deuda ya documentada en P-CAND-OPERATIONAL-CLOSURE-01)",
      triggerType === TIPOS_DISPARO.NORMAL_DAILY_RUN
        ? "corrida automatica: proveedor de pago deshabilitado por diseno, solo vias oficiales gratuitas"
        : "corrida manual forzada",
      ...(excluidosPorPresupuesto.length > 0
        ? [`BUDGET_EXHAUSTED: ${excluidosPorPresupuesto.length} candidato(s) quedaron fuera de esta corrida por presupuesto de requests (maxRequestsPerRun=${maxRequestsPerRun}); se completo con los colectores gratuitos dentro del presupuesto y se reintentaran en la proxima corrida`]
        : [])
    ],
    methodVersion: IPDO_METHOD_VERSION,
    perCandidato,
    capturedAt: startedAt
  };

  await guardarCollectionRun(projectId, run);

  /* ---------- OBSERVACION IPDO + RANKING, SOLO SI HAY UNIVERSO COMPARABLE ---------- */
  let ipdoObservado = false;
  if (status !== ESTADOS_RUN.FAILED && candidatosActivos.length >= 2) {
    try {
      const filasIpdo = [];
      for (const cand of candidatosActivos) {
        const ficha = await fichaIdentidad(projectId, cand.id, "candidato");
        if (!ficha) continue;
        const snapshots = (await snapshotsDe(projectId, cand.id)) || [];
        const pubsSerie = await publicacionesDe(projectId, cand.id);
        const evid = await evidenciasDe(projectId, cand.id);
        const cuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);
        const amplificacion = amplificacionDeCandidato({ evidencias: evid.evidencias, cuentas });
        const conversacion = separarConversacion({ evidencias: evid.evidencias, cuentas });
        filasIpdo.push(
          extraerInsumosCandidato({
            candidateId: cand.id,
            ficha,
            snapshots,
            publicaciones: pubsSerie.publicaciones,
            amplificacion,
            conversacion,
            conflictosConocidos: CONFLICTOS_CONOCIDOS
          })
        );
      }

      const ipdo = calcularIPDO(filasIpdo);
      if (ipdo.estado === "OK") {
        const universeCandidateIds = candidatosActivos.map((c) => c.id);
        const observedAt = completedAt;

        for (const resultado of ipdo.resultados) {
          await guardarObservacionIPDO(projectId, {
            ipdoObservationId: `ipdoobs-${resultado.candidateId}-${observedAt}`,
            collectionRunId,
            projectId,
            candidateId: resultado.candidateId,
            observedAt,
            localObservationDate,
            score: resultado.score,
            dimensionScores: resultado.dimensions,
            methodologicalCoverage: resultado.methodologicalCoverage,
            methodVersion: IPDO_METHOD_VERSION,
            universeCandidateIds,
            universeSize: universeCandidateIds.length,
            capturedAt: observedAt
          });
        }

        const ranking = [...ipdo.resultados].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
        await guardarRankingSnapshot(projectId, {
          rankingSnapshotId: `rankingsnap-${collectionRunId}`,
          collectionRunId,
          projectId,
          observedAt,
          localObservationDate,
          methodVersion: IPDO_METHOD_VERSION,
          universeCandidateIds,
          universeSize: universeCandidateIds.length,
          candidatePositions: ranking.map((r, i) => ({ position: i + 1, candidateId: r.candidateId, score: r.score })),
          coverage: Object.fromEntries(ranking.map((r) => [r.candidateId, r.methodologicalCoverage])),
          capturedAt: observedAt
        });

        ipdoObservado = true;
      }
    } catch {
      /* Un fallo al calcular IPDO no invalida la corrida de recoleccion ya persistida. */
    }
  }

  return { ...run, ipdoObservado };
  } // fin cuerpoDeLaObservacion()

  /*
    Lock distribuido: SOLO para NORMAL_DAILY_RUN no forzado, y SOLO
    cuando el adaptador activo del Lake es Postgres real. Con
    `fichero`/`memoria` (desarrollo local sin Postgres) el
    comportamiento es EXACTAMENTE igual al de antes de este gate:
    sin lock de base de datos, protegido solo por yaSeColectoHoy
    (dentro de cuerpoDeLaObservacion). Una corrida FORCED_MANUAL_RUN
    tampoco usa el lock -no compite por "el dia", es una intencion
    explicita distinta, igual que ya distinguia el diseno existente.
  */
  const debeUsarLockDistribuido =
    triggerType === TIPOS_DISPARO.NORMAL_DAILY_RUN &&
    !forzar &&
    process.env.SENTINEL_LAKE_ADAPTER === "postgres";

  if (!debeUsarLockDistribuido) {
    return cuerpoDeLaObservacion();
  }

  const pool = obtenerPoolLockCompartido();
  const { ejecutado, resultado } = await conLockDiario(
    pool,
    projectId,
    localObservationDate,
    cuerpoDeLaObservacion
  );

  if (!ejecutado) {
    /*
      Otro worker ya tiene el lock de este projectId+fecha operativa
      en este instante. NO se llamo a resolverCandidatosActivos, NI
      a aplicarPresupuesto, NI a collectCandidateSnapshots -el lock
      se adquiere antes de cualquiera de esos, por eso
      cuerpoDeLaObservacion() ni siquiera empieza a ejecutarse-.
      Esto no es un fallo operativo: es la proteccion funcionando
      como se diseno. SKIPPED_LOCKED es un estado propio, distinto
      de FAILED y de SKIPPED_ALREADY_COLLECTED.
    */
    return {
      collectionRunId,
      projectId,
      startedAt,
      completedAt: new Date().toISOString(),
      localObservationDate,
      triggerType,
      status: ESTADOS_RUN.SKIPPED_LOCKED,
      candidatesPlanned: 0,
      candidatesObserved: 0,
      requestsUsed: 0,
      creditsUsed: 0,
      limitations: [
        "otro worker ya tenia el lock distribuido (projectId + fecha operativa) en este instante; no se llamo a ningun collector ni proveedor"
      ]
    };
  }

  return resultado;
}

/*
===========================================================
SCHEDULER EN PROCESO
===========================================================

Un `setInterval` real. Se puede detener (`detenerScheduler`) y
consultar (`estadoDelScheduler`). Deshabilitado por completo en
modo test -seccion 65 del gate-: cualquier suite que necesite
probarlo inyecta su propio reloj y llama
`ejecutarObservacionDiaria` directamente, nunca arranca el
`setInterval` real.
===========================================================
*/
const schedulers = new Map();

export function iniciarScheduler(projectId, opciones = {}) {
  const {
    intervaloDeChequeoMs = 30 * 60 * 1000,
    horaDisparoLocal = 6,
    timezone = TIMEZONE_OPERACIONAL
  } = opciones;

  if (schedulers.has(projectId)) return schedulers.get(projectId).estado();

  const estado = {
    projectId,
    activo: true,
    lastRunAt: null,
    lastRunStatus: null,
    nextCheckAt: null,
    historyStartAt: null,
    errores: []
  };

  const tick = async () => {
    if (!estado.activo) return;
    try {
      const ahora = new Date();
      const horaLocal = Number(
        new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", hour12: false }).format(ahora)
      );
      if (horaLocal < horaDisparoLocal) return;

      const localObservationDate = fechaLocalObservacion(ahora, timezone);
      const yaHecho = await yaSeColectoHoy(projectId, localObservationDate);
      if (yaHecho) return;

      const run = await ejecutarObservacionDiaria(projectId, { ahora, timezone });
      estado.lastRunAt = run.completedAt;
      estado.lastRunStatus = run.status;
      if (!estado.historyStartAt) estado.historyStartAt = run.startedAt;
    } catch (e) {
      estado.errores.push({ at: new Date().toISOString(), motivo: e?.message || "error no clasificado" });
    }
  };

  const timer = setInterval(tick, intervaloDeChequeoMs);
  // Chequeo inmediato al iniciar -seccion 19 del gate: recuperar una observacion pendiente tras un restart-.
  tick();

  const controlador = {
    detener() {
      clearInterval(timer);
      estado.activo = false;
      schedulers.delete(projectId);
    },
    estado() {
      return { ...estado, nextCheckAt: new Date(Date.now() + intervaloDeChequeoMs).toISOString() };
    }
  };

  schedulers.set(projectId, controlador);
  return controlador.estado();
}

export function detenerScheduler(projectId) {
  const s = schedulers.get(projectId);
  if (!s) return { detenido: false, motivo: "no habia scheduler activo para este proyecto" };
  s.detener();
  return { detenido: true };
}

export function estadoDelScheduler(projectId) {
  const s = schedulers.get(projectId);
  if (!s) return { projectId, schedulerStatus: "INACTIVO" };
  return { projectId, schedulerStatus: "ACTIVO", ...s.estado() };
}

/*
===========================================================
SCHEDULER GLOBAL — sin proyecto hardcodeado
===========================================================

Igual que el enrollment de candidatos nunca hardcodea un
candidateId, esto nunca hardcodea `alcaldia-cuenca-2027-piloto`.
Cada `intervaloDeDescubrimientoMs` vuelve a llamar
`listarProyectos()` (proyectos con estado ACTIVO) y arranca un
scheduler por-proyecto para cualquiera que todavia no lo tenga —
un proyecto nuevo creado despues de este arranque entra solo, sin
reiniciar el backend.
===========================================================
*/
let descubrimientoTimer = null;

export async function iniciarSchedulerGlobal(opciones = {}) {
  const { intervaloDeDescubrimientoMs = 15 * 60 * 1000, ...opcionesPorProyecto } = opciones;

  const descubrir = async () => {
    const proyectos = await listarProyectos();
    for (const p of proyectos) {
      if (!schedulers.has(p.id)) iniciarScheduler(p.id, opcionesPorProyecto);
    }
  };

  await descubrir();
  if (!descubrimientoTimer) descubrimientoTimer = setInterval(descubrir, intervaloDeDescubrimientoMs);

  return estadoDelSchedulerGlobal();
}

export function detenerSchedulerGlobal() {
  if (descubrimientoTimer) {
    clearInterval(descubrimientoTimer);
    descubrimientoTimer = null;
  }
  const proyectosDetenidos = [...schedulers.keys()];
  for (const projectId of proyectosDetenidos) detenerScheduler(projectId);
  return { detenido: true, proyectosDetenidos };
}

export function estadoDelSchedulerGlobal() {
  return {
    descubrimientoActivo: descubrimientoTimer !== null,
    proyectosConSchedulerActivo: [...schedulers.keys()],
    estadoPorProyecto: Object.fromEntries([...schedulers.keys()].map((pid) => [pid, estadoDelScheduler(pid)]))
  };
}

export default {
  TIMEZONE_OPERACIONAL,
  TIPOS_DISPARO,
  ESTADOS_RUN,
  fechaLocalObservacion,
  yaSeColectoHoy,
  resolverCandidatosActivos,
  ejecutarObservacionDiaria,
  iniciarScheduler,
  detenerScheduler,
  estadoDelScheduler,
  iniciarSchedulerGlobal,
  detenerSchedulerGlobal,
  estadoDelSchedulerGlobal
};
