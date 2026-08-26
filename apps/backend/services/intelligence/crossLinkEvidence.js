// apps/backend/services/intelligence/crossLinkEvidence.js

/*
===========================================================
CROSS-LINK EVIDENCE — P-CAND-02
===========================================================

Candidate Intelligence V1 dejo un hueco declarado: los enlaces
cruzados llegaban vacios, asi que una cuenta declarada por el
analista se quedaba en DECLARADA para siempre. Sin senal
independiente no habia forma de que ascendiera, y esa es la
senal mas facil de conseguir sin comprar nada.

Esto la consigue:

    pagina que Sentinel YA puede leer
      → enlace publico saliente
        → cuenta social identificada por SD-1A
          → evidencia independiente del nombre
            → Account Resolution

LO QUE ESTO NO ES
-----------------------------------------------------------

    NO corrobora por nombre parecido.
    NO corrobora por handle parecido.
    NO corrobora porque el analista declarara la cuenta.

El valor de un enlace cruzado no esta en el parecido: esta en
que ALGUIEN DISTINTO de nosotros publico la asociacion. Es
evidencia externa, y por eso puede sostener una atribucion
donde mil coincidencias de nombre no pueden.

LA CADENA DE CONFIANZA, DICHA EN VOZ ALTA
-----------------------------------------------------------

Cuando la pagina de origen es la web que el analista declaro,
la cadena es:

    analista → web → cuenta

El analista aporta la SEMILLA; la web aporta la EVIDENCIA. El
enlace no lo escribio el analista, y por eso cuenta. Pero si la
web declarada fuera la equivocada, todo lo que cuelgue de ella
hereda el error — asi que la cadena se guarda entera en
`cadenaDeConfianza` y se puede inspeccionar.

Eso es distinto de que el analista declare la cuenta
directamente: eso no es evidencia de nada y sigue sin corroborar.

CONTRA LA CIRCULARIDAD
-----------------------------------------------------------

Una cuenta no puede corroborar a otra si ella misma no esta
corroborada todavia. Si no, dos cuentas que se enlazan entre si
se ascenderian mutuamente sin que nadie externo hubiera dicho
nada. `ACCOUNT_TO_ACCOUNT` exige que el origen ya este
CORROBORADA o CONSOLIDADA.

SIN SCRAPING AGRESIVO
-----------------------------------------------------------

Solo paginas cuya lectura publica ya esta contemplada, una
peticion por pagina, tope por ejecucion, sin login, sin cookies
y sin cabecera de autenticacion. Un 401, 403 o 429 se declara y
no se intenta entrar de otra forma.
===========================================================
*/

import { clasificarUrlSocial } from "../social/discovery/socialUrlClassifier.js";

import { capacidadDe, CAPACIDADES } from "./accountContracts.js";


/*
-----------------------------------------------------------
DIRECCIONALIDAD

Tres direcciones, y no valen lo mismo. Tratarlas como una sola
senal seria perder justamente la informacion que las hace
utiles.
-----------------------------------------------------------
*/
export const DIRECCIONES = Object.freeze({
  /*
    La web del candidato enlaza a una cuenta. El sujeto declara
    la cuenta como suya en su propio sitio.
  */
  WEB_TO_ACCOUNT: "WEB_TO_ACCOUNT",

  /*
    Una cuenta ya corroborada enlaza a otra. Vale solo si el
    origen esta corroborado: si no, es circular.
  */
  ACCOUNT_TO_ACCOUNT: "ACCOUNT_TO_ACCOUNT",

  /*
    Un tercero —un medio, una institucion— publica la cuenta
    como del candidato. Es la mas independiente de las tres y
    tambien la mas facil de confundir con una simple mencion.
  */
  EXTERNAL_REFERENCE_TO_ACCOUNT: "EXTERNAL_REFERENCE_TO_ACCOUNT"
});


export const FUERZA_DIRECCION = Object.freeze({
  WEB_TO_ACCOUNT: {
    independiente: true,
    senalDeResolucion: "web_declarada",
    explicacion:
      "la web del propio candidato publica la cuenta como suya: lo declara el sujeto, no nosotros"
  },

  ACCOUNT_TO_ACCOUNT: {
    independiente: true,
    senalDeResolucion: "enlace_cruzado",
    exigeOrigenCorroborado: true,
    explicacion:
      "una cuenta ya corroborada enlaza a esta, asi que el vinculo lo declara el propio sujeto desde una identidad ya sostenida"
  },

  EXTERNAL_REFERENCE_TO_ACCOUNT: {
    independiente: true,
    senalDeResolucion: "referencia_independiente",
    explicacion:
      "una fuente ajena al candidato y ajena a Sentinel publica esta cuenta como suya"
  }
});


/* Estados de una observacion de enlaces. */
export const ESTADOS_CROSSLINK = Object.freeze({
  OBSERVADA: "OBSERVADA",
  SIN_ENLACES: "SIN_ENLACES",
  NO_LEGIBLE: "NO_LEGIBLE",
  BLOQUEADA: "BLOQUEADA",
  TIMEOUT: "TIMEOUT",
  NO_EJECUTADA: "NO_EJECUTADA",
  ERROR: "ERROR"
});


const TIEMPO_MAXIMO_MS = 6000;

/* Tope de paginas por ejecucion. No hay barrido masivo. */
const TOPE_PAGINAS = 6;

/* Tope de enlaces analizados por pagina. */
const TOPE_ENLACES = 200;

const AGENTE =
  "SentinelIntelligence/1.0 (+lectura de enlaces publicos; sin autenticacion)";


/*
===========================================================
ENLACES SALIENTES DE UN HTML

Solo `href` de anclas. No se ejecuta JavaScript, no se sigue
ninguna redireccion adicional y no se descarga nada mas que el
documento.
===========================================================
*/
export function extraerEnlacesSalientes(html, urlBase = null) {
  const texto = String(html || "");

  const encontrados = [];

  const vistos = new Set();

  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi;

  let m;

  while ((m = re.exec(texto)) !== null && encontrados.length < TOPE_ENLACES) {
    const bruto = m[1].trim();

    if (!bruto || bruto.startsWith("mailto:") || bruto.startsWith("tel:")) {
      continue;
    }

    /* Se resuelven los relativos contra la pagina de origen. */
    let absoluta = bruto;

    if (!/^https?:\/\//i.test(bruto)) {
      if (!urlBase) continue;

      try {
        absoluta = new URL(bruto, urlBase).toString();
      } catch {
        continue;
      }
    }

    const clave = absoluta.toLowerCase();

    if (vistos.has(clave)) continue;

    vistos.add(clave);

    encontrados.push(absoluta);
  }

  return encontrados;
}


/*
  Enlaces que apuntan a una CUENTA social identificable. La
  identificacion la hace SD-1A, que es la autoridad para
  URL → plataforma + handle. No se reimplementa aqui.
*/
export function cuentasEnlazadas(enlaces = []) {
  const cuentas = [];

  const descartados = [];

  (enlaces || []).forEach((url) => {
    const c = clasificarUrlSocial(url);

    if (!c.esSocial) {
      descartados.push({ url, motivo: c.motivo || "no es una URL social" });

      return;
    }

    if (!c.esCuenta || !c.handle) {
      descartados.push({
        url,
        plataformaId: c.plataformaId || null,
        motivo: c.motivo || "la URL no identifica una cuenta"
      });

      return;
    }

    cuentas.push({
      plataformaId: c.plataformaId,
      plataforma: c.plataforma,
      handle: c.handle,
      urlCanonica: c.urlCanonica || c.urlNormalizada || url,
      urlOriginal: url,
      tipo: c.tipo,
      handleDerivadoDeContenido: c.handleDerivadoDeContenido === true
    });
  });

  return { cuentas, descartados };
}


/*
===========================================================
UNA SENAL DE CROSS-LINK

`relationId` es la identidad ESTABLE de la relacion: la misma
pagina enlazando la misma cuenta es la misma relacion, la
vuelvas a observar cien veces. Sin eso, cien observaciones
serian cien senales independientes y la corroboracion se
inflaria sola.
===========================================================
*/
export function crearSenalCrossLink(entrada = {}) {
  const direccion = entrada.direccion || DIRECCIONES.WEB_TO_ACCOUNT;

  const fuerza = FUERZA_DIRECCION[direccion] || {};

  const sourceUrl = entrada.sourceUrl || null;

  const targetUrl = entrada.targetUrl || null;

  const observedAt = entrada.observedAt || new Date().toISOString();

  return {
    /* Identidad estable de la RELACION, no de la observacion. */
    relationId: `xl-${direccion}-${clave(sourceUrl)}->${entrada.accountId || clave(targetUrl)}`,

    candidateId: entrada.candidateId || null,
    projectId: entrada.projectId || null,

    accountId: entrada.accountId || null,

    direccion,

    sourceUrl,
    targetUrl,

    platformId: entrada.platformId || null,
    handle: entrada.handle || null,

    /* ---- historico de la relacion ---- */
    firstObservedAt: entrada.firstObservedAt || observedAt,
    lastObservedAt: observedAt,
    observationCount: entrada.observationCount || 1,

    /* Compatibilidad con el contrato de V1. */
    observedAt,

    /*
      Evidencias que la sostienen. Se acumulan: una relacion
      vista por dos rutas distintas tiene dos evidencias y sigue
      siendo UNA relacion.
    */
    evidenceIds: entrada.evidenceIds || (entrada.evidenceId ? [entrada.evidenceId] : []),
    evidenceId: entrada.evidenceId || null,

    provenance: {
      observationMethod: entrada.observationMethod || "enlace_saliente_html",
      provider: entrada.provider || "lectura publica",
      sourceType: entrada.sourceType || null,

      /*
        LA CADENA COMPLETA. Si la semilla la puso el analista se
        dice aqui, para que nadie confunda «el sujeto lo publica
        en su web» con «el analista lo escribio».
      */
      cadenaDeConfianza: entrada.cadenaDeConfianza || [],
      fuenteDeclaradaPorAnalista: entrada.fuenteDeclaradaPorAnalista === true
    },

    observationMethod: entrada.observationMethod || "enlace_saliente_html",

    /* ---- que vale esta senal ---- */
    independiente: fuerza.independiente === true,
    senalDeResolucion: fuerza.senalDeResolucion || null,
    explicacion: fuerza.explicacion || null,

    /*
      Motivo por el que NO cuenta, cuando no cuenta. Una senal
      descartada se conserva: saber que se descarto y por que es
      parte del expediente.
    */
    descartada: entrada.descartada === true,
    motivoDescarte: entrada.motivoDescarte || null
  };
}


function clave(url) {
  return String(url || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}


function dominioDe(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    /* Sin esquema no se puede construir una URL: se intenta a mano. */
    const m = String(url || "").match(/^(?:https?:\/\/)?([^/?#]+)/i);

    return m ? m[1].replace(/^www\./i, "").toLowerCase() : null;
  }
}


/*
===========================================================
FUSIONAR: LA MISMA RELACION NO SE CUENTA DOS VECES
===========================================================

`firstObservedAt` NUNCA se reescribe. Es el unico campo de todo
el modulo que no puede cambiar: es la respuesta a «cuando lo
vimos por primera vez», y una reescritura la borraria sin dejar
rastro.
===========================================================
*/
export function fusionarSenales(previas = [], nuevas = []) {
  const porRelacion = new Map();

  (previas || []).forEach((s) => {
    if (s?.relationId) porRelacion.set(s.relationId, { ...s });
  });

  const aparecidas = [];

  (nuevas || []).forEach((s) => {
    if (!s?.relationId) return;

    const ya = porRelacion.get(s.relationId);

    if (!ya) {
      porRelacion.set(s.relationId, { ...s });

      aparecidas.push(s.relationId);

      return;
    }

    porRelacion.set(s.relationId, {
      ...ya,
      ...s,

      /* INMUTABLE. */
      firstObservedAt: ya.firstObservedAt,

      lastObservedAt: s.lastObservedAt || s.observedAt || ya.lastObservedAt,

      observationCount: (ya.observationCount || 1) + 1,

      evidenceIds: [
        ...new Set([...(ya.evidenceIds || []), ...(s.evidenceIds || [])])
      ]
    });
  });

  const fusionadas = [...porRelacion.values()];

  return {
    senales: fusionadas,

    total: fusionadas.length,

    aparecidas,

    /*
      Relaciones que estaban y esta vez no se vieron. NO se
      borran: igual que con las cuentas, la ausencia de una
      observacion no es la desaparicion del hecho.
    */
    noReobservadas: fusionadas
      .filter(
        (s) =>
          !(nuevas || []).some((n) => n.relationId === s.relationId)
      )
      .map((s) => s.relationId),

    nota:
      "`firstObservedAt` no se reescribe nunca. `observationCount` cuenta observaciones, no senales: la misma relacion vista diez veces sigue siendo UNA senal independiente."
  };
}


async function pedirPagina(url, fetchImpl) {
  const control = new AbortController();

  const reloj = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

  try {
    const r = await fetchImpl(url, {
      redirect: "follow",
      headers: { "User-Agent": AGENTE, Accept: "text/html,application/xhtml+xml" },
      signal: control.signal
    });

    if (!r.ok) {
      const bloqueada = r.status === 401 || r.status === 403 || r.status === 429;

      return {
        ok: false,
        httpStatus: r.status,
        estado: bloqueada
          ? ESTADOS_CROSSLINK.BLOQUEADA
          : ESTADOS_CROSSLINK.NO_LEGIBLE,
        motivo: bloqueada
          ? `la fuente no permite la lectura publica (HTTP ${r.status})`
          : `HTTP ${r.status}`
      };
    }

    return { ok: true, httpStatus: r.status, html: await r.text() };
  } catch (e) {
    return {
      ok: false,
      httpStatus: null,
      estado:
        e?.name === "AbortError"
          ? ESTADOS_CROSSLINK.TIMEOUT
          : ESTADOS_CROSSLINK.ERROR,
      motivo:
        e?.name === "AbortError"
          ? `la fuente no respondio en ${TIEMPO_MAXIMO_MS} ms`
          : e?.message || "fallo de red"
    };
  } finally {
    clearTimeout(reloj);
  }
}


/*
  Paginas que Sentinel PUEDE leer hoy. La lista no se decide
  aqui: se pregunta al mapa de capacidades, que es el que sabe
  que plataformas admiten lectura publica.
*/
export function fuenteLegible(fuente) {
  const cap = capacidadDe(fuente?.plataformaId);

  if (
    cap.capacidad === CAPACIDADES.BLOCKED ||
    cap.capacidad === CAPACIDADES.UNSUPPORTED
  ) {
    return { legible: false, motivo: cap.motivo };
  }

  if (!cap.metadataPublica) {
    return { legible: false, motivo: cap.motivo };
  }

  return { legible: true, motivo: null };
}


/*
===========================================================
OBSERVAR ENLACES SALIENTES
===========================================================

`ejecutar: false` es el modo por defecto: describe QUE se haria
sin pedir ni una pagina, igual que la observacion de cuentas.
Salir a la red lo decide el analista.
===========================================================
*/
export async function observarEnlacesSalientes(entrada = {}) {
  const {
    candidateId = null,
    projectId = null,
    fuentes = [],
    cuentasConocidas = [],
    fetchImpl = globalThis.fetch,
    ejecutar = false
  } = entrada;

  const senales = [];

  const intentos = [];

  let paginas = 0;

  for (const fuente of fuentes) {
    const legible = fuenteLegible(fuente);

    const comun = {
      sourceUrl: fuente.url,
      plataformaOrigen: fuente.plataformaId || null,
      direccion: fuente.direccion || DIRECCIONES.WEB_TO_ACCOUNT
    };

    if (!legible.legible) {
      intentos.push({
        ...comun,
        estado: ESTADOS_CROSSLINK.NO_EJECUTADA,
        motivo: legible.motivo,
        enlacesEncontrados: 0,
        cuentasEnlazadas: 0
      });

      continue;
    }

    /*
      ANTICIRCULARIDAD. Una cuenta sin corroborar no puede
      corroborar a otra: se declara y no se pide la pagina.
    */
    const fuerza = FUERZA_DIRECCION[comun.direccion] || {};

    if (fuerza.exigeOrigenCorroborado && fuente.origenCorroborado !== true) {
      intentos.push({
        ...comun,
        estado: ESTADOS_CROSSLINK.NO_EJECUTADA,
        motivo:
          "el origen no esta corroborado: una cuenta sin corroborar no puede corroborar a otra, seria circular",
        enlacesEncontrados: 0,
        cuentasEnlazadas: 0
      });

      continue;
    }

    if (!ejecutar) {
      intentos.push({
        ...comun,
        estado: ESTADOS_CROSSLINK.NO_EJECUTADA,
        motivo: "no se ha ejecutado ninguna observacion de enlaces todavia",
        enlacesEncontrados: 0,
        cuentasEnlazadas: 0
      });

      continue;
    }

    if (paginas >= TOPE_PAGINAS) {
      intentos.push({
        ...comun,
        estado: ESTADOS_CROSSLINK.NO_EJECUTADA,
        motivo: `tope de ${TOPE_PAGINAS} paginas por ejecucion: esta fuente no se leyo`,
        enlacesEncontrados: 0,
        cuentasEnlazadas: 0
      });

      continue;
    }

    paginas += 1;

    const pagina = await pedirPagina(fuente.url, fetchImpl);

    if (!pagina.ok) {
      intentos.push({
        ...comun,
        estado: pagina.estado,
        httpStatus: pagina.httpStatus,
        motivo: pagina.motivo,
        enlacesEncontrados: 0,
        cuentasEnlazadas: 0
      });

      continue;
    }

    const enlaces = extraerEnlacesSalientes(pagina.html, fuente.url);

    const { cuentas: todas, descartados } = cuentasEnlazadas(enlaces);

    /*
      ---------------------------------------------------------
      ENLACES DEL MISMO DOMINIO: NAVEGACION, NO CROSS-LINK
      ---------------------------------------------------------

      Medido al escribir la prueba: leyendo una pagina de
      Facebook, el enlace relativo `/contacto` se resuelve a
      `facebook.com/contacto` y SD-1A lo reconoce —con razon—
      como una cuenta de Facebook con handle «contacto».

      Aceptarlo fabricaria una cuenta corroborada por cada
      elemento del menu: /contacto, /privacy, /help. Y como
      llegarian con senal independiente, ascenderian solas.

      Un enlace del mismo dominio que la pagina de origen no se
      puede distinguir de la navegacion del sitio, asi que no
      cuenta. Se descarta y SE DECLARA: un recorte silencioso
      aqui se leeria como «la pagina no enlazaba nada».
      ---------------------------------------------------------
    */
    const dominioOrigen = dominioDe(fuente.url);

    const mismoDominio = todas.filter(
      (c) => dominioOrigen && dominioDe(c.urlCanonica) === dominioOrigen
    );

    const cuentas = todas.filter(
      (c) => !dominioOrigen || dominioDe(c.urlCanonica) !== dominioOrigen
    );

    intentos.push({
      ...comun,
      estado: cuentas.length
        ? ESTADOS_CROSSLINK.OBSERVADA
        : ESTADOS_CROSSLINK.SIN_ENLACES,
      httpStatus: pagina.httpStatus,
      motivo: cuentas.length
        ? null
        : "la pagina se leyo y no enlaza ninguna cuenta social identificable de otro dominio",
      enlacesEncontrados: enlaces.length,
      cuentasEnlazadas: cuentas.length,

      descartadosPorMismoDominio: mismoDominio.length,
      notaMismoDominio: mismoDominio.length
        ? `${mismoDominio.length} enlace(s) al mismo dominio (${dominioOrigen}) descartados: no se distinguen de la navegacion del propio sitio y aceptarlos fabricaria corroboracion.`
        : null,

      descartados: descartados.slice(0, 10)
    });

    const ahora = new Date().toISOString();

    cuentas.forEach((c) => {
      const accountId = `${c.plataformaId}:${String(c.handle).toLowerCase()}`;

      /*
        Enlazar una cuenta que ya conocemos y enlazar una nueva
        son cosas distintas, y las dos importan: la primera
        corrobora, la segunda descubre.
      */
      const conocida = (cuentasConocidas || []).some(
        (x) => (x.id || x.accountId) === accountId
      );

      senales.push(
        crearSenalCrossLink({
          candidateId,
          projectId,
          accountId,
          direccion: comun.direccion,
          sourceUrl: fuente.url,
          targetUrl: c.urlCanonica,
          platformId: c.plataformaId,
          handle: c.handle,
          observedAt: ahora,

          /*
            El evidenceId es la propia relacion observada en esa
            pagina. Si mas adelante el corpus normaliza la pagina
            como evidencia, este id se sustituye por el suyo.
          */
          evidenceId: `xlev-${clave(fuente.url)}->${accountId}`,

          observationMethod: "enlace_saliente_html",
          sourceType: fuente.sourceType || fuente.plataformaId || null,

          cadenaDeConfianza: [
            fuente.declaradaPorAnalista
              ? "el analista declaro la pagina de origen"
              : "la pagina de origen se descubrio por observacion",
            "la pagina publica el enlace",
            conocida
              ? "la cuenta enlazada ya estaba en el expediente"
              : "la cuenta enlazada no estaba en el expediente"
          ],

          fuenteDeclaradaPorAnalista: fuente.declaradaPorAnalista === true
        })
      );
    });
  }

  return {
    candidateId,
    projectId,

    senales,

    intentos,

    paginasLeidas: paginas,
    topePaginas: TOPE_PAGINAS,
    ejecutado: ejecutar === true,

    regla:
      "Un enlace cruzado vale porque alguien distinto de Sentinel publico la asociacion, no porque el nombre se parezca. Una cuenta sin corroborar no puede corroborar a otra.",

    prohibido: [
      "corroborar por nombre parecido",
      "corroborar por handle parecido",
      "corroborar porque el analista declarara la cuenta",
      "leer paginas que exigen autenticacion",
      "seguir enlaces mas alla de la pagina pedida"
    ]
  };
}


/*
===========================================================
PUENTE HACIA ACCOUNT RESOLUTION

`resolverCuentasDelCandidato` espera `enlacesCruzados` con la
forma `{ desde, hacia }`. Aqui se traduce, sin tocar el
resolvedor: era el hueco declarado de V1 y se cierra por donde
estaba previsto.
===========================================================
*/
export function enlacesParaResolucion(senales = []) {
  return (senales || [])
    .filter((s) => s.independiente && !s.descartada)
    .map((s) => ({
      /*
        `desde: "web"` produce WEB_DECLARADA en el resolvedor;
        cualquier otro valor produce ENLACE_CRUZADO. Es la
        traduccion exacta de las tres direcciones a las senales
        que el resolvedor ya conoce.
      */
      desde:
        s.direccion === DIRECCIONES.WEB_TO_ACCOUNT
          ? "web"
          : s.direccion === DIRECCIONES.EXTERNAL_REFERENCE_TO_ACCOUNT
            ? "referencia_externa"
            : s.sourceUrl || "cuenta",

      hacia: s.accountId,

      relationId: s.relationId,
      evidenceIds: s.evidenceIds || [],
      firstObservedAt: s.firstObservedAt || null,
      lastObservedAt: s.lastObservedAt || null,
      observationCount: s.observationCount || 1
    }));
}


export default {
  DIRECCIONES,
  FUERZA_DIRECCION,
  ESTADOS_CROSSLINK,
  extraerEnlacesSalientes,
  cuentasEnlazadas,
  crearSenalCrossLink,
  fusionarSenales,
  fuenteLegible,
  observarEnlacesSalientes,
  enlacesParaResolucion
};
