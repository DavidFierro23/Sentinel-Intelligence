// apps/backend/tests/storage/dailyRunLock.test.mjs

/*
===========================================================
LOCK DISTRIBUIDO DIARIO — PRUEBAS CONTRA POSTGRES REAL
SENTINEL-HISTORICAL-CLOUD-01 (OPCIÓN A)
===========================================================

    node tests/storage/dailyRunLock.test.mjs

Requiere DATABASE_URL real (Supabase u otro Postgres). CERO
requests a proveedores de datos (SerpAPI, Meta, Brave, X, YouTube,
ScrapeCreators) -- esta prueba solo habla con PostgreSQL.

No toca apps/backend/data. No toca ninguna tabla de negocio, solo
adquiere/libera advisory locks (que no son filas, son estado de
sesión de PostgreSQL -- no dejan ningún registro persistente que
limpiar).
===========================================================
*/

import "dotenv/config";
import pg from "pg";
import {
  intentarLockDiario,
  liberarLockDiario,
  conLockDiario,
  fechaOperativaGuayaquil
} from "../../services/knowledgeLake/dailyRunLock.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL ausente -- esta prueba requiere Postgres real, no hay fallback sintético para un lock distribuido de verdad.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 10000
});

/*
  LOCK-8 termina deliberadamente una conexión desde dentro para
  simular un proceso caído. Un pool de `pg` puede propagar el
  'error' de un cliente inactivo hasta el propio Pool; sin este
  listener, ese evento no manejado también tumbaría el proceso.
*/
pool.on("error", () => {
  /* cliente de la simulación de caída (LOCK-8): esperado, ignorado */
});

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

const PROYECTO_FIXTURE = "fixture-lock-test-project-A";
const PROYECTO_FIXTURE_B = "fixture-lock-test-project-B";
const FECHA_FIXTURE = "2026-09-05";
const FECHA_FIXTURE_2 = "2026-09-06";

bloque("LOCK-1  Worker A adquiere, Worker B simultáneo NO puede");

const workerA = await intentarLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE);

await t("Worker A adquiere el lock(projectId, fecha) = true", () => workerA.adquirido === true);

const workerB_mientras_A_tiene_el_lock = await intentarLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE);

await t(
  "Worker B, mismo projectId+fecha, MIENTRAS A lo tiene = false (bloqueado)",
  () => workerB_mientras_A_tiene_el_lock.adquirido === false
);

bloque("LOCK-2  tras liberar A, B puede adquirir");

await liberarLockDiario(workerA.client, PROYECTO_FIXTURE, FECHA_FIXTURE);

const workerB_despues = await intentarLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE);

await t("Worker B, DESPUÉS de que A libera = true", () => workerB_despues.adquirido === true);

await liberarLockDiario(workerB_despues.client, PROYECTO_FIXTURE, FECHA_FIXTURE);

bloque("LOCK-3  proyecto distinto, mismo día -> ambos pueden, sin bloqueo cruzado");

const lockProyectoA = await intentarLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE);
const lockProyectoB = await intentarLockDiario(pool, PROYECTO_FIXTURE_B, FECHA_FIXTURE);

await t(
  "proyecto A y proyecto B, misma fecha, ambos adquieren simultáneamente",
  () => lockProyectoA.adquirido === true && lockProyectoB.adquirido === true
);

await liberarLockDiario(lockProyectoA.client, PROYECTO_FIXTURE, FECHA_FIXTURE);
await liberarLockDiario(lockProyectoB.client, PROYECTO_FIXTURE_B, FECHA_FIXTURE);

bloque("LOCK-4  mismo proyecto, fecha distinta -> ambos pueden, sin bloqueo cruzado");

const lockFecha1 = await intentarLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE);
const lockFecha2 = await intentarLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE_2);

await t(
  "mismo proyecto, fecha 1 y fecha 2, ambos adquieren simultáneamente",
  () => lockFecha1.adquirido === true && lockFecha2.adquirido === true
);

await liberarLockDiario(lockFecha1.client, PROYECTO_FIXTURE, FECHA_FIXTURE);
await liberarLockDiario(lockFecha2.client, PROYECTO_FIXTURE, FECHA_FIXTURE_2);

bloque("LOCK-5  excepción durante la sección crítica -> el lock SÍ se libera (finally)");

let seEjecutoElTrabajo = false;

const resultadoConExcepcion = await conLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE, async () => {
  seEjecutoElTrabajo = true;
  throw new Error("fallo simulado dentro de la sección crítica, sin providers reales");
}).catch((error) => ({ lanzoExcepcion: true, error }));

await t("conLockDiario propaga la excepción (no la traga en silencio)", () => {
  return resultadoConExcepcion.lanzoExcepcion === true;
});

await t("el trabajo sí se ejecutó (el lock permitió entrar)", () => seEjecutoElTrabajo === true);

const lockTrasExcepcion = await intentarLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE);

await t(
  "tras la excepción, un nuevo intento SÍ puede adquirir el lock (no quedó huérfano)",
  () => lockTrasExcepcion.adquirido === true
);

await liberarLockDiario(lockTrasExcepcion.client, PROYECTO_FIXTURE, FECHA_FIXTURE);

bloque("LOCK-6  conLockDiario: éxito normal libera y devuelve el resultado");

const resultadoOk = await conLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE, async () => "trabajo-simulado-ok");

await t("conLockDiario devuelve ejecutado:true y el resultado de fn", () => {
  return resultadoOk.ejecutado === true && resultadoOk.resultado === "trabajo-simulado-ok";
});

const lockTrasExito = await intentarLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE);

await t("tras un conLockDiario exitoso, el lock queda libre para el siguiente", () => lockTrasExito.adquirido === true);

await liberarLockDiario(lockTrasExito.client, PROYECTO_FIXTURE, FECHA_FIXTURE);

bloque("LOCK-7  conLockDiario: si el lock ya está tomado, NO ejecuta fn en absoluto");

const lockYaTomado = await intentarLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE);

let seEjecutoMientrasBloqueado = false;

const resultadoBloqueado = await conLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE, async () => {
  seEjecutoMientrasBloqueado = true;
  return "no-deberia-llegar-aqui";
});

await t("conLockDiario devuelve ejecutado:false, motivo:lock_no_adquirido", () => {
  return resultadoBloqueado.ejecutado === false && resultadoBloqueado.motivo === "lock_no_adquirido";
});

await t("fn NUNCA se ejecutó -- la protección ocurrió ANTES de cualquier trabajo", () => {
  return seEjecutoMientrasBloqueado === false;
});

await liberarLockDiario(lockYaTomado.client, PROYECTO_FIXTURE, FECHA_FIXTURE);

bloque("LOCK-8  proceso caído / conexión cerrada sin liberar -> Postgres libera solo (session-level)");

const workerQueSeCae = await intentarLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE);

await t("worker que va a 'caerse' adquiere el lock primero", () => workerQueSeCae.adquirido === true);

/*
  Simula un proceso que muere sin ejecutar el `finally` de
  liberarLockDiario: se termina la conexión directamente (no se
  llama pg_advisory_unlock). Un advisory lock de SESIÓN debe
  liberarse automáticamente cuando Postgres detecta que esa sesión
  ya no existe.

  `pg_terminate_backend` sobre la propia sesión hace que el socket
  se cierre abruptamente desde el lado del servidor -- node-postgres
  emite un evento 'error' en el Client (no solo un rechazo de la
  promesa de query) cuando eso pasa. Sin un listener, Node trata ese
  'error' como no manejado y mata el proceso entero. Como este
  cierre abrupto es exactamente lo que la prueba busca provocar, se
  atiende explícitamente y se ignora.
*/
workerQueSeCae.client.on("error", () => {
  /* cierre abrupto esperado: es el escenario que esta prueba simula */
});

await workerQueSeCae.client.query("SELECT pg_terminate_backend(pg_backend_pid())").catch(() => {
  /* se espera que esto termine la propia conexión abruptamente */
});

// Pequeña espera para que Postgres procese la terminación de esa sesión
// antes de intentar el siguiente lock -- no es un sleep de reintento,
// es dar tiempo a que el backend terminado libere sus locks de sesión.
await new Promise((resolve) => setTimeout(resolve, 1500));

const lockTrasCaida = await intentarLockDiario(pool, PROYECTO_FIXTURE, FECHA_FIXTURE);

await t(
  "tras terminar la conexión abruptamente (sin liberar), un nuevo worker SÍ puede adquirir -- no quedó huérfano para siempre",
  () => lockTrasCaida.adquirido === true
);

await liberarLockDiario(lockTrasCaida.client, PROYECTO_FIXTURE, FECHA_FIXTURE);

bloque("LOCK-9  timezone: fechaOperativaGuayaquil alrededor de medianoche UTC-5");

await t("2026-01-01T04:59:00Z (23:59 en Guayaquil, día anterior) => 2025-12-31", () => {
  return fechaOperativaGuayaquil(new Date("2026-01-01T04:59:00Z")) === "2025-12-31";
});

await t("2026-01-01T05:00:00Z (00:00 en Guayaquil, ya el día nuevo) => 2026-01-01", () => {
  return fechaOperativaGuayaquil(new Date("2026-01-01T05:00:00Z")) === "2026-01-01";
});

await t("2026-09-05T17:00:00Z (mediodía en Guayaquil) => 2026-09-05, sin ambigüedad", () => {
  return fechaOperativaGuayaquil(new Date("2026-09-05T17:00:00Z")) === "2026-09-05";
});

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);
if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}
console.log("===========================================\n");

/*
  LOCK-8 deliberadamente termina una conexión sin devolverla al
  pool (`client.release()` nunca se llama para ese client, a
  propósito: simula un proceso caído). El pool de `pg` puede
  esperar indefinidamente a que ese client "vuelva" antes de
  terminar `pool.end()`. Como ya sabemos que esa conexión concreta
  nunca volverá, se limita la espera con un timeout en vez de
  colgar el proceso -- las 17 aserciones ya se comprobaron antes de
  este punto, esto es solo apagar limpio.
*/
await Promise.race([
  pool.end(),
  new Promise((resolve) => setTimeout(resolve, 3000))
]);

process.exit(fail > 0 ? 1 : 0);
