// apps/backend/services/geo/normalizer.js

import { denominadorDe } from "./territoryRegistry.js";

import {
  NORMALIZACIONES,
  normalizacionPorId,
  ESTADOS_UNIDAD
} from "./geoContracts.js";

/*
===========================================================
NORMALIZER
===========================================================

Divide la magnitud de cada unidad por el denominador elegido.
Obligatorio y visible (UX-WR-001 §6.3): comparar Ricaurte
—rural y extensa— con El Batan —urbana y compacta— en valores
absolutos pinta de oscuro lo grande o lo poblado, siempre, y
responde a la pregunta equivocada.

LA REGLA DURA
-----------------------------------------------------------

    SIN DENOMINADOR OFICIAL NO SE CALCULA NINGUNA METRICA
    PER CAPITA, NINGUN PORCENTAJE POBLACIONAL Y NINGUNA
    INTENSIDAD RELATIVA.

Y no como aviso: como ausencia de codigo. En este archivo no
existe ninguna rama que estime, interpole, reparta o imputte
un denominador ausente. Si el valor es null, la salida es
`disponible: false` con motivo, y la interfaz muestra
«Dato oficial pendiente de integracion».

POR QUE ESTA PROHIBICION Y NO UN VALOR APROXIMADO
-----------------------------------------------------------

Porque el precedente que origino GEO-1 fue exactamente una
aproximacion razonable. Repartir el alcance provincial de Meta
Ads segun peso poblacional del INEC no es una barbaridad
metodologica: es lo que haria cualquiera. Produjo penetraciones
del 134 % y el 238 %.

Un denominador estimado no degrada la respuesta poco a poco:
la invierte, y lo hace en silencio.

QUE SI SE PUEDE SIN DENOMINADOR
-----------------------------------------------------------

  · conteos absolutos
  · ranking por conteo
  · variacion porcentual de una unidad CONSIGO MISMA entre dos
    periodos — no involucra poblacion, solo su propia serie
  · reparto porcentual sobre el total observado, declarado
    como "% de las evidencias", nunca como "% de la poblacion"

Esa ultima distincion es la que evita que un "23 %" se lea
como penetracion cuando es cuota de cobertura.
===========================================================
*/


export function normalizar(agregado, opciones = {}) {
  const modoId = opciones.modo || "absoluto";

  const modo = normalizacionPorId(modoId);

  if (!modo) {
    return bloqueado(agregado, {
      motivo: `Normalizacion "${modoId}" desconocida. Admitidas: ${NORMALIZACIONES.map(
        (n) => n.id
      ).join(", ")}.`
    });
  }

  const unidades = agregado?.unidades || [];

  /*
    ---------------------------------------------------------
    MODO ABSOLUTO

    Siempre disponible. Lleva aviso permanente porque lo que
    enganna no es usarlo, sino usarlo creyendo que mide
    intensidad.
    ---------------------------------------------------------
  */
  if (modo.id === "absoluto") {
    const totalObservado = unidades.reduce((s, u) => s + (u.conteo || 0), 0);

    return {
      modo: modo.id,
      nombreModo: modo.nombre,
      disponible: true,

      unidades: unidades.map((u) => ({
        ...u,
        denominador: null,
        valorNormalizado: u.conteo,
        unidadDeMedida: "evidencias",

        /*
          Cuota sobre lo OBSERVADO. Se etiqueta explicitamente
          para que nadie la lea como penetracion poblacional.
        */
        cuotaObservada:
          totalObservado > 0
            ? Number(((u.conteo / totalObservado) * 100).toFixed(1))
            : null,
        etiquetaCuota: "% de las evidencias observadas, NO de la poblacion"
      })),

      totalObservado,

      aviso: modo.aviso,

      /* Se declara aunque no bloquee: el analista debe saberlo. */
      denominadoresDisponibles: false,

      declaracion:
        "Conteo absoluto. Refleja tamano y poblacion, no intensidad relativa. No se calcula ninguna metrica per capita."
    };
  }

  /*
    ---------------------------------------------------------
    MODOS CON DENOMINADOR
    ---------------------------------------------------------
  */
  const conDenominador = [];

  const sinDenominador = [];

  unidades.forEach((u) => {
    const d = denominadorDe(u.unidadId, modo.campo);

    if (d.disponible) conDenominador.push({ unidad: u, denominador: d });
    else sinDenominador.push({ unidad: u, denominador: d });
  });

  /*
    ---------------------------------------------------------
    REGLA DE NIVEL — denominadores incompatibles
    ---------------------------------------------------------

    La poblacion de una parroquia rural y la del bloque urbano
    agregado son ambas oficiales, ambas verificadas y ambas del
    censo 2022. Y NO son comparables: una cubre una parroquia y
    la otra cubre quince.

    Dividir evidencias entre ellas y ordenar el resultado
    produciria un ranking donde el bloque urbano —361 524
    habitantes— siempre aparece abajo y cualquier parroquia
    pequena arriba. El numero seria correcto y la lectura,
    falsa.

    Asi que si aparecen dos niveles distintos, la normalizacion
    NO se ofrece mezclada: se declara el conflicto y se dice
    para que nivel SI esta disponible.
  */
  const niveles = [
    ...new Set(conDenominador.map((c) => c.denominador.nivel).filter(Boolean))
  ];

  if (niveles.length > 1) {
    const porNivel = niveles.map((n) => ({
      nivel: n,
      unidades: conDenominador.filter((c) => c.denominador.nivel === n).length
    }));

    return bloqueado(agregado, {
      modo: modo.id,
      nombreModo: modo.nombre,
      motivo: `Los denominadores disponibles pertenecen a ${
        niveles.length
      } niveles territoriales distintos (${porNivel
        .map((p) => `${p.nivel}: ${p.unidades}`)
        .join(", ")}). No son comparables entre si y no se mezclan.`,
      campo: modo.campo,
      conflictoDeNivel: porNivel,
      unidadesSinDenominador: sinDenominador.length
    });
  }

  /*
    NINGUN denominador disponible: no se calcula nada. No hay
    resultado parcial que ofrecer, porque un ranking con dos
    unidades normalizadas y treinta sin normalizar no es
    comparable y sugiere que si lo es.
  */
  if (conDenominador.length === 0) {
    return bloqueado(agregado, {
      modo: modo.id,
      nombreModo: modo.nombre,
      motivo: `Ninguna unidad tiene ${modo.nombre} oficial integrado. Dato oficial pendiente de integracion.`,
      campo: modo.campo,
      unidadesSinDenominador: sinDenominador.length
    });
  }

  /*
    COBERTURA PARCIAL: hay denominador para unas unidades y no
    para otras. Se calcula solo donde lo hay, y las demas
    quedan explicitamente fuera del ranking —no al final de la
    lista, que se leeria como "las mas bajas"—.
  */
  const calculadas = conDenominador.map(({ unidad, denominador }) => {
    /*
      Guarda aritmetica. Un denominador cero no es un caso
      teorico: una parroquia sin padron registrado lo tendria.
    */
    const valor =
      denominador.valor > 0 ? unidad.conteo / denominador.valor : null;

    return {
      ...unidad,
      denominador: {
        campo: modo.campo,
        valor: denominador.valor,
        fuente: denominador.fuente,
        verificado: denominador.verificado
      },
      valorNormalizado:
        valor === null ? null : Number((valor * 1000).toFixed(3)),
      unidadDeMedida: `evidencias por cada 1.000 (${modo.nombre.toLowerCase()})`,
      calculado: valor !== null,
      motivoSinCalculo:
        valor === null
          ? "Denominador cero o invalido: la division no se realiza."
          : null
    };
  });

  const excluidas = sinDenominador.map(({ unidad, denominador }) => ({
    unidadId: unidad.unidadId,
    nombre: unidad.nombre,
    conteo: unidad.conteo,
    estado: ESTADOS_UNIDAD.SIN_DATO,
    excluidaDelRanking: true,
    motivo: denominador.motivo || "Dato oficial pendiente de integracion.",
    etiquetaUI: "Dato oficial pendiente de integracion"
  }));

  const sinVerificar = calculadas.filter(
    (c) => c.denominador.verificado !== true
  ).length;

  return {
    modo: modo.id,
    nombreModo: modo.nombre,
    disponible: true,

    unidades: calculadas
      .filter((c) => c.calculado)
      .sort((a, b) => b.valorNormalizado - a.valorNormalizado),

    excluidas,

    denominadoresDisponibles: true,

    coberturaParcial: excluidas.length > 0,

    aviso: modo.aviso,

    declaracion: [
      `Normalizado por ${modo.nombre}.`,
      excluidas.length
        ? `${excluidas.length} unidad(es) sin denominador oficial quedan FUERA del ranking, no al final: aparecer ultimas se leeria como intensidad baja.`
        : null,
      sinVerificar
        ? `${sinVerificar} denominador(es) sin verificar contra la fuente oficial.`
        : null
    ]
      .filter(Boolean)
      .join(" ")
  };
}


/*
-----------------------------------------------------------
RESULTADO BLOQUEADO

Forma identica a la del resultado normal, para que la interfaz
no necesite dos caminos. Lo que cambia es `disponible:false` y
que `unidades` viene vacio: no hay valores parciales que
mostrar como si fueran resultado.
-----------------------------------------------------------
*/

function bloqueado(agregado, info) {
  return {
    modo: info.modo || null,
    nombreModo: info.nombreModo || null,

    disponible: false,

    unidades: [],

    excluidas: (agregado?.unidades || []).map((u) => ({
      unidadId: u.unidadId,
      nombre: u.nombre,
      conteo: u.conteo,
      excluidaDelRanking: true,
      motivo: info.motivo
    })),

    denominadoresDisponibles: false,

    motivo: info.motivo,

    etiquetaUI: "Dato oficial pendiente de integracion",

    /*
      Lo que SI se puede hacer mientras tanto. Un bloqueo que
      no ofrece salida empuja a saltarselo.
    */
    alternativaDisponible: {
      modo: "absoluto",
      que: "Conteo absoluto y ranking por conteo, mas variacion de cada unidad consigo misma entre periodos.",
      queNo:
        "Ninguna metrica per capita, ningun porcentaje poblacional, ninguna intensidad relativa."
    },

    declaracion: `Normalizacion no disponible. ${info.motivo} No se estima: un denominador inventado no degrada la respuesta, la invierte.`
  };
}


/*
===========================================================
CATALOGO PARA LA INTERFAZ

El selector de normalizacion va A LA VISTA, no en ajustes
(§6.3). Necesita saber cual de las opciones puede ofrecer de
verdad, para no presentar como elegible algo que devolvera un
bloqueo.
===========================================================
*/

export function catalogoNormalizaciones(unidadesIds = []) {
  return NORMALIZACIONES.map((n) => {
    if (n.id === "absoluto") {
      return { ...n, disponible: true, cobertura: null, motivo: null };
    }

    const conValor = unidadesIds.filter(
      (id) => denominadorDe(id, n.campo).disponible
    ).length;

    return {
      ...n,
      disponible: conValor > 0,
      cobertura: {
        conDenominador: conValor,
        total: unidadesIds.length
      },
      motivo:
        conValor === 0
          ? "Dato oficial pendiente de integracion."
          : conValor < unidadesIds.length
            ? `Solo ${conValor} de ${unidadesIds.length} unidades tienen denominador oficial.`
            : null
    };
  });
}


export default { normalizar, catalogoNormalizaciones };
