// apps/backend/services/territorial/sourceUniverseStore.js

import { appendFile, readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

import { ESTADOS_FUENTE, estadoUniverso } from "./verifiedSourceUniverse.js";

/*
===========================================================
ALMACEN DEL UNIVERSO DE FUENTES — TERRITORIAL-SOURCE-UNIVERSE-01
===========================================================

Que se comprobo, cuando, y que se encontro. Anexo puro, igual
que el libro de evidencias: aqui NO hay `writeFile`.

POR QUE PERSISTIR, SI YA HAY UN REGISTRO
-----------------------------------------------------------

`ingest/mediaSourceRegistry.js` tiene la estructura correcta y
vive en un `Map`. Cada arranque del backend lo olvida, y con el
se olvida la frase que justifica su existencia:

    «Una fuente descubierta hoy no debe tener que descubrirse
     desde cero mañana.»

Sin fichero, cada pasada volveria a pedir la portada de veinte
medios para averiguar lo que ya se sabia ayer.

PRIMERA COMPROBACION INMUTABLE
-----------------------------------------------------------

`primeraComprobacionEn` no se reescribe nunca, por la misma
razon que `firstObservedAt` en el libro de evidencias: si cada
pasada lo pisara, el historico diria que Sentinel descubrio
todas sus fuentes hoy.

Y hay una tercera fecha que no se confunde con las otras dos:

    ultimaComprobacionEn      la ultima vez que Sentinel MIRO
    publicacionMasReciente    lo ultimo que el MEDIO publico

Confundirlas convierte «no hemos mirado» en «no ha publicado».

REEJECUTAR NO DUPLICA
-----------------------------------------------------------

El fichero acumula una linea por comprobacion —eso es el
historico— pero el universo reconstruido tiene UNA ficha por
`sourceId`. Dos pasadas seguidas dan dos lineas y el mismo
numero de fuentes.
===========================================================
*/


export const VERSION_ALMACEN = "1.0";


export function crearAlmacenMemoria() {
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
  const m = String(instante || "").match(/^(\d{4})-(\d{2})/);

  /*
    Particion MENSUAL, no diaria. Las fuentes no se recomprueban
    cada hora: un fichero por dia dejaria cientos de ficheros de
    una linea.
  */
  return m ? `${m[1]}/${m[1]}-${m[2]}` : "sin-fecha";
}


export function crearAlmacenFichero(opciones = {}) {
  const raiz = opciones.raiz || join(process.cwd(), "data", "territorial-sources");

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
      const ruta = join(raiz, `${particionDe(registro.comprobadoEn)}.jsonl`);

      const dir = dirname(ruta);

      if (!existsSync(dir)) await mkdir(dir, { recursive: true });

      /*
        `appendFile`. No hay forma de sobrescribir una
        comprobacion anterior desde este modulo.
      */
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
REGISTRAR UNA COMPROBACION

Una linea por ficha. Se anota TANTO lo que funciono como lo que
no: un fallo sin anotar se repite; uno anotado se puede espaciar.
===========================================================
*/

export async function registrarComprobacion({
  almacen = null,
  universo = null,
  estadoPrevio = new Map(),
  runId = null
} = {}) {
  if (!universo?.comprobadoEn) {
    throw new Error(
      "Una comprobación sin `comprobadoEn` no se registra: sin instante no se distingue una fuente nueva de una recomprobada."
    );
  }

  const instante = universo.comprobadoEn;

  const nuevas = [];

  const recomprobadas = [];

  const fichas = universo.fichas.map((ficha) => {
    const previo = estadoPrevio.get(ficha.sourceId);

    const esNueva = !previo;

    /*
      Solo cuenta como comprobacion si de verdad se miro. Una
      ficha NO_RESUELTO por presupuesto agotado no debe avanzar
      el contador ni pisar la fecha de la ultima vez que si se
      mira.
    */
    const seMiro = Boolean(ficha.comprobadoEn);

    const primera = previo?.primeraComprobacionEn || (seMiro ? instante : null);

    const salida = {
      ...ficha,

      primeraComprobacionEn: primera,

      ultimaComprobacionEn: seMiro
        ? instante
        : previo?.ultimaComprobacionEn || null,

      comprobaciones: (previo?.comprobaciones || 0) + (seMiro ? 1 : 0),

      esNuevaParaSentinel: esNueva
    };

    if (esNueva) nuevas.push(salida);
    else recomprobadas.push(salida);

    return salida;
  });

  if (almacen) {
    for (const f of fichas) {
      await almacen.anexar({
        version: VERSION_ALMACEN,

        sourceId: f.sourceId,
        nombre: f.nombre,
        dominio: f.dominio,
        tipo: f.tipo,
        origenClasificacion: f.origenClasificacion,

        territorioDeclarado: f.territorioDeclarado,
        territorioId: universo.territorioId || null,

        prioridad: f.prioridad,
        homepage: f.homepage,

        estadoVerificacion: f.estadoVerificacion,
        metodoDescubrimiento: f.metodoDescubrimiento,

        feeds: f.feeds,
        feedsDescartados: f.feedsDescartados,

        robots: f.robots,
        procedencia: f.procedencia,
        restricciones: f.restricciones,
        observaciones: f.observaciones,
        motivo: f.motivo,

        registroOficialContrastado: false,

        /*
          Tres fechas distintas en la misma linea, a proposito:

            comprobadoEn            cuando corrio LA PASADA
            ultimaComprobacionEn    cuando se MIRO esta fuente
            primeraComprobacionEn   la primera vez, inmutable

          Una ficha NO_RESUELTO por presupuesto agotado se anota
          igual —consta que existe— pero con
          `ultimaComprobacionEn` en null: la pasada corrio, a
          ella no se la miro. Guardar solo la fecha de la pasada
          convertiria «no la hemos mirado» en «la miramos».
        */
        primeraComprobacionEn: f.primeraComprobacionEn,
        ultimaComprobacionEn: f.ultimaComprobacionEn,
        comprobadoEn: instante,
        runId
      });
    }
  }

  return {
    fichas,

    metricas: {
      fuentes: fichas.length,
      nuevasParaSentinel: nuevas.length,
      yaConocidas: recomprobadas.length,
      corpusAcumulado: estadoPrevio.size + nuevas.length
    },

    declaraciones: [
      "Recomprobar una fuente NO crea otra: avanza `ultimaComprobacionEn` y suma a `comprobaciones`.",
      "`primeraComprobacionEn` es inmutable. Si cada pasada lo reescribiera, el histórico diría que Sentinel descubrió todas sus fuentes hoy.",
      "Una ficha NO_RESUELTO por presupuesto agotado no avanza el contador: no se miró, y decir que se miró sería falso."
    ]
  };
}


/*
===========================================================
RECONSTRUIR EL UNIVERSO

De la lista de comprobaciones al estado actual de cada fuente.
Se ordena por `comprobadoEn` para que `primeraComprobacionEn`
sea el minimo real aunque el fichero se lea desordenado.
===========================================================
*/

export function reconstruirUniverso(registros = []) {
  const estado = new Map();

  [...registros]
    .sort((a, b) => String(a.comprobadoEn).localeCompare(String(b.comprobadoEn)))
    .forEach((r) => {
      if (!r?.sourceId) return;

      const previo = estado.get(r.sourceId);

      /*
        `comprobadoEn` es de la PASADA y siempre viene relleno.
        Lo que dice si se miro ESTA fuente es
        `ultimaComprobacionEn`.
      */
      const seMiro = Boolean(r.ultimaComprobacionEn);

      estado.set(r.sourceId, {
        ...previo,
        ...r,

        primeraComprobacionEn: previo?.primeraComprobacionEn || r.primeraComprobacionEn || null,

        ultimaComprobacionEn: seMiro
          ? r.ultimaComprobacionEn
          : previo?.ultimaComprobacionEn || null,

        /*
          Se cuentan las veces que se miro de verdad. No se
          confia en el contador guardado: se reconstruye.
        */
        comprobaciones: (previo?.comprobaciones || 0) + (seMiro ? 1 : 0)
      });
    });

  return estado;
}


export async function estadoAlmacen(almacen) {
  const registros = almacen ? await almacen.leerTodos() : [];

  const universo = reconstruirUniverso(registros);

  const fichas = [...universo.values()];

  const resumen = estadoUniverso(fichas);

  return {
    almacen: almacen?.id || null,
    persistente: Boolean(almacen?.persistente),
    raiz: almacen?.raiz || null,

    comprobacionesRegistradas: registros.length,

    ...resumen,

    /*
      La diferencia entre lineas y fuentes ES la prueba de que
      reejecutar no duplica.
    */
    lineasPorFuente:
      fichas.length > 0 ? Number((registros.length / fichas.length).toFixed(2)) : 0,

    nuncaComprobadas: fichas.filter((f) => !f.ultimaComprobacionEn).length,

    conFeedValido: fichas.filter(
      (f) => f.estadoVerificacion === ESTADOS_FUENTE.VERIFICADO_FEED
    ).length
  };
}


export default {
  VERSION_ALMACEN,
  crearAlmacenMemoria,
  crearAlmacenFichero,
  registrarComprobacion,
  reconstruirUniverso,
  estadoAlmacen
};
