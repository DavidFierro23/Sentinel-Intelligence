// apps/backend/tests/ingest-real.test.mjs

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  normalizarEvidencia,
  evidenciaValida,
  resolverCanonical,
  huellaDeEvidencia,
  POLITICAS_ALMACENAMIENTO,
  TIPOS_CONTENIDO
} from "../services/ingest/evidenceContract.js";

import {
  deduplicarMultifuente,
  CRITERIOS
} from "../services/ingest/crossProviderDedup.js";

import {
  crearRegistroMedios,
  registrarMedio,
  anotarComprobacionDeFeed,
  marcarSinRss,
  listarMedios,
  estadoRegistroMedios,
  ESTADOS_MEDIO,
  TIPOS_MEDIO
} from "../services/ingest/mediaSourceRegistry.js";

import {
  crearUniverso,
  registrarFuente,
  estadoUniverso,
  ESTADOS_SOURCE,
  ORIGENES_SOURCE,
  TIPOS_SOURCE
} from "../services/conversation/sourceUniverse.js";

import {
  iniciarRun,
  ingerir,
  cerrarRun,
  anotarProveedor,
  ESTADOS_RUN
} from "../services/ingest/ingestOrchestrator.js";

import {
  extraerFeedsDeclarados,
  normalizarEntradaDeFeed,
  leerFeed,
  ESTADOS_FEED
} from "../services/ingest/adapters/rssAdapter.js";

import youtubeAdapter, {
  normalizarVideo,
  normalizarCanal,
  buscar as buscarYoutube,
  COSTE_UNIDADES
} from "../services/ingest/adapters/youtubeAdapter.js";

import gdeltAdapter, {
  normalizarArticulo,
  fechaGdeltAIso,
  fichaEvaluacion
} from "../services/ingest/adapters/gdeltAdapter.js";

import rssAdapter from "../services/ingest/adapters/rssAdapter.js";

import braveProvider from "../services/providers/braveProvider.js";

import { PLATAFORMAS as PLATAFORMAS_SOCIALES } from "../services/contracts/socialPlatformFeasibility.js";

import { matrizProveedores } from "../services/providers/providerAudit.js";

import {
  crearJob,
  anotarEjecucion,
  detectarHuecos,
  estadoScheduler,
  FRECUENCIAS,
  ESTADOS_JOB
} from "../services/ingest/collectorScheduler.js";

import { componerCobertura, ESTADOS_COBERTURA } from "../services/ingest/coverageObservability.js";

import {
  componerSnapshot,
  crearAlmacenMemoria,
  guardarSnapshot
} from "../services/territorial/snapshotStore.js";

import {
  evaluarVentana,
  evaluarTodasLasVentanas,
  ESTADOS_VENTANA
} from "../services/territorial/temporalWindows.js";

import { estadoBenchmark, costoPorEvidenciaUtil } from "../services/contracts/providerBenchmark.js";

import { LINEA_BASE, fichaComparacion, comparar } from "../services/contracts/ingestBenchmark.js";

import { estadoViabilidadSocial } from "../services/contracts/socialPlatformFeasibility.js";

import { registroConductaDigital, DIGITAL_BEHAVIOR } from "../services/contracts/futureLayers.js";

import { comprobarGeo1 } from "../services/geo/geoContracts.js";

import { planificarConsultasAbiertas, TIPOS_CONSULTA } from "../services/conversation/queryPlanner.js";

/*
===========================================================
PRUEBAS DE INGEST-REAL-01
===========================================================

    node tests/ingest-real.test.mjs

SIN RED Y SIN CUOTA. Ningun adapter se invoca contra su API
real: los que necesitan respuesta usan un `fetch` inyectado con
un fixture, y los que no la necesitan se prueban sobre sus
funciones puras.

Los 32 casos exigidos, mas los que hicieron falta para
demostrar lo que el gate promete.
===========================================================
*/

let pass = 0;

let fail = 0;

const fallos = [];

function t(nombre, comprobacion) {
  try {
    const r = comprobacion();

    if (r) {
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
    const r = await comprobacion();

    if (r) {
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

function bloque(titulo) {
  console.log(`\n${titulo}`);
}


const AHORA = "2026-08-25T12:00:00Z";


/* ===========================================================
   [I-1] SOURCE UNIVERSE
   =========================================================== */

bloque("[I-1] SOURCE UNIVERSE");

t("T1 · el universo deduplica por sourceId", () => {
  const u = crearUniverso();

  registrarFuente(u, { dominio: "elmercurio.com.ec", origen: ORIGENES_SOURCE.EVIDENCIA });
  registrarFuente(u, { dominio: "elmercurio.com.ec", origen: ORIGENES_SOURCE.CATALOGO });
  registrarFuente(u, { dominio: "elmercurio.com.ec", origen: ORIGENES_SOURCE.EVIDENCIA });

  const f = u.fuentes.get("elmercurio.com.ec");

  return u.fuentes.size === 1 && f.frecuenciaObservada === 3 && f.procedencia.length === 2;
});

t("T2 · una PLATAFORMA no es un emisor", () => {
  const u = crearUniverso();

  const plataforma = registrarFuente(u, {
    dominio: "youtube.com",
    origen: ORIGENES_SOURCE.EVIDENCIA
  });

  const canal = registrarFuente(u, {
    id: "youtube:UC_abc",
    nombre: "Canal Cuenca",
    tipo: TIPOS_SOURCE.CREATOR,
    plataforma: "YouTube",
    origen: ORIGENES_SOURCE.EVIDENCIA
  });

  return (
    plataforma.tipo === TIPOS_SOURCE.PLATFORM &&
    plataforma.esPlataforma === true &&
    canal.tipo === TIPOS_SOURCE.CREATOR &&
    canal.esPlataforma === false
  );
});

t("T2b · el estado del universo cuenta emisores aparte de plataformas", () => {
  const u = crearUniverso();

  registrarFuente(u, { dominio: "youtube.com", origen: ORIGENES_SOURCE.EVIDENCIA });
  registrarFuente(u, { dominio: "elmercurio.com.ec", origen: ORIGENES_SOURCE.EVIDENCIA });

  const e = estadoUniverso(u);

  return e.fuentes === 2 && e.plataformas === 1 && e.emisores === 1;
});

t("los campos nuevos de INGEST-REAL-01 existen y se acumulan", () => {
  const u = crearUniverso();

  registrarFuente(u, {
    dominio: "radio.example",
    origen: ORIGENES_SOURCE.EVIDENCIA,
    subtipo: "RADIO",
    website: "https://radio.example",
    feedUrls: [{ url: "https://radio.example/feed", origen: "declarado_por_el_sitio" }],
    socialUrls: ["https://x.com/radio"],
    provider: "rss_directo",
    checkedAt: AHORA
  });

  registrarFuente(u, {
    dominio: "radio.example",
    origen: ORIGENES_SOURCE.EVIDENCIA,
    provider: "gdelt_doc"
  });

  const f = u.fuentes.get("radio.example");

  return (
    f.subtipo === "RADIO" &&
    f.feedUrls.length === 1 &&
    f.socialUrls[0].verificada === false &&
    f.proveedoresHistoricos.length === 2 &&
    f.ultimaComprobacion === AHORA
  );
});

t("un territoryClaim declarado NO se copia a `territorio`", () => {
  const u = crearUniverso();

  const f = registrarFuente(u, {
    id: "youtube:UC_x",
    origen: ORIGENES_SOURCE.EVIDENCIA,
    territoryClaim: { valor: "EC" }
  });

  return (
    f.territoryClaim.declarado === true &&
    f.territoryClaim.verificado === false &&
    f.territorio === null
  );
});


/* ===========================================================
   [I-2] MEDIA REGISTRY
   =========================================================== */

bloque("[I-2] MEDIA REGISTRY");

const REG = crearRegistroMedios();

t("T3 · el registro de medios acumula sin duplicar", () => {
  registrarMedio(REG, {
    dominio: "elmercurio.com.ec",
    nombre: "El Mercurio",
    tipoMedio: TIPOS_MEDIO.PRENSA,
    origen: ORIGENES_SOURCE.CATALOGO,
    instante: "2026-08-20T10:00:00Z"
  });

  registrarMedio(REG, {
    dominio: "elmercurio.com.ec",
    rssFeeds: [{ url: "https://elmercurio.com.ec/feed", origen: "declarado_por_el_sitio" }],
    origen: ORIGENES_SOURCE.DESCUBRIMIENTO_WEB,
    instante: "2026-08-22T10:00:00Z"
  });

  const m = REG.medios.get("elmercurio.com.ec");

  return (
    REG.medios.size === 1 &&
    m.nombre === "El Mercurio" &&
    m.rssFeeds.length === 1 &&
    m.procedencia.length === 2 &&
    m.firstSeenAt === "2026-08-20T10:00:00Z" &&
    m.lastSeenAt === "2026-08-22T10:00:00Z"
  );
});

t("lastCheckedAt es distinto de lastSeenAt", () => {
  const m = REG.medios.get("elmercurio.com.ec");

  registrarMedio(REG, { dominio: "elmercurio.com.ec", checkedAt: AHORA, cuentaObservacion: false });

  const despues = REG.medios.get("elmercurio.com.ec");

  return despues.lastCheckedAt === AHORA && despues.lastSeenAt !== AHORA && m.observaciones === despues.observaciones;
});

t("T6 · un medio sin feed queda SIN_RSS, no INACCESIBLE", () => {
  registrarMedio(REG, { dominio: "radiosinfeed.example", origen: ORIGENES_SOURCE.EVIDENCIA });

  const m = marcarSinRss(REG, "radiosinfeed.example", { checkedAt: AHORA });

  return (
    m.estado === ESTADOS_MEDIO.SIN_RSS &&
    /no declara feed/i.test(m.metadata.motivoSinRss) &&
    /no se prueban rutas|no se sustituye por raspado/i.test(m.metadata.motivoSinRss)
  );
});

t("un feed que falla deja el medio INACCESIBLE, que es otra cosa", () => {
  registrarMedio(REG, {
    dominio: "confeedroto.example",
    rssFeeds: ["https://confeedroto.example/rss"],
    origen: ORIGENES_SOURCE.EVIDENCIA
  });

  const m = anotarComprobacionDeFeed(REG, "confeedroto.example", {
    feedUrl: "https://confeedroto.example/rss",
    estado: ESTADOS_FEED.INACCESIBLE,
    error: "timeout",
    checkedAt: AHORA
  });

  return (
    m.estado === ESTADOS_MEDIO.INACCESIBLE &&
    m.errores.length === 1 &&
    m.rssFeeds[0].ultimoError === "timeout"
  );
});

t("el estado del registro declara la diferencia entre mirar y publicar", () => {
  const e = estadoRegistroMedios(REG);

  return (
    e.declaraciones.some((d) => /no hemos mirado.*no ha publicado/i.test(d)) &&
    e.declaraciones.some((d) => /No se calcula influencia/i.test(d)) &&
    e.sinLicenciaComprobada === e.medios
  );
});

t("una cuenta social no se verifica por aparecer", () => {
  registrarMedio(REG, {
    dominio: "consocial.example",
    socialAccounts: [{ url: "https://x.com/medio", platform: "X" }],
    origen: ORIGENES_SOURCE.EVIDENCIA
  });

  return REG.medios.get("consocial.example").socialAccounts[0].verificada === false;
});


/* ===========================================================
   [I-3] RSS
   =========================================================== */

bloque("[I-3] RSS / ATOM");

const HTML_CON_FEED = `
<html><head>
  <link rel="alternate" type="application/rss+xml" title="Portada" href="/rss/portada.xml">
  <link rel="alternate" type="application/atom+xml" href="https://otro.example/atom">
  <link rel="alternate" type="text/html" href="/version-movil">
</head><body></body></html>`;

t("solo entran feeds DECLARADOS, y con su tipo", () => {
  const feeds = extraerFeedsDeclarados(HTML_CON_FEED, "https://medio.example/");

  return (
    feeds.length === 2 &&
    feeds[0].url === "https://medio.example/rss/portada.xml" &&
    feeds[0].origen === "declarado_por_el_sitio" &&
    feeds.every((f) => f.tipo !== "text/html")
  );
});

t("un sitio sin <link alternate> no produce feeds inventados", () => {
  return extraerFeedsDeclarados("<html><head></head></html>", "https://x.example/").length === 0;
});

t("T4 · una entrada RSS se normaliza al contrato común", () => {
  const ev = normalizarEntradaDeFeed(
    {
      title: "Cortes de agua en Yanuncay",
      link: "https://elmercurio.com.ec/2026/08/25/cortes-agua?utm_source=rss",
      guid: "https://elmercurio.com.ec/2026/08/25/cortes-agua",
      contentSnippet: "ETAPA anunció cortes programados.",
      isoDate: "2026-08-25T08:00:00.000Z",
      creator: "Redacción"
    },
    { publisher: "El Mercurio", observedAt: AHORA }
  );

  return (
    ev.title === "Cortes de agua en Yanuncay" &&
    ev.publisher === "El Mercurio" &&
    ev.author === "Redacción" &&
    ev.providerId === "rss_directo" &&
    ev.contentType === TIPOS_CONTENIDO.NOTICIA &&
    /^ev-/.test(ev.evidenceId)
  );
});

t("T4b · el guid del feed manda como canónica sobre el link con UTM", () => {
  const ev = normalizarEntradaDeFeed(
    {
      title: "X",
      link: "https://m.example/nota?utm_campaign=rss",
      guid: "https://m.example/nota"
    },
    {}
  );

  return (
    ev.canonicalUrl === "m.example/nota" &&
    ev.origenCanonical === "declarada_por_el_documento"
  );
});

t("T5 · una entrada ATOM se normaliza igual", () => {
  const ev = normalizarEntradaDeFeed(
    {
      title: "Sesión del concejo cantonal",
      id: "tag:medio.example,2026:1",
      link: "https://medio.example/atom-1",
      summary: "Resumen atom.",
      published: "2026-08-24T10:00:00Z"
    },
    { publisher: "Medio Atom" }
  );

  return (
    ev.title === "Sesión del concejo cantonal" &&
    ev.snippet === "Resumen atom." &&
    ev.publishedAt === "2026-08-24T10:00:00Z" &&
    ev.publisher === "Medio Atom"
  );
});

await ta("un feed vacío se distingue de un feed caído", async () => {
  const vacio = await leerFeed("https://x.example/f", { parseURL: async () => ({ items: [] }) });

  const roto = await leerFeed("https://x.example/f", {
    parseURL: async () => {
      throw new Error("connect ETIMEDOUT");
    }
  });

  return (
    vacio.estado === ESTADOS_FEED.VACIO &&
    /Vac[íi]o NO es silencio/i.test(vacio.aviso) &&
    roto.estado === ESTADOS_FEED.INACCESIBLE &&
    /no es ausencia de publicaciones/i.test(roto.declaracion)
  );
});

await ta("un feed malformado no se confunde con uno inaccesible", async () => {
  const r = await leerFeed("https://x.example/f", {
    parseURL: async () => {
      throw new Error("Unexpected close tag: not a feed");
    }
  });

  return r.estado === ESTADOS_FEED.MALFORMADO;
});

t("el RSS declara que NO adivina rutas", () => {
  const d = rssAdapter.diagnostico();

  return (
    d.costoPorConsulta === 0 &&
    d.limitaciones.some((l) => /no adivina rutas|No adivina/i.test(l))
  );
});


/* ===========================================================
   [I-4] BRAVE
   =========================================================== */

bloque("[I-4] BRAVE");

await ta("T7 · Brave sin credencial no bloquea y lo declara", async () => {
  const previa = process.env.BRAVE_API_KEY;

  delete process.env.BRAVE_API_KEY;

  const configurado = braveProvider.estaConfigurado();

  const d = braveProvider.diagnostico();

  if (previa !== undefined) process.env.BRAVE_API_KEY = previa;

  return configurado === false && d && typeof d === "object";
});

t("T8 · Brave aparece en la matriz como bloqueado por credencial, no como integrado", () => {
  const previa = process.env.BRAVE_API_KEY;

  delete process.env.BRAVE_API_KEY;

  const m = matrizProveedores({});

  if (previa !== undefined) process.env.BRAVE_API_KEY = previa;

  const brave = m.filas.find((f) => f.provider === "brave_web");

  return (
    brave.implementado === true &&
    brave.requiereCredencial === true &&
    brave.credencial === "ausente" &&
    m.resumen.bloqueadosPorCredencial.some((b) => b.provider === "brave_web" && b.variable === "BRAVE_API_KEY")
  );
});

t("un proveedor SIN credencial no cuenta como integrado", () => {
  const previa = process.env.BRAVE_API_KEY;

  delete process.env.BRAVE_API_KEY;

  const m = matrizProveedores({});

  if (previa !== undefined) process.env.BRAVE_API_KEY = previa;

  return m.resumen.integrados < m.resumen.implementados;
});


/* ===========================================================
   [I-5] YOUTUBE
   =========================================================== */

bloque("[I-5] YOUTUBE");

const FIXTURE_YT = {
  items: [
    {
      id: { videoId: "abc123" },
      snippet: {
        title: "Recorrido por el centro de Cuenca",
        description: "Un paseo por el casco histórico.",
        publishedAt: "2026-08-24T15:00:00Z",
        channelId: "UC_canal_uno",
        channelTitle: "Cuenca en Video",
        thumbnails: { default: { url: "https://i.ytimg.com/x.jpg", width: 120, height: 90 } }
      }
    },
    {
      id: { videoId: "def456" },
      snippet: {
        title: "Elecciones seccionales en Azuay",
        description: "Análisis local.",
        publishedAt: "2026-08-23T09:00:00Z",
        channelId: "UC_canal_dos",
        channelTitle: "Azuay Informa",
        thumbnails: {}
      }
    }
  ]
};

await ta("T9 · YouTube sin credencial devuelve SIN_CREDENCIAL y no rompe nada", async () => {
  const previa = process.env.YOUTUBE_API_KEY;

  delete process.env.YOUTUBE_API_KEY;

  const r = await buscarYoutube("Cuenca Azuay");

  if (previa !== undefined) process.env.YOUTUBE_API_KEY = previa;

  return (
    r.estado === "SIN_CREDENCIAL" &&
    r.evidencias.length === 0 &&
    r.unidadesConsumidas === 0 &&
    /no se puede afirmar ausencia/i.test(r.declaracion)
  );
});

t("T10 · un vídeo resuelve PLATAFORMA y EMISOR por separado", () => {
  const ev = normalizarVideo(FIXTURE_YT.items[0], { observedAt: AHORA });

  return (
    ev.platform === "YouTube" &&
    ev.publisher === "Cuenca en Video" &&
    ev.sourceId === "youtube:UC_canal_uno" &&
    ev.sourceId !== "youtube.com" &&
    ev.youtube.channelId === "UC_canal_uno" &&
    ev.contentType === TIPOS_CONTENIDO.VIDEO
  );
});

await ta("T10b · dos vídeos de canales distintos dan DOS emisores, no una plataforma", async () => {
  const r = await buscarYoutube("Cuenca", {
    fetch: async () => ({ ok: true, status: 200, json: async () => FIXTURE_YT })
  });

  const previa = process.env.YOUTUBE_API_KEY;

  process.env.YOUTUBE_API_KEY = "fixture";

  const r2 = await buscarYoutube("Cuenca", {
    fetch: async () => ({ ok: true, status: 200, json: async () => FIXTURE_YT })
  });

  if (previa === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = previa;

  void r;

  return (
    r2.estado === "OK" &&
    r2.canalesDetectados.length === 2 &&
    new Set(r2.evidencias.map((e) => e.sourceId)).size === 2 &&
    r2.unidadesConsumidas === COSTE_UNIDADES.search
  );
});

t("el país del canal es una DECLARACIÓN, no una localización", () => {
  const c = normalizarCanal({
    id: "UC_x",
    snippet: { title: "Canal", country: "EC" },
    statistics: { subscriberCount: "50000" }
  });

  return (
    c.territoryClaim.declarado === true &&
    c.territoryClaim.verificado === false &&
    /NO es una localización comprobada/i.test(c.territoryClaim.aviso) &&
    c.verificationStatus === "NO_VERIFICADO"
  );
});

t("los suscriptores se leen pero NO clasifican", () => {
  const c = normalizarCanal({
    id: "UC_y",
    snippet: { title: "Canal grande" },
    statistics: { subscriberCount: "900000" }
  });

  return (
    c.estadisticasPublicas.suscriptores === 900000 &&
    /no existe un umbral defendible/i.test(c.estadisticasPublicas.declaracion) &&
    !/influencer/i.test(JSON.stringify({ ...c, estadisticasPublicas: { s: c.estadisticasPublicas.suscriptores } }))
  );
});

t("el coste de YouTube es de CUOTA, y se declara", () => {
  const d = youtubeAdapter.diagnostico();

  return (
    COSTE_UNIDADES.search === 100 &&
    /100 búsquedas agotan el día|100 unidades/i.test(d.cuotaDeclarada) &&
    d.limitaciones.some((l) => /No se leen comentarios/i.test(l))
  );
});


/* ===========================================================
   [I-6] GDELT
   =========================================================== */

bloque("[I-6] GDELT");

t("T11 · la fecha de GDELT se convierte a ISO", () => {
  return (
    fechaGdeltAIso("20260825T143000Z") === "2026-08-25T14:30:00Z" &&
    fechaGdeltAIso("basura") === null
  );
});

t("T11b · un artículo de GDELT trae el dominio SIN rescatarlo del titular", () => {
  const ev = normalizarArticulo(
    {
      url: "https://elmercurio.com.ec/nota-1",
      title: "Concejo aprueba ordenanza",
      domain: "elmercurio.com.ec",
      seendate: "20260825T100000Z",
      language: "Spanish",
      sourcecountry: "Ecuador"
    },
    { observedAt: AHORA }
  );

  return (
    ev.publisher === "elmercurio.com.ec" &&
    ev.publishedAt === "2026-08-25T10:00:00Z" &&
    ev.snippet === null &&
    ev.politicaAlmacenamiento === POLITICAS_ALMACENAMIENTO.SOLO_REFERENCIA
  );
});

await ta("GDELT respondiendo HTML con 200 NO se lee como cero resultados", async () => {
  const r = await gdeltAdapter.buscar("x", {
    fetch: async () => ({ ok: true, status: 200, text: async () => "<html>error</html>" })
  });

  return r.estado === "RESPUESTA_NO_JSON" && /NO es «cero resultados»/i.test(r.motivo);
});

await ta("GDELT mide su propia cobertura local", async () => {
  const r = await gdeltAdapter.buscar("Cuenca Azuay", {
    dominiosLocales: ["elmercurio.com.ec"],
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          articles: [
            { url: "https://elmercurio.com.ec/a", title: "A", domain: "elmercurio.com.ec", seendate: "20260825T100000Z" },
            { url: "https://eluniverso.com/b", title: "B", domain: "eluniverso.com", seendate: "20260825T110000Z" }
          ]
        })
    })
  });

  return (
    r.estado === "OK" &&
    r.coberturaObservada.deMedioLocalDeclarado === 1 &&
    r.coberturaObservada.proporcionLocal === 0.5
  );
});

t("la ficha de GDELT deja la cobertura SIN MEDIR, no en cero", () => {
  const f = fichaEvaluacion();

  return (
    Object.values(f.sinMedir).every((v) => v === null) &&
    /archivo histórico/i.test(f.ventajaUnica) &&
    /fuentesNuevas/i.test(f.comoSeDecide)
  );
});


/* ===========================================================
   [I-7] NORMALIZACION
   =========================================================== */

bloque("[I-7] NORMALIZACIÓN");

t("T12 · toda evidencia entra con el mismo contrato", () => {
  const ev = normalizarEvidencia(
    { titulo: "T", enlace: "https://x.example/a", descripcion: "D", fecha: "2026-08-25" },
    { providerId: "brave_web", query: "Cuenca Azuay", queryType: "QUERY_NEUTRAL", observedAt: AHORA }
  );

  return [
    "evidenceId",
    "sourceId",
    "providerId",
    "platform",
    "publisher",
    "author",
    "url",
    "canonicalUrl",
    "title",
    "snippet",
    "publishedAt",
    "observedAt",
    "language",
    "contentType",
    "territoryHints",
    "entities",
    "hash",
    "provenance",
    "rawMetadataReference"
  ].every((c) => c in ev);
});

t("T13 · la URL canónica limpia parámetros de rastreo", () => {
  const r = resolverCanonical({ url: "https://Medio.Example/Nota/?utm_source=x&id=7" });

  return r.canonicalUrl === "medio.example/nota?id=7" && r.origen === "url_normalizada";
});

t("T13b · una URL de agregador se marca como tal, no como del medio", () => {
  const r = resolverCanonical({ url: "https://news.google.com/rss/articles/abc" });

  return r.origen === "url_de_agregador" && /no identifica al publicador/i.test(r.aviso);
});

t("la huella no depende del instante de observación", () => {
  const a = huellaDeEvidencia({ canonicalUrl: "x.example/a", title: "Título" });

  const b = huellaDeEvidencia({ canonicalUrl: "x.example/a", title: "TÍTULO!" });

  return a === b;
});

t("la política de almacenamiento por defecto es SOLO_REFERENCIA", () => {
  const ev = normalizarEvidencia({ titulo: "T", enlace: "https://x.example/a" }, {});

  return ev.politicaAlmacenamiento === POLITICAS_ALMACENAMIENTO.SOLO_REFERENCIA;
});

t("una evidencia sin título ni enlace se rechaza con motivo", () => {
  const v = evidenciaValida(normalizarEvidencia({}, {}));

  return v.valida === false && v.motivos.length === 2;
});

t("la procedencia del bruto no se pierde", () => {
  const ev = normalizarEvidencia(
    { titulo: "T", enlace: "https://x.example/a", campoRaro: 1 },
    { providerId: "gdelt_doc", query: "q" }
  );

  return (
    ev.rawMetadataReference.claves.includes("campoRaro") &&
    ev.provenance.providerId === "gdelt_doc" &&
    ev.provenance.query === "q"
  );
});


/* ===========================================================
   [I-8] DEDUPLICACION MULTIFUENTE
   =========================================================== */

bloque("[I-8] DEDUPLICACIÓN MULTIFUENTE");

const MISMA_NOTA = [
  normalizarEvidencia(
    { titulo: "ETAPA anuncia cortes de agua en Yanuncay", enlace: "https://elmercurio.com.ec/cortes" },
    { providerId: "rss_directo", observedAt: "2026-08-25T08:00:00Z" }
  ),
  normalizarEvidencia(
    { titulo: "ETAPA anuncia cortes de agua en Yanuncay", enlace: "https://elmercurio.com.ec/cortes?utm_source=news" },
    { providerId: "google_news", observedAt: "2026-08-25T09:00:00Z" }
  ),
  normalizarEvidencia(
    { titulo: "ETAPA anuncia cortes de agua en Yanuncay", enlace: "https://elmercurio.com.ec/cortes", fuenteDeclarada: "El Mercurio" },
    { providerId: "gdelt_doc", observedAt: "2026-08-25T10:00:00Z" }
  )
];

const DEDUP = deduplicarMultifuente(MISMA_NOTA);

t("T14 · la misma nota por tres proveedores es UNA evidencia", () => {
  return DEDUP.unicas.length === 1 && DEDUP.metricas.duplicadosAbsorbidos === 2;
});

t("T16 · se conserva providersSeenBy con los tres", () => {
  const u = DEDUP.unicas[0];

  return (
    u.providersSeenBy.length === 3 &&
    u.providersSeenBy.includes("rss_directo") &&
    u.providersSeenBy.includes("gdelt_doc") &&
    u.sourceObservations.length === 3
  );
});

t("T16b · first y lastObservedAt cubren todas las observaciones", () => {
  const u = DEDUP.unicas[0];

  return (
    u.firstObservedAt === "2026-08-25T08:00:00Z" &&
    u.lastObservedAt === "2026-08-25T10:00:00Z"
  );
});

t("la fusión COMPLETA campos sin pisar los ya afirmados", () => {
  const u = DEDUP.unicas[0];

  return u.publisher === "El Mercurio" && u.criteriosDeFusion.some((c) => /publisher/.test(c));
});

t("T15 · dos medios distintos con el mismo texto NO se funden", () => {
  const r = deduplicarMultifuente([
    normalizarEvidencia(
      { titulo: "Consejo Electoral publica el calendario de seccionales", enlace: "https://eluniverso.com/a" },
      { providerId: "brave_web" }
    ),
    normalizarEvidencia(
      { titulo: "Consejo Electoral publica el calendario de seccionales", enlace: "https://expreso.ec/b" },
      { providerId: "brave_web" }
    )
  ]);

  return (
    r.unicas.length === 2 &&
    r.metricas.sindicadas === 2 &&
    r.traza.some((x) => x.criterio === CRITERIOS.SINDICACION)
  );
});

t("T15b · la sindicación es simétrica", () => {
  const r = deduplicarMultifuente([
    normalizarEvidencia({ titulo: "Un mismo titular de agencia sobre el cantón", enlace: "https://a.example/1" }, {}),
    normalizarEvidencia({ titulo: "Un mismo titular de agencia sobre el cantón", enlace: "https://b.example/2" }, {})
  ]);

  return r.unicas[0].sindicadaCon.length === 1 && r.unicas[1].sindicadaCon.length === 1;
});

t("el aporte NUEVO por proveedor se mide, no el volumen bruto", () => {
  const r = deduplicarMultifuente([
    ...MISMA_NOTA,
    normalizarEvidencia({ titulo: "Nota que solo trae GDELT", enlace: "https://otro.example/z" }, { providerId: "gdelt_doc" })
  ]);

  return (
    r.metricas.porProveedor.gdelt_doc.brutas === 2 &&
    r.metricas.porProveedor.gdelt_doc.nuevas === 1
  );
});

t("las declaraciones distinguen corroboración de duplicado", () => {
  return (
    DEDUP.declaraciones.some((d) => /corroborada cinco veces, no cinco evidencias/i.test(d)) &&
    DEDUP.declaraciones.some((d) => /DOS publicaciones/i.test(d))
  );
});


/* ===========================================================
   [I-9] ORQUESTADOR Y DISCOVERY
   =========================================================== */

bloque("[I-9] ORQUESTADOR Y DISCOVERY DE FUENTES");

const RUN = iniciarRun({
  runId: "run-001",
  territoryId: "ec-azuay-cuenca",
  startedAt: "2026-08-25T11:00:00Z"
});

const UNIVERSO_ING = crearUniverso();

const REG_ING = crearRegistroMedios();

const RESULTADO_ING = ingerir({
  lotes: [
    { providerId: "rss_directo", estado: "OK", recibidas: 3, latenciaMs: 120, evidencias: MISMA_NOTA.slice(0, 1) },
    { providerId: "google_news", estado: "OK", recibidas: 1, latenciaMs: 400, evidencias: MISMA_NOTA.slice(1, 2) },
    { providerId: "youtube_data", estado: "SIN_CREDENCIAL", recibidas: 0, motivo: "falta clave", evidencias: [] },
    {
      providerId: "brave_web",
      estado: "OK",
      recibidas: 1,
      evidencias: [normalizarVideo(FIXTURE_YT.items[0], { observedAt: AHORA })]
    }
  ],
  run: RUN,
  universo: UNIVERSO_ING,
  registroMedios: REG_ING,
  observedAt: AHORA
});

cerrarRun(RUN, { finishedAt: "2026-08-25T11:02:00Z" });

t("T18 · una fuente nueva se descubre desde la evidencia", () => {
  return (
    RESULTADO_ING.nuevasFuentes.length >= 2 &&
    UNIVERSO_ING.fuentes.has("elmercurio.com.ec")
  );
});

t("T18b · toda fuente descubierta entra DESCUBIERTA, nunca verificada", () => {
  return (
    RESULTADO_ING.nuevasFuentes.every((f) => f.estado === "DESCUBIERTA") &&
    [...UNIVERSO_ING.fuentes.values()].every((f) => f.verificada === false)
  );
});

t("T19 · un canal descubierto NO queda verificado", () => {
  const canal = UNIVERSO_ING.fuentes.get("youtube:UC_canal_uno");

  return (
    canal &&
    canal.tipo === TIPOS_SOURCE.CREATOR &&
    canal.verificada === false &&
    canal.estado === ESTADOS_SOURCE.DESCUBIERTA
  );
});

t("las fuentes se cuentan sobre ÚNICAS, no sobre brutas", () => {
  /* La nota llegó por dos proveedores; el medio se observa una vez. */
  return UNIVERSO_ING.fuentes.get("elmercurio.com.ec").frecuenciaObservada === 1;
});

t("un canal de plataforma NO entra en el registro de MEDIOS", () => {
  return !REG_ING.medios.has("youtube.com") && REG_ING.medios.has("elmercurio.com.ec");
});

t("T24 · el run anota el proveedor que falló", () => {
  const sc = RUN.providers.find((p) => p.providerId === "youtube_data");

  return sc.estado === "SIN_CREDENCIAL" && sc.permiteAfirmarAusencia === false && RUN.errors >= 1;
});

t("el coste del run es null si algún proveedor no lo declara", () => {
  return (
    RUN.cost === null &&
    /daría un total falso con aspecto de exacto/i.test(RUN.motivoCosto) &&
    RUN.estado === ESTADOS_RUN.COMPLETADO_CON_ERRORES
  );
});

t("T26 · el coste se declara null cuando se desconoce, no cero", () => {
  const r = iniciarRun({ runId: "r2", territoryId: "t", startedAt: AHORA });

  anotarProveedor(r, { providerId: "serpapi_google", estado: "OK", recibidas: 5 });

  cerrarRun(r, { finishedAt: AHORA });

  return r.cost === null;
});

t("T27 · coste por evidencia útil es null si el coste es null", () => {
  const r = costoPorEvidenciaUtil({ costoTotal: null, resultadosUnicos: 10, relevanciaCuenca: 0.5 });

  return r.valor === null && /no se estima/i.test(r.motivo);
});


/* ===========================================================
   [I-10] SCHEDULER
   =========================================================== */

bloque("[I-10] SCHEDULER");

t("T21 · un job declara todo lo que el contrato exige", () => {
  const j = crearJob({
    jobId: "job-1",
    territoryId: "ec-azuay-cuenca",
    provider: "rss_directo",
    frequency: FRECUENCIAS.CADA_6H,
    creadoEn: AHORA
  });

  return [
    "jobId",
    "projectId",
    "territoryId",
    "provider",
    "frequency",
    "lastRun",
    "nextRun",
    "status",
    "resultCount",
    "errorCount",
    "duration",
    "cost",
    "quota"
  ].every((c) => c in j) && j.status === ESTADOS_JOB.NUNCA_EJECUTADO;
});

t("T21b · una frecuencia por debajo del mínimo del proveedor se ELEVA y se declara", () => {
  const j = crearJob({
    jobId: "job-2",
    territoryId: "t",
    provider: "serpapi_google",
    frequency: FRECUENCIAS.CADA_HORA
  });

  return (
    j.frequency.id === "24h" &&
    j.ajusteDeFrecuencia.pedida === "1h" &&
    /SALDO MENSUAL/i.test(j.ajusteDeFrecuencia.motivo)
  );
});

t("un hueco de ingesta NO es un periodo sin actividad", () => {
  const j = crearJob({ jobId: "job-3", territoryId: "t", provider: "rss_directo", frequency: FRECUENCIAS.CADA_6H });

  anotarEjecucion(j, { startedAt: "2026-08-23T00:00:00Z", finishedAt: "2026-08-23T00:01:00Z", resultCount: 5 });

  const h = detectarHuecos(j, { ahora: "2026-08-25T00:00:00Z" });

  return h.huecos.length > 0 && /sin observación/i.test(h.declaracion);
});

t("el scheduler declara que NO ejecuta nada", () => {
  const e = estadoScheduler([crearJob({ jobId: "j", territoryId: "t", provider: "rss_directo" })]);

  return e.ejecucionContinua === false && e.declaraciones.some((d) => /NO ejecuta ninguno/i.test(d));
});

t("el coste acumulado del job pasa a desconocido si una ejecución no lo declara", () => {
  const j = crearJob({ jobId: "j4", territoryId: "t", provider: "rss_directo" });

  j.cost = 0;

  anotarEjecucion(j, { startedAt: AHORA, finishedAt: AHORA, cost: 1 });

  anotarEjecucion(j, { startedAt: AHORA, finishedAt: AHORA, cost: null });

  return j.cost === null;
});


/* ===========================================================
   [I-11] SNAPSHOTS Y VENTANAS
   =========================================================== */

bloque("[I-11] SNAPSHOTS Y VENTANAS TEMPORALES");

const ALMACEN = crearAlmacenMemoria();

const SNAP1 = componerSnapshot({
  territorio: { unidadId: "ec-azuay-cuenca", nombre: "Cuenca" },
  window: { id: "7d" },
  capturedAt: "2026-08-18T10:00:00Z",
  diversidad: { totalEvidencias: 30, fuentesIndependientes: 6 }
});

const SNAP2 = componerSnapshot({
  territorio: { unidadId: "ec-azuay-cuenca", nombre: "Cuenca" },
  window: { id: "7d" },
  capturedAt: "2026-08-25T10:00:00Z",
  diversidad: { totalEvidencias: 55, fuentesIndependientes: 11 }
});

await guardarSnapshot(ALMACEN, SNAP1);

await guardarSnapshot(ALMACEN, SNAP2);

const GUARDADOS = await ALMACEN.leerTodos();

t("T22 · los snapshots se anexan, no se sobrescriben", () => {
  return GUARDADOS.length === 2 && GUARDADOS[0].snapshotId !== GUARDADOS[1].snapshotId;
});

t("T23 · sin histórico suficiente NO se fabrica comparación", () => {
  const r = evaluarVentana({
    snapshots: GUARDADOS,
    territorioId: "ec-azuay-cuenca",
    ventanaId: "90d",
    ahora: "2026-08-25T12:00:00Z"
  });

  return (
    r.estado === ESTADOS_VENTANA.INSUFICIENTE &&
    r.disponible === false &&
    r.variacion === null &&
    /Faltan aproximadamente/i.test(r.disponibleEn)
  );
});

t("T23b · sin ningún snapshot se declara que el histórico empieza ahora", () => {
  const r = evaluarVentana({
    snapshots: [],
    territorioId: "ec-azuay-cuenca",
    ventanaId: "7d",
    ahora: AHORA
  });

  return (
    r.estado === ESTADOS_VENTANA.SIN_VENTANA &&
    /no se reconstruye|No se reconstruye/i.test(r.declaracion) &&
    /interpolar/i.test(r.declaracion)
  );
});

t("con histórico suficiente sí se compara", () => {
  const r = evaluarVentana({
    snapshots: GUARDADOS,
    territorioId: "ec-azuay-cuenca",
    ventanaId: "7d",
    ahora: "2026-08-25T12:00:00Z",
    actual: SNAP2
  });

  return r.estado === ESTADOS_VENTANA.COMPARABLE && r.variacionEvidencias.diferencia === 25;
});

t("recencia NO es crecimiento: las palabras siguen prohibidas", () => {
  const r = evaluarVentana({
    snapshots: GUARDADOS,
    territorioId: "ec-azuay-cuenca",
    ventanaId: "7d",
    ahora: "2026-08-25T12:00:00Z",
    actual: SNAP2
  });

  return r.prohibido.some((p) => /No llamar «crecimiento» a la recencia/i.test(p));
});

t("las cinco ventanas se evalúan y se declara la mayor comparable", () => {
  const r = evaluarTodasLasVentanas({
    snapshots: GUARDADOS,
    territorioId: "ec-azuay-cuenca",
    ahora: "2026-08-25T12:00:00Z",
    actual: SNAP2
  });

  return (
    Object.keys(r.ventanas).length === 5 &&
    r.resumen.sinHistoricoSuficiente >= 2 &&
    typeof r.resumen.mayorComparable === "string"
  );
});


/* ===========================================================
   [I-12] COBERTURA
   =========================================================== */

bloque("[I-12] COVERAGE OBSERVABILITY");

const COBERTURA = componerCobertura({
  run: RUN,
  universo: UNIVERSO_ING,
  registroMedios: REG_ING,
  dedup: RESULTADO_ING.dedup,
  agendas: {
    AGENDA_MEDIATICA: { evidencias: 18 },
    AGENDA_DIGITAL: { evidencias: 12 },
    AGENDA_CIUDADANA: { evidencias: 0 },
    AGENDA_INSTITUCIONAL: { evidencias: 0 },
    AGENDA_CREADORES: { evidencias: 0 }
  }
});

t("T25 · la falta de credencial aparece como hueco de cobertura", () => {
  return (
    COBERTURA.proveedores.sinCredencial.includes("youtube_data") &&
    COBERTURA.huecos.some(
      (h) => h.referencia === "youtube_data" && h.estado === ESTADOS_COBERTURA.SIN_PREGUNTA
    )
  );
});

t("T24b · «no se preguntó» y «se preguntó y no había» son distintos", () => {
  return (
    COBERTURA.coberturaCompleta === false &&
    /NO se puede afirmar que algo no exista/i.test(COBERTURA.veredicto)
  );
});

t("una agenda vacía se declara como carencia de observación", () => {
  return COBERTURA.agendas.vacias.length === 3 &&
    COBERTURA.huecos.some((h) => /Vacío NO significa silencio/i.test(h.mensaje));
});

t("las plataformas sin resolver se declaran como hueco", () => {
  return COBERTURA.huecos.some((h) => h.ambito === "fuentes" && /emisores reales/i.test(h.mensaje));
});


/* ===========================================================
   [I-13] BENCHMARK
   =========================================================== */

bloque("[I-13] BENCHMARK");

t("la línea base está MEDIDA y apunta a su origen", () => {
  return (
    LINEA_BASE.evidenciasUnicas === 30 &&
    LINEA_BASE.emisoresIdentificados === 6 &&
    LINEA_BASE.evidenciasSinEmisorIdentificado === 12 &&
    /payload-real\.json/.test(LINEA_BASE.origen)
  );
});

t("el «después» está sin medir y declara qué lo bloquea", () => {
  const f = fichaComparacion();

  return (
    f.ejecutado === false &&
    Object.values(f.despues).every((v) => v === null) &&
    f.bloqueadoPor.length === 2
  );
});

t("la comparación declara la dirección deseada de cada métrica", () => {
  const c = comparar({ evidenciasUnicas: 90, emisoresIdentificados: 20 });

  const ev = c.filas.find((f) => f.metrica === "evidenciasUnicas");

  return ev.delta === 60 && ev.mejora === true && c.resumen.sinMedir > 0;
});

t("el volumen bruto NO se presenta como prueba de mejora", () => {
  const c = comparar({});

  const bruto = c.filas.find((f) => f.metrica === "evidenciasBrutas");

  return bruto.direccionDeseada === null && /no dice nada/i.test(bruto.nota);
});

t("el benchmark de proveedores sigue con todas las fichas sin ejecutar", () => {
  const b = estadoBenchmark();

  return b.fichas.every((f) => f.ejecutado === false);
});


/* ===========================================================
   [I-14] VIABILIDAD SOCIAL Y CONDUCTA DIGITAL
   =========================================================== */

bloque("[I-14] VIABILIDAD SOCIAL Y CONDUCTA DIGITAL");

t("el registro de viabilidad cubre las plataformas exigidas", () => {
  const s = estadoViabilidadSocial();

  const ids = PLATAFORMAS_SOCIALES.map((p) => p.id);

  return ["META", "X", "TIKTOK", "LINKEDIN"].every((p) => ids.includes(p)) && s.plataformas >= 4;
});

t("no se contempla raspado evasivo", () => {
  const s = estadoViabilidadSocial();

  return s.declaraciones.some((d) => /NO se contempla raspado evasivo/i.test(d));
});

t("estimatedCost null cuando no se sabe", () => {
  const s = estadoViabilidadSocial();

  return s.sinCostoConocido >= 3 && s.terminosSinLeer >= 4;
});

t("T29 · el contrato de conducta digital prohíbe el dato individual", () => {
  const r = registroConductaDigital({
    provider: "ga4",
    metric: "sesiones",
    value: 100,
    aggregationLevel: "provincia",
    timeWindow: "30d"
  });

  return (
    r.admisible === true &&
    r.verified === false &&
    r.prohibicionesVigentes.some((p) => /No se recoge IP individual/i.test(p)) &&
    r.prohibicionesVigentes.some((p) => /No se infiere Android\/iOS desde publicaciones/i.test(p))
  );
});

t("T29b · sin nivel de agregación el registro NO es admisible", () => {
  const r = registroConductaDigital({ provider: "ga4", metric: "sesiones", value: 100, timeWindow: "30d" });

  return r.admisible === false && /no se distingue de un dato individual/i.test(r.motivoNoAdmisible);
});

t("la conducta digital sigue sin ninguna fuente integrada", () => {
  return DIGITAL_BEHAVIOR.fuentesPrevistas.every((f) => f.integrado === false);
});


/* ===========================================================
   [I-15] INVARIANTES
   =========================================================== */

bloque("[I-15] INVARIANTES DEL SISTEMA");

t("T28 · GEO-1 sigue intacto tras añadir cinco proveedores", () => {
  const bloqueo = comprobarGeo1({ procedencia: "declarada", resolucion: "provincia" }, "parroquia");

  const permitido = comprobarGeo1({ procedencia: "declarada", resolucion: "parroquia" }, "canton");

  return bloqueo.permitido === false && permitido.permitido === true;
});

t("T28b · una evidencia nueva NO trae resolución territorial por sí sola", () => {
  const ev = normalizarEvidencia({ titulo: "T", enlace: "https://x.example/a" }, { providerId: "gdelt_doc" });

  /* `territoryHints` son PISTAS. La ubicación la decide GEO-1. */
  return Array.isArray(ev.territoryHints) && ev.territoryHints.length === 0;
});

t("T30 · dos proyectos independientes no comparten estado", () => {
  const u1 = crearUniverso();

  const u2 = crearUniverso();

  registrarFuente(u1, { dominio: "solo-uno.example", origen: ORIGENES_SOURCE.EVIDENCIA });

  return u1.fuentes.size === 1 && u2.fuentes.size === 0;
});

t("T30b · dos runs de territorios distintos no se comparan entre sí", () => {
  const otro = componerSnapshot({
    territorio: { unidadId: "ec-azuay-gualaceo" },
    window: { id: "7d" },
    capturedAt: "2026-08-18T10:00:00Z",
    diversidad: { totalEvidencias: 5 }
  });

  const r = evaluarVentana({
    snapshots: [otro, SNAP2],
    territorioId: "ec-azuay-cuenca",
    ventanaId: "7d",
    ahora: "2026-08-25T12:00:00Z",
    actual: SNAP2
  });

  return r.disponible === false;
});

t("T31 · los módulos de ingesta no llevan «Cuenca» cableado", () => {
  const genericos = [
    "services/ingest/evidenceContract.js",
    "services/ingest/crossProviderDedup.js",
    "services/ingest/ingestOrchestrator.js",
    "services/ingest/collectorScheduler.js",
    "services/ingest/coverageObservability.js",
    "services/ingest/adapters/rssAdapter.js",
    "services/ingest/adapters/gdeltAdapter.js",
    "services/ingest/adapters/youtubeAdapter.js"
  ];

  /*
    Lo que se prohíbe es CABLEAR el territorio: un identificador
    —nombre de campo, variable, clave, fichero importado— que
    solo tenga sentido en Cuenca hace que el módulo no sirva en
    Gualaceo sin editarlo.

    Lo que SÍ se permite es la prosa. Cada uno de estos módulos
    existe por un hallazgo medido en Cuenca —el 40 % sin emisor,
    las tres agendas a cero, el homónimo español— y borrar el
    caso de las explicaciones dejaría reglas sin motivo.

    Se comprueba sobre identificadores, no sobre cadenas de
    texto ni comentarios. Encontró dos defectos reales:
    `mediaRegistryCuenca.js` (módulo sin una sola línea
    específica de Cuenca) y los campos `coberturaCuenca` /
    `relevanciaCuenca` de la ficha de GDELT.
  */
  /*
    Se buscan las TRES formas concretas en que un territorio se
    cablea y rompe la reutilización, en vez de intentar separar
    código de cadenas —que es frágil y produce falsos positivos
    con las comillas anidadas—:

      · un nombre de campo        coberturaCuenca:
      · una declaración           const dominiosAzuay = ...
      · una ruta de importación   from "./algoCuenca.js"
  */
  const CABLEADO = [
    /\b(?:cuenca|azuay)\w*\s*:/i,
    /\b(?:const|let|var|function|class)\s+\w*(?:cuenca|azuay)/i,
    /\bfrom\s+["'][^"']*(?:cuenca|azuay)/i
  ];

  return genericos.every((ruta) => {
    const texto = readFileSync(join(process.cwd(), ruta), "utf8");

    const sinComentarios = texto
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    return !CABLEADO.some((re) => re.test(sinComentarios));
  });
});

t("T32 · ningún fichero de Candidate Intelligence se ha tocado", () => {
  /*
    Los módulos de este gate no importan nada de intelligence/,
    projects/ ni identity/. Se comprueba sobre los imports, que
    es donde se manifestaría.
  */
  const mios = [
    "services/ingest/evidenceContract.js",
    "services/ingest/crossProviderDedup.js",
    "services/ingest/ingestOrchestrator.js",
    "services/ingest/mediaSourceRegistry.js",
    "services/ingest/collectorScheduler.js",
    "services/ingest/coverageObservability.js",
    "services/ingest/adapters/rssAdapter.js",
    "services/ingest/adapters/gdeltAdapter.js",
    "services/ingest/adapters/youtubeAdapter.js",
    "services/territorial/temporalWindows.js",
    "services/contracts/ingestBenchmark.js",
    "services/contracts/socialPlatformFeasibility.js"
  ];

  return mios.every((ruta) => {
    const texto = readFileSync(join(process.cwd(), ruta), "utf8");

    return !/from ["'].*\/(intelligence|projects|identity)\//.test(texto);
  });
});

t("los adapters nuevos existen como ficheros propios", () => {
  const dir = readdirSync(join(process.cwd(), "services/ingest/adapters"));

  return ["rssAdapter.js", "youtubeAdapter.js", "gdeltAdapter.js"].every((f) =>
    dir.includes(f)
  );
});

t("T17 · cada evidencia conserva el tipo de consulta que la trajo", () => {
  const plan = planificarConsultasAbiertas({
    ambito: { nombre: "Cuenca", ancestros: ["Azuay", "Ecuador"] }
  });

  const neutral = plan.find((c) => c.tipo === TIPOS_CONSULTA.NEUTRAL);

  const ev = normalizarEvidencia(
    { titulo: "T", enlace: "https://x.example/a" },
    { providerId: "brave_web", query: neutral.texto, queryType: neutral.tipo, queryLabel: neutral.etiqueta }
  );

  return (
    ev.provenance.queryType === TIPOS_CONSULTA.NEUTRAL &&
    ev.provenance.queryLabel === neutral.etiqueta
  );
});

t("T20 · una fuente institucional se distingue por su dominio del Estado", () => {
  const u = crearUniverso();

  const f = registrarFuente(u, {
    dominio: "cuenca.gob.ec",
    tipo: TIPOS_SOURCE.INSTITUTION,
    origen: ORIGENES_SOURCE.EVIDENCIA
  });

  return f.tipo === TIPOS_SOURCE.INSTITUTION && f.esPlataforma === false;
});

t("el .env.example existe y NO contiene ningún valor", () => {
  const texto = readFileSync(join(process.cwd(), ".env.example"), "utf8");

  const asignaciones = texto
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l.trim()))
    .map((l) => l.trim());

  const conValor = asignaciones.filter(
    (l) => l.split("=")[1] && !["3001", "fichero"].includes(l.split("=")[1])
  );

  return (
    asignaciones.some((l) => l.startsWith("BRAVE_API_KEY=")) &&
    asignaciones.some((l) => l.startsWith("YOUTUBE_API_KEY=")) &&
    conValor.length === 0
  );
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
