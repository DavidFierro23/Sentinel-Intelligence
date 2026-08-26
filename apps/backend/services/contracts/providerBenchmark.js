// apps/backend/services/contracts/providerBenchmark.js

/*
===========================================================
DATA-PROVIDER-EVAL-01 — banco de pruebas, no catalogo
===========================================================

`futureLayers.js` declara los CRITERIOS DE ADMISION de un
proveedor: que se acepta y que se rechaza de plano. Este modulo
declara como se MIDE a los que pasan ese filtro.

Son cosas distintas y las dos hacen falta. Un proveedor puede
cumplir todos los criterios legales y aun asi no servir para
Cuenca, que es la pregunta que aqui se responde.

EL CASO DE PRUEBA ES SIEMPRE EL MISMO
-----------------------------------------------------------

Cuenca, Azuay. Mismo territorio, mismas consultas, misma
ventana. Sin caso fijo, comparar proveedores es comparar
anecdotas: uno se prueba un dia con noticia grande y otro un
domingo tranquilo, y gana el primero.

LA METRICA QUE DECIDE
-----------------------------------------------------------

No es «resultados devueltos». Un proveedor que devuelve 500
resultados de los que 480 son duplicados o hablan de Cuenca de
Espana es peor que uno que devuelve 40 utiles.

    COSTE POR EVIDENCIA UTIL

es la unica que integra volumen, calidad y precio. Y solo se
puede calcular si el coste se conoce: cuando no, sale null y el
proveedor NO se puede comparar por precio. Se dice, no se
estima.

NO SE COMPRA NADA
-----------------------------------------------------------

Este modulo no integra, no contrata y no recomienda. Define
como se mediria. Ejecutar el benchmark exige autorizacion
explicita y presupuesto declarado, porque probar un proveedor
de pago cuesta dinero real.
===========================================================
*/


export const CASO_DE_PRUEBA = Object.freeze({
  id: "BENCH-CUENCA-01",

  territorio: {
    unidadId: "ec-azuay-cuenca",
    nombre: "Cuenca",
    provincia: "Azuay",
    pais: "Ecuador"
  },

  /*
    Ancla obligatoria, igual que en produccion. Probar un
    proveedor con «Cuenca» a secas mide su capacidad de
    devolver Cuenca de España.
  */
  consultas: Object.freeze([
    "Cuenca Azuay",
    "Cuenca Ecuador",
    "Cuenca Azuay noticias",
    "Cuenca Azuay hoy"
  ]),

  ventana: "30d",
  idioma: "es",

  nota:
    "Mismo territorio, mismas consultas y misma ventana para todos los proveedores. Sin caso fijo, comparar proveedores es comparar anécdotas."
});


/*
-----------------------------------------------------------
METRICAS

`unidad` y `mejor` van declarados para que nadie tenga que
adivinar si mas es mejor. `duplicados` a la baja, `fuentesNuevas`
al alza.
-----------------------------------------------------------
*/

export const METRICAS_BENCHMARK = Object.freeze([
  { id: "consultasEjecutadas", unidad: "consultas", mejor: null },
  { id: "resultadosBrutos", unidad: "resultados", mejor: "alto" },
  { id: "resultadosUnicos", unidad: "resultados", mejor: "alto" },
  { id: "fuentesUnicas", unidad: "emisores", mejor: "alto" },

  {
    id: "fuentesNuevas",
    unidad: "emisores",
    mejor: "alto",
    nota:
      "Emisores que NINGÚN proveedor ya integrado había aportado. Es la métrica que justifica añadir un proveedor: uno que solo repite lo que ya se tiene no amplía la escucha."
  },

  {
    id: "relevanciaCuenca",
    unidad: "proporción",
    mejor: "alto",
    nota:
      "Resultados que hablan realmente de Cuenca, Azuay. Se mide contra el homónimo español, que es el fallo documentado."
  },

  { id: "duplicados", unidad: "proporción", mejor: "bajo" },
  { id: "errores", unidad: "proporción", mejor: "bajo" },
  { id: "latenciaMediana", unidad: "ms", mejor: "bajo" },

  {
    id: "costoTotal",
    unidad: "USD",
    mejor: "bajo",
    nota: "null si no se conoce. No se estima con precios de lista."
  },

  {
    id: "costoPorEvidenciaUtil",
    unidad: "USD/evidencia",
    mejor: "bajo",
    nota:
      "La métrica que decide. null si el coste es null: sin precio no hay comparación por precio."
  },

  { id: "coberturaHistorica", unidad: "días hacia atrás", mejor: "alto" },
  { id: "coberturaSocial", unidad: "plataformas", mejor: "alto" },
  { id: "coberturaNoticias", unidad: "booleano", mejor: "alto" },
  { id: "coberturaGeografica", unidad: "resolución mínima", mejor: "alto" },

  { id: "licencia", unidad: "texto", mejor: null },

  {
    id: "usoComercialPermitido",
    unidad: "booleano",
    mejor: "alto",
    nota:
      "null bloquea igual que false. Sentinel es un SaaS propietario: una licencia no-comercial es incompatible, como ya ocurre con el denominador poblacional del GAD."
  },

  { id: "api", unidad: "booleano", mejor: "alto" },

  {
    id: "trazabilidad",
    unidad: "booleano",
    mejor: "alto",
    nota:
      "¿Se puede llegar del dato al documento original? Sin esto, la evidencia no es auditable y no entra en un informe."
  }
]);


/*
===========================================================
FICHA VACIA

Todo a null. Un benchmark sin ejecutar tiene que ser
distinguible de uno ejecutado con resultado cero, y con ceros
no se distingue.
===========================================================
*/

export function fichaBenchmark(providerId, nombre) {
  const metricas = {};

  METRICAS_BENCHMARK.forEach((m) => {
    metricas[m.id] = null;
  });

  return {
    provider: providerId,
    nombre: nombre || providerId,
    caso: CASO_DE_PRUEBA.id,

    ejecutado: false,
    ejecutadoEn: null,
    autorizadoPor: null,

    metricas,

    veredicto: null,

    declaracion:
      "Ficha sin ejecutar. Todas las métricas en null: un benchmark no ejecutado no es un benchmark con resultado cero."
  };
}


/*
-----------------------------------------------------------
COSTE POR EVIDENCIA UTIL

Se calcula aparte para que la propagacion del null sea visible
y comprobable, no un efecto lateral de una division.
-----------------------------------------------------------
*/

export function costoPorEvidenciaUtil({ costoTotal, resultadosUnicos, relevanciaCuenca }) {
  if (costoTotal === null || costoTotal === undefined) {
    return {
      valor: null,
      motivo:
        "El coste total no se conoce. Sin precio no hay comparación por precio: no se estima."
    };
  }

  if (!resultadosUnicos || relevanciaCuenca === null || relevanciaCuenca === undefined) {
    return {
      valor: null,
      motivo: "Faltan resultados únicos o relevancia medida."
    };
  }

  const utiles = resultadosUnicos * relevanciaCuenca;

  if (utiles <= 0) {
    return {
      valor: null,
      motivo:
        "Cero evidencias útiles. El coste por evidencia útil no es infinito ni cero: no está definido."
    };
  }

  return { valor: Number((costoTotal / utiles).toFixed(4)), motivo: null };
}


/*
===========================================================
CANDIDATOS A EVALUAR

Lista TECNICA, no de compra. Ninguno esta contratado, ninguno
esta integrado y de ninguno se afirma que funcione bien en
Ecuador: eso es precisamente lo que el benchmark tendria que
demostrar.

`accesoRequiere` no es un detalle administrativo. Varias de
estas plataformas solo dan acceso a datos por API oficial con
aprobacion; sin ella, la alternativa seria raspado, que esta
prohibido y ademas rompe sus condiciones de uso.
===========================================================
*/

export const CANDIDATOS = Object.freeze([
  /* --- Buscadores web --- */
  {
    categoria: "BUSCADOR_WEB",
    id: "serpapi",
    nombre: "SerpAPI",
    estado: "INTEGRADO",
    accesoRequiere: "credencial de pago (ya contratada, plan Starter)",
    incognita: "Coste unitario no consta en el repositorio."
  },
  {
    categoria: "BUSCADOR_WEB",
    id: "brave_search",
    nombre: "Brave Search API",
    estado: "IMPLEMENTADO_SIN_CREDENCIAL",
    accesoRequiere: "BRAVE_API_KEY",
    incognita: "Cobertura real de medios ecuatorianos sin medir."
  },
  {
    categoria: "BUSCADOR_WEB",
    id: "otros_buscadores",
    nombre: "Otros buscadores con API compatible",
    estado: "NO_EVALUADO",
    accesoRequiere: "por determinar",
    incognita:
      "El registro admite un proveedor nuevo escribiendo su módulo; el trabajo real es demostrar que aporta emisores que los actuales no traen."
  },

  /* --- Noticias y eventos --- */
  {
    categoria: "NOTICIAS",
    id: "google_news_rss",
    nombre: "Google News RSS",
    estado: "INTEGRADO",
    accesoRequiere: "nada, es público",
    incognita:
      "Ventana móvil sin archivo. Es la limitación que obliga a acumular snapshots."
  },
  {
    categoria: "NOTICIAS",
    id: "gdelt",
    nombre: "GDELT",
    estado: "NO_EVALUADO",
    accesoRequiere: "API pública",
    incognita:
      "Tiene archivo histórico, que es justo lo que falta. Por medir: cobertura real de prensa local ecuatoriana, que suele ser floja en agregadores globales."
  },
  {
    categoria: "NOTICIAS",
    id: "rss_directos",
    nombre: "RSS y feeds directos de medios locales",
    estado: "NO_EVALUADO",
    accesoRequiere: "nada, son públicos",
    incognita:
      "La opción más barata y la que más elevaría la diversidad: leer El Mercurio directamente resuelve el publicador sin rescatarlo del titular. Trabajo: mantener la lista de feeds."
  },
  {
    categoria: "NOTICIAS",
    id: "media_intelligence_comercial",
    nombre: "Proveedores comerciales de media intelligence",
    estado: "NO_EVALUADO",
    accesoRequiere: "contrato",
    incognita: "Licencia comercial y cobertura de Ecuador."
  },

  /* --- Plataformas --- */
  {
    categoria: "PLATAFORMA",
    id: "youtube",
    nombre: "YouTube Data API",
    estado: "NO_EVALUADO",
    accesoRequiere: "clave de API de Google",
    incognita:
      "El 40 % del corpus real llegó por YouTube sin emisor identificado. Es el hueco de identificación más grande que hay hoy."
  },
  {
    categoria: "PLATAFORMA",
    id: "meta",
    nombre: "Facebook / Instagram",
    estado: "NO_EVALUADO",
    accesoRequiere: "acceso autorizado por Meta; contenido público únicamente",
    incognita: "Sin acceso oficial la alternativa sería raspado, que está prohibido."
  },
  {
    categoria: "PLATAFORMA",
    id: "tiktok",
    nombre: "TikTok",
    estado: "NO_EVALUADO",
    accesoRequiere: "API de investigación o proveedor con licencia",
    incognita: "Disponibilidad del acceso en Ecuador."
  },
  {
    categoria: "PLATAFORMA",
    id: "x",
    nombre: "X",
    estado: "NO_EVALUADO",
    accesoRequiere: "API de pago",
    incognita: "Coste frente a volumen real de conversación local sobre Cuenca."
  },
  {
    categoria: "PLATAFORMA",
    id: "linkedin",
    nombre: "LinkedIn",
    estado: "NO_EVALUADO",
    accesoRequiere: "acceso autorizado",
    incognita: "Relevancia baja a priori para conversación territorial."
  },

  /* --- Creadores --- */
  {
    categoria: "CREADORES",
    id: "creator_discovery",
    nombre: "Proveedores de discovery de creadores",
    estado: "NO_EVALUADO",
    accesoRequiere: "contrato",
    incognita:
      "Suelen clasificar por número de seguidores. Sentinel no clasifica por audiencia: haría falta que expusieran evidencia observable, no rankings."
  }
]);


export function estadoBenchmark() {
  const porCategoria = {};

  CANDIDATOS.forEach((c) => {
    porCategoria[c.categoria] = (porCategoria[c.categoria] || 0) + 1;
  });

  return {
    id: "DATA-PROVIDER-EVAL-01",
    estado: "ESTRUCTURA DEFINIDA — ninguna ficha ejecutada",

    caso: CASO_DE_PRUEBA,
    metricas: METRICAS_BENCHMARK.map((m) => m.id),

    candidatos: CANDIDATOS.length,
    porCategoria,

    integrados: CANDIDATOS.filter((c) => c.estado === "INTEGRADO").length,
    noEvaluados: CANDIDATOS.filter((c) => c.estado === "NO_EVALUADO").length,

    fichas: CANDIDATOS.map((c) => fichaBenchmark(c.id, c.nombre)),

    declaraciones: [
      "Ninguna ficha está ejecutada. Todas las métricas son null, que no es lo mismo que cero.",
      "No se contrata, no se integra y no se recomienda ningún proveedor. Este módulo define cómo se mediría.",
      "Ejecutar el benchmark contra un proveedor de pago cuesta dinero real y exige autorización explícita con presupuesto declarado.",
      "No se asume que un proveedor funcione bien en Ecuador por funcionar bien en otros mercados. Es lo primero que el benchmark tendría que demostrar."
    ]
  };
}


export default {
  CASO_DE_PRUEBA,
  METRICAS_BENCHMARK,
  CANDIDATOS,
  fichaBenchmark,
  costoPorEvidenciaUtil,
  estadoBenchmark
};
