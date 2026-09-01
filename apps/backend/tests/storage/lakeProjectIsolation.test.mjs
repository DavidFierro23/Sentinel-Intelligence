// apps/backend/tests/storage/lakeProjectIsolation.test.mjs

/*
===========================================================
PRUEBA DE AISLAMIENTO PROYECTO/TENANT — SENTINEL-DATA-PERSISTENCE-01, §3
===========================================================

    node tests/storage/lakeProjectIsolation.test.mjs

Fixture propio, aislado en el directorio temporal del SO. No
toca `data/knowledge-lake` ni ningún expediente real.

QUÉ SE PONE A PRUEBA
-----------------------------------------------------------

La regla declarada en projectStore.js: la clave de entidad del
Lake es

    tenantId :: proyectoId :: tipoEntidad :: entidad

Dos proyectos con una entidad del MISMO nombre ("Juan Pérez")
deben producir dos registros completamente independientes: ni
`obtenerEventosProyecto` de uno debe ver los datos del otro, ni
sus claves de entidad deben coincidir.

Esta prueba también documenta el caso NO cubierto por esa
regla: `sourceUniverseStore.js` no lleva `proyectoId` en su
clave (es infraestructura compartida por diseño, según su
propio encabezado) y por tanto queda fuera del alcance de esta
prueba estructural — se deja constancia de ello en el reporte,
no se inventa un aislamiento donde el propio módulo declara que
no existe.
===========================================================
*/

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  abrirLake,
  cerrarLake,
  escribirEnLake,
  obtenerEventosProyecto
} from "../../services/knowledgeLake/lakeQuery.js";

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

const raiz = await mkdtemp(join(tmpdir(), "sentinel-lake-isolation-"));

cerrarLake();
await abrirLake({ adaptador: "fichero", raiz });

bloque("ISOLATION-1  misma entidad, dos proyectos distintos");

const A = await escribirEnLake(
  {
    tenantId: "sentinel-fixture",
    proyectoId: "proyecto-a",
    entidad: "candidato-juan-perez",
    tipoEntidad: "persona",
    fuente: "data-persistence-audit",
    linaje: { submotor: "SENTINEL-DATA-PERSISTENCE-01" },
    datos: { marcaDeProyecto: "A" }
  },
  { adaptador: "fichero", raiz }
);

const B = await escribirEnLake(
  {
    tenantId: "sentinel-fixture",
    proyectoId: "proyecto-b",
    entidad: "candidato-juan-perez",
    tipoEntidad: "persona",
    fuente: "data-persistence-audit",
    linaje: { submotor: "SENTINEL-DATA-PERSISTENCE-01" },
    datos: { marcaDeProyecto: "B" }
  },
  { adaptador: "fichero", raiz }
);

await t("las dos escrituras se aceptan", () => A.escrito && B.escrito);

await t("la misma entidad en dos proyectos produce dos claves distintas", () => {
  return A.claveEntidad !== B.claveEntidad;
});

await t("el evento del proyecto A trae SOLO su propio dato", async () => {
  const r = await obtenerEventosProyecto("proyecto-a", {
    adaptador: "fichero",
    raiz
  });
  return r.total === 1 && r.eventos[0].claveEntidad === A.claveEntidad;
});

await t("el evento del proyecto B trae SOLO su propio dato", async () => {
  const r = await obtenerEventosProyecto("proyecto-b", {
    adaptador: "fichero",
    raiz
  });
  return r.total === 1 && r.eventos[0].claveEntidad === B.claveEntidad;
});

await t("proyecto A no ve nada de proyecto B ni viceversa (0 fugas cross-project)", async () => {
  const rA = await obtenerEventosProyecto("proyecto-a", { adaptador: "fichero", raiz });
  const rB = await obtenerEventosProyecto("proyecto-b", { adaptador: "fichero", raiz });

  const aVeClaveDeB = rA.eventos.some((e) => e.claveEntidad === B.claveEntidad);
  const bVeClaveDeA = rB.eventos.some((e) => e.claveEntidad === A.claveEntidad);

  return !aVeClaveDeB && !bVeClaveDeA;
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

console.log(
  "NOTA DE ALCANCE: esta prueba cubre el aislamiento estructural del Knowledge\n" +
  "Lake (tenantId::proyectoId::tipoEntidad::entidad). NO cubre\n" +
  "territorial/sourceUniverseStore.js, que por diseño no lleva proyectoId en su\n" +
  "clave (es infraestructura compartida entre proyectos), ni el manejo de\n" +
  "observaciones legadas sin projectId en territorial/evidenceLedger.js. Ver\n" +
  "docs/SENTINEL-DATA-PERSISTENCE-01.md §7 y §10.\n"
);

process.exit(fail > 0 ? 1 : 0);
