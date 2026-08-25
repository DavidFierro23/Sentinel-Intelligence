// apps/backend/tests/propagacion.test.mjs

/*
===========================================================
PRUEBAS DE PROPAGACION DE HANDLES (P-CAND-01)
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/propagacion.test.mjs

SIN RED Y SIN CUOTA. Se planifica y se clasifica sobre entradas
fijas; no se llama a ningun proveedor.

QUE RESUELVE
-----------------------------------------------------------

En la ejecucion real de las 22:14 Sentinel atribuyo `jotalloretv`
en X y en Instagram, y TikTok se quedo sin cuenta: su unica
consulta —nombre completo mas contexto— devolvio un resultado de
otra persona. El perfil de TikTok con ese mismo handle nunca se
busco.

LA REGLA QUE ESTAS PRUEBAS DEFIENDEN
-----------------------------------------------------------

    MISMO HANDLE != MISMA PERSONA

La propagacion solo GENERA CANDIDATOS. Aumenta el recall y no
toca la precision: lo que se encuentre pasa por el mismo
clasificador, y si el nombre no corresponde, se rechaza.

Atribuir por igualdad de nombre de usuario seria autoverificacion
—y de la peor clase: suponer que un nombre es una identidad—.
El bloque T4 existe para que eso no pueda pasar.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const [pa, pc, ac, pu] = await Promise.all([
  import("../services/social/discovery/platformAdapters.js"),
  import("../services/projects/projectContext.js"),
  import("../services/social/classification/accountClassifier.js"),
  import("../services/social/discovery/socialUrlClassifier.js")
]);

const { catalogoPlataformas } = await import("../services/social/socialContracts.js");

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

const NOMBRE = "Juan Cristóbal Lloret Valdivieso";

const contexto = pc.construirContextoMaestro(
  {
    nombre: "Alcaldía de Cuenca 2027",
    canton: "Cuenca",
    provincia: "Azuay",
    pais: "Ecuador",
    dignidad: "Alcaldía de Cuenca"
  },
  { nombre: NOMBRE, nivel: "cantonal" }
);

const base = pc.aplicarContextoMaestro(
  { nombrePrincipal: NOMBRE, contexto: { rol: "Candidato", pais: "Ecuador" } },
  contexto
);

const planCon = (handlesConocidos) =>
  pa.planificarConsultasDerivadas({ ...base, handlesConocidos }, {});

const PLATAFORMAS = catalogoPlataformas();

/* X atribuido, TikTok sin cuenta: el caso real. */
const SOLO_X = [
  {
    handle: "jotalloretv",
    plataformaId: "x",
    plataforma: "X",
    url: "https://x.com/jotalloretv",
    atribuida: true
  }
];

const X_E_INSTAGRAM = [
  ...SOLO_X,
  {
    handle: "@JotaLloretV",
    plataformaId: "instagram",
    plataforma: "Instagram",
    url: "https://instagram.com/jotalloretv",
    atribuida: true
  }
];

const propagadas = (r) =>
  r.plan.filter((q) => q.via === "handle_propagado");

/*
===========================================================
T1 — LA PROPAGACION OCURRE
===========================================================
*/

bloque("T1  X atribuye @jotalloretv y TikTok recibe consulta por handle");

const R1 = planCon(SOLO_X);

await t("aparece una consulta de TikTok por el handle", () => {
  return R1.plan.some(
    (q) =>
      q.plataformaId === "tiktok" &&
      q.via === "handle_propagado" &&
      q.consulta === 'site:tiktok.com "jotalloretv"'
  );
});

await t("el planificador declara qué handles propagó", () => {
  return R1.handlesPropagados.includes("jotalloretv");
});

await t("NO se propaga a X, que ya tiene cuenta atribuida", () => {
  /*
    T6. Preguntar por un handle donde ya hay respuesta es tirar
    presupuesto.
  */
  return (
    !propagadas(R1).some((q) => q.plataformaId === "x") &&
    R1.propagacionOmitidaPorAtribuida.includes("x:jotalloretv")
  );
});

/*
===========================================================
T2 y T7 — NORMALIZACION Y DEDUPLICACION
===========================================================
*/

bloque("T2 · T7  el mismo handle escrito de cuatro formas es UNA semilla");

await t("@JotaLloretV, jotalloretv, y dos URLs -> una sola semilla", () => {
  const r = planCon([
    { handle: "@JotaLloretV", plataformaId: "x", atribuida: true },
    { handle: "jotalloretv", plataformaId: "x", atribuida: true },
    { handle: "x.com/jotalloretv", plataformaId: "x", atribuida: true },
    { handle: "https://instagram.com/jotalloretv/", plataformaId: "instagram", atribuida: true }
  ]);

  return r.semillasDeHandle === 1;
});

await t("no genera consultas duplicadas equivalentes", () => {
  const r = planCon(X_E_INSTAGRAM);

  const consultas = propagadas(r).map((q) => q.consulta);

  return consultas.length === new Set(consultas).size;
});

await t("con X e Instagram atribuidos, ninguno de los dos se propaga", () => {
  const r = planCon(X_E_INSTAGRAM);

  const destinos = propagadas(r).map((q) => q.plataformaId);

  return !destinos.includes("x") && !destinos.includes("instagram");
});

await t("un handle demasiado corto no se propaga", () => {
  /*
    Dos caracteres no discriminan nada: propagarlos convertiria
    la pasada en ruido.
  */
  return planCon([{ handle: "ab", plataformaId: "x", atribuida: true }])
    .handlesPropagados.length === 0;
});

/*
===========================================================
T3 y T4 — EL MATCHER SIGUE MANDANDO
===========================================================

Es la mitad importante. Un handle propagado abre la puerta; no
decide quien entra.
*/

bloque("T3 · T4  mismo handle NO es misma persona");

await t("T3: el perfil de TikTok con ese handle pasa por el clasificador", () => {
  /*
    El clasificador solo mira `nombrePrincipal`. Si el handle
    lleva el apellido, se atribuye igual que en cualquier otra
    via: la propagacion no le da un atajo.
  */
  const r = ac.clasificarCuenta(
    { handle: "jotalloretv" },
    { nombrePrincipal: NOMBRE }
  );

  return r.clase === "cuenta_personal";
});

await t("T4: el MISMO handle de otra persona NO se atribuye", () => {
  /*
    EL CASO QUE NO PUEDE FALLAR. Si `tiktok.com/@jotalloretv`
    perteneciera a alguien cuyo nombre no corresponde, el
    clasificador debe rechazarlo. Aqui se prueba con un objetivo
    distinto y el mismo handle.
  */
  const r = ac.clasificarCuenta(
    { handle: "jotalloretv" },
    { nombrePrincipal: "Pedro Palacios" }
  );

  return r.clase !== "cuenta_personal";
});

await t("… y tampoco con un handle que solo comparte el nombre de pila", () => {
  const r = ac.clasificarCuenta(
    { handle: "juancristobal_otro" },
    { nombrePrincipal: NOMBRE }
  );

  return r.clase !== "cuenta_personal";
});

await t("el clasificador ignora por completo las semillas de handle", () => {
  /*
    Pasarle los handles conocidos no cambia su veredicto: la
    atribucion no depende de lo que se haya propagado.
  */
  const cuenta = { handle: "cuentaajena99" };

  const sin = ac.clasificarCuenta(cuenta, { nombrePrincipal: NOMBRE });

  const con = ac.clasificarCuenta(cuenta, {
    nombrePrincipal: NOMBRE,
    handlesConocidos: X_E_INSTAGRAM
  });

  return sin.clase === con.clase && con.clase !== "cuenta_personal";
});

/*
===========================================================
T5 — SEMILLA DEL ANALISTA
===========================================================
*/

bloque("T5  un handle del analista orienta, no corrobora");

const R5 = planCon([
  {
    handle: "https://www.facebook.com/juancristobal.lloretvaldivieso",
    plataforma: "Facebook",
    origen: "analista"
  }
]);

await t("genera búsqueda a partir de la URL declarada", () => {
  return R5.handlesPropagados.includes("juancristobal.lloretvaldivieso");
});

await t("sus consultas van marcadas para NO corroborar", () => {
  return propagadas(R5).every(
    (q) => q.noCuentaComoCorroboracion === true && q.origenAnalista === true
  );
});

await t("una semilla ATRIBUIDA por Sentinel sí puede corroborar", () => {
  /*
    La distincion: lo que Sentinel encontro y clasifico es
    evidencia; lo que el analista escribio, no.
  */
  return propagadas(planCon(SOLO_X)).every(
    (q) => q.noCuentaComoCorroboracion !== true
  );
});

await t("si Sentinel la atribuye después, deja de ser solo del analista", () => {
  const r = planCon([
    { handle: "jotalloretv", plataforma: "X", origen: "analista" },
    { handle: "jotalloretv", plataformaId: "instagram", atribuida: true }
  ]);

  return propagadas(r).every((q) => q.noCuentaComoCorroboracion !== true);
});

/*
===========================================================
T12 y T13 — PROCEDENCIA Y CONSULTAS PRINCIPALES
===========================================================
*/

bloque("T12 · T13  procedencia completa y el plan original intacto");

await t("T12: cada consulta propagada dice de dónde vino el handle", () => {
  const q = propagadas(R1)[0];

  return (
    q.via === "handle_propagado" &&
    q.handle === "jotalloretv" &&
    q.plataformaOrigenId === "x" &&
    q.cuentaOrigen === "https://x.com/jotalloretv" &&
    q.cuentaOrigenAtribuida === true
  );
});

await t("T13: las consultas por nombre principal siguen todas", () => {
  const sin = pa.planificarConsultasDerivadas(base, {});

  const conNombre = (r) =>
    r.plan.filter((q) => q.consulta.includes(`"${NOMBRE}"`)).length;

  return conNombre(R1) === conNombre(sin) && conNombre(R1) > 0;
});

await t("las 6 plataformas conservan su consulta anclada", () => {
  const ancladas = new Set(
    R1.plan.filter((q) => q.anclada && q.plataformaId).map((q) => q.plataformaId)
  );

  return PLATAFORMAS.every((p) => ancladas.has(p.id));
});

await t("la reserva por nombre a secas sobrevive", () => {
  return R1.plan.some((q) => String(q.etiqueta).startsWith("nombre:"));
});

await t("el plan CRECE: la propagación amplía, no reemplaza", () => {
  return R1.plan.length > pa.planificarConsultasDerivadas(base, {}).plan.length;
});

await t("las propagadas van después de las de plataforma", () => {
  /*
    El orden dice la prioridad: si el presupuesto se agota, se
    pierde lo ultimo. Una propagada no puede costarle a una
    plataforma su consulta anclada.
  */
  const primera = R1.plan.findIndex((q) => q.via === "handle_propagado");

  const ultimaAnclada = R1.plan.reduce(
    (acc, q, i) => (q.anclada && q.plataformaId ? i : acc),
    -1
  );

  return primera > ultimaAnclada;
});

/*
===========================================================
T14 — PRESUPUESTO Y TRUNCAMIENTO
===========================================================
*/

bloque("T14  el tope se respeta y el recorte se declara");

await t("muchas semillas no inflan el plan sin límite", () => {
  const muchas = ["unohandle", "doshandle", "treshandle", "cuatrohandle"].map(
    (h) => ({ handle: h, plataformaId: "x", atribuida: true })
  );

  const r = planCon(muchas);

  return propagadas(r).length <= 4;
});

await t("lo que no cabe se declara, no se calla", () => {
  const muchas = ["unohandle", "doshandle", "treshandle", "cuatrohandle"].map(
    (h) => ({ handle: h, plataformaId: "x", atribuida: true })
  );

  const r = planCon(muchas);

  return r.propagadasTruncadas > 0 && typeof r.consultasPropagadas === "number";
});

await t("sin semillas, el plan es idéntico al de antes", () => {
  const sin = pa.planificarConsultasDerivadas(base, {});

  const vacio = planCon([]);

  return (
    vacio.plan.length === sin.plan.length &&
    vacio.plan.every((q, i) => q.consulta === sin.plan[i].consulta) &&
    vacio.consultasPropagadas === 0
  );
});

/*
===========================================================
T8 a T11 — PROFILE-FIRST
===========================================================

Contenido y cuenta no son lo mismo. Solo se extrae propietario
cuando la URL lo dice; nunca se inventa.
*/

bloque("T8 · T9 · T10 · T11  perfil/canal frente a contenido");

const url = (u) => pu.clasificarUrlSocial(u);

await t("T8: instagram.com/p/… y /reel/… NO son cuenta", () => {
  return (
    url("https://www.instagram.com/p/Db_QwCulmI-/").esCuenta === false &&
    url("https://www.instagram.com/reel/DcJ252vCm4e/").esCuenta === false
  );
});

await t("T8b: instagram.com/usuario/p/… SÍ identifica al propietario", () => {
  /*
    El propietario no se adivina: esta escrito en la ruta. Es el
    mismo criterio que ya se aplicaba a x.com/usuario/status/123.
    En la ejecucion real se perdieron dos cuentas asi.
  */
  const r = url("https://www.instagram.com/toquillaradio/p/DcKIL5rH0aL/");

  return r.esCuenta === true && r.handle === "toquillaradio";
});

await t("instagram.com/usuario es perfil", () => {
  const r = url("https://www.instagram.com/jotalloretv");

  return r.tipo === "perfil" && r.handle === "jotalloretv";
});

await t("T9: tiktok video/photo no es cuenta por sí mismo, pero lleva autor", () => {
  const v = url("https://www.tiktok.com/@jotalloretv/video/123");

  const f = url("https://www.tiktok.com/@segundo.cabrera82/photo/7673557345");

  return (
    v.tipo === "video" &&
    v.handle === "jotalloretv" &&
    f.tipo === "video" &&
    f.handle === "segundo.cabrera82"
  );
});

await t("tiktok.com/@usuario es perfil", () => {
  return url("https://www.tiktok.com/@jotalloretv").tipo === "perfil";
});

await t("T10: youtube watch y shorts NO son canal", () => {
  /*
    La URL de un video no contiene a su propietario. Declararlo
    canal seria inventar la cuenta: es la regla que este modulo
    no puede romper.
  */
  return (
    url("https://www.youtube.com/watch?v=BbnIGkvaWO0").esCuenta === false &&
    url("https://www.youtube.com/shorts/xyz123").esCuenta === false
  );
});

await t("T11: youtube @handle, /channel/ y /c/ SÍ son candidatos de canal", () => {
  return (
    url("https://www.youtube.com/@jotalloretv").esCuenta === true &&
    url("https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA").esCuenta === true &&
    url("https://www.youtube.com/c/algocanal").esCuenta === true
  );
});

await t("un propietario derivado de contenido sigue pasando por el clasificador", () => {
  /*
    `toquillaradio` es legible, y eso no lo hace del objetivo: el
    clasificador lo separa como medio.
  */
  const r = ac.clasificarCuenta(
    { handle: "toquillaradio" },
    { nombrePrincipal: NOMBRE }
  );

  return r.clase !== "cuenta_personal";
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
