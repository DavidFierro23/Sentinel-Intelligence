// apps/backend/services/media/mediaUniverseStore.js

import { abrirLake, escribirLoteEnLake } from "../knowledgeLake/lakeQuery.js";

import { TIPOS_ENTIDAD, ZONAS } from "../knowledgeLake/lakeWriter.js";

import { leerCorpusDeProyecto } from "./mediaCorpus.js";

import {
  SUBMOTOR_UNIVERSO,
  VERSION_UNIVERSO_MEDIOS,
  descubrirDesdeCorpus,
  declararEntidad,
  editarEntidad,
  verificarEntidad,
  desactivarEntidad,
  reactivarEntidad,
  coberturaDeEntidad,
  resumirUniverso,
  debenFundirse,
  fundir
} from "./mediaSourceUniverse.js";

/*
===========================================================
MEDIA-SOURCE-UNIVERSE-01 — PERSISTENCIA DEL UNIVERSO
===========================================================

Guarda y lee las entidades media de un proyecto en el Knowledge
Lake. No se crea ningun almacen nuevo: el Lake ya es append-only
y ya versiona, que es exactamente lo que pide «desactivar no
borra» y «editar conserva historia».

DOS PLANOS QUE NO SE MEZCLAN
-----------------------------------------------------------

    DESCUBIERTO   se deriva del corpus en cada lectura
    PERSISTIDO    lo que un analista declaro, edito o verifico

El descubrimiento NO se persiste. Si se guardara, cada analisis
nuevo produciria filas de entidades que ya se pueden derivar, y
al mejorar el clasificador manana quedarian congeladas las
entidades mal tipadas de hoy.

Lo que si se persiste es la INTERVENCION HUMANA: una entidad
declarada, una verificacion, una edicion, una baja. Eso no se
puede derivar de nada y se perderia al reiniciar.

Al leer, los dos planos se FUNDEN: sobre la entidad derivada se
aplica lo que el analista dijo, y lo declarado gana sobre lo
inferido porque una persona miro.

T4 esta migrando a PostgreSQL en paralelo. Este modulo usa la
API publica del Lake y no toca adaptadores, formato ni
configuracion de almacenamiento.
===========================================================
*/

const TENANT_POR_DEFECTO = "sentinel-local";


function filaDeEntidad(entidad, { tenantId, accion }) {
  return {
    tenantId: tenantId || TENANT_POR_DEFECTO,
    proyectoId: entidad.projectId,
    zona: ZONAS.RAW,

    linaje: {
      submotor: SUBMOTOR_UNIVERSO,
      cadena: [accion]
    },

    motorOrigen: "media_source_universe_01",
    fuente: entidad.activos.find((a) => a.dominio)?.dominio || null,
    consulta: null,

    urlOriginal: null,
    urlCanonica: entidad.activos.find((a) => a.clase === "DOMINIO")?.url || null,

    fechaHecho: entidad.firstObservedAt,
    fechaDeteccion: entidad.lastObservedAt,

    entidad: entidad.mediaEntityId,
    tipoEntidad: TIPOS_ENTIDAD.MEDIO,

    datos: {
      clase: "entidad_media",
      version: VERSION_UNIVERSO_MEDIOS,
      ...entidad
    }
  };
}


/*
===========================================================
GUARDAR UNA INTERVENCION DEL ANALISTA
===========================================================
*/
export async function guardarEntidad(entidad, opciones = {}) {
  if (!entidad?.mediaEntityId || !entidad?.projectId) {
    return {
      persistido: false,
      motivo: "Una entidad media exige mediaEntityId y projectId."
    };
  }

  const fila = filaDeEntidad(entidad, {
    tenantId: opciones.tenantId,
    accion: opciones.accion || "declarar_entidad_media"
  });

  try {
    const r = await escribirLoteEnLake([fila], opciones.lake || {});

    const escritos = r?.escritos ?? 0;

    return {
      persistido: escritos > 0,
      escritos,
      rechazados: r?.rechazados ?? 0,

      motivosRechazo: [
        ...new Set(
          (r?.resultados || [])
            .filter((x) => x && x.escrito === false)
            .flatMap((x) => x.errores || [x.motivo])
            .filter(Boolean)
        )
      ],

      declaracion:
        escritos > 0
          ? "Escrita en el Knowledge Lake, que es append-only: la version anterior de esta entidad sigue existiendo."
          : "El Lake rechazo la escritura."
    };
  } catch (error) {
    return {
      persistido: false,
      motivo: `El Lake no acepto la escritura: ${error?.message || "error desconocido"}.`
    };
  }
}


/*
===========================================================
LEER LAS ENTIDADES PERSISTIDAS DE UN PROYECTO
===========================================================
*/
export async function leerEntidadesPersistidas({ projectId, tenantId, lake = {} } = {}) {
  if (!projectId) return [];

  const instancia = await abrirLake(lake);

  const delProyecto = instancia.indice.buscar("proyecto", projectId);

  const vigentes = instancia.lector
    .aplicarFiltros(delProyecto, {
      tenantId: tenantId || TENANT_POR_DEFECTO,
      soloVigentes: true
    })
    .filter(
      (r) =>
        r?.linaje?.submotor === SUBMOTOR_UNIVERSO &&
        r?.datos?.clase === "entidad_media"
    );

  return vigentes.map((r) => {
    const { clase, version, ...entidad } = r.datos;

    return entidad;
  });
}


/*
===========================================================
EL UNIVERSO DE UN PROYECTO — descubierto + persistido
===========================================================
*/
export async function universoDeProyecto(opciones = {}) {
  const projectId = String(opciones.projectId || "").trim();

  if (!projectId) {
    return {
      ok: false,
      motivo:
        "Falta projectId. El universo de medios es POR PROYECTO: sin el, se mezclarian los medios de dos campanas."
    };
  }

  const corpus = await leerCorpusDeProyecto(opciones);

  if (!corpus.ok) return { ok: false, motivo: corpus.motivo };

  const piezas = [...corpus.piezas, ...corpus.amplificacion];

  const descubierto = descubrirDesdeCorpus({ piezas, projectId });

  const persistidas = await leerEntidadesPersistidas({
    projectId,
    tenantId: opciones.tenantId,
    lake: opciones.lake || {}
  });

  /*
    -----------------------------------------------------------
    FUSION DE LOS DOS PLANOS

    Se parte de lo descubierto y se superpone lo persistido. Lo
    declarado gana sobre lo inferido —una persona miro— pero no
    borra lo observado: los activos y las evidencias se acumulan
    con las reglas de `fundir`, que no pierde nada.
    -----------------------------------------------------------
  */
  const porId = new Map(descubierto.entidades.map((e) => [e.mediaEntityId, e]));

  const fusiones = [];

  persistidas.forEach((p) => {
    const derivada = porId.get(p.mediaEntityId);

    if (!derivada) {
      porId.set(p.mediaEntityId, p);

      return;
    }

    /*
      La entidad persistida es la base: conserva nombre, tipo,
      alias, verificacion e historial que alguien decidio. Sobre
      ella se funden los activos y las evidencias observadas.
    */
    const combinada = fundir({ ...p }, derivada);

    combinada.piezasObservadas = derivada.piezasObservadas;

    fusiones.push({
      mediaEntityId: p.mediaEntityId,
      motivo: "La declaracion del analista se superpone a lo derivado del corpus."
    });

    porId.set(p.mediaEntityId, combinada);
  });

  const entidades = [...porId.values()];

  /*
    Deduplicacion entre entidades del universo. Solo une con
    señal fuerte; los casos de mismo nombre y distinto dominio se
    DECLARAN sin unirse, para que el analista decida.
  */
  const { fundidas, candidatasNoFundidas } = deduplicar(entidades);

  const conCobertura = fundidas.map((e) => ({
    ...e,
    cobertura: coberturaDeEntidad(e)
  }));

  return {
    ok: true,
    gate: "MEDIA-SOURCE-UNIVERSE-01",
    version: VERSION_UNIVERSO_MEDIOS,

    projectId,

    entidades: conCobertura.sort(
      (a, b) =>
        b.piezasObservadas - a.piezasObservadas ||
        String(a.canonicalName || "").localeCompare(String(b.canonicalName || ""))
    ),

    artefactosExcluidos: descubierto.artefactosExcluidos,

    sinResolver: descubierto.sinResolver,

    /*
      Pares que comparten nombre y NO se unieron. Es informacion,
      no un error: el analista puede declarar el alias que los
      una, o confirmar que son dos medios distintos.
    */
    posiblesDuplicados: candidatasNoFundidas,

    fusionesAplicadas: fusiones,

    resumen: resumirUniverso(conCobertura, {
      artefactos: descubierto.artefactosExcluidos,
      sinResolver: descubierto.sinResolver
    }),

    procedencia: {
      derivadasDelCorpus: descubierto.entidades.length,
      persistidas: persistidas.length,

      declaracion:
        "El descubrimiento se deriva del corpus en cada lectura y no se persiste; lo que se guarda es la intervencion del analista. Al leer, los dos planos se funden y lo declarado gana sobre lo inferido."
    },

    aislamiento: corpus.aislamiento,

    noEsRanking:
      "Estar en el universo significa que Sentinel conoce esta fuente dentro del proyecto. No significa importante, popular ni influyente."
  };
}


function deduplicar(entidades) {
  const fundidas = [];

  const candidatasNoFundidas = [];

  entidades.forEach((e) => {
    const destino = fundidas.find((f) => debenFundirse(f, e).fundir);

    if (destino) {
      fundir(destino, e);

      return;
    }

    const mismoNombre = fundidas.find((f) => debenFundirse(f, e).mismoNombre);

    if (mismoNombre) {
      candidatasNoFundidas.push({
        a: mismoNombre.mediaEntityId,
        b: e.mediaEntityId,
        nombre: e.canonicalName,
        motivo: debenFundirse(mismoNombre, e).motivo
      });
    }

    fundidas.push(e);
  });

  return { fundidas, candidatasNoFundidas };
}


/*
===========================================================
OPERACIONES QUE PERSISTEN
===========================================================
*/

export async function declararYGuardar(entrada = {}) {
  const entidad = declararEntidad(entrada);

  if (!entidad.mediaEntityId) {
    return {
      ok: false,
      motivo:
        "No se puede identificar la entidad: hace falta al menos un sitio web, un dominio o un nombre."
    };
  }

  const r = await guardarEntidad(entidad, {
    tenantId: entrada.tenantId,
    lake: entrada.lake,
    accion: "declarar_entidad_media"
  });

  return { ok: r.persistido, entidad, persistencia: r };
}


async function cargarUna(projectId, mediaEntityId, opciones) {
  const persistidas = await leerEntidadesPersistidas({
    projectId,
    tenantId: opciones?.tenantId,
    lake: opciones?.lake || {}
  });

  const guardada = persistidas.find((e) => e.mediaEntityId === mediaEntityId);

  if (guardada) return guardada;

  /*
    Si nunca se guardo, se recupera la derivada del corpus para
    poder intervenirla. Verificar una entidad descubierta es un
    caso normal, no un error.
  */
  const u = await universoDeProyecto({ projectId, ...opciones });

  if (!u.ok) return null;

  return u.entidades.find((e) => e.mediaEntityId === mediaEntityId) || null;
}


export async function editarYGuardar({ projectId, mediaEntityId, cambios, por, ...opciones }) {
  const entidad = await cargarUna(projectId, mediaEntityId, opciones);

  if (!entidad) return { ok: false, motivo: "No existe esa entidad en este proyecto." };

  const editada = editarEntidad(entidad, cambios || {}, { por });

  const r = await guardarEntidad(editada, { ...opciones, accion: "editar_entidad_media" });

  return { ok: r.persistido, entidad: editada, persistencia: r };
}


export async function verificarYGuardar({ projectId, mediaEntityId, por, motivo, ...opciones }) {
  const entidad = await cargarUna(projectId, mediaEntityId, opciones);

  if (!entidad) return { ok: false, motivo: "No existe esa entidad en este proyecto." };

  const r = verificarEntidad(entidad, { por, motivo });

  if (!r.verificada) return { ok: false, motivo: r.motivo };

  const p = await guardarEntidad(r.entidad, {
    ...opciones,
    accion: "verificar_entidad_media"
  });

  return { ok: p.persistido, entidad: r.entidad, persistencia: p };
}


export async function cambiarActividad({
  projectId,
  mediaEntityId,
  activa,
  por,
  motivo,
  ...opciones
}) {
  const entidad = await cargarUna(projectId, mediaEntityId, opciones);

  if (!entidad) return { ok: false, motivo: "No existe esa entidad en este proyecto." };

  const cambiada = activa
    ? reactivarEntidad(entidad, { por })
    : desactivarEntidad(entidad, { por, motivo });

  const p = await guardarEntidad(cambiada, {
    ...opciones,
    accion: activa ? "reactivar_entidad_media" : "desactivar_entidad_media"
  });

  return {
    ok: p.persistido,
    entidad: cambiada,
    persistencia: p,

    declaracion:
      "Desactivar NO borra: los activos, las evidencias y la historia de esta entidad siguen en el Lake."
  };
}


export default {
  guardarEntidad,
  leerEntidadesPersistidas,
  universoDeProyecto,
  declararYGuardar,
  editarYGuardar,
  verificarYGuardar,
  cambiarActividad
};
