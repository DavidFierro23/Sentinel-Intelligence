// apps/backend/services/intelligence/candidatePhotoResolver.js

/*
===========================================================
RESOLVER DE FOTOGRAFIA DEL CANDIDATO — P-CAND-UX-04
===========================================================

QUE HACE

Dada una cuenta que el analista declaro o que Sentinel
consolido, intenta obtener una imagen publica de esa FUENTE
leyendo su metadata estandar. Nada mas.

QUE NO HACE, Y NO ES NEGOCIABLE

    NO reconocimiento facial ni biometria.
    NO analiza pixeles para decidir identidad.
    NO login, ni cookies privadas, ni bypass de autenticacion.
    NO scraping masivo: una peticion por fuente, con tope.
    NO inventa una imagen cuando no la encuentra.

LA DISTINCION QUE SOSTIENE TODO

    fotoManualUrl   enlace directo a una imagen que dio el analista
    fotoSourceUrl   pagina de una cuenta o web desde donde intentar

Una pagina de perfil NUNCA se usa como `src` de un `<img>`. Se
lee su metadata y, si declara una imagen, se usa ESA.

Y una distincion mas, que es facil de romper y grave:

    verifiedImageResource   la URL devuelve una imagen
    verificadaPorSentinel   Sentinel verifico a quien retrata

La primera se puede comprobar con una peticion HTTP. La segunda
exigiria reconocimiento facial, que este modulo se prohibe. La
segunda es siempre `false`.
===========================================================
*/

import { capacidadDe, CAPACIDADES } from "./accountContracts.js";

/*
  Prioridad CENTRALIZADA. El gate lo pide asi a proposito: si
  cada componente decidiera su orden con if/else, dos partes de
  la interfaz mostrarian fotos distintas para el mismo candidato.
*/
export const PRIORIDAD_FUENTES = Object.freeze([
  "manual",
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "youtube",
  "linkedin",
  "web"
]);


export const RESULTADOS = Object.freeze({
  RESUELTA: "RESUELTA",
  SIN_METADATA: "SIN_METADATA",
  BLOQUEADA: "BLOQUEADA",
  TIMEOUT: "TIMEOUT",
  NO_IMAGEN: "NO_IMAGEN",
  IMAGEN_GENERICA: "IMAGEN_GENERICA",
  ERROR: "ERROR",

  /*
    No se intento porque la plataforma no lo permite con nuestra
    infraestructura. Distinto de haber intentado y fallado.
  */
  NO_INTENTADA: "NO_INTENTADA"
});


const TIEMPO_MAXIMO_MS = 6000;

const AGENTE =
  "SentinelIntelligence/1.0 (+lectura de metadata publica; sin autenticacion)";

/* Tope de fuentes por resolucion: una peticion por fuente, no mas. */
const TOPE_INTENTOS = 4;

const TAMANO_MINIMO_BYTES = 1024;

const TAMANO_MAXIMO_BYTES = 12 * 1024 * 1024;


/*
-----------------------------------------------------------
IMAGENES QUE NO SON UN RETRATO

Un favicon, un sprite o un pixel de seguimiento son imagenes
validas y no sirven de nada. Y las plataformas devuelven su
propio logotipo cuando la pagina no expone foto: aceptarlo
pondria el logo de Instagram como cara del candidato.
-----------------------------------------------------------
*/
const PATRONES_GENERICOS = [
  /favicon/i,
  /sprite/i,
  /\/pixel[./]/i,
  /1x1\.(png|gif)/i,
  /placeholder/i,
  /default[-_]?(avatar|profile|user)/i,
  /\b(logo|brandmark|watermark)\b/i,
  /instagram\.com\/static/i,
  /static\.xx\.fbcdn\.net\/rsrc/i,
  /abs\.twimg\.com\/(icons|responsive)/i,
  /(^|\/)(apple-touch-icon|og-default|share-image)/i
];

function pareceGenerica(url) {
  const u = String(url || "");

  return PATRONES_GENERICOS.some((re) => re.test(u));
}


/*
-----------------------------------------------------------
METADATA PUBLICA ESTANDAR

Solo se leen claves declaradas por la propia pagina para ser
compartida. No se recorre el DOM buscando la imagen «mas
grande»: eso seria adivinar cual es el retrato.
-----------------------------------------------------------
*/
const CLAVES_METADATA = [
  { clave: "og:image:secure_url", peso: 5 },
  { clave: "og:image:url", peso: 5 },
  { clave: "og:image", peso: 5 },
  { clave: "twitter:image:src", peso: 4 },
  { clave: "twitter:image", peso: 4 }
];


export function extraerMetadataImagen(html) {
  const texto = String(html || "");

  const hallazgos = [];

  CLAVES_METADATA.forEach(({ clave, peso }) => {
    /*
      Se admiten `property` y `name`, y el orden de atributos
      indistinto: hay paginas que escriben `content` antes.
    */
    const patrones = [
      new RegExp(
        `<meta[^>]+(?:property|name)\\s*=\\s*["']${clave}["'][^>]*content\\s*=\\s*["']([^"']+)["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*(?:property|name)\\s*=\\s*["']${clave}["']`,
        "i"
      )
    ];

    for (const re of patrones) {
      const m = texto.match(re);

      if (m?.[1]) {
        hallazgos.push({ clave, url: m[1].trim(), peso });

        return;
      }
    }
  });

  /*
    JSON-LD: se lee `image` de un bloque schema.org. Puede venir
    como cadena, como objeto con `url` o como lista.
  */
  const bloques = texto.match(
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  (bloques || []).forEach((bloque) => {
    const cuerpo = bloque.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");

    try {
      const datos = JSON.parse(cuerpo);

      const nodos = Array.isArray(datos) ? datos : [datos];

      nodos.forEach((n) => {
        const img = n?.image || n?.author?.image || n?.publisher?.logo;

        const url =
          typeof img === "string"
            ? img
            : Array.isArray(img)
              ? typeof img[0] === "string"
                ? img[0]
                : img[0]?.url
              : img?.url;

        if (url) hallazgos.push({ clave: "json-ld:image", url: String(url).trim(), peso: 3 });
      });
    } catch {
      /* Un JSON-LD roto no invalida el resto de la pagina. */
    }
  });

  /* La de mayor peso primero; a igual peso, la que aparecio antes. */
  return hallazgos.sort((a, b) => b.peso - a.peso);
}


/*
-----------------------------------------------------------
PEDIR UNA PAGINA

Sin autenticacion, con tope de tiempo y siguiendo redirecciones
normales. Si la fuente responde 401/403 se declara BLOQUEADA: no
se intenta entrar de otra forma.
-----------------------------------------------------------
*/
async function pedirTexto(url, fetchImpl) {
  const control = new AbortController();

  const reloj = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

  try {
    const r = await fetchImpl(url, {
      redirect: "follow",
      headers: {
        "User-Agent": AGENTE,
        Accept: "text/html,application/xhtml+xml"
      },
      signal: control.signal
    });

    if (!r.ok) {
      const bloqueada = r.status === 401 || r.status === 403 || r.status === 429;

      return {
        ok: false,
        httpStatus: r.status,
        resultado: bloqueada ? RESULTADOS.BLOQUEADA : RESULTADOS.ERROR,
        motivo: bloqueada
          ? `la fuente no permite la lectura publica (HTTP ${r.status})`
          : `HTTP ${r.status}`
      };
    }

    return { ok: true, httpStatus: r.status, html: await r.text() };
  } catch (e) {
    const abortada = e?.name === "AbortError";

    return {
      ok: false,
      httpStatus: null,
      resultado: abortada ? RESULTADOS.TIMEOUT : RESULTADOS.ERROR,
      motivo: abortada
        ? `la fuente no respondio en ${TIEMPO_MAXIMO_MS} ms`
        : e?.message || "fallo de red"
    };
  } finally {
    clearTimeout(reloj);
  }
}


/*
-----------------------------------------------------------
COMPROBAR QUE LA URL DEVUELVE UNA IMAGEN

No basta con que acabe en `.jpg`. Se pide la cabecera y se mira
el `Content-Type` y el tamano: una pagina HTML con extension de
imagen existe, y un pixel de un byte tambien.
-----------------------------------------------------------
*/
export async function comprobarRecursoImagen(url, fetchImpl) {
  const control = new AbortController();

  const reloj = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

  try {
    const r = await fetchImpl(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": AGENTE },
      signal: control.signal
    });

    if (!r.ok) {
      return {
        valido: false,
        httpStatus: r.status,
        resultado: RESULTADOS.NO_IMAGEN,
        motivo: `la imagen no se pudo comprobar (HTTP ${r.status})`
      };
    }

    const tipo = String(r.headers?.get?.("content-type") || "").toLowerCase();

    if (!tipo.startsWith("image/")) {
      return {
        valido: false,
        httpStatus: r.status,
        contentType: tipo || null,
        resultado: RESULTADOS.NO_IMAGEN,
        motivo: `el recurso no es una imagen (content-type ${tipo || "desconocido"})`
      };
    }

    const largo = Number(r.headers?.get?.("content-length") || 0);

    if (largo && largo < TAMANO_MINIMO_BYTES) {
      return {
        valido: false,
        httpStatus: r.status,
        contentType: tipo,
        bytes: largo,
        resultado: RESULTADOS.IMAGEN_GENERICA,
        motivo: `la imagen pesa ${largo} bytes: demasiado pequena para un retrato`
      };
    }

    if (largo && largo > TAMANO_MAXIMO_BYTES) {
      return {
        valido: false,
        httpStatus: r.status,
        contentType: tipo,
        bytes: largo,
        resultado: RESULTADOS.NO_IMAGEN,
        motivo: "la imagen excede el tamano razonable"
      };
    }

    return {
      valido: true,
      httpStatus: r.status,
      contentType: tipo,
      bytes: largo || null
    };
  } catch (e) {
    const abortada = e?.name === "AbortError";

    return {
      valido: false,
      httpStatus: null,
      resultado: abortada ? RESULTADOS.TIMEOUT : RESULTADOS.ERROR,
      motivo: abortada ? "la imagen no respondio en el tiempo maximo" : e?.message || "fallo de red"
    };
  } finally {
    clearTimeout(reloj);
  }
}


function absoluta(url, base) {
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}


/*
-----------------------------------------------------------
UN INTENTO SOBRE UNA FUENTE
-----------------------------------------------------------
*/
async function intentarFuente(cuenta, fetchImpl) {
  const cap = capacidadDe(cuenta.plataformaId);

  const base = {
    plataformaId: cuenta.plataformaId,
    plataforma: cuenta.plataforma || cuenta.plataformaId,
    handle: cuenta.handle || null,
    cuentaId: cuenta.id || null,
    sourceUrl: cuenta.url || null,
    sourceType: "cuenta"
  };

  if (!cuenta.url) {
    return { ...base, resultado: RESULTADOS.ERROR, motivo: "la cuenta no tiene URL" };
  }

  /*
    Si la plataforma no expone metadata publica, no se pide la
    pagina: seria gastar una peticion para recibir un muro. Se
    declara y se pasa a la siguiente.
  */
  if (!cap.metadataPublica) {
    return {
      ...base,
      resultado: RESULTADOS.NO_INTENTADA,
      capacidad: cap.capacidad,
      motivo: cap.motivo
    };
  }

  const pagina = await pedirTexto(cuenta.url, fetchImpl);

  if (!pagina.ok) {
    return {
      ...base,
      resultado: pagina.resultado,
      httpStatus: pagina.httpStatus,
      motivo: pagina.motivo
    };
  }

  const hallazgos = extraerMetadataImagen(pagina.html);

  if (!hallazgos.length) {
    return {
      ...base,
      resultado: RESULTADOS.SIN_METADATA,
      httpStatus: pagina.httpStatus,
      motivo: "la pagina no declara og:image, twitter:image ni image en JSON-LD"
    };
  }

  for (const h of hallazgos) {
    const url = absoluta(h.url, cuenta.url);

    if (!url) continue;

    if (pareceGenerica(url)) {
      /*
        Se sigue probando: puede haber otra clave con el retrato
        real. Pero se registra, porque un logo aceptado como cara
        del candidato seria un error visible y silencioso.
      */
      base.descartadasPorGenericas = [
        ...(base.descartadasPorGenericas || []),
        { url, clave: h.clave }
      ];

      continue;
    }

    const recurso = await comprobarRecursoImagen(url, fetchImpl);

    if (recurso.valido) {
      return {
        ...base,
        resultado: RESULTADOS.RESUELTA,
        httpStatus: pagina.httpStatus,
        metadataKey: h.clave,
        imageUrl: url,
        contentType: recurso.contentType,
        bytes: recurso.bytes,

        /*
          La URL devuelve una imagen. NO dice nada sobre a quien
          retrata: eso exigiria reconocimiento facial, que este
          modulo se prohibe.
        */
        verifiedImageResource: true,
        verificadaPorSentinel: false
      };
    }

    base.recursosRechazados = [
      ...(base.recursosRechazados || []),
      { url, clave: h.clave, motivo: recurso.motivo, resultado: recurso.resultado }
    ];
  }

  const soloGenericas =
    (base.descartadasPorGenericas || []).length > 0 &&
    !(base.recursosRechazados || []).length;

  return {
    ...base,
    resultado: soloGenericas ? RESULTADOS.IMAGEN_GENERICA : RESULTADOS.NO_IMAGEN,
    httpStatus: pagina.httpStatus,
    metadataEncontrada: hallazgos.map((h) => h.clave),
    motivo: soloGenericas
      ? "la pagina solo declara imagenes genericas de la plataforma, no un retrato"
      : "ninguna de las imagenes declaradas resulto ser un recurso de imagen valido"
  };
}


/*
===========================================================
RESOLVER
===========================================================

Recorre la prioridad y se detiene en la primera fuente que
resuelve. Registra TODOS los intentos, tambien los que no se
hicieron: no ocultar fallos es la mitad del contrato.
===========================================================
*/
export async function resolverFotoDeCandidato(entrada = {}) {
  const {
    candidateId = null,
    fotoManualUrl = null,
    cuentas = [],
    fetchImpl = globalThis.fetch,
    prioridad = PRIORIDAD_FUENTES
  } = entrada;

  const intentos = [];

  const limitaciones = [];

  /*
    1 · LO MANUAL MANDA. Si el analista dio un enlace directo, no
    se sale a la red: su decision no necesita confirmacion.
  */
  if (fotoManualUrl) {
    intentos.push({
      plataformaId: "manual",
      sourceType: "manual",
      resultado: RESULTADOS.RESUELTA,
      imageUrl: fotoManualUrl,
      motivo: "fotografia indicada por el analista"
    });

    return {
      fotoActual: {
        imageUrl: fotoManualUrl,
        sourceUrl: fotoManualUrl,
        sourceType: "manual",
        plataformaId: null,
        cuentaId: null,
        handle: null,
        metadataKey: null,
        provider: null,
        resolvedAt: new Date().toISOString(),
        verifiedImageResource: false,
        verificadaPorSentinel: false,
        origen: "analista"
      },
      intentos,
      limitaciones
    };
  }

  /* 2 · las fuentes, en el orden centralizado. */
  const porPlataforma = new Map();

  (cuentas || []).forEach((c) => {
    if (!porPlataforma.has(c.plataformaId)) porPlataforma.set(c.plataformaId, []);

    porPlataforma.get(c.plataformaId).push(c);
  });

  let ejecutados = 0;

  for (const plataformaId of prioridad.filter((x) => x !== "manual")) {
    const suyas = porPlataforma.get(plataformaId) || [];

    for (const cuenta of suyas) {
      const cap = capacidadDe(plataformaId);

      if (
        cap.capacidad === CAPACIDADES.BLOCKED ||
        cap.capacidad === CAPACIDADES.UNSUPPORTED ||
        !cap.metadataPublica
      ) {
        intentos.push({
          plataformaId,
          plataforma: cap.plataforma,
          handle: cuenta.handle || null,
          cuentaId: cuenta.id || null,
          sourceUrl: cuenta.url || null,
          sourceType: "cuenta",
          resultado: RESULTADOS.NO_INTENTADA,
          capacidad: cap.capacidad,
          motivo: cap.motivo
        });

        limitaciones.push(`${cap.plataforma}: ${cap.motivo}`);

        continue;
      }

      if (ejecutados >= TOPE_INTENTOS) {
        intentos.push({
          plataformaId,
          plataforma: cap.plataforma,
          cuentaId: cuenta.id || null,
          sourceUrl: cuenta.url || null,
          sourceType: "cuenta",
          resultado: RESULTADOS.NO_INTENTADA,
          motivo: `tope de ${TOPE_INTENTOS} fuentes por resolucion: no se pidio esta pagina`
        });

        continue;
      }

      ejecutados += 1;

      const intento = await intentarFuente(cuenta, fetchImpl);

      intentos.push(intento);

      if (intento.resultado === RESULTADOS.RESUELTA) {
        return {
          fotoActual: {
            imageUrl: intento.imageUrl,
            sourceUrl: intento.sourceUrl,
            sourceType: "cuenta",
            plataformaId: intento.plataformaId,
            cuentaId: intento.cuentaId,
            handle: intento.handle,
            metadataKey: intento.metadataKey,
            provider: "metadata publica",
            resolvedAt: new Date().toISOString(),
            verifiedImageResource: true,

            /*
              Siempre false. Que la URL devuelva una imagen no dice
              a quien retrata, y averiguarlo exigiria biometria.
            */
            verificadaPorSentinel: false,

            origen: cuenta.declaradaPorAnalista
              ? "cuenta_declarada"
              : "cuenta_descubierta",

            contentType: intento.contentType || null,
            bytes: intento.bytes || null
          },
          intentos,
          limitaciones
        };
      }

      if (intento.motivo) {
        limitaciones.push(
          `${intento.plataforma || plataformaId}: ${intento.motivo}`
        );
      }
    }
  }

  /*
    Ninguna fuente resolvio. No se inventa nada: se devuelve
    `null` con la lista entera de intentos, para que la interfaz
    pueda decir que se probo y que paso.
  */
  return { fotoActual: null, intentos, limitaciones };
}


export default {
  PRIORIDAD_FUENTES,
  RESULTADOS,
  resolverFotoDeCandidato,
  extraerMetadataImagen,
  comprobarRecursoImagen
};
