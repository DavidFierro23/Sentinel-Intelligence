// apps/backend/services/ingest/adapters/xAdapter.js

/*
===========================================================
X API v2 — ADAPTER (SOCIAL-PROVIDER-EVAL-01)
===========================================================

Escrito con la MISMA forma que `youtubeAdapter`: `ID`,
`estaConfigurado`, coste por llamada, estado `SIN_CREDENCIAL`,
normalizadores y `diagnostico`. Asi entra en el registro de la
linea de ingesta sin que nadie tenga que adaptarlo.

POR QUE X ES LA SIGUIENTE Y NO OTRA
-----------------------------------------------------------

De las cuatro plataformas pendientes, X es la unica que cubre
cuentas de TERCEROS sin autorizacion del titular. Y es la unica
que entrega MENCIONES: quien habla de un candidato, que es la
mitad que le falta a Candidate Intelligence —hoy solo puede
medir lo que publica el propio candidato—.

Facebook e Instagram exigen que Meta revise nuestra app; TikTok
no tiene via para un producto comercial. En X el obstaculo es un
plan de pago, que es el unico de los tres que se resuelve con una
decision y no con una solicitud a un tercero.

    NO SE EJECUTA NINGUNA LLAMADA SIN CREDENCIAL.

Sin `X_BEARER_TOKEN` cada funcion devuelve `SIN_CREDENCIAL` y no
toca la red. Es la misma disciplina que YouTube y Brave.

LO QUE NO SE SABE, NO SE ESCRIBE
-----------------------------------------------------------

El coste por llamada de esta API depende del plan contratado y
los planes han cambiado varias veces. `COSTE_POR_LLAMADA` es
`null` a proposito: un numero inventado aqui se convertiria en
una linea de presupuesto. Lo que si se declara es el CONSUMO en
llamadas, que se puede contar sin saber el precio.
===========================================================
*/

import { normalizarEvidencia, TIPOS_CONTENIDO, POLITICAS_ALMACENAMIENTO } from "../evidenceContract.js";


export const ID = "x_api";

export const NOMBRE = "X API v2";

export const TIPO = "social";

export const PRIORIDAD = 5;


const BASE = "https://api.x.com/2";

const ENDPOINT_USUARIO = `${BASE}/users/by/username`;

const ENDPOINT_TIMELINE = (id) => `${BASE}/users/${id}/tweets`;

const ENDPOINT_BUSQUEDA_RECIENTE = `${BASE}/tweets/search/recent`;

const TIEMPO_MAXIMO_MS = 12000;

const NOMBRES_VARIABLE = ["X_BEARER_TOKEN", "TWITTER_BEARER_TOKEN"];


/*
  Lectura PEREZOSA de la credencial: en server.js los `import` se
  evaluan antes de `dotenv.config()`. Mismo motivo documentado en
  youtubeAdapter y braveProvider.
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
  El coste real depende del plan. Se cuenta lo que se puede
  contar: llamadas. El precio queda en `null` hasta que alguien
  lo verifique en el portal.
*/
export const COSTE_POR_LLAMADA = null;

export const CUOTA_DIARIA_GRATUITA = null;


/* Campos que se piden. Sin ellos la respuesta no trae metricas. */
const CAMPOS_USUARIO = "public_metrics,description,created_at,verified";

const CAMPOS_POST = "created_at,public_metrics,author_id,lang,referenced_tweets";


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


async function pedir(url, opciones = {}) {
  const clave = credencial();

  const fetchImpl = opciones.fetch || globalThis.fetch;

  const r = await conTiempoLimite(
    fetchImpl(url, {
      headers: { Authorization: `Bearer ${clave}`, Accept: "application/json" }
    }),
    TIEMPO_MAXIMO_MS,
    opciones.etiqueta || "X API"
  );

  if (!r.ok) {
    const cuerpo = await r.text().catch(() => "");

    /*
      429 es limite de peticiones y 403 suele ser «tu plan no
      incluye este endpoint». Son cosas distintas y conviene no
      mezclarlas: la primera se resuelve esperando, la segunda
      contratando.
    */
    return {
      ok: false,
      estado:
        r.status === 429
          ? "LIMITE_DE_PETICIONES"
          : r.status === 403
            ? "PLAN_INSUFICIENTE"
            : r.status === 401
              ? "CREDENCIAL_RECHAZADA"
              : "ERROR",
      httpStatus: r.status,
      motivo:
        r.status === 403
          ? `HTTP 403: el plan contratado no cubre este endpoint. Cuerpo: ${cuerpo.slice(0, 200)}`
          : `HTTP ${r.status}`
    };
  }

  return { ok: true, datos: await r.json() };
}


/*
-----------------------------------------------------------
METRICAS PUBLICAS DE UN POST

Cada una con su disponibilidad. `impression_count` es el caso
delicado: la API no siempre lo incluye para publicaciones de
terceros, y su ausencia no es cero.
-----------------------------------------------------------
*/
export const DISPONIBILIDAD_METRICA = Object.freeze({
  DISPONIBLE: "DISPONIBLE",
  NO_DISPONIBLE: "NO_DISPONIBLE",
  NO_INCLUIDA_POR_LA_API: "NO_INCLUIDA_POR_LA_API"
});


function metrica(pm, campo, notaSiFalta) {
  const bruto = pm?.[campo];

  if (bruto == null) {
    return {
      value: null,
      availability: DISPONIBILIDAD_METRICA.NO_INCLUIDA_POR_LA_API,
      motivo: notaSiFalta || `la API no incluyo ${campo} en la respuesta`
    };
  }

  const n = Number(bruto);

  return Number.isFinite(n)
    ? { value: n, availability: DISPONIBILIDAD_METRICA.DISPONIBLE, motivo: null }
    : {
        value: null,
        availability: DISPONIBILIDAD_METRICA.NO_DISPONIBLE,
        motivo: `${campo} no es un numero utilizable`
      };
}


export function normalizarUsuario(item) {
  if (!item?.id) return null;

  const pm = item.public_metrics || {};

  return {
    userId: item.id,
    handle: item.username || null,
    displayName: item.name || null,
    description: item.description || null,
    createdAt: item.created_at || null,

    url: item.username ? `https://x.com/${item.username}` : null,

    estadisticasPublicas: {
      followers: metrica(pm, "followers_count").value,
      following: metrica(pm, "following_count").value,
      posts: metrica(pm, "tweet_count").value,

      declaracion:
        "Cifras publicas de la plataforma. NO clasifican a la cuenta: no existe un umbral defendible de seguidores para llamar «influencer» a nadie."
    },

    /*
      `verified` en X es una suscripcion de pago, no una
      comprobacion de identidad. No sirve como senal de
      atribucion y se marca para que nadie la use como tal.
    */
    marcaDeVerificado: {
      valor: item.verified ?? null,
      noEsEvidencia:
        "La marca de X es una suscripcion de pago, no una comprobacion de identidad. No corrobora la pertenencia de la cuenta."
    }
  };
}


export function normalizarPost(item, contexto = {}) {
  const postId = item?.id || null;

  if (!postId) return null;

  const pm = item.public_metrics || {};

  const handle = contexto.handle || null;

  const canonicalUrl = handle
    ? `https://x.com/${handle}/status/${postId}`
    : `https://x.com/i/status/${postId}`;

  const bruto = {
    url: canonicalUrl,
    canonicalUrl: canonicalUrl.replace(/^https:\/\//, ""),
    title: null,
    snippet: item.text || null,
    publishedAt: item.created_at || null,
    platform: "X",
    publisher: handle,
    author: handle,
    sourceId: contexto.userId ? `x:${contexto.userId}` : null,
    contentType: TIPOS_CONTENIDO.PUBLICACION_SOCIAL,
    language: item.lang || null,
    entities: [],
    territoryHints: []
  };

  const ev = normalizarEvidencia(bruto, {
    providerId: ID,

    /*
      PROCEDENCIA DE CONSULTA — TERRITORIAL-COLLECTOR-EXPANSION-01

      Faltaba. `buscarMenciones` ya recibia `queryType` y
      `queryLabel` del colector y los tiraba aqui: no llegaban a
      `normalizarEvidencia`, que es quien construye
      `provenance`. Resultado medido: las 47 evidencias de X del
      corpus se persistieron con `queryLabel: null`, mientras las
      21 de YouTube si lo traian, porque su adapter si los pasa.

      No se puede auditar de que consulta salio una pieza si la
      consulta no viaja con ella.

      Es aditivo: si el llamador no los pasa —como hace Candidate
      sobre cuentas conocidas, donde no hay consulta— quedan en
      null igual que antes.

      Y la regla que no cambia: esto es TRAZABILIDAD, no
      geografia. La consulta nunca entra en las senales
      territoriales.
    */
    query: contexto.query || null,
    queryType: contexto.queryType || null,
    queryLabel: contexto.queryLabel || null,

    observedAt: contexto.observedAt || null,
    politicaAlmacenamiento: POLITICAS_ALMACENAMIENTO.EXTRACTO,
    conservarBruto: false
  });

  ev.x = {
    postId,
    authorId: item.author_id || null,
    canonicalUrl,

    /*
      Republicar y citar no son el mismo acto: uno amplifica sin
      anadir nada, el otro comenta. Se guardan separados.
    */
    metricas: {
      likes: metrica(pm, "like_count"),
      reposts: metrica(pm, "retweet_count"),
      comments: metrica(pm, "reply_count"),
      quotes: metrica(pm, "quote_count"),
      views: metrica(
        pm,
        "impression_count",
        "la API no incluyo impression_count: su disponibilidad para publicaciones de terceros depende del plan y del endpoint"
      ),

      /*
        MEDIA-PIECE-02: los "guardados" son visibles en la
        interfaz de X y el usuario los ve al mirar una
        publicacion. La API los expone como `bookmark_count`,
        pero no en todos los niveles de acceso. Se pide y, si no
        vienen, se declara ausente: no aparecer aqui hacia creer
        que la metrica no existe, cuando el problema es el plan.
      */
      bookmarks: metrica(
        pm,
        "bookmark_count",
        "la API no incluyo bookmark_count: su disponibilidad depende del nivel de acceso contratado"
      )
    },

    esRespuesta: (item.referenced_tweets || []).some((r) => r.type === "replied_to"),
    esRepost: (item.referenced_tweets || []).some((r) => r.type === "retweeted"),
    esCita: (item.referenced_tweets || []).some((r) => r.type === "quoted")
  };

  return ev;
}


/*
===========================================================
RESOLVER UNA CUENTA POR SU HANDLE
===========================================================

El equivalente de `channels.list?forHandle`: del expediente sale
un handle, no un id. Y no interpreta nada — devuelve la cuenta de
ESE handle o ninguna.
===========================================================
*/
export async function resolverCuentaPorHandle(handle, opciones = {}) {
  if (!estaConfigurado()) {
    return {
      estado: "SIN_CREDENCIAL",
      cuenta: null,
      llamadas: 0,
      motivo:
        `Falta ${NOMBRES_VARIABLE[0]} en apps/backend/.env. El adapter esta completo; sin credencial no se invoca y Sentinel sigue funcionando.`
    };
  }

  const limpio = String(handle || "").trim().replace(/^@+/, "");

  if (!limpio) {
    return { estado: "OK", cuenta: null, llamadas: 0, motivo: "handle vacio" };
  }

  const r = await pedir(
    `${ENDPOINT_USUARIO}/${encodeURIComponent(limpio)}?user.fields=${CAMPOS_USUARIO}`,
    { ...opciones, etiqueta: "X usuario" }
  ).catch((e) => ({ ok: false, estado: "ERROR", motivo: e?.message }));

  if (!r.ok) {
    return { estado: r.estado, cuenta: null, llamadas: 1, motivo: r.motivo };
  }

  const item = r.datos?.data || null;

  if (!item) {
    return {
      estado: "NO_ENCONTRADO",
      cuenta: null,
      llamadas: 1,
      motivo: `X no devuelve ninguna cuenta con el handle @${limpio}. NO significa que no exista: significa que ese handle no resuelve.`
    };
  }

  return { estado: "OK", cuenta: normalizarUsuario(item), llamadas: 1 };
}


/*
===========================================================
PUBLICACIONES DE UNA CUENTA
===========================================================
*/
export async function listarPublicaciones(userId, opciones = {}) {
  if (!estaConfigurado()) {
    return { estado: "SIN_CREDENCIAL", publicaciones: [], llamadas: 0 };
  }

  if (!userId) {
    return { estado: "OK", publicaciones: [], llamadas: 0, motivo: "sin userId" };
  }

  /* Muestra pequena por defecto: validar no exige volcar. */
  const cuantos = Math.min(Math.max(5, opciones.maximo || 5), 100);

  const r = await pedir(
    `${ENDPOINT_TIMELINE(userId)}?max_results=${cuantos}&tweet.fields=${CAMPOS_POST}`,
    { ...opciones, etiqueta: "X timeline" }
  ).catch((e) => ({ ok: false, estado: "ERROR", motivo: e?.message }));

  if (!r.ok) {
    return { estado: r.estado, publicaciones: [], llamadas: 1, motivo: r.motivo };
  }

  const items = r.datos?.data || [];

  return {
    estado: "OK",
    publicaciones: items
      .map((it) =>
        normalizarPost(it, {
          handle: opciones.handle || null,
          userId,
          observedAt: opciones.observedAt || null
        })
      )
      .filter(Boolean),
    llamadas: 1
  };
}


/*
===========================================================
RESOLVER POSTS POR ID — MEDIA-PIECE-02
===========================================================

El equivalente de `youtubeAdapter.resolverVideos`. Faltaba, y su
ausencia era la causa exacta de que MEDIA-PIECE reconociera una
URL de X pero no trajera ninguna metrica: habia un mapa de
metricas completo en `normalizarPost` y ningun camino desde un
`postId` hasta la API.

`GET /2/tweets?ids=` es el unico endpoint que resuelve una
publicacion concreta de un tercero sin recorrer su timeline. Con
`expansions=author_id` la misma llamada devuelve el autor, que es
justo lo que la URL de un post no siempre lleva
(`x.com/i/status/123`).

Una llamada por lote, hasta 100 ids. No hay reintentos: un 403
aqui significa «tu plan no lo cubre» y repetirlo no lo cambia.
===========================================================
*/
export async function resolverPosts(postIds = [], opciones = {}) {
  if (!estaConfigurado()) {
    return { estado: "SIN_CREDENCIAL", posts: [], llamadas: 0 };
  }

  const ids = (Array.isArray(postIds) ? postIds : [postIds])
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 100);

  if (!ids.length) {
    return { estado: "OK", posts: [], llamadas: 0, motivo: "sin ids" };
  }

  const params = new URLSearchParams({
    ids: ids.join(","),
    "tweet.fields": CAMPOS_POST,
    expansions: "author_id",
    "user.fields": "username,name,public_metrics"
  });

  const r = await pedir(`${BASE}/tweets?${params}`, {
    ...opciones,
    etiqueta: "X tweets"
  }).catch((e) => ({ ok: false, estado: "ERROR", motivo: e?.message }));

  if (!r.ok) {
    return { estado: r.estado, posts: [], llamadas: 1, motivo: r.motivo };
  }

  const items = r.datos?.data || [];

  /* El autor llega en `includes`, no dentro del post. */
  const usuarios = new Map(
    (r.datos?.includes?.users || []).map((u) => [u.id, u])
  );

  const posts = items
    .map((it) => {
      const autor = usuarios.get(it.author_id) || null;

      const ev = normalizarPost(it, {
        handle: autor?.username || opciones.handle || null,
        userId: it.author_id || null,
        observedAt: opciones.observedAt || null
      });

      if (ev && autor) {
        ev.x.autor = {
          userId: autor.id,
          handle: autor.username || null,
          displayName: autor.name || null,
          followers: autor.public_metrics?.followers_count ?? null,

          procedencia: `${ID}:tweets?expansions=author_id`,

          nota:
            "El autor lo devuelve la propia API, no se dedujo de la URL."
        };
      }

      return ev;
    })
    .filter(Boolean);

  /*
    IDs pedidos que la API no devolvio: post borrado, cuenta
    protegida o id inexistente. Se declara en lugar de perderlos.
  */
  const devueltos = new Set(posts.map((p) => p.x?.postId));

  return {
    estado: "OK",
    posts,
    noDevueltos: ids.filter((id) => !devueltos.has(id)),
    errores: r.datos?.errors || [],
    llamadas: 1
  };
}


/*
===========================================================
MENCIONES — LA CAPACIDAD QUE NINGUNA OTRA PLATAFORMA DA
===========================================================

Quien habla del candidato, no lo que el candidato publica. Es la
mitad que le falta a Candidate Intelligence.

La ventana de `search/recent` son 7 dias. El archivo completo
pertenece a los niveles superiores, y eso se declara en lugar de
presentar 7 dias como si fueran todo.
===========================================================
*/
export async function buscarMenciones(consulta, opciones = {}) {
  if (!estaConfigurado()) {
    return { estado: "SIN_CREDENCIAL", evidencias: [], llamadas: 0 };
  }

  if (!consulta) {
    return { estado: "OK", evidencias: [], llamadas: 0, motivo: "consulta vacia" };
  }

  const cuantos = Math.min(Math.max(10, opciones.maximo || 10), 100);

  /*
    AUTOR DE CADA RESULTADO — TERRITORIAL-CREDENTIAL-ACTIVATION-01

    `tweet.fields` ya traia `author_id`, que es un numero: sirve
    para deduplicar y no para saber quien publica. Sin el handle,
    el descubrimiento territorial encontraria conversacion sin
    emisor, que es exactamente el problema que ya tenemos con
    Google News.

    La expansion es OPT-IN a proposito. Este adapter lo comparte
    Candidate, y alli `buscarMenciones` se usa sobre cuentas ya
    conocidas donde el autor no hace falta: cambiar el
    comportamiento por defecto le añadiria un coste sin darle
    nada.

    Se piden `username` y `name` de cuentas PUBLICAS: lo minimo
    para procedencia, dedup y alta de actor. Nada de metricas de
    seguidores, biografia ni ubicacion declarada.
  */
  const conAutores = opciones.expandirAutores === true;

  const expansiones = conAutores ? "&expansions=author_id&user.fields=username,name" : "";

  const r = await pedir(
    `${ENDPOINT_BUSQUEDA_RECIENTE}?query=${encodeURIComponent(consulta)}` +
      `&max_results=${cuantos}&tweet.fields=${CAMPOS_POST}${expansiones}`,
    { ...opciones, etiqueta: "X busqueda" }
  ).catch((e) => ({ ok: false, estado: "ERROR", motivo: e?.message }));

  if (!r.ok) {
    return { estado: r.estado, evidencias: [], llamadas: 1, motivo: r.motivo };
  }

  /* author_id -> handle, solo si se pidio la expansion. */
  const usuarios = new Map(
    ((conAutores && r.datos?.includes?.users) || []).map((u) => [u.id, u])
  );

  return {
    estado: "OK",

    evidencias: (r.datos?.data || [])
      .map((it) => {
        const u = usuarios.get(it.author_id) || null;

        return normalizarPost(it, {
          observedAt: opciones.observedAt || null,

          /* Se propaga la procedencia de la consulta hasta la evidencia. */
          query: consulta,
          queryType: opciones.queryType || null,
          queryLabel: opciones.queryLabel || null,

          /*
            `userId` es lo que hace que `normalizarPost` emita
            `sourceId: x:<id>` en lugar de `x.com`. Con el, cada
            post queda atribuido a SU cuenta y no a la
            plataforma entera.
          */
          userId: u ? u.id : undefined,
          handle: u ? u.username : undefined,
          nombre: u ? u.name : undefined
        });
      })
      .filter(Boolean),

    llamadas: 1,

    autoresExpandidos: conAutores,

    ventana: "7 dias",
    limitacion:
      "search/recent cubre 7 dias. El archivo completo pertenece a los niveles superiores de la API: una ventana de 7 dias NO es «todo lo que se ha dicho»."
  };
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

    cubreTerceros: true,
    autorizacionDelTitular: false,

    endpoints: {
      usuario: `${ENDPOINT_USUARIO}/:username`,
      timeline: `${BASE}/users/:id/tweets`,
      busquedaReciente: ENDPOINT_BUSQUEDA_RECIENTE
    },

    /* NO se inventa. */
    costoPorConsulta: COSTE_POR_LLAMADA,
    cuotaDeclarada: CUOTA_DIARIA_GRATUITA,
    motivoCosto:
      "El coste y las cuotas dependen del plan contratado y han cambiado varias veces. No constan y no se estiman: se cuentan llamadas, no dinero.",

    coberturaDeclarada: ["social", "menciones"],

    limitaciones: [
      "La lectura de timelines de terceros vive en los niveles de pago: el nivel gratuito no la cubre.",
      "`search/recent` cubre 7 dias. El archivo completo pertenece a los niveles superiores.",
      "`impression_count` no siempre viene para publicaciones de terceros. Su ausencia NO es cero.",
      "La marca de verificado es una suscripcion de pago, no una comprobacion de identidad: no corrobora nada.",
      "Un HTTP 403 aqui suele significar «tu plan no incluye este endpoint», no «no tienes permiso»."
    ],

    resuelve:
      "Es la unica plataforma pendiente que entrega MENCIONES de terceros. Hoy Candidate Intelligence solo puede medir lo que publica el candidato; esto anade quien habla de el."
  };
}


export default {
  ID,
  NOMBRE,
  TIPO,
  PRIORIDAD,
  COSTE_POR_LLAMADA,
  CUOTA_DIARIA_GRATUITA,
  DISPONIBILIDAD_METRICA,
  estaConfigurado,
  resolverCuentaPorHandle,
  resolverPosts,
  listarPublicaciones,
  buscarMenciones,
  normalizarUsuario,
  normalizarPost,
  diagnostico
};
