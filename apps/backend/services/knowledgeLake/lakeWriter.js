// apps/backend/services/knowledgeLake/lakeWriter.js

import { calcularHash, hashCorto, verificarIntegridad } from "./lakeHash.js";

/*
===========================================================
KNOWLEDGE LAKE — MODELO Y ESCRITURA APPEND-ONLY
===========================================================

Aquí vive el MODELO del registro y la única vía de escritura.

REGLA CENTRAL: no existe función de actualización.

`escribir()` siempre ANEXA. Para cambiar algo se anexa una
versión nueva que encadena con la anterior mediante
`hashAnterior`. El estado vigente es la última versión, no un
registro mutado.

Consecuencia buscada: la historia de una entidad es
reconstruible en cualquier instante T, que es el requisito
duro de Replay Intelligence (UX-WR-001 §9.4).
===========================================================
*/


/*
-----------------------------------------------------------
MODELO DEL REGISTRO — campos obligatorios (Fase 3)
-----------------------------------------------------------
*/

export const CAMPOS_MODELO = Object.freeze([
  "id",
  "hash",
  "tenantId",
  "proyectoId",
  "entidad",
  "tipoEntidad",
  "fuente",
  "motorOrigen",
  "consulta",
  "urlOriginal",
  "urlCanonica",
  "fechaHecho",
  "fechaDeteccion",
  "confianza",
  "linaje",
  "version"
]);


export const TIPOS_ENTIDAD = Object.freeze({
  PERSONA: "persona",
  ORGANIZACION: "organizacion",
  CUENTA_SOCIAL: "cuenta_social",
  MEDIO: "medio",
  NARRATIVA: "narrativa",
  TERRITORIO: "territorio",
  EVENTO: "evento",
  DOCUMENTO: "documento",
  PUBLICACION: "publicacion"
});


export const ZONAS = Object.freeze({
  RAW: "raw",
  CURATED: "curated"
});


/*
-----------------------------------------------------------
PARTICIÓN TEMPORAL

Por fecha de DETECCIÓN, no de hecho: la partición debe ser
inmutable una vez escrita, y la fecha del hecho puede
corregirse en una versión posterior.
-----------------------------------------------------------
*/

export function calcularParticion(fechaDeteccion) {
  const fecha = fechaDeteccion ? new Date(fechaDeteccion) : new Date();

  if (Number.isNaN(fecha.getTime())) return "sin-particion";

  const anio = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");

  return `${anio}/${mes}/${dia}`;
}


/*
-----------------------------------------------------------
CLAVE DE ENTIDAD

Identifica a QUÉ entidad pertenece un registro, para poder
agrupar sus versiones. Es la columna vertebral del versionado.
-----------------------------------------------------------
*/

export function claveEntidad(registro) {
  const tenant = registro.tenantId || "sin-tenant";
  const proyecto = registro.proyectoId || "sin-proyecto";
  const tipo = registro.tipoEntidad || "desconocido";

  const entidad =
    typeof registro.entidad === "string"
      ? registro.entidad
      : registro.entidad?.id ||
        registro.entidad?.clave ||
        registro.urlCanonica ||
        "sin-entidad";

  return `${tenant}::${proyecto}::${tipo}::${String(entidad)
    .toLowerCase()
    .trim()}`;
}


/*
-----------------------------------------------------------
VALIDACIÓN DEL MODELO
-----------------------------------------------------------
*/

export function validarRegistro(registro) {
  const errores = [];

  if (!registro || typeof registro !== "object") {
    return { valido: false, errores: ["registro vacío"] };
  }

  if (!registro.tenantId) errores.push("falta tenantId (DT1: multitenancy)");

  if (!registro.proyectoId) errores.push("falta proyectoId");

  if (!registro.entidad) errores.push("falta entidad");

  if (!registro.tipoEntidad) {
    errores.push("falta tipoEntidad");
  } else if (!Object.values(TIPOS_ENTIDAD).includes(registro.tipoEntidad)) {
    errores.push(`tipoEntidad no válido: ${registro.tipoEntidad}`);
  }

  if (!registro.fuente) errores.push("falta fuente");

  if (!registro.linaje?.submotor) {
    errores.push("falta linaje.submotor (DT3: trazabilidad obligatoria)");
  }

  if (!registro.fechaDeteccion) errores.push("falta fechaDeteccion");

  if (registro.confianza != null && typeof registro.confianza !== "object") {
    errores.push("confianza debe ser un objeto con su desglose, no un número suelto (IA1)");
  }

  return { valido: errores.length === 0, errores };
}


/*
-----------------------------------------------------------
CONSTRUIR REGISTRO

Normaliza la entrada al modelo. No inventa datos: lo que no
llega queda en null y así se guarda.
-----------------------------------------------------------
*/

export function construirRegistro(entrada = {}, contexto = {}) {
  const fechaDeteccion =
    entrada.fechaDeteccion || contexto.fechaDeteccion || new Date().toISOString();

  const base = {
    /* ---- IDENTIDAD ---- */
    esquema: "sentinel.lake.registro.v1",
    id: null,
    hash: null,

    /* ---- GOBIERNO (DT1, DT4) ---- */
    tenantId: entrada.tenantId || contexto.tenantId || null,
    proyectoId: entrada.proyectoId || contexto.proyectoId || null,
    residencia: entrada.residencia || contexto.residencia || null,
    zona: entrada.zona || ZONAS.RAW,

    /* ---- ENTIDAD ---- */
    entidad: entrada.entidad ?? null,
    tipoEntidad: entrada.tipoEntidad || null,

    /* ---- PROCEDENCIA ---- */
    fuente: entrada.fuente || null,
    motorOrigen: entrada.motorOrigen || null,
    consulta: entrada.consulta ?? null,

    /* ---- LOCALIZADORES ---- */
    urlOriginal: entrada.urlOriginal ?? null,
    urlCanonica: entrada.urlCanonica ?? null,

    /* ---- TIEMPO ---- */
    fechaHecho: entrada.fechaHecho ?? null,
    fechaDeteccion,

    /*
      La latencia entre hecho y detección es información
      operativa: cuánto tardó Sentinel en ver algo.
    */
    latenciaDeteccionMs:
      entrada.fechaHecho && fechaDeteccion
        ? new Date(fechaDeteccion).getTime() -
          new Date(entrada.fechaHecho).getTime()
        : null,

    /* ---- CONFIANZA (siempre con desglose, IA1) ---- */
    confianza: entrada.confianza ?? null,

    /* ---- CALIDAD ---- */
    calidad: entrada.calidad ?? null,

    /* ---- DIMENSIONES DE ÍNDICE (Fase 4) ---- */
    territorio: entrada.territorio ?? null,
    narrativa: entrada.narrativa ?? null,
    plataforma: entrada.plataforma ?? null,

    /* ---- CONTENIDO ---- */
    titulo: entrada.titulo ?? null,
    descripcion: entrada.descripcion ?? null,
    datos: entrada.datos ?? null,

    /* ---- LINAJE (DT3) ---- */
    linaje: {
      submotor: entrada.linaje?.submotor || contexto.submotor || null,
      derivadaDe: entrada.linaje?.derivadaDe || [],
      cadena: entrada.linaje?.cadena || [],
      submotoresImplicados: entrada.linaje?.submotoresImplicados || [],
      modoAcceso: entrada.linaje?.modoAcceso || null,
      version: entrada.linaje?.version || "1.0"
    },

    /* ---- VERSIONADO ---- */
    version: 1,
    hashAnterior: null,
    esVersionInicial: true,
    motivoVersion: entrada.motivoVersion || "creación",

    /* ---- PARTICIÓN ---- */
    particion: calcularParticion(fechaDeteccion),

    escritoEn: null
  };

  base.claveEntidad = claveEntidad(base);

  return base;
}


/*
===========================================================
ESCRITOR
===========================================================
*/

export function crearEscritor(adaptador, indice) {
  /*
    Contador de versiones por entidad, sostenido por el
    índice: la versión no se adivina, se deriva de lo que ya
    hay escrito.
  */

  async function escribir(entrada, contexto = {}) {
    const registro = construirRegistro(entrada, contexto);

    const validacion = validarRegistro(registro);

    if (!validacion.valido) {
      return {
        escrito: false,
        errores: validacion.errores,
        motivo: "el registro no cumple el modelo"
      };
    }

    /*
      ---------------------------------------------------------
      VERSIONADO

      Se busca la última versión de esta entidad. Si existe,
      el nuevo registro es la siguiente versión y encadena con
      el hash de la anterior.
      ---------------------------------------------------------
    */
    const ultima = indice
      ? await indice.ultimaVersionDe(registro.claveEntidad)
      : null;

    if (ultima) {
      registro.version = ultima.version + 1;
      registro.hashAnterior = ultima.hash;
      registro.esVersionInicial = false;

      if (!entrada.motivoVersion) {
        registro.motivoVersion = "actualización";
      }
    }

    /*
      ---------------------------------------------------------
      HASH — se calcula al final, sobre el contenido completo
      y sin los campos volátiles.
      ---------------------------------------------------------
    */
    registro.hash = calcularHash(registro);

    registro.id = `lk-${hashCorto(registro)}`;

    registro.escritoEn = new Date().toISOString();

    /*
      ---------------------------------------------------------
      DETECCIÓN DE ESCRITURA REDUNDANTE

      Si el contenido es idéntico a la última versión, el hash
      coincide. Anexar una versión nueva sin cambios ensuciaría
      la historia y haría creer que algo cambió.
      ---------------------------------------------------------
    */
    if (ultima && ultima.hash === registro.hash) {
      return {
        escrito: false,
        motivo: "sin cambios respecto a la versión anterior",
        version: ultima.version,
        hash: ultima.hash,
        omitido: true
      };
    }

    const resultado = await adaptador.anexar(registro);

    if (indice) await indice.indexar(registro);

    return {
      escrito: true,
      id: registro.id,
      hash: registro.hash,
      version: registro.version,
      claveEntidad: registro.claveEntidad,
      particion: registro.particion,
      esVersionInicial: registro.esVersionInicial,
      almacenamiento: resultado
    };
  }


  /*
    Escritura por lotes. Secuencial a propósito: dos registros
    de la misma entidad en el mismo lote deben versionarse en
    orden, y en paralelo se asignarían la misma versión.
  */
  async function escribirLote(entradas = [], contexto = {}) {
    const resultados = [];

    for (const entrada of entradas) {
      resultados.push(await escribir(entrada, contexto));
    }

    const escritos = resultados.filter((r) => r.escrito);

    return {
      total: entradas.length,
      escritos: escritos.length,
      omitidosSinCambios: resultados.filter((r) => r.omitido).length,
      rechazados: resultados.filter((r) => !r.escrito && !r.omitido).length,
      versionesNuevas: escritos.filter((r) => !r.esVersionInicial).length,
      resultados
    };
  }


  /*
    Verificación de integridad de lo escrito.
  */
  async function verificar() {
    const registros = await adaptador.leerTodos();

    const alterados = registros
      .map((r) => ({ registro: r, resultado: verificarIntegridad(r) }))
      .filter((x) => !x.resultado.integro);

    return {
      registros: registros.length,
      integros: registros.length - alterados.length,
      alterados: alterados.map((x) => ({
        id: x.registro.id,
        version: x.registro.version,
        motivo: x.resultado.motivo
      })),
      integridadTotal: alterados.length === 0
    };
  }


  /*
    Operaciones deliberadamente ausentes. Se declaran para
    que quede constancia de que su ausencia es una decisión,
    no un olvido.
  */
  const noExiste = (nombre) => () => {
    throw new Error(
      `El Knowledge Lake no admite "${nombre}". Es append-only: para cambiar algo se escribe una versión nueva.`
    );
  };

  return {
    escribir,
    escribirLote,
    verificar,

    actualizar: noExiste("actualizar"),
    eliminar: noExiste("eliminar"),
    sobrescribir: noExiste("sobrescribir")
  };
}
