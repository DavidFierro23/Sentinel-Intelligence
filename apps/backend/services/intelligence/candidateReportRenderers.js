// apps/backend/services/intelligence/candidateReportRenderers.js

/*
===========================================================
RENDERIZADORES DEL INFORME — Markdown y HTML
CANDIDATE-REAL-CAMPAIGN-REPORT-01
===========================================================

Ambos consumen EXACTAMENTE el mismo modelo que devuelve
`generateCandidateIntelligenceReport`. Ningun texto se escribe a
mano fuera de este archivo; si algo cambia en el modelo, cambia
igual en Markdown y en HTML porque leen los mismos campos.
===========================================================
*/

const ETIQUETA_PLATAFORMA = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube"
};

function nombreDe(model, candidateId) {
  return model.candidatosDetalle[candidateId]?.nombre || candidateId;
}

function fmtScore(v) {
  return v == null ? "—" : `${Number(v).toFixed(1)} / 100`;
}

/* ===========================================================
   MARKDOWN
=========================================================== */
export function renderReportMarkdown(model) {
  if (!model.ok) return `# Informe no generado\n\n${model.motivo}\n`;

  const L = [];
  const push = (s = "") => L.push(s);

  push(`# Informe de Candidate Intelligence`);
  push(`## ${model.proyecto.nombre || model.projectId}`);
  push("");
  push(`**Generado:** ${model.generatedAt}  `);
  push(`**Corte de datos:** ${model.dataCutoff}  `);
  push(`**Proyecto:** \`${model.projectId}\`  `);
  push(`**Versión metodológica:** ${model.methodVersion}`);
  push("");
  push("---");

  push("\n## 1. Resumen ejecutivo\n");
  model.resumenEjecutivo.forEach((h) => push(`- ${h}`));

  push("\n## 2. Cobertura del análisis\n");
  push(`- Universo: **${model.universo.candidatosTotal} candidatos** del proyecto.`);
  if (model.matrizPlataformas.ok) {
    push(`- Celdas candidato×plataforma resueltas: **${model.matrizPlataformas.celdasResueltas} de ${model.matrizPlataformas.totalCeldas}** (ninguna quedó sin estado explícito).`);
    push(`- Distribución: ${Object.entries(model.matrizPlataformas.distribucion).map(([k, v]) => `${k}=${v}`).join(", ")}.`);
  }
  push(`- Período: seguidores/suscriptores = ${model.periodo.presence}; publicaciones/menciones = ${model.periodo.interaction}.`);
  push(`- ${model.periodo.nota}`);

  push("\n## 3. Comparación por Presencia Digital Observable (IPDO)\n");
  push(`> ${model.disclaimerIpdo}`);
  push("");
  if (model.ipdoEstado !== "OK") {
    push("_Universo insuficiente para comparación relativa._");
  } else {
    push("| # | Candidato | IPDO | Presence | Interaction | Conversation | Cobertura |");
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
    push(`**IPDO:** ${fmtScore(r.score)} · **Cobertura metodológica:** ${r.methodologicalCoverage}`);
    push("");
    push(`**Presence:** ${fmtScore(r.dimensions.presence)} · **Interaction:** ${fmtScore(r.dimensions.interaction)} · **Conversation:** ${fmtScore(r.dimensions.conversation)}`);
    push("");
    push("**¿Por qué este resultado?**");
    r.explanation.presence.factores.forEach((f) => push(`- Presence: ${f}`));
    r.explanation.interaction.factores.forEach((f) => push(`- Interaction: ${f}`));
    r.explanation.conversation.factores.forEach((f) => push(`- Conversation: ${f}`));
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
        const etiqueta = celda.metrica?.etiqueta || "sin métrica";
        push(`- **${ETIQUETA_PLATAFORMA[p] || p}**: ${celda.medicion.estado} — ${celda.assetCount} activo(s) — ${etiqueta}`);
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
  if (hc.mayorIPDO) push(`- Mayor IPDO: **${nombreDe(model, hc.mayorIPDO.candidateId)}** (${fmtScore(hc.mayorIPDO.score)}).`);
  if (hc.mayorPresence) push(`- Mayor Presence: **${nombreDe(model, hc.mayorPresence.candidateId)}**.`);
  if (hc.mayorInteraction) push(`- Mayor Interaction: **${nombreDe(model, hc.mayorInteraction.candidateId)}**.`);
  if (hc.mayorConversation) push(`- Mayor Conversation/Amplification: **${nombreDe(model, hc.mayorConversation.candidateId)}**.`);
  if (hc.mayorCoberturaPlataformas) push(`- Mayor cobertura de plataformas medidas: **${nombreDe(model, hc.mayorCoberturaPlataformas.candidateId)}** (${hc.mayorCoberturaPlataformas.medidas}/5).`);
  push(`- Análisis relacional entre candidatos: **${hc.relacionesEntreCandidatos}**.`);

  push("\n## 6. Evidencias destacadas\n");
  model.ranking.forEach((r) => {
    const det = model.candidatosDetalle[r.candidateId];
    if (!det?.evidenciasDestacadas?.length) return;
    push(`**${nombreDe(model, r.candidateId)}:**`);
    det.evidenciasDestacadas.slice(0, 3).forEach((e) => push(`- ${e.titulo || e.url}`));
  });

  push("\n## 7. Limitaciones\n");
  model.limitacionesGlobales.forEach((l) => push(`- **${l.id}**: ${l.texto}`));
  push(`- **Histórico**: ${model.historico.nota}`);
  push(`- Este informe no representa: ${model.noSignifica.join(", ")}.`);

  push("\n## 8. Metodología IPDO\n");
  push(`Versión: \`${model.methodVersion}\`. Fórmula: 25% Presence + 40% Interaction + 35% Conversation. Ver \`docs/CANDIDATE-DIGITAL-PRESENCE-INDEX-01.md\` y \`docs/CANDIDATE-IPDO-CROSS-PLATFORM-MAPPING-03.md\` para el detalle completo de normalización, missing-data y anti-double-counting.`);

  push("\n## 9. Próxima actualización\n");
  push("Este informe se puede regenerar en cualquier momento con datos actualizados usando `generateCandidateIntelligenceReport(projectId)`. Cuando exista histórico suficiente, se incorporará una comparación temporal (HOY/7D/15D/30D/90D) — no disponible todavía (`INSUFFICIENT_HISTORY`).");

  return L.join("\n") + "\n";
}

/* ===========================================================
   HTML — estetica Sentinel: deep navy, white, electric blue, cyan
=========================================================== */
export function renderReportHtml(model) {
  if (!model.ok) return `<!doctype html><html><body><h1>Informe no generado</h1><p>${model.motivo}</p></body></html>`;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const filasRanking = model.ranking.map((r, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${esc(nombreDe(model, r.candidateId))}</td>
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
          return `<li><strong>${ETIQUETA_PLATAFORMA[p] || p}</strong>: ${esc(celda.medicion.estado)} — ${celda.assetCount} activo(s) — ${esc(celda.metrica?.etiqueta || "sin métrica")}</li>`;
        }).join("")
      : "";
    const evidHtml = (det.evidenciasDestacadas || []).slice(0, 5).map((e) => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.titulo || e.url)}</a></li>`).join("");
    const factores = [
      ...r.explanation.presence.factores.map((f) => `Presence: ${f}`),
      ...r.explanation.interaction.factores.map((f) => `Interaction: ${f}`),
      ...r.explanation.conversation.factores.map((f) => `Conversation: ${f}`)
    ].map((f) => `<li>${esc(f)}</li>`).join("");
    const caveatsHtml = r.dimensionCaveats
      ? `<div class="caveat">${Object.values(r.dimensionCaveats).map((c) => `⚠️ ${esc(c)}`).join("<br>")}</div>`
      : "";

    return `
    <section class="card">
      <h3>${esc(nombreDe(model, r.candidateId))}</h3>
      <p class="score-line"><strong>IPDO ${fmtScore(r.score)}</strong> · Cobertura ${esc(r.methodologicalCoverage)}</p>
      <p>Presence ${fmtScore(r.dimensions.presence)} · Interaction ${fmtScore(r.dimensions.interaction)} · Conversation ${fmtScore(r.dimensions.conversation)}</p>
      <h4>¿Por qué este resultado?</h4>
      <ul>${factores}</ul>
      ${caveatsHtml}
      <h4>Plataformas</h4>
      <ul>${plataformasHtml}</ul>
      ${evidHtml ? `<h4>Evidencias destacadas</h4><ul>${evidHtml}</ul>` : ""}
    </section>`;
  }).join("\n");

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
  header { padding: 48px 32px; background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%); border-bottom: 2px solid var(--blue); }
  header h1 { margin: 0 0 8px; font-size: 28px; }
  header .meta { color: var(--muted); font-size: 13px; }
  main { max-width: 1100px; margin: 0 auto; padding: 32px; }
  section.block { margin-bottom: 40px; }
  h2 { color: var(--cyan); border-bottom: 1px solid #1e3a5f; padding-bottom: 8px; font-size: 20px; }
  .disclaimer { background: #10233f; border-left: 3px solid var(--cyan); padding: 12px 16px; font-size: 13px; color: var(--muted); margin: 12px 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #1e3a5f; font-size: 14px; }
  th { color: var(--cyan); font-weight: 600; }
  td.num { color: var(--muted); }
  td.score { font-weight: 700; color: var(--white); }
  .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-alta { background: #103b2b; color: #4ade80; }
  .badge-media { background: #3b3210; color: #facc15; }
  .badge-baja { background: #3b1010; color: #f87171; }
  .card { background: var(--navy-2); border: 1px solid #1e3a5f; border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; }
  .card h3 { margin-top: 0; color: var(--white); }
  .score-line { color: var(--cyan); font-size: 15px; }
  .caveat { background: #3b3210; border-left: 3px solid #facc15; padding: 10px 14px; font-size: 13px; color: #facc15; margin: 12px 0; border-radius: 4px; }
  ul { padding-left: 20px; font-size: 14px; color: var(--muted); }
  li a { color: var(--blue); }
  footer { padding: 24px 32px; text-align: center; color: var(--muted); font-size: 12px; border-top: 1px solid #1e3a5f; }
  @media print { body { background: white; color: black; } .card, header { background: white; border-color: #ccc; } }
</style>
</head>
<body>
<header>
  <h1>Informe de Candidate Intelligence</h1>
  <div class="meta">
    ${esc(model.proyecto.nombre || model.projectId)} · Generado ${esc(model.generatedAt)} · Corte de datos ${esc(model.dataCutoff)} · Versión ${esc(model.methodVersion)}
  </div>
</header>
<main>
  <section class="block">
    <h2>1. Resumen ejecutivo</h2>
    <ul>${model.resumenEjecutivo.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
  </section>

  <section class="block">
    <h2>2. Cobertura del análisis</h2>
    <p>Universo: <strong>${model.universo.candidatosTotal} candidatos</strong>.
    ${model.matrizPlataformas.ok ? `Celdas resueltas: <strong>${model.matrizPlataformas.celdasResueltas} de ${model.matrizPlataformas.totalCeldas}</strong>.` : ""}</p>
    <p>${esc(model.periodo.nota)}</p>
  </section>

  <section class="block">
    <h2>3. Comparación por Presencia Digital Observable</h2>
    <div class="disclaimer">${esc(model.disclaimerIpdo)}</div>
    <table>
      <thead><tr><th>#</th><th>Candidato</th><th>IPDO</th><th>Presence</th><th>Interaction</th><th>Conversation</th><th>Cobertura</th></tr></thead>
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
      ${model.hallazgosComparativos.mayorIPDO ? `<li>Mayor IPDO: <strong>${esc(nombreDe(model, model.hallazgosComparativos.mayorIPDO.candidateId))}</strong></li>` : ""}
      ${model.hallazgosComparativos.mayorInteraction ? `<li>Mayor Interaction: <strong>${esc(nombreDe(model, model.hallazgosComparativos.mayorInteraction.candidateId))}</strong></li>` : ""}
      ${model.hallazgosComparativos.mayorConversation ? `<li>Mayor Conversation: <strong>${esc(nombreDe(model, model.hallazgosComparativos.mayorConversation.candidateId))}</strong></li>` : ""}
      <li>Análisis relacional entre candidatos: <strong>${esc(model.hallazgosComparativos.relacionesEntreCandidatos)}</strong></li>
    </ul>
  </section>

  <section class="block">
    <h2>7. Limitaciones</h2>
    <ul>${model.limitacionesGlobales.map((l) => `<li><strong>${esc(l.id)}</strong>: ${esc(l.texto)}</li>`).join("")}
    <li>${esc(model.historico.nota)}</li></ul>
  </section>

  <section class="block">
    <h2>8. Metodología IPDO</h2>
    <p>Versión <code>${esc(model.methodVersion)}</code>. Fórmula: 25% Presence + 40% Interaction + 35% Conversation.</p>
  </section>

  <section class="block">
    <h2>9. Próxima actualización</h2>
    <p>Momentum: <strong>${esc(model.historico.momentum)}</strong>. ${esc(model.historico.nota)}</p>
  </section>
</main>
<footer>Sentinel Intelligence · Candidate Intelligence · Este informe no representa intención de voto, aprobación ni predicción electoral.</footer>
</body>
</html>`;
}

export default { renderReportMarkdown, renderReportHtml };
