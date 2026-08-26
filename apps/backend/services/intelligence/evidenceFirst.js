// apps/backend/services/intelligence/evidenceFirst.js

/*
===========================================================
EVIDENCE-FIRST — P-CAND-02
===========================================================

Ninguna afirmacion analitica fuerte sin camino hasta la
evidencia primaria.

    insight → metric → evidenceId → source → observedAt
            → canonicalUrl

La cadena no es decorativa: es la condicion para que la
afirmacion exista. `crearAfirmacion` RECHAZA lo que no la
cumpla, en lugar de publicarla con un hueco. Un panel que
muestra «rendimiento excepcional» sin enlace a la publicacion
original le pide al analista que se fie, y fiarse no es
verificar.

    RENDIMIENTO EXCEPCIONAL
    1.284.531 visualizaciones
    TikTok · observado 2026-09-02 14:10
    provider: <el que fuera>
    canonicalUrl: <la publicacion original>
    [Ver evidencia]

Cada linea de ese bloque es un campo obligatorio de este
contrato. Si falta una, no hay bloque.

LO QUE ESTE MODULO NO HACE
-----------------------------------------------------------

NO existe una etiqueta «viral». No hay umbral defendible: la
misma cifra es enorme para un candidato local y ordinaria para
una cuenta nacional, y el numero por si solo no distingue una
publicacion que funciono de una que se promociono con dinero.

Las cuatro metricas de rendimiento se DECLARAN con su
metodologia y sus requisitos, y quedan `disponible: false`
mientras no existan los datos que las sostienen. Declarar el
hueco es lo que impide que alguien lo rellene con una
conjetura.

NO SE REUTILIZA NI SE DUPLICA
-----------------------------------------------------------

`evidenceId` y `canonicalUrl` los produce el normalizador de
evidencias que corresponda —hoy `ingest/evidenceContract.js` en
la linea de ingesta, o el corpus del propio candidato—. Este
modulo NO normaliza evidencias: las EXIGE y las referencia.
===========================================================
*/


/*
-----------------------------------------------------------
CAMPOS OBLIGATORIOS DE UNA AFIRMACION

Los cinco. Sin ellos la afirmacion no se construye.
-----------------------------------------------------------
*/
export const CAMPOS_OBLIGATORIOS = Object.freeze([
  "insight",
  "evidenceIds",
  "observedAt",
  "canonicalUrl",
  "source"
]);


export const ESTADOS_AFIRMACION = Object.freeze({
  /* Tiene metrica, evidencia y enlace verificable. */
  SOSTENIDA: "SOSTENIDA",

  /*
    Falta algo de la cadena. NO se publica como afirmacion: se
    devuelve con lo que falta enumerado.
  */
  NO_SOSTENIDA: "NO_SOSTENIDA"
});


/*
===========================================================
LOS CUATRO TIPOS DE METRICA DE RENDIMIENTO

Cada uno declara que necesita. Ninguno se calcula hoy, y por
eso ninguno esta disponible: la diferencia entre «no lo
sabemos» y «es cero» es todo el asunto.
===========================================================
*/
export const TIPOS_METRICA = Object.freeze({
  absolutePerformance: {
    id: "absolutePerformance",
    nombre: "Rendimiento absoluto",
    definicion:
      "La cifra publica que la plataforma entrega para una publicacion concreta: visualizaciones, likes, comentarios.",
    metodologia:
      "Se toma el valor tal como lo devuelve el proveedor, con su instante de observacion. No se agrega entre plataformas: una vista de TikTok y una reaccion de Facebook no son la misma unidad.",
    requisitos: [
      "un proveedor que entregue metricas por publicacion",
      "canonicalUrl de la publicacion",
      "instante de observacion"
    ],
    disponible: false,
    motivoNoDisponible:
      "ninguna plataforma social entrega metricas por publicacion con la infraestructura actual"
  },

  relativePerformance: {
    id: "relativePerformance",
    nombre: "Rendimiento relativo",
    definicion:
      "Como se comporta una publicacion respecto a la linea base de LA MISMA cuenta.",
    metodologia:
      "Valor de la publicacion dividido por la mediana de las publicaciones observadas de la misma cuenta en una ventana declarada. La comparacion es interna a la cuenta: comparar contra otra cuenta mediria audiencias distintas y no rendimiento.",
    requisitos: [
      "una serie de publicaciones observadas de la misma cuenta",
      "un minimo de publicaciones para que la mediana signifique algo",
      "una ventana temporal declarada"
    ],
    disponible: false,
    motivoNoDisponible:
      "no hay serie de publicaciones observadas: sin linea base no hay nada relativo que calcular"
  },

  velocity: {
    id: "velocity",
    nombre: "Velocidad",
    definicion: "Cuanto cambio una metrica entre dos observaciones.",
    metodologia:
      "Diferencia entre dos snapshots de la misma metrica dividida por el tiempo transcurrido. Exige DOS observaciones reales: con una sola no hay velocidad, hay un punto.",
    requisitos: [
      "dos snapshots de la misma metrica de la misma publicacion",
      "instantes de observacion distintos y fiables"
    ],
    disponible: false,
    motivoNoDisponible:
      "hacen falta dos observaciones de la misma publicacion y todavia no hay ninguna"
  },

  amplification: {
    id: "amplification",
    nombre: "Amplificacion",
    definicion:
      "Cuanta presencia ganada acompana a una publicacion propia: hechos distintos de terceros, no copias.",
    metodologia:
      "Hechos distintos de terceros relacionados con la publicacion, deduplicados por casi-duplicado. Se cuentan hechos y fuentes por separado; las replicas no suman.",
    requisitos: [
      "corpus de evidencias de terceros",
      "una relacion establecida entre la pieza de tercero y la publicacion propia"
    ],
    disponible: false,
    motivoNoDisponible:
      "la relacion entre una pieza de tercero y una publicacion propia concreta no se puede establecer sin leer las publicaciones propias"
  }
});


export const ETIQUETAS_PROHIBIDAS = Object.freeze([
  "viral",
  "viralidad",
  "tendencia",
  "explosivo",
  "arrasando",
  "influencer"
]);


/*
===========================================================
UNA AFIRMACION CON EVIDENCIA

Devuelve SIEMPRE un objeto; lo que cambia es si esta sostenida.
Asi la interfaz puede mostrar el hueco en lugar de no mostrar
nada, que es como se pierden los limites.
===========================================================
*/
export function crearAfirmacion(entrada = {}) {
  const faltan = [];

  const insight = entrada.insight || null;

  if (!insight) faltan.push("insight");

  const evidenceIds = Array.isArray(entrada.evidenceIds)
    ? entrada.evidenceIds.filter(Boolean)
    : entrada.evidenceId
      ? [entrada.evidenceId]
      : [];

  if (!evidenceIds.length) faltan.push("evidenceIds");

  if (!entrada.observedAt) faltan.push("observedAt");

  if (!entrada.canonicalUrl) faltan.push("canonicalUrl");

  if (!entrada.source && !entrada.provider) faltan.push("source");

  /*
    Una etiqueta prohibida invalida la afirmacion entera, no
    solo se limpia: si alguien intenta escribir «viral», lo que
    hay que corregir es la afirmacion.
  */
  const etiquetaProhibida = ETIQUETAS_PROHIBIDAS.find((e) =>
    String(insight || "")
      .toLowerCase()
      .includes(e)
  );

  if (etiquetaProhibida) {
    faltan.push(`etiqueta prohibida: "${etiquetaProhibida}"`);
  }

  const metrica = entrada.metric || null;

  const tipo = metrica?.tipo ? TIPOS_METRICA[metrica.tipo] : null;

  return {
    claimId: entrada.claimId || null,

    candidateId: entrada.candidateId || null,
    projectId: entrada.projectId || null,

    insight,

    /* ---- la metrica que la sostiene ---- */
    metric: metrica
      ? {
          tipo: metrica.tipo || null,
          nombre: tipo?.nombre || null,
          value: metrica.value ?? null,
          unidad: metrica.unidad || null,
          platformId: metrica.platformId || null,

          /*
            `null` no es cero. Una metrica que no se obtuvo se
            declara ausente y su afirmacion no se sostiene.
          */
          disponible: metrica.value != null,

          metodologia: tipo?.metodologia || null,
          requisitos: tipo?.requisitos || []
        }
      : null,

    /* ---- la cadena hasta la evidencia primaria ---- */
    evidenceIds,

    canonicalUrl: entrada.canonicalUrl || null,

    source: entrada.source || entrada.provider || null,
    provider: entrada.provider || null,

    observedAt: entrada.observedAt || null,

    provenance: {
      observationMethod: entrada.observationMethod || null,
      providerId: entrada.provider || null,
      declaradaPorAnalista: entrada.declaradaPorAnalista === true
    },

    /* ---- veredicto ---- */
    estado: faltan.length
      ? ESTADOS_AFIRMACION.NO_SOSTENIDA
      : ESTADOS_AFIRMACION.SOSTENIDA,

    sostenida: faltan.length === 0,

    faltan,

    motivo: faltan.length
      ? `La afirmacion no se puede publicar: falta ${faltan.join(", ")}. Una afirmacion sin camino hasta la evidencia primaria le pide al analista que se fie.`
      : null,

    /*
      Lo que la interfaz necesita para el boton. Sin
      canonicalUrl no hay boton, y eso es correcto.
    */
    verEvidencia: entrada.canonicalUrl || null
  };
}


/*
  Estado de los cuatro tipos de metrica: que hace falta para que
  cada uno deje de estar no disponible. Es la hoja de ruta.
*/
export function estadoDeMetricas() {
  const tipos = Object.values(TIPOS_METRICA);

  return {
    tipos,

    disponibles: tipos.filter((t) => t.disponible).length,
    total: tipos.length,

    etiquetasProhibidas: ETIQUETAS_PROHIBIDAS,

    nota:
      "Ninguna metrica de rendimiento esta disponible todavia. No existe etiqueta «viral»: no hay umbral defendible, y el mismo numero es enorme para una cuenta local y ordinario para una nacional. Cuando haya datos, cada afirmacion llevara su evidencia primaria enlazada.",

    contrato: CAMPOS_OBLIGATORIOS
  };
}


export default {
  CAMPOS_OBLIGATORIOS,
  ESTADOS_AFIRMACION,
  TIPOS_METRICA,
  ETIQUETAS_PROHIBIDAS,
  crearAfirmacion,
  estadoDeMetricas
};
