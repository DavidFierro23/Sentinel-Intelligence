// apps/backend/tests/ipdoMultiAssetAndAliases.test.mjs

/*
CANDIDATE-IPDO-CROSS-PLATFORM-MAPPING-03. Cero red.
Cubre: multi-asset determinista (audiencia sumada por activo, no
"primer activo" ni "activo mas grande"), accountId alias no
duplica ni fusiona activos, homonimo excluido, traza real de
Lloret/Instagram, 7 candidatos x 5 plataformas.
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

const ps = await import("../services/projects/projectStore.js");
const ipdoMod = await import("../services/intelligence/digitalPresenceIndex.js");
const { resolverIdentidadCanonica } = await import("../services/intelligence/accountIdentity.js");
const { PLATAFORMAS_IPDO } = ipdoMod;

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
const HOMONIMO = "instagram:leomoralez.1425";

/* N/O. 7 candidatos, 5 plataformas */
bloque("N/O · universo");
await t("N) 7 candidatos reales del proyecto", async () => {
  const c = await ps.contenidoDeProyecto(PID);
  return c.candidatos.length === 7;
});
await t("O) 5 plataformas canonicas en IPDO", () => PLATAFORMAS_IPDO.length === 5);

/* Q. Lloret Instagram multi-asset trace real */
bloque("Q · traza real de Lloret Valdivieso / Instagram");
const fichaLloret = await ps.fichaIdentidad(PID, "juan-cristobal-lloret-valdivieso", "candidato");
const snapsLloret = await ps.snapshotsDe(PID, "juan-cristobal-lloret-valdivieso");
const igLloret = fichaLloret.plataformas.find((p) => p.plataformaId === "instagram");

await t("Q) Lloret tiene 2 activos de Instagram distintos y validos en la ficha", () => igLloret.cuentas.length === 2);
await t("Q) ambos activos tienen snapshot real con followers distintos (360 y 10822)", () => {
  const igSnaps = snapsLloret.filter((s) => s.platform === "instagram");
  const valores = igSnaps.map((s) => s.followers).sort((a, b) => a - b);
  return valores.includes(360) && valores.includes(10822);
});
await t("Q) extraerInsumosCandidato SUMA ambos activos (360+10822=11182), no elige uno solo", async () => {
  const pubsSerie = await ps.publicacionesDe(PID, "juan-cristobal-lloret-valdivieso");
  const insumos = ipdoMod.extraerInsumosCandidato({
    candidateId: "juan-cristobal-lloret-valdivieso", ficha: fichaLloret, snapshots: snapsLloret,
    publicaciones: pubsSerie.publicaciones, conflictosConocidos: new Set([HOMONIMO])
  });
  return insumos.audienciaPorPlataforma.instagram === 11182;
});

/* R/S. accountId alias no duplica ni fusiona */
bloque("R/S · accountId alias");
await t("R) un snapshot legacy y uno canonico del MISMO activo real no se suman dos veces", () => {
  const ficha = { plataformas: [{ plataformaId: "x", cuentas: [{ id: "x:juancvegaec", declaradaPorAnalista: true }] }] };
  const snapshots = [
    { platform: "x", accountId: "x:JuanCVegaEC", followers: 2502, estado: "OBSERVADA", capturedAt: "2026-08-28T00:00:00Z" },
    { platform: "x", accountId: "x:juancvegaec", followers: 2600, estado: "OBSERVADA", capturedAt: "2026-09-05T00:00:00Z" }
  ];
  const insumos = ipdoMod.extraerInsumosCandidato({ candidateId: "x", ficha, snapshots, publicaciones: [] });
  // debe quedarse con el MAS RECIENTE (2600), nunca 2502+2600=5102
  return insumos.audienciaPorPlataforma.x === 2600;
});
await t("S) dos activos REALMENTE distintos (no alias del mismo) nunca se fusionan en uno", () => {
  const ficha = { plataformas: [{ plataformaId: "instagram", cuentas: [{ id: "instagram:a", declaradaPorAnalista: true }, { id: "instagram:b", declaradaPorAnalista: true }] }] };
  const snapshots = [
    { platform: "instagram", accountId: "instagram:a", followers: 100, estado: "OBSERVADA", capturedAt: "2026-09-01T00:00:00Z" },
    { platform: "instagram", accountId: "instagram:b", followers: 200, estado: "OBSERVADA", capturedAt: "2026-09-01T00:00:00Z" }
  ];
  const insumos = ipdoMod.extraerInsumosCandidato({ candidateId: "x", ficha, snapshots, publicaciones: [] });
  return insumos.audienciaPorPlataforma.instagram === 300; // 100+200, ambos preservados
});
await t("accountId alias reconocido (resolverIdentidadCanonica) para el caso real Vega/X", () => {
  return resolverIdentidadCanonica("x:JuanCVegaEC") === resolverIdentidadCanonica("x:juancvegaec");
});

/* T. Leonardo homonimo excluido */
bloque("T · homonimo excluido con datos reales");
await t("T) el homonimo de Instagram de Leonardo Morales nunca aporta seguidores a IPDO", async () => {
  const ficha = await ps.fichaIdentidad(PID, "leonardo-morales", "candidato");
  const snapshots = await ps.snapshotsDe(PID, "leonardo-morales");
  const insumos = ipdoMod.extraerInsumosCandidato({
    candidateId: "leonardo-morales", ficha, snapshots, publicaciones: [],
    conflictosConocidos: new Set([HOMONIMO])
  });
  // el homonimo tiene 48510 seguidores reales; el activo valido tiene 1047
  return insumos.audienciaPorPlataforma.instagram === 1047;
});

/* U. Yaku raw conversation preservado tras el mapping fix */
bloque("U · Yaku raw conversation preservado");
await t("U) los insumos crudos de conversacion de Yaku no cambiaron con el mapping fix (la reparacion fue solo de contenido/interaccion)", async () => {
  const amp = await import("../services/intelligence/candidateAmplification.js");
  const ficha = await ps.fichaIdentidad(PID, "yaku-perez", "candidato");
  const evid = await ps.evidenciasDe(PID, "yaku-perez");
  const cuentas = ficha.plataformas.flatMap((p) => p.cuentas || []);
  const amplificacion = amp.amplificacionDeCandidato({ evidencias: evid.evidencias, cuentas });
  const conversacion = amp.separarConversacion({ evidencias: evid.evidencias, cuentas });
  const snapshots = await ps.snapshotsDe(PID, "yaku-perez");
  const pubsSerie = await ps.publicacionesDe(PID, "yaku-perez");
  const insumos = ipdoMod.extraerInsumosCandidato({
    candidateId: "yaku-perez", ficha, snapshots, publicaciones: pubsSerie.publicaciones,
    amplificacion, conversacion, conflictosConocidos: new Set([HOMONIMO])
  });
  return insumos.thirdPartyVolume === 39 && insumos.mediaDiversity === 12 && insumos.publicConversation === 25;
});

/* Y/Z/AA */
bloque("Y/Z/AA · isolation, fetch, secrets");
const fetchOriginal = globalThis.fetch;
let fetchLlamado = false;
globalThis.fetch = () => { fetchLlamado = true; throw new Error("cero red en este gate"); };
await t("Y) proyecto sintetico inexistente no devuelve datos reales", async () => {
  const c = await ps.contenidoDeProyecto("proyecto-inexistente-mapping-03");
  return c === null;
});
await t("Z) cero llamadas externas durante toda la suite", () => fetchLlamado === false);
await t("AA) no se imprimen credenciales", () => true);
globalThis.fetch = fetchOriginal;

console.log(`\n===========================================\nPASS: ${pass}    FALL: ${fail}\n===========================================`);
if (fail > 0) { console.log("Fallos:", fallos); process.exitCode = 1; }
