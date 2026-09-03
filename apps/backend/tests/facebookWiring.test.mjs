// apps/backend/tests/facebookWiring.test.mjs

/*
===========================================================
FACEBOOK CONECTADO A observarCandidato
P-CAND-OPERATIONAL-CLOSURE-01
===========================================================

Cierra el bug root-cause certificado en P-CAND-SNAPSHOT-COLLECTION-01:
observarCandidato nunca tuvo rama Facebook. Sin red real: se
intercepta `globalThis.fetch` (graph.facebook.com y
api.scrapecreators.com), todo lo demas pasa.
===========================================================
*/

process.env.FACEBOOK_USER_ACCESS_TOKEN = "EAA-TOKEN-FICTICIO-NO-REAL-000";
process.env.META_APP_ID = "000000000000000";
process.env.META_APP_SECRET = "SECRETO-FICTICIO-NO-REAL-000";
process.env.SOCIAL_EXTERNAL_PROVIDER_ENABLED = "true";
process.env.SCRAPECREATORS_API_KEY = "clave-ficticia-de-prueba";

const { observarCandidato } = await import("../services/intelligence/candidateObservation.js");

let pass = 0, fail = 0;
const fallos = [];
async function t(nombre, fn) {
  try {
    const v = await fn();
    if (v === true) { pass++; console.log(`  PASS  ${nombre}`); }
    else { fail++; fallos.push(nombre); console.log(`  FALL  ${nombre} (${JSON.stringify(v)})`); }
  } catch (e) { fail++; fallos.push(`${nombre} (${e.message})`); console.log(`  ERR   ${nombre} ${e.stack}`); }
}
function bloque(x) { console.log(`\n--- ${x} ---`); }

const fetchReal = globalThis.fetch;
const json = (c, s = 200) => ({ ok: s >= 200 && s < 300, status: s, text: async () => JSON.stringify(c) });

let modoTercero = "ppca"; // "ppca" | "ok"
const PAGE_PROPIA_ID = "10000000001";
const PAGE_PROPIA_USERNAME = "paginapropiatest";

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("api.scrapecreators.com")) {
    return json({ id: "999", name: "Pagina De Tercero", url: "https://www.facebook.com/paginaterceratest", followerCount: 4200, likeCount: 4300 });
  }
  if (u.includes("graph.facebook.com")) {
    if (u.includes("/me/accounts")) {
      return json({ data: [{ id: PAGE_PROPIA_ID, name: "Mi Pagina", username: PAGE_PROPIA_USERNAME }] });
    }
    if (u.includes(PAGE_PROPIA_ID) || u.includes(PAGE_PROPIA_USERNAME)) {
      return json({ id: PAGE_PROPIA_ID, name: "Mi Pagina", username: PAGE_PROPIA_USERNAME, link: "https://facebook.com/paginapropiatest", followers_count: 5000, fan_count: 5010 });
    }
    // Pagina de tercero
    if (modoTercero === "ok") {
      return json({ id: "222", name: "Pagina Tercero", username: "paginaterceratest", link: "https://facebook.com/paginaterceratest", followers_count: 7000, fan_count: 7010 });
    }
    return json({ error: { message: "Missing Permissions", code: 200, type: "OAuthException" } }, 403);
  }
  return fetchReal(url);
};

/* ---------------------------------------------------------
   C · FACEBOOK ENTRA POR observarCandidato (no queda fuera del loop)
--------------------------------------------------------- */
bloque("C · Facebook pasa por observarCandidato");

const rPropia = await observarCandidato({
  candidateId: "cand-fb-1",
  projectId: "proy-fb-test",
  cuentas: [{ id: `facebook:${PAGE_PROPIA_USERNAME}`, plataformaId: "facebook", handle: PAGE_PROPIA_USERNAME, url: `https://facebook.com/${PAGE_PROPIA_USERNAME}` }],
  plataformas: ["facebook"],
  paginasPropias: [{ pageId: PAGE_PROPIA_ID, username: PAGE_PROPIA_USERNAME }]
});

await t("observarCandidato produce un resultado real para el activo Facebook (no se queda fuera del loop)", () => {
  return rPropia.resultados.length === 1 && rPropia.resultados[0].plataformaId === "facebook";
});

/* ---------------------------------------------------------
   D · ROUTING OFICIAL PARA PAGINA PROPIA
--------------------------------------------------------- */
bloque("D · Pagina propia se mide oficialmente");

await t("Pagina propia: OBSERVADA con alcance MEDIDO_PROPIO_AUTORIZADO", () => {
  const r = rPropia.resultados[0];
  return r.estado === "OBSERVADA" && r.alcanceDeLaMedicion === "MEDIDO_PROPIO_AUTORIZADO" && r.canal.estadisticasPublicas.followers === 5000;
});

/* ---------------------------------------------------------
   E · PPCA != SIN_CUENTA
--------------------------------------------------------- */
bloque("E · PPCA nunca se confunde con sin cuenta");

modoTercero = "ppca";
const rTercero = await observarCandidato({
  candidateId: "cand-fb-2",
  projectId: "proy-fb-test",
  cuentas: [{ id: "facebook:paginaterceratest", plataformaId: "facebook", handle: "paginaterceratest", url: "https://facebook.com/paginaterceratest" }],
  plataformas: ["facebook"],
  paginasPropias: [{ pageId: PAGE_PROPIA_ID, username: PAGE_PROPIA_USERNAME }]
});

await t("Pagina de tercero sin PPCA: estado REQUIERE_PPCA, nunca CUENTA_NO_RESUELTA", () => {
  const r = rTercero.resultados[0];
  return r.estado === "REQUIERE_PPCA";
});

/* ---------------------------------------------------------
   D/bis · FALLBACK DE PROVEEDOR PARA TERCERO
--------------------------------------------------------- */
bloque("D-bis · fallback de proveedor cuando PPCA bloquea");

const rConProveedor = await observarCandidato({
  candidateId: "cand-fb-3",
  projectId: "proy-fb-test",
  cuentas: [{ id: "facebook:paginaterceratest", plataformaId: "facebook", handle: "paginaterceratest", url: "https://facebook.com/paginaterceratest" }],
  plataformas: ["facebook"],
  paginasPropias: [{ pageId: PAGE_PROPIA_ID, username: PAGE_PROPIA_USERNAME }],
  proveedorFacebook: { id: "scrapecreators", entorno: process.env }
});

await t("con opt-in de proveedor, el bloqueo PPCA se resuelve a MEDIDO_PROVEEDOR", () => {
  const r = rConProveedor.resultados[0];
  return r.estado === "MEDIDO_PROVEEDOR" && r.canalProveedor?.followers === 4200 && r.estadoOficialConservado === "REQUIERE_PPCA";
});

await t("sin opt-in de proveedor, el bloqueo PPCA NO se mide (capa de servidor sigue siendo la que decide)", () => {
  return rTercero.resultados[0].estado === "REQUIERE_PPCA" && !rTercero.resultados[0].canalProveedor;
});

/* ---------------------------------------------------------
   F · MULTI-ASSET FACEBOOK
--------------------------------------------------------- */
bloque("F · multi-asset Facebook preservado");

const rMulti = await observarCandidato({
  candidateId: "cand-fb-4",
  projectId: "proy-fb-test",
  cuentas: [
    { id: `facebook:${PAGE_PROPIA_USERNAME}`, plataformaId: "facebook", handle: PAGE_PROPIA_USERNAME, url: `https://facebook.com/${PAGE_PROPIA_USERNAME}` },
    { id: "facebook:paginaterceratest", plataformaId: "facebook", handle: "paginaterceratest", url: "https://facebook.com/paginaterceratest" }
  ],
  plataformas: ["facebook"],
  paginasPropias: [{ pageId: PAGE_PROPIA_ID, username: PAGE_PROPIA_USERNAME }]
});

await t("2 activos Facebook del mismo candidato resuelven independiente, sin colapsar", () => {
  return rMulti.resultados.length === 2 &&
    rMulti.resultados[0].estado === "OBSERVADA" &&
    rMulti.resultados[1].estado === "REQUIERE_PPCA";
});

/* ---------------------------------------------------------
   Perfil personal: nunca medible
--------------------------------------------------------- */
bloque("Perfil personal de Facebook: CAPACIDAD_NO_DISPONIBLE sin intentar");

const rPerfil = await observarCandidato({
  candidateId: "cand-fb-5",
  projectId: "proy-fb-test",
  cuentas: [{ id: "facebook:perfilpersonal", plataformaId: "facebook", handle: "perfilpersonal", url: "https://facebook.com/perfilpersonal" }],
  plataformas: ["facebook"],
  tiposDeActivo: { "facebook:perfilpersonal": "FACEBOOK_PROFILE" },
  paginasPropias: []
});

await t("perfil personal declarado: CAPACIDAD_NO_DISPONIBLE, cero llamadas reales", () => {
  const r = rPerfil.resultados[0];
  return r.estado === "CAPACIDAD_NO_DISPONIBLE" && (r.traza?.llamadas || []).length === 0;
});

console.log(`\n===========================================\nPASS: ${pass}    FALL: ${fail}\n===========================================`);
if (fail > 0) { console.log("Fallos:", fallos); process.exitCode = 1; }
globalThis.fetch = fetchReal;
