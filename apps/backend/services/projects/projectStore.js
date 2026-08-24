// apps/backend/services/projects/projectStore.js

import { normalizarTexto } from "../textUtils.js";

import {
  escribirEnLake,
  obtenerHistorialEntidad,
  obtenerVersionEntidad,
  obtenerEventosProyecto
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

/*
  Prefijos de entidad. Son lo que mantiene separados candidatos y
  actores dentro del mismo proyecto.
*/
const PREFIJO_CANDIDATO = "candidato-";

const PREFIJO_ACTOR = "actor-";


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
RECUPERACIÓN — el hotfix de persistencia
===========================================================

El defecto que motivó este hotfix no estaba en el
almacenamiento: los proyectos SÍ se escribían a disco, y ahí
seguían. Lo que no existía era cómo LEERLOS de vuelta.

No había forma de listar proyectos ni de listar los candidatos de
un proyecto, así que el frontend solo podía enseñar lo que tenía
en memoria. Al recargar, la memoria se vaciaba y el proyecto
parecía haber desaparecido. No había desaparecido: estaba en
disco, inalcanzable.

Estas dos funciones se apoyan en `obtenerEventosProyecto`, que el
Knowledge Lake ya exponía. No se modifica el Lake.
===========================================================
*/

async function entidadesDe(proyectoId) {
  try {
    const r = await obtenerEventosProyecto(proyectoId, { tenantId: TENANT });

    const vistas = new Set();

    /* Un evento por version; solo interesa la lista de entidades. */
    return (r?.eventos || [])
      .map((e) => ({ entidad: e.entidad, claveEntidad: e.claveEntidad }))
      .filter((e) => {
        if (!e.entidad || vistas.has(e.entidad)) return false;

        vistas.add(e.entidad);

        return true;
      });
  } catch {
    return [];
  }
}


export async function listarProyectos() {
  const entidades = await entidadesDe(CATALOGO);

  const proyectos = [];

  for (const e of entidades) {
    const p = await obtenerProyecto(e.entidad);

    if (p) proyectos.push(p);
  }

  /* Los mas recientes primero. */
  return proyectos.sort((a, b) =>
    String(b.creadoEn || "").localeCompare(String(a.creadoEn || ""))
  );
}


/*
  Contenido completo de un proyecto: candidatos, actores y el
  expediente de cada uno si ya fue investigado.

  Devolver el expediente AQUI es lo que permite que la interfaz
  muestre "investigación completada" tras una recarga en lugar de
  volver a lanzar la investigación. Recargar no debe gastar cuota.
*/
export async function contenidoDeProyecto(proyectoId) {
  const proyecto = await obtenerProyecto(proyectoId);

  if (!proyecto) return null;

  const entidades = await entidadesDe(proyectoId);

  const candidatos = [];

  const actores = [];

  for (const e of entidades) {
    const nombre = e.entidad;

    if (nombre.startsWith("expediente-")) continue;

    const esActor = nombre.startsWith(PREFIJO_ACTOR);

    const esCandidato = nombre.startsWith(PREFIJO_CANDIDATO);

    if (!esActor && !esCandidato) continue;

    const id = nombre.replace(esActor ? PREFIJO_ACTOR : PREFIJO_CANDIDATO, "");

    const datos = esActor
      ? await obtenerActor(proyectoId, id)
      : await obtenerCandidato(proyectoId, id);

    if (!datos) continue;

    /* Expediente, si existe. Sin investigar nada. */
    let expediente = null;

    /*
      Nombre actual primero, nombre heredado despues. Ver la nota
      del renombrado: en disco existen los dos.
    */
    const nombresExpediente = [
      `expediente-${esActor ? "actor" : "candidato"}-${id}`,
      `expediente-${id}`
    ];

    for (const nombreExp of nombresExpediente) {
      if (expediente) break;

      try {
        const v = await obtenerVersionEntidad(
          claveLake(proyectoId, TIPO_EXPEDIENTE, nombreExp),
          {}
        );

        expediente = v?.registro?.datos || null;
      } catch {
        /* Se prueba el siguiente nombre. */
      }
    }

    const registro = {
      ...datos,

      /*
        ESTADO PERSISTENTE de la investigacion. Se deriva de que
        exista expediente, no de una bandera que alguien tenga que
        acordarse de escribir.
      */
      estadoInvestigacion: expediente ? "completada" : "sin_investigar",

      expediente,

      resumen: expediente
        ? {
            cuentas: (expediente.cuentas || []).length,
            medios: (expediente.medios || []).length,
            evidenciasWeb: expediente.evidenciasWeb ?? null,
            evidenciasSociales: expediente.evidenciasSociales ?? null,
            huellaDigital: expediente.huellaDigital ?? null,
            actualizadoEn: expediente.actualizadoEn || null
          }
        : null
    };

    if (esActor) actores.push(registro);
    else candidatos.push(registro);
  }

  return {
    proyecto,
    candidatos,
    actores,
    metricas: {
      candidatos: candidatos.length,
      actores: actores.length,
      investigaciones: [...candidatos, ...actores].filter(
        (x) => x.estadoInvestigacion === "completada"
      ).length
    }
  };
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

  /*
    FUSION, NO REEMPLAZO. Si el candidato ya existe se conserva lo
    que ya tenia y solo se sobrescribe lo que llega con valor. Sin
    esto, reañadirlo con el formulario vacio le borraba las cuentas
    de referencia que el analista habia aportado.
  */
  const previo = await obtenerCandidato(proyectoId, id);

  const candidato = {
    id,
    nombre,
    /* El rol lo escribe el analista. Sentinel no inventa candidaturas. */
    rol: datos.rol || previo?.rol || null,
    rolOrigen: datos.rol || previo?.rol ? "analista" : null,
    nivel: datos.nivel || previo?.nivel || null,
    dignidad: datos.dignidad || previo?.dignidad || proyecto.dignidad || null,

    /*
      Las cuentas de referencia se ACUMULAN y se deduplican por
      URL: aportar una nueva no borra las anteriores.
    */
    cuentasReferencia: [
      ...(previo?.cuentasReferencia || []),
      ...cuentasReferencia
    ].filter(
      (r, i, todas) =>
        todas.findIndex((x) => x.url === r.url) === i
    ),

    agregadoEn: previo?.agregadoEn || new Date().toISOString(),
    actualizadoEn: previo ? new Date().toISOString() : null
  };

  const r = await escribirEnLake(
    {
      entidad: `${PREFIJO_CANDIDATO}${id}`,
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
      claveLake(proyectoId, TIPO_EXPEDIENTE, `${PREFIJO_CANDIDATO}${candidatoId}`),
      {}
    );

    return v?.registro?.datos || null;
  } catch {
    return null;
  }
}


/*
===========================================================
ACTORES DE REFERENCIA — ARQ-INV-003
===========================================================

OPCIONAL. Un proyecto funciona perfectamente con cero actores, y
ese es el caso por defecto.

POR QUE SON UNA ENTIDAD APARTE Y NO UN CANDIDATO CON UNA
ETIQUETA
-----------------------------------------------------------

Porque la separacion tiene que ser estructural, no una
convencion que alguien pueda saltarse. Un actor de referencia se
guarda bajo un prefijo de entidad distinto, asi que:

  · no aparece al listar candidatos
  · no entra en la comparacion de candidatos
  · no entra en el calculo de cobertura de ningun candidato

Daniel Noboa no puede colarse en la lista de candidatos a la
alcaldia de Cuenca por accidente: no esta guardado ahi.

`incluirEnComparativo` nace en FALSE. Mientras siga en false el
actor existe, se puede investigar y tiene su propio expediente,
pero no toca nada de los candidatos.
===========================================================
*/

export async function agregarActor(proyectoId, datos = {}) {
  const proyecto = await obtenerProyecto(proyectoId);

  if (!proyecto) {
    return { agregado: false, motivo: `no existe el proyecto ${proyectoId}` };
  }

  const nombre = String(datos.nombre || "").trim();

  if (!nombre) {
    return { agregado: false, motivo: "el actor necesita un nombre" };
  }

  const id = idDesde(nombre);

  const cuentasReferencia = [];

  if (datos.urlReferencia) {
    cuentasReferencia.push({
      plataforma: datos.plataformaReferencia || null,
      url: String(datos.urlReferencia).trim(),
      tipo: "cuenta_referencia",
      origen: "analista",
      estado: "proporcionada_por_analista",
      verificadaPorSentinel: false,
      nota:
        "Cuenta proporcionada por el analista como referencia inicial. Sentinel no la ha verificado."
    });
  }

  const actor = {
    id,
    nombre,
    rol: datos.rol || null,
    rolOrigen: datos.rol ? "analista" : null,
    /* El nivel lo declara el analista; Sentinel no lo adivina. */
    nivel: datos.nivel || null,
    territorio: datos.territorio || null,
    dignidad: datos.dignidad || null,
    cuentasReferencia,

    /*
      NACE DESACTIVADO. Mientras siga asi, este actor no toca
      ningun candidato.
    */
    incluirEnComparativo: datos.incluirEnComparativo === true,

    esActorDeReferencia: true,

    agregadoEn: new Date().toISOString()
  };

  const r = await escribirEnLake(
    {
      entidad: `${PREFIJO_ACTOR}${id}`,
      tipoEntidad: TIPO_EXPEDIENTE,
      tenantId: TENANT,
      proyectoId,
      fuente: SUBMOTOR,
      linaje: linaje("agregar_actor"),
      datos: actor
    },
    {}
  );

  return {
    agregado: r?.escrito === true,
    actor,
    proyecto,
    aviso:
      "Actor de referencia creado. No es candidato y no afecta a los candidatos mientras el análisis comparativo esté desactivado.",
    motivo: r?.motivo || null
  };
}


export async function obtenerActor(proyectoId, actorId) {
  try {
    const v = await obtenerVersionEntidad(
      claveLake(proyectoId, TIPO_EXPEDIENTE, `${PREFIJO_ACTOR}${actorId}`),
      {}
    );

    return v?.registro?.datos || null;
  } catch {
    return null;
  }
}


export async function activarComparativo(proyectoId, actorId, activar) {
  const actor = await obtenerActor(proyectoId, actorId);

  if (!actor) {
    return { actualizado: false, motivo: `no existe el actor ${actorId}` };
  }

  const nuevo = { ...actor, incluirEnComparativo: activar === true };

  const r = await escribirEnLake(
    {
      entidad: `${PREFIJO_ACTOR}${actorId}`,
      tipoEntidad: TIPO_EXPEDIENTE,
      tenantId: TENANT,
      proyectoId,
      fuente: SUBMOTOR,
      linaje: linaje("activar_comparativo"),
      datos: nuevo
    },
    {}
  );

  return {
    actualizado: r?.escrito === true,
    actor: nuevo,
    aviso: nuevo.incluirEnComparativo
      ? "Análisis comparativo activado. La correlación que se calcule es OBSERVABLE: coincidencia de temas, medios y tiempo. No implica transferencia de votos ni causalidad."
      : "Análisis comparativo desactivado. El actor no afecta a ningún candidato."
  };
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


export async function registrarInvestigacion(
  proyectoId,
  candidatoId,
  resultado,
  tipo = "candidato"
) {
  /*
    Expedientes separados por tipo: el de un actor de referencia no
    puede pisar el de un candidato ni aparecer en su lugar.
  */
  const entidad = `expediente-${tipo}-${candidatoId}`;

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
  listarProyectos,
  contenidoDeProyecto,
  agregarCandidato,
  obtenerCandidato,
  agregarActor,
  obtenerActor,
  activarComparativo,
  registrarInvestigacion
};
