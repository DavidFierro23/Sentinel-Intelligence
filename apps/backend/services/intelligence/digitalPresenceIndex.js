// apps/backend/services/intelligence/digitalPresenceIndex.js

/*
===========================================================
INDICE DE PRESENCIA DIGITAL OBSERVABLE (IPDO) — IPDO_V1
CANDIDATE-DIGITAL-PRESENCE-INDEX-01
===========================================================

Responde: "dentro del universo digital publico que Sentinel puede
observar de estos candidatos en este proyecto y periodo, que nivel
RELATIVO de presencia digital observable tiene cada candidato".

NO mide intencion de voto, aprobacion, probabilidad electoral,
poblacion alcanzada, personas unicas, apoyo politico, sentimiento
ni territorio. Ver docs/CANDIDATE-DIGITAL-PRESENCE-INDEX-01.md.

ARQUITECTURA REUTILIZADA, NO UN MOTOR NUEVO
-----------------------------------------------------------

Este modulo NO vuelve a calcular amplificacion ni conversacion:
consume `amplificacionDeCandidato` y `separarConversacion`
(candidateAmplification.js, sin tocar) y snapshots/publicaciones ya
persistidos (projectStore.js, sin tocar). `digitalPresence.js`
(OBSERVED-PRESENCE-01) tampoco se toca: ese modulo enumera
DIMENSIONES observables por separado y declaro su propio indice
compuesto `NO_DISPONIBLE` a proposito, listando 5 requisitos. IPDO
es la implementacion de esos 5 requisitos, con su propia version y
metodologia -documentada aqui, no ahi-.

SECUENCIA OBLIGATORIA (seccion 5 del gate)
-----------------------------------------------------------

RAW DATA -> METRICA POR PLATAFORMA -> log1p (si aplica) ->
NORMALIZACION (min-max relativo al proyecto) -> SUBDIMENSION ->
DIMENSION -> IPDO. Nunca se suman unidades distintas antes de
normalizar.
===========================================================
*/

export const IPDO_METHOD_VERSION = "IPDO_V1";

/*
  Pesos globales. HIPOTESIS METODOLOGICA, no verdad universal.
  Configuracion versionada y auditable -seccion 2 del gate-. La
  suma debe ser exactamente 1 (test A).
*/
export const IPDO_WEIGHTS = Object.freeze({
  presence: 0.25,
  interaction: 0.40,
  conversation: 0.35
});

/* Subpesos internos de cada dimension. Tambien hipotesis, tambien versionados. */
export const PRESENCE_SUBWEIGHTS = Object.freeze({
  accountCoverage: 0.5,
  audience: 0.5
});

export const INTERACTION_SUBWEIGHTS = Object.freeze({
  activity: 0.25,
  engagement: 0.45,
  attention: 0.30
});

export const CONVERSATION_SUBWEIGHTS = Object.freeze({
  thirdPartyVolume: 0.40,
  mediaDiversity: 0.30,
  publicConversation: 0.30
});

export const PLATAFORMAS_IPDO = Object.freeze(["facebook", "instagram", "tiktok", "x", "youtube"]);

/*
  Metricas que reciben log1p antes de normalizar -seccion 15 del
  gate-. Solo las que son conteos/magnitudes no negativas y
  observadas como muy sesgadas (un candidato con 500000 seguidores
  y otro con 200 en la misma plataforma). accountCoverage NO lleva
  log1p: es una proporcion pequena (0-5), no una magnitud sesgada.
*/
export const METRICAS_CON_LOG1P = Object.freeze([
  "audience", "activity", "engagement", "attention",
  "thirdPartyVolume", "mediaDiversity", "publicConversation"
]);

const ESTADOS_MEDIDOS_SNAPSHOT = new Set([
  "OBSERVADA", "MEDIDO_OFICIAL", "MEDIDO_PROPIO_AUTORIZADO", "MEDIDO_PROVEEDOR"
]);

function log1p(x) {
  return Math.log1p(Math.max(0, Number(x) || 0));
}

/*
===========================================================
NORMALIZACION MIN-MAX SOBRE log1p, RELATIVA AL PROYECTO
===========================================================

`valores`: [{ candidateId, valor }] donde `valor` puede ser
`null` (missing, se excluye del min/max y del resultado).

Si max(z) == min(z) entre los validos, la metrica NO DISCRIMINA
-seccion 17-: no se asigna 100 arbitrario, se marca
`discrimina: false` y quien llama debe excluirla/reponderar.
===========================================================
*/
export function normalizarRelativo(valores, { aplicarLog1p = true } = {}) {
  const validos = valores.filter((v) => v.valor != null);

  if (validos.length === 0) {
    return valores.map((v) => ({ ...v, normalizado: null, discrimina: false }));
  }

  const transformar = (x) => (aplicarLog1p ? log1p(x) : Number(x));

  const zs = validos.map((v) => transformar(v.valor));
  const min = Math.min(...zs);
  const max = Math.max(...zs);
  const discrimina = max > min;

  return valores.map((v) => {
    if (v.valor == null) return { ...v, normalizado: null, discrimina };
    if (!discrimina) return { ...v, normalizado: null, discrimina: false };
    const z = transformar(v.valor);
    return { ...v, normalizado: Number((100 * (z - min) / (max - min)).toFixed(4)), discrimina: true };
  });
}

/*
  Combina sub-senales ya normalizadas (0-100 o null) con sus
  pesos, reponderando SOLO entre las validas -seccion 19: SCORE !=
  COVERAGE-. Si ninguna es valida, devuelve null (no 0).
*/
function combinarConReponderacion(entradas) {
  const validas = entradas.filter((e) => e.valor != null);
  if (validas.length === 0) {
    return { valor: null, coverage: 0, detalle: entradas };
  }
  const pesoTotal = validas.reduce((s, e) => s + e.peso, 0);
  const valor = validas.reduce((s, e) => s + e.valor * (e.peso / pesoTotal), 0);
  return {
    valor: Number(valor.toFixed(4)),
    coverage: Number((validas.length / entradas.length).toFixed(4)),
    detalle: entradas
  };
}

/*
===========================================================
EXTRACCION: UNA FILA DE INSUMOS CRUDOS POR CANDIDATO
===========================================================

Toma lo YA calculado por otros modulos (snapshots, publicaciones,
amplificacion, conversacion, identidad) y lo reduce a los insumos
crudos que IPDO necesita. Cero red, cero recalculo de lo que ya
existe.
===========================================================
*/
export function extraerInsumosCandidato({
  candidateId,
  ficha,
  snapshots = [],
  publicaciones = [],
  amplificacion = null,
  conversacion = null,
  conflictosConocidos = new Set()
}) {
  /*
    ---------- COBERTURA DE ACTIVOS (identidad, no medicion) ----------
    Un activo en `conflictosConocidos` (p. ej. el homonimo de
    Instagram de Leonardo Morales, P-CAND-SOCIAL-BENCH-02) NUNCA
    cuenta como presencia -seccion 9 del gate original de
    conflictos, reafirmado aqui: un conflicto no debe aumentar
    artificialmente cobertura ni audiencia-.
  */
  const plataformasConActivoValido = new Set();
  for (const bloque of ficha?.plataformas || []) {
    const cuentas = bloque.cuentas || [];
    const tieneValido = cuentas.some(
      (c) => !conflictosConocidos.has(c.id) && (c.declaradaPorAnalista || c.corroboradaPorSentinel || c.descubiertaPorSentinel)
    );
    if (tieneValido) plataformasConActivoValido.add(bloque.plataformaId);
  }

  /* ---------- AUDIENCIA POR PLATAFORMA (ultimo snapshot real, por activo, sumado dentro de la MISMA plataforma) ---------- */
  const audienciaPorPlataforma = {};
  for (const plataforma of PLATAFORMAS_IPDO) {
    const snapsPlataforma = snapshots.filter(
      (s) =>
        (s.platform === plataforma || s.plataformaId === plataforma) &&
        ESTADOS_MEDIDOS_SNAPSHOT.has(s.estado) &&
        !conflictosConocidos.has(s.accountId)
    );
    if (!snapsPlataforma.length) { audienciaPorPlataforma[plataforma] = null; continue; }

    // ultimo snapshot real por accountId (no confundir con el mas viejo)
    const ultimoPorActivo = new Map();
    for (const s of snapsPlataforma) {
      const prev = ultimoPorActivo.get(s.accountId);
      if (!prev || new Date(s.capturedAt) > new Date(prev.capturedAt)) ultimoPorActivo.set(s.accountId, s);
    }
    const followersValidos = [...ultimoPorActivo.values()]
      .map((s) => s.followers)
      .filter((f) => f != null);

    audienciaPorPlataforma[plataforma] = followersValidos.length
      ? followersValidos.reduce((a, b) => a + b, 0)
      : null;
  }

  /* ---------- ACTIVIDAD / ENGAGEMENT / ATTENTION (publicaciones, ultima observacion por metrica) ---------- */
  const postCount = publicaciones.length;

  let totalEngagement = null;
  let totalAttention = null;

  if (postCount > 0) {
    let sumaEngagement = 0;
    let huboEngagementReal = false;
    let sumaAttention = 0;
    let huboAttentionReal = false;

    for (const pub of publicaciones) {
      const metricas = pub.metricas || [];
      const ultimaDe = (nombre) => {
        const deEsaMetrica = metricas.filter((m) => m.metrica === nombre && m.value != null);
        if (!deEsaMetrica.length) return null;
        return deEsaMetrica.reduce((a, b) => (new Date(b.observedAt) > new Date(a.observedAt) ? b : a)).value;
      };

      /*
        ENGAGEMENT = respuesta directa a la pieza: likes/reacciones
        + comentarios + reposts/shares. NUNCA views: eso es
        ATTENTION, unidad distinta (seccion 8/24 anti-double-counting).
      */
      const likes = ultimaDe("likes");
      const comments = ultimaDe("comments");
      const reposts = ultimaDe("reposts") ?? ultimaDe("shares");
      if (likes != null || comments != null || reposts != null) {
        sumaEngagement += (likes || 0) + (comments || 0) + (reposts || 0);
        huboEngagementReal = true;
      }

      const views = ultimaDe("views");
      if (views != null) {
        sumaAttention += views;
        huboAttentionReal = true;
      }
    }

    totalEngagement = huboEngagementReal ? sumaEngagement : null;
    totalAttention = huboAttentionReal ? sumaAttention : null;
  }

  /* ---------- CONVERSACION / AMPLIFICACION (ya calculadas por candidateAmplification.js) ---------- */
  const hayCorpusGanado = (amplificacion?.ganada?.piezas || 0) > 0;
  const thirdPartyVolume = hayCorpusGanado ? amplificacion.ganada.hechosDistintos : null;
  const mediaDiversity = hayCorpusGanado ? amplificacion.ganada.medios?.dominiosDistintos ?? null : null;

  const planoConversacion = (conversacion?.planos || []).find((p) => p.clave === "conversacion");
  const publicConversation = (conversacion?.total || 0) > 0 ? planoConversacion?.piezasObservadas ?? null : null;

  return {
    candidateId,
    accountCoverageCount: plataformasConActivoValido.size,
    accountCoveragePlatforms: [...plataformasConActivoValido],
    audienciaPorPlataforma,
    postCount,
    totalEngagement,
    totalAttention,
    interactionsPerPost: totalEngagement != null && postCount > 0 ? Number((totalEngagement / postCount).toFixed(2)) : null,
    thirdPartyVolume,
    mediaDiversity,
    publicConversation
  };
}

/*
===========================================================
CALCULAR IPDO PARA EL UNIVERSO DE UN PROYECTO
===========================================================

`filas`: array de resultados de `extraerInsumosCandidato` para
TODOS los candidatos del universo comparable (mismo proyecto,
mismo periodo). Universo < 2 candidatos no es comparable.
===========================================================
*/
export function calcularIPDO(filas = []) {
  if (filas.length < 2) {
    return {
      methodVersion: IPDO_METHOD_VERSION,
      estado: "INSUFFICIENT_COMPARISON_UNIVERSE",
      motivo: `Se necesitan al menos 2 candidatos comparables en el mismo proyecto y periodo; hay ${filas.length}.`,
      resultados: []
    };
  }

  /* ---------- PRESENCE ---------- */
  const accountCoverageNorm = normalizarRelativo(
    filas.map((f) => ({ candidateId: f.candidateId, valor: f.accountCoverageCount })),
    { aplicarLog1p: false }
  );

  const audienciaPorPlataformaNorm = {};
  for (const plataforma of PLATAFORMAS_IPDO) {
    audienciaPorPlataformaNorm[plataforma] = normalizarRelativo(
      filas.map((f) => ({ candidateId: f.candidateId, valor: f.audienciaPorPlataforma[plataforma] }))
    );
  }

  /* ---------- INTERACTION ---------- */
  const activityNorm = normalizarRelativo(filas.map((f) => ({ candidateId: f.candidateId, valor: f.postCount > 0 ? f.postCount : null })));
  const engagementNorm = normalizarRelativo(filas.map((f) => ({ candidateId: f.candidateId, valor: f.totalEngagement })));
  const attentionNorm = normalizarRelativo(filas.map((f) => ({ candidateId: f.candidateId, valor: f.totalAttention })));

  /* ---------- CONVERSATION ---------- */
  const thirdPartyNorm = normalizarRelativo(filas.map((f) => ({ candidateId: f.candidateId, valor: f.thirdPartyVolume })));
  const mediaDiversityNorm = normalizarRelativo(filas.map((f) => ({ candidateId: f.candidateId, valor: f.mediaDiversity })));
  const publicConvNorm = normalizarRelativo(filas.map((f) => ({ candidateId: f.candidateId, valor: f.publicConversation })));

  /*
    `normalizarRelativo` devuelve `valor` (el crudo original) Y
    `normalizado` (0-100 o null) por separado, a proposito -asi
    quien audite puede ver ambos-. `buscar` aqui remapea para que
    el resto de esta funcion trabaje SIEMPRE con el normalizado:
    usar el crudo por accidente fue justo el bug que este
    comentario documenta haber encontrado y corregido antes de
    validar con datos reales (Presence llegaba a 19165/100).
  */
  const buscar = (lista, candidateId) => {
    const x = lista.find((e) => e.candidateId === candidateId);
    return { ...x, raw: x.valor, valor: x.normalizado };
  };

  const resultados = filas.map((f) => {
    const cid = f.candidateId;

    /* audiencia: promedio de plataformas disponibles y que discriminan */
    const audienciaEntradas = PLATAFORMAS_IPDO
      .map((p) => ({ plataforma: p, ...buscar(audienciaPorPlataformaNorm[p], cid) }))
      .filter((e) => e.discrimina !== false || e.valor != null);
    const audienciaCombo = combinarConReponderacion(
      PLATAFORMAS_IPDO.map((p) => {
        const e = buscar(audienciaPorPlataformaNorm[p], cid);
        return { valor: e.valor, peso: 1, plataforma: p, raw: f.audienciaPorPlataforma[p] };
      })
    );

    const accCov = buscar(accountCoverageNorm, cid);
    const presenceCombo = combinarConReponderacion([
      { valor: accCov.valor, peso: PRESENCE_SUBWEIGHTS.accountCoverage, nombre: "accountCoverage" },
      { valor: audienciaCombo.valor, peso: PRESENCE_SUBWEIGHTS.audience, nombre: "audience" }
    ]);

    const act = buscar(activityNorm, cid);
    const eng = buscar(engagementNorm, cid);
    const att = buscar(attentionNorm, cid);
    const interactionCombo = combinarConReponderacion([
      { valor: act.valor, peso: INTERACTION_SUBWEIGHTS.activity, nombre: "activity" },
      { valor: eng.valor, peso: INTERACTION_SUBWEIGHTS.engagement, nombre: "engagement" },
      { valor: att.valor, peso: INTERACTION_SUBWEIGHTS.attention, nombre: "attention" }
    ]);

    const tpv = buscar(thirdPartyNorm, cid);
    const md = buscar(mediaDiversityNorm, cid);
    const pc = buscar(publicConvNorm, cid);
    const conversationCombo = combinarConReponderacion([
      { valor: tpv.valor, peso: CONVERSATION_SUBWEIGHTS.thirdPartyVolume, nombre: "thirdPartyVolume" },
      { valor: md.valor, peso: CONVERSATION_SUBWEIGHTS.mediaDiversity, nombre: "mediaDiversity" },
      { valor: pc.valor, peso: CONVERSATION_SUBWEIGHTS.publicConversation, nombre: "publicConversation" }
    ]);

    const dimensiones = [
      { clave: "presence", valor: presenceCombo.valor, peso: IPDO_WEIGHTS.presence, coverage: presenceCombo.coverage },
      { clave: "interaction", valor: interactionCombo.valor, peso: IPDO_WEIGHTS.interaction, coverage: interactionCombo.coverage },
      { clave: "conversation", valor: conversationCombo.valor, peso: IPDO_WEIGHTS.conversation, coverage: conversationCombo.coverage }
    ];

    const dimsValidas = dimensiones.filter((d) => d.valor != null);
    const pesoValido = dimsValidas.reduce((s, d) => s + d.peso, 0);
    const score = dimsValidas.length
      ? Number((dimsValidas.reduce((s, d) => s + d.valor * (d.peso / pesoValido), 0)).toFixed(2))
      : null;

    /*
      METHODOLOGICAL_COVERAGE — seccion 20. 8 senales esperadas:
      2 de presence, 3 de interaction, 3 de conversation. Cuenta
      cuantas fueron computables (no missing, no non-discriminating).
    */
    const senalesEsperadas = [
      accCov.valor, audienciaCombo.valor,
      act.valor, eng.valor, att.valor,
      tpv.valor, md.valor, pc.valor
    ];
    const senalesComputables = senalesEsperadas.filter((v) => v != null).length;
    const coveragePct = senalesComputables / senalesEsperadas.length;
    const methodologicalCoverage = coveragePct >= 0.75 ? "ALTA" : coveragePct >= 0.4 ? "MEDIA" : "BAJA";

    const inputsUsed = [];
    const inputsMissing = [];
    const nombraFaltante = (nombre, valor) => (valor == null ? inputsMissing.push(nombre) : inputsUsed.push(nombre));
    nombraFaltante("accountCoverage", accCov.valor);
    nombraFaltante("audience", audienciaCombo.valor);
    nombraFaltante("activity", act.valor);
    nombraFaltante("engagement", eng.valor);
    nombraFaltante("attention", att.valor);
    nombraFaltante("thirdPartyVolume", tpv.valor);
    nombraFaltante("mediaDiversity", md.valor);
    nombraFaltante("publicConversation", pc.valor);

    const platformCoverage = Object.fromEntries(
      PLATAFORMAS_IPDO.map((p) => [p, f.audienciaPorPlataforma[p] != null])
    );

    return {
      candidateId: cid,
      methodVersion: IPDO_METHOD_VERSION,
      score,
      dimensions: {
        presence: presenceCombo.valor,
        interaction: interactionCombo.valor,
        conversation: conversationCombo.valor
      },
      methodologicalCoverage,
      methodologicalCoveragePct: Number(coveragePct.toFixed(2)),
      inputsUsed,
      inputsMissing,
      platformCoverage,
      rawInputs: f,
      explanation: construirExplicacion({
        candidateId: cid, score, presenceCombo, interactionCombo, conversationCombo,
        accCov, audienciaCombo, act, eng, att, tpv, md, pc, f
      }),
      evidenceRefs: {
        nota: "score -> subscore -> metrica -> snapshotsDe/publicacionesDe/evidenciasDe del proyecto",
        platforms: PLATAFORMAS_IPDO.filter((p) => f.audienciaPorPlataforma[p] != null)
      }
    };
  });

  return {
    methodVersion: IPDO_METHOD_VERSION,
    estado: "OK",
    universeSize: filas.length,
    resultados
  };
}

function construirExplicacion({ candidateId, score, presenceCombo, interactionCombo, conversationCombo, accCov, audienciaCombo, act, eng, att, tpv, md, pc, f }) {
  const factoresPresencia = [];
  if (accCov.valor != null) factoresPresencia.push(`presencia declarada/corroborada en ${f.accountCoverageCount}/5 plataformas`);
  if (audienciaCombo.valor != null) factoresPresencia.push(`audiencia observable relativa (${PLATAFORMAS_IPDO.filter((p) => f.audienciaPorPlataforma[p] != null).join(", ") || "ninguna plataforma con dato"})`);
  if (!factoresPresencia.length) factoresPresencia.push("sin insumos de presencia disponibles");

  const factoresInteraccion = [];
  if (act.valor != null) factoresInteraccion.push(`${f.postCount} publicaciones observadas`);
  if (eng.valor != null) factoresInteraccion.push(`${f.totalEngagement} interacciones observadas (likes+comentarios+reposts)${f.interactionsPerPost != null ? `, ${f.interactionsPerPost} por publicacion` : ""}`);
  if (att.valor != null) factoresInteraccion.push(`${f.totalAttention} visualizaciones observadas`);
  if (!factoresInteraccion.length) factoresInteraccion.push("sin publicaciones observadas todavia");

  const factoresConversacion = [];
  if (tpv.valor != null) factoresConversacion.push(`${f.thirdPartyVolume} hechos distintos publicados por terceros`);
  if (md.valor != null) factoresConversacion.push(`${f.mediaDiversity} medios distintos`);
  if (pc.valor != null) factoresConversacion.push(`${f.publicConversation} piezas de conversacion publica observada`);
  if (!factoresConversacion.length) factoresConversacion.push("sin corpus de terceros disponible todavia");

  return {
    resumen: score != null ? `IPDO ${score}/100` : "IPDO no calculable: ninguna dimension tiene insumos",
    presence: { valor: presenceCombo.valor, factores: factoresPresencia },
    interaction: { valor: interactionCombo.valor, factores: factoresInteraccion },
    conversation: { valor: conversationCombo.valor, factores: factoresConversacion },
    limitaciones: [
      ...(accCov.valor == null ? ["cobertura de activos no discrimina o no disponible"] : []),
      ...(audienciaCombo.valor == null ? ["sin audiencia observable en ninguna plataforma"] : []),
      ...(act.valor == null ? ["sin actividad observada"] : []),
      ...(eng.valor == null ? ["sin interaccion observada"] : []),
      ...(att.valor == null ? ["sin atencion/vistas observadas"] : []),
      ...(tpv.valor == null ? ["sin volumen de terceros observado"] : []),
      ...(md.valor == null ? ["sin diversidad de medios observada"] : []),
      ...(pc.valor == null ? ["sin conversacion publica observada"] : [])
    ],
    periodo: "PRESENCE = estado observable actual (stock); INTERACTION y CONVERSATION = acumulado de toda la ventana observada hasta la fecha, sin ventana temporal comparable definida todavia -ver CANDIDATE_TEMPORAL_COMPARABILITY_DEBT-",
    version: IPDO_METHOD_VERSION
  };
}

export default {
  IPDO_METHOD_VERSION,
  IPDO_WEIGHTS,
  PRESENCE_SUBWEIGHTS,
  INTERACTION_SUBWEIGHTS,
  CONVERSATION_SUBWEIGHTS,
  PLATAFORMAS_IPDO,
  normalizarRelativo,
  extraerInsumosCandidato,
  calcularIPDO
};
