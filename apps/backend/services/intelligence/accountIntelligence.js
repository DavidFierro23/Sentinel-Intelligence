// apps/backend/services/intelligence/accountIntelligence.js

/*
===========================================================
ACCOUNT INTELLIGENCE — FASE 1 (P-CAND-AI-01)
===========================================================

Una cuenta consolidada deja de ser solo identidad y pasa a ser
un objetivo persistente de observacion.

    CANDIDATO → CUENTAS CONSOLIDADAS → OBSERVACIONES → SNAPSHOTS

DISCOVERY NO ES MONITOREO

Discovery pregunta de quien es una cuenta. Eso ya esta resuelto y
su respuesta vive en el inventario. Aqui se pregunta que ocurre
en ella, y se consulta la cuenta DIRECTAMENTE cuando exista un
adaptador permitido. Volver a lanzar Full Discovery para
monitorear seria repreguntar algo que ya sabemos y pagarlo.

LO QUE ESTA FASE PUEDE Y NO PUEDE

Puede: leer metadata publica de una pagina que la exponga,
registrar la observacion con su traza, escribir un snapshot
append-only y extraer temas de textos propios reutilizando el
Topic Engine que ya existe.

No puede: leer seguidores, publicaciones ni metricas de
Instagram, Facebook, X, TikTok, YouTube ni LinkedIn. No hay API
ni proveedor, y el scraping esta excluido. Eso se declara
plataforma por plataforma en `accountContracts`, no se disimula.

    «el candidato no publica»            NUNCA se afirma
    «no pudimos observar la cuenta»      es lo que se dice

Es la misma doctrina que separa `ausencia` de `no_comprobada` en
la cobertura: un hueco habla de nuestros medios, no de la
conducta de una persona.
===========================================================
*/

import {
  ESTADOS_OBSERVACION,
  CAPACIDADES,
  MAPA_PLATAFORMAS,
  capacidadDe,
  crearObservacion,
  crearSnapshot,
  METRICAS_NO_COMPARABLES
} from "./accountContracts.js";

import { extraerMetadataImagen } from "./candidatePhotoResolver.js";

/* Topic Engine existente. No se crea uno paralelo. */
import { extraerTemas } from "../conversation/topicExtractor.js";

const TIEMPO_MAXIMO_MS = 6000;

const AGENTE =
  "SentinelIntelligence/1.0 (+lectura de metadata publica; sin autenticacion)";

/* Tope de paginas por ejecucion. No hay scraping masivo. */
const TOPE_PETICIONES = 4;


/*
-----------------------------------------------------------
METADATA PUBLICA DE UNA PAGINA

Solo lo que la propia pagina declara para ser compartida:
titulo, descripcion, nombre del sitio. Nada de recorrer el DOM
buscando cifras: un numero sacado de un `<span>` cualquiera no es
una metrica, es una conjetura.
-----------------------------------------------------------
*/
export function extraerMetadataPublica(html) {
  const texto = String(html || "");

  const meta = (clave) => {
    const patrones = [
      new RegExp(
        `<meta[^>]+(?:property|name)\\s*=\\s*["']${clave}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${clave}["']`,
        "i"
      )
    ];

    for (const re of patrones) {
      const m = texto.match(re);

      if (m) return m[1].trim() || null;
    }

    return null;
  };

  const titulo =
    meta("og:title") ||
    meta("twitter:title") ||
    (texto.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim() ||
    null;

  const descripcion =
    meta("og:description") || meta("twitter:description") || meta("description");

  const imagenes = extraerMetadataImagen(texto);

  return {
    profileName: titulo || null,
    profileBio: descripcion || null,
    profileImage: imagenes[0]?.url || null,
    sitio: meta("og:site_name") || null,

    /*
      Claves realmente encontradas. Sin esto, un campo en `null`
      no se distingue de uno que nadie intento leer.
    */
    clavesEncontradas: [
      titulo ? "title" : null,
      descripcion ? "description" : null,
      imagenes[0]?.clave || null
    ].filter(Boolean)
  };
}


async function pedirPagina(url, fetchImpl) {
  const control = new AbortController();

  const reloj = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

  try {
    const r = await fetchImpl(url, {
      redirect: "follow",
      headers: { "User-Agent": AGENTE, Accept: "text/html,application/xhtml+xml" },
      signal: control.signal
    });

    if (!r.ok) {
      const bloqueada = r.status === 401 || r.status === 403 || r.status === 429;

      return {
        ok: false,
        httpStatus: r.status,
        estado: bloqueada
          ? ESTADOS_OBSERVACION.PROVIDER_LIMITED
          : ESTADOS_OBSERVACION.ERROR,
        motivo: bloqueada
          ? `la fuente no permite la lectura publica (HTTP ${r.status})`
          : `HTTP ${r.status}`
      };
    }

    return { ok: true, httpStatus: r.status, html: await r.text() };
  } catch (e) {
    return {
      ok: false,
      httpStatus: null,
      estado: ESTADOS_OBSERVACION.ERROR,
      motivo:
        e?.name === "AbortError"
          ? `la fuente no respondio en ${TIEMPO_MAXIMO_MS} ms`
          : e?.message || "fallo de red"
    };
  } finally {
    clearTimeout(reloj);
  }
}


/*
-----------------------------------------------------------
OBSERVAR UNA CUENTA
-----------------------------------------------------------
*/
async function observarCuenta(cuenta, contexto, fetchImpl, presupuesto) {
  const cap = capacidadDe(cuenta.plataformaId);

  const comun = {
    accountId: cuenta.id,
    candidateId: contexto.candidateId,
    projectId: contexto.projectId,
    platform: cuenta.plataformaId,
    url: cuenta.url,
    handle: cuenta.handle
  };

  /*
    Metricas que esta plataforma NO puede dar hoy. Se declaran
    siempre, tambien cuando la observacion sale bien: saber que
    falta es parte del resultado.
  */
  const noDisponibles = cap.necesitamos || [];

  /* Plataforma cerrada: no se pide la pagina. */
  if (
    !cap.metadataPublica ||
    cap.capacidad === CAPACIDADES.BLOCKED ||
    cap.capacidad === CAPACIDADES.UNSUPPORTED
  ) {
    return crearObservacion({
      ...comun,
      estado: ESTADOS_OBSERVACION.PROVIDER_LIMITED,
      metodo: "ninguno",
      metricasNoDisponibles: noDisponibles,
      limitaciones: [cap.motivo],
      motivo: cap.motivo
    });
  }

  if (presupuesto.usadas >= TOPE_PETICIONES) {
    return crearObservacion({
      ...comun,
      estado: ESTADOS_OBSERVACION.NO_EJECUTADA,
      metodo: "ninguno",
      metricasNoDisponibles: noDisponibles,
      motivo: `tope de ${TOPE_PETICIONES} peticiones por ejecucion: esta cuenta no se consulto`
    });
  }

  presupuesto.usadas += 1;

  const pagina = await pedirPagina(cuenta.url, fetchImpl);

  if (!pagina.ok) {
    return crearObservacion({
      ...comun,
      estado: pagina.estado,
      metodo: "metadata_publica",
      provider: "lectura publica",
      metricasNoDisponibles: noDisponibles,
      limitaciones: [pagina.motivo],
      motivo: pagina.motivo
    });
  }

  const meta = extraerMetadataPublica(pagina.html);

  const hayAlgo = meta.clavesEncontradas.length > 0;

  return crearObservacion({
    ...comun,
    estado: hayAlgo
      ? ESTADOS_OBSERVACION.OBSERVADA
      : ESTADOS_OBSERVACION.SIN_DATOS_PUBLICOS,
    metodo: "metadata_publica",
    provider: "lectura publica",

    profileName: meta.profileName,
    profileBio: meta.profileBio,
    profileImage: meta.profileImage,

    /*
      Las metricas siguen en `null`: la metadata de una pagina no
      trae seguidores ni publicaciones, y ponerlas a cero seria
      afirmar algo que no observamos.
    */
    metricasDisponibles: meta.clavesEncontradas,
    metricasNoDisponibles: noDisponibles,

    limitaciones: [cap.motivo],
    motivo: hayAlgo
      ? null
      : "la pagina respondio pero no declara metadata publica utilizable"
  });
}


/*
===========================================================
OBSERVAR TODAS LAS CUENTAS DE UN CANDIDATO
===========================================================
*/
export async function observarCuentasDelCandidato(entrada = {}) {
  const {
    candidateId = null,
    projectId = null,
    cuentas = [],
    fetchImpl = globalThis.fetch,
    ejecutar = false
  } = entrada;

  const presupuesto = { usadas: 0 };

  const observaciones = [];

  /*
    `ejecutar: false` es el modo por defecto a proposito: describe
    QUE se haria sin pedir ni una pagina. Asi la interfaz puede
    mostrar el estado sin gastar nada, y el analista decide cuando
    salir a la red.
  */
  for (const cuenta of cuentas) {
    if (!ejecutar) {
      const cap = capacidadDe(cuenta.plataformaId);

      observaciones.push(
        crearObservacion({
          accountId: cuenta.id,
          candidateId,
          projectId,
          platform: cuenta.plataformaId,
          url: cuenta.url,
          handle: cuenta.handle,
          estado:
            cap.metadataPublica && cap.capacidad !== CAPACIDADES.BLOCKED
              ? ESTADOS_OBSERVACION.NO_EJECUTADA
              : ESTADOS_OBSERVACION.PROVIDER_LIMITED,
          metodo: "ninguno",
          metricasNoDisponibles: cap.necesitamos || [],
          limitaciones: [cap.motivo],
          motivo: cap.metadataPublica
            ? "no se ha ejecutado ninguna observacion todavia"
            : cap.motivo
        })
      );

      continue;
    }

    observaciones.push(
      await observarCuenta(cuenta, { candidateId, projectId }, fetchImpl, presupuesto)
    );
  }

  return {
    candidateId,
    projectId,
    observaciones,
    peticionesRealizadas: presupuesto.usadas,
    topePeticiones: TOPE_PETICIONES,
    ejecutado: ejecutar === true
  };
}


/*
-----------------------------------------------------------
SNAPSHOTS

Uno por observacion, append-only. Nunca se sobrescribe el
anterior: sin eso no hay 7d, 15d, 30d ni 90d, y comparar seria
inventar.
-----------------------------------------------------------
*/
export function snapshotsDeObservaciones(observaciones, contexto = {}) {
  return (observaciones || []).map((o) =>
    crearSnapshot({
      candidateId: o.candidateId,
      accountId: o.accountId,
      projectId: o.projectId,
      platform: o.platform,
      capturedAt: o.capturedAt,

      followers: o.followers,
      postsObserved: o.postsCount,
      metricsAvailable: o.metricasDisponibles,
      lastActivityAt: o.lastPostAt,

      provider: o.provider,
      estado: o.estado,
      limitations: o.limitaciones,

      snapshotAnterior: contexto.anteriorPorCuenta?.[o.accountId] || null
    })
  );
}


/*
-----------------------------------------------------------
ACTIVIDAD

Solo lo que se puede derivar de observaciones reales. Si no hay
publicaciones observadas, el resultado es `null` y no «actividad
baja»: etiquetar sin metodologia es opinar con aspecto de dato.
-----------------------------------------------------------
*/
export const REGLA_FRECUENCIA = Object.freeze({
  nota:
    "La frecuencia se calcula como publicaciones observadas dividido por dias del periodo, y solo si hubo al menos una publicacion observada. No se etiqueta alta, media ni baja: con las fuentes actuales no se observa el total de publicaciones, asi que cualquier etiqueta seria una conjetura.",
  etiquetas: null
});


export function actividadDePublicaciones(publicaciones, ahora = new Date()) {
  const lista = (publicaciones || []).filter((p) => p.publishedAt);

  const enDias = (dias) => {
    const desde = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);

    return lista.filter((p) => new Date(p.publishedAt) >= desde).length;
  };

  const fechas = lista
    .map((p) => new Date(p.publishedAt).getTime())
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => b - a);

  return {
    publicacionesObservadas: lista.length,
    publicacionesObservadas7d: lista.length ? enDias(7) : null,
    publicacionesObservadas30d: lista.length ? enDias(30) : null,

    frecuenciaPublicacion: lista.length
      ? Number((enDias(30) / 30).toFixed(3))
      : null,

    ultimaActividad: fechas.length ? new Date(fechas[0]).toISOString() : null,

    /*
      Sin publicaciones observadas no se dice nada sobre la
      actividad del candidato: no observamos, y eso es todo lo que
      sabemos.
      */
    advertencia: lista.length
      ? null
      : "No se observo ninguna publicacion. Esto NO indica que el candidato no publique: indica que las fuentes disponibles no permiten leer sus publicaciones.",

    regla: REGLA_FRECUENCIA.nota
  };
}


/*
-----------------------------------------------------------
TEMAS: PROPIOS Y SOBRE EL CANDIDATO

Dos cosas distintas que no pueden mezclarse:

  PROPIOS          lo que dicen las cuentas del candidato
  SOBRE EL         lo que dicen medios y terceros

Confundirlas convertiria la agenda de un medio en el discurso del
candidato, o al contrario. Se calculan por separado con el MISMO
Topic Engine, y cada resultado declara su ambito.
-----------------------------------------------------------
*/
export function temasDeLasCuentas(publicaciones, opciones = {}) {
  /*
    El Topic Engine trabaja sobre evidencias con titulo y texto:
    las publicaciones se adaptan a esa forma en lugar de escribir
    otro extractor.
  */
  const evidencias = (publicaciones || []).map((p) => ({
    id: p.postId,
    titulo: p.title || null,
    resumen: p.text || p.description || null,
    fecha: p.publishedAt || null,
    enlace: p.url || null,
    origen: `cuenta:${p.platform}`
  }));

  const r = extraerTemas(evidencias, opciones);

  return {
    ambito: "TEMAS_PROPIOS",
    definicion:
      "Temas extraidos de publicaciones de las cuentas del propio candidato.",
    noEs:
      "No son los temas con los que los medios o terceros hablan del candidato: eso es TEMAS_SOBRE_EL_CANDIDATO y se calcula aparte.",
    publicacionesAnalizadas: evidencias.length,
    temas: r?.temas || [],
    advertencia: evidencias.length
      ? null
      : "Sin publicaciones observadas no hay temas propios que extraer."
  };
}


/*
===========================================================
RESUMEN PARA LA INTERFAZ
===========================================================

Estados vacios HONESTOS: cada plataforma dice en que situacion
esta y por que, tambien cuando no hay nada.
===========================================================
*/
export function resumenDeCuentas(cuentas, observaciones) {
  const porCuenta = new Map(
    (observaciones || []).map((o) => [o.accountId, o])
  );

  const plataformas = MAPA_PLATAFORMAS.map((cap) => {
    const suyas = (cuentas || []).filter(
      (c) => c.plataformaId === cap.plataformaId
    );

    const obs = suyas.map((c) => porCuenta.get(c.id)).filter(Boolean);

    return {
      plataformaId: cap.plataformaId,
      plataforma: cap.plataforma,
      capacidad: cap.capacidad,
      motivoCapacidad: cap.motivo,

      cuentas: suyas.length,

      estado: suyas.length
        ? obs[0]?.estado || ESTADOS_OBSERVACION.NO_EJECUTADA
        : null,

      metricasNecesarias: cap.necesitamos,
      metricasObtenidas: obs.flatMap((o) => o.metricasDisponibles || []),

      /* Sin cuenta no hay nada que observar, y se dice asi. */
      nota: suyas.length
        ? null
        : "No hay ninguna cuenta registrada en esta plataforma, asi que no hay nada que observar."
    };
  });

  const observadas = (observaciones || []).filter(
    (o) => o.estado === ESTADOS_OBSERVACION.OBSERVADA
  );

  const ultima = (observaciones || [])
    .map((o) => o.capturedAt)
    .filter(Boolean)
    .sort()
    .pop();

  return {
    cuentasTotales: (cuentas || []).length,

    /* Monitorizable = la plataforma admite alguna lectura hoy. */
    cuentasMonitorizables: (cuentas || []).filter((c) => {
      const cap = capacidadDe(c.plataformaId);

      return (
        cap.metadataPublica &&
        cap.capacidad !== CAPACIDADES.BLOCKED &&
        cap.capacidad !== CAPACIDADES.UNSUPPORTED
      );
    }).length,

    cuentasObservadas: observadas.length,
    ultimaObservacion: ultima || null,

    proveedores: [
      ...new Set((observaciones || []).map((o) => o.provider).filter(Boolean))
    ],

    plataformas,

    limitaciones: [
      ...new Set(
        (observaciones || []).flatMap((o) => o.limitaciones || [])
      )
    ],

    metricasNoComparables: METRICAS_NO_COMPARABLES.nota,

    /*
      Explicitamente NO hay puntuacion. Un numero por candidato en
      esta fase se leeria como un ranking politico, y no hay
      datos para sostener nada parecido.
    */
    puntuacion: null,
    notaPuntuacion:
      "Esta fase no produce ninguna puntuacion ni ranking: con las fuentes disponibles no hay base para comparar candidatos."
  };
}


export default {
  observarCuentasDelCandidato,
  snapshotsDeObservaciones,
  actividadDePublicaciones,
  temasDeLasCuentas,
  resumenDeCuentas,
  extraerMetadataPublica,
  REGLA_FRECUENCIA
};
