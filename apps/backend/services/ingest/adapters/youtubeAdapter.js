// apps/backend/services/ingest/adapters/youtubeAdapter.js

import { normalizarEvidencia, TIPOS_CONTENIDO, POLITICAS_ALMACENAMIENTO } from "../evidenceContract.js";

/*
===========================================================
YOUTUBE DATA API — INGEST-REAL-01
===========================================================

EL PROBLEMA QUE ESTE ADAPTER EXISTE PARA RESOLVER
-----------------------------------------------------------

Medido en el corpus real de Cuenca: 12 de 30 evidencias —el
40 %— llegaron por YouTube, y las doce se contaron como UNA
fuente llamada «YouTube».

Ni una ni doce eran ciertas. YouTube no publica: aloja. Detras
de esas doce evidencias hay doce emisores que el sistema no
sabia identificar, y hasta saber quienes son no se puede
afirmar nada sobre ellos.

    PLATAFORMA  =  YouTube      no es una fuente editorial
    EMISOR      =  channelId    si puede serlo

La API oficial da el `channelId` y el `channelTitle` en cada
resultado. Con eso, cada video pasa de «vino de YouTube» a
«lo publico este canal», y el canal entra al Source Universe
como CREADOR o MEDIA segun lo que se pueda comprobar —nunca por
numero de suscriptores.

LO QUE NO HACE
-----------------------------------------------------------

No infiere la ubicacion de nadie. YouTube expone el pais
DECLARADO por el canal en su perfil; eso es una declaracion del
canal, no una localizacion, y viaja marcada como tal. La
ubicacion del espectador no se toca: no se recoge, no se
infiere y no existe en este contrato.

No lee comentarios. Ampliaria el gate y abre un problema
distinto —datos de personas individuales— que exige su propia
decision.

No clasifica a nadie como «influencer». Los suscriptores se
leen porque son publicos y sirven para el benchmark, pero NO
son criterio de clasificacion: no hay umbral defendible.

SIN CREDENCIAL
-----------------------------------------------------------

`SIN_CREDENCIAL` y Sentinel sigue funcionando. Igual que Brave.
===========================================================
*/


export const ID = "youtube_data";

export const NOMBRE = "YouTube Data API v3";

export const TIPO = "video";

export const PRIORIDAD = 4;

const ENDPOINT_BUSQUEDA = "https://www.googleapis.com/youtube/v3/search";

const ENDPOINT_CANALES = "https://www.googleapis.com/youtube/v3/channels";

const ENDPOINT_VIDEOS = "https://www.googleapis.com/youtube/v3/videos";

const TIEMPO_MAXIMO_MS = 12000;

const NOMBRES_VARIABLE = ["YOUTUBE_API_KEY", "YOUTUBE_DATA_API_KEY"];


/*
-----------------------------------------------------------
CREDENCIAL — lectura PEREZOSA

En server.js los `import` se evaluan antes que
`dotenv.config()`. Leerla al importar el modulo la dejaria
siempre en undefined aunque estuviera bien puesta. Es el mismo
motivo documentado en braveProvider.
-----------------------------------------------------------
*/

function credencial() {
  for (const nombre of NOMBRES_VARIABLE) {
    const v = process.env[nombre];

    if (v && v.trim()) return v.trim();
  }

  return null;
}


export function estaConfigurado() {
  return Boolean(credencial());
}


/*
-----------------------------------------------------------
COSTE EN UNIDADES DE CUOTA

No es dinero: la API da 10.000 unidades/dia gratis y cada
operacion cuesta un numero distinto. `search` cuesta 100, que
es MUCHO: cien busquedas agotan el dia.

Se declara aqui porque un modulo que gaste sin saberlo dejaria
sin cuota al resto, que es el mismo razonamiento que gobierna
el presupuesto de SerpAPI.
-----------------------------------------------------------
*/

export const COSTE_UNIDADES = Object.freeze({
  search: 100,
  videos: 1,
  channels: 1
});

export const CUOTA_DIARIA_GRATUITA = 10000;


function conTiempoLimite(promesa, ms, etiqueta) {
  let temporizador;

  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(new Error(`${etiqueta} no respondió en ${ms / 1000}s`)),
      ms
    );
  });

  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}


/*
===========================================================
NORMALIZAR UN RESULTADO DE BUSQUEDA
===========================================================

El emisor es el CANAL. Es la razon de ser de este adapter.
===========================================================
*/

export function normalizarVideo(item, contexto = {}) {
  const s = item?.snippet || {};

  const videoId = item?.id?.videoId || item?.id || null;

  if (!videoId) return null;

  const canalId = s.channelId || null;

  const bruto = {
    url: `https://www.youtube.com/watch?v=${videoId}`,

    /*
      La URL de YouTube ES canonica para un video: no hay otra
      direccion del mismo contenido.
    */
    canonicalUrl: `youtube.com/watch?v=${videoId}`,

    title: s.title || "",
    snippet: s.description || null,
    publishedAt: s.publishedAt || null,

    /*
      PLATAFORMA y EMISOR, separados. Es la correccion.
    */
    platform: "YouTube",

    publisher: s.channelTitle || null,

    /*
      El sourceId es el CANAL, no `youtube.com`. Asi el Source
      Universe registra doce emisores donde antes veia una
      plataforma.
    */
    sourceId: canalId ? `youtube:${canalId}` : null,

    author: s.channelTitle || null,

    contentType: TIPOS_CONTENIDO.VIDEO,

    language: s.defaultAudioLanguage || null,

    entities: [],

    territoryHints: []
  };

  const ev = normalizarEvidencia(bruto, {
    providerId: ID,
    query: contexto.query || null,
    queryType: contexto.queryType || null,
    queryLabel: contexto.queryLabel || null,
    observedAt: contexto.observedAt || null,
    contentType: TIPOS_CONTENIDO.VIDEO,

    /*
      Titulo, descripcion y metadatos: lo que la API entrega
      para mostrar. El video en si no se descarga ni se
      almacena.
    */
    politicaAlmacenamiento: POLITICAS_ALMACENAMIENTO.EXTRACTO,

    conservarBruto: contexto.conservarBruto === true
  });

  /* --- datos propios de la plataforma --- */
  ev.youtube = {
    videoId,
    channelId: canalId,
    channelTitle: s.channelTitle || null,

    thumbnails: s.thumbnails
      ? Object.entries(s.thumbnails).map(([k, v]) => ({
          calidad: k,
          url: v?.url || null,
          ancho: v?.width ?? null,
          alto: v?.height ?? null
        }))
      : [],

    liveBroadcastContent: s.liveBroadcastContent || null
  };

  return ev;
}


/*
-----------------------------------------------------------
METADATOS DE CANAL

`country` es el pais que el canal DECLARA en su perfil. No es
una localizacion comprobada y no autoriza a situar nada: viaja
con `declarado: true` y con la advertencia.
-----------------------------------------------------------
*/

export function normalizarCanal(item) {
  const s = item?.snippet || {};

  const est = item?.statistics || {};

  return {
    sourceId: `youtube:${item?.id}`,
    channelId: item?.id || null,

    platform: "YouTube",
    handle: s.customUrl || null,
    displayName: s.title || null,
    description: s.description || null,

    url: item?.id ? `https://www.youtube.com/channel/${item.id}` : null,

    publishedAt: s.publishedAt || null,

    /*
      DECLARADO POR EL CANAL. Nunca comprobado.
    */
    territoryClaim: s.country
      ? {
          valor: s.country,
          declarado: true,
          verificado: false,

          aviso:
            "País declarado por el canal en su perfil. NO es una localización comprobada y no autoriza a atribuir territorio."
        }
      : null,

    estadisticasPublicas: {
      suscriptores: est.subscriberCount ? Number(est.subscriberCount) : null,
      ocultos: est.hiddenSubscriberCount === true,
      videos: est.videoCount ? Number(est.videoCount) : null,
      vistas: est.viewCount ? Number(est.viewCount) : null,

      declaracion:
        "Cifras públicas de la plataforma. NO clasifican al canal: no existe un umbral defendible de seguidores para llamar «influencer» a nadie."
    },

    verificationStatus: "NO_VERIFICADO"
  };
}


/*
===========================================================
BUSCAR
===========================================================
*/

export async function buscar(consulta, opciones = {}) {
  const inicio = Date.now();

  const clave = credencial();

  if (!clave) {
    return {
      estado: "SIN_CREDENCIAL",
      evidencias: [],
      recibidas: 0,
      unidadesConsumidas: 0,
      latenciaMs: 0,

      motivo:
        "Falta YOUTUBE_API_KEY en apps/backend/.env. El adapter está completo; sin credencial no se invoca y Sentinel sigue funcionando.",

      declaracion:
        "Sin credencial NO se puede afirmar ausencia: no se preguntó a YouTube, que no es lo mismo que YouTube no tener nada."
    };
  }

  const fetchImpl = opciones.fetch || globalThis.fetch;

  const params = new URLSearchParams({
    key: clave,
    part: "snippet",
    q: consulta,
    type: "video",
    maxResults: String(Math.min(opciones.maximo || 15, 50)),
    order: opciones.orden || "date",
    relevanceLanguage: opciones.idioma || "es",

    /*
      `regionCode` acota la region de RELEVANCIA, no la
      ubicacion del contenido. No sustituye al ancla territorial
      de la consulta: «Cuenca» con regionCode EC sigue pudiendo
      devolver Cuenca de España si alguien la subio desde aqui.
    */
    regionCode: opciones.region || "EC"
  });

  if (opciones.publicadoDespuesDe) {
    params.set("publishedAfter", opciones.publicadoDespuesDe);
  }

  try {
    const respuesta = await conTiempoLimite(
      fetchImpl(`${ENDPOINT_BUSQUEDA}?${params}`),
      TIEMPO_MAXIMO_MS,
      "YouTube"
    );

    if (respuesta.status === 403) {
      const cuerpo = await respuesta.json().catch(() => ({}));

      const esCuota = /quota/i.test(JSON.stringify(cuerpo));

      return {
        estado: esCuota ? "CUOTA_AGOTADA" : "BLOQUEADO",
        evidencias: [],
        recibidas: 0,
        unidadesConsumidas: 0,
        latenciaMs: Date.now() - inicio,

        motivo: esCuota
          ? `Cuota diaria agotada (${CUOTA_DIARIA_GRATUITA} unidades). Una búsqueda cuesta ${COSTE_UNIDADES.search}.`
          : "La API rechazó la credencial o la operación."
      };
    }

    if (!respuesta.ok) {
      return {
        estado: "ERROR",
        evidencias: [],
        recibidas: 0,
        unidadesConsumidas: COSTE_UNIDADES.search,
        latenciaMs: Date.now() - inicio,
        motivo: `HTTP ${respuesta.status}`
      };
    }

    const datos = await respuesta.json();

    const items = datos?.items || [];

    const evidencias = items
      .map((i) =>
        normalizarVideo(i, {
          query: consulta,
          queryType: opciones.queryType || null,
          queryLabel: opciones.queryLabel || null,
          observedAt: opciones.observedAt || null,
          conservarBruto: opciones.conservarBruto === true
        })
      )
      .filter(Boolean);

    /*
      Los canales distintos que aparecieron. Es lo que alimenta
      el Source Universe con EMISORES en lugar de con una
      plataforma.
    */
    const canales = [
      ...new Map(
        evidencias
          .filter((e) => e.youtube?.channelId)
          .map((e) => [
            e.youtube.channelId,
            { channelId: e.youtube.channelId, channelTitle: e.youtube.channelTitle }
          ])
      ).values()
    ];

    return {
      estado: "OK",
      evidencias,
      recibidas: items.length,
      canalesDetectados: canales,
      unidadesConsumidas: COSTE_UNIDADES.search,
      latenciaMs: Date.now() - inicio,
      motivo: null
    };
  } catch (error) {
    return {
      estado: "ERROR",
      evidencias: [],
      recibidas: 0,
      unidadesConsumidas: 0,
      latenciaMs: Date.now() - inicio,
      motivo: error?.message || "fallo de red"
    };
  }
}


/*
-----------------------------------------------------------
RESOLVER CANALES

Una sola llamada para hasta 50 canales: 1 unidad, no 50.
-----------------------------------------------------------
*/

export async function resolverCanales(channelIds = [], opciones = {}) {
  const clave = credencial();

  if (!clave) {
    return { estado: "SIN_CREDENCIAL", canales: [], unidadesConsumidas: 0 };
  }

  if (channelIds.length === 0) {
    return { estado: "OK", canales: [], unidadesConsumidas: 0 };
  }

  const fetchImpl = opciones.fetch || globalThis.fetch;

  const params = new URLSearchParams({
    key: clave,
    part: "snippet,statistics",
    id: channelIds.slice(0, 50).join(",")
  });

  try {
    const respuesta = await conTiempoLimite(
      fetchImpl(`${ENDPOINT_CANALES}?${params}`),
      TIEMPO_MAXIMO_MS,
      "YouTube canales"
    );

    if (!respuesta.ok) {
      return {
        estado: "ERROR",
        canales: [],
        unidadesConsumidas: COSTE_UNIDADES.channels,
        motivo: `HTTP ${respuesta.status}`
      };
    }

    const datos = await respuesta.json();

    return {
      estado: "OK",
      canales: (datos?.items || []).map(normalizarCanal),
      unidadesConsumidas: COSTE_UNIDADES.channels
    };
  } catch (error) {
    return {
      estado: "ERROR",
      canales: [],
      unidadesConsumidas: 0,
      motivo: error?.message || "fallo de red"
    };
  }
}


/*
===========================================================
RESOLVER UN CANAL POR SU HANDLE — channels.list?forHandle
===========================================================

Anadido por Candidate Intelligence (P-CAND-03).

`resolverCanales` resuelve por ID, y de un expediente lo que se
tiene es un HANDLE. La alternativa era `search.list`, que cuesta
100 unidades y ordena por relevancia: buscar el nombre de una
persona y quedarse con el primer resultado es precisamente lo
que no se puede hacer para atribuir identidad.

`forHandle` cuesta 1 unidad y no interpreta nada: devuelve el
canal de ESE handle o no devuelve nada.

    100 unidades y una conjetura   frente a   1 unidad y un hecho

Se pide tambien `contentDetails` para conocer la lista de
subidas del canal, que es la via barata a sus publicaciones.
===========================================================
*/

export async function resolverCanalPorHandle(handle, opciones = {}) {
  const clave = credencial();

  if (!clave) {
    return { estado: "SIN_CREDENCIAL", canal: null, unidadesConsumidas: 0 };
  }

  const limpio = String(handle || "").trim().replace(/^@+/, "");

  if (!limpio) {
    return { estado: "OK", canal: null, unidadesConsumidas: 0, motivo: "handle vacio" };
  }

  const fetchImpl = opciones.fetch || globalThis.fetch;

  const params = new URLSearchParams({
    key: clave,
    part: "snippet,statistics,contentDetails",
    forHandle: `@${limpio}`
  });

  try {
    const respuesta = await conTiempoLimite(
      fetchImpl(`${ENDPOINT_CANALES}?${params}`),
      TIEMPO_MAXIMO_MS,
      "YouTube canal por handle"
    );

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text().catch(() => "");

      return {
        estado: /quota/i.test(cuerpo) ? "CUOTA_AGOTADA" : "ERROR",
        canal: null,
        unidadesConsumidas: COSTE_UNIDADES.channels,
        motivo: `HTTP ${respuesta.status}`
      };
    }

    const datos = await respuesta.json();

    const item = (datos?.items || [])[0] || null;

    if (!item) {
      return {
        estado: "NO_ENCONTRADO",
        canal: null,
        unidadesConsumidas: COSTE_UNIDADES.channels,
        motivo: `YouTube no devuelve ningun canal con el handle @${limpio}. NO significa que no exista: significa que ese handle no resuelve.`
      };
    }

    const canal = normalizarCanal(item);

    /* Lista de subidas: la via de 1 unidad a las publicaciones. */
    canal.listaDeSubidas =
      item?.contentDetails?.relatedPlaylists?.uploads || null;

    canal.handleConsultado = `@${limpio}`;

    return { estado: "OK", canal, unidadesConsumidas: COSTE_UNIDADES.channels };
  } catch (error) {
    return {
      estado: "ERROR",
      canal: null,
      unidadesConsumidas: 0,
      motivo: error?.message || "fallo de red"
    };
  }
}


/*
===========================================================
PUBLICACIONES RECIENTES DE UN CANAL — playlistItems.list
===========================================================

Anadido por Candidate Intelligence (P-CAND-03). La lista de
subidas de un canal se pagina con `playlistItems`, que cuesta 1
unidad, frente a las 100 de `search.list`. Y devuelve lo que el
canal SUBIO, no lo que un buscador considera relevante.

Se pide una muestra pequena a proposito: validar el pipeline no
exige recorrer un canal entero, y la cuota es un presupuesto.
===========================================================
*/

const ENDPOINT_LISTA = "https://www.googleapis.com/youtube/v3/playlistItems";

export async function listarSubidas(playlistId, opciones = {}) {
  const clave = credencial();

  if (!clave) {
    return { estado: "SIN_CREDENCIAL", videos: [], unidadesConsumidas: 0 };
  }

  if (!playlistId) {
    return {
      estado: "OK",
      videos: [],
      unidadesConsumidas: 0,
      motivo: "el canal no declara lista de subidas"
    };
  }

  const fetchImpl = opciones.fetch || globalThis.fetch;

  /* Tope duro: una muestra, no un volcado. */
  const cuantos = Math.min(Math.max(1, opciones.maximo || 5), 25);

  const params = new URLSearchParams({
    key: clave,
    part: "snippet,contentDetails",
    playlistId,
    maxResults: String(cuantos)
  });

  try {
    const respuesta = await conTiempoLimite(
      fetchImpl(`${ENDPOINT_LISTA}?${params}`),
      TIEMPO_MAXIMO_MS,
      "YouTube lista de subidas"
    );

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text().catch(() => "");

      return {
        estado: /quota/i.test(cuerpo) ? "CUOTA_AGOTADA" : "ERROR",
        videos: [],
        unidadesConsumidas: COSTE_UNIDADES.videos,
        motivo: `HTTP ${respuesta.status}`
      };
    }

    const datos = await respuesta.json();

    const videos = (datos?.items || [])
      .map((it) => {
        const videoId =
          it?.contentDetails?.videoId || it?.snippet?.resourceId?.videoId || null;

        if (!videoId) return null;

        return {
          videoId,
          title: it?.snippet?.title || null,

          /*
            `publishedAt` del item de lista es cuando se anadio a
            la lista; el del video es el de la publicacion. Para
            las subidas propias coinciden, pero se marca de donde
            sale para no confundirlo con una observacion nuestra.
          */
          publishedAt:
            it?.contentDetails?.videoPublishedAt || it?.snippet?.publishedAt || null,

          channelId: it?.snippet?.channelId || null,
          channelTitle: it?.snippet?.channelTitle || null,

          canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,

          descripcion: it?.snippet?.description || null
        };
      })
      .filter(Boolean);

    return {
      estado: "OK",
      videos,
      solicitados: cuantos,
      unidadesConsumidas: COSTE_UNIDADES.videos
    };
  } catch (error) {
    return {
      estado: "ERROR",
      videos: [],
      unidadesConsumidas: 0,
      motivo: error?.message || "fallo de red"
    };
  }
}


/*
===========================================================
ESTADISTICAS POR VIDEO — videos.list
===========================================================

Anadido por Candidate Intelligence (P-CAND-03). `ENDPOINT_VIDEOS`
ya estaba declarado y sin usar: `search.list` NO devuelve
cifras, y las de un video concreto solo salen de esta llamada.

Se anade AQUI, en el adapter que ya existe, en lugar de escribir
un segundo cliente de YouTube: duplicarlo habria significado
duplicar tambien la lectura perezosa de la credencial, el tiempo
limite y el manejo de errores.

Cuesta 1 unidad por llamada y admite hasta 50 IDs, asi que una
llamada cubre una muestra entera.

    LO QUE YOUTUBE OMITE, SE DECLARA OMITIDO

`likeCount` desaparece del payload cuando el canal oculta los
«me gusta»; `commentCount`, cuando los desactiva. En los dos
casos el dato EXISTE y esta cerrado: eso no es cero y tampoco es
«no lo pedimos». Cada metrica viaja con su `availability`.
===========================================================
*/

export const DISPONIBILIDAD_METRICA = Object.freeze({
  DISPONIBLE: "DISPONIBLE",
  OCULTO_POR_LA_CUENTA: "OCULTO_POR_LA_CUENTA",
  NO_DISPONIBLE: "NO_DISPONIBLE"
});


/*
  Una cifra de `statistics`. Ausente no es 0: se distingue el
  campo que el canal cierra del que la API simplemente no trae.
*/
function metricaDeVideo(est, campo, ocultable) {
  const bruto = est?.[campo];

  if (bruto == null) {
    return {
      value: null,
      availability: ocultable
        ? DISPONIBILIDAD_METRICA.OCULTO_POR_LA_CUENTA
        : DISPONIBILIDAD_METRICA.NO_DISPONIBLE,
      motivo: ocultable
        ? `la API no devuelve ${campo}: el canal lo tiene oculto o desactivado`
        : `la API no devuelve ${campo}`
    };
  }

  const n = Number(bruto);

  if (!Number.isFinite(n)) {
    return {
      value: null,
      availability: DISPONIBILIDAD_METRICA.NO_DISPONIBLE,
      motivo: `${campo} no es un numero utilizable`
    };
  }

  return { value: n, availability: DISPONIBILIDAD_METRICA.DISPONIBLE, motivo: null };
}


export function normalizarEstadisticasDeVideo(item) {
  const s = item?.snippet || {};

  const est = item?.statistics || {};

  const videoId = item?.id || null;

  if (!videoId) return null;

  return {
    videoId,
    channelId: s.channelId || null,
    channelTitle: s.channelTitle || null,

    title: s.title || null,
    publishedAt: s.publishedAt || null,

    /* La URL de YouTube ES canonica para un video. */
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,

    metricas: {
      views: metricaDeVideo(est, "viewCount", false),
      likes: metricaDeVideo(est, "likeCount", true),
      comments: metricaDeVideo(est, "commentCount", true)
    },

    /*
      Lo que esta API NO da, dicho aqui para que nadie lo busque
      en otro sitio: no hay compartidos ni alcance por video.
    */
    noDisponibleEnEstaApi: ["shares", "reach", "impressions"]
  };
}


export async function resolverVideos(videoIds = [], opciones = {}) {
  const clave = credencial();

  if (!clave) {
    return { estado: "SIN_CREDENCIAL", videos: [], unidadesConsumidas: 0 };
  }

  if (videoIds.length === 0) {
    return { estado: "OK", videos: [], unidadesConsumidas: 0 };
  }

  const fetchImpl = opciones.fetch || globalThis.fetch;

  const params = new URLSearchParams({
    key: clave,
    part: "snippet,statistics",
    id: videoIds.slice(0, 50).join(",")
  });

  try {
    const respuesta = await conTiempoLimite(
      fetchImpl(`${ENDPOINT_VIDEOS}?${params}`),
      TIEMPO_MAXIMO_MS,
      "YouTube videos"
    );

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text().catch(() => "");

      const esCuota = /quota/i.test(cuerpo);

      return {
        estado: esCuota ? "CUOTA_AGOTADA" : "ERROR",
        videos: [],
        unidadesConsumidas: COSTE_UNIDADES.videos,
        motivo: esCuota
          ? `Cuota diaria agotada (${CUOTA_DIARIA_GRATUITA} unidades).`
          : `HTTP ${respuesta.status}`
      };
    }

    const datos = await respuesta.json();

    const videos = (datos?.items || [])
      .map(normalizarEstadisticasDeVideo)
      .filter(Boolean);

    /*
      IDs pedidos que la API no devolvio: video privado, borrado
      o id equivocado. Se declara en lugar de perderlos en
      silencio.
    */
    const devueltos = new Set(videos.map((v) => v.videoId));

    return {
      estado: "OK",
      videos,
      noDevueltos: videoIds.filter((id) => !devueltos.has(id)),
      unidadesConsumidas: COSTE_UNIDADES.videos
    };
  } catch (error) {
    return {
      estado: "ERROR",
      videos: [],
      unidadesConsumidas: 0,
      motivo: error?.message || "fallo de red"
    };
  }
}


export function diagnostico() {
  const configurado = estaConfigurado();

  return {
    id: ID,
    nombre: NOMBRE,
    tipo: TIPO,
    prioridad: PRIORIDAD,

    implementado: true,
    requiereCredencial: true,
    credencial: configurado ? "presente" : "ausente",
    estado: configurado ? "OK" : "SIN_CREDENCIAL",

    variableEntorno: NOMBRES_VARIABLE[0],

    cuotaDeclarada: `${CUOTA_DIARIA_GRATUITA} unidades/día en el nivel gratuito. Una búsqueda cuesta ${COSTE_UNIDADES.search}: 100 búsquedas agotan el día.`,

    costoPorConsulta: 0,
    motivoCosto:
      "El nivel gratuito no se factura. El límite es de cuota, no de dinero. Si se supera, Google exige aumento de cuota y ahí sí puede haber coste: no consta y no se estima.",

    coberturaDeclarada: ["video"],

    limitaciones: [
      "Una búsqueda cuesta 100 unidades de 10.000 diarias. No es gratis en la práctica: es un presupuesto.",
      "El país del canal es DECLARADO por el canal, no comprobado. No autoriza a atribuir territorio.",
      "No se leen comentarios: son datos de personas individuales y exigen su propia decisión.",
      "Los suscriptores se leen porque son públicos, pero NO clasifican: no hay umbral defendible de «influencer»."
    ],

    resuelve:
      "El 40 % del corpus real llegaba por YouTube sin emisor identificado. Este adapter convierte «vino de YouTube» en «lo publicó este canal»."
  };
}


export default {
  ID,
  NOMBRE,
  TIPO,
  PRIORIDAD,
  COSTE_UNIDADES,
  CUOTA_DIARIA_GRATUITA,
  buscar,
  resolverCanales,
  resolverCanalPorHandle,
  listarSubidas,
  resolverVideos,
  normalizarVideo,
  normalizarCanal,
  normalizarEstadisticasDeVideo,
  estaConfigurado,
  diagnostico
};
