// apps/backend/services/providers/duckProvider.js

import { ESTADOS } from "./providerHealth.js";
import { buscarGoogle } from "../googleService.js";

/*
===========================================================
DUCKDUCKGO — proveedor web de RESPALDO
===========================================================

Adapta el servicio existente (googleService.js, que pese al
nombre consulta DuckDuckGo) al contrato de proveedor.

NO se reimplementa el raspado: se envuelve el servicio que ya
funciona y está probado. Así el Sprint 2 sigue operativo.

LIMITACIÓN MEDIDA (Sprint 2):

DuckDuckGo corta el raspado tras ~1–2 consultas seguidas y
responde HTTP 200 con una página sin resultados. Por eso:

- es RESPALDO, no principal;
- su presupuesto es de 2 consultas por investigación;
- su intervalo entre consultas es alto;
- su respuesta `bloqueado` se traduce al estado BLOQUEADO,
  que es distinto de "0 resultados".
===========================================================
*/

export const ID = "ddg_web";
export const NOMBRE = "DuckDuckGo Web";
export const TIPO = "web";
/*
  Baja a 3: ULTIMO RECURSO. No se elimina — sigue siendo la red
  de seguridad si SerpAPI agota su cuota mensual o falla — pero
  su limite medido (responde a 1-2 consultas y luego devuelve
  HTTP 200 sin `result__a`) lo descarta como principal.
*/
export const PRIORIDAD = 3;


export function estaConfigurado() {
  /*
    No requiere credencial: siempre "configurado".
    Otra cosa es que el proveedor responda.
  */
  return true;
}


export function diagnostico() {
  return {
    configurado: true,
    estado: ESTADOS.OK,
    detalle:
      "No requiere credencial. Raspado HTML sujeto a limitación de tasa del proveedor (~1–2 consultas seguidas)."
  };
}


export async function buscar(consulta, opciones = {}) {
  const texto = String(consulta ?? "").trim();

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

  try {
    const respuesta = await buscarGoogle(texto, {
      etiqueta: opciones.etiqueta
    });

    /*
      Traducción del contrato existente al de proveedor.
      `bloqueado` viene de googleService y significa que la
      página no traía estructura de resultados.
    */
    if (respuesta?.bloqueado) {
      return {
        ...base,
        estado: ESTADOS.BLOQUEADO,
        detalle:
          "DuckDuckGo respondió sin estructura de resultados: limitación de tasa del proveedor.",
        tiempo: respuesta.tiempo || "0s"
      };
    }

    const resultados = Array.isArray(respuesta?.resultados)
      ? respuesta.resultados.map((r) => ({
          ...r,
          motor: NOMBRE,
          motorId: ID
        }))
      : [];

    return {
      ...base,
      estado: ESTADOS.OK,
      detalle: `${resultados.length} resultados (vía ${respuesta?.via || "?"}).`,
      resultados,
      total: resultados.length,
      tiempo: respuesta?.tiempo || "0s"
    };
  } catch (error) {
    return {
      ...base,
      estado: ESTADOS.ERROR,
      detalle: `Fallo consultando DuckDuckGo: ${error?.message || "desconocido"}.`,
      tiempo: "0s"
    };
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
    Presupuesto conservador por la limitación medida.
  */
  presupuesto: 2,
  intervaloMs: 3500
};
