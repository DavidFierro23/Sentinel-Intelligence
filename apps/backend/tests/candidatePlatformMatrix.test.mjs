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

  assert.ok(ids.includes("IDENTITY_EXCLUSION_PERSISTENCE_DEBT"));
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

/*
===========================================================
A–F · AGREGACION MULTI-ACTIVO
CANDIDATE-MULTI-ASSET-UX-RESOLUTION-02
===========================================================

El defecto: la celda tomaba el snapshot mas reciente de TODA la
plataforma en lugar de agregar por activo. Con un solo activo
acertaba por casualidad; con dos, mostraba el del activo
observado mas tarde y ocultaba el otro.
===========================================================
*/

test("A · agrega por activo, NO toma el snapshot global mas reciente", () => {
  const celda = celdaDePlataforma({
    plataforma: "instagram",
    cuentas: [
      { id: "instagram:grande", handle: "grande", declaradaPorAnalista: true },
      { id: "instagram:pequena", handle: "pequena", declaradaPorAnalista: true }
    ],
    snapshots: [
      /* El grande se observo ANTES. */
      {
        accountId: "instagram:grande",
        platform: "instagram",
        estado: "OBSERVADA",
        followers: 10000,
        capturedAt: "2026-08-31T00:00:00.000Z"
      },
      /* El pequeno se observo DESPUES: antes ganaba y tapaba al otro. */
      {
        accountId: "instagram:pequena",
        platform: "instagram",
        estado: "MEDIDO_PROVEEDOR",
        followers: 500,
        capturedAt: "2026-09-03T00:00:00.000Z"
      }
    ]
  });

  /* El valor NO es el del snapshot mas reciente. */
  assert.notEqual(celda.metrica.valor, 500);

  /* Ni el del mayor por si solo. */
  assert.notEqual(celda.metrica.valor, 10000);

  /* Es la suma de los dos activos. */
  assert.equal(celda.metrica.valor, 10500);

  assert.equal(celda.metrica.metodo, "SUMA_DE_ACTIVOS");
});


test("A · por cada activo se usa SU snapshot mas reciente, no el primero", () => {
  const celda = celdaDePlataforma({
    plataforma: "tiktok",
    cuentas: [{ id: "tiktok:c", declaradaPorAnalista: true }],
    snapshots: [
      {
        accountId: "tiktok:c",
        platform: "tiktok",
        estado: "MEDIDO_PROVEEDOR",
        followers: 100,
        capturedAt: "2026-08-01T00:00:00.000Z"
      },
      {
        accountId: "tiktok:c",
        platform: "tiktok",
        estado: "MEDIDO_PROVEEDOR",
        followers: 900,
        capturedAt: "2026-09-01T00:00:00.000Z"
      }
    ]
  });

  assert.equal(celda.metrica.valor, 900);

  assert.equal(celda.metrica.activosConMetrica, 1);
});


test("D · assetCount cuenta activos distintos, no snapshots", () => {
  const celda = celdaDePlataforma({
    plataforma: "facebook",
    cuentas: [
      { id: "facebook:a", declaradaPorAnalista: true },
      { id: "facebook:b", declaradaPorAnalista: true }
    ],
    snapshots: [
      { accountId: "facebook:a", platform: "facebook", estado: "OBSERVADA", followers: 10, capturedAt: "2026-09-01T00:00:00.000Z" },
      { accountId: "facebook:a", platform: "facebook", estado: "OBSERVADA", followers: 20, capturedAt: "2026-09-02T00:00:00.000Z" },
      { accountId: "facebook:b", platform: "facebook", estado: "OBSERVADA", followers: 30, capturedAt: "2026-09-02T00:00:00.000Z" }
    ]
  });

  assert.equal(celda.assetCount, 2);

  assert.equal(celda.snapshots, 3);

  /* 20 (ultimo de A) + 30 (B) = 50. Nunca 10+20+30. */
  assert.equal(celda.metrica.valor, 50);
});


test("E · el metodo de agregacion se expone, no se adivina", () => {
  const uno = celdaDePlataforma({
    plataforma: "x",
    cuentas: [{ id: "x:solo", declaradaPorAnalista: true }],
    snapshots: [
      { accountId: "x:solo", platform: "x", estado: "OBSERVADA", followers: 7 }
    ]
  });

  const dos = celdaDePlataforma({
    plataforma: "x",
    cuentas: [
      { id: "x:a", declaradaPorAnalista: true },
      { id: "x:b", declaradaPorAnalista: true }
    ],
    snapshots: [
      { accountId: "x:a", platform: "x", estado: "OBSERVADA", followers: 7 },
      { accountId: "x:b", platform: "x", estado: "OBSERVADA", followers: 3 }
    ]
  });

  assert.equal(uno.metrica.metodo, "ACTIVO_UNICO");

  assert.equal(dos.metrica.metodo, "SUMA_DE_ACTIVOS");

  assert.equal(uno.metrica.acumulado, false);

  assert.equal(dos.metrica.acumulado, true);
});


test("F · la suma NUNCA se presenta como audiencia unica ni personas", () => {
  const celda = celdaDePlataforma({
    plataforma: "instagram",
    cuentas: [
      { id: "instagram:a", declaradaPorAnalista: true },
      { id: "instagram:b", declaradaPorAnalista: true }
    ],
    snapshots: [
      { accountId: "instagram:a", platform: "instagram", estado: "OBSERVADA", followers: 1000 },
      { accountId: "instagram:b", platform: "instagram", estado: "OBSERVADA", followers: 2000 }
    ]
  });

  /* La etiqueta dice que es acumulado y de cuantos activos. */
  assert.match(celda.metrica.etiqueta, /acumulados entre 2 activos/);

  /* Y niega explicitamente la lectura de personas unicas. */
  assert.match(celda.metrica.noEs, /NO son personas únicas/);

  assert.match(celda.metrica.noEs, /solaparse/);

  /*
    Y ningun campo AFIRMATIVO la llama audiencia, alcance ni
    personas. `noEs` se excluye a proposito: su trabajo es
    nombrar esas lecturas para negarlas, y comprobarlo sobre el
    objeto entero daba un falso positivo sobre la propia
    negacion.
  */
  const afirmativos = [
    celda.metrica.nombre,
    celda.metrica.etiqueta,
    celda.metrica.metodo
  ].join(" ");

  assert.ok(
    !/audiencia|alcance|personas|únic/i.test(afirmativos),
    `un campo afirmativo usa vocabulario de audiencia: ${afirmativos}`
  );
});


test("G · un solo activo conserva el comportamiento anterior", () => {
  const celda = celdaDePlataforma({
    plataforma: "tiktok",
    cuentas: [{ id: "tiktok:unico", handle: "unico", declaradaPorAnalista: true }],
    snapshots: [
      {
        accountId: "tiktok:unico",
        platform: "tiktok",
        estado: "MEDIDO_PROVEEDOR",
        followers: 519300,
        capturedAt: "2026-09-01T00:00:00.000Z",
        provider: "scrapecreators"
      }
    ]
  });

  assert.equal(celda.metrica.valor, 519300);

  assert.equal(celda.metrica.acumulado, false);

  /* Sin sufijo «acumulados» cuando hay un solo activo. */
  assert.ok(!/acumulad/.test(celda.metrica.etiqueta));

  assert.equal(celda.metrica.noEs, null);

  /* Y la procedencia sigue viajando, como antes. */
  assert.equal(celda.metrica.accountId, "tiktok:unico");

  assert.equal(celda.metrica.provider, "scrapecreators");
});


test("H · un activo sin metrica queda en null y no aporta 0 a la suma", () => {
  const celda = celdaDePlataforma({
    plataforma: "facebook",
    cuentas: [
      { id: "facebook:medido", declaradaPorAnalista: true },
      { id: "facebook:sinmedir", declaradaPorAnalista: true }
    ],
    snapshots: [
      { accountId: "facebook:medido", platform: "facebook", estado: "OBSERVADA", followers: 400 },
      /* Confirma identidad, no mide: no son cero seguidores. */
      { accountId: "facebook:sinmedir", platform: "facebook", estado: "CUENTA_CONFIRMADA", followers: null }
    ]
  });

  assert.equal(celda.metrica.valor, 400);

  assert.equal(celda.metrica.activosConMetrica, 1);

  assert.equal(celda.metrica.activosTotal, 2);

  /* Y el activo sin medir lo declara con null, no con 0. */
  const sinMedir = celda.activos.find((a) => a.accountId === "facebook:sinmedir");

  assert.equal(sinMedir.metrica.valor, null);

  assert.notEqual(sinMedir.metrica.valor, 0);
});


test("11 · no se mezclan familias metricas ni plataformas", () => {
  const yt = celdaDePlataforma({
    plataforma: "youtube",
    cuentas: [{ id: "youtube:canal", declaradaPorAnalista: true }],
    snapshots: [
      { accountId: "youtube:canal", platform: "youtube", estado: "OBSERVADA", followers: 800 },
      /* Un snapshot de OTRA plataforma no puede entrar. */
      { accountId: "tiktok:otro", platform: "tiktok", estado: "OBSERVADA", followers: 500000 }
    ]
  });

  assert.equal(yt.metrica.valor, 800);

  assert.equal(yt.metrica.nombre, "suscriptores");

  assert.equal(yt.snapshots, 1);
});


/*
===========================================================
B–C · EL CASO LLORET, DESDE EL STORE
===========================================================

Nada hardcodeado: los dos activos, sus valores y la suma se
leen del Lake. Lo que se fija es la ESTRUCTURA —dos activos
validos participan y el total es su suma—, no las cifras.
===========================================================
*/

test("B · Lloret/Instagram consume los DOS activos validos", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  const lloret = r.candidatos.find(
    (f) => f.candidateId === "juan-cristobal-lloret-valdivieso"
  );

  assert.ok(lloret, "Lloret tiene que estar en el piloto");

  const ig = lloret.celdas.instagram;

  /* Dos activos distintos, ambos con metrica. */
  assert.equal(ig.assetCount, 2);

  assert.equal(ig.metrica.activosConMetrica, 2);

  assert.equal(ig.metrica.acumulado, true);

  assert.equal(ig.metrica.metodo, "SUMA_DE_ACTIVOS");

  /* Cada activo trae su propio valor, su fecha y su via. */
  const conValor = ig.activos.filter((a) => a.metrica?.valor != null);

  assert.equal(conValor.length, 2);

  conValor.forEach((a) => {
    assert.ok(a.accountId, "cada activo conserva su clave canonica");

    assert.ok(a.accountIdOriginal, "y su id crudo");

    assert.ok(a.metrica.capturedAt, "y cuando se observo");

    assert.ok(a.metrica.provider, "y por que via");
  });

  /* Las dos vias son distintas: el agregado cruza proveedores. */
  assert.notEqual(conValor[0].metrica.provider, conValor[1].metrica.provider);
});


test("C · el agregado de Lloret es la suma de sus activos, leida del store", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  const ig = r.candidatos.find(
    (f) => f.candidateId === "juan-cristobal-lloret-valdivieso"
  ).celdas.instagram;

  const suma = ig.activos
    .map((a) => a.metrica?.valor)
    .filter((v) => v != null)
    .reduce((a, b) => a + b, 0);

  assert.equal(ig.metrica.valor, suma);

  /*
    Y el defecto que se corrige: el total NO puede ser el valor de
    un solo activo.
  */
  ig.activos.forEach((a) => {
    if (a.metrica?.valor != null && ig.activos.length > 1) {
      assert.notEqual(
        ig.metrica.valor,
        a.metrica.valor,
        "el agregado coincide con un solo activo: la suma no se aplico"
      );
    }
  });

  /* La celda queda MEDIDO, no PARCIAL: los dos activos se midieron. */
  assert.equal(ig.medicion.estado, ESTADOS_CIERRE.MEDIDO);
});


test("C · el piloto tiene varias celdas multi-activo y todas suman", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  const agregadas = [];

  for (const fila of r.candidatos) {
    for (const p of PLATAFORMAS_MATRIZ) {
      const celda = fila.celdas[p];

      if (celda.metrica?.acumulado) agregadas.push({ fila, p, celda });
    }
  }

  assert.ok(agregadas.length > 0, "el piloto tiene celdas multi-activo reales");

  for (const { celda } of agregadas) {
    const suma = celda.activos
      .map((a) => a.metrica?.valor)
      .filter((v) => v != null)
      .reduce((a, b) => a + b, 0);

    assert.equal(celda.metrica.valor, suma);

    assert.ok(celda.metrica.activosConMetrica > 1);

    assert.match(celda.metrica.etiqueta, /acumulados/);
  }

  /* Y la matriz lo declara como limitacion, no lo da por obvio. */
  const lim = (r.limitaciones || []).find(
    (l) => l.id === "AGREGACION_MULTI_ACTIVO"
  );

  assert.ok(lim, "la agregacion multi-activo tiene que declararse");

  assert.equal(lim.celdasAfectadas, agregadas.length);
});


test("contrato · el orden de agregacion se declara en la respuesta", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  assert.ok(Array.isArray(r.contrato.ordenDeAgregacion));

  assert.equal(r.contrato.ordenDeAgregacion.length, 3);

  /* Y se prohibe explicitamente el defecto corregido. */
  assert.ok(
    r.contrato.prohibido.some((x) =>
      /un solo snapshot de toda la plataforma/i.test(x)
    )
  );

  assert.ok(
    r.contrato.prohibido.some((x) => /audiencia única|alcance|personas/i.test(x))
  );
});


/*
  FIXTURES ACTUALIZADOS EN CANDIDATE-MULTI-ASSET-UX-RESOLUTION-02.

  Estas tres pruebas fijaban el comportamiento de las «huerfanas»
  como invariante: `youtube:@canal` frente a `youtube:canal` daba
  una medicion inalcanzable y la celda lo declaraba.

  Ese comportamiento ERA EL DEFECTO. Los dos ids son el mismo
  activo, y `resolverIdentidadCanonica` —la capa que ya usaban
  IPDO y `projectStore`— lo resolvia desde el principio; esta
  matriz simplemente no la llamaba.

  Ahora se comprueba lo contrario y es mas fuerte: que el
  desajuste ARTIFICIAL desaparece, y que un desajuste REAL
  —una cuenta observada que nadie atribuyo— sigue viendose.
*/

test("I · el desajuste artificial de accountId se resuelve con la capa canonica", () => {
  const celda = celdaDePlataforma({
    plataforma: "youtube",
    cuentas: [{ id: "youtube:canal", declaradaPorAnalista: true }],
    snapshots: [
      { accountId: "youtube:@canal", platform: "youtube", estado: "OBSERVADA", followers: 857 }
    ]
  });

  /* Ya no hay huerfana: era el mismo activo escrito de dos formas. */
  assert.equal(celda.medicionesSinActivo, null);

  /* Y la medicion se usa, en lugar de quedar inalcanzable. */
  assert.equal(celda.metrica.valor, 857);

  assert.equal(celda.metrica.nombre, "suscriptores");

  /* El id crudo NO se reescribe: la evidencia se conserva. */
  assert.equal(celda.activos[0].accountIdOriginal, "youtube:canal");
});


test("I · el alias legacy channelId/handle tambien resuelve", () => {
  /*
    `youtube:@paulcarrascocarpio9219` === `youtube:ucxp6...`, el
    alias revisado a mano que ya vivia en `LEGACY_ACCOUNT_ALIASES`.
  */
  const celda = celdaDePlataforma({
    plataforma: "youtube",
    cuentas: [
      { id: "youtube:ucxp6qogn2ksjfcea-izjmdw", declaradaPorAnalista: true }
    ],
    snapshots: [
      {
        accountId: "youtube:@paulcarrascocarpio9219",
        platform: "youtube",
        estado: "OBSERVADA",
        followers: 15
      }
    ]
  });

  assert.equal(celda.medicionesSinActivo, null);

  assert.equal(celda.metrica.valor, 15);
});


test("J · el alias NO duplica el mismo activo escrito de dos formas", () => {
  const celda = celdaDePlataforma({
    plataforma: "x",
    cuentas: [
      { id: "x:JuanCVegaEC", declaradaPorAnalista: true },
      { id: "x:juancvegaec", descubiertaPorSentinel: true }
    ],
    snapshots: [
      { accountId: "x:juancvegaec", platform: "x", estado: "OBSERVADA", followers: 5000 }
    ]
  });

  /* Dos escrituras, UN activo. */
  assert.equal(celda.assetCount, 1);

  assert.equal(celda.activos.length, 1);

  /* Los dos ids crudos se conservan. */
  assert.deepEqual(celda.activos[0].idsOriginales, ["x:JuanCVegaEC", "x:juancvegaec"]);

  /* Y los 5.000 seguidores se cuentan UNA vez, no dos. */
  assert.equal(celda.metrica.valor, 5000);

  assert.equal(celda.metrica.acumulado, false);

  assert.equal(celda.metrica.metodo, "ACTIVO_UNICO");
});


test("K · dos activos realmente distintos siguen siendo distintos", () => {
  const celda = celdaDePlataforma({
    plataforma: "instagram",
    cuentas: [
      { id: "instagram:cuenta_a", declaradaPorAnalista: true },
      { id: "instagram:cuenta_b", declaradaPorAnalista: true }
    ],
    snapshots: [
      { accountId: "instagram:cuenta_a", platform: "instagram", estado: "OBSERVADA", followers: 100 },
      { accountId: "instagram:cuenta_b", platform: "instagram", estado: "OBSERVADA", followers: 200 }
    ]
  });

  assert.equal(celda.assetCount, 2);

  assert.equal(celda.metrica.valor, 300);

  assert.equal(celda.metrica.acumulado, true);
});


test("I · una medicion de una cuenta que nadie atribuyo SI se declara", () => {
  const celda = celdaDePlataforma({
    plataforma: "instagram",
    cuentas: [{ id: "instagram:oficial", declaradaPorAnalista: true }],
    snapshots: [
      { accountId: "instagram:oficial", platform: "instagram", estado: "OBSERVADA", followers: 500 },
      /* Esta no esta en la ficha ni canonicalizando. */
      { accountId: "instagram:desconocida", platform: "instagram", estado: "OBSERVADA", followers: 90000 }
    ]
  });

  assert.ok(celda.medicionesSinActivo);

  assert.deepEqual(celda.medicionesSinActivo.accountIds, ["instagram:desconocida"]);

  /* Y sus 90.000 seguidores NO entran en el agregado. */
  assert.equal(celda.metrica.valor, 500);

  assert.equal(celda.metrica.acumulado, false);
});


test("I · el piloto real ya no tiene desajustes artificiales de accountId", async () => {
  const c = await contenidoDeProyecto(PILOTO);

  const r = await matrizDePlataformasDelProyecto({
    projectId: PILOTO,
    candidatos: c.candidatos || []
  });

  const afectadas = r.candidatos.flatMap((f) =>
    PLATAFORMAS_MATRIZ.filter((p) => f.celdas[p].medicionesSinActivo)
  );

  /*
    Las 4 del gate anterior —2 en YouTube por el `@`/alias y 2 en
    X por mayusculas— eran todas artificiales y desaparecen.
  */
  assert.equal(
    afectadas.length,
    0,
    `siguen habiendo desajustes: ${afectadas.join(", ")}`
  );

  assert.ok(
    !(r.limitaciones || []).some((l) => l.id === "MEDICION_SIN_ACTIVO_ATRIBUIDO"),
    "sin desajustes no debe declararse la limitacion"
  );
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
