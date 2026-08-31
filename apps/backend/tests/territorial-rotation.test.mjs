// apps/backend/tests/territorial-rotation.test.mjs

import {
  ESTADOS_INTENTO,
  SALTOS_MAXIMOS,
  esFallo,
  clasificarIntento,
  saltosPorFallos,
  seleccionarCohorte,
  crearAlmacenMemoria,
  ambitoDeRotacion,
  registrarRotacion,
  reconstruirRotacion,
  siguienteCicloYPasada,
  estadoRotacion
} from "../services/territorial/rssRotation.js";

import {
  recolectarAmpliado,
  PRESUPUESTO_POR_PASADA
} from "../services/ingest/territorialCollector.js";

import { registrarPasada, crearLedgerMemoria } from "../services/territorial/evidenceLedger.js";

import { ventanaDelDia, resumirFrescura } from "../services/territorial/dayWindow.js";

/*
===========================================================
PRUEBAS DE TERRITORIAL-RSS-ROTATION-01
===========================================================

    node tests/territorial-rotation.test.mjs

SIN RED, y comprobable: el `fetch` global va envuelto en un
contador y la penúltima prueba falla si algún caso se escapa.

Nada de 20 esta escrito aqui como constante de negocio: las
pruebas de cobertura calculan las pasadas esperadas a partir del
numero de feeds y del presupuesto, para que sigan valiendo si
mañana hay 10, 30 o 100.
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


let llamadasDeRedReales = 0;

const fetchOriginal = globalThis.fetch;

globalThis.fetch = () => {
  llamadasDeRedReales += 1;

  return Promise.reject(new Error("RED PROHIBIDA EN LAS PRUEBAS"));
};


const T0 = "2026-08-31T14:00:00.000Z";

const TERRITORIO = "ec-azuay-cuenca";


/*
  Universo sintetico. `locales` llevan territorio declarado;
  el resto no, para poder comprobar el orden de servicio.
*/
function universo(n, { locales = 0 } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    url: `https://f${String(i).padStart(3, "0")}.test/feed/`,
    sourceId: `f${String(i).padStart(3, "0")}.test`,
    publisher: `Fuente ${i}`,
    prioridad: i < locales ? 1 : 2,
    territorioDeclarado: i < locales ? TERRITORIO : null
  }));
}

function instanteDe(pasada) {
  return `2026-08-31T${String(10 + pasada).padStart(2, "0")}:00:00.000Z`;
}


/*
  Ejecuta `pasadas` rotaciones seguidas sobre un almacen en
  memoria. `resultadoDe` decide que devolvio cada feed, para
  poder simular fallos sin red.
*/
async function rotar({
  feeds,
  presupuesto,
  pasadas,
  almacen = crearAlmacenMemoria(),
  scopeId = "territorio:ec-azuay-cuenca",
  resultadoDe = () => ({ estado: ESTADOS_INTENTO.OK, recibidas: 10 })
}) {
  const historial = [];

  for (let p = 1; p <= pasadas; p += 1) {
    const previo = reconstruirRotacion(await almacen.leerTodos(), scopeId);

    const siguiente = siguienteCicloYPasada({
      estado: previo.estado,
      ciclo: previo.ciclo,
      pasada: previo.pasada,
      elegibles: feeds
    });

    const cohorte = seleccionarCohorte({
      elegibles: feeds,
      estado: previo.estado,
      presupuesto,
      ciclo: siguiente.ciclo,
      pasada: siguiente.pasada
    });

    const resultados = cohorte.seleccionados.map((f) => ({
      feedUrl: f.feedUrl,
      ...resultadoDe(f, p)
    }));

    const anotado = await registrarRotacion({
      almacen,
      scopeId,
      cohorte,
      resultados,
      instante: instanteDe(p),
      estado: previo.estado
    });

    historial.push({ cohorte, anotado, previo, siguiente });
  }

  return { historial, almacen, scopeId };
}


/* =========================================================
   1. CLASIFICACION DE INTENTOS
   ========================================================= */

console.log("\n--- Estados de un intento ---\n");

t("OK con evidencias es OK; OK sin evidencias es SIN_RESULTADOS", () =>
  clasificarIntento({ estado: "OK", recibidas: 5 }) === ESTADOS_INTENTO.OK &&
  clasificarIntento({ estado: "OK", recibidas: 0 }) === ESTADOS_INTENTO.SIN_RESULTADOS);

t("el vocabulario del adapter se traduce a los seis estados del gate", () =>
  clasificarIntento({ estado: "VACIO" }) === ESTADOS_INTENTO.SIN_RESULTADOS &&
  clasificarIntento({ estado: "MALFORMADO" }) === ESTADOS_INTENTO.ERROR_FUENTE &&
  clasificarIntento({ estado: "INACCESIBLE" }) === ESTADOS_INTENTO.INACCESIBLE &&
  clasificarIntento({ estado: "SIN_RSS" }) === ESTADOS_INTENTO.NO_PUBLICA_RSS &&
  clasificarIntento({}) === ESTADOS_INTENTO.NO_RESUELTO);

t("AUSENCIA NO ES CERO: SIN_RESULTADOS no cuenta como fallo", () =>
  !esFallo(ESTADOS_INTENTO.SIN_RESULTADOS) &&
  !esFallo(ESTADOS_INTENTO.OK) &&
  esFallo(ESTADOS_INTENTO.INACCESIBLE) &&
  esFallo(ESTADOS_INTENTO.ERROR_FUENTE));

t("el backoff esta acotado: nunca aparta a una fuente indefinidamente", () =>
  saltosPorFallos(1) === 1 &&
  saltosPorFallos(SALTOS_MAXIMOS) === SALTOS_MAXIMOS &&
  saltosPorFallos(50) === SALTOS_MAXIMOS);


/* =========================================================
   2. DETERMINISMO
   ========================================================= */

console.log("\n--- Determinismo ---\n");

t("mismas entradas, misma cohorte: nada aleatorio", () => {
  const feeds = universo(20, { locales: 6 });

  const a = seleccionarCohorte({ elegibles: feeds, presupuesto: 8, ciclo: 1, pasada: 1 });

  const b = seleccionarCohorte({ elegibles: feeds, presupuesto: 8, ciclo: 1, pasada: 1 });

  return (
    JSON.stringify(a.seleccionados.map((f) => f.feedUrl)) ===
    JSON.stringify(b.seleccionados.map((f) => f.feedUrl))
  );
});

t("el orden de entrada de los feeds no cambia la cohorte", () => {
  const feeds = universo(20, { locales: 6 });

  const a = seleccionarCohorte({ elegibles: feeds, presupuesto: 8, ciclo: 1, pasada: 1 });

  const b = seleccionarCohorte({
    elegibles: [...feeds].reverse(),
    presupuesto: 8,
    ciclo: 1,
    pasada: 1
  });

  return (
    JSON.stringify(a.seleccionados.map((f) => f.feedUrl)) ===
    JSON.stringify(b.seleccionados.map((f) => f.feedUrl))
  );
});

t("lo territorial se sirve antes que lo nacional", () => {
  const feeds = universo(20, { locales: 6 });

  const c = seleccionarCohorte({ elegibles: feeds, presupuesto: 8, ciclo: 1, pasada: 1 });

  const primeros = c.seleccionados.slice(0, 6);

  return primeros.every((f) => f.territorioDeclarado === TERRITORIO);
});


/* =========================================================
   3. PRESUPUESTO
   ========================================================= */

console.log("\n--- Presupuesto ---\n");

t("nunca se seleccionan mas feeds que el presupuesto", () => {
  const feeds = universo(37);

  return [1, 3, 8, 12].every(
    (n) => seleccionarCohorte({ elegibles: feeds, presupuesto: n, ciclo: 1, pasada: 1 }).seleccionados.length === n
  );
});

t("el presupuesto del recolector NO se modifica", () => PRESUPUESTO_POR_PASADA.rss_directo === 8);

t("con menos feeds que presupuesto se seleccionan todos y sobran plazas", () => {
  const c = seleccionarCohorte({ elegibles: universo(3), presupuesto: 8, ciclo: 1, pasada: 1 });

  return c.seleccionados.length === 3 && c.plazasSinUsar === 5 && c.cicloCierra === true;
});


/* =========================================================
   4. COBERTURA DEL CICLO — SIN STARVATION
   ========================================================= */

console.log("\n--- Cobertura y fairness ---\n");

await ta("PASADA 1 sirve hasta el presupuesto", async () => {
  const feeds = universo(20, { locales: 6 });

  const { historial } = await rotar({ feeds, presupuesto: 8, pasadas: 1 });

  const c = historial[0].cohorte;

  return c.seleccionados.length === 8 && c.ciclo === 1 && c.cicloCierra === false;
});

await ta("PASADA 2 sirve OTRO conjunto: cero solapamiento con la 1", async () => {
  const feeds = universo(20, { locales: 6 });

  const { historial } = await rotar({ feeds, presupuesto: 8, pasadas: 2 });

  const p1 = new Set(historial[0].cohorte.seleccionados.map((f) => f.feedUrl));

  const p2 = historial[1].cohorte.seleccionados.map((f) => f.feedUrl);

  return p2.length === 8 && p2.every((u) => !p1.has(u));
});

await ta("PASADA 3 cierra el ciclo y cubre el universo entero", async () => {
  const feeds = universo(20, { locales: 6 });

  const presupuesto = 8;

  /* Las pasadas esperadas SALEN de las dos cifras. */
  const esperadas = Math.ceil(feeds.length / presupuesto);

  const { historial, almacen, scopeId } = await rotar({
    feeds,
    presupuesto,
    pasadas: esperadas
  });

  const servidos = new Set();

  historial.forEach((h) => h.cohorte.seleccionados.forEach((f) => servidos.add(f.feedUrl)));

  const previo = reconstruirRotacion(await almacen.leerTodos(), scopeId);

  const est = estadoRotacion({
    elegibles: feeds,
    estado: previo.estado,
    ciclo: previo.ciclo,
    pasada: previo.pasada,
    presupuesto
  });

  return (
    esperadas === 3 &&
    servidos.size === feeds.length &&
    est.cobertura === `${feeds.length}/${feeds.length}` &&
    est.cicloCompleto === true &&
    est.pendientesEnCiclo === 0 &&
    historial[esperadas - 1].cohorte.cicloCierra === true
  );
});

await ta("SIN STARVATION: en un ciclo, cada feed se sirve exactamente una vez", async () => {
  const feeds = universo(20, { locales: 6 });

  const { historial } = await rotar({ feeds, presupuesto: 8, pasadas: 3 });

  const conteo = new Map();

  historial.forEach((h) =>
    h.cohorte.seleccionados.forEach((f) =>
      conteo.set(f.feedUrl, (conteo.get(f.feedUrl) || 0) + 1)
    )
  );

  return conteo.size === feeds.length && [...conteo.values()].every((n) => n === 1);
});

await ta("una nacional valida NO queda excluida indefinidamente", async () => {
  const feeds = universo(20, { locales: 6 });

  const { historial } = await rotar({ feeds, presupuesto: 8, pasadas: 3 });

  const servidos = new Set();

  historial.forEach((h) => h.cohorte.seleccionados.forEach((f) => servidos.add(f.sourceId)));

  const nacionales = feeds.filter((f) => f.territorioDeclarado === null);

  return nacionales.length > 0 && nacionales.every((f) => servidos.has(f.sourceId));
});

await ta("tras cerrar un ciclo empieza el siguiente, no se queda parado", async () => {
  const feeds = universo(20, { locales: 6 });

  const { historial } = await rotar({ feeds, presupuesto: 8, pasadas: 4 });

  const cuarta = historial[3].cohorte;

  return cuarta.ciclo === 2 && cuarta.seleccionados.length === 8;
});


/* =========================================================
   5. UNIVERSO VARIABLE — nada hardcodeado
   ========================================================= */

console.log("\n--- Universo variable ---\n");

for (const n of [10, 30, 100]) {
  await ta(`con ${n} feeds el ciclo cubre los ${n} en ceil(${n}/8) pasadas`, async () => {
    const feeds = universo(n, { locales: Math.floor(n / 4) });

    const presupuesto = 8;

    const esperadas = Math.ceil(n / presupuesto);

    const { historial, almacen, scopeId } = await rotar({
      feeds,
      presupuesto,
      pasadas: esperadas
    });

    const servidos = new Set();

    historial.forEach((h) => h.cohorte.seleccionados.forEach((f) => servidos.add(f.feedUrl)));

    const previo = reconstruirRotacion(await almacen.leerTodos(), scopeId);

    const est = estadoRotacion({
      elegibles: feeds,
      estado: previo.estado,
      ciclo: previo.ciclo,
      pasada: previo.pasada,
      presupuesto
    });

    return servidos.size === n && est.cicloCompleto === true;
  });
}

await ta("si el universo CRECE a mitad de ciclo, lo nuevo entra sin reiniciar", async () => {
  const base = universo(10);

  const { almacen, scopeId } = await rotar({ feeds: base, presupuesto: 8, pasadas: 1 });

  /* Aparecen dos fuentes nuevas comprobadas. */
  const ampliado = [
    ...base,
    {
      url: "https://nueva.test/feed/",
      sourceId: "nueva.test",
      publisher: "Nueva",
      prioridad: 1,
      territorioDeclarado: TERRITORIO
    }
  ];

  const previo = reconstruirRotacion(await almacen.leerTodos(), scopeId);

  const c = seleccionarCohorte({
    elegibles: ampliado,
    estado: previo.estado,
    presupuesto: 8,
    ciclo: previo.ciclo,
    pasada: previo.pasada + 1
  });

  const urls = c.seleccionados.map((f) => f.feedUrl);

  /* Entra la nueva y las 2 que quedaban del ciclo; nada mas. */
  return urls.includes("https://nueva.test/feed/") && c.seleccionados.length === 3;
});


/* =========================================================
   6. FALLOS Y BACKOFF
   ========================================================= */

console.log("\n--- Un feed roto no bloquea el ciclo ---\n");

await ta("un feed que falla queda atendido en el ciclo: no acapara plaza", async () => {
  const feeds = universo(20, { locales: 6 });

  const roto = feeds[0].url;

  const { historial } = await rotar({
    feeds,
    presupuesto: 8,
    pasadas: 3,
    resultadoDe: (f) =>
      f.feedUrl === roto
        ? { estado: ESTADOS_INTENTO.INACCESIBLE, recibidas: 0 }
        : { estado: ESTADOS_INTENTO.OK, recibidas: 10 }
  });

  const veces = historial
    .flatMap((h) => h.cohorte.seleccionados.map((f) => f.feedUrl))
    .filter((u) => u === roto).length;

  return veces === 1 && historial[2].cohorte.cicloCierra === true;
});

await ta("el fallo se anota: consecutiveFailures sube y el reintento se espacia", async () => {
  const feeds = universo(8);

  const roto = feeds[0].url;

  const { historial } = await rotar({
    feeds,
    presupuesto: 8,
    pasadas: 1,
    resultadoDe: (f) =>
      f.feedUrl === roto
        ? { estado: ESTADOS_INTENTO.INACCESIBLE, recibidas: 0 }
        : { estado: ESTADOS_INTENTO.OK, recibidas: 4 }
  });

  const ficha = historial[0].anotado.fichas.find((f) => f.feedUrl === roto);

  const sana = historial[0].anotado.fichas.find((f) => f.feedUrl !== roto);

  return (
    ficha.consecutiveFailures === 1 &&
    ficha.lastSuccessAt === null &&
    ficha.lastAttemptAt === instanteDe(1) &&
    ficha.elegibleDesdePasada > sana.elegibleDesdePasada
  );
});

await ta("un feed en backoff se DIFIERE con motivo, y el ciclo cierra igual", async () => {
  const feeds = universo(8);

  const roto = feeds[0].url;

  /* Falla siempre: en la pasada 2 ya deberia estar diferido. */
  const { historial } = await rotar({
    feeds,
    presupuesto: 8,
    pasadas: 2,
    resultadoDe: (f) =>
      f.feedUrl === roto
        ? { estado: ESTADOS_INTENTO.INACCESIBLE, recibidas: 0 }
        : { estado: ESTADOS_INTENTO.OK, recibidas: 4 }
  });

  const c2 = historial[1].cohorte;

  return (
    c2.diferidos.length === 1 &&
    c2.diferidos[0].feedUrl === roto &&
    /fallo\(s\) consecutivo/.test(c2.diferidos[0].motivo) &&
    c2.cicloCierra === true
  );
});

await ta("el diferido VUELVE: el backoff caduca y se le da plaza otra vez", async () => {
  const feeds = universo(8);

  const roto = feeds[0].url;

  const { historial } = await rotar({
    feeds,
    presupuesto: 8,
    pasadas: 8,
    resultadoDe: (f) =>
      f.feedUrl === roto
        ? { estado: ESTADOS_INTENTO.INACCESIBLE, recibidas: 0 }
        : { estado: ESTADOS_INTENTO.OK, recibidas: 4 }
  });

  const intentos = historial
    .flatMap((h) => h.cohorte.seleccionados.map((f) => f.feedUrl))
    .filter((u) => u === roto).length;

  /* Se reintentó más de una vez y no en todas: eso es backoff. */
  return intentos > 1 && intentos < historial.length;
});

await ta("SIN_RESULTADOS no penaliza: el feed respondio", async () => {
  const feeds = universo(8);

  const vacio = feeds[0].url;

  const { historial } = await rotar({
    feeds,
    presupuesto: 8,
    pasadas: 1,
    resultadoDe: (f) =>
      f.feedUrl === vacio
        ? { estado: ESTADOS_INTENTO.SIN_RESULTADOS, recibidas: 0 }
        : { estado: ESTADOS_INTENTO.OK, recibidas: 4 }
  });

  const ficha = historial[0].anotado.fichas.find((f) => f.feedUrl === vacio);

  return (
    ficha.consecutiveFailures === 0 &&
    ficha.lastSuccessAt === instanteDe(1) &&
    ficha.lastResultCount === 0
  );
});

await ta("seleccionado y sin resultado anotado = NO_RESUELTO, no un OK inventado", async () => {
  const feeds = universo(4);

  const almacen = crearAlmacenMemoria();

  const cohorte = seleccionarCohorte({ elegibles: feeds, presupuesto: 8, ciclo: 1, pasada: 1 });

  const anotado = await registrarRotacion({
    almacen,
    scopeId: "territorio:x",
    cohorte,

    /* Solo se anota uno de los cuatro. */
    resultados: [{ feedUrl: feeds[0].url, estado: ESTADOS_INTENTO.OK, recibidas: 3 }],
    instante: T0
  });

  const sinAnotar = anotado.fichas.filter((f) => f.ultimoEstado === ESTADOS_INTENTO.NO_RESUELTO);

  return (
    sinAnotar.length === 3 &&
    sinAnotar.every((f) => f.lastAttemptAt === null && f.intentos === 0) &&
    anotado.metricas.intentados === 1
  );
});

await ta("una rotacion sin instante no se anota", async () => {
  try {
    await registrarRotacion({
      cohorte: seleccionarCohorte({ elegibles: universo(2), presupuesto: 8 }),
      resultados: []
    });

    return false;
  } catch (e) {
    return /instante/.test(e.message);
  }
});


/* =========================================================
   7. PERSISTENCIA Y REINICIO
   ========================================================= */

console.log("\n--- Persistencia y reinicio ---\n");

await ta("reconstruir del almacen da el mismo estado: sobrevive a un reinicio", async () => {
  const feeds = universo(20, { locales: 6 });

  const { almacen, scopeId, historial } = await rotar({ feeds, presupuesto: 8, pasadas: 2 });

  /* «Reinicio»: nada en memoria, solo el fichero. */
  const previo = reconstruirRotacion(await almacen.leerTodos(), scopeId);

  const c3 = seleccionarCohorte({
    elegibles: feeds,
    estado: previo.estado,
    presupuesto: 8,
    ciclo: previo.ciclo,
    pasada: previo.pasada + 1
  });

  const servidos = new Set(
    historial.flatMap((h) => h.cohorte.seleccionados.map((f) => f.feedUrl))
  );

  return (
    previo.ciclo === 1 &&
    previo.pasada === 2 &&
    c3.seleccionados.length === 4 &&
    c3.seleccionados.every((f) => !servidos.has(f.feedUrl))
  );
});

await ta("el almacen es anexo puro: las lineas crecen, los feeds no", async () => {
  const feeds = universo(20, { locales: 6 });

  const { almacen, scopeId } = await rotar({ feeds, presupuesto: 8, pasadas: 3 });

  const registros = await almacen.leerTodos();

  const previo = reconstruirRotacion(registros, scopeId);

  return registros.length >= feeds.length && previo.estado.size === feeds.length;
});

await ta("el orden de lectura del fichero no cambia el estado reconstruido", async () => {
  const feeds = universo(20, { locales: 6 });

  const { almacen, scopeId } = await rotar({ feeds, presupuesto: 8, pasadas: 3 });

  const registros = await almacen.leerTodos();

  const a = reconstruirRotacion(registros, scopeId);

  const b = reconstruirRotacion([...registros].reverse(), scopeId);

  return (
    a.ciclo === b.ciclo &&
    a.pasada === b.pasada &&
    a.estado.size === b.estado.size &&
    [...a.estado.keys()].every(
      (k) => a.estado.get(k).cicloVisto === b.estado.get(k).cicloVisto
    )
  );
});


/* =========================================================
   8. AISLAMIENTO POR AMBITO
   ========================================================= */

console.log("\n--- Aislamiento por proyecto ---\n");

t("el ambito es el proyecto si lo hay, y el territorio si no", () => {
  const conProyecto = ambitoDeRotacion({
    projectId: "alcaldia-cuenca-2027-piloto",
    territoryId: TERRITORIO
  });

  const sinProyecto = ambitoDeRotacion({ territoryId: TERRITORIO });

  const sinNada = ambitoDeRotacion({});

  return (
    conProyecto.tipo === "PROYECTO" &&
    conProyecto.scopeId === "proyecto:alcaldia-cuenca-2027-piloto" &&
    sinProyecto.tipo === "TERRITORIO" &&
    sinProyecto.scopeId === `territorio:${TERRITORIO}` &&
    sinNada.tipo === "SIN_AMBITO"
  );
});

await ta("dos proyectos sobre el mismo territorio rotan por separado", async () => {
  const feeds = universo(20, { locales: 6 });

  const almacen = crearAlmacenMemoria();

  /* El proyecto A avanza dos pasadas. */
  await rotar({
    feeds,
    presupuesto: 8,
    pasadas: 2,
    almacen,
    scopeId: "proyecto:a"
  });

  /* El proyecto B empieza de cero aunque comparta almacen. */
  const previoB = reconstruirRotacion(await almacen.leerTodos(), "proyecto:b");

  const cB = seleccionarCohorte({
    elegibles: feeds,
    estado: previoB.estado,
    presupuesto: 8,
    ciclo: previoB.ciclo,
    pasada: previoB.pasada + 1
  });

  const previoA = reconstruirRotacion(await almacen.leerTodos(), "proyecto:a");

  return (
    previoB.registros === 0 &&
    previoB.estado.size === 0 &&
    cB.seleccionados.length === 8 &&
    previoA.estado.size === 16
  );
});

await ta("la cobertura de un proyecto no da por escuchada la del otro", async () => {
  const feeds = universo(10);

  const almacen = crearAlmacenMemoria();

  await rotar({ feeds, presupuesto: 8, pasadas: 2, almacen, scopeId: "proyecto:a" });

  const b = reconstruirRotacion(await almacen.leerTodos(), "proyecto:b");

  const est = estadoRotacion({
    elegibles: feeds,
    estado: b.estado,
    ciclo: b.ciclo,
    pasada: b.pasada,
    presupuesto: 8
  });

  return (
    est.cobertura === `0/${feeds.length}` &&
    est.nuncaAtendidas.length === feeds.length &&
    est.cicloCompleto === false
  );
});


/* =========================================================
   9. OBSERVABILIDAD
   ========================================================= */

console.log("\n--- Observabilidad ---\n");

await ta("responde «¿qué fuentes no se han escuchado en este ciclo?»", async () => {
  const feeds = universo(20, { locales: 6 });

  const { almacen, scopeId } = await rotar({ feeds, presupuesto: 8, pasadas: 1 });

  const previo = reconstruirRotacion(await almacen.leerTodos(), scopeId);

  const est = estadoRotacion({
    elegibles: feeds,
    estado: previo.estado,
    ciclo: previo.ciclo,
    pasada: previo.pasada,
    presupuesto: 8
  });

  return (
    est.feedsVerificados === 20 &&
    est.presupuestoPorPasada === 8 &&
    est.atendidasEnCiclo === 8 &&
    est.pendientesEnCiclo === 12 &&
    est.pendientes.length === 12 &&
    est.cobertura === "8/20" &&
    est.nuncaAtendidas.length === 12 &&
    est.ultimaRotacion === instanteDe(1)
  );
});

await ta("la proxima cohorte SI se declara; la fecha NO se inventa", async () => {
  const feeds = universo(20, { locales: 6 });

  const { almacen, scopeId } = await rotar({ feeds, presupuesto: 8, pasadas: 1 });

  const previo = reconstruirRotacion(await almacen.leerTodos(), scopeId);

  const est = estadoRotacion({
    elegibles: feeds,
    estado: previo.estado,
    ciclo: previo.ciclo,
    pasada: previo.pasada,
    presupuesto: 8
  });

  /* La cohorte anunciada es exactamente la que luego sale. */
  const c2 = seleccionarCohorte({
    elegibles: feeds,
    estado: previo.estado,
    presupuesto: 8,
    ciclo: previo.ciclo,
    pasada: previo.pasada + 1
  });

  return (
    est.proximaRotacion === null &&
    /no hay scheduler/i.test(est.motivoProximaRotacion) &&
    est.proximaCohorte.length === 8 &&
    JSON.stringify(est.proximaCohorte) ===
      JSON.stringify(c2.seleccionados.map((f) => f.sourceId || f.feedUrl))
  );
});

t("con universo vacio no se inventa cobertura", () => {
  const est = estadoRotacion({ elegibles: [], presupuesto: 8 });

  return est.cobertura === "0/0" && est.cicloCompleto === false && est.ultimaRotacion === null;
});


/* =========================================================
   10. DEDUP Y FRESCURA CON ROTACION
   ========================================================= */

console.log("\n--- Dedup y clasificacion temporal ---\n");

/*
  Titulares DISTINTOS de verdad.

  `crossProviderDedup` absorbe titulos casi identicos en el mismo
  dominio, y hace bien: son la misma nota resubida. Con titulares
  sinteticos del tipo «Titular 1 / Titular 2» el motor los
  colapsaba —9 brutas, 3 unicas— y la prueba medía el parecido de
  las cadenas, no la rotacion.
*/
const TITULARES = [
  "Nueva ordenanza de movilidad en el Centro Historico",
  "El tranvia amplia su horario los fines de semana",
  "Obras de alcantarillado en la parroquia rural",
  "Presupuesto participativo abre convocatoria",
  "Feria de emprendimiento en el parque",
  "Plan de arborizacion cubre diez barrios"
];

function feedFalso(n = 3, publishedAt = "2026-08-31T09:00:00.000Z", prefijo = "a") {
  return {
    title: "Feed de prueba",
    items: Array.from({ length: n }, (_, i) => ({
      title: `${TITULARES[i % TITULARES.length]} (${prefijo})`,
      link: `https://${prefijo}.test/nota-${i}`,
      guid: `https://${prefijo}.test/nota-${i}`,
      isoDate: publishedAt,
      contentSnippet: "Resumen."
    }))
  };
}

await ta("una fuente que reaparece en otra pasada NO multiplica el corpus", async () => {
  const feeds = universo(3).map((f) => ({ ...f }));

  const ledger = crearLedgerMemoria();

  const leer = async (url) => feedFalso(3, "2026-08-31T09:00:00.000Z", url.split("//")[1].split(".")[0]);

  /* Ciclo 1: se sirven los 3. */
  const r1 = await recolectarAmpliado({
    plan: [],
    feeds,
    observedAt: T0,
    habilitados: ["rss_directo"],
    inyeccion: { parseURL: leer }
  });

  const p1 = await registrarPasada({
    ledger,
    evidencias: r1.evidencias,
    estadoPrevio: new Map(),
    retrievedAt: T0
  });

  /* Ciclo 2: los mismos 3 vuelven a entrar. */
  const T1 = "2026-08-31T20:00:00.000Z";

  const r2 = await recolectarAmpliado({
    plan: [],
    feeds,
    observedAt: T1,
    habilitados: ["rss_directo"],
    inyeccion: { parseURL: leer }
  });

  const p2 = await registrarPasada({
    ledger,
    evidencias: r2.evidencias,
    estadoPrevio: new Map(p1.evidencias.map((e) => [e.evidenceId, e])),
    retrievedAt: T1
  });

  return (
    p1.metricas.nuevasParaSentinel === 9 &&
    p2.metricas.nuevasParaSentinel === 0 &&
    p2.metricas.yaConocidas === 9 &&
    p2.metricas.corpusAcumulado === p1.metricas.corpusAcumulado
  );
});

await ta("firstObservedAt inmutable y lastObservedAt avanza entre ciclos", async () => {
  const feeds = universo(2);

  const leer = async (url) => feedFalso(2, "2026-08-30T09:00:00.000Z", url.split("//")[1].split(".")[0]);

  const r = await recolectarAmpliado({
    plan: [],
    feeds,
    observedAt: T0,
    habilitados: ["rss_directo"],
    inyeccion: { parseURL: leer }
  });

  const p1 = await registrarPasada({
    evidencias: r.evidencias,
    estadoPrevio: new Map(),
    retrievedAt: T0
  });

  const T2 = "2026-09-02T14:00:00.000Z";

  const p2 = await registrarPasada({
    evidencias: r.evidencias,
    estadoPrevio: new Map(p1.evidencias.map((e) => [e.evidenceId, e])),
    retrievedAt: T2
  });

  return p2.evidencias.every(
    (e) =>
      e.firstObservedAt === T0 &&
      e.lastObservedAt === T2 &&
      e.publishedAt.startsWith("2026-08-30") &&
      e.observationCount === 2
  );
});

await ta("la clasificacion temporal sigue intacta con rotacion", async () => {
  const feeds = universo(2);

  const leer = async (url) =>
    url.includes("f000")
      ? feedFalso(2, "2026-08-31T09:00:00.000Z", "hoy")
      : feedFalso(2, "2026-08-10T09:00:00.000Z", "viejo");

  const r = await recolectarAmpliado({
    plan: [],
    feeds,
    observedAt: T0,
    habilitados: ["rss_directo"],
    inyeccion: { parseURL: leer }
  });

  const p = await registrarPasada({
    evidencias: r.evidencias,
    estadoPrevio: new Map(),
    retrievedAt: T0
  });

  const frescura = resumirFrescura(p.evidencias, {
    ventana: ventanaDelDia(T0),
    retrievedAt: T0
  });

  return (
    frescura.total === 4 &&
    frescura.publicadoHoy === 2 &&
    frescura.encontradoHoyPublicadoAntes === 2 &&
    frescura.fechaNoResuelta === 0
  );
});

await ta("el recolector atribuye cada lote a su feed", async () => {
  const feeds = universo(3);

  const r = await recolectarAmpliado({
    plan: [],
    feeds,
    observedAt: T0,
    habilitados: ["rss_directo"],
    inyeccion: { parseURL: async () => feedFalso(1) }
  });

  const rss = r.lotes.filter((l) => l.providerId === "rss_directo");

  return (
    rss.length === 3 &&
    rss.every((l) => l.feedUrl && l.sourceId) &&
    new Set(rss.map((l) => l.feedUrl)).size === 3
  );
});


/* =========================================================
   11. SIN RED
   ========================================================= */

console.log("\n--- Sin red ---\n");

t("cero llamadas al fetch global", () => llamadasDeRedReales === 0);

globalThis.fetch = fetchOriginal;


/* =========================================================
   12. LA RUTA COMPILA
   ========================================================= */

console.log("\n--- La ruta compila ---\n");

await ta("routes/territorio.js compila con la rotacion conectada", async () => {
  const modulo = await import("../routes/territorio.js");

  return typeof modulo.default === "function";
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
