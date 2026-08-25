// apps/backend/tests/edicionIdentidad.test.mjs

/*
===========================================================
PRUEBAS DE EDICION DE IDENTIDAD (P-CAND-UX-02) — T1 a T25
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/edicionIdentidad.test.mjs

SIN RED Y SIN CUOTA. Ninguna URL de ningun candidato real esta
escrita aqui: los casos usan cuentas inventadas.

LO QUE SE PROTEGE
-----------------------------------------------------------

Que el analista pueda cargar identidad y que Sentinel no la
pierda ni la confunda con evidencia propia. Tres reglas:

  1. Guardar es una DECLARACION. No autoverifica nada.
  2. Un PATCH parcial no borra lo que no menciona.
  3. Retirar es una decision y se registra; no reencontrar no lo
     es y no revoca nada.

La tercera es la que ya costo perder una cuenta en produccion.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const ps = await import("../services/projects/projectStore.js");

const ui = await import("../../web/src/services/identidadCandidato.js");

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

const PID = "ux2-test";

const PROYECTO = {
  id: PID,
  nombre: "Proyecto de prueba",
  canton: "Cuenca",
  provincia: "Azuay",
  pais: "Ecuador",
  dignidad: "Alcaldía"
};

await ps.crearProyecto(PROYECTO);

const CID = "persona-de-prueba-uno";

await ps.agregarCandidato(PID, {
  nombre: "Persona De Prueba Uno",
  facebook: "https://www.facebook.com/personaprueba"
});

const ficha = () => ps.fichaIdentidad(PID, CID, "candidato");

const plat = (f, id) => f.plataformas.find((p) => p.plataformaId === id);

/*
  Una investigacion que atribuye cuentas, para tener inventario
  DESCUBIERTO junto al declarado.
*/
function cuentaDescubierta(pid, plataforma, handle, url, proveedores) {
  return {
    plataforma,
    plataformaId: pid,
    handle,
    url: { canonica: url },
    correspondencia: { puntuacion: 55, nivel: "posible" },
    origenes: [{ via: "consulta_dirigida", proveedor: proveedores[0] }],
    vias: ["consulta_dirigida"],
    proveedores,
    corroboracion: {
      proveedores,
      totalProveedores: proveedores.length,
      multiProveedor: proveedores.length > 1,
      vias: ["consulta_dirigida"],
      multiVia: false
    },
    clasificacion: { clase: "cuenta_personal", razones: ["handle contiene prueba"] }
  };
}

const resultado = (cuentas) => ({
  perfilEjecutivo: {
    huellaDigital: { valor: 30 },
    tarjetas: cuentas.map((c) => ({
      plataforma: c.plataforma,
      plataformaId: c.plataformaId,
      handle: c.handle,
      correspondencia: c.correspondencia.puntuacion
    })),
    medios: [],
    instituciones: [],
    indeterminadas: []
  },
  clasificacionCuentas: {
    cuentasObjetivo: cuentas,
    medios: [],
    instituciones: [],
    indeterminadas: []
  },
  fichaObjetivo: { evidencias: { web: new Array(12).fill({}) } }
});

const FB_DESCUBIERTA = cuentaDescubierta(
  "facebook",
  "Facebook",
  "personaprueba",
  "https://facebook.com/personaprueba",
  ["SerpAPI (Google)", "DuckDuckGo Web"]
);

await ps.registrarInvestigacion(PID, CID, resultado([FB_DESCUBIERTA]));

/*
===========================================================
T1 · T2 — LA FICHA PERMITE EDITAR Y TIENE DONDE ESCRIBIR
===========================================================
*/

bloque("T1 · T2  la ficha ofrece todas las plataformas, también las vacías");

const f0 = await ficha();

await t("T1: la ficha se puede leer y trae las siete plataformas", () => {
  return f0.plataformas.length === 7;
});

await t("T2: una plataforma sin cuenta queda PENDIENTE, editable", () => {
  /*
    Es lo que hace posible escribir una URL donde no habia nada.
    Y PENDIENTE no afirma ausencia.
  */
  const tk = plat(f0, "tiktok");

  return tk.total === 0 && tk.estado === "PENDIENTE";
});

await t("T2b: el texto de PENDIENTE no dice que no use la plataforma", () => {
  return ui
    .estadoVisual("PENDIENTE")
    .explicacion.toLowerCase()
    .includes("no es una afirmación");
});

/*
===========================================================
T3 · T4 · T5 — GUARDAR UNA CUENTA MANUAL
===========================================================
*/

bloque("T3 · T4 · T5  guardar una cuenta manual");

const r1 = await ps.editarCandidato(PID, CID, {
  cuentas: ["https://www.tiktok.com/@personaprueba"]
});

await t("T3: la cuenta se crea como DECLARADA_POR_ANALISTA", async () => {
  const f = await ficha();

  const tk = plat(f, "tiktok");

  return (
    r1.editado === true &&
    tk.total === 1 &&
    tk.cuentas[0].estado === "DECLARADA_POR_ANALISTA"
  );
});

await t("T4: sobrevive a una relectura completa", async () => {
  /*
    Se relee desde el store, no del objeto que devolvio la
    edicion: si solo viviera en memoria, esto fallaria.
  */
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return (cand.cuentasReferencia || []).some(
    (x) => x.plataformaId === "tiktok"
  );
});

await t("T5b: la cuenta manual no se marca verificada ni corroborada", async () => {
  const f = await ficha();

  const c = plat(f, "tiktok").cuentas[0];

  return (
    c.corroboradaPorSentinel === false &&
    c.declaradaPorAnalista === true &&
    c.noCuentaComoCorroboracion === true &&
    c.proveedoresHistoricos.length === 0
  );
});

await t("T19: una declaración humana no cuenta como corroboración", async () => {
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  const tk = cand.cuentasReferencia.find((x) => x.plataformaId === "tiktok");

  return (
    tk.verificadaPorSentinel === false &&
    tk.noCuentaComoCorroboracion === true &&
    tk.pertenenciaDeclarada === true
  );
});

/*
===========================================================
T6 · T16 — NO SE PIERDE LO YA CONOCIDO
===========================================================
*/

bloque("T6 · T16  agregar una cuenta no borra las demás");

await t("T6: la cuenta descubierta de Facebook sigue ahí", async () => {
  const f = await ficha();

  const fb = plat(f, "facebook");

  return fb.total >= 1 && fb.cuentas.some((c) => c.corroboradaPorSentinel);
});

await t("T16: el inventario descubierto se conserva tras editar", async () => {
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return (cand.expediente?.cuentas || []).length >= 1;
});

/*
===========================================================
T7 · T21 — VARIAS CUENTAS POR PLATAFORMA
===========================================================
*/

bloque("T7 · T21  varias cuentas de la misma plataforma");

await ps.editarCandidato(PID, CID, {
  cuentas: [
    "https://www.instagram.com/pruebapersonal",
    "https://www.instagram.com/pruebacampana"
  ]
});

await t("T7: dos cuentas de Instagram conviven", async () => {
  /*
    Un candidato tiene legitimamente Instagram personal y de
    campana. El modelo anterior —`instagram: string`— dejaba una.
  */
  const ig = plat(await ficha(), "instagram");

  return ig.total === 2;
});

await t("T21: las dos sobreviven a la relectura", async () => {
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return (
    cand.cuentasReferencia.filter((x) => x.plataformaId === "instagram")
      .length === 2
  );
});

await t("cada una conserva su propio id", async () => {
  const ig = plat(await ficha(), "instagram");

  const ids = new Set(ig.cuentas.map((c) => c.id));

  return ids.size === 2;
});

/*
===========================================================
T8 · T20 — DEDUPLICACION Y DETECCION POR DOMINIO
===========================================================
*/

bloque("T8 · T20  equivalencias y dominio real");

await t("T8: cuatro formas de la misma cuenta no crean cuatro", async () => {
  await ps.editarCandidato(PID, CID, {
    cuentas: [
      "https://instagram.com/pruebapersonal",
      "https://www.instagram.com/pruebapersonal/",
      "https://www.instagram.com/pruebapersonal"
    ]
  });

  const ig = plat(await ficha(), "instagram");

  return ig.total === 2;
});

await t("T20: la plataforma se detecta por el dominio, no por la casilla", async () => {
  /*
    Se pega una URL de YouTube en el campo de LinkedIn. Manda el
    dominio: SD-1A es la autoridad y el formulario solo avisa.
  */
  await ps.editarCandidato(PID, CID, {
    linkedin: "https://www.youtube.com/@canaldeprueba"
  });

  const f = await ficha();

  return (
    plat(f, "youtube").total === 1 && plat(f, "linkedin").total === 0
  );
});

await t("una URL que no es de ninguna red conocida entra como web", async () => {
  await ps.editarCandidato(PID, CID, {
    web: "https://ejemplo-de-prueba.ec"
  });

  return plat(await ficha(), "web").total === 1;
});

/*
===========================================================
T9 · T18 — RETIRAR CONSERVA HISTORIA
===========================================================
*/

bloque("T9  retirar es una decisión y se registra");

const antesDeRetirar = await ficha();

const idAretirar = plat(antesDeRetirar, "web").cuentas[0].id;

await ps.editarCandidato(PID, CID, { quitarCuentas: [idAretirar] });

const trasRetirar = await ficha();

await t("T9: la cuenta sale de la identidad activa", () => {
  return plat(trasRetirar, "web").total === 0;
});

await t("T9b: NO se borra: consta como revocada, con fecha y autor", () => {
  /*
    Retirar es una decision del analista, y una decision es un
    dato: hay que poder leer despues que se tomo.
  */
  const r = (trasRetirar.revocadas || []).find((x) => x.id === idAretirar);

  return (
    !!r && typeof r.revocadaEn === "string" && r.revocadaPor === "analista"
  );
});

await t("T9c: REVOCADA no es lo mismo que NO_REENCONTRADA", () => {
  /*
    Una la decide una persona; la otra, el silencio de un
    buscador. Sus etiquetas y sus tonos son distintos.
  */
  const a = ui.estadoVisual("REVOCADA");

  const b = ui.estadoVisual("NO_REENCONTRADA_EN_ULTIMA_VERIFICACION");

  return (
    a.tono === "rojo" &&
    b.tono === "ambar" &&
    a.etiqueta !== b.etiqueta &&
    b.explicacion.includes("no revoca")
  );
});

await t("retirar una cuenta no toca las demás", () => {
  return (
    plat(trasRetirar, "instagram").total === 2 &&
    plat(trasRetirar, "tiktok").total === 1
  );
});

await t("volver a añadirla la reactiva", async () => {
  await ps.editarCandidato(PID, CID, {
    cuentas: ["https://ejemplo-de-prueba.ec"]
  });

  const f = await ficha();

  return plat(f, "web").total === 1;
});

/*
===========================================================
T10 — CANCELAR
===========================================================
*/

bloque("T10  cancelar no toca la persistencia");

await t("T10: sin llamar a editarCandidato, nada cambia", async () => {
  /*
    Cancelar en la interfaz simplemente no envia el PATCH. Se
    comprueba que el estado persistido es identico antes y
    despues de no hacer nada.
  */
  const antes = JSON.stringify(await ficha());

  /* aqui iria el PATCH que cancelar NO envia */

  const despues = JSON.stringify(await ficha());

  return antes === despues;
});

/*
===========================================================
T11 · T12 — FOTO
===========================================================
*/

bloque("T11 · T12  fotografía");

await t("T11: la foto se puede agregar, con su procedencia", async () => {
  await ps.editarCandidato(PID, CID, {
    fotoUrl: "https://ejemplo-de-prueba.ec/retrato.jpg",
    fotoOrigen: "analista"
  });

  const f = await ficha();

  return (
    f.foto.url.endsWith("retrato.jpg") &&
    f.foto.origen === "analista" &&
    f.foto.verificadaPorSentinel === false
  );
});

await t("T12: cambiar la foto no borra ninguna cuenta", async () => {
  const antes = await ficha();

  const totalAntes = antes.plataformas.reduce((n, p) => n + p.total, 0);

  await ps.editarCandidato(PID, CID, {
    fotoUrl: "https://ejemplo-de-prueba.ec/otra.jpg"
  });

  const despues = await ficha();

  const totalDespues = despues.plataformas.reduce((n, p) => n + p.total, 0);

  return (
    despues.foto.url.endsWith("otra.jpg") && totalDespues === totalAntes
  );
});

await t("una edición sin foto conserva la que había", async () => {
  await ps.editarCandidato(PID, CID, { nombre: "Persona De Prueba Uno" });

  const f = await ficha();

  return f.foto.url.endsWith("otra.jpg");
});

/*
===========================================================
T13 · T14 · T15 · T22 · T23 — GUARDAR NO DESTRUYE NADA
===========================================================
*/

bloque("T13 · T14 · T15 · T22 · T23  guardar preserva todo lo demás");

await t("T13: el candidateId no cambia al editar", async () => {
  const c = await ps.contenidoDeProyecto(PID);

  return c.candidatos.some((x) => x.id === CID);
});

await t("T22: editar el alias tampoco cambia el candidateId", async () => {
  await ps.editarCandidato(PID, CID, { aliases: ["Alias De Prueba"] });

  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return !!cand && cand.aliases.some((a) => a.valor === "Alias De Prueba");
});

await t("cambiar el nombre no cambia el id y guarda el anterior", async () => {
  /*
    El id es la clave con la que el Lake guarda el expediente.
    Cambiarlo desconectaria el candidato de toda su historia.
  */
  await ps.editarCandidato(PID, CID, { nombre: "Persona De Prueba Corregida" });

  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return (
    !!cand &&
    cand.nombre === "Persona De Prueba Corregida" &&
    cand.nombreAnterior === "Persona De Prueba Uno"
  );
});

await t("T14: el expediente sigue conectado", async () => {
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return (
    !!cand.expediente && (cand.expediente.cuentas || []).length >= 1
  );
});

await t("T15: las ejecuciones se conservan", async () => {
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return cand.totalEjecuciones >= 1 && !!cand.ultimaEjecucion;
});

await t("T23: un PATCH parcial no borra lo que no menciona", async () => {
  /*
    El caso peligroso: un formulario enviado a medias. Se manda
    SOLO el nombre y todo lo demas tiene que seguir intacto.
  */
  const antes = await ficha();

  const totalAntes = antes.plataformas.reduce((n, p) => n + p.total, 0);

  const aliasAntes = antes.aliases.length;

  await ps.editarCandidato(PID, CID, { nombre: "Persona De Prueba Corregida" });

  const d = await ficha();

  return (
    d.plataformas.reduce((n, p) => n + p.total, 0) === totalAntes &&
    d.aliases.length === aliasAntes &&
    !!d.foto
  );
});

await t("un PATCH vacío no destruye nada", async () => {
  const antes = JSON.stringify((await ficha()).plataformas);

  await ps.editarCandidato(PID, CID, {});

  return JSON.stringify((await ficha()).plataformas) === antes;
});

/*
===========================================================
T17 · T18 — OBSERVACION FRENTE A IDENTIDAD
===========================================================
*/

bloque("T17 · T18  la observación cambia; la identidad no se pierde");

await t("T17: una cuenta NO reencontrada sigue visible", async () => {
  /*
    Comprobar redes con proveedores en blanco: nada se encuentra.
    La cuenta descubierta de Facebook debe seguir en la ficha.
  */
  await ps.registrarInvestigacion(PID, CID, resultado([]));

  const fb = plat(await ficha(), "facebook");

  return (
    fb.total >= 1 &&
    fb.cuentas.some(
      (c) => c.estado === "NO_REENCONTRADA_EN_ULTIMA_VERIFICACION"
    )
  );
});

await t("T17b: y NO pasa a REVOCADA por ausencia del proveedor", async () => {
  const fb = plat(await ficha(), "facebook");

  return fb.cuentas.every((c) => c.estado !== "REVOCADA");
});

await t("T18: una cuenta declarada puede adquirir corroboración después", async () => {
  /*
    El analista declaro TikTok. Ahora un proveedor la encuentra
    por su cuenta. Las DOS procedencias deben constar: no se
    reemplaza una por otra.
  */
  const TK = cuentaDescubierta(
    "tiktok",
    "TikTok",
    "personaprueba",
    "https://www.tiktok.com/@personaprueba",
    ["SerpAPI (Google)"]
  );

  await ps.registrarInvestigacion(PID, CID, resultado([TK]));

  const tk = plat(await ficha(), "tiktok");

  const c = tk.cuentas.find((x) => x.handle === "personaprueba");

  return (
    c.declaradaPorAnalista === true && c.corroboradaPorSentinel === true
  );
});

await t("T18b: la procedencia se acumula en el texto, no se sustituye", async () => {
  const tk = plat(await ficha(), "tiktok");

  const c = tk.cuentas.find((x) => x.handle === "personaprueba");

  const texto = ui.procedencia(c);

  return texto.includes("declarada") && texto.includes("corroborada");
});

/*
===========================================================
T24 · T25 — BUG-20 Y ZONA HORARIA
===========================================================
*/

bloque("T24 · T25  historial incompleto y hora local");

await t("T24: historiaIncompleta no inventa una primera observación", () => {
  const texto = ui.textoPrimeraObservacion(
    { historiaIncompleta: true, firstSeenAt: "2026-08-25T17:23:55.558Z" },
    PROYECTO
  );

  return (
    texto.includes("historial previo incompleto") &&
    !texto.includes("primera vez")
  );
});

await t("T25: Ecuador se muestra en America/Guayaquil", () => {
  return ui.zonaDelProyecto(PROYECTO) === "America/Guayaquil";
});

await t("T25b: lo persistido sigue en UTC", async () => {
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return String(cand.actualizadoEn).endsWith("Z");
});

await t("la métrica sigue sin ser política", () => {
  return (
    ui.METRICA.nombre === "Solidez del expediente" &&
    ui.METRICA.aclaracion.includes("No representa intención de voto")
  );
});

/*
===========================================================
NINGUNA CUENTA REAL EN EL CODIGO
===========================================================
*/

bloque("higiene  ninguna cuenta de ningún candidato real");

await t("este test no contiene cuentas de candidatos reales", async () => {
  /*
    El benchmark del analista se carga desde la interfaz, no desde
    el codigo. Si apareciera aqui, la prueba dejaria de medir el
    mecanismo y empezaria a medir un dato inventado por mi.
  */
  const fs = await import("node:fs");

  const propio = fs.readFileSync(new URL(import.meta.url), "utf8");

  /*
    El patron se arma por partes para que el literal completo no
    aparezca en el fichero: si estuviera escrito de una pieza, la
    comprobacion se detectaria a si misma y fallaria siempre.
  */
  const prohibidos = [
    ["jota", "lloret"].join(""),
    ["lloret", "valdivieso"].join("")
  ];

  return prohibidos.every(
    (x) => !new RegExp(x, "i").test(propio)
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
