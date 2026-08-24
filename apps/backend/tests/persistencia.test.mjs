// apps/backend/tests/persistencia.test.mjs

/*
===========================================================
PRUEBAS DE PERSISTENCIA DEL PROYECTO (T7)
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/persistencia.test.mjs

SIN RED, SIN CUOTA Y SIN TOCAR LOS EXPEDIENTES REALES.

El adaptador se fuerza a `memoria` ANTES de importar el store:
el Knowledge Lake es append-only y de un test no tiene por que
quedar rastro en los expedientes del analista. Si esta prueba
escribiera en data/knowledge-lake, cada ejecucion ensuciaria
datos de trabajo, y un test que ensucia lo que vigila deja de
ser fiable.

El propio test comprueba que el aislamiento funciona: si por
cualquier motivo estuviera escribiendo en el lake de disco, la
primera comprobacion lo delata.

QUE SE PROTEGE
-----------------------------------------------------------

Crear un proyecto es crear un EXPEDIENTE PERSISTENTE. Lo que
el analista escribe —territorio, dignidad, candidatos, cuentas
de referencia— tiene que sobrevivir a recargar la pagina, y
recargar NO puede disparar una investigacion nueva.

Y en particular (L-2): la cuenta de referencia debe conservar
su procedencia. Una cuenta que puso una persona no puede
quedar guardada como si Sentinel la hubiera verificado.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const ps = await import("../services/projects/projectStore.js");

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

/*
===========================================================
T7.0 — EL AISLAMIENTO
===========================================================
*/

bloque("T7.0  el test no toca los expedientes reales");

await t("el lake arranca vacío: es en memoria, no el de disco", async () => {
  /*
    Si esto falla, la prueba esta corriendo contra
    data/knowledge-lake y hay que detenerla antes de que
    escriba: el resto del test crea proyectos.
  */
  const previos = await ps.listarProyectos();

  return previos.length === 0;
});

/*
===========================================================
T7.1 — EL EXPEDIENTE SOBREVIVE
===========================================================
*/

bloque("T7.1  lo que el analista escribe se conserva");

const PROYECTO = {
  nombre: "Alcaldía de Cuenca 2027",
  canton: "Cuenca",
  provincia: "Azuay",
  pais: "Ecuador",
  dignidad: "Alcalde"
};

const creado = await ps.crearProyecto(PROYECTO);

const pid = creado?.proyecto?.id;

await t("crear un proyecto devuelve un identificador", () => {
  return typeof pid === "string" && pid.length > 0;
});

await t("el proyecto se puede volver a leer por su id", async () => {
  const p = await ps.obtenerProyecto(pid);

  return Boolean(p) && p.nombre === PROYECTO.nombre;
});

await t("conserva territorio y dignidad tal como se escribieron", async () => {
  const p = await ps.obtenerProyecto(pid);

  return (
    p.canton === "Cuenca" &&
    p.provincia === "Azuay" &&
    p.pais === "Ecuador" &&
    p.dignidad === "Alcalde"
  );
});

await t("aparece en la lista de proyectos activos", async () => {
  const lista = await ps.listarProyectos();

  return lista.some((p) => p.id === pid && p.estado === "activo");
});

/*
===========================================================
T7.2 — LA PROCEDENCIA DE LA CUENTA DE REFERENCIA
===========================================================

Es la mitad de L-2 que vive en el almacenamiento: la marca de
"quien puso esto" tiene que persistir, no solo existir en
memoria durante una investigacion.
*/

bloque("T7.2  la cuenta de referencia guarda de quién vino");

const cand = await ps.agregarCandidato(pid, {
  nombre: "Pedro Palacios",
  nivel: "cantonal",
  facebook: "https://www.facebook.com/PedroPalaciosU",
  x: "https://x.com/pedropalaciosu"
});

const cid = cand?.candidato?.id;

await t("el candidato se guarda en el proyecto", async () => {
  const contenido = await ps.contenidoDeProyecto(pid);

  return contenido.candidatos.some((c) => c.id === cid);
});

await t("las dos URLs quedan como cuentas de referencia", async () => {
  const contenido = await ps.contenidoDeProyecto(pid);

  const c = contenido.candidatos.find((x) => x.id === cid);

  return (c.cuentasReferencia || []).length === 2;
});

await t("cada una declara origen: analista", async () => {
  const contenido = await ps.contenidoDeProyecto(pid);

  const c = contenido.candidatos.find((x) => x.id === cid);

  return c.cuentasReferencia.every((r) => r.origen === "analista");
});

await t("NINGUNA queda marcada como verificada por Sentinel", async () => {
  /*
    La confusion que esto impide: presentar como hallazgo
    verificado algo que decidio una persona. Sentinel no la ha
    comprobado, y el expediente tiene que decirlo.
  */
  const contenido = await ps.contenidoDeProyecto(pid);

  const c = contenido.candidatos.find((x) => x.id === cid);

  return c.cuentasReferencia.every(
    (r) => r.verificadaPorSentinel === false && r.tipo === "cuenta_referencia"
  );
});

/*
===========================================================
T7.3 — LEER NO INVESTIGA
===========================================================
*/

bloque("T7.3  leer el expediente no dispara investigaciones");

await t("leer el contenido no consume proveedores ni red", async () => {
  /*
    Recargar la pagina llama a estas funciones. Si alguna
    disparara el Discovery, cada Ctrl+R gastaria cuota de
    SerpAPI. Se comprueba por tiempo: una lectura de
    almacenamiento es inmediata; una investigacion no lo es.
  */
  const t0 = Date.now();

  await ps.contenidoDeProyecto(pid);
  await ps.listarProyectos();
  await ps.obtenerProyecto(pid);

  return Date.now() - t0 < 1000;
});

await t("el expediente no trae resultados de investigación inventados", async () => {
  /*
    Un proyecto recien creado no ha investigado nada. Si
    apareciera algun expediente, seria fabricado.
  */
  const contenido = await ps.contenidoDeProyecto(pid);

  const c = contenido.candidatos.find((x) => x.id === cid);

  const investigaciones = c.investigaciones || c.expedientes || [];

  return investigaciones.length === 0;
});

/*
===========================================================
T7.4 — CICLO DE VIDA: NADA SE DESTRUYE
===========================================================
*/

bloque("T7.4  archivar y eliminar no destruyen el expediente");

await t("archivar lo saca de la lista activa", async () => {
  await ps.cambiarEstadoProyecto(pid, "archivado");

  const activos = await ps.listarProyectos();

  return !activos.some((p) => p.id === pid);
});

await t("… pero sigue existiendo y conserva sus candidatos", async () => {
  const contenido = await ps.contenidoDeProyecto(pid);

  return (
    contenido.proyecto.estado === "archivado" &&
    contenido.candidatos.some((c) => c.id === cid)
  );
});

await t("se puede recuperar", async () => {
  await ps.cambiarEstadoProyecto(pid, "activo");

  const activos = await ps.listarProyectos();

  return activos.some((p) => p.id === pid);
});

await t("eliminar es lógico: los datos siguen ahí", async () => {
  /*
    Borrado logico a proposito. Un expediente de trabajo no se
    destruye por un clic; la promesa de que "se puede recuperar"
    tiene que ser cierta.
  */
  await ps.cambiarEstadoProyecto(pid, "eliminado");

  const activos = await ps.listarProyectos();

  const contenido = await ps.contenidoDeProyecto(pid);

  return (
    !activos.some((p) => p.id === pid) &&
    contenido.proyecto.estado === "eliminado" &&
    contenido.candidatos.length > 0
  );
});

await t("renombrar no cambia el id ni desconecta el contenido", async () => {
  /*
    El id es la clave con la que el Lake guarda candidatos y
    expedientes. Si cambiara al renombrar, el proyecto perderia
    todo su contenido.
  */
  await ps.cambiarEstadoProyecto(pid, "activo");

  const r = await ps.renombrarProyecto(pid, "Alcaldía de Cuenca — revisión");

  const contenido = await ps.contenidoDeProyecto(pid);

  return (
    r.renombrado === true &&
    contenido.proyecto.id === pid &&
    contenido.proyecto.nombre === "Alcaldía de Cuenca — revisión" &&
    contenido.proyecto.nombreAnterior === PROYECTO.nombre &&
    contenido.candidatos.some((c) => c.id === cid)
  );
});

/* ---------------------------------------------------------
   RESULTADO
--------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
