// apps/backend/tests/territorial-mesh.test.mjs

/*
===========================================================
TERRITORIAL-COLLECTOR-EXPANSION-01

Cero red. El `fetch` global esta contado y se comprueba al
final: si una prueba sale a internet, se ve.
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

const M = await import("../services/territorial/collectorMesh.js");
const S = await import("../services/territorial/searchIntelligence.js");
const A = await import("../services/territorial/socialAssetResolution.js");
const D = await import("../services/territorial/socialGeoDisambiguation.js");
const { resolverUbicacion } = await import("../services/geo/geoResolver.js");
const x = await import("../services/ingest/adapters/xAdapter.js");

const CUENCA = "ec-azuay-cuenca";

const clasificar = (e) =>
  D.desambiguarTerritorio({
    evidencia: e,
    ubicacion: resolverUbicacion(
      { titulo: e.title || "", descripcion: e.summary || "", resumen: e.summary || "" },
      { ambitoId: CUENCA }
    )
  });


/* =========================================================
   DISCOVERY VS KNOWN ACCOUNT
   ========================================================= */

console.log("\n--- Descubrimiento abierto vs cuenta conocida ---\n");

t("las tres plataformas de ScrapeCreators son KNOWN_ACCOUNT_ONLY", () => {
  const fb = M.MESH.find((m) => m.collector === "scrapecreators_facebook");
  const ig = M.MESH.find((m) => m.collector === "scrapecreators_instagram");
  const tt = M.MESH.find((m) => m.collector === "scrapecreators_tiktok");

  return [fb, ig, tt].every((m) => m && m.modo === M.MODOS.KNOWN_ACCOUNT_ONLY);
});

t("cada modo declara SU RAZÓN: sin razón la tabla sería una opinión", () =>
  M.MESH.every((m) => typeof m.razonDelModo === "string" && m.razonDelModo.length > 20));

t("X, YouTube, RSS y búsqueda sí son OPEN_DISCOVERY", () => {
  const abiertos = M.estadoDelMesh().conDescubrimientoAbierto;

  return (
    abiertos.includes("x_api") &&
    abiertos.includes("youtube_data") &&
    abiertos.includes("rss_directo") &&
    abiertos.includes("brave_web")
  );
});

t("el mesh delata qué estaba configurado y sin usar por Territorial", () => {
  const sinUsar = M.estadoDelMesh().configuradosSinUsarPorTerritorial;

  /* El hallazgo del gate: los tres motores de búsqueda. */
  return (
    sinUsar.includes("serpapi_google") &&
    sinUsar.includes("brave_web") &&
    sinUsar.includes("ddg_web")
  );
});

t("KNOWN_ACCOUNT_ONLY no se presenta como escucha abierta", () => {
  const d = M.estadoDelMesh().declaraciones.join(" ");

  return /no permiten descubrimiento abierto/i.test(d) && /no es un fallo del proveedor/i.test(d);
});


/* =========================================================
   CORROBORADO VS PROBABLE — LA DECISIÓN HUMANA
   ========================================================= */

console.log("\n--- Estratos del corpus ---\n");

const CLASES = [
  { estadoGeo: "TERRITORIO_CORROBORADO" },
  { estadoGeo: "TERRITORIO_CORROBORADO" },
  { estadoGeo: "TERRITORIO_PROBABLE" },
  { estadoGeo: "TERRITORIO_AMBIGUO" },
  { estadoGeo: "FUERA_TERRITORIO" },
  { estadoGeo: "TERRITORIO_NO_RESOLUBLE" }
];

t("los cuatro estratos existen y AMPLIADO es la suma explícita", () => {
  const e = M.estratificarCorpus(CLASES);

  assert.equal(e.CORPUS_OBSERVADO, 6);
  assert.equal(e.CORPUS_TERRITORIAL_CORROBORADO, 2);
  assert.equal(e.CORPUS_TERRITORIAL_PROBABLE, 1);
  assert.equal(e.CORPUS_TERRITORIAL_AMPLIADO, 3);
  return true;
});

t("la composición se explica sola: nunca «N publicaciones de Cuenca»", () => {
  const e = M.estratificarCorpus(CLASES);

  assert.match(e.composicion, /3 señales territorialmente utilizables/);
  assert.match(e.composicion, /2 corroboradas y 1 probables/);

  /* La frase prohibida no puede salir de aquí. */
  assert.ok(!/publicaciones de Cuenca/i.test(e.composicion));
  return true;
});

t("AMBIGUO, FUERA, CONFLICTIVO y NO_RESOLUBLE quedan fuera de métricas", () =>
  !M.esEstadoDeMetricaTerritorial("TERRITORIO_AMBIGUO") &&
  !M.esEstadoDeMetricaTerritorial("FUERA_TERRITORIO") &&
  !M.esEstadoDeMetricaTerritorial("TERRITORIO_CONFLICTIVO") &&
  !M.esEstadoDeMetricaTerritorial("TERRITORIO_NO_RESOLUBLE") &&
  M.esEstadoDeMetricaTerritorial("TERRITORIO_CORROBORADO") &&
  M.esEstadoDeMetricaTerritorial("TERRITORIO_PROBABLE"));

t("PROBABLE nunca se mezcla en silencio: sigue siendo cifra aparte", () => {
  const e = M.estratificarCorpus(CLASES);

  /* Que exista AMPLIADO no borra los dos sumandos. */
  return (
    e.CORPUS_TERRITORIAL_CORROBORADO !== undefined &&
    e.CORPUS_TERRITORIAL_PROBABLE !== undefined &&
    e.CORPUS_TERRITORIAL_AMPLIADO ===
      e.CORPUS_TERRITORIAL_CORROBORADO + e.CORPUS_TERRITORIAL_PROBABLE
  );
});

t("la inclusión de PROBABLE es configurable por el consumidor, no impuesta", () => {
  const e = M.estratificarCorpus(CLASES);

  /* Estricto = corroborado. Ampliado = corroborado + probable. */
  const estricto = e.CORPUS_TERRITORIAL_CORROBORADO;
  const ampliado = e.CORPUS_TERRITORIAL_AMPLIADO;

  return estricto === 2 && ampliado === 3 && estricto !== ampliado;
});


/* =========================================================
   PROCEDENCIA DE CONSULTA
   ========================================================= */

console.log("\n--- Procedencia de consulta ---\n");

t("X ya propaga la procedencia de consulta hasta la evidencia", () => {
  const ev = x.normalizarPost(
    { id: "1", text: "algo en Cuenca", author_id: "9", created_at: "2026-09-01T00:00:00Z" },
    {
      userId: "9",
      handle: "medio",
      query: "Cuenca Azuay",
      queryType: "QUERY_NEUTRAL",
      queryLabel: "x:mesh:base"
    }
  );

  assert.equal(ev.provenance.queryLabel, "x:mesh:base");
  assert.equal(ev.provenance.query, "Cuenca Azuay");
  return true;
});

t("sin consulta declarada sigue en null: Candidate no cambia de comportamiento", () => {
  const ev = x.normalizarPost(
    { id: "2", text: "algo", author_id: "9", created_at: "2026-09-01T00:00:00Z" },
    { userId: "9", handle: "medio" }
  );

  return ev.provenance.queryLabel === null && ev.provenance.query === null;
});

t("la procedencia de consulta NO corrobora territorio", () => {
  const r = D.desambiguarTerritorio({
    evidencia: {
      sourceId: "x:1",
      summary: "El agua en La Habana y la fuente de abasto Cuenca Sur",
      provenance: { queryLabel: "x:mesh:base", query: "Cuenca Azuay" },
      queryLabel: "x:mesh:base"
    },
    ubicacion: resolverUbicacion(
      { descripcion: "El agua en La Habana y la fuente de abasto Cuenca Sur" },
      { ambitoId: CUENCA }
    )
  });

  /* Se registra aparte... */
  assert.equal(r.queryProvenance, "x:mesh:base");

  /* ...y no entra en ninguna de las dos listas. */
  assert.ok(!JSON.stringify(r.signalsPositive).includes("mesh"));
  assert.ok(!JSON.stringify(r.signalsNegative).includes("mesh"));
  assert.ok(!JSON.stringify(r.signalsPositive).toLowerCase().includes("query"));

  /* Y la pieza sigue quedando fuera del territorio. */
  assert.equal(r.estadoGeo, "FUERA_TERRITORIO");
  return true;
});

t("un resultado de búsqueda avisa por escrito de que su consulta no es territorio", () => {
  const e = S.normalizarResultadoDeBusqueda(
    { url: "https://ejemplo.ec/a", title: "T", snippet: "S" },
    { collector: "brave_web", query: "Cuenca Azuay", queryLabel: "search:actualidad" }
  );

  assert.equal(e.provenance.queryLabel, "search:actualidad");
  assert.match(e.provenance.avisoTerritorial, /NO es evidencia de su territorio/);
  return true;
});


/* =========================================================
   SEARCH INTELLIGENCE COMO FAMILIA SEPARADA
   ========================================================= */

console.log("\n--- Search Intelligence ---\n");

t("SEARCH_RESULT no es SEARCH_INTEREST, y el interés se declara no disponible", () => {
  assert.equal(S.DISPONIBILIDAD_SEARCH_INTEREST.estado, "NO_DISPONIBLE");
  assert.ok(
    S.DISPONIBILIDAD_SEARCH_INTEREST.loQueNoSePuedeAfirmar.some((x) => /tendencia/i.test(x))
  );
  assert.notEqual(S.TIPOS_DE_SENAL.SEARCH_RESULT, S.TIPOS_DE_SENAL.SEARCH_INTEREST);
  return true;
});

t("las piezas de búsqueda viajan marcadas como familia aparte", () => {
  const e = S.normalizarResultadoDeBusqueda({ url: "https://a.ec/x" }, { collector: "brave_web" });

  return e.familia === "SEARCH_INTELLIGENCE" && e.tipoDeSenal === S.TIPOS_DE_SENAL.SEARCH_RESULT;
});

t("sin fecha del motor NO se inventa una fecha", () => {
  const e = S.normalizarResultadoDeBusqueda({ url: "https://a.ec/x", title: "T" }, {});

  assert.equal(e.publishedAt, null);
  assert.ok(e.declaraciones.some((d) => /no declaró fecha/i.test(d)));
  return true;
});

t("un dominio descubierto NO se promueve a fuente local solo", () => {
  const cand = S.candidatosDeFuente(
    [{ domain: "nuevo.ec" }, { domain: "nuevo.ec" }, { domain: "elmercurio.com.ec" }],
    new Set(["elmercurio.com.ec"])
  );

  assert.equal(cand.length, 1);
  assert.equal(cand[0].dominio, "nuevo.ec");
  assert.equal(cand[0].requiereVerificacion, true);
  assert.equal(cand[0].estado, "DESCUBIERTO_POR_BUSQUEDA");
  return true;
});

await ta("un fallo del proveedor NO se cuenta como «sin resultados»", async () => {
  const r = await S.descubrirPorBusqueda({
    semillas: [
      { id: "a", texto: "q1", familia: "ciudad" },
      { id: "b", texto: "q2", familia: "ciudad" }
    ],
    buscar: async ({ query }) => {
      if (query === "q1") throw new Error("503 del proveedor");
      return { providerId: "brave_web", resultados: [] };
    }
  });

  const a = r.consultas.find((c) => c.queryLabel === "search:a");
  const b = r.consultas.find((c) => c.queryLabel === "search:b");

  assert.equal(a.estado, "ERROR_PROVEEDOR");
  assert.equal(b.estado, "SIN_RESULTADOS");
  assert.notEqual(a.estado, b.estado);
  return true;
});

await ta("vacío ≠ proveedor caído ≠ no soportado: tres estados distintos", async () => {
  const r = await S.descubrirPorBusqueda({
    semillas: [{ id: "v", texto: "q", familia: "ciudad" }],
    buscar: async () => ({ providerId: "brave_web", resultados: [] })
  });

  assert.equal(r.consultas[0].estado, "SIN_RESULTADOS");
  assert.equal(r.evidencias.length, 0);

  /* NOT_SUPPORTED es un modo del mesh, no un resultado vacío. */
  assert.ok(Object.values(M.MODOS).includes("NOT_SUPPORTED"));
  assert.ok(Object.values(M.MODOS).includes("BLOCKED"));
  return true;
});

await ta("el tope de consultas se aplica en el código, no en la buena voluntad", async () => {
  let llamadas = 0;

  const r = await S.descubrirPorBusqueda({
    semillas: S.SEMILLAS,
    maximoConsultas: 2,
    buscar: async () => {
      llamadas += 1;
      return { providerId: "brave_web", resultados: [] };
    }
  });

  assert.equal(llamadas, 2);
  assert.equal(r.consultasEjecutadas, 2);
  return true;
});

await ta("dos consultas que traen el mismo enlace conservan procedencia múltiple", async () => {
  const r = await S.descubrirPorBusqueda({
    semillas: [
      { id: "a", texto: "q1", familia: "ciudad" },
      { id: "b", texto: "q2", familia: "ciudad" }
    ],
    buscar: async () => ({
      providerId: "brave_web",
      resultados: [{ url: "https://mismo.ec/nota", title: "T" }]
    })
  });

  assert.equal(r.observadas, 2);
  assert.equal(r.unicas, 1);
  assert.equal(r.duplicadas, 1);
  assert.equal(r.evidencias[0].provenanceAdicional.length, 1);
  return true;
});

t("las semillas son de descubrimiento, no temas del producto", () => {
  /* Nueve familias neutrales y ninguna se llama «tema». */
  assert.ok(S.SEMILLAS.length >= 8);
  assert.ok(S.SEMILLAS.every((s) => s.familia && s.texto));

  /* Ninguna semilla es «Cuenca» a secas: eso ya produjo 13 falsos positivos. */
  assert.ok(!S.SEMILLAS.some((s) => s.texto.trim().toLowerCase() === "cuenca"));
  return true;
});


/* =========================================================
   ACTOR LOCAL != CONTENIDO LOCAL
   ========================================================= */

console.log("\n--- Actor local vs contenido local ---\n");

t("los activos se EXTRAEN de material publicado; no se inventa ninguna URL", () => {
  const html = `
    <a href="https://facebook.com/UnsionTV">fb</a>
    <a href="https://www.instagram.com/unsiontv/">ig</a>
    <a href="https://www.tiktok.com/@unsiontv">tt</a>
    <a href="https://x.com/UNSIONTV">x</a>
  `;

  const a = A.extraerActivos(html, { tipo: "SITIO_OFICIAL", url: "https://unsion.tv" });

  assert.equal(a.length, 4);
  assert.ok(a.every((v) => html.includes(v.handle)));
  assert.ok(
    a.every((v) => v.estadoIdentidad === A.ESTADOS_IDENTIDAD.ENLAZADO_DESDE_FUENTE_OFICIAL)
  );
  return true;
});

t("«facebook.com/sharer» no es un actor", () => {
  const a = A.extraerActivos('<a href="https://facebook.com/sharer.php?u=x">compartir</a>', {
    tipo: "SITIO_OFICIAL"
  });

  return a.length === 0;
});

t("una coincidencia por búsqueda NO autoriza gastar un crédito", () => {
  assert.equal(A.autorizaObservacion(A.ESTADOS_IDENTIDAD.COINCIDENCIA_POR_BUSQUEDA), false);
  assert.equal(A.autorizaObservacion(A.ESTADOS_IDENTIDAD.ENLAZADO_DESDE_FUENTE_OFICIAL), true);
  assert.equal(A.autorizaObservacion(A.ESTADOS_IDENTIDAD.VERIFICADO_POR_ANALISTA), true);
  assert.equal(A.autorizaObservacion(A.ESTADOS_IDENTIDAD.NO_RESUELTO), false);
  return true;
});

t("el actor NO recibe estado territorial: el territorio es por pieza", () => {
  const m = A.mapaDeActivos({
    actor: { actorId: "web:unsion.tv", nombre: "Unsión TV", discoveredBy: "universo_de_fuentes" },
    activos: A.extraerActivos('<a href="https://facebook.com/UnsionTV">x</a>', {
      tipo: "SITIO_OFICIAL"
    })
  });

  assert.match(m.territorialStateDelActor, /NO APLICA/);
  assert.match(m.declaraciones.join(" "), /NO nace territorialmente corroborado/);
  return true;
});

t("un medio local publicando algo no local NO produce territorio corroborado", () => {
  /*
    El Mercurio es de Cuenca. Esta nota habla del dólar. La
    nota no es de Cuenca, y el actor no la salva.
  */
  const r = clasificar({
    domain: "elmercurio.com.ec",
    sourceId: "web:elmercurio.com.ec",
    publisher: "El Mercurio",
    title: "El dólar y la economía nacional",
    summary: "Análisis del tipo de cambio"
  });

  assert.notEqual(r.estadoGeo, "TERRITORIO_CORROBORADO");
  assert.equal(r.aptoParaMetricas, false);
  return true;
});

t("las plataformas sin resolver se declaran: es ecosistema no observado", () => {
  const m = A.mapaDeActivos({
    actor: { actorId: "a" },
    activos: A.extraerActivos('<a href="https://facebook.com/X">f</a>', { tipo: "SITIO_OFICIAL" })
  });

  assert.ok(m.plataformasSinResolver.includes("tiktok"));
  assert.ok(m.plataformasSinResolver.includes("instagram"));
  assert.match(m.declaraciones.join(" "), /no observado, no ausencia de actividad/);
  return true;
});

t("DISCOVERED_BY y OBSERVED_BY no se confunden", () => {
  const activos = A.extraerActivos('<a href="https://tiktok.com/@emac_ep">t</a>', {
    tipo: "SITIO_OFICIAL",
    url: "https://emac.gob.ec"
  });

  const m = A.mapaDeActivos({
    actor: { actorId: "web:emac.gob.ec", discoveredBy: "universo_de_fuentes" },
    activos
  });

  /* Lo descubrió el universo de fuentes; lo observará el proveedor. */
  assert.equal(m.discoveredBy, "universo_de_fuentes");
  assert.equal(activos[0].descubiertoEn, "SITIO_OFICIAL");
  assert.equal(activos[0].modoDeObservacion, "KNOWN_ACCOUNT_ONLY");
  return true;
});


/* =========================================================
   PRESUPUESTO
   ========================================================= */

console.log("\n--- Presupuesto ---\n");

const MAPAS = [
  {
    actorId: "a1",
    porPlataforma: {
      facebook: [
        { plataforma: "facebook", handle: "f1", estadoIdentidad: A.ESTADOS_IDENTIDAD.ENLAZADO_DESDE_FUENTE_OFICIAL },
        { plataforma: "facebook", handle: "f2", estadoIdentidad: A.ESTADOS_IDENTIDAD.ENLAZADO_DESDE_FUENTE_OFICIAL },
        { plataforma: "facebook", handle: "f3", estadoIdentidad: A.ESTADOS_IDENTIDAD.COINCIDENCIA_POR_BUSQUEDA }
      ],
      instagram: [],
      tiktok: []
    }
  }
];

t("el tope de créditos se aplica ANTES de llamar", () => {
  const p = A.planDeObservacion({ mapas: MAPAS, creditosDisponibles: 1 });

  assert.equal(p.aObservar.length, 1);
  assert.equal(p.creditosPlanificados, 1);
  assert.equal(p.topeRespetado, true);
  return true;
});

t("los excluidos dicen POR QUÉ: identidad o presupuesto", () => {
  const p = A.planDeObservacion({ mapas: MAPAS, creditosDisponibles: 1 });

  const motivos = p.excluidos.map((e) => e.motivo);

  assert.ok(motivos.includes("IDENTIDAD_INSUFICIENTE"));
  assert.ok(motivos.includes("PRESUPUESTO_AGOTADO"));
  return true;
});

t("con presupuesto cero no se planifica ninguna llamada", () => {
  const p = A.planDeObservacion({ mapas: MAPAS, creditosDisponibles: 0 });

  return p.aObservar.length === 0 && p.creditosPlanificados === 0;
});


/* =========================================================
   MÉTRICAS DE VALOR Y SOLAPAMIENTO
   ========================================================= */

console.log("\n--- Valor por colector y solapamiento ---\n");

t("un colector no es bueno por devolver mucho: se mide señal NUEVA", () => {
  const previo = new Set(["https://a.ec/1"]);

  const m = M.metricasDeColector({
    collector: "c",
    familia: M.FAMILIAS.SEARCH_INTELLIGENCE,
    modo: M.MODOS.OPEN_DISCOVERY,
    observadas: [
      { canonicalUrl: "https://a.ec/1", domain: "a.ec" },
      { canonicalUrl: "https://a.ec/2", domain: "a.ec" },
      { canonicalUrl: "https://a.ec/2", domain: "a.ec" }
    ],
    corpusPrevio: previo,
    clasificaciones: [{ estadoGeo: "TERRITORIO_CORROBORADO" }, { estadoGeo: "FUERA_TERRITORIO" }]
  });

  assert.equal(m.observed_items, 3);
  assert.equal(m.unique_items, 2);
  assert.equal(m.duplicate_items, 1);
  assert.equal(m.new_items_vs_existing_corpus, 1);
  assert.equal(m.overlap_items, 1);
  assert.equal(m.overlap_rate, 0.5);
  assert.equal(m.noise_rate, 0.5);
  return true;
});

t("el coste monetario es null si no se conoce: no se estima", () => {
  const m = M.metricasDeColector({ collector: "c", observadas: [], clasificaciones: [] });

  return m.costeMonetario === null && m.credits === null;
});

t("la calidad de procedencia se mide, no se supone", () => {
  const m = M.metricasDeColector({
    collector: "c",
    observadas: [
      { canonicalUrl: "u1", publishedAt: "2026-09-01", provenance: { queryLabel: "q" } },
      { canonicalUrl: "u2" }
    ],
    clasificaciones: []
  });

  assert.equal(m.provenance_quality.total, 2);
  assert.equal(m.provenance_quality.conPublishedAt, 1);
  assert.equal(m.provenance_quality.conQueryProvenance, 1);
  return true;
});

t("la misma pieza vista por dos colectores cuenta UNA vez y conserva ambas procedencias", () => {
  const s = M.solapamientoEntreColectores({
    x_api: [{ canonicalUrl: "https://a.ec/1" }, { canonicalUrl: "https://a.ec/2" }],
    brave_web: [{ canonicalUrl: "https://a.ec/1" }, { canonicalUrl: "https://a.ec/3" }]
  });

  assert.equal(s.piezasUnicasEnTotal, 3);
  assert.equal(s.piezasConProcedenciaMultiple, 1);
  assert.equal(s.paresConSolapamiento[0].comunes, 1);
  assert.deepEqual(s.procedenciaMultiple[0].collectors, ["x_api", "brave_web"]);
  assert.match(s.declaracion, /cuenta UNA vez/);
  return true;
});

t("sin solapamiento no se inventan pares", () => {
  const s = M.solapamientoEntreColectores({
    a: [{ canonicalUrl: "u1" }],
    b: [{ canonicalUrl: "u2" }]
  });

  return s.paresConSolapamiento.length === 0 && s.piezasConProcedenciaMultiple === 0;
});


/* =========================================================
   PRIVACIDAD Y REPRESENTATIVIDAD
   ========================================================= */

console.log("\n--- Privacidad y representatividad ---\n");

t("no se emite ningún atributo sensible ni inferencia de residencia", () => {
  const m = A.mapaDeActivos({
    actor: { actorId: "a", nombre: "Un medio" },
    activos: A.extraerActivos('<a href="https://instagram.com/medio">i</a>', {
      tipo: "SITIO_OFICIAL"
    })
  });

  const texto = JSON.stringify(m) + JSON.stringify(M.MESH) + JSON.stringify(M.estadoDelMesh());

  return !/residen|domicili|vive en|etni|religi|orientaci[óo]n sexual|ideolog|psicol|intenci[óo]n de voto|latitud|longitud/i.test(
    texto
  );
});

t("ninguna salida del mesh afirma representatividad", () => {
  const texto =
    JSON.stringify(M.estadoDelMesh()) +
    JSON.stringify(M.estratificarCorpus(CLASES)) +
    JSON.stringify(S.DISPONIBILIDAD_SEARCH_INTEREST);

  assert.ok(!/representa a Cuenca|opini[óo]n p[úu]blica|% de los cuencanos|sentimiento de la poblaci/i.test(texto));

  /* Y lo dice explícitamente. */
  assert.match(M.estadoDelMesh().declaraciones.join(" "), /afirma representatividad/i);
  return true;
});

t("first-party analytics queda como futuro y sin implementar", () => {
  const fp = M.FUTURO.find((f) => f.familia === "FIRST_PARTY_ANALYTICS");

  assert.ok(fp);
  assert.match(fp.porQueNoAhora, /NO se implementa ningún tracking/i);
  return true;
});

t("las familias futuras se registran para que la ausencia sea legible", () => {
  const fam = M.FUTURO.map((f) => f.familia);

  return (
    fam.includes("GOOGLE_MAPS_REVIEWS") &&
    fam.includes("REDDIT_FOROS_BLOGS") &&
    fam.includes("TELEGRAM_PUBLICO") &&
    M.FUTURO.every((f) => f.porQueNoAhora && f.modo)
  );
});


/* =========================================================
   AISLAMIENTO DE PROYECTO
   ========================================================= */

console.log("\n--- Aislamiento de proyecto ---\n");

const { reconstruirEstado } = await import("../services/territorial/evidenceLedger.js");

const OBS = [
  {
    evidenceId: "eA",
    projectId: "alcaldia-cuenca-2027-piloto",
    tenantId: "t1",
    canonicalUrl: "https://a.ec/1",
    title: "Cuenca, Azuay",
    providerId: "brave_web",
    retrievedAt: "2026-09-03T00:00:00Z",
    firstObservedAt: "2026-09-03T00:00:00Z"
  },
  {
    evidenceId: "eB",
    projectId: "proyecto-b-fixture",
    tenantId: "t1",
    canonicalUrl: "https://b.ec/1",
    title: "Otra cosa",
    providerId: "brave_web",
    retrievedAt: "2026-09-03T00:00:00Z",
    firstObservedAt: "2026-09-03T00:00:00Z"
  }
];

t("proyecto A > 0 y proyecto B = 0 con el mismo libro", () => {
  const a = reconstruirEstado(OBS, { projectId: "alcaldia-cuenca-2027-piloto" });
  const b = reconstruirEstado(OBS, { projectId: "otro-que-no-existe" });

  assert.equal(a.size, 1);
  assert.equal(b.size, 0);
  return true;
});

t("MUTACIÓN: si se quita projectId, el aislamiento DEBE romperse", () => {
  const sinProyecto = OBS.map(({ projectId, ...resto }) => resto);

  const a = reconstruirEstado(sinProyecto, { projectId: "alcaldia-cuenca-2027-piloto" });

  /*
    Esta prueba existe para fallar si alguien quita el filtro.
    Sin projectId y sin legado, no puede haber evidencia del
    proyecto: si aquí saliera > 0, el aislamiento sería falso.
  */
  assert.equal(a.size, 0);

  const conLegado = reconstruirEstado(sinProyecto, {
    projectId: "alcaldia-cuenca-2027-piloto",
    incluirLegado: true
  });

  assert.equal(conLegado.size, 2);
  return true;
});

t("una evidencia de búsqueda conserva los campos que exige el aislamiento", () => {
  const e = S.normalizarResultadoDeBusqueda(
    { url: "https://a.ec/x", title: "T", snippet: "S" },
    { collector: "brave_web", query: "q", queryLabel: "search:actualidad", observedAt: "2026-09-03T00:00:00Z" }
  );

  assert.ok(e.canonicalUrl && e.evidenceId);
  assert.ok(e.providers.length && e.providerId);
  assert.ok(e.provenance.observedAt);
  assert.ok(e.provenance.queryLabel);
  assert.equal(e.territoryId, null);
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
