// apps/backend/services/projects/projectContext.js

import { normalizarTexto } from "../textUtils.js";

/*
===========================================================
CONTEXTO MAESTRO — ARQ-INV-002
===========================================================

Un proyecto declara el territorio y la dignidad en disputa. Ese
contexto lo fija el ANALISTA, no la evidencia, y por tanto no
puede ser desplazado por lo que devuelva un buscador.

EL FALLO QUE ESTO CIERRA
-----------------------------------------------------------

Auditado en el sprint anterior (AUD-001). Investigando a Pedro
Palacios, alcalde de Cuenca, el Perfil de Referencia derivó su
contexto de la semilla de noticias y le tocó una crónica de
ciclismo de Albacete sobre otro Pedro Palacios:

    rol      "juez"
    pais     null
    terminos btt · albacete · gemma · estreno · circuito

Las seis consultas salieron como

    site:facebook.com "Pedro Palacios" juez alcaldia

y sus cuentas reales —que existen y el clasificador reconoce sin
problema— nunca llegaron. Peor: el fallo es INTERMITENTE, porque
depende de qué noticias devuelva la semilla ese día.

CÓMO SE CIERRA
-----------------------------------------------------------

El contexto del proyecto entra como anclas de fuerza 20 o más.
`extraerAnclas` ordena por fuerza descendente, así que un término
derivado de evidencia —fuerza máxima 10— NO PUEDE desplazarlo.
No es una preferencia: es una imposibilidad estructural.

El orden entre las propias anclas del proyecto va de lo más
discriminante a lo más genérico, que es lo contrario del orden
administrativo:

    cantón     Cuenca      lo que de verdad discrimina
    dignidad   alcaldia    el cargo en disputa
    provincia  Azuay
    país       Ecuador     compartido por millones

La auditoría demostró que con "Cuenca" en la consulta las tres
cuentas de Palacios aparecen en el primer resultado. El cantón es
el ancla que faltaba.

LO QUE ESTE MÓDULO NO HACE
-----------------------------------------------------------

No declara que nadie sea candidato. El rol dentro del proyecto lo
escribe el analista y se guarda como suyo. Sentinel no inventa
candidaturas.
===========================================================
*/


export const DIGNIDADES = Object.freeze([
  "Alcaldía",
  "Prefectura",
  "Concejalía urbana",
  "Concejalía rural",
  "Junta parroquial",
  "Presidencia",
  "Vicepresidencia",
  "Asamblea nacional",
  "Asamblea provincial",
  "Parlamento andino",
  "Otra"
]);

export const TIPOS_ELECCION = Object.freeze([
  "Elección seccional",
  "Elección general",
  "Consulta popular",
  "Elección primaria",
  "Otra"
]);

export const ESTADOS_PROYECTO = Object.freeze([
  "activo",
  "pausado",
  "cerrado"
]);


/*
-----------------------------------------------------------
NIVELES DE ACTOR — ARQ-INV-003

El territorio del proyecto NO se aplica igual a todos.

Defecto medido en el QA anterior: Daniel Noboa, presidente, se
investigo dentro del proyecto de Cuenca y la consulta salio

    "Daniel Noboa" Cuenca presidencia

Funciono por la fuerza de su presencia, pero para una figura
nacional el canton no discrimina: DISTORSIONA. Buscar al
presidente de Ecuador acotado a un canton devuelve su relacion
con ese canton, no su perfil.

Asi que el ancla territorial depende del nivel:

  cantonal      canton      es lo que discrimina
  provincial    provincia
  nacional      pais        el canton quedaria fuera
  internacional ninguna     ni pais acota util

El nivel lo declara el analista. Sentinel no lo adivina.
-----------------------------------------------------------
*/

export const NIVELES = Object.freeze([
  "cantonal",
  "provincial",
  "nacional",
  "internacional"
]);

/*
  Un candidato a una dignidad local es cantonal por defecto; un
  actor sin nivel declarado se trata como cantonal solo si el
  proyecto es cantonal, porque es la lectura conservadora: acotar
  de mas se corrige mirando, inventar alcance no.
*/
export function nivelPorDefecto(dignidad) {
  const d = normalizarTexto(dignidad || "");

  if (!d) return "cantonal";

  if (/presidencia|vicepresidencia|asamblea nacional|parlamento/.test(d)) {
    return "nacional";
  }

  if (/prefectura|asamblea provincial/.test(d)) return "provincial";

  return "cantonal";
}


/*
-----------------------------------------------------------
FUERZAS DE ANCLA

Por encima de 10, que es el máximo que puede alcanzar un
término derivado de evidencia (contexto_rol). La separación no
es decorativa: es lo que hace imposible el desplazamiento.
-----------------------------------------------------------
*/

const FUERZA = Object.freeze({
  /*
    El territorio QUE CORRESPONDE AL NIVEL, y la dignidad. Solo
    estas dos superan el 10 que puede alcanzar un termino derivado
    de evidencia, asi que solo estas dos pueden ocupar las dos
    plazas que usa el planificador.
  */
  TERRITORIO_DEL_NIVEL: 24,
  DIGNIDAD: 22,

  /*
    El resto del territorio del proyecto queda declarado pero por
    debajo del umbral: informa al analista sin acotar la consulta.
  */
  RESPALDO: 6
});


/*
  De la dignidad se extrae su palabra clave, porque "Alcaldía de
  Cuenca" como término de búsqueda duplica el cantón y estrecha
  el resultado sin aportar.
*/
export function palabraDeDignidad(dignidad) {
  const t = normalizarTexto(dignidad || "");

  if (!t) return null;

  const conocidas = [
    "alcaldia",
    "prefectura",
    "concejalia",
    "presidencia",
    "vicepresidencia",
    "asamblea",
    "parlamento",
    "junta"
  ];

  const encontrada = conocidas.find((k) => t.includes(k));

  if (encontrada) return encontrada;

  /* Primera palabra significativa, si no es ninguna conocida. */
  return t.split(/\s+/).filter((p) => p.length >= 4)[0] || null;
}


/*
===========================================================
CONSTRUIR EL CONTEXTO MAESTRO DE UN PROYECTO
===========================================================
*/

export function construirContextoMaestro(proyecto, candidato = null) {
  if (!proyecto) return null;

  const anclas = [];

  const agregar = (valor, fuerza, origen) => {
    const v = String(valor || "").trim();

    if (!v) return;

    if (anclas.some((a) => normalizarTexto(a.termino) === normalizarTexto(v))) {
      return;
    }

    anclas.push({ termino: v, fuerza, origen });
  };

  /*
    ---------------------------------------------------------
    ANCLA TERRITORIAL SEGUN EL NIVEL DEL ACTOR
    ---------------------------------------------------------

    Solo el ancla que corresponde al nivel entra con fuerza de
    territorio. Las demas quedan por debajo, como respaldo, para
    que el planificador —que usa dos— no las tome.

    Ver la nota de NIVELES: acotar a un presidente por canton
    devuelve su relacion con ese canton, no su perfil.
  */
  const nivel =
    candidato?.nivel ||
    nivelPorDefecto(candidato?.dignidad || proyecto.dignidad);

  const territorioDelNivel = {
    cantonal: proyecto.canton,
    provincial: proyecto.provincia,
    nacional: proyecto.pais,
    internacional: null
  }[nivel];

  agregar(territorioDelNivel, FUERZA.TERRITORIO_DEL_NIVEL, `proyecto_${nivel}`);

  agregar(
    palabraDeDignidad(candidato?.dignidad || proyecto.dignidad),
    FUERZA.DIGNIDAD,
    "proyecto_dignidad"
  );

  /*
    Respaldo por debajo de 10 —el maximo de un termino derivado de
    evidencia— para que no compitan por las dos plazas del
    planificador pero queden declaradas.
  */
  [
    [proyecto.canton, "proyecto_canton"],
    [proyecto.provincia, "proyecto_provincia"],
    [proyecto.pais, "proyecto_pais"]
  ].forEach(([valor, origen]) => {
    agregar(valor, FUERZA.RESPALDO, origen);
  });

  return {
    version: "1.0",

    proyectoId: proyecto.id,
    proyectoNombre: proyecto.nombre,

    pais: proyecto.pais || null,
    provincia: proyecto.provincia || null,
    canton: proyecto.canton || null,
    dignidad: candidato?.dignidad || proyecto.dignidad || null,
    tipoEleccion: proyecto.tipoEleccion || null,

    /*
      El rol lo escribió el analista. Se conserva su procedencia
      para que nadie lo lea como una conclusión de Sentinel.
    */
    rolDeclarado: candidato?.rol || null,
    rolOrigen: candidato?.rol ? "analista" : null,

    nivel,

    /*
      DOS NIVELES DE ANALISIS para un actor cuyo alcance no
      coincide con el territorio del proyecto. No se mezclan: el
      perfil se construye en su propio ambito y la presencia
      territorial es un analisis aparte, que solo se calcula si el
      analista lo pide.
    */
    ambitoDelPerfil: territorioDelNivel || proyecto.pais || null,

    territorioDelProyecto: proyecto.canton || proyecto.provincia || null,

    requiereDosNiveles:
      nivel !== "cantonal" && Boolean(proyecto.canton),

    notaDeNivel:
      nivel === "cantonal"
        ? "Actor de alcance cantonal: el cantón del proyecto es su ancla principal."
        : `Actor de alcance ${nivel}: su perfil se construye en su propio ámbito, no acotado al cantón del proyecto. La presencia territorial, si se pide, es un análisis aparte.`,

    anclas,

    /* Explicabilidad: por qué manda este contexto. */
    prioridad:
      "El contexto del proyecto lo fija el analista y entra con fuerza superior a cualquier término derivado de evidencia. Una noticia de un homónimo no puede desplazarlo.",

    territorio: [proyecto.canton, proyecto.provincia, proyecto.pais]
      .filter(Boolean)
      .join(", ")
  };
}


/*
===========================================================
APLICAR EL CONTEXTO AL PERFIL DE REFERENCIA

No se reescribe el perfil: se le AÑADE el contexto maestro y se
conserva intacto lo que la evidencia derivó, para poder mostrar
ambos y explicar la diferencia.
===========================================================
*/

export function aplicarContextoMaestro(perfil, contextoMaestro) {
  if (!perfil || !contextoMaestro) return perfil;

  const derivado = {
    rol: perfil.contexto?.rol || null,
    pais: perfil.contexto?.pais || null
  };

  /*
    CONFLICTO DECLARADO, NO SILENCIADO.

    Si la evidencia derivó un país distinto al del proyecto, eso
    es exactamente el sintoma de contaminacion por homonimo. Se
    hace prevalecer el proyecto Y se declara el conflicto, porque
    ocultarlo dejaria al analista sin saber que ocurrio.
  */
  const conflictos = [];

  if (
    derivado.pais &&
    contextoMaestro.pais &&
    normalizarTexto(derivado.pais) !== normalizarTexto(contextoMaestro.pais)
  ) {
    conflictos.push({
      campo: "pais",
      derivadoDeEvidencia: derivado.pais,
      declaradoEnProyecto: contextoMaestro.pais,
      resolucion: "prevalece el proyecto",
      motivo:
        "Un país derivado de la evidencia que no coincide con el del proyecto suele venir de un homónimo extranjero."
    });
  }

  if (
    derivado.rol &&
    contextoMaestro.dignidad &&
    !normalizarTexto(contextoMaestro.dignidad).includes(
      normalizarTexto(derivado.rol)
    ) &&
    !normalizarTexto(derivado.rol).includes(
      normalizarTexto(palabraDeDignidad(contextoMaestro.dignidad) || " ")
    )
  ) {
    conflictos.push({
      campo: "rol",
      derivadoDeEvidencia: derivado.rol,
      declaradoEnProyecto: contextoMaestro.dignidad,
      resolucion: "prevalece el proyecto",
      motivo:
        "El rol derivado no corresponde con la dignidad en disputa declarada por el analista."
    });
  }

  return {
    ...perfil,

    /*
      El planificador lee este campo y sus anclas ganan por
      fuerza. Ver extraerAnclas.
    */
    contextoMaestro,

    contexto: {
      ...(perfil.contexto || {}),

      /* El proyecto manda sobre lo derivado. */
      pais: contextoMaestro.pais || perfil.contexto?.pais || null,

      /*
        El rol pasa a ser el declarado por el analista, y se
        conserva el derivado aparte para poder compararlos.
      */
      rol:
        contextoMaestro.rolDeclarado ||
        contextoMaestro.dignidad ||
        perfil.contexto?.rol ||
        null,

      rolOrigen: contextoMaestro.rolDeclarado ? "analista" : "evidencia",

      derivadoDeEvidencia: derivado,

      declaradoEnProyecto: {
        pais: contextoMaestro.pais,
        provincia: contextoMaestro.provincia,
        canton: contextoMaestro.canton,
        dignidad: contextoMaestro.dignidad
      },

      conflictos,

      /*
        "Contexto ambiguo" es una salida legitima del sistema, no
        un error que haya que esconder.
      */
      estado: conflictos.length ? "contexto_ambiguo" : "contexto_coherente"
    }
  };
}


export default {
  DIGNIDADES,
  TIPOS_ELECCION,
  ESTADOS_PROYECTO,
  NIVELES,
  nivelPorDefecto,
  construirContextoMaestro,
  aplicarContextoMaestro,
  palabraDeDignidad
};
