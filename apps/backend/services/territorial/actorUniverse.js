// apps/backend/services/territorial/actorUniverse.js

import { identificarFuente, TIPOS_FUENTE } from "../conversation/mediaRegistry.js";

/*
===========================================================
UNIVERSO DE ACTORES — TERRITORIAL-SOURCE-COVERAGE-01
===========================================================

Quien aparece publicando en el territorio, derivado del corpus
YA observado.

QUE LO SEPARA DE LO QUE YA HABIA
-----------------------------------------------------------

  conversation/mediaRegistry     catalogo semilla: «¿que es
                                 elmercurio.com.ec?»

  territorial/verifiedSource…    fuentes COMPROBADAS: «¿tiene
                                 feed y responde?»

  este modulo                    ACTORES observados: «¿quien ha
                                 publicado de verdad, cuantas
                                 veces, desde cuando?»

Un actor no es una fuente configurada: es alguien de quien hay
evidencia. Por eso este universo se deriva del corpus y no de
una lista.

APARECER NO ES ESTAR VERIFICADO
-----------------------------------------------------------

La regla la fijo `conversation/sourceUniverse.js` y aqui se
mantiene: descubrir no es verificar. Un actor que aparece una
vez entra como DESCUBIERTO. Solo el catalogo o un analista lo
mueven mas arriba.

Si el descubrimiento se autoverificase, el registro seria un
espejo de la recoleccion en lugar de una fuente de verdad.

LO QUE NO SE INFIERE, NUNCA
-----------------------------------------------------------

Ningun atributo sensible. Ni afiliacion politica, ni ideologia,
ni nada sobre personas individuales mas alla de que un medio
publico una pieza firmada. No se construyen perfiles.
===========================================================
*/


export const CLASES_ACTOR = Object.freeze({
  MEDIO: "MEDIO",
  PERIODISTA: "PERIODISTA",
  CREADOR: "CREADOR",
  INFLUENCER: "INFLUENCER",
  MARCA: "MARCA",
  EMPRESA: "EMPRESA",
  INSTITUCION: "INSTITUCION",
  ORGANIZACION: "ORGANIZACION",
  CLUB: "CLUB",
  UNIVERSIDAD: "UNIVERSIDAD",
  CANAL_PUBLICO: "CANAL_PUBLICO",
  COMUNIDAD_PUBLICA: "COMUNIDAD_PUBLICA",
  AGREGADOR: "AGREGADOR",
  NO_CLASIFICADO: "NO_CLASIFICADO"
});


export const CERTEZAS = Object.freeze({
  /* Aparecio en la evidencia. Nada mas. */
  DESCUBIERTO: "DESCUBIERTO",

  /* Su feed esta comprobado en el universo de fuentes. */
  COMPROBADO: "COMPROBADO",

  /* Un analista lo confirmo. Hoy: ninguno. */
  VERIFICADO_POR_ANALISTA: "VERIFICADO_POR_ANALISTA"
});


export const PROCEDENCIAS = Object.freeze({
  DESCUBIERTO_POR_SENTINEL: "descubierto_por_sentinel",
  UNIVERSO_DE_FUENTES: "universo_de_fuentes_comprobado",
  CATALOGO_SEMILLA: "catalogo_semilla",
  AGREGADO_POR_ANALISTA: "agregado_por_analista"
});


/*
  Del tipo del catalogo semilla a la clase de actor. Solo se
  traduce lo que el catalogo AFIRMA; lo demas queda sin
  clasificar en lugar de adivinarse por el nombre.
*/
const DESDE_CATALOGO = {
  [TIPOS_FUENTE.MEDIO_LOCAL]: CLASES_ACTOR.MEDIO,
  [TIPOS_FUENTE.MEDIO_REGIONAL]: CLASES_ACTOR.MEDIO,
  [TIPOS_FUENTE.MEDIO_NACIONAL]: CLASES_ACTOR.MEDIO,
  [TIPOS_FUENTE.INSTITUCION]: CLASES_ACTOR.INSTITUCION,
  [TIPOS_FUENTE.AGREGADOR]: CLASES_ACTOR.AGREGADOR,
  [TIPOS_FUENTE.PLATAFORMA]: CLASES_ACTOR.CANAL_PUBLICO
};


/*
  Subtipos que el universo de fuentes SI declara. Una
  universidad declarada por un analista es una universidad; no
  se deduce del sufijo `.edu.ec`.
*/
const DESDE_SUBTIPO = {
  UNIVERSIDAD_PUBLICA: CLASES_ACTOR.UNIVERSIDAD,
  UNIVERSIDAD_PRIVADA: CLASES_ACTOR.UNIVERSIDAD,
  EMPRESA_PUBLICA_MUNICIPAL: CLASES_ACTOR.INSTITUCION
};


export function entityIdDe(clave) {
  return `act-${String(clave || "")
    .toLowerCase()
    .replace(/[^a-z0-9.:-]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}


/*
===========================================================
CONSTRUIR EL UNIVERSO DE ACTORES
===========================================================
*/

export function construirUniversoDeActores({
  corpus = [],
  fichas = [],
  projectId = null
} = {}) {
  const porDominio = new Map(fichas.filter((f) => f?.dominio).map((f) => [f.dominio, f]));

  const actores = new Map();

  const tocar = (clave, base) => {
    if (!actores.has(clave)) {
      actores.set(clave, {
        projectId,
        entityId: entityIdDe(clave),
        clave,

        nombre: base.nombre || clave,
        aliases: [],

        clase: base.clase || CLASES_ACTOR.NO_CLASIFICADO,
        claseOrigen: base.claseOrigen || "no_clasificado",

        territorio: base.territorio || null,

        plataformas: [],
        urls: [],

        evidencias: 0,
        evidenceIds: [],

        primeraObservacion: null,
        ultimaObservacion: null,

        procedencia: [],
        certeza: base.certeza || CERTEZAS.DESCUBIERTO,

        /*
          Ningun atributo sensible. Se declara explicitamente
          para que la ausencia sea una decision visible y no un
          olvido.
        */
        atributosSensibles: null
      });
    }

    return actores.get(clave);
  };

  corpus.forEach((e) => {
    const clave = e.emitterId || e.sourceId || e.domain || null;

    if (!clave) return;

    const ficha = porDominio.get(e.sourceId) || porDominio.get(clave) || null;

    const delCatalogo = identificarFuente(e);

    /* --- clase: del universo, del catalogo, o sin clasificar --- */
    let clase = CLASES_ACTOR.NO_CLASIFICADO;

    let claseOrigen = "no_clasificado";

    if (ficha?.subtipo && DESDE_SUBTIPO[ficha.subtipo]) {
      clase = DESDE_SUBTIPO[ficha.subtipo];

      claseOrigen = PROCEDENCIAS.UNIVERSO_DE_FUENTES;
    } else if (ficha?.tipo && DESDE_CATALOGO[ficha.tipo]) {
      clase = DESDE_CATALOGO[ficha.tipo];

      claseOrigen = PROCEDENCIAS.UNIVERSO_DE_FUENTES;
    } else if (delCatalogo?.tipo && DESDE_CATALOGO[delCatalogo.tipo]) {
      clase = DESDE_CATALOGO[delCatalogo.tipo];

      claseOrigen = PROCEDENCIAS.CATALOGO_SEMILLA;
    }

    const a = tocar(clave, {
      nombre: e.publisher || ficha?.nombre || delCatalogo?.nombre || clave,
      clase,
      claseOrigen,
      territorio: ficha?.territorioDeclarado || null,

      /*
        COMPROBADO exige feed comprobado del propio medio. Que
        haya aparecido en la evidencia solo da DESCUBIERTO.
      */
      certeza:
        ficha?.estadoVerificacion === "VERIFICADO_FEED"
          ? CERTEZAS.COMPROBADO
          : CERTEZAS.DESCUBIERTO
    });

    a.evidencias += 1;

    if (e.evidenceId && !a.evidenceIds.includes(e.evidenceId)) a.evidenceIds.push(e.evidenceId);

    /* Alias: otro nombre observado para el mismo actor. */
    if (e.publisher && e.publisher !== a.nombre && !a.aliases.includes(e.publisher)) {
      a.aliases.push(e.publisher);
    }

    const m = String(e.sourceId || "").match(/^([a-z]+):/);

    const plataforma = m ? m[1] : "web";

    if (!a.plataformas.includes(plataforma)) a.plataformas.push(plataforma);

    if (e.canonicalUrl && a.urls.length < 3 && !a.urls.includes(e.canonicalUrl)) {
      a.urls.push(e.canonicalUrl);
    }

    const primera = e.firstObservedAt;

    const ultima = e.lastObservedAt || e.firstObservedAt;

    if (primera && (!a.primeraObservacion || primera < a.primeraObservacion)) {
      a.primeraObservacion = primera;
    }

    if (ultima && (!a.ultimaObservacion || ultima > a.ultimaObservacion)) {
      a.ultimaObservacion = ultima;
    }

    const proc = ficha
      ? PROCEDENCIAS.UNIVERSO_DE_FUENTES
      : PROCEDENCIAS.DESCUBIERTO_POR_SENTINEL;

    if (!a.procedencia.includes(proc)) a.procedencia.push(proc);
  });

  const lista = [...actores.values()].sort((a, b) => b.evidencias - a.evidencias);

  const porClase = {};

  const porCerteza = {};

  lista.forEach((a) => {
    porClase[a.clase] = (porClase[a.clase] || 0) + 1;

    porCerteza[a.certeza] = (porCerteza[a.certeza] || 0) + 1;
  });

  return {
    projectId,

    actores: lista,

    metricas: {
      total: lista.length,
      porClase,
      porCerteza,

      sinClasificar: porClase[CLASES_ACTOR.NO_CLASIFICADO] || 0,

      /* Nadie. Se cuenta para que la ausencia sea visible. */
      verificadosPorAnalista: porCerteza[CERTEZAS.VERIFICADO_POR_ANALISTA] || 0,

      plataformas: [...new Set(lista.flatMap((a) => a.plataformas))]
    },

    declaraciones: [
      "Aparecer en la evidencia da DESCUBIERTO, nunca VERIFICADO. Si el descubrimiento se autoverificase, el registro sería un espejo de la recolección.",
      "COMPROBADO exige feed comprobado del propio medio, no haber aparecido muchas veces.",
      "La clase sale del universo de fuentes o del catálogo semilla. Un dominio sin respaldo queda NO_CLASIFICADO por mucho que publique.",
      "No se infiere ningún atributo sensible ni se construyen perfiles de personas: `atributosSensibles` es null por decisión, no por olvido."
    ]
  };
}


export default {
  CLASES_ACTOR,
  CERTEZAS,
  PROCEDENCIAS,
  entityIdDe,
  construirUniversoDeActores
};
