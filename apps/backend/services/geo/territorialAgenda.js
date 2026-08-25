// apps/backend/services/geo/territorialAgenda.js

import { unidadPorId, listarUnidades } from "./territoryRegistry.js";

/*
===========================================================
AGENDA TERRITORIAL Y RADAR — Gate D
===========================================================

Compone, a partir de lo que ya producen el Topic Engine 2 y el
Open Topic Discovery, la vista que responde:

    ¿QUE ESTA PASANDO EN CUENCA?

y no

    ¿que categorias existen en la base?

TRES DECISIONES QUE GOBIERNAN ESTE MODULO
-----------------------------------------------------------

1. UN TEMA, DOS ORIGENES.

   El mismo asunto puede llegar descubierto por el corpus,
   clasificado por la taxonomia, o las dos cosas. La agenda los
   FUSIONA cuando comparten evidencias, y conserva de donde
   vino cada uno.

   Un tema descubierto que la taxonomia no cubre NO se
   esconde. Es justo el hallazgo que el Gate C2 existe para no
   perder: el dia de una inundacion, «lluvias» no tiene
   categoria y es lo mas importante de la pantalla.

2. NADA DE SCORE OPACO.

   El orden sale de tres dimensiones que se muestran POR
   SEPARADO —evidencias, fuentes independientes, recencia— y
   de una combinacion documentada que el test comprueba.

   Un numero unico que nadie puede desarmar es una opinion con
   formato de metrica. Aqui se puede desarmar.

3. NADA DE TENDENCIA.

   Sin ventana anterior no hay crecimiento posible. Los
   estados son de ACTIVIDAD OBSERVADA, no de evolucion:

       alta · media · baja · senal insuficiente

   «Emergente», «creciendo» y «viral» quedan prohibidos hasta
   que exista ventana comparable.
===========================================================
*/


export const ESTADOS_ACTIVIDAD = Object.freeze({
  ALTA: "alta_actividad_observada",
  MEDIA: "actividad_media",
  BAJA: "actividad_baja",
  INSUFICIENTE: "senal_insuficiente"
});


export const ETIQUETAS_ACTIVIDAD = Object.freeze({
  alta_actividad_observada: "Alta actividad observada",
  actividad_media: "Actividad media",
  actividad_baja: "Actividad baja",
  senal_insuficiente: "Señal insuficiente"
});


export const ORIGENES = Object.freeze({
  DESCUBIERTO: "descubierto",
  CLASIFICADO: "clasificado",
  AMBOS: "descubierto_y_clasificado"
});


/*
-----------------------------------------------------------
FORMULA DE ACTIVIDAD OBSERVADA — documentada y comprobable

    actividad = 0.50 · evidencias_norm
              + 0.35 · fuentes_norm
              + 0.15 · recencia

Los tres factores se normalizan contra el maximo del propio
lote, no contra una constante: lo que interesa es el orden
dentro de esta observacion, no una escala absoluta que no
existe.

Por que estos pesos:

  evidencias 0.50  es la senal mas directa de que algo se esta
                   publicando
  fuentes    0.35  casi tanto: veinte notas de un medio no son
                   veinte de ocho. Sin este peso, un medio
                   insistiendo encabezaria la agenda
  recencia   0.15  poco: sin ventana comparable, la recencia
                   dice cuando se publico, no si crece

NO se convierte en porcentaje y NO se presenta como puntuacion
al usuario. Ordena, y las tres dimensiones se muestran aparte.
-----------------------------------------------------------
*/

export const PESOS_ACTIVIDAD = Object.freeze({
  EVIDENCIAS: 0.5,
  FUENTES: 0.35,
  RECENCIA: 0.15
});


export const UMBRALES_ACTIVIDAD = Object.freeze({
  /* Minimos absolutos para no depender solo del maximo del lote. */
  EVIDENCIAS_MINIMAS: 2,
  FUENTES_MINIMAS: 2,

  ALTA: 0.66,
  MEDIA: 0.33
});


function recenciaDe(ultimaObservacion, referencia) {
  if (!ultimaObservacion || !referencia) return 0;

  const u = new Date(ultimaObservacion).getTime();

  const r = new Date(referencia).getTime();

  if (Number.isNaN(u) || Number.isNaN(r)) return 0;

  const dias = Math.max(0, (r - u) / 86400000);

  /* Decae en 30 dias. Lineal y explicable. */
  return Math.max(0, 1 - dias / 30);
}


/*
===========================================================
FUSIONAR DESCUBIERTOS Y CLASIFICADOS
===========================================================

Dos temas son EL MISMO si comparten la mayoria de sus
evidencias. Se compara por indices, que es un hecho, y no por
parecido de etiqueta, que seria una interpretacion.
===========================================================
*/

function solapan(a, b) {
  const A = new Set(a);

  const inter = b.filter((x) => A.has(x)).length;

  const menor = Math.min(a.length, b.length);

  return menor > 0 && inter / menor >= 0.6;
}


export function construirAgenda({
  temasClasificados = [],
  temasDescubiertos = [],
  ubicaciones = [],
  referencia = null
} = {}) {
  const ahora = referencia || new Date().toISOString();

  const filas = [];

  const usadosClasificados = new Set();

  /*
    Se parte de los DESCUBIERTOS. Es deliberado: son los que la
    taxonomia no garantiza, y encabezar por ellos evita que un
    fallo de fusion los deje fuera.
  */
  temasDescubiertos.forEach((d) => {
    const gemelo = temasClasificados.find(
      (c) => !usadosClasificados.has(c.id) && solapan(d.indices || [], c.indices || [])
    );

    if (gemelo) usadosClasificados.add(gemelo.id);

    filas.push(componer(d, gemelo, ubicaciones, ahora));
  });

  temasClasificados.forEach((c) => {
    if (usadosClasificados.has(c.id)) return;

    filas.push(componer(null, c, ubicaciones, ahora));
  });

  /* --- normalizacion contra el maximo del lote --- */
  const maxEv = Math.max(1, ...filas.map((f) => f.evidencias));

  const maxFu = Math.max(1, ...filas.map((f) => f.fuentesIndependientes));

  filas.forEach((f) => {
    const evNorm = f.evidencias / maxEv;

    const fuNorm = f.fuentesIndependientes / maxFu;

    f.dimensiones = {
      evidencias: { valor: f.evidencias, normalizado: Number(evNorm.toFixed(3)) },
      fuentes: {
        valor: f.fuentesIndependientes,
        normalizado: Number(fuNorm.toFixed(3))
      },
      recencia: {
        valor: f.ultimaObservacion,
        normalizado: Number(f.recencia.toFixed(3))
      }
    };

    f.actividad = Number(
      (
        PESOS_ACTIVIDAD.EVIDENCIAS * evNorm +
        PESOS_ACTIVIDAD.FUENTES * fuNorm +
        PESOS_ACTIVIDAD.RECENCIA * f.recencia
      ).toFixed(4)
    );

    /*
      Umbral absoluto ANTES que el relativo. En un lote donde
      todo es debil, el mejor de los debiles no es «alta
      actividad»: es senal insuficiente.
    */
    if (
      f.evidencias < UMBRALES_ACTIVIDAD.EVIDENCIAS_MINIMAS ||
      f.fuentesIndependientes < UMBRALES_ACTIVIDAD.FUENTES_MINIMAS
    ) {
      f.estadoActividad = ESTADOS_ACTIVIDAD.INSUFICIENTE;
    } else if (f.actividad >= UMBRALES_ACTIVIDAD.ALTA) {
      f.estadoActividad = ESTADOS_ACTIVIDAD.ALTA;
    } else if (f.actividad >= UMBRALES_ACTIVIDAD.MEDIA) {
      f.estadoActividad = ESTADOS_ACTIVIDAD.MEDIA;
    } else {
      f.estadoActividad = ESTADOS_ACTIVIDAD.BAJA;
    }

    f.etiquetaActividad = ETIQUETAS_ACTIVIDAD[f.estadoActividad];
  });

  filas.sort((a, b) => b.actividad - a.actividad || b.evidencias - a.evidencias);

  filas.forEach((f, i) => {
    f.posicion = i + 1;
  });

  return {
    agenda: filas,

    metricas: {
      temas: filas.length,
      descubiertos: filas.filter((f) => f.origen === ORIGENES.DESCUBIERTO).length,
      clasificados: filas.filter((f) => f.origen === ORIGENES.CLASIFICADO).length,
      ambos: filas.filter((f) => f.origen === ORIGENES.AMBOS).length,
      sinCategoria: filas.filter((f) => !f.categoria).length,
      porEstado: filas.reduce((acc, f) => {
        acc[f.estadoActividad] = (acc[f.estadoActividad] || 0) + 1;
        return acc;
      }, {})
    },

    formula: {
      expresion:
        "actividad = 0.50·evidencias_norm + 0.35·fuentes_norm + 0.15·recencia",
      pesos: PESOS_ACTIVIDAD,
      umbrales: UMBRALES_ACTIVIDAD,
      normalizacion: "contra el maximo del propio lote, no contra una constante",
      recencia: "decae linealmente en 30 dias desde la ultima observacion",
      porQueNoEsUnScore:
        "Las tres dimensiones se muestran por separado. El numero solo ordena y no se presenta como puntuacion.",
      noEsTendencia:
        "Mide ACTIVIDAD OBSERVADA, no evolucion. Sin ventana comparable no se puede afirmar crecimiento."
    },

    prohibido: [
      "No se usa «emergente», «creciendo», «cayendo» ni «viral»: exigen ventana comparable, que no existe.",
      "No se presenta como opinion ciudadana: son documentos publicados."
    ]
  };
}


function componer(descubierto, clasificado, ubicaciones, ahora) {
  const base = descubierto || clasificado;

  const indices = [
    ...new Set([...(descubierto?.indices || []), ...(clasificado?.indices || [])])
  ];

  const origen = descubierto && clasificado
    ? ORIGENES.AMBOS
    : descubierto
      ? ORIGENES.DESCUBIERTO
      : ORIGENES.CLASIFICADO;

  /* --- fuentes unificadas --- */
  const porFuente = new Map();

  [...(descubierto?.fuentes || []), ...(clasificado?.fuentes || [])].forEach((f) => {
    const k = f.dominio || f.nombre;

    if (!k) return;

    if (!porFuente.has(k)) {
      porFuente.set(k, { nombre: f.nombre, dominio: f.dominio || null, tipo: f.tipo, evidencias: 0 });
    }

    porFuente.get(k).evidencias = Math.max(
      porFuente.get(k).evidencias,
      f.evidencias || 0
    );
  });

  const fuentes = [...porFuente.values()].sort((a, b) => b.evidencias - a.evidencias);

  /* --- territorios desde las ubicaciones reales --- */
  const mapaTerr = new Map();

  let sinUbicar = 0;

  indices.forEach((i) => {
    const u = ubicaciones[i];

    if (!u?.unidadId) {
      sinUbicar += 1;
      return;
    }

    if (!mapaTerr.has(u.unidadId)) {
      const unidad = unidadPorId(u.unidadId);

      mapaTerr.set(u.unidadId, {
        unidadId: u.unidadId,
        nombre: u.unidad || unidad?.nombre || u.unidadId,
        nivel: u.nivel || unidad?.resolucion || null,
        geometriaDisponible: unidad?.geometriaDisponible === true,
        evidencias: 0
      });
    }

    mapaTerr.get(u.unidadId).evidencias += 1;
  });

  const fechas = [descubierto?.ultimaObservacion, clasificado?.ultimaObservacion]
    .filter(Boolean)
    .sort();

  const primeras = [
    descubierto?.primeraObservacion,
    clasificado?.primeraObservacion
  ]
    .filter(Boolean)
    .sort();

  const ultima = fechas.length ? fechas[fechas.length - 1] : null;

  return {
    id: base.id,

    etiqueta: descubierto?.etiquetaPropuesta || clasificado?.nombre || "Sin etiquetar",

    categoria: clasificado?.categoria && clasificado.categoria !== "Sin categoria declarada"
      ? clasificado.categoria
      : null,

    subtemas: clasificado?.subtemas || [],

    origen,

    /*
      Que la taxonomia no lo cubra es INFORMACION, no un fallo.
      La interfaz lo muestra como «Descubierto por Sentinel».
    */
    sinCategoria: !clasificado?.categoria || clasificado.categoria === "Sin categoria declarada",

    evidencias: indices.length,
    indices,

    fuentesIndependientes: fuentes.length,
    fuentes,

    primeraObservacion: primeras[0] || null,
    ultimaObservacion: ultima,
    recencia: recenciaDe(ultima, ahora),

    territorios: [...mapaTerr.values()].sort((a, b) => b.evidencias - a.evidencias),
    evidenciasSinUbicar: sinUbicar,

    entidades: descubierto?.entidades || [],

    terminos: descubierto?.terminos || clasificado?.terminos || [],

    confianza: Math.max(descubierto?.confianza || 0, clasificado?.confianza || 0),

    explicacionDescubrimiento: descubierto?.explicacion || null,
    explicacionClasificacion: clasificado?.explicacion || null,

    limitaciones: [
      ...new Set([
        ...(descubierto?.limitaciones || []),
        ...(clasificado?.limitaciones || [])
      ])
    ],

    titulares: descubierto?.titulares || clasificado?.titulares || []
  };
}


/*
===========================================================
MAPA — actividad por unidad CON geometria
===========================================================

Solo unidades con poligono verificado. Las que no lo tienen no
se dibujan y no desaparecen: van a `lugaresSinGeometria`.

Un mapa que omite en silencio la mitad del territorio sugiere
que ahi no pasa nada, cuando lo que falta es el poligono.
===========================================================
*/

export function construirMapa({ agregado = null, ubicaciones = [], agenda = [] } = {}) {
  const unidades = agregado?.unidades || [];

  const temasPorUnidad = new Map();

  agenda.forEach((t) => {
    t.territorios.forEach((terr) => {
      if (!temasPorUnidad.has(terr.unidadId)) temasPorUnidad.set(terr.unidadId, []);

      temasPorUnidad.get(terr.unidadId).push({
        id: t.id,
        etiqueta: t.etiqueta,
        evidencias: terr.evidencias
      });
    });
  });

  const conGeometria = [];

  const sinGeometria = [];

  unidades.forEach((u) => {
    const unidad = unidadPorId(u.unidadId);

    const fuentesUnidad = new Set();

    (u.evidencias || []).forEach((ev) => {
      if (ev.url) {
        try {
          fuentesUnidad.add(new URL(ev.url).hostname.replace(/^www\./, ""));
        } catch {
          /* url no parseable: no cuenta como fuente */
        }
      }
    });

    const fila = {
      unidadId: u.unidadId,
      nombre: u.nombre,
      nivel: u.resolucion,
      tipo: unidad?.tipo || null,

      unidadOficial: unidad?.verificado === true,
      tipoUnidad:
        unidad?.resolucion === "toponimo" ? "toponimo_no_certificado" : "oficial",

      codigoOficial: unidad?.codigoOficial || null,

      evidencias: u.conteo,
      fuentes: fuentesUnidad.size,
      temas: (temasPorUnidad.get(u.unidadId) || []).length,
      temasPrincipales: (temasPorUnidad.get(u.unidadId) || [])
        .sort((a, b) => b.evidencias - a.evidencias)
        .slice(0, 5),

      estado: u.estado,
      sePinta: u.sePinta,
      procedenciaDominante: u.procedenciaDominante,

      ultimaObservacion:
        (u.evidencias || [])
          .map((e) => e.fecha)
          .filter(Boolean)
          .sort()
          .pop() || null,

      /*
        La unidad de medida, siempre. Nunca un porcentaje
        poblacional: no hay denominador comparable y decir
        «el 35 % de Sayausi habla de X» seria falso.
      */
      unidadDeMedida: "evidencias observadas asociadas a la unidad"
    };

    if (unidad?.geometriaDisponible) {
      conGeometria.push({
        ...fila,
        geometria: unidad.geometria,

        /*
          Un poligono DERIVADO no es un poligono oficial de esa
          unidad: es la suma declarada de los de sus hijas. La
          diferencia viaja con el dato.
        */
        geometriaDerivada: unidad.geometriaDerivada === true,
        poligonosOrigen: unidad.poligonosOrigen || null
      });
    } else {
      sinGeometria.push({
        ...fila,
        motivoSinGeometria:
          unidad?.motivoSinGeometria ||
          "Sin poligono oficial. Se reconoce la señal sin fabricar el mapa."
      });
    }
  });

  /*
    Toponimos mencionados que ni siquiera llegaron a agregarse
    —no atribuyen— pero que la evidencia nombro.
  */
  const universoConGeo = listarUnidades().filter((u) => u.geometriaDisponible);

  return {
    conGeometria: conGeometria.sort((a, b) => b.evidencias - a.evidencias),

    sinGeometria: sinGeometria.sort((a, b) => b.evidencias - a.evidencias),

    metricas: {
      unidadesPintables: conGeometria.length,
      unidadesSinGeometria: sinGeometria.length,
      universoConGeometria: universoConGeo.length,
      evidenciasEnMapa: conGeometria.reduce((s, u) => s + u.evidencias, 0),
      evidenciasFueraDelMapa: sinGeometria.reduce((s, u) => s + u.evidencias, 0)
    },

    limitaciones: [
      sinGeometria.length
        ? `${sinGeometria.length} unidad(es) con actividad NO se dibujan por falta de poligono oficial. Aparecen en «lugares mencionados sin geometria disponible».`
        : null,

      "El mapa muestra evidencias observadas por unidad. NO es un porcentaje de poblacion ni de cobertura territorial.",

      "Cobertura geometrica parcial: las 15 parroquias urbanas de Cuenca no tienen poligono publicado."
    ].filter(Boolean)
  };
}


export default {
  construirAgenda,
  construirMapa,
  ESTADOS_ACTIVIDAD,
  ETIQUETAS_ACTIVIDAD,
  ORIGENES,
  PESOS_ACTIVIDAD,
  UMBRALES_ACTIVIDAD
};
