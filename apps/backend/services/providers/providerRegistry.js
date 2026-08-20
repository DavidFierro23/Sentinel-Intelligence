// apps/backend/services/providers/providerRegistry.js

import serpapiProvider from "./serpapiProvider.js";
import braveProvider from "./braveProvider.js";
import duckProvider from "./duckProvider.js";

import {
  ESTADOS,
  obtenerSalud,
  instantanea,
  marcarSinConfigurar,
  estaUtilizable
} from "./providerHealth.js";

/*
===========================================================
PROVIDER REGISTRY
===========================================================

Fuente única de verdad sobre QUÉ proveedores existen, en qué
ORDEN se intentan y en qué ESTADO están.

Cada entrada declara:

  - nombre         etiqueta legible
  - prioridad      1 = se intenta primero
  - disponibilidad si puede usarse ahora mismo
  - estado         OK · Bloqueado · Sin configurar · Error

Añadir un proveedor nuevo (Bing, Serper, Google CSE) consiste
únicamente en escribir su módulo con el mismo contrato y
registrarlo aquí. Ni el Fusion Engine ni la Search Provider
Layer necesitan cambio alguno.
===========================================================
*/


/*
-----------------------------------------------------------
PROVEEDORES PREPARADOS PERO NO IMPLEMENTADOS

Se declaran para que aparezcan en el informe de cobertura,
pero NUNCA se invocan. Declararlos como si funcionaran
fabricaría una corroboración inexistente.
-----------------------------------------------------------
*/

const PREPARADOS = [
  {
    id: "bing_web",
    nombre: "Bing Web",
    tipo: "web",
    prioridad: 3,
    implementado: false,
    motivo:
      "Preparado arquitectónicamente. Requiere módulo propio en services/providers/ y credencial."
  }
];


/*
  ORDEN DE INTENTO (prioridad ascendente)

    1  SerpAPI      resultados de Google via API oficial
    2  Brave        estructura lista, pendiente de credencial
    3  DuckDuckGo   ULTIMO RECURSO

  DuckDuckGo no se elimina: sigue cubriendo el caso de que
  SerpAPI agote su cuota mensual o falle. Baja a ultimo recurso
  porque su limite medido (1-2 consultas por investigacion) lo
  hace inviable como principal.
*/
const PROVEEDORES = [serpapiProvider, braveProvider, duckProvider];


/*
-----------------------------------------------------------
LISTAR TODOS
-----------------------------------------------------------
*/

export function listarProveedores() {
  return [...PROVEEDORES].sort((a, b) => a.prioridad - b.prioridad);
}


/*
-----------------------------------------------------------
ESTADO ACTUAL DE UN PROVEEDOR

Combina lo que el propio proveedor sabe de sí mismo
(¿tengo credencial?) con su historial de salud
(¿me han bloqueado?).
-----------------------------------------------------------
*/

export function estadoDe(proveedor) {
  const diag = proveedor.diagnostico();

  /*
    Si le falta credencial, se refleja en la salud para que
    la capa superior no lo intente.
  */
  if (!diag.configurado) {
    marcarSinConfigurar(proveedor.id, diag.detalle);
  }

  const salud = obtenerSalud(proveedor.id);

  const disponibilidad = diag.configurado
    ? estaUtilizable(proveedor.id)
    : { utilizable: false, motivo: diag.detalle };

  return {
    id: proveedor.id,
    nombre: proveedor.nombre,
    tipo: proveedor.tipo,
    prioridad: proveedor.prioridad,

    implementado: true,
    configurado: diag.configurado,

    estado: diag.configurado ? salud.estado : ESTADOS.SIN_CONFIGURAR,
    detalle: diag.configurado ? salud.detalle : diag.detalle,

    disponible: disponibilidad.utilizable,
    motivoDisponibilidad: disponibilidad.motivo,

    presupuesto: proveedor.presupuesto ?? 1,
    intervaloMs: proveedor.intervaloMs ?? 0,

    salud: instantanea(proveedor.id)
  };
}


/*
-----------------------------------------------------------
INFORME COMPLETO — incluye los preparados
-----------------------------------------------------------
*/

export function informeProveedores() {
  const activos = listarProveedores().map((p) => estadoDe(p));

  const preparados = PREPARADOS.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    prioridad: p.prioridad,

    implementado: false,
    configurado: false,

    estado: ESTADOS.SIN_CONFIGURAR,
    detalle: p.motivo,

    disponible: false,
    motivoDisponibilidad: p.motivo,

    presupuesto: 0,
    intervaloMs: 0,
    salud: null
  }));

  return [...activos, ...preparados].sort((a, b) => a.prioridad - b.prioridad);
}


/*
-----------------------------------------------------------
CADENA DE INTENTOS

Devuelve los proveedores utilizables ahora, en orden de
prioridad. Es lo que consume la Search Provider Layer para
saber a quién preguntar y en qué orden.
-----------------------------------------------------------
*/

export function cadenaDeIntentos(tipo = "web") {
  const evaluados = listarProveedores()
    .filter((p) => p.tipo === tipo)
    .map((p) => ({ proveedor: p, estado: estadoDe(p) }));

  return {
    utilizables: evaluados
      .filter((e) => e.estado.disponible)
      .map((e) => e.proveedor),

    descartados: evaluados
      .filter((e) => !e.estado.disponible)
      .map((e) => ({
        id: e.estado.id,
        nombre: e.estado.nombre,
        estado: e.estado.estado,
        motivo: e.estado.motivoDisponibilidad
      }))
  };
}


/*
-----------------------------------------------------------
PROVEEDOR PRINCIPAL DECLARADO
-----------------------------------------------------------
*/

export function proveedorPrincipal(tipo = "web") {
  return listarProveedores().find((p) => p.tipo === tipo) || null;
}


export { ESTADOS };
