// apps/backend/tests/accountIntelligence.test.mjs

/*
===========================================================
PRUEBAS DE ACCOUNT INTELLIGENCE FASE 1 (P-CAND-AI-01)
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/accountIntelligence.test.mjs

SIN RED. El `fetchImpl` se inyecta.

LA REGLA QUE MAS IMPORTA
-----------------------------------------------------------

    «el candidato no publica»          NUNCA se afirma
    «no pudimos observar la cuenta»    es lo que se dice

Es la misma doctrina que separa `ausencia` de `no_comprobada` en
la cobertura de plataformas. Un hueco en los datos habla de
nuestros medios, no de la conducta de una persona.

Y `null` no es cero: cero seguidores es un dato, no saberlo es
otra cosa.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const ai = await import("../services/intelligence/accountIntelligence.js");

const ct = await import("../services/intelligence/accountContracts.js");

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

const E = ct.ESTADOS_OBSERVACION;

const cuenta = (plataformaId, handle, url) => ({
  id: `${plataformaId}:${handle}`,
  plataformaId,
  plataforma: plataformaId,
  handle,
  url,
  estado: "REVALIDADA",
  declaradaPorAnalista: true,
  corroboradaPorSentinel: true,
  corroboracion: { totalProveedores: 2 },
  firstSeenAt: "2026-08-20T00:00:00.000Z",
  lastSeenAt: "2026-08-25T00:00:00.000Z",
  lastCheckedAt: "2026-08-25T00:00:00.000Z"
});

function fetchFalso(rutas) {
  const llamadas = [];

  const impl = async (url) => {
    llamadas.push(String(url));

    const r = rutas[String(url)];

    if (!r) {
      return { ok: false, status: 404, headers: { get: () => null }, text: async () => "" };
    }

    if (r.lanza) {
      const e = new Error("abort");

      e.name = "AbortError";

      throw e;
    }

    return {
      ok: (r.status || 200) < 400,
      status: r.status || 200,
      headers: { get: () => null },
      text: async () => r.html || ""
    };
  };

  impl.llamadas = llamadas;

  return impl;
}

/*
===========================================================
CANDIDATO SIN CUENTAS
===========================================================
*/

bloque("candidato sin cuentas");

await t("sin cuentas no hay nada que observar, y se dice", async () => {
  const r = await ai.observarCuentasDelCandidato({
    candidateId: "sin-cuentas",
    cuentas: []
  });

  const resumen = ai.resumenDeCuentas([], r.observaciones);

  return (
    r.observaciones.length === 0 &&
    resumen.cuentasTotales === 0 &&
    resumen.plataformas.every((p) => p.nota?.includes("no hay nada que observar"))
  );
});

await t("y NO se produce ninguna puntuación", () => {
  /*
    Un numero por candidato en esta fase se leeria como un
    ranking politico, y no hay datos para sostener nada parecido.
  */
  const resumen = ai.resumenDeCuentas([], []);

  return (
    resumen.puntuacion === null &&
    resumen.notaPuntuacion.includes("no hay base para comparar")
  );
});

/*
===========================================================
MODO DESCRIPTIVO: NO SALE A LA RED
===========================================================
*/

bloque("abrir el panel no consume nada");

const CUENTAS = [
  cuenta("instagram", "ig", "https://instagram.com/ig"),
  cuenta("web", "sitio", "https://ejemplo-de-prueba.ec"),
  cuenta("linkedin", "li", "https://linkedin.com/in/li")
];

await t("sin ejecutar, no se hace ninguna petición", async () => {
  const f = fetchFalso({});

  const r = await ai.observarCuentasDelCandidato({
    candidateId: "c1",
    cuentas: CUENTAS,
    fetchImpl: f,
    ejecutar: false
  });

  return (
    f.llamadas.length === 0 &&
    r.ejecutado === false &&
    r.observaciones.length === 3
  );
});

await t("cada cuenta declara su estado y su motivo sin haber mirado", async () => {
  const r = await ai.observarCuentasDelCandidato({
    candidateId: "c1",
    cuentas: CUENTAS,
    ejecutar: false
  });

  const ig = r.observaciones.find((o) => o.platform === "instagram");

  const web = r.observaciones.find((o) => o.platform === "web");

  return (
    ig.estado === E.PROVIDER_LIMITED &&
    web.estado === E.NO_EJECUTADA &&
    typeof ig.motivo === "string"
  );
});

/*
===========================================================
OBSERVACION REAL (CON FETCH FALSO)
===========================================================
*/

bloque("observación: estados honestos por plataforma");

await t("una web con metadata queda OBSERVADA", async () => {
  const f = fetchFalso({
    "https://ejemplo-de-prueba.ec": {
      html:
        "<title>Sitio de prueba</title>" +
        '<meta name="description" content="descripcion publica">' +
        '<meta property="og:image" content="https://ejemplo-de-prueba.ec/r.jpg">'
    }
  });

  const r = await ai.observarCuentasDelCandidato({
    candidateId: "c1",
    cuentas: [cuenta("web", "sitio", "https://ejemplo-de-prueba.ec")],
    fetchImpl: f,
    ejecutar: true
  });

  const o = r.observaciones[0];

  return (
    o.estado === E.OBSERVADA &&
    o.profileName === "Sitio de prueba" &&
    o.profileBio === "descripcion publica" &&
    o.metricasDisponibles.includes("title")
  );
});

await t("las métricas siguen en null: la metadata no las trae", async () => {
  /*
    `null` no es cero. Poner cero seguidores seria afirmar algo
    que no se observo.
  */
  const f = fetchFalso({
    "https://ejemplo-de-prueba.ec": { html: "<title>x</title>" }
  });

  const r = await ai.observarCuentasDelCandidato({
    candidateId: "c1",
    cuentas: [cuenta("web", "sitio", "https://ejemplo-de-prueba.ec")],
    fetchImpl: f,
    ejecutar: true
  });

  const o = r.observaciones[0];

  return (
    o.followers === null &&
    o.postsCount === null &&
    o.views === null &&
    o.likes === null
  );
});

await t("una página sin metadata queda SIN_DATOS_PUBLICOS, no vacía", async () => {
  const f = fetchFalso({
    "https://ejemplo-de-prueba.ec": { html: "<html><body>hola</body></html>" }
  });

  const r = await ai.observarCuentasDelCandidato({
    candidateId: "c1",
    cuentas: [cuenta("web", "sitio", "https://ejemplo-de-prueba.ec")],
    fetchImpl: f,
    ejecutar: true
  });

  return (
    r.observaciones[0].estado === E.SIN_DATOS_PUBLICOS &&
    r.observaciones[0].motivo.includes("no declara metadata")
  );
});

await t("un 403 queda PROVIDER_LIMITED, no ERROR", async () => {
  const f = fetchFalso({
    "https://ejemplo-de-prueba.ec": { status: 403 }
  });

  const r = await ai.observarCuentasDelCandidato({
    candidateId: "c1",
    cuentas: [cuenta("web", "sitio", "https://ejemplo-de-prueba.ec")],
    fetchImpl: f,
    ejecutar: true
  });

  return r.observaciones[0].estado === E.PROVIDER_LIMITED;
});

await t("un fallo de red queda ERROR con su motivo", async () => {
  const f = fetchFalso({
    "https://ejemplo-de-prueba.ec": { lanza: true }
  });

  const r = await ai.observarCuentasDelCandidato({
    candidateId: "c1",
    cuentas: [cuenta("web", "sitio", "https://ejemplo-de-prueba.ec")],
    fetchImpl: f,
    ejecutar: true
  });

  return (
    r.observaciones[0].estado === E.ERROR &&
    r.observaciones[0].limitaciones.length > 0
  );
});

await t("Instagram NO se pide: PROVIDER_LIMITED con su motivo", async () => {
  const f = fetchFalso({});

  const r = await ai.observarCuentasDelCandidato({
    candidateId: "c1",
    cuentas: [cuenta("instagram", "ig", "https://instagram.com/ig")],
    fetchImpl: f,
    ejecutar: true
  });

  return (
    f.llamadas.length === 0 &&
    r.observaciones[0].estado === E.PROVIDER_LIMITED &&
    r.observaciones[0].metricasNoDisponibles.length > 0
  );
});

await t("varias plataformas conviven con estados distintos", async () => {
  const f = fetchFalso({
    "https://ejemplo-de-prueba.ec": { html: "<title>ok</title>" }
  });

  const r = await ai.observarCuentasDelCandidato({
    candidateId: "c1",
    cuentas: CUENTAS,
    fetchImpl: f,
    ejecutar: true
  });

  const estados = new Set(r.observaciones.map((o) => o.estado));

  return r.observaciones.length === 3 && estados.size >= 2;
});

await t("hay tope de peticiones: no es scraping masivo", async () => {
  const muchas = Array.from({ length: 8 }, (_, i) =>
    cuenta("web", `s${i}`, `https://ejemplo${i}.ec`)
  );

  const f = fetchFalso({});

  const r = await ai.observarCuentasDelCandidato({
    candidateId: "c1",
    cuentas: muchas,
    fetchImpl: f,
    ejecutar: true
  });

  return (
    f.llamadas.length <= r.topePeticiones &&
    r.observaciones.some((o) => o.motivo?.includes("tope de"))
  );
});

/*
===========================================================
CAPACIDAD POR PLATAFORMA
===========================================================
*/

bloque("el mapa de capacidades es honesto y completo");

await t("las siete plataformas están declaradas", () => {
  const ids = ct.MAPA_PLATAFORMAS.map((p) => p.plataformaId);

  return (
    ids.length === 7 &&
    ["facebook", "instagram", "x", "tiktok", "youtube", "linkedin", "web"].every(
      (x) => ids.includes(x)
    )
  );
});

await t("cada una dice qué necesitamos y quién podría cubrirlo", () => {
  return ct.MAPA_PLATAFORMAS.every(
    (p) =>
      typeof p.motivo === "string" &&
      p.motivo.length > 20 &&
      Array.isArray(p.necesitamos) &&
      "cubrePor" in p
  );
});

await t("ninguna plataforma social declara métricas obtenibles hoy", () => {
  /*
    Es la limitacion dominante y esta declarada, no disimulada.
  */
  return ct.MAPA_PLATAFORMAS.filter((p) => p.plataformaId !== "web").every(
    (p) => p.metricas.length === 0
  );
});

await t("LinkedIn está BLOCKED y la web PUBLIC_METADATA_ONLY", () => {
  return (
    ct.capacidadDe("linkedin").capacidad === "BLOCKED" &&
    ct.capacidadDe("web").capacidad === "PUBLIC_METADATA_ONLY"
  );
});

await t("una plataforma desconocida no rompe: UNSUPPORTED", () => {
  return ct.capacidadDe("mastodon").capacidad === "UNSUPPORTED";
});

/*
===========================================================
SNAPSHOTS APPEND-ONLY
===========================================================
*/

bloque("snapshots: append-only y sin sobrescribir");

const PID = "ai-test";

const CID = "objetivo-de-prueba";

await ps.crearProyecto({
  id: PID,
  nombre: "Proyecto AI",
  canton: "Cuenca",
  pais: "Ecuador",
  dignidad: "Alcaldía"
});

await ps.agregarCandidato(PID, { nombre: "Objetivo De Prueba" });

await t("una observación produce un snapshot con su estado", async () => {
  const r = await ai.observarCuentasDelCandidato({
    candidateId: CID,
    projectId: PID,
    cuentas: [cuenta("web", "sitio", "https://ejemplo-de-prueba.ec")],
    ejecutar: false
  });

  const snaps = ai.snapshotsDeObservaciones(r.observaciones);

  return (
    snaps.length === 1 &&
    snaps[0].accountId === "web:sitio" &&
    snaps[0].estado === E.NO_EJECUTADA &&
    typeof snaps[0].capturedAt === "string"
  );
});

await t("los snapshots se persisten y se recuperan", async () => {
  const r = await ai.observarCuentasDelCandidato({
    candidateId: CID,
    projectId: PID,
    cuentas: [cuenta("web", "sitio", "https://ejemplo-de-prueba.ec")],
    ejecutar: false
  });

  await ps.guardarSnapshots(PID, CID, ai.snapshotsDeObservaciones(r.observaciones));

  const serie = await ps.snapshotsDe(PID, CID);

  return serie.length >= 1 && serie[0].candidatoId === CID;
});

await t("una segunda observación NO sobrescribe la primera", async () => {
  /*
    Sin la serie no hay 7d, 15d, 30d ni 90d, y comparar seria
    inventar.
  */
  const antes = (await ps.snapshotsDe(PID, CID)).length;

  const r = await ai.observarCuentasDelCandidato({
    candidateId: CID,
    projectId: PID,
    cuentas: [cuenta("web", "sitio", "https://ejemplo-de-prueba.ec")],
    ejecutar: false
  });

  /* Instante distinto: es otro hecho, no una version del anterior. */
  const snaps = ai
    .snapshotsDeObservaciones(r.observaciones)
    .map((x) => ({ ...x, capturedAt: new Date(Date.now() + 1000).toISOString() }));

  await ps.guardarSnapshots(PID, CID, snaps);

  const despues = await ps.snapshotsDe(PID, CID);

  return despues.length === antes + 1;
});

await t("la serie viene del más reciente al más antiguo", async () => {
  const serie = await ps.snapshotsDe(PID, CID);

  const fechas = serie.map((x) => x.capturedAt);

  return (
    fechas.length >= 2 &&
    [...fechas].sort().reverse().join("|") === fechas.join("|")
  );
});

await t("el snapshot reserva sitio para Change Attribution", () => {
  /*
    No se implementa, pero el contrato no puede impedirlo
    despues.
  */
  const s = ct.crearSnapshot({ accountId: "a", platform: "web" });

  return (
    "comparacion" in s &&
    "snapshotAnterior" in s.comparacion &&
    "delta" in s.comparacion &&
    "temasActivos" in s.comparacion &&
    s.comparacion.nota.includes("no esta implementado")
  );
});

await t("una relectura conserva los snapshots", async () => {
  const uno = await ps.snapshotsDe(PID, CID);

  const dos = await ps.snapshotsDe(PID, CID);

  return uno.length === dos.length && uno.length > 0;
});

/*
===========================================================
ACTIVIDAD
===========================================================
*/

bloque("actividad: solo lo derivable de observaciones reales");

await t("sin publicaciones observadas NO se etiqueta la actividad", async () => {
  const a = ai.actividadDePublicaciones([]);

  return (
    a.publicacionesObservadas === 0 &&
    a.publicacionesObservadas7d === null &&
    a.frecuenciaPublicacion === null &&
    a.advertencia.includes("NO indica que el candidato no publique")
  );
});

await t("con publicaciones se calcula frecuencia y última actividad", () => {
  const ahora = new Date("2026-08-25T12:00:00.000Z");

  const posts = [
    { postId: "1", publishedAt: "2026-08-24T10:00:00.000Z" },
    { postId: "2", publishedAt: "2026-08-10T10:00:00.000Z" },
    { postId: "3", publishedAt: "2026-05-01T10:00:00.000Z" }
  ];

  const a = ai.actividadDePublicaciones(posts, ahora);

  return (
    a.publicacionesObservadas === 3 &&
    a.publicacionesObservadas7d === 1 &&
    a.publicacionesObservadas30d === 2 &&
    a.ultimaActividad.startsWith("2026-08-24")
  );
});

await t("no existen etiquetas alta/media/baja sin metodología", () => {
  return (
    ai.REGLA_FRECUENCIA.etiquetas === null &&
    ai.REGLA_FRECUENCIA.nota.includes("seria una conjetura")
  );
});

/*
===========================================================
TEMAS PROPIOS vs SOBRE EL CANDIDATO
===========================================================
*/

bloque("temas: propios y externos no se mezclan");

await t("los temas propios declaran su ámbito y qué NO son", () => {
  const r = ai.temasDeLasCuentas([]);

  return (
    r.ambito === "TEMAS_PROPIOS" &&
    r.definicion.includes("del propio candidato") &&
    r.noEs.includes("TEMAS_SOBRE_EL_CANDIDATO")
  );
});

await t("sin publicaciones no hay temas, y se dice", () => {
  const r = ai.temasDeLasCuentas([]);

  return r.temas.length === 0 && r.advertencia.includes("Sin publicaciones");
});

await t("reutiliza el Topic Engine existente, no uno paralelo", async () => {
  const fs = await import("node:fs");

  const texto = fs.readFileSync(
    new URL("../services/intelligence/accountIntelligence.js", import.meta.url),
    "utf8"
  );

  return (
    texto.includes('from "../conversation/topicExtractor.js"') &&
    texto.includes("No se crea uno paralelo")
  );
});

/*
===========================================================
METRICAS NO COMPARABLES
===========================================================
*/

bloque("métricas de plataformas distintas no se comparan");

await t("se declara que no son comparables y no hay equivalencias", () => {
  /*
    Una vista de TikTok, una reaccion de Facebook y un repost de
    X miden cosas distintas. Sumarlas produce un numero que no
    significa nada.
  */
  return (
    ct.METRICAS_NO_COMPARABLES.equivalencias === null &&
    ct.METRICAS_NO_COMPARABLES.nota.includes("no se comparan ni se suman")
  );
});

await t("el resumen agrupa POR plataforma, sin totales cruzados", () => {
  const resumen = ai.resumenDeCuentas(CUENTAS, []);

  return (
    Array.isArray(resumen.plataformas) &&
    resumen.plataformas.length === 7 &&
    !("totalInteracciones" in resumen) &&
    !("engagementTotal" in resumen)
  );
});

/*
===========================================================
CONTRATOS
===========================================================
*/

bloque("contratos: accountId estable y campos opcionales");

await t("el accountId es estable entre observaciones", async () => {
  const c = cuenta("web", "sitio", "https://ejemplo-de-prueba.ec");

  const uno = await ai.observarCuentasDelCandidato({
    candidateId: CID,
    cuentas: [c],
    ejecutar: false
  });

  const dos = await ai.observarCuentasDelCandidato({
    candidateId: CID,
    cuentas: [c],
    ejecutar: false
  });

  return (
    uno.observaciones[0].accountId === dos.observaciones[0].accountId &&
    uno.observaciones[0].accountId === "web:sitio"
  );
});

await t("una publicación no inventa métricas", () => {
  const p = ct.crearPublicacion({ postId: "p1", platform: "web" });

  return Object.values(p.publicMetrics).every((v) => v === null);
});

await t("una observación registra qué obtuvo y qué no", () => {
  const o = ct.crearObservacion({
    accountId: "a",
    metricasDisponibles: ["title"],
    metricasNoDisponibles: ["seguidores"]
  });

  return (
    o.metricasDisponibles.length === 1 && o.metricasNoDisponibles.length === 1
  );
});

await t("la traza dice qué cuenta, qué provider y con qué método", async () => {
  const f = fetchFalso({
    "https://ejemplo-de-prueba.ec": { html: "<title>x</title>" }
  });

  const r = await ai.observarCuentasDelCandidato({
    candidateId: CID,
    projectId: PID,
    cuentas: [cuenta("web", "sitio", "https://ejemplo-de-prueba.ec")],
    fetchImpl: f,
    ejecutar: true
  });

  const o = r.observaciones[0];

  return (
    o.accountId === "web:sitio" &&
    o.provider === "lectura publica" &&
    o.metodo === "metadata_publica" &&
    typeof o.capturedAt === "string" &&
    o.observationId.startsWith("obs-")
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
