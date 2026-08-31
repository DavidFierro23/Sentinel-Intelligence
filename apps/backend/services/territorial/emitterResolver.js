// apps/backend/services/territorial/emitterResolver.js

import { identificarFuente, TIPOS_FUENTE } from "../conversation/mediaRegistry.js";
import { extraerDominio } from "../textUtils.js";

/*
===========================================================
QUIEN PUBLICA — TERRITORIAL-ACCELERATION-02
===========================================================

El hueco mas grande que dejo §13-terdecies: los tres cruces
reales salieron con CERO emisores resueltos.

La causa no era un fallo: el corpus persistido venia de Google
News, que entrega el enlace apuntando a `news.google.com` y
esconde al publicador. La fuente se identifica correctamente
como AGREGADOR y el emisor queda `null`.

POR QUE RSS LO ARREGLA
-----------------------------------------------------------

Leyendo el feed del propio medio, el publicador no hay que
adivinarlo: ES el feed. Un `<link rel="alternate">` en la
portada de El Mercurio es un compromiso del medio sobre su
propio contenido.

Esa es la unica via que este modulo llama RESUELTO.

TRES ESTADOS, Y LA DIFERENCIA IMPORTA
-----------------------------------------------------------

  RESUELTO                  el feed del propio medio lo declara,
                            y ese feed esta COMPROBADO en el
                            universo de fuentes.

  OBSERVADO_NO_VERIFICADO   hay una señal razonable —el titulo
                            del feed, o el dominio en el
                            catalogo— pero nadie ha comprobado
                            que ese dominio sea ese medio.

  NO_RESUELTO               no se sabe. Un agregador cae aqui, y
                            eso NO es un fallo: es un hecho
                            sobre el agregador.

Confundir el segundo con el primero convertiria una inferencia
por dominio en una afirmacion sobre quien publica.

LO QUE NO SE HACE
-----------------------------------------------------------

NO se infiere emisor por parecido de cadenas. Que un titular
acabe en «- El Mercurio» sugiere un publicador, pero rescatarlo
del sufijo del titular ya esta marcado como fragil en el
registro de medios y aqui no se usa como fuente de verdad.

NO se inventa un emisor para que la cifra suba.
===========================================================
*/


export const ESTADOS_EMISOR = Object.freeze({
  RESUELTO: "RESUELTO",
  OBSERVADO_NO_VERIFICADO: "OBSERVADO_NO_VERIFICADO",
  NO_RESUELTO: "NO_RESUELTO"
});


export const VIAS = Object.freeze({
  FEED_COMPROBADO: "feed_comprobado_del_medio",
  TITULO_DEL_FEED: "titulo_declarado_por_el_feed",
  DOMINIO_EN_CATALOGO: "dominio_en_catalogo_semilla",
  AGREGADOR: "agregador_oculta_al_publicador",
  SIN_SEÑAL: "sin_señal"
});


/*
  Un agregador no es un emisor. `news.google.com` publica
  enlaces, no noticias, y contarlo como emisor inflaria la
  diversidad de la que se informa.
*/
function esAgregador(tipo) {
  return tipo === TIPOS_FUENTE.AGREGADOR || tipo === TIPOS_FUENTE.PLATAFORMA;
}


/*
-----------------------------------------------------------
INDICE DE FEEDS COMPROBADOS

Del universo de fuentes de TERRITORIAL-SOURCE-UNIVERSE-01 al
mapa `feedUrl -> fuente`. Solo las fuentes con feed valido: un
feed que no respondio no acredita a nadie.
-----------------------------------------------------------
*/

export function indiceDeFeeds(fichas = []) {
  const porFeed = new Map();

  const porDominio = new Map();

  fichas.forEach((f) => {
    if (f.estadoVerificacion !== "VERIFICADO_FEED") return;

    (f.feeds || []).forEach((feed) => {
      if (!feed?.url) return;

      porFeed.set(feed.url, f);
    });

    if (f.dominio) porDominio.set(f.dominio, f);
  });

  return { porFeed, porDominio };
}


/*
===========================================================
RESOLVER EL EMISOR DE UNA EVIDENCIA
===========================================================
*/

export function resolverEmisor(evidencia = {}, opciones = {}) {
  const indice = opciones.indice || { porFeed: new Map(), porDominio: new Map() };

  const instante = opciones.instante || null;

  const url = evidencia.canonicalUrl || evidencia.url || evidencia.enlace || null;

  const dominio =
    evidencia.domain ||
    evidencia.dominio ||
    evidencia.sourceId ||
    (url ? extraerDominio(url) : null);

  const feedUrl = evidencia.feedUrl || evidencia.provenance?.query || null;

  const salida = (estado, via, { emitterId = null, publisher = null, nota = null }) => ({
    publisher,
    emitterId,
    emitterStatus: estado,

    procedencia: {
      via,
      feedUrl: feedUrl || null,
      dominio: dominio || null,
      instante,
      nota
    }
  });

  /*
    ---------------------------------------------------------
    1. EL FEED COMPROBADO DEL PROPIO MEDIO

    La unica via que acredita. El feed lo declara el sitio en su
    portada y `sourceVerifier` comprobo que responde.
    ---------------------------------------------------------
  */
  if (feedUrl && indice.porFeed.has(feedUrl)) {
    const f = indice.porFeed.get(feedUrl);

    return salida(ESTADOS_EMISOR.RESUELTO, VIAS.FEED_COMPROBADO, {
      emitterId: f.sourceId,
      publisher: f.nombre,

      nota:
        "El feed es del propio medio y está comprobado en el universo de fuentes. El publicador no se adivina: es el feed."
    });
  }

  /*
    ---------------------------------------------------------
    2. EL TITULO QUE DECLARA EL FEED

    `rssAdapter` rellena `publisher` con el titulo del feed. Es
    una declaracion de la fuente, no una comprobacion nuestra:
    si el feed no consta en el universo, no asciende.
    ---------------------------------------------------------
  */
  if (evidencia.publisher || evidencia.fuenteDeclarada) {
    const declarado = evidencia.publisher || evidencia.fuenteDeclarada;

    const porDominio = dominio ? indice.porDominio.get(dominio) : null;

    if (porDominio) {
      return salida(ESTADOS_EMISOR.RESUELTO, VIAS.FEED_COMPROBADO, {
        emitterId: porDominio.sourceId,
        publisher: porDominio.nombre,

        nota: `El feed declara «${declarado}» y el dominio está comprobado en el universo de fuentes.`
      });
    }

    return salida(ESTADOS_EMISOR.OBSERVADO_NO_VERIFICADO, VIAS.TITULO_DEL_FEED, {
      emitterId: dominio || null,
      publisher: declarado,

      nota:
        "Lo declara el feed, pero ese dominio NO está comprobado en el universo de fuentes. Es una observación, no una verificación."
    });
  }

  /*
    ---------------------------------------------------------
    3. EL DOMINIO EN EL CATALOGO SEMILLA

    Inferencia a nivel de dominio. Sirve para no perder al
    emisor de un medio conocido, y no acredita: el catalogo
    semilla declara que ninguna de sus entradas esta contrastada
    contra un registro oficial.
    ---------------------------------------------------------
  */
  const fuente = identificarFuente(evidencia);

  if (fuente && esAgregador(fuente.tipo)) {
    return salida(ESTADOS_EMISOR.NO_RESUELTO, VIAS.AGREGADOR, {
      nota: `«${dominio}» es un ${fuente.tipo}: publica enlaces, no noticias. Quién publicó NO se sabe, y contarlo como emisor inflaría la diversidad.`
    });
  }

  if (fuente?.nombre && fuente.tipo !== TIPOS_FUENTE.DESCONOCIDO) {
    return salida(ESTADOS_EMISOR.OBSERVADO_NO_VERIFICADO, VIAS.DOMINIO_EN_CATALOGO, {
      emitterId: dominio || null,
      publisher: fuente.nombre,

      nota:
        "Inferido del catálogo semilla por dominio. El catálogo declara que ninguna entrada está contrastada contra un registro oficial de medios."
    });
  }

  return salida(ESTADOS_EMISOR.NO_RESUELTO, VIAS.SIN_SEÑAL, {
    nota: dominio
      ? `Sin señal suficiente para «${dominio}». No se infiere por parecido de cadenas.`
      : "La evidencia no trae dominio ni feed: no hay por dónde empezar."
  });
}


export function resolverLoteDeEmisores(evidencias = [], opciones = {}) {
  const resueltas = evidencias.map((e) => ({
    ...e,
    ...resolverEmisor(e, opciones)
  }));

  const porEstado = {
    [ESTADOS_EMISOR.RESUELTO]: 0,
    [ESTADOS_EMISOR.OBSERVADO_NO_VERIFICADO]: 0,
    [ESTADOS_EMISOR.NO_RESUELTO]: 0
  };

  const porVia = {};

  resueltas.forEach((e) => {
    porEstado[e.emitterStatus] += 1;

    const v = e.procedencia?.via;

    if (v) porVia[v] = (porVia[v] || 0) + 1;
  });

  const emisoresDistintos = new Set(
    resueltas
      .filter((e) => e.emitterStatus !== ESTADOS_EMISOR.NO_RESUELTO && e.emitterId)
      .map((e) => e.emitterId)
  );

  return {
    evidencias: resueltas,

    metricas: {
      total: resueltas.length,
      porEstado,
      porVia,

      /*
        Emisores DISTINTOS acreditados u observados. No se suman
        los NO_RESUELTO: no saber quien publica no es un emisor
        mas.
      */
      emisoresDistintos: emisoresDistintos.size,

      resueltos: porEstado[ESTADOS_EMISOR.RESUELTO],
      soloObservados: porEstado[ESTADOS_EMISOR.OBSERVADO_NO_VERIFICADO],
      sinResolver: porEstado[ESTADOS_EMISOR.NO_RESUELTO]
    },

    declaraciones: [
      "RESUELTO exige que el feed sea del propio medio y esté comprobado en el universo de fuentes. Leer al medio en su casa es la única vía que acredita.",
      "OBSERVADO_NO_VERIFICADO es una señal razonable sin comprobar: el título de un feed desconocido, o el dominio en el catálogo semilla.",
      "Un agregador queda NO_RESUELTO y eso no es un fallo: es un hecho sobre el agregador. Google News oculta al publicador por diseño.",
      "NO se infiere emisor por parecido de cadenas. Rescatar al publicador del sufijo del titular ya está marcado como frágil."
    ]
  };
}


export default {
  ESTADOS_EMISOR,
  VIAS,
  indiceDeFeeds,
  resolverEmisor,
  resolverLoteDeEmisores
};
