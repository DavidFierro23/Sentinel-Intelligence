// apps/backend/services/ingest/territorialCollector.js

import { iniciarRun, ingerir, cerrarRun } from "./ingestOrchestrator.js";

import rssAdapter from "./adapters/rssAdapter.js";
import youtubeAdapter from "./adapters/youtubeAdapter.js";
import gdeltAdapter from "./adapters/gdeltAdapter.js";

import { TIPOS_CONSULTA } from "../conversation/queryPlanner.js";

/*
===========================================================
COLECTOR TERRITORIAL — TERRITORIAL-FRESH-01
===========================================================

Conecta los adapters que INGEST-REAL-01 dejó escritos con la
ruta territorial que ya existe.

LO QUE ESTE MÓDULO NO ES
-----------------------------------------------------------

No es un segundo motor. `conversationHarvester` sigue haciendo
lo que hacía —Knowledge Lake, Google News, Search Provider
Layer— y no se toca. Esto AÑADE los tres adapters que estaban
implementados y que nadie invocaba:

    RSS directo     escrito, sin conectar
    GDELT           escrito, sin conectar
    YouTube Data    escrito y validado, sin conectar

Auditado antes de escribir una línea: los tres módulos existen
y ninguna ruta los importaba.

PRESUPUESTO ANTES QUE COBERTURA
-----------------------------------------------------------

Cada adapter tiene un tope de consultas POR EJECUCIÓN, y son
deliberadamente bajos:

    RSS       sin tope de coste, pero sí de feeds por pasada
    GDELT     2 consultas   API pública con límite de tasa
    YouTube   1 consulta    cuesta 100 de 10.000 unidades/día

YouTube a UNA consulta no es timidez: son 100 unidades cada
vez, y pulsar «actualizar» cuatro veces al día ya son 400. Con
dos consultas por pasada, ocho actualizaciones agotarían el
día.

QUÉ CONSULTAS SE LANZAN
-----------------------------------------------------------

Las que el planner territorial ya genera, filtradas por tipo.
No se inventan consultas nuevas y no se introduce ningún
candidato, tema ni medio concreto: eso convertiría la escucha
abierta en una búsqueda dirigida.

CADA FALLO SE DECLARA Y NINGUNO TUMBA LA PASADA
-----------------------------------------------------------

Un adapter que falla devuelve su estado y el resto sigue. Es
la misma doctrina del Search Provider Layer: un proveedor
caído es cobertura parcial declarada, no un error de la vista.
===========================================================
*/


export const PRESUPUESTO_POR_PASADA = Object.freeze({
  rss_directo: 8,
  gdelt_doc: 2,
  youtube_data: 1
});


export const MOTIVO_PRESUPUESTO = Object.freeze({
  rss_directo: "Feeds públicos, sin coste. El tope es de tiempo, no de dinero.",
  gdelt_doc: "API pública con límite de tasa no documentado.",
  youtube_data:
    "Una búsqueda cuesta 100 de 10.000 unidades diarias. Cuatro actualizaciones al día ya son 400."
});


/*
-----------------------------------------------------------
QUÉ CONSULTA USA CADA ADAPTER

No todas valen para todo. Mandar una consulta institucional a
YouTube gasta 100 unidades para traer vídeos de un municipio,
que no es escucha territorial abierta.
-----------------------------------------------------------
*/

function consultasPara(providerId, plan = []) {
  const neutrales = plan.filter((c) => c.tipo === TIPOS_CONSULTA.NEUTRAL);

  switch (providerId) {
    /*
      GDELT indexa prensa. Las neutras son las que buscan
      cobertura general del territorio.
    */
    case "gdelt_doc":
      return neutrales.slice(0, PRESUPUESTO_POR_PASADA.gdelt_doc);

    /*
      YouTube: UNA, y la más limpia del plan —territorio más
      ancla, sin variante—. Es la que menos ruido turístico
      arrastra de las disponibles.
    */
    case "youtube_data": {
      const base = neutrales.find((c) => c.piezas?.variante === null) || neutrales[0];

      return base ? [base] : [];
    }

    default:
      return neutrales;
  }
}


/*
===========================================================
RECOLECTAR

`feeds` es la lista de feeds conocidos del registro de medios.
Si está vacía, RSS no se ejecuta y lo dice: no se sale a
descubrir feeds en mitad de una recolección, porque eso serían
peticiones a portadas de medios sin presupuesto declarado.
===========================================================
*/

export async function recolectarAmpliado({
  plan = [],
  feeds = [],
  ventana = null,
  observedAt = null,
  runId = null,
  territoryId = null,
  universo = null,
  registroMedios = null,
  habilitados = null,

  /*
    Inyeccion para pruebas. Sin esto, una suite que habilite
    GDELT sale a internet de verdad: comprobado, dos peticiones
    a api.gdeltproject.org durante la primera ejecucion de los
    tests.

    «Sin red» tiene que ser comprobable, no una intencion.
  */
  inyeccion = null
} = {}) {
  const activo = (id) => !habilitados || habilitados.includes(id);

  const conFetch = inyeccion?.fetch ? { fetch: inyeccion.fetch } : {};

  const run = iniciarRun({ runId, territoryId, startedAt: observedAt });

  const lotes = [];

  /*
    ---------------------------------------------------------
    1. RSS DIRECTO — coste cero, el mejor publicador
    ---------------------------------------------------------
  */
  if (activo("rss_directo")) {
    if (feeds.length === 0) {
      lotes.push({
        providerId: "rss_directo",
        estado: "SIN_FUENTES",
        recibidas: 0,
        evidencias: [],

        motivo:
          "No hay ningún feed declarado en el registro de medios. Sin feeds conocidos no se ejecuta: descubrirlos exige pedir la portada de cada medio y eso es otra operación, con su propio presupuesto."
      });
    } else {
      for (const feed of feeds.slice(0, PRESUPUESTO_POR_PASADA.rss_directo)) {
        const r = await rssAdapter.leerFeed(feed.url, {
          ...(inyeccion?.parseURL ? { parseURL: inyeccion.parseURL } : {}),
          publisher: feed.publisher || null,
          sourceId: feed.sourceId || null,
          observedAt,
          queryType: "FEED_DIRECTO",
          queryLabel: `feed:${feed.sourceId || feed.url}`
        });

        lotes.push({
          providerId: "rss_directo",

          /*
            Que feed produjo este lote. Sin esto, ocho lotes de
            RSS son indistinguibles entre si y no se puede saber
            cual fallo: la rotacion de TERRITORIAL-RSS-ROTATION-01
            necesita atribuir el resultado a su fuente.
          */
          feedUrl: feed.url,
          sourceId: feed.sourceId || null,

          estado: r.estado,
          recibidas: r.recibidas ?? r.evidencias.length,
          latenciaMs: r.latenciaMs,
          motivo: r.error || r.aviso || null,
          evidencias: r.evidencias
        });
      }
    }
  }

  /*
    ---------------------------------------------------------
    2. GDELT — el único con archivo histórico
    ---------------------------------------------------------
  */
  if (activo("gdelt_doc")) {
    const consultas = consultasPara("gdelt_doc", plan);

    for (const c of consultas) {
      const r = await gdeltAdapter.buscar(c.texto, {
        ...conFetch,
        maximo: 50,
        desde: ventana?.desde || null,
        hasta: ventana?.hasta || null,
        queryType: c.tipo,
        queryLabel: c.etiqueta,
        observedAt
      });

      lotes.push({
        providerId: "gdelt_doc",
        estado: r.estado,
        recibidas: r.recibidas ?? 0,
        latenciaMs: r.latenciaMs,
        motivo: r.motivo,
        queries: 1,
        evidencias: r.evidencias || [],
        coberturaObservada: r.coberturaObservada || null
      });
    }
  }

  /*
    ---------------------------------------------------------
    3. YOUTUBE — una sola consulta

    `publishedAfter` acota en origen para no traer vídeos
    turísticos de hace tres años y filtrarlos después: eso
    gastaría la misma cuota para traer más ruido.
    ---------------------------------------------------------
  */
  if (activo("youtube_data")) {
    const consultas = consultasPara("youtube_data", plan);

    for (const c of consultas) {
      const r = await youtubeAdapter.buscar(c.texto, {
        ...conFetch,
        maximo: 15,
        orden: "date",
        publicadoDespuesDe: ventana?.desde || null,
        queryType: c.tipo,
        queryLabel: c.etiqueta,
        observedAt
      });

      lotes.push({
        providerId: "youtube_data",
        estado: r.estado,
        recibidas: r.recibidas ?? 0,
        latenciaMs: r.latenciaMs,
        motivo: r.motivo,
        queries: 1,
        unidadesConsumidas: r.unidadesConsumidas ?? 0,
        evidencias: r.evidencias || [],
        canalesDetectados: r.canalesDetectados || []
      });
    }
  }

  /*
    ---------------------------------------------------------
    4. INGESTA — normalización, dedup y alta de fuentes

    Lo hace el orquestador que ya existe. Aquí no se duplica
    nada de esa lógica.
    ---------------------------------------------------------
  */
  const resultado = ingerir({
    lotes,
    run,
    universo,
    registroMedios,
    observedAt
  });

  cerrarRun(run, { finishedAt: new Date().toISOString() });

  return {
    run,

    evidencias: resultado.evidencias,

    dedup: resultado.dedup,
    nuevasFuentes: resultado.nuevasFuentes,
    rechazadas: resultado.rechazadas,

    lotes: lotes.map((l) => ({
      providerId: l.providerId,

      /* Identidad del feed: null en los proveedores que no son RSS. */
      feedUrl: l.feedUrl || null,
      sourceId: l.sourceId || null,

      estado: l.estado,
      recibidas: l.recibidas,
      motivo: l.motivo,
      unidadesConsumidas: l.unidadesConsumidas ?? null,
      canalesDetectados: (l.canalesDetectados || []).length || null,
      coberturaObservada: l.coberturaObservada || null
    })),

    presupuesto: {
      aplicado: PRESUPUESTO_POR_PASADA,
      motivos: MOTIVO_PRESUPUESTO
    },

    declaracion:
      "Los adapters de INGEST-REAL-01 estaban escritos y sin conectar. Este módulo los invoca; no reimplementa ninguno ni sustituye al recolector existente."
  };
}


/*
-----------------------------------------------------------
ESTADO DE LOS ADAPTERS

Comprueba de verdad, no supone. Un fichero adapter que existe
no es un proveedor que funciona: es la distinción que el
propio gate exige declarar.
-----------------------------------------------------------
*/

export function estadoAdapters() {
  const yt = youtubeAdapter.diagnostico();

  const gd = gdeltAdapter.diagnostico();

  const rss = rssAdapter.diagnostico();

  return [
    {
      providerId: "rss_directo",
      nombre: rss.nombre,
      implementado: true,
      requiereCredencial: false,
      estado: "CONFIGURADO",
      presupuestoPorPasada: PRESUPUESTO_POR_PASADA.rss_directo,
      nota: "Depende de que haya feeds declarados en el registro de medios."
    },
    {
      providerId: "gdelt_doc",
      nombre: gd.nombre,
      implementado: true,
      requiereCredencial: false,
      estado: "CONFIGURADO",
      presupuestoPorPasada: PRESUPUESTO_POR_PASADA.gdelt_doc,
      nota: "Cobertura de prensa local SIN MEDIR."
    },
    {
      providerId: "youtube_data",
      nombre: yt.nombre,
      implementado: true,
      requiereCredencial: true,
      estado: youtubeAdapter.estaConfigurado() ? "CONFIGURADO" : "NO_CONFIGURADO",
      presupuestoPorPasada: PRESUPUESTO_POR_PASADA.youtube_data,
      nota: "Una búsqueda cuesta 100 unidades. Puede devolver contenido turístico o musical aunque mencione el territorio."
    }
  ];
}


export default {
  PRESUPUESTO_POR_PASADA,
  recolectarAmpliado,
  estadoAdapters
};
