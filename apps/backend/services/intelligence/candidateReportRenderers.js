// apps/backend/services/intelligence/candidateReportRenderers.js

/*
===========================================================
RENDERIZADORES DEL INFORME — Markdown y HTML
CANDIDATE-REAL-CAMPAIGN-REPORT-01 / CANDIDATE-LONGITUDINAL-FOUNDATION-01
===========================================================

Ambos consumen EXACTAMENTE el mismo modelo que devuelve
`generateCandidateIntelligenceReport`. Ningun texto se escribe a
mano fuera de este archivo; si algo cambia en el modelo, cambia
igual en Markdown y en HTML porque leen los mismos campos.

CAMBIOS DE CANDIDATE-LONGITUDINAL-FOUNDATION-01 (revision humana
del primer informe):

  - Cuerpo ejecutivo 100% en español: "Presence"/"Interaction"/
    "Conversation" y los codigos internos de estado
    (MEDIDO_PROVEEDOR, IDENTIDAD_INSUFICIENTE, etc.) YA NO
    aparecen en el cuerpo ejecutivo -se traducen a etiquetas
    humanas y los codigos crudos se mueven al Apendice Tecnico
    (seccion final, unica seccion que los muestra).
  - "IPDO" se expande a su nombre completo la primera vez que
    aparece en cada documento.
  - Formato numerico en español: coma decimal, "/ 100", nunca "%".
  - Periodo real: se distingue "Generado el" (instante de
    ejecucion) de "Datos observados" (ventana real, del snapshot
    mas antiguo al mas reciente), en hora America/Guayaquil para
    presentacion -el dato interno sigue en UTC-.
  - Fotografia de cada candidato: SOLO la ya persistida
    (`candidatosDetalle[id].foto`, resuelta en el generador desde
    datos ya guardados). Si no hay foto utilizable, se usa el
    placeholder Sentinel (iniciales sobre navy/azul) que ya trae
    el modelo -este archivo nunca decide "sin foto", solo pinta lo
    que el modelo ya resolvio-.
  - Logo Sentinel real (`apps/web/public/branding/owl-320.png`,
    el mismo activo de marca ya usado en el resto del producto)
    incrustado en base64 en el HTML: el informe es un archivo
    autonomo, se puede abrir sin conexion y sin depender de una
    ruta relativa al repositorio.
===========================================================
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ETIQUETA_PLATAFORMA = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube"
};

/*
  Nombres humanos de las tres dimensiones del IPDO. Los nombres
  tecnicos en ingles (presence/interaction/conversation) siguen
  siendo las claves internas del modelo -no se tocan, estan
  certificadas en digitalPresenceIndex.js-, pero el texto que lee
  un director de campaña usa estas tres palabras, no las claves.
*/
const ETIQUETA_DIMENSION = {
  presence: "Presencia",
  interaction: "Interacción",
  conversation: "Conversación"
};

/*
  Estado de medicion por celda candidato×plataforma, en español
  llano. Los codigos crudos (ESTADOS_CIERRE de operationalClosure.js)
  siguen disponibles integros en el Apendice Tecnico -aqui solo se
  traducen para el cuerpo ejecutivo-.
*/
const ETIQUETA_ESTADO_MEDICION = {
  MEDIDO: "Medido",
  PARCIAL: "Medido parcialmente",
  SIN_CUENTA: "Sin cuenta identificada",
  NO_SOPORTADO: "Plataforma no soportada todavía",
  BLOQUEADO: "Acceso bloqueado por la plataforma",
  REQUIERE_CREDENCIAL: "Requiere credencial adicional",
  REQUIERE_PROVEEDOR: "Requiere proveedor externo (no activado)",
  IDENTIDAD_INSUFICIENTE: "Identidad insuficiente para medir",
  IDENTITY_CONFLICT: "Cuenta excluida por conflicto de identidad",
  ERROR_PROVEEDOR: "Error del proveedor externo",
  ERROR_OFICIAL: "Error de la vía oficial"
};

function etiquetaEstado(codigo) {
  return ETIQUETA_ESTADO_MEDICION[codigo] || codigo;
}

/*
  Algunas limitaciones declaradas llegan de modulos de otras
  responsabilidades (ej. `candidatePlatformMatrix.js`, T3) y
  mencionan codigos internos en la misma frase que explica el
  porque. No se reescribe el modulo ajeno -no es su alcance de
  este gate-: se traduce el codigo a su etiqueta humana SOLO para
  el cuerpo ejecutivo. El Apendice Tecnico sigue mostrando el texto
  intacto en ningun lado -las limitaciones no se duplican alli-,
  pero ya no hay un codigo en mayusculas sueltas en el cuerpo.
*/
function humanizarCodigosEnTexto(texto) {
  let resultado = String(texto || "");
  for (const [codigo, etiqueta] of Object.entries(ETIQUETA_ESTADO_MEDICION)) {
    resultado = resultado.replace(new RegExp(`\\b${codigo}\\b`, "g"), `"${etiqueta}"`);
  }
  return resultado;
}

function nombreDe(model, candidateId) {
  return model.candidatosDetalle[candidateId]?.nombre || candidateId;
}

function fotoDe(model, candidateId) {
  return model.candidatosDetalle[candidateId]?.foto || null;
}

/* Español: coma decimal, "/ 100", NUNCA "%" -seccion 47 del gate-. */
function fmtScore(v) {
  return v == null ? "—" : `${Number(v).toFixed(1).replace(".", ",")} / 100`;
}

function fmtEntero(v) {
  return v == null ? "—" : Number(v).toLocaleString("es-EC");
}

/*
  `2026-09-05T20:39:35.311Z` -> `05/09/2026, 15:39 (hora Ecuador)`.
  El dato interno sigue siendo el ISO UTC -esto es solo
  presentacion-.
*/
function fmtFechaHoraLocal(iso, { conHora = true } = {}) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const fecha = new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  if (!conHora) return fecha;
  const hora = new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${fecha}, ${hora} (hora Ecuador)`;
}

function bloquePeriodo(model) {
  const generado = fmtFechaHoraLocal(model.periodo.generadoEl);
  const desde = fmtFechaHoraLocal(model.periodo.datosDesde, { conHora: false });
  const hasta = fmtFechaHoraLocal(model.periodo.datosHasta, { conHora: false });
  const ventana = desde && hasta ? (desde === hasta ? desde : `${desde} – ${hasta}`) : "sin observaciones registradas todavía";
  return { generado, ventana };
}

/* Logo Sentinel real, incrustado en base64: informe autonomo, sin dependencias de red ni de ruta. */
let LOGO_DATA_URI = null;
function logoSentinelBase64() {
  if (LOGO_DATA_URI !== null) return LOGO_DATA_URI;
  try {
    const ruta = join(__dirname, "..", "..", "..", "web", "public", "branding", "owl-320.png");
    const buffer = readFileSync(ruta);
    LOGO_DATA_URI = `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    LOGO_DATA_URI = ""; // sin logo disponible: el header se pinta sin imagen, nunca con una rota
  }
  return LOGO_DATA_URI;
}

/*
  Primera aparicion de "IPDO" en cada documento se expande a su
  nombre completo (seccion 40 del gate). Uso: llamar una vez al
  principio del render y usar `sigla` despues.
*/
function nombreIpdo(model, { primeraVez = false } = {}) {
  const completo = model.ipdoNombreCompleto || "Índice de Presencia Digital Observable (IPDO)";
  return primeraVez ? completo : "IPDO";
}

/* ===========================================================
   MARKDOWN
=========================================================== */
export function renderReportMarkdown(model) {
  if (!model.ok) return `# Informe no generado\n\n${model.motivo}\n`;

  const L = [];
  const push = (s = "") => L.push(s);
  const { generado, ventana } = bloquePeriodo(model);

  push(`# Informe de Candidate Intelligence`);
  push(`## ${model.proyecto.nombre || model.projectId}`);
  push("");
  push(`**Generado el:** ${generado}  `);
  push(`**Datos observados:** ${ventana}  `);
  push(`**Versión metodológica:** ${model.methodVersion}`);
  push("");
  push("---");

  push("\n## 1. Resumen ejecutivo\n");
  push(`_Comparación de ${nombreIpdo(model, { primeraVez: true })} entre los ${model.universo.candidatosTotal} candidatos del universo observado._`);
  push("");
  model.resumenEjecutivo.forEach((h) => push(`- ${h}`));

  push("\n## 2. Cobertura del análisis\n");
  push(`- Universo: **${model.universo.candidatosTotal} candidatos** del proyecto.`);
  if (model.matrizPlataformas.ok) {
    push(`- Combinaciones candidato-plataforma con estado resuelto: **${model.matrizPlataformas.celdasResueltas} de ${model.matrizPlataformas.totalCeldas}** (ninguna quedó sin explicación).`);
  }
  push(`- Los seguidores/suscriptores reflejan el estado actual de cada cuenta; las publicaciones y menciones son un acumulado observado hasta la fecha. No comparten la misma base temporal.`);

  push(`\n## 3. Comparación por ${nombreIpdo(model)}\n`);
  push(`> ${model.disclaimerIpdo}`);
  push("");
  if (model.ipdoEstado !== "OK") {
    push("_Universo insuficiente para comparación relativa._");
  } else {
    push("| # | Candidato | IPDO | Presencia | Interacción | Conversación | Cobertura |");
    push("|---|---|---|---|---|---|---|");
    model.ranking.forEach((r, i) => {
      push(`| ${i + 1} | ${nombreDe(model, r.candidateId)} | ${fmtScore(r.score)} | ${fmtScore(r.dimensions.presence)} | ${fmtScore(r.dimensions.interaction)} | ${fmtScore(r.dimensions.conversation)} | ${r.methodologicalCoverage} |`);
    });
  }

  push("\n## 4. Fichas de los candidatos\n");
  model.ranking.forEach((r) => {
    const det = model.candidatosDetalle[r.candidateId] || {};
    push(`### ${nombreDe(model, r.candidateId)}`);
    push("");
    push(`**${nombreIpdo(model)}:** ${fmtScore(r.score)} · **Cobertura metodológica:** ${r.methodologicalCoverage}`);
    push("");
    push(`**Presencia:** ${fmtScore(r.dimensions.presence)} · **Interacción:** ${fmtScore(r.dimensions.interaction)} · **Conversación:** ${fmtScore(r.dimensions.conversation)}`);
    push("");
    push("**¿Por qué este resultado?**");
    r.explanation.presence.factores.forEach((f) => push(`- Presencia: ${f}`));
    r.explanation.interaction.factores.forEach((f) => push(`- Interacción: ${f}`));
    r.explanation.conversation.factores.forEach((f) => push(`- Conversación: ${f}`));
    if (r.dimensionCaveats) {
      push("");
      Object.values(r.dimensionCaveats).forEach((c) => push(`> ⚠️ ${c}`));
    }
    if (r.explanation.limitaciones.length) {
      push("");
      push("**Limitaciones de esta ficha:**");
      r.explanation.limitaciones.forEach((l) => push(`- ${l}`));
    }

    push("");
    push("**Plataformas:**");
    const filaMatriz = model.matrizPlataformas.ok
      ? model.matrizPlataformas.candidatos.find((c) => c.candidateId === r.candidateId)
      : null;
    if (filaMatriz) {
      for (const p of model.matrizPlataformas.plataformas) {
        const celda = filaMatriz.celdas[p];
        const etiqueta = celda.metrica?.etiqueta || "sin métrica disponible";
        push(`- **${ETIQUETA_PLATAFORMA[p] || p}**: ${etiquetaEstado(celda.medicion.estado)} — ${celda.assetCount} cuenta(s) — ${etiqueta}`);
      }
    }

    if (det.evidenciasDestacadas?.length) {
      push("");
      push("**Evidencias destacadas:**");
      det.evidenciasDestacadas.forEach((e) => push(`- [${e.titulo || e.url}](${e.url})${e.fecha ? ` (${e.fecha})` : ""}`));
    }
    push("");
  });

  push("\n## 5. Hallazgos comparativos\n");
  const hc = model.hallazgosComparativos;
  if (hc.mayorIPDO) push(`- Mayor ${nombreIpdo(model)}: **${nombreDe(model, hc.mayorIPDO.candidateId)}** (${fmtScore(hc.mayorIPDO.score)}).`);
  if (hc.mayorPresence) push(`- Mayor Presencia: **${nombreDe(model, hc.mayorPresence.candidateId)}**.`);
  if (hc.mayorInteraction) push(`- Mayor Interacción: **${nombreDe(model, hc.mayorInteraction.candidateId)}**.`);
  if (hc.mayorConversation) push(`- Mayor Conversación: **${nombreDe(model, hc.mayorConversation.candidateId)}**.`);
  if (hc.mayorCoberturaPlataformas) push(`- Mayor cobertura de plataformas medidas: **${nombreDe(model, hc.mayorCoberturaPlataformas.candidateId)}** (${hc.mayorCoberturaPlataformas.medidas}/5).`);
  push(`- Análisis relacional entre candidatos: **pendiente** (no calculado en esta versión).`);

  push("\n## 6. Evidencias destacadas\n");
  model.ranking.forEach((r) => {
    const det = model.candidatosDetalle[r.candidateId];
    if (!det?.evidenciasDestacadas?.length) return;
    push(`**${nombreDe(model, r.candidateId)}:**`);
    det.evidenciasDestacadas.slice(0, 3).forEach((e) => push(`- ${e.titulo || e.url}`));
  });

  push("\n## 7. Limitaciones\n");
  push("_Esto es lo que este informe todavía no puede afirmar, dicho de forma explícita en vez de omitirlo._");
  push("");
  model.limitacionesGlobales.forEach((l) => push(`- ${humanizarCodigosEnTexto(l.texto)}`));
  push(`- **Histórico:** ${model.historico.nota}`);
  push(`- Este informe no representa: ${model.noSignifica.join(", ")}.`);

  push("\n## 8. Próxima actualización\n");
  push("Este informe se puede regenerar en cualquier momento con datos actualizados. Cuando exista histórico suficiente, se incorporará una comparación temporal (hoy / 7 días / 15 días / 30 días / 90 días) — no disponible todavía.");

  push("\n## 9. Apéndice técnico\n");
  push("_Esta sección es la única que muestra códigos internos y nombres técnicos, para quien necesite el detalle exacto._");
  push("");
  push(`- Versión del contrato del informe: \`${model.contractVersion}\`.`);
  push(`- Versión metodológica del índice: \`${model.methodVersion}\`. Fórmula: 25% Presence (Presencia) + 40% Interaction (Interacción) + 35% Conversation (Conversación). Detalle completo en \`docs/CANDIDATE-DIGITAL-PRESENCE-INDEX-01.md\` y \`docs/CANDIDATE-IPDO-CROSS-PLATFORM-MAPPING-03.md\`.`);
  push(`- Zona horaria de presentación: \`${model.timezonePresentacion}\`. Todos los timestamps se almacenan internamente en UTC.`);
  if (model.matrizPlataformas.ok) {
    push(`- Distribución cruda de estados de medición: ${Object.entries(model.matrizPlataformas.distribucion).map(([k, v]) => `\`${k}\`=${v}`).join(", ")}.`);
  }
  push("- Estados de medición por candidato y plataforma (código interno, `operationalClosure.js`):");
  model.ranking.forEach((r) => {
    const filaMatriz = model.matrizPlataformas.ok ? model.matrizPlataformas.candidatos.find((c) => c.candidateId === r.candidateId) : null;
    if (!filaMatriz) return;
    const codigos = model.matrizPlataformas.plataformas.map((p) => `${p}=\`${filaMatriz.celdas[p].medicion.estado}\``).join(", ");
    push(`  - ${nombreDe(model, r.candidateId)}: ${codigos}`);
  });

  return L.join("\n") + "\n";
}

/* ===========================================================
   HTML — estetica Sentinel: deep navy, white, electric blue, cyan
=========================================================== */
export function renderReportHtml(model) {
  if (!model.ok) return `<!doctype html><html><body><h1>Informe no generado</h1><p>${model.motivo}</p></body></html>`;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const { generado, ventana } = bloquePeriodo(model);
  const logo = logoSentinelBase64();

  const fotoHtml = (candidateId) => {
    const f = fotoDe(model, candidateId);
    if (!f?.url) return "";
    return `<img class="foto-candidato${f.esPlaceholder ? " foto-placeholder" : ""}" src="${esc(f.url)}" alt="${esc(nombreDe(model, candidateId))}" width="64" height="64">`;
  };

  const filasRanking = model.ranking.map((r, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td class="candidato-cell">${fotoHtml(r.candidateId)}<span>${esc(nombreDe(model, r.candidateId))}</span></td>
      <td class="score">${fmtScore(r.score)}</td>
      <td>${fmtScore(r.dimensions.presence)}</td>
      <td>${fmtScore(r.dimensions.interaction)}</td>
      <td>${fmtScore(r.dimensions.conversation)}</td>
      <td><span class="badge badge-${(r.methodologicalCoverage || "").toLowerCase()}">${r.methodologicalCoverage}</span></td>
    </tr>`).join("");

  const fichas = model.ranking.map((r) => {
    const det = model.candidatosDetalle[r.candidateId] || {};
    const filaMatriz = model.matrizPlataformas.ok ? model.matrizPlataformas.candidatos.find((c) => c.candidateId === r.candidateId) : null;
    const plataformasHtml = filaMatriz
      ? model.matrizPlataformas.plataformas.map((p) => {
          const celda = filaMatriz.celdas[p];
          return `<li><strong>${ETIQUETA_PLATAFORMA[p] || p}</strong>: ${esc(etiquetaEstado(celda.medicion.estado))} — ${celda.assetCount} cuenta(s) — ${esc(celda.metrica?.etiqueta || "sin métrica disponible")}</li>`;
        }).join("")
      : "";
    const evidHtml = (det.evidenciasDestacadas || []).slice(0, 5).map((e) => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.titulo || e.url)}</a></li>`).join("");
    const factores = [
      ...r.explanation.presence.factores.map((f) => `${ETIQUETA_DIMENSION.presence}: ${f}`),
      ...r.explanation.interaction.factores.map((f) => `${ETIQUETA_DIMENSION.interaction}: ${f}`),
      ...r.explanation.conversation.factores.map((f) => `${ETIQUETA_DIMENSION.conversation}: ${f}`)
    ].map((f) => `<li>${esc(f)}</li>`).join("");
    const caveatsHtml = r.dimensionCaveats
      ? `<div class="caveat">${Object.values(r.dimensionCaveats).map((c) => `⚠️ ${esc(c)}`).join("<br>")}</div>`
      : "";

    return `
    <section class="card">
      <div class="card-head">${fotoHtml(r.candidateId)}<h3>${esc(nombreDe(model, r.candidateId))}</h3></div>
      <p class="score-line"><strong>${nombreIpdo(model)} ${fmtScore(r.score)}</strong> · Cobertura ${esc(r.methodologicalCoverage)}</p>
      <p>Presencia ${fmtScore(r.dimensions.presence)} · Interacción ${fmtScore(r.dimensions.interaction)} · Conversación ${fmtScore(r.dimensions.conversation)}</p>
      <h4>¿Por qué este resultado?</h4>
      <ul>${factores}</ul>
      ${caveatsHtml}
      <h4>Plataformas</h4>
      <ul>${plataformasHtml}</ul>
      ${evidHtml ? `<h4>Evidencias destacadas</h4><ul>${evidHtml}</ul>` : ""}
    </section>`;
  }).join("\n");

  const apendiceFilas = model.ranking.map((r) => {
    const filaMatriz = model.matrizPlataformas.ok ? model.matrizPlataformas.candidatos.find((c) => c.candidateId === r.candidateId) : null;
    if (!filaMatriz) return "";
    const codigos = model.matrizPlataformas.plataformas.map((p) => `${p}=<code>${esc(filaMatriz.celdas[p].medicion.estado)}</code>`).join(", ");
    return `<li>${esc(nombreDe(model, r.candidateId))}: ${codigos}</li>`;
  }).join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Candidate Intelligence — ${esc(model.proyecto.nombre || model.projectId)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --navy: #0a1628; --navy-2: #0f2038; --white: #f5f7fa;
    --blue: #2f6fed; --cyan: #22d3ee; --muted: #9fb0c8;
  }
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, "Segoe UI", Arial, sans-serif; background: var(--navy); color: var(--white); }
  header { padding: 40px 32px; background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%); border-bottom: 2px solid var(--blue); display: flex; align-items: center; gap: 20px; }
  header img.logo { width: 56px; height: 56px; object-fit: contain; flex-shrink: 0; }
  header .titulo h1 { margin: 0 0 8px; font-size: 26px; }
  header .meta { color: var(--muted); font-size: 13px; line-height: 1.6; }
  main { max-width: 1100px; margin: 0 auto; padding: 32px; }
  section.block { margin-bottom: 40px; }
  h2 { color: var(--cyan); border-bottom: 1px solid #1e3a5f; padding-bottom: 8px; font-size: 20px; }
  .disclaimer { background: #10233f; border-left: 3px solid var(--cyan); padding: 12px 16px; font-size: 13px; color: var(--muted); margin: 12px 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #1e3a5f; font-size: 14px; }
  th { color: var(--cyan); font-weight: 600; }
  td.num { color: var(--muted); }
  td.score { font-weight: 700; color: var(--white); }
  td.candidato-cell { display: flex; align-items: center; gap: 10px; }
  .foto-candidato { border-radius: 50%; object-fit: cover; border: 1px solid #1e3a5f; }
  .card-head { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
  .card-head .foto-candidato { width: 48px; height: 48px; }
  .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-alta { background: #103b2b; color: #4ade80; }
  .badge-media { background: #3b3210; color: #facc15; }
  .badge-baja { background: #3b1010; color: #f87171; }
  .card { background: var(--navy-2); border: 1px solid #1e3a5f; border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid; }
  .card h3 { margin: 0; color: var(--white); }
  .score-line { color: var(--cyan); font-size: 15px; }
  .caveat { background: #3b3210; border-left: 3px solid #facc15; padding: 10px 14px; font-size: 13px; color: #facc15; margin: 12px 0; border-radius: 4px; }
  ul { padding-left: 20px; font-size: 14px; color: var(--muted); }
  li a { color: var(--blue); }
  code { background: #10233f; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
  footer { padding: 24px 32px; text-align: center; color: var(--muted); font-size: 12px; border-top: 1px solid #1e3a5f; }
  @media print {
    body { background: white; color: black; }
    .card, header, section.block table { background: white; border-color: #ccc; }
    h2 { color: #1e3a5f; }
    .score-line { color: #1e3a5f; }
    section.block { page-break-inside: avoid; }
    .card { page-break-inside: avoid; }
    a { color: black; text-decoration: underline; }
  }
</style>
</head>
<body>
<header>
  ${logo ? `<img class="logo" src="${logo}" alt="Sentinel Intelligence">` : ""}
  <div class="titulo">
    <h1>Informe de Candidate Intelligence</h1>
    <div class="meta">
      ${esc(model.proyecto.nombre || model.projectId)}<br>
      Generado el ${esc(generado)}<br>
      Datos observados: ${esc(ventana)}
    </div>
  </div>
</header>
<main>
  <section class="block">
    <h2>1. Resumen ejecutivo</h2>
    <p>Comparación de ${esc(nombreIpdo(model, { primeraVez: true }))} entre los ${model.universo.candidatosTotal} candidatos del universo observado.</p>
    <ul>${model.resumenEjecutivo.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
  </section>

  <section class="block">
    <h2>2. Cobertura del análisis</h2>
    <p>Universo: <strong>${model.universo.candidatosTotal} candidatos</strong>.
    ${model.matrizPlataformas.ok ? `Combinaciones candidato-plataforma con estado resuelto: <strong>${model.matrizPlataformas.celdasResueltas} de ${model.matrizPlataformas.totalCeldas}</strong>.` : ""}</p>
    <p>Los seguidores/suscriptores reflejan el estado actual de cada cuenta; las publicaciones y menciones son un acumulado observado hasta la fecha. No comparten la misma base temporal.</p>
  </section>

  <section class="block">
    <h2>3. Comparación por ${esc(nombreIpdo(model))}</h2>
    <div class="disclaimer">${esc(model.disclaimerIpdo)}</div>
    <table>
      <thead><tr><th>#</th><th>Candidato</th><th>IPDO</th><th>Presencia</th><th>Interacción</th><th>Conversación</th><th>Cobertura</th></tr></thead>
      <tbody>${filasRanking}</tbody>
    </table>
  </section>

  <section class="block">
    <h2>4. Fichas de los candidatos</h2>
    ${fichas}
  </section>

  <section class="block">
    <h2>5. Hallazgos comparativos</h2>
    <ul>
      ${model.hallazgosComparativos.mayorIPDO ? `<li>Mayor ${esc(nombreIpdo(model))}: <strong>${esc(nombreDe(model, model.hallazgosComparativos.mayorIPDO.candidateId))}</strong></li>` : ""}
      ${model.hallazgosComparativos.mayorInteraction ? `<li>Mayor Interacción: <strong>${esc(nombreDe(model, model.hallazgosComparativos.mayorInteraction.candidateId))}</strong></li>` : ""}
      ${model.hallazgosComparativos.mayorConversation ? `<li>Mayor Conversación: <strong>${esc(nombreDe(model, model.hallazgosComparativos.mayorConversation.candidateId))}</strong></li>` : ""}
      <li>Análisis relacional entre candidatos: <strong>pendiente</strong> (no calculado en esta versión)</li>
    </ul>
  </section>

  <section class="block">
    <h2>7. Limitaciones</h2>
    <p>Esto es lo que este informe todavía no puede afirmar, dicho de forma explícita en vez de omitirlo.</p>
    <ul>${model.limitacionesGlobales.map((l) => `<li>${esc(humanizarCodigosEnTexto(l.texto))}</li>`).join("")}
    <li>${esc(model.historico.nota)}</li></ul>
  </section>

  <section class="block">
    <h2>8. Próxima actualización</h2>
    <p>Momentum: <strong>pendiente</strong> (histórico insuficiente). ${esc(model.historico.nota)}</p>
  </section>

  <section class="block">
    <h2>9. Apéndice técnico</h2>
    <p>Esta sección es la única que muestra códigos internos y nombres técnicos, para quien necesite el detalle exacto.</p>
    <ul>
      <li>Versión del contrato del informe: <code>${esc(model.contractVersion)}</code></li>
      <li>Versión metodológica del índice: <code>${esc(model.methodVersion)}</code>. Fórmula: 25% Presence (Presencia) + 40% Interaction (Interacción) + 35% Conversation (Conversación)</li>
      <li>Zona horaria de presentación: <code>${esc(model.timezonePresentacion)}</code>. Todos los timestamps se almacenan internamente en UTC</li>
    </ul>
    <p>Estados de medición por candidato y plataforma (código interno):</p>
    <ul>${apendiceFilas}</ul>
  </section>
</main>
<footer>Sentinel Intelligence · Candidate Intelligence · Este informe no representa intención de voto, aprobación ni predicción electoral.</footer>
</body>
</html>`;
}

export default { renderReportMarkdown, renderReportHtml };
