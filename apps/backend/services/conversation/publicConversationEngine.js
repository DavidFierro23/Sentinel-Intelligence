// apps/backend/services/conversation/publicConversationEngine.js

import { recolectar } from "./conversationHarvester.js";
import { extraerTemas2 } from "./topicEngine2.js";
import { descubrirTemas } from "./openTopicDiscovery.js";
import { resumirEncuadre } from "./framingClassifier.js";
import { resumirMedios } from "./mediaRegistry.js";
import { contarMenciones, mediosPorActor } from "./actorMentions.js";
import { construirSerieDeConversacion } from "./conversationTimeline.js";

import {
  NATURALEZA,
  MODO_POR_DEFECTO,
  declararContrato
} from "./conversationContracts.js";

/*
===========================================================
PUBLIC CONVERSATION ENGINE — orquestador
===========================================================

Una sola puerta. Recolecta, agrupa por tema, clasifica el
encuadre, cuenta menciones de actores, resume los medios y
construye la serie temporal.

ORDEN, Y POR QUE ESE ORDEN
-----------------------------------------------------------

    recolectar
        -> temas          necesita el lote completo
        -> encuadre       independiente de los temas
        -> menciones      necesita las ubicaciones si las hay
        -> medios         independiente
        -> serie          necesita temas y encuadre ya resueltos

La serie va al final porque desglosa por tema y por encuadre:
construirla antes obligaria a recorrer dos veces el lote y a
mantener dos calendarios.

LO QUE ESTE MOTOR DEVUELVE, Y LO QUE NO
-----------------------------------------------------------

Devuelve una fotografia de lo publicado, con su coste
declarado y su cobertura declarada.

No devuelve opinion ciudadana, no mide alcance y no explica
ningun cambio. Las tres cosas se declaran en la respuesta,
porque un panel que solo enumera lo que encontro produce
exceso de confianza.
===========================================================
*/


export async function analizarConversacionPublica(opciones = {}) {
  const inicio = Date.now();

  const modo = opciones.modo || MODO_POR_DEFECTO;

  /*
    ---------------------------------------------------------
    1. RECOLECCION
    ---------------------------------------------------------
  */
  const recoleccion = await recolectar({
    ambito: opciones.ambito,
    actores: opciones.actores || [],
    temas: opciones.temasSemilla || [],
    proyectoId: opciones.proyectoId || null,
    desde: opciones.desde,
    hasta: opciones.hasta,
    modo,
    maxConsultasWeb: opciones.maxConsultasWeb
  });

  const evidencias = recoleccion.evidencias;

  if (evidencias.length === 0) {
    return respuestaVacia(recoleccion, modo, inicio);
  }

  /*
    ---------------------------------------------------------
    2. TEMAS
    ---------------------------------------------------------
  */
  let temas = { temas: [], descartados: [], metricas: {}, loQueNoSabemos: [] };

  try {
    /*
      TOPIC ENGINE 2 (Gate C). Tres niveles —categoria, tema,
      subtema— y cuatro filtros contra defectos medidos.

      El ambito y las CONSULTAS viajan al extractor: sin ellos,
      el territorio analizado y los terminos que el planner puso
      en la query acaban convertidos en tema, que es el criterio
      de busqueda devuelto como hallazgo.
    */
    temas = extraerTemas2(evidencias, {
      ...opciones,
      ambito: opciones.ambito || null,
      consultas: recoleccion.consultasPlanificadas || []
    });
  } catch (error) {
    console.error("[conversacion] extraccion de temas fallo:", error);
  }

  /*
    ---------------------------------------------------------
    2-BIS. OPEN TOPIC DISCOVERY (Gate C2)
    ---------------------------------------------------------

    Corre APARTE del Topic Engine 2 y con el mismo corpus. Son
    dos preguntas distintas:

        descubrimiento   ¿que parece estar apareciendo?
        clasificacion    ¿como lo organizamos y explicamos?

    El primero no consulta ninguna taxonomia. Auditado sobre el
    catalogo actual, tres temas reales —lluvias e inundaciones,
    festival cultural, sismo— no tienen categoria declarada: un
    motor que solo mirase por ahi responderia «en Cuenca se
    habla de gestion publica» el dia de una inundacion.

    No sustituye al Topic Engine 2: lo complementa. Las
    categorias siguen sirviendo para ORGANIZAR lo descubierto,
    pero ya no deciden por si solas que existe.
  */
  let descubrimiento = null;

  try {
    descubrimiento = descubrirTemas(evidencias, {
      ...opciones,
      ambito: opciones.ambito || null,
      consultas: recoleccion.consultasPlanificadas || []
    });
  } catch (error) {
    console.error("[conversacion] descubrimiento abierto fallo:", error);
  }

  /*
    ---------------------------------------------------------
    3. ENCUADRE
    ---------------------------------------------------------
  */
  let encuadre = {
    clasificadas: [],
    conteo: {},
    metricas: {},
    loQueNoSabemos: []
  };

  try {
    encuadre = resumirEncuadre(evidencias, opciones);
  } catch (error) {
    console.error("[conversacion] clasificacion de encuadre fallo:", error);
  }

  const encuadrePorIndice = {};

  (encuadre.clasificadas || []).forEach((c) => {
    encuadrePorIndice[c.indice] = c.encuadre;
  });

  /*
    ---------------------------------------------------------
    4. MENCIONES DE ACTORES
    ---------------------------------------------------------
  */
  let menciones = null;

  let coberturaPorActor = null;

  if ((opciones.actores || []).length > 0) {
    try {
      menciones = contarMenciones(evidencias, opciones.actores, {
        ubicaciones: opciones.ubicaciones || null
      });

      coberturaPorActor = mediosPorActor(evidencias, menciones);
    } catch (error) {
      console.error("[conversacion] conteo de menciones fallo:", error);
    }
  }

  /*
    ---------------------------------------------------------
    5. MEDIOS
    ---------------------------------------------------------
  */
  let medios = null;

  try {
    medios = resumirMedios(evidencias);
  } catch (error) {
    console.error("[conversacion] resumen de medios fallo:", error);
  }

  /*
    ---------------------------------------------------------
    6. SERIE TEMPORAL
    ---------------------------------------------------------
  */
  let serie = null;

  try {
    serie = construirSerieDeConversacion(evidencias, {
      granularidad: opciones.granularidad,
      desde: opciones.desde,
      hasta: opciones.hasta,
      temas: temas.temas,
      encuadrePorIndice
    });
  } catch (error) {
    console.error("[conversacion] serie temporal fallo:", error);
  }

  /*
    ---------------------------------------------------------
    RESPUESTA
    ---------------------------------------------------------
  */
  return {
    modulo: "public_conversation",
    version: "1.0",

    naturaleza: NATURALEZA,

    modo,

    evidencias,

    temas,
    descubrimiento,
    encuadre,
    menciones,
    coberturaPorActor,
    medios,
    serie,

    recoleccion: {
      registro: recoleccion.registro,
      trazaMotores: recoleccion.trazaMotores,
      consultasPlanificadas: recoleccion.consultasPlanificadas,
      metricas: recoleccion.metricas,
      advertencias: recoleccion.advertencias,
      cobertura: recoleccion.cobertura
    },

    costo: recoleccion.costo,

    tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`,

    loQueNoSabemos: reunirLoQueNoSabemos({
      recoleccion,
      temas,
      encuadre,
      menciones,
      medios,
      serie
    })
  };
}


/*
-----------------------------------------------------------
UN SOLO BLOQUE «LO QUE NO SABEMOS»

Cada submodulo produce el suyo. Si llegaran sueltos a la
interfaz, el analista tendria seis listas y no leeria ninguna.
Se reunen aqui, sin duplicados y con la naturaleza del modulo
siempre en primer lugar: es la advertencia que cambia como se
lee todo lo demas.
-----------------------------------------------------------
*/

function reunirLoQueNoSabemos(partes) {
  const lista = [
    `Esto mide PUBLICACION, no opinion ciudadana. ${NATURALEZA.lecturaCorrecta}`,
    NATURALEZA.exclusionDeclarada,

    ...(partes.recoleccion?.advertencias || []),
    partes.recoleccion?.cobertura?.declaracion,

    /*
      Los motores NO consultados van en «lo que no sabemos», no
      en un panel de diagnostico aparte. Que Brave no tenga
      credencial no es un detalle tecnico: es cobertura que
      falta, y cambia como se lee un resultado vacio.
    */
    ...(partes.recoleccion?.cobertura?.motoresSinCobertura || []).map(
      (m) =>
        `${m.motor}: ${m.estado}. ${m.motivo} Sobre esta fuente no se puede afirmar ausencia.`
    ),

    ...(partes.temas?.loQueNoSabemos || []),
    ...(partes.descubrimiento?.loQueNoSabemos || []),
    ...(partes.encuadre?.loQueNoSabemos || []),
    ...(partes.menciones?.loQueNoSabemos || []),
    ...(partes.medios?.loQueNoSabemos || []),
    ...(partes.serie?.loQueNoSabemos || [])
  ].filter(Boolean);

  return [...new Set(lista)];
}


function respuestaVacia(recoleccion, modo, inicio) {
  return {
    modulo: "public_conversation",
    version: "1.0",

    naturaleza: NATURALEZA,

    modo,

    evidencias: [],

    temas: null,
    encuadre: null,
    menciones: null,
    coberturaPorActor: null,
    medios: null,
    serie: null,

    recoleccion: {
      registro: recoleccion.registro,
      trazaMotores: recoleccion.trazaMotores,
      consultasPlanificadas: recoleccion.consultasPlanificadas,
      metricas: recoleccion.metricas,
      advertencias: recoleccion.advertencias,
      cobertura: recoleccion.cobertura
    },

    costo: recoleccion.costo,

    tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`,

    /*
      CERO EVIDENCIAS NO ES CERO CONVERSACION.

      Es la misma distincion que separa `bloqueado` de `0
      resultados`. Sin esta declaracion, una pantalla vacia se
      lee como "no pasa nada en el territorio", que es la
      conclusion mas peligrosa que puede sacar un analista.
    */
    loQueNoSabemos: [
      "Ninguna fuente devolvio evidencia para este ambito y esta ventana. Eso NO significa que no haya conversacion publica: significa que estas consultas, hoy, no encontraron nada.",
      ...(recoleccion.advertencias || []),
      recoleccion.cobertura?.declaracion
    ].filter(Boolean)
  };
}


export { declararContrato };

export default { analizarConversacionPublica, declararContrato };
