// apps/backend/services/territorial/temporalWindows.js

import {
  VENTANAS_COMPARABLES,
  buscarVentanaAnterior,
  compararConVentanaAnterior
} from "./snapshotStore.js";

/*
===========================================================
E1 TEMPORAL FOUNDATION
===========================================================

Responde una sola pregunta, y la responde con «todavia no» la
mayor parte del tiempo:

    ¿HAY HISTORICO SUFICIENTE PARA COMPARAR?

DOS FORMAS DE NO PODER COMPARAR
-----------------------------------------------------------

    SIN_VENTANA_COMPARABLE   no existe la ventana anterior
    HISTORICO_INSUFICIENTE   existe, pero no cubre el periodo

La segunda es la que se pasa por alto. Si el primer snapshot
es de hace tres dias y se pide una ventana de 30, hay ventana
anterior —tecnicamente— pero cubre el 10 % del periodo. Tratar
eso como una comparacion valida es peor que no comparar: da un
numero con aspecto de tendencia calculado sobre casi nada.

RECENCIA NO ES CRECIMIENTO
-----------------------------------------------------------

Que algo se haya publicado hoy no significa que este creciendo.
Sin ventana anterior, «lo mas reciente» es lo unico que se
puede decir, y decirlo con la palabra «crecimiento» es la clase
de error que un analista electoral paga caro.

Por eso las palabras de evolucion siguen prohibidas y este
modulo no las produce nunca.

EL HISTORICO EMPIEZA CUANDO EMPIEZA
-----------------------------------------------------------

No se reconstruye. Google News no da archivo y GDELT esta sin
evaluar; hasta que uno de los dos lo aporte, el primer dia con
snapshot es el principio del historico y punto.

Un hueco no se interpola. Interpolar produciria una serie
suave y creible que nadie observo.
===========================================================
*/


export const VENTANAS = Object.freeze({
  "24h": { id: "24h", dias: 1, etiqueta: "últimas 24 horas" },
  "7d": { id: "7d", dias: 7, etiqueta: "últimos 7 días" },
  "15d": { id: "15d", dias: 15, etiqueta: "últimos 15 días" },
  "30d": { id: "30d", dias: 30, etiqueta: "últimos 30 días" },
  "90d": { id: "90d", dias: 90, etiqueta: "últimos 90 días" }
});


export const ESTADOS_VENTANA = Object.freeze({
  COMPARABLE: "VENTANA_COMPARABLE",
  SIN_VENTANA: "SIN_VENTANA_COMPARABLE",
  INSUFICIENTE: "HISTORICO_INSUFICIENTE"
});


/*
  Proporcion minima del periodo que el historico debe cubrir
  para que la comparacion signifique algo. 0.8 es una decision
  declarada, no un estandar: por debajo de ahi se compara un
  mes contra tres semanas y el resultado se lee como si fueran
  dos meses.
*/
export const COBERTURA_MINIMA = 0.8;


function dias(desde, hasta) {
  const a = new Date(desde).getTime();

  const b = new Date(hasta).getTime();

  if (Number.isNaN(a) || Number.isNaN(b)) return null;

  return (b - a) / 86400000;
}


/*
===========================================================
EVALUAR UNA VENTANA
===========================================================

`snapshots` son todos los del territorio. `ahora` es el
instante de referencia.
===========================================================
*/

export function evaluarVentana({
  snapshots = [],
  territorioId,
  ventanaId = "30d",
  ahora,
  actual = null
} = {}) {
  const ventana = VENTANAS[ventanaId];

  if (!ventana) {
    return {
      ventana: ventanaId,
      estado: ESTADOS_VENTANA.SIN_VENTANA,
      disponible: false,
      motivo: `«${ventanaId}» no es una ventana declarada. Declaradas: ${VENTANAS_COMPARABLES.join(", ")}.`
    };
  }

  const delTerritorio = snapshots
    .filter((s) => s.territorio?.unidadId === territorioId)
    .sort((a, b) => (a.capturedAt < b.capturedAt ? -1 : 1));

  if (delTerritorio.length === 0) {
    return {
      ventana: ventana.id,
      etiqueta: ventana.etiqueta,
      estado: ESTADOS_VENTANA.SIN_VENTANA,
      disponible: false,

      historico: { snapshots: 0, desde: null, diasCubiertos: 0 },

      variacion: null,

      motivo:
        "No hay ningún snapshot de este territorio. El histórico empieza con la primera ejecución que se guarde.",

      declaracion:
        "No se reconstruye histórico inexistente. Un hueco no se interpola: interpolar produciría una serie creíble que nadie observó."
    };
  }

  const primero = delTerritorio[0];

  const diasHistorico = dias(primero.capturedAt, ahora);

  const cobertura =
    diasHistorico === null ? null : Math.min(1, diasHistorico / ventana.dias);

  const historico = {
    snapshots: delTerritorio.length,
    desde: primero.capturedAt,
    diasCubiertos: diasHistorico === null ? null : Number(diasHistorico.toFixed(2)),
    coberturaDelPeriodo: cobertura === null ? null : Number(cobertura.toFixed(3)),
    periodoPedidoDias: ventana.dias
  };

  /*
    ---------------------------------------------------------
    HISTORICO INSUFICIENTE

    Se comprueba ANTES de buscar la ventana anterior. Si el
    historico no cubre el periodo, da igual que exista un
    snapshot previo: compararlo mediria tres dias y lo
    presentaria como treinta.
    ---------------------------------------------------------
  */
  if (cobertura !== null && cobertura < COBERTURA_MINIMA) {
    return {
      ventana: ventana.id,
      etiqueta: ventana.etiqueta,
      estado: ESTADOS_VENTANA.INSUFICIENTE,
      disponible: false,

      historico,

      variacion: null,

      motivo: `El histórico cubre ${Math.round(cobertura * 100)} % del periodo pedido (${historico.diasCubiertos} de ${ventana.dias} días). Mínimo declarado: ${Math.round(COBERTURA_MINIMA * 100)} %.`,

      declaracion:
        "Comparar un mes contra tres semanas da un número con aspecto de tendencia calculado sobre casi nada. No se calcula.",

      disponibleEn:
        historico.diasCubiertos !== null
          ? `Faltan aproximadamente ${Math.ceil(ventana.dias * COBERTURA_MINIMA - historico.diasCubiertos)} día(s) de acumulación.`
          : null
    };
  }

  const referencia = actual || delTerritorio[delTerritorio.length - 1];

  const anterior = buscarVentanaAnterior(delTerritorio, {
    territorioId,
    ventanaId: ventana.id,
    capturedAt: referencia.capturedAt
  });

  const comparacion = compararConVentanaAnterior(referencia, anterior);

  return {
    ventana: ventana.id,
    etiqueta: ventana.etiqueta,

    estado: comparacion.disponible
      ? ESTADOS_VENTANA.COMPARABLE
      : ESTADOS_VENTANA.SIN_VENTANA,

    disponible: comparacion.disponible,

    historico,

    ...comparacion,

    /*
      Se repite aqui a proposito. Un consumidor que lea
      `variacionEvidencias` sin mirar el estado tiene que
      encontrarse con esto en el mismo objeto.
    */
    prohibido: [
      "No llamar «crecimiento» a la recencia: que algo se publique hoy no dice que esté creciendo.",
      "No usar «emergente», «viral» ni «en aumento» sin dos ventanas completas."
    ]
  };
}


/*
-----------------------------------------------------------
EVALUAR TODAS

Da el estado de las cinco ventanas de una vez. Es lo que la
interfaz necesita para poder ofrecer solo las que existen en
lugar de dejar al analista pedir una y recibir un error.
-----------------------------------------------------------
*/

export function evaluarTodasLasVentanas({ snapshots = [], territorioId, ahora, actual = null }) {
  const resultados = {};

  VENTANAS_COMPARABLES.forEach((id) => {
    resultados[id] = evaluarVentana({ snapshots, territorioId, ventanaId: id, ahora, actual });
  });

  const comparables = Object.values(resultados).filter((r) => r.disponible);

  return {
    ventanas: resultados,

    resumen: {
      declaradas: VENTANAS_COMPARABLES.length,
      comparables: comparables.length,

      sinHistoricoSuficiente: Object.values(resultados).filter(
        (r) => r.estado === ESTADOS_VENTANA.INSUFICIENTE
      ).length,

      sinVentanaAnterior: Object.values(resultados).filter(
        (r) => r.estado === ESTADOS_VENTANA.SIN_VENTANA
      ).length,

      /*
        La ventana mas larga que SI se puede comparar. Es lo
        util para la interfaz: ofrecer esa y no las demas.
      */
      mayorComparable: comparables.length
        ? comparables[comparables.length - 1].ventana
        : null
    },

    declaracion:
      comparables.length === 0
        ? "Ninguna ventana comparable todavía. El histórico se acumula desde el primer snapshot guardado; no se reconstruye."
        : `${comparables.length} de ${VENTANAS_COMPARABLES.length} ventanas comparables.`
  };
}


export default {
  VENTANAS,
  ESTADOS_VENTANA,
  COBERTURA_MINIMA,
  evaluarVentana,
  evaluarTodasLasVentanas
};
