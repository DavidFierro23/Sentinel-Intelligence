// apps/backend/services/ingest/adapters/socialProviderClient.js

/*
===========================================================
CLIENTE HTTP DE PROVEEDOR SOCIAL — LA PIEZA QUE FALTABA
SOCIAL-PROVIDER-ALTERNATIVE-01
===========================================================

SOCIAL-PROVIDER-REAL-01-PREP dejo el limite entero construido y
probado: contrato de comentario, normalizador, matriz de
capacidades y procedencia. Faltaba UNA cosa, y es esta: hablar
HTTP con el proveedor.

Con este modulo, ejecutar la prueba real deja de depender de
escribir codigo y pasa a depender solo de que exista una clave.

POR QUE ES GENERICO
-----------------------------------------------------------

Bright Data quedo bloqueado por su propio proveedor y eso obligo
a buscar alternativas. Un cliente escrito para Bright Data
habria que tirarlo hoy.

Este no sabe de ningun proveedor: lee la base, la cabecera de
autenticacion y los endpoints del REGISTRO. Cambiar de proveedor
es cambiar una entrada de datos, no este archivo.

LO QUE NO HACE, A PROPOSITO
-----------------------------------------------------------

No rota proxies, no resuelve captchas, no falsifica huellas de
navegador y no automatiza logins. Si un proveedor necesitara eso
de nuestra parte, el proveedor no sirve.

Y no normaliza: eso ya lo hace `externalSocialProvider`. Aqui se
devuelve el payload crudo y se acaba.

LA CLAVE NO SALE DE AQUI
-----------------------------------------------------------

Viaja en una cabecera, nunca en la URL, y no aparece en el
resultado, ni en la traza, ni en el mensaje de error. Hay test.
===========================================================
*/

import {
  proveedor,
  proveedorHabilitado
} from "../../intelligence/externalSocialProvider.js";


export const ESTADOS_CLIENTE = Object.freeze({
  OK: "OK",

  /* La bandera esta apagada, o el proveedor no esta aprobado. */
  DESHABILITADO: "PROVEEDOR_DESHABILITADO",

  /* No hay clave en el entorno. */
  SIN_CREDENCIAL: "SIN_CREDENCIAL",

  /* El proveedor no declara ese endpoint para esa plataforma. */
  ENDPOINT_NO_DECLARADO: "ENDPOINT_NO_DECLARADO",

  /* 401/403: la clave no vale o no alcanza. */
  CREDENCIAL_RECHAZADA: "CREDENCIAL_RECHAZADA",

  /* 402: hace falta pagar. Distinto de que la clave este mal. */
  BILLING_BLOQUEADO: "BILLING_BLOQUEADO",

  /* 429: demasiadas peticiones. */
  CUOTA_AGOTADA: "CUOTA_AGOTADA",

  ERROR_PROVEEDOR: "ERROR_PROVEEDOR"
});


const TIEMPO_MAXIMO_MS = 30000;


function conTiempoLimite(promesa, ms, etiqueta) {
  return Promise.race([
    promesa,
    new Promise((_, rechazar) =>
      setTimeout(
        () => rechazar(new Error(`${etiqueta}: tiempo agotado tras ${ms} ms`)),
        ms
      )
    )
  ]);
}


/*
  Redacta cualquier rastro de la clave antes de que un texto
  salga de este modulo. El mensaje de error de un proveedor es
  justo lo que alguien copia y pega en un chat.
*/
export function sanitizar(texto, clave) {
  let limpio = String(texto || "");

  if (clave) limpio = limpio.split(clave).join("REDACTADO");

  return limpio
    .replace(/(api[_-]?key=)[^&\s"']+/gi, "$1REDACTADO")
    .replace(/(x-api-key["'\s:]+)[^\s"',}]+/gi, "$1REDACTADO")
    .replace(/(Bearer\s+)[^\s"']+/gi, "$1REDACTADO");
}


/*
===========================================================
LAS DOS PIEZAS PURAS
===========================================================

Se extraen a proposito. La guarda de `pedirAlProveedor` exige
que el proveedor este APROBADO, y hoy no lo esta ninguno: eso
significa que armar la peticion y clasificar la respuesta no se
podrian probar sin aprobar a alguien de verdad o sin abrir un
agujero en la guarda.

Separadas, se prueban solas y la guarda se queda intacta.
===========================================================
*/

/*
  Arma la URL y las cabeceras de una peticion. No sale a la red y
  no decide si se puede llamar: eso es de la guarda.

  Devuelve `null` si el proveedor no declara ese endpoint, que es
  lo que impide inventar una URL.
*/
export function armarPeticion({ p, platformId, operacion, params = {}, clave }) {
  const ruta = p?.endpoints?.[platformId]?.[operacion] || null;

  if (!ruta) return null;

  const url = new URL(ruta, p.base);

  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  return {
    ruta,
    url: url.toString(),

    /* La clave va en cabecera. Nunca en la URL. */
    cabeceras: {
      Accept: "application/json",
      [p.cabeceraDeClave || "x-api-key"]: clave
    }
  };
}


/*
  Cuatro bloqueos que se parecen en pantalla y no se arreglan
  igual. Misma leccion que X-REAL-01: leer un 402 como problema
  de credencial manda a revisar el token cuando falta pagar.
*/
export function clasificarRespuestaHttp(status) {
  if (status === 401 || status === 403) {
    return ESTADOS_CLIENTE.CREDENCIAL_RECHAZADA;
  }

  if (status === 402) return ESTADOS_CLIENTE.BILLING_BLOQUEADO;

  if (status === 429) return ESTADOS_CLIENTE.CUOTA_AGOTADA;

  return ESTADOS_CLIENTE.ERROR_PROVEEDOR;
}


/*
===========================================================
PEDIR UN ENDPOINT DECLARADO
===========================================================

    providerId    quien
    platformId    facebook | tiktok | instagram
    operacion     perfil | publicaciones | comentarios | ...
    params        lo que pida ese endpoint

La operacion se resuelve contra los endpoints del REGISTRO. Si
el proveedor no declara ese endpoint, no se inventa una URL: se
devuelve ENDPOINT_NO_DECLARADO y no se gasta credito.
===========================================================
*/
export async function pedirAlProveedor(entrada = {}) {
  const {
    providerId = null,
    platformId = null,
    operacion = null,
    params = {},
    entorno = process.env,
    fetchImpl = undefined
  } = entrada;

  const p = proveedor(providerId);

  const base = {
    providerId,
    platformId,
    operacion,
    llamadas: 0,
    observadoEn: new Date().toISOString()
  };

  /*
    La guarda va PRIMERA. Un cliente que sale a la red y luego
    comprueba si podia hacerlo ya gasto el credito.
  */
  const permiso = proveedorHabilitado(providerId, entorno);

  if (!permiso.habilitado) {
    return {
      ...base,
      estado: p ? ESTADOS_CLIENTE.DESHABILITADO : ESTADOS_CLIENTE.ERROR_PROVEEDOR,
      motivo: permiso.motivo
    };
  }

  const clave = entorno[p.variableDeEntorno];

  if (!clave) {
    return {
      ...base,
      estado: ESTADOS_CLIENTE.SIN_CREDENCIAL,
      motivo: `falta ${p.variableDeEntorno} en el entorno`
    };
  }

  const peticion = armarPeticion({ p, platformId, operacion, params, clave });

  if (!peticion) {
    return {
      ...base,
      estado: ESTADOS_CLIENTE.ENDPOINT_NO_DECLARADO,

      motivo: `${p.nombre} no declara el endpoint "${operacion}" para ${platformId}. No se inventa una URL: la llamada no se hace.`
    };
  }

  const { ruta, url, cabeceras } = peticion;

  const fetcher = fetchImpl || globalThis.fetch;

  let respuesta;

  try {
    respuesta = await conTiempoLimite(
      fetcher(url, { headers: cabeceras }),
      TIEMPO_MAXIMO_MS,
      `${p.nombre} ${operacion}`
    );
  } catch (e) {
    return {
      ...base,
      llamadas: 1,
      estado: ESTADOS_CLIENTE.ERROR_PROVEEDOR,
      motivo: sanitizar(e?.message || "la llamada no se completo", clave)
    };
  }

  const texto = await respuesta.text();

  let datos = null;

  try {
    datos = JSON.parse(texto);
  } catch {
    datos = null;
  }

  if (!respuesta.ok) {
    const estado = clasificarRespuestaHttp(respuesta.status);

    return {
      ...base,
      llamadas: 1,
      estado,
      httpStatus: respuesta.status,

      /* La URL sin la clave: la clave nunca estuvo en la URL. */
      endpoint: `${p.base}${ruta}`,

      motivo: sanitizar(texto.slice(0, 300), clave)
    };
  }

  return {
    ...base,
    llamadas: 1,
    estado: ESTADOS_CLIENTE.OK,
    httpStatus: respuesta.status,
    endpoint: `${p.base}${ruta}`,

    /* Crudo. Normalizar es trabajo de externalSocialProvider. */
    datos,

    /*
      Referencia para la procedencia sin guardar el payload
      entero ni un solo caracter de la clave.
    */
    rawReference: `${providerId}:${platformId}:${operacion}:${base.observadoEn}`
  };
}


export function diagnostico(entorno = process.env) {
  const banderaActiva =
    String(entorno.SOCIAL_EXTERNAL_PROVIDER_ENABLED || "").toLowerCase() ===
    "true";

  return {
    banderaActiva,

    nota: banderaActiva
      ? "La bandera esta encendida. Cada proveedor sigue necesitando estar aprobado en el registro y tener su clave."
      : "SOCIAL_EXTERNAL_PROVIDER_ENABLED apagada: ningun proveedor externo sale a la red.",

    loQueNoHace: [
      "rotacion de proxies",
      "resolucion de captchas",
      "falsificacion de huella de navegador",
      "automatizacion de login"
    ]
  };
}


export default {
  ESTADOS_CLIENTE,
  armarPeticion,
  clasificarRespuestaHttp,
  pedirAlProveedor,
  sanitizar,
  diagnostico
};
