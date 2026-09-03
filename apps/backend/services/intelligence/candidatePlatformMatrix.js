/*
===========================================================
MATRIZ CANONICA DE PLATAFORMAS — CANDIDATE-STRATEGIC-UX-01B
===========================================================

READ MODEL. Solo lee. No observa, no persiste, no sale a la red
y no consume cuota de ningun proveedor.

POR QUE EXISTE
-----------------------------------------------------------

Porque la taxonomia operacional certificada por
P-CAND-OPERATIONAL-CLOSURE-01 vivia en dos funciones puras
—`clasificarCeldaConIdentidad` y `cerrarCelda`— que NINGUNA
ruta ni servicio llamaba. Solo las invocaba su propio test
unitario, con fixtures sinteticos.

El resultado es que la interfaz no tenia forma de mostrar esos
estados, y acabo mostrando los de `/linea-base`, que responden
a otra pregunta.

QUE HACE Y QUE NO HACE
-----------------------------------------------------------

Reutiliza las dos funciones canonicas SIN TOCARLAS. Su unico
trabajo es reunir las entradas que ya estan persistidas
—activos de la ficha de identidad y snapshots— y llamarlas por
cada una de las 35 celdas.

NO reimplementa la clasificacion. Si manana `cerrarCelda`
cambia, esta matriz cambia con ella.

LAS DOS PREGUNTAS SON DISTINTAS, Y ESO NO ES UN DEFECTO
-----------------------------------------------------------

`/linea-base` responde «¿que publicaciones observamos?».
Esta matriz responde «¿que activos tenemos resueltos y cuales
podemos medir?».

Un candidato puede tener publicaciones observadas en X y ningun
snapshot de su cuenta de X. Las dos afirmaciones son ciertas y
no se contradicen: hablan de objetos distintos.
===========================================================
*/

import {
  fichaIdentidad,
  snapshotsDe
} from "../projects/projectStore.js";

import {
  clasificarCeldaConIdentidad,
  identidadDeCuenta,
  IDENTITY_STATES,
  PLATAFORMAS_BENCHMARK
} from "./socialBenchmarkMatrix.js";

import { cerrarCelda, ESTADOS_CIERRE } from "./operationalClosure.js";


/*
  Las cinco de la metodologia canonica. Se reexporta la lista de
  `socialBenchmarkMatrix` en lugar de escribir otra: dos listas
  que se pueden desincronizar son una fuente de fallos.
*/
export const PLATAFORMAS_MATRIZ = PLATAFORMAS_BENCHMARK;


/*
  Estados de medicion real, tal como los define
  `socialBenchmarkMatrix`. Se replican aqui SOLO para decidir de
  que snapshot sale la metrica visible; la clasificacion sigue
  siendo suya.
*/
const ESTADOS_CON_METRICA = new Set([
  "OBSERVADA",
  "MEDIDO_OFICIAL",
  "MEDIDO_PROPIO_AUTORIZADO",
  "MEDIDO_PROVEEDOR"
]);


/*
  Como se llama la metrica de seguidores en cada plataforma. Un
  suscriptor de YouTube no es un seguidor de X, y llamarlos igual
  invita a compararlos.
*/
export const ETIQUETA_SEGUIDORES = Object.freeze({
  facebook: "seguidores",
  instagram: "seguidores",
  tiktok: "seguidores",
  x: "seguidores",
  youtube: "suscriptores"
});


/*
  La metrica compacta de una celda: el snapshot mas reciente de un
  activo VALIDO que traiga un valor real.

  Tres reglas:

    solo de activos que casan con la ficha;
    solo de snapshots con estado de medicion real;
    `null` cuando no hay valor, nunca 0.
*/
function metricaDeCelda(plataforma, snapshots, activosValidos) {
  const ids = new Set(activosValidos.map((a) => a.accountId));

  const candidatas = snapshots
    .filter((s) => ids.has(s.accountId))
    .filter((s) => ESTADOS_CON_METRICA.has(s.estado))
    .filter((s) => s.followers != null)
    .sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));

  if (!candidatas.length) return null;

  const s = candidatas[0];

  return {
    nombre: ETIQUETA_SEGUIDORES[plataforma] || "seguidores",
    valor: Number(s.followers),
    accountId: s.accountId,
    capturedAt: s.capturedAt || null,
    provider: s.provider || null,
    estado: s.estado || null,
    /*
      Cuantos activos de esta celda tienen metrica. Si hay dos
      cuentas y solo una medida, el numero visible es de UNA, y
      hay que poder decirlo.
    */
    activosConMetrica: new Set(candidatas.map((c) => c.accountId)).size
  };
}


/*
  MEDICIONES HUERFANAS.

  Snapshots de esta plataforma cuyo `accountId` no casa con
  ningun activo de la ficha. Es un hecho observable, no una
  reinterpretacion: existe una medicion persistida que la
  clasificacion no puede usar porque la clave no coincide.

  En el piloto pasa en YouTube y en X. La ficha guarda
  `youtube:yakuperez4230` y el snapshot `youtube:@yakuperez4230`;
  para Paul Carrasco la ficha guarda el id de canal
  `youtube:ucxp6...` y el snapshot el handle.

  Se SURFACEA en lugar de arreglarse. Normalizar la clave cambia
  semantica de identidad y de persistencia, y eso no es de este
  gate. Pero ocultarlo haria que la celda dijera «sin via
  disponible» mientras hay 857 suscriptores medidos.
*/
function medicionesHuerfanas(snapshots, activos) {
  const ids = new Set(activos.map((a) => a.accountId));

  const huerfanas = snapshots.filter((s) => s.accountId && !ids.has(s.accountId));

  if (!huerfanas.length) return null;

  const claves = [...new Set(huerfanas.map((s) => s.accountId))];

  return {
    total: claves.length,
    accountIds: claves,
    activosDeLaFicha: [...ids],
    motivo:
      "Existe medición persistida cuyo accountId no coincide con ningún activo de la ficha, así que la clasificación no puede usarla. No es ausencia de medición: es una clave que no casa."
  };
}


/*
===========================================================
UNA CELDA
===========================================================
*/
export function celdaDePlataforma({
  plataforma,
  cuentas = [],
  snapshots = [],
  conflictosConocidos = new Set()
}) {
  /*
    La ficha nombra la clave del activo `id`; el clasificador la
    espera como `accountId`. Se traduce aqui, en un solo sitio.
  */
  const activos = cuentas.map((c) => ({
    accountId: c.id,
    handle: c.handle || null,
    url: c.url || null,
    declaradaPorAnalista: c.declaradaPorAnalista === true,
    descubiertaPorSentinel: c.descubiertaPorSentinel === true,
    corroboradaPorSentinel: c.corroboradaPorSentinel === true,
    correspondencia: c.correspondencia ?? null
  }));

  const snapsDePlataforma = snapshots.filter((s) => s.platform === plataforma);

  /*
    `discoveryConfirmada` va SIEMPRE en false, y es deliberado.

    El contrato de `clasificarCelda` lo dice explicitamente:
    solo puede ser `true` si un discovery para ESTA plataforma se
    ejecuto de verdad y no encontro cuenta, y «si no hay
    evidencia de que se ejecuto, debe llegar false: NUNCA se
    asume».

    Hoy esa evidencia NO se persiste en ningun sitio. Pasarlo en
    true convertiria «no tenemos semilla» en «no tiene cuenta»,
    que es exactamente la conclusion fabricada que
    P-CAND-SOCIAL-BENCH-02A prohibio.
  */
  const celda = clasificarCeldaConIdentidad({
    activos,
    snapshots: snapsDePlataforma,
    discoveryConfirmada: false,
    conflictosConocidos
  });

  const cerrada = cerrarCelda({
    plataforma,
    celda,
    identidadDominante: celda.identidadDominante
  });

  const activosValidos = activos.filter(
    (a) =>
      identidadDeCuenta(a, conflictosConocidos) !== IDENTITY_STATES.IDENTITY_CONFLICT
  );

  return {
    plataforma,

    /*
      LOS DOS EJES, SEPARADOS. Una cuenta puede tener identidad
      fuerte y medicion imposible, y al reves. Mezclarlos hacia
      que «no verificada» pareciera decir que el analista se
      habia equivocado.
    */
    identidad: {
      estado: celda.identidadDominante || IDENTITY_STATES.NO_ASSET_CONFIRMED,
      porActivo: celda.identidadPorActivo || [],
      conflictos: celda.activosConConflicto || [],
      tieneConflicto: celda.tieneConflictoDeIdentidad === true
    },

    medicion: {
      estado: cerrada.estadoCierre,
      estadoPrevio: celda.estado,
      motivo: cerrada.motivoCierre || celda.motivo || null
    },

    activos: activosValidos.map((a) => ({
      accountId: a.accountId,
      handle: a.handle,
      url: a.url,
      identityState: identidadDeCuenta(a, conflictosConocidos)
    })),

    activosTotal: celda.activosTotal ?? activosValidos.length,
    activosCubiertos: celda.activosCubiertos ?? 0,

    metrica: metricaDeCelda(plataforma, snapsDePlataforma, activosValidos),

    snapshots: snapsDePlataforma.length,

    medicionesHuerfanas: medicionesHuerfanas(snapsDePlataforma, activosValidos)
  };
}


/*
===========================================================
COBERTURA DE UN CANDIDATO
===========================================================

§12 del gate: «Cobertura 5/5» era potencialmente enganoso.

Lo era. `/linea-base` daba 5/5 para Paul Carrasco, y la matriz
canonica dice que dos de sus cinco plataformas no tienen
medicion utilizable. «5/5 medidas» afirmaba algo que no se
habia medido.

Se separan las dos cuentas:

    RESUELTAS   la celda tiene un estado operacional explicito.
                Son siempre 5 de 5: eso es lo que el cierre
                garantiza, y por si solo no dice nada del
                candidato.

    MEDIDAS     hay medicion real. Solo MEDIDO cuenta; PARCIAL
                no, porque parcial significa que falta algo.
===========================================================
*/
export function coberturaDeCandidato(celdas) {
  const valores = PLATAFORMAS_MATRIZ.map((p) => celdas[p]);

  const medidas = valores.filter(
    (c) => c.medicion.estado === ESTADOS_CIERRE.MEDIDO
  ).length;

  const parciales = valores.filter(
    (c) => c.medicion.estado === ESTADOS_CIERRE.PARCIAL
  ).length;

  const resueltas = valores.filter((c) => !!c.medicion.estado).length;

  return {
    medidas,
    parciales,
    resueltas,
    objetivo: PLATAFORMAS_MATRIZ.length,

    /* La frase se construye aqui para que no se invente en la UI. */
    expresionMedidas: `${medidas} de ${PLATAFORMAS_MATRIZ.length} medidas`,
    expresionResueltas: `${resueltas} de ${PLATAFORMAS_MATRIZ.length} resueltas`,

    porcentaje: null,
    notaPorcentaje:
      "No se expresa en porcentaje: eso supondría que las cinco plataformas pesan igual, y no hay metodología aprobada que lo sostenga.",

    noEs:
      "Resueltas NO significa medidas. Una celda resuelta puede ser SIN_CUENTA o IDENTIDAD_INSUFICIENTE: significa que sabemos por qué no hay medición, no que la haya."
  };
}


/*
===========================================================
LA MATRIZ DEL PROYECTO — 7 CANDIDATOS x 5 PLATAFORMAS
===========================================================
*/
export async function matrizDePlataformasDelProyecto(entrada = {}) {
  const {
    projectId,
    candidatos = [],
    conflictosConocidos = new Set()
  } = entrada;

  if (!projectId) {
    return {
      ok: false,
      motivo: "se requiere projectId: la matriz es siempre de un proyecto",
      candidatos: [],
      plataformas: PLATAFORMAS_MATRIZ
    };
  }

  const filas = [];

  const distribucion = {};

  const distribucionIdentidad = {};

  for (const cand of candidatos) {
    const ficha = await fichaIdentidad(projectId, cand.id, "candidato");

    if (!ficha) continue;

    const snapshots = (await snapshotsDe(projectId, cand.id)) || [];

    const celdas = {};

    for (const plataforma of PLATAFORMAS_MATRIZ) {
      const bloque = (ficha.plataformas || []).find(
        (p) => (p.plataformaId || p.id) === plataforma
      );

      const celda = celdaDePlataforma({
        plataforma,
        cuentas: bloque?.cuentas || [],
        snapshots,
        conflictosConocidos
      });

      celdas[plataforma] = celda;

      distribucion[celda.medicion.estado] =
        (distribucion[celda.medicion.estado] || 0) + 1;

      distribucionIdentidad[celda.identidad.estado] =
        (distribucionIdentidad[celda.identidad.estado] || 0) + 1;
    }

    filas.push({
      candidateId: cand.id,
      nombre: cand.nombre,
      foto: cand.foto || null,
      celdas,
      cobertura: coberturaDeCandidato(celdas)
    });
  }

  const totalCeldas = filas.length * PLATAFORMAS_MATRIZ.length;

  /*
    Lo que esta matriz NO sabe. Se declara en la respuesta para
    que la interfaz no tenga que adivinarlo ni omitirlo.
  */
  const limitaciones = [];

  const huerfanas = filas.reduce(
    (n, f) =>
      n +
      PLATAFORMAS_MATRIZ.filter((p) => f.celdas[p].medicionesHuerfanas).length,
    0
  );

  if (huerfanas) {
    limitaciones.push({
      id: "ACCOUNT_ID_SIN_CASAR",
      celdasAfectadas: huerfanas,
      texto:
        "Hay celdas con medición persistida cuyo accountId no coincide con ningún activo de la ficha. La clasificación no puede usarla, así que esas celdas parecen menos medidas de lo que están."
    });
  }

  limitaciones.push({
    id: "DISCOVERY_NO_PERSISTIDO",
    texto:
      "No se persiste evidencia de que un discovery se haya ejecutado por plataforma, así que una celda sin activos se cierra como IDENTIDAD_INSUFICIENTE y nunca como SIN_CUENTA. Es deliberado: lo contrario fabricaría la conclusión de que el candidato no tiene cuenta."
  });

  limitaciones.push({
    id: "CONFLICTOS_NO_PERSISTIDOS",
    texto:
      "Los conflictos de identidad revisados por una persona no tienen almacenamiento: `conflictosConocidos` llega vacío en cualquier ejecución. Una exclusión decidida en un gate anterior no puede reproducirse hoy."
  });

  return {
    ok: true,

    proyectoId: projectId,

    plataformas: PLATAFORMAS_MATRIZ,

    candidatos: filas,

    distribucion,

    distribucionIdentidad,

    totalCeldas,

    celdasResueltas: Object.values(distribucion).reduce((a, b) => a + b, 0),

    limitaciones,

    contrato: {
      version: "1.0",
      fuente:
        "socialBenchmarkMatrix.clasificarCeldaConIdentidad + operationalClosure.cerrarCelda, las funciones certificadas por P-CAND-OPERATIONAL-CLOSURE-01",
      identidadNoEsMedicion:
        "`identidad` dice de quién es el activo; `medicion` dice si podemos medirlo. Un activo declarado por el analista tiene identidad fuerte aunque su medición esté bloqueada.",
      prohibido: [
        "sumar métricas entre plataformas",
        "convertir una ausencia de métrica en 0",
        "ordenar candidatos por número de celdas medidas",
        "leer «resueltas» como «medidas»"
      ]
    },

    /*
      El aislamiento se DECLARA, igual que en Media: la matriz es
      siempre de un proyecto y ninguna fila puede venir de otro.
    */
    aislamiento: {
      projectId,
      candidatosDelProyecto: filas.length
    }
  };
}


export default {
  PLATAFORMAS_MATRIZ,
  ETIQUETA_SEGUIDORES,
  celdaDePlataforma,
  coberturaDeCandidato,
  matrizDePlataformasDelProyecto
};
