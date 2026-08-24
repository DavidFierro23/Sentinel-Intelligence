// apps/backend/services/geo/geoContracts.js

/*
===========================================================
GEO INTELLIGENCE ENGINE — CONTRATOS
===========================================================

Fuente unica de verdad sobre PROCEDENCIA, RESOLUCION y la
regla GEO-1. Ningun otro modulo del motor territorial decide
por su cuenta hasta donde puede pintar un dato: lo pregunta
aqui.

Mismo patron que socialContracts.js, y por el mismo motivo: si
la regla vive repartida en cinco archivos, tarde o temprano uno
de ellos la aplica distinto y nadie se entera hasta que el mapa
miente.

DE DONDE SALE ESTO
-----------------------------------------------------------

UX-WR-001 v2.0, CONGELADO. Este archivo no inventa doctrina:
transcribe a codigo ejecutable lo que ese documento fijo en
§0, §1 y §6, y que alli quedo como WR-D1 y WR-D2.

EL PRECEDENTE QUE ORIGINA GEO-1
-----------------------------------------------------------

Informe Meta Ads de la Prefectura del Azuay (27-may a 27-jun
2026). El alcance llegaba a nivel PROVINCIA. Se repartio por
canton segun peso poblacional del INEC y salieron
penetraciones de 134 % y 238 %: imposibles, porque el radio de
segmentacion captaba poblacion de Cuenca y periferia contada
como "Azuay Province".

La cifra era falsa, pero se detecto porque un porcentaje mayor
que 100 chirria. Un mapa no chirria. Un mapa se cree.

    GEO-1 · CONGELADA
    Nunca se pinta mas fino que la resolucion del dato.

===========================================================
*/


/*
-----------------------------------------------------------
RESOLUCIONES TERRITORIALES

Ordenadas de MAS GRUESA a MAS FINA. El rango numerico es lo
que permite comparar dos resoluciones sin escribir una tabla
de casos en cada modulo.

`zona_censal` y `recinto` se declaran aunque hoy no haya dato
que las alcance: forman parte del contrato para que el dia que
lleguen INEC y CNE no haya que renumerar nada.
-----------------------------------------------------------
*/

export const RESOLUCIONES = Object.freeze({
  PAIS: "pais",
  PROVINCIA: "provincia",
  CANTON: "canton",
  PARROQUIA: "parroquia",
  SECTOR: "sector",
  ZONA_CENSAL: "zona_censal",
  RECINTO: "recinto",
  PUNTO: "punto"
});


const RANGO = Object.freeze({
  pais: 1,
  provincia: 2,
  canton: 3,
  parroquia: 4,
  sector: 5,
  zona_censal: 6,
  recinto: 7,
  punto: 8
});


export const ORDEN_RESOLUCIONES = Object.freeze([
  "pais",
  "provincia",
  "canton",
  "parroquia",
  "sector",
  "zona_censal",
  "recinto",
  "punto"
]);


export function rangoDeResolucion(resolucion) {
  return RANGO[String(resolucion || "").toLowerCase()] ?? null;
}


/*
  Comparacion explicita. Devuelve true si `a` es MAS FINA que
  `b`. Se usa en una sola linea del agregador, pero se declara
  aqui porque es la comparacion de la que depende GEO-1.
*/
export function esMasFina(a, b) {
  const ra = rangoDeResolucion(a);
  const rb = rangoDeResolucion(b);

  if (ra === null || rb === null) return false;

  return ra > rb;
}


/*
===========================================================
PROCEDENCIA DE LA UBICACION — WR-D2
===========================================================

Es el equivalente geografico del linaje (DT3) y de
`presencia_inferida` del Social Intelligence Layer: no basta
con saber DONDE esta un dato, hay que saber COMO se supo.

`resolucionMaxima` es la parte operativa. Un dato `derivada`
—resuelto desde un toponimo en un texto— puede sostener una
parroquia, pero jamas un punto: que una nota nombre "El Batan"
no situa el hecho en una esquina.

`agregada` es el caso del informe de Meta Ads: el dato SOLO
existe en su unidad superior. Su resolucion maxima no es una
constante, es la unidad en la que vino, y por eso vale null
aqui: la fija el propio dato y el agregador la respeta.
===========================================================
*/

export const PROCEDENCIAS = Object.freeze({
  DECLARADA: "declarada",
  DERIVADA: "derivada",
  AGREGADA: "agregada",
  DESCONOCIDA: "desconocida"
});


export const CATALOGO_PROCEDENCIAS = Object.freeze([
  {
    id: "declarada",
    nombre: "Declarada",
    significado:
      "El dato trae coordenada o unidad administrativa explicita.",
    resolucionMaxima: "punto",
    marcaVisual: "ancla en punta",
    sePinta: true
  },
  {
    id: "derivada",
    nombre: "Derivada",
    significado:
      "Resuelta desde un toponimo presente en el texto, con confianza declarada.",
    resolucionMaxima: "parroquia",
    marcaVisual: "ancla en punta atenuada",
    sePinta: true
  },
  {
    id: "agregada",
    nombre: "Agregada",
    significado:
      "El dato solo existe en una unidad superior. No se reparte hacia abajo.",
    /*
      null NO significa "sin limite": significa "la fija el
      propio dato". Ver resolucionMaximaDe().
    */
    resolucionMaxima: null,
    marcaVisual: "ancla de base plana",
    sePinta: true
  },
  {
    id: "desconocida",
    nombre: "Desconocida",
    significado:
      "Sin senal de ubicacion. No se pinta: se cuenta aparte y se declara.",
    resolucionMaxima: null,
    marcaVisual: "contador «sin ubicar»",
    sePinta: false
  }
]);


export function procedenciaPorId(id) {
  return (
    CATALOGO_PROCEDENCIAS.find(
      (p) => p.id === String(id || "").toLowerCase()
    ) || null
  );
}


export function esProcedenciaValida(id) {
  return procedenciaPorId(id) !== null;
}


/*
-----------------------------------------------------------
RESOLUCION MAXIMA QUE SOSTIENE UNA UBICACION CONCRETA

No se pregunta por la procedencia en abstracto sino por LA
UBICACION: `agregada` en canton y `agregada` en provincia son
la misma procedencia y sostienen cosas distintas.
-----------------------------------------------------------
*/

export function resolucionMaximaDe(ubicacion = {}) {
  const p = procedenciaPorId(ubicacion.procedencia);

  if (!p) return null;

  if (!p.sePinta) return null;

  if (p.resolucionMaxima) {
    /*
      Una ubicacion `declarada` que solo llego a canton no
      habilita punto: el tope es el menor de los dos.
    */
    return esMasFina(p.resolucionMaxima, ubicacion.resolucion)
      ? ubicacion.resolucion || null
      : p.resolucionMaxima;
  }

  /* `agregada`: manda la unidad en la que vino. */
  return ubicacion.resolucion || null;
}


/*
===========================================================
GEO-1 — LA COMPROBACION
===========================================================

Una sola funcion, invocada desde el agregador. Devuelve
siempre una explicacion, tambien cuando permite: un permiso
sin motivo no se puede auditar.
===========================================================
*/

export const GEO_1 = Object.freeze({
  id: "GEO-1",
  estado: "congelada",
  origen: "UX-WR-001 v2.0 §0 · WR-D1",
  enunciado: "Nunca se pinta mas fino que la resolucion del dato.",
  motivo:
    "Un heatmap por parroquia construido con datos de ciudad no es un mapa: es una invencion con forma de mapa. Y a diferencia de una cifra mal calculada, un mapa se cree."
});


export function comprobarGeo1(ubicacion = {}, resolucionPedida) {
  const procedencia = procedenciaPorId(ubicacion.procedencia);

  if (!procedencia) {
    return {
      permitido: false,
      motivo: `Procedencia "${ubicacion.procedencia}" no reconocida. Sin procedencia declarada no se puede situar nada.`,
      resolucionEfectiva: null,
      regla: GEO_1.id
    };
  }

  if (!procedencia.sePinta) {
    return {
      permitido: false,
      motivo:
        "Ubicacion desconocida: el registro no se pinta, se cuenta en «sin ubicar».",
      resolucionEfectiva: null,
      regla: GEO_1.id
    };
  }

  const maxima = resolucionMaximaDe(ubicacion);

  if (!maxima) {
    return {
      permitido: false,
      motivo:
        "La ubicacion no declara en que unidad territorial existe el dato.",
      resolucionEfectiva: null,
      regla: GEO_1.id
    };
  }

  if (esMasFina(resolucionPedida, maxima)) {
    return {
      permitido: false,
      motivo: `Se pidio resolucion "${resolucionPedida}" sobre un dato de procedencia "${procedencia.id}" que solo llega a "${maxima}". Se agrega en "${maxima}" y se declara.`,
      resolucionEfectiva: maxima,
      regla: GEO_1.id
    };
  }

  return {
    permitido: true,
    motivo: `Procedencia "${procedencia.id}" sostiene hasta "${maxima}"; se pidio "${resolucionPedida}".`,
    resolucionEfectiva: resolucionPedida,
    regla: GEO_1.id
  };
}


/*
===========================================================
NORMALIZACION — §6.3, obligatoria y visible
===========================================================

Comparar Ricaurte (rural, extensa) con El Batan (urbana,
compacta) en valores absolutos pinta de oscuro lo grande o lo
poblado, siempre, y responde a la pregunta equivocada.

`absoluto` no se elimina del catalogo: es legitimo para un
conteo. Lleva aviso permanente porque lo que enganna no es
usarlo, es usarlo creyendo que mide intensidad.
===========================================================
*/

export const NORMALIZACIONES = Object.freeze([
  {
    id: "poblacion",
    nombre: "Poblacion (INEC)",
    campo: "poblacion",
    recomendado: true,
    aviso: null
  },
  {
    id: "padron",
    nombre: "Padron electoral (CNE)",
    campo: "padronElectoral",
    recomendado: false,
    aviso: null
  },
  {
    id: "area",
    nombre: "Superficie (km2)",
    campo: "superficieKm2",
    recomendado: false,
    aviso: null
  },
  {
    id: "absoluto",
    nombre: "Valor absoluto",
    campo: null,
    recomendado: false,
    aviso:
      "Mapa de conteo: refleja tamano y poblacion, no intensidad relativa."
  }
]);


export function normalizacionPorId(id) {
  return (
    NORMALIZACIONES.find((n) => n.id === String(id || "").toLowerCase()) ||
    null
  );
}


/*
===========================================================
UMBRAL MINIMO DE MUESTRA — §6.6, regla 3
===========================================================

Con tres menciones no se colorea un territorio. Bajo el
umbral, la unidad se marca `muestra_insuficiente` en lugar de
pintarse.

Y `muestra insuficiente` NO es `sin dato`, ni `sin dato` es
`cero`. Son tres estados distintos y confundirlos es el mismo
error que separa `bloqueado` de `0 resultados` en el Search
Provider Layer.
===========================================================
*/

export const UMBRAL_MUESTRA_POR_DEFECTO = 5;


export const ESTADOS_UNIDAD = Object.freeze({
  CON_DATO: "con_dato",
  MUESTRA_INSUFICIENTE: "muestra_insuficiente",
  SIN_DATO: "sin_dato"
});


export const TRATAMIENTO_VISUAL = Object.freeze({
  con_dato: "rampa secuencial de un solo tono",
  muestra_insuficiente: "hachurado 45 grados con etiqueta",
  /*
    Nunca el tono mas claro de la rampa. "Casi cero" y "no
    sabemos" no pueden parecerse.
  */
  sin_dato: "hachurado 45 grados, distinto de la rampa"
});


/*
===========================================================
VALIDACION DE UNA UBICACION
===========================================================
*/

export function validarUbicacion(ubicacion) {
  const errores = [];

  if (!ubicacion || typeof ubicacion !== "object") {
    return { valida: false, errores: ["ubicacion ausente o no es un objeto"] };
  }

  if (!esProcedenciaValida(ubicacion.procedencia)) {
    errores.push(
      `procedencia invalida: "${ubicacion.procedencia}". Admitidas: ${Object.values(
        PROCEDENCIAS
      ).join(", ")}.`
    );
  }

  const p = procedenciaPorId(ubicacion.procedencia);

  if (p?.sePinta) {
    if (!ubicacion.resolucion) {
      errores.push(
        "una ubicacion que se pinta debe declarar en que resolucion existe el dato"
      );
    } else if (rangoDeResolucion(ubicacion.resolucion) === null) {
      errores.push(`resolucion desconocida: "${ubicacion.resolucion}"`);
    }

    if (!ubicacion.unidadId) {
      errores.push("falta unidadId: sin unidad no hay nada que agregar");
    }
  }

  return { valida: errores.length === 0, errores };
}


/*
===========================================================
DECLARACION PUBLICA DEL CONTRATO

La consume la ruta de diagnostico. Un contrato que solo existe
en el codigo no lo puede auditar quien lee la respuesta.
===========================================================
*/

export function declararContrato() {
  return {
    version: "1.0",
    origen: "UX-WR-001 v2.0 (congelado) §0, §1, §6",

    reglas: [GEO_1],

    resoluciones: ORDEN_RESOLUCIONES.map((r) => ({
      id: r,
      rango: RANGO[r]
    })),

    procedencias: CATALOGO_PROCEDENCIAS,

    normalizaciones: NORMALIZACIONES,

    umbralMuestraPorDefecto: UMBRAL_MUESTRA_POR_DEFECTO,

    estadosUnidad: ESTADOS_UNIDAD,

    loQueEsteMotorNoHace: [
      "No desagrega nunca por debajo de la resolucion declarada del dato.",
      "No estima un denominador que no tiene: si falta la poblacion, lo declara.",
      "No afirma causa. La atribucion se detiene en contribucion y secuencia (WR-D13).",
      "No pinta lo que no puede ubicar: lo cuenta en «sin ubicar» y lo declara."
    ]
  };
}


export default {
  RESOLUCIONES,
  ORDEN_RESOLUCIONES,
  PROCEDENCIAS,
  CATALOGO_PROCEDENCIAS,
  NORMALIZACIONES,
  ESTADOS_UNIDAD,
  TRATAMIENTO_VISUAL,
  UMBRAL_MUESTRA_POR_DEFECTO,
  GEO_1,
  rangoDeResolucion,
  esMasFina,
  procedenciaPorId,
  esProcedenciaValida,
  resolucionMaximaDe,
  comprobarGeo1,
  normalizacionPorId,
  validarUbicacion,
  declararContrato
};
