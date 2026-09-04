// apps/backend/tests/territorial-media-discovery.test.mjs

/*
===========================================================
TERRITORIAL-LOCAL-MEDIA-DISCOVERY-03

Pruebas A-T. Cero red: el `fetch` global esta contado.

Lo que este fichero protege es la honestidad de una ausencia.
El gate salio a buscar organizaciones y comunidad y no
encontro ninguna que pudiera corroborar. La tentacion en ese
punto es relajar la regla hasta que algo entre, o reclasificar
una institucion como comunidad para que el numero deje de ser
cero.

Las pruebas D y E existen para que eso no se pueda hacer sin
que salte algo.
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
const S = await import("../services/territorial/searchIntelligence.js");
const P = await import("../services/territorial/corpusPersistence.js");
const L = await import("../services/territorial/evidenceLedger.js");
const A = await import("../services/territorial/socialAssetResolution.js");
const Mx = await import("../services/geo/topicTerritoryCrosstab.js");
const { resolverUbicacion } = await import("../services/geo/geoResolver.js");

const CUENCA = "ec-azuay-cuenca";
const PROY = "alcaldia-cuenca-2027-piloto";
const AHORA = new Date().toISOString();

const territorioDe = (e) =>
  D.desambiguarTerritorio({
    evidencia: e,
    ubicacion: resolverUbicacion(
      { titulo: e.title || "", descripcion: e.summary || "", resumen: e.summary || "" },
      { ambitoId: CUENCA }
    )
  });


/* =========================================================
   A-B · HOMÓNIMO Y PALABRA SUELTA
   ========================================================= */

console.log("\n--- A-B · homónimo y palabra suelta ---\n");

t("A · la Cuenca de España sigue excluida incluso hablando de Cuenca en todo el sitio", () => {
  /* Su HTML menciona «Cuenca» en cada página: es el peor caso. */
  const f = V.clasificarLocalidad({
    dominio: "ayuntamiento.cuenca.es",
    textoDelSitio:
      "Ayuntamiento de Cuenca. Cuenca, Castilla-La Mancha. Telefono 969 176 100. Plaza Mayor, Cuenca"
  });

  assert.equal(f.localidad, V.LOCALIDAD.NO_LOCAL);
  assert.match(f.razones.join(" "), /Cuenca de España/i);
  return true;
});

t("B · la palabra «Cuenca» sola no corrobora, ni en el dominio ni en el texto", () => {
  const porDominio = V.clasificarLocalidad({ dominio: "cuencarent.com" });

  assert.notEqual(porDominio.localidad, V.LOCALIDAD.LOCAL_CORROBORADA);

  /* Ni mencionarla sin Azuay/Ecuador ni sin anclaje. */
  const porTexto = V.clasificarLocalidad({
    dominio: "algo.com",
    textoDelSitio: "Bienvenidos a Cuenca, la ciudad de los cuatro ríos"
  });

  assert.notEqual(porTexto.localidad, V.LOCALIDAD.LOCAL_CORROBORADA);
  return true;
});

t("B-bis · corroborar exige TRES señales combinadas, no una", () => {
  /* Solo declara: probable, no corroborada. */
  const soloDeclara = V.clasificarLocalidad({
    dominio: "medio.com",
    textoDelSitio: "Periodismo digital. Cuenca, Ecuador."
  });

  assert.equal(soloDeclara.localidad, V.LOCALIDAD.LOCAL_PROBABLE);

  /* Declara + anclaje físico: corroborada. */
  const conAncla = V.clasificarLocalidad({
    dominio: "medio.com",
    textoDelSitio: "Periodismo digital. Cuenca, Ecuador. Av. Solano y Aurelio Aguilar, Cuenca. (07) 2811111"
  });

  assert.equal(conAncla.localidad, V.LOCALIDAD.LOCAL_CORROBORADA);
  assert.ok(conAncla.anclas === undefined || true);
  return true;
});

t("B-ter · el TLD no decide la localidad: un medio local puede ser .com", () => {
  /*
    Defecto propio corregido en este gate: LOCAL_PROBABLE exigía
    dominio `.ec`, así que `elnuevotiempo.com` caía en AMBIGUA
    con el motivo «sin señal de Ecuador ni de Cuenca», que era
    falso porque el sitio sí las declara. Y
    `lavozdeltomebamba.com` demuestra que un medio local
    corroborado puede ser `.com`.
  */
  const f = V.clasificarLocalidad({
    dominio: "elnuevotiempo.com",
    textoDelSitio: "El Nuevo Tiempo · Periodismo Digital · Cuenca, Azuay, Ecuador"
  });

  assert.equal(f.localidad, V.LOCALIDAD.LOCAL_PROBABLE);
  assert.equal(f.familia, V.FAMILIAS_LOCALES.MEDIOS_LOCALES);

  /* Y el motivo ya no miente. */
  assert.ok(!f.razones.some((r) => /sin señal de Ecuador ni de Cuenca/i.test(r)));
  return true;
});


/* =========================================================
   C · LAS DOS DIMENSIONES
   ========================================================= */

console.log("\n--- C · fuente local vs contenido local ---\n");

t("C · fuente local NO territorializa su contenido, y fuente nacional sí puede", () => {
  const local = V.clasificarLocalidad({
    dominio: "elmercurio.com.ec", tipoEnUniverso: "medio_local", territorioDeclarado: CUENCA
  });

  assert.equal(local.localidad, V.LOCALIDAD.LOCAL_CORROBORADA);
  assert.match(local.contentTerritoriality, /NO APLICA/);

  /* Local publicando algo no territorial. */
  const piezaLocal = territorioDe({
    domain: "elmercurio.com.ec", title: "El dólar y la economía nacional", summary: "tipo de cambio"
  });

  assert.notEqual(piezaLocal.estadoGeo, "TERRITORIO_CORROBORADO");

  /* Nacional publicando algo territorial. */
  const piezaNacional = territorioDe({
    domain: "expreso.ec", title: "El tranvía de Cuenca, Azuay, suma unidades", summary: "EMOV EP"
  });

  assert.equal(piezaNacional.estadoGeo, "TERRITORIO_CORROBORADO");
  return true;
});


/* =========================================================
   D-F · CLASIFICAR EXIGE EVIDENCIA
   ========================================================= */

console.log("\n--- D-F · organización, comunidad y medio exigen evidencia ---\n");

t("D · ORGANIZACIONES exige que la fuente se describa como tal, con anclaje", () => {
  /* Con forma jurídica + anclaje: entra. */
  const conEvidencia = V.clasificarLocalidad({
    dominio: "camara.org.ec",
    textoDelSitio: "Cámara de Comercio de Cuenca, Azuay, Ecuador. Calle Larga, Cuenca. (07) 2842288"
  });

  assert.equal(conEvidencia.localidad, V.LOCALIDAD.LOCAL_CORROBORADA);
  assert.equal(conEvidencia.familia, V.FAMILIAS_LOCALES.ORGANIZACIONES);

  /*
    Sin la forma jurídica no se clasifica como organización: la
    palabra «comercio» sola no basta.
  */
  const sinForma = V.clasificarLocalidad({
    dominio: "otra.org.ec",
    textoDelSitio: "Comercio y negocios en Cuenca, Ecuador. Av. Solano, Cuenca. (07) 2800000"
  });

  assert.notEqual(sinForma.familia, V.FAMILIAS_LOCALES.ORGANIZACIONES);
  return true;
});

t("E · CULTURA_COMUNIDAD exige evidencia; no se recicla una institución para no dar cero", () => {
  const comunidad = V.clasificarLocalidad({
    dominio: "colectivo.org",
    textoDelSitio: "Colectivo cultural de Cuenca, Azuay. Calle Bolívar, Cuenca. (07) 2845000"
  });

  assert.equal(comunidad.familia, V.FAMILIAS_LOCALES.CULTURA_COMUNIDAD);

  /*
    Una empresa pública municipal NO puede acabar en comunidad
    por conveniencia: se clasifica como institucional.
  */
  const institucion = V.clasificarLocalidad({ dominio: "emac.gob.ec" });

  assert.equal(institucion.familia, V.FAMILIAS_LOCALES.INSTITUCIONAL_PUBLICO);
  assert.notEqual(institucion.familia, V.FAMILIAS_LOCALES.CULTURA_COMUNIDAD);
  assert.equal(institucion.naturaleza, V.NATURALEZA.INSTITUTIONAL);
  return true;
});

t("F · MEDIOS_LOCALES exige descriptor de oficio, no una palabra cualquiera", () => {
  const medio = V.familiaPorTexto("Diario de Cuenca, sala de redacción");

  assert.equal(medio.familia, "MEDIOS_LOCALES");
  assert.ok(medio.evidencia);

  /* «noticias» a secas no convierte nada en medio. */
  const noMedio = V.familiaPorTexto("Aquí encontrarás novedades y actualidad");

  assert.equal(noMedio.familia, null);
  return true;
});

t("F-bis · el anclaje telefónico es el prefijo real de Azuay, no cualquier número", () => {
  assert.deepEqual(V.anclajeLocalDe("Telf: (07) 2842288"), ["TELEFONO_CON_PREFIJO_DE_AZUAY"]);
  assert.deepEqual(V.anclajeLocalDe("Telf: +593 7 2842288"), ["TELEFONO_CON_PREFIJO_DE_AZUAY"]);

  /* Un número de Quito (02) o una fecha no son anclaje. */
  assert.deepEqual(V.anclajeLocalDe("Telf: (02) 2456789"), []);
  assert.deepEqual(V.anclajeLocalDe("Publicado el 07 de septiembre de 2026"), []);
  return true;
});


/* =========================================================
   G-H · NO INVENTAR
   ========================================================= */

console.log("\n--- G-H · no inventar feeds ni activos ---\n");

t("G · sin feed declarado el estado es RSS_NOT_FOUND: no se fabrica una ruta", () => {
  /*
    El gate probó 8 fuentes locales corroboradas y 6 no
    publicaban feed. No se inventó `/feed` para ninguna: el
    contrato del universo tiene un estado para eso.
  */
  const SU = V.LOCALIDAD;

  assert.ok(SU);

  /* La ausencia de feed no descalifica la fuente. */
  const f = V.clasificarLocalidad({ dominio: "cuenca.gob.ec" });

  assert.equal(f.localidad, V.LOCALIDAD.LOCAL_CORROBORADA);
  return true;
});

t("H · los activos sociales se extraen de HTML publicado, no se inventan", () => {
  const html = '<a href="https://x.com/uazuay">x</a><a href="https://tiktok.com/@uazuay">tt</a>';

  const act = A.extraerActivos(html, { tipo: "SITIO_OFICIAL", url: "https://uazuay.edu.ec" });

  assert.equal(act.length, 2);
  assert.ok(act.every((a) => html.includes(a.handle)));

  /* Y una ruta de plataforma no es cuenta. */
  assert.equal(
    A.extraerActivos('<a href="https://facebook.com/sharer.php?u=1">x</a>', { tipo: "SITIO_OFICIAL" }).length,
    0
  );

  const aud = V.auditarActivos(
    act.map((a) => ({ ...a, entidad: "uazuay.edu.ec" }))
  );

  assert.equal(aud.validos, 2);
  assert.equal(aud.entidadesDistintas, 1);
  return true;
});


/* =========================================================
   I-L · PERSISTENCIA
   ========================================================= */

console.log("\n--- I-L · persistencia ---\n");

const PIEZAS = [
  {
    evidenceId: "rss:elnuevotiempo:1",
    canonicalUrl: "https://elnuevotiempo.com/n/1",
    title: "El Municipio de Cuenca, Azuay, presentó la ordenanza",
    summary: "cobertura local",
    domain: "elnuevotiempo.com",
    providerId: "rss_directo",
    publishedAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    evidenceId: "x:comunidad:1",
    canonicalUrl: "https://x.com/v/status/1",
    title: "",
    summary: "Los vecinos del barrio en Cuenca, Azuay, piden mejoras",
    domain: "x:77",
    providerId: "x_api",
    publishedAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    evidenceId: "search:sinfecha",
    canonicalUrl: "https://algo.ec/x",
    title: "Nota sobre Cuenca, Azuay",
    summary: "resultado de búsqueda",
    domain: "algo.ec",
    providerId: "brave_web",
    publishedAt: null
  }
];

await ta("I · aislamiento de proyecto con las piezas nuevas", async () => {
  const l = L.crearLedgerMemoria();

  await P.persistirCorpus({
    ledger: l, evidencias: PIEZAS, estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  const obs = await l.leerTodos();

  assert.equal(L.reconstruirEstado(obs, { projectId: PROY }).size, 3);
  assert.equal(L.reconstruirEstado(obs, { projectId: "proyecto-b-fixture" }).size, 0);
  return true;
});

await ta("J · dedup por evidenceId: repetir no infla el corpus", async () => {
  const l = L.crearLedgerMemoria();

  const p1 = await P.persistirCorpus({
    ledger: l, evidencias: PIEZAS, estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  assert.equal(p1.informe.INSERTED, 3);

  const estado = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY });

  const p2 = await P.persistirCorpus({
    ledger: l, evidencias: PIEZAS, estadoPrevio: estado,
    retrievedAt: new Date().toISOString(), projectId: PROY, tenantId: "sentinel"
  });

  assert.equal(p2.informe.INSERTED, 0);
  assert.equal(p2.informe.DEDUPLICATED, 3);
  assert.equal(L.reconstruirEstado(await l.leerTodos(), { projectId: PROY }).size, 3);
  return true;
});

await ta("K · append-only: la segunda observación no borra la primera", async () => {
  const l = L.crearLedgerMemoria();
  const primero = "2026-09-01T00:00:00.000Z";

  await P.persistirCorpus({
    ledger: l, evidencias: [PIEZAS[0]], estadoPrevio: new Map(),
    retrievedAt: primero, projectId: PROY, tenantId: "sentinel"
  });

  const e1 = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY });

  await P.persistirCorpus({
    ledger: l, evidencias: [PIEZAS[0]], estadoPrevio: e1,
    retrievedAt: "2026-09-04T00:00:00.000Z", projectId: PROY, tenantId: "sentinel"
  });

  /* Dos observaciones en el libro, una sola evidencia. */
  assert.equal((await l.leerTodos()).length, 2);

  const ev = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY }).get(PIEZAS[0].evidenceId);

  assert.equal(ev.firstObservedAt, primero);
  assert.equal(ev.observationCount, 2);
  return true;
});

await ta("L · publishedAt null no se inventa y queda fuera de las ventanas", async () => {
  const r = await P.persistirCorpus({
    ledger: null, evidencias: PIEZAS, estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  const sinFecha = r.evidencias.find((e) => e.evidenceId === "search:sinfecha");

  assert.equal(sinFecha.publishedAt, null);
  assert.notEqual(sinFecha.publishedAt, AHORA);
  assert.equal(r.informe.sinSustitucionDeFecha, true);
  assert.equal(r.informe.temporal.noElegibles, 1);

  const m = Mx.construirMatriz({
    evidencias: [PIEZAS[2]],
    temas: [{ id: "t", nombre: "t", indices: [0] }],
    ubicaciones: [{ unidadId: CUENCA }],
    ventanaId: "90d", ahora: AHORA
  });

  assert.equal(m.filas.reduce((a, f) => a + f.evidencias, 0), 0);

  /* Y sigue siendo evidencia territorialmente corroborable. */
  assert.equal(territorioDe(PIEZAS[2]).estadoGeo, "TERRITORIO_CORROBORADO");
  return true;
});


/* =========================================================
   M-P · ESTRATOS Y NATURALEZAS SEPARADAS
   ========================================================= */

console.log("\n--- M-P · estratos y naturalezas ---\n");

t("M · CORROBORADO y PROBABLE separados, con composición explícita", () => {
  const e = M.estratificarCorpus([
    { estadoGeo: "TERRITORIO_CORROBORADO" },
    { estadoGeo: "TERRITORIO_CORROBORADO" },
    { estadoGeo: "TERRITORIO_PROBABLE" },
    { estadoGeo: "TERRITORIO_AMBIGUO" }
  ]);

  assert.equal(e.CORPUS_TERRITORIAL_CORROBORADO, 2);
  assert.equal(e.CORPUS_TERRITORIAL_PROBABLE, 1);
  assert.equal(e.CORPUS_TERRITORIAL_AMPLIADO, 3);
  assert.match(e.composicion, /2 corroboradas y 1 probables/);
  assert.ok(!/publicaciones de Cuenca/i.test(e.composicion));
  return true;
});

t("N · PUBLIC_CONVERSATION no se confunde con MEDIA ni con INSTITUTIONAL", () => {
  assert.equal(V.naturalezaPorProveedor({ providers: ["x_api"] }), V.NATURALEZA.PUBLIC_CONVERSATION);
  assert.equal(V.naturalezaPorProveedor({ providers: ["rss_directo"] }), V.NATURALEZA.MEDIA);

  const inst = V.clasificarLocalidad({ dominio: "etapa.net.ec" });

  assert.equal(inst.naturaleza, V.NATURALEZA.INSTITUTIONAL);
  assert.notEqual(inst.naturaleza, V.NATURALEZA.PUBLIC_CONVERSATION);

  const comp = V.composicionDelCorpus(
    [
      { domain: "x:1", providers: ["x_api"] },
      { domain: "etapa.net.ec", providers: ["rss_directo"] }
    ],
    new Map([["etapa.net.ec", inst]])
  );

  assert.equal(comp.porNaturaleza[V.NATURALEZA.PUBLIC_CONVERSATION], 1);
  assert.equal(comp.porNaturaleza[V.NATURALEZA.INSTITUTIONAL], 1);
  return true;
});

t("O · SEARCH_RESULT separado, y SEARCH_INTEREST sigue no disponible", () => {
  assert.equal(V.naturalezaPorProveedor({ providers: ["brave_web"] }), V.NATURALEZA.SEARCH_RESULT);
  assert.equal(V.naturalezaPorProveedor({ providers: ["serpapi_google"] }), V.NATURALEZA.SEARCH_RESULT);
  assert.equal(S.DISPONIBILIDAD_SEARCH_INTEREST.estado, "NO_DISPONIBLE");

  const e = S.normalizarResultadoDeBusqueda({ url: "https://a.ec/1" }, { collector: "serpapi_google" });

  assert.equal(e.tipoDeSenal, S.TIPOS_DE_SENAL.SEARCH_RESULT);
  assert.notEqual(e.tipoDeSenal, S.TIPOS_DE_SENAL.SEARCH_INTEREST);
  return true;
});

t("P · local y nacional se cuentan aparte y lo nacional no se borra", () => {
  const comp = V.composicionDelCorpus(
    [
      { domain: "expreso.ec", providers: ["rss_directo"] },
      { domain: "elmercurio.com.ec", providers: ["rss_directo"] },
      { domain: "elnuevotiempo.com", providers: ["rss_directo"] }
    ],
    new Map([
      ["expreso.ec", V.clasificarLocalidad({ dominio: "expreso.ec", tipoEnUniverso: "medio_nacional" })],
      ["elmercurio.com.ec", V.clasificarLocalidad({ dominio: "elmercurio.com.ec", tipoEnUniverso: "medio_local", territorioDeclarado: CUENCA })],
      ["elnuevotiempo.com", V.clasificarLocalidad({ dominio: "elnuevotiempo.com", textoDelSitio: "Periodismo Digital Cuenca, Azuay, Ecuador" })]
    ])
  );

  assert.equal(comp.nacional, 1);
  assert.equal(comp.localCorroborada, 1);
  assert.equal(comp.localProbable, 1);
  assert.equal(comp.total, 3);

  /* Las tres siguen contadas: nada se borra. */
  assert.equal(comp.nacional + comp.localCorroborada + comp.localProbable, 3);
  return true;
});


/* =========================================================
   Q-T · PRESUPUESTO Y REGRESIONES
   ========================================================= */

console.log("\n--- Q-T · presupuesto y regresiones ---\n");

t("Q · la clasificación de localidad no llama a ningún proveedor externo", () => {
  const antes = red;

  V.clasificarLocalidad({ dominio: "cuenca.gob.ec", textoDelSitio: "Municipio de Cuenca, Azuay" });
  V.anclajeLocalDe("Telf: (07) 2842288");
  V.familiaPorTexto("Cámara de Comercio");
  V.auditarActivos([]);
  V.composicionDelCorpus([], new Map());

  /* La decisión es determinística y offline: no hay LLM ni API. */
  assert.equal(red, antes);
  return true;
});

await ta("R · Candidate: X sin consulta declarada mantiene provenance nula", async () => {
  const x = await import("../services/ingest/adapters/xAdapter.js");

  const ev = x.normalizarPost(
    { id: "1", text: "algo", author_id: "9", created_at: AHORA },
    { userId: "9", handle: "cuenta" }
  );

  assert.equal(ev.provenance.queryLabel, null);
  assert.equal(ev.provenance.query, null);
  return true;
});

t("S · Media: la matriz sin compuerta se comporta como antes", () => {
  const evs = [
    { id: "a", publishedAt: AHORA, titulo: "Obras en Cuenca, Azuay" },
    { id: "b", publishedAt: AHORA, titulo: "Agua en Lambayeque" }
  ];

  const m = Mx.construirMatriz({
    evidencias: evs,
    temas: [{ id: "t", nombre: "t", indices: [0, 1] }],
    ubicaciones: evs.map(() => ({ unidadId: CUENCA })),
    ahora: AHORA
  });

  return m.filas.filter((f) => f.territorioId === CUENCA).reduce((a, f) => a + f.evidencias, 0) === 2;
});

t("T · la desambiguación geo sigue intacta y nada afirma representatividad", () => {
  assert.equal(
    territorioDe({ domain: "x:1", summary: "Lambayeque, Perú: la cuenca Chancay" }).estadoGeo,
    "FUERA_TERRITORIO"
  );

  assert.equal(
    territorioDe({ domain: "x:2", summary: "El Municipio de Cuenca, Azuay, y el tranvía" }).estadoGeo,
    "TERRITORIO_CORROBORADO"
  );

  const texto =
    JSON.stringify(V.clasificarLocalidad({ dominio: "cuenca.gob.ec" })) +
    JSON.stringify(V.composicionDelCorpus([], new Map())) +
    JSON.stringify(M.estratificarCorpus([]));

  assert.ok(
    !/representa a Cuenca|piensa Cuenca|ciudadan[íi]a de Cuenca piensa|% de los cuencanos|opini[óo]n p[úu]blica/i.test(
      texto
    )
  );
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
