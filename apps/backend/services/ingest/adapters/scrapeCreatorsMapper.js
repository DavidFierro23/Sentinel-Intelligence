// apps/backend/services/ingest/adapters/scrapeCreatorsMapper.js

/*
===========================================================
MAPEO DE ScrapeCreators — CAPA DE PROVEEDOR
SOCIAL-PROVIDER-REAL-02
===========================================================

Aqui SI puede haber conocimiento especifico del proveedor. Es su
sitio: la capa de adaptador. Lo que no puede es bajar al dominio,
y por eso `candidateObservation` y la matriz social no saben que
existe este archivo.

Traduce las formas REALES medidas el 2026-08-31 —no las
documentadas— a la entrada que espera el normalizador generico.

DOS COSAS QUE LA DOCUMENTACION NO DECIA
-----------------------------------------------------------

Con `trim=true` los videos de TikTok traen `url` y NO
`share_url`. Costo una llamada descubrirlo, y queda escrito para
que no cueste otra.

Y las fechas vienen en tres formatos distintos segun el
endpoint: unix en segundos en las publicaciones de Facebook y en
TikTok, e ISO 8601 en los comentarios de Facebook. Se normalizan
aqui, porque el normalizador generico no debe saber de formatos
de nadie.

LO QUE NO SE INVENTA
-----------------------------------------------------------

`/facebook/profile/posts` NO trae shares. No es un cero: es una
ausencia del proveedor, y se deja fuera para que el contrato la
marque NO_DISPONIBLE.
===========================================================
*/

export const PROVIDER_ID = "scrapecreators";


/* Unix en segundos -> ISO. Null si no hay dato: nunca la epoca. */
export function desdeUnix(segundos) {
  if (segundos === null || segundos === undefined || segundos === "") return null;

  const n = Number(segundos);

  if (!Number.isFinite(n) || n <= 0) return null;

  return new Date(n * 1000).toISOString();
}


/*
===========================================================
FACEBOOK
===========================================================
*/
export function perfilDeFacebook(datos = {}) {
  return {
    /* El id numerico de la Page. Estable; el de la foto no lo es. */
    accountProviderId: datos.id ?? null,
    displayName: datos.name ?? null,
    canonicalUrl: datos.url ?? null,

    followers: datos.followerCount ?? null,
    likes: datos.likeCount ?? null,
    talkingAbout: datos.talkingAboutCount ?? null,
    category: datos.category ?? null,
    creationDate: datos.creationDate ?? null,
    website: datos.website ?? null,

    esPrivado: datos.isPrivate ?? null
  };
}


export function publicacionesDeFacebook(datos = {}) {
  return (datos.posts || []).map((p) => ({
    post_id: p.id ?? null,
    permalink: p.url ?? p.permalink ?? null,
    published_at: desdeUnix(p.publishTime ?? p.creation_time),
    text: p.text ?? null,
    content_type: p.videoDetails ? "video" : p.image ? "photo" : null,

    reactions: p.reactionCount ?? null,
    comments_count: p.commentCount ?? null,

    /*
      videoViewCount llega null en las publicaciones que no son
      video. Se deja pasar tal cual: el contrato lo marcara
      NO_DISPONIBLE y no un cero.
    */
    views: p.videoViewCount ?? null,

    /* shares NO existe en este endpoint. No se inventa. */

    desglose_reacciones: p.reaction_counts ?? null
  }));
}


export function comentariosDeFacebook(datos = {}) {
  return (datos.comments || []).map((c) => ({
    comment_id: c.id ?? null,
    text: c.text ?? null,

    /* Aqui SI viene en ISO. */
    published_at: c.created_at ?? null,

    likes: c.reaction_count ?? null,
    reply_count: c.reply_count ?? null,
    parent_comment_id: c.parent_id ?? null,

    author_id: c.author?.id ?? null,
    author_name: c.author?.name ?? null,

    /* No hay permalink por comentario en esta respuesta. */
    permalink: null
  }));
}


/*
===========================================================
TIKTOK
===========================================================
*/
export function perfilDeTikTok(datos = {}) {
  const u = datos.user || {};

  const s = datos.stats || {};

  return {
    accountProviderId: u.id ?? null,
    handle: u.uniqueId ?? null,
    displayName: u.nickname ?? null,

    canonicalUrl: u.uniqueId ? `https://www.tiktok.com/@${u.uniqueId}` : null,

    followers: s.followerCount ?? null,
    following: s.followingCount ?? null,
    totalLikes: s.heartCount ?? s.heart ?? null,
    mediaCount: s.videoCount ?? null
  };
}


export function publicacionesDeTikTok(datos = {}) {
  return (datos.aweme_list || []).map((v) => {
    const st = v.statistics || {};

    return {
      post_id: v.aweme_id ?? null,

      /*
        Con trim=true el campo es `url`. `share_url` solo aparece
        en la respuesta completa, y confiar en el dejo una
        llamada sin usar.
      */
      permalink: v.url ?? v.share_url ?? null,

      published_at: desdeUnix(v.create_time),
      text: v.desc ?? null,
      content_type: "video",

      views: st.play_count ?? null,
      likes: st.digg_count ?? null,
      comments_count: st.comment_count ?? null,
      shares: st.share_count ?? null
    };
  });
}


export function comentariosDeTikTok(datos = {}) {
  return (datos.comments || []).map((c) => ({
    comment_id: c.cid ?? null,
    text: c.text ?? null,
    published_at: desdeUnix(c.create_time),

    likes: c.digg_count ?? null,
    reply_count: c.reply_comment_total ?? null,

    /* `reply_comment` trae las respuestas anidadas cuando existen. */
    parent_comment_id: null,

    author_id: c.user?.uid ?? null,
    author_name: c.user?.nickname ?? null,

    permalink: null
  }));
}


/*
  Cuantos comentarios dice la fuente que hay. Se lee aparte
  porque es la mitad de la frase «observados de declarados», y
  cada plataforma lo pone en un sitio distinto.
*/
export function totalDeComentarios(plataforma, datos = {}, publicacion = null) {
  if (plataforma === "tiktok") return datos.total ?? null;

  return publicacion?.commentCount ?? null;
}


/* El saldo, que el proveedor devuelve en cada respuesta. */
export function creditos(datos = {}) {
  return {
    cobrados: datos.credits_charged ?? null,
    restantes: datos.credits_remaining ?? null
  };
}


export default {
  PROVIDER_ID,
  desdeUnix,
  perfilDeFacebook,
  publicacionesDeFacebook,
  comentariosDeFacebook,
  perfilDeTikTok,
  publicacionesDeTikTok,
  comentariosDeTikTok,
  totalDeComentarios,
  creditos
};
