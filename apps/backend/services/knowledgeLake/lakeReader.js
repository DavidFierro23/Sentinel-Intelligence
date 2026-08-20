// apps/backend/services/knowledgeLake/lakeReader.js

import { verificarIntegridad } from "./lakeHash.js";
import {
  estadoVigente,
  estadoEnInstante,
  construirHistorial,
  lineaTemporal,
  auditar
} from "./lakeVersioning.js";

/*
===========================================================
KNOWLEDGE LAKE — LECTOR
===========================================================

Primitivas de lectura sobre los índices. No interpreta ni
agrega: eso es de lakeQuery.

Toda lectura que devuelva registros declara además su
COBERTURA: cuántos registros se examinaron y cuántos
quedaron fuera por falta de dato en la dimensión consultada.

Sin ese dato, una respuesta corta parece un hallazgo cuando
puede ser un hueco de ingesta — la misma trampa que la barra
de cobertura del Replay.
===========================================================
*/


export function crearLector(indice) {
  /*
    -----------------------------------------------------------
    LECTURA POR DIMENSIÓN
    -----------------------------------------------------------
  */
  function porDimension(dimension, clave, filtros = {}) {
    let registros = indice.buscar(dimension, clave);

    registros = aplicarFiltros(registros, filtros);

    return {
      dimension,
      clave,
      registros,
      total: registros.length
    };
  }


  /*
    -----------------------------------------------------------
    FILTROS COMUNES
    -----------------------------------------------------------
  */
  function aplicarFiltros(registros, filtros = {}) {
    let lista = [...registros];

    if (filtros.tenantId) {
      lista = lista.filter((r) => r.tenantId === filtros.tenantId);
    }

    if (filtros.proyectoId) {
      lista = lista.filter((r) => r.proyectoId === filtros.proyectoId);
    }

    if (filtros.tipoEntidad) {
      lista = lista.filter((r) => r.tipoEntidad === filtros.tipoEntidad);
    }

    if (filtros.zona) {
      lista = lista.filter((r) => r.zona === filtros.zona);
    }

    if (filtros.desde) {
      const t = new Date(filtros.desde).getTime();

      lista = lista.filter(
        (r) => new Date(r.fechaDeteccion || 0).getTime() >= t
      );
    }

    if (filtros.hasta) {
      const t = new Date(filtros.hasta).getTime();

      lista = lista.filter(
        (r) => new Date(r.fechaDeteccion || 0).getTime() <= t
      );
    }

    /*
      Solo la versión vigente de cada entidad.
    */
    if (filtros.soloVigentes) {
      const porEntidad = new Map();

      lista.forEach((r) => {
        const actual = porEntidad.get(r.claveEntidad);

        if (!actual || (r.version || 0) > (actual.version || 0)) {
          porEntidad.set(r.claveEntidad, r);
        }
      });

      lista = [...porEntidad.values()];
    }

    return lista;
  }


  /*
    -----------------------------------------------------------
    VERSIONES DE UNA ENTIDAD
    -----------------------------------------------------------
  */
  async function versiones(claveEntidad) {
    return indice.versionesDe(claveEntidad);
  }


  async function vigente(claveEntidad) {
    return estadoVigente(await indice.versionesDe(claveEntidad));
  }


  async function enInstante(claveEntidad, instante) {
    return estadoEnInstante(await indice.versionesDe(claveEntidad), instante);
  }


  async function historial(claveEntidad) {
    return construirHistorial(await indice.versionesDe(claveEntidad));
  }


  async function timeline(claveEntidad) {
    return lineaTemporal(await indice.versionesDe(claveEntidad));
  }


  async function auditoria(claveEntidad) {
    return auditar(await indice.versionesDe(claveEntidad));
  }


  /*
    -----------------------------------------------------------
    RESOLVER UNA ENTIDAD por nombre parcial

    El llamador no siempre conoce la clave interna. Devuelve
    las coincidencias, sin elegir por él: elegir en su lugar
    sería adivinar.
    -----------------------------------------------------------
  */
  function resolverEntidad(texto, filtros = {}) {
    const registros = aplicarFiltros(
      indice.buscar("entidad", texto),
      filtros
    );

    if (registros.length) {
      const claves = [...new Set(registros.map((r) => r.claveEntidad))];

      return {
        exacta: true,
        coincidencias: claves.map((clave) => ({
          claveEntidad: clave,
          registros: registros.filter((r) => r.claveEntidad === clave).length
        }))
      };
    }

    /* Búsqueda parcial sobre las claves indexadas. */
    const aguja = String(texto || "").toLowerCase().trim();

    const parciales = indice
      .clavesDeDimension("entidad")
      .filter((e) => e.clave.includes(aguja) || aguja.includes(e.clave));

    return {
      exacta: false,
      coincidencias: parciales.map((p) => ({
        entidad: p.clave,
        registros: p.registros
      })),
      nota: parciales.length
        ? "Coincidencias parciales: elija una explícitamente."
        : "Sin coincidencias en el índice de entidades."
    };
  }


  /*
    -----------------------------------------------------------
    INTEGRIDAD DE TODO EL LAKE
    -----------------------------------------------------------
  */
  function verificarTodo() {
    const registros = indice.todos();

    const resultados = registros.map((r) => ({
      id: r.id,
      version: r.version,
      resultado: verificarIntegridad(r)
    }));

    const alterados = resultados.filter((x) => !x.resultado.integro);

    return {
      registros: registros.length,
      integros: registros.length - alterados.length,
      alterados,
      integridadTotal: alterados.length === 0
    };
  }


  function estado() {
    return indice.estado();
  }


  return {
    porDimension,
    aplicarFiltros,
    versiones,
    vigente,
    enInstante,
    historial,
    timeline,
    auditoria,
    resolverEntidad,
    verificarTodo,
    estado
  };
}
