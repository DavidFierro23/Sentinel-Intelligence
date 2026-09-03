// apps/backend/services/territorial/searchIntelligence.js

/*
===========================================================
SEARCH INTELLIGENCE — FAMILIA SEPARADA
TERRITORIAL-COLLECTOR-EXPANSION-01
===========================================================

TRES SENALES QUE NO SON LA MISMA
-----------------------------------------------------------

    SOCIAL_CONVERSATION   lo que la gente publica
    MEDIA_AGENDA          lo que los medios cubren
    SEARCH_INTEREST       lo que se busca

Mezclarlas produce afirmaciones que ninguna de las tres
sostiene. Por eso esta familia vive aparte y sus piezas
declaran `familia: SEARCH_INTELLIGENCE`: para que un agregado
no las sume con tuits ni con notas de prensa.

QUE APORTA Y QUE NO
-----------------------------------------------------------

SerpAPI, Brave y DuckDuckGo ya estaban configurados y en el
registro de proveedores —SerpAPI con prioridad 1— y Territorial
NO los llamaba nunca: `PRESUPUESTO_POR_PASADA` del colector
solo contemplaba rss, gdelt, x y youtube. Esa fue la
ampliacion mas barata del gate: infraestructura pagada y sin
usar.

Lo que aporta un motor de busqueda es DESCUBRIMIENTO: dominios,
medios y entidades que no estaban en el universo de fuentes.

Lo que NO aporta:

    VOLUMEN DE BUSQUEDAS. Un motor devuelve resultados, no
    cuanta gente busco algo. Aqui no hay Google Trends ni una
    via legitima equivalente, asi que no se emite ninguna
    cifra de interes de busqueda y `searchInterest` queda
    declarado como NO_DISPONIBLE. Llamar «tendencia de Google»
    a un recuento de resultados seria inventarse el dato.

    FECHA FIABLE. Un resultado de busqueda no es una
    publicacion: casi nunca trae `publishedAt`. Se mide cuantos
    lo traen y se dice.

PROCEDENCIA DE CONSULTA
-----------------------------------------------------------

Cada pieza registra la consulta que la trajo. Y —regla que
este proyecto ya aprendio por las malas— **la consulta no es
prueba de territorio**: viaja en `queryProvenance`, nunca en
las senales territoriales.
===========================================================
*/

import { listarProveedores, cadenaDeIntentos } from "../providers/providerRegistry.js";


export const TIPOS_DE_SENAL = Object.freeze({
  SOCIAL_CONVERSATION: "SOCIAL_CONVERSATION",
  MEDIA_AGENDA: "MEDIA_AGENDA",
  SEARCH_INTEREST: "SEARCH_INTEREST",

  /*
    Lo que de verdad devuelve un motor: resultados indexados.
    No es SEARCH_INTEREST y la distincion importa.
  */
  SEARCH_RESULT: "SEARCH_RESULT"
});


export const DISPONIBILIDAD_SEARCH_INTEREST = Object.freeze({
  estado: "NO_DISPONIBLE",
  motivo:
    "No hay adaptador ni credencial de una fuente legítima de volumen de búsquedas. Un recuento de resultados no es interés de búsqueda.",
  loQueNoSePuedeAfirmar: [
    "cuánta gente buscó un término en Cuenca",
    "tendencia de búsquedas",
    "crecimiento del interés",
    "«lo más buscado en Cuenca»"
  ]
});


/*
===========================================================
SEMILLAS DE DESCUBRIMIENTO

Familias neutrales, NO temas del producto.

Existen para que el descubrimiento no dependa de la palabra
«Cuenca» a secas —que es ambigua y ya provoco 13 falsos
positivos medidos— y para no predefinir de que se habla en la
ciudad. Open Topic Discovery, cuando llegue, tiene que poder
encontrar temas que no esten en esta lista.
===========================================================
*/

export const SEMILLAS = Object.freeze([
  { id: "actualidad", texto: "noticias Cuenca Azuay Ecuador", familia: "ciudad" },
  { id: "movilidad", texto: "tranvía Cuenca Ecuador movilidad", familia: "servicios" },
  { id: "servicios", texto: "ETAPA EP agua potable Cuenca Ecuador", familia: "servicios" },
  { id: "instituciones", texto: "Municipio de Cuenca Azuay ordenanza", familia: "instituciones" },
  { id: "cultura", texto: "cultura Cuenca Azuay agenda cultural", familia: "cultura" },
  { id: "universidad", texto: "Universidad de Cuenca Azuay investigación", familia: "universidad" },
  { id: "deporte", texto: "Deportivo Cuenca Azuay fútbol", familia: "deporte" },
  { id: "economia", texto: "comercio economía Cuenca Azuay Ecuador", familia: "economia" },
  { id: "ciudadania", texto: "ciudadanía Cuenca Azuay participación", familia: "ciudadania" }
]);


/* Solo las familias de descubrimiento, sin inventar cuáles «son» los temas de Cuenca. */
export function semillasPara(familias = null) {
  if (!familias) return SEMILLAS;

  return SEMILLAS.filter((s) => familias.includes(s.familia) || familias.includes(s.id));
}


/*
===========================================================
NORMALIZAR UN RESULTADO DE BUSQUEDA A EVIDENCIA
===========================================================

Un resultado de busqueda no es una publicacion. Se normaliza a
la forma de evidencia del proyecto DECLARANDO lo que no trae,
en lugar de rellenarlo:

  publishedAt   null si el motor no lo da. Nunca la fecha de hoy.
  author        null. Un resultado no tiene firma.
  summary       el snippet, que es lo que hay.
===========================================================
*/

export function normalizarResultadoDeBusqueda(r = {}, contexto = {}) {
  const url = r.url || r.link || r.enlace || null;

  let dominio = null;

  if (url) {
    try {
      dominio = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      dominio = null;
    }
  }

  return {
    /* Identidad estable: la URL canónica es lo único fiable aquí. */
    canonicalUrl: url,
    evidenceId: url ? `search:${url}` : null,

    title: r.title || r.titulo || "",
    summary: r.snippet || r.descripcion || r.description || "",

    /*
      El motor casi nunca declara fecha de publicación. Se deja
      en null: una fecha inventada contamina cualquier ventana
      temporal y es indetectable después.
    */
    publishedAt: r.publishedAt || r.fecha || null,

    domain: dominio,
    sourceId: dominio ? `web:${dominio}` : null,
    publisher: r.fuente || r.source || dominio || null,
    author: null,

    familia: "SEARCH_INTELLIGENCE",
    tipoDeSenal: TIPOS_DE_SENAL.SEARCH_RESULT,

    providers: [contexto.collector || "search"],
    providerId: contexto.collector || "search",

    /*
      Procedencia de la consulta. Se registra para poder
      auditar de dónde salió cada pieza, y queda FUERA de las
      señales territoriales.
    */
    provenance: {
      providerId: contexto.collector || null,
      query: contexto.query || null,
      queryLabel: contexto.queryLabel || null,
      queryFamily: contexto.familia || null,
      observedAt: contexto.observedAt || new Date().toISOString(),
      posicionEnResultados: r.posicion ?? r.position ?? null,
      avisoTerritorial:
        "La consulta que trajo esta pieza NO es evidencia de su territorio."
    },

    territoryId: null,

    declaraciones: [
      r.publishedAt || r.fecha
        ? null
        : "El motor no declaró fecha de publicación. No se le asigna ninguna."
    ].filter(Boolean)
  };
}


/*
===========================================================
DESCUBRIMIENTO POR BUSQUEDA
===========================================================

Se apoya en la cadena de proveedores que ya existe —SerpAPI,
Brave, DuckDuckGo por prioridad y salud— en lugar de elegir
uno a mano. Si el principal falla, la cadena degrada, y eso se
reporta como degradacion y no como ausencia de resultados.
===========================================================
*/

export const PRESUPUESTO_BUSQUEDA = Object.freeze({
  /* Consultas por pasada, no por proveedor: el tope es del gate. */
  consultasPorPasada: 6,
  resultadosPorConsulta: 10
});


export function proveedoresDeBusquedaDisponibles() {
  const cadena = cadenaDeIntentos();

  return {
    utilizables: (cadena.utilizables || []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      prioridad: p.prioridad,
      presupuesto: p.presupuesto,
      intervaloMs: p.intervaloMs
    })),
    descartados: cadena.descartados || [],
    registrados: listarProveedores().length
  };
}


export async function descubrirPorBusqueda({
  semillas = SEMILLAS,
  maximoConsultas = PRESUPUESTO_BUSQUEDA.consultasPorPasada,
  resultadosPorConsulta = PRESUPUESTO_BUSQUEDA.resultadosPorConsulta,
  buscar = null,
  observedAt = new Date().toISOString()
} = {}) {
  if (typeof buscar !== "function") {
    throw new Error(
      "descubrirPorBusqueda requiere `buscar`: la función que llama al proveedor. Se inyecta para que este módulo sea probable sin red."
    );
  }

  const elegidas = semillas.slice(0, maximoConsultas);

  const intentos = [];

  const evidencias = [];

  for (const s of elegidas) {
    let r = null;

    try {
      r = await buscar({ query: s.texto, maximo: resultadosPorConsulta });
    } catch (e) {
      /*
        Un fallo del proveedor NO es «no hay resultados». Se
        distingue explícitamente: es la diferencia entre
        «se preguntó y está vacío» y «no se pudo preguntar».
      */
      intentos.push({
        queryLabel: `search:${s.id}`,
        query: s.texto,
        estado: "ERROR_PROVEEDOR",
        collector: null,
        resultados: 0,
        detalle: String(e?.message || e).slice(0, 200)
      });
      continue;
    }

    const resultados = r?.resultados || r?.results || [];

    intentos.push({
      queryLabel: `search:${s.id}`,
      query: s.texto,
      familia: s.familia,
      collector: r?.providerId || r?.collector || null,
      estado: resultados.length === 0 ? "SIN_RESULTADOS" : "OK",
      resultados: resultados.length,
      degradado: Boolean(r?.degradado),
      proveedorUsado: r?.providerId || null
    });

    resultados.forEach((res, i) =>
      evidencias.push(
        normalizarResultadoDeBusqueda(
          { ...res, posicion: res.posicion ?? i + 1 },
          {
            collector: r?.providerId || "search",
            query: s.texto,
            queryLabel: `search:${s.id}`,
            familia: s.familia,
            observedAt
          }
        )
      )
    );
  }

  /* Dedup por URL: dos consultas pueden traer el mismo enlace. */
  const porUrl = new Map();

  evidencias.forEach((e) => {
    if (!e.canonicalUrl) return;

    if (!porUrl.has(e.canonicalUrl)) {
      porUrl.set(e.canonicalUrl, e);
      return;
    }

    /* Se conserva la procedencia múltiple en lugar de descartarla. */
    const ya = porUrl.get(e.canonicalUrl);

    ya.provenanceAdicional = ya.provenanceAdicional || [];
    ya.provenanceAdicional.push(e.provenance);
  });

  const unicas = [...porUrl.values()];

  const dominios = new Set(unicas.map((e) => e.domain).filter(Boolean));

  return {
    consultas: intentos,
    consultasEjecutadas: intentos.length,
    evidencias: unicas,

    observadas: evidencias.length,
    unicas: unicas.length,
    duplicadas: evidencias.length - unicas.length,

    dominiosDescubiertos: [...dominios],

    searchInterest: DISPONIBILIDAD_SEARCH_INTEREST,

    declaraciones: [
      "Esta familia mide DESCUBRIMIENTO por búsqueda, no interés de búsqueda.",
      "SEARCH_RESULT no se suma con SOCIAL_CONVERSATION ni con MEDIA_AGENDA.",
      "Un resultado sin fecha declarada no entra en ninguna ventana temporal.",
      "La consulta que trajo una pieza no es evidencia de su territorio."
    ]
  };
}


/*
  Dominios descubiertos que NO estan en el universo de fuentes.
  Es la salida util de esta familia: candidatos a fuente, para
  que una persona los verifique.
*/
export function candidatosDeFuente(evidencias = [], dominiosConocidos = new Set()) {
  const cuenta = new Map();

  evidencias.forEach((e) => {
    if (!e.domain || dominiosConocidos.has(e.domain)) return;

    cuenta.set(e.domain, (cuenta.get(e.domain) || 0) + 1);
  });

  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([dominio, veces]) => ({
      dominio,
      apariciones: veces,
      estado: "DESCUBIERTO_POR_BUSQUEDA",
      /* Nada se promueve solo. */
      requiereVerificacion: true,
      nota: "Aparecer en una búsqueda no lo convierte en fuente local. Exige verificación HTTP y territorio declarado."
    }));
}


export default {
  TIPOS_DE_SENAL,
  DISPONIBILIDAD_SEARCH_INTEREST,
  SEMILLAS,
  PRESUPUESTO_BUSQUEDA,
  semillasPara,
  normalizarResultadoDeBusqueda,
  proveedoresDeBusquedaDisponibles,
  descubrirPorBusqueda,
  candidatosDeFuente
};
