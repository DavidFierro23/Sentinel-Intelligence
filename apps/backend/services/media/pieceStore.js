// apps/backend/services/media/pieceStore.js

import {
  abrirLake,
  escribirEnLake,
  escribirLoteEnLake,
  obtenerHistorialEntidad
} from "../knowledgeLake/lakeQuery.js";

import { TIPOS_ENTIDAD, ZONAS, claveEntidad } from "../knowledgeLake/lakeWriter.js";

import { crearAlmacenPiezas, anexarSnapshot, snapshotsDePieza } from "./pieceSnapshot.js";

import { normalizarUrl } from "../textUtils.js";


/*
  La clave de entidad tiene que ser ESTABLE entre ejecuciones, o
  el Lake guarda la misma pieza dos veces y el historico no la
  encuentra. Se normaliza siempre, tanto al escribir como al
  leer.
*/
function claveDePieza(url) {
  return normalizarUrl(String(url || "")) || String(url || "");
}

/*
===========================================================
PERSISTENCIA DE UNA PIEZA — MEDIA-PIECE-01 §18
===========================================================

Se escribe en el Knowledge Lake, que ya es append-only por
construccion (`OPERACIONES_PROHIBIDAS` incluye borrar y
sobrescribir). No se crea ningun almacen nuevo.

QUE SE ESCRIBE Y COMO
-----------------------------------------------------------

    la pieza          -> tipoEntidad PUBLICACION
    el emisor         -> tipoEntidad MEDIO
    cada snapshot     -> tipoEntidad PUBLICACION, otra fila
    cada relacion     -> tipoEntidad PUBLICACION con la arista
    cada pieza ajena  -> tipoEntidad PUBLICACION

Todas comparten `proyectoId`, de modo que
`obtenerEventosProyecto` las recupera juntas y el modulo
funciona con cualquier proyecto sin nada codificado a mano.

POR QUE EL LAKE Y NO UNA TABLA PROPIA
-----------------------------------------------------------

Porque la comparacion entre dos analisis de la misma pieza —el
valor entero de este gate— exige que el analisis de hoy siga
existiendo manana sin que nadie lo haya tocado. El Lake ya
garantiza eso y ya sabe versionar. Una tabla propia tendria
que reimplementar la garantia y podria divergir.

DEGRADACION SIN ROMPER
-----------------------------------------------------------

Si el Lake no esta disponible, `guardarAnalisis` devuelve
`persistido: false` con el motivo y el analisis se entrega
igual. Un fallo de escritura no puede impedir que el analista
vea el resultado que ya se calculo.
===========================================================
*/


/* Almacen en memoria: respaldo cuando el Lake no responde. */
const memoria = crearAlmacenPiezas();


/*
  DT1 exige `tenantId` y DT3 exige `linaje.submotor`. Sin ellos
  `validarRegistro` RECHAZA la fila.

  Estaban ausentes, asi que el Lake rechazaba las 18 filas de
  cada analisis mientras `guardarAnalisis` informaba
  `persistido: true`. El analisis parecia guardado y no lo
  estaba: el peor de los dos errores, porque nadie lo miraba.
*/
const TENANT_POR_DEFECTO = "sentinel-local";

const SUBMOTOR = "media_piece";


function registroBase(entrada, contexto) {
  return {
    tenantId: contexto.tenantId || TENANT_POR_DEFECTO,
    proyectoId: contexto.projectId || null,
    zona: ZONAS.RAW,

    linaje: {
      submotor: SUBMOTOR,
      cadena: [entrada.paso || "analizar_pieza"]
    },

    fuente: entrada.fuente || null,
    motorOrigen: entrada.motorOrigen || "media_piece_01",
    consulta: entrada.consulta ?? null,

    urlOriginal: entrada.urlOriginal ?? null,
    urlCanonica: entrada.urlCanonica ?? null,

    fechaHecho: entrada.fechaHecho ?? null,
    fechaDeteccion: contexto.observedAt || new Date().toISOString(),

    ...entrada
  };
}


/*
===========================================================
GUARDAR
===========================================================
*/
export async function guardarAnalisis(analisis, opciones = {}) {
  const contexto = {
    projectId: analisis?.entrada?.projectId || null,
    tenantId: opciones.tenantId || null,
    observedAt: analisis?.observedAt || new Date().toISOString()
  };

  const pieza = analisis?.pieza;

  if (!pieza?.pieceId) {
    return { persistido: false, motivo: "El analisis no trae pieza." };
  }

  /* Respaldo en memoria: siempre, y antes de intentar el Lake. */
  const respaldo = anexarSnapshot(memoria, analisis.snapshot);

  const filas = [];

  /* --- la pieza --- */
  filas.push(
    registroBase(
      {
        entidad: claveDePieza(pieza.canonicalUrl || pieza.url),
        tipoEntidad: TIPOS_ENTIDAD.PUBLICACION,
        fuente: pieza.dominio || null,
        urlOriginal: pieza.url,
        urlCanonica: pieza.canonicalUrl,
        fechaHecho: pieza.publishedAt || null,

        datos: {
          clase: "pieza",
          pieceId: pieza.pieceId,
          publicationId: pieza.publicationId,
          plataforma: pieza.plataforma,
          contentType: pieza.contentType,
          titulo: pieza.titulo,
          autor: pieza.autor,
          evidenceId: pieza.evidenceId,
          emisor: analisis.emisor || null
        }
      },
      contexto
    )
  );

  /* --- el emisor --- */
  if (analisis.emisor?.dominio) {
    filas.push(
      registroBase(
        {
          entidad: analisis.emisor.dominio,
          tipoEntidad: TIPOS_ENTIDAD.MEDIO,
          fuente: analisis.emisor.dominio,
          urlCanonica: `https://${analisis.emisor.dominio}`,

          datos: {
            clase: "emisor",
            claseEmisor: analisis.emisor.clase,
            nombre: analisis.emisor.nombre,
            procedencia: analisis.emisor.procedencia,
            razones: analisis.emisor.razones
          }
        },
        contexto
      )
    );
  }

  /* --- el snapshot (nunca sustituye a otro) --- */
  if (analisis.snapshot) {
    filas.push(
      registroBase(
        {
          entidad: `${claveDePieza(pieza.canonicalUrl || pieza.url)}#snapshot`,
          tipoEntidad: TIPOS_ENTIDAD.PUBLICACION,
          fuente: pieza.dominio || null,
          urlCanonica: pieza.canonicalUrl,
          fechaHecho: analisis.snapshot.observedAt,

          datos: { clase: "snapshot", ...analisis.snapshot }
        },
        contexto
      )
    );
  }

  /* --- las piezas de la amplificacion --- */
  (analisis.amplificacion?.nodos || []).forEach((n) => {
    filas.push(
      registroBase(
        {
          entidad: n.canonicalUrl || n.url,
          tipoEntidad: TIPOS_ENTIDAD.PUBLICACION,
          fuente: n.dominio || null,
          urlOriginal: n.url,
          urlCanonica: n.canonicalUrl,
          fechaHecho: n.publishedAt || null,
          consulta: n.consultaOrigen || null,

          datos: {
            clase: "pieza_amplificacion",
            piezaOrigen: pieza.pieceId,
            rol: n.rol,
            rolRazones: n.rolRazones,
            similitudTitular: n.similitudTitular,
            emisor: n.emisor,
            evidenceId: n.evidenceId
          }
        },
        contexto
      )
    );
  });

  /* --- las relaciones con el candidato --- */
  const rels = [
    ...(analisis.candidato?.relaciones || []),
    ...(analisis.candidato?.relacionesAmplificacion || [])
  ];

  rels.forEach((r) => {
    filas.push(
      registroBase(
        {
          entidad: `${r.source}->${r.target}`,
          tipoEntidad: TIPOS_ENTIDAD.PUBLICACION,
          fuente: r.source || null,
          fechaHecho: r.timestamp || null,

          datos: { clase: "relacion", ...r }
        },
        contexto
      )
    );
  });

  try {
    const r = await escribirLoteEnLake(filas, opciones);

    /*
      `escribirLoteEnLake` NO lanza cuando el Lake rechaza una
      fila: devuelve el recuento. Informar `persistido: true` sin
      mirarlo era afirmar un guardado que no ocurrio.
    */
    const escritos = r?.escritos ?? 0;

    const rechazados = r?.rechazados ?? 0;

    const motivosRechazo = [
      ...new Set(
        (r?.resultados || [])
          .filter((x) => x && x.escrito === false)
          .flatMap((x) => x.errores || [x.motivo])
          .filter(Boolean)
      )
    ];

    return {
      persistido: escritos > 0,

      filas: filas.length,
      escritos,
      rechazados,
      omitidosSinCambios: r?.omitidosSinCambios ?? 0,
      motivosRechazo,

      resultado: r || null,
      respaldoMemoria: respaldo,

      declaracion:
        escritos > 0
          ? `Escritas ${escritos} de ${filas.length} filas en el Knowledge Lake, que es append-only: este analisis no puede ser sobrescrito por el siguiente.`
          : `El Lake rechazo las ${filas.length} filas. El analisis se entrega igual y queda en el respaldo en memoria de este proceso.`
    };
  } catch (error) {
    return {
      persistido: false,
      filas: filas.length,
      motivo: `El Lake no acepto la escritura: ${error?.message || "error desconocido"}. El analisis se entrega igual y queda en el respaldo en memoria de este proceso.`,
      respaldoMemoria: respaldo
    };
  }
}


/*
===========================================================
RELEER
===========================================================

Historial de una pieza: todos los snapshots guardados para su
URL canonica. Es lo que permite decir "crecio" en el segundo
analisis.
===========================================================
*/
export async function historialDePieza(canonicalUrl, opciones = {}) {
  const enMemoria = snapshotsDePieza(memoria, opciones.pieceId || "");

  const clave = `${claveDePieza(canonicalUrl)}#snapshot`;

  try {
    /*
      Se pasa `claveEntidad`: el Lake se niega —con razon— a
      elegir entre entidades parecidas y devuelve `ambigua`. Con
      la clave exacta no hay nada que elegir.
    */
    /*
      Se construye la clave interna EXACTA con la misma funcion
      que la genero al escribir. Sin ella el Lake responde
      `ambigua` y se niega a elegir —con razon—, y el historico
      volvia vacio aunque los snapshots estuvieran guardados.
    */
    const claveInterna =
      opciones.claveEntidad ||
      claveEntidad({
        tenantId: opciones.tenantId || TENANT_POR_DEFECTO,
        proyectoId: opciones.proyectoId || null,
        tipoEntidad: TIPOS_ENTIDAD.PUBLICACION,
        entidad: clave
      });

    const h = await obtenerHistorialEntidad(clave, {
      ...opciones,
      claveEntidad: claveInterna,
      tipoEntidad: TIPOS_ENTIDAD.PUBLICACION
    });

    /*
      -------------------------------------------------------
      MEDIA-UX-HOME-01 — los snapshots se leen del INDICE

      `obtenerHistorialEntidad` devuelve el historial de
      VERSIONES: version, hash, fechas, motivo del cambio e
      integridad. Es lo que necesita una auditoria de cadena, y
      NO incluye `datos`.

      Asi que el filtro `clase === "snapshot"` no encontraba
      nunca nada y el historico volvia vacio aunque el Lake
      tuviera los snapshots guardados. El fallo era invisible
      porque el respaldo en memoria si los tenia: dentro de una
      misma sesion el panel se veia correcto, y solo al
      reiniciar el backend aparecia el hueco.

      Se leen los registros completos del indice por su entidad.
      Se conserva la llamada anterior porque su `cobertura` sigue
      siendo la que se declara al consumidor.

      Se consulta ademas la clave con esquema: la misma pieza se
      guardo bajo `https://x.com/...` antes de que
      MEDIA-REAL-DEMO-01 estabilizara la canonica, y esas filas
      no se borran porque el Lake es append-only.
      -------------------------------------------------------
    */
    const lake = await abrirLake(opciones.lake || {});

    const crudos = [
      ...lake.indice.buscar("entidad", clave),
      ...lake.indice.buscar("entidad", `https://${clave}`)
    ];

    const delProyecto = opciones.proyectoId
      ? crudos.filter((r) => r.proyectoId === opciones.proyectoId)
      : crudos;

    const delLake = delProyecto
      .map((r) => r?.datos)
      .filter((d) => d && d.clase === "snapshot");

    /*
      Union por snapshotId: si el Lake ya lo tiene, no se cuenta
      dos veces por estar tambien en memoria.
    */
    /*
      Deduplicado por `snapshotId`: leer las dos claves puede
      traer la misma observacion dos veces, y un snapshot
      repetido inventaria un punto en la serie.
    */
    const porId = new Map();

    delLake.forEach((s) => {
      if (s?.snapshotId && !porId.has(s.snapshotId)) porId.set(s.snapshotId, s);
    });

    const unicos = [...porId.values()];

    const vistos = new Set(unicos.map((s) => s.snapshotId));

    const union = [
      ...unicos,
      ...enMemoria.filter((s) => !vistos.has(s.snapshotId))
    ];

    return {
      encontrado: union.length > 0,
      origen: unicos.length ? "knowledge_lake" : "memoria_del_proceso",
      snapshots: union.sort(
        (a, b) => new Date(a.observedAt) - new Date(b.observedAt)
      ),
      cobertura: h?.cobertura || null
    };
  } catch (error) {
    return {
      encontrado: enMemoria.length > 0,
      origen: "memoria_del_proceso",
      snapshots: enMemoria,
      motivo: `No se pudo leer el Lake: ${error?.message || "error desconocido"}.`
    };
  }
}


export function snapshotsEnMemoria(pieceId) {
  return snapshotsDePieza(memoria, pieceId);
}


export default {
  guardarAnalisis,
  historialDePieza,
  snapshotsEnMemoria
};
