// apps/backend/tests/territorial-topics.test.mjs

/*
===========================================================
TERRITORIAL-TOPIC-NORMALIZATION-01

Pruebas A-Z. Cero red: el `fetch` global esta contado.

Los textos de los casos son evidencias REALES del corpus
persistido, recortadas. No son inventos: si el pipeline cambia
de comportamiento sobre lo que de verdad publica Cuenca, estas
pruebas lo notan.

Lo que mas vigila este fichero es la prueba I: que
`provenance.queryLabel` no entre nunca en el texto. Si entrara,
las consultas que se usaron para descubrir una pieza
fabricarian su tema, y el sistema encontraria exactamente lo
que fue a buscar.
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

const T = await import("../services/territorial/topicNormalization.js");
const S = await import("../services/territorial/topicStore.js");

const AHORA = "2026-09-05T12:00:00.000Z";
const hace = (d) => new Date(new Date(AHORA).getTime() - d * 86400000).toISOString();

const CONF = { metodo: T.METODOS.HIBRIDO, umbral: 0.18, ahora: AHORA };

/* Evidencias reales del corpus, recortadas. */
function ev(id, texto, extra = {}) {
  const [title, summary] = Array.isArray(texto) ? texto : ["", texto];

  return {
    evidenceId: id,
    projectId: "alcaldia-cuenca-2027-piloto",
    tenantId: "sentinel",
    title,
    summary,
    publishedAt: extra.publishedAt !== undefined ? extra.publishedAt : hace(2),
    firstObservedAt: hace(1),
    providers: extra.providers || ["rss_directo"],
    domain: extra.domain || "elmercurio.com.ec",
    sourceId: extra.sourceId || extra.domain || "elmercurio.com.ec",
    emitterId: extra.emitterId || null,
    canonicalUrl: extra.canonicalUrl || `https://ejemplo.ec/${id}`,
    ...extra.crudo
  };
}

function doc(evidencia, ctx = {}) {
  return T.construirDocumento(evidencia, {
    contentTerritoriality: ctx.terr || "TERRITORIO_CORROBORADO",
    sourceLocality: ctx.loc || "LOCAL_CORROBORADA",
    contentNature: ctx.nat || "MEDIA",
    sourceFamily: ctx.fam || "MEDIOS_LOCALES"
  });
}

/* Grupo real: intercambiador Monay-IESS, vocabulario distinto. */
const MONAY = [
  doc(ev("ev-m1", ["Plan de desvíos listo para la apertura del intercambiador Monay-IESS", "Autoridades definieron un plan de desvíos viales ante la apertura del paso elevado"]), { nat: "MEDIA" }),
  doc(ev("ev-m2", ["", "🚧 Inauguran el primer paso elevado del intercambiador Monay-IESS en Cuenca. El Ministerio inauguró la obra"], { providers: ["x_api"], domain: "x:1" }), { nat: "PUBLIC_CONVERSATION" }),
  doc(ev("ev-m3", ["", "🌉 CUENCA ESTRENA SU PRIMER PUENTE ELEVADO: la obra del paso elevado Monay supera los USD 40 millones"], { providers: ["x_api"], domain: "x:2" }), { nat: "PUBLIC_CONVERSATION" })
];

/* Otro asunto que comparte «agua» y «ETAPA» con el siguiente. */
const ETAPA_OBRA = [
  doc(ev("ev-o1", ["Avanza la construcción del nuevo sistema de agua potable para Santa Ana, El Valle y Quingeo", "ETAPA EP informa que la construcción del sistema de agua potable avanza"]), { nat: "INSTITUTIONAL" }),
  doc(ev("ev-o2", ["ETAPA EP FIRMA CONVENIOS PARA ALCANTARILLADO Y AGUA POTABLE EN CHECA, RICAURTE Y SIDCAY", "ETAPA EP suscribió convenios para alcantarillado y agua potable"]), { nat: "INSTITUTIONAL" })
];

const ETAPA_CAUDALES = [
  doc(ev("ev-c1", ["", "#Feliz Jueves | Red Hidrometeorológica ETAPA EP. Estado de ríos: los caudales de los ríos Tomebamba, Yanuncay, Tarqui y Machángara"], { providers: ["x_api"], domain: "x:3" }), { nat: "PUBLIC_CONVERSATION" }),
  doc(ev("ev-c2", ["", "#Feliz Miércoles | Red Hidrometeorológica ETAPA EP. Estado de ríos: los caudales de los ríos Tomebamba, Yanuncay, Tarqui y Machángara"], { providers: ["x_api"], domain: "x:4" }), { nat: "PUBLIC_CONVERSATION" })
];


/* =========================================================
   A-H · REGLAS DE CORPUS
   ========================================================= */

console.log("\n--- A-H · qué entra y qué no ---\n");

const MEZCLA = [
  doc(ev("ev-corr", "El Municipio de Cuenca, Azuay, aprobó la ordenanza"), { terr: "TERRITORIO_CORROBORADO" }),
  doc(ev("ev-prob", "Nota del medio local sin topónimo en la pieza"), { terr: "TERRITORIO_PROBABLE" }),
  doc(ev("ev-amb", "Algo ocurrió en Cuenca"), { terr: "TERRITORIO_AMBIGUO" }),
  doc(ev("ev-conf", "Cuenca, Azuay y también Lambayeque, Perú"), { terr: "TERRITORIO_CONFLICTIVO" }),
  doc(ev("ev-fuera", "La cuenca Chancay en Lambayeque"), { terr: "FUERA_TERRITORIO" }),
  doc(ev("ev-nores", "Texto sin ningún topónimo"), { terr: "TERRITORIO_NO_RESOLUBLE" }),
  doc(ev("ev-sinfecha", "El Municipio de Cuenca, Azuay, y el tranvía", { publishedAt: null }), { terr: "TERRITORIO_CORROBORADO" })
];

t("A · PRIMARY solo admite CORROBORADO ∩ temporalmente elegible", () => {
  const s = T.seleccionarCorpus(MEZCLA, T.UNIVERSOS.PRIMARY);

  assert.deepEqual(s.documentos.map((d) => d.evidenceId), ["ev-corr"]);
  assert.deepEqual(s.admitidos, ["TERRITORIO_CORROBORADO"]);
  return true;
});

t("B · PROBABLE queda fuera de PRIMARY y se declara", () => {
  const s = T.seleccionarCorpus(MEZCLA, T.UNIVERSOS.PRIMARY);

  assert.ok(!s.documentos.some((d) => d.evidenceId === "ev-prob"));
  assert.equal(s.excluidas.probableFueraDePrimary, 1);
  assert.match(s.declaraciones.join(" "), /nunca se mezcla en silencio/i);
  return true;
});

t("C · PROBABLE sí entra en EXPANDED, y los dos universos son cifras distintas", () => {
  const p = T.seleccionarCorpus(MEZCLA, T.UNIVERSOS.PRIMARY);
  const e = T.seleccionarCorpus(MEZCLA, T.UNIVERSOS.SECONDARY);

  assert.equal(p.documentos.length, 1);
  assert.equal(e.documentos.length, 2);
  assert.ok(e.documentos.some((d) => d.evidenceId === "ev-prob"));
  return true;
});

t("D · AMBIGUO excluido", () => {
  const s = T.seleccionarCorpus(MEZCLA, T.UNIVERSOS.SECONDARY);

  return !s.documentos.some((d) => d.evidenceId === "ev-amb") &&
    s.excluidas.porEstadoTerritorial.TERRITORIO_AMBIGUO === 1;
});

t("E · CONFLICTIVO excluido", () => {
  const s = T.seleccionarCorpus(MEZCLA, T.UNIVERSOS.SECONDARY);

  return !s.documentos.some((d) => d.evidenceId === "ev-conf") &&
    s.excluidas.porEstadoTerritorial.TERRITORIO_CONFLICTIVO === 1;
});

t("F · FUERA_TERRITORIO excluido", () => {
  const s = T.seleccionarCorpus(MEZCLA, T.UNIVERSOS.SECONDARY);

  return !s.documentos.some((d) => d.evidenceId === "ev-fuera") &&
    s.excluidas.porEstadoTerritorial.FUERA_TERRITORIO === 1;
});

t("G · NO_RESOLUBLE excluido", () => {
  const s = T.seleccionarCorpus(MEZCLA, T.UNIVERSOS.SECONDARY);

  return !s.documentos.some((d) => d.evidenceId === "ev-nores") &&
    s.excluidas.porEstadoTerritorial.TERRITORIO_NO_RESOLUBLE === 1;
});

t("H · una pieza sin publishedAt no entra en ninguna ventana", () => {
  const sinFecha = MEZCLA.find((d) => d.evidenceId === "ev-sinfecha");

  assert.equal(sinFecha.temporalmenteElegible, false);

  /* Ni siquiera aunque sea CORROBORADA: no entra en PRIMARY. */
  const s = T.seleccionarCorpus(MEZCLA, T.UNIVERSOS.PRIMARY);

  assert.ok(!s.documentos.some((d) => d.evidenceId === "ev-sinfecha"));
  assert.equal(s.excluidas.temporalmenteInelegibles, 1);

  /* Y las ventanas la ignoran. */
  const v = T.ventanasDe([sinFecha], AHORA);

  return Object.values(v).every((n) => n === 0);
});


/* =========================================================
   I-J · LO QUE NO ES CONTENIDO
   ========================================================= */

console.log("\n--- I-J · procedencia y duplicados ---\n");

t("I · queryLabel NO se trata como contenido temático", () => {
  const e = ev("ev-q", ["", "El tranvía de Cuenca suma dos unidades"], {
    crudo: {
      provenance: {
        providerId: "x_api",
        query: "concesiones mineras Azuay",
        queryLabel: "x:mineria:local",
        queryType: "QUERY_NEUTRAL"
      }
    }
  });

  const d = doc(e);

  /* Ni la etiqueta ni la consulta aparecen en el texto ni en los tokens. */
  assert.ok(!/mineria|x:mineria|QUERY_NEUTRAL|concesiones/i.test(d.textoOriginal));
  assert.ok(!d.tokens.includes("mineria"));
  assert.ok(!d.tokens.includes("concesiones"));
  assert.ok(!d.terminosDistintivos.some((x) => /mineria|concesiones/.test(x)));

  /* Y no puede unir la pieza con el tema minero real. */
  const minero = doc(ev("ev-min", ["", "Organizaciones anuncian marcha contra las concesiones mineras en Azuay"]));
  const s = T.similitud(d, minero, { metodo: T.METODOS.HIBRIDO });

  assert.equal(s.comunes.filter((c) => /mineria|concesiones/.test(c)).length, 0);
  return true;
});

t("J · la misma evidencia no se cuenta dos veces en un tema", () => {
  /* El mismo evidenceId repetido en la entrada. */
  const r = T.normalizarTemas([...MONAY, MONAY[0], MONAY[1]], { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  const todos = r.temas.flatMap((x) => x.evidenceIds);

  assert.equal(todos.length, new Set(todos).size, "hay evidenceIds repetidos dentro de los temas");
  return true;
});


/* =========================================================
   K-N · CALIDAD DE AGRUPACION
   ========================================================= */

console.log("\n--- K-N · agrupar bien y separar bien ---\n");

t("K · variantes del mismo asunto con vocabulario distinto se agrupan", () => {
  const r = T.normalizarTemas(MONAY, { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  assert.equal(r.temas.length, 1, `esperaba 1 tema, salieron ${r.temas.length}`);

  const tema = r.temas[0];

  /* «paso elevado», «puente elevado» e «intercambiador Monay» son el mismo hecho. */
  assert.equal(tema.evidenceCount, 3);
  assert.equal(tema.providerDiversity, 2);
  return true;
});

t("L · asuntos distintos que comparten palabra clave NO se fusionan", () => {
  /* Los cuatro comparten «etapa» y «agua»/«rios». */
  const r = T.normalizarTemas([...ETAPA_OBRA, ...ETAPA_CAUDALES], { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  assert.ok(r.temas.length >= 2, `obra de agua y caudales de ríos se fusionaron en ${r.temas.length} tema(s)`);

  const deObra = r.temas.find((x) => x.evidenceIds.includes("ev-o1"));
  const deCaudales = r.temas.find((x) => x.evidenceIds.includes("ev-c1"));

  assert.notEqual(deObra.topicId, deCaudales.topicId);
  return true;
});

t("M · «Cuenca» sola no puede crear un mega-cluster", () => {
  /* Seis asuntos sin relación cuyo único término común es «Cuenca». */
  const dispares = [
    doc(ev("ev-x1", ["Deportivo Cuenca empató en el estadio", "resultado deportivo"])),
    doc(ev("ev-x2", ["Cortes de agua potable en seis sectores de Cuenca", "ETAPA informó"])),
    doc(ev("ev-x3", ["Festival del Cuy en la parroquia Nulti, Cuenca", "fiestas parroquiales"])),
    doc(ev("ev-x4", ["Concurso fotográfico de la Casa de la Cultura en Cuenca", "cultura"])),
    doc(ev("ev-x5", ["Volcamiento de un vehículo en la vía a Molleturo, Cuenca", "dos heridos"])),
    doc(ev("ev-x6", ["Rendición de cuentas de la EMOV en Cuenca", "movilidad"]))
  ];

  const r = T.normalizarTemas(dispares, { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  /* Ninguno debe acabar junto: no hay tema que los agrupe. */
  const mayor = r.resumen.largestCluster;

  assert.ok(mayor <= 2, `«Cuenca» produjo un grupo de ${mayor}`);

  /* Y «cuenca» está declarado como genérico. */
  assert.ok(T.TERMINOS_GENERICOS.has("cuenca"));
  assert.ok(T.TERMINOS_GENERICOS.has("ecuador"));

  /* La puerta dura: sin término distintivo compartido, cero. */
  const s = T.similitud(dispares[0], dispares[3], { metodo: T.METODOS.HIBRIDO });

  assert.equal(s.valor, 0);
  assert.match(s.razones.join(" "), /sin ningún término distintivo compartido/i);
  return true;
});

t("M-bis · existe un tope de tamaño de grupo y se declara", () => {
  const muchos = Array.from({ length: 20 }, (_, i) =>
    doc(ev(`ev-rep-${String(i).padStart(2, "0")}`, ["", "Inauguran el paso elevado del intercambiador Monay-IESS en Cuenca"]))
  );

  const r = T.normalizarTemas(muchos, { universo: T.UNIVERSOS.PRIMARY, ...CONF, topeDeGrupo: 0.3 });

  assert.ok(r.resumen.topeDeGrupo > 0);
  assert.ok(r.resumen.largestCluster <= r.resumen.topeDeGrupo);
  assert.ok(r.resumen.vecesQueSeAlcanzoElTope > 0, "el tope no llegó a actuar");
  return true;
});

t("N · topicId es estable y NO depende del ranking", () => {
  const r1 = T.normalizarTemas(MONAY, { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  /* Misma entrada en otro orden. */
  const r2 = T.normalizarTemas([...MONAY].reverse(), { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  assert.deepEqual(r1.temas.map((x) => x.topicId), r2.temas.map((x) => x.topicId));

  /* Y añadir otro tema distinto no cambia el id del primero. */
  const r3 = T.normalizarTemas([...MONAY, ...ETAPA_CAUDALES], { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  const monayEn3 = r3.temas.find((x) => x.evidenceIds.includes("ev-m1"));

  assert.equal(monayEn3.topicId, r1.temas[0].topicId);

  /* El id sale de los términos canónicos, no de la posición. */
  assert.match(r1.temas[0].topicId, /^t:[0-9a-f]{12}$/);
  return true;
});


/* =========================================================
   O-P · CONFIANZA
   ========================================================= */

console.log("\n--- O-P · confianza y sin clasificar ---\n");

t("O · toda asignación lleva confianza y razones", () => {
  const r = T.normalizarTemas([...MONAY, ...ETAPA_OBRA], { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  assert.ok(r.assignments.length > 0);
  assert.ok(r.assignments.every((a) => ["HIGH", "MEDIUM", "LOW"].includes(a.confidence)));
  assert.ok(r.assignments.every((a) => Array.isArray(a.reasons) && a.reasons.length > 0));
  assert.ok(r.assignments.every((a) => a.methodVersion === T.VERSION_METODO));
  return true;
});

t("P · una pieza sola puede quedar UNCLASSIFIED en lugar de forzarse", () => {
  const sola = doc(ev("ev-sola", ["Un asunto que no se parece a nada más del corpus", "texto único e irrepetible"]));

  const r = T.normalizarTemas([...MONAY, sola], { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  const a = r.assignments.find((x) => x.evidenceId === "ev-sola");

  assert.equal(a.estado, "UNCLASSIFIED");
  assert.equal(a.topicId, null);
  assert.ok(r.resumen.unclassifiedCount >= 1);

  /* Y no se persigue una tasa artificial del 100 %. */
  assert.ok(r.resumen.classificationRate < 1);
  return true;
});


/* =========================================================
   Q-U · METRICAS POR TEMA
   ========================================================= */

console.log("\n--- Q-U · métricas ---\n");

const TEMA = T.construirTema(
  [
    doc(ev("ev-t1", ["Intercambiador Monay-IESS", "paso elevado"], { domain: "elmercurio.com.ec", providers: ["rss_directo"] }), { nat: "MEDIA" }),
    doc(ev("ev-t2", ["", "Inauguran el paso elevado Monay-IESS"], { domain: "x:1", providers: ["x_api"] }), { nat: "PUBLIC_CONVERSATION" }),
    doc(ev("ev-t3", ["", "El paso elevado Monay ya está habilitado"], { domain: "x:2", providers: ["x_api"] }), { nat: "PUBLIC_CONVERSATION" }),
    doc(ev("ev-t4", ["Monay-IESS: plan de desvíos", "movilidad"], { domain: "elmercurio.com.ec", providers: ["rss_directo"] }), { nat: "MEDIA" })
  ],
  { ahora: AHORA }
);

t("Q · uniqueSources cuenta fuentes distintas, no piezas", () => {
  /* 4 piezas, 3 dominios. */
  assert.equal(TEMA.evidenceCount, 4);
  assert.equal(TEMA.uniqueSources, 3);
  assert.equal(TEMA.sourceDiversity, 0.75);
  return true;
});

t("R · uniqueActors se llama actores, NUNCA personas", () => {
  assert.equal(typeof TEMA.uniqueActors, "number");

  const texto = JSON.stringify(TEMA);

  /* La palabra «personas» no puede aparecer describiendo actores. */
  assert.ok(!/uniquePeople|personas[”"']?\s*:/i.test(texto));
  assert.ok("uniqueActors" in TEMA);
  return true;
});

t("S · rssShare es correcto y se marca la dominancia", () => {
  /* 2 de 4 son RSS. */
  assert.equal(TEMA.rssEvidenceCount, 2);
  assert.equal(TEMA.rssShare, 0.5);

  /* Un tema 100 % RSS lo declara en sus limitaciones. */
  const soloRss = T.construirTema(
    [doc(ev("ev-r1", ["a", "b"])), doc(ev("ev-r2", ["c", "d"]))],
    { ahora: AHORA }
  );

  assert.equal(soloRss.rssShare, 1);
  assert.ok(soloRss.limitations.some((l) => /Dominado por RSS/i.test(l)));
  return true;
});

t("T · el desglose por naturaleza del contenido es correcto", () => {
  assert.deepEqual(TEMA.contentNatureBreakdown, { MEDIA: 2, PUBLIC_CONVERSATION: 2 });

  /* Y el estrato territorial también se desglosa. */
  assert.deepEqual(TEMA.territorialStratumBreakdown, { TERRITORIO_CORROBORADO: 4 });
  return true;
});

t("U · las ventanas cuentan solo con publishedAt", () => {
  const dentro = doc(ev("ev-w1", ["hoy", "x"], { publishedAt: hace(0.2) }));
  const semana = doc(ev("ev-w2", ["hace 5 dias", "x"], { publishedAt: hace(5) }));
  const viejo = doc(ev("ev-w3", ["hace 200 dias", "x"], { publishedAt: hace(200) }));
  const sinFecha = doc(ev("ev-w4", ["sin fecha", "x"], { publishedAt: null }));

  const v = T.ventanasDe([dentro, semana, viejo, sinFecha], AHORA);

  assert.equal(v.HOY, 1);
  assert.equal(v["7D"], 2);
  assert.equal(v["30D"], 2);
  assert.equal(v["90D"], 2);

  /* La de 200 días no entra en 90D y la sin fecha en ninguna. */
  return true;
});

t("U-bis · un tema no afirma tendencia ni opinión pública", () => {
  const texto = JSON.stringify(TEMA.limitations);

  assert.match(texto, /NO es una tendencia/i);
  assert.match(texto, /No representan a toda la población de Cuenca/i);
  assert.ok(!/trendScore|viralityScore|importanceScore|sentiment/i.test(JSON.stringify(TEMA)));
  return true;
});


/* =========================================================
   V-W · TRAZABILIDAD Y AISLAMIENTO
   ========================================================= */

console.log("\n--- V-W · trazabilidad y aislamiento ---\n");

await ta("V · desde un tema se llega a la evidencia original sin duplicarla", async () => {
  const almacen = S.crearAlmacenMemoria();

  const r = T.normalizarTemas(MONAY, { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  await S.persistirTemas({
    almacen, resultado: r, projectId: "alcaldia-cuenca-2027-piloto",
    tenantId: "sentinel", territoryId: "ec-azuay-cuenca", runId: "run-1",
    registradoEn: "2026-09-05T12:00:00.000Z"
  });

  const registros = await almacen.leerTodos();

  /* El cuerpo de la evidencia NO se copia al almacén de temas. */
  assert.ok(!registros.some((x) => /CUENCA ESTRENA SU PRIMER PUENTE/i.test(JSON.stringify(x))));

  const estado = S.reconstruirTemas(registros, { projectId: "alcaldia-cuenca-2027-piloto" });

  const traza = S.trazaDe("ev-m3", estado);

  assert.equal(traza.encontrada, true);
  assert.ok(traza.topicId);
  assert.ok(traza.topicLabel);
  assert.equal(traza.projectId, "alcaldia-cuenca-2027-piloto");
  assert.match(traza.resolverEvidenciaEn, /evidenceLedger/);
  return true;
});

await ta("V-bis · append-only: la segunda pasada no borra la primera", async () => {
  const almacen = S.crearAlmacenMemoria();

  const r = T.normalizarTemas(MONAY, { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  await S.persistirTemas({ almacen, resultado: r, projectId: "p", tenantId: "t", runId: "r1", registradoEn: "2026-09-01T00:00:00.000Z" });
  await S.persistirTemas({ almacen, resultado: r, projectId: "p", tenantId: "t", runId: "r2", registradoEn: "2026-09-05T00:00:00.000Z" });

  const registros = await almacen.leerTodos();

  const estado = S.reconstruirTemas(registros, { projectId: "p" });

  /* Vigente es la última, y el histórico conserva las dos. */
  assert.equal(estado.registradoEn, "2026-09-05T00:00:00.000Z");
  assert.equal(estado.pasadasEnElHistorico, 2);
  return true;
});

await ta("W · project isolation: los temas de A no aparecen en B", async () => {
  const almacen = S.crearAlmacenMemoria();

  const rA = T.normalizarTemas(MONAY, { universo: T.UNIVERSOS.PRIMARY, ...CONF });
  const rB = T.normalizarTemas(ETAPA_CAUDALES, { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  await S.persistirTemas({ almacen, resultado: rA, projectId: "proyecto-a", tenantId: "t", runId: "a", registradoEn: "2026-09-05T00:00:00.000Z" });
  await S.persistirTemas({ almacen, resultado: rB, projectId: "proyecto-b-fixture", tenantId: "t", runId: "b", registradoEn: "2026-09-05T00:00:00.000Z" });

  const registros = await almacen.leerTodos();

  const a = S.reconstruirTemas(registros, { projectId: "proyecto-a" });
  const b = S.reconstruirTemas(registros, { projectId: "proyecto-b-fixture" });
  const vacio = S.reconstruirTemas(registros, { projectId: "no-existe" });

  assert.ok(a.temas.size > 0);
  assert.ok(b.temas.size > 0);
  assert.equal(vacio.temas.size, 0);

  /* Ninguna evidencia de A asignada dentro de B. */
  assert.ok(!b.asignaciones.has("ev-m1"));
  assert.ok(!a.asignaciones.has("ev-c1"));
  return true;
});

await ta("W-bis · MUTACIÓN: sin filtro de proyecto el aislamiento desaparece", async () => {
  const almacen = S.crearAlmacenMemoria();

  const rA = T.normalizarTemas(MONAY, { universo: T.UNIVERSOS.PRIMARY, ...CONF });
  const rB = T.normalizarTemas(ETAPA_CAUDALES, { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  await S.persistirTemas({ almacen, resultado: rA, projectId: "proyecto-a", tenantId: "t", runId: "a", registradoEn: "2026-09-05T00:00:00.000Z" });
  await S.persistirTemas({ almacen, resultado: rB, projectId: "proyecto-b-fixture", tenantId: "t", runId: "b", registradoEn: "2026-09-05T00:00:00.000Z" });

  const registros = await almacen.leerTodos();

  /* Sin projectId se ven los dos: la prueba demuestra que el filtro es lo que aísla. */
  const sinFiltro = S.reconstruirTemas(registros, {});

  assert.ok(sinFiltro.asignaciones.has("ev-m1"));
  assert.ok(sinFiltro.asignaciones.has("ev-c1"));

  /* Y persistir sin projectId no se permite. */
  await assert.rejects(
    () => S.persistirTemas({ almacen, resultado: rA, tenantId: "t" }),
    /projectId/
  );
  return true;
});


/* =========================================================
   X-Z · RED, SECRETOS Y DETERMINISMO
   ========================================================= */

console.log("\n--- X-Z · red, secretos, determinismo ---\n");

t("X · normalizar temas no hace ninguna petición externa", () => {
  const antes = red;

  T.normalizarTemas([...MONAY, ...ETAPA_OBRA, ...ETAPA_CAUDALES], { universo: T.UNIVERSOS.PRIMARY, ...CONF });
  T.normalizarTexto("cualquier texto con https://ejemplo.ec y @cuenta y #hashtag");

  assert.equal(red, antes);
  return true;
});

t("Y · ninguna salida contiene credenciales ni secretos", () => {
  const r = T.normalizarTemas(MONAY, { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  const texto = JSON.stringify(r);

  assert.ok(!/BEARER|API_KEY|apiKey|token|Authorization|SCRAPECREATORS|SERPAPI/i.test(texto));
  return true;
});

t("Z · la evaluación es determinista: misma entrada, mismo resultado", () => {
  const entrada = [...MONAY, ...ETAPA_OBRA, ...ETAPA_CAUDALES];

  const a = T.normalizarTemas(entrada, { universo: T.UNIVERSOS.PRIMARY, ...CONF });
  const b = T.normalizarTemas([...entrada].reverse(), { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  /* Mismos temas, mismos ids, mismos recuentos. */
  assert.deepEqual(
    a.temas.map((x) => [x.topicId, x.evidenceCount]),
    b.temas.map((x) => [x.topicId, x.evidenceCount])
  );

  assert.deepEqual(a.resumen, b.resumen);

  /* Y las mismas asignaciones, ordenadas por evidenceId. */
  const clave = (r) => r.assignments.map((x) => `${x.evidenceId}:${x.topicId}:${x.estado}`).sort().join("|");

  assert.equal(clave(a), clave(b));
  return true;
});

t("Z-bis · el método está versionado en cada salida", () => {
  const r = T.normalizarTemas(MONAY, { universo: T.UNIVERSOS.PRIMARY, ...CONF });

  assert.equal(r.methodVersion, T.VERSION_METODO);
  assert.ok(r.temas.every((x) => x.methodVersion === T.VERSION_METODO));
  assert.ok(r.assignments.every((x) => x.methodVersion === T.VERSION_METODO));
  return true;
});

t("Z-ter · el boilerplate de los feeds no entra como vocabulario del tema", () => {
  const d = T.normalizarTexto(
    "Avanza la construcción del sistema de agua potable . ETAPA EP informa. La entrada Avanza la construcción appeared first on ETAPA EP."
  );

  assert.ok(!d.tokens.includes("appeared"));
  assert.ok(!d.tokens.includes("first"));
  assert.ok(d.tokens.includes("agua"));
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
