// apps/backend/services/media/mediaCanonicalCorpus.js

import { deduplicarMultifuente, CRITERIOS, FUERZA_CRITERIO } from "../ingest/crossProviderDedup.js";

import { esFeedDeComentarios } from "../territorial/verifiedSourceUniverse.js";

import { leerCorpusDeProyecto, clavePieza } from "./mediaCorpus.js";

import { leerPublicaciones } from "./mediaMeasurementStore.js";

import { universoDeProyecto } from "./mediaUniverseStore.js";

import { identidadDeActivo, puedeMedirse } from "./mediaAssetMeasurement.js";

import { motivoDeExclusionDelUniverso } from "./mediaSourceUniverse.js";

import { ESTADOS_DATO } from "./mediaVocabulary.js";

/*
===========================================================
MEDIA-CORPUS-INTEGRATION-01 — EL CORPUS CANONICO
===========================================================

Una VISTA sobre los dos almacenes que ya existen, no un tercer
corpus. Nada se copia y nada se reescribe:

    media_piece         piezas analizadas y su amplificacion
    media_measurement   publicaciones leidas de los activos

POR QUE NO SE SUMAN Y YA
-----------------------------------------------------------

Porque 28 + 90 = 118 seria falso dos veces. Falso por arriba, si
la misma nota llego por dos rutas; y falso por abajo, si al
deduplicar de mas se borra una republicacion que SI es una
publicacion distinta.

La reconciliacion no la escribe este fichero: la hace
`crossProviderDedup`, que ya distingue los cuatro criterios y ya
declara la regla que importa —«dos medios distintos publicando
el mismo texto son DOS publicaciones»—. Aqui solo se traduce su
traza a las cinco clases de solape del gate.

LAS CINCO CLASES
-----------------------------------------------------------

    EXACT_DUPLICATE      misma URL canonica o normalizada
    PROBABLE_DUPLICATE   mismo dominio y titular casi identico
    REPUBLICATION        titular casi identico en OTRO dominio
    DISTINCT_PUBLICATION no coincide con nada
    EXCLUDED_ARTIFACT    no es una publicacion editorial

REPUBLICATION se CONSERVA. Que dos cabeceras decidieran publicar
lo mismo es informacion, y fundirlas borraria a una de las dos
del corpus.

LO QUE NUNCA ENTRA
-----------------------------------------------------------

    dominios de plataforma        el emisor es la cuenta
    agregadores y redirectores    residuo de nuestro metodo
    hosts de infraestructura      un balanceador no publica
    feeds de comentarios          respuestas de lectores
    activos en conflicto          no se sabe de quien es

El ultimo es el mas facil de pasar por alto y el mas caro:
`x:tomebamba` lo reclaman dos entidades, asi que su contenido no
puede contar para ninguna de las dos.
===========================================================
*/

export const VERSION_CORPUS_CANONICO = "1.0";


export const CLASES_SOLAPE = Object.freeze({
  EXACT_DUPLICATE: "EXACT_DUPLICATE",
  PROBABLE_DUPLICATE: "PROBABLE_DUPLICATE",
  REPUBLICATION: "REPUBLICATION",
  DISTINCT_PUBLICATION: "DISTINCT_PUBLICATION",
  EXCLUDED_ARTIFACT: "EXCLUDED_ARTIFACT"
});


export const EXPLICACION_SOLAPE = Object.freeze({
  EXACT_DUPLICATE:
    "Misma URL canonica o normalizada: es UNA publicacion vista por varias rutas. Se funde y se conservan todas las procedencias.",
  PROBABLE_DUPLICATE:
    "Mismo dominio y titular casi identico. Se funde, y el criterio queda registrado por si hubiera que revisarlo.",
  REPUBLICATION:
    "Titular casi identico en OTRO dominio. NO se funde: dos medios que publican lo mismo son dos publicaciones, y que cada uno lo decidiera es informacion.",
  DISTINCT_PUBLICATION: "No coincide con ninguna otra pieza del corpus.",
  EXCLUDED_ARTIFACT:
    "No es una publicacion editorial: plataforma, agregador, infraestructura, feed de comentarios o contenido sin identidad suficiente."
});


/* Procedencias posibles de una pieza canonica. */
export const PROCEDENCIAS = Object.freeze({
  ANALISIS: "ANALISIS_DE_PIEZA",
  AMPLIFICACION: "AMPLIFICACION",
  MEDIA_MEASUREMENT: "MEDIA_MEASUREMENT"
});


/* Motivos de exclusion, cada uno distinto porque no se arreglan igual. */
export const MOTIVOS_EXCLUSION = Object.freeze({
  PLATAFORMA: "DOMINIO_DE_PLATAFORMA",
  ARTEFACTO: "ARTEFACTO_DE_RECOLECCION",
  INFRAESTRUCTURA: "HOST_DE_INFRAESTRUCTURA",
  FEED_COMENTARIOS: "FEED_DE_COMENTARIOS",
  IDENTIDAD_EN_CONFLICTO: "IDENTIDAD_EN_CONFLICTO",
  SIN_URL: "SIN_URL_UTILIZABLE"
});


/*
-----------------------------------------------------------
ADAPTADOR AL CONTRATO DE `crossProviderDedup`

Espera `{evidenceId, canonicalUrl, url, urlNormalizada, title,
sourceId, publishedAt, observedAt, providerId}`. Se traduce sin
perder nada del original, que viaja en `_origen`.
-----------------------------------------------------------
*/
function aFormaDedup(pieza, procedencia) {
  return {
    evidenceId: pieza.evidenceId || pieza.clave || pieza.canonicalUrl,

    canonicalUrl: pieza.canonicalUrl || pieza.url || null,
    url: pieza.urlOriginal || pieza.url || pieza.canonicalUrl || null,

    /*
      La clave se NORMALIZA aqui siempre, en lugar de confiar en
      la que traiga el almacen. Es lo que hace que
      `https://www.medioa.com/nota-1/` y `medioa.com/nota-1` sean
      la misma pieza aunque quien las escribio guardara la clave
      en formatos distintos.

      Confiar en la clave ajena hacia que la reconciliacion
      dependiera de la disciplina de cada escritor, y basta un
      almacen que guarde la URL cruda para que una nota se cuente
      dos veces.
    */
    urlNormalizada:
      clavePieza(pieza.canonicalUrl || pieza.url || pieza.clave || "") ||
      pieza.clave ||
      null,

    title: pieza.titulo || null,
    sourceId: pieza.dominio || null,

    publishedAt: pieza.publishedAt || null,
    observedAt: pieza.observedAt || null,

    author: pieza.autor || null,
    publisher: pieza.nombreEmisor || null,

    /*
      `providerId` es lo que `crossProviderDedup` usa para
      declarar «quien la vio». Aqui el proveedor es la RUTA de
      observacion, que es exactamente la pregunta de §3.
    */
    providerId: procedencia,

    _origen: { ...pieza, procedencia }
  };
}


/*
===========================================================
QUE SE EXCLUYE, Y POR QUE
===========================================================
*/
function motivoDeExclusion(pieza, { activosEnConflicto } = {}) {
  const url = pieza.canonicalUrl || pieza.url || pieza.clave;

  if (!url) return MOTIVOS_EXCLUSION.SIN_URL;

  try {
    /*
      `esFeedDeComentarios` parsea la URL con `new URL()`, asi que
      exige esquema. Las claves canonicas del corpus vienen
      normalizadas y SIN esquema —`elmercurio.com.ec/comments/feed/`—,
      con lo que la guarda devolvia siempre false y no excluia nada.

      No se noto porque la capa de medicion ya descarta el feed de
      comentarios antes de leerlo, asi que ninguna publicacion de
      ese origen llegaba hasta aqui. La guarda estaba muerta y
      habria dejado pasar un feed de comentarios que entrara por
      cualquier otra ruta.
    */
    const conEsquema = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    if (esFeedDeComentarios(conEsquema)) return MOTIVOS_EXCLUSION.FEED_COMENTARIOS;
  } catch {
    /* Si no se puede decidir, no se excluye por esto. */
  }

  /*
    Un activo social en conflicto de identidad no puede aportar
    al corpus de ninguna de las entidades que lo reclaman.
  */
  if (pieza.assetId && activosEnConflicto?.has(pieza.assetId)) {
    return MOTIVOS_EXCLUSION.IDENTIDAD_EN_CONFLICTO;
  }

  const motivo = motivoDeExclusionDelUniverso(pieza.dominio);

  if (!motivo) return null;

  /*
    Una pieza publicada EN una plataforma por una cuenta
    identificable no es un artefacto: es la publicacion de esa
    cuenta. Solo se excluye la raiz de plataforma sin emisor.
    Es la distincion que MEDIA-SOURCE-UNIVERSE-01 fijo.
  */
  if (/plataforma/i.test(motivo)) {
    const tieneEmisor =
      pieza.emisor?.handle ||
      (pieza.emisor?.clase && pieza.emisor.clase !== "NO_DETERMINADO");

    return tieneEmisor ? null : MOTIVOS_EXCLUSION.PLATAFORMA;
  }

  if (/infraestructura|balanceador|CDN/i.test(motivo)) {
    return MOTIVOS_EXCLUSION.INFRAESTRUCTURA;
  }

  return MOTIVOS_EXCLUSION.ARTEFACTO;
}


/*
===========================================================
EL CORPUS CANONICO DE UN PROYECTO
===========================================================
*/
export async function corpusCanonicoDeProyecto(opciones = {}) {
  const projectId = String(opciones.projectId || "").trim();

  if (!projectId) {
    return {
      ok: false,
      motivo:
        "Falta projectId. El corpus canonico es POR PROYECTO: sin el, se mezclarian las piezas de dos campanas.",
      estado: ESTADOS_DATO.NO_DISPONIBLE
    };
  }

  const corpus = await leerCorpusDeProyecto(opciones);

  if (!corpus.ok) return { ok: false, motivo: corpus.motivo };

  const publicaciones = await leerPublicaciones({
    projectId,
    tenantId: opciones.tenantId,
    lake: opciones.lake || {}
  });

  /*
    -----------------------------------------------------------
    ACTIVOS EN CONFLICTO DE IDENTIDAD

    Se leen del universo. Es lo que impide que el contenido de
    `x:tomebamba` cuente para «La Voz del Tomebamba» o para
    «Radio Tomebamba»: no se sabe de quien es.
    -----------------------------------------------------------
  */
  const activosEnConflicto = new Set();

  let universo = null;

  try {
    universo = await universoDeProyecto({ ...opciones, projectId });

    if (universo.ok) {
      universo.entidades.forEach((e) => {
        (e.activos || []).forEach((a) => {
          const id = identidadDeActivo({
            entidad: e,
            activo: a,
            todasLasEntidades: universo.entidades
          });

          if (!puedeMedirse(id)) activosEnConflicto.add(a.assetId);
        });
      });
    }
  } catch {
    /* Sin universo se sigue: el corpus no depende de el para existir. */
  }

  /*
    -----------------------------------------------------------
    LAS TRES ENTRADAS
    -----------------------------------------------------------
  */
  const entradas = [
    ...corpus.piezas.map((p) => aFormaDedup(p, PROCEDENCIAS.ANALISIS)),
    ...corpus.amplificacion.map((p) => aFormaDedup(p, PROCEDENCIAS.AMPLIFICACION)),
    ...publicaciones.map((p) =>
      aFormaDedup(
        {
          ...p,
          clave: p.clave,
          canonicalUrl: p.canonicalUrl,
          dominio: dominioDePublicacion(p),
          nombreEmisor: null
        },
        PROCEDENCIAS.MEDIA_MEASUREMENT
      )
    )
  ];

  /*
    -----------------------------------------------------------
    EXCLUSIONES, ANTES DE DEDUPLICAR

    Se filtra primero para no gastar comparaciones en algo que
    no puede entrar, y para que el recuento de duplicados no
    incluya artefactos.
    -----------------------------------------------------------
  */
  const excluidas = [];

  const admitidas = [];

  entradas.forEach((e) => {
    const motivo = motivoDeExclusion(e._origen, { activosEnConflicto });

    if (motivo) {
      excluidas.push({
        evidenceId: e.evidenceId,
        url: e.canonicalUrl,
        dominio: e._origen.dominio || null,
        procedencia: e._origen.procedencia,
        clase: CLASES_SOLAPE.EXCLUDED_ARTIFACT,
        motivo
      });

      return;
    }

    admitidas.push(e);
  });

  /*
    -----------------------------------------------------------
    RECONCILIACION

    La hace el modulo que ya existe. Aqui no hay ni una
    comparacion de cadenas escrita a mano.
    -----------------------------------------------------------
  */
  const dedup = deduplicarMultifuente(admitidas, {
    umbralTitulo: opciones.umbralTitulo
  });

  /* Traza -> clases del gate. */
  const claseDeCriterio = {
    [CRITERIOS.CANONICAL]: CLASES_SOLAPE.EXACT_DUPLICATE,
    [CRITERIOS.URL]: CLASES_SOLAPE.EXACT_DUPLICATE,
    [CRITERIOS.DOMINIO_Y_TITULO]: CLASES_SOLAPE.PROBABLE_DUPLICATE,
    [CRITERIOS.SINDICACION]: CLASES_SOLAPE.REPUBLICATION
  };

  const solape = dedup.traza.map((t) => ({
    ...t,
    clase: claseDeCriterio[t.criterio] || CLASES_SOLAPE.DISTINCT_PUBLICATION,
    fuerza: FUERZA_CRITERIO[t.criterio] || null
  }));

  const fundidas = solape.filter(
    (s) =>
      s.clase === CLASES_SOLAPE.EXACT_DUPLICATE ||
      s.clase === CLASES_SOLAPE.PROBABLE_DUPLICATE
  );

  /*
    -----------------------------------------------------------
    PIEZAS CANONICAS

    Cada una conserva TODAS sus procedencias. Una nota vista por
    RSS y por el analisis de una pieza es una pieza con dos
    rutas, no dos piezas.
    -----------------------------------------------------------
  */
  const piezas = dedup.unicas.map((u) => {
    const origen = u._origen || {};

    const rutas = [
      ...new Set(
        (u.providersSeenBy || []).concat(origen.procedencia ? [origen.procedencia] : [])
      )
    ];

    return {
      clave: u.urlNormalizada || u.canonicalUrl,
      canonicalUrl: u.canonicalUrl,
      urlOriginal: u.url,

      titulo: u.title || null,
      autor: u.author || null,

      dominio: u.sourceId || null,
      nombreEmisor: u.publisher || origen.nombreEmisor || null,
      emisor: origen.emisor || null,
      claseEmisor: origen.claseEmisor || null,
      grupoFuente: origen.grupoFuente || null,
      plataforma: origen.plataforma || null,

      /* El tiempo no se toca: `mediaTime` ya lo resolvio aguas arriba. */
      publishedAt: u.publishedAt || null,
      publishedAtBruto: origen.publishedAtBruto ?? null,
      fechaProvenance: origen.fechaProvenance || null,
      fechaPublicacionEstado: origen.fechaPublicacionEstado ?? null,

      observedAt: u.lastObservedAt || origen.observedAt || null,
      firstObservedAt: u.firstObservedAt || null,

      evidenceId: u.evidenceId,

      /* Multiprocedencia preservada, con su detalle. */
      procedencias: rutas,
      observacionesPorRuta: u.sourceObservations || [],
      duplicadosAbsorbidos: u.duplicadosAbsorbidos || 0,

      /*
        Republicaciones enlazadas: se conservan como piezas
        distintas Y se sabe que estan relacionadas.
        `sindicadaCon` lo produce `crossProviderDedup`.
        `origen` es el rol dentro del corpus antiguo.
      */
      republicadaCon: u.sindicadaCon || [],

      origen: origen.procedencia || PROCEDENCIAS.ANALISIS,
      rol: origen.rol || null,
      piezaOrigen: origen.piezaOrigen || null,
      assetId: origen.assetId || null,

      /*
        -----------------------------------------------------
        ATRIBUCION A UNA ENTIDAD MEDIA

        Se deja en null cuando el activo que la publico esta en
        conflicto de identidad. La pieza es REAL —la cuenta
        `@tomebamba` publico ese post, eso no esta en duda— y lo
        que esta en duda es de QUE cabecera es esa cuenta.

        Conservarla sin atribuir es la unica lectura honesta:
        borrarla perderia evidencia observada, y atribuirla
        sumaria a una de las dos entidades algo que quiza sea de
        la otra.
        -----------------------------------------------------
      */
      mediaEntityId: atribucionBloqueada(origen, activosEnConflicto)
        ? null
        : origen.mediaEntityId || null,

      atribucionEnConflicto: atribucionBloqueada(origen, activosEnConflicto),

      entidadesEnDisputa: atribucionBloqueada(origen, activosEnConflicto)
        ? entidadesQueReclaman(origen, universo)
        : null
    };
  });

  const conFecha = piezas.filter((p) => p.publishedAt).length;

  const porProcedencia = new Map();

  piezas.forEach((p) =>
    p.procedencias.forEach((r) => porProcedencia.set(r, (porProcedencia.get(r) || 0) + 1))
  );

  return {
    ok: true,
    version: VERSION_CORPUS_CANONICO,

    projectId,
    tenantId: corpus.tenantId,

    piezas,

    /*
      Los dos planos de origen se conservan para que la HOME
      pueda seguir contando «analizadas» frente a «relacionadas»
      sin volver a leer nada.
    */
    analizadas: piezas.filter((p) => p.origen === PROCEDENCIAS.ANALISIS),
    relacionadas: piezas.filter((p) => p.origen === PROCEDENCIAS.AMPLIFICACION),
    medidas: piezas.filter((p) => p.origen === PROCEDENCIAS.MEDIA_MEASUREMENT),

    reconciliacion: {
      entradas: entradas.length,

      excluidas: excluidas.length,
      admitidas: admitidas.length,

      canonicas: piezas.length,

      exactDuplicates: solape.filter((s) => s.clase === CLASES_SOLAPE.EXACT_DUPLICATE).length,
      probableDuplicates: solape.filter((s) => s.clase === CLASES_SOLAPE.PROBABLE_DUPLICATE).length,
      republications: solape.filter((s) => s.clase === CLASES_SOLAPE.REPUBLICATION).length,

      distinctPublications: piezas.filter((p) => p.duplicadosAbsorbidos === 0).length,

      fundidas: fundidas.length,

      detalle: solape,

      porMotivoDeExclusion: [...new Set(excluidas.map((e) => e.motivo))].map((motivo) => ({
        motivo,
        piezas: excluidas.filter((e) => e.motivo === motivo).length
      })),

      exclusiones: excluidas,

      declaraciones: dedup.declaraciones,

      explicacion: EXPLICACION_SOLAPE
    },

    fechas: {
      total: piezas.length,
      conFechaUtilizable: conFecha,
      sinFecha: piezas.length - conFecha,

      declaracion:
        "Las ventanas se calculan con publishedAt. Una pieza sin fecha se conserva como evidencia y NO entra en ninguna ventana: observedAt nunca la sustituye."
    },

    procedencias: [...porProcedencia.entries()]
      .map(([ruta, n]) => ({ ruta, piezas: n }))
      .sort((a, b) => b.piezas - a.piezas),

    aislamiento: corpus.aislamiento,

    /* Se conserva para que la HOME no tenga que releerlo. */
    corpusDePiezas: corpus,

    universo: universo?.ok ? { entidades: universo.entidades.length } : null,

    activosEnConflicto: [...activosEnConflicto]
  };
}


/*
  Una pieza tiene la atribucion bloqueada cuando el activo que la
  publico esta en conflicto. Se comprueba por `assetId` y, para
  las piezas del corpus antiguo que no lo traen, por el handle
  del emisor sobre su plataforma.
*/
function atribucionBloqueada(origen, activosEnConflicto) {
  if (!activosEnConflicto?.size) return false;

  if (origen.assetId && activosEnConflicto.has(origen.assetId)) return true;

  const handle = origen.emisor?.handle;

  if (handle && origen.plataforma) {
    return activosEnConflicto.has(`${origen.plataforma}:${String(handle).toLowerCase()}`);
  }

  return false;
}


function entidadesQueReclaman(origen, universo) {
  if (!universo?.ok) return null;

  const handle = origen.emisor?.handle;

  const assetId =
    origen.assetId ||
    (handle && origen.plataforma
      ? `${origen.plataforma}:${String(handle).toLowerCase()}`
      : null);

  if (!assetId) return null;

  return universo.entidades
    .filter((e) => (e.activos || []).some((a) => a.assetId === assetId))
    .map((e) => ({ mediaEntityId: e.mediaEntityId, nombre: e.canonicalName }));
}


function dominioDePublicacion(p) {
  const url = p.canonicalUrl || p.clave || "";

  const sinEsquema = String(url).replace(/^https?:\/\//i, "").replace(/^www\./, "");

  return sinEsquema.split(/[/?#]/)[0] || null;
}


export default {
  VERSION_CORPUS_CANONICO,
  CLASES_SOLAPE,
  EXPLICACION_SOLAPE,
  PROCEDENCIAS,
  MOTIVOS_EXCLUSION,
  corpusCanonicoDeProyecto
};
