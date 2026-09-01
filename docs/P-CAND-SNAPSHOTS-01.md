# P-CAND-SNAPSHOTS-01

**Longitudinal foundation + account ID stability**
2026-09-01 · **2 créditos ScrapeCreators consumidos de ~71 restantes** ·
Base: `P-CAND-SOCIAL-BENCH-02A` (commit `c3a337a`)

---

## 1. accountId — root cause exacto

**Dos pipelines, dos épocas.** `candidateObservation.js` (el motor real de
observación) siempre usa `cuenta.id` **tal cual se lo pasan** — nunca
inventa un id. El problema nunca estuvo en el motor de observación: estuvo
en que, en snapshots antiguos (2026-08-26 a 2026-08-28, anteriores a la
capa de identidad consolidada que normaliza `cuentasReferencia.id` con
`normalizarTexto`), el `cuenta.id` que se le pasaba al motor **no estaba
normalizado todavía** — venía tal cual lo escribió el analista
(`x:JuanCVegaEC`, `youtube:@yakuperez4230`).

**Hoy, `cuentasReferencia.id` ya está normalizado en origen** (verificado:
los 7 candidatos tienen `id` en minúsculas en su ficha actual). Esto
significa que **el pipeline de escritura ya está corregido por
construcción** — una observación nueva, hoy, ya produce un accountId
canónico sin tocar código. El gap real y persistente era de **lectura**:
comparar snapshots antiguos contra la capa de identidad consolidada sin
normalizar produce falsos negativos (exactamente el bug que causó
`NO_PROBADO` falsos en el primer intento de reconciliación de
`P-CAND-SOCIAL-BENCH-02A`).

### Tabla de cuentas afectadas (4 activos reales, releídos, 0 requests)

| candidateId | platform | accountId snapshot (legacy) | accountId identidad consolidada | sameRealAsset | conflict |
|---|---|---|---|---|---|
| juan-carlos-vega | x | `x:JuanCVegaEC` | `x:juancvegaec` | sí (solo case) | no |
| marcelo-cabrera-palacios | x | `x:MarceloHCabrera` | `x:marcelohcabrera` | sí (solo case) | no |
| yaku-perez | youtube | `youtube:@yakuperez4230` | `youtube:yakuperez4230` | sí (solo prefijo `@`) | no |
| paul-carrasco-carpio | youtube | `youtube:@paulcarrascocarpio9219` | `youtube:ucxp6qogn2ksjfcea-izjmdw` | sí (handle vs. channel ID — **cambio de namespace, no de formato**) | no (mismo canal real, confirmado por evidencia cruzada de `P-CAND-SOCIAL-BENCH-02A`) |

**¿Ya creó snapshots duplicados?** No. La clave de escritura en el Lake
(`entidad`) ya incluía `.toLowerCase()` desde `P-CAND-TIKTOK-01` — dos
escrituras con distinto *case* del mismo activo ya generaban la MISMA
entidad (no duplicaban series). El problema nunca fue de duplicación de
series: fue que el campo `accountId` **dentro** de los datos persistidos
conservaba el case original, rompiendo comparaciones exactas contra la
capa de identidad — no la integridad del Lake.

---

## 2. Regla de identidad canónica

Nuevo módulo **`services/intelligence/accountIdentity.js`**, aditivo, cero
arquitectura nueva:

```
idCanonicoDesdeHandle({ plataformaId, handle })
resolverIdentidadCanonica(accountId)
mismoActivo(accountIdA, accountIdB)
LEGACY_ACCOUNT_ALIASES   // 1 entrada, revisada a mano
```

Reutiliza `normalizarTexto` (`services/textUtils.js`) — la MISMA función
que ya usa `fichaIdentidad.claveDe` — no se creó un segundo sistema de
IDs. La forma canónica es `plataforma:handle_normalizado`: determinista,
insensible a mayúsculas/acentos/espacios, quita un `@` inicial, y **no**
usa el nombre del candidato como identificador (sigue siendo
`plataforma:handle`, multi-asset intacto — un candidato con 3 cuentas de
Instagram sigue produciendo 3 IDs distintos).

Para el único caso de cambio de **namespace** (handle vs. channel ID de
YouTube, que ninguna normalización de texto puede resolver), se creó un
registro explícito y documentado (`LEGACY_ACCOUNT_ALIASES`), con
exactamente 1 entrada, decidida por revisión manual de evidencia real —
nunca inferida automáticamente.

---

## 3. Migration safety

**Cero reescritura destructiva.** Los 4 snapshots legacy con `accountId`
sin normalizar **no se tocaron** — siguen en el Lake exactamente como se
escribieron. El fix se aplicó en el único punto de persistencia
(`projectStore.guardarSnapshots`): a partir de este gate, **todo snapshot
nuevo** se normaliza antes de guardarse (`accountId` canónico dentro de
`datos`, y la clave de entidad ya normalizada como antes). Los legacy
quedan documentados (tabla de la sección 1) para que cualquier código que
necesite compararlos use `resolverIdentidadCanonica`/`mismoActivo` en vez
de una comparación exacta de texto.

---

## 4-5. Analyst references e identity conflicts — sin cambios de regla

Verificado de nuevo: ningún snapshot nuevo de este gate redefinió
identidad. Los 2 snapshots reales creados (Yaku/Instagram, Lloret/TikTok)
son mediciones — no tocaron `cuentasReferencia` ni cambiaron
`declaradaPorAnalista`. `instagram:leomoralez.1425` (Leonardo Morales,
homónimo) sigue excluido de la colección: no se le hizo ninguna llamada
en este gate, sigue en `IDENTITY_CONFLICT`, su evidencia sigue persistida
tal cual desde `P-CAND-SOCIAL-BENCH-02`.

---

## 6-7. Snapshot contract — auditado, sin campos inventados

Confirmado sobre los snapshots reales existentes y los 2 nuevos: todo
snapshot de cuenta ya trae `projectId`, `candidateId`, `accountId`,
`platform`, `capturedAt` (observedAt), `provider`, `estado` (measurement
state), `followers` (o la métrica que aplique), `limitations`,
`comparacion`. **No existe un campo `identityState` dentro del snapshot
mismo** — la identidad vive en la capa de `fichaIdentidad`, no en el
snapshot, a propósito: un snapshot describe una MEDICIÓN en un instante;
mezclar el estado de identidad (que puede cambiar por revisión humana
después) dentro del snapshot histórico violaría el principio append-only
(reescribiría el pasado). Esta separación ya es correcta — no se cambió.

**Snapshot ≠ Publication**, confirmado sin ambigüedad en el código: un
account snapshot vive en `snapshot-<candidato>-<plataforma>-<activo>-
<instante>` (`guardarSnapshots`/`snapshotsDe`), una publicación vive en
una clave distinta con `publishedAt` propio (`guardarPublicaciones`/
`publicacionesDe`). Nunca se mezclaron en este gate.

---

## 8. Instagram HTTP persistence — gap real cerrado

**Root cause encontrado (nuevo hallazgo de este gate):** Sentinel tiene
**dos motores de observación separados y desconectados**:

1. `POST /observar` → `candidateObservation.js` (el que todo el trabajo de
   Instagram/Facebook/TikTok fallback de los últimos 6 gates usa). Antes
   de este gate: persistía publicaciones (`guardarPublicaciones`) pero
   **nunca** snapshots de cuenta.
2. `POST /inteligencia` → `accountIntelligence.js#observarCuentasDelCandidato`
   (un motor más antiguo, con su propio presupuesto de peticiones). Este
   **sí** llama `guardarSnapshots` automáticamente — pero nadie de los
   últimos 6 gates lo usó ni lo tocó.

**Fix aplicado — genérico, no hardcodeado a Instagram ni a ningún
candidato:** en `routes/projects.js`, tras `observarCandidato`, cualquier
resultado con `estado === "MEDIDO_PROVEEDOR"` y `canalProveedor` presente
ahora se convierte en un snapshot de cuenta real y se persiste vía
`guardarSnapshots` — mismo contrato que ya usaban los snapshots
manuales de los gates de benchmark, con `accountId` ya canonicalizado. La
respuesta HTTP ahora incluye `snapshotsDeProveedorGuardados` para que
quien llame la ruta sepa exactamente qué se escribió, sin adivinar.

**Verificado con una llamada real de producción** (sección 10): Yaku
Pérez/Instagram personal, vía la ruta HTTP real, generó
`snapshotsDeProveedorGuardados.total: 1` — el snapshot persistió sin
ningún script manual, por primera vez desde que existe este flujo.

**Deliberadamente NO se tocó** el motor #2 (`/inteligencia`) ni se
intentó unificar ambos motores — cambiar cuál motor observa oficialmente
X/YouTube/Meta es un cambio arquitectónico mucho más grande, fuera del
alcance de "estabilizar snapshots del camino ya construido".

---

## 9. Snapshot dedupe

Reutilizada, no reinventada: la clave del Lake
(`snapshot-<candidato>-<plataforma>-<activo_normalizado>-<capturedAt>`)
ya incluía el instante exacto desde `P-CAND-TIKTOK-01`. Dos observaciones
reales en instantes DISTINTOS producen DOS entidades distintas (verificado
en test, bloque B de `snapshotPersistenceHttp.test.mjs`: dos llamadas
reales con ~5ms de diferencia crean 2 snapshots, ninguno pisa al otro). Un
reintento con el MISMO `capturedAt` produciría la MISMA entidad
(sobrescritura idempotente) — comportamiento correcto y ya existente, no
modificado.

---

## 10. Primera colección longitudinal real

**Antes:** 23/35 celdas `READY_FOR_SNAPSHOT_COLLECTION` (las 16 `MEDIDO`
+ 7 `PARCIAL` de `BENCH-02A`).

**Presupuesto declarado:** ScrapeCreators ≤10 créditos, preferencia usar
menos. **Ejecutado: 2 créditos.**

**Paso 1 — refresco oficial (0 créditos):** `POST /observar` con
`plataformas: ["facebook","instagram","x","youtube"]` (sin
`proveedorInstagram`) para los 7 candidatos, usando las APIs oficiales ya
integradas. **Resultado: 0 snapshots nuevos** — confirma explícitamente
que el motor `/observar` no persiste mediciones oficiales (ver sección 8).
Llamada honesta, sin costo, pero sin efecto persistente; reportada tal
cual, no oculta.

**Paso 2 — dos mediciones reales de proveedor, selectivas:**

| Candidato | Activo | Antes | Después | Costo |
|---|---|---|---|---|
| Yaku Pérez | `instagram:yaku_perez` (personal, nunca medido) | `REQUIERE_PROVEEDOR` | `MEDIDO_PROVEEDOR`, 682 seguidores | 1 crédito |
| Lloret Valdivieso | `tiktok:jotalloretv` (identidad confirmada, sin métrica) | `REQUIERE_PROVEEDOR` | `MEDIDO_PROVEEDOR`, 29 100 seguidores, 507 100 likes | 1 crédito |

**Créditos:** before ~71 (estimado al cierre de `BENCH-02`) · used **2** ·
remaining ~69 (no se pidió balance exacto al proveedor para no gastar una
petición extra solo para leerlo; el proveedor no expone un endpoint de
balance separado de una petición de medición real).

**No se gastó en:** `SIN_CUENTA` (4 celdas), `NO_PROBADO` (6), `NO_PROBADO_SIN_REFERENCIA` (1), ni en `instagram:leomoralez.1425` (conflicto).

---

## 11-18. Resultado por plataforma

- **Facebook:** sin cambios de medición en este gate (0 créditos
  gastados aquí a propósito, para mantener el presupuesto). Las celdas
  `PARCIAL` (1/2 páginas medidas) se mantienen como tal — estado real,
  no bloqueado.
- **Instagram:** Yaku Pérez pasó de `PARCIAL` a `MEDIDO` (2/2 activos).
  El resto sin cambios.
- **TikTok:** Lloret Valdivieso pasó de `REQUIERE_PROVEEDOR` a `MEDIDO`
  — la única celda de ese estado en todo el proyecto queda resuelta. El
  resto de TikTok (6 candidatos) sigue `NO_PROBADO`, intacto, sin forzar
  discovery nuevo (fuera de alcance de este gate).
- **X:** sin llamadas nuevas — ya estaba en 6/7 `MEDIDO` desde antes; no
  se mezcló con discovery Territorial de X en ningún momento.
- **YouTube:** sin llamadas nuevas — 3/7 `MEDIDO`, 4/7 `SIN_CUENTA`
  reales (discovery ya cerrado en un gate anterior). No se infirió ningún
  canal por similitud.

---

## 19-21. Snapshot counts, publicaciones y comentarios

**Tabla completa** (candidato × plataforma × activo, solo activos con
medición real) generada por relectura directa del Lake — 28 filas, todas
con `snapshotCount = 1` **excepto** `paul-carrasco-carpio/facebook`
(`snapshotCount = 2`, separación de **1 minuto**, ya existente desde
`BENCH-02`, ambos snapshots del mismo día).

**READY_FOR_TEMPORAL_COMPARISON:** 0 celdas — ninguna tiene 2+ snapshots
con separación temporal significativa (la única con 2 snapshots está
separada por 1 minuto, no por un período comparable).

**READY_FOR_MOMENTUM:** 0/35, `INSUFFICIENT_HISTORY` en todas — **no se
calculó Momentum, ni se inventó un umbral de días**, tal como exige el
gate.

**Publicaciones:** no se recolectaron publicaciones nuevas en este gate
(los `maximo: 5` de las llamadas oficiales del Paso 1 no persistieron
nada porque no hubo mediciones oficiales nuevas que generar publicaciones
propias; las 2 llamadas de proveedor del Paso 2 fueron solo perfil, sin
pedir posts, para mantener el presupuesto mínimo).

**Comentarios:** no se tocó ningún corpus de comentarios en este gate.
Los existentes (Pedro Palacios FB 10/122, Yaku Pérez TikTok 20/110) siguen
intactos, sin re-observar.

---

## 22. Project isolation

Verificado en dos capas: (a) test automatizado
(`snapshotPersistenceHttp.test.mjs`, bloque C — mismo handle en dos
proyectos distintos, 0 fugas, `projectId` correcto en cada snapshot); (b)
spot-check real sobre `alcaldia-cuenca-2027-piloto` — los 7 snapshots
reales de Yaku Pérez tienen `projectId: "alcaldia-cuenca-2027-piloto"` en
el 100% de los casos. **0 fugas.**

---

## 23. Null ≠ Zero

Verificado en los 2 snapshots reales nuevos: ningún campo de métrica no
disponible se convirtió en `0`. `postsObserved: 0` es un valor real (no se
pidieron publicaciones, cero es el conteo correcto de lo que se pidió),
no un placeholder de ausencia.

---

## 24. Snapshot status matrix (extracto — activos con cambio en este gate)

| Candidate | Platform | Asset | Identity | Measurement | SnapshotCount | First | Latest | TemporalSep | ReadyCollection | ReadyComparison | ReadyMomentum | Limitation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Yaku Pérez | Instagram | `yaku_perez` | ANALYST_CONFIRMED | MEDIDO_PROVEEDOR | 1 | 2026-09-01T23:51:24Z | = | 0 | sí | no | no | INSUFFICIENT_HISTORY |
| Lloret Valdivieso | TikTok | `jotalloretv` | ANALYST_CONFIRMED | MEDIDO_PROVEEDOR | 1 | 2026-09-01T23:52:15Z | = | 0 | sí | no | no | INSUFFICIENT_HISTORY |
| Leonardo Morales | Instagram | `leomoralez.1425` | IDENTITY_CONFLICT | excluido | 1 (evidencia preservada) | 2026-09-01T23:09:02Z | = | 0 | **no** | no | no | homónimo, excluido de longitudinal |

(Tabla completa de 28 filas en `24-snapshot-counts.json`, generada por
script de este gate — disponible bajo pedido, no incluida entera aquí por
extensión.)

---

## 25. Tests

**Nuevos:**
- `tests/accountIdentity.test.mjs` — 9/9: ID canónico estable y
  determinista, mismo activo entre pipelines = misma identidad, activos
  distintos se mantienen distintos, normalización de URL/handle/case/
  acentos, alias legacy documentado y resuelto, accountId no-alias se
  normaliza por texto sin inventar alias, entradas vacías no revientan.
- `tests/snapshotPersistenceHttp.test.mjs` — 10/10: persistencia real via
  HTTP (`snapshotsDeProveedorGuardados`), accountId canónico en el
  snapshot persistido, followers real (no null-a-cero), provider
  correcto, dedupe entre observaciones reales distintas (no colapsa, no
  explota), project isolation completo (mismo handle en 2 proyectos, 0
  fugas).

**Regresión completa:** `node --test tests/*.test.mjs` — **50/50
archivos, 0 fallos** (incluye los 14+14 tests de identidad de
`BENCH-02A` sin ningún cambio de comportamiento).

---

## 26-29. Requests, créditos y costo

- **Requests externas:** 9 HTTP reales al servidor propio (7 refresco
  oficial + 2 provider) + 1 llamada directa de servicio (TikTok, sin ruta
  HTTP wired).
- **Official requests:** 7 (0 créditos, cuota propia de Meta/X/YouTube,
  sin medición nueva persistida — ver sección 8).
- **Provider requests:** 2 (ScrapeCreators).
- **Credits before/used/remaining:** ~71 / **2** / ~69.
- **Costo total:** 2 créditos ScrapeCreators. Ningún costo de Meta/X/
  YouTube más allá de su cuota gratuita habitual.

---

## 30. Project isolation, 31-32. Gaps, 33. Readiness

**CANDIDATE_LONGITUDINAL_READINESS = READY_FOR_COLLECTION.**

No se eleva a `READY_FOR_COMPARISON` ni `READY_FOR_MOMENTUM`: 0 celdas
tienen separación temporal significativa todavía. El mecanismo de
colección (identidad canónica + persistencia genérica de proveedor) está
ahora probado en producción con 2 mediciones reales; lo que falta es
tiempo real transcurrido entre observaciones, no más código.

### Gaps reales restantes

1. **Motor `/inteligencia` sigue sin unificarse** con `/observar` — dos
   pipelines de observación coexisten, uno persiste snapshots oficiales
   automáticamente, el otro no. No resuelto aquí (cambio arquitectónico
   mayor).
2. **Facebook** sigue con solo 1/2 páginas medidas en 5 de 7 candidatos.
3. **TikTok** sigue con 6/7 candidatos sin medir (solo Yaku y ahora Lloret
   tienen métrica real).
4. **`instagram:leomoralez.1425`** sigue como `IDENTITY_CONFLICT` abierto,
   pendiente de decisión final de un analista humano.
5. **0 celdas con historia temporal real** — el siguiente punto de
   observación útil requiere que pase tiempo real (días), no más
   ejecución de este gate.

---

## Siguiente gate recomendado

**No se inicia aquí.** Cuando exista separación temporal real (ejecutar
una segunda ronda de observación días después de esta), el siguiente
gate natural es evaluar `READY_FOR_COMPARISON` sobre las celdas que ya
tienen ≥2 snapshots reales separados por tiempo significativo — todavía
NO Momentum, solo comparación cruda de 2 puntos.
