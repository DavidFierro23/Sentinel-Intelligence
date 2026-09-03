import assert from "node:assert/strict";
import { test } from "node:test";
import { cerrarCelda, ESTADOS_CIERRE } from "../services/intelligence/operationalClosure.js";
import { ESTADOS_CELDA, IDENTITY_STATES } from "../services/intelligence/socialBenchmarkMatrix.js";

/* P-CAND-OPERATIONAL-CLOSURE-01. Cero red. */

test("W) NO_PROBADO en TikTok con identidad fuerte cierra REQUIERE_PROVEEDOR, no queda ambiguo", () => {
  const r = cerrarCelda({
    plataforma: "tiktok",
    celda: { estado: ESTADOS_CELDA.NO_PROBADO, activosTotal: 1, activosCubiertos: 0 },
    identidadDominante: IDENTITY_STATES.ANALYST_CONFIRMED
  });
  assert.equal(r.estadoCierre, ESTADOS_CIERRE.REQUIERE_PROVEEDOR);
});

test("W) NO_PROBADO en X (sin proveedor capaz) cierra NO_SOPORTADO, nunca queda sin resolver", () => {
  const r = cerrarCelda({
    plataforma: "x",
    celda: { estado: ESTADOS_CELDA.NO_PROBADO, activosTotal: 1, activosCubiertos: 0 },
    identidadDominante: IDENTITY_STATES.ANALYST_CONFIRMED
  });
  assert.equal(r.estadoCierre, ESTADOS_CIERRE.NO_SOPORTADO);
});

test("W) identidad DISCOVERED nunca cierra REQUIERE_PROVEEDOR: cierra IDENTIDAD_INSUFICIENTE", () => {
  const r = cerrarCelda({
    plataforma: "instagram",
    celda: { estado: ESTADOS_CELDA.NO_PROBADO, activosTotal: 1, activosCubiertos: 0 },
    identidadDominante: IDENTITY_STATES.DISCOVERED
  });
  assert.equal(r.estadoCierre, ESTADOS_CIERRE.IDENTIDAD_INSUFICIENTE);
});

test("W) IDENTITY_CONFLICT siempre gana sobre cualquier otro estado de celda", () => {
  const r = cerrarCelda({
    plataforma: "instagram",
    celda: { estado: ESTADOS_CELDA.MEDIDO, activosTotal: 1, activosCubiertos: 1 },
    identidadDominante: IDENTITY_STATES.IDENTITY_CONFLICT
  });
  assert.equal(r.estadoCierre, ESTADOS_CIERRE.IDENTITY_CONFLICT);
});

test("W) NO_PROBADO_SIN_REFERENCIA cierra IDENTIDAD_INSUFICIENTE, nunca SIN_CUENTA fabricado", () => {
  const r = cerrarCelda({
    plataforma: "facebook",
    celda: { estado: ESTADOS_CELDA.NO_PROBADO_SIN_REFERENCIA, activosTotal: 0, activosCubiertos: 0 },
    identidadDominante: IDENTITY_STATES.NO_ASSET_CONFIRMED
  });
  assert.equal(r.estadoCierre, ESTADOS_CIERRE.IDENTIDAD_INSUFICIENTE);
});

test("W) MEDIDO/PARCIAL/SIN_CUENTA/REQUIERE_PROVEEDOR pasan intactos, no se reescriben", () => {
  for (const estado of [ESTADOS_CELDA.MEDIDO, ESTADOS_CELDA.PARCIAL, ESTADOS_CELDA.SIN_CUENTA, ESTADOS_CELDA.REQUIERE_PROVEEDOR]) {
    const r = cerrarCelda({
      plataforma: "x",
      celda: { estado, activosTotal: 1, activosCubiertos: 1 },
      identidadDominante: IDENTITY_STATES.ANALYST_CONFIRMED
    });
    assert.equal(r.estadoCierre, estado);
  }
});
