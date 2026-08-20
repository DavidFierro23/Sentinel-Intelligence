// apps/backend/services/providers/serpapiProvider.js

import { ESTADOS } from "./providerHealth.js";

import {
  limpiarHtml,
  extraerDominio,
  detectarPlataformaPorUrl
} from "../textUtils.js";

/*
===========================================================
SERPAPI — proveedor web PRINCIPAL
===========================================================

Resultados de Google a través de la API oficial de SerpAPI.

POR QUÉ PASA A SER EL PRINCIPAL
-----------------------------------------------------------

El descubrimiento web ha sido el cuello de botella dominante
del proyecto durante cinco sprints:

  · Brave       sin credencial
  · Bing        sin implementar
  · DuckDuckGo  responde a 1-2 consultas y luego devuelve
                HTTP 200 con una página sin `result__a`

Consecuencia medida: las evidencias eran URLs opacas de
news.google.com sin una sola URL de plataforma, y «Cuentas
candidatas» solo se llenaba por declaración en Wikidata.

Comprobado con la credencial real antes de escribir este
módulo, consulta «Daniel Noboa twitter»:

  x.com/DanielNoboaOk
  instagram.com/danielnoboaok
  facebook.com/DanielNoboaOk
  x.com/Presidencia_Ec/status/1744469882001883224   <- publicación

URLs de plataforma reales, incluida una publicación que el
clasificador debe rechazar como cuenta. Es exactamente el
material que el Discovery Engine esperaba desde SD-1A.

DuckDuckGo NO se elimina: baja a último recurso y sigue
cubriendo el caso de que SerpAPI falle o agote su cuota.

PRESUPUESTO FINITO — RESTRICCIÓN OPERATIVA REAL
-----------------------------------------------------------

El plan es gratuito: 250 búsquedas al mes. No es un límite de
tasa que se recupera esperando; es un saldo que se consume y
solo se renueva al cerrar el ciclo.

De ahí dos decisiones deliberadas:

  1. Presupuesto de 4 consultas por investigación, no 8. Con 8
     el saldo daría para ~31 investigaciones al mes; con 4, ~62.
  2. El saldo restante se consulta y se DECLARA. Un analista
     que no sabe cuántas búsquedas le quedan no puede decidir
     si gastarlas.

Agotar la cuota es BLOQUEADO, nunca ERROR: el proveedor
funciona, lo que falta es saldo. La distinción importa porque
`ausencia` y `no_comprobada` dependen de ella en toda la capa
social.

NUNCA SE REGISTRA LA CLAVE
-----------------------------------------------------------

La credencial viaja como parámetro de consulta, así que la URL
completa es material sensible. Este módulo no la escribe en
ningún log, detalle de error ni respuesta: los mensajes se
construyen a mano y `depurarMensaje()` borra cualquier
`api_key=` que pudiera colarse desde un texto de error remoto.
===========================================================
*/

export const ID = "serpapi_google";
export const NOMBRE = "SerpAPI (Google)";
export const TIPO = "web";
export const PRIORIDAD = 1;

const ENDPOINT = "https://serpapi.com/search.json";

const ENDPOINT_CUENTA = "https://serpapi.com/account.json";

const LIMITE_RESULTADOS = 10;

const TIEMPO_MAXIMO_MS = 15000;


/*
-----------------------------------------------------------
LECTURA DE LA CREDENCIAL

Perezosa, en cada llamada. En server.js los `import` se
evalúan antes que `dotenv.config()`: leerla al importar la
dejaría siempre en undefined aunque estuviese bien puesta.
Es el mismo motivo documentado en braveProvider.

Se aceptan DOS nombres. El sprint especifica `SERPAPI_KEY`,
pero el .env real del proyecto la tiene como
`SERPAPI_API_KEY`. Aceptar ambos evita que el proveedor
quede inerte por una diferencia de nombre.
-----------------------------------------------------------
*/

const NOMBRES_VARIABLE = ["SERPAPI_KEY", "SERPAPI_API_KEY"];

const MARCADORES = [
  "tu_clave",
  "your_key",
  "your-api-key",
  "cambiar",
  "changeme",
  "xxx",
  "pendiente"
];

export function obtenerClave() {
  for (const nombre of NOMBRES_VARIABLE) {
    const bruta = process.env[nombre];

    if (typeof bruta !== "string") continue;

    const limpia = bruta.trim();

    if (!limpia) continue;

    if (MARCADORES.some((m) => limpia.toLowerCase().includes(m))) continue;

    return { clave: limpia, variable: nombre };
  }

  return null;
}


export function estaConfigurado() {
  return obtenerClave() !== null;
}


/*
-----------------------------------------------------------
DEPURAR MENSAJES

Último cortafuegos: si un texto de error remoto trajera la
credencial, aquí se borra antes de que llegue a un log, a una
respuesta HTTP o al panel.
-----------------------------------------------------------
*/

export function depurarMensaje(texto) {
  return String(texto ?? "").replace(
    /api_key=[^&\s"']+/gi,
    "api_key=<oculta>"
  );
}


/*
-----------------------------------------------------------
SALDO DE BÚSQUEDAS

account.json NO consume búsquedas (comprobado: tras una
búsqueda real el contador marcaba 1, no 2). Aun así se
memoriza unos minutos para no encadenar peticiones inútiles.
-----------------------------------------------------------
*/

const CACHE_SALDO_MS = 5 * 60 * 1000;

let saldoCache = null;

export async function consultarSaldo(forzar = false) {
  const credencial = obtenerClave();

  if (!credencial) return null;

  if (
    !forzar &&
    saldoCache &&
    Date.now() - saldoCache.consultadoEn < CACHE_SALDO_MS
  ) {
    return saldoCache.datos;
  }

  const control = new AbortController();

  const temporizador = setTimeout(() => control.abort(), 8000);

  try {
    const url = new URL(ENDPOINT_CUENTA);

    url.searchParams.set("api_key", credencial.clave);

    const r = await fetch(url, { signal: control.signal });

    if (!r.ok) return null;

    const j = await r.json();

    const datos = {
      plan: j?.plan_name || null,
      restantes:
        typeof j?.total_searches_left === "number"
          ? j.total_searches_left
          : null,
      porMes:
        typeof j?.searches_per_month === "number" ? j.searches_per_month : null,
      usadasEsteMes:
        typeof j?.this_month_usage === "number" ? j.this_month_usage : null,
      renuevaEn: j?.plan_renewal_date || null
    };

    saldoCache = { datos, consultadoEn: Date.now() };

    return datos;
  } catch {
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}


/*
  Última lectura conocida, sin pedir nada por red. La usa el
  diagnóstico síncrono.
*/
export function saldoConocido() {
  return saldoCache?.datos || null;
}


/*
-----------------------------------------------------------
DIAGNÓSTICO
-----------------------------------------------------------
*/

export function diagnostico() {
  const credencial = obtenerClave();

  if (!credencial) {
    return {
      configurado: false,
      estado: ESTADOS.SIN_CONFIGURAR,
      detalle:
        "Falta SERPAPI_KEY (o SERPAPI_API_KEY) en apps/backend/.env. Añádela y reinicia el backend para activar SerpAPI como proveedor principal."
    };
  }

  const saldo = saldoConocido();

  /*
    Saldo agotado: el proveedor está bien configurado, pero no
    puede usarse hasta la renovación. Es Bloqueado.
  */
  if (saldo && saldo.restantes === 0) {
    return {
      configurado: true,
      estado: ESTADOS.BLOQUEADO,
      detalle: `Cuota de SerpAPI agotada (0 de ${saldo.porMes} búsquedas). Renueva el ${saldo.renuevaEn}. Hasta entonces el descubrimiento web recae en DuckDuckGo.`,
      saldo
    };
  }

  return {
    configurado: true,
    estado: ESTADOS.OK,
    detalle: saldo
      ? `${credencial.variable} presente. Plan ${saldo.plan}: ${saldo.restantes} de ${saldo.porMes} búsquedas disponibles (renueva el ${saldo.renuevaEn}).`
      : `${credencial.variable} presente. Proveedor listo.`,
    saldo
  };
}


/*
-----------------------------------------------------------
CLASIFICAR EL TIPO DE RESULTADO

El sprint pide `tipo` en cada resultado. Se deriva del
DOMINIO, nunca del texto: es la misma corrección que se aplicó
a construirEntidades() en el Sprint 2.5, cuando clasificar por
texto atribuía hallazgos a la plataforma equivocada.

`social` aquí significa «la URL pertenece a un dominio de
plataforma», NO «es una cuenta». Distinguir cuenta de
publicación o de vídeo es competencia del clasificador social
(SD-1A), que ya lo hace y no se duplica aquí.
-----------------------------------------------------------
*/

const DOMINIOS_ENCICLOPEDICOS = ["wikipedia.org", "wikidata.org", "wikimedia.org"];

const DOMINIOS_AGREGADORES = ["news.google.com", "google.com", "webcache.googleusercontent.com"];

export function clasificarTipo(url) {
  const dominio = extraerDominio(url) || "";

  const plataforma = detectarPlataformaPorUrl(url);

  if (plataforma) {
    return {
      tipo: plataforma.tipo === "video" ? "video" : "social",
      plataformaId: plataforma.id,
      plataforma: plataforma.nombre,
      motivo: `el dominio ${dominio} pertenece a ${plataforma.nombre}`
    };
  }

  if (DOMINIOS_ENCICLOPEDICOS.some((d) => dominio.endsWith(d))) {
    return {
      tipo: "enciclopedico",
      plataformaId: null,
      plataforma: null,
      motivo: `${dominio} es una fuente enciclopédica, no una cuenta`
    };
  }

  if (DOMINIOS_AGREGADORES.some((d) => dominio.endsWith(d))) {
    return {
      tipo: "agregador",
      plataformaId: null,
      plataforma: null,
      motivo: `${dominio} es un agregador: la URL no identifica al publicador`
    };
  }

  if (dominio.endsWith(".gob.ec") || dominio.endsWith(".gov")) {
    return {
      tipo: "institucional",
      plataformaId: null,
      plataforma: null,
      motivo: `${dominio} es un dominio institucional`
    };
  }

  return {
    tipo: "web",
    plataformaId: null,
    plataforma: null,
    motivo: `${dominio} sin clasificación específica`
  };
}


/*
-----------------------------------------------------------
NORMALIZAR LA RESPUESTA DE SERPAPI

Estructura de la API:

  { organic_results: [ { position, title, link, snippet,
                         date, displayed_link, source } ],
    search_metadata: { status },
    error: "..." }

Se mapea al esquema común de Sentinel. Nunca se fabrica una
descripción: si Google no trae snippet, queda vacío y
`snippetDisponible` lo declara.

Tampoco se deduce ningún handle aquí. Solo se transporta la
URL tal como Google la devolvió; extraer el handle es
competencia del clasificador social, que respeta las rutas que
no son de perfil.
-----------------------------------------------------------
*/

export function normalizarRespuesta(datos, consulta, etiqueta) {
  const crudos = Array.isArray(datos?.organic_results)
    ? datos.organic_results
    : [];

  return crudos.slice(0, LIMITE_RESULTADOS).map((r) => {
    const enlace = String(r?.link || "").trim();

    const descripcion = limpiarHtml(r?.snippet || "");

    const clasificacion = clasificarTipo(enlace);

    return {
      titulo: limpiarHtml(r?.title || ""),
      enlace,

      descripcion,
      snippetDisponible: Boolean(descripcion),

      /*
        Solo si Google la trae. No se infiere de ningún texto.
      */
      fecha: r?.date || null,

      dominio: extraerDominio(enlace),

      tipo: clasificacion.tipo,
      plataformaId: clasificacion.plataformaId,
      plataformaDetectada: clasificacion.plataforma,
      motivoTipo: clasificacion.motivo,

      posicion: typeof r?.position === "number" ? r.position : null,

      motor: NOMBRE,
      motorId: ID,

      consulta,
      etiquetaConsulta: etiqueta || null
    };
  });
}


/*
-----------------------------------------------------------
BÚSQUEDA
-----------------------------------------------------------
*/

export async function buscar(consulta, opciones = {}) {
  const texto = String(consulta ?? "").trim();

  const inicio = Date.now();

  const base = {
    proveedorId: ID,
    proveedor: NOMBRE,
    consulta: texto,
    resultados: [],
    total: 0
  };

  const transcurrido = () =>
    `${((Date.now() - inicio) / 1000).toFixed(2)}s`;

  if (!texto) {
    return {
      ...base,
      estado: ESTADOS.ERROR,
      detalle: "Consulta vacía.",
      tiempo: "0s"
    };
  }

  const credencial = obtenerClave();

  if (!credencial) {
    return {
      ...base,
      estado: ESTADOS.SIN_CONFIGURAR,
      detalle: diagnostico().detalle,
      tiempo: "0s"
    };
  }

  /*
    GUARDA DE SALDO

    Se consulta el saldo antes de gastar la primera busqueda de
    la sesion. account.json no consume creditos, asi que la
    guarda es gratuita; sin ella no se puede distinguir "sin
    resultados" de "sin saldo", y esa distincion sostiene toda
    la separacion entre `ausencia` y `no_comprobada` en la capa
    social.
  */
  if (!saldoConocido()) await consultarSaldo();

  const saldoPrevio = saldoConocido();

  if (saldoPrevio && saldoPrevio.restantes === 0) {
    return {
      ...base,
      estado: ESTADOS.BLOQUEADO,
      detalle: `Cuota de SerpAPI agotada. Renueva el ${saldoPrevio.renuevaEn}. No se consultó.`,
      tiempo: "0s"
    };
  }

  const url = new URL(ENDPOINT);

  url.searchParams.set("engine", "google");
  url.searchParams.set("q", texto);
  url.searchParams.set("num", String(opciones.limite || LIMITE_RESULTADOS));

  /*
    País e idioma del mercado inicial declarado del proyecto.
  */
  if (opciones.pais !== null) {
    url.searchParams.set("gl", opciones.pais || "ec");
  }

  if (opciones.idioma !== null) {
    url.searchParams.set("hl", opciones.idioma || "es");
  }

  url.searchParams.set("api_key", credencial.clave);

  const control = new AbortController();

  const temporizador = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

  try {
    const respuesta = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: control.signal
    });

    /*
      401 = credencial inválida. SIN_CONFIGURAR: la clave
      existe pero no sirve, y reintentar no ayuda.
    */
    if (respuesta.status === 401) {
      return {
        ...base,
        estado: ESTADOS.SIN_CONFIGURAR,
        detalle: `SerpAPI rechazó la credencial (HTTP 401). Revisa ${credencial.variable} en .env.`,
        tiempo: transcurrido()
      };
    }

    /*
      429 = límite por hora del plan. Es BLOQUEADO: el
      proveedor funciona, solo hay que esperar.
    */
    if (respuesta.status === 429) {
      return {
        ...base,
        estado: ESTADOS.BLOQUEADO,
        detalle:
          "SerpAPI devolvió 429: límite de peticiones por hora alcanzado. No se puede afirmar ausencia de resultados.",
        tiempo: transcurrido()
      };
    }

    if (!respuesta.ok) {
      return {
        ...base,
        estado: ESTADOS.ERROR,
        detalle: `SerpAPI respondió HTTP ${respuesta.status}.`,
        tiempo: transcurrido()
      };
    }

    const datos = await respuesta.json();

    /*
      SerpAPI puede devolver 200 con un error en el cuerpo —
      típicamente cuota agotada o parámetros inválidos.
      El mensaje se depura antes de propagarlo.
    */
    if (datos?.error) {
      const mensaje = depurarMensaje(datos.error);

      const esCuota = /run out|exceed|quota|limit/i.test(mensaje);

      if (esCuota) saldoCache = { datos: { ...(saldoPrevio || {}), restantes: 0 }, consultadoEn: Date.now() };

      return {
        ...base,
        estado: esCuota ? ESTADOS.BLOQUEADO : ESTADOS.ERROR,
        detalle: `SerpAPI: ${mensaje}`,
        tiempo: transcurrido()
      };
    }

    const resultados = normalizarRespuesta(datos, texto, opciones.etiqueta);

    /*
      Cada búsqueda con éxito consume un crédito. Se descuenta
      del saldo memorizado para que el informe siga siendo
      veraz sin pedirlo de nuevo por red.
    */
    if (saldoCache?.datos && typeof saldoCache.datos.restantes === "number") {
      saldoCache.datos.restantes = Math.max(
        0,
        saldoCache.datos.restantes - 1
      );
    }

    const sociales = resultados.filter((r) => r.tipo === "social" || r.tipo === "video");

    return {
      ...base,
      estado: ESTADOS.OK,
      detalle:
        `${resultados.length} resultados` +
        (sociales.length
          ? `, ${sociales.length} en dominios de plataforma.`
          : ", ninguno en dominios de plataforma."),
      resultados,
      total: resultados.length,
      tiempo: transcurrido()
    };
  } catch (error) {
    const abortado = error?.name === "AbortError";

    return {
      ...base,
      estado: ESTADOS.ERROR,
      detalle: abortado
        ? `SerpAPI no respondió en ${TIEMPO_MAXIMO_MS / 1000}s.`
        : `Fallo de red con SerpAPI: ${depurarMensaje(
            error?.message || "desconocido"
          )}.`,
      tiempo: transcurrido()
    };
  } finally {
    clearTimeout(temporizador);
  }
}


export default {
  id: ID,
  nombre: NOMBRE,
  tipo: TIPO,
  prioridad: PRIORIDAD,
  buscar,
  estaConfigurado,
  diagnostico,

  /*
    Presupuesto por investigación.

    Deliberadamente 4 y no 8: el plan gratuito da 250 búsquedas
    AL MES, un saldo que no se recupera esperando. Con 4 el
    saldo cubre ~62 investigaciones; con 8, la mitad.

    Intervalo corto: es una API, no un raspado.
  */
  presupuesto: 4,
  intervaloMs: 250,

  /* Extras propios, para el informe de proveedores. */
  consultarSaldo,
  saldoConocido
};
