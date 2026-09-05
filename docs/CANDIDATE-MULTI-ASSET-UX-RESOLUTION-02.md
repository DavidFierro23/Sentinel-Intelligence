# CANDIDATE-MULTI-ASSET-UX-RESOLUTION-02 — Agregación multi-activo

**Fecha:** 2026-09-05
**Base UX:** `524435f` (CANDIDATE-STRATEGIC-UX-01B)
**Base IPDO:** `5de5703` (CANDIDATE-IPDO-CROSS-PLATFORM-MAPPING-03)

`EXTERNAL_REQUESTS = 0` · `CREDITS = 0` · `COST = $0`

---

## 1. Causa raíz

El defecto estaba en **mi propio código** de `candidatePlatformMatrix.js`, no en
IPDO.

```js
// ANTES — metricaDeCelda()
const candidatas = snapshots
  .filter((s) => ids.has(s.accountId))
  .filter((s) => ESTADOS_CON_METRICA.has(s.estado))
  .filter((s) => s.followers != null)
  .sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));

const s = candidatas[0];   // ← el snapshot más reciente de TODA la plataforma
```

Con un solo activo acierta por casualidad. Con dos, devuelve el del activo que se
observó más tarde y **descarta el otro**.

### El caso Lloret, leído del store

```
instagram:jotalloretv        10.822   2026-08-31   instagram_graph
instagram:lloretvaldivieso      360   2026-09-03   scrapecreators   ← ganaba
```

La celda mostraba **360** y ocultaba 10.822. No era una imprecisión: la
plataforma tenía dos activos y la celda solo hablaba de uno.

### Segundo defecto, del mismo origen

`ids.has(s.accountId)` comparaba **ids crudos**. Eso producía las 4 «mediciones
huérfanas» que declaré en el gate anterior — y **todas eran artificiales**:

| Ficha | Snapshot | Por qué no casaba |
|---|---|---|
| `youtube:yakuperez4230` | `youtube:@yakuperez4230` | el `@` |
| `youtube:ucxp6qogn2ksjfcea-izjmdw` | `youtube:@paulcarrascocarpio9219` | alias channelId ↔ handle |
| `x:juancvegaec` | `x:JuanCVegaEC` | mayúsculas |
| `x:marcelohcabrera` | `x:MarceloHCabrera` | mayúsculas |

`accountIdentity.resolverIdentidadCanonica` resolvía las cuatro desde el
principio — incluida la del alias, que ya estaba en `LEGACY_ACCOUNT_ALIASES`.
Esta matriz simplemente **no la llamaba**.

---

## 2. Orden de agregación

| Antes | Ahora |
|---|---|
| plataforma → snapshot más reciente global | plataforma → **cada activo** → su snapshot más reciente → **suma** |

```
1. resolver la clave canónica de cada activo y de cada snapshot
2. por CADA activo, quedarse con su snapshot de medición más reciente
3. DESPUÉS sumar los activos de la misma plataforma y la misma familia métrica
```

Es **el mismo orden que `digitalPresenceIndex.js` ya usaba** para IPDO. No se
inventó una segunda semántica: se copió, con la misma canonicalización antes de
agrupar. El orden viaja en `contrato.ordenDeAgregacion`, así que es auditable
desde la respuesta.

---

## 3. Contrato multi-asset

```
celda: {
  plataforma,
  identidad: { estado, porActivo[], conflictos[], tieneConflicto },
  medicion:  { estado, estadoPrevio, motivo },

  assetCount,
  activosTotal, activosCubiertos,

  activos: [{
    accountId,            // canónico
    accountIdOriginal,    // crudo — la evidencia no se reescribe
    idsOriginales[],      // todas las escrituras del mismo activo
    handle, url,
    identityState,
    metrica: { nombre, valor|null, capturedAt, provider, estado }
  }],

  metrica: {
    nombre, valor, metodo, acumulado,
    activosConMetrica, activosTotal,
    etiqueta,          // «11.182 seguidores acumulados entre 2 activos observados»
    noEs,              // la negación explícita
    observadoDesde, observadoHasta
  },

  snapshots,
  medicionesSinActivo: { total, accountIds[], clavesCanonicas[], … } | null
}
```

`metodo` ∈ `ACTIVO_UNICO` · `SUMA_DE_ACTIVOS`.

---

## 4. Semántica de la etiqueta

La suma **no se puede llamar audiencia, alcance ni personas**: dos cuentas del
mismo candidato comparten seguidores.

- **Etiqueta:** «11.182 seguidores acumulados entre 2 activos observados»
- **En la celda:** el número, y debajo «acumulados · 2 activos»
- **`noEs`:** *«Suma de cuentas distintas del mismo candidato. Los seguidores
  pueden solaparse entre cuentas: NO son personas únicas, ni alcance, ni
  audiencia única.»*

Hay test que comprueba que ningún campo **afirmativo** (`nombre`, `etiqueta`,
`metodo`) usa vocabulario de audiencia, y que en el HTML esos términos solo
aparecen negados.

---

## 5. Trazado de Lloret — leído del store, nada hardcodeado

```
ACTIVOS EN FICHA
  instagram:jotalloretv        canon=instagram:jotalloretv        decl=true  corrob=true
  instagram:lloretvaldivieso   canon=instagram:lloretvaldivieso   decl=false corrob=true

SNAPSHOTS (3)
  2026-08-31T15:53:08.897Z  instagram:jotalloretv        10822  OBSERVADA         instagram_graph
  2026-09-01T23:09:02.343Z  instagram:lloretvaldivieso     360  MEDIDO_PROVEEDOR  scrapecreators
  2026-09-03T20:39:35.311Z  instagram:lloretvaldivieso     360  MEDIDO_PROVEEDOR  scrapecreators

AGREGADO
  10.822 + 360 = 11.182   metodo=SUMA_DE_ACTIVOS   assetCount=2
  observadoDesde 2026-08-31   observadoHasta 2026-09-03
  estado de la celda: MEDIDO
```

El agregado cruza **dos proveedores distintos** (`instagram_graph` y
`scrapecreators`), y cada activo conserva el suyo.

Los tests fijan la **estructura** —dos activos participan, el total es su suma—,
no las cifras: `assert.equal(ig.metrica.valor, suma)` donde `suma` se recalcula
desde `ig.activos`.

---

## 6. ⚠️ La distribución vuelve a alinearse con la certificación

Al resolver los 4 desajustes artificiales, esas celdas pasaron de
`NO_SOPORTADO` a `MEDIDO`:

| Estado | `07fc51c` certificado | Gate 01B | **Ahora** |
|---|---|---|---|
| MEDIDO | 26 | 22 | **26** ✓ |
| PARCIAL | 3 | 3 | **3** ✓ |
| NO_SOPORTADO | 1 | 5 | **1** ✓ |
| SIN_CUENTA | 4 | 0 | 0 |
| IDENTIDAD_INSUFICIENTE | 1 | 5 | 5 |
| **Total** | 35 | 35 | **35** |

**Tres de las cinco categorías reproducen exactamente la certificación.** El
único delta son las 5 celdas que la certificación repartía como 4 `SIN_CUENTA` +
1 `IDENTIDAD_INSUFICIENTE` y que hoy son 5 `IDENTIDAD_INSUFICIENTE` — que es
precisamente la brecha `DISCOVERY_NO_PERSISTIDO` ya declarada: sin evidencia
persistida de que un discovery se ejecutó, una celda sin activos **no puede**
cerrarse como «no tiene cuenta».

Esto responde la pregunta abierta del gate 01B: la distribución certificada
**sí era reproducible**, y lo que faltaba era la canonicalización de `accountId`.

### Las 5 celdas agregadas del piloto

```
Lloret            instagram   11.182 acumulados entre 2 activos
Pedro Palacios    facebook    65.900 acumulados entre 2 activos
Yaku Pérez        instagram   83.916 acumulados entre 2 activos
Marcelo Cabrera   instagram   11.748 acumulados entre 2 activos
Leonardo Morales  instagram   49.557 acumulados entre 2 activos
```

Declaradas en la respuesta como limitación `AGREGACION_MULTI_ACTIVO` (5 celdas).

---

## 7. Reutilización de la capa canónica

`resolverIdentidadCanonica` de `accountIdentity.js` — **la misma** que usan
`digitalPresenceIndex.js` y `projectStore.js`. No se creó una segunda
normalización y no se tocó la existente.

- El id crudo se conserva en `accountIdOriginal` e `idsOriginales`.
- Dos activos que canonicalizan igual se **funden en uno**, conservando ambos
  ids y la señal de identidad más fuerte. Hay test de que no se cuentan dos
  veces.
- Dos activos realmente distintos **siguen distintos** y sí se suman.

---

## 8. Homónimo

`instagram:leomoralez.1425` sigue en la ficha de Leonardo Morales, y
`conflictosConocidos` sigue **sin almacenamiento**: llega vacío en cualquier
ejecución real.

No se inventó ningún set a mano — sería hardcodear y reinterpretar identidad. Dos
tests fijan el estado real: el mecanismo excluye correctamente cuando se le pasa
el conflicto (y conserva la evidencia en `identidad.conflictos`), y hoy nada se
lo pasa.

Declarado en la respuesta como **`IDENTITY_EXCLUSION_PERSISTENCE_DEBT`**.

---

## 9. Un solo activo — sin regresión

| | Comportamiento |
|---|---|
| `metodo` | `ACTIVO_UNICO` |
| `acumulado` | `false` |
| `etiqueta` | «55.855 seguidores» — **sin** «acumulados» |
| `noEs` | `null` |
| `accountId` / `provider` / `capturedAt` | siguen viajando, como antes |

Hay test de render que confirma que una celda de un solo activo **no** dice
«acumulados».

---

## 10. Missing sigue siendo missing

Un activo sin métrica → `valor: null`, y en pantalla `—`. Nunca 0. Un snapshot
`CUENTA_CONFIRMADA` confirma identidad y no mide: no son cero seguidores.

Un activo sin medir **no aporta 0 a la suma**: se excluye del agregado y se
cuenta en `activosConMetrica < activosTotal`, que la celda marca con `·¹`.

---

## 11. Lo que no se tocó

`digitalPresenceIndex.js` · `contentMetricsCanonical.js` · `accountIdentity.js` ·
`socialBenchmarkMatrix.js` · `operationalClosure.js` · `candidateBaseline.js` ·
pesos IPDO · collectors · adapters · `ventanas[].delta` ·
`SENTINEL_PROJECT_STATE.md` · `apps/backend/package.json` · Territorial.

**No se muestra el score IPDO.** `IPDO_UI_READINESS` sigue `NOT_READY`.

---

## 12. Comprobaciones

| | |
|---|---|
| Matriz de plataformas | **40 / 40** (25 antes → 40) |
| Render de Candidate | **106 / 106** sin payload · **113** con el real |
| Render de Media | **53 / 53**, intactas |
| Render del workspace | **60 / 60**, intactas |
| Suite backend completa | **1.331**, 0 fallos |
| Cierre e identidad | operationalClosure 6 · benchmarkMatrix 14 · benchmarkIdentity 14 |
| IPDO de T1 (solo lectura) | contentMetricsCanonical 13 · ipdoMultiAssetAndAliases · ipdoInputAudit, sin fallos |
| Build | limpio |
| Lint | 6 **preexistentes**; 0 nuevos |
| Peticiones externas | **0** · créditos **0** |

Probado por HTTP en una instancia aparte en el puerto **3098**, detenida al
terminar: `HTTP 200`, 58 KB, 88 ms. El backend del usuario no se tocó.

**Aislamiento:** piloto 7 candidatos / 35 celdas; ensayo 0 / 0; sin `projectId`
`ok:false` con motivo.

### Cuatro fixtures actualizados, y por qué

Tres tests fijaban el comportamiento de las «huérfanas» como invariante. **Ese
comportamiento era el defecto**: los dos ids eran el mismo activo. Se
reemplazaron por pruebas más fuertes: que el desajuste artificial desaparece,
que el alias legacy resuelve, que no se duplica el mismo activo, y que un
desajuste **real** —una cuenta observada que nadie atribuyó— sigue declarándose.

---

## 13. Ficheros

**Modificados:** `apps/backend/services/intelligence/candidatePlatformMatrix.js` ·
`apps/backend/tests/candidatePlatformMatrix.test.mjs` ·
`apps/web/src/candidato/MatrizPlataformas.jsx` ·
`apps/web/tests/candidate-ux.check.jsx` · este documento (nuevo).

Sin cambios en rutas: `/matriz-plataformas` ya existía.

---

## 14. Certificación humana

```
http://localhost:5174/?proyecto=alcaldia-cuenca-2027-piloto&modulo=candidatos
```

### ⚠️ Precondición: reiniciar el backend

El proceso de `:3001` (**PID 39420**, arrancado 2026-09-04 16:28) sirve
`contrato: "1.0"` y devuelve **360** para Lloret/Instagram. Corre
`node server.js` **sin watcher**.

```
# detener el PID 39420 y volver a arrancar
npm run dev --workspace apps/backend
```

Comprobación rápida de que el reinicio funcionó:

```
curl -s http://localhost:3001/api/proyectos/alcaldia-cuenca-2027-piloto/matriz-plataformas | grep '"version"'
# debe decir  "version": "1.1"
```

### Qué mirar

En «Presencia por plataforma», la celda **Instagram de Juan Cristóbal Lloret**:

| | Antes | Ahora |
|---|---|---|
| | `360 seguidores` | **`11.182 seguidores`** |
| | — | `acumulados · 2 activos` |

| | Comprobar |
|---|---|
| ☐ | Lloret / Instagram muestra **11.182**, no 360 |
| ☐ | Debajo dice **«acumulados · 2 activos»** |
| ☐ | El tooltip trae el desglose `jotalloretv: 10.822 + lloretvaldivieso: 360` y la negación de personas únicas |
| ☐ | Cinco celdas de Instagram/Facebook dicen «acumulados» (Lloret, Palacios, Yaku, Cabrera, Morales) |
| ☐ | Una celda de un solo activo **no** dice «acumulados» |
| ☐ | Pie: «35 de 35 celdas resueltas» con **26 Medido · 5 Identidad insuficiente · 3 Parcial · 1 Sin vía** |
| ☐ | **Ya no aparece «⚠ medición sin activo»** en ninguna celda |
| ☐ | Paúl Carrasco / YouTube y Yaku / YouTube ahora están **Medido** |
| ☐ | Las cinco plataformas siguen visibles; ninguna `0 seguidores` |
| ☐ | Ningún score IPDO en pantalla |
| ☐ | Momentum «Histórico insuficiente»; ningún `−29.053`; disclaimer electoral; sin «Solidez» |

---

## 15. Limitaciones

1. **`DISCOVERY_NO_PERSISTIDO`** — sin evidencia persistida de discovery por
   plataforma, 5 celdas quedan `IDENTIDAD_INSUFICIENTE` donde la certificación
   tenía 4 `SIN_CUENTA`. Es el único delta con `07fc51c`.
2. **`IDENTITY_EXCLUSION_PERSISTENCE_DEBT`** — `conflictosConocidos` sin almacén;
   el homónimo de Leonardo Morales sigue contando como activo.
3. **`AGREGACION_MULTI_ACTIVO`** — la suma de varias cuentas no son personas
   únicas. Declarada, no resuelta: resolver el solape exigiría datos de audiencia
   que no tenemos.
4. **`CANDIDATE_TEMPORAL_COMPARABILITY_DEBT`** — `ventanas[].delta` sigue
   cruzando cuentas. Fuera de scope; la UI no lo consume.
5. `candidateSnapshotCollection.js` sigue sin consumidor.
6. Las suites nuevas siguen fuera de `npm test` (`package.json` mezclado).

---

## 16. Veredictos

```
MULTI_ASSET_PLATFORM_AGGREGATION      = APPROVED
MATRIX_IPDO_MULTI_ASSET_CONSISTENCY   = APPROVED
ACCOUNT_ID_REUSE                      = APPROVED
CANDIDATE_PLATFORM_UX                 = READY_FOR_HUMAN_CERTIFICATION
IPDO_UI_READINESS                     = NOT_READY
```

`MATRIX_IPDO_MULTI_ASSET_CONSISTENCY` se aprueba porque la matriz usa ahora el
mismo orden de agregación y la misma capa canónica que
`digitalPresenceIndex.js`: por activo primero, suma después, agrupando por clave
canónica. Para Lloret/Instagram ambos caminos dan 11.182.
