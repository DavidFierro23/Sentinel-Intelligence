// apps/backend/services/intelligence/instagramProviderFallback.js

/*
===========================================================
ORQUESTADOR DEL FALLBACK DE INSTAGRAM
P-CAND-INSTAGRAM-FALLBACK-01
===========================================================

Compone tres piezas que ya existen y que NO se tocan aqui:

    socialSourceRouting     decide QUE fuente corresponde
    socialProviderClient    habla HTTP con el proveedor aprobado
    scrapeCreatorsMapper    traduce su respuesta a forma comun

Este archivo no reimplementa ninguna de las tres. Es la capa que
las conecta para el caso concreto de Instagram.

POR QUE ESTO NO ESTA ENGANCHADO EN LA RUTA HTTP TODAVIA
-----------------------------------------------------------

`candidateObservation.js` y `routes/projects.js` sostienen la
mayoria de la suite de Candidate Intelligence —igRoute,
multiAsset, socialCoverage, realObservation, candidateIntelligence,
crossLinkEvidence, baselineT0—. Engancharlo ahi exige ademas
decidir presupuesto, budget de creditos y manejo de errores por
HTTP, que es mas superficie de la que este gate corto autoriza
tocar de una vez.

Esta funcion SI es real y SI llama al cliente generico y al
mapper reales: no es un stub. Lo que falta es que
`observarCandidato` o la ruta la invoquen cuando el estado
oficial de un activo de Instagram este en `OFICIAL_NO_PUEDE`.
Ese punto de enganche queda documentado, no adivinado.

QUE NO HACE
-----------------------------------------------------------

No pide publicaciones ni comentarios: solo perfil, que es lo
minimo para producir un MEDIDO_PROVEEDOR equivalente al canal
que devuelve `observarInstagram`. Ampliar a publicaciones y
comentarios es la extension natural de este mismo archivo el
dia que se enganche a la ruta real.
===========================================================
*/

import {
  fuenteParaActivo,
  CLASE_DE_FUENTE,
  ESTADO_DE_MEDICION,
  marcaDeFuente
} from "./socialSourceRouting.js";

import { pedirAlProveedor } from "../ingest/adapters/socialProviderClient.js";

import { perfilDeInstagram } from "../ingest/adapters/scrapeCreatorsMapper.js";


/*
===========================================================
DECIDIR Y, SI TOCA, MEDIR CON EL PROVEEDOR
===========================================================

    resultadoOficial   lo que ya devolvio observarInstagram()
                        para ESTE activo. Nunca se recalcula ni
                        se pide de nuevo a Meta desde aqui.

Devuelve siempre `resultadoOficial` intacto en el campo del
mismo nombre, se use o no el proveedor: es lo que impide que
esta funcion sobrescriba un estado oficial por accidente.
===========================================================
*/
export async function observarInstagramConFallback(entrada = {}) {
  const {
    cuenta = null,
    resultadoOficial = null,
    proveedorId = "scrapecreators",
    entorno = process.env,
    fetchImpl = undefined
  } = entrada;

  const decision = fuenteParaActivo({
    platformId: "instagram",
    accountId: cuenta?.id || null,
    estadoOficial: resultadoOficial?.estado || null,

    /*
      Se pasa `true` a proposito: quien decide de verdad si el
      proveedor PUEDE es `pedirAlProveedor`, que comprueba
      aprobacion, bandera y credencial antes de salir a la red.
      Duplicar esa comprobacion aqui abriria la puerta a que las
      dos digan cosas distintas.
    */
    proveedorPuede: true,
    proveedorId
  });

  if (decision.fuente !== CLASE_DE_FUENTE.PROVEEDOR) {
    return {
      usoFallback: false,
      decision,
      resultadoOficial
    };
  }

  const r = await pedirAlProveedor({
    providerId: proveedorId,
    platformId: "instagram",
    operacion: "perfil",
    params: { handle: cuenta?.handle },
    entorno,
    fetchImpl
  });

  if (r.estado !== "OK") {
    /*
      El proveedor no pudo, por lo que sea: sin credencial, sin
      aprobar, bloqueado, error. El estado oficial SIGUE siendo
      el que era, y se declara SIN_FUENTE con la causa real del
      proveedor a mano para quien investigue.
    */
    return {
      usoFallback: false,
      decision: {
        ...decision,
        fuente: null,
        estado: ESTADO_DE_MEDICION.SIN_FUENTE
      },
      resultadoOficial,
      proveedorError: {
        estado: r.estado,
        motivo: r.motivo || null
      }
    };
  }

  const perfil = perfilDeInstagram(r.datos);

  return {
    usoFallback: true,
    decision,

    marca: marcaDeFuente({
      fuente: CLASE_DE_FUENTE.PROVEEDOR,
      proveedorId,
      estado: ESTADO_DE_MEDICION.MEDIDO_PROVEEDOR
    }),

    perfil,

    /* El estado oficial previo, intacto, para que nadie lo pierda. */
    resultadoOficial,

    llamadas: r.llamadas || 0
  };
}


export default { observarInstagramConFallback };
