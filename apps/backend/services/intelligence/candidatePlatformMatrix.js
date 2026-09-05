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
  LA MISMA capa canonica que usan `digitalPresenceIndex.js` y
  `projectStore.js`. Se reutiliza a proposito: una segunda
  normalizacion en paralelo es como aparecen dos verdades para
  el mismo activo.
*/
import { resolverIdentidadCanonica } from "./accountIdentity.js";


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
===========================================================
EL ORDEN DE AGREGACION — CANDIDATE-MULTI-ASSET-UX-RESOLUTION-02
===========================================================

LO QUE HACIA MAL
-----------------------------------------------------------

La version anterior ordenaba TODOS los snapshots de la
plataforma por fecha y se quedaba con el primero:

    snapshots.filter(...).sort(por fecha desc)[0]

Es decir: «el snapshot mas reciente de la plataforma». Con un
solo activo da el resultado correcto por casualidad. Con dos, da
el del activo que se observo mas tarde y descarta el otro.

El caso que lo demostro es Juan Cristobal Lloret en Instagram:

    instagram:jotalloretv        10.822   2026-08-31
    instagram:lloretvaldivieso      360   2026-09-03  <- ganaba

La celda mostraba 360 y ocultaba 10.822. No es que el numero
fuera impreciso: es que la plataforma tenia dos activos y la
celda solo hablaba de uno.

EL ORDEN CORRECTO
-----------------------------------------------------------

    1. por CADA activo -> su snapshot valido mas reciente
    2. DESPUES -> agregar los activos

Es exactamente el orden que `digitalPresenceIndex.js` ya usaba
para IPDO. Esta funcion no inventa una segunda semantica: la
copia, con la misma canonicalizacion antes de agrupar.

POR QUE SE CANONICALIZA ANTES DE AGRUPAR
-----------------------------------------------------------

Porque `x:JuanCVegaEC` y `x:juancvegaec` son EL MISMO activo, y
agrupar por el id crudo los contaria dos veces —o, como pasaba
aqui, no encontraria la medicion y la celda quedaria sin cubrir
aunque el dato existiera persistido—.

Se reutiliza `resolverIdentidadCanonica`, la misma capa que usan
IPDO y `projectStore`. NO se crea una segunda normalizacion, y
el id crudo se conserva en `accountIdOriginal`: la evidencia
historica no se reescribe.
===========================================================
*/

/*
  Los activos de la ficha, con su clave canonica calculada y el id
  original intacto. Dos activos que canonicalizan igual son UNO:
  se funden y se conservan los dos ids crudos.
*/
function normalizarActivos(cuentas = []) {
  const porClave = new Map();

  for (const c of cuentas) {
    const clave = resolverIdentidadCanonica(c.id);

    if (!clave) continue;

    const previo = porClave.get(clave);

    if (previo) {
      /*
        MISMO activo escrito de dos formas. No se duplica: se
        registran los dos ids crudos y se conserva la senal de
        identidad mas fuerte de las dos.
      */
      previo.idsOriginales.push(c.id);

      previo.declaradaPorAnalista =
        previo.declaradaPorAnalista || c.declaradaPorAnalista === true;

      previo.corroboradaPorSentinel =
        previo.corroboradaPorSentinel || c.corroboradaPorSentinel === true;

      previo.descubiertaPorSentinel =
        previo.descubiertaPorSentinel || c.descubiertaPorSentinel === true;

      continue;
    }

    porClave.set(clave, {
      accountId: clave,
      accountIdOriginal: c.id,
      idsOriginales: [c.id],
      handle: c.handle || null,
      url: c.url || null,
      declaradaPorAnalista: c.declaradaPorAnalista === true,
      descubiertaPorSentinel: c.descubiertaPorSentinel === true,
      corroboradaPorSentinel: c.corroboradaPorSentinel === true,
      correspondencia: c.correspondencia ?? null
    });
  }

  return [...porClave.values()];
}


/*
  Los snapshots de una plataforma con su clave canonica. Igual que
  arriba: se calcula, no se reescribe.
*/
function normalizarSnapshots(snapshots = [], plataforma) {
  return snapshots
    .filter((s) => s.platform === plataforma || s.plataformaId === plataforma)
    .map((s) => ({ ...s, claveCanonica: resolverIdentidadCanonica(s.accountId) }));
}


/*
  UN ACTIVO, UNA METRICA. El snapshot de medicion real mas
  reciente de ESE activo, o `null`.

  `null` nunca es 0: un snapshot `CUENTA_CONFIRMADA` confirma que
  la cuenta existe y no mide nada, y eso no son cero seguidores.
*/
function metricaDeActivo(activo, snapsPlataforma) {
  const suyos = snapsPlataforma
    .filter((s) => s.claveCanonica === activo.accountId)
    .filter((s) => ESTADOS_CON_METRICA.has(s.estado))
    .filter((s) => s.followers != null);

  if (!suyos.length) {
    return {
      accountId: activo.accountId,
      accountIdOriginal: activo.accountIdOriginal,
      handle: activo.handle,
      url: activo.url,
      valor: null,
      capturedAt: null,
      provider: null,
      estado: null
    };
  }

  const ultimo = suyos.reduce((mejor, s) =>
    new Date(s.capturedAt) > new Date(mejor.capturedAt) ? s : mejor
  );

  return {
    accountId: activo.accountId,
    accountIdOriginal: activo.accountIdOriginal,
    handle: activo.handle,
    url: activo.url,
    valor: Number(ultimo.followers),
    capturedAt: ultimo.capturedAt || null,
    provider: ultimo.provider || null,
    estado: ultimo.estado || null
  };
}


export const METODOS_AGREGACION = Object.freeze({
  ACTIVO_UNICO: "ACTIVO_UNICO",
  SUMA_DE_ACTIVOS: "SUMA_DE_ACTIVOS"
});


/*
  LA AGREGACION DE LA PLATAFORMA.

  Se suma dentro de la MISMA plataforma y la MISMA familia
  metrica. Nunca entre plataformas: un suscriptor de YouTube y un
  seguidor de TikTok no son la misma unidad, y sumarlos daria una
  audiencia inventada.

  Y la suma NO son personas. Dos cuentas del mismo candidato
  comparten seguidores, asi que el total es «seguidores
  acumulados entre N activos observados», no alcance ni audiencia
  unica. La etiqueta se construye aqui para que la UI no pueda
  nombrarlo de otra forma.
*/
function agregadoDeCelda(plataforma, snapsPlataforma, activosValidos) {
  const nombre = ETIQUETA_SEGUIDORES[plataforma] || "seguidores";

  const porActivo = activosValidos.map((a) => metricaDeActivo(a, snapsPlataforma));

  const conValor = porActivo.filter((a) => a.valor != null);

  if (!conValor.length) {
    return {
      metrica: null,
      porActivo
    };
  }

  const total = conValor.reduce((suma, a) => suma + a.valor, 0);

  const acumulado = conValor.length > 1;

  const metodo = acumulado
    ? METODOS_AGREGACION.SUMA_DE_ACTIVOS
    : METODOS_AGREGACION.ACTIVO_UNICO;

  /*
    La observacion mas antigua de las que componen el total. Si el
    agregado mezcla un snapshot de hace una semana con otro de
    hoy, hay que poder decirlo.
  */
  const fechas = conValor.map((a) => a.capturedAt).filter(Boolean).sort();

  return {
    metrica: {
      nombre,

      valor: total,

      metodo,

      acumulado,

      activosConMetrica: conValor.length,

      activosTotal: activosValidos.length,

      /* La frase exacta que puede leerse en pantalla. */
      etiqueta: acumulado
        ? `${total.toLocaleString("es-EC")} ${nombre} acumulados entre ${conValor.length} activos observados`
        : `${total.toLocaleString("es-EC")} ${nombre}`,

      noEs: acumulado
        ? "Suma de cuentas distintas del mismo candidato. Los seguidores pueden solaparse entre cuentas: NO son personas únicas, ni alcance, ni audiencia única."
        : null,

      /* Compatibilidad: con un solo activo, de quien es el dato. */
      accountId: conValor.length === 1 ? conValor[0].accountId : null,

      capturedAt: conValor.length === 1 ? conValor[0].capturedAt : null,

      provider: conValor.length === 1 ? conValor[0].provider : null,

      estado: conValor.length === 1 ? conValor[0].estado : null,

      observadoDesde: fechas[0] || null,

      observadoHasta: fechas[fechas.length - 1] || null
    },

    porActivo
  };
}


/*
  MEDICIONES SIN ACTIVO QUE CASE.

  Antes de este gate eran 4 en el piloto, y todas eran
  ARTIFICIALES: `youtube:@yakuperez4230` frente a
  `youtube:yakuperez4230`, `x:JuanCVegaEC` frente a
  `x:juancvegaec`, y el canal de Paul Carrasco por su alias
  channelId/handle, que `LEGACY_ACCOUNT_ALIASES` ya conocia.

  Con la clave canonica desaparecen las cuatro. El campo se
  conserva porque un desajuste REAL —una medicion de una cuenta
  que no esta en la ficha— sigue siendo posible y hay que verlo,
  no descartarlo en silencio.
*/
function medicionesSinActivo(snapsPlataforma, activosValidos) {
  const claves = new Set(activosValidos.map((a) => a.accountId));

  const sueltas = snapsPlataforma.filter(
    (s) => s.accountId && !claves.has(s.claveCanonica)
  );

  if (!sueltas.length) return null;

  return {
    total: new Set(sueltas.map((s) => s.claveCanonica)).size,
    accountIds: [...new Set(sueltas.map((s) => s.accountId))],
    clavesCanonicas: [...new Set(sueltas.map((s) => s.claveCanonica))],
    activosDeLaFicha: [...claves],
    motivo:
      "Existe medición persistida cuyo activo no está en la ficha de identidad, ni siquiera resolviendo su forma canónica. No es ausencia de medición: es una cuenta observada que nadie ha atribuido."
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
    espera como `accountId`. Se traduce aqui, en un solo sitio, y
    la clave que se usa es la CANONICA.

    Canonicalizar antes de clasificar es lo que hace que
    `activoCubierto` encuentre la medicion: comparaba
    `x:JuanCVegaEC` de la ficha contra `x:juancvegaec` del
    snapshot y no casaban, asi que la celda quedaba sin cubrir
    aunque el dato estuviera persistido.

    El id crudo se conserva en `accountIdOriginal`. La evidencia
    historica no se reescribe.
  */
  const activos = normalizarActivos(cuentas);

  const snapsDePlataforma = normalizarSnapshots(snapshots, plataforma).map((s) => ({
    ...s,
    accountId: s.claveCanonica,
    accountIdOriginal: s.accountId
  }));

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

  /*
    AQUI ESTA EL ARREGLO: primero cada activo, despues la suma.
    Nunca «el snapshot mas reciente de la plataforma».
  */
  const agregado = agregadoDeCelda(plataforma, snapsDePlataforma, activosValidos);

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

    /*
      CADA ACTIVO, CON SU PROPIA METRICA Y SU PROPIA EVIDENCIA.

      La celda ya no esconde los activos detras de una cifra: cada
      uno conserva su id canonico, su id crudo, su handle, su URL,
      su estado de identidad, su valor, cuando se observo y por
      que via. Un activo sin medir aparece con `valor: null`, que
      no es cero.
    */
    activos: activosValidos.map((a) => {
      const m = agregado.porActivo.find((x) => x.accountId === a.accountId);

      return {
        accountId: a.accountId,
        accountIdOriginal: a.accountIdOriginal,
        idsOriginales: a.idsOriginales,
        handle: a.handle,
        url: a.url,
        identityState: identidadDeCuenta(a, conflictosConocidos),
        metrica: m
          ? {
              nombre: ETIQUETA_SEGUIDORES[plataforma] || "seguidores",
              valor: m.valor,
              capturedAt: m.capturedAt,
              provider: m.provider,
              estado: m.estado
            }
          : null
      };
    }),

    activosTotal: celda.activosTotal ?? activosValidos.length,
    activosCubiertos: celda.activosCubiertos ?? 0,

    /* Cuantos activos distintos tiene la celda, ya deduplicados. */
    assetCount: activosValidos.length,

    metrica: agregado.metrica,

    snapshots: snapsDePlataforma.length,

    medicionesSinActivo: medicionesSinActivo(snapsDePlataforma, activosValidos)
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

  /*
    Las 4 «huerfanas» del gate anterior eran artificiales: el
    mismo activo escrito de dos formas. Con la clave canonica
    desaparecen, y esta limitacion solo aparece si el desajuste
    es REAL —una cuenta observada que nadie ha atribuido—.
  */
  const sinActivo = filas.reduce(
    (n, f) =>
      n + PLATAFORMAS_MATRIZ.filter((p) => f.celdas[p].medicionesSinActivo).length,
    0
  );

  if (sinActivo) {
    limitaciones.push({
      id: "MEDICION_SIN_ACTIVO_ATRIBUIDO",
      celdasAfectadas: sinActivo,
      texto:
        "Hay celdas con medición persistida cuyo activo no está en la ficha de identidad, ni siquiera resolviendo su forma canónica. Es una cuenta observada que nadie ha atribuido."
    });
  }

  /*
    Cuantas celdas agregan mas de un activo. Se declara porque el
    numero visible de esas celdas es una SUMA, y una suma de
    cuentas del mismo candidato no son personas unicas.
  */
  const celdasAgregadas = filas.reduce(
    (n, f) =>
      n +
      PLATAFORMAS_MATRIZ.filter((p) => f.celdas[p].metrica?.acumulado === true)
        .length,
    0
  );

  if (celdasAgregadas) {
    limitaciones.push({
      id: "AGREGACION_MULTI_ACTIVO",
      celdasAfectadas: celdasAgregadas,
      texto:
        "En las celdas con varios activos medidos, la cifra es la suma de los seguidores de cada cuenta. Los seguidores pueden solaparse entre cuentas del mismo candidato: no son personas únicas, ni alcance, ni audiencia única."
    });
  }

  limitaciones.push({
    id: "DISCOVERY_NO_PERSISTIDO",
    texto:
      "No se persiste evidencia de que un discovery se haya ejecutado por plataforma, así que una celda sin activos se cierra como IDENTIDAD_INSUFICIENTE y nunca como SIN_CUENTA. Es deliberado: lo contrario fabricaría la conclusión de que el candidato no tiene cuenta."
  });

  limitaciones.push({
    id: "IDENTITY_EXCLUSION_PERSISTENCE_DEBT",
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
      version: "1.1",

      fuente:
        "socialBenchmarkMatrix.clasificarCeldaConIdentidad + operationalClosure.cerrarCelda, las funciones certificadas por P-CAND-OPERATIONAL-CLOSURE-01",

      identidadNoEsMedicion:
        "`identidad` dice de quién es el activo; `medicion` dice si podemos medirlo. Un activo declarado por el analista tiene identidad fuerte aunque su medición esté bloqueada.",

      /*
        El orden importa y se declara, porque invertirlo es el
        defecto que corrige CANDIDATE-MULTI-ASSET-UX-RESOLUTION-02.
      */
      ordenDeAgregacion: [
        "1. resolver la clave canónica de cada activo y de cada snapshot",
        "2. por CADA activo, quedarse con su snapshot de medición más reciente",
        "3. DESPUÉS sumar los activos de la misma plataforma y la misma familia métrica"
      ],

      agregacion:
        "La cifra de una celda con varios activos medidos es la SUMA de sus seguidores, no el valor del activo observado más recientemente.",

      identidadCanonica:
        "Se reutiliza accountIdentity.resolverIdentidadCanonica, la misma capa que usan digitalPresenceIndex y projectStore. El accountId crudo se conserva en accountIdOriginal: la evidencia no se reescribe.",

      prohibido: [
        "sumar métricas entre plataformas",
        "sumar familias métricas distintas (seguidores + suscriptores, likes + vistas)",
        "convertir una ausencia de métrica en 0",
        "ordenar candidatos por número de celdas medidas",
        "leer «resueltas» como «medidas»",
        "llamar audiencia única, alcance o personas a la suma de varios activos",
        "elegir un solo snapshot de toda la plataforma en lugar de agregar por activo"
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
  METODOS_AGREGACION,
  celdaDePlataforma,
  coberturaDeCandidato,
  matrizDePlataformasDelProyecto
};
