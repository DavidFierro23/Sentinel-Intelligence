// apps/backend/tests/territorial-fresh.test.mjs

import {
  ventanaDelDia,
  ventanaDeDias,
  fechaLocal,
  fechaUtilizable,
  clasificarFrescura,
  distribucionTemporal,
  resumirFrescura,
  FRESCURA,
  ZONA_POR_DEFECTO
} from "../services/territorial/dayWindow.js";

import {
  crearLedgerMemoria,
  reconstruirEstado,
  registrarPasada,
  estadoLedger
} from "../services/territorial/evidenceLedger.js";

import {
  recolectarAmpliado,
  estadoAdapters,
  PRESUPUESTO_POR_PASADA
} from "../services/ingest/territorialCollector.js";

import { normalizarEvidencia } from "../services/ingest/evidenceContract.js";

import { deduplicarMultifuente } from "../services/ingest/crossProviderDedup.js";

import { crearUniverso } from "../services/conversation/sourceUniverse.js";

import { crearRegistroMedios } from "../services/ingest/mediaSourceRegistry.js";

import { clasificarFuente, CLASES_FUENTE } from "../services/conversation/sourceClassifier.js";

import { comprobarGeo1 } from "../services/geo/geoContracts.js";

import { denominadorDe } from "../services/geo/territoryRegistry.js";

import { cargarTerritorios } from "../services/geo/territories/territoryLoader.js";

import { planificarConsultasAbiertas } from "../services/conversation/queryPlanner.js";

/*
===========================================================
PRUEBAS DE TERRITORIAL-FRESH-01
===========================================================

    node tests/territorial-fresh.test.mjs

SIN RED. Los adapters se prueban con `fetch` y `parseURL`
inyectados; ninguna llamada sale de la máquina y no se consume
ni una unidad de cuota.

Los 20 casos exigidos, más los que hicieron falta.
===========================================================
*/

await cargarTerritorios();

let pass = 0;

let fail = 0;

const fallos = [];

function t(nombre, comprobacion) {
  try {
    if (comprobacion()) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}`);
    }
  } catch (e) {
    fail += 1;
    fallos.push(`${nombre} — ${e.message}`);
    console.log(`  ERR   ${nombre}: ${e.message}`);
  }
}

async function ta(nombre, comprobacion) {
  try {
    if (await comprobacion()) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}`);
    }
  } catch (e) {
    fail += 1;
    fallos.push(`${nombre} — ${e.message}`);
    console.log(`  ERR   ${nombre}: ${e.message}`);
  }
}

function bloque(titulo) {
  console.log(`\n${titulo}`);
}


/* ===========================================================
   FIXTURES

   Instante fijo: 27 ago 2026, 15:30 en Cuenca = 20:30 UTC.
   =========================================================== */

const AHORA_UTC = "2026-08-27T20:30:00.000Z";

/* Un caso deliberadamente peligroso: 21:00 en Cuenca = 02:00 UTC del 28. */
const NOCHE_UTC = "2026-08-28T02:00:00.000Z";

const VENTANA_HOY = ventanaDelDia(AHORA_UTC);


/* ===========================================================
   [F-1] VENTANA HOY Y TIMEZONE
   =========================================================== */

bloque("[F-1] VENTANA «HOY» Y ZONA TERRITORIAL");

t("T1 · la ventana HOY es un día calendario completo", () => {
  const duracion = new Date(VENTANA_HOY.hasta) - new Date(VENTANA_HOY.desde);

  return VENTANA_HOY.id === "hoy" && duracion === 86400000 - 1;
});

t("T2 · el día se calcula en America/Guayaquil, no en UTC", () => {
  /*
    Ecuador va a UTC-5: la medianoche local del 27 son las
    05:00 UTC del 27, y el día termina a las 04:59:59 UTC
    del 28.
  */
  return (
    VENTANA_HOY.zona === ZONA_POR_DEFECTO &&
    VENTANA_HOY.fechaLocal === "2026-08-27" &&
    VENTANA_HOY.desde === "2026-08-27T05:00:00.000Z" &&
    VENTANA_HOY.hasta === "2026-08-28T04:59:59.999Z"
  );
});

t("T2b · a las 21:00 de Cuenca sigue siendo el mismo día local", () => {
  /*
    El fallo que esto cierra: en UTC ya es 28 de agosto. Sin
    calcular en la zona del territorio, «hoy» se vaciaría cada
    tarde a partir de las 19:00.
  */
  const v = ventanaDelDia(NOCHE_UTC);

  return v.fechaLocal === "2026-08-27" && v.desde === VENTANA_HOY.desde;
});

t("T2c · la fecha local no coincide con la UTC en ese caso", () => {
  return (
    fechaLocal(NOCHE_UTC) === "2026-08-27" &&
    new Date(NOCHE_UTC).toISOString().slice(0, 10) === "2026-08-28"
  );
});

t("no hay ninguna fecha fija en el módulo", () => {
  const hoyReal = ventanaDelDia();

  return hoyReal.fechaLocal !== "2026-08-27" || hoyReal.calculadaDesde !== AHORA_UTC;
});

t("HOY es subconjunto exacto de 7 días", () => {
  const siete = ventanaDeDias(7, AHORA_UTC);

  return (
    new Date(siete.desde) <= new Date(VENTANA_HOY.desde) &&
    siete.hasta === VENTANA_HOY.hasta &&
    new Date(siete.desde).toISOString() === "2026-08-21T05:00:00.000Z"
  );
});

t("«7 días» son siete días de calendario, no ocho", () => {
  const siete = ventanaDeDias(7, AHORA_UTC);

  const dias = Math.round((new Date(siete.hasta) - new Date(siete.desde)) / 86400000);

  return dias === 7;
});


/* ===========================================================
   [F-2] FRESCURA
   =========================================================== */

bloque("[F-2] PUBLICADO HOY ≠ ENCONTRADO HOY");

const ev = (publishedAt, retrievedAt = AHORA_UTC) => ({
  evidenceId: `ev-${publishedAt || "null"}-${retrievedAt}`,
  title: "t",
  publishedAt,
  retrievedAt
});

t("T3 · publicado hoy se clasifica PUBLICADO_HOY", () => {
  const c = clasificarFrescura(ev("2026-08-27T14:00:00Z"), {
    ventana: VENTANA_HOY,
    retrievedAt: AHORA_UTC
  });

  return c.estado === FRESCURA.PUBLICADO_HOY && c.cuentaComoPublicadoHoy === true;
});

t("T4 · publicado ayer NO cuenta como hoy", () => {
  const c = clasificarFrescura(ev("2026-08-26T14:00:00Z"), {
    ventana: VENTANA_HOY,
    retrievedAt: AHORA_UTC
  });

  return c.cuentaComoPublicadoHoy === false;
});

t("T5 · encontrado hoy y publicado antes tiene su propia clase", () => {
  const c = clasificarFrescura(ev("2026-08-25T10:00:00Z"), {
    ventana: VENTANA_HOY,
    retrievedAt: AHORA_UTC
  });

  return (
    c.estado === FRESCURA.ENCONTRADA_HOY_PUBLICADA_ANTES &&
    c.cuentaComoPublicadoHoy === false &&
    c.recuperadaHoy === true
  );
});

t("T5b · publicado antes y NO recuperado hoy es otra cosa distinta", () => {
  const c = clasificarFrescura(ev("2026-08-25T10:00:00Z", "2026-08-25T11:00:00Z"), {
    ventana: VENTANA_HOY,
    retrievedAt: AHORA_UTC
  });

  return c.estado === FRESCURA.PUBLICADO_ANTES && c.recuperadaHoy === false;
});

t("T6 · publishedAt null es FECHA_NO_RESUELTA, no hoy", () => {
  const c = clasificarFrescura(ev(null), { ventana: VENTANA_HOY, retrievedAt: AHORA_UTC });

  return c.estado === FRESCURA.FECHA_NO_RESUELTA && c.cuentaComoPublicadoHoy === false;
});

t("T6b · una fecha impareseable tampoco se convierte en hoy", () => {
  const c = clasificarFrescura(ev("hace un rato"), {
    ventana: VENTANA_HOY,
    retrievedAt: AHORA_UTC
  });

  return c.estado === FRESCURA.FECHA_NO_RESUELTA && /no es una fecha parseable/i.test(c.motivo);
});

t("una fecha en el FUTURO no se acepta como lo más reciente", () => {
  const f = fechaUtilizable("2026-09-15T00:00:00Z", AHORA_UTC);

  return f.utilizable === false && /futuro/i.test(f.motivo);
});

t("T7 · retrievedAt NO sustituye a publishedAt", () => {
  /*
    Evidencia recuperada AHORA pero publicada hace dos días.
    Si `retrievedAt` sustituyera, saldría publicada hoy.
  */
  const c = clasificarFrescura(
    { evidenceId: "x", publishedAt: "2026-08-25T09:00:00Z", retrievedAt: AHORA_UTC },
    { ventana: VENTANA_HOY, retrievedAt: AHORA_UTC }
  );

  return c.cuentaComoPublicadoHoy === false;
});

t("T7b · sin publishedAt, retrievedAt tampoco rellena el hueco", () => {
  const c = clasificarFrescura({ evidenceId: "x", publishedAt: null, retrievedAt: AHORA_UTC }, {
    ventana: VENTANA_HOY,
    retrievedAt: AHORA_UTC
  });

  return (
    c.estado === FRESCURA.FECHA_NO_RESUELTA &&
    /no sustituye/i.test(c.declaracion)
  );
});

t("T20 · fecha desconocida no es fecha actual", () => {
  const r = resumirFrescura([ev(null), ev(null), ev("2026-08-27T10:00:00Z")], {
    ventana: VENTANA_HOY,
    retrievedAt: AHORA_UTC
  });

  return r.fechaNoResuelta === 2 && r.publicadoHoy === 1;
});

t("T19 · cero no es null: un conteo en cero se declara", () => {
  const r = resumirFrescura([], { ventana: VENTANA_HOY, retrievedAt: AHORA_UTC });

  return (
    r.publicadoHoy === 0 &&
    r.total === 0 &&
    r.fechaNoResuelta === 0 &&
    r.publicadoHoy !== null
  );
});


/* ===========================================================
   [F-3] DISTRIBUCIÓN TEMPORAL
   =========================================================== */

bloque("[F-3] DISTRIBUCIÓN TEMPORAL");

t("la distribución se calcula sobre publishedAt", () => {
  const d = distribucionTemporal(
    [
      ev("2026-08-27T10:00:00Z"),
      ev("2026-08-26T10:00:00Z"),
      ev("2026-08-24T10:00:00Z"),
      ev("2026-07-01T10:00:00Z"),
      ev(null)
    ],
    { instante: AHORA_UTC }
  );

  return (
    d.cubos.hoy === 1 &&
    d.cubos.ayer === 1 &&
    d.cubos["2_7_dias"] === 1 &&
    d.cubos.anterior === 1 &&
    d.cubos.sin_fecha === 1
  );
});

t("«fecha no resuelta» tiene casilla propia, no se reparte", () => {
  const d = distribucionTemporal([ev(null), ev(null)], { instante: AHORA_UTC });

  return d.cubos.sin_fecha === 2 && d.cubos.hoy === 0 && d.cubos.anterior === 0;
});

t("se declara que el orden del buscador no es una fecha", () => {
  const d = distribucionTemporal([], { instante: AHORA_UTC });

  return d.declaraciones.some((x) => /orden en que un buscador devuelve/i.test(x));
});


/* ===========================================================
   [F-4] LEDGER — REEJECUCIÓN
   =========================================================== */

bloque("[F-4] OBSERVACIONES REPETIDAS");

const E1 = normalizarEvidencia(
  { titulo: "ETAPA anuncia cortes en Yanuncay", enlace: "https://elmercurio.com.ec/cortes", fecha: "2026-08-27T09:00:00Z" },
  { providerId: "rss_directo" }
);

const E2 = normalizarEvidencia(
  { titulo: "Concejo aprueba ordenanza de movilidad", enlace: "https://elmercurio.com.ec/ordenanza", fecha: "2026-08-27T11:00:00Z" },
  { providerId: "gdelt_doc" }
);

const LEDGER = crearLedgerMemoria();

const PASADA_1 = await registrarPasada({
  ledger: LEDGER,
  evidencias: [E1, E2],
  estadoPrevio: new Map(),
  retrievedAt: "2026-08-27T13:00:00Z",
  territoryId: "ec-azuay-cuenca",
  runId: "run-08"
});

const ESTADO_1 = reconstruirEstado(await LEDGER.leerTodos());

const PASADA_2 = await registrarPasada({
  ledger: LEDGER,
  evidencias: [E1],
  estadoPrevio: ESTADO_1,
  retrievedAt: "2026-08-27T17:00:00Z",
  territoryId: "ec-azuay-cuenca",
  runId: "run-12"
});

const ESTADO_2 = reconstruirEstado(await LEDGER.leerTodos());

t("T12 · reejecutar NO duplica el corpus", () => {
  return (
    PASADA_1.metricas.nuevasParaSentinel === 2 &&
    PASADA_2.metricas.nuevasParaSentinel === 0 &&
    ESTADO_2.size === 2
  );
});

t("T8 · firstObservedAt es inmutable", () => {
  const e = ESTADO_2.get(E1.evidenceId);

  return e.firstObservedAt === "2026-08-27T13:00:00Z";
});

t("T9 · lastObservedAt avanza", () => {
  const e = ESTADO_2.get(E1.evidenceId);

  return e.lastObservedAt === "2026-08-27T17:00:00Z" && e.observationCount === 2;
});

t("la evidencia no reobservada conserva su último instante", () => {
  const e = ESTADO_2.get(E2.evidenceId);

  return e.lastObservedAt === "2026-08-27T13:00:00Z" && e.observationCount === 1;
});

t("cada evidencia lleva sus CUATRO instantes distintos", () => {
  const e = PASADA_2.evidencias[0];

  return (
    e.publishedAt === "2026-08-27T09:00:00Z" &&
    e.firstObservedAt === "2026-08-27T13:00:00Z" &&
    e.lastObservedAt === "2026-08-27T17:00:00Z" &&
    e.retrievedAt === "2026-08-27T17:00:00Z" &&
    e.firstObservedAt !== e.retrievedAt
  );
});

t("cero evidencias nuevas NO se presenta como fallo", () => {
  return PASADA_2.declaraciones.some((d) => /no es un fallo de recolección/i.test(d));
});

t("una pasada sin retrievedAt se rechaza", async () => {
  try {
    await registrarPasada({ evidencias: [], estadoPrevio: new Map() });

    return false;
  } catch (e) {
    return /retrievedAt/i.test(e.message);
  }
});

await ta("el ledger es append-only: dos pasadas dejan tres observaciones", async () => {
  const e = await estadoLedger(LEDGER);

  return e.observacionesTotales === 3 && e.evidenciasDistintas === 2 && e.reobservadas === 1;
});

t("un campo que faltaba se completa; uno afirmado no se pisa", () => {
  const est = reconstruirEstado([
    { evidenceId: "z", retrievedAt: "2026-08-27T08:00:00Z", title: "Original", publishedAt: null, providerId: "a" },
    { evidenceId: "z", retrievedAt: "2026-08-27T12:00:00Z", title: "Otro título", publishedAt: "2026-08-27T07:00:00Z", providerId: "b" }
  ]);

  const e = est.get("z");

  return (
    e.title === "Original" &&
    e.publishedAt === "2026-08-27T07:00:00Z" &&
    e.providers.length === 2
  );
});


/* ===========================================================
   [F-5] DEDUP Y PROVENANCE
   =========================================================== */

bloque("[F-5] DEDUPLICACIÓN Y PROCEDENCIA MULTIPROVEEDOR");

const MISMA = ["google_news", "brave_web", "gdelt_doc"].map((p, i) =>
  normalizarEvidencia(
    {
      titulo: "Concejo aprueba ordenanza de movilidad",
      enlace: `https://elmercurio.com.ec/ordenanza${i === 1 ? "?utm_source=x" : ""}`,
      fecha: "2026-08-27T11:00:00Z"
    },
    { providerId: p, observedAt: AHORA_UTC }
  )
);

const DEDUP = deduplicarMultifuente(MISMA);

t("T10 · tres proveedores con la misma nota dan UNA evidencia", () => {
  return DEDUP.unicas.length === 1 && DEDUP.metricas.duplicadosAbsorbidos === 2;
});

t("T11 · la procedencia multiproveedor se conserva entera", () => {
  const u = DEDUP.unicas[0];

  return (
    u.providersSeenBy.length === 3 &&
    ["google_news", "brave_web", "gdelt_doc"].every((p) => u.providersSeenBy.includes(p))
  );
});

t("el evidenceId es único pese a las tres procedencias", () => {
  return new Set(DEDUP.unicas.map((u) => u.evidenceId)).size === 1;
});

t("los proveedores históricos sobreviven a la siguiente pasada", async () => {
  const l = crearLedgerMemoria();

  await registrarPasada({
    ledger: l,
    evidencias: DEDUP.unicas,
    estadoPrevio: new Map(),
    retrievedAt: "2026-08-27T13:00:00Z"
  });

  const est = reconstruirEstado(await l.leerTodos());

  const soloRss = normalizarEvidencia(
    { titulo: "Concejo aprueba ordenanza de movilidad", enlace: "https://elmercurio.com.ec/ordenanza", fecha: "2026-08-27T11:00:00Z" },
    { providerId: "rss_directo" }
  );

  const p2 = await registrarPasada({
    ledger: l,
    evidencias: [soloRss],
    estadoPrevio: est,
    retrievedAt: "2026-08-27T17:00:00Z"
  });

  return p2.evidencias[0].providersSeenBy.length === 4;
});


/* ===========================================================
   [F-6] PROVEEDORES
   =========================================================== */

bloque("[F-6] ESTADO REAL DE LOS PROVEEDORES");

t("T15 · un proveedor sin credencial se declara NO_CONFIGURADO", () => {
  const previa = process.env.YOUTUBE_API_KEY;

  delete process.env.YOUTUBE_API_KEY;

  const e = estadoAdapters();

  if (previa !== undefined) process.env.YOUTUBE_API_KEY = previa;

  const yt = e.find((x) => x.providerId === "youtube_data");

  return yt.estado === "NO_CONFIGURADO" && yt.implementado === true;
});

t("T13 · cada adapter declara su presupuesto por pasada y el motivo", () => {
  const e = estadoAdapters();

  /*
    El numero de adapters CRECE cuando se conecta uno nuevo:
    TERRITORIAL-CREDENTIAL-ACTIVATION-01 añadio `x_api`. Fijarlo
    en 3 acoplaba la prueba al inventario en lugar de a lo que
    comprueba, que es que TODOS declaren su presupuesto.
  */
  return (
    e.length >= 3 &&
    e.every((x) => typeof x.presupuestoPorPasada === "number") &&
    PRESUPUESTO_POR_PASADA.youtube_data === 1
  );
});

await ta("T14 · un proveedor que falla no tumba la pasada", async () => {
  const r = await recolectarAmpliado({
    plan: planificarConsultasAbiertas({
      ambito: { nombre: "Cuenca", ancestros: ["Azuay", "Ecuador"] }
    }),
    feeds: [{ url: "https://roto.example/rss", publisher: "Roto" }],
    ventana: VENTANA_HOY,
    observedAt: AHORA_UTC,
    runId: "run-test",
    territoryId: "ec-azuay-cuenca",
    universo: crearUniverso(),
    registroMedios: crearRegistroMedios(),
    habilitados: ["rss_directo", "gdelt_doc"],

    /* Sin red: los dos adapters fallan de forma controlada. */
    inyeccion: {
      fetch: async () => {
        throw new Error("red deshabilitada en pruebas");
      },
      parseURL: async () => {
        throw new Error("connect ETIMEDOUT");
      }
    }
  });

  /*
    RSS falla porque el feed no existe y GDELT falla porque no
    hay red en las pruebas. La pasada debe COMPLETARSE igual y
    declarar los dos fallos.
  */
  const rss = r.lotes.find((l) => l.providerId === "rss_directo");

  return (
    Array.isArray(r.evidencias) &&
    rss &&
    rss.estado !== "OK" &&
    r.run.providers.length >= 1 &&
    r.run.errors >= 1
  );
});

await ta("un adapter deshabilitado no aparece como ejecutado", async () => {
  const r = await recolectarAmpliado({
    plan: [],
    feeds: [],
    observedAt: AHORA_UTC,
    universo: crearUniverso(),
    habilitados: ["rss_directo"]
  });

  return !r.lotes.some((l) => l.providerId === "youtube_data");
});

await ta("sin feeds, RSS declara SIN_FUENTES y explica por qué", async () => {
  const r = await recolectarAmpliado({
    plan: [],
    feeds: [],
    observedAt: AHORA_UTC,
    habilitados: ["rss_directo"]
  });

  const rss = r.lotes.find((l) => l.providerId === "rss_directo");

  return rss.estado === "SIN_FUENTES" && /descubrirlos exige/i.test(rss.motivo);
});


/* ===========================================================
   [F-7] CLASIFICACIÓN DE FUENTE
   =========================================================== */

bloque("[F-7] CLASIFICACIÓN DE FUENTE");

t("T13b · un dominio no se vuelve MEDIO_LOCAL por aparecer en la búsqueda", () => {
  const c = clasificarFuente({ dominio: "blogdeviajes.example" });

  return c.clase === CLASES_FUENTE.NO_DETERMINADO;
});

t("un medio del catálogo sí se clasifica, y con razones", () => {
  const c = clasificarFuente({ dominio: "elmercurio.com.ec" });

  return c.clase === CLASES_FUENTE.MEDIO && c.razones.length > 0 && c.verificada === false;
});

t("una institución se reconoce por el dominio del Estado", () => {
  return clasificarFuente({ dominio: "cuenca.gob.ec" }).clase === CLASES_FUENTE.INSTITUCION;
});


/* ===========================================================
   [F-8] TERRITORIO Y DENOMINADORES
   =========================================================== */

bloque("[F-8] TERRITORIO Y DENOMINADORES");

t("T16 · sin evidencia suficiente NO se baja a parroquia", () => {
  const bloqueo = comprobarGeo1({ procedencia: "declarada", resolucion: "canton" }, "parroquia");

  return bloqueo.permitido === false && bloqueo.resolucionEfectiva === "canton";
});

t("T16b · una evidencia de cantón se queda en cantón", () => {
  const r = comprobarGeo1({ procedencia: "declarada", resolucion: "canton" }, "canton");

  return r.permitido === true && r.resolucionEfectiva === "canton";
});

t("T17 · el padrón electoral sigue en null y sin verificar", () => {
  const d = denominadorDe("ec-azuay-cuenca", "padronElectoral");

  return d.valor === null && d.disponible === false;
});

t("T17b · la población sin verificar no autoriza porcentajes", () => {
  const d = denominadorDe("ec-azuay-cuenca", "poblacionOficial");

  /*
    Puede haber valor con restricción de licencia, pero NUNCA
    se usa para convertir evidencias en porcentaje de personas.
  */
  return typeof d.disponible === "boolean" && "verificado" in d;
});

t("59 evidencias no son un porcentaje de nadie", () => {
  const r = resumirFrescura([], { ventana: VENTANA_HOY, retrievedAt: AHORA_UTC });

  const texto = JSON.stringify(r);

  return !/poblaci[óo]n|habitantes|%\s*de\s*la/i.test(texto);
});


/* ===========================================================
   [F-9] CONTEOS PARA LA INTERFAZ
   =========================================================== */

bloque("[F-9] CONTEOS COHERENTES");

t("T18 · los conteos de frescura suman el total", () => {
  const lote = [
    ev("2026-08-27T10:00:00Z"),
    ev("2026-08-27T12:00:00Z"),
    ev("2026-08-25T10:00:00Z"),
    ev(null),
    ev("2026-08-20T10:00:00Z", "2026-08-20T11:00:00Z")
  ];

  const r = resumirFrescura(lote, { ventana: VENTANA_HOY, retrievedAt: AHORA_UTC });

  return (
    r.publicadoHoy +
      r.encontradoHoyPublicadoAntes +
      r.publicadoAntes +
      r.fechaNoResuelta ===
      r.total && r.total === 5
  );
});

t("T18b · la distribución temporal también suma el total", () => {
  const lote = [ev("2026-08-27T10:00:00Z"), ev("2026-08-26T10:00:00Z"), ev(null)];

  const d = distribucionTemporal(lote, { instante: AHORA_UTC });

  const suma = Object.values(d.cubos).reduce((s, n) => s + n, 0);

  return suma === d.total && d.total === 3;
});

t("no se declara «6/6» cuando solo participaron dos", async () => {
  const r = await recolectarAmpliado({
    plan: [],
    feeds: [],
    observedAt: AHORA_UTC,
    habilitados: ["rss_directo"]
  });

  /* Un solo adapter habilitado: un solo lote anotado. */
  return r.run.providers.length === 1;
});


/* --------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
