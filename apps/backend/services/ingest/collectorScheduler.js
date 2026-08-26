// apps/backend/services/ingest/collectorScheduler.js

/*
===========================================================
COLLECTOR SCHEDULER — contrato, sin ejecucion continua
===========================================================

Define QUE se recogeria, CADA CUANTO y CON QUE PRESUPUESTO.
No arranca nada.

POR QUE EL CONTRATO ANTES QUE EL DEMONIO
-----------------------------------------------------------

La ingesta continua tiene un modo de fallo caro y silencioso:
un job mal configurado gasta cuota de madrugada y nadie se
entera hasta que las investigaciones empiezan a fallar por
falta de saldo. Con SerpAPI eso es un saldo MENSUAL compartido
con el Discovery Engine.

Definir primero el contrato —con presupuesto, con cuota y con
frecuencia minima— permite razonar sobre el coste antes de que
exista un proceso capaz de incurrir en el.

LA FRECUENCIA NO ES UNA PREFERENCIA
-----------------------------------------------------------

Cada job declara `frecuenciaMinimaMs`, y por debajo de eso NO
se programa. Dos razones:

  1. Los terminos de uso. Hay plataformas que prohiben el
     sondeo frecuente, y respetarlo no es opcional.
  2. La prensa local de un canton no publica cada quince
     minutos. Consultar mas a menudo que la fuente publica no
     trae mas informacion: trae la misma, mas veces, y la
     deduplicacion la descarta despues de haberla pagado.

«LA ULTIMA VEZ QUE MIRAMOS» NO ES «LA ULTIMA VEZ QUE PASO ALGO»
-----------------------------------------------------------

Un job que no se ejecuta deja un HUECO DE INGESTA, y un hueco
no es un dia tranquilo. Se declara como hueco para que ninguna
lectura posterior lo confunda con calma.
===========================================================
*/


export const FRECUENCIAS = Object.freeze({
  CADA_HORA: { id: "1h", ms: 3600000, etiqueta: "cada hora" },
  CADA_3H: { id: "3h", ms: 10800000, etiqueta: "cada 3 horas" },
  CADA_6H: { id: "6h", ms: 21600000, etiqueta: "cada 6 horas" },
  CADA_12H: { id: "12h", ms: 43200000, etiqueta: "cada 12 horas" },
  DIARIA: { id: "24h", ms: 86400000, etiqueta: "diaria" }
});


export const ESTADOS_JOB = Object.freeze({
  ACTIVO: "ACTIVO",
  PAUSADO: "PAUSADO",
  SIN_CREDENCIAL: "SIN_CREDENCIAL",
  CUOTA_AGOTADA: "CUOTA_AGOTADA",
  ERROR: "ERROR",
  NUNCA_EJECUTADO: "NUNCA_EJECUTADO"
});


/*
-----------------------------------------------------------
FRECUENCIA MINIMA POR PROVEEDOR

No es una politica de rendimiento: es lo que cada proveedor
tolera o cuesta.

  RSS directo   1h    feeds publicos del propio medio; la
                      prensa local no publica mas a menudo
  Google News   3h    RSS gratuito, pero ventana movil: mirar
                      cada hora devuelve casi lo mismo
  GDELT         6h    API publica con limite de tasa
  YouTube      12h    una busqueda cuesta 100 de 10.000
                      unidades diarias
  Brave        12h    credencial de pago
  SerpAPI      24h    SALDO MENSUAL compartido con Discovery.
                      Es el mas caro de equivocarse.
-----------------------------------------------------------
*/

export const FRECUENCIA_MINIMA = Object.freeze({
  rss_directo: FRECUENCIAS.CADA_HORA.ms,
  google_news: FRECUENCIAS.CADA_3H.ms,
  gdelt_doc: FRECUENCIAS.CADA_6H.ms,
  youtube_data: FRECUENCIAS.CADA_12H.ms,
  brave_web: FRECUENCIAS.CADA_12H.ms,
  serpapi_google: FRECUENCIAS.DIARIA.ms
});


export const MOTIVO_FRECUENCIA = Object.freeze({
  rss_directo: "Feeds públicos del propio medio. La prensa local de un cantón no publica más a menudo.",
  google_news: "RSS gratuito pero de ventana móvil: consultar cada hora devuelve casi lo mismo.",
  gdelt_doc: "API pública con límite de tasa.",
  youtube_data: "Una búsqueda cuesta 100 de las 10.000 unidades diarias. Cada 12 h son 2 al día por consulta.",
  brave_web: "Credencial de pago.",
  serpapi_google: "SALDO MENSUAL compartido con el Discovery Engine. Gastarlo aquí deja sin cuota la función principal de la plataforma."
});


export function crearJob({
  jobId,
  projectId = null,
  territoryId,
  provider,
  frequency = FRECUENCIAS.CADA_6H,
  queries = [],
  presupuestoPorEjecucion = null,
  creadoEn = null
}) {
  const minima = FRECUENCIA_MINIMA[provider] ?? FRECUENCIAS.CADA_6H.ms;

  /*
    Se ELEVA a la mínima en lugar de rechazar el job. Rechazarlo
    dejaría al proveedor sin recoger nada; elevarlo lo recoge a
    un ritmo admisible y declara el ajuste.
  */
  const ajustada = frequency.ms < minima;

  const efectiva = ajustada
    ? Object.values(FRECUENCIAS).find((f) => f.ms === minima) || frequency
    : frequency;

  return {
    jobId,
    projectId,
    territoryId,
    provider,

    frequency: efectiva,
    frecuenciaPedida: ajustada ? frequency : null,

    ajusteDeFrecuencia: ajustada
      ? {
          motivo: MOTIVO_FRECUENCIA[provider] || "Frecuencia mínima del proveedor.",
          pedida: frequency.id,
          aplicada: efectiva.id
        }
      : null,

    queries,

    presupuestoPorEjecucion,

    lastRun: null,
    nextRun: null,
    status: ESTADOS_JOB.NUNCA_EJECUTADO,

    resultCount: 0,
    errorCount: 0,
    duration: null,
    cost: null,
    quota: null,

    /*
      Ejecuciones que tocaban y no ocurrieron. Un hueco NO es un
      periodo sin actividad: es un periodo sin observación.
    */
    huecosDeIngesta: [],

    creadoEn
  };
}


export function programarSiguiente(job, { ahora }) {
  const t = new Date(ahora).getTime();

  if (Number.isNaN(t)) return job;

  job.nextRun = new Date(t + job.frequency.ms).toISOString();

  return job;
}


export function anotarEjecucion(job, { startedAt, finishedAt, resultCount = 0, errorCount = 0, cost = null, quota = null }) {
  job.lastRun = finishedAt || startedAt;

  job.resultCount += resultCount;

  job.errorCount += errorCount;

  if (startedAt && finishedAt) {
    job.duration = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  }

  /*
    El coste se ACUMULA solo si se conoce. Un null no se trata
    como cero: si una ejecución no declaró coste, el acumulado
    del job pasa a desconocido y lo dice.
  */
  if (cost === null) {
    job.cost = null;
  } else if (job.cost !== null) {
    job.cost = Number((job.cost + cost).toFixed(4));
  }

  if (quota) job.quota = { ...(job.quota || {}), ...quota };

  job.status = errorCount > 0 ? ESTADOS_JOB.ERROR : ESTADOS_JOB.ACTIVO;

  return programarSiguiente(job, { ahora: finishedAt || startedAt });
}


/*
-----------------------------------------------------------
HUECOS DE INGESTA

Entre `lastRun` y `ahora` deberia haber habido N ejecuciones.
Las que faltan son huecos, y hay que declararlos: sin esto, una
serie temporal con un fin de semana sin recolección se leería
como dos días de calma en el territorio.
-----------------------------------------------------------
*/

export function detectarHuecos(job, { ahora }) {
  if (!job.lastRun) {
    return {
      huecos: [],
      esperadas: null,
      motivo: "El job no se ha ejecutado nunca. No hay periodo del que declarar huecos."
    };
  }

  const desde = new Date(job.lastRun).getTime();

  const hasta = new Date(ahora).getTime();

  if (Number.isNaN(desde) || Number.isNaN(hasta) || hasta <= desde) {
    return { huecos: [], esperadas: 0, motivo: null };
  }

  const esperadas = Math.floor((hasta - desde) / job.frequency.ms);

  const perdidas = Math.max(0, esperadas - 1);

  const huecos = [];

  for (let i = 1; i <= perdidas; i += 1) {
    huecos.push({
      esperadaEn: new Date(desde + i * job.frequency.ms).toISOString(),
      ejecutada: false
    });
  }

  return {
    huecos,
    esperadas,

    declaracion:
      huecos.length > 0
        ? `${huecos.length} ejecución(es) no ocurrieron. Un hueco de ingesta NO es un periodo sin actividad: es un periodo sin observación.`
        : null
  };
}


export function estadoScheduler(jobs = []) {
  const porEstado = {};

  jobs.forEach((j) => {
    porEstado[j.status] = (porEstado[j.status] || 0) + 1;
  });

  return {
    jobs: jobs.length,
    porEstado,

    activos: jobs.filter((j) => j.status === ESTADOS_JOB.ACTIVO).length,
    nuncaEjecutados: jobs.filter((j) => j.status === ESTADOS_JOB.NUNCA_EJECUTADO).length,
    conAjusteDeFrecuencia: jobs.filter((j) => j.ajusteDeFrecuencia).length,

    ejecucionContinua: false,

    declaraciones: [
      "Este módulo define jobs. NO ejecuta ninguno: no hay proceso continuo activo.",
      "La frecuencia se eleva a la mínima del proveedor en lugar de rechazar el job, y el ajuste se declara.",
      "Un hueco de ingesta no es un periodo sin actividad: es un periodo sin observación."
    ]
  };
}


export default {
  FRECUENCIAS,
  ESTADOS_JOB,
  FRECUENCIA_MINIMA,
  MOTIVO_FRECUENCIA,
  crearJob,
  programarSiguiente,
  anotarEjecucion,
  detectarHuecos,
  estadoScheduler
};
