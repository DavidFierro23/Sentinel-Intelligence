// apps/backend/tests/territorial-project.test.mjs

import {
  crearLedgerMemoria,
  reconstruirEstado,
  registrarPasada
} from "../services/territorial/evidenceLedger.js";

import {
  ESTADOS_EMISOR,
  VIAS,
  indiceDeFeeds,
  resolverEmisor,
  resolverLoteDeEmisores
} from "../services/territorial/emitterResolver.js";

import {
  construirMatriz,
  compararVentanas,
  TERRITORIO_NO_RESUELTO
} from "../services/geo/topicTerritoryCrosstab.js";

import { ambitoDeRotacion } from "../services/territorial/rssRotation.js";

/*
===========================================================
AISLAMIENTO POR PROYECTO — TERRITORIAL-ACCELERATION-02
===========================================================

    node tests/territorial-project.test.mjs

SIN RED.

REGLA QUE ESTA SUITE DEFIENDE
-----------------------------------------------------------

El libro de evidencias es infraestructura COMPARTIDA. La lectura
es POR PROYECTO.

La cobertura de una campaña no puede incluir evidencia observada
para otra. Si eso se rompe, dos clientes distintos ven cifras
que no son suyas, y en un producto de inteligencia electoral eso
no es un bug de presentacion.

LA PRUEBA MAS IMPORTANTE ES LA DE MUTACION
-----------------------------------------------------------

Hay un caso que quita `projectId` de los registros y EXIGE que
el aislamiento se rompa. Sirve para demostrar que las otras
pruebas dependen de verdad del campo: una prueba de aislamiento
que pasa igual con y sin `projectId` no esta comprobando nada.
===========================================================
*/

let pass = 0;

let fail = 0;

const fallos = [];

function t(nombre, comprobacion) {
  try {
    if (comprobacion()) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}`);
    }
  } catch (e) {
    fail += 1;
    fallos.push(`${nombre} — ${e.message}`);
    console.log(`  ERR   ${nombre}: ${e.message}`);
  }
}

async function ta(nombre, comprobacion) {
  try {
    if (await comprobacion()) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}`);
    }
  } catch (e) {
    fail += 1;
    fallos.push(`${nombre} — ${e.message}`);
    console.log(`  ERR   ${nombre}: ${e.message}`);
  }
}


let llamadasDeRed = 0;

const fetchOriginal = globalThis.fetch;

globalThis.fetch = () => {
  llamadasDeRed += 1;

  return Promise.reject(new Error("RED PROHIBIDA EN LAS PRUEBAS"));
};


const T0 = "2026-08-31T12:00:00.000Z";

const T1 = "2026-08-31T18:00:00.000Z";

const PROY_A = "alcaldia-cuenca-2027";

const PROY_B = "prefectura-azuay-2027";


/* --- fixtures: dos proyectos, evidencia distinta --- */

function evidenciasDe(proyecto, n, prefijo) {
  const TITULARES = [
    "Nueva ordenanza de movilidad en el centro",
    "Obras de alcantarillado en la parroquia rural",
    "Presupuesto participativo abre convocatoria",
    "Plan de arborizacion cubre diez barrios"
  ];

  return Array.from({ length: n }, (_, i) => ({
    evidenceId: `${prefijo}-${i}`,
    title: `${TITULARES[i % TITULARES.length]} (${prefijo})`,
    canonicalUrl: `https://${prefijo}.test/nota-${i}`,
    publishedAt: "2026-08-30T10:00:00Z",
    sourceId: `${prefijo}.test`,
    publisher: `Medio ${prefijo}`,
    emitterId: `${prefijo}.test`,
    emitterStatus: ESTADOS_EMISOR.RESUELTO,
    snippet: "Resumen real de la nota.",
    feedUrl: `https://${prefijo}.test/feed/`,
    domain: `${prefijo}.test`,
    providerId: "rss_directo",
    proyecto
  }));
}

async function libroConDosProyectos() {
  const ledger = crearLedgerMemoria();

  await registrarPasada({
    ledger,
    evidencias: evidenciasDe(PROY_A, 4, "medioa"),
    estadoPrevio: new Map(),
    retrievedAt: T0,
    territoryId: "ec-azuay-cuenca",
    projectId: PROY_A
  });

  await registrarPasada({
    ledger,
    evidencias: evidenciasDe(PROY_B, 3, "mediob"),
    estadoPrevio: new Map(),
    retrievedAt: T0,
    territoryId: "ec-azuay",
    projectId: PROY_B
  });

  /* Legado: observaciones anteriores al gate, sin proyecto. */
  await registrarPasada({
    ledger,
    evidencias: evidenciasDe(null, 2, "legado"),
    estadoPrevio: new Map(),
    retrievedAt: T0,
    territoryId: "ec-azuay-cuenca"
  });

  return ledger;
}


/* =========================================================
   1. RSS -> LEDGER
   ========================================================= */

console.log("\n--- RSS al libro de evidencias ---\n");

await ta("una pasada RSS persiste con projectId y campos completos", async () => {
  const ledger = crearLedgerMemoria();

  await registrarPasada({
    ledger,
    evidencias: evidenciasDe(PROY_A, 2, "medioa"),
    estadoPrevio: new Map(),
    retrievedAt: T0,
    territoryId: "ec-azuay-cuenca",
    projectId: PROY_A,
    runId: "r1"
  });

  const linea = (await ledger.leerTodos())[0];

  return (
    linea.projectId === PROY_A &&
    linea.feedUrl === "https://medioa.test/feed/" &&
    linea.domain === "medioa.test" &&
    linea.publisher === "Medio medioa" &&
    linea.emitterStatus === ESTADOS_EMISOR.RESUELTO &&
    linea.summary === "Resumen real de la nota." &&
    linea.providerId === "rss_directo"
  );
});

await ta("`firstObservedAt` es inmutable y `observationCount` incrementa", async () => {
  const ledger = crearLedgerMemoria();

  const evs = evidenciasDe(PROY_A, 2, "medioa");

  const p1 = await registrarPasada({
    ledger,
    evidencias: evs,
    estadoPrevio: new Map(),
    retrievedAt: T0,
    projectId: PROY_A
  });

  await registrarPasada({
    ledger,
    evidencias: evs,
    estadoPrevio: new Map(p1.evidencias.map((e) => [e.evidenceId, e])),
    retrievedAt: T1,
    projectId: PROY_A
  });

  const estado = reconstruirEstado(await ledger.leerTodos(), { projectId: PROY_A });

  return [...estado.values()].every(
    (e) =>
      e.firstObservedAt === T0 && e.lastObservedAt === T1 && e.observationCount === 2
  );
});

await ta("reejecutar NO duplica la pieza logica", async () => {
  const ledger = crearLedgerMemoria();

  const evs = evidenciasDe(PROY_A, 3, "medioa");

  const p1 = await registrarPasada({
    ledger,
    evidencias: evs,
    estadoPrevio: new Map(),
    retrievedAt: T0,
    projectId: PROY_A
  });

  const p2 = await registrarPasada({
    ledger,
    evidencias: evs,
    estadoPrevio: new Map(p1.evidencias.map((e) => [e.evidenceId, e])),
    retrievedAt: T1,
    projectId: PROY_A
  });

  const estado = reconstruirEstado(await ledger.leerTodos(), { projectId: PROY_A });

  return (
    p1.metricas.nuevasParaSentinel === 3 &&
    p2.metricas.nuevasParaSentinel === 0 &&
    p2.metricas.yaConocidas === 3 &&
    estado.size === 3 &&
    (await ledger.leerTodos()).length === 6
  );
});

await ta("`publishedAt` es del medio y NO se sustituye por la observacion", async () => {
  const ledger = crearLedgerMemoria();

  await registrarPasada({
    ledger,
    evidencias: evidenciasDe(PROY_A, 1, "medioa"),
    estadoPrevio: new Map(),
    retrievedAt: T0,
    projectId: PROY_A
  });

  const e = [...reconstruirEstado(await ledger.leerTodos(), { projectId: PROY_A }).values()][0];

  return e.publishedAt === "2026-08-30T10:00:00Z" && e.firstObservedAt === T0;
});

await ta("un proveedor distinto que ve la misma pieza NO crea otra noticia", async () => {
  const ledger = crearLedgerMemoria();

  const rss = evidenciasDe(PROY_A, 1, "medioa");

  const p1 = await registrarPasada({
    ledger,
    evidencias: rss,
    estadoPrevio: new Map(),
    retrievedAt: T0,
    projectId: PROY_A
  });

  /* Misma pieza, otro proveedor: mismo evidenceId. */
  const otro = rss.map((e) => ({ ...e, providerId: "google_news", publisher: null }));

  const p2 = await registrarPasada({
    ledger,
    evidencias: otro,
    estadoPrevio: new Map(p1.evidencias.map((e) => [e.evidenceId, e])),
    retrievedAt: T1,
    projectId: PROY_A
  });

  const estado = reconstruirEstado(await ledger.leerTodos(), { projectId: PROY_A });

  const e = [...estado.values()][0];

  return (
    p2.metricas.nuevasParaSentinel === 0 &&
    estado.size === 1 &&
    e.providers.length === 2 &&
    /* El emisor que ya constaba NO se pierde. */
    e.publisher === "Medio medioa"
  );
});


/* =========================================================
   2. AISLAMIENTO ENTRE PROYECTOS
   ========================================================= */

console.log("\n--- Aislamiento entre proyectos ---\n");

const LIBRO = await libroConDosProyectos();

const LINEAS = await LIBRO.leerTodos();

await ta("A nunca recibe evidencia de B", async () => {
  const a = reconstruirEstado(LINEAS, { projectId: PROY_A });

  const ids = [...a.keys()];

  return (
    a.size === 4 &&
    ids.every((id) => id.startsWith("medioa-")) &&
    !ids.some((id) => id.startsWith("mediob-"))
  );
});

await ta("B nunca recibe evidencia de A", async () => {
  const b = reconstruirEstado(LINEAS, { projectId: PROY_B });

  const ids = [...b.keys()];

  return (
    b.size === 3 &&
    ids.every((id) => id.startsWith("mediob-")) &&
    !ids.some((id) => id.startsWith("medioa-"))
  );
});

t("el legado sin proyecto NO se cuenta dentro de un proyecto", () => {
  const a = reconstruirEstado(LINEAS, { projectId: PROY_A });

  return ![...a.keys()].some((id) => id.startsWith("legado-"));
});

t("el legado se puede ver a proposito, y solo a proposito", () => {
  const conLegado = reconstruirEstado(LINEAS, { projectId: PROY_A, incluirLegado: true });

  const sinLegado = reconstruirEstado(LINEAS, { projectId: PROY_A });

  return conLegado.size === 6 && sinLegado.size === 4;
});

t("sin filtro se lee el corpus completo, y eso NO es de ningun proyecto", () => {
  const todo = reconstruirEstado(LINEAS);

  return todo.size === 9;
});

t("un proyecto inexistente da CERO, no el corpus entero", () => {
  const fantasma = reconstruirEstado(LINEAS, { projectId: "proyecto-que-no-existe" });

  return fantasma.size === 0;
});

/*
  ---------------------------------------------------------
  MUTACION: si se quita `projectId`, el aislamiento DEBE romperse.

  Sin este caso, las pruebas de arriba podrian estar pasando por
  casualidad —por ejemplo si el filtro fuese por prefijo de id—
  y nadie se enteraria.
  ---------------------------------------------------------
*/
t("SI SE ELIMINA projectId, el aislamiento se rompe (la prueba es portante)", () => {
  const mutadas = LINEAS.map(({ projectId, ...resto }) => resto);

  const a = reconstruirEstado(mutadas, { projectId: PROY_A });

  const todo = reconstruirEstado(mutadas);

  /*
    Sin el campo, A no puede reclamar nada —queda en cero— y el
    corpus completo sigue ahi. Es decir: el aislamiento depende
    del campo y de nada mas.
  */
  return a.size === 0 && todo.size === 9;
});

t("el ambito de rotacion tambien separa por proyecto", () => {
  const a = ambitoDeRotacion({ projectId: PROY_A, territoryId: "ec-azuay-cuenca" });

  const b = ambitoDeRotacion({ projectId: PROY_B, territoryId: "ec-azuay-cuenca" });

  const soloTerritorio = ambitoDeRotacion({ territoryId: "ec-azuay-cuenca" });

  return (
    a.scopeId !== b.scopeId &&
    a.tipo === "PROYECTO" &&
    soloTerritorio.tipo === "TERRITORIO" &&
    a.scopeId !== soloTerritorio.scopeId
  );
});


/* =========================================================
   3. TOPIC x TERRITORY POR PROYECTO
   ========================================================= */

console.log("\n--- Tema x Territorio por proyecto ---\n");

function corpusDe(projectId) {
  const estado = reconstruirEstado(LINEAS, { projectId });

  return [...estado.values()].map((e) => ({
    titulo: e.title,
    descripcion: e.summary,
    url: e.canonicalUrl,
    dominio: e.sourceId,
    sourceId: e.sourceId,
    publisher: e.publisher,
    emitterStatus: e.emitterStatus,
    fecha: e.publishedAt,
    publishedAt: e.publishedAt,
    firstObservedAt: e.firstObservedAt,
    evidenceId: e.evidenceId,
    providerId: (e.providers || [])[0] || null
  }));
}

const CORPUS_A = corpusDe(PROY_A);

const CORPUS_B = corpusDe(PROY_B);

t("la matriz de A no contiene ni un evidenceId de B", () => {
  const m = construirMatriz({
    evidencias: CORPUS_A,
    temas: [{ id: "mov", nombre: "Movilidad", indices: CORPUS_A.map((_, i) => i) }],
    descubiertos: [],
    ubicaciones: CORPUS_A.map(() => ({
      unidadId: "ec-azuay-cuenca",
      unidad: "Cuenca",
      nivel: "canton"
    })),
    ventanaId: "7d",
    ahora: T1
  });

  const ids = m.filas.flatMap((f) => f.evidenceIds);

  return (
    ids.length === 4 &&
    ids.every((id) => id.startsWith("medioa-")) &&
    !ids.some((id) => id.startsWith("mediob-") || id.startsWith("legado-"))
  );
});

t("la matriz de B tampoco contiene nada de A", () => {
  const m = construirMatriz({
    evidencias: CORPUS_B,
    temas: [{ id: "mov", nombre: "Movilidad", indices: CORPUS_B.map((_, i) => i) }],
    descubiertos: [],
    ubicaciones: CORPUS_B.map(() => ({
      unidadId: "ec-azuay",
      unidad: "Azuay",
      nivel: "provincia"
    })),
    ventanaId: "7d",
    ahora: T1
  });

  const ids = m.filas.flatMap((f) => f.evidenceIds);

  return ids.length === 3 && ids.every((id) => id.startsWith("mediob-"));
});

t("los conteos de A y B son independientes", () => {
  const hacer = (corpus, unidad) =>
    construirMatriz({
      evidencias: corpus,
      temas: [{ id: "mov", nombre: "Movilidad", indices: corpus.map((_, i) => i) }],
      descubiertos: [],
      ubicaciones: corpus.map(() => ({ unidadId: unidad, unidad, nivel: "canton" })),
      ventanaId: "7d",
      ahora: T1
    });

  const a = hacer(CORPUS_A, "ec-azuay-cuenca");

  const b = hacer(CORPUS_B, "ec-azuay");

  return (
    a.metricas.evidenciasEnCorpus === 4 &&
    b.metricas.evidenciasEnCorpus === 3 &&
    a.filas[0].evidencias === 4 &&
    b.filas[0].evidencias === 3
  );
});

t("la comparacion temporal de A no ve las ventanas de B", () => {
  const c = compararVentanas({
    evidencias: CORPUS_A,
    temas: [{ id: "mov", nombre: "Movilidad", indices: CORPUS_A.map((_, i) => i) }],
    descubiertos: [],
    ventanaId: "7d",
    ahora: T1
  });

  return c.filas[0].ventanaActual.evidencias === 4;
});

t("las fuentes de un proyecto no incluyen las del otro", () => {
  const fuentesA = new Set(CORPUS_A.map((e) => e.dominio));

  const fuentesB = new Set(CORPUS_B.map((e) => e.dominio));

  return (
    fuentesA.size === 1 &&
    fuentesB.size === 1 &&
    ![...fuentesA].some((f) => fuentesB.has(f))
  );
});


/* =========================================================
   4. EMISORES
   ========================================================= */

console.log("\n--- Resolucion de emisor ---\n");

const FICHAS = [
  {
    sourceId: "elmercurio.com.ec",
    nombre: "El Mercurio",
    dominio: "elmercurio.com.ec",
    estadoVerificacion: "VERIFICADO_FEED",
    feeds: [{ url: "https://elmercurio.com.ec/feed/", conContenido: true }]
  },
  {
    sourceId: "sinfeed.ec",
    nombre: "Sin feed",
    dominio: "sinfeed.ec",
    estadoVerificacion: "NO_PUBLICA_RSS",
    feeds: []
  }
];

const INDICE = indiceDeFeeds(FICHAS);

t("solo el indice recoge feeds COMPROBADOS", () =>
  INDICE.porFeed.size === 1 && INDICE.porDominio.size === 1);

t("RESUELTO exige el feed comprobado del propio medio", () => {
  const r = resolverEmisor(
    { feedUrl: "https://elmercurio.com.ec/feed/", sourceId: "elmercurio.com.ec" },
    { indice: INDICE, instante: T0 }
  );

  return (
    r.emitterStatus === ESTADOS_EMISOR.RESUELTO &&
    r.publisher === "El Mercurio" &&
    r.emitterId === "elmercurio.com.ec" &&
    r.procedencia.via === VIAS.FEED_COMPROBADO
  );
});

t("un titulo de feed de dominio desconocido NO asciende a RESUELTO", () => {
  const r = resolverEmisor(
    { publisher: "Diario Cualquiera", sourceId: "desconocido.test" },
    { indice: INDICE, instante: T0 }
  );

  return (
    r.emitterStatus === ESTADOS_EMISOR.OBSERVADO_NO_VERIFICADO &&
    r.procedencia.via === VIAS.TITULO_DEL_FEED
  );
});

t("un agregador queda NO_RESUELTO y lo explica", () => {
  const r = resolverEmisor(
    { sourceId: "news.google.com", url: "https://news.google.com/rss/articles/xyz" },
    { indice: INDICE, instante: T0 }
  );

  return (
    r.emitterStatus === ESTADOS_EMISOR.NO_RESUELTO &&
    r.procedencia.via === VIAS.AGREGADOR &&
    r.publisher === null &&
    /oculta al publicador|publica enlaces/i.test(r.procedencia.nota)
  );
});

t("sin señal no se inventa emisor", () => {
  const r = resolverEmisor({}, { indice: INDICE, instante: T0 });

  return (
    r.emitterStatus === ESTADOS_EMISOR.NO_RESUELTO &&
    r.publisher === null &&
    r.emitterId === null
  );
});

t("los emisores sin resolver NO se suman a los emisores distintos", () => {
  const r = resolverLoteDeEmisores(
    [
      { feedUrl: "https://elmercurio.com.ec/feed/", sourceId: "elmercurio.com.ec" },
      { sourceId: "news.google.com" },
      { sourceId: "news.google.com" }
    ],
    { indice: INDICE, instante: T0 }
  );

  return (
    r.metricas.resueltos === 1 &&
    r.metricas.sinResolver === 2 &&
    r.metricas.emisoresDistintos === 1
  );
});


/* =========================================================
   5. RELACIONES PARA CORRELACION FUTURA
   ========================================================= */

console.log("\n--- Contrato de correlacion ---\n");

t("una evidencia persistida puede atarse por IDs sin duplicarla", () => {
  const e = [...reconstruirEstado(LINEAS, { projectId: PROY_A }).values()][0];

  /*
    PROJECT x MEDIA x TOPIC x TERRITORY x TIME x EVIDENCE: las
    claves existen o son null declarado. Nada se duplica para
    poder relacionarlo.
  */
  return (
    e.projectId === PROY_A &&
    typeof e.sourceId === "string" &&
    typeof e.evidenceId === "string" &&
    "publishedAt" in e &&
    "territoryId" in e &&
    "emitterId" in e
  );
});

t("no hay porcentajes de poblacion ni de electores en ninguna salida", () => {
  const m = construirMatriz({
    evidencias: CORPUS_A,
    temas: [{ id: "mov", nombre: "Movilidad", indices: CORPUS_A.map((_, i) => i) }],
    descubiertos: [],
    ubicaciones: CORPUS_A.map(() => ({ unidadId: "ec-azuay-cuenca", unidad: "Cuenca", nivel: "canton" })),
    ventanaId: "7d",
    ahora: T1
  });

  const json = JSON.stringify({ m, LINEAS });

  return [
    "porcentajePoblacion",
    "penetracion",
    "perCapita",
    "porcentajeElectores",
    "intencionVoto",
    "aprobacion",
    "probabilidadElectoral"
  ].every((p) => !json.includes(p));
});

t("CERO nunca significa desconocido: hay estados para eso", () => {
  const m = construirMatriz({
    evidencias: CORPUS_A,
    temas: [{ id: "mov", nombre: "Movilidad", indices: CORPUS_A.map((_, i) => i) }],
    descubiertos: [],

    /* Ninguna ubicacion: todo cae en no resuelto, visible. */
    ubicaciones: [],
    ventanaId: "7d",
    ahora: T1
  });

  return (
    m.filas.length === 1 &&
    m.filas[0].territorioId === TERRITORIO_NO_RESUELTO &&
    m.filas[0].evidencias === 4
  );
});


/* =========================================================
   6. SIN RED Y LA RUTA COMPILA
   ========================================================= */

console.log("\n--- Sin red y ruta ---\n");

t("cero llamadas al fetch global", () => llamadasDeRed === 0);

globalThis.fetch = fetchOriginal;

await ta("routes/territorio.js compila con observar y proveedores", async () => {
  const modulo = await import("../routes/territorio.js");

  return typeof modulo.default === "function";
});


/* --------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
