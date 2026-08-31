// apps/backend/routes/territorio.js

import express from "express";

import {
  analizarTerritorio,
  catalogoTerritorial
} from "../services/geo/geoIntelligenceEngine.js";

import {
  contextoTerritorialDeProyecto,
  ambitoDeclarado
} from "../services/geo/projectTerritoryBridge.js";

import { analizarConversacionPublica } from "../services/conversation/publicConversationEngine.js";

import { declararContrato as contratoConversacion } from "../services/conversation/conversationContracts.js";

import {
  pistaDeFuente,
  catalogoMedios,
  identificarFuente
} from "../services/conversation/mediaRegistry.js";

import { recargarRegistro } from "../services/geo/territoryRegistry.js";

import {
  cruzarTemaTerritorio,
  construirMatriz,
  compararVentanas,
  toponimosDe,
  TIPOS_SENAL,
  TERRITORIO_NO_RESUELTO
} from "../services/geo/topicTerritoryCrosstab.js";

import {
  construirAgenda,
  construirMapa
} from "../services/geo/territorialAgenda.js";

/* --- D2: Open Listening Foundation --- */

import {
  medirSesgo,
  separarCorpusPorTipoDeConsulta
} from "../services/conversation/queryPlanner.js";

import {
  construirUniverso,
  crearUniverso,
  listarFuentes,
  estadoUniverso
} from "../services/conversation/sourceUniverse.js";

import { clasificarUniverso } from "../services/conversation/sourceClassifier.js";

import {
  medirDiversidad,
  separarCorpusPorAgenda
} from "../services/conversation/sourceDiversity.js";

import {
  separarEntidadesDeTemas,
  relacionarEntidadesConTemas
} from "../services/conversation/entityTopicSeparation.js";

import {
  componerSnapshot,
  crearAlmacenFichero,
  guardarSnapshot,
  buscarVentanaAnterior,
  compararConVentanaAnterior
} from "../services/territorial/snapshotStore.js";

import { matrizProveedores } from "../services/providers/providerAudit.js";

import { estadoBenchmark } from "../services/contracts/providerBenchmark.js";

import { estadoAiRouter } from "../services/contracts/aiRouter.js";

/* --- INGEST-REAL-01 --- */

import { evaluarTodasLasVentanas } from "../services/territorial/temporalWindows.js";

import { componerCobertura } from "../services/ingest/coverageObservability.js";

import { estadoViabilidadSocial } from "../services/contracts/socialPlatformFeasibility.js";

import { fichaComparacion } from "../services/contracts/ingestBenchmark.js";

import { estadoScheduler } from "../services/ingest/collectorScheduler.js";

/* --- TERRITORIAL-FRESH-01 --- */

import {
  ventanaDelDia,
  ventanaDeDias,
  resumirFrescura,
  distribucionTemporal,
  clasificarFrescura,
  ZONA_POR_DEFECTO
} from "../services/territorial/dayWindow.js";

import {
  crearLedgerFichero,
  reconstruirEstado,
  registrarPasada
} from "../services/territorial/evidenceLedger.js";

import {
  recolectarAmpliado,
  estadoAdapters
} from "../services/ingest/territorialCollector.js";

import { crearRegistroMedios, listarMedios } from "../services/ingest/mediaSourceRegistry.js";

/*
  DOS ALIAS OBLIGADOS

  `estadoUniverso` ya lo exporta `conversation/sourceUniverse.js`
  y son cosas distintas: aquel resume las fuentes OBSERVADAS en
  la evidencia; este, las COMPROBADAS por HTTP.

  `crearAlmacenFichero` ya lo exporta `snapshotStore.js`, y
  tampoco es el mismo almacen: uno guarda snapshots de ventana,
  el otro comprobaciones de fuentes.

  Sin los alias el modulo no compila, y con ellos queda claro
  cual es cual en cada llamada.
*/
import {
  candidatosPara,
  feedsParaRecoleccion,
  estadoUniverso as estadoUniversoFuentes,
  ESTADOS_FUENTE
} from "../services/territorial/verifiedSourceUniverse.js";

import { comprobarUniverso } from "../services/territorial/sourceVerifier.js";

/* --- TERRITORIAL-ACCELERATION-02 --- */

import {
  indiceDeFeeds,
  resolverLoteDeEmisores,
  ESTADOS_EMISOR
} from "../services/territorial/emitterResolver.js";

/* --- TERRITORIAL-RSS-ROTATION-01 --- */

import {
  PRESUPUESTO_POR_PASADA as PRESUPUESTO_RECOLECTOR
} from "../services/ingest/territorialCollector.js";

import {
  ambitoDeRotacion,
  seleccionarCohorte,
  clasificarIntento,
  registrarRotacion,
  reconstruirRotacion,
  siguienteCicloYPasada,
  estadoRotacion,
  crearAlmacenFichero as crearAlmacenDeRotacion
} from "../services/territorial/rssRotation.js";

import {
  crearAlmacenFichero as crearAlmacenDeFuentes,
  registrarComprobacion,
  reconstruirUniverso
} from "../services/territorial/sourceUniverseStore.js";

import { huellaDeEvidencia } from "../services/ingest/evidenceContract.js";

import { normalizarUrl } from "../services/textUtils.js";

import { listarUnidades } from "../services/geo/territoryRegistry.js";

/*
===========================================================
RUTAS DE INTELIGENCIA TERRITORIAL Y CONVERSACION PUBLICA
===========================================================

Dos motores, una ruta:

    services/geo/           donde ocurre
    services/conversation/  que se publica

Se componen aqui y no dentro de ninguno de los dos, para que
ninguno dependa del otro. `geo/` no sabe que existe un
registro de medios; recibe una FUNCION que le da la pista de
cobertura por evidencia, y esa funcion la inyecta esta capa.

Es el mismo patron por el que el Fusion Engine no conoce a
ningun buscador concreto.

COSTE DECLARADO EN TODA RESPUESTA
-----------------------------------------------------------

El modo por defecto no gasta saldo de SerpAPI. El modo `web`
lo gasta y hay que pedirlo explicitamente. Cada respuesta dice
cuanto costo, gastara o no: un analista que no sabe el coste
de una vista no puede decidir si repetirla.
===========================================================
*/

const router = express.Router();


/*
-----------------------------------------------------------
CATALOGO — que unidades hay, que se puede y que no
-----------------------------------------------------------
*/

router.get("/catalogo", (req, res) => {
  try {
    res.json({
      territorio: catalogoTerritorial(),
      conversacion: contratoConversacion(),
      medios: catalogoMedios()
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al leer el catalogo" });
  }
});


/*
-----------------------------------------------------------
SALUD DEL MODULO
-----------------------------------------------------------
*/

router.get("/salud", (req, res) => {
  try {
    const catalogo = catalogoTerritorial();

    res.json({
      modulo: "Inteligencia Territorial y Conversacion Publica",
      version: "1.0",
      estado: catalogo.registro.errores.length ? "Degradado" : "Operativo",

      registroTerritorial: {
        unidades: catalogo.registro.metricas.unidades,
        porResolucion: catalogo.registro.metricas.porResolucion,
        errores: catalogo.registro.errores
      },

      /*
        Las carencias son parte del estado de salud, no una
        nota al pie. Un modulo que se declara "Operativo" sin
        decir que le faltan la geometria y los denominadores
        estaria informando mal.
      */
      carencias: catalogo.registro.carencias,

      etiquetaDatoPendiente: catalogo.etiquetaDatoPendiente,

      capacidades: catalogo.capacidades
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo el diagnostico" });
  }
});


/*
-----------------------------------------------------------
RECARGAR CATALOGOS

Para cuando se integren el GeoJSON o los denominadores
oficiales: no hace falta reiniciar el backend.
-----------------------------------------------------------
*/

router.post("/recargar", (req, res) => {
  try {
    recargarRegistro();

    res.json({ recargado: true, catalogo: catalogoTerritorial().registro });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo la recarga" });
  }
});


/*
===========================================================
UNIVERSO DE FUENTES — TERRITORIAL-SOURCE-UNIVERSE-01
===========================================================

Dos rutas, y la separacion entre ellas es deliberada:

  GET  /fuentes            lee lo ya comprobado. Cero red.
  POST /fuentes/verificar  sale a comprobar. Gasta peticiones.

Consultar el universo NO debe salir a internet. Si leerlo
disparara comprobaciones, abrir el panel pediria la portada de
veinte medios.
===========================================================
*/

function almacenDeFuentes() {
  return crearAlmacenDeFuentes();
}


function almacenDeRotacion() {
  return crearAlmacenDeRotacion();
}


router.get("/fuentes", async (req, res) => {
  try {
    const almacen = almacenDeFuentes();

    const universo = reconstruirUniverso(await almacen.leerTodos());

    const fichas = [...universo.values()];

    const territorioId = req.query?.territorio || null;

    const filtradas = territorioId
      ? fichas.filter(
          (f) => f.territorioId === territorioId || f.territorioDeclarado === territorioId
        )
      : fichas;

    res.json({
      gate: "TERRITORIAL-SOURCE-UNIVERSE-01",

      territorioId,

      resumen: estadoUniversoFuentes(filtradas),

      /*
        Los feeds que ALIMENTARIAN una recoleccion ahora mismo.
        Se muestran para que el panel pueda decir cuantos hay sin
        tener que ejecutar nada.
      */
      feedsDisponibles: feedsParaRecoleccion(filtradas),

      fuentes: filtradas.sort(
        (a, b) => a.prioridad - b.prioridad || String(a.nombre).localeCompare(String(b.nombre))
      ),

      /*
        Candidatos que existen y NUNCA se han comprobado. Sin
        esta cifra, un universo vacio y uno completo se leen
        igual.
      */
      candidatosSinComprobar: territorioId
        ? candidatosPara(territorioId)
            .filter((c) => !universo.has(c.sourceId))
            .map((c) => ({
              sourceId: c.sourceId,
              nombre: c.nombre,
              prioridad: c.prioridad,
              metodoDescubrimiento: c.metodoDescubrimiento
            }))
        : [],

      declaracion:
        "Esta ruta NO sale a internet: devuelve lo que ya se comprobó. Para comprobar, POST /fuentes/verificar."
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo al leer el universo de fuentes" });
  }
});


router.post("/fuentes/verificar", async (req, res) => {
  try {
    const cuerpo = req.body || {};

    const territorioId = cuerpo.territorio || "ec-azuay-cuenca";

    const almacen = almacenDeFuentes();

    const estadoPrevio = reconstruirUniverso(await almacen.leerTodos());

    /*
      Comprobacion REAL: robots.txt, portadas y feeds publicos.
      Coste 0 USD y ninguna credencial. Es la unica operacion de
      este gate que sale a la red.
    */
    const universo = await comprobarUniverso({
      territorioId,
      instante: new Date().toISOString(),
      limite: cuerpo.limite || null,
      incluirNacionales: cuerpo.incluirNacionales !== false,
      ...(cuerpo.soloSourceIds
        ? {
            candidatos: candidatosPara(territorioId).filter((c) =>
              cuerpo.soloSourceIds.includes(c.sourceId)
            )
          }
        : {})
    });

    const registro = await registrarComprobacion({
      almacen,
      universo,
      estadoPrevio,
      runId: `fuentes-${universo.comprobadoEn}`
    });

    res.json({
      gate: "TERRITORIAL-SOURCE-UNIVERSE-01",

      territorioId,
      comprobadoEn: universo.comprobadoEn,

      resumen: universo.resumen,
      metricas: registro.metricas,
      coste: universo.coste,

      feedsDisponibles: feedsParaRecoleccion(registro.fichas),

      fuentes: registro.fichas,

      declaraciones: [...universo.resumen.declaraciones, ...registro.declaraciones]
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo la comprobacion de fuentes" });
  }
});


/*
===========================================================
PROVEEDORES Y MOTORES — TERRITORIAL-ACCELERATION-02
===========================================================

Lo que Sentinel usa HOY y lo que está en evaluación, con su
estado real.

NUNCA FINGIR INTEGRACION
-----------------------------------------------------------

Un candidato en evaluación no es un motor conectado. Los cuatro
proveedores externos aparecen con el estado que les dio
`docs/TERRITORIAL-PROVIDER-EVAL-01.md`, y ninguno está
`OPERATIVO`: eso exige una prueba real contra Cuenca que
todavía no se ha podido hacer en ninguno.

El estado de los motores propios NO se escribe a mano: sale de
`estadoAdapters()` y del universo de fuentes comprobado.
===========================================================
*/

/*
  Candidatos evaluados en TERRITORIAL-PROVIDER-EVAL-01. Viven
  aquí como DECLARACION de la evaluación, no como integración:
  ninguno tiene adapter.
*/
const CANDIDATOS_EXTERNOS = Object.freeze([
  {
    providerId: "gdelt_cloud",
    nombre: "GDELT Cloud (BigQuery)",
    tipo: "noticias · eventos · geo",
    estado: "APTO_PARA_PRUEBA",
    integrado: false,
    trial: "Sandbox de BigQuery: sin tarjeta, 1 TB/mes",
    coste: "0 USD en sandbox",
    ecuador: "documentado a nivel país",
    cuenca: "NO PROBADO",
    aporta: "Histórico desde 1979 y extracción geográfica explícita: es el único que ataca las evidencias sin territorio resuelto.",
    ranking: 1
  },
  {
    providerId: "data365",
    nombre: "Data365",
    tipo: "conversación pública",
    estado: "APTO_PARA_PRUEBA",
    integrado: false,
    trial: "14 días sin tarjeta, previa llamada",
    coste: "desde ~300 EUR/mes tras el trial",
    ecuador: "no documentado",
    cuenca: "NO PROBADO",
    aporta: "Conversación pública, que Sentinel no observa en absoluto. No es una mejora incremental: es una dimensión nueva.",
    ranking: 2
  },
  {
    providerId: "meltwater",
    nombre: "Meltwater",
    tipo: "medios · social",
    estado: "REQUIERE_CONTACTO",
    integrado: false,
    trial: "no hay prueba autoservicio",
    coste: "~65.000 USD/año (terceros)",
    ecuador: "no documentado",
    cuenca: "NO PROBADO",
    aporta: "Cobertura profesional de medios y social en un solo proveedor. No se puede comprobar Cuenca sin contratar.",
    ranking: 3
  },
  {
    providerId: "brandwatch",
    nombre: "Brandwatch",
    tipo: "escucha social",
    estado: "REQUIERE_CONTACTO",
    integrado: false,
    trial: "no hay prueba pública",
    coste: "~50.000 USD/año (terceros)",
    ecuador: "no documentado",
    cuenca: "NO PROBADO",
    aporta: "Conversación pública, pero su histórico asequible son 30 días: menos que nuestras ventanas de 90.",
    ranking: 4
  }
]);


router.get("/proveedores", async (req, res) => {
  try {
    /* --- motores propios: estado REAL, no escrito a mano --- */
    const adapters = estadoAdapters();

    const universo = reconstruirUniverso(await almacenDeFuentes().leerTodos());

    const fichas = [...universo.values()];

    const feedsValidos = feedsParaRecoleccion(fichas).length;

    const rotacion = reconstruirRotacion(await almacenDeRotacion().leerTodos());

    const ledger = crearLedgerFichero();

    const observaciones = await ledger.leerTodos();

    /* Qué proveedor aportó de verdad al corpus. */
    const porProveedor = {};

    observaciones.forEach((o) => {
      if (!o.providerId) return;

      porProveedor[o.providerId] = (porProveedor[o.providerId] || 0) + 1;
    });

    const motores = adapters.map((a) => {
      const observadas = porProveedor[a.providerId] || 0;

      /*
        OPERATIVO exige haber aportado evidencia al corpus. Un
        adapter configurado que nunca trajo nada no es un motor
        operativo: es un adapter configurado.
      */
      const estado =
        observadas > 0
          ? "OPERATIVO"
          : a.providerId === "gdelt_doc"
            ? "NO_ALCANZABLE"
            : a.estado;

      return {
        ...a,
        integrado: true,
        estado,
        observacionesEnElCorpus: observadas,

        nota:
          a.providerId === "rss_directo"
            ? `${feedsValidos} feed(s) con contenido comprobado · ${rotacion.pasada} pasada(s) de rotación registradas.`
            : a.providerId === "gdelt_doc"
              ? "Inalcanzable desde esta máquina: UND_ERR_CONNECT_TIMEOUT reproducible. Ver docs/TERRITORIAL-PROVIDER-EVAL-01.md."
              : a.nota
      };
    });

    /*
      Motores que APORTARON al corpus y no figuran en
      `estadoAdapters()`: `google_news` entra por el recolector
      base, no por un adapter de ingesta. Omitirlo haria que la
      vista de proveedores no explicase de donde salieron 227
      observaciones reales.
    */
    const declarados = new Set(motores.map((m) => m.providerId));

    const noDeclarados = Object.entries(porProveedor)
      .filter(([id]) => !declarados.has(id))
      .map(([id, n]) => ({
        providerId: id,
        nombre: id === "google_news" ? "Google News (recolector base)" : id,
        tipo: "noticias",
        implementado: true,
        integrado: true,
        requiereCredencial: false,
        estado: "OPERATIVO",
        observacionesEnElCorpus: n,

        nota:
          id === "google_news"
            ? "Entra por el recolector base, no por un adapter de ingesta. Oculta al publicador: sus evidencias quedan con emisor NO_RESUELTO."
            : "Aportó al corpus sin figurar en el registro de adapters."
      }));

    res.json({
      gate: "TERRITORIAL-ACCELERATION-02",

      motores: [...motores, ...noDeclarados].sort(
        (a, b) => b.observacionesEnElCorpus - a.observacionesEnElCorpus
      ),

      candidatos: CANDIDATOS_EXTERNOS,

      evaluacion: {
        documento: "docs/TERRITORIAL-PROVIDER-EVAL-01.md",
        proveedor1: "gdelt_cloud",
        proveedor2: "data365",

        declaracion:
          "Ningún candidato está OPERATIVO: eso exige una prueba real contra Cuenca que todavía no se ha podido hacer en ninguno. Ecuador y Cuenca están NO VERIFICADO en los cuatro."
      },

      declaraciones: [
        "OPERATIVO significa que el motor aportó evidencia al corpus, no que esté configurado.",
        "Un candidato en evaluación NO es una integración: ninguno de los cuatro tiene adapter.",
        "«Global coverage» en una página comercial no significa que Cuenca esté cubierta."
      ]
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo el estado de proveedores" });
  }
});


/*
===========================================================
OBSERVAR — TERRITORIAL-ACCELERATION-02
===========================================================

Una pasada RSS que SI escribe en el libro de evidencias.

POR QUE HACIA FALTA ESTA RUTA
-----------------------------------------------------------

Las pasadas de TERRITORIAL-RSS-ROTATION-01 midieron el dedup
contra el corpus SIN escribir en el: era la decision
conservadora de un gate sobre rotacion. El efecto secundario lo
midio §13-terdecies: el corpus persistido seguia siendo de
Google News, y los tres cruces reales salieron con CERO
emisores resueltos.

Sin escritura no hay historico, y sin historico no hay
tendencia. Esta ruta cierra el circuito:

    RSS -> normalizacion -> evidencia -> dedup -> libro
        -> Tema x Territorio -> historico

`/analisis` tambien persiste, pero recolecta con Google News.
Esta ruta ejecuta SOLO `rss_directo`: coste 0 y ningun
proveedor de pago.

NO HAY BACKFILL
-----------------------------------------------------------

El historico empieza cuando empieza. No se fabrican dias
anteriores ni se retrodata nada: `publishedAt` es del medio y
`firstObservedAt` es de Sentinel, y ninguno se toca.
===========================================================
*/

router.post("/observar", async (req, res) => {
  try {
    const cuerpo = req.body || {};

    const territorioId = cuerpo.territorio || "ec-azuay-cuenca";

    /*
      El proyecto es el AMBITO. Se admite su ausencia —hay
      pruebas y usos sin proyecto— pero entonces se declara
      `null` y esa observacion no pertenece a ningun proyecto.
    */
    const projectId = cuerpo.proyectoId || null;

    const retrievedAt = new Date().toISOString();

    /* --- 1. feeds elegibles del universo comprobado --- */
    const almacenFtes = almacenDeFuentes();

    const universo = reconstruirUniverso(await almacenFtes.leerTodos());

    const fichas = [...universo.values()];

    const elegibles = feedsParaRecoleccion(fichas);

    if (elegibles.length === 0) {
      return res.json({
        gate: "TERRITORIAL-ACCELERATION-02",
        projectId,
        territorioId,
        persistidas: 0,

        motivo:
          "No hay feeds elegibles. Ejecutar POST /api/territorio/fuentes/verificar antes de observar."
      });
    }

    /* --- 2. rotacion: que feeds toca esta pasada --- */
    const presupuesto = PRESUPUESTO_RECOLECTOR.rss_directo;

    const ambitoRot = ambitoDeRotacion({ projectId, territoryId: territorioId });

    const almacenRot = almacenDeRotacion();

    const previoRot = reconstruirRotacion(await almacenRot.leerTodos(), ambitoRot.scopeId);

    const siguiente = siguienteCicloYPasada({
      estado: previoRot.estado,
      ciclo: previoRot.ciclo,
      pasada: previoRot.pasada,
      elegibles
    });

    const cohorte = seleccionarCohorte({
      elegibles,
      estado: previoRot.estado,
      presupuesto,
      ciclo: siguiente.ciclo,
      pasada: siguiente.pasada
    });

    const feeds = cohorte.seleccionados.map((f) => ({
      url: f.feedUrl,
      publisher: f.publisher,
      sourceId: f.sourceId,
      prioridad: f.prioridad,
      territorioDeclarado: f.territorioDeclarado
    }));

    /* --- 3. recoleccion: SOLO rss_directo --- */
    const pasada = await recolectarAmpliado({
      plan: [],
      feeds,
      observedAt: retrievedAt,
      runId: `observar-${retrievedAt}`,
      territoryId: territorioId,
      habilitados: ["rss_directo"]
    });

    /* --- 4. emisor: el feed comprobado acredita al publicador --- */
    const indice = indiceDeFeeds(fichas);

    /*
      Se ata cada evidencia a SU feed antes de resolver: el
      recolector emite `queryLabel` con el sourceId, y el lote
      lleva `feedUrl` desde TERRITORIAL-RSS-ROTATION-01.
    */
    const feedPorSource = new Map(feeds.map((f) => [f.sourceId, f.url]));

    const conFeed = pasada.evidencias.map((e) => ({
      ...e,
      feedUrl: feedPorSource.get(e.sourceId) || e.provenance?.query || null,
      domain: e.sourceId || null
    }));

    const emisores = resolverLoteDeEmisores(conFeed, { indice, instante: retrievedAt });

    /* --- 5. persistir: dedup contra el corpus DEL PROYECTO --- */
    const ledger = crearLedgerFichero();

    const observaciones = await ledger.leerTodos();

    const estadoPrevio = reconstruirEstado(observaciones, { projectId });

    const registro = await registrarPasada({
      ledger,
      evidencias: emisores.evidencias,
      estadoPrevio,
      retrievedAt,
      territoryId: territorioId,
      projectId,
      runId: `observar-${retrievedAt}`
    });

    /* --- 6. anotar la rotacion --- */
    const lotesRss = (pasada.lotes || []).filter(
      (l) => l.providerId === "rss_directo" && l.feedUrl
    );

    const rotacionAnotada = await registrarRotacion({
      almacen: almacenRot,
      scopeId: ambitoRot.scopeId,
      cohorte,
      resultados: lotesRss.map((l) => ({
        feedUrl: l.feedUrl,
        estado: clasificarIntento(l),
        recibidas: l.recibidas ?? 0
      })),
      instante: retrievedAt,
      estado: previoRot.estado,
      runId: `observar-${retrievedAt}`
    });

    /* --- 7. frescura de lo recien observado --- */
    const ventanaHoy = ventanaDelDia(retrievedAt);

    const frescura = resumirFrescura(registro.evidencias, {
      ventana: ventanaHoy,
      retrievedAt
    });

    res.json({
      gate: "TERRITORIAL-ACCELERATION-02",

      projectId,
      territorioId,
      ambitoRotacion: ambitoRot,
      retrievedAt,

      rotacion: {
        ciclo: cohorte.ciclo,
        pasada: cohorte.pasada,
        seleccionados: cohorte.seleccionados.map((f) => f.sourceId),
        diferidos: cohorte.diferidos.length,
        cicloCierra: cohorte.cicloCierra,
        metricas: rotacionAnotada.metricas
      },

      persistencia: {
        observadas: registro.metricas.observadas,
        nuevas: registro.metricas.nuevasParaSentinel,
        duplicadas: registro.metricas.yaConocidas,
        corpusAcumulado: registro.metricas.corpusAcumulado,

        declaracion:
          "`firstObservedAt` es inmutable y `publishedAt` es del medio. No hay backfill: el histórico empieza cuando empieza."
      },

      emisores: emisores.metricas,

      frescura: {
        publicadoHoy: frescura.publicadoHoy,
        encontradoHoyPublicadoAntes: frescura.encontradoHoyPublicadoAntes,
        fechaNoResuelta: frescura.fechaNoResuelta
      },

      costes: {
        usd: 0,
        proveedores: { rss_directo: feeds.length, google_news: 0, youtube_data: 0, gdelt_doc: 0 },

        motivo: "Solo `rss_directo`: feeds públicos del propio medio, sin credencial ni cuota."
      },

      declaraciones: [...emisores.declaraciones, ...registro.declaraciones]
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo la observacion" });
  }
});


/*
===========================================================
TEMA x TERRITORIO — TERRITORIAL-TOPIC-TERRITORY-01
===========================================================

Sobre el corpus YA PERSISTIDO. **Cero peticiones externas**:
ni Google News, ni YouTube, ni GDELT, ni RSS.

POR QUE UNA RUTA APARTE Y NO SOLO DENTRO DE /analisis
-----------------------------------------------------------

`/analisis` recolecta: invoca `conversationHarvester`, que sale
a Google News. Abrir una vista de temas no puede costar una
recoleccion.

Esta ruta LEE el libro de evidencias y cruza. Es la diferencia
entre consultar lo observado y volver a observar, y es la misma
separacion que ya existe entre `GET /fuentes` y
`POST /fuentes/verificar`.
===========================================================
*/

router.post("/tema-territorio", async (req, res) => {
  try {
    const cuerpo = req.body || {};

    const ambitoId = cuerpo.territorio || "ec-azuay-cuenca";

    const ventanaId = cuerpo.ventana || "30d";

    const ahora = cuerpo.ahora || new Date().toISOString();

    /*
      AMBITO DE PROYECTO — TERRITORIAL-ACCELERATION-02

      El libro es infraestructura compartida; la lectura es por
      proyecto. Sin `proyectoId` se lee el corpus completo y la
      respuesta lo DICE, para que nadie lea una cifra global
      como si fuera de su campaña.

      `incluirLegado` deja ver las 234 observaciones anteriores
      a este gate, que no llevan proyecto. Por defecto NO se
      cuentan dentro de un proyecto concreto.
    */
    const projectId = cuerpo.proyectoId || null;

    const incluirLegado = cuerpo.incluirLegado === true;

    /* --- corpus persistido --- */
    const ledger = crearLedgerFichero();

    const observaciones = await ledger.leerTodos();

    const estadoCorpus = reconstruirEstado(observaciones, { projectId, incluirLegado });

    /*
      El libro guarda el titular pero NO la descripcion, asi que
      la extraccion de temas trabaja solo con titulares. Se
      declara en la respuesta: no es lo mismo que trabajar con
      el texto completo.
    */
    const evidencias = [...estadoCorpus.values()].map((e) => ({
      titulo: e.title || null,

      /* Si el libro guarda el resumen, se usa. */
      descripcion: e.summary || null,
      url: e.canonicalUrl || null,
      enlace: e.canonicalUrl || null,
      dominio: e.sourceId || null,
      sourceId: e.sourceId || null,
      fecha: e.publishedAt || null,
      publishedAt: e.publishedAt || null,
      firstObservedAt: e.firstObservedAt || null,
      lastObservedAt: e.lastObservedAt || null,
      evidenceId: e.evidenceId,
      providerId: (e.providers || [])[0] || null,

      /*
        Emisor REAL cuando el libro lo tiene. Antes de
        TERRITORIAL-ACCELERATION-02 se forzaba `null` porque
        ninguna observacion lo guardaba; ahora las de RSS si.
      */
      publisher: e.publisher || null,
      emitterId: e.emitterId || null,
      emitterStatus: e.emitterStatus || null,

      /* Resumen si consta: mejora la extraccion de temas. */
      descripcionReal: e.summary || null,

      projectId: e.projectId || null,
      feedUrl: e.feedUrl || null
    }));

    if (evidencias.length === 0) {
      return res.json({
        gate: "TERRITORIAL-TOPIC-TERRITORY-01",
        territorioId: ambitoId,
        corpus: { evidencias: 0 },

        matriz: null,

        motivo:
          "El libro de evidencias está vacío. No hay corpus que cruzar: eso NO es «no hay temas en el territorio», es que no se ha observado todavía."
      });
    }

    /* --- temas: clasificados y descubiertos --- */
    const { extraerTemas } = await import("../services/conversation/topicExtractor.js");

    const { descubrirTemas } = await import(
      "../services/conversation/openTopicDiscovery.js"
    );

    const temas = extraerTemas(evidencias, { ambito: ambitoId });

    /*
      SOBRE-FRAGMENTACION DEL DESCUBRIMIENTO ABIERTO

      Medido en TERRITORIAL-ACCELERATION-02: con los resumenes
      persistidos, el motor propone ~185 señales para 177
      evidencias. Una señal por evidencia no es una agenda.

      Se probo subir `documentosMinimos` de 2 a 3 y el numero
      SUBIO —de 175 a 185— porque ese umbral gobierna la
      formacion de clusters y no el ruido residual. Se dejo el
      comportamiento por defecto en lugar de tocar un motor
      compartido sin beneficio medido.

      Lo que SI hace este gate es clasificar la señal —TEMA,
      LUGAR, TEMPORAL— y declarar su soporte, para que el ruido
      se pueda ver y filtrar en lugar de contarse como agenda.
      Queda como pendiente abierto.
    */
    const descubrimiento = descubrirTemas(evidencias, { ambito: ambitoId });

    const listaTemas = temas?.temas || [];

    const listaDescubiertos = descubrimiento?.temasDescubiertos || [];

    /* --- territorio por evidencia, con su razon --- */
    const { resolverLote } = await import("../services/geo/geoResolver.js");

    const resuelto = resolverLote(evidencias, {
      ambitoId,
      pistaPorEvidencia: (e) => pistaDeFuente(e)
    });

    const ubicaciones = [];

    (resuelto?.ubicadas || []).forEach((r) => {
      ubicaciones[r.indice] = {
        unidadId: r.ubicacion.unidadId,
        unidad: r.ubicacion.unidad,
        nivel: r.ubicacion.resolucion,
        procedencia: r.ubicacion.procedencia,
        confianzaGeografica: r.ubicacion.confianza,
        razones: r.ubicacion.razones || []
      };
    });

    /*
      Toponimos del registro territorial: un nombre propio de
      territorio no es un tema, y el criterio tiene que ser
      verificable en lugar de una lista escrita a mano.
    */
    const toponimos = toponimosDe(listarUnidades());

    const matriz = construirMatriz({
      evidencias,
      temas: listaTemas,
      descubiertos: listaDescubiertos,
      ubicaciones,
      ventanaId,
      ahora,
      toponimos
    });

    const comparacion = compararVentanas({
      evidencias,
      temas: listaTemas,
      descubiertos: listaDescubiertos,
      ventanaId,
      ahora
    });

    /* Todas las ventanas, para que la vista pueda cambiarlas. */
    const porVentana = {};

    ["hoy", "7d", "15d", "30d", "90d"].forEach((v) => {
      const m = construirMatriz({
        evidencias,
        temas: listaTemas,
        descubiertos: listaDescubiertos,
        ubicaciones,
        ventanaId: v,
        ahora,
        toponimos
      });

      porVentana[v] = {
        ventana: { id: m.ventana.id, etiqueta: m.ventana.etiqueta },
        celdas: m.metricas.celdas,
        temas: m.metricas.temas,
        senalesQueSonLugar: m.metricas.senalesQueSonLugar,
        territorios: m.metricas.territorios,
        evidenciasEnVentana: m.metricas.evidenciasEnVentana,
        historicoCubre: m.ventana.historicoCubre,
        porCobertura: m.metricas.porCobertura
      };
    });

    /*
      Evidencia por id, para que la interfaz pueda abrir una
      celda sin volver a pedir nada. Sin esto, «auditable» seria
      una promesa.
    */
    const evidenciaPorId = {};

    evidencias.forEach((e, i) => {
      if (!e.evidenceId) return;

      const u = ubicaciones[i] || null;

      const fuente = identificarFuente(e);

      evidenciaPorId[e.evidenceId] = {
        evidenceId: e.evidenceId,
        titulo: e.titulo,
        url: e.url,
        dominio: e.dominio,
        tipoFuente: fuente?.tipo || null,
        emisor: e.publisher,
        publishedAt: e.publishedAt,
        firstObservedAt: e.firstObservedAt,
        lastObservedAt: e.lastObservedAt,
        providerId: e.providerId,

        territorio: u
          ? { unidadId: u.unidadId, nivel: u.nivel, razones: u.razones }
          : { unidadId: TERRITORIO_NO_RESUELTO, nivel: null, razones: [] }
      };
    });

    res.json({
      gate: "TERRITORIAL-TOPIC-TERRITORY-01",

      territorioId: ambitoId,

      /* AMBITO — TERRITORIAL-ACCELERATION-02 */
      projectId,

      ambito: {
        tipo: projectId ? "PROYECTO" : "CORPUS_COMPLETO",
        projectId,
        incluirLegado,

        declaracion: projectId
          ? `Solo evidencia del proyecto «${projectId}»${incluirLegado ? " más el legado sin proyecto" : ""}. La cobertura de una campaña no incluye la de otra.`
          : "SIN proyecto: se lee el corpus completo. Esta cifra NO es de ninguna campaña en particular."
      },

      corpus: {
        observaciones: observaciones.length,
        evidenciasDelAmbito: evidencias.length,
        evidencias: evidencias.length,
        conFecha: evidencias.filter((e) => e.publishedAt).length,
        dominios: new Set(evidencias.map((e) => e.dominio).filter(Boolean)).size,
        inicioDeObservacion: matriz.ventana.inicioDeObservacion,

        conResumen: evidencias.filter((e) => e.descripcion).length,

        emisores: {
          resueltos: evidencias.filter((e) => e.emitterStatus === ESTADOS_EMISOR.RESUELTO).length,

          observadosNoVerificados: evidencias.filter(
            (e) => e.emitterStatus === ESTADOS_EMISOR.OBSERVADO_NO_VERIFICADO
          ).length,

          sinResolver: evidencias.filter(
            (e) => !e.emitterStatus || e.emitterStatus === ESTADOS_EMISOR.NO_RESUELTO
          ).length
        },

        limitacion:
          "Las observaciones anteriores a TERRITORIAL-ACCELERATION-02 no guardan resumen ni emisor: para ellas la extracción de temas trabaja solo con titulares."
      },

      señales: {
        clasificados: listaTemas.length,
        descubiertos: listaDescubiertos.length
      },

      territorio: {
        ubicadas: (resuelto?.ubicadas || []).length,
        sinUbicar: (resuelto?.sinUbicar || []).length,

        declaracion:
          "Las evidencias sin territorio NO se descartan ni se reparten: van a la fila TERRITORIO_NO_RESUELTO, que se ve."
      },

      matriz,

      comparacion,

      porVentana,

      evidenciaPorId,

      metricasPermitidas: [
        "conteo de evidencias",
        "número de fuentes",
        "número de emisores",
        "distribución temporal",
        "territorios observados",
        "temas observados"
      ],

      metricasNoDisponibles: {
        porcentajePoblacional: null,
        porcentajeElectores: null,
        intencionDeVoto: null,
        aprobacion: null,
        influencia: null,

        motivo:
          "No hay denominador poblacional con licencia comercial ni padrón electoral accesible. Sin denominador oficial NO se calcula ningún porcentaje: la métrica es conteo absoluto."
      },

      costes: {
        usd: 0,
        peticionesExternas: 0,

        motivo:
          "Esta ruta lee el corpus ya persistido. Ningún adapter se invoca: abrir una vista de temas no puede costar una recolección."
      }
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo el cruce tema x territorio" });
  }
});


/*
-----------------------------------------------------------
RESOLVER — probar la ubicacion de un texto

Herramienta de auditoria: permite comprobar POR QUE una
evidencia se ubico donde se ubico, o por que no se ubico.
Sin esto, la desambiguacion es una caja negra.
-----------------------------------------------------------
*/

router.post("/resolver", async (req, res) => {
  try {
    const evidencias = Array.isArray(req.body?.evidencias)
      ? req.body.evidencias
      : req.body?.texto
        ? [{ titulo: String(req.body.texto) }]
        : [];

    if (evidencias.length === 0) {
      return res.status(400).json({
        error: "Envie `texto` o un array `evidencias`."
      });
    }

    const ambito = ambitoDeclarado(req.body?.territorio || {});

    const { resolverLote } = await import("../services/geo/geoResolver.js");

    const resultado = resolverLote(evidencias, {
      ambitoId: ambito.unidadId,
      pistaPorEvidencia: (e) => pistaDeFuente(e)
    });

    res.json({
      ambito,

      metricas: resultado.metricas,
      declaracion: resultado.declaracion,

      resoluciones: [
        ...resultado.ubicadas.map((u) => ({
          indice: u.indice,
          titulo: u.evidencia?.titulo || null,
          ...u.ubicacion,
          unidad: undefined
        })),
        ...resultado.sinUbicar.map((s) => ({
          indice: s.indice,
          titulo: s.evidencia?.titulo || null,
          ...s.ubicacion,
          unidad: undefined
        }))
      ].sort((a, b) => a.indice - b.indice)
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "fallo la resolucion" });
  }
});


/*
===========================================================
ANALISIS COMPLETO

Conversacion publica + inteligencia territorial, compuestos.
===========================================================
*/

router.post("/analisis", async (req, res) => {
  try {
    const cuerpo = req.body || {};

    /*
      -------------------------------------------------------
      1. AMBITO Y ACTORES

      Del proyecto si se indica; del cuerpo si no. Nunca de lo
      que devuelva una busqueda: el territorio lo fija el
      analista, igual que el contexto maestro de ARQ-INV-002.
      -------------------------------------------------------
      */
    let contextoProyecto = null;

    let ambito = null;

    let actores = Array.isArray(cuerpo.actores) ? cuerpo.actores : [];

    if (cuerpo.proyectoId) {
      contextoProyecto = await contextoTerritorialDeProyecto(cuerpo.proyectoId);

      if (contextoProyecto.disponible) {
        ambito = contextoProyecto.ambito;

        if (actores.length === 0) actores = contextoProyecto.actores;
      }
    }

    if (!ambito) ambito = ambitoDeclarado(cuerpo.territorio || {});

    if (!ambito.unidadId && !ambito.nombre) {
      return res.status(400).json({
        error:
          "No hay territorio. Indique `proyectoId`, o `territorio` con al menos pais, provincia o canton, o `territorio.unidadId`."
      });
    }

    /*
      -------------------------------------------------------
      1-bis. VENTANA TERRITORIAL — TERRITORIAL-FRESH-01

      `ventana: "hoy"` es un DIA DE CALENDARIO en la zona del
      territorio, no las ultimas 24 horas. A las 21:00 en
      Cuenca el servidor UTC ya esta en el dia siguiente:
      calculando en UTC, «hoy» se vaciaria cada tarde.
      -------------------------------------------------------
    */
    const zonaTerritorial = cuerpo.zona || ZONA_POR_DEFECTO;

    const retrievedAt = new Date().toISOString();

    const ventanaPedida = String(cuerpo.ventana || "").toLowerCase();

    const ventanaTerritorial = ventanaPedida
      ? ventanaPedida === "hoy"
        ? ventanaDelDia(retrievedAt, zonaTerritorial)
        : ventanaDeDias(
            Number(ventanaPedida.replace(/\D/g, "")) || 30,
            retrievedAt,
            zonaTerritorial
          )
      : null;

    /*
      Si se pidio ventana territorial, manda sobre `desde` y
      `hasta` sueltos. Dos fuentes de verdad para el mismo
      intervalo acabarian discrepando.
    */
    const desdeEfectivo = ventanaTerritorial?.desde || cuerpo.desde;

    const hastaEfectivo = ventanaTerritorial?.hasta || cuerpo.hasta;

    /*
      -------------------------------------------------------
      2. CONVERSACION PUBLICA — recoleccion y analisis
      -------------------------------------------------------
    */
    const conversacion = await analizarConversacionPublica({
      ambito,
      actores,
      proyectoId: cuerpo.proyectoId || null,
      modo: cuerpo.modo,
      maxConsultasWeb: cuerpo.maxConsultasWeb,
      desde: desdeEfectivo,
      hasta: hastaEfectivo,
      granularidad: cuerpo.granularidad,
      temasSemilla: cuerpo.temasSemilla || []
    });

    /*
      -------------------------------------------------------
      3. INTELIGENCIA TERRITORIAL sobre esa evidencia

      La pista de cobertura se INYECTA aqui. geo/ no importa
      nada de conversation/.
      -------------------------------------------------------
    */
    /*
      -------------------------------------------------------
      2-bis. ESCUCHA AMPLIADA — TERRITORIAL-FRESH-01

      Los adapters de INGEST-REAL-01 —RSS, GDELT, YouTube—
      estaban escritos y sin conectar. Se invocan AQUI, no en
      un motor nuevo: `conversationHarvester` sigue haciendo lo
      suyo y sus evidencias se funden con estas.

      Solo en modo `ampliado`. Los modos `lake` y `noticias`
      quedan exactamente como estaban.
      -------------------------------------------------------
    */
    const modoAmpliado = cuerpo.modo === "ampliado";

    let ampliada = null;

    const universoIngesta = crearUniverso();

    const registroMediosIngesta = crearRegistroMedios();

    /*
      -------------------------------------------------------
      FEEDS — TERRITORIAL-SOURCE-UNIVERSE-01

      Hasta este gate, `feeds` solo podia llegar en el cuerpo de
      la peticion, y nadie los mandaba nunca: RSS quedaba en
      `SIN_FUENTES` de forma permanente y el 89 % del corpus
      entraba por un solo proveedor.

      Ahora, si el cuerpo no los trae, se leen del universo YA
      COMPROBADO. Leer el almacen no sale a la red: la
      comprobacion es otra operacion, con su propia ruta y su
      propio presupuesto. Esa separacion es justo la que el
      recolector exige.

      Si el universo esta vacio, `feeds` sigue siendo `[]` y RSS
      vuelve a declarar `SIN_FUENTES`. El comportamiento previo
      se conserva; lo que cambia es que ahora hay una forma de
      que deje de estarlo.
      -------------------------------------------------------
    */
    let feedsDeclarados = (cuerpo.feeds || []).filter((f) => f?.url);

    let origenDeLosFeeds = feedsDeclarados.length > 0 ? "cuerpo_de_la_peticion" : null;

    if (modoAmpliado && feedsDeclarados.length === 0 && cuerpo.usarUniversoDeFuentes !== false) {
      try {
        const universoFuentes = reconstruirUniverso(await almacenDeFuentes().leerTodos());

        const delTerritorio = [...universoFuentes.values()].filter(
          (f) =>
            !ambito.unidadId ||
            f.territorioId === ambito.unidadId ||
            f.territorioDeclarado === ambito.unidadId ||

            /* Nacionales comprobados: sin cobertura declarada. */
            (f.territorioDeclarado === null && f.estadoVerificacion === ESTADOS_FUENTE.VERIFICADO_FEED)
        );

        feedsDeclarados = feedsParaRecoleccion(delTerritorio);

        origenDeLosFeeds =
          feedsDeclarados.length > 0 ? "universo_de_fuentes_comprobado" : "universo_vacio";
      } catch (e) {
        /*
          Que el almacen falle NO debe tumbar un analisis. Se
          sigue sin feeds y RSS lo declarara.
        */
        origenDeLosFeeds = `almacen_no_legible: ${e?.message || "error"}`;
      }
    }

    /*
      -------------------------------------------------------
      ROTACION RSS — TERRITORIAL-RSS-ROTATION-01

      `feedsDeclarados` son TODOS los elegibles. El recolector
      solo lee los primeros 8, asi que con orden fijo los otros
      doce no se leian nunca.

      Aqui se decide CUALES 8 entran en esta pasada. El
      presupuesto del recolector NO se toca: lo que cambia es la
      lista que recibe.

      Leer el almacen de rotacion no sale a la red.
      -------------------------------------------------------
    */
    const presupuestoRss = PRESUPUESTO_RECOLECTOR.rss_directo;

    const ambitoRotacion = ambitoDeRotacion({
      projectId: cuerpo.proyectoId || null,
      territoryId: ambito.unidadId || null
    });

    let rotacion = null;

    let cohorte = null;

    let feedsDeLaPasada = feedsDeclarados;

    if (modoAmpliado && feedsDeclarados.length > 0 && cuerpo.rotarFuentes !== false) {
      try {
        const previo = reconstruirRotacion(
          await almacenDeRotacion().leerTodos(),
          ambitoRotacion.scopeId
        );

        const siguiente = siguienteCicloYPasada({
          estado: previo.estado,
          ciclo: previo.ciclo,
          pasada: previo.pasada,
          elegibles: feedsDeclarados
        });

        cohorte = seleccionarCohorte({
          elegibles: feedsDeclarados,
          estado: previo.estado,
          presupuesto: presupuestoRss,
          ciclo: siguiente.ciclo,
          pasada: siguiente.pasada
        });

        feedsDeLaPasada = cohorte.seleccionados.map((f) => ({
          url: f.feedUrl,
          publisher: f.publisher,
          sourceId: f.sourceId,
          prioridad: f.prioridad,
          territorioDeclarado: f.territorioDeclarado
        }));

        rotacion = { previo, siguiente };
      } catch (e) {
        /*
          Que la rotacion falle no debe tumbar un analisis: se
          sigue con el orden por prioridad, que es lo que habia
          antes de este gate, y se declara.
        */
        rotacion = { error: e?.message || "fallo la rotacion" };
      }
    }

    if (modoAmpliado) {
      try {
        ampliada = await recolectarAmpliado({
          plan: conversacion?.recoleccion?.consultasPlanificadas || [],

          /*
            Feeds CONOCIDOS. No se sale a descubrirlos en mitad
            de una recoleccion: pedir la portada de cada medio
            es otra operacion con su propio presupuesto.
          */
          feeds: feedsDeLaPasada,

          ventana: ventanaTerritorial,
          observedAt: retrievedAt,
          runId: `run-${retrievedAt}`,
          territoryId: ambito.unidadId || null,
          universo: universoIngesta,
          registroMedios: registroMediosIngesta,
          habilitados: cuerpo.proveedores || null
        });

        /*
          Las evidencias de los adapters se AÑADEN al corpus que
          analizan los motores. Sin esto, la escucha ampliada
          recolectaria y no se veria en la agenda.
        */
        conversacion.evidencias = [
          ...conversacion.evidencias,
          ...ampliada.evidencias.map((e) => ({
            titulo: e.title,
            descripcion: e.snippet,
            enlace: e.url,
            url: e.url,
            dominio: e.sourceId,
            fecha: e.publishedAt,
            fuenteDeclarada: e.publisher,
            origen: e.providerId,
            motorId: e.providerId,
            consultasOrigen: [e.provenance?.queryLabel].filter(Boolean),

            /* Los cuatro instantes viajan con la evidencia. */
            publishedAt: e.publishedAt,
            retrievedAt,
            evidenceId: e.evidenceId,
            canonicalUrl: e.canonicalUrl,
            providersSeenBy: e.providersSeenBy || [e.providerId]
          }))
        ];
      } catch (error) {
        ampliada = {
          error: error?.message || "fallo de la escucha ampliada",

          declaracion:
            "La escucha ampliada falló. El resto del análisis sigue siendo válido con el corpus del recolector base, y esta ausencia se declara en lugar de silenciarse."
        };
      }
    }

    /*
      -------------------------------------------------------
      ANOTAR LA ROTACION — TERRITORIAL-RSS-ROTATION-01

      Se anota TANTO lo que funciono como lo que no. Un fallo sin
      anotar se repite igual en la pasada siguiente; uno anotado
      espacia el reintento y deja la plaza a otra fuente.

      La atribucion sale de `lote.feedUrl`, que el recolector
      emite desde este gate: ocho lotes de RSS sin identidad de
      feed son indistinguibles y no permiten saber cual fallo.
      -------------------------------------------------------
    */
    let rotacionAnotada = null;

    if (cohorte && !rotacion?.error) {
      try {
        const lotesRss = (ampliada?.lotes || []).filter(
          (l) => l.providerId === "rss_directo" && l.feedUrl
        );

        const resultados = lotesRss.map((l) => ({
          feedUrl: l.feedUrl,
          estado: clasificarIntento(l),
          recibidas: l.recibidas ?? 0
        }));

        rotacionAnotada = await registrarRotacion({
          almacen: almacenDeRotacion(),
          scopeId: ambitoRotacion.scopeId,
          cohorte,
          resultados,
          instante: retrievedAt,
          estado: rotacion?.previo?.estado || new Map(),
          runId: `rotacion-${retrievedAt}`
        });
      } catch (e) {
        rotacionAnotada = { error: e?.message || "fallo al anotar la rotacion" };
      }
    }

    const territorio = await analizarTerritorio(conversacion.evidencias, {
      ambitoId: ambito.unidadId,
      territorio: cuerpo.territorio || contextoProyecto?.proyecto || {},
      resolucion: cuerpo.resolucion,
      normalizacion: cuerpo.normalizacion,
      umbralMuestra: cuerpo.umbralMuestra,
      granularidad: cuerpo.granularidad,
      desde: cuerpo.desde,
      hasta: cuerpo.hasta,
      incluirVacias: cuerpo.incluirVacias === true,
      pistaPorEvidencia: (e) => pistaDeFuente(e)
    });

    /*
      -------------------------------------------------------
      4. MENCIONES POR TERRITORIO

      Se recalculan las menciones CON las ubicaciones ya
      resueltas, para poder decir donde se menciona a cada
      actor. La primera pasada no las tenia.
      -------------------------------------------------------
    */
    let mencionesPorTerritorio = null;

    /*
      Ubicacion por indice, reutilizada por menciones y por el
      cruce tema x territorio.
    */
    const ubicaciones = [];

    territorio.agregado.unidades.forEach((u) => {
      u.evidencias.forEach((ev) => {
        ubicaciones[ev.indice] = {
          unidadId: u.unidadId,
          unidad: u.nombre,
          nivel: u.resolucion
        };
      });
    });

    if (actores.length > 0 && conversacion.evidencias.length > 0) {

      const { contarMenciones } = await import(
        "../services/conversation/actorMentions.js"
      );

      mencionesPorTerritorio = contarMenciones(
        conversacion.evidencias,
        actores,
        { ubicaciones }
      );
    }

    /*
      -------------------------------------------------------
      5. EVIDENCIA ENRIQUECIDA — T-11

      Los motores devuelven sus resultados en bloques separados
      —evidencias, ubicaciones, temas, encuadre— unidos por
      indice. Es eficiente y es ilegible para auditar: comprobar
      una sola evidencia obliga a cruzar cuatro arrays a mano.

      Aqui se materializa la union. Cada evidencia lleva su
      URL, titulo, medio, fecha, motor, territorio atribuido,
      nivel, confianza geografica, temas y limitaciones.

      Ningun campo se rellena si no existe: sin fecha va null,
      no la fecha de hoy. Sin autor no hay campo autor.
      -------------------------------------------------------
    */
    const evidenciasEnriquecidas = construirEvidenciaEnriquecida({
      evidencias: conversacion.evidencias,
      territorio,
      conversacion
    });

    /*
      -------------------------------------------------------
      6. TEMA x TERRITORIO — Gate C2

      Solo con evidencias GEOLOCALIZABLES. Un tema con diez
      evidencias de las que dos se pudieron ubicar aparece con
      dos, no con diez repartidas.

      No se reparte un tema territorialmente por poblacion y no
      se asume que una noticia sobre Cuenca aplique a todas sus
      parroquias: eso seria desagregar, y GEO-1 lo prohibe.
      -------------------------------------------------------
    */
    const temaPorTerritorio = cruzarTemaTerritorio({
      temas: conversacion?.temas?.temas || [],
      descubiertos: conversacion?.descubrimiento?.temasDescubiertos || [],
      ubicaciones,
      totalEvidencias: conversacion.evidencias.length
    });

    /*
      -------------------------------------------------------
      6-bis. OPEN LISTENING — Gate D2

      Cuatro cosas que tienen que pasar ANTES de componer la
      agenda, porque la agenda depende de las cuatro:

        a) quien habla        (Source Universe)
        b) de que naturaleza  (Source Classifier)
        c) cuanta diversidad  (Source Diversity)
        d) que es tema y que es entidad
      -------------------------------------------------------
    */
    const consultasPlan = conversacion?.recoleccion?.consultasPlanificadas || [];

    /* (a) Universo de fuentes observado en este corpus. */
    const universo = construirUniverso(conversacion.evidencias, {
      idioma: "es"
    });

    /* (b) Clasificacion explicable de cada una. */
    const clasificacion = clasificarUniverso(universo);

    /*
      El resolvedor de fuente es el mismo para diversidad y para
      agendas. Se define una vez: si divergieran, las cuotas por
      agenda no sumarian el corpus.
    */
    const resolverFuente = (ev) => {
      const ident = identificarFuente(ev);

      return ident.dominio || ev.dominio || null;
    };

    /* (c) Diversidad real, con las plataformas separadas. */
    const diversidad = medirDiversidad(conversacion.evidencias, {
      clasificacionPorFuente: clasificacion.porFuente,
      resolverFuente
    });

    const agendasPorFuente = separarCorpusPorAgenda(conversacion.evidencias, {
      clasificacionPorFuente: clasificacion.porFuente,
      resolverFuente
    });

    /*
      Corpus neutral frente a corpus dirigido. La Agenda General
      se lee del primero: el segundo responde a una pregunta que
      alguien formulo.
    */
    const corpusPorConsulta = separarCorpusPorTipoDeConsulta(
      conversacion.evidencias,
      consultasPlan
    );

    const sesgoDeConsulta = medirSesgo(
      consultasPlan,
      (conversacion?.recoleccion?.registro || []).reduce((acc, r) => {
        if (r.etiqueta) acc[r.etiqueta] = (acc[r.etiqueta] || 0) + (r.nuevas || 0);

        return acc;
      }, {})
    );

    /*
      (d) ENTIDAD != TEMA.

      El gazetteer sale del registro territorial: una unidad
      reconocida es un lugar, y un lugar repetido no es un tema.
      «Cuenca» aparece en las 30 evidencias de un corpus de
      Cuenca y no significa nada.
    */
    const gazetteer = new Set(
      listarUnidades().flatMap((u) =>
        [u.nombre, ...(u.alias || [])].filter(Boolean).map((n) => n.toLowerCase())
      )
    );

    /*
      Las DOS ramas. Un nombre propio llega a la agenda por el
      descubridor abierto y tambien por el Topic Engine 2, que
      lo emite como tema `emergente`. Separar solo una rama deja
      la otra puerta abierta y la persona reaparece en el
      ranking.
    */
    const separacion = separarEntidadesDeTemas(
      conversacion?.descubrimiento?.temasDescubiertos || [],
      { gazetteer }
    );

    const separacionClasificados = separarEntidadesDeTemas(
      conversacion?.temas?.temas || [],
      { gazetteer }
    );

    /*
      -------------------------------------------------------
      7. AGENDA Y MAPA — Gate D + F1

      La agenda FUSIONA descubiertos y clasificados: son dos
      caminos al mismo asunto, no dos asuntos. Un tema que la
      taxonomia no cubre no se esconde, se marca.

      Desde D2 recibe los descubiertos YA SIN ENTIDADES. Una
      persona repetida no encabeza la agenda tematica: es un
      sujeto, no un asunto.
      -------------------------------------------------------
    */
    const agendaCompuesta = construirAgenda({
      temasClasificados: separacionClasificados.temas,
      temasDescubiertos: separacion.temas,
      ubicaciones,
      referencia: cuerpo.hasta || new Date().toISOString()
    });

    /*
      Las entidades de las dos ramas, deduplicadas por nombre:
      la misma persona suele salir por las dos y no debe
      aparecer dos veces en el bloque.
    */
    const entidadesUnicas = [];

    const vistasEntidad = new Set();

    [...separacion.entidades, ...separacionClasificados.entidades].forEach((e) => {
      const clave = String(e.entidad || "").toLowerCase();

      if (!clave || vistasEntidad.has(clave)) return;

      vistasEntidad.add(clave);

      entidadesUnicas.push(e);
    });

    /* Se relacionan con la agenda ya construida. */
    const entidadesObservadas = relacionarEntidadesConTemas(
      entidadesUnicas,
      agendaCompuesta.agenda
    );

    const mapa = construirMapa({
      agregado: territorio.agregado,
      ubicaciones,
      agenda: agendaCompuesta.agenda
    });

    /*
      -------------------------------------------------------
      8. LIMITACIONES DE COBERTURA — visibles, no escondidas

      El corpus llega con sesgo de recoleccion demostrado. La
      interfaz tiene que poder decirlo sin que el analista
      tenga que leer el codigo.
      -------------------------------------------------------
    */
    const coverageLimitations = construirLimitacionesDeCobertura({
      conversacion,
      territorio,
      mapa,
      diversidad,
      agendasPorFuente
    });

    /*
      -------------------------------------------------------
      9. SNAPSHOT — acumular desde hoy

      Google News no da archivo historico: la ventana anterior
      de Cuenca no se puede recuperar, hay que acumularla. Cada
      ejecucion que no se guarda es una comparacion que ya no se
      podra hacer nunca.

      Se guarda por defecto y se puede desactivar con
      `persistirSnapshot: false`. Un fallo al guardar NO tumba
      la respuesta: la vista es util aunque el historico falle,
      y se declara.
      -------------------------------------------------------
    */
    const instante = new Date().toISOString();

    const snapshot = componerSnapshot({
      territorio: {
        unidadId: ambito.unidadId || null,
        nombre: ambito.nombre || null,
        resolucion: territorio?.resolucion?.efectiva || null
      },
      projectId: cuerpo.proyectoId || null,
      window: {
        id: cuerpo.ventana || "30d",
        desde: cuerpo.desde || null,
        hasta: cuerpo.hasta || null
      },
      capturedAt: instante,
      diversidad,
      temas: agendaCompuesta.agenda,
      entidades: entidadesObservadas,
      territorios: territorio?.agregado?.unidades || [],
      consultas: consultasPlan,
      providers: conversacion?.recoleccion?.registro || [],
      coverageLimitations,
      agendas: agendasPorFuente.metricas
    });

    let persistencia = {
      guardado: false,
      motivo: "No solicitado."
    };

    let ventanaComparable = compararConVentanaAnterior(snapshot, null);

    /*
      E1: el estado de las CINCO ventanas, no solo la pedida.
      La interfaz necesita saber cuales existen para ofrecer
      solo esas, en lugar de dejar al analista pedir una y
      recibir «histórico insuficiente».
    */
    let ventanasTemporales = null;

    if (cuerpo.persistirSnapshot !== false) {
      try {
        const almacen = crearAlmacenFichero();

        const previos = await almacen.leerTodos();

        const anterior = buscarVentanaAnterior(previos, {
          territorioId: snapshot.territorio?.unidadId,
          ventanaId: snapshot.window?.id,
          capturedAt: snapshot.capturedAt
        });

        ventanaComparable = compararConVentanaAnterior(snapshot, anterior);

        const r = await guardarSnapshot(almacen, snapshot);

        ventanasTemporales = evaluarTodasLasVentanas({
          snapshots: [...previos, snapshot],
          territorioId: snapshot.territorio?.unidadId,
          ahora: instante,
          actual: snapshot
        });

        persistencia = {
          guardado: true,
          snapshotId: r.snapshotId,
          huella: r.huella,
          snapshotsAcumulados: previos.length + 1,
          modo: "append-only",
          declaracion:
            "Anexado, nunca sobrescrito. Una corrección se anexa como snapshot nuevo que declara a cuál sustituye."
        };
      } catch (error) {
        persistencia = {
          guardado: false,
          motivo: `No se pudo guardar el snapshot: ${error?.message || "error"}. La vista es válida; lo que se pierde es la comparación futura.`
        };
      }
    }

    /*
      -------------------------------------------------------
      10. FRESCURA — TERRITORIAL-FRESH-01

      «Publicado hoy» exige `publishedAt` verificable dentro del
      dia territorial. Encontrar algo hoy NO lo publica hoy, y
      `retrievedAt` no rellena una fecha que falta.

      El ledger hace que reejecutar no multiplique el corpus:
      la segunda observacion avanza `lastObservedAt` en lugar de
      crear otra evidencia.
      -------------------------------------------------------
    */
    let frescura = null;

    try {
      const ledger = crearLedgerFichero();

      const estadoPrevio = reconstruirEstado(await ledger.leerTodos());

      /*
        TODO el corpus entra al ledger, no solo lo que trae
        `evidenceId` de fábrica.

        El recolector base no emite ese campo —lo añadió
        INGEST-REAL-01 a los adapters nuevos—, así que en la
        primera prueba real 56 de 63 evidencias quedaron fuera:
        el 89 %. Con eso, «reejecutar no duplica» solo era
        cierto para el 11 % del corpus.

        La huella se calcula con el MISMO contrato, así que una
        nota traída por Google News y por un adapter da el mismo
        identificador y se reconoce como la misma.
      */
      const paraLedger = conversacion.evidencias
        .map((e) => {
          const canonical = e.canonicalUrl || normalizarUrl(e.enlace || e.url || "");

          const title = e.titulo || e.title || null;

          if (!canonical && !title) return null;

          return {
            evidenceId:
              e.evidenceId || `ev-${huellaDeEvidencia({ canonicalUrl: canonical, title })}`,
            canonicalUrl: canonical,
            title,
            publishedAt: e.publishedAt || e.fecha || null,
            sourceId: e.dominio || null,
            providersSeenBy: e.providersSeenBy || [e.motorId].filter(Boolean)
          };
        })
        .filter(Boolean);

      const pasada = paraLedger.length
        ? await registrarPasada({
            ledger,
            evidencias: paraLedger,
            estadoPrevio,
            retrievedAt,
            territoryId: ambito.unidadId || null,
            runId: `run-${retrievedAt}`
          })
        : null;

      /*
        La frescura se mide sobre TODO el corpus, no solo sobre
        lo que pasó por el ledger: el recolector base no emite
        `evidenceId` y sus evidencias también tienen fecha.
      */
      const corpusFechado = conversacion.evidencias.map((e) => ({
        publishedAt: e.publishedAt || e.fecha || null,
        retrievedAt: e.retrievedAt || retrievedAt
      }));

      const ventanaFrescura = ventanaTerritorial || ventanaDelDia(retrievedAt, zonaTerritorial);

      frescura = {
        ventana: ventanaFrescura,
        zona: zonaTerritorial,

        ultimaActualizacion: retrievedAt,

        resumen: resumirFrescura(corpusFechado, {
          ventana: ventanaDelDia(retrievedAt, zonaTerritorial),
          retrievedAt
        }),

        distribucion: distribucionTemporal(corpusFechado, {
          instante: retrievedAt,
          zona: zonaTerritorial
        }),

        ledger: pasada
          ? {
              ...pasada.metricas,
              declaraciones: pasada.declaraciones
            }
          : {
              observadas: 0,

              motivo:
                "El corpus de esta pasada está vacío: no hay nada que registrar."
            },

        declaracion:
          "«Publicado hoy» ≠ «encontrado hoy». Son cuatro instantes distintos y ninguno sustituye a otro."
      };
    } catch (error) {
      frescura = {
        error: error?.message || "fallo al calcular la frescura",
        declaracion: "Sin frescura calculada NO se puede afirmar qué se publicó hoy."
      };
    }

    /*
      Estado REAL de los adapters. Se comprueba, no se supone:
      un fichero adapter que existe no es un proveedor que
      funciona.
    */
    const adaptersDeclarados = estadoAdapters();

    res.json({
      modulo: "inteligencia_territorial",
      version: "1.0",

      ambito,

      evidenciasEnriquecidas,

      temaPorTerritorio,

      /* --- TERRITORIAL-FRESH-01 --- */

      frescura,

      /* Gate D */
      agenda: agendaCompuesta,

      /* Gate F1 */
      mapa,

      /* --- Gate D2: Open Listening --- */

      escuchaAbierta: {
        /*
          Las entidades van FUERA de la agenda y con el mismo
          rango de importancia: no se esconden por no ser temas.
        */
        entidades: entidadesObservadas,
        separacionEntidadTema: {
          descubiertos: separacion.metricas,
          clasificados: separacionClasificados.metricas,
          entidadesUnicas: entidadesUnicas.length
        },
        declaracionSeparacion: separacion.declaracion,

        sesgoDeConsulta,
        corpusPorTipoDeConsulta: corpusPorConsulta.metricas,
        declaracionCorpus: corpusPorConsulta.declaracion,

        diversidad,

        agendasPorFuente: {
          metricas: agendasPorFuente.metricas,
          etiquetas: agendasPorFuente.etiquetas,
          limitaciones: agendasPorFuente.limitaciones
        },

        universo: {
          estado: estadoUniverso(universo),
          fuentes: listarFuentes(universo).map((f) => ({
            id: f.id,
            nombre: f.nombre,
            tipo: f.tipo,
            estado: f.estado,
            verificada: f.verificada,
            esPlataforma: f.esPlataforma,
            plataforma: f.plataforma,
            frecuenciaObservada: f.frecuenciaObservada,
            origen: f.origen,
            procedencia: f.procedencia,
            clase: clasificacion.porFuente.get(f.id)?.clase || null,
            confianzaClase: clasificacion.porFuente.get(f.id)?.confianza ?? null,
            razonesClase: clasificacion.porFuente.get(f.id)?.razones || []
          })),
          clasificacion: clasificacion.metricas
        }
      },

      escuchaAmpliada: modoAmpliado
        ? {
            ejecutada: !ampliada?.error,
            error: ampliada?.error || null,
            lotes: ampliada?.lotes || [],
            dedup: ampliada?.dedup || null,
            nuevasFuentes: ampliada?.nuevasFuentes || [],
            presupuesto: ampliada?.presupuesto || null,
            run: ampliada?.run || null,
            declaracion: ampliada?.declaracion || null,

            /*
              De donde salieron los feeds de esta pasada. Sin
              esto, un RSS con resultados no dice si los feeds
              los mando el cliente o si vinieron del universo
              comprobado, y son dos cosas muy distintas.
            */
            fuentesRss: {
              origen: origenDeLosFeeds,

              /* Elegibles del universo, no los de esta pasada. */
              feedsElegibles: feedsDeclarados.length,
              feedsUsados: feedsDeLaPasada.length,

              topePorPasada: ampliada?.presupuesto?.aplicado?.rss_directo ?? null,

              nota:
                origenDeLosFeeds === "universo_vacio"
                  ? "El universo de fuentes está vacío o sin feeds válidos. Ejecutar POST /api/territorio/fuentes/verificar."
                  : null
            },

            /*
              ROTACION — TERRITORIAL-RSS-ROTATION-01

              Responde «¿qué fuentes RSS todavía no se han
              escuchado en este ciclo?» sin tener que ejecutar
              nada.
            */
            rotacionRss:
              cohorte && !rotacion?.error
                ? {
                    ...estadoRotacion({
                      elegibles: feedsDeclarados,
                      estado: rotacion?.previo?.estado || new Map(),
                      ciclo: cohorte.ciclo,
                      pasada: cohorte.pasada,
                      presupuesto: cohorte.presupuesto,
                      ambito: ambitoRotacion
                    }),

                    /* Lo que hizo ESTA pasada. */
                    estaPasada: {
                      ciclo: cohorte.ciclo,
                      pasada: cohorte.pasada,
                      seleccionados: cohorte.seleccionados.map((f) => f.sourceId || f.feedUrl),
                      diferidos: cohorte.diferidos,
                      plazasSinUsar: cohorte.plazasSinUsar,
                      cicloCierra: cohorte.cicloCierra,
                      metricas: rotacionAnotada?.metricas || null,
                      errorAlAnotar: rotacionAnotada?.error || null
                    }
                  }
                : {
                    activa: false,

                    motivo:
                      rotacion?.error
                        ? `La rotación falló y se usó el orden por prioridad: ${rotacion.error}`
                        : feedsDeclarados.length === 0
                          ? "No hay feeds elegibles: nada que rotar."
                          : "Rotación desactivada en esta petición (`rotarFuentes: false`)."
                  }
          }
        : {
            ejecutada: false,

            motivo: `Modo «${cuerpo.modo || "noticias"}». La escucha ampliada solo se ejecuta con modo «ampliado».`
          },

      adapters: adaptersDeclarados,

      /* Base E1: se acumula ya, se compara despues. */
      snapshot: {
        snapshotId: snapshot.snapshotId,
        capturedAt: snapshot.capturedAt,
        huella: snapshot.huella,
        window: snapshot.window,
        persistencia,
        ventanaComparable,
        ventanasTemporales
      },

      /*
        INGEST-REAL-01: que se miro, que no, y que no se puede
        afirmar por eso. Va con el resto de auditorias porque
        condiciona como se leen TODAS las demas cifras.
      */
      cobertura: componerCobertura({
        run: {
          providers: (conversacion?.recoleccion?.trazaMotores || []).map((m) => ({
            providerId: m.motorId || m.fuente || m.motor,
            estado: m.estado,
            rawResults: m.recibidas ?? 0,
            error: m.detalle || m.error || null,
            permiteAfirmarAusencia: m.estado === "OK"
          }))
        },
        universo,
        dedup: {
          brutas: conversacion.evidencias.length,
          unicas: conversacion.evidencias.length,
          duplicadosAbsorbidos: 0
        },
        agendas: agendasPorFuente.metricas,
        territorio: {
          canton: territorio?.agregado?.metricas?.porResolucion?.canton ?? null,
          parroquia: territorio?.agregado?.metricas?.porResolucion?.parroquia ?? null,
          noLocalizado: territorio?.ubicacion?.metricas?.sinUbicar ?? null
        }
      }),

      viabilidadSocial: estadoViabilidadSocial(),

      benchmarkIngesta: fichaComparacion(),

      scheduler: estadoScheduler([]),

      /* Auditorias declaradas, sin coste ni red. */
      proveedores: matrizProveedores({
        trazaEjecucion: conversacion?.recoleccion?.registro || []
      }),

      benchmarkProveedores: estadoBenchmark(),

      aiRouter: estadoAiRouter(),

      coverageLimitations,

      proyecto: contextoProyecto?.proyecto || null,
      contextoProyecto: contextoProyecto
        ? {
            disponible: contextoProyecto.disponible,
            motivo: contextoProyecto.motivo,
            declaracion: contextoProyecto.declaracion || []
          }
        : null,

      actores,

      conversacion,
      territorio,
      mencionesPorTerritorio,

      costo: conversacion.costo,

      /*
        UN SOLO BLOQUE. Los dos motores producen el suyo; aqui
        se funden sin duplicados. Seis listas separadas no las
        lee nadie.
      */
      loQueNoSabemos: [
        ...new Set([
          ...(conversacion.loQueNoSabemos || []),
          ...(territorio.loQueNoSabemos || []),
          ...(mencionesPorTerritorio?.loQueNoSabemos || [])
        ])
      ]
    });
  } catch (e) {
    console.error("[territorio] analisis fallo:", e);

    res.status(500).json({ error: e?.message || "fallo el analisis" });
  }
});


/*
===========================================================
LIMITACIONES DE COBERTURA — Gate D
===========================================================

Lo que la pantalla tiene que poder decir para que nadie lea la
agenda como si fuera la conversacion completa de Cuenca.

La primera entrada es la mas importante y va siempre: el
corpus llega con sesgo de recoleccion demostrado, y esconderlo
convertiria una lectura parcial en una conclusion.
===========================================================
*/

function construirLimitacionesDeCobertura({
  conversacion,
  territorio,
  mapa,
  diversidad = null,
  agendasPorFuente = null
}) {
  const lims = [];

  const consultas = conversacion?.recoleccion?.consultasPlanificadas || [];

  const conSesgo = consultas.filter((c) =>
    /gestion|gobernanza/.test(String(c.etiqueta || ""))
  ).length;

  lims.push({
    id: "corpus_parcial",
    severidad: "alta",
    titulo: "Lectura basada en las fuentes y consultas observadas",
    detalle:
      "No representa la totalidad de la conversación de Cuenca. Es lo que estas fuentes devolvieron con estas consultas.",
    visibleSiempre: true
  });

  if (conSesgo > 0 && consultas.length > 0) {
    lims.push({
      id: "sesgo_de_consulta",
      severidad: "media",
      titulo: "Sesgo de consulta",
      detalle: `${conSesgo} de ${consultas.length} consultas llevan vocabulario de gestión pública. El corpus llega inclinado hacia esos temas.`,

      /*
        Siempre visible. Esta limitacion no matiza un dato
        suelto: inclina la AGENDA entera. Si el corpus se pidio
        con vocabulario de gestion, que la gestion encabece no
        es un hallazgo, es un eco de la consulta. Plegarla
        mientras se muestran limitaciones menores seria esconder
        justo la que cambia como se lee la pantalla.
      */
      visibleSiempre: true
    });
  }

  const sinCobertura =
    conversacion?.recoleccion?.cobertura?.motoresSinCobertura || [];

  if (sinCobertura.length) {
    lims.push({
      id: "motores_sin_cobertura",
      severidad: "media",
      titulo: `${sinCobertura.length} motores sin consultar`,
      detalle: `Sobre ${sinCobertura
        .map((m) => m.motor)
        .join(", ")} no se puede afirmar ausencia: no se les preguntó o no pudieron responder.`,
      visibleSiempre: false
    });
  }

  /*
    LA PLATAFORMA QUE ESCONDE EMISORES

    Medido en el corpus real de Cuenca: 12 de 30 evidencias
    llegaron por YouTube. Contadas como «una fuente» sugieren
    poca diversidad; contadas como doce, mucha. Ninguna de las
    dos es cierta: son doce emisores sin identificar, y hasta
    saber quienes son no se puede afirmar nada sobre ellos.
  */
  if (diversidad?.plataformas > 0 && diversidad.evidenciasEnPlataforma > 0) {
    const cuota = Math.round(
      (diversidad.evidenciasEnPlataforma / diversidad.totalEvidencias) * 100
    );

    lims.push({
      id: "emisores_sin_identificar",
      severidad: cuota >= 30 ? "alta" : "media",
      titulo: `${cuota} % del corpus llega por plataforma`,
      detalle: `${diversidad.evidenciasEnPlataforma} de ${diversidad.totalEvidencias} evidencias vienen de ${diversidad.plataformas} plataforma(s). Sus emisores reales no están identificados: no cuentan como fuentes independientes.`,
      visibleSiempre: cuota >= 30
    });
  }

  /*
    CONCENTRACION

    No es un defecto: si un solo medio cubre el canton, eso es
    un hecho del territorio. Lo que no se puede es leer la
    agenda como si viniera de muchas voces.
  */
  if (diversidad?.lecturaConcentracion === "alta" && diversidad.fuenteDominante) {
    lims.push({
      id: "corpus_concentrado",
      severidad: "media",
      titulo: "Corpus concentrado en pocas fuentes",
      detalle: `«${diversidad.fuenteDominante.id}» aporta ${diversidad.fuenteDominante.evidencias} de las ${diversidad.totalEvidencias} evidencias. Concentración alta no es un error del análisis, pero la agenda no puede leerse como si viniera de muchas voces.`,
      visibleSiempre: true
    });
  }

  /*
    AGENDAS VACIAS

    Que la agenda ciudadana este vacia NO significa que la
    ciudadania calle: significa que ninguna consulta trajo una
    fuente comunitaria. Es una carencia de la observacion y hay
    que decirlo antes de que se lea al reves.
  */
  if (agendasPorFuente?.metricas) {
    const vacias = ["AGENDA_CIUDADANA", "AGENDA_CREADORES", "AGENDA_INSTITUCIONAL"]
      .filter((a) => (agendasPorFuente.metricas[a]?.evidencias || 0) === 0)
      .map((a) => agendasPorFuente.etiquetas?.[a] || a);

    if (vacias.length > 0) {
      lims.push({
        id: "agendas_sin_observacion",
        severidad: "alta",
        titulo: `${vacias.length} agenda(s) sin una sola evidencia`,
        detalle: `${vacias.join(", ")}. Vacío NO significa silencio: significa que ninguna fuente de ese tipo entró en el corpus. Es una carencia de la observación, no un hallazgo sobre el territorio.`,
        visibleSiempre: true
      });
    }
  }

  if (mapa?.metricas?.unidadesSinGeometria > 0) {
    lims.push({
      id: "geometria_parcial",
      severidad: "media",
      titulo: "Cobertura geométrica parcial",
      detalle: `${mapa.metricas.unidadesSinGeometria} unidad(es) con actividad no se dibujan por falta de polígono oficial. Su actividad se muestra fuera del mapa.`,
      visibleSiempre: true
    });
  }

  const sinUbicar = territorio?.ubicacion?.metricas?.sinUbicar || 0;

  if (sinUbicar > 0) {
    lims.push({
      id: "sin_ubicar",
      severidad: "media",
      titulo: `${sinUbicar} evidencias sin ubicar`,
      detalle:
        "No entran en ningún conteo territorial. La ausencia de ubicación no es ausencia de hecho.",
      visibleSiempre: true
    });
  }

  lims.push({
    id: "sin_ventana_anterior",
    severidad: "alta",
    titulo: "Sin ventana comparable",
    detalle:
      "No se puede afirmar crecimiento, tendencia ni viralidad: haría falta observar el periodo anterior equivalente y el recolector todavía no lo trae.",
    visibleSiempre: true
  });

  lims.push({
    id: "publicaciones_no_personas",
    severidad: "alta",
    titulo: "Publicaciones, no personas",
    detalle:
      "Cada evidencia es un documento publicado. No son ciudadanos ni opiniones: N evidencias no son N personas hablando.",
    visibleSiempre: true
  });

  return lims;
}


/*
===========================================================
UNION DE EVIDENCIA — T-11
===========================================================

Cada evidencia con TODO lo que se sabe de ella, y con lo que
NO se sabe declarado como null explicito.

La distincion importa: `fecha: null` significa «la fuente no
la dio». Omitir el campo dejaria pensar que no aplica, y
rellenarlo con la fecha de recoleccion seria inventar el dato
mas peligroso de todos en una serie temporal.
===========================================================
*/

function construirEvidenciaEnriquecida({ evidencias, territorio, conversacion }) {
  /* Indice -> ubicacion, desde los cubos del agregador. */
  const ubicacionPorIndice = new Map();

  (territorio?.agregado?.unidades || []).forEach((u) => {
    (u.evidencias || []).forEach((ev) => {
      ubicacionPorIndice.set(ev.indice, {
        unidadId: u.unidadId,
        unidad: u.nombre,
        nivel: u.resolucion,
        procedencia: ev.procedencia,
        confianzaGeografica: ev.confianza
      });
    });
  });

  /* Indice -> temas. Una evidencia puede estar en varios. */
  const temasPorIndice = new Map();

  (conversacion?.temas?.temas || []).forEach((t) => {
    (t.indices || []).forEach((i) => {
      if (!temasPorIndice.has(i)) temasPorIndice.set(i, []);

      temasPorIndice.get(i).push({ id: t.id, nombre: t.nombre, origen: t.origen });
    });
  });

  /* Indice -> encuadre. */
  const encuadrePorIndice = new Map(
    (conversacion?.encuadre?.clasificadas || []).map((c) => [
      c.indice,
      { encuadre: c.encuadre, confianza: c.confianza, explicacion: c.explicacion }
    ])
  );

  return (evidencias || []).map((e, indice) => {
    const fuente = identificarFuente(e);

    const ubic = ubicacionPorIndice.get(indice) || null;

    const limitaciones = [];

    if (!e.fecha) {
      limitaciones.push(
        "Sin fecha: no entra en ninguna serie temporal. La fuente no la declaro."
      );
    }

    if (!ubic) {
      limitaciones.push(
        "Sin ubicacion: no entra en ningun conteo territorial."
      );
    } else if (ubic.procedencia === "agregada") {
      limitaciones.push(
        `Ubicacion agregada en "${ubic.unidad}": el dato no sostiene una unidad mas fina.`
      );
    }

    if (fuente.tipo === "agregador") {
      limitaciones.push(
        "Publicador no identificado: el enlace apunta a un agregador y el titular no declaro medio reconocible."
      );
    }

    if (fuente.resueltoPorNombre) {
      limitaciones.push(
        "Publicador resuelto por NOMBRE, no por dominio: mas fragil que leer la URL."
      );
    }

    return {
      indice,

      url: e.enlace || null,
      titulo: e.titulo || null,

      medio: {
        nombre: fuente.nombre || null,
        dominio: fuente.dominio || null,
        tipo: fuente.tipo,
        cobertura: fuente.cobertura || null,
        verificado: fuente.verificado === true,
        resueltoPorNombre: fuente.resueltoPorNombre === true
      },

      /* null explicito. Nunca la fecha de recoleccion. */
      fecha: e.fecha || null,

      motor: { id: e.motorId || null, nombre: e.origen || null },

      consulta: e.consulta || null,

      territorio: ubic,

      temas: temasPorIndice.get(indice) || [],

      encuadre: encuadrePorIndice.get(indice) || null,

      limitaciones
    };
  });
}


/*
-----------------------------------------------------------
SOLO CONVERSACION PUBLICA — sin capa territorial
-----------------------------------------------------------
*/

router.post("/conversacion", async (req, res) => {
  try {
    const cuerpo = req.body || {};

    const ambito = cuerpo.proyectoId
      ? (await contextoTerritorialDeProyecto(cuerpo.proyectoId)).ambito
      : ambitoDeclarado(cuerpo.territorio || {});

    const resultado = await analizarConversacionPublica({
      ambito,
      actores: cuerpo.actores || [],
      proyectoId: cuerpo.proyectoId || null,
      modo: cuerpo.modo,
      maxConsultasWeb: cuerpo.maxConsultasWeb,
      desde: cuerpo.desde,
      hasta: cuerpo.hasta,
      granularidad: cuerpo.granularidad
    });

    res.json({ ambito, ...resultado });
  } catch (e) {
    console.error("[territorio] conversacion fallo:", e);

    res.status(500).json({ error: e?.message || "fallo el analisis" });
  }
});


export default router;
