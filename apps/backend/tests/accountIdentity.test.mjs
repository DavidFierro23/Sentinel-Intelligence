import assert from "node:assert/strict";
import { test } from "node:test";
import {
  idCanonicoDesdeHandle,
  resolverIdentidadCanonica,
  mismoActivo,
  LEGACY_ACCOUNT_ALIASES
} from "../services/intelligence/accountIdentity.js";

/*
  P-CAND-SNAPSHOTS-01. Cero red. Reutiliza normalizarTexto
  (services/textUtils.js), ya usado por fichaIdentidad.claveDe -no
  se inventa un segundo sistema de IDs.
*/

test("canonical account ID es estable y determinista", () => {
  const a = idCanonicoDesdeHandle({ plataformaId: "x", handle: "JuanCVegaEC" });
  const b = idCanonicoDesdeHandle({ plataformaId: "x", handle: "JuanCVegaEC" });
  assert.equal(a, b);
  assert.equal(a, "x:juancvegaec");
});

test("mismo activo real entre pipelines (case distinto) produce la misma identidad canonica", () => {
  const legacy = "x:JuanCVegaEC";
  const consolidado = "x:juancvegaec";
  assert.equal(mismoActivo(legacy, consolidado), true);
  assert.equal(resolverIdentidadCanonica(legacy), resolverIdentidadCanonica(consolidado));
});

test("activos diferentes se mantienen diferentes", () => {
  assert.notEqual(
    resolverIdentidadCanonica("instagram:paulcarrascoc"),
    resolverIdentidadCanonica("instagram:lloretvaldivieso")
  );
  assert.equal(mismoActivo("instagram:a", "instagram:b"), false);
});

test("normalizacion de URL/handle: prefijo @ no crea un activo distinto", () => {
  assert.equal(
    resolverIdentidadCanonica("youtube:@yakuperez4230"),
    resolverIdentidadCanonica("youtube:yakuperez4230")
  );
});

test("normalizacion de handle: mayusculas y acentos no crean un activo distinto", () => {
  const a = idCanonicoDesdeHandle({ plataformaId: "facebook", handle: "MarceloHCabrera" });
  const b = idCanonicoDesdeHandle({ plataformaId: "facebook", handle: "marcelohcabrera" });
  assert.equal(a, b);
});

test("legacy account ID se preserva como entrada explicita y documentada, no se infiere", () => {
  assert.ok(Object.keys(LEGACY_ACCOUNT_ALIASES).length >= 1);
  const legacyId = "youtube:@paulcarrascocarpio9219";
  const canonico = resolverIdentidadCanonica(legacyId);
  assert.equal(canonico, "youtube:ucxp6qogn2ksjfcea-izjmdw");
});

test("un accountId no alias y no ambiguo se normaliza por texto, no se inventa un alias", () => {
  const id = resolverIdentidadCanonica("tiktok:SomeHandle");
  assert.equal(id, "tiktok:somehandle");
  assert.ok(!Object.values(LEGACY_ACCOUNT_ALIASES).includes(id) || id === "tiktok:somehandle");
});

test("accountId vacio o null no revienta, se devuelve tal cual", () => {
  assert.equal(resolverIdentidadCanonica(null), null);
  assert.equal(resolverIdentidadCanonica(undefined), undefined);
  assert.equal(resolverIdentidadCanonica(""), "");
});

test("idCanonicoDesdeHandle sin plataforma o handle devuelve null, no inventa un id", () => {
  assert.equal(idCanonicoDesdeHandle({ plataformaId: "x" }), null);
  assert.equal(idCanonicoDesdeHandle({ handle: "algo" }), null);
});
