// apps/backend/tests/territorial-expansion.test.mjs

import {
  clasificarSenal,
  toponimosDe,
  TIPOS_SENAL,
  construirMatriz
} from "../services/geo/topicTerritoryCrosstab.js";

import {
  candidatosPara as candidatosDelUniverso,
  ESTADOS_FUENTE as ESTADOS,
  METODOS_DESCUBRIMIENTO as METODOS,
  ORIGEN_CLASIFICACION as ORIGENES,
  feedsParaRecoleccion as resolverFeeds
} from "../services/territorial/verifiedSourceUniverse.js";

import {
  ALCANCES,
  indiceDeAmbito,
  clasificarAlcance
} from "../services/territorial/territorialScope.js";

import {
  seleccionarCohorte,
  reconstruirRotacion,
  registrarRotacion,
  siguienteCicloYPasada,
  crearAlmacenMemoria,
  ESTADOS_INTENTO
} from "../services/territorial/rssRotation.js";

import { construirUniversoDeActores, CERTEZAS } from "../services/territorial/actorUniverse.js";

/*
===========================================================
PRUEBAS DE TERRITORIAL-LOCAL-SOURCE-EXPANSION-01
===========================================================

    node tests/territorial-expansion.test.mjs

SIN RED.

Lo que defiende esta suite: **ampliar el universo no puede
aflojar ninguna regla**. Ni la de que una fuente local no
demuestra el territorio de su pieza, ni la de que aparecer no es
estar verificado, ni la de que el ciclo de rotacion no deja a
nadie sin servir.
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

const CUENCA = "ec-azuay-cuenca";

const T0 = "2026-09-01T12:00:00.000Z";


/* =========================================================
   1. LOS CANDIDATOS NUEVOS Y SU PROCEDENCIA
   ========================================================= */

console.log("\n--- Candidatos y procedencia ---\n");

const CANDIDATOS = candidatosDelUniverso(CUENCA);

t("el universo de candidatos crecio respecto al gate anterior", () => CANDIDATOS.length >= 33);

t("La Voz del Tomebamba ya NO es un dominio propuesto: es medio local declarado", () => {
  const v = CANDIDATOS.find((c) => c.dominio === "lavozdeltomebamba.com");

  return (
    v &&
    v.tipo === "medio_local" &&
    v.territorioDeclarado === CUENCA &&
    v.metodoDescubrimiento === METODOS.DECLARADO_POR_ANALISTA &&
    v.origenClasificacion === ORIGENES.ANALISTA
  );
});

t("cada candidato NUEVO declara de dónde salió", () =>
  CANDIDATOS.every((c) => Object.values(METODOS).includes(c.metodoDescubrimiento)));

t("un dominio propuesto sigue sin tipo: no se autoverifica por el nombre", () => {
  const propuestos = CANDIDATOS.filter(
    (c) => c.metodoDescubrimiento === METODOS.DOMINIO_PROPUESTO
  );

  return (
    propuestos.length >= 4 &&
    propuestos.every((c) => c.tipo === null && c.origenClasificacion === ORIGENES.SIN_CLASIFICAR)
  );
});

t("un candidato observado en el agregador NO se declara local por aparecer", () => {
  const e = CANDIDATOS.find((c) => c.dominio === "ecuador221.com");

  return (
    e &&
    e.territorioDeclarado === null &&
    /aparecer en una consulta territorial no clasifica/i.test(e.nota || "")
  );
});

t("un candidato de ámbito dudoso NO recibe cobertura cantonal inventada", () => {
  const b = CANDIDATOS.find((c) => c.dominio === "bomberos.gob.ec");

  return b && b.territorioDeclarado === null && /nacional/i.test(b.nota || "");
});

t("ningún candidato llega afirmando tener feed", () =>
  CANDIDATOS.every((c) => c.feeds === undefined && c.feedUrl === undefined));


/* =========================================================
   2. FUENTE LOCAL ≠ TERRITORIO DE LA PIEZA
   ========================================================= */

console.log("\n--- La regla que no se afloja ---\n");

const FICHAS = [
  {
    sourceId: "lavozdeltomebamba.com",
    dominio: "lavozdeltomebamba.com",
    nombre: "La Voz del Tomebamba",
    tipo: "medio_local",
    territorioDeclarado: CUENCA,
    estadoVerificacion: "VERIFICADO_FEED",
    feeds: [{ url: "https://www.lavozdeltomebamba.com/feed/", conContenido: true }]
  },
  {
    sourceId: "farmasol.gob.ec",
    dominio: "farmasol.gob.ec",
    nombre: "Farmasol EP",
    tipo: "institucion",
    territorioDeclarado: CUENCA,
    estadoVerificacion: "VERIFICADO_FEED",
    feeds: [{ url: "https://farmasol.gob.ec/feed/", conContenido: true }]
  },
  {
    sourceId: "expreso.ec",
    dominio: "expreso.ec",
    nombre: "Expreso",
    tipo: "medio_nacional",
    territorioDeclarado: null,
    estadoVerificacion: "VERIFICADO_FEED",
    feeds: [{ url: "https://expreso.ec/rss", conContenido: true }]
  },
  {
    sourceId: "deportivocuenca.com",
    dominio: "deportivocuenca.com",
    nombre: "Deportivo Cuenca",
    tipo: null,
    territorioDeclarado: CUENCA,
    estadoVerificacion: "NO_PUBLICA_RSS",
    feeds: []
  }
];

const INDICE = indiceDeAmbito(FICHAS);

t("una pieza de una fuente local NUEVA sin topónimo sigue sin ser de Cuenca", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "lavozdeltomebamba.com" },
    ubicacion: null,
    indice: INDICE
  });

  return (
    c.alcance === ALCANCES.FUENTE_LOCAL_SIN_TERRITORIO &&
    c.territorioAtribuible === false &&
    c.unidadId === null
  );
});

t("añadir fuentes locales NO convierte piezas nacionales en locales", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "expreso.ec" },
    ubicacion: null,
    indice: INDICE
  });

  return c.alcance === ALCANCES.NACIONAL_RELACIONADO && c.territorioAtribuible === false;
});

t("con topónimo sí se atribuye, viniera de donde viniera", () =>
  clasificarAlcance({
    evidencia: { domain: "farmasol.gob.ec" },
    ubicacion: { unidadId: CUENCA, nivel: "canton" },
    indice: INDICE
  }).territorioAtribuible === true);


/* =========================================================
   3. FEEDS: SIN FEED, DEDUP Y ARTEFACTOS
   ========================================================= */

console.log("\n--- Feeds, SIN_FEED y artefactos ---\n");

t("una fuente comprobada SIN feed no entra en la recolección", () => {
  const feeds = resolverFeeds(
    FICHAS.map((f) => ({ ...f, prioridad: 1, territorioDeclarado: f.territorioDeclarado }))
  );

  return !feeds.some((x) => x.sourceId === "deportivocuenca.com");
});

t("SIN_FEED se conserva como hecho sobre el sitio, no como fallo nuestro", () => {
  const d = FICHAS.find((f) => f.dominio === "deportivocuenca.com");

  return d.estadoVerificacion === ESTADOS.NO_PUBLICA_RSS && d.feeds.length === 0;
});

t("dos fichas con el MISMO feed no producen dos entradas", () => {
  const dup = [
    { ...FICHAS[0], sourceId: "a.test", prioridad: 1 },
    { ...FICHAS[0], sourceId: "b.test", prioridad: 1 }
  ].map((f) => ({ ...f, estadoVerificacion: "VERIFICADO_FEED" }));

  return resolverFeeds(dup).length === 1;
});

t("un agregador NO es un medio: news.google.com no es candidato local", () =>
  !CANDIDATOS.some((c) => /news\.google|google\.com|serpapi|duckduckgo/i.test(c.dominio)));

t("los feeds locales se sirven antes que los nacionales", () => {
  const feeds = resolverFeeds(
    FICHAS.filter((f) => f.estadoVerificacion === "VERIFICADO_FEED").map((f) => ({
      ...f,
      prioridad: f.tipo === "medio_nacional" ? 2 : 1
    }))
  );

  return feeds[0].territorioDeclarado === CUENCA;
});


/* =========================================================
   4. ROTACIÓN CON EL UNIVERSO AMPLIADO
   ========================================================= */

console.log("\n--- Rotación sin starvation ---\n");

function universo(n, locales) {
  return Array.from({ length: n }, (_, i) => ({
    url: `https://f${i}.test/feed/`,
    sourceId: `f${i}.test`,
    publisher: `F${i}`,
    prioridad: i < locales ? 1 : 2,
    territorioDeclarado: i < locales ? CUENCA : null
  }));
}

await ta("al ampliar el universo, las fuentes NUEVAS se sirven primero", async () => {
  const almacen = crearAlmacenMemoria();

  const base = universo(8, 4);

  /* Primera pasada con 8 feeds: se sirven todos. */
  const c1 = seleccionarCohorte({ elegibles: base, presupuesto: 8, ciclo: 1, pasada: 1 });

  await registrarRotacion({
    almacen,
    scopeId: "s",
    cohorte: c1,
    resultados: c1.seleccionados.map((f) => ({
      feedUrl: f.feedUrl,
      estado: ESTADOS_INTENTO.OK,
      recibidas: 5
    })),
    instante: T0
  });

  /* Aparecen 3 fuentes nuevas. */
  const ampliado = [...base, ...universo(11, 4).slice(8)];

  const previo = reconstruirRotacion(await almacen.leerTodos(), "s");

  const c2 = seleccionarCohorte({
    elegibles: ampliado,
    estado: previo.estado,
    presupuesto: 8,
    ciclo: previo.ciclo,
    pasada: previo.pasada + 1
  });

  const ids = c2.seleccionados.map((f) => f.sourceId);

  /* Solo las tres nuevas: las otras ya se atendieron en el ciclo. */
  return (
    c2.seleccionados.length === 3 &&
    ids.every((id) => ["f8.test", "f9.test", "f10.test"].includes(id))
  );
});

await ta("con más fuentes el ciclo sigue cerrando y NO hay starvation", async () => {
  const almacen = crearAlmacenMemoria();

  const feeds = universo(15, 9);

  const servidos = new Set();

  let ciclo = 1;

  let pasada = 0;

  for (let i = 0; i < 2; i += 1) {
    const previo = reconstruirRotacion(await almacen.leerTodos(), "s");

    const sig = siguienteCicloYPasada({
      estado: previo.estado,
      ciclo: previo.ciclo,
      pasada: previo.pasada,
      elegibles: feeds
    });

    const c = seleccionarCohorte({
      elegibles: feeds,
      estado: previo.estado,
      presupuesto: 8,
      ciclo: sig.ciclo,
      pasada: sig.pasada
    });

    c.seleccionados.forEach((f) => servidos.add(f.sourceId));

    await registrarRotacion({
      almacen,
      scopeId: "s",
      cohorte: c,
      resultados: c.seleccionados.map((f) => ({
        feedUrl: f.feedUrl,
        estado: ESTADOS_INTENTO.OK,
        recibidas: 3
      })),
      instante: `2026-09-0${i + 1}T12:00:00.000Z`
    });

    ciclo = c.ciclo;

    pasada = c.pasada;
  }

  /* 15 feeds, 8 por pasada: dos pasadas cubren los 15. */
  return servidos.size === 15 && ciclo === 1 && pasada === 2;
});

await ta("un feed muerto no tumba el ciclo ni acapara plaza", async () => {
  const almacen = crearAlmacenMemoria();

  const feeds = universo(10, 5);

  const roto = feeds[0].url;

  let vecesServido = 0;

  for (let i = 0; i < 2; i += 1) {
    const previo = reconstruirRotacion(await almacen.leerTodos(), "s");

    const sig = siguienteCicloYPasada({
      estado: previo.estado,
      ciclo: previo.ciclo,
      pasada: previo.pasada,
      elegibles: feeds
    });

    const c = seleccionarCohorte({
      elegibles: feeds,
      estado: previo.estado,
      presupuesto: 8,
      ciclo: sig.ciclo,
      pasada: sig.pasada
    });

    if (c.seleccionados.some((f) => f.feedUrl === roto)) vecesServido += 1;

    await registrarRotacion({
      almacen,
      scopeId: "s",
      cohorte: c,
      resultados: c.seleccionados.map((f) => ({
        feedUrl: f.feedUrl,
        estado: f.feedUrl === roto ? ESTADOS_INTENTO.INACCESIBLE : ESTADOS_INTENTO.OK,
        recibidas: f.feedUrl === roto ? 0 : 3
      })),
      instante: `2026-09-0${i + 1}T12:00:00.000Z`
    });
  }

  return vecesServido === 1;
});


/* =========================================================
   5. FRAGMENTACIÓN: TOKENS GENÉRICOS
   ========================================================= */

console.log("\n--- Señales genéricas ---\n");

const TOPONIMOS = toponimosDe(["Ecuador", "Azuay", "Cuenca", "Guayaquil"]);

t("un token genérico se marca GENERICO y sale del ranking de temas", () =>
  clasificarSenal("caso", TOPONIMOS) === TIPOS_SENAL.GENERICO &&
  clasificarSenal("autoridades", TOPONIMOS) === TIPOS_SENAL.GENERICO &&
  clasificarSenal("pais", TOPONIMOS) === TIPOS_SENAL.GENERICO &&
  clasificarSenal("cerca", TOPONIMOS) === TIPOS_SENAL.GENERICO);

t("un genérico CON contenido sigue siendo un tema", () =>
  clasificarSenal("caso Serrano", TOPONIMOS) === TIPOS_SENAL.TEMA &&
  clasificarSenal("autoridades de movilidad", TOPONIMOS) === TIPOS_SENAL.TEMA);

t("los cuatro tipos de señal siguen distinguiéndose", () =>
  clasificarSenal("cuenca", TOPONIMOS) === TIPOS_SENAL.LUGAR &&
  clasificarSenal("agosto · lunes", TOPONIMOS) === TIPOS_SENAL.TEMPORAL &&
  clasificarSenal("caso", TOPONIMOS) === TIPOS_SENAL.GENERICO &&
  clasificarSenal("Agua y saneamiento", TOPONIMOS) === TIPOS_SENAL.TEMA);

t("las genéricas se cuentan aparte, no se borran", () => {
  const evs = [
    {
      evidenceId: "e1",
      titulo: "T",
      sourceId: "a.test",
      publishedAt: "2026-09-01T08:00:00Z",
      firstObservedAt: "2026-08-01T00:00:00.000Z"
    }
  ];

  const m = construirMatriz({
    evidencias: evs,
    temas: [{ id: "g", nombre: "caso", indices: [0] }],
    descubiertos: [],
    ubicaciones: [{ unidadId: CUENCA, unidad: "Cuenca", nivel: "canton" }],
    ventanaId: "7d",
    ahora: T0,
    toponimos: TOPONIMOS
  });

  return (
    m.filas.length === 1 &&
    m.filas[0].tipoSenal === TIPOS_SENAL.GENERICO &&
    m.metricas.senalesGenericas === 1 &&
    m.metricas.temas === 0
  );
});

t("el descubrimiento sigue siendo ABIERTO: nada se filtra por lista de temas", () => {
  /*
    Un tema que no esta en ningun lexico ni en ninguna lista
    tiene que poder aparecer. Si `clasificarSenal` lo dejara
    fuera, el descubrimiento habria dejado de ser abierto.
  */
  return (
    clasificarSenal("Deportivo Cuenca", TOPONIMOS) === TIPOS_SENAL.TEMA &&
    clasificarSenal("festival de artes escenicas", TOPONIMOS) === TIPOS_SENAL.TEMA &&
    clasificarSenal("lluvias e inundaciones", TOPONIMOS) === TIPOS_SENAL.TEMA
  );
});


/* =========================================================
   6. ACTORES Y AISLAMIENTO
   ========================================================= */

console.log("\n--- Actores y aislamiento ---\n");

const CORPUS = FICHAS.filter((f) => f.estadoVerificacion === "VERIFICADO_FEED").map((f, i) => ({
  evidenceId: `e${i}`,
  sourceId: f.dominio,
  domain: f.dominio,
  emitterId: f.dominio,
  publisher: f.nombre,
  canonicalUrl: `https://${f.dominio}/1`,
  firstObservedAt: T0,
  lastObservedAt: T0,
  providers: ["rss_directo"]
}));

t("las fuentes nuevas aparecen como actores del proyecto", () => {
  const u = construirUniversoDeActores({ corpus: CORPUS, fichas: FICHAS, projectId: "p" });

  return (
    u.actores.length === 3 &&
    u.actores.every((a) => a.projectId === "p") &&
    u.actores.some((a) => a.clave === "lavozdeltomebamba.com")
  );
});

t("una fuente nueva comprobada NO se autoverifica por analista", () => {
  const u = construirUniversoDeActores({ corpus: CORPUS, fichas: FICHAS });

  return (
    u.metricas.verificadosPorAnalista === 0 &&
    u.actores.every((a) => a.certeza === CERTEZAS.COMPROBADO)
  );
});

t("un actor de otro proyecto no entra", () => {
  const a = construirUniversoDeActores({ corpus: CORPUS, fichas: FICHAS, projectId: "p1" });

  const b = construirUniversoDeActores({ corpus: [], fichas: FICHAS, projectId: "p2" });

  return a.actores.length === 3 && b.actores.length === 0;
});

t("cada actor nuevo lleva evidencias y procedencia", () => {
  const u = construirUniversoDeActores({ corpus: CORPUS, fichas: FICHAS, projectId: "p" });

  return u.actores.every((a) => a.evidenceIds.length > 0 && a.procedencia.length > 0);
});


/* =========================================================
   7. SIN RED Y LA RUTA COMPILA
   ========================================================= */

console.log("\n--- Sin red y ruta ---\n");

t("cero llamadas al fetch global", () => llamadasDeRed === 0);

globalThis.fetch = fetchOriginal;

await ta("routes/territorio.js compila", async () => {
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
