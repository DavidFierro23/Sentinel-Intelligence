// apps/backend/services/territorial/evidenceLedger.js

import { appendFile, readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

/*
===========================================================
LIBRO DE OBSERVACIONES — TERRITORIAL-FRESH-01
===========================================================

Qué evidencias ha visto Sentinel, cuándo las vio por primera
vez y cuántas veces ha vuelto a verlas.

EL PROBLEMA QUE RESUELVE
-----------------------------------------------------------

`crossProviderDedup` deduplica DENTRO de una ejecución. Es lo
que hace falta cuando cinco proveedores traen la misma nota en
la misma pasada.

No sirve para lo otro: pulsar «actualizar» a las 08:00, a las
12:00 y a las 16:00. En cada pasada el dedup empieza de cero,
así que la misma nota entraría tres veces y el corpus crecería
sin que ocurriera nada en el territorio.

Con este registro, la segunda observación no crea evidencia:
avanza `lastObservedAt` y suma una a `observationCount`.

EL CAMPO QUE NO SE TOCA
-----------------------------------------------------------

`firstObservedAt` es INMUTABLE. Es la respuesta a «¿desde
cuándo lo sabemos?», y si cada pasada lo reescribiera, todo el
histórico diría que Sentinel se enteró de todo hoy.

CUATRO INSTANTES, NINGUNO SUSTITUYE A OTRO
-----------------------------------------------------------

    publishedAt      lo declara la fuente
    firstObservedAt  primera vez que Sentinel la vio
    lastObservedAt   última vez que volvió a verla
    retrievedAt      instante de ESTA ejecución

`retrievedAt` NO se guarda como campo único: cada observación
lleva el suyo, porque hubo tantos como pasadas.

APPEND-ONLY
-----------------------------------------------------------

Mismo criterio que el Knowledge Lake y los snapshots: cada
observación se ANEXA. El estado actual de una evidencia se
reconstruye leyendo sus observaciones en orden, no
sobrescribiendo una fila.

No existe `writeFile` en este módulo.
===========================================================
*/


export const VERSION_LEDGER = "1.0";


/*
-----------------------------------------------------------
MINIMIZAR LA FIRMA

Un correo en el campo `author` es un dato de contacto, no una
firma editorial. Se conserva la parte que identifica a quien
firma y se descarta el dominio, que es lo que lo convierte en
una direccion utilizable.

No se borra la firma entera: quedaria una pieza sin autor
cuando si lo declara.
-----------------------------------------------------------
*/

export function firmaMinimizada(autor) {
  const s = String(autor || "").trim();

  if (!s) return null;

  const correo = s.match(/^([^@\s]+)@[^@\s]+$/);

  return correo ? correo[1] : s;
}


export function crearLedgerMemoria() {
  const lineas = [];

  return {
    id: "memoria",
    persistente: false,

    async anexar(registro) {
      lineas.push(registro);

      return { anexado: true, total: lineas.length };
    },

    async leerTodos() {
      return [...lineas];
    }
  };
}


function particionDe(instante) {
  const m = String(instante || "").match(/^(\d{4})-(\d{2})-(\d{2})/);

  return m ? `${m[1]}/${m[2]}/${m[3]}` : "sin-fecha";
}


export function crearLedgerFichero(opciones = {}) {
  const raiz = opciones.raiz || join(process.cwd(), "data", "territorial-evidence");

  async function listar(dir = raiz) {
    if (!existsSync(dir)) return [];

    const entradas = await readdir(dir, { withFileTypes: true });

    const ficheros = [];

    for (const e of entradas) {
      const ruta = join(dir, e.name);

      if (e.isDirectory()) ficheros.push(...(await listar(ruta)));
      else if (e.name.endsWith(".jsonl")) ficheros.push(ruta);
    }

    return ficheros.sort();
  }

  return {
    id: "fichero",
    persistente: true,
    raiz,

    async anexar(registro) {
      const ruta = join(raiz, `${particionDe(registro.retrievedAt)}.jsonl`);

      const dir = dirname(ruta);

      if (!existsSync(dir)) await mkdir(dir, { recursive: true });

      await appendFile(ruta, `${JSON.stringify(registro)}\n`, "utf8");

      return { anexado: true, ruta };
    },

    async leerTodos() {
      const ficheros = await listar();

      const salida = [];

      for (const f of ficheros) {
        const texto = await readFile(f, "utf8");

        texto
          .split("\n")
          .filter(Boolean)
          .forEach((linea) => {
            try {
              salida.push(JSON.parse(linea));
            } catch {
              /* Una línea corrupta no invalida el fichero entero. */
            }
          });
      }

      return salida;
    }
  };
}


/*
===========================================================
RECONSTRUIR EL ESTADO

De la lista de observaciones al estado actual de cada
evidencia. Se ordena por `retrievedAt` para que
`firstObservedAt` sea el mínimo real aunque el fichero se haya
leído desordenado.
===========================================================
*/

export function reconstruirEstado(observaciones = [], opciones = {}) {
  const porId = new Map();

  /*
    ---------------------------------------------------------
    AMBITO DE PROYECTO — TERRITORIAL-ACCELERATION-02

    El libro es infraestructura COMPARTIDA; la lectura es por
    proyecto. Si se pide un `projectId`, solo se reconstruye lo
    de ese proyecto: la cobertura de una campaña no puede
    incluir evidencia observada para otra.

    `incluirLegado` existe porque las observaciones anteriores a
    este gate NO llevan `projectId`. Descartarlas en silencio
    haria desaparecer 234 observaciones reales; contarlas dentro
    de cualquier proyecto seria mentir sobre su ambito. Por
    defecto quedan FUERA de un proyecto concreto y solo se ven
    cuando no se filtra.
    ---------------------------------------------------------
  */
  const proyecto = opciones.projectId || null;

  const incluirLegado = opciones.incluirLegado === true;

  const relevante = (o) => {
    if (!proyecto) return true;

    if (o.projectId) return o.projectId === proyecto;

    return incluirLegado;
  };

  [...observaciones]
    .filter((o) => o?.evidenceId && relevante(o))
    .sort((a, b) => String(a.retrievedAt).localeCompare(String(b.retrievedAt)))
    .forEach((o) => {
      const previo = porId.get(o.evidenceId);

      if (!previo) {
        porId.set(o.evidenceId, {
          evidenceId: o.evidenceId,
          canonicalUrl: o.canonicalUrl || null,
          title: o.title || null,
          publishedAt: o.publishedAt || null,
          sourceId: o.sourceId || null,

          /* INMUTABLE a partir de aquí. */
          firstObservedAt: o.retrievedAt,

          lastObservedAt: o.retrievedAt,
          observationCount: 1,

          providers: o.providerId ? [o.providerId] : [],

          territoryId: o.territoryId || null,

          /* --- TERRITORIAL-ACCELERATION-02 --- */
          projectId: o.projectId || null,
          feedUrl: o.feedUrl || null,
          domain: o.domain || null,

          publisher: o.publisher || null,
          emitterId: o.emitterId || null,
          emitterStatus: o.emitterStatus || null,

          summary: o.summary || null,
          author: o.author || null,

          provenance: o.provenance || null,

          /*
            Lo que se DERIVO en el momento de observar. Es un
            registro historico, no una verdad: Topic x Territory
            recalcula y NO lee esto. Guardarlo permite auditar
            que se creia entonces sin convertirlo en cache.
          */
          derivadoEnLaObservacion: o.derivadoEnLaObservacion || null
        });

        return;
      }

      /*
        `firstObservedAt` NO se toca. Solo avanza el último y
        se cuenta la observación.
      */
      previo.lastObservedAt = o.retrievedAt;

      previo.observationCount += 1;

      if (o.providerId && !previo.providers.includes(o.providerId)) {
        previo.providers.push(o.providerId);
      }

      /*
        Los campos que faltaban se COMPLETAN; los que ya
        estaban afirmados NO se pisan. Un proveedor puede
        aportar la fecha que otro no traía, pero ninguno puede
        reescribir la que ya constaba.
      */
      if (!previo.publishedAt && o.publishedAt) previo.publishedAt = o.publishedAt;

      if (!previo.title && o.title) previo.title = o.title;

      if (!previo.sourceId && o.sourceId) previo.sourceId = o.sourceId;

      /* --- TERRITORIAL-ACCELERATION-02: misma regla --- */
      if (!previo.projectId && o.projectId) previo.projectId = o.projectId;

      if (!previo.feedUrl && o.feedUrl) previo.feedUrl = o.feedUrl;

      if (!previo.domain && o.domain) previo.domain = o.domain;

      if (!previo.summary && o.summary) previo.summary = o.summary;

      if (!previo.author && o.author) previo.author = o.author;

      /*
        El emisor se COMPLETA si no constaba. Que RSS resuelva
        al publicador que Google News ocultaba es justo el caso
        que este gate persigue: la pieza ya estaba en el corpus
        y ahora se sabe quien la publico.
      */
      if (!previo.publisher && o.publisher) {
        previo.publisher = o.publisher;

        previo.emitterId = o.emitterId || previo.emitterId;

        previo.emitterStatus = o.emitterStatus || previo.emitterStatus;
      }

      if (!previo.provenance && o.provenance) previo.provenance = o.provenance;
    });

  return porId;
}


/*
===========================================================
REGISTRAR UNA PASADA

Devuelve las evidencias enriquecidas con sus cuatro instantes,
más el reparto entre nuevas y ya conocidas.

`estadoPrevio` es el Map devuelto por `reconstruirEstado`. Se
pasa en lugar de releerlo aquí para que la función sea pura y
comprobable sin disco.
===========================================================
*/

export async function registrarPasada({
  ledger = null,
  evidencias = [],
  estadoPrevio = new Map(),
  retrievedAt,
  territoryId = null,
  runId = null,

  /*
    TERRITORIAL-ACCELERATION-02. Opcional a proposito: las
    suites anteriores llaman sin proyecto y siguen valiendo. Lo
    que NO se hace es inventar uno.
  */
  projectId = null,
  tenantId = null
}) {
  if (!retrievedAt) {
    throw new Error(
      "Una pasada sin `retrievedAt` no se registra: sin instante no se puede distinguir una observación nueva de una repetida."
    );
  }

  const nuevas = [];

  const revistas = [];

  const enriquecidas = evidencias.map((ev) => {
    const previo = estadoPrevio.get(ev.evidenceId);

    const esNueva = !previo;

    const firstObservedAt = previo ? previo.firstObservedAt : retrievedAt;

    const observationCount = previo ? previo.observationCount + 1 : 1;

    /*
      Proveedores acumulados: los de esta pasada MÁS los
      históricos. Que hace tres días lo trajera GDELT sigue
      siendo cierto hoy.
    */
    const deEstaPasada = ev.providersSeenBy || (ev.providerId ? [ev.providerId] : []);

    const providers = [...new Set([...(previo?.providers || []), ...deEstaPasada])];

    const salida = {
      ...ev,

      firstObservedAt,
      lastObservedAt: retrievedAt,
      retrievedAt,
      observationCount,

      providersSeenBy: providers,

      projectId: projectId || ev.projectId || null,

      esNuevaParaSentinel: esNueva
    };

    if (esNueva) nuevas.push(salida);
    else revistas.push(salida);

    return salida;
  });

  /* --- persistir una observación por evidencia --- */
  if (ledger) {
    for (const ev of enriquecidas) {
      await ledger.anexar({
        version: VERSION_LEDGER,
        evidenceId: ev.evidenceId,
        canonicalUrl: ev.canonicalUrl || null,
        title: ev.title || null,
        publishedAt: ev.publishedAt || null,
        sourceId: ev.sourceId || null,
        providerId: (ev.providersSeenBy || [])[0] || ev.providerId || null,
        territoryId,
        runId,
        retrievedAt,

        /*
          --- TERRITORIAL-ACCELERATION-02 ---

          `projectId` es el ambito de lectura. `null` significa
          «observado sin proyecto», no «de todos los proyectos».
        */
        projectId,
        tenantId,

        feedUrl: ev.feedUrl || ev.provenance?.query || null,

        domain: ev.domain || ev.sourceId || null,

        /*
          El emisor NO se inventa. Si no se pudo resolver, viaja
          `null` con su estado, que es un hecho comprobable.
        */
        publisher: ev.publisher || null,
        emitterId: ev.emitterId || null,
        emitterStatus: ev.emitterStatus || null,

        /*
          Resumen tal como lo publica la fuente. Sin esto, la
          extraccion de temas trabaja solo con titulares: fue la
          limitacion declarada de §13-terdecies.
        */
        summary: ev.snippet || ev.summary || null,

        /*
          FIRMA — TERRITORIAL-OPEN-LISTENING-EXPANSION-01

          `rssAdapter` ya extraia el autor de `dc:creator` y de
          `author`, y aqui se perdia. Medido sobre cuatro feeds
          locales reales: 40 de 40 items lo declaran, y se estaba
          tirando el 100 %.

          Es la firma TAL COMO la publica la fuente. Puede ser una
          persona, una seccion o una etiqueta generica —«Redes
          Sociales»—: quien es cada cosa se decide despues, con
          evidencia, no aqui.

          MINIMIZACION: algunos feeds ponen un CORREO en el campo
          de autor. Medido en la primera pasada real:
          `agencianoticiasuc@gmail.com`. Un correo es un dato de
          contacto personal y no aporta nada a la firma editorial,
          asi que se guarda el usuario y se descarta el dominio.
        */
        author: firmaMinimizada(ev.author),

        provenance: ev.provenance || null,

        derivadoEnLaObservacion: ev.derivadoEnLaObservacion || null
      });
    }
  }

  return {
    evidencias: enriquecidas,

    metricas: {
      observadas: enriquecidas.length,
      nuevasParaSentinel: nuevas.length,
      yaConocidas: revistas.length,

      /*
        La cifra que responde «¿ha cambiado algo desde la última
        vez?». Cero evidencias nuevas con veinte observadas
        significa que el territorio no ha producido nada nuevo,
        no que la recolección haya fallado.
      */
      corpusAcumulado: estadoPrevio.size + nuevas.length
    },

    declaraciones: [
      "Volver a observar una evidencia NO crea otra: avanza `lastObservedAt` y suma a `observationCount`.",
      "`firstObservedAt` es inmutable. Si cada pasada lo reescribiera, el histórico diría que Sentinel se enteró de todo hoy.",
      "Cero evidencias nuevas no es un fallo de recolección: puede ser que no haya pasado nada nuevo."
    ]
  };
}


export async function estadoLedger(ledger) {
  const obs = await ledger.leerTodos();

  const estado = reconstruirEstado(obs);

  const valores = [...estado.values()];

  return {
    evidenciasDistintas: valores.length,
    observacionesTotales: obs.length,

    reobservadas: valores.filter((e) => e.observationCount > 1).length,

    conFecha: valores.filter((e) => e.publishedAt).length,
    sinFecha: valores.filter((e) => !e.publishedAt).length,

    primeraObservacion: valores.length
      ? valores.reduce((m, e) => (e.firstObservedAt < m ? e.firstObservedAt : m), valores[0].firstObservedAt)
      : null,

    modo: "append-only"
  };
}


export default {
  VERSION_LEDGER,
  crearLedgerMemoria,
  crearLedgerFichero,
  reconstruirEstado,
  registrarPasada,
  estadoLedger
};
