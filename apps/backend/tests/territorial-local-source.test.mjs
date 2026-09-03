// apps/backend/tests/territorial-local-source.test.mjs

/*
===========================================================
TERRITORIAL-LOCAL-SOURCE-EXPANSION-02

Pruebas A-R. Cero red: el `fetch` global esta contado.

El invariante central del gate:

    SOURCE_LOCALITY         !=  CONTENT_TERRITORIALITY

Que una fuente sea de Cuenca no hace que sus piezas hablen de
Cuenca, y que un medio sea nacional no impide que una pieza
concreta si lo haga. Las pruebas B y C fijan las dos
direcciones, porque romper cualquiera de las dos produce un
corpus que miente en sentido contrario.
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
const Mx = await import("../services/geo/topicTerritoryCrosstab.js");
const { resolverUbicacion } = await import("../services/geo/geoResolver.js");
const A = await import("../services/territorial/socialAssetResolution.js");

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
   A-C · LAS DOS DIMENSIONES
   ========================================================= */

console.log("\n--- A-C · localidad de fuente vs territorialidad de pieza ---\n");

t("A · la localidad de la fuente y la territorialidad del contenido son campos distintos", () => {
  const f = V.clasificarLocalidad({
    dominio: "elmercurio.com.ec",
    tipoEnUniverso: "medio_local",
    territorioDeclarado: CUENCA
  });

  assert.equal(f.localidad, V.LOCALIDAD.LOCAL_CORROBORADA);

  /* Y la propia ficha lo declara por escrito. */
  assert.match(f.contentTerritoriality, /NO APLICA/);
  assert.match(f.contentTerritoriality, /pieza a pieza/);
  return true;
});

t("B · una fuente LOCAL_CORROBORADA no territorializa su contenido", () => {
  const f = V.clasificarLocalidad({
    dominio: "elmercurio.com.ec",
    tipoEnUniverso: "medio_local",
    territorioDeclarado: CUENCA
  });

  assert.equal(f.localidad, V.LOCALIDAD.LOCAL_CORROBORADA);

  /* La pieza no menciona Cuenca ni Azuay. */
  const r = territorioDe({
    domain: "elmercurio.com.ec",
    publisher: "El Mercurio",
    title: "El dólar y la economía nacional",
    summary: "Análisis del tipo de cambio y la balanza comercial"
  });

  assert.notEqual(r.estadoGeo, "TERRITORIO_CORROBORADO");
  assert.equal(r.aptoParaMetricas, false);
  return true;
});

t("C · una fuente nacional SÍ puede producir contenido territorial corroborado", () => {
  const f = V.clasificarLocalidad({ dominio: "expreso.ec", tipoEnUniverso: "medio_nacional" });

  assert.equal(f.localidad, V.LOCALIDAD.NO_LOCAL);

  /* Pero esta pieza suya habla explícitamente del cantón. */
  const r = territorioDe({
    domain: "expreso.ec",
    publisher: "Expreso",
    title: "El tranvía de Cuenca, Azuay, suma dos unidades",
    summary: "La EMOV EP confirmó la ampliación"
  });

  assert.equal(r.estadoGeo, "TERRITORIO_CORROBORADO");
  assert.equal(r.aptoParaMetricas, true);
  return true;
});

t("C-bis · la evidencia nacional NO se borra del corpus", () => {
  const comp = V.composicionDelCorpus(
    [
      { domain: "expreso.ec", providers: ["rss_directo"] },
      { domain: "elmercurio.com.ec", providers: ["rss_directo"] }
    ],
    new Map([
      ["expreso.ec", V.clasificarLocalidad({ dominio: "expreso.ec", tipoEnUniverso: "medio_nacional" })],
      [
        "elmercurio.com.ec",
        V.clasificarLocalidad({ dominio: "elmercurio.com.ec", tipoEnUniverso: "medio_local", territorioDeclarado: CUENCA })
      ]
    ])
  );

  assert.equal(comp.total, 2);
  assert.equal(comp.nacional, 1);
  assert.equal(comp.localCorroborada, 1);
  assert.match(comp.declaraciones.join(" "), /no se borra/i);
  return true;
});


/* =========================================================
   D · NADA SE PROMUEVE SIN EVIDENCIA
   ========================================================= */

console.log("\n--- D · promoción con evidencia ---\n");

t("D · que el nombre contenga «Cuenca» NO corrobora localidad", () => {
  const f = V.clasificarLocalidad({ dominio: "cuencarent.com" });

  assert.notEqual(f.localidad, V.LOCALIDAD.LOCAL_CORROBORADA);

  const otra = V.clasificarLocalidad({ dominio: "consultasec.com" });

  assert.notEqual(otra.localidad, V.LOCALIDAD.LOCAL_CORROBORADA);
  return true;
});

t("D-bis · un .ec con «cuenca» dentro se marca AMBIGUA y dice por qué", () => {
  const f = V.clasificarLocalidad({ dominio: "cuencanoticias.com.ec" });

  assert.equal(f.localidad, V.LOCALIDAD.AMBIGUA);
  assert.match(f.razones.join(" "), /NO es corroboración/i);
  assert.match(f.razones.join(" "), /ambiguo|sustantivo com[úu]n/i);
  return true;
});

t("D-ter · el homónimo español se detecta: Cuenca no es solo el cantón", () => {
  const es = V.clasificarLocalidad({ dominio: "ayuntamiento.cuenca.es" });

  assert.equal(es.localidad, V.LOCALIDAD.NO_LOCAL);
  assert.match(es.razones.join(" "), /Cuenca de España/i);

  /* Caso real del corpus descubierto. */
  const otra = V.clasificarLocalidad({ dominio: "educacionycultura.cuenca.es" });

  assert.equal(otra.localidad, V.LOCALIDAD.NO_LOCAL);
  return true;
});

t("D-quater · un dominio institucional del cantón sí corrobora", () => {
  const casos = [
    "cuenca.gob.ec",
    "tranvia.cuenca.gob.ec",
    "etapa.net.ec",
    "emov.gob.ec",
    "centrosur.gob.ec"
  ];

  return casos.every((d) => {
    const f = V.clasificarLocalidad({ dominio: d });
    return (
      f.localidad === V.LOCALIDAD.LOCAL_CORROBORADA &&
      f.familia === V.FAMILIAS_LOCALES.INSTITUCIONAL_PUBLICO
    );
  });
});

t("D-quinquies · la prioridad deriva de reglas explicables, no de un score", () => {
  const alta = V.prioridadDe(
    V.clasificarLocalidad({ dominio: "tranvia.cuenca.gob.ec" }),
    { yaEnElCorpus: false }
  );

  const media = V.prioridadDe(
    V.clasificarLocalidad({ dominio: "cuenca.gob.ec" }),
    { yaEnElCorpus: true }
  );

  const excluir = V.prioridadDe(V.clasificarLocalidad({ dominio: "x.com" }));

  assert.equal(alta.prioridad, V.PRIORIDAD.ALTA);
  assert.equal(media.prioridad, V.PRIORIDAD.MEDIA);
  assert.equal(excluir.prioridad, V.PRIORIDAD.EXCLUIR);

  /* Cada decisión trae sus reglas: no hay número opaco. */
  assert.ok(alta.reglas.length > 0 && media.reglas.length > 0);
  assert.ok(!Object.values(alta).some((v) => typeof v === "number"));
  return true;
});


/* =========================================================
   E-G · ACTIVOS, ENTIDADES Y EVIDENCIAS
   ========================================================= */

console.log("\n--- E-G · activos sociales ---\n");

t("E · una URL de compartir no es un actor", () => {
  const a = V.auditarActivo({
    plataforma: "facebook",
    handle: "sharer.php",
    estadoIdentidad: "ENLAZADO_DESDE_FUENTE_OFICIAL",
    descubiertoEn: "SITIO_OFICIAL"
  });

  assert.equal(a.estado, V.ESTADOS_ACTIVO.EXCLUIDO);
  assert.match(a.motivo, /no es una cuenta/i);

  /* Y el extractor tampoco lo produce. */
  assert.equal(
    A.extraerActivos('<a href="https://facebook.com/sharer.php?u=x">x</a>', { tipo: "SITIO_OFICIAL" }).length,
    0
  );
  return true;
});

t("F · un activo sin procedencia de descubrimiento no se acepta", () => {
  const sinProv = V.auditarActivo({ plataforma: "instagram", handle: "algo" });

  assert.equal(sinProv.estado, V.ESTADOS_ACTIVO.NO_RESUELTO);
  assert.match(sinProv.motivo, /sin procedencia/i);

  const conProv = V.auditarActivo({
    plataforma: "instagram",
    handle: "algo",
    estadoIdentidad: "ENLAZADO_DESDE_FUENTE_OFICIAL",
    descubiertoEn: "SITIO_OFICIAL"
  });

  assert.equal(conProv.estado, V.ESTADOS_ACTIVO.VALIDO);
  return true;
});

t("F-bis · tener el activo NO habilita descubrimiento abierto en FB/IG/TikTok", () => {
  const ig = V.auditarActivo({
    plataforma: "instagram", handle: "unsiontv",
    estadoIdentidad: "ENLAZADO_DESDE_FUENTE_OFICIAL", descubiertoEn: "SITIO_OFICIAL"
  });

  const equis = V.auditarActivo({
    plataforma: "x", handle: "UNSIONTV",
    estadoIdentidad: "ENLAZADO_DESDE_FUENTE_OFICIAL", descubiertoEn: "SITIO_OFICIAL"
  });

  assert.equal(ig.modoDeObservacion, "KNOWN_ACCOUNT_OBSERVATION");
  assert.match(ig.nota, /NO habilita descubrimiento abierto/i);
  assert.equal(equis.modoDeObservacion, "OPEN_DISCOVERY");
  return true;
});

t("G · ENTIDAD, ACTIVO y EVIDENCIA son tres cifras distintas", () => {
  /* Unsión TV: una entidad con cinco activos. */
  const cinco = ["x", "youtube", "facebook", "instagram", "tiktok"].map((p) => ({
    plataforma: p, handle: "unsiontv", entidad: "unsion.tv",
    estadoIdentidad: "ENLAZADO_DESDE_FUENTE_OFICIAL", descubiertoEn: "SITIO_OFICIAL"
  }));

  const r = V.auditarActivos(cinco);

  assert.equal(r.revisados, 5);
  assert.equal(r.validos, 5);

  /* Cinco activos NO son cinco fuentes locales. */
  assert.equal(r.entidadesDistintas, 1);
  assert.match(r.declaraciones.join(" "), /sigue siendo una entidad/i);
  return true;
});

t("G-bis · un subdominio no crea una entidad nueva en el universo", () => {
  /* Caso real: webnueva.etapa.net.ec y etapa.net.ec. */
  assert.equal(V.entidadDe("webnueva.etapa.net.ec"), "etapa.net.ec");
  assert.equal(V.entidadDe("etapa.net.ec"), "etapa.net.ec");
  assert.equal(V.entidadDe("tranvia.cuenca.gob.ec"), "cuenca.gob.ec");
  assert.equal(V.entidadDe("cuencaendatos.cuenca.gob.ec"), "cuenca.gob.ec");
  assert.equal(V.entidadDe("investigacion.ucuenca.edu.ec"), "ucuenca.edu.ec");

  /* Pero dos medios distintos siguen siendo dos entidades. */
  assert.notEqual(V.entidadDe("elmercurio.com.ec"), V.entidadDe("lavozdeltomebamba.com"));
  return true;
});


/* =========================================================
   H-I · NATURALEZA DEL CONTENIDO
   ========================================================= */

console.log("\n--- H-I · institucional no es ciudadanía ---\n");

t("H · contenido institucional NO se cuenta como conversación ciudadana", () => {
  const f = V.clasificarLocalidad({ dominio: "emac.gob.ec" });

  assert.equal(f.naturaleza, V.NATURALEZA.INSTITUTIONAL);
  assert.notEqual(f.naturaleza, V.NATURALEZA.PUBLIC_CONVERSATION);

  const comp = V.composicionDelCorpus(
    [
      { domain: "emac.gob.ec", providers: ["rss_directo"] },
      { domain: "x:1", providers: ["x_api"] }
    ],
    new Map([["emac.gob.ec", f]])
  );

  assert.equal(comp.porNaturaleza[V.NATURALEZA.INSTITUTIONAL], 1);
  assert.equal(comp.porNaturaleza[V.NATURALEZA.PUBLIC_CONVERSATION], 1);
  assert.match(comp.declaraciones.join(" "), /no es conversación ciudadana/i);
  return true;
});

t("H-bis · una pieza de X sin dominio web no borra la conversación del recuento", () => {
  /*
    Error propio corregido: con la ficha de dominio ganando
    siempre, el corpus reportaba 0 PUBLIC_CONVERSATION teniendo
    124 piezas de X, porque su ficha caía en AMBIGUA.
  */
  const fichaAmbigua = V.clasificarLocalidad({ dominio: "x:229468495" });

  assert.equal(fichaAmbigua.familia, null);

  const comp = V.composicionDelCorpus(
    [{ domain: "x:229468495", providers: ["x_api"] }],
    new Map([["x:229468495", fichaAmbigua]])
  );

  assert.equal(comp.porNaturaleza[V.NATURALEZA.PUBLIC_CONVERSATION], 1);
  return true;
});

t("I · SEARCH_RESULT no se presenta como SEARCH_INTEREST", () => {
  const e = S.normalizarResultadoDeBusqueda({ url: "https://a.ec/1" }, { collector: "brave_web" });

  assert.equal(e.tipoDeSenal, S.TIPOS_DE_SENAL.SEARCH_RESULT);
  assert.equal(S.DISPONIBILIDAD_SEARCH_INTEREST.estado, "NO_DISPONIBLE");

  assert.equal(
    V.naturalezaPorProveedor({ providers: ["brave_web"] }),
    V.NATURALEZA.SEARCH_RESULT
  );
  return true;
});

t("I-bis · YouTube no se clasifica a ciegas como conversación ni como medio", () => {
  /*
    Un canal de television es MEDIA y un vecino con el movil es
    conversacion. Sin saber de quien es el canal, se dice OTHER
    en lugar de elegir.
  */
  assert.equal(V.naturalezaPorProveedor({ providers: ["youtube_data"] }), V.NATURALEZA.OTHER);
  assert.equal(V.naturalezaPorProveedor({ providers: ["x_api"] }), V.NATURALEZA.PUBLIC_CONVERSATION);
  assert.equal(V.naturalezaPorProveedor({ providers: ["rss_directo"] }), V.NATURALEZA.MEDIA);
  return true;
});


/* =========================================================
   J-K · TEMPORALIDAD Y ESTRATOS
   ========================================================= */

console.log("\n--- J-K · fechas y estratos ---\n");

t("J · una pieza sin publishedAt sigue fuera de las ventanas", () => {
  const sinFecha = {
    evidenceId: "search:x", canonicalUrl: "https://a.ec/x",
    title: "El Municipio de Cuenca, Azuay", publishedAt: null
  };

  assert.equal(P.esTemporalmenteElegible(sinFecha), false);

  const m = Mx.construirMatriz({
    evidencias: [sinFecha],
    temas: [{ id: "t", nombre: "t", indices: [0] }],
    ubicaciones: [{ unidadId: CUENCA }],
    ventanaId: "90d", ahora: AHORA
  });

  assert.equal(m.filas.reduce((a, f) => a + f.evidencias, 0), 0);

  /* Y sigue siendo evidencia territorialmente corroborable. */
  assert.equal(territorioDe(sinFecha).estadoGeo, "TERRITORIO_CORROBORADO");
  return true;
});

t("K · CORROBORADO y PROBABLE siguen separados tras la expansión", () => {
  const e = M.estratificarCorpus([
    { estadoGeo: "TERRITORIO_CORROBORADO" },
    { estadoGeo: "TERRITORIO_PROBABLE" },
    { estadoGeo: "TERRITORIO_AMBIGUO" }
  ]);

  assert.equal(e.CORPUS_TERRITORIAL_CORROBORADO, 1);
  assert.equal(e.CORPUS_TERRITORIAL_PROBABLE, 1);
  assert.equal(e.CORPUS_TERRITORIAL_AMPLIADO, 2);
  assert.match(e.composicion, /1 corroboradas y 1 probables/);
  assert.equal(M.esEstadoDeMetricaTerritorial("TERRITORIO_AMBIGUO"), false);
  return true;
});


/* =========================================================
   L-O · PERSISTENCIA
   ========================================================= */

console.log("\n--- L-O · persistencia ---\n");

const NUEVAS = [
  {
    evidenceId: "rss:ucacue:1", canonicalUrl: "https://ucacue.edu.ec/n/1",
    title: "Investigación de la Universidad Católica de Cuenca, Azuay",
    summary: "resultado académico", domain: "ucacue.edu.ec", providerId: "rss_directo",
    publishedAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    evidenceId: "x:local:1", canonicalUrl: "https://x.com/a/status/1",
    title: "", summary: "La EMOV EP informa sobre movilidad en Cuenca, Azuay",
    domain: "x:1", providerId: "x_api",
    publishedAt: new Date(Date.now() - 3600000).toISOString()
  }
];

await ta("L · project isolation con las piezas nuevas", async () => {
  const l = L.crearLedgerMemoria();

  await P.persistirCorpus({
    ledger: l, evidencias: NUEVAS, estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  const obs = await l.leerTodos();

  assert.equal(L.reconstruirEstado(obs, { projectId: PROY }).size, 2);
  assert.equal(L.reconstruirEstado(obs, { projectId: "proyecto-b-fixture" }).size, 0);
  return true;
});

await ta("M · la persistencia sigue siendo idempotente", async () => {
  const l = L.crearLedgerMemoria();

  const p1 = await P.persistirCorpus({
    ledger: l, evidencias: NUEVAS, estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  assert.equal(p1.informe.INSERTED, 2);

  const estado = L.reconstruirEstado(await l.leerTodos(), { projectId: PROY });

  const p2 = await P.persistirCorpus({
    ledger: l, evidencias: NUEVAS, estadoPrevio: estado,
    retrievedAt: new Date().toISOString(), projectId: PROY, tenantId: "sentinel"
  });

  assert.equal(p2.informe.INSERTED, 0);
  assert.equal(p2.informe.DEDUPLICATED, 2);
  assert.equal(L.reconstruirEstado(await l.leerTodos(), { projectId: PROY }).size, 2);
  return true;
});

await ta("N · la persistencia sobrevive a recrear el adapter", async () => {
  const almacen = [];

  const hacer = () => ({
    anexar: async (r) => { almacen.push(JSON.parse(JSON.stringify(r))); },
    leerTodos: async () => almacen.map((r) => JSON.parse(JSON.stringify(r)))
  });

  await P.persistirCorpus({
    ledger: hacer(), evidencias: NUEVAS, estadoPrevio: new Map(),
    retrievedAt: AHORA, projectId: PROY, tenantId: "sentinel"
  });

  const estado = L.reconstruirEstado(await hacer().leerTodos(), { projectId: PROY });

  assert.equal(estado.size, 2);
  assert.equal(estado.get("rss:ucacue:1").domain, "ucacue.edu.ec");
  return true;
});

t("O · el universo de fuentes no duplica una entidad ya existente", () => {
  /*
    Cuatro dominios, dos entidades. Si `entidadDe` no colapsara
    los subdominios, el universo crecería con duplicados que
    parecen fuentes nuevas.
  */
  const dominios = [
    "etapa.net.ec",
    "webnueva.etapa.net.ec",
    "cuenca.gob.ec",
    "tranvia.cuenca.gob.ec"
  ];

  const entidades = new Set(dominios.map(V.entidadDe));

  assert.equal(dominios.length, 4);
  assert.equal(entidades.size, 2);
  return true;
});

t("O-bis · las candidatas a Media se entregan como lista, sin ingresarlas", () => {
  const fichas = [
    V.clasificarLocalidad({ dominio: "elmercurio.com.ec", tipoEnUniverso: "medio_local", territorioDeclarado: CUENCA }),
    V.clasificarLocalidad({ dominio: "emac.gob.ec" }),
    V.clasificarLocalidad({ dominio: "ucuenca.edu.ec" }),
    V.clasificarLocalidad({ dominio: "expreso.ec", tipoEnUniverso: "medio_nacional" })
  ];

  const m = V.candidatasParaMedia(fichas);

  /* Solo las corroboradas entran en la lista; la nacional no. */
  assert.equal(m.length, 3);
  assert.ok(!m.some((c) => c.dominio === "expreso.ec"));

  /* Y solo el medio es candidato a Media Source Universe. */
  assert.equal(m.filter((c) => c.candidataAMedia).length, 1);
  assert.equal(m.find((c) => c.candidataAMedia).dominio, "elmercurio.com.ec");

  /* Institución y academia se clasifican, no se meten en Media. */
  assert.equal(m.find((c) => c.dominio === "emac.gob.ec").clasificacion, "INSTITUTIONAL");
  assert.equal(m.find((c) => c.dominio === "ucuenca.edu.ec").clasificacion, "ACADEMIC");

  assert.ok(m.every((c) => c.requiereDecisionHumana === true));
  assert.ok(m.every((c) => c.estadoDeDescubrimiento === "DISCOVERED_BY_SENTINEL"));
  return true;
});


/* =========================================================
   P-R · REGRESIONES
   ========================================================= */

console.log("\n--- P-R · regresiones ---\n");

/*
  Con `t()` y un callback async esta prueba devolvia una promesa
  y pasaba sin comprobar nada: una prueba que no puede fallar no
  prueba nada. Va con `ta()`.
*/
await ta("P · Candidate: X sin consulta declarada mantiene provenance nula", async () => {
  const x = await import("../services/ingest/adapters/xAdapter.js");

  const ev = x.normalizarPost(
    { id: "1", text: "algo", author_id: "9", created_at: AHORA },
    { userId: "9", handle: "cuenta" }
  );

  assert.equal(ev.provenance.queryLabel, null);
  assert.equal(ev.provenance.query, null);
  return true;
});

t("Q · Media: la matriz sin compuerta se comporta como antes", () => {
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

t("R · la desambiguación geo sigue intacta", () => {
  const fuera = territorioDe({ domain: "x:1", summary: "Lambayeque, Perú: la cuenca Chancay" });
  const dentro = territorioDe({ domain: "x:2", summary: "El Municipio de Cuenca, Azuay, y el tranvía" });

  assert.equal(fuera.estadoGeo, "FUERA_TERRITORIO");
  assert.equal(dentro.estadoGeo, "TERRITORIO_CORROBORADO");
  return true;
});

t("R-bis · nada en este flujo afirma representatividad", () => {
  const texto =
    JSON.stringify(V.clasificarLocalidad({ dominio: "cuenca.gob.ec" })) +
    JSON.stringify(V.composicionDelCorpus([], new Map())) +
    JSON.stringify(V.auditarActivos([]));

  return !/representa Cuenca|opini[óo]n de Cuenca|todos los medios|todos los ciudadanos|los cuencanos/i.test(
    texto
  );
});

t("R-ter · no se infiere ningún atributo sensible de una fuente", () => {
  const texto = JSON.stringify(
    ["cuenca.gob.ec", "elmercurio.com.ec", "ucuenca.edu.ec"].map((d) =>
      V.clasificarLocalidad({ dominio: d })
    )
  );

  return !/ideolog|afiliaci|partido|religi|etni|orientaci[óo]n|psicol|intenci[óo]n de voto/i.test(texto);
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
