// apps/backend/services/conversation/stopConcepts.js

import { tokenizar, normalizarTexto } from "../textUtils.js";

/*
===========================================================
STOP-CONCEPTS — lo que NUNCA es un tema
===========================================================

Un tema tiene que ser algo de lo que se habla. Estas cinco
familias no lo son, y las cinco aparecieron en datos reales de
Cuenca:

  1. EL TERRITORIO ANALIZADO y sus ancestros
     Medido: «cuenca» produjo un tema con 15 de 24 evidencias,
     y despues «azuay · capital · provincia · ciudad» con 6.
     Es el criterio de busqueda devuelto como hallazgo: todas
     las evidencias lo mencionan porque se busco por el.

  2. DESCRIPTORES ADMINISTRATIVOS
     «capital», «provincia», «ciudad», «canton». Describen la
     unidad territorial, no lo que ocurre en ella.

  3. FECHAS
     Medido: «clima · pronostico · tiempo · agosto». El mes no
     es un descriptor tematico. Tampoco los dias de la semana.

  4. EL PUBLICADOR
     Medido: «elmercurio» como tema con 4 evidencias. Quien
     publica es una dimension real —el registro de medios la
     mide— pero es OTRA pregunta.

  5. TERMINOS DE LA PROPIA CONSULTA
     Si el planner emitio «Cuenca municipio alcaldia», esas
     tres palabras estaran en casi todo lo recolectado por esa
     via. Convertirlas en tema es circular.

QUE NO SE EXCLUYE
-----------------------------------------------------------

El lexico de dominio. Si «alcaldia» pertenece a la categoria
declarada «Gestion y gobernanza», sigue contando ALLI. Lo que
se prohibe es que esas palabras formen un tema EMERGENTE por
si solas.

La distincion importa: excluirlas del todo perderia la
categoria mas frecuente del corpus.
===========================================================
*/


/*
-----------------------------------------------------------
DESCRIPTORES ADMINISTRATIVOS Y GEOGRAFICOS GENERICOS
-----------------------------------------------------------
*/

export const DESCRIPTORES_ADMINISTRATIVOS = Object.freeze([
  "capital",
  "provincia",
  "provincial",
  "ciudad",
  "ciudadano",
  "ciudadana",
  "canton",
  "cantonal",
  "parroquia",
  "parroquial",
  "urbana",
  "urbano",
  "rural",
  "sector",
  "barrio",
  "region",
  "regional",
  "sierra",
  "costa",
  "austro",
  "territorio",
  "territorial",
  "localidad",
  "poblacion",
  "habitantes"
]);


export const MESES = Object.freeze([
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre"
]);


export const DIAS = Object.freeze([
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
  "feriado",
  "fin de semana",
  "semana",
  "mes",
  "trimestre"
]);


/*
  Palabras de estructura periodistica. No describen un tema:
  describen que alguien dijo algo.
*/
export const ESTRUCTURALES = Object.freeze([
  "dijo",
  "senalo",
  "indico",
  "afirmo",
  "aseguro",
  "explico",
  "informo",
  "manifesto",
  "sostuvo",
  "agrego",
  "destaco",
  "declaro",
  "expreso",
  "comento",
  "durante",
  "tras",
  "segun",
  "ademas",
  "tambien",
  "mientras",
  "luego",
  "ayer",
  "hoy",
  "manana",
  "dias",
  "dia",
  "ano",
  "anos",
  "hora",
  "horas",
  "millones",
  "mil",
  "dolares",
  "ciento",
  "nuevo",
  "nueva",
  "nuevos",
  "nuevas",
  "gran",
  "grandes",
  "mejor",
  "peor",
  "primer",
  "primera",
  "ultimo",
  "ultima",
  "noticias",
  "noticia",
  "video",
  "fotos",
  "galeria",
  "resumen",
  "entrevista"
]);


/*
===========================================================
CONSTRUIR EL CONJUNTO PARA UN ANALISIS CONCRETO
===========================================================

Las tres primeras familias son fijas. Las dos ultimas dependen
del analisis: que territorio se pidio y que consultas se
lanzaron.
===========================================================
*/

export function construirStopConcepts({
  ambito = null,
  consultas = [],
  evidencias = [],
  extra = []
} = {}) {
  const fuera = new Set();

  const anadir = (texto, minimo = 3) => {
    tokenizar(String(texto || ""), minimo).forEach((t) => fuera.add(t));
  };

  /* 2, 3 y estructurales: fijos. */
  [...DESCRIPTORES_ADMINISTRATIVOS, ...MESES, ...DIAS, ...ESTRUCTURALES].forEach(
    (t) => fuera.add(normalizarTexto(t))
  );

  /*
    1. EL TERRITORIO Y SUS ANCESTROS.

    No basta con el nombre del ambito: «Azuay» y «Ecuador» son
    ancestros y aparecieron en el cluster defectuoso medido.
  */
  const territoriales = [];

  if (ambito) {
    territoriales.push(ambito.nombre, ...(ambito.alias || []), ...(ambito.ancestros || []));
  }

  territoriales.filter(Boolean).forEach((t) => anadir(t, 3));

  /*
    5. TERMINOS DE LA CONSULTA.

    Lo que el planner puso en la query aparecera en casi todo lo
    que esa query devuelva. Es circular por construccion.
  */
  (consultas || []).forEach((c) => anadir(c?.texto || c, 4));

  /*
    4. EL PUBLICADOR.

    Se toma de las propias evidencias, no de un catalogo: asi
    tambien quedan fuera los medios que el registro aun no
    conoce.
  */
  (evidencias || []).forEach((e) => {
    if (e?.fuenteDeclarada) anadir(String(e.fuenteDeclarada).replace(/\./g, " "), 3);

    if (e?.dominio) anadir(String(e.dominio).replace(/\./g, " "), 3);
  });

  extra.forEach((t) => anadir(t, 3));

  return fuera;
}


/*
===========================================================
COMPROBAR SI UNA ETIQUETA ES SOLO RESIDUO

Un tema emergente cuyos terminos son TODOS stop-concepts no es
un tema: es residuo. Se comprueba sobre la etiqueta completa,
no termino a termino, porque un tema legitimo puede contener
alguno.

Ejemplo real: «clima · pronostico · tiempo · agosto» tiene un
termino excluido (agosto) y tres que no lo son. No es residuo
puro; lo que falla ahi es otra cosa —contenido automatizado—,
y se resuelve en contentTypeClassifier.
===========================================================
*/

export function esResiduoPuro(terminos = [], stop) {
  const lista = (terminos || []).filter(Boolean);

  if (lista.length === 0) return true;

  return lista.every((t) => stop.has(normalizarTexto(t)));
}


export default {
  DESCRIPTORES_ADMINISTRATIVOS,
  MESES,
  DIAS,
  ESTRUCTURALES,
  construirStopConcepts,
  esResiduoPuro
};
