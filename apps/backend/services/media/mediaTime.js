// apps/backend/services/media/mediaTime.js

import { ZONA_POR_DEFECTO } from "../territorial/dayWindow.js";

/*
===========================================================
MEDIA-TIME-NORMALIZATION-01 — CUANDO SE PUBLICO UNA PIEZA
===========================================================

Convierte el valor crudo de fecha que trae una pieza en un
instante ISO-8601, y SOLO cuando puede demostrarse. Cada
resultado viaja con el metodo que lo produjo, para que una fecha
derivada no se pueda confundir con una fecha leida.

LO QUE ESTE MODULO SE NIEGA A HACER
-----------------------------------------------------------

    no adivina el ano que falta
    no elige entre DD/MM y MM/DD cuando las dos caben
    no usa la fecha de OBSERVACION como fecha de PUBLICACION
    no convierte una fecha relativa sin una referencia real

Cada una de esas cuatro tentaciones produce una serie temporal
creible que nadie observo, que es exactamente el error que hace
inutil un analisis de campana.

EL DETALLE QUE DECIDE SI «HOY» SIGNIFICA ALGO
-----------------------------------------------------------

«3 jul 2026» tiene precision de DIA, no de instante. Convertirlo
a `2026-07-03T00:00:00Z` parece inofensivo y no lo es: en
America/Guayaquil (UTC-5) esa medianoche UTC son las 19:00 del
2 de julio, asi que la pieza caeria en el DIA ANTERIOR.

Con las ventanas de calendario que usa Sentinel —HOY es un dia
local, no 24 horas rodantes— eso desplaza piezas de un dia al
otro de forma sistematica. Por eso una fecha de dia se ancla a
la MEDIANOCHE LOCAL de la zona del territorio, y el resultado
declara `precision: "DIA"` para que nadie lo lea como una hora.

LA ESCALERA DE FUENTES TEMPORALES
-----------------------------------------------------------

De mas fuerte a mas debil. La primera que resuelve, gana, y el
metodo queda registrado:

    A  ISO_8601              ya venia normalizada
    B  TEXTO_ES_INEQUIVOCO   «3 jul 2026», «3 de julio de 2026»
    C  NUMERICA_INEQUIVOCA   «21/05/2025» — solo si el dia > 12
    D  RELATIVO_A_OBSERVACION  «ayer», «hace 2 horas», con referencia
    -  (ninguna)             publishedAt sigue null

No hay un peldano para «usar observedAt». Es deliberado: la
fecha de observacion se conserva aparte y NUNCA asciende a
fecha de publicacion.
===========================================================
*/

export const VERSION_NORMALIZACION_TEMPORAL = "1.0";


/*
-----------------------------------------------------------
METODOS

`metodo` responde «como lo supimos», y es lo que permite que
alguien audite una fecha sin volver a la fuente.
-----------------------------------------------------------
*/
export const METODOS_FECHA = Object.freeze({
  ISO_8601: "ISO_8601",
  TEXTO_ES_INEQUIVOCO: "TEXTO_ES_INEQUIVOCO",
  NUMERICA_INEQUIVOCA: "NUMERICA_INEQUIVOCA",
  RELATIVO_A_OBSERVACION: "RELATIVO_A_OBSERVACION"
});


/*
  Por que NO se normalizo. Son cuatro razones distintas y
  colapsarlas en «no se pudo» impediria saber cual se puede
  arreglar: la ausencia se arregla reingiriendo, la ambiguedad
  no se arregla nunca sin mas contexto.
*/
export const MOTIVOS_NO_NORMALIZADA = Object.freeze({
  SIN_VALOR: "SIN_VALOR",
  FORMATO_NO_RECONOCIDO: "FORMATO_NO_RECONOCIDO",
  AMBIGUA: "AMBIGUA",
  SIN_REFERENCIA: "SIN_REFERENCIA",
  FUERA_DE_RANGO: "FUERA_DE_RANGO"
});


export const PRECISIONES = Object.freeze({
  INSTANTE: "INSTANTE",
  DIA: "DIA"
});


/*
-----------------------------------------------------------
MESES EN ESPANOL

Incluye las abreviaturas que devuelven los buscadores. `sept` y
`sep` conviven porque Google usa las dos, y `set` aparece en
algunos medios. Sin acentos: el texto se normaliza antes.
-----------------------------------------------------------
*/
const MESES = Object.freeze({
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12
});


const PATRON_ISO =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;


function sinAcentos(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}


/*
-----------------------------------------------------------
DESFASE DE UNA ZONA, EN MINUTOS

Se calcula con `Intl` en lugar de fijar -5 a mano: Ecuador no
tiene horario de verano hoy, pero cablear el numero convertiria
una decision de calendario en una constante invisible.
-----------------------------------------------------------
*/
function desfaseMinutos(instante, zona) {
  const fecha = new Date(instante);

  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(fecha);

  const v = {};

  partes.forEach((p) => {
    if (p.type !== "literal") v[p.type] = p.value;
  });

  const comoUtc = Date.UTC(
    Number(v.year),
    Number(v.month) - 1,
    Number(v.day),
    Number(v.hour === "24" ? "0" : v.hour),
    Number(v.minute),
    Number(v.second)
  );

  return Math.round((comoUtc - fecha.getTime()) / 60000);
}


/*
-----------------------------------------------------------
MEDIANOCHE LOCAL DE UN DIA DE CALENDARIO

Devuelve el instante UTC que corresponde a las 00:00 de ese dia
en la zona indicada. Es lo que hace que «3 jul 2026» caiga en el
3 de julio local y no en el 2 por la tarde.
-----------------------------------------------------------
*/
export function medianocheLocal(anio, mes, dia, zona = ZONA_POR_DEFECTO) {
  const tentativo = Date.UTC(anio, mes - 1, dia, 0, 0, 0, 0);

  /*
    Dos pasadas: el desfase se calcula sobre un instante, y el
    instante depende del desfase. Con husos sin horario de
    verano converge en la primera; la segunda lo deja correcto
    tambien en los que si lo tienen.
  */
  let ajustado = tentativo - desfaseMinutos(tentativo, zona) * 60000;

  ajustado = tentativo - desfaseMinutos(ajustado, zona) * 60000;

  return new Date(ajustado).toISOString();
}


function resultado({ publishedAt, metodo, precision, raw, razon = null, motivo = null, referencia = null }) {
  return {
    publishedAt: publishedAt || null,
    normalizada: Boolean(publishedAt),

    metodo: publishedAt ? metodo : null,
    precision: publishedAt ? precision : null,

    /* El crudo viaja SIEMPRE: es lo que permite reauditar. */
    raw: raw ?? null,

    motivo: publishedAt ? null : motivo,
    razon,

    referenciaObservacion: referencia || null,

    version: VERSION_NORMALIZACION_TEMPORAL
  };
}


/*
  Rango de cordura. Una fecha de 1970 o de 2100 en un corpus de
  campana es un fallo de parseo, no un dato. Se rechaza en lugar
  de meterla en una serie.
*/
const ANIO_MINIMO = 1990;

const ANIO_MAXIMO = 2100;


function fueraDeRango(anio) {
  return anio < ANIO_MINIMO || anio > ANIO_MAXIMO;
}


/*
===========================================================
NORMALIZAR
===========================================================

`observedAt` es OPCIONAL y solo se usa para fechas relativas.
Sin el, una fecha relativa NO se resuelve: se declara.
===========================================================
*/
export function normalizarFecha(raw, opciones = {}) {
  const zona = opciones.zona || ZONA_POR_DEFECTO;

  const observedAt = opciones.observedAt || null;

  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return resultado({
      publishedAt: null,
      raw,
      motivo: MOTIVOS_NO_NORMALIZADA.SIN_VALOR,
      razon:
        "La pieza no trae ningun valor de fecha. No es un formato que no entendamos: no hay dato que interpretar."
    });
  }

  const texto = String(raw).trim();

  /*
    ---------------------------------------------------------
    A · ISO-8601 — ya venia normalizada
    ---------------------------------------------------------
  */
  if (PATRON_ISO.test(texto)) {
    const t = new Date(texto).getTime();

    if (Number.isNaN(t)) {
      return resultado({
        publishedAt: null,
        raw,
        motivo: MOTIVOS_NO_NORMALIZADA.FORMATO_NO_RECONOCIDO,
        razon: "Tiene forma de ISO-8601 pero no es una fecha valida."
      });
    }

    const anio = new Date(t).getUTCFullYear();

    if (fueraDeRango(anio)) {
      return resultado({
        publishedAt: null,
        raw,
        motivo: MOTIVOS_NO_NORMALIZADA.FUERA_DE_RANGO,
        razon: `El ano ${anio} esta fuera del rango admitido (${ANIO_MINIMO}-${ANIO_MAXIMO}).`
      });
    }

    /*
      Solo fecha, sin hora: es precision de DIA aunque sea ISO, y
      se ancla a la medianoche LOCAL por el mismo motivo que
      «3 jul 2026». `new Date("2026-07-03")` da medianoche UTC,
      que en Guayaquil son las 19:00 del dia 2: la pieza caeria
      en el dia anterior. La precision del dato no cambia porque
      el formato sea ISO.
    */
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      const [a, mm, dd] = texto.split("-").map(Number);

      return resultado({
        publishedAt: medianocheLocal(a, mm, dd, zona),
        metodo: METODOS_FECHA.ISO_8601,
        precision: PRECISIONES.DIA,
        raw,
        razon: `Fecha ISO sin hora: precision de dia, anclada a medianoche local de ${zona}.`
      });
    }

    return resultado({
      publishedAt: new Date(t).toISOString(),
      metodo: METODOS_FECHA.ISO_8601,
      precision: PRECISIONES.INSTANTE,
      raw,
      razon: "El valor ya venia en ISO-8601 con hora. No se derivo nada."
    });
  }

  const limpio = sinAcentos(texto);

  /*
    ---------------------------------------------------------
    B · TEXTO EN ESPANOL INEQUIVOCO

    «3 jul 2026», «3 julio 2026», «3 de julio de 2026»,
    «03 sept. 2025». El mes va escrito, asi que no hay ninguna
    ambiguedad posible entre dia y mes.
    ---------------------------------------------------------
  */
  const es = limpio.match(
    /^(\d{1,2})\s*(?:de\s+)?([a-z]+)\.?\s*(?:de\s+)?(\d{4})$/
  );

  if (es) {
    const dia = Number(es[1]);

    const mes = MESES[es[2]];

    const anio = Number(es[3]);

    if (!mes) {
      return resultado({
        publishedAt: null,
        raw,
        motivo: MOTIVOS_NO_NORMALIZADA.FORMATO_NO_RECONOCIDO,
        razon: `«${es[2]}» no es un mes reconocido en espanol.`
      });
    }

    if (dia < 1 || dia > diasDelMes(anio, mes)) {
      return resultado({
        publishedAt: null,
        raw,
        motivo: MOTIVOS_NO_NORMALIZADA.FORMATO_NO_RECONOCIDO,
        razon: `El dia ${dia} no existe en ese mes.`
      });
    }

    if (fueraDeRango(anio)) {
      return resultado({
        publishedAt: null,
        raw,
        motivo: MOTIVOS_NO_NORMALIZADA.FUERA_DE_RANGO,
        razon: `El ano ${anio} esta fuera del rango admitido.`
      });
    }

    return resultado({
      publishedAt: medianocheLocal(anio, mes, dia, zona),
      metodo: METODOS_FECHA.TEXTO_ES_INEQUIVOCO,
      precision: PRECISIONES.DIA,
      raw,
      razon: `Mes escrito en espanol: no hay ambiguedad entre dia y mes. Anclada a medianoche local de ${zona}.`
    });
  }

  /*
    ---------------------------------------------------------
    C · NUMERICA — solo cuando el dia lo desambigua

    `21/05/2025` solo puede ser 21 de mayo: no hay mes 21.
    `03/07/2026` puede ser 3 de julio o 7 de marzo, y la
    convencion del publicador no viaja en el dato. Se queda
    AMBIGUA a proposito: elegir DD/MM «porque en Latinoamerica
    se usa asi» acertaria muchas veces y fallaria en silencio
    las demas, que es la peor combinacion posible.
    ---------------------------------------------------------
  */
  const num = limpio.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (num) {
    const a = Number(num[1]);

    const b = Number(num[2]);

    const anio = Number(num[3]);

    if (fueraDeRango(anio)) {
      return resultado({
        publishedAt: null,
        raw,
        motivo: MOTIVOS_NO_NORMALIZADA.FUERA_DE_RANGO,
        razon: `El ano ${anio} esta fuera del rango admitido.`
      });
    }

    /* Los dos caben como mes: no se elige. */
    if (a <= 12 && b <= 12) {
      return resultado({
        publishedAt: null,
        raw,
        motivo: MOTIVOS_NO_NORMALIZADA.AMBIGUA,
        razon: `«${texto}» puede ser ${a}/${b} o ${b}/${a}: los dos numeros caben como mes y la convencion del publicador no viaja en el dato. Elegir una acertaria a veces y fallaria en silencio el resto.`
      });
    }

    const dia = a > 12 ? a : b;

    const mes = a > 12 ? b : a;

    if (mes < 1 || mes > 12 || dia > diasDelMes(anio, mes)) {
      return resultado({
        publishedAt: null,
        raw,
        motivo: MOTIVOS_NO_NORMALIZADA.FORMATO_NO_RECONOCIDO,
        razon: "Los numeros no forman una fecha valida."
      });
    }

    return resultado({
      publishedAt: medianocheLocal(anio, mes, dia, zona),
      metodo: METODOS_FECHA.NUMERICA_INEQUIVOCA,
      precision: PRECISIONES.DIA,
      raw,
      razon: `${dia} solo puede ser el dia: no hay mes ${dia}. Anclada a medianoche local de ${zona}.`
    });
  }

  /*
    ---------------------------------------------------------
    D · RELATIVA — exige una referencia real

    «hace 2 horas» sin saber CUANDO se leyo no es una fecha, es
    una frase. La referencia es `observedAt`, y queda registrada
    en el resultado para que la derivacion se pueda rehacer.
    ---------------------------------------------------------
  */
  const relativa = interpretarRelativa(limpio);

  if (relativa) {
    if (!observedAt) {
      return resultado({
        publishedAt: null,
        raw,
        motivo: MOTIVOS_NO_NORMALIZADA.SIN_REFERENCIA,
        razon: `«${texto}» es relativa y no hay instante de observacion con el que resolverla.`
      });
    }

    const base = new Date(observedAt).getTime();

    if (Number.isNaN(base)) {
      return resultado({
        publishedAt: null,
        raw,
        motivo: MOTIVOS_NO_NORMALIZADA.SIN_REFERENCIA,
        razon: "El instante de observacion no es una fecha valida."
      });
    }

    if (relativa.tipo === "dia") {
      /*
        «ayer» es un DIA de calendario, no «hace 24 horas». Se
        resuelve sobre el dia local de la observacion.
      */
      const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: zona,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date(base - relativa.dias * 86400000));

      const [anio, mes, dia] = partes.split("-").map(Number);

      return resultado({
        publishedAt: medianocheLocal(anio, mes, dia, zona),
        metodo: METODOS_FECHA.RELATIVO_A_OBSERVACION,
        precision: PRECISIONES.DIA,
        raw,
        referencia: new Date(base).toISOString(),
        razon: `«${texto}» resuelto contra el dia local de la observacion en ${zona}.`
      });
    }

    return resultado({
      publishedAt: new Date(base - relativa.ms).toISOString(),
      metodo: METODOS_FECHA.RELATIVO_A_OBSERVACION,
      precision: PRECISIONES.INSTANTE,
      raw,
      referencia: new Date(base).toISOString(),
      razon: `«${texto}» restado del instante de observacion.`
    });
  }

  return resultado({
    publishedAt: null,
    raw,
    motivo: MOTIVOS_NO_NORMALIZADA.FORMATO_NO_RECONOCIDO,
    razon: `«${texto}» no coincide con ningun formato reconocido. No se adivina.`
  });
}


function diasDelMes(anio, mes) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}


/*
-----------------------------------------------------------
FECHAS RELATIVAS RECONOCIDAS
-----------------------------------------------------------
*/
function interpretarRelativa(limpio) {
  if (/^hoy$/.test(limpio)) return { tipo: "dia", dias: 0 };

  if (/^ayer$/.test(limpio)) return { tipo: "dia", dias: 1 };

  if (/^anteayer$/.test(limpio)) return { tipo: "dia", dias: 2 };

  const hace = limpio.match(
    /^hace\s+(\d+)\s+(minuto|minutos|hora|horas|dia|dias|semana|semanas)$/
  );

  if (hace) {
    const n = Number(hace[1]);

    const unidad = hace[2];

    if (/^minuto/.test(unidad)) return { tipo: "instante", ms: n * 60000 };

    if (/^hora/.test(unidad)) return { tipo: "instante", ms: n * 3600000 };

    if (/^dia/.test(unidad)) return { tipo: "dia", dias: n };

    if (/^semana/.test(unidad)) return { tipo: "dia", dias: n * 7 };
  }

  return null;
}


/*
===========================================================
RESUMEN DE UNA NORMALIZACION SOBRE UN CONJUNTO
===========================================================

Sirve para el antes/despues sin recontar a mano, y para que la
respuesta pueda declarar cuanto mejoro y cuanto sigue sin
poder normalizarse.
===========================================================
*/
export function resumirNormalizacion(resultados = []) {
  const porMetodo = new Map();

  const porMotivo = new Map();

  resultados.forEach((r) => {
    if (r.normalizada) {
      porMetodo.set(r.metodo, (porMetodo.get(r.metodo) || 0) + 1);
    } else {
      porMotivo.set(r.motivo, (porMotivo.get(r.motivo) || 0) + 1);
    }
  });

  const normalizadas = resultados.filter((r) => r.normalizada).length;

  return {
    total: resultados.length,
    normalizadas,
    noNormalizadas: resultados.length - normalizadas,

    porMetodo: [...porMetodo.entries()]
      .map(([metodo, piezas]) => ({ metodo, piezas }))
      .sort((a, b) => b.piezas - a.piezas),

    porMotivo: [...porMotivo.entries()]
      .map(([motivo, piezas]) => ({ motivo, piezas }))
      .sort((a, b) => b.piezas - a.piezas),

    declaracion:
      "Solo se normaliza lo que puede demostrarse desde el valor ya persistido. Una fecha ausente no se sustituye por la de observacion, y una ambigua no se resuelve eligiendo la convencion mas probable."
  };
}


export default {
  VERSION_NORMALIZACION_TEMPORAL,
  METODOS_FECHA,
  MOTIVOS_NO_NORMALIZADA,
  PRECISIONES,
  medianocheLocal,
  normalizarFecha,
  resumirNormalizacion
};
