// apps/backend/services/projects/projectStore.js

import { normalizarTexto } from "../textUtils.js";

import {
  escribirEnLake,
  obtenerHistorialEntidad,
  obtenerVersionEntidad
} from "../knowledgeLake/lakeQuery.js";

/*
===========================================================
ALMACÉN DE PROYECTOS Y EXPEDIENTES — ARQ-INV-002
===========================================================

Proyectos, candidatos y expedientes vivos, persistidos sobre el
Knowledge Lake que ya existe. No se escribe un almacén nuevo.

POR QUÉ EL LAKE Y NO OTRA COSA
-----------------------------------------------------------

El Lake ya resuelve exactamente lo que este sprint pide, y lo
resuelve desde su diseño:

  append-only     una segunda investigación no borra la primera
  versionado      el expediente tiene historia consultable
  proyectoId      AISLAMIENTO por proyecto, requisito DT1

Ese último punto es el importante. La regla «Proyecto Cuenca y
Proyecto Loja no deben mezclarse» no se implementa con un filtro
que alguien puede olvidar: la clave de entidad del Lake es

    tenantId :: proyectoId :: tipoEntidad :: entidad

Dos proyectos distintos producen claves distintas. El
aislamiento es estructural, no una comprobación.

EXPEDIENTE VIVO
-----------------------------------------------------------

Una segunda investigación del mismo candidato NO crea un segundo
candidato: escribe una versión nueva de su expediente y devuelve
el diferencial —qué cuentas, medios y menciones son nuevas—.

Si nada cambió, no se escribe. Tres investigaciones idénticas
dejarían tres versiones idénticas y el historial dejaría de
significar nada.
===========================================================
*/


const TENANT = "sentinel-local";

const SUBMOTOR = "arq_inv_002_proyectos";

/*
  El Lake valida `tipoEntidad` contra su catálogo. Se usan los
  tipos que ya existen: no se inventan tipos nuevos para no tocar
  el modelo del Lake, que este sprint declara intocable.
*/
const TIPO_PROYECTO = "documento";

const TIPO_EXPEDIENTE = "persona";

/*
  Los proyectos viven en un espacio propio para que el catálogo de
  proyectos no quede dentro de ningún proyecto.
*/
const CATALOGO = "catalogo-proyectos";


function idDesde(texto) {
  return normalizarTexto(texto || "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 60);
}

function linaje(paso) {
  return { submotor: SUBMOTOR, cadena: [paso] };
}

function claveLake(proyectoId, tipo, entidad) {
  return `${TENANT}::${proyectoId}::${tipo}::${entidad}`;
}


/*
===========================================================
PROYECTOS
===========================================================
*/

export async function crearProyecto(datos = {}) {
  const nombre = String(datos.nombre || "").trim();

  if (!nombre) {
    return { creado: false, motivo: "el proyecto necesita un nombre" };
  }

  const id = datos.id || idDesde(nombre);

  const proyecto = {
    id,
    nombre,
    pais: datos.pais || null,
    provincia: datos.provincia || null,
    canton: datos.canton || null,
    dignidad: datos.dignidad || null,
    tipoEleccion: datos.tipoEleccion || null,
    fecha: datos.fecha || null,
    estado: datos.estado || "activo",
    creadoEn: new Date().toISOString(),
    /* El proyecto lo define el analista, no Sentinel. */
    origen: "analista"
  };

  const r = await escribirEnLake(
    {
      entidad: id,
      tipoEntidad: TIPO_PROYECTO,
      tenantId: TENANT,
      proyectoId: CATALOGO,
      fuente: SUBMOTOR,
      linaje: linaje("crear_proyecto"),
      datos: proyecto
    },
    {}
  );

  return { creado: r?.escrito === true, proyecto, motivo: r?.motivo || null };
}


export async function obtenerProyecto(proyectoId) {
  if (!proyectoId) return null;

  try {
    const v = await obtenerVersionEntidad(
      claveLake(CATALOGO, TIPO_PROYECTO, proyectoId),
      {}
    );

    return v?.registro?.datos || null;
  } catch {
    return null;
  }
}


/*
===========================================================
CANDIDATOS DEL PROYECTO
===========================================================
*/

export async function agregarCandidato(proyectoId, datos = {}) {
  const proyecto = await obtenerProyecto(proyectoId);

  if (!proyecto) {
    return { agregado: false, motivo: `no existe el proyecto ${proyectoId}` };
  }

  const nombre = String(datos.nombre || "").trim();

  if (!nombre) {
    return { agregado: false, motivo: "el candidato necesita un nombre" };
  }

  const id = idDesde(nombre);

  /*
    ---------------------------------------------------------
    CUENTA DE REFERENCIA
    ---------------------------------------------------------

    La URL que aporta el analista es una SEMILLA, no un
    veredicto. Se marca con su origen y su estado para que la
    interfaz nunca la presente como cuenta verificada por
    Sentinel: no lo es, y confundirlo seria atribuir a Sentinel
    una conclusion que tomo una persona.
  */
  const cuentasReferencia = [];

  const registrarReferencia = (url, plataforma) => {
    const limpia = String(url || "").trim();

    if (!limpia) return;

    cuentasReferencia.push({
      plataforma: plataforma || null,
      url: limpia,
      tipo: "cuenta_referencia",
      origen: "analista",
      estado: "proporcionada_por_analista",
      verificadaPorSentinel: false,
      nota:
        "Cuenta proporcionada por el analista como referencia inicial. Sentinel no la ha verificado."
    });
  };

  registrarReferencia(datos.facebook, "Facebook");
  registrarReferencia(datos.instagram, "Instagram");
  registrarReferencia(datos.x, "X");
  registrarReferencia(datos.tiktok, "TikTok");
  registrarReferencia(datos.youtube, "YouTube");
  registrarReferencia(datos.linkedin, "LinkedIn");
  registrarReferencia(datos.urlReferencia, datos.plataformaReferencia || null);

  const candidato = {
    id,
    nombre,
    /* El rol lo escribe el analista. Sentinel no inventa candidaturas. */
    rol: datos.rol || null,
    rolOrigen: datos.rol ? "analista" : null,
    dignidad: datos.dignidad || proyecto.dignidad || null,
    cuentasReferencia,
    agregadoEn: new Date().toISOString()
  };

  const r = await escribirEnLake(
    {
      entidad: `candidato-${id}`,
      tipoEntidad: TIPO_EXPEDIENTE,
      tenantId: TENANT,
      proyectoId,
      fuente: SUBMOTOR,
      linaje: linaje("agregar_candidato"),
      datos: candidato
    },
    {}
  );

  return {
    agregado: r?.escrito === true,
    candidato,
    proyecto,
    motivo: r?.motivo || null
  };
}


export async function obtenerCandidato(proyectoId, candidatoId) {
  try {
    const v = await obtenerVersionEntidad(
      claveLake(proyectoId, TIPO_EXPEDIENTE, `candidato-${candidatoId}`),
      {}
    );

    return v?.registro?.datos || null;
  } catch {
    return null;
  }
}


/*
===========================================================
EXPEDIENTE VIVO
===========================================================
*/

function resumirExpediente(resultado) {
  const pe = resultado?.perfilEjecutivo || null;

  const f = resultado?.fichaObjetivo || null;

  const cl = resultado?.clasificacionCuentas || null;

  const clave = (c) =>
    `${c.plataformaId || c.platform}:${String(c.handle).toLowerCase()}`;

  return {
    cuentas: (pe?.tarjetas || []).map((t) => ({
      plataforma: t.plataforma,
      plataformaId: t.plataformaId,
      handle: t.handle,
      url: t.url,
      correspondencia: t.correspondencia,
      proveedores: t.proveedores || []
    })),

    medios: (pe?.medios || []).map((m) => ({
      plataforma: m.plataforma,
      handle: m.handle,
      url: m.url
    })),

    instituciones: (pe?.instituciones || []).map((m) => ({
      plataforma: m.plataforma,
      handle: m.handle,
      url: m.url
    })),

    /*
      MENCIONES vs PUBLICACIONES PROPIAS.

      Una evidencia cuya URL pertenece a una cuenta atribuida es
      publicacion propia. Cualquier otra que nombre al objetivo es
      mencion de un tercero. No se mezclan.
    */
    menciones: (f?.evidencias?.web || []).length,

    evidenciasWeb: (f?.evidencias?.web || []).length,

    evidenciasSociales: (f?.evidencias?.sociales || []).length,

    huellaDigital: pe?.huellaDigital?.valor ?? null,

    clavesCuenta: (cl?.cuentasObjetivo || []).map(clave).sort()
  };
}


export async function registrarInvestigacion(proyectoId, candidatoId, resultado) {
  const entidad = `expediente-${candidatoId}`;

  const clave = claveLake(proyectoId, TIPO_EXPEDIENTE, entidad);

  /* Estado anterior del expediente. */
  let anterior = null;

  let versiones = 0;

  try {
    const h = await obtenerHistorialEntidad(entidad, {
      tenantId: TENANT,
      proyectoId
    });

    versiones = (h?.versiones || []).length;

    if (versiones) {
      const v = await obtenerVersionEntidad(clave, {});

      anterior = v?.registro?.datos || null;
    }
  } catch {
    anterior = null;
  }

  const actual = resumirExpediente(resultado);

  /*
    ---------------------------------------------------------
    DIFERENCIAL
    ---------------------------------------------------------
  */
  const previas = new Set(anterior?.clavesCuenta || []);

  const cuentasNuevas = actual.cuentas.filter(
    (c) => !previas.has(`${c.plataformaId}:${String(c.handle).toLowerCase()}`)
  );

  const mediosPrevios = new Set(
    (anterior?.medios || []).map((m) => String(m.url || m.handle).toLowerCase())
  );

  const mediosNuevos = actual.medios.filter(
    (m) => !mediosPrevios.has(String(m.url || m.handle).toLowerCase())
  );

  const sinCambios =
    anterior !== null &&
    JSON.stringify(anterior.clavesCuenta) === JSON.stringify(actual.clavesCuenta) &&
    (anterior.medios || []).length === actual.medios.length &&
    anterior.evidenciasWeb === actual.evidenciasWeb;

  let escritura = null;

  if (!sinCambios) {
    try {
      escritura = await escribirEnLake(
        {
          entidad,
          tipoEntidad: TIPO_EXPEDIENTE,
          tenantId: TENANT,
          proyectoId,
          fuente: SUBMOTOR,
          motorOrigen: resultado?.origenDescubrimiento || null,
          linaje: linaje("registrar_investigacion"),
          datos: { ...actual, candidatoId, actualizadoEn: new Date().toISOString() }
        },
        {}
      );
    } catch (e) {
      escritura = { escrito: false, motivo: e?.message || "fallo de escritura" };
    }
  }

  return {
    version: "1.0",

    proyectoId,
    candidatoId,

    primeraInvestigacion: versiones === 0,

    investigacionesPrevias: versiones,

    /*
      Regla del sprint: una segunda investigacion no crea un
      segundo candidato. Actualiza el mismo expediente.
    */
    expedienteActualizado: sinCambios ? false : escritura?.escrito === true,

    sinCambios,

    mensaje: sinCambios
      ? "Sin cambios relevantes desde la última investigación."
      : versiones === 0
        ? "Expediente creado."
        : "Expediente actualizado.",

    nuevosHallazgos: {
      cuentas: cuentasNuevas.length,
      medios: mediosNuevos.length,
      evidenciasWeb: Math.max(
        0,
        actual.evidenciasWeb - (anterior?.evidenciasWeb || 0)
      ),
      evidenciasSociales: Math.max(
        0,
        actual.evidenciasSociales - (anterior?.evidenciasSociales || 0)
      ),
      detalleCuentas: cuentasNuevas.map((c) => `${c.plataforma} @${c.handle}`),
      detalleMedios: mediosNuevos.map((m) => `${m.plataforma} @${m.handle}`)
    },

    /*
      Una cuenta que no reaparece NO se declara cerrada: puede que
      el proveedor no la devolviera esta vez.
      Misma disciplina que separa `ausencia` de `no_comprobada`.
    */
    advertencia:
      anterior && cuentasNuevas.length === 0 && !sinCambios
        ? "Cambió el volumen de evidencia pero no el conjunto de cuentas. Una cuenta que no reaparece no se declara cerrada."
        : null,

    estadoActual: actual
  };
}


export default {
  crearProyecto,
  obtenerProyecto,
  agregarCandidato,
  obtenerCandidato,
  registrarInvestigacion
};
