/*
===========================================================
CANDIDATE SNAPSHOT COLLECTION — P-CAND-SNAPSHOT-COLLECTION-01
===========================================================

Convierte la observacion de UN candidato (ya construida en gates
anteriores: `observarCandidato` + fallback de proveedor + snapshot
generico de proveedor, todo ya probado y en produccion desde
`P-CAND-SNAPSHOTS-01`) en una operacion REPETIBLE a nivel de
PROYECTO. No es un motor nuevo: es la MISMA orquestacion que ya
vive inline en `POST /:proyectoId/candidatos/:candidatoId/observar`
(routes/projects.js), extraida a una funcion reutilizable para que
un recorrido de N candidatos no tenga que reimplementar el
contexto Meta, el inventario de activos ni la persistencia.

`routes/projects.js` sigue siendo el contrato HTTP publico y NO se
modifico su forma de respuesta -esta funcion es una extraccion,
no un reemplazo-.

===========================================================
POR QUE NO SE UNIFICO CON /inteligencia
===========================================================

`P-CAND-SNAPSHOTS-01` encontro que existe un SEGUNDO motor de
observacion (`accountIntelligence.js#observarCuentasDelCandidato`,
usado por `POST /:proyectoId/candidatos/:candidatoId/inteligencia`)
que persiste snapshots oficiales de una forma distinta y con su
propio presupuesto de peticiones. Unificar ambos motores es un
cambio arquitectonico mayor -decidir cual es la fuente de verdad
para observaciones oficiales- y queda **fuera de alcance de este
gate**, documentado como pendiente en
`docs/P-CAND-SNAPSHOT-COLLECTION-01.md`.
*/

import { observarCandidato } from "./candidateObservation.js";
import { contextoMetaDeObservacion } from "./metaObservationContext.js";
import { activosDeCandidato } from "./candidateAssets.js";
import { resolverIdentidadCanonica } from "./accountIdentity.js";
import { identidadDeCuenta, IDENTITY_STATES } from "./socialBenchmarkMatrix.js";
import {
  fichaIdentidad,
  declaracionesDeTipoDe,
  guardarSnapshots,
  guardarPublicaciones,
  contenidoDeProyecto
} from "../projects/projectStore.js";

export const PLATAFORMAS_COLECCION = ["facebook", "instagram", "tiktok", "x", "youtube"];

/*
  Taxonomia de resultado por ACTIVO. Reutiliza literalmente los
  estados ya definidos en `ESTADOS_OBSERVACION_REAL`
  (candidateObservation.js) -no se crea una taxonomia paralela-,
  solo se les da una categoria de alto nivel para el resumen de la
  corrida. `PROVIDER_ERROR` y los `SKIPPED_*` son las unicas
  categorias que no existian ya como estado de observacion, porque
  describen una decision de la CORRIDA (no llamar, o el proveedor
  fallo), no un estado de la cuenta en si.
*/
export const CATEGORIAS_RESULTADO = Object.freeze({
  MEASURED: "MEASURED",
  SKIPPED_NO_ACCOUNT: "SKIPPED_NO_ACCOUNT",
  SKIPPED_IDENTITY_CONFLICT: "SKIPPED_IDENTITY_CONFLICT",
  SKIPPED_IDENTITY_INSUFFICIENT: "SKIPPED_IDENTITY_INSUFFICIENT",
  REQUIRES_CREDENTIAL: "REQUIRES_CREDENTIAL",
  REQUIRES_PROVIDER: "REQUIRES_PROVIDER",
  BLOCKED: "BLOCKED",
  UNSUPPORTED: "UNSUPPORTED",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  OFFICIAL_ERROR: "OFFICIAL_ERROR"
});

const ESTADOS_MEDIDOS = new Set([
  "OBSERVADA",
  "SIN_PUBLICACIONES",
  "MEDIDO_PROVEEDOR",
  "MEDIDO_OFICIAL",
  "MEDIDO_PROPIO_AUTORIZADO"
]);

/*
  Clasifica el resultado de UN activo ya observado. `identityState`
  se calcula ANTES de observar (seccion 3 del gate: identidad antes
  de medicion) y aqui solo decide la categoria de reporte -la
  exclusion real de un IDENTITY_CONFLICT ocurre antes de llamar,
  en `activosElegibles()`, nunca aqui-.
*/
export function categoriaDeResultado(resultado = {}, { identityState = null } = {}) {
  if (identityState === IDENTITY_STATES.IDENTITY_CONFLICT) {
    return CATEGORIAS_RESULTADO.SKIPPED_IDENTITY_CONFLICT;
  }

  if (resultado.proveedorError) {
    return CATEGORIAS_RESULTADO.PROVIDER_ERROR;
  }

  const estado = resultado.estado;

  if (ESTADOS_MEDIDOS.has(estado)) return CATEGORIAS_RESULTADO.MEASURED;

  if (estado === "CUENTA_NO_RESUELTA") return CATEGORIAS_RESULTADO.SKIPPED_NO_ACCOUNT;

  /*
    NO_SOPORTADO_PERSONAL (Instagram personal) y REQUIERE_PPCA
    (Facebook de tercero sin Page Public Content Access) son la
    MISMA figura para efectos de la corrida: la via oficial no
    alcanza, pero el proveedor si podria -P-CAND-OPERATIONAL-
    CLOSURE-01-. PPCA nunca se trata como "sin cuenta": la Pagina
    existe, la via esta cerrada por una aprobacion pendiente.
  */
  if (estado === "NO_SOPORTADO_PERSONAL" || estado === "REQUIERE_PPCA") {
    /*
      Identidad DISCOVERED (no analista, no corroborada por
      Sentinel) y la unica via que queda es un proveedor de pago:
      no se gasta credito en una identidad debil. Seccion 8/10 del
      gate: "no gastar en activos sin identidad suficiente".
    */
    if (identityState === IDENTITY_STATES.DISCOVERED) {
      return CATEGORIAS_RESULTADO.SKIPPED_IDENTITY_INSUFFICIENT;
    }
    return CATEGORIAS_RESULTADO.REQUIRES_PROVIDER;
  }

  if (estado === "CAPACIDAD_NO_DISPONIBLE") return CATEGORIAS_RESULTADO.UNSUPPORTED;

  if (estado === "NO_EJECUTABLE") return CATEGORIAS_RESULTADO.BLOCKED;

  if (
    estado === "CREDENCIAL_RECHAZADA" ||
    estado === "CREDENCIAL_EXPIRADA" ||
    estado === "PERMISOS_INSUFICIENTES"
  ) {
    return CATEGORIAS_RESULTADO.REQUIRES_CREDENTIAL;
  }

  /*
    CUOTA_AGOTADA, BILLING_BLOQUEADO, ERROR, y cualquier estado no
    contemplado: fallo del lado oficial, nunca "no sabemos" -se
    devuelve explicito, no null-.
  */
  return CATEGORIAS_RESULTADO.OFFICIAL_ERROR;
}

/*
  Identidad de cada cuenta consolidada, ANTES de decidir si se
  observa. Reutiliza `identidadDeCuenta` de
  `socialBenchmarkMatrix.js` (P-CAND-SOCIAL-BENCH-02A) -misma
  regla ANALYST_CONFIRMED/SYSTEM_VERIFIED/DISCOVERED/
  IDENTITY_CONFLICT, no una segunda taxonomia-.
*/
function identidadesPorActivo(ficha, conflictosConocidos) {
  const mapa = new Map();
  for (const bloque of ficha.plataformas || []) {
    for (const c of bloque.cuentas || []) {
      const estado = conflictosConocidos.has(resolverIdentidadCanonica(c.id))
        ? IDENTITY_STATES.IDENTITY_CONFLICT
        : identidadDeCuenta(c);
      mapa.set(c.id, estado);
    }
  }
  return mapa;
}

/*
  Observa y persiste UN candidato. Misma orquestacion que
  `routes/projects.js#POST /observar`: ficha -> cuentas ->
  contexto Meta -> tipos declarados -> observarCandidato ->
  snapshot generico de proveedor -> publicaciones. Los activos en
  `conflictosConocidos` se filtran ANTES de llamar
  `observarCandidato` -nunca se les hace ni una peticion, oficial
  o de proveedor-.
*/
export async function observarYPersistirCandidato(proyectoId, candidatoId, opciones = {}) {
  const {
    plataformas = PLATAFORMAS_COLECCION,
    maximoPublicaciones = 5,
    proveedorInstagram = null,
    proveedorFacebook = null,
    conflictosConocidos = new Set(),
    fetchImpl
  } = opciones;

  const ficha = await fichaIdentidad(proyectoId, candidatoId, "candidato");

  if (!ficha) {
    return { candidatoId, error: `no existe el candidato ${candidatoId}`, resultadosPorActivo: [] };
  }

  const identidades = identidadesPorActivo(ficha, conflictosConocidos);

  const todasLasCuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);

  /*
    Activos con IDENTITY_CONFLICT se retiran ANTES de construir
    `cuentas` para `observarCandidato`: no reciben ninguna
    peticion, oficial ni de proveedor. Seccion 3 del gate.
  */
  const cuentasElegibles = todasLasCuentas.filter(
    (c) => identidades.get(c.id) !== IDENTITY_STATES.IDENTITY_CONFLICT
  );
  const cuentasExcluidas = todasLasCuentas.filter(
    (c) => identidades.get(c.id) === IDENTITY_STATES.IDENTITY_CONFLICT
  );

  const contextoMeta = await contextoMetaDeObservacion({ plataformas });

  const tipos = await declaracionesDeTipoDe(proyectoId, candidatoId);

  const inventario = activosDeCandidato({
    candidateId: candidatoId,
    cuentas: cuentasElegibles,
    declaraciones: tipos.declaraciones
  });

  const tiposDeActivo = {};
  (inventario.activos || []).forEach((a) => {
    if (a.accountId) tiposDeActivo[a.accountId] = a.assetType;
  });

  const r = await observarCandidato({
    candidateId: candidatoId,
    projectId: proyectoId,
    cuentas: cuentasElegibles,
    maximoPublicaciones,
    plataformas,
    idParaBusinessDiscovery: contextoMeta.idParaBusinessDiscovery,
    cuentasPropias: contextoMeta.cuentasPropias,
    paginasPropias: contextoMeta.paginasPropias || [],
    tiposDeActivo,
    proveedorInstagram,
    proveedorFacebook,
    fetchImpl
  });

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
        "persistido por la colección repetible (P-CAND-SNAPSHOT-COLLECTION-01)"
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

    snapshotsDeProveedorGuardados = await guardarSnapshots(proyectoId, candidatoId, snapshotsDeCuenta);
  }

  let publicacionesGuardadas = null;
  if (r.publicaciones.length) {
    const proveedores = [...new Set(r.publicaciones.map((p) => p.provider).filter(Boolean))];
    publicacionesGuardadas = await guardarPublicaciones(proyectoId, candidatoId, r.publicaciones, {
      observadoEn: r.observedAt,
      provider: proveedores.length === 1 ? proveedores[0] : proveedores.join("+")
    });
  }

  const resultadosPorActivo = [
    ...r.resultados.map((x) => ({
      accountId: x.accountId,
      plataformaId: x.plataformaId,
      identityState: identidades.get(x.accountId) || IDENTITY_STATES.NO_ASSET_CONFIRMED,
      categoria: categoriaDeResultado(x, { identityState: identidades.get(x.accountId) }),
      estado: x.estado
    })),
    ...cuentasExcluidas.map((c) => ({
      accountId: c.id,
      plataformaId: c.plataformaId,
      identityState: IDENTITY_STATES.IDENTITY_CONFLICT,
      categoria: CATEGORIAS_RESULTADO.SKIPPED_IDENTITY_CONFLICT,
      estado: null
    }))
  ];

  return {
    candidatoId,
    observedAt: r.observedAt,
    resultados: r.resultados,
    resultadosPorActivo,
    snapshotsDeProveedorGuardados,
    publicacionesGuardadas,
    resumen: r.resumen
  };
}

/*
  Recorre TODOS los candidatos de un proyecto y observa+persiste
  cada uno. Devuelve un resumen estructurado -nunca porcentajes
  inventados, solo conteos reales-.
*/
export async function collectCandidateSnapshots(projectId, opciones = {}) {
  const {
    plataformas = PLATAFORMAS_COLECCION,
    maximoPublicaciones = 5,
    proveedorInstagram = null,
    proveedorFacebook = null,
    conflictosConocidos = new Set(),
    candidatosFiltro = null,
    fetchImpl
  } = opciones;

  const runId = `run-${projectId}-${Date.now()}`;
  const startedAt = new Date().toISOString();

  const contenido = await contenidoDeProyecto(projectId);

  if (!contenido) {
    return {
      runId,
      projectId,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: `no existe el proyecto ${projectId}`,
      candidatesAttempted: 0,
      candidatesMeasured: 0,
      assetsAttempted: 0,
      assetsMeasured: 0,
      assetsSkipped: 0,
      assetsFailed: 0,
      snapshotsCreated: 0,
      porPlataforma: {},
      candidatos: []
    };
  }

  const candidatosDelProyecto = (contenido.candidatos || []).filter(
    (c) => !candidatosFiltro || candidatosFiltro.includes(c.id)
  );

  const porCandidato = [];
  const porPlataforma = Object.fromEntries(PLATAFORMAS_COLECCION.map((p) => [p, {
    assetsAttempted: 0, assetsMeasured: 0, assetsSkipped: 0, assetsFailed: 0, snapshotsCreated: 0
  }]));

  let assetsAttempted = 0;
  let assetsMeasured = 0;
  let assetsSkipped = 0;
  let assetsFailed = 0;
  let snapshotsCreated = 0;
  let candidatesMeasured = 0;

  const CATEGORIAS_SKIP = new Set([
    CATEGORIAS_RESULTADO.SKIPPED_NO_ACCOUNT,
    CATEGORIAS_RESULTADO.SKIPPED_IDENTITY_CONFLICT,
    CATEGORIAS_RESULTADO.SKIPPED_IDENTITY_INSUFFICIENT,
    CATEGORIAS_RESULTADO.REQUIRES_PROVIDER,
    CATEGORIAS_RESULTADO.UNSUPPORTED,
    CATEGORIAS_RESULTADO.BLOCKED,
    CATEGORIAS_RESULTADO.REQUIRES_CREDENTIAL
  ]);
  const CATEGORIAS_FALLO = new Set([
    CATEGORIAS_RESULTADO.PROVIDER_ERROR,
    CATEGORIAS_RESULTADO.OFFICIAL_ERROR
  ]);

  for (const candidato of candidatosDelProyecto) {
    const r = await observarYPersistirCandidato(projectId, candidato.id, {
      plataformas,
      maximoPublicaciones,
      proveedorInstagram,
      proveedorFacebook,
      conflictosConocidos,
      fetchImpl
    });

    let candidatoMedidoAlgo = false;

    for (const activo of r.resultadosPorActivo || []) {
      assetsAttempted += 1;
      const bucket = porPlataforma[activo.plataformaId];
      if (bucket) bucket.assetsAttempted += 1;

      if (activo.categoria === CATEGORIAS_RESULTADO.MEASURED) {
        assetsMeasured += 1;
        candidatoMedidoAlgo = true;
        if (bucket) bucket.assetsMeasured += 1;
      } else if (CATEGORIAS_FALLO.has(activo.categoria)) {
        assetsFailed += 1;
        if (bucket) bucket.assetsFailed += 1;
      } else if (CATEGORIAS_SKIP.has(activo.categoria)) {
        assetsSkipped += 1;
        if (bucket) bucket.assetsSkipped += 1;
      }
    }

    const nuevosSnapshots = r.snapshotsDeProveedorGuardados?.total || 0;
    snapshotsCreated += nuevosSnapshots;
    if (nuevosSnapshots > 0) {
      for (const activo of r.resultadosPorActivo || []) {
        if (activo.categoria === CATEGORIAS_RESULTADO.MEASURED && activo.estado === "MEDIDO_PROVEEDOR") {
          const bucket = porPlataforma[activo.plataformaId];
          if (bucket) bucket.snapshotsCreated += 1;
        }
      }
    }

    if (candidatoMedidoAlgo) candidatesMeasured += 1;

    porCandidato.push({
      candidatoId: candidato.id,
      error: r.error || null,
      resultadosPorActivo: r.resultadosPorActivo
    });
  }

  return {
    runId,
    projectId,
    startedAt,
    finishedAt: new Date().toISOString(),
    candidatesAttempted: candidatosDelProyecto.length,
    candidatesMeasured,
    assetsAttempted,
    assetsMeasured,
    assetsSkipped,
    assetsFailed,
    snapshotsCreated,
    porPlataforma,
    candidatos: porCandidato
  };
}
