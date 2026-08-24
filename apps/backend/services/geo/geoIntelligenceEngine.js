// apps/backend/services/geo/geoIntelligenceEngine.js

import { resolverLote } from "./geoResolver.js";
import { agregar } from "./spatialAggregator.js";
import { normalizar, catalogoNormalizaciones } from "./normalizer.js";
import { construirSerie, compararPeriodos } from "./territorialTimeline.js";
import { detectarAnomalias } from "./anomalyDetector.js";

import {
  estadoRegistro,
  resolverAmbito,
  unidadPorId,
  listarUnidades
} from "./territoryRegistry.js";

import { declararContrato, RESOLUCIONES } from "./geoContracts.js";

/*
===========================================================
GEO INTELLIGENCE ENGINE — orquestador territorial
===========================================================

Una sola puerta al motor geografico:

    resolver -> agregar (GEO-1) -> normalizar -> serie ->
    anomalias

EL MOTOR NO SABE DE ELECCIONES
-----------------------------------------------------------

UX-WR-001 §12.1: el War Room electoral es el PRIMER modulo de
un motor geoespacial reutilizable, no su definicion. Este
archivo no menciona candidatos, dignidades ni campanas. Sabe
de territorio, series, magnitudes y anomalias.

Lo que cambia entre un paquete de dominio y otro es el
conjunto de unidades, el denominador y el catalogo de
factores. Nada de eso vive aqui.

QUE ENTRA
-----------------------------------------------------------

Evidencias genericas: cualquier objeto con titulo,
descripcion, enlace y fecha. No importa si vienen del Fusion
Engine, del Knowledge Lake o de la capa de conversacion
publica. El motor no pregunta de donde salen.

QUE SALE
-----------------------------------------------------------

Un agregado territorial con su resolucion efectiva declarada,
su normalizacion (o el motivo de que no la haya), su serie
temporal, sus anomalias y un unico bloque «lo que no sabemos».
===========================================================
*/


export async function analizarTerritorio(evidencias = [], opciones = {}) {
  const inicio = Date.now();

  const lista = Array.isArray(evidencias) ? evidencias : [];

  /*
    ---------------------------------------------------------
    0. AMBITO

    Lo declara el analista. Si no se reconoce, el analisis
    sigue —los toponimos se resuelven igual— pero SIN el
    contexto que desambigua, y eso se declara.
    ---------------------------------------------------------
  */
  const ambito = opciones.ambitoId
    ? { unidad: unidadPorId(opciones.ambitoId), reconocido: Boolean(unidadPorId(opciones.ambitoId)), motivo: null }
    : resolverAmbito(opciones.territorio || {});

  const ambitoId = ambito.unidad?.id || null;

  const resolucionPedida = opciones.resolucion || RESOLUCIONES.PARROQUIA;

  /*
    ---------------------------------------------------------
    1. RESOLVER
    ---------------------------------------------------------
  */
  const resueltas = resolverLote(lista, {
    ambitoId,
    pistaPorEvidencia: opciones.pistaPorEvidencia || null,
    resolucionMaxima: opciones.resolucionMaxima || null
  });

  /*
    ---------------------------------------------------------
    2. AGREGAR — GEO-1
    ---------------------------------------------------------
  */
  const agregado = agregar(resueltas, {
    resolucion: resolucionPedida,
    umbralMuestra: opciones.umbralMuestra,
    ambitoId,
    incluirVacias: opciones.incluirVacias === true
  });

  /*
    ---------------------------------------------------------
    3. NORMALIZAR

    Con los denominadores oficiales pendientes, esto devuelve
    `disponible:false` en todos los modos salvo `absoluto`. Se
    ejecuta igual, y a proposito: la respuesta debe declarar
    que se intento y por que no se pudo, no omitir el campo.
    ---------------------------------------------------------
  */
  const normalizado = normalizar(agregado, {
    modo: opciones.normalizacion || "absoluto"
  });

  const normalizacionesDisponibles = catalogoNormalizaciones(
    agregado.unidades.map((u) => u.unidadId)
  );

  /*
    ---------------------------------------------------------
    4. SERIE TEMPORAL
    ---------------------------------------------------------
  */
  const serie = construirSerie(resueltas, {
    granularidad: opciones.granularidad,
    desde: opciones.desde,
    hasta: opciones.hasta,
    umbralMuestra: opciones.umbralMuestra
  });

  /*
    ---------------------------------------------------------
    5. ANOMALIAS
    ---------------------------------------------------------
  */
  const anomalias = detectarAnomalias(serie, {
    umbralMuestra: opciones.umbralMuestra
  });

  /*
    ---------------------------------------------------------
    6. COMPARACION CON EL PERIODO ANTERIOR — opcional

    Solo si el llamante aporta las evidencias del periodo
    previo. No se inventan: comparar contra un periodo que no
    se observo produciria variaciones que solo miden el
    esfuerzo de observacion.
    ---------------------------------------------------------
  */
  let comparacion = null;

  if (Array.isArray(opciones.evidenciasPeriodoAnterior)) {
    const previas = resolverLote(opciones.evidenciasPeriodoAnterior, {
      ambitoId,
      pistaPorEvidencia: opciones.pistaPorEvidencia || null
    });

    const seriePrevia = construirSerie(previas, {
      granularidad: opciones.granularidad,
      umbralMuestra: opciones.umbralMuestra
    });

    comparacion = compararPeriodos(serie, seriePrevia);
  }

  const registro = estadoRegistro();

  return {
    modulo: "geo_intelligence",
    version: "1.0",

    contrato: declararContrato(),

    ambito: {
      unidadId: ambitoId,
      nombre: ambito.unidad?.nombre || null,
      resolucion: ambito.unidad?.resolucion || null,
      reconocido: Boolean(ambitoId),
      motivo: ambito.motivo || null
    },

    resolucion: {
      pedida: agregado.resolucionPedida,
      efectiva: agregado.resolucionEfectiva,
      coincide: agregado.coincideConLoPedido,

      /*
        Lo que la interfaz debe anunciar antes de que el
        analista haga zoom (regla de interaccion 3).
      */
      aviso: agregado.coincideConLoPedido
        ? null
        : `Esta vista no tiene resolucion por "${agregado.resolucionPedida}". Datos disponibles a nivel "${agregado.resolucionEfectiva || "ninguno"}".`
    },

    ubicacion: {
      metricas: resueltas.metricas,
      declaracion: resueltas.declaracion,

      /*
        Muestra acotada de los sin ubicar. La cifra ya esta en
        las metricas; esto permite AUDITAR por que no se
        ubicaron, que es lo que evita que el contador se
        convierta en un numero que nadie mira.
      */
      ejemplosSinUbicar: resueltas.sinUbicar.slice(0, 10).map((s) => ({
        titulo: s.evidencia?.titulo || null,
        motivo: s.ubicacion?.motivo || s.motivoDescartada || null,
        toponimosDetectados: s.ubicacion?.toponimosDetectados || [],
        candidatasDescartadas: (s.ubicacion?.candidatas || []).map((c) => c.nombre)
      }))
    },

    agregado,

    normalizacion: {
      aplicada: normalizado,
      disponibles: normalizacionesDisponibles,

      /*
        Regla dura, repetida donde se consume. Ver normalizer.js.
      */
      reglaDura:
        "Sin denominador oficial no se calcula ninguna metrica per capita, ningun porcentaje poblacional y ninguna intensidad relativa. No se estima."
    },

    serie,
    anomalias,
    comparacion,

    registroTerritorial: {
      catalogos: registro.catalogos,
      metricas: registro.metricas,
      carencias: registro.carencias,
      resolucionMasFinaDisponible: registro.resolucionMasFinaDisponible
    },

    tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`,

    loQueNoSabemos: reunirLoQueNoSabemos({
      ambito,
      agregado,
      serie,
      anomalias,
      normalizado,
      registro
    })
  };
}


function reunirLoQueNoSabemos(p) {
  const lista = [
    !p.ambito.unidad
      ? `El ambito territorial no se reconocio${p.ambito.motivo ? `: ${p.ambito.motivo}` : "."} Sin ambito, los toponimos ambiguos no se desambiguan y quedan sin ubicar.`
      : null,

    ...(p.agregado?.loQueNoSabemos || []),
    ...(p.serie?.loQueNoSabemos || []),
    ...(p.anomalias?.loQueNoSabemos || []),

    p.normalizado?.disponible === false
      ? `Normalizacion no disponible: ${p.normalizado.motivo}`
      : null,

    ...(p.registro?.carencias || []).map(
      (c) => `${c.titulo}: ${c.detalle}`
    )
  ].filter(Boolean);

  return [...new Set(lista)];
}


/*
===========================================================
CATALOGO PARA LA INTERFAZ

Lo que el modulo puede ofrecer AHORA MISMO, con las carencias
declaradas. La interfaz lo usa para no presentar como elegible
algo que devolvera un bloqueo.
===========================================================
*/

export function catalogoTerritorial() {
  const registro = estadoRegistro();

  const unidades = listarUnidades();

  return {
    contrato: declararContrato(),

    registro: {
      catalogos: registro.catalogos,
      metricas: registro.metricas,
      carencias: registro.carencias,
      errores: registro.errores,
      avisos: registro.avisos
    },

    unidades: unidades.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      resolucion: u.resolucion,
      tipo: u.tipo || null,
      jerarquia: u.jerarquia,
      padre: u.padre || null,
      ambiguo: u.ambiguo,
      ambiguedad: u.ambiguedad || null,
      verificado: u.verificado,
      geometria: Boolean(u.geometria)
    })),

    normalizaciones: catalogoNormalizaciones(unidades.map((u) => u.id)),

    /*
      El mensaje que la interfaz debe mostrar en cada campo que
      depende de un dato oficial ausente.
    */
    etiquetaDatoPendiente: "Dato oficial pendiente de integracion",

    capacidades: {
      disponible: [
        "Resolucion de toponimos con procedencia declarada",
        "Agregacion territorial con GEO-1",
        "Ranking por conteo absoluto",
        "Series temporales por unidad",
        "Deteccion de anomalias sobre la propia serie",
        "Variacion de una unidad respecto de si misma entre periodos"
      ],

      noDisponible: [
        {
          que: "Mapa y coropleta",
          porque: "No hay GeoJSON oficial de las parroquias (riesgo WR-3).",
          requiere: "GAD Municipal de Cuenca / geoportal INEC"
        },
        {
          que: "Normalizacion por poblacion o padron",
          porque: "No hay denominadores oficiales integrados.",
          requiere: "INEC / CNE"
        },
        {
          que: "Superficie en km2",
          porque:
            "Depende de la geometria oficial y de calcularla en EPSG:32717, no en Web Mercator.",
          requiere: "GeoJSON oficial"
        },
        {
          que: "Atribucion de causa",
          porque:
            "Prohibida por diseno. Solo cabe contribucion y secuencia, y eso es el Attribution Engine (UX-3).",
          requiere: "no aplica: es una restriccion congelada (WR-D13)"
        }
      ]
    }
  };
}


export default { analizarTerritorio, catalogoTerritorial };
