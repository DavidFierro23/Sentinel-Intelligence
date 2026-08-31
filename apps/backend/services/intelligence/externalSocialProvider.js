// apps/backend/services/intelligence/externalSocialProvider.js

/*
===========================================================
PROVEEDOR SOCIAL EXTERNO — EL LIMITE, NO EL MOTOR
SOCIAL-PROVIDER-REAL-01-PREP
===========================================================

SOCIAL-PROVIDER-EVAL-01 concluyo que los huecos —Facebook de
terceros, metricas de TikTok, Instagram personal y texto de
comentarios— no los cierra ningun trabajo nuestro. Los cierra un
proveedor.

Este modulo prepara ese limite y NO integra a nadie.

LA REGLA QUE JUSTIFICA QUE ESTO EXISTA
-----------------------------------------------------------

    El nombre del proveedor NO puede aparecer en el dominio.

Candidate Intelligence tiene que poder cambiar de proveedor
cambiando un adaptador. Si `Bright Data` se cuela en
`candidateObservation` o en la matriz social, cambiar de
proveedor deja de ser una decision comercial y pasa a ser una
reescritura.

Por eso aqui no hay ni un `if (provider === "brightdata")`. Hay
un registro de proveedores y un normalizador que traduce
cualquier payload al contrato que Sentinel ya tiene.

LO QUE NO SE CREA, A PROPOSITO
-----------------------------------------------------------

Ni `BrightDataFacebookEngine`, ni `BrightDataTikTokEngine`, ni
un contrato de publicacion paralelo. La publicacion y la metrica
ya tienen contrato desde P-CAND-03 y el comentario lo tiene
desde este gate. Un proveedor es una FUENTE, no un modelo.

EL ESTADO QUE IMPIDE LA MENTIRA MAS FACIL
-----------------------------------------------------------

    UNVERIFIED_PROVIDER

Que la documentacion de un proveedor diga que cubre Facebook no
es cobertura. Todo lo que declare un proveedor entra aqui como
`UNVERIFIED_PROVIDER` y solo una prueba real contra una cuenta
de nuestros candidatos lo mueve. Hay test que lo fija.
===========================================================
*/

import {
  crearPublicacionObservada,
  crearSnapshotDeMetrica,
  DISPONIBILIDAD,
  TIPOS_PUBLICACION
} from "./publicationObservation.js";

import {
  crearComentarioObservado,
  crearCorpusDeComentarios
} from "./commentObservation.js";


export const ESTADOS_CAPACIDAD_PROVEEDOR = Object.freeze({
  /* Medido de verdad contra una cuenta nuestra de referencia. */
  SUPPORTED: "SUPPORTED",

  /* Medido y llega incompleto. */
  PARTIAL: "PARTIAL",

  /* Medido y no lo entrega. */
  UNSUPPORTED: "UNSUPPORTED",

  /*
    El proveedor DICE que lo cubre y nadie lo ha comprobado.
    Es el estado por defecto de todo lo que venga de un folleto.
  */
  UNVERIFIED_PROVIDER: "UNVERIFIED_PROVIDER",

  /* Se intento y algo lo impidio. */
  BLOCKED: "BLOCKED",

  /* Se pidio, respondio, y no vino dato. */
  NO_DATA: "NO_DATA"
});


/* Solo estos dos cuentan como cobertura real de un proveedor. */
const ESTADOS_MEDIDOS = [
  ESTADOS_CAPACIDAD_PROVEEDOR.SUPPORTED,
  ESTADOS_CAPACIDAD_PROVEEDOR.PARTIAL
];


export const CAPACIDADES_POR_PLATAFORMA = Object.freeze({
  facebook: [
    "account",
    "followers",
    "posts",
    "reactions",
    "comments_count",
    "comment_text",
    "shares",
    "video_views",
    "historical"
  ],

  tiktok: [
    "account",
    "followers",
    "following",
    "total_likes",
    "posts",
    "views",
    "likes",
    "comments_count",
    "comment_text",
    "shares",
    "historical"
  ],

  instagram: [
    "account",
    "followers",
    "posts",
    "likes",
    "comments_count",
    "comment_text",
    "historical"
  ]
});


const U = ESTADOS_CAPACIDAD_PROVEEDOR.UNVERIFIED_PROVIDER;

const NO = ESTADOS_CAPACIDAD_PROVEEDOR.UNSUPPORTED;


/*
  Todas las capacidades de una plataforma en el mismo estado.
  Se usa para inscribir a un proveedor entero como no verificado
  sin escribir la lista a mano y arriesgarse a olvidar una.
*/
function todas(plataforma, estado) {
  return Object.fromEntries(
    (CAPACIDADES_POR_PLATAFORMA[plataforma] || []).map((c) => [c, estado])
  );
}


/*
===========================================================
REGISTRO DE PROVEEDORES
===========================================================

Lo que un proveedor DICE, marcado como lo que es. La
documentacion consultada esta en
`docs/SOCIAL-PROVIDER-EVAL-01.md`.

Ningun estado aqui es una medicion. Cuando SOCIAL-PROVIDER-REAL-01
mida, se actualizan estas celdas UNA A UNA y con la fecha del
gate, como se hizo con Meta y con TikTok.
===========================================================
*/
export const PROVEEDORES = Object.freeze({
  /*
    Recomendado por SOCIAL-PROVIDER-EVAL-01 y EN REVISION: la
    cuenta todavia no esta aprobada. Nada de esto se ha probado.
  */
  brightdata: {
    id: "brightdata",
    nombre: "Bright Data",
    tipo: "SCRAPING_WEB_PUBLICA",

    estadoComercial: "EN_REVISION",
    aprobadoParaOperar: false,

    /*
      No es un proveedor licenciado por la plataforma. Se declara
      en el registro y no en un comentario, porque es lo que
      decide si un dato se puede defender.
    */
    datoLicenciadoPorLaPlataforma: false,

    capacidades: {
      facebook: todas("facebook", U),
      tiktok: todas("tiktok", U),
      instagram: todas("instagram", U)
    },

    variableDeEntorno: "BRIGHTDATA_API_KEY",

    nota:
      "Su documentacion declara cobertura de las tres plataformas incluido texto de comentarios. NADA esta medido: todas las celdas son UNVERIFIED_PROVIDER hasta SOCIAL-PROVIDER-REAL-01."
  },

  data365: {
    id: "data365",
    nombre: "Data365",
    tipo: "SCRAPING_WEB_PUBLICA",

    estadoComercial: "NO_CONTACTADO",
    aprobadoParaOperar: false,
    datoLicenciadoPorLaPlataforma: false,

    capacidades: {
      facebook: todas("facebook", U),
      tiktok: todas("tiktok", U),
      instagram: todas("instagram", U)
    },

    variableDeEntorno: "DATA365_API_KEY",

    nota:
      "Precio no publico y alta con llamada comercial. Segunda opcion de SOCIAL-PROVIDER-EVAL-01."
  },

  /*
    Se inscribe para que su hueco quede en el dato y no solo en
    un documento: no cubre Facebook, y Facebook es la prioridad.
  */
  ensembledata: {
    id: "ensembledata",
    nombre: "EnsembleData",
    tipo: "SCRAPING_WEB_PUBLICA",

    estadoComercial: "DESCARTADO",
    aprobadoParaOperar: false,
    datoLicenciadoPorLaPlataforma: false,

    capacidades: {
      facebook: todas("facebook", NO),
      tiktok: todas("tiktok", U),
      instagram: todas("instagram", U)
    },

    variableDeEntorno: null,

    nota:
      "Descartado en SOCIAL-PROVIDER-EVAL-01: no cubre Facebook, que es el hueco de prioridad mas alta."
  }
});


export function proveedor(providerId) {
  return PROVEEDORES[String(providerId || "").toLowerCase()] || null;
}


export function capacidadDeProveedor(providerId, plataforma, capacidad) {
  const p = proveedor(providerId);

  if (!p) {
    return {
      estado: ESTADOS_CAPACIDAD_PROVEEDOR.UNSUPPORTED,
      conocido: false,
      motivo: `proveedor ${providerId} no registrado. Un proveedor desconocido no aporta capacidad: se declara, no se asume.`
    };
  }

  const dePlataforma = p.capacidades[plataforma];

  if (!dePlataforma) {
    return {
      estado: ESTADOS_CAPACIDAD_PROVEEDOR.UNSUPPORTED,
      conocido: true,
      motivo: `${p.nombre} no declara cobertura de ${plataforma}`
    };
  }

  const estado = dePlataforma[capacidad];

  if (!estado) {
    return {
      estado: ESTADOS_CAPACIDAD_PROVEEDOR.UNSUPPORTED,
      conocido: true,
      motivo: `capacidad ${capacidad} no contemplada para ${plataforma}`
    };
  }

  return {
    estado,
    conocido: true,
    proveedor: p.nombre,
    verificado: ESTADOS_MEDIDOS.includes(estado),
    aprobadoParaOperar: p.aprobadoParaOperar === true
  };
}


/*
===========================================================
¿ESTA HABILITADO ESTE PROVEEDOR?
===========================================================

Dos condiciones, y las dos tienen que darse:

    la bandera de entorno lo permite
    el proveedor esta aprobado para operar

La bandera sola no basta. Encenderla no puede convertir un
proveedor en revision en uno operativo, porque entonces la
aprobacion seria una variable de entorno.
===========================================================
*/
export function proveedorHabilitado(providerId, entorno = process.env) {
  const p = proveedor(providerId);

  const banderaActiva =
    String(entorno.SOCIAL_EXTERNAL_PROVIDER_ENABLED || "").toLowerCase() ===
    "true";

  if (!p) {
    return {
      habilitado: false,
      motivo: `proveedor ${providerId} no registrado`
    };
  }

  if (!banderaActiva) {
    return {
      habilitado: false,
      proveedor: p.nombre,
      motivo:
        "SOCIAL_EXTERNAL_PROVIDER_ENABLED no esta en true. Ningun proveedor externo sale a la red mientras este apagada."
    };
  }

  if (!p.aprobadoParaOperar) {
    return {
      habilitado: false,
      proveedor: p.nombre,
      estadoComercial: p.estadoComercial,
      motivo: `${p.nombre} esta ${p.estadoComercial} y no aprobado para operar. La bandera de entorno no aprueba a un proveedor.`
    };
  }

  const clave = p.variableDeEntorno ? entorno[p.variableDeEntorno] : null;

  if (p.variableDeEntorno && !clave) {
    return {
      habilitado: false,
      proveedor: p.nombre,
      motivo: `falta ${p.variableDeEntorno} en el entorno. No se intenta la llamada sin credencial.`
    };
  }

  return { habilitado: true, proveedor: p.nombre };
}


/*
===========================================================
NORMALIZAR UNA PUBLICACION DE PROVEEDOR
===========================================================

Traduce un payload YA DESCARGADO al contrato de Sentinel. No
sale a la red: recibe el objeto y devuelve el contrato, que es
lo que permite probar todo esto sin gastar un dolar.

El mapa de campos se pasa desde fuera —cada proveedor nombra las
cosas a su manera— y eso es exactamente lo que impide que el
nombre del proveedor entre en el dominio.
===========================================================
*/
const MAPA_POR_DEFECTO = Object.freeze({
  postId: "post_id",
  permalink: "permalink",
  publishedAt: "published_at",
  text: "text",
  contentType: "content_type",
  views: "views",
  likes: "likes",
  reactions: "reactions",
  commentsCount: "comments_count",
  shares: "shares"
});


/* Lee `a.b.c` sin romperse si falta un tramo. */
function leer(objeto, ruta) {
  if (!ruta) return undefined;

  return String(ruta)
    .split(".")
    .reduce((o, k) => (o == null ? undefined : o[k]), objeto);
}


export function normalizarPublicacionDeProveedor(entrada = {}) {
  const {
    providerId = null,
    platformId = null,
    payload = {},
    mapa = {},
    candidateId = null,
    projectId = null,
    accountId = null,
    accountHandle = null,
    observedAt = new Date().toISOString(),
    rawReference = null
  } = entrada;

  const m = { ...MAPA_POR_DEFECTO, ...mapa };

  const valor = (campo) => {
    const v = leer(payload, m[campo]);

    return v === undefined ? null : v;
  };

  const permalink = valor("permalink");

  /*
    Las metricas usan el contrato que ya existe, y una ausente
    queda NO_DISPONIBLE. Nunca 0: un 0 es una medicion.
  */
  const metrica = (nombre) => {
    const v = valor(nombre);

    return crearSnapshotDeMetrica({
      metrica: nombre,
      value: v ?? null,
      observedAt,
      provider: providerId,
      source: permalink,
      availability:
        v === null || v === undefined
          ? DISPONIBILIDAD.NO_DISPONIBLE
          : DISPONIBILIDAD.DISPONIBLE,
      motivo:
        v === null || v === undefined
          ? `el proveedor no incluyo ${nombre} en esta respuesta`
          : null
    });
  };

  const metricas = ["views", "likes", "reactions", "commentsCount", "shares"].map(
    metrica
  );

  return crearPublicacionObservada({
    candidateId,
    projectId,
    accountId,
    platformId,

    publicationId: valor("postId") ? `pub-${platformId}-${valor("postId")}` : null,

    canonicalUrl: permalink,

    publishedAt: valor("publishedAt"),
    firstObservedAt: observedAt,
    lastObservedAt: observedAt,

    text: valor("text"),

    /*
      El proveedor no distingue original de repost salvo que lo
      diga explicitamente. Afirmar ORIGINAL seria inventar.
    */
    tipoPublicacion: TIPOS_PUBLICACION.NO_DETERMINADO,

    metricas,
    metricsObservedAt: observedAt,

    provider: providerId,
    observationMethod: `external_provider:${providerId}`,

    /* Estable entre ejecuciones porque sale del permalink. */
    evidenceId: permalink ? `ev-${platformId}-${huellaLocal(permalink)}` : null,

    /* Trazabilidad del payload sin guardar el payload entero. */
    rawReference,
    accountHandle
  });
}


function huellaLocal(texto) {
  const s = String(texto || "");

  let h = 0;

  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }

  return Math.abs(h).toString(36);
}


/*
===========================================================
NORMALIZAR COMENTARIOS DE PROVEEDOR
===========================================================
*/
const MAPA_COMENTARIO_POR_DEFECTO = Object.freeze({
  commentId: "comment_id",
  permalink: "permalink",
  publishedAt: "published_at",
  text: "text",
  authorId: "author_id",
  authorName: "author_name",
  likes: "likes",
  replyCount: "reply_count",
  parentCommentId: "parent_comment_id"
});


export function normalizarComentariosDeProveedor(entrada = {}) {
  const {
    providerId = null,
    platformId = null,
    postId = null,
    postPermalink = null,
    payload = [],
    mapa = {},
    commentsCount = null,
    candidateId = null,
    projectId = null,
    accountId = null,
    observedAt = new Date().toISOString(),
    rawReference = null
  } = entrada;

  const m = { ...MAPA_COMENTARIO_POR_DEFECTO, ...mapa };

  const lista = Array.isArray(payload) ? payload : [];

  const comentarios = lista.map((c) => {
    const v = (campo) => {
      const x = leer(c, m[campo]);

      return x === undefined ? null : x;
    };

    return crearComentarioObservado({
      platformId,
      postId,
      postPermalink,

      candidateId,
      projectId,
      accountId,

      commentId: v("commentId"),
      canonicalUrl: v("permalink"),
      publishedAt: v("publishedAt"),
      text: v("text"),

      authorId: v("authorId"),
      authorName: v("authorName"),

      likes: v("likes"),
      replyCount: v("replyCount"),
      parentCommentId: v("parentCommentId"),

      provider: providerId,
      observationMethod: `external_provider:${providerId}`,
      observedAt,
      rawReference
    });
  });

  return crearCorpusDeComentarios({
    platformId,
    postId,
    postPermalink,
    comentarios,
    commentsCount,
    provider: providerId,
    observedAt
  });
}


/*
===========================================================
PROCEDENCIA DE UNA RESPUESTA DE PROVEEDOR
===========================================================

Lo que hay que conservar para poder auditar de donde salio un
dato. Sin secretos: la clave de API NO entra aqui, y hay test
que lo comprueba.
===========================================================
*/
export function procedenciaDeProveedor(entrada = {}) {
  return {
    providerName: entrada.providerName || entrada.providerId || null,
    providerDatasetId: entrada.datasetId || null,
    providerRequestId: entrada.requestId || null,
    providerSnapshotId: entrada.snapshotId || null,

    sourceUrl: entrada.sourceUrl || null,
    canonicalPermalink: entrada.canonicalPermalink || null,

    observedAt: entrada.observedAt || new Date().toISOString(),

    /* Que campo del proveedor alimento que campo nuestro. */
    rawFieldMapping: entrada.rawFieldMapping || null,

    providerStatus: entrada.providerStatus || null,

    /*
      El dato de un proveedor que raspa no vale lo mismo que uno
      licenciado, y quien lea el dato tiene que poder saberlo.
    */
    datoLicenciadoPorLaPlataforma:
      proveedor(entrada.providerId)?.datoLicenciadoPorLaPlataforma ?? null,

    nota:
      "Procedencia de proveedor externo. No incluye credenciales por diseno."
  };
}


export function estadoDeProveedores() {
  const filas = Object.values(PROVEEDORES).map((p) => {
    const total = Object.values(p.capacidades).reduce(
      (n, caps) => n + Object.keys(caps).length,
      0
    );

    const medidas = Object.values(p.capacidades).reduce(
      (n, caps) =>
        n + Object.values(caps).filter((e) => ESTADOS_MEDIDOS.includes(e)).length,
      0
    );

    return {
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      estadoComercial: p.estadoComercial,
      aprobadoParaOperar: p.aprobadoParaOperar,
      capacidadesDeclaradas: total,
      capacidadesMedidas: medidas
    };
  });

  return {
    proveedores: filas,

    ningunoVerificado: filas.every((f) => f.capacidadesMedidas === 0),

    nota:
      "capacidadesMedidas cuenta solo lo comprobado contra una cuenta real. Mientras sea 0, ningun proveedor aporta cobertura por mucho que su documentacion lo diga."
  };
}


export default {
  ESTADOS_CAPACIDAD_PROVEEDOR,
  CAPACIDADES_POR_PLATAFORMA,
  PROVEEDORES,
  proveedor,
  capacidadDeProveedor,
  proveedorHabilitado,
  normalizarPublicacionDeProveedor,
  normalizarComentariosDeProveedor,
  procedenciaDeProveedor,
  estadoDeProveedores
};
