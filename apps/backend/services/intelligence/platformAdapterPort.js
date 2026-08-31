// apps/backend/services/intelligence/platformAdapterPort.js

/*
===========================================================
PUERTO DE ADAPTADORES DE PLATAFORMA — P-CAND-02
===========================================================

POR QUE ESTO ES UN PUERTO Y NO UN ADAPTADOR

Durante la auditoria de este gate aparecio que la linea de
ingesta YA tiene un adaptador completo de YouTube Data API v3:
endpoints, coste en unidades, estado SIN_CREDENCIAL,
normalizacion de video y de canal. Escribir otro habria sido
exactamente lo que este gate prohibe.

Ese adaptador es trabajo de otra linea. Cuando se decidio esta
arquitectura todavia no estaba commiteado, asi que importarlo de
forma rigida habria dejado Candidate Intelligence dependiendo de
un fichero ausente del arbol de git. Ya esta integrado, y la
decision se mantiene: un puerto sobrevive a que esa rama cambie
de forma.

La solucion es la misma que ya usa toda la plataforma con las
credenciales: se declara lo que se NECESITA, se intenta resolver
lo que HAY, y la ausencia se declara en lugar de romper.

    adaptador presente   → se usa el suyo
    adaptador ausente    → ADAPTADOR_NO_DISPONIBLE, con motivo

Asi Candidate Intelligence puede pedir metricas reales el dia
que la credencial y el adaptador esten en su sitio, sin que
ninguno de los dos modulos tenga que conocer al otro.

    NO se copia su codigo.
    NO se le anade nada a su fichero.
    NO se inventan cuotas ni precios.
===========================================================
*/

import { capacidadDe, CAPACIDADES } from "./accountContracts.js";


export const ESTADOS_ADAPTADOR = Object.freeze({
  /* Adaptador presente y con credencial: se puede pedir. */
  LISTO: "LISTO",

  /* Adaptador presente, sin credencial. */
  SIN_CREDENCIAL: "SIN_CREDENCIAL",

  /* No hay adaptador para esta plataforma. */
  ADAPTADOR_NO_DISPONIBLE: "ADAPTADOR_NO_DISPONIBLE",

  /*
    Hay adaptador y credencial, pero le falta la capacidad
    concreta que Candidate Intelligence necesita.
  */
  CAPACIDAD_INCOMPLETA: "CAPACIDAD_INCOMPLETA",

  /* La plataforma no admite lectura. */
  NO_APLICABLE: "NO_APLICABLE"
});


/*
-----------------------------------------------------------
LO QUE CANDIDATE INTELLIGENCE NECESITA DE UN ADAPTADOR

Este es el contrato, escrito desde el lado del consumidor. Un
adaptador que cumpla estas cuatro capacidades sirve; el que
cumpla tres, sirve para tres cosas y se dice cual falta.
-----------------------------------------------------------
*/
export const CAPACIDADES_REQUERIDAS = Object.freeze([
  {
    id: "metadatos_de_cuenta",
    nombre: "Metadatos de la cuenta",
    para: "identificar la cuenta y leer sus cifras de perfil",
    campos: ["displayName", "handle", "url", "publishedAt"]
  },
  {
    id: "estadisticas_de_cuenta",
    nombre: "Estadisticas publicas de la cuenta",
    para: "snapshots de seguidores o suscriptores",
    campos: ["subscribers", "videoCount", "viewCount"]
  },
  {
    id: "listado_de_publicaciones",
    nombre: "Listado de publicaciones de la cuenta",
    para: "serie de publicaciones propias y actividad real",
    campos: ["canonicalUrl", "publishedAt", "title"]
  },
  {
    id: "estadisticas_de_publicacion",
    nombre: "Estadisticas publicas por publicacion",
    para: "rendimiento absoluto y velocidad de una publicacion concreta",
    campos: ["views", "likes", "comments"]
  }
]);


/*
  Adaptadores conocidos, por plataforma. La ruta se resuelve en
  caliente: si el fichero no esta, se declara y no se rompe.
*/
const RUTAS_CONOCIDAS = Object.freeze({
  youtube: "../ingest/adapters/youtubeAdapter.js",
  x: "../ingest/adapters/xAdapter.js",

  /*
    Registrado en P-CAND-SOCIAL-COVERAGE-01, cuando Instagram
    dejo de ser una via documentada y paso a ser una medida.
  */
  instagram: "../ingest/adapters/instagramAdapter.js"
});


/*
  Cada adapter nombra sus funciones segun su plataforma
  —`resolverCanalPorHandle` en YouTube, `resolverCuentaPorHandle`
  en X— porque un canal y una cuenta no son lo mismo. El puerto
  traduce: aqui se declara QUE funcion sirve cada capacidad, en
  lugar de exigir que todos los adapters usen el mismo nombre.
*/
const FUNCIONES_POR_CAPACIDAD = Object.freeze({
  youtube: {
    metadatos_de_cuenta: ["resolverCanales", "resolverCanalPorHandle"],
    estadisticas_de_cuenta: ["resolverCanales", "resolverCanalPorHandle"],
    listado_de_publicaciones: ["listarSubidas", "buscar"],
    estadisticas_de_publicacion: ["resolverVideos", "estadisticasDeVideos"]
  },

  x: {
    metadatos_de_cuenta: ["resolverCuentaPorHandle"],
    estadisticas_de_cuenta: ["resolverCuentaPorHandle"],
    listado_de_publicaciones: ["listarPublicaciones"],

    /*
      En X las metricas vienen EN el propio post: no hay una
      segunda llamada como `videos.list`. La capacidad la cumple
      la misma funcion que lista, y eso es una diferencia real
      entre plataformas que el puerto tiene que poder expresar.
    */
    estadisticas_de_publicacion: ["listarPublicaciones"],

    menciones: ["buscarMenciones"]
  },

  /*
    Instagram es el caso mas extremo de lo que este mapa
    resuelve: UNA sola funcion cumple las cuatro capacidades,
    porque `business_discovery` devuelve identidad, estadisticas
    de cuenta, muestra de publicaciones y metricas de cada una
    en la misma respuesta.

    Meta permite anidar la muestra dentro del propio `fields`,
    asi que pedirlas por separado gastaria mas sin obtener nada
    distinto.
  */
  instagram: {
    metadatos_de_cuenta: ["descubrirCuentaProfesional"],
    estadisticas_de_cuenta: ["descubrirCuentaProfesional"],
    listado_de_publicaciones: ["descubrirCuentaProfesional"],
    estadisticas_de_publicacion: ["descubrirCuentaProfesional"]
  }
});


/*
===========================================================
RESOLVER UN ADAPTADOR

Import dinamico dentro de try. Un fallo de resolucion es un
resultado valido de esta funcion, no una excepcion.
===========================================================
*/
export async function resolverAdaptador(plataformaId, opciones = {}) {
  const cap = capacidadDe(plataformaId);

  const base = {
    plataformaId,
    plataforma: cap.plataforma,
    capacidadDeclarada: cap.capacidad
  };

  if (
    cap.capacidad === CAPACIDADES.BLOCKED ||
    cap.capacidad === CAPACIDADES.UNSUPPORTED
  ) {
    return {
      ...base,
      estado: ESTADOS_ADAPTADOR.NO_APLICABLE,
      adaptador: null,
      motivo: cap.motivo
    };
  }

  const ruta = opciones.ruta || RUTAS_CONOCIDAS[plataformaId] || null;

  if (!ruta) {
    return {
      ...base,
      estado: ESTADOS_ADAPTADOR.ADAPTADOR_NO_DISPONIBLE,
      adaptador: null,
      motivo: `no hay ningun adaptador registrado para ${plataformaId}`
    };
  }

  let modulo = null;

  try {
    modulo = await import(ruta);
  } catch (e) {
    return {
      ...base,
      estado: ESTADOS_ADAPTADOR.ADAPTADOR_NO_DISPONIBLE,
      adaptador: null,
      ruta,
      motivo: `el adaptador no se pudo cargar desde ${ruta}: ${e?.message || "modulo ausente"}. Candidate Intelligence sigue funcionando sin el.`
    };
  }

  const configurado =
    typeof modulo.estaConfigurado === "function"
      ? modulo.estaConfigurado() === true
      : null;

  /*
    Se comprueba por la presencia de la funcion que sirve cada
    capacidad, con los nombres que declara esta plataforma. No se
    supone: se mira.

    En YouTube las estadisticas por publicacion salen de
    `videos.list?part=statistics`, una llamada distinta de la
    busqueda —`search` no devuelve cifras—; en X vienen en el
    propio post. Son dos formas distintas de cumplir la misma
    capacidad, y el mapa las expresa.
  */
  const mapa = FUNCIONES_POR_CAPACIDAD[plataformaId] || {};

  const cumple = Object.fromEntries(
    CAPACIDADES_REQUERIDAS.map((cap) => [
      cap.id,
      (mapa[cap.id] || []).some((fn) => typeof modulo[fn] === "function")
    ])
  );

  const faltantes = CAPACIDADES_REQUERIDAS.filter((c) => !cumple[c.id]);

  const estado = !configurado
    ? ESTADOS_ADAPTADOR.SIN_CREDENCIAL
    : faltantes.length
      ? ESTADOS_ADAPTADOR.CAPACIDAD_INCOMPLETA
      : ESTADOS_ADAPTADOR.LISTO;

  return {
    ...base,

    estado,

    adaptador: {
      id: modulo.ID || plataformaId,
      nombre: modulo.NOMBRE || null,
      ruta
    },

    credencialConfigurada: configurado,

    capacidades: cumple,

    capacidadesFaltantes: faltantes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      para: c.para
    })),

    /*
      Coste y cuota tal como los DECLARA el propio adaptador. No
      se copian a mano ni se estiman: si el adaptador no los
      declara, quedan en null.
    */
    costeDeclarado: modulo.COSTE_UNIDADES || null,
    cuotaDeclarada: modulo.CUOTA_DIARIA_GRATUITA ?? null,

    diagnosticoDelAdaptador:
      typeof modulo.diagnostico === "function" ? modulo.diagnostico() : null,

    motivo:
      estado === ESTADOS_ADAPTADOR.SIN_CREDENCIAL
        ? "el adaptador esta completo y falta la credencial. Sin ella no se invoca y Sentinel sigue funcionando."
        : estado === ESTADOS_ADAPTADOR.CAPACIDAD_INCOMPLETA
          ? `falta la capacidad: ${faltantes.map((c) => c.nombre).join(", ")}`
          : null
  };
}


/*
===========================================================
ESTADO DE PREPARACION PARA OBSERVACION REAL

Lo que hay que mirar antes de gastar la primera unidad de
cuota. Devuelve, por plataforma, si se puede pedir y que falta.
===========================================================
*/
export async function preparacionParaObservacionReal(plataformas = ["youtube"]) {
  const resultados = [];

  for (const p of plataformas) {
    resultados.push(await resolverAdaptador(p));
  }

  const listas = resultados.filter(
    (r) => r.estado === ESTADOS_ADAPTADOR.LISTO
  );

  const esperandoCredencial = resultados.filter(
    (r) => r.estado === ESTADOS_ADAPTADOR.SIN_CREDENCIAL
  );

  return {
    plataformas: resultados,

    listas: listas.length,
    esperandoCredencial: esperandoCredencial.length,

    puedeObservarAlgo: listas.length > 0,

    /*
      Lo que hace falta de una persona. Se enumera aqui para que
      la interfaz pueda pedirlo sin que nadie tenga que
      adivinarlo.
    */
    accionRequerida: esperandoCredencial.map((r) => ({
      plataformaId: r.plataformaId,
      variable: variableDe(r.plataformaId),
      motivo: r.motivo,
      cuotaDeclarada: r.cuotaDeclarada,
      costeDeclarado: r.costeDeclarado
    })),

    nota:
      "Ninguna cuota se consume al comprobar esto: solo se mira si el adaptador existe y si la variable de entorno esta definida. La primera peticion real la decide una persona."
  };
}


function variableDe(plataformaId) {
  const v = { youtube: "YOUTUBE_API_KEY", x: "X_BEARER_TOKEN" };

  return v[plataformaId] || null;
}


export default {
  ESTADOS_ADAPTADOR,
  CAPACIDADES_REQUERIDAS,
  resolverAdaptador,
  preparacionParaObservacionReal
};
