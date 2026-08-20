// apps/backend/services/providers/providerHealth.js

/*
===========================================================
SENTINEL INTELLIGENCE
PROVIDER HEALTH — estado de salud de los proveedores
===========================================================

Un proveedor de búsqueda puede fallar de formas MUY distintas
y cada una exige una reacción distinta:

- OK             respondió con normalidad
- BLOQUEADO      respondió, pero el proveedor limitó la tasa
- SIN_CONFIGURAR falta la credencial: no es un fallo, es que
                 nunca se intentó
- ERROR          fallo de red, HTTP o formato inesperado

Confundir "bloqueado" con "0 resultados" fue el defecto que
ocultó durante todo el Sprint 2 que DuckDuckGo no respondía.
Este módulo existe para que eso no vuelva a pasar.

El estado se mantiene EN MEMORIA por proceso. No se persiste:
al reiniciar el backend, todos los proveedores vuelven a
considerarse disponibles.
===========================================================
*/


export const ESTADOS = Object.freeze({
  OK: "OK",
  BLOQUEADO: "Bloqueado",
  SIN_CONFIGURAR: "Sin configurar",
  ERROR: "Error"
});


/*
  Estados que permiten volver a intentar en la misma
  investigación.
*/
const ESTADOS_UTILIZABLES = new Set([ESTADOS.OK]);


/*
  Tras cuántos fallos seguidos se abre el circuito de un
  proveedor dentro de la misma investigación.
*/
const FALLOS_PARA_ABRIR_CIRCUITO = 2;


/*
  Cuánto tiempo se considera "enfriando" un proveedor
  bloqueado antes de volver a intentarlo.
*/
const ENFRIAMIENTO_MS = 10 * 60 * 1000;


const registro = new Map();


function ahora() {
  return Date.now();
}


function crearEntrada(id) {
  return {
    id,
    estado: ESTADOS.OK,
    detalle: "Sin consultas registradas todavía.",

    consultasOk: 0,
    consultasBloqueadas: 0,
    consultasConError: 0,

    fallosSeguidos: 0,
    circuitoAbierto: false,

    ultimaConsulta: null,
    bloqueadoDesde: null
  };
}


export function obtenerSalud(id) {
  if (!registro.has(id)) registro.set(id, crearEntrada(id));

  return registro.get(id);
}


/*
-----------------------------------------------------------
REGISTRAR RESULTADO DE UNA CONSULTA
-----------------------------------------------------------
*/

export function registrarResultado(id, estado, detalle = "") {
  const salud = obtenerSalud(id);

  salud.estado = estado;
  salud.detalle = detalle || estado;
  salud.ultimaConsulta = new Date().toISOString();

  if (estado === ESTADOS.OK) {
    salud.consultasOk += 1;
    salud.fallosSeguidos = 0;
    salud.circuitoAbierto = false;
    salud.bloqueadoDesde = null;

    return salud;
  }

  if (estado === ESTADOS.SIN_CONFIGURAR) {
    /*
      No es un fallo: el proveedor no llegó a consultarse.
      No cuenta para el circuito.
    */
    return salud;
  }

  if (estado === ESTADOS.BLOQUEADO) {
    salud.consultasBloqueadas += 1;
    salud.bloqueadoDesde = salud.bloqueadoDesde || ahora();
  } else {
    salud.consultasConError += 1;
  }

  salud.fallosSeguidos += 1;

  if (salud.fallosSeguidos >= FALLOS_PARA_ABRIR_CIRCUITO) {
    salud.circuitoAbierto = true;
  }

  return salud;
}


/*
-----------------------------------------------------------
¿SE PUEDE USAR AHORA?
-----------------------------------------------------------
*/

export function estaUtilizable(id) {
  const salud = obtenerSalud(id);

  if (salud.estado === ESTADOS.SIN_CONFIGURAR) {
    return { utilizable: false, motivo: "Sin configurar" };
  }

  if (salud.circuitoAbierto) {
    const transcurrido = salud.bloqueadoDesde
      ? ahora() - salud.bloqueadoDesde
      : Infinity;

    if (transcurrido < ENFRIAMIENTO_MS) {
      const restante = Math.ceil((ENFRIAMIENTO_MS - transcurrido) / 1000);

      return {
        utilizable: false,
        motivo: `Circuito abierto tras ${salud.fallosSeguidos} fallos seguidos. Enfriando ${restante}s.`
      };
    }

    /*
      Enfriamiento cumplido: se permite un intento de sondeo.
    */
    salud.circuitoAbierto = false;
    salud.fallosSeguidos = 0;
    salud.bloqueadoDesde = null;

    return { utilizable: true, motivo: "Reintento tras enfriamiento." };
  }

  if (ESTADOS_UTILIZABLES.has(salud.estado)) {
    return { utilizable: true, motivo: "Disponible." };
  }

  /*
    Bloqueado o con error pero sin circuito abierto todavía:
    se permite intentar de nuevo.
  */
  return { utilizable: true, motivo: `Reintento tras estado ${salud.estado}.` };
}


/*
-----------------------------------------------------------
MARCAR SIN CONFIGURAR

Lo usa un proveedor que descubre que le falta la credencial.
-----------------------------------------------------------
*/

export function marcarSinConfigurar(id, detalle) {
  const salud = obtenerSalud(id);

  salud.estado = ESTADOS.SIN_CONFIGURAR;
  salud.detalle = detalle || "Falta la credencial de acceso.";

  return salud;
}


/*
-----------------------------------------------------------
INSTANTÁNEA para informes
-----------------------------------------------------------
*/

export function instantanea(id) {
  const s = obtenerSalud(id);

  return {
    id: s.id,
    estado: s.estado,
    detalle: s.detalle,
    consultasOk: s.consultasOk,
    consultasBloqueadas: s.consultasBloqueadas,
    consultasConError: s.consultasConError,
    circuitoAbierto: s.circuitoAbierto,
    ultimaConsulta: s.ultimaConsulta
  };
}


export function instantaneaGlobal() {
  return [...registro.keys()].map((id) => instantanea(id));
}


/*
-----------------------------------------------------------
REINICIAR — para pruebas
-----------------------------------------------------------
*/

export function reiniciarSalud(id) {
  if (id) registro.delete(id);
  else registro.clear();
}
