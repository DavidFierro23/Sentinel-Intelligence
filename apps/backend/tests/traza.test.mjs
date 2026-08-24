// apps/backend/tests/traza.test.mjs

/*
===========================================================
PRUEBAS DE LA TRAZA DE AUDITORIA (BUG-12 y BUG-11)
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/traza.test.mjs

SIN RED Y SIN CUOTA. El resultado de investigacion es un objeto
FIJO escrito aqui, con la forma que el motor produce. No se
llama a ningun proveedor.

QUE SE PROTEGE
-----------------------------------------------------------

El diagnostico del piloto no pudo responder por que una
plataforma quedo vacia, porque `resumirExpediente` calculaba la
traza y la tiraba al persistir. Estas pruebas fijan que
SOBREVIVE al viaje completo:

    resultado -> registrarInvestigacion -> Knowledge Lake
              -> contenidoDeProyecto -> lo que ve la interfaz

Un test que solo comprobara el objeto en memoria no serviria:
el defecto estaba justamente en el paso de persistir.

Y fijan la distincion que sostiene todo el contrato: "se busco
y no habia nada" no es lo mismo que "no se pudo mirar".
Colapsarlas convierte una limitacion nuestra en una afirmacion
sobre una persona.
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
EL RESULTADO FIJO
===========================================================

Reproduce el caso real de Lloret y añade a proposito los cinco
estados de plataforma, para que el contrato quede ejercitado
entero y no solo en el camino feliz.
*/

const RESULTADO = {
  perfilEjecutivo: {
    huellaDigital: { valor: 22 },

    /* ATRIBUIDA — X */
    tarjetas: [
      {
        plataforma: "X",
        plataformaId: "x",
        handle: "jotalloretv",
        url: "https://x.com/jotalloretv",
        correspondencia: 31,
        nivel: "posible",
        proveedores: ["SerpAPI (Google)"]
      },
      {
        plataforma: "Facebook",
        plataformaId: "facebook",
        handle: "juancristobal.lloretvaldivieso",
        url: "https://www.facebook.com/juancristobal.lloretvaldivieso",
        correspondencia: 25,
        nivel: "posible",
        proveedores: []
      }
    ],

    /* ENCONTRADA_NO_ATRIBUIDA — Instagram: un medio */
    medios: [
      {
        plataforma: "Instagram",
        plataformaId: "instagram",
        handle: "unsiontv",
        url: "https://www.instagram.com/unsiontv",
        motivo: "el handle contiene «tv», propio de un medio"
      }
    ],

    instituciones: [],

    /* ENCONTRADA_NO_ATRIBUIDA — Instagram: rechazada por apellido */
    indeterminadas: [
      {
        plataforma: "Instagram",
        plataformaId: "instagram",
        handle: "juancristobalmora",
        url: "https://www.instagram.com/juancristobalmora",
        motivo:
          "coincide en juan, cristobal, que son nombres de pila, pero en ningún apellido (lloret / valdivieso)"
      }
    ]
  },

  social: {
    /* Lo que el Discovery declara por plataforma. */
    cobertura: [
      { plataformaId: "x", plataforma: "X", candidatos: 1, estadoPresencia: "inferida", motivoCobertura: "1 candidato(s) descubierto(s)." },
      { plataformaId: "facebook", plataforma: "Facebook", candidatos: 1, estadoPresencia: "inferida", motivoCobertura: "1 candidato(s) descubierto(s)." },
      { plataformaId: "instagram", plataforma: "Instagram", candidatos: 2, estadoPresencia: "inferida", motivoCobertura: "2 candidato(s) descubierto(s)." },
      { plataformaId: "youtube", plataforma: "YouTube", candidatos: 0, estadoPresencia: "ausencia", motivoCobertura: "Se consultó correctamente y no se encontró presencia." },
      { plataformaId: "tiktok", plataforma: "TikTok", candidatos: 0, estadoPresencia: "no_comprobada", motivoCobertura: "Se intentó consultar pero el proveedor no respondió (BLOQUEADO)." },
      { plataformaId: "linkedin", plataforma: "LinkedIn", candidatos: 0, estadoPresencia: "no_comprobada", motivoCobertura: "No se planificó ninguna consulta para esta plataforma." }
    ],

    candidatos: [
      {
        plataforma: "X",
        plataformaId: "x",
        handle: "jotalloretv",
        url: "https://x.com/jotalloretv",
        vias: ["consulta_dirigida"],
        viasDeclaradas: [],
        proveedores: ["SerpAPI (Google)"],
        aportadaPorAnalista: false,
        origenes: [{ via: "consulta_dirigida", proveedor: "SerpAPI (Google)", consulta: 'site:x.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia' }]
      },
      {
        plataforma: "Facebook",
        plataformaId: "facebook",
        handle: "juancristobal.lloretvaldivieso",
        url: "https://www.facebook.com/juancristobal.lloretvaldivieso",
        vias: [],
        viasDeclaradas: ["cuenta_referencia"],
        proveedores: [],
        aportadaPorAnalista: true,
        origenes: [{ via: "cuenta_referencia", proveedor: null, origen: "analista", noCuentaComoCorroboracion: true }]
      },
      {
        plataforma: "Instagram",
        plataformaId: "instagram",
        handle: "unsiontv",
        url: "https://www.instagram.com/unsiontv",
        vias: ["consulta_dirigida"],
        viasDeclaradas: [],
        proveedores: ["DuckDuckGo Web"],
        aportadaPorAnalista: false,
        origenes: [{ via: "consulta_dirigida", proveedor: "DuckDuckGo Web", consulta: 'site:instagram.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia' }]
      },
      {
        plataforma: "Instagram",
        plataformaId: "instagram",
        handle: "juancristobalmora",
        url: "https://www.instagram.com/juancristobalmora",
        vias: ["consulta_dirigida"],
        viasDeclaradas: [],
        proveedores: ["DuckDuckGo Web"],
        aportadaPorAnalista: false,
        origenes: [{ via: "consulta_dirigida", proveedor: "DuckDuckGo Web", consulta: 'site:instagram.com "Juan Cristóbal Lloret Valdivieso"' }]
      }
    ],

    descubrimiento: {
      anclasUsadas: [{ termino: "Cuenca" }, { termino: "alcaldia" }],
      aliasUsados: ["Jota Lloret"],
      advertencias: ["Ningún perfil fue leído: no hay Platform Scanner."],

      plan: [
        { consulta: 'site:x.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia', etiqueta: "identidad:x", plataformaId: "x" },
        { consulta: 'site:facebook.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia', etiqueta: "identidad:facebook_pages", plataformaId: "facebook" },
        { consulta: 'site:instagram.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia', etiqueta: "identidad:instagram", plataformaId: "instagram" },
        { consulta: 'site:youtube.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia', etiqueta: "identidad:youtube", plataformaId: "youtube" },
        { consulta: 'site:tiktok.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia', etiqueta: "identidad:tiktok", plataformaId: "tiktok" },
        /* Planificada y NUNCA lanzada: es la que crea NO_EJECUTADA. */
        { consulta: 'site:linkedin.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia', etiqueta: "identidad:linkedin", plataformaId: "linkedin" },
        { consulta: 'site:instagram.com "Juan Cristóbal Lloret Valdivieso"', etiqueta: "nombre:instagram", plataformaId: "instagram" }
      ],

      intentos: [
        { consulta: 'site:x.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia', etiqueta: "identidad:x", plataformaId: "x", proveedorUsado: "SerpAPI (Google)", estado: "OK", resultados: 4 },
        { consulta: 'site:facebook.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia', etiqueta: "identidad:facebook_pages", plataformaId: "facebook", proveedorUsado: "SerpAPI (Google)", estado: "OK", resultados: 0 },
        { consulta: 'site:instagram.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia', etiqueta: "identidad:instagram", plataformaId: "instagram", proveedorUsado: "DuckDuckGo Web", estado: "OK", resultados: 2 },
        { consulta: 'site:youtube.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia', etiqueta: "identidad:youtube", plataformaId: "youtube", proveedorUsado: "SerpAPI (Google)", estado: "OK", resultados: 0 },
        /* Se intento y el proveedor bloqueo: NO es ausencia. */
        { consulta: 'site:tiktok.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia', etiqueta: "identidad:tiktok", plataformaId: "tiktok", proveedorUsado: "DuckDuckGo Web", estado: "BLOQUEADO", resultados: 0 },
        { consulta: 'site:instagram.com "Juan Cristóbal Lloret Valdivieso"', etiqueta: "nombre:instagram", plataformaId: "instagram", proveedorUsado: "DuckDuckGo Web", estado: "OK", resultados: 1 }
      ],

      descartados: [
        { url: "https://www.instagram.com/p/DcRCcfKnEjY/", plataforma: { nombre: "Instagram" }, motivo: "no_cuenta: la URL no identifica una cuenta", tipo: "no_cuenta" }
      ],

      proveedores: {
        proveedores: [
          { id: "serpapi", nombre: "SerpAPI (Google)", intentos: 3, exitos: 3, bloqueos: 0, errores: 0, noIntentados: 0, resultados: 4 },
          { id: "duckduckgo", nombre: "DuckDuckGo Web", intentos: 3, exitos: 2, bloqueos: 1, errores: 0, noIntentados: 0, resultados: 3 }
        ]
      }
    }
  },

  fichaObjetivo: { evidencias: { web: new Array(28).fill({}) } }
};

/* Montaje: proyecto, candidato con referencia, e investigacion. */
const proyecto = await ps.crearProyecto({
  id: "traza-test",
  nombre: "Proyecto traza",
  canton: "Cuenca",
  provincia: "Azuay",
  pais: "Ecuador",
  dignidad: "Alcaldía de Cuenca"
});

await ps.agregarCandidato(proyecto.proyecto.id, {
  nombre: "Juan Cristóbal Lloret Valdivieso",
  facebook: "https://www.facebook.com/juancristobal.lloretvaldivieso"
});

await ps.registrarInvestigacion(
  proyecto.proyecto.id,
  "juan-cristobal-lloret-valdivieso",
  RESULTADO
);

/* LO QUE VE LA INTERFAZ: releido del Lake, no el objeto en memoria. */
const contenido = await ps.contenidoDeProyecto(proyecto.proyecto.id);

const cand = contenido.candidatos.find(
  (c) => c.id === "juan-cristobal-lloret-valdivieso"
);

const traza = cand?.expediente?.traza;

const porPlataforma = (id) =>
  (traza?.coberturaPlataformas || []).find((c) => c.plataformaId === id);

/*
===========================================================
BUG-12.a — LA TRAZA SOBREVIVE A LA PERSISTENCIA
===========================================================
*/

bloque("BUG-12.a  la traza sobrevive al Knowledge Lake");

await t("el expediente releído tiene traza", () => {
  return !!traza && traza.version === "1.0";
});

await t("las consultas ejecutadas sobreviven, con proveedor y resultados", () => {
  const q = (traza.consultas || []).find((x) =>
    x.consulta.includes("site:x.com")
  );

  return (
    q.ejecutada === true &&
    q.proveedor === "SerpAPI (Google)" &&
    q.estado === "OK" &&
    q.resultados === 4 &&
    q.plataformaId === "x"
  );
});

await t("una consulta planificada y NO lanzada también consta", () => {
  /*
    Es la que permite decir NO_EJECUTADA en lugar de inventar
    una ausencia.
  */
  const q = (traza.consultas || []).find((x) =>
    x.consulta.includes("site:linkedin.com")
  );

  return q.ejecutada === false && q.estado === "NO_EJECUTADA";
});

await t("se declara el total y si algo se truncó", () => {
  return (
    traza.totalConsultas === 7 &&
    traza.consultasTruncadas === 0 &&
    traza.candidatosTruncados === 0
  );
});

await t("el consumo por proveedor sobrevive, en consultas", () => {
  const p = (traza.proveedores || []).find(
    (x) => x.proveedor === "DuckDuckGo Web"
  );

  return (
    p.consultasIntentadas === 3 &&
    p.consultasCompletadas === 2 &&
    p.bloqueos === 1 &&
    p.resultados === 3
  );
});

await t("NO se inventa un coste monetario", () => {
  /*
    El sistema no conoce el precio de una consulta. Estimarlo
    seria presentar una cifra inventada como dato.
  */
  return (traza.proveedores || []).every(
    (p) => p.costeMonetario === null && typeof p.notaDeCoste === "string"
  );
});

await t("las anclas y los alias usados sobreviven", () => {
  return (
    traza.anclasUsadas.join(",") === "Cuenca,alcaldia" &&
    traza.aliasUsados.includes("Jota Lloret")
  );
});

/*
===========================================================
BUG-12.b — CONTRATO DE FULL DISCOVERY
===========================================================
*/

bloque("BUG-12.b  las 6 plataformas declaran uno de 5 estados");

const OBLIGATORIAS = ["facebook", "instagram", "x", "tiktok", "youtube", "linkedin"];

const ESTADOS = [
  "ATRIBUIDA",
  "ENCONTRADA_NO_ATRIBUIDA",
  "BUSCADA_SIN_RESULTADO",
  "NO_EJECUTADA",
  "ERROR_PROVIDER"
];

await t("las seis plataformas obligatorias están presentes", () => {
  return OBLIGATORIAS.every((id) => !!porPlataforma(id));
});

await t("cada una declara EXACTAMENTE uno de los cinco estados", () => {
  return (traza.coberturaPlataformas || []).every((c) =>
    ESTADOS.includes(c.estado)
  );
});

await t("X con cuenta atribuida -> ATRIBUIDA", () => {
  return porPlataforma("x").estado === "ATRIBUIDA";
});

await t("Instagram con candidatos y ninguno aceptado -> ENCONTRADA_NO_ATRIBUIDA", () => {
  /*
    El estado que el diagnostico del piloto no podia ver, y el
    unico que permite preguntar si el matcher esta perdiendo
    cuentas que el Discovery si encontro.
  */
  const c = porPlataforma("instagram");

  return c.estado === "ENCONTRADA_NO_ATRIBUIDA" && c.candidatos === 2;
});

await t("YouTube consultada con éxito y vacía -> BUSCADA_SIN_RESULTADO", () => {
  return porPlataforma("youtube").estado === "BUSCADA_SIN_RESULTADO";
});

await t("TikTok con proveedor bloqueado -> ERROR_PROVIDER, NO ausencia", () => {
  /*
    LA DISTINCION QUE IMPORTA. Declarar ausencia tras un bloqueo
    afirmaria que la cuenta no existe cuando no pudimos mirar.
  */
  const c = porPlataforma("tiktok");

  return (
    c.estado === "ERROR_PROVIDER" &&
    c.estadosDeProveedor.includes("BLOQUEADO") &&
    c.estado !== "BUSCADA_SIN_RESULTADO"
  );
});

await t("LinkedIn sin consulta lanzada -> NO_EJECUTADA", () => {
  return porPlataforma("linkedin").estado === "NO_EJECUTADA";
});

await t("ningún estado afirma que la persona no tenga cuenta", () => {
  return typeof traza.contrato === "string" && traza.contrato.includes("Ninguno");
});

/*
===========================================================
BUG-12.c — CANDIDATOS RECHAZADOS Y SU MOTIVO
===========================================================
*/

bloque("BUG-12.c  los rechazados sobreviven, con motivo y proveedor");

const social = (h) =>
  (traza.candidatosSociales || []).find((c) => c.handle === h);

await t("los cuatro candidatos sociales sobreviven", () => {
  return traza.totalCandidatosSociales === 4;
});

await t("una cuenta rechazada por apellido conserva su motivo", () => {
  const c = social("juancristobalmora");

  return (
    c.aceptado === false &&
    c.clase === "no_determinado" &&
    c.motivo.includes("apellido")
  );
});

await t("un medio rechazado conserva su motivo", () => {
  const c = social("unsiontv");

  return c.aceptado === false && c.clase === "medio";
});

await t("cada rechazado dice qué query lo encontró", () => {
  /*
    Sin esto no se puede saber si una consulta funciono y el
    matcher perdio la cuenta, o si la consulta nunca la trajo.
  */
  return social("juancristobalmora").consultas.some((q) =>
    q.includes("site:instagram.com")
  );
});

await t("el proveedor queda trazable en cada candidato", () => {
  return (
    social("jotalloretv").proveedores.includes("SerpAPI (Google)") &&
    social("unsiontv").proveedores.includes("DuckDuckGo Web")
  );
});

await t("las cuentas aceptadas conservan su score", () => {
  return social("jotalloretv").aceptado === true && social("jotalloretv").score === 31;
});

await t("las URLs descartadas por SD-1A también constan", () => {
  const d = (traza.urlsDescartadas || [])[0];

  return d.url.includes("/p/") && d.motivo.includes("no_cuenta");
});

/*
===========================================================
BUG-12.d — LA REFERENCIA SIGUE SIN AUTOVERIFICARSE
===========================================================

La traza no puede convertirse en una puerta trasera: hacer
observable el origen del analista no es darle credito.
*/

bloque("BUG-12.d  la referencia del analista sigue sin corroborarse");

await t("la cuenta de referencia consta con origen analista", () => {
  const c = social("juancristobal.lloretvaldivieso");

  return c.origen === "analista" && c.aportadaPorAnalista === true;
});

await t("y con CERO proveedores: no se autoverifica", () => {
  const c = social("juancristobal.lloretvaldivieso");

  return c.proveedores.length === 0 && c.vias.length === 0;
});

await t("su vía declarada consta aparte, sin corroborar", () => {
  return social("juancristobal.lloretvaldivieso").viasDeclaradas.includes(
    "cuenta_referencia"
  );
});

/*
===========================================================
BUG-11 — EL ESTADO PERSISTE Y LLEGA A LA INTERFAZ
===========================================================
*/

bloque("BUG-11  el estado de la investigación persiste");

await t("estadoInvestigacion queda en completada tras investigar", () => {
  return cand.estadoInvestigacion === "completada";
});

await t("se deriva del expediente, no de una bandera suelta", () => {
  /*
    Un candidato sin investigar no puede aparecer como
    completado.
  */
  return (
    contenido.candidatos
      .filter((c) => !c.expediente)
      .every((c) => c.estadoInvestigacion === "sin_investigar")
  );
});

await t("el resumen que lee la tarjeta llega completo", () => {
  return (
    cand.resumen.cuentas === 2 &&
    cand.resumen.huellaDigital === 22 &&
    typeof cand.resumen.actualizadoEn === "string"
  );
});

await t("hay última actualización para mostrar", () => {
  return cand.resumen.actualizadoEn.length >= 16;
});

await t("volver a investigar actualiza y no duplica", async () => {
  await ps.registrarInvestigacion(
    proyecto.proyecto.id,
    "juan-cristobal-lloret-valdivieso",
    RESULTADO
  );

  const c2 = await ps.contenidoDeProyecto(proyecto.proyecto.id);

  return (
    c2.candidatos.filter((x) => x.id === "juan-cristobal-lloret-valdivieso")
      .length === 1 &&
    c2.candidatos.find((x) => x.id === "juan-cristobal-lloret-valdivieso")
      .estadoInvestigacion === "completada"
  );
});

/*
===========================================================
ROBUSTEZ
===========================================================
*/

bloque("robustez  un resultado incompleto no rompe la persistencia");

await t("un resultado sin capa social se persiste igual", async () => {
  await ps.agregarCandidato(proyecto.proyecto.id, { nombre: "Sin Datos Prueba" });

  await ps.registrarInvestigacion(proyecto.proyecto.id, "sin-datos-prueba", {
    perfilEjecutivo: { huellaDigital: { valor: 0 }, tarjetas: [] }
  });

  const c = await ps.contenidoDeProyecto(proyecto.proyecto.id);

  const x = c.candidatos.find((y) => y.id === "sin-datos-prueba");

  return (
    x.estadoInvestigacion === "completada" &&
    Array.isArray(x.expediente.traza.consultas) &&
    x.expediente.traza.coberturaPlataformas.length === 0
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
