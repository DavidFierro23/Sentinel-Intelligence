// apps/backend/services/territorial/topicStore.js

/*
===========================================================
ALMACEN DE TEMAS
TERRITORIAL-TOPIC-NORMALIZATION-01
===========================================================

QUE SE GUARDA Y QUE NO
-----------------------------------------------------------

    definiciones de tema
    asignaciones tema-evidencia
    instantaneas del calculo

Y NADA MAS. El cuerpo de la evidencia vive en
`evidenceLedger` y no se copia aqui: duplicarlo crearia dos
verdades que se desincronizan, y la traza ya funciona por
`evidenceId`.

    tema -> asignacion -> evidenceId -> ledger -> fuente, URL,
            publishedAt, texto original

POR QUE APPEND-ONLY
-----------------------------------------------------------

Un tema puede cambiar entre pasadas: fundirse con otro,
partirse, ganar evidencias. Si cada calculo sobreescribiera el
anterior, no habria forma de responder «¿como se veia este tema
la semana pasada?», que es exactamente lo que va a necesitar
Trend Radar.

Asi que cada pasada se anexa con su `runId` y su
`methodVersion`, y el estado vigente se reconstruye leyendo. Es
el mismo patron del libro de evidencias.

AISLAMIENTO
-----------------------------------------------------------

Todo registro lleva `projectId` y `tenantId`, y la lectura
filtra por proyecto. Sin eso, los temas de una campana
apareceria en otra.
===========================================================
*/

import fs from "node:fs/promises";
import path from "node:path";


export const VERSION_ALMACEN = "1.0";

const RAIZ_POR_DEFECTO = path.resolve(process.cwd(), "data", "territorial-topics");


export function crearAlmacenMemoria() {
  const registros = [];

  return {
    anexar: async (r) => { registros.push(JSON.parse(JSON.stringify(r))); },
    leerTodos: async () => registros.map((r) => JSON.parse(JSON.stringify(r)))
  };
}


export function crearAlmacenFichero(opciones = {}) {
  const raiz = opciones.raiz || RAIZ_POR_DEFECTO;

  /* Particion mensual: suficiente para el volumen de temas. */
  const rutaDe = (instante) => {
    const d = new Date(instante);
    const a = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");

    return path.join(raiz, String(a), `${a}-${m}.jsonl`);
  };

  return {
    anexar: async (r) => {
      const ruta = rutaDe(r.registradoEn || new Date().toISOString());

      await fs.mkdir(path.dirname(ruta), { recursive: true });
      await fs.appendFile(ruta, `${JSON.stringify(r)}\n`, "utf8");
    },

    leerTodos: async () => {
      const salida = [];

      const recorrer = async (dir) => {
        let entradas = [];

        try {
          entradas = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const e of entradas) {
          const p = path.join(dir, e.name);

          if (e.isDirectory()) await recorrer(p);
          else if (e.name.endsWith(".jsonl")) {
            const texto = await fs.readFile(p, "utf8");

            texto.split(/\r?\n/).forEach((linea) => {
              if (!linea.trim()) return;
              try { salida.push(JSON.parse(linea)); } catch { /* línea corrupta: se ignora, no se adivina */ }
            });
          }
        }
      };

      await recorrer(raiz);

      return salida;
    }
  };
}


/*
===========================================================
PERSISTIR UNA PASADA
===========================================================
*/

export async function persistirTemas({
  almacen = null,
  resultado = null,
  projectId = null,
  tenantId = null,
  territoryId = null,
  runId = null,
  registradoEn = new Date().toISOString()
} = {}) {
  if (!projectId) {
    throw new Error(
      "persistirTemas exige `projectId`. Sin él los temas de una campaña aparecerían en otra."
    );
  }

  if (!resultado?.temas) {
    throw new Error("persistirTemas exige el resultado de normalizarTemas.");
  }

  const base = {
    version: VERSION_ALMACEN,
    projectId,
    tenantId,
    territoryId,
    runId,
    registradoEn,
    universo: resultado.universo,
    metodo: resultado.metodo,
    umbral: resultado.umbral,
    methodVersion: resultado.methodVersion
  };

  const definiciones = resultado.temas.map((t) => ({
    ...base,
    tipo: "TOPIC_DEFINITION",
    topicId: t.topicId,
    topicLabel: t.topicLabel,
    parentTopicId: t.parentTopicId,
    keywords: t.keywords,
    entities: t.entities,
    evidenceCount: t.evidenceCount,
    uniqueSources: t.uniqueSources,
    uniqueActors: t.uniqueActors,
    providers: t.providers,
    sourceFamilies: t.sourceFamilies,
    contentNatureBreakdown: t.contentNatureBreakdown,
    territorialStratumBreakdown: t.territorialStratumBreakdown,
    rssEvidenceCount: t.rssEvidenceCount,
    rssShare: t.rssShare,
    sourceDiversity: t.sourceDiversity,
    actorDiversity: t.actorDiversity,
    providerDiversity: t.providerDiversity,
    publishedAtRange: t.publishedAtRange,
    firstObservedAt: t.firstObservedAt,
    lastObservedAt: t.lastObservedAt,
    windowCounts: t.windowCounts,
    mergedFrom: t.mergedFrom,
    splitFrom: t.splitFrom,
    relatedTopicIds: t.relatedTopicIds,
    limitations: t.limitations
  }));

  /*
    Las asignaciones NO copian el texto de la evidencia: solo su
    identificador. La traza se resuelve contra el ledger.
  */
  const asignaciones = resultado.assignments.map((a) => ({
    ...base,
    tipo: "TOPIC_ASSIGNMENT",
    evidenceId: a.evidenceId,
    topicId: a.topicId,
    estado: a.estado,
    confidence: a.confidence,
    reasons: a.reasons
  }));

  const instantanea = {
    ...base,
    tipo: "TOPIC_SNAPSHOT",
    resumen: resultado.resumen,
    corpus: resultado.corpus
  };

  if (almacen) {
    for (const r of [...definiciones, ...asignaciones, instantanea]) {
      await almacen.anexar(r);
    }
  }

  return {
    definiciones: definiciones.length,
    asignaciones: asignaciones.length,
    instantaneas: 1,

    informe: {
      TOPIC_DEFINITIONS: definiciones.length,
      TOPIC_ASSIGNMENTS: asignaciones.length,
      universo: resultado.universo,
      methodVersion: resultado.methodVersion,

      declaraciones: [
        "No se copia el cuerpo de ninguna evidencia: la traza se resuelve por evidenceId contra el libro de evidencias.",
        "Append-only: cada pasada conserva la anterior para poder comparar en el tiempo.",
        "Todo registro lleva projectId y tenantId; la lectura filtra por proyecto."
      ]
    }
  };
}


/*
===========================================================
LEER EL ESTADO VIGENTE
===========================================================

La ultima pasada de cada universo, por proyecto. `runId` mas
reciente gana; lo anterior sigue en el fichero.
===========================================================
*/

export function reconstruirTemas(registros = [], opciones = {}) {
  const proyecto = opciones.projectId || null;

  const universo = opciones.universo || null;

  const relevante = (r) => {
    if (proyecto && r.projectId !== proyecto) return false;

    if (universo && r.universo !== universo) return false;

    return true;
  };

  const propios = registros.filter(relevante);

  /* La pasada vigente es la de `registradoEn` más reciente. */
  const ultima = propios.reduce(
    (max, r) => (!max || String(r.registradoEn) > max ? String(r.registradoEn) : max),
    null
  );

  const deLaUltima = propios.filter((r) => String(r.registradoEn) === ultima);

  const temas = new Map();

  const asignaciones = new Map();

  let instantanea = null;

  deLaUltima.forEach((r) => {
    if (r.tipo === "TOPIC_DEFINITION") temas.set(r.topicId, r);
    else if (r.tipo === "TOPIC_ASSIGNMENT") asignaciones.set(r.evidenceId, r);
    else if (r.tipo === "TOPIC_SNAPSHOT") instantanea = r;
  });

  return {
    projectId: proyecto,
    universo,
    registradoEn: ultima,
    temas,
    asignaciones,
    instantanea,
    pasadasEnElHistorico: new Set(propios.map((r) => String(r.registradoEn))).size
  };
}


/*
  Traza completa de una evidencia: de la asignacion al tema y al
  identificador con el que buscarla en el libro.
*/
export function trazaDe(evidenceId, estado) {
  const a = estado.asignaciones.get(evidenceId);

  if (!a) return { evidenceId, encontrada: false };

  const t = a.topicId ? estado.temas.get(a.topicId) : null;

  return {
    evidenceId,
    encontrada: true,
    topicId: a.topicId,
    topicLabel: t?.topicLabel || null,
    estado: a.estado,
    confidence: a.confidence,
    reasons: a.reasons,
    methodVersion: a.methodVersion,
    projectId: a.projectId,
    tenantId: a.tenantId,
    /* Para el cuerpo hay que ir al libro: aquí no está copiado. */
    resolverEvidenciaEn: "territorial/evidenceLedger.js por evidenceId"
  };
}


export default {
  VERSION_ALMACEN,
  crearAlmacenMemoria,
  crearAlmacenFichero,
  persistirTemas,
  reconstruirTemas,
  trazaDe
};
