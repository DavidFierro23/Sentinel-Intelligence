// apps/backend/services/territorial/collectorMesh.js

/*
===========================================================
MESH MULTIFUENTE DE OBSERVACION PUBLICA
TERRITORIAL-COLLECTOR-EXPANSION-01
===========================================================

Base: TERRITORIAL-SOCIAL-GEO-DISAMBIGUATION-01, commit ecf8a34.

El objetivo de este modulo no es «tener todas las redes». Es
poder decir, con la evidencia delante, QUE APORTA CADA FUENTE y
que partes del ecosistema todavia no se pueden observar.

LA DISTINCION QUE ORGANIZA TODO
-----------------------------------------------------------

    OBSERVADO
      != TERRITORIALMENTE PROBABLE
      != TERRITORIALMENTE CORROBORADO

Y una segunda, que en este proyecto se confundio antes:

    BUSCAR CONTENIDO NUEVO POR TEMA
      != CONSULTAR UNA CUENTA QUE YA CONOCIAMOS

La segunda es la que decide si una plataforma sirve para
escucha abierta o solo para seguimiento. Candidate demostro
que ScrapeCreators funciona sobre cuentas conocidas de
Facebook, Instagram y TikTok. Eso NO demuestra que permita
descubrir contenido territorial desconocido, y la diferencia
no es un matiz: es la diferencia entre «esto es lo que se
habla en Cuenca» y «esto es lo que publican las nueve cuentas
que ya teniamos».

COMO SE DETERMINO EL MODO DE CADA PLATAFORMA
-----------------------------------------------------------

Leyendo el catalogo de endpoints que el propio codigo declara
en `intelligence/externalSocialProvider.js`, no la
documentacion comercial ni una suposicion:

    facebook   perfil, perfil/publicaciones,
               publicacion/comentarios, respuestas
    tiktok     perfil, perfil/videos, video,
               video/comentarios, respuestas
    instagram  perfil, usuario/publicaciones,
               publicacion/comentarios, respuestas

Los doce endpoints piden un `url` o un `handle`. **Ninguno
acepta una consulta, un tema o un hashtag.** Ademas
`CAPACIDADES_POR_PLATAFORMA` no incluye ninguna capacidad de
busqueda: la taxonomia existente ni la contempla, porque el
proveedor no la ofrece.

De ahi sale KNOWN_ACCOUNT_ONLY para las tres. No es una
opinion sobre el proveedor: es lo que su superficie permite.
===========================================================
*/


export const FAMILIAS = Object.freeze({
  WEB_NEWS_RSS: "WEB_NEWS_RSS",

  /*
    Separada a proposito de la conversacion social y de la
    agenda mediatica. Son tres senales distintas y mezclarlas
    produce afirmaciones que ninguna de las tres sostiene.
  */
  SEARCH_INTELLIGENCE: "SEARCH_INTELLIGENCE",

  X: "X",
  YOUTUBE: "YOUTUBE",
  FACEBOOK_PUBLIC: "FACEBOOK_PUBLIC",
  INSTAGRAM_PUBLIC: "INSTAGRAM_PUBLIC",
  TIKTOK_PUBLIC: "TIKTOK_PUBLIC",
  INSTITUCIONAL_LOCAL: "INSTITUCIONAL_LOCAL"
});


/*
===========================================================
MODO DE DESCUBRIMIENTO
===========================================================

La pregunta que responde: ¿puedo encontrar contenido que NO
sabia que existia, o solo puedo mirar lo que ya conocia?
===========================================================
*/

export const MODOS = Object.freeze({
  /* Busqueda abierta por tema o territorio, comprobada. */
  OPEN_DISCOVERY: "OPEN_DISCOVERY",

  /* Descubre, pero con un techo que lo hace parcial. */
  PARTIAL_DISCOVERY: "PARTIAL_DISCOVERY",

  /*
    Solo responde sobre un sujeto que ya hay que conocer. Util
    —seguimiento de activos— pero no es escucha abierta.
  */
  KNOWN_ACCOUNT_ONLY: "KNOWN_ACCOUNT_ONLY",

  /* La superficie disponible no lo ofrece. */
  NOT_SUPPORTED: "NOT_SUPPORTED",

  /* Existiria con un proveedor que no tenemos. */
  REQUIRES_PROVIDER: "REQUIRES_PROVIDER",

  /* Se intento y algo lo impidio. */
  BLOCKED: "BLOCKED"
});


/*
===========================================================
ESTRATOS DEL CORPUS
===========================================================

Decision humana registrada en este gate: PROBABLE puede
participar en una base territorial ampliada, pero JAMAS
mezclarse en silencio con CORROBORADO.

De ahi que sean cuatro cifras y no una. Cualquier informe
tiene que poder explicar su composicion:

    «38 senales territorialmente utilizables:
      33 corroboradas y 5 probables»

y nunca

    «38 publicaciones de Cuenca»

porque las 38 no tienen la misma certeza territorial.
===========================================================
*/

export const ESTRATOS = Object.freeze({
  CORPUS_OBSERVADO: "CORPUS_OBSERVADO",
  CORPUS_TERRITORIAL_CORROBORADO: "CORPUS_TERRITORIAL_CORROBORADO",
  CORPUS_TERRITORIAL_PROBABLE: "CORPUS_TERRITORIAL_PROBABLE",
  CORPUS_TERRITORIAL_AMPLIADO: "CORPUS_TERRITORIAL_AMPLIADO"
});


/* Estados territoriales que NO entran en ninguna metrica territorial. */
const FUERA_DE_METRICAS = Object.freeze([
  "TERRITORIO_AMBIGUO",
  "FUERA_TERRITORIO",
  "TERRITORIO_NO_RESOLUBLE",
  "TERRITORIO_CONFLICTIVO"
]);


export function estratificarCorpus(clasificaciones = []) {
  const cuenta = (estado) =>
    clasificaciones.filter((c) => c?.estadoGeo === estado).length;

  const corroborado = cuenta("TERRITORIO_CORROBORADO");

  const probable = cuenta("TERRITORIO_PROBABLE");

  return {
    [ESTRATOS.CORPUS_OBSERVADO]: clasificaciones.length,
    [ESTRATOS.CORPUS_TERRITORIAL_CORROBORADO]: corroborado,
    [ESTRATOS.CORPUS_TERRITORIAL_PROBABLE]: probable,
    [ESTRATOS.CORPUS_TERRITORIAL_AMPLIADO]: corroborado + probable,

    excluidas: {
      ambiguo: cuenta("TERRITORIO_AMBIGUO"),
      conflictivo: cuenta("TERRITORIO_CONFLICTIVO"),
      fuera: cuenta("FUERA_TERRITORIO"),
      noResoluble: cuenta("TERRITORIO_NO_RESOLUBLE")
    },

    /*
      Frase lista para usar. Existe para que nadie tenga que
      redactarla y se le escape «38 publicaciones de Cuenca».
    */
    composicion:
      corroborado + probable === 0
        ? "Ninguna señal territorialmente utilizable en esta muestra."
        : `${corroborado + probable} señales territorialmente utilizables: ${corroborado} corroboradas y ${probable} probables.`,

    declaraciones: [
      "CORROBORADO y PROBABLE no se suman sin decir cuánto aporta cada uno.",
      "AMBIGUO, CONFLICTIVO, FUERA y NO_RESOLUBLE no entran en métricas territoriales.",
      "Nada se borra: lo excluido sigue en el corpus observado como evidencia de recolección."
    ]
  };
}


export function esEstadoDeMetricaTerritorial(estadoGeo) {
  return (
    Boolean(estadoGeo) &&
    !FUERA_DE_METRICAS.includes(estadoGeo) &&
    (estadoGeo === "TERRITORIO_CORROBORADO" || estadoGeo === "TERRITORIO_PROBABLE")
  );
}


/*
===========================================================
INVENTARIO AUDITADO DEL MESH
===========================================================

Cada fila lleva la RAZON de su modo. Sin la razon, la tabla
seria una opinion; con ella, se puede discutir y refutar.

`usadoPorTerritorial` es la columna incomoda: dice que habia
infraestructura configurada que Territorial no estaba usando.
===========================================================
*/

export const MESH = Object.freeze([
  {
    familia: FAMILIAS.WEB_NEWS_RSS,
    collector: "rss_directo",
    modulo: "ingest/adapters/rssAdapter.js",
    modo: MODOS.OPEN_DISCOVERY,
    razonDelModo:
      "Lee cualquier feed declarado. El descubrimiento lo aporta el universo de fuentes, no una consulta.",
    implementado: true,
    requiereCredencial: false,
    configurado: true,
    usadoPorTerritorial: true,
    tipoDeDato: "NOTICIA",
    costeConocido: "$0",
    capacidadTemporal: "La que publique cada feed. Sin ventana garantizada.",
    capacidadTerritorial:
      "Alta cuando el medio es local; el territorio de la pieza sigue exigiendo resolución.",
    riesgoDeRuido: "BAJO",
    limitacion: "Depende de que el medio publique RSS. Muchos locales no lo hacen."
  },

  {
    familia: FAMILIAS.WEB_NEWS_RSS,
    collector: "gdelt_doc",
    modulo: "ingest/adapters/gdeltAdapter.js",
    modo: MODOS.OPEN_DISCOVERY,
    razonDelModo: "API abierta con búsqueda por término y ventana.",
    implementado: true,
    requiereCredencial: false,
    configurado: true,
    usadoPorTerritorial: true,
    tipoDeDato: "NOTICIA",
    costeConocido: "$0",
    capacidadTemporal: "Ventana declarada por el proveedor.",
    capacidadTerritorial: "Cobertura de prensa local de Cuenca NO MEDIDA.",
    riesgoDeRuido: "MEDIO",
    limitacion: "Sesgo hacia prensa de alcance nacional e internacional."
  },

  {
    familia: FAMILIAS.SEARCH_INTELLIGENCE,
    collector: "serpapi_google",
    modulo: "providers/serpapiProvider.js",
    modo: MODOS.OPEN_DISCOVERY,
    razonDelModo: "Búsqueda web abierta por consulta arbitraria.",
    implementado: true,
    requiereCredencial: true,
    variableEntorno: "SERPAPI_API_KEY",
    configurado: true,
    /*
      Aqui esta el hallazgo del gate: configurado, prioridad 1
      en el registro de proveedores, y Territorial no lo
      llamaba nunca. `PRESUPUESTO_POR_PASADA` del colector solo
      contemplaba rss, gdelt, x y youtube.
    */
    usadoPorTerritorial: false,
    tipoDeDato: "RESULTADO_DE_BUSQUEDA",
    costeConocido: "Cuota de la clave. Saldo consultable vía consultarSaldo().",
    capacidadTemporal: "El índice del motor, no una ventana declarada.",
    capacidadTerritorial: "Depende por completo de la consulta y del contenido devuelto.",
    riesgoDeRuido: "ALTO",
    limitacion:
      "Un resultado de búsqueda NO es una publicación con fecha: el instante de publicación suele faltar."
  },

  {
    familia: FAMILIAS.SEARCH_INTELLIGENCE,
    collector: "brave_web",
    modulo: "providers/braveProvider.js",
    modo: MODOS.OPEN_DISCOVERY,
    razonDelModo: "Búsqueda web abierta por consulta arbitraria.",
    implementado: true,
    requiereCredencial: true,
    variableEntorno: "BRAVE_API_KEY",
    configurado: true,
    usadoPorTerritorial: false,
    tipoDeDato: "RESULTADO_DE_BUSQUEDA",
    costeConocido: "Cuota del plan de la clave.",
    capacidadTemporal: "El índice del motor.",
    capacidadTerritorial: "Depende de la consulta.",
    riesgoDeRuido: "ALTO",
    limitacion: "Mismo problema de fecha que SerpAPI."
  },

  {
    familia: FAMILIAS.SEARCH_INTELLIGENCE,
    collector: "ddg_web",
    modulo: "providers/duckProvider.js",
    modo: MODOS.PARTIAL_DISCOVERY,
    razonDelModo:
      "Descubre, pero el rate-limiting obliga a un intervalo de 3,5 s y un presupuesto de 2 consultas por pasada.",
    implementado: true,
    requiereCredencial: false,
    configurado: true,
    usadoPorTerritorial: false,
    tipoDeDato: "RESULTADO_DE_BUSQUEDA",
    costeConocido: "$0",
    capacidadTemporal: "El índice del motor.",
    capacidadTerritorial: "Depende de la consulta.",
    riesgoDeRuido: "ALTO",
    limitacion: "Rate-limiting agresivo. Sirve de reserva, no de motor principal."
  },

  {
    familia: FAMILIAS.X,
    collector: "x_api",
    modulo: "ingest/adapters/xAdapter.js",
    modo: MODOS.OPEN_DISCOVERY,
    razonDelModo: "`search/recent` acepta una consulta arbitraria y devuelve autores desconocidos.",
    implementado: true,
    requiereCredencial: true,
    variableEntorno: "X_BEARER_TOKEN",
    configurado: true,
    usadoPorTerritorial: true,
    tipoDeDato: "PUBLICACION_SOCIAL",
    costeConocido: "Cuota del nivel contratado. NO MEDIDA.",
    capacidadTemporal: "7 días en `search/recent`.",
    capacidadTerritorial:
      "El texto rara vez trae topónimo desambiguado; sin geo del autor. Medido: 21 de 47 elegibles.",
    riesgoDeRuido: "ALTO",
    limitacion: "Ventana de 7 días y tope de resultados fijado por nosotros, no por el proveedor."
  },

  {
    familia: FAMILIAS.YOUTUBE,
    collector: "youtube_data",
    modulo: "ingest/adapters/youtubeAdapter.js",
    modo: MODOS.OPEN_DISCOVERY,
    razonDelModo: "`search.list` acepta consulta arbitraria y devuelve canales desconocidos.",
    implementado: true,
    requiereCredencial: true,
    variableEntorno: "YOUTUBE_API_KEY",
    configurado: true,
    usadoPorTerritorial: true,
    tipoDeDato: "VIDEO_PUBLICO",
    costeConocido: "100 unidades por búsqueda sobre 10 000 diarias.",
    capacidadTemporal: "Sin ventana forzada; se puede acotar por fecha.",
    capacidadTerritorial: "Medido: 12 de 21 elegibles.",
    riesgoDeRuido: "MEDIO",
    limitacion: "Devuelve contenido turístico o musical que menciona el topónimo."
  },

  {
    familia: FAMILIAS.FACEBOOK_PUBLIC,
    collector: "scrapecreators_facebook",
    modulo: "intelligence/externalSocialProvider.js",
    modo: MODOS.KNOWN_ACCOUNT_ONLY,
    razonDelModo:
      "Los cuatro endpoints declarados —perfil, perfil/publicaciones, publicación/comentarios, respuestas— piden una URL. Ninguno acepta consulta, tema ni hashtag.",
    implementado: true,
    requiereCredencial: true,
    variableEntorno: "SCRAPECREATORS_API_KEY",
    configurado: true,
    usadoPorTerritorial: false,
    tipoDeDato: "PUBLICACION_SOCIAL",
    costeConocido: "Créditos por llamada.",
    capacidadTemporal: "Histórico de la propia página.",
    capacidadTerritorial:
      "Nula por sí sola: hay que conocer la página antes. El territorio lo aporta el Source Universe.",
    riesgoDeRuido: "BAJO",
    limitacion:
      "NO permite escucha abierta. Solo seguimiento de activos ya identificados por otra fuente."
  },

  {
    familia: FAMILIAS.INSTAGRAM_PUBLIC,
    collector: "scrapecreators_instagram",
    modulo: "intelligence/externalSocialProvider.js",
    modo: MODOS.KNOWN_ACCOUNT_ONLY,
    razonDelModo:
      "Endpoints de perfil y publicaciones de usuario, por handle. Sin endpoint de hashtag ni de búsqueda.",
    implementado: true,
    requiereCredencial: true,
    variableEntorno: "SCRAPECREATORS_API_KEY",
    configurado: true,
    usadoPorTerritorial: false,
    tipoDeDato: "PUBLICACION_SOCIAL",
    costeConocido: "Créditos por llamada.",
    capacidadTemporal: "Histórico del perfil.",
    capacidadTerritorial: "Nula por sí sola.",
    riesgoDeRuido: "BAJO",
    limitacion:
      "La vía oficial de Meta —`business_discovery`— tampoco descubre por tema: resuelve cuentas profesionales que ya se nombran."
  },

  {
    familia: FAMILIAS.TIKTOK_PUBLIC,
    collector: "scrapecreators_tiktok",
    modulo: "intelligence/externalSocialProvider.js",
    modo: MODOS.KNOWN_ACCOUNT_ONLY,
    razonDelModo:
      "Endpoints de perfil, vídeos del perfil y vídeo suelto, por handle o URL. Sin búsqueda por palabra clave.",
    implementado: true,
    requiereCredencial: true,
    variableEntorno: "SCRAPECREATORS_API_KEY",
    configurado: true,
    usadoPorTerritorial: false,
    tipoDeDato: "VIDEO_PUBLICO",
    capacidadTemporal: "Histórico del perfil.",
    costeConocido: "Créditos por llamada.",
    capacidadTerritorial: "Nula por sí sola.",
    riesgoDeRuido: "BAJO",
    limitacion:
      "El adaptador propio de TikTok solo expone `confirmarCuenta` y `urlDePerfil`: ni siquiera lista contenido."
  },

  {
    familia: FAMILIAS.INSTITUCIONAL_LOCAL,
    collector: "universo_de_fuentes",
    modulo: "territorial/verifiedSourceUniverse.js",
    modo: MODOS.OPEN_DISCOVERY,
    razonDelModo:
      "El descubrimiento es por búsqueda web y verificación HTTP real, no por una API de plataforma.",
    implementado: true,
    requiereCredencial: false,
    configurado: true,
    usadoPorTerritorial: true,
    tipoDeDato: "FUENTE",
    costeConocido: "$0",
    capacidadTemporal: "No aplica: describe fuentes, no piezas.",
    capacidadTerritorial: "Alta: el territorio es un atributo declarado y verificado de la fuente.",
    riesgoDeRuido: "BAJO",
    limitacion: "Requiere trabajo humano de verificación para promover una fuente."
  }
]);


/*
  Familias que quedan fuera de este gate por decision explicita,
  no por olvido. Se registran para que la ausencia sea legible.
*/
export const FUTURO = Object.freeze([
  {
    familia: "GOOGLE_MAPS_REVIEWS",
    modo: MODOS.REQUIRES_PROVIDER,
    porQueNoAhora: "No hay adaptador ni credencial de Places. Reseñas nominativas: exige criterio de privacidad propio."
  },
  {
    familia: "REDDIT_FOROS_BLOGS",
    modo: MODOS.REQUIRES_PROVIDER,
    porQueNoAhora: "Sin adaptador. Volumen esperable de Cuenca muy bajo; coste de integración alto para el retorno."
  },
  {
    familia: "TELEGRAM_PUBLICO",
    modo: MODOS.REQUIRES_PROVIDER,
    porQueNoAhora: "Sin adaptador. Requiere criterio explícito sobre qué canal es público de verdad."
  },
  {
    familia: "RADIO_TV_BROADCAST",
    modo: MODOS.NOT_SUPPORTED,
    porQueNoAhora: "Exige transcripción de emisión. Fuera del alcance técnico actual."
  },
  {
    familia: "FIRST_PARTY_ANALYTICS",
    modo: MODOS.NOT_SUPPORTED,
    porQueNoAhora:
      "Solo válido sobre propiedades propias o autorizadas y en agregado. NO se implementa ningún tracking en este gate."
  }
]);


/*
===========================================================
VALOR DE UN COLECTOR
===========================================================

Un colector no es bueno por devolver muchos resultados. Es
bueno por aportar senal NUEVA y UTIL.

De ahi que `observed_items` sea la primera columna y la menos
importante.
===========================================================
*/

export function metricasDeColector({
  collector,
  familia,
  modo,
  observadas = [],
  corpusPrevio = new Set(),
  actoresPrevios = new Set(),
  clasificaciones = [],
  requests = 0,
  credits = null,
  costeMonetario = null,
  ventana = null
} = {}) {
  const claveDe = (e) =>
    e?.canonicalUrl || e?.evidenceId || e?.id || e?.url || null;

  const claves = observadas.map(claveDe).filter(Boolean);

  const unicas = new Set(claves);

  const nuevas = [...unicas].filter((k) => !corpusPrevio.has(k));

  const duplicadas = claves.length - unicas.size;

  const solapadas = [...unicas].filter((k) => corpusPrevio.has(k));

  const actores = new Set(
    observadas.map((e) => e?.emitterId || e?.sourceId || e?.domain).filter(Boolean)
  );

  const actoresNuevos = [...actores].filter((a) => !actoresPrevios.has(a));

  const estratos = estratificarCorpus(clasificaciones);

  const cuenta = (s) => clasificaciones.filter((c) => c?.estadoGeo === s).length;

  const resolubles = clasificaciones.length;

  /*
    Tasa de resolucion territorial: cuanto de lo observado
    sostiene territorio. El denominador es lo CLASIFICADO, no
    lo observado, y se declara para que nadie lo lea como
    porcentaje del ecosistema.
  */
  const tasaResolucion =
    resolubles === 0
      ? null
      : Number(
          (
            (cuenta("TERRITORIO_CORROBORADO") + cuenta("TERRITORIO_PROBABLE")) /
            resolubles
          ).toFixed(3)
        );

  /*
    Ruido: lo que entro y demostrablemente NO es del territorio.
    AMBIGUO no cuenta como ruido —es desconocimiento, no error—
    y NO_RESOLUBLE tampoco.
  */
  const tasaRuido =
    resolubles === 0 ? null : Number((cuenta("FUERA_TERRITORIO") / resolubles).toFixed(3));

  return {
    collector,
    familia,
    modo,

    observed_items: observadas.length,
    unique_items: unicas.size,
    new_items_vs_existing_corpus: nuevas.length,
    duplicate_items: duplicadas,
    overlap_items: solapadas.length,
    overlap_rate:
      unicas.size === 0 ? null : Number((solapadas.length / unicas.size).toFixed(3)),

    new_actors: actoresNuevos.length,
    known_actors: actores.size - actoresNuevos.length,

    CORROBORADO: cuenta("TERRITORIO_CORROBORADO"),
    PROBABLE: cuenta("TERRITORIO_PROBABLE"),
    AMBIGUO: cuenta("TERRITORIO_AMBIGUO"),
    CONFLICTIVO: cuenta("TERRITORIO_CONFLICTIVO"),
    FUERA: cuenta("FUERA_TERRITORIO"),
    NO_RESOLUBLE: cuenta("TERRITORIO_NO_RESOLUBLE"),

    territorial_resolution_rate: tasaResolucion,
    noise_rate: tasaRuido,

    requests,
    credits,
    /* null cuando no se conoce objetivamente. No se estima. */
    costeMonetario,

    temporal_coverage: ventana,

    /*
      Calidad de procedencia: se mide, no se supone. Una pieza
      sin `publishedAt` no se puede situar en el tiempo, y una
      sin procedencia de consulta no se puede auditar.
    */
    provenance_quality: {
      conPublishedAt: observadas.filter((e) => e?.publishedAt).length,
      conCanonicalUrl: observadas.filter((e) => e?.canonicalUrl).length,
      conQueryProvenance: observadas.filter(
        (e) => e?.provenance?.queryLabel || e?.queryLabel
      ).length,
      total: observadas.length
    },

    estratos
  };
}


/*
===========================================================
SOLAPAMIENTO ENTRE COLECTORES
===========================================================

Dos colectores pueden traer la misma pieza. Eso no es un
error y la evidencia no se borra: lo que no puede pasar es
contarla dos veces en un agregado.

La procedencia multiple se conserva —saber que X y la busqueda
web trajeron lo mismo es informacion sobre las fuentes, no
basura—.
===========================================================
*/

export function solapamientoEntreColectores(porColector = {}) {
  const claves = {};

  Object.entries(porColector).forEach(([collector, items]) => {
    claves[collector] = new Set(
      (items || []).map((e) => e?.canonicalUrl || e?.evidenceId || e?.id).filter(Boolean)
    );
  });

  const nombres = Object.keys(claves);

  const pares = [];

  for (let i = 0; i < nombres.length; i += 1) {
    for (let j = i + 1; j < nombres.length; j += 1) {
      const a = claves[nombres[i]];
      const b = claves[nombres[j]];
      const comunes = [...a].filter((k) => b.has(k));

      if (comunes.length) {
        pares.push({ entre: [nombres[i], nombres[j]], comunes: comunes.length });
      }
    }
  }

  const todas = new Map();

  Object.entries(claves).forEach(([collector, set]) => {
    set.forEach((k) => {
      if (!todas.has(k)) todas.set(k, []);
      todas.get(k).push(collector);
    });
  });

  const multiples = [...todas.entries()].filter(([, cs]) => cs.length > 1);

  return {
    piezasUnicasEnTotal: todas.size,
    piezasConProcedenciaMultiple: multiples.length,
    paresConSolapamiento: pares,

    procedenciaMultiple: multiples.slice(0, 50).map(([clave, cs]) => ({ clave, collectors: cs })),

    declaracion:
      "Una pieza observada por dos colectores conserva las dos procedencias y cuenta UNA vez en los agregados."
  };
}


/*
  Resumen del mesh por familia. Sirve para responder «¿qué
  partes del ecosistema NO podemos observar?» sin leer la tabla
  entera.
*/
export function estadoDelMesh() {
  const porModo = {};

  MESH.forEach((m) => {
    porModo[m.modo] = (porModo[m.modo] || 0) + 1;
  });

  return {
    collectors: MESH.length,
    porModo,

    conDescubrimientoAbierto: MESH.filter((m) => m.modo === MODOS.OPEN_DISCOVERY).map(
      (m) => m.collector
    ),

    soloCuentaConocida: MESH.filter((m) => m.modo === MODOS.KNOWN_ACCOUNT_ONLY).map(
      (m) => m.collector
    ),

    configuradosSinUsarPorTerritorial: MESH.filter(
      (m) => m.configurado && !m.usadoPorTerritorial
    ).map((m) => m.collector),

    familias: [...new Set(MESH.map((m) => m.familia))],
    familiasFuturas: FUTURO.map((f) => f.familia),

    declaraciones: [
      "KNOWN_ACCOUNT_ONLY no es un fallo del proveedor: es el límite de su superficie pública. Sirve para seguir activos, no para escuchar el territorio.",
      "Facebook, Instagram y TikTok NO permiten descubrimiento abierto con la infraestructura disponible. Cualquier contenido de esas plataformas llega porque otra fuente identificó antes al actor.",
      "Ningún estado de esta tabla afirma representatividad. Describe qué se puede observar, no qué piensa la ciudadanía."
    ]
  };
}


export default {
  FAMILIAS,
  MODOS,
  ESTRATOS,
  MESH,
  FUTURO,
  estratificarCorpus,
  esEstadoDeMetricaTerritorial,
  metricasDeColector,
  solapamientoEntreColectores,
  estadoDelMesh
};
