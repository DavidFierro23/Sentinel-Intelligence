// apps/backend/tests/crossLinkEvidence.test.mjs

/*
===========================================================
PRUEBAS DE P-CAND-02 — CROSS-LINK + OBSERVACION REAL
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/crossLinkEvidence.test.mjs

SIN RED. El `fetchImpl` se inyecta y cada caso declara que
devuelve cada URL.

LO QUE ESTAS PRUEBAS DEFIENDEN
-----------------------------------------------------------

1 · UN ENLACE CRUZADO CORROBORA; UN PARECIDO NO.
    Ni el nombre, ni el handle, ni la palabra del analista.

2 · UNA RELACION VISTA CIEN VECES ES UNA SEÑAL.
    Si cada observacion contara, la corroboracion se inflaria
    sola volviendo a mirar la misma pagina.

3 · `firstObservedAt` NO SE REESCRIBE.
    Es la respuesta a «cuando lo vimos por primera vez» y una
    reescritura la borraria sin dejar rastro.

4 · LAS METRICAS SON SNAPSHOTS.
    100k ayer y 150k hoy son dos observaciones, no un campo que
    cambio de valor.

5 · null NO ES 0.

6 · NADA SE MEZCLA ENTRE PROYECTOS NI ENTRE CANDIDATOS.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const xl = await import("../services/intelligence/crossLinkEvidence.js");

const ef = await import("../services/intelligence/evidenceFirst.js");

const po = await import("../services/intelligence/publicationObservation.js");

const pap = await import("../services/intelligence/platformAdapterPort.js");

const res = await import("../services/intelligence/accountResolution.js");

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
===========================================================
FIXTURES
===========================================================
*/

/* Un fetch falso: cada ruta declara su respuesta. */
function fetchFalso(rutas) {
  return async (url) => {
    const clave = Object.keys(rutas).find((k) => String(url).includes(k));

    const r = rutas[clave];

    if (!r) return { ok: false, status: 404, text: async () => "" };

    if (r.lanza) throw new Error(r.lanza);

    return {
      ok: r.status ? r.status < 400 : true,
      status: r.status || 200,
      text: async () => r.html || ""
    };
  };
}


const WEB_CON_ENLACES = `
<!doctype html><html><body>
  <a href="https://www.instagram.com/cuenta_ficticia_uno">Instagram</a>
  <a href="https://www.tiktok.com/@cuenta_ficticia_uno">TikTok</a>
  <a href="/contacto">Contacto</a>
  <a href="https://www.instagram.com/p/ABC123/">una publicacion</a>
  <a href="https://ejemplo-cualquiera.test/nota">una nota</a>
  <a href="mailto:info@ejemplo.test">correo</a>
</body></html>`;

const WEB_SIN_ENLACES = `<!doctype html><html><body><p>Sin enlaces sociales.</p></body></html>`;


/*
===========================================================
1 · ENLACES SALIENTES
===========================================================
*/
bloque("extraccion de enlaces salientes");

await t("se extraen los enlaces absolutos y se resuelven los relativos", () => {
  const e = xl.extraerEnlacesSalientes(WEB_CON_ENLACES, "https://sitio-ficticio.test/inicio");

  return (
    e.includes("https://www.instagram.com/cuenta_ficticia_uno") &&
    e.some((x) => x === "https://sitio-ficticio.test/contacto")
  );
});

await t("mailto y tel se descartan", () => {
  const e = xl.extraerEnlacesSalientes(WEB_CON_ENLACES, "https://sitio-ficticio.test/");

  return !e.some((x) => x.startsWith("mailto:"));
});

await t("no se ejecuta JavaScript ni se sigue nada mas alla del documento", async () => {
  const { readFile } = await import("node:fs/promises");

  const src = await readFile(
    new URL("../services/intelligence/crossLinkEvidence.js", import.meta.url),
    "utf8"
  );

  /* Ni motor de navegador ni evaluacion dinamica. */
  return !/puppeteer|playwright|jsdom|\beval\(/.test(src);
});

bloque("identificacion de cuentas: la hace SD-1A");

await t("un perfil se reconoce como cuenta con su plataforma y handle", () => {
  const { cuentas } = xl.cuentasEnlazadas([
    "https://www.instagram.com/cuenta_ficticia_uno"
  ]);

  return (
    cuentas.length === 1 &&
    cuentas[0].plataformaId === "instagram" &&
    cuentas[0].handle === "cuenta_ficticia_uno"
  );
});

await t("una URL de contenido sin propietario NO se acepta como cuenta", () => {
  const { cuentas, descartados } = xl.cuentasEnlazadas([
    "https://www.instagram.com/p/ABC123/"
  ]);

  return cuentas.length === 0 && descartados.length === 1;
});

await t("un dominio que no es de plataforma se descarta con su motivo", () => {
  const { cuentas, descartados } = xl.cuentasEnlazadas([
    "https://ejemplo-cualquiera.test/nota"
  ]);

  return cuentas.length === 0 && !!descartados[0].motivo;
});


/*
===========================================================
2 · CROSS-LINK VALIDO Y SUS LIMITES
===========================================================
*/
bloque("cross-link valido");

const FUENTE_WEB = {
  url: "https://sitio-ficticio.test/",
  plataformaId: "web",
  sourceType: "web_del_expediente",
  direccion: xl.DIRECCIONES.WEB_TO_ACCOUNT,
  declaradaPorAnalista: true
};

await t("una web legible que enlaza cuentas produce senales independientes", async () => {
  const r = await xl.observarEnlacesSalientes({
    candidateId: "cand-x",
    projectId: "proy-x",
    fuentes: [FUENTE_WEB],
    fetchImpl: fetchFalso({ "sitio-ficticio.test": { html: WEB_CON_ENLACES } }),
    ejecutar: true
  });

  return (
    r.senales.length === 2 &&
    r.senales.every((s) => s.independiente === true) &&
    r.intentos[0].estado === xl.ESTADOS_CROSSLINK.OBSERVADA
  );
});

await t("cada senal guarda los campos minimos del contrato", async () => {
  const r = await xl.observarEnlacesSalientes({
    candidateId: "cand-x",
    projectId: "proy-x",
    fuentes: [FUENTE_WEB],
    fetchImpl: fetchFalso({ "sitio-ficticio.test": { html: WEB_CON_ENLACES } }),
    ejecutar: true
  });

  const s = r.senales[0];

  return (
    !!s.candidateId &&
    !!s.accountId &&
    !!s.sourceUrl &&
    !!s.targetUrl &&
    !!s.platformId &&
    !!s.handle &&
    !!s.observedAt &&
    !!s.evidenceId &&
    !!s.provenance &&
    !!s.observationMethod
  );
});

await t("la cadena de confianza dice que la semilla la puso el analista", async () => {
  const r = await xl.observarEnlacesSalientes({
    candidateId: "cand-x",
    fuentes: [FUENTE_WEB],
    fetchImpl: fetchFalso({ "sitio-ficticio.test": { html: WEB_CON_ENLACES } }),
    ejecutar: true
  });

  const c = r.senales[0].provenance.cadenaDeConfianza;

  return (
    r.senales[0].provenance.fuenteDeclaradaPorAnalista === true &&
    c.some((x) => x.includes("el analista declaro la pagina de origen")) &&
    c.some((x) => x.includes("la pagina publica el enlace"))
  );
});

await t("una pagina que se lee y no enlaza nada: SIN_ENLACES, no error", async () => {
  const r = await xl.observarEnlacesSalientes({
    candidateId: "cand-x",
    fuentes: [FUENTE_WEB],
    fetchImpl: fetchFalso({ "sitio-ficticio.test": { html: WEB_SIN_ENLACES } }),
    ejecutar: true
  });

  return (
    r.senales.length === 0 &&
    r.intentos[0].estado === xl.ESTADOS_CROSSLINK.SIN_ENLACES
  );
});

await t("un 403 se declara BLOQUEADA y no se intenta de otra forma", async () => {
  const r = await xl.observarEnlacesSalientes({
    candidateId: "cand-x",
    fuentes: [FUENTE_WEB],
    fetchImpl: fetchFalso({ "sitio-ficticio.test": { status: 403 } }),
    ejecutar: true
  });

  return (
    r.intentos[0].estado === xl.ESTADOS_CROSSLINK.BLOQUEADA &&
    r.paginasLeidas === 1
  );
});

await t("sin ejecutar no se pide ni una pagina", async () => {
  let llamadas = 0;

  await xl.observarEnlacesSalientes({
    candidateId: "cand-x",
    fuentes: [FUENTE_WEB],
    fetchImpl: async () => {
      llamadas += 1;

      return { ok: true, status: 200, text: async () => "" };
    },
    ejecutar: false
  });

  return llamadas === 0;
});

await t("una plataforma bloqueada no se lee: se declara y no se pide", async () => {
  let llamadas = 0;

  const r = await xl.observarEnlacesSalientes({
    candidateId: "cand-x",
    fuentes: [
      {
        url: "https://www.linkedin.com/in/alguien",
        plataformaId: "linkedin",
        direccion: xl.DIRECCIONES.ACCOUNT_TO_ACCOUNT,
        origenCorroborado: true
      }
    ],
    fetchImpl: async () => {
      llamadas += 1;

      return { ok: true, status: 200, text: async () => "" };
    },
    ejecutar: true
  });

  return llamadas === 0 && r.intentos[0].estado === xl.ESTADOS_CROSSLINK.NO_EJECUTADA;
});

bloque("anticircularidad");

await t("una cuenta SIN corroborar no puede corroborar a otra", async () => {
  let llamadas = 0;

  const r = await xl.observarEnlacesSalientes({
    candidateId: "cand-x",
    fuentes: [
      {
        url: "https://www.facebook.com/pagina_ficticia",
        plataformaId: "facebook",
        direccion: xl.DIRECCIONES.ACCOUNT_TO_ACCOUNT,
        origenCorroborado: false
      }
    ],
    fetchImpl: async () => {
      llamadas += 1;

      return { ok: true, status: 200, text: async () => WEB_CON_ENLACES };
    },
    ejecutar: true
  });

  return (
    llamadas === 0 &&
    r.senales.length === 0 &&
    r.intentos[0].motivo.includes("circular")
  );
});

const FUENTE_CUENTA_CORROBORADA = {
  url: "https://www.facebook.com/pagina_ficticia",
  plataformaId: "facebook",
  direccion: xl.DIRECCIONES.ACCOUNT_TO_ACCOUNT,
  origenCorroborado: true
};

await t("con el origen corroborado si se lee", async () => {
  const r = await xl.observarEnlacesSalientes({
    candidateId: "cand-x",
    fuentes: [FUENTE_CUENTA_CORROBORADA],
    fetchImpl: fetchFalso({ "facebook.com": { html: WEB_CON_ENLACES } }),
    ejecutar: true
  });

  return r.senales.length === 2 && r.paginasLeidas === 1;
});

/*
  Encontrado al escribir estas pruebas: el enlace relativo
  `/contacto` de una pagina de Facebook se resuelve a
  `facebook.com/contacto`, que SD-1A reconoce —con razon— como
  una cuenta. Aceptarlo fabricaria una cuenta corroborada por
  cada elemento del menu.
*/
await t("un enlace del mismo dominio NO produce senal: es navegacion", async () => {
  const r = await xl.observarEnlacesSalientes({
    candidateId: "cand-x",
    fuentes: [FUENTE_CUENTA_CORROBORADA],
    fetchImpl: fetchFalso({ "facebook.com": { html: WEB_CON_ENLACES } }),
    ejecutar: true
  });

  return !r.senales.some((s) => s.platformId === "facebook");
});

await t("y el descarte se declara en lugar de quedar en silencio", async () => {
  const r = await xl.observarEnlacesSalientes({
    candidateId: "cand-x",
    fuentes: [FUENTE_CUENTA_CORROBORADA],
    fetchImpl: fetchFalso({ "facebook.com": { html: WEB_CON_ENLACES } }),
    ejecutar: true
  });

  return (
    r.intentos[0].descartadosPorMismoDominio === 1 &&
    r.intentos[0].notaMismoDominio.includes("fabricaria corroboracion")
  );
});

bloque("direccionalidad: tres direcciones, tres senales distintas");

await t("las tres direcciones existen y no se tratan igual", () => {
  const d = Object.keys(xl.DIRECCIONES);

  return (
    d.length === 3 &&
    xl.FUERZA_DIRECCION.WEB_TO_ACCOUNT.senalDeResolucion === "web_declarada" &&
    xl.FUERZA_DIRECCION.ACCOUNT_TO_ACCOUNT.senalDeResolucion === "enlace_cruzado" &&
    xl.FUERZA_DIRECCION.EXTERNAL_REFERENCE_TO_ACCOUNT.senalDeResolucion ===
      "referencia_independiente"
  );
});

await t("solo ACCOUNT_TO_ACCOUNT exige que el origen este corroborado", () => {
  return (
    xl.FUERZA_DIRECCION.ACCOUNT_TO_ACCOUNT.exigeOrigenCorroborado === true &&
    !xl.FUERZA_DIRECCION.WEB_TO_ACCOUNT.exigeOrigenCorroborado
  );
});

await t("la direccion viaja en la senal y en su relationId", () => {
  const s = xl.crearSenalCrossLink({
    direccion: xl.DIRECCIONES.EXTERNAL_REFERENCE_TO_ACCOUNT,
    sourceUrl: "https://medio-ficticio.test/nota",
    accountId: "x:handle_ficticio",
    candidateId: "cand-x"
  });

  return (
    s.direccion === "EXTERNAL_REFERENCE_TO_ACCOUNT" &&
    s.relationId.includes("EXTERNAL_REFERENCE_TO_ACCOUNT")
  );
});


/*
===========================================================
3 · DEDUPLICACION E HISTORICO
===========================================================
*/
bloque("deduplicacion: la misma relacion no se cuenta dos veces");

const SENAL = (observedAt, evidenceId) =>
  xl.crearSenalCrossLink({
    candidateId: "cand-x",
    accountId: "instagram:cuenta_ficticia_uno",
    direccion: xl.DIRECCIONES.WEB_TO_ACCOUNT,
    sourceUrl: "https://sitio-ficticio.test/",
    targetUrl: "https://www.instagram.com/cuenta_ficticia_uno",
    platformId: "instagram",
    handle: "cuenta_ficticia_uno",
    observedAt,
    evidenceId
  });

await t("la misma relacion vista dos veces sigue siendo UNA senal", () => {
  const r = xl.fusionarSenales(
    [SENAL("2026-08-20T10:00:00.000Z", "ev-1")],
    [SENAL("2026-08-25T10:00:00.000Z", "ev-2")]
  );

  return r.total === 1;
});

await t("pero se cuentan las observaciones", () => {
  const r = xl.fusionarSenales(
    [SENAL("2026-08-20T10:00:00.000Z", "ev-1")],
    [SENAL("2026-08-25T10:00:00.000Z", "ev-2")]
  );

  return r.senales[0].observationCount === 2;
});

await t("firstObservedAt NO se reescribe al reobservar", () => {
  const r = xl.fusionarSenales(
    [SENAL("2026-08-20T10:00:00.000Z", "ev-1")],
    [SENAL("2026-08-25T10:00:00.000Z", "ev-2")]
  );

  return r.senales[0].firstObservedAt === "2026-08-20T10:00:00.000Z";
});

await t("lastObservedAt si avanza", () => {
  const r = xl.fusionarSenales(
    [SENAL("2026-08-20T10:00:00.000Z", "ev-1")],
    [SENAL("2026-08-25T10:00:00.000Z", "ev-2")]
  );

  return r.senales[0].lastObservedAt === "2026-08-25T10:00:00.000Z";
});

await t("las evidencias se acumulan: dos rutas, una relacion, dos evidencias", () => {
  const r = xl.fusionarSenales(
    [SENAL("2026-08-20T10:00:00.000Z", "ev-1")],
    [SENAL("2026-08-25T10:00:00.000Z", "ev-2")]
  );

  return (
    r.senales[0].evidenceIds.length === 2 &&
    r.senales[0].evidenceIds.includes("ev-1") &&
    r.senales[0].evidenceIds.includes("ev-2")
  );
});

await t("una relacion nueva se declara como aparecida", () => {
  const otra = xl.crearSenalCrossLink({
    candidateId: "cand-x",
    accountId: "tiktok:otra_ficticia",
    direccion: xl.DIRECCIONES.WEB_TO_ACCOUNT,
    sourceUrl: "https://sitio-ficticio.test/",
    observedAt: "2026-08-25T10:00:00.000Z"
  });

  const r = xl.fusionarSenales([SENAL("2026-08-20T10:00:00.000Z", "ev-1")], [otra]);

  return r.total === 2 && r.aparecidas.length === 1;
});

await t("una relacion que esta vez no se vio NO se borra", () => {
  const r = xl.fusionarSenales([SENAL("2026-08-20T10:00:00.000Z", "ev-1")], []);

  return r.total === 1 && r.noReobservadas.length === 1;
});

await t("la nota explica que observaciones no son senales", () => {
  const r = xl.fusionarSenales([], []);

  return r.nota.includes("cuenta observaciones, no señales") ||
    r.nota.includes("cuenta observaciones, no senales");
});


/*
===========================================================
4 · INTEGRACION CON ACCOUNT RESOLUTION
===========================================================
*/
bloque("account resolution: que corrobora y que no");

const CUENTA_SOLO_NOMBRE = {
  id: "instagram:cuenta_ficticia_uno",
  plataformaId: "instagram",
  handle: "cuenta_ficticia_uno",
  url: "https://www.instagram.com/cuenta_ficticia_uno",
  estado: "DECLARADA_POR_ANALISTA",
  declaradaPorAnalista: true,
  correspondencia: 97,
  proveedoresHistoricos: ["serpapi"],
  corroboracion: { totalProveedores: 1, multiProveedor: false, multiVia: false }
};

await t("declarada por el analista y con nombre casi perfecto: NO corrobora", () => {
  const r = res.resolverCuenta(CUENTA_SOLO_NOMBRE, { enlacesCruzados: [] });

  return (
    r.estado === res.ESTADOS_RESOLUCION.DECLARADA &&
    r.solidez.senalesIndependientes.length === 0
  );
});

await t("con un cross-link desde la web SI corrobora", () => {
  const senales = [
    SENAL("2026-08-20T10:00:00.000Z", "ev-1")
  ];

  const r = res.resolverCuenta(CUENTA_SOLO_NOMBRE, {
    enlacesCruzados: xl.enlacesParaResolucion(senales)
  });

  return (
    r.solidez.senalesIndependientes.includes("web_declarada") &&
    r.estado !== res.ESTADOS_RESOLUCION.DECLARADA &&
    r.estado !== res.ESTADOS_RESOLUCION.CANDIDATA
  );
});

await t("el handle parecido en otra plataforma sigue sin corroborar", () => {
  const r = res.resolverCuenta(
    { ...CUENTA_SOLO_NOMBRE, propagadaPorHandle: true, declaradaPorAnalista: false },
    { enlacesCruzados: [] }
  );

  return (
    r.estado === res.ESTADOS_RESOLUCION.CANDIDATA &&
    r.senales.some((s) => s.id === "coincidencia_handle" && s.independiente === false)
  );
});

await t("cien observaciones del mismo enlace siguen siendo UNA senal independiente", () => {
  const s = SENAL("2026-08-20T10:00:00.000Z", "ev-1");

  s.observationCount = 100;

  const r = res.resolverCuenta(CUENTA_SOLO_NOMBRE, {
    enlacesCruzados: xl.enlacesParaResolucion([s])
  });

  /* 25 puntos por UNA senal independiente distinta, no 100. */
  return r.solidez.valor === 25;
});

await t("la traduccion a enlacesCruzados conserva la trazabilidad", () => {
  const e = xl.enlacesParaResolucion([SENAL("2026-08-20T10:00:00.000Z", "ev-1")]);

  return (
    e[0].desde === "web" &&
    e[0].hacia === "instagram:cuenta_ficticia_uno" &&
    !!e[0].relationId &&
    e[0].evidenceIds.includes("ev-1") &&
    !!e[0].firstObservedAt
  );
});

await t("una senal descartada no llega al resolvedor", () => {
  const s = SENAL("2026-08-20T10:00:00.000Z", "ev-1");

  s.descartada = true;

  return xl.enlacesParaResolucion([s]).length === 0;
});

bloque("varias cuentas en la misma plataforma");

await t("dos cuentas de Instagram: solo asciende la que tiene el enlace", () => {
  const otra = {
    id: "instagram:cuenta_ficticia_dos",
    plataformaId: "instagram",
    handle: "cuenta_ficticia_dos",
    correspondencia: 95
  };

  const r = res.resolverCuentasDelCandidato({
    candidateId: "cand-x",
    cuentas: [CUENTA_SOLO_NOMBRE, otra],
    enlacesCruzados: xl.enlacesParaResolucion([
      SENAL("2026-08-20T10:00:00.000Z", "ev-1")
    ])
  });

  const uno = r.cuentas.find((c) => c.handle === "cuenta_ficticia_uno");

  const dos = r.cuentas.find((c) => c.handle === "cuenta_ficticia_dos");

  return (
    uno.solidez.valor === 25 &&
    dos.solidez.valor === 0 &&
    dos.estado === res.ESTADOS_RESOLUCION.CANDIDATA
  );
});

await t("y la pluralidad se declara sin corregirla", () => {
  const r = res.resolverCuentasDelCandidato({
    candidateId: "cand-x",
    cuentas: [
      CUENTA_SOLO_NOMBRE,
      { id: "instagram:cuenta_ficticia_dos", plataformaId: "instagram", handle: "cuenta_ficticia_dos" }
    ]
  });

  return r.resumen.multiplesPorPlataforma.length === 1;
});


/*
===========================================================
5 · EVIDENCE-FIRST
===========================================================
*/
bloque("evidence-first: sin evidencia no hay afirmacion");

await t("una afirmacion sin evidencia NO se sostiene y dice que falta", () => {
  const a = ef.crearAfirmacion({ insight: "Rendimiento destacado" });

  return (
    a.sostenida === false &&
    a.faltan.includes("evidenceIds") &&
    a.faltan.includes("canonicalUrl")
  );
});

await t("con la cadena completa si se sostiene", () => {
  const a = ef.crearAfirmacion({
    insight: "Rendimiento destacado",
    evidenceIds: ["ev-1"],
    observedAt: "2026-09-02T14:10:00.000Z",
    canonicalUrl: "https://plataforma-ficticia.test/p/1",
    source: "adapter_ficticio",
    metric: { tipo: "absolutePerformance", value: 1284531, unidad: "visualizaciones" }
  });

  return a.sostenida === true && a.estado === ef.ESTADOS_AFIRMACION.SOSTENIDA;
});

await t("«Ver evidencia» apunta a la URL canonica de la publicacion", () => {
  const a = ef.crearAfirmacion({
    insight: "Rendimiento destacado",
    evidenceIds: ["ev-1"],
    observedAt: "2026-09-02T14:10:00.000Z",
    canonicalUrl: "https://plataforma-ficticia.test/p/1",
    source: "adapter_ficticio"
  });

  return a.verEvidencia === "https://plataforma-ficticia.test/p/1";
});

await t("la palabra «viral» invalida la afirmacion, no se limpia", () => {
  const a = ef.crearAfirmacion({
    insight: "Publicacion viral del candidato",
    evidenceIds: ["ev-1"],
    observedAt: "2026-09-02T14:10:00.000Z",
    canonicalUrl: "https://plataforma-ficticia.test/p/1",
    source: "adapter_ficticio"
  });

  return (
    a.sostenida === false && a.faltan.some((f) => f.includes("etiqueta prohibida"))
  );
});

await t("una metrica sin valor se declara no disponible", () => {
  const a = ef.crearAfirmacion({
    insight: "Rendimiento",
    evidenceIds: ["ev-1"],
    observedAt: "2026-09-02T14:10:00.000Z",
    canonicalUrl: "https://plataforma-ficticia.test/p/1",
    source: "x",
    metric: { tipo: "absolutePerformance", value: null }
  });

  return a.metric.disponible === false && a.metric.value === null;
});

await t("los cuatro tipos de metrica existen y ninguno esta disponible", () => {
  const e = ef.estadoDeMetricas();

  return (
    e.total === 4 &&
    e.disponibles === 0 &&
    e.tipos.every((x) => typeof x.metodologia === "string" && x.requisitos.length > 0)
  );
});

await t("no existe ninguna etiqueta de viralidad", () => {
  return (
    ef.ETIQUETAS_PROHIBIDAS.includes("viral") &&
    ef.estadoDeMetricas().nota.includes("no hay umbral defendible")
  );
});

await t("velocity declara que exige dos observaciones", () => {
  return ef.TIPOS_METRICA.velocity.metodologia.includes("DOS observaciones");
});


/*
===========================================================
6 · PUBLICACIONES Y METRICAS COMO SNAPSHOTS
===========================================================
*/
bloque("metricas: snapshots, no campos");

const PUB = (over = {}) =>
  po.crearPublicacionObservada({
    candidateId: "cand-x",
    accountId: "youtube:canal_ficticio",
    platformId: "youtube",
    canonicalUrl: "https://www.youtube.com/watch?v=FICTICIO1",
    publishedAt: "2026-08-15T09:00:00.000Z",
    evidenceId: "ev-pub-1",
    ...over
  });

const METRICA = (value, observedAt, extra = {}) =>
  po.crearSnapshotDeMetrica({
    metrica: "views",
    value,
    observedAt,
    provider: "adapter_ficticio",
    source: "https://www.youtube.com/watch?v=FICTICIO1",
    ...extra
  });

await t("100k ayer y 150k hoy son DOS observaciones, no una sustitucion", () => {
  const ayer = PUB({
    firstObservedAt: "2026-08-24T10:00:00.000Z",
    metricas: [METRICA(100000, "2026-08-24T10:00:00.000Z")]
  });

  const hoy = PUB({
    firstObservedAt: "2026-08-25T10:00:00.000Z",
    metricas: [METRICA(150000, "2026-08-25T10:00:00.000Z")]
  });

  const f = po.fusionarPublicacion(ayer, hoy);

  return (
    f.metricas.length === 2 &&
    f.metricas[0].value === 100000 &&
    f.metricas[1].value === 150000
  );
});

await t("firstObservedAt de la publicacion no se reescribe", () => {
  const ayer = PUB({ firstObservedAt: "2026-08-24T10:00:00.000Z" });

  const hoy = PUB({ firstObservedAt: "2026-08-25T10:00:00.000Z" });

  const f = po.fusionarPublicacion(ayer, hoy);

  return (
    f.firstObservedAt === "2026-08-24T10:00:00.000Z" &&
    f.lastObservedAt === "2026-08-25T10:00:00.000Z" &&
    f.observationCount === 2
  );
});

await t("publishedAt y firstObservedAt son campos distintos y se conservan los dos", () => {
  const p = PUB({ firstObservedAt: "2026-08-24T10:00:00.000Z" });

  return (
    p.publishedAt === "2026-08-15T09:00:00.000Z" &&
    p.firstObservedAt === "2026-08-24T10:00:00.000Z"
  );
});

await t("canonicalUrl se preserva y el publicationId se deriva de ella", () => {
  const a = PUB();

  const b = PUB();

  return (
    a.canonicalUrl === "https://www.youtube.com/watch?v=FICTICIO1" &&
    a.publicationId === b.publicationId
  );
});

await t("el evidenceId viaja con la publicacion y es trazable", () => {
  const p = PUB();

  return p.evidenceId === "ev-pub-1" && p.evidenceIds.includes("ev-pub-1");
});

await t("un snapshot identico no se duplica", () => {
  const uno = PUB({ metricas: [METRICA(100000, "2026-08-24T10:00:00.000Z")] });

  const otro = PUB({ metricas: [METRICA(100000, "2026-08-24T10:00:00.000Z")] });

  return po.fusionarPublicacion(uno, otro).metricas.length === 1;
});

await t("null no se convierte en 0: se declara NO_DISPONIBLE con su motivo", () => {
  const m = po.crearSnapshotDeMetrica({
    metrica: "likes",
    value: null,
    observedAt: "2026-08-25T10:00:00.000Z",
    motivo: "el proveedor no incluye likes"
  });

  return (
    m.value === null &&
    m.availability === po.DISPONIBILIDAD.NO_DISPONIBLE &&
    m.nota.includes("`null` no es cero")
  );
});

await t("cero SI es un dato y se marca disponible", () => {
  const m = po.crearSnapshotDeMetrica({
    metrica: "comments",
    value: 0,
    observedAt: "2026-08-25T10:00:00.000Z"
  });

  return m.value === 0 && m.availability === po.DISPONIBILIDAD.DISPONIBLE;
});

await t("una metrica oculta por la cuenta no es lo mismo que no tenerla", () => {
  const m = po.crearSnapshotDeMetrica({
    metrica: "subscribers",
    value: null,
    observedAt: "2026-08-25T10:00:00.000Z",
    availability: po.DISPONIBILIDAD.OCULTO_POR_LA_CUENTA
  });

  return m.availability === "OCULTO_POR_LA_CUENTA";
});

bloque("series y velocidad");

await t("una sola observacion NO produce velocidad", () => {
  const p = PUB({ metricas: [METRICA(100000, "2026-08-24T10:00:00.000Z")] });

  const s = po.serieDeMetrica(p, "views");

  return s.comparable === false && s.velocidad === null && !!s.motivo;
});

await t("dos observaciones producen delta y velocidad por hora", () => {
  const p = PUB({
    metricas: [
      METRICA(100000, "2026-08-24T10:00:00.000Z"),
      METRICA(150000, "2026-08-25T10:00:00.000Z")
    ]
  });

  const s = po.serieDeMetrica(p, "views");

  return s.comparable === true && s.delta === 50000 && s.ventana.horas === 24;
});

await t("las metricas no disponibles no entran en la serie y se cuentan aparte", () => {
  const p = PUB({
    metricas: [
      METRICA(100000, "2026-08-24T10:00:00.000Z"),
      METRICA(null, "2026-08-25T10:00:00.000Z", { motivo: "no vino" })
    ]
  });

  const s = po.serieDeMetrica(p, "views");

  return s.observaciones === 1 && s.ausentes === 1 && s.comparable === false;
});

await t("sin publicaciones el resumen no afirma que el candidato no publique", () => {
  const r = po.resumenDePublicaciones([]);

  return r.nota.includes("NO significa que el candidato no publique");
});


/*
===========================================================
7 · PUERTO DE ADAPTADORES / YOUTUBE
===========================================================
*/
bloque("puerto de adaptadores: sin credencial no se invoca nada");

await t("YouTube no queda LISTO sin credencial", async () => {
  delete process.env.YOUTUBE_API_KEY;

  delete process.env.YOUTUBE_DATA_API_KEY;

  const r = await pap.resolverAdaptador("youtube");

  /*
    Dos resultados legitimos: SIN_CREDENCIAL si el adaptador de
    la linea de ingesta esta presente, ADAPTADOR_NO_DISPONIBLE
    si no lo esta. Lo que NO puede pasar es que quede LISTO.
  */
  return (
    r.estado === pap.ESTADOS_ADAPTADOR.SIN_CREDENCIAL ||
    r.estado === pap.ESTADOS_ADAPTADOR.ADAPTADOR_NO_DISPONIBLE
  );
});

await t("un adaptador ausente se declara y NO lanza excepcion", async () => {
  const r = await pap.resolverAdaptador("youtube", {
    ruta: "../ingest/adapters/noExisteEsteAdaptador.js"
  });

  return (
    r.estado === pap.ESTADOS_ADAPTADOR.ADAPTADOR_NO_DISPONIBLE &&
    r.motivo.includes("sigue funcionando sin el")
  );
});

await t("LinkedIn no es aplicable: la plataforma lo bloquea", async () => {
  const r = await pap.resolverAdaptador("linkedin");

  return r.estado === pap.ESTADOS_ADAPTADOR.NO_APLICABLE;
});

await t("las cuatro capacidades requeridas estan declaradas", () => {
  return (
    pap.CAPACIDADES_REQUERIDAS.length === 4 &&
    pap.CAPACIDADES_REQUERIDAS.some((c) => c.id === "estadisticas_de_publicacion")
  );
});

await t("comprobar la preparacion NO consume cuota ni sale a la red", async () => {
  const r = await pap.preparacionParaObservacionReal(["youtube"]);

  return r.nota.includes("Ninguna cuota se consume") && r.puedeObservarAlgo === false;
});

await t("la accion requerida nombra la variable de entorno exacta", async () => {
  const r = await pap.preparacionParaObservacionReal(["youtube"]);

  /* Solo si hay adaptador presente hay accion que pedir. */
  return (
    r.accionRequerida.length === 0 ||
    r.accionRequerida[0].variable === "YOUTUBE_API_KEY"
  );
});

await t("ninguna credencial aparece escrita en el codigo de este gate", async () => {
  const { readFile } = await import("node:fs/promises");

  const archivos = [
    "crossLinkEvidence.js",
    "evidenceFirst.js",
    "publicationObservation.js",
    "platformAdapterPort.js"
  ];

  /*
    Se busca la FORMA de una clave, no una clave concreta: una
    asignacion literal a algo que se llame key, token o secret.
  */
  const sospechoso = /(api[_-]?key|token|secret)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i;

  for (const a of archivos) {
    const src = await readFile(
      new URL(`../services/intelligence/${a}`, import.meta.url),
      "utf8"
    );

    if (sospechoso.test(src)) return `${a} contiene algo con forma de credencial`;
  }

  return true;
});


/*
===========================================================
8 · PERSISTENCIA Y AISLAMIENTO
===========================================================
*/
bloque("persistencia longitudinal y aislamiento");

const P1 = "xl-proy-uno";

const P2 = "xl-proy-dos";

await ps.crearProyecto({
  id: P1,
  nombre: "Proyecto Uno",
  canton: "Canton Ficticio A",
  pais: "Ecuador",
  dignidad: "Alcaldía"
});

await ps.crearProyecto({
  id: P2,
  nombre: "Proyecto Dos",
  canton: "Canton Ficticio B",
  pais: "Ecuador",
  dignidad: "Alcaldía"
});

/* MISMO NOMBRE en dos proyectos distintos: no se pueden mezclar. */
await ps.agregarCandidato(P1, { nombre: "Nombre Repetido Ficticio" });

await ps.agregarCandidato(P2, { nombre: "Nombre Repetido Ficticio" });

await ps.agregarCandidato(P1, { nombre: "Otra Persona Ficticia" });

const C_REP = "nombre-repetido-ficticio";

const C_OTRA = "otra-persona-ficticia";

await t("un lote de senales se persiste", async () => {
  const r = await ps.guardarSenalesCrossLink(
    P1,
    C_REP,
    [SENAL("2026-08-20T10:00:00.000Z", "ev-1")],
    { observadoEn: "2026-08-20T10:00:00.000Z", intentos: [] }
  );

  return r.escrito === true && r.total === 1;
});

await t("un segundo lote NO sobrescribe el primero", async () => {
  await ps.guardarSenalesCrossLink(
    P1,
    C_REP,
    [SENAL("2026-08-25T10:00:00.000Z", "ev-2")],
    { observadoEn: "2026-08-25T10:00:00.000Z" }
  );

  const r = await ps.senalesCrossLinkDe(P1, C_REP);

  return r.lotes === 2;
});

await t("al leer, la relacion repetida esta fusionada en UNA senal", async () => {
  const r = await ps.senalesCrossLinkDe(P1, C_REP);

  return r.total === 1 && r.senales[0].observationCount === 2;
});

await t("y conserva la PRIMERA observacion, del Lake real", async () => {
  const r = await ps.senalesCrossLinkDe(P1, C_REP);

  return r.senales[0].firstObservedAt === "2026-08-20T10:00:00.000Z";
});

await t("MISMO NOMBRE en otro proyecto: no ve ninguna senal", async () => {
  const r = await ps.senalesCrossLinkDe(P2, C_REP);

  return r.total === 0 && r.lotes === 0;
});

await t("otro candidato del MISMO proyecto tampoco las ve", async () => {
  const r = await ps.senalesCrossLinkDe(P1, C_OTRA);

  return r.total === 0;
});

bloque("publicaciones persistidas");

await t("las publicaciones se persisten con sus metricas", async () => {
  const r = await ps.guardarPublicaciones(
    P1,
    C_REP,
    [PUB({ firstObservedAt: "2026-08-24T10:00:00.000Z", metricas: [METRICA(100000, "2026-08-24T10:00:00.000Z")] })],
    { observadoEn: "2026-08-24T10:00:00.000Z", provider: "adapter_ficticio" }
  );

  return r.escrito === true;
});

await t("una segunda observacion ACUMULA la serie en lugar de sustituirla", async () => {
  await ps.guardarPublicaciones(
    P1,
    C_REP,
    [PUB({ firstObservedAt: "2026-08-25T10:00:00.000Z", metricas: [METRICA(150000, "2026-08-25T10:00:00.000Z")] })],
    { observadoEn: "2026-08-25T10:00:00.000Z" }
  );

  const r = await ps.publicacionesDe(P1, C_REP);

  return (
    r.total === 1 &&
    r.publicaciones[0].metricas.length === 2 &&
    r.snapshotsDeMetricas === 2
  );
});

await t("la serie leida del Lake permite calcular delta real", async () => {
  const r = await ps.publicacionesDe(P1, C_REP);

  const s = po.serieDeMetrica(r.publicaciones[0], "views");

  return s.comparable === true && s.delta === 50000;
});

await t("y firstObservedAt sigue siendo el original tras dos lotes", async () => {
  const r = await ps.publicacionesDe(P1, C_REP);

  return r.publicaciones[0].firstObservedAt === "2026-08-24T10:00:00.000Z";
});

await t("las publicaciones no se filtran a otro proyecto", async () => {
  const r = await ps.publicacionesDe(P2, C_REP);

  return r.total === 0;
});

bloque("independencia de proyecto y candidato");

await t("el motor no depende de ningun territorio ni dignidad", () => {
  /* Los mismos fixtures con otro contexto dan la misma estructura. */
  const a = res.resolverCuentasDelCandidato({
    candidateId: "cualquiera-a",
    projectId: "proyecto-loja",
    cuentas: [CUENTA_SOLO_NOMBRE],
    enlacesCruzados: xl.enlacesParaResolucion([SENAL("2026-08-20T10:00:00.000Z", "ev-1")])
  });

  const b = res.resolverCuentasDelCandidato({
    candidateId: "cualquiera-b",
    projectId: "proyecto-quito",
    cuentas: [CUENTA_SOLO_NOMBRE],
    enlacesCruzados: xl.enlacesParaResolucion([SENAL("2026-08-20T10:00:00.000Z", "ev-1")])
  });

  return (
    a.cuentas[0].estado === b.cuentas[0].estado &&
    a.cuentas[0].solidez.valor === b.cuentas[0].solidez.valor &&
    a.cuentas[0].projectId !== b.cuentas[0].projectId
  );
});

await t("ningun modulo de P-CAND-02 menciona un candidato o territorio concreto", async () => {
  const { readFile } = await import("node:fs/promises");

  const archivos = [
    "crossLinkEvidence.js",
    "evidenceFirst.js",
    "publicationObservation.js",
    "platformAdapterPort.js"
  ];

  /*
    Compuesto en trozos para que la prueba no contenga
    literalmente lo que prohibe: se inspeccionaria a si misma y
    pasaria siempre.
  */
  const prohibidos = [
    ["jota", "lloret"].join(""),
    ["cue", "nca"].join(""),
    ["az", "uay"].join("")
  ];

  for (const a of archivos) {
    const src = (
      await readFile(
        new URL(`../services/intelligence/${a}`, import.meta.url),
        "utf8"
      )
    ).toLowerCase();

    const hallado = prohibidos.find((p) => src.includes(p));

    if (hallado) return `${a} menciona "${hallado}"`;
  }

  return true;
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
