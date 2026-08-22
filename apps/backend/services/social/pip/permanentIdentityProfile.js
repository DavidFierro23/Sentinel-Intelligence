// apps/backend/services/social/pip/permanentIdentityProfile.js

import { normalizarTexto } from "../../textUtils.js";

import {
  escribirEnLake,
  obtenerHistorialEntidad,
  obtenerVersionEntidad
} from "../../knowledgeLake/lakeQuery.js";

/*
===========================================================
PERFIL DE IDENTIDAD PERMANENTE (PIP) — ARQ-PUI-001, Bloque B
===========================================================

Hasta ahora cada investigación empezaba de cero. Se buscaba a
una persona, se descubrían sus cuentas, se mostraba el
resultado y al cerrar la pestaña todo se perdía. La siguiente
investigación del mismo objetivo volvía a gastar cuota para
redescubrir lo mismo.

El PIP hace que el perfil PERSISTA: cada investigación escribe
una versión nueva sobre el Knowledge Lake, que es append-only y
versionado, y devuelve qué ha cambiado respecto de la anterior.

QUÉ APORTA QUE NO APORTABA NADA MÁS
-----------------------------------------------------------

  · Una cuenta NUEVA respecto de la última vez es una señal en
    sí misma: alguien abrió una cuenta.
  · Una cuenta que DESAPARECE del descubrimiento no significa
    que se cerrara — puede ser que el buscador no la devolviera
    esta vez. Se declara como «no reaparecida», nunca como
    «eliminada». Es la misma disciplina que separa `ausencia` de
    `no_comprobada` en toda la plataforma.
  · El historial permite responder «desde cuándo sabemos esto»,
    que es la pregunta que un analista hace siempre.

NUNCA GUARDAR DUPLICADOS
-----------------------------------------------------------

Regla congelada del sprint. El Lake calcula un hash canónico
sobre el contenido: si una investigación no cambia nada, el
hash coincide y NO se escribe una versión nueva. Sin esa
comprobación, investigar tres veces al mismo objetivo dejaría
tres versiones idénticas y el historial dejaría de significar
nada.

LÍMITE HONESTO DE LA CLAVE DE IDENTIDAD
-----------------------------------------------------------

La clave es el nombre normalizado más el país cuando se
conoce. Esto significa que dos personas con el mismo nombre en
el mismo país compartirían perfil permanente, y que la misma
persona buscada como «Yaku Perez» y como «Yaku Pérez
Guartambel» tendría dos.

Resolver identidad entre variantes de nombre es un problema
abierto, y no se finge resuelto: la clave se declara en la
respuesta para que el analista vea exactamente bajo qué
identidad se guardó.
===========================================================
*/


const TIPO_ENTIDAD = "persona";


/*
-----------------------------------------------------------
GOBIERNO DEL REGISTRO (DT1, DT3)

El Lake EXIGE tenantId, proyectoId y linaje.submotor, y hace
bien: un registro sin dueno ni trazabilidad no es auditable.

Esta ruta del API todavia no tiene multitenancy, asi que en vez
de escribir null —que el validador rechaza, y con razon— se
declara explicitamente que el registro es local y ad-hoc. Es
la diferencia entre "no lo se" y "lo se, y es este".
-----------------------------------------------------------
*/

const TENANT_LOCAL = "sentinel-local";

const PROYECTO_ADHOC = "osint-investigacion-adhoc";

const SUBMOTOR = "protocolo_universal_investigacion";


/*
-----------------------------------------------------------
CLAVE DE IDENTIDAD
-----------------------------------------------------------
*/

export function claveIdentidad(perfil) {
  const nombre = normalizarTexto(perfil?.nombrePrincipal || "").replace(
    /\s+/g,
    "-"
  );

  if (!nombre) return null;

  const pais = normalizarTexto(perfil?.contexto?.pais || "").replace(
    /\s+/g,
    "-"
  );

  return pais ? `${nombre}@${pais}` : nombre;
}


/*
-----------------------------------------------------------
HUELLA DE CONTENIDO

Lo que define si el perfil CAMBIÓ. Deliberadamente NO incluye
la puntuación de correspondencia: esa varía entre corridas
según qué devolviera el buscador, y tomarla como cambio
llenaría el historial de versiones que no aportan nada.

Lo que cuenta es el CONJUNTO de cuentas atribuidas.
-----------------------------------------------------------
*/

function huellaDeContenido(perfilEjecutivo) {
  return (perfilEjecutivo?.tarjetas || [])
    .map((t) => `${t.plataformaId}:${String(t.handle).toLowerCase()}`)
    .sort()
    .join("|");
}


/*
===========================================================
REGISTRAR UNA INVESTIGACIÓN
===========================================================
*/

export async function registrarEnPerfilPermanente(entrada = {}) {
  const { perfil, perfilEjecutivo, origenDescubrimiento, contexto = {} } = entrada;

  const clave = claveIdentidad(perfil);

  if (!clave || !perfilEjecutivo) {
    return {
      registrado: false,
      motivo: !clave
        ? "sin nombre normalizable no hay clave de identidad"
        : "sin perfil ejecutivo no hay nada que persistir"
    };
  }

  const cuentasActuales = (perfilEjecutivo.tarjetas || []).map((t) => ({
    plataformaId: t.plataformaId,
    plataforma: t.plataforma,
    handle: t.handle,
    url: t.url,
    correspondencia: t.correspondencia
  }));

  /*
    ---------------------------------------------------------
    HISTORIAL PREVIO
    ---------------------------------------------------------
  */
  let historial = null;

  try {
    historial = await obtenerHistorialEntidad(clave, contexto);
  } catch (error) {
    /*
      Que el Lake no responda no puede tumbar la investigación.
      Se declara y se sigue.
    */
    historial = { error: error?.message || "el Lake no respondió" };
  }

  const versiones = historial?.versiones || [];

  const anterior = versiones.length ? versiones[versiones.length - 1] : null;

  /*
    Las entradas de `versiones` son METADATOS: llevan version,
    hash y fechas, pero no el contenido. Para saber que cuentas
    se guardaron hay que pedir el estado vigente, y la clave del
    Lake es compuesta.
  */
  const claveCompuesta = `${contexto.tenantId || TENANT_LOCAL}::${
    contexto.proyectoId || PROYECTO_ADHOC
  }::${TIPO_ENTIDAD}::${clave}`;

  let cuentasAnteriores = [];

  if (anterior) {
    try {
      const vigente = await obtenerVersionEntidad(claveCompuesta, contexto);

      cuentasAnteriores = vigente?.registro?.datos?.cuentas || [];
    } catch {
      cuentasAnteriores = [];
    }
  }

  const claveDe = (c) =>
    `${c.plataformaId}:${String(c.handle).toLowerCase()}`;

  const previas = new Set(cuentasAnteriores.map(claveDe));

  const actuales = new Set(cuentasActuales.map(claveDe));

  const nuevas = cuentasActuales.filter((c) => !previas.has(claveDe(c)));

  const noReaparecidas = cuentasAnteriores.filter(
    (c) => !actuales.has(claveDe(c))
  );

  const huella = huellaDeContenido(perfilEjecutivo);

  const huellaAnterior = cuentasAnteriores.length
    ? cuentasAnteriores
        .map((c) => claveDe(c))
        .sort()
        .join("|")
    : null;

  /*
    ---------------------------------------------------------
    NUNCA GUARDAR DUPLICADOS
    ---------------------------------------------------------

    Si el conjunto de cuentas es idéntico al de la última
    versión, no se escribe. Tres investigaciones iguales no
    deben dejar tres versiones iguales.
  */
  const sinCambios = huellaAnterior !== null && huellaAnterior === huella;

  let escritura = null;

  if (!sinCambios) {
    try {
      escritura = await escribirEnLake(
        {
          entidad: clave,
          tipoEntidad: TIPO_ENTIDAD,

          tenantId: contexto.tenantId || TENANT_LOCAL,
          proyectoId: contexto.proyectoId || PROYECTO_ADHOC,

          fuente: SUBMOTOR,
          motorOrigen: origenDescubrimiento || null,

          /* DT3 — trazabilidad obligatoria. */
          linaje: {
            submotor: SUBMOTOR,
            cadena: [
              "reference_profile",
              "discovery_engine",
              "identity_matcher",
              "account_classifier",
              "executive_profile"
            ],
            proveedor: origenDescubrimiento || null
          },

          /*
            EL CAMPO ES `datos`, NO `contenido`.

            Defecto detectado al probar la persistencia: el
            modelo del Lake mapea `entrada.datos`, asi que
            enviar `contenido` hacia que el registro se
            escribiera con datos: null. Se guardaban versiones
            vacias y la comprobacion de duplicados no tenia
            nada con que comparar. Perdida de datos silenciosa.
          */
          datos: {
            nombre: perfil?.nombrePrincipal || null,
            cargo: perfil?.contexto?.rol || null,
            pais: perfil?.contexto?.pais || null,

            cuentas: cuentasActuales,

            huellaDigital: perfilEjecutivo.huellaDigital?.valor ?? null,
            nivelHuella: perfilEjecutivo.huellaDigital?.nivel || null,

            medios: (perfilEjecutivo.medios || []).length,
            instituciones: (perfilEjecutivo.instituciones || []).length
          }
        },
        contexto
      );
    } catch (error) {
      escritura = { escrito: false, motivo: error?.message || "fallo de escritura" };
    }
  }

  return {
    version: "1.0",

    claveIdentidad: clave,

    /*
      Se declara la clave para que se vea bajo qué identidad se
      guardó. Ver el límite honesto en la cabecera.
    */
    limiteDeClave:
      "La identidad se guarda por nombre normalizado y país. Dos personas homónimas en el mismo país compartirían perfil, y la misma persona buscada con otro nombre tendría otro.",

    primeraVez: !anterior,

    versionesPrevias: versiones.length,

    registrado: sinCambios ? false : escritura?.escrito === true,

    sinCambios,

    motivo: sinCambios
      ? "El conjunto de cuentas es idéntico al de la última versión: no se escribe un duplicado."
      : escritura?.escrito
        ? "Versión nueva escrita en el Knowledge Lake."
        : escritura?.motivo || "no se pudo escribir",

    cambios: {
      cuentasNuevas: nuevas,

      cuentasNoReaparecidas: noReaparecidas,

      /*
        Distinción obligatoria. Una cuenta que no reaparece NO
        se declara eliminada: puede que el buscador no la
        devolviera esta vez.
      */
      advertenciaNoReaparecidas: noReaparecidas.length
        ? "Que una cuenta no reaparezca NO significa que se haya cerrado: el descubrimiento depende de lo que el proveedor devuelva en cada corrida. No se afirma eliminación."
        : null
    },

    diagnosticoLake: historial?.error || null
  };
}


export default { claveIdentidad, registrarEnPerfilPermanente };
