// apps/backend/services/media/pieceTerritory.js

import { resolverUbicacion } from "../geo/geoResolver.js";

import { geolocalizarEvidencia } from "../geo/evidenceGeolocation.js";

import {
  comprobarGeo1,
  autorizaAtribucion,
  PROCEDENCIAS,
  TRATAMIENTO_VISUAL
} from "../geo/geoContracts.js";

import { pistaDeFuente, identificarFuente } from "../conversation/mediaRegistry.js";

import { METODOS_PROHIBIDOS } from "../intelligence/candidateRelations.js";

import { aFormaConversacion } from "./pieceTopics.js";

/*
===========================================================
TERRITORIO DE UNA PIEZA — MEDIA-PIECE-01 §11
===========================================================

No hay resolucion territorial aqui. GEO-1 ya existe, ya decide
hasta donde llega la evidencia, y este fichero LO CONSUME.

LO QUE SE UBICA ES LA PIEZA, NUNCA LA PERSONA
-----------------------------------------------------------

Los cinco metodos prohibidos estan declarados en
`candidateRelations.METODOS_PROHIBIDOS` y se reexportan aqui
para que la respuesta de la API los muestre: ip, dispositivo,
usuario, geolocalizacion de perfil e inferencia por
seguidores. Ninguno se usa y se dice que no se usa.

Tampoco se infiere la residencia de quien comenta. Un
comentario en una pieza sobre Cuenca no prueba que quien
comenta viva en Cuenca, y no hay dato que lo pruebe.

LAS CUATRO VIAS VALIDAS
-----------------------------------------------------------

    1. medio local identificado      -> ambito declarado por el medio
    2. toponimo explicito en el texto -> lo que la pieza dice
    3. ubicacion declarada por la fuente
    4. metadata permitida (hoy: ninguna disponible)

La via 1 es la mas fuerte y la que el catalogo de medios ya
resuelve con `pistaDeFuente`. La via 2 la resuelve el
geoResolver. Las vias 3 y 4 dependen de que la fuente aporte
el dato, que hoy casi nunca ocurre.

LO QUE ESTA PROHIBIDO DECIR
-----------------------------------------------------------

    "poblacion alcanzada en Cuenca"

Un medio con cobertura declarada en Cuenca no prueba lectores
en Cuenca. Se dice EVIDENCIA TERRITORIAL OBSERVADA y se
explica de que via salio.
===========================================================
*/


export const VIAS_TERRITORIALES = Object.freeze({
  MEDIO_LOCAL: "medio_local_identificado",
  TOPONIMO_EXPLICITO: "toponimo_explicito_en_el_texto",
  DECLARADA_POR_LA_FUENTE: "ubicacion_declarada_por_la_fuente",
  METADATA_PERMITIDA: "metadata_permitida"
});


export function territorioDePieza(entrada = {}) {
  const { pieza = null, piezasAmplificacion = [], ambitoId = null } = entrada;

  if (!pieza) {
    return sinTerritorio("No hay pieza que ubicar.");
  }

  const forma = aFormaConversacion(pieza);

  /*
    Pista de fuente: si el dominio esta en el catalogo con
    ambito declarado, es la evidencia territorial mas fiable
    que existe hoy.
  */
  const pista = pistaDeFuente(pieza.canonicalUrl || pieza.url);

  const ficha = identificarFuente(pieza.canonicalUrl || pieza.url);

  let ubicacion = null;

  try {
    ubicacion = resolverUbicacion(forma, {
      ambitoId,
      pistaDeFuente: pista
    });
  } catch (error) {
    return sinTerritorio(
      `El resolvedor territorial fallo: ${error?.message || "error desconocido"}.`
    );
  }

  if (!ubicacion?.unidadId) {
    return sinTerritorio(
      ubicacion?.motivo ||
        "Ni el dominio ni el texto de la pieza permiten afirmar un territorio."
    );
  }

  /*
    GEO-1 tiene la ultima palabra: puede rechazar la resolucion
    pedida o la unidad. Si la rechaza, no se afirma.
  */
  let geo1 = null;

  try {
    geo1 = comprobarGeo1(ubicacion, ubicacion.resolucion);
  } catch {
    geo1 = null;
  }

  let autorizada = null;

  try {
    autorizada = ubicacion.unidad ? autorizaAtribucion(ubicacion.unidad) : null;
  } catch {
    autorizada = null;
  }

  if (geo1 && geo1.cumple === false) {
    return sinTerritorio(
      `GEO-1 no autoriza esta atribucion: ${geo1.motivo || "resolucion no permitida por la evidencia"}.`,
      { ubicacion, geo1 }
    );
  }

  if (autorizada && autorizada.autoriza === false) {
    return sinTerritorio(
      `La unidad territorial no autoriza atribucion: ${autorizada.motivo || "unidad sin geometria certificada"}.`,
      { ubicacion, autorizada }
    );
  }

  let geoloc = null;

  try {
    geoloc = geolocalizarEvidencia(ubicacion, { ambitoId });
  } catch {
    geoloc = null;
  }

  /* Que via sostuvo la atribucion. */
  const vias = [];

  if (pista?.unidadId) {
    vias.push({
      via: VIAS_TERRITORIALES.MEDIO_LOCAL,
      detalle: pista.motivo,
      unidadId: pista.unidadId,
      resolucion: pista.resolucion
    });
  }

  if ((ubicacion.toponimosDetectados || []).length) {
    vias.push({
      via: VIAS_TERRITORIALES.TOPONIMO_EXPLICITO,
      detalle: `La pieza nombra: ${ubicacion.toponimosDetectados.join(", ")}.`,
      unidadId: ubicacion.unidadId,
      resolucion: ubicacion.resolucion
    });
  }

  if (ubicacion.procedencia === PROCEDENCIAS.DECLARADA) {
    vias.push({
      via: VIAS_TERRITORIALES.DECLARADA_POR_LA_FUENTE,
      detalle: "La fuente declaro la unidad territorial explicitamente.",
      unidadId: ubicacion.unidadId,
      resolucion: ubicacion.resolucion
    });
  }

  /* Huella territorial de la amplificacion, por dominio de medio. */
  const huellaAmplificacion = huellaDeAmplificacion(piezasAmplificacion);

  return {
    tieneEvidenciaTerritorial: true,

    rotulo: "EVIDENCIA TERRITORIAL OBSERVADA",

    unidadId: ubicacion.unidadId,
    unidad: ubicacion.unidad?.nombre || ubicacion.unidadId,
    resolucion: ubicacion.resolucion,
    procedencia: ubicacion.procedencia,
    confianza: ubicacion.confianza ?? null,
    motivo: ubicacion.motivo || null,
    razones: ubicacion.razones || [],

    toponimosDetectados: ubicacion.toponimosDetectados || [],
    tambienMencionadas: ubicacion.tambienMencionadas || [],

    /*
      Menciones sin geometria certificada: se muestran APARTE y
      con tratamiento visual distinto. Un barrio mencionado no
      es una unidad administrativa.
    */
    mencionesNoCertificadas: ubicacion.mencionesNoCertificadas || [],

    tratamientoVisual:
      geoloc?.tratamiento || TRATAMIENTO_VISUAL?.UNIDAD_OFICIAL || null,

    vias,

    ambitoDeclaradoDelMedio: ficha?.cobertura || null,

    huellaAmplificacion,

    geo1: geo1 || null,

    /* Lo que este bloque NO afirma, dicho en la respuesta. */
    noAfirma: [
      "No afirma poblacion alcanzada ni lectores en el territorio: no hay dato de audiencia.",
      "No geolocaliza usuarios individuales.",
      "No infiere la residencia de quien comenta.",
      "El ambito declarado de un medio no prueba donde estan sus lectores."
    ],

    metodosProhibidosNoUsados: [...METODOS_PROHIBIDOS]
  };
}


function sinTerritorio(motivo, extra = {}) {
  return {
    tieneEvidenciaTerritorial: false,

    rotulo: "SIN EVIDENCIA TERRITORIAL SUFICIENTE",

    unidadId: null,
    unidad: null,
    resolucion: null,
    procedencia: PROCEDENCIAS?.DESCONOCIDA || "desconocida",
    confianza: 0,
    motivo,
    razones: [],
    toponimosDetectados: [],
    tambienMencionadas: [],
    mencionesNoCertificadas: [],
    tratamientoVisual: null,
    vias: [],
    ambitoDeclaradoDelMedio: null,
    huellaAmplificacion: null,

    noAfirma: [
      "No se inventa un territorio para llenar el panel.",
      "Sin evidencia valida, la pieza no se ubica."
    ],

    metodosProhibidosNoUsados: [...METODOS_PROHIBIDOS],

    ...extra
  };
}


/*
-----------------------------------------------------------
HUELLA TERRITORIAL DE LA AMPLIFICACION

Cuantos de los emisores que replicaron son medios con ambito
declarado. Es un indicio de difusion territorial y se declara
como tal: NO es poblacion, ni audiencia, ni alcance.
-----------------------------------------------------------
*/
function huellaDeAmplificacion(piezas = []) {
  if (!piezas.length) return null;

  const porUnidad = new Map();

  let sinAmbito = 0;

  piezas.forEach((p) => {
    const f = identificarFuente(p.canonicalUrl || p.url);

    const u = f?.cobertura?.unidadId || null;

    if (!u) {
      sinAmbito += 1;
      return;
    }

    if (!porUnidad.has(u)) {
      porUnidad.set(u, {
        unidadId: u,
        resolucion: f.cobertura.resolucion,
        medios: new Set(),
        piezas: 0,
        evidenceIds: []
      });
    }

    const reg = porUnidad.get(u);

    reg.piezas += 1;

    if (f.dominio) reg.medios.add(f.dominio);

    if (p.evidenceId) reg.evidenceIds.push(p.evidenceId);
  });

  return {
    porUnidad: [...porUnidad.values()].map((r) => ({
      ...r,
      medios: r.medios.size
    })),

    emisoresSinAmbitoDeclarado: sinAmbito,

    declaracion:
      "Cuenta los EMISORES con ambito declarado en el catalogo, no personas ni audiencia. Un emisor local publicando no prueba lectores locales."
  };
}


export default {
  VIAS_TERRITORIALES,
  territorioDePieza
};
