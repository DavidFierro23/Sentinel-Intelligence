// apps/backend/services/ingest/adapters/gdeltAdapter.js

import { normalizarEvidencia, TIPOS_CONTENIDO, POLITICAS_ALMACENAMIENTO } from "../evidenceContract.js";
import { extraerDominio } from "../../textUtils.js";

/*
===========================================================
GDELT DOC 2.0 — INGEST-REAL-01
===========================================================

AUDITORIA TECNICA, ANTES DE DECIDIR
-----------------------------------------------------------

QUE APORTARIA QUE HOY NO SE TIENE

  ARCHIVO HISTORICO. Es lo unico que ningun proveedor actual
  da. Google News tiene una ventana movil de semanas; GDELT
  indexa desde 2017 y permite consultar rangos cerrados.

  Eso importa mucho aqui: la ventana anterior de Cuenca no se
  puede recuperar y por eso los snapshots se acumulan desde
  cero. Si GDELT cubriera prensa cuencana, E1 podria tener
  historico REAL en lugar de esperar semanas.

QUE NO SE SABE, Y ES LO QUE DECIDE

  Si cubre prensa LOCAL de Azuay. Los agregadores globales
  suelen indexar bien medios nacionales y mal medios de
  provincia, y El Mercurio de Cuenca es exactamente el tipo de
  medio que se les escapa.

  NO se asume. La ficha de benchmark existe para medirlo.

POR QUE SE IMPLEMENTA EL ADAPTER PESE A LA DUDA
-----------------------------------------------------------

Tres razones concretas:

  1. La API DOC 2.0 es publica y no exige credencial ni
     contrato. La deuda de integrarla es baja.
  2. Sin adapter no hay forma de medir la duda. Dejar solo el
     contrato aplazaria la pregunta indefinidamente.
  3. Devuelve `domain` y `sourcecountry` en cada resultado, asi
     que el propio adapter puede medir su cobertura local sin
     trabajo adicional.

Si el benchmark demuestra que no cubre Azuay, el adapter se
desactiva y la ficha queda como prueba de que se comprobo.
Coste de haberlo intentado: este fichero.

CONDICIONES DE USO
-----------------------------------------------------------

GDELT indexa titulares y METADATOS de articulos de terceros;
no redistribuye el texto. Por eso la politica de
almacenamiento es SOLO_REFERENCIA y no EXTRACTO: el enlace y
el titular son la cita, y el articulo pertenece al medio.
===========================================================
*/


export const ID = "gdelt_doc";

export const NOMBRE = "GDELT DOC 2.0";

export const TIPO = "noticias";

export const PRIORIDAD = 5;

const ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";

const TIEMPO_MAXIMO_MS = 15000;


/*
-----------------------------------------------------------
FECHA DE GDELT

Formato `20260825T143000Z`, sin guiones ni dos puntos. Hay que
convertirlo a ISO o toda comparacion temporal falla en
silencio.
-----------------------------------------------------------
*/

export function fechaGdeltAIso(valor) {
  const s = String(valor || "").trim();

  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);

  if (!m) return null;

  const [, a, me, d, h, mi, se] = m;

  const iso = `${a}-${me}-${d}T${h}:${mi}:${se}Z`;

  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}


export function isoAFechaGdelt(iso) {
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}


export function normalizarArticulo(item, contexto = {}) {
  const url = item?.url || null;

  if (!url) return null;

  const bruto = {
    url,
    title: item?.title || "",

    /*
      GDELT no devuelve extracto. Solo titular, dominio, idioma
      y fecha. Es una limitacion real y hay que declararla: un
      corpus de GDELT tiene menos texto sobre el que el motor
      de temas pueda trabajar.
    */
    snippet: null,

    publishedAt: fechaGdeltAIso(item?.seendate),

    /*
      `domain` identifica al medio directamente. A diferencia
      de Google News, aqui el publicador NO hay que rescatarlo
      del titular.
    */
    publisher: item?.domain || null,
    sourceId: item?.domain || extraerDominio(url) || null,

    language: item?.language || null,

    contentType: TIPOS_CONTENIDO.NOTICIA
  };

  const ev = normalizarEvidencia(bruto, {
    providerId: ID,
    query: contexto.query || null,
    queryType: contexto.queryType || null,
    queryLabel: contexto.queryLabel || null,
    observedAt: contexto.observedAt || null,
    contentType: TIPOS_CONTENIDO.NOTICIA,

    /*
      SOLO_REFERENCIA: GDELT indexa metadatos de articulos
      ajenos, no los redistribuye. El titular y el enlace son
      la cita; el texto es del medio.
    */
    politicaAlmacenamiento: POLITICAS_ALMACENAMIENTO.SOLO_REFERENCIA,

    conservarBruto: contexto.conservarBruto === true
  });

  ev.gdelt = {
    domain: item?.domain || null,

    /*
      Pais de la FUENTE, no del hecho. Un medio ecuatoriano
      escribiendo sobre Cuenca de España sigue siendo
      sourcecountry=Ecuador. No sustituye a GEO-1.
    */
    sourceCountry: item?.sourcecountry || null,

    seendate: item?.seendate || null,
    socialImage: item?.socialimage || null
  };

  ev.territoryHints = [];

  return ev;
}


export async function buscar(consulta, opciones = {}) {
  const inicio = Date.now();

  const fetchImpl = opciones.fetch || globalThis.fetch;

  const params = new URLSearchParams({
    query: `${consulta} sourcelang:spanish`,
    mode: "ArtList",
    format: "json",
    maxrecords: String(Math.min(opciones.maximo || 50, 250)),
    sort: opciones.orden || "datedesc"
  });

  if (opciones.desde) {
    const d = isoAFechaGdelt(opciones.desde);

    if (d) params.set("startdatetime", d);
  }

  if (opciones.hasta) {
    const h = isoAFechaGdelt(opciones.hasta);

    if (h) params.set("enddatetime", h);
  }

  let temporizador;

  try {
    const controlador = new AbortController();

    temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);

    const respuesta = await fetchImpl(`${ENDPOINT}?${params}`, {
      signal: controlador.signal,
      headers: {
        "user-agent": "SentinelIntelligence/1.0 (evaluación de cobertura territorial)"
      }
    });

    clearTimeout(temporizador);

    if (!respuesta.ok) {
      return {
        estado: respuesta.status === 429 ? "LIMITE_DE_TASA" : "ERROR",
        evidencias: [],
        recibidas: 0,
        latenciaMs: Date.now() - inicio,
        motivo: `HTTP ${respuesta.status}`
      };
    }

    const texto = await respuesta.text();

    /*
      GDELT devuelve HTML de error con status 200 cuando la
      consulta no le gusta. Sin esta comprobacion, un error de
      sintaxis se leeria como «cero resultados», que es
      justamente la confusion que el Search Provider Layer
      existe para evitar.
    */
    let datos;

    try {
      datos = JSON.parse(texto);
    } catch {
      return {
        estado: "RESPUESTA_NO_JSON",
        evidencias: [],
        recibidas: 0,
        latenciaMs: Date.now() - inicio,

        motivo:
          "GDELT respondió 200 con contenido no-JSON, que es como señala una consulta mal formada. NO es «cero resultados».",

        muestra: texto.slice(0, 160)
      };
    }

    const items = datos?.articles || [];

    const evidencias = items
      .map((i) =>
        normalizarArticulo(i, {
          query: consulta,
          queryType: opciones.queryType || null,
          queryLabel: opciones.queryLabel || null,
          observedAt: opciones.observedAt || null,
          conservarBruto: opciones.conservarBruto === true
        })
      )
      .filter(Boolean);

    /*
      COBERTURA LOCAL, medida sobre la marcha.

      Es la pregunta que decide si GDELT sirve aqui, y el
      propio adapter puede responderla sin trabajo extra
      porque GDELT devuelve el dominio de cada resultado.
    */
    const dominios = evidencias.map((e) => e.sourceId).filter(Boolean);

    const locales = opciones.dominiosLocales || [];

    const deMedioLocal = dominios.filter((d) =>
      locales.some((l) => d === l || d.endsWith(`.${l}`))
    ).length;

    return {
      estado: "OK",
      evidencias,
      recibidas: items.length,
      latenciaMs: Date.now() - inicio,
      motivo: null,

      coberturaObservada: {
        dominiosDistintos: new Set(dominios).size,
        deMedioLocalDeclarado: deMedioLocal,

        proporcionLocal: dominios.length
          ? Number((deMedioLocal / dominios.length).toFixed(3))
          : null,

        nota:
          "Proporción de resultados que vienen de un dominio declarado como medio local. Es la métrica que decide si GDELT sirve para Azuay."
      }
    };
  } catch (error) {
    clearTimeout(temporizador);

    return {
      estado: error?.name === "AbortError" ? "TIEMPO_AGOTADO" : "ERROR",
      evidencias: [],
      recibidas: 0,
      latenciaMs: Date.now() - inicio,
      motivo: error?.message || "fallo de red"
    };
  }
}


/*
===========================================================
FICHA DE EVALUACION
===========================================================

Lo que se sabe, lo que no, y como se sabria.
===========================================================
*/

export function fichaEvaluacion() {
  return {
    providerId: ID,
    nombre: NOMBRE,
    estado: "ADAPTER IMPLEMENTADO — COBERTURA SIN MEDIR",

    accesoRequiere: "nada: API pública sin credencial",

    conocido: {
      credencial: false,
      costoMonetario: 0,
      motivoCosto: "API pública sin contrato. El límite es de tasa, no de dinero.",
      formatoRespuesta: "JSON (ArtList)",
      idiomaFiltrable: true,
      rangoTemporalCerrado: true,
      devuelveDominio: true,
      devuelvePaisDeFuente: true
    },

    /*
      Todo esto en null. Un benchmark sin ejecutar no es un
      benchmark con resultado cero.
    */
    sinMedir: {
      coberturaPais: null,
      coberturaTerritorio: null,
      coberturaMediosLocales: null,
      profundidadHistoricaUtil: null,
      latenciaMediana: null,
      tasaDuplicados: null,
      relevanciaTerritorial: null
    },

    ventajaUnica:
      "Es el único proveedor evaluado con archivo histórico consultable por rango cerrado. Google News tiene ventana móvil de semanas.",

    limitacionesConocidas: [
      "NO devuelve extracto: solo titular, dominio, idioma y fecha. Un corpus de GDELT da menos texto al motor de temas.",
      "`sourcecountry` es el país del MEDIO, no del hecho. Un medio ecuatoriano escribiendo sobre Cuenca de España sigue siendo Ecuador.",
      "Responde 200 con HTML cuando la consulta está mal formada: hay que distinguirlo de «cero resultados».",
      "Los agregadores globales suelen indexar bien prensa nacional y mal prensa de provincia. El Mercurio de Cuenca es justo el tipo de medio que se les escapa."
    ],

    riesgoPrincipal:
      "Que cubra Ecuador vía medios nacionales y no aporte ni un medio de Azuay. En ese caso duplicaría lo que ya se tiene sin añadir emisores, y la métrica que lo revelaría es `fuentesNuevas`.",

    comoSeDecide:
      "Ejecutar el caso BENCH-CUENCA-01 y mirar dos números: proporción de dominios locales y emisores NUEVOS que ningún proveedor actual aportaba. Si `fuentesNuevas` es 0, no se integra.",

    politicaAlmacenamiento:
      "SOLO_REFERENCIA. GDELT indexa metadatos de artículos ajenos y no los redistribuye."
  };
}


export function diagnostico() {
  return {
    id: ID,
    nombre: NOMBRE,
    tipo: TIPO,
    prioridad: PRIORIDAD,

    implementado: true,
    requiereCredencial: false,
    credencial: "no aplica",
    estado: "OK",

    costoPorConsulta: 0,
    motivoCosto: "API pública sin contrato.",

    coberturaDeclarada: ["noticias", "histórico"],

    limitaciones: fichaEvaluacion().limitacionesConocidas
  };
}


export default {
  ID,
  NOMBRE,
  TIPO,
  PRIORIDAD,
  buscar,
  normalizarArticulo,
  fechaGdeltAIso,
  isoAFechaGdelt,
  fichaEvaluacion,
  diagnostico
};
