// apps/backend/services/knowledgeLake/lakeHash.js

import { createHash } from "node:crypto";

/*
===========================================================
SENTINEL INTELLIGENCE
KNOWLEDGE LAKE — HASH ESTABLE
===========================================================

Implementación CANÓNICA del hash de contenido de la
plataforma. El Social Evidence Engine la importa desde aquí:
dos implementaciones distintas del mismo hash acabarían
divergiendo, y en ese momento la verificación de
inmutabilidad dejaría de significar nada sin que nadie se
diera cuenta.

DOS REQUISITOS, ambos imprescindibles:

  1. ORDEN DE CLAVES ESTABLE.
     JSON.stringify no garantiza el orden de las claves entre
     construcciones distintas del mismo objeto. Sin ordenar,
     el mismo contenido produciría hashes distintos.

  2. EXCLUSIÓN DE CAMPOS VOLÁTILES.
     Un `generadoEn` cambia en cada ejecución. Incluirlo haría
     que el hash cambiase sin que cambiara el contenido, y el
     versionado detectaría cambios inexistentes.

Sin estas dos precauciones el hash sirve como identificador
aleatorio, pero NO para verificar que un registro no ha sido
alterado — que es su única razón de existir.
===========================================================
*/


/*
  Campos que no forman parte del contenido: marcas de tiempo
  de proceso, identificadores derivados y métricas de
  ejecución.
*/
export const CAMPOS_VOLATILES = new Set([
  /*
    `id` se DERIVA del hash (`lk-<hash>`, `sp-<hash>`). Si
    entrase en el cálculo, el hash dependería de un valor que
    a su vez depende del hash: nunca sería reproducible y la
    verificación de integridad fallaría en todos los
    registros. Detectado por la suite de verificación del
    Sprint 4.
  */
  "id",
  "generadoEn",
  "evaluadoEn",
  "capturadoEn",
  "emitidoEn",
  "registradoEn",
  "descubiertoEn",
  "obtenidoEn",
  "escritoEn",
  "indexadoEn",
  "hash",
  "hashAnterior",
  "version",
  "tiempo"
]);


/*
-----------------------------------------------------------
SERIALIZACIÓN ESTABLE

Recursiva, con claves ordenadas alfabéticamente y campos
volátiles omitidos en cualquier nivel de anidación.
-----------------------------------------------------------
*/

export function serializarEstable(valor, camposExcluidos = CAMPOS_VOLATILES) {
  if (valor === null || valor === undefined) return "null";

  if (Array.isArray(valor)) {
    return `[${valor.map((v) => serializarEstable(v, camposExcluidos)).join(",")}]`;
  }

  if (valor instanceof Date) return JSON.stringify(valor.toISOString());

  if (typeof valor === "object") {
    const claves = Object.keys(valor)
      .filter((k) => !camposExcluidos.has(k))
      .sort();

    return `{${claves
      .map(
        (k) =>
          `${JSON.stringify(k)}:${serializarEstable(valor[k], camposExcluidos)}`
      )
      .join(",")}}`;
  }

  if (typeof valor === "number" && !Number.isFinite(valor)) return "null";

  return JSON.stringify(valor);
}


/*
-----------------------------------------------------------
HASH DE CONTENIDO
-----------------------------------------------------------
*/

export function calcularHash(objeto, opciones = {}) {
  const excluidos = opciones.incluirVolatiles
    ? new Set()
    : opciones.camposExcluidos || CAMPOS_VOLATILES;

  return createHash("sha256")
    .update(serializarEstable(objeto, excluidos))
    .digest("hex");
}


/*
-----------------------------------------------------------
HASH CORTO — para identificadores legibles
-----------------------------------------------------------
*/

export function hashCorto(objeto, longitud = 12) {
  return calcularHash(objeto).slice(0, longitud);
}


/*
-----------------------------------------------------------
VERIFICAR INTEGRIDAD DE UN REGISTRO

Recalcula el hash del contenido y lo compara con el
almacenado. Es la comprobación que hace real la promesa de
inmutabilidad: sin ella, «append-only» es solo una intención.
-----------------------------------------------------------
*/

export function verificarIntegridad(registro) {
  if (!registro || typeof registro !== "object") {
    return { integro: false, motivo: "registro vacío o no es un objeto" };
  }

  if (!registro.hash) {
    return { integro: false, motivo: "el registro no tiene hash" };
  }

  const recalculado = calcularHash(registro);

  if (recalculado === registro.hash) {
    return { integro: true, hash: recalculado };
  }

  return {
    integro: false,
    motivo: "el hash no coincide con el contenido: el registro fue alterado",
    hashAlmacenado: registro.hash,
    hashRecalculado: recalculado
  };
}


/*
-----------------------------------------------------------
VERIFICAR UNA CADENA DE VERSIONES

Cada versión encadena con la anterior mediante
`hashAnterior`. Comprobar la cadena detecta no solo la
alteración de un registro, sino la ELIMINACIÓN de una versión
intermedia — que un simple hash por registro no detectaría.
-----------------------------------------------------------
*/

export function verificarCadena(versiones = []) {
  const lista = [...versiones].sort((a, b) => a.version - b.version);

  const problemas = [];

  lista.forEach((registro, i) => {
    const integridad = verificarIntegridad(registro);

    if (!integridad.integro) {
      problemas.push({
        version: registro.version,
        problema: "integridad",
        detalle: integridad.motivo
      });
    }

    if (i === 0) {
      if (registro.hashAnterior) {
        problemas.push({
          version: registro.version,
          problema: "cadena",
          detalle: "la primera versión no debería tener hashAnterior"
        });
      }

      return;
    }

    const previa = lista[i - 1];

    if (registro.hashAnterior !== previa.hash) {
      problemas.push({
        version: registro.version,
        problema: "cadena",
        detalle: `hashAnterior no apunta a la versión ${previa.version}: falta una versión intermedia o fue alterada`
      });
    }

    if (registro.version !== previa.version + 1) {
      problemas.push({
        version: registro.version,
        problema: "secuencia",
        detalle: `salto de versión: ${previa.version} → ${registro.version}`
      });
    }
  });

  return {
    valida: problemas.length === 0,
    versiones: lista.length,
    problemas
  };
}
