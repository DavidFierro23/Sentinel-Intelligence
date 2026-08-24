// apps/backend/services/geo/anomalyDetector.js

import { UMBRAL_MUESTRA_POR_DEFECTO } from "./geoContracts.js";

/*
===========================================================
ANOMALY DETECTOR — picos, caidas y rupturas por unidad
===========================================================

Marca puntos de una serie que se apartan de su propio
comportamiento. Nada mas.

LO QUE NO HACE, Y ES LO IMPORTANTE
-----------------------------------------------------------

No dice POR QUE. Un pico detectado es un hecho observado sobre
una serie; su causa no esta en la serie. La atribucion es
competencia del Attribution Engine (UX-3), que ademas tiene
prohibido afirmar causa y solo puede hablar de contribucion y
secuencia (WR-D13).

Aqui el lenguaje se detiene en "se aparta de su nivel
habitual". Ni "provocado por", ni "debido a", ni "tras".
Incluso "tras" sugiere causa cuando solo hay orden.

POR QUE MEDIANA Y MAD, Y NO MEDIA Y DESVIACION
-----------------------------------------------------------

La media y la desviacion tipica se contaminan con el propio
pico que se quiere detectar: un valor extremo eleva la media y
dispara la desviacion, y el pico acaba pareciendo normal.

La mediana y la desviacion absoluta mediana (MAD) son
robustas: un valor extremo no las mueve. Con series cortas
—que es lo que hay— la diferencia decide entre detectar y no
detectar.

EL LIMITE QUE HAY QUE DECLARAR SIEMPRE
-----------------------------------------------------------

Sentinel observa bajo demanda. Un pico puede ser un pico de
ACTIVIDAD o un pico de OBSERVACION: el dia que el analista
lanzo tres investigaciones entraron mas evidencias. Sin ingesta
continua las dos cosas son indistinguibles, y este modulo lo
declara en cada anomalia en lugar de dejarlo en la letra
pequena.
===========================================================
*/


export const TIPOS = Object.freeze({
  PICO: "pico",
  CAIDA: "caida",
  APARICION: "aparicion",
  DESAPARICION: "desaparicion"
});


export const SEVERIDADES = Object.freeze(["leve", "moderada", "fuerte"]);


/*
  Numero minimo de cubos para que la nocion de "nivel habitual"
  signifique algo. Con tres puntos cualquier valor es el maximo
  o el minimo.
*/
const CUBOS_MINIMOS = 5;

/*
  Umbral en desviaciones absolutas medianas. 3.5 es el valor
  convencional del z-score modificado de Iglewicz y Hoaglin.
*/
const UMBRAL_Z = 3.5;

const FACTOR_MAD = 0.6745;


function mediana(valores) {
  if (!valores.length) return 0;

  const orden = [...valores].sort((a, b) => a - b);

  const medio = Math.floor(orden.length / 2);

  return orden.length % 2
    ? orden[medio]
    : (orden[medio - 1] + orden[medio]) / 2;
}


function desviacionAbsolutaMediana(valores, med) {
  if (!valores.length) return 0;

  return mediana(valores.map((v) => Math.abs(v - med)));
}


function severidadDe(z) {
  const a = Math.abs(z);

  if (a >= 7) return "fuerte";
  if (a >= 5) return "moderada";
  return "leve";
}


/*
===========================================================
DETECTAR SOBRE UNA SERIE TERRITORIAL
===========================================================

Entrada: la salida de territorialTimeline.construirSerie().
===========================================================
*/

export function detectarAnomalias(serieTerritorial, opciones = {}) {
  const umbralMuestra = Number.isFinite(opciones.umbralMuestra)
    ? opciones.umbralMuestra
    : UMBRAL_MUESTRA_POR_DEFECTO;

  const umbralZ = Number.isFinite(opciones.umbralZ) ? opciones.umbralZ : UMBRAL_Z;

  const series = serieTerritorial?.series || [];

  const anomalias = [];

  const noEvaluadas = [];

  series.forEach((s) => {
    /*
      -------------------------------------------------------
      DOS PUERTAS ANTES DE MIRAR NADA
      -------------------------------------------------------
    */
    if (!s.sostieneLectura) {
      noEvaluadas.push({
        unidadId: s.unidadId,
        nombre: s.nombre,
        motivo:
          s.motivoSiNoSostiene ||
          `Menos de ${umbralMuestra} evidencias en la ventana.`
      });

      return;
    }

    const valores = (s.puntos || []).map((p) => p.valor);

    if (valores.length < CUBOS_MINIMOS) {
      noEvaluadas.push({
        unidadId: s.unidadId,
        nombre: s.nombre,
        motivo: `La ventana tiene ${valores.length} periodo(s); se necesitan ${CUBOS_MINIMOS} para que «nivel habitual» signifique algo.`
      });

      return;
    }

    const med = mediana(valores);

    const mad = desviacionAbsolutaMediana(valores, med);

    /*
      MAD cero: la serie es practicamente plana. Cualquier
      valor distinto daria z infinito, asi que no se usa el
      z-score. Se exige una separacion absoluta respecto de la
      mediana para no marcar como anomalia un 1 sobre una serie
      de ceros.
    */
    const madCero = mad === 0;

    (s.puntos || []).forEach((punto, i) => {
      const v = punto.valor;

      let z = null;

      let esAnomalia = false;

      if (madCero) {
        const separacion = Math.abs(v - med);

        esAnomalia = separacion >= Math.max(umbralMuestra, med + 1);
      } else {
        z = (FACTOR_MAD * (v - med)) / mad;

        esAnomalia = Math.abs(z) >= umbralZ;
      }

      if (!esAnomalia) return;

      const previo = i > 0 ? s.puntos[i - 1].valor : null;

      let tipo;

      if (v > med) {
        tipo = previo === 0 ? TIPOS.APARICION : TIPOS.PICO;
      } else {
        tipo = v === 0 ? TIPOS.DESAPARICION : TIPOS.CAIDA;
      }

      anomalias.push({
        unidadId: s.unidadId,
        nombre: s.nombre,
        resolucion: s.resolucion,

        tipo,
        inicio: punto.inicio,

        valor: v,
        nivelHabitual: med,
        desviacion: Number((v - med).toFixed(2)),
        z: z === null ? null : Number(z.toFixed(2)),

        severidad: madCero ? "leve" : severidadDe(z),

        metodo: madCero
          ? "separacion absoluta sobre serie plana (MAD = 0)"
          : "z-score modificado sobre mediana y MAD",

        /*
          LENGUAJE CALIBRADO. Describe la serie, no el mundo.
        */
        descripcion: describir(tipo, s.nombre, v, med),

        /*
          Viaja con CADA anomalia, no en una nota al pie.
        */
        advertencia:
          "Sin ingesta continua, un cambio en la serie puede reflejar cambio de actividad o cambio en el esfuerzo de observacion. Este modulo no puede distinguirlos.",

        atribucion: {
          disponible: false,
          motivo:
            "La causa no esta en la serie. La atribucion —y solo como contribucion y secuencia, nunca como causa— corresponde al Attribution Engine, no implementado (UX-3, WR-D13)."
        }
      });
    });
  });

  anomalias.sort(
    (a, b) =>
      SEVERIDADES.indexOf(b.severidad) - SEVERIDADES.indexOf(a.severidad) ||
      Math.abs(b.desviacion) - Math.abs(a.desviacion)
  );

  return {
    anomalias,
    noEvaluadas,

    parametros: {
      umbralMuestra,
      umbralZ,
      cubosMinimos: CUBOS_MINIMOS,
      metodo: "z-score modificado (mediana + MAD), robusto a valores extremos"
    },

    metricas: {
      seriesRecibidas: series.length,
      seriesEvaluadas: series.length - noEvaluadas.length,
      seriesNoEvaluadas: noEvaluadas.length,
      anomalias: anomalias.length
    },

    loQueNoSabemos: [
      noEvaluadas.length
        ? `${noEvaluadas.length} serie(s) no evaluadas por muestra o ventana insuficiente. No evaluada NO es «sin anomalias».`
        : null,

      "Una anomalia detectada es un hecho sobre la serie, no sobre el territorio. Este modulo no afirma causa ni la insinua.",

      "Sin ingesta continua no se distingue un pico de actividad de un pico de observacion."
    ].filter(Boolean)
  };
}


function describir(tipo, nombre, valor, med) {
  switch (tipo) {
    case TIPOS.PICO:
      return `${nombre}: ${valor} evidencias frente a un nivel habitual de ${med}. Se aparta al alza de su propio comportamiento.`;

    case TIPOS.CAIDA:
      return `${nombre}: ${valor} evidencias frente a un nivel habitual de ${med}. Se aparta a la baja de su propio comportamiento.`;

    case TIPOS.APARICION:
      return `${nombre}: pasa de ningun registro a ${valor} en el periodo. Aparicion en la serie, no necesariamente en el territorio.`;

    case TIPOS.DESAPARICION:
      return `${nombre}: sin registros en el periodo, frente a un nivel habitual de ${med}. Ausencia de observacion y ausencia de hechos no son lo mismo.`;

    default:
      return `${nombre}: ${valor} evidencias.`;
  }
}


export default { detectarAnomalias, TIPOS, SEVERIDADES };
