// apps/backend/services/intelligence/candidateBaseline.js

/*
===========================================================
LINEA BASE T0 MULTICANDIDATO — P-CAND-BENCH-01
===========================================================

T0 es «lo que Sentinel observo en este momento». No es historia
previa, no es una estimacion y no es un ranking.

    T0 = punto de partida, no veredicto.

-----------------------------------------------------------
LAS TRES REGLAS QUE GOBIERNAN ESTE MODULO
-----------------------------------------------------------

1 · UN REPOST NO ES UNA PUBLICACION PROPIA.

Medido en X-REAL-01: en un retweet, `like_count`, `reply_count`
y `quote_count` valen 0 porque las reacciones pertenecen al post
original. Con cinco publicaciones reales, la media de likes
pasaba de 76 a 190 solo con filtrarlos.

Aqui las medias de rendimiento se calculan SOLO sobre
`ORIGINAL`. Los repost se cuentan aparte, como actividad de
curacion, que es lo que son.

2 · LAS VISTAS DE X Y LAS DE YOUTUBE NO SE SUMAN.

Una impresion de X y una reproduccion de YouTube no miden lo
mismo. No existe «audiencia total»: existe «vistas observadas en
X» y «vistas observadas en YouTube», y van en columnas
distintas.

3 · NO_MEDIDO NO ES CERO.

Un candidato sin cuenta de YouTube no tiene «0 suscriptores»:
tiene `SIN_CUENTA`. Un candidato cuya plataforma no sabemos leer
no tiene «0 publicaciones»: tiene `NO_MEDIDO`. Rellenar con
ceros convertiria un hueco nuestro en un dato sobre esa persona.

-----------------------------------------------------------
LO QUE ESTE MODULO NO HACE
-----------------------------------------------------------

    NO produce IPID.
    NO produce ranking electoral.
    NO declara un ganador.
    NO infiere intencion de voto ni popularidad.

Puede decir «en X, dentro de la muestra observada, A tuvo mas
vistas que B». No puede decir «A va ganando».
===========================================================
*/

import { TIPOS_PUBLICACION, DISPONIBILIDAD } from "./publicationObservation.js";

import { celdaDe, capacidad } from "./socialCapabilityMatrix.js";


/*
-----------------------------------------------------------
LAS CINCO PLATAFORMAS OBJETIVO

El denominador de la cobertura. No se amplia ni se recorta segun
lo que tenga cada candidato: si el objetivo son cinco, un
candidato con dos medidas tiene dos de cinco.
-----------------------------------------------------------
*/
export const PLATAFORMAS_OBJETIVO = Object.freeze([
  "x",
  "youtube",
  "instagram",
  "facebook",
  "tiktok"
]);


export const ESTADOS_PLATAFORMA_T0 = Object.freeze({
  /* Se observo y trajo datos. */
  MEDIDO: "MEDIDO",

  /* El candidato no tiene cuenta registrada ahi. */
  SIN_CUENTA: "SIN_CUENTA",

  /* Tiene cuenta y Sentinel no sabe leer esa plataforma. */
  NO_MEDIDO: "NO_MEDIDO",

  /* Se intento y fallo. */
  ERROR: "ERROR",

  /* Se puede leer y en esta ejecucion no se pidio. */
  NO_EJECUTADO: "NO_EJECUTADO"
});


export const COMPARABILIDAD = Object.freeze({
  COMPARABLE: "COMPARABLE",
  PARCIALMENTE_COMPARABLE: "PARCIALMENTE_COMPARABLE",
  NO_COMPARABLE: "NO_COMPARABLE"
});


/* Una metrica de la ultima observacion, o `null` si no la hubo. */
function ultimoValor(publicacion, metrica) {
  const puntos = (publicacion.metricas || [])
    .filter(
      (m) =>
        m.metrica === metrica &&
        m.availability === DISPONIBILIDAD.DISPONIBLE &&
        m.value != null
    )
    .sort((a, b) => String(a.observedAt).localeCompare(String(b.observedAt)));

  return puntos.length ? puntos[puntos.length - 1].value : null;
}


/*
  Suma que distingue «nadie lo tenia» de «todos valian cero».
  Si ninguna publicacion trae la metrica, devuelve `null`.
*/
function sumar(publicaciones, metrica) {
  const valores = publicaciones
    .map((p) => ultimoValor(p, metrica))
    .filter((v) => v != null);

  return valores.length ? valores.reduce((s, v) => s + v, 0) : null;
}


function media(publicaciones, metrica) {
  const valores = publicaciones
    .map((p) => ultimoValor(p, metrica))
    .filter((v) => v != null);

  return valores.length
    ? Number((valores.reduce((s, v) => s + v, 0) / valores.length).toFixed(1))
    : null;
}


/*
===========================================================
LINEA BASE DE UNA PLATAFORMA
===========================================================

Separa por tipo de publicacion ANTES de promediar nada. Es la
regla 1 aplicada donde importa.
===========================================================
*/
export function baseDePlataforma(publicaciones = [], plataformaId) {
  const suyas = publicaciones.filter((p) => p.platformId === plataformaId);

  /*
    Los registros anteriores a este contrato no traen
    `tipoPublicacion`. `undefined` no es NO_DETERMINADO, y sin
    esta normalizacion esas publicaciones no caian en NINGUN
    bucket: se contaban en el total y desaparecian del desglose.

    Medido con el expediente real: cinco publicaciones observadas
    y cero clasificadas. Los buckets tienen que sumar el total,
    siempre.
  */
  const tipoDe = (p) =>
    Object.values(TIPOS_PUBLICACION).includes(p.tipoPublicacion)
      ? p.tipoPublicacion
      : TIPOS_PUBLICACION.NO_DETERMINADO;

  const porTipo = {
    ORIGINAL: suyas.filter((p) => tipoDe(p) === TIPOS_PUBLICACION.ORIGINAL),
    REPOST: suyas.filter((p) => tipoDe(p) === TIPOS_PUBLICACION.REPOST),
    REPLY: suyas.filter((p) => tipoDe(p) === TIPOS_PUBLICACION.REPLY),
    QUOTE: suyas.filter((p) => tipoDe(p) === TIPOS_PUBLICACION.QUOTE),
    NO_DETERMINADO: suyas.filter(
      (p) => tipoDe(p) === TIPOS_PUBLICACION.NO_DETERMINADO
    )
  };

  const originales = porTipo.ORIGINAL;

  return {
    plataformaId,

    publicacionesObservadas: suyas.length,

    porTipo: {
      originales: porTipo.ORIGINAL.length,
      reposts: porTipo.REPOST.length,
      replies: porTipo.REPLY.length,
      quotes: porTipo.QUOTE.length,
      noDeterminado: porTipo.NO_DETERMINADO.length
    },

    /*
      RENDIMIENTO PROPIO: solo originales. Es la cifra que se
      puede atribuir al candidato.
    */
    rendimientoDeOriginales: {
      publicaciones: originales.length,

      viewsTotal: sumar(originales, "views"),
      viewsMedia: media(originales, "views"),

      likesTotal: sumar(originales, "likes"),
      likesMedia: media(originales, "likes"),

      commentsTotal: sumar(originales, "comments"),
      repostsRecibidos: sumar(originales, "reposts"),
      quotesRecibidos: sumar(originales, "quotes"),

      nota: originales.length
        ? "Calculado SOLO sobre publicaciones originales. Los repost no entran: sus reacciones pertenecen al post original."
        : porTipo.NO_DETERMINADO.length
          ? "No hay rendimiento propio calculable: las publicaciones de la muestra son anteriores a que se registrara el tipo, asi que no se sabe cuales son originales. NO significa que el candidato no publique contenido propio."
          : "No se observo ninguna publicacion original en la muestra: todas eran repost, respuesta o cita."
    },

    /*
      AVISO QUE EVITA UNA LECTURA FALSA.

      Una fila con `originales: 0` se lee como «no publica nada
      propio», y puede significar dos cosas muy distintas: que
      solo republico, o que no sabemos de que tipo son sus
      publicaciones. La segunda es un hueco nuestro.
    */
    tipoIndeterminado: porTipo.NO_DETERMINADO.length
      ? {
          publicaciones: porTipo.NO_DETERMINADO.length,
          motivo:
            "Observadas antes de que el contrato registrara el tipo de publicacion. Se sabran al reobservar.",
          efecto:
            "Sin tipo no entran en el rendimiento propio, asi que esa columna queda vacia. Vacia por desconocimiento, no por inactividad."
        }
      : null,

    /*
      CURACION: lo que republica. Es actividad, no rendimiento
      propio, y por eso va en su propio bloque.
    */
    curacion: {
      reposts: porTipo.REPOST.length,

      /*
        De un repost solo tienen sentido las vistas y los
        repost: likes y replies son del original.
      */
      viewsDeReposts: sumar(porTipo.REPOST, "views"),

      nota: porTipo.REPOST.length
        ? "Los repost miden amplificacion de contenido ajeno. Sus likes y replies pertenecen al post original y NO se promedian con los propios."
        : null
    },

    /* Muestra: dos candidatos con muestras distintas no se comparan igual. */
    tamanoDeMuestra: suyas.length,

    ultimaPublicacion:
      suyas
        .map((p) => p.publishedAt)
        .filter(Boolean)
        .sort()
        .pop() || null,

    /* Trazabilidad: de cada cifra se puede llegar a la pieza. */
    evidencias: suyas.map((p) => ({
      publicationId: p.publicationId,
      canonicalUrl: p.canonicalUrl,
      evidenceId: p.evidenceId,
      tipoPublicacion: p.tipoPublicacion,
      publishedAt: p.publishedAt,
      firstObservedAt: p.firstObservedAt
    }))
  };
}


/*
===========================================================
COBERTURA DE MEDICION

NO es popularidad, NO es solidez de identidad y NO es IPID.
Responde a una sola pregunta: cuanto del ecosistema que queremos
observar estamos observando de verdad.

Se expresa en «n de 5 plataformas», no en porcentaje: un 40 %
sugiere una precision que esta cifra no tiene.
===========================================================
*/
export function coberturaDeMedicion(estados = {}) {
  const medidas = PLATAFORMAS_OBJETIVO.filter(
    (p) => estados[p] === ESTADOS_PLATAFORMA_T0.MEDIDO
  );

  const sinCuenta = PLATAFORMAS_OBJETIVO.filter(
    (p) => estados[p] === ESTADOS_PLATAFORMA_T0.SIN_CUENTA
  );

  const noMedidas = PLATAFORMAS_OBJETIVO.filter(
    (p) => estados[p] === ESTADOS_PLATAFORMA_T0.NO_MEDIDO
  );

  return {
    medidas: medidas.length,
    objetivo: PLATAFORMAS_OBJETIVO.length,

    /* La forma honesta de decirlo. */
    expresion: `${medidas.length}/${PLATAFORMAS_OBJETIVO.length} plataformas objetivo medidas`,

    plataformasMedidas: medidas,
    plataformasSinCuenta: sinCuenta,
    plataformasNoMedidas: noMedidas,

    /*
      Deliberadamente sin porcentaje: no hay metodologia que
      justifique decir que X vale lo mismo que TikTok.
    */
    porcentaje: null,

    notaPorcentaje:
      "No se expresa en porcentaje a proposito: eso supondria que las cinco plataformas pesan igual, y no hay metodologia aprobada que lo sostenga.",

    noEs:
      "La cobertura de medicion NO es popularidad, ni solidez del expediente, ni un indice de presencia. Mide cuanto observamos nosotros, no cuanto existe el candidato."
  };
}


/*
===========================================================
COMPARABILIDAD

Dos candidatos con coberturas distintas no se comparan igual, y
decirlo es mas util que ocultarlo detras de un numero.
===========================================================
*/
/*
===========================================================
MATRIZ SOCIAL DEL PROYECTO — P-CAND-SOCIAL-COVERAGE-01
===========================================================

Una fila por candidato, una columna por plataforma, y el estado
real de cada celda.

LO QUE ESTA MATRIZ SE NIEGA A HACER

Rellenar. Cada celda vacia tiene una causa distinta y todas se
verian igual si se pintaran como «sin datos»:

    SIN_CUENTA        no tiene cuenta ahi
    NO_SOPORTADO      la tiene y la via oficial no la alcanza
    BLOQUEADO         la via existe y no esta abierta
    NO_PROBADO        no se ha intentado
    PARCIAL           se midio algo, no lo suficiente
    MEDIDO            observacion real de un tercero
    MEDIDO_PROPIO     observacion real de un activo nuestro

`SIN_CUENTA` y `NO_PROBADO` son los dos que mas facil se
confunden con «no hay nada», y ninguno de los dos lo significa.

Y `MEDIDO_PROPIO` no se cuenta como cobertura: una cuenta que
administramos no informa de un candidato ajeno.
===========================================================
*/
export const ESTADOS_CELDA_SOCIAL = Object.freeze({
  MEDIDO: "MEDIDO",
  MEDIDO_PROPIO: "MEDIDO_PROPIO",
  PARCIAL: "PARCIAL",
  BLOQUEADO: "BLOQUEADO",
  NO_PROBADO: "NO_PROBADO",
  SIN_CUENTA: "SIN_CUENTA",
  NO_SOPORTADO: "NO_SOPORTADO"
});


export function matrizSocialDelProyecto(entrada = {}) {
  const { candidatos = [], plataformas = PLATAFORMAS_OBJETIVO } = entrada;

  const filas = (candidatos || []).map((c) => {
    const celdas = {};

    plataformas.forEach((plat) => {
      const activos = (c.activos || []).filter((a) => a.platform === plat);

      const observados = (c.observaciones || []).filter(
        (o) => o.platform === plat
      );

      if (!activos.length) {
        celdas[plat] = {
          estado: ESTADOS_CELDA_SOCIAL.SIN_CUENTA,
          activos: 0,
          observados: 0,
          publicaciones: 0,
          snapshots: 0,
          ultimaObservacion: null,
          nota: "no tiene ningun activo declarado en esta plataforma"
        };

        return;
      }

      /*
        La cuenta de activos y la de observados son cifras
        distintas y las dos hacen falta: 3 activos con 1
        observado no es lo mismo que 1 activo con 1 observado,
        aunque las dos «tengan Instagram medido».
      */
      const conTercero = observados.filter((o) => o.alcance === "MEDIDO_TERCERO");

      const conPropio = observados.filter(
        (o) => o.alcance === "MEDIDO_PROPIO_AUTORIZADO"
      );

      const noSoportados = observados.filter(
        (o) => o.estado === "NO_SOPORTADO_PERSONAL"
      );

      const bloqueados = observados.filter((o) =>
        String(o.estado || "").startsWith("BLOQUEADO") ||
        ["CREDENCIAL_RECHAZADA", "CREDENCIAL_EXPIRADA", "PERMISOS_INSUFICIENTES"].includes(
          o.estado
        )
      );

      const publicaciones = observados.reduce(
        (n, o) => n + (o.publicaciones || 0),
        0
      );

      const snapshots = observados.reduce((n, o) => n + (o.snapshots || 0), 0);

      const fechas = observados.map((o) => o.observedAt).filter(Boolean).sort();

      let estado = ESTADOS_CELDA_SOCIAL.NO_PROBADO;

      let nota = "hay activos declarados y no se ha intentado observarlos";

      if (conTercero.length) {
        /*
          MEDIDO si TODOS los activos de la plataforma se
          midieron; PARCIAL si solo algunos. Un candidato con
          tres Instagram y uno medido no esta «medido en
          Instagram».
        */
        const completo = conTercero.length === activos.length;

        estado = completo
          ? ESTADOS_CELDA_SOCIAL.MEDIDO
          : ESTADOS_CELDA_SOCIAL.PARCIAL;

        nota = completo
          ? `los ${activos.length} activo(s) observados sobre terceros`
          : `${conTercero.length} de ${activos.length} activo(s) observados. El resto no se midio y no se rellena`;
      } else if (conPropio.length) {
        estado = ESTADOS_CELDA_SOCIAL.MEDIDO_PROPIO;

        nota =
          "lo unico observado son activos que administramos. NO cuenta como cobertura del candidato por vias de tercero";
      } else if (bloqueados.length) {
        estado = ESTADOS_CELDA_SOCIAL.BLOQUEADO;

        nota = bloqueados[0].motivo || "la via existe y no esta abierta";
      } else if (noSoportados.length === observados.length && observados.length) {
        estado = ESTADOS_CELDA_SOCIAL.NO_SOPORTADO;

        nota =
          "los activos existen y la via oficial no los alcanza. NO es que no tenga cuenta";
      }

      celdas[plat] = {
        estado,
        activos: activos.length,
        observados: conTercero.length + conPropio.length,
        observadosSobreTerceros: conTercero.length,
        publicaciones,
        snapshots,
        ultimaObservacion: fechas.length ? fechas[fechas.length - 1] : null,
        nota
      };
    });

    return {
      candidateId: c.candidateId,
      nombre: c.nombre || null,
      celdas,

      /* Cuantas plataformas aportan observacion de TERCERO. */
      plataformasConTercero: plataformas.filter(
        (plat) =>
          celdas[plat].estado === ESTADOS_CELDA_SOCIAL.MEDIDO ||
          celdas[plat].estado === ESTADOS_CELDA_SOCIAL.PARCIAL
      ).length
    };
  });

  const cuenta = (plat, estado) =>
    filas.filter((f) => f.celdas[plat]?.estado === estado).length;

  return {
    plataformas,
    filas,

    porPlataforma: plataformas.reduce((acc, plat) => {
      acc[plat] = {
        MEDIDO: cuenta(plat, ESTADOS_CELDA_SOCIAL.MEDIDO),
        PARCIAL: cuenta(plat, ESTADOS_CELDA_SOCIAL.PARCIAL),
        MEDIDO_PROPIO: cuenta(plat, ESTADOS_CELDA_SOCIAL.MEDIDO_PROPIO),
        BLOQUEADO: cuenta(plat, ESTADOS_CELDA_SOCIAL.BLOQUEADO),
        NO_PROBADO: cuenta(plat, ESTADOS_CELDA_SOCIAL.NO_PROBADO),
        SIN_CUENTA: cuenta(plat, ESTADOS_CELDA_SOCIAL.SIN_CUENTA),
        NO_SOPORTADO: cuenta(plat, ESTADOS_CELDA_SOCIAL.NO_SOPORTADO),

        activos: filas.reduce((n, f) => n + (f.celdas[plat]?.activos || 0), 0),
        publicaciones: filas.reduce(
          (n, f) => n + (f.celdas[plat]?.publicaciones || 0),
          0
        )
      };

      return acc;
    }, {}),

    candidatos: filas.length,

    reglaDeRelleno:
      "Ninguna celda vacia se rellena. SIN_CUENTA, NO_SOPORTADO, BLOQUEADO y NO_PROBADO tienen causas distintas y se verian igual pintadas como «sin datos».",

    reglaDePropio:
      "MEDIDO_PROPIO no cuenta como cobertura: una cuenta que administramos no informa de un candidato ajeno."
  };
}


export function comparabilidad(cobertura, referencia) {
  const suyas = new Set(cobertura.plataformasMedidas);

  const base = new Set(referencia);

  const comunes = [...base].filter((p) => suyas.has(p));

  const faltan = [...base].filter((p) => !suyas.has(p));

  if (!comunes.length) {
    return {
      estado: COMPARABILIDAD.NO_COMPARABLE,
      plataformasComunes: [],
      faltan,
      motivo:
        "No comparte ninguna plataforma medida con el conjunto de referencia: no hay nada sobre lo que comparar."
    };
  }

  if (!faltan.length) {
    return {
      estado: COMPARABILIDAD.COMPARABLE,
      plataformasComunes: comunes,
      faltan: [],
      motivo: `Medido en las mismas plataformas que la referencia: ${comunes.join(", ")}.`
    };
  }

  return {
    estado: COMPARABILIDAD.PARCIALMENTE_COMPARABLE,
    plataformasComunes: comunes,
    faltan,
    motivo: `Comparable solo en ${comunes.join(", ")}. Le faltan ${faltan.join(", ")}, asi que cualquier comparacion global lo perjudicaria por un hueco de medicion, no por su actividad.`
  };
}


/*
===========================================================
LINEA BASE DE UN CANDIDATO
===========================================================
*/
export function baseDeCandidato(entrada = {}) {
  const {
    candidateId = null,
    nombre = null,
    foto = null,
    cuentas = [],
    publicaciones = [],
    metricasDeCuenta = {},
    errores = {}
  } = entrada;

  /* Estado por plataforma objetivo. */
  const estados = {};

  PLATAFORMAS_OBJETIVO.forEach((p) => {
    const tiene = cuentas.some((c) => c.plataformaId === p);

    if (errores[p]) {
      estados[p] = ESTADOS_PLATAFORMA_T0.ERROR;

      return;
    }

    if (!tiene) {
      estados[p] = ESTADOS_PLATAFORMA_T0.SIN_CUENTA;

      return;
    }

    const observadas = publicaciones.some((x) => x.platformId === p);

    if (observadas || metricasDeCuenta[p]) {
      estados[p] = ESTADOS_PLATAFORMA_T0.MEDIDO;

      return;
    }

    /*
      Tiene cuenta y no hay datos. Si la plataforma es legible
      hoy, es que no se ejecuto; si no lo es, es que no sabemos
      leerla. Son cosas distintas.
      */
    const cap = celdaDe(capacidad(p, "publicaciones"));

    estados[p] =
      cap === "MEDIDO"
        ? ESTADOS_PLATAFORMA_T0.NO_EJECUTADO
        : ESTADOS_PLATAFORMA_T0.NO_MEDIDO;
  });

  const cobertura = coberturaDeMedicion(estados);

  const plataformas = {};

  cobertura.plataformasMedidas.forEach((p) => {
    plataformas[p] = {
      ...baseDePlataforma(publicaciones, p),
      cuenta: metricasDeCuenta[p] || null
    };
  });

  return {
    candidateId,
    nombre,

    /* Solo para mostrar. No interviene en ninguna cifra. */
    foto: foto || null,

    estados,
    cobertura,

    plataformas,

    /*
      NO hay un total. Sumar vistas de X con vistas de YouTube
      produciria una «audiencia» que no existe.
      */
    totalAgregado: null,

    notaTotalAgregado:
      "No se agrega entre plataformas. Una impresion de X y una reproduccion de YouTube no miden lo mismo, y sumarlas daria una audiencia inventada.",

    errores
  };
}


/*
===========================================================
LA TABLA T0
===========================================================
*/
export function lineaBaseT0(candidatos = [], opciones = {}) {
  const filas = candidatos.map((c) => baseDeCandidato(c));

  /*
    Conjunto de referencia para la comparabilidad: las
    plataformas que ALGUIEN pudo medir. No las cinco objetivo,
    porque entonces nadie seria comparable con nadie.
  */
  const referencia = [
    ...new Set(filas.flatMap((f) => f.cobertura.plataformasMedidas))
  ];

  filas.forEach((f) => {
    f.comparabilidad = comparabilidad(f.cobertura, referencia);
  });

  const conDatos = filas.filter((f) => f.cobertura.medidas > 0);

  /*
    Observaciones descriptivas POR PLATAFORMA. Nunca un ganador
    global: dentro de la muestra observada y en esa plataforma,
    quien tuvo mas. Nada mas.
  */
  const observaciones = referencia.map((p) => {
    const enPlataforma = filas
      .filter((f) => f.plataformas[p])
      .map((f) => ({
        candidateId: f.candidateId,
        nombre: f.nombre,
        views: f.plataformas[p].rendimientoDeOriginales.viewsTotal,
        originales: f.plataformas[p].porTipo.originales
      }))
      .filter((x) => x.views != null);

    const mejor = enPlataforma.slice().sort((a, b) => b.views - a.views)[0] || null;

    return {
      plataformaId: p,
      candidatosConDatos: enPlataforma.length,

      mayorVolumenDeVistas: mejor
        ? {
            candidateId: mejor.candidateId,
            nombre: mejor.nombre,
            views: mejor.views,
            sobreOriginales: mejor.originales
          }
        : null,

      lectura: mejor
        ? `Dentro de la muestra observada y solo en ${p}, ${mejor.nombre} acumulo mas vistas en sus publicaciones originales.`
        : `Ningun candidato tiene vistas observables en ${p}.`,

      noEs:
        "Esto describe una muestra pequena de una plataforma. No es un ranking, no mide alcance total y no dice nada sobre intencion de voto."
    };
  });

  return {
    version: "T0",
    generadoEn: opciones.generadoEn || new Date().toISOString(),

    candidatos: filas,

    referenciaDeComparabilidad: referencia,

    resumen: {
      candidatos: filas.length,
      conAlgunaMedicion: conDatos.length,
      sinNingunaMedicion: filas.length - conDatos.length,

      comparables: filas.filter(
        (f) => f.comparabilidad.estado === COMPARABILIDAD.COMPARABLE
      ).length,

      parcialmenteComparables: filas.filter(
        (f) => f.comparabilidad.estado === COMPARABILIDAD.PARCIALMENTE_COMPARABLE
      ).length,

      noComparables: filas.filter(
        (f) => f.comparabilidad.estado === COMPARABILIDAD.NO_COMPARABLE
      ).length
    },

    observaciones,

    /*
      T0 no tiene contra que compararse. Decirlo aqui evita que
      la interfaz dibuje una flecha hacia arriba.
    */
    momentum: {
      disponible: false,
      estado: "HISTORICO_INSUFICIENTE",
      motivo:
        "T0 es el primer punto. Delta, velocidad y aceleracion necesitan dos observaciones comparables, y por definicion todavia no existe la segunda."
    },

    advertencia:
      "Esta medicion representa presencia y actividad digital observada en las fuentes disponibles. No representa intencion de voto, aprobacion ni probabilidad electoral.",

    prohibido: [
      "declarar un ganador",
      "sumar metricas de plataformas distintas como audiencia unica",
      "convertir NO_MEDIDO en cero",
      "promediar repost con publicaciones originales"
    ]
  };
}


export default {
  PLATAFORMAS_OBJETIVO,
  ESTADOS_PLATAFORMA_T0,
  COMPARABILIDAD,
  baseDePlataforma,
  coberturaDeMedicion,
  comparabilidad,
  baseDeCandidato,
  lineaBaseT0
};
