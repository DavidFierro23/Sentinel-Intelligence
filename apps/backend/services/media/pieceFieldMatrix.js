// apps/backend/services/media/pieceFieldMatrix.js

import {
  capacidad,
  ESTADOS_CAPACIDAD,
  VERIFICACION,
  ALCANCES
} from "../intelligence/socialCapabilityMatrix.js";

import { PLATAFORMAS } from "./pieceContracts.js";

/*
===========================================================
MATRIZ POR CAMPO DE UNA PIEZA — MEDIA-PIECE-02 §E
===========================================================

Responde, campo por campo y plataforma por plataforma: ¿de
donde puede salir este dato HOY?

POR QUE NO SE MODIFICA `socialCapabilityMatrix`
-----------------------------------------------------------

Esa matriz responde otra pregunta: «¿que capacidades tiene la
API oficial de cada plataforma?». Es correcta, esta medida en
produccion y otros modulos dependen de sus cuatro estados.

Aqui hacen falta dos cosas que esa matriz no modela, y meterlas
dentro la volveria ambigua:

  1. una VIA MAS: la web indirecta. Un titular puede llegar de
     Open Graph o del snippet de un buscador sin que la API de
     la plataforma exista. Esa via no es «disponible» en el
     sentido de la matriz oficial, pero tampoco es «no
     disponible»: es DISPONIBLE_WEB_INDIRECTO, con menos
     garantia y con procedencia distinta.

  2. campos que no son capacidades de API: `canonicalUrl` y
     `publicationId` salen de la forma de la URL, no de ningun
     endpoint.

Asi que esta matriz CONSUME la oficial para lo que la oficial
sabe, y anade lo que solo tiene sentido a escala de pieza.

LA DISTINCION QUE EL GATE EXIGE NO CONFUNDIR
-----------------------------------------------------------

    indexacion web  ≠  acceso a metricas de la plataforma

Un buscador puede tener indexada la URL de un reel y darnos su
titular. Eso NO nos da sus reproducciones. Por eso ningun campo
de metrica puede ser DISPONIBLE_WEB_INDIRECTO: un contador no
se lee de un snippet, y si algun dia apareciera en uno seria
una cifra sin fecha de observacion ni fuente responsable.
===========================================================
*/


export const ESTADOS_CAMPO = Object.freeze({
  /* La API oficial de la plataforma lo entrega, hoy, con lo que tenemos. */
  DISPONIBLE_OFICIAL: "DISPONIBLE_OFICIAL",

  /* Existiria con un proveedor de datos con licencia. Sin evaluar aun. */
  DISPONIBLE_PROVEEDOR: "DISPONIBLE_PROVEEDOR",

  /*
    Se puede obtener sin la API: Open Graph de la pagina publica
    o snippet de buscador. Menos garantia, procedencia distinta,
    y NUNCA valido para metricas.
  */
  DISPONIBLE_WEB_INDIRECTO: "DISPONIBLE_WEB_INDIRECTO",

  /* Hay via oficial, pero exige un permiso que no tenemos. */
  REQUIERE_AUTORIZACION: "REQUIERE_AUTORIZACION",

  /* No existe via para este alcance. */
  NO_DISPONIBLE: "NO_DISPONIBLE",

  /* Se cree que se puede, pero no se ha comprobado contra la fuente real. */
  NO_VERIFICADO: "NO_VERIFICADO"
});


/*
-----------------------------------------------------------
CAMPOS DE UNA PIEZA

Los que el gate enumera, separados por naturaleza: los
estructurales salen de la URL, los de contenido de la pagina o
la API, y los de metrica SOLO de la API o de un proveedor.
-----------------------------------------------------------
*/
export const CAMPOS_PIEZA = Object.freeze([
  { id: "plataforma", nombre: "Plataforma", clase: "estructural" },
  { id: "publicationId", nombre: "ID de la publicacion", clase: "estructural" },
  { id: "canonicalUrl", nombre: "URL canonica", clase: "estructural" },

  { id: "autor", nombre: "Autor / cuenta", clase: "contenido" },
  { id: "pagina", nombre: "Pagina o perfil emisor", clase: "contenido" },
  { id: "titulo", nombre: "Titulo", clase: "contenido" },
  { id: "texto", nombre: "Texto / caption", clase: "contenido" },
  { id: "publishedAt", nombre: "Fecha de publicacion", clase: "contenido" },

  { id: "views", nombre: "Reproducciones / impresiones", clase: "metrica" },
  { id: "likes", nombre: "Me gusta / reacciones", clase: "metrica" },
  { id: "comments", nombre: "Comentarios / respuestas", clase: "metrica" },
  { id: "shares", nombre: "Compartidos / reposts", clase: "metrica" },
  { id: "quotes", nombre: "Citas", clase: "metrica" },
  { id: "bookmarks", nombre: "Guardados", clase: "metrica" },

  { id: "followers", nombre: "Seguidores del emisor", clase: "perfil" }
]);


const E = ESTADOS_CAMPO;

const c = (estado, via, nota, verificacion = VERIFICACION.DOCUMENTADO) => ({
  estado,
  via,
  nota,
  verificacion
});


/*
===========================================================
LO ESTRUCTURAL: IGUAL EN TODAS LAS PLATAFORMAS

Sale de la URL. No depende de ninguna API y esta medido: los
patrones de `pieceResolver` se prueban con fixtures.
===========================================================
*/
const ESTRUCTURAL = {
  plataforma: c(
    E.DISPONIBLE_OFICIAL,
    "forma_de_la_url",
    "El dominio identifica la plataforma sin pedir nada a nadie.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  canonicalUrl: c(
    E.DISPONIBLE_OFICIAL,
    "forma_de_la_url",
    "Se normaliza la URL y se quitan parametros de rastreo.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  )
};


/*
===========================================================
YOUTUBE — la unica con capacidades MEDIDAS
===========================================================
*/
const YOUTUBE = {
  ...ESTRUCTURAL,

  publicationId: c(
    E.DISPONIBLE_OFICIAL,
    "forma_de_la_url",
    "El videoId esta en la URL (watch?v=, youtu.be/, /shorts/).",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  autor: c(
    E.DISPONIBLE_OFICIAL,
    "youtube_data:videos.list",
    "channelTitle y channelId llegan en la misma llamada que las metricas.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  pagina: c(
    E.DISPONIBLE_OFICIAL,
    "youtube_data:channels.list",
    "El canal es el emisor. NO es el dominio youtube.com.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  titulo: c(
    E.DISPONIBLE_OFICIAL,
    "youtube_data:videos.list",
    "snippet.title.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  texto: c(
    E.DISPONIBLE_OFICIAL,
    "youtube_data:videos.list",
    "snippet.description, si el canal la publica.",
    VERIFICACION.DOCUMENTADO
  ),

  publishedAt: c(
    E.DISPONIBLE_OFICIAL,
    "youtube_data:videos.list",
    "snippet.publishedAt.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  views: c(
    E.DISPONIBLE_OFICIAL,
    "youtube_data:videos.list?part=statistics",
    "viewCount.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  likes: c(
    E.DISPONIBLE_OFICIAL,
    "youtube_data:videos.list?part=statistics",
    "likeCount. Puede venir oculto por decision del canal: ausencia NO es cero.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  comments: c(
    E.DISPONIBLE_OFICIAL,
    "youtube_data:videos.list?part=statistics",
    "commentCount. Puede estar desactivado por el canal.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  shares: c(
    E.NO_DISPONIBLE,
    null,
    "La API no expone compartidos por video en ningun part.",
    VERIFICACION.DOCUMENTADO
  ),

  quotes: c(E.NO_DISPONIBLE, null, "No existe el concepto en YouTube."),

  bookmarks: c(
    E.NO_DISPONIBLE,
    null,
    "«Guardar en lista» no se expone por video."
  ),

  followers: c(
    E.DISPONIBLE_OFICIAL,
    "youtube_data:channels.list",
    "subscriberCount, salvo que el canal lo oculte.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  )
};


/*
===========================================================
X — la brecha del CASO 1

El adapter ya mapea las metricas y desde MEDIA-PIECE-02 existe
`resolverPosts`. El obstaculo que queda NO es tecnico: es la
credencial. Sin `X_BEARER_TOKEN` todo esto devuelve
SIN_CREDENCIAL sin tocar la red.

Por eso el estado es REQUIERE_AUTORIZACION y no NO_DISPONIBLE:
la via existe, esta implementada y espera una decision de
contratacion.
===========================================================
*/
const X = {
  ...ESTRUCTURAL,

  publicationId: c(
    E.DISPONIBLE_OFICIAL,
    "forma_de_la_url",
    "El id esta en /status/{id}.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  autor: c(
    E.DISPONIBLE_WEB_INDIRECTO,
    "forma_de_la_url + x_api:tweets?expansions=author_id",
    "El handle suele estar en la URL (x.com/{handle}/status/{id}); en /i/status/{id} no, y entonces solo la API lo resuelve.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  pagina: c(
    E.REQUIERE_AUTORIZACION,
    "x_api:users/by/username",
    "Exige X_BEARER_TOKEN y un plan que cubra el endpoint."
  ),

  titulo: c(
    E.NO_DISPONIBLE,
    null,
    "Una publicacion de X no tiene titulo: tiene texto. El campo se deja vacio en lugar de rellenarlo con el texto."
  ),

  texto: c(
    E.REQUIERE_AUTORIZACION,
    "x_api:tweets?ids=",
    "`text` llega en la misma llamada. Requiere credencial y plan."
  ),

  publishedAt: c(
    E.REQUIERE_AUTORIZACION,
    "x_api:tweets?ids=",
    "`created_at`. Requiere credencial y plan."
  ),

  views: c(
    E.REQUIERE_AUTORIZACION,
    "x_api:tweets?ids= (public_metrics.impression_count)",
    "El usuario ve las reproducciones en la interfaz, pero la API no siempre incluye impression_count para terceros: depende del plan. Ausencia NO es cero."
  ),

  likes: c(
    E.REQUIERE_AUTORIZACION,
    "x_api:tweets?ids= (public_metrics.like_count)",
    "Mapeado en el adapter. Requiere credencial y plan."
  ),

  comments: c(
    E.REQUIERE_AUTORIZACION,
    "x_api:tweets?ids= (public_metrics.reply_count)",
    "Respuestas. Mapeado en el adapter."
  ),

  shares: c(
    E.REQUIERE_AUTORIZACION,
    "x_api:tweets?ids= (public_metrics.retweet_count)",
    "Reposts. Se guarda separado de las citas: republicar y comentar no son el mismo acto."
  ),

  quotes: c(
    E.REQUIERE_AUTORIZACION,
    "x_api:tweets?ids= (public_metrics.quote_count)",
    "Citas. Mapeado en el adapter."
  ),

  bookmarks: c(
    E.REQUIERE_AUTORIZACION,
    "x_api:tweets?ids= (public_metrics.bookmark_count)",
    "Guardados. El usuario los ve en la interfaz; la API los expone solo en algunos niveles de acceso."
  ),

  followers: c(
    E.REQUIERE_AUTORIZACION,
    "x_api:users (public_metrics.followers_count)",
    "Requiere credencial. No se usa para clasificar al emisor."
  )
};


/*
===========================================================
FACEBOOK — la brecha del CASO 2

Aqui la barrera SI es de terceros, no de presupuesto: leer una
publicacion de una pagina que NO administramos exige revision
de la app por parte de Meta y un token de esa pagina. No hay
plan que se pueda contratar para saltarselo.

Lo que si se puede hoy: intentar la metadata publica de la URL.
Facebook suele responder con muro a un agente no autenticado, y
entonces se declara el muro. Cuando responde, da titulo,
descripcion y a veces autor.
===========================================================
*/
const FACEBOOK = {
  ...ESTRUCTURAL,

  publicationId: c(
    E.DISPONIBLE_OFICIAL,
    "forma_de_la_url",
    "/reel/{id}, /posts/{id}, /videos/{id} y story_fbid= dan el id.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  autor: c(
    E.DISPONIBLE_WEB_INDIRECTO,
    "open_graph + snippet_de_buscador",
    "En /{pagina}/posts/{id} el emisor esta en la URL. En /reel/{id} NO: solo puede llegar de og:title, del snippet de un buscador o del propio contenido. Nunca se deduce del dominio facebook.com."
  ),

  pagina: c(
    E.REQUIERE_AUTORIZACION,
    "meta_graph:/{page-id}",
    "Exige revision de la app por Meta y token de la pagina. No lo tenemos y no hay via de pago que lo sustituya."
  ),

  titulo: c(
    E.DISPONIBLE_WEB_INDIRECTO,
    "open_graph:og:title",
    "Cuando Facebook sirve la tarjeta publica. Si responde con muro, no hay titulo y se declara."
  ),

  texto: c(
    E.DISPONIBLE_WEB_INDIRECTO,
    "open_graph:og:description",
    "og:description es un EXTRACTO recortado por la plataforma, no el caption completo. No se presenta como el texto de la publicacion."
  ),

  publishedAt: c(
    E.NO_VERIFICADO,
    "open_graph / json_ld",
    "Facebook no publica article:published_time de forma fiable en reels. Se intenta y se declara ausente cuando no viene: no se estima a partir del id."
  ),

  views: c(
    E.REQUIERE_AUTORIZACION,
    "meta_graph:video_insights",
    "Las reproducciones de un video de pagina exigen token de esa pagina. Ver el contador en pantalla no lo hace accesible por API."
  ),

  likes: c(
    E.REQUIERE_AUTORIZACION,
    "meta_graph:/{post-id}?fields=reactions.summary(true)",
    "Reacciones. Exige token de la pagina."
  ),

  comments: c(
    E.REQUIERE_AUTORIZACION,
    "meta_graph:/{post-id}?fields=comments.summary(true)",
    "Recuento de comentarios. Exige token de la pagina."
  ),

  shares: c(
    E.REQUIERE_AUTORIZACION,
    "meta_graph:/{post-id}?fields=shares",
    "Compartidos. Exige token de la pagina."
  ),

  quotes: c(E.NO_DISPONIBLE, null, "No existe el concepto en Facebook."),

  bookmarks: c(E.NO_DISPONIBLE, null, "«Guardar» no se expone por publicacion."),

  followers: c(
    E.REQUIERE_AUTORIZACION,
    "meta_graph:/{page-id}?fields=followers_count",
    "Exige token de la pagina."
  )
};


/*
===========================================================
INSTAGRAM y TIKTOK — sin caso de uso abierto en este gate,
pero declarados para que no parezca que no se han mirado.
===========================================================
*/
const INSTAGRAM = {
  ...ESTRUCTURAL,

  publicationId: c(
    E.DISPONIBLE_OFICIAL,
    "forma_de_la_url",
    "/p/{code}, /reel/{code}, /tv/{code}.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  autor: c(
    E.DISPONIBLE_WEB_INDIRECTO,
    "forma_de_la_url + open_graph",
    "El handle aparece en /{handle}/p/{code}; en /p/{code} no."
  ),

  pagina: c(
    E.REQUIERE_AUTORIZACION,
    "meta_graph:business_discovery",
    "Solo cuentas profesionales y con revision de la app."
  ),

  titulo: c(E.NO_DISPONIBLE, null, "Una publicacion de Instagram no tiene titulo."),

  texto: c(
    E.DISPONIBLE_WEB_INDIRECTO,
    "open_graph:og:description",
    "Extracto recortado por la plataforma, no el caption completo."
  ),

  publishedAt: c(E.NO_VERIFICADO, "open_graph", "No se publica de forma fiable."),

  views: c(E.REQUIERE_AUTORIZACION, "meta_graph:media_insights", "Exige autorizacion del titular."),
  likes: c(E.REQUIERE_AUTORIZACION, "meta_graph:business_discovery", "Solo cuentas profesionales."),
  comments: c(E.REQUIERE_AUTORIZACION, "meta_graph:business_discovery", "Solo cuentas profesionales."),
  shares: c(E.NO_DISPONIBLE, null, "No se expone."),
  quotes: c(E.NO_DISPONIBLE, null, "No existe el concepto."),
  bookmarks: c(E.NO_DISPONIBLE, null, "No se expone."),

  followers: c(
    E.REQUIERE_AUTORIZACION,
    "meta_graph:business_discovery (followers_count)",
    "Solo cuentas profesionales y con revision de la app."
  )
};


const TIKTOK = {
  ...ESTRUCTURAL,

  publicationId: c(
    E.DISPONIBLE_OFICIAL,
    "forma_de_la_url",
    "/video/{id}.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  autor: c(
    E.DISPONIBLE_OFICIAL,
    "forma_de_la_url",
    "El handle esta en /@{handle}/video/{id}.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  pagina: c(E.REQUIERE_AUTORIZACION, "tiktok:research_api", "Por solicitud, no comercial."),
  titulo: c(E.NO_DISPONIBLE, null, "No tiene titulo."),
  texto: c(E.DISPONIBLE_WEB_INDIRECTO, "open_graph:og:description", "Extracto, no caption."),
  publishedAt: c(E.NO_VERIFICADO, "open_graph", "No fiable."),

  views: c(E.DISPONIBLE_PROVEEDOR, null, "Sin via oficial para terceros. Solo proveedor con licencia."),
  likes: c(E.DISPONIBLE_PROVEEDOR, null, "Idem."),
  comments: c(E.DISPONIBLE_PROVEEDOR, null, "Idem."),
  shares: c(E.DISPONIBLE_PROVEEDOR, null, "Idem."),
  quotes: c(E.NO_DISPONIBLE, null, "No existe el concepto."),
  bookmarks: c(E.DISPONIBLE_PROVEEDOR, null, "Solo proveedor."),
  followers: c(E.DISPONIBLE_PROVEEDOR, null, "Sin via oficial para terceros.")
};


/*
===========================================================
WEB — el caso que mas se usa y el que MEDIA-PIECE-02 arregla

Un medio digital publica Open Graph precisamente para que un
tercero muestre su tarjeta. Es la unica plataforma donde la via
web indirecta es la via NORMAL, no un plan B.
===========================================================
*/
const WEB = {
  ...ESTRUCTURAL,

  publicationId: c(
    E.NO_DISPONIBLE,
    null,
    "Una pagina web no tiene id de publicacion. Su identidad es la URL canonica."
  ),

  autor: c(
    E.DISPONIBLE_WEB_INDIRECTO,
    "open_graph:article:author | json_ld:author",
    "Muchos medios lo publican; otros no. Ausencia declarada, nunca inventada."
  ),

  pagina: c(
    E.DISPONIBLE_OFICIAL,
    "catalogo_de_medios + open_graph:og:site_name",
    "El dominio identifica al medio y el catalogo aporta tipo y ambito declarado.",
    VERIFICACION.MEDIDO_EN_PRODUCCION
  ),

  titulo: c(
    E.DISPONIBLE_WEB_INDIRECTO,
    "open_graph:og:title",
    "La via mas fiable de todo el modulo: og:title lo escribe el editor para compartir."
  ),

  texto: c(
    E.DISPONIBLE_WEB_INDIRECTO,
    "open_graph:og:description",
    "Extracto. El cuerpo completo depende de la licencia del medio y no se guarda."
  ),

  publishedAt: c(
    E.DISPONIBLE_WEB_INDIRECTO,
    "open_graph:article:published_time | json_ld:datePublished",
    "Frecuente en medios digitales."
  ),

  views: c(E.NO_DISPONIBLE, null, "Una web no publica contadores. Solo con analytics del propio medio."),
  likes: c(E.NO_DISPONIBLE, null, "Idem."),
  comments: c(E.NO_DISPONIBLE, null, "Idem."),
  shares: c(E.NO_DISPONIBLE, null, "Idem."),
  quotes: c(E.NO_DISPONIBLE, null, "Idem."),
  bookmarks: c(E.NO_DISPONIBLE, null, "Idem."),
  followers: c(E.NO_DISPONIBLE, null, "Un medio no tiene seguidores por si mismo.")
};


const MATRIZ = Object.freeze({
  [PLATAFORMAS.YOUTUBE]: YOUTUBE,
  [PLATAFORMAS.X]: X,
  [PLATAFORMAS.FACEBOOK]: FACEBOOK,
  [PLATAFORMAS.INSTAGRAM]: INSTAGRAM,
  [PLATAFORMAS.TIKTOK]: TIKTOK,
  [PLATAFORMAS.WEB]: WEB
});


/*
===========================================================
CONSULTA
===========================================================
*/
export function estadoDeCampo(plataforma, campoId) {
  const p = MATRIZ[plataforma];

  if (!p) {
    return c(
      E.NO_VERIFICADO,
      null,
      `Plataforma "${plataforma}" no contemplada en la matriz de piezas.`,
      VERIFICACION.NO_VERIFICADO
    );
  }

  const r = p[campoId];

  if (!r) {
    return c(
      E.NO_VERIFICADO,
      null,
      `Campo "${campoId}" no contemplado para ${plataforma}.`,
      VERIFICACION.NO_VERIFICADO
    );
  }

  return r;
}


export function matrizDePieza(plataforma) {
  return {
    plataforma,

    campos: CAMPOS_PIEZA.map((c_) => ({
      ...c_,
      ...estadoDeCampo(plataforma, c_.id)
    })),

    /*
      Contraste con la matriz oficial de capacidades: si las dos
      discrepan, se ve aqui en lugar de descubrirse en produccion.
    */
    capacidadOficial:
      plataforma === PLATAFORMAS.WEB
        ? null
        : {
            views: capacidad(plataforma, "views"),
            likes: capacidad(plataforma, "likes"),
            comments: capacidad(plataforma, "comments"),
            shares: capacidad(plataforma, "shares"),

            avisoDeAlcance:
              "Un estado DISPONIBLE con alcanceMedicion PROPIA se midio sobre una cuenta que administramos. NO aplica a la pieza de un tercero, que es lo que analiza este modulo."
          },

    reglas: [
      "Indexacion web NO es acceso a metricas: ningun campo de metrica puede ser DISPONIBLE_WEB_INDIRECTO.",
      "Un snippet de buscador no equivale al contenido original de la publicacion.",
      "Una replica no equivale a una metrica de la publicacion original.",
      "Ausencia se representa con null y su motivo, nunca con 0.",
      "Una capacidad medida sobre cuenta propia no habilita la misma metrica en una cuenta ajena."
    ]
  };
}


export function matrizCompleta() {
  return Object.keys(MATRIZ).map((p) => matrizDePieza(p));
}


/*
-----------------------------------------------------------
COMPROBACION DE COHERENCIA

Los estados de metrica y la matriz oficial tienen que contar la
misma historia. Esta funcion existe para que un test lo verifique
en lugar de confiar en que nadie las desincronice.
-----------------------------------------------------------
*/
/*
  EL ALCANCE DE MEDICION CAMBIA EL SIGNIFICADO DE «DISPONIBLE»
  -----------------------------------------------------------

  La matriz oficial marca `instagram.likes: DISPONIBLE` con
  `alcanceMedicion: "PROPIA"`: es cierto —se midio en produccion—
  pero sobre NUESTRA cuenta, porque la administramos.

  MEDIA-PIECE analiza piezas de TERCEROS. Para una publicacion
  que no administramos, ese mismo `DISPONIBLE` no vale nada. Leer
  la matriz oficial sin mirar el alcance haria que el modulo
  prometiera metricas de Instagram que no puede obtener: es el
  error que este comprobador existe para impedir.

  Por eso la comparacion solo aplica a capacidades de alcance
  TERCERO. Las de alcance PROPIA se ignoran a proposito y se
  cuentan aparte para que quede constancia de cuantas hay.
*/
export function comprobarCoherencia() {
  const problemas = [];

  const ignoradasPorAlcance = [];

  Object.keys(MATRIZ).forEach((plataforma) => {
    if (plataforma === PLATAFORMAS.WEB) return;

    ["views", "likes", "comments", "shares"].forEach((campoId) => {
      const propio = estadoDeCampo(plataforma, campoId);

      const oficial = capacidad(plataforma, campoId);

      /* Ninguna metrica puede resolverse por via web indirecta. */
      if (propio.estado === E.DISPONIBLE_WEB_INDIRECTO) {
        problemas.push(
          `${plataforma}.${campoId}: una metrica no puede ser DISPONIBLE_WEB_INDIRECTO.`
        );
      }

      /*
        La matriz oficial guarda la CLAVE corta ("PROPIA"), no el
        valor de `ALCANCES` ("CUENTA_PROPIA_O_AUTORIZADA"). Se
        aceptan las dos formas: el contrato es de otro modulo y
        puede normalizarlas mas adelante sin avisar.
      */
      const alcance = String(oficial.alcanceMedicion || "");

      const esDeCuentaPropia =
        alcance === "PROPIA" || alcance === ALCANCES.PROPIA;

      if (esDeCuentaPropia) {
        ignoradasPorAlcance.push({
          plataforma,
          campo: campoId,
          estadoOficial: oficial.estado,
          alcance: oficial.alcanceMedicion,

          motivo:
            "La capacidad oficial se midio sobre cuenta propia. Una pieza de un tercero no la hereda."
        });

        return;
      }

      /*
        Solo aqui la comparacion tiene sentido: la oficial habla
        de terceros y la nuestra tambien.
      */
      if (
        oficial.estado === ESTADOS_CAPACIDAD.DISPONIBLE &&
        propio.estado === E.NO_DISPONIBLE
      ) {
        problemas.push(
          `${plataforma}.${campoId}: la matriz oficial dice DISPONIBLE para TERCEROS y esta dice NO_DISPONIBLE.`
        );
      }
    });
  });

  return {
    coherente: problemas.length === 0,
    problemas,
    ignoradasPorAlcance,

    declaracion:
      "Solo se comparan capacidades de alcance TERCERO. Un DISPONIBLE de cuenta propia no habilita nada para una pieza ajena.",

    nota:
      ignoradasPorAlcance.length > 0
        ? `${ignoradasPorAlcance.length} capacidades oficiales quedan fuera de la comparacion por ser de cuenta propia.`
        : null
  };
}


export default {
  ESTADOS_CAMPO,
  CAMPOS_PIEZA,
  estadoDeCampo,
  matrizDePieza,
  matrizCompleta,
  comprobarCoherencia
};
