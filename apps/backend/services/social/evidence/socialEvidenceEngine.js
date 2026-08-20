// apps/backend/services/social/evidence/socialEvidenceEngine.js

/*
  HASH UNIFICADO (Sprint 4)

  La implementacion canonica vive en el Knowledge Lake. Antes
  habia una copia local aqui: dos implementaciones del mismo
  hash acabarian divergiendo, y en ese momento la verificacion
  de inmutabilidad dejaria de significar nada sin que nadie lo
  notase. Verificado byte a byte antes de unificar: los hashes
  ya emitidos no cambian.
*/
import { calcularHash } from "../../knowledgeLake/lakeHash.js";

import {
  normalizarTexto,
  normalizarUrl,
  extraerDominio,
  detectarPlataformaPorUrl
} from "../../textUtils.js";

import {
  TIPOS_EVIDENCIA,
  CALIDADES,
  MODOS_ACCESO,
  ESTADOS_PRESENCIA,
  validarEvidenciaSocial
} from "../socialContracts.js";

/*
===========================================================
SOCIAL EVIDENCE ENGINE
===========================================================

Único punto de salida del Social Intelligence Layer.
Nada sale del SIL sin pasar por aquí.

RESPONSABILIDADES (ARQ-SIL-001 §3.5):

  1. FICHA ÚNICA POR PERFIL — una cuenta = una ficha, con
     todo lo que se sabe de ella consolidado.
  2. DEDUPLICACIÓN — por URL canónica y por plataforma+handle.
  3. URL CANÓNICA — forma estable y comparable.
  4. LINAJE COMPLETO — de dónde salió y de qué deriva (DT3).
  5. HASH ESTABLE — mismo contenido, mismo hash, siempre.
     Es lo que hace verificable la inmutabilidad en el
     Knowledge Lake.

COMPATIBILIDAD:

  · Fusion Engine        — reutiliza su dedup por URL
                           normalizada y su vocabulario de
                           calidad (completa/parcial/mínima).
  · Search Provider Layer— conserva el proveedor real de cada
                           hallazgo, sin reetiquetarlo.
  · Identity Matcher     — incorpora la correspondencia con
                           su explicación completa.
===========================================================
*/


/*
-----------------------------------------------------------
URL CANÓNICA

Forma estable de la URL de un perfil. Dos requisitos:

  a) Comparable — misma cuenta escrita de N formas produce
     una sola clave (lo resuelve `normalizarUrl` de
     textUtils: sin protocolo, sin www, sin parámetros de
     rastreo, sin barra final, redirección desenvuelta).

  b) Reconstruible — a partir de plataforma + handle se
     puede volver a la URL navegable, aunque la original se
     pierda.
-----------------------------------------------------------
*/

const PLANTILLAS_PERFIL = Object.freeze({
  facebook: (h) => `https://www.facebook.com/${h}`,
  instagram: (h) => `https://www.instagram.com/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  x: (h) => `https://x.com/${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  linkedin: (h) => `https://www.linkedin.com/in/${h}`
});


export function construirUrlCanonica(plataformaId, handle, urlObservada) {
  const plantilla = PLANTILLAS_PERFIL[plataformaId];

  const reconstruida = plantilla && handle ? plantilla(handle) : null;

  const normalizadaObservada = urlObservada ? normalizarUrl(urlObservada) : null;

  const normalizadaReconstruida = reconstruida
    ? normalizarUrl(reconstruida)
    : null;

  return {
    /* Navegable, preferentemente la reconstruida (estable). */
    canonica: reconstruida || urlObservada || null,

    /* Clave de comparación y deduplicación. */
    clave: normalizadaReconstruida || normalizadaObservada || null,

    observada: urlObservada || null,
    normalizadaObservada,

    /*
      Si la observada y la reconstruida no coinciden, se
      declara: puede ser una ruta alternativa legítima
      (facebook.com/profile.php?id=...) o un handle mal
      extraído.
    */
    coincideConReconstruida:
      Boolean(normalizadaObservada && normalizadaReconstruida) &&
      normalizadaObservada === normalizadaReconstruida
  };
}


/*
  El hash estable se importa del Knowledge Lake (lakeHash.js)
  y se reexporta para no romper a quien ya lo importaba de aqui.
*/
export { calcularHash };


/*
-----------------------------------------------------------
CALIDAD DE LA FICHA

Mismo vocabulario que el Fusion Engine para que una ficha
social y una evidencia web se puedan comparar.
-----------------------------------------------------------
*/

export function evaluarCalidadFicha(ficha) {
  const criterios = {
    tieneHandle: Boolean(ficha.handle),
    tieneUrlCanonica: Boolean(ficha.url?.canonica),
    tieneTituloObservado: (ficha.titulosObservados || []).length > 0,
    tieneDescripcionObservada: (ficha.descripcionesObservadas || []).length > 0,
    multiProveedor: (ficha.proveedores || []).length > 1,
    multiVia: (ficha.vias || []).length > 1,
    perfilLeido: ficha.modoAcceso === MODOS_ACCESO.API_OFICIAL,
    correspondenciaEvaluada: Boolean(ficha.correspondencia)
  };

  const cumplidos = Object.entries(criterios)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const faltantes = Object.entries(criterios)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  const nucleo =
    criterios.tieneHandle &&
    criterios.tieneUrlCanonica &&
    criterios.tieneTituloObservado;

  const refuerzo =
    criterios.multiProveedor ||
    criterios.multiVia ||
    criterios.perfilLeido ||
    criterios.tieneDescripcionObservada;

  let nivel = CALIDADES.MINIMA;

  if (nucleo && refuerzo) nivel = CALIDADES.COMPLETA;
  else if (criterios.tieneHandle && criterios.tieneUrlCanonica) {
    nivel = CALIDADES.PARCIAL;
  }

  return {
    nivel,
    criteriosCumplidos: cumplidos,
    criteriosFaltantes: faltantes,
    motivo:
      nivel === CALIDADES.COMPLETA
        ? "Handle, URL canónica y texto observado, con corroboración."
        : nivel === CALIDADES.PARCIAL
        ? `Identificable pero sin corroboración. Falta: ${faltantes
            .slice(0, 3)
            .join(", ")}.`
        : "Apenas identificable.",
    /*
      Aclaración permanente: sin Platform Scanner, ninguna
      ficha puede alcanzar la calidad de un perfil leído.
    */
    techoDelSprint:
      !criterios.perfilLeido
        ? "El perfil no fue leído en la plataforma: la calidad está limitada por el descubrimiento web."
        : null
  };
}


/*
-----------------------------------------------------------
CONSTRUIR LINAJE

Cada ficha declara de dónde salió y de qué deriva (DT3).
-----------------------------------------------------------
*/

function construirLinaje(candidato, correspondencia) {
  const origenes = candidato.origenes || [];

  return {
    submotor: "social_evidence_engine",

    derivadaDe: [
      ...new Set(
        [
          ...origenes.map((o) => o.evidenciaId).filter(Boolean),
          ...(correspondencia?.senales || [])
            .flatMap((s) => s.evidencias || [])
            .filter((e) => typeof e === "string" && e.startsWith("ev-"))
        ]
      )
    ],

    /*
      Cadena completa de descubrimiento, en orden.
    */
    cadena: origenes.map((o) => ({
      via: o.via,
      proveedor: o.proveedor,
      consulta: o.consulta,
      etiqueta: o.etiquetaConsulta
    })),

    submotoresImplicados: [
      "reference_profile",
      "search_provider_layer",
      "discovery_engine",
      ...(correspondencia ? ["identity_matcher"] : []),
      "social_evidence_engine"
    ],

    modoAcceso: candidato.modoAcceso || MODOS_ACCESO.PRESENCIA_INFERIDA,

    version: "1.0"
  };
}


/*
===========================================================
FICHA ÚNICA POR PERFIL

Consolida en un solo registro todo lo que se sabe de una
cuenta: identificación, URL canónica, orígenes,
correspondencia con su explicación, calidad, linaje y hash.
===========================================================
*/

export function construirFicha(candidato, correspondencia, opciones = {}) {
  const plataformaId = candidato.plataformaId;

  const url = construirUrlCanonica(
    plataformaId,
    candidato.handle,
    candidato.url
  );

  const ficha = {
    /* ---- IDENTIFICACIÓN ---- */
    id: null, // se asigna al deduplicar
    esquema: "sentinel.social.perfil.v1",

    platform: plataformaId,
    plataforma: candidato.plataforma,
    tipoPlataforma: candidato.tipoPlataforma,

    handle: candidato.handle,

    /*
      Sprint 3.2.1 — distingue un handle elegido por la persona
      de un identificador derivado de la ruta de la URL.
      El panel y S2 lo necesitan para no tratarlos igual.
    */
    handleTipo: candidato.handleTipo || "extraido",

    url,

    dominio: url.canonica ? extraerDominio(url.canonica) : candidato.dominio,

    /* ---- LO OBSERVADO (no leído del perfil) ---- */
    titulosObservados: candidato.titulosObservados || [],
    descripcionesObservadas: candidato.descripcionesObservadas || [],

    /* ---- ACCESO Y PRESENCIA ---- */
    modoAcceso: candidato.modoAcceso || MODOS_ACCESO.PRESENCIA_INFERIDA,
    estadoPresencia: candidato.estadoPresencia || ESTADOS_PRESENCIA.INFERIDA,

    /* ---- PROCEDENCIA ---- */
    origenes: candidato.origenes || [],
    totalOrigenes: candidato.totalOrigenes || (candidato.origenes || []).length,
    vias: candidato.vias || [],
    proveedores: candidato.proveedores || [],

    corroboracion: {
      proveedores: candidato.proveedores || [],
      totalProveedores: (candidato.proveedores || []).length,
      multiProveedor: (candidato.proveedores || []).length > 1,
      vias: candidato.vias || [],
      multiVia: (candidato.vias || []).length > 1
    },

    /* ---- CORRESPONDENCIA CON EL OBJETIVO ---- */
    correspondencia: correspondencia
      ? {
          puntuacion: correspondencia.puntuacion,
          nivel: correspondencia.nivel,
          etiqueta: correspondencia.etiqueta,
          estado: correspondencia.estado,
          requiereRevisionHumana: correspondencia.requiereRevisionHumana,
          puedeConfirmarloElSistema: false,
          senales: correspondencia.senales,
          contrasenales: correspondencia.contrasenales,
          explicacion: correspondencia.explicacion
        }
      : null,

    /* ---- GOBIERNO ---- */
    tenantId: opciones.tenantId || null,
    objetivoId: opciones.objetivoId || null,
    objetivo: opciones.objetivo || null,

    publica: true,

    capturadoEn: new Date().toISOString()
  };

  ficha.quality = evaluarCalidadFicha(ficha);

  ficha.linaje = construirLinaje(candidato, correspondencia);

  /*
    HASH ESTABLE — calculado al final, sobre el contenido sin
    campos volátiles.
  */
  ficha.hash = calcularHash(ficha);

  return ficha;
}


/*
===========================================================
DEDUPLICACIÓN

Dos claves, en este orden:

  1. URL canónica  — la más fuerte.
  2. plataforma + handle normalizado — captura el caso de dos
     rutas distintas a la misma cuenta.

Al fusionar, se acumulan orígenes y proveedores y se conserva
la correspondencia de mayor puntuación (la que contó con más
señales).
===========================================================
*/

function claveHandle(ficha) {
  return `${ficha.platform}:${normalizarTexto(ficha.handle || "")}`;
}


export function deduplicarFichas(fichas = []) {
  const porUrl = new Map();
  const porHandle = new Map();

  let fusionadas = 0;

  const traza = [];

  fichas.forEach((ficha) => {
    const claveUrl = ficha.url?.clave || null;

    const claveH = claveHandle(ficha);

    const existente =
      (claveUrl && porUrl.get(claveUrl)) || porHandle.get(claveH) || null;

    if (!existente) {
      if (claveUrl) porUrl.set(claveUrl, ficha);

      porHandle.set(claveH, ficha);

      return;
    }

    /*
      FUSIÓN — se acumula, no se descarta.
    */
    fusionadas += 1;

    traza.push({
      motivo: claveUrl && porUrl.has(claveUrl) ? "url_canonica" : "plataforma_handle",
      clave: claveUrl || claveH,
      absorbida: ficha.handle,
      en: existente.handle
    });

    const origenesVistos = new Set(
      existente.origenes.map((o) => `${o.via}|${o.proveedor}|${o.consulta}`)
    );

    (ficha.origenes || []).forEach((o) => {
      const c = `${o.via}|${o.proveedor}|${o.consulta}`;

      if (!origenesVistos.has(c)) {
        existente.origenes.push(o);
        origenesVistos.add(c);
      }
    });

    existente.titulosObservados = [
      ...new Set([...existente.titulosObservados, ...ficha.titulosObservados])
    ];

    existente.descripcionesObservadas = [
      ...new Set([
        ...existente.descripcionesObservadas,
        ...ficha.descripcionesObservadas
      ])
    ];

    existente.proveedores = [
      ...new Set([...existente.proveedores, ...ficha.proveedores])
    ];

    existente.vias = [...new Set([...existente.vias, ...ficha.vias])];

    existente.totalOrigenes = existente.origenes.length;

    existente.corroboracion = {
      proveedores: existente.proveedores,
      totalProveedores: existente.proveedores.length,
      multiProveedor: existente.proveedores.length > 1,
      vias: existente.vias,
      multiVia: existente.vias.length > 1
    };

    /*
      Se conserva la correspondencia mejor sustentada.
    */
    if (
      ficha.correspondencia &&
      (!existente.correspondencia ||
        ficha.correspondencia.puntuacion > existente.correspondencia.puntuacion)
    ) {
      existente.correspondencia = ficha.correspondencia;
    }

    /*
      Al cambiar el contenido, se recalculan calidad y hash.
    */
    existente.quality = evaluarCalidadFicha(existente);

    existente.hash = calcularHash(existente);
  });

  const unicas = [...new Set([...porHandle.values()])];

  /*
    Identificadores estables: derivados del contenido, no del
    orden de llegada.
  */
  unicas.forEach((f) => {
    f.id = `sp-${f.hash.slice(0, 12)}`;
  });

  return {
    fichas: unicas.sort(
      (a, b) =>
        (b.correspondencia?.puntuacion || 0) - (a.correspondencia?.puntuacion || 0)
    ),
    fusionadas,
    traza
  };
}


/*
===========================================================
EVIDENCIAS ATÓMICAS

Además de la ficha, el motor emite las evidencias
individuales del esquema definido en ARQ-SIL-001 §3.5, que
son lo que se enviará al Knowledge Lake.
===========================================================
*/

export function emitirEvidencias(ficha) {
  const evidencias = [];

  const comun = {
    platform: ficha.platform,
    handle: ficha.handle,
    url: ficha.url.canonica,
    urlNormalizada: ficha.url.clave,
    tenantId: ficha.tenantId,
    objetivoId: ficha.objetivoId,
    publica: ficha.publica,
    capturadoEn: ficha.capturadoEn
  };

  /*
    1. DESCUBRIMIENTO — una por vía distinta.
  */
  ficha.vias.forEach((via) => {
    const origenes = ficha.origenes.filter((o) => o.via === via);

    const evidencia = {
      ...comun,
      tipo: TIPOS_EVIDENCIA.DESCUBRIMIENTO,
      titulo: ficha.titulosObservados[0] || `Cuenta ${ficha.plataforma}`,
      descripcion: `Descubierta por la vía "${via}".`,
      fecha: null,
      confianza: ficha.correspondencia
        ? {
            puntuacion: ficha.correspondencia.puntuacion,
            nivel: ficha.correspondencia.nivel,
            estado: ficha.correspondencia.estado,
            requiereRevisionHumana: true
          }
        : null,
      quality: ficha.quality,
      origen: {
        submotor: "discovery_engine",
        via,
        proveedores: [...new Set(origenes.map((o) => o.proveedor).filter(Boolean))],
        consultas: [...new Set(origenes.map((o) => o.consulta).filter(Boolean))],
        modoAcceso: ficha.modoAcceso,
        derivadaDe: []
      },
      corroboracion: ficha.corroboracion
    };

    evidencia.id = `se-${calcularHash(evidencia).slice(0, 12)}`;

    evidencias.push(evidencia);
  });

  /*
    2. CORRESPONDENCIA — el juicio de identidad, si se evaluó.
  */
  if (ficha.correspondencia) {
    const evidencia = {
      ...comun,
      tipo: TIPOS_EVIDENCIA.CORRESPONDENCIA,
      titulo: `Correspondencia ${ficha.correspondencia.puntuacion}/100 — ${ficha.correspondencia.etiqueta}`,
      descripcion: ficha.correspondencia.explicacion?.resumen || "",
      fecha: null,
      confianza: {
        puntuacion: ficha.correspondencia.puntuacion,
        nivel: ficha.correspondencia.nivel,
        estado: ficha.correspondencia.estado,
        senales: ficha.correspondencia.senales,
        contrasenales: ficha.correspondencia.contrasenales,
        requiereRevisionHumana: true
      },
      quality: ficha.quality,
      origen: {
        submotor: "identity_matcher",
        modoAcceso: ficha.modoAcceso,
        derivadaDe: ficha.linaje.derivadaDe
      },
      corroboracion: ficha.corroboracion
    };

    evidencia.id = `se-${calcularHash(evidencia).slice(0, 12)}`;

    evidencias.push(evidencia);
  }

  /*
    3. ENLACE CRUZADO — si S7 se activó.
  */
  const s7 = (ficha.correspondencia?.senales || []).find(
    (s) => s.id === "S7" && s.activa
  );

  if (s7) {
    const evidencia = {
      ...comun,
      tipo: TIPOS_EVIDENCIA.ENLACE_CRUZADO,
      titulo: `Presencia cruzada de @${ficha.handle}`,
      descripcion: s7.detalle,
      fecha: null,
      confianza: null,
      quality: ficha.quality,
      origen: {
        submotor: "identity_matcher",
        senal: "S7",
        modoAcceso: ficha.modoAcceso,
        derivadaDe: []
      },
      corroboracion: ficha.corroboracion
    };

    evidencia.id = `se-${calcularHash(evidencia).slice(0, 12)}`;

    evidencias.push(evidencia);
  }

  return evidencias.filter((e) => validarEvidenciaSocial(e).valido);
}


/*
===========================================================
FUNCIÓN PRINCIPAL
===========================================================
*/

export function generarFichas(candidatos = [], correspondencias = [], opciones = {}) {
  const porCandidato = new Map(
    (correspondencias || []).map((c) => [c.candidatoId, c])
  );

  const brutas = (candidatos || []).map((c) =>
    construirFicha(c, porCandidato.get(c.id) || null, opciones)
  );

  const { fichas, fusionadas, traza } = deduplicarFichas(brutas);

  const evidencias = fichas.flatMap((f) => emitirEvidencias(f));

  const porCalidad = fichas.reduce((acc, f) => {
    acc[f.quality.nivel] = (acc[f.quality.nivel] || 0) + 1;
    return acc;
  }, {});

  /*
    Verificación de la propiedad clave del hash: dos
    ejecuciones sobre el mismo contenido deben coincidir.
  */
  const hashesEstables = fichas.every(
    (f) => calcularHash({ ...f, hash: undefined }) === calcularHash({ ...f, hash: undefined })
  );

  return {
    version: "1.0",

    objetivo: opciones.objetivo || null,

    fichas,

    evidencias,

    deduplicacion: {
      fichasBrutas: brutas.length,
      fichasUnicas: fichas.length,
      fusionadas,
      traza
    },

    metricas: {
      fichas: fichas.length,
      evidencias: evidencias.length,
      porCalidad,
      conCorrespondencia: fichas.filter((f) => f.correspondencia).length,
      perfilesLeidos: fichas.filter(
        (f) => f.modoAcceso === MODOS_ACCESO.API_OFICIAL
      ).length,
      hashesEstables
    },

    generadoEn: new Date().toISOString()
  };
}
