// apps/backend/services/providers/braveProvider.js

import { ESTADOS } from "./providerHealth.js";
import { limpiarHtml, desenvolverRedireccion } from "../textUtils.js";

/*
===========================================================
BRAVE SEARCH — proveedor web PRINCIPAL
===========================================================

Estado actual: ESTRUCTURA COMPLETA, PENDIENTE DE CREDENCIAL.

Este proveedor está enteramente implementado contra la API
oficial de Brave Search. Lo único que falta para activarlo es
definir BRAVE_API_KEY en el archivo .env del backend.

NO se inventa ninguna clave. Sin credencial, el proveedor
declara el estado "Sin configurar" y la Search Provider Layer
pasa automáticamente al siguiente proveedor.

Por qué Brave como principal:
- API oficial: no es raspado, no rompe con cambios de HTML.
- Sin la limitación de tasa que hace inviable a DuckDuckGo
  para consultas múltiples (el cuello de botella medido en
  el Sprint 2).
- Devuelve descripciones reales y fechas.
===========================================================
*/

export const ID = "brave_web";
export const NOMBRE = "Brave Search";
export const TIPO = "web";
export const PRIORIDAD = 1;

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

const LIMITE_RESULTADOS = 10;

const TIEMPO_MAXIMO_MS = 12000;


/*
-----------------------------------------------------------
LECTURA DE LA CREDENCIAL

Se lee de forma PEREZOSA, en cada llamada, no al importar el
módulo.

Motivo: en server.js los `import` se evalúan antes que
`dotenv.config()`. Si la clave se leyera al importar, siempre
sería undefined aunque estuviese bien puesta en .env.
-----------------------------------------------------------
*/

export function obtenerClave() {
  const clave = process.env.BRAVE_API_KEY;

  if (typeof clave !== "string") return null;

  const limpia = clave.trim();

  if (!limpia) return null;

  /*
    Se rechazan los valores de ejemplo para que un .env a
    medio rellenar no parezca configurado.
  */
  const marcadores = [
    "tu_clave",
    "your_key",
    "your-api-key",
    "cambiar",
    "changeme",
    "xxx",
    "pendiente"
  ];

  if (marcadores.some((m) => limpia.toLowerCase().includes(m))) return null;

  return limpia;
}


export function estaConfigurado() {
  return obtenerClave() !== null;
}


/*
-----------------------------------------------------------
DIAGNÓSTICO — para el informe de proveedores
-----------------------------------------------------------
*/

export function diagnostico() {
  if (estaConfigurado()) {
    return {
      configurado: true,
      estado: ESTADOS.OK,
      detalle: "BRAVE_API_KEY presente. Proveedor listo."
    };
  }

  return {
    configurado: false,
    estado: ESTADOS.SIN_CONFIGURAR,
    detalle:
      "Falta BRAVE_API_KEY en apps/backend/.env. Añádela y reinicia el backend para activar Brave como proveedor principal."
  };
}


/*
-----------------------------------------------------------
NORMALIZAR LA RESPUESTA DE BRAVE

Estructura documentada de la API:

  { web: { results: [ { title, url, description, age,
                        page_age, ... } ] } }

Se mapea al esquema común de Sentinel. Nunca se fabrica una
descripción: si Brave no la trae, queda vacía.
-----------------------------------------------------------
*/

export function normalizarRespuesta(datos, consulta, etiqueta) {
  const crudos = Array.isArray(datos?.web?.results) ? datos.web.results : [];

  return crudos.slice(0, LIMITE_RESULTADOS).map((r) => {
    const descripcion = limpiarHtml(r?.description || "");

    return {
      titulo: limpiarHtml(r?.title || ""),
      enlace: desenvolverRedireccion(r?.url || ""),

      descripcion,
      snippetDisponible: Boolean(descripcion),

      fecha: r?.page_age || r?.age || null,

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

  if (!texto) {
    return {
      ...base,
      estado: ESTADOS.ERROR,
      detalle: "Consulta vacía.",
      tiempo: "0s"
    };
  }

  const clave = obtenerClave();

  if (!clave) {
    return {
      ...base,
      estado: ESTADOS.SIN_CONFIGURAR,
      detalle: diagnostico().detalle,
      tiempo: "0s"
    };
  }

  const parametros = new URLSearchParams({
    q: texto,
    count: String(opciones.limite || LIMITE_RESULTADOS)
  });

  /*
    País e idioma: el mercado inicial declarado del proyecto.
  */
  if (opciones.pais !== null) parametros.set("country", opciones.pais || "ec");

  if (opciones.idioma !== null) {
    parametros.set("search_lang", opciones.idioma || "es");
  }

  const control = new AbortController();

  const temporizador = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

  try {
    const respuesta = await fetch(`${ENDPOINT}?${parametros.toString()}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": clave
      },
      signal: control.signal
    });

    const tiempo = `${((Date.now() - inicio) / 1000).toFixed(2)}s`;

    /*
      429 = límite de tasa del plan. Es BLOQUEADO, no ERROR:
      el proveedor funciona, solo hay que esperar.
    */
    if (respuesta.status === 429) {
      return {
        ...base,
        estado: ESTADOS.BLOQUEADO,
        detalle: "Brave devolvió 429: límite de tasa del plan alcanzado.",
        tiempo
      };
    }

    /*
      401 / 403 = credencial inválida. Es SIN_CONFIGURAR:
      la clave existe pero no sirve, y reintentar no ayuda.
    */
    if (respuesta.status === 401 || respuesta.status === 403) {
      return {
        ...base,
        estado: ESTADOS.SIN_CONFIGURAR,
        detalle: `Brave rechazó la credencial (HTTP ${respuesta.status}). Revisa BRAVE_API_KEY.`,
        tiempo
      };
    }

    if (!respuesta.ok) {
      return {
        ...base,
        estado: ESTADOS.ERROR,
        detalle: `Brave respondió HTTP ${respuesta.status}.`,
        tiempo
      };
    }

    const datos = await respuesta.json();

    const resultados = normalizarRespuesta(datos, texto, opciones.etiqueta);

    return {
      ...base,
      estado: ESTADOS.OK,
      detalle: `${resultados.length} resultados.`,
      resultados,
      total: resultados.length,
      tiempo
    };
  } catch (error) {
    const tiempo = `${((Date.now() - inicio) / 1000).toFixed(2)}s`;

    const abortado = error?.name === "AbortError";

    return {
      ...base,
      estado: ESTADOS.ERROR,
      detalle: abortado
        ? `Brave no respondió en ${TIEMPO_MAXIMO_MS / 1000}s.`
        : `Fallo de red con Brave: ${error?.message || "desconocido"}.`,
      tiempo
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
    Presupuesto de consultas por investigación.
    Brave admite muchas más que un raspador.
  */
  presupuesto: 8,
  intervaloMs: 300
};
