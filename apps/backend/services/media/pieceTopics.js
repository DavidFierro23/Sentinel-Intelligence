// apps/backend/services/media/pieceTopics.js

import { extraerTemas2 } from "../conversation/topicEngine2.js";

import { extraerEntidades } from "../conversation/topicEngine2.js";

import { construirStopConcepts } from "../conversation/stopConcepts.js";

/*
===========================================================
TEMAS DE UNA PIEZA Y SU AMPLIFICACION — MEDIA-PIECE-01 §9
===========================================================

NO hay Topic Engine aqui. Se llama al que existe.

LO UNICO QUE ESTE FICHERO APORTA
-----------------------------------------------------------

1. Un ADAPTADOR DE FORMA. El Topic Engine espera evidencias
   con `{titulo, descripcion, fecha, enlace}` —el vocabulario
   del modulo de conversacion— y este gate produce evidencias
   del `evidenceContract` con `{title, snippet, publishedAt,
   url}`. Traducir es una linea; duplicar el motor seria un
   error de 28 KB.

2. Los NOMBRES PROPIOS COMO STOP-CONCEPTS. §9 prohibe que el
   nombre del periodista o del candidato se convierta en tema.
   Sin esto ocurre siempre: el nombre aparece en todas las
   piezas, es el termino mas frecuente, y el motor lo eleva a
   tema. El resultado seria un "tema" llamado como la persona,
   que no dice nada de que se habla.

3. La separacion TEMA / ENTIDAD / EVENTO en la respuesta.

POR QUE UN SOLO DOCUMENTO NO DA TEMAS FIABLES
-----------------------------------------------------------

`extraerTemas2` agrupa por coocurrencia: con una sola pieza no
hay coocurrencia que medir. Por eso los temas se calculan
sobre la pieza MAS su amplificacion, y si el conjunto es
demasiado pequeno se declara en `limitaciones` en lugar de
devolver un tema inventado con confianza alta.
===========================================================
*/


/* Por debajo de esto, un "tema" es ruido con nombre. */
export const MINIMO_PIEZAS_PARA_TEMAS = 3;


/*
-----------------------------------------------------------
ADAPTADOR evidenceContract -> conversation
-----------------------------------------------------------
*/
export function aFormaConversacion(ev) {
  if (!ev) return null;

  return {
    titulo: ev.title || ev.titulo || null,
    descripcion: ev.snippet || ev.descripcion || null,
    fecha: ev.publishedAt || ev.fecha || null,
    enlace: ev.canonicalUrl || ev.url || ev.enlace || null,
    fuente: ev.publisher || ev.sourceId || null,
    plataforma: ev.platform || ev.plataforma || null,
    motorId: ev.providerId || ev.motorId || null,
    contentType: ev.contentType || null,
    evidenceId: ev.evidenceId || null
  };
}


/*
===========================================================
NOMBRES QUE NO PUEDEN SER TEMA

Se pasan al motor como terminos excluidos. `stopConcepts` ya
acepta `extra`, asi que no hay que tocarlo.

Se excluye el nombre completo Y sus componentes de mas de tres
letras: "Fierro" solo tampoco debe ser un tema.
===========================================================
*/
export function nombresExcluidos({ candidato, autor, emisor } = {}) {
  const fuentes = [candidato, autor, emisor].filter(Boolean);

  const terminos = new Set();

  fuentes.forEach((n) => {
    const limpio = String(n).trim();

    if (!limpio) return;

    terminos.add(limpio.toLowerCase());

    limpio
      .split(/\s+/)
      .filter((p) => p.length > 3)
      .forEach((p) => terminos.add(p.toLowerCase()));
  });

  return [...terminos];
}


/*
===========================================================
CALCULAR TEMAS
===========================================================
*/
export function temasDePieza(entrada = {}) {
  const {
    pieza = null,
    piezasAmplificacion = [],
    nombreCandidato = null,
    ambito = null
  } = entrada;

  const corpus = [pieza, ...piezasAmplificacion]
    .filter(Boolean)
    .map(aFormaConversacion)
    .filter((e) => e.titulo || e.descripcion);

  const excluidos = nombresExcluidos({
    candidato: nombreCandidato,
    autor: pieza?.autor,
    emisor: entrada.nombreEmisor
  });

  const limitaciones = [];

  if (corpus.length < MINIMO_PIEZAS_PARA_TEMAS) {
    limitaciones.push(
      `Solo hay ${corpus.length} pieza(s) con texto utilizable. El motor de temas agrupa por coocurrencia de terminos y necesita al menos ${MINIMO_PIEZAS_PARA_TEMAS} para que un tema signifique algo. Se devuelven entidades, no temas.`
    );

    return {
      temas: [],
      entidades: entidadesDe(corpus, excluidos, ambito),
      eventos: [],
      excluidos,
      corpusUsado: corpus.length,
      limitaciones,
      metodo: "sin_temas_corpus_insuficiente"
    };
  }

  let salida = null;

  try {
    salida = extraerTemas2(corpus, {
      ambito,
      terminosExcluidos: excluidos,
      consultas: entrada.consultas || []
    });
  } catch (error) {
    limitaciones.push(
      `El motor de temas fallo: ${error?.message || "error desconocido"}. Se devuelven entidades.`
    );

    return {
      temas: [],
      entidades: entidadesDe(corpus, excluidos, ambito),
      eventos: [],
      excluidos,
      corpusUsado: corpus.length,
      limitaciones,
      metodo: "fallo_del_motor"
    };
  }

  /*
    `indices` apunta a posiciones del corpus que se le paso al
    motor. Se traduce a evidenceIds para que la UI pueda abrir
    la evidencia de cada tema: un tema sin enlaces no es
    auditable.
  */
  const temas = (salida?.temas || []).map((t, i) => {
    const idx = Array.isArray(t.indices) ? t.indices : [];

    const evidenceIds = idx
      .map((n) => corpus[n]?.evidenceId)
      .filter(Boolean);

    const fuentes = new Set(
      idx.map((n) => corpus[n]?.enlace).filter(Boolean).map(dominioDe)
    );

    return {
      topicId: t.temaId || t.id || `tema-${i + 1}`,
      nombre: t.nombre || t.categoria || null,
      categoria: t.categoria || null,
      estado: t.estado || null,

      piezas: t.evidencias ?? idx.length,

      /* Fuentes distintas, no piezas: la diversidad se mide en emisores. */
      fuentes: fuentes.size || null,

      terminos: t.terminos || [],
      titulares: t.titulares || [],

      primeraFecha: t.primeraFecha || null,
      ultimaFecha: t.ultimaFecha || null,

      origen: t.origen || null,
      metodoClasificacion: t.metodoClasificacion || null,
      explicacion: t.explicacion || null,
      confianza: t.confianza ?? null,
      limitaciones: t.limitaciones || [],

      evidenceIds
    };
  });

  if (!temas.length) {
    limitaciones.push(
      "El motor no formo ningun tema: los terminos no coocurren lo suficiente. No se fuerza un tema para llenar el panel."
    );
  }

  return {
    temas,
    entidades: entidadesDe(corpus, excluidos, ambito),

    /*
      EVENTO se declara como dimension separada y VACIA: no hay
      detector de eventos en la plataforma. Declararlo vacio es
      honesto; rellenarlo con temas seria confundir las dos
      cosas que §9 pide separar.
    */
    eventos: [],
    eventosNota:
      "No existe detector de eventos en la plataforma. La dimension se declara para no confundir EVENTO con TEMA, y queda vacia hasta que exista.",

    excluidos,
    corpusUsado: corpus.length,

    /*
      `loQueNoSabemos` es la lista de cautelas que el propio
      Topic Engine emite. Se propaga sin editar: son suyas y ya
      estan aprobadas.
    */
    limitaciones,
    loQueNoSabemos: salida?.loQueNoSabemos || [],
    metricasMotor: salida?.metricas || null,
    metodo: "topicEngine2"
  };
}


function dominioDe(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}


/*
-----------------------------------------------------------
ENTIDADES

Nombres propios detectados, con los excluidos ya fuera. Una
entidad NO es un tema: es un actor o lugar nombrado.
-----------------------------------------------------------
*/
function entidadesDe(corpus, excluidos, ambito) {
  let stop = null;

  try {
    stop = construirStopConcepts({
      ambito,
      consultas: [],
      evidencias: corpus,
      extra: excluidos
    });
  } catch {
    stop = null;
  }

  const cuenta = new Map();

  corpus.forEach((e) => {
    let ents = [];

    try {
      ents = extraerEntidades(e.titulo, stop) || [];
    } catch {
      ents = [];
    }

    ents.forEach((ent) => {
      const k = String(ent).trim();

      if (!k) return;

      if (excluidos.includes(k.toLowerCase())) return;

      if (!cuenta.has(k)) cuenta.set(k, { entidad: k, piezas: 0, evidenceIds: [] });

      const reg = cuenta.get(k);

      reg.piezas += 1;

      if (e.evidenceId) reg.evidenceIds.push(e.evidenceId);
    });
  });

  return [...cuenta.values()]
    .sort((a, b) => b.piezas - a.piezas)
    .slice(0, 25);
}


export default {
  MINIMO_PIEZAS_PARA_TEMAS,
  aFormaConversacion,
  nombresExcluidos,
  temasDePieza
};
