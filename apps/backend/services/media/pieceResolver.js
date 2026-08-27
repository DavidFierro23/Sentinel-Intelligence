// apps/backend/services/media/pieceResolver.js

import {
  normalizarEvidencia,
  evidenciaValida,
  resolverCanonical,
  TIPOS_CONTENIDO
} from "../ingest/evidenceContract.js";

import { identificarFuente, TIPOS_FUENTE } from "../conversation/mediaRegistry.js";

import { clasificarFuente } from "../conversation/sourceClassifier.js";

import { extraerDominio } from "../textUtils.js";

import { PLATAFORMAS, CLASES_EMISOR } from "./pieceContracts.js";

/*
===========================================================
RESOLVER UNA URL A UNA PIEZA — MEDIA-PIECE-01 §2
===========================================================

Entra una URL pegada por un analista. Sale una PIEZA con su
emisor identificado y su procedencia declarada.

LO QUE ESTE FICHERO NO HACE
-----------------------------------------------------------

No descarga la pagina. Resolver la URL es un acto estructural
—plataforma, canonica, dominio, id de publicacion— y se puede
hacer sin pedir el documento. Descargar el HTML abre tres
problemas que este gate no necesita: licencia del contenido,
bloqueo por user-agent y latencia.

Cuando el titular o el autor solo esten en el HTML, se
declaran `null` con motivo. El analista puede aportarlos a
mano: un dato declarado por una persona es mejor que uno
inferido por una expresion regular.

POR QUE LA PLATAFORMA NO ES EL EMISOR
-----------------------------------------------------------

`youtube.com/watch?v=X` tiene plataforma YOUTUBE y emisor
"el canal que publico X". Tratar la plataforma como emisor
haria que todos los videos parecieran del mismo medio, que es
el mismo fallo que `evidenceContract` ya corrige para
news.google.com.
===========================================================
*/


/*
-----------------------------------------------------------
DETECCION DE PLATAFORMA E ID DE PUBLICACION

Cada patron esta escrito para extraer el id CANONICO de la
publicacion, no para adivinar. Si el patron no encaja, el id
queda null: mejor sin id que con un id equivocado, porque el
id es la clave con la que se agrupan los snapshots.
-----------------------------------------------------------
*/
const PATRONES = [
  {
    plataforma: PLATAFORMAS.YOUTUBE,
    dominios: ["youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com"],
    contentType: TIPOS_CONTENIDO.VIDEO,
    id(u) {
      if (/(^|\.)youtu\.be$/i.test(u.hostname)) {
        const seg = u.pathname.split("/").filter(Boolean)[0];
        return seg || null;
      }

      const v = u.searchParams.get("v");

      if (v) return v;

      const m = u.pathname.match(/\/(shorts|live|embed)\/([A-Za-z0-9_-]{6,})/);

      return m ? m[2] : null;
    },
    canonica(id) {
      return id ? `https://www.youtube.com/watch?v=${id}` : null;
    }
  },

  {
    plataforma: PLATAFORMAS.X,
    dominios: ["x.com", "twitter.com", "mobile.twitter.com"],
    contentType: TIPOS_CONTENIDO.PUBLICACION_SOCIAL,
    id(u) {
      const m = u.pathname.match(/\/status(?:es)?\/(\d+)/);
      return m ? m[1] : null;
    },
    cuenta(u) {
      const seg = u.pathname.split("/").filter(Boolean);
      return seg[0] && seg[0] !== "i" ? seg[0] : null;
    }
  },

  {
    plataforma: PLATAFORMAS.INSTAGRAM,
    dominios: ["instagram.com", "www.instagram.com"],
    contentType: TIPOS_CONTENIDO.PUBLICACION_SOCIAL,
    id(u) {
      const m = u.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
      return m ? m[2] : null;
    },
    cuenta(u) {
      const seg = u.pathname.split("/").filter(Boolean);
      return seg.length && !["p", "reel", "reels", "tv", "explore"].includes(seg[0])
        ? seg[0]
        : null;
    }
  },

  {
    plataforma: PLATAFORMAS.TIKTOK,
    dominios: ["tiktok.com", "vm.tiktok.com"],
    contentType: TIPOS_CONTENIDO.VIDEO,
    id(u) {
      const m = u.pathname.match(/\/video\/(\d+)/);
      return m ? m[1] : null;
    },
    cuenta(u) {
      const m = u.pathname.match(/\/@([^/]+)/);
      return m ? m[1] : null;
    }
  },

  {
    plataforma: PLATAFORMAS.FACEBOOK,
    dominios: ["facebook.com", "fb.com", "m.facebook.com", "fb.watch"],
    contentType: TIPOS_CONTENIDO.PUBLICACION_SOCIAL,
    id(u) {
      const fbid = u.searchParams.get("story_fbid") || u.searchParams.get("v");

      if (fbid) return fbid;

      const m = u.pathname.match(/\/(posts|videos|reel)\/([A-Za-z0-9._-]+)/);

      return m ? m[2] : null;
    },
    cuenta(u) {
      const seg = u.pathname.split("/").filter(Boolean);
      return seg[0] && !["posts", "videos", "reel", "watch"].includes(seg[0])
        ? seg[0]
        : null;
    }
  }
];


export function detectarPlataforma(url) {
  let u;

  try {
    u = new URL(String(url));
  } catch {
    return {
      plataforma: null,
      publicationId: null,
      cuentaEnUrl: null,
      contentType: TIPOS_CONTENIDO.DESCONOCIDO,
      canonicaDePlataforma: null,
      motivo: "La URL no es utilizable."
    };
  }

  const host = u.hostname.replace(/^www\./i, "").toLowerCase();

  const patron = PATRONES.find((p) =>
    p.dominios.some((d) => host === d || host.endsWith(`.${d}`))
  );

  if (!patron) {
    return {
      plataforma: PLATAFORMAS.WEB,
      publicationId: null,
      cuentaEnUrl: null,
      contentType: TIPOS_CONTENIDO.PAGINA_WEB,
      canonicaDePlataforma: null,
      motivo:
        "El dominio no corresponde a una plataforma social conocida: se trata como pagina web."
    };
  }

  const publicationId = patron.id ? patron.id(u) : null;

  return {
    plataforma: patron.plataforma,
    publicationId,
    cuentaEnUrl: patron.cuenta ? patron.cuenta(u) : null,
    contentType: patron.contentType,

    /*
      Solo YouTube tiene una canonica reconstruible desde el id.
      En el resto, la URL que trajo el analista es lo mejor que
      hay: reconstruirla podria perder informacion de la ruta.
    */
    canonicaDePlataforma: patron.canonica ? patron.canonica(publicationId) : null,

    motivo: publicationId
      ? null
      : "Se reconocio la plataforma pero no el identificador de la publicacion en la URL."
  };
}


/*
===========================================================
CLASE DEL EMISOR

Tres caminos, en orden de fiabilidad, y ninguno mira
seguidores:

  1. el catalogo de medios (`mediaRegistry`) — es un padron
     declarado, la fuente mas fiable que existe hoy
  2. el clasificador de fuentes (`sourceClassifier`) — reglas
     estructurales sobre el dominio
  3. la forma de la URL — una URL de perfil dentro de una
     plataforma es una cuenta, no un medio

Si los tres callan: NO_DETERMINADO con su motivo.
===========================================================
*/

const MAPA_TIPOS_FUENTE = Object.freeze({
  [TIPOS_FUENTE.MEDIO_LOCAL]: CLASES_EMISOR.MEDIO,
  [TIPOS_FUENTE.MEDIO_REGIONAL]: CLASES_EMISOR.MEDIO,
  [TIPOS_FUENTE.MEDIO_NACIONAL]: CLASES_EMISOR.MEDIO,
  [TIPOS_FUENTE.INSTITUCION]: CLASES_EMISOR.INSTITUCIONAL,
  [TIPOS_FUENTE.PLATAFORMA]: CLASES_EMISOR.PLATAFORMA,
  [TIPOS_FUENTE.AGREGADOR]: CLASES_EMISOR.OTRO,
  [TIPOS_FUENTE.ENCICLOPEDICO]: CLASES_EMISOR.OTRO
});


export function clasificarEmisor({ url, plataforma, cuentaEnUrl, autorDeclarado }) {
  const dominio = extraerDominio(url);

  const razones = [];

  /* --- 1. catalogo de medios --- */
  const ficha = identificarFuente(url);

  if (ficha?.tipo && MAPA_TIPOS_FUENTE[ficha.tipo]) {
    const clase = MAPA_TIPOS_FUENTE[ficha.tipo];

    /*
      Excepcion necesaria: si el dominio es una PLATAFORMA y la
      URL apunta a una cuenta concreta, el emisor es la cuenta,
      no la plataforma. El catalogo clasifica el dominio; aqui
      se clasifica la pieza.
    */
    if (clase === CLASES_EMISOR.PLATAFORMA && cuentaEnUrl) {
      razones.push(
        `El dominio ${dominio} es una plataforma en el catalogo, pero la URL identifica la cuenta "${cuentaEnUrl}": el emisor es la cuenta.`
      );

      return {
        clase: CLASES_EMISOR.CREADOR,
        nombre: cuentaEnUrl,
        dominio,
        procedencia: "catalogo_de_medios + forma_de_la_url",
        razones,
        catalogo: ficha,
        advertencia:
          "CREADOR es la clase por defecto para una cuenta sin catalogar. Podria ser un periodista, un medio o una institucion: exige verificacion del analista."
      };
    }

    /*
      Segunda excepcion: el dominio ES una plataforma y la URL NO
      identifica la cuenta (el caso de youtube.com/watch?v=ID).

      Devolver PLATAFORMA aqui seria repetir el error del
      agregador que `evidenceContract` ya corrige para
      news.google.com: todos los videos parecerian publicados
      por "youtube.com". El emisor real es el canal, y el canal
      solo se conoce leyendo la plataforma.
    */
    if (clase === CLASES_EMISOR.PLATAFORMA && !cuentaEnUrl) {
      razones.push(
        `El dominio ${dominio} es una plataforma: el emisor es la cuenta que publica, no el dominio.`
      );

      razones.push(
        "La URL no contiene el identificador de la cuenta: resolverla exige leer la plataforma."
      );

      return {
        clase: CLASES_EMISOR.NO_DETERMINADO,
        nombre: null,
        dominio,
        procedencia: "plataforma_sin_cuenta_en_la_url",
        razones,
        catalogo: ficha,
        pendienteDeResolver: true,
        advertencia:
          "El emisor queda sin resolver a proposito. Atribuir la pieza al dominio de la plataforma haria que todas las publicaciones parecieran del mismo emisor."
      };
    }

    razones.push(
      `El dominio ${dominio} esta en el catalogo de medios como ${ficha.tipo}${
        ficha.nombre ? ` (${ficha.nombre})` : ""
      }.`
    );

    return {
      clase,
      nombre: ficha.nombre || dominio,
      dominio,
      procedencia: "catalogo_de_medios",
      razones,
      catalogo: ficha,
      advertencia: null
    };
  }

  /* --- 2. clasificador de fuentes --- */
  let porClasificador = null;

  try {
    porClasificador = clasificarFuente({ url, dominio });
  } catch {
    porClasificador = null;
  }

  if (porClasificador?.clase) {
    razones.push(
      `sourceClassifier lo clasifico como ${porClasificador.clase}${
        porClasificador.motivo ? `: ${porClasificador.motivo}` : ""
      }.`
    );
  }

  /* --- 3. forma de la URL --- */
  if (plataforma && plataforma !== PLATAFORMAS.WEB && cuentaEnUrl) {
    razones.push(
      `La URL pertenece a ${plataforma} e identifica la cuenta "${cuentaEnUrl}".`
    );

    return {
      clase: CLASES_EMISOR.CREADOR,
      nombre: cuentaEnUrl,
      dominio,
      procedencia: "forma_de_la_url",
      razones,
      catalogo: null,
      advertencia:
        "CREADOR es la clase por defecto para una cuenta que no esta en ningun catalogo. No se ha comprobado si es periodista, medio o institucion, y NO se deduce de su numero de seguidores."
    };
  }

  if (autorDeclarado) {
    razones.push(
      `El analista declaro el autor "${autorDeclarado}" sin especificar la clase del emisor.`
    );
  }

  razones.push(
    `El dominio ${dominio || "(no resoluble)"} no esta en el catalogo de medios y la URL no identifica una cuenta.`
  );

  return {
    clase: CLASES_EMISOR.NO_DETERMINADO,
    nombre: dominio || null,
    dominio,
    procedencia: "sin_coincidencia",
    razones,
    catalogo: null,
    advertencia:
      "NO_DETERMINADO no es un error: es lo unico que se puede afirmar. El analista puede declarar la clase manualmente."
  };
}


/*
===========================================================
RESOLVER LA PIEZA
===========================================================

Devuelve la pieza y la evidencia canonica que la representa.
La evidencia se construye con `normalizarEvidencia` para que
entre al corpus con la misma forma que cualquier otra, y su
`evidenceId` es el que despues cita todo el analisis.
===========================================================
*/
export function resolverPieza(entrada = {}) {
  const urlEntrada = String(entrada.url || "").trim();

  const observedAt = entrada.observedAt || new Date().toISOString();

  if (!urlEntrada) {
    return {
      ok: false,
      motivo: "No se recibio ninguna URL.",
      pieza: null,
      emisor: null,
      evidencia: null
    };
  }

  const plat = detectarPlataforma(urlEntrada);

  if (!plat.plataforma) {
    return {
      ok: false,
      motivo: plat.motivo || "La URL no es utilizable.",
      pieza: null,
      emisor: null,
      evidencia: null
    };
  }

  /*
    La canonica de plataforma manda cuando existe (YouTube).
    En el resto se delega en `resolverCanonical`, que ya sabe
    quitar parametros de rastreo y detectar agregadores.
  */
  const canon = resolverCanonical({
    url: urlEntrada,
    canonicalDeclarada: plat.canonicaDePlataforma || entrada.canonicalUrl || null
  });

  const evidencia = normalizarEvidencia(
    {
      url: urlEntrada,
      canonicalUrl: plat.canonicaDePlataforma || entrada.canonicalUrl || null,
      title: entrada.titulo || null,
      snippet: entrada.snippet || null,
      publishedAt: entrada.publishedAt || null,
      author: entrada.autor || null,
      platform: plat.plataforma,
      contentType: plat.contentType
    },
    {
      providerId: "analista_url_pegada",
      query: null,
      queryType: "pieza_directa",
      queryLabel: "URL aportada por el analista",
      observedAt
    }
  );

  const valida = evidenciaValida(evidencia);

  const emisor = clasificarEmisor({
    url: canon.canonicalUrl || urlEntrada,
    plataforma: plat.plataforma,
    cuentaEnUrl: plat.cuentaEnUrl,
    autorDeclarado: entrada.autor || null
  });

  const pieza = {
    pieceId: evidencia.evidenceId,
    publicationId: plat.publicationId,

    url: urlEntrada,
    canonicalUrl: evidencia.canonicalUrl,
    origenCanonical: evidencia.origenCanonical,
    avisoCanonical: canon.aviso || null,

    dominio: extraerDominio(evidencia.canonicalUrl || urlEntrada),
    plataforma: plat.plataforma,
    contentType: plat.contentType,

    titulo: evidencia.title || null,
    snippet: evidencia.snippet || null,

    /*
      Autor y fecha solo si alguien los declaro. No se raspan
      del HTML en este gate: ver la cabecera.
    */
    autor: evidencia.author || null,
    autorProcedencia: evidencia.author ? "declarado_por_el_analista" : null,

    publishedAt: evidencia.publishedAt || null,
    publishedAtProcedencia: evidencia.publishedAt
      ? "declarado_por_el_analista"
      : null,

    firstObservedAt: observedAt,
    lastObservedAt: observedAt,

    evidenceId: evidencia.evidenceId,
    hash: evidencia.hash
  };

  const limitaciones = [];

  if (!pieza.publicationId && plat.plataforma !== PLATAFORMAS.WEB) {
    limitaciones.push(plat.motivo);
  }

  if (!pieza.autor) {
    limitaciones.push(
      "Autor no resuelto: este gate no descarga el HTML de la pieza. Puede declararse manualmente."
    );
  }

  if (!pieza.publishedAt) {
    limitaciones.push(
      "Fecha de publicacion no resuelta: sin ella no se puede ordenar la pieza frente a sus replicas."
    );
  }

  if (canon.aviso) limitaciones.push(canon.aviso);

  if (!valida.valida) {
    limitaciones.push(
      `La evidencia es minima (${valida.motivos.join(", ")}): se conserva la URL, pero sin titulo no se pueden buscar replicas por titular.`
    );
  }

  return {
    ok: true,
    pieza,
    emisor,
    evidencia,
    limitaciones
  };
}


export default {
  detectarPlataforma,
  clasificarEmisor,
  resolverPieza
};
