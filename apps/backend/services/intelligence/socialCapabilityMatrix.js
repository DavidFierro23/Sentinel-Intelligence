// apps/backend/services/intelligence/socialCapabilityMatrix.js

/*
===========================================================
MATRIZ DE CAPACIDADES SOCIALES — P-CAND-03
===========================================================

Una sola matriz para las cinco plataformas. No hay
`TikTokCandidateModel` ni `YouTubeCandidateModel`: cada
plataforma declara QUE se puede leer de ella y todo lo que se
lee alimenta los mismos contratos.

    TikTok video · Instagram reel · Facebook video
    YouTube video · X post

son la misma cosa —`PublicationObservation`— con `platformId`
distinto.

-----------------------------------------------------------
LA REGLA DE ESTA MATRIZ
-----------------------------------------------------------

    NADA EN VERDE POR SUPOSICION.

Cada capacidad lleva `verificacion`, que dice COMO se sabe lo
que dice:

    MEDIDO_EN_PRODUCCION   se ejecuto y funciono
    DOCUMENTADO            lo dice la documentacion oficial
    NO_VERIFICADO          no se ha comprobado

Una capacidad `DISPONIBLE` + `DOCUMENTADO` no es lo mismo que
`DISPONIBLE` + `MEDIDO_EN_PRODUCCION`. La primera puede caerse
el dia que se intente; la segunda ya se intento.

-----------------------------------------------------------
LA DISTINCION QUE LO DECIDE TODO
-----------------------------------------------------------

    CUENTA PROPIA / AUTORIZADA   el titular nos da permiso
    CUENTA DE TERCERO            no nos lo da

Casi toda la documentacion de las APIs sociales habla del primer
caso. Sentinel hace inteligencia electoral: sus objetivos son
terceros que no van a autorizar nada. Confundir los dos casos es
el error que produce hojas de ruta imposibles, asi que cada
capacidad declara `alcance`.
===========================================================
*/


export const ESTADOS_CAPACIDAD = Object.freeze({
  /* Se puede leer hoy, con lo que tenemos. */
  DISPONIBLE: "DISPONIBLE",

  /*
    Existe via oficial pero exige un permiso que no tenemos:
    revision de app, consentimiento del titular, programa de
    investigacion.
  */
  REQUIERE_AUTORIZACION: "REQUIERE_AUTORIZACION",

  /* No existe via oficial para este alcance. */
  NO_DISPONIBLE: "NO_DISPONIBLE",

  /* Solo con un proveedor de datos con licencia. */
  REQUIERE_PROVEEDOR_EXTERNO: "REQUIERE_PROVEEDOR_EXTERNO"
});


export const VERIFICACION = Object.freeze({
  MEDIDO_EN_PRODUCCION: "MEDIDO_EN_PRODUCCION",
  DOCUMENTADO: "DOCUMENTADO",
  NO_VERIFICADO: "NO_VERIFICADO"
});


export const ALCANCES = Object.freeze({
  PROPIA: "CUENTA_PROPIA_O_AUTORIZADA",
  TERCERO: "CUENTA_DE_TERCERO"
});


/*
  Las capacidades que Candidate Intelligence necesita. Son las
  mismas para todas las plataformas: es lo que permite una sola
  matriz y un solo contrato.
*/
export const CAPACIDADES = Object.freeze([
  { id: "identidad", nombre: "Identidad de la cuenta" },
  { id: "cuenta", nombre: "Metadatos de la cuenta" },
  { id: "followers", nombre: "Seguidores o suscriptores" },
  { id: "publicaciones", nombre: "Listado de publicaciones" },
  { id: "views", nombre: "Visualizaciones" },
  { id: "likes", nombre: "Me gusta o reacciones" },
  { id: "comments", nombre: "Comentarios (recuento)" },
  { id: "shares", nombre: "Compartidos o republicaciones" },
  { id: "menciones", nombre: "Menciones de terceros" },
  { id: "busqueda", nombre: "Busqueda" },
  { id: "historico", nombre: "Historico entregado por la fuente" },
  { id: "url_verificable", nombre: "URL canonica verificable" }
]);


const c = (estado, verificacion, nota) => ({ estado, verificacion, nota });

const DISP = ESTADOS_CAPACIDAD.DISPONIBLE;
const AUTZ = ESTADOS_CAPACIDAD.REQUIERE_AUTORIZACION;
const NOPE = ESTADOS_CAPACIDAD.NO_DISPONIBLE;
const PROV = ESTADOS_CAPACIDAD.REQUIERE_PROVEEDOR_EXTERNO;

const MEDIDO = VERIFICACION.MEDIDO_EN_PRODUCCION;
const DOC = VERIFICACION.DOCUMENTADO;


/*
===========================================================
YOUTUBE

La unica plataforma con capacidad MEDIDA. Ver §18-duovicies del
estado del proyecto: se ejecuto contra la API real.
===========================================================
*/
const YOUTUBE = {
  plataformaId: "youtube",
  plataforma: "YouTube",

  apiOficial: "YouTube Data API v3",
  credencial: "YOUTUBE_API_KEY",
  terceros: true,
  autorizacionDelTitular: false,

  notaAlcance:
    "Es la excepcion del grupo: la API entrega datos publicos de canales de TERCEROS sin que el titular autorice nada. Por eso es la unica plataforma donde Candidate Intelligence funciona hoy de verdad.",

  capacidades: {
    identidad: c(DISP, MEDIDO, "channels.list?forHandle resuelve handle -> channelId, 1 unidad"),
    cuenta: c(DISP, MEDIDO, "snippet: titulo, descripcion, fecha de creacion, pais declarado"),
    followers: c(
      DISP,
      MEDIDO,
      "subscriberCount. Puede venir oculto por decision del canal: hiddenSubscriberCount"
    ),
    publicaciones: c(
      DISP,
      MEDIDO,
      "playlistItems.list sobre la lista de subidas, 1 unidad. Es lo que el canal subio, no lo que un buscador considera relevante"
    ),
    views: c(DISP, MEDIDO, "videos.list?part=statistics -> viewCount"),
    likes: c(
      DISP,
      MEDIDO,
      "likeCount. Desaparece del payload si el canal lo oculta: eso no es cero"
    ),
    comments: c(
      DISP,
      MEDIDO,
      "commentCount. Desaparece si el canal desactiva comentarios. Solo el RECUENTO: no se leen comentarios individuales"
    ),
    shares: c(NOPE, DOC, "la API no expone compartidos por video en ningun part"),
    menciones: c(
      AUTZ,
      DOC,
      "search.list encuentra videos que nombran al candidato, pero cuesta 100 unidades por consulta: viable con presupuesto, no por defecto"
    ),
    busqueda: c(DISP, MEDIDO, "search.list, 100 unidades: 100 consultas agotan el dia"),
    historico: c(
      NOPE,
      DOC,
      "la API devuelve el valor de AHORA. La serie temporal la construye Sentinel con snapshots; no la entrega YouTube"
    ),
    url_verificable: c(DISP, MEDIDO, "youtube.com/watch?v=ID es canonica")
  }
};


/*
===========================================================
TIKTOK

Prioridad alta y la peor situacion del grupo para terceros.
===========================================================
*/
const TIKTOK = {
  plataformaId: "tiktok",
  plataforma: "TikTok",

  apiOficial: "TikTok Display API / Research API",
  credencial: null,
  terceros: false,
  autorizacionDelTitular: true,

  notaAlcance:
    "La Display API opera sobre la cuenta que INICIA SESION y autoriza: sirve para que un creador vea sus propios datos, no para observar a un candidato. La Research API si cubre terceros, pero su acceso se concede por solicitud y esta orientado a investigacion academica con afiliacion institucional.",

  capacidades: {
    identidad: c(
      DISP,
      DOC,
      "el handle se lee de la URL publica con SD-1A, sin API. Identifica la cuenta; no da ningun dato de ella"
    ),
    cuenta: c(AUTZ, DOC, "Display API: solo la cuenta autorizada. Research API: por solicitud"),
    followers: c(AUTZ, DOC, "no hay via oficial para terceros sin Research API"),
    publicaciones: c(AUTZ, DOC, "idem"),
    views: c(AUTZ, DOC, "idem"),
    likes: c(AUTZ, DOC, "idem"),
    comments: c(AUTZ, DOC, "idem"),
    shares: c(AUTZ, DOC, "idem"),
    menciones: c(PROV, DOC, "no hay busqueda publica por API"),
    busqueda: c(NOPE, DOC, "sin endpoint de busqueda publica para terceros"),
    historico: c(NOPE, DOC, "ninguna via entrega serie temporal"),
    url_verificable: c(
      DISP,
      DOC,
      "tiktok.com/@handle/video/ID es canonica y se puede construir sin API"
    )
  },

  rutaConcreta: [
    "Solicitar acceso a la Research API declarando el uso. Requiere afiliacion y aprobacion, y su ambito es academico.",
    "O bien contratar un proveedor con licencia: ver TIKTOK-PROVIDER-EVAL-01."
  ]
};


/*
===========================================================
FACEBOOK
===========================================================
*/
const FACEBOOK = {
  plataformaId: "facebook",
  plataforma: "Facebook",

  apiOficial: "Meta Graph API",
  credencial: null,
  terceros: false,
  autorizacionDelTitular: true,

  notaAlcance:
    "Graph API distingue PAGINA de PERFIL. Los datos de una pagina se obtienen con un token de acceso de esa pagina, que solo tiene su administrador; los perfiles personales no son accesibles de ningun modo. El error habitual es leer «se puede consultar paginas publicas» como «cualquiera puede consultar cualquier pagina»: hace falta el token del titular.",

  capacidades: {
    identidad: c(DISP, DOC, "la URL publica identifica la pagina o el perfil, sin API"),
    cuenta: c(
      DISP,
      DOC,
      "metadata publica de la pagina —titulo, og:image— legible sin API. Ninguna metrica"
    ),
    followers: c(AUTZ, DOC, "exige token de la pagina"),
    publicaciones: c(AUTZ, DOC, "idem"),
    views: c(AUTZ, DOC, "video views de pagina: idem"),
    likes: c(AUTZ, DOC, "reacciones: idem"),
    comments: c(AUTZ, DOC, "idem"),
    shares: c(AUTZ, DOC, "idem"),
    menciones: c(
      AUTZ,
      DOC,
      "existio la Content Library / CrowdTangle para investigacion; su acceso es restringido y por solicitud"
    ),
    busqueda: c(NOPE, DOC, "sin busqueda publica por API"),
    historico: c(NOPE, DOC, "ninguna via entrega serie temporal"),
    url_verificable: c(DISP, DOC, "la URL del post es canonica")
  },

  rutaConcreta: [
    "Si el candidato es cliente: pedirle un token de su pagina. Legitimo, y solo sirve para el.",
    "Para observar a un tercero: solicitar acceso a Meta Content Library, o proveedor con licencia (FACEBOOK-PROVIDER-EVAL-01)."
  ]
};


/*
===========================================================
INSTAGRAM
===========================================================
*/
const INSTAGRAM = {
  plataformaId: "instagram",
  plataforma: "Instagram",

  apiOficial: "Instagram Graph API",
  credencial: null,
  terceros: false,
  autorizacionDelTitular: true,

  notaAlcance:
    "Exige cuenta profesional vinculada a una pagina de Facebook Y el token del titular. Existe `business_discovery`, que permite a una cuenta profesional consultar datos publicos de OTRA cuenta profesional: es el unico resquicio real para terceros, y sigue necesitando una cuenta profesional propia con app revisada por Meta.",

  capacidades: {
    identidad: c(DISP, DOC, "el handle se lee de la URL publica con SD-1A"),
    cuenta: c(
      AUTZ,
      DOC,
      "business_discovery da nombre, biografia y foto de otra cuenta PROFESIONAL. No de una personal"
    ),
    followers: c(AUTZ, DOC, "business_discovery: followers_count de cuentas profesionales"),
    publicaciones: c(AUTZ, DOC, "business_discovery: media reciente de cuentas profesionales"),
    views: c(AUTZ, DOC, "reproducciones de reels: solo cuenta propia"),
    likes: c(AUTZ, DOC, "like_count via business_discovery"),
    comments: c(AUTZ, DOC, "comments_count via business_discovery"),
    shares: c(NOPE, DOC, "no expuesto para terceros"),
    menciones: c(AUTZ, DOC, "menciones: solo de la cuenta propia"),
    busqueda: c(NOPE, DOC, "sin busqueda publica por API"),
    historico: c(NOPE, DOC, "ninguna via entrega serie temporal"),
    url_verificable: c(DISP, DOC, "instagram.com/p/ID es canonica")
  },

  rutaConcreta: [
    "Crear una cuenta profesional propia de Sentinel con app revisada por Meta y usar business_discovery. Cubre solo cuentas profesionales del objetivo, que en un candidato con cuenta de campana es lo habitual.",
    "O proveedor con licencia (INSTAGRAM-PROVIDER-EVAL-01)."
  ]
};


/*
===========================================================
X

La mejor del grupo para conversacion y amplificacion, y la que
tiene un precio explicito.
===========================================================
*/
const X = {
  plataformaId: "x",
  plataforma: "X",

  apiOficial: "X API v2",
  credencial: null,
  terceros: true,
  autorizacionDelTitular: false,

  notaAlcance:
    "Tecnicamente cubre terceros sin autorizacion, que la coloca por delante de TikTok, Facebook e Instagram. El obstaculo no es el permiso: es el plan. Los niveles bajos tienen cuotas muy pequenas y la busqueda amplia esta en los niveles altos.",

  capacidades: {
    identidad: c(DISP, DOC, "users/by/username: sin autorizacion del titular"),
    cuenta: c(DISP, DOC, "nombre, descripcion, fecha de creacion"),
    followers: c(DISP, DOC, "public_metrics.followers_count"),
    publicaciones: c(DISP, DOC, "users/:id/tweets, sujeto a la cuota del plan"),
    views: c(DISP, DOC, "public_metrics.impression_count cuando la API lo incluye"),
    likes: c(DISP, DOC, "public_metrics.like_count"),
    comments: c(DISP, DOC, "reply_count"),
    shares: c(DISP, DOC, "retweet_count y quote_count, separados"),
    menciones: c(
      DISP,
      DOC,
      "busqueda reciente por mencion. Es la capacidad que ninguna otra plataforma ofrece"
    ),
    busqueda: c(DISP, DOC, "recent search en niveles bajos; historico completo en los altos"),
    historico: c(
      AUTZ,
      DOC,
      "full-archive search existe pero pertenece a los niveles superiores"
    ),
    url_verificable: c(DISP, DOC, "x.com/handle/status/ID es canonica")
  },

  rutaConcreta: [
    "Medir primero cuantas consultas al dia necesita Sentinel de verdad. El plan se elige DESPUES de esa medicion, no antes.",
    "Ver X-PROVIDER-EVAL-01 para la alternativa por proveedor."
  ]
};


export const PLATAFORMAS = Object.freeze([YOUTUBE, TIKTOK, FACEBOOK, INSTAGRAM, X]);


export function matrizDeCapacidades() {
  const filas = CAPACIDADES.map((cap) => ({
    capacidad: cap.id,
    nombre: cap.nombre,

    porPlataforma: Object.fromEntries(
      PLATAFORMAS.map((p) => [
        p.plataformaId,
        p.capacidades[cap.id] || c(ESTADOS_CAPACIDAD.NO_DISPONIBLE, VERIFICACION.NO_VERIFICADO, null)
      ])
    )
  }));

  /*
    `estado` o `verificacion` en null significa «no filtres por
    eso». Sin esta guarda, contar solo por verificacion daba 0:
    la comparacion `x.estado === null` no coincidia con nada.
  */
  const cuenta = (estado, verificacion) =>
    PLATAFORMAS.reduce(
      (s, p) =>
        s +
        Object.values(p.capacidades).filter(
          (x) =>
            (estado ? x.estado === estado : true) &&
            (verificacion ? x.verificacion === verificacion : true)
        ).length,
      0
    );

  const total = PLATAFORMAS.length * CAPACIDADES.length;

  return {
    version: "1.0",

    plataformas: PLATAFORMAS.map((p) => ({
      plataformaId: p.plataformaId,
      plataforma: p.plataforma,
      apiOficial: p.apiOficial,
      terceros: p.terceros,
      autorizacionDelTitular: p.autorizacionDelTitular,
      notaAlcance: p.notaAlcance,
      rutaConcreta: p.rutaConcreta || [],

      disponibles: Object.values(p.capacidades).filter(
        (x) => x.estado === ESTADOS_CAPACIDAD.DISPONIBLE
      ).length,

      medidas: Object.values(p.capacidades).filter(
        (x) => x.verificacion === VERIFICACION.MEDIDO_EN_PRODUCCION
      ).length,

      capacidades: p.capacidades
    })),

    filas,

    resumen: {
      celdas: total,
      disponibles: cuenta(ESTADOS_CAPACIDAD.DISPONIBLE),
      medidasEnProduccion: cuenta(null, VERIFICACION.MEDIDO_EN_PRODUCCION),
      requierenAutorizacion: cuenta(ESTADOS_CAPACIDAD.REQUIERE_AUTORIZACION),
      noDisponibles: cuenta(ESTADOS_CAPACIDAD.NO_DISPONIBLE),
      requierenProveedor: cuenta(ESTADOS_CAPACIDAD.REQUIERE_PROVEEDOR_EXTERNO)
    },

    lectura:
      "Solo YouTube tiene capacidades MEDIDAS en produccion. Todo lo demas es documentacion oficial sin comprobar, y se marca como tal: una capacidad documentada puede caerse el dia que se intente.",

    regla:
      "Ninguna celda esta en DISPONIBLE por suposicion. Cada una declara como se sabe lo que dice."
  };
}


/*
  Estado de una capacidad concreta. Lo consume el motor para
  decidir si pedir un dato o declararlo no obtenible.
*/
export function capacidad(plataformaId, capacidadId) {
  const p = PLATAFORMAS.find((x) => x.plataformaId === plataformaId);

  if (!p) {
    return c(
      ESTADOS_CAPACIDAD.NO_DISPONIBLE,
      VERIFICACION.NO_VERIFICADO,
      `plataforma ${plataformaId} no contemplada en la matriz`
    );
  }

  return (
    p.capacidades[capacidadId] ||
    c(
      ESTADOS_CAPACIDAD.NO_DISPONIBLE,
      VERIFICACION.NO_VERIFICADO,
      `capacidad ${capacidadId} no contemplada`
    )
  );
}


export default {
  ESTADOS_CAPACIDAD,
  VERIFICACION,
  ALCANCES,
  CAPACIDADES,
  PLATAFORMAS,
  matrizDeCapacidades,
  capacidad
};
