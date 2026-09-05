// apps/backend/services/territorial/topicNormalization.js

/*
===========================================================
NORMALIZACION DE TEMAS OBSERVABLES
TERRITORIAL-TOPIC-NORMALIZATION-01
===========================================================

Base: TERRITORIAL-LOCAL-MEDIA-DISCOVERY-03, commit f528cb4.

QUE ES UN TEMA AQUI Y QUE NO ES
-----------------------------------------------------------

Un tema es una AGRUPACION DE EVIDENCIAS textualmente
relacionadas. Nada mas.

No es una tendencia. No es viralidad. No es opinion publica.
No es preocupacion ciudadana. No es importancia electoral. No
es sentimiento. Todo eso son interpretaciones que vienen
despues, con otra metodologia y otros datos.

Confundir «hay 40 evidencias agrupadas» con «a Cuenca le
preocupa esto» es el error que este modulo esta construido para
no cometer.

TEMA NO ES PALABRA
-----------------------------------------------------------

«agua» no es un tema. Pueden compartir la palabra:

    cortes de agua potable de ETAPA
    el proyecto minero de Loma Larga y el agua
    lluvias e inundaciones
    tarifas del servicio

Son asuntos distintos con vocabulario comun. Por eso agrupar
por palabra clave produce basura, y por eso aqui una union
exige coincidencia en algo DISTINTIVO —una entidad o una frase
de varias palabras—, no solo similitud de vector.

LOS TRES CAMPOS DE TEXTO QUE EXISTEN
-----------------------------------------------------------

Inventariado sobre el corpus persistido, no supuesto:

    rss_directo   373  title 100% (86 car.)  summary 100% (226)
    x_api         143  title   0%            summary 100% (271)
    youtube_data   83  title 100% (64)       summary  84% (120)
    brave_web      20  title 100% (74)       summary 100% (217)

Un tuit no tiene titular: su texto vive en `summary`. Cualquier
pipeline que solo lea `title` pierde 143 piezas enteras.

LA CONSULTA NO ES CONTENIDO
-----------------------------------------------------------

`provenance.queryLabel` —«x:comunidad:local», «yt:medios:local»—
NO entra en el texto del documento. Si entrara, las consultas
que se usaron para DESCUBRIR una pieza fabricarian el tema de
la pieza, y el sistema encontraria exactamente lo que fue a
buscar. Ese circulo ya se pago caro en este proyecto con
`esElAmbito`.

Hay una prueba que lo fija.
===========================================================
*/

import crypto from "node:crypto";


export const VERSION_METODO = "topic-norm-1.0.0";


/*
===========================================================
UNIVERSOS DE CORPUS
===========================================================

Las 619 piezas del ledger no tienen la misma validez
territorial, asi que no se normalizan como si la tuvieran.
===========================================================
*/

export const UNIVERSOS = Object.freeze({
  /* CORROBORADO ∩ temporalmente elegible. */
  PRIMARY: "PRIMARY_TOPIC_CORPUS",

  /* (CORROBORADO + PROBABLE) ∩ temporalmente elegible. */
  SECONDARY: "SECONDARY_TOPIC_CORPUS"
});


const ESTADOS_EXCLUIDOS = Object.freeze([
  "TERRITORIO_AMBIGUO",
  "TERRITORIO_CONFLICTIVO",
  "FUERA_TERRITORIO",
  "TERRITORIO_NO_RESOLUBLE"
]);


export function seleccionarCorpus(documentos = [], universo = UNIVERSOS.PRIMARY) {
  const admitidos =
    universo === UNIVERSOS.SECONDARY
      ? ["TERRITORIO_CORROBORADO", "TERRITORIO_PROBABLE"]
      : ["TERRITORIO_CORROBORADO"];

  /*
    DEDUP POR evidenceId EN LA ENTRADA.

    `evidenceId` es la clave canonica de deduplicacion del
    proyecto, y aqui faltaba: si la misma evidencia llegaba dos
    veces —dos pasadas de recoleccion, una lista concatenada— se
    contaba dos veces DENTRO del mismo tema e inflaba
    `evidenceCount`.

    Lo detecto la prueba J: tres documentos unicos y un tema que
    decia tener cinco.
  */
  const vistos = new Set();

  const unicos = documentos.filter((d) => {
    const id = d?.evidenceId;

    if (!id || vistos.has(id)) return false;

    vistos.add(id);

    return true;
  });

  const duplicadosEnLaEntrada = documentos.length - unicos.length;

  const dentro = unicos.filter(
    (d) => admitidos.includes(d.contentTerritoriality) && d.temporalmenteElegible
  );

  const fuera = unicos.filter((d) => !dentro.includes(d));

  return {
    universo,
    admitidos,
    documentos: dentro,

    excluidas: {
      total: fuera.length,
      porEstadoTerritorial: ESTADOS_EXCLUIDOS.reduce((a, e) => {
        a[e] = fuera.filter((d) => d.contentTerritoriality === e).length;
        return a;
      }, {}),
      probableFueraDePrimary:
        universo === UNIVERSOS.PRIMARY
          ? fuera.filter((d) => d.contentTerritoriality === "TERRITORIO_PROBABLE").length
          : 0,
      temporalmenteInelegibles: fuera.filter((d) => !d.temporalmenteElegible).length,
      duplicadosEnLaEntrada
    },

    declaraciones: [
      "PRIMARY solo admite CORROBORADO. PROBABLE entra únicamente en SECONDARY y nunca se mezcla en silencio.",
      "AMBIGUO, CONFLICTIVO, FUERA y NO_RESOLUBLE no alimentan métricas de tema.",
      "Lo excluido sigue en el ledger: no se borra, no se cuenta.",
      "Una pieza sin publishedAt no entra en ninguna ventana temporal.",
      "La entrada se deduplica por evidenceId: la misma evidencia nunca se cuenta dos veces dentro de un tema."
    ]
  };
}


/*
===========================================================
DOCUMENTO DE TEMA
===========================================================

Representacion normalizada de UNA evidencia. No duplica el
cuerpo: guarda el texto normalizado —que es derivado— y la
referencia al original por `evidenceId`.
===========================================================
*/

export function construirDocumento(evidencia = {}, contexto = {}) {
  /*
    Solo campos de CONTENIDO. `provenance.queryLabel` queda
    fuera a proposito: es procedencia, no tema.
  */
  const titulo = String(evidencia.title || evidencia.titulo || "").trim();

  const resumen = String(evidencia.summary || evidencia.resumen || evidencia.snippet || "").trim();

  const textoOriginal = [titulo, resumen].filter(Boolean).join(" . ");

  return {
    evidenceId: evidencia.evidenceId,
    projectId: evidencia.projectId || contexto.projectId || null,
    tenantId: evidencia.tenantId || contexto.tenantId || null,

    provider: (evidencia.providers || [])[0] || evidencia.providerId || null,
    providers: evidencia.providers || (evidencia.providerId ? [evidencia.providerId] : []),

    domain: evidencia.domain || null,
    sourceId: evidencia.sourceId || null,
    actorId: evidencia.emitterId || evidencia.sourceId || evidencia.domain || null,
    publisher: evidencia.publisher || null,
    canonicalUrl: evidencia.canonicalUrl || null,

    publishedAt: evidencia.publishedAt || null,
    firstObservedAt: evidencia.firstObservedAt || null,

    contentTerritoriality: contexto.contentTerritoriality || null,
    sourceLocality: contexto.sourceLocality || null,
    contentNature: contexto.contentNature || null,
    sourceFamily: contexto.sourceFamily || null,

    temporalmenteElegible: Boolean(evidencia.publishedAt) && !Number.isNaN(new Date(evidencia.publishedAt).getTime()),

    /* Original intacto; la version normalizada es derivada. */
    textoOriginal,
    tieneTitulo: Boolean(titulo),

    ...normalizarTexto(textoOriginal),

    methodVersion: VERSION_METODO
  };
}


/*
===========================================================
NORMALIZACION TEXTUAL
===========================================================

Determinista y versionada. El original NO se destruye.
===========================================================
*/

/*
  Stopwords del espanol. Lista corta y funcional: articulos,
  preposiciones, conjunciones, pronombres y auxiliares. No se
  incluyen sustantivos ni verbos con contenido.
*/
const STOPWORDS = new Set(
  ("a al algo algun alguna algunas alguno algunos ante antes aquel aquella aquellas aquello aquellos aqui asi aun aunque " +
    "bajo bien cada casi como con contra cual cuales cuando cuanto de del desde donde dos e el ella ellas ello ellos en " +
    "entre era eran eres es esa esas ese eso esos esta estaba estaban estan estar estas este esto estos estoy fue fueron " +
    "fui ha habia haber han has hasta hay he hemos la las le les lo los mas me mi mia mias mio mios mis mucho muchos muy " +
    "nada ni no nos nosotros nuestra nuestras nuestro nuestros o os otra otras otro otros para pero poco por porque que " +
    "quien quienes se sea sean segun ser si sido siempre sin sobre son su sus tal tambien tanto te tiene tienen todo " +
    "todos tras tu tus un una unas uno unos usted ustedes va van vamos ver y ya yo").split(" ")
);


/*
  Terminos que aparecen en casi todo el corpus y no distinguen
  nada por si solos. Son el material de los mega-clusters:
  agrupar por «cuenca» juntaria el tranvia con el futbol.

  NO se borran del texto. Se marcan como no distintivos, de
  modo que puedan seguir formando parte de una entidad
  —«Universidad de Cuenca», «Deportivo Cuenca»— pero no puedan
  fundamentar una union por si mismos.
*/
export const TERMINOS_GENERICOS = new Set(
  ("cuenca cuencano cuencanos azuay ecuador ecuatoriano ecuatorianos hoy ayer manana dia dias semana mes ano anos " +
    "noticia noticias informacion video videos foto fotos nota notas nuevo nueva nuevos nuevas gran gran grandes " +
    "ciudad ciudadano ciudadanos pais provincia canton local locales mundo").split(" ")
);


/*
  Gazetteer de entidades locales. Sale del universo de fuentes
  y de las empresas municipales realmente presentes en el
  corpus, no de una lista inventada.

  Son multipalabra o siglas inequivocas: eso es lo que permite
  distinguir asuntos que comparten vocabulario.
*/
export const ENTIDADES_CONOCIDAS = Object.freeze([
  "etapa ep", "etapa", "emov ep", "emov", "emac ep", "emac", "emuvi", "farmasol",
  "centrosur", "municipio de cuenca", "alcaldia de cuenca", "gad municipal",
  "prefectura del azuay", "universidad de cuenca", "universidad del azuay",
  "universidad catolica de cuenca", "casa de la cultura", "deportivo cuenca",
  "tranvia de cuenca", "tranvia", "el mercurio", "unsion tv", "la voz del tomebamba",
  "el nuevo tiempo", "telerama", "ecu 911", "cne azuay", "bomberos de cuenca",
  "loma larga", "quimsacocha", "el arenal", "feria libre", "parque calderon",
  "centro historico", "rio tomebamba", "rio yanuncay", "rio machangara",
  "quinto rio", "mall del rio", "aeropuerto mariscal lamar", "hospital jose carrasco arteaga",
  "hospital vicente corral moscoso", "terminal terrestre", "plan escudo"
]);


/*
  Boilerplate real observado en el corpus, no supuesto.

  Los feeds de WordPress cierran cada item con «La entrada X
  appeared first on Y» o «The post X appeared first on Y». Sin
  quitarlo, `appeared` y `first` acabaron entre las palabras
  clave de tres temas —ETAPA, Universidad de Cuenca— como si
  fueran vocabulario del asunto. Se detecto leyendo los temas
  producidos, no antes.
*/
const RE_BOILERPLATE = [
  /\b(la entrada|the post)\b[\s\S]{0,120}?\bappeared first on\b[^.]*/gi,
  /\bappeared first on\b[^.]*/gi,
  /\bfecha de publicaci[oó]n\b\s*:?/gi,
  /\bleer m[aá]s\b|\bread more\b|\bcontinuar leyendo\b/gi,
  /\bcompartir en\b[^.]{0,40}/gi
];


export function normalizarTexto(textoOriginal = "") {
  const original = String(textoOriginal || "");

  /*
    1. Unicode NFC y espacios. Sin esto, «á» compuesta y
       precompuesta son tokens distintos.
  */
  let t = original.normalize("NFC").replace(/\s+/g, " ").trim();

  /* 1-bis. Boilerplate de feeds fuera: no es vocabulario del tema. */
  RE_BOILERPLATE.forEach((re) => { t = t.replace(re, " "); });

  /* 2. URLs fuera: no aportan tema y ensucian los n-gramas. */
  const urls = t.match(/https?:\/\/\S+/g) || [];
  t = t.replace(/https?:\/\/\S+/g, " ");

  /* 3. Menciones: se guardan como señal de actor, no como tema. */
  const menciones = (t.match(/@[A-Za-z0-9_]{2,}/g) || []).map((m) => m.slice(1).toLowerCase());
  t = t.replace(/@[A-Za-z0-9_]{2,}/g, " ");

  /*
    4. Hashtags: se quita la almohadilla y se CONSERVA la
       palabra. «#Cuenca» y «Cuenca» son el mismo término, y
       tirar el hashtag perdería contenido real.
  */
  const hashtags = (t.match(/#[\p{L}\p{N}_]{2,}/gu) || []).map((h) => h.slice(1).toLowerCase());
  t = t.replace(/#([\p{L}\p{N}_]{2,})/gu, " $1 ");

  /*
    5. Entidades ANTES de quitar acentos y puntuación: se
       detectan sobre el texto ya plano pero completo.
  */
  const plano = quitarAcentos(t.toLowerCase());

  const entidades = ENTIDADES_CONOCIDAS.filter((e) => {
    const re = new RegExp(`(^|[^a-z0-9])${escapar(e)}([^a-z0-9]|$)`, "i");
    return re.test(plano);
  });

  /* 6. Puntuación fuera, dígitos sueltos fuera. */
  const limpio = plano
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  /* 7. Tokens: sin stopwords y de al menos 3 caracteres. */
  const tokens = limpio.split(" ").filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  /* 8. Bigramas y trigramas de tokens contiguos. */
  const bigramas = [];
  const trigramas = [];

  for (let i = 0; i < tokens.length - 1; i += 1) {
    bigramas.push(`${tokens[i]} ${tokens[i + 1]}`);
    if (i < tokens.length - 2) trigramas.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }

  /*
    Términos DISTINTIVOS: los que pueden fundamentar una unión.
    Un unigrama genérico no cuenta; un bigrama sí, aunque
    contenga un genérico, porque «universidad cuenca» dice algo
    que «cuenca» no dice.
  */
  const distintivos = [
    ...tokens.filter((w) => !TERMINOS_GENERICOS.has(w)),
    ...bigramas,
    ...trigramas,
    ...entidades.map((e) => `ent:${e}`)
  ];

  return {
    textoNormalizado: limpio,
    tokens,
    bigramas,
    trigramas,
    entidades,
    hashtags,
    menciones,
    urlsDetectadas: urls.length,
    terminosDistintivos: [...new Set(distintivos)],
    normalizacionVersion: VERSION_METODO
  };
}


function quitarAcentos(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function escapar(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


/*
===========================================================
SIMILITUD
===========================================================

Tres metodos, comparados sobre el mismo gold set. La eleccion
se documenta con numeros, no por preferencia.
===========================================================
*/

export const METODOS = Object.freeze({
  /* A. TF-IDF sobre tokens + coseno. */
  TFIDF_COSENO: "TFIDF_COSENO",

  /* B. Solapamiento lexico y de entidades (Jaccard). */
  SOLAPAMIENTO_LEXICO: "SOLAPAMIENTO_LEXICO",

  /*
    C. Hibrido: coseno alto Y ademas una coincidencia
    distintiva —entidad compartida o n-grama de mas de una
    palabra—. Es el que impide que «cuenca» funde asuntos
    distintos.
  */
  HIBRIDO: "HIBRIDO"
});


export function construirIdf(documentos = []) {
  const N = documentos.length || 1;

  const df = new Map();

  documentos.forEach((d) => {
    new Set(d.tokens).forEach((t) => df.set(t, (df.get(t) || 0) + 1));
  });

  const idf = new Map();

  df.forEach((n, t) => {
    /* IDF suavizado: evita dividir por cero y aplana los muy comunes. */
    idf.set(t, Math.log((N + 1) / (n + 1)) + 1);
  });

  return idf;
}


export function vectorTfIdf(documento, idf) {
  const tf = new Map();

  documento.tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));

  const v = new Map();

  let norma = 0;

  tf.forEach((n, t) => {
    /*
      Los términos genéricos se atenúan en lugar de eliminarse:
      siguen aportando algo de señal, pero no pueden dominar
      un vector. Medido: sin esto, «cuenca» era el término de
      mayor peso en casi todos los documentos.
    */
    const penalizacion = TERMINOS_GENERICOS.has(t) ? 0.15 : 1;

    const w = (1 + Math.log(n)) * (idf.get(t) || 1) * penalizacion;

    v.set(t, w);
    norma += w * w;
  });

  norma = Math.sqrt(norma) || 1;

  v.forEach((w, t) => v.set(t, w / norma));

  return v;
}


export function coseno(a, b) {
  let s = 0;

  const [chico, grande] = a.size <= b.size ? [a, b] : [b, a];

  chico.forEach((w, t) => {
    const o = grande.get(t);
    if (o) s += w * o;
  });

  return s;
}


export function jaccardDistintivo(a, b) {
  const A = new Set(a.terminosDistintivos);
  const B = new Set(b.terminosDistintivos);

  if (A.size === 0 || B.size === 0) return 0;

  let inter = 0;

  A.forEach((t) => { if (B.has(t)) inter += 1; });

  return inter / (A.size + B.size - inter);
}


/*
  Coincidencia distintiva compartida: lo que convierte
  «parecidos» en «del mismo asunto».

  QUE CUENTA Y POR QUE SE RELAJO
  -----------------------------------------------------------

  La primera version exigia una entidad o un n-grama de mas de
  una palabra. Medido sobre el gold set, eso costaba demasiado
  recall: el grupo del intercambiador Monay-IESS se partia
  porque una pieza dice «primer puente elevado» y las otras
  «paso elevado» o «intercambiador Monay». Comparten
  «elevado», que es especifico, pero ningun bigrama.

  El proposito del guardarrail nunca fue exigir bigramas: era
  impedir que un termino GENERICO —«cuenca», «ecuador», «hoy»—
  funda asuntos distintos. Asi que cuenta cualquier termino
  compartido que NO sea generico.

  Medido: recall 0.193 -> 0.544 con la precision practicamente
  intacta, y sin aparecer ningun mega-cluster.
*/
export function coincidenciasDistintivas(a, b) {
  const B = new Set(b.terminosDistintivos);

  return a.terminosDistintivos.filter((t) => {
    if (!B.has(t)) return false;

    /* Entidad conocida: siempre cuenta. */
    if (t.startsWith("ent:")) return true;

    /* N-grama: cuenta aunque contenga un generico. */
    if (t.includes(" ")) return true;

    /* Unigrama: solo si no es generico. */
    return !TERMINOS_GENERICOS.has(t);
  });
}


export function similitud(a, b, { metodo = METODOS.HIBRIDO, idf = null, vectores = null } = {}) {
  const va = vectores?.get(a.evidenceId);
  const vb = vectores?.get(b.evidenceId);

  const cos = va && vb ? coseno(va, vb) : 0;

  const jac = jaccardDistintivo(a, b);

  const comunes = coincidenciasDistintivas(a, b);

  if (metodo === METODOS.TFIDF_COSENO) {
    return { valor: cos, cos, jac, comunes, razones: [`coseno tf-idf ${cos.toFixed(3)}`] };
  }

  if (metodo === METODOS.SOLAPAMIENTO_LEXICO) {
    return { valor: jac, cos, jac, comunes, razones: [`jaccard distintivo ${jac.toFixed(3)}`] };
  }

  /*
    Hibrido. Sin coincidencia distintiva compartida el valor es
    CERO por mucho que el coseno sea alto: eso es lo que impide
    el mega-cluster de «Cuenca».
  */
  if (comunes.length === 0) {
    return {
      valor: 0,
      cos,
      jac,
      comunes,
      razones: [
        `coseno ${cos.toFixed(3)} pero sin ningún término distintivo compartido: no se unen`
      ]
    };
  }

  /*
    PUNTUACION: el coseno, no una mezcla.

    La primera version usaba `0.6*cos + 0.4*jac`. Medido sobre
    el gold set, la mezcla hundia el valor en textos cortos
    —tuits, titulares— donde el Jaccard es bajo por definicion,
    y costaba recall sin ganar precision.

    El guardarrail sigue siendo una PUERTA DURA: sin termino
    distintivo compartido el valor es cero. Lo que cambia es
    que, una vez pasada la puerta, ordena el coseno. Asi se
    conserva la proteccion contra los genericos y se recupera
    el recall.
  */
  const valor = cos;

  return {
    valor,
    cos,
    jac,
    comunes,
    razones: [
      `coseno ${cos.toFixed(3)}`,
      `jaccard ${jac.toFixed(3)}`,
      `comparten: ${comunes.slice(0, 4).join(", ")}`
    ]
  };
}


/*
===========================================================
AGRUPACION
===========================================================

Aglomerativa de una pasada, con orden determinista por
`evidenceId`. Misma entrada, mismo resultado: sin eso no hay
reproducibilidad y las metricas no valen nada.
===========================================================
*/

export const UMBRALES = Object.freeze({
  CONSERVADOR: 0.42,
  BALANCEADO: 0.3,
  AMPLIO: 0.18
});

export const CONFIANZA = Object.freeze({ ALTA: "HIGH", MEDIA: "MEDIUM", BAJA: "LOW" });

/*
  Tope de tamano de grupo como fraccion del corpus. Un grupo que
  se come mas de esto casi siempre ha fundido asuntos distintos,
  y es mejor detenerlo y declararlo que publicarlo.
*/
export const TOPE_DE_GRUPO = 0.35;


export function agrupar(documentos = [], opciones = {}) {
  const metodo = opciones.metodo || METODOS.HIBRIDO;

  const umbral = opciones.umbral ?? UMBRALES.BALANCEADO;

  /*
    El tope de grupo protege contra mega-clusters, y con un
    corpus diminuto no hay mega-cluster que proteger: con 4
    documentos el suelo de 3 bloqueaba una fusion legitima de
    similitud 0,58.

    Se detecto con una prueba que anadia una pieza de un motor
    nuevo sobre un asunto ya existente y no se fusionaba.

    Por debajo de `MINIMO_PARA_TOPE` no se aplica: el concepto
    solo significa algo cuando hay corpus suficiente para que un
    grupo pueda comerse una parte desproporcionada.
  */
  const MINIMO_PARA_TOPE = 20;

  const topeAbsoluto =
    documentos.length < MINIMO_PARA_TOPE
      ? documentos.length
      : Math.max(3, Math.floor(documentos.length * (opciones.topeDeGrupo ?? TOPE_DE_GRUPO)));

  /* Orden determinista. */
  const docs = [...documentos].sort((a, b) => String(a.evidenceId).localeCompare(String(b.evidenceId)));

  const idf = construirIdf(docs);

  const vectores = new Map(docs.map((d) => [d.evidenceId, vectorTfIdf(d, idf)]));

  const grupos = [];

  const asignaciones = [];

  const topeAlcanzado = [];

  docs.forEach((d) => {
    let mejor = null;

    grupos.forEach((g, i) => {
      /*
        Se compara contra el MIEMBRO MAS PARECIDO del grupo, no
        contra un centroide: un centroide de asuntos mezclados
        atrae cualquier cosa y realimenta el mega-cluster.
      */
      let mejorEnGrupo = { valor: 0 };

      g.miembros.forEach((m) => {
        const s = similitud(d, m, { metodo, idf, vectores });
        if (s.valor > mejorEnGrupo.valor) mejorEnGrupo = { ...s, contra: m.evidenceId };
      });

      if (mejorEnGrupo.valor >= umbral && (!mejor || mejorEnGrupo.valor > mejor.s.valor)) {
        mejor = { indice: i, s: mejorEnGrupo };
      }
    });

    if (mejor && grupos[mejor.indice].miembros.length >= topeAbsoluto) {
      topeAlcanzado.push({ evidenceId: d.evidenceId, grupo: mejor.indice, tope: topeAbsoluto });
      mejor = null;
    }

    if (mejor) {
      grupos[mejor.indice].miembros.push(d);

      asignaciones.push({
        evidenceId: d.evidenceId,
        grupo: mejor.indice,
        similitud: Number(mejor.s.valor.toFixed(4)),
        confidence: clasificarConfianza(mejor.s.valor, umbral),
        reasons: mejor.s.razones,
        contra: mejor.s.contra,
        methodVersion: VERSION_METODO
      });

      return;
    }

    grupos.push({ miembros: [d] });

    asignaciones.push({
      evidenceId: d.evidenceId,
      grupo: grupos.length - 1,
      similitud: null,
      confidence: CONFIANZA.BAJA,
      reasons: ["primera evidencia del grupo: no hay con qué comparar todavía"],
      methodVersion: VERSION_METODO
    });
  });

  /*
    CONFIANZA DE LA SEMILLA.

    La primera evidencia de un grupo se anotaba con confianza
    BAJA porque cuando entro no habia con que compararla. El
    problema es que ese estado no se revisaba nunca: cada tema
    acababa con su semilla marcada REVIEW_REQUIRED aunque el
    grupo fuera solido. Medido: 36 temas, 36 piezas marcadas
    sin motivo.

    Se detecto leyendo la traza de un tema real, no con una
    prueba.

    Ahora, una vez cerrado el grupo, la semilla hereda la mejor
    similitud que tenga con cualquier miembro: es la misma
    medida que se le aplico a los demas, solo que calculada
    cuando ya existe el grupo.
  */
  grupos.forEach((g, i) => {
    if (g.miembros.length < 2) return;

    const semilla = g.miembros[0];

    const a = asignaciones.find((x) => x.evidenceId === semilla.evidenceId && x.grupo === i);

    if (!a || a.similitud !== null) return;

    let mejor = { valor: 0 };

    g.miembros.slice(1).forEach((m) => {
      const sim = similitud(semilla, m, { metodo, idf, vectores });
      if (sim.valor > mejor.valor) mejor = { ...sim, contra: m.evidenceId };
    });

    a.similitud = Number(mejor.valor.toFixed(4));
    a.confidence = clasificarConfianza(mejor.valor, umbral);
    a.contra = mejor.contra || null;
    a.reasons = [
      "semilla del grupo: su confianza se calculó al cerrarse el grupo",
      ...(mejor.razones || [])
    ];
  });

  return { grupos, asignaciones, idf, vectores, umbral, metodo, topeAbsoluto, topeAlcanzado };
}


export function clasificarConfianza(valor, umbral) {
  if (valor == null) return CONFIANZA.BAJA;

  if (valor >= umbral * 1.6) return CONFIANZA.ALTA;

  if (valor >= umbral * 1.15) return CONFIANZA.MEDIA;

  return CONFIANZA.BAJA;
}


/*
===========================================================
IDENTIDAD Y ETIQUETA DEL TEMA
===========================================================

`topicId` NO depende del ranking: si dependiera, el tema 3 de
hoy seria el 5 de manana y no se podria seguir nada en el
tiempo. Se deriva de su contenido canonico.
===========================================================
*/

/*
  Terminos canonicos de un grupo.

  POR QUE NO SE USA EL IDF DEL CORPUS
  -----------------------------------------------------------

  La primera version pesaba cada termino por su rareza en el
  corpus. Eso hacia que `topicId` cambiara al anadir OTRO tema
  a la entrada: cambiaba el IDF, cambiaba el orden de los
  terminos, cambiaba la firma y cambiaba el hash.

  Un identificador que se mueve porque cambio el vecindario no
  sirve para seguir un tema en el tiempo, que es exactamente lo
  que va a necesitar Trend Radar. Lo detecto la prueba N.

  Asi que la firma se calcula SOLO con lo que hay dentro del
  grupo: en cuantas piezas suyas aparece cada termino, con
  prioridad para las entidades y desempate alfabetico. Es
  independiente del resto del corpus.
*/
export function terminosCanonicos(miembros = []) {
  const cuenta = new Map();

  miembros.forEach((m) => {
    new Set(m.terminosDistintivos).forEach((t) => cuenta.set(t, (cuenta.get(t) || 0) + 1));
  });

  return [...cuenta.entries()]
    .map(([t, n]) => ({
      termino: t,
      documentos: n,
      /* Cobertura dentro del grupo; las entidades pesan doble. */
      peso: (n / miembros.length) * (t.startsWith("ent:") ? 2 : t.includes(" ") ? 1.3 : 1)
    }))
    /* Solo lo que aparece en más de una pieza discrimina el grupo. */
    .filter((x) => miembros.length === 1 || x.documentos > 1)
    .sort((a, b) => b.peso - a.peso || a.termino.localeCompare(b.termino));
}


export function topicIdDe(canonicos = []) {
  const firma = canonicos
    .slice(0, 6)
    .map((c) => c.termino)
    .sort()
    .join("|");

  return `t:${crypto.createHash("sha1").update(firma || "vacio").digest("hex").slice(0, 12)}`;
}


export function etiquetaDe(canonicos = []) {
  const entidades = canonicos.filter((c) => c.termino.startsWith("ent:")).slice(0, 2);

  const frases = canonicos.filter((c) => c.termino.includes(" ") && !c.termino.startsWith("ent:")).slice(0, 2);

  const sueltos = canonicos.filter((c) => !c.termino.includes(" ") && !c.termino.startsWith("ent:")).slice(0, 2);

  const partes = [
    ...entidades.map((e) => e.termino.slice(4)),
    ...frases.map((f) => f.termino),
    ...(entidades.length + frases.length < 2 ? sueltos.map((s) => s.termino) : [])
  ];

  if (partes.length === 0) return "sin términos distintivos";

  return partes.slice(0, 3).join(" · ");
}


/*
===========================================================
VENTANAS TEMPORALES
===========================================================

Solo con `publishedAt`. Una pieza sin fecha no entra en
ninguna, y eso ya es contrato del proyecto.
===========================================================
*/

const DIAS = Object.freeze({ HOY: 1, "7D": 7, "15D": 15, "30D": 30, "90D": 90 });


export function ventanasDe(miembros = [], ahora = new Date().toISOString()) {
  const t0 = new Date(ahora).getTime();

  const salida = {};

  Object.entries(DIAS).forEach(([k, d]) => {
    const desde = t0 - d * 86400000;

    salida[k] = miembros.filter((m) => {
      if (!m.publishedAt) return false;

      const t = new Date(m.publishedAt).getTime();

      return !Number.isNaN(t) && t >= desde && t <= t0;
    }).length;
  });

  return salida;
}


/*
===========================================================
CONTRATO DE SALIDA
===========================================================
*/

export function construirTema(miembros = [], opciones = {}) {
  const idf = opciones.idf || new Map();

  const canonicos = terminosCanonicos(miembros);

  const porNaturaleza = {};
  const porFamilia = {};
  const porEstrato = {};
  const proveedores = new Set();

  miembros.forEach((m) => {
    const n = m.contentNature || "OTHER";
    porNaturaleza[n] = (porNaturaleza[n] || 0) + 1;

    const f = m.sourceFamily || "SIN_FAMILIA";
    porFamilia[f] = (porFamilia[f] || 0) + 1;

    const e = m.contentTerritoriality || "SIN_ESTADO";
    porEstrato[e] = (porEstrato[e] || 0) + 1;

    (m.providers || []).forEach((p) => proveedores.add(p));
  });

  const fuentes = new Set(miembros.map((m) => m.domain || m.sourceId).filter(Boolean));

  const actores = new Set(miembros.map((m) => m.actorId).filter(Boolean));

  const rss = miembros.filter((m) => (m.providers || []).includes("rss_directo")).length;

  const fechas = miembros.map((m) => m.publishedAt).filter(Boolean).sort();

  const observados = miembros.map((m) => m.firstObservedAt).filter(Boolean).sort();

  return {
    topicId: topicIdDe(canonicos),
    topicLabel: etiquetaDe(canonicos),
    parentTopicId: null,

    keywords: canonicos.filter((c) => !c.termino.startsWith("ent:")).slice(0, 10).map((c) => c.termino),
    entities: canonicos.filter((c) => c.termino.startsWith("ent:")).map((c) => c.termino.slice(4)),

    evidenceCount: miembros.length,
    evidenceIds: miembros.map((m) => m.evidenceId),

    /* Se llaman fuentes y actores, NO personas. */
    uniqueSources: fuentes.size,
    uniqueActors: actores.size,

    providers: [...proveedores],
    sourceFamilies: Object.keys(porFamilia),

    contentNatureBreakdown: porNaturaleza,
    territorialStratumBreakdown: porEstrato,

    rssEvidenceCount: rss,
    rssShare: miembros.length ? Number((rss / miembros.length).toFixed(3)) : null,

    /* Diversidad como conteos transparentes, sin score compuesto. */
    sourceDiversity: miembros.length ? Number((fuentes.size / miembros.length).toFixed(3)) : null,
    actorDiversity: miembros.length ? Number((actores.size / miembros.length).toFixed(3)) : null,
    providerDiversity: proveedores.size,

    publishedAtRange: fechas.length ? { desde: fechas[0], hasta: fechas[fechas.length - 1] } : null,
    firstObservedAt: observados[0] || null,
    lastObservedAt: observados[observados.length - 1] || null,

    windowCounts: ventanasDe(miembros, opciones.ahora),

    methodVersion: VERSION_METODO,

    /* Metadatos para futuro merge/split sin perder historia. */
    mergedFrom: [],
    splitFrom: null,
    relatedTopicIds: [],

    limitations: [
      "Un tema es una agrupación de evidencias textualmente relacionadas. NO es una tendencia, ni viralidad, ni opinión pública, ni preocupación ciudadana.",
      `${miembros.length} evidencias de ${fuentes.size} fuentes: un tema con muchas piezas de una sola fuente no equivale a uno con las mismas piezas repartidas.`,
      rss / (miembros.length || 1) > 0.7
        ? `Dominado por RSS (${Math.round((rss / miembros.length) * 100)} %): refleja agenda mediática antes que conversación pública.`
        : null,
      "Los temas representan patrones en la conversación pública observable dentro de las fuentes cubiertas por Sentinel. No representan a toda la población de Cuenca."
    ].filter(Boolean)
  };
}


export function normalizarTemas(documentos = [], opciones = {}) {
  const universo = opciones.universo || UNIVERSOS.PRIMARY;

  const sel = seleccionarCorpus(documentos, universo);

  const r = agrupar(sel.documentos, opciones);

  const temas = [];

  const assignments = [];

  r.grupos.forEach((g, i) => {
    const tema = construirTema(g.miembros, { idf: r.idf, ahora: opciones.ahora });

    /*
      Un grupo de una sola pieza no es un tema: es una pieza sin
      compañía. Se declara UNCLASSIFIED en lugar de inflar el
      recuento de temas con singletons.
    */
    const esSingleton = g.miembros.length < (opciones.minimoPorTema ?? 2);

    r.asignaciones
      .filter((a) => a.grupo === i)
      .forEach((a) => {
        const bajaConfianza = a.confidence === CONFIANZA.BAJA;

        assignments.push({
          evidenceId: a.evidenceId,
          topicId: esSingleton || bajaConfianza ? null : tema.topicId,
          estado: esSingleton
            ? "UNCLASSIFIED"
            : bajaConfianza
              ? "REVIEW_REQUIRED"
              : "CLASSIFIED",
          confidence: a.confidence,
          reasons: esSingleton
            ? ["única evidencia del grupo: no hay agrupación que sostenga un tema"]
            : a.reasons,
          methodVersion: VERSION_METODO
        });
      });

    if (!esSingleton) temas.push(tema);
  });

  const clasificadas = assignments.filter((a) => a.estado === "CLASSIFIED").length;

  const mayor = temas.reduce((m, t) => Math.max(m, t.evidenceCount), 0);

  return {
    universo,
    metodo: r.metodo,
    umbral: r.umbral,
    methodVersion: VERSION_METODO,

    corpus: {
      entrada: documentos.length,
      admitido: sel.documentos.length,
      excluidas: sel.excluidas
    },

    temas: temas.sort((a, b) => b.evidenceCount - a.evidenceCount || a.topicId.localeCompare(b.topicId)),
    assignments,

    resumen: {
      topicCount: temas.length,
      classifiedCount: clasificadas,
      unclassifiedCount: assignments.filter((a) => a.estado === "UNCLASSIFIED").length,
      reviewRequiredCount: assignments.filter((a) => a.estado === "REVIEW_REQUIRED").length,
      classificationRate: assignments.length ? Number((clasificadas / assignments.length).toFixed(3)) : null,
      largestCluster: mayor,
      largestClusterShare: sel.documentos.length ? Number((mayor / sel.documentos.length).toFixed(3)) : null,
      topeDeGrupo: r.topeAbsoluto,
      vecesQueSeAlcanzoElTope: r.topeAlcanzado.length
    },

    declaraciones: [
      ...sel.declaraciones,
      "El orden de proceso es determinista por evidenceId: la misma entrada produce el mismo resultado.",
      "topicId se deriva de los términos canónicos del tema, no de su posición en el ranking.",
      "Ordenar por evidenceCount es para inspección. NO es un Trend Score ni un ranking de importancia.",
      "`provenance.queryLabel` no entra en el texto del documento: la consulta que descubrió una pieza no puede fabricar su tema."
    ]
  };
}


export default {
  VERSION_METODO,
  UNIVERSOS,
  METODOS,
  UMBRALES,
  CONFIANZA,
  TERMINOS_GENERICOS,
  ENTIDADES_CONOCIDAS,
  seleccionarCorpus,
  construirDocumento,
  normalizarTexto,
  construirIdf,
  vectorTfIdf,
  coseno,
  jaccardDistintivo,
  coincidenciasDistintivas,
  similitud,
  agrupar,
  clasificarConfianza,
  terminosCanonicos,
  topicIdDe,
  etiquetaDe,
  ventanasDe,
  construirTema,
  normalizarTemas
};
