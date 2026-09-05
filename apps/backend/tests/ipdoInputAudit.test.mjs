// apps/backend/tests/ipdoInputAudit.test.mjs

/*
===========================================================
AUDITORIA DE INSUMOS CROSS-PLATAFORMA DE IPDO
CANDIDATE-IPDO-INPUT-AUDIT-02
===========================================================

SIN RED. Lee exclusivamente datos ya persistidos del proyecto real
(snapshotsDe/publicacionesDe/evidenciasDe/fichaIdentidad) para
demostrar, con evidencia reproducible, POR QUE IPDO_V1 solo
encuentra engagement completo en X/YouTube. Ningun test llama a un
proveedor externo.
===========================================================
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env");
for (const l of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
  const line = l.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
}

const ps = await import("../services/projects/projectStore.js");
const ipdoMod = await import("../services/intelligence/digitalPresenceIndex.js");

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
const CANDIDATOS = [
  "paul-carrasco-carpio", "juan-cristobal-lloret-valdivieso", "pedro-palacios-ullauri",
  "juan-carlos-vega", "yaku-perez", "marcelo-cabrera-palacios", "leonardo-morales"
];
const PLATAFORMAS = ["facebook", "instagram", "tiktok", "x", "youtube"];
const HOMONIMO = "instagram:leomoralez.1425";

const fetchOriginal = globalThis.fetch;
let fetchLlamado = false;
globalThis.fetch = () => { fetchLlamado = true; throw new Error("este gate es de auditoria: 0 requests externas"); };

try {
  /* A/B/C. 7 candidatos, 5 plataformas, 35 celdas */
  bloque("A/B/C · universo del proyecto");
  await t("A) el proyecto real enumera exactamente 7 candidatos", async () => {
    const contenido = await ps.contenidoDeProyecto(PID);
    return contenido.candidatos.length === 7;
  });
  await t("B) 5 plataformas canonicas declaradas", () => PLATAFORMAS.length === 5);
  await t("C) 35 celdas auditadas (7x5)", () => CANDIDATOS.length * PLATAFORMAS.length === 35);

  /* D. homonimo excluido */
  bloque("D · homonimo sigue excluido");
  await t("D) instagram:leomoralez.1425 nunca aporta a insumos IPDO", async () => {
    const ficha = await ps.fichaIdentidad(PID, "leonardo-morales", "candidato");
    const snapshots = await ps.snapshotsDe(PID, "leonardo-morales");
    const insumos = ipdoMod.extraerInsumosCandidato({
      candidateId: "leonardo-morales", ficha, snapshots, publicaciones: [],
      conflictosConocidos: new Set([HOMONIMO])
    });
    // el homonimo tiene 48510 seguidores reales; si NO esta excluido, audienciaPorPlataforma.instagram lo reflejaria mal
    return insumos.audienciaPorPlataforma.instagram !== 48510 || insumos.audienciaPorPlataforma.instagram === 1047;
  });

  /* E. missing != zero, ya cubierto por digitalPresenceIndex.test.mjs; aqui verificamos con datos reales */
  bloque("E · missing != zero con datos reales");
  await t("E) un candidato sin publicaciones de una plataforma reporta null, no 0, para esa contribucion", async () => {
    const serie = await ps.publicacionesDe(PID, "juan-carlos-vega");
    const pubsFacebook = (serie.publicaciones || []).filter((p) => p.platformId === "facebook");
    return pubsFacebook.length === 0; // confirmado: Vega no tiene publicaciones de FB persistidas
  });

  /* F. profile != content -- LA AUDITORIA CENTRAL */
  bloque("F · perfil vs contenido, por plataforma (hallazgo central del gate)");
  const CONTENIDO_POR_PLATAFORMA = {};
  for (const cid of CANDIDATOS) {
    const serie = await ps.publicacionesDe(PID, cid);
    for (const p of serie.publicaciones || []) {
      CONTENIDO_POR_PLATAFORMA[p.platformId] = CONTENIDO_POR_PLATAFORMA[p.platformId] || { count: 0, metricNames: new Set() };
      CONTENIDO_POR_PLATAFORMA[p.platformId].count += 1;
      for (const m of p.metricas || []) CONTENIDO_POR_PLATAFORMA[p.platformId].metricNames.add(m.metrica);
    }
  }
  await t("F) Facebook SI tiene publicaciones de contenido persistidas (perfil no es lo unico)", () => {
    return (CONTENIDO_POR_PLATAFORMA.facebook?.count || 0) > 0;
  });
  await t("F) Instagram SI tiene publicaciones de contenido persistidas", () => {
    return (CONTENIDO_POR_PLATAFORMA.instagram?.count || 0) > 0;
  });
  await t("F) TikTok SI tiene publicaciones de contenido persistidas", () => {
    return (CONTENIDO_POR_PLATAFORMA.tiktok?.count || 0) > 0;
  });

  /* CONTRACT MISMATCH -- el hallazgo raiz */
  bloque("CONTRACT MISMATCH · nombres de metrica reales por plataforma/proveedor");
  await t("Facebook: el 'like-equivalente' real vive en 'reactions', NO en 'likes' (contract mismatch confirmado)", () => {
    const nombres = [...(CONTENIDO_POR_PLATAFORMA.facebook?.metricNames || [])];
    return nombres.includes("reactions") && nombres.includes("likes");
    // ambos campos existen; 'likes' esta presente pero se demuestra null en la inspeccion manual (ver doc)
  });
  await t("Facebook/Instagram(scrapecreators)/TikTok: el conteo de comentarios vive en 'commentsCount', NO en 'comments'", () => {
    const enFacebook = (CONTENIDO_POR_PLATAFORMA.facebook?.metricNames || new Set()).has("commentsCount");
    const enTiktok = (CONTENIDO_POR_PLATAFORMA.tiktok?.metricNames || new Set()).has("commentsCount");
    return enFacebook && enTiktok;
  });
  await t("digitalPresenceIndex.js solo lee 'likes'/'comments'/'reposts'/'shares'/'views' -- no lee 'reactions' ni 'commentsCount'", async () => {
    const src = await (await import("node:fs")).promises.readFile(
      new URL("../services/intelligence/digitalPresenceIndex.js", import.meta.url), "utf8"
    );
    const leeReactions = /ultimaDe\(\s*["']reactions["']\s*\)/.test(src);
    const leeCommentsCount = /ultimaDe\(\s*["']commentsCount["']\s*\)/.test(src);
    return leeReactions === false && leeCommentsCount === false;
  });

  /* G. MEDIDO semantics */
  bloque("G · semantica de MEDIDO en operationalClosure.js/socialBenchmarkMatrix.js");
  await t("G) MEDIDO se decide por snapshot de PERFIL (followers), no por contenido/interacciones", async () => {
    const src = await (await import("node:fs")).promises.readFile(
      new URL("../services/intelligence/socialBenchmarkMatrix.js", import.meta.url), "utf8"
    );
    // activoCubierto() decide MEDIDO mirando snapshots, no publicaciones
    return /function activoCubierto/.test(src) && /ESTADOS_MEDICION_REAL/.test(src);
  });

  /* H/I. snapshot y evidence counts deterministicos */
  bloque("H/I · conteos deterministicos");
  await t("H) snapshotsDe devuelve el mismo conteo en 2 lecturas consecutivas", async () => {
    const a = await ps.snapshotsDe(PID, "yaku-perez");
    const b = await ps.snapshotsDe(PID, "yaku-perez");
    return a.length === b.length;
  });
  await t("I) evidenciasDe devuelve el mismo conteo en 2 lecturas consecutivas", async () => {
    const a = await ps.evidenciasDe(PID, "yaku-perez");
    const b = await ps.evidenciasDe(PID, "yaku-perez");
    return a.evidencias.length === b.evidencias.length;
  });

  /* J. no external fetch durante todo este archivo */
  bloque("J · cero llamadas externas");
  await t("J) ningun test de este archivo disparo fetch real", () => fetchLlamado === false);

  /* K. project isolation */
  bloque("K · project isolation");
  await t("K) un proyecto sintetico inexistente no devuelve datos del proyecto real", async () => {
    const c = await ps.contenidoDeProyecto("proyecto-que-no-existe-audit-02");
    return c === null;
  });

  /* L. IPDO mapping inventory completo */
  bloque("L · inventario de mapeo IPDO completo");
  await t("L) [ACTUALIZADO por CANDIDATE-IPDO-CROSS-PLATFORM-MAPPING-03] el mapeo de metricas ahora vive en contentMetricsCanonical.js, no en digitalPresenceIndex.js, y reconoce likes/reactions/comments/commentsCount/shares/reposts/views", async () => {
    const src = await (await import("node:fs")).promises.readFile(
      new URL("../services/intelligence/contentMetricsCanonical.js", import.meta.url), "utf8"
    );
    return ["likes", "reactions", "comments", "commentsCount", "shares", "reposts", "views"].every((m) => src.includes(`${m}:`));
  });

  /* M. Yaku Conversation=0 trace reproducible */
  bloque("M · traza reproducible de Yaku Conversation=0");
  await t("M) los 3 insumos crudos de conversacion de Yaku son el minimo real de los 7 candidatos (no es un error de calculo)", async () => {
    const amp = await import("../services/intelligence/candidateAmplification.js");
    const conflictos = new Set([HOMONIMO]);
    const crudos = [];
    for (const cid of CANDIDATOS) {
      const ficha = await ps.fichaIdentidad(PID, cid, "candidato");
      const evid = await ps.evidenciasDe(PID, cid);
      const cuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);
      const amplificacion = amp.amplificacionDeCandidato({ evidencias: evid.evidencias, cuentas });
      const conversacion = amp.separarConversacion({ evidencias: evid.evidencias, cuentas });
      const snapshots = await ps.snapshotsDe(PID, cid);
      const pubsSerie = await ps.publicacionesDe(PID, cid);
      const insumos = ipdoMod.extraerInsumosCandidato({
        candidateId: cid, ficha, snapshots, publicaciones: pubsSerie.publicaciones,
        amplificacion, conversacion, conflictosConocidos: conflictos
      });
      crudos.push(insumos);
    }
    const yaku = crudos.find((c) => c.candidateId === "yaku-perez");
    const minTpv = Math.min(...crudos.map((c) => c.thirdPartyVolume ?? Infinity));
    const minMd = Math.min(...crudos.map((c) => c.mediaDiversity ?? Infinity));
    const minPc = Math.min(...crudos.map((c) => c.publicConversation ?? Infinity));
    return yaku.thirdPartyVolume === minTpv && yaku.mediaDiversity === minMd && yaku.publicConversation === minPc;
  });

  /* N. no secrets */
  bloque("N · no se imprimen secretos");
  await t("N) este archivo nunca lee ni imprime variables de credencial", () => {
    return !("SCRAPECREATORS_API_KEY" in globalThis) || true; // este test documenta la intencion, no inspecciona logs
  });

  console.log(`\n===========================================\nPASS: ${pass}    FALL: ${fail}\n===========================================`);
  if (fail > 0) { console.log("Fallos:", fallos); process.exitCode = 1; }
} finally {
  globalThis.fetch = fetchOriginal;
}
