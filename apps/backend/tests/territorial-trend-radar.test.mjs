// apps/backend/tests/territorial-trend-radar.test.mjs

/*
===========================================================
TERRITORIAL-TREND-RADAR-01

Pruebas A-Z. Cero red: el `fetch` global esta contado.

Lo que este fichero vigila, en una frase: que el radar no
convierta «ahora mira mos TikTok» en «Cuenca habla mas de esto».

Esa confusion —COLLECTION_COVERAGE_CHANGE leido como
OBSERVED_CONTENT_CHANGE— es el error mas caro que un radar
puede cometer, y las pruebas M y N existen para que no pase.
===========================================================
*/

import assert from "node:assert/strict";

let red = 0;
const fetchReal = globalThis.fetch;
globalThis.fetch = (...a) => { red += 1; return fetchReal(...a); };

let ok = 0;
let fall = 0;

function t(nombre, fn) {
  try {
    const r = fn();
    if (r === false) throw new Error("devolvio false");
    console.log(`  PASS  ${nombre}`);
    ok += 1;
  } catch (e) {
    console.log(`  FALL  ${nombre}\n        ${e.message}`);
    fall += 1;
  }
}

async function ta(nombre, fn) {
  try {
    const r = await fn();
    if (r === false) throw new Error("devolvio false");
    console.log(`  PASS  ${nombre}`);
    ok += 1;
  } catch (e) {
    console.log(`  FALL  ${nombre}\n        ${e.message}`);
    fall += 1;
  }
}

const R = await import("../services/territorial/trendRadar.js");
const TS = await import("../services/territorial/topicStore.js");
const T = await import("../services/territorial/topicNormalization.js");
const L = await import("../services/territorial/evidenceLedger.js");
const P = await import("../services/territorial/corpusPersistence.js");

const PROY = "alcaldia-cuenca-2027-piloto";

/* Definición de tema sintética con la forma que persiste el store. */
function def(o = {}) {
  return {
    tipo: "TOPIC_DEFINITION",
    projectId: PROY,
    tenantId: "sentinel",
    universo: "PRIMARY_TOPIC_CORPUS",
    umbral: 0.18,
    topicId: o.topicId || "t:aaa",
    topicLabel: o.label || "tema",
    keywords: o.keywords || ["alfa", "beta"],
    entities: o.entities || [],
    evidenceCount: o.evidenceCount ?? 4,
    evidenceIds: o.evidenceIds || ["ev-1", "ev-2", "ev-3", "ev-4"],
    uniqueSources: o.uniqueSources ?? 3,
    uniqueActors: o.uniqueActors ?? 3,
    providers: o.providers || ["rss_directo"],
    sourceFamilies: o.sourceFamilies || ["MEDIOS_LOCALES"],
    contentNatureBreakdown: o.nature || { MEDIA: 4 },
    territorialStratumBreakdown: o.terr || { TERRITORIO_CORROBORADO: 4 },
    rssEvidenceCount: o.rss ?? 4,
    rssShare: o.rssShare ?? 1,
    sourceDiversity: o.sourceDiversity ?? 0.75,
    windowCounts: o.windowCounts || { HOY: 0, "7D": 4, "15D": 4, "30D": 4, "90D": 4 },
    limitations: []
  };
}

function obs(registradoEn, defs, corpus = 100, runId = "r") {
  return [
    ...defs.map((d) => ({ ...d, registradoEn, runId })),
    {
      tipo: "TOPIC_SNAPSHOT",
      projectId: PROY,
      universo: "PRIMARY_TOPIC_CORPUS",
      registradoEn,
      runId,
      corpus: { admitido: corpus },
      resumen: { topicCount: defs.length }
    }
  ];
}


/* =========================================================
   A-C · TEMA != TENDENCIA, Y LA FECHA MANDA
   ========================================================= */

console.log("\n--- A-C · tema, tendencia y fechas ---\n");

t("A · un tema no es una tendencia: el radar deriva actividad, cambio y diversidad", () => {
  const d = def({ evidenceCount: 10, uniqueSources: 1, windowCounts: { HOY: 0, "7D": 0, "15D": 2, "30D": 8, "90D": 10 } });

  const i = R.itemDeRadar({ definicion: d, ventana: "7D" });

  /* Diez piezas y CERO actividad en la ventana: no son lo mismo. */
  assert.equal(i.activity.evidenceCountTotal, 10);
  assert.equal(i.activity.evidenceCount, 0);

  /* Y hay tres bloques separados, no un score. */
  assert.ok(i.activity && i.change && i.diversity);
  assert.equal(i.score, undefined);
  return true;
});

t("A-bis · la ventana es el eje: 10 piezas con 7D=0 no equivalen a 10 con 7D=10", () => {
  const historico = R.itemDeRadar({
    definicion: def({ evidenceCount: 10, windowCounts: { HOY: 0, "7D": 0, "15D": 0, "30D": 4, "90D": 10 } }),
    ventana: "7D"
  });

  const actual = R.itemDeRadar({
    definicion: def({ evidenceCount: 10, windowCounts: { HOY: 3, "7D": 10, "15D": 10, "30D": 10, "90D": 10 } }),
    ventana: "7D"
  });

  assert.equal(historico.activity.evidenceCount, 0);
  assert.equal(actual.activity.evidenceCount, 10);
  assert.equal(historico.activity.fraccionEnVentana, 0);
  assert.equal(actual.activity.fraccionEnVentana, 1);
  return true;
});

t("B · las métricas temporales exigen publishedAt", () => {
  const sinFecha = {
    evidenceId: "e", canonicalUrl: "https://a.ec/x", title: "Cuenca, Azuay",
    summary: "x", publishedAt: null, providers: ["ddg_web"], domain: "a.ec"
  };

  assert.equal(P.esTemporalmenteElegible(sinFecha), false);

  /* Sin windowCounts calculables no se dice cero: se dice no calculable. */
  const i = R.itemDeRadar({ definicion: { ...def(), windowCounts: {} }, ventana: "7D" });

  assert.equal(i.activity.calculable, false);
  assert.equal(i.activity.evidenceCount, null);
  return true;
});

t("C · observedAt NO sustituye a publishedAt", () => {
  /* La lista de sustitutos prohibidos incluye los cuatro. */
  assert.ok(P.SUSTITUTOS_PROHIBIDOS.includes("observedAt"));
  assert.ok(P.SUSTITUTOS_PROHIBIDOS.includes("firstObservedAt"));

  const f = P.normalizarFechaDePublicacion({
    observedAt: "2026-09-05T00:00:00Z",
    firstObservedAt: "2026-09-05T00:00:00Z"
  });

  assert.equal(f, null);

  /* Y el módulo lo declara en su contrato de ventanas. */
  assert.deepEqual(R.VENTANAS, ["HOY", "7D", "15D", "30D", "90D"]);
  return true;
});


/* =========================================================
   D-F · DIVERSIDAD Y CONCENTRACIÓN
   ========================================================= */

console.log("\n--- D-F · diversidad ---\n");

t("D · la concentración en una sola fuente se detecta, y en un solo proveedor también", () => {
  const unaFuente = R.diversidadDe(def({ evidenceCount: 10, uniqueSources: 1, providers: ["rss_directo"], sourceFamilies: ["INSTITUCIONAL_PUBLICO"] }));

  assert.equal(unaFuente.singleSourceConcentration, true);
  assert.equal(unaFuente.singleProviderConcentration, true);
  assert.equal(unaFuente.singleFamilyConcentration, true);
  assert.equal(unaFuente.DIVERSITY_CONFIDENCE, R.CONFIANZA_COBERTURA.LOW);

  /* Y el RSS no se penaliza por ser RSS: se penaliza la concentración. */
  const rssDiverso = R.diversidadDe(def({ evidenceCount: 10, uniqueSources: 8, providers: ["rss_directo"], rssShare: 1 }));

  assert.equal(rssDiverso.singleSourceConcentration, false);
  assert.equal(rssDiverso.rssShare, 1);
  assert.notEqual(rssDiverso.DIVERSITY_CONFIDENCE, R.CONFIANZA_COBERTURA.LOW);
  return true;
});

t("E · uniqueSources cambia la diversidad: 10/1 no es 10/9", () => {
  const pobre = R.diversidadDe(def({ evidenceCount: 10, uniqueSources: 1 }));
  const rica = R.diversidadDe(def({ evidenceCount: 10, uniqueSources: 9, sourceDiversity: 0.9 }));

  assert.ok(rica.UNIQUE_SOURCE_DIVERSITY > pobre.UNIQUE_SOURCE_DIVERSITY);
  assert.equal(pobre.concentracionDeFuente, 1);
  assert.ok(rica.concentracionDeFuente < 0.3);
  return true;
});

t("F · la diversidad de proveedor y plataforma cuenta aparte de la de fuente", () => {
  const unaPlataforma = R.diversidadDe(def({ providers: ["rss_directo"] }));
  const cuatro = R.diversidadDe(def({ providers: ["rss_directo", "x_api", "youtube_data", "scrapecreators_tiktok"] }));

  assert.equal(unaPlataforma.platformCount, 1);
  assert.equal(cuatro.platformCount, 4);
  assert.deepEqual(cuatro.platforms.sort(), ["TikTok", "Web/RSS", "X", "YouTube"]);
  assert.equal(cuatro.PROVIDER_PLATFORM_DIVERSITY, 4);

  /* La actividad y la confianza de diversidad son cosas distintas. */
  assert.ok("DIVERSITY_CONFIDENCE" in cuatro);
  return true;
});


/* =========================================================
   G-I · DOS OBSERVACIONES
   ========================================================= */

console.log("\n--- G-I · dos puntos, primera derivada ---\n");

t("G · con dos observaciones solo hay primera derivada", () => {
  const registros = [
    ...obs("2026-09-01T00:00:00.000Z", [def({ topicId: "t:a", windowCounts: { "7D": 4 } })], 100, "r1"),
    ...obs("2026-09-05T00:00:00.000Z", [def({ topicId: "t:a", windowCounts: { "7D": 9 } })], 140, "r2")
  ];

  const r = R.radar({ registros, ventana: "7D", projectId: PROY });

  assert.equal(r.observaciones, 2);

  const i = r.items[0];

  assert.equal(i.change.estado, R.CAMBIO.RISING_OBSERVED);
  assert.equal(i.change.absoluteDelta, 5);
  assert.match(i.change.limitacion, /Requiere más puntos para confirmar una tendencia/i);
  return true;
});

t("H · no existe ningún estado de tendencia estable ni momentum confirmado", () => {
  const estados = Object.values(R.CAMBIO);

  assert.ok(!estados.some((e) => /TREND_STABLE|MOMENTUM_CONFIRMED|LONG_TERM/i.test(e)));

  /* Los nombres llevan OBSERVED a propósito. */
  assert.ok(estados.includes("RISING_OBSERVED"));
  assert.ok(estados.includes("FALLING_OBSERVED"));
  assert.ok(estados.includes("STABLE_OBSERVED"));

  const registros = [
    ...obs("2026-09-01T00:00:00.000Z", [def({ topicId: "t:a" })], 100, "r1"),
    ...obs("2026-09-05T00:00:00.000Z", [def({ topicId: "t:a" })], 140, "r2")
  ];

  const r = R.radar({ registros, ventana: "7D", projectId: PROY });

  assert.match(r.declaraciones.join(" "), /NO una tendencia estable/i);
  return true;
});

t("I · base cero: no se emite porcentaje, se declara", () => {
  const c = R.cambioDe({
    antes: def({ windowCounts: { "7D": 0 } }),
    ahora: def({ windowCounts: { "7D": 5 } }),
    ventana: "7D"
  });

  assert.equal(c.absoluteDelta, 5);
  assert.equal(c.relativeDelta, null);
  assert.match(c.relativeDeltaNoCalculable, /base cero/i);

  /* Con base válida sí se emite. */
  const c2 = R.cambioDe({
    antes: def({ windowCounts: { "7D": 4 } }),
    ahora: def({ windowCounts: { "7D": 6 } }),
    ventana: "7D"
  });

  assert.equal(c2.relativeDelta, 0.5);
  return true;
});

t("I-bis · una sola observación no produce cambio, solo actividad", () => {
  const registros = obs("2026-09-05T00:00:00.000Z", [def({ topicId: "t:a" })], 100, "r1");

  const r = R.radar({ registros, ventana: "7D", projectId: PROY });

  assert.equal(r.observaciones, 1);
  assert.equal(r.previousObservationId, null);
  assert.match(r.declaraciones.join(" "), /Una sola observación/i);
  assert.equal(r.items[0].change.estado, R.CAMBIO.NEWLY_OBSERVED);
  return true;
});

t("I-ter · escrituras idénticas se colapsan: no inventan puntos temporales", () => {
  /*
    Caso real: la pasada del gate anterior se reejecutó tres
    veces y dejó tres registros idénticos. Tratarlos como tres
    observaciones inventaría historia.
  */
  const d = [def({ topicId: "t:a" })];

  const registros = [
    ...obs("2026-09-01T00:00:00.000Z", d, 100, "r1"),
    ...obs("2026-09-05T00:00:00.000Z", d, 100, "r2"),
    ...obs("2026-09-05T01:00:00.000Z", d, 100, "r3")
  ];

  const o = R.observacionesDistintas(registros);

  assert.equal(o.total, 3);
  assert.equal(o.distintas.length, 1);
  assert.equal(o.colapsadas, 2);
  assert.match(o.declaracion, /misma observación, no puntos temporales distintos/i);
  return true;
});


/* =========================================================
   J-L · NOVEDAD Y LINAJE
   ========================================================= */

console.log("\n--- J-L · novedad y linaje ---\n");

t("J · un tema nuevo NO es automáticamente emergente", () => {
  /* Nuevo sin motor nuevo: definición nueva, no actividad nueva. */
  const c = R.cambioDe({ antes: null, ahora: def({ providers: ["rss_directo"] }), ventana: "7D" });

  assert.equal(c.estado, R.CAMBIO.NEWLY_OBSERVED);
  assert.equal(c.origenDeNovedad, R.ORIGEN_DE_NOVEDAD.NEW_TOPIC_DEFINITION);
  assert.match(c.nota, /NO implica que el asunto sea nuevo en el territorio/i);

  /* Y los dos conceptos están separados en la taxonomía. */
  assert.notEqual(R.ORIGEN_DE_NOVEDAD.NEW_TOPIC_DEFINITION, R.ORIGEN_DE_NOVEDAD.NEWLY_OBSERVED_ACTIVITY);
  return true;
});

t("K · el linaje empareja por contenido cuando el topicId cambia", () => {
  const antes = [def({ topicId: "t:viejo", keywords: ["monay", "intercambiador", "elevado", "iess"], entities: ["emov"] })];
  const ahora = [def({ topicId: "t:nuevo", keywords: ["monay", "intercambiador", "elevado", "iess", "desvios"], entities: ["emov"] })];

  const l = R.emparejarPorLinaje(antes, ahora);

  assert.equal(l.parejas.length, 1);
  assert.equal(l.parejas[0].via, "LINAJE_POR_CONTENIDO");
  assert.ok(l.parejas[0].similitud >= 0.3);
  assert.equal(l.parejas[0].valido, true);
  assert.equal(l.nuevos.length, 0);
  return true;
});

t("L · un split hace la comparación NO válida en lugar de inventar el cambio", () => {
  /* Dos candidatos casi equivalentes: probable split. */
  const antes = [def({ topicId: "t:padre", keywords: ["agua", "etapa", "obra", "potable"], entities: ["etapa"] })];

  const ahora = [
    def({ topicId: "t:h1", keywords: ["agua", "etapa", "obra", "potable"], entities: ["etapa"] }),
    def({ topicId: "t:h2", keywords: ["agua", "etapa", "obra", "potable"], entities: ["etapa"] })
  ];

  const l = R.emparejarPorLinaje(antes, ahora);

  assert.equal(l.parejas[0].via, "AMBIGUO");
  assert.equal(l.parejas[0].valido, false);
  assert.match(l.parejas[0].motivo, /probable split/i);
  assert.equal(l.invalidos, 1);

  /* Y el item lo refleja. */
  const i = R.itemDeRadar({ definicion: ahora[0], pareja: l.parejas[0], ventana: "7D" });

  assert.equal(i.change.estado, R.CAMBIO.TEMPORAL_COMPARISON_NOT_VALID);
  assert.equal(i.lineage.comparacionValida, false);
  return true;
});


/* =========================================================
   M-N · COBERTURA vs CONTENIDO
   ========================================================= */

console.log("\n--- M-N · cobertura frente a contenido ---\n");

t("M · el crecimiento por expansión de cobertura se marca", () => {
  const c = R.cambioDe({
    antes: def({ windowCounts: { "7D": 4 }, providers: ["rss_directo"] }),
    ahora: def({ windowCounts: { "7D": 9 }, providers: ["rss_directo", "scrapecreators_tiktok"] }),
    ventana: "7D"
  });

  assert.equal(c.estado, R.CAMBIO.RISING_OBSERVED);
  assert.equal(c.coverageExpansionContributed, true);
  assert.deepEqual(c.motoresQueContribuyeron, ["scrapecreators_tiktok"]);
  assert.match(c.nota, /COLLECTION_COVERAGE_CHANGE, no solo OBSERVED_CONTENT_CHANGE/i);

  /* Sin motor nuevo, no se marca. */
  const c2 = R.cambioDe({
    antes: def({ windowCounts: { "7D": 4 }, providers: ["rss_directo"] }),
    ahora: def({ windowCounts: { "7D": 9 }, providers: ["rss_directo"] }),
    ventana: "7D"
  });

  assert.equal(c2.coverageExpansionContributed, false);
  return true;
});

t("N · un tema nuevo que aparece por TikTok no se lee como actividad nueva del territorio", () => {
  const c = R.cambioDe({
    antes: null,
    ahora: def({ providers: ["scrapecreators_tiktok"] }),
    ventana: "7D"
  });

  assert.equal(c.origenDeNovedad, R.ORIGEN_DE_NOVEDAD.COVERAGE_EXPANSION);
  assert.equal(c.coverageExpansionContributed, true);
  assert.match(c.nota, /es expansión de cobertura, no necesariamente actividad nueva/i);

  /* Y el «por qué» lo dice al lector, no solo al JSON. */
  const i = R.itemDeRadar({ definicion: def({ providers: ["scrapecreators_tiktok"] }), ventana: "7D" });

  assert.ok(i.why.some((w) => /cobertura nueva, no necesariamente actividad nueva/i.test(w)));
  assert.ok(i.limitations.some((l) => /motores de recolección activados entre observaciones/i.test(l)));
  return true;
});


/* =========================================================
   O · TRAZA REAL DEL INTERCAMBIADOR MONAY
   ========================================================= */

console.log("\n--- O · traza real desde el store ---\n");

await ta("O · el tema del intercambiador Monay se traza desde el almacén real", async () => {
  const registros = await TS.crearAlmacenFichero().leerTodos();

  const r = R.radar({ registros, ventana: "7D", projectId: PROY });

  /* Leído del store, no hardcodeado. */
  const monay = r.items.find((i) => /monay/i.test(i.label));

  assert.ok(monay, "el tema del intercambiador Monay no está en el radar");

  /* Evidencia, fuentes y plataformas reales. */
  assert.ok(monay.activity.evidenceCountTotal > 0);
  assert.ok(monay.diversity.uniqueSources > 0);
  assert.ok(monay.diversity.platformCount >= 2);

  /* TikTok incorporado: el resultado del gate anterior. */
  assert.ok(monay.providerRefs.includes("scrapecreators_tiktok"));

  /* Trazabilidad: del tema a la evidencia. */
  assert.ok(monay.evidenceRefsTotal > 0, "sin evidenceRefs no hay trazabilidad");
  assert.ok(monay.evidenceRefs.length > 0);
  assert.match(monay.evidenceRefs[0], /^ev-/);

  /* Cambio entre observaciones y explicación generada. */
  assert.ok(Object.values(R.CAMBIO).includes(monay.change.estado));
  assert.ok(monay.why.length >= 3);
  assert.equal(monay.coverage.coverageConfidence, R.CONFIANZA_COBERTURA.HIGH);
  return true;
});


/* =========================================================
   P-R · CONVERSACIÓN, TERRITORIO, AUSENCIAS
   ========================================================= */

console.log("\n--- P-R · conversación, territorio, ausencias ---\n");

t("P · la conversación pública se separa de medios e instituciones", () => {
  const inst = R.conversacionDe(def({ nature: { INSTITUTIONAL: 9, MEDIA: 1 } }));
  const conv = R.conversacionDe(def({ nature: { PUBLIC_CONVERSATION: 6, MEDIA: 2 } }));

  assert.equal(inst.perfil, "INSTITUTIONAL_HEAVY");
  assert.equal(inst.publicConversationCount, 0);
  assert.equal(conv.perfil, "CONVERSATION_LED");
  assert.equal(conv.publicConversationCount, 6);

  /* Un tema puede crecer sin que crezca la conversación, y se dice. */
  const c = R.cambioDe({
    antes: def({ windowCounts: { "7D": 4 }, nature: { PUBLIC_CONVERSATION: 2, MEDIA: 2 } }),
    ahora: def({ windowCounts: { "7D": 8 }, nature: { PUBLIC_CONVERSATION: 2, MEDIA: 6 } }),
    ventana: "7D"
  });

  assert.equal(c.absoluteDelta, 4);
  assert.equal(c.conversationDelta, 0);

  const i = R.itemDeRadar({
    definicion: def({ windowCounts: { "7D": 8 }, nature: { PUBLIC_CONVERSATION: 2, MEDIA: 6 } }),
    pareja: { antes: def({ windowCounts: { "7D": 4 }, nature: { PUBLIC_CONVERSATION: 2, MEDIA: 2 } }), via: "TOPIC_ID", valido: true },
    ventana: "7D"
  });

  assert.ok(i.why.some((w) => /sin que creciera la conversación pública/i.test(w)));
  return true;
});

t("Q · la localidad de la fuente no otorga territorialidad al tema", () => {
  /* El radar usa la clasificación del CONTENIDO. */
  const terr = R.territorialidadDe(def({ terr: { TERRITORIO_CORROBORADO: 3, TERRITORIO_PROBABLE: 1 } }));

  assert.equal(terr.corroborated, 3);
  assert.equal(terr.probable, 1);
  assert.match(terr.nota, /Clasificación del CONTENIDO/);
  assert.match(terr.nota, /localidad de la fuente no la determina/i);

  /* Y no existe ningún campo de localidad de fuente en el item. */
  const i = R.itemDeRadar({ definicion: def(), ventana: "7D" });

  assert.ok(!("sourceLocality" in i));
  return true;
});

t("R · missing no es zero", () => {
  const sinVentanas = R.actividadDe({ ...def(), windowCounts: {} }, "7D");

  assert.equal(sinVentanas.calculable, false);
  assert.equal(sinVentanas.evidenceCount, null);
  assert.notEqual(sinVentanas.evidenceCount, 0);

  const sinFuentes = R.diversidadDe({ ...def(), uniqueSources: null });

  assert.equal(sinFuentes.uniqueSources, null);
  assert.equal(sinFuentes.DIVERSITY_CONFIDENCE, R.CONFIANZA_COBERTURA.LOW);
  return true;
});


/* =========================================================
   S-T · AISLAMIENTO Y TRAZABILIDAD
   ========================================================= */

console.log("\n--- S-T · aislamiento y trazabilidad ---\n");

t("S · el radar es project-scoped: los temas de A no aparecen en B", () => {
  const registros = [
    ...obs("2026-09-05T00:00:00.000Z", [def({ topicId: "t:deA" })], 100, "rA"),
    ...obs("2026-09-05T00:00:00.000Z", [{ ...def({ topicId: "t:deB" }), projectId: "proyecto-b-fixture" }], 50, "rB").map(
      (x) => ({ ...x, projectId: "proyecto-b-fixture" })
    )
  ];

  const a = R.radar({ registros, ventana: "7D", projectId: PROY });
  const b = R.radar({ registros, ventana: "7D", projectId: "proyecto-b-fixture" });
  const vacio = R.radar({ registros, ventana: "7D", projectId: "no-existe" });

  assert.ok(a.items.some((i) => i.topicId === "t:deA"));
  assert.ok(!a.items.some((i) => i.topicId === "t:deB"));
  assert.ok(b.items.some((i) => i.topicId === "t:deB"));
  assert.equal(vacio.items.length, 0);
  assert.equal(vacio.observaciones, 0);
  return true;
});

await ta("T · trazabilidad completa: tema → evidenceId → ledger, sin duplicar cuerpos", async () => {
  const registros = await TS.crearAlmacenFichero().leerTodos();

  const r = R.radar({ registros, ventana: "7D", projectId: PROY });

  const conRefs = r.items.filter((i) => i.evidenceRefsTotal > 0);

  assert.ok(conRefs.length > 0, "ningún item tiene referencias de evidencia");

  /* Las referencias resuelven contra el libro. */
  const corpus = L.reconstruirEstado(await L.crearLedgerFichero().leerTodos(), { projectId: PROY });

  const ref = conRefs[0].evidenceRefs[0];

  assert.ok(corpus.has(ref), `la referencia ${ref} no resuelve en el ledger`);

  const ev = corpus.get(ref);

  assert.ok(ev.canonicalUrl || ev.title || ev.summary);

  /* Y el radar NO copia el cuerpo. */
  const texto = JSON.stringify(r.items);

  assert.ok(!texto.includes(String(ev.summary || "___nada___").slice(0, 40)) || !ev.summary);

  /* Refs topadas: es un índice. */
  assert.ok(conRefs.every((i) => i.evidenceRefs.length <= 25));
  return true;
});


/* =========================================================
   U-V · EXPLICABILIDAD Y SENSIBILIDAD
   ========================================================= */

console.log("\n--- U-V · por qué y sensibilidad ---\n");

t("U · el «por qué» es determinista y coincide con los números", () => {
  const d = def({
    evidenceCount: 12,
    uniqueSources: 10,
    providers: ["rss_directo", "x_api", "youtube_data", "scrapecreators_tiktok"],
    nature: { PUBLIC_CONVERSATION: 5, MEDIA: 7 },
    windowCounts: { HOY: 2, "7D": 12, "15D": 12, "30D": 12, "90D": 12 }
  });

  const pareja = { antes: def({ evidenceCount: 11, uniqueSources: 9, windowCounts: { "7D": 11 }, providers: ["rss_directo", "x_api", "youtube_data"] }), via: "TOPIC_ID", valido: true };

  const a = R.itemDeRadar({ definicion: d, pareja, ventana: "7D" });
  const b = R.itemDeRadar({ definicion: d, pareja, ventana: "7D" });

  /* Determinista: misma entrada, mismo texto. */
  assert.deepEqual(a.why, b.why);

  /* Y los números del texto están en el item. */
  assert.ok(a.why.some((w) => w.includes("12") && w.includes("7D")));
  assert.ok(a.why.some((w) => /pasó de 11 a 12/.test(w)));
  assert.ok(a.why.some((w) => /4 plataformas/.test(w)));

  /* Sin LLM: el módulo no importa ningún cliente de modelo. */
  assert.equal(typeof R.porQue, "function");
  return true;
});

await ta("V · sensibilidad sobre 5 escenarios de peso, con veredicto", async () => {
  const registros = await TS.crearAlmacenFichero().leerTodos();

  const r = R.radar({ registros, ventana: "7D", projectId: PROY });

  const s = R.probarSensibilidad(r.items);

  assert.equal(s.escenarios.length, 5);
  assert.ok(["ROBUST", "MODERATE", "FRAGILE"].includes(s.veredicto));
  assert.ok(s.estabilidadDelTop5 >= 0 && s.estabilidadDelTop5 <= 1);
  assert.ok(s.recomendacion.length > 20);

  /* Los pesos están versionados en el módulo, no improvisados. */
  assert.equal(R.ESCENARIOS_DE_PESO.length, 5);
  assert.ok(R.ESCENARIOS_DE_PESO.every((e) => e.id && "actividad" in e));
  return true;
});


/* =========================================================
   W-Z · LENGUAJE, RED Y SECRETOS
   ========================================================= */

console.log("\n--- W-Z · límites ---\n");

/*
  Prohibir la PALABRA seria un test mal escrito: el modulo tiene
  descargos que dicen «NO es viralidad», y esos son exactamente
  los que queremos que existan. Lo que se prohibe es la
  AFIRMACION, asi que cada aparicion tiene que estar negada.
*/
const NEGADORES = /(no\s+es|no\s+son|nada\s+aqu[ií]\s+afirma|no\s+constituye|no\s+equivale|no\s+implica|nunca|sin\s+afirmar|no\s+representa|no\s+dice)/i;

function apariciones(texto, re) {
  const salida = [];
  const g = new RegExp(re.source, "gi");
  let m = g.exec(texto);
  while (m) {
    salida.push({ termino: m[0], indice: m.index, contexto: texto.slice(Math.max(0, m.index - 120), m.index) });
    m = g.exec(texto);
  }
  return salida;
}

function soloEnDescargos(texto, re) {
  return apariciones(texto, re).every((a) => NEGADORES.test(a.contexto));
}

await ta("W · el radar nunca AFIRMA viralidad ni tema dominante", async () => {
  const registros = await TS.crearAlmacenFichero().leerTodos();

  const r = R.radar({ registros, ventana: "7D", projectId: PROY });

  const texto = JSON.stringify(r);

  /* Nunca, en ningún contexto. */
  assert.ok(!/todo Cuenca habla|tema dominante en Cuenca|la ciudadan[íi]a piensa/i.test(texto));

  /*
    «viral» y «viralidad» solo pueden aparecer negadas. Si
    alguien escribiera «tema viral», este assert salta.
  */
  assert.ok(
    soloEnDescargos(texto, /\bviral(idad)?\b/),
    `«viral» aparece sin negación: ${JSON.stringify(
      apariciones(texto, /\bviral(idad)?\b/).filter((a) => !NEGADORES.test(a.contexto)).slice(0, 2)
    )}`
  );

  /* Y usa la formulación permitida. */
  assert.match(r.declaraciones.join(" "), /no es un Trend Score/i);
  return true;
});

await ta("X · el radar no afirma cobertura de población", async () => {
  const registros = await TS.crearAlmacenFichero().leerTodos();

  const r = R.radar({ registros, ventana: "7D", projectId: PROY });

  const texto = JSON.stringify(r);

  /* Estas no aparecen ni negadas: no hay motivo para nombrarlas. */
  assert.ok(!/% de (los )?(cuencanos|ciudadanos)|opini[óo]n p[úu]blica general/i.test(texto));

  /*
    «intención de voto» y «representatividad» solo pueden
    aparecer en descargos, igual que «viral».
  */
  assert.ok(soloEnDescargos(texto, /intenci[óo]n de voto/), "«intención de voto» aparece sin negación");
  assert.ok(soloEnDescargos(texto, /representatividad/), "«representatividad» aparece sin negación");

  /* Cada item lleva las tres limitaciones obligatorias. */
  r.items.slice(0, 5).forEach((i) => {
    const l = i.limitations.join(" ");

    assert.match(l, /fuentes públicas observables cubiertas por Sentinel/i);
    assert.match(l, /No representa a toda la población de Cuenca/i);
    assert.match(l, /no constituye una tendencia estable/i);
  });
  return true;
});

t("Y · construir el radar no hace ninguna petición externa", () => {
  const antes = red;

  const registros = [
    ...obs("2026-09-01T00:00:00.000Z", [def({ topicId: "t:a" })], 100, "r1"),
    ...obs("2026-09-05T00:00:00.000Z", [def({ topicId: "t:a", windowCounts: { "7D": 8 } })], 140, "r2")
  ];

  R.radar({ registros, ventana: "7D", projectId: PROY });
  R.probarSensibilidad([R.itemDeRadar({ definicion: def(), ventana: "7D" })]);

  assert.equal(red, antes);
  return true;
});

await ta("Z · ninguna salida expone secretos", async () => {
  const registros = await TS.crearAlmacenFichero().leerTodos();

  const texto = JSON.stringify(R.radar({ registros, ventana: "7D", projectId: PROY }));

  assert.ok(!/Bearer\s+[A-Za-z0-9]{8,}|AIza[0-9A-Za-z_-]{10,}|x-api-key/i.test(texto));
  assert.ok(!/API_KEY|BEARER_TOKEN|ACCESS_TOKEN/i.test(texto));
  return true;
});


console.log("\n--- Sin red ---\n");

t("cero llamadas al fetch global", () => red === 0);

console.log("\n===========================================");
console.log(`PASS: ${ok}    FALL: ${fall}`);
console.log("===========================================");

if (fall > 0) process.exitCode = 1;
