// apps/backend/tests/fichaIdentidad.test.mjs

/*
===========================================================
PRUEBAS DE LA FICHA DE IDENTIDAD (P-CAND-UX-01)
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/fichaIdentidad.test.mjs

SIN RED Y SIN CUOTA. Se importan tambien los helpers de la
interfaz, que son funciones puras sin React y por eso se pueden
probar desde Node.

LAS DOS DISTINCIONES QUE LA FICHA NO PUEDE PERDER
-----------------------------------------------------------

    declarada por el analista   vs   corroborada por Sentinel
    no reencontrada             vs   no existe

La primera es de procedencia, y las dos pueden ser verdad a la
vez: que una persona escribiera la URL no impide que un proveedor
la encuentre despues por su cuenta.

La segunda es la diferencia entre una limitacion nuestra y una
afirmacion sobre alguien. Una plataforma sin cuenta no dice que
el candidato no la use; dice que Sentinel no ha encontrado nada.
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

const PID = "ficha-test";

const PROYECTO = {
  id: PID,
  nombre: "Alcaldía de Cuenca 2027",
  canton: "Cuenca",
  provincia: "Azuay",
  pais: "Ecuador",
  dignidad: "Alcaldía de Cuenca"
};

await ps.crearProyecto(PROYECTO);

const ficha = (id) => ps.fichaIdentidad(PID, id, "candidato");

/*
===========================================================
CANDIDATO SIN REDES
===========================================================
*/

bloque("candidato sin redes declaradas");

await ps.agregarCandidato(PID, { nombre: "Nadie Sin Redes" });

const sinRedes = await ficha("nadie-sin-redes");

await t("la ficha existe aunque no haya ninguna cuenta", () => {
  return !!sinRedes && sinRedes.nombre === "Nadie Sin Redes";
});

await t("declara LAS SIETE plataformas, no solo las que tienen algo", () => {
  /*
    Es lo que impide que la interfaz escriba «no tiene redes». Una
    lista que solo muestra lo hallado no distingue «no tiene» de
    «no encontramos».
  */
  const ids = sinRedes.plataformas.map((p) => p.plataformaId);

  return (
    ids.length === 7 &&
    ["facebook", "instagram", "x", "tiktok", "youtube", "linkedin", "web"].every(
      (x) => ids.includes(x)
    )
  );
});

await t("todas quedan PENDIENTE, que no afirma ausencia", () => {
  return sinRedes.plataformas.every((p) => p.estado === "PENDIENTE");
});

await t("el texto de PENDIENTE no dice que el candidato no la use", () => {
  const v = ui.estadoVisual("PENDIENTE");

  return (
    v.explicacion.includes("no es una afirmación") ||
    v.explicacion.includes("No es una afirmación")
  );
});

/*
===========================================================
UNA RED, VARIAS REDES, DOS DE LA MISMA
===========================================================
*/

bloque("una red · varias redes · dos cuentas de la misma plataforma");

await ps.agregarCandidato(PID, {
  nombre: "Una Sola Red",
  x: "https://x.com/unasolared"
});

await t("una red declarada aparece y las otras seis siguen pendientes", async () => {
  const f = await ficha("una-sola-red");

  const conCuenta = f.plataformas.filter((p) => p.total > 0);

  return conCuenta.length === 1 && conCuenta[0].plataformaId === "x";
});

await ps.agregarCandidato(PID, {
  nombre: "Juan Cristóbal Lloret Valdivieso",
  facebook: "https://www.facebook.com/juancristobal.lloretvaldivieso",
  x: "https://x.com/jotalloretv",
  /*
    Dos cuentas de Instagram: personal y de campana. El modelo
    anterior era `instagram: string` y solo admitia una.
  */
  cuentas: [
    "https://www.instagram.com/jotalloretv",
    "https://www.instagram.com/lloretcampana"
  ],
  aliases: ["Jota Lloret"],
  fotoUrl: "https://ejemplo.ec/foto.jpg"
});

const CID = "juan-cristobal-lloret-valdivieso";

const f0 = await ficha(CID);

await t("varias redes conviven en la misma ficha", () => {
  return f0.plataformas.filter((p) => p.total > 0).length === 3;
});

await t("DOS cuentas de Instagram, no una", () => {
  const ig = f0.plataformas.find((p) => p.plataformaId === "instagram");

  return (
    ig.total === 2 &&
    ig.cuentas.some((c) => c.handle === "jotalloretv") &&
    ig.cuentas.some((c) => c.handle === "lloretcampana")
  );
});

await t("la plataforma se lee del dominio, no de la casilla", () => {
  /*
    Si el analista pega una URL de Instagram en la casilla de
    Facebook, manda la URL. SD-1A es la autoridad.
  */
  const ig = f0.plataformas.find((p) => p.plataformaId === "instagram");

  return ig.cuentas.every((c) => c.plataformaId === "instagram");
});

await t("los alias constan como declarados por el analista", () => {
  return (
    f0.aliases.length === 1 &&
    f0.aliases[0].valor === "Jota Lloret" &&
    f0.aliases[0].origen === "analista"
  );
});

/*
===========================================================
FOTO
===========================================================
*/

bloque("foto con su procedencia");

await t("la foto conserva de dónde salió", () => {
  return (
    f0.foto.url === "https://ejemplo.ec/foto.jpg" &&
    f0.foto.origen === "analista" &&
    typeof f0.foto.obtenidaEn === "string"
  );
});

await t("NO se marca verificada por Sentinel", () => {
  /*
    Que el analista la pegue no la verifica. Y no hay
    reconocimiento facial: la ficha declara la procedencia y deja
    el juicio a la persona.
  */
  return f0.foto.verificadaPorSentinel === false;
});

await t("un candidato sin foto no inventa una", () => {
  return sinRedes.foto === null;
});

/*
===========================================================
PROCEDENCIA
===========================================================
*/

bloque("procedencia: declarada, descubierta, corroborada");

await t("lo que escribe el analista entra declarado y sin verificar", () => {
  const fb = f0.plataformas.find((p) => p.plataformaId === "facebook");

  const c = fb.cuentas[0];

  return (
    c.declaradaPorAnalista === true &&
    c.descubiertaPorSentinel === false &&
    c.corroboradaPorSentinel === false &&
    c.noCuentaComoCorroboracion === true &&
    c.estado === "DECLARADA_POR_ANALISTA"
  );
});

await t("las dos procedencias pueden ser verdad a la vez", () => {
  /*
    Sentinel encuentra por su cuenta la misma cuenta que el
    analista declaro. No es una contradiccion: es informacion
    mas rica, y la ficha debe mostrar las dos.
  */
  const texto = ui.procedencia({
    declaradaPorAnalista: true,
    corroboradaPorSentinel: true
  });

  return texto.includes("declarada") && texto.includes("corroborada");
});

await t("una cuenta sin procedencia no se inventa una", () => {
  return ui.procedencia({}).includes("sin procedencia");
});

/*
===========================================================
INVENTARIO CONSOLIDADO EN LA FICHA
===========================================================
*/

bloque("la ficha lee el inventario consolidado");

/* Se investiga: X e Instagram quedan atribuidas por Sentinel. */
function cuenta(pid, plataforma, handle, url, score, proveedores) {
  return {
    plataforma,
    plataformaId: pid,
    handle,
    url: { canonica: url },
    correspondencia: { puntuacion: score, nivel: "posible" },
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
    clasificacion: { clase: "cuenta_personal", razones: ["handle contiene lloret"] }
  };
}

const X = cuenta("x", "X", "jotalloretv", "https://x.com/jotalloretv", 62, [
  "SerpAPI (Google)",
  "DuckDuckGo Web"
]);

const IG = cuenta(
  "instagram",
  "Instagram",
  "jotalloretv",
  "https://www.instagram.com/jotalloretv",
  21,
  ["DuckDuckGo Web"]
);

const resultado = (cuentas) => ({
  perfilEjecutivo: {
    huellaDigital: { valor: 40 },
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
  fichaObjetivo: { evidencias: { web: new Array(20).fill({}) } }
});

await ps.registrarInvestigacion(PID, CID, resultado([X, IG]));

const f1 = await ficha(CID);

await t("una cuenta descubierta por Sentinel aparece corroborada", () => {
  const x = f1.plataformas.find((p) => p.plataformaId === "x");

  const c = x.cuentas.find((y) => y.handle === "jotalloretv");

  return c.corroboradaPorSentinel === true && c.declaradaPorAnalista === true;
});

await t("las métricas separan consolidadas, declaradas y corroboradas", () => {
  const m = f1.metricas;

  return (
    m.consolidadas >= 2 &&
    m.declaradas >= 1 &&
    m.corroboradas >= 2 &&
    typeof m.plataformasPendientes === "number"
  );
});

/* Segunda corrida: Instagram no se reencuentra. */
await ps.registrarInvestigacion(PID, CID, resultado([X]));

const f2 = await ficha(CID);

await t("una cuenta NO reencontrada sigue visible en la ficha", () => {
  /*
    El defecto que BUG-19 corrigio, visto desde la interfaz: la
    cuenta no desaparece de la ficha porque un buscador callara.
  */
  const ig = f2.plataformas.find((p) => p.plataformaId === "instagram");

  return ig.total > 0;
});

await t("y se etiqueta como consolidada, no reencontrada", () => {
  const ig = f2.plataformas.find((p) => p.plataformaId === "instagram");

  const c = ig.cuentas.find((y) => y.handle === "jotalloretv");

  const v = ui.estadoVisual(c.estado);

  return (
    c.estado === "NO_REENCONTRADA_EN_ULTIMA_VERIFICACION" &&
    v.etiqueta.includes("no reencontrada") &&
    v.tono === "ambar"
  );
});

await t("el texto dice que se revisó y no se vio, sin colapsarlo", () => {
  const ig = f2.plataformas.find((p) => p.plataformaId === "instagram");

  const c = ig.cuentas.find((y) => y.handle === "jotalloretv");

  const texto = ui.textoUltimaVerificacion(c, PROYECTO);

  return texto.includes("revisada") && texto.includes("vista por última vez");
});

/*
===========================================================
EDICION Y PERSISTENCIA
===========================================================
*/

bloque("editar identidad sin borrar y recrear");

const r = await ps.editarCandidato(PID, CID, {
  nombre: "Juan Cristóbal Lloret Valdivieso",
  tiktok: "https://www.tiktok.com/@jotalloretv",
  aliases: ["J. C. Lloret"]
});

await t("la edición se guarda", () => {
  return r.editado === true;
});

await t("el id NO cambia: el expediente sigue conectado", async () => {
  /*
    Recrear el candidato perderia el expediente, las ejecuciones
    y el inventario consolidado. Es la misma razon por la que
    renombrar un proyecto no cambia su id.
  */
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return (
    !!cand &&
    !!cand.expediente &&
    (cand.expediente.cuentas || []).length >= 2
  );
});

await t("la red añadida aparece en la ficha", async () => {
  const f = await ficha(CID);

  const tk = f.plataformas.find((p) => p.plataformaId === "tiktok");

  return tk.total === 1 && tk.cuentas[0].handle === "jotalloretv";
});

await t("el alias nuevo se acumula, no reemplaza al anterior", async () => {
  const f = await ficha(CID);

  const valores = f.aliases.map((a) => a.valor);

  return valores.includes("Jota Lloret") && valores.includes("J. C. Lloret");
});

await t("las cuentas anteriores no se pierden al editar", async () => {
  const f = await ficha(CID);

  return f.plataformas.filter((p) => p.total > 0).length >= 4;
});

await t("sobrevive a una relectura: está persistido, no en memoria", async () => {
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return (cand.cuentasReferencia || []).some(
    (x) => x.plataformaId === "tiktok"
  );
});

await t("retirar una cuenta exige pedirlo por su id", async () => {
  /*
    Un formulario enviado a medias no puede borrar identidad. Se
    quita solo lo que se nombra.
  */
  const antes = await ficha(CID);

  const tk = antes.plataformas.find((p) => p.plataformaId === "tiktok");

  await ps.editarCandidato(PID, CID, {
    quitarCuentas: [`tiktok:${tk.cuentas[0].handle}`]
  });

  const despues = await ficha(CID);

  const tk2 = despues.plataformas.find((p) => p.plataformaId === "tiktok");

  return tk2.total === 0 && despues.plataformas.some((p) => p.total > 0);
});

/*
===========================================================
HORA LOCAL
===========================================================
*/

bloque("hora local del proyecto");

await t("Ecuador se muestra en America/Guayaquil", () => {
  return ui.zonaDelProyecto({ pais: "Ecuador" }) === "America/Guayaquil";
});

await t("un instante UTC se convierte a la hora del territorio", () => {
  /*
    17:23 UTC son 12:23 en Guayaquil. Si se mostrara UTC, el
    analista tendria que restar cinco horas cada vez, y alguna vez
    no las restaria.
  */
  const texto = ui.fechaLocal("2026-08-25T17:23:55.558Z", { pais: "Ecuador" });

  return typeof texto === "string" && texto.includes("12:23");
});

await t("otra zona se puede configurar por proyecto", () => {
  return (
    ui.zonaDelProyecto({ zonaHoraria: "America/Bogota" }) === "America/Bogota" &&
    ui.zonaDelProyecto({ pais: "Colombia" }) === "America/Bogota"
  );
});

await t("sin fecha devuelve null, no una cadena rota", () => {
  return (
    ui.fechaLocal(null, PROYECTO) === null &&
    ui.fechaLocal("no-es-fecha", PROYECTO) === null
  );
});

await t("lo persistido sigue siendo UTC", async () => {
  /*
    La conversion es solo de presentacion. Cambiar lo almacenado
    haria imposible comparar dos proyectos de husos distintos.
  */
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return String(cand.expediente.actualizadoEn).endsWith("Z");
});

/*
===========================================================
BUG-20 — NO INVENTAR LA PRIMERA OBSERVACION
===========================================================
*/

bloque("BUG-20  historial incompleto no se rellena con una fecha");

await t("con historiaIncompleta NO se escribe «vista por primera vez»", () => {
  const texto = ui.textoPrimeraObservacion(
    { historiaIncompleta: true, firstSeenAt: "2026-08-25T17:23:55.558Z" },
    PROYECTO
  );

  return (
    texto.includes("historial previo incompleto") &&
    !texto.includes("primera vez")
  );
});

await t("con historia completa sí se dice la fecha", () => {
  const texto = ui.textoPrimeraObservacion(
    { historiaIncompleta: false, firstSeenAt: "2026-08-25T17:23:55.558Z" },
    PROYECTO
  );

  return texto.includes("primera vez");
});

await t("sin fecha ni bandera, se dice que no consta", () => {
  return ui
    .textoPrimeraObservacion({}, PROYECTO)
    .includes("sin primera observación");
});

/*
===========================================================
LA METRICA NO ES POLITICA
===========================================================
*/

bloque("la métrica se nombra y se acota");

await t("tiene nombre técnico, no «huella» a secas", () => {
  return (
    ui.METRICA.nombre === "Solidez del expediente" &&
    ui.METRICA.abreviado === "Solidez"
  );
});

await t("declara explícitamente lo que NO mide", () => {
  const a = ui.METRICA.aclaracion;

  return (
    a.includes("No representa intención de voto") &&
    a.includes("popularidad") &&
    a.includes("apoyo ciudadano")
  );
});

await t("enumera sus cuatro componentes", () => {
  return ui.METRICA.componentes.length === 4;
});

await t("el nivel se nombra por documentación, no por apoyo", () => {
  /*
    «expediente limitado» describe lo que sabemos. «bajo apoyo»
    describiria algo que esta metrica no mide.
  */
  return (
    ui.nivelSolidez(35).etiqueta.includes("expediente") &&
    ui.nivelSolidez(80).etiqueta.includes("expediente") &&
    ui.nivelSolidez(null).etiqueta === "sin medir"
  );
});

await t("un valor bajo no se pinta en rojo de alarma", () => {
  /*
    Un expediente poco documentado no es «malo»: es poco
    documentado. El rojo se reserva para lo revocado y los
    errores reales.
  */
  return (
    ui.nivelSolidez(35).tono !== "rojo" && ui.nivelSolidez(10).tono !== "rojo"
  );
});

/*
===========================================================
COMPROBAR REDES NO BORRA
===========================================================
*/

bloque("comprobar redes no equivale a borrar y redescubrir");

await t("una comprobación sin hallazgos conserva las cuentas", async () => {
  const antes = await ficha(CID);

  const cuentasAntes = antes.plataformas.reduce((n, p) => n + p.total, 0);

  /* Corrida sin ninguna cuenta: simula proveedores en blanco. */
  await ps.registrarInvestigacion(PID, CID, resultado([]));

  const despues = await ficha(CID);

  const cuentasDespues = despues.plataformas.reduce((n, p) => n + p.total, 0);

  return cuentasDespues === cuentasAntes;
});

await t("y las marca como no reencontradas, no como revocadas", async () => {
  const f = await ficha(CID);

  const x = f.plataformas.find((p) => p.plataformaId === "x");

  return (
    x.cuentas[0].estado === "NO_REENCONTRADA_EN_ULTIMA_VERIFICACION" &&
    x.cuentas[0].estado !== "REVOCADA"
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
