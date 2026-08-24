// apps/backend/services/conversation/framingClassifier.js

import { tokenizar } from "../textUtils.js";

import {
  ENCUADRES,
  UMBRALES,
  LIMITE_ENCUADRE
} from "./conversationContracts.js";

/*
===========================================================
FRAMING CLASSIFIER — encuadre lexico del texto publicado
===========================================================

Clasifica el ENCUADRE de un titular: critico, favorable,
neutro o no determinable.

LA CUARTA ETIQUETA ES LA IMPORTANTE
-----------------------------------------------------------

`no_determinable` no es un cajon de sastre: es la salida
correcta la mayor parte de las veces, y forzar una de las
otras tres seria inventar una senal.

Es el mismo principio que ya separa en esta plataforma
`ausencia` de `no comprobada`, y `bloqueado` de `0
resultados`. Aqui: "no hay carga" y "no se sabe si la hay" son
cosas distintas.

Un titular como "Sesion del concejo cantonal este martes" es
NEUTRO: hay lexico informativo y no hay carga. Un titular como
"Lo que pasa en Yanuncay" es NO DETERMINABLE: no hay senal
alguna que leer.

QUE CALIFICA, Y QUE NO
-----------------------------------------------------------

Califica el TEXTO. Jamas a la persona.

"Cobertura critica sobre X" significa que se publicaron textos
con lexico de cuestionamiento sobre X. No significa que X haya
hecho nada criticable, ni que la critica sea fundada, ni que
la cobertura sea justa.

Confundir las dos cosas convierte un recuento de titulares en
un juicio, que es exactamente lo que la plataforma tiene
prohibido (IA2: confirmar es competencia del analista).

LIMITES ASUMIDOS
-----------------------------------------------------------

Es lexico, no semantico. No entiende negacion ni ironia:

    "El alcalde nego el incumplimiento"

contiene "incumplimiento" y se clasificara como critico. El
fallo esta medido, declarado en conversationContracts y viaja
en cada respuesta.

Se acepta a cambio de determinismo y explicabilidad (IA1). Un
modelo de lenguaje etiquetaria mejor y explicaria peor.
===========================================================
*/


/*
-----------------------------------------------------------
LEXICOS

Normalizados: sin tildes y en minusculas, que es como los
devuelve `tokenizar`.

Los pesos separan senal fuerte de senal debil. "Peculado" es
inequivoco; "problema" apenas inclina.
-----------------------------------------------------------
*/

/*
  LA TERCERA PERSONA DEL PLURAL NO ES OPCIONAL

  Defecto medido: «Inauguran la obra tras meses de reclamos»
  quedaba `no_determinable` mientras que «Inaugura la obra…»
  salia `neutro`. La unica diferencia era la conjugacion.

  El titular periodistico en espanol usa el plural impersonal
  constantemente —«Inauguran», «Entregan», «Denuncian»,
  «Exigen»— precisamente para no nombrar al sujeto. Un lexico
  que solo recoge el singular deja fuera la forma MAS habitual
  del corpus, y lo hace en silencio: la evidencia no se
  clasifica mal, se clasifica como «no se sabe».

  Con 24 de 29 evidencias en `no_determinable` en la primera
  ejecucion real, esta laguna era una de las causas.
*/

const LEXICO_CRITICO = Object.freeze({
  fuerte: [
    "corrupcion", "peculado", "sobreprecio", "coima", "soborno",
    "denuncia", "denuncian", "denunciaron", "escandalo", "irregularidades",
    "fraude", "incumplimiento", "incumple", "incumplen", "abandono",
    "negligencia", "protesta", "protestan", "protestaron",
    "rechazo", "rechazan", "rechazaron", "exigen", "exigieron",
    "cuestionan", "cuestionaron", "cuestionamiento", "cuestionamientos",
    "critican", "criticaron", "criticas", "cuestionada", "cuestionado",
    "fracaso", "fracasan", "colapso", "crisis", "sancion", "sancionan",
    "destitucion", "destituyen", "investigacion", "investigan",
    "fiscalia", "contraloria", "glosa", "juicio", "irregular"
  ],
  debil: [
    "problema", "problemas", "queja", "quejas", "retraso", "retrasos",
    "demora", "demoras", "molestia", "malestar", "preocupacion",
    "reclamo", "reclamos", "reclaman", "falta", "faltan", "deficit",
    "deuda", "conflicto", "polemica", "tension", "advierte",
    "advierten", "alerta", "alertan", "riesgo", "afectados",
    "afectacion", "suspenden", "suspension", "cierre", "paralizado"
  ]
});


const LEXICO_FAVORABLE = Object.freeze({
  fuerte: [
    "inauguro", "inauguracion", "inaugura", "inauguran", "inauguraron",
    "entrego", "entrega", "entregan", "entregaron",
    "premio", "premiado", "premian", "reconocimiento", "reconocen",
    "galardon", "logro", "logros", "logran", "lograron",
    "exito", "record", "certificacion", "certifican",
    "aprobo", "aprobado", "aprueban", "aprobaron"
  ],
  debil: [
    "avance", "avances", "avanzan", "mejora", "mejoras", "mejoran",
    "beneficio", "beneficios", "benefician", "impulsa", "impulsan",
    "fortalece", "fortalecen", "amplia", "amplian", "moderniza",
    "modernizan", "renueva", "renuevan", "inversion", "acuerdo",
    "convenio", "alianza", "celebra", "celebran", "anuncia",
    "anuncian", "presenta", "presentan", "firma", "firman",
    "habilitan", "habilitado", "rehabilitan"
  ]
});


/*
  Lexico INFORMATIVO. Su presencia es lo que permite distinguir
  "neutro" de "no determinable": si el texto tiene sustancia
  reconocible pero ninguna carga, es neutro.
*/
const LEXICO_INFORMATIVO = [
  "sesion", "reunion", "agenda", "informe", "cronograma", "horario",
  "convocatoria", "programa", "calendario", "comunicado", "boletin",
  "resultados", "cifras", "datos", "estadistica", "encuesta",
  "ordenanza", "resolucion", "tramite", "requisitos", "plazo"
];


const PESO = Object.freeze({ FUERTE: 2, DEBIL: 1 });


function contarSenales(terminos, lexico) {
  const fuertes = terminos.filter((t) => lexico.fuerte.includes(t));

  const debiles = terminos.filter((t) => lexico.debil.includes(t));

  return {
    fuertes: [...new Set(fuertes)],
    debiles: [...new Set(debiles)],
    peso: fuertes.length * PESO.FUERTE + debiles.length * PESO.DEBIL,
    total: fuertes.length + debiles.length
  };
}


/*
===========================================================
CLASIFICAR UNA EVIDENCIA
===========================================================
*/

export function clasificarEncuadre(evidencia = {}, opciones = {}) {
  const minimo = Number.isFinite(opciones.senalesMinimas)
    ? opciones.senalesMinimas
    : UMBRALES.SENALES_ENCUADRE;

  const texto = [evidencia.titulo, evidencia.descripcion]
    .filter((t) => typeof t === "string" && t.trim())
    .join(" ");

  const terminos = tokenizar(texto, 4);

  const base = {
    limite: LIMITE_ENCUADRE.metodo,
    califica: "el texto publicado, no la persona mencionada"
  };

  if (terminos.length === 0) {
    return {
      ...base,
      encuadre: ENCUADRES.NO_DETERMINABLE,
      confianza: 0,
      senales: { criticas: [], favorables: [], informativas: [] },
      explicacion: "Sin texto utilizable que clasificar."
    };
  }

  const critico = contarSenales(terminos, LEXICO_CRITICO);

  const favorable = contarSenales(terminos, LEXICO_FAVORABLE);

  const informativas = [
    ...new Set(terminos.filter((t) => LEXICO_INFORMATIVO.includes(t)))
  ];

  const senales = {
    criticas: [...critico.fuertes, ...critico.debiles],
    favorables: [...favorable.fuertes, ...favorable.debiles],
    informativas
  };

  const totalCarga = critico.total + favorable.total;

  /*
    ---------------------------------------------------------
    SIN CARGA SUFICIENTE
    ---------------------------------------------------------
  */
  if (totalCarga < minimo) {
    /*
      Con lexico informativo reconocible, el texto SI dice algo
      y no dice nada cargado: eso es neutro. Sin el, no se
      sabe.
    */
    if (informativas.length > 0) {
      return {
        ...base,
        encuadre: ENCUADRES.NEUTRO,
        confianza: 45,
        senales,
        explicacion: `Lexico informativo presente (${informativas.join(
          ", "
        )}) y ninguna carga significativa. Es neutro, no «no se sabe».`
      };
    }

    return {
      ...base,
      encuadre: ENCUADRES.NO_DETERMINABLE,
      confianza: 0,
      senales,
      explicacion: `Solo ${totalCarga} senal(es) lexica(s); se exigen ${minimo}. No determinable NO significa neutro: significa que no hay con que decidir.`
    };
  }

  /*
    ---------------------------------------------------------
    SENALES CONTRAPUESTAS

    "Inauguran la obra tras meses de reclamos": hay carga en
    las dos direcciones. Elegir la mayor por un punto de
    diferencia seria arbitrario.
    ---------------------------------------------------------
  */
  const diferencia = Math.abs(critico.peso - favorable.peso);

  const mayor = Math.max(critico.peso, favorable.peso);

  if (critico.peso > 0 && favorable.peso > 0 && diferencia <= 1) {
    return {
      ...base,
      encuadre: ENCUADRES.NEUTRO,
      confianza: 40,
      senales,
      explicacion: `Senales contrapuestas de peso similar (critico ${critico.peso}, favorable ${favorable.peso}). Se anulan: no se elige la mayor por un punto de diferencia.`
    };
  }

  const ganador =
    critico.peso > favorable.peso ? ENCUADRES.CRITICO : ENCUADRES.FAVORABLE;

  const detalle = ganador === ENCUADRES.CRITICO ? critico : favorable;

  /*
    Confianza: crece con el peso y con la limpieza de la senal,
    y tiene tope. Nunca 100: el metodo es lexico y no entiende
    negacion.
  */
  const limpieza = mayor > 0 ? diferencia / mayor : 0;

  const confianza = Math.min(
    85,
    Math.round(35 + detalle.fuertes.length * 12 + limpieza * 25)
  );

  return {
    ...base,
    encuadre: ganador,
    confianza,
    senales,
    explicacion: `Lexico ${
      ganador === ENCUADRES.CRITICO ? "de cuestionamiento" : "de logro"
    } dominante: ${[...detalle.fuertes, ...detalle.debiles].join(
      ", "
    )}. Peso ${mayor} frente a ${Math.min(critico.peso, favorable.peso)}.`,

    advertencia:
      detalle.fuertes.length === 0
        ? "Clasificado solo con senales debiles: lectura fragil."
        : null
  };
}


/*
===========================================================
CLASIFICAR UN LOTE Y RESUMIR
===========================================================
*/

export function resumirEncuadre(evidencias = [], opciones = {}) {
  const lista = Array.isArray(evidencias) ? evidencias : [];

  const clasificadas = lista.map((e, indice) => ({
    indice,
    titulo: e?.titulo || null,
    ...clasificarEncuadre(e, opciones)
  }));

  const conteo = {
    critico: 0,
    favorable: 0,
    neutro: 0,
    no_determinable: 0
  };

  clasificadas.forEach((c) => {
    conteo[c.encuadre] += 1;
  });

  const determinadas = conteo.critico + conteo.favorable + conteo.neutro;

  const total = lista.length;

  /*
    El reparto porcentual se calcula SOBRE LAS DETERMINADAS y
    se etiqueta como tal. Calcularlo sobre el total escondería
    las no determinables dentro del denominador y haría parecer
    minoritaria a la categoria que suele ser mayoritaria.
  */
  const reparto = determinadas
    ? {
        critico: Number(((conteo.critico / determinadas) * 100).toFixed(1)),
        favorable: Number(((conteo.favorable / determinadas) * 100).toFixed(1)),
        neutro: Number(((conteo.neutro / determinadas) * 100).toFixed(1)),
        base: "sobre las evidencias con encuadre determinado, NO sobre el total"
      }
    : null;

  return {
    clasificadas,

    conteo,

    reparto,

    metricas: {
      total,
      determinadas,
      noDeterminables: conteo.no_determinable,
      porcentajeNoDeterminable:
        total > 0
          ? Number(((conteo.no_determinable / total) * 100).toFixed(1))
          : 0
    },

    limite: LIMITE_ENCUADRE,

    loQueNoSabemos: [
      conteo.no_determinable > 0
        ? `${conteo.no_determinable} de ${total} evidencias sin encuadre determinable. No se cuentan como neutras: quedan fuera del reparto y este lo declara.`
        : null,

      "El clasificador es lexico: no detecta ironia ni negacion. «El alcalde nego el incumplimiento» se clasifica como critico.",

      "El encuadre califica el texto publicado, nunca a la persona mencionada."
    ].filter(Boolean)
  };
}


export default { clasificarEncuadre, resumirEncuadre, ENCUADRES };
