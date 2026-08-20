// apps/backend/services/social/identity/contextBoost.js

import { normalizarTexto, extraerDominio } from "../../textUtils.js";

/*
===========================================================
SENTINEL INTELLIGENCE
CONTEXT BOOST (CB-1)
===========================================================

Problema que resuelve, medido en datos reales:

Buscando "Juan Carlos Vega" el buscador devuelve, en las
tres primeras posiciones, a un ARTISTA FOTOGRÁFICO y director
creativo (juancarlosvega.com) con canal en
youtube.com/@juancarlosvega. El objetivo real es Juan Carlos
Vega Malo, exministro de Finanzas y Agricultura y
precandidato a la alcaldía de Cuenca.

El Identity Matcher, por sí solo, PREMIARÍA al artista:
su handle «juancarlosvega» coincide exactamente con una
variante del nombre (S2 = 25/25) y su título contiene el
nombre completo (S1 = 25/25). Sin contexto, la coincidencia
de nombre es indistinguible de la identidad.

CB-1 aporta la dimensión que falta: ¿el contexto de esta
evidencia es COMPATIBLE con el del objetivo?

-----------------------------------------------------------
DECISIÓN DE DISEÑO
-----------------------------------------------------------

Los términos podrían codificarse fijos para este caso
(«Cuenca» suma, «músico» resta) y el caso quedaría resuelto.
Pero el siguiente homónimo sería un empresario, un deportista
o un médico, y el defecto volvería.

Por eso CB-1 tiene tres capas:

  1. PAQUETE DE DOMINIO — léxico configurable por vertical
     (política Ecuador, y los demás cuando existan). Es
     configuración, no lógica: añadir un dominio no toca
     código.

  2. TÉRMINOS DEL PERFIL — los términos discriminantes que el
     Perfil de Referencia ya extrajo de las evidencias del
     objetivo. Son específicos de ESE objetivo y se calculan
     solos.

  3. DOMINIOS AJENOS — léxicos de otras verticales (arte,
     música, deporte...). Su presencia sin ningún término afín
     es la señal más fuerte de que se trata de otra persona.

La capa 1 es la que el sprint pide explícitamente; las capas
2 y 3 son las que hacen que el arreglo generalice.
===========================================================
*/


/*
-----------------------------------------------------------
PAQUETE DE DOMINIO · POLÍTICA ECUADOR

Los seis términos de bonificación solicitados, más los que
las evidencias reales del caso demostraron relevantes.
-----------------------------------------------------------
*/

export const DOMINIO_POLITICA_EC = Object.freeze({
  id: "politica_ec",
  nombre: "Política — Ecuador",

  afines: [
    /* --- solicitados explícitamente --- */
    { termino: "cuenca", peso: 10, tipo: "territorio" },
    { termino: "ecuador", peso: 8, tipo: "pais" },
    { termino: "alcalde", peso: 10, tipo: "cargo" },
    { termino: "elecciones", peso: 8, tipo: "proceso" },
    { termino: "gad", peso: 10, tipo: "institucion" },
    { termino: "candidato", peso: 8, tipo: "rol" },

    /* --- derivados de las evidencias reales del caso --- */
    { termino: "alcaldia", peso: 10, tipo: "cargo" },
    { termino: "precandidato", peso: 9, tipo: "rol" },
    { termino: "prefecto", peso: 9, tipo: "cargo" },
    { termino: "prefectura", peso: 9, tipo: "institucion" },
    { termino: "ministro", peso: 8, tipo: "cargo" },
    { termino: "ministerio", peso: 7, tipo: "institucion" },
    { termino: "asambleista", peso: 8, tipo: "cargo" },
    { termino: "concejal", peso: 8, tipo: "cargo" },
    { termino: "azuay", peso: 9, tipo: "territorio" },
    { termino: "seccionales", peso: 8, tipo: "proceso" },
    { termino: "municipio", peso: 7, tipo: "institucion" },
    { termino: "politico", peso: 6, tipo: "rol" },
    { termino: "politica", peso: 5, tipo: "ambito" },
    { termino: "gobierno", peso: 5, tipo: "institucion" },
    { termino: "cne", peso: 8, tipo: "institucion" },
    { termino: "movimiento", peso: 4, tipo: "organizacion" }
  ],

  /*
    Incompatibles del propio dominio: contextos que, si
    aparecen SIN ningún término afín, indican otra persona.
    Los cuatro solicitados van primero.
  */
  incompatibles: [
    /* --- solicitados explícitamente --- */
    { termino: "ciudad rodrigo", peso: -14, tipo: "territorio_ajeno" },
    { termino: "salamanca", peso: -12, tipo: "territorio_ajeno" },
    { termino: "concierto", peso: -12, tipo: "actividad_ajena" },
    { termino: "musico", peso: -14, tipo: "profesion_ajena" }
  ]
});


/*
-----------------------------------------------------------
DOMINIOS AJENOS

Léxicos de otras verticales. No son «malos»: son señales de
que la evidencia pertenece a otra esfera. Detectar el dominio
ajeno concreto permite explicar POR QUÉ se descarta, en lugar
de decir solo «puntuación baja».
-----------------------------------------------------------
*/

export const DOMINIOS_AJENOS = Object.freeze([
  {
    id: "arte_visual",
    nombre: "Arte visual y fotografía",
    terminos: [
      "fotografo", "fotografico", "photographic", "artista", "artist",
      "director creativo", "creative director", "portfolio", "portafolio",
      "galeria", "exposicion", "escultura", "pintura", "geometria del ser",
      "obra", "muestra"
    ],
    peso: -11
  },
  {
    id: "musica",
    nombre: "Música",
    terminos: [
      "musico", "cantante", "cantautor", "banda", "album", "disco",
      "concierto", "gira", "tour", "sencillo", "single", "guitarrista",
      "compositor", "spotify", "discografia"
    ],
    peso: -12
  },
  {
    id: "deporte",
    nombre: "Deporte",
    terminos: [
      "futbolista", "jugador", "entrenador", "club", "liga", "torneo",
      "partido de futbol", "gol", "atleta", "seleccion nacional"
    ],
    peso: -11
  },
  {
    id: "espectaculo",
    nombre: "Espectáculo",
    terminos: [
      "actor", "actriz", "humorista", "monologuista", "comediante",
      "pelicula", "serie", "telenovela", "reparto"
    ],
    peso: -11
  },
  {
    id: "academia_medicina",
    nombre: "Medicina y academia",
    terminos: [
      "doctor en medicina", "cirujano", "cardiologo", "odontologo",
      "clinica", "hospital", "paciente"
    ],
    peso: -9
  }
]);


export const PAQUETES_DOMINIO = Object.freeze({
  politica_ec: DOMINIO_POLITICA_EC
});


/*
-----------------------------------------------------------
LÍMITES DEL AJUSTE

CB-1 modula, no decide sola. Su aporte está acotado para que
no pueda, por sí misma, convertir un desconocido en probable
ni hundir a un objetivo bien identificado por una palabra
desafortunada.
-----------------------------------------------------------
*/

export const LIMITES = Object.freeze({
  bonificacionMaxima: 25,
  penalizacionMaxima: -35,
  /*
    Umbral de veredicto incompatible: por debajo de este
    ajuste neto, y sin ningún término afín, la evidencia se
    declara de otro contexto.
  */
  umbralIncompatible: -12
});


function contarApariciones(texto, termino) {
  const t = normalizarTexto(termino);

  if (!t) return 0;

  /*
    Frontera de palabra para términos simples; coincidencia
    literal para expresiones de varias palabras.
  */
  const patron = t.includes(" ")
    ? new RegExp(t.replace(/\s+/g, "\\s+"), "g")
    : new RegExp(`\\b${t}\\b`, "g");

  return (texto.match(patron) || []).length;
}


/*
===========================================================
EVALUAR CONTEXTO — CB-1
===========================================================

  texto   → título + descripción + URL de la evidencia
  perfil  → Perfil de Referencia del objetivo
===========================================================
*/

export function evaluarContextBoost(texto, perfil, opciones = {}) {
  const contenido = normalizarTexto(texto);

  const dominio =
    PAQUETES_DOMINIO[opciones.dominio || "politica_ec"] || DOMINIO_POLITICA_EC;

  if (!contenido) {
    return {
      version: "CB-1",
      dominio: dominio.id,
      ajuste: 0,
      bonificaciones: [],
      penalizaciones: [],
      dominiosAjenos: [],
      veredicto: "sin_datos",
      motivo: "no hay texto que evaluar"
    };
  }

  const bonificaciones = [];
  const penalizaciones = [];

  /*
    ---------------------------------------------------------
    CAPA 1 · TÉRMINOS AFINES DEL DOMINIO
    ---------------------------------------------------------
  */
  dominio.afines.forEach((a) => {
    const veces = contarApariciones(contenido, a.termino);

    if (veces > 0) {
      bonificaciones.push({
        termino: a.termino,
        tipo: a.tipo,
        origen: "dominio",
        apariciones: veces,
        puntos: a.peso
      });
    }
  });

  /*
    ---------------------------------------------------------
    CAPA 2 · TÉRMINOS DISCRIMINANTES DEL PERFIL

    Específicos de este objetivo, calculados por el Perfil de
    Referencia. Peso menor que los del dominio porque pueden
    incluir ruido.
    ---------------------------------------------------------
  */
  const yaContados = new Set(bonificaciones.map((b) => normalizarTexto(b.termino)));

  (perfil?.terminosDiscriminantes || []).slice(0, 10).forEach((t) => {
    const termino = normalizarTexto(t.termino);

    if (!termino || yaContados.has(termino)) return;

    if (contarApariciones(contenido, termino) > 0) {
      bonificaciones.push({
        termino: t.termino,
        tipo: "discriminante_del_perfil",
        origen: "perfil",
        apariciones: t.apariciones ?? null,
        puntos: 4
      });

      yaContados.add(termino);
    }
  });

  /*
    ---------------------------------------------------------
    CAPA 1b · INCOMPATIBLES DECLARADOS DEL DOMINIO
    ---------------------------------------------------------
  */
  dominio.incompatibles.forEach((i) => {
    if (contarApariciones(contenido, i.termino) > 0) {
      penalizaciones.push({
        termino: i.termino,
        tipo: i.tipo,
        origen: "dominio_incompatible",
        puntos: i.peso
      });
    }
  });

  /*
    ---------------------------------------------------------
    CAPA 3 · DOMINIOS AJENOS
    ---------------------------------------------------------
  */
  const dominiosAjenos = [];

  DOMINIOS_AJENOS.forEach((d) => {
    const encontrados = d.terminos.filter(
      (t) => contarApariciones(contenido, t) > 0
    );

    if (!encontrados.length) return;

    dominiosAjenos.push({
      dominio: d.id,
      nombre: d.nombre,
      terminos: encontrados,
      puntos: d.peso
    });

    penalizaciones.push({
      termino: encontrados.join(", "),
      tipo: "dominio_ajeno",
      origen: d.id,
      puntos: d.peso
    });
  });

  /*
    ---------------------------------------------------------
    AJUSTE NETO, ACOTADO
    ---------------------------------------------------------
  */
  const sumaBonos = Math.min(
    bonificaciones.reduce((t, b) => t + b.puntos, 0),
    LIMITES.bonificacionMaxima
  );

  const sumaPenas = Math.max(
    penalizaciones.reduce((t, p) => t + p.puntos, 0),
    LIMITES.penalizacionMaxima
  );

  const ajuste = sumaBonos + sumaPenas;

  /*
    ---------------------------------------------------------
    VEREDICTO

    La combinación decisiva no es la puntuación: es la
    presencia de contexto ajeno CON AUSENCIA de contexto afín.
    Un candidato que además es músico tendría ambos; un músico
    homónimo solo tiene el ajeno.
    ---------------------------------------------------------
  */
  let veredicto;
  let motivo;

  if (!bonificaciones.length && penalizaciones.length) {
    veredicto = "incompatible";

    motivo =
      `Ningún término del contexto del objetivo aparece, y sí ` +
      `${penalizaciones.length} de otro contexto` +
      (dominiosAjenos.length
        ? ` (${dominiosAjenos.map((d) => d.nombre).join(", ")})`
        : "") +
      ". Probablemente es otra persona con el mismo nombre.";
  } else if (ajuste <= LIMITES.umbralIncompatible) {
    veredicto = "incompatible";

    motivo =
      `El contexto ajeno pesa más que el afín (ajuste ${ajuste}). ` +
      "La coincidencia de nombre no basta para sostener la identidad.";
  } else if (bonificaciones.length && !penalizaciones.length) {
    veredicto = "compatible";

    motivo = `El contexto coincide con el del objetivo: ${bonificaciones
      .slice(0, 5)
      .map((b) => b.termino)
      .join(", ")}.`;
  } else if (bonificaciones.length && penalizaciones.length) {
    veredicto = ajuste >= 0 ? "compatible_con_ruido" : "dudoso";

    motivo =
      `Coexisten ${bonificaciones.length} término(s) afín(es) y ` +
      `${penalizaciones.length} de otro contexto. Ajuste neto ${ajuste}.`;
  } else {
    veredicto = "neutro";

    motivo =
      "El texto no aporta términos de contexto ni afines ni ajenos: no confirma ni desmiente.";
  }

  return {
    version: "CB-1",
    dominio: dominio.id,

    ajuste,
    sumaBonificaciones: sumaBonos,
    sumaPenalizaciones: sumaPenas,

    bonificaciones: bonificaciones.sort((a, b) => b.puntos - a.puntos),
    penalizaciones: penalizaciones.sort((a, b) => a.puntos - b.puntos),
    dominiosAjenos,

    veredicto,
    motivo,

    /*
      Explicación lista para el panel: reproducible a mano.
    */
    explicacion: {
      resumen: `CB-1 ${ajuste >= 0 ? "+" : ""}${ajuste} — ${veredicto}. ${motivo}`,
      pasos: [
        ...bonificaciones.map((b) => ({
          concepto: `afín: ${b.termino}`,
          origen: b.origen,
          operacion: `+${b.puntos}`
        })),
        ...penalizaciones.map((p) => ({
          concepto: `ajeno: ${p.termino}`,
          origen: p.origen,
          operacion: `${p.puntos}`
        })),
        {
          concepto: "Ajuste neto (acotado)",
          origen: "CB-1",
          operacion: `${ajuste >= 0 ? "+" : ""}${ajuste}`
        }
      ],
      limites: LIMITES
    }
  };
}


/*
===========================================================
EVALUAR UN CANDIDATO COMPLETO

Reúne todo el texto observado de una cuenta candidata: los
títulos y descripciones que el descubrimiento recogió, más su
URL (que a veces es la única señal de contexto: un dominio
personal de portafolio, por ejemplo).
===========================================================
*/

export function contextBoostDeCandidato(candidato, perfil, opciones = {}) {
  const partes = [
    ...(candidato.titulosObservados || []),
    ...(candidato.descripcionesObservadas || []),
    candidato.url || "",
    ...(candidato.origenes || []).map((o) => o.consulta || "")
  ];

  /*
    ---------------------------------------------------------
    PROPAGACIÓN DE CONTEXTO POR HANDLE Y DOMINIO
    ---------------------------------------------------------

    Defecto detectado al probar el caso real:

    El canal youtube.com/@juancarlosvega del artista traía como
    descripción el texto genérico de YouTube («Share your videos
    with friends, family, and the world»). Evaluado solo con SU
    texto, CB-1 devolvía «neutro» y el homónimo no se degradaba.

    El contexto de artista estaba en OTRA evidencia:
    juancarlosvega.com — «photographic artist and Creative
    Director». Son la misma presencia (el dominio y el handle
    coinciden), pero CB-1 no las relacionaba.

    Se recoge por tanto el texto de las evidencias cuya URL
    contiene el handle del candidato. Es una relación
    verificable, no una inferencia: la coincidencia es literal.
  */
  const handle = normalizarTexto(candidato.handle || "").replace(
    /[^a-z0-9]/g,
    ""
  );

  const relacionadas = [];

  if (handle.length >= 6) {
    const dominioPropio = extraerDominio(candidato.url || "");

    (opciones.evidencias || []).forEach((ev) => {
      const bruta = ev.url || ev.enlace || ev.urlNormalizada || "";

      /*
        LA COINCIDENCIA DEBE SER EN EL DOMINIO, NO EN LA RUTA.

        Defecto detectado en la primera versión de este bloque:
        se comparaba el handle contra la URL completa sin signos,
        así que el slug de una noticia
        «/juan-carlos-vega-precandidato-alcaldia-cuenca/» coincidía
        con el handle «juancarlosvega». Resultado: el canal del
        ARTISTA absorbió el contexto del CANDIDATO y subió al
        primer puesto — lo contrario de lo buscado.

        Un handle en el DOMINIO indica propiedad
        (juancarlosvega.com es del artista). Un handle en la RUTA
        indica que alguien ESCRIBE sobre una persona, que no dice
        nada sobre quién es el dueño de la cuenta.
      */
      const dominio = extraerDominio(bruta);

      if (!dominio) return;

      /* No se cuenta la evidencia del propio candidato. */
      if (dominioPropio && dominio === dominioPropio) return;

      const dominioSinSignos = normalizarTexto(dominio).replace(
        /[^a-z0-9]/g,
        ""
      );

      if (!dominioSinSignos.includes(handle)) return;

      const texto = [ev.titulo, ev.descripcion].filter(Boolean).join(" ");

      if (texto) {
        relacionadas.push(bruta);

        partes.push(texto);
      }
    });
  }

  const resultado = evaluarContextBoost(partes.join(" \n "), perfil, opciones);

  resultado.evidenciasRelacionadas = relacionadas;

  if (relacionadas.length) {
    resultado.motivo += ` Se incluyó el contexto de ${relacionadas.length} evidencia(s) cuya URL contiene el handle "${candidato.handle}".`;
  }

  return resultado;
}
