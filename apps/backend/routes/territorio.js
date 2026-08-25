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

    res.json({
      modulo: "inteligencia_territorial",
      version: "1.0",

      ambito,

      evidenciasEnriquecidas,

      temaPorTerritorio,

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
