// apps/backend/services/territorial/listeningCoverage.js

/*
===========================================================
COBERTURA DE ESCUCHA — TERRITORIAL-SOURCE-COVERAGE-01
===========================================================

Que dimensiones del ecosistema publico de un territorio puede
observar Sentinel HOY, con evidencia de cada respuesta.

LA PREGUNTA QUE CONTESTA
-----------------------------------------------------------

No «¿cuantas noticias tenemos?», sino:

    ¿que partes del espacio publico vemos,
     cuales no, y por que exactamente?

Un modulo que solo informa de lo que encontro deja invisible lo
que no busca. Y en inteligencia territorial, lo que no se busca
se lee como que no existe.

CADA ESTADO SE DERIVA, NO SE ESCRIBE
-----------------------------------------------------------

`OPERATIVO` exige evidencia REAL en el corpus del proyecto. Un
adapter implementado y nunca ejecutado no es operativo: es un
adapter implementado.

Por eso este modulo recibe el corpus y el universo de fuentes y
calcula; no lleva una tabla de estados a mano.

SIETE ESTADOS, Y NINGUNO ES UN PORCENTAJE
-----------------------------------------------------------

No se declara «cobertura del 40 % de internet en Cuenca». No
existe el denominador de esa fraccion y fingirlo seria peor que
no decir nada.
===========================================================
*/


export const ESTADOS_COBERTURA = Object.freeze({
  /* Hay evidencia real de esta dimension en el corpus. */
  OPERATIVO: "OPERATIVO",

  /* Se observa una parte, y consta cual falta. */
  PARCIAL: "PARCIAL",

  /* Hay conector, nunca se ejecuto contra este territorio. */
  NO_PROBADO: "NO_PROBADO",

  /* No hay conector ni via legitima conocida. */
  NO_DISPONIBLE: "NO_DISPONIBLE",

  /* Existe la via y algo la impide: red, robots, credencial. */
  BLOQUEADO: "BLOQUEADO",

  /* Solo se abriria contratando o dando de alta un proveedor. */
  REQUIERE_PROVEEDOR: "REQUIERE_PROVEEDOR",

  /* Decision de producto: no se hara. */
  FUERA_DE_ALCANCE: "FUERA_DE_ALCANCE"
});


/*
-----------------------------------------------------------
LAS DIMENSIONES

El orden importa: va de lo que mejor vemos a lo que no vemos, y
termina en lo que hemos decidido no ver.
-----------------------------------------------------------
*/

const DIMENSIONES = [
  { id: "noticias", nombre: "Noticias", grupo: "medios" },
  { id: "rss", nombre: "RSS de medios", grupo: "medios" },
  { id: "medios_digitales", nombre: "Medios digitales", grupo: "medios" },
  { id: "web_abierta", nombre: "Web abierta / buscadores", grupo: "medios" },
  { id: "youtube", nombre: "YouTube", grupo: "plataformas" },
  { id: "x", nombre: "X", grupo: "plataformas" },
  { id: "facebook", nombre: "Facebook público", grupo: "plataformas" },
  { id: "instagram", nombre: "Instagram público", grupo: "plataformas" },
  { id: "tiktok", nombre: "TikTok público", grupo: "plataformas" },
  { id: "comentarios", nombre: "Comentarios públicos", grupo: "plataformas" },
  { id: "periodistas", nombre: "Periodistas", grupo: "actores" },
  { id: "creadores", nombre: "Influencers y creadores", grupo: "actores" },
  { id: "marcas", nombre: "Marcas y empresas", grupo: "actores" },
  { id: "instituciones", nombre: "Instituciones", grupo: "actores" },
  { id: "comunidades", nombre: "Páginas, canales y comunidades públicas", grupo: "actores" },
  { id: "links", nombre: "Enlaces y dominios", grupo: "señal" },
  { id: "temas_emergentes", nombre: "Temas emergentes", grupo: "señal" },
  { id: "territorio", nombre: "Territorio explícito", grupo: "señal" },
  { id: "historico", nombre: "Histórico", grupo: "señal" },
  { id: "tendencias", nombre: "Tendencias", grupo: "señal" }
];


function fila(id, estado, datos = {}) {
  const dim = DIMENSIONES.find((d) => d.id === id);

  return {
    dimension: id,
    nombre: dim?.nombre || id,
    grupo: dim?.grupo || null,

    estado,

    conectores: datos.conectores || [],
    evidencias: datos.evidencias ?? 0,
    actores: datos.actores ?? null,
    ultimaObservacion: datos.ultimaObservacion || null,

    limitacion: datos.limitacion || null,
    queFalta: datos.queFalta || null,

    /* Por que ESTE estado y no otro. */
    porQue: datos.porQue || null
  };
}


/*
===========================================================
CONSTRUIR LA MATRIZ

`corpus`   evidencias del proyecto, ya reconstruidas
`fichas`   universo de fuentes comprobado
`motores`  estado real de los adapters
`senales`  temas/señales descubiertas
`alcance`  resumen de `territorialScope`
`tendencia` metricas de `compararVentanas`
===========================================================
*/

export function construirMatrizDeCobertura({
  corpus = [],
  fichas = [],
  motores = [],
  senales = { clasificadas: 0, descubiertas: 0 },
  alcance = null,
  tendencia = null,
  actores = null,
  firmas = null
} = {}) {
  const porProveedor = new Map();

  const dominios = new Set();

  const plataformas = new Map();

  let ultima = null;

  corpus.forEach((e) => {
    (e.providers || []).forEach((p) => porProveedor.set(p, (porProveedor.get(p) || 0) + 1));

    if (e.sourceId) dominios.add(e.sourceId);

    /*
      Una plataforma se detecta por el sourceId con prefijo
      —`youtube:UC…`— que es como los adapters sociales la
      declaran. No se adivina por la URL.
    */
    const m = String(e.sourceId || "").match(/^([a-z]+):/);

    if (m) plataformas.set(m[1], (plataformas.get(m[1]) || 0) + 1);

    const obs = e.lastObservedAt || e.firstObservedAt;

    if (obs && (!ultima || obs > ultima)) ultima = obs;
  });

  const ev = (p) => porProveedor.get(p) || 0;

  const plat = (p) => plataformas.get(p) || 0;

  const motor = (id) => motores.find((m) => m.providerId === id) || null;

  const feedsValidos = fichas.filter((f) => f.estadoVerificacion === "VERIFICADO_FEED").length;

  const sinFeed = fichas.filter((f) => f.estadoVerificacion === "NO_PUBLICA_RSS").length;

  const filas = [];

  /* ---------- MEDIOS ---------- */

  filas.push(
    fila("noticias", ev("rss_directo") + ev("google_news") > 0 ? ESTADOS_COBERTURA.OPERATIVO : ESTADOS_COBERTURA.NO_PROBADO, {
      conectores: ["rss_directo", "google_news"],
      evidencias: ev("rss_directo") + ev("google_news"),
      actores: dominios.size,
      ultimaObservacion: ultima,
      limitacion:
        "Google News oculta al publicador: sus piezas quedan con emisor NO_RESUELTO.",
      queFalta: "Nada para operar. Para mejorar: más feeds directos.",
      porQue: "Hay evidencia real de noticias en el corpus del proyecto."
    })
  );

  filas.push(
    fila("rss", ev("rss_directo") > 0 ? ESTADOS_COBERTURA.OPERATIVO : ESTADOS_COBERTURA.NO_PROBADO, {
      conectores: ["rss_directo"],
      evidencias: ev("rss_directo"),
      actores: feedsValidos,
      ultimaObservacion: ultima,
      limitacion: `${sinFeed} fuente(s) comprobadas NO publican feed: no se sustituyen por raspado.`,
      queFalta: "Recorrer más sitios locales y registrar los que publiquen feed.",
      porQue: "Feeds comprobados del propio medio, con rotación por ciclos."
    })
  );

  filas.push(
    fila("medios_digitales", dominios.size > 0 ? ESTADOS_COBERTURA.PARCIAL : ESTADOS_COBERTURA.NO_PROBADO, {
      conectores: ["rss_directo", "google_news"],
      evidencias: corpus.length,
      actores: dominios.size,
      ultimaObservacion: ultima,
      limitacion:
        "Solo medios con feed declarado o presentes en el agregador. Un medio local sin feed y sin indexar es invisible.",
      queFalta: "Ampliar el universo de fuentes con recorridos periódicos.",
      porQue: "Se observan medios reales, pero el universo no es exhaustivo y no se sabe cuánto falta."
    })
  );

  filas.push(
    fila("web_abierta", ESTADOS_COBERTURA.REQUIERE_PROVEEDOR, {
      conectores: ["brave_web", "serpapi_google", "duckduckgo"],
      evidencias: ev("brave_web") + ev("serpapi_google"),
      ultimaObservacion: null,
      limitacion: "Adapters completos y SIN credencial: BRAVE_API_KEY ausente.",
      queFalta: "Una credencial de Brave, o presupuesto de SerpAPI.",
      porQue: "El conector existe; lo que falta es la llave, no el código."
    })
  );

  /* ---------- PLATAFORMAS ---------- */

  filas.push(
    fila("youtube", plat("youtube") > 0 ? ESTADOS_COBERTURA.PARCIAL : ESTADOS_COBERTURA.NO_PROBADO, {
      conectores: ["youtube_data"],
      evidencias: plat("youtube"),
      actores: new Set(
        corpus.filter((e) => String(e.sourceId || "").startsWith("youtube:")).map((e) => e.sourceId)
      ).size,
      ultimaObservacion: ultima,
      limitacion:
        "Búsqueda por texto, 100 unidades de cuota por consulta. El canal se ve; quién lo dirige, no.",
      queFalta: "YOUTUBE_API_KEY propia para identificar emisores y subir el presupuesto.",
      porQue: "Hay evidencia de YouTube en el corpus, pero de una sola consulta por pasada."
    })
  );

  ["x", "facebook", "instagram", "tiktok"].forEach((p) => {
    const n = plat(p);

    filas.push(
      fila(p, n > 0 ? ESTADOS_COBERTURA.PARCIAL : ESTADOS_COBERTURA.NO_PROBADO, {
        conectores: [`${p}_adapter`],
        evidencias: n,
        ultimaObservacion: n > 0 ? ultima : null,

        limitacion:
          "El adapter existe en la línea de Candidate para ACTIVOS PÚBLICOS CONOCIDOS. No hay descubrimiento geográfico abierto: no se puede pedir «qué se publica en Cuenca».",

        queFalta:
          "Un proveedor con búsqueda pública por territorio, o una lista curada de activos públicos locales.",

        porQue:
          n > 0
            ? "Hay alguna evidencia, pero de activos declarados, no de descubrimiento territorial."
            : "Nunca se ejecutó contra este territorio: no hay ruta de descubrimiento por lugar."
      })
    );
  });

  filas.push(
    fila("comentarios", ESTADOS_COBERTURA.NO_DISPONIBLE, {
      conectores: [],
      evidencias: 0,
      limitacion:
        "Ninguna plataforma del stack actual entrega comentarios públicos por territorio de forma legítima.",
      queFalta: "Un proveedor con acceso a comentarios y términos que lo permitan.",
      porQue: "No hay conector ni vía legítima conocida hoy."
    })
  );

  /* ---------- ACTORES ---------- */

  const cuenta = (clase) => (actores?.porClase ? actores.porClase[clase] || 0 : 0);

  /*
    PERIODISTAS — se deriva de las FIRMAS observadas.

    Hasta TERRITORIAL-OPEN-LISTENING-EXPANSION-01 esta dimension
    estaba en NO_PROBADO con razon: el adapter extraia el autor y
    el libro lo tiraba al persistir. Ahora se guarda, asi que el
    estado sale de lo que hay.

    PARCIAL y no OPERATIVO aunque haya firmas: la promocion de
    firma a persona es heuristica y sin verificar, y hay piezas
    sin firma. Decir OPERATIVO seria afirmar mas de lo medido.
  */
  const firmasPersona = firmas?.personas ?? 0;

  const firmasTotal = firmas?.total ?? 0;

  filas.push(
    fila(
      "periodistas",
      firmasTotal > 0 ? ESTADOS_COBERTURA.PARCIAL : ESTADOS_COBERTURA.NO_PROBADO,
      {
        conectores: ["rssAdapter", "journalistUniverse"],
        evidencias: firmas?.piezasConFirma ?? 0,
        actores: firmasPersona,
        ultimaObservacion: ultima,

        limitacion: firmasTotal
          ? `${firmas.secciones || 0} firma(s) son secciones y no personas, y ${firmas.piezasSinFirma || 0} pieza(s) no traen firma. La promoción a persona es heurística y NO está verificada.`
          : "El corpus resuelve el MEDIO, no la firma.",

        queFalta: firmasTotal
          ? "Verificar las firmas contra los propios medios y resolver identidad entre medios."
          : "Extraer y consolidar el campo autor de los feeds que lo declaran.",

        porQue: firmasTotal
          ? `${firmasTotal} firma(s) observadas en ${firmas.mediosConFirma || 0} medio(s), declaradas por la propia fuente.`
          : "La señal existe en los datos y todavía no se procesa."
      }
    )
  );

  filas.push(
    fila("creadores", ESTADOS_COBERTURA.NO_DISPONIBLE, {
      conectores: [],
      evidencias: 0,
      actores: cuenta("CREADOR"),
      limitacion:
        "Sin descubrimiento social por territorio no hay forma de encontrar creadores locales.",
      queFalta: "Descubrimiento social geográfico, o curación manual de una lista inicial.",
      porQue:
        "Es la carencia más grande: todo el corpus es prensa e instituciones, sin una sola voz de creador."
    })
  );

  filas.push(
    fila("marcas", ESTADOS_COBERTURA.NO_PROBADO, {
      conectores: ["sourceClassifier"],
      evidencias: 0,
      actores: cuenta("MARCA"),
      limitacion: "Aparecen mencionadas en piezas, pero no se observan como emisores.",
      queFalta: "Registro de activos públicos de empresas locales.",
      porQue: "No se ha intentado observarlas como fuente."
    })
  );

  const inst = fichas.filter((f) => f.tipo === "institucion" && f.estadoVerificacion === "VERIFICADO_FEED");

  filas.push(
    fila("instituciones", inst.length > 0 ? ESTADOS_COBERTURA.OPERATIVO : ESTADOS_COBERTURA.NO_PROBADO, {
      conectores: ["rss_directo"],
      evidencias: corpus.filter((e) =>
        inst.some((i) => i.dominio === e.sourceId)
      ).length,
      actores: inst.length,
      ultimaObservacion: ultima,
      limitacion: "Solo las que publican feed. Un GAD sin RSS es invisible por esta vía.",
      queFalta: "Recorrer el resto de instituciones del cantón.",
      porQue: "Hay instituciones con feed comprobado aportando evidencia real."
    })
  );

  filas.push(
    fila("comunidades", ESTADOS_COBERTURA.NO_DISPONIBLE, {
      conectores: [],
      evidencias: 0,
      actores: cuenta("COMUNIDAD"),
      limitacion: "Grupos y páginas públicas exigen descubrimiento social por territorio.",
      queFalta: "Proveedor con búsqueda pública por lugar.",
      porQue: "Sin ruta de descubrimiento, no hay por dónde empezar."
    })
  );

  /* ---------- SEÑAL ---------- */

  filas.push(
    fila("links", dominios.size > 0 ? ESTADOS_COBERTURA.OPERATIVO : ESTADOS_COBERTURA.NO_PROBADO, {
      conectores: ["evidenceContract", "crossProviderDedup"],
      evidencias: corpus.filter((e) => e.canonicalUrl).length,
      actores: dominios.size,
      ultimaObservacion: ultima,
      limitacion: "Se observa el dominio publicador, no el grafo de enlaces salientes.",
      queFalta: "Extraer enlaces del cuerpo para medir amplificación entre medios.",
      porQue: "Cada evidencia lleva URL canónica y dominio resuelto."
    })
  );

  const totalSenales = (senales.clasificadas || 0) + (senales.descubiertas || 0);

  filas.push(
    fila("temas_emergentes", totalSenales > 0 ? ESTADOS_COBERTURA.PARCIAL : ESTADOS_COBERTURA.NO_PROBADO, {
      conectores: ["topicExtractor", "openTopicDiscovery"],
      evidencias: totalSenales,
      ultimaObservacion: ultima,
      limitacion:
        "El descubrimiento abierto se sobre-fragmenta: casi una señal por evidencia. Se clasifica la señal (TEMA/LUGAR/TEMPORAL) para poder filtrar el ruido, pero el motor sigue produciéndolo.",
      queFalta: "Consolidación semántica de señales duplicadas.",
      porQue: "Descubre sin lista previa —eso funciona— pero la salida no es todavía una agenda legible."
    })
  );

  filas.push(
    fila(
      "territorio",
      alcance?.atribuiblesAlTerritorio > 0 ? ESTADOS_COBERTURA.PARCIAL : ESTADOS_COBERTURA.NO_PROBADO,
      {
        conectores: ["geoResolver", "territoryRegistry", "territorialScope"],
        evidencias: alcance?.atribuiblesAlTerritorio ?? 0,
        actores: null,
        ultimaObservacion: ultima,

        limitacion: alcance
          ? `${alcance.deFuenteLocalSinDemostrar} pieza(s) de fuente local sin territorio demostrado y ${alcance.nacionales} de medios nacionales. NO se atribuyen al cantón.`
          : "Sin clasificación de alcance.",

        queFalta:
          "Extracción de entidades geográficas del cuerpo, o un proveedor que la traiga.",

        porQue:
          "Se resuelve el territorio de las piezas que lo mencionan; el resto se declara, no se fuerza."
      }
    )
  );

  const conHistorico = corpus.filter((e) => e.firstObservedAt).length;

  filas.push(
    fila("historico", conHistorico > 0 ? ESTADOS_COBERTURA.PARCIAL : ESTADOS_COBERTURA.NO_PROBADO, {
      conectores: ["evidenceLedger"],
      evidencias: conHistorico,
      ultimaObservacion: ultima,
      limitacion: "El histórico del proyecto empezó al persistir la primera observación.",
      queFalta: "Tiempo observando. No es código.",
      porQue: "Se acumula de verdad —append-only, firstObservedAt inmutable— pero es corto."
    })
  );

  const declarables = tendencia?.conTendenciaDeclarable ?? 0;

  filas.push(
    fila("tendencias", declarables > 0 ? ESTADOS_COBERTURA.OPERATIVO : ESTADOS_COBERTURA.PARCIAL, {
      conectores: ["topicTerritoryCrosstab"],
      evidencias: declarables,
      ultimaObservacion: ultima,

      limitacion:
        declarables > 0
          ? null
          : "Ninguna tendencia declarable: no se observaban las ventanas anteriores. El mecanismo está probado con corpus sintético.",

      queFalta: "Días de observación acumulada.",

      porQue:
        declarables > 0
          ? "Hay ventanas comparables observadas."
          : "El motor funciona y se niega a declarar sin ventana comparable, que es lo correcto."
    })
  );

  /* ---------- RESUMEN ---------- */

  const porEstado = {};

  filas.forEach((f) => {
    porEstado[f.estado] = (porEstado[f.estado] || 0) + 1;
  });

  return {
    dimensiones: filas,

    resumen: {
      total: filas.length,
      porEstado,

      operativas: filas.filter((f) => f.estado === ESTADOS_COBERTURA.OPERATIVO).length,
      conAlgunaSeñal: filas.filter(
        (f) => f.estado === ESTADOS_COBERTURA.OPERATIVO || f.estado === ESTADOS_COBERTURA.PARCIAL
      ).length
    },

    /*
      Lo que se abriria con un conector, separado de lo que se
      abriria con tiempo. Son decisiones distintas.
    */
    huecos: {
      requierenProveedor: filas
        .filter(
          (f) =>
            f.estado === ESTADOS_COBERTURA.REQUIERE_PROVEEDOR ||
            f.estado === ESTADOS_COBERTURA.NO_DISPONIBLE
        )
        .map((f) => ({ dimension: f.dimension, nombre: f.nombre, queFalta: f.queFalta })),

      requierenTiempo: filas
        .filter((f) => /tiempo|días de observación/i.test(f.queFalta || ""))
        .map((f) => ({ dimension: f.dimension, nombre: f.nombre })),

      requierenCredencial: filas
        .filter((f) => /credencial|API_KEY|llave/i.test(f.queFalta || "") || /credencial|API_KEY/i.test(f.limitacion || ""))
        .map((f) => ({ dimension: f.dimension, nombre: f.nombre }))
    },

    declaraciones: [
      "OPERATIVO exige evidencia REAL en el corpus del proyecto. Un adapter implementado y nunca ejecutado no es operativo.",
      "No se declara ningún porcentaje de «cobertura de internet» ni de la ciudad: no existe el denominador de esa fracción.",
      "NO_PROBADO, NO_DISPONIBLE y BLOQUEADO son tres cosas distintas. Solo la segunda dice que no hay vía; la primera dice que no lo hemos intentado.",
      "FUERA_DE_ALCANCE es una decisión de producto, no una carencia: el rastreo individual de personas y la inferencia de atributos sensibles no se harán."
    ],

    fueraDeAlcance: [
      "Rastreo individual de personas",
      "Dispositivos o localización individual",
      "Atributos sensibles",
      "Perfiles privados",
      "Inferencias individuales de comportamiento político"
    ]
  };
}


export default {
  ESTADOS_COBERTURA,
  construirMatrizDeCobertura
};
