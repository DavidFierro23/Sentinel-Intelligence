// apps/backend/services/avatar/avatarProxy.js

/*
===========================================================
SENTINEL INTELLIGENCE
AVATAR PROXY — resolución de imágenes en el backend
===========================================================

RESUELVE B1, confirmado por QA-1.

El problema, medido:

  El frontend cargaba la imagen con `img.crossOrigin =
  "anonymous"` para poder dibujarla en el canvas del grafo.
  Las fotografías de nivel 3 llegan por
  commons.wikimedia.org/wiki/Special:FilePath/..., que
  responde con una cadena de DOS redirecciones:

      302 → 301 → 200

  Solo la respuesta final lleva `access-control-allow-origin`.
  En una petición CORS el navegador exige la cabecera en CADA
  respuesta de la cadena, así que la carga fallaba y el nodo
  del grafo quedaba sin fotografía.

La solución: el navegador nunca habla con Wikimedia. El
backend resuelve la cadena de redirecciones, valida y sirve
los bytes desde su propio origen, donde el CORS ya está
bajo nuestro control.

-----------------------------------------------------------
ESTO NO ES UN PROXY ABIERTO
-----------------------------------------------------------

Un proxy que acepte cualquier URL convierte al backend en un
instrumento de SSRF: cualquiera podría usarlo para alcanzar
servicios internos (169.254.169.254, localhost, la red
privada) desde nuestra IP.

Por eso hay tres controles, y los tres son obligatorios:

  1. LISTA BLANCA DE HOSTS — solo Wikimedia.
  2. VALIDACIÓN TRAS LAS REDIRECCIONES — el host final también
     debe estar en la lista. Sin esto, un redirect abierto en
     un host permitido burlaría el control 1.
  3. TIPO DE CONTENIDO — solo image/*. Un HTML servido como
     avatar no tiene sentido y podría ser un vector.

Además: tamaño máximo, tiempo máximo y caché en memoria.
===========================================================
*/


/*
-----------------------------------------------------------
CONTROL 1 · LISTA BLANCA

Solo los hosts de Wikimedia que sirven imágenes o resuelven
a ellas. Añadir un host aquí es una decisión explícita.
-----------------------------------------------------------
*/

export const HOSTS_PERMITIDOS = Object.freeze([
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "commons.m.wikimedia.org",
  "www.wikidata.org",
  "es.wikipedia.org",
  "en.wikipedia.org"
]);


const TIEMPO_MAXIMO_MS = 12000;

const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024; // 8 MB

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

const CACHE_MAXIMO_ENTRADAS = 200;

const AGENTE =
  "SentinelIntelligence/1.0 (plataforma de inteligencia; contacto interno)";


/*
-----------------------------------------------------------
CACHÉ EN MEMORIA

Evita volver a pedir la misma fotografía en cada
investigación. No se persiste: al reiniciar se vuelve a
resolver.
-----------------------------------------------------------
*/

const cache = new Map();

function leerCache(clave) {
  const entrada = cache.get(clave);

  if (!entrada) return null;

  if (Date.now() - entrada.guardadoEn > CACHE_TTL_MS) {
    cache.delete(clave);
    return null;
  }

  return entrada;
}

function escribirCache(clave, valor) {
  /* Desalojo simple: la entrada más antigua. */
  if (cache.size >= CACHE_MAXIMO_ENTRADAS) {
    const primera = cache.keys().next().value;

    if (primera) cache.delete(primera);
  }

  cache.set(clave, { ...valor, guardadoEn: Date.now() });
}

export function estadoCache() {
  return {
    entradas: cache.size,
    maximo: CACHE_MAXIMO_ENTRADAS,
    ttlMinutos: CACHE_TTL_MS / 60000
  };
}


/*
-----------------------------------------------------------
VALIDACIÓN DE HOST
-----------------------------------------------------------
*/

export function hostPermitido(url) {
  try {
    const u = new URL(url);

    if (u.protocol !== "https:") {
      return { permitido: false, motivo: `protocolo no permitido: ${u.protocol}` };
    }

    const host = u.hostname.toLowerCase();

    if (!HOSTS_PERMITIDOS.includes(host)) {
      return {
        permitido: false,
        motivo: `host no permitido: ${host}. Solo se sirven imágenes de Wikimedia.`
      };
    }

    return { permitido: true, host };
  } catch {
    return { permitido: false, motivo: "URL no válida" };
  }
}


/*
===========================================================
RESOLVER Y OBTENER LA IMAGEN
===========================================================
*/

export async function obtenerImagen(urlOrigen) {
  const validacion = hostPermitido(urlOrigen);

  if (!validacion.permitido) {
    return { ok: false, estado: 403, motivo: validacion.motivo };
  }

  const enCache = leerCache(urlOrigen);

  if (enCache) {
    return {
      ok: true,
      desdeCache: true,
      bytes: enCache.bytes,
      contentType: enCache.contentType,
      urlFinal: enCache.urlFinal,
      buffer: enCache.buffer
    };
  }

  const control = new AbortController();

  const temporizador = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

  try {
    /*
      `redirect: "follow"` resuelve la cadena 302 → 301 → 200
      en el servidor. Aquí no hay política CORS: el problema
      del navegador desaparece por construcción.
    */
    const respuesta = await fetch(urlOrigen, {
      headers: { "User-Agent": AGENTE, Accept: "image/*" },
      redirect: "follow",
      signal: control.signal
    });

    if (!respuesta.ok) {
      const limitado = respuesta.status === 429 || respuesta.status >= 500;

      return {
        ok: false,
        estado: limitado ? 503 : 502,
        noConsultado: limitado,
        motivo: `la fuente respondió HTTP ${respuesta.status}`
      };
    }

    /*
      CONTROL 2 · el host FINAL, tras las redirecciones,
      también debe estar en la lista blanca. Sin esto un
      redirect abierto en un host permitido burlaría el
      control 1.
    */
    const validacionFinal = hostPermitido(respuesta.url);

    if (!validacionFinal.permitido) {
      return {
        ok: false,
        estado: 403,
        motivo: `la redirección terminó en un host no permitido: ${validacionFinal.motivo}`
      };
    }

    /*
      CONTROL 3 · tipo de contenido.
    */
    const contentType = (respuesta.headers.get("content-type") || "").split(";")[0];

    if (!contentType.startsWith("image/")) {
      return {
        ok: false,
        estado: 415,
        motivo: `la fuente devolvió "${contentType}", no una imagen`
      };
    }

    const declarado = Number(respuesta.headers.get("content-length") || 0);

    if (declarado && declarado > TAMANO_MAXIMO_BYTES) {
      return {
        ok: false,
        estado: 413,
        motivo: `la imagen declara ${declarado} bytes, por encima del máximo de ${TAMANO_MAXIMO_BYTES}`
      };
    }

    const buffer = Buffer.from(await respuesta.arrayBuffer());

    if (buffer.length > TAMANO_MAXIMO_BYTES) {
      return {
        ok: false,
        estado: 413,
        motivo: `la imagen ocupa ${buffer.length} bytes, por encima del máximo`
      };
    }

    const resultado = {
      buffer,
      contentType,
      bytes: buffer.length,
      urlFinal: respuesta.url
    };

    escribirCache(urlOrigen, resultado);

    return { ok: true, desdeCache: false, ...resultado };
  } catch (error) {
    const abortado = error?.name === "AbortError";

    return {
      ok: false,
      estado: 504,
      noConsultado: true,
      motivo: abortado
        ? `la fuente no respondió en ${TIEMPO_MAXIMO_MS / 1000}s`
        : `fallo de red: ${error?.message || "desconocido"}`
    };
  } finally {
    clearTimeout(temporizador);
  }
}


/*
===========================================================
RUTA DE PROXY

Se devuelve RELATIVA. La absolutiza la capa de rutas, que es
la única que conoce el host de la petición.
===========================================================
*/

export const RUTA_PROXY = "/api/osint/avatar";


export function construirRutaProxy(urlOrigen) {
  if (!urlOrigen) return null;

  /* Solo tiene sentido para URLs remotas servibles. */
  if (!hostPermitido(urlOrigen).permitido) return null;

  return `${RUTA_PROXY}?src=${encodeURIComponent(urlOrigen)}`;
}


/*
-----------------------------------------------------------
ABSOLUTIZAR

Convierte la ruta relativa en URL completa usando el host de
la petición, para que el frontend pueda pedirla tal cual.
-----------------------------------------------------------
*/

export function absolutizar(ruta, req) {
  if (!ruta) return null;

  const protocolo = req?.protocol || "http";

  const host = req?.get ? req.get("host") : null;

  if (!host) return ruta;

  return `${protocolo}://${host}${ruta}`;
}
