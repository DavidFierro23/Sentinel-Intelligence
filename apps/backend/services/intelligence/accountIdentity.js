/*
===========================================================
ACCOUNT IDENTITY — P-CAND-SNAPSHOTS-01
===========================================================

Identidad canonica de un activo (candidato x plataforma x cuenta).
Reutiliza `normalizarTexto` (services/textUtils.js), YA usado por
`projectStore.fichaIdentidad` para construir `claveDe`. No se crea
un segundo sistema de IDs: esto es la MISMA regla, expuesta como
funcion reutilizable para cualquier punto que necesite comparar o
persistir un accountId.

Root cause de la inconsistencia detectada en P-CAND-SOCIAL-BENCH-02A:
snapshots antiguos (anteriores a la capa de identidad consolidada)
se escribieron con el `id` tal cual lo tecleo el analista
(`x:JuanCVegaEC`, con mayusculas; `youtube:@yakuperez4230`, con
prefijo `@`). La capa de identidad consolidada normaliza desde su
creacion. El pipeline de observacion actual (`candidateObservation.js`)
usa siempre `cuenta.id` tal cual se lo pasan -nunca inventa un id-,
asi que HOY, con `cuentasReferencia.id` ya normalizado en origen,
una observacion nueva ya produce un accountId canonico. El unico
caso que la normalizacion de texto NO resuelve es un cambio de
NAMESPACE completo (handle vs. channel ID de YouTube) -para eso no
hay regla generica segura, se necesita un alias explicito, revisado
a mano.
*/

import { normalizarTexto } from "../textUtils.js";

/*
  Alias explicitos y documentados para los pocos casos donde
  cambia el NAMESPACE del identificador (no solo su formato), y
  por tanto no hay regla generica de texto que los una. Cada
  entrada se anadio tras revision manual de que ambos IDs senalan
  al MISMO activo real -nunca se infiere automaticamente-.
*/
export const LEGACY_ACCOUNT_ALIASES = {
  // youtube:@paulcarrascocarpio9219 (handle del snapshot original,
  // P-CAND-YOUTUBE-01) === youtube:ucxp6qogn2ksjfcea-izjmdw (channel
  // ID persistido en cuentasReferencia). Mismo canal real de Paul
  // Carrasco Carpio, confirmado en P-CAND-SOCIAL-BENCH-02A.
  "youtube:@paulcarrascocarpio9219": "youtube:ucxp6qogn2ksjfcea-izjmdw"
};

/*
  Construye el accountId canonico a partir de plataforma + handle.
  Determinista, insensible a mayusculas/acentos/espacios (via
  normalizarTexto), y quita un `@` inicial de handle -las dos
  variantes de escritura de un mismo handle no son activos
  distintos-.
*/
export function idCanonicoDesdeHandle({ plataformaId, handle } = {}) {
  if (!plataformaId || !handle) return null;
  const limpio = normalizarTexto(String(handle)).replace(/^@/, "");
  return `${normalizarTexto(String(plataformaId))}:${limpio}`;
}

/*
  Normaliza un accountId YA CONSTRUIDO (`plataforma:identificador`)
  sin conocer el handle original por separado: minuscula, sin
  acentos, sin `@` inmediatamente despues de los dos puntos. Usado
  cuando solo se tiene el accountId crudo (p. ej. releyendo un
  snapshot antiguo).
*/
function normalizarAccountIdCrudo(accountId) {
  const texto = String(accountId || "");
  const idx = texto.indexOf(":");
  if (idx === -1) return normalizarTexto(texto);
  const plataforma = texto.slice(0, idx);
  const resto = texto.slice(idx + 1).replace(/^@/, "");
  return `${normalizarTexto(plataforma)}:${normalizarTexto(resto)}`;
}

/*
  Resuelve la forma CANONICA de un accountId, en este orden:
    1. Alias explicito conocido (cambio de namespace, revisado a mano).
    2. Normalizacion de texto (case/acentos/espacios/prefijo @).
  Nunca reescribe evidencia original -quien llama decide si guarda
  el id crudo o el canonico; esta funcion solo lo calcula-.
*/
export function resolverIdentidadCanonica(accountId) {
  if (!accountId) return accountId;
  const claveAlias = normalizarAccountIdCrudo(accountId);
  for (const [legacy, canonico] of Object.entries(LEGACY_ACCOUNT_ALIASES)) {
    if (normalizarAccountIdCrudo(legacy) === claveAlias) return canonico;
  }
  return normalizarAccountIdCrudo(accountId);
}

/*
  Dos accountId (crudos, de cualquier pipeline) representan el
  MISMO activo real si su forma canonica coincide.
*/
export function mismoActivo(accountIdA, accountIdB) {
  return resolverIdentidadCanonica(accountIdA) === resolverIdentidadCanonica(accountIdB);
}
