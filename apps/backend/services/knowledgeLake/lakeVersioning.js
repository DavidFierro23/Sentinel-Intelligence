// apps/backend/services/knowledgeLake/lakeVersioning.js

import { verificarCadena, verificarIntegridad } from "./lakeHash.js";

/*
===========================================================
KNOWLEDGE LAKE — VERSIONADO Y RECONSTRUCCIÓN HISTÓRICA
===========================================================

El Lake nunca sobrescribe: guarda versiones encadenadas. Este
módulo es el que convierte esa pila de versiones en respuestas
útiles:

  · estado vigente de una entidad
  · estado en un instante T          ← Replay Intelligence
  · qué cambió entre dos versiones
  · integridad de la cadena

RECONSTRUCCIÓN HISTÓRICA: el estado de una entidad en T es su
última versión con `fechaDeteccion <= T`. No es la última
versión escrita: es la última que EXISTÍA entonces.

La distinción importa. Si un dato del 12 de agosto se
corrigió el 19, un replay del 15 debe mostrar el valor
equivocado que se conocía ese día — porque la decisión que se
tomó el 15 se tomó con ese valor. Mostrar el corregido
falsearía la auditoría.
===========================================================
*/


/*
-----------------------------------------------------------
ESTADO VIGENTE
-----------------------------------------------------------
*/

export function estadoVigente(versiones = []) {
  if (!versiones.length) return null;

  return versiones.reduce(
    (max, r) => ((r.version || 0) > (max.version || 0) ? r : max),
    versiones[0]
  );
}


/*
-----------------------------------------------------------
ESTADO EN UN INSTANTE T
-----------------------------------------------------------
*/

export function estadoEnInstante(versiones = [], instante) {
  if (!versiones.length) return null;

  const limite = instante ? new Date(instante).getTime() : Date.now();

  if (Number.isNaN(limite)) return null;

  const anteriores = versiones.filter((r) => {
    const t = new Date(r.fechaDeteccion || r.escritoEn || 0).getTime();

    return Number.isFinite(t) && t <= limite;
  });

  if (!anteriores.length) {
    return {
      existia: false,
      instante: new Date(limite).toISOString(),
      motivo:
        "La entidad no tenía ninguna versión registrada en ese instante. Ausencia de registro no es ausencia de hecho."
    };
  }

  const version = estadoVigente(anteriores);

  return {
    existia: true,
    instante: new Date(limite).toISOString(),
    version: version.version,
    versionesEntonces: anteriores.length,
    versionesPosteriores: versiones.length - anteriores.length,
    registro: version
  };
}


/*
-----------------------------------------------------------
DIFERENCIA ENTRE DOS VERSIONES

Compara campo a campo, ignorando los volátiles. Devuelve solo
lo que cambió: una lista de "todos los campos" no explica
nada.
-----------------------------------------------------------
*/

const CAMPOS_IGNORADOS_EN_DIFF = new Set([
  "hash",
  "hashAnterior",
  "version",
  "id",
  "escritoEn",
  "esVersionInicial",
  "motivoVersion",
  "particion",
  "latenciaDeteccionMs"
]);


function esIgual(a, b) {
  if (a === b) return true;

  if (a == null && b == null) return true;

  if (typeof a !== typeof b) return false;

  if (typeof a === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}


export function diferencia(anterior, posterior) {
  if (!anterior || !posterior) return null;

  const claves = new Set([
    ...Object.keys(anterior),
    ...Object.keys(posterior)
  ]);

  const cambios = [];

  claves.forEach((clave) => {
    if (CAMPOS_IGNORADOS_EN_DIFF.has(clave)) return;

    if (!esIgual(anterior[clave], posterior[clave])) {
      cambios.push({
        campo: clave,
        antes: anterior[clave] ?? null,
        despues: posterior[clave] ?? null
      });
    }
  });

  return {
    desdeVersion: anterior.version,
    hastaVersion: posterior.version,
    fechaCambio: posterior.fechaDeteccion || posterior.escritoEn,
    motivo: posterior.motivoVersion || null,
    cambios,
    totalCambios: cambios.length
  };
}


/*
-----------------------------------------------------------
HISTORIAL COMPLETO DE UNA ENTIDAD

Cada versión con lo que cambió respecto a la anterior. Es la
forma legible de la historia: no una lista de estados, sino
una lista de CAMBIOS.
-----------------------------------------------------------
*/

export function construirHistorial(versiones = []) {
  const ordenadas = [...versiones].sort(
    (a, b) => (a.version || 0) - (b.version || 0)
  );

  const entradas = ordenadas.map((registro, i) => {
    const previa = i > 0 ? ordenadas[i - 1] : null;

    return {
      version: registro.version,
      id: registro.id,
      hash: registro.hash,
      hashAnterior: registro.hashAnterior,
      fechaHecho: registro.fechaHecho,
      fechaDeteccion: registro.fechaDeteccion,
      motivo: registro.motivoVersion,
      fuente: registro.fuente,
      motorOrigen: registro.motorOrigen,
      confianza: registro.confianza,
      esVersionInicial: registro.esVersionInicial,
      cambios: previa ? diferencia(previa, registro).cambios : null,
      integridad: verificarIntegridad(registro)
    };
  });

  const cadena = verificarCadena(ordenadas);

  return {
    versiones: entradas,
    total: entradas.length,
    vigente: ordenadas.length ? ordenadas[ordenadas.length - 1].version : null,
    primeraDeteccion: ordenadas[0]?.fechaDeteccion || null,
    ultimaDeteccion:
      ordenadas[ordenadas.length - 1]?.fechaDeteccion || null,
    cadena
  };
}


/*
-----------------------------------------------------------
LÍNEA TEMPORAL DE UNA ENTIDAD

Formato pensado para el Timeline Universal: hechos fechados,
no estados.
-----------------------------------------------------------
*/

export function lineaTemporal(versiones = []) {
  return [...versiones]
    .sort((a, b) => (a.version || 0) - (b.version || 0))
    .map((r) => ({
      instante: r.fechaHecho || r.fechaDeteccion,
      instanteDeteccion: r.fechaDeteccion,
      version: r.version,
      tipo: r.esVersionInicial ? "primera_deteccion" : "actualizacion",
      motivo: r.motivoVersion,
      fuente: r.fuente,
      motorOrigen: r.motorOrigen,
      titulo: r.titulo,
      confianza: r.confianza?.puntuacion ?? null,
      hash: r.hash
    }))
    .sort((a, b) =>
      String(a.instante || "").localeCompare(String(b.instante || ""))
    );
}


/*
-----------------------------------------------------------
AUDITORÍA DE UNA CADENA
-----------------------------------------------------------
*/

export function auditar(versiones = []) {
  const cadena = verificarCadena(versiones);

  const sinFechaHecho = versiones.filter((r) => !r.fechaHecho).length;

  const sinLinaje = versiones.filter((r) => !r.linaje?.submotor).length;

  return {
    ...cadena,
    huecos: {
      sinFechaHecho,
      sinLinaje
    },
    auditable: cadena.valida && sinLinaje === 0,
    nota:
      sinFechaHecho > 0
        ? `${sinFechaHecho} versión(es) sin fecha de hecho: su posición en el Timeline Universal se apoya en la fecha de detección.`
        : null
  };
}
