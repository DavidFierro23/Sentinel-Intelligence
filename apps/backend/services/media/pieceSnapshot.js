// apps/backend/services/media/pieceSnapshot.js

import { createHash } from "node:crypto";

import { ESTADOS_HISTORICO, DISPONIBILIDAD } from "./pieceContracts.js";

/*
===========================================================
SNAPSHOTS DE UNA PIEZA — MEDIA-PIECE-01 §4
===========================================================

Una pieza se analiza hoy y se vuelve a analizar manana. El
resultado de hoy NO se sustituye: se anexa.

POR QUE APPEND-ONLY Y NO UPSERT
-----------------------------------------------------------

Un upsert sobre las metricas destruiria la unica cosa que
convierte este modulo en inteligencia y no en una captura de
pantalla: la serie. Con dos observaciones se puede decir
"crecio un 12 % en tres dias". Con un upsert solo se puede
decir "hoy tiene 500.000", que es lo mismo que mirar la pagina.

`snapshotStore` del modulo territorial ya implementa esta
doctrina para snapshots de territorio, incluido
`anexarCorreccion` para no borrar un dato erroneo sino
corregirlo con trazabilidad. Aqui se aplica el mismo criterio a
la escala de una pieza.

UN PUNTO NO ES UNA SERIE
-----------------------------------------------------------

Con una sola observacion el estado es HISTORICO_INSUFICIENTE y
`crecimiento` es `null`. Un panel que muestre "+0 %" con un
solo punto esta afirmando que no cambio, y eso no se ha
medido.

null NO SE COMPARA
-----------------------------------------------------------

Si en T0 las vistas eran 500.000 y en T1 no se pudieron leer,
la variacion NO es -500.000: es indeterminada. Comparar contra
un null produciria caidas espectaculares e imaginarias.
===========================================================
*/


export const VERSION_SNAPSHOT_PIEZA = "1.0";


/*
-----------------------------------------------------------
COMPONER

Un snapshot es la foto de las metricas en un instante, con la
procedencia de cada cifra. No incluye temas ni amplificacion:
esos cambian por razones distintas y tienen su propia serie.
-----------------------------------------------------------
*/
export function componerSnapshotPieza(entrada = {}) {
  const {
    pieceId,
    publicationId = null,
    canonicalUrl = null,
    plataforma = null,
    metricas = [],
    observedAt = new Date().toISOString(),
    projectId = null,
    candidateId = null,
    cuota = null
  } = entrada;

  const porId = {};

  metricas.forEach((m) => {
    porId[m.id] = {
      value: m.value ?? null,
      availability: m.availability,
      provider: m.provider || null,
      motivo: m.motivo || null,
      evidenceId: m.evidenceId || null
    };
  });

  const base = {
    esquema: "sentinel.media.pieza.snapshot.v1",
    version: VERSION_SNAPSHOT_PIEZA,

    snapshotId: null,

    pieceId,
    publicationId,
    canonicalUrl,
    plataforma,

    projectId,
    candidateId,

    observedAt,

    metricas: porId,

    /* Cuota gastada en producir ESTE snapshot: auditable. */
    cuota: cuota || null,

    /* Una correccion no borra: se anexa apuntando al original. */
    corrigeA: entrada.corrigeA || null,
    motivoCorreccion: entrada.motivoCorreccion || null
  };

  base.snapshotId = `snap-${createHash("sha256")
    .update(`${pieceId}|${observedAt}`)
    .digest("hex")
    .slice(0, 16)}`;

  return base;
}


/*
===========================================================
ALMACEN

En memoria para el MVP y para los tests. La persistencia real
va al Knowledge Lake (`pieceStore.js`), que ya es append-only
por construccion. Este almacen existe para que la logica de
serie sea comprobable sin tocar disco.
===========================================================
*/
export function crearAlmacenPiezas() {
  return { porPieza: new Map() };
}


export function anexarSnapshot(almacen, snapshot) {
  if (!snapshot?.pieceId) {
    return { ok: false, motivo: "El snapshot no trae pieceId." };
  }

  const lista = almacen.porPieza.get(snapshot.pieceId) || [];

  /*
    Idempotencia: dos analisis en el mismo instante producen el
    mismo snapshotId y no deben duplicar el punto. Pero NUNCA se
    sustituye: se rechaza el duplicado y se dice.
  */
  if (lista.some((s) => s.snapshotId === snapshot.snapshotId)) {
    return {
      ok: false,
      duplicado: true,
      motivo: `Ya existe un snapshot con id ${snapshot.snapshotId} (mismo instante de observacion). No se sobrescribe.`,
      total: lista.length
    };
  }

  lista.push(snapshot);

  /* Orden cronologico: la serie se lee de izquierda a derecha. */
  lista.sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));

  almacen.porPieza.set(snapshot.pieceId, lista);

  return { ok: true, total: lista.length, snapshotId: snapshot.snapshotId };
}


export function snapshotsDePieza(almacen, pieceId) {
  return [...(almacen.porPieza.get(pieceId) || [])];
}


/*
===========================================================
SERIE Y CRECIMIENTO
===========================================================

Compara el primer y el ultimo snapshot con valor leido para
cada metrica. Si una de las dos puntas es null, la variacion
es indeterminada y se dice por que.
===========================================================
*/
export function serieDePieza(snapshots = []) {
  const orden = [...snapshots].sort(
    (a, b) => new Date(a.observedAt) - new Date(b.observedAt)
  );

  if (orden.length < 2) {
    return {
      estado: ESTADOS_HISTORICO.HISTORICO_INSUFICIENTE,
      observaciones: orden.length,
      primeraObservacion: orden[0]?.observedAt || null,
      ultimaObservacion: orden[0]?.observedAt || null,
      ventanaHoras: null,
      crecimiento: null,

      declaracion:
        orden.length === 1
          ? "Una sola observacion: no hay serie. El crecimiento se podra calcular al volver a analizar la pieza."
          : "Sin observaciones registradas."
    };
  }

  const primera = orden[0];

  const ultima = orden[orden.length - 1];

  const ms = new Date(ultima.observedAt) - new Date(primera.observedAt);

  const crecimiento = {};

  ["views", "likes", "comments", "shares"].forEach((id) => {
    const a = primera.metricas?.[id];

    const b = ultima.metricas?.[id];

    const va = a?.value ?? null;

    const vb = b?.value ?? null;

    if (va == null || vb == null) {
      crecimiento[id] = {
        variacion: null,
        variacionRelativa: null,
        indeterminado: true,

        motivo:
          va == null && vb == null
            ? "La metrica no se pudo leer en ninguna de las dos observaciones."
            : va == null
              ? "No hay valor en la primera observacion: no hay base contra la que comparar."
              : "No hay valor en la ultima observacion: la ausencia no es una caida."
      };

      return;
    }

    const delta = vb - va;

    crecimiento[id] = {
      desde: va,
      hasta: vb,
      variacion: delta,
      variacionRelativa: va > 0 ? Number((delta / va).toFixed(4)) : null,
      indeterminado: false,
      motivo:
        va === 0
          ? "La base es 0: la variacion relativa no esta definida."
          : null
    };
  });

  return {
    estado: ESTADOS_HISTORICO.COMPARABLE,
    observaciones: orden.length,
    primeraObservacion: primera.observedAt,
    ultimaObservacion: ultima.observedAt,
    ventanaHoras: Number((ms / 3600000).toFixed(2)),
    crecimiento,

    declaracion: `Serie de ${orden.length} observaciones a lo largo de ${(
      ms / 3600000
    ).toFixed(1)} h. Las metricas sin valor en alguna punta quedan indeterminadas, no en cero.`
  };
}


/*
-----------------------------------------------------------
PERSISTENCIA OBSERVADA

Cuanto tiempo lleva viva la pieza y cuantas veces se ha
mirado. No es una metrica de la plataforma: es una metrica de
nuestra propia observacion, y se rotula como tal.
-----------------------------------------------------------
*/
export function persistenciaObservada(pieza, snapshots = []) {
  const pub = pieza?.publishedAt ? new Date(pieza.publishedAt) : null;

  const ahora = new Date();

  const horas =
    pub && !Number.isNaN(pub.getTime())
      ? Number(((ahora - pub) / 3600000).toFixed(1))
      : null;

  return {
    publishedAt: pieza?.publishedAt || null,

    horasDesdePublicacion: horas,

    motivoSinHoras: horas == null ? "La pieza no tiene fecha de publicacion resuelta." : null,

    observaciones: snapshots.length,

    primeraObservacion: snapshots[0]?.observedAt || null,
    ultimaObservacion: snapshots[snapshots.length - 1]?.observedAt || null,

    declaracion:
      "Mide el tiempo transcurrido y cuantas veces Sentinel observo la pieza. No mide cuanta gente la vio en ese tiempo."
  };
}


export default {
  VERSION_SNAPSHOT_PIEZA,
  componerSnapshotPieza,
  crearAlmacenPiezas,
  anexarSnapshot,
  snapshotsDePieza,
  serieDePieza,
  persistenciaObservada
};
