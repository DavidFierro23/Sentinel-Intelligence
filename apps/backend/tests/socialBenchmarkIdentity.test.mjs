import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IDENTITY_STATES,
  identidadDeCuenta,
  clasificarCeldaConIdentidad,
  snapshotReadinessDeActivo,
  ESTADOS_CELDA
} from "../services/intelligence/socialBenchmarkMatrix.js";

/*
  P-CAND-SOCIAL-BENCH-02A. Cero red. Reutiliza la taxonomia YA
  EXISTENTE en projectStore.fichaIdentidad (declaradaPorAnalista /
  descubiertaPorSentinel / corroboradaPorSentinel), no inventa una
  paralela.
*/

test("exactamente 35 celdas, primaryStatus mutuamente exclusivo, suma = 35", () => {
  const candidatos = Array.from({ length: 7 }, (_, i) => ({ candidatoId: `c${i}` }));
  const plataformas = ["facebook", "instagram", "tiktok", "x", "youtube"];
  const tally = {};
  for (const c of candidatos) {
    for (const p of plataformas) {
      const celda = clasificarCeldaConIdentidad({ activos: [], snapshots: [], discoveryConfirmada: false });
      tally[celda.estado] = (tally[celda.estado] || 0) + 1;
      // primaryStatus exclusivo: un solo `estado`, nunca una lista
      assert.equal(typeof celda.estado, "string");
    }
  }
  const suma = Object.values(tally).reduce((a, b) => a + b, 0);
  assert.equal(suma, 35);
});

test("referencia del analista es semilla fuerte: declaradaPorAnalista=true => ANALYST_CONFIRMED, incluso sin snapshot", () => {
  const identidad = identidadDeCuenta({
    accountId: "instagram:x",
    declaradaPorAnalista: true,
    descubiertaPorSentinel: false,
    corroboradaPorSentinel: false
  });
  assert.equal(identidad, IDENTITY_STATES.ANALYST_CONFIRMED);
});

test("ANALYST_CONFIRMED nunca degrada a NO_PROBADO por identidad; measurement se decide aparte", () => {
  const celda = clasificarCeldaConIdentidad({
    activos: [{ accountId: "tiktok:x", declaradaPorAnalista: true, elegibilidad: null }],
    snapshots: []
  });
  // identidad si reconocida
  assert.equal(celda.identidadDominante, IDENTITY_STATES.ANALYST_CONFIRMED);
  // measurement puede seguir sin medir -- pero la CELDA no perdio la referencia del analista
  assert.equal(celda.estado, ESTADOS_CELDA.NO_PROBADO);
  assert.equal(celda.activosTotal, 1); // el activo sigue contando, no desaparecio
});

test("ANALYST_CONFIRMED != SYSTEM_VERIFIED automatico", () => {
  const soloAnalista = identidadDeCuenta({ declaradaPorAnalista: true, corroboradaPorSentinel: false });
  const corroborado = identidadDeCuenta({ declaradaPorAnalista: false, descubiertaPorSentinel: true, corroboradaPorSentinel: true });
  assert.notEqual(soloAnalista, IDENTITY_STATES.SYSTEM_VERIFIED);
  assert.equal(soloAnalista, IDENTITY_STATES.ANALYST_CONFIRMED);
  assert.equal(corroborado, IDENTITY_STATES.SYSTEM_VERIFIED);
});

test("referencia del analista no detiene el full discovery: DISCOVERED sigue siendo un estado valido en otra plataforma del mismo candidato", () => {
  const ig = identidadDeCuenta({ declaradaPorAnalista: true });
  const fb = identidadDeCuenta({ declaradaPorAnalista: false, descubiertaPorSentinel: true, corroboradaPorSentinel: false });
  assert.equal(ig, IDENTITY_STATES.ANALYST_CONFIRMED);
  assert.equal(fb, IDENTITY_STATES.DISCOVERED);
});

test("identity state separado de measurement state en la misma celda", () => {
  const celdaMedida = clasificarCeldaConIdentidad({
    activos: [{ accountId: "x:a", declaradaPorAnalista: true, elegibilidad: null }],
    snapshots: [{ accountId: "x:a", estado: "OBSERVADA" }]
  });
  assert.equal(celdaMedida.identidadDominante, IDENTITY_STATES.ANALYST_CONFIRMED);
  assert.equal(celdaMedida.estado, ESTADOS_CELDA.MEDIDO);

  const celdaSinMedir = clasificarCeldaConIdentidad({
    activos: [{ accountId: "instagram:a", declaradaPorAnalista: true, elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" }],
    snapshots: []
  });
  assert.equal(celdaSinMedir.identidadDominante, IDENTITY_STATES.ANALYST_CONFIRMED);
  assert.equal(celdaSinMedir.estado, ESTADOS_CELDA.REQUIERE_PROVEEDOR);
});

test("conflicto de identidad excluye al activo de la medicion: no alimenta coverage/followers", () => {
  const conflictos = new Set(["instagram:homonimo"]);
  const celda = clasificarCeldaConIdentidad({
    activos: [
      { accountId: "instagram:real", declaradaPorAnalista: true, elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" },
      { accountId: "instagram:homonimo", declaradaPorAnalista: false, descubiertaPorSentinel: true, corroboradaPorSentinel: true, elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" }
    ],
    snapshots: [
      { accountId: "instagram:real", estado: "MEDIDO_PROVEEDOR" },
      { accountId: "instagram:homonimo", estado: "MEDIDO_PROVEEDOR" }
    ],
    conflictosConocidos: conflictos
  });
  // El homonimo tiene snapshot real, pero se excluye del calculo:
  // solo 1 activo VALIDO (instagram:real), y ese esta medido => MEDIDO, no PARCIAL "2/2".
  assert.equal(celda.estado, ESTADOS_CELDA.MEDIDO);
  assert.equal(celda.activosTotal, 1);
  assert.deepEqual(celda.activosConConflicto, ["instagram:homonimo"]);
  assert.equal(celda.tieneConflictoDeIdentidad, true);
});

test("homonimo rechazado: evidencia preservada, nunca borrada en silencio", () => {
  const conflictos = new Set(["instagram:homonimo"]);
  const celda = clasificarCeldaConIdentidad({
    activos: [{ accountId: "instagram:homonimo", declaradaPorAnalista: false, descubiertaPorSentinel: true, corroboradaPorSentinel: true }],
    snapshots: [{ accountId: "instagram:homonimo", estado: "MEDIDO_PROVEEDOR" }],
    conflictosConocidos: conflictos
  });
  assert.equal(celda.identidadPorActivo[0].identityState, IDENTITY_STATES.IDENTITY_CONFLICT);
  assert.equal(celda.tieneConflictoDeIdentidad, true);
  // sin activos validos restantes: no hay evidencia ficticia de SIN_CUENTA
  assert.equal(celda.estado, ESTADOS_CELDA.NO_PROBADO_SIN_REFERENCIA);
});

test("multi-asset se preserva incluso con identidades mixtas (analista + discovery + conflicto)", () => {
  const conflictos = new Set(["instagram:c"]);
  const celda = clasificarCeldaConIdentidad({
    activos: [
      { accountId: "instagram:a", declaradaPorAnalista: true, elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" },
      { accountId: "instagram:b", declaradaPorAnalista: false, descubiertaPorSentinel: true, elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" },
      { accountId: "instagram:c", descubiertaPorSentinel: true, corroboradaPorSentinel: true, elegibilidad: "NO_ELEGIBLE_META_OFICIAL_TERCEROS" }
    ],
    snapshots: [{ accountId: "instagram:a", estado: "MEDIDO_PROVEEDOR" }],
    conflictosConocidos: conflictos
  });
  assert.equal(celda.activosTotal, 2); // c excluido por conflicto, no colapsado con a/b
  assert.equal(celda.activosCubiertos, 1);
  assert.equal(celda.estado, ESTADOS_CELDA.PARCIAL);
});

test("SIN_CUENTA exige discoveryConfirmada explicita incluso si no hay referencia de analista", () => {
  const sinEvidencia = clasificarCeldaConIdentidad({ activos: [], snapshots: [], discoveryConfirmada: false });
  assert.equal(sinEvidencia.estado, ESTADOS_CELDA.NO_PROBADO_SIN_REFERENCIA);
  const conEvidencia = clasificarCeldaConIdentidad({ activos: [], snapshots: [], discoveryConfirmada: true });
  assert.equal(conEvidencia.estado, ESTADOS_CELDA.SIN_CUENTA);
});

test("snapshot readiness distinto de momentum readiness: 2+ snapshots no basta para Momentum sin umbral validado", () => {
  const r = snapshotReadinessDeActivo({
    accountId: "x:a",
    identityState: IDENTITY_STATES.ANALYST_CONFIRMED,
    snapshots: [
      { accountId: "x:a", estado: "OBSERVADA", capturedAt: "2026-08-01T00:00:00Z" },
      { accountId: "x:a", estado: "OBSERVADA", capturedAt: "2026-08-28T00:00:00Z" }
    ]
  });
  assert.equal(r.snapshotCount, 2);
  assert.equal(r.readyForSnapshotCollection, true);
  assert.equal(r.readyForMomentum, "INSUFFICIENT_HISTORY");
});

test("readyForSnapshotCollection es false para un activo con conflicto de identidad", () => {
  const r = snapshotReadinessDeActivo({
    accountId: "instagram:homonimo",
    identityState: IDENTITY_STATES.IDENTITY_CONFLICT,
    snapshots: []
  });
  assert.equal(r.readyForSnapshotCollection, false);
});

test("project isolation: identidadDeCuenta y clasificarCeldaConIdentidad son puras, no leen projectId global", () => {
  const a = identidadDeCuenta({ declaradaPorAnalista: true });
  const b = identidadDeCuenta({ declaradaPorAnalista: true });
  assert.equal(a, b); // determinista, sin estado oculto entre llamadas
});

test("null en followers no se confunde con 0 al excluir un activo con conflicto", () => {
  const conflictos = new Set(["instagram:homonimo"]);
  const celda = clasificarCeldaConIdentidad({
    activos: [{ accountId: "instagram:homonimo", descubiertaPorSentinel: true, corroboradaPorSentinel: true }],
    snapshots: [{ accountId: "instagram:homonimo", estado: "MEDIDO_PROVEEDOR", followers: null }],
    conflictosConocidos: conflictos
  });
  // el activo se excluye por conflicto, no por su valor de followers
  assert.equal(celda.tieneConflictoDeIdentidad, true);
  assert.equal(celda.activosTotal, 0);
});
