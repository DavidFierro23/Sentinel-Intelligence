// apps/backend/services/territorial/claimGuard.js

/*
===========================================================
QUE SE PUEDE AFIRMAR — TERRITORIAL-SOURCE-COVERAGE-01
===========================================================

Una capa que convierte una medida en una FRASE, y se niega a
producir la frase cuando la medida no la sostiene.

POR QUE HACE FALTA CODIGO Y NO UNA NORMA
-----------------------------------------------------------

Las reglas que dependen de que alguien se acuerde se rompen en
silencio. El salto de «el video con mas visualizaciones de la
muestra» a «lo mas visto en Cuenca» no lo da nadie a proposito:
lo da una etiqueta de interfaz escrita con prisa.

La diferencia entre las dos frases es el universo. La primera
habla de 177 piezas que Sentinel miro. La segunda habla de una
ciudad de medio millon de personas, y para sostenerla haria
falta un denominador que no existe.

LAS DOS PREGUNTAS QUE SEPARAN
-----------------------------------------------------------

    ¿sobre QUE universo se mide?
        la muestra observada, o la poblacion

    ¿hay DENOMINADOR?
        sin el, cualquier porcentaje es inventado

Todo lo que este modulo permite se refiere a la MUESTRA
OBSERVADA y se dice en la propia frase.
===========================================================
*/


export const AMBITOS_DE_AFIRMACION = Object.freeze({
  /* Lo que Sentinel miro. El unico universo que tenemos. */
  MUESTRA_OBSERVADA: "MUESTRA_OBSERVADA",

  /* La ciudad. Exige denominador oficial: hoy no existe. */
  POBLACION: "POBLACION"
});


/*
-----------------------------------------------------------
AFIRMACIONES PERMITIDAS

Cada una lleva la coletilla que la ata a la muestra. La
coletilla NO es decorativa: es lo que impide leerla como una
afirmacion sobre la ciudad.
-----------------------------------------------------------
*/

export const AFIRMACIONES = Object.freeze({
  MAS_MENCIONES: {
    id: "MAS_MENCIONES",
    ambito: AMBITOS_DE_AFIRMACION.MUESTRA_OBSERVADA,
    plantilla: (s) => `${s} · mayor número de menciones observadas en la muestra`,
    exige: ["evidencias"]
  },

  MAS_INTERACCION: {
    id: "MAS_INTERACCION",
    ambito: AMBITOS_DE_AFIRMACION.MUESTRA_OBSERVADA,
    plantilla: (s) => `${s} · mayor interacción observable registrada`,
    exige: ["interacciones"]
  },

  MAS_AMPLIFICADO: {
    id: "MAS_AMPLIFICADO",
    ambito: AMBITOS_DE_AFIRMACION.MUESTRA_OBSERVADA,
    plantilla: (s) => `${s} · mayor amplificación detectada entre fuentes observadas`,
    exige: ["fuentes"]
  },

  DOMINIO_RECURRENTE: {
    id: "DOMINIO_RECURRENTE",
    ambito: AMBITOS_DE_AFIRMACION.MUESTRA_OBSERVADA,
    plantilla: (s) => `${s} · dominio más recurrente del corpus observado`,
    exige: ["evidencias"]
  },

  MAS_VISUALIZACIONES_EN_LA_MUESTRA: {
    id: "MAS_VISUALIZACIONES_EN_LA_MUESTRA",
    ambito: AMBITOS_DE_AFIRMACION.MUESTRA_OBSERVADA,
    plantilla: (s) => `${s} · más visualizaciones públicas dentro de la muestra`,
    exige: ["visualizaciones"]
  },

  MAS_FRECUENTE: {
    id: "MAS_FRECUENTE",
    ambito: AMBITOS_DE_AFIRMACION.MUESTRA_OBSERVADA,
    plantilla: (s) => `${s} · mayor frecuencia de publicación observada`,
    exige: ["evidencias"]
  }
});


/*
-----------------------------------------------------------
AFIRMACIONES PROHIBIDAS

No es una lista de palabras feas: cada una necesita algo que no
tenemos, y aqui consta QUE es ese algo.
-----------------------------------------------------------
*/

export const PROHIBIDAS = Object.freeze([
  {
    patron: /m[áa]s\s+(visto|le[íi]do|escuchado|viral)\s+(en|de)\s+\w+/i,
    motivo:
      "Afirma sobre la ciudad, no sobre la muestra. Exigiría medir a toda la audiencia del territorio.",
    alternativa: "MAS_VISUALIZACIONES_EN_LA_MUESTRA"
  },
  {
    patron: /lo que (piensa|opina|siente|quiere)\s+\w+/i,
    motivo:
      "Infiere opinión ciudadana desde publicaciones observadas. Publicar no es opinar, y quien no publica no aparece.",
    alternativa: null
  },
  {
    patron: /\d+\s*%\s*(de\s+la\s+)?(poblaci[óo]n|ciudadan|habitantes|elector)/i,
    motivo: "Porcentaje poblacional sin denominador oficial con licencia.",
    alternativa: "MAS_MENCIONES"
  },
  {
    patron: /penetraci[óo]n|cobertura poblacional|per\s*c[áa]pita/i,
    motivo: "Requiere denominador poblacional. No hay ninguno disponible con licencia comercial.",
    alternativa: "MAS_MENCIONES"
  },
  {
    patron: /intenci[óo]n de voto|aprobaci[óo]n ciudadana|probabilidad electoral/i,
    motivo: "Exige encuesta con muestreo. Sentinel observa publicaciones, no intención.",
    alternativa: null
  },
  {
    patron: /toda la ciudad|todos los cuencanos|la ciudad entera/i,
    motivo: "Generaliza la muestra a la población.",
    alternativa: "MAS_MENCIONES"
  }
]);


export function esAfirmacionProhibida(texto) {
  const t = String(texto || "");

  for (const p of PROHIBIDAS) {
    if (p.patron.test(t)) {
      return { prohibida: true, motivo: p.motivo, alternativa: p.alternativa };
    }
  }

  return { prohibida: false, motivo: null, alternativa: null };
}


/*
===========================================================
CONSTRUIR UNA AFIRMACION

Devuelve la frase SOLO si la medida existe. Si falta el dato,
no se devuelve una version debilitada: se devuelve `null` con el
motivo, porque una frase sin su cifra es una impresion.
===========================================================
*/

export function afirmar(tipoId, { sujeto, medidas = {}, ambitoDeclarado = null } = {}) {
  const tipo = AFIRMACIONES[tipoId];

  if (!tipo) {
    return {
      afirmable: false,
      texto: null,
      motivo: `«${tipoId}» no es una afirmación declarada. Las permitidas son: ${Object.keys(AFIRMACIONES).join(", ")}.`
    };
  }

  if (!sujeto) {
    return { afirmable: false, texto: null, motivo: "Sin sujeto no hay afirmación." };
  }

  const faltan = tipo.exige.filter(
    (k) => medidas[k] === undefined || medidas[k] === null
  );

  if (faltan.length > 0) {
    return {
      afirmable: false,
      texto: null,
      tipo: tipo.id,

      motivo: `Falta la medida que la sostiene: ${faltan.join(", ")}. Sin la cifra, la frase sería una impresión.`
    };
  }

  const texto = tipo.plantilla(sujeto);

  /*
    Cinturon: la propia plantilla se comprueba contra la lista
    de prohibidas. Si alguien añade una plantilla que afirma de
    mas, salta aqui y no en produccion.
  */
  const revision = esAfirmacionProhibida(texto);

  if (revision.prohibida) {
    return {
      afirmable: false,
      texto: null,
      tipo: tipo.id,
      motivo: `La plantilla produce una afirmación prohibida: ${revision.motivo}`
    };
  }

  return {
    afirmable: true,
    tipo: tipo.id,
    texto,
    ambito: tipo.ambito,
    medidas,

    universo:
      ambitoDeclarado ||
      "muestra observada por Sentinel: no es una medida de la ciudad",

    motivo: null
  };
}


/*
  Revisa un objeto entero antes de enviarlo a la interfaz. Se usa
  sobre las cadenas de la respuesta: si alguna afirma de mas, se
  devuelve el hallazgo en lugar de dejarlo pasar.
*/
export function revisarSalida(objeto, ruta = "$") {
  const hallazgos = [];

  const visitar = (v, r) => {
    if (typeof v === "string") {
      const rev = esAfirmacionProhibida(v);

      if (rev.prohibida) hallazgos.push({ ruta: r, texto: v.slice(0, 120), motivo: rev.motivo });

      return;
    }

    if (Array.isArray(v)) {
      v.forEach((x, i) => visitar(x, `${r}[${i}]`));

      return;
    }

    if (v && typeof v === "object") {
      Object.entries(v).forEach(([k, x]) => visitar(x, `${r}.${k}`));
    }
  };

  visitar(objeto, ruta);

  return {
    limpio: hallazgos.length === 0,
    hallazgos,

    declaracion:
      hallazgos.length === 0
        ? "Ninguna cadena de la salida afirma más de lo que los datos sostienen."
        : `${hallazgos.length} afirmación(es) por encima de la evidencia.`
  };
}


export default {
  AMBITOS_DE_AFIRMACION,
  AFIRMACIONES,
  PROHIBIDAS,
  esAfirmacionProhibida,
  afirmar,
  revisarSalida
};
