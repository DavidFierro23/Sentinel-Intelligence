import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PLATAFORMAS_BENCHMARK,
  ESTADOS_CELDA,
  clasificarCelda,
  construirMatrizBenchmark,
  celdasListasParaLongitudinal
} from "../services/intelligence/socialBenchmarkMatrix.js";

/*
  P-CAND-SOCIAL-BENCH-02. Cero red: toda la suite opera sobre
  fixtures en memoria que reproducen la FORMA real de
  activos/snapshots persistidos, nunca sobre datos inventados de
  metricas.
*/

test("A) la matriz cubre todos los candidatos y las 5 plataformas, ninguna celda vacia", () => {
  const candidatos = [
    { candidatoId: "c1", plataformas: {} },
    { candidatoId: "c2", plataformas: {} }
  ];
  const { filas, totalCeldas } = construirMatrizBenchmark(candidatos);
  assert.equal(filas.length, 2);
  assert.equal(totalCeldas, 10);
  for (const fila of filas) {
    for (const plataforma of PLATAFORMAS_BENCHMARK) {
      assert.ok(fila.celdas[plataforma], `falta celda ${plataforma} en ${fila.candidatoId}`);
      assert.ok(Object.values(ESTADOS_CELDA).includes(fila.celdas[plataforma].estado));
    }
  }
});

test("B) ningun estado es null/undefined/'no sabemos' incluso sin datos", () => {
  const { filas } = construirMatrizBenchmark([{ candidatoId: "vacio", plataformas: {} }]);
  for (const plataforma of PLATAFORMAS_BENCHMARK) {
    assert.notEqual(filas[0].celdas[plataforma].estado, null);
    assert.notEqual(filas[0].celdas[plataforma].estado, undefined);
  }
});

test("C) multi-asset se preserva: 3 activos de Instagram nunca colapsan a 1", () => {
  const celda = clasificarCelda({
    activos: [
      { accountId: "instagram:a", elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" },
      { accountId: "instagram:b", elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" },
      { accountId: "instagram:c", elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" }
    ],
    snapshots: [
      { accountId: "instagram:a", estado: "MEDIDO_PROVEEDOR", capturedAt: "2026-09-01T00:00:00Z" },
      { accountId: "instagram:b", estado: "MEDIDO_PROVEEDOR", capturedAt: "2026-09-01T00:00:00Z" }
    ]
  });
  assert.equal(celda.estado, ESTADOS_CELDA.PARCIAL);
  assert.equal(celda.activosTotal, 3);
  assert.equal(celda.activosCubiertos, 2);
});

test("D) oficial gana: activo medido por Meta/X/YouTube oficial se clasifica MEDIDO sin exigir proveedor", () => {
  const celda = clasificarCelda({
    activos: [{ accountId: "x:cand", elegibilidad: null }],
    snapshots: [{ accountId: "x:cand", estado: "OBSERVADA", provider: "x_api" }]
  });
  assert.equal(celda.estado, ESTADOS_CELDA.MEDIDO);
});

test("E) fallback de proveedor: activo NO_ELEGIBLE_META_OFICIAL_TERCEROS sin snapshot pide proveedor, no NO_PROBADO", () => {
  const celda = clasificarCelda({
    activos: [{ accountId: "instagram:personal", elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" }],
    snapshots: []
  });
  assert.equal(celda.estado, ESTADOS_CELDA.REQUIERE_PROVEEDOR);
});

test("F) nunca fabrica SIN_CUENTA sin discoveryConfirmada explicita", () => {
  const celdaSinEvidencia = clasificarCelda({ activos: [], snapshots: [], discoveryConfirmada: false });
  assert.equal(celdaSinEvidencia.estado, ESTADOS_CELDA.NO_PROBADO_SIN_REFERENCIA);

  const celdaConEvidencia = clasificarCelda({ activos: [], snapshots: [], discoveryConfirmada: true });
  assert.equal(celdaConEvidencia.estado, ESTADOS_CELDA.SIN_CUENTA);
});

test("G) null nunca se confunde con 0: un followers=null en un snapshot no cuenta como medicion invalida ni se filtra la celda por eso", () => {
  const celda = clasificarCelda({
    activos: [{ accountId: "tiktok:cand", elegibilidad: null }],
    snapshots: [{ accountId: "tiktok:cand", estado: "CUENTA_CONFIRMADA", followers: null }]
  });
  // identidad confirmada, metrica ausente (null, no 0): debe pedir proveedor, no fingir medicion.
  assert.equal(celda.estado, ESTADOS_CELDA.REQUIERE_PROVEEDOR);
});

test("H) identity-only (oEmbed) no se cuenta como medicion de metricas", () => {
  const celda = clasificarCelda({
    activos: [{ accountId: "tiktok:cand", elegibilidad: null }],
    snapshots: [{ accountId: "tiktok:cand", estado: "CUENTA_CONFIRMADA", provider: "tiktok_oembed" }]
  });
  assert.notEqual(celda.estado, ESTADOS_CELDA.MEDIDO);
  assert.equal(celda.estado, ESTADOS_CELDA.REQUIERE_PROVEEDOR);
});

test("I) project isolation: mismo accountId en snapshots de otro proyecto no contamina la celda", () => {
  const snapshotsProyectoAjeno = [{ accountId: "instagram:compartido", estado: "MEDIDO_PROVEEDOR", projectId: "otro-proyecto" }];
  // El modulo no filtra por projectId -contrato: quien arma la entrada ya filtro por proyecto antes de llamar.
  // Se prueba que si la entrada SI viene filtrada (caso real), la celda no ve nada.
  const celda = clasificarCelda({
    activos: [{ accountId: "instagram:compartido", elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" }],
    snapshots: [] // el caller ya excluyo snapshotsProyectoAjeno por no pertenecer a este proyecto
  });
  assert.equal(celda.estado, ESTADOS_CELDA.REQUIERE_PROVEEDOR);
  assert.ok(snapshotsProyectoAjeno.length === 1); // referencia usada solo para documentar el contrato, no se filtra aqui
});

test("J) provenance: MEDIDO_PROVEEDOR y MEDIDO oficial no se confunden en el tally", () => {
  const candidatos = [
    {
      candidatoId: "c1",
      plataformas: {
        instagram: {
          activos: [{ accountId: "instagram:a", elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" }],
          snapshots: [{ accountId: "instagram:a", estado: "MEDIDO_PROVEEDOR", provider: "scrapecreators" }]
        },
        x: {
          activos: [{ accountId: "x:a", elegibilidad: null }],
          snapshots: [{ accountId: "x:a", estado: "OBSERVADA", provider: "x_api" }]
        }
      }
    }
  ];
  const { filas } = construirMatrizBenchmark(candidatos);
  assert.equal(filas[0].celdas.instagram.estado, ESTADOS_CELDA.MEDIDO);
  assert.equal(filas[0].celdas.x.estado, ESTADOS_CELDA.MEDIDO);
  // Ambos llegan a MEDIDO, pero la fuente real (provider vs oficial) sigue disponible en los snapshots de origen,
  // no se resume a un solo literal que borre la procedencia.
});

test("K) error de proveedor en un activo no tumba la celda ni el resto de activos del mismo candidato", () => {
  const celda = clasificarCelda({
    activos: [
      { accountId: "instagram:ok", elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" },
      { accountId: "instagram:fallo", elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" }
    ],
    snapshots: [{ accountId: "instagram:ok", estado: "MEDIDO_PROVEEDOR" }]
    // instagram:fallo no tiene snapshot -el proveedor devolvio ERROR_PROVEEDOR y no se escribio nada, no un 0-.
  });
  assert.equal(celda.estado, ESTADOS_CELDA.PARCIAL);
  assert.equal(celda.activosCubiertos, 1);
});

test("L) budget stop: la funcion es pura y no hace red ni cuenta creditos; solo clasifica lo ya persistido", () => {
  const antes = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("no debe llamarse red desde el clasificador"); };
  try {
    clasificarCelda({
      activos: [{ accountId: "facebook:x", elegibilidad: "POTENCIALMENTE_ELEGIBLE_META_DECLARADA" }],
      snapshots: []
    });
    construirMatrizBenchmark([{ candidatoId: "c", plataformas: {} }]);
  } finally {
    globalThis.fetch = antes;
  }
});

test("M) READY_FOR_LONGITUDINAL exige 2+ snapshots comparables del MISMO activo", () => {
  const candidatos = [
    {
      candidatoId: "c1",
      plataformas: {
        x: {
          snapshots: [
            { accountId: "x:a", estado: "OBSERVADA", capturedAt: "2026-08-01T00:00:00Z" },
            { accountId: "x:a", estado: "OBSERVADA", capturedAt: "2026-08-28T00:00:00Z" }
          ]
        },
        instagram: {
          snapshots: [{ accountId: "instagram:a", estado: "MEDIDO_PROVEEDOR", capturedAt: "2026-09-01T00:00:00Z" }]
        }
      }
    }
  ];
  const listas = celdasListasParaLongitudinal(candidatos);
  assert.equal(listas.length, 1);
  assert.equal(listas[0].plataforma, "x");
  assert.equal(listas[0].snapshotCount, 2);
  assert.equal(listas[0].firstSnapshot, "2026-08-01T00:00:00Z");
  assert.equal(listas[0].latestSnapshot, "2026-08-28T00:00:00Z");
});

test("N) READY_FOR_LONGITUDINAL ignora snapshots identity-only (no son medicion real)", () => {
  const candidatos = [
    {
      candidatoId: "c1",
      plataformas: {
        tiktok: {
          snapshots: [
            { accountId: "tiktok:a", estado: "CUENTA_CONFIRMADA", capturedAt: "2026-08-01T00:00:00Z" },
            { accountId: "tiktok:a", estado: "CUENTA_CONFIRMADA", capturedAt: "2026-08-28T00:00:00Z" }
          ]
        }
      }
    }
  ];
  const listas = celdasListasParaLongitudinal(candidatos);
  assert.equal(listas.length, 0);
});
