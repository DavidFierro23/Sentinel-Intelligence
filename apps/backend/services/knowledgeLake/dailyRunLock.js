// apps/backend/services/knowledgeLake/dailyRunLock.js

/*
===========================================================
LOCK DISTRIBUIDO DIARIO — SENTINEL-HISTORICAL-CLOUD-01 (OPCIÓN A)
===========================================================

Primitiva de infraestructura, independiente de Candidate. NO se
integró en candidateObservationScheduler.js en este gate -- por
decisión explícita del usuario de no modificar ese archivo. Este
módulo existe listo para que, cuando se autorice, una única línea
en ejecutarObservacionDiaria() lo envuelva:

    const { ejecutado, resultado } = await conLockDiario(
      pool, projectId, localObservationDate,
      () => collectCandidateSnapshots(...)
    );

hasta entonces, la protección real del NORMAL_DAILY_RUN sigue
siendo únicamente la comprobación de aplicación existente
(`yaSeColectoHoy`), sin lock a nivel de base de datos.

POR QUÉ pg_try_advisory_lock

- Autoridad distribuida real: PostgreSQL, no memoria de proceso,
  no hostname, no timestamp.
- Session-level (no transaction-level): el lock se mantiene
  mientras la CONEXIÓN esté abierta, independientemente de cuántas
  transacciones ocurran en ella. Esto es exactamente lo que hace
  falta para envolver una sección crítica larga (recolectar
  activos de varios candidatos, escribir el collectionRun) sin
  perder el lock a mitad de camino.
- Auto-liberación en caída: si el proceso muere o la conexión se
  cae, PostgreSQL libera el lock de esa sesión automáticamente --
  no queda un lock huérfano bloqueando el día siguiente.

CLAVE ESTABLE Y DETERMINISTA

`pg_try_advisory_lock(hashtext(projectId), hashtext(fechaOperativa))`.
Dos claves int4 derivadas por Postgres mismo a partir de los dos
strings -- ni processId, ni hostname, ni timestamp aleatorio.
Mismo projectId + misma fecha operativa => siempre la misma clave,
en cualquier proceso, en cualquier máquina.

REGLA CRÍTICA: LA MISMA CONEXIÓN DE PRINCIPIO A FIN

Un lock de sesión adquirido en una conexión y luego "liberado"
soltando esa conexión de vuelta al pool para pedir otra NO es
válido -- otra sesión podría tomar esa conexión reciclada y
heredar el lock sin haberlo pedido, o el release podría ejecutarse
en una conexión distinta a la que lo adquirió (pg_advisory_unlock
solo libera locks de LA conexión que los adquirió). Por eso
`conLockDiario` mantiene un único `client` (de `pool.connect()`,
NO `pool.query()`) desde la adquisición hasta la liberación.
===========================================================
*/

const TIMEZONE_OPERACIONAL = "America/Guayaquil";

/*
  Duplicada deliberadamente de la lógica equivalente en
  candidateObservationScheduler.js (fechaLocalObservacion) en vez
  de importarla: esta es infraestructura (Knowledge Lake / T4), y
  no debe depender de un módulo de Candidate. Si el día de mañana
  Candidate cambia su cálculo de fecha operativa, este módulo debe
  seguir siendo correcto por sí mismo -- ambos calculan lo mismo
  con Intl.DateTimeFormat, sin compartir código, a propósito.
*/
export function fechaOperativaGuayaquil(fecha = new Date(), timezone = TIMEZONE_OPERACIONAL) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(fecha);
}

/*
  Intenta adquirir el lock. Si lo consigue, devuelve el `client`
  (checkout dedicado del pool) que el llamador DEBE pasar a
  `liberarLockDiario` -- nunca liberar con un client distinto.
  Si no lo consigue, libera el client de vuelta al pool de
  inmediato (no hay nada que mantener) y devuelve `client: null`.
*/
export async function intentarLockDiario(pool, projectId, fechaOperativa) {
  const client = await pool.connect();

  try {
    const r = await client.query(
      "SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS adquirido",
      [projectId, fechaOperativa]
    );

    const adquirido = r.rows[0].adquirido === true;

    if (!adquirido) {
      client.release();
      return { adquirido: false, client: null };
    }

    return { adquirido: true, client };
  } catch (error) {
    client.release();
    throw error;
  }
}

/*
  Libera el lock Y devuelve el client al pool. Debe llamarse con
  el MISMO client que devolvió intentarLockDiario -- pg_advisory_unlock
  solo libera locks tomados por la sesión actual; con un client
  distinto no liberaría nada (y dejaría el lock original vivo
  hasta que esa otra conexión se cierre).
*/
export async function liberarLockDiario(client, projectId, fechaOperativa) {
  try {
    await client.query(
      "SELECT pg_advisory_unlock(hashtext($1), hashtext($2))",
      [projectId, fechaOperativa]
    );
  } finally {
    client.release();
  }
}

/*
  Envoltorio de alto nivel: adquiere, ejecuta `fn`, libera -- SIEMPRE
  libera, incluso si `fn` lanza una excepcion. Es el punto de
  integracion listo para el dia en que se autorice envolver
  ejecutarObservacionDiaria().

  Devuelve { ejecutado: false, motivo: "lock_no_adquirido" } sin
  ejecutar `fn` en absoluto si el lock ya esta tomado por otro
  worker -- la proteccion ocurre ANTES de cualquier trabajo, tal
  como exige el requisito.
*/
export async function conLockDiario(pool, projectId, fechaOperativa, fn) {
  const { adquirido, client } = await intentarLockDiario(pool, projectId, fechaOperativa);

  if (!adquirido) {
    return { ejecutado: false, motivo: "lock_no_adquirido" };
  }

  try {
    const resultado = await fn();
    return { ejecutado: true, resultado };
  } finally {
    await liberarLockDiario(client, projectId, fechaOperativa);
  }
}
