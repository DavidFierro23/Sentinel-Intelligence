// apps/backend/services/searchProviderLayer.js

import {
  cadenaDeIntentos,
  informeProveedores,
  proveedorPrincipal,
  ESTADOS
} from "./providers/providerRegistry.js";

import { registrarResultado, instantanea } from "./providers/providerHealth.js";

/*
===========================================================
SENTINEL INTELLIGENCE
SEARCH PROVIDER LAYER
===========================================================

  Fusion Engine
      ↓
  Search Provider Layer      ← ESTE MÓDULO
      ↓
  Provider Registry
      ↓
  Brave (principal) · Duck (respaldo) · Bing (preparado)


PROPÓSITO:

Desacoplar el Fusion Engine de cualquier buscador concreto.
El Fusion Engine pide "búsqueda web" y esta capa decide QUIÉN
la resuelve, en qué orden, con qué presupuesto y qué hacer
cuando uno falla.

GARANTÍAS QUE OFRECE:

1. Elige automáticamente el proveedor disponible de mayor
   prioridad.
2. Ante fallo o bloqueo, pasa al siguiente sin abortar la
   investigación.
3. Conserva el MOTOR DE ORIGEN real en cada resultado. Nunca
   se atribuye a un proveedor lo que encontró otro: eso
   fabricaría corroboración falsa.
4. Trazabilidad completa: cada intento queda registrado con
   su proveedor, estado, detalle y tiempo.
5. Presupuesto por proveedor, respetado por consulta y por
   sesión de búsqueda.
6. Informa COBERTURA PARCIAL cuando algún proveedor no pudo
   responder.
===========================================================
*/


function pausa(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


/*
-----------------------------------------------------------
SESIÓN DE BÚSQUEDA

Mantiene el presupuesto consumido y el instante de la última
consulta de cada proveedor durante UNA investigación.

Sin sesión, cada consulta empezaría de cero y se saltaría
tanto el presupuesto como el intervalo entre peticiones —que
es justo lo que provocó el bloqueo de DuckDuckGo.
-----------------------------------------------------------
*/

export function crearSesion(opciones = {}) {
  return {
    consumido: new Map(),
    ultimaLlamada: new Map(),
    intentos: [],
    proveedoresUsados: new Set(),
    agotados: new Set(),
    tipo: opciones.tipo || "web",
    iniciada: Date.now()
  };
}


function presupuestoRestante(sesion, proveedor) {
  const usado = sesion.consumido.get(proveedor.id) || 0;

  return (proveedor.presupuesto ?? 1) - usado;
}


async function respetarIntervalo(sesion, proveedor) {
  const intervalo = proveedor.intervaloMs || 0;

  if (!intervalo) return;

  const ultima = sesion.ultimaLlamada.get(proveedor.id);

  if (!ultima) return;

  const transcurrido = Date.now() - ultima;

  if (transcurrido < intervalo) {
    await pausa(intervalo - transcurrido);
  }
}


/*
===========================================================
BÚSQUEDA WEB

Punto de entrada único para el Fusion Engine.
===========================================================
*/

export async function buscarWeb(consulta, opciones = {}) {
  const texto = String(consulta ?? "").trim();

  const sesion = opciones.sesion || crearSesion();

  const inicio = Date.now();

  const intentos = [];

  if (!texto) {
    return {
      consulta: texto,
      resultados: [],
      total: 0,
      proveedorUsado: null,
      estado: ESTADOS.ERROR,
      intentos,
      coberturaParcial: true,
      advertencias: ["Consulta vacía."],
      tiempo: "0s"
    };
  }

  const { utilizables, descartados } = cadenaDeIntentos(sesion.tipo);

  /*
    Los descartados de entrada (sin configurar, circuito
    abierto) también se registran: forman parte de la
    trazabilidad.
  */
  descartados.forEach((d) => {
    intentos.push({
      proveedorId: d.id,
      proveedor: d.nombre,
      estado: d.estado,
      detalle: d.motivo,
      intentado: false,
      resultados: 0,
      tiempo: "0s"
    });
  });

  const advertencias = [];

  for (const proveedor of utilizables) {
    /*
      PRESUPUESTO
    */
    if (presupuestoRestante(sesion, proveedor) <= 0) {
      sesion.agotados.add(proveedor.id);

      intentos.push({
        proveedorId: proveedor.id,
        proveedor: proveedor.nombre,
        estado: "Presupuesto agotado",
        detalle: `Consumidas las ${proveedor.presupuesto} consultas asignadas en esta investigación.`,
        intentado: false,
        resultados: 0,
        tiempo: "0s"
      });

      continue;
    }

    await respetarIntervalo(sesion, proveedor);

    sesion.consumido.set(
      proveedor.id,
      (sesion.consumido.get(proveedor.id) || 0) + 1
    );

    sesion.ultimaLlamada.set(proveedor.id, Date.now());

    const respuesta = await proveedor.buscar(texto, {
      etiqueta: opciones.etiqueta,
      limite: opciones.limite,
      pais: opciones.pais,
      idioma: opciones.idioma
    });

    /*
      SALUD — se registra siempre, haya ido bien o mal.
    */
    registrarResultado(proveedor.id, respuesta.estado, respuesta.detalle);

    const registroIntento = {
      proveedorId: proveedor.id,
      proveedor: proveedor.nombre,
      estado: respuesta.estado,
      detalle: respuesta.detalle,
      intentado: true,
      resultados: respuesta.total || 0,
      tiempo: respuesta.tiempo || "0s"
    };

    intentos.push(registroIntento);

    /*
      ÉXITO CON RESULTADOS → se devuelve.
    */
    if (respuesta.estado === ESTADOS.OK && respuesta.total > 0) {
      sesion.proveedoresUsados.add(proveedor.id);

      sesion.intentos.push(...intentos);

      return {
        consulta: texto,

        /*
          Los resultados YA vienen etiquetados por el
          proveedor con su motorId real. No se reetiquetan.
        */
        resultados: respuesta.resultados,
        total: respuesta.total,

        proveedorUsado: {
          id: proveedor.id,
          nombre: proveedor.nombre,
          prioridad: proveedor.prioridad
        },

        estado: ESTADOS.OK,
        intentos,
        coberturaParcial: intentos.some(
          (i) => i.estado === ESTADOS.BLOQUEADO || i.estado === ESTADOS.ERROR
        ),
        advertencias,
        tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`
      };
    }

    /*
      ÉXITO SIN RESULTADOS → es una respuesta legítima.
      No se prueba el siguiente proveedor: el buscador
      contestó y no había nada.
    */
    if (respuesta.estado === ESTADOS.OK) {
      sesion.proveedoresUsados.add(proveedor.id);

      sesion.intentos.push(...intentos);

      return {
        consulta: texto,
        resultados: [],
        total: 0,
        proveedorUsado: {
          id: proveedor.id,
          nombre: proveedor.nombre,
          prioridad: proveedor.prioridad
        },
        estado: ESTADOS.OK,
        intentos,
        coberturaParcial: false,
        advertencias,
        tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`
      };
    }

    /*
      FALLO → se anota y se pasa al siguiente proveedor.
    */
    advertencias.push(
      `${proveedor.nombre}: ${respuesta.estado} — ${respuesta.detalle}`
    );
  }

  /*
    NINGÚN PROVEEDOR PUDO RESPONDER.
  */
  sesion.intentos.push(...intentos);

  return {
    consulta: texto,
    resultados: [],
    total: 0,
    proveedorUsado: null,
    estado: intentos.some((i) => i.estado === ESTADOS.BLOQUEADO)
      ? ESTADOS.BLOQUEADO
      : ESTADOS.ERROR,
    intentos,
    coberturaParcial: true,
    advertencias: advertencias.length
      ? advertencias
      : ["Ningún proveedor web disponible para esta consulta."],
    tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`
  };
}


/*
-----------------------------------------------------------
RESUMEN DE UNA SESIÓN — para el informe del Fusion Engine
-----------------------------------------------------------
*/

export function resumirSesion(sesion) {
  if (!sesion) return null;

  const porProveedor = new Map();

  sesion.intentos.forEach((i) => {
    if (!porProveedor.has(i.proveedorId)) {
      porProveedor.set(i.proveedorId, {
        id: i.proveedorId,
        nombre: i.proveedor,
        intentos: 0,
        exitos: 0,
        bloqueos: 0,
        errores: 0,
        noIntentados: 0,
        resultados: 0
      });
    }

    const r = porProveedor.get(i.proveedorId);

    if (!i.intentado) {
      r.noIntentados += 1;
      return;
    }

    r.intentos += 1;
    r.resultados += i.resultados;

    if (i.estado === ESTADOS.OK) r.exitos += 1;
    else if (i.estado === ESTADOS.BLOQUEADO) r.bloqueos += 1;
    else r.errores += 1;
  });

  const proveedores = [...porProveedor.values()].map((p) => ({
    ...p,
    presupuestoConsumido: sesion.consumido.get(p.id) || 0,
    salud: instantanea(p.id)
  }));

  const degradados = proveedores.filter((p) => p.bloqueos > 0 || p.errores > 0);

  return {
    proveedores,

    proveedoresUsados: [...sesion.proveedoresUsados],

    presupuestosAgotados: [...sesion.agotados],

    coberturaParcial: degradados.length > 0,

    advertencias: degradados.map(
      (p) =>
        `${p.nombre}: ${p.bloqueos} bloqueo(s) y ${p.errores} error(es) de ${p.intentos} intento(s). Cobertura parcial.`
    )
  };
}


/*
-----------------------------------------------------------
DIAGNÓSTICO PÚBLICO DE LA CAPA
-----------------------------------------------------------
*/

export function diagnosticoProveedores() {
  const principal = proveedorPrincipal("web");

  return {
    principalDeclarado: principal
      ? { id: principal.id, nombre: principal.nombre }
      : null,
    proveedores: informeProveedores()
  };
}


export { ESTADOS };
