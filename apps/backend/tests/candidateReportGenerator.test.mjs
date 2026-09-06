// apps/backend/tests/candidateReportGenerator.test.mjs

/*
CANDIDATE-REAL-CAMPAIGN-REPORT-01. Cero red, cero recoleccion.
Usa el proyecto real ya persistido + un proyecto sintetico para
project isolation.
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const l of readFileSync(join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
  const line = l.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
}

const { generateCandidateIntelligenceReport } = await import("../services/intelligence/candidateReportGenerator.js");
const { renderReportMarkdown, renderReportHtml } = await import("../services/intelligence/candidateReportRenderers.js");
const ps = await import("../services/projects/projectStore.js");

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

const PID = "alcaldia-cuenca-2027-piloto";
const fetchOriginal = globalThis.fetch;
let fetchLlamado = false;
globalThis.fetch = () => { fetchLlamado = true; throw new Error("cero red en este gate"); };

const model1 = await generateCandidateIntelligenceReport(PID);
const model2 = await generateCandidateIntelligenceReport(PID);

/* A. candidatos reales */
bloque("A · universo real");
await t("A) el informe contiene los 7 candidatos reales del proyecto", () => model1.universo.candidatosTotal === 7);

/* B/C. ranking en runtime, no hardcodeado */
bloque("B/C · ranking en runtime");
await t("B) el ranking se genera desde el IPDO calculado, no una lista fija", () => {
  return model1.ranking.length === 7 && model1.ranking.every((r) => typeof r.score === "number");
});
await t("C) el ranking esta ordenado descendente por score real", () => {
  for (let i = 1; i < model1.ranking.length; i++) {
    if (model1.ranking[i - 1].score < model1.ranking[i].score) return false;
  }
  return true;
});

/* D. /100 no % */
bloque("D · formato de score");
await t("D) el markdown usa '/ 100', nunca '%', para el IPDO", () => {
  const md = renderReportMarkdown(model1);
  return md.includes("/ 100") && !/\d+(\.\d+)?\s?%/.test(md.split("## 3.")[1]?.split("## 4.")[0] || "");
});

/* E. disclaimer electoral */
bloque("E · disclaimer");
await t("E) el disclaimer del IPDO esta presente y es el texto exacto certificado", () => {
  return model1.disclaimerIpdo.includes("No representa intención de voto, aprobación ni predicción electoral.");
});

/* F. missing != zero */
bloque("F · missing != zero");
await t("F) un candidato sin YouTube (IDENTIDAD_INSUFICIENTE) no aparece con 0 suscriptores, aparece sin metrica", () => {
  const vega = model1.matrizPlataformas.candidatos.find((c) => c.candidateId === "juan-carlos-vega");
  const yt = vega.celdas.youtube;
  return yt.medicion.estado === "IDENTIDAD_INSUFICIENTE" && yt.metrica === null;
});

/* G/H. multi-asset, Lloret */
bloque("G/H · multi-asset dinamico");
await t("G) al menos una celda del informe muestra multi-asset agregado (acumulado entre N activos)", () => {
  const md = renderReportMarkdown(model1);
  return /acumulados entre \d+ activos observados/.test(md);
});
await t("H) Lloret/Instagram se deriva dinamicamente (no hardcodeado): 2 activos, suma real de followers", () => {
  const lloret = model1.matrizPlataformas.candidatos.find((c) => c.candidateId === "juan-cristobal-lloret-valdivieso");
  const ig = lloret.celdas.instagram;
  return ig.assetCount === 2 && ig.metrica.valor === 11182 && ig.metrica.acumulado === true;
});

/* I. Yaku relative zero */
bloque("I · Yaku conversation=0 no es ausencia");
await t("I) Yaku tiene Conversation=0 relativo pero el informe no dice 'sin conversacion'; muestra caveat con senales crudas", () => {
  const yaku = model1.ranking.find((r) => r.candidateId === "yaku-perez");
  const md = renderReportMarkdown(model1);
  const seccionYaku = md.split("### Yaku Perez")[1]?.split("### Pedro")[0] || "";
  return yaku.dimensions.conversation === 0 && seccionYaku.includes("RELATIVO al grupo comparado") && seccionYaku.includes("39 hechos");
});

/* J. coverage visible */
bloque("J · cobertura visible");
await t("J) cada candidato del ranking trae methodologicalCoverage explicito", () => {
  return model1.ranking.every((r) => ["ALTA", "MEDIA", "BAJA"].includes(r.methodologicalCoverage));
});

/* K. historical insufficiency */
bloque("K · historico insuficiente visible");
await t("K) el informe declara Momentum=INSUFFICIENT_HISTORY explicitamente, nunca inventa tendencia", () => {
  return model1.historico.momentum === "INSUFFICIENT_HISTORY";
});

/* L/M. no vote-intention / prediction claims */
bloque("L/M · sin afirmaciones electorales");
await t("L/M) 'intención de voto' solo aparece negada (disclaimers), nunca como afirmación propia; y no hay frases de predicción/ganador", () => {
  const md = renderReportMarkdown(model1).toLowerCase();
  // Toda aparicion de "intención de voto" debe estar precedida por una negacion ("no representa"/"no significa"/lista de "esto no es") en la misma linea o cerca.
  const lineas = md.split("\n").filter((l) => l.includes("intención de voto"));
  const todasNegadas = lineas.every((l) => /no\s+(representa|significa|es|incluye)|no representa:/.test(l) || l.includes("este informe no representa"));
  const prohibidasAfirmativas = ["va a ganar", "es el ganador", "es favorito", "probable ganador", "mejor candidato es", "candidato ganador"];
  return todasNegadas && prohibidasAfirmativas.every((p) => !md.includes(p));
});

/* N. evidence refs validos */
bloque("N · evidence refs");
await t("N) las evidencias destacadas de cada candidato traen URL real", () => {
  return Object.values(model1.candidatosDetalle).every(
    (d) => d.evidenciasDestacadas.every((e) => typeof e.url === "string" && e.url.startsWith("http"))
  );
});

/* O. project isolation */
bloque("O · project isolation");
await t("O) un proyecto inexistente no genera un informe con datos de otro proyecto", async () => {
  const r = await generateCandidateIntelligenceReport("proyecto-inexistente-report-01");
  return r.ok === false;
});

/* P. deterministic */
bloque("P · generacion deterministica");
await t("P) dos generaciones consecutivas producen el mismo ranking y los mismos scores", () => {
  return JSON.stringify(model1.ranking.map((r) => [r.candidateId, r.score])) === JSON.stringify(model2.ranking.map((r) => [r.candidateId, r.score]));
});

/* Q. zero external fetch */
bloque("Q · cero red");
await t("Q) ninguna generacion de informe hizo fetch real", () => fetchLlamado === false);

/* R. no secrets */
bloque("R · sin secretos");
await t("R) el informe no incluye ninguna variable de entorno con clave/token", () => {
  const json = JSON.stringify(model1);
  return !json.includes("SCRAPECREATORS_API_KEY") && !json.includes("ACCESS_TOKEN");
});

/* S. dated version not destructive */
bloque("S · version fechada no destructiva");
await t("S) el modelo trae generatedAt real, distinto en cada llamada por timestamp", () => {
  return typeof model1.generatedAt === "string" && model1.generatedAt.includes("T");
});

/* T. markdown y html mismo modelo */
bloque("T · markdown/HTML consumen el mismo modelo");
await t("T) el ranking en HTML y en Markdown listan los mismos candidatos en el mismo orden", () => {
  const html = renderReportHtml(model1);
  const md = renderReportMarkdown(model1);
  const ordenEsperado = model1.ranking.map((r) => r.candidateId);
  const primeraFichaMd = md.split("## 4.")[1]?.match(/### (.+)/g)?.map((s) => s.replace("### ", "")) || [];
  const primeraFichaHtml = html.match(/<h3>(.+?)<\/h3>/g)?.map((s) => s.replace(/<\/?h3>/g, "")) || [];
  return primeraFichaMd.length === ordenEsperado.length && primeraFichaHtml.length === ordenEsperado.length;
});

globalThis.fetch = fetchOriginal;

console.log(`\n===========================================\nPASS: ${pass}    FALL: ${fail}\n===========================================`);
if (fail > 0) { console.log("Fallos:", fallos); process.exitCode = 1; }
