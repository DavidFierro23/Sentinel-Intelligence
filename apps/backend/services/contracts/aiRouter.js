// apps/backend/services/contracts/aiRouter.js

/*
===========================================================
AI ROUTER — contrato, no integracion
===========================================================

AUDITORIA PREVIA, PARA QUE CONSTE
-----------------------------------------------------------

Sentinel NO usa hoy ningun modelo de lenguaje. Comprobado
sobre el arbol de servicios y sobre package.json: las
dependencias son axios, cors, dotenv, express, rss-parser y
whois-json. Ni una sola llamada a Anthropic, OpenAI, Google ni
a ningun proveedor de IA.

Todo lo que parece «inteligencia» —descubrimiento de temas,
clasificacion de encuadre, separacion entidad/tema,
geolocalizacion— es determinista y explicable por construccion.
Esa decision esta documentada en Gate C2: se evaluo incorporar
embeddings y se descarto porque un cluster semantico no puede
responder POR QUE agrupo, y porque un modelo que se actualiza
rompe la reproducibilidad que exige Replay.

QUE CAMBIA ESO
-----------------------------------------------------------

Nada, todavia. Este modulo no integra nada. Define la FORMA que
tendria una integracion para que, cuando llegue, no llegue
cableada a un proveedor concreto.

EL RIESGO QUE ESTE CONTRATO EVITA
-----------------------------------------------------------

Escribir en algun sitio `if (tarea === "resumen") llamarAClaude()`.
En cuanto eso existe, cambiar de proveedor deja de ser una
decision y pasa a ser una migracion. Y peor: la eleccion queda
fijada por lo que estaba de moda el dia que se escribio la
linea, no por lo que mide mejor.

Sentinel elige por EVALUACION. AI-EVAL-01 define esa
evaluacion, y hasta que se ejecute no hay proveedor preferido
para ninguna tarea.

LA LINEA QUE NO SE CRUZA
-----------------------------------------------------------

Un modelo puede ETIQUETAR, RESUMIR y EXPLICAR. No puede
DECIDIR que existe. La agenda, los temas y los territorios
salen de reglas deterministas y auditables; si un modelo
propusiera un tema que las reglas no encuentran, ese tema no
seria reproducible y no podria sostener un informe.

Por eso `puedeCrearHechos: false` en todas las tareas, sin
excepcion y sin campo para cambiarlo por configuracion.
===========================================================
*/


export const TAREAS_IA = Object.freeze({
  TOPIC_LABELING: "TOPIC_LABELING",
  ENTITY_RESOLUTION: "ENTITY_RESOLUTION",
  SOURCE_CLASSIFICATION: "SOURCE_CLASSIFICATION",
  SUMMARY: "SUMMARY",
  INSIGHT: "INSIGHT",
  CORRELATION_EXPLANATION: "CORRELATION_EXPLANATION",
  REPORT: "REPORT",
  MULTIMODAL_ANALYSIS: "MULTIMODAL_ANALYSIS"
});


export const TIPOS_ENTRADA = Object.freeze({
  TEXTO: "text",
  IMAGEN: "image",
  ESTRUCTURADO: "structured"
});


/*
-----------------------------------------------------------
QUE PUEDE HACER CADA TAREA

`reemplazaDeterminista` es el campo que importa. Cuando es
false, la tarea de IA se aplica ENCIMA de un resultado que ya
existe: etiquetar mejor un cluster que las reglas ya formaron,
no formar el cluster.

`degradaA` declara que pasa si no hay proveedor disponible. Si
una tarea no puede degradar, no puede integrarse: una funcion
que se cae cuando la API de un tercero tiene un mal dia no es
una funcion, es una dependencia.
-----------------------------------------------------------
*/

export const CAPACIDADES_TAREA = Object.freeze({
  TOPIC_LABELING: {
    descripcion:
      "Proponer una etiqueta legible para un cluster que las reglas ya formaron.",
    reemplazaDeterminista: false,
    puedeCrearHechos: false,
    degradaA: "la etiqueta actual, compuesta con los términos del propio cluster",
    entrada: [TIPOS_ENTRADA.TEXTO],
    requiereSalidaEstructurada: true
  },

  ENTITY_RESOLUTION: {
    descripcion:
      "Decidir si «M. Peñaloza» y «Marisol Peñaloza» son la misma persona.",
    reemplazaDeterminista: false,
    puedeCrearHechos: false,
    degradaA: "tratarlas como entidades distintas, que es el comportamiento actual",
    entrada: [TIPOS_ENTRADA.TEXTO, TIPOS_ENTRADA.ESTRUCTURADO],
    requiereSalidaEstructurada: true,
    nota:
      "Fusionar dos entidades que no son la misma persona es un error grave y silencioso. Esta tarea exige umbral alto y revisión."
  },

  SOURCE_CLASSIFICATION: {
    descripcion:
      "Clasificar una fuente que el catálogo y los sufijos dejaron en NO_DETERMINADO.",
    reemplazaDeterminista: false,
    puedeCrearHechos: false,
    degradaA: "NO_DETERMINADO, que ya es un resultado válido",
    entrada: [TIPOS_ENTRADA.TEXTO],
    requiereSalidaEstructurada: true
  },

  SUMMARY: {
    descripcion: "Resumir un conjunto de evidencias ya seleccionadas.",
    reemplazaDeterminista: false,
    puedeCrearHechos: false,
    degradaA: "la lista de titulares, sin resumir",
    entrada: [TIPOS_ENTRADA.TEXTO],
    requiereSalidaEstructurada: false
  },

  INSIGHT: {
    descripcion: "Redactar la lectura de un conjunto de métricas ya calculadas.",
    reemplazaDeterminista: false,
    puedeCrearHechos: false,
    degradaA: "las métricas desnudas, sin lectura",
    entrada: [TIPOS_ENTRADA.ESTRUCTURADO],
    requiereSalidaEstructurada: false,
    nota:
      "El mayor riesgo de alucinación de toda la lista: redactar una lectura invita a añadir causas que los datos no sostienen."
  },

  CORRELATION_EXPLANATION: {
    descripcion: "Explicar en prosa una correlación ya medida.",
    reemplazaDeterminista: false,
    puedeCrearHechos: false,
    degradaA: "el coeficiente y su intervalo, sin explicación",
    entrada: [TIPOS_ENTRADA.ESTRUCTURADO],
    requiereSalidaEstructurada: false,
    nota:
      "Nunca puede convertir correlación en causa. La explicación describe la relación medida, no la origina."
  },

  REPORT: {
    descripcion: "Componer un informe a partir de secciones ya generadas.",
    reemplazaDeterminista: false,
    puedeCrearHechos: false,
    degradaA: "el informe con las secciones sin redactar",
    entrada: [TIPOS_ENTRADA.ESTRUCTURADO, TIPOS_ENTRADA.TEXTO],
    requiereSalidaEstructurada: false
  },

  MULTIMODAL_ANALYSIS: {
    descripcion: "Describir el contenido observable de una imagen pública.",
    reemplazaDeterminista: false,
    puedeCrearHechos: false,
    degradaA: "no describir la imagen",
    entrada: [TIPOS_ENTRADA.IMAGEN],
    requiereSalidaEstructurada: true,
    nota:
      "Describir lo que se ve. Nunca inferir identidad, etnia, edad, ideología ni ningún atributo sensible de una persona en una fotografía."
  }
});


/*
===========================================================
CONTRATO DEL ADAPTADOR
===========================================================

Cualquier proveedor que quiera entrar cumple esto. El router
no sabe de ningun proveedor concreto: lee capacidades y elige.
===========================================================
*/

export const CONTRATO_ADAPTADOR = Object.freeze({
  id: "AIProviderAdapter",
  version: "1.0",

  campos: Object.freeze({
    provider: "string — identificador del proveedor",
    model: "string — modelo concreto; dos modelos del mismo proveedor son adaptadores distintos",
    taskType: "TAREAS_IA — para qué tarea se declara apto",
    inputType: "TIPOS_ENTRADA[] — qué acepta",

    supportsText: "boolean",
    supportsImage: "boolean",
    supportsStructuredOutput:
      "boolean — obligatorio para las tareas que lo exigen; sin él, la salida hay que parsearla y eso falla en silencio",

    latency: "number|null — ms medianos MEDIDOS. null si no se ha medido",
    cost: "number|null — coste por llamada. null si no se conoce; NO se estima",
    reliability:
      "number|null — proporción de llamadas que devolvieron una salida válida. Medida, no declarada por el proveedor",

    traceId:
      "string — identificador de la llamada. Sin traza no hay auditoría, y una salida de IA sin auditoría no entra en un informe"
  }),

  metodos: Object.freeze({
    "ejecutar(tarea, entrada, opciones)":
      "Promise<{salida, traceId, provider, model, latencia, costo}>",
    "capacidades()": "devuelve los campos declarados",
    "disponible()": "Promise<boolean> — si puede atender ahora mismo"
  }),

  obligaciones: Object.freeze([
    "Conservar traceId en cada llamada. Una salida de IA sin traza no es auditable.",
    "Declarar `cost: null` si el coste no se conoce. Nunca estimarlo.",
    "No reintentar en silencio con otro modelo: cambiar de modelo cambia el resultado y debe constar.",
    "Devolver la salida cruda además de la parseada, para poder auditar qué dijo realmente el modelo."
  ])
});


/*
-----------------------------------------------------------
ELEGIR PROVEEDOR

Por evaluacion, no por nombre. La funcion existe ya para fijar
la regla; hoy no hay adaptadores registrados, asi que siempre
devuelve null y el motivo.

Sin metricas medidas (`reliability`, `latency`) un adaptador NO
gana la eleccion aunque sea el unico: un proveedor sin medir es
un proveedor desconocido, y ese es el estado de los tres que
hoy se nombran en cualquier conversacion sobre IA.
-----------------------------------------------------------
*/

export function elegirProveedor(tarea, adaptadores = [], opciones = {}) {
  const capacidad = CAPACIDADES_TAREA[tarea];

  if (!capacidad) {
    return {
      elegido: null,
      motivo: `«${tarea}» no es una tarea declarada.`,
      degradaA: null
    };
  }

  const aptos = adaptadores.filter(
    (a) =>
      a.taskType === tarea &&
      (!capacidad.requiereSalidaEstructurada || a.supportsStructuredOutput === true)
  );

  if (aptos.length === 0) {
    return {
      elegido: null,

      motivo:
        adaptadores.length === 0
          ? "No hay ningún adaptador de IA registrado. Sentinel no integra hoy ningún modelo de lenguaje."
          : `Ningún adaptador declara aptitud para ${tarea}${
              capacidad.requiereSalidaEstructurada
                ? " con salida estructurada, que esta tarea exige"
                : ""
            }.`,

      degradaA: capacidad.degradaA
    };
  }

  const medidos = aptos.filter(
    (a) => typeof a.reliability === "number" && typeof a.latency === "number"
  );

  if (medidos.length === 0) {
    return {
      elegido: null,

      motivo:
        "Hay adaptadores aptos pero ninguno tiene fiabilidad ni latencia MEDIDAS. Un proveedor sin medir es un proveedor desconocido: AI-EVAL-01 existe para eso.",

      degradaA: capacidad.degradaA,

      candidatosSinMedir: aptos.map((a) => `${a.provider}/${a.model}`)
    };
  }

  /*
    Fiabilidad primero, latencia despues, coste como desempate.
    El coste NO manda: un modelo barato que devuelve JSON
    invalido un 10 % de las veces cuesta mas en revision de lo
    que ahorra.
  */
  const orden = [...medidos].sort(
    (a, b) =>
      b.reliability - a.reliability ||
      a.latency - b.latency ||
      (a.cost ?? Infinity) - (b.cost ?? Infinity)
  );

  return {
    elegido: orden[0],

    motivo: `Elegido por fiabilidad medida (${orden[0].reliability}), latencia (${orden[0].latency} ms) y coste como desempate.`,

    alternativas: orden.slice(1).map((a) => `${a.provider}/${a.model}`),

    degradaA: capacidad.degradaA,

    void: opciones
  };
}


/*
===========================================================
AI-EVAL-01 — pendiente formal
===========================================================
*/

export const AI_EVAL_01 = Object.freeze({
  id: "AI-EVAL-01",
  estado: "PENDIENTE — no iniciada",

  proposito:
    "Elegir proveedor de IA por evaluación medida, no por reputación ni por novedad.",

  proveedoresAEvaluar: Object.freeze([
    "ChatGPT (OpenAI)",
    "Claude (Anthropic)",
    "Gemini (Google)",
    "otros si aportan algo que estos no"
  ]),

  metodo: Object.freeze({
    mismaTarea: "La misma, empezando por TOPIC_LABELING y SOURCE_CLASSIFICATION.",
    mismoCorpus: "El corpus real de Cuenca. Mismo conjunto para todos.",
    mismosCriterios: "Los de abajo, sin ponderación cambiada entre proveedores."
  }),

  criterios: Object.freeze([
    { id: "precision", nota: "Contra un conjunto etiquetado a mano por el analista." },
    {
      id: "consistencia",
      nota: "La MISMA entrada, N veces. Un modelo que da tres respuestas distintas no sirve para Replay."
    },
    {
      id: "alucinacion",
      nota: "Proporción de afirmaciones que el corpus no sostiene. Criterio eliminatorio, no puntuable."
    },
    {
      id: "explicabilidad",
      nota: "¿Da razones auditables o solo una respuesta? Sin razones no encaja con IA1."
    },
    { id: "latencia", nota: "Mediana medida, no la prometida." },
    { id: "costo", nota: "Por llamada y por corpus completo." },
    {
      id: "jsonValido",
      nota: "Proporción de salidas que cumplen el esquema. Un 95 % obliga a escribir la ruta de fallo del 5 %."
    },
    { id: "multimodal", nota: "Solo relevante para MULTIMODAL_ANALYSIS." },
    {
      id: "espanolEcuador",
      nota:
        "El criterio menos comparable entre proveedores y el más importante aquí. «Parroquia», «cantón», «prefecto» y «GAD» significan cosas concretas en Ecuador y un modelo entrenado sobre español peninsular las lee mal."
    },
    {
      id: "repetibilidad",
      nota:
        "¿Se puede fijar una versión del modelo? Un modelo que se actualiza sin aviso rompe la reproducibilidad de Replay."
    }
  ]),

  reglas: Object.freeze([
    "No se incorpora un modelo por moda. Solo si mejora Sentinel de forma medida.",
    "Ningún proveedor queda cableado a ninguna tarea.",
    "Un modelo puede etiquetar, resumir y explicar. No puede decidir qué existe.",
    "Si ningún proveedor supera el criterio de alucinación, la respuesta correcta es no integrar ninguno."
  ]),

  nota:
    "Hoy Sentinel no usa ningún modelo de lenguaje y funciona. Eso no es una carencia que haya que tapar: es la línea base contra la que cualquier integración tiene que demostrar mejora."
});


export function estadoAiRouter() {
  return {
    contrato: CONTRATO_ADAPTADOR,
    tareas: Object.keys(CAPACIDADES_TAREA),
    capacidades: CAPACIDADES_TAREA,

    adaptadoresRegistrados: 0,

    integracionActual: "NINGUNA",

    auditoria: {
      dependenciasDeIA: [],
      llamadasAModelos: 0,
      comprobado:
        "package.json y árbol de servicios: axios, cors, dotenv, express, rss-parser, whois-json. Ninguna dependencia de IA."
    },

    pendiente: AI_EVAL_01,

    declaraciones: [
      "Sentinel no integra hoy ningún modelo de lenguaje. Todo lo que parece inteligencia es determinista y explicable.",
      "Ningún proveedor está cableado a ninguna tarea. La elección la hace AI-EVAL-01 por medición.",
      "Un modelo puede etiquetar, resumir y explicar. No puede decidir qué existe: eso rompería la reproducibilidad de Replay."
    ]
  };
}


export default {
  TAREAS_IA,
  TIPOS_ENTRADA,
  CAPACIDADES_TAREA,
  CONTRATO_ADAPTADOR,
  AI_EVAL_01,
  elegirProveedor,
  estadoAiRouter
};
