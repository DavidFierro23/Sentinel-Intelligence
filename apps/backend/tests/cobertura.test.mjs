// apps/backend/tests/cobertura.test.mjs

/*
===========================================================
PRUEBAS DEL CONTRATO DE COBERTURA (BUG-15)
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/cobertura.test.mjs

SIN RED Y SIN CUOTA.

EL DEFECTO QUE FIJAN
-----------------------------------------------------------

En la reprueba real de Lloret, Instagram devolvio DIEZ
resultados —todas publicaciones y reels, ningun perfil— y la
traza la etiqueto `BUSCADA_SIN_RESULTADO`, que afirma algo
distinto y mas fuerte: que no habia nada.

Son dos hechos que no se pueden colapsar:

    no habia nada                  ausencia
    habia contenido, no perfiles   no atribuible

Y en la misma corrida se perdieron los motivos de 24 rechazos de
26 candidatos, porque la traza leia
`resultado.social.candidatos`, un campo que el layer social no
expone.

Estas pruebas montan el grupo completo con la forma REAL que
produce `clasificarYSeparar` y comprueban los cinco estados, uno
por uno, con el caso que a cada uno le corresponde.
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

/* Atajo para construir una cuenta con la forma del motor. */
function cuenta(o) {
  return {
    plataforma: o.plataforma,
    plataformaId: o.plataformaId,
    handle: o.handle,
    url: { canonica: o.url },
    nombreVisible: o.displayName || null,
    correspondencia: { puntuacion: o.score, nivel: o.nivel || "posible" },
    origenes: o.origenes || [],
    vias: o.vias || [],
    proveedores: o.proveedores || [],
    corroboracion: {
      proveedores: o.proveedores || [],
      totalProveedores: (o.proveedores || []).length,
      multiProveedor: (o.proveedores || []).length > 1,
      vias: o.vias || [],
      multiVia: (o.vias || []).length > 1
    },
    clasificacion: { clase: o.clase, razones: [o.razon] }
  };
}

const qX = 'site:x.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia';
const qLI = 'site:linkedin.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia';

const ATRIBUIDA = cuenta({
  plataforma: "X",
  plataformaId: "x",
  handle: "jotalloretv",
  url: "https://x.com/jotalloretv",
  score: 31,
  clase: "cuenta_personal",
  razon: "el handle jotalloretv contiene lloret del nombre del objetivo",
  proveedores: ["SerpAPI (Google)"],
  vias: ["consulta_dirigida"],
  origenes: [
    { via: "consulta_dirigida", proveedor: "SerpAPI (Google)", consulta: qX }
  ]
});

const REFERENCIA = cuenta({
  plataforma: "Facebook",
  plataformaId: "facebook",
  handle: "juancristobal.lloretvaldivieso",
  url: "https://facebook.com/juancristobal.lloretvaldivieso",
  score: 25,
  clase: "cuenta_personal",
  razon: "el handle contiene lloret, valdivieso del nombre del objetivo",
  proveedores: [],
  vias: [],
  origenes: [
    {
      via: "cuenta_referencia",
      proveedor: null,
      origen: "analista",
      noCuentaComoCorroboracion: true
    }
  ]
});

/* LinkedIn: 2 candidatos, 0 atribuidos. El caso obligatorio. */
const LINKEDIN_1 = cuenta({
  plataforma: "LinkedIn",
  plataformaId: "linkedin",
  handle: "jlloretv",
  displayName: "J. Lloret V.",
  url: "https://linkedin.com/in/jlloretv",
  score: 18,
  clase: "no_determinado",
  razon: "coincide en lloret pero la correspondencia no alcanza el umbral",
  proveedores: ["SerpAPI (Google)"],
  vias: ["consulta_dirigida"],
  origenes: [
    { via: "consulta_dirigida", proveedor: "SerpAPI (Google)", consulta: qLI }
  ]
});

const LINKEDIN_2 = cuenta({
  plataforma: "LinkedIn",
  plataformaId: "linkedin",
  handle: "cristobal-mora-l",
  url: "https://linkedin.com/in/cristobal-mora-l",
  score: 6,
  clase: "no_determinado",
  razon:
    "coincide en cristobal, que es nombre de pila, pero en ningún apellido (lloret / valdivieso)",
  proveedores: ["SerpAPI (Google)"],
  vias: ["consulta_dirigida"],
  origenes: [
    { via: "consulta_dirigida", proveedor: "SerpAPI (Google)", consulta: qLI }
  ]
});

const RESULTADO = {
  perfilEjecutivo: {
    huellaDigital: { valor: 22 },
    tarjetas: [
      { plataforma: "X", plataformaId: "x", handle: "jotalloretv", correspondencia: 31 },
      { plataforma: "Facebook", plataformaId: "facebook", handle: "juancristobal.lloretvaldivieso", correspondencia: 25 }
    ],
    medios: [],
    instituciones: [],
    indeterminadas: []
  },

  clasificacionCuentas: {
    version: "1.0",
    cuentasObjetivo: [ATRIBUIDA, REFERENCIA],
    medios: [],
    instituciones: [],
    indeterminadas: [LINKEDIN_1, LINKEDIN_2]
  },

  social: {
    /*
      Las seis plataformas, cada una con el caso que ejercita un
      estado distinto del contrato.
    */
    cobertura: [
      { plataformaId: "x", plataforma: "X", candidatos: 1, motivoCobertura: "1 candidato." },
      { plataformaId: "facebook", plataforma: "Facebook", candidatos: 1, motivoCobertura: "1 candidato." },

      /* 10 resultados, 0 candidatos: todos posts y reels. */
      { plataformaId: "instagram", plataforma: "Instagram", candidatos: 0, motivoCobertura: "Sin candidatos." },

      /* 1 resultado, de otra persona. */
      { plataformaId: "tiktok", plataforma: "TikTok", candidatos: 0, motivoCobertura: "Sin candidatos." },

      /* Consulta OK y CERO resultados: la ausencia de verdad. */
      { plataformaId: "youtube", plataforma: "YouTube", candidatos: 0, motivoCobertura: "Sin resultados." },

      /* 2 candidatos, ninguno atribuido. */
      { plataformaId: "linkedin", plataforma: "LinkedIn", candidatos: 2, motivoCobertura: "2 candidatos." }
    ],

    descubrimiento: {
      anclasUsadas: [{ termino: "Cuenca" }, { termino: "alcaldia" }],
      aliasUsados: [],
      advertencias: [],

      plan: [
        { consulta: qX, etiqueta: "identidad:x", plataformaId: "x" },
        { consulta: 'site:facebook.com "…" Cuenca alcaldia', etiqueta: "identidad:facebook_pages", plataformaId: "facebook" },
        { consulta: 'site:instagram.com "…" Cuenca alcaldia', etiqueta: "identidad:instagram", plataformaId: "instagram" },
        { consulta: 'site:tiktok.com "…" Cuenca alcaldia', etiqueta: "identidad:tiktok", plataformaId: "tiktok" },
        { consulta: 'site:youtube.com "…" Cuenca alcaldia', etiqueta: "identidad:youtube", plataformaId: "youtube" },
        { consulta: qLI, etiqueta: "identidad:linkedin", plataformaId: "linkedin" },
        /* Planificada y nunca lanzada. */
        { consulta: 'site:youtube.com "…"', etiqueta: "nombre:youtube", plataformaId: "youtube" }
      ],

      intentos: [
        { consulta: qX, plataformaId: "x", proveedorUsado: "SerpAPI (Google)", estado: "OK", resultados: 10 },
        { consulta: 'site:facebook.com "…" Cuenca alcaldia', plataformaId: "facebook", proveedorUsado: "SerpAPI (Google)", estado: "OK", resultados: 8 },
        { consulta: 'site:instagram.com "…" Cuenca alcaldia', plataformaId: "instagram", proveedorUsado: "SerpAPI (Google)", estado: "OK", resultados: 10 },
        { consulta: 'site:tiktok.com "…" Cuenca alcaldia', plataformaId: "tiktok", proveedorUsado: "SerpAPI (Google)", estado: "OK", resultados: 1 },
        { consulta: 'site:youtube.com "…" Cuenca alcaldia', plataformaId: "youtube", proveedorUsado: "SerpAPI (Google)", estado: "OK", resultados: 0 },
        { consulta: qLI, plataformaId: "linkedin", proveedorUsado: "SerpAPI (Google)", estado: "OK", resultados: 2 }
      ],

      /* Los descartes de nivel URL que explican Instagram y TikTok. */
      descartados: [
        { url: "https://www.instagram.com/p/Db_QwCulmI-/", plataformaId: "instagram", plataforma: { nombre: "Instagram" }, motivo: "no_cuenta: la URL no identifica una cuenta", tipo: "no_cuenta" },
        { url: "https://www.instagram.com/reel/DcJ252vCm4e/", plataformaId: "instagram", plataforma: { nombre: "Instagram" }, motivo: "no_cuenta: la URL no identifica una cuenta", tipo: "no_cuenta" },
        { url: "https://www.instagram.com/toquillaradio/p/DcKIL5rH0aL/", plataformaId: "instagram", plataforma: { nombre: "Instagram" }, motivo: 'ruta "/toquillaradio/p/DcKIL5rH0aL/" no reconocida como cuenta en Instagram', tipo: "no_cuenta" },
        { url: "https://www.tiktok.com/@segundo.cabrera82/photo/7673", plataformaId: "tiktok", plataforma: { nombre: "TikTok" }, motivo: 'ruta "/@segundo.cabrera82/photo/7673" no reconocida como cuenta en TikTok', tipo: "no_cuenta" }
      ],

      proveedores: {
        proveedores: [
          { id: "serpapi", nombre: "SerpAPI (Google)", intentos: 6, exitos: 6, bloqueos: 0, errores: 0, noIntentados: 0, resultados: 31 }
        ]
      }
    }
  },

  fichaObjetivo: { evidencias: { web: new Array(26).fill({}) } }
};

const PID = "cob-test";

const CID = "juan-cristobal-lloret-valdivieso";

await ps.crearProyecto({
  id: PID,
  nombre: "Proyecto cobertura",
  canton: "Cuenca",
  provincia: "Azuay",
  pais: "Ecuador",
  dignidad: "Alcaldía de Cuenca"
});

await ps.agregarCandidato(PID, {
  nombre: "Juan Cristóbal Lloret Valdivieso",
  facebook: "https://www.facebook.com/juancristobal.lloretvaldivieso"
});

await ps.registrarInvestigacion(PID, CID, RESULTADO);

const contenido = await ps.contenidoDeProyecto(PID);

const cand = contenido.candidatos.find((c) => c.id === CID);

const traza = cand.ultimaEjecucion.traza;

const plat = (id) => traza.coberturaPlataformas.find((c) => c.plataformaId === id);

const social = (h) => traza.candidatosSociales.find((c) => c.handle === h);

/*
===========================================================
LOS CANDIDATOS SOBREVIVEN
===========================================================
*/

bloque("BUG-15.a  los candidatos del motor llegan a la persistencia");

await t("los 4 candidatos clasificados están en la traza", () => {
  /*
    2 atribuidas + 2 rechazadas. Antes esta lista salia vacia
    porque se leia un campo que el layer no expone.
  */
  return traza.totalCandidatosSociales === 4;
});

await t("se lee de clasificacionCuentas, la estructura real", () => {
  /*
    Si volviera a leerse `social.candidatos` —que no existe— esto
    seria 0.
  */
  return traza.candidatosSociales.length > 0;
});

/*
===========================================================
LINKEDIN — EL CASO OBLIGATORIO
===========================================================
*/

bloque("BUG-15.b  LinkedIn: 2 candidatos, 0 atribuidos, con motivo");

await t("los DOS candidatos de LinkedIn sobreviven", () => {
  return (
    traza.candidatosSociales.filter((c) => c.plataformaId === "linkedin")
      .length === 2
  );
});

await t("ambos con score", () => {
  return social("jlloretv").score === 18 && social("cristobal-mora-l").score === 6;
});

await t("ambos con motivo exacto de rechazo", () => {
  return (
    social("jlloretv").motivo.includes("umbral") &&
    social("cristobal-mora-l").motivo.includes("apellido")
  );
});

await t("ambos rechazados, no aceptados", () => {
  return (
    social("jlloretv").aceptado === false &&
    social("cristobal-mora-l").aceptado === false
  );
});

await t("conservan provider y la query que los encontró", () => {
  const c = social("jlloretv");

  return (
    c.proveedores.includes("SerpAPI (Google)") &&
    c.consultas.some((q) => q.includes("site:linkedin.com"))
  );
});

await t("conservan origenes, vias y corroboracion", () => {
  const c = social("jlloretv");

  return (
    c.origenes.length === 1 &&
    c.vias.includes("consulta_dirigida") &&
    c.corroboracion.totalProveedores === 1
  );
});

await t("displayName se conserva cuando existe", () => {
  return social("jlloretv").displayName === "J. Lloret V.";
});

await t("LinkedIn queda ENCONTRADA_NO_ATRIBUIDA", () => {
  return plat("linkedin").estado === "ENCONTRADA_NO_ATRIBUIDA";
});

/*
===========================================================
LOS CINCO ESTADOS, CADA UNO CON SU CASO
===========================================================
*/

bloque("BUG-15.c  el contrato de cinco estados, corregido");

await t("X con cuenta atribuida -> ATRIBUIDA", () => {
  return plat("x").estado === "ATRIBUIDA";
});

await t("INSTAGRAM: 10 resultados, 0 perfiles -> ENCONTRADA_NO_ATRIBUIDA", () => {
  /*
    EL DEFECTO QUE ESTA PRUEBA EXISTE PARA IMPEDIR. Antes esto
    daba BUSCADA_SIN_RESULTADO, que afirma que no habia nada
    cuando habia diez enlaces.
  */
  const c = plat("instagram");

  return (
    c.estado === "ENCONTRADA_NO_ATRIBUIDA" &&
    c.estado !== "BUSCADA_SIN_RESULTADO"
  );
});

await t("… y declara cuántos resultados hubo", () => {
  return plat("instagram").resultadosDelBuscador === 10;
});

await t("… y cuántas URLs se descartaron, con motivo visible", () => {
  const c = plat("instagram");

  return (
    c.urlsDescartadas === 3 &&
    c.motivosDeDescarte.some((m) => m.includes("no identifica una cuenta"))
  );
});

await t("… y lo explica en palabras, sin afirmar ausencia", () => {
  const e = plat("instagram").explicacion;

  return e.includes("10") && e.includes("no es una ausencia");
});

await t("TIKTOK: 1 resultado de otra persona -> ENCONTRADA_NO_ATRIBUIDA", () => {
  const c = plat("tiktok");

  return c.estado === "ENCONTRADA_NO_ATRIBUIDA" && c.resultadosDelBuscador === 1;
});

await t("YOUTUBE: consulta OK con CERO resultados -> BUSCADA_SIN_RESULTADO", () => {
  /*
    La contraparte: aqui si es correcto decir que se busco y no
    habia nada, porque el buscador no devolvio ni un enlace. Si
    esta prueba fallara, el patch habria eliminado el estado en
    lugar de arreglarlo.
  */
  const c = plat("youtube");

  return (
    c.estado === "BUSCADA_SIN_RESULTADO" &&
    c.resultadosDelBuscador === 0 &&
    c.urlsDescartadas === 0
  );
});

await t("cada plataforma declara EXACTAMENTE uno de los cinco", () => {
  const ESTADOS = [
    "ATRIBUIDA",
    "ENCONTRADA_NO_ATRIBUIDA",
    "BUSCADA_SIN_RESULTADO",
    "NO_EJECUTADA",
    "ERROR_PROVIDER"
  ];

  return (
    traza.coberturaPlataformas.length === 6 &&
    traza.coberturaPlataformas.every((c) => ESTADOS.includes(c.estado))
  );
});

/*
===========================================================
PROVEEDOR BLOQUEADO Y CONSULTA NO LANZADA
===========================================================
*/

bloque("BUG-15.d  ERROR_PROVIDER y NO_EJECUTADA siguen distinguiéndose");

await t("un proveedor bloqueado da ERROR_PROVIDER, no ausencia", async () => {
  const R = JSON.parse(JSON.stringify(RESULTADO));

  /* YouTube: la consulta se lanza y el proveedor bloquea. */
  R.social.descubrimiento.intentos = R.social.descubrimiento.intentos.map((i) =>
    i.plataformaId === "youtube"
      ? { ...i, estado: "Bloqueado", proveedorUsado: null, resultados: 0 }
      : i
  );

  await ps.agregarCandidato(PID, { nombre: "Caso Bloqueado Prueba" });

  await ps.registrarInvestigacion(PID, "caso-bloqueado-prueba", R);

  const c = await ps.contenidoDeProyecto(PID);

  const x = c.candidatos.find((y) => y.id === "caso-bloqueado-prueba");

  const yt = x.ultimaEjecucion.traza.coberturaPlataformas.find(
    (p) => p.plataformaId === "youtube"
  );

  return (
    yt.estado === "ERROR_PROVIDER" &&
    yt.estado !== "BUSCADA_SIN_RESULTADO" &&
    yt.explicacion.includes("No se puede afirmar ausencia")
  );
});

await t("una plataforma sin consulta lanzada da NO_EJECUTADA", async () => {
  const R = JSON.parse(JSON.stringify(RESULTADO));

  /* Instagram: planificada, nunca lanzada, y sin descartes. */
  R.social.descubrimiento.intentos = R.social.descubrimiento.intentos.filter(
    (i) => i.plataformaId !== "instagram"
  );

  R.social.descubrimiento.descartados =
    R.social.descubrimiento.descartados.filter(
      (d) => d.plataformaId !== "instagram"
    );

  await ps.agregarCandidato(PID, { nombre: "Caso Sin Lanzar Prueba" });

  await ps.registrarInvestigacion(PID, "caso-sin-lanzar-prueba", R);

  const c = await ps.contenidoDeProyecto(PID);

  const x = c.candidatos.find((y) => y.id === "caso-sin-lanzar-prueba");

  const ig = x.ultimaEjecucion.traza.coberturaPlataformas.find(
    (p) => p.plataformaId === "instagram"
  );

  return ig.estado === "NO_EJECUTADA";
});

/*
===========================================================
LA REFERENCIA NO SE AUTOVERIFICA
===========================================================

Hacer visible la procedencia del analista no puede convertirse
en darle credito.
*/

bloque("BUG-15.e  la referencia del analista, intacta");

await t("consta con origen analista", () => {
  const c = social("juancristobal.lloretvaldivieso");

  return c.origen === "analista" && c.aportadaPorAnalista === true;
});

await t("con CERO proveedores y CERO vías corroborantes", () => {
  const c = social("juancristobal.lloretvaldivieso");

  return c.proveedores.length === 0 && c.vias.length === 0;
});

await t("lleva la marca noCuentaComoCorroboracion", () => {
  return social("juancristobal.lloretvaldivieso").noCuentaComoCorroboracion === true;
});

await t("su vía declarada consta aparte, derivada de los orígenes", () => {
  /*
    El consolidador no propaga `viasDeclaradas`; se deriva de los
    origenes marcados. Negarle puntos no es esconderla.
  */
  return social("juancristobal.lloretvaldivieso").viasDeclaradas.includes(
    "cuenta_referencia"
  );
});

await t("una cuenta hallada por proveedor SÍ conserva su corroboración", () => {
  const c = social("jotalloretv");

  return (
    c.origen === "sentinel" &&
    c.proveedores.includes("SerpAPI (Google)") &&
    c.aceptado === true
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
