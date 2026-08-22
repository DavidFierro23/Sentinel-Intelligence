// apps/backend/services/social/executive/executiveProfile.js

import { CLASES } from "../classification/accountClassifier.js";

/*
===========================================================
SENTINEL INTELLIGENCE
PERFIL EJECUTIVO — ARQ-PUI-001, Bloques E y F
===========================================================

Bloque E pide seguidores vivos, bio viva, cargo, país y última
actividad. Bloque F pide tarjetas ejecutivas, resumen
ejecutivo e Índice de Huella Digital.

QUÉ SE PUEDE ENTREGAR Y QUÉ NO
-----------------------------------------------------------

Medido sobre la respuesta real de una investigación completa
de Daniel Noboa —75 evidencias sociales, 30 web—:

  seguidores  0 apariciones
  followers   0 apariciones
  suscriptores 0 apariciones
  bio         0 apariciones

Las 64 apariciones de la palabra «seguidores» en la respuesta
son las declaraciones de `perfil.noDisponible.campos` que el
propio sistema emite para decir que NO los tiene.

Seguidores y biografía viven DENTRO del perfil, y leer el
perfil exige la API de la plataforma:

  Facebook Graph   app revisada
  X                plan de pago
  Instagram        solo cuentas propias autorizadas
  LinkedIn         prohíbe el raspado
  TikTok           app aprobada

Ese acceso está congelado por decisión del Founder y cerrado
de hecho. Los snippets de Google tampoco los traen en este
corpus.

Así que este módulo entrega lo que SÍ existe con evidencia:

  cargo               del Perfil de Referencia (contexto.rol)
  país                del Perfil de Referencia (contexto.pais)
  última evidencia    fecha que Google devuelve, cuando la trae
  huella digital      medida sobre presencia corroborada

Y DECLARA lo que no, con su motivo. Un dashboard que muestra
un hueco explicado es utilizable; uno que muestra un número
inventado, no.

«Última actividad» merece una nota aparte: lo que se conoce es
la fecha de la evidencia más reciente que Google indexó, NO la
fecha del último mensaje de la cuenta. Se etiqueta como lo que
es. Confundirlas haría que un analista dedujera silencio de una
cuenta activa.
===========================================================
*/


/*
-----------------------------------------------------------
CAMPOS DE PERFIL QUE EXIGEN LEER LA PLATAFORMA
-----------------------------------------------------------
*/

export const CAMPOS_NO_LEIBLES = Object.freeze([
  {
    campo: "seguidores",
    motivo:
      "El número de seguidores vive dentro del perfil. Leerlo exige la API de la plataforma, hoy congelada y cerrada de hecho."
  },
  {
    campo: "biografia",
    motivo:
      "La biografía vive dentro del perfil. Sin API no se puede leer, y transcribir un snippet como si fuera la bio sería atribuirle al titular un texto que no escribió."
  },
  {
    campo: "verificacion",
    motivo: "El distintivo de verificación solo es legible en la plataforma."
  },
  {
    campo: "publicaciones",
    motivo: "El recuento de publicaciones solo es legible en la plataforma."
  }
]);


function fechaMasReciente(fechas) {
  const validas = (fechas || [])
    .map((f) => {
      if (!f) return null;

      const d = new Date(f);

      return Number.isNaN(d.getTime()) ? null : d;
    })
    .filter(Boolean);

  if (!validas.length) return null;

  return validas.sort((a, b) => b - a)[0].toISOString();
}


/*
===========================================================
BLOQUE E · ENRIQUECER UNA CUENTA
===========================================================
*/

export function enriquecerCuenta(cuenta, perfil, evidencias = []) {
  /*
    Evidencias que mencionan esta cuenta: su URL normalizada o
    su handle. Es de donde sale la fecha.
  */
  const clave = String(cuenta?.urlNormalizada || "").toLowerCase();

  const handle = String(cuenta?.handle || "").toLowerCase();

  const propias = (evidencias || []).filter((e) => {
    const u = String(e?.urlNormalizada || e?.url || "").toLowerCase();

    return (clave && u.includes(clave)) || (handle && u.includes(handle));
  });

  const ultimaEvidencia = fechaMasReciente(propias.map((e) => e.fecha));

  return {
    ...cuenta,

    enriquecimiento: {
      version: "1.0",

      /*
        CARGO Y PAÍS — del Perfil de Referencia, que los deriva
        de evidencias reales. No se inventan por plataforma.
      */
      cargo: perfil?.contexto?.rol || null,
      cargoFuente: perfil?.contexto?.rol
        ? "Perfil de Referencia (derivado de evidencias)"
        : null,
      cargoEstado: perfil?.contexto?.rol ? "conocido" : "no_comprobado",

      pais: perfil?.contexto?.pais || null,
      paisFuente: perfil?.contexto?.pais
        ? "Perfil de Referencia (derivado de evidencias)"
        : null,
      paisEstado: perfil?.contexto?.pais ? "conocido" : "no_comprobado",

      /*
        ÚLTIMA EVIDENCIA FECHADA — no es la última actividad de
        la cuenta. Ver la nota de la cabecera.
      */
      ultimaEvidenciaFechada: ultimaEvidencia,
      evidenciasFechadas: propias.filter((e) => e.fecha).length,
      ultimaActividadEstado: ultimaEvidencia
        ? "aproximada_por_evidencia"
        : "no_comprobada",
      ultimaActividadAdvertencia:
        "Es la fecha de la evidencia más reciente que el buscador indexó, no la del último mensaje de la cuenta. Deducir silencio de este dato sería un error.",

      /*
        LO QUE NO SE PUEDE LEER, DECLARADO CAMPO A CAMPO.
      */
      noLeible: CAMPOS_NO_LEIBLES,

      requiereApiDePlataforma: CAMPOS_NO_LEIBLES.map((c) => c.campo)
    }
  };
}


/*
===========================================================
BLOQUE F · ÍNDICE DE HUELLA DIGITAL

Mide la AMPLITUD Y SOLIDEZ de la presencia pública
documentada del objetivo. No mide identidad ni influencia.

Se construye con lo que hay evidencia de:

  · cobertura     en cuántas de las 6 plataformas obligatorias
                  hay una cuenta atribuible
  · solidez       correspondencia de esas cuentas
  · corroboracion cuántas están sostenidas por más de una
                  fuente independiente
  · declaracion   cuántas las declara una base de referencia

Se declara explícitamente lo que NO entra: sin API de
plataforma no hay seguidores ni actividad, así que el índice
NO es una medida de audiencia. Presentarlo como tal sería
engañoso.
===========================================================
*/

const PLATAFORMAS_OBLIGATORIAS = 6;

export function indiceHuellaDigital(cuentasObjetivo, cobertura) {
  const cuentas = cuentasObjetivo || [];

  const plataformasConCuenta = new Set(
    cuentas.map((c) => c.plataformaId || c.platform).filter(Boolean)
  );

  const componentes = [];

  /*
    1 · COBERTURA — hasta 40 puntos.
  */
  const cobertura40 = Math.round(
    (plataformasConCuenta.size / PLATAFORMAS_OBLIGATORIAS) * 40
  );

  componentes.push({
    id: "cobertura",
    nombre: "Cobertura de plataformas",
    valor: cobertura40,
    maximo: 40,
    detalle: `${plataformasConCuenta.size} de ${PLATAFORMAS_OBLIGATORIAS} plataformas obligatorias con cuenta atribuible.`
  });

  /*
    2 · SOLIDEZ — hasta 30 puntos, según la mejor
    correspondencia alcanzada.
  */
  const mejor = cuentas.reduce((m, c) => {
    const p = c.correspondencia?.puntuacion ?? c.correspondencia ?? 0;

    return Math.max(m, Number(p) || 0);
  }, 0);

  const solidez30 = Math.round((mejor / 100) * 30);

  componentes.push({
    id: "solidez",
    nombre: "Solidez de la mejor correspondencia",
    valor: solidez30,
    maximo: 30,
    detalle: mejor
      ? `La cuenta mejor sostenida alcanza ${mejor}/100.`
      : "Ninguna cuenta alcanzó correspondencia medible."
  });

  /*
    3 · CORROBORACIÓN — hasta 20 puntos.
  */
  const corroboradas = cuentas.filter(
    (c) => (c.corroboracion?.totalProveedores || 0) > 1
  ).length;

  const corroboracion20 = cuentas.length
    ? Math.round((corroboradas / cuentas.length) * 20)
    : 0;

  componentes.push({
    id: "corroboracion",
    nombre: "Corroboración multiproveedor",
    valor: corroboracion20,
    maximo: 20,
    detalle: `${corroboradas} de ${cuentas.length} cuentas sostenidas por más de una fuente independiente.`
  });

  /*
    4 · DECLARACIÓN EN BASE DE REFERENCIA — hasta 10 puntos.
  */
  const declaradas = cuentas.filter((c) =>
    (c.corroboracion?.vias || c.vias || []).includes("plataforma_declarada")
  ).length;

  const declaracion10 = cuentas.length
    ? Math.round((declaradas / cuentas.length) * 10)
    : 0;

  componentes.push({
    id: "declaracion",
    nombre: "Declaración en base de referencia",
    valor: declaracion10,
    maximo: 10,
    detalle: `${declaradas} cuenta(s) declarada(s) oficialmente en una base de conocimiento.`
  });

  const total = componentes.reduce((s, c) => s + c.valor, 0);

  const nivel =
    total >= 75
      ? "Huella amplia"
      : total >= 50
        ? "Huella moderada"
        : total >= 25
          ? "Huella limitada"
          : "Huella mínima";

  const noComprobadas = (cobertura || []).filter(
    (c) => c.estadoPresencia === "no_comprobada"
  ).length;

  return {
    version: "1.0",

    valor: total,
    maximo: 100,
    nivel,

    componentes,

    explicacion:
      `${total}/100 — ${nivel}. ` +
      componentes
        .filter((c) => c.valor > 0)
        .map((c) => `${c.nombre} ${c.valor}/${c.maximo}`)
        .join(" · "),

    /*
      IA1 — qué NO mide, dicho antes de que nadie lo suponga.
    */
    limites: {
      noEsAudiencia:
        "No mide seguidores ni influencia: sin API de plataforma esos datos no son legibles.",
      noEsIdentidad:
        "No confirma que las cuentas sean del objetivo. El techo sigue siendo «probable» (IA2).",
      cobertura: noComprobadas
        ? `${noComprobadas} plataforma(s) quedaron NO COMPROBADAS: el índice puede subir si se comprueban, nunca bajar por ellas.`
        : "Las seis plataformas obligatorias fueron consultadas."
    }
  };
}


/*
===========================================================
BLOQUE F · TARJETAS EJECUTIVAS Y RESUMEN
===========================================================
*/

export function construirPerfilEjecutivo(entrada) {
  const {
    perfil,
    clasificacion,
    cobertura = [],
    evidencias = [],
    origenDescubrimiento = null
  } = entrada || {};

  const cuentasObjetivo = (clasificacion?.cuentasObjetivo || []).map((c) =>
    enriquecerCuenta(c, perfil, evidencias)
  );

  /*
    Orden ejecutivo: primero lo mejor sostenido.
  */
  cuentasObjetivo.sort(
    (a, b) =>
      (b.correspondencia?.puntuacion || 0) - (a.correspondencia?.puntuacion || 0)
  );

  const indice = indiceHuellaDigital(cuentasObjetivo, cobertura);

  const plataformas = [...new Set(cuentasObjetivo.map((c) => c.plataforma))];

  const noComprobadas = cobertura.filter(
    (c) => c.estadoPresencia === "no_comprobada"
  );

  /*
    ---------------------------------------------------------
    RESUMEN EJECUTIVO

    Redactado a partir de los datos, sin adjetivos que el dato
    no sostenga, y declarando el limite en la misma frase en
    que se da la cifra.
    ---------------------------------------------------------
  */
  const frases = [];

  if (cuentasObjetivo.length) {
    frases.push(
      `Se atribuyen ${cuentasObjetivo.length} cuenta(s) al objetivo en ${plataformas.length} plataforma(s): ${plataformas.join(", ")}.`
    );

    const mejor = cuentasObjetivo[0];

    frases.push(
      `La mejor sostenida es @${mejor.handle} en ${mejor.plataforma}, con ${mejor.correspondencia?.puntuacion ?? "—"}/100 (${mejor.correspondencia?.etiqueta || "sin nivel"}). Ninguna está confirmada: confirmar es competencia del analista.`
    );
  } else {
    frases.push(
      "No se atribuyó ninguna cuenta al objetivo. No equivale a ausencia de cuentas: significa que ninguna de las descubiertas lleva su nombre."
    );
  }

  const m = clasificacion?.metricas;

  if (m && (m.medios || m.instituciones || m.indeterminadas)) {
    frases.push(
      `Se separaron ${m.medios} medio(s), ${m.instituciones} cuenta(s) institucional(es) y ${m.indeterminadas} indeterminada(s), que no se mezclan con las cuentas del objetivo.`
    );
  }

  if (perfil?.contexto?.rol || perfil?.contexto?.pais) {
    frases.push(
      `Contexto documentado: ${[perfil?.contexto?.rol, perfil?.contexto?.pais].filter(Boolean).join(", ")}.`
    );
  }

  if (noComprobadas.length) {
    frases.push(
      `${noComprobadas.length} plataforma(s) quedaron NO COMPROBADAS (${noComprobadas
        .map((c) => c.plataforma)
        .join(", ")}): no se puede afirmar que el objetivo no esté en ellas.`
    );
  }

  frases.push(
    "Seguidores, biografía y actividad real no se leyeron: requieren la API de cada plataforma."
  );

  return {
    version: "1.0",

    objetivo: perfil?.nombrePrincipal || null,

    origenDescubrimiento,

    /* Bloque F — tarjetas. */
    tarjetas: cuentasObjetivo.map((c) => ({
      plataforma: c.plataforma,
      plataformaId: c.plataformaId || c.platform,
      handle: c.handle,
      url: c.url?.canonica || c.url || null,

      correspondencia: c.correspondencia?.puntuacion ?? null,
      nivel: c.correspondencia?.nivel || null,
      etiqueta: c.correspondencia?.etiqueta || null,
      estado: c.correspondencia?.estado || null,

      clase: c.clasificacion?.clase || null,
      motivoClase: (c.clasificacion?.razones || [])[0] || null,

      cargo: c.enriquecimiento?.cargo || null,
      pais: c.enriquecimiento?.pais || null,
      ultimaEvidenciaFechada: c.enriquecimiento?.ultimaEvidenciaFechada || null,

      seguidores: null,
      biografia: null,
      camposNoLeidos: c.enriquecimiento?.requiereApiDePlataforma || [],

      proveedores: c.corroboracion?.proveedores || [],
      requiereRevisionHumana: true
    })),

    /* Colecciones separadas — Bloque C. */
    medios: (clasificacion?.medios || []).map((c) => ({
      plataforma: c.plataforma,
      handle: c.handle,
      url: c.url?.canonica || c.url || null,
      motivo: (c.clasificacion?.razones || [])[0] || null
    })),

    instituciones: (clasificacion?.instituciones || []).map((c) => ({
      plataforma: c.plataforma,
      handle: c.handle,
      url: c.url?.canonica || c.url || null,
      motivo: (c.clasificacion?.razones || [])[0] || null
    })),

    indeterminadas: (clasificacion?.indeterminadas || []).map((c) => ({
      plataforma: c.plataforma,
      handle: c.handle,
      url: c.url?.canonica || c.url || null,
      motivo: (c.clasificacion?.razones || [])[0] || null
    })),

    huellaDigital: indice,

    resumenEjecutivo: frases,

    metricas: {
      cuentasDelObjetivo: cuentasObjetivo.length,
      plataformasConCuenta: plataformas.length,
      plataformasObligatorias: PLATAFORMAS_OBLIGATORIAS,
      medios: clasificacion?.metricas?.medios || 0,
      instituciones: clasificacion?.metricas?.instituciones || 0,
      indeterminadas: clasificacion?.metricas?.indeterminadas || 0,
      plataformasNoComprobadas: noComprobadas.length
    },

    generadoEn: new Date().toISOString()
  };
}


export default {
  CLASES,
  CAMPOS_NO_LEIBLES,
  enriquecerCuenta,
  indiceHuellaDigital,
  construirPerfilEjecutivo
};
