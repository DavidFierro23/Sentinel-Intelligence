// apps/backend/services/media/analyzePiece.js

import { resolverPieza } from "./pieceResolver.js";

import { leerMetricas, planDeMetricas, resumirDisponibilidad } from "./pieceMetrics.js";

import { buscarAmplificacion, construirMapa, construirConsultas } from "./pieceAmplification.js";

import { temasDePieza } from "./pieceTopics.js";

import { territorioDePieza } from "./pieceTerritory.js";

import { relacionarConCandidato } from "./pieceCandidate.js";

import { impactoObservado } from "./pieceImpact.js";

import {
  componerSnapshotPieza,
  serieDePieza,
  persistenciaObservada
} from "./pieceSnapshot.js";

import { guardarAnalisis, historialDePieza } from "./pieceStore.js";

import {
  CONTRATO_ANALISIS_PIEZA,
  AFIRMACIONES_PROHIBIDAS,
  DISPONIBILIDAD
} from "./pieceContracts.js";

import { obtenerCandidato } from "../projects/projectStore.js";

/*
===========================================================
ANALIZAR UNA PIEZA — ORQUESTADOR MEDIA-PIECE-01
===========================================================

Un analista pega una URL. Esto devuelve el analisis completo,
con evidencias y limitaciones, en una sola llamada.

ORDEN DE LOS PASOS Y POR QUE ESE ORDEN
-----------------------------------------------------------

    1. resolver        sin pieza no hay nada que analizar
    2. candidato        se carga antes de buscar: su nombre
                        entra en las consultas y en los
                        stop-concepts de los temas
    3. metricas         una llamada, 1 unidad de cuota
    4. amplificacion    hasta 4 consultas web
    5. temas            necesita el corpus del paso 4
    6. territorio       necesita la pieza y la amplificacion
    7. impacto          agrega lo anterior, no mide nada nuevo
    8. snapshot         foto del instante
    9. persistir        Lake

MODO SECO (`dryRun`)
-----------------------------------------------------------

Con `dryRun: true` no se ejecuta ninguna peticion de red: se
devuelve el PLAN de requests. §17 exige poder mostrar los
requests planeados antes de lanzarlos, y esta es la forma de
cumplirlo sin gastar una sola unidad de cuota.

DEGRADACION
-----------------------------------------------------------

Ningun paso puede tumbar el analisis. Cada bloque que falle
devuelve su motivo y el resto continua. Un analisis con seis de
ocho bloques y dos motivos declarados es util; una excepcion no
lo es.
===========================================================
*/


export async function analizarPieza(entrada = {}, opciones = {}) {
  const inicio = Date.now();

  const observedAt = entrada.observedAt || new Date().toISOString();

  const dryRun = entrada.dryRun === true;

  const limitaciones = [];

  const evidencias = [];

  const cuota = {
    youtube: { unidadesConsumidas: 0, llamadas: 0 },
    web: { consultas: 0, proveedores: [] }
  };

  /*
    =========================================================
    1. RESOLVER LA PIEZA
    =========================================================
  */
  const res = resolverPieza({
    url: entrada.url,
    titulo: entrada.titulo,
    snippet: entrada.snippet,
    autor: entrada.autor,
    publishedAt: entrada.publishedAt,
    observedAt
  });

  if (!res.ok) {
    return {
      ok: false,
      motivo: res.motivo,
      contrato: CONTRATO_ANALISIS_PIEZA,
      entrada: { url: entrada.url || null }
    };
  }

  let pieza = res.pieza;

  let emisor = res.emisor;

  limitaciones.push(...(res.limitaciones || []));

  evidencias.push({
    evidenceId: res.evidencia.evidenceId,
    tipo: "pieza_analizada",
    canonicalUrl: pieza.canonicalUrl,
    url: pieza.url,
    provider: "analista_url_pegada",
    observedAt,
    titulo: pieza.titulo
  });

  /*
    =========================================================
    2. CANDIDATO
    =========================================================
  */
  let candidato = null;

  let candidatoError = null;

  if (entrada.candidateId) {
    if (!entrada.projectId) {
      candidatoError =
        "Se indico candidateId sin projectId: el registro de candidatos es por proyecto y no se puede resolver sin el.";
    } else {
      try {
        const c = await obtenerCandidato(entrada.projectId, entrada.candidateId);

        if (!c) {
          candidatoError = `El candidato ${entrada.candidateId} no existe en el proyecto ${entrada.projectId}.`;
        } else {
          candidato = {
            candidateId: c.id || entrada.candidateId,
            nombre: c.nombre || c.nombreCompleto || null,
            alias: c.alias || c.variantes || [],
            cuentas: c.cuentas || c.redes || []
          };
        }
      } catch (error) {
        candidatoError = `No se pudo leer el candidato: ${error?.message || "error desconocido"}.`;
      }
    }
  }

  if (candidatoError) limitaciones.push(candidatoError);

  /*
    =========================================================
    3. METRICAS
    =========================================================
  */
  const plan = planDeMetricas(pieza);

  let metricas = plan.metricas;

  let metricasEstado = { estado: "PLANIFICADO", motivo: plan.nota };

  if (!dryRun) {
    const m = await leerMetricas(pieza, { observedAt, fetch: opciones.fetch });

    metricas = m.metricas;

    metricasEstado = { estado: m.estado, motivo: m.motivo };

    cuota.youtube = m.cuota.youtube;

    evidencias.push(...(m.evidenciasDeMetrica || []));

    /*
      La lectura puede traer el titulo y la fecha REALES. Se
      aplican sobre la pieza sustituyendo lo declarado por el
      analista, porque la plataforma es mejor fuente.
    */
    if (m.enriquecimiento) {
      const e = m.enriquecimiento;

      pieza = {
        ...pieza,
        titulo: e.titulo || pieza.titulo,
        publishedAt: e.publishedAt || pieza.publishedAt,
        canonicalUrl: e.canonicalUrl || pieza.canonicalUrl,
        cuenta: e.cuenta || null,
        cuentaId: e.cuentaId || null,

        autorProcedencia: e.titulo ? e.procedencia : pieza.autorProcedencia,
        publishedAtProcedencia: e.publishedAt
          ? e.procedencia
          : pieza.publishedAtProcedencia
      };

      /*
        Si el emisor quedo sin resolver porque la cuenta no
        estaba en la URL, la lectura de la plataforma acaba de
        aportarla. Ahora SI se puede nombrar al emisor, y con
        procedencia de la propia plataforma, que es la mejor
        fuente posible.
      */
      if (emisor?.pendienteDeResolver && e.cuenta) {
        emisor = {
          ...emisor,
          clase: "CREADOR",
          nombre: e.cuenta,
          cuentaId: e.cuentaId || null,
          procedencia: e.procedencia,
          pendienteDeResolver: false,

          razones: [
            ...(emisor.razones || []),
            `La lectura de la plataforma resolvio la cuenta: "${e.cuenta}"${
              e.cuentaId ? ` (${e.cuentaId})` : ""
            }.`
          ],

          advertencia:
            "CREADOR es la clase por defecto para una cuenta de plataforma. Podria ser un medio, un periodista o una institucion: exige verificacion del analista y NO se deduce de sus suscriptores."
        };
      }
    }

    if (m.estado === "CUOTA_AGOTADA") {
      limitaciones.push(
        "Cuota diaria de YouTube agotada: las metricas de esta pieza no se pudieron leer hoy."
      );
    }
  }

  const disponibilidad = resumirDisponibilidad(metricas);

  /*
    =========================================================
    4. AMPLIFICACION
    =========================================================
  */
  let amplificacion = null;

  let planConsultas = construirConsultas(pieza, {
    nombreCandidato: candidato?.nombre || null
  });

  /*
    `sinBusquedaWeb` corta la busqueda de amplificacion sin
    cortar el resto del analisis.

    Existe por dos razones reales, no por comodidad de los tests:

      1. Los proveedores de busqueda usan el fetch global y NO
         honran un fetch inyectado. Sin este interruptor,
         cualquier prueba del camino completo lanzaria consultas
         reales contra DuckDuckGo, que es justo lo que agota el
         motor y lo deja bloqueado diez minutos.

      2. Un analista puede querer solo las metricas de la pieza
         sin gastar el presupuesto de consultas del dia.
  */
  const sinBusqueda = entrada.sinBusquedaWeb === true;

  if (sinBusqueda) {
    limitaciones.push(
      "Busqueda de amplificacion desactivada por el llamador: no se consultaron proveedores web. Las cifras de amplificacion, fuentes y contenidos no estan disponibles en este analisis."
    );
  }

  if (!dryRun && !sinBusqueda) {
    try {
      const b = await buscarAmplificacion(pieza, {
        nombreCandidato: candidato?.nombre || null,
        observedAt,
        fetch: opciones.fetch
      });

      cuota.web.consultas = b.consultasEjecutadas.length;

      cuota.web.proveedores = [
        ...new Set(b.consultasEjecutadas.map((c) => c.proveedor).filter(Boolean))
      ];

      amplificacion = {
        ...construirMapa(pieza, b.piezas, { observedAt }),
        consultasEjecutadas: b.consultasEjecutadas,
        consultasDescartadas: b.consultasDescartadas,
        metricasDedup: b.metricasDedup,
        resumenProveedores: b.resumenProveedores,
        evidenciasBrutas: b.evidenciasBrutas
      };

      b.piezas.forEach((p) => {
        evidencias.push({
          evidenceId: p.evidenceId,
          tipo: "pieza_amplificacion",
          canonicalUrl: p.canonicalUrl,
          url: p.url,
          provider: p.providerId || (p.providersSeenBy || [])[0] || null,
          observedAt,
          titulo: p.title || null
        });
      });

      const bloqueadas = b.consultasEjecutadas.filter(
        (c) => c.estado === "BLOQUEADO"
      );

      if (bloqueadas.length) {
        limitaciones.push(
          `El proveedor web quedo bloqueado en ${bloqueadas.length} consulta(s): la amplificacion observada es incompleta y no representa todo lo publicado.`
        );
      }

      if (b.consultasEjecutadas.every((c) => (c.resultados || 0) === 0)) {
        limitaciones.push(
          "Ninguna consulta devolvio resultados. Puede que la pieza no haya sido replicada, o que el motor de busqueda no la indexe todavia."
        );
      }
    } catch (error) {
      limitaciones.push(
        `La busqueda de amplificacion fallo: ${error?.message || "error desconocido"}.`
      );
    }
  }

  const piezasAmp = amplificacion?.nodos || [];

  /*
    =========================================================
    5. TEMAS
    =========================================================
  */
  let temas = null;

  try {
    temas = temasDePieza({
      pieza,
      piezasAmplificacion: piezasAmp.map((n) => ({
        title: n.titulo,
        snippet: n.snippet,
        publishedAt: n.publishedAt,
        canonicalUrl: n.canonicalUrl,
        url: n.url,
        evidenceId: n.evidenceId,
        platform: n.plataforma
      })),
      nombreCandidato: candidato?.nombre || null,
      nombreEmisor: emisor?.nombre || null,
      ambito: entrada.ambitoId || null,
      consultas: (planConsultas.consultas || []).map((c) => c.texto)
    });

    limitaciones.push(...(temas.limitaciones || []));
  } catch (error) {
    limitaciones.push(
      `El calculo de temas fallo: ${error?.message || "error desconocido"}.`
    );
  }

  /*
    =========================================================
    6. TERRITORIO
    =========================================================
  */
  let territorio = null;

  try {
    territorio = territorioDePieza({
      pieza,
      piezasAmplificacion: piezasAmp,
      ambitoId: entrada.ambitoId || null
    });

    if (!territorio.tieneEvidenciaTerritorial) {
      limitaciones.push(`Territorio: ${territorio.motivo}`);
    }
  } catch (error) {
    limitaciones.push(
      `La resolucion territorial fallo: ${error?.message || "error desconocido"}.`
    );
  }

  /*
    =========================================================
    2b. RELACION CON EL CANDIDATO (necesita la amplificacion)
    =========================================================
  */
  const relacionCandidato = relacionarConCandidato({
    pieza,
    emisor,
    candidato,
    piezasAmplificacion: piezasAmp,
    observedAt
  });

  /*
    =========================================================
    8. SNAPSHOT E HISTORIAL
    =========================================================
  */
  const snapshot = componerSnapshotPieza({
    pieceId: pieza.pieceId,
    publicationId: pieza.publicationId,
    canonicalUrl: pieza.canonicalUrl,
    plataforma: pieza.plataforma,
    metricas,
    observedAt,
    projectId: entrada.projectId || null,
    candidateId: candidato?.candidateId || null,
    cuota
  });

  let historial = { encontrado: false, snapshots: [] };

  if (!dryRun) {
    try {
      historial = await historialDePieza(pieza.canonicalUrl, {
        pieceId: pieza.pieceId,
        proyectoId: entrada.projectId || null
      });
    } catch {
      historial = { encontrado: false, snapshots: [] };
    }
  }

  /*
    El snapshot de HOY entra en la serie: sin el, el segundo
    analisis del dia no veria el primero.
  */
  const todos = [
    ...historial.snapshots.filter((s) => s.snapshotId !== snapshot.snapshotId),
    snapshot
  ];

  const serie = serieDePieza(todos);

  const persistencia = persistenciaObservada(pieza, todos);

  /*
    =========================================================
    7. IMPACTO OBSERVADO
    =========================================================
  */
  const impacto = impactoObservado({
    pieza,
    metricas,
    amplificacion,
    territorio,
    serie,
    persistencia,
    baseline: null,
    evidencias
  });

  /*
    =========================================================
    CONVERSACION OBSERVABLE (§10)

    Se compone aqui porque es una LECTURA de lo ya medido, no
    una medicion nueva. El rotulo importa: es conversacion
    observable, no opinion publica.
    =========================================================
  */
  const conversacion = {
    ...impacto.dimensiones.conversacion,

    detalle: {
      citas: amplificacion?.porRol?.CITA || 0,
      replicas: amplificacion?.porRol?.REPLICA || 0,
      coberturaRelacionada: amplificacion?.porRol?.COBERTURA_RELACIONADA || 0
    },

    noRepresenta:
      "Quien comenta o replica no representa a ningun territorio ni a ninguna poblacion. No se infiere de donde es.",

    evidenceIds: piezasAmp.map((n) => n.evidenceId).filter(Boolean)
  };

  /*
    =========================================================
    9. PERSISTIR
    =========================================================
  */
  const analisis = {
    ok: true,

    contrato: CONTRATO_ANALISIS_PIEZA,

    entrada: {
      url: entrada.url,
      candidateId: entrada.candidateId || null,
      projectId: entrada.projectId || null,
      ambitoId: entrada.ambitoId || null,
      dryRun,
      sinBusquedaWeb: sinBusqueda
    },

    observedAt,

    pieza,
    emisor,

    metricas,
    disponibilidadMetricas: disponibilidad,
    planDeMetricas: plan,
    estadoLecturaMetricas: metricasEstado,

    candidato: relacionCandidato,

    amplificacion,
    planDeConsultas: planConsultas,

    temas,
    conversacion,
    territorio,

    impactoObservado: impacto,

    snapshot,
    serie,
    persistencia,

    evidencias,

    limitaciones: [...new Set(limitaciones.filter(Boolean))],

    cuota,

    cobertura: {
      dryRun,
      pasosEjecutados: dryRun
        ? ["resolver", "candidato", "plan_de_metricas", "plan_de_consultas"]
        : [
            "resolver",
            "candidato",
            "metricas",
            "amplificacion",
            "temas",
            "territorio",
            "impacto",
            "snapshot"
          ],

      declaracion: dryRun
        ? "MODO SECO: no se ejecuto ninguna peticion de red. Lo que se muestra es el plan."
        : "Analisis ejecutado. La cobertura depende de lo que los proveedores indexan y de las cuotas disponibles."
    },

    tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`
  };

  if (!dryRun && opciones.persistir !== false) {
    analisis.persistencia_lake = await guardarAnalisis(analisis, opciones);
  } else {
    analisis.persistencia_lake = {
      persistido: false,
      motivo: dryRun
        ? "Modo seco: no se escribe nada."
        : "Persistencia desactivada por el llamador."
    };
  }

  return analisis;
}


/*
-----------------------------------------------------------
COMPROBACION DE HIGIENE

Recorre la respuesta buscando las afirmaciones prohibidas.
Existe para que el test pueda ejecutarla y para que un cambio
futuro que introduzca `personasAlcanzadas` falle en CI en lugar
de llegar a un cliente.
-----------------------------------------------------------
*/
export function auditarAfirmaciones(analisis) {
  const texto = JSON.stringify(analisis || {});

  const encontradas = AFIRMACIONES_PROHIBIDAS.filter((clave) =>
    new RegExp(`"${clave}"\\s*:`, "i").test(texto)
  );

  return {
    limpio: encontradas.length === 0,
    encontradas,

    declaracion: encontradas.length
      ? `La respuesta contiene campos prohibidos: ${encontradas.join(", ")}.`
      : "La respuesta no contiene ningun campo de influencia, poblacion ni intencion de voto."
  };
}


export default { analizarPieza, auditarAfirmaciones };
