// apps/backend/scripts/migrations/check-postgres-connection.mjs
//
// ===========================================================
// DIAGNOSTICO DE CONEXION POSTGRES — SIN EXPONER SECRETOS
// SENTINEL-HISTORICAL-CLOUD-01
// ===========================================================
//
//     node scripts/migrations/check-postgres-connection.mjs
//
// Comprueba que DATABASE_URL conecta y que las consultas
// parametrizadas SIN nombre (el patron que usa postgresAdapter.js)
// funcionan igual en dos conexiones distintas del pool -- que es
// exactamente lo que haria falta que fallara para que el
// Transaction Pooler de Supabase fuera incompatible.
//
// Cualquier error se sanitiza antes de imprimirse: nunca se
// imprime DATABASE_URL ni ninguna contraseña, aunque el driver la
// incluya en el mensaje de error crudo.
// ===========================================================

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

function sanitize(err) {
  const msg = String(err?.message || err);
  return msg.replace(/postgres(ql)?:\/\/[^\s]+/gi, "[REDACTED_CONNECTION_STRING]");
}

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL=ABSENT");
  process.exit(1);
}

console.log("DATABASE_URL=PRESENT");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 10000
});

try {
  const client = await pool.connect();

  try {
    const r1 = await client.query("SELECT current_setting('server_version') AS pg_version");
    console.log("CONNECT_OK=true");
    console.log(`PG_VERSION=${r1.rows[0].pg_version}`);

    const r2 = await client.query("SELECT $1::text AS echo", ["pooler-compat-check"]);
    console.log(`PARAM_QUERY_OK=${r2.rows[0].echo === "pooler-compat-check"}`);

    const client2 = await pool.connect();
    try {
      const r3 = await client2.query("SELECT $1::text AS echo", ["second-connection-check"]);
      console.log(
        `SECOND_CONNECTION_PARAM_QUERY_OK=${r3.rows[0].echo === "second-connection-check"}`
      );
    } finally {
      client2.release();
    }
  } finally {
    client.release();
  }
} catch (error) {
  console.log("CONNECT_OK=false");
  console.log(`ERROR_SANITIZED=${sanitize(error)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
