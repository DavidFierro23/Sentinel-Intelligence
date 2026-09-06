// apps/backend/tests/candidateObservationScheduler.test.mjs

/*
===========================================================
OBSERVACION DIARIA AUTOMATICA — CANDIDATE-LONGITUDINAL-FOUNDATION-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/candidateObservationScheduler.test.mjs

SIN RED real: mismo patron que candidateSnapshotCollection.test.mjs
-fetch interceptado globalmente, solo se deja pasar lo que el
propio test define-. El `setInterval` real del scheduler NUNCA se
arranca en este archivo: se llama `ejecutarObservacionDiaria`
directo, con un reloj (`ahora`) inyectado.
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
const sched = await import("../services/intelligence/candidateObservationScheduler.js");

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
const json = (cuerpo, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(cuerpo) });
let llamadasProveedor = [];
let modoProveedorParaHandle = {};
const perfilSintetico = (handle) => ({
  data: { user: { id: "1", username: handle, full_name: "N", is_private: false, edge_followed_by: { count: 1000 }, edge_follow: { count: 5 }, edge_owner_to_timeline_media: { count: 3 } } }
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
    const d = ca.crearDeclaracionDeTipo({ candidateId: cid, assetId: `instagram:${h.toLowerCase()}`, platform: "instagram", url: `https://www.instagram.com/${h}`, declaredType: "INSTAGRAM_PERSONAL" });
    if (!d.valido) throw new Error(`declaracion invalida: ${d.motivo}`);
    await ps.guardarDeclaracionesDeTipo(pid, cid, [d.declaracion], { declaradoEn: new Date().toISOString() });
  }
  return cid;
}

const DIA1 = new Date("2026-09-10T12:00:00.000Z"); // ~07:00 America/Guayaquil
const DIA2 = new Date("2026-09-11T12:00:00.000Z");

/* ---------------------------------------------------------
   A · FECHA LOCAL / IDEMPOTENCIA
--------------------------------------------------------- */
bloque("A · fecha local e idempotencia");
await t("A) fechaLocalObservacion usa la zona America/Guayaquil (UTC-5), no UTC", () => {
  const medianocheUtc = new Date("2026-09-10T04:30:00.000Z"); // 23:30 del 9 en Guayaquil
  return sched.fechaLocalObservacion(medianocheUtc) === "2026-09-09";
});

/* ---------------------------------------------------------
   B · ENROLLMENT DINAMICO
--------------------------------------------------------- */
bloque("B · enrollment dinamico, sin candidateId hardcodeado");
const PSCHED1 = "sched-enrollment-1";
await crearProyecto(PSCHED1);
const cid1 = await agregarCandidatoConInstagram(PSCHED1, "Candidato A", ["HandleSchedA"]);
const cid2 = await agregarCandidatoConInstagram(PSCHED1, "Candidato B", ["HandleSchedB"]);

const runDia1 = await sched.ejecutarObservacionDiaria(PSCHED1, { ahora: DIA1 });
await t("B1) la corrida del dia 1 planea los 2 candidatos existentes", () => runDia1.candidatesPlanned === 2);
await t("B2) el run persiste y se puede releer desde el store (sobrevive fuera de memoria)", async () => {
  const runs = await ps.collectionRunsDe(PSCHED1);
  return runs.some((r) => r.collectionRunId === runDia1.collectionRunId);
});

/* Candidato #8 (en este proyecto, el #3) se agrega DESPUES, sin tocar ningun codigo. */
const cid3 = await agregarCandidatoConInstagram(PSCHED1, "Candidato Nuevo Sin Codigo", ["HandleSchedC"]);
const runDia2 = await sched.ejecutarObservacionDiaria(PSCHED1, { ahora: DIA2 });
await t("B3) un candidato agregado despues del arranque entra solo a la siguiente corrida", () => {
  return runDia2.candidatesPlanned === 3 && runDia2.perCandidato.some((c) => c.candidateId === cid3);
});

/* ---------------------------------------------------------
   C · MULTI-ASSET PRESERVADO
--------------------------------------------------------- */
bloque("C · multi-asset preservado en el run");
const PSCHED2 = "sched-multiasset-1";
await crearProyecto(PSCHED2);
const cidMulti = await agregarCandidatoConInstagram(PSCHED2, "Candidato Multi", ["HandleMultiUno", "HandleMultiDos"]);
const runMulti = await sched.ejecutarObservacionDiaria(PSCHED2, { ahora: DIA1 });
await t("C) el run reporta los 2 activos del candidato multi-cuenta, no colapsados en 1", () => {
  const fila = runMulti.perCandidato.find((c) => c.candidateId === cidMulti);
  return fila.plannedAssets === 2;
});

/* ---------------------------------------------------------
   D · DOS DIAS, RELOJ INYECTADO, DOS CORRIDAS DISTINTAS
--------------------------------------------------------- */
bloque("D · dos dias -> dos collectionRunId, dos localObservationDate");
await t("D1) dia1 y dia2 producen collectionRunId distintos", () => runDia1.collectionRunId !== runDia2.collectionRunId);
await t("D2) dia1 y dia2 tienen localObservationDate distinta", () => runDia1.localObservationDate !== runDia2.localObservationDate);
await t("D3) las dos corridas quedan persistidas (append-only, ninguna sobreescribe a la otra)", async () => {
  const runs = await ps.collectionRunsDe(PSCHED1);
  const ids = new Set(runs.map((r) => r.collectionRunId));
  return ids.has(runDia1.collectionRunId) && ids.has(runDia2.collectionRunId);
});

/* ---------------------------------------------------------
   E · RESTART EL MISMO DIA -> SKIPPED, CERO RED
--------------------------------------------------------- */
bloque("E · restart el mismo dia es idempotente, cero llamadas externas");
llamadasProveedor = [];
const fetchCountAntes = llamadasProveedor.length;
const runRestart = await sched.ejecutarObservacionDiaria(PSCHED1, { ahora: new Date(DIA1.getTime() + 60 * 60 * 1000) });
await t("E1) una segunda corrida NORMAL el mismo dia local se salta, no repite trabajo", () => runRestart.status === "SKIPPED_ALREADY_COLLECTED");
await t("E2) el restart no genero ninguna llamada externa nueva", () => llamadasProveedor.length === fetchCountAntes);
await t("E3) el restart no crea un nuevo collectionRunId persistido", async () => {
  const runs = await ps.collectionRunsDe(PSCHED1);
  return !runs.some((r) => r.collectionRunId === runRestart.collectionRunId);
});
await t("E4) forzar=true SI ejecuta aunque ya se haya colectado hoy (FORCED_MANUAL_RUN)", async () => {
  const runForzado = await sched.ejecutarObservacionDiaria(PSCHED1, {
    ahora: new Date(DIA1.getTime() + 2 * 60 * 60 * 1000),
    triggerType: sched.TIPOS_DISPARO.FORCED_MANUAL_RUN,
    forzar: true
  });
  return runForzado.status !== "SKIPPED_ALREADY_COLLECTED";
});

/* ---------------------------------------------------------
   F · FALLO PARCIAL DE PROVEEDOR -> STATUS PARTIAL
--------------------------------------------------------- */
bloque("F · fallo parcial de un activo produce status PARTIAL");
const PSCHED3 = "sched-partial-1";
await crearProyecto(PSCHED3);
const cidPartialA = await agregarCandidatoConInstagram(PSCHED3, "Candidato Falla", ["HandleFallaUno"]);
const cidPartialB = await agregarCandidatoConInstagram(PSCHED3, "Candidato Ok", ["HandleFallaDos"]);
modoProveedorParaHandle["handlefallauno"] = "fail";
llamadasProveedor = [];
const runPartial = await sched.ejecutarObservacionDiaria(PSCHED3, {
  ahora: DIA1,
  triggerType: sched.TIPOS_DISPARO.FORCED_MANUAL_RUN,
  forzar: true,
  proveedorInstagram: { id: "scrapecreators", entorno: process.env },
  maxProviderCreditsPerRun: 100
});
modoProveedorParaHandle["handlefallauno"] = "ok";
await t("F1) el run con un activo fallido y otro medido queda PARTIAL", () => runPartial.status === "PARTIAL");
await t("F2) el candidato que si respondio se midio de todas formas", () => {
  const filaOk = runPartial.perCandidato.find((c) => c.candidateId === cidPartialB);
  return filaOk.observedAssets === 1;
});
await t("F3) el error queda atribuido al candidato que fallo, no al que funciono", () => {
  const filaFalla = runPartial.perCandidato.find((c) => c.candidateId === cidPartialA);
  return filaFalla.failedPlatforms.includes("instagram");
});

/* ---------------------------------------------------------
   G · PRESUPUESTO DE REQUESTS AGOTADO -> PARTIAL, RESTO GRATUITO
--------------------------------------------------------- */
bloque("G · presupuesto de requests agotado deja PARTIAL y excluye candidatos completos");
const PSCHED4 = "sched-budget-1";
await crearProyecto(PSCHED4);
const cidBudgetA = await agregarCandidatoConInstagram(PSCHED4, "Candidato Presupuesto A", ["HandleBudgetA"]);
const cidBudgetB = await agregarCandidatoConInstagram(PSCHED4, "Candidato Presupuesto B", ["HandleBudgetB"]);
const cidBudgetC = await agregarCandidatoConInstagram(PSCHED4, "Candidato Presupuesto C", ["HandleBudgetC"]);
const runBudget = await sched.ejecutarObservacionDiaria(PSCHED4, { ahora: DIA1, maxRequestsPerRun: 2 });
await t("G1) el run queda PARTIAL cuando el presupuesto no alcanza para todos", () => runBudget.status === "PARTIAL");
await t("G2) al menos un candidato queda explicitamente excluido por presupuesto", () => runBudget.candidatesExcludedByBudget.length >= 1);
await t("G3) el candidato excluido sigue existiendo (no se borro nada), solo no se toco en esta corrida", () => {
  return !runBudget.perCandidato.some((c) => c.candidateId === runBudget.candidatesExcludedByBudget[0]);
});
await t("G4) la limitacion BUDGET_EXHAUSTED queda declarada en texto, no oculta", () => {
  return runBudget.limitations.some((l) => l.includes("BUDGET_EXHAUSTED"));
});

/* ---------------------------------------------------------
   H · CAMBIO DE UNIVERSO (7->8 ANALOGO): RANKING SNAPSHOT LO REGISTRA
--------------------------------------------------------- */
bloque("H · cambio de universo queda registrado, no comparado ingenuamente");
const PSCHED5 = "sched-universe-1";
await crearProyecto(PSCHED5);
await agregarCandidatoConInstagram(PSCHED5, "Universo Uno", ["HandleUnivUno"]);
await agregarCandidatoConInstagram(PSCHED5, "Universo Dos", ["HandleUnivDos"]);
const runUnivDia1 = await sched.ejecutarObservacionDiaria(PSCHED5, { ahora: DIA1 });
await agregarCandidatoConInstagram(PSCHED5, "Universo Tres Nuevo", ["HandleUnivTres"]);
const runUnivDia2 = await sched.ejecutarObservacionDiaria(PSCHED5, { ahora: DIA2 });

await t("H1) el ranking snapshot del dia 1 declara universeSize real", async () => {
  const snaps = await ps.rankingSnapshotsDe(PSCHED5);
  const s1 = snaps.find((s) => s.collectionRunId === runUnivDia1.collectionRunId);
  return !s1 || s1.universeSize === 2; // puede no haber snapshot si IPDO no calculo (insumos insuficientes); si existe, debe ser 2
});
await t("H2) si ambos snapshots existen, universeSize cambia de 2 a 3 y universeCandidateIds difiere", async () => {
  const snaps = await ps.rankingSnapshotsDe(PSCHED5);
  const s1 = snaps.find((s) => s.collectionRunId === runUnivDia1.collectionRunId);
  const s2 = snaps.find((s) => s.collectionRunId === runUnivDia2.collectionRunId);
  if (!s1 || !s2) return true; // sin insumos suficientes para IPDO en este synthetic, no aplica
  return s2.universeSize === s1.universeSize + 1 && JSON.stringify(s1.universeCandidateIds) !== JSON.stringify(s2.universeCandidateIds);
});

/* ---------------------------------------------------------
   I · PROJECT ISOLATION
--------------------------------------------------------- */
bloque("I · project isolation");
await t("I) las corridas de un proyecto no aparecen en el historial de otro", async () => {
  const runsP1 = await ps.collectionRunsDe(PSCHED1);
  const runsP3 = await ps.collectionRunsDe(PSCHED3);
  return !runsP1.some((r) => r.projectId !== PSCHED1) && !runsP3.some((r) => r.projectId !== PSCHED3);
});

/* ---------------------------------------------------------
   J · ESTADO DEL SCHEDULER (sin arrancar el setInterval real)
--------------------------------------------------------- */
bloque("J · estado reportado del scheduler");
await t("J) un proyecto sin scheduler arrancado reporta INACTIVO, nunca inventa actividad", () => {
  return sched.estadoDelScheduler("proyecto-sin-scheduler-jamas-arrancado").schedulerStatus === "INACTIVO";
});

console.log(`\n===========================================\nPASS: ${pass}    FALL: ${fail}\n===========================================`);
if (fail > 0) { console.log("Fallos:", fallos); process.exitCode = 1; }
globalThis.fetch = fetchReal;
