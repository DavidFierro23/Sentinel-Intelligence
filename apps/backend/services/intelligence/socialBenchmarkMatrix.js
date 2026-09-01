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
