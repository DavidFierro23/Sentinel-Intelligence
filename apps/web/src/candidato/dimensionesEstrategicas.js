// apps/web/src/candidato/dimensionesEstrategicas.js

/*
===========================================================
CANDIDATE-STRATEGIC-UX-01 — LAS DIMENSIONES ESTRATEGICAS
===========================================================

Traduce lo que el backend YA entrega a las dimensiones con las
que trabaja un estratega. No calcula inteligencia nueva: cada
valor de aqui sale de un campo que ya existe en
`/linea-base`, `/cobertura-meta` o `/inteligencia`.

POR QUE ESTE FICHERO EXISTE
-----------------------------------------------------------

Porque las ocho dimensiones YA estaban construidas en el
backend —`presencia`, `conversacion`, `amplificacion`,
`medios`, `territorio`, `historico`— y la ficha del candidato
no consumia ninguna: ensenaba «Solidez 68/100», que mide
cuanto expediente hay documentado.

El problema nunca fue falta de datos. Era jerarquia.

LA REGLA QUE ORDENA TODO EL FICHERO
-----------------------------------------------------------

Una dimension sin dato NO recibe un numero. Recibe un estado y
el motivo real, tal como lo declara el backend. Un hueco
relleno con un cero o con «estable» es peor que un hueco.

LO QUE ESTE FICHERO SE PROHIBE
-----------------------------------------------------------

    NO construir un indice compuesto por candidato.
    NO ordenar candidatos por completitud.
    NO convertir una ausencia en cero.
    NO inventar tendencia donde no hay serie comparable.
    NO expresar nada en personas ni en votos.
===========================================================
*/

/*
  Las cinco plataformas de la metodologia estandar. LinkedIn y
  la web NO estan aqui a proposito: existen como activos
  declarados, pero no tienen medicion equivalente, asi que
  sumarlos a la matriz 5xN daria una cobertura que no se ha
  medido. Ver `activosAdicionales`.
*/
export const PLATAFORMAS_PRINCIPALES = Object.freeze([
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "youtube"
]);


export const ETIQUETA_PLATAFORMA = Object.freeze({
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  web: "Web"
});


/*
-----------------------------------------------------------
EL ORDEN ES EL DEL PRODUCTO, NO EL DE LOS DATOS

Primero lo que ocurre en sus canales, despues lo que ocurre a
su alrededor, y al final el tiempo. `momentum` va ultimo
porque hoy no existe: si fuera lo primero, la pantalla
empezaria por un hueco.
-----------------------------------------------------------
*/
export const DIMENSIONES = Object.freeze([
  {
    id: "presencia",
    nombre: "Presencia digital",
    corto: "Presencia",
    pregunta: "¿En qué plataformas está y qué publica?"
  },
  {
    id: "conversacion",
    nombre: "Conversación observable",
    corto: "Conversación",
    pregunta: "¿Qué se publica alrededor de su nombre?"
  },
  {
    id: "medios",
    nombre: "Amplificación mediática",
    corto: "Medios",
    pregunta: "¿Qué medios lo publican?"
  },
  {
    id: "territorio",
    nombre: "Territorio",
    corto: "Territorio",
    pregunta: "¿Dónde ocurre, geográficamente?"
  },
  {
    id: "cambio",
    nombre: "Cambio temporal",
    corto: "Cambio",
    pregunta: "¿Qué cambió respecto a la observación anterior?"
  },
  {
    id: "momentum",
    nombre: "Momentum",
    corto: "Momentum",
    pregunta: "¿Está acelerando o desacelerando?"
  }
]);


/*
  Un numero con su unidad, o un estado con su motivo. Nunca las
  dos cosas a medias y nunca un valor sin unidad: «23» no dice
  nada, «23 medios distintos» si.
*/
function medida(valor, unidad, extra = {}) {
  return {
    valor,
    unidad,
    estado: extra.estado || "MEDIDO",
    motivo: extra.motivo || null,
    detalle: extra.detalle || null,
    cargado: true
  };
}


function sinDato(estado, motivo, extra = {}) {
  return {
    valor: null,
    unidad: extra.unidad || null,
    estado,
    motivo,
    detalle: extra.detalle || null,
    cargado: true
  };
}


/*
  La dimension existe y su dato todavia no se ha pedido. NO es
  «sin datos»: decir que no hay conversacion observable cuando
  no se ha mirado seria una afirmacion falsa sobre el candidato.
*/
function noCargado(comoSeCarga) {
  return {
    valor: null,
    unidad: null,
    estado: null,
    motivo: comoSeCarga,
    detalle: null,
    cargado: false
  };
}


/*
===========================================================
1 · PRESENCIA DIGITAL OBSERVABLE
===========================================================

Sale de `linea-base`, que ya resuelve el estado de cada
plataforma. Se expresa en «medidas / objetivo», NUNCA en
porcentaje: el propio backend se niega a darlo, y su motivo es
correcto —no hay metodologia que diga que las cinco plataformas
pesan igual—.
===========================================================
*/
export function presenciaDeBase(base) {
  if (!base?.cobertura) {
    return sinDato("SIN_DATOS", "El candidato no tiene línea base observada.");
  }

  const c = base.cobertura;

  const medidas = Number(c.medidas || 0);

  const objetivo = Number(c.objetivo || PLATAFORMAS_PRINCIPALES.length);

  const sinCuenta = (c.plataformasSinCuenta || []).length;

  const noMedidas = (c.plataformasNoMedidas || []).length;

  /*
    Que falte una plataforma porque el candidato NO TIENE cuenta
    no es un hueco de cobertura nuestro. Se distingue, porque la
    accion que exige es distinta: una se resuelve observando, la
    otra no se resuelve.
  */
  const estado = noMedidas > 0 ? "PARCIAL" : "MEDIDO";

  return medida(medidas, `de ${objetivo} plataformas medidas`, {
    estado,
    detalle: {
      medidas: c.plataformasMedidas || [],
      sinCuenta: c.plataformasSinCuenta || [],
      noMedidas: c.plataformasNoMedidas || [],
      nota: c.notaPorcentaje || null,
      noEs: c.noEs || null
    },
    motivo:
      sinCuenta > 0
        ? `${sinCuenta} plataforma(s) sin cuenta registrada. No es un hueco de observación: es una ausencia del candidato.`
        : null
  });
}


/*
===========================================================
2 · CONVERSACIÓN OBSERVABLE
===========================================================

`inteligencia.conversacion` ya separa la conversacion en planos
—lo que publica el, lo que publican medios, lo que publican
terceros— y prohibe expresarla en personas. Se respeta.
===========================================================
*/
export function conversacionDeInteligencia(intel) {
  if (!intel) {
    return noCargado('Se calcula al abrir «Ver inteligencia».');
  }

  const cv = intel.conversacion;

  if (!cv || !Number(cv.total)) {
    return sinDato(
      "SIN_EVIDENCIA",
      "No hay piezas observadas alrededor de este candidato en las fuentes disponibles."
    );
  }

  const planos = (cv.planos || []).map((p) => ({
    nombre: p.nombre || p.clave || p.id,
    piezas: p.piezasObservadas ?? null,
    definicion: p.definicion || null
  }));

  return medida(Number(cv.total), "piezas observadas", {
    detalle: { planos, prohibicion: cv.prohibicion || null }
  });
}


/*
===========================================================
3 · AMPLIFICACIÓN MEDIÁTICA
===========================================================

Se cuenta en DOMINIOS y en HECHOS DISTINTOS, no en piezas. Diez
cabeceras replicando una nota son un hecho, y contarlas como
diez mediria la sindicacion, no la amplificacion.

La relacion candidato-evidencia la establece el backend. Aqui
no se infiere ninguna.
===========================================================
*/
export function mediosDeInteligencia(intel) {
  if (!intel) {
    return noCargado('Se calcula al abrir «Ver inteligencia».');
  }

  const m = intel.medios;

  const dominios = Number(m?.dominiosDistintos || 0);

  if (!dominios) {
    return sinDato(
      "SIN_EVIDENCIA",
      "Ningún medio del catálogo publicó piezas atribuibles a este candidato."
    );
  }

  const ganada = intel.amplificacion?.ganada || {};

  return medida(dominios, "medios distintos", {
    detalle: {
      locales: m.locales ?? null,
      regionales: m.regionales ?? null,
      nacionales: m.nacionales ?? null,
      desconocidos: m.desconocidos ?? null,
      hechosDistintos: ganada.hechosDistintos ?? null,
      piezas: ganada.piezas ?? null,
      loQueNoSabemos: m.loQueNoSabemos || []
    }
  });
}


/*
===========================================================
4 · TERRITORIO
===========================================================

Hoy da SIN DATOS en el piloto, y el motivo que da el backend es
el correcto: ninguna evidencia trae contrato de GEO-1. Se
muestra ese motivo literal.

Que el proyecto sea Cuenca NO ubica una pieza en Cuenca. Es la
tentacion obvia y seria inventar cobertura territorial.
===========================================================
*/
export function territorioDeInteligencia(intel) {
  if (!intel) {
    return noCargado('Se calcula al abrir «Ver inteligencia».');
  }

  const t = intel.territorio;

  const total = Number(t?.total || 0);

  if (!total) {
    return sinDato(
      "SIN_DATOS",
      t?.nota ||
        "Sin geolocalización verificada no se ubica ninguna evidencia.",
      {
        detalle: {
          rechazados: t?.rechazados ?? null,
          motivosDeRechazo: t?.motivosDeRechazo || null,
          metodosProhibidos: t?.metodosProhibidos || []
        }
      }
    );
  }

  return medida(total, "vínculos territoriales verificados", {
    detalle: { rechazados: t.rechazados ?? null }
  });
}


/*
===========================================================
5 · CAMBIO TEMPORAL
===========================================================

AQUI ESTA EL HALLAZGO MAS IMPORTANTE DEL GATE.

`inteligencia.historico.ventanas[].delta` NO se usa, y no se
puede usar. Para Lloret la ventana de 7 dias declara
`followers: -29053` y la de 30 dias `+334`, sobre periodos que
contienen los mismos hechos. Eso es aritmeticamente imposible
en una serie real de audiencia.

El motivo, comprobado sobre los snapshots del piloto: el delta
resta el ULTIMO snapshot menos el PRIMERO de la ventana, y esos
dos snapshots son de CUENTAS Y PLATAFORMAS DISTINTAS.

    primero  2026-08-26  youtube:jotalloretv           26
    ultimo   2026-09-03  instagram:lloretvaldivieso   360
    -----------------------------------------------------
    delta                                            +334

El «+334» es 360 de una cuenta de Instagram menos 26 de un
canal de YouTube. El «-29.053» de la ventana de 7 dias es esa
misma cuenta de 360 menos los 29.413 seguidores de X.

Pintado en una tarjeta, un estratega leeria «perdio 29.000
seguidores esta semana». No perdio nada: cambio que cuenta se
observo al final.

Asi que el cambio se expresa en lo unico defendible que hay
hoy: CUANTOS ACTIVOS tienen mas de una observacion. Es un
recuento, no una tendencia, y se nombra como tal.
===========================================================
*/
export function cambioDeInteligencia(intel) {
  if (!intel) {
    return noCargado('Se calcula al abrir «Ver inteligencia».');
  }

  const snaps = intel.historico?.snapshots || [];

  /*
    Se agrupa POR CUENTA. Dos snapshots de la misma cuenta son
    comparables entre si; dos snapshots de cuentas distintas no
    lo son, y ese es exactamente el error que se evita.
  */
  const porCuenta = new Map();

  snaps.forEach((s) => {
    const k = s.accountId || s.platform || "?";

    porCuenta.set(k, (porCuenta.get(k) || 0) + 1);
  });

  const activos = porCuenta.size;

  const conSerie = [...porCuenta.values()].filter((n) => n >= 2).length;

  /*
    Series de publicacion: misma publicacion, misma metrica, dos
    o mas observaciones. Estas SI son comparables, porque no
    cruzan de objeto.
  */
  const series = (intel.historico?.metricas?.series || []).filter(
    (s) => s.comparable
  ).length;

  if (!conSerie && !series) {
    return sinDato(
      "HISTORICO_INSUFICIENTE",
      activos
        ? `Los ${activos} activos observados tienen una sola observación. Comparar exige dos.`
        : "Todavía no hay observaciones registradas.",
      { detalle: { activos, conSerie: 0, series: 0 } }
    );
  }

  return medida(conSerie, `de ${activos} activos con más de una observación`, {
    estado: "PARCIAL",
    motivo:
      "Recuento de activos reobservados, no una tendencia. El cambio agregado por candidato no tiene metodología todavía.",
    detalle: { activos, conSerie, series }
  });
}


/*
===========================================================
6 · MOMENTUM
===========================================================

No se implementa nada. Se muestra el estado que declara
`linea-base`, que hoy es HISTORICO_INSUFICIENTE con un motivo
escrito por el backend.

Un «0 %» o un «estable» aqui serian afirmaciones que nadie ha
medido.
===========================================================
*/
export function momentumDeProyecto(momentum) {
  if (!momentum) {
    return sinDato(
      "HISTORICO_INSUFICIENTE",
      "Sentinel todavía no dispone de suficientes ventanas temporales comparables."
    );
  }

  if (momentum.disponible) {
    return medida(momentum.valor ?? null, momentum.unidad || null);
  }

  return sinDato(
    momentum.estado || "HISTORICO_INSUFICIENTE",
    momentum.motivo ||
      "Sentinel todavía no dispone de suficientes ventanas temporales comparables."
  );
}


/*
===========================================================
COBERTURA DE DATOS — EL INDICADOR TECNICO
===========================================================

Era «Solidez 68/100» y era el titular de la ficha. Mide cuanto
expediente digital observable tiene Sentinel: es un indicador
de NUESTRO trabajo, no del candidato.

El calculo NO se toca. Lo que cambia es el nombre, el tamano y
el sitio.
===========================================================
*/
export const COBERTURA_DE_DATOS = Object.freeze({
  nombre: "Cobertura de datos",
  aclaracion:
    "Indicador técnico de información disponible. No mide desempeño electoral.",
  explicacion:
    "Indica cuánto del expediente digital observable dispone Sentinel. No mide desempeño electoral.",
  noEs: Object.freeze([
    "intención de voto",
    "aprobación",
    "popularidad",
    "fuerza electoral",
    "probabilidad electoral"
  ])
});


export function coberturaDeDatos(candidato) {
  const v = candidato?.resumen?.huellaDigital ?? candidato?.cobertura ?? null;

  return v == null ? null : Number(v);
}


/*
===========================================================
IDENTIDAD ≠ MEDICION
===========================================================

Una cuenta que el analista escribio a mano es procedencia
fuerte: sabemos de donde salio. Que Sentinel no la haya
corroborado es una propiedad DE NUESTRA MEDICION, no un defecto
de la cuenta.

En el piloto los 50 activos estan en `NO_VERIFICADA`. Si la
ficha ensena «no verificada» como estado principal, el analista
lee que nada de lo que escribio sirve. Son dos ejes y se
muestran en dos sitios.
===========================================================
*/
export const IDENTIDAD = Object.freeze({
  DECLARED_BY_ANALYST: {
    texto: "Referencia confirmada por analista",
    tono: "bien",
    explica: "La aportó una persona del equipo. Es procedencia, no medición."
  },
  ANALYST_CONFIRMED: {
    texto: "Referencia confirmada por analista",
    tono: "bien",
    explica: "La aportó una persona del equipo. Es procedencia, no medición."
  },
  ASSOCIATED: {
    texto: "Asociada por Sentinel",
    tono: "neutro",
    explica: "Encontrada por el motor y atribuida al candidato."
  },
  CONFLICT: {
    texto: "Conflicto de identidad",
    tono: "alerta",
    explica: "Dos atribuciones incompatibles. Exige decisión humana."
  },
  UNRESOLVED: {
    texto: "Identidad sin resolver",
    tono: "aviso",
    explica: "No hay base suficiente para atribuirla."
  }
});


export const CORROBORACION = Object.freeze({
  NO_VERIFICADA: {
    texto: "Sin corroborar por Sentinel",
    tono: "neutro",
    explica:
      "Nada externo la ha corroborado todavía. No significa que la cuenta sea incorrecta."
  },
  VERIFICADA: {
    texto: "Corroborada por Sentinel",
    tono: "bien",
    explica: "Al menos una fuente independiente la sostiene."
  }
});


export function identidadDeActivo(activo) {
  const rel = activo?.relationshipToCandidate || null;

  return IDENTIDAD[rel] || null;
}


export function corroboracionDeActivo(activo) {
  const v = activo?.verificationStatus || null;

  return CORROBORACION[v] || null;
}


/*
===========================================================
ACTIVOS ADICIONALES — §21
===========================================================

LinkedIn y la web existen en el piloto y NO se borran. Pero no
entran en la matriz principal: no hay medicion equivalente, y
sumarlos daria una cobertura que nadie ha medido.

Se separan y se dice por que.
===========================================================
*/
export function activosAdicionales(entradaPorPlataforma) {
  const pp = entradaPorPlataforma || {};

  return Object.keys(pp)
    .filter((p) => !PLATAFORMAS_PRINCIPALES.includes(p))
    .map((p) => ({
      plataforma: p,
      etiqueta: ETIQUETA_PLATAFORMA[p] || p,
      activos: (pp[p] || []).length
    }))
    .filter((x) => x.activos > 0);
}


export const NOTA_ACTIVOS_ADICIONALES =
  "Declarados y conservados, fuera de la matriz principal: no tienen medición equivalente en las cinco plataformas de la metodología.";


/*
===========================================================
LAS SEIS DIMENSIONES DE UN CANDIDATO
===========================================================
*/
export function dimensionesDeCandidato(entrada = {}) {
  const { base = null, inteligencia = null, momentum = null } = entrada;

  const valores = {
    presencia: presenciaDeBase(base),
    conversacion: conversacionDeInteligencia(inteligencia),
    medios: mediosDeInteligencia(inteligencia),
    territorio: territorioDeInteligencia(inteligencia),
    cambio: cambioDeInteligencia(inteligencia),
    momentum: momentumDeProyecto(momentum)
  };

  return DIMENSIONES.map((d) => ({ ...d, ...valores[d.id] }));
}


/*
  El disclaimer que no se negocia. Se mantiene visible y sin
  alarmismo: es una precision metodologica, no una advertencia
  de peligro.
*/
export const DISCLAIMER =
  "Inteligencia digital observable. No representa intención de voto, aprobación ni predicción electoral.";


/*
  Vocabulario que esta pantalla no puede producir como metrica
  calculada. Se declara aqui para que un test lo pueda leer y
  fallar si alguna vez aparece.
*/
export const VOCABULARIO_PROHIBIDO = Object.freeze([
  "intención de voto",
  "probabilidad de ganar",
  "aprobación",
  "favorabilidad electoral",
  "preferencia electoral",
  "fuerza electoral"
]);
