// apps/backend/services/media/mediaAssetMeasurement.js

import { leerFeed, descubrirFeeds } from "../ingest/adapters/rssAdapter.js";

import { leerMetadataPublica } from "./publicMetadata.js";

import { normalizarFecha } from "./mediaTime.js";

import {
  ESTADO_DE_MEDICION,
  OFICIAL_NO_PUEDE,
  OFICIAL_FALLO_TEMPORAL,
  fuenteParaActivo
} from "../intelligence/socialSourceRouting.js";

import { esFeedDeComentarios } from "../territorial/verifiedSourceUniverse.js";

import { CLASES_ACTIVO, CANALES } from "./mediaSourceUniverse.js";

/*
===========================================================
MEDIA-SOURCE-MEASUREMENT-01 — MEDIR LOS ACTIVOS CONOCIDOS
===========================================================

Lleva el universo de «conocemos estos activos» a «podemos
observar estos activos», sin inventar una sola metrica.

QUE NO SE CONSTRUYE AQUI
-----------------------------------------------------------

Ningun motor social nuevo. No hay `mediaFacebookEngine` ni
`mediaInstagramEngine`. Lo que hay es una CORRESPONDENCIA:

    MEDIA ENTITY -> ACTIVO -> observador que YA existe

    dominio   -> publicMetadata        (media, robots-aware)
    feed      -> rssAdapter            (ingest)
    social    -> candidateObservation  (intelligence), via el
                 enrutado oficial-primero de socialSourceRouting

Si manana Candidate mejora `observarX`, Media mejora con el. Un
motor paralelo habria congelado la version de hoy.

LAS DOS PREGUNTAS QUE NO SON LA MISMA
-----------------------------------------------------------

    identityState      ¿de quien es este activo?
    measurementState   ¿podemos leerlo?

Se separan porque se responden con evidencia distinta y fallan
distinto. Una cuenta perfectamente medible puede no ser del
medio que creemos, y medirla entonces atribuye a una cabecera
cifras que no son suyas. Por eso:

    IDENTIDAD EN CONFLICTO -> NO SE MIDE

y no se mide de forma explicita y declarada, no por omision.

DECLARADO POR EL ANALISTA ES UNA REFERENCIA FUERTE
-----------------------------------------------------------

Igual que en Candidate: una URL que escribe una persona vale
mas que un resultado de buscador, y ordena la medicion antes.
Pero NO se convierte en verificada por el sistema. Las dos
cosas conviven en campos distintos.
===========================================================
*/

export const VERSION_MEDICION_MEDIA = "1.0";

export const SUBMOTOR_MEDICION = "media_measurement";


/*
-----------------------------------------------------------
IDENTIDAD DE UN ACTIVO

De quien es. No dice nada sobre si se puede leer.
-----------------------------------------------------------
*/
export const IDENTIDAD_ACTIVO = Object.freeze({
  ANALYST_DECLARED: "ANALYST_DECLARED",
  DISCOVERED: "DISCOVERED",
  CORROBORATED: "CORROBORATED",
  VERIFIED: "VERIFIED",
  CONFLICT: "CONFLICT",
  UNRESOLVED: "UNRESOLVED"
});


/*
  Identidades que autorizan gastar una peticion. `CONFLICT` y
  `UNRESOLVED` no estan, y esa ausencia es el control: medir un
  activo en disputa produce cifras atribuidas a quien no las
  genero, que es peor que no tener cifras.
*/
export const IDENTIDADES_MEDIBLES = Object.freeze([
  IDENTIDAD_ACTIVO.ANALYST_DECLARED,
  IDENTIDAD_ACTIVO.DISCOVERED,
  IDENTIDAD_ACTIVO.CORROBORATED,
  IDENTIDAD_ACTIVO.VERIFIED
]);


/*
-----------------------------------------------------------
ESTADO DE MEDICION

Se apoya en `ESTADO_DE_MEDICION` de `socialSourceRouting` y le
anade los casos que un medio tiene y un candidato no: un feed
que responde vacio, un sitio que bloquea por robots.

PARCIAL existe porque es frecuente y decirlo importa: un feed
que da titulares y fechas pero ninguna metrica esta medido a
medias, y llamarlo MEDIDO prometeria cifras que no hay.
-----------------------------------------------------------
*/
export const ESTADO_MEDICION = Object.freeze({
  MEDIDO_OFICIAL: ESTADO_DE_MEDICION.MEDIDO_OFICIAL,
  MEDIDO_PROVEEDOR: ESTADO_DE_MEDICION.MEDIDO_PROVEEDOR,
  MEDIDO_PUBLICO: "MEDIDO_PUBLICO",

  PARCIAL: "PARCIAL",

  NO_PROBADO: ESTADO_DE_MEDICION.NO_PROBADO,
  NO_SOPORTADO: "NO_SOPORTADO",
  BLOQUEADO: "BLOQUEADO",
  REQUIERE_CREDENCIAL: "REQUIERE_CREDENCIAL",
  REQUIERE_PROVEEDOR: "REQUIERE_PROVEEDOR",
  SIN_ACTIVO_CONOCIDO: "SIN_ACTIVO_CONOCIDO",
  IDENTIDAD_INSUFICIENTE: "IDENTIDAD_INSUFICIENTE",
  VACIO: "VACIO"
});


export const EXPLICACION_MEDICION = Object.freeze({
  MEDIDO_OFICIAL: "Leido por la via oficial de la plataforma.",
  MEDIDO_PROVEEDOR: "Leido por un proveedor externo aprobado.",
  MEDIDO_PUBLICO: "Leido de una via publica sin credencial: RSS o metadata del sitio.",
  PARCIAL: "Se obtuvo parte de lo esperado. Lo que falta se declara campo a campo.",
  NO_PROBADO: "No se intento en esta ejecucion. No es lo mismo que no poder.",
  NO_SOPORTADO: "Ninguna via disponible abre este activo.",
  BLOQUEADO: "La fuente respondio negando el acceso.",
  REQUIERE_CREDENCIAL: "La via existe y falta la credencial para usarla.",
  REQUIERE_PROVEEDOR: "La via oficial no puede y haria falta un proveedor externo aprobado.",
  SIN_ACTIVO_CONOCIDO: "No se conoce ningun activo de este canal para esta entidad.",
  IDENTIDAD_INSUFICIENTE:
    "El activo no se mide porque no esta claro de quien es. Medirlo atribuiria cifras a quien quiza no las genero.",
  VACIO: "La fuente responde y no trae contenido. Vacio no es silencio del medio."
});


/*
  Un canal social sin credencial NO es NO_SOPORTADO. Se separan
  porque no se arreglan igual: uno se resuelve configurando y el
  otro no se resuelve.
*/
const CANAL_A_PLATAFORMA = Object.freeze({
  facebook: "facebook",
  instagram: "instagram",
  tiktok: "tiktok",
  x: "x",
  youtube: "youtube"
});


/*
===========================================================
IDENTIDAD DE UN ACTIVO
===========================================================

`todasLasEntidades` hace falta para detectar el conflicto: el
mismo activo reclamado por dos entidades del proyecto.
===========================================================
*/
export function identidadDeActivo({ entidad, activo, todasLasEntidades = [] } = {}) {
  if (!activo?.assetId) {
    return {
      estado: IDENTIDAD_ACTIVO.UNRESOLVED,
      razon: "El activo no tiene identificador utilizable."
    };
  }

  /*
    Un activo social sin handle ni URL no identifica una cuenta.
    Es el caso de `instagram.com/p/...`: hay plataforma y no hay
    emisor.
  */
  if (
    activo.clase === CLASES_ACTIVO.SOCIAL &&
    !activo.handle &&
    !activo.url
  ) {
    return {
      estado: IDENTIDAD_ACTIVO.UNRESOLVED,
      razon: "Activo social sin cuenta identificable: hay plataforma y no hay emisor."
    };
  }

  const reclamantes = todasLasEntidades.filter(
    (e) =>
      e.activa !== false &&
      e.mediaEntityId !== entidad.mediaEntityId &&
      (e.activos || []).some((a) => a.assetId === activo.assetId)
  );

  if (reclamantes.length) {
    return {
      estado: IDENTIDAD_ACTIVO.CONFLICT,

      razon: `El activo ${activo.assetId} lo reclaman tambien: ${reclamantes
        .map((e) => e.canonicalName || e.mediaEntityId)
        .join(", ")}. No se mide hasta resolverlo.`,

      reclamantes: reclamantes.map((e) => e.mediaEntityId)
    };
  }

  if (entidad.estado === "VERIFICADA") {
    return {
      estado: IDENTIDAD_ACTIVO.VERIFIED,
      razon: `Entidad verificada por ${entidad.verificacion?.verificadaPor || "un analista"}.`
    };
  }

  if (activo.origen === "analista" || entidad.origen === "analista") {
    return {
      estado: IDENTIDAD_ACTIVO.ANALYST_DECLARED,

      razon:
        "Declarado por el analista. Es una referencia FUERTE y ordena la medicion antes, pero no equivale a verificado por el sistema."
    };
  }

  /*
    Observado varias veces en el corpus. Es corroboracion de
    EXISTENCIA y de uso, no de propiedad: sigue por debajo de
    verificado.
  */
  if ((activo.observaciones || 0) >= 3) {
    return {
      estado: IDENTIDAD_ACTIVO.CORROBORATED,
      razon: `Observado ${activo.observaciones} veces en el corpus del proyecto.`
    };
  }

  return {
    estado: IDENTIDAD_ACTIVO.DISCOVERED,
    razon: "Derivado de una pieza del corpus."
  };
}


export function puedeMedirse(identidad) {
  return IDENTIDADES_MEDIBLES.includes(identidad?.estado);
}


/*
===========================================================
PLAN DE MEDICION — el presupuesto se declara ANTES
===========================================================

Devuelve que se pediria, por que via y a que coste, sin
ejecutar nada. Es la misma regla que `/pieza/plan`: se puede
mirar el gasto antes de gastarlo.
===========================================================
*/
export function planDeMedicion({ entidades = [], credenciales = {}, presupuesto = {} } = {}) {
  const maximoCreditos = presupuesto.creditosProveedor ?? 0;

  const items = [];

  entidades
    .filter((e) => e.activa !== false)
    .forEach((entidad) => {
      (entidad.activos || []).forEach((activo) => {
        const identidad = identidadDeActivo({
          entidad,
          activo,
          todasLasEntidades: entidades
        });

        const base = {
          mediaEntityId: entidad.mediaEntityId,
          entidad: entidad.canonicalName,
          assetId: activo.assetId,
          clase: activo.clase,
          plataforma: activo.plataforma || null,
          identidad: identidad.estado,
          razonIdentidad: identidad.razon
        };

        if (!puedeMedirse(identidad)) {
          items.push({
            ...base,
            via: null,
            coste: { creditos: 0, llamadas: 0 },
            estadoPrevisto: ESTADO_MEDICION.IDENTIDAD_INSUFICIENTE
          });

          return;
        }

        if (activo.clase === CLASES_ACTIVO.FEED) {
          items.push({
            ...base,
            via: "rss",
            coste: { creditos: 0, llamadas: 1, gratuita: true },
            estadoPrevisto: ESTADO_MEDICION.MEDIDO_PUBLICO
          });

          return;
        }

        if (activo.clase === CLASES_ACTIVO.DOMINIO) {
          items.push({
            ...base,
            via: "web_publica",
            coste: { creditos: 0, llamadas: 2, gratuita: true },
            nota: "Descubrimiento de feed + metadata publica, respetando robots.txt.",
            estadoPrevisto: ESTADO_MEDICION.MEDIDO_PUBLICO
          });

          return;
        }

        /* Social: la via la decide el enrutado que ya existe. */
        const plataforma = CANAL_A_PLATAFORMA[activo.plataforma] || null;

        if (!plataforma) {
          items.push({
            ...base,
            via: null,
            coste: { creditos: 0, llamadas: 0 },
            estadoPrevisto: ESTADO_MEDICION.NO_SOPORTADO,

            nota: `No hay via de observacion para «${activo.plataforma}» en la infraestructura actual.`
          });

          return;
        }

        const tieneCredencial = Boolean(credenciales[plataforma]);

        if (!tieneCredencial) {
          items.push({
            ...base,
            via: "oficial",
            coste: { creditos: 0, llamadas: 0 },
            estadoPrevisto: ESTADO_MEDICION.REQUIERE_CREDENCIAL,

            nota: `Falta la credencial de ${plataforma}. La via existe: no se intenta para no contar una llamada que no salio.`
          });

          return;
        }

        items.push({
          ...base,
          via: "oficial",
          coste: { creditos: 0, llamadas: 1 },
          estadoPrevisto: ESTADO_MEDICION.NO_PROBADO
        });
      });
    });

  const creditosPlaneados = items.reduce((a, x) => a + (x.coste.creditos || 0), 0);

  return {
    items,

    presupuesto: {
      creditosProveedorMaximo: maximoCreditos,
      creditosPlaneados,

      dentroDelPresupuesto: creditosPlaneados <= maximoCreditos,

      llamadasGratuitas: items.filter((x) => x.coste.gratuita).length,
      llamadasConCoste: items.filter((x) => !x.coste.gratuita && x.coste.llamadas > 0).length
    },

    omitidosPorIdentidad: items.filter(
      (x) => x.estadoPrevisto === ESTADO_MEDICION.IDENTIDAD_INSUFICIENTE
    ).length,

    declaracion:
      "Ninguna peticion se ha ejecutado. Este plan declara lo que se pediria, por que via y a que coste. Los activos con identidad en conflicto o sin resolver NO entran en el plan.",

    nota:
      "El proveedor externo no se planifica por defecto: solo se usa cuando la via oficial declara que NO PUEDE con ese activo, nunca cuando fallo por algo nuestro."
  };
}


/*
===========================================================
MEDIR UN FEED
===========================================================
*/
export async function medirFeed(activo, contexto = {}) {
  const r = await leerFeed(activo.url, contexto);

  const evidencias = r?.evidencias || [];

  if (r?.estado === "VACIO" || (r?.estado === "OK" && evidencias.length === 0)) {
    return resultado({
      estado: ESTADO_MEDICION.VACIO,
      via: "rss",
      motivo: r?.aviso || "El feed responde y no trae entradas.",
      llamadas: 1
    });
  }

  if (!evidencias.length) {
    return resultado({
      estado: ESTADO_MEDICION.BLOQUEADO,
      via: "rss",
      motivo: r?.error || `El feed no se pudo leer (${r?.estado}).`,
      llamadas: 1
    });
  }

  /*
    Las fechas pasan por `mediaTime`. No se implementa otro
    parser, y `publishedAt` y `observedAt` siguen separados.
  */
  const ahora = new Date().toISOString();

  const publicaciones = evidencias.map((e) => {
    const f = normalizarFecha(e.publishedAt, { observedAt: ahora });

    return {
      canonicalUrl: e.canonicalUrl || e.url,
      url: e.url,
      titulo: e.title || null,
      autor: e.author || null,
      publishedAt: f.publishedAt,
      publishedAtBruto: e.publishedAt ?? null,
      fechaProvenance: { metodo: f.metodo, precision: f.precision, motivo: f.motivo },
      observedAt: ahora,
      evidenceId: e.evidenceId || null
    };
  });

  const conFecha = publicaciones.filter((p) => p.publishedAt).length;

  const autores = [...new Set(publicaciones.map((p) => p.autor).filter(Boolean))];

  return resultado({
    /*
      Un feed da contenido y NUNCA metricas. Llamarlo MEDIDO a
      secas prometeria cifras de audiencia que no existen.
    */
    estado: ESTADO_MEDICION.PARCIAL,
    via: "rss",
    llamadas: 1,

    publicaciones,

    metricas: {
      disponibles: [],

      nota:
        "Un feed RSS entrega contenido, no metricas. No hay audiencia, lectores ni alcance en esta via."
    },

    cobertura: {
      piezas: publicaciones.length,
      conFechaUtilizable: conFecha,
      autoresDistintos: autores.length,
      autores
    },

    ultimaPublicacion:
      publicaciones
        .map((p) => p.publishedAt)
        .filter(Boolean)
        .sort()
        .pop() || null
  });
}


/*
===========================================================
MEDIR UN DOMINIO
===========================================================
*/
export async function medirDominio(activo, contexto = {}) {
  const url = activo.url || `https://${activo.dominio}`;

  const feeds = await descubrirFeeds(url, contexto);

  const meta = await leerMetadataPublica(url, contexto);

  const bloqueado =
    meta?.estado === "BLOQUEADA_POR_ROBOTS" || meta?.estado === "BLOQUEADA_POR_LA_PLATAFORMA";

  if (bloqueado) {
    return resultado({
      estado: ESTADO_MEDICION.BLOQUEADO,
      via: "web_publica",
      motivo: meta?.motivo || "El sitio niega el acceso.",
      llamadas: 2,
      feedsDescubiertos: feeds?.feeds || []
    });
  }

  const alcanzable = meta?.estado === "OK" || (feeds?.feeds || []).length > 0;

  if (!alcanzable) {
    return resultado({
      estado: ESTADO_MEDICION.NO_PROBADO,
      via: "web_publica",
      motivo: meta?.motivo || `El sitio no respondio de forma utilizable (${meta?.estado}).`,
      llamadas: 2
    });
  }

  /*
    -----------------------------------------------------------
    LEER EL FEED DESCUBIERTO

    Descubrir un feed no es medir: es saber que hay una puerta.
    Cruzarla es lo que convierte un dominio en un canal
    observable de verdad, y cuesta 0.

    Se descarta el feed de COMENTARIOS con la funcion que ya
    existe en la linea territorial: `elmercurio.com.ec` publica
    los dos, y leer el de comentarios daria «publicaciones» que
    son respuestas de lectores.
    -----------------------------------------------------------
  */
  const candidatos = (feeds?.feeds || []).filter((f) => {
    const url = typeof f === "string" ? f : f?.url;

    if (!url) return false;

    try {
      return !esFeedDeComentarios(url);
    } catch {
      return true;
    }
  });

  const principal = candidatos[0]
    ? typeof candidatos[0] === "string"
      ? candidatos[0]
      : candidatos[0].url
    : null;

  let delFeed = null;

  if (principal && contexto.leerFeedDescubierto !== false) {
    delFeed = await medirFeed({ ...activo, url: principal }, contexto);
  }

  const llamadas = 2 + (delFeed ? delFeed.llamadas : 0);

  return resultado({
    estado:
      delFeed && delFeed.publicaciones?.length
        ? ESTADO_MEDICION.MEDIDO_PUBLICO
        : ESTADO_MEDICION.PARCIAL,

    via: delFeed?.publicaciones?.length ? "web_publica+rss" : "web_publica",
    llamadas,

    /*
      Los feeds descubiertos se devuelven como PROPUESTA: el
      analista puede declararlos como activos y entonces pasan a
      ser parte del universo, no un hallazgo de una ejecucion.
    */
    feedsDescubiertos: (feeds?.feeds || []).map((f) => ({
      url: typeof f === "string" ? f : f.url,
      titulo: typeof f === "string" ? null : f.titulo || null,
      esDeComentarios: (() => {
        try {
          return esFeedDeComentarios(typeof f === "string" ? f : f.url);
        } catch {
          return false;
        }
      })(),
      estado: "PROPUESTO",
      nota: "Descubierto en el sitio. No es un activo del universo hasta que se declare."
    })),

    feedLeido: principal,

    publicaciones: delFeed?.publicaciones ?? null,

    ultimaPublicacion: delFeed?.ultimaPublicacion ?? null,

    metricas: {
      disponibles: [],

      nota:
        "Ni la metadata de un sitio ni un feed RSS exponen metricas de audiencia. No hay lectores, alcance ni visitas en esta via."
    },

    cobertura: {
      accesible: meta?.estado === "OK",
      httpStatus: meta?.httpStatus ?? null,
      robots: meta?.robots ?? null,
      titulo: meta?.campos?.titulo?.valor ?? null,
      feedsDescubiertos: (feeds?.feeds || []).length,
      feedsUtilizables: candidatos.length,
      piezas: delFeed?.cobertura?.piezas ?? null,
      conFechaUtilizable: delFeed?.cobertura?.conFechaUtilizable ?? null,
      autores: delFeed?.cobertura?.autores ?? null
    }
  });
}


/*
===========================================================
MEDIR UN ACTIVO SOCIAL
===========================================================

No llama a ninguna plataforma directamente: decide la via con
el enrutado que ya existe y delega en el observador inyectado.
Sin observador, declara que no se intento en lugar de fingir.
===========================================================
*/
export async function medirSocial(activo, contexto = {}) {
  const plataforma = CANAL_A_PLATAFORMA[activo.plataforma] || null;

  if (!plataforma) {
    return resultado({
      estado: ESTADO_MEDICION.NO_SOPORTADO,
      via: null,
      llamadas: 0,

      motivo: `No hay via de observacion para «${activo.plataforma}» en la infraestructura actual.`
    });
  }

  if (!contexto.credenciales?.[plataforma]) {
    return resultado({
      estado: ESTADO_MEDICION.REQUIERE_CREDENCIAL,
      via: "oficial",
      llamadas: 0,

      motivo: `Falta la credencial de ${plataforma}. La via existe y no se intenta: contar una llamada que no salio falsearia el unico numero que este proyecto vigila.`
    });
  }

  const observador = contexto.observadores?.[plataforma];

  if (typeof observador !== "function") {
    return resultado({
      estado: ESTADO_MEDICION.NO_PROBADO,
      via: "oficial",
      llamadas: 0,

      motivo: `No se inyecto observador para ${plataforma} en esta ejecucion.`
    });
  }

  let r = null;

  try {
    r = await observador({ handle: activo.handle, url: activo.url, assetId: activo.assetId });
  } catch (error) {
    /*
      El fallo de un proveedor no puede tumbar la medicion de los
      demas activos: se aisla y se declara.
    */
    return resultado({
      estado: ESTADO_MEDICION.BLOQUEADO,
      via: "oficial",
      llamadas: 1,
      motivo: `La observacion de ${plataforma} fallo: ${error?.message || "error desconocido"}.`
    });
  }

  const estadoOficial = r?.estado || null;

  const ruta = fuenteParaActivo({
    platformId: plataforma,
    accountId: activo.handle || activo.assetId,
    estadoOficial,
    proveedorPuede: Boolean(contexto.proveedorPuede?.[plataforma]),
    proveedorId: contexto.proveedorId || null
  });

  if (ruta.estado === ESTADO_DE_MEDICION.MEDIDO_OFICIAL) {
    return resultado({
      estado: ESTADO_MEDICION.MEDIDO_OFICIAL,
      via: "oficial",
      llamadas: r?.llamadas ?? 1,
      metricas: r?.metricas || { disponibles: [] },
      publicaciones: r?.publicaciones || [],
      cobertura: r?.cobertura || null,
      crudo: r || null
    });
  }

  if (OFICIAL_NO_PUEDE.includes(estadoOficial)) {
    return resultado({
      estado: contexto.proveedorPuede?.[plataforma]
        ? ESTADO_MEDICION.NO_PROBADO
        : ESTADO_MEDICION.REQUIERE_PROVEEDOR,

      via: "oficial",
      llamadas: r?.llamadas ?? 1,

      motivo: `La via oficial declara «${estadoOficial}» sobre este activo: no puede abrirlo, y eso no se arregla reintentando.`
    });
  }

  if (OFICIAL_FALLO_TEMPORAL.includes(estadoOficial)) {
    return resultado({
      estado: ESTADO_MEDICION.BLOQUEADO,
      via: "oficial",
      llamadas: r?.llamadas ?? 1,

      motivo: `La via oficial fallo con «${estadoOficial}». Es un fallo NUESTRO —credencial, cuota o error—, no una limitacion de la plataforma, y NO abre el fallback de proveedor.`
    });
  }

  return resultado({
    estado: ESTADO_MEDICION.NO_PROBADO,
    via: "oficial",
    llamadas: r?.llamadas ?? 0,
    motivo: `Respuesta no concluyente de la via oficial: ${estadoOficial || "sin estado"}.`
  });
}


function resultado(x) {
  return {
    estado: x.estado,
    explicacion: EXPLICACION_MEDICION[x.estado] || null,
    via: x.via ?? null,
    motivo: x.motivo ?? null,

    llamadas: x.llamadas ?? 0,
    creditos: x.creditos ?? 0,

    /*
      Nunca 0 por defecto: una lista vacia y «no lo miramos» son
      cosas distintas, y solo la primera es una medicion.
    */
    metricas: x.metricas ?? null,
    publicaciones: x.publicaciones ?? null,
    cobertura: x.cobertura ?? null,
    feedsDescubiertos: x.feedsDescubiertos ?? null,
    ultimaPublicacion: x.ultimaPublicacion ?? null,

    observedAt: new Date().toISOString(),
    version: VERSION_MEDICION_MEDIA
  };
}


/*
===========================================================
MEDIR UNA ENTIDAD ENTERA
===========================================================
*/
export async function medirEntidad(entidad, contexto = {}) {
  const todas = contexto.todasLasEntidades || [entidad];

  const activos = [];

  for (const activo of entidad.activos || []) {
    const identidad = identidadDeActivo({ entidad, activo, todasLasEntidades: todas });

    if (!puedeMedirse(identidad)) {
      activos.push({
        activo,
        identidad,

        medicion: resultado({
          estado: ESTADO_MEDICION.IDENTIDAD_INSUFICIENTE,
          via: null,
          llamadas: 0,
          motivo: identidad.razon
        })
      });

      continue;
    }

    let medicion;

    if (activo.clase === CLASES_ACTIVO.FEED) {
      medicion = contexto.canales?.rss === false
        ? resultado({ estado: ESTADO_MEDICION.NO_PROBADO, via: "rss", motivo: "Canal desactivado en esta ejecucion." })
        : await medirFeed(activo, contexto);
    } else if (activo.clase === CLASES_ACTIVO.DOMINIO) {
      medicion = contexto.canales?.web === false
        ? resultado({ estado: ESTADO_MEDICION.NO_PROBADO, via: "web_publica", motivo: "Canal desactivado en esta ejecucion." })
        : await medirDominio(activo, contexto);
    } else {
      medicion = contexto.canales?.social === false
        ? resultado({ estado: ESTADO_MEDICION.NO_PROBADO, via: "oficial", motivo: "Canal desactivado en esta ejecucion." })
        : await medirSocial(activo, contexto);
    }

    activos.push({ activo, identidad, medicion });
  }

  return {
    mediaEntityId: entidad.mediaEntityId,
    canonicalName: entidad.canonicalName,
    tipo: entidad.tipo,

    activos,

    coberturaPorCanal: coberturaMedidaPorCanal(entidad, activos),

    consumo: {
      llamadas: activos.reduce((a, x) => a + (x.medicion.llamadas || 0), 0),
      creditos: activos.reduce((a, x) => a + (x.medicion.creditos || 0), 0)
    }
  };
}


/*
-----------------------------------------------------------
COBERTURA MEDIDA POR CANAL

`SIN_ACTIVO_CONOCIDO` no se convierte en NO_PROBADO ni al
reves: uno dice que no hay nada que mirar, el otro que no se
miro. Confundirlos borra la diferencia entre un hueco de
descubrimiento y un hueco de ejecucion.
-----------------------------------------------------------
*/
function coberturaMedidaPorCanal(entidad, medidos) {
  const porCanal = {};

  CANALES.forEach((canal) => {
    const suyos = medidos.filter(({ activo }) => {
      if (canal === "website") return activo.clase === CLASES_ACTIVO.DOMINIO;

      if (canal === "rss") return activo.clase === CLASES_ACTIVO.FEED;

      return activo.clase === CLASES_ACTIVO.SOCIAL && activo.plataforma === canal;
    });

    if (!suyos.length) {
      porCanal[canal] = {
        estado: ESTADO_MEDICION.SIN_ACTIVO_CONOCIDO,
        explicacion: EXPLICACION_MEDICION.SIN_ACTIVO_CONOCIDO,
        activos: 0
      };

      return;
    }

    /*
      Con varios activos gana el mejor resultado, y se declara
      cuantos hay detras: un medio con dos Paginas de las que
      solo una se pudo leer no esta «medido» sin matices.
    */
    const orden = [
      ESTADO_MEDICION.MEDIDO_OFICIAL,
      ESTADO_MEDICION.MEDIDO_PROVEEDOR,
      ESTADO_MEDICION.MEDIDO_PUBLICO,
      ESTADO_MEDICION.PARCIAL,
      ESTADO_MEDICION.VACIO,
      ESTADO_MEDICION.BLOQUEADO,
      ESTADO_MEDICION.REQUIERE_PROVEEDOR,
      ESTADO_MEDICION.REQUIERE_CREDENCIAL,
      ESTADO_MEDICION.IDENTIDAD_INSUFICIENTE,
      ESTADO_MEDICION.NO_SOPORTADO,
      ESTADO_MEDICION.NO_PROBADO
    ];

    const mejor = orden.find((e) => suyos.some((s) => s.medicion.estado === e));

    porCanal[canal] = {
      estado: mejor || ESTADO_MEDICION.NO_PROBADO,
      explicacion: EXPLICACION_MEDICION[mejor] || null,
      activos: suyos.length,

      detallePorActivo: suyos.map((s) => ({
        assetId: s.activo.assetId,
        identidad: s.identidad.estado,
        estado: s.medicion.estado
      }))
    };
  });

  return porCanal;
}


/*
===========================================================
MATRIZ MEDIA x ACTIVO
===========================================================

La salida que pide el gate. Los nulls no se ocultan.
===========================================================
*/
export function matrizMediaActivo(entidadesMedidas = []) {
  const filas = [];

  entidadesMedidas.forEach((e) => {
    e.activos.forEach(({ activo, identidad, medicion }) => {
      filas.push({
        mediaEntityId: e.mediaEntityId,
        entidad: e.canonicalName,
        tipoEntidad: e.tipo,

        claseActivo: activo.clase,
        plataforma: activo.plataforma || null,
        activo: activo.handle ? `@${activo.handle}` : activo.dominio || activo.url,
        assetId: activo.assetId,

        identityState: identidad.estado,
        razonIdentidad: identidad.razon,

        measurementState: medicion.estado,
        explicacionMedicion: medicion.explicacion,
        via: medicion.via,
        motivo: medicion.motivo,

        /* null explicito: no hay metricas, no hay cero metricas. */
        metricasDisponibles: medicion.metricas?.disponibles ?? null,
        notaMetricas: medicion.metricas?.nota ?? null,

        publicaciones: medicion.publicaciones ? medicion.publicaciones.length : null,
        ultimaPublicacion: medicion.ultimaPublicacion ?? null,

        lastObserved: medicion.observedAt,

        provenance: {
          origenActivo: activo.origen,
          firstObservedAt: activo.firstObservedAt,
          lastObservedAt: activo.lastObservedAt,
          observaciones: activo.observaciones ?? null,
          evidenceIds: activo.evidenceIds || []
        },

        limitaciones: limitacionesDe(medicion)
      });
    });
  });

  return filas;
}


function limitacionesDe(medicion) {
  const l = [];

  if (medicion.metricas?.nota) l.push(medicion.metricas.nota);

  if (medicion.motivo) l.push(medicion.motivo);

  if (medicion.estado === ESTADO_MEDICION.PARCIAL) {
    l.push("PARCIAL: se obtuvo parte de lo esperado y lo que falta se declara.");
  }

  return l;
}


/*
-----------------------------------------------------------
CLASES DE SNAPSHOT — correccion de MEDIA-SOURCE-MEASUREMENT-01

Ese gate reporto «28 snapshots, 14/14 series listas para
longitudinal» teniendo solo 4 de 14 activos medidos. Las dos
cifras no podian ser ciertas a la vez, y la equivocada era la
segunda: se conto como serie cualquier par de snapshots,
incluidos los que solo guardaban un ESTADO.

Un snapshot que dice REQUIERE_CREDENCIAL dos dias seguidos no
es una serie temporal: es la misma ausencia registrada dos
veces. Tratarlo como serie habilitaria un momentum calculado
sobre nada.

    METRIC_BEARING     trae metricas observadas
    CONTENT_BEARING    trae publicaciones, sin metricas
    TECHNICAL_STATUS   solo un estado

Solo METRIC_BEARING sostiene una serie longitudinal ANALITICA.
CONTENT_BEARING sostiene una serie de VOLUMEN, que es util y no
es lo mismo, y se declara aparte en lugar de mezclarse.
-----------------------------------------------------------
*/
export const CLASES_SNAPSHOT = Object.freeze({
  METRIC_BEARING: "METRIC_BEARING_SNAPSHOT",
  CONTENT_BEARING: "CONTENT_BEARING_SNAPSHOT",
  TECHNICAL_STATUS: "TECHNICAL_STATUS_SNAPSHOT"
});


export function claseDeSnapshot(s) {
  const metricas = s?.metricas?.disponibles;

  if (Array.isArray(metricas) && metricas.length > 0) {
    return CLASES_SNAPSHOT.METRIC_BEARING;
  }

  if ((s?.publicacionesObservadas || 0) > 0) {
    return CLASES_SNAPSHOT.CONTENT_BEARING;
  }

  return CLASES_SNAPSHOT.TECHNICAL_STATUS;
}


/*
===========================================================
RESUMEN Y PREPARACION LONGITUDINAL
===========================================================
*/
export function resumirMedicion(entidadesMedidas = []) {
  const filas = matrizMediaActivo(entidadesMedidas);

  const MEDIDOS = [
    ESTADO_MEDICION.MEDIDO_OFICIAL,
    ESTADO_MEDICION.MEDIDO_PROVEEDOR,
    ESTADO_MEDICION.MEDIDO_PUBLICO,
    ESTADO_MEDICION.PARCIAL
  ];

  const porEstado = new Map();

  filas.forEach((f) => porEstado.set(f.measurementState, (porEstado.get(f.measurementState) || 0) + 1));

  const porIdentidad = new Map();

  filas.forEach((f) => porIdentidad.set(f.identityState, (porIdentidad.get(f.identityState) || 0) + 1));

  const medidos = filas.filter((f) => MEDIDOS.includes(f.measurementState));

  const entidadesConAlgoMedido = new Set(medidos.map((f) => f.mediaEntityId));

  return {
    entidades: entidadesMedidas.length,
    activos: filas.length,

    activosMedidos: medidos.length,
    entidadesConAlgunActivoMedido: entidadesConAlgoMedido.size,

    porEstadoDeMedicion: [...porEstado.entries()]
      .map(([estado, activos]) => ({ estado, activos }))
      .sort((a, b) => b.activos - a.activos),

    porIdentidad: [...porIdentidad.entries()]
      .map(([estado, activos]) => ({ estado, activos }))
      .sort((a, b) => b.activos - a.activos),

    publicacionesObservadas: filas.reduce((a, f) => a + (f.publicaciones || 0), 0),

    consumo: {
      llamadas: entidadesMedidas.reduce((a, e) => a + e.consumo.llamadas, 0),
      creditos: entidadesMedidas.reduce((a, e) => a + e.consumo.creditos, 0)
    },

    /*
      El universo mide, no ordena. Se repite aqui porque una
      tabla con followers al lado invita a leerla como un
      ranking.
    */
    noEsRanking:
      "Medir un activo no dice que el medio sea importante. El orden lo calcula el ranking, con su ventana y su evidencia."
  };
}


/*
  Preparacion longitudinal por entidad y plataforma. NO calcula
  momentum: solo dice si hay serie con la que podria calcularse
  algun dia.
*/
export function preparacionLongitudinal(snapshots = []) {
  const porClave = new Map();

  snapshots.forEach((s) => {
    /*
      Los snapshots escritos antes de que existiera `canal` no lo
      traen, y agrupar por `undefined` partia la serie de los
      dominios justo en dos. El ultimo respaldo es la clase del
      activo, que siempre esta.
    */
    const canal =
      s.plataforma ||
      s.canal ||
      (s.claseActivo === "DOMINIO"
        ? "website"
        : s.claseActivo === "FEED"
          ? "rss"
          : s.claseActivo) ||
      "desconocido";

    const clave = `${s.mediaEntityId}::${canal}`;

    if (!porClave.has(clave)) {
      porClave.set(clave, {
        mediaEntityId: s.mediaEntityId,
        plataforma: canal,
        snapshotCount: 0,
        porClase: {},
        firstObservedAt: s.observedAt,
        latestObservedAt: s.observedAt
      });
    }

    const g = porClave.get(clave);

    g.snapshotCount += 1;

    const clase = claseDeSnapshot(s);

    g.porClase[clase] = (g.porClase[clase] || 0) + 1;

    if (s.observedAt < g.firstObservedAt) g.firstObservedAt = s.observedAt;

    if (s.observedAt > g.latestObservedAt) g.latestObservedAt = s.observedAt;
  });

  return [...porClave.values()].map((g) => {
    const conMetricas = g.porClase[CLASES_SNAPSHOT.METRIC_BEARING] || 0;

    const conContenido = g.porClase[CLASES_SNAPSHOT.CONTENT_BEARING] || 0;

    const soloEstado = g.porClase[CLASES_SNAPSHOT.TECHNICAL_STATUS] || 0;

    /*
      La condicion es DOS snapshots CON METRICAS. Dos snapshots
      de estado son la misma ausencia registrada dos veces.
    */
    const listaAnalitica = conMetricas >= 2;

    return {
      ...g,

      snapshotsConMetricas: conMetricas,
      snapshotsConContenido: conContenido,
      snapshotsSoloEstado: soloEstado,

      readyForLongitudinal: listaAnalitica,

      /*
        Serie de VOLUMEN: cuantas piezas publico, no como
        rindieron. Es util y no es lo mismo, asi que se declara
        en su propio campo.
      */
      readyForVolumeSeries: conContenido >= 2,

      motivo: listaAnalitica
        ? `${conMetricas} snapshots con metricas observadas: existe serie analitica.`
        : conContenido >= 2
          ? `${conContenido} snapshots con contenido y ninguno con metricas: hay serie de VOLUMEN, no de rendimiento. Un feed entrega piezas, no cifras.`
          : soloEstado >= 2
            ? `${soloEstado} snapshots que solo registran un ESTADO. La misma ausencia dos veces no es una serie.`
            : "Una sola observacion. No hay serie que comparar.",

      /* Se repite en cada fila a proposito. */
      prohibido: "Este gate NO calcula Media Momentum."
    };
  });
}


/*
===========================================================
READINESS
===========================================================
*/
export function readinessDeMedia(resumen) {
  const { activos, activosMedidos } = resumen;

  if (!activos) {
    return {
      nivel: "NO_OPERATIVO",
      motivo: "No hay activos conocidos en el universo de este proyecto."
    };
  }

  const proporcion = activosMedidos / activos;

  if (activosMedidos === 0) {
    return {
      nivel: "NO_OPERATIVO",
      motivo: "Ningun activo conocido pudo medirse."
    };
  }

  if (proporcion >= 0.8) {
    return {
      nivel: "OPERATIVO",
      motivo: `${activosMedidos} de ${activos} activos medidos.`
    };
  }

  if (proporcion >= 0.3) {
    return {
      nivel: "OPERATIVO_CON_LIMITACIONES",

      motivo: `${activosMedidos} de ${activos} activos medidos. El resto tiene estado explicito y ninguno queda sin explicacion.`
    };
  }

  return {
    nivel: "PARCIAL",
    motivo: `Solo ${activosMedidos} de ${activos} activos medidos.`
  };
}


export default {
  VERSION_MEDICION_MEDIA,
  SUBMOTOR_MEDICION,
  IDENTIDAD_ACTIVO,
  IDENTIDADES_MEDIBLES,
  ESTADO_MEDICION,
  EXPLICACION_MEDICION,
  identidadDeActivo,
  puedeMedirse,
  planDeMedicion,
  medirFeed,
  medirDominio,
  medirSocial,
  medirEntidad,
  matrizMediaActivo,
  resumirMedicion,
  preparacionLongitudinal,
  readinessDeMedia
};
