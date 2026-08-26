// apps/backend/services/territorial/snapshotStore.js

import { appendFile, readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

import { calcularHash, hashCorto } from "../knowledgeLake/lakeHash.js";

/*
===========================================================
SNAPSHOT STORE — empezar a acumular hoy
===========================================================

Pulse y las ventanas comparables vienen despues. Este modulo
existe AHORA por una razon de calendario, no de arquitectura:

    Google News no da archivo historico. Su ventana es movil y
    de pocas semanas. La ventana anterior de Cuenca no se puede
    RECUPERAR: hay que ACUMULARLA.

Cada dia que pasa sin guardar snapshots es un dia de
comparacion que ya no se podra hacer nunca. Por eso el almacen
entra en este gate y no en E1: E1 sabra leer lo que este haya
guardado, y si empieza a guardar cuando empiece E1, E1 nace
ciego.

APPEND-ONLY, IGUAL QUE EL KNOWLEDGE LAKE
-----------------------------------------------------------

JSONL y `appendFile`. No hay ninguna ruta de codigo en este
modulo que reescriba un fichero: no existe `writeFile`.

Un snapshot corregido se anexa como snapshot NUEVO que declara
a cual sustituye. El original permanece. Reescribir el pasado
para que cuadre con el presente es exactamente lo que un
sistema de inteligencia no puede hacer.

LO QUE NO HACE
-----------------------------------------------------------

No reconstruye dias anteriores. Si no hay snapshot del 12 de
agosto, no hay dato del 12 de agosto —no hay una interpolacion
razonable ni un valor por defecto sensato—. Un hueco se declara
como hueco.
===========================================================
*/


export const VERSION_SNAPSHOT = "1.0";


/*
-----------------------------------------------------------
CAMPOS VOLATILES

Excluidos de la huella. Dos ejecuciones del mismo corpus tienen
que dar la MISMA huella aunque se hayan lanzado con horas de
diferencia; si no, la huella no sirve para detectar que nada ha
cambiado.
-----------------------------------------------------------
*/

const VOLATILES = new Set([
  "capturedAt",
  "snapshotId",
  "tiempo",
  "latencia",
  "duracion"
]);


function particionDe(instante) {
  /* "2026-08-25T13:00:00Z" -> "2026/08/25" */
  const s = String(instante || "");

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);

  return m ? `${m[1]}/${m[2]}/${m[3]}` : "sin-fecha";
}


/*
===========================================================
COMPONER UN SNAPSHOT

Toma la salida de un analisis territorial y se queda con lo que
hara falta para comparar. No guarda el corpus entero: guarda la
FORMA del corpus.

La distincion no es de espacio. Guardar las 30 notas invitaria
a recalcular el pasado con la logica de hoy, y entonces la
comparacion mediria cambios del codigo, no del territorio.
===========================================================
*/

export function componerSnapshot({
  territorio = null,
  projectId = null,
  window = null,
  capturedAt = null,
  diversidad = null,
  temas = [],
  entidades = [],
  territorios = [],
  consultas = [],
  providers = [],
  coverageLimitations = [],
  agendas = null
} = {}) {
  const cuerpo = {
    version: VERSION_SNAPSHOT,

    territorio: territorio
      ? {
          unidadId: territorio.unidadId || null,
          nombre: territorio.nombre || null,
          resolucion: territorio.resolucion || null
        }
      : null,

    projectId,

    window: window
      ? {
          id: window.id || null,
          dias: window.dias ?? null,
          desde: window.desde || null,
          hasta: window.hasta || null
        }
      : null,

    /* --- volumen y diversidad --- */
    totalEvidencias: diversidad?.totalEvidencias ?? 0,
    totalFuentes: diversidad?.totalFuentes ?? 0,
    fuentesIndependientes: diversidad?.fuentesIndependientes ?? 0,
    concentracionFuente: diversidad?.concentracionFuente ?? null,

    fuentesPorTipo: diversidad?.distribucionTipoFuente || null,

    /* --- contenido, reducido a lo comparable --- */
    temas: temas.map((t) => ({
      id: t.id,
      etiqueta: t.etiqueta || t.nombre || null,
      evidencias: t.documentosObservados ?? t.evidencias ?? 0,
      fuentesIndependientes: t.fuentesIndependientes ?? 0,
      metodo: t.metodoDescubrimiento || t.origen || null
    })),

    entidades: entidades.map((e) => ({
      nombre: e.entidad || e.nombre || null,
      tipo: e.tipoEntidad || null,
      evidencias: (e.indices || []).length
    })),

    territorios: territorios.map((u) => ({
      unidadId: u.unidadId,
      nombre: u.nombre,
      evidencias: u.conteo ?? u.evidencias ?? 0,
      resolucion: u.resolucion || u.nivel || null
    })),

    /* --- procedencia de la observacion --- */
    queries: consultas.map((c) => ({
      etiqueta: c.etiqueta,
      tipo: c.tipo || null,
      texto: c.texto,
      sesgoDeclarado: c.sesgoDeclarado || null
    })),

    providers: providers.map((p) => ({
      id: p.id || p.motor || null,
      estado: p.estado || null,
      resultados: p.recibidas ?? p.resultados ?? null
    })),

    agendas: agendas
      ? Object.fromEntries(
          Object.entries(agendas).map(([k, v]) => [
            k,
            { evidencias: v.evidencias, fuentes: v.fuentes }
          ])
        )
      : null,

    coverageLimitations: coverageLimitations.map((l) => ({
      id: l.id,
      severidad: l.severidad || null,
      titulo: l.titulo || null
    }))
  };

  /*
    La huella se calcula sobre el cuerpo SIN el instante. Dos
    capturas identicas en contenido comparten huella, y eso es
    lo que permite decir «no ha cambiado nada» en lugar de
    «no lo se».
  */
  const huella = calcularHash(cuerpo, { camposExcluidos: VOLATILES });

  const snapshotId = `snap-${hashCorto({ cuerpo, capturedAt }, 16)}`;

  return {
    snapshotId,
    capturedAt,
    huella,
    ...cuerpo
  };
}


/*
===========================================================
ALMACEN
===========================================================
*/

export function crearAlmacenMemoria() {
  const registros = [];

  return {
    id: "memoria",
    persistente: false,

    async anexar(snapshot) {
      registros.push(snapshot);

      return { anexado: true, total: registros.length };
    },

    async leerTodos() {
      return [...registros];
    }
  };
}


export function crearAlmacenFichero(opciones = {}) {
  const raiz = opciones.raiz || join(process.cwd(), "data", "territorial-snapshots");

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

    async anexar(snapshot) {
      const ruta = join(raiz, `${particionDe(snapshot.capturedAt)}.jsonl`);

      const dir = dirname(ruta);

      if (!existsSync(dir)) await mkdir(dir, { recursive: true });

      /*
        appendFile y nada mas. Este modulo no importa
        `writeFile`: no hay forma de sobrescribir un snapshot ni
        por error.
      */
      await appendFile(ruta, `${JSON.stringify(snapshot)}\n`, "utf8");

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
              /* Una linea corrupta no invalida el fichero entero. */
            }
          });
      }

      return salida;
    }
  };
}


/*
-----------------------------------------------------------
GUARDAR

Devuelve el snapshot guardado. No compara, no deduplica, no
decide si «merecia la pena»: eso seria el almacen opinando
sobre el contenido.
-----------------------------------------------------------
*/

export async function guardarSnapshot(almacen, snapshot) {
  if (!snapshot?.snapshotId) {
    throw new Error("Un snapshot sin snapshotId no se guarda.");
  }

  if (!snapshot.capturedAt) {
    throw new Error(
      "Un snapshot sin capturedAt no se guarda: sin instante no se puede comparar con nada."
    );
  }

  const r = await almacen.anexar(snapshot);

  return { ...r, snapshotId: snapshot.snapshotId, huella: snapshot.huella };
}


/*
-----------------------------------------------------------
CORREGIR — anexando, nunca reescribiendo
-----------------------------------------------------------
*/

export async function anexarCorreccion(almacen, original, correccion, motivo) {
  if (!motivo) {
    throw new Error("Una corrección sin motivo no se anexa.");
  }

  const nuevo = {
    ...correccion,
    sustituyeA: original.snapshotId,
    motivoCorreccion: motivo,

    declaracion:
      "Este snapshot corrige a otro. El original NO se ha modificado ni borrado: sigue en el almacén."
  };

  return guardarSnapshot(almacen, nuevo);
}


/*
===========================================================
VENTANAS COMPARABLES — la parte que hoy dice «todavia no»
===========================================================

E1 implementara la comparacion. Lo que se implementa aqui es la
mitad que impide inventarla: dado un snapshot y una ventana,
BUSCAR el anterior y, si no existe, decirlo.

La forma de la respuesta es la misma exista o no la ventana. Un
consumidor que la use no tiene que acordarse de comprobar
`disponible`: si lee `variacion` sin comprobar, lee `null`.
===========================================================
*/

export const VENTANAS_COMPARABLES = Object.freeze(["24h", "7d", "15d", "30d", "90d"]);


export function buscarVentanaAnterior(snapshots = [], { territorioId, ventanaId, capturedAt }) {
  const candidatos = snapshots
    .filter(
      (s) =>
        s.territorio?.unidadId === territorioId &&
        s.window?.id === ventanaId &&
        s.capturedAt < capturedAt
    )
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));

  return candidatos[0] || null;
}


export function compararConVentanaAnterior(actual, anterior) {
  if (!anterior) {
    return {
      disponible: false,

      estado: "SIN_VENTANA_COMPARABLE",

      etiqueta: "Sin ventana comparable",

      variacion: null,
      variacionEvidencias: null,
      variacionFuentes: null,

      motivo:
        "No existe un snapshot anterior de este territorio con la misma ventana. Sin ventana anterior no hay tendencia que calcular.",

      declaracion:
        "No se estima, no se interpola y no se compara contra una ventana de distinta duración. Un hueco es un hueco."
    };
  }

  const delta = (a, b) => {
    if (typeof a !== "number" || typeof b !== "number") return null;

    return { antes: b, ahora: a, diferencia: a - b };
  };

  return {
    disponible: true,

    estado: "VENTANA_COMPARABLE",

    comparadoCon: {
      snapshotId: anterior.snapshotId,
      capturedAt: anterior.capturedAt,
      ventana: anterior.window?.id || null
    },

    variacionEvidencias: delta(actual.totalEvidencias, anterior.totalEvidencias),

    variacionFuentes: delta(
      actual.fuentesIndependientes,
      anterior.fuentesIndependientes
    ),

    variacion: {
      huellaCambio: actual.huella !== anterior.huella
    },

    limitacion:
      "Comparar dos observaciones no es comparar dos realidades: si la segunda ejecución consultó más motores, el aumento puede ser de observación y no de actividad."
  };
}


export default {
  VERSION_SNAPSHOT,
  VENTANAS_COMPARABLES,
  componerSnapshot,
  crearAlmacenMemoria,
  crearAlmacenFichero,
  guardarSnapshot,
  anexarCorreccion,
  buscarVentanaAnterior,
  compararConVentanaAnterior
};
