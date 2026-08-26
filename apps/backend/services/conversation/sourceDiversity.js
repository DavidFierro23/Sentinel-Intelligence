// apps/backend/services/conversation/sourceDiversity.js

import { CLASES_FUENTE } from "./sourceClassifier.js";
import { esPlataforma } from "./sourceUniverse.js";

/*
===========================================================
SOURCE DIVERSITY — volumen no es diversidad
===========================================================

Veinte documentos del mismo medio no son veinte fuentes. Es
obvio dicho asi, y sin embargo la primera lectura real de
Cuenca declaraba «7 fuentes» cuando la mayor de ellas era
YouTube —una plataforma, no un emisor— con el 40 % del corpus.

QUE MIDE Y QUE NO
-----------------------------------------------------------

Mide la composicion del CORPUS OBSERVADO. Nada mas.

Cada proporcion que sale de aqui se etiqueta «% del corpus
observado». Nunca «% de la ciudadania», «% de la conversacion»
ni «% de Cuenca». La diferencia no es de matiz: el corpus son
las notas que estas consultas trajeron de estos motores, y
convertir eso en un porcentaje de personas es exactamente el
error que produjo la penetracion del 238 % que origino GEO-1,
trasladado de la geografia a la audiencia.

LA CONCENTRACION
-----------------------------------------------------------

Se usa Herfindahl-Hirschman normalizado, que es la medida
estandar de concentracion y se lee directo:

    1.0   todo el corpus de una sola fuente
    0.0   repartido por igual entre todas

No es una nota de calidad. Un corpus concentrado puede ser
correcto —si solo un medio cubre el canton, eso es un hecho del
territorio—. Lo que no se puede es presentarlo como diverso.
===========================================================
*/


/*
-----------------------------------------------------------
UMBRALES DE LECTURA

Declarados aqui para que el consumidor no invente los suyos.
Salen de la lectura habitual del HHI, no de esta plataforma.
-----------------------------------------------------------
*/

export const UMBRALES_CONCENTRACION = Object.freeze({
  ALTA: 0.25,
  MODERADA: 0.15
});


export function leerConcentracion(hhi) {
  if (hhi >= UMBRALES_CONCENTRACION.ALTA) return "alta";

  if (hhi >= UMBRALES_CONCENTRACION.MODERADA) return "moderada";

  return "baja";
}


/*
===========================================================
MEDIR
===========================================================

`clasificacionPorFuente` es un Map id -> {clase}. Si falta, las
proporciones por clase salen `null` en lugar de cero: no saber
la clase de una fuente no la convierte en NO_DETERMINADO, la
deja sin medir.
===========================================================
*/

export function medirDiversidad(evidencias = [], opciones = {}) {
  const clasificacion = opciones.clasificacionPorFuente || null;

  const resolverFuente =
    opciones.resolverFuente ||
    ((ev) => ev.dominioPublicador || ev.dominio || ev.fuente || null);

  const conteo = new Map();

  let sinFuente = 0;

  evidencias.forEach((ev) => {
    const id = resolverFuente(ev);

    if (!id) {
      sinFuente += 1;

      return;
    }

    conteo.set(id, (conteo.get(id) || 0) + 1);
  });

  const total = evidencias.length;

  const conFuente = total - sinFuente;

  const entradas = [...conteo.entries()].sort((a, b) => b[1] - a[1]);

  /*
    ---------------------------------------------------------
    EMISORES vs PLATAFORMAS

    Se cuentan aparte. Una plataforma en el reparto infla la
    diversidad: aloja a muchos emisores que no sabemos cuales
    son, y contarla como uno solo tampoco es correcto. Se
    declara y se saca del calculo de emisores.
    ---------------------------------------------------------
  */
  const plataformas = entradas.filter(([id]) => esPlataforma(id));

  const emisores = entradas.filter(([id]) => !esPlataforma(id));

  const evidenciasEnPlataforma = plataformas.reduce((s, [, n]) => s + n, 0);

  const evidenciasDeEmisor = emisores.reduce((s, [, n]) => s + n, 0);

  /* --- HHI normalizado sobre EMISORES --- */
  let hhi = null;

  if (emisores.length > 0 && evidenciasDeEmisor > 0) {
    const bruto = emisores.reduce((s, [, n]) => {
      const cuota = n / evidenciasDeEmisor;

      return s + cuota * cuota;
    }, 0);

    /*
      Normalizado para que no dependa del numero de fuentes:
      con una sola fuente el bruto ya vale 1 y el normalizado
      tambien debe valer 1.
    */
    const k = emisores.length;

    hhi = k > 1 ? (bruto - 1 / k) / (1 - 1 / k) : 1;
  }

  /* --- reparto por clase --- */
  let porClase = null;

  if (clasificacion) {
    porClase = {};

    entradas.forEach(([id, n]) => {
      const c = clasificacion.get?.(id)?.clase || CLASES_FUENTE.NO_DETERMINADO;

      porClase[c] = (porClase[c] || 0) + n;
    });
  }

  const cuota = (clase) => {
    if (!porClase || !total) return null;

    return Number(((porClase[clase] || 0) / total).toFixed(3));
  };

  const dominante = emisores[0] || null;

  return {
    totalEvidencias: total,

    /*
      `totalFuentes` cuenta TODO lo que aparece como origen,
      plataformas incluidas. Es el numero que se venia
      enseñando y se conserva para no romper nada, pero ya no
      es el que hay que leer.
    */
    totalFuentes: entradas.length,

    /*
      El que hay que leer. Emisores reales, sin plataformas.
    */
    fuentesIndependientes: emisores.length,

    plataformas: plataformas.length,
    evidenciasEnPlataforma,
    evidenciasSinFuente: sinFuente,

    concentracionFuente: hhi === null ? null : Number(hhi.toFixed(3)),
    lecturaConcentracion: hhi === null ? null : leerConcentracion(hhi),

    fuenteDominante: dominante
      ? {
          id: dominante[0],
          evidencias: dominante[1],
          cuotaDelCorpus: conFuente
            ? Number((dominante[1] / conFuente).toFixed(3))
            : null
        }
      : null,

    distribucionTipoFuente: porClase,

    /* --- cuotas preparadas, siempre sobre el corpus --- */
    mediaShare: cuota(CLASES_FUENTE.MEDIO),
    communityShare: cuota(CLASES_FUENTE.CIUDADANIA_COMUNIDAD),
    institutionShare: cuota(CLASES_FUENTE.INSTITUCION),
    creatorShare: cuota(CLASES_FUENTE.CREADOR),

    unidadDeMedida: "% del corpus observado",

    declaraciones: [
      "Todas las proporciones son «% del corpus observado». NUNCA «% de la ciudadanía»: el corpus son las notas que estas consultas trajeron de estos motores.",
      "Una plataforma no cuenta como emisor. Aloja a emisores que este módulo no identifica, y contarla como una fuente inflaría la diversidad.",
      "Concentración alta no es un defecto: si un solo medio cubre el cantón, eso es un hecho del territorio. Lo que no se puede es llamarlo diverso."
    ],

    limitacion:
      plataformas.length > 0
        ? `${evidenciasEnPlataforma} de ${total} evidencias llegan a través de ${plataformas.length} plataforma(s). Sus emisores reales no están identificados.`
        : null
  };
}


/*
===========================================================
AGENDAS SEPARADAS POR TIPO DE FUENTE
===========================================================

El motor debe poder devolver el corpus partido por naturaleza
de quien publica. La interfaz completa vendra despues; lo que
hace falta ya es que la separacion EXISTA en la salida, porque
fusionar primero y separar despues no es posible: una vez
mezcladas, no se sabe cual venia de donde.

CINCO AGENDAS
-----------------------------------------------------------

    CIUDADANA      colectivos y comunidades observables
    MEDIATICA      medios
    INSTITUCIONAL  administracion publica
    CREADORES      creadores identificados
    DIGITAL        plataformas y web publica

DIGITAL no es «lo que pasa en redes». Es lo que llego por
plataforma sin emisor identificado. La distincion importa:
llamarlo «agenda digital» y leerlo como opinion social seria
inventar un sujeto que no se ha observado.
===========================================================
*/

export const AGENDAS = Object.freeze({
  CIUDADANA: "AGENDA_CIUDADANA",
  MEDIATICA: "AGENDA_MEDIATICA",
  INSTITUCIONAL: "AGENDA_INSTITUCIONAL",
  CREADORES: "AGENDA_CREADORES",
  DIGITAL: "AGENDA_DIGITAL",
  SIN_CLASIFICAR: "SIN_CLASIFICAR"
});


const CLASE_A_AGENDA = Object.freeze({
  [CLASES_FUENTE.CIUDADANIA_COMUNIDAD]: AGENDAS.CIUDADANA,
  [CLASES_FUENTE.MEDIO]: AGENDAS.MEDIATICA,
  [CLASES_FUENTE.INSTITUCION]: AGENDAS.INSTITUCIONAL,
  [CLASES_FUENTE.CREADOR]: AGENDAS.CREADORES,
  [CLASES_FUENTE.WEB_PUBLICA]: AGENDAS.DIGITAL,
  [CLASES_FUENTE.ORGANIZACION]: AGENDAS.SIN_CLASIFICAR,
  [CLASES_FUENTE.CANDIDATO]: AGENDAS.SIN_CLASIFICAR,
  [CLASES_FUENTE.NO_DETERMINADO]: AGENDAS.SIN_CLASIFICAR
});


export const ETIQUETAS_AGENDA = Object.freeze({
  AGENDA_CIUDADANA: "Agenda ciudadana / comunitaria",
  AGENDA_MEDIATICA: "Agenda mediática",
  AGENDA_INSTITUCIONAL: "Agenda institucional",
  AGENDA_CREADORES: "Agenda de creadores",
  AGENDA_DIGITAL: "Agenda digital",
  SIN_CLASIFICAR: "Fuente sin clasificar"
});


export function separarCorpusPorAgenda(evidencias = [], opciones = {}) {
  const clasificacion = opciones.clasificacionPorFuente || null;

  const resolverFuente =
    opciones.resolverFuente ||
    ((ev) => ev.dominioPublicador || ev.dominio || ev.fuente || null);

  const porAgenda = {};

  Object.values(AGENDAS).forEach((a) => {
    porAgenda[a] = [];
  });

  evidencias.forEach((ev, i) => {
    const id = resolverFuente(ev);

    const clase = id ? clasificacion?.get?.(id)?.clase : null;

    const agenda = clase ? CLASE_A_AGENDA[clase] : AGENDAS.SIN_CLASIFICAR;

    porAgenda[agenda || AGENDAS.SIN_CLASIFICAR].push({
      indice: ev.indice ?? i,
      evidencia: ev,
      fuenteId: id,
      clase: clase || CLASES_FUENTE.NO_DETERMINADO
    });
  });

  const metricas = {};

  Object.entries(porAgenda).forEach(([a, lista]) => {
    metricas[a] = {
      evidencias: lista.length,
      fuentes: new Set(lista.map((x) => x.fuenteId).filter(Boolean)).size,

      cuotaDelCorpus: evidencias.length
        ? Number((lista.length / evidencias.length).toFixed(3))
        : 0,

      unidadDeMedida: "% del corpus observado"
    };
  });

  /*
    Una agenda con muy pocas evidencias no se puede leer como
    agenda. Se declara antes de que nadie la interprete.
  */
  const MINIMO_LEGIBLE = 3;

  const noLegibles = Object.entries(metricas)
    .filter(([a, m]) => a !== AGENDAS.SIN_CLASIFICAR && m.evidencias > 0 && m.evidencias < MINIMO_LEGIBLE)
    .map(([a, m]) => `${ETIQUETAS_AGENDA[a]}: ${m.evidencias} evidencia(s)`);

  return {
    porAgenda,
    metricas,
    etiquetas: ETIQUETAS_AGENDA,
    minimoLegible: MINIMO_LEGIBLE,

    declaracion:
      "El corpus se separa por la NATURALEZA de quien publica. «Agenda digital» significa «llegó por plataforma sin emisor identificado», no «lo que se dice en redes».",

    limitaciones: [
      metricas[AGENDAS.SIN_CLASIFICAR].evidencias > 0
        ? `${metricas[AGENDAS.SIN_CLASIFICAR].evidencias} evidencia(s) de fuentes sin clasificar no entran en ninguna agenda.`
        : null,

      noLegibles.length
        ? `Agendas por debajo de ${MINIMO_LEGIBLE} evidencias, no legibles como agenda: ${noLegibles.join("; ")}.`
        : null,

      "Ninguna de estas agendas mide opinión ciudadana. Miden publicación."
    ].filter(Boolean)
  };
}


export default {
  UMBRALES_CONCENTRACION,
  AGENDAS,
  ETIQUETAS_AGENDA,
  medirDiversidad,
  separarCorpusPorAgenda,
  leerConcentracion
};
