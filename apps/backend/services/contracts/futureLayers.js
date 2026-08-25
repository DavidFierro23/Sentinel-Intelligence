// apps/backend/services/contracts/futureLayers.js

/*
===========================================================
CONTRATOS DE CAPAS FUTURAS — declarados, NO implementados
===========================================================

Cuatro capas que todavia no existen y que, cuando existan,
tendran que encajar con lo ya construido:

    TERRITORIAL DIGITAL BEHAVIOR
    CANDIDATE OVERLAY
    VENTANAS TEMPORALES COMPARABLES
    CAMPAIGN DECISION LAYER

POR QUE DECLARARLAS AHORA
-----------------------------------------------------------

Es el mismo motivo por el que ARQ-SDI-000 reservo el modulo de
Decision Intelligence antes de existir: para que las capas que
se construyan ANTES emitan los datos que la de despues
necesitara.

Si el recolector no guarda la ventana anterior, el Trend Radar
no se puede construir sin rehacer el recolector. Si la
geolocalizacion no declara su metodo, la capa de decision no
puede ponderar su fiabilidad.

QUE NO ES ESTE FICHERO
-----------------------------------------------------------

No es una promesa de funcionalidad ni una hoja de ruta
comercial. Es una lista de FORMAS que se han pensado para que
lo de hoy no bloquee lo de manana.

Ninguna de las cuatro tiene una sola linea de implementacion, y
ninguna debe simularse. Un campo vacio es informacion; un campo
inventado es una mentira con formato de dato.
===========================================================
*/


/*
===========================================================
1. TERRITORIAL DIGITAL BEHAVIOR
===========================================================

Comportamiento digital AGREGADO por territorio, cuando exista
una fuente legitima que lo entregue.

EL PRINCIPIO QUE GOBIERNA LA CAPA ENTERA
-----------------------------------------------------------

    AGREGADO, NUNCA IDENTIFICACION INDIVIDUAL.

Esta capa NO se disena para seguir a un dispositivo ni a una
persona. Si un diseno futuro permitiera aislar a un individuo,
el diseno esta mal, por muy legal que sea la fuente.

Es la misma linea que la plataforma ya tiene trazada en otro
sitio: el mapa nunca baja de parroquia para datos de personas
(riesgo WR-9, Cap. 14 §5.5 EX1-EX7).
===========================================================
*/

export const DIGITAL_BEHAVIOR = Object.freeze({
  estado: "CONTRATO — no implementado",

  principio:
    "Agregado, nunca identificacion individual. Ningun diseno de esta capa puede permitir aislar a una persona o a un dispositivo.",

  metricasPermitidas: Object.freeze([
    "deviceCategory",
    "operatingSystem",
    "browser",
    "platform",
    "hourOfDay",
    "dayOfWeek",
    "geographicAggregation",
    "campaignMetrics",
    "adMetrics",
    "webAnalytics",
    "appAnalytics",
    "interactionMetricsAggregated"
  ]),

  prohibido: Object.freeze([
    "identificadores personales",
    "telefonos",
    "correos",
    "cookies o IDs de dispositivo",
    "seguimiento individual",
    "inferencia de domicilio",
    "inferencia de atributos sensibles",
    "geolocalizacion por IP a resolucion fina",
    "microtargeting individual"
  ]),

  /*
    Procedencia obligatoria por metrica. Sin estos nueve campos
    la metrica no entra: una cifra sin procedencia no se puede
    auditar ni defender ante nadie.
  */
  procedenciaObligatoria: Object.freeze({
    provider: "quien entrega el dato",
    sourceType: "analytics_propio | ads_propio | proveedor_comercial | encuesta",
    projectOwned: "true si la propiedad es del proyecto",
    aggregationLevel: "minimo nivel de agregacion garantizado",
    timeWindow: "ventana a la que corresponde",
    territorialResolution: "hasta donde llega geograficamente",
    sampleOrCoverage: "muestra o cobertura, cuando la fuente la declare",
    license: "licencia de uso, incluida la comercial",
    privacyLimitations: "que NO se puede hacer con este dato",
    verified: "false hasta validarlo contra la fuente"
  }),

  fuentesPrevistas: Object.freeze([
    { id: "ga4", nombre: "Google Analytics 4", propio: true, integrado: false },
    { id: "meta_ads", nombre: "Meta Ads", propio: true, integrado: false },
    { id: "google_ads", nombre: "Google Ads", propio: true, integrado: false },
    { id: "tiktok_ads", nombre: "TikTok Ads", propio: true, integrado: false },
    { id: "analytics_propio", nombre: "Analytics propio", propio: true, integrado: false }
  ]),

  reglaGeo:
    "Hereda GEO-1. Una metrica agregada a nivel provincia NO se reparte entre cantones ni parroquias. El precedente esta medido: el informe de Meta Ads del Azuay produjo penetraciones del 134 % y el 238 % haciendo exactamente eso.",

  noIntegrarSi: [
    "no hay credencial",
    "no hay autorizacion del titular",
    "la licencia no cubre el uso previsto",
    "la metodologia no esta documentada"
  ]
});


/*
===========================================================
2. DATA-PROVIDER-EVAL-01 — evaluacion de proveedores
===========================================================
*/

export const DATA_PROVIDER_EVAL_01 = Object.freeze({
  id: "DATA-PROVIDER-EVAL-01",
  estado: "PENDIENTE — no iniciada",

  proposito:
    "Evaluar proveedores comerciales de datos agregados antes de integrar ninguno.",

  criteriosDeAdmision: Object.freeze([
    "datos agregados y anonimos",
    "metodologia documentada y publica",
    "licencia comercial clara y compatible con un SaaS propietario",
    "resolucion territorial util para el analisis",
    "procedencia auditable hasta el origen",
    "cumplimiento legal aplicable en Ecuador"
  ]),

  rechazoAutomatico: Object.freeze([
    "bases de telefonos",
    "identificadores personales",
    "tracking individual",
    "datos cuya procedencia o licencia no pueda demostrarse",
    "datos derivados de scraping de terceros sin base legal"
  ]),

  nota:
    "Ningun proveedor se integra antes de completar esta evaluacion. La ausencia de evaluacion es, por si sola, motivo de no integrar."
});


/*
===========================================================
3. VENTANAS TEMPORALES COMPARABLES
===========================================================

Dependencia dura del Trend Radar. Sin dos ventanas no hay
tendencia: hay una foto.
===========================================================
*/

export const VENTANAS_COMPARABLES = Object.freeze({
  estado: "CONTRATO — el recolector todavia no trae la ventana anterior",

  pares: Object.freeze([
    { id: "24h", actual: "ultimas 24 h", anterior: "24 h inmediatamente previas" },
    { id: "48h", actual: "ultimas 48 h", anterior: "48 h inmediatamente previas" },
    { id: "7d", actual: "ultimos 7 dias", anterior: "7 dias inmediatamente previos" },
    { id: "30d", actual: "ultimos 30 dias", anterior: "30 dias inmediatamente previos" }
  ]),

  forma: Object.freeze({
    ventanaActual: "{ desde, hasta, evidencias, fuentes }",
    ventanaAnterior: "{ desde, hasta, evidencias, fuentes } | null",
    comparable: "false si falta la anterior o si su cobertura no es equiparable",
    motivoNoComparable: "por que no se puede comparar",
    variacionAbsoluta: "numero",
    variacionRelativa: "numero | null si la base es insuficiente",
    baseMinima: "umbral por debajo del cual el porcentaje es ruido"
  }),

  reglas: Object.freeze([
    "Sin ventana anterior NO se afirma crecimiento. El campo sale disponible:false con motivo.",
    "Cero publicaciones observadas NO es lo mismo que sin observacion. Son dos estados distintos y se declaran por separado (WR-7).",
    "Dos ventanas observadas bajo demanda mezclan cambio real con cambio en el esfuerzo de observacion. Sin ingesta continua no se pueden separar, y eso se dice."
  ]),

  bloqueoActual:
    "Google News ofrece una ventana movil de semanas, no un archivo historico. El recolector no puede pedir «los 7 dias anteriores a los ultimos 7». Resolverlo exige o ingesta continua o una fuente con archivo."
});


/*
===========================================================
4. CANDIDATE OVERLAY — interoperabilidad con Linea A
===========================================================

Contrato de LECTURA. Esta capa nunca escribira en el modulo de
candidatos.
===========================================================
*/

export const CANDIDATE_OVERLAY = Object.freeze({
  estado: "CONTRATO — no implementado, Linea A no se toca",

  direccion: "solo lectura desde Territorial hacia Candidatos",

  preguntasQueDebeResponder: Object.freeze([
    "que candidato publico sobre un tema",
    "cuando",
    "desde que cuenta consolidada",
    "que interaccion publica observable obtuvo",
    "que medios lo relacionaron con el tema",
    "que territorios aparecen asociados en las evidencias",
    "como cambia su presencia a lo largo del tiempo"
  ]),

  forma: Object.freeze({
    actorId: "id del candidato o actor en el proyecto",
    temaId: "tema descubierto o clasificado",
    publicacionesPropias: "contenidos publicados por sus cuentas consolidadas",
    mencionesDeTerceros: "evidencias de medios que lo relacionan con el tema",
    cuentasUsadas: "que cuentas consolidadas sostienen la atribucion",
    territoriosAsociados: "solo los geolocalizables",
    ventana: "par de ventanas comparables cuando existan",
    interaccionObservable: "null mientras no haya API de plataforma"
  }),

  prohibiciones: Object.freeze([
    "NO atribuir postura a un actor por aparecer mencionado",
    "NO confundir mencion con autoria",
    "NO confirmar identidades: la correspondencia se queda en probable (IA2)",
    "NO escribir en el modulo de candidatos",
    "NO derivar apoyo politico del volumen"
  ]),

  dependencia:
    "Requiere que Linea A exponga cuentas consolidadas por actor. Hoy existe el Social Intelligence Layer, pero la integracion no se ha abierto."
});


/*
===========================================================
5. CAMPAIGN DECISION LAYER
===========================================================

La capa de arriba del todo. Correlaciona lo que las demas
producen.
===========================================================
*/

export const CAMPAIGN_DECISION = Object.freeze({
  estado: "CONTRATO — no implementado",

  entradas: Object.freeze([
    "tema (descubierto o clasificado)",
    "territorio (oficial o zona analitica declarada)",
    "ventana temporal comparable",
    "fuentes y su diversidad",
    "plataforma",
    "actividad de candidatos (Candidate Overlay)",
    "metricas agregadas disponibles (Digital Behavior)"
  ]),

  formaDeSalida: Object.freeze({
    tema: "string",
    territorio: "{ unidadId, nombre, unidadOficial }",
    cambio: "{ absoluto, relativo|null, ventana, comparable }",
    fuentes: "numero de fuentes independientes",
    actividadPorActor: "[{ actorId, publicaciones, ultimaPublicacion }]",
    loQueNoSabemos: "array, obligatorio",
    evidencias: "ids, obligatorio"
  }),

  prohibiciones: Object.freeze([
    "NO recomendaciones electorales automaticas",
    "NO microtargeting individual",
    "NO inferencia de atributos sensibles",
    "NO afirmar causa: solo contribucion y secuencia (WR-D13)",
    "NO presentar volumen como apoyo",
    "NO decidir: el human-in-the-loop es obligatorio (IA2)"
  ]),

  nota:
    "Esta capa informa. No decide. La decision es del analista, y la plataforma tiene que seguir siendo util aunque el analista decida lo contrario de lo que sugiere el dato."
});


/*
===========================================================
DECLARACION PUBLICA
===========================================================
*/

export function declararCapasFuturas() {
  return {
    version: "1.0",

    advertencia:
      "Ninguna de estas capas esta implementada. Se declaran para que las capas que se construyan antes emitan los datos que necesitaran, no como promesa de funcionalidad.",

    capas: {
      digitalBehavior: DIGITAL_BEHAVIOR,
      ventanasComparables: VENTANAS_COMPARABLES,
      candidateOverlay: CANDIDATE_OVERLAY,
      campaignDecision: CAMPAIGN_DECISION
    },

    pendientesFormales: [DATA_PROVIDER_EVAL_01]
  };
}


export default {
  DIGITAL_BEHAVIOR,
  DATA_PROVIDER_EVAL_01,
  VENTANAS_COMPARABLES,
  CANDIDATE_OVERLAY,
  CAMPAIGN_DECISION,
  declararCapasFuturas
};
