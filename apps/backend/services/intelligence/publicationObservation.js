// apps/backend/services/intelligence/publicationObservation.js

/*
===========================================================
PUBLICACION OBSERVADA Y METRICAS COMO SNAPSHOTS — P-CAND-02
===========================================================

LA REGLA

    100k visualizaciones ayer
    150k visualizaciones hoy

no es un campo que pasa de 100k a 150k. Son DOS OBSERVACIONES, y
las dos se guardan.

Sustituir la primera por la segunda destruye lo unico que hacia
falta para saber que la publicacion creció: el punto anterior.
Y sin dos puntos no hay velocidad, no hay tendencia y no hay
manera de distinguir una publicacion que arranco fuerte de una
que sigue subiendo.

    `metricas` es una SERIE, no un valor.

CADA METRICA SABE DE DONDE SALE
-----------------------------------------------------------

    value          lo que dijo la fuente
    observedAt     cuando lo dijo
    provider       quien lo dijo
    source         de donde salio
    availability   si estaba disponible

`null` no es cero. Cero visualizaciones es un dato —significa
que nadie la vio— y no saberlo es otra cosa. Una metrica ausente
se declara `NO_DISPONIBLE` con su motivo, y no se infiere de
ninguna otra.

`firstObservedAt` NO SE REESCRIBE
-----------------------------------------------------------

Es la respuesta a «cuando vio Sentinel esta publicacion por
primera vez». Reescribirla al reobservar la borraria, y ademas
mentiria: diria que la vimos hoy cuando la vimos hace un mes.

`publishedAt` es cuando la publico su autor y es otra cosa. Las
dos se guardan por separado, siempre.
===========================================================
*/


export const DISPONIBILIDAD = Object.freeze({
  /* La fuente entrego el valor. */
  DISPONIBLE: "DISPONIBLE",

  /* La fuente respondio y no lo incluye. */
  NO_DISPONIBLE: "NO_DISPONIBLE",

  /*
    La plataforma lo oculta por decision del titular. Es
    distinto de que no lo tengamos: el dato existe y esta
    deliberadamente cerrado.
  */
  OCULTO_POR_LA_CUENTA: "OCULTO_POR_LA_CUENTA",

  /* Haria falta una credencial o un permiso que no tenemos. */
  REQUIERE_CREDENCIAL: "REQUIERE_CREDENCIAL",

  /* No se pidio. */
  NO_CONSULTADO: "NO_CONSULTADO"
});


/*
  Metricas publicas contempladas. Estar en la lista NO significa
  que se obtengan: significa que si una fuente las entrega, hay
  sitio donde ponerlas sin inventar un campo.
*/
export const METRICAS_PUBLICAS = Object.freeze([
  { id: "views", nombre: "Visualizaciones", unidad: "visualizaciones" },
  { id: "likes", nombre: "Me gusta", unidad: "reacciones" },
  { id: "comments", nombre: "Comentarios", unidad: "comentarios" },
  { id: "shares", nombre: "Compartidos", unidad: "compartidos" },
  { id: "reposts", nombre: "Republicaciones", unidad: "republicaciones" },
  { id: "followers", nombre: "Seguidores", unidad: "cuentas" },
  { id: "subscribers", nombre: "Suscriptores", unidad: "cuentas" }
]);


const POR_ID = new Map(METRICAS_PUBLICAS.map((m) => [m.id, m]));


/*
===========================================================
UN SNAPSHOT DE METRICA
===========================================================
*/
export function crearSnapshotDeMetrica(entrada = {}) {
  const def = POR_ID.get(entrada.metrica) || null;

  const tieneValor = entrada.value != null;

  return {
    metrica: entrada.metrica || null,
    nombre: def?.nombre || entrada.metrica || null,
    unidad: def?.unidad || null,

    /*
      El valor tal como lo dijo la fuente. Sin redondear, sin
      escalar y sin rellenar.
    */
    value: tieneValor ? entrada.value : null,

    observedAt: entrada.observedAt || new Date().toISOString(),

    provider: entrada.provider || null,
    source: entrada.source || null,

    availability: tieneValor
      ? DISPONIBILIDAD.DISPONIBLE
      : entrada.availability || DISPONIBILIDAD.NO_DISPONIBLE,

    motivo: tieneValor ? null : entrada.motivo || null,

    /* Dicho en el propio registro, donde no se puede ignorar. */
    nota: tieneValor
      ? null
      : "Valor no disponible. `null` no es cero: cero seria un dato, y esto es la ausencia de un dato."
  };
}


/*
===========================================================
UNA PUBLICACION OBSERVADA
===========================================================
*/
export function crearPublicacionObservada(entrada = {}) {
  const ahora = entrada.firstObservedAt || entrada.observedAt || new Date().toISOString();

  const canonicalUrl = entrada.canonicalUrl || entrada.url || null;

  return {
    publicationId:
      entrada.publicationId ||
      (canonicalUrl ? `pub-${huella(canonicalUrl)}` : null),

    candidateId: entrada.candidateId || null,
    accountId: entrada.accountId || null,
    projectId: entrada.projectId || null,
    platformId: entrada.platformId || null,

    /*
      La direccion canonica de la publicacion. Es la que hace
      verificable todo lo demas: sin ella no hay «Ver
      evidencia».
    */
    canonicalUrl,
    url: entrada.url || canonicalUrl,

    /* DOS FECHAS DISTINTAS, SIEMPRE SEPARADAS. */
    publishedAt: entrada.publishedAt || null,
    firstObservedAt: ahora,
    lastObservedAt: entrada.lastObservedAt || ahora,

    observationCount: entrada.observationCount || 1,

    /*
      Texto y titulo solo cuando la fuente permite conservarlos.
      La politica la decide quien normaliza la evidencia, no
      este modulo.
    */
    title: entrada.title ?? null,
    text: entrada.text ?? null,
    politicaAlmacenamiento: entrada.politicaAlmacenamiento || null,

    /*
      LA SERIE. Cada observacion se anade; ninguna sustituye a
      otra.
    */
    metricas: entrada.metricas || [],

    metricsObservedAt: entrada.metricsObservedAt || null,

    provider: entrada.provider || null,

    provenance: {
      observationMethod: entrada.observationMethod || null,
      providerId: entrada.provider || null,
      declaradaPorAnalista: entrada.declaradaPorAnalista === true
    },

    /* Enlace al corpus de evidencias. */
    evidenceId: entrada.evidenceId || null,
    evidenceIds: entrada.evidenceIds || (entrada.evidenceId ? [entrada.evidenceId] : [])
  };
}


function huella(texto) {
  const s = String(texto || "");

  let h = 0;

  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }

  return Math.abs(h).toString(36);
}


/*
===========================================================
REOBSERVAR UNA PUBLICACION

Aqui esta la regla del modulo. Se ANADE al historial de
metricas; no se sustituye nada.
===========================================================
*/
export function fusionarPublicacion(previa, nueva) {
  if (!previa) return { ...nueva, observationCount: 1 };

  const metricas = [...(previa.metricas || [])];

  const anadidas = [];

  (nueva?.metricas || []).forEach((m) => {
    /*
      Un snapshot identico —misma metrica, mismo valor, mismo
      instante— no se duplica: es el mismo hecho leido dos
      veces. Un valor distinto en otro instante SI entra, aunque
      sea del mismo dia.
    */
    const repetido = metricas.some(
      (x) =>
        x.metrica === m.metrica &&
        x.observedAt === m.observedAt &&
        x.value === m.value
    );

    if (repetido) return;

    metricas.push(m);

    anadidas.push(m.metrica);
  });

  return {
    ...previa,
    ...nueva,

    /* INMUTABLES. */
    publicationId: previa.publicationId,
    firstObservedAt: previa.firstObservedAt,
    publishedAt: previa.publishedAt || nueva?.publishedAt || null,

    lastObservedAt:
      nueva?.lastObservedAt || nueva?.firstObservedAt || previa.lastObservedAt,

    observationCount: (previa.observationCount || 1) + 1,

    /* LA SERIE COMPLETA, ordenada. */
    metricas: metricas.sort((a, b) =>
      String(a.observedAt || "").localeCompare(String(b.observedAt || ""))
    ),

    evidenceIds: [
      ...new Set([...(previa.evidenceIds || []), ...(nueva?.evidenceIds || [])])
    ],

    metricasAnadidas: anadidas
  };
}


/*
===========================================================
SERIE DE UNA METRICA

Lo que consume cualquier calculo temporal. Devuelve solo lo
REALMENTE observado: los huecos se cuentan aparte y no se
interpolan.
===========================================================
*/
export function serieDeMetrica(publicacion, metrica) {
  const todas = (publicacion?.metricas || []).filter(
    (m) => m.metrica === metrica
  );

  const disponibles = todas.filter(
    (m) => m.availability === DISPONIBILIDAD.DISPONIBLE && m.value != null
  );

  const ordenada = disponibles.sort((a, b) =>
    String(a.observedAt || "").localeCompare(String(b.observedAt || ""))
  );

  const ausentes = todas.length - disponibles.length;

  if (ordenada.length < 2) {
    return {
      metrica,
      puntos: ordenada,
      observaciones: ordenada.length,
      ausentes,
      comparable: false,
      delta: null,
      velocidad: null,
      motivo:
        ordenada.length === 0
          ? "No hay ninguna observacion disponible de esta metrica."
          : "Una sola observacion: no hay con que comparar. Una velocidad de un punto seria una invencion."
    };
  }

  const a = ordenada[0];

  const b = ordenada[ordenada.length - 1];

  const horas =
    (new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()) /
    3600000;

  return {
    metrica,
    puntos: ordenada,
    observaciones: ordenada.length,
    ausentes,
    comparable: true,

    delta: b.value - a.value,

    /*
      Velocidad por hora. Se calcula solo si el intervalo es
      positivo: dividir por cero produciria Infinity, que en un
      panel se lee como un numero.
    */
    velocidad: horas > 0 ? Number(((b.value - a.value) / horas).toFixed(4)) : null,

    ventana: {
      desde: a.observedAt,
      hasta: b.observedAt,
      horas: Number(horas.toFixed(2))
    },

    motivo: null
  };
}


/*
  Estado honesto de un conjunto de publicaciones: cuantas hay,
  cuantas tienen metricas y cuales no y por que.
*/
export function resumenDePublicaciones(publicaciones = []) {
  const lista = publicaciones || [];

  const conMetricas = lista.filter((p) =>
    (p.metricas || []).some(
      (m) => m.availability === DISPONIBILIDAD.DISPONIBLE && m.value != null
    )
  );

  const porDisponibilidad = {};

  lista.forEach((p) =>
    (p.metricas || []).forEach((m) => {
      porDisponibilidad[m.availability] =
        (porDisponibilidad[m.availability] || 0) + 1;
    })
  );

  return {
    publicaciones: lista.length,
    conMetricasDisponibles: conMetricas.length,
    sinMetricas: lista.length - conMetricas.length,

    snapshotsPorDisponibilidad: porDisponibilidad,

    totalSnapshots: lista.reduce((s, p) => s + (p.metricas || []).length, 0),

    reobservadas: lista.filter((p) => (p.observationCount || 1) > 1).length,

    nota: lista.length
      ? "Las metricas son snapshots: cada observacion se conserva. `firstObservedAt` no se reescribe."
      : "No hay ninguna publicacion observada. La lista vacia NO significa que el candidato no publique: significa que ninguna fuente disponible entrega sus publicaciones."
  };
}


export default {
  DISPONIBILIDAD,
  METRICAS_PUBLICAS,
  crearSnapshotDeMetrica,
  crearPublicacionObservada,
  fusionarPublicacion,
  serieDeMetrica,
  resumenDePublicaciones
};
