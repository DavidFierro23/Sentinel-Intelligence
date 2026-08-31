// apps/backend/services/territorial/rssRotation.js

import { appendFile, readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

/*
===========================================================
ROTACION DE FUENTES RSS — TERRITORIAL-RSS-ROTATION-01
===========================================================

Veinte feeds validos y ocho plazas por pasada. Este modulo
decide CUALES ocho, y lo hace de forma que las otras doce no se
queden fuera para siempre.

EL PROBLEMA MEDIDO
-----------------------------------------------------------

TERRITORIAL-SOURCE-UNIVERSE-01 dejo 20 feeds comprobados.
`PRESUPUESTO_POR_PASADA.rss_directo` lee 8. Con orden fijo por
prioridad territorial, los mismos 8 se leian en cada pasada y
los otros 12 —comprobados, validos, gratis— no se leian NUNCA.

Eso no es un presupuesto: es una lista de espera infinita.

LO QUE NO SE HACE
-----------------------------------------------------------

NO se eleva el presupuesto. El tope de 8 es del recolector y
tiene su motivo declarado; aqui no se toca.

NO se elige al azar. Una seleccion aleatoria no se puede
auditar ni reproducir, y con mala suerte deja fuera a la misma
fuente varias pasadas seguidas. Todo el orden de este modulo es
determinista: mismas entradas, misma cohorte.

NO se crea otro recolector. `territorialCollector` sigue siendo
el unico que lee feeds; este modulo solo decide la lista que le
entra.

EL CICLO ES LA GARANTIA CONTRA EL HAMBRE
-----------------------------------------------------------

Un ciclo termina cuando cada feed elegible ha sido atendido
—o diferido con motivo— una vez. Hasta que eso pasa, ninguna
fuente ya atendida vuelve a entrar.

Es lo que convierte «prioridad» en «orden de servicio» en lugar
de en «privilegio permanente»: una nacional valida entra mas
tarde que una local, pero entra.

Con 20 feeds y 8 plazas: 8 + 8 + 4 y el ciclo cierra en tres
pasadas. Nada de eso esta escrito en el codigo; sale de las dos
cifras.

TRES INSTANTES QUE NO SE CONFUNDEN
-----------------------------------------------------------

    lastAttemptAt    la ultima vez que Sentinel LO INTENTO
    lastSuccessAt    la ultima vez que el feed RESPONDIO
    publishedAt      lo que el MEDIO declara haber publicado

Es la misma disciplina de `dayWindow` y del registro de medios.
Un feed que no se intento no es un feed sin novedades.

AUSENCIA NO ES CERO
-----------------------------------------------------------

`SIN_RESULTADOS` significa que el feed respondio y no traia
nada: eso SI autoriza a decir «no ha publicado». `INACCESIBLE`
significa que no se pudo leer, y no autoriza a decir nada. Por
eso el primero NO cuenta como fallo y el segundo si.
===========================================================
*/


export const VERSION_ROTACION = "1.0";


/*
-----------------------------------------------------------
ESTADOS DE UN INTENTO

Los seis del gate. Se derivan de lo que devuelve `rssAdapter`,
que habla en su propio vocabulario.
-----------------------------------------------------------
*/

export const ESTADOS_INTENTO = Object.freeze({
  OK: "OK",
  SIN_RESULTADOS: "SIN_RESULTADOS",
  ERROR_FUENTE: "ERROR_FUENTE",
  INACCESIBLE: "INACCESIBLE",
  NO_PUBLICA_RSS: "NO_PUBLICA_RSS",
  NO_RESUELTO: "NO_RESUELTO"
});


/*
  Solo estos dos cuentan como fallo del feed.

  `SIN_RESULTADOS` queda fuera a proposito: el feed respondio.
  Penalizar a un medio por no haber publicado hoy lo apartaria
  de la rotacion justo cuando vuelva a publicar.
*/
const ESTADOS_DE_FALLO = Object.freeze([
  ESTADOS_INTENTO.ERROR_FUENTE,
  ESTADOS_INTENTO.INACCESIBLE,
  ESTADOS_INTENTO.NO_PUBLICA_RSS
]);


export function esFallo(estado) {
  return ESTADOS_DE_FALLO.includes(estado);
}


/*
  Traduccion desde el vocabulario de `rssAdapter.ESTADOS_FEED`.

  `OK` con cero evidencias es `SIN_RESULTADOS`, no `OK`: decir
  OK sin haber traido nada haria pasar un feed vacio por un feed
  productivo en el recuento del ciclo.
*/
export function clasificarIntento(lote = {}) {
  const recibidas = lote.recibidas ?? (lote.evidencias || []).length;

  switch (lote.estado) {
    case "OK":
      return recibidas > 0 ? ESTADOS_INTENTO.OK : ESTADOS_INTENTO.SIN_RESULTADOS;

    case "VACIO":
      return ESTADOS_INTENTO.SIN_RESULTADOS;

    case "MALFORMADO":
      return ESTADOS_INTENTO.ERROR_FUENTE;

    case "INACCESIBLE":
      return ESTADOS_INTENTO.INACCESIBLE;

    case "SIN_RSS":
      return ESTADOS_INTENTO.NO_PUBLICA_RSS;

    default:
      return ESTADOS_INTENTO.NO_RESUELTO;
  }
}


/*
-----------------------------------------------------------
BACKOFF

Un feed que falla se salta las siguientes `min(fallos, 4)`
pasadas. Acotado a proposito: sin tope, tres fallos seguidos
apartarian una fuente durante semanas, y un 503 de una tarde no
es un medio muerto.

Se cuenta en PASADAS, no en tiempo: no hay demonio que garantice
cada cuanto ocurre una pasada, asi que medir en horas seria
inventar precision.
-----------------------------------------------------------
*/

export const SALTOS_MAXIMOS = 4;


export function saltosPorFallos(fallos) {
  return Math.min(Math.max(fallos, 0), SALTOS_MAXIMOS);
}


function fichaVacia(feedUrl) {
  return {
    feedUrl,
    sourceId: null,

    lastAttemptAt: null,
    lastSuccessAt: null,
    lastResultCount: null,

    consecutiveFailures: 0,
    ultimoEstado: null,

    intentos: 0,

    /* En que ciclo se atendio por ultima vez. */
    cicloVisto: 0,

    /* Pasada a partir de la cual vuelve a ser elegible. */
    elegibleDesdePasada: 0
  };
}


/*
===========================================================
SELECCIONAR LA COHORTE

Determinista de arriba abajo. El desempate final es la URL,
para que dos feeds con exactamente el mismo historial siempre
salgan en el mismo orden.
===========================================================
*/

export function ordenDeServicio(a, b) {
  /* 1 · lo que tiene territorio declarado, primero. */
  const territorial = (f) => (f.territorioDeclarado ? 0 : 1);

  if (territorial(a) !== territorial(b)) return territorial(a) - territorial(b);

  /* 2 · prioridad declarada: local, regional/nacional, institucion... */
  if ((a.prioridad ?? 99) !== (b.prioridad ?? 99)) {
    return (a.prioridad ?? 99) - (b.prioridad ?? 99);
  }

  /*
    3 · el que se intento hace mas tiempo. Nunca intentado
    —cadena vacia— va antes que cualquier fecha.
  */
  const intento = (f) => f.lastAttemptAt || "";

  if (intento(a) !== intento(b)) return intento(a) < intento(b) ? -1 : 1;

  /* 4 · desempate total y estable. */
  return String(a.feedUrl).localeCompare(String(b.feedUrl));
}


export function seleccionarCohorte({
  elegibles = [],
  estado = new Map(),
  presupuesto = 8,
  ciclo = 1,
  pasada = 1
} = {}) {
  const conFicha = elegibles.map((f) => {
    const previo = estado.get(f.url) || fichaVacia(f.url);

    return {
      ...previo,
      feedUrl: f.url,
      sourceId: f.sourceId || previo.sourceId,
      publisher: f.publisher || null,
      prioridad: f.prioridad ?? null,
      territorioDeclarado: f.territorioDeclarado ?? null
    };
  });

  /* Ya atendidos en ESTE ciclo: no repiten hasta que cierre. */
  const atendidos = conFicha.filter((f) => f.cicloVisto === ciclo);

  const pendientes = conFicha.filter((f) => f.cicloVisto !== ciclo);

  /* En backoff: se difieren, y se DICE por que. */
  const diferidos = pendientes.filter((f) => pasada < f.elegibleDesdePasada);

  const seleccionables = pendientes
    .filter((f) => pasada >= f.elegibleDesdePasada)
    .sort(ordenDeServicio);

  const seleccionados = seleccionables.slice(0, presupuesto);

  /*
    El ciclo cierra cuando ya no queda nada seleccionable: todo
    elegible esta atendido o diferido.

    Las plazas que sobren en la pasada de cierre NO se rellenan
    con fuentes del ciclo siguiente. Gastar plazas por gastarlas
    no trae informacion, y adelantar el ciclo siguiente haria
    ilegible el recuento de cobertura.
  */
  const cicloCierra = seleccionables.length <= presupuesto;

  return {
    ciclo,
    pasada,
    presupuesto,

    elegibles: conFicha.length,

    seleccionados,

    diferidos: diferidos.map((f) => ({
      feedUrl: f.feedUrl,
      sourceId: f.sourceId,
      consecutiveFailures: f.consecutiveFailures,
      elegibleDesdePasada: f.elegibleDesdePasada,

      motivo: `Diferido por ${f.consecutiveFailures} fallo(s) consecutivo(s): vuelve a ser elegible en la pasada ${f.elegibleDesdePasada}.`
    })),

    yaAtendidos: atendidos.length,

    /* Lo que quedaria para las siguientes pasadas de este ciclo. */
    pendientesTrasEstaPasada: Math.max(seleccionables.length - seleccionados.length, 0),

    cicloCierra,

    plazasSinUsar: Math.max(presupuesto - seleccionados.length, 0)
  };
}


/*
===========================================================
ANOTAR LO QUE PASO

Una ficha por feed intentado. Se anota TANTO el exito como el
fallo: un fallo sin anotar se repite igual la pasada siguiente.
===========================================================
*/

export function anotarResultados({
  cohorte,
  resultados = [],
  instante,
  estado = new Map()
} = {}) {
  if (!instante) {
    throw new Error(
      "Una rotación sin instante no se anota: sin `instante` no se distingue «no lo intentamos» de «lo intentamos y no respondió»."
    );
  }

  const porFeed = new Map(resultados.map((r) => [r.feedUrl, r]));

  const fichas = cohorte.seleccionados.map((f) => {
    const r = porFeed.get(f.feedUrl);

    /*
      Seleccionado y sin resultado anotado = NO_RESUELTO. No se
      inventa un OK ni un fallo: no consta que se leyera.
    */
    const estadoIntento = r ? r.estado : ESTADOS_INTENTO.NO_RESUELTO;

    const seIntento = Boolean(r);

    const fallo = esFallo(estadoIntento);

    const fallos = fallo ? f.consecutiveFailures + 1 : 0;

    return {
      ...f,

      ultimoEstado: estadoIntento,

      lastAttemptAt: seIntento ? instante : f.lastAttemptAt,

      /* Respondio: OK o SIN_RESULTADOS. Ambos son lecturas. */
      lastSuccessAt: seIntento && !fallo ? instante : f.lastSuccessAt,

      lastResultCount: seIntento && !fallo ? (r.recibidas ?? 0) : f.lastResultCount,

      consecutiveFailures: fallos,

      intentos: f.intentos + (seIntento ? 1 : 0),

      /*
        Atendido en este ciclo aunque haya fallado: se le dio su
        plaza. Si un fallo no contara como atendido, el feed
        roto se llevaria una plaza en cada pasada y el ciclo no
        cerraria nunca.
      */
      cicloVisto: cohorte.ciclo,

      elegibleDesdePasada: fallo
        ? cohorte.pasada + 1 + saltosPorFallos(fallos)
        : cohorte.pasada + 1
    };
  });

  /*
    Los diferidos tambien quedan marcados como vistos en el
    ciclo. No se leyeron —y consta— pero no pueden impedir que
    el ciclo cierre: si lo impidieran, un feed en backoff
    congelaria la rotacion de los otros diecinueve.
  */
  const diferidas = cohorte.diferidos.map((d) => {
    const previo = estado.get(d.feedUrl) || fichaVacia(d.feedUrl);

    return {
      ...previo,
      cicloVisto: cohorte.ciclo,
      diferidoEn: cohorte.pasada,
      motivoDiferido: d.motivo
    };
  });

  return { fichas, diferidas };
}


/*
===========================================================
ALMACEN — anexo puro, igual que el resto de la linea
===========================================================
*/

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

  return m ? `${m[1]}/${m[1]}-${m[2]}` : "sin-fecha";
}


export function crearAlmacenFichero(opciones = {}) {
  const raiz = opciones.raiz || join(process.cwd(), "data", "territorial-rss-rotation");

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
      const ruta = join(raiz, `${particionDe(registro.instante)}.jsonl`);

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
-----------------------------------------------------------
AMBITO

`scopeId` es el proyecto cuando hay proyecto, y el territorio
cuando no. Dos proyectos sobre el mismo canton rotan por
separado: la cobertura de uno no puede dar por escuchada una
fuente que el otro no ha leido.

Se declara cual de los dos se uso, para que nadie lea una
rotacion de territorio como si fuera de proyecto.
-----------------------------------------------------------
*/

export function ambitoDeRotacion({ projectId = null, territoryId = null } = {}) {
  if (projectId) return { scopeId: `proyecto:${projectId}`, tipo: "PROYECTO", projectId, territoryId };

  if (territoryId) return { scopeId: `territorio:${territoryId}`, tipo: "TERRITORIO", projectId: null, territoryId };

  return {
    scopeId: "sin-ambito",
    tipo: "SIN_AMBITO",
    projectId: null,
    territoryId: null
  };
}


export async function registrarRotacion({
  almacen = null,
  scopeId,
  cohorte,
  resultados = [],
  instante,
  estado = new Map(),
  runId = null
} = {}) {
  const { fichas, diferidas } = anotarResultados({ cohorte, resultados, instante, estado });

  if (almacen) {
    for (const f of [...fichas, ...diferidas]) {
      await almacen.anexar({
        version: VERSION_ROTACION,
        scopeId,

        feedUrl: f.feedUrl,
        sourceId: f.sourceId || null,
        prioridad: f.prioridad ?? null,
        territorioDeclarado: f.territorioDeclarado ?? null,

        ciclo: cohorte.ciclo,
        pasada: cohorte.pasada,

        ultimoEstado: f.ultimoEstado || null,
        lastAttemptAt: f.lastAttemptAt || null,
        lastSuccessAt: f.lastSuccessAt || null,
        lastResultCount: f.lastResultCount ?? null,
        consecutiveFailures: f.consecutiveFailures || 0,
        intentos: f.intentos || 0,
        cicloVisto: f.cicloVisto,
        elegibleDesdePasada: f.elegibleDesdePasada || 0,

        diferido: Boolean(f.motivoDiferido),
        motivoDiferido: f.motivoDiferido || null,

        instante,
        runId
      });
    }
  }

  const conteo = { OK: 0, SIN_RESULTADOS: 0, ERROR_FUENTE: 0, INACCESIBLE: 0, NO_PUBLICA_RSS: 0, NO_RESUELTO: 0 };

  fichas.forEach((f) => {
    if (conteo[f.ultimoEstado] !== undefined) conteo[f.ultimoEstado] += 1;
  });

  return {
    fichas,
    diferidas,

    metricas: {
      elegibles: cohorte.elegibles,
      seleccionados: cohorte.seleccionados.length,
      intentados: fichas.filter((f) => f.lastAttemptAt === instante).length,
      diferidos: diferidas.length,
      plazasSinUsar: cohorte.plazasSinUsar,
      porEstado: conteo,
      cicloCierra: cohorte.cicloCierra
    },

    declaraciones: [
      "`lastAttemptAt` es la última vez que se intentó; `lastSuccessAt` la última vez que el feed respondió. Un feed que no se intentó no es un feed sin novedades.",
      "SIN_RESULTADOS no cuenta como fallo: el feed respondió y no traía nada, y eso sí autoriza a decir que no ha publicado.",
      "Un feed que falla queda atendido en el ciclo igualmente. Si no, se llevaría una plaza en cada pasada y el ciclo no cerraría nunca.",
      "El backoff se cuenta en pasadas, no en horas: no hay demonio que garantice cada cuánto ocurre una pasada, y medirlo en tiempo sería inventar precisión."
    ]
  };
}


/*
===========================================================
RECONSTRUIR

Del fichero al estado actual. Se ordena por (instante, pasada)
para que el resultado no dependa del orden de lectura.
===========================================================
*/

export function reconstruirRotacion(registros = [], scopeId = null) {
  const propios = registros.filter((r) => !scopeId || r.scopeId === scopeId);

  const estado = new Map();

  let ciclo = 1;

  let pasada = 0;

  [...propios]
    .sort(
      (a, b) =>
        String(a.instante).localeCompare(String(b.instante)) ||
        (a.pasada || 0) - (b.pasada || 0)
    )
    .forEach((r) => {
      if (!r?.feedUrl) return;

      const previo = estado.get(r.feedUrl) || fichaVacia(r.feedUrl);

      estado.set(r.feedUrl, {
        ...previo,
        ...r,

        /* Se conserva el maximo: el historico no retrocede. */
        cicloVisto: Math.max(previo.cicloVisto || 0, r.cicloVisto || 0),
        intentos: Math.max(previo.intentos || 0, r.intentos || 0)
      });

      ciclo = Math.max(ciclo, r.ciclo || 1);

      pasada = Math.max(pasada, r.pasada || 0);
    });

  return { estado, ciclo, pasada, registros: propios.length };
}


/*
  El ciclo y la pasada que le tocan a la PROXIMA ejecucion.

  Si en el ciclo grabado ya no queda nada por atender, el
  siguiente empieza uno nuevo. Se calcula al leer y no se
  guarda, para que reiniciar el backend no lo cambie.
*/
export function siguienteCicloYPasada({ estado, ciclo, pasada, elegibles = [] }) {
  const quedanPendientes = elegibles.some((f) => {
    const ficha = estado.get(f.url);

    return !ficha || ficha.cicloVisto !== ciclo;
  });

  return {
    ciclo: quedanPendientes ? ciclo : ciclo + 1,
    pasada: pasada + 1,
    cicloAnteriorCompleto: !quedanPendientes
  };
}


/*
===========================================================
OBSERVABILIDAD

Tiene que poder responder: «¿qué fuentes RSS todavía no se han
escuchado en este ciclo?».
===========================================================
*/

export function estadoRotacion({
  elegibles = [],
  estado = new Map(),
  ciclo = 1,
  pasada = 0,
  presupuesto = 8,
  ambito = null
} = {}) {
  const atendidas = [];

  const pendientes = [];

  const diferidas = [];

  elegibles.forEach((f) => {
    const ficha = estado.get(f.url);

    const entrada = {
      feedUrl: f.url,
      sourceId: f.sourceId || null,
      publisher: f.publisher || null,
      prioridad: f.prioridad ?? null,
      territorioDeclarado: f.territorioDeclarado ?? null,

      ultimoEstado: ficha?.ultimoEstado || null,
      lastAttemptAt: ficha?.lastAttemptAt || null,
      lastSuccessAt: ficha?.lastSuccessAt || null,
      lastResultCount: ficha?.lastResultCount ?? null,
      consecutiveFailures: ficha?.consecutiveFailures || 0
    };

    if (ficha && ficha.cicloVisto === ciclo) {
      if (ficha.diferido) diferidas.push(entrada);
      else atendidas.push(entrada);
    } else {
      pendientes.push(entrada);
    }
  });

  const nuncaAtendidas = elegibles
    .filter((f) => !estado.get(f.url)?.lastAttemptAt)
    .map((f) => f.sourceId || f.url);

  /*
    La proxima cohorte SE PUEDE decir: el algoritmo es
    determinista. Cuando ocurrira NO se puede: no hay scheduler,
    y poner una fecha seria inventarla.
  */
  const siguiente = siguienteCicloYPasada({ estado, ciclo, pasada, elegibles });

  const proxima = seleccionarCohorte({
    elegibles,
    estado,
    presupuesto,
    ciclo: siguiente.ciclo,
    pasada: siguiente.pasada
  });

  return {
    ambito: ambito || null,

    feedsVerificados: elegibles.length,
    presupuestoPorPasada: presupuesto,

    ciclo,
    pasadasRegistradas: pasada,

    atendidasEnCiclo: atendidas.length,
    diferidasEnCiclo: diferidas.length,
    pendientesEnCiclo: pendientes.length,

    cobertura:
      elegibles.length > 0
        ? `${atendidas.length + diferidas.length}/${elegibles.length}`
        : "0/0",

    cicloCompleto: pendientes.length === 0 && elegibles.length > 0,

    ultimaRotacion:
      [...estado.values()]
        .map((f) => f.lastAttemptAt)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null,

    /*
      Sin demonio no hay «cuando». Se dice QUE entraria, no
      cuando entrara.
    */
    proximaRotacion: null,

    motivoProximaRotacion:
      "No hay scheduler: la próxima rotación ocurre cuando alguien pide un análisis en modo ampliado. Poner una fecha sería inventarla.",

    proximaCohorte: proxima.seleccionados.map((f) => f.sourceId || f.feedUrl),

    pendientes: pendientes.map((f) => f.sourceId || f.feedUrl),

    nuncaAtendidas,

    declaraciones: [
      "El presupuesto por pasada NO se eleva: el tope es del recolector y tiene su motivo declarado. Lo que cambia es CUÁLES entran.",
      "La selección es determinista: mismas entradas, misma cohorte. Nada de aleatorio, para que sea auditable y reproducible.",
      "Un ciclo cierra cuando cada feed elegible fue atendido o diferido una vez. Hasta entonces, ninguna fuente ya atendida repite: es lo que impide que una prioridad alta se convierta en privilegio permanente.",
      "La próxima cohorte se puede declarar porque el algoritmo es determinista. El momento no: no hay demonio de ingesta."
    ]
  };
}


export default {
  VERSION_ROTACION,
  ESTADOS_INTENTO,
  SALTOS_MAXIMOS,
  esFallo,
  clasificarIntento,
  saltosPorFallos,
  ordenDeServicio,
  seleccionarCohorte,
  anotarResultados,
  crearAlmacenMemoria,
  crearAlmacenFichero,
  ambitoDeRotacion,
  registrarRotacion,
  reconstruirRotacion,
  siguienteCicloYPasada,
  estadoRotacion
};
