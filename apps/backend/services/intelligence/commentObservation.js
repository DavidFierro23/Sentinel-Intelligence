// apps/backend/services/intelligence/commentObservation.js

/*
===========================================================
COMENTARIO OBSERVADO — SOCIAL-PROVIDER-REAL-01-PREP
===========================================================

El contrato que le faltaba a Sentinel. Habia contrato de
publicacion y de metrica desde P-CAND-03, y ninguno de
comentario, porque hasta hoy ninguna via entregaba texto:
Instagram lo niega —400 code 100 medido—, Facebook cayo con
/posts y TikTok no tiene via publica.

Se escribe AHORA, antes de tener el dato, para que el dia que
llegue no se invente una forma nueva bajo la presion de que ya
hay datos esperando.

    COMENTARIOS OBSERVADOS  !=  TODOS LOS COMENTARIOS

Ninguna fuente garantiza cobertura total. Un corpus paginado,
con limite de rate y sin archivo, es una MUESTRA. Decir «los
comentarios dicen X» sobre una muestra es una afirmacion falsa
sobre el universo, y por eso la obligacion de lenguaje viaja en
el propio contrato y no en la documentacion.

LO QUE ESTE CONTRATO NO HACE
-----------------------------------------------------------

No perfila personas. Guarda el autor tal y como lo publica la
plataforma —un nombre visible y un id de plataforma— porque sin
eso no se puede deduplicar ni contar participantes unicos, y NO
lo cruza con identidad real, no lo enriquece y no lo puntua.

Comments Intelligence trabajara en AGREGADO: temas, volumen,
evolucion. Un comentario individual es evidencia citable, no un
sujeto de analisis.
===========================================================
*/

import { DISPONIBILIDAD } from "./publicationObservation.js";


/*
  La misma huella que usa publicationObservation. Se repite la
  funcion en lugar de exportarla desde alli para no cambiar la
  superficie de un modulo estable por una utilidad de tres
  lineas.
*/
function huella(texto) {
  const s = String(texto || "");

  let h = 0;

  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }

  return Math.abs(h).toString(36);
}


export const ESTADOS_CORPUS = Object.freeze({
  /* Se pidieron y llegaron comentarios con texto. */
  OBSERVADO: "COMMENTS_OBSERVED",

  /* Llego el recuento y no el texto. NO es lo mismo. */
  SOLO_RECUENTO: "COMMENTS_COUNT_ONLY",

  /* La publicacion no tiene comentarios. Es un CERO medido. */
  SIN_COMENTARIOS: "COMMENTS_NONE",

  /* Se pidio y la fuente no lo entrega por diseno. */
  NO_DISPONIBLE: "COMMENTS_NOT_AVAILABLE",

  /* Se pidio y un bloqueo lo impidio. Distinto de lo anterior. */
  BLOQUEADO: "COMMENTS_BLOCKED",

  /* No se ha intentado. */
  NO_PROBADO: "COMMENTS_NOT_TESTED"
});


/*
===========================================================
UN COMENTARIO
===========================================================

`commentId` sale del id de la plataforma si existe, y si no del
permalink. Nunca de un aleatorio: un id aleatorio deduplica
dentro de una ejecucion y no sirve para nada entre dos, que es
justo cuando hace falta.
===========================================================
*/
export function crearComentarioObservado(entrada = {}) {
  const ahora =
    entrada.firstObservedAt || entrada.observedAt || new Date().toISOString();

  const canonicalUrl = entrada.canonicalUrl || entrada.permalink || null;

  const idPlataforma = entrada.commentId || entrada.id || null;

  return {
    commentId:
      idPlataforma ||
      (canonicalUrl ? `cmt-${huella(canonicalUrl)}` : null),

    /* De donde cuelga. Sin esto un comentario no es evidencia de nada. */
    platformId: entrada.platformId || null,
    postId: entrada.postId || null,
    postPermalink: entrada.postPermalink || null,

    /* Respuesta a otro comentario, si lo es. */
    parentCommentId: entrada.parentCommentId || null,
    esRespuesta: Boolean(entrada.parentCommentId),

    candidateId: entrada.candidateId || null,
    projectId: entrada.projectId || null,
    accountId: entrada.accountId || null,

    canonicalUrl,

    publishedAt: entrada.publishedAt || null,
    firstObservedAt: ahora,
    lastObservedAt: entrada.lastObservedAt || ahora,
    observationCount: entrada.observationCount || 1,

    /*
      El texto. Es el unico campo por el que existe este
      contrato: sin el, un comentario es un numero.
    */
    text: entrada.text ?? null,

    /*
      AUTOR SIN PERFILADO. Nombre visible e id de plataforma,
      que es lo minimo para deduplicar y contar participantes.
      No se cruza con identidad real ni se enriquece.
    */
    author: {
      platformUserId: entrada.authorId || null,
      displayName: entrada.authorName || null,

      noSeHace: [
        "resolucion de identidad real",
        "enriquecimiento con otras fuentes",
        "puntuacion o clasificacion del individuo"
      ]
    },

    /* Ausentes en null. Un 0 de likes es una medicion. */
    likes: entrada.likes ?? null,
    replyCount: entrada.replyCount ?? null,

    provider: entrada.provider || null,

    provenance: {
      providerId: entrada.provider || null,
      observationMethod: entrada.observationMethod || null,
      observedAt: ahora,
      rawReference: entrada.rawReference || null
    },

    evidenceId:
      entrada.evidenceId ||
      (canonicalUrl ? `ev-cmt-${huella(canonicalUrl)}` : null)
  };
}


/*
===========================================================
REOBSERVAR UN COMENTARIO

Misma regla que en publicaciones: `firstObservedAt` no se
reescribe nunca. Un comentario editado cambia su texto, y la
observacion anterior no desaparece por eso.
===========================================================
*/
export function fusionarComentario(previa, nueva) {
  if (!previa) return { ...nueva, observationCount: 1 };

  return {
    ...previa,
    ...nueva,

    /* La primera vez que se vio es un hecho del pasado. */
    firstObservedAt: previa.firstObservedAt,

    lastObservedAt: nueva.lastObservedAt || nueva.firstObservedAt,

    observationCount: (previa.observationCount || 1) + 1,

    /*
      Si el texto cambio entre observaciones, se conserva el
      anterior. Un comentario editado o borrado es informacion,
      no ruido.
    */
    textoAnterior:
      previa.text && nueva.text && previa.text !== nueva.text
        ? previa.text
        : previa.textoAnterior || null
  };
}


/*
===========================================================
EL CORPUS DE UNA PUBLICACION
===========================================================

Aqui vive la obligacion de lenguaje. Un corpus SIEMPRE declara
cuantos comentarios dice la plataforma que hay y cuantos se
observaron de verdad, porque son cifras distintas y la segunda
es la unica sobre la que se puede afirmar algo.
===========================================================
*/
export function crearCorpusDeComentarios(entrada = {}) {
  const comentarios = entrada.comentarios || [];

  const declarados = entrada.commentsCount ?? null;

  const observados = comentarios.length;

  const conTexto = comentarios.filter((c) => c && c.text).length;

  let estado = entrada.estado || null;

  if (!estado) {
    if (conTexto > 0) {
      estado = ESTADOS_CORPUS.OBSERVADO;
    } else if (declarados === 0) {
      estado = ESTADOS_CORPUS.SIN_COMENTARIOS;
    } else if (declarados > 0) {
      estado = ESTADOS_CORPUS.SOLO_RECUENTO;
    } else {
      estado = ESTADOS_CORPUS.NO_PROBADO;
    }
  }

  /*
    Completo solo si se observaron TODOS los que la plataforma
    declara. Con cualquier otra cifra, hablar de «los
    comentarios» seria hablar del universo teniendo una muestra.
  */
  const completo =
    declarados !== null && observados >= declarados && declarados > 0;

  return {
    platformId: entrada.platformId || null,
    postId: entrada.postId || null,
    postPermalink: entrada.postPermalink || null,

    estado,

    /* LAS DOS CIFRAS, SIEMPRE JUNTAS Y SIEMPRE SEPARADAS. */
    comentariosDeclaradosPorLaPlataforma: declarados,
    comentariosObservados: observados,
    comentariosConTexto: conTexto,

    disponibilidadDelTexto:
      conTexto > 0 ? DISPONIBILIDAD.DISPONIBLE : DISPONIBILIDAD.NO_DISPONIBLE,

    comentarios,

    cobertura: completo ? "COMPLETA" : "MUESTRA",

    provider: entrada.provider || null,
    observedAt: entrada.observedAt || new Date().toISOString(),

    /*
      La frase que impide la afirmacion falsa. Viaja con el dato
      para que quien lo lea no tenga que acordarse.
    */
    obligacionDeLenguaje:
      completo
        ? "Se observaron todos los comentarios que la plataforma declara para esta publicacion."
        : `COMENTARIOS OBSERVADOS != TODOS LOS COMENTARIOS. Se observaron ${observados}${
            declarados !== null ? ` de ${declarados} declarados` : ""
          }. Cualquier conclusion es sobre la muestra, no sobre el universo.`,

    noSignifica: [
      "TODOS_LOS_COMENTARIOS",
      "OPINION_PUBLICA",
      "INTENCION_DE_VOTO"
    ]
  };
}


export default {
  ESTADOS_CORPUS,
  crearComentarioObservado,
  fusionarComentario,
  crearCorpusDeComentarios
};
