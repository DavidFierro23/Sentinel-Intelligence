// apps/backend/services/intelligence/digitalPresence.js

/*
===========================================================
PRESENCIA DIGITAL OBSERVADA — OBSERVED-PRESENCE-01
===========================================================

Este modulo NO produce un score politico. Produce DIMENSIONES
OBSERVABLES, cada una con su metodologia escrita al lado, y un
indice compuesto que declara NO DISPONIBLE.

-----------------------------------------------------------
POR QUE NO HAY INDICE
-----------------------------------------------------------

Un numero unico por candidato se leeria como un ranking
electoral en el primer minuto, y hoy no hay nada que lo sostenga:

    las metricas de plataformas distintas no son comparables
    seis de siete plataformas no se pueden leer
    la deduplicacion cambia el resultado por factores de diez
    las ventanas temporales no tienen aun historico suficiente

Con cualquiera de esas cuatro cosas sin resolver, el numero
diria mas del estado de nuestras fuentes que del candidato. Y
como parece un dato, nadie lo leeria asi.

-----------------------------------------------------------
LO QUE ESTO NO ES, DICHO ANTES DE QUE NADIE LO SUPONGA
-----------------------------------------------------------

    NO intencion de voto
    NO popularidad
    NO apoyo ciudadano
    NO probabilidad electoral

La presencia digital observada es actividad ENCONTRADA dentro
del universo de fuentes que Sentinel observa. Ese universo no es
una muestra de la poblacion, no es aleatorio y no es
representativo. Es lo que hay.
===========================================================
*/


export const ETIQUETA_UI = "PRESENCIA DIGITAL OBSERVADA";


export const NO_SIGNIFICA = Object.freeze([
  "intencion de voto",
  "popularidad",
  "apoyo ciudadano",
  "probabilidad electoral",
  "influencia electoral"
]);


export const DECLARACION = Object.freeze({
  id: "OBSERVED-PRESENCE-01",

  texto:
    "La presencia digital observada representa actividad encontrada dentro del universo de fuentes observado por Sentinel. No representa intencion de voto, apoyo ciudadano ni poblacion total.",

  universo:
    "El universo de fuentes lo forman los proveedores de busqueda disponibles y las paginas publicas legibles. No es una muestra aleatoria ni representativa de nada."
});


/*
-----------------------------------------------------------
LAS SEIS DIMENSIONES

Cada una lleva:

    valor              numero, o `null` si no es observable hoy
    unidad             en que se mide, para que nadie sume peras
    observable         si HOY hay fuente para calcularla
    metodologia        como se calcula, en una frase
    motivoNoDisponible por que no, cuando no
-----------------------------------------------------------
*/
export const DIMENSIONES = Object.freeze([
  {
    id: "actividad_propia",
    nombre: "Actividad propia",
    unidad: "publicaciones observadas",
    metodologia:
      "Recuento de publicaciones observadas en las cuentas atribuidas dentro de la ventana. Solo publicaciones REALMENTE leidas."
  },
  {
    id: "amplificacion_externa",
    nombre: "Amplificacion externa",
    unidad: "hechos distintos publicados por terceros",
    metodologia:
      "Grupos de casi-duplicados de piezas de terceros. Se cuentan hechos, no copias: diez cabeceras replicando una nota son un hecho."
  },
  {
    id: "cobertura_mediatica",
    nombre: "Cobertura mediatica",
    unidad: "dominios de medios distintos",
    metodologia:
      "Dominios distintos identificados como medios en el catalogo que publicaron alguna pieza. En dominios, no en piezas."
  },
  {
    id: "conversacion_publica",
    nombre: "Conversacion publica observable",
    unidad: "piezas observadas de origen no institucional",
    metodologia:
      "Piezas del plano D de la separacion de conversacion. Se expresa en piezas y NUNCA en personas."
  },
  {
    id: "diversidad_de_fuentes",
    nombre: "Diversidad de fuentes",
    unidad: "dominios distintos sobre piezas totales",
    metodologia:
      "Dominios distintos dividido por piezas totales. Un valor bajo indica concentracion: mucha repeticion de pocas fuentes."
  },
  {
    id: "persistencia_temporal",
    nombre: "Persistencia temporal",
    unidad: "dias con al menos una observacion",
    metodologia:
      "Dias distintos con al menos una pieza o snapshot dentro de la ventana. Mide continuidad, no volumen."
  }
]);


function dia(fecha) {
  const s = String(fecha || "");

  return s.length >= 10 ? s.slice(0, 10) : null;
}


/*
===========================================================
CALCULAR LAS DIMENSIONES
===========================================================

Cada dimension se calcula solo si tiene con que. Sin insumo, el
valor es `null` y el motivo lo explica; nunca 0, porque 0 seria
afirmar que se observo y no habia nada.
===========================================================
*/
export function dimensionesDePresencia(entrada = {}) {
  const {
    actividad = null,
    amplificacion = null,
    conversacion = null,
    snapshots = [],
    evidencias = []
  } = entrada;

  const dominios = new Set(
    (evidencias || [])
      .map((e) => {
        try {
          return new URL(String(e.enlace || e.url)).hostname
            .replace(/^www\./i, "")
            .toLowerCase();
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );

  const dias = new Set(
    [
      ...(evidencias || []).map((e) => dia(e.fecha)),
      ...(snapshots || []).map((s) => dia(s.capturedAt))
    ].filter(Boolean)
  );

  const planoD = (conversacion?.planos || []).find((p) => p.clave === "conversacion");

  const valores = {
    actividad_propia: {
      valor: actividad?.publicacionesObservadas ?? null,
      motivo:
        actividad?.publicacionesObservadas == null ||
        actividad.publicacionesObservadas === 0
          ? "Ninguna plataforma social permite leer publicaciones sin API. No es que el candidato no publique: es que no podemos mirar."
          : null
    },

    amplificacion_externa: {
      valor: amplificacion?.ganada?.hechosDistintos ?? null,
      motivo:
        amplificacion?.ganada?.piezas == null || amplificacion.ganada.piezas === 0
          ? "No hay corpus de piezas de terceros para este candidato todavia."
          : null
    },

    cobertura_mediatica: {
      valor: amplificacion?.ganada?.medios?.dominiosDistintos ?? null,
      motivo:
        amplificacion?.ganada?.medios?.dominiosDistintos == null
          ? "Sin corpus de evidencias no hay medios que contar."
          : null
    },

    conversacion_publica: {
      valor: planoD?.piezasObservadas ?? null,
      motivo:
        planoD == null
          ? "La separacion de conversacion no se pudo calcular sin corpus."
          : null
    },

    diversidad_de_fuentes: {
      valor:
        evidencias.length && dominios.size
          ? Number((dominios.size / evidencias.length).toFixed(3))
          : null,
      motivo: evidencias.length
        ? null
        : "Sin evidencias no hay diversidad que medir."
    },

    persistencia_temporal: {
      valor: dias.size || null,
      motivo: dias.size
        ? null
        : "No hay ninguna observacion fechada todavia."
    }
  };

  return DIMENSIONES.map((d) => {
    const v = valores[d.id];

    return {
      ...d,
      valor: v.valor,
      observable: v.valor != null,
      motivoNoDisponible: v.valor == null ? v.motivo : null
    };
  });
}


/*
===========================================================
EL INDICE COMPUESTO

Devuelve NO DISPONIBLE y enumera lo que hace falta para que
deje de estarlo. La lista es la hoja de ruta, no una excusa.
===========================================================
*/
export const REQUISITOS_INDICE = Object.freeze([
  {
    id: "metodologia_documentada",
    texto:
      "Una metodologia escrita que diga que pesa cada dimension y por que.",
    cumplido: false
  },
  {
    id: "normalizacion",
    texto:
      "Una normalizacion documentada entre plataformas: hoy una vista de TikTok y una reaccion de Facebook no son comparables.",
    cumplido: false
  },
  {
    id: "deduplicacion",
    texto:
      "Deduplicacion aplicada a todo el corpus, no solo a lo ganado: sin ella el indice se multiplicaria por la replica.",
    cumplido: false
  },
  {
    id: "ventanas_comparables",
    texto:
      "Ventanas con historico suficiente para comparar. Hoy la serie empieza en la primera observacion real.",
    cumplido: false
  },
  {
    id: "cobertura_suficiente",
    texto:
      "Cobertura suficiente de fuentes. Con seis de siete plataformas ilegibles, el indice mediria nuestras fuentes y no al candidato.",
    cumplido: false
  }
]);


export function indiceCompuesto() {
  const pendientes = REQUISITOS_INDICE.filter((r) => !r.cumplido);

  return {
    etiqueta: ETIQUETA_UI,

    disponible: false,

    valor: null,

    estado: "NO_DISPONIBLE",

    requisitos: REQUISITOS_INDICE,

    pendientes: pendientes.length,

    motivo:
      "El indice compuesto queda NO DISPONIBLE. Faltan requisitos sin los cuales el numero diria mas del estado de nuestras fuentes que del candidato, y aun asi se leeria como un ranking.",

    noSignifica: NO_SIGNIFICA,

    declaracion: DECLARACION
  };
}


export function presenciaDigitalObservada(entrada = {}) {
  const dimensiones = dimensionesDePresencia(entrada);

  return {
    etiqueta: ETIQUETA_UI,

    dimensiones,

    observables: dimensiones.filter((d) => d.observable).length,
    total: dimensiones.length,

    indice: indiceCompuesto(),

    declaracion: DECLARACION,

    noSignifica: NO_SIGNIFICA,

    /*
      Prohibiciones de vocabulario. Estan aqui, en el motor, para
      que la interfaz no tenga que acordarse.
    */
    vocabularioProhibido: [
      "influencia electoral",
      "apoyo",
      "popularidad",
      "intencion de voto",
      "liderazgo digital"
    ]
  };
}


export default {
  ETIQUETA_UI,
  NO_SIGNIFICA,
  DECLARACION,
  DIMENSIONES,
  REQUISITOS_INDICE,
  dimensionesDePresencia,
  indiceCompuesto,
  presenciaDigitalObservada
};
