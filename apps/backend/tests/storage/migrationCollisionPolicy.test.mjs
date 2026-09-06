// apps/backend/tests/storage/migrationCollisionPolicy.test.mjs

/*
===========================================================
POLÍTICA DE COLISIONES DE VERSIÓN EN LA IMPORTACIÓN — SIN DB REAL
SENTINEL-HISTORICAL-CLOUD-01
===========================================================

    node tests/storage/migrationCollisionPolicy.test.mjs

Prueba la función pura `decidirTratamientoDeConflicto` que
migrate-jsonl-to-postgres.mjs usa para decidir, ante un
VersionConflictError, si el registro es:

  - la MISMA escritura ya importada antes (hash igual) -> ALREADY_PRESENT
  - una colisión de version REAL preexistente en el JSONL de origen
    (hash distinto) -> PRESERVE_CONFLICT, nunca se descarta en silencio

Importar el módulo del script NO dispara la migración: el propio
script solo ejecuta su main() cuando se invoca directamente
(`node migrate-jsonl-to-postgres.mjs`), gracias al guard de
`import.meta.url`. Esta prueba lo confirma implícitamente: si
importar disparara efectos secundarios, este archivo intentaría
conectar a una base de datos real y fallaría con un error de
DATABASE_URL, no con los PASS de abajo.
===========================================================
*/

import { decidirTratamientoDeConflicto } from "../../scripts/migrate-jsonl-to-postgres.mjs";

let pass = 0;
let fail = 0;
const fallos = [];

function t(nombre, comprobacion) {
  try {
    const valor = comprobacion();
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

bloque("COLLISION-POLICY-1  importar el script no ejecutó la migración");

t("la función se importó sin que main() se disparara (si lo hubiera hecho, este proceso ya habría fallado por falta de DATABASE_URL antes de llegar aquí)", () => {
  return typeof decidirTratamientoDeConflicto === "function";
});

bloque("COLLISION-POLICY-2  mismo hash -> ya presente, nada que preservar");

t("hash canónico === hash entrante => ALREADY_PRESENT", () => {
  return decidirTratamientoDeConflicto("abc123", "abc123") === "ALREADY_PRESENT";
});

bloque("COLLISION-POLICY-3  hash distinto -> preservar, NUNCA descartar en silencio");

t("hash canónico !== hash entrante => PRESERVE_CONFLICT", () => {
  return decidirTratamientoDeConflicto("abc123", "def456") === "PRESERVE_CONFLICT";
});

t("sin registro canónico previo (hash undefined) => PRESERVE_CONFLICT, no se asume ALREADY_PRESENT por defecto", () => {
  return decidirTratamientoDeConflicto(undefined, "def456") === "PRESERVE_CONFLICT";
});

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);
if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}
console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
