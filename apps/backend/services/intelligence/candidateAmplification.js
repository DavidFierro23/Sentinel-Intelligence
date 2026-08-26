// apps/backend/services/intelligence/candidateAmplification.js

/*
===========================================================
AMPLIFICACION — PRESENCIA PROPIA Y PRESENCIA GANADA
===========================================================

Lo que publica un candidato y lo que se publica SOBRE el son dos
magnitudes distintas, y la segunda no la controla el candidato.
Mezclarlas produce el error mas comun de este oficio: leer la
cobertura de un medio como si fuera el discurso del sujeto.

    PRESENCIA PROPIA    lo publican sus cuentas
    PRESENCIA GANADA    lo publican terceros

-----------------------------------------------------------
DIEZ PORTALES NO SON DIEZ SENALES
-----------------------------------------------------------

Diez cabeceras publicando la misma nota de agencia son:

    10 piezas
     1 hecho
     N fuentes distintas

Tres cifras, y solo la tercera se parece a lo que la gente
imagina cuando oye «diez medios hablaron del candidato». Se dan
las tres por separado y ninguna se presenta como las otras.

La agrupacion reutiliza `conversation/nearDuplicate.js`. No hay
un segundo detector de duplicados, y la clasificacion de fuentes
reutiliza `conversation/mediaRegistry.js`.

-----------------------------------------------------------
PUBLICACIONES NO SON PERSONAS
-----------------------------------------------------------

Nunca se convierte un recuento de piezas en un recuento de
ciudadanos. No sabemos cuantas personas hay detras de N
publicaciones —una persona puede publicar cien veces y cien
cuentas pueden ser una sola operacion— y por eso `personas` es
`null` y lo dice.
===========================================================
*/

import { agruparCasiDuplicados } from "../conversation/nearDuplicate.js";

import {
  identificarFuente,
  resumirMedios,
  TIPOS_FUENTE
} from "../conversation/mediaRegistry.js";

import { normalizarTexto } from "../textUtils.js";


export const PLANOS = Object.freeze({
  PROPIA: "PRESENCIA_PROPIA",
  GANADA: "PRESENCIA_GANADA",

  /*
    No se pudo decidir de quien es la URL. Va aparte: metido en
    «ganada» inflaria la amplificacion con material propio.
  */
  INDETERMINADO: "PLANO_INDETERMINADO"
});


/*
  Tipos de actor que amplifican. Se apoyan en el catalogo de
  medios y se le anaden los que ese catalogo no cubre.
*/
export const TIPOS_ACTOR = Object.freeze({
  ...TIPOS_FUENTE,
  CUENTA_DEL_CANDIDATO: "cuenta_del_candidato",
  CREADOR: "creador",
  ORGANIZACION: "organizacion",
  PERIODISTA: "periodista"
});


function dominioDe(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}


/*
  Una URL es del candidato si su dominio y su ruta corresponden a
  una de sus cuentas. Se compara el handle dentro de la ruta: dos
  perfiles del mismo dominio no son la misma cuenta.
*/
function esDelCandidato(url, cuentas) {
  const d = dominioDe(url);

  if (!d) return null;

  const ruta = normalizarTexto(String(url));

  return (
    (cuentas || []).find((c) => {
      const dc = dominioDe(c.url);

      if (!dc || dc !== d) return false;

      const h = normalizarTexto(String(c.handle || ""));

      /* Sin handle solo se puede afirmar por dominio propio. */
      if (!h) return true;

      return ruta.includes(h);
    }) || null
  );
}


export function clasificarPlano(evidencia = {}, cuentas = []) {
  const url = evidencia.enlace || evidencia.url || null;

  if (!url) {
    return {
      plano: PLANOS.INDETERMINADO,
      motivo: "la evidencia no trae URL, asi que no se puede decir de quien es",
      cuenta: null
    };
  }

  const propia = esDelCandidato(url, cuentas);

  if (propia) {
    return {
      plano: PLANOS.PROPIA,
      motivo: `la URL pertenece a una cuenta del candidato (${propia.plataformaId}:${propia.handle})`,
      cuenta: propia.id || null
    };
  }

  return {
    plano: PLANOS.GANADA,
    motivo: "la URL no pertenece a ninguna cuenta atribuida al candidato",
    cuenta: null
  };
}


/*
  Tipo de actor de una evidencia de terceros. Lo que el catalogo
  no reconoce se queda en `desconocido`: clasificarlo por
  conjetura convertiria el panel en un espejo de la consulta.
*/
function tipoDeActor(evidencia) {
  const f = identificarFuente(evidencia);

  return {
    dominio: f.dominio,
    nombre: f.nombre,
    tipo: f.tipo,
    enCatalogo: f.tipo !== TIPOS_FUENTE.DESCONOCIDO
  };
}


/*
===========================================================
AMPLIFICACION DE UN CANDIDATO
===========================================================
*/
export function amplificacionDeCandidato(entrada = {}) {
  const { evidencias = [], cuentas = [], umbral } = entrada;

  const lista = Array.isArray(evidencias) ? evidencias : [];

  const clasificadas = lista.map((e) => ({
    evidencia: e,
    ...clasificarPlano(e, cuentas)
  }));

  const propias = clasificadas.filter((c) => c.plano === PLANOS.PROPIA);

  const ganadas = clasificadas.filter((c) => c.plano === PLANOS.GANADA);

  const indeterminadas = clasificadas.filter(
    (c) => c.plano === PLANOS.INDETERMINADO
  );

  /*
    ---------------------------------------------------------
    DEDUPLICACION DE LO GANADO

    Aqui esta el nucleo del modulo. `piezas` es lo que se
    encontro; `hechosDistintos` es cuantas cosas distintas se
    dijeron; `fuentesDistintas` es cuantos actores lo dijeron.
    ---------------------------------------------------------
  */
  const paraAgrupar = ganadas.map((g) => ({
    titulo: g.evidencia.titulo || g.evidencia.title || "",
    enlace: g.evidencia.enlace || g.evidencia.url || null,
    fecha: g.evidencia.fecha || null
  }));

  const grupos = agruparCasiDuplicados(paraAgrupar, umbral ? { umbral } : {});

  const fuentes = new Set(
    paraAgrupar.map((p) => dominioDe(p.enlace)).filter(Boolean)
  );

  const medios = resumirMedios(paraAgrupar);

  const porTipoDeActor = {};

  ganadas.forEach((g) => {
    const t = tipoDeActor(g.evidencia).tipo;

    porTipoDeActor[t] = (porTipoDeActor[t] || 0) + 1;
  });

  /*
    Replicas: los grupos con mas de un miembro. Se declara la
    replica en lugar de dejar que diez copias se cuenten como
    diez hechos.
  */
  const replicas = grupos.detalle.map((d) => ({
    representante: d.representante,
    piezas: d.repeticiones,
    similitudes: d.similitudes,
    titulos: d.titulos,
    nota:
      "Misma pieza publicada por mas de una fuente o repetida por la misma. Cuenta como UN hecho."
  }));

  return {
    /* ---------- PRESENCIA PROPIA ---------- */
    propia: {
      plano: PLANOS.PROPIA,
      definicion: "Contenido publicado por las cuentas del propio candidato.",
      piezas: propias.length,
      porCuenta: contarPor(propias, (c) => c.cuenta || "sin_cuenta"),
      advertencia: propias.length
        ? null
        : "No se observo ninguna pieza propia. Hoy ninguna plataforma social permite leer publicaciones sin API: la cifra en 0 describe nuestras fuentes, no la actividad del candidato."
    },

    /* ---------- PRESENCIA GANADA ---------- */
    ganada: {
      plano: PLANOS.GANADA,
      definicion:
        "Contenido publicado por terceros: medios, periodistas, creadores, organizaciones y otros actores publicos.",

      /* Las tres cifras, separadas y con su significado. */
      piezas: ganadas.length,
      hechosDistintos: grupos.metricas.gruposUnicos,
      fuentesDistintas: fuentes.size,

      piezasQueSonReplica: grupos.metricas.evidenciasRepetidas,

      replicas,

      porTipoDeActor,

      medios: {
        dominiosDistintos: medios.resumen.dominiosDistintos,
        locales: medios.resumen.locales,
        regionales: medios.resumen.regionales,
        nacionales: medios.resumen.nacionales,
        desconocidos: medios.resumen.desconocidos,
        detalle: medios.medios.slice(0, 25),
        loQueNoSabemos: medios.loQueNoSabemos
      },

      interpretacion:
        ganadas.length === grupos.metricas.gruposUnicos
          ? "Cada pieza es un hecho distinto: no se detecto replica."
          : `${ganadas.length} pieza(s) corresponden a ${grupos.metricas.gruposUnicos} hecho(s) distinto(s). ${grupos.metricas.evidenciasRepetidas} son repeticion de otra y NO cuentan como senales independientes.`,

      advertencia: ganadas.length
        ? null
        : "No se observo ninguna pieza de terceros en el corpus disponible."
    },

    indeterminadas: {
      plano: PLANOS.INDETERMINADO,
      piezas: indeterminadas.length,
      nota: indeterminadas.length
        ? "Piezas sin URL utilizable. No se cuentan como ganadas: no se puede afirmar que sean de un tercero."
        : null
    },

    /* ---------- LO QUE NO SE DICE ---------- */
    personas: null,

    notaPersonas:
      "No se convierte un recuento de piezas en un recuento de personas. Una persona puede publicar cien veces y cien cuentas pueden ser una sola operacion: de N publicaciones observadas no se deduce N ciudadanos.",

    corpus: {
      evidencias: lista.length,
      umbralSimilitud: grupos.metricas.umbral,
      nota: lista.length
        ? null
        : "No hay corpus de evidencias para este candidato todavia. La amplificacion se calcula sobre lo recogido por las investigaciones; sin ellas no hay nada que agrupar."
    }
  };
}


function contarPor(lista, clave) {
  const r = {};

  lista.forEach((x) => {
    const k = clave(x);

    r[k] = (r[k] || 0) + 1;
  });

  return r;
}


/*
===========================================================
CONVERSACION PUBLICA RELACIONADA — CUATRO PLANOS
===========================================================

Los cuatro se cuentan por separado porque no significan lo
mismo, y el ultimo es el que mas facilmente se exagera.
===========================================================
*/
export const PLANOS_CONVERSACION = Object.freeze([
  {
    id: "A",
    clave: "candidato",
    nombre: "Publicado por el candidato",
    definicion: "Piezas de sus propias cuentas."
  },
  {
    id: "B",
    clave: "medios",
    nombre: "Publicado por medios",
    definicion: "Piezas de dominios identificados como medios en el catalogo."
  },
  {
    id: "C",
    clave: "otros_actores",
    nombre: "Publicado por otros actores",
    definicion:
      "Instituciones, organizaciones, creadores y cuentas publicas que no son medios."
  },
  {
    id: "D",
    clave: "conversacion",
    nombre: "Conversacion publica observable",
    definicion:
      "Piezas de origen no institucional observables en el universo de fuentes de Sentinel. NO es la opinion publica ni una muestra de ella."
  }
]);


export function separarConversacion(entrada = {}) {
  const { evidencias = [], cuentas = [] } = entrada;

  const lista = Array.isArray(evidencias) ? evidencias : [];

  const cubos = {
    candidato: [],
    medios: [],
    otros_actores: [],
    conversacion: []
  };

  lista.forEach((e) => {
    const { plano } = clasificarPlano(e, cuentas);

    if (plano === PLANOS.PROPIA) {
      cubos.candidato.push(e);

      return;
    }

    const t = tipoDeActor(e).tipo;

    if (
      t === TIPOS_FUENTE.MEDIO_LOCAL ||
      t === TIPOS_FUENTE.MEDIO_REGIONAL ||
      t === TIPOS_FUENTE.MEDIO_NACIONAL
    ) {
      cubos.medios.push(e);

      return;
    }

    if (
      t === TIPOS_FUENTE.INSTITUCION ||
      t === TIPOS_FUENTE.ENCICLOPEDICO ||
      t === TIPOS_FUENTE.AGREGADOR
    ) {
      cubos.otros_actores.push(e);

      return;
    }

    cubos.conversacion.push(e);
  });

  return {
    planos: PLANOS_CONVERSACION.map((p) => ({
      ...p,
      piezasObservadas: cubos[p.clave].length,

      /*
        El campo que impide la frase «N ciudadanos hablan de X».
      */
      personas: null
    })),

    total: lista.length,

    prohibicion:
      "Ninguna de estas cifras se puede expresar en personas. Son piezas observadas dentro del universo de fuentes de Sentinel, que no es una muestra de la poblacion.",

    advertencia: lista.length
      ? null
      : "Sin corpus de evidencias no hay conversacion que separar."
  };
}


export default {
  PLANOS,
  TIPOS_ACTOR,
  PLANOS_CONVERSACION,
  clasificarPlano,
  amplificacionDeCandidato,
  separarConversacion
};
