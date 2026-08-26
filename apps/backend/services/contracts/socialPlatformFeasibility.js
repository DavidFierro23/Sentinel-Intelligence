// apps/backend/services/contracts/socialPlatformFeasibility.js

/*
===========================================================
VIABILIDAD DE PLATAFORMAS SOCIALES
===========================================================

Que haria falta EXACTAMENTE para escuchar cada plataforma, y
en que estado esta cada requisito.

POR QUE UN REGISTRO Y NO UNA INTEGRACION
-----------------------------------------------------------

Porque la respuesta honesta hoy es «no se puede todavia», y esa
respuesta es util si viene con la lista de lo que falta.

Sin este registro, la conversacion sobre redes se repite cada
vez desde cero y acaba siempre en la misma tentacion: raspar.
Con el, la pregunta pasa a ser «¿autorizamos este acceso o no?»,
que es una decision de negocio con datos delante.

LA LINEA QUE NO SE CRUZA
-----------------------------------------------------------

Nada de raspado evasivo, nada de eludir anti-bot, nada de
cuentas falsas. No es solo un problema legal: un dato obtenido
asi no se puede citar en un informe, no se puede auditar y
desaparece en cuanto la plataforma cambia algo.

Un dato que no se puede defender no vale nada aunque sea cierto.

`estimatedCost: null` significa NO SE SABE y se queda en null.
===========================================================
*/


export const ESTADOS_EVALUACION = Object.freeze({
  NO_INICIADA: "NO_INICIADA",
  EN_ESTUDIO: "EN_ESTUDIO",
  BLOQUEADA: "BLOQUEADA",
  VIABLE_CON_AUTORIZACION: "VIABLE_CON_AUTORIZACION",
  DESCARTADA: "DESCARTADA"
});


export const PLATAFORMAS = Object.freeze([
  {
    id: "META",
    nombre: "Facebook e Instagram",

    officialApiAvailable: true,

    detalleApi:
      "Existen APIs oficiales, pero el acceso a contenido público de terceros pasa por revisión de Meta y por permisos concretos. La API de páginas cubre páginas que uno administra, no la conversación pública general.",

    thirdPartyPublicMonitoring: true,

    authorizationRequired:
      "Revisión de app por Meta, empresa verificada y permisos específicos. Para páginas propias basta ser administrador.",

    commercialProviderCandidate: true,

    coverageNeeded:
      "Páginas públicas de medios, instituciones y colectivos de Cuenca. NO perfiles personales.",

    historicalAccess: null,
    metricsAvailable: null,
    estimatedCost: null,

    legalTermsStatus: "NO_LEIDO",

    evaluationStatus: ESTADOS_EVALUACION.NO_INICIADA,

    /*
      Lo mas util a corto plazo y lo mas facil de pasar por
      alto: las paginas que el propio cliente administra no
      necesitan nada de lo anterior.
    */
    viaMasCorta:
      "Si un cliente administra sus propias páginas, sus datos son suyos y la API los da sin revisión. Eso NO es escucha del territorio, pero es dato real y propio desde el primer día.",

    riesgo:
      "Sin acceso oficial la única alternativa técnica sería raspado, que rompe sus condiciones y produce datos indefendibles."
  },

  {
    id: "X",
    nombre: "X",

    officialApiAvailable: true,

    detalleApi:
      "API de pago por niveles. El nivel gratuito no permite búsqueda de conversación pública.",

    thirdPartyPublicMonitoring: true,

    authorizationRequired: "Suscripción de pago. Sin revisión previa.",

    commercialProviderCandidate: true,

    coverageNeeded: "Conversación pública sobre Cuenca y actores locales.",

    historicalAccess: null,
    metricsAvailable: null,
    estimatedCost: null,

    legalTermsStatus: "NO_LEIDO",

    evaluationStatus: ESTADOS_EVALUACION.NO_INICIADA,

    incognitaPrincipal:
      "El volumen real de conversación local sobre Cuenca en X. Es una plataforma de uso desigual por país y ciudad: puede que el coste no se justifique por falta de volumen, y eso hay que medirlo ANTES de suscribirse.",

    riesgo: "Pagar por una cobertura que resulte marginal en el territorio."
  },

  {
    id: "TIKTOK",
    nombre: "TikTok",

    officialApiAvailable: true,

    detalleApi:
      "Existe una API de investigación con acceso restringido y una API de contenido para cuentas propias.",

    thirdPartyPublicMonitoring: true,

    authorizationRequired:
      "La API de investigación exige solicitud aprobada y suele estar limitada por región y por tipo de solicitante.",

    commercialProviderCandidate: true,

    coverageNeeded: "Contenido público con referencia territorial a Cuenca.",

    historicalAccess: null,
    metricsAvailable: null,
    estimatedCost: null,

    legalTermsStatus: "NO_LEIDO",

    evaluationStatus: ESTADOS_EVALUACION.NO_INICIADA,

    incognitaPrincipal:
      "Si el acceso de investigación está disponible en Ecuador y para qué tipo de solicitante. Es lo primero que hay que comprobar: si no lo está, la vía es un proveedor con licencia y no hay más que hablar.",

    riesgo: "Alta relevancia local esperable y acceso oficial incierto."
  },

  {
    id: "LINKEDIN",
    nombre: "LinkedIn",

    officialApiAvailable: true,

    detalleApi: "API centrada en páginas propias y publicación. No en escucha pública.",

    thirdPartyPublicMonitoring: false,

    authorizationRequired: "Programa de socios para casi todo lo que no sea la página propia.",

    commercialProviderCandidate: false,

    coverageNeeded: "Baja a priori para conversación territorial de un cantón.",

    historicalAccess: null,
    metricsAvailable: null,
    estimatedCost: null,

    legalTermsStatus: "NO_LEIDO",

    evaluationStatus: ESTADOS_EVALUACION.NO_INICIADA,

    incognitaPrincipal: "Ninguna urgente.",

    riesgo:
      "Bajo, porque el interés es bajo. Se registra para que la decisión de no priorizarla quede escrita en vez de olvidada."
  },

  {
    id: "YOUTUBE",
    nombre: "YouTube",

    officialApiAvailable: true,

    detalleApi:
      "API oficial pública con cuota diaria. Es la única de esta lista que ya tiene adapter implementado en Sentinel.",

    thirdPartyPublicMonitoring: true,

    authorizationRequired: "Solo una clave de API de Google. Sin revisión.",

    commercialProviderCandidate: false,

    coverageNeeded:
      "El 40 % del corpus real de Cuenca llegó por YouTube con los emisores sin identificar. Es la carencia más grande que hay hoy.",

    historicalAccess: "Sí, por fecha de publicación del vídeo.",

    metricsAvailable: "Suscriptores, vistas y número de vídeos, todo público.",

    estimatedCost: 0,

    detalleCosto:
      "10.000 unidades/día gratis. Una búsqueda cuesta 100. No es dinero: es presupuesto.",

    legalTermsStatus: "NO_LEIDO",

    evaluationStatus: ESTADOS_EVALUACION.VIABLE_CON_AUTORIZACION,

    incognitaPrincipal: "Ninguna técnica. Falta la clave.",

    riesgo: "Agotar la cuota diaria con búsquedas mal presupuestadas."
  }
]);


export function estadoViabilidadSocial() {
  const porEstado = {};

  PLATAFORMAS.forEach((p) => {
    porEstado[p.evaluationStatus] = (porEstado[p.evaluationStatus] || 0) + 1;
  });

  return {
    id: "SOCIAL-PLATFORM-FEASIBILITY-01",

    plataformas: PLATAFORMAS.length,
    porEstado,

    conApiOficial: PLATAFORMAS.filter((p) => p.officialApiAvailable).length,

    integradas: PLATAFORMAS.filter(
      (p) => p.evaluationStatus === ESTADOS_EVALUACION.VIABLE_CON_AUTORIZACION
    ).map((p) => p.id),

    sinCostoConocido: PLATAFORMAS.filter((p) => p.estimatedCost === null).length,

    terminosSinLeer: PLATAFORMAS.filter((p) => p.legalTermsStatus === "NO_LEIDO").length,

    proximoPaso:
      "YouTube. Es la única sin bloqueo técnico ni administrativo, la única con adapter ya escrito y la que cubre el hueco más grande del corpus actual. Solo falta YOUTUBE_API_KEY.",

    declaraciones: [
      "Ninguna plataforma social está integrada hoy salvo YouTube, y YouTube está a la espera de credencial.",
      "NO se contempla raspado evasivo, elusión de anti-bot ni cuentas falsas. Un dato obtenido así no se puede citar, no se puede auditar y desaparece cuando la plataforma cambia algo.",
      "`estimatedCost: null` significa que no se sabe. No se estima.",
      "Ningún término de servicio se ha leído en detalle todavía: `legalTermsStatus: NO_LEIDO` es un hecho, no un descuido tapado."
    ]
  };
}


export default { PLATAFORMAS, ESTADOS_EVALUACION, estadoViabilidadSocial };
