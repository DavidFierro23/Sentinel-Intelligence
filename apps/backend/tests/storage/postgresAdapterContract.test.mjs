// apps/backend/tests/storage/postgresAdapterContract.test.mjs

/*
===========================================================
CONTRATO DEL ADAPTADOR POSTGRES — SIN DB REAL
SENTINEL-HISTORICAL-CLOUD-01
===========================================================

    node tests/storage/postgresAdapterContract.test.mjs

Estas pruebas NO se conectan a ninguna base de datos real -- `pg`
conecta de forma perezosa (en el primer query), asi que construir
el adaptador y comprobar su forma no dispara ninguna conexion de
red. Cero requests externos, cero coste, cero dependencia de que
DATABASE_URL sea valido.

Lo que SI requiere una base de datos real (crear tablas, insertar,
verificar conteos) vive en scripts/migrate-jsonl-to-postgres.mjs y
se documenta como pendiente de ejecutar cuando la conexion este
disponible -- ver docs/SENTINEL-HISTORICAL-CLOUD-01.md.
===========================================================
*/

import { crearAdaptador, ADAPTADORES_DISPONIBLES } from "../../services/knowledgeLake/lakeAdapter.js";
import { crearAdaptadorPostgres, VersionConflictError } from "../../services/knowledgeLake/postgresAdapter.js";

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

bloque("CONTRACT-1  postgres aparece registrado como adaptador disponible");

await t("'postgres' está en ADAPTADORES_DISPONIBLES", () => {
  return ADAPTADORES_DISPONIBLES.includes("postgres");
});

bloque("CONTRACT-2  construir el adaptador NO conecta a ninguna red");

await t("crearAdaptador('postgres', {connectionString: fake}) no lanza ni bloquea", () => {
  const adaptador = crearAdaptador("postgres", {
    connectionString: "postgresql://fake:fake@localhost:5432/fake"
  });

  return (
    adaptador.id === "postgres" &&
    adaptador.persistente === true &&
    typeof adaptador.anexar === "function" &&
    typeof adaptador.leerTodos === "function" &&
    typeof adaptador.contar === "function" &&
    typeof adaptador.particiones === "function" &&
    typeof adaptador.estado === "function"
  );
});

await t("crearAdaptadorPostgres sin connectionString ni DATABASE_URL lanza un error claro", () => {
  const originalEnv = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    crearAdaptadorPostgres({});
    return false;
  } catch (error) {
    return /DATABASE_URL/.test(error.message);
  } finally {
    if (originalEnv !== undefined) process.env.DATABASE_URL = originalEnv;
  }
});

bloque("CONTRACT-3  VersionConflictError tiene la forma que lakeWriter.js espera");

await t("VersionConflictError expone .name, .claveEntidad, .version", () => {
  const error = new VersionConflictError("tenant::proj::persona::x", 3);

  return (
    error.name === "VersionConflictError" &&
    error.claveEntidad === "tenant::proj::persona::x" &&
    error.version === 3 &&
    error instanceof Error
  );
});

bloque("CONTRACT-4  lakeWriter.js traduce VersionConflictError sin relanzarla (sin DB real)");

await t(
  "un adaptador que simula VersionConflictError produce escrito:false, no una excepción",
  async () => {
    const { crearEscritor } = await import("../../services/knowledgeLake/lakeWriter.js");
    const { crearIndice } = await import("../../services/knowledgeLake/lakeIndexer.js");

    const adaptadorFalso = {
      async anexar() {
        throw new VersionConflictError("tenant::proj::persona::x", 1);
      }
    };

    const indice = crearIndice();
    const escritor = crearEscritor(adaptadorFalso, indice);

    const resultado = await escritor.escribir({
      tenantId: "sentinel-fixture",
      proyectoId: "fixture",
      entidad: "x",
      tipoEntidad: "persona",
      fuente: "test",
      linaje: { submotor: "test-contrato" },
      datos: { a: 1 }
    });

    return (
      resultado.escrito === false &&
      resultado.conflictoDeVersion === true &&
      resultado.reintentable === true
    );
  }
);

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);
if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}
console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
