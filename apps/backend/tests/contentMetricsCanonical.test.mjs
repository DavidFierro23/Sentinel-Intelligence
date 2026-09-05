import assert from "node:assert/strict";
import { test } from "node:test";
import {
  METRICAS_CANONICAS,
  metricaCanonicaDe,
  normalizarMetricasDeContenido,
  engagementDePublicacion,
  attentionDePublicacion
} from "../services/intelligence/contentMetricsCanonical.js";

/* CANDIDATE-IPDO-CROSS-PLATFORM-MAPPING-03. Cero red. */

test("A) Facebook: reactions se consume como engagement (no se pierde por no llamarse likes)", () => {
  const metricas = [{ metrica: "reactions", value: 157, observedAt: "2026-09-01T00:00:00Z" }];
  const eng = engagementDePublicacion(metricas);
  assert.equal(eng.total, 157);
  assert.equal(eng.fuentes[0].canonicalMetric, METRICAS_CANONICAS.REACTIONS);
  assert.equal(eng.fuentes[0].sourceMetric, "reactions"); // nunca renombrado a "likes"
});

test("B) Facebook: commentsCount se consume como engagement", () => {
  const metricas = [
    { metrica: "reactions", value: 157, observedAt: "2026-09-01T00:00:00Z" },
    { metrica: "commentsCount", value: 16, observedAt: "2026-09-01T00:00:00Z" }
  ];
  const eng = engagementDePublicacion(metricas);
  assert.equal(eng.total, 173); // 157 + 16
  assert.ok(eng.fuentes.some((f) => f.canonicalMetric === METRICAS_CANONICAS.COMMENTS_COUNT));
});

test("C) TikTok: commentsCount se consume", () => {
  const metricas = [{ metrica: "commentsCount", value: 20, observedAt: "2026-09-01T00:00:00Z" }];
  const eng = engagementDePublicacion(metricas);
  assert.equal(eng.total, 20);
});

test("D) TikTok: likes se preserva (ya funcionaba, no debe romperse)", () => {
  const metricas = [{ metrica: "likes", value: 445, observedAt: "2026-09-01T00:00:00Z" }];
  const eng = engagementDePublicacion(metricas);
  assert.equal(eng.total, 445);
  assert.equal(eng.fuentes[0].canonicalMetric, METRICAS_CANONICAS.LIKES);
});

test("E) TikTok: shares se preserva vía REPOSTS ∪ SHARES", () => {
  const metricas = [
    { metrica: "likes", value: 445, observedAt: "2026-09-01T00:00:00Z" },
    { metrica: "shares", value: 52, observedAt: "2026-09-01T00:00:00Z" }
  ];
  const eng = engagementDePublicacion(metricas);
  assert.equal(eng.total, 497);
});

test("F) Instagram oficial: likes=null permanece missing, nunca se convierte en 0", () => {
  const metricas = [
    { metrica: "likes", value: null, observedAt: "2026-09-01T00:00:00Z" },
    { metrica: "comments", value: 10, observedAt: "2026-09-01T00:00:00Z" }
  ];
  const eng = engagementDePublicacion(metricas);
  assert.equal(eng.total, 10); // solo comments, likes ausente no resta ni suma 0
  assert.equal(eng.fuentes.length, 1);
  assert.equal(eng.fuentes[0].canonicalMetric, METRICAS_CANONICAS.COMMENTS_COUNT);
});

test("G) Instagram fallback (scrapecreators): commentsCount mapeado correctamente", () => {
  const metricas = [
    { metrica: "likes", value: 57, observedAt: "2026-09-01T00:00:00Z" },
    { metrica: "commentsCount", value: 5, observedAt: "2026-09-01T00:00:00Z" }
  ];
  const eng = engagementDePublicacion(metricas);
  assert.equal(eng.total, 62);
});

test("attention nunca se mezcla con engagement (views es una unidad separada)", () => {
  const metricas = [
    { metrica: "likes", value: 100, observedAt: "2026-09-01T00:00:00Z" },
    { metrica: "views", value: 5000, observedAt: "2026-09-01T00:00:00Z" }
  ];
  const eng = engagementDePublicacion(metricas);
  const att = attentionDePublicacion(metricas);
  assert.equal(eng.total, 100);
  assert.equal(att.total, 5000);
});

test("anti-double-counting: comments/commentsCount nunca se suman ambos si coexisten en la misma pieza", () => {
  const metricas = [
    { metrica: "comments", value: 9, observedAt: "2026-09-01T00:00:00Z" },
    { metrica: "commentsCount", value: 9, observedAt: "2026-09-02T00:00:00Z" }
  ];
  const canon = normalizarMetricasDeContenido(metricas);
  // ambos mapean a COMMENTS_COUNT: se queda con el mas reciente, nunca 18
  assert.equal(canon[METRICAS_CANONICAS.COMMENTS_COUNT].value, 9);
});

test("re-observaciones de la misma sourceMetric usan solo la ultima (no se suman)", () => {
  const metricas = [
    { metrica: "likes", value: 5, observedAt: "2026-08-28T00:00:00Z" },
    { metrica: "likes", value: 12, observedAt: "2026-09-03T00:00:00Z" }
  ];
  const eng = engagementDePublicacion(metricas);
  assert.equal(eng.total, 12);
});

test("metrica desconocida no se inventa una equivalencia", () => {
  const canon = normalizarMetricasDeContenido([{ metrica: "quotes", value: 3, observedAt: "2026-09-01T00:00:00Z" }]);
  assert.deepEqual(canon, {});
});

test("sin ninguna metrica de engagement real, devuelve null (missing, no 0)", () => {
  assert.equal(engagementDePublicacion([]), null);
  assert.equal(engagementDePublicacion([{ metrica: "likes", value: null, observedAt: "2026-09-01T00:00:00Z" }]), null);
});

test("metricaCanonicaDe resuelve alias conocidos y null para desconocidos", () => {
  assert.equal(metricaCanonicaDe("reactions"), METRICAS_CANONICAS.REACTIONS);
  assert.equal(metricaCanonicaDe("commentsCount"), METRICAS_CANONICAS.COMMENTS_COUNT);
  assert.equal(metricaCanonicaDe("algo_desconocido"), null);
});
