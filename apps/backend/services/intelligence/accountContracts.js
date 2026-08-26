// apps/backend/services/intelligence/accountContracts.js

/*
===========================================================
CONTRATOS DE ACCOUNT INTELLIGENCE — P-CAND-AI-01
===========================================================

DISCOVERY Y MONITOREO NO SON LO MISMO

    Discovery              ¿que cuentas pertenecen al candidato?
    Account Intelligence   ¿que esta ocurriendo en esas cuentas?

La primera pregunta ya esta resuelta y su respuesta vive en el
inventario consolidado. La segunda empieza aqui, y NO se responde
volviendo a buscar: una cuenta ya consolidada se consulta
directamente cuando exista un adaptador permitido.

Usar Full Discovery como monitoreo seria volver a preguntar de
quien es una cuenta que ya sabemos de quien es, y gastar cuota en
ello.

LO QUE ESTE MODULO SE PROHIBE

    NO reconocimiento facial ni biometria.
    NO inventar metricas que el proveedor no dio.
    NO estimar lo que no se pudo observar.
    NO afirmar «el candidato no publica» cuando lo que ocurrio es
       que no pudimos mirar.

La ultima es la misma doctrina que separa `ausencia` de
`no_comprobada` en la cobertura de plataformas, y aqui vale
igual: un hueco en los datos habla de nuestros medios, no de la
actividad de una persona.
===========================================================
*/


/*
-----------------------------------------------------------
ESTADO DE OBSERVACION POR PLATAFORMA

Cinco estados, y ninguno afirma nada sobre la conducta del
candidato salvo el primero.
-----------------------------------------------------------
*/
export const ESTADOS_OBSERVACION = Object.freeze({
  /* Se consulto y se obtuvieron datos publicos. */
  OBSERVADA: "OBSERVADA",

  /*
    Se consulto y la fuente no expone datos publicos utiles. NO
    dice que la cuenta este inactiva.
  */
  SIN_DATOS_PUBLICOS: "SIN_DATOS_PUBLICOS",

  /*
    El proveedor disponible no alcanza para esta plataforma. Es
    una limitacion nuestra, declarada como tal.
  */
  PROVIDER_LIMITED: "PROVIDER_LIMITED",

  /* No se intento. */
  NO_EJECUTADA: "NO_EJECUTADA",

  /* Se intento y fallo. */
  ERROR: "ERROR"
});


/*
-----------------------------------------------------------
CAPACIDAD REAL POR PLATAFORMA

Este mapa es el estado HONESTO de nuestra infraestructura hoy,
no una aspiracion. Se escribe aqui para que ninguna parte del
sistema pueda suponer que lee mas de lo que lee.

    ADAPTER_AVAILABLE      hay adaptador propio y funciona
    PUBLIC_METADATA_ONLY   solo metadata publica de la pagina
    API_REQUIRED           haria falta la API oficial
    PROVIDER_REQUIRED      haria falta un proveedor de datos
    BLOCKED                la plataforma lo impide activamente
    UNSUPPORTED            no contemplado

Sirve de mapa de trabajo: dice donde comprar acceso aportaria
valor y donde no serviria de nada.
-----------------------------------------------------------
*/
export const CAPACIDADES = Object.freeze({
  ADAPTER_AVAILABLE: "ADAPTER_AVAILABLE",
  PUBLIC_METADATA_ONLY: "PUBLIC_METADATA_ONLY",
  API_REQUIRED: "API_REQUIRED",
  PROVIDER_REQUIRED: "PROVIDER_REQUIRED",
  BLOCKED: "BLOCKED",
  UNSUPPORTED: "UNSUPPORTED"
});


/*
  Una entrada por plataforma. `metricas` enumera lo que HOY se
  puede llegar a leer; el resto se devuelve `null`, nunca
  estimado.
*/
export const MAPA_PLATAFORMAS = Object.freeze([
  {
    plataformaId: "instagram",
    plataforma: "Instagram",
    capacidad: CAPACIDADES.API_REQUIRED,
    metadataPublica: false,
    metricas: [],
    motivo:
      "el perfil publico no expone metadata utilizable sin autenticacion y la lectura sistematica requiere la API de la plataforma",
    necesitamos: [
      "seguidores",
      "numero de publicaciones",
      "ultima publicacion",
      "metricas por publicacion"
    ],
    cubrePor: "Instagram Graph API (cuenta profesional) o proveedor de datos con licencia"
  },
  {
    plataformaId: "facebook",
    plataforma: "Facebook",
    capacidad: CAPACIDADES.API_REQUIRED,
    metadataPublica: true,
    metricas: [],
    motivo:
      "una pagina publica puede exponer og:image y titulo, pero no metricas; la lectura de actividad requiere la API",
    necesitamos: ["seguidores de pagina", "publicaciones", "reacciones", "comentarios"],
    cubrePor: "Facebook Graph API (pagina) o proveedor con licencia"
  },
  {
    plataformaId: "x",
    plataforma: "X",
    capacidad: CAPACIDADES.API_REQUIRED,
    metadataPublica: false,
    metricas: [],
    motivo:
      "la lectura de perfiles y publicaciones esta cerrada sin API de pago",
    necesitamos: ["seguidores", "publicaciones", "reposts", "likes", "vistas"],
    cubrePor: "X API (plan de pago)"
  },
  {
    plataformaId: "tiktok",
    plataforma: "TikTok",
    capacidad: CAPACIDADES.API_REQUIRED,
    metadataPublica: true,
    metricas: [],
    motivo:
      "la pagina publica expone metadata de la ficha pero no una serie de publicaciones ni metricas fiables",
    necesitamos: ["seguidores", "videos", "vistas", "likes", "comentarios", "shares"],
    cubrePor: "TikTok Display API / Research API, o proveedor con licencia"
  },
  {
    plataformaId: "youtube",
    plataforma: "YouTube",
    capacidad: CAPACIDADES.API_REQUIRED,
    metadataPublica: true,
    metricas: [],
    motivo:
      "es la plataforma con API publica mas accesible del grupo, pero sin clave no se lee nada estructurado",
    necesitamos: ["suscriptores", "videos", "vistas", "fecha del ultimo video"],
    cubrePor: "YouTube Data API v3 (clave gratuita con cuota)"
  },
  {
    plataformaId: "linkedin",
    plataforma: "LinkedIn",
    capacidad: CAPACIDADES.BLOCKED,
    metadataPublica: false,
    metricas: [],
    motivo:
      "LinkedIn bloquea activamente la lectura automatizada y su API no da acceso a perfiles de terceros",
    necesitamos: ["cargo declarado", "publicaciones"],
    cubrePor: "ninguno legitimo hoy"
  },
  {
    plataformaId: "web",
    plataforma: "Web oficial",
    capacidad: CAPACIDADES.PUBLIC_METADATA_ONLY,
    metadataPublica: true,
    metricas: [],
    motivo:
      "una web propia expone metadata estandar y contenido legible sin autenticacion",
    necesitamos: ["titulo", "descripcion", "imagen", "articulos publicados"],
    cubrePor: "no hace falta: es lectura publica normal"
  }
]);


export function capacidadDe(plataformaId) {
  return (
    MAPA_PLATAFORMAS.find((p) => p.plataformaId === plataformaId) || {
      plataformaId,
      plataforma: plataformaId,
      capacidad: CAPACIDADES.UNSUPPORTED,
      metadataPublica: false,
      metricas: [],
      motivo: "plataforma no contemplada",
      necesitamos: [],
      cubrePor: null
    }
  );
}


/*
  Estado de observacion que corresponde a una capacidad cuando no
  se ha intentado nada todavia. Traduce «no podemos» a un estado
  del contrato, en lugar de dejarlo en blanco.
*/
export function estadoPorCapacidad(plataformaId) {
  const c = capacidadDe(plataformaId);

  if (
    c.capacidad === CAPACIDADES.ADAPTER_AVAILABLE ||
    c.capacidad === CAPACIDADES.PUBLIC_METADATA_ONLY
  ) {
    return ESTADOS_OBSERVACION.NO_EJECUTADA;
  }

  return ESTADOS_OBSERVACION.PROVIDER_LIMITED;
}


/*
-----------------------------------------------------------
UNA OBSERVACION

Todos los campos publicos son OPCIONALES y `null` cuando no se
obtuvieron. `null` no es cero: cero seguidores es un dato, no
saberlo es otra cosa.
-----------------------------------------------------------
*/
export function crearObservacion(entrada = {}) {
  const ahora = entrada.capturedAt || new Date().toISOString();

  return {
    observationId: `obs-${entrada.accountId}-${ahora}`,

    accountId: entrada.accountId || null,
    candidateId: entrada.candidateId || null,
    projectId: entrada.projectId || null,
    platform: entrada.platform || null,
    url: entrada.url || null,
    handle: entrada.handle || null,

    capturedAt: ahora,
    provider: entrada.provider || null,
    metodo: entrada.metodo || null,

    estado: entrada.estado || ESTADOS_OBSERVACION.NO_EJECUTADA,

    /* ---- metricas publicas, todas opcionales ---- */
    followers: entrada.followers ?? null,
    following: entrada.following ?? null,
    postsCount: entrada.postsCount ?? null,
    videosCount: entrada.videosCount ?? null,
    views: entrada.views ?? null,
    likes: entrada.likes ?? null,
    comments: entrada.comments ?? null,
    shares: entrada.shares ?? null,
    engagementObservable: entrada.engagementObservable ?? null,

    /* ---- ficha publica ---- */
    profileBio: entrada.profileBio ?? null,
    profileName: entrada.profileName ?? null,
    profileImage: entrada.profileImage ?? null,
    lastPostAt: entrada.lastPostAt ?? null,

    /*
      Que se obtuvo y que no. Sin esto, un `null` no se distingue
      de un campo que nadie intento leer.
    */
    metricasDisponibles: entrada.metricasDisponibles || [],
    metricasNoDisponibles: entrada.metricasNoDisponibles || [],

    limitaciones: entrada.limitaciones || [],
    motivo: entrada.motivo || null
  };
}


/*
-----------------------------------------------------------
UNA PUBLICACION

`publicMetrics` solo lleva lo que el proveedor devolvio. No hay
engagement inventado ni derivado de una regla de tres.
-----------------------------------------------------------
*/
export function crearPublicacion(entrada = {}) {
  return {
    postId: entrada.postId || null,
    platformPostId: entrada.platformPostId || null,
    accountId: entrada.accountId || null,
    candidateId: entrada.candidateId || null,
    platform: entrada.platform || null,

    url: entrada.url || null,
    publishedAt: entrada.publishedAt || null,

    text: entrada.text || null,
    title: entrada.title || null,
    description: entrada.description || null,
    mediaType: entrada.mediaType || null,

    hashtags: entrada.hashtags || [],
    mentions: entrada.mentions || [],

    publicMetrics: entrada.publicMetrics || {
      likes: null,
      comments: null,
      shares: null,
      views: null,
      reposts: null,
      favorites: null
    },

    provider: entrada.provider || null,
    capturedAt: entrada.capturedAt || new Date().toISOString()
  };
}


/*
-----------------------------------------------------------
UN SNAPSHOT

Append-only. Nunca se sobrescribe el anterior: sin eso no hay
7d, 15d, 30d ni 90d, y la comparacion temporal seria una
invencion.
-----------------------------------------------------------
*/
export function crearSnapshot(entrada = {}) {
  const ahora = entrada.capturedAt || new Date().toISOString();

  return {
    snapshotId: `snap-${entrada.accountId}-${ahora}`,

    candidateId: entrada.candidateId || null,
    accountId: entrada.accountId || null,
    projectId: entrada.projectId || null,
    platform: entrada.platform || null,

    capturedAt: ahora,

    followers: entrada.followers ?? null,
    postsObserved: entrada.postsObserved ?? null,
    metricsAvailable: entrada.metricsAvailable || [],
    lastActivityAt: entrada.lastActivityAt ?? null,

    provider: entrada.provider || null,
    estado: entrada.estado || ESTADOS_OBSERVACION.NO_EJECUTADA,
    limitations: entrada.limitations || [],

    /*
      CONTRATO PARA CHANGE ATTRIBUTION, sin implementarlo.

      Un cambio futuro necesitara saber contra que se compara y
      que habia activo entonces. Se reserva el sitio para no tener
      que rehacer el modelo despues.
    */
    comparacion: {
      snapshotAnterior: entrada.snapshotAnterior || null,
      delta: entrada.delta || null,
      publicacionesDelPeriodo: entrada.publicacionesDelPeriodo ?? null,
      temasActivos: entrada.temasActivos || [],
      nota:
        "Change Attribution no esta implementado. Estos campos existen para que los snapshots puedan sostenerlo despues sin rehacer el modelo."
    }
  };
}


/*
-----------------------------------------------------------
METRICAS NO COMPARABLES ENTRE PLATAFORMAS

Una vista de TikTok, una reaccion de Facebook y un repost de X
no son la misma cosa, y sumarlas o compararlas directamente
produce un numero que no significa nada.

Mientras no exista una normalizacion documentada, se agrupan POR
PLATAFORMA y se dice que no son comparables.
-----------------------------------------------------------
*/
export const METRICAS_NO_COMPARABLES = Object.freeze({
  nota:
    "Las metricas de plataformas distintas no se comparan ni se suman entre si: una vista de TikTok, una reaccion de Facebook y un repost de X miden cosas diferentes. Cualquier agregacion exige una normalizacion documentada que todavia no existe.",
  equivalencias: null
});


export default {
  ESTADOS_OBSERVACION,
  CAPACIDADES,
  MAPA_PLATAFORMAS,
  capacidadDe,
  estadoPorCapacidad,
  crearObservacion,
  crearPublicacion,
  crearSnapshot,
  METRICAS_NO_COMPARABLES
};
