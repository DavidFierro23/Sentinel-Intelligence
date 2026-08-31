// apps/backend/tests/territorial-sources.test.mjs

import {
  ESTADOS_FUENTE,
  METODOS_DESCUBRIMIENTO,
  ORIGEN_CLASIFICACION,
  PRIORIDADES,
  esComprobado,
  esFeedDeComentarios,
  candidatosPara,
  fichaDeFuente,
  feedsParaRecoleccion,
  estadoUniverso
} from "../services/territorial/verifiedSourceUniverse.js";

import {
  analizarRobots,
  rutaPermitida,
  comprobarRobots,
  diagnosticarHost,
  comprobarFuente,
  comprobarUniverso,
  ESTADOS_ROBOTS,
  PRESUPUESTO_COMPROBACION
} from "../services/territorial/sourceVerifier.js";

import {
  crearAlmacenMemoria,
  registrarComprobacion,
  reconstruirUniverso,
  estadoAlmacen
} from "../services/territorial/sourceUniverseStore.js";

import { recolectarAmpliado } from "../services/ingest/territorialCollector.js";

import { registrarPasada, crearLedgerMemoria } from "../services/territorial/evidenceLedger.js";

/*
===========================================================
PRUEBAS DE TERRITORIAL-SOURCE-UNIVERSE-01
===========================================================

    node tests/territorial-sources.test.mjs

SIN RED. Todo `fetch` y todo `parseURL` van inyectados, y hay
un contador que lo COMPRUEBA: la ultima prueba falla si algun
caso se escapo a internet.

«Sin red» tiene que ser comprobable, no una intencion.
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


/*
-----------------------------------------------------------
CONTADOR DE RED

Se envuelve el `fetch` global. Si alguna prueba no inyecta el
suyo, esta cifra deja de ser cero y la ultima prueba falla.
-----------------------------------------------------------
*/

let llamadasDeRedReales = 0;

const fetchOriginal = globalThis.fetch;

globalThis.fetch = () => {
  llamadasDeRedReales += 1;

  return Promise.reject(new Error("RED PROHIBIDA EN LAS PRUEBAS"));
};

const AHORA = "2026-08-31T14:00:00.000Z";

const TERRITORIO = "ec-azuay-cuenca";


/* --- dobles de red --- */

function respuesta(cuerpo, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return cuerpo;
    }
  };
}

const HTML_CON_FEED = [
  "<html><head>",
  '<link rel="alternate" type="application/rss+xml" title="Portada" href="/feed/rss.xml">',
  '<link rel="alternate" type="text/html" href="/amp">',
  "</head><body></body></html>"
].join("\n");

const HTML_SIN_FEED = "<html><head><title>sin feed</title></head><body></body></html>";

const ROBOTS_ABIERTO = "User-agent: *\nDisallow:\n";

const ROBOTS_CERRADO = "User-agent: *\nDisallow: /\n";

function feedConEntradas(n = 3, publishedAt = "2026-08-31T09:00:00.000Z") {
  return {
    title: "Feed de prueba",
    items: Array.from({ length: n }, (_, i) => ({
      title: `Titular ${i + 1}`,
      link: `https://ejemplo.test/nota-${i + 1}`,
      guid: `https://ejemplo.test/nota-${i + 1}`,
      isoDate: publishedAt,
      contentSnippet: "Resumen de la nota."
    }))
  };
}

/* Fabrica un `fetch` que sirve robots.txt y portada. */
function fetchFalso({
  robots = ROBOTS_ABIERTO,
  html = HTML_CON_FEED,
  estadoRobots = 200,
  estadoPortada = 200
} = {}) {
  const visitadas = [];

  const impl = async (url) => {
    visitadas.push(String(url));

    if (String(url).endsWith("/robots.txt")) return respuesta(robots, { status: estadoRobots });

    if (estadoPortada >= 400) return respuesta("", { status: estadoPortada });

    return respuesta(html, { status: estadoPortada });
  };

  impl.visitadas = visitadas;

  return impl;
}


/* =========================================================
   1. CANDIDATOS — de donde sale cada uno
   ========================================================= */

console.log("\n--- Candidatos y procedencia ---\n");

const candidatos = candidatosPara(TERRITORIO);

t("hay candidatos para Cuenca", () => candidatos.length >= 10);

t("cada candidato declara su metodo de descubrimiento", () =>
  candidatos.every((c) =>
    Object.values(METODOS_DESCUBRIMIENTO).includes(c.metodoDescubrimiento)
  ));

t("ningun candidato llega con feed: el feed lo decide la comprobacion", () =>
  candidatos.every((c) => c.feedUrl === undefined && c.feeds === undefined));

t("El Mercurio entra por catalogo semilla, no por inferencia", () => {
  const m = candidatos.find((c) => c.dominio === "elmercurio.com.ec");

  return (
    m &&
    m.metodoDescubrimiento === METODOS_DESCUBRIMIENTO.CATALOGO_SEMILLA &&
    m.origenClasificacion === ORIGEN_CLASIFICACION.CATALOGO &&
    m.prioridad === PRIORIDADES.MEDIO_LOCAL
  );
});

t("un dominio propuesto NO se clasifica por su nombre", () => {
  const p = candidatos.find(
    (c) => c.metodoDescubrimiento === METODOS_DESCUBRIMIENTO.DOMINIO_PROPUESTO
  );

  return p && p.tipo === null && p.origenClasificacion === ORIGEN_CLASIFICACION.SIN_CLASIFICAR;
});

t("la cobertura territorial no se declara medida en ninguna", () =>
  candidatos.every((c) => c.coberturaTerritorialMedida === false));

t("un medio nacional entra sin territorio declarado y con la razon dicha", () => {
  const n = candidatos.find((c) => c.dominio === "eluniverso.com");

  return n && n.territorioDeclarado === null && /nacional/i.test(n.nota || "");
});

t("una fuente provincial cubre el canton; el canton no cubre la provincia", () => {
  const enCanton = candidatosPara("ec-azuay-cuenca").find((c) => c.dominio === "azuay.gob.ec");

  const enProvincia = candidatosPara("ec-azuay").find((c) => c.dominio === "cuenca.gob.ec");

  return Boolean(enCanton?.territorioDeclarado) && !enProvincia?.territorioDeclarado;
});

t("se pueden excluir los nacionales", () => {
  const solo = candidatosPara(TERRITORIO, { incluirNacionales: false });

  return solo.length < candidatos.length && solo.every((c) => c.dominio !== "eluniverso.com");
});

t("los candidatos vienen ordenados por prioridad", () => {
  const p = candidatos.map((c) => c.prioridad);

  return p.every((v, i) => i === 0 || p[i - 1] <= v);
});


/* =========================================================
   2. ROBOTS.TXT
   ========================================================= */

console.log("\n--- robots.txt ---\n");

t("un robots abierto permite la portada", () =>
  rutaPermitida(analizarRobots(ROBOTS_ABIERTO), "/"));

t("`Disallow:` vacio NO es `Disallow: /`", () =>
  rutaPermitida(analizarRobots(ROBOTS_ABIERTO), "/") &&
  !rutaPermitida(analizarRobots(ROBOTS_CERRADO), "/"));

t("una regla escrita para Googlebot no nos aplica", () => {
  const reglas = analizarRobots(
    "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\n"
  );

  return rutaPermitida(reglas, "/") && !rutaPermitida(reglas, "/admin/x");
});

t("varios User-agent seguidos comparten el mismo bloque", () => {
  const reglas = analizarRobots("User-agent: a\nUser-agent: *\nDisallow: /privado\n");

  return !rutaPermitida(reglas, "/privado") && rutaPermitida(reglas, "/publico");
});

t("un Allow mas especifico gana sobre el Disallow", () => {
  const reglas = analizarRobots("User-agent: *\nDisallow: /noticias\nAllow: /noticias/feed\n");

  return rutaPermitida(reglas, "/noticias/feed") && !rutaPermitida(reglas, "/noticias/otra");
});

t("se respeta el comodin y el ancla final", () => {
  const reglas = analizarRobots("User-agent: *\nDisallow: /*.pdf$\n");

  return (
    !rutaPermitida(reglas, "/doc/informe.pdf") && rutaPermitida(reglas, "/doc/informe.pdf.html")
  );
});

t("los comentarios no se leen como reglas", () =>
  rutaPermitida(analizarRobots("# Disallow: /\nUser-agent: *\nDisallow:\n"), "/"));

await ta("un robots ausente (404) NO es una prohibicion", async () => {
  const r = await comprobarRobots("ejemplo.test", { fetch: fetchFalso({ estadoRobots: 404 }) });

  return r.estado === ESTADOS_ROBOTS.NO_PUBLICADO && /NO es una prohibición/i.test(r.nota);
});

await ta("un robots ilegible no se lee como permiso ni como prohibicion", async () => {
  const r = await comprobarRobots("ejemplo.test", { fetch: fetchFalso({ estadoRobots: 500 }) });

  return r.estado === ESTADOS_ROBOTS.ILEGIBLE;
});


/* =========================================================
   3. COMPROBAR UNA FUENTE
   ========================================================= */

console.log("\n--- Comprobacion de una fuente ---\n");

const candidatoBase = {
  sourceId: "ejemplo.test",
  dominio: "ejemplo.test",
  nombre: "Medio de prueba",
  tipo: "medio_local",
  subtipo: null,
  origenClasificacion: ORIGEN_CLASIFICACION.CATALOGO,
  territorioDeclarado: TERRITORIO,
  resolucionCobertura: "canton",
  coberturaTerritorialMedida: false,
  prioridad: PRIORIDADES.MEDIO_LOCAL,
  metodoDescubrimiento: METODOS_DESCUBRIMIENTO.CATALOGO_SEMILLA,
  homepage: "https://ejemplo.test",
  nota: null
};

await ta("feed declarado + responde + parseable = VERIFICADO_FEED", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(3)
  });

  return (
    ficha.estadoVerificacion === ESTADOS_FUENTE.VERIFICADO_FEED &&
    ficha.feeds.length === 1 &&
    ficha.feeds[0].conContenido === true &&
    ficha.feeds[0].origen === "declarado_por_el_sitio"
  );
});

await ta("solo entra el feed DECLARADO: el link que no es feed se ignora", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(1)
  });

  return ficha.feeds.length === 1 && ficha.feeds[0].url === "https://ejemplo.test/feed/rss.xml";
});

await ta("portada responde y no declara feed = NO_PUBLICA_RSS", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso({ html: HTML_SIN_FEED }),
    parseURL: async () => {
      throw new Error("no debe leerse ningun feed");
    }
  });

  return (
    ficha.estadoVerificacion === ESTADOS_FUENTE.NO_PUBLICA_RSS &&
    ficha.feeds.length === 0 &&
    ficha.comprobado === true
  );
});

await ta("declara feed y no es legible = VERIFICADO_SIN_FEED, no NO_PUBLICA_RSS", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => {
      throw new Error("Invalid XML: not a feed");
    }
  });

  return (
    ficha.estadoVerificacion === ESTADOS_FUENTE.VERIFICADO_SIN_FEED &&
    ficha.feedsDescartados.length === 1 &&
    ficha.feeds.length === 0
  );
});

await ta("un feed que responde vacio es valido pero NO alimenta al recolector", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => ({ title: "Feed abandonado", items: [] })
  });

  return (
    ficha.estadoVerificacion === ESTADOS_FUENTE.VERIFICADO_SIN_FEED &&
    ficha.feeds.length === 1 &&
    ficha.feeds[0].conContenido === false &&
    feedsParaRecoleccion([ficha]).length === 0
  );
});

await ta("portada que no responde = INACCESIBLE, y no se afirma nada del feed", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso({ estadoPortada: 503 }),
    parseURL: async () => feedConEntradas(1)
  });

  return (
    ficha.estadoVerificacion === ESTADOS_FUENTE.INACCESIBLE &&
    ficha.feeds.length === 0 &&
    ficha.comprobado === false
  );
});

await ta("robots que prohibe = NO_RESUELTO, y la portada NO se pide", async () => {
  const f = fetchFalso({ robots: ROBOTS_CERRADO });

  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: f,
    parseURL: async () => feedConEntradas(1)
  });

  return (
    ficha.estadoVerificacion === ESTADOS_FUENTE.NO_RESUELTO &&
    ficha.comprobado === false &&
    ficha.restricciones.length === 1 &&
    f.visitadas.length === 1 &&
    f.visitadas[0].endsWith("/robots.txt")
  );
});

await ta("un feed en ruta prohibida por robots se descarta sin leerlo", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso({ robots: "User-agent: *\nDisallow: /feed\n" }),
    parseURL: async () => {
      throw new Error("no debe leerse un feed prohibido");
    }
  });

  return (
    ficha.estadoVerificacion === ESTADOS_FUENTE.VERIFICADO_SIN_FEED &&
    ficha.feedsDescartados[0].estado === "NO_PERMITIDO_POR_ROBOTS"
  );
});

await ta("NO se adivinan rutas: solo robots, portada y feeds declarados", async () => {
  const f = fetchFalso();

  await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: f,
    parseURL: async () => feedConEntradas(2)
  });

  const adivinadas = f.visitadas.filter((u) => /\/(rss|feed|rss\.xml|atom\.xml)$/i.test(u));

  return f.visitadas.length === 2 && adivinadas.length === 0;
});


/* =========================================================
   4. LA FICHA NO AFIRMA LO QUE NO SABE
   ========================================================= */

console.log("\n--- Cero invenciones ---\n");

await ta("ninguna ficha se declara contrastada contra un registro oficial", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(1)
  });

  return ficha.registroOficialContrastado === false;
});

await ta("licencia y uso comercial siguen en null: null bloquea igual que false", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(1)
  });

  return (
    ficha.licencia === null && ficha.terminosUrl === null && ficha.usoComercialPermitido === null
  );
});

t("`comprobado` es false en los estados en los que el sitio no respondio", () =>
  esComprobado(ESTADOS_FUENTE.VERIFICADO_FEED) &&
  esComprobado(ESTADOS_FUENTE.NO_PUBLICA_RSS) &&
  esComprobado(ESTADOS_FUENTE.VERIFICADO_SIN_FEED) &&
  !esComprobado(ESTADOS_FUENTE.INACCESIBLE) &&
  !esComprobado(ESTADOS_FUENTE.NO_RESUELTO));

t("una URL plausible sin comprobar no produce una fuente comprobada", () => {
  const ficha = fichaDeFuente(candidatoBase, {});

  return (
    ficha.estadoVerificacion === ESTADOS_FUENTE.NO_RESUELTO &&
    ficha.comprobado === false &&
    ficha.comprobadoEn === null &&
    ficha.feeds.length === 0
  );
});

await ta("la procedencia registra cada afirmacion con su instante", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(1)
  });

  const afirmaciones = ficha.procedencia.map((p) => p.afirmacion);

  return (
    ficha.procedencia.length >= 4 &&
    ficha.procedencia.every((p) => p.instante === AHORA && p.origen) &&
    afirmaciones.includes("candidato") &&
    afirmaciones.includes("robots.txt") &&
    afirmaciones.includes("feeds declarados en el HTML") &&
    afirmaciones.includes("lectura del feed")
  );
});

await ta("la fecha del medio no se confunde con la de Sentinel", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(2, "2026-08-20T10:00:00.000Z")
  });

  return (
    ficha.comprobadoEn === AHORA &&
    ficha.feeds[0].publicacionMasReciente === "2026-08-20T10:00:00.000Z"
  );
});


/* =========================================================
   5. UNIVERSO Y PRESUPUESTO
   ========================================================= */

console.log("\n--- Universo y presupuesto ---\n");

const dosCandidatos = [
  candidatoBase,
  {
    ...candidatoBase,
    sourceId: "otro.test",
    dominio: "otro.test",
    nombre: "Otro medio",

    /* Homepage propia: si la compartieran, el feed declarado
       resolveria a la MISMA url y el dedup por url dejaria uno. */
    homepage: "https://otro.test"
  }
];

await ta("comprobar un universo declara coste 0 y cuenta las peticiones", async () => {
  const u = await comprobarUniverso({
    territorioId: TERRITORIO,
    candidatos: dosCandidatos,
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(2)
  });

  return (
    u.coste.usd === 0 &&
    u.coste.peticionesHttp === 6 &&
    u.coste.desglose.robots === 2 &&
    u.coste.desglose.portada === 2 &&
    u.coste.desglose.feeds === 2
  );
});

await ta("los que no caben en el presupuesto entran NO_RESUELTO, no se omiten", async () => {
  const u = await comprobarUniverso({
    territorioId: TERRITORIO,
    candidatos: dosCandidatos,
    instante: AHORA,
    limite: 1,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(1)
  });

  const fuera = u.fichas.find((f) => f.sourceId === "otro.test");

  return (
    u.fichas.length === 2 &&
    fuera.estadoVerificacion === ESTADOS_FUENTE.NO_RESUELTO &&
    /presupuesto/i.test(fuera.motivo) &&
    u.coste.peticionesHttp === 3
  );
});

t("el presupuesto por fuente esta declarado", () =>
  PRESUPUESTO_COMPROBACION.fuentesPorPasada > 0 && PRESUPUESTO_COMPROBACION.feedsPorFuente > 0);

t("el resumen declara que comprobado no es verificado", () => {
  const r = estadoUniverso([fichaDeFuente(candidatoBase, {})]);

  return (
    r.registroOficialContrastado === false &&
    r.declaraciones.some((d) => /Comprobado/.test(d) && /Verificado/.test(d))
  );
});


/* =========================================================
   6. PERSISTENCIA, DEDUP E IDEMPOTENCIA
   ========================================================= */

console.log("\n--- Almacen: dedup, rerun e inmutabilidad ---\n");

function universoDePrueba(instante) {
  return comprobarUniverso({
    territorioId: TERRITORIO,
    candidatos: dosCandidatos,
    instante,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(2)
  });
}

await ta("primera pasada: dos fuentes, dos nuevas", async () => {
  const r = await registrarComprobacion({
    almacen: crearAlmacenMemoria(),
    universo: await universoDePrueba(AHORA),
    estadoPrevio: new Map()
  });

  return (
    r.metricas.fuentes === 2 &&
    r.metricas.nuevasParaSentinel === 2 &&
    r.metricas.yaConocidas === 0
  );
});

await ta("reejecutar NO duplica: dos lineas por fuente, dos fuentes", async () => {
  const almacen = crearAlmacenMemoria();

  await registrarComprobacion({
    almacen,
    universo: await universoDePrueba(AHORA),
    estadoPrevio: new Map()
  });

  const previo = reconstruirUniverso(await almacen.leerTodos());

  const segunda = await registrarComprobacion({
    almacen,
    universo: await universoDePrueba("2026-08-31T18:00:00.000Z"),
    estadoPrevio: previo
  });

  const estado = await estadoAlmacen(almacen);

  return (
    segunda.metricas.nuevasParaSentinel === 0 &&
    segunda.metricas.yaConocidas === 2 &&
    segunda.metricas.corpusAcumulado === 2 &&
    estado.comprobacionesRegistradas === 4 &&
    estado.fuentes === 2 &&
    estado.lineasPorFuente === 2
  );
});

await ta("`primeraComprobacionEn` es inmutable entre pasadas", async () => {
  const almacen = crearAlmacenMemoria();

  await registrarComprobacion({
    almacen,
    universo: await universoDePrueba(AHORA),
    estadoPrevio: new Map()
  });

  const segunda = await registrarComprobacion({
    almacen,
    universo: await universoDePrueba("2026-09-05T08:00:00.000Z"),
    estadoPrevio: reconstruirUniverso(await almacen.leerTodos())
  });

  const f = segunda.fichas[0];

  return (
    f.primeraComprobacionEn === AHORA &&
    f.ultimaComprobacionEn === "2026-09-05T08:00:00.000Z" &&
    f.comprobaciones === 2
  );
});

await ta("una ficha NO_RESUELTO por presupuesto no avanza el contador", async () => {
  const u = await comprobarUniverso({
    territorioId: TERRITORIO,
    candidatos: dosCandidatos,
    instante: AHORA,
    limite: 1,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(1)
  });

  const r = await registrarComprobacion({
    almacen: crearAlmacenMemoria(),
    universo: u,
    estadoPrevio: new Map()
  });

  const fuera = r.fichas.find((f) => f.sourceId === "otro.test");

  return (
    fuera.comprobaciones === 0 &&
    fuera.ultimaComprobacionEn === null &&
    fuera.primeraComprobacionEn === null
  );
});

await ta("una comprobacion sin instante no se registra", async () => {
  try {
    await registrarComprobacion({ almacen: crearAlmacenMemoria(), universo: { fichas: [] } });

    return false;
  } catch (e) {
    return /comprobadoEn/.test(e.message);
  }
});

await ta("el almacen distingue nunca comprobadas de comprobadas", async () => {
  const almacen = crearAlmacenMemoria();

  await registrarComprobacion({
    almacen,
    universo: await comprobarUniverso({
      territorioId: TERRITORIO,
      candidatos: dosCandidatos,
      instante: AHORA,
      limite: 1,
      fetch: fetchFalso(),
      parseURL: async () => feedConEntradas(1)
    }),
    estadoPrevio: new Map()
  });

  const e = await estadoAlmacen(almacen);

  return e.fuentes === 2 && e.nuncaComprobadas === 1 && e.conFeedValido === 1;
});


/* =========================================================
   7. AISLAMIENTO TERRITORIAL Y CONEXION AL RECOLECTOR
   ========================================================= */

console.log("\n--- Conexion al recolector ---\n");

await ta("RSS deja de estar SIN_FUENTES cuando el universo aporta feeds", async () => {
  const u = await universoDePrueba(AHORA);

  const feeds = feedsParaRecoleccion(u.fichas);

  const antes = await recolectarAmpliado({
    plan: [],
    feeds: [],
    observedAt: AHORA,
    habilitados: ["rss_directo"]
  });

  const despues = await recolectarAmpliado({
    plan: [],
    feeds,
    observedAt: AHORA,
    habilitados: ["rss_directo"],
    inyeccion: { parseURL: async () => feedConEntradas(3) }
  });

  return (
    antes.lotes[0].estado === "SIN_FUENTES" &&
    feeds.length === 2 &&
    despues.lotes.every((l) => l.estado === "OK") &&
    despues.evidencias.length > 0
  );
});

await ta("el recolector recibe la forma que ya esperaba: url, publisher y sourceId", async () => {
  const u = await universoDePrueba(AHORA);

  return feedsParaRecoleccion(u.fichas).every((f) => f.url && f.publisher && f.sourceId);
});

await ta("el publicador viene del feed, no se adivina del dominio", async () => {
  const u = await universoDePrueba(AHORA);

  const r = await recolectarAmpliado({
    plan: [],
    feeds: feedsParaRecoleccion(u.fichas),
    observedAt: AHORA,
    habilitados: ["rss_directo"],
    inyeccion: { parseURL: async () => feedConEntradas(2) }
  });

  return (
    r.evidencias.length > 0 &&
    r.evidencias.every((e) => e.publisher && !/news\.google/.test(String(e.url)))
  );
});

await ta("los feeds se ordenan por prioridad: los locales primero", async () => {
  const nacional = {
    ...candidatoBase,
    sourceId: "nacional.test",
    dominio: "nacional.test",
    nombre: "Nacional",
    territorioDeclarado: null,
    prioridad: PRIORIDADES.MEDIO_REGIONAL_O_NACIONAL
  };

  const u = await comprobarUniverso({
    territorioId: TERRITORIO,
    candidatos: [nacional, candidatoBase],
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(1)
  });

  return feedsParaRecoleccion(u.fichas)[0].sourceId === "ejemplo.test";
});

await ta("la frescura sigue vigente: publishedAt es del medio, no de la pasada", async () => {
  const u = await universoDePrueba(AHORA);

  const r = await recolectarAmpliado({
    plan: [],
    feeds: feedsParaRecoleccion(u.fichas),
    observedAt: AHORA,
    habilitados: ["rss_directo"],
    inyeccion: { parseURL: async () => feedConEntradas(2, "2026-08-10T12:00:00.000Z") }
  });

  const pasada = await registrarPasada({
    ledger: crearLedgerMemoria(),
    evidencias: r.evidencias,
    estadoPrevio: new Map(),
    retrievedAt: AHORA
  });

  return (
    pasada.evidencias.length > 0 &&
    pasada.evidencias.every(
      (e) =>
        String(e.publishedAt).startsWith("2026-08-10") &&
        e.firstObservedAt === AHORA &&
        e.retrievedAt === AHORA &&
        e.publishedAt !== e.retrievedAt
    )
  );
});

await ta("dedup contra el corpus: la misma evidencia dos veces no es nueva", async () => {
  const u = await universoDePrueba(AHORA);

  const feeds = feedsParaRecoleccion(u.fichas);

  const ledger = crearLedgerMemoria();

  const primera = await recolectarAmpliado({
    plan: [],
    feeds,
    observedAt: AHORA,
    habilitados: ["rss_directo"],
    inyeccion: { parseURL: async () => feedConEntradas(3) }
  });

  const p1 = await registrarPasada({
    ledger,
    evidencias: primera.evidencias,
    estadoPrevio: new Map(),
    retrievedAt: AHORA
  });

  const estadoPrevio = new Map(p1.evidencias.map((e) => [e.evidenceId, e]));

  const segunda = await recolectarAmpliado({
    plan: [],
    feeds,
    observedAt: "2026-08-31T20:00:00.000Z",
    habilitados: ["rss_directo"],
    inyeccion: { parseURL: async () => feedConEntradas(3) }
  });

  const p2 = await registrarPasada({
    ledger,
    evidencias: segunda.evidencias,
    estadoPrevio,
    retrievedAt: "2026-08-31T20:00:00.000Z"
  });

  return (
    p1.metricas.nuevasParaSentinel > 0 &&
    p2.metricas.nuevasParaSentinel === 0 &&
    p2.metricas.yaConocidas === p1.metricas.nuevasParaSentinel &&
    p2.metricas.corpusAcumulado === p1.metricas.corpusAcumulado
  );
});

await ta("firstObservedAt no se reescribe en la segunda pasada", async () => {
  const u = await universoDePrueba(AHORA);

  const r = await recolectarAmpliado({
    plan: [],
    feeds: feedsParaRecoleccion(u.fichas),
    observedAt: AHORA,
    habilitados: ["rss_directo"],
    inyeccion: { parseURL: async () => feedConEntradas(2) }
  });

  const p1 = await registrarPasada({
    evidencias: r.evidencias,
    estadoPrevio: new Map(),
    retrievedAt: AHORA
  });

  const p2 = await registrarPasada({
    evidencias: r.evidencias,
    estadoPrevio: new Map(p1.evidencias.map((e) => [e.evidenceId, e])),
    retrievedAt: "2026-09-01T14:00:00.000Z"
  });

  return p2.evidencias.every(
    (e) => e.firstObservedAt === AHORA && e.lastObservedAt === "2026-09-01T14:00:00.000Z"
  );
});

await ta("el universo territorial no contiene fuentes de otros modulos", async () => {
  const u = await universoDePrueba(AHORA);

  /* Ni candidatos ni cuentas personales: este gate no las toca. */
  return u.fichas.every(
    (f) => f.tipo !== "candidato" && f.tipo !== "cuenta_personal" && f.handle === undefined
  );
});



/* =========================================================
   7-bis. COMENTARIOS, ORDEN Y DIAGNOSTICO DEL HOST
   ========================================================= */

console.log("\n--- Comentarios, orden y host ---\n");

const HTML_CON_FEED_Y_COMENTARIOS = [
  "<html><head>",
  '<link rel="alternate" type="application/rss+xml" title="Portada" href="/feed/">',
  '<link rel="alternate" type="application/rss+xml" title="Comentarios" href="/comments/feed/">',
  "</head><body></body></html>"
].join("\n");

t("un feed de comentarios se reconoce por su ruta declarada", () =>
  esFeedDeComentarios("https://x.test/comments/feed/") &&
  esFeedDeComentarios("https://x.test/comentarios/feed") &&
  !esFeedDeComentarios("https://x.test/feed/") &&
  !esFeedDeComentarios("https://x.test/rss/home.xml"));

await ta("el feed de comentarios consta en la ficha pero NO se recolecta", async () => {
  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso({ html: HTML_CON_FEED_Y_COMENTARIOS }),
    parseURL: async () => feedConEntradas(3)
  });

  const feeds = feedsParaRecoleccion([ficha]);

  return (
    ficha.estadoVerificacion === ESTADOS_FUENTE.VERIFICADO_FEED &&
    ficha.feeds.length === 2 &&
    ficha.feeds.filter((f) => f.esDeComentarios).length === 1 &&
    feeds.length === 1 &&
    !/comments/.test(feeds[0].url)
  );
});

await ta("una fuente con territorio declarado va antes que un nacional sin el", async () => {
  const institucion = {
    ...candidatoBase,
    sourceId: "emac.test",
    dominio: "emac.test",
    homepage: "https://emac.test",
    nombre: "Institucion del canton",
    territorioDeclarado: TERRITORIO,
    prioridad: PRIORIDADES.INSTITUCION_PUBLICA
  };

  const nacional = {
    ...candidatoBase,
    sourceId: "nacional.test",
    dominio: "nacional.test",
    homepage: "https://nacional.test",
    nombre: "Nacional",
    territorioDeclarado: null,
    prioridad: PRIORIDADES.MEDIO_REGIONAL_O_NACIONAL
  };

  const u = await comprobarUniverso({
    territorioId: TERRITORIO,
    candidatos: [nacional, institucion],
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(1)
  });

  const feeds = feedsParaRecoleccion(u.fichas);

  /* P3 con territorio gana a P2 sin territorio. */
  return feeds[0].sourceId === "emac.test" && feeds[1].sourceId === "nacional.test";
});

await ta("el diagnostico del host distingue ENOTFOUND de ECONNRESET", async () => {
  const conCausa = (code) => async () => {
    const e = new Error("fetch failed");

    e.cause = { code };

    throw e;
  };

  const noExiste = await diagnosticarHost("https://x.test", { fetch: conCausa("ENOTFOUND") });

  const corta = await diagnosticarHost("https://y.test", { fetch: conCausa("ECONNRESET") });

  return (
    noExiste.causa === "ENOTFOUND" &&
    corta.causa === "ECONNRESET" &&
    !noExiste.alcanzable &&
    !corta.alcanzable
  );
});

await ta("un dominio que no resuelve deja constancia de que el catalogo esta mal", async () => {
  const fetchDns = async (url) => {
    const e = new Error("fetch failed");

    e.cause = { code: "ENOTFOUND" };

    throw e;
  };

  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchDns,
    parseURL: async () => feedConEntradas(1)
  });

  return (
    ficha.estadoVerificacion === ESTADOS_FUENTE.INACCESIBLE &&
    /ENOTFOUND/.test(ficha.motivo) &&
    ficha.restricciones.some((r) => /no existe en el DNS/i.test(r)) &&
    ficha.restricciones.some((r) => /NO se sustituye por un dominio inventado/i.test(r))
  );
});

await ta("el host canonico `www` se prueba UNA vez y recupera el sitio", async () => {
  const visitadas = [];

  const fetchWww = async (url) => {
    const u = String(url);

    visitadas.push(u);

    if (u.endsWith("/robots.txt")) return respuesta(ROBOTS_ABIERTO);

    /* Solo el host con `www` responde. */
    if (!u.includes("www.")) {
      const e = new Error("fetch failed");

      e.cause = { code: "ECONNRESET" };

      throw e;
    }

    return respuesta(HTML_CON_FEED);
  };

  const { ficha } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchWww,
    parseURL: async () => feedConEntradas(2)
  });

  return (
    ficha.estadoVerificacion === ESTADOS_FUENTE.VERIFICADO_FEED &&
    ficha.feeds[0].url.includes("www.ejemplo.test") &&
    ficha.procedencia.some((p) => p.afirmacion === "host canónico") &&
    visitadas.filter((u) => u.includes("www.")).length === 2
  );
});

await ta("el camino feliz NO gasta peticiones extra de diagnostico", async () => {
  const { peticiones } = await comprobarFuente(candidatoBase, {
    instante: AHORA,
    fetch: fetchFalso(),
    parseURL: async () => feedConEntradas(2)
  });

  return peticiones.robots === 1 && peticiones.portada === 1;
});

/* =========================================================
   8. SIN RED
   ========================================================= */

console.log("\n--- Sin red ---\n");

t("cero llamadas al fetch global: todas las pruebas inyectan la suya", () =>
  llamadasDeRedReales === 0);

globalThis.fetch = fetchOriginal;


/* =========================================================
   9. LA RUTA COMPILA

   Las pruebas de los modulos pasaban y `routes/territorio.js`
   NO compilaba: `estadoUniverso` y `crearAlmacenFichero` ya
   estaban declarados por `conversation/sourceUniverse.js` y por
   `snapshotStore.js`. Un `SyntaxError` de nombre repetido tumba
   el backend entero al arrancar y ninguna prueba de unidad lo
   ve, porque ninguna importa la ruta.

   Esta prueba la importa. Es la unica que puede fallar por ese
   motivo.
   ========================================================= */

console.log("\n--- La ruta compila ---\n");

await ta("routes/territorio.js compila y exporta el router", async () => {
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
