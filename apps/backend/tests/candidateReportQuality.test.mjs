// apps/backend/tests/candidateReportQuality.test.mjs

/*
===========================================================
CALIDAD DE INFORME — CANDIDATE-LONGITUDINAL-FOUNDATION-01
===========================================================

Verifica los defectos que la revision humana del primer informe
(CANDIDATE-REAL-CAMPAIGN-REPORT-01) encontro y que este gate debia
corregir: idioma ejecutivo 100% español, nombre completo del IPDO,
coma decimal, periodo real (generado vs datos observados), zona
horaria de presentacion, fotos (persistidas + placeholder), logo
Sentinel, apendice tecnico separado del cuerpo, disclaimers.

Usa el proyecto real ya persistido (cero red, cero recoleccion,
mismo patron que candidateReportGenerator.test.mjs) MAS un
proyecto sintetico en memoria para forzar el caso "candidato sin
foto -> placeholder".
===========================================================
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

const { generateCandidateIntelligenceReport, IPDO_NOMBRE_COMPLETO } = await import("../services/intelligence/candidateReportGenerator.js");
const { renderReportMarkdown, renderReportHtml } = await import("../services/intelligence/candidateReportRenderers.js");

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

const model = await generateCandidateIntelligenceReport(PID);
const md = renderReportMarkdown(model);
const html = renderReportHtml(model);

/* A. periodo real: generado != datos observados */
bloque("A · periodo real");
await t("A1) el modelo distingue generadoEl de datosDesde/datosHasta", () => {
  return typeof model.periodo.generadoEl === "string" && typeof model.periodo.datosDesde === "string" && typeof model.periodo.datosHasta === "string";
});
await t("A2) datosDesde no es igual a generadoEl (son conceptos distintos, con datos reales)", () => model.periodo.datosDesde !== model.periodo.generadoEl);
await t("A3) el markdown muestra 'Generado el' y 'Datos observados' como etiquetas separadas", () => {
  return md.includes("**Generado el:**") && md.includes("**Datos observados:**");
});
await t("A4) el header del markdown NO expone el ISO crudo (con 'T' y 'Z') en la primera pantalla", () => {
  const cabecera = md.split("---")[0];
  return !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(cabecera);
});

/* B. zona horaria de presentacion */
bloque("B · zona horaria");
await t("B1) el modelo declara America/Guayaquil como zona de presentacion", () => model.timezonePresentacion === "America/Guayaquil");
await t("B2) las fechas mostradas en el markdown incluyen la anotacion 'hora Ecuador'", () => md.includes("hora Ecuador"));
await t("B3) el apendice tecnico declara que el almacenamiento interno es UTC", () => md.includes("almacenan internamente en UTC"));

/* C. nombre completo del IPDO la primera vez */
bloque("C · nombre completo del IPDO");
await t("C1) el modelo expone el nombre completo del indice", () => IPDO_NOMBRE_COMPLETO.includes("Índice de Presencia Digital Observable"));
await t("C2) el markdown expande el nombre completo antes de usar solo 'IPDO'", () => {
  const idxCompleto = md.indexOf("Índice de Presencia Digital Observable (IPDO)");
  const primerIpdoSolo = md.indexOf("## 3. Comparación por IPDO");
  return idxCompleto !== -1 && idxCompleto < primerIpdoSolo;
});

/* D. español 100% en el cuerpo ejecutivo: sin Presence/Interaction/Conversation en ingles */
bloque("D · idioma ejecutivo 100% español");
await t("D1) el cuerpo ejecutivo (secciones 1-8) no usa las palabras en inglés Presence/Interaction/Conversation", () => {
  const cuerpoEjecutivo = md.split("## 9. Apéndice técnico")[0];
  return !/\bPresence\b|\bInteraction\b|\bConversation\b/.test(cuerpoEjecutivo);
});
await t("D2) el cuerpo ejecutivo usa las etiquetas en español: Presencia/Interacción/Conversación", () => {
  const cuerpoEjecutivo = md.split("## 9. Apéndice técnico")[0];
  return cuerpoEjecutivo.includes("Presencia") && cuerpoEjecutivo.includes("Interacción") && cuerpoEjecutivo.includes("Conversación");
});
await t("D3) el resumen ejecutivo usa nombres reales de candidato, nunca el candidateId en kebab-case", () => {
  return !model.resumenEjecutivo.some((h) => /[a-z]+-[a-z]+-[a-z]+/.test(h));
});

/* E. sin codigos tecnicos internos en el cuerpo ejecutivo */
bloque("E · sin codigos tecnicos en el cuerpo ejecutivo");
await t("E1) el cuerpo ejecutivo no muestra codigos crudos de estado (MEDIDO_PROVEEDOR, IDENTIDAD_INSUFICIENTE, etc.)", () => {
  const cuerpoEjecutivo = md.split("## 9. Apéndice técnico")[0];
  return !/IDENTIDAD_INSUFICIENTE|MEDIDO_PROVEEDOR|REQUIERE_PROVEEDOR|IDENTITY_CONFLICT|ERROR_PROVEEDOR|ERROR_OFICIAL/.test(cuerpoEjecutivo);
});
await t("E2) el cuerpo ejecutivo usa las etiquetas humanas equivalentes (ej. 'Identidad insuficiente para medir')", () => {
  const cuerpoEjecutivo = md.split("## 9. Apéndice técnico")[0];
  return cuerpoEjecutivo.includes("Identidad insuficiente para medir") || cuerpoEjecutivo.includes("Medido");
});
await t("E3) el apendice tecnico SI trae los codigos crudos completos", () => {
  const apendice = md.split("## 9. Apéndice técnico")[1] || "";
  return /`MEDIDO`|`PARCIAL`|`IDENTIDAD_INSUFICIENTE`/.test(apendice);
});

/* F. coma decimal, nunca porcentaje */
bloque("F · formato numerico español");
await t("F1) los scores IPDO usan coma decimal ('80,2 / 100'), nunca punto", () => {
  const tabla = md.split("| # | Candidato |")[1]?.split("\n\n")[0] || "";
  return /\d+,\d \/ 100/.test(tabla) && !/\d+\.\d \/ 100/.test(tabla);
});
await t("F2) el informe nunca usa '%' para el IPDO", () => {
  const seccionIpdo = md.split("## 3.")[1]?.split("## 4.")[0] || "";
  return !/\d+(,\d+)?\s?%/.test(seccionIpdo);
});

/* G. fotos: persistidas o placeholder, nunca red nueva */
bloque("G · fotos persistidas / placeholder, cero red");
await t("G1) cada candidato del ranking trae un objeto foto en candidatosDetalle", () => {
  return model.ranking.every((r) => model.candidatosDetalle[r.candidateId]?.foto?.url);
});
await t("G2) generar el informe no genero ninguna llamada de red (ni siquiera para resolver fotos)", () => fetchLlamado === false);
await t("G3) el HTML pinta una imagen de candidato en el ranking (tabla) y en cada ficha", () => {
  return /class="foto-candidato/.test(html) && html.split('class="foto-candidato').length > 2;
});

/*
  H. placeholder con iniciales cuando no hay foto persistida.
  Se prueba en `candidateReportPhotoPlaceholder.test.mjs`, en
  proceso aparte con SENTINEL_LAKE_ADAPTER=memoria fijado ANTES de
  cualquier import -el Lake es un singleton por proceso
  (`lakeQuery.js#abrirLake`), y este archivo ya abrio el Lake real
  de fichero al generar el informe de arriba: escribir aqui un
  proyecto sintetico terminaria persistiendolo en el Lake real.
*/

/* I. Yaku: auditoria de conversacion=0 con relative-zero, y chequeo del resto del grupo */
bloque("I · Yaku conversation=0 y chequeo grupal de relative-zero");
await t("I1) Yaku tiene conversation=0 normalizado con señales crudas reales != 0", () => {
  const yaku = model.ranking.find((r) => r.candidateId === "yaku-perez");
  const f = yaku.rawInputs || {};
  return yaku.dimensions.conversation === 0 && (f.thirdPartyVolume > 0 || f.mediaDiversity > 0 || f.publicConversation > 0);
});
await t("I2) el caveat de Yaku esta en el markdown con las 3 cifras crudas reales", () => {
  const seccionYaku = md.split("### Yaku Perez")[1]?.split("### Pedro")[0] || "";
  return seccionYaku.includes("RELATIVO al grupo comparado") && /\d+ hechos de terceros/.test(seccionYaku);
});
await t("I3) ningun otro candidato del grupo tiene una dimension en 0 sin su caveat correspondiente", () => {
  return model.ranking.every((r) => {
    const dims = ["presence", "interaction", "conversation"];
    return dims.every((d) => {
      if (r.dimensions[d] !== 0) return true;
      return r.dimensionCaveats && r.dimensionCaveats[d];
    });
  });
});

/* J. logo Sentinel */
bloque("J · logo Sentinel real, incrustado");
await t("J1) el HTML incrusta el logo Sentinel en base64 (no una ruta rota, no un logo generado)", () => {
  return /<img class="logo" src="data:image\/png;base64,[A-Za-z0-9+/=]{100,}"/.test(html);
});
await t("J2) el logo aparece en el header, junto al titulo del informe", () => {
  const header = html.split("<main>")[0];
  return header.includes('class="logo"') && header.includes("Informe de Candidate Intelligence");
});

/* K. print CSS / page-break para impresion */
bloque("K · CSS de impresion");
await t("K1) el HTML declara reglas @media print", () => html.includes("@media print"));
await t("K2) las fichas de candidato evitan cortarse a la mitad al imprimir (page-break-inside/break-inside)", () => {
  return html.includes("page-break-inside: avoid") || html.includes("break-inside: avoid");
});

/* L. disclaimers: multi-asset y electoral */
bloque("L · disclaimers");
await t("L1) el disclaimer electoral del IPDO esta presente en el cuerpo ejecutivo", () => {
  return md.includes("No representa intención de voto, aprobación ni predicción electoral.");
});
await t("L2) al menos una ficha declara la etiqueta de multi-activo ('acumulados entre N activos observados')", () => {
  return /acumulados entre \d+ activos observados/.test(md);
});
await t("L3) la seccion de 'no significa' lista intención de voto entre lo que el informe no representa", () => {
  return model.noSignifica.includes("intención de voto");
});

/* M. project isolation */
bloque("M · project isolation");
await t("M) un proyecto inexistente no genera un informe con datos de otro proyecto", async () => {
  const r = await generateCandidateIntelligenceReport("proyecto-inexistente-calidad-01");
  return r.ok === false;
});

/* N. sin secretos */
bloque("N · sin secretos");
await t("N) ni el markdown ni el HTML incluyen variables de entorno con clave/token", () => {
  return !md.includes("SCRAPECREATORS_API_KEY") && !html.includes("SCRAPECREATORS_API_KEY") && !md.includes("ACCESS_TOKEN") && !html.includes("ACCESS_TOKEN");
});

globalThis.fetch = fetchOriginal;

console.log(`\n===========================================\nPASS: ${pass}    FALL: ${fail}\n===========================================`);
if (fail > 0) { console.log("Fallos:", fallos); process.exitCode = 1; }
