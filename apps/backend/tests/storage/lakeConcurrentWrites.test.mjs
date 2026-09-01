// apps/backend/tests/storage/lakeConcurrentWrites.test.mjs

/*
===========================================================
PRUEBA DE CONCURRENCIA — SENTINEL-DATA-PERSISTENCE-01, §9
===========================================================

    node tests/storage/lakeConcurrentWrites.test.mjs

Fixture propio, aislado en el directorio temporal del SO. No
toca `data/knowledge-lake` ni ningún expediente real.

QUÉ SE PONE A PRUEBA
-----------------------------------------------------------

`crearEscritor().escribir()` (lakeWriter.js) hace, para cada
llamada:

    1. lee la última versión de la entidad en el índice
    2. calcula versión = última.version + 1
    3. calcula el hash
    4. anexa al adaptador
    5. indexa

Entre el paso 1 y el paso 5 hay varios `await`. Si dos
llamadas a `escribir()` para la MISMA entidad se lanzan sin
esperarse la una a la otra (`Promise.all`), ambas pueden leer
la misma "última versión" en el paso 1 antes de que ninguna
haya terminado de indexar, y las dos calcularían el mismo
número de versión siguiente.

Esta prueba no asume el resultado: lanza N escrituras
concurrentes contra la misma clave de entidad y CLASIFICA lo
que de verdad ocurrió, contando versiones duplicadas o huecos
en la secuencia. El veredicto (SEGURO / RIESGO) se imprime al
final para que quede documentado con evidencia, no con
suposición.
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

const raiz = await mkdtemp(join(tmpdir(), "sentinel-lake-concurrency-"));

const CONTEXTO = {
  tenantId: "sentinel-fixture",
  proyectoId: "fixture-concurrencia",
  entidad: "candidato-fixture-concurrente",
  tipoEntidad: "persona",
  fuente: "data-persistence-audit",
  linaje: { submotor: "SENTINEL-DATA-PERSISTENCE-01" }
};

const N = 20;

cerrarLake();
await abrirLake({ adaptador: "fichero", raiz });

bloque(`CONCURRENCY-1  ${N} escrituras concurrentes sobre la MISMA entidad`);

/*
  Cada escritura trae un `datos` distinto para que ninguna se
  omita por "sin cambios respecto a la versión anterior".
*/
const resultados = await Promise.all(
  Array.from({ length: N }, (_, i) =>
    escribirEnLake(
      { ...CONTEXTO, datos: { intento: i } },
      { adaptador: "fichero", raiz }
    )
  )
);

const aceptadas = resultados.filter((r) => r.escrito);

await t("todas las escrituras concurrentes son aceptadas por el escritor", () => {
  return aceptadas.length === N;
});

const versiones = aceptadas.map((r) => r.version).sort((a, b) => a - b);
const versionesUnicas = new Set(versiones);

const huecos = [];
for (let v = 1; v <= Math.max(...versiones, 0); v += 1) {
  if (!versionesUnicas.has(v)) huecos.push(v);
}

const duplicadas = versiones.length - versionesUnicas.size;

console.log(`\n  versiones asignadas: [${versiones.join(", ")}]`);
console.log(`  versiones únicas: ${versionesUnicas.size} de ${versiones.length} escrituras`);
console.log(`  huecos en la secuencia: [${huecos.join(", ")}]`);

/*
  Se lee también el fichero en disco directamente (vía un Lake
  reabierto) para confirmar cuántas LÍNEAS llegaron a existir
  de verdad, más allá de lo que cada llamada creyó haber
  escrito.
*/
cerrarLake();
const relectura = await abrirLake({ adaptador: "fichero", raiz });
const lineasEnDisco = await relectura.adaptador.contar();

console.log(`  líneas realmente anexadas en disco: ${lineasEnDisco}`);

const veredicto =
  duplicadas === 0 && huecos.length === 0 && lineasEnDisco === N
    ? "SEGURO"
    : lineasEnDisco === N && (duplicadas > 0 || huecos.length > 0)
      ? "RIESGO (versiones duplicadas o con huecos: dos escrituras concurrentes pudieron leer la misma última versión antes de indexar)"
      : "RIESGO (se perdieron líneas: menos registros en disco que escrituras aceptadas)";

console.log(`\n  VEREDICTO DE CONCURRENCIA INTRA-PROCESO: ${veredicto}`);

/*
  Esta prueba documenta el comportamiento observado; no impone
  un aprobado/reprobado sobre si hubo o no colisión de
  versiones, porque el resultado depende del entrelazado real
  del event loop en esta corrida y es evidencia, no una
  garantía de reproducibilidad byte a byte. Lo que sí se exige
  es que ninguna escritura se pierda silenciosamente en disco.
*/
await t("ninguna escritura aceptada se pierde: todas llegan a quedar en disco", () => {
  return lineasEnDisco === aceptadas.length;
});

cerrarLake();
await rm(raiz, { recursive: true, force: true });

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);
if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}
console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
