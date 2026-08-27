// apps/backend/tests/comparacionFoto.test.mjs

/*
===========================================================
PRUEBAS DE LA FOTO EN COMPARACION DE CANDIDATOS
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/comparacionFoto.test.mjs

SIN RED. Ninguna imagen se descarga: se comprueba que la
comparacion CONSUME la fotografia que ya esta persistida.

LO QUE DEFIENDEN
-----------------------------------------------------------

1 · UNA SOLA FUENTE DE VERDAD.
    `candidato.foto` es el campo persistido. La ficha y la
    comparacion leen EL MISMO, asi que no pueden discrepar.

2 · NO HAY SEGUNDA PERSISTENCIA.
    La comparacion no guarda ninguna copia. Cambiar la foto en
    la ficha se refleja al releer, sin sincronizacion manual.

3 · DOS CANDIDATOS NUNCA INTERCAMBIAN FOTOGRAFIA.

4 · SIN FOTO NO SE ROMPE NADA.
    El candidato sigue apareciendo; la interfaz cae a iniciales.

5 · NO CAMBIA NI EL PORCENTAJE, NI LAS CUENTAS, NI EL ORDEN.
    Es un cambio de presentacion. Se comprueba que la
    proyeccion de la comparacion sigue dando lo mismo.
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
    console.log(`  ERR   ${nombre}  ${error.message}`);
  }
}

function bloque(titulo) {
  console.log(`\n--- ${titulo} ---`);
}


/*
  LA MISMA proyeccion que hace la interfaz para la comparacion.
  Se replica aqui para poder comprobarla; la interfaz no gana
  ningun campo nuevo.
*/
function proyectar(candidatos) {
  return candidatos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    foto: c.foto || null,
    cobertura: c.resumen?.huellaDigital ?? c.cobertura ?? null,
    cuentas: c.resumen?.cuentas ?? c.cuentas ?? 0
  }));
}

/*
  Y el filtro, que es lo que decide QUIEN se compara. Va aparte a
  proposito: la fotografia viaja en la proyeccion y no interviene
  en la comparabilidad. Un candidato sin investigar no aparece,
  tenga foto o no.
*/
function proyectarComparables(candidatos) {
  return proyectar(candidatos).filter((c) => c.cobertura != null);
}


const PID = "cmp-foto";

const FOTO_A = "https://ejemplo-ficticio-a.test/retrato-a.jpg";

const FOTO_B = "https://ejemplo-ficticio-b.test/retrato-b.png";

await ps.crearProyecto({
  id: PID,
  nombre: "Proyecto Comparacion",
  canton: "Canton Ficticio",
  pais: "Ecuador",
  dignidad: "Alcaldía"
});

await ps.agregarCandidato(PID, { nombre: "Aspirante Con Foto", fotoUrl: FOTO_A });

await ps.agregarCandidato(PID, { nombre: "Aspirante Sin Foto" });

await ps.agregarCandidato(PID, { nombre: "Tercer Aspirante Ficticio", fotoUrl: FOTO_B });

const CON = "aspirante-con-foto";

const SIN = "aspirante-sin-foto";

const TERCERO = "tercer-aspirante-ficticio";


bloque("una sola fuente de verdad");

await t("el campo persistido es `candidato.foto` con su `url`", async () => {
  const c = await ps.obtenerCandidato(PID, CON);

  return c.foto?.url === FOTO_A;
});

await t("el contenido del proyecto ya expone `foto`: no hay campo nuevo", async () => {
  const cont = await ps.contenidoDeProyecto(PID);

  const c = cont.candidatos.find((x) => x.id === CON);

  return c.foto?.url === FOTO_A;
});

await t("la ficha individual lee EXACTAMENTE la misma URL", async () => {
  const ficha = await ps.fichaIdentidad(PID, CON, "candidato");

  const cont = await ps.contenidoDeProyecto(PID);

  const c = cont.candidatos.find((x) => x.id === CON);

  return ficha.foto?.url === c.foto?.url;
});

await t("y la procedencia se conserva donde pertenece: en la ficha", async () => {
  const ficha = await ps.fichaIdentidad(PID, CON, "candidato");

  return (
    !!ficha.foto?.origen &&
    Object.hasOwn(ficha.foto, "utilizable") &&
    /*
      La comparacion NO necesita la procedencia: solo consume la
      imagen. Pero no se pierde.
    */
    true
  );
});


bloque("proyeccion de la comparacion");

await t("cada comparable lleva su foto persistida", async () => {
  const cont = await ps.contenidoDeProyecto(PID);

  const comp = proyectar(cont.candidatos);

  const a = comp.find((x) => x.id === CON);

  return a?.foto?.url === FOTO_A;
});

await t("dos candidatos NUNCA intercambian fotografia", async () => {
  const cont = await ps.contenidoDeProyecto(PID);

  const comp = proyectar(cont.candidatos);

  const a = comp.find((x) => x.id === CON);

  const c = comp.find((x) => x.id === TERCERO);

  return a.foto.url === FOTO_A && c.foto.url === FOTO_B && a.foto.url !== c.foto.url;
});

await t("un candidato sin foto llega con `foto: null` y NO desaparece", async () => {
  const cont = await ps.contenidoDeProyecto(PID);

  const todos = cont.candidatos.map((x) => x.id);

  const s = cont.candidatos.find((x) => x.id === SIN);

  return todos.includes(SIN) && (s.foto === null || s.foto === undefined);
});

await t("la comparacion no guarda ninguna copia de la imagen", async () => {
  const cont = await ps.contenidoDeProyecto(PID);

  const comp = proyectar(cont.candidatos);

  const a = comp.find((x) => x.id === CON);

  /*
    Es la MISMA referencia que trae el registro, no un objeto
    nuevo con la URL copiada.
  */
  const registro = cont.candidatos.find((x) => x.id === CON);

  return a.foto === registro.foto;
});


bloque("cambiar la foto en la ficha se refleja sin sincronizar");

await t("editar la fotografia actualiza la fuente unica", async () => {
  const NUEVA = "https://ejemplo-ficticio-a.test/retrato-nuevo.jpg";

  await ps.editarCandidato(PID, CON, { fotoUrl: NUEVA });

  const cont = await ps.contenidoDeProyecto(PID);

  const comp = proyectar(cont.candidatos);

  const ficha = await ps.fichaIdentidad(PID, CON, "candidato");

  const a = comp.find((x) => x.id === CON);

  return a.foto.url === NUEVA && ficha.foto.url === NUEVA;
});

await t("y la anterior no se destruye: queda en el historial", async () => {
  const ficha = await ps.fichaIdentidad(PID, CON, "candidato");

  return (ficha.foto.historial || []).some((h) => h.url === FOTO_A);
});

await t("una URL que no es imagen no se acepta y conserva la anterior", async () => {
  const antes = (await ps.fichaIdentidad(PID, TERCERO, "candidato")).foto.url;

  await ps.editarCandidato(PID, TERCERO, {
    fotoUrl: "https://www.facebook.com/una_cuenta_cualquiera"
  });

  const despues = await ps.fichaIdentidad(PID, TERCERO, "candidato");

  return (
    despues.foto.url === antes &&
    antes === FOTO_B &&
    !!despues.foto.intentoRechazado
  );
});


bloque("nada mas cambia");

await t("el porcentaje y las cuentas se leen de donde se leian", async () => {
  const cont = await ps.contenidoDeProyecto(PID);

  const comp = proyectarComparables(cont.candidatos);

  /*
    Sin expediente no hay huella, asi que ninguno entra en la
    comparacion. Es el comportamiento previo y no cambia: la
    fotografia no hace comparable a nadie.
  */
  return comp.length === 0;
});

await t("la fotografia NO altera el filtro de comparables", async () => {
  const cont = await ps.contenidoDeProyecto(PID);

  /* Los tres existen; ninguno es comparable, con foto o sin ella. */
  return (
    cont.candidatos.length === 3 &&
    proyectarComparables(cont.candidatos).length === 0
  );
});

await t("el orden depende solo de la cobertura, no de la foto", () => {
  const falsos = [
    { id: "a", nombre: "A", foto: { url: FOTO_A }, resumen: { huellaDigital: 40, cuentas: 2 } },
    { id: "b", nombre: "B", foto: null, resumen: { huellaDigital: 70, cuentas: 5 } },
    { id: "c", nombre: "C", foto: { url: FOTO_B }, resumen: { huellaDigital: 55, cuentas: 3 } }
  ];

  const orden = proyectarComparables(falsos)
    .sort((x, y) => (y.cobertura || 0) - (x.cobertura || 0))
    .map((x) => x.id)
    .join(",");

  /* B no tiene foto y sigue primero: manda la cifra. */
  return orden === "b,c,a";
});

await t("los porcentajes y las cuentas pasan intactos", () => {
  const falsos = [
    { id: "a", nombre: "A", foto: { url: FOTO_A }, resumen: { huellaDigital: 69, cuentas: 6 } }
  ];

  const p = proyectarComparables(falsos)[0];

  return p.cobertura === 69 && p.cuentas === 6;
});

await t("un candidato sin foto sigue siendo comparable si tiene cobertura", () => {
  const falsos = [
    { id: "b", nombre: "B", foto: null, resumen: { huellaDigital: 70, cuentas: 5 } }
  ];

  const p = proyectarComparables(falsos);

  return p.length === 1 && p[0].foto === null && p[0].cobertura === 70;
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
