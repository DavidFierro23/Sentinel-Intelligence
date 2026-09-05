// apps/backend/services/intelligence/contentMetricsCanonical.js

/*
===========================================================
CONTRATO CANONICO DE METRICAS DE CONTENIDO
CANDIDATE-IPDO-CROSS-PLATFORM-MAPPING-03
===========================================================

Repara el CONTRACT_MISMATCH certificado por
CANDIDATE-IPDO-INPUT-AUDIT-02 (commit b22853e): los mapeadores de
proveedor (scrapeCreatorsMapper.js para Facebook/Instagram/TikTok)
usan nombres de campo distintos (`reactions`, `commentsCount`) que
`x_api`/`youtube_data` (`likes`, `comments`) -los dos providers mas
antiguos, contra los que se escribio el extractor de IPDO sin
reconciliar la convencion de los demas-.

Esta capa vive ENTRE `publicacionesDe()` (read model, sin tocar) y
`digitalPresenceIndex.js` (calculo, sin condicionales ad-hoc por
plataforma). Nadie mas se modifica.

METRICAS CANONICAS (solo las que existen realmente hoy):

    FOLLOWERS, SUBSCRIBERS   -- nivel de perfil, fuera de este modulo
    CONTENT_COUNT            -- conteo de publicaciones
    LIKES                    -- "me gusta" explicito (X, YouTube, IG scrapecreators)
    REACTIONS                -- reacciones agregadas (Facebook) -- NUNCA se renombra a LIKES
    COMMENTS_COUNT           -- conteo de comentarios (nunca el texto: ese corpus no esta persistido)
    SHARES                   -- Facebook/Instagram/TikTok
    REPOSTS                  -- X (repost/retweet)
    VIEWS                    -- atencion, unidad separada de engagement

LIKES y REACTIONS son conceptos DISTINTOS que nunca coexisten en la
misma pieza real observada hoy -cada plataforma/proveedor reporta
uno u otro-, asi que se combinan como "senal de aprobacion
explicita" para el calculo de ENGAGEMENT sin fusionar su nombre: la
explicacion conserva cual de los dos fue el `sourceMetric` real.
===========================================================
*/

export const METRICAS_CANONICAS = Object.freeze({
  CONTENT_COUNT: "CONTENT_COUNT",
  LIKES: "LIKES",
  REACTIONS: "REACTIONS",
  COMMENTS_COUNT: "COMMENTS_COUNT",
  SHARES: "SHARES",
  REPOSTS: "REPOSTS",
  VIEWS: "VIEWS"
});

/*
  Alias de nombre crudo (`sourceMetric`, tal cual aparece en
  `publicacion.metricas[].metrica`) -> metrica canonica. Un alias
  nuevo se agrega aqui, nunca como condicional dentro del calculo.
*/
const ALIAS_A_CANONICA = Object.freeze({
  likes: METRICAS_CANONICAS.LIKES,
  reactions: METRICAS_CANONICAS.REACTIONS,
  comments: METRICAS_CANONICAS.COMMENTS_COUNT,
  commentsCount: METRICAS_CANONICAS.COMMENTS_COUNT,
  shares: METRICAS_CANONICAS.SHARES,
  reposts: METRICAS_CANONICAS.REPOSTS,
  views: METRICAS_CANONICAS.VIEWS
});

export function metricaCanonicaDe(sourceMetric) {
  return ALIAS_A_CANONICA[sourceMetric] || null;
}

/*
  Toma la ULTIMA observacion (por `observedAt`) de cada `sourceMetric`
  presente en `metricas` (evita sumar re-observaciones de la misma
  pieza), y las agrupa por metrica CANONICA. Si dos sourceMetric
  distintos mapean a la MISMA canonica (nunca ocurre hoy salvo
  comments/commentsCount), se documenta cual prevalecio.

  Devuelve: { canonica: { value, sourceMetric, observedAt, provider } | null, ... }
  Nunca convierte ausencia en 0 -si no hay observacion real, la
  entrada correspondiente no aparece-.
*/
export function normalizarMetricasDeContenido(metricas = []) {
  const ultimaPorSourceMetric = new Map();
  for (const m of metricas) {
    if (m?.value == null) continue;
    const prev = ultimaPorSourceMetric.get(m.metrica);
    if (!prev || new Date(m.observedAt) > new Date(prev.observedAt)) {
      ultimaPorSourceMetric.set(m.metrica, m);
    }
  }

  const resultado = {};
  for (const [sourceMetric, m] of ultimaPorSourceMetric) {
    const canonica = metricaCanonicaDe(sourceMetric);
    if (!canonica) continue; // metrica desconocida: no se inventa una equivalencia

    const existente = resultado[canonica];
    /*
      Si dos sourceMetric ya observados mapean a la misma canonica
      (hoy solo pasa con comments/commentsCount, nunca en la MISMA
      pieza a la vez en los datos reales revisados), se conserva el
      valor mas reciente entre ambos -nunca se suman, serian la
      misma senal contada dos veces-.
    */
    if (!existente || new Date(m.observedAt) > new Date(existente.observedAt)) {
      resultado[canonica] = {
        value: m.value,
        sourceMetric,
        observedAt: m.observedAt,
        provider: m.provider || null
      };
    }
  }

  return resultado;
}

/*
  ENGAGEMENT = respuesta directa a la pieza. Combina LIKES ∪
  REACTIONS (nunca ambos: son mutuamente excluyentes por
  plataforma/proveedor hoy) + COMMENTS_COUNT + SHARES ∪ REPOSTS.
  ATTENTION = VIEWS, unidad separada, nunca mezclada.

  Devuelve null si NINGUNA de las senales de engagement esta
  presente -missing, no 0-. Preserva `fuentes` para explicabilidad
  ("reacciones de Facebook", no "likes").
*/
export function engagementDePublicacion(metricas = []) {
  const canon = normalizarMetricasDeContenido(metricas);

  const aprobacion = canon[METRICAS_CANONICAS.LIKES] || canon[METRICAS_CANONICAS.REACTIONS] || null;
  const comentarios = canon[METRICAS_CANONICAS.COMMENTS_COUNT] || null;
  const amplificacion = canon[METRICAS_CANONICAS.REPOSTS] || canon[METRICAS_CANONICAS.SHARES] || null;

  const componentes = [aprobacion, comentarios, amplificacion].filter(Boolean);
  if (!componentes.length) return null;

  return {
    total: componentes.reduce((s, c) => s + c.value, 0),
    fuentes: componentes.map((c) => ({ canonicalMetric: metricaCanonicaDe(c.sourceMetric), sourceMetric: c.sourceMetric, value: c.value }))
  };
}

export function attentionDePublicacion(metricas = []) {
  const canon = normalizarMetricasDeContenido(metricas);
  const views = canon[METRICAS_CANONICAS.VIEWS] || null;
  return views ? { total: views.value, fuente: { canonicalMetric: "VIEWS", sourceMetric: views.sourceMetric, value: views.value } } : null;
}

export default {
  METRICAS_CANONICAS,
  metricaCanonicaDe,
  normalizarMetricasDeContenido,
  engagementDePublicacion,
  attentionDePublicacion
};
