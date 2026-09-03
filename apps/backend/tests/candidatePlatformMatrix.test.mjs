// apps/backend/tests/candidatePlatformMatrix.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import {
  celdaDePlataforma,
  coberturaDeCandidato,
  matrizDePlataformasDelProyecto,
  PLATAFORMAS_MATRIZ
} from "../services/intelligence/candidatePlatformMatrix.js";

import { contenidoDeProyecto } from "../services/projects/projectStore.js";

import { ESTADOS_CIERRE } from "../services/intelligence/operationalClosure.js";

import { IDENTITY_STATES } from "../services/intelligence/socialBenchmarkMatrix.js";

/*
===========================================================
MATRIZ CANONICA DE PLATAFORMAS — CANDIDATE-STRATEGIC-UX-01B
===========================================================

Cero red. Todo sale del Lake ya persistido.

Lo que protegen estas pruebas es lo que fallo la certificacion
visual: que las cinco plataformas esten realmente resueltas y
que la interfaz no pueda volver a mostrar solo dos.
===========================================================
*/

const PILOTO = "alcaldia-cuenca-2027-piloto";

const ENSAYO = "ensayo-tipos-1787962022520";


/*
===========================================================
§32 · LAS 35 CELDAS
===========================================================
*/

test("32 · 7 candidatos x 5 plataformas dan 35 celdas, todas con estado explicito", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  assert.equal(r.ok, true);

  assert.equal(r.candidatos.length, 7);

  assert.equal(PLATAFORMAS_MATRIZ.length, 5);

  assert.equal(r.totalCeldas, 35);

  /*
    Ninguna celda puede quedar sin resolver. Ni undefined, ni
    null en silencio, ni NaN: eso es lo que el cierre garantiza.
  */
  const estados = [];

  for (const fila of r.candidatos) {
    for (const p of PLATAFORMAS_MATRIZ) {
      const celda = fila.celdas[p];

      assert.ok(celda, `falta la celda ${fila.candidateId}/${p}`);

      assert.equal(typeof celda.medicion.estado, "string");

      assert.ok(celda.medicion.estado.length > 0);

      assert.ok(
        Object.values(ESTADOS_CIERRE).includes(celda.medicion.estado),
        `estado no contractual: ${celda.medicion.estado}`
      );

      estados.push(celda.medicion.estado);
    }
  }

  assert.equal(estados.length, 35);

  assert.equal(r.celdasResueltas, 35);
});


test("32 · las cinco plataformas canonicas estan presentes en cada fila", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  for (const fila of r.candidatos) {
    const claves = Object.keys(fila.celdas).sort();

    assert.deepEqual(claves, ["facebook", "instagram", "tiktok", "x", "youtube"]);
  }

  /* Y LinkedIn/web NO entran en la matriz canonica. */
  for (const fila of r.candidatos) {
    assert.equal(fila.celdas.linkedin, undefined);

    assert.equal(fila.celdas.web, undefined);
  }
});


/*
===========================================================
§33 · DISTRIBUCION, Y POR QUE NO COINCIDE CON LA CERTIFICADA
===========================================================

La certificacion de P-CAND-OPERATIONAL-CLOSURE-01 declaro
26 MEDIDO / 3 PARCIAL / 4 SIN_CUENTA / 1 NO_SOPORTADO /
1 IDENTIDAD_INSUFICIENTE.

Esos numeros NO se fijan aqui a proposito. `cerrarCelda` no
tenia ningun consumidor en `services/` ni en `routes/` —solo su
test unitario, con fixtures sinteticos—, y dos de sus entradas
decisivas no se persisten en ningun sitio:

    discoveryConfirmada    sin evidencia persistida, siempre false
    conflictosConocidos    sin almacenamiento, siempre vacio

Asi que la distribucion certificada no es reproducible desde el
repositorio. Lo que se fija es lo que SI tiene que cumplirse
siempre: que sumen 35 y que ningun estado se salga del contrato.
===========================================================
*/

test("33 · la distribucion suma exactamente 35 y solo usa estados del contrato", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  const suma = Object.values(r.distribucion).reduce((a, b) => a + b, 0);

  assert.equal(suma, 35);

  for (const estado of Object.keys(r.distribucion)) {
    assert.ok(
      Object.values(ESTADOS_CIERRE).includes(estado),
      `estado fuera del contrato: ${estado}`
    );
  }

  /*
    Y NO se degrada todo a dos estados, que es justo lo que hacia
    `/linea-base` —30 MEDIDO + 5 SIN_CUENTA— y el motivo de este
    gate.
  */
  assert.ok(
    Object.keys(r.distribucion).length >= 3,
    "la matriz perdio granularidad: menos de tres estados distintos"
  );
});


test("33 · la matriz declara sus limitaciones en lugar de ocultarlas", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  const ids = (r.limitaciones || []).map((l) => l.id);

  assert.ok(ids.includes("DISCOVERY_NO_PERSISTIDO"));

  assert.ok(ids.includes("CONFLICTOS_NO_PERSISTIDOS"));
});


/*
===========================================================
§34 · IDENTIDAD EXISTE, MEDICION NO -> NUNCA SIN_CUENTA
===========================================================
*/

test("34 · identidad confirmada sin medicion NO se convierte en SIN_CUENTA", () => {
  const celda = celdaDePlataforma({
    plataforma: "youtube",
    cuentas: [
      {
        id: "youtube:canal",
        handle: "canal",
        declaradaPorAnalista: true,
        descubiertaPorSentinel: false,
        corroboradaPorSentinel: false
      }
    ],
    snapshots: []
  });

  /* La identidad se conserva fuerte... */
  assert.equal(celda.identidad.estado, IDENTITY_STATES.ANALYST_CONFIRMED);

  /* ...y la medicion NO miente diciendo que no hay cuenta. */
  assert.notEqual(celda.medicion.estado, ESTADOS_CIERRE.SIN_CUENTA);

  assert.equal(celda.activosTotal, 1);

  assert.equal(celda.metrica, null);
});


test("34 · sin ninguna semilla se cierra IDENTIDAD_INSUFICIENTE, no SIN_CUENTA", () => {
  const celda = celdaDePlataforma({
    plataforma: "facebook",
    cuentas: [],
    snapshots: []
  });

  assert.equal(celda.medicion.estado, ESTADOS_CIERRE.IDENTIDAD_INSUFICIENTE);

  assert.notEqual(celda.medicion.estado, ESTADOS_CIERRE.SIN_CUENTA);

  /*
    Y lo dice: no hay activo confirmado. Que no tengamos semilla
    no prueba que el candidato no tenga cuenta.
  */
  assert.equal(celda.identidad.estado, IDENTITY_STATES.NO_ASSET_CONFIRMED);
});


test("34 · una plataforma con proveedor capaz e identidad fuerte pide proveedor", () => {
  const celda = celdaDePlataforma({
    plataforma: "instagram",
    cuentas: [
      {
        id: "instagram:cuenta",
        declaradaPorAnalista: true
      }
    ],
    snapshots: []
  });

  assert.equal(celda.medicion.estado, ESTADOS_CIERRE.REQUIERE_PROVEEDOR);

  /* No es imposibilidad: es presupuesto, y el motivo lo dice. */
  assert.match(celda.medicion.motivo, /presupuesto/i);
});


test("34 · los dos ejes son independientes y ambos viajan en la celda", () => {
  const celda = celdaDePlataforma({
    plataforma: "tiktok",
    cuentas: [{ id: "tiktok:c", declaradaPorAnalista: true }],
    snapshots: [
      { accountId: "tiktok:c", platform: "tiktok", estado: "MEDIDO_PROVEEDOR", followers: 1200 }
    ]
  });

  assert.equal(celda.identidad.estado, IDENTITY_STATES.ANALYST_CONFIRMED);

  assert.equal(celda.medicion.estado, ESTADOS_CIERRE.MEDIDO);

  assert.ok(celda.identidad.estado !== celda.medicion.estado);
});


/*
===========================================================
§35 · UNA METRICA QUE FALTA NO ES UN CERO
===========================================================
*/

test("35 · sin metrica disponible la celda devuelve null, nunca 0", () => {
  const celda = celdaDePlataforma({
    plataforma: "x",
    cuentas: [{ id: "x:c", declaradaPorAnalista: true }],
    snapshots: [
      /* Snapshot de identidad: confirma la cuenta, no mide nada. */
      { accountId: "x:c", platform: "x", estado: "CUENTA_CONFIRMADA", followers: null }
    ]
  });

  assert.equal(celda.metrica, null);

  assert.notEqual(celda.metrica, 0);
});


test("35 · followers null no produce metrica aunque el snapshot sea de medicion", () => {
  const celda = celdaDePlataforma({
    plataforma: "tiktok",
    cuentas: [{ id: "tiktok:c", declaradaPorAnalista: true }],
    snapshots: [
      { accountId: "tiktok:c", platform: "tiktok", estado: "MEDIDO_PROVEEDOR", followers: null }
    ]
  });

  assert.equal(celda.metrica, null);
});


test("35 · la metrica sale del snapshot mas reciente y declara su procedencia", () => {
  const celda = celdaDePlataforma({
    plataforma: "instagram",
    cuentas: [{ id: "instagram:c", declaradaPorAnalista: true }],
    snapshots: [
      {
        accountId: "instagram:c",
        platform: "instagram",
        estado: "MEDIDO_PROVEEDOR",
        followers: 100,
        capturedAt: "2026-08-01T00:00:00.000Z",
        provider: "scrapecreators"
      },
      {
        accountId: "instagram:c",
        platform: "instagram",
        estado: "MEDIDO_PROVEEDOR",
        followers: 250,
        capturedAt: "2026-09-01T00:00:00.000Z",
        provider: "scrapecreators"
      }
    ]
  });

  assert.equal(celda.metrica.valor, 250);

  assert.equal(celda.metrica.provider, "scrapecreators");

  assert.equal(celda.metrica.capturedAt, "2026-09-01T00:00:00.000Z");
});


test("35 · una metrica de otra plataforma nunca se cuela en la celda", () => {
  const celda = celdaDePlataforma({
    plataforma: "youtube",
    cuentas: [{ id: "youtube:c", declaradaPorAnalista: true }],
    snapshots: [
      { accountId: "facebook:otra", platform: "facebook", estado: "MEDIDO_PROVEEDOR", followers: 999999 }
    ]
  });

  assert.equal(celda.metrica, null);

  assert.equal(celda.snapshots, 0);
});


test("35 · YouTube nombra suscriptores, no seguidores", () => {
  const celda = celdaDePlataforma({
    plataforma: "youtube",
    cuentas: [{ id: "youtube:c", declaradaPorAnalista: true }],
    snapshots: [
      { accountId: "youtube:c", platform: "youtube", estado: "OBSERVADA", followers: 857 }
    ]
  });

  assert.equal(celda.metrica.nombre, "suscriptores");
});


/*
===========================================================
LA MEDICION QUE NO CASA — el defecto que este gate SURFACEA
===========================================================

En el piloto la ficha guarda `youtube:yakuperez4230` y el
snapshot `youtube:@yakuperez4230`. La clasificacion no puede
usar esa medicion, asi que la celda parece menos medida de lo
que esta.

No se arregla aqui —normalizar la clave cambia semantica de
identidad y de persistencia—, pero tampoco se oculta.
===========================================================
*/

test("huerfanas · una medicion cuyo accountId no casa se declara, no se descarta en silencio", () => {
  const celda = celdaDePlataforma({
    plataforma: "youtube",
    cuentas: [{ id: "youtube:canal", declaradaPorAnalista: true }],
    snapshots: [
      { accountId: "youtube:@canal", platform: "youtube", estado: "OBSERVADA", followers: 857 }
    ]
  });

  assert.ok(celda.medicionesHuerfanas);

  assert.deepEqual(celda.medicionesHuerfanas.accountIds, ["youtube:@canal"]);

  assert.deepEqual(celda.medicionesHuerfanas.activosDeLaFicha, ["youtube:canal"]);

  /* Y la metrica NO se toma de ella: no se sabe de quien es. */
  assert.equal(celda.metrica, null);
});


test("huerfanas · sin desajuste el campo queda en null", () => {
  const celda = celdaDePlataforma({
    plataforma: "youtube",
    cuentas: [{ id: "youtube:canal", declaradaPorAnalista: true }],
    snapshots: [
      { accountId: "youtube:canal", platform: "youtube", estado: "OBSERVADA", followers: 857 }
    ]
  });

  assert.equal(celda.medicionesHuerfanas, null);

  assert.equal(celda.metrica.valor, 857);
});


test("huerfanas · el piloto real tiene celdas afectadas y la matriz las cuenta", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  const afectadas = r.candidatos.flatMap((f) =>
    PLATAFORMAS_MATRIZ.filter((p) => f.celdas[p].medicionesHuerfanas)
  );

  assert.ok(afectadas.length > 0, "el desajuste de accountId existe en el piloto");

  const limitacion = (r.limitaciones || []).find(
    (l) => l.id === "ACCOUNT_ID_SIN_CASAR"
  );

  assert.ok(limitacion, "la matriz tiene que declarar el desajuste");

  assert.equal(limitacion.celdasAfectadas, afectadas.length);
});


/*
===========================================================
§12 · COBERTURA — RESUELTAS NO ES MEDIDAS
===========================================================
*/

test("12 · resueltas y medidas son dos cuentas distintas", () => {
  const celdas = {
    facebook: { medicion: { estado: ESTADOS_CIERRE.MEDIDO } },
    instagram: { medicion: { estado: ESTADOS_CIERRE.MEDIDO } },
    tiktok: { medicion: { estado: ESTADOS_CIERRE.MEDIDO } },
    x: { medicion: { estado: ESTADOS_CIERRE.NO_SOPORTADO } },
    youtube: { medicion: { estado: ESTADOS_CIERRE.IDENTIDAD_INSUFICIENTE } }
  };

  const cob = coberturaDeCandidato(celdas);

  assert.equal(cob.medidas, 3);

  assert.equal(cob.resueltas, 5);

  assert.equal(cob.expresionMedidas, "3 de 5 medidas");

  assert.equal(cob.expresionResueltas, "5 de 5 resueltas");

  /* Nunca un porcentaje: las cinco plataformas no pesan igual. */
  assert.equal(cob.porcentaje, null);
});


test("12 · PARCIAL no cuenta como medida", () => {
  const celdas = {
    facebook: { medicion: { estado: ESTADOS_CIERRE.PARCIAL } },
    instagram: { medicion: { estado: ESTADOS_CIERRE.MEDIDO } },
    tiktok: { medicion: { estado: ESTADOS_CIERRE.MEDIDO } },
    x: { medicion: { estado: ESTADOS_CIERRE.MEDIDO } },
    youtube: { medicion: { estado: ESTADOS_CIERRE.MEDIDO } }
  };

  const cob = coberturaDeCandidato(celdas);

  assert.equal(cob.medidas, 4);

  assert.equal(cob.parciales, 1);

  assert.equal(cob.resueltas, 5);
});


test("12 · ningun candidato real del piloto declara 5 de 5 medidas si no lo esta", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  for (const fila of r.candidatos) {
    const medidasReales = PLATAFORMAS_MATRIZ.filter(
      (p) => fila.celdas[p].medicion.estado === ESTADOS_CIERRE.MEDIDO
    ).length;

    assert.equal(
      fila.cobertura.medidas,
      medidasReales,
      `${fila.candidateId}: la cobertura declarada no coincide con las celdas medidas`
    );

    assert.equal(
      fila.cobertura.expresionMedidas,
      `${medidasReales} de 5 medidas`
    );
  }
});


/*
===========================================================
§28 · AISLAMIENTO DE PROYECTO
===========================================================
*/

test("28 · sin projectId la matriz no devuelve nada y explica por que", async () => {
  const r = await matrizDePlataformasDelProyecto({ candidatos: [] });

  assert.equal(r.ok, false);

  assert.match(r.motivo, /proyecto/i);

  assert.equal(r.candidatos.length, 0);
});


test("28 · el proyecto de ensayo no hereda candidatos del piloto", async () => {
  const ensayo = await contenidoDeProyecto(ENSAYO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: ENSAYO,
    candidatos: ensayo?.candidatos || []
  });

  assert.equal(r.candidatos.length, 0);

  assert.equal(r.totalCeldas, 0);

  assert.equal(r.proyectoId, ENSAYO);

  /* El aislamiento se declara. */
  assert.equal(r.aislamiento.projectId, ENSAYO);

  assert.equal(r.aislamiento.candidatosDelProyecto, 0);
});


test("28 · ninguna celda del piloto trae activos de otro proyecto", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const idsDelPiloto = new Set((c.candidatos || []).map((x) => x.id));

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  for (const fila of r.candidatos) {
    assert.ok(idsDelPiloto.has(fila.candidateId));
  }
});


/*
===========================================================
§16 · LINKEDIN Y WEB NO ENTRAN
===========================================================
*/

test("16 · un activo de LinkedIn no altera la matriz de las cinco", () => {
  /*
    Se pasa una cuenta de LinkedIn a una celda de las cinco: no
    puede aparecer, porque la celda solo recibe las cuentas de su
    plataforma. Lo que se comprueba es que la lista canonica no
    la incluye.
  */
  assert.ok(!PLATAFORMAS_MATRIZ.includes("linkedin"));

  assert.ok(!PLATAFORMAS_MATRIZ.includes("web"));

  assert.equal(PLATAFORMAS_MATRIZ.length, 5);
});


/*
===========================================================
§17 · EL HOMONIMO
===========================================================

`instagram:leomoralez.1425` sigue en la ficha de identidad de
Leonardo Morales, y no existe ningun almacen de conflictos: el
parametro `conflictosConocidos` llega vacio en cualquier
ejecucion real.

Este test NO inventa la exclusion —eso seria reinterpretar
identidad y fijar un dato a mano—. Fija dos cosas: que el
mecanismo de exclusion funciona cuando se le pasa el conflicto,
y que hoy no hay nada que se lo pase.
===========================================================
*/

test("17 · el mecanismo de conflicto excluye el activo de la medicion cuando se declara", () => {
  const celda = celdaDePlataforma({
    plataforma: "instagram",
    cuentas: [
      { id: "instagram:buena", declaradaPorAnalista: true },
      { id: "instagram:homonimo", descubiertaPorSentinel: true, corroboradaPorSentinel: true }
    ],
    snapshots: [],
    conflictosConocidos: new Set(["instagram:homonimo"])
  });

  /* El homonimo no cuenta como activo medible... */
  assert.ok(!celda.activos.some((a) => a.accountId === "instagram:homonimo"));

  /* ...pero su evidencia NO se borra: queda declarada. */
  assert.ok(celda.identidad.conflictos.includes("instagram:homonimo"));

  assert.equal(celda.identidad.tieneConflicto, true);
});


test("17 · sin almacen de conflictos el homonimo del piloto sigue contando como activo", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  const leo = r.candidatos.find((f) => f.candidateId === "leonardo-morales");

  assert.ok(leo, "Leonardo Morales tiene que estar en el piloto");

  const ig = leo.celdas.instagram;

  /*
    Se documenta el estado REAL: el activo esta ahi y ninguna
    celda lo marca como conflicto, porque nada persiste esa
    decision. Si algun dia se persiste, este test falla y hay que
    actualizarlo — que es exactamente lo que se quiere.
  */
  assert.ok(
    ig.activos.some((a) => /leomoralez/i.test(a.accountId)),
    "el homonimo sigue en la ficha; la exclusion nunca se persistio"
  );

  assert.equal(ig.identidad.tieneConflicto, false);
});
