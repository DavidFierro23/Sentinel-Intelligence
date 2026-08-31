// apps/backend/services/ingest/adapters/instagramAdapter.js

/*
===========================================================
INSTAGRAM — ADAPTER (META-IG-REAL-01)
===========================================================

Misma forma que `youtubeAdapter` y `xAdapter`: `ID`,
`estaConfigurado`, estado `SIN_CREDENCIAL`, normalizadores y
`diagnostico`.

LA DISTINCION QUE ORGANIZA TODO ESTE FICHERO
-----------------------------------------------------------

    CUENTA PROPIA / AUTORIZADA   nos dieron un token
    CUENTA DE TERCERO            no nos lo van a dar

Instagram entrega muchisimo de la primera y casi nada de la
segunda. Y como Candidate Intelligence observa a terceros que no
van a autorizar nada, medir bien nuestra propia cuenta NO
significa que Instagram este resuelto.

Por eso cada metrica declara su ALCANCE:

    PUBLIC_METRIC   visible para cualquiera en la pagina
    OWNER_INSIGHT   solo la ve quien administra la cuenta

Confundirlas seria el error caro: presentar como «dato publico
del candidato» algo que solo existe porque somos duenos de la
cuenta que estamos mirando.

EL TOKEN NO SE ESCRIBE EN NINGUN SITIO
-----------------------------------------------------------

Viaja en la query porque la API lo exige, y por eso ninguna URL
sale de este fichero sin pasar por `sanitizar()`. Lo que se
registra es la RUTA, nunca la URL completa.
===========================================================
*/


export const ID = "instagram_graph";

export const NOMBRE = "Instagram Graph API";

export const TIPO = "social";

export const PRIORIDAD = 6;


/*
  Dos hosts, y no son intercambiables.

  `graph.instagram.com` sirve al flujo de Instagram Login: el
  token pertenece a UNA cuenta y `/me` es esa cuenta.

  `graph.facebook.com` sirve al flujo de Facebook Login, y es el
  unico que expone `business_discovery`, que es la via a cuentas
  de terceros. Cual de los dos responde depende de como se genero
  el token, y eso se comprueba, no se supone.
*/
export const BASE_IG = "https://graph.instagram.com";

export const BASE_FB = "https://graph.facebook.com";

const VERSION = process.env.META_API_VERSION || "v23.0";

const TIEMPO_MAXIMO_MS = 12000;

/*
===========================================================
DOS HOSTS, DOS FAMILIAS DE TOKEN
===========================================================

Este bloque existe por lo que midio META-THIRD-PARTY-REAL-01.

Antes habia UNA lista de variables y una sola funcion
`credencial()`, y el token que devolvia se enviaba a los dos
hosts. Con un solo token configurado eso parece inofensivo.
No lo es: `graph.facebook.com` recibio el token de Instagram
Login y devolvio

    400 · code 190 · «Cannot parse access token»

que leido literalmente manda a regenerar el token. El token
estaba perfecto; iba al sitio equivocado.

Y el defecto sobreviviria a la solucion: al anadir un token de
Facebook, `graph.facebook.com` habria seguido recibiendo el de
Instagram, porque era el primero de la lista. El mismo 190,
ahora con la credencial correcta guardada al lado y sin usarse
— el peor caso posible, porque parece que la configuracion ya
esta hecha.

Asi que la eleccion del token la decide el HOST, no el orden de
una lista.

    graph.instagram.com   Instagram User access token
                          flujo: Instagram Login

    graph.facebook.com    Facebook User access token
                          flujo: Facebook Login for Business

Y NO hay respaldo cruzado. Si falta el de Facebook, la llamada
se detiene con un bloqueo declarado en lugar de mandar el de
Instagram y recibir un error que habla de otra cosa.
===========================================================
*/
const VARIABLES_IG = ["INSTAGRAM_ACCESS_TOKEN", "IG_ACCESS_TOKEN"];

const VARIABLES_FB = [
  "FACEBOOK_USER_ACCESS_TOKEN",
  "FACEBOOK_ACCESS_TOKEN",
  "FB_USER_ACCESS_TOKEN"
];


/*
  Lectura PEREZOSA: en server.js los `import` se evaluan antes
  que `dotenv.config()`. Mismo motivo que en youtubeAdapter.
*/
function primeraDefinida(nombres) {
  for (const nombre of nombres) {
    const v = process.env[nombre];

    if (v && v.trim()) return v.trim();
  }

  return null;
}


export const FAMILIA = Object.freeze({
  INSTAGRAM_LOGIN: "INSTAGRAM_USER_ACCESS_TOKEN",
  FACEBOOK_LOGIN: "FACEBOOK_USER_ACCESS_TOKEN"
});


export function familiaDeHost(base) {
  return String(base || "").includes("graph.facebook.com")
    ? FAMILIA.FACEBOOK_LOGIN
    : FAMILIA.INSTAGRAM_LOGIN;
}


/*
  El token que corresponde a un host. `null` si no esta
  configurado, y nunca el del otro host.
*/
function credencialDeHost(base) {
  return familiaDeHost(base) === FAMILIA.FACEBOOK_LOGIN
    ? primeraDefinida(VARIABLES_FB)
    : primeraDefinida(VARIABLES_IG);
}


/*
  Compatibilidad: `credencial()` sigue significando «el token de
  Instagram Login», que es lo que significaba antes en la
  practica. No se le da otro sentido para no romper a quien la
  use esperando eso.
*/
function credencial() {
  return primeraDefinida(VARIABLES_IG);
}


export function estaConfigurado() {
  return Boolean(credencial());
}


/*
  Estado de credenciales por familia, sin valores. Es lo que
  puede mirar un diagnostico o la matriz de capacidades sin
  riesgo de filtrar nada.
*/
export function estadoDeCredenciales() {
  const ig = Boolean(primeraDefinida(VARIABLES_IG));
  const fb = Boolean(primeraDefinida(VARIABLES_FB));

  return {
    instagramLogin: {
      familia: FAMILIA.INSTAGRAM_LOGIN,
      configurada: ig,
      host: BASE_IG,
      variables: VARIABLES_IG,
      alcanza: ig ? ["cuenta propia y su contenido"] : []
    },

    facebookLogin: {
      familia: FAMILIA.FACEBOOK_LOGIN,
      configurada: fb,
      host: BASE_FB,
      variables: VARIABLES_FB,

      /*
        Deliberadamente vacio incluso cuando esta configurada.
        Tener el token no dice a quien alcanza: eso lo decide el
        nivel de acceso de la app, y se sabra al llamar.
      */
      alcanza: [],

      nota: fb
        ? "Token presente. CREDENCIAL_PARSEABLE no es acceso a terceros: el alcance lo decide el nivel de acceso de la app y se mide llamando."
        : "Sin token de Facebook Login no hay ninguna llamada posible a graph.facebook.com. No se usa el de Instagram como respaldo."
    },

    /*
      El estado que este gate podia alcanzar, y ni uno mas.
    */
    listoParaReintentarTerceros: fb,

    noSignifica: [
      "BUSINESS_DISCOVERY_FUNCIONA",
      "FACEBOOK_PAGE_TERCERO_FUNCIONA",
      "MEDIDO_TERCERO",
      "BENCHMARK_HABILITADO"
    ]
  };
}


/*
  Ninguna URL ni ningun mensaje de error sale de aqui con el
  token dentro. Se sustituye siempre, incluso en los cuerpos de
  error que Meta a veces devuelve con la peticion completa.
*/
export function sanitizar(texto) {
  const t = String(texto || "");

  let limpio = t.replace(/access_token=[^&\s"']+/gi, "access_token=REDACTADO");

  /*
    LAS DOS FAMILIAS. Antes se redactaba solo la de Instagram, y
    con un unico token daba igual. Ahora hay dos y el mensaje de
    error de un host puede traer el token del otro: redactar solo
    uno seria dejar el otro a la vista precisamente en el fallo
    que alguien va a copiar y pegar.
  */
  [primeraDefinida(VARIABLES_IG), primeraDefinida(VARIABLES_FB)]
    .filter(Boolean)
    .forEach((clave) => {
      limpio = limpio.split(clave).join("REDACTADO");
    });

  return limpio;
}


/* Coste: la API no factura por llamada, limita por ventana. */
export const COSTE_POR_LLAMADA = null;

export const CUOTA_DIARIA_GRATUITA = null;


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
  Clasificacion de fallo. Meta devuelve mucha informacion util en
  el cuerpo —`error.type`, `error.code`, `error.message`— y ahi
  esta la diferencia entre «te falta un permiso» y «ese producto
  no existe para este token».
*/
function clasificar(status, cuerpo) {
  const texto = String(cuerpo || "").toLowerCase();

  if (status === 429 || /rate limit|too many/.test(texto)) {
    return "LIMITE_DE_PETICIONES";
  }

  if (status === 401 || /invalid.*token|session.*expired|oauthexception.*190/.test(texto)) {
    return "CREDENCIAL_RECHAZADA";
  }

  if (/permission|scope|not authorized|insufficient/.test(texto)) {
    return "PERMISO_INSUFICIENTE";
  }

  if (/nonexisting field|unsupported get request|does not exist|cannot be loaded/.test(texto)) {
    return "NO_SOPORTADO_POR_ESTA_CONFIGURACION";
  }

  if (status === 400) return "PETICION_RECHAZADA";

  if (status === 403) return "PROHIBIDO";

  return "ERROR";
}


async function pedir(base, ruta, params, opciones = {}) {
  const clave = credencialDeHost(base);

  /*
    Sin la credencial de ESTE host no se llama. Antes se enviaba
    la del otro y Meta devolvia un 190 que hablaba de la
    credencial cuando el problema era el flujo. Un bloqueo
    declarado aqui ahorra la llamada y el diagnostico erroneo.
  */
  if (!clave) {
    const familia = familiaDeHost(base);

    return {
      ok: false,
      httpStatus: null,
      endpoint: `${base.replace("https://", "")}/${VERSION}${ruta}`,
      estado: "SIN_CREDENCIAL",
      familiaRequerida: familia,
      motivo:
        `no hay token de la familia ${familia} configurado, y no se usa el del otro host como respaldo. La llamada no se realizo.`,
      codigo: null
    };
  }

  const fetchImpl = opciones.fetch || globalThis.fetch;

  const q = new URLSearchParams({ ...params, access_token: clave });

  /* La URL con token NUNCA sale de esta funcion. */
  const url = `${base}/${VERSION}${ruta}?${q}`;

  const rutaVisible = `${base.replace("https://", "")}/${VERSION}${ruta}`;

  try {
    const r = await conTiempoLimite(
      fetchImpl(url, { headers: { Accept: "application/json" } }),
      TIEMPO_MAXIMO_MS,
      opciones.etiqueta || "Instagram"
    );

    const texto = await r.text();

    if (!r.ok) {
      let detalle = null;

      try {
        detalle = JSON.parse(texto)?.error || null;
      } catch {
        detalle = null;
      }

      return {
        ok: false,
        httpStatus: r.status,
        endpoint: rutaVisible,
        estado: clasificar(r.status, texto),
        motivo: sanitizar(
          detalle?.message || `HTTP ${r.status}: ${texto.slice(0, 200)}`
        ),
        codigo: detalle?.code ?? null,
        subcodigo: detalle?.error_subcode ?? null,
        tipo: detalle?.type || null
      };
    }

    return {
      ok: true,
      httpStatus: r.status,
      endpoint: rutaVisible,
      datos: JSON.parse(texto)
    };
  } catch (e) {
    return {
      ok: false,
      httpStatus: null,
      endpoint: rutaVisible,
      estado: "ERROR",
      motivo: sanitizar(e?.message || "fallo de red")
    };
  }
}


/*
-----------------------------------------------------------
ALCANCE DE CADA METRICA

`PUBLIC_METRIC` la ve cualquiera entrando al perfil.
`OWNER_INSIGHT` solo existe porque administramos la cuenta.

Esta etiqueta es lo que impide que una cifra de nuestra propia
cuenta se presente el dia de manana como si fuera un dato
publico de un candidato.
-----------------------------------------------------------
*/
/*
===========================================================
PAGINA DE FACEBOOK DE UN TERCERO
===========================================================

Lectura directa de una Page por su nombre de vanidad. Es la
llamada mas simple que existe para la pregunta «podemos ver
hoy la pagina de un candidato», y por eso es la que conviene
hacer: si falla, falla por la razon estructural y no por la
complejidad de la peticion.

Vive en `graph.facebook.com`, que es el host de Page Public
Content Access.
===========================================================
*/
export async function paginaDeTercero(identificador, opciones = {}) {
  /*
    La guarda pregunta por la credencial de Facebook, no por la
    de Instagram: son familias distintas y esta llamada vive en
    graph.facebook.com. Con la guarda anterior, tener token de
    Instagram bastaba para intentar una llamada que no podia
    funcionar.
  */
  const estado = estadoDeCredenciales();

  if (!estado.facebookLogin.configurada) {
    return {
      estado: "SIN_CREDENCIAL",
      pagina: null,
      llamadas: 0,
      familiaRequerida: FAMILIA.FACEBOOK_LOGIN,
      motivo: estado.facebookLogin.nota
    };
  }

  const limpio = String(identificador || "").trim().replace(/^@+/, "");

  if (!limpio) {
    return {
      estado: "OK",
      pagina: null,
      llamadas: 0,
      motivo: "hace falta el identificador o el nombre de vanidad de la pagina"
    };
  }

  const campos =
    opciones.campos ||
    "id,name,username,link,followers_count,fan_count,is_published,verification_status";

  const r = await pedir(
    BASE_FB,
    `/${limpio}`,
    { fields: campos },
    { ...opciones, etiqueta: "Facebook Page" }
  );

  if (!r.ok) {
    return {
      estado: r.estado,
      pagina: null,

      /*
        Cero si la llamada nunca salio. El presupuesto de este
        proyecto se cuenta en llamadas reales, asi que contar una
        que no se hizo falsea el unico numero que importa.
      */
      llamadas: r.estado === "SIN_CREDENCIAL" ? 0 : 1,
      familiaRequerida: r.familiaRequerida || null,
      httpStatus: r.httpStatus,
      endpoint: r.endpoint,
      motivo: r.motivo,
      codigo: r.codigo,
      subcodigo: r.subcodigo,
      tipo: r.tipo,
      objetivo: limpio,
      observadoEn: new Date().toISOString()
    };
  }

  return {
    estado: "OK",
    llamadas: 1,
    httpStatus: r.httpStatus,
    endpoint: r.endpoint,
    objetivo: limpio,
    observadoEn: new Date().toISOString(),

    pagina: {
      id: r.datos?.id ?? null,
      name: r.datos?.name ?? null,
      username: r.datos?.username ?? null,
      link: r.datos?.link ?? null,

      /*
        `followers_count` y `fan_count` son cifras distintas y
        Meta las devuelve por separado. No se funden ni se
        rellena una con la otra.
      */
      followers_count: r.datos?.followers_count ?? null,
      fan_count: r.datos?.fan_count ?? null,

      is_published: r.datos?.is_published ?? null,
      verification_status: r.datos?.verification_status ?? null
    },

    crudo: r.datos
  };
}


export const ALCANCE = Object.freeze({
  PUBLIC_METRIC: "PUBLIC_METRIC",
  OWNER_INSIGHT: "OWNER_INSIGHT"
});


export const DISPONIBILIDAD_METRICA = Object.freeze({
  DISPONIBLE: "DISPONIBLE",
  NO_DISPONIBLE: "NO_DISPONIBLE",
  NO_AUTORIZADO: "NO_AUTORIZADO",
  NO_INCLUIDA_POR_LA_API: "NO_INCLUIDA_POR_LA_API"
});


function metrica(objeto, campo, alcance, nota) {
  const bruto = objeto?.[campo];

  if (bruto == null) {
    return {
      value: null,
      alcance,
      availability: DISPONIBILIDAD_METRICA.NO_INCLUIDA_POR_LA_API,
      motivo: nota || `la API no incluyo ${campo} en la respuesta`
    };
  }

  const n = Number(bruto);

  return Number.isFinite(n)
    ? {
        value: n,
        alcance,
        availability: DISPONIBILIDAD_METRICA.DISPONIBLE,
        motivo: null
      }
    : {
        value: null,
        alcance,
        availability: DISPONIBILIDAD_METRICA.NO_DISPONIBLE,
        motivo: `${campo} no es un numero utilizable`
      };
}


/*
===========================================================
PERFIL DE LA CUENTA AUTORIZADA
===========================================================

`/me` con un token de Instagram Login devuelve la cuenta a la
que pertenece el token. No hay que conocer su id de antemano, y
por eso no se hardcodea ninguno.
===========================================================
*/
const CAMPOS_PERFIL = [
  "user_id",
  "username",
  "name",
  "account_type",
  "media_count",
  "followers_count",
  "follows_count",
  "profile_picture_url"
].join(",");


export function normalizarPerfil(d) {
  if (!d) return null;

  return {
    userId: d.user_id || d.id || null,
    handle: d.username || null,
    displayName: d.name || null,
    accountType: d.account_type || null,

    url: d.username ? `https://www.instagram.com/${d.username}/` : null,

    /*
      Estas tres son visibles en el perfil publico, asi que son
      PUBLIC_METRIC aunque las estemos leyendo con nuestro token.
      La etiqueta describe el DATO, no como lo obtuvimos.
    */
    estadisticasPublicas: {
      followers: metrica(d, "followers_count", ALCANCE.PUBLIC_METRIC),
      following: metrica(d, "follows_count", ALCANCE.PUBLIC_METRIC),
      publicaciones: metrica(d, "media_count", ALCANCE.PUBLIC_METRIC),

      declaracion:
        "Cifras visibles en el perfil publico. NO clasifican a la cuenta: no existe un umbral defendible de seguidores para llamar «influencer» a nadie."
    },

    fotoPerfil: d.profile_picture_url || null,

    camposDevueltos: Object.keys(d)
  };
}


export async function resolverCuentaPropia(opciones = {}) {
  if (!estaConfigurado()) {
    return {
      estado: "SIN_CREDENCIAL",
      perfil: null,
      llamadas: 0,
      motivo: `Falta ${VARIABLES_IG[0]} en apps/backend/.env. El adapter esta completo; sin credencial no se invoca y Sentinel sigue funcionando.`
    };
  }

  const r = await pedir(BASE_IG, "/me", { fields: CAMPOS_PERFIL }, {
    ...opciones,
    etiqueta: "Instagram perfil"
  });

  if (!r.ok) {
    return {
      estado: r.estado,
      perfil: null,
      llamadas: 1,
      httpStatus: r.httpStatus,
      endpoint: r.endpoint,
      motivo: r.motivo,
      codigo: r.codigo
    };
  }

  return {
    estado: "OK",
    perfil: normalizarPerfil(r.datos),
    llamadas: 1,
    httpStatus: r.httpStatus,
    endpoint: r.endpoint,
    camposSolicitados: CAMPOS_PERFIL.split(",")
  };
}


/*
===========================================================
PUBLICACIONES PROPIAS
===========================================================

`like_count` y `comments_count` son campos de la publicacion, no
insights: se piden aqui y son PUBLIC_METRIC. Las metricas que
exigen ser dueno viven en `/insights` y se piden aparte, a
proposito, para que la separacion sea visible en el codigo y no
solo en un comentario.
===========================================================
*/
const CAMPOS_MEDIA = [
  "id",
  "caption",
  "media_type",
  "media_product_type",
  "permalink",
  "timestamp",
  "thumbnail_url",
  "like_count",
  "comments_count"
].join(",");


export function normalizarPublicacion(d, contexto = {}) {
  if (!d?.id) return null;

  /*
    `media_product_type` distingue un REEL de una publicacion del
    feed; `media_type` distingue imagen de video o carrusel. Los
    dos hacen falta: un REEL es VIDEO en `media_type`.
  */
  const tipo =
    d.media_product_type === "REELS"
      ? "REEL"
      : d.media_type === "CAROUSEL_ALBUM"
        ? "CAROUSEL"
        : d.media_type || "DESCONOCIDO";

  return {
    postId: d.id,
    canonicalUrl: d.permalink || null,
    publishedAt: d.timestamp || null,

    tipo,
    mediaType: d.media_type || null,
    mediaProductType: d.media_product_type || null,

    /* Texto, no binario: no se descarga ninguna imagen. */
    caption: d.caption || null,

    /* Referencia a la miniatura. NO se descarga. */
    thumbnailUrl: d.thumbnail_url || null,

    handle: contexto.handle || null,

    metricas: {
      likes: metrica(d, "like_count", ALCANCE.PUBLIC_METRIC),
      comments: metrica(d, "comments_count", ALCANCE.PUBLIC_METRIC)
    },

    camposDevueltos: Object.keys(d)
  };
}


export async function listarPublicacionesPropias(opciones = {}) {
  if (!estaConfigurado()) {
    return { estado: "SIN_CREDENCIAL", publicaciones: [], llamadas: 0 };
  }

  const limite = Math.min(Math.max(1, opciones.maximo || 5), 25);

  const r = await pedir(
    BASE_IG,
    "/me/media",
    { fields: CAMPOS_MEDIA, limit: String(limite) },
    { ...opciones, etiqueta: "Instagram media" }
  );

  if (!r.ok) {
    return {
      estado: r.estado,
      publicaciones: [],
      llamadas: 1,
      httpStatus: r.httpStatus,
      endpoint: r.endpoint,
      motivo: r.motivo
    };
  }

  return {
    estado: "OK",
    publicaciones: (r.datos?.data || [])
      .map((x) => normalizarPublicacion(x, { handle: opciones.handle }))
      .filter(Boolean),
    llamadas: 1,
    httpStatus: r.httpStatus,
    endpoint: r.endpoint,
    camposSolicitados: CAMPOS_MEDIA.split(",")
  };
}


/*
===========================================================
INSIGHTS DE UNA PUBLICACION — SOLO DE LA CUENTA PROPIA
===========================================================

Todo lo que sale de aqui es OWNER_INSIGHT. Existe porque
administramos la cuenta, y NO estaria disponible para el
Instagram de un candidato.

Se pide una sola publicacion: el objetivo es saber QUE metricas
existen, no recolectar.
===========================================================
*/
export const METRICAS_INSIGHT = Object.freeze([
  "reach",
  "saved",
  "shares",
  "total_interactions",
  "views"
]);


export async function insightsDePublicacion(mediaId, opciones = {}) {
  if (!estaConfigurado()) {
    return { estado: "SIN_CREDENCIAL", metricas: {}, llamadas: 0 };
  }

  if (!mediaId) {
    return { estado: "OK", metricas: {}, llamadas: 0, motivo: "sin mediaId" };
  }

  const pedidas = opciones.metricas || METRICAS_INSIGHT;

  const r = await pedir(
    BASE_IG,
    `/${mediaId}/insights`,
    { metric: pedidas.join(",") },
    { ...opciones, etiqueta: "Instagram insights" }
  );

  if (!r.ok) {
    return {
      estado: r.estado,
      metricas: {},
      llamadas: 1,
      httpStatus: r.httpStatus,
      endpoint: r.endpoint,
      motivo: r.motivo,

      /*
        Que una metrica no exista para este tipo de publicacion es
        distinto de que no tengamos permiso. Meta lo dice en el
        mensaje y aqui se conserva.
      */
      metricasPedidas: pedidas
    };
  }

  const salida = {};

  (r.datos?.data || []).forEach((m) => {
    const valor = m?.values?.[0]?.value;

    salida[m.name] = {
      value: valor ?? null,
      alcance: ALCANCE.OWNER_INSIGHT,
      availability:
        valor == null
          ? DISPONIBILIDAD_METRICA.NO_INCLUIDA_POR_LA_API
          : DISPONIBILIDAD_METRICA.DISPONIBLE,
      titulo: m.title || null,
      motivo:
        valor == null ? "la API devolvio la metrica sin valor" : null
    };
  });

  /* Las pedidas que no volvieron: se declaran, no se pierden. */
  const noDevueltas = pedidas.filter((m) => !(m in salida));

  return {
    estado: "OK",
    metricas: salida,
    noDevueltas,
    llamadas: 1,
    httpStatus: r.httpStatus,
    endpoint: r.endpoint,
    metricasPedidas: pedidas
  };
}


/*
===========================================================
CUENTA PROFESIONAL DE UN TERCERO — business_discovery
===========================================================

LA PREGUNTA QUE DECIDE SI INSTAGRAM SIRVE PARA ESTE PRODUCTO.

`business_discovery` vive en `graph.facebook.com` y se pide
DESDE nuestra cuenta profesional: «yo, que soy esta cuenta,
pregunto por esa otra». Exige el flujo de Facebook Login, una
app revisada y verificacion de empresa.

Si el token es de Instagram Login, esto NO va a funcionar, y el
error de Meta es la evidencia. No se improvisa ningun endpoint
alternativo ni se busca una via lateral: se pregunta una vez y se
registra la respuesta.
===========================================================
*/
export async function descubrirCuentaProfesional(igUserId, usuarioObjetivo, opciones = {}) {
  /*
    El host es un parametro porque hay dos candidatos y la
    diferencia no es cosmetica:

        graph.facebook.com    flujo de Facebook Login
        graph.instagram.com   flujo de Instagram Login

    META-IG-REAL-01 midio el primero y devolvio 190. El segundo
    no se habia probado, y es el unico host que acepta el token
    que tenemos. Que la documentacion situe `business_discovery`
    en el primero es un argumento; la respuesta del segundo es
    un dato.
  */
  const host = opciones.host || BASE_FB;
  if (!estaConfigurado()) {
    return { estado: "SIN_CREDENCIAL", cuenta: null, llamadas: 0 };
  }

  if (!igUserId || !usuarioObjetivo) {
    return {
      estado: "OK",
      cuenta: null,
      llamadas: 0,
      motivo: "hacen falta el id de nuestra cuenta y el usuario objetivo"
    };
  }

  const limpio = String(usuarioObjetivo).trim().replace(/^@+/, "");

  const campos =
    `business_discovery.username(${limpio})` +
    "{username,name,followers_count,media_count," +
    "media.limit(5){id,caption,media_type,permalink,timestamp,like_count,comments_count}}";

  const r = await pedir(
    host,
    `/${igUserId}`,
    { fields: campos },
    { ...opciones, etiqueta: "Instagram business_discovery" }
  );

  if (!r.ok) {
    /*
      -----------------------------------------------------------
      EL DIAGNOSTICO QUE CAMBIA LA ACCION
      -----------------------------------------------------------

      Medido en META-IG-REAL-01: `graph.facebook.com` respondio
      «Invalid OAuth access token - Cannot parse access token»,
      codigo 190, con un token que en `graph.instagram.com`
      acababa de funcionar.

      Leido literalmente, eso manda a regenerar el token. Y seria
      perder el tiempo: el token esta bien. Lo que pasa es que
      pertenece al flujo de Instagram Login y este host solo
      entiende los de Facebook Login.

      El sintoma dice «credencial»; la causa es «flujo». Se
      distinguen porque llevan a sitios distintos: uno a la
      consola de tokens, el otro a montar Facebook Login con App
      Review y verificacion de empresa.
      -----------------------------------------------------------
    */
    const tokenDeOtroFlujo =
      r.codigo === 190 && /cannot parse|malformed/i.test(String(r.motivo || ""));

    return {
      estado: tokenDeOtroFlujo
        ? "NO_SOPORTADO_POR_ESTA_CONFIGURACION"
        : r.estado,

      cuenta: null,
      llamadas: r.estado === "SIN_CREDENCIAL" ? 0 : 1,
      familiaRequerida: r.familiaRequerida || null,
      httpStatus: r.httpStatus,
      endpoint: r.endpoint,
      motivo: r.motivo,
      codigo: r.codigo,
      objetivo: limpio,

      diagnostico: tokenDeOtroFlujo
        ? {
            causa:
              "El token pertenece al flujo de Instagram Login y este endpoint vive en graph.facebook.com, que solo acepta tokens de Facebook Login.",
            noEs:
              "NO es que la credencial sea invalida: la misma acaba de funcionar contra graph.instagram.com.",
            requisitoFaltante: [
              "app configurada con Facebook Login for Business",
              "pagina de Facebook vinculada a la cuenta profesional de Instagram",
              "App Review de instagram_basic e instagram_manage_insights",
              "Business Verification de la empresa"
            ],
            accion:
              "No regenerar el token: no arreglaria nada. Hay que montar el flujo de Facebook Login."
          }
        : null
    };
  }

  const bd = r.datos?.business_discovery || null;

  if (!bd) {
    return {
      estado: "SIN_DATOS",
      cuenta: null,
      llamadas: 1,
      httpStatus: r.httpStatus,
      endpoint: r.endpoint,
      motivo:
        "la respuesta no incluye business_discovery. NO significa que la cuenta no exista: significa que esta configuracion no lo devuelve.",
      objetivo: limpio
    };
  }

  return {
    estado: "OK",
    llamadas: 1,
    httpStatus: r.httpStatus,
    endpoint: r.endpoint,
    objetivo: limpio,

    cuenta: {
      handle: bd.username || null,
      displayName: bd.name || null,

      estadisticasPublicas: {
        followers: metrica(bd, "followers_count", ALCANCE.PUBLIC_METRIC),
        publicaciones: metrica(bd, "media_count", ALCANCE.PUBLIC_METRIC)
      },

      publicaciones: (bd.media?.data || [])
        .map((x) => normalizarPublicacion(x, { handle: bd.username }))
        .filter(Boolean)
    }
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

    variableEntorno: VARIABLES_IG[0],
    version: VERSION,

    /*
      La respuesta honesta a «tenemos Instagram»: depende de a
      quien queramos mirar.
    */
    cubreCuentaPropia: true,
    cubreTerceros: "por comprobar",

    costoPorConsulta: COSTE_POR_LLAMADA,
    motivoCosto:
      "Meta no factura por llamada en estos endpoints: limita por ventana de tiempo. No hay coste unitario que declarar.",

    limitaciones: [
      "Medir bien nuestra propia cuenta NO significa que Instagram este resuelto: Candidate Intelligence observa a terceros.",
      "Los insights son OWNER_INSIGHT: existen porque administramos la cuenta y no estarian para el Instagram de un candidato.",
      "`business_discovery` exige Facebook Login, App Review y verificacion de empresa, y solo alcanza a cuentas PROFESIONALES.",
      "Las cuentas personales no son accesibles por ninguna via oficial.",
      "No se descargan imagenes ni videos: solo se guarda la referencia."
    ],

    resuelve:
      "Permite medir la cuenta propia con datos reales y, sobre todo, comprobar con evidencia si esta credencial alcanza o no a cuentas de terceros."
  };
}


export default {
  ID,
  NOMBRE,
  TIPO,
  PRIORIDAD,
  ALCANCE,
  DISPONIBILIDAD_METRICA,
  METRICAS_INSIGHT,
  COSTE_POR_LLAMADA,
  CUOTA_DIARIA_GRATUITA,
  estaConfigurado,
  sanitizar,
  resolverCuentaPropia,
  listarPublicacionesPropias,
  insightsDePublicacion,
  descubrirCuentaProfesional,
  normalizarPerfil,
  normalizarPublicacion,
  diagnostico
};
