// apps/backend/services/identity/plausibleIdentities.js

import { normalizarTexto, extraerDominio } from "../textUtils.js";

/*
===========================================================
IDENTIDADES PLAUSIBLES — ARQ-INV-003, modo individual
===========================================================

En modo individual no hay contexto del analista que acote la
búsqueda, así que un nombre compartido devuelve evidencia de
varias personas mezclada. Este módulo la SEPARA sin decidir
cuál es «la buena».

EL CASO QUE LO MOTIVA
-----------------------------------------------------------

Investigando «Pedro Palacios» sin proyecto, la evidencia trae al
alcalde de Cuenca y a un ciclista de Albacete. El sistema
derivaba de esa mezcla un solo perfil, con rol «juez» y términos
«btt, albacete, gemma». Un perfil que no describe a nadie.

CÓMO SE SEPARA, SIN INVENTAR
-----------------------------------------------------------

Dos señales, las dos evidencia dura:

  1. EL PAÍS DEL DOMINIO. `primicias.ec` es Ecuador y
     `latribunadealbacete.es` es España. No es una inferencia
     sobre el texto: es el registro del dominio.

  2. TÉRMINOS QUE COOCURREN. Las evidencias que comparten
     términos distintivos hablan probablemente de la misma
     persona. Se agrupan por componentes conexas.

La etiqueta de cada grupo se compone con lo que la evidencia
dice, no con lo que suponemos: el país del dominio y sus
términos más distintivos.

LO QUE NO HACE
-----------------------------------------------------------

No elige una identidad. No fusiona grupos «parecidos». No
declara que dos grupos sean la misma persona. Y si solo hay un
grupo, no inventa un segundo para parecer sofisticado: devuelve
uno y lo dice.

La decisión es del analista, que para eso puede pedir
«Investigar esta identidad» y quedarse solo con esa evidencia.
===========================================================
*/


/*
-----------------------------------------------------------
PAÍS POR DOMINIO DE PRIMER NIVEL

Solo los que aparecen en el corpus del proyecto. Un TLD que no
está aquí no se traduce: se declara desconocido antes que
adivinar.
-----------------------------------------------------------
*/

const PAIS_POR_TLD = Object.freeze({
  ec: "Ecuador",
  es: "España",
  pe: "Perú",
  co: "Colombia",
  mx: "México",
  ar: "Argentina",
  cl: "Chile",
  bo: "Bolivia",
  ve: "Venezuela",
  uy: "Uruguay",
  py: "Paraguay",
  br: "Brasil",
  us: "Estados Unidos",
  gb: "Reino Unido",
  fr: "Francia",
  it: "Italia",
  de: "Alemania"
});

const VACIAS = new Set(
  ("de la el los las un una y o en con por para del al que se su sus es son " +
    "sobre entre como mas este esta estos estas fue ser tras ante desde " +
    "hasta cuando donde quien cual todo toda todos todas otro otra hay han " +
    "hace tiene via nueva nuevo tras anos años dice dijo sera seria mismo " +
    "tambien solo aun asi pero porque cada ha he").split(" ")
);


function paisDelDominio(url) {
  const d = extraerDominio(url) || "";

  const partes = d.split(".");

  const tld = partes[partes.length - 1];

  if (PAIS_POR_TLD[tld]) {
    return { pais: PAIS_POR_TLD[tld], senal: `dominio .${tld}`, tld };
  }

  /* Dominios de segundo nivel tipo .com.ec */
  const penultimo = partes[partes.length - 2];

  if (penultimo && PAIS_POR_TLD[penultimo]) {
    return {
      pais: PAIS_POR_TLD[penultimo],
      senal: `dominio .${penultimo}.${tld}`,
      tld: penultimo
    };
  }

  return { pais: null, senal: `dominio ${d} sin país declarado`, tld: null };
}


function terminosDe(evidencia, nombreObjetivo) {
  const tokensNombre = new Set(normalizarTexto(nombreObjetivo || "").split(/\s+/));

  const texto = normalizarTexto(
    `${evidencia.titulo || ""} ${evidencia.descripcion || evidencia.snippet || ""}`
  );

  return new Set(
    texto
      .split(/[^a-z0-9]+/)
      .filter(
        (t) =>
          t.length >= 5 && !VACIAS.has(t) && !tokensNombre.has(t)
      )
      .slice(0, 24)
  );
}


/*
===========================================================
AGRUPAR

Componentes conexas sobre "comparten pais del dominio" o
"comparten al menos dos terminos distintivos".
===========================================================
*/

export function detectarIdentidadesPlausibles(evidencias, nombreObjetivo) {
  const utiles = (evidencias || [])
    .filter((e) => e && (e.url || e.enlace))
    .map((e, i) => {
      const url = e.url || e.enlace;

      return {
        indice: i,
        url,
        titulo: e.titulo || "",
        fecha: e.fecha || null,
        dominio: extraerDominio(url),
        pais: paisDelDominio(url),
        terminos: terminosDe(e, nombreObjetivo)
      };
    });

  if (utiles.length < 3) {
    return {
      version: "1.0",
      identidades: [],
      suficienteEvidencia: false,
      motivo:
        "Menos de tres evidencias utilizables: no hay base para separar identidades sin inventarlas.",
      evidenciasEvaluadas: utiles.length
    };
  }

  /*
    ---------------------------------------------------------
    SEMILLAS POR EVIDENCIA TERRITORIAL DURA
    ---------------------------------------------------------

    La primera version agrupaba por similitud de terminos con
    union-busqueda, y fallo de forma instructiva: en el corpus
    real de "Pedro Palacios", 13 de 38 evidencias vienen de
    news.google.com y 10 de facebook.com, dominios sin pais. Sin
    senal territorial, terminos genericos como "provincial" o
    "circuito" tendieron un puente entre el alcalde de Cuenca y un
    ciclista de Albacete, y todo acabo en un solo grupo con
    "yeste" —un pueblo de Albacete— junto a "alcalde".

    Asi que el orden se invierte: primero se forman SEMILLAS con
    las evidencias cuyo dominio declara pais, que es evidencia
    dura; despues se atraen las neutras por similitud, y solo si
    la similitud es CLARA. Lo ambiguo se queda fuera.

    Es mas conservador y da menos grupos, que es el lado correcto
    del error: perder una atribucion se ve, inventarla no.
  */
  const semillas = new Map();

  utiles.forEach((e) => {
    if (!e.pais.pais) return;

    if (!semillas.has(e.pais.pais)) semillas.set(e.pais.pais, []);

    semillas.get(e.pais.pais).push(e);
  });

  /*
    Un solo dominio de un pais no basta para abrir una identidad:
    seria una identidad sostenida por una evidencia.
  */
  const MINIMO_SEMILLA = 2;

  const grupos = [...semillas.entries()]
    .filter(([, ev]) => ev.length >= MINIMO_SEMILLA)
    .map(([pais, ev]) => ({ pais, evidencias: [...ev] }));

  if (!grupos.length) {
    return {
      version: "1.0",
      identidades: [],
      variasIdentidades: false,
      suficienteEvidencia: false,
      evidenciasEvaluadas: utiles.length,
      evidenciasSueltas: utiles.length,
      motivo:
        "Ninguna evidencia declara país en su dominio con apoyo suficiente. Sin señal territorial dura no se separan identidades: hacerlo por similitud de texto ya produjo un grupo contaminado.",
      diagnostico:
        "No se puede separar identidades con esta evidencia. Se muestra la investigación sin separar, declarándolo.",
      limites: {
        senalesUsadas: "País del dominio de cada evidencia.",
        noElige: "El sistema no declara cuál identidad es el objetivo."
      }
    };
  }

  /* Perfil de terminos de cada semilla. */
  const perfil = grupos.map((g) => {
    const cuenta = new Map();

    g.evidencias.forEach((e) =>
      e.terminos.forEach((t) => cuenta.set(t, (cuenta.get(t) || 0) + 1))
    );

    return cuenta;
  });

  const sinAsignar = [];

  utiles.forEach((e) => {
    if (e.pais.pais && grupos.some((g) => g.pais === e.pais.pais)) return;

    /* Solapamiento con cada semilla. */
    const puntos = perfil.map((cuenta) => {
      let n = 0;

      e.terminos.forEach((t) => {
        if (cuenta.has(t)) n += cuenta.get(t);
      });

      return n;
    });

    const mejor = Math.max(...puntos);

    const segundo = puntos.length > 1
      ? [...puntos].sort((a, b) => b - a)[1]
      : 0;

    /*
      SIMILITUD CLARA O NADA. Se exige solapamiento minimo y una
      ventaja sobre la segunda opcion: si dos identidades la
      reclaman por igual, la evidencia es ambigua y se queda
      fuera. "Contexto ambiguo" es una salida legitima.
    */
    if (mejor >= 3 && mejor > segundo * 1.5) {
      grupos[puntos.indexOf(mejor)].evidencias.push(e);
    } else {
      sinAsignar.push(e);
    }
  });

  const significativos = grupos
    .map((g) => g.evidencias)
    .filter((g) => g.length >= MINIMO_SEMILLA);

  const sueltas = sinAsignar.length;

  const identidades = significativos
    .map((grupo, n) => {
      const paises = {};

      grupo.forEach((e) => {
        if (e.pais.pais) paises[e.pais.pais] = (paises[e.pais.pais] || 0) + 1;
      });

      const paisDominante =
        Object.entries(paises).sort((a, b) => b[1] - a[1])[0] || null;

      /* Términos más repetidos del grupo. */
      const cuenta = new Map();

      grupo.forEach((e) =>
        e.terminos.forEach((t) => cuenta.set(t, (cuenta.get(t) || 0) + 1))
      );

      const distintivos = [...cuenta.entries()]
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([t]) => t);

      const fechas = grupo.map((e) => e.fecha).filter(Boolean).sort();

      /*
        CONFIANZA = cuota de evidencia del grupo, moderada por si
        su territorio está declarado. NO es confianza de identidad:
        es cuánto de la evidencia sostiene este grupo.
      */
      const cuota = grupo.length / utiles.length;

      const confianza = Math.min(
        90,
        Math.round(cuota * 70) + (paisDominante ? 20 : 0)
      );

      return {
        id: `identidad-${n + 1}`,
        nombre: nombreObjetivo,

        territorio: paisDominante ? paisDominante[0] : null,
        territorioEstado: paisDominante ? "declarado_por_dominio" : "no_comprobado",
        senalTerritorial: paisDominante
          ? `${paisDominante[1]} de ${grupo.length} evidencias en dominios de ${paisDominante[0]}`
          : "ninguna evidencia declara país en su dominio",

        terminosDistintivos: distintivos,

        evidencias: grupo.length,

        confianza,
        confianzaSignifica:
          "Cuota de la evidencia que sostiene este grupo. No es confianza de identidad: el sistema no elige cuál de los grupos es el objetivo.",

        dominios: [...new Set(grupo.map((e) => e.dominio))].slice(0, 6),

        primeraFecha: fechas[0] || null,
        ultimaFecha: fechas[fechas.length - 1] || null,

        /* Para "Investigar esta identidad". */
        urls: grupo.map((e) => e.url),

        titulares: grupo.slice(0, 4).map((e) => e.titulo).filter(Boolean)
      };
    })
    .sort((a, b) => b.evidencias - a.evidencias);

  return {
    version: "1.0",

    identidades,

    /*
      Varias identidades solo se declaran cuando de verdad hay
      varias. Con una, se dice que hay una.
    */
    variasIdentidades: identidades.length > 1,

    suficienteEvidencia: true,

    evidenciasEvaluadas: utiles.length,

    evidenciasSueltas: sueltas,

    diagnostico:
      identidades.length > 1
        ? `Se detectaron ${identidades.length} identidades plausibles. Sus evidencias NO se han mezclado y el sistema no ha elegido ninguna: esa decisión es del analista.`
        : identidades.length === 1
          ? "Toda la evidencia agrupable apunta a una sola identidad plausible."
          : "La evidencia no forma ningún grupo consistente: no se puede separar identidades sin inventarlas.",

    limites: {
      senalesUsadas:
        "País del dominio de cada evidencia y coocurrencia de términos distintivos. Ambas son evidencia, no inferencia sobre la persona.",
      noElige:
        "El sistema no declara cuál identidad es el objetivo, y no fusiona grupos parecidos.",
      sueltas: sueltas
        ? `${sueltas} evidencia(s) no se agruparon con ninguna otra y quedan fuera: una sola evidencia no sostiene una identidad.`
        : null
    }
  };
}


export default { detectarIdentidadesPlausibles };
