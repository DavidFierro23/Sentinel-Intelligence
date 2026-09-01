// apps/backend/tests/territorial-listening.test.mjs

import {
  TIPOS_FIRMA,
  firmaIdDe,
  clasificarFirma,
  construirUniversoDeFirmas
} from "../services/territorial/journalistUniverse.js";

import {
  crearLedgerMemoria,
  reconstruirEstado,
  registrarPasada,
  firmaMinimizada
} from "../services/territorial/evidenceLedger.js";

import {
  ESTADOS_COBERTURA,
  construirMatrizDeCobertura
} from "../services/territorial/listeningCoverage.js";

import {
  candidatosPara,
  METODOS_DESCUBRIMIENTO
} from "../services/territorial/verifiedSourceUniverse.js";

/*
===========================================================
PRUEBAS DE TERRITORIAL-OPEN-LISTENING-EXPANSION-01
===========================================================

    node tests/territorial-listening.test.mjs

SIN RED.

Este gate añade dos cosas y las dos tienen el mismo riesgo:
convertir una señal debil en una afirmacion fuerte.

    una FIRMA no es un periodista
    un dominio DESCUBIERTO no es una fuente local

Estas pruebas defienden esas dos fronteras, y la de privacidad:
guardar una firma no puede convertirse en guardar un perfil.
===========================================================
*/

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

let llamadasDeRed = 0;

const fetchOriginal = globalThis.fetch;

globalThis.fetch = () => {
  llamadasDeRed += 1;

  return Promise.reject(new Error("RED PROHIBIDA EN LAS PRUEBAS"));
};

const T0 = "2026-09-01T10:00:00.000Z";

const T1 = "2026-09-01T18:00:00.000Z";

const CUENCA = "ec-azuay-cuenca";


/* =========================================================
   1. FIRMA NO ES PERIODISTA
   ========================================================= */

console.log("\n--- Firmas: qué es y qué no es una persona ---\n");

t("una firma con nombre y apellido se promueve a PERSONA", () => {
  const c = clasificarFirma("Andrés Mazza");

  return c.tipo === TIPOS_FIRMA.PERSONA && c.confianza >= 0.5;
});

t("una etiqueta editorial NO es una persona", () =>
  clasificarFirma("Redes Sociales").tipo === TIPOS_FIRMA.SECCION &&
  clasificarFirma("Redacción").tipo === TIPOS_FIRMA.SECCION &&
  clasificarFirma("Administrador").tipo === TIPOS_FIRMA.SECCION);

t("la clasificación de PERSONA lleva su advertencia de heurística", () => {
  const c = clasificarFirma("Juan Pablo Campoverde");

  return c.tipo === TIPOS_FIRMA.PERSONA && /heurística SIN verificar/i.test(c.advertencia || "");
});

t("sin señal suficiente NO se fuerza una clase", () => {
  const c = clasificarFirma("juan.calderon");

  return c.tipo === TIPOS_FIRMA.NO_CLASIFICADA && /No se fuerza/i.test(c.razon);
});

t("una firma vacía no produce nada", () =>
  clasificarFirma("").tipo === TIPOS_FIRMA.NO_CLASIFICADA &&
  clasificarFirma(null).tipo === TIPOS_FIRMA.NO_CLASIFICADA);


/* =========================================================
   2. PRIVACIDAD Y MINIMIZACIÓN
   ========================================================= */

console.log("\n--- Privacidad ---\n");

t("un correo en el campo autor se minimiza: se descarta el dominio", () =>
  firmaMinimizada("agencianoticiasuc@gmail.com") === "agencianoticiasuc" &&
  firmaMinimizada("redaccion@elmercurio.com.ec") === "redaccion");

t("una firma normal no se toca", () =>
  firmaMinimizada("Andrés Mazza") === "Andrés Mazza" &&
  firmaMinimizada("  Pedro Andrade  ") === "Pedro Andrade");

t("una firma vacía sigue siendo null, no una cadena", () =>
  firmaMinimizada("") === null && firmaMinimizada(null) === null);

t("una firma NO guarda datos personales: solo nombre, medio y piezas", () => {
  const u = construirUniversoDeFirmas({
    corpus: [
      {
        evidenceId: "e1",
        author: "Andrés Mazza",
        sourceId: "elmercurio.com.ec",
        emitterId: "elmercurio.com.ec",
        publisher: "El Mercurio",
        firstObservedAt: T0
      }
    ]
  });

  const f = u.firmas[0];

  const json = JSON.stringify(f);

  return (
    f.datosPersonales === null &&
    !/email|correo|telefono|tel[eé]fono|direccion|biograf|contacto|@/i.test(json) &&
    Object.keys(f).length <= 16
  );
});


/* =========================================================
   3. UNIVERSO DE FIRMAS
   ========================================================= */

console.log("\n--- Universo de firmas ---\n");

const CORPUS = [
  {
    evidenceId: "e1",
    author: "Andrés Mazza",
    sourceId: "elmercurio.com.ec",
    emitterId: "elmercurio.com.ec",
    publisher: "El Mercurio",
    firstObservedAt: T0,
    lastObservedAt: T0
  },
  {
    evidenceId: "e2",
    author: "Andrés Mazza",
    sourceId: "elmercurio.com.ec",
    emitterId: "elmercurio.com.ec",
    publisher: "El Mercurio",
    firstObservedAt: T0,
    lastObservedAt: T1
  },
  {
    evidenceId: "e3",
    author: "Redes Sociales",
    sourceId: "unsion.tv",
    emitterId: "unsion.tv",
    publisher: "Unsion TV",
    firstObservedAt: T0,
    lastObservedAt: T0
  },
  {
    evidenceId: "e4",
    author: null,
    sourceId: "expreso.ec",
    emitterId: "expreso.ec",
    publisher: "Expreso",
    firstObservedAt: T0,
    lastObservedAt: T0
  }
];

const FIRMAS = construirUniversoDeFirmas({ corpus: CORPUS, projectId: "p1" });

t("las firmas se agrupan y cuentan sus piezas", () => {
  const m = FIRMAS.firmas.find((f) => f.nombre === "Andrés Mazza");

  return m.piezas === 2 && m.evidenceIds.length === 2;
});

t("las piezas sin firma se cuentan aparte, no desaparecen", () =>
  FIRMAS.metricas.piezasSinFirma === 1 && FIRMAS.metricas.total === 2);

t("personas y secciones se cuentan por separado", () =>
  FIRMAS.metricas.personas === 1 && FIRMAS.metricas.secciones === 1);

t("una firma pertenece a UN medio: el mismo nombre en dos medios son dos", () => {
  const u = construirUniversoDeFirmas({
    corpus: [
      { evidenceId: "a", author: "Ana Ruiz", sourceId: "m1.ec", emitterId: "m1.ec" },
      { evidenceId: "b", author: "Ana Ruiz", sourceId: "m2.ec", emitterId: "m2.ec" }
    ]
  });

  return (
    u.firmas.length === 2 &&
    u.firmas[0].firmaId !== u.firmas[1].firmaId &&
    u.declaraciones.some((d) => /resoluci[oó]n de identidad/i.test(d))
  );
});

t("el firmaId es estable y determinista", () =>
  firmaIdDe("Andrés Mazza", "elmercurio.com.ec") ===
  firmaIdDe("Andrés Mazza", "elmercurio.com.ec"));

t("cada firma lleva su proyecto y su procedencia", () =>
  FIRMAS.firmas.every(
    (f) => f.projectId === "p1" && f.procedencia === "firma_declarada_por_la_fuente"
  ));

t("primera y última observación se registran por firma", () => {
  const m = FIRMAS.firmas.find((f) => f.nombre === "Andrés Mazza");

  return m.primeraObservacion === T0 && m.ultimaObservacion === T1;
});


/* =========================================================
   4. LA FIRMA SOBREVIVE AL LEDGER
   ========================================================= */

console.log("\n--- Persistencia de la firma ---\n");

await ta("la firma se persiste y se reconstruye", async () => {
  const ledger = crearLedgerMemoria();

  await registrarPasada({
    ledger,
    evidencias: [
      {
        evidenceId: "x1",
        title: "T",
        sourceId: "elmercurio.com.ec",
        author: "Andrés Mazza",
        snippet: "resumen"
      }
    ],
    estadoPrevio: new Map(),
    retrievedAt: T0,
    projectId: "p1"
  });

  const linea = (await ledger.leerTodos())[0];

  const estado = reconstruirEstado(await ledger.leerTodos(), { projectId: "p1" });

  return linea.author === "Andrés Mazza" && [...estado.values()][0].author === "Andrés Mazza";
});

await ta("el correo se minimiza AL PERSISTIR, no después", async () => {
  const ledger = crearLedgerMemoria();

  await registrarPasada({
    ledger,
    evidencias: [
      { evidenceId: "x2", title: "T", sourceId: "a.ec", author: "agencia@gmail.com" }
    ],
    estadoPrevio: new Map(),
    retrievedAt: T0,
    projectId: "p1"
  });

  const linea = (await ledger.leerTodos())[0];

  return linea.author === "agencia" && !/@/.test(JSON.stringify(linea));
});

await ta("una pieza sin firma persiste con author null, no con cadena vacía", async () => {
  const ledger = crearLedgerMemoria();

  await registrarPasada({
    ledger,
    evidencias: [{ evidenceId: "x3", title: "T", sourceId: "a.ec" }],
    estadoPrevio: new Map(),
    retrievedAt: T0,
    projectId: "p1"
  });

  return (await ledger.leerTodos())[0].author === null;
});

await ta("las firmas de un proyecto no se mezclan con las de otro", async () => {
  const ledger = crearLedgerMemoria();

  await registrarPasada({
    ledger,
    evidencias: [{ evidenceId: "a1", title: "A", sourceId: "m1.ec", author: "Ana Ruiz" }],
    estadoPrevio: new Map(),
    retrievedAt: T0,
    projectId: "p1"
  });

  await registrarPasada({
    ledger,
    evidencias: [{ evidenceId: "b1", title: "B", sourceId: "m2.ec", author: "Beto Paz" }],
    estadoPrevio: new Map(),
    retrievedAt: T0,
    projectId: "p2"
  });

  const lineas = await ledger.leerTodos();

  const a = construirUniversoDeFirmas({
    corpus: [...reconstruirEstado(lineas, { projectId: "p1" }).values()],
    projectId: "p1"
  });

  const b = construirUniversoDeFirmas({
    corpus: [...reconstruirEstado(lineas, { projectId: "p2" }).values()],
    projectId: "p2"
  });

  return (
    a.firmas.length === 1 &&
    b.firmas.length === 1 &&
    a.firmas[0].nombre === "Ana Ruiz" &&
    b.firmas[0].nombre === "Beto Paz"
  );
});


/* =========================================================
   5. FUENTES DESCUBIERTAS POR BÚSQUEDA
   ========================================================= */

console.log("\n--- Descubrimiento por búsqueda web ---\n");

const CANDIDATOS = candidatosPara(CUENCA);

t("existe el método de descubrimiento por búsqueda web", () =>
  METODOS_DESCUBRIMIENTO.DESCUBIERTO_POR_BUSQUEDA === "descubierto_por_busqueda_web");

t("las fuentes descubiertas por búsqueda declaran ese origen", () => {
  const b = CANDIDATOS.filter(
    (c) => c.metodoDescubrimiento === METODOS_DESCUBRIMIENTO.DESCUBIERTO_POR_BUSQUEDA
  );

  return b.length >= 4;
});

t("el club de fútbol NO se declara medio por haber sido descubierto", () => {
  const c = CANDIDATOS.find((x) => x.dominio === "clubdeportivocuenca.com");

  return c && c.tipo === null && c.territorioDeclarado === CUENCA;
});

t("una agencia sin ámbito demostrado NO recibe territorio", () => {
  const a = CANDIDATOS.find((x) => x.dominio === "agencianoticiasuc.com");

  return a && a.territorioDeclarado === null && /no demuestra su ambito/i.test(a.nota || "");
});

t("la Casa de la Cultura se declara PROVINCIAL, no cantonal", () => {
  const c = CANDIDATOS.find((x) => x.dominio === "cceazuay.gob.ec");

  return c && c.territorioDeclarado === "ec-azuay";
});

t("el riesgo de cantón homónimo queda declarado en el módulo", async () => {
  const src = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../services/territorial/verifiedSourceUniverse.js", import.meta.url),
      "utf8"
    )
  );

  return /Cuenca, ESPAÑA|canton homonimo|cantones homonimos/i.test(await src);
});


/* =========================================================
   6. MATRIZ: PERIODISTAS DERIVADA DE LAS FIRMAS
   ========================================================= */

console.log("\n--- Matriz de cobertura ---\n");

t("sin firmas, periodistas sigue en NO_PROBADO", () => {
  const m = construirMatrizDeCobertura({
    corpus: [],
    fichas: [],
    motores: [],
    senales: { clasificadas: 0, descubiertas: 0 }
  });

  return (
    m.dimensiones.find((d) => d.dimension === "periodistas").estado ===
    ESTADOS_COBERTURA.NO_PROBADO
  );
});

t("con firmas observadas, periodistas sube a PARCIAL y explica por qué", () => {
  const m = construirMatrizDeCobertura({
    corpus: [],
    fichas: [],
    motores: [],
    senales: { clasificadas: 0, descubiertas: 0 },
    firmas: { total: 63, personas: 54, secciones: 2, mediosConFirma: 16, piezasConFirma: 208, piezasSinFirma: 145 }
  });

  const d = m.dimensiones.find((x) => x.dimension === "periodistas");

  return (
    d.estado === ESTADOS_COBERTURA.PARCIAL &&
    d.actores === 54 &&
    d.evidencias === 208 &&
    /63 firma/.test(d.porQue)
  );
});

t("con firmas NO se declara OPERATIVO: la promoción es heurística", () => {
  const m = construirMatrizDeCobertura({
    corpus: [],
    fichas: [],
    motores: [],
    senales: { clasificadas: 0, descubiertas: 0 },
    firmas: { total: 500, personas: 500, secciones: 0, mediosConFirma: 40, piezasConFirma: 900, piezasSinFirma: 0 }
  });

  const d = m.dimensiones.find((x) => x.dimension === "periodistas");

  return d.estado === ESTADOS_COBERTURA.PARCIAL && /heur[ií]stica/i.test(d.limitacion);
});

t("la matriz sigue sin declarar cobertura poblacional", () => {
  const m = construirMatrizDeCobertura({
    corpus: [],
    fichas: [],
    motores: [],
    senales: { clasificadas: 0, descubiertas: 0 },
    firmas: { total: 10, personas: 8, secciones: 1, mediosConFirma: 3, piezasConFirma: 20, piezasSinFirma: 5 }
  });

  const json = JSON.stringify(m);

  /*
    Se prohibe la CIFRA porcentual y la frase «cobertura del N»,
    no la palabra: las declaraciones honestas del modulo hablan
    de poblacion justamente para decir que no la usan.
  */
  return (
    !/\d+([.,]\d+)?\s*%/.test(json) &&
    !/cobertura del?\s+\d/i.test(json) &&
    m.declaraciones.some((d) => /no existe el denominador/i.test(d))
  );
});


/* =========================================================
   7. SIN RED
   ========================================================= */

console.log("\n--- Sin red ---\n");

t("cero llamadas al fetch global", () => llamadasDeRed === 0);

globalThis.fetch = fetchOriginal;


/* --------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
