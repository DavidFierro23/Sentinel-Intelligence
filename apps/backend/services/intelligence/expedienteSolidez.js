// apps/backend/services/intelligence/expedienteSolidez.js

/*
===========================================================
SOLIDEZ DEL EXPEDIENTE — FORMULA REVISADA
===========================================================

EL DEFECTO QUE ESTO CORRIGE

`indiceHuellaDigital` se calcula sobre `cuentasObjetivo`: las
cuentas atribuidas EN ESA EJECUCION. Sus cuatro componentes
—cobertura, solidez, corroboracion y declaracion— dependen todos
de esa lista.

Consecuencia medida: cuando un buscador no devolvio una cuenta
que ya estaba consolidada, la cuenta salio de `cuentasObjetivo` y
la cifra cayo. Con las mismas cuentas conocidas, el mismo
expediente marco 53, luego 42. Nada habia cambiado en la
identidad del candidato; habia cambiado lo que un buscador
devolvio ese dia.

    absence of evidence != evidence of absence

Un resultado que un buscador no devuelve no es una cuenta que
deje de existir. Penalizar el expediente por eso convierte la
metrica en un termometro del humor de SerpAPI.

-----------------------------------------------------------
LA SEPARACION
-----------------------------------------------------------

    SOLIDEZ DE IDENTIDAD      cuanto sabemos, sostenido en el
                              INVENTARIO CONSOLIDADO, que no
                              pierde cuentas

    REENCONTRABILIDAD ACTUAL  cuanto de eso volvimos a ver en la
                              ultima ejecucion

Son dos preguntas distintas y las dos importan. Lo que no se
puede hacer es multiplicar una por la otra, porque entonces la
segunda —que mide a nuestros proveedores— contamina a la
primera, que mide al expediente.

La reencontrabilidad NO se resta de la solidez. Se muestra al
lado.

-----------------------------------------------------------
Y NO ES UN SCORE POLITICO
-----------------------------------------------------------

Mide la calidad de NUESTRO trabajo de documentacion, no al
candidato. Un candidato con expediente flojo puede ser muy
conocido; lo unico que dice un 30/100 es que Sentinel ha
documentado poco.
===========================================================
*/


/* Las siete plataformas de la ficha. */
const PLATAFORMAS_BASE = 7;


/*
  Estados del inventario que cuentan como conocimiento vigente.
  NO_REENCONTRADA cuenta: sigue siendo una cuenta que sabemos que
  existe. REVOCADA no, porque el analista la retiro.
*/
const VIGENTES = new Set([
  "CONSOLIDADA",
  "REVALIDADA",
  "ATRIBUIDA",
  "DECLARADA_POR_ANALISTA",
  "NO_REENCONTRADA_EN_ULTIMA_VERIFICACION",
  /* Estados de resolucion, para poder alimentarse de ambos modelos. */
  "CORROBORADA",
  "DECLARADA",
  "CANDIDATA",
  "NO_REENCONTRADA"
]);


const RETIRADAS = new Set(["REVOCADA", "DESCARTADA"]);


/*
===========================================================
SOLIDEZ DE IDENTIDAD

Cuatro componentes, 100 puntos, calculados SOBRE EL INVENTARIO
CONSOLIDADO. Ninguno mira si el buscador respondio hoy.
===========================================================
*/
export function solidezDeIdentidad(cuentas = []) {
  const vivas = (cuentas || []).filter(
    (c) => !RETIRADAS.has(String(c.estado)) && VIGENTES.has(String(c.estado))
  );

  const componentes = [];

  /*
    1 · COBERTURA — 35 puntos.

    Plataformas distintas con al menos una cuenta en el
    inventario. Del inventario, no de la ultima corrida: una
    cuenta consolidada cuenta aunque hoy no se reencontrara.
  */
  const plataformas = new Set(vivas.map((c) => c.plataformaId).filter(Boolean));

  const cobertura = Math.round((plataformas.size / PLATAFORMAS_BASE) * 35);

  componentes.push({
    id: "cobertura",
    nombre: "Cobertura de plataformas",
    valor: cobertura,
    maximo: 35,
    detalle: `${plataformas.size} de ${PLATAFORMAS_BASE} plataformas con al menos una cuenta en el inventario consolidado.`,
    dependeDeLaUltimaEjecucion: false
  });

  /*
    2 · CORROBORACION INDEPENDIENTE — 35 puntos.

    Proporcion de cuentas con al menos una senal independiente
    del nombre. Es el componente que mas dice: una cuenta sin
    senal independiente es una hipotesis, no un hallazgo.
  */
  const conSenal = vivas.filter(
    (c) =>
      (c.senalesIndependientes || []).length > 0 ||
      (c.proveedoresHistoricos || []).length > 1 ||
      c.corroboradaPorSentinel === true
  ).length;

  const corroboracion = vivas.length
    ? Math.round((conSenal / vivas.length) * 35)
    : 0;

  componentes.push({
    id: "corroboracion",
    nombre: "Corroboracion independiente",
    valor: corroboracion,
    maximo: 35,
    detalle: `${conSenal} de ${vivas.length} cuenta(s) sostenidas por al menos una senal independiente del nombre.`,
    dependeDeLaUltimaEjecucion: false
  });

  /*
    3 · PROCEDENCIA DOCUMENTADA — 15 puntos.

    Cuentas de las que se sabe COMO llegaron: declaradas o con
    proveedor registrado. Una cuenta sin procedencia es un dato
    huerfano.
  */
  const conProcedencia = vivas.filter(
    (c) =>
      c.declaradaPorAnalista === true ||
      (c.proveedoresHistoricos || c.proveedores || []).length > 0
  ).length;

  const procedencia = vivas.length
    ? Math.round((conProcedencia / vivas.length) * 15)
    : 0;

  componentes.push({
    id: "procedencia",
    nombre: "Procedencia documentada",
    valor: procedencia,
    maximo: 15,
    detalle: `${conProcedencia} de ${vivas.length} cuenta(s) con procedencia registrada.`,
    dependeDeLaUltimaEjecucion: false
  });

  /*
    4 · PERSISTENCIA HISTORICA — 15 puntos.

    Cuentas observadas en mas de un momento distinto. Es lo que
    distingue un hallazgo sostenido de uno de un solo dia.

    Las cuentas heredadas de antes del contrato longitudinal no
    tienen `firstSeenAt`; no se penalizan a ciegas ni se premian:
    se declaran como historia incompleta.
  */
  const sostenidas = vivas.filter(
    (c) => c.firstSeenAt && c.lastSeenAt && c.firstSeenAt !== c.lastSeenAt
  ).length;

  const sinHistoria = vivas.filter((c) => !c.firstSeenAt).length;

  const medibles = vivas.length - sinHistoria;

  const persistencia = medibles
    ? Math.round((sostenidas / medibles) * 15)
    : 0;

  componentes.push({
    id: "persistencia",
    nombre: "Persistencia historica",
    valor: persistencia,
    maximo: 15,
    detalle: medibles
      ? `${sostenidas} de ${medibles} cuenta(s) con historia medible observadas en mas de un momento.`
      : "Ninguna cuenta tiene historia medible todavia: el expediente es anterior al contrato longitudinal o solo tiene una observacion.",
    historiaIncompleta: sinHistoria,
    dependeDeLaUltimaEjecucion: false
  });

  const valor = componentes.reduce((s, c) => s + c.valor, 0);

  return {
    version: "2.0",

    valor,
    maximo: 100,

    componentes,

    formula:
      "Cobertura de plataformas 35 + Corroboracion independiente 35 + Procedencia documentada 15 + Persistencia historica 15. Todo se calcula sobre el INVENTARIO CONSOLIDADO, que no pierde cuentas cuando un buscador no las devuelve.",

    explicacion: `${valor}/100 — ` +
      componentes.map((c) => `${c.nombre} ${c.valor}/${c.maximo}`).join(" · "),

    cuentasConsideradas: vivas.length,
    cuentasRetiradas: (cuentas || []).length - vivas.length,

    /* Dicho aqui, no en la interfaz, para que no se olvide. */
    noEs: [
      "No es un score politico ni una medida del candidato: mide cuanto ha documentado Sentinel.",
      "No mide audiencia ni influencia.",
      "No baja porque un buscador falle: ningun componente depende de la ultima ejecucion."
    ]
  };
}


/*
===========================================================
REENCONTRABILIDAD ACTUAL

Metrica de OBSERVABILIDAD, no de identidad. Responde a «cuanto
de lo que sabemos volvimos a ver», que es una pregunta sobre
nuestros proveedores.

Se publica aparte y con su propia advertencia. Nunca se resta de
la solidez.
===========================================================
*/
export function reencontrabilidadActual(cuentas = []) {
  const vivas = (cuentas || []).filter(
    (c) => !RETIRADAS.has(String(c.estado))
  );

  if (!vivas.length) {
    return {
      valor: null,
      total: 0,
      reencontradas: 0,
      motivo: "No hay cuentas en el inventario, asi que no hay nada que reencontrar."
    };
  }

  const comprobadas = vivas.filter((c) => c.lastCheckedAt);

  if (!comprobadas.length) {
    return {
      valor: null,
      total: vivas.length,
      reencontradas: 0,
      motivo:
        "Ninguna cuenta se ha verificado todavia. Sin verificacion no hay reencontrabilidad que medir: `null`, no 0."
    };
  }

  const reencontradas = comprobadas.filter(
    (c) => c.seenInCurrentRun === true || c.lastSeenAt === c.lastCheckedAt
  ).length;

  const valor = Math.round((reencontradas / comprobadas.length) * 100);

  return {
    valor,
    maximo: 100,

    total: vivas.length,
    comprobadas: comprobadas.length,
    reencontradas,

    formula:
      "Cuentas reencontradas en la ultima verificacion dividido por cuentas verificadas, en porcentaje.",

    interpretacion:
      valor === 100
        ? "Todas las cuentas verificadas se volvieron a observar."
        : `${comprobadas.length - reencontradas} cuenta(s) no se reencontraron en la ultima verificacion.`,

    /* La frase entera del gate, escrita donde importa. */
    advertencia:
      "Esta cifra mide a NUESTROS PROVEEDORES, no al candidato ni al expediente. Una cuenta que un buscador no devuelve no es una cuenta que haya dejado de existir: la ausencia de evidencia no es evidencia de ausencia. Por eso NO se resta de la solidez del expediente.",

    motivo: null
  };
}


/*
  Las dos cifras juntas y separadas, que es como hay que verlas.
*/
export function solidezDelExpediente(cuentas = []) {
  return {
    identidad: solidezDeIdentidad(cuentas),
    reencontrabilidad: reencontrabilidadActual(cuentas),

    relacion:
      "Son dos metricas independientes. La solidez describe lo documentado; la reencontrabilidad, lo observable hoy. Multiplicarlas dejaria que el estado de un buscador contaminara la calidad del expediente, que es el defecto que esta version corrige."
  };
}


export default {
  solidezDeIdentidad,
  reencontrabilidadActual,
  solidezDelExpediente
};
