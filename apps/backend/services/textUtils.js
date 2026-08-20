// apps/backend/services/textUtils.js

/*
===========================================================
SENTINEL INTELLIGENCE
TEXT UTILS — utilidades compartidas de texto y URL
===========================================================

Utilidades comunes a:

- referenceProfileService.js  (Perfil de Referencia)
- socialDiscoveryService.js   (pendiente de unificar en el
                               sprint de Fusion Engine)
- identityService.js

No contiene lógica de negocio ni puntuación.
Solo normalización y extracción determinista.
===========================================================
*/


/*
-----------------------------------------------------------
PLATAFORMAS CONOCIDAS

Catálogo único de dominios sociales. Se mantiene aquí para
que el Perfil de Referencia y, más adelante, el Fusion
Engine reconozcan la misma lista.
-----------------------------------------------------------
*/

export const PLATAFORMAS_CONOCIDAS = [
  { id: "facebook",  nombre: "Facebook",    dominios: ["facebook.com", "fb.com", "m.facebook.com"], tipo: "social" },
  { id: "instagram", nombre: "Instagram",   dominios: ["instagram.com"],                            tipo: "social" },
  { id: "tiktok",    nombre: "TikTok",      dominios: ["tiktok.com"],                               tipo: "social" },
  { id: "youtube",   nombre: "YouTube",     dominios: ["youtube.com", "youtu.be"],                  tipo: "video"  },
  { id: "x",         nombre: "X",           dominios: ["x.com", "twitter.com"],                     tipo: "social" },
  { id: "linkedin",  nombre: "LinkedIn",    dominios: ["linkedin.com"],                             tipo: "social" },
  { id: "wikipedia", nombre: "Wikipedia",   dominios: ["wikipedia.org"],                            tipo: "referencia" },
  { id: "wayback",   nombre: "Wayback",     dominios: ["web.archive.org", "archive.org"],           tipo: "archivo" }
];


/*
-----------------------------------------------------------
SEGMENTOS DE RUTA QUE NO SON USUARIOS

Evita que youtube.com/watch?v=... produzca el usuario
"watch", o facebook.com/profile.php el usuario "profile.php".
-----------------------------------------------------------
*/

const SEGMENTOS_NO_USUARIO = new Set([
  "watch", "shorts", "results", "channel", "c", "user", "playlist",
  "profile.php", "pages", "groups", "events", "photo", "photos",
  "video", "videos", "reel", "reels", "story", "stories", "p", "tv",
  "search", "hashtag", "explore", "status", "i", "home", "login",
  "share", "posts", "post", "in", "company", "pub", "feed", "about",
  "help", "legal", "privacy", "terms", "es", "en", "www"
]);


/*
-----------------------------------------------------------
PALABRAS VACÍAS (es / en)

Se excluyen al extraer términos discriminantes.
-----------------------------------------------------------
*/

const PALABRAS_VACIAS = new Set([
  "para", "como", "pero", "porque", "cuando", "donde", "desde", "hasta",
  "sobre", "entre", "todo", "toda", "todos", "todas", "este", "esta",
  "estos", "estas", "esto", "ese", "esa", "esos", "esas", "aquel",
  "que", "los", "las", "del", "con", "por", "una", "uno", "unos", "unas",
  "sus", "sus", "mas", "muy", "ser", "son", "fue", "han", "hay", "ha",
  "the", "and", "for", "with", "from", "this", "that", "these", "those",
  "was", "were", "are", "his", "her", "its", "you", "not", "all", "new",
  "resultado", "resultados", "obtenido", "obtenidos", "mediante",
  "busqueda", "abierta", "noticia", "noticias", "encontrada",
  "encontrado", "informacion", "publica", "disponible", "snapshot",
  "captura", "historico", "registro", "sitio", "web", "pagina", "www",
  "com", "net", "org", "https", "http", "html", "video", "videos",
  "foto", "fotos", "perfil", "perfiles", "cuenta", "cuentas"
]);


/*
-----------------------------------------------------------
NORMALIZAR TEXTO

Minúsculas, sin tildes, sin espacios redundantes.
-----------------------------------------------------------
*/

export function normalizarTexto(texto = "") {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}


/*
-----------------------------------------------------------
QUITAR TILDES conservando mayúsculas
-----------------------------------------------------------
*/

export function quitarTildes(texto = "") {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}


/*
-----------------------------------------------------------
TOKENIZAR

Devuelve palabras normalizadas, sin signos, con longitud
mínima y sin palabras vacías.
-----------------------------------------------------------
*/

export function tokenizar(texto = "", longitudMinima = 3) {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9ñ\s._-]/g, " ")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .filter((palabra) => palabra.length >= longitudMinima)
    .filter((palabra) => !PALABRAS_VACIAS.has(palabra))
    .filter((palabra) => !/^\d+$/.test(palabra));
}


/*
-----------------------------------------------------------
ES PALABRA VACÍA
-----------------------------------------------------------
*/

export function esPalabraVacia(palabra = "") {
  return PALABRAS_VACIAS.has(normalizarTexto(palabra));
}


/*
-----------------------------------------------------------
NORMALIZAR URL

Devuelve una forma canónica comparable:

- minúsculas
- sin protocolo
- sin "www."
- sin parámetros de rastreo
- sin barra final

Es la clave que permitirá al Fusion Engine reconocer que
dos motores encontraron EL MISMO hallazgo.

Devuelve null si la entrada no es una URL utilizable.
-----------------------------------------------------------
*/

const PARAMETROS_RASTREO = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "igshid", "ref", "ref_src", "ref_url", "_ga",
  "mc_cid", "mc_eid", "source", "spm"
];

/*
-----------------------------------------------------------
DECODIFICAR ENTIDADES HTML básicas

Los resultados raspados de HTML llegan con &amp; y similares.
-----------------------------------------------------------
*/

export function decodificarEntidades(texto = "") {
  return String(texto ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    /* &amp; al final: evita re-decodificar entidades anidadas */
    .replace(/&amp;/g, "&");
}


/*
-----------------------------------------------------------
LIMPIAR HTML

Quita etiquetas y decodifica entidades. Usado para extraer
títulos y snippets reales del HTML de los buscadores.
-----------------------------------------------------------
*/

export function limpiarHtml(texto = "") {
  return decodificarEntidades(
    String(texto ?? "").replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}


/*
-----------------------------------------------------------
DESENVOLVER REDIRECCIÓN DE BUSCADOR

Los buscadores no devuelven el enlace final, sino una URL
propia de redirección:

  //duckduckgo.com/l/?uddg=https%3A%2F%2Finstagram.com%2Fx
  https://www.google.com/url?q=https://...

Sin desenvolverla, el dominio detectado sería el del
BUSCADOR y no el del hallazgo: no habría plataformas, ni
handles, ni posibilidad de reconocer que dos motores
encontraron la misma URL.

Aplica hasta 3 niveles por si la redirección está anidada.
-----------------------------------------------------------
*/

const PARAMETROS_REDIRECCION = ["uddg", "q", "url", "u", "target", "r"];

const HOSTS_REDIRECCION = [
  "duckduckgo.com",
  "google.com",
  "www.google.com",
  "bing.com",
  "www.bing.com",
  "r.msn.com",
  "l.facebook.com",
  "out.reddit.com"
];

export function desenvolverRedireccion(entrada = "") {
  let texto = decodificarEntidades(String(entrada ?? "").trim());

  if (!texto) return "";

  for (let nivel = 0; nivel < 3; nivel += 1) {
    // Enlaces sin protocolo tipo "//duckduckgo.com/l/?uddg=..."
    const conProtocolo = texto.startsWith("//") ? `https:${texto}` : texto;

    let url;

    try {
      url = new URL(conProtocolo);
    } catch {
      return texto;
    }

    const host = url.hostname.toLowerCase();

    const esRedireccion = HOSTS_REDIRECCION.some(
      (h) => host === h || host.endsWith(`.${h}`)
    );

    if (!esRedireccion) return texto;

    let destino = null;

    for (const parametro of PARAMETROS_REDIRECCION) {
      const valor = url.searchParams.get(parametro);

      if (valor && /^https?:\/\//i.test(decodeURIComponent(valor))) {
        destino = decodeURIComponent(valor);
        break;
      }
    }

    if (!destino) return texto;

    texto = destino;
  }

  return texto;
}


export function normalizarUrl(entrada = "") {
  const bruta = desenvolverRedireccion(entrada);

  if (!bruta) return null;

  let texto = bruta;

  if (!/^https?:\/\//i.test(texto)) {
    if (!/^[\w.-]+\.[a-z]{2,}/i.test(texto)) return null;
    texto = `https://${texto}`;
  }

  try {
    const url = new URL(texto);

    if (!url.hostname) return null;

    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    PARAMETROS_RASTREO.forEach((p) => url.searchParams.delete(p));

    const parametros = url.searchParams.toString();

    let ruta = url.pathname.replace(/\/+$/, "");

    if (ruta === "/") ruta = "";

    return `${host}${ruta}${parametros ? `?${parametros}` : ""}`.toLowerCase();
  } catch {
    return null;
  }
}


/*
-----------------------------------------------------------
EXTRAER DOMINIO
-----------------------------------------------------------
*/

export function extraerDominio(entrada = "") {
  const normalizada = normalizarUrl(entrada);

  if (!normalizada) return null;

  return normalizada.split("/")[0].split("?")[0];
}


/*
-----------------------------------------------------------
DETECTAR PLATAFORMA a partir de una URL

Se basa en el DOMINIO, no en el texto del título.
Devuelve null si no es una plataforma conocida.
-----------------------------------------------------------
*/

export function detectarPlataformaPorUrl(entrada = "") {
  const dominio = extraerDominio(entrada);

  if (!dominio) return null;

  for (const plataforma of PLATAFORMAS_CONOCIDAS) {
    const coincide = plataforma.dominios.some(
      (d) => dominio === d || dominio.endsWith(`.${d}`)
    );

    if (coincide) {
      return {
        id: plataforma.id,
        nombre: plataforma.nombre,
        tipo: plataforma.tipo,
        dominio
      };
    }
  }

  return null;
}


/*
-----------------------------------------------------------
EXTRAER HANDLE / USUARIO de una URL de plataforma

Devuelve null cuando el primer segmento no es un usuario
real (watch, profile.php, search...).
-----------------------------------------------------------
*/

export function extraerHandle(entrada = "") {
  const normalizada = normalizarUrl(entrada);

  if (!normalizada) return null;

  const partes = normalizada.split("?")[0].split("/").filter(Boolean);

  // partes[0] es el dominio
  if (partes.length < 2) return null;

  let candidato = partes[1];

  // youtube.com/@usuario  ·  tiktok.com/@usuario
  if (candidato.startsWith("@")) {
    candidato = candidato.slice(1);
  }

  // youtube.com/channel/UC...  ·  linkedin.com/in/usuario
  if (SEGMENTOS_NO_USUARIO.has(candidato)) {
    if (partes.length >= 3 && !SEGMENTOS_NO_USUARIO.has(partes[2])) {
      candidato = partes[2].startsWith("@") ? partes[2].slice(1) : partes[2];
    } else {
      return null;
    }
  }

  candidato = candidato.replace(/\.(html?|php|aspx?)$/i, "").trim();

  if (!candidato) return null;
  if (candidato.length < 2 || candidato.length > 60) return null;
  if (/^\d+$/.test(candidato)) return null;
  if (SEGMENTOS_NO_USUARIO.has(candidato)) return null;

  return candidato;
}


/*
-----------------------------------------------------------
OBTENER ENLACE DE UN RESULTADO

Los servicios actuales no son homogéneos: googleService y
googleNewsService devuelven `enlace`, socialDiscoveryService
espera `url`. Esta función lee ambos sin modificar aún los
servicios existentes.
-----------------------------------------------------------
*/

export function obtenerEnlace(resultado = {}) {
  const bruto =
    resultado.enlace ||
    resultado.url ||
    resultado.link ||
    null;

  if (!bruto) return null;

  /*
    Se devuelve el enlace REAL, no el de redirección del
    buscador. El resultado original no se modifica.
  */
  const real = desenvolverRedireccion(bruto);

  return real || bruto;
}


/*
-----------------------------------------------------------
TEXTO PLANO DE UN RESULTADO

Concatena título y descripción evitando "undefined".
-----------------------------------------------------------
*/

export function textoDeResultado(resultado = {}) {
  return [resultado.titulo, resultado.descripcion]
    .filter((parte) => typeof parte === "string" && parte.trim())
    .join(" ");
}


/*
-----------------------------------------------------------
CONTAR FRECUENCIAS de una lista de tokens
-----------------------------------------------------------
*/

export function contarFrecuencias(tokens = []) {
  const mapa = new Map();

  tokens.forEach((token) => {
    mapa.set(token, (mapa.get(token) || 0) + 1);
  });

  return mapa;
}


/*
-----------------------------------------------------------
LIMITAR un número a un rango
-----------------------------------------------------------
*/

export function limitar(valor, minimo = 0, maximo = 100) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return minimo;

  return Math.max(minimo, Math.min(maximo, numero));
}
