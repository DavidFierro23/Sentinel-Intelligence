// apps/backend/services/territorial/sourceCoverageMatrix.js

/*
===========================================================
MATRIZ DE COBERTURA DE RECOLECCION
TERRITORIAL-SOURCE-COVERAGE-MATRIX-01
===========================================================

Base: TERRITORIAL-TOPIC-NORMALIZATION-01, commit b94f94b.

LA PREGUNTA QUE RESPONDE
-----------------------------------------------------------

«¿Que puede observar Sentinel hoy, mediante que motor, con que
profundidad, y que NO puede observar?»

Y la regla que organiza todo el modulo:

    COBERTURA DE FUENTES  !=  COBERTURA DE POBLACION

Esta matriz describe fuentes observables. No describe
ciudadanos, ni penetracion, ni representatividad estadistica.
Ninguna celda autoriza a decir «el X % de Cuenca».

LA DISTINCION QUE MAS SE CONFUNDE
-----------------------------------------------------------

    DISCOVERY     encontrar actores y contenidos que todavia
                  NO conocemos
    OBSERVATION   medir una cuenta o URL que YA conocemos

Candidate demostro que la observacion de cuentas conocidas
funciona en Facebook, Instagram y TikTok. Eso NO significa que
Territorial pueda descubrir conversacion en esas plataformas:
son dos capacidades distintas y aqui van en filas separadas.

AUSENCIA NO ES CERO
-----------------------------------------------------------

Si no hay descubrimiento abierto en TikTok, lo que se dice es:

    TikTok OPEN_KEYWORD_DISCOVERY = UNSUPPORTED
    con los conectores actuales

y NUNCA:

    «0 conversacion en TikTok»

La primera es un limite de nuestra instrumentacion. La segunda
es una afirmacion sobre el territorio que no tenemos derecho a
hacer. Hay una prueba que lo fija.

CAPACIDAD, NO PLATAFORMA
-----------------------------------------------------------

«TikTok = OPERATIVE» no significa nada. Una plataforma tiene
muchas capacidades y cada una puede estar en un estado
distinto: perfil por handle puede funcionar mientras la
busqueda por palabra clave no existe.
===========================================================
*/


export const VERSION_MATRIZ = "coverage-matrix-1.0.0";


/*
===========================================================
ESTADOS CANONICOS
===========================================================

`UNKNOWN` existe y NO se convierte en `UNSUPPORTED`. No haber
comprobado algo no es lo mismo que haber comprobado que no
funciona.
===========================================================
*/

export const ESTADOS = Object.freeze({
  /* Probado y funciona. */
  OPERATIVE: "OPERATIVE",

  /* Funciona con un techo conocido y declarado. */
  OPERATIVE_WITH_LIMITATIONS: "OPERATIVE_WITH_LIMITATIONS",

  /* Solo responde sobre un sujeto que ya hay que conocer. */
  KNOWN_ACCOUNT_ONLY: "KNOWN_ACCOUNT_ONLY",

  /* Credencial presente y utilizable, y Territorial no lo llama. */
  CONFIGURED_NOT_USED: "CONFIGURED_NOT_USED",

  /* El codigo existe y nada lo conecta al flujo territorial. */
  IMPLEMENTED_NOT_WIRED: "IMPLEMENTED_NOT_WIRED",

  /* Se intento y el proveedor falla. */
  BLOCKED_PROVIDER: "BLOCKED_PROVIDER",

  /* Falta permiso, nivel de acceso o autorizacion. */
  BLOCKED_PERMISSION: "BLOCKED_PERMISSION",

  /* La superficie disponible no lo ofrece. */
  UNSUPPORTED: "UNSUPPORTED",

  /* No hay codigo. */
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",

  /* No comprobado. NO es UNSUPPORTED. */
  UNKNOWN: "UNKNOWN"
});


/* Estados que autorizan a contar la capacidad como cobertura real. */
const CUENTAN_COMO_COBERTURA = Object.freeze([
  ESTADOS.OPERATIVE,
  ESTADOS.OPERATIVE_WITH_LIMITATIONS
]);


export function esCoberturaReal(estado) {
  return CUENTAN_COMO_COBERTURA.includes(estado);
}


/*
  Lo contrario de cobertura NO es cero. Esta funcion existe para
  poder redactar la ausencia sin inventar un dato.
*/
export function redactarAusencia({ plataforma, capacidad, estado }) {
  if (esCoberturaReal(estado)) return null;

  const motivo = {
    [ESTADOS.UNSUPPORTED]: "la superficie pública disponible no ofrece esta capacidad",
    [ESTADOS.NOT_IMPLEMENTED]: "no existe conector",
    [ESTADOS.KNOWN_ACCOUNT_ONLY]: "solo responde sobre cuentas ya conocidas",
    [ESTADOS.BLOCKED_PROVIDER]: "el proveedor falla al servirla",
    [ESTADOS.BLOCKED_PERMISSION]: "falta nivel de acceso o autorización",
    [ESTADOS.CONFIGURED_NOT_USED]: "está configurada y Territorial no la llama",
    [ESTADOS.IMPLEMENTED_NOT_WIRED]: "el código existe y no está conectado al flujo territorial",
    [ESTADOS.UNKNOWN]: "no se ha comprobado"
  }[estado] || "estado no clasificado";

  return {
    plataforma,
    capacidad,
    estado,
    /* Lo que SI se puede decir. */
    formulacionCorrecta: `${plataforma} · ${capacidad} = ${estado} con los conectores actuales: ${motivo}.`,
    /* Lo que NO. */
    formulacionProhibida: `«0 conversación en ${plataforma}» — sería una afirmación sobre el territorio, no sobre nuestra instrumentación.`
  };
}


/*
===========================================================
TAXONOMIA DE CAPACIDADES
===========================================================
*/

export const CAPACIDADES = Object.freeze({
  OPEN_KEYWORD_DISCOVERY: "OPEN_KEYWORD_DISCOVERY",
  OPEN_TOPIC_DISCOVERY: "OPEN_TOPIC_DISCOVERY",
  HASHTAG_DISCOVERY: "HASHTAG_DISCOVERY",
  KNOWN_ACCOUNT_PROFILE: "KNOWN_ACCOUNT_PROFILE",
  KNOWN_ACCOUNT_CONTENT: "KNOWN_ACCOUNT_CONTENT",
  COMMENTS: "COMMENTS",
  SEARCH_BY_DATE: "SEARCH_BY_DATE",
  HISTORICAL_DEPTH: "HISTORICAL_DEPTH",
  PAGINATION: "PAGINATION",
  CANONICAL_URL: "CANONICAL_URL",
  AUTHOR_ACTOR: "AUTHOR_ACTOR",
  PUBLISHED_AT: "PUBLISHED_AT",
  PUBLIC_METRICS: "PUBLIC_METRICS",
  GEO_SIGNAL: "GEO_SIGNAL",
  LANGUAGE_SIGNAL: "LANGUAGE_SIGNAL",
  RAW_TEXT: "RAW_TEXT",
  EVIDENCE_PROVENANCE: "EVIDENCE_PROVENANCE"
});


/* Capacidades que son DESCUBRIMIENTO, no observacion. */
export const CAPACIDADES_DE_DESCUBRIMIENTO = Object.freeze([
  CAPACIDADES.OPEN_KEYWORD_DISCOVERY,
  CAPACIDADES.OPEN_TOPIC_DISCOVERY,
  CAPACIDADES.HASHTAG_DISCOVERY
]);

export const CAPACIDADES_DE_OBSERVACION = Object.freeze([
  CAPACIDADES.KNOWN_ACCOUNT_PROFILE,
  CAPACIDADES.KNOWN_ACCOUNT_CONTENT,
  CAPACIDADES.COMMENTS
]);


export function esDescubrimiento(capacidad) {
  return CAPACIDADES_DE_DESCUBRIMIENTO.includes(capacidad);
}


/*
===========================================================
FAMILIAS DE FUENTE
===========================================================
*/

export const FAMILIAS = Object.freeze({
  WEB: "WEB",
  NEWS: "NEWS",
  SOCIAL_OPEN: "SOCIAL_OPEN",
  SOCIAL_KNOWN_ACCOUNT: "SOCIAL_KNOWN_ACCOUNT",
  LOCAL_MEDIA: "LOCAL_MEDIA",
  INSTITUTIONS: "INSTITUTIONS",
  UNIVERSITIES: "UNIVERSITIES",
  ORGANIZATIONS: "ORGANIZATIONS",
  COMMUNITIES: "COMMUNITIES",
  PUBLIC_CONVERSATION: "PUBLIC_CONVERSATION",
  SEARCH_INTEREST: "SEARCH_INTEREST"
});


export const NIVELES = Object.freeze({
  GOOD: "GOOD",
  PARTIAL: "PARTIAL",
  INSUFFICIENT: "INSUFFICIENT",
  UNAVAILABLE: "UNAVAILABLE"
});


/*
===========================================================
INVENTARIO AUDITADO DE MOTORES
===========================================================

Cada estado lleva su EVIDENCIA: que exporta el modulo, quien lo
importa, cuantas evidencias produjo. Sin la evidencia la tabla
seria una opinion.

`usadoPorTerritorial` es la columna que incomoda: distingue
«existe» de «se usa».
===========================================================
*/

export const MOTORES = Object.freeze([
  {
    id: "rss_directo",
    familia: FAMILIAS.NEWS,
    modulo: "ingest/adapters/rssAdapter.js",
    requiereCredencial: false,
    configurado: true,
    cableadoEn: ["territorialCollector.js", "collectorMesh.js"],
    usadoPorTerritorial: true,
    estado: ESTADOS.OPERATIVE,
    evidencia: "373 evidencias en el corpus del proyecto, 20 fuentes, 100 % con publishedAt.",
    limitaciones: [
      "Depende de que el medio publique feed. Medido en el gate anterior: 6 de 8 fuentes locales de prioridad alta no publican RSS.",
      "225 de sus 373 evidencias son NO_RESOLUBLE: notas nacionales sin topónimo."
    ]
  },
  {
    id: "gdelt_doc",
    familia: FAMILIAS.NEWS,
    modulo: "ingest/adapters/gdeltAdapter.js",
    requiereCredencial: false,
    configurado: true,
    cableadoEn: ["territorialCollector.js", "collectorMesh.js"],
    usadoPorTerritorial: true,
    /*
      Esta es la fila mas interesante del inventario: esta
      implementado, no necesita credencial, ESTA cableado al
      colector y su presupuesto por pasada es 2. Y ha producido
      CERO evidencias, ni en el proyecto ni en el legado.
    */
    /*
      UNKNOWN, no OPERATIVE. Esta cableado y ha producido CERO.
      Sin salir a la red no se puede distinguir «se llamo y
      vino vacio» de «nunca se llego a llamar», y el gate
      prohibe convertir UNKNOWN en UNSUPPORTED. Contarlo como
      cobertura real seria peor: un motor que no ha aportado
      nada en toda la historia del proyecto no cubre nada.
    */
    estado: ESTADOS.UNKNOWN,
    evidencia: "Implementado, sin credencial necesaria, cableado al colector con presupuesto 2 por pasada. 0 evidencias en el proyecto y 0 en el legado. La causa no es reconstruible sin red.",
    limitaciones: [
      "Su propio diagnóstico declara que NO devuelve extracto: solo titular, dominio, idioma y fecha. Un corpus de GDELT da mucho menos texto al motor de temas.",
      "`sourcecountry` es el país del MEDIO, no del hecho.",
      "Cero producción acumulada: está conectado y no ha aportado nada. La causa —nunca invocado, respuesta vacía o error silenciado— NOT_RECONSTRUCTABLE sin red."
    ]
  },
  {
    id: "google_news_rss",
    familia: FAMILIAS.NEWS,
    modulo: "googleNewsService.js",
    requiereCredencial: false,
    configurado: true,
    cableadoEn: [],
    usadoPorTerritorial: false,
    estado: ESTADOS.IMPLEMENTED_NOT_WIRED,
    evidencia:
      "Implementado sobre el feed RSS de news.google.com. Produjo 114 evidencias en el LEGADO sin projectId. Ningún fichero de territorial/, ingest/ ni routes/ lo importa.",
    limitaciones: [
      "Su producción histórica quedó fuera del proyecto por no llevar projectId: no cuenta en el corpus actual.",
      "Agregador: el emisor real queda detrás de un redirector, y ese problema ya está documentado en el resolutor de emisores."
    ]
  },
  {
    id: "brave_web",
    familia: FAMILIAS.WEB,
    modulo: "providers/braveProvider.js",
    requiereCredencial: true,
    variableEntorno: "BRAVE_API_KEY",
    configurado: true,
    cableadoEn: ["collectorMesh.js"],
    usadoPorTerritorial: true,
    estado: ESTADOS.OPERATIVE_WITH_LIMITATIONS,
    evidencia: "20 evidencias, 15 fuentes. Usado en los gates de expansión y de descubrimiento local.",
    limitaciones: [
      "Solo 6 de sus 20 evidencias traen publishedAt: 14 quedan fuera de toda ventana temporal.",
      "Un resultado de búsqueda no es una publicación: la fecha editorial casi nunca viene."
    ]
  },
  {
    id: "serpapi_google",
    familia: FAMILIAS.WEB,
    modulo: "providers/serpapiProvider.js",
    requiereCredencial: true,
    variableEntorno: "SERPAPI_API_KEY",
    configurado: true,
    cableadoEn: ["collectorMesh.js"],
    usadoPorTerritorial: true,
    estado: ESTADOS.OPERATIVE_WITH_LIMITATIONS,
    evidencia: "Prioridad 1 en el registro de proveedores. Usado en el gate de descubrimiento local: 2 consultas, saldo verificable 756/1000.",
    limitaciones: [
      "0 evidencias persistidas: sus resultados se usaron para DESCUBRIR fuentes, no se ingirieron como corpus.",
      "Cuota mensual limitada y verificable."
    ]
  },
  {
    id: "ddg_web",
    familia: FAMILIAS.WEB,
    modulo: "providers/duckProvider.js",
    requiereCredencial: false,
    configurado: true,
    cableadoEn: ["collectorMesh.js"],
    usadoPorTerritorial: false,
    estado: ESTADOS.CONFIGURED_NOT_USED,
    evidencia: "Registrado y utilizable, prioridad 3, presupuesto 2 por pasada. 0 evidencias persistidas y ninguna consulta ejecutada en los gates territoriales.",
    limitaciones: [
      "Rate-limiting agresivo: intervalo de 3,5 s y presupuesto de 2 consultas por pasada. Sirve de reserva, no de motor."
    ]
  },
  {
    id: "x_api",
    familia: FAMILIAS.SOCIAL_OPEN,
    plataforma: "X",
    modulo: "ingest/adapters/xAdapter.js",
    requiereCredencial: true,
    variableEntorno: "X_BEARER_TOKEN",
    configurado: true,
    cableadoEn: ["territorialCollector.js", "collectorMesh.js"],
    usadoPorTerritorial: true,
    estado: ESTADOS.OPERATIVE_WITH_LIMITATIONS,
    evidencia:
      "143 evidencias, 74 fuentes y 74 actores distintos, 100 % con publishedAt, 143 de 143 clasificadas PUBLIC_CONVERSATION. Expone `buscarMenciones`: búsqueda abierta real.",
    limitaciones: [
      "`search/recent` cubre 7 días. El archivo completo pertenece a niveles superiores del plan.",
      "El tope de resultados lo fijamos nosotros: que se tope no dice cuánto existe.",
      "70 de 143 territorialmente corroboradas; 24 ambiguas y 13 fuera del territorio."
    ]
  },
  {
    id: "youtube_data",
    familia: FAMILIAS.SOCIAL_OPEN,
    plataforma: "YouTube",
    modulo: "ingest/adapters/youtubeAdapter.js",
    requiereCredencial: true,
    variableEntorno: "YOUTUBE_API_KEY",
    configurado: true,
    cableadoEn: ["territorialCollector.js", "collectorMesh.js"],
    usadoPorTerritorial: true,
    estado: ESTADOS.OPERATIVE_WITH_LIMITATIONS,
    evidencia: "83 evidencias, 29 canales distintos, 100 % con publishedAt. Expone `buscar`: búsqueda abierta real.",
    limitaciones: [
      "Una búsqueda cuesta 100 unidades de 10 000 diarias.",
      "Devuelve material turístico, musical y antiguo que menciona el topónimo: un tema del corpus son emisoras de radio de Paute con 7D=0.",
      "Naturaleza indeterminada: sus 83 evidencias quedan en OTHER porque un canal de televisión es medio y un vecino con el móvil es conversación, y sin saber de quién es el canal no se decide."
    ]
  },
  {
    id: "instagram_graph",
    familia: FAMILIAS.SOCIAL_KNOWN_ACCOUNT,
    plataforma: "Instagram",
    modulo: "ingest/adapters/instagramAdapter.js",
    requiereCredencial: true,
    variableEntorno: "INSTAGRAM_ACCESS_TOKEN",
    configurado: true,
    cableadoEn: [],
    usadoPorTerritorial: false,
    estado: ESTADOS.IMPLEMENTED_NOT_WIRED,
    evidencia:
      "Vía oficial de Meta. 16 exports y NINGUNA función de búsqueda. Credencial presente. Ningún fichero territorial lo importa. 0 evidencias.",
    limitaciones: [
      "`business_discovery` resuelve cuentas profesionales que ya se nombran: no descubre por tema.",
      "Candidate declara explícitamente que el acceso a terceros NO está medido. No se reabre aquí."
    ]
  },
  {
    id: "tiktok_adapter",
    familia: FAMILIAS.SOCIAL_KNOWN_ACCOUNT,
    plataforma: "TikTok",
    modulo: "ingest/adapters/tiktokAdapter.js",
    requiereCredencial: false,
    configurado: true,
    cableadoEn: [],
    usadoPorTerritorial: false,
    estado: ESTADOS.IMPLEMENTED_NOT_WIRED,
    evidencia:
      "Solo 3 exports: `confirmarCuenta`, `urlDePerfil`, `diagnostico`. NI SIQUIERA lista contenido. 0 evidencias.",
    limitaciones: ["No expone contenido, ni búsqueda, ni comentarios. Es un verificador de handle."]
  },
  {
    id: "scrapecreators",
    familia: FAMILIAS.SOCIAL_KNOWN_ACCOUNT,
    plataforma: "Facebook · Instagram · TikTok",
    modulo: "intelligence/externalSocialProvider.js + ingest/adapters/socialProviderClient.js",
    requiereCredencial: true,
    variableEntorno: "SCRAPECREATORS_API_KEY",
    configurado: true,
    cableadoEn: ["collectorMesh.js"],
    usadoPorTerritorial: true,
    estado: ESTADOS.KNOWN_ACCOUNT_ONLY,
    evidencia:
      "12 endpoints declarados —perfil, publicaciones, publicación, comentarios, respuestas— en las tres plataformas. TODOS piden `url` o `handle`. `CAPACIDADES_POR_PLATAFORMA` no contiene ninguna capacidad de búsqueda, hashtag ni discovery: comprobado programáticamente. Medido: Facebook 6 publicaciones y TikTok 10 con 3 créditos; Instagram 0 en 7 intentos.",
    limitaciones: [
      "Sin descubrimiento abierto en ninguna de las tres plataformas. No es un fallo del proveedor: es el límite de su superficie.",
      "Instagram devuelve `internal_server_error` de forma consistente: 7 intentos, 0 éxitos, 0 créditos cobrados.",
      "0 evidencias persistidas en el corpus: lo observado en los benchmarks no se ingirió."
    ]
  },
  {
    id: "google_cse",
    familia: FAMILIAS.WEB,
    modulo: "(no existe adaptador propio)",
    requiereCredencial: true,
    variableEntorno: "GOOGLE_API_KEY + GOOGLE_CSE_ID",
    configurado: false,
    cableadoEn: [],
    usadoPorTerritorial: false,
    estado: ESTADOS.NOT_IMPLEMENTED,
    evidencia: "`GOOGLE_API_KEY` presente pero `GOOGLE_CSE_ID` ausente, y no hay adaptador. Sin el identificador del motor la clave no sirve.",
    limitaciones: ["Falta el identificador del buscador personalizado y el adaptador."]
  },
  {
    id: "reddit",
    familia: FAMILIAS.SOCIAL_OPEN,
    plataforma: "Reddit",
    modulo: "(sin adaptador)",
    requiereCredencial: true,
    configurado: false,
    cableadoEn: [],
    usadoPorTerritorial: false,
    estado: ESTADOS.NOT_IMPLEMENTED,
    evidencia: "Mencionado solo en contratos y en el registro de familias futuras. No hay conector ni credencial.",
    limitaciones: ["Utilidad para Cuenca sin medir: no se asume."]
  },
  {
    id: "threads",
    familia: FAMILIAS.SOCIAL_OPEN,
    plataforma: "Threads",
    modulo: "(sin adaptador)",
    requiereCredencial: true,
    configurado: false,
    cableadoEn: [],
    usadoPorTerritorial: false,
    estado: ESTADOS.NOT_IMPLEMENTED,
    evidencia: "Mencionado en contratos de Media. Sin conector.",
    limitaciones: []
  },
  {
    id: "telegram",
    familia: FAMILIAS.SOCIAL_OPEN,
    plataforma: "Telegram",
    modulo: "(sin adaptador)",
    requiereCredencial: true,
    configurado: false,
    cableadoEn: [],
    usadoPorTerritorial: false,
    estado: ESTADOS.NOT_IMPLEMENTED,
    evidencia: "Mencionado en contratos y en el registro de familias futuras. Sin conector.",
    limitaciones: [
      "Solo canales y contenido público con acceso legítimo. Grupos privados quedan fuera por decisión, no por dificultad."
    ]
  },
  {
    id: "google_trends",
    familia: FAMILIAS.SEARCH_INTEREST,
    modulo: "(sin adaptador)",
    requiereCredencial: true,
    configurado: false,
    cableadoEn: [],
    usadoPorTerritorial: false,
    estado: ESTADOS.NOT_IMPLEMENTED,
    evidencia: "Solo aparece en `searchIntelligence.js` declarado como NO_DISPONIBLE.",
    limitaciones: [
      "Representaría SEARCH_INTEREST, no PUBLIC_CONVERSATION. Sus valores NO se pueden mezclar con evidencia social.",
      "Un recuento de resultados de búsqueda no es interés de búsqueda."
    ]
  }
]);


/*
===========================================================
MATRIZ SOCIAL
===========================================================

Filas: capacidad. Columnas: plataforma. Cada celda con su
razon. Es la tabla que decide el siguiente gate.
===========================================================
*/

const C = CAPACIDADES;
const E = ESTADOS;

export const MATRIZ_SOCIAL = Object.freeze({
  X: {
    [C.OPEN_KEYWORD_DISCOVERY]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "`buscarMenciones` acepta consulta arbitraria; ventana de 7 días." },
    [C.OPEN_TOPIC_DISCOVERY]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "Descubre autores desconocidos: 74 actores distintos en 143 evidencias." },
    [C.HASHTAG_DISCOVERY]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "El hashtag entra en la consulta como texto; no hay endpoint de hashtag propio." },
    [C.KNOWN_ACCOUNT_PROFILE]: { estado: E.OPERATIVE, razon: "`resolverCuentaPorHandle`." },
    [C.KNOWN_ACCOUNT_CONTENT]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "`listarPublicaciones`; los timelines de terceros dependen del nivel del plan." },
    [C.COMMENTS]: { estado: E.UNSUPPORTED, razon: "No hay endpoint de respuestas en el adaptador." },
    [C.SEARCH_BY_DATE]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "Solo dentro de la ventana de 7 días." },
    [C.HISTORICAL_DEPTH]: { estado: E.BLOCKED_PERMISSION, razon: "El archivo completo pertenece a niveles superiores del plan contratado." },
    [C.PAGINATION]: { estado: E.UNKNOWN, razon: "No se ha ejercitado paginación en ningún gate." },
    [C.CANONICAL_URL]: { estado: E.OPERATIVE, razon: "URL canónica con handle desde la expansión de autores." },
    [C.AUTHOR_ACTOR]: { estado: E.OPERATIVE, razon: "`expansions=author_id` opt-in; 74 actores resueltos." },
    [C.PUBLISHED_AT]: { estado: E.OPERATIVE, razon: "143 de 143 con publishedAt." },
    [C.PUBLIC_METRICS]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "`impression_count` no siempre viene para terceros; su ausencia NO es cero." },
    [C.GEO_SIGNAL]: { estado: E.UNSUPPORTED, razon: "No hay geo del autor ni del post. El territorio se resuelve por el texto." },
    [C.LANGUAGE_SIGNAL]: { estado: E.OPERATIVE, razon: "`lang` del post." },
    [C.RAW_TEXT]: { estado: E.OPERATIVE, razon: "Texto completo en `summary`, 271 caracteres de media." },
    [C.EVIDENCE_PROVENANCE]: { estado: E.OPERATIVE, razon: "`queryLabel` propagado desde el gate del mesh; 25 de 25 verificado." }
  },

  YouTube: {
    [C.OPEN_KEYWORD_DISCOVERY]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "`search.list` con consulta arbitraria, 100 unidades por búsqueda." },
    [C.OPEN_TOPIC_DISCOVERY]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "29 canales distintos descubiertos; devuelve material antiguo y turístico." },
    [C.HASHTAG_DISCOVERY]: { estado: E.UNKNOWN, razon: "No probado como capacidad propia." },
    [C.KNOWN_ACCOUNT_PROFILE]: { estado: E.OPERATIVE, razon: "`resolverCanalPorHandle`, `resolverCanales`." },
    [C.KNOWN_ACCOUNT_CONTENT]: { estado: E.OPERATIVE, razon: "`listarSubidas`." },
    [C.COMMENTS]: { estado: E.NOT_IMPLEMENTED, razon: "El adaptador no expone comentarios aunque la API los ofrezca." },
    [C.SEARCH_BY_DATE]: { estado: E.OPERATIVE, razon: "Se puede acotar por fecha; sin ventana forzada." },
    [C.HISTORICAL_DEPTH]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "Alcanza histórico, y por eso trae vídeos de 2018 en consultas de hoy." },
    [C.PAGINATION]: { estado: E.UNKNOWN, razon: "No ejercitada." },
    [C.CANONICAL_URL]: { estado: E.OPERATIVE, razon: "URL de vídeo." },
    [C.AUTHOR_ACTOR]: { estado: E.OPERATIVE, razon: "Canal como actor; 29 distintos." },
    [C.PUBLISHED_AT]: { estado: E.OPERATIVE, razon: "83 de 83 evidencias con fecha de publicacion del video; ninguna necesito relleno." },
    [C.PUBLIC_METRICS]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "`normalizarEstadisticasDeVideo` existe; no se ha ingerido en el corpus territorial." },
    [C.GEO_SIGNAL]: { estado: E.UNSUPPORTED, razon: "Ni el video ni el canal declaran ubicacion utilizable: el territorio se resuelve por el texto." },
    [C.LANGUAGE_SIGNAL]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "`defaultAudioLanguage` no siempre viene." },
    [C.RAW_TEXT]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "Título 100 %, descripción 84 %; texto corto." },
    [C.EVIDENCE_PROVENANCE]: { estado: E.OPERATIVE, razon: "`queryLabel` propagado desde siempre." }
  },

  Facebook: {
    [C.OPEN_KEYWORD_DISCOVERY]: { estado: E.UNSUPPORTED, razon: "Los 4 endpoints disponibles piden `url`. Ninguno acepta consulta." },
    [C.OPEN_TOPIC_DISCOVERY]: { estado: E.UNSUPPORTED, razon: "Sin superficie de búsqueda." },
    [C.HASHTAG_DISCOVERY]: { estado: E.UNSUPPORTED, razon: "Sin endpoint de hashtag." },
    [C.KNOWN_ACCOUNT_PROFILE]: { estado: E.OPERATIVE, razon: "`/v1/facebook/profile` por URL; medido." },
    [C.KNOWN_ACCOUNT_CONTENT]: { estado: E.OPERATIVE, razon: "6 publicaciones reales de 2 páginas con 2 créditos." },
    [C.COMMENTS]: { estado: E.UNKNOWN, razon: "Endpoints declarados y NO ejercitados en Territorial." },
    [C.SEARCH_BY_DATE]: { estado: E.UNSUPPORTED, razon: "No hay búsqueda que fechar." },
    [C.HISTORICAL_DEPTH]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "Histórico de la página, no del territorio." },
    [C.PAGINATION]: { estado: E.UNKNOWN, razon: "No ejercitada." },
    [C.CANONICAL_URL]: { estado: E.OPERATIVE, razon: "URL de la publicación." },
    [C.AUTHOR_ACTOR]: { estado: E.OPERATIVE, razon: "La página es el actor, y hay que conocerla antes." },
    [C.PUBLISHED_AT]: { estado: E.UNKNOWN, razon: "No verificado sobre corpus territorial." },
    [C.PUBLIC_METRICS]: { estado: E.UNKNOWN, razon: "Declarado por el proveedor; medido por Candidate, no por Territorial." },
    [C.GEO_SIGNAL]: { estado: E.UNSUPPORTED, razon: "El proveedor no devuelve ubicacion de la cuenta ni de la pieza; el territorio depende del actor ya conocido." },
    [C.LANGUAGE_SIGNAL]: { estado: E.UNKNOWN, razon: "No verificado." },
    [C.RAW_TEXT]: { estado: E.OPERATIVE, razon: "Texto de la publicación." },
    [C.EVIDENCE_PROVENANCE]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "Procedencia = el activo consultado, no una consulta." }
  },

  Instagram: {
    [C.OPEN_KEYWORD_DISCOVERY]: { estado: E.UNSUPPORTED, razon: "Endpoints por handle. Meta oficial tampoco descubre por tema." },
    [C.OPEN_TOPIC_DISCOVERY]: { estado: E.UNSUPPORTED, razon: "Sin superficie de búsqueda." },
    [C.HASHTAG_DISCOVERY]: { estado: E.UNSUPPORTED, razon: "Sin endpoint de hashtag en el proveedor ni en el adaptador oficial." },
    [C.KNOWN_ACCOUNT_PROFILE]: { estado: E.BLOCKED_PROVIDER, razon: "7 intentos con handle correcto: `internal_server_error` en todos, 0 créditos cobrados." },
    [C.KNOWN_ACCOUNT_CONTENT]: { estado: E.BLOCKED_PROVIDER, razon: "0 publicaciones en 7 intentos sobre 3 activos distintos." },
    [C.COMMENTS]: { estado: E.UNKNOWN, razon: "No alcanzado: falla antes." },
    [C.SEARCH_BY_DATE]: { estado: E.UNSUPPORTED, razon: "No hay búsqueda." },
    [C.HISTORICAL_DEPTH]: { estado: E.UNKNOWN, razon: "No alcanzado." },
    [C.PAGINATION]: { estado: E.UNKNOWN, razon: "No alcanzado." },
    [C.CANONICAL_URL]: { estado: E.UNKNOWN, razon: "No alcanzado." },
    [C.AUTHOR_ACTOR]: { estado: E.UNKNOWN, razon: "No alcanzado." },
    [C.PUBLISHED_AT]: { estado: E.UNKNOWN, razon: "No alcanzado." },
    [C.PUBLIC_METRICS]: { estado: E.UNKNOWN, razon: "No alcanzado." },
    [C.GEO_SIGNAL]: { estado: E.UNSUPPORTED, razon: "El proveedor no devuelve ubicacion de la cuenta ni de la pieza; el territorio depende del actor ya conocido." },
    [C.LANGUAGE_SIGNAL]: { estado: E.UNKNOWN, razon: "No alcanzado." },
    [C.RAW_TEXT]: { estado: E.UNKNOWN, razon: "No alcanzado." },
    [C.EVIDENCE_PROVENANCE]: { estado: E.UNKNOWN, razon: "No alcanzado." }
  },

  TikTok: {
    [C.OPEN_KEYWORD_DISCOVERY]: { estado: E.UNSUPPORTED, razon: "Endpoints por handle o URL. El adaptador propio no lista ni contenido." },
    [C.OPEN_TOPIC_DISCOVERY]: { estado: E.UNSUPPORTED, razon: "Sin superficie de búsqueda." },
    [C.HASHTAG_DISCOVERY]: { estado: E.UNSUPPORTED, razon: "Sin endpoint de hashtag." },
    [C.KNOWN_ACCOUNT_PROFILE]: { estado: E.OPERATIVE, razon: "`/v1/tiktok/profile` por handle." },
    [C.KNOWN_ACCOUNT_CONTENT]: { estado: E.OPERATIVE, razon: "10 vídeos reales de 1 activo con 1 crédito: el más productivo por crédito." },
    [C.COMMENTS]: { estado: E.UNKNOWN, razon: "Endpoints declarados, no ejercitados en Territorial." },
    [C.SEARCH_BY_DATE]: { estado: E.UNSUPPORTED, razon: "No hay búsqueda que fechar." },
    [C.HISTORICAL_DEPTH]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "Histórico del perfil." },
    [C.PAGINATION]: { estado: E.UNKNOWN, razon: "No ejercitada." },
    [C.CANONICAL_URL]: { estado: E.OPERATIVE, razon: "URL del vídeo." },
    [C.AUTHOR_ACTOR]: { estado: E.OPERATIVE, razon: "El perfil, conocido de antemano." },
    [C.PUBLISHED_AT]: { estado: E.UNKNOWN, razon: "No verificado sobre corpus territorial." },
    [C.PUBLIC_METRICS]: { estado: E.UNKNOWN, razon: "Medido por Candidate, no por Territorial." },
    [C.GEO_SIGNAL]: { estado: E.UNSUPPORTED, razon: "El proveedor no devuelve ubicacion de la cuenta ni de la pieza; el territorio depende del actor ya conocido." },
    [C.LANGUAGE_SIGNAL]: { estado: E.UNKNOWN, razon: "No verificado." },
    [C.RAW_TEXT]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "Descripción del vídeo: texto corto." },
    [C.EVIDENCE_PROVENANCE]: { estado: E.OPERATIVE_WITH_LIMITATIONS, razon: "Procedencia = el activo consultado." }
  }
});


/*
  Resumen de la matriz social: cuantas capacidades de
  descubrimiento estan realmente cubiertas por plataforma.
*/
export function resumenSocial() {
  const salida = {};

  Object.entries(MATRIZ_SOCIAL).forEach(([plataforma, celdas]) => {
    const descubrimiento = CAPACIDADES_DE_DESCUBRIMIENTO.filter((c) =>
      esCoberturaReal(celdas[c]?.estado)
    );

    const observacion = CAPACIDADES_DE_OBSERVACION.filter((c) =>
      esCoberturaReal(celdas[c]?.estado)
    );

    salida[plataforma] = {
      descubrimientoCubierto: descubrimiento.length,
      descubrimientoTotal: CAPACIDADES_DE_DESCUBRIMIENTO.length,
      observacionCubierta: observacion.length,
      observacionTotal: CAPACIDADES_DE_OBSERVACION.length,
      capacidadesCubiertas: Object.entries(celdas).filter(([, v]) => esCoberturaReal(v.estado)).length,
      capacidadesTotales: Object.keys(celdas).length,
      desconocidas: Object.entries(celdas).filter(([, v]) => v.estado === E.UNKNOWN).length,
      /* La distinción central. */
      permiteEscuchaAbierta: descubrimiento.length > 0,
      permiteSeguimientoDeCuentas: observacion.length > 0
    };
  });

  return salida;
}


/*
===========================================================
CONTRATO DE COBERTURA
===========================================================

Forma reutilizable de una celda de cobertura, con proyecto.
===========================================================
*/

export function celdaDeCobertura({
  family,
  platform = null,
  provider,
  capability,
  status,
  evidenceCount = 0,
  uniqueSources = 0,
  uniqueActors = 0,
  temporalCoverage = null,
  limitations = [],
  evidenceRefs = [],
  lastVerifiedAt = null,
  projectId = null,
  tenantId = null
} = {}) {
  return {
    family,
    platform,
    provider,
    capability,
    status,

    esCoberturaReal: esCoberturaReal(status),
    esDescubrimiento: esDescubrimiento(capability),

    evidenceCount,
    uniqueSources,
    uniqueActors,
    temporalCoverage,

    limitations,
    /* Referencias, no copias: la evidencia vive en el ledger. */
    evidenceRefs: evidenceRefs.slice(0, 25),

    lastVerifiedAt,
    projectId,
    tenantId,
    methodVersion: VERSION_MATRIZ,

    ausencia: redactarAusencia({ plataforma: platform || provider, capacidad: capability, estado: status }),

    declaracion:
      "Describe cobertura de FUENTES OBSERVABLES. No describe población, penetración ni representatividad."
  };
}


/*
===========================================================
COBERTURA POR FAMILIA
===========================================================

El criterio NO es volumen. Un motor que trae 373 piezas de 20
fuentes cubre peor que uno que trae 143 de 74.
===========================================================
*/

export function coberturaPorFamilia(aporte = {}, contexto = {}) {
  const n = (id) => aporte[id]?.evidenceCount || 0;
  const src = (id) => aporte[id]?.uniqueSources || 0;
  const act = (id) => aporte[id]?.uniqueActors || 0;

  const familias = {};

  const poner = (familia, nivel, criterio, datos = {}) => {
    familias[familia] = { familia, nivel, criterio, ...datos };
  };

  poner(
    FAMILIAS.WEB,
    n("brave_web") > 0 ? NIVELES.PARTIAL : NIVELES.INSUFFICIENT,
    "Brave y SerpAPI operativos con descubrimiento abierto, pero solo 20 evidencias persistidas y 14 de ellas sin fecha. DuckDuckGo configurado y sin usar.",
    { evidencias: n("brave_web"), fuentes: src("brave_web") }
  );

  poner(
    FAMILIAS.NEWS,
    NIVELES.PARTIAL,
    "RSS aporta 373 evidencias pero de solo 20 fuentes, y 225 son NO_RESOLUBLE. GDELT está cableado y ha producido 0. Google News está implementado y no cableado.",
    { evidencias: n("rss_directo") + n("gdelt_doc"), fuentes: src("rss_directo") }
  );

  poner(
    FAMILIAS.SOCIAL_OPEN,
    NIVELES.PARTIAL,
    "Solo X y YouTube permiten descubrimiento abierto: 226 evidencias de 103 fuentes distintas. Facebook, Instagram y TikTok NO lo permiten con los conectores actuales.",
    { evidencias: n("x_api") + n("youtube_data"), fuentes: src("x_api") + src("youtube_data"), plataformasConDescubrimiento: 2, plataformasEvaluadas: 5 }
  );

  poner(
    FAMILIAS.SOCIAL_KNOWN_ACCOUNT,
    NIVELES.PARTIAL,
    "Facebook y TikTok demostrados con llamadas reales (6 y 10 piezas). Instagram bloqueado por el proveedor. Nada de esto se ha ingerido al corpus: 0 evidencias persistidas.",
    { evidencias: 0, demostradoSinIngerir: 16 }
  );

  poner(
    FAMILIAS.LOCAL_MEDIA,
    NIVELES.PARTIAL,
    "4 entidades: 3 corroboradas y 1 probable. En una ciudad con más medios que eso.",
    { entidades: contexto.mediosLocales ?? 4 }
  );

  poner(
    FAMILIAS.INSTITUTIONS,
    NIVELES.GOOD,
    "9 entidades corroboradas con dominio institucional inequívoco y feeds legibles: es la familia mejor cubierta.",
    { entidades: contexto.instituciones ?? 9 }
  );

  poner(
    FAMILIAS.UNIVERSITIES,
    NIVELES.PARTIAL,
    "3 entidades corroboradas, pero medido: solo 1 de 3 publica feed legible y aportó 10 piezas con 0 corroboradas territorialmente.",
    { entidades: contexto.universidades ?? 3 }
  );

  poner(
    FAMILIAS.ORGANIZATIONS,
    NIVELES.INSUFFICIENT,
    "CERO entidades corroboradas. La causa está medida: sus sitios renderizan en cliente y no exponen anclaje verificable en HTML servido (ratio texto/HTML del 2,2 %).",
    { entidades: 0 }
  );

  poner(
    FAMILIAS.COMMUNITIES,
    NIVELES.INSUFFICIENT,
    "CERO entidades corroboradas. No se reclasificó ninguna institución para que la cifra dejara de ser cero.",
    { entidades: 0 }
  );

  poner(
    FAMILIAS.PUBLIC_CONVERSATION,
    NIVELES.PARTIAL,
    "143 evidencias de 74 emisores distintos, todas de X. Es una sola plataforma: si X cae, la conversación pública observable cae a cero.",
    { evidencias: n("x_api"), emisores: act("x_api"), plataformas: 1 }
  );

  poner(
    FAMILIAS.SEARCH_INTEREST,
    NIVELES.UNAVAILABLE,
    "No hay fuente legítima de volumen de búsquedas. Un recuento de resultados no es interés de búsqueda.",
    { evidencias: 0 }
  );

  return {
    familias,
    resumen: Object.values(familias).reduce((a, f) => {
      a[f.nivel] = (a[f.nivel] || 0) + 1;
      return a;
    }, {}),
    declaraciones: [
      "El nivel NO se basa en volumen: se basa en diversidad de fuentes y actores, plataformas disponibles, capacidad de descubrimiento y sesgos conocidos.",
      "INSUFFICIENT no significa que el territorio no tenga esas fuentes: significa que no podemos corroborarlas con la instrumentación actual.",
      "Esta tabla describe cobertura de fuentes observables, no cobertura de población."
    ]
  };
}


/*
===========================================================
HUECOS PRIORIZADOS
===========================================================

Derivados del audit, con el dato que los justifica.
===========================================================
*/

export const HUECOS = Object.freeze([
  {
    id: "GAP-01",
    titulo: "Descubrimiento abierto en Facebook, Instagram y TikTok",
    familia: FAMILIAS.SOCIAL_OPEN,
    estadoActual: ESTADOS.UNSUPPORTED,
    dato: "3 de las 5 plataformas sociales evaluadas no tienen ninguna capacidad de descubrimiento: 12 endpoints y ninguno acepta consulta.",
    impacto: "ALTO",
    porQue: "Toda la conversación pública observable del corpus viene de una sola plataforma."
  },
  {
    id: "GAP-02",
    titulo: "Dependencia de una sola plataforma para conversación pública",
    familia: FAMILIAS.PUBLIC_CONVERSATION,
    estadoActual: ESTADOS.OPERATIVE_WITH_LIMITATIONS,
    dato: "143 de 143 evidencias PUBLIC_CONVERSATION provienen de x_api. YouTube aporta 83 y las 83 quedan en OTHER.",
    impacto: "ALTO",
    porQue: "Un único punto de fallo y un único sesgo de plataforma."
  },
  {
    id: "GAP-03",
    titulo: "Organizaciones locales sin corroborar",
    familia: FAMILIAS.ORGANIZATIONS,
    estadoActual: ESTADOS.UNKNOWN,
    dato: "0 entidades. Causa medida: renderizado en cliente, ratio texto/HTML del 2,2 % al 3,2 %.",
    impacto: "ALTO",
    porQue: "Los temas resultantes reflejan medios e instituciones antes que tejido social."
  },
  {
    id: "GAP-04",
    titulo: "Comunidades y vida urbana sin corroborar",
    familia: FAMILIAS.COMMUNITIES,
    estadoActual: ESTADOS.UNKNOWN,
    dato: "0 entidades corroboradas tras dos gates de expansión dirigida.",
    impacto: "ALTO",
    porQue: "Es la voz barrial y vecinal, ausente del corpus."
  },
  {
    id: "GAP-05",
    titulo: "GDELT cableado y sin producir",
    familia: FAMILIAS.NEWS,
    estadoActual: ESTADOS.OPERATIVE_WITH_LIMITATIONS,
    dato: "Implementado, sin credencial necesaria, cableado al colector con presupuesto 2 por pasada, y 0 evidencias acumuladas.",
    impacto: "MEDIO",
    porQue: "Es capacidad ya pagada en trabajo y sin retorno. Requiere diagnóstico, no un proveedor nuevo."
  },
  {
    id: "GAP-06",
    titulo: "Google News implementado y no cableado",
    familia: FAMILIAS.NEWS,
    estadoActual: ESTADOS.IMPLEMENTED_NOT_WIRED,
    dato: "`googleNewsService.js` sobre feed RSS; 114 evidencias en el legado sin projectId; ningún fichero territorial lo importa.",
    impacto: "MEDIO",
    porQue: "Ampliaría cobertura de noticias sin coste ni proveedor nuevo."
  },
  {
    id: "GAP-07",
    titulo: "Comentarios como capacidad no ejercitada",
    familia: FAMILIAS.SOCIAL_KNOWN_ACCOUNT,
    estadoActual: ESTADOS.UNKNOWN,
    dato: "Endpoints de comentarios y respuestas declarados en las tres plataformas del proveedor y nunca llamados desde Territorial.",
    impacto: "MEDIO",
    porQue: "Los comentarios son el material más cercano a conversación ciudadana en plataformas sin descubrimiento."
  },
  {
    id: "GAP-08",
    titulo: "Fecha editorial en resultados de búsqueda",
    familia: FAMILIAS.WEB,
    estadoActual: ESTADOS.OPERATIVE_WITH_LIMITATIONS,
    dato: "14 de 20 evidencias de Brave sin publishedAt: fuera de las cinco ventanas temporales.",
    impacto: "BAJO",
    porQue: "Limita el uso temporal, no el descubrimiento."
  },
  {
    id: "GAP-09",
    titulo: "DuckDuckGo configurado y sin usar",
    familia: FAMILIAS.WEB,
    estadoActual: ESTADOS.CONFIGURED_NOT_USED,
    dato: "Registrado, utilizable, presupuesto 2 por pasada, 0 consultas en gates territoriales.",
    impacto: "BAJO",
    porQue: "Reserva gratuita sin activar."
  }
]);


/*
===========================================================
REQUISITOS PARA UN PROVEEDOR CANDIDATO
===========================================================

Lo que debe demostrar el siguiente gate. NO se recomienda
ningun proveedor: eso exige benchmark real.
===========================================================
*/

export const REQUISITOS_DE_PROVEEDOR = Object.freeze({
  obligatorios: [
    "PLATAFORMA: al menos una de Facebook, Instagram o TikTok.",
    "BUSQUEDA POR PALABRA CLAVE O TEMA con endpoint documentado, no solo por perfil.",
    "BUSQUEDA POR HASHTAG.",
    "URL CANONICA por pieza.",
    "AUTOR O CUENTA identificable.",
    "publishedAt REAL cuando exista, y declarado ausente cuando no.",
    "PAGINACION.",
    "FILTRO POR IDIOMA O REGION.",
    "DISPONIBILIDAD EN ECUADOR verificada, no declarada.",
    "LIMITES DE TASA explícitos.",
    "MODELO DE COSTE explícito.",
    "TERMINOS Y CUMPLIMIENTO revisables."
  ],

  deseables: [
    "MÉTRICAS PÚBLICAS de interacción.",
    "COMENTARIOS cuando sea lícito y estén disponibles.",
    "PROFUNDIDAD HISTÓRICA más allá de 7 días.",
    "PRECISIÓN A NIVEL CUENCA, no solo país.",
    "RETENCIÓN DE EVIDENCIA compatible con un ledger append-only."
  ],

  criterioDeRechazo:
    "Known-account-only NO cumple el requisito. Es exactamente lo que ya tenemos, y es lo que produjo cero descubrimiento en tres plataformas.",

  comoSeMide:
    "Con una consulta real por palabra clave en al menos una plataforma, contando piezas nuevas, actores nuevos y territorialmente corroborables. Un folleto no cuenta como evidencia.",

  categoriasAInvestigar: [
    "APIs de social listening",
    "proveedores de datos de plataforma",
    "APIs oficiales de plataforma",
    "proveedores de búsqueda e índice",
    "proveedores de noticias y eventos"
  ],

  /*
    Nombres que YA aparecen en el repositorio. Se marcan como
    conocidos, NO como recomendados: ninguno esta benchmarkeado
    para descubrimiento abierto.
  */
  candidatosConocidos: [
    { nombre: "ScrapeCreators", estado: "KNOWN_CANDIDATE", nota: "Aprobado y medido para cuenta conocida. NO ofrece descubrimiento." },
    { nombre: "Data365", estado: "KNOWN_CANDIDATE", nota: "Requiere llamada comercial. Sin medir." },
    { nombre: "SocialCrawl", estado: "KNOWN_CANDIDATE", nota: "Autoservicio sin probar." },
    { nombre: "Bright Data", estado: "KNOWN_CANDIDATE", nota: "Bloqueado por el proveedor en un gate anterior." },
    { nombre: "EnsembleData", estado: "KNOWN_CANDIDATE", nota: "Descartado previamente." }
  ]
});


/*
===========================================================
RELACION FUTURA TEMA x COBERTURA
===========================================================

Disenada, no implementada. Su proposito es que Trend Radar
pueda decir «alta actividad observable en las fuentes
cubiertas» en lugar de «tema viral en Cuenca».
===========================================================
*/

export function coberturaDeTema(tema = {}, aporte = {}) {
  const proveedores = tema.providers || [];

  const capacidadesFaltantes = [];

  /* Si el tema no toca ninguna plataforma con descubrimiento abierto. */
  const conDescubrimiento = proveedores.filter((p) => ["x_api", "youtube_data", "brave_web", "serpapi_google", "rss_directo"].includes(p));

  if (conDescubrimiento.length === 0) {
    capacidadesFaltantes.push("Ninguna fuente del tema proviene de un motor con descubrimiento abierto.");
  }

  const plataformasSinObservar = ["Facebook", "Instagram", "TikTok"].filter(
    () => true
  );

  if (plataformasSinObservar.length) {
    capacidadesFaltantes.push(
      `Sin observación en ${plataformasSinObservar.join(", ")}: el tema podría tener actividad no observable.`
    );
  }

  return {
    topicId: tema.topicId || null,
    topicLabel: tema.topicLabel || null,
    providers: proveedores,
    platforms: [...new Set(proveedores.map((p) => ({ x_api: "X", youtube_data: "YouTube", rss_directo: "Web/RSS", brave_web: "Web" })[p] || p))],
    evidenceCount: tema.evidenceCount || 0,
    uniqueSources: tema.uniqueSources || 0,

    coverageStatus:
      (tema.uniqueSources || 0) >= 5 && proveedores.length >= 2
        ? NIVELES.GOOD
        : (tema.uniqueSources || 0) >= 2
          ? NIVELES.PARTIAL
          : NIVELES.INSUFFICIENT,

    missingCapabilities: capacidadesFaltantes,

    formulacionPermitida:
      "actividad observable en las fuentes cubiertas por Sentinel para este tema",

    formulacionProhibida: "tema viral en Cuenca",

    methodVersion: VERSION_MATRIZ
  };
}


/*
  Estado global de la matriz.
*/
export function estadoDeLaMatriz() {
  const porEstado = {};

  MOTORES.forEach((m) => {
    porEstado[m.estado] = (porEstado[m.estado] || 0) + 1;
  });

  return {
    methodVersion: VERSION_MATRIZ,
    motores: MOTORES.length,
    porEstado,

    operativos: MOTORES.filter((m) => esCoberturaReal(m.estado)).map((m) => m.id),
    configuradosSinUsar: MOTORES.filter((m) => m.estado === ESTADOS.CONFIGURED_NOT_USED).map((m) => m.id),
    implementadosSinCablear: MOTORES.filter((m) => m.estado === ESTADOS.IMPLEMENTED_NOT_WIRED).map((m) => m.id),
    soloCuentaConocida: MOTORES.filter((m) => m.estado === ESTADOS.KNOWN_ACCOUNT_ONLY).map((m) => m.id),
    sinImplementar: MOTORES.filter((m) => m.estado === ESTADOS.NOT_IMPLEMENTED).map((m) => m.id),

    social: resumenSocial(),
    huecos: HUECOS.length,

    declaraciones: [
      "COBERTURA DE FUENTES != COBERTURA DE POBLACIÓN. Ninguna celda autoriza a hablar de ciudadanos, penetración o representatividad.",
      "DISCOVERY y OBSERVATION son capacidades distintas y viven en filas distintas.",
      "AUSENCIA NO ES CERO: «TikTok open discovery = UNSUPPORTED con los conectores actuales», nunca «0 conversación en TikTok».",
      "UNKNOWN no se convierte en UNSUPPORTED: no haber comprobado algo no es haber comprobado que no funciona.",
      "«Existe el fichero» no significa «está operativo»: por eso hay estados para configurado-sin-usar e implementado-sin-cablear."
    ]
  };
}


export default {
  VERSION_MATRIZ,
  ESTADOS,
  CAPACIDADES,
  CAPACIDADES_DE_DESCUBRIMIENTO,
  CAPACIDADES_DE_OBSERVACION,
  FAMILIAS,
  NIVELES,
  MOTORES,
  MATRIZ_SOCIAL,
  HUECOS,
  REQUISITOS_DE_PROVEEDOR,
  esCoberturaReal,
  esDescubrimiento,
  redactarAusencia,
  celdaDeCobertura,
  resumenSocial,
  coberturaPorFamilia,
  coberturaDeTema,
  estadoDeLaMatriz
};
