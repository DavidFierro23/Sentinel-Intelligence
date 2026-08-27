// apps/backend/services/media/pieceStore.js

import {
  escribirEnLake,
  escribirLoteEnLake,
  obtenerHistorialEntidad
} from "../knowledgeLake/lakeQuery.js";

import { TIPOS_ENTIDAD, ZONAS } from "../knowledgeLake/lakeWriter.js";

import { crearAlmacenPiezas, anexarSnapshot, snapshotsDePieza } from "./pieceSnapshot.js";

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


function registroBase(entrada, contexto) {
  return {
    tenantId: contexto.tenantId || null,
    proyectoId: contexto.projectId || null,
    zona: ZONAS.RAW,

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
        entidad: pieza.canonicalUrl || pieza.url,
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
          entidad: `${pieza.canonicalUrl || pieza.url}#snapshot`,
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

    return {
      persistido: true,
      filas: filas.length,
      resultado: r || null,
      respaldoMemoria: respaldo,

      declaracion:
        "Escrito en el Knowledge Lake, que es append-only: este analisis no puede ser sobrescrito por el siguiente."
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

  try {
    const h = await obtenerHistorialEntidad(`${canonicalUrl}#snapshot`, {
      ...opciones,
      tipoEntidad: TIPOS_ENTIDAD.PUBLICACION
    });

    const delLake = (h?.versiones || h?.registros || [])
      .map((v) => v?.datos || v)
      .filter((d) => d && d.clase === "snapshot");

    /*
      Union por snapshotId: si el Lake ya lo tiene, no se cuenta
      dos veces por estar tambien en memoria.
    */
    const vistos = new Set(delLake.map((s) => s.snapshotId));

    const union = [
      ...delLake,
      ...enMemoria.filter((s) => !vistos.has(s.snapshotId))
    ];

    return {
      encontrado: union.length > 0,
      origen: delLake.length ? "knowledge_lake" : "memoria_del_proceso",
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
