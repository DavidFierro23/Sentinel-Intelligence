// apps/backend/scripts/migrate-jsonl-to-postgres.mjs
//
// ===========================================================
// IMPORTADOR IDEMPOTENTE: JSONL (Lake de fichero) -> PostgreSQL
// SENTINEL-HISTORICAL-CLOUD-01
// ===========================================================
//
//     node scripts/migrate-jsonl-to-postgres.mjs [--dry-run]
//
// NO DESTRUCTIVO: solo LEE el adaptador de fichero
// (apps/backend/data/knowledge-lake), nunca escribe ni borra ahi.
//
// IDEMPOTENTE: cada registro se inserta con
// `INSERT ... ON CONFLICT (clave_entidad, version) DO NOTHING`,
// la MISMA restriccion que ya usa postgresAdapter.anexar() para
// escrituras nuevas. Correr este script dos veces no duplica nada:
// la segunda vez, todo cae en ALREADY_PRESENT.
//
// NO genera IDs nuevos: usa exactamente `registro.id`,
// `registro.claveEntidad` y `registro.version` tal como ya existen
// en el JSONL -- la migracion es trazable 1:1 con el origen.
//
// REQUIERE: DATABASE_URL valido Y la migracion de esquema
// (scripts/migrations/001_lake_records.sql) ya aplicada. Si la
// tabla no existe, este script falla con un mensaje claro en vez
// de intentar crearla el mismo (la creacion de esquema es un paso
// aparte, deliberadamente).
//
// --dry-run: lee y valida todo el JSONL, imprime lo que HARIA, sin
// tocar la base de datos. Util para confirmar SOURCE_COUNT antes
// de escribir nada.
// ===========================================================

import "dotenv/config";
import { pathToFileURL } from "node:url";
import { crearAdaptadorFichero } from "../services/knowledgeLake/lakeAdapter.js";
import { crearAdaptadorPostgres } from "../services/knowledgeLake/postgresAdapter.js";

const DRY_RUN = process.argv.includes("--dry-run");

/*
  Pura, sin I/O, para poder probarla sin ninguna base de datos real
  (tests/storage/migrationCollisionPolicy.test.mjs). Decide qué hacer
  ante un VersionConflictError: si el hash ya guardado coincide con el
  que se está importando, es la misma escritura repetida (idempotencia
  normal). Si no coincide, es una colisión de version real preexistente
  en el JSONL de origen y el perdedor debe preservarse, nunca
  descartarse en silencio.
*/
export function decidirTratamientoDeConflicto(hashCanonico, hashEntrante) {
  if (hashCanonico === hashEntrante) return "ALREADY_PRESENT";
  return "PRESERVE_CONFLICT";
}

function fail(mensaje) {
  console.error(`[migrate] ERROR: ${mensaje}`);
  process.exit(1);
}

/*
  Toda la ejecución real vive dentro de main() y SOLO se llama cuando
  este archivo se ejecuta directamente (`node migrate-jsonl-to-postgres.mjs`),
  nunca cuando otro módulo lo importa solo por `decidirTratamientoDeConflicto`
  (ver tests/storage/migrationCollisionPolicy.test.mjs). Sin este guard,
  importar el archivo para su única función pura dispararía la migración
  completa como efecto secundario -- exactamente lo que un test sin DB
  real no puede permitirse.
*/
async function main() {
  if (!DRY_RUN && !process.env.DATABASE_URL) {
    fail("DATABASE_URL no está definida. Usa --dry-run para validar sin conectar.");
  }

  const origen = crearAdaptadorFichero({});
  const registros = await origen.leerTodos();

  console.log(`SOURCE_COUNT=${registros.length}`);

  if (DRY_RUN) {
    const claves = new Set(registros.map((r) => `${r.claveEntidad}::${r.version}`));
    const invalidos = registros.filter(
      (r) => !r.claveEntidad || r.version == null || !r.tenantId || !r.proyectoId
    );

    console.log(`CLAVES_UNICAS=${claves.size}`);
    console.log(`REGISTROS_SIN_CAMPOS_OBLIGATORIOS=${invalidos.length}`);
    console.log("[migrate] --dry-run: no se escribió nada.");
    process.exit(invalidos.length > 0 ? 1 : 0);
  }

  const destino = crearAdaptadorPostgres({});

  let insertados = 0;
  let yaPresentes = 0;
  let colisionesPreservadas = 0;
  let colisionesYaPreservadas = 0;
  let fallidos = 0;
  const errores = [];

  /*
    NO SOBRESCRIBIR EN SILENCIO. Ante un VersionConflictError hay dos casos
    muy distintos y hay que distinguirlos, no tratarlos igual:

      a) el registro que ya está en Postgres tiene el MISMO hash que el que
         estamos importando -- es literalmente el mismo dato, ya importado
         en una corrida anterior de este mismo script (idempotencia normal).
         Se cuenta como ALREADY_PRESENT, nada que preservar.

      b) el registro que ya está en Postgres tiene un hash DISTINTO -- es
         una colisión de version REAL preexistente en el JSONL de origen
         (dos escrituras concurrentes históricas). El perdedor NO se
         descarta: se preserva íntegro en lake_records_version_conflicts,
         con referencia a cuál quedó como canónico, para que una persona
         decida después qué hacer con ambos.
  */
  for (const registro of registros) {
    try {
      await destino.anexar(registro);
      insertados += 1;
    } catch (error) {
      if (error?.name !== "VersionConflictError") {
        fallidos += 1;
        errores.push({ id: registro.id, claveEntidad: registro.claveEntidad, motivo: error.message });
        continue;
      }

      const existente = await destino._query(
        "SELECT registro_id, hash FROM lake_records WHERE clave_entidad = $1 AND version = $2",
        [registro.claveEntidad, registro.version]
      );

      const hashCanonico = existente.rows[0]?.hash;
      const idCanonico = existente.rows[0]?.registro_id;

      if (decidirTratamientoDeConflicto(hashCanonico, registro.hash) === "ALREADY_PRESENT") {
        yaPresentes += 1;
        continue;
      }

      const insercionConflicto = await destino._query(
        `INSERT INTO lake_records_version_conflicts
           (clave_entidad, version, registro_id, hash, registro, registro_id_canonico, hash_canonico)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (registro_id) DO NOTHING
         RETURNING id`,
        [
          registro.claveEntidad,
          registro.version,
          registro.id,
          registro.hash,
          JSON.stringify(registro),
          idCanonico || null,
          hashCanonico || null
        ]
      );

      // rowCount === 0 significa que este registro conflictivo YA estaba
      // preservado de una corrida anterior -- no es una preservación
      // nueva, es la idempotencia de esta misma tabla funcionando. Se
      // cuenta aparte para que el reporte no sugiera que se preservó
      // algo nuevo cuando en realidad no se escribió ninguna fila.
      if (insercionConflicto.rowCount > 0) {
        colisionesPreservadas += 1;
      } else {
        colisionesYaPreservadas += 1;
      }
    }
  }

  const targetCount = await destino.contar();

  console.log(`INSERTED=${insertados}`);
  console.log(`ALREADY_PRESENT=${yaPresentes}`);
  console.log(`COLLISIONS_PRESERVED=${colisionesPreservadas}`);
  console.log(`COLLISIONS_ALREADY_PRESERVED=${colisionesYaPreservadas}`);
  console.log(`FAILED=${fallidos}`);
  console.log(`TARGET_COUNT=${targetCount}`);

  if (errores.length) {
    console.log("[migrate] errores (sin contenido de datos, solo identidad del registro):");
    errores.forEach((e) => console.log(`  - ${e.id} (${e.claveEntidad}): ${e.motivo}`));
  }

  await destino._cerrar();

  process.exit(fallidos > 0 ? 1 : 0);
}

const esPuntoDeEntrada =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esPuntoDeEntrada) {
  main();
}
