// apps/backend/services/conversation/conversationTimeline.js

import {
  aFecha,
  inicioDeCubo,
  siguienteCubo,
  claveCubo,
  GRANULARIDADES
} from "../geo/territorialTimeline.js";

import { ENCUADRES } from "./conversationContracts.js";

/*
===========================================================
CONVERSATION TIMELINE — volumen publicado en el tiempo
===========================================================

Serie de volumen de publicacion, desglosada por tema y por
encuadre. Responde "desde cuando", no "por que".

MISMO CALENDARIO QUE LA SERIE TERRITORIAL
-----------------------------------------------------------

El troceado en cubos se importa de territorialTimeline en
lugar de reescribirse. Con dos implementaciones, un cambio en
una —el dia de inicio de semana, el huso— desplazaria sus
cubos respecto de la otra, y el analista tendria dos graficos
del mismo periodo que no cuadran. Un grafico que no cuadra con
su vecino destruye la confianza en los dos.

LO QUE MIDE ESTA SERIE
-----------------------------------------------------------

Publicaciones por periodo. No lectores, no alcance, no
interes. Un pico significa que se publico mas.

Y como Sentinel observa bajo demanda, un pico puede ser un
pico de publicacion o un pico de observacion. La serie lo
declara en lugar de dejarlo implicito.
===========================================================
*/


export function construirSerieDeConversacion(evidencias = [], opciones = {}) {
  const granularidad =
    opciones.granularidad === GRANULARIDADES.SEMANA
      ? GRANULARIDADES.SEMANA
      : GRANULARIDADES.DIA;

  const lista = Array.isArray(evidencias) ? evidencias : [];

  /*
    Indices por tema y por encuadre, aportados por el
    orquestador. Se reciben ya calculados: esta serie no
    clasifica nada, solo cuenta en el tiempo.
  */
  const temas = opciones.temas || [];

  const encuadrePorIndice = opciones.encuadrePorIndice || {};

  const fechadas = [];

  const sinFecha = [];

  lista.forEach((e, indice) => {
    const f = aFecha(e?.fecha);

    if (f) fechadas.push({ indice, evidencia: e, fecha: f });
    else sinFecha.push({ indice, evidencia: e });
  });

  if (fechadas.length === 0) {
    return {
      granularidad,
      ventana: { desde: null, hasta: null, cubos: 0 },
      cubos: [],
      seriesPorTema: [],
      serieDeEncuadre: [],
      metricas: {
        evidencias: lista.length,
        enSerie: 0,
        sinFecha: sinFecha.length
      },
      loQueNoSabemos: [
        lista.length
          ? `Ninguna de las ${lista.length} evidencias trae fecha utilizable. No hay serie temporal: las fuentes no fecharon lo que devolvieron.`
          : "No se recibio ninguna evidencia."
      ]
    };
  }

  const tiempos = fechadas.map((f) => f.fecha.getTime());

  const desde = aFecha(opciones.desde) || new Date(Math.min(...tiempos));

  const hasta = aFecha(opciones.hasta) || new Date(Math.max(...tiempos));

  const enVentana = fechadas.filter(
    (f) =>
      f.fecha.getTime() >= desde.getTime() && f.fecha.getTime() <= hasta.getTime()
  );

  /* --- Cubos, incluidos los vacios --- */
  const cubos = [];

  const indicePorClave = new Map();

  let cursor = inicioDeCubo(desde, granularidad);

  const fin = inicioDeCubo(hasta, granularidad);

  const MAX_CUBOS = 1000;

  while (cursor.getTime() <= fin.getTime() && cubos.length < MAX_CUBOS) {
    const clave = claveCubo(cursor);

    indicePorClave.set(clave, cubos.length);

    cubos.push({
      clave,
      inicio: cursor.toISOString(),
      fin: siguienteCubo(cursor, granularidad).toISOString(),
      total: 0,
      porEncuadre: {
        critico: 0,
        favorable: 0,
        neutro: 0,
        no_determinable: 0
      },
      indices: []
    });

    cursor = siguienteCubo(cursor, granularidad);
  }

  enVentana.forEach(({ indice, fecha }) => {
    const idx = indicePorClave.get(claveCubo(inicioDeCubo(fecha, granularidad)));

    if (idx === undefined) return;

    cubos[idx].total += 1;

    cubos[idx].indices.push(indice);

    const enc = encuadrePorIndice[indice] || ENCUADRES.NO_DETERMINABLE;

    if (cubos[idx].porEncuadre[enc] !== undefined) {
      cubos[idx].porEncuadre[enc] += 1;
    }
  });

  /*
    ---------------------------------------------------------
    SERIES POR TEMA
    ---------------------------------------------------------
  */
  const seriesPorTema = temas.map((t) => {
    const miembros = new Set(t.indices || []);

    const puntos = cubos.map((c) => ({
      inicio: c.inicio,
      valor: c.indices.filter((i) => miembros.has(i)).length
    }));

    const total = puntos.reduce((s, p) => s + p.valor, 0);

    return {
      temaId: t.id,
      nombre: t.nombre,
      origen: t.origen,
      total,
      enSerie: total,
      sinFecha: (t.indices || []).length - total,
      puntos
    };
  });

  seriesPorTema.sort((a, b) => b.total - a.total);

  /*
    ---------------------------------------------------------
    SERIE DE ENCUADRE

    Se entrega como conteos absolutos por periodo, NO como
    porcentaje. Un porcentaje de encuadre sobre 3 titulares es
    ruido con forma de tendencia.
    ---------------------------------------------------------
  */
  const serieDeEncuadre = cubos.map((c) => ({
    inicio: c.inicio,
    total: c.total,
    ...c.porEncuadre,
    baseSuficiente: c.total >= 5,
    avisoBase:
      c.total > 0 && c.total < 5
        ? "Menos de 5 publicaciones en el periodo: el reparto de encuadre no se lee como tendencia."
        : null
  }));

  const periodosSinDato = cubos.filter((c) => c.total === 0).length;

  return {
    granularidad,

    ventana: {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      cubos: cubos.length
    },

    cubos: cubos.map(({ indices, ...resto }) => resto),

    seriesPorTema,
    serieDeEncuadre,

    metricas: {
      evidencias: lista.length,
      enSerie: enVentana.length,
      sinFecha: sinFecha.length,
      fueraDeVentana: fechadas.length - enVentana.length,
      periodosSinDato,
      picoMaximo: Math.max(0, ...cubos.map((c) => c.total))
    },

    ingesta: {
      continua: false,
      periodosSinDato,
      interpretacion:
        "Sentinel observa bajo demanda. Un periodo en cero significa que no se observo, no que no se publicara. La ausencia de actividad no es evidencia de calma (WR-7)."
    },

    loQueNoSabemos: [
      sinFecha.length
        ? `${sinFecha.length} de ${lista.length} evidencias sin fecha: no entran en la serie. La suma de la serie es menor que el total, y no es un error de calculo.`
        : null,

      "La serie mide publicaciones por periodo, no lectores ni alcance. Un pico significa «se publico mas», no «importa mas».",

      "Sin ingesta continua no se distingue un pico de publicacion de un pico de observacion."
    ].filter(Boolean)
  };
}


export default { construirSerieDeConversacion };
