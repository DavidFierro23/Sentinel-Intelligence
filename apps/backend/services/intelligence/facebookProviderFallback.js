// apps/backend/services/intelligence/facebookProviderFallback.js

/*
===========================================================
ORQUESTADOR DEL FALLBACK DE FACEBOOK
P-CAND-OPERATIONAL-CLOSURE-01
===========================================================

Mismo patron que `instagramProviderFallback.js` -no se reimplementa
la decision de fuente, el cliente HTTP, ni el mapeo: se componen
las tres piezas ya reales y probadas-:

    socialSourceRouting     decide QUE fuente corresponde
    socialProviderClient    habla HTTP con el proveedor aprobado
    scrapeCreatorsMapper    traduce su respuesta a forma comun

Se abre cuando `observarFacebook` devuelve `REQUIERE_PPCA`: la
Pagina de un tercero existe pero Page Public Content Access no
esta aprobado. `fuenteParaActivo` ya reconocia ese literal desde
`socialSourceRouting.js` -esta es la primera vez que algo real lo
alimenta-.

`params.url` porque Facebook, a diferencia de Instagram/TikTok,
pide el sujeto por URL en el proveedor
(`parametroDeSujeto.facebook.perfil === "url"`), no por handle.
===========================================================
*/

import {
  fuenteParaActivo,
  CLASE_DE_FUENTE,
  ESTADO_DE_MEDICION,
  marcaDeFuente
} from "./socialSourceRouting.js";

import { pedirAlProveedor } from "../ingest/adapters/socialProviderClient.js";

import { perfilDeFacebook } from "../ingest/adapters/scrapeCreatorsMapper.js";

export async function observarFacebookConFallback(entrada = {}) {
  const {
    cuenta = null,
    resultadoOficial = null,
    proveedorId = "scrapecreators",
    entorno = process.env,
    fetchImpl = undefined
  } = entrada;

  const decision = fuenteParaActivo({
    platformId: "facebook",
    accountId: cuenta?.id || null,
    estadoOficial: resultadoOficial?.estado || null,
    proveedorPuede: true,
    proveedorId
  });

  if (decision.fuente !== CLASE_DE_FUENTE.PROVEEDOR) {
    return { usoFallback: false, decision, resultadoOficial };
  }

  const r = await pedirAlProveedor({
    providerId: proveedorId,
    platformId: "facebook",
    operacion: "perfil",
    params: { url: cuenta?.url || `https://facebook.com/${cuenta?.handle || ""}` },
    entorno,
    fetchImpl
  });

  if (r.estado !== "OK") {
    return {
      usoFallback: false,
      decision: { ...decision, fuente: null, estado: ESTADO_DE_MEDICION.SIN_FUENTE },
      resultadoOficial,
      proveedorError: { estado: r.estado, motivo: r.motivo || null }
    };
  }

  const perfil = perfilDeFacebook(r.datos);

  return {
    usoFallback: true,
    decision,
    marca: marcaDeFuente({
      fuente: CLASE_DE_FUENTE.PROVEEDOR,
      proveedorId,
      estado: ESTADO_DE_MEDICION.MEDIDO_PROVEEDOR
    }),
    perfil,
    resultadoOficial,
    llamadas: r.llamadas || 0
  };
}

export default { observarFacebookConFallback };
