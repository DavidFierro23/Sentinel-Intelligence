// apps/backend/tests/candidateSnapshotCollection.test.mjs

/*
===========================================================
COLECCION REPETIBLE DE SNAPSHOTS DE CANDIDATO
P-CAND-SNAPSHOT-COLLECTION-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/candidateSnapshotCollection.test.mjs

SIN RED real: se intercepta `globalThis.fetch` globalmente (mismo
patron que instagramHttpFallback.test.mjs / snapshotPersistenceHttp.test.mjs),
dejando pasar solo lo que el propio test define. No se llama a
Express -las funciones de `candidateSnapshotCollection.js` son
funciones de dominio puras respecto a HTTP, se llaman directo-.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";
process.env.SOCIAL_EXTERNAL_PROVIDER_ENABLED = "true";
process.env.SCRAPECREATORS_API_KEY = "clave-ficticia-de-prueba";
process.env.FACEBOOK_USER_ACCESS_TOKEN = "EAA-TOKEN-FICTICIO-NO-REAL-000";
process.env.INSTAGRAM_ACCESS_TOKEN = "IGQ-TOKEN-FICTICIO-NO-REAL-000";
process.env.META_APP_ID = "000000000000000";
process.env.META_APP_SECRET = "SECRETO-FICTICIO-NO-REAL-000";
delete process.env.X_BEARER_TOKEN;
delete process.env.YOUTUBE_API_KEY;

const ps = await import("../services/projects/projectStore.js");
const ca = await import("../services/intelligence/candidateAssets.js");
const sc = await import("../services/intelligence/candidateSnapshotCollection.js");
const { resolverIdentidadCanonica } = await import("../services/intelligence/accountIdentity.js");
const { IDENTITY_STATES } = await import("../services/intelligence/socialBenchmarkMatrix.js");

let pass = 0;
let fail = 0;
const fallos = [];

async function t(nombre, comprobacion) {
  try {
    const valor = await comprobacion();
    if (valor === true) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}  (devolvio ${JSON.stringify(valor)})`);
    }
  } catch (error) {
    fail += 1;
    fallos.push(`${nombre} (${error.message})`);
    console.log(`  ERR   ${nombre}  ${error.stack}`);
  }
}
function bloque(t) { console.log(`\n--- ${t} ---`); }

const fetchReal = globalThis.fetch;
const json = (cuerpo, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(cuerpo)
});

let llamadasProveedor = [];
let contadorSeguidores = { valor: 1000 };
let modoProveedorParaHandle = {}; // handle -> "ok" | "fail"

const perfilSintetico = (handle) => ({
  data: {
    user: {
      id: "360000",
      username: handle,
      full_name: "Nombre Sintetico",
      is_private: false,
      edge_followed_by: { count: contadorSeguidores.valor },
      edge_follow: { count: 5 },
      edge_owner_to_timeline_media: { count: 3 }
    }
  }
});

globalThis.fetch = async (url, opciones) => {
  const u = String(url);
  if (u.includes("api.scrapecreators.com")) {
    const handle = new URL(u).searchParams.get("handle") || "desconocido";
    llamadasProveedor.push(handle);
    if (modoProveedorParaHandle[handle.toLowerCase()] === "fail") return json({ error: "fallo sintetico" }, 500);
    return json(perfilSintetico(handle));
  }
  if (!u.includes("graph.facebook.com")) return fetchReal(url, opciones);
  return json({ error: { code: 100 } }, 400);
};

async function crearProyecto(pid) {
  await ps.crearProyecto({ id: pid, nombre: `Prueba ${pid}`, canton: "Cuenca", pais: "Ecuador", dignidad: "Alcaldia" });
}

async function agregarCandidatoConInstagram(pid, nombre, handles) {
  const r = await ps.agregarCandidato(pid, { nombre, cuentas: handles.map((h) => `https://www.instagram.com/${h}/`) });
  const cid = r.candidato.id;
  for (const h of handles) {
    const d = ca.crearDeclaracionDeTipo({
      candidateId: cid, assetId: `instagram:${h.toLowerCase()}`, platform: "instagram",
      url: `https://www.instagram.com/${h}`, declaredType: "INSTAGRAM_PERSONAL"
    });
    if (!d.valido) throw new Error(`declaracion invalida: ${d.motivo}`);
    await ps.guardarDeclaracionesDeTipo(pid, cid, [d.declaracion], { declaradoEn: new Date().toISOString() });
  }
  return cid;
}

/* ---------------------------------------------------------
   A/B/D · RUN PROJECT-SCOPED, MULTIPLES CANDIDATOS, MULTI-ASSET
--------------------------------------------------------- */
bloque("A/B/D · run project-scoped con multiples candidatos y multi-asset");

const PID1 = "coleccion-proyecto-1";
await crearProyecto(PID1);
const cidUno = await agregarCandidatoConInstagram(PID1, "Candidato Uno", ["HandleUnoA", "HandleUnoB"]);
const cidDos = await agregarCandidatoConInstagram(PID1, "Candidato Dos", ["HandleDos"]);

contadorSeguidores.valor = 111;
llamadasProveedor = [];

const run1 = await sc.collectCandidateSnapshots(PID1, {
  plataformas: ["instagram"],
  proveedorInstagram: { id: "scrapecreators", entorno: process.env }
});

await t("recorre los 2 candidatos del proyecto", () => run1.candidatesAttempted === 2);
await t("multi-asset: candidato uno con 2 activos, ambos intentados", () => {
  const filaUno = run1.candidatos.find((c) => c.candidatoId === cidUno);
  return filaUno.resultadosPorActivo.length === 2;
});
await t("los 3 activos totales (2+1) se midieron", () => run1.assetsMeasured === 3);
await t("identidad analista-declarada se reporta correctamente por activo", () => {
  const filaUno = run1.candidatos.find((c) => c.candidatoId === cidUno);
  return filaUno.resultadosPorActivo.every((a) => a.identityState === IDENTITY_STATES.ANALYST_CONFIRMED);
});
await t("snapshotsCreated coincide con activos medidos por proveedor", () => run1.snapshotsCreated === 3);

/* ---------------------------------------------------------
   C · CONFLICTO DE IDENTIDAD EXCLUIDO — 0 REQUESTS
--------------------------------------------------------- */
bloque("C · IDENTITY_CONFLICT excluido, 0 requests");

const PID2 = "coleccion-proyecto-2";
await crearProyecto(PID2);
const cidConflicto = await agregarCandidatoConInstagram(PID2, "Candidato Con Homonimo", ["CuentaBuena", "CuentaHomonimo"]);

const conflictos = new Set([resolverIdentidadCanonica("instagram:cuentahomonimo")]);
llamadasProveedor = [];
contadorSeguidores.valor = 222;

const run2 = await sc.collectCandidateSnapshots(PID2, {
  plataformas: ["instagram"],
  proveedorInstagram: { id: "scrapecreators", entorno: process.env },
  conflictosConocidos: conflictos
});

await t("el activo en conflicto nunca genera una llamada al proveedor", () => {
  return !llamadasProveedor.includes("CuentaHomonimo") && !llamadasProveedor.includes("cuentahomonimo");
});
await t("el activo en conflicto se reporta como SKIPPED_IDENTITY_CONFLICT", () => {
  const fila = run2.candidatos[0];
  const conflictivo = fila.resultadosPorActivo.find((a) => a.accountId === "instagram:cuentahomonimo");
  return conflictivo?.categoria === "SKIPPED_IDENTITY_CONFLICT";
});
await t("el activo NO conflictivo del mismo candidato si se mide", () => run2.assetsMeasured === 1);
await t("assetsSkipped cuenta el activo excluido", () => run2.assetsSkipped === 1);

/* ---------------------------------------------------------
   E · CANONICAL ACCOUNT ID EN EL SNAPSHOT PERSISTIDO
--------------------------------------------------------- */
bloque("E · accountId canonico persistido");

const snapsP2 = await ps.snapshotsDe(PID2, cidConflicto);
await t("el accountId persistido es canonico (minuscula)", () => {
  return snapsP2.some((s) => s.accountId === "instagram:cuentabuena");
});

/* ---------------------------------------------------------
   G/H · APPEND-ONLY: RETRY NO PISA, MOMENTOS DISTINTOS SOBREVIVEN
--------------------------------------------------------- */
bloque("G/H · append-only, dos observaciones reales sobreviven");

const antesP1 = await ps.snapshotsDe(PID1, cidDos);
contadorSeguidores.valor = 999;
await new Promise((r) => setTimeout(r, 5));
await sc.observarYPersistirCandidato(PID1, cidDos, {
  plataformas: ["instagram"],
  proveedorInstagram: { id: "scrapecreators", entorno: process.env }
});
const despuesP1 = await ps.snapshotsDe(PID1, cidDos);

await t("una segunda observacion real agrega un snapshot nuevo, no sobrescribe", () => {
  return despuesP1.length === antesP1.length + 1;
});
await t("el snapshot original conserva su valor (no se reescribio historia)", () => {
  return antesP1.some((s) => s.followers === 111);
});
await t("el nuevo snapshot tiene el valor nuevo real", () => {
  return despuesP1.some((s) => s.followers === 999);
});

/* ---------------------------------------------------------
   I · FALLO DE PROVEEDOR NO DESTRUYE SNAPSHOT ANTERIOR
--------------------------------------------------------- */
bloque("I · provider failure no destruye snapshot anterior");

const PID3 = "coleccion-proyecto-3";
await crearProyecto(PID3);
const cidTres = await agregarCandidatoConInstagram(PID3, "Candidato Tres", ["HandleTres"]);

contadorSeguidores.valor = 5000;
await sc.observarYPersistirCandidato(PID3, cidTres, {
  plataformas: ["instagram"],
  proveedorInstagram: { id: "scrapecreators", entorno: process.env }
});
const antesFallo = await ps.snapshotsDe(PID3, cidTres);

modoProveedorParaHandle["handletres"] = "fail";
const runFallo = await sc.observarYPersistirCandidato(PID3, cidTres, {
  plataformas: ["instagram"],
  proveedorInstagram: { id: "scrapecreators", entorno: process.env }
});
modoProveedorParaHandle["handletres"] = "ok";
const despuesFallo = await ps.snapshotsDe(PID3, cidTres);

await t("el fallo del proveedor produce categoria PROVIDER_ERROR", () => {
  const activo = runFallo.resultadosPorActivo.find((a) => a.accountId === "instagram:handletres");
  return activo?.categoria === "PROVIDER_ERROR";
});
await t("el snapshot anterior (exitoso) sigue intacto tras el fallo", () => {
  return despuesFallo.length === antesFallo.length && despuesFallo.some((s) => s.followers === 5000);
});

/* ---------------------------------------------------------
   K · SIN CUENTA PRODUCE ESTADO EXPLICITO
--------------------------------------------------------- */
bloque("K · sin cuenta -> estado explicito");

const PID4 = "coleccion-proyecto-4";
await crearProyecto(PID4);
await ps.agregarCandidato(PID4, { nombre: "Candidato Sin Redes", cuentas: [] });
const contenido4 = await ps.contenidoDeProyecto(PID4);
const cid4 = contenido4.candidatos[0].id;

const run4 = await sc.collectCandidateSnapshots(PID4, { plataformas: ["instagram"] });
await t("candidato sin ninguna cuenta produce un run sin error, 0 activos", () => {
  return run4.candidatesAttempted === 1 && run4.assetsAttempted === 0;
});

/* ---------------------------------------------------------
   L · PROJECT ISOLATION
--------------------------------------------------------- */
bloque("L · project isolation entre proyectos de esta suite");

await t("PID1 no ve snapshots de PID2", () => {
  return !antesP1.concat(despuesP1).some((s) => s.followers === 222);
});
await t("cada snapshot lleva su projectId correcto", () => {
  return despuesP1.every((s) => s.projectId === PID1) && despuesFallo.every((s) => s.projectId === PID3);
});

/* ---------------------------------------------------------
   M · NULL != ZERO
--------------------------------------------------------- */
bloque("M · null != zero");

await t("postsObserved es 0 real (no se pidieron posts), followers nunca 0 por omision", () => {
  return despuesFallo.every((s) => s.postsObserved === 0 && typeof s.followers === "number" && s.followers > 0);
});

/* ---------------------------------------------------------
   P · RESUMEN DE RUN ESTRUCTURADO
--------------------------------------------------------- */
bloque("P · resumen de run correcto");

await t("el resumen trae runId, projectId, startedAt, finishedAt", () => {
  return typeof run1.runId === "string" && run1.projectId === PID1 && !!run1.startedAt && !!run1.finishedAt;
});
await t("porPlataforma trae las 5 plataformas del contrato", () => {
  return ["facebook", "instagram", "tiktok", "x", "youtube"].every((p) => p in run1.porPlataforma);
});
await t("no se inventan porcentajes: solo conteos enteros", () => {
  return Number.isInteger(run1.assetsAttempted) && Number.isInteger(run1.assetsMeasured);
});

/* ---------------------------------------------------------
   Q · PRESUPUESTO DE PROVEEDOR RESPETADO
--------------------------------------------------------- */
bloque("Q · sin opt-in de proveedor, 0 llamadas a ScrapeCreators");

llamadasProveedor = [];
const runSinProveedor = await sc.collectCandidateSnapshots(PID3, { plataformas: ["instagram"] });
await t("sin proveedorInstagram en las opciones, el proveedor nunca se llama", () => llamadasProveedor.length === 0);
await t("el activo personal sin proveedor queda REQUIRES_PROVIDER, no MEASURED", () => {
  const activo = runSinProveedor.candidatos[0].resultadosPorActivo.find((a) => a.accountId === "instagram:handletres");
  return activo?.categoria === "REQUIRES_PROVIDER";
});

console.log(`\n===========================================\nPASS: ${pass}    FALL: ${fail}\n===========================================`);
if (fail > 0) { console.log("Fallos:", fallos); process.exitCode = 1; }
globalThis.fetch = fetchReal;
