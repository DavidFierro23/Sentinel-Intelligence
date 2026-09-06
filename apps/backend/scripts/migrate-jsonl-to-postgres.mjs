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
import { crearAdaptadorFichero } from "../services/knowledgeLake/lakeAdapter.js";
import { crearAdaptadorPostgres } from "../services/knowledgeLake/postgresAdapter.js";

const DRY_RUN = process.argv.includes("--dry-run");

function fail(mensaje) {
  console.error(`[migrate] ERROR: ${mensaje}`);
  process.exit(1);
}

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
let fallidos = 0;
const errores = [];

for (const registro of registros) {
  try {
    await destino.anexar(registro);
    insertados += 1;
  } catch (error) {
    if (error?.name === "VersionConflictError") {
      yaPresentes += 1;
    } else {
      fallidos += 1;
      errores.push({ id: registro.id, claveEntidad: registro.claveEntidad, motivo: error.message });
    }
  }
}

const targetCount = await destino.contar();

console.log(`INSERTED=${insertados}`);
console.log(`ALREADY_PRESENT=${yaPresentes}`);
console.log(`FAILED=${fallidos}`);
console.log(`TARGET_COUNT=${targetCount}`);

if (errores.length) {
  console.log("[migrate] errores (sin contenido de datos, solo identidad del registro):");
  errores.forEach((e) => console.log(`  - ${e.id} (${e.claveEntidad}): ${e.motivo}`));
}

await destino._cerrar();

process.exit(fallidos > 0 ? 1 : 0);
