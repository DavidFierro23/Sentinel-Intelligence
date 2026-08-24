// apps/backend/services/geo/territorialTimeline.js

import { unidadPorId } from "./territoryRegistry.js";
import { UMBRAL_MUESTRA_POR_DEFECTO } from "./geoContracts.js";

/*
===========================================================
TERRITORIAL TIMELINE — serie temporal por unidad
===========================================================

Convierte un lote de evidencias ya ubicadas en series por
unidad territorial y ventana. Alimenta el grafico de evolucion
y al detector de anomalias.

DOS HONESTIDADES OBLIGATORIAS
-----------------------------------------------------------

1. LA FECHA QUE FALTA.

   Ni SerpAPI ni el raspado devuelven fecha siempre. Una
   evidencia sin fecha no puede entrar en ningun cubo temporal
   —meterla en el ultimo o repartirla seria fabricar una
   serie—, asi que se cuenta aparte y se declara.

   Consecuencia que hay que decir en voz alta: la suma de la
   serie es MENOR que el total de evidencias. Si no se declara,
   parece un error de calculo o, peor, pasa inadvertido.

2. LA AUSENCIA DE INGESTA CONTINUA.

   Sentinel observa BAJO DEMANDA: cuando el analista lanza una
   investigacion. No hay un proceso que mire el territorio a
   todas horas.

   Por tanto un cubo con cero NO significa que no pasara nada:
   significa que nadie miraba. Es exactamente el riesgo WR-7 y
   la doctrina que ya separo `bloqueado` de `0 resultados` en
   el Search Provider Layer y `ausencia` de `no comprobada` en
   la capa social. Aqui se aplica al tiempo.

   Mientras no exista ingesta continua, TODA serie de este
   modulo viaja con `ingesta.continua: false`.
===========================================================
*/


const DIA_MS = 24 * 60 * 60 * 1000;


export const GRANULARIDADES = Object.freeze({
  DIA: "dia",
  SEMANA: "semana"
});


function aFecha(valor) {
  if (!valor) return null;

  const d = valor instanceof Date ? valor : new Date(valor);

  return Number.isNaN(d.getTime()) ? null : d;
}


/*
  Inicio del cubo al que pertenece una fecha. En UTC, y a
  proposito: mezclar husos entre el servidor y el dato produce
  cubos que se desplazan segun donde corra el proceso.
*/
export function inicioDeCubo(fecha, granularidad) {
  const d = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate())
  );

  if (granularidad === GRANULARIDADES.SEMANA) {
    /* Lunes como primer dia. getUTCDay(): 0 = domingo. */
    const dia = d.getUTCDay();

    const retroceso = dia === 0 ? 6 : dia - 1;

    d.setUTCDate(d.getUTCDate() - retroceso);
  }

  return d;
}


export function siguienteCubo(inicio, granularidad) {
  const d = new Date(inicio);

  d.setUTCDate(d.getUTCDate() + (granularidad === GRANULARIDADES.SEMANA ? 7 : 1));

  return d;
}


export function claveCubo(fecha) {
  return fecha.toISOString().slice(0, 10);
}


/*
  `aFecha`, `inicioDeCubo`, `siguienteCubo` y `claveCubo` se
  exportan para que la serie de conversacion publica use
  EXACTAMENTE el mismo calendario. Duplicar el troceado
  produciria cubos desplazados entre las dos vistas, y dos
  graficos del mismo periodo que no cuadran es peor que no
  tener el segundo.
*/
export { aFecha };


/*
===========================================================
CONSTRUIR LA SERIE
===========================================================

Entrada: la salida de geoResolver.resolverLote().

`opciones`:
  desde, hasta     ISO o Date. Si faltan, se derivan del dato
  granularidad     'dia' | 'semana'
  umbralMuestra    para marcar series que no sostienen lectura
===========================================================
*/

export function construirSerie(resueltas, opciones = {}) {
  const granularidad =
    opciones.granularidad === GRANULARIDADES.SEMANA
      ? GRANULARIDADES.SEMANA
      : GRANULARIDADES.DIA;

  const umbral = Number.isFinite(opciones.umbralMuestra)
    ? opciones.umbralMuestra
    : UMBRAL_MUESTRA_POR_DEFECTO;

  const ubicadas = resueltas?.ubicadas || [];

  const fechadas = [];

  const sinFecha = [];

  ubicadas.forEach((registro) => {
    const f = aFecha(
      registro.evidencia?.fecha ||
        registro.evidencia?.fechaHecho ||
        registro.evidencia?.fechaDeteccion
    );

    if (f) fechadas.push({ ...registro, fechaResuelta: f });
    else sinFecha.push(registro);
  });

  /*
    ---------------------------------------------------------
    VENTANA
    ---------------------------------------------------------
  */
  const desdeOpc = aFecha(opciones.desde);

  const hastaOpc = aFecha(opciones.hasta);

  if (fechadas.length === 0) {
    return serieVacia({
      granularidad,
      desde: desdeOpc,
      hasta: hastaOpc,
      totalUbicadas: ubicadas.length,
      sinFecha: sinFecha.length
    });
  }

  const tiempos = fechadas.map((r) => r.fechaResuelta.getTime());

  const desde = desdeOpc || new Date(Math.min(...tiempos));

  const hasta = hastaOpc || new Date(Math.max(...tiempos));

  const enVentana = fechadas.filter(
    (r) =>
      r.fechaResuelta.getTime() >= desde.getTime() &&
      r.fechaResuelta.getTime() <= hasta.getTime()
  );

  const fueraDeVentana = fechadas.length - enVentana.length;

  /*
    ---------------------------------------------------------
    CUBOS

    Se generan TODOS los del rango, incluidos los vacios. Un
    grafico que salta los dias sin dato comprime el eje y
    convierte una pausa en continuidad.
    ---------------------------------------------------------
  */
  const cubos = [];

  const indicePorClave = new Map();

  let cursor = inicioDeCubo(desde, granularidad);

  const finReal = inicioDeCubo(hasta, granularidad);

  /*
    Tope de seguridad: una ventana mal formada no debe generar
    un bucle de millones de cubos.
  */
  const MAX_CUBOS = 1000;

  while (cursor.getTime() <= finReal.getTime() && cubos.length < MAX_CUBOS) {
    const clave = claveCubo(cursor);

    indicePorClave.set(clave, cubos.length);

    cubos.push({
      clave,
      inicio: cursor.toISOString(),
      fin: siguienteCubo(cursor, granularidad).toISOString(),
      total: 0,
      porUnidad: {}
    });

    cursor = siguienteCubo(cursor, granularidad);
  }

  const totalesPorUnidad = new Map();

  enVentana.forEach((r) => {
    const clave = claveCubo(inicioDeCubo(r.fechaResuelta, granularidad));

    const idx = indicePorClave.get(clave);

    if (idx === undefined) return;

    const unidadId = r.ubicacion?.unidadId;

    if (!unidadId) return;

    cubos[idx].total += 1;

    cubos[idx].porUnidad[unidadId] = (cubos[idx].porUnidad[unidadId] || 0) + 1;

    totalesPorUnidad.set(unidadId, (totalesPorUnidad.get(unidadId) || 0) + 1);
  });

  /*
    ---------------------------------------------------------
    SERIES POR UNIDAD
    ---------------------------------------------------------
  */
  const series = [...totalesPorUnidad.entries()]
    .map(([unidadId, total]) => {
      const unidad = unidadPorId(unidadId);

      return {
        unidadId,
        nombre: unidad?.nombre || unidadId,
        resolucion: unidad?.resolucion || null,

        total,

        /*
          Una serie por debajo del umbral se entrega igual —el
          analista puede querer verla— pero marcada, para que
          no se rankee ni se lea como tendencia.
        */
        sostieneLectura: total >= umbral,

        motivoSiNoSostiene:
          total >= umbral
            ? null
            : `Solo ${total} evidencia(s) en la ventana: por debajo del umbral de ${umbral}. No se lee como tendencia.`,

        puntos: cubos.map((c) => ({
          inicio: c.inicio,
          valor: c.porUnidad[unidadId] || 0
        }))
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    granularidad,

    ventana: {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      cubos: cubos.length,
      dias: Math.max(1, Math.round((hasta - desde) / DIA_MS) + 1)
    },

    cubos,
    series,

    metricas: {
      evidenciasUbicadas: ubicadas.length,
      enSerie: enVentana.length,
      sinFecha: sinFecha.length,
      fueraDeVentana,
      unidadesConSerie: series.length,
      unidadesQueSostienenLectura: series.filter((s) => s.sostieneLectura).length
    },

    ingesta: declararIngesta(cubos),

    loQueNoSabemos: [
      sinFecha.length
        ? `${sinFecha.length} evidencia(s) ubicadas SIN fecha. No entran en ninguna serie: la suma de la serie es menor que el total de evidencias, y esa diferencia no es un error de calculo.`
        : null,

      fueraDeVentana
        ? `${fueraDeVentana} evidencia(s) fechadas fuera de la ventana solicitada.`
        : null,

      "Sentinel observa bajo demanda, no de forma continua. Un periodo con cero no significa que no ocurriera nada: significa que nadie estaba mirando."
    ].filter(Boolean)
  };
}


/*
-----------------------------------------------------------
DECLARACION DE INGESTA — la barra de cobertura del §9.3

Mientras no exista un proceso de observacion continua, la
cobertura no se puede afirmar. Lo unico honesto es declarar
que la serie refleja CUANDO SE MIRO, no cuando ocurrieron los
hechos.
-----------------------------------------------------------
*/

function declararIngesta(cubos) {
  const vacios = cubos.filter((c) => c.total === 0);

  return {
    continua: false,

    motivo:
      "No existe ingesta continua. Las evidencias entran cuando el analista lanza una investigacion.",

    periodosSinDato: vacios.length,

    /*
      Deliberadamente NO se llaman "huecos de ingesta". Un hueco
      implica que habia un flujo que se interrumpio, y aqui no
      lo hay. Llamarlo hueco sugeriria una completitud que no
      existe.
    */
    interpretacion:
      "Los periodos en cero no son huecos de un flujo continuo: son periodos sin observacion. La ausencia de actividad NO es evidencia de calma (WR-7).",

    barraDeCobertura: cubos.map((c) => ({
      inicio: c.inicio,
      observado: c.total > 0
    }))
  };
}


function serieVacia({ granularidad, desde, hasta, totalUbicadas, sinFecha }) {
  return {
    granularidad,

    ventana: {
      desde: desde ? desde.toISOString() : null,
      hasta: hasta ? hasta.toISOString() : null,
      cubos: 0,
      dias: 0
    },

    cubos: [],
    series: [],

    metricas: {
      evidenciasUbicadas: totalUbicadas,
      enSerie: 0,
      sinFecha,
      fueraDeVentana: 0,
      unidadesConSerie: 0,
      unidadesQueSostienenLectura: 0
    },

    ingesta: {
      continua: false,
      motivo:
        "No existe ingesta continua. Las evidencias entran cuando el analista lanza una investigacion.",
      periodosSinDato: 0,
      interpretacion:
        "Sin ninguna evidencia fechada no hay serie que interpretar.",
      barraDeCobertura: []
    },

    loQueNoSabemos: [
      totalUbicadas > 0
        ? `Las ${totalUbicadas} evidencias ubicadas no traen fecha utilizable. No hay serie temporal: no es que no haya ocurrido nada, es que las fuentes no fecharon lo que devolvieron.`
        : "No se recibio ninguna evidencia ubicada."
    ]
  };
}


/*
===========================================================
COMPARAR DOS PERIODOS

La variacion de una unidad CONSIGO MISMA no necesita
denominador poblacional: no es una metrica per capita, es su
propia serie. Por eso este calculo si esta disponible con los
datos oficiales pendientes.
===========================================================
*/

export function compararPeriodos(serieActual, seriePrevia, opciones = {}) {
  const umbralMinimo = Number.isFinite(opciones.baseMinima)
    ? opciones.baseMinima
    : 5;

  const previas = new Map(
    (seriePrevia?.series || []).map((s) => [s.unidadId, s.total])
  );

  const comparacion = (serieActual?.series || []).map((s) => {
    const antes = previas.get(s.unidadId) || 0;

    const ahora = s.total;

    /*
      Con base cero o muy baja, el porcentaje es ruido con
      forma de titular: de 1 a 3 evidencias es "+200 %". Se
      declara la variacion absoluta y se BLOQUEA la relativa.
    */
    const baseSuficiente = antes >= umbralMinimo;

    return {
      unidadId: s.unidadId,
      nombre: s.nombre,

      antes,
      ahora,

      variacionAbsoluta: ahora - antes,

      variacionRelativa: baseSuficiente
        ? Number((((ahora - antes) / antes) * 100).toFixed(1))
        : null,

      relativaDisponible: baseSuficiente,

      motivoSinRelativa: baseSuficiente
        ? null
        : `Base de ${antes} evidencia(s) en el periodo anterior, por debajo de ${umbralMinimo}. Un porcentaje sobre esa base es ruido con forma de titular.`,

      etiqueta: describirVariacion(ahora - antes, baseSuficiente)
    };
  });

  /* Las que existian antes y desaparecieron tambien son senal. */
  previas.forEach((antes, unidadId) => {
    if (comparacion.some((c) => c.unidadId === unidadId)) return;

    const unidad = unidadPorId(unidadId);

    comparacion.push({
      unidadId,
      nombre: unidad?.nombre || unidadId,
      antes,
      ahora: 0,
      variacionAbsoluta: -antes,
      variacionRelativa: antes >= umbralMinimo ? -100 : null,
      relativaDisponible: antes >= umbralMinimo,
      motivoSinRelativa:
        antes >= umbralMinimo
          ? null
          : `Base de ${antes} evidencia(s): insuficiente para un porcentaje.`,
      etiqueta: "sin evidencias en el periodo actual"
    });
  });

  return {
    comparacion: comparacion.sort(
      (a, b) => Math.abs(b.variacionAbsoluta) - Math.abs(a.variacionAbsoluta)
    ),

    baseMinima: umbralMinimo,

    declaracion:
      "Variacion de cada unidad respecto de si misma entre dos periodos. NO es una metrica per capita y no requiere denominador poblacional. Una variacion no explica su causa.",

    loQueNoSabemos: [
      "Comparar dos periodos observados bajo demanda mezcla cambio real con cambio en el esfuerzo de observacion. Sin ingesta continua no se pueden separar."
    ]
  };
}


function describirVariacion(delta, baseSuficiente) {
  if (delta === 0) return "sin cambio";

  if (!baseSuficiente) {
    return delta > 0
      ? `+${delta} evidencias (base insuficiente para porcentaje)`
      : `${delta} evidencias (base insuficiente para porcentaje)`;
  }

  return delta > 0 ? "al alza" : "a la baja";
}


export default { construirSerie, compararPeriodos, GRANULARIDADES };
