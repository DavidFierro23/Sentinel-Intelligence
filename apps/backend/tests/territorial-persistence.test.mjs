// apps/backend/tests/territorial-persistence.test.mjs

/*
===========================================================
TERRITORIAL-CORPUS-PERSISTENCE-01

Pruebas A-V del gate. Cero red: el `fetch` global esta contado.

El invariante que vigila casi todo este fichero:

    publishedAt   cuando se publico el contenido
    observedAt    cuando Sentinel lo vio

Si alguien anade un fallback del segundo al primero, una
evidencia sin fecha empieza a decir «publicado hoy» y nadie lo
puede detectar mirando el dato. Estas pruebas existen para que
salte antes.
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

const P = await import("../services/territorial/corpusPersistence.js");
const L = await import("../services/territorial/evidenceLedger.js");
const M = await import("../services/territorial/collectorMesh.js");
const S = await import("../services/territorial/searchIntelligence.js");
const D = await import("../services/territorial/socialGeoDisambiguation.js");
const V = await import("../services/geo/topicTerritoryCrosstab.js");
const { resolverUbicacion } = await import("../services/geo/geoResolver.js");
const x = await import("../services/ingest/adapters/xAdapter.js");

const PROY = "alcaldia-cuenca-2027-piloto";
const CUENCA = "ec-azuay-cuenca";
const AHORA = new Date().toISOString();
const OBSERVADO = AHORA;

/* Un resultado de búsqueda real: sin fecha, con contenido. */
const SIN_FECHA = {
  evidenceId: "search:https://ejemplo.ec/nota",
  canonicalUrl: "https://ejemplo.ec/nota",
  title: "El Municipio de Cuenca, Azuay, aprobó la ordenanza",
  summary: "Nota sin fecha declarada por el motor",
  domain: "ejemplo.ec",
  sourceId: "web:ejemplo.ec",
  providerId: "brave_web",
  publishedAt: null,
  observedAt: OBSERVADO
};

const CON_FECHA = {
  evidenceId: "x:99",
  canonicalUrl: "https://x.com/medio/status/99",
  title: "",
  summary: "El tranvía de Cuenca, Azuay, suma dos unidades",
  domain: "x:1",
  sourceId: "x:1",
  providerId: "x_api",
  publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  observedAt: OBSERVADO
};

const VIEJA = {
  evidenceId: "rss:vieja",
  canonicalUrl: "https://elmercurio.com.ec/vieja",
  title: "Nota antigua del Municipio de Cuenca, Azuay",
  summary: "hace mucho",
  domain: "elmercurio.com.ec",
  providerId: "rss_directo",
  publishedAt: new Date(Date.now() - 200 * 86400000).toISOString(),
  observedAt: OBSERVADO
};


/* =========================================================
   A-E · LA REGLA TEMPORAL
   ========================================================= */

console.log("\n--- A-E · publishedAt vs observedAt ---\n");

await ta("A · publishedAt null se persiste como null", async () => {
  const r = await P.persistirCorpus({
    ledger: null, evidencias: [SIN_FECHA], estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  const ev = r.evidencias.find((e) => e.evidenceId === SIN_FECHA.evidenceId);

  assert.equal(ev.publishedAt, null);
  return true;
});

await ta("B · observedAt NO reemplaza publishedAt", async () => {
  const r = await P.persistirCorpus({
    ledger: null, evidencias: [SIN_FECHA], estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  const ev = r.evidencias.find((e) => e.evidenceId === SIN_FECHA.evidenceId);

  /* Ni el instante de observación, ni el de la pasada, ni hoy. */
  assert.notEqual(ev.publishedAt, ev.observedAt);
  assert.notEqual(ev.publishedAt, ev.firstObservedAt);
  assert.notEqual(ev.publishedAt, AHORA);
  assert.equal(ev.publishedAt, null);

  /* Y el informe lo certifica en el punto de escritura. */
  assert.equal(r.informe.sinSustitucionDeFecha, true);
  return true;
});

t("B-bis · normalizarFechaDePublicacion no mira ningún campo de observación", () => {
  const f = P.normalizarFechaDePublicacion({
    observedAt: AHORA,
    retrievedAt: AHORA,
    firstObservedAt: AHORA,
    lastObservedAt: AHORA
  });

  assert.equal(f, null);

  /* Y una fecha ilegible tampoco cuela. */
  assert.equal(P.normalizarFechaDePublicacion({ publishedAt: "ayer por la tarde" }), null);
  return true;
});

const CORPUS = [SIN_FECHA, CON_FECHA, VIEJA];

function ventana(id) {
  const m = V.construirMatriz({
    evidencias: CORPUS,
    temas: [{ id: "todo", nombre: "todo", indices: CORPUS.map((_, i) => i) }],
    ubicaciones: CORPUS.map(() => ({ unidadId: null })),
    ventanaId: id,
    ahora: AHORA
  });

  return m.filas.reduce((a, f) => a + f.evidencias, 0);
}

t("C · una pieza sin publishedAt queda fuera de 7D", () => {
  /* Solo la de hace 2 días entra. */
  assert.equal(ventana("7d"), 1);
  return true;
});

t("D · queda fuera de HOY, 15D, 30D y 90D", () => {
  assert.equal(ventana("hoy"), 0);
  assert.equal(ventana("15d"), 1);
  assert.equal(ventana("30d"), 1);
  assert.equal(ventana("90d"), 1);

  /* La vieja (200 días) tampoco entra en 90D: el filtro es real. */
  return true;
});

t("D-bis · el contrato aguas abajo es el que protege: dentroDe(null) es false", () => {
  /*
    No hace falta filtrar en cada consulta porque una fecha nula
    nunca cae dentro de una ventana. Si esto cambiara, C y D
    fallarian juntas.
  */
  const sinNada = [SIN_FECHA];

  const m = V.construirMatriz({
    evidencias: sinNada,
    temas: [{ id: "t", nombre: "t", indices: [0] }],
    ubicaciones: [{ unidadId: CUENCA }],
    ventanaId: "90d",
    ahora: AHORA
  });

  return m.filas.reduce((a, f) => a + f.evidencias, 0) === 0;
});

t("E · la pieza sin fecha SIGUE siendo evidencia utilizable", () => {
  const el = P.elegibilidadTemporal(CORPUS);

  assert.equal(el.total, 3);
  assert.equal(el.elegibles, 2);
  assert.equal(el.noElegibles, 1);
  assert.equal(el.motivos.sinFechaDeclarada, 1);

  /* Y se dice por escrito para qué sí sirve. */
  assert.match(el.declaraciones.join(" "), /sigue disponible como evidencia/i);

  /* Se puede resolver territorialmente aunque no tenga fecha. */
  const r = D.desambiguarTerritorio({
    evidencia: SIN_FECHA,
    ubicacion: resolverUbicacion({ titulo: SIN_FECHA.title }, { ambitoId: CUENCA })
  });

  assert.equal(r.estadoGeo, "TERRITORIO_CORROBORADO");
  return true;
});

t("E-bis · la elegibilidad se deriva, no se almacena", () => {
  /* No existe ningún campo booleano que pueda desincronizarse. */
  const claves = Object.keys(SIN_FECHA);

  assert.ok(!claves.some((k) => /temporalElegible|temporal_eligible/i.test(k)));
  assert.equal(P.esTemporalmenteElegible(SIN_FECHA), false);
  assert.equal(P.esTemporalmenteElegible(CON_FECHA), true);
  return true;
});

t("E-ter · la lista de sustitutos prohibidos está declarada", () => {
  assert.ok(P.SUSTITUTOS_PROHIBIDOS.includes("observedAt"));
  assert.ok(P.SUSTITUTOS_PROHIBIDOS.includes("retrievedAt"));
  assert.ok(P.SUSTITUTOS_PROHIBIDOS.includes("fecha actual"));
  return true;
});


/* =========================================================
   F-K · ESTRATOS TERRITORIALES
   ========================================================= */

console.log("\n--- F-K · estratos ---\n");

const CLASES = [
  { estadoGeo: "TERRITORIO_CORROBORADO" },
  { estadoGeo: "TERRITORIO_CORROBORADO" },
  { estadoGeo: "TERRITORIO_PROBABLE" },
  { estadoGeo: "TERRITORIO_AMBIGUO" },
  { estadoGeo: "TERRITORIO_CONFLICTIVO" },
  { estadoGeo: "FUERA_TERRITORIO" },
  { estadoGeo: "TERRITORIO_NO_RESOLUBLE" }
];

const E = M.estratificarCorpus(CLASES);

t("F · CORROBORADO entra en el estrato estricto", () => {
  assert.equal(E.CORPUS_TERRITORIAL_CORROBORADO, 2);
  assert.equal(M.esEstadoDeMetricaTerritorial("TERRITORIO_CORROBORADO"), true);
  return true;
});

t("G · PROBABLE entra solo en el ampliado y sigue identificable", () => {
  assert.equal(E.CORPUS_TERRITORIAL_PROBABLE, 1);
  assert.equal(E.CORPUS_TERRITORIAL_AMPLIADO, 3);

  /* Estricto y ampliado son cifras distintas: no se confunden. */
  assert.notEqual(E.CORPUS_TERRITORIAL_CORROBORADO, E.CORPUS_TERRITORIAL_AMPLIADO);

  /* Y la composición se explica sola. */
  assert.match(E.composicion, /2 corroboradas y 1 probables/);
  return true;
});

t("G-bis · la composición nunca dice «N publicaciones de Cuenca»", () =>
  !/publicaciones de Cuenca/i.test(E.composicion) &&
  /señales territorialmente utilizables/i.test(E.composicion));

t("H · AMBIGUO no entra en métrica territorial", () =>
  M.esEstadoDeMetricaTerritorial("TERRITORIO_AMBIGUO") === false && E.excluidas.ambiguo === 1);

t("I · CONFLICTIVO no entra", () =>
  M.esEstadoDeMetricaTerritorial("TERRITORIO_CONFLICTIVO") === false && E.excluidas.conflictivo === 1);

t("J · FUERA no entra", () =>
  M.esEstadoDeMetricaTerritorial("FUERA_TERRITORIO") === false && E.excluidas.fuera === 1);

t("K · NO_RESOLUBLE no entra", () =>
  M.esEstadoDeMetricaTerritorial("TERRITORIO_NO_RESOLUBLE") === false &&
  E.excluidas.noResoluble === 1);

t("K-bis · lo excluido NO se borra del corpus observado", () => {
  /* Los siete siguen contados como observados. */
  assert.equal(E.CORPUS_OBSERVADO, 7);
  assert.match(E.declaraciones.join(" "), /Nada se borra/i);
  return true;
});


/* =========================================================
   L-N · DEDUPLICACIÓN Y PROCEDENCIA
   ========================================================= */

console.log("\n--- L-N · dedup y provenance ---\n");

await ta("L · la persistencia es idempotente: segunda pasada inserta 0", async () => {
  const l = L.crearLedgerMemoria();

  const p1 = await P.persistirCorpus({
    ledger: l, evidencias: CORPUS, estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  assert.equal(p1.informe.INSERTED, 3);
  assert.equal(p1.informe.DEDUPLICATED, 0);

  const estado = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY });

  assert.equal(estado.size, 3);

  const p2 = await P.persistirCorpus({
    ledger: l, evidencias: CORPUS, estadoPrevio: estado,
    retrievedAt: new Date().toISOString(), projectId: PROY, tenantId: "sentinel"
  });

  assert.equal(p2.informe.INSERTED, 0);
  assert.equal(p2.informe.DEDUPLICATED, 3);
  assert.equal(p2.informe.TOTAL_AFTER, 3);

  /* El corpus no se infla al repetir. */
  const estado2 = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY });

  assert.equal(estado2.size, 3);
  return true;
});

await ta("L-bis · repetir NO reescribe firstObservedAt", async () => {
  const l = L.crearLedgerMemoria();
  const primero = "2026-09-01T00:00:00.000Z";

  await P.persistirCorpus({
    ledger: l, evidencias: [CON_FECHA], estadoPrevio: new Map(),
    retrievedAt: primero, projectId: PROY, tenantId: "sentinel"
  });

  const e1 = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY });

  await P.persistirCorpus({
    ledger: l, evidencias: [CON_FECHA], estadoPrevio: e1,
    retrievedAt: "2026-09-03T00:00:00.000Z", projectId: PROY, tenantId: "sentinel"
  });

  const e2 = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY });
  const ev = e2.get(CON_FECHA.evidenceId);

  assert.equal(ev.firstObservedAt, primero);
  assert.notEqual(ev.lastObservedAt, primero);
  assert.equal(ev.observationCount, 2);
  return true;
});

await ta("M · la identidad estable es la clave de dedup, no el título", async () => {
  /* Dos piezas con el MISMO título y distinta URL son dos piezas. */
  const a = { ...SIN_FECHA, evidenceId: "search:a", canonicalUrl: "https://a.ec/x" };
  const b = { ...SIN_FECHA, evidenceId: "search:b", canonicalUrl: "https://b.ec/y" };

  const l = L.crearLedgerMemoria();

  const r = await P.persistirCorpus({
    ledger: l, evidencias: [a, b], estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  assert.equal(r.informe.INSERTED, 2);
  assert.equal(P.CONTRATO_DE_ALMACEN.DEDUP_KEY, "evidenceId");
  return true;
});

await ta("M-bis · sin identidad estable la pieza se descarta y dice por qué", async () => {
  const r = await P.persistirCorpus({
    ledger: null,
    evidencias: [{ title: "sin id ni url", summary: "nada" }, { evidenceId: "x", title: "" }],
    estadoPrevio: new Map(), retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  assert.equal(r.informe.SKIPPED, 2);

  const motivos = r.informe.motivosDeDescarte.map((d) => d.motivo);

  assert.ok(motivos.includes(P.MOTIVOS_DE_DESCARTE.SIN_IDENTIDAD));
  assert.ok(motivos.includes(P.MOTIVOS_DE_DESCARTE.SIN_CONTENIDO));
  return true;
});

await ta("N · la procedencia sobrevive a la persistencia", async () => {
  const l = L.crearLedgerMemoria();

  const conProv = {
    ...CON_FECHA,
    provenance: { providerId: "x_api", query: "Cuenca Azuay", queryLabel: "x:persistencia:base" }
  };

  await P.persistirCorpus({
    ledger: l, evidencias: [conProv], estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  const ev = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY }).get(conProv.evidenceId);

  assert.equal(ev.provenance.queryLabel, "x:persistencia:base");
  assert.ok((ev.providers || []).includes("x_api"));
  assert.equal(ev.domain, "x:1");
  return true;
});

t("N-bis · el contrato del almacén está declarado y no hay store paralelo", () => {
  assert.match(P.CONTRATO_DE_ALMACEN.CANONICAL_STORE, /evidenceLedger/);
  assert.equal(P.CONTRATO_DE_ALMACEN.PROJECT_SCOPE, "projectId + tenantId");
  assert.match(P.CONTRATO_DE_ALMACEN.nota, /No se crea ningún store paralelo/);
  return true;
});


/* =========================================================
   O-Q · LÍMITES SEMÁNTICOS
   ========================================================= */

console.log("\n--- O-Q · límites semánticos ---\n");

t("O · la procedencia de consulta de X no es evidencia territorial", () => {
  const ev = x.normalizarPost(
    { id: "7", text: "El agua en La Habana y la fuente Cuenca Sur", author_id: "1", created_at: AHORA },
    { userId: "1", handle: "medio", query: "Cuenca Azuay", queryLabel: "x:persistencia:base" }
  );

  /* La procedencia se conserva —corrección del gate anterior—... */
  assert.equal(ev.provenance.queryLabel, "x:persistencia:base");

  /* ...y no corrobora nada. */
  const r = D.desambiguarTerritorio({
    evidencia: { ...ev, summary: ev.snippet },
    ubicacion: resolverUbicacion({ descripcion: ev.snippet }, { ambitoId: CUENCA })
  });

  assert.equal(r.queryProvenance, "x:persistencia:base");
  assert.ok(!JSON.stringify(r.signalsPositive).includes("persistencia"));
  assert.equal(r.estadoGeo, "FUERA_TERRITORIO");
  return true;
});

t("P · SEARCH_RESULT no se presenta como SEARCH_INTEREST", () => {
  const e = S.normalizarResultadoDeBusqueda({ url: "https://a.ec/1" }, { collector: "brave_web" });

  assert.equal(e.tipoDeSenal, S.TIPOS_DE_SENAL.SEARCH_RESULT);
  assert.notEqual(e.tipoDeSenal, S.TIPOS_DE_SENAL.SEARCH_INTEREST);
  assert.equal(S.DISPONIBILIDAD_SEARCH_INTEREST.estado, "NO_DISPONIBLE");

  /* Y no se estima fecha por posición en el buscador. */
  const e10 = S.normalizarResultadoDeBusqueda(
    { url: "https://a.ec/2", posicion: 10 },
    { collector: "brave_web" }
  );

  assert.equal(e10.publishedAt, null);
  return true;
});

t("Q · un actor local no territorializa automáticamente todas sus piezas", () => {
  /*
    El Mercurio es un medio de Cuenca. Esta nota habla del dólar.
    La nota no es de Cuenca, y persistirla no la convierte en tal.
  */
  const r = D.desambiguarTerritorio({
    evidencia: {
      domain: "elmercurio.com.ec",
      sourceId: "web:elmercurio.com.ec",
      publisher: "El Mercurio",
      title: "El dólar y la economía nacional",
      summary: "Análisis del tipo de cambio"
    },
    ubicacion: resolverUbicacion({ titulo: "El dólar y la economía nacional" }, { ambitoId: CUENCA })
  });

  assert.notEqual(r.estadoGeo, "TERRITORIO_CORROBORADO");
  assert.equal(r.aptoParaMetricas, false);
  return true;
});

t("Q-bis · ningún texto de este flujo afirma representatividad", () => {
  const texto =
    JSON.stringify(P.CONTRATO_DE_ALMACEN) +
    JSON.stringify(P.elegibilidadTemporal(CORPUS)) +
    JSON.stringify(E);

  return !/los cuencanos|opini[óo]n p[úu]blica|poblaci[óo]n de Cuenca|todo lo que se habla/i.test(
    texto
  );
});


/* =========================================================
   R-S · AISLAMIENTO Y REINICIO
   ========================================================= */

console.log("\n--- R-S · aislamiento y reinicio ---\n");

await ta("R · el proyecto A no puede leer el corpus del proyecto B", async () => {
  const l = L.crearLedgerMemoria();

  await P.persistirCorpus({
    ledger: l, evidencias: [CON_FECHA], estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  await P.persistirCorpus({
    ledger: l, evidencias: [{ ...VIEJA, evidenceId: "rss:deB" }], estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: "proyecto-b-fixture", tenantId: "sentinel"
  });

  const obs = await l.leerTodos();
  const a = L.reconstruirEstado(obs, { projectId: PROY });
  const b = L.reconstruirEstado(obs, { projectId: "proyecto-b-fixture" });

  assert.equal(a.size, 1);
  assert.equal(b.size, 1);
  assert.ok(a.has(CON_FECHA.evidenceId));
  assert.ok(!a.has("rss:deB"));
  assert.ok(!b.has(CON_FECHA.evidenceId));
  return true;
});

await ta("R-bis · persistir SIN projectId no se permite: evita un corpus global accidental", async () => {
  await assert.rejects(
    () =>
      P.persistirCorpus({
        ledger: null, evidencias: [CON_FECHA], estadoPrevio: new Map(),
        retrievedAt: AHORA, tenantId: "sentinel"
      }),
    /projectId/
  );
  return true;
});

await ta("R-ter · MUTACIÓN: sin projectId en el registro, el aislamiento debe romperse", async () => {
  const l = L.crearLedgerMemoria();

  await P.persistirCorpus({
    ledger: l, evidencias: [CON_FECHA], estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  const obs = (await l.leerTodos()).map(({ projectId, ...resto }) => resto);

  /* Sin el campo, la evidencia NO pertenece a ningún proyecto. */
  assert.equal(L.reconstruirEstado(obs, { projectId: PROY }).size, 0);

  /* Y solo aparece si se pide el legado explícitamente. */
  assert.equal(L.reconstruirEstado(obs, { projectId: PROY, incluirLegado: true }).size, 1);
  return true;
});

await ta("S · la persistencia sobrevive a recrear el adapter", async () => {
  /*
    Se escribe con un adapter, se descarta, y se lee con otro
    recien creado sobre el mismo almacen. Memoria del proceso no
    basta: por eso se recrea.
  */
  const almacen = [];

  const hacerLedger = () => ({
    anexar: async (r) => { almacen.push(JSON.parse(JSON.stringify(r))); },
    leerTodos: async () => almacen.map((r) => JSON.parse(JSON.stringify(r)))
  });

  const l1 = hacerLedger();

  await P.persistirCorpus({
    ledger: l1, evidencias: CORPUS, estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  /* Se tira el primero. */
  const l2 = hacerLedger();
  const estado = L.reconstruirEstado(await l2.leerTodos(), { projectId: PROY });

  assert.equal(estado.size, 3);

  /* Y la pieza sin fecha sigue sin fecha tras el reinicio. */
  assert.equal(estado.get(SIN_FECHA.evidenceId).publishedAt, null);

  /* Y la que tenía fecha la conserva. */
  assert.equal(estado.get(CON_FECHA.evidenceId).publishedAt, CON_FECHA.publishedAt);
  return true;
});


/* =========================================================
   T-V · REGRESIONES DE FRONTERA
   ========================================================= */

console.log("\n--- T-V · fronteras con Candidate, Media y geo ---\n");

t("T · Candidate: X sin consulta declarada sigue emitiendo provenance nula", () => {
  const ev = x.normalizarPost(
    { id: "5", text: "algo", author_id: "1", created_at: AHORA },
    { userId: "1", handle: "cuenta" }
  );

  return ev.provenance.queryLabel === null && ev.provenance.query === null;
});

t("U · Media: la matriz sin compuerta se comporta como antes", () => {
  const evs = [
    { id: "a", publishedAt: AHORA, titulo: "Obras en Cuenca, Azuay" },
    { id: "b", publishedAt: AHORA, titulo: "Agua en Lambayeque" }
  ];

  const m = V.construirMatriz({
    evidencias: evs,
    temas: [{ id: "t", nombre: "t", indices: [0, 1] }],
    ubicaciones: evs.map(() => ({ unidadId: CUENCA })),
    ahora: AHORA
  });

  /* Sin `aptitudTerritorial` inyectada, las dos se atribuyen. */
  return m.filas.filter((f) => f.territorioId === CUENCA).reduce((a, f) => a + f.evidencias, 0) === 2;
});

t("V · la desambiguación geo sigue intacta tras la persistencia", () => {
  const fuera = D.desambiguarTerritorio({
    evidencia: { sourceId: "x:1", summary: "Lambayeque, Perú: la cuenca Chancay" },
    ubicacion: resolverUbicacion({ descripcion: "Lambayeque, Perú: la cuenca Chancay" }, { ambitoId: CUENCA })
  });

  const dentro = D.desambiguarTerritorio({
    evidencia: { sourceId: "x:2", summary: "El Municipio de Cuenca, Azuay, y el tranvía" },
    ubicacion: resolverUbicacion({ descripcion: "El Municipio de Cuenca, Azuay, y el tranvía" }, { ambitoId: CUENCA })
  });

  assert.equal(fuera.estadoGeo, "FUERA_TERRITORIO");
  assert.equal(dentro.estadoGeo, "TERRITORIO_CORROBORADO");
  return true;
});


/* =========================================================
   sin red
   ========================================================= */

console.log("\n--- Sin red ---\n");

t("cero llamadas al fetch global", () => red === 0);

console.log("\n===========================================");
console.log(`PASS: ${ok}    FALL: ${fall}`);
console.log("===========================================");

if (fall > 0) process.exitCode = 1;
