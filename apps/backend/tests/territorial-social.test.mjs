// apps/backend/tests/territorial-social.test.mjs

import {
  recolectarAmpliado,
  estadoAdapters,
  PRESUPUESTO_POR_PASADA,
  MOTIVO_PRESUPUESTO
} from "../services/ingest/territorialCollector.js";

import { TIPOS_CONSULTA } from "../services/conversation/queryPlanner.js";

import yt from "../services/ingest/adapters/youtubeAdapter.js";

import x from "../services/ingest/adapters/xAdapter.js";

import {
  indiceDeAmbito,
  clasificarAlcance,
  resumirAlcance,
  esTerminoAmbiguo,
  ALCANCES
} from "../services/territorial/territorialScope.js";

import { construirUniversoDeActores } from "../services/territorial/actorUniverse.js";

import { registrarPasada, reconstruirEstado, crearLedgerMemoria } from "../services/territorial/evidenceLedger.js";

/*
===========================================================
PRUEBAS DE TERRITORIAL-CREDENTIAL-ACTIVATION-01
===========================================================

    node tests/territorial-social.test.mjs

SIN RED. Todo `fetch` va inyectado y hay un contador que lo
comprueba.

QUE DEFIENDE ESTA SUITE
-----------------------------------------------------------

Que los dos conectores esten LISTOS y que activarlos no afloje
ninguna regla. En particular la que este gate puede romper con
mas facilidad:

    una consulta que dice «Cuenca» NO demuestra
    que el resultado sea de Cuenca

Y la de credencial: sin llave, `SIN_CREDENCIAL` y cero llamadas.
No es «no hay conversacion sobre Cuenca»: es que no se pregunto.
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

const AHORA = "2026-09-01T14:00:00.000Z";

const CUENCA = "ec-azuay-cuenca";

const PLAN = [
  {
    tipo: TIPOS_CONSULTA.NEUTRAL,
    texto: "Cuenca Azuay",
    etiqueta: "neutral:cuenca",
    piezas: { variante: null }
  },
  {
    tipo: TIPOS_CONSULTA.NEUTRAL,
    texto: "Cuenca Ecuador",
    etiqueta: "neutral:cuenca-ec",
    piezas: { variante: "ecuador" }
  }
];


/* --- dobles de red --- */

const TITULOS_VIDEO = [
  "Nueva ordenanza de movilidad en el Centro Historico",
  "El tranvia amplia su horario los fines de semana",
  "Obras de alcantarillado en la parroquia rural",
  "Feria de emprendimiento en el parque"
];

function respuestaJson(cuerpo) {
  return { ok: true, status: 200, async json() { return cuerpo; } };
}

function fetchDeX({ posts = 2, conUsuarios = true } = {}) {
  const urls = [];

  const impl = async (url) => {
    urls.push(String(url));

    const data = Array.from({ length: posts }, (_, i) => ({
      id: `p${i}`,
      text: TITULOS_VIDEO[i % TITULOS_VIDEO.length],
      created_at: "2026-09-01T10:00:00Z",
      author_id: `a${i}`
    }));

    const includes = conUsuarios
      ? {
          users: Array.from({ length: posts }, (_, i) => ({
            id: `a${i}`,
            username: `cuenta${i}`,
            name: `Cuenta ${i}`
          }))
        }
      : undefined;

    return respuestaJson({ data, includes, meta: { result_count: posts } });
  };

  impl.urls = urls;

  return impl;
}

/*
  Titulares DISTINTOS de verdad. `crossProviderDedup` absorbe
  titulos casi identicos del mismo dominio, y hace bien: son la
  misma pieza resubida. Con «reportaje 0 / reportaje 1» el motor
  colapsaba tres videos en dos y la prueba medía el parecido de
  las cadenas, no la recoleccion.
*/
function fetchDeYoutube({ videos = 3 } = {}) {
  const urls = [];

  const impl = async (url) => {
    urls.push(String(url));

    return respuestaJson({
      items: Array.from({ length: videos }, (_, i) => ({
        id: { videoId: `v${i}` },
        snippet: {
          title: TITULOS_VIDEO[i % TITULOS_VIDEO.length],
          description: "descripcion",
          publishedAt: "2026-09-01T09:00:00Z",
          channelId: `c${i % 2}`,
          channelTitle: `Canal ${i % 2}`
        }
      }))
    });
  };

  impl.urls = urls;

  return impl;
}


/* =========================================================
   1. ESTADO DE CREDENCIAL — SIN SECRETOS
   ========================================================= */

console.log("\n--- Credenciales ---\n");

t("los dos adapters declaran su variable de entorno, no su valor", () => {
  const dx = x.diagnostico();

  const dy = yt.diagnostico();

  const json = JSON.stringify({ dx, dy });

  return (
    dx.variableEntorno === "X_BEARER_TOKEN" &&
    /YOUTUBE_API_KEY/.test(JSON.stringify(dy)) &&
    !/Bearer\s+[A-Za-z0-9]/.test(json)
  );
});

await ta("sin credencial, X devuelve SIN_CREDENCIAL y NO llama a la red", async () => {
  let llamadas = 0;

  const r = await x.buscarMenciones("Cuenca", {
    fetch: async () => {
      llamadas += 1;

      return respuestaJson({});
    }
  });

  return r.estado === "SIN_CREDENCIAL" && llamadas === 0 && r.evidencias.length === 0;
});

await ta("sin credencial, YouTube devuelve SIN_CREDENCIAL y NO llama a la red", async () => {
  let llamadas = 0;

  const r = await yt.buscar("Cuenca", {
    fetch: async () => {
      llamadas += 1;

      return respuestaJson({});
    }
  });

  return (
    r.estado === "SIN_CREDENCIAL" &&
    llamadas === 0 &&
    r.unidadesConsumidas === 0 &&
    /no se preguntó/i.test(r.declaracion || "")
  );
});

t("SIN_CREDENCIAL no es cero resultados: el motivo lo dice", async () => {
  const r = await yt.buscar("Cuenca");

  return /NO se puede afirmar ausencia/i.test(r.declaracion || "");
});

await ta("el lote territorial declara SIN_CREDENCIAL, no un cero silencioso", async () => {
  const r = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["x_api", "youtube_data"]
  });

  const lx = r.lotes.find((l) => l.providerId === "x_api");

  const ly = r.lotes.find((l) => l.providerId === "youtube_data");

  return (
    lx.estado === "SIN_CREDENCIAL" &&
    ly.estado === "SIN_CREDENCIAL" &&
    lx.recibidas === 0 &&
    r.evidencias.length === 0
  );
});


/* =========================================================
   2. PRESUPUESTO Y CUOTA
   ========================================================= */

console.log("\n--- Presupuesto y cuota ---\n");

t("cada proveedor social tiene UNA consulta por pasada declarada", () =>
  PRESUPUESTO_POR_PASADA.youtube_data === 1 &&
  PRESUPUESTO_POR_PASADA.x_api === 1 &&
  typeof MOTIVO_PRESUPUESTO.x_api === "string");

t("el motivo de X declara que su límite NO se conoce", () =>
  /NO conocemos|no est[áa] medido/i.test(MOTIVO_PRESUPUESTO.x_api));

t("el coste en unidades de YouTube está declarado, no supuesto", () =>
  yt.COSTE_UNIDADES.search === 100 && yt.CUOTA_DIARIA_GRATUITA === 10000);

await ta("con dos consultas neutras en el plan, cada social hace UNA sola llamada", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  process.env.YOUTUBE_API_KEY = "PRUEBA";

  const fx = fetchDeX({ posts: 1 });

  const r = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["x_api"],
    inyeccion: { fetch: fx }
  });

  delete process.env.X_BEARER_TOKEN;

  delete process.env.YOUTUBE_API_KEY;

  return fx.urls.length === 1 && r.lotes.filter((l) => l.providerId === "x_api").length === 1;
});

await ta("la cuota consumida de YouTube viaja en el lote", async () => {
  process.env.YOUTUBE_API_KEY = "PRUEBA";

  const r = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["youtube_data"],
    inyeccion: { fetch: fetchDeYoutube({ videos: 2 }) }
  });

  delete process.env.YOUTUBE_API_KEY;

  const l = r.lotes.find((x2) => x2.providerId === "youtube_data");

  return l.unidadesConsumidas === yt.COSTE_UNIDADES.search;
});


/* =========================================================
   3. CONSTRUCCIÓN DE LA CONSULTA
   ========================================================= */

console.log("\n--- Consulta ---\n");

await ta("X pide search/recent con la expansión de autores", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const fx = fetchDeX();

  await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["x_api"],
    inyeccion: { fetch: fx }
  });

  delete process.env.X_BEARER_TOKEN;

  const u = fx.urls[0];

  return (
    /\/2\/tweets\/search\/recent/.test(u) &&
    /expansions=author_id/.test(u) &&
    /user\.fields=username/.test(u)
  );
});

await ta("la expansión de autores es OPT-IN: por defecto NO se pide", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const urls = [];

  await x.buscarMenciones("Cuenca", {
    fetch: async (u) => {
      urls.push(String(u));

      return respuestaJson({ data: [] });
    }
  });

  delete process.env.X_BEARER_TOKEN;

  return urls.length === 1 && !/expansions=/.test(urls[0]);
});

await ta("YouTube pide el endpoint de búsqueda acotado a la ventana", async () => {
  process.env.YOUTUBE_API_KEY = "PRUEBA";

  const fy = fetchDeYoutube();

  await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    ventana: { desde: "2026-09-01T05:00:00.000Z", hasta: AHORA },
    habilitados: ["youtube_data"],
    inyeccion: { fetch: fy }
  });

  delete process.env.YOUTUBE_API_KEY;

  const u = fy.urls[0];

  return /youtube\/v3\/search/.test(u) && /publishedAfter=/.test(u) && /type=video/.test(u);
});

t("la clave NUNCA aparece en la etiqueta de la consulta", () => {
  /*
    `queryLabel` viaja con cada evidencia y acaba en la interfaz.
    Si la clave se colase ahi, quedaria persistida en el libro.
  */
  return !/key=|Bearer/.test(JSON.stringify(PLAN));
});


/* =========================================================
   4. LA CONSULTA NO DEMUESTRA GEOGRAFÍA
   ========================================================= */

console.log("\n--- La consulta no es prueba de territorio ---\n");

const FICHAS = [
  {
    sourceId: "elmercurio.com.ec",
    dominio: "elmercurio.com.ec",
    nombre: "El Mercurio",
    tipo: "medio_local",
    territorioDeclarado: CUENCA,
    estadoVerificacion: "VERIFICADO_FEED",
    feeds: [{ url: "u", conContenido: true }]
  }
];

const INDICE = indiceDeAmbito(FICHAS);

t("una pieza de X buscada con «Cuenca» NO es territorio explícito por eso", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "x:a1", sourceId: "x:a1" },
    ubicacion: null,
    indice: INDICE
  });

  return c.alcance === ALCANCES.TERRITORIO_NO_RESOLUBLE && c.territorioAtribuible === false;
});

t("un vídeo de YouTube buscado con «Cuenca» tampoco", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "youtube:c0", sourceId: "youtube:c0" },
    ubicacion: null,
    indice: INDICE
  });

  return c.territorioAtribuible === false;
});

t("solo el resolutor sobre el texto atribuye territorio", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "x:a1" },
    ubicacion: { unidadId: CUENCA, nivel: "canton", razones: ["topónimo «Cuenca» (+40)"] },
    indice: INDICE
  });

  return c.alcance === ALCANCES.TERRITORIO_EXPLICITO && c.razones.length > 0;
});

await ta("la procedencia de la consulta viaja aparte del territorio", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const r = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["x_api"],
    inyeccion: { fetch: fetchDeX({ posts: 1 }) }
  });

  delete process.env.X_BEARER_TOKEN;

  const e = r.evidencias[0];

  /* La etiqueta de consulta consta; el territorio NO se afirma. */
  return Boolean(e) && e.territoryId === undefined && !("unidadId" in e);
});


/* =========================================================
   5. ACTORES Y DEDUP
   ========================================================= */

console.log("\n--- Actores y dedup ---\n");

await ta("cada post queda atribuido a SU cuenta, no a la plataforma", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const r = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["x_api"],
    inyeccion: { fetch: fetchDeX({ posts: 2 }) }
  });

  delete process.env.X_BEARER_TOKEN;

  return (
    r.evidencias.length === 2 &&
    r.evidencias.every((e) => /^x:a\d$/.test(e.sourceId)) &&
    new Set(r.evidencias.map((e) => e.sourceId)).size === 2 &&
    r.evidencias.every((e) => e.publisher)
  );
});

await ta("sin la expansión, el post NO se atribuye a una cuenta inventada", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const r = await x.buscarMenciones("Cuenca", {
    fetch: fetchDeX({ posts: 1, conUsuarios: false }),
    expandirAutores: true
  });

  delete process.env.X_BEARER_TOKEN;

  /* La respuesta no trae `includes`: el emisor queda sin resolver. */
  return r.evidencias.length === 1 && r.evidencias[0].sourceId === "x.com";
});

await ta("las cuentas descubiertas entran como actores del proyecto", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const r = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["x_api"],
    inyeccion: { fetch: fetchDeX({ posts: 2 }) }
  });

  delete process.env.X_BEARER_TOKEN;

  const ledger = crearLedgerMemoria();

  const p = await registrarPasada({
    ledger,
    evidencias: r.evidencias,
    estadoPrevio: new Map(),
    retrievedAt: AHORA,
    projectId: "proy-a"
  });

  const corpus = [...reconstruirEstado(await ledger.leerTodos(), { projectId: "proy-a" }).values()];

  const u = construirUniversoDeActores({ corpus, fichas: FICHAS, projectId: "proy-a" });

  return (
    p.metricas.nuevasParaSentinel === 2 &&
    u.actores.length === 2 &&
    u.metricas.plataformas.includes("x") &&
    u.actores.every((a) => a.certeza === "DESCUBIERTO")
  );
});

await ta("una cuenta descubierta NO se marca comprobada automáticamente", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const r = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["x_api"],
    inyeccion: { fetch: fetchDeX({ posts: 1 }) }
  });

  delete process.env.X_BEARER_TOKEN;

  const u = construirUniversoDeActores({
    corpus: r.evidencias.map((e) => ({ ...e, evidenceId: e.evidenceId || "e1" })),
    fichas: FICHAS
  });

  return u.metricas.verificadosPorAnalista === 0 && u.actores[0].certeza === "DESCUBIERTO";
});

await ta("el mismo post en dos pasadas NO se cuenta dos veces", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const uno = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["x_api"],
    inyeccion: { fetch: fetchDeX({ posts: 2 }) }
  });

  const dos = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: "2026-09-01T20:00:00.000Z",
    habilitados: ["x_api"],
    inyeccion: { fetch: fetchDeX({ posts: 2 }) }
  });

  delete process.env.X_BEARER_TOKEN;

  const ledger = crearLedgerMemoria();

  const p1 = await registrarPasada({
    ledger,
    evidencias: uno.evidencias,
    estadoPrevio: new Map(),
    retrievedAt: AHORA,
    projectId: "proy-a"
  });

  const p2 = await registrarPasada({
    ledger,
    evidencias: dos.evidencias,
    estadoPrevio: new Map(p1.evidencias.map((e) => [e.evidenceId, e])),
    retrievedAt: "2026-09-01T20:00:00.000Z",
    projectId: "proy-a"
  });

  return p2.metricas.nuevasParaSentinel === 0 && p2.metricas.yaConocidas === 2;
});

await ta("un vídeo de YouTube conserva su canal y su URL canónica", async () => {
  process.env.YOUTUBE_API_KEY = "PRUEBA";

  const r = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["youtube_data"],
    inyeccion: { fetch: fetchDeYoutube({ videos: 3 }) }
  });

  delete process.env.YOUTUBE_API_KEY;

  const l = r.lotes.find((z) => z.providerId === "youtube_data");

  return (
    r.evidencias.length === 3 &&
    r.evidencias.every((e) => e.url && /youtube/.test(String(e.sourceId))) &&
    l.canalesDetectados === 2
  );
});


/* =========================================================
   6. VENTANA DEL PROVEEDOR
   ========================================================= */

console.log("\n--- Ventana y frescura ---\n");

await ta("el lote de X declara que su ventana son 7 días", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const r = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["x_api"],
    inyeccion: { fetch: fetchDeX({ posts: 1 }) }
  });

  delete process.env.X_BEARER_TOKEN;

  return r.lotes.find((l) => l.providerId === "x_api").ventanaDelProveedor === "7d";
});

await ta("cero resultados con credencial NO es lo mismo que sin credencial", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const conClave = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["x_api"],
    inyeccion: { fetch: fetchDeX({ posts: 0 }) }
  });

  delete process.env.X_BEARER_TOKEN;

  const sinClave = await recolectarAmpliado({
    plan: PLAN,
    feeds: [],
    observedAt: AHORA,
    habilitados: ["x_api"]
  });

  const a = conClave.lotes.find((l) => l.providerId === "x_api");

  const b = sinClave.lotes.find((l) => l.providerId === "x_api");

  return a.estado === "OK" && b.estado === "SIN_CREDENCIAL" && a.estado !== b.estado;
});

t("el inventario de adapters declara X con su variable y su estado", () => {
  const e = estadoAdapters();

  const ax = e.find((a) => a.providerId === "x_api");

  return (
    Boolean(ax) &&
    ax.requiereCredencial === true &&
    ax.variableEntorno === "X_BEARER_TOKEN" &&
    ax.presupuestoPorPasada === 1
  );
});


/* =========================================================
   6-bis. AMBIGÜEDAD DEL TOPÓNIMO
   TERRITORIAL-SOCIAL-BENCHMARK-01
   ========================================================= */

console.log("\n--- Ambigüedad de «cuenca» ---\n");

t("«cuenca» se reconoce como término ambiguo; «azuay» no", () =>
  esTerminoAmbiguo("cuenca") &&
  esTerminoAmbiguo("Cuenca") &&
  esTerminoAmbiguo("Baños") &&
  !esTerminoAmbiguo("azuay") &&
  !esTerminoAmbiguo("tomebamba"));

t("una atribución que descansa SOLO en «cuenca» se marca frágil", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "x:1", summary: "El problema del agua en La Habana y la cuenca sur" },
    ubicacion: {
      unidadId: CUENCA,
      razones: ['toponimo "Cuenca" presente en el texto (+40)']
    },
    indice: INDICE
  });

  return (
    c.senalAmbigua === true &&
    c.corroboradoPorOtroAnclaje === false &&
    /SOLO en un término/i.test(c.advertenciaAmbiguedad || "")
  );
});

t("con un segundo anclaje del territorio, la atribución NO se marca frágil", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "x:2", summary: "Concejales de Cuenca, Azuay, fiscalizan el tranvía" },
    ubicacion: {
      unidadId: CUENCA,
      razones: ['toponimo "Cuenca" presente en el texto (+40)']
    },
    indice: INDICE
  });

  return c.senalAmbigua === true && c.corroboradoPorOtroAnclaje === true && !c.advertenciaAmbiguedad;
});

t("un topónimo NO ambiguo no dispara la advertencia", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "x:3", summary: "Obras en Machángara" },
    ubicacion: {
      unidadId: CUENCA,
      razones: ['toponimo "Machángara" presente en el texto (+40)']
    },
    indice: INDICE
  });

  return c.senalAmbigua === false && !c.advertenciaAmbiguedad;
});

t("la atribución NO se revierte: marcarla no es descartarla", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "x:1", summary: "cuenca hidrográfica del Jujuy" },
    ubicacion: { unidadId: CUENCA, razones: ['toponimo "Cuenca" presente en el texto (+40)'] },
    indice: INDICE
  });

  /*
    Se mantiene atribuible a proposito: la regla evidente
    —exigir corroboracion— rechazaba tambien contenido genuino
    de Cuenca. Se declara la fragilidad y se deja la decision a
    un gate de desambiguacion.
  */
  return c.alcance === ALCANCES.TERRITORIO_EXPLICITO && c.territorioAtribuible === true;
});

t("el resumen cuenta aparte las atribuciones frágiles", () => {
  const fragil = clasificarAlcance({
    evidencia: { domain: "x:1", summary: "la cuenca del rio en Pucon" },
    ubicacion: { unidadId: CUENCA, razones: ['toponimo "Cuenca" presente en el texto (+40)'] },
    indice: INDICE
  });

  const solida = clasificarAlcance({
    evidencia: { domain: "x:2", summary: "Cuenca, Azuay: nuevo tranvia" },
    ubicacion: { unidadId: CUENCA, razones: ['toponimo "Cuenca" presente en el texto (+40)'] },
    indice: INDICE
  });

  const r = resumirAlcance([fragil, solida]);

  return (
    r.atribuidasSoloPorTerminoAmbiguo === 1 &&
    r.atribuiblesAlTerritorio === 2 &&
    r.declaraciones.some((d) => /t[eé]rmino ambiguo/i.test(d))
  );
});


/* =========================================================
   7. PRIVACIDAD
   ========================================================= */

console.log("\n--- Privacidad ---\n");

await ta("de una cuenta pública se guarda lo mínimo: handle y nombre", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const r = await x.buscarMenciones("Cuenca", {
    fetch: fetchDeX({ posts: 1 }),
    expandirAutores: true
  });

  delete process.env.X_BEARER_TOKEN;

  const json = JSON.stringify(r.evidencias[0]);

  return (
    !/followers|seguidores|email|correo|location|ubicacion|bio|descripcion_perfil/i.test(json) &&
    /cuenta0/.test(json)
  );
});

t("la expansión pide solo username y name, no el perfil completo", async () => {
  process.env.X_BEARER_TOKEN = "PRUEBA";

  const urls = [];

  await x.buscarMenciones("Cuenca", {
    fetch: async (u) => {
      urls.push(String(u));

      return respuestaJson({ data: [] });
    },
    expandirAutores: true
  });

  delete process.env.X_BEARER_TOKEN;

  return (
    /user\.fields=username,name/.test(urls[0]) &&
    !/public_metrics|location|description/.test(urls[0].split("user.fields=")[1] || "")
  );
});


/* =========================================================
   8. SIN RED
   ========================================================= */

console.log("\n--- Sin red ---\n");

t("cero llamadas al fetch global", () => llamadasDeRed === 0);

globalThis.fetch = fetchOriginal;


/* --------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
