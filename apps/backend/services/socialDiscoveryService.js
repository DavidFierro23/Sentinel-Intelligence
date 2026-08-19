import { buscarGoogle } from "./googleService.js";

/*
===========================================================
SENTINEL INTELLIGENCE
SOCIAL DISCOVERY ENGINE
===========================================================

Objetivo:

Recibir un objetivo como:

    Daniel Noboa

y realizar búsquedas dirigidas para descubrir
presencia pública relacionada con:

- Facebook
- Instagram
- TikTok
- YouTube
- X
- LinkedIn

IMPORTANTE:

Este módulo NO afirma que una cuenta pertenece
a una persona solamente por compartir un nombre.

Genera candidatos y calcula una puntuación
de correspondencia utilizando señales públicas.
===========================================================
*/


const PLATAFORMAS = [
  {
    id: "facebook",
    nombre: "Facebook",
    dominio: "facebook.com",
    tipo: "social"
  },
  {
    id: "instagram",
    nombre: "Instagram",
    dominio: "instagram.com",
    tipo: "social"
  },
  {
    id: "tiktok",
    nombre: "TikTok",
    dominio: "tiktok.com",
    tipo: "social"
  },
  {
    id: "youtube",
    nombre: "YouTube",
    dominio: "youtube.com",
    tipo: "video"
  },
  {
    id: "x",
    nombre: "X",
    dominio: "x.com",
    tipo: "social"
  },
  {
    id: "linkedin",
    nombre: "LinkedIn",
    dominio: "linkedin.com",
    tipo: "social"
  }
];


/*
-----------------------------------------------------------
NORMALIZAR TEXTO
-----------------------------------------------------------
*/

function normalizarTexto(texto = "") {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}


/*
-----------------------------------------------------------
NORMALIZAR OBJETIVO
-----------------------------------------------------------
*/

function normalizarObjetivo(objetivo = "") {
  const limpio = String(objetivo)
    .replace(/\s+/g, " ")
    .trim();

  return {
    original: limpio,
    normalizado: normalizarTexto(limpio),
    palabras: normalizarTexto(limpio)
      .split(" ")
      .filter((palabra) => palabra.length > 2)
  };
}


/*
-----------------------------------------------------------
DETECTAR PLATAFORMA
-----------------------------------------------------------
*/

function detectarPlataforma(texto = "", dominioEsperado = "") {
  const contenido = normalizarTexto(texto);

  if (
    dominioEsperado &&
    contenido.includes(dominioEsperado)
  ) {
    return true;
  }

  return false;
}


/*
-----------------------------------------------------------
CALCULAR COINCIDENCIA DE NOMBRE
-----------------------------------------------------------
*/

function calcularCoincidenciaNombre(
  objetivo,
  resultado
) {
  const texto = normalizarTexto(
    `${resultado.titulo || ""} ${resultado.descripcion || ""}`
  );

  if (!objetivo.normalizado) {
    return 0;
  }

  /*
    Coincidencia exacta del nombre completo
  */

  if (texto.includes(objetivo.normalizado)) {
    return 45;
  }

  /*
    Coincidencia por palabras
  */

  const coincidencias =
    objetivo.palabras.filter((palabra) =>
      texto.includes(palabra)
    ).length;

  if (coincidencias === 0) {
    return 0;
  }

  const porcentaje =
    coincidencias / objetivo.palabras.length;

  if (porcentaje >= 0.8) {
    return 35;
  }

  if (porcentaje >= 0.5) {
    return 22;
  }

  return 10;
}


/*
-----------------------------------------------------------
SEÑALES CONTEXTUALES
-----------------------------------------------------------
*/

function calcularSenalesContextuales(
  objetivo,
  resultado
) {
  const texto = normalizarTexto(
    `${resultado.titulo || ""} ${resultado.descripcion || ""}`
  );

  let puntos = 0;

  const señales = [];


  /*
    Nombre
  */

  const nombreScore =
    calcularCoincidenciaNombre(
      objetivo,
      resultado
    );

  if (nombreScore >= 45) {
    señales.push("Nombre completo coincidente");
  } else if (nombreScore >= 22) {
    señales.push("Coincidencia parcial del nombre");
  }


  /*
    Palabras de contexto profesional/público.
    
    No significan identidad por sí mismas.
    Solo sirven como señales adicionales.
  */

  const contextoPublico = [
    "presidente",
    "politico",
    "politica",
    "gobierno",
    "ecuador",
    "prefecto",
    "alcalde",
    "asambleista",
    "ministro",
    "candidato",
    "funcionario",
    "oficial"
  ];

  const contextosEncontrados =
    contextoPublico.filter((palabra) =>
      texto.includes(palabra)
    );

  if (contextosEncontrados.length > 0) {
    puntos += Math.min(
      contextosEncontrados.length * 5,
      15
    );

    señales.push(
      `Contexto público relacionado: ${contextosEncontrados
        .slice(0, 3)
        .join(", ")}`
    );
  }


  /*
    Ecuador como señal contextual.
  */

  if (texto.includes("ecuador")) {
    puntos += 5;
    señales.push("Referencia geográfica relacionada");
  }


  return {
    puntos,
    señales
  };
}


/*
-----------------------------------------------------------
CALCULAR CONFIANZA
-----------------------------------------------------------
*/

function calcularConfianza(
  objetivo,
  resultado,
  plataforma
) {
  let puntuacion = 0;

  const señales = [];


  /*
    1. Plataforma correcta
  */

  const textoResultado =
    `${resultado.titulo || ""} ${resultado.descripcion || ""} ${
      resultado.url || ""
    }`;

  if (
    detectarPlataforma(
      textoResultado,
      plataforma.dominio
    )
  ) {
    puntuacion += 25;
    señales.push(
      `Resultado localizado en ${plataforma.nombre}`
    );
  }


  /*
    2. Coincidencia de nombre
  */

  const nombreScore =
    calcularCoincidenciaNombre(
      objetivo,
      resultado
    );

  puntuacion += nombreScore;


  /*
    3. Contexto
  */

  const contexto =
    calcularSenalesContextuales(
      objetivo,
      resultado
    );

  puntuacion += contexto.puntos;
  señales.push(...contexto.señales);


  /*
    Limitar entre 0 y 100
  */

  puntuacion = Math.max(
    0,
    Math.min(100, puntuacion)
  );


  /*
    Clasificación
  */

  let nivel = "baja";

  if (puntuacion >= 80) {
    nivel = "alta";
  } else if (puntuacion >= 55) {
    nivel = "media";
  }


  return {
    puntuacion,
    nivel,
    señales
  };
}


/*
-----------------------------------------------------------
LIMPIAR RESULTADO
-----------------------------------------------------------
*/

function transformarResultado(
  resultado,
  objetivo,
  plataforma
) {
  const confianza =
    calcularConfianza(
      objetivo,
      resultado,
      plataforma
    );

  return {
    ...resultado,

    plataforma: plataforma.nombre,

    plataformaId: plataforma.id,

    tipoFuente: plataforma.tipo,

    confianza: confianza.puntuacion,

    nivelConfianza: confianza.nivel,

    señales: confianza.señales,

    candidato: true,

    objetivoInvestigado: objetivo.original
  };
}


/*
-----------------------------------------------------------
DEDUPLICAR
-----------------------------------------------------------
*/

function deduplicarResultados(resultados) {
  const mapa = new Map();

  for (const resultado of resultados) {
    const clave =
      resultado.url ||
      `${resultado.plataforma}-${resultado.titulo}`;

    if (!mapa.has(clave)) {
      mapa.set(clave, resultado);
      continue;
    }

    const anterior = mapa.get(clave);

    /*
      Si el mismo resultado aparece varias veces,
      conservamos la versión con mayor confianza.
    */

    if (
      Number(resultado.confianza || 0) >
      Number(anterior.confianza || 0)
    ) {
      mapa.set(clave, resultado);
    }
  }

  return [...mapa.values()];
}


/*
===========================================================
FUNCIÓN PRINCIPAL
===========================================================
*/

export async function descubrirRedesSociales(
  objetivo
) {
  const identidad =
    normalizarObjetivo(objetivo);

  const resultados = [];

  /*
    Ejecutamos búsquedas dirigidas por plataforma.
  */

  const consultas = PLATAFORMAS.map(
    async (plataforma) => {
      const consultasPlataforma = [
        `site:${plataforma.dominio} "${identidad.original}"`,
        `"${identidad.original}" ${plataforma.nombre}`,
        `"${identidad.original}" site:${plataforma.dominio}`
      ];

      const encontrados = [];

      for (const consulta of consultasPlataforma) {
        try {
          const respuesta =
            await buscarGoogle(consulta);

          if (
            respuesta &&
            Array.isArray(
              respuesta.resultados
            )
          ) {
            encontrados.push(
              ...respuesta.resultados
            );
          }
        } catch (error) {
          console.error(
            `Error buscando ${plataforma.nombre}:`,
            error.message
          );
        }
      }

      return {
        plataforma,
        encontrados
      };
    }
  );


  const respuestas =
    await Promise.all(consultas);


  /*
    Transformar resultados
  */

  for (const respuesta of respuestas) {
    for (const resultado of respuesta.encontrados) {
      resultados.push(
        transformarResultado(
          resultado,
          identidad,
          respuesta.plataforma
        )
      );
    }
  }


  /*
    Deduplicación
  */

  const unicos =
    deduplicarResultados(resultados);


  /*
    Ordenar de mayor a menor confianza
  */

  unicos.sort(
    (a, b) =>
      Number(b.confianza || 0) -
      Number(a.confianza || 0)
  );


  /*
    Resumen por plataforma
  */

  const resumen =
    PLATAFORMAS.map((plataforma) => {
      const encontrados =
        unicos.filter(
          (resultado) =>
            resultado.plataformaId ===
            plataforma.id
        );

      const mejor =
        encontrados.length > 0
          ? Math.max(
              ...encontrados.map(
                (resultado) =>
                  Number(
                    resultado.confianza || 0
                  )
              )
            )
          : 0;

      return {
        id: plataforma.id,

        nombre: plataforma.nombre,

        tipo: plataforma.tipo,

        encontrados:
          encontrados.length,

        mejorConfianza: mejor,

        estado:
          encontrados.length > 0
            ? "hallazgos"
            : "sin_hallazgos"
      };
    });


  return {
    objetivo: identidad.original,

    total: unicos.length,

    resultados: unicos,

    resumen
  };
}


/*
-----------------------------------------------------------
EXPORTAR PLATAFORMAS
-----------------------------------------------------------
*/

export { PLATAFORMAS };