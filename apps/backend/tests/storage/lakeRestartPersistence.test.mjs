// apps/backend/tests/storage/lakeRestartPersistence.test.mjs

/*
===========================================================
PRUEBA DE REINICIO — SENTINEL-DATA-PERSISTENCE-01, §8
===========================================================

    node tests/storage/lakeRestartPersistence.test.mjs

Fixture propio, aislado en el directorio temporal del SO. No
toca `data/knowledge-lake` ni ningún expediente real.

QUÉ DEMUESTRA
-----------------------------------------------------------

`cerrarLake()` simula un reinicio del backend: destruye el
índice en memoria y la referencia a la instancia. Si al volver
a abrir el Lake con la misma raíz de disco los datos siguen
ahí, el adaptador de fichero sobrevive a un reinicio. Si al
volver a abrir el adaptador de memoria los datos NO están, el
adaptador de memoria no sobrevive — que es exactamente lo que
su propio `estado().advertencia` declara.

No se ejecuta nada de esto contra el corpus real: cada corrida
usa una raíz nueva bajo el directorio temporal del SO y se
borra al terminar.
===========================================================
*/

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { abrirLake, cerrarLake, escribirEnLake } from "../../services/knowledgeLake/lakeQuery.js";

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

function entrada(overrides = {}) {
  return {
    tenantId: "sentinel-fixture",
    proyectoId: "fixture-reinicio",
    entidad: "candidato-fixture-restart",
    tipoEntidad: "persona",
    fuente: "data-persistence-audit",
    linaje: { submotor: "SENTINEL-DATA-PERSISTENCE-01" },
    datos: { nota: "fixture de prueba de reinicio" },
    ...overrides
  };
}

const raizFichero = await mkdtemp(join(tmpdir(), "sentinel-lake-restart-"));

bloque("RESTART-1  adaptador de fichero sobrevive un reinicio simulado");

cerrarLake();

const escritura = await escribirEnLake(entrada(), {
  adaptador: "fichero",
  raiz: raizFichero
});

await t("la escritura inicial se acepta", () => escritura.escrito === true);

/* Simula el reinicio: destruye índice e instancia en memoria. */
cerrarLake();

const relectura = await abrirLake({ adaptador: "fichero", raiz: raizFichero });

await t(
  "el índice reconstruido tras 'reiniciar' encuentra el registro en disco",
  async () => {
    const vigente = await relectura.lector.vigente(escritura.claveEntidad);
    return Boolean(vigente) && vigente.datos?.nota === "fixture de prueba de reinicio";
  }
);

await t("el conteo del adaptador coincide con lo escrito antes de reiniciar", async () => {
  const total = await relectura.adaptador.contar();
  return total === 1;
});

cerrarLake();
await rm(raizFichero, { recursive: true, force: true });

bloque("RESTART-2  adaptador de memoria NO sobrevive un reinicio simulado");

cerrarLake();

const escrituraMemoria = await escribirEnLake(entrada({ entidad: "candidato-fixture-memoria" }), {
  adaptador: "memoria"
});

await t("la escritura en memoria se acepta", () => escrituraMemoria.escrito === true);

/*
  Reinicio simulado: `crearAdaptadorMemoria()` crea un array
  nuevo en un closure nuevo cada vez que se invoca, así que una
  instancia de Lake nueva no puede ver lo que escribió la
  anterior. Eso es justo lo que hace un reinicio real de
  proceso: la memoria del proceso viejo desaparece.
*/
cerrarLake();

const relecturaMemoria = await abrirLake({ adaptador: "memoria" });

await t(
  "tras 'reiniciar', el adaptador de memoria arranca vacío: el dato anterior se perdió",
  async () => {
    const total = await relecturaMemoria.adaptador.contar();
    return total === 0;
  }
);

cerrarLake();

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);
if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}
console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
