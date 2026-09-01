// apps/backend/tests/mediaTime.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { abrirLake, cerrarLake, escribirLoteEnLake } from "../services/knowledgeLake/lakeQuery.js";

import { TIPOS_ENTIDAD, ZONAS } from "../services/knowledgeLake/lakeWriter.js";

import {
  normalizarFecha,
  medianocheLocal,
  resumirNormalizacion,
  METODOS_FECHA,
  MOTIVOS_NO_NORMALIZADA,
  PRECISIONES
} from "../services/media/mediaTime.js";

import { leerCorpusDeProyecto, resolverVentana, aplicarVentana } from "../services/media/mediaCorpus.js";

import { homeDeProyecto } from "../services/media/mediaHome.js";

import { CLASES_EMISOR } from "../services/media/pieceContracts.js";

/*
===========================================================
MEDIA-TIME-NORMALIZATION-01 — PRUEBAS
===========================================================

La mitad de estas pruebas comprueban que algo NO se normaliza.
Es lo importante del gate: un parser que resuelve todo lo que le
echan produce una serie temporal completa y falsa, que es peor
que una incompleta y verdadera.

Ninguna prueba toca la red.
===========================================================
*/

const ZONA = "America/Guayaquil";

const AHORA = "2026-09-01T18:00:00.000Z";

const PROYECTO_T = "test-time-proyecto";

const PROYECTO_OTRO = "test-time-otro";


/*
===========================================================
1 · LO QUE SI SE NORMALIZA
===========================================================
*/

test("fecha espanola corta: «3 jul 2026»", () => {
  const r = normalizarFecha("3 jul 2026");

  assert.equal(r.normalizada, true);

  assert.equal(r.metodo, METODOS_FECHA.TEXTO_ES_INEQUIVOCO);

  assert.equal(r.precision, PRECISIONES.DIA);

  assert.equal(r.raw, "3 jul 2026");
});


test("fecha espanola larga y con «de»", () => {
  const a = normalizarFecha("3 de julio de 2026");

  const b = normalizarFecha("3 julio 2026");

  const c = normalizarFecha("3 jul 2026");

  assert.equal(a.publishedAt, c.publishedAt);

  assert.equal(b.publishedAt, c.publishedAt);
});


test("abreviaturas que devuelve el buscador: sept, sep, set, dic", () => {
  ["12 sept 2025", "12 sep 2025", "12 set 2025", "12 septiembre 2025"].forEach((x) => {
    const r = normalizarFecha(x);

    assert.equal(r.normalizada, true, `${x} deberia resolverse`);

    assert.equal(r.publishedAt, normalizarFecha("12 sept 2025").publishedAt);
  });

  assert.equal(normalizarFecha("1 dic 2025").normalizada, true);
});


test("ISO con hora se conserva EXACTA y se marca como instante", () => {
  const r = normalizarFecha("2026-07-03T00:40:32.000Z");

  assert.equal(r.publishedAt, "2026-07-03T00:40:32.000Z");

  assert.equal(r.metodo, METODOS_FECHA.ISO_8601);

  assert.equal(r.precision, PRECISIONES.INSTANTE);
});


/*
===========================================================
2 · EL DIA LOCAL — lo que decide si «HOY» significa algo
===========================================================
*/

test("una fecha de dia cae en el dia LOCAL correcto, no en el anterior", () => {
  const r = normalizarFecha("3 jul 2026");

  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(r.publishedAt));

  assert.equal(
    local,
    "2026-07-03",
    "anclar a medianoche UTC la habria puesto el 2 de julio en Guayaquil"
  );

  /* Y en UTC son las 05:00, que es la medianoche de UTC-5. */
  assert.equal(r.publishedAt, "2026-07-03T05:00:00.000Z");
});


test("una fecha ISO sin hora recibe el mismo trato: es precision de dia", () => {
  const r = normalizarFecha("2026-07-03");

  assert.equal(r.precision, PRECISIONES.DIA);

  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(r.publishedAt));

  assert.equal(local, "2026-07-03");
});


test("medianocheLocal devuelve el instante UTC de las 00:00 locales", () => {
  assert.equal(medianocheLocal(2026, 7, 3, ZONA), "2026-07-03T05:00:00.000Z");

  assert.equal(medianocheLocal(2026, 1, 1, ZONA), "2026-01-01T05:00:00.000Z");
});


/*
===========================================================
3 · LO QUE NO SE NORMALIZA, Y ES EL PUNTO DEL GATE
===========================================================
*/

test("numerica AMBIGUA no se resuelve: 03/07/2026 caben las dos lecturas", () => {
  const r = normalizarFecha("03/07/2026");

  assert.equal(r.normalizada, false);

  assert.equal(r.motivo, MOTIVOS_NO_NORMALIZADA.AMBIGUA);

  assert.match(r.razon, /los dos numeros caben como mes/);
});


test("numerica INEQUIVOCA si se resuelve: no hay mes 21", () => {
  const r = normalizarFecha("21/05/2025");

  assert.equal(r.normalizada, true);

  assert.equal(r.metodo, METODOS_FECHA.NUMERICA_INEQUIVOCA);

  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(r.publishedAt));

  assert.equal(local, "2025-05-21");
});


test("sin valor: no es un formato desconocido, es que no hay dato", () => {
  [null, undefined, "", "   "].forEach((x) => {
    const r = normalizarFecha(x);

    assert.equal(r.normalizada, false);

    assert.equal(r.motivo, MOTIVOS_NO_NORMALIZADA.SIN_VALOR);
  });
});


test("formato no reconocido y fecha imposible se rechazan", () => {
  assert.equal(normalizarFecha("3 xyz 2026").motivo, MOTIVOS_NO_NORMALIZADA.FORMATO_NO_RECONOCIDO);

  assert.equal(normalizarFecha("30 feb 2026").motivo, MOTIVOS_NO_NORMALIZADA.FORMATO_NO_RECONOCIDO);

  assert.equal(normalizarFecha("proximamente").normalizada, false);
});


test("una fecha fuera de rango es un fallo de parseo, no un dato", () => {
  assert.equal(normalizarFecha("3 jul 1850").motivo, MOTIVOS_NO_NORMALIZADA.FUERA_DE_RANGO);

  assert.equal(normalizarFecha("3 jul 2400").motivo, MOTIVOS_NO_NORMALIZADA.FUERA_DE_RANGO);
});


/*
===========================================================
4 · RELATIVAS — solo con referencia
===========================================================
*/

test("relativa CON referencia se resuelve y guarda la referencia", () => {
  const r = normalizarFecha("ayer", { observedAt: "2026-08-31T05:50:04.734Z" });

  assert.equal(r.normalizada, true);

  assert.equal(r.metodo, METODOS_FECHA.RELATIVO_A_OBSERVACION);

  assert.equal(r.referenciaObservacion, "2026-08-31T05:50:04.734Z");

  /*
    05:50 UTC del 31 son las 00:50 locales del 31, asi que
    «ayer» es el 30 local.
  */
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(r.publishedAt));

  assert.equal(local, "2026-08-30");
});


test("relativa SIN referencia NO se resuelve", () => {
  const r = normalizarFecha("ayer");

  assert.equal(r.normalizada, false);

  assert.equal(r.motivo, MOTIVOS_NO_NORMALIZADA.SIN_REFERENCIA);

  assert.equal(r.publishedAt, null);
});


test("«hace 2 horas» conserva precision de instante", () => {
  const r = normalizarFecha("hace 2 horas", { observedAt: "2026-08-31T05:50:00.000Z" });

  assert.equal(r.publishedAt, "2026-08-31T03:50:00.000Z");

  assert.equal(r.precision, PRECISIONES.INSTANTE);
});


/*
===========================================================
5 · OBSERVED != PUBLISHED
===========================================================
*/

test("no existe ningun camino que convierta observedAt en publishedAt", () => {
  /*
    Se pasa una referencia de observacion con un valor que NO es
    una fecha relativa. Si el modulo tuviera la tentacion de caer
    en observedAt, aqui se veria.
  */
  const r = normalizarFecha(null, { observedAt: "2026-08-31T05:50:00.000Z" });

  assert.equal(r.publishedAt, null);

  const s = normalizarFecha("texto que no es fecha", {
    observedAt: "2026-08-31T05:50:00.000Z"
  });

  assert.equal(s.publishedAt, null);
});


/*
===========================================================
6 · SOBRE EL CORPUS
===========================================================
*/

function fila({ proyectoId, entidad, fuente, fechaHecho, fechaDeteccion = AHORA, clase = "pieza" }) {
  return {
    tenantId: "sentinel-local",
    proyectoId,
    zona: ZONAS.RAW,
    linaje: { submotor: "media_piece", cadena: ["prueba"] },
    motorOrigen: "media_piece_01",
    fuente,
    urlCanonica: entidad,
    fechaHecho,
    fechaDeteccion,
    entidad,
    tipoEntidad: TIPOS_ENTIDAD.PUBLICACION,
    datos: {
      clase,
      pieceId: `pc-${entidad}`,
      evidenceId: `ev-${entidad}`,
      plataforma: "web",
      titulo: null,
      autor: null,
      emisor: { clase: CLASES_EMISOR.MEDIO, nombre: null, dominio: fuente }
    }
  };
}


async function sembrar(filas) {
  await abrirLake({ adaptador: "memoria", forzarNueva: true });

  const r = await escribirLoteEnLake(filas, {});

  assert.equal(r.rechazados || 0, 0);
}


test("el corpus normaliza al leer y NO reescribe el Lake", async () => {
  await sembrar([
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/1", fuente: "medioa.com", fechaHecho: "3 jul 2026" }),
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/2", fuente: "medioa.com", fechaHecho: null })
  ]);

  const antes = await leerCorpusDeProyecto({ projectId: PROYECTO_T, lake: {} });

  const filasAntes = antes.lectura.registrosEnLake;

  const despues = await leerCorpusDeProyecto({ projectId: PROYECTO_T, lake: {} });

  assert.equal(despues.lectura.registrosEnLake, filasAntes, "leer no puede escribir");

  assert.equal(despues.fechas.normalizadas, 1);

  assert.equal(despues.fechas.noNormalizadas, 1);
});


test("idempotencia: dos lecturas dan ids, fechas e historial identicos", async () => {
  await sembrar([
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/1", fuente: "medioa.com", fechaHecho: "3 jul 2026" }),
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/2", fuente: "medioa.com", fechaHecho: "21/05/2025" }),
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/3", fuente: "medioa.com", fechaHecho: "03/07/2026" })
  ]);

  const huella = (c) =>
    JSON.stringify(
      c.piezas
        .map((p) => [p.clave, p.pieceId, p.evidenceId, p.publishedAt, p.fechaProvenance.metodo])
        .sort()
    );

  const a = await leerCorpusDeProyecto({ projectId: PROYECTO_T, lake: {} });

  const b = await leerCorpusDeProyecto({ projectId: PROYECTO_T, lake: {} });

  assert.equal(huella(a), huella(b));

  assert.equal(a.piezas.length, b.piezas.length);

  /* La ambigua sigue sin resolverse en la segunda pasada. */
  assert.equal(b.fechas.normalizadas, 2);
});


test("una fecha ISO valida ya persistida NO se altera", async () => {
  await sembrar([
    fila({
      proyectoId: PROYECTO_T,
      entidad: "medioa.com/iso",
      fuente: "medioa.com",
      fechaHecho: "2026-07-03T00:40:32.000Z"
    })
  ]);

  const c = await leerCorpusDeProyecto({ projectId: PROYECTO_T, lake: {} });

  assert.equal(c.piezas[0].publishedAt, "2026-07-03T00:40:32.000Z");

  assert.equal(c.piezas[0].fechaProvenance.metodo, METODOS_FECHA.ISO_8601);
});


test("la provenance temporal viaja con cada pieza", async () => {
  await sembrar([
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/1", fuente: "medioa.com", fechaHecho: "3 jul 2026" })
  ]);

  const c = await leerCorpusDeProyecto({ projectId: PROYECTO_T, lake: {} });

  const p = c.piezas[0];

  assert.equal(p.fechaProvenance.raw, "3 jul 2026");

  assert.equal(p.fechaProvenance.metodo, METODOS_FECHA.TEXTO_ES_INEQUIVOCO);

  assert.equal(p.fechaProvenance.precision, PRECISIONES.DIA);

  assert.ok(p.fechaProvenance.razon);

  assert.ok(p.fechaProvenance.version);

  /* El crudo NO desaparece del contrato. */
  assert.equal(p.publishedAtBruto, "3 jul 2026");
});


test("observedAt y publishedAt siguen separados en el corpus", async () => {
  await sembrar([
    fila({
      proyectoId: PROYECTO_T,
      entidad: "medioa.com/sinfecha",
      fuente: "medioa.com",
      fechaHecho: null,
      fechaDeteccion: AHORA
    })
  ]);

  const c = await leerCorpusDeProyecto({ projectId: PROYECTO_T, lake: {} });

  const p = c.piezas[0];

  assert.equal(p.publishedAt, null, "sin fecha publicada, publishedAt sigue null");

  assert.equal(p.observedAt, AHORA, "y la observacion se conserva aparte");
});


/*
===========================================================
7 · VENTANAS Y RANKING
===========================================================
*/

test("normalizar mete piezas en la ventana que antes no entraban", async () => {
  await sembrar([
    /* Dentro de 90d contando desde el 1 de septiembre de 2026. */
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/1", fuente: "medioa.com", fechaHecho: "3 jul 2026" }),
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/2", fuente: "medioa.com", fechaHecho: "15 ago 2026" }),
    /* Fuera. */
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/3", fuente: "medioa.com", fechaHecho: "9 jul 2024" }),
    /* No datable. */
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/4", fuente: "medioa.com", fechaHecho: null })
  ]);

  const c = await leerCorpusDeProyecto({ projectId: PROYECTO_T, lake: {} });

  const v = resolverVentana("90d", AHORA);

  const r = aplicarVentana(c.piezas, v);

  assert.equal(r.dentro.length, 2);

  assert.equal(r.fuera.length, 1);

  assert.equal(r.sinFechaUtilizable.length, 1);
});


test("el ranking no se infla: piezas historicas fuera de ventana no cuentan como actuales", async () => {
  await sembrar([
    /* Un medio con mucho historico y nada reciente. */
    fila({ proyectoId: PROYECTO_T, entidad: "historico.com/1", fuente: "historico.com", fechaHecho: "9 jul 2024" }),
    fila({ proyectoId: PROYECTO_T, entidad: "historico.com/2", fuente: "historico.com", fechaHecho: "15 may 2023" }),
    fila({ proyectoId: PROYECTO_T, entidad: "historico.com/3", fuente: "historico.com", fechaHecho: "23 ago 2023" }),
    /* Un medio con una sola pieza, pero dentro de la ventana. */
    fila({ proyectoId: PROYECTO_T, entidad: "actual.com/1", fuente: "actual.com", fechaHecho: "15 ago 2026" })
  ]);

  const h = await homeDeProyecto({
    projectId: PROYECTO_T,
    ventana: "90d",
    ahora: AHORA,
    lake: {}
  });

  const historico = h.presencia.ranking.find((f) => f.dominio === "historico.com");

  const actual = h.presencia.ranking.find((f) => f.dominio === "actual.com");

  assert.equal(historico.piezasObservadas.valor, 0, "tres piezas, ninguna en la ventana");

  assert.equal(historico.piezasEnCorpus.valor, 3, "y el corpus sigue diciendo la verdad");

  assert.equal(actual.piezasObservadas.valor, 1);

  /* El que tiene actividad en la ventana va primero. */
  assert.ok(actual.rank < historico.rank, "la ventana manda sobre el volumen historico");
});


test("corpus y ventana siguen siendo magnitudes distintas", async () => {
  await sembrar([
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/1", fuente: "medioa.com", fechaHecho: "9 jul 2024" }),
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/2", fuente: "medioa.com", fechaHecho: "15 ago 2026" })
  ]);

  const h = await homeDeProyecto({
    projectId: PROYECTO_T,
    ventana: "90d",
    ahora: AHORA,
    lake: {}
  });

  assert.equal(h.resumen.piezasObservadas.valor, 1);

  assert.equal(h.resumen.piezasEnCorpus.valor, 2);
});


/*
===========================================================
8 · AISLAMIENTO Y DEDUPE, QUE NO PUEDEN ROMPERSE
===========================================================
*/

test("normalizar no cruza proyectos", async () => {
  await sembrar([
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/1", fuente: "medioa.com", fechaHecho: "3 jul 2026" }),
    fila({ proyectoId: PROYECTO_OTRO, entidad: "mediob.com/1", fuente: "mediob.com", fechaHecho: "3 jul 2026" })
  ]);

  const a = await leerCorpusDeProyecto({ projectId: PROYECTO_T, lake: {} });

  const b = await leerCorpusDeProyecto({ projectId: PROYECTO_OTRO, lake: {} });

  assert.equal(a.piezas.length, 1);

  assert.equal(b.piezas.length, 1);

  assert.equal(a.fechas.normalizadas, 1);

  assert.equal(b.fechas.normalizadas, 1);

  assert.ok(a.piezas.every((p) => p.dominio !== "mediob.com"));
});


test("normalizar no rompe el colapso de claves duplicadas", async () => {
  await sembrar([
    fila({ proyectoId: PROYECTO_T, entidad: "https://medioa.com/1", fuente: "medioa.com", fechaHecho: "3 jul 2026" }),
    fila({ proyectoId: PROYECTO_T, entidad: "medioa.com/1", fuente: "medioa.com", fechaHecho: "3 jul 2026" })
  ]);

  const c = await leerCorpusDeProyecto({ projectId: PROYECTO_T, lake: {} });

  assert.equal(c.piezas.length, 1);

  assert.ok(c.lectura.clavesColapsadas >= 1);

  assert.equal(c.fechas.total, 1, "la pieza colapsada se cuenta una vez");
});


/*
===========================================================
9 · RESUMEN
===========================================================
*/

test("el resumen separa metodos de motivos y no los colapsa", () => {
  const r = resumirNormalizacion([
    { normalizada: true, metodo: METODOS_FECHA.TEXTO_ES_INEQUIVOCO },
    { normalizada: true, metodo: METODOS_FECHA.TEXTO_ES_INEQUIVOCO },
    { normalizada: true, metodo: METODOS_FECHA.ISO_8601 },
    { normalizada: false, motivo: MOTIVOS_NO_NORMALIZADA.SIN_VALOR },
    { normalizada: false, motivo: MOTIVOS_NO_NORMALIZADA.AMBIGUA }
  ]);

  assert.equal(r.total, 5);

  assert.equal(r.normalizadas, 3);

  assert.equal(r.noNormalizadas, 2);

  assert.equal(r.porMetodo[0].metodo, METODOS_FECHA.TEXTO_ES_INEQUIVOCO);

  assert.equal(r.porMetodo[0].piezas, 2);

  /*
    SIN_VALOR se arregla reingiriendo y AMBIGUA no se arregla
    nunca sin mas contexto: mezclarlos ocultaria cual tiene
    solucion.
  */
  const motivos = r.porMotivo.map((m) => m.motivo);

  assert.ok(motivos.includes(MOTIVOS_NO_NORMALIZADA.SIN_VALOR));

  assert.ok(motivos.includes(MOTIVOS_NO_NORMALIZADA.AMBIGUA));
});


/*
===========================================================
10 · SOBRE EL LAKE REAL
===========================================================
*/

test("Lake real: el corpus piloto mejora y lo no normalizable se declara", async () => {
  cerrarLake();

  await abrirLake({ adaptador: "fichero", forzarNueva: true });

  const c = await leerCorpusDeProyecto({
    projectId: "alcaldia-cuenca-2027-piloto",
    lake: {}
  });

  assert.equal(c.ok, true);

  /*
    Invariante, no cifra exacta: el corpus crece con cada
    analisis. Lo que se fija es que las fechas de buscador ya se
    resuelven y que lo que queda tiene un motivo declarado.
  */
  assert.ok(
    c.fechas.normalizadas >= 3,
    "las fechas en espanol del corpus real deben resolverse"
  );

  assert.ok(
    c.fechas.porMetodo.some((m) => m.metodo === METODOS_FECHA.TEXTO_ES_INEQUIVOCO),
    "y por el metodo correcto"
  );

  c.fechas.porMotivo.forEach((m) => {
    assert.ok(m.motivo, "toda pieza no normalizada declara su motivo");
  });

  /* Ninguna fecha puede coincidir con su propia observacion. */
  const todas = [...c.piezas, ...c.amplificacion];

  assert.equal(
    todas.filter((p) => p.publishedAt && p.publishedAt === p.observedAt).length,
    0
  );

  cerrarLake();
});
