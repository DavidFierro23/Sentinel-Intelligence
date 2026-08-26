// apps/backend/services/contracts/ingestBenchmark.js

/*
===========================================================
BENCHMARK ANTES / DESPUES — INGEST-REAL-01
===========================================================

Que cambio al pasar de un proveedor productivo a seis.

LA LINEA BASE ESTA MEDIDA, NO ESTIMADA
-----------------------------------------------------------

El «antes» de esta comparacion no es una suposicion: es el
corpus real capturado el 2026-08-25, con sus 30 evidencias, sus
6 emisores y su plataforma sin identificar. Esta guardado en
`apps/web/tests/payload-real.json`.

Eso importa. Un benchmark cuyo punto de partida se recuerda de
memoria mide lo que uno quiere que haya mejorado.

LA METRICA QUE DECIDE NO ES EL VOLUMEN
-----------------------------------------------------------

Duplicar las evidencias no prueba nada por si solo: si las 30
nuevas son las mismas 30 vistas por otro proveedor, el corpus
no ha crecido, solo se ha contado dos veces. Por eso el «antes»
y el «despues» se comparan sobre EVIDENCIAS UNICAS y sobre
EMISORES IDENTIFICADOS.

Y hay una metrica que puede empeorar y estaria bien:
`tasaDuplicado`. Con seis proveedores va a subir, y eso no es
un fallo: significa que se estan corroborando notas que antes
solo tenia uno.

NO SE EJECUTA SIN CREDENCIALES
-----------------------------------------------------------

Faltan BRAVE_API_KEY y YOUTUBE_API_KEY. Ejecutar el «despues»
sin ellas mediria el stack a medias y produciria una
comparacion que despues habria que repetir.
===========================================================
*/


/*
-----------------------------------------------------------
LINEA BASE — medida el 2026-08-25

Cifras del corpus real, no de un fixture.
-----------------------------------------------------------
*/

export const LINEA_BASE = Object.freeze({
  id: "BASE-CUENCA-2026-08-25",

  origen: "apps/web/tests/payload-real.json",

  capturadoEn: "2026-08-25",

  contexto:
    "Modo `noticias`, coste 0. Cuatro consultas fijas, de las cuales dos con vocabulario de gestión pública.",

  proveedoresEjecutados: 1,
  proveedoresDeclarados: 6,

  consultas: 4,

  evidenciasBrutas: 32,
  evidenciasUnicas: 30,

  /*
    7 «fuentes» contadas entonces = 6 emisores + 1 plataforma.
    La distincion es la correccion que trajo D2.
  */
  fuentesTotales: 7,
  emisoresIdentificados: 6,
  plataformasSinResolver: 1,
  evidenciasSinEmisorIdentificado: 12,

  medios: 6,
  instituciones: 0,
  creadoresOComunidades: 0,

  territoriosConEvidencia: 3,

  agendas: Object.freeze({
    mediatica: 18,
    digital: 12,
    institucional: 0,
    ciudadana: 0,
    creadores: 0
  }),

  duplicados: 2,

  costo: 0,

  limitacionPrincipal:
    "El 40 % del corpus llegaba por YouTube sin saber quién publicaba, y tres de las cinco agendas estaban a cero."
});


/*
-----------------------------------------------------------
METRICAS DE LA COMPARACION

`mejor` dice hacia donde deberia moverse cada una. Sin eso,
una tabla de antes/despues invita a leer cualquier cambio como
mejora.
-----------------------------------------------------------
*/

export const METRICAS_COMPARACION = Object.freeze([
  { id: "proveedoresEjecutados", mejor: "alto" },
  { id: "consultas", mejor: null },

  {
    id: "evidenciasBrutas",
    mejor: null,
    nota:
      "Por sí sola no dice nada: seis proveedores trayendo las mismas notas la suben sin que el corpus crezca."
  },

  { id: "evidenciasUnicas", mejor: "alto", nota: "La que cuenta para volumen." },

  {
    id: "emisoresIdentificados",
    mejor: "alto",
    nota:
      "La que cuenta para diversidad. Un emisor nuevo aporta un punto de vista; una evidencia más de un emisor conocido, no."
  },

  {
    id: "evidenciasSinEmisorIdentificado",
    mejor: "bajo",
    nota: "Era 12 de 30. Es el hueco que YouTube Data API existe para cerrar."
  },

  { id: "medios", mejor: "alto" },
  { id: "instituciones", mejor: "alto" },
  { id: "creadoresOComunidades", mejor: "alto" },
  { id: "territoriosConEvidencia", mejor: "alto" },

  {
    id: "duplicados",
    mejor: null,
    nota:
      "Va a subir, y está bien: un duplicado entre proveedores es una nota corroborada, no ruido. Lo que no puede subir es la proporción de duplicados DENTRO de un mismo proveedor."
  },

  {
    id: "agendasConCobertura",
    mejor: "alto",
    nota: "Eran 2 de 5. Es el objetivo real del gate."
  },

  {
    id: "costo",
    mejor: "bajo",
    nota: "null si algún proveedor no declara el suyo. No se estima."
  }
]);


export function fichaComparacion() {
  const despues = {};

  METRICAS_COMPARACION.forEach((m) => {
    despues[m.id] = null;
  });

  return {
    id: "BENCH-ANTES-DESPUES-01",

    lineaBase: LINEA_BASE,

    despues,

    ejecutado: false,
    ejecutadoEn: null,
    autorizadoPor: null,

    bloqueadoPor: [
      "BRAVE_API_KEY no configurada",
      "YOUTUBE_API_KEY no configurada"
    ],

    declaracion:
      "El «después» está sin medir: todas las métricas en null. Ejecutarlo sin las credenciales mediría el stack a medias y habría que repetirlo."
  };
}


/*
-----------------------------------------------------------
COMPARAR

Devuelve delta por metrica CON su direccion deseada, para que
el consumidor no tenga que recordar cual es cual.
-----------------------------------------------------------
*/

export function comparar(despues = {}) {
  const filas = METRICAS_COMPARACION.map((m) => {
    const antes = LINEA_BASE[m.id] ?? null;

    const ahora = despues[m.id] ?? null;

    const delta =
      typeof antes === "number" && typeof ahora === "number" ? ahora - antes : null;

    return {
      metrica: m.id,
      antes,
      despues: ahora,
      delta,

      direccionDeseada: m.mejor,

      mejora:
        delta === null || m.mejor === null
          ? null
          : m.mejor === "alto"
            ? delta > 0
            : delta < 0,

      nota: m.nota || null
    };
  });

  const medidas = filas.filter((f) => f.delta !== null);

  return {
    filas,

    resumen: {
      metricas: filas.length,
      medidas: medidas.length,
      sinMedir: filas.length - medidas.length,

      mejoraron: medidas.filter((f) => f.mejora === true).length,
      empeoraron: medidas.filter((f) => f.mejora === false).length
    },

    declaracion:
      medidas.length === 0
        ? "Ninguna métrica medida. La comparación no se ha ejecutado."
        : "Comparación sobre evidencias ÚNICAS y emisores IDENTIFICADOS. El volumen bruto no prueba nada por sí solo."
  };
}


export default {
  LINEA_BASE,
  METRICAS_COMPARACION,
  fichaComparacion,
  comparar
};
