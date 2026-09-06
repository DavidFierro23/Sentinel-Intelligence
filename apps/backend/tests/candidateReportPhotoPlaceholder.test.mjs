// apps/backend/tests/candidateReportPhotoPlaceholder.test.mjs

/*
===========================================================
PLACEHOLDER DE FOTO — CANDIDATE-LONGITUDINAL-FOUNDATION-01
===========================================================

Aparte de candidateReportQuality.test.mjs a proposito: el Lake es
un singleton por proceso (lakeQuery.js#abrirLake), y este test
necesita el adaptador de memoria fijado ANTES de cualquier import
para no escribir un proyecto sintetico en el Lake real de fichero.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const ps = await import("../services/projects/projectStore.js");
const { generateCandidateIntelligenceReport } = await import("../services/intelligence/candidateReportGenerator.js");

let pass = 0, fail = 0;
const fallos = [];
async function t(nombre, fn) {
  try {
    const v = await fn();
    if (v === true) { pass++; console.log(`  PASS  ${nombre}`); }
    else { fail++; fallos.push(nombre); console.log(`  FALL  ${nombre} (${JSON.stringify(v)})`); }
  } catch (e) { fail++; fallos.push(`${nombre} (${e.message})`); console.log(`  ERR   ${nombre} ${e.stack}`); }
}

const fetchOriginal = globalThis.fetch;
let fetchLlamado = false;
globalThis.fetch = () => { fetchLlamado = true; throw new Error("cero red en este gate"); };

const PID = "reporte-sin-foto-01";
await ps.crearProyecto({ id: PID, nombre: "Prueba Sin Foto", canton: "Cuenca", pais: "Ecuador", dignidad: "Alcaldia" });
const rSinFoto = await ps.agregarCandidato(PID, { nombre: "Candidato Sin Foto Alguna", cuentas: [] });
await ps.agregarCandidato(PID, { nombre: "Otro Candidato Tampoco Con Foto", cuentas: [] });

const modelo = await generateCandidateIntelligenceReport(PID);
const det = modelo.candidatosDetalle[rSinFoto.candidato.id];

await t("H1) un candidato sin foto persistida recibe el placeholder Sentinel (SVG local), no un hueco", () => {
  return det.foto?.esPlaceholder === true && typeof det.foto.url === "string" && det.foto.url.startsWith("data:image/svg+xml");
});
await t("H2) el placeholder trae las iniciales del nombre real del candidato (primera y ultima palabra)", () => {
  return decodeURIComponent(det.foto.url).includes("CA"); // "Candidato" ... "Alguna"
});
await t("H3) resolver la foto de un candidato sin cuentas no genero ninguna llamada de red", () => fetchLlamado === false);
await t("H4) el placeholder usa la paleta Sentinel (navy #0B1738), no un color generico", () => {
  return decodeURIComponent(det.foto.url).includes("#0B1738");
});

globalThis.fetch = fetchOriginal;

console.log(`\n===========================================\nPASS: ${pass}    FALL: ${fail}\n===========================================`);
if (fail > 0) { console.log("Fallos:", fallos); process.exitCode = 1; }
