// apps/backend/services/media/mediaCorpus.js

import { abrirLake } from "../knowledgeLake/lakeQuery.js";

import { normalizarUrl, extraerDominio } from "../textUtils.js";

import { ventanaDeDias, ZONA_POR_DEFECTO } from "../territorial/dayWindow.js";

import { identificarFuente } from "../conversation/mediaRegistry.js";

import { CLASES_EMISOR } from "./pieceContracts.js";

import {
  ESTADOS_DATO,
  VENTANAS_HOME,
  VENTANA_POR_DEFECTO,
  grupoDeClase,
  esHostDeInfraestructura,
  etiquetaDeClase
} from "./mediaVocabulary.js";

/*
===========================================================
MEDIA-UX-HOME-01 — CORPUS DE UN PROYECTO
===========================================================

Lee del Knowledge Lake las filas que la linea de Media ya
escribe y las devuelve como un corpus del PROYECTO. No llama a
ningun proveedor, no consume cuota y no escribe nada.

POR QUE NO SE USA `obtenerEventosProyecto`
-----------------------------------------------------------

Existe y hace casi esto, pero su proyeccion DESCARTA `datos`, y
`datos` es donde vive todo lo de Media: la clase del emisor, el
rol de amplificacion, las metricas del snapshot y el objetivo de
cada relacion. Ampliar esa proyeccion habria tocado un fichero
compartido con Candidate y Territorial.

Asi que se usa la misma pareja que ella usa por dentro
—`indice.buscar("proyecto", id)` mas `lector.aplicarFiltros`—
que devuelve el registro completo. Cero ficheros compartidos
modificados.

LOS TRES CONTROLES QUE SOSTIENEN LAS CIFRAS
-----------------------------------------------------------

1 · AISLAMIENTO POR PROYECTO. El Lake real contiene hoy filas
    de tres proyectos distintos, dos de ellos de pruebas. Una
    HOME que sumara todo mostraria piezas inventadas en un
    panel de campana. El filtro es por `proyectoId` y el
    recuento de lo que quedo fuera VIAJA en la respuesta, para
    que el aislamiento sea auditable y no una promesa.

2 · SOLO LA VERSION VIGENTE. El Lake es append-only y versiona:
    la pieza de X se ha reanalizado cuatro veces, asi que sus
    filas estan cuatro veces. Contarlas todas convertiria
    «volver a mirar» en «mas presencia», que es exactamente el
    error que un ranking no puede permitirse. Se cuenta una
    entidad, no una fila.

3 · CLAVE NORMALIZADA. La misma pieza se guardo bajo dos claves
    —`https://x.com/...` y `x.com/...`— por el defecto que
    MEDIA-REAL-DEMO-01 corrigio. La fila antigua no se borra,
    porque el Lake es append-only; se COLAPSA al leer,
    normalizando la clave, y el numero de colapsos se declara.

LA FECHA QUE NO SE ADIVINA
-----------------------------------------------------------

Las piezas de amplificacion llegan de un buscador y su fecha
puede venir como «3 jul 2026». Eso no es una fecha ISO y no se
interpreta: `new Date("3 jul 2026")` es invalida en JS, y un
parser de meses en espanol situaria la pieza en una ventana que
nadie observo. Se marca FECHA_NO_NORMALIZADA y se cuenta.

Tampoco se usa la fecha de DETECCION como sustituta de la de
publicacion. Una nota de 2023 detectada hoy caeria en la
ventana HOY, y HOY dejaria de significar nada.
===========================================================
*/

export const SUBMOTOR_MEDIA = "media_piece";

export const TENANT_POR_DEFECTO = "sentinel-local";


/*
-----------------------------------------------------------
FECHA ESTRICTAMENTE ISO-8601

Deliberadamente restrictivo. `Date.parse` acepta formatos
dependientes del motor y devuelve fechas plausibles para
entradas que no lo son; ese es el camino corto a una serie
temporal falsa.
-----------------------------------------------------------
*/
const PATRON_ISO =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;


export function instanteIso(valor) {
  const texto = String(valor ?? "").trim();

  if (!texto || !PATRON_ISO.test(texto)) return null;

  const t = new Date(texto).getTime();

  if (Number.isNaN(t)) return null;

  return new Date(t).toISOString();
}


/*
  Clave estable de una pieza. Se aplica la MISMA normalizacion
  que `pieceStore` usa al escribir, para que leer y escribir no
  puedan divergir.
*/
export function clavePieza(entidadOUrl) {
  const bruta = String(entidadOUrl || "");

  return normalizarUrl(bruta) || bruta.toLowerCase();
}


function dominioDe(registro, entidad) {
  return (
    registro?.fuente ||
    extraerDominio(registro?.urlCanonica || entidad || "") ||
    null
  );
}


/*
  Orden de especificidad de una clase de emisor. Sirve para
  elegir la clase de una FUENTE que aparece en varias piezas.

  NO es una escala de calidad y no asciende nada: solo dice que
  «MEDIO» aporta mas informacion que «NO_CLASIFICADO». Si dos
  piezas de la misma fuente afirman clases determinadas
  distintas, no se elige: se declara el conflicto.
*/
const CLASES_DETERMINADAS = [
  CLASES_EMISOR.MEDIO,
  CLASES_EMISOR.PERIODISTA,
  CLASES_EMISOR.CREADOR,
  CLASES_EMISOR.INSTITUCIONAL,
  CLASES_EMISOR.COMUNIDAD,
  CLASES_EMISOR.PLATAFORMA,
  CLASES_EMISOR.OTRO
];


function esDeterminada(clase) {
  return CLASES_DETERMINADAS.includes(clase);
}


/*
===========================================================
LEER EL CORPUS
===========================================================
*/
export async function leerCorpusDeProyecto(opciones = {}) {
  const projectId = String(opciones.projectId || "").trim();

  const tenantId = opciones.tenantId || TENANT_POR_DEFECTO;

  if (!projectId) {
    return {
      ok: false,
      motivo:
        "Falta projectId. Media Intelligence no existe fuera de un proyecto: sin el, el corpus mezclaria proyectos.",
      estado: ESTADOS_DATO.NO_DISPONIBLE
    };
  }

  let lake;

  try {
    lake = await abrirLake(opciones.lake || {});
  } catch (error) {
    return {
      ok: false,
      motivo: `No se pudo abrir el Knowledge Lake: ${error?.message || "error desconocido"}.`,
      estado: ESTADOS_DATO.NO_DISPONIBLE
    };
  }

  /*
    -----------------------------------------------------------
    AISLAMIENTO, MEDIDO ANTES DE FILTRAR

    Se cuenta cuanto Media hay en TODO el Lake y de que
    proyectos, para poder declarar cuanto se dejo fuera. Sin
    este recuento, «7 piezas» no se distingue de «7 piezas de
    las 16 que hay, y las otras 9 son de dos proyectos de
    prueba».
    -----------------------------------------------------------
  */
  const todasLasDeMedia = lake.indice
    .todos()
    .filter((r) => r?.linaje?.submotor === SUBMOTOR_MEDIA);

  const proyectosEnLake = [
    ...new Set(todasLasDeMedia.map((r) => r.proyectoId).filter(Boolean))
  ].sort();

  const filasDeOtrosProyectos = todasLasDeMedia.filter(
    (r) => r.proyectoId !== projectId
  ).length;

  /*
    -----------------------------------------------------------
    EL CORPUS DEL PROYECTO, SOLO VERSIONES VIGENTES
    -----------------------------------------------------------
  */
  const delProyecto = lake.indice.buscar("proyecto", projectId);

  const vigentes = lake.lector
    .aplicarFiltros(delProyecto, { tenantId, soloVigentes: true })
    .filter((r) => r?.linaje?.submotor === SUBMOTOR_MEDIA);

  const filasDelProyecto = delProyecto.filter(
    (r) => r?.linaje?.submotor === SUBMOTOR_MEDIA
  ).length;

  const porClase = (clase) =>
    vigentes.filter((r) => r?.datos?.clase === clase);

  /*
    -----------------------------------------------------------
    PIEZAS ANALIZADAS

    Se colapsan por clave normalizada. Al colapsar se conserva
    la fila mas reciente, que es la que trae el emisor ya
    resuelto por la API.
    -----------------------------------------------------------
  */
  const mapaPiezas = new Map();

  let clavesColapsadas = 0;

  porClase("pieza").forEach((r) => {
    const clave = clavePieza(r.entidad);

    const anterior = mapaPiezas.get(clave);

    if (anterior) {
      clavesColapsadas += 1;

      const masReciente =
        String(r.fechaDeteccion || "") > String(anterior.registro.fechaDeteccion || "");

      if (!masReciente) return;
    }

    mapaPiezas.set(clave, { clave, registro: r });
  });

  const piezas = [...mapaPiezas.values()].map(({ clave, registro }) =>
    normalizarPieza(registro, clave, "ANALIZADA")
  );

  /*
    -----------------------------------------------------------
    PIEZAS DE AMPLIFICACION

    Misma normalizacion de clave. Una pieza ajena que aparezca
    en la amplificacion de dos analisis distintos es UNA pieza.
    -----------------------------------------------------------
  */
  const mapaAmplificacion = new Map();

  porClase("pieza_amplificacion").forEach((r) => {
    const clave = clavePieza(r.entidad);

    if (mapaAmplificacion.has(clave)) {
      clavesColapsadas += 1;

      return;
    }

    mapaAmplificacion.set(clave, normalizarPieza(r, clave, "RELACIONADA"));
  });

  const amplificacion = [...mapaAmplificacion.values()];

  /*
    -----------------------------------------------------------
    RELACIONES FUENTE -> CANDIDATO
    -----------------------------------------------------------
  */
  const relaciones = porClase("relacion").map((r) => ({
    relationId: r.datos?.relationId || r.entidad,
    source: r.datos?.source || null,
    target: r.datos?.target || null,
    tipo: r.datos?.tipo || null,
    timestamp: instanteIso(r.datos?.timestamp),
    timestampBruto: r.datos?.timestamp || null,
    evidenceIds: r.datos?.evidenceIds || [],
    provenance: r.datos?.provenance || null,

    /*
      Se arrastra tal cual. Es la frase que impide leer una
      arista como una alianza, y tiene que llegar a la UI.
    */
    advertencia: r.datos?.advertencia || null,

    observadaEn: r.fechaDeteccion || null
  }));

  /*
    -----------------------------------------------------------
    SNAPSHOTS DE METRICAS
    -----------------------------------------------------------
  */
  const snapshots = porClase("snapshot").map((r) => ({
    snapshotId: r.datos?.snapshotId || null,
    pieceId: r.datos?.pieceId || null,
    canonicalUrl: r.datos?.canonicalUrl || null,
    claveNormalizada: clavePieza(r.datos?.canonicalUrl || ""),
    plataforma: r.datos?.plataforma || null,
    candidateId: r.datos?.candidateId || null,
    observedAt: instanteIso(r.datos?.observedAt),
    metricas: r.datos?.metricas || {},
    cuota: r.datos?.cuota || null
  }));

  const emisoresPersistidos = porClase("emisor").map((r) => ({
    dominio: r.entidad,
    claseEmisor: r.datos?.claseEmisor || null,
    nombre: r.datos?.nombre || null,
    procedencia: r.datos?.procedencia || null,
    observadoEn: r.fechaDeteccion || null
  }));

  const sinFechaNormalizada = [...piezas, ...amplificacion].filter(
    (p) => p.publishedAt === null
  ).length;

  return {
    ok: true,

    projectId,
    tenantId,

    piezas,
    amplificacion,
    relaciones,
    snapshots,
    emisoresPersistidos,

    /* Fuentes construidas a partir de todo lo anterior. */
    fuentes: construirFuentes({ piezas, amplificacion, relaciones }),

    lectura: {
      filasDelProyecto,
      entidadesVigentes: vigentes.length,
      clavesColapsadas,
      registrosEnLake: lake.indice.todos().length,

      declaracion:
        `Se leyeron ${vigentes.length} entidades vigentes de ${filasDelProyecto} filas de Media del proyecto. ` +
        "Una entidad reanalizada produce filas nuevas y sigue siendo una entidad: reanalizar no aumenta la presencia."
    },

    aislamiento: {
      projectId,
      proyectosDeMediaEnLake: proyectosEnLake,
      filasDeOtrosProyectosExcluidas: filasDeOtrosProyectos,

      declaracion:
        filasDeOtrosProyectos > 0
          ? `Excluidas ${filasDeOtrosProyectos} fila(s) de Media pertenecientes a otro(s) proyecto(s): ${proyectosEnLake
              .filter((p) => p !== projectId)
              .join(", ")}. Ninguna cifra de esta vista procede de ellas.`
          : "No hay filas de Media de otros proyectos en el Lake. El corpus es integramente de este proyecto."
    },

    fechas: {
      piezasSinFechaNormalizada: sinFechaNormalizada,
      estado:
        sinFechaNormalizada > 0
          ? ESTADOS_DATO.FECHA_NO_NORMALIZADA
          : null,

      declaracion:
        sinFechaNormalizada > 0
          ? `${sinFechaNormalizada} pieza(s) no tienen fecha de publicacion en formato ISO-8601. No se interpretan y quedan fuera de toda ventana temporal: adivinarlas las situaria en un periodo que nadie observo.`
          : "Todas las piezas del corpus tienen fecha de publicacion normalizada."
    }
  };
}


/*
-----------------------------------------------------------
NORMALIZAR UNA PIEZA
-----------------------------------------------------------
*/
function normalizarPieza(registro, clave, origen) {
  const d = registro?.datos || {};

  const emisor = d.emisor || null;

  const publishedAtBruto = registro?.fechaHecho ?? null;

  return {
    clave,
    origen,

    pieceId: d.pieceId || d.evidenceId || null,
    evidenceId: d.evidenceId || null,
    canonicalUrl: registro?.urlCanonica || clave,
    urlOriginal: registro?.urlOriginal || null,

    plataforma: d.plataforma || registro?.plataforma || null,
    contentType: d.contentType || null,

    titulo: d.titulo || registro?.titulo || null,
    autor: d.autor || null,

    dominio: dominioDe(registro, registro?.entidad),

    emisor,
    claseEmisor: emisor?.clase || CLASES_EMISOR.NO_DETERMINADO,
    grupoFuente: grupoDeClase(emisor?.clase),
    nombreEmisor: emisor?.nombre || null,

    /*
      Solo la amplificacion tiene rol. En una pieza analizada es
      null y no «ORIGINAL»: la pieza analizada no compite con su
      propia amplificacion.
    */
    rol: origen === "RELACIONADA" ? d.rol || null : null,
    piezaOrigen: d.piezaOrigen || null,

    publishedAt: instanteIso(publishedAtBruto),
    publishedAtBruto,

    fechaPublicacionEstado:
      publishedAtBruto === null
        ? ESTADOS_DATO.SIN_EVIDENCIA
        : instanteIso(publishedAtBruto)
          ? null
          : ESTADOS_DATO.FECHA_NO_NORMALIZADA,

    observedAt: registro?.fechaDeteccion || null
  };
}


/*
===========================================================
FUENTES DEL CORPUS
===========================================================

Una fuente es un DOMINIO o una CUENTA, nunca una pieza. Se
construye desde las piezas y las relaciones, y su clase sale de
lo que el analisis afirmo, no del volumen.
===========================================================
*/
export function construirFuentes({ piezas = [], amplificacion = [], relaciones = [] }) {
  const mapa = new Map();

  function asegurar(dominio) {
    if (!dominio) return null;

    if (!mapa.has(dominio)) {
      const catalogo = identificarFuente(`https://${dominio}`);

      mapa.set(dominio, {
        dominio,

        /*
          El nombre del catalogo es un punto de partida; el que
          devuelve la API de la plataforma lo sustituye, porque
          es una observacion directa.
        */
        nombre: catalogo?.nombre || null,

        catalogo: {
          tipo: catalogo?.tipo || null,
          nombre: catalogo?.nombre || null,
          cobertura: catalogo?.cobertura || null,
          verificado: Boolean(catalogo?.verificado),
          motivo: catalogo?.motivo || null
        },

        clasesObservadas: new Set(),
        piezasAnalizadas: new Set(),
        piezasRelacionadas: new Set(),
        candidatos: new Set(),
        titulos: [],
        autores: new Set(),
        correspondencias: [],
        ultimaObservacion: null,
        publicacionMasReciente: null
      });
    }

    return mapa.get(dominio);
  }

  function registrarPieza(p, conjunto) {
    const f = asegurar(p.dominio);

    if (!f) return;

    f.clasesObservadas.add(p.claseEmisor);

    f[conjunto].add(p.clave);

    if (p.nombreEmisor) f.nombre = p.nombreEmisor;

    if (p.titulo) f.titulos.push(p.titulo);

    if (p.autor) f.autores.add(p.autor);

    const corr = p.emisor?.correspondencia;

    if (corr?.candidatos?.length) {
      corr.candidatos.forEach((c) => {
        f.correspondencias.push({
          medioId: c.medioId,
          nombre: c.nombre,
          fuerza: c.fuerza,
          motivo: c.motivo,
          estado: c.estado,
          claseSugerida: c.claseSugerida,
          requiereConfirmacion: c.requiereConfirmacion !== false
        });
      });
    }

    if (p.observedAt && (!f.ultimaObservacion || p.observedAt > f.ultimaObservacion)) {
      f.ultimaObservacion = p.observedAt;
    }

    if (
      p.publishedAt &&
      (!f.publicacionMasReciente || p.publishedAt > f.publicacionMasReciente)
    ) {
      f.publicacionMasReciente = p.publishedAt;
    }
  }

  piezas.forEach((p) => registrarPieza(p, "piezasAnalizadas"));

  amplificacion.forEach((p) => registrarPieza(p, "piezasRelacionadas"));

  relaciones.forEach((r) => {
    const f = asegurar(r.source);

    if (!f || !r.target) return;

    f.candidatos.add(r.target);

    if (r.observadaEn && (!f.ultimaObservacion || r.observadaEn > f.ultimaObservacion)) {
      f.ultimaObservacion = r.observadaEn;
    }
  });

  return [...mapa.values()].map((f) => {
    const clases = [...f.clasesObservadas];

    const determinadas = clases.filter(esDeterminada);

    /*
      Dos clases determinadas distintas para el mismo dominio no
      se promedian ni se eligen por frecuencia: se declara el
      conflicto y la fuente queda sin clase. Elegir una seria
      inventar la resolucion de una contradiccion real.
    */
    const conflicto = determinadas.length > 1;

    const clase = conflicto
      ? CLASES_EMISOR.NO_DETERMINADO
      : determinadas[0] || clases[0] || CLASES_EMISOR.NO_DETERMINADO;

    return {
      dominio: f.dominio,
      nombre: f.nombre,

      clase,
      claseEtiqueta: etiquetaDeClase(clase),
      grupo: grupoDeClase(clase),
      clasesObservadas: clases,
      conflictoDeClase: conflicto,

      /*
        MEDIA-UX-CERT-01. Un balanceador de AWS no es una
        cabecera. Se marca aqui, donde ya se conoce el dominio,
        para que la HOME no tenga que volver a decidirlo.
      */
      esInfraestructura: esHostDeInfraestructura(f.dominio),

      catalogo: f.catalogo,

      /*
        Nombre largo a proposito. `territorio` a secas se leeria
        como «esta fuente publica sobre este territorio», y lo
        unico que dice el catalogo es donde declara cubrir.
      */
      coberturaDeclaradaEnCatalogo: f.catalogo.cobertura || null,

      piezasAnalizadas: f.piezasAnalizadas.size,
      piezasRelacionadas: f.piezasRelacionadas.size,

      piezasObservadas: new Set([...f.piezasAnalizadas, ...f.piezasRelacionadas]).size,

      candidatosMencionados: [...f.candidatos].sort(),

      autores: [...f.autores].sort(),

      titulos: f.titulos,

      correspondencias: f.correspondencias,

      ultimaObservacion: f.ultimaObservacion,
      publicacionMasReciente: f.publicacionMasReciente
    };
  });
}


/*
===========================================================
VENTANAS
===========================================================

La ventana la calcula `dayWindow`, de la linea territorial, que
ya resuelve el dia CALENDARIO en `America/Guayaquil`. No se
reimplementa: dos «hoy» distintos en el mismo producto es un
defecto garantizado.
===========================================================
*/
export function resolverVentana(ventanaId = VENTANA_POR_DEFECTO, ahora = new Date().toISOString(), zona = ZONA_POR_DEFECTO) {
  const declarada =
    VENTANAS_HOME.find((v) => v.id === ventanaId) ||
    VENTANAS_HOME.find((v) => v.id === VENTANA_POR_DEFECTO);

  const w = ventanaDeDias(declarada.dias, ahora, zona);

  return {
    id: declarada.id,
    etiqueta: declarada.etiqueta,
    dias: declarada.dias,

    desde: w.desde,
    hasta: w.hasta,

    zona: w.zona,
    fechaLocal: w.fechaLocal,
    fechaLocalDesde: w.fechaLocalDesde,

    pedida: ventanaId,
    reconocida: declarada.id === ventanaId,

    declaracion:
      declarada.dias === 1
        ? "HOY es el dia CALENDARIO en America/Guayaquil, no las ultimas 24 horas. Se reutiliza la semantica temporal de la linea territorial."
        : `Ventana de ${declarada.dias} dias de calendario en America/Guayaquil, alineada al mismo huso que HOY para que HOY sea un subconjunto exacto.`
  };
}


/*
-----------------------------------------------------------
APLICAR UNA VENTANA A UN CONJUNTO DE PIEZAS

Devuelve TRES grupos, nunca dos. El tercero es el que evita la
mentira: una pieza sin fecha utilizable no esta dentro ni
fuera, y meterla en cualquiera de los dos grupos falsea el
recuento.
-----------------------------------------------------------
*/
export function aplicarVentana(piezas = [], ventana) {
  const desde = new Date(ventana.desde).getTime();

  const hasta = new Date(ventana.hasta).getTime();

  const dentro = [];

  const fuera = [];

  const sinFechaUtilizable = [];

  piezas.forEach((p) => {
    if (!p.publishedAt) {
      sinFechaUtilizable.push(p);

      return;
    }

    const t = new Date(p.publishedAt).getTime();

    if (t >= desde && t <= hasta) dentro.push(p);
    else fuera.push(p);
  });

  const total = piezas.length;

  const datables = dentro.length + fuera.length;

  return {
    dentro,
    fuera,
    sinFechaUtilizable,

    recuento: {
      total,
      dentroDeVentana: dentro.length,
      fueraDeVentana: fuera.length,
      sinFechaUtilizable: sinFechaUtilizable.length,

      /*
        Proporcion del corpus que la ventana PUEDE situar. Es la
        cifra que decide si el numero de la ventana significa
        algo, y por eso va al lado y no en un pie de pagina.
      */
      proporcionDatable: total === 0 ? null : Number((datables / total).toFixed(3))
    },

    estado:
      total === 0
        ? ESTADOS_DATO.SIN_EVIDENCIA
        : datables === 0
          ? ESTADOS_DATO.COBERTURA_INSUFICIENTE
          : null,

    declaracion:
      total === 0
        ? "No hay piezas en el corpus de este proyecto."
        : datables === 0
          ? `Ninguna de las ${total} piezas tiene fecha de publicacion utilizable: la ventana no puede situar ni una. El recuento de la ventana no es cero, es indeterminado.`
          : `${dentro.length} de ${datables} piezas datables caen en la ventana. ${sinFechaUtilizable.length} pieza(s) quedan fuera del calculo por falta de fecha normalizada.`
  };
}


export default {
  SUBMOTOR_MEDIA,
  TENANT_POR_DEFECTO,
  instanteIso,
  clavePieza,
  leerCorpusDeProyecto,
  construirFuentes,
  resolverVentana,
  aplicarVentana
};
