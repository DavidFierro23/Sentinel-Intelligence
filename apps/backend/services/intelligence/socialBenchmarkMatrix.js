/*
===========================================================
SOCIAL BENCHMARK MATRIX — P-CAND-SOCIAL-BENCH-02
===========================================================

Clasifica, celda por celda (candidato x plataforma), el estado
REAL de cobertura de datos usando solo lo ya persistido: activos
declarados, su elegibilidad, y los snapshots existentes. Nunca
hace una peticion de red.

La regla dura del gate: NINGUNA celda puede quedar "no sabemos".
Toda celda recibe uno de los estados de ESTADOS_CELDA. Si la
evidencia es insuficiente para decidir SIN_CUENTA, se declara
explicitamente esa insuficiencia -no se inventa una cuenta
ausente ni se calla el vacio.
*/

export const PLATAFORMAS_BENCHMARK = ["facebook", "instagram", "tiktok", "x", "youtube"];

export const ESTADOS_CELDA = {
  MEDIDO: "MEDIDO",
  PARCIAL: "PARCIAL",
  REQUIERE_PROVEEDOR: "REQUIERE_PROVEEDOR",
  SIN_CUENTA: "SIN_CUENTA",
  NO_PROBADO: "NO_PROBADO",
  NO_PROBADO_SIN_REFERENCIA: "NO_PROBADO_SIN_REFERENCIA",
  BLOQUEADO: "BLOQUEADO"
};

const ESTADOS_MEDICION_REAL = new Set([
  "OBSERVADA",
  "MEDIDO_OFICIAL",
  "MEDIDO_PROPIO_AUTORIZADO",
  "MEDIDO_PROVEEDOR"
]);

const ELEGIBLE_FALLBACK_PROVEEDOR = new Set([
  "NO_ELEGIBLE_META_OFICIAL_TERCEROS"
]);

/*
  Un activo cuenta como "cubierto" cuando existe al menos un
  snapshot suyo (por accountId, nunca por candidato+plataforma)
  con un estado de medicion real. Los snapshots identity-only
  (p. ej. tiktok_oembed / CUENTA_CONFIRMADA) NO cuentan como
  medicion de metricas -confirman identidad, no metrica-.
*/
function activoCubierto(accountId, snapshots) {
  return snapshots.some(
    (s) => s.accountId === accountId && ESTADOS_MEDICION_REAL.has(s.estado)
  );
}

function activoTieneIdentidadConfirmada(accountId, snapshots) {
  return snapshots.some(
    (s) => s.accountId === accountId && s.estado === "CUENTA_CONFIRMADA"
  );
}

/*
  Clasifica una celda candidato x plataforma.

  entrada:
    activos: [{ accountId, tipoActivo, elegibilidad }]
    snapshots: [{ accountId, estado, provider, followers }]
    discoveryConfirmada: boolean -- true solo si un proceso de
      discovery para ESTA plataforma se ejecuto realmente y no
      encontro cuenta. Si no hay evidencia de que se ejecuto,
      debe llegar false: NUNCA se asume.
*/
export function clasificarCelda({ activos = [], snapshots = [], discoveryConfirmada = false } = {}) {
  if (activos.length === 0) {
    return {
      estado: discoveryConfirmada
        ? ESTADOS_CELDA.SIN_CUENTA
        : ESTADOS_CELDA.NO_PROBADO_SIN_REFERENCIA,
      activosTotal: 0,
      activosCubiertos: 0,
      motivo: discoveryConfirmada
        ? "discovery se ejecuto para esta plataforma y no encontro cuenta"
        : "no existe referencia declarada ni evidencia de discovery para esta plataforma"
    };
  }

  const cubiertos = activos.filter((a) => activoCubierto(a.accountId, snapshots));
  const identidadSolo = activos.filter(
    (a) => !activoCubierto(a.accountId, snapshots) && activoTieneIdentidadConfirmada(a.accountId, snapshots)
  );

  if (cubiertos.length === activos.length) {
    return {
      estado: ESTADOS_CELDA.MEDIDO,
      activosTotal: activos.length,
      activosCubiertos: cubiertos.length,
      motivo: "todos los activos declarados tienen al menos una medicion real"
    };
  }

  if (cubiertos.length > 0) {
    return {
      estado: ESTADOS_CELDA.PARCIAL,
      activosTotal: activos.length,
      activosCubiertos: cubiertos.length,
      motivo: `${cubiertos.length} de ${activos.length} activos medidos; el resto no`
    };
  }

  if (identidadSolo.length > 0) {
    return {
      estado: ESTADOS_CELDA.REQUIERE_PROVEEDOR,
      activosTotal: activos.length,
      activosCubiertos: 0,
      motivo: "identidad confirmada, pero ninguna metrica real todavia"
    };
  }

  const algunoElegibleProveedor = activos.some((a) =>
    ELEGIBLE_FALLBACK_PROVEEDOR.has(a.elegibilidad)
  );
  if (algunoElegibleProveedor) {
    return {
      estado: ESTADOS_CELDA.REQUIERE_PROVEEDOR,
      activosTotal: activos.length,
      activosCubiertos: 0,
      motivo: "via oficial no alcanza, pero existe fallback de proveedor elegible sin ejecutar"
    };
  }

  return {
    estado: ESTADOS_CELDA.NO_PROBADO,
    activosTotal: activos.length,
    activosCubiertos: 0,
    motivo: "cuenta(s) declarada(s) pero nunca medida(s) por ninguna via"
  };
}

/*
  Construye la matriz completa: un candidato x las 5 plataformas
  del benchmark. Nunca omite una celda -si faltan datos de una
  plataforma en la entrada, se trata como activos=[] y se exige
  discoveryConfirmada explicita, nunca asumida true.
*/
export function construirMatrizBenchmark(candidatos = []) {
  const filas = candidatos.map((c) => {
    const celdas = {};
    for (const plataforma of PLATAFORMAS_BENCHMARK) {
      const datos = c.plataformas?.[plataforma] || {};
      celdas[plataforma] = clasificarCelda({
        activos: datos.activos || [],
        snapshots: datos.snapshots || [],
        discoveryConfirmada: datos.discoveryConfirmada === true
      });
    }
    return { candidatoId: c.candidatoId, celdas };
  });

  const tally = Object.fromEntries(Object.values(ESTADOS_CELDA).map((e) => [e, 0]));
  for (const fila of filas) {
    for (const plataforma of PLATAFORMAS_BENCHMARK) {
      tally[fila.celdas[plataforma].estado] += 1;
    }
  }

  return { filas, tally, totalCeldas: candidatos.length * PLATAFORMAS_BENCHMARK.length };
}

/*
===========================================================
IDENTIDAD vs MEDICION — P-CAND-SOCIAL-BENCH-02A
===========================================================

Reutiliza la taxonomia que YA EXISTE en
`projectStore.fichaIdentidad`: `declaradaPorAnalista`,
`descubiertaPorSentinel`, `corroboradaPorSentinel`. No se inventa
una taxonomia paralela -solo se nombran las combinaciones que esos
tres booleanos ya distinguen.

Una referencia del analista (`declaradaPorAnalista: true`) es una
SEMILLA FUERTE de identidad. No es lo mismo que un discovery
automatico, y NO se degrada a NO_PROBADO solo porque el discovery
no la volvio a encontrar. Pero tampoco es una verificacion eterna:
`ANALYST_CONFIRMED` no implica `SYSTEM_VERIFIED`.

IDENTITY_CONFLICT es la unica excepcion que se decide por revision
humana de evidencia real ya persistida (p. ej. una biografia medida
que contradice al candidato), nunca por un score de correspondencia
bajo por si solo -un score bajo puede ser solo un algoritmo de
coincidencia impreciso, no una prueba de homonimia-.
*/
export const IDENTITY_STATES = {
  ANALYST_CONFIRMED: "ANALYST_CONFIRMED",
  SYSTEM_VERIFIED: "SYSTEM_VERIFIED",
  DISCOVERED: "DISCOVERED",
  IDENTITY_CONFLICT: "IDENTITY_CONFLICT",
  NO_ASSET_CONFIRMED: "NO_ASSET_CONFIRMED"
};

/*
  cuenta: { accountId, declaradaPorAnalista, descubiertaPorSentinel, corroboradaPorSentinel }
  conflictosConocidos: Set<accountId> -- revision humana explicita,
    nunca inferida automaticamente de un score.
*/
export function identidadDeCuenta(cuenta = {}, conflictosConocidos = new Set()) {
  const accountId = cuenta.accountId || cuenta.id || null;
  if (accountId && conflictosConocidos.has(accountId)) {
    return IDENTITY_STATES.IDENTITY_CONFLICT;
  }
  if (cuenta.declaradaPorAnalista === true) return IDENTITY_STATES.ANALYST_CONFIRMED;
  if (cuenta.corroboradaPorSentinel === true) return IDENTITY_STATES.SYSTEM_VERIFIED;
  if (cuenta.descubiertaPorSentinel === true) return IDENTITY_STATES.DISCOVERED;
  return IDENTITY_STATES.NO_ASSET_CONFIRMED;
}

/*
  Clasifica una celda con AMBAS dimensiones separadas: identidad y
  medicion. Los activos con IDENTITY_CONFLICT se excluyen del
  calculo de medicion -no pueden alimentar coverage/followers/
  ranking- pero su evidencia se preserva en `activosConConflicto`,
  nunca se borra en silencio.
*/
export function clasificarCeldaConIdentidad({
  activos = [],
  snapshots = [],
  discoveryConfirmada = false,
  conflictosConocidos = new Set()
} = {}) {
  const identidadPorActivo = activos.map((a) => ({
    accountId: a.accountId,
    identityState: identidadDeCuenta(a, conflictosConocidos)
  }));

  const activosConConflicto = identidadPorActivo.filter(
    (a) => a.identityState === IDENTITY_STATES.IDENTITY_CONFLICT
  );
  const activosValidos = activos.filter(
    (a) => identidadDeCuenta(a, conflictosConocidos) !== IDENTITY_STATES.IDENTITY_CONFLICT
  );

  const medicion = clasificarCelda({
    activos: activosValidos,
    snapshots,
    discoveryConfirmada
  });

  const identityStates = identidadPorActivo.map((a) => a.identityState);
  const ordenFuerza = [
    IDENTITY_STATES.ANALYST_CONFIRMED,
    IDENTITY_STATES.SYSTEM_VERIFIED,
    IDENTITY_STATES.DISCOVERED,
    IDENTITY_STATES.NO_ASSET_CONFIRMED
  ];
  const identidadDominante =
    ordenFuerza.find((estado) => identityStates.includes(estado)) ||
    (activos.length === 0 ? IDENTITY_STATES.NO_ASSET_CONFIRMED : null);

  return {
    ...medicion,
    identidadPorActivo,
    identidadDominante,
    activosConConflicto: activosConConflicto.map((a) => a.accountId),
    tieneConflictoDeIdentidad: activosConConflicto.length > 0
  };
}

/*
===========================================================
SNAPSHOT READINESS vs MOMENTUM READINESS
===========================================================

Una plataforma puede estar lista para EMPEZAR a coleccionar
snapshots (identidad resuelta, via tecnica disponible) sin tener
todavia historia suficiente para Momentum. Este gate NO calcula
Momentum ni inventa un umbral de separacion temporal: si no hay
evidencia de que un umbral fue validado, `readyForMomentum` es
siempre `INSUFFICIENT_HISTORY`, incluso con 2+ snapshots.
*/
export function snapshotReadinessDeActivo({
  accountId,
  identityState,
  snapshots = []
}) {
  const medibles = snapshots
    .filter((s) => s.accountId === accountId && ESTADOS_MEDICION_REAL.has(s.estado))
    .map((s) => s.capturedAt)
    .sort();

  const snapshotCount = medibles.length;
  const firstObservedAt = medibles[0] || null;
  const latestObservedAt = medibles[medibles.length - 1] || null;
  const temporalSeparationMs =
    firstObservedAt && latestObservedAt && firstObservedAt !== latestObservedAt
      ? new Date(latestObservedAt) - new Date(firstObservedAt)
      : 0;

  const identidadUtilizable =
    identityState === IDENTITY_STATES.ANALYST_CONFIRMED ||
    identityState === IDENTITY_STATES.SYSTEM_VERIFIED ||
    identityState === IDENTITY_STATES.DISCOVERED;

  return {
    accountId,
    snapshotCount,
    firstObservedAt,
    latestObservedAt,
    temporalSeparationMs,
    identityState,
    readyForSnapshotCollection: identidadUtilizable,
    /*
      Nunca "NO" silencioso: siempre trae el motivo explicito. No
      se inventa un umbral de dias -no hay uno validado todavia
      para este proyecto-.
    */
    readyForMomentum: "INSUFFICIENT_HISTORY"
  };
}

/*
  READY_FOR_LONGITUDINAL: candidato x plataforma con al menos 2
  snapshots comparables (mismo accountId, distinto capturedAt).
*/
export function celdasListasParaLongitudinal(candidatos = []) {
  const listas = [];
  for (const c of candidatos) {
    for (const plataforma of PLATAFORMAS_BENCHMARK) {
      const snaps = c.plataformas?.[plataforma]?.snapshots || [];
      const porActivo = new Map();
      for (const s of snaps) {
        if (!ESTADOS_MEDICION_REAL.has(s.estado)) continue;
        if (!porActivo.has(s.accountId)) porActivo.set(s.accountId, []);
        porActivo.get(s.accountId).push(s.capturedAt);
      }
      for (const [accountId, fechas] of porActivo) {
        if (fechas.length >= 2) {
          const ordenadas = [...fechas].sort();
          listas.push({
            candidatoId: c.candidatoId,
            plataforma,
            accountId,
            snapshotCount: fechas.length,
            firstSnapshot: ordenadas[0],
            latestSnapshot: ordenadas[ordenadas.length - 1]
          });
        }
      }
    }
  }
  return listas;
}
