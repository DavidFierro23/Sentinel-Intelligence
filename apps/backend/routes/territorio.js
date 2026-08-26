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

import { cruzarTemaTerritorio } from "../services/geo/topicTerritoryCrosstab.js";

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
      2. CONVERSACION PUBLICA — recoleccion y analisis
      -------------------------------------------------------
    */
    const conversacion = await analizarConversacionPublica({
      ambito,
      actores,
      proyectoId: cuerpo.proyectoId || null,
      modo: cuerpo.modo,
      maxConsultasWeb: cuerpo.maxConsultasWeb,
      desde: cuerpo.desde,
      hasta: cuerpo.hasta,
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

    res.json({
      modulo: "inteligencia_territorial",
      version: "1.0",

      ambito,

      evidenciasEnriquecidas,

      temaPorTerritorio,

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

      /* Base E1: se acumula ya, se compara despues. */
      snapshot: {
        snapshotId: snapshot.snapshotId,
        capturedAt: snapshot.capturedAt,
        huella: snapshot.huella,
        window: snapshot.window,
        persistencia,
        ventanaComparable
      },

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
