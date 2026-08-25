// apps/backend/services/geo/evidenceGeolocation.js

import { unidadPorId } from "./territoryRegistry.js";
import { PROCEDENCIAS } from "./geoContracts.js";

/*
===========================================================
GEOLOCALIZACION DE UNA EVIDENCIA — contrato estable
===========================================================

El Geo Resolver devuelve UNA ubicacion. Este modulo la
convierte en el contrato que consumen las capas de arriba, y
anade lo que faltaba: la evidencia puede mencionar MAS DE UN
LUGAR y obligarla a elegir uno pierde informacion real.

    «El Vado y Las Herrerias, en Cuenca, sin agua»

tiene un territorio principal —el canton, que es lo unico que
la evidencia sostiene— y DOS menciones territoriales que no lo
sostienen. Las tres cosas son ciertas a la vez y las tres se
conservan.

QUE NO SE HACE, NUNCA
-----------------------------------------------------------

  · No se inventa GPS.
  · No se infiere ubicacion desde IP.
  · No se infiere ubicacion desde dispositivo.
  · No se infiere domicilio.
  · No se baja de canton a parroquia porque «suele ser ahi».

Los cinco estan prohibidos por diseno, no por falta de tiempo.
La ubicacion de una persona no es un dato que este modulo
persiga: lo que ubica son PUBLICACIONES.
===========================================================
*/


export const METODOS_GEOLOCALIZACION = Object.freeze({
  GEOMETRIA_OFICIAL: "geometria_oficial",
  MENCION_TEXTUAL: "mencion_textual",
  METADATO_FUENTE: "metadato_fuente",
  COBERTURA_FUENTE: "cobertura_declarada_de_la_fuente",
  ASOCIACION_ANALITICA: "asociacion_analitica_definida",
  NO_RESOLUBLE: "no_resoluble"
});


export const CATALOGO_METODOS = Object.freeze([
  {
    id: "geometria_oficial",
    nombre: "Geometria oficial",
    significado: "La evidencia trae coordenada o unidad administrativa explicita.",
    fiabilidad: "alta"
  },
  {
    id: "mencion_textual",
    nombre: "Mencion textual explicita",
    significado: "Se resolvio desde un toponimo citado en el texto.",
    fiabilidad: "media"
  },
  {
    id: "metadato_fuente",
    nombre: "Metadato de la fuente",
    significado: "La fuente declaro la ubicacion en un campo propio.",
    fiabilidad: "media"
  },
  {
    id: "cobertura_declarada_de_la_fuente",
    nombre: "Cobertura del medio",
    significado:
      "Se ubico en el ambito que cubre el medio que publica. No dice donde ocurrio, dice a quien cubre quien lo cuenta.",
    fiabilidad: "baja"
  },
  {
    id: "asociacion_analitica_definida",
    nombre: "Zona analitica",
    significado:
      "El analista definio una agrupacion propia que contiene la unidad resuelta. NO es una division oficial.",
    fiabilidad: "declarada_por_el_analista"
  },
  {
    id: "no_resoluble",
    nombre: "No resoluble",
    significado: "No hay senal suficiente. No se pinta y se cuenta aparte.",
    fiabilidad: "ninguna"
  }
]);


/*
  Traduce la procedencia del Geo Resolver al metodo. Son dos
  vocabularios distintos y conviene no fundirlos: la
  procedencia dice CUANTA precision soporta el dato; el metodo
  dice COMO se supo.
*/
function metodoDesdeProcedencia(ubicacion) {
  if (!ubicacion || ubicacion.procedencia === PROCEDENCIAS.DESCONOCIDA) {
    return METODOS_GEOLOCALIZACION.NO_RESOLUBLE;
  }

  if (ubicacion.procedencia === PROCEDENCIAS.DECLARADA) {
    return METODOS_GEOLOCALIZACION.METADATO_FUENTE;
  }

  /*
    `agregada` sin toponimos detectados solo puede venir de la
    cobertura del medio.
  */
  if (
    ubicacion.procedencia === PROCEDENCIAS.AGREGADA &&
    (ubicacion.toponimosDetectados || []).length === 0
  ) {
    return METODOS_GEOLOCALIZACION.COBERTURA_FUENTE;
  }

  return METODOS_GEOLOCALIZACION.MENCION_TEXTUAL;
}


/*
===========================================================
CONSTRUIR EL CONTRATO DE UNA EVIDENCIA
===========================================================
*/

export function geolocalizarEvidencia(ubicacion, opciones = {}) {
  const zonas = opciones.zonas || null;

  const metodo = metodoDesdeProcedencia(ubicacion);

  const principal = ubicacion?.unidadId ? unidadPorId(ubicacion.unidadId) : null;

  /*
    ---------------------------------------------------------
    MENCIONES TERRITORIALES

    Tres origenes distintos, y los tres se conservan por
    separado porque no valen lo mismo:

      tambienMencionadas       unidades OFICIALES que la
                               evidencia nombra y que no
                               ganaron la atribucion
      mencionesNoCertificadas  toponimos sin fuente: no ubican
      candidatas               descartadas por ambiguedad
    ---------------------------------------------------------
  */
  const menciones = [
    ...(ubicacion?.tambienMencionadas || []).map((m) => ({
      unidadId: m.unidadId,
      nombre: m.nombre,
      tipo: "unidad_oficial",
      atribuye: false,
      motivo:
        "Unidad oficial mencionada que no obtuvo la atribucion principal. No se cuenta para no duplicar la evidencia."
    })),

    ...(ubicacion?.mencionesNoCertificadas || []).map((m) => ({
      unidadId: m.unidadId,
      nombre: m.nombre,
      tipo: m.tipo || "toponimo_no_certificado",
      atribuye: false,
      verificado: false,
      motivo: m.motivo
    })),

    ...(ubicacion?.candidatas || []).map((c) => ({
      unidadId: c.unidadId,
      nombre: c.nombre,
      tipo: "descartada_por_ambiguedad",
      atribuye: false,
      motivo: c.motivo
    }))
  ];

  /*
    ---------------------------------------------------------
    ZONA ANALITICA

    Se anade SOLO si el analista definio zonas y la unidad
    principal pertenece a una. Nunca sustituye al territorio
    oficial: viaja al lado, marcada como no oficial.
    ---------------------------------------------------------
  */
  let zonaAnalitica = null;

  if (zonas && principal) {
    const z = zonas.zonaDe ? zonas.zonaDe(principal.id) : null;

    if (z) {
      zonaAnalitica = {
        zonaId: z.id,
        nombre: z.nombre,
        unidadOficial: false,
        tipoUnidad: "analitica",
        definidaPor: z.creadaPor || null,
        criterio: z.criterio || null,
        advertencia:
          "Zona analitica definida por el analista. NO es una division administrativa oficial."
      };
    }
  }

  const limitaciones = [];

  if (metodo === METODOS_GEOLOCALIZACION.NO_RESOLUBLE) {
    limitaciones.push(
      "Sin ubicacion: no entra en ningun conteo territorial. La ausencia de ubicacion no es ausencia de hecho."
    );
  }

  if (metodo === METODOS_GEOLOCALIZACION.COBERTURA_FUENTE) {
    limitaciones.push(
      "Ubicada por la cobertura del medio, no por el contenido. Dice a quien cubre quien lo cuenta, no donde ocurrio."
    );
  }

  if (principal && !principal.geometriaDisponible) {
    limitaciones.push(
      `"${principal.nombre}" no tiene geometria oficial: la atribucion es nominal y no se puede pintar en un mapa.`
    );
  }

  if (menciones.some((m) => m.tipo === "toponimo_no_certificado")) {
    limitaciones.push(
      "La evidencia nombra toponimos sin fuente oficial. Se registran como mencion; no producen atribucion."
    );
  }

  return {
    territorioDetectado: principal
      ? {
          unidadId: principal.id,
          nombre: principal.nombre,
          codigoOficial: principal.codigoOficial || null,
          unidadOficial: principal.verificado === true,
          tipoUnidad:
            principal.resolucion === "toponimo"
              ? "toponimo_no_certificado"
              : "oficial",
          geometriaDisponible: principal.geometriaDisponible === true
        }
      : null,

    nivelResolucion: ubicacion?.resolucion || null,

    metodoGeolocalizacion: metodo,

    fuenteGeolocalizacion: principal?.fuenteNomenclatura || null,

    procedencia: ubicacion?.procedencia || PROCEDENCIAS.DESCONOCIDA,

    confianza: ubicacion?.confianza ?? 0,

    verificado: principal?.verificado === true,

    zonaAnalitica,

    /*
      Se conservan TODAS. Una evidencia puede nombrar varios
      lugares y obligarla a elegir uno pierde informacion.
    */
    mencionesTerritoriales: menciones,

    razones: ubicacion?.razones || [],

    limitaciones
  };
}


/*
===========================================================
LOTE
===========================================================
*/

export function geolocalizarLote(resueltas, opciones = {}) {
  const ubicadas = resueltas?.ubicadas || [];

  const sinUbicar = resueltas?.sinUbicar || [];

  const porIndice = {};

  ubicadas.forEach(({ indice, ubicacion }) => {
    porIndice[indice] = geolocalizarEvidencia(ubicacion, opciones);
  });

  sinUbicar.forEach(({ indice, ubicacion }) => {
    porIndice[indice] = geolocalizarEvidencia(ubicacion, opciones);
  });

  const metodos = {};

  Object.values(porIndice).forEach((g) => {
    metodos[g.metodoGeolocalizacion] =
      (metodos[g.metodoGeolocalizacion] || 0) + 1;
  });

  const conMenciones = Object.values(porIndice).filter(
    (g) => g.mencionesTerritoriales.length > 0
  ).length;

  return {
    porIndice,

    metricas: {
      evidencias: Object.keys(porIndice).length,
      porMetodo: metodos,
      conMencionesAdicionales: conMenciones,
      geolocalizables: Object.values(porIndice).filter(
        (g) => g.territorioDetectado
      ).length
    },

    catalogoMetodos: CATALOGO_METODOS,

    declaracion:
      "Cada evidencia declara COMO se ubico. Nunca se infiere ubicacion desde IP, dispositivo ni domicilio: lo que se ubica son publicaciones, no personas."
  };
}


export default {
  METODOS_GEOLOCALIZACION,
  CATALOGO_METODOS,
  geolocalizarEvidencia,
  geolocalizarLote
};
