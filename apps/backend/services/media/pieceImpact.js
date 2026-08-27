// apps/backend/services/media/pieceImpact.js

import {
  DIMENSIONES_OBSERVADAS,
  NIVELES_RENDIMIENTO,
  UMBRALES_RATIO,
  MINIMO_BASELINE,
  EQUIVALENCIAS_PROHIBIDAS,
  DISPONIBILIDAD,
  ESTADOS_HISTORICO
} from "./pieceContracts.js";

/*
===========================================================
IMPACTO DIGITAL OBSERVADO — MEDIA-PIECE-01 §12 §13 §14
===========================================================

NO hay score. Hay siete dimensiones, cada una con su cifra, su
denominador y sus evidencias.

POR QUE NO UN NUMERO UNICO
-----------------------------------------------------------

Un "impacto: 87/100" obliga a ponderar cosas que no comparten
unidad: vistas, dominios, comentarios y horas. La ponderacion
seria arbitraria y quedaria oculta dentro del numero. Peor: un
solo numero invita exactamente a la frase que §13 prohibe
("esta noticia impacto a...").

Siete cifras separadas son mas incomodas y mucho mas honestas.

EL INDICADOR SI EXISTE, PERO ES RELATIVO
-----------------------------------------------------------

§14 admite BAJO/MEDIO/ALTO/EXCEPCIONAL, y esa clasificacion es
util, pero SOLO contra un baseline. Un millon de vistas es
excepcional para una cuenta cuya mediana es 80.000 y normal
para una cuya mediana es 2.000.000. El umbral es un RATIO, no
un absoluto, y sin baseline el veredicto es
SIN_BASELINE_COMPARABLE.

De donde sale el baseline hoy: de otras publicaciones de la
MISMA cuenta, medidas con el mismo metodo. Con menos de
`MINIMO_BASELINE` piezas comparables, una mediana no significa
nada y no se emite.
===========================================================
*/


function valor(metricas, id) {
  const m = (metricas || []).find((x) => x.id === id);

  return m && m.availability === DISPONIBILIDAD.DISPONIBLE ? m.value ?? null : null;
}


function estadoDe(metricas, id) {
  const m = (metricas || []).find((x) => x.id === id);

  return m
    ? { availability: m.availability, motivo: m.motivo, evidenceId: m.evidenceId }
    : { availability: DISPONIBILIDAD.NO_DISPONIBLE, motivo: "metrica ausente" };
}


/*
===========================================================
BASELINE Y CLASIFICACION — §14
===========================================================

`comparables` son valores de la misma metrica en otras piezas
de la misma cuenta. Se pasa desde fuera: este fichero no sabe
como obtenerlos, y hoy solo YouTube permitiria hacerlo (via
`listarSubidas` + `resolverVideos`), lo cual cuesta cuota y no
se hace en este gate sin autorizacion explicita.
===========================================================
*/
export function clasificarRendimiento({ valorPieza, comparables = [], metrica = "views" }) {
  if (valorPieza == null) {
    return {
      nivel: NIVELES_RENDIMIENTO.SIN_BASELINE,
      ratio: null,
      mediana: null,
      muestra: 0,
      metodologia: null,

      motivo: `No hay valor de ${metrica} para la pieza: no se puede clasificar nada.`
    };
  }

  const limpios = (comparables || [])
    .filter((v) => typeof v === "number" && Number.isFinite(v) && v >= 0);

  if (limpios.length < MINIMO_BASELINE) {
    return {
      nivel: NIVELES_RENDIMIENTO.SIN_BASELINE,
      ratio: null,
      mediana: null,
      muestra: limpios.length,
      metodologia: null,

      motivo: `Se necesitan al menos ${MINIMO_BASELINE} publicaciones comparables de la misma cuenta para que una mediana signifique algo; hay ${limpios.length}. Sin baseline no se emite veredicto: un numero absoluto no dice si es mucho o poco.`
    };
  }

  const orden = [...limpios].sort((a, b) => a - b);

  const mitad = Math.floor(orden.length / 2);

  const mediana =
    orden.length % 2
      ? orden[mitad]
      : (orden[mitad - 1] + orden[mitad]) / 2;

  if (mediana <= 0) {
    return {
      nivel: NIVELES_RENDIMIENTO.SIN_BASELINE,
      ratio: null,
      mediana,
      muestra: orden.length,
      metodologia: null,
      motivo:
        "La mediana de las publicaciones comparables es 0: no hay base contra la que dividir."
    };
  }

  const ratio = Number((valorPieza / mediana).toFixed(2));

  const nivel =
    ratio < UMBRALES_RATIO.BAJO
      ? NIVELES_RENDIMIENTO.BAJO
      : ratio < UMBRALES_RATIO.MEDIO
        ? NIVELES_RENDIMIENTO.MEDIO
        : ratio < UMBRALES_RATIO.ALTO
          ? NIVELES_RENDIMIENTO.ALTO
          : NIVELES_RENDIMIENTO.EXCEPCIONAL;

  return {
    nivel,
    ratio,
    mediana,
    muestra: orden.length,

    metodologia: {
      metrica,
      baseline: "mediana de la misma metrica en otras publicaciones de la misma cuenta",
      muestra: orden.length,
      minimoExigido: MINIMO_BASELINE,
      umbrales: UMBRALES_RATIO,
      calculo: `${valorPieza} / ${mediana} = ${ratio}x`,

      cautela:
        "El ratio compara la pieza con su propia cuenta, no con el universo de la plataforma. Un ratio alto indica rendimiento inusual PARA ESA CUENTA; no indica influencia ni persuasion."
    },

    motivo: null
  };
}


/*
===========================================================
RESUMEN DE IMPACTO OBSERVADO
===========================================================
*/
export function impactoObservado(entrada = {}) {
  const {
    pieza = null,
    metricas = [],
    amplificacion = null,
    territorio = null,
    serie = null,
    persistencia = null,
    baseline = null,
    evidencias = []
  } = entrada;

  const views = valor(metricas, "views");

  const likes = valor(metricas, "likes");

  const comments = valor(metricas, "comments");

  const shares = valor(metricas, "shares");

  /* --- A. CONSUMO --- */
  const consumo = {
    rotulo: DIMENSIONES_OBSERVADAS.CONSUMO,

    views,
    viewsEstado: estadoDe(metricas, "views"),

    declaracion:
      views == null
        ? "No hay cifra de visualizaciones legible para esta pieza."
        : "Reproducciones contabilizadas por la plataforma. NO son personas unicas: una persona puede reproducir varias veces.",

    noEs: "NO es personas alcanzadas"
  };

  /* --- B. INTERACCION --- */
  const interaccion = {
    rotulo: DIMENSIONES_OBSERVADAS.INTERACCION,

    likes,
    likesEstado: estadoDe(metricas, "likes"),

    comments,
    commentsEstado: estadoDe(metricas, "comments"),

    shares,
    sharesEstado: estadoDe(metricas, "shares"),

    /* Tasa solo si hay numerador y denominador reales. */
    tasaSobreViews:
      views != null && views > 0 && (likes != null || comments != null)
        ? Number((((likes || 0) + (comments || 0)) / views).toFixed(5))
        : null,

    declaracion:
      "Interacciones publicas contabilizadas por la plataforma. Una interaccion NO es apoyo: un comentario puede ser critico.",

    noEs: "NO es apoyo al candidato"
  };

  /* --- C. AMPLIFICACION --- */
  const amp = {
    rotulo: DIMENSIONES_OBSERVADAS.AMPLIFICACION,

    piezas: amplificacion?.conteo?.piezas ?? null,
    fuentes: amplificacion?.conteo?.fuentes ?? null,
    contenidos: amplificacion?.conteo?.contenidos ?? null,

    medios: amplificacion?.medios ?? null,
    creadores: amplificacion?.creadores ?? null,
    periodistas: amplificacion?.periodistas ?? null,

    porRol: amplificacion?.porRol || null,

    lectura: amplificacion?.conteo?.lectura || null,

    declaracion:
      amplificacion?.conteo?.advertencia ||
      "Sin datos de amplificacion en este analisis.",

    noEs: "NO son noticias independientes"
  };

  /* --- D. CONVERSACION --- */
  const conversacion = {
    rotulo: DIMENSIONES_OBSERVADAS.CONVERSACION,

    /*
      Lo unico observable hoy: el RECUENTO de comentarios que da
      la plataforma y las piezas derivadas. El TEXTO de los
      comentarios no se lee: ninguna API lo entrega para
      terceros y raspar la pagina no esta autorizado.
    */
    comentariosObservables: comments,
    comentariosEstado: estadoDe(metricas, "comments"),

    piezasDerivadas:
      amplificacion?.porRol
        ? (amplificacion.porRol.CITA || 0) + (amplificacion.porRol.REPLICA || 0)
        : null,

    menciones: amplificacion?.conteo?.piezas != null
      ? amplificacion.conteo.piezas - 1
      : null,

    textoDeComentarios: null,

    motivoSinTexto:
      "El contenido de los comentarios no se recupera: no hay via oficial para leerlos en cuentas de terceros y no se raspa la pagina.",

    declaracion:
      "Conversacion OBSERVABLE: lo que las plataformas publican como recuento y las piezas que responden o replican.",

    noEs: "NO es opinion publica total"
  };

  /* --- E. PERSISTENCIA --- */
  const pers = {
    rotulo: DIMENSIONES_OBSERVADAS.PERSISTENCIA,

    horasDesdePublicacion: persistencia?.horasDesdePublicacion ?? null,
    observaciones: persistencia?.observaciones ?? 0,

    estadoHistorico: serie?.estado || ESTADOS_HISTORICO.HISTORICO_INSUFICIENTE,
    crecimiento: serie?.crecimiento || null,
    ventanaHoras: serie?.ventanaHoras ?? null,

    declaracion:
      serie?.declaracion ||
      "Una sola observacion: el crecimiento se podra medir al volver a analizar la pieza."
  };

  /* --- F. DIVERSIDAD --- */
  const diversidad = {
    rotulo: DIMENSIONES_OBSERVADAS.DIVERSIDAD,

    emisoresDistintos: amplificacion?.conteo?.fuentes ?? null,

    /*
      Emisores independientes = dominios distintos. Dos cuentas
      del mismo dominio no son dos emisores independientes.
    */
    base: "dominios distintos, no piezas",

    declaracion:
      amplificacion?.conteo?.fuentes != null
        ? `${amplificacion.conteo.fuentes} emisores distintos publicaron sobre el asunto. La diversidad se mide en dominios, no en numero de piezas.`
        : "Sin datos de diversidad en este analisis."
  };

  /* --- G. TERRITORIO --- */
  const terr = {
    rotulo: DIMENSIONES_OBSERVADAS.TERRITORIO,

    tieneEvidencia: territorio?.tieneEvidenciaTerritorial === true,
    unidadId: territorio?.unidadId || null,
    unidad: territorio?.unidad || null,
    resolucion: territorio?.resolucion || null,
    procedencia: territorio?.procedencia || null,
    vias: territorio?.vias || [],

    declaracion:
      territorio?.tieneEvidenciaTerritorial
        ? "Existe evidencia territorial observada para esta pieza."
        : territorio?.motivo || "Sin evidencia territorial suficiente.",

    noEs: "NO es poblacion alcanzada en el territorio"
  };

  /* --- H. TRAZABILIDAD --- */
  const traza = {
    rotulo: "TRAZABILIDAD",
    evidencias: evidencias.length,
    canonicalUrl: pieza?.canonicalUrl || null,

    declaracion:
      "Cada cifra de este resumen cita la evidencia de la que salio. Una cifra sin evidencia no se muestra."
  };

  return {
    dimensiones: {
      consumo,
      interaccion,
      amplificacion: amp,
      conversacion,
      persistencia: pers,
      diversidad,
      territorio: terr,
      trazabilidad: traza
    },

    /* §14: veredicto solo con baseline. */
    rendimiento: baseline || {
      nivel: NIVELES_RENDIMIENTO.SIN_BASELINE,
      ratio: null,
      mediana: null,
      muestra: 0,
      metodologia: null,

      motivo:
        "No se calculo baseline en este analisis. Obtener la mediana de la cuenta exige leer sus publicaciones anteriores, lo que consume cuota y requiere autorizacion explicita del analista."
    },

    /*
      Se devuelve para que la UI pueda mostrarlo junto a las
      cifras: la cautela al lado del dato, no en una pagina de
      terminos y condiciones.
    */
    equivalenciasProhibidas: [...EQUIVALENCIAS_PROHIBIDAS],

    sinScore:
      "No se emite un score unico de impacto. Las dimensiones no comparten unidad y ponderarlas ocultaria la ponderacion dentro del numero."
  };
}


export default {
  clasificarRendimiento,
  impactoObservado
};
