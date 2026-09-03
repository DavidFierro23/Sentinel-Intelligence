// apps/backend/services/media/mediaMeasurementStore.js

import { abrirLake, escribirLoteEnLake } from "../knowledgeLake/lakeQuery.js";

import { TIPOS_ENTIDAD, ZONAS } from "../knowledgeLake/lakeWriter.js";

import { normalizarUrl } from "../textUtils.js";

import { universoDeProyecto } from "./mediaUniverseStore.js";

import {
  SUBMOTOR_MEDICION,
  VERSION_MEDICION_MEDIA,
  medirEntidad,
  matrizMediaActivo,
  resumirMedicion,
  preparacionLongitudinal,
  readinessDeMedia,
  planDeMedicion
} from "./mediaAssetMeasurement.js";

/*
===========================================================
MEDIA-SOURCE-MEASUREMENT-01 — PERSISTENCIA DE LA MEDICION
===========================================================

Guarda los snapshots de medicion y las publicaciones observadas
en el Knowledge Lake, que ya es append-only y ya versiona.

DOS COSAS DISTINTAS SE GUARDAN
-----------------------------------------------------------

    SNAPSHOT       el estado de un activo en un instante
    PUBLICACION    una pieza concreta que ese activo publico

El snapshot es lo que hace posible una serie temporal; la
publicacion es lo que hace posible el corpus. Guardarlos juntos
impediria contar cualquiera de las dos cosas.

LA DEDUPLICACION QUE IMPORTA
-----------------------------------------------------------

Una misma nota puede llegar por RSS, por la web, por una
busqueda y por una red social. Es UNA publicacion con VARIAS
procedencias, no cuatro publicaciones.

La clave es la URL canonica normalizada, la misma que usa
`mediaCorpus`. Si el Lake ya tiene esa clave, la fila nueva es
una version mas —no una pieza mas— y la procedencia se acumula.

Este gate NO calcula momentum. Solo deja la serie preparada y
declara si existe.
===========================================================
*/

const TENANT_POR_DEFECTO = "sentinel-local";


function filaSnapshot({ projectId, tenantId, entidad, activo, medicion }) {
  const observedAt = medicion.observedAt;

  return {
    tenantId: tenantId || TENANT_POR_DEFECTO,
    proyectoId: projectId,
    zona: ZONAS.RAW,

    linaje: { submotor: SUBMOTOR_MEDICION, cadena: ["medir_activo"] },

    motorOrigen: "media_measurement_01",
    fuente: activo.dominio || activo.plataforma || null,
    urlCanonica: activo.url || null,

    fechaHecho: observedAt,
    fechaDeteccion: observedAt,

    /*
      La entidad del snapshot incluye el instante: dos
      observaciones del mismo activo son DOS filas, no una
      versionada. Es lo contrario que la publicacion, y por eso
      la clave lleva el tiempo.
    */
    entidad: `${entidad.mediaEntityId}::${activo.assetId}::${observedAt}`,
    tipoEntidad: TIPOS_ENTIDAD.MEDIO,

    datos: {
      clase: "medicion_activo",
      version: VERSION_MEDICION_MEDIA,

      mediaEntityId: entidad.mediaEntityId,
      canonicalName: entidad.canonicalName,
      assetId: activo.assetId,
      claseActivo: activo.clase,
      plataforma: activo.plataforma || null,

      /*
        Canal legible tambien para dominios y feeds, que no
        tienen plataforma. Sin esto la serie longitudinal salia
        con `undefined` justo en los activos que SI se midieron.
      */
      canal:
        activo.clase === "DOMINIO"
          ? "website"
          : activo.clase === "FEED"
            ? "rss"
            : activo.plataforma || null,

      estado: medicion.estado,
      via: medicion.via,
      motivo: medicion.motivo,

      metricas: medicion.metricas || null,
      cobertura: medicion.cobertura || null,

      publicacionesObservadas: medicion.publicaciones
        ? medicion.publicaciones.length
        : null,

      llamadas: medicion.llamadas || 0,
      creditos: medicion.creditos || 0,

      observedAt
    }
  };
}


function filaPublicacion({ projectId, tenantId, entidad, activo, publicacion, observedAt }) {
  const clave =
    normalizarUrl(publicacion.canonicalUrl || publicacion.url || "") ||
    String(publicacion.canonicalUrl || publicacion.url || "");

  return {
    tenantId: tenantId || TENANT_POR_DEFECTO,
    proyectoId: projectId,
    zona: ZONAS.RAW,

    linaje: { submotor: SUBMOTOR_MEDICION, cadena: ["publicacion_observada"] },

    motorOrigen: "media_measurement_01",
    fuente: activo.dominio || entidad.mediaEntityId,

    urlOriginal: publicacion.url || null,
    urlCanonica: publicacion.canonicalUrl || publicacion.url || null,

    /* publishedAt y observedAt NO se mezclan. */
    fechaHecho: publicacion.publishedAt || null,
    fechaDeteccion: observedAt,

    /*
      -------------------------------------------------------
      CLAVE CON PREFIJO — corregido en MEDIA-CORPUS-INTEGRATION-01

      Sin el prefijo, esta fila y la de una PIEZA ANALIZADA de la
      misma URL producian la MISMA `claveEntidad`: el Lake la
      compone con tenant + proyecto + tipoEntidad + entidad, y no
      incluye el submotor.

      Consecuencia: la publicacion medida se convertia en una
      version nueva de la pieza analizada, y una lectura con
      `soloVigentes` dejaba de ver la pieza —con su emisor, sus
      metricas y su amplificacion—. No se perdia el dato, pero
      desaparecia de las lecturas, que es peor porque no se nota.

      Con el prefijo son dos entidades distintas del Lake, cada
      una con su historia, y es el CORPUS CANONICO el que las
      reconcilia en una sola pieza conservando las dos rutas. Que
      es donde debe decidirse.

      Las filas escritas antes del prefijo siguen leyendose: el
      filtro es por submotor y clase, no por la forma de la clave.
      -------------------------------------------------------
    */
    entidad: `pub:${clave}`,
    tipoEntidad: TIPOS_ENTIDAD.PUBLICACION,

    datos: {
      clase: "publicacion_de_medio",
      version: VERSION_MEDICION_MEDIA,

      mediaEntityId: entidad.mediaEntityId,
      assetId: activo.assetId,

      titulo: publicacion.titulo || null,
      autor: publicacion.autor || null,

      publishedAt: publicacion.publishedAt || null,
      publishedAtBruto: publicacion.publishedAtBruto ?? null,
      fechaProvenance: publicacion.fechaProvenance || null,

      observedAt,

      /*
        Procedencia acumulable: la misma pieza vista por otra via
        anade su origen en lugar de sustituirlo.
      */
      procedencia: [
        {
          via: activo.clase === "FEED" ? "rss" : "web_publica",
          assetId: activo.assetId,
          observedAt
        }
      ]
    }
  };
}


/*
===========================================================
EJECUTAR Y PERSISTIR
===========================================================
*/
export async function medirYGuardar(opciones = {}) {
  const projectId = String(opciones.projectId || "").trim();

  if (!projectId) {
    return {
      ok: false,
      motivo:
        "Falta projectId. La medicion es POR PROYECTO: sin el, las cifras de dos campanas se mezclarian."
    };
  }

  const universo = await universoDeProyecto({ ...opciones, projectId });

  if (!universo.ok) return { ok: false, motivo: universo.motivo };

  const entidades = universo.entidades.filter((e) => e.activa !== false);

  /*
    El plan se calcula SIEMPRE, tambien cuando se va a ejecutar:
    es lo que permite comparar lo previsto con lo gastado.
  */
  const plan = planDeMedicion({
    entidades,
    credenciales: opciones.credenciales || {},
    presupuesto: opciones.presupuesto || {}
  });

  if (opciones.soloPlan) {
    return { ok: true, projectId, plan, ejecutado: false };
  }

  const medidas = [];

  for (const entidad of entidades) {
    medidas.push(
      await medirEntidad(entidad, {
        ...opciones,
        todasLasEntidades: entidades
      })
    );
  }

  const resumen = resumirMedicion(medidas);

  /*
    -----------------------------------------------------------
    PERSISTENCIA

    Los snapshots se escriben siempre —incluso los de estado
    BLOQUEADO—, porque «lo intentamos y no se pudo» es
    informacion longitudinal: un medio que empieza a bloquear es
    un hecho observable.
    -----------------------------------------------------------
  */
  const filas = [];

  const vistasEnEsteLote = new Set();

  let publicacionesDuplicadas = 0;

  medidas.forEach((m) => {
    const entidad = entidades.find((e) => e.mediaEntityId === m.mediaEntityId);

    m.activos.forEach(({ activo, medicion }) => {
      filas.push(
        filaSnapshot({ projectId, tenantId: opciones.tenantId, entidad, activo, medicion })
      );

      (medicion.publicaciones || []).forEach((p) => {
        const clave =
          normalizarUrl(p.canonicalUrl || p.url || "") ||
          String(p.canonicalUrl || p.url || "");

        if (!clave) return;

        /*
          Dedup dentro del propio lote. Entre ejecuciones lo
          resuelve el Lake: misma clave de entidad, version nueva.
        */
        if (vistasEnEsteLote.has(clave)) {
          publicacionesDuplicadas += 1;

          return;
        }

        vistasEnEsteLote.add(clave);

        filas.push(
          filaPublicacion({
            projectId,
            tenantId: opciones.tenantId,
            entidad,
            activo,
            publicacion: p,
            observedAt: medicion.observedAt
          })
        );
      });
    });
  });

  let persistencia = { persistido: false, escritos: 0, rechazados: 0 };

  if (!opciones.sinPersistir) {
    try {
      const r = await escribirLoteEnLake(filas, opciones.lake || {});

      persistencia = {
        persistido: (r?.escritos ?? 0) > 0,
        filas: filas.length,
        escritos: r?.escritos ?? 0,
        rechazados: r?.rechazados ?? 0,
        omitidosSinCambios: r?.omitidosSinCambios ?? 0,

        motivosRechazo: [
          ...new Set(
            (r?.resultados || [])
              .filter((x) => x && x.escrito === false)
              .flatMap((x) => x.errores || [x.motivo])
              .filter(Boolean)
          )
        ]
      };
    } catch (error) {
      persistencia = {
        persistido: false,
        motivo: `El Lake no acepto la escritura: ${error?.message || "error desconocido"}.`
      };
    }
  }

  const snapshots = await leerSnapshots({ projectId, ...opciones });

  return {
    ok: true,
    gate: "MEDIA-SOURCE-MEASUREMENT-01",
    projectId,

    plan,
    ejecutado: true,

    matriz: matrizMediaActivo(medidas),

    resumen,

    readiness: readinessDeMedia(resumen),

    longitudinal: {
      series: preparacionLongitudinal(snapshots),

      declaracion:
        "Este gate NO calcula momentum. Solo declara si existe serie con la que podria calcularse."
    },

    persistencia: {
      ...persistencia,
      publicacionesDuplicadasEnElLote: publicacionesDuplicadas,

      declaracion:
        "Una misma pieza vista por dos vias es UNA publicacion con dos procedencias. El Lake es append-only: reobservar crea una version, no una pieza."
    },

    /*
      Lo previsto frente a lo gastado. Si divergen, se ve.
      Ninguna medicion de este gate usa creditos de proveedor.
    */
    consumo: {
      llamadasPrevistas: plan.items.reduce((a, x) => a + (x.coste.llamadas || 0), 0),
      llamadasReales: resumen.consumo.llamadas,
      creditosPrevistos: plan.presupuesto.creditosPlaneados,
      creditosReales: resumen.consumo.creditos,
      costeUsd: 0
    },

    aislamiento: universo.aislamiento
  };
}


/*
===========================================================
LEER LOS SNAPSHOTS DE MEDICION DE UN PROYECTO
===========================================================
*/
export async function leerSnapshots({ projectId, tenantId, lake = {} } = {}) {
  if (!projectId) return [];

  const instancia = await abrirLake(lake);

  const delProyecto = instancia.indice.buscar("proyecto", projectId);

  return instancia.lector
    .aplicarFiltros(delProyecto, { tenantId: tenantId || TENANT_POR_DEFECTO })
    .filter(
      (r) =>
        r?.linaje?.submotor === SUBMOTOR_MEDICION &&
        r?.datos?.clase === "medicion_activo"
    )
    .map((r) => r.datos);
}


/*
===========================================================
PUBLICACIONES OBSERVADAS DE UN PROYECTO
===========================================================
*/
export async function leerPublicaciones({ projectId, tenantId, lake = {} } = {}) {
  if (!projectId) return [];

  const instancia = await abrirLake(lake);

  const delProyecto = instancia.indice.buscar("proyecto", projectId);

  return instancia.lector
    .aplicarFiltros(delProyecto, {
      tenantId: tenantId || TENANT_POR_DEFECTO,
      soloVigentes: true
    })
    .filter(
      (r) =>
        r?.linaje?.submotor === SUBMOTOR_MEDICION &&
        r?.datos?.clase === "publicacion_de_medio"
    )
    .map((r) => ({
      ...r.datos,
      canonicalUrl: r.urlCanonica,

      /*
        La clave se devuelve SIN el prefijo `pub:`: es la clave
        canonica de la publicacion, y es la que el corpus usa
        para reconciliar. El prefijo es un detalle de la clave
        del Lake y no debe salir de aqui.
      */
      clave: String(r.entidad || "").replace(/^pub:/, "")
    }));
}


export default {
  medirYGuardar,
  leerSnapshots,
  leerPublicaciones
};
