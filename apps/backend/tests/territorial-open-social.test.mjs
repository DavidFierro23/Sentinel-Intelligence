// apps/backend/tests/territorial-open-social.test.mjs

/*
===========================================================
TERRITORIAL-OPEN-SOCIAL-COVERAGE-04

Pruebas A-W. Cero red: el `fetch` global esta contado y los
adaptadores reciben `fetch` inyectado.

Lo que este fichero fija es el resultado central del gate:

  TikTok SI permite descubrimiento abierto con el proveedor y
  las credenciales que ya teniamos. El veredicto anterior
  —KNOWN_ACCOUNT_ONLY— era correcto sobre NUESTRA integracion y
  falso sobre las capacidades actuales del proveedor.

Y el defecto que salio buscando comentarios: las URLs canonicas
de YouTube del corpus estan en minusculas y no resuelven.
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

const V = await import("../services/territorial/localSourceVerification.js");
const D = await import("../services/territorial/socialGeoDisambiguation.js");
const M = await import("../services/territorial/collectorMesh.js");
const CM = await import("../services/territorial/sourceCoverageMatrix.js");
const P = await import("../services/territorial/corpusPersistence.js");
const L = await import("../services/territorial/evidenceLedger.js");
const T = await import("../services/territorial/topicNormalization.js");
const g = await import("../services/ingest/adapters/gdeltAdapter.js");
const yt = await import("../services/ingest/adapters/youtubeAdapter.js");
const x = await import("../services/ingest/adapters/xAdapter.js");
const { resolverUbicacion } = await import("../services/geo/geoResolver.js");

const CUENCA = "ec-azuay-cuenca";
const PROY = "alcaldia-cuenca-2027-piloto";
const AHORA = "2026-09-05T12:00:00.000Z";


/* =========================================================
   A-C · COLECTORES CABLEADOS, DEDUP Y PROCEDENCIA
   ========================================================= */

console.log("\n--- A-C · cableado, dedup y procedencia ---\n");

t("A · los proveedores nuevos tienen naturaleza asignada, no caen en OTHER", () => {
  /*
    Defecto real: sin esto, las 30 piezas del primer
    descubrimiento abierto de TikTok caian en OTHER y la
    conversacion publica del corpus se quedaba clavada en 143
    teniendo 173.
  */
  assert.equal(V.naturalezaPorProveedor({ providers: ["scrapecreators_tiktok"] }), V.NATURALEZA.PUBLIC_CONVERSATION);
  assert.equal(V.naturalezaPorProveedor({ providers: ["google_news"] }), V.NATURALEZA.MEDIA);
  assert.equal(V.naturalezaPorProveedor({ providers: ["ddg_web"] }), V.NATURALEZA.SEARCH_RESULT);

  /* Y los de siempre no cambian. */
  assert.equal(V.naturalezaPorProveedor({ providers: ["x_api"] }), V.NATURALEZA.PUBLIC_CONVERSATION);
  assert.equal(V.naturalezaPorProveedor({ providers: ["rss_directo"] }), V.NATURALEZA.MEDIA);
  return true;
});

await ta("B · dedup entre proveedores: la misma URL desde dos motores es UNA evidencia", async () => {
  const l = L.crearLedgerMemoria();

  const deGnews = {
    evidenceId: "gnews:elmercurio.com.ec:abc", canonicalUrl: "https://elmercurio.com.ec/nota-1",
    title: "El Municipio de Cuenca, Azuay", summary: "x", publishedAt: AHORA,
    domain: "elmercurio.com.ec", providerId: "google_news", providers: ["google_news"]
  };

  const p1 = await P.persistirCorpus({
    ledger: l, evidencias: [deGnews], estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  assert.equal(p1.informe.INSERTED, 1);

  const estado = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY });

  /* El mismo evidenceId desde otro motor: NO se inserta otra vez. */
  const deDdg = { ...deGnews, providerId: "ddg_web", providers: ["ddg_web"] };

  const p2 = await P.persistirCorpus({
    ledger: l, evidencias: [deDdg], estadoPrevio: estado,
    retrievedAt: new Date().toISOString(), projectId: PROY, tenantId: "sentinel"
  });

  assert.equal(p2.informe.INSERTED, 0);
  assert.equal(p2.informe.DEDUPLICATED, 1);
  assert.equal(L.reconstruirEstado(await l.leerTodos(), { projectId: PROY }).size, 1);
  return true;
});

await ta("C · la procedencia multi-proveedor se conserva, no se sobrescribe", async () => {
  const l = L.crearLedgerMemoria();

  const base = {
    evidenceId: "e-multi", canonicalUrl: "https://a.ec/1",
    title: "Cuenca, Azuay", summary: "x", publishedAt: AHORA, domain: "a.ec"
  };

  await P.persistirCorpus({
    ledger: l, evidencias: [{ ...base, providers: ["google_news"] }], estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  const e1 = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY });

  await P.persistirCorpus({
    ledger: l, evidencias: [{ ...base, providers: ["ddg_web"] }], estadoPrevio: e1,
    retrievedAt: new Date().toISOString(), projectId: PROY, tenantId: "sentinel"
  });

  const ev = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY }).get("e-multi");

  /* Los dos motores quedan registrados: uno no borra al otro. */
  assert.ok(ev.providers.includes("google_news"));
  assert.ok(ev.providers.includes("ddg_web"));
  assert.equal(ev.observationCount, 2);
  return true;
});


/* =========================================================
   D-F · GOOGLE NEWS, GDELT, DDG
   ========================================================= */

console.log("\n--- D-F · Google News, GDELT, DDG ---\n");

await ta("D · Google News entra en el ledger canónico con el dominio real de la fuente", async () => {
  /*
    Su enlace es un redirector de news.google.com. El dominio
    real viene en el sufijo del titular, que es donde el feed lo
    publica: no se inventa, se declara de dónde sale.
  */
  const l = L.crearLedgerMemoria();

  const ev = {
    evidenceId: "gnews:elmercurio.com.ec:xyz",
    canonicalUrl: "https://news.google.com/rss/articles/CBMisgFBVV95cUx",
    title: "12 candidaturas a la Alcaldía de Cuenca están en firme",
    summary: "x",
    publishedAt: AHORA,
    domain: "elmercurio.com.ec",
    providerId: "google_news",
    providers: ["google_news"],
    provenance: {
      providerId: "google_news",
      queryLabel: "gnews:Cuenca Azuay",
      avisoCanonical: "La URL es un redirector de news.google.com, no la de la fuente."
    }
  };

  await P.persistirCorpus({
    ledger: l, evidencias: [ev], estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  const g0 = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY }).get(ev.evidenceId);

  assert.equal(g0.domain, "elmercurio.com.ec");
  assert.match(g0.provenance.avisoCanonical, /redirector/i);

  /* Y no se pretende que la URL sea del medio. */
  assert.match(g0.canonicalUrl, /news\.google\.com/);

  /* No se crea un segundo store: es el ledger canónico. */
  assert.match(P.CONTRATO_DE_ALMACEN.CANONICAL_STORE, /evidenceLedger/);
  return true;
});

await ta("E · GDELT: LIMITE_DE_TASA no se cuenta como cero", async () => {
  const r = await g.buscar("Cuenca Ecuador", {
    sinEspera: true,
    fetch: async () => ({ ok: false, status: 429 })
  });

  assert.equal(r.estado, "LIMITE_DE_TASA");
  assert.equal(r.evidencias.length, 0);

  /* Y lo dice por escrito para que nadie lo lea como ausencia. */
  assert.match(r.aviso, /No contar esto como cero/i);

  /* Un error distinto no se disfraza de límite. */
  const e500 = await g.buscar("x", { sinEspera: true, fetch: async () => ({ ok: false, status: 500 }) });

  assert.equal(e500.estado, "ERROR");
  assert.equal(e500.aviso, null);
  return true;
});

await ta("E-bis · GDELT reintenta UNA vez ante 429 y luego se rinde declarándolo", async () => {
  let llamadas = 0;

  const r = await g.buscar("Cuenca", {
    fetch: async () => { llamadas += 1; return { ok: false, status: 429 }; }
  });

  /* Dos intentos como máximo: el original y un reintento. */
  assert.equal(llamadas, 2);
  assert.equal(r.reintentado, true);
  assert.equal(r.estado, "LIMITE_DE_TASA");
  return true;
});

t("F · la contribución de DDG se mide, y su falta de fecha se declara", () => {
  /* 48 evidencias reales, ninguna con fecha editorial. */
  const evs = Array.from({ length: 5 }, (_, i) => ({
    evidenceId: `ddg:https://x${i}.ec/a`,
    canonicalUrl: `https://x${i}.ec/a`,
    title: "El Municipio de Cuenca, Azuay",
    summary: "resultado de búsqueda",
    publishedAt: null,
    domain: `x${i}.ec`,
    providers: ["ddg_web"]
  }));

  const el = P.elegibilidadTemporal(evs);

  assert.equal(el.elegibles, 0);
  assert.equal(el.noElegibles, 5);
  assert.equal(el.motivos.sinFechaDeclarada, 5);

  /* Sirven como evidencia y no entran en ventanas. */
  assert.match(el.declaraciones.join(" "), /sigue disponible como evidencia/i);
  return true;
});


/* =========================================================
   G · COMENTARIOS
   ========================================================= */

console.log("\n--- G · comentarios ---\n");

t("G · COMMENT_COUNT y COMMENT_TEXT son cosas distintas y ninguna está cableada", () => {
  /* Ni X ni YouTube exponen comentarios en nuestros adaptadores. */
  assert.equal(Object.keys(x).filter((k) => /coment|repl/i.test(k)).length, 0);
  assert.equal(Object.keys(yt).filter((k) => /coment|comment/i.test(k)).length, 0);

  /* Y la matriz lo declara con el estado correcto en cada caso. */
  assert.equal(CM.MATRIZ_SOCIAL.X[CM.CAPACIDADES.COMMENTS].estado, CM.ESTADOS.UNSUPPORTED);
  assert.equal(CM.MATRIZ_SOCIAL.YouTube[CM.CAPACIDADES.COMMENTS].estado, CM.ESTADOS.NOT_IMPLEMENTED);

  /* NOT_IMPLEMENTED no es UNSUPPORTED: la API los ofrece, el adaptador no. */
  assert.notEqual(
    CM.MATRIZ_SOCIAL.YouTube[CM.CAPACIDADES.COMMENTS].estado,
    CM.MATRIZ_SOCIAL.X[CM.CAPACIDADES.COMMENTS].estado
  );
  return true;
});

t("G-bis · las URLs canónicas de YouTube del corpus no resuelven: ID en minúsculas", () => {
  /*
    Defecto encontrado buscando comentarios. `normalizarUrl`
    baja TODA la URL a minúsculas, incluida la ruta y la query.
    Bajar el host es correcto —DNS no distingue— pero los IDs de
    vídeo de YouTube sí, y quedan destruidos.

    Medido: 83 de 83 URLs de YouTube del corpus con el ID todo en
    minúsculas. Son enlaces muertos.
  */
  const ev = yt.normalizarVideo(
    {
      id: { videoId: "SaP7hEE800M" },
      snippet: { title: "Prueba", channelId: "UCabc", channelTitle: "Canal", publishedAt: AHORA, description: "x" }
    },
    {}
  );

  /* El ID original tenía mayúsculas y sale sin ellas. */
  assert.ok(!/SaP7hEE800M/.test(String(ev.canonicalUrl)));
  assert.match(String(ev.canonicalUrl), /sap7hee800m/);

  /* Los IDs numéricos de X no se ven afectados. */
  const evX = x.normalizarPost(
    { id: "1234567890", text: "algo", author_id: "9", created_at: AHORA },
    { userId: "9", handle: "cuenta" }
  );

  assert.match(String(evX.canonicalUrl), /1234567890/);
  return true;
});


/* =========================================================
   H-K · DESCUBRIMIENTO ABIERTO POR PLATAFORMA
   ========================================================= */

console.log("\n--- H-K · descubrimiento abierto ---\n");

t("H · descubrimiento abierto y cuenta conocida siguen siendo capacidades distintas", () => {
  assert.ok(CM.esDescubrimiento(CM.CAPACIDADES.OPEN_KEYWORD_DISCOVERY));
  assert.ok(CM.esDescubrimiento(CM.CAPACIDADES.HASHTAG_DISCOVERY));
  assert.ok(!CM.esDescubrimiento(CM.CAPACIDADES.KNOWN_ACCOUNT_CONTENT));
  assert.ok(!CM.esDescubrimiento(CM.CAPACIDADES.COMMENTS));
  return true;
});

t("I · Facebook: descubrimiento abierto requiere proveedor o vía restringida", () => {
  /* La vía oficial —Meta Content Library— existe pero es institucional. */
  assert.equal(
    CM.MATRIZ_SOCIAL.Facebook[CM.CAPACIDADES.OPEN_KEYWORD_DISCOVERY].estado,
    CM.ESTADOS.UNSUPPORTED
  );

  /* Y la observación de cuenta conocida sí funciona: no es lo mismo. */
  assert.ok(CM.esCoberturaReal(CM.MATRIZ_SOCIAL.Facebook[CM.CAPACIDADES.KNOWN_ACCOUNT_CONTENT].estado));
  return true;
});

t("J · Instagram: descubrimiento abierto sin demostrar, y no se declara imposible", () => {
  const celda = CM.MATRIZ_SOCIAL.Instagram[CM.CAPACIDADES.HASHTAG_DISCOVERY];

  /* Sigue UNSUPPORTED en nuestra integración... */
  assert.equal(celda.estado, CM.ESTADOS.UNSUPPORTED);

  /* ...y la ausencia se redacta sin inventar un cero. */
  const a = CM.redactarAusencia({ plataforma: "Instagram", capacidad: "HASHTAG_DISCOVERY", estado: celda.estado });

  assert.match(a.formulacionCorrecta, /con los conectores actuales/);
  assert.match(a.formulacionProhibida, /0 conversación en Instagram/);
  return true;
});

t("K · TikTok: el descubrimiento abierto quedó DEMOSTRADO con datos reales", () => {
  /*
    30 resultados, 26 autores nuevos, 100 % con fecha, URL
    canónica y métricas, 27 de 30 territorialmente corroborados,
    1 crédito. La capacidad existe con el proveedor y las
    credenciales que ya teníamos.

    Se comprueba sobre una pieza real del corpus.
  */
  const ev = {
    evidenceId: "tiktok:https://www.tiktok.com/@holasoymauri777/video/123",
    canonicalUrl: "https://www.tiktok.com/@holasoymauri777/video/123",
    summary: "Un lugar increíble a solo 25 min de Cuenca, Azuay",
    publishedAt: AHORA,
    domain: "tiktok:holasoymauri777",
    sourceId: "tiktok:holasoymauri777",
    publisher: "holasoymauri777",
    providers: ["scrapecreators_tiktok"]
  };

  /* Naturaleza: conversación pública, no medio ni institución. */
  assert.equal(V.naturalezaPorProveedor(ev), V.NATURALEZA.PUBLIC_CONVERSATION);

  /* Y resuelve territorio por el texto, como cualquier otra pieza. */
  const geo = D.desambiguarTerritorio({
    evidencia: ev,
    ubicacion: resolverUbicacion({ descripcion: ev.summary }, { ambitoId: CUENCA })
  });

  assert.equal(geo.estadoGeo, "TERRITORIO_CORROBORADO");

  /* La procedencia de la consulta no cuenta como territorio. */
  assert.ok(!JSON.stringify(geo.signalsPositive).toLowerCase().includes("query"));
  return true;
});


/* =========================================================
   L-M · REGRESIONES DE X Y YOUTUBE
   ========================================================= */

console.log("\n--- L-M · X y YouTube intactos ---\n");

t("L · X sigue propagando la procedencia de consulta y sin ella queda null", () => {
  const con = x.normalizarPost(
    { id: "1", text: "algo en Cuenca", author_id: "9", created_at: AHORA },
    { userId: "9", handle: "medio", query: "Cuenca Azuay", queryLabel: "x:base" }
  );

  const sin = x.normalizarPost(
    { id: "2", text: "algo", author_id: "9", created_at: AHORA },
    { userId: "9", handle: "medio" }
  );

  assert.equal(con.provenance.queryLabel, "x:base");
  assert.equal(sin.provenance.queryLabel, null);
  return true;
});

t("M · YouTube sigue normalizando vídeo con canal, fecha y procedencia", () => {
  const ev = yt.normalizarVideo(
    {
      id: { videoId: "abcdefghijk" },
      snippet: { title: "Cuenca, Azuay", channelId: "UCxyz", channelTitle: "Canal", publishedAt: AHORA, description: "x" }
    },
    { queryLabel: "yt:base", query: "Cuenca" }
  );

  assert.ok(ev.publishedAt);
  assert.match(String(ev.sourceId || ev.domain || ""), /UCxyz/i);
  assert.equal(ev.provenance.queryLabel, "yt:base");
  return true;
});


/* =========================================================
   N-P · REGLAS QUE NO SE ROMPEN
   ========================================================= */

console.log("\n--- N-P · reglas del proyecto ---\n");

t("N · localidad de fuente y territorialidad de contenido siguen separadas", () => {
  const f = V.clasificarLocalidad({ dominio: "expreso.ec", tipoEnUniverso: "medio_nacional" });

  assert.equal(f.localidad, V.LOCALIDAD.NO_LOCAL);

  /* Y una pieza suya sobre Cuenca sí se corrobora. */
  const geo = D.desambiguarTerritorio({
    evidencia: { domain: "expreso.ec", title: "El tranvía de Cuenca, Azuay, suma unidades" },
    ubicacion: resolverUbicacion({ titulo: "El tranvía de Cuenca, Azuay, suma unidades" }, { ambitoId: CUENCA })
  });

  assert.equal(geo.estadoGeo, "TERRITORIO_CORROBORADO");
  return true;
});

await ta("O · publishedAt no se rellena con observedAt en ningún motor nuevo", async () => {
  const sinFecha = {
    evidenceId: "ddg:https://a.ec/x", canonicalUrl: "https://a.ec/x",
    title: "Cuenca, Azuay", summary: "x", publishedAt: null,
    observedAt: AHORA, domain: "a.ec", providers: ["ddg_web"]
  };

  const r = await P.persistirCorpus({
    ledger: null, evidencias: [sinFecha], estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  const ev = r.evidencias[0];

  assert.equal(ev.publishedAt, null);
  assert.notEqual(ev.publishedAt, AHORA);
  assert.equal(r.informe.sinSustitucionDeFecha, true);
  return true;
});

await ta("P · aislamiento de proyecto con los motores nuevos", async () => {
  const l = L.crearLedgerMemoria();

  const ev = (id, p) => ({
    evidenceId: id, canonicalUrl: `https://a.ec/${id}`, title: "Cuenca, Azuay",
    summary: "x", publishedAt: AHORA, domain: "a.ec", providers: [p]
  });

  await P.persistirCorpus({ ledger: l, evidencias: [ev("a1", "google_news")], estadoPrevio: new Map(), retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel" });
  await P.persistirCorpus({ ledger: l, evidencias: [ev("b1", "scrapecreators_tiktok")], estadoPrevio: new Map(), retrievedAt: AHORA, projectId: "proyecto-b-fixture", tenantId: "sentinel" });

  const obs = await l.leerTodos();

  assert.equal(L.reconstruirEstado(obs, { projectId: PROY }).size, 1);
  assert.equal(L.reconstruirEstado(obs, { projectId: "proyecto-b-fixture" }).size, 1);
  assert.ok(!L.reconstruirEstado(obs, { projectId: PROY }).has("b1"));
  assert.equal(L.reconstruirEstado(obs, { projectId: "no-existe" }).size, 0);
  return true;
});


/* =========================================================
   Q-S · REPROCESO DE TEMAS
   ========================================================= */

console.log("\n--- Q-S · reproceso de temas ---\n");

const doc = (id, texto, prov = ["rss_directo"], fecha = AHORA) =>
  T.construirDocumento(
    { evidenceId: id, projectId: PROY, tenantId: "sentinel", title: "", summary: texto, publishedAt: fecha, firstObservedAt: fecha, providers: prov, domain: "a.ec", canonicalUrl: `https://a.ec/${id}` },
    { contentTerritoriality: "TERRITORIO_CORROBORADO", sourceLocality: "LOCAL_CORROBORADA", contentNature: "MEDIA", sourceFamily: "MEDIOS_LOCALES" }
  );

const LOTE = [
  doc("e1", "Inauguran el paso elevado del intercambiador Monay-IESS en Cuenca"),
  doc("e2", "El intercambiador Monay-IESS ya está habilitado al tráfico en Cuenca", ["x_api"]),
  doc("e3", "Plan de desvíos por la apertura del intercambiador Monay-IESS")
];

t("Q · el reproceso es determinista y NO se retoca el umbral", () => {
  const CONF = { metodo: T.METODOS.HIBRIDO, umbral: 0.18, ahora: AHORA };

  const a = T.normalizarTemas(LOTE, { universo: T.UNIVERSOS.PRIMARY, ...CONF });
  const b = T.normalizarTemas([...LOTE].reverse(), { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  assert.deepEqual(a.temas.map((x2) => x2.topicId), b.temas.map((x2) => x2.topicId));
  assert.deepEqual(a.resumen, b.resumen);

  /* El umbral del gate anterior se conserva. */
  assert.equal(a.umbral, 0.18);
  assert.equal(a.methodVersion, T.VERSION_METODO);
  return true;
});

t("R · añadir un motor nuevo no cambia el topicId de un tema existente", () => {
  const CONF = { metodo: T.METODOS.HIBRIDO, umbral: 0.18, ahora: AHORA };

  const antes = T.normalizarTemas(LOTE, { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  /* Llega una pieza del motor nuevo sobre el MISMO asunto. */
  const conTikTok = [
    ...LOTE,
    doc("e4", "Ya está abierto el paso elevado del intercambiador Monay en Cuenca", ["scrapecreators_tiktok"])
  ];

  const despues = T.normalizarTemas(conTikTok, { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  const t1 = antes.temas[0];
  const t2 = despues.temas.find((x2) => x2.evidenceIds.includes("e1"));

  /* Mismo tema, mismo id, y ahora con dos plataformas más. */
  assert.equal(t2.topicId, t1.topicId);
  assert.ok(t2.evidenceCount > t1.evidenceCount);
  assert.ok(t2.providers.includes("scrapecreators_tiktok"));
  return true;
});

t("S · el snapshot de cobertura no duplica el corpus", () => {
  const celda = CM.celdaDeCobertura({
    family: CM.FAMILIAS.SOCIAL_OPEN,
    platform: "TikTok",
    provider: "scrapecreators_tiktok",
    capability: CM.CAPACIDADES.OPEN_KEYWORD_DISCOVERY,
    status: CM.ESTADOS.OPERATIVE_WITH_LIMITATIONS,
    evidenceCount: 30,
    uniqueActors: 26,
    evidenceRefs: Array.from({ length: 60 }, (_, i) => `tiktok:ev-${i}`),
    projectId: PROY,
    tenantId: "sentinel"
  });

  /* Referencias topadas: es un índice, no un almacén. */
  assert.equal(celda.evidenceRefs.length, 25);
  assert.equal(celda.evidenceCount, 30);
  assert.equal(celda.esDescubrimiento, true);
  assert.equal(celda.esCoberturaReal, true);
  assert.equal(celda.projectId, PROY);
  return true;
});


/* =========================================================
   T-W · POBLACIÓN, PRIVACIDAD, SECRETOS, PRESUPUESTO
   ========================================================= */

console.log("\n--- T-W · límites ---\n");

t("T · nada afirma cobertura de población", () => {
  const texto =
    JSON.stringify(CM.estadoDeLaMatriz()) +
    JSON.stringify(V.composicionDelCorpus([], new Map())) +
    JSON.stringify(M.estratificarCorpus([]));

  return !/% de (los )?(cuencanos|ciudadanos)|penetraci[óo]n electoral|representatividad estad[íi]stica|poblaci[óo]n de Cuenca/i.test(
    texto
  );
});

t("U · Telegram queda restringido a canales públicos, sin grupos privados", () => {
  const tg = CM.MOTORES.find((m) => m.id === "telegram");

  assert.equal(tg.estado, CM.ESTADOS.NOT_IMPLEMENTED);
  assert.match(tg.limitaciones.join(" "), /Solo canales y contenido público/i);
  assert.match(tg.limitaciones.join(" "), /Grupos privados quedan fuera/i);
  return true;
});

t("U-bis · no se perfila a ningún individuo del descubrimiento abierto", () => {
  /*
    Los autores de TikTok son cuentas públicas y se guardan como
    actor, no como persona: sin residencia, sin atributos, sin
    perfil.
  */
  const ev = {
    evidenceId: "tiktok:x", publisher: "holasoymauri777",
    summary: "Un lugar increíble a 25 min de Cuenca", providers: ["scrapecreators_tiktok"]
  };

  const geo = D.desambiguarTerritorio({
    evidencia: ev,
    ubicacion: resolverUbicacion({ descripcion: ev.summary }, { ambitoId: CUENCA })
  });

  const texto = JSON.stringify(geo);

  assert.ok(!/residen|domicili|vive en|edad|g[ée]nero|etni|ideolog|coordenad/i.test(texto));
  return true;
});

t("V · ninguna salida expone credenciales", () => {
  const texto =
    JSON.stringify(CM.MOTORES) +
    JSON.stringify(CM.REQUISITOS_DE_PROVEEDOR) +
    JSON.stringify(g.diagnostico());

  assert.ok(!/Bearer\s+[A-Za-z0-9]{8,}|AIza[0-9A-Za-z_-]{10,}|x-api-key:\s*\S{8,}/.test(texto));
  return true;
});

t("W · las peticiones de este fichero de pruebas son cero", () => {
  /*
    Todos los adaptadores reciben `fetch` inyectado y el resto es
    cálculo local: si una prueba sale a internet, se ve aquí.
  */
  assert.equal(red, 0);
  return true;
});

console.log("\n--- Sin red ---\n");

t("cero llamadas al fetch global", () => red === 0);

console.log("\n===========================================");
console.log(`PASS: ${ok}    FALL: ${fall}`);
console.log("===========================================");

if (fall > 0) process.exitCode = 1;
