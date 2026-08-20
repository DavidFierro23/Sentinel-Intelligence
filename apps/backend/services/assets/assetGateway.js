// apps/backend/services/assets/assetGateway.js

import { calcularHash } from "../knowledgeLake/lakeHash.js";

/*
===========================================================
SENTINEL INTELLIGENCE
SENTINEL ASSET GATEWAY (SAG)
===========================================================

Capa ÚNICA para servir activos externos. Generaliza el proxy
de avatares del Sprint 3.2.1 y resuelve B1 de forma
definitiva.

  El frontend nunca habla con un origen externo.
  Pide el activo al SAG; el SAG lo resuelve, lo valida, lo
  cachea y lo sirve desde nuestro propio origen.

-----------------------------------------------------------
B1, RECORDATORIO DE LA CAUSA
-----------------------------------------------------------

Las fotografías de Wikimedia llegan por
commons.wikimedia.org/wiki/Special:FilePath, que responde con
una cadena de DOS redirecciones (302 → 301 → 200). Solo la
última lleva `access-control-allow-origin`. Con
`crossOrigin="anonymous"` el navegador exige la cabecera en
CADA respuesta de la cadena, así que la carga fallaba y el
nodo del grafo quedaba sin imagen.

El SAG resuelve la cadena en el servidor, donde no hay
política CORS, y emite UNA sola respuesta con la cabecera
bajo nuestro control.

-----------------------------------------------------------
DOS CONTROLES INDEPENDIENTES CONTRA SSRF
-----------------------------------------------------------

El endpoint anterior aceptaba una URL arbitraria y la
validaba contra una lista blanca. El SAG añade un segundo
control que no depende del primero:

  1. `assetId` = hash del sourceUrl. El cliente solo puede
     pedir activos cuyo identificador COINCIDA con el hash de
     la URL que envía. No puede inventar pares.

  2. Lista blanca de hosts POR TIPO DE ACTIVO, aplicada
     también al host FINAL tras las redirecciones. Sin esto,
     un redirect abierto alojado en un host permitido burlaría
     el control.

Los dos juntos: aunque alguien descubriera un redirect
abierto en Wikimedia, tendría que además producir un assetId
que case con esa URL — y el assetId lo emite el backend.
===========================================================
*/


/*
-----------------------------------------------------------
TIPOS DE ACTIVO Y SUS ORÍGENES PERMITIDOS

Cada tipo declara sus hosts y su licencia por defecto.
Añadir un tipo o un host es una decisión explícita, no una
consecuencia de un cambio de código.
-----------------------------------------------------------
*/

export const TIPOS_ACTIVO = Object.freeze({
  FOTOGRAFIA_PUBLICA: "fotografia_publica",
  LOGO: "logo",
  MINIATURA_YOUTUBE: "miniatura_youtube",
  MAPA: "mapa"
});


export const CATALOGO_TIPOS = Object.freeze([
  {
    tipo: TIPOS_ACTIVO.FOTOGRAFIA_PUBLICA,
    nombre: "Fotografía pública",
    hosts: [
      "upload.wikimedia.org",
      "commons.wikimedia.org",
      "commons.m.wikimedia.org",
      "es.wikipedia.org",
      "en.wikipedia.org",
      "www.wikidata.org"
    ],
    licenciaPorDefecto: "Wikimedia Commons — ver la página del archivo",
    contentTypes: ["image/"],
    implementado: true
  },
  {
    tipo: TIPOS_ACTIVO.LOGO,
    nombre: "Logotipo institucional",
    /*
      Mismos orígenes que las fotografías: Wikimedia aloja
      logos de instituciones y medios con licencia declarada.
      No se añaden servicios de logos de terceros: la mayoría
      no declara licencia por activo.
    */
    hosts: ["upload.wikimedia.org", "commons.wikimedia.org"],
    licenciaPorDefecto: "Wikimedia Commons — ver la página del archivo",
    contentTypes: ["image/"],
    implementado: true
  },
  {
    tipo: TIPOS_ACTIVO.MINIATURA_YOUTUBE,
    nombre: "Miniatura de YouTube",
    /*
      i.ytimg.com sirve las miniaturas con un patrón de URL
      documentado y público. No requiere API ni credencial.

      LÍMITE DECLARADO: solo hay miniatura para un VÍDEO
      concreto. La imagen de un CANAL requiere la Data API
      (Sprint 3.2, no implementada), así que un canal sin
      vídeo identificado no tiene miniatura y se declara.
    */
    hosts: ["i.ytimg.com", "img.youtube.com"],
    licenciaPorDefecto:
      "Miniatura servida por YouTube — derechos del titular del vídeo",
    contentTypes: ["image/"],
    implementado: true
  },
  {
    tipo: TIPOS_ACTIVO.MAPA,
    nombre: "Tesela de mapa",
    /*
      Reservado para el War Room (UX-WR-001). No se declara
      ningún host todavía: el basemap se decidirá al
      implementar UX-2, y declarar un host antes sería
      comprometer una decisión que no está tomada.
    */
    hosts: [],
    licenciaPorDefecto: null,
    contentTypes: ["image/"],
    implementado: false,
    motivo:
      "Reservado para UX-2 (War Room). El basemap y su licencia se deciden al implementarlo."
  }
]);


export function tipoDeActivo(tipo) {
  return CATALOGO_TIPOS.find((t) => t.tipo === tipo) || null;
}


const TIEMPO_MAXIMO_MS = 12000;

const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024;

const CACHE_TTL_MS = 30 * 60 * 1000;

const CACHE_MAXIMO = 300;

const AGENTE =
  "SentinelIntelligence/1.0 (plataforma de inteligencia; contacto interno)";

export const RUTA_BASE = "/api/assets";


/*
===========================================================
IDENTIFICADOR DE ACTIVO

Determinista: el mismo origen produce el mismo assetId en
cualquier ejecución. Se reutiliza el hash canónico del
Knowledge Lake para no tener dos implementaciones.
===========================================================
*/

export function calcularAssetId(sourceType, sourceUrl) {
  return `as-${calcularHash({ sourceType, sourceUrl }).slice(0, 16)}`;
}


/*
===========================================================
VALIDACIÓN
===========================================================
*/

export function validarOrigen(sourceType, sourceUrl) {
  const definicion = tipoDeActivo(sourceType);

  if (!definicion) {
    return { valido: false, estado: 400, motivo: `tipo de activo desconocido: ${sourceType}` };
  }

  if (!definicion.implementado) {
    return {
      valido: false,
      estado: 501,
      motivo: `el tipo "${sourceType}" está reservado y no implementado: ${definicion.motivo}`
    };
  }

  let url;

  try {
    url = new URL(sourceUrl);
  } catch {
    return { valido: false, estado: 400, motivo: "URL no válida" };
  }

  if (url.protocol !== "https:") {
    return {
      valido: false,
      estado: 403,
      motivo: `protocolo no permitido: ${url.protocol}`
    };
  }

  const host = url.hostname.toLowerCase();

  if (!definicion.hosts.includes(host)) {
    return {
      valido: false,
      estado: 403,
      motivo: `host "${host}" no permitido para el tipo "${sourceType}"`,
      hostsPermitidos: definicion.hosts
    };
  }

  return { valido: true, definicion, host };
}


/*
===========================================================
REGISTRO Y CACHÉ
===========================================================
*/

const registro = new Map();

const cache = new Map();


function podarCache() {
  if (cache.size < CACHE_MAXIMO) return;

  const primera = cache.keys().next().value;

  if (primera) cache.delete(primera);
}


/*
-----------------------------------------------------------
REGISTRAR UN ACTIVO

No descarga nada: solo declara el activo y devuelve su ficha
con assetId, tipo, origen, licencia y la ruta por la que el
frontend podrá pedirlo.

La descarga ocurre cuando el navegador pide la ruta.
-----------------------------------------------------------
*/

export function registrarActivo({
  sourceType,
  sourceUrl,
  license = null,
  contexto = null
}) {
  const validacion = validarOrigen(sourceType, sourceUrl);

  if (!validacion.valido) {
    return {
      registrado: false,
      motivo: validacion.motivo,
      estado: validacion.estado
    };
  }

  const assetId = calcularAssetId(sourceType, sourceUrl);

  const enCache = cache.get(assetId);

  const ficha = {
    /* ---- CAMPOS EXIGIDOS ---- */
    assetId,
    sourceType,
    sourceUrl,
    license: license || validacion.definicion.licenciaPorDefecto,
    fetchedAt: enCache?.fetchedAt || null,
    cacheStatus: enCache ? "cacheado" : "no_solicitado",

    /* ---- COMPLEMENTOS ---- */
    host: validacion.host,
    tipoNombre: validacion.definicion.nombre,

    /*
      ---------------------------------------------------------
      RUTA DEL ACTIVO — solo el assetId
      ---------------------------------------------------------

      B2 (QA-1): la version anterior incluia la URL de origen
      en `?src=`. Aunque el navegador pedia el activo a NUESTRO
      host y el CORS funcionaba, la cadena
      «...?src=https://commons.wikimedia.org/...» hacia que una
      URL de Wikimedia SI existiera en el frontend, visible en
      las herramientas del navegador.

      La exigencia es que no exista ninguna. El assetId basta:
      el gateway conoce su origen porque lo registro el.

      `src` sigue ACEPTANDOSE como respaldo opcional (el
      registro vive en memoria y se pierde al reiniciar), pero
      ya no se EMITE.
    */
    ruta: `${RUTA_BASE}/${assetId}`,

    contexto,

    registradoEn: new Date().toISOString()
  };

  registro.set(assetId, ficha);

  return { registrado: true, ...ficha };
}


export function fichaDeActivo(assetId) {
  return registro.get(assetId) || null;
}


/*
===========================================================
OBTENER EL ACTIVO

Aquí sí se descarga. Dos controles independientes:
integridad del par (assetId ↔ sourceUrl) y lista blanca por
tipo, aplicada también al host final.
===========================================================
*/

export async function obtenerActivo(assetId, sourceUrlRecibida = null, sourceTypeSugerido = null) {
  if (!assetId) {
    return { ok: false, estado: 400, motivo: "falta assetId" };
  }

  /*
    ---------------------------------------------------------
    RESOLUCION DEL ORIGEN

    Via principal: el REGISTRO. El gateway emitio el assetId,
    asi que conoce su sourceUrl; el cliente no necesita
    enviarla y por tanto no aparece en el frontend.

    Via de respaldo: `src`. El registro es en memoria y se
    pierde al reiniciar el backend; una pagina ya cargada
    seguiria pidiendo activos con assetId que el proceso nuevo
    no conoce. Aceptar `src` cuando se envia hace el sistema
    autorreparable, y el control de integridad del par sigue
    aplicandose igual.
  */
  const fichaRegistrada = registro.get(assetId);

  const sourceUrl = fichaRegistrada?.sourceUrl || sourceUrlRecibida;

  if (!sourceUrl) {
    return {
      ok: false,
      estado: 404,
      motivo:
        "activo no registrado en esta instancia y sin src de respaldo. El registro es en memoria: vuelva a ejecutar la investigacion para registrarlo.",
      requiereRegistro: true
    };
  }

  /*
    ---------------------------------------------------------
    CONTROL 1 · INTEGRIDAD DEL PAR

    Se prueba con cada tipo implementado: el assetId debe
    coincidir con el hash de (tipo, url) para alguno. Si no
    coincide con ninguno, el par fue fabricado.
  */
  const tiposCandidatos = sourceTypeSugerido
    ? [sourceTypeSugerido]
    : CATALOGO_TIPOS.filter((t) => t.implementado).map((t) => t.tipo);

  const sourceType = tiposCandidatos.find(
    (t) => calcularAssetId(t, sourceUrl) === assetId
  );

  if (!sourceType) {
    return {
      ok: false,
      estado: 403,
      motivo: fichaRegistrada
        ? "inconsistencia interna: el registro no verifica su propio hash"
        : "el assetId no corresponde al hash de la URL enviada: el par no fue emitido por el gateway"
    };
  }

  /*
    ---------------------------------------------------------
    CONTROL 2 · LISTA BLANCA POR TIPO
  */
  const validacion = validarOrigen(sourceType, sourceUrl);

  if (!validacion.valido) {
    return { ok: false, estado: validacion.estado, motivo: validacion.motivo };
  }

  /*
    ---------------------------------------------------------
    CACHÉ
  */
  const enCache = cache.get(assetId);

  if (enCache && Date.now() - enCache.guardadoEn < CACHE_TTL_MS) {
    return {
      ok: true,
      assetId,
      sourceType,
      sourceUrl,
      license: enCache.license,
      fetchedAt: enCache.fetchedAt,
      cacheStatus: "hit",
      contentType: enCache.contentType,
      bytes: enCache.bytes,
      buffer: enCache.buffer,
      urlFinal: enCache.urlFinal
    };
  }

  /*
    ---------------------------------------------------------
    DESCARGA
  */
  const control = new AbortController();

  const temporizador = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

  try {
    const respuesta = await fetch(sourceUrl, {
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
        motivo: `el origen respondió HTTP ${respuesta.status}`
      };
    }

    /*
      El host FINAL, tras las redirecciones, también debe
      estar permitido.
    */
    const validacionFinal = validarOrigen(sourceType, respuesta.url);

    if (!validacionFinal.valido) {
      return {
        ok: false,
        estado: 403,
        motivo: `la redirección terminó en un origen no permitido: ${validacionFinal.motivo}`
      };
    }

    const contentType = (respuesta.headers.get("content-type") || "").split(";")[0];

    const permitido = validacion.definicion.contentTypes.some((p) =>
      contentType.startsWith(p)
    );

    if (!permitido) {
      return {
        ok: false,
        estado: 415,
        motivo: `el origen devolvió "${contentType}", no admitido para "${sourceType}"`
      };
    }

    const buffer = Buffer.from(await respuesta.arrayBuffer());

    if (buffer.length > TAMANO_MAXIMO_BYTES) {
      return {
        ok: false,
        estado: 413,
        motivo: `el activo ocupa ${buffer.length} bytes, por encima del máximo`
      };
    }

    const fetchedAt = new Date().toISOString();

    const license =
      registro.get(assetId)?.license || validacion.definicion.licenciaPorDefecto;

    podarCache();

    cache.set(assetId, {
      buffer,
      contentType,
      bytes: buffer.length,
      urlFinal: respuesta.url,
      license,
      fetchedAt,
      guardadoEn: Date.now()
    });

    /* Se actualiza la ficha del registro. */
    const ficha = registro.get(assetId);

    if (ficha) {
      ficha.fetchedAt = fetchedAt;
      ficha.cacheStatus = "cacheado";
    }

    return {
      ok: true,
      assetId,
      sourceType,
      sourceUrl,
      license,
      fetchedAt,
      cacheStatus: "miss",
      contentType,
      bytes: buffer.length,
      buffer,
      urlFinal: respuesta.url
    };
  } catch (error) {
    const abortado = error?.name === "AbortError";

    return {
      ok: false,
      estado: 504,
      noConsultado: true,
      motivo: abortado
        ? `el origen no respondió en ${TIEMPO_MAXIMO_MS / 1000}s`
        : `fallo de red: ${error?.message || "desconocido"}`
    };
  } finally {
    clearTimeout(temporizador);
  }
}


/*
===========================================================
AYUDAS DE ALTO NIVEL
===========================================================
*/

/*
  Miniatura de un vídeo de YouTube. Patrón de URL público y
  documentado; no requiere API.
*/
export function registrarMiniaturaYoutube(videoId, contexto = null) {
  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) {
    return {
      registrado: false,
      motivo: "identificador de vídeo no válido"
    };
  }

  return registrarActivo({
    sourceType: TIPOS_ACTIVO.MINIATURA_YOUTUBE,
    sourceUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    contexto: { videoId, ...(contexto || {}) }
  });
}


export function absolutizar(ruta, req) {
  if (!ruta) return null;

  const protocolo = req?.protocol || "http";

  const host = req?.get ? req.get("host") : null;

  return host ? `${protocolo}://${host}${ruta}` : ruta;
}


export function estadoGateway() {
  return {
    activo: true,
    tipos: CATALOGO_TIPOS.map((t) => ({
      tipo: t.tipo,
      nombre: t.nombre,
      implementado: t.implementado,
      hosts: t.hosts.length,
      motivo: t.motivo || null
    })),
    registro: registro.size,
    cache: {
      entradas: cache.size,
      maximo: CACHE_MAXIMO,
      ttlMinutos: CACHE_TTL_MS / 60000
    },
    controles: [
      "integridad del par assetId ↔ sourceUrl",
      "lista blanca de hosts por tipo de activo",
      "validación del host final tras redirecciones",
      "content-type por tipo",
      "tamaño máximo 8 MB",
      "tiempo máximo 12 s"
    ]
  };
}
