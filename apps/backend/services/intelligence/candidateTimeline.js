// apps/backend/services/intelligence/candidateTimeline.js

/*
===========================================================
EXPEDIENTE LONGITUDINAL — CANDIDATE-LONGITUDINAL-01
===========================================================

Desde que un candidato entra en Sentinel, las observaciones se
AGREGAN. Una investigacion nueva no reemplaza la anterior.

Sin eso no se puede responder a ninguna pregunta interesante:

    que cuentas tenia atribuidas en una fecha
    cuales aparecieron y cuales dejaron de reencontrarse
    como evoluciono la actividad
    que cambio entre dos ventanas

y todas esas preguntas son sobre el PASADO, que es exactamente
lo que una escritura destructiva borra.

-----------------------------------------------------------
LA DISTINCION QUE NO SE PUEDE PERDER
-----------------------------------------------------------

    firstObservedBySentinel   cuando lo vimos NOSOTROS
    fechaDeclaradaPorLaFuente cuando dice la fuente que ocurrio

No son lo mismo y confundirlos falsifica la historia. Si en
octubre recuperamos una nota de agosto, Sentinel NO observo nada
en agosto: observo en octubre una pieza fechada en agosto.

Escribir la segunda fecha en el primer campo produciria un
expediente que afirma una vigilancia que no existio.
===========================================================
*/


export const VENTANAS = Object.freeze([
  { id: "7d", dias: 7, nombre: "7 dias" },
  { id: "30d", dias: 30, nombre: "30 dias" },
  { id: "90d", dias: 90, nombre: "90 dias" },
  { id: "campana", dias: null, nombre: "Campana completa" }
]);


export const ESTADOS_VENTANA = Object.freeze({
  /* Hay al menos dos observaciones y se pueden comparar. */
  COMPARABLE: "COMPARABLE",

  /*
    Hay datos pero no bastantes para comparar. NO se dibuja una
    tendencia con un punto: una tendencia de un punto es una
    opinion con forma de linea.
  */
  HISTORICO_INSUFICIENTE: "HISTORICO_INSUFICIENTE",

  /* No hay ninguna observacion en la ventana. */
  SIN_OBSERVACIONES: "SIN_OBSERVACIONES"
});


/*
  Minimo para poder comparar: dos observaciones. No es un umbral
  de calidad, es aritmetica.
*/
const MINIMO_COMPARABLE = 2;


function instante(x) {
  const t = new Date(x).getTime();

  return Number.isFinite(t) ? t : null;
}


/*
===========================================================
UNA VENTANA
===========================================================

Devuelve lo que hay y, cuando no basta, dice exactamente que
falta. Nunca devuelve un delta calculado sobre un solo punto.
===========================================================
*/
export function ventanaDeSnapshots(snapshots = [], dias = null, ahora = new Date()) {
  const limite =
    dias == null ? null : ahora.getTime() - dias * 24 * 60 * 60 * 1000;

  const dentro = (snapshots || [])
    .filter((s) => {
      const t = instante(s.capturedAt);

      if (t == null) return false;

      return limite == null || t >= limite;
    })
    .sort((a, b) =>
      String(a.capturedAt || "").localeCompare(String(b.capturedAt || ""))
    );

  const base = {
    dias,
    desde: limite == null ? null : new Date(limite).toISOString(),
    hasta: ahora.toISOString(),
    observaciones: dentro.length,
    primera: dentro[0]?.capturedAt || null,
    ultima: dentro[dentro.length - 1]?.capturedAt || null
  };

  if (!dentro.length) {
    return {
      ...base,
      estado: ESTADOS_VENTANA.SIN_OBSERVACIONES,
      comparable: false,
      delta: null,
      motivo:
        "No hay ninguna observacion registrada en esta ventana. No dice nada sobre la actividad del candidato: dice que no observamos."
    };
  }

  if (dentro.length < MINIMO_COMPARABLE) {
    return {
      ...base,
      estado: ESTADOS_VENTANA.HISTORICO_INSUFICIENTE,
      comparable: false,
      delta: null,
      motivo: `Historico insuficiente: hace falta un minimo de ${MINIMO_COMPARABLE} observaciones para comparar y hay ${dentro.length}. No se dibuja ninguna tendencia.`
    };
  }

  /*
    Delta solo entre metricas REALMENTE presentes en los dos
    extremos. Si falta en uno, el delta es null: restar de un
    `null` daria un numero inventado.
  */
  const a = dentro[0];

  const b = dentro[dentro.length - 1];

  const restar = (campo) =>
    a[campo] == null || b[campo] == null ? null : b[campo] - a[campo];

  return {
    ...base,
    estado: ESTADOS_VENTANA.COMPARABLE,
    comparable: true,

    delta: {
      followers: restar("followers"),
      postsObserved: restar("postsObserved"),

      nota:
        "Un delta en `null` significa que la metrica no estaba disponible en al menos uno de los dos extremos. No significa que no cambiara."
    },

    motivo: null
  };
}


/*
  Las cuatro ventanas de una serie, cada una con su estado.
*/
export function ventanasDe(snapshots = [], ahora = new Date()) {
  return VENTANAS.map((v) => ({
    id: v.id,
    nombre: v.nombre,
    ...ventanaDeSnapshots(snapshots, v.dias, ahora)
  }));
}


/*
===========================================================
QUE CUENTAS TENIA SENTINEL EN UNA FECHA
===========================================================

Un snapshot de identidad es la foto del inventario en un
instante. Comparar dos fotos responde a «que aparecio y que
dejo de reencontrarse», que es distinto de «que se dio de baja».
===========================================================
*/
export function crearSnapshotDeIdentidad(entrada = {}) {
  const cuando = entrada.capturedAt || new Date().toISOString();

  return {
    tipo: "IDENTIDAD",
    snapshotId: `ident-${entrada.candidateId}-${cuando}`,

    candidateId: entrada.candidateId || null,
    projectId: entrada.projectId || null,
    capturedAt: cuando,

    /*
      Se guarda el estado de cada cuenta, no solo su id: sin el
      estado, la foto no distingue una cuenta corroborada de una
      recien descubierta.
    */
    cuentas: (entrada.cuentas || []).map((c) => ({
      accountId: c.accountId || c.id || null,
      plataformaId: c.plataformaId || null,
      handle: c.handle || null,
      url: c.url || null,
      estado: c.estado || null,
      solidez: c.solidez?.valor ?? null,
      senalesIndependientes: c.solidez?.senalesIndependientes || [],
      firstSeenAt: c.firstSeenAt || null,
      lastSeenAt: c.lastSeenAt || null,
      lastCheckedAt: c.lastCheckedAt || null
    })),

    total: (entrada.cuentas || []).length,

    /*
      Origen de la foto. Una foto tomada sin salir a la red vale
      para saber que sabiamos, no para saber que habia.
    */
    origen: entrada.origen || "lectura_del_inventario",

    ejecucionId: entrada.ejecucionId || null
  };
}


export function compararInventarios(anterior, actual) {
  const idsDe = (s) =>
    new Set((s?.cuentas || []).map((c) => c.accountId).filter(Boolean));

  const antes = idsDe(anterior);

  const ahora = idsDe(actual);

  const porId = new Map(
    (actual?.cuentas || []).map((c) => [c.accountId, c])
  );

  const aparecidas = [...ahora].filter((id) => !antes.has(id));

  const ausentes = [...antes].filter((id) => !ahora.has(id));

  const permanecen = [...ahora].filter((id) => antes.has(id));

  /* Cambios de estado en las que siguen. */
  const previoPorId = new Map(
    (anterior?.cuentas || []).map((c) => [c.accountId, c])
  );

  const cambiosDeEstado = permanecen
    .map((id) => ({
      accountId: id,
      desde: previoPorId.get(id)?.estado || null,
      hasta: porId.get(id)?.estado || null
    }))
    .filter((c) => c.desde !== c.hasta);

  return {
    desde: anterior?.capturedAt || null,
    hasta: actual?.capturedAt || null,

    aparecidas,
    permanecen,

    /*
      NO se llaman «desaparecidas». Una cuenta que no aparece en
      la foto nueva puede seguir existiendo perfectamente: lo
      unico que sabemos es que no esta en el inventario de ahora.
    */
    ausentesDelInventario: ausentes,

    cambiosDeEstado,

    nota:
      "«Ausente del inventario» no significa que la cuenta se haya cerrado ni que se haya dado de baja: significa que no consta en la foto mas reciente. Una baja es una decision y se registra como DESCARTADA.",

    comparable: !!(anterior && actual)
  };
}


/*
===========================================================
PROCEDENCIA TEMPORAL
===========================================================

Dos fechas, dos significados, y una regla: la fecha que declara
una fuente NUNCA se escribe como fecha de observacion de
Sentinel.
===========================================================
*/
export const PROCEDENCIAS_TEMPORALES = Object.freeze({
  /* Sentinel lo vio en directo, en el momento en que ocurria. */
  OBSERVADA_POR_SENTINEL: "OBSERVADA_POR_SENTINEL",

  /*
    Sentinel lo encontro despues. La pieza es anterior a nuestra
    primera mirada, y eso se dice.
  */
  EVIDENCIA_HISTORICA_RECUPERADA: "EVIDENCIA_HISTORICA_RECUPERADA"
});


export function procedenciaTemporal(entrada = {}) {
  const recuperadaEn = entrada.recuperadaEn || entrada.capturedAt || null;

  const declaradaPorLaFuente = entrada.fechaDeclaradaPorLaFuente || null;

  const tR = instante(recuperadaEn);

  const tD = instante(declaradaPorLaFuente);

  /*
    Anterior a nuestra primera mirada: es recuperacion, no
    observacion. El margen de un dia evita que la zona horaria de
    una nota publicada el mismo dia la convierta en historica.
    */
  const historica =
    tR != null && tD != null && tR - tD > 24 * 60 * 60 * 1000;

  return {
    procedencia: historica
      ? PROCEDENCIAS_TEMPORALES.EVIDENCIA_HISTORICA_RECUPERADA
      : PROCEDENCIAS_TEMPORALES.OBSERVADA_POR_SENTINEL,

    /*
      Cuando lo vimos nosotros. Es SIEMPRE la fecha de
      recuperacion, tambien —y sobre todo— cuando la pieza es
      vieja.
    */
    firstObservedBySentinel: recuperadaEn,

    fechaDeclaradaPorLaFuente: declaradaPorLaFuente,

    nota: historica
      ? "Pieza anterior a la primera observacion de Sentinel. Se recupero despues: Sentinel NO estaba observando cuando se publico."
      : null
  };
}


export default {
  VENTANAS,
  ESTADOS_VENTANA,
  ventanaDeSnapshots,
  ventanasDe,
  crearSnapshotDeIdentidad,
  compararInventarios,
  PROCEDENCIAS_TEMPORALES,
  procedenciaTemporal
};
