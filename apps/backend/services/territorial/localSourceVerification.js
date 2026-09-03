// apps/backend/services/territorial/localSourceVerification.js

/*
===========================================================
LOCALIDAD DE LA FUENTE
TERRITORIAL-LOCAL-SOURCE-EXPANSION-02
===========================================================

Base: TERRITORIAL-CORPUS-PERSISTENCE-01, commit 556fc6c.

EL PROBLEMA QUE ESTE GATE ATACA
-----------------------------------------------------------

El corpus persistido tiene 461 piezas y 353 vienen de
`rss_directo`, dominado por medios nacionales: expreso.ec,
extra.ec, teleamazonas. Un 77 %.

Eso no es un fallo del resolutor —las 237 piezas
NO_RESOLUBLE son notas nacionales sin toponimo, y estan bien
clasificadas—. Es la composicion del universo de fuentes.

Preguntar «¿de que habla Cuenca?» sobre ese corpus daria los
temas del Ecuador.

LAS DOS DIMENSIONES QUE NO SON LA MISMA
-----------------------------------------------------------

    SOURCE_LOCALITY         ¿la fuente es de Cuenca?
    CONTENT_TERRITORIALITY  ¿la pieza habla de Cuenca?

Son independientes y este modulo solo responde la primera.

    El Mercurio es una fuente local corroborada.
    El Mercurio publica sobre el dolar.
    Esa pieza NO es territorialmente de Cuenca.

Y al reves:

    Expreso es un medio nacional.
    Expreso publica «el tranvia de Cuenca suma unidades».
    Esa pieza SI puede corroborarse territorialmente.

Por eso `localSourceVerification` no toca la resolucion
territorial del contenido, y hay pruebas que fijan ambas
direcciones.

LO QUE NO SE HACE
-----------------------------------------------------------

    No se inventa ninguna fuente, URL, handle ni feed.
    No basta que el nombre contenga «Cuenca».
    No se promueve nada solo.
    No se infiere afiliacion politica ni atributo sensible.

Y la trampa concreta de este territorio: **Cuenca es tambien
una ciudad de Espana**. Entre los 44 dominios descubiertos
llegaron `ayuntamiento.cuenca.es` y
`educacionycultura.cuenca.es`. Un dominio `.es` con «cuenca»
dentro es exactamente el falso positivo que el gate de
desambiguacion midio en el contenido, ahora a nivel de fuente.
===========================================================
*/


export const LOCALIDAD = Object.freeze({
  /*
    Senal fuerte y verificable: dominio institucional del
    canton o de la provincia, o medio con territorio declarado
    y comprobado.
  */
  LOCAL_CORROBORADA: "LOCAL_CORROBORADA",

  /* Indicios consistentes, sin senal fuerte. */
  LOCAL_PROBABLE: "LOCAL_PROBABLE",

  /* Evidencia de que la fuente es de otro sitio. */
  NO_LOCAL: "NO_LOCAL",

  /* Podria serlo y no hay con que decidir. */
  AMBIGUA: "AMBIGUA",

  /* No se pudo comprobar nada. */
  NO_RESOLUBLE: "NO_RESOLUBLE",

  /*
    No es una fuente: plataforma, agregador, tienda,
    enciclopedia. Se excluye por naturaleza, no por localidad.
  */
  EXCLUIDA: "EXCLUIDA"
});


export const FAMILIAS_LOCALES = Object.freeze({
  MEDIOS_LOCALES: "MEDIOS_LOCALES",
  INSTITUCIONAL_PUBLICO: "INSTITUCIONAL_PUBLICO",
  UNIVERSIDAD_ACADEMIA: "UNIVERSIDAD_ACADEMIA",
  ORGANIZACIONES: "ORGANIZACIONES",
  CULTURA_COMUNIDAD: "CULTURA_COMUNIDAD",
  ACTORES_PUBLICOS: "ACTORES_PUBLICOS",
  OTROS_LOCALES: "OTROS_LOCALES"
});


/*
===========================================================
TIPO DE CONTENIDO POR ORIGEN

Una nota de El Mercurio y un comunicado de EMAC no son la
misma cosa, y ninguna de las dos es conversacion ciudadana.

Sin esta distincion, «lo que se dice en Cuenca» acaba siendo
el boletin del Municipio.
===========================================================
*/

export const NATURALEZA = Object.freeze({
  /* Personas publicando en abierto. */
  PUBLIC_CONVERSATION: "PUBLIC_CONVERSATION",

  /* Cobertura periodistica. */
  MEDIA: "MEDIA",

  /* Agenda, comunicados, servicios. NO es ciudadania. */
  INSTITUTIONAL: "INSTITUTIONAL",

  /* Produccion academica. */
  ACADEMIC: "ACADEMIC",

  /* Resultado de motor de busqueda. */
  SEARCH_RESULT: "SEARCH_RESULT",

  OTHER: "OTHER"
});


/*
  Dominios que NO son fuentes: plataformas, agregadores,
  enciclopedias, tiendas, directorios. Incluirlos infla el
  universo con cosas que no publican agenda local propia.
*/
const NO_SON_FUENTE = Object.freeze([
  "x.com", "twitter.com", "facebook.com", "instagram.com", "tiktok.com",
  "youtube.com", "play.google.com", "es.wikipedia.org", "en.wikipedia.org",
  "moovitapp.com", "es-us.noticias.yahoo.com", "news.google.com"
]);


/*
  Sufijos y patrones que prueban que la fuente es de OTRO
  pais. `.es` con «cuenca» dentro es el caso peligroso: la
  Cuenca de Espana.
*/
const RE_FUERA_DE_ECUADOR = /\.es$|\.es\/|\.com\.pe$|\.cl$|\.uy$|\.ar$|\.mx$|\.cu$/i;


/*
  Dominios institucionales del canton o de la provincia. Es la
  senal mas fuerte que existe sin intervencion humana: un
  `.gob.ec` bajo `cuenca` o `azuay` no puede ser de otro sitio.
*/
const RE_INSTITUCIONAL_LOCAL = /(^|\.)cuenca\.gob\.ec$|(^|\.)azuay\.gob\.ec$|^etapa\.net\.ec$|(^|\.)etapa\.net\.ec$|^emac\.gob\.ec$|^emov\.gob\.ec$|^emuvi\.gob\.ec$|^farmasol\.gob\.ec$|^centrosur\.gob\.ec$|^cceazuay\.gob\.ec$/i;

const RE_ACADEMIA_LOCAL = /(^|\.)ucuenca\.edu\.ec$|(^|\.)uazuay\.edu\.ec$|(^|\.)ucacue\.edu\.ec$/i;

/*
  Ecuador sin localidad demostrada. Sirve para separar
  «nacional» de «no se sabe», que no es lo mismo.
*/
const RE_ECUADOR = /\.ec$|\.com\.ec$|\.gob\.ec$|\.edu\.ec$|\.org\.ec$/i;


/*
  Entidad a la que pertenece un dominio. `webnueva.etapa.net.ec`
  y `etapa.net.ec` son la MISMA entidad con dos hosts, y contarlas
  dos veces inflaria el universo de fuentes con un duplicado.
*/
export function entidadDe(dominio) {
  const d = String(dominio || "").toLowerCase().replace(/^www\./, "");

  if (!d) return null;

  /* Subdominios institucionales colapsan a su entidad raiz. */
  const raices = [
    "cuenca.gob.ec", "azuay.gob.ec", "etapa.net.ec", "ucuenca.edu.ec",
    "uazuay.edu.ec", "ucacue.edu.ec", "casadelacultura.gob.ec"
  ];

  for (const r of raices) {
    if (d === r || d.endsWith(`.${r}`)) return r;
  }

  return d;
}


/*
===========================================================
CLASIFICAR LA LOCALIDAD DE UNA FUENTE
===========================================================

`evidencia` es lo comprobable sobre la fuente: lo que declara
su propio sitio, su tipo en el universo, su territorio
declarado. NO se acepta el nombre como prueba.
===========================================================
*/

export function clasificarLocalidad({
  dominio,
  tipoEnUniverso = null,
  territorioDeclarado = null,
  textoDelSitio = "",
  accesible = null
} = {}) {
  const d = String(dominio || "").toLowerCase().replace(/^www\./, "");

  const razones = [];

  const decidir = (localidad, familia, naturaleza) => ({
    dominio: d,
    entidad: entidadDe(d),
    localidad,
    familia,
    naturaleza,
    razones,
    /*
      La localidad de la fuente NO dice nada del territorio de
      sus piezas. Se repite en cada salida a proposito.
    */
    contentTerritoriality:
      "NO APLICA. El territorio de cada pieza se resuelve por separado, pieza a pieza."
  });

  if (!d) {
    razones.push("sin dominio");
    return decidir(LOCALIDAD.NO_RESOLUBLE, null, NATURALEZA.OTHER);
  }

  /* --- 1. ¿es una fuente, siquiera? --- */
  if (NO_SON_FUENTE.some((p) => d === p || d.endsWith(`.${p}`))) {
    razones.push("plataforma, agregador o enciclopedia: no publica agenda local propia");
    return decidir(LOCALIDAD.EXCLUIDA, null, NATURALEZA.OTHER);
  }

  /* --- 2. ¿es de otro país? El homónimo español entra aquí. --- */
  if (RE_FUERA_DE_ECUADOR.test(d)) {
    razones.push(
      /cuenca/i.test(d)
        ? "dominio de otro país que además contiene «cuenca»: es la Cuenca de España, no el cantón de Azuay"
        : "dominio de otro país"
    );
    return decidir(LOCALIDAD.NO_LOCAL, null, NATURALEZA.OTHER);
  }

  /* --- 3. señales fuertes: institución del cantón o provincia --- */
  if (RE_INSTITUCIONAL_LOCAL.test(d)) {
    razones.push("dominio institucional inequívoco del cantón o de la provincia");
    return decidir(
      LOCALIDAD.LOCAL_CORROBORADA,
      FAMILIAS_LOCALES.INSTITUCIONAL_PUBLICO,
      NATURALEZA.INSTITUTIONAL
    );
  }

  if (RE_ACADEMIA_LOCAL.test(d)) {
    razones.push("dominio académico inequívoco de una universidad del cantón");
    return decidir(
      LOCALIDAD.LOCAL_CORROBORADA,
      FAMILIAS_LOCALES.UNIVERSIDAD_ACADEMIA,
      NATURALEZA.ACADEMIC
    );
  }

  /* --- 4. lo que ya dice el universo de fuentes comprobado --- */
  if (territorioDeclarado === "ec-azuay-cuenca" || territorioDeclarado === "ec-azuay") {
    razones.push(`territorio declarado y verificado en el universo de fuentes: ${territorioDeclarado}`);

    const familia =
      tipoEnUniverso === "medio_local"
        ? FAMILIAS_LOCALES.MEDIOS_LOCALES
        : tipoEnUniverso === "institucion"
          ? FAMILIAS_LOCALES.INSTITUCIONAL_PUBLICO
          : FAMILIAS_LOCALES.OTROS_LOCALES;

    const naturaleza =
      tipoEnUniverso === "medio_local" ? NATURALEZA.MEDIA : NATURALEZA.INSTITUTIONAL;

    return decidir(LOCALIDAD.LOCAL_CORROBORADA, familia, naturaleza);
  }

  if (tipoEnUniverso === "medio_nacional") {
    razones.push("medio de alcance nacional en el universo de fuentes");
    return decidir(LOCALIDAD.NO_LOCAL, null, NATURALEZA.MEDIA);
  }

  /* --- 5. el sitio declara su ciudad --- */
  const texto = String(textoDelSitio || "");

  const declaraCuenca =
    /cuenca[\s,–-]*(azuay|ecuador)/i.test(texto) ||
    /azuay[\s,–-]*ecuador/i.test(texto) ||
    /(cuenca)[^.]{0,40}(ecuador)/i.test(texto);

  if (declaraCuenca && RE_ECUADOR.test(d)) {
    razones.push("el propio sitio declara Cuenca/Azuay junto a Ecuador, y el dominio es ecuatoriano");
    return decidir(
      LOCALIDAD.LOCAL_PROBABLE,
      FAMILIAS_LOCALES.OTROS_LOCALES,
      NATURALEZA.OTHER
    );
  }

  /* --- 6. ecuatoriano sin localidad demostrada --- */
  if (RE_ECUADOR.test(d)) {
    razones.push("dominio ecuatoriano sin evidencia de localidad en Cuenca");

    /*
      Que contenga «cuenca» no es prueba: es exactamente la
      regla que este proyecto ya aprendio a no usar.
    */
    if (/cuenca/i.test(d)) {
      razones.push(
        "el nombre contiene «cuenca», que NO es corroboración: es topónimo ambiguo y sustantivo común"
      );
    }

    return decidir(LOCALIDAD.AMBIGUA, null, NATURALEZA.OTHER);
  }

  if (accesible === false) {
    razones.push("no accesible: no se pudo comprobar nada");
    return decidir(LOCALIDAD.NO_RESOLUBLE, null, NATURALEZA.OTHER);
  }

  razones.push("sin señal de Ecuador ni de Cuenca");
  return decidir(LOCALIDAD.AMBIGUA, null, NATURALEZA.OTHER);
}


/*
===========================================================
PRIORIDAD DE OBSERVACION
===========================================================

No se observa todo con la misma intensidad. La prioridad sale
de REGLAS, no de un numero inventado del 0 al 100: un score
asi parece objetivo y no se puede auditar.
===========================================================
*/

export const PRIORIDAD = Object.freeze({ ALTA: "ALTA", MEDIA: "MEDIA", BAJA: "BAJA", EXCLUIR: "EXCLUIR" });


export function prioridadDe(ficha = {}, opciones = {}) {
  const { localidad, familia } = ficha;

  const yaEnElCorpus = opciones.yaEnElCorpus === true;

  const reglas = [];

  if (localidad === LOCALIDAD.EXCLUIDA) {
    reglas.push("no es una fuente: plataforma o agregador");
    return { prioridad: PRIORIDAD.EXCLUIR, reglas };
  }

  if (localidad === LOCALIDAD.NO_LOCAL) {
    reglas.push("la fuente no es local; su contenido puede seguir siendo evidencia si habla de Cuenca");
    return { prioridad: PRIORIDAD.BAJA, reglas };
  }

  if (localidad === LOCALIDAD.NO_RESOLUBLE) {
    reglas.push("sin evidencia comprobable");
    return { prioridad: PRIORIDAD.BAJA, reglas };
  }

  if (localidad === LOCALIDAD.LOCAL_CORROBORADA) {
    reglas.push("localidad corroborada por señal fuerte");

    if (!yaEnElCorpus) {
      reglas.push("no aporta todavía ninguna pieza al corpus: es diversidad nueva frente al peso nacional");
      return { prioridad: PRIORIDAD.ALTA, reglas };
    }

    reglas.push("ya presente en el corpus: se mantiene, no urge ampliarla");
    return { prioridad: PRIORIDAD.MEDIA, reglas };
  }

  if (localidad === LOCALIDAD.LOCAL_PROBABLE) {
    reglas.push("localidad probable: requiere verificación antes de tratarla como local");
    return { prioridad: PRIORIDAD.MEDIA, reglas };
  }

  reglas.push("ambigua: sin evidencia de localidad");
  return { prioridad: PRIORIDAD.BAJA, reglas };
}


/*
===========================================================
COMPOSICION DEL CORPUS

La cifra que decide si tiene sentido preguntar «¿de que habla
Cuenca?». `desconocida` existe porque no clasificar es mejor
que clasificar sin evidencia.
===========================================================
*/

export function composicionDelCorpus(evidencias = [], localidadPorDominio = new Map()) {
  const cuenta = {
    localCorroborada: 0,
    localProbable: 0,
    nacional: 0,
    otra: 0,
    desconocida: 0
  };

  const porNaturaleza = {};

  const entidades = new Set();

  evidencias.forEach((e) => {
    const dom = String(e.domain || e.sourceId || "").toLowerCase().replace(/^www\./, "");

    const ficha = localidadPorDominio.get(dom) || localidadPorDominio.get(entidadDe(dom)) || null;

    if (ficha?.entidad) entidades.add(ficha.entidad);

    if (!ficha) cuenta.desconocida += 1;
    else if (ficha.localidad === LOCALIDAD.LOCAL_CORROBORADA) cuenta.localCorroborada += 1;
    else if (ficha.localidad === LOCALIDAD.LOCAL_PROBABLE) cuenta.localProbable += 1;
    else if (ficha.localidad === LOCALIDAD.NO_LOCAL) cuenta.nacional += 1;
    else cuenta.otra += 1;

    /*
      La naturaleza la decide la ficha de la fuente SOLO cuando
      esa ficha sabe algo. Una pieza de X no tiene dominio web:
      su ficha cae en AMBIGUA con naturaleza OTHER, y quedarse
      ahi borraria toda la conversacion publica del recuento.

      Medido: con la ficha ganando siempre, el corpus reportaba
      0 PUBLIC_CONVERSATION teniendo 124 piezas de X.
    */
    const nat = ficha?.familia ? ficha.naturaleza : naturalezaPorProveedor(e);

    porNaturaleza[nat] = (porNaturaleza[nat] || 0) + 1;
  });

  const total = evidencias.length;

  const pct = (n) => (total === 0 ? null : Number(((n / total) * 100).toFixed(1)));

  return {
    total,
    ...cuenta,

    proporciones: {
      localCorroborada: pct(cuenta.localCorroborada),
      localProbable: pct(cuenta.localProbable),
      nacional: pct(cuenta.nacional),
      otra: pct(cuenta.otra),
      desconocida: pct(cuenta.desconocida)
    },

    porNaturaleza,
    entidadesDistintas: entidades.size,

    declaraciones: [
      "«desconocida» no es un fallo: es no haber comprobado la localidad de esa fuente. No se clasifica sin evidencia.",
      "La localidad de la fuente NO implica territorialidad de sus piezas.",
      "La evidencia nacional no se borra: sirve cuando habla explícitamente de Cuenca y para medir amplificación.",
      "Contenido institucional no es conversación ciudadana."
    ]
  };
}


/*
  Naturaleza deducida del proveedor cuando no hay ficha de
  fuente. Un resultado de busqueda es SEARCH_RESULT y un tuit
  es conversacion abierta; una nota de RSS es cobertura.
*/
export function naturalezaPorProveedor(evidencia = {}) {
  const provs = evidencia.providers || (evidencia.providerId ? [evidencia.providerId] : []);

  if (provs.includes("brave_web") || provs.includes("serpapi_google") || provs.includes("ddg_web")) {
    return NATURALEZA.SEARCH_RESULT;
  }

  if (provs.includes("x_api")) return NATURALEZA.PUBLIC_CONVERSATION;

  if (provs.includes("rss_directo") || provs.includes("gdelt_doc") || provs.includes("google_news")) {
    return NATURALEZA.MEDIA;
  }

  /*
    YouTube es el caso incomodo: un canal de television es MEDIA
    y un vecino grabando con el movil es conversacion. Sin
    saber de quien es el canal no se puede decidir, y se dice.
  */
  if (provs.includes("youtube_data")) return NATURALEZA.OTHER;

  return NATURALEZA.OTHER;
}


/*
===========================================================
ACTIVOS SOCIALES

Se auditan los ya descubiertos. Un activo NO habilita escucha
abierta: Facebook, Instagram y TikTok siguen siendo
KNOWN_ACCOUNT_ONLY, y observar la cuenta del Municipio no es
escuchar a la ciudadania.
===========================================================
*/

export const ESTADOS_ACTIVO = Object.freeze({
  VALIDO: "VALIDO",
  EXCLUIDO: "EXCLUIDO",
  NO_RESUELTO: "NO_RESUELTO"
});


const RUTAS_QUE_NO_SON_CUENTA = new Set([
  "sharer", "share", "sharer.php", "dialog", "plugins", "tr", "help",
  "policies", "legal", "login", "privacy", "profile.php", "groups",
  "watch", "events", "hashtag", "explore", "reel", "reels", "p",
  "accounts", "intent", "home", "search", "i", "settings", "about"
]);


export function auditarActivo(activo = {}) {
  const { plataforma, handle, estadoIdentidad } = activo;

  if (!plataforma || !handle) {
    return { ...activo, estado: ESTADOS_ACTIVO.NO_RESUELTO, motivo: "sin plataforma o sin handle" };
  }

  if (RUTAS_QUE_NO_SON_CUENTA.has(String(handle).toLowerCase())) {
    return {
      ...activo,
      estado: ESTADOS_ACTIVO.EXCLUIDO,
      motivo: "no es una cuenta: es una ruta de la plataforma (botón de compartir, diálogo, etc.)"
    };
  }

  /*
    Sin procedencia de descubrimiento no se puede auditar de
    donde salio, y un activo sin eso no vale para gastar una
    llamada.
  */
  if (!estadoIdentidad || !activo.descubiertoEn) {
    return {
      ...activo,
      estado: ESTADOS_ACTIVO.NO_RESUELTO,
      motivo: "sin procedencia de descubrimiento ni estado de identidad"
    };
  }

  const abierto = ["x", "youtube"].includes(plataforma);

  return {
    ...activo,
    estado: ESTADOS_ACTIVO.VALIDO,
    motivo: null,

    modoDeObservacion: abierto ? "OPEN_DISCOVERY" : "KNOWN_ACCOUNT_OBSERVATION",

    nota: abierto
      ? "Plataforma con búsqueda abierta: este activo se puede observar y además descubrir contenido nuevo."
      : "KNOWN_ACCOUNT_OBSERVATION. Tener el activo NO habilita descubrimiento abierto en esta plataforma."
  };
}


export function auditarActivos(activos = []) {
  const auditados = activos.map(auditarActivo);

  const porEstado = {};

  const porPlataforma = {};

  auditados.forEach((a) => {
    porEstado[a.estado] = (porEstado[a.estado] || 0) + 1;

    if (a.estado === ESTADOS_ACTIVO.VALIDO) {
      porPlataforma[a.plataforma] = (porPlataforma[a.plataforma] || 0) + 1;
    }
  });

  const entidades = new Set(auditados.map((a) => a.entidad || a.actorId).filter(Boolean));

  return {
    revisados: activos.length,
    validos: porEstado[ESTADOS_ACTIVO.VALIDO] || 0,
    excluidos: porEstado[ESTADOS_ACTIVO.EXCLUIDO] || 0,
    noResueltos: porEstado[ESTADOS_ACTIVO.NO_RESUELTO] || 0,

    porPlataforma,

    /*
      Tres cifras distintas. Una entidad con cinco activos no son
      cinco fuentes locales, y confundirlo infla la diversidad.
    */
    entidadesDistintas: entidades.size,

    auditados,

    declaraciones: [
      "ENTIDAD, ACTIVO y EVIDENCIA son tres cifras distintas: una entidad con cinco activos sigue siendo una entidad.",
      "Un activo de Facebook, Instagram o TikTok solo habilita KNOWN_ACCOUNT_OBSERVATION, nunca descubrimiento abierto.",
      "Observar la cuenta oficial de una institución no es escuchar a la ciudadanía."
    ]
  };
}


/*
  Fuentes que despues podrian administrarse desde Media
  Intelligence. Se entrega la lista estructurada y NADA MAS:
  este gate no toca la UX ni la metodologia de Media, y no
  construye un segundo universo de fuentes.
*/
export function candidatasParaMedia(fichas = []) {
  return fichas
    .filter((f) => f.localidad === LOCALIDAD.LOCAL_CORROBORADA)
    .map((f) => ({
      entidad: f.entidad,
      dominio: f.dominio,
      familia: f.familia,
      naturaleza: f.naturaleza,

      /* Solo los medios son candidatos a Media Source Universe. */
      candidataAMedia: f.familia === FAMILIAS_LOCALES.MEDIOS_LOCALES,

      clasificacion:
        f.familia === FAMILIAS_LOCALES.MEDIOS_LOCALES
          ? "MEDIA"
          : f.familia === FAMILIAS_LOCALES.INSTITUCIONAL_PUBLICO
            ? "INSTITUTIONAL"
            : f.familia === FAMILIAS_LOCALES.UNIVERSIDAD_ACADEMIA
              ? "ACADEMIC"
              : f.familia === FAMILIAS_LOCALES.CULTURA_COMUNIDAD
                ? "COMMUNITY"
                : "OTHER",

      estadoDeDescubrimiento: "DISCOVERED_BY_SENTINEL",
      requiereDecisionHumana: true,
      nota: "Lista estructurada para un gate posterior. No se ingresa a Media aquí."
    }));
}


export default {
  LOCALIDAD,
  FAMILIAS_LOCALES,
  NATURALEZA,
  PRIORIDAD,
  ESTADOS_ACTIVO,
  entidadDe,
  clasificarLocalidad,
  prioridadDe,
  composicionDelCorpus,
  naturalezaPorProveedor,
  auditarActivo,
  auditarActivos,
  candidatasParaMedia
};
