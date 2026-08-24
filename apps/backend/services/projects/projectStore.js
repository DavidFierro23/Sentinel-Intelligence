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


/*
-----------------------------------------------------------
CODIFICACION SOSPECHOSA

U+FFFD es el caracter de reemplazo: aparece cuando unos bytes
no eran UTF-8 valido y alguien los decodifico igualmente. Si
esta en un registro, ese texto se corrompio ANTES de llegar aqui.

Se DETECTA y se declara; no se corrige por sustitucion. Adivinar
que decia un texto corrupto es inventar datos, y ademas taparia
el problema de origen en lugar de mostrarlo.
-----------------------------------------------------------
*/
const REEMPLAZO = "\uFFFD";

function camposCorruptos(objeto) {
  return Object.entries(objeto || {})
    .filter(([, v]) => typeof v === "string" && v.includes(REEMPLAZO))
    .map(([k]) => k);
}


export const ESTADOS = Object.freeze({
  ACTIVO: "activo",
  ARCHIVADO: "archivado",
  ELIMINADO: "eliminado"
});


/*
  Por defecto se listan solo los ACTIVOS. Archivados y eliminados
  se piden explicitamente.
*/
export async function listarProyectos(opciones = {}) {
  const estados = opciones.estados || [ESTADOS.ACTIVO];

  const entidades = await entidadesDe(CATALOGO);

  const proyectos = [];

  for (const e of entidades) {
    const p = await obtenerProyecto(e.entidad);

    if (!p) continue;

    /*
      Los proyectos creados antes de que existieran los estados no
      tienen campo `estado`: se tratan como activos, que es lo que
      eran.
    */
    const estado = p.estado || ESTADOS.ACTIVO;

    if (!estados.includes(estado)) continue;

    const corruptos = camposCorruptos(p);

    proyectos.push({
      ...p,
      estado,
      codificacionSospechosa: corruptos.length > 0,
      camposConCodificacionSospechosa: corruptos
    });
  }

  return proyectos.sort((a, b) =>
    String(b.creadoEn || "").localeCompare(String(a.creadoEn || ""))
  );
}


/*
===========================================================
CICLO DE VIDA DEL PROYECTO
===========================================================

Todo pasa por una version nueva en el Lake, que es append-only.
Nada se destruye: eliminar es marcar un estado, y el expediente
sigue ahi, recuperable.
===========================================================
*/

async function guardarProyecto(proyecto, paso) {
  const r = await escribirEnLake(
    {
      entidad: proyecto.id,
      tipoEntidad: TIPO_PROYECTO,
      tenantId: TENANT,
      proyectoId: CATALOGO,
      fuente: SUBMOTOR,
      linaje: linaje(paso),
      datos: proyecto
    },
    {}
  );

  return r?.escrito === true;
}


/*
  RENOMBRAR — solo el nombre visible.

  El id NO cambia, y no puede cambiar: es la clave con la que el
  Lake guarda candidatos, actores y expedientes. Cambiarlo
  desconectaria el proyecto de todo su contenido.
*/
export async function renombrarProyecto(proyectoId, nombreNuevo) {
  const proyecto = await obtenerProyecto(proyectoId);

  if (!proyecto) {
    return { renombrado: false, motivo: `no existe el proyecto ${proyectoId}` };
  }

  const nombre = String(nombreNuevo || "").trim();

  if (!nombre) {
    return { renombrado: false, motivo: "el nombre no puede quedar vacío" };
  }

  if (nombre === proyecto.nombre) {
    return { renombrado: false, motivo: "el nombre no cambió", proyecto };
  }

  const actualizado = {
    ...proyecto,

    nombre,

    /* Se conserva el anterior: el historial no se pierde. */
    nombreAnterior: proyecto.nombre,

    renombradoEn: new Date().toISOString()
  };

  const ok = await guardarProyecto(actualizado, "renombrar_proyecto");

  return {
    renombrado: ok,
    proyecto: actualizado,
    aviso:
      "Solo cambió el nombre visible. El identificador, el territorio, la dignidad, los candidatos y los expedientes siguen intactos."
  };
}


/*
  CAMBIAR ESTADO — archivar, recuperar o eliminar logicamente.
*/
export async function cambiarEstadoProyecto(proyectoId, estado) {
  if (!Object.values(ESTADOS).includes(estado)) {
    return { actualizado: false, motivo: `estado no válido: ${estado}` };
  }

  const proyecto = await obtenerProyecto(proyectoId);

  if (!proyecto) {
    return { actualizado: false, motivo: `no existe el proyecto ${proyectoId}` };
  }

  const anterior = proyecto.estado || ESTADOS.ACTIVO;

  const actualizado = {
    ...proyecto,

    estado,

    estadoAnterior: anterior,

    /* Sello del cambio, para poder auditar cuando ocurrio. */
    [estado === ESTADOS.ARCHIVADO
      ? "archivadoEn"
      : estado === ESTADOS.ELIMINADO
        ? "eliminadoEn"
        : "recuperadoEn"]: new Date().toISOString()
  };

  const ok = await guardarProyecto(actualizado, `estado_${estado}`);

  const avisos = {
    [ESTADOS.ARCHIVADO]:
      "Proyecto archivado. No aparece en la vista principal, y conserva candidatos, actores, expedientes y evidencias.",
    [ESTADOS.ELIMINADO]:
      "Proyecto eliminado de la vista. Es un borrado lógico: sus datos siguen conservados en el Knowledge Lake y se pueden recuperar.",
    [ESTADOS.ACTIVO]: "Proyecto recuperado. Vuelve a aparecer en Mis proyectos."
  };

  return { actualizado: ok, proyecto: actualizado, aviso: avisos[estado] };
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

  const corruptos = camposCorruptos(proyecto);

  return {
    proyecto: {
      ...proyecto,
      estado: proyecto.estado || ESTADOS.ACTIVO,
      codificacionSospechosa: corruptos.length > 0,
      camposConCodificacionSospechosa: corruptos
    },
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
    -----------------------------------------------------------
    ALIAS DECLARADOS POR EL ANALISTA
    -----------------------------------------------------------

    Otras formas de nombrar a la misma persona: «Jota Lloret»,
    «Paul Carrasco», el apodo con el que aparece en prensa.

    QUE HACEN Y QUE NO HACEN

    AMPLIAN el descubrimiento: generan consultas que el nombre
    principal solo no habria generado.

    NO deciden identidad. La atribucion sigue juzgandose contra
    el nombre principal, nunca contra el alias. Si un alias
    pudiera atribuir, el analista estaria dictando de quien es
    una cuenta con solo escribir una palabra, y Sentinel
    confirmaria su propia entrada. Ver la nota de la PASADA 3 en
    platformAdapters.

    Se admite un array o una cadena separada por comas, porque el
    formulario escribe una cosa y la API la otra.
  */
  const aliasEntrantes = (
    Array.isArray(datos.aliases)
      ? datos.aliases
      : String(datos.aliases || datos.alias || "").split(",")
  )
    .map((x) => String(x || "").trim())
    .filter(Boolean);

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

    /*
      Se ACUMULAN y se deduplican sin distinguir mayusculas ni
      acentos, igual que las cuentas de referencia: aportar uno
      nuevo no borra los anteriores, y escribir «Jota Lloret» dos
      veces no lo guarda dos veces.

      Nunca se guarda un alias igual al nombre principal: no
      aporta ninguna consulta nueva.
    */
    aliases: [
      ...(previo?.aliases || []),
      ...aliasEntrantes.map((valor) => ({
        valor,
        origen: "analista",
        declaradoEn: new Date().toISOString(),
        /*
          La misma marca que llevan las cuentas de referencia, y
          por el mismo motivo.
        */
        noCuentaComoCorroboracion: true
      }))
    ].filter((al, i, todas) => {
      const clave = normalizarTexto(al.valor);

      if (!clave || clave === normalizarTexto(nombre)) return false;

      return (
        todas.findIndex((x) => normalizarTexto(x.valor) === clave) === i
      );
    }),

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

/*
===========================================================
CONTRATO DE FULL DISCOVERY — ESTADO POR PLATAFORMA
===========================================================

Para cada una de las seis plataformas obligatorias el
expediente devuelve EXACTAMENTE UNO de estos cinco estados.

    ATRIBUIDA               hay una cuenta atribuida al objetivo
    ENCONTRADA_NO_ATRIBUIDA se hallaron candidatos, ninguno paso
    BUSCADA_SIN_RESULTADO   se consulto bien y no habia nada
    NO_EJECUTADA            no se lanzo ninguna consulta
    ERROR_PROVIDER          se intento y el proveedor no respondio

POR QUE CINCO Y NO DOS

Porque "no tiene cuenta" y "no pudimos mirar" son cosas
distintas, y colapsarlas convierte una limitacion nuestra en
una afirmacion sobre la persona. Sentinel no dice "no tiene red
social": dice que observo.

Las tres ultimas son las que el diagnostico del piloto no pudo
distinguir, porque el expediente no las guardaba.
===========================================================
*/

export const ESTADOS_PLATAFORMA = Object.freeze({
  ATRIBUIDA: "ATRIBUIDA",
  ENCONTRADA_NO_ATRIBUIDA: "ENCONTRADA_NO_ATRIBUIDA",
  BUSCADA_SIN_RESULTADO: "BUSCADA_SIN_RESULTADO",
  NO_EJECUTADA: "NO_EJECUTADA",
  ERROR_PROVIDER: "ERROR_PROVIDER"
});


/*
  Tope de candidatos sociales que se guardan por expediente.

  Existe para que un expediente no crezca sin limite en un Lake
  append-only. Cuando recorta, lo DICE: `candidatosTruncados`
  lleva la cuenta. Un recorte silencioso se leeria como "esto es
  todo lo que habia", que es justo el error que este patch
  corrige.
*/
const TOPE_CANDIDATOS = 120;

const TOPE_CONSULTAS = 60;


/*
  Clave estable plataforma+handle, para cruzar lo que descubrio
  el Discovery con el veredicto de la clasificacion.
*/
function claveCuenta(c) {
  const plataforma = c?.plataformaId || c?.platform || c?.plataforma || "";

  return `${normalizarTexto(String(plataforma))}:${normalizarTexto(
    String(c?.handle || "")
  )}`;
}


/*
-----------------------------------------------------------
CONSULTAS EJECUTADAS

Se juntan las que se LANZARON (`intentos`, con su proveedor y su
estado real) con las que se PLANIFICARON y nunca salieron. Las
segundas son la diferencia entre "no habia nada" y "no se
busco", y sin ellas el expediente no puede sostener el contrato
de arriba.
-----------------------------------------------------------
*/
function consultasDeLaInvestigacion(resultado) {
  const d = resultado?.social?.descubrimiento || {};

  const intentos = Array.isArray(d.intentos) ? d.intentos : [];

  const plan = Array.isArray(d.plan) ? d.plan : [];

  const lanzadas = intentos.map((i) => ({
    consulta: i.consulta,
    proposito: i.etiqueta || null,
    plataformaId: i.plataformaId || null,
    proveedor: i.proveedorUsado || null,
    ejecutada: true,
    estado: i.estado || null,
    resultados: Number.isFinite(i.resultados) ? i.resultados : null,
    coberturaParcial: i.coberturaParcial ?? null
  }));

  const consultadas = new Set(intentos.map((i) => normalizarTexto(i.consulta)));

  const noLanzadas = plan
    .filter((e) => !consultadas.has(normalizarTexto(e.consulta)))
    .map((e) => ({
      consulta: e.consulta,
      proposito: e.etiqueta || null,
      plataformaId: e.plataformaId || null,
      proveedor: null,
      ejecutada: false,
      estado: "NO_EJECUTADA",
      resultados: null,
      motivo:
        d.descubrimientoSocial?.motivoOmision ||
        "Planificada y no lanzada: sin proveedor utilizable o presupuesto agotado."
    }));

  return [...lanzadas, ...noLanzadas];
}


/*
-----------------------------------------------------------
COBERTURA NORMALIZADA POR PLATAFORMA

El Discovery ya calcula `estadoPresencia`. Aqui se traduce al
contrato de cinco estados, cruzandolo con si alguna cuenta de
esa plataforma llego a ATRIBUIRSE, que es lo que el
`estadoPresencia` por si solo no distingue.
-----------------------------------------------------------
*/
function coberturaNormalizada(resultado, consultas) {
  const cobertura = resultado?.social?.cobertura || [];

  const atribuidas = resultado?.perfilEjecutivo?.tarjetas || [];

  return cobertura.map((c) => {
    const deLaPlataforma = consultas.filter(
      (q) => q.plataformaId === c.plataformaId
    );

    const lanzadas = deLaPlataforma.filter((q) => q.ejecutada);

    const conExito = lanzadas.filter((q) => q.estado === "OK");

    const nAtribuidas = atribuidas.filter(
      (t) => (t.plataformaId || t.platform) === c.plataformaId
    ).length;

    let estado;

    if (nAtribuidas > 0) {
      estado = ESTADOS_PLATAFORMA.ATRIBUIDA;
    } else if ((c.candidatos || 0) > 0) {
      /*
        Se encontro algo y no paso el clasificador. Es el caso
        que interesa mirar: aqui vive la perdida, si la hay.
      */
      estado = ESTADOS_PLATAFORMA.ENCONTRADA_NO_ATRIBUIDA;
    } else if (conExito.length > 0) {
      estado = ESTADOS_PLATAFORMA.BUSCADA_SIN_RESULTADO;
    } else if (lanzadas.length > 0) {
      estado = ESTADOS_PLATAFORMA.ERROR_PROVIDER;
    } else {
      estado = ESTADOS_PLATAFORMA.NO_EJECUTADA;
    }

    return {
      plataformaId: c.plataformaId,
      plataforma: c.plataforma,
      estado,
      atribuidas: nAtribuidas,
      candidatos: c.candidatos || 0,
      consultasPlanificadas: deLaPlataforma.length,
      consultasLanzadas: lanzadas.length,
      consultasConExito: conExito.length,
      estadosDeProveedor: [
        ...new Set(lanzadas.map((q) => q.estado).filter(Boolean))
      ],
      /* El motivo que ya redactaba el Discovery, sin reescribirlo. */
      motivo: c.motivoCobertura || null,
      estadoPresencia: c.estadoPresencia || null,
      modoAccesoDeclarado: c.modoAccesoDeclarado || null
    };
  });
}


/*
-----------------------------------------------------------
CANDIDATOS SOCIALES, ACEPTADOS Y RECHAZADOS

Se cruza lo que el Discovery descubrio —que trae proveedor, via
y procedencia— con el veredicto de la clasificacion, que trae el
motivo. Ninguno de los dos lados solo alcanza: el Discovery no
sabe por que se rechazo, y la clasificacion no sabe quien lo
aporto.
-----------------------------------------------------------
*/
function candidatosSociales(resultado) {
  const pe = resultado?.perfilEjecutivo || null;

  const descubiertos = resultado?.social?.candidatos || [];

  /* Veredicto por clave, desde las listas ya normalizadas. */
  const veredicto = new Map();

  const registrar = (lista, aceptado, clase) => {
    (lista || []).forEach((c) => {
      veredicto.set(claveCuenta(c), {
        aceptado,
        clase,
        motivo: c.motivo || c.motivoClase || null,
        score: c.correspondencia ?? null,
        nivel: c.nivel || null
      });
    });
  };

  registrar(pe?.tarjetas, true, "cuenta_personal");
  registrar(pe?.medios, false, "medio");
  registrar(pe?.instituciones, false, "institucion");
  registrar(pe?.indeterminadas, false, "no_determinado");

  const filas = descubiertos.map((c) => {
    const v = veredicto.get(claveCuenta(c)) || null;

    return {
      plataforma: c.plataforma || null,
      plataformaId: c.plataformaId || null,
      url: c.url || null,
      handle: c.handle || null,
      displayName: c.nombreVisible || null,

      /* De donde salio. */
      vias: c.vias || [],
      viasDeclaradas: c.viasDeclaradas || [],
      origen: c.aportadaPorAnalista ? "analista" : "sentinel",
      aportadaPorAnalista: c.aportadaPorAnalista === true,
      proveedores: c.proveedores || [],
      consultas: [
        ...new Set(
          (c.origenes || []).map((o) => o.consulta).filter(Boolean)
        )
      ],

      /* Veredicto. */
      aceptado: v ? v.aceptado : false,
      clase: v ? v.clase : null,
      score: v ? v.score : null,
      nivelCorrespondencia: v ? v.nivel : null,
      motivo: v
        ? v.motivo
        : "No apareció en ninguna lista clasificada del perfil ejecutivo."
    };
  });

  /*
    URLs de plataforma que SD-1A descarto antes de llegar a ser
    candidatas: un post, un vídeo, una ruta sin propietario. Se
    guardan aparte porque su motivo es de otra naturaleza.
  */
  const descartadasPorUrl = (resultado?.social?.descubrimiento?.descartados || [])
    .map((d) => ({
      url: d.url || d.enlace || null,
      plataforma: d.plataforma?.nombre || d.plataforma || null,
      motivo: d.motivo || d.motivoDescarte || null,
      tipoUrl: d.tipo || null
    }));

  return { filas, descartadasPorUrl };
}


/*
-----------------------------------------------------------
CONSUMO OBSERVABLE POR PROVEEDOR

Consultas, no dinero. El coste monetario real no lo conoce el
sistema y no se inventa: se registra lo que si es observable
—intentos, exitos, bloqueos, errores y resultados— que es lo
que permite explicar despues por que una plataforma quedo sin
mirar.
-----------------------------------------------------------
*/
function consumoDeProveedores(resultado) {
  const r = resultado?.social?.descubrimiento?.proveedores || null;

  const lista = Array.isArray(r) ? r : r?.proveedores || [];

  return lista.map((p) => ({
    id: p.id || null,
    proveedor: p.nombre || null,
    consultasIntentadas: p.intentos ?? null,
    consultasCompletadas: p.exitos ?? null,
    bloqueos: p.bloqueos ?? null,
    errores: p.errores ?? null,
    noIntentadas: p.noIntentados ?? null,
    resultados: p.resultados ?? null,
    costeMonetario: null,
    notaDeCoste:
      "Consumo observable en consultas. El sistema no conoce el coste monetario y no lo estima."
  }));
}


function resumirExpediente(resultado) {
  const pe = resultado?.perfilEjecutivo || null;

  const f = resultado?.fichaObjetivo || null;

  const cl = resultado?.clasificacionCuentas || null;

  const clave = (c) =>
    `${c.plataformaId || c.platform}:${String(c.handle).toLowerCase()}`;

  /*
    -----------------------------------------------------------
    TRAZA DE AUDITORIA — BUG-12
    -----------------------------------------------------------

    El motor ya calculaba todo esto y se tiraba al persistir. Sin
    ello una investigacion no se puede diagnosticar despues: no
    habia forma de saber si una plataforma se busco y estaba
    vacia, o no se busco.

    No se recalcula nada aqui y no hay un segundo motor: se leen
    las estructuras que `descubrirCandidatos` y `perfilEjecutivo`
    ya devuelven, y se les da forma estable.

    No se guardan claves de API ni payloads de proveedor: solo
    consultas, estados y recuentos.
    -----------------------------------------------------------
  */
  const consultas = consultasDeLaInvestigacion(resultado);

  const cobertura = coberturaNormalizada(resultado, consultas);

  const { filas: sociales, descartadasPorUrl } = candidatosSociales(resultado);

  return {
    /*
      TRAZA. Va primero porque es lo que se mira cuando algo
      sale vacio.
    */
    traza: {
      version: "1.0",

      consultas: consultas.slice(0, TOPE_CONSULTAS),
      totalConsultas: consultas.length,
      consultasTruncadas: Math.max(0, consultas.length - TOPE_CONSULTAS),

      coberturaPlataformas: cobertura,

      candidatosSociales: sociales.slice(0, TOPE_CANDIDATOS),
      totalCandidatosSociales: sociales.length,
      candidatosTruncados: Math.max(0, sociales.length - TOPE_CANDIDATOS),

      urlsDescartadas: descartadasPorUrl.slice(0, TOPE_CANDIDATOS),
      totalUrlsDescartadas: descartadasPorUrl.length,

      proveedores: consumoDeProveedores(resultado),

      anclasUsadas: (resultado?.social?.descubrimiento?.anclasUsadas || []).map(
        (a) => a.termino || a
      ),

      aliasUsados: resultado?.social?.descubrimiento?.aliasUsados || [],

      advertencias: resultado?.social?.descubrimiento?.advertencias || [],

      contrato:
        "Cada plataforma declara uno de cinco estados. ATRIBUIDA, ENCONTRADA_NO_ATRIBUIDA, BUSCADA_SIN_RESULTADO, NO_EJECUTADA o ERROR_PROVIDER. Ninguno de ellos afirma que la persona no tenga cuenta."
    },

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
  ESTADOS,
  crearProyecto,
  obtenerProyecto,
  listarProyectos,
  contenidoDeProyecto,
  renombrarProyecto,
  cambiarEstadoProyecto,
  agregarCandidato,
  obtenerCandidato,
  agregarActor,
  obtenerActor,
  activarComparativo,
  registrarInvestigacion
};
