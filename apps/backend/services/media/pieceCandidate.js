// apps/backend/services/media/pieceCandidate.js

import {
  crearRelacion,
  TIPOS_RELACION,
  ADVERTENCIA_RELACION
} from "../intelligence/candidateRelations.js";

import { clasificarPlano, PLANOS } from "../intelligence/candidateAmplification.js";

import { variantesDeNombre, contarMenciones } from "../conversation/actorMentions.js";

import { aFormaConversacion } from "./pieceTopics.js";

/*
===========================================================
RELACION PIEZA -> CANDIDATO — MEDIA-PIECE-01 §5
===========================================================

Si la pieza nombra al candidato, se crea UNA arista observable:

    EMISOR --MEDIO_PUBLICA_SOBRE--> CANDIDATO

y nada mas. De ahi no sale apoyo, ni oposicion, ni afinidad.
`ADVERTENCIA_RELACION` ya dice esto en el modulo de Candidate
Intelligence y se propaga literalmente en la respuesta.

POR QUE NO SE REHACE NADA
-----------------------------------------------------------

`crearRelacion` ya existe y ya exige `evidenceIds` como unico
campo obligatorio. `contarMenciones` ya sabe generar variantes
de un nombre y contarlas sobre un lote. `clasificarPlano` ya
distingue presencia PROPIA de GANADA usando las cuentas
atribuidas del candidato.

Este fichero solo los encadena para el caso de una pieza.

EL PLANO IMPORTA MAS DE LO QUE PARECE
-----------------------------------------------------------

Si la URL analizada pertenece a una cuenta del propio
candidato, la pieza es PRESENCIA PROPIA: no es cobertura
mediatica, es su propia publicacion. Contarla como
amplificacion inflaria la "presencia ganada" con material
propio. `clasificarPlano` lo resuelve y devuelve
PLANO_INDETERMINADO cuando no puede decidir, que se respeta.
===========================================================
*/


export function relacionarConCandidato(entrada = {}) {
  const {
    pieza = null,
    emisor = null,
    candidato = null,
    piezasAmplificacion = [],
    observedAt = new Date().toISOString()
  } = entrada;

  if (!candidato?.candidateId) {
    return {
      vinculado: false,
      motivo:
        "No se indico candidateId: la pieza se analiza sin relacionarla con ningun actor.",
      candidato: null,
      menciona: null,
      relaciones: [],
      plano: null
    };
  }

  const nombre = candidato.nombre || candidato.nombrePrincipal || null;

  if (!nombre) {
    return {
      vinculado: false,
      motivo: `El candidato ${candidato.candidateId} no tiene nombre registrado: sin nombre no se pueden buscar menciones.`,
      candidato: { candidateId: candidato.candidateId },
      menciona: null,
      relaciones: [],
      plano: null
    };
  }

  const alias = Array.isArray(candidato.alias) ? candidato.alias : [];

  const cuentas = Array.isArray(candidato.cuentas) ? candidato.cuentas : [];

  /*
    ---------------------------------------------------------
    ¿LA PIEZA LO NOMBRA?

    Se usa el contador existente sobre el lote formado por la
    pieza y su amplificacion, para responder de una vez cuantas
    piezas del conjunto lo nombran.
    ---------------------------------------------------------
  */
  const lote = [pieza, ...piezasAmplificacion]
    .filter(Boolean)
    .map(aFormaConversacion);

  let conteo = null;

  try {
    conteo = contarMenciones(lote, [
      { id: candidato.candidateId, nombre, alias }
    ]);
  } catch {
    conteo = null;
  }

  const variantes = (() => {
    try {
      return variantesDeNombre(nombre, alias);
    } catch {
      return [nombre];
    }
  })();

  /* Comprobacion directa sobre la pieza analizada. */
  const textoPieza = `${pieza?.titulo || ""} ${pieza?.snippet || ""}`.toLowerCase();

  const varianteEncontrada =
    variantes.find((v) => v && textoPieza.includes(String(v).toLowerCase())) || null;

  const mencionaLaPieza = Boolean(varianteEncontrada);

  /*
    ---------------------------------------------------------
    PLANO: propia o ganada
    ---------------------------------------------------------
  */
  let plano = null;

  try {
    plano = clasificarPlano(
      { url: pieza?.canonicalUrl || pieza?.url, enlace: pieza?.url },
      cuentas
    );
  } catch {
    plano = null;
  }

  /*
    ---------------------------------------------------------
    LA ARISTA

    Solo si la pieza lo nombra Y el plano no es propio. Una
    publicacion del propio candidato no es "un medio publicando
    sobre el".
    ---------------------------------------------------------
  */
  const relaciones = [];

  const esPropia = plano?.plano === PLANOS.PROPIA;

  if (mencionaLaPieza && !esPropia) {
    relaciones.push(
      crearRelacion({
        source: emisor?.dominio || emisor?.nombre || pieza?.dominio || null,
        target: candidato.candidateId,
        tipo: TIPOS_RELACION.MEDIO_PUBLICA_SOBRE,
        timestamp: pieza?.publishedAt || observedAt,
        evidenceIds: [pieza?.evidenceId].filter(Boolean),
        metodo: `coincidencia de nombre en titulo/extracto (variante: "${varianteEncontrada}")`,
        proveedor: "analista_url_pegada",
        observadaEn: observedAt,
        declaradaPorAnalista: false,

        /*
          confidence queda null: la coincidencia de un nombre es
          una observacion binaria, no una probabilidad. Poner un
          numero aqui seria decoracion.
        */
        confidence: null,
        explicacionConfidence:
          "La mencion se comprobo por coincidencia literal de una variante del nombre. No se calcula probabilidad."
      })
    );
  }

  /* Aristas de la amplificacion que tambien lo nombran. */
  const relacionesAmplificacion = [];

  piezasAmplificacion.forEach((p) => {
    const t = `${p?.titulo || p?.title || ""} ${p?.snippet || ""}`.toLowerCase();

    const v = variantes.find((x) => x && t.includes(String(x).toLowerCase()));

    if (!v) return;

    relacionesAmplificacion.push(
      crearRelacion({
        source: p.dominio || null,
        target: candidato.candidateId,
        tipo: TIPOS_RELACION.MEDIO_PUBLICA_SOBRE,
        timestamp: p.publishedAt || observedAt,
        evidenceIds: [p.evidenceId].filter(Boolean),
        metodo: `coincidencia de nombre en la pieza replicada (variante: "${v}")`,
        proveedor: p.providersSeenBy?.[0] || null,
        observadaEn: observedAt,
        declaradaPorAnalista: false,
        confidence: null
      })
    );
  });

  const porActor = conteo?.porActor?.[0] || conteo?.actores?.[0] || null;

  return {
    vinculado: mencionaLaPieza,

    candidato: {
      candidateId: candidato.candidateId,
      nombre,
      alias,
      cuentasAtribuidas: cuentas.length
    },

    menciona: {
      enLaPieza: mencionaLaPieza,
      varianteEncontrada,
      variantesProbadas: variantes,

      enLaAmplificacion: relacionesAmplificacion.length,

      totalPiezasQueLoNombran:
        (mencionaLaPieza ? 1 : 0) + relacionesAmplificacion.length,

      detalleContador: porActor || null
    },

    plano: plano
      ? {
          plano: plano.plano,
          motivo: plano.motivo || null,
          cuenta: plano.cuenta || null,

          nota:
            plano.plano === PLANOS.PROPIA
              ? "La pieza pertenece a una cuenta atribuida al candidato: es PRESENCIA PROPIA, no cobertura de un tercero. No se cuenta como amplificacion ganada."
              : plano.plano === PLANOS.INDETERMINADO
                ? "No se pudo decidir de quien es la URL. Se deja aparte para no inflar la presencia ganada."
                : "La pieza no pertenece a una cuenta del candidato: es PRESENCIA GANADA."
        }
      : null,

    relaciones,
    relacionesAmplificacion,

    contrato: {
      candidateId: candidato.candidateId,
      publicationId: pieza?.publicationId || null,
      pieceId: pieza?.pieceId || null,
      evidenceIds: [pieza?.evidenceId].filter(Boolean),
      canonicalUrl: pieza?.canonicalUrl || null,
      firstObservedAt: pieza?.firstObservedAt || observedAt,
      lastObservedAt: pieza?.lastObservedAt || observedAt,
      coverageType: null /* lo fija el mapa de amplificacion */
    },

    /* La cautela viaja con el dato, no en la documentacion. */
    advertencia: ADVERTENCIA_RELACION.texto,

    noAfirma: [
      "Publicar sobre el candidato NO indica apoyo ni oposicion.",
      "El encuadre de la pieza no se deduce de la existencia de la mencion.",
      "Una mencion es un acto publico observado, no una relacion real."
    ]
  };
}


export default { relacionarConCandidato };
