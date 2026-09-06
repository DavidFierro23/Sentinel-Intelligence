// apps/backend/scripts/generateCandidateReport.mjs

/*
===========================================================
SCRIPT: GENERAR EL INFORME REAL DE CANDIDATE INTELLIGENCE
CANDIDATE-REAL-CAMPAIGN-REPORT-01
===========================================================

Uso:

    node apps/backend/scripts/generateCandidateReport.mjs <projectId>

Escribe en <repo>/reports/candidate/:

    candidate-intelligence-<projectId>-latest.json
    candidate-intelligence-<projectId>-latest.md
    candidate-intelligence-<projectId>-latest.html
    candidate-intelligence-<projectId>-<YYYYMMDD-HHmm>.{json,md,html}

Nunca sobrescribe la version fechada de una corrida anterior; solo
"latest" se reemplaza, a proposito -es el snapshot vigente, no el
historico-.

Cero red: usa unicamente projectStore.js y los motores ya
certificados de Candidate Intelligence.
===========================================================
*/

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = join(__dirname, "..");
const REPO_ROOT = join(BACKEND_DIR, "..", "..");

process.chdir(BACKEND_DIR);
dotenv.config({ path: join(BACKEND_DIR, ".env") });

const toFileUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/")}`).href;

const { generateCandidateIntelligenceReport } = await import(
  toFileUrl(join(BACKEND_DIR, "services/intelligence/candidateReportGenerator.js"))
);
const { renderReportMarkdown, renderReportHtml } = await import(
  toFileUrl(join(BACKEND_DIR, "services/intelligence/candidateReportRenderers.js"))
);

const projectId = process.argv[2] || "alcaldia-cuenca-2027-piloto";

const model = await generateCandidateIntelligenceReport(projectId);

if (!model.ok) {
  console.error("No se pudo generar el informe:", model.motivo);
  process.exit(1);
}

const outDir = join(REPO_ROOT, "reports", "candidate");
mkdirSync(outDir, { recursive: true });

const now = new Date(model.generatedAt);
const pad = (n) => String(n).padStart(2, "0");
const sello = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;

const base = `candidate-intelligence-${projectId}`;
const json = JSON.stringify(model, null, 2);
const md = renderReportMarkdown(model);
const html = renderReportHtml(model);

for (const [suffix, contenido] of [["latest", null], [sello, null]]) {
  writeFileSync(join(outDir, `${base}-${suffix}.json`), json, "utf8");
  writeFileSync(join(outDir, `${base}-${suffix}.md`), md, "utf8");
  writeFileSync(join(outDir, `${base}-${suffix}.html`), html, "utf8");
}

console.log(`Informe generado en ${outDir}`);
console.log(`  ${base}-latest.{json,md,html}`);
console.log(`  ${base}-${sello}.{json,md,html}`);
