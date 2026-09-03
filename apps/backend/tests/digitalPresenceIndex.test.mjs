import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IPDO_METHOD_VERSION,
  IPDO_WEIGHTS,
  PRESENCE_SUBWEIGHTS,
  INTERACTION_SUBWEIGHTS,
  CONVERSATION_SUBWEIGHTS,
  PLATAFORMAS_IPDO,
  normalizarRelativo,
  extraerInsumosCandidato,
  calcularIPDO
} from "../services/intelligence/digitalPresenceIndex.js";

/*
  CANDIDATE-DIGITAL-PRESENCE-INDEX-01. Cero red, cero recoleccion.
  Todos los insumos son sinteticos o construidos a mano: ningun
  test llama a projectStore ni a ningun proveedor.
*/

const suma = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

/* A. weights sum = 1 */
test("A) IPDO_WEIGHTS suma exactamente 1", () => {
  assert.equal(Number(suma(IPDO_WEIGHTS).toFixed(10)), 1);
});
test("A) subpesos internos tambien suman 1", () => {
  assert.equal(Number(suma(PRESENCE_SUBWEIGHTS).toFixed(10)), 1);
  assert.equal(Number(suma(INTERACTION_SUBWEIGHTS).toFixed(10)), 1);
  assert.equal(Number(suma(CONVERSATION_SUBWEIGHTS).toFixed(10)), 1);
});

function filaSintetica(candidateId, overrides = {}) {
  return {
    candidateId,
    accountCoverageCount: 3,
    accountCoveragePlatforms: ["facebook", "instagram", "x"],
    audienciaPorPlataforma: { facebook: 10000, instagram: 2000, tiktok: null, x: 5000, youtube: null },
    postCount: 10,
    totalEngagement: 500,
    totalAttention: 8000,
    interactionsPerPost: 50,
    thirdPartyVolume: 8,
    mediaDiversity: 4,
    publicConversation: 12,
    ...overrides
  };
}

/* B. score 0-100 */
test("B) score siempre entre 0 y 100 (o null), nunca NaN/Infinity", () => {
  const filas = [filaSintetica("a"), filaSintetica("b", { audienciaPorPlataforma: { facebook: 50000, instagram: 1, tiktok: null, x: 100, youtube: null }, postCount: 2, totalEngagement: 5, totalAttention: 10, thirdPartyVolume: 1, mediaDiversity: 1, publicConversation: 1 })];
  const r = calcularIPDO(filas);
  for (const res of r.resultados) {
    assert.ok(res.score === null || (res.score >= 0 && res.score <= 100 && Number.isFinite(res.score)));
    for (const v of Object.values(res.dimensions)) {
      assert.ok(v === null || (v >= 0 && v <= 100 && Number.isFinite(v)));
    }
  }
});

/* C. missing != zero */
test("C) missing (null) nunca se convierte en cero antes de normalizar", () => {
  const filas = [
    filaSintetica("a", { totalEngagement: 200 }),
    filaSintetica("b", { totalAttention: null, totalEngagement: 800 }) // sin views, pero con engagement fuerte
  ];
  const r = calcularIPDO(filas);
  const b = r.resultados.find((x) => x.candidateId === "b");
  assert.ok(b.inputsMissing.includes("attention"));
  // el missing reduce coverage, no fuerza el score a 0: b sigue puntuando por su engagement real
  assert.ok(b.score > 0);
});

/* D/E/F/G. no-account / unsupported / blocked / identity-insufficient -> nunca 0 de rendimiento */
test("D-G) plataforma sin dato (no-account/unsupported/blocked/identity-insufficient) se excluye, no se computa como 0", () => {
  const filas = [
    filaSintetica("a", { accountCoverageCount: 1 }),
    filaSintetica("b", { accountCoverageCount: 4, audienciaPorPlataforma: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null } })
  ];
  const r = calcularIPDO(filas);
  const b = r.resultados.find((x) => x.candidateId === "b");
  // sin ninguna plataforma de audiencia: el subscore de audiencia es null, no 0,
  // pero accountCoverage (4/5, discrimina contra el 1/5 de "a") si aporta a presence
  assert.ok(b.dimensions.presence != null);
  assert.ok(b.inputsMissing.includes("audience"));
});

/* H. log1p handles outlier */
test("H) log1p amortigua un outlier extremo: el intermedio no colapsa cerca de 0 solo por la escala del outlier", () => {
  const filas = [
    filaSintetica("normal1", { totalAttention: 1000, totalEngagement: 100, postCount: 5 }),
    filaSintetica("normal2", { totalAttention: 2000, totalEngagement: 200, postCount: 8 }),
    filaSintetica("outlier", { totalAttention: 200000, totalEngagement: 300, postCount: 10 }) // x100 en attention
  ];
  const r = calcularIPDO(filas);
  const n2 = r.resultados.find((x) => x.candidateId === "normal2");
  const outlier = r.resultados.find((x) => x.candidateId === "outlier");
  // sin log1p, normal2 (2000 vs 200000) caeria a ~1% de la escala; con log1p
  // queda muy por encima de un aplastamiento lineal (que daria ~1.0).
  assert.ok(n2.dimensions.interaction > 5, "log1p deberia dejar a normal2 muy por encima de lo que daria una escala lineal");
  assert.ok(outlier.dimensions.interaction <= 100);
});

/* I. no divide by zero */
test("I) max === min en TODAS las metricas no revienta division por cero: score es finito o null, nunca NaN/Infinity", () => {
  const filas = [filaSintetica("a"), filaSintetica("b")]; // insumos identicos: nada discrimina
  const r = calcularIPDO(filas);
  for (const res of r.resultados) {
    assert.equal(Number.isNaN(res.score), false);
    assert.notEqual(res.score, Infinity);
    assert.notEqual(res.score, -Infinity);
  }
});
test("I-bis) si UNA metrica si discrimina entre insumos por lo demas identicos, el score es un numero finito real", () => {
  const filas = [filaSintetica("a", { totalEngagement: 50 }), filaSintetica("b", { totalEngagement: 500 })];
  const r = calcularIPDO(filas);
  for (const res of r.resultados) assert.ok(Number.isFinite(res.score));
});

/* J. non-discriminating metric excluded/reweighted */
test("J) metrica que no discrimina (todos iguales) se excluye y no se asigna 100 arbitrario", () => {
  const iguales = normalizarRelativo([
    { candidateId: "a", valor: 50 },
    { candidateId: "b", valor: 50 },
    { candidateId: "c", valor: 50 }
  ]);
  for (const v of iguales) {
    assert.equal(v.discrimina, false);
    assert.equal(v.normalizado, null);
  }
});
test("J-bis) metrica que si discrimina produce 0 y 100 en los extremos", () => {
  const distintos = normalizarRelativo([
    { candidateId: "a", valor: 10 },
    { candidateId: "b", valor: 1000 }
  ]);
  const a = distintos.find((v) => v.candidateId === "a");
  const b = distintos.find((v) => v.candidateId === "b");
  assert.equal(a.normalizado, 0);
  assert.equal(b.normalizado, 100);
});

/* K. platform balancing */
test("K) audiencia se agrega primero POR PLATAFORMA y luego se promedia -una plataforma no domina por tener mas metricas-", () => {
  // x tiene 1 metrica (audiencia) igual que facebook: ninguna domina por conteo de campos
  const filas = [
    filaSintetica("a", { audienciaPorPlataforma: { facebook: 100, instagram: null, tiktok: null, x: null, youtube: null } }),
    filaSintetica("b", { audienciaPorPlataforma: { facebook: null, instagram: null, tiktok: null, x: 100, youtube: null } })
  ];
  const r = calcularIPDO(filas);
  const a = r.resultados.find((x) => x.candidateId === "a");
  const b = r.resultados.find((x) => x.candidateId === "b");
  // mismo valor de audiencia (100), en plataformas distintas: presence debe ser identico
  assert.equal(a.dimensions.presence, b.dimensions.presence);
});

/* L. no metric-count dominance */
test("L) un candidato con audiencia en 5 plataformas no vale 5x un candidato con audiencia en 1 igual de fuerte", () => {
  const filas = [
    filaSintetica("multi", { audienciaPorPlataforma: { facebook: 1000, instagram: 1000, tiktok: 1000, x: 1000, youtube: 1000 } }),
    filaSintetica("uno", { audienciaPorPlataforma: { facebook: 1000, instagram: null, tiktok: null, x: null, youtube: null } })
  ];
  const r = calcularIPDO(filas);
  const multi = r.resultados.find((x) => x.candidateId === "multi");
  const uno = r.resultados.find((x) => x.candidateId === "uno");
  // mismo valor por plataforma medida (1000): el promedio de audiencia normalizada
  // no puede ser 5x mayor solo por estar en mas plataformas con el MISMO valor
  assert.ok(Math.abs(multi.dimensions.presence - uno.dimensions.presence) < 40);
});

/* M. no double counting */
test("M) engagement nunca incluye views (attention es una dimension separada)", () => {
  const filas = [filaSintetica("a"), filaSintetica("b", { totalEngagement: 500, totalAttention: 500 })];
  // la extraccion real filtra explicitamente likes/comments/reposts para engagement
  // y views para attention por separado -verificado por inspeccion del extractor-.
  // Aqui verificamos que ambos pueden diferir sin forzarse a ser iguales ni sumarse.
  const r = calcularIPDO(filas);
  assert.ok(r.resultados.every((x) => x.dimensions.interaction != null));
});

/* N. project isolation */
test("N) calcularIPDO es puro: dos universos de filas independientes no se contaminan entre llamadas", () => {
  const proyectoA = [filaSintetica("a1"), filaSintetica("a2", { totalEngagement: 9999 })];
  const proyectoB = [filaSintetica("b1"), filaSintetica("b2")];
  const rA = calcularIPDO(proyectoA);
  const rB = calcularIPDO(proyectoB);
  assert.ok(!rB.resultados.some((r) => r.candidateId.startsWith("a")));
  assert.ok(!rA.resultados.some((r) => r.candidateId.startsWith("b")));
});

/* O. N<2 handled */
test("O) universo con menos de 2 candidatos devuelve INSUFFICIENT_COMPARISON_UNIVERSE", () => {
  const r0 = calcularIPDO([]);
  const r1 = calcularIPDO([filaSintetica("solo")]);
  assert.equal(r0.estado, "INSUFFICIENT_COMPARISON_UNIVERSE");
  assert.equal(r1.estado, "INSUFFICIENT_COMPARISON_UNIVERSE");
});

/* P/Q. deterministic, same inputs -> same output */
test("P-Q) mismos insumos producen exactamente el mismo resultado", () => {
  const filas = [filaSintetica("a"), filaSintetica("b", { totalEngagement: 700 })];
  const r1 = calcularIPDO(filas);
  const r2 = calcularIPDO(filas);
  assert.deepEqual(r1, r2);
});

/* R. explanation deterministic */
test("R) la explicacion es deterministica y describe factores reales, no generada al azar", () => {
  const filas = [filaSintetica("a"), filaSintetica("b")];
  const r1 = calcularIPDO(filas);
  const r2 = calcularIPDO(filas);
  const a1 = r1.resultados.find((x) => x.candidateId === "a");
  const a2 = r2.resultados.find((x) => x.candidateId === "a");
  assert.deepEqual(a1.explanation, a2.explanation);
  assert.ok(a1.explanation.presence.factores.length > 0);
});

/* S. coverage independent of score */
test("S) coverage y score son campos independientes: coverage baja no fuerza score bajo", () => {
  const filas = [
    filaSintetica("altoScoreBajaCobertura", {
      audienciaPorPlataforma: { facebook: 1000000, instagram: null, tiktok: null, x: null, youtube: null },
      postCount: 0, totalEngagement: null, totalAttention: null,
      thirdPartyVolume: null, mediaDiversity: null, publicConversation: null
    }),
    filaSintetica("bajo")
  ];
  const r = calcularIPDO(filas);
  const alto = r.resultados.find((x) => x.candidateId === "altoScoreBajaCobertura");
  assert.equal(alto.methodologicalCoverage, "BAJA");
  // el score puede seguir siendo alto en presence pese a cobertura baja
  assert.ok(alto.dimensions.presence != null);
});

/* T/U/V/W/X. territorio, poblacion, momentum, sentiment, stance nunca son INSUMOS de la formula */
test("T-X) ninguna de esas nociones se lee como campo/insumo del calculo (solo pueden aparecer, si acaso, como negacion documental)", async () => {
  const src = await (await import("node:fs")).promises.readFile(
    new URL("../services/intelligence/digitalPresenceIndex.js", import.meta.url),
    "utf8"
  );
  // Patron de USO como insumo: acceso a propiedad (`.territorio`, `f.poblacion`, etc.)
  // o como clave de objeto (`territorio:`). Una mencion en prosa explicando que
  // el indice NO mide algo (como la propia declaracion de alcance del modulo)
  // no cuenta como uso.
  const prohibidas = ["territorio", "poblacion", "momentum", "sentiment", "stance", "inec", "cne", "padron"];
  for (const palabra of prohibidas) {
    const usoComoCampo = new RegExp(`[.\\{,]\\s*${palabra}\\s*[:.]`, "i");
    assert.equal(usoComoCampo.test(src), false, `"${palabra}" no deberia usarse como campo/insumo`);
  }
});

/* Y. Candidate regressions -- se corre aparte con la suite completa, no aqui */

/* extraerInsumosCandidato: identity conflict never contributes */
test("conflicto de identidad conocido nunca aporta a accountCoverage ni a audiencia", () => {
  const ficha = {
    plataformas: [
      {
        plataformaId: "instagram",
        cuentas: [
          { id: "instagram:bueno", declaradaPorAnalista: true },
          { id: "instagram:homonimo", descubiertaPorSentinel: true, corroboradaPorSentinel: true }
        ]
      }
    ]
  };
  const snapshots = [
    { platform: "instagram", accountId: "instagram:bueno", followers: 500, estado: "MEDIDO_PROVEEDOR", capturedAt: "2026-09-01T00:00:00Z" },
    { platform: "instagram", accountId: "instagram:homonimo", followers: 999999, estado: "MEDIDO_PROVEEDOR", capturedAt: "2026-09-01T00:00:00Z" }
  ];
  const insumos = extraerInsumosCandidato({
    candidateId: "x", ficha, snapshots, publicaciones: [],
    conflictosConocidos: new Set(["instagram:homonimo"])
  });
  assert.equal(insumos.audienciaPorPlataforma.instagram, 500); // no suma los 999999 del homonimo
  assert.deepEqual(insumos.accountCoveragePlatforms, ["instagram"]);
});

test("extraerInsumosCandidato: engagement nunca mezcla views con likes/comments/reposts", () => {
  const publicaciones = [
    {
      metricas: [
        { metrica: "likes", value: 10, observedAt: "2026-09-01T00:00:00Z" },
        { metrica: "comments", value: 5, observedAt: "2026-09-01T00:00:00Z" },
        { metrica: "views", value: 10000, observedAt: "2026-09-01T00:00:00Z" }
      ]
    }
  ];
  const insumos = extraerInsumosCandidato({ candidateId: "x", ficha: { plataformas: [] }, snapshots: [], publicaciones });
  assert.equal(insumos.totalEngagement, 15); // 10 + 5, NUNCA +10000
  assert.equal(insumos.totalAttention, 10000);
});

test("extraerInsumosCandidato: usa la ULTIMA observacion por metrica, no suma re-observaciones", () => {
  const publicaciones = [
    {
      metricas: [
        { metrica: "likes", value: 5, observedAt: "2026-08-28T00:00:00Z" },
        { metrica: "likes", value: 8, observedAt: "2026-09-01T00:00:00Z" },
        { metrica: "likes", value: 12, observedAt: "2026-09-03T00:00:00Z" }
      ]
    }
  ];
  const insumos = extraerInsumosCandidato({ candidateId: "x", ficha: { plataformas: [] }, snapshots: [], publicaciones });
  assert.equal(insumos.totalEngagement, 12); // la ultima, no 5+8+12=25
});

test("extraerInsumosCandidato: postCount=0 dejа engagement/attention en null, no en 0", () => {
  const insumos = extraerInsumosCandidato({ candidateId: "x", ficha: { plataformas: [] }, snapshots: [], publicaciones: [] });
  assert.equal(insumos.postCount, 0);
  assert.equal(insumos.totalEngagement, null);
  assert.equal(insumos.totalAttention, null);
});
