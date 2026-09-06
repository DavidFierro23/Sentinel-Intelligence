// apps/backend/services/knowledgeLake/postgresAdapter.js

/*
===========================================================
ADAPTADOR POSTGRESQL — SENTINEL-HISTORICAL-CLOUD-01
===========================================================

Cuarto adaptador del Knowledge Lake, junto a memoria/fichero/minio
(lakeAdapter.js). Implementa exactamente la misma interfaz:

    anexar(registro)     — nunca sobrescribe
    leerTodos()           — recupera todo
    contar()
    particiones()
    estado()

Ningun modulo que consuma el Lake (lakeWriter.js, lakeIndexer.js,
lakeReader.js, projectStore.js, candidateObservationScheduler.js,
mediaUniverseStore.js, etc.) necesita saber que existe este
archivo. Eso es deliberado: es la razon de que este gate no toque
ninguna logica de Candidate/Territorial/Media.

QUE TABLA USA

Una sola tabla generica, `lake_records` (ver
scripts/migrations/001_lake_records.sql), que guarda el registro
completo tal como lo produce `construirRegistro()` en
lakeWriter.js, en una columna JSONB, mas un puñado de columnas
promovidas para indices/constraints (clave_entidad, version,
tenant_id, proyecto_id, tipo_entidad, particion, fechas). NO se
crean tablas tipadas por dominio (candidates, collection_runs,
etc.) en este adaptador: eso exigiria que projectStore.js y el
scheduler hablaran SQL directamente, que es exactamente lo que
esta arquitectura evita.

COMPATIBILIDAD CON TRANSACTION POOLER DE SUPABASE

Todas las consultas usan `pool.query(texto, valores)` con
parametros posicionales ($1, $2...) SIN nombrar la sentencia
preparada (`client.query({ name: ..., text, values })`). node-
postgres NO cachea una sentencia con nombre a menos que se le pida
explicitamente un `name` — por defecto usa el protocolo extendido
sin nombre, que es seguro bajo PgBouncer en modo transaccion,
donde cada transaccion puede caer en una conexion de backend
distinta. Esta es la razon documentada por la que este adaptador
es compatible con el pooler tal como esta configurado
(confirmado por puerto :6543 y usuario `postgres.<project-ref>`
en la auditoria de este mismo gate).

QUE PASA EN UN CONFLICTO DE VERSION

`anexar()` usa `INSERT ... ON CONFLICT (clave_entidad, version) DO
NOTHING RETURNING id`. Si la insercion no afecta ninguna fila (el
conflicto ya existia — dos escritores calcularon el mismo numero
de version), se lanza `VersionConflictError` en vez de fingir
exito. `lakeWriter.js` la captura y la traduce en un resultado
`{ escrito: false, motivo: "..." }` — el mismo patron que ya usa
para "sin cambios respecto a la version anterior" — para que
ningun llamador existente (que ya comprueba `r.escrito`) se rompa.
===========================================================
*/

import pg from "pg";

const { Pool } = pg;

export class VersionConflictError extends Error {
  constructor(claveEntidad, version) {
    super(
      `Conflicto de version: ya existe un registro para "${claveEntidad}" version ${version}. Otra escritura concurrente ocupo ese numero primero.`
    );
    this.name = "VersionConflictError";
    this.claveEntidad = claveEntidad;
    this.version = version;
  }
}

export function crearAdaptadorPostgres(opciones = {}) {
  const connectionString = opciones.connectionString || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "crearAdaptadorPostgres requiere DATABASE_URL (env) o opciones.connectionString."
    );
  }

  const pool = new Pool({
    connectionString,
    // Supabase (y la mayoria de Postgres gestionados) exige TLS; el
    // certificado del pooler no siempre esta en la cadena CA por
    // defecto de Node, de ahi rejectUnauthorized: false -- el canal
    // sigue cifrado, solo no se valida la cadena de certificado contra
    // una CA local. Documentado como limite conocido, no un descuido.
    ssl: { rejectUnauthorized: false },
    max: opciones.maxConexiones || 5,
    connectionTimeoutMillis: 10000
  });

  async function anexar(registro) {
    const texto = `
      INSERT INTO lake_records (
        registro_id, hash, hash_anterior,
        tenant_id, proyecto_id,
        clave_entidad, tipo_entidad, entidad, version,
        particion, fecha_deteccion, fecha_hecho,
        registro
      ) VALUES (
        $1, $2, $3,
        $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13
      )
      ON CONFLICT (clave_entidad, version) DO NOTHING
      RETURNING id
    `;

    const entidadTexto =
      typeof registro.entidad === "string"
        ? registro.entidad
        : registro.entidad?.id || registro.entidad?.clave || null;

    const valores = [
      registro.id,
      registro.hash,
      registro.hashAnterior || null,
      registro.tenantId,
      registro.proyectoId,
      registro.claveEntidad,
      registro.tipoEntidad,
      entidadTexto,
      registro.version,
      registro.particion,
      registro.fechaDeteccion,
      registro.fechaHecho || null,
      JSON.stringify(registro)
    ];

    const resultado = await pool.query(texto, valores);

    if (resultado.rowCount === 0) {
      throw new VersionConflictError(registro.claveEntidad, registro.version);
    }

    return { anexado: true, id: resultado.rows[0].id };
  }

  async function leerTodos() {
    // Mismo patron que el adaptador de fichero: se lee todo y el
    // indexado/filtrado ocurre en memoria via lakeIndexer.js. No es lo
    // mas escalable a largo plazo, pero es exactamente lo que el resto
    // del Lake ya espera hoy -- optimizarlo es trabajo de un gate
    // posterior, no un cambio de contrato en este.
    const resultado = await pool.query(
      "SELECT registro FROM lake_records ORDER BY id ASC"
    );

    return resultado.rows.map((fila) => fila.registro);
  }

  async function contar() {
    const resultado = await pool.query("SELECT COUNT(*)::int AS total FROM lake_records");
    return resultado.rows[0].total;
  }

  async function particiones() {
    const resultado = await pool.query(
      "SELECT DISTINCT particion FROM lake_records ORDER BY particion ASC"
    );
    return resultado.rows.map((fila) => fila.particion);
  }

  async function estado() {
    const total = await contar();

    return {
      id: "postgres",
      registros: total,
      persistente: true,
      pooler: "compatible (sentencias sin nombre, sin cache de prepared statement)"
    };
  }

  async function cerrar() {
    await pool.end();
  }

  return {
    id: "postgres",
    nombre: "PostgreSQL (Supabase u otro gestionado, via pg)",
    persistente: true,

    anexar,
    leerTodos,
    contar,
    particiones,
    estado,

    // No forma parte de la interfaz estandar del Lake -- exposicion
    // deliberada para que scripts de migracion/tests puedan cerrar el
    // pool limpiamente sin mantener una referencia aparte.
    _cerrar: cerrar
  };
}
