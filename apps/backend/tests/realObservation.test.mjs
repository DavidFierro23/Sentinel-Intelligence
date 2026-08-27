// apps/backend/tests/realObservation.test.mjs

/*
===========================================================
PRUEBAS DE P-CAND-03 — OBSERVACION REAL Y MATRIZ
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/realObservation.test.mjs

SIN RED. El `fetch` se inyecta en el adapter y cada caso declara
que devuelve la API.

LO QUE DEFIENDEN
-----------------------------------------------------------

1 · LO QUE YOUTUBE OMITE NO ES CERO.
    `likeCount` desaparece del payload cuando el canal oculta los
    «me gusta». Eso es OCULTO_POR_LA_CUENTA, no 0.

2 · SIN CORPUS, LA DIMENSION ES null.
    Defecto encontrado en la primera prueba real: agrupar una
    lista vacia da cero grupos, y la dimension se presentaba
    como observada con valor 0 — «miramos y no hay
    amplificacion» en lugar de «no hay nada que mirar».

3 · UNA SOLA OBSERVACION NO ES UNA TENDENCIA.

4 · NADA EN LA MATRIZ ESTA EN VERDE POR SUPOSICION.

5 · OBSERVAR NO CORROBORA.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

/* Credencial ficticia: el adapter solo comprueba que exista. */
process.env.YOUTUBE_API_KEY = "falsa";

const yt = await import("../services/ingest/adapters/youtubeAdapter.js");

const co = await import("../services/intelligence/candidateObservation.js");

const scm = await import("../services/intelligence/socialCapabilityMatrix.js");

const dp = await import("../services/intelligence/digitalPresence.js");

const amp = await import("../services/intelligence/candidateAmplification.js");

const po = await import("../services/intelligence/publicationObservation.js");

let pass = 0;

let fail = 0;

const fallos = [];

async function t(nombre, comprobacion) {
  try {
    const valor = await comprobacion();

    if (valor === true) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}  (devolvió ${JSON.stringify(valor)})`);
    }
  } catch (error) {
    fail += 1;
    fallos.push(`${nombre} (${error.message})`);
    console.log(`  ERR   ${nombre}  ${error.message}`);
  }
}

function bloque(titulo) {
  console.log(`\n--- ${titulo} ---`);
}


/*
===========================================================
FIXTURES — respuestas sinteticas de la API
===========================================================
*/

const CANAL = {
  items: [
    {
      id: "UC_FICTICIO_1",
      snippet: {
        title: "Canal Ficticio de Prueba",
        description: "Descripcion cualquiera",
        customUrl: "@canalficticio",
        publishedAt: "2020-01-01T00:00:00Z"
      },
      statistics: {
        subscriberCount: "1200",
        hiddenSubscriberCount: false,
        videoCount: "40",
        viewCount: "98000"
      },
      contentDetails: { relatedPlaylists: { uploads: "UU_FICTICIO_1" } }
    }
  ]
};

const CANAL_SUSCRIPTORES_OCULTOS = {
  items: [
    {
      ...CANAL.items[0],
      statistics: {
        hiddenSubscriberCount: true,
        videoCount: "40",
        viewCount: "98000"
      }
    }
  ]
};

const LISTA = {
  items: [
    {
      contentDetails: { videoId: "VID1", videoPublishedAt: "2026-08-01T10:00:00Z" },
      snippet: { title: "Publicacion ficticia uno", channelId: "UC_FICTICIO_1" }
    },
    {
      contentDetails: { videoId: "VID2", videoPublishedAt: "2026-08-10T10:00:00Z" },
      snippet: { title: "Publicacion ficticia dos", channelId: "UC_FICTICIO_1" }
    }
  ]
};

/* VID1 completo. VID2 con likes y comentarios cerrados. */
const VIDEOS = {
  items: [
    {
      id: "VID1",
      snippet: {
        title: "Publicacion ficticia uno",
        channelId: "UC_FICTICIO_1",
        channelTitle: "Canal Ficticio de Prueba",
        publishedAt: "2026-08-01T10:00:00Z"
      },
      statistics: { viewCount: "15000", likeCount: "300", commentCount: "0" }
    },
    {
      id: "VID2",
      snippet: {
        title: "Publicacion ficticia dos",
        channelId: "UC_FICTICIO_1",
        publishedAt: "2026-08-10T10:00:00Z"
      },
      statistics: { viewCount: "900" }
    }
  ]
};


/* Enruta por endpoint, como haria la API. */
function apiFalsa(respuestas = {}) {
  return async (url) => {
    const u = String(url);

    const cual = u.includes("/channels")
      ? "channels"
      : u.includes("/playlistItems")
        ? "playlistItems"
        : u.includes("/videos")
          ? "videos"
          : null;

    const r = respuestas[cual];

    if (!r) return { ok: false, status: 404, text: async () => "" };

    if (r.status && r.status >= 400) {
      return { ok: false, status: r.status, text: async () => r.cuerpo || "" };
    }

    return { ok: true, status: 200, json: async () => r, text: async () => "" };
  };
}


/*
===========================================================
1 · ADAPTER: LO QUE YOUTUBE OMITE
===========================================================
*/
bloque("videos.list: null no es cero");

await t("una metrica presente se lee tal cual", () => {
  const v = yt.normalizarEstadisticasDeVideo(VIDEOS.items[0]);

  return (
    v.metricas.views.value === 15000 &&
    v.metricas.views.availability === "DISPONIBLE"
  );
});

await t("commentCount 0 SI es un dato: disponible con valor cero", () => {
  const v = yt.normalizarEstadisticasDeVideo(VIDEOS.items[0]);

  return (
    v.metricas.comments.value === 0 &&
    v.metricas.comments.availability === "DISPONIBLE"
  );
});

await t("likeCount ausente es OCULTO_POR_LA_CUENTA, no 0", () => {
  const v = yt.normalizarEstadisticasDeVideo(VIDEOS.items[1]);

  return (
    v.metricas.likes.value === null &&
    v.metricas.likes.availability === "OCULTO_POR_LA_CUENTA"
  );
});

await t("y lo dice con su motivo", () => {
  const v = yt.normalizarEstadisticasDeVideo(VIDEOS.items[1]);

  return v.metricas.likes.motivo.includes("oculto o desactivado");
});

await t("la URL canonica se construye del videoId", () => {
  const v = yt.normalizarEstadisticasDeVideo(VIDEOS.items[0]);

  return v.canonicalUrl === "https://www.youtube.com/watch?v=VID1";
});

await t("los compartidos se declaran no disponibles en esta API", () => {
  const v = yt.normalizarEstadisticasDeVideo(VIDEOS.items[0]);

  return v.noDisponibleEnEstaApi.includes("shares");
});

await t("videos.list declara los IDs que la API no devolvio", async () => {
  const r = await yt.resolverVideos(["VID1", "VID_QUE_NO_EXISTE"], {
    fetch: apiFalsa({ videos: { items: [VIDEOS.items[0]] } })
  });

  return r.estado === "OK" && r.noDevueltos.includes("VID_QUE_NO_EXISTE");
});

await t("videos.list cuesta 1 unidad, no 100", async () => {
  const r = await yt.resolverVideos(["VID1"], {
    fetch: apiFalsa({ videos: VIDEOS })
  });

  return r.unidadesConsumidas === 1;
});

bloque("channels.list?forHandle: resolver sin buscar por nombre");

await t("un handle resuelve a canal y a su lista de subidas", async () => {
  const r = await yt.resolverCanalPorHandle("@canalficticio", {
    fetch: apiFalsa({ channels: CANAL })
  });

  return (
    r.estado === "OK" &&
    r.canal.channelId === "UC_FICTICIO_1" &&
    r.canal.listaDeSubidas === "UU_FICTICIO_1" &&
    r.unidadesConsumidas === 1
  );
});

await t("un handle que no resuelve NO afirma que el candidato no tenga canal", async () => {
  const r = await yt.resolverCanalPorHandle("@inexistente", {
    fetch: apiFalsa({ channels: { items: [] } })
  });

  return (
    r.estado === "NO_ENCONTRADO" &&
    r.motivo.includes("NO significa que no exista")
  );
});

await t("suscriptores ocultos: null, no cero", async () => {
  const r = await yt.resolverCanalPorHandle("@canalficticio", {
    fetch: apiFalsa({ channels: CANAL_SUSCRIPTORES_OCULTOS })
  });

  return (
    r.canal.estadisticasPublicas.ocultos === true &&
    r.canal.estadisticasPublicas.suscriptores === null
  );
});

await t("playlistItems.list cuesta 1 unidad y respeta el tope", async () => {
  const r = await yt.listarSubidas("UU_FICTICIO_1", {
    fetch: apiFalsa({ playlistItems: LISTA }),
    maximo: 5
  });

  return r.estado === "OK" && r.videos.length === 2 && r.unidadesConsumidas === 1;
});

await t("sin lista de subidas no se llama a la API", async () => {
  let llamadas = 0;

  const r = await yt.listarSubidas(null, {
    fetch: async () => {
      llamadas += 1;

      return { ok: true, status: 200, json: async () => ({}) };
    }
  });

  return llamadas === 0 && r.unidadesConsumidas === 0;
});


/*
===========================================================
2 · TRADUCCION AL CONTRATO COMUN
===========================================================
*/
bloque("observacion: plataforma -> contrato comun");

const CUENTA_YT = {
  id: "youtube:canalficticio",
  plataformaId: "youtube",
  handle: "canalficticio",
  url: "https://www.youtube.com/@canalficticio",
  estado: "DECLARADA_POR_ANALISTA",
  declaradaPorAnalista: true
};

const API_COMPLETA = apiFalsa({
  channels: CANAL,
  playlistItems: LISTA,
  videos: VIDEOS
});

await t("tres llamadas y tres unidades, ni una mas", async () => {
  const r = await co.observarYouTube({
    candidateId: "cand-f",
    projectId: "proy-f",
    cuenta: CUENTA_YT,
    fetchImpl: API_COMPLETA
  });

  return (
    r.traza.unidadesConsumidas === 3 &&
    r.traza.llamadas.length === 3 &&
    r.traza.llamadas.every((l) => l.estado === "OK")
  );
});

await t("no se usa search.list en ningun momento", async () => {
  const endpoints = [];

  await co.observarYouTube({
    candidateId: "cand-f",
    cuenta: CUENTA_YT,
    fetchImpl: async (url) => {
      endpoints.push(String(url));

      return API_COMPLETA(url);
    }
  });

  return !endpoints.some((e) => e.includes("/search"));
});

await t("cada publicacion llega con los campos del contrato", async () => {
  const r = await co.observarYouTube({
    candidateId: "cand-f",
    projectId: "proy-f",
    cuenta: CUENTA_YT,
    fetchImpl: API_COMPLETA
  });

  const p = r.publicaciones[0];

  return (
    !!p.publicationId &&
    p.candidateId === "cand-f" &&
    p.accountId === "youtube:canalficticio" &&
    p.platformId === "youtube" &&
    !!p.canonicalUrl &&
    !!p.publishedAt &&
    !!p.firstObservedAt &&
    !!p.evidenceId &&
    p.provider === "youtube_data"
  );
});

await t("publishedAt de la fuente y firstObservedAt nuestro son distintos", async () => {
  const r = await co.observarYouTube({
    candidateId: "cand-f",
    cuenta: CUENTA_YT,
    observedAt: "2026-08-26T12:00:00.000Z",
    fetchImpl: API_COMPLETA
  });

  const p = r.publicaciones[0];

  return (
    p.publishedAt === "2026-08-01T10:00:00Z" &&
    p.firstObservedAt === "2026-08-26T12:00:00.000Z"
  );
});

await t("la metrica cerrada por el canal viaja con su disponibilidad", async () => {
  const r = await co.observarYouTube({
    candidateId: "cand-f",
    cuenta: CUENTA_YT,
    fetchImpl: API_COMPLETA
  });

  const dos = r.publicaciones.find((p) => p.canonicalUrl.includes("VID2"));

  const likes = dos.metricas.find((m) => m.metrica === "likes");

  return likes.value === null && likes.availability === "OCULTO_POR_LA_CUENTA";
});

await t("observar NO corrobora la identidad, y se dice", async () => {
  const r = await co.observarYouTube({
    candidateId: "cand-f",
    cuenta: CUENTA_YT,
    fetchImpl: API_COMPLETA
  });

  return r.notaIdentidad.includes("NO altera la resolucion de identidad");
});

await t("una plataforma sin capacidad para terceros no se intenta", async () => {
  let llamadas = 0;

  const r = await co.observarCandidato({
    candidateId: "cand-f",
    cuentas: [{ id: "tiktok:x", plataformaId: "tiktok", handle: "x" }],
    plataformas: ["youtube"],
    fetchImpl: async () => {
      llamadas += 1;

      return { ok: true, status: 200, json: async () => ({}) };
    }
  });

  return (
    llamadas === 0 &&
    r.resultados[0].estado === co.ESTADOS_OBSERVACION_REAL.CAPACIDAD_NO_DISPONIBLE
  );
});


/*
===========================================================
3 · HISTORICO CON UNA SOLA OBSERVACION
===========================================================
*/
bloque("una observacion no es una tendencia");

await t("con un solo snapshot la serie no es comparable", async () => {
  const r = await co.observarYouTube({
    candidateId: "cand-f",
    cuenta: CUENTA_YT,
    fetchImpl: API_COMPLETA
  });

  const s = po.serieDeMetrica(r.publicaciones[0], "views");

  return s.comparable === false && s.velocidad === null && s.delta === null;
});

await t("y el motivo dice que una velocidad de un punto seria invencion", async () => {
  const r = await co.observarYouTube({
    candidateId: "cand-f",
    cuenta: CUENTA_YT,
    fetchImpl: API_COMPLETA
  });

  const s = po.serieDeMetrica(r.publicaciones[0], "views");

  return s.motivo.includes("seria una invencion");
});

await t("una segunda observacion del MISMO video acumula, no sustituye", async () => {
  const uno = await co.observarYouTube({
    candidateId: "cand-f",
    cuenta: CUENTA_YT,
    observedAt: "2026-08-26T10:00:00.000Z",
    fetchImpl: API_COMPLETA
  });

  /* Segunda lectura con la cifra mas alta. */
  const dos = await co.observarYouTube({
    candidateId: "cand-f",
    cuenta: CUENTA_YT,
    observedAt: "2026-08-27T10:00:00.000Z",
    fetchImpl: apiFalsa({
      channels: CANAL,
      playlistItems: LISTA,
      videos: {
        items: [
          {
            ...VIDEOS.items[0],
            statistics: { viewCount: "22000", likeCount: "300", commentCount: "0" }
          },
          VIDEOS.items[1]
        ]
      }
    })
  });

  const a = uno.publicaciones.find((p) => p.canonicalUrl.includes("VID1"));

  const b = dos.publicaciones.find((p) => p.canonicalUrl.includes("VID1"));

  const f = po.fusionarPublicacion(a, b);

  const s = po.serieDeMetrica(f, "views");

  return (
    f.firstObservedAt === "2026-08-26T10:00:00.000Z" &&
    s.comparable === true &&
    s.delta === 7000
  );
});


/*
===========================================================
4 · SIN CORPUS: null, NO 0
===========================================================
*/
bloque("regresion medida en la primera prueba real");

await t("sin corpus, amplificacion externa es null y no 0", () => {
  const a = amp.amplificacionDeCandidato({ evidencias: [], cuentas: [] });

  const d = dp.dimensionesDePresencia({
    amplificacion: a,
    conversacion: amp.separarConversacion({ evidencias: [], cuentas: [] }),
    evidencias: [],
    snapshots: []
  });

  const ext = d.find((x) => x.id === "amplificacion_externa");

  return ext.valor === null && ext.observable === false;
});

await t("y el motivo distingue «no hay nada que mirar» de «es cero»", () => {
  const d = dp.dimensionesDePresencia({
    amplificacion: amp.amplificacionDeCandidato({ evidencias: [], cuentas: [] }),
    evidencias: []
  });

  const ext = d.find((x) => x.id === "amplificacion_externa");

  return ext.motivoNoDisponible.includes("No es que la amplificacion sea cero");
});

await t("cobertura mediatica sin corpus tambien es null", () => {
  const d = dp.dimensionesDePresencia({
    amplificacion: amp.amplificacionDeCandidato({ evidencias: [], cuentas: [] }),
    evidencias: []
  });

  return d.find((x) => x.id === "cobertura_mediatica").valor === null;
});

await t("con corpus real si pasan a observables", () => {
  const evid = [
    { id: "e1", titulo: "Una nota", url: "https://portalficticio-a.test/1", fecha: "2026-08-20" },
    { id: "e2", titulo: "Otra nota distinta", url: "https://portalficticio-b.test/2", fecha: "2026-08-21" }
  ];

  const d = dp.dimensionesDePresencia({
    amplificacion: amp.amplificacionDeCandidato({ evidencias: evid, cuentas: [] }),
    conversacion: amp.separarConversacion({ evidencias: evid, cuentas: [] }),
    evidencias: evid
  });

  return (
    d.find((x) => x.id === "amplificacion_externa").valor === 2 &&
    d.find((x) => x.id === "cobertura_mediatica").valor === 2
  );
});

await t("el indice compuesto sigue NO DISPONIBLE con datos reales", () => {
  const p = dp.presenciaDigitalObservada({
    actividad: { publicacionesObservadas: 3 },
    evidencias: []
  });

  return p.indice.disponible === false && p.indice.valor === null;
});


/*
===========================================================
5 · MATRIZ DE CAPACIDADES
===========================================================
*/
bloque("matriz: nada en verde por suposicion");

await t("las cinco plataformas estan en la matriz", () => {
  const m = scm.matrizDeCapacidades();

  return (
    m.plataformas.length === 5 &&
    ["youtube", "tiktok", "facebook", "instagram", "x"].every((p) =>
      m.plataformas.some((x) => x.plataformaId === p)
    )
  );
});

await t("cada celda declara COMO se sabe lo que dice", () => {
  const m = scm.matrizDeCapacidades();

  return m.plataformas.every((p) =>
    Object.values(p.capacidades).every((c) =>
      Object.values(scm.VERIFICACION).includes(c.verificacion)
    )
  );
});

await t("solo YouTube tiene capacidades medidas en produccion", () => {
  const m = scm.matrizDeCapacidades();

  const conMedidas = m.plataformas.filter((p) => p.medidas > 0);

  return conMedidas.length === 1 && conMedidas[0].plataformaId === "youtube";
});

await t("TikTok, Facebook e Instagram no dan acceso a terceros", () => {
  const m = scm.matrizDeCapacidades();

  return ["tiktok", "facebook", "instagram"].every(
    (id) => m.plataformas.find((p) => p.plataformaId === id).terceros === false
  );
});

/*
  Corregido en SOCIAL-PROVIDER-EVAL-01. Antes se decia que las
  metricas de TikTok «requieren autorizacion», lo que sugiere que
  hay un permiso que pedir. No lo hay: la Display API exige el
  login del titular, la Research API no es elegible para un
  producto comercial y la Commercial Content API no da metricas
  organicas. El estado exacto es proveedor externo.
*/
await t("las metricas de TikTok exigen proveedor, no un permiso que pedir", () => {
  return ["views", "likes", "comments", "shares"].every(
    (c) => scm.celdaDe(scm.capacidad("tiktok", c)) === "REQUIERE_PROVEEDOR"
  );
});

await t("y las tres APIs de TikTok se evaluan por separado con su motivo", () => {
  const tk = scm.PLATAFORMAS.find((p) => p.plataformaId === "tiktok");

  return (
    tk.apisEvaluadas.length === 3 &&
    tk.apisEvaluadas.every((a) => typeof a.motivo === "string" && a.motivo.length > 30) &&
    tk.apisEvaluadas.find((a) => a.id === "display_api").cubreTerceros === false
  );
});

await t("X cubre terceros sin autorizacion del titular", () => {
  const m = scm.matrizDeCapacidades();

  const x = m.plataformas.find((p) => p.plataformaId === "x");

  return x.terceros === true && x.autorizacionDelTitular === false;
});

/*
  Afinado en SOCIAL-PROVIDER-EVAL-01. La version anterior
  afirmaba que X era la unica con menciones disponibles; al
  precisar la matriz resulto que `search.list` de YouTube tambien
  las encuentra con la credencial que ya tenemos.

  El hecho exacto, y el que decide: de las cinco plataformas,
  YouTube es la UNICA cuyas menciones se pueden pedir hoy. Las de
  X existen oficialmente y estan detras de un plan.
*/
await t("hoy solo las menciones de YouTube son alcanzables", () => {
  const m = scm.matrizDeCapacidades();

  const alcanzables = m.plataformas.filter((p) =>
    ["MEDIDO", "OFICIAL_DISPONIBLE"].includes(
      scm.celdaDe(p.capacidades.menciones)
    )
  );

  return (
    alcanzables.length === 1 &&
    alcanzables[0].plataformaId === "youtube" &&
    scm.celdaDe(
      m.plataformas.find((p) => p.plataformaId === "x").capacidades.menciones
    ) === "REQUIERE_PLAN_PAGO"
  );
});

await t("cada plataforma sin acceso declara una ruta concreta", () => {
  const m = scm.matrizDeCapacidades();

  return ["tiktok", "facebook", "instagram", "x"].every(
    (id) =>
      (m.plataformas.find((p) => p.plataformaId === id).rutaConcreta || []).length > 0
  );
});

await t("el resumen cuenta bien las medidas: no eran cero", () => {
  const m = scm.matrizDeCapacidades();

  return m.resumen.medidasEnProduccion === 9;
});

/*
  Invariante mas fuerte que el anterior, y que cubre las cinco
  plataformas en lugar de solo YouTube: NINGUNA celda puede
  llamarse MEDIDO si no se midio. Es lo que impide que un
  «disponible segun la documentacion» se lea como «ya funciona».
*/
await t("ninguna celda se etiqueta MEDIDO sin haberse medido", () => {
  return scm.PLATAFORMAS.every((p) =>
    Object.values(p.capacidades).every((c) =>
      scm.celdaDe(c) === "MEDIDO"
        ? c.verificacion === "MEDIDO_EN_PRODUCCION"
        : true
    )
  );
});

await t("y lo que solo esta documentado se etiqueta OFICIAL_DISPONIBLE", () => {
  const yts = scm.PLATAFORMAS.find((p) => p.plataformaId === "youtube");

  /* `menciones` existe con la credencial, pero no se ha ejecutado. */
  return (
    yts.capacidades.menciones.estado === "DISPONIBLE" &&
    yts.capacidades.menciones.verificacion === "DOCUMENTADO" &&
    scm.celdaDe(yts.capacidades.menciones) === "OFICIAL_DISPONIBLE"
  );
});

await t("shares de YouTube se declara NO_DISPONIBLE, no se inventa", () => {
  return scm.capacidad("youtube", "shares").estado === "NO_DISPONIBLE";
});

await t("el historico no lo entrega ninguna plataforma: lo construye Sentinel", () => {
  return ["youtube", "tiktok", "facebook", "instagram"].every(
    (id) => scm.capacidad(id, "historico").estado === "NO_DISPONIBLE"
  );
});


/* ---------------------------------------------------------
   RESULTADO
--------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
