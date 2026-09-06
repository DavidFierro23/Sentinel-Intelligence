// apps/backend/tests/candidateSchedulerDistributedLock.test.mjs

/*
===========================================================
LOCK DISTRIBUIDO INTEGRADO EN EL SCHEDULER — PRUEBAS REALES
SENTINEL-HISTORICAL-CLOUD-01 (Opción A, integración autorizada)
===========================================================

    node tests/candidateSchedulerDistributedLock.test.mjs

Requiere DATABASE_URL real. Fuerza SENTINEL_LAKE_ADAPTER=postgres
ANTES de importar el scheduler/projectStore, porque la integración
del lock solo se activa con ese adaptador (con `fichero`/`memoria`
el comportamiento es idéntico al de antes de este gate, ya probado
en tests/candidateObservationScheduler.test.mjs con 23/23 PASS).

CERO requests a proveedores: el proyecto y candidatos de este
fixture no declaran NINGUNA cuenta social, así que
`collectCandidateSnapshots` no tiene ningún activo que medir y
retorna casi instantáneamente sin tocar la red externa -- el mismo
patrón que ya usa la suite existente con el adaptador memoria.

NOTA DE ALCANCE: al usar el adaptador postgres real, este fixture
SÍ escribe un puñado de filas reales (un proyecto, un candidato,
un collectionRun) en la tabla `lake_records` de la base de
producción -- son append-only por diseño del Lake (no se pueden
borrar sin violar ese mismo principio) y quedan claramente
namespaced bajo el proyectoId de este fixture, fácilmente
identificables. Documentado explícitamente en
docs/SENTINEL-HISTORICAL-CLOUD-01.md.
===========================================================
*/

import "dotenv/config";

process.env.SENTINEL_LAKE_ADAPTER = "postgres";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL ausente -- esta prueba requiere Postgres real para ejercer el adaptador postgres de verdad.");
  process.exit(1);
}

const ps = await import("../services/projects/projectStore.js");
const scheduler = await import("../services/intelligence/candidateObservationScheduler.js");
const { cerrarLake } = await import("../services/knowledgeLake/lakeQuery.js");

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
      console.log(`  FALL  ${nombre}  (devolvió ${JSON.stringify(valor)})`);
    }
  } catch (error) {
    fail += 1;
    fallos.push(`${nombre} (${error.message})`);
    console.log(`  ERR   ${nombre}: ${error.message}`);
  }
}

function bloque(titulo) {
  console.log(`\n${titulo}`);
  console.log("-".repeat(titulo.length));
}

const SUFIJO = Date.now();
const NOMBRE_PROYECTO_A = `Fixture Lock Scheduler A ${SUFIJO}`;
const NOMBRE_PROYECTO_B = `Fixture Lock Scheduler B ${SUFIJO}`;

const proyA = await ps.crearProyecto({ nombre: NOMBRE_PROYECTO_A });
const proyB = await ps.crearProyecto({ nombre: NOMBRE_PROYECTO_B });
const pidA = proyA.proyecto.id;
const pidB = proyB.proyecto.id;

// Candidato SIN ninguna cuenta social declarada -- cero activos que
// medir, cero requests reales, exactamente el patrón ya usado por
// tests/candidateObservationScheduler.test.mjs.
await ps.agregarCandidato(pidA, { nombre: "Fixture Sin Redes A" });
await ps.agregarCandidato(pidB, { nombre: "Fixture Sin Redes B" });

const AHORA_DIA1 = new Date("2026-09-05T15:00:00Z"); // mediodía en Guayaquil, sin ambigüedad de zona
const AHORA_DIA2 = new Date("2026-09-06T15:00:00Z");

bloque("SCHED-LOCK-A/B  dos workers simultáneos, mismo proyecto+día: uno entra, el otro SKIPPED_LOCKED, cero llamadas duplicadas");

const [runA, runB] = await Promise.all([
  scheduler.ejecutarObservacionDiaria(pidA, { ahora: AHORA_DIA1 }),
  scheduler.ejecutarObservacionDiaria(pidA, { ahora: AHORA_DIA1 })
]);

const resultados = [runA, runB];
const bloqueados = resultados.filter((r) => r.status === scheduler.ESTADOS_RUN.SKIPPED_LOCKED);
const noBloqueados = resultados.filter((r) => r.status !== scheduler.ESTADOS_RUN.SKIPPED_LOCKED);

await t("exactamente uno de los dos workers simultáneos queda SKIPPED_LOCKED", () => bloqueados.length === 1);
await t("exactamente uno de los dos workers simultáneos SÍ ejecutó (no ambos bloqueados, no ambos pasaron)", () => noBloqueados.length === 1);
await t("el worker bloqueado no reporta candidatos observados ni requests usados", () => {
  const b = bloqueados[0];
  return b.candidatesObserved === 0 && b.requestsUsed === 0 && b.candidatesPlanned === 0;
});
await t("el worker bloqueado NO generó un collectionRunId con estado propio persistido (no se creó una segunda observación)", async () => {
  const runs = await ps.collectionRunsDe(pidA);
  const normales = runs.filter((r) => r.triggerType === scheduler.TIPOS_DISPARO.NORMAL_DAILY_RUN);
  return normales.length === 1; // solo el ganador quedó persistido
});

bloque("SCHED-LOCK-C  tras liberar, una tercera llamada cae en SKIPPED_ALREADY_COLLECTED (idempotencia existente preservada)");

const runC = await scheduler.ejecutarObservacionDiaria(pidA, { ahora: AHORA_DIA1 });

await t("la tercera llamada, ya sin contención de lock, respeta yaSeColectoHoy => SKIPPED_ALREADY_COLLECTED", () => {
  return runC.status === scheduler.ESTADOS_RUN.SKIPPED_ALREADY_COLLECTED;
});

bloque("SCHED-LOCK-D  proyecto distinto, mismo día: ambos pueden ejecutar sin bloqueo cruzado");

const [runProyA2, runProyB1] = await Promise.all([
  scheduler.ejecutarObservacionDiaria(pidA, { ahora: AHORA_DIA2 }),
  scheduler.ejecutarObservacionDiaria(pidB, { ahora: AHORA_DIA2 })
]);

await t("proyecto A (día 2) y proyecto B (día 2), simultáneos, NINGUNO queda SKIPPED_LOCKED entre sí", () => {
  return runProyA2.status !== scheduler.ESTADOS_RUN.SKIPPED_LOCKED && runProyB1.status !== scheduler.ESTADOS_RUN.SKIPPED_LOCKED;
});

bloque("SCHED-LOCK-E  mismo proyecto, día distinto ya cubierto arriba (día1 vs día2 de proyecto A no compitieron)");

await t("el run de proyecto A día 1 (ganador de SCHED-LOCK-A) y el de día 2 son collectionRunId distintos", () => {
  const ganadorDia1 = noBloqueados[0];
  return ganadorDia1.collectionRunId !== runProyA2.collectionRunId && ganadorDia1.localObservationDate !== runProyA2.localObservationDate;
});

bloque("SCHED-LOCK-F  FORCED_MANUAL_RUN no usa el lock (no compite por 'el día')");

const runForzado1 = await scheduler.ejecutarObservacionDiaria(pidA, {
  ahora: AHORA_DIA1,
  triggerType: scheduler.TIPOS_DISPARO.FORCED_MANUAL_RUN,
  forzar: true
});

await t("una corrida FORCED_MANUAL_RUN el mismo día ya colectado SÍ ejecuta (no SKIPPED de ningún tipo)", () => {
  return runForzado1.status !== scheduler.ESTADOS_RUN.SKIPPED_LOCKED && runForzado1.status !== scheduler.ESTADOS_RUN.SKIPPED_ALREADY_COLLECTED;
});

bloque("SCHED-LOCK-G  cero requests a proveedores en toda esta suite");

await t("ningún run reportó requestsUsed mayor a 0 (candidatos sin cuentas sociales, sin red externa)", () => {
  return [...resultados, runC, runProyA2, runProyB1, runForzado1].every((r) => (r.requestsUsed ?? 0) === 0);
});

await cerrarLake();

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);
if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}
console.log("===========================================\n");
console.log(`Fixture: proyecto A=${pidA}, proyecto B=${pidB} (residuo permanente en lake_records real, ver nota de alcance arriba)`);

process.exit(fail > 0 ? 1 : 0);
