// apps/backend/services/social/discovery/discoveryEngine.js

import {
  normalizarTexto,
  normalizarUrl,
  extraerDominio,
  detectarPlataformaPorUrl,
  extraerHandle,
  obtenerEnlace,
  textoDeResultado
} from "../../textUtils.js";

import { buscarWeb, crearSesion, resumirSesion } from "../../searchProviderLayer.js";

import {
  esPlataformaSocial,
  TIPOS_CON_IDENTIDAD,
  MODOS_ACCESO,
  ESTADOS_PRESENCIA,
  catalogoPlataformas
} from "../socialContracts.js";

/*
===========================================================
DISCOVERY ENGINE
===========================================================

Responsabilidad: producir la lista de CUENTAS CANDIDATAS por
plataforma. Descubre; NO decide si pertenecen al objetivo
(eso es del Identity Matcher).

TRES VÍAS, en orden de fiabilidad (ARQ-SIL-001 §3.1):

  1. Handles ya observados en el Perfil de Referencia
     — la más fiable: la URL ya apareció en evidencias reales.
  2. Evidencias del Fusion Engine que apuntan a plataformas
     sociales — ya están recogidas, no cuesta nada.
  3. Consultas dirigidas vía Search Provider Layer
     — site:instagram.com "Nombre" término_discriminante

PROVEEDORES:

No se consulta ningún buscador directamente. Se pide a la
Search Provider Layer, que resuelve con el proveedor
disponible (Brave si tiene clave, DuckDuckGo como respaldo) y
declara cuál usó. El origen de cada hallazgo queda registrado
con el proveedor REAL que lo encontró.

LÍMITE DEL SPRINT 3.1:

No se lee ningún perfil: no hay Platform Scanner todavía. Por
eso toda presencia descubierta es `presencia_inferida`, y así
se declara. No se sondea la existencia de URLs de perfil por
red (quedaría a merced del bloqueo de las plataformas, el
mismo error que ya cometimos con DuckDuckGo).
===========================================================
*/


const LIMITE_CONSULTAS_DIRIGIDAS = 4;

const PLATAFORMAS = catalogoPlataformas();


/*
-----------------------------------------------------------
REGISTRAR UN CANDIDATO

Un candidato se identifica por plataforma + handle. Si el
mismo aparece por varias vías, se acumulan sus ORÍGENES en
lugar de duplicarlo.
-----------------------------------------------------------
*/

function registrarCandidato(mapa, datos) {
  const {
    plataforma,
    handle,
    url,
    urlNormalizada,
    via,
    proveedor,
    consulta,
    etiquetaConsulta,
    titulo,
    descripcion,
    evidenciaId
  } = datos;

  const clave = `${plataforma.id}:${normalizarTexto(handle)}`;

  if (!mapa.has(clave)) {
    mapa.set(clave, {
      id: `cnd-${mapa.size}`,

      plataformaId: plataforma.id,
      plataforma: plataforma.nombre,
      tipoPlataforma: plataforma.tipo,

      handle,
      url,
      urlNormalizada,
      dominio: extraerDominio(url),

      /*
        Textos observados en el descubrimiento. Es lo único
        que tenemos del "perfil" mientras no exista el
        Platform Scanner: no se presenta como biografía.
      */
      titulosObservados: [],
      descripcionesObservadas: [],

      /*
        Trazabilidad: cada vía y proveedor que lo aportó.
      */
      origenes: [],

      /*
        Sin Platform Scanner no se lee el perfil.
      */
      modoAcceso: MODOS_ACCESO.PRESENCIA_INFERIDA,
      estadoPresencia: ESTADOS_PRESENCIA.INFERIDA,

      descubiertoEn: new Date().toISOString()
    });
  }

  const candidato = mapa.get(clave);

  /*
    Origen sin duplicar: misma vía + mismo proveedor + misma
    consulta cuenta una sola vez.
  */
  const claveOrigen = `${via}|${proveedor || "-"}|${consulta || "-"}`;

  if (!candidato.origenes.some((o) => o.clave === claveOrigen)) {
    candidato.origenes.push({
      clave: claveOrigen,
      via,
      proveedor: proveedor || null,
      consulta: consulta || null,
      etiquetaConsulta: etiquetaConsulta || null,
      evidenciaId: evidenciaId || null,
      registradoEn: new Date().toISOString()
    });
  }

  if (titulo && !candidato.titulosObservados.includes(titulo)) {
    candidato.titulosObservados.push(titulo);
  }

  if (
    descripcion &&
    descripcion.length > 15 &&
    !candidato.descripcionesObservadas.includes(descripcion)
  ) {
    candidato.descripcionesObservadas.push(descripcion);
  }

  return candidato;
}


/*
-----------------------------------------------------------
EXTRAER CANDIDATO DE UN RESULTADO

Clasifica por DOMINIO, nunca por el texto del título.
-----------------------------------------------------------
*/

function candidatoDesdeResultado(resultado, via, contexto = {}) {
  const enlace = obtenerEnlace(resultado);

  if (!enlace) return null;

  const plataforma = detectarPlataformaPorUrl(enlace);

  if (!plataforma) return null;

  if (!esPlataformaSocial(plataforma.id)) return null;

  if (!TIPOS_CON_IDENTIDAD.includes(plataforma.tipo)) return null;

  const handle = extraerHandle(enlace);

  if (!handle) return null;

  const urlNormalizada = normalizarUrl(enlace);

  if (!urlNormalizada) return null;

  return {
    plataforma: {
      id: plataforma.id,
      nombre: plataforma.nombre,
      tipo: plataforma.tipo
    },
    handle,
    url: enlace,
    urlNormalizada,
    via,
    proveedor:
      resultado.motor || resultado.__origen || contexto.proveedor || null,
    consulta: resultado.consulta || contexto.consulta || null,
    etiquetaConsulta: resultado.etiquetaConsulta || contexto.etiqueta || null,
    titulo: (resultado.titulo || "").trim(),
    descripcion: textoDeResultado(resultado).trim(),
    evidenciaId: resultado.id || null
  };
}


/*
-----------------------------------------------------------
VÍA 3 — PLAN DE CONSULTAS DIRIGIDAS

Usa el Perfil de Referencia, no solo el nombre. Es lo que
diferencia esto de una búsqueda ingenua.
-----------------------------------------------------------
*/

export function planificarConsultasSociales(perfil, plataformasObjetivo) {
  const nombre = perfil?.nombrePrincipal;

  if (!nombre) return [];

  const plan = [];
  const vistas = new Set();

  function agregar(consulta, etiqueta, plataformaId) {
    const limpia = consulta.trim();

    const clave = normalizarTexto(limpia);

    if (!limpia || vistas.has(clave)) return;

    vistas.add(clave);

    plan.push({ consulta: limpia, etiqueta, plataformaId });
  }

  /*
    a) Handles ya observados: buscarlos por sí mismos suele
       traer sus otras plataformas. Es la consulta de mayor
       rendimiento.
  */
  (perfil.handlesObservados || []).slice(0, 2).forEach((h) => {
    agregar(`"${h.handle}"`, `handle_observado:${h.handle}`, null);
  });

  /*
    b) Nombre + término discriminante restringido a las
       plataformas sociales. Un solo operador site: con OR no
       es soportado por todos los proveedores, así que se
       consulta por plataforma prioritaria.
  */
  const discriminante = (perfil.terminosDiscriminantes || []).find(
    (t) => t.termino && (t.fuentes || []).length > 0
  );

  plataformasObjetivo.slice(0, 3).forEach((p) => {
    const dominio = p.dominios[0];

    agregar(
      discriminante
        ? `site:${dominio} "${nombre}" ${discriminante.termino}`
        : `site:${dominio} "${nombre}"`,
      `dirigida:${p.id}`,
      p.id
    );
  });

  return plan.slice(0, LIMITE_CONSULTAS_DIRIGIDAS);
}


/*
===========================================================
FUNCIÓN PRINCIPAL
===========================================================
*/

export async function descubrirCandidatos(perfil, opciones = {}) {
  const inicio = Date.now();

  const mapa = new Map();

  const trazas = [];

  const plataformasObjetivo = PLATAFORMAS;

  /*
    ---------------------------------------------------------
    VÍA 1 — HANDLES YA OBSERVADOS EN EL PERFIL
    La más fiable: la URL ya apareció en evidencias reales.
    ---------------------------------------------------------
  */
  const observados = Array.isArray(perfil?.handlesObservados)
    ? perfil.handlesObservados
    : [];

  observados.forEach((h) => {
    const plataforma = PLATAFORMAS.find(
      (p) =>
        p.id === h.plataformaId ||
        normalizarTexto(p.nombre) === normalizarTexto(h.plataforma)
    );

    if (!plataforma) return;

    registrarCandidato(mapa, {
      plataforma,
      handle: h.handle,
      url: h.enlace,
      urlNormalizada: h.urlNormalizada || normalizarUrl(h.enlace),
      via: "handle_observado",
      proveedor: (h.fuentes || [])[0] || null,
      consulta: null,
      etiquetaConsulta: null,
      titulo: null,
      descripcion: null,
      evidenciaId: (h.evidencias || [])[0] || null
    });
  });

  trazas.push({
    via: "handle_observado",
    entrada: observados.length,
    candidatos: mapa.size
  });

  /*
    ---------------------------------------------------------
    VÍA 2 — EVIDENCIAS YA RECOGIDAS POR EL FUSION ENGINE
    Coste cero: ya están en memoria.
    ---------------------------------------------------------
  */
  const evidenciasPrevias = Array.isArray(opciones.evidenciasPrevias)
    ? opciones.evidenciasPrevias
    : [];

  const antesDeVia2 = mapa.size;

  evidenciasPrevias.forEach((ev) => {
    const datos = candidatoDesdeResultado(ev, "evidencia_fusion", {
      proveedor: (ev.motores || []).map((m) => m.nombre).join(" + ") || null
    });

    if (datos) registrarCandidato(mapa, datos);
  });

  trazas.push({
    via: "evidencia_fusion",
    entrada: evidenciasPrevias.length,
    candidatosNuevos: mapa.size - antesDeVia2
  });

  /*
    ---------------------------------------------------------
    VÍA 3 — CONSULTAS DIRIGIDAS VÍA SEARCH PROVIDER LAYER
    ---------------------------------------------------------
  */
  const plan = opciones.omitirConsultas
    ? []
    : planificarConsultasSociales(perfil, plataformasObjetivo);

  const sesion = opciones.sesion || crearSesion({ tipo: "web" });

  const intentos = [];

  const antesDeVia3 = mapa.size;

  for (const entrada of plan) {
    const respuesta = await buscarWeb(entrada.consulta, {
      etiqueta: entrada.etiqueta,
      sesion
    });

    intentos.push({
      plataformaId: entrada.plataformaId || null,
      consulta: entrada.consulta,
      etiqueta: entrada.etiqueta,
      proveedorUsado: respuesta.proveedorUsado?.nombre || null,
      estado: respuesta.estado,
      resultados: respuesta.total,
      coberturaParcial: respuesta.coberturaParcial
    });

    (respuesta.resultados || []).forEach((r) => {
      const datos = candidatoDesdeResultado(r, "consulta_dirigida", {
        proveedor: respuesta.proveedorUsado?.nombre || null,
        consulta: entrada.consulta,
        etiqueta: entrada.etiqueta
      });

      if (datos) registrarCandidato(mapa, datos);
    });
  }

  trazas.push({
    via: "consulta_dirigida",
    consultas: plan.length,
    candidatosNuevos: mapa.size - antesDeVia3
  });

  /*
    ---------------------------------------------------------
    SALIDA
    ---------------------------------------------------------
  */
  const candidatos = [...mapa.values()].map((c) => ({
    ...c,

    /*
      Se limpia la clave interna del origen.
    */
    origenes: c.origenes.map(({ clave, ...resto }) => resto),

    totalOrigenes: c.origenes.length,

    /*
      Vías distintas por las que se descubrió. Insumo directo
      de la señal S7 (presencia cruzada) y de la calidad.
    */
    vias: [...new Set(c.origenes.map((o) => o.via))],

    /*
      Proveedores distintos que lo aportaron: corroboración.
    */
    proveedores: [...new Set(c.origenes.map((o) => o.proveedor).filter(Boolean))]
  }));

  /*
    Cobertura por plataforma, incluidas las que NO aparecieron.
    Una plataforma sin hallazgos no es lo mismo que una
    plataforma no comprobada.
  */
  const cobertura = plataformasObjetivo.map((p) => {
    const encontrados = candidatos.filter((c) => c.plataformaId === p.id);

    /*
      Consultas planificadas para esta plataforma y su
      resultado REAL.

      DISTINCIÓN CRÍTICA: "se consultó y no había nada"
      (ausencia) no es lo mismo que "se intentó consultar y
      el proveedor bloqueó" (no comprobada).

      Declarar ausencia tras un bloqueo afirmaría que la
      cuenta no existe cuando en realidad no pudimos mirar.
      Es el mismo error que separó `bloqueado` de
      `0 resultados` en el Search Provider Layer.
    */
    const consultasDeLaPlataforma = intentos.filter((i) =>
      plan.some(
        (e) => e.plataformaId === p.id && e.consulta === i.consulta
      )
    );

    const consultadaConExito = consultasDeLaPlataforma.some(
      (i) => i.estado === "OK"
    );

    const consultadaSinExito =
      consultasDeLaPlataforma.length > 0 && !consultadaConExito;

    let estadoPresencia;
    let motivoCobertura;

    if (encontrados.length) {
      estadoPresencia = ESTADOS_PRESENCIA.INFERIDA;
      motivoCobertura = `${encontrados.length} candidato(s) descubierto(s).`;
    } else if (consultadaConExito) {
      estadoPresencia = ESTADOS_PRESENCIA.AUSENCIA;
      motivoCobertura =
        "Se consultó correctamente y no se encontró presencia.";
    } else if (consultadaSinExito) {
      estadoPresencia = ESTADOS_PRESENCIA.NO_COMPROBADA;
      motivoCobertura = `Se intentó consultar pero el proveedor no respondió (${consultasDeLaPlataforma
        .map((i) => i.estado)
        .join(", ")}). No se puede afirmar ausencia.`;
    } else {
      estadoPresencia = ESTADOS_PRESENCIA.NO_COMPROBADA;
      motivoCobertura = "No se planificó ninguna consulta para esta plataforma.";
    }

    return {
      plataformaId: p.id,
      plataforma: p.nombre,
      candidatos: encontrados.length,
      estadoPresencia,
      motivoCobertura,
      consultasIntentadas: consultasDeLaPlataforma.length,
      consultasConExito: consultasDeLaPlataforma.filter((i) => i.estado === "OK")
        .length,
      modoAcceso: MODOS_ACCESO.PRESENCIA_INFERIDA
    };
  });

  const resumen = resumirSesion(sesion);

  return {
    version: "1.0",

    objetivo: perfil?.nombrePrincipal || null,

    candidatos: candidatos.sort((a, b) => b.totalOrigenes - a.totalOrigenes),

    cobertura,

    plan,

    intentos,

    trazas,

    proveedores: resumen,

    advertencias: [
      ...(resumen?.advertencias || []),
      ...(intentos.some((i) => i.estado !== "OK")
        ? [
            `${intentos.filter((i) => i.estado !== "OK").length} de ${intentos.length} consultas sociales no obtuvieron respuesta del proveedor. Las plataformas afectadas quedan como NO COMPROBADAS, no como ausentes.`
          ]
        : []),
      ...(plan.length === 0 && !opciones.omitirConsultas
        ? ["Sin plan de consultas: el Perfil de Referencia no aportó handles ni términos discriminantes."]
        : []),
      /*
        Declaración obligatoria del límite del sprint.
      */
      "Ningún perfil fue leído: no hay Platform Scanner. Toda presencia es inferida desde descubrimiento web."
    ],

    metricas: {
      candidatosUnicos: candidatos.length,
      plataformasConCandidatos: cobertura.filter((c) => c.candidatos > 0).length,
      plataformasNoComprobadas: cobertura.filter(
        (c) => c.estadoPresencia === ESTADOS_PRESENCIA.NO_COMPROBADA
      ).length,
      consultasEjecutadas: intentos.length,
      tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`
    },

    generadoEn: new Date().toISOString()
  };
}
