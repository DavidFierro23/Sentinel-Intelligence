// apps/backend/services/media/pieceMetrics.js

import {
  resolverVideos,
  estaConfigurado as youtubeConfigurado,
  DISPONIBILIDAD_METRICA,
  ID as YOUTUBE_PROVIDER_ID
} from "../ingest/adapters/youtubeAdapter.js";

import { capacidad, ESTADOS_CAPACIDAD } from "../intelligence/socialCapabilityMatrix.js";

import {
  PLATAFORMAS,
  DISPONIBILIDAD,
  METRICAS_PIEZA,
  metricaVacia,
  metricaLeida
} from "./pieceContracts.js";

/*
===========================================================
METRICAS OBSERVABLES DE UNA PIEZA — MEDIA-PIECE-01 §3
===========================================================

Cuatro metricas: views, likes, comments, shares.

De las cinco plataformas, HOY solo una entrega metricas de una
publicacion de un TERCERO sin autorizacion del titular:
YouTube. Eso no es una opinion de este fichero: esta medido en
produccion y declarado en `socialCapabilityMatrix`
(`verificacion: MEDIDO_EN_PRODUCCION`).

POR QUE SE CONSULTA LA MATRIZ Y NO SE ESCRIBE AQUI EL MOTIVO
-----------------------------------------------------------

Si este fichero escribiera "Instagram requiere autorizacion",
habria dos verdades sobre lo mismo y con el tiempo divergirian.
La matriz es la fuente unica: aqui se traduce su estado al
contrato de metrica y se copia SU nota como motivo. Cuando la
matriz cambie —porque se consiga un permiso o caiga una API—
este fichero no necesita tocarse.

null NO ES 0
-----------------------------------------------------------

Es la regla mas importante del gate. Una metrica que no se
pudo leer vale `null` y declara por que. Un `0` afirma que se
midio y salio cero, que es una afirmacion distinta y casi
siempre falsa.

`OCULTO_POR_LA_CUENTA` merece su propio estado: un canal que
esconde sus "me gusta" no es lo mismo que una API que no los
expone. El primero es una decision del titular; el segundo, un
limite de la plataforma.
===========================================================
*/


/* Traduccion del estado de la matriz al contrato de metrica. */
const MAPA_ESTADO = Object.freeze({
  [ESTADOS_CAPACIDAD.DISPONIBLE]: DISPONIBILIDAD.DISPONIBLE,
  [ESTADOS_CAPACIDAD.NO_DISPONIBLE]: DISPONIBILIDAD.NO_DISPONIBLE,
  [ESTADOS_CAPACIDAD.REQUIERE_AUTORIZACION]: DISPONIBILIDAD.REQUIERE_AUTORIZACION,
  [ESTADOS_CAPACIDAD.REQUIERE_PROVEEDOR_EXTERNO]: DISPONIBILIDAD.REQUIERE_PROVEEDOR
});


/*
-----------------------------------------------------------
PLAN DE LECTURA

Antes de pedir nada se declara QUE se va a pedir y que no. La
UI muestra este plan aunque la lectura falle, y §17 exige
poder mostrar los requests planeados antes de ejecutarlos.
-----------------------------------------------------------
*/
export function planDeMetricas(pieza) {
  const plataforma = pieza?.plataforma || PLATAFORMAS.WEB;

  if (plataforma === PLATAFORMAS.WEB) {
    return {
      plataforma,
      lecturaPosible: false,
      requests: [],

      metricas: METRICAS_PIEZA.map((m) =>
        metricaVacia(
          m.id,
          DISPONIBILIDAD.NO_DISPONIBLE,
          "Una pagina web no publica contadores de interaccion. Estas metricas pertenecen a las plataformas sociales."
        )
      ),

      nota:
        "La pieza es una pagina web: no hay metricas de plataforma. Su alcance solo seria observable con analytics del propio medio, que no tenemos."
    };
  }

  const requests = [];

  const metricas = METRICAS_PIEZA.map((m) => {
    const cap = capacidad(plataforma, m.capacidad);

    const disp = MAPA_ESTADO[cap.estado] || DISPONIBILIDAD.NO_DISPONIBLE;

    if (disp === DISPONIBILIDAD.DISPONIBLE) {
      /* Se marcara como leida cuando la lectura ocurra. */
      return metricaVacia(
        m.id,
        DISPONIBILIDAD.DISPONIBLE,
        `Capacidad declarada disponible: ${cap.nota}`,
        plataforma === PLATAFORMAS.YOUTUBE ? YOUTUBE_PROVIDER_ID : null
      );
    }

    return metricaVacia(m.id, disp, cap.nota, null);
  });

  const alguna = metricas.some((m) => m.availability === DISPONIBILIDAD.DISPONIBLE);

  if (plataforma === PLATAFORMAS.YOUTUBE && alguna) {
    if (!pieza?.publicationId) {
      return {
        plataforma,
        lecturaPosible: false,
        requests: [],
        metricas: metricas.map((m) =>
          m.availability === DISPONIBILIDAD.DISPONIBLE
            ? metricaVacia(
                m.id,
                DISPONIBILIDAD.NO_DISPONIBLE,
                "La API acepta un videoId y la URL no permitio extraerlo."
              )
            : m
        ),
        nota: "Sin videoId no se puede consultar la API de YouTube."
      };
    }

    if (!youtubeConfigurado()) {
      return {
        plataforma,
        lecturaPosible: false,
        requests: [],
        metricas: metricas.map((m) =>
          m.availability === DISPONIBILIDAD.DISPONIBLE
            ? metricaVacia(
                m.id,
                DISPONIBILIDAD.REQUIERE_AUTORIZACION,
                "YOUTUBE_API_KEY no esta configurada en este entorno."
              )
            : m
        ),
        nota:
          "La capacidad existe y esta medida, pero falta la credencial YOUTUBE_API_KEY."
      };
    }

    requests.push({
      proveedor: YOUTUBE_PROVIDER_ID,
      endpoint: "videos.list",
      params: { part: "snippet,statistics", id: pieza.publicationId },
      costeUnidades: 1,
      devuelve: ["views", "likes", "comments"],
      noDevuelve: ["shares"]
    });
  }

  return {
    plataforma,
    lecturaPosible: requests.length > 0,
    requests,
    metricas,
    nota: null
  };
}


/*
===========================================================
LEER LAS METRICAS

Una sola llamada, un solo video, 1 unidad de cuota. No hay
lotes ni reintentos: §6 prohibe consultas masivas y una
metrica no vale una tormenta de peticiones.
===========================================================
*/
export async function leerMetricas(pieza, opciones = {}) {
  const plan = planDeMetricas(pieza);

  const observedAt = opciones.observedAt || new Date().toISOString();

  const cuota = { youtube: { unidadesConsumidas: 0, llamadas: 0 } };

  if (!plan.lecturaPosible) {
    return {
      metricas: plan.metricas,
      plan,
      cuota,
      evidenciasDeMetrica: [],
      estado: "SIN_LECTURA",
      motivo: plan.nota
    };
  }

  if (plan.plataforma === PLATAFORMAS.YOUTUBE) {
    const r = await resolverVideos([pieza.publicationId], {
      fetch: opciones.fetch
    });

    cuota.youtube.unidadesConsumidas = r.unidadesConsumidas || 0;
    cuota.youtube.llamadas = 1;

    if (r.estado !== "OK" || !r.videos?.length) {
      const motivo =
        r.estado === "CUOTA_AGOTADA"
          ? r.motivo || "Cuota diaria de YouTube agotada."
          : r.estado === "SIN_CREDENCIAL"
            ? "YOUTUBE_API_KEY no configurada."
            : r.motivo ||
              "La API no devolvio el video: puede ser privado, borrado o el id no existir.";

      return {
        metricas: plan.metricas.map((m) =>
          m.availability === DISPONIBILIDAD.DISPONIBLE
            ? metricaVacia(m.id, DISPONIBILIDAD.NO_DISPONIBLE, motivo, YOUTUBE_PROVIDER_ID)
            : m
        ),
        plan,
        cuota,
        evidenciasDeMetrica: [],
        estado: r.estado,
        motivo
      };
    }

    const v = r.videos[0];

    /*
      La evidencia de la metrica: sin ella una cifra no es
      verificable. Su evidenceId es el que se cita en la UI.
    */
    const evidenciaMetrica = {
      evidenceId: `ev-metric-${plan.plataforma}-${v.videoId}-${observedAt}`,
      tipo: "lectura_de_metricas",
      provider: YOUTUBE_PROVIDER_ID,
      canonicalUrl: v.canonicalUrl,
      observedAt,
      endpoint: "videos.list?part=snippet,statistics",
      unidadesConsumidas: cuota.youtube.unidadesConsumidas
    };

    const traducir = (id, m) => {
      if (!m) {
        return metricaVacia(
          id,
          DISPONIBILIDAD.NO_DISPONIBLE,
          "La API no incluyo esta metrica.",
          YOUTUBE_PROVIDER_ID
        );
      }

      if (m.availability === DISPONIBILIDAD_METRICA.DISPONIBLE) {
        return metricaLeida(id, m.value, {
          observedAt,
          provider: YOUTUBE_PROVIDER_ID,
          evidenceId: evidenciaMetrica.evidenceId
        });
      }

      return metricaVacia(
        id,
        m.availability === DISPONIBILIDAD_METRICA.OCULTO_POR_LA_CUENTA
          ? DISPONIBILIDAD.OCULTO_POR_LA_CUENTA
          : DISPONIBILIDAD.NO_DISPONIBLE,
        m.motivo,
        YOUTUBE_PROVIDER_ID
      );
    };

    const metricas = [
      traducir("views", v.metricas.views),
      traducir("likes", v.metricas.likes),
      traducir("comments", v.metricas.comments),

      /* La matriz ya declara que la API no expone compartidos. */
      plan.metricas.find((m) => m.id === "shares") ||
        metricaVacia(
          "shares",
          DISPONIBILIDAD.NO_DISPONIBLE,
          "La API de YouTube no expone compartidos por video en ningun part."
        )
    ];

    return {
      metricas,
      plan,
      cuota,

      /*
        Datos que la lectura trajo de paso y que mejoran la
        pieza: titulo real y fecha real, ya no declarados por el
        analista sino por la plataforma.
      */
      enriquecimiento: {
        titulo: v.title || null,
        publishedAt: v.publishedAt || null,
        canonicalUrl: v.canonicalUrl,
        cuenta: v.channelTitle || null,
        cuentaId: v.channelId || null,
        procedencia: `${YOUTUBE_PROVIDER_ID}:videos.list`
      },

      evidenciasDeMetrica: [evidenciaMetrica],
      estado: "OK",
      motivo: null
    };
  }

  return {
    metricas: plan.metricas,
    plan,
    cuota,
    evidenciasDeMetrica: [],
    estado: "SIN_LECTURA",
    motivo: "Plataforma sin lectura implementada en este gate."
  };
}


/*
-----------------------------------------------------------
RESUMEN PARA LA UI

Cuenta cuantas se pudieron leer y cuantas no, con el porque
agrupado. Un panel que solo muestra las leidas oculta el
tamano real del hueco.
-----------------------------------------------------------
*/
export function resumirDisponibilidad(metricas = []) {
  const porEstado = {};

  metricas.forEach((m) => {
    porEstado[m.availability] = (porEstado[m.availability] || 0) + 1;
  });

  const leidas = metricas.filter(
    (m) => m.availability === DISPONIBILIDAD.DISPONIBLE && m.value != null
  );

  return {
    total: metricas.length,
    leidas: leidas.length,
    ausentes: metricas.length - leidas.length,
    porEstado,

    declaracion:
      leidas.length === 0
        ? "Ninguna metrica de plataforma se pudo leer para esta pieza. Las cifras ausentes son null, no cero."
        : `Se leyeron ${leidas.length} de ${metricas.length} metricas. Las restantes son null con motivo declarado, no cero.`
  };
}


export default {
  planDeMetricas,
  leerMetricas,
  resumirDisponibilidad
};
