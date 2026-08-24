// apps/backend/services/geo/projectTerritoryBridge.js

import {
  resolverAmbito,
  unidadPorId,
  ancestrosDe
} from "./territoryRegistry.js";

/*
===========================================================
PUENTE PROYECTO -> TERRITORIO
===========================================================

Traduce un proyecto de ARQ-INV-002 —que declara pais,
provincia, canton y una lista de candidatos y actores— al
ambito y los actores que espera el motor territorial.

POR QUE ESTE ARCHIVO EXISTE, EN LUGAR DE HACERLO EN LA RUTA
-----------------------------------------------------------

Aislamiento deliberado. `projectStore.js` esta siendo
modificado en paralelo por otro trabajo (persistencia de
proyectos), y el motor territorial no debe quedar acoplado a
una firma en movimiento.

Todo el conocimiento sobre la FORMA de un proyecto vive aqui y
solo aqui. Si manana `obtenerProyecto` cambia de firma o el
objeto proyecto gana o pierde campos, se ajusta un archivo, no
seis.

La carga se hace con `import()` dinamico y dentro de try: si
el modulo de proyectos no estuviera disponible, el motor
territorial sigue funcionando con el territorio declarado a
mano en la peticion. Un modulo de inteligencia territorial que
se cae porque otro modulo esta a medias seria un mal diseno.

SOLO LECTURA
-----------------------------------------------------------

Este puente NO escribe en el almacen de proyectos, no crea
expedientes y no registra investigaciones. Lee y traduce.
===========================================================
*/


async function cargarAlmacen() {
  try {
    const modulo = await import("../projects/projectStore.js");

    return {
      disponible: true,
      obtenerProyecto: modulo.obtenerProyecto,
      contenidoDeProyecto: modulo.contenidoDeProyecto,
      motivo: null
    };
  } catch (error) {
    return {
      disponible: false,
      obtenerProyecto: null,
      contenidoDeProyecto: null,
      motivo: `El almacen de proyectos no esta disponible: ${
        error?.message || "error de carga"
      }.`
    };
  }
}


/*
===========================================================
CONTEXTO TERRITORIAL DE UN PROYECTO
===========================================================

Devuelve SIEMPRE la misma forma, exista el proyecto o no. El
llamante no tiene que distinguir entre "no hay proyecto" y
"hay proyecto sin territorio": ambos casos vienen declarados.
===========================================================
*/

export async function contextoTerritorialDeProyecto(proyectoId) {
  const vacio = (motivo) => ({
    proyectoId: proyectoId || null,
    proyecto: null,
    ambito: null,
    actores: [],
    disponible: false,
    motivo
  });

  if (!proyectoId) {
    return vacio(
      "No se indico proyecto. El territorio debe declararse en la peticion."
    );
  }

  const almacen = await cargarAlmacen();

  if (!almacen.disponible) return vacio(almacen.motivo);

  let contenido = null;

  try {
    contenido = almacen.contenidoDeProyecto
      ? await almacen.contenidoDeProyecto(proyectoId)
      : null;
  } catch (error) {
    return vacio(
      `Fallo al leer el proyecto ${proyectoId}: ${error?.message || "error"}.`
    );
  }

  const proyecto = contenido?.proyecto || null;

  if (!proyecto) return vacio(`No existe el proyecto ${proyectoId}.`);

  /*
    ---------------------------------------------------------
    AMBITO

    El territorio lo fijo el analista al crear el proyecto. Se
    traduce a una unidad del registro; si no se reconoce, se
    dice, y el motor trabajara sin desambiguacion por ambito.
    ---------------------------------------------------------
  */
  const resuelto = resolverAmbito({
    pais: proyecto.pais,
    provincia: proyecto.provincia,
    canton: proyecto.canton
  });

  /*
    ---------------------------------------------------------
    ACTORES

    Candidatos y actores de referencia del proyecto, con su
    procedencia conservada. Un actor de referencia NO es un
    candidato, y mezclarlos en un ranking territorial seria
    exactamente el cruce que el proyecto mantiene separado
    mediante `incluirEnComparativo`.
    ---------------------------------------------------------
  */
  const candidatos = (contenido.candidatos || []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    rol: c.rol || null,
    dignidad: c.dignidad || null,
    nivel: c.nivel || null,
    clase: "candidato",
    alias: []
  }));

  const actoresReferencia = (contenido.actores || [])
    /*
      Solo los que el analista activo para comparacion. La
      puerta ya existe en el modulo de proyectos y aqui se
      respeta en lugar de reabrirla.
    */
    .filter((a) => a.incluirEnComparativo === true)
    .map((a) => ({
      id: a.id,
      nombre: a.nombre,
      rol: a.rol || null,
      nivel: a.nivel || null,
      clase: "actor_referencia",
      alias: []
    }));

  const excluidos = (contenido.actores || []).filter(
    (a) => a.incluirEnComparativo !== true
  ).length;

  return {
    proyectoId,

    proyecto: {
      id: proyecto.id,
      nombre: proyecto.nombre,
      pais: proyecto.pais || null,
      provincia: proyecto.provincia || null,
      canton: proyecto.canton || null,
      dignidad: proyecto.dignidad || null,
      tipoEleccion: proyecto.tipoEleccion || null
    },

    ambito: resuelto.unidad
      ? construirAmbito(resuelto.unidad)
      : {
          unidadId: null,
          nombre:
            proyecto.canton || proyecto.provincia || proyecto.pais || null,
          resolucion: null,
          reconocido: false,

          /*
            Aunque la unidad no se reconozca, el analista SI
            declaro provincia y pais. Se conservan como anclas:
            son lo que impide que una consulta de "Cuenca"
            traiga Cuenca de Espana.
          */
          ancestros: [proyecto.provincia, proyecto.pais].filter(Boolean),

          motivo: resuelto.motivo
        },

    actores: [...candidatos, ...actoresReferencia],

    disponible: true,

    motivo: null,

    declaracion: [
      `Territorio y actores tomados del proyecto "${proyecto.nombre}", declarados por el analista.`,

      excluidos
        ? `${excluidos} actor(es) de referencia excluidos: su analisis comparativo esta desactivado y no deben influir en ninguna metrica del proyecto.`
        : null,

      !resuelto.unidad
        ? `El territorio del proyecto no corresponde a ninguna unidad del registro cargado. ${resuelto.motivo}`
        : null
    ].filter(Boolean)
  };
}


/*
===========================================================
AMBITO DESDE UNA PETICION SUELTA

Para usar el motor sin proyecto: el analista declara el
territorio en el cuerpo de la peticion.
===========================================================
*/

/*
-----------------------------------------------------------
FORMA CANONICA DEL AMBITO

`ancestros` NO es decoracion: son las anclas territoriales que
el planificador de consultas mete en cada busqueda, de la mas
discriminante a la mas generica.

Sin ellas, "Cuenca" a secas devuelve Cuenca de Espana. Medido.
Es la misma jerarquia de anclas que projectContext.js aplica a
la investigacion individual: canton, luego provincia, luego
pais.
-----------------------------------------------------------
*/

function construirAmbito(unidad) {
  return {
    unidadId: unidad.id,
    nombre: unidad.nombre,
    resolucion: unidad.resolucion,
    reconocido: true,
    alias: unidad.alias || [],
    ancestros: ancestrosDe(unidad.id).map((a) => a.nombre),
    motivo: null
  };
}


export function ambitoDeclarado({ unidadId, pais, provincia, canton } = {}) {
  if (unidadId) {
    const u = unidadPorId(unidadId);

    if (u) return construirAmbito(u);

    return {
      unidadId: null,
      nombre: null,
      resolucion: null,
      reconocido: false,
      ancestros: [],
      motivo: `La unidad "${unidadId}" no existe en el registro territorial.`
    };
  }

  const r = resolverAmbito({ pais, provincia, canton });

  if (r.unidad) return construirAmbito(r.unidad);

  /*
    Sin unidad reconocida se conservan igualmente las anclas que
    declaro el analista. Son texto libre, pero son SUYAS, y sin
    ellas la consulta saldria sin acotar.
  */
  return {
    unidadId: null,
    nombre: canton || provincia || pais || null,
    resolucion: null,
    reconocido: false,
    alias: [],
    ancestros: canton
      ? [provincia, pais].filter(Boolean)
      : provincia
        ? [pais].filter(Boolean)
        : [],
    motivo: r.motivo
  };
}


export default { contextoTerritorialDeProyecto, ambitoDeclarado };
