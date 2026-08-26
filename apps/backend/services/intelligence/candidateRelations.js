// apps/backend/services/intelligence/candidateRelations.js

/*
===========================================================
RELACIONES OBSERVABLES, MEDIOS Y TERRITORIO
===========================================================

Tres puentes que este gate DEFINE pero no completa: relaciones
entre actores, conexion con Media Intelligence y conexion con
Territorial Intelligence. Se definen ahora para que despues
encajen sin rehacer el modelo, y se declara explicitamente que
hoy estan vacios.

-----------------------------------------------------------
LA ADVERTENCIA QUE VA EN LA INTERFAZ
-----------------------------------------------------------

    Una relacion digital observada NO es una relacion personal
    ni politica.

Que un medio publique sobre un candidato no los hace aliados.
Que dos personas aparezcan en la misma nota no las hace socias.
Que una cuenta comparta un contenido no la hace partidaria.

Este modulo produce aristas de un grafo de OBSERVACIONES
PUBLICAS. Interpretarlas es trabajo del analista, y la interfaz
tiene que decirlo donde se ven.
===========================================================
*/

import { RESOLUCIONES, autorizaAtribucion } from "../geo/geoContracts.js";

import { METODOS_GEOLOCALIZACION } from "../geo/evidenceGeolocation.js";

import { identificarFuente, TIPOS_FUENTE } from "../conversation/mediaRegistry.js";


/*
-----------------------------------------------------------
TIPOS DE RELACION

Todos son VERBOS OBSERVABLES: describen un acto publico que
alguien puede ir a comprobar, no una afinidad.
-----------------------------------------------------------
*/
export const TIPOS_RELACION = Object.freeze({
  MENCIONA: "menciona",
  ES_MENCIONADO_POR: "es_mencionado_por",
  ETIQUETA: "etiqueta",
  COMPARTE: "comparte",
  ENLAZA: "enlaza",
  APARECE_CON: "aparece_conjuntamente_con",
  MEDIO_PUBLICA_SOBRE: "medio_publica_sobre",
  CREADOR_AMPLIFICA: "creador_amplifica",
  ORGANIZACION_REFERENCIA: "organizacion_referencia"
});


export const ADVERTENCIA_RELACION = Object.freeze({
  titulo: "Una relacion digital observada no es una relacion real",
  texto:
    "Estas aristas describen actos publicos observados: quien menciono a quien, quien enlazo que, quien aparecio en la misma pieza. No describen alianzas, afinidades, acuerdos ni vinculos personales. Un medio que publica sobre un candidato no es su aliado, y dos personas que aparecen en la misma nota no tienen por que conocerse."
});


/*
  Una arista. `confidence` solo se rellena cuando se puede
  explicar; si no, queda `null` en lugar de un numero decorativo.
*/
export function crearRelacion(entrada = {}) {
  return {
    relationId:
      entrada.relationId ||
      `rel-${entrada.tipo}-${entrada.source}-${entrada.target}-${entrada.timestamp || ""}`,

    source: entrada.source || null,
    target: entrada.target || null,
    tipo: entrada.tipo || null,

    timestamp: entrada.timestamp || null,

    /* Sin evidencia no hay arista: es el unico campo obligatorio. */
    evidenceIds: entrada.evidenceIds || [],

    provenance: {
      metodo: entrada.metodo || null,
      proveedor: entrada.proveedor || null,
      observadaEn: entrada.observadaEn || null,
      declaradaPorAnalista: entrada.declaradaPorAnalista === true
    },

    confidence: entrada.confidence ?? null,
    explicacionConfidence: entrada.explicacionConfidence || null,

    advertencia: ADVERTENCIA_RELACION.texto
  };
}


/*
===========================================================
RELACIONES DERIVADAS DE EVIDENCIAS

Solo lo que la evidencia sostiene por si misma. Una nota de un
medio que nombra al candidato produce MEDIO_PUBLICA_SOBRE, y no
produce nada mas: de ahi no sale ninguna afinidad.
===========================================================
*/
export function relacionesDeEvidencias(entrada = {}) {
  const { evidencias = [], candidateId = null, cuentas = [] } = entrada;

  const propias = new Set(
    (cuentas || []).map((c) => String(c.url || "").toLowerCase())
  );

  const relaciones = [];

  const descartadas = [];

  (evidencias || []).forEach((e) => {
    const url = e.enlace || e.url || null;

    if (!url) {
      descartadas.push({
        motivo: "sin URL: no se puede identificar al actor",
        titulo: e.titulo || null
      });

      return;
    }

    /* Una pieza propia no genera relacion con uno mismo. */
    if (propias.has(String(url).toLowerCase())) return;

    const f = identificarFuente(e);

    if (!f.dominio) {
      descartadas.push({ motivo: "URL no utilizable", titulo: e.titulo || null });

      return;
    }

    const esMedio =
      f.tipo === TIPOS_FUENTE.MEDIO_LOCAL ||
      f.tipo === TIPOS_FUENTE.MEDIO_REGIONAL ||
      f.tipo === TIPOS_FUENTE.MEDIO_NACIONAL;

    const tipo = esMedio
      ? TIPOS_RELACION.MEDIO_PUBLICA_SOBRE
      : f.tipo === TIPOS_FUENTE.INSTITUCION
        ? TIPOS_RELACION.ORGANIZACION_REFERENCIA
        : TIPOS_RELACION.MENCIONA;

    relaciones.push(
      crearRelacion({
        source: `dominio:${f.dominio}`,
        target: `candidato:${candidateId}`,
        tipo,
        timestamp: e.fecha || null,
        evidenceIds: [e.id || url],
        metodo: "identificacion_de_dominio",
        observadaEn: e.observadaEn || null,

        /*
          No se pone confianza. La arista es un hecho —esta pieza
          existe y nombra al candidato—, no una estimacion, y un
          numero aqui solo confundiria.
        */
        confidence: null,
        explicacionConfidence:
          "La arista consta o no consta: la publicacion existe y nombra al candidato. No hay nada que estimar."
      })
    );
  });

  const porTipo = {};

  relaciones.forEach((r) => {
    porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1;
  });

  return {
    candidateId,
    relaciones,
    total: relaciones.length,
    porTipo,
    descartadas,

    advertencia: ADVERTENCIA_RELACION,

    noImplementado: [
      "etiquetas y menciones dentro de plataformas sociales: exigen API",
      "comparticiones y reposts: exigen API",
      "aparicion conjunta de dos personas en una misma pieza: exige extraccion de entidades sobre el texto completo, que hoy no se recoge"
    ],

    nota: relaciones.length
      ? null
      : "Sin corpus de evidencias no hay relaciones observables que derivar."
  };
}


/*
===========================================================
CONTRATO CON MEDIA INTELLIGENCE
===========================================================

Media Intelligence es otro modulo y NO se construye aqui. Lo que
se fija es la forma exacta en que se conectara, para que el dia
que exista no haya que renegociar el modelo.
===========================================================
*/
export const CONTRATO_MEDIA_RELATION = Object.freeze({
  version: "1.0",

  proveeCandidateIntelligence: [
    "candidateId",
    "nombrePrincipal y alias",
    "cuentas atribuidas con su estado de resolucion",
    "ventana temporal solicitada"
  ],

  debeDevolverMediaIntelligence: [
    "mediaId y dominio",
    "piezas: numero de piezas DISTINTAS, ya deduplicadas",
    "primeraPieza y ultimaPieza",
    "temas por pieza",
    "evidenceIds: enlaces verificables de cada pieza",
    "tipoDeMedio y ambito declarado",
    "metodoDeDeduplicacion aplicado"
  ],

  reglas: [
    "Las piezas llegan YA deduplicadas o con el grupo de replica declarado: si no, diez copias de una nota se leerian como diez coberturas.",
    "Sin evidenceIds una cifra no se acepta: un recuento sin enlaces no es verificable.",
    "La diversidad de medios se mide en dominios distintos, no en piezas.",
    "Media Intelligence no devuelve audiencia ni alcance mientras no exista una fuente de audiencia: un ranking de influencia sin datos de audiencia seria una opinion con formato de metrica."
  ],

  estado: "CONTRATO_DEFINIDO_SIN_IMPLEMENTAR",

  disponibleHoy: false,

  motivo:
    "Media Intelligence pertenece a otro modulo y no se implementa en este gate. Candidate Intelligence deja el punto de conexion listo y declarado."
});


export function validarPayloadDeMedios(payload) {
  const faltan = [];

  if (!payload || typeof payload !== "object") {
    return {
      valido: false,
      faltan: ["payload"],
      motivo: "no llego ningun payload de Media Intelligence"
    };
  }

  ["mediaId", "piezas", "evidenceIds"].forEach((k) => {
    if (payload[k] == null) faltan.push(k);
  });

  if (Array.isArray(payload.evidenceIds) && payload.evidenceIds.length === 0) {
    faltan.push("evidenceIds (vacio)");
  }

  return {
    valido: faltan.length === 0,
    faltan,
    motivo: faltan.length
      ? `el payload no cumple el contrato: falta ${faltan.join(", ")}`
      : null
  };
}


/*
===========================================================
CONTRATO CON TERRITORIAL INTELLIGENCE
===========================================================

Lo que se ubica es una PIEZA, nunca una persona.

    NO por IP.
    NO por dispositivo.
    NO por usuario.
    NO se fabrica sector.

La resolucion la decide GEO-1, que ya existe, y la autorizacion
de la unidad la decide `autorizaAtribucion`. Este modulo no
resuelve territorio: lo consume y se niega a aceptar lo que GEO-1
no autorice.
===========================================================
*/
export const METODOS_PROHIBIDOS = Object.freeze([
  "ip",
  "dispositivo",
  "usuario",
  "geolocalizacion_de_perfil",
  "inferencia_por_seguidores"
]);


export function vincularEvidenciaATerritorio(entrada = {}) {
  const { candidateId = null, evidenceId = null, geo = null } = entrada;

  const rechazo = (motivo) => ({
    candidateId,
    evidenceId,
    territoryId: null,
    geoResolution: null,
    provenance: null,
    vinculado: false,
    motivo
  });

  if (!geo) return rechazo("la evidencia no trae contrato de GEO-1");

  const metodo = geo.metodo || geo.provenance?.metodo || null;

  if (METODOS_PROHIBIDOS.includes(String(metodo))) {
    return rechazo(
      `metodo prohibido: ${metodo}. La ubicacion de una persona no es un dato que este sistema persiga; lo que se ubica son publicaciones.`
    );
  }

  if (!metodo || !Object.values(METODOS_GEOLOCALIZACION).includes(metodo)) {
    return rechazo(
      "el metodo de geolocalizacion no pertenece al catalogo de GEO-1"
    );
  }

  if (metodo === METODOS_GEOLOCALIZACION.NO_RESOLUBLE) {
    return rechazo("GEO-1 declaro la evidencia no resoluble");
  }

  const unidad = geo.unidad || geo.principal || null;

  if (!unidad?.unidadId) {
    return rechazo("GEO-1 no resolvio ninguna unidad territorial");
  }

  const permiso = autorizaAtribucion(unidad);

  if (!permiso.autoriza) {
    return rechazo(
      `la unidad no autoriza atribucion: ${permiso.motivo || "sin motivo declarado"}`
    );
  }

  return {
    candidateId,
    evidenceId,

    territoryId: unidad.unidadId,

    geoResolution: unidad.resolucion || permiso.hasta || RESOLUCIONES.CANTON,

    provenance: {
      metodo,
      fiabilidad: geo.fiabilidad || null,
      autorizadaHasta: permiso.hasta || null,
      resueltoPor: "GEO-1",
      declaradaPorAnalista: metodo === METODOS_GEOLOCALIZACION.ASOCIACION_ANALITICA
    },

    vinculado: true,
    motivo: null,

    nota:
      "El vinculo ubica la PIEZA, no al candidato ni a ninguna persona. Que una nota sobre el candidato se ubique en un canton no dice que el candidato estuviera alli."
  };
}


export function vincularLote(entrada = {}) {
  const { candidateId = null, evidencias = [] } = entrada;

  const vinculos = (evidencias || []).map((e) =>
    vincularEvidenciaATerritorio({
      candidateId,
      evidenceId: e.id || e.enlace || null,
      geo: e.geo || null
    })
  );

  const vinculados = vinculos.filter((v) => v.vinculado);

  const porMotivo = {};

  vinculos
    .filter((v) => !v.vinculado)
    .forEach((v) => {
      porMotivo[v.motivo] = (porMotivo[v.motivo] || 0) + 1;
    });

  return {
    candidateId,
    vinculos: vinculados,
    total: vinculados.length,
    rechazados: vinculos.length - vinculados.length,
    motivosDeRechazo: porMotivo,

    metodosProhibidos: METODOS_PROHIBIDOS,

    nota: vinculados.length
      ? "Cada vinculo ubica una pieza en una unidad autorizada por GEO-1."
      : "Ninguna evidencia trae contrato de GEO-1 todavia. Sin geolocalizacion verificada no se ubica nada: fabricar un canton plausible seria inventar cobertura territorial."
  };
}


export default {
  TIPOS_RELACION,
  ADVERTENCIA_RELACION,
  crearRelacion,
  relacionesDeEvidencias,
  CONTRATO_MEDIA_RELATION,
  validarPayloadDeMedios,
  METODOS_PROHIBIDOS,
  vincularEvidenciaATerritorio,
  vincularLote
};
