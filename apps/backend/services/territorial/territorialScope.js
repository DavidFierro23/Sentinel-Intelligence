// apps/backend/services/territorial/territorialScope.js

/*
===========================================================
ALCANCE TERRITORIAL DE UNA PIEZA — TERRITORIAL-SOURCE-COVERAGE-01
===========================================================

Distingue cuatro situaciones que hasta ahora colapsaban en dos.

EL PROBLEMA MEDIDO
-----------------------------------------------------------

En TERRITORIAL-ACCELERATION-02, 98 de 177 evidencias quedaron
sin territorio resuelto. La causa no era el resolutor: el
universo RSS incluye medios NACIONALES —Expreso, Extra,
Teleamazonas, Plan V— cuyos articulos no mencionan Cuenca.

Con solo dos estados —«resuelto» y «no resuelto»— esas 98
piezas se leen igual que una nota ilegible. Y no son lo mismo:

    una nota de El Mercurio sin toponimo
        la publica un medio con redaccion en Cuenca

    una nota de Expreso sin toponimo
        la publica un medio nacional

La primera es MUY probablemente local y no se puede demostrar.
La segunda probablemente no lo es. Tratarlas igual pierde
informacion; tratarlas como Cuenca inventa geografia.

LA REGLA QUE NO SE ROMPE
-----------------------------------------------------------

NINGUNA de las dos se cuenta como Cuenca.

`territorioAtribuible` es `true` SOLO en el caso A. En B y C
vale `false`, y la interfaz tiene que decir «fuente local /
territorio de la pieza no demostrado» en lugar de pintar un
numero sobre el canton.

Lo que B aporta no es geografia: es una PISTA sobre la fuente,
util para priorizar lectura humana y para medir cuanto se nos
escapa. Eso se puede decir. «Pasa en Cuenca» no.
===========================================================
*/


export const ALCANCES = Object.freeze({
  /*
    A · La propia pieza sostiene el territorio: hay toponimo, o
    la fuente declaro la ubicacion. Es el UNICO que cuenta.
  */
  TERRITORIO_EXPLICITO: "TERRITORIO_EXPLICITO",

  /*
    B · La publica un medio con territorio declarado, pero la
    pieza no lo menciona. Pista sobre la fuente, NO sobre el
    contenido.
  */
  FUENTE_LOCAL_SIN_TERRITORIO: "FUENTE_LOCAL_SIN_TERRITORIO",

  /*
    C · Medio de ambito nacional dentro del universo del
    proyecto, sin territorio en la pieza. Se observa porque su
    feed es legible, no porque cubra el canton.
  */
  NACIONAL_RELACIONADO: "NACIONAL_RELACIONADO",

  /*
    D · Ni la pieza ni la fuente sostienen nada.
  */
  TERRITORIO_NO_RESOLUBLE: "TERRITORIO_NO_RESOLUBLE"
});


export const ETIQUETAS = Object.freeze({
  [ALCANCES.TERRITORIO_EXPLICITO]: "Territorio explícito en la pieza",
  [ALCANCES.FUENTE_LOCAL_SIN_TERRITORIO]:
    "Fuente local · territorio de la pieza no demostrado",
  [ALCANCES.NACIONAL_RELACIONADO]: "Medio nacional · sin territorio en la pieza",
  [ALCANCES.TERRITORIO_NO_RESOLUBLE]: "Territorio no resoluble"
});


/* Solo A autoriza a contar la pieza en un territorio. */
export function esAtribuible(alcance) {
  return alcance === ALCANCES.TERRITORIO_EXPLICITO;
}


/*
-----------------------------------------------------------
INDICE DE AMBITO POR FUENTE

Del universo de fuentes comprobado: que dominios declararon
territorio y cuales son de ambito nacional.

Se construye a partir de las fichas y NO de la evidencia: que un
medio publique sobre Cuenca no lo hace local, y ese criterio
circular ya esta prohibido en el catalogo semilla.
-----------------------------------------------------------
*/

export function indiceDeAmbito(fichas = []) {
  const porDominio = new Map();

  fichas.forEach((f) => {
    if (!f?.dominio) return;

    porDominio.set(f.dominio, {
      sourceId: f.sourceId || f.dominio,
      nombre: f.nombre || f.dominio,
      tipo: f.tipo || null,
      territorioDeclarado: f.territorioDeclarado || null,
      esLocal: Boolean(f.territorioDeclarado),
      enElUniverso: true
    });
  });

  return porDominio;
}


/*
===========================================================
CLASIFICAR UNA PIEZA
===========================================================

`ubicacion` es lo que devolvio el resolutor territorial para
esta evidencia, o `null` si no resolvio.
===========================================================
*/

export function clasificarAlcance({ evidencia = {}, ubicacion = null, indice = null } = {}) {
  const dominio = evidencia.domain || evidencia.dominio || evidencia.sourceId || null;

  const ficha = indice && dominio ? indice.get(dominio) || null : null;

  /* --- A --- */
  if (ubicacion?.unidadId) {
    return {
      alcance: ALCANCES.TERRITORIO_EXPLICITO,
      etiqueta: ETIQUETAS[ALCANCES.TERRITORIO_EXPLICITO],
      territorioAtribuible: true,

      unidadId: ubicacion.unidadId,
      nivel: ubicacion.nivel || ubicacion.resolucion || null,

      fuente: ficha
        ? { sourceId: ficha.sourceId, nombre: ficha.nombre, esLocal: ficha.esLocal }
        : { sourceId: dominio, nombre: dominio, esLocal: null },

      razones: ubicacion.razones || [],

      declaracion:
        "La propia pieza sostiene el territorio. Es el único caso que se cuenta en el cantón."
    };
  }

  const base = {
    territorioAtribuible: false,
    unidadId: null,
    nivel: null,

    fuente: ficha
      ? { sourceId: ficha.sourceId, nombre: ficha.nombre, esLocal: ficha.esLocal }
      : { sourceId: dominio, nombre: dominio, esLocal: null },

    razones: []
  };

  /* --- B --- */
  if (ficha?.esLocal) {
    return {
      ...base,
      alcance: ALCANCES.FUENTE_LOCAL_SIN_TERRITORIO,
      etiqueta: ETIQUETAS[ALCANCES.FUENTE_LOCAL_SIN_TERRITORIO],

      /*
        El territorio de la FUENTE, que no es el de la pieza. Se
        expone aparte para que nadie lo confunda con `unidadId`.
      */
      territorioDeLaFuente: ficha.territorioDeclarado,

      declaracion:
        "La publica un medio con territorio declarado, pero la pieza no lo menciona. Es una pista sobre la fuente, NO sobre el contenido: no se cuenta en el cantón."
    };
  }

  /* --- C --- */
  if (ficha?.enElUniverso) {
    return {
      ...base,
      alcance: ALCANCES.NACIONAL_RELACIONADO,
      etiqueta: ETIQUETAS[ALCANCES.NACIONAL_RELACIONADO],
      territorioDeLaFuente: null,

      declaracion:
        "Medio de ámbito nacional del universo del proyecto. Se observa porque su feed es legible, no porque cubra el cantón."
    };
  }

  /* --- D --- */
  return {
    ...base,
    alcance: ALCANCES.TERRITORIO_NO_RESOLUBLE,
    etiqueta: ETIQUETAS[ALCANCES.TERRITORIO_NO_RESOLUBLE],
    territorioDeLaFuente: null,

    declaracion:
      dominio
        ? `Ni la pieza ni «${dominio}» sostienen un territorio. No se fuerza ninguno.`
        : "La evidencia no trae dominio ni ubicación: no hay por dónde atribuir."
  };
}


export function resumirAlcance(clasificadas = []) {
  const conteo = {
    [ALCANCES.TERRITORIO_EXPLICITO]: 0,
    [ALCANCES.FUENTE_LOCAL_SIN_TERRITORIO]: 0,
    [ALCANCES.NACIONAL_RELACIONADO]: 0,
    [ALCANCES.TERRITORIO_NO_RESOLUBLE]: 0
  };

  clasificadas.forEach((c) => {
    if (conteo[c.alcance] !== undefined) conteo[c.alcance] += 1;
  });

  const total = clasificadas.length;

  const atribuibles = conteo[ALCANCES.TERRITORIO_EXPLICITO];

  return {
    total,
    porAlcance: conteo,

    /*
      La cifra honesta: cuantas piezas se pueden contar en el
      territorio. No es «cobertura de Cuenca»; es cuantas piezas
      lo demuestran.
    */
    atribuiblesAlTerritorio: atribuibles,

    /*
      Lo que se nos escapa por falta de señal, separado de lo
      que simplemente no es local.
    */
    deFuenteLocalSinDemostrar: conteo[ALCANCES.FUENTE_LOCAL_SIN_TERRITORIO],
    nacionales: conteo[ALCANCES.NACIONAL_RELACIONADO],
    noResolubles: conteo[ALCANCES.TERRITORIO_NO_RESOLUBLE],

    declaraciones: [
      "Solo las piezas con territorio EXPLÍCITO se cuentan en el cantón. Una nota de un medio local sin topónimo NO se atribuye a Cuenca: eso sería inventar geografía.",
      "«Fuente local · territorio no demostrado» es una pista sobre la fuente, no sobre el contenido. Sirve para priorizar lectura humana, no para afirmar dónde pasó algo.",
      "Un medio nacional en el universo se observa porque su feed es legible, no porque cubra el cantón. Su cobertura de Azuay NO está medida.",
      "Estas cuatro cifras suman el corpus. Si no sumaran, alguna pieza se habría descartado en silencio."
    ]
  };
}


export default {
  ALCANCES,
  ETIQUETAS,
  esAtribuible,
  indiceDeAmbito,
  clasificarAlcance,
  resumirAlcance
};
