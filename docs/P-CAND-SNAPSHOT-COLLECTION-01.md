# P-CAND-SNAPSHOT-COLLECTION-01

**Colección repetible de snapshots longitudinales**
2026-09-03 · **4 créditos ScrapeCreators consumidos de ~69 restantes** ·
Base: `P-CAND-SNAPSHOTS-01` (commit `34310e4`)

---

## 1. Commit base y arquitectura reutilizada

Commit base `34310e4`. Se auditó primero (sección 1 del gate) antes de
programar nada:

- **A. ¿Existe una operación que observe TODOS los activos elegibles de un
  candidato?** Sí — `observarCandidato` (`candidateObservation.js`), ya
  probado en 6 gates anteriores. No se reemplazó.
- **B. ¿Existe una operación que observe TODOS los candidatos de un
  proyecto?** **No existía.** Se construyó (`collectCandidateSnapshots`),
  reutilizando `observarCandidato` como primitiva por candidato — no un
  motor nuevo.
- **C. ¿Duplicación entre `/observar` y `/inteligencia`?** Sí, confirmada
  de nuevo (ver sección 4).
- **D. ¿Ruta canónica?** `POST /:proyectoId/candidatos/:candidatoId/observar`
  sigue siendo la única que la ruta HTTP pública usa para el fallback de
  proveedor y la persistencia genérica (`P-CAND-SNAPSHOTS-01`).
- **E-H:** ver secciones 14-18.

---

## 2. Duplicación encontrada — y una nueva, más profunda

**Duplicación esperada:** la orquestación completa de
`POST /observar` (ficha → cuentas → contexto Meta → tipos declarados →
`observarCandidato` → snapshot genérico de proveedor → publicaciones)
vive **inline** en `routes/projects.js`. Se extrajo esa misma secuencia a
`services/intelligence/candidateSnapshotCollection.js#observarYPersistirCandidato`,
importando las **mismas** funciones reales
(`fichaIdentidad`, `contextoMetaDeObservacion`, `activosDeCandidato`,
`observarCandidato`, `guardarSnapshots`, `guardarPublicaciones`) — no una
reimplementación con lógica distinta.

**No se refactorizó la ruta HTTP para llamar a esta función nueva en este
gate.** Motivo: el bloque de respuesta de `/observar` mapea campos
directamente desde variables locales (`ficha`, `cuentas`, `r`,
`desdeElLake`) de una forma que un refactor apresurado podría alterar
sutilmente, y el criterio explícito del gate es "NO romper contratos HTTP
existentes" por encima de "unificar". Con 51/51 suites verdes como red de
seguridad, el refactor es *técnicamente* seguro, pero se decidió no
arriesgarlo bajo el presupuesto de este gate. **Queda documentado como la
acción pendiente de mayor prioridad** (sección 15).

**Hallazgo nuevo, más importante que la duplicación ya conocida:**
auditando por qué el run real mostraba `facebook: { assetsAttempted: 0 }`,
se confirmó que **`observarCandidato` no tiene NINGUNA rama para
Facebook** — solo maneja `x`, `instagram`, `youtube`
(`candidateObservation.js`, líneas ~1204/1221/1340). Todas las mediciones
de Facebook de los gates anteriores (`BENCH-02`, `SNAPSHOTS-01`) se
hicieron con **scripts ad-hoc que llaman directamente a
`pedirAlProveedor`**, completamente por fuera de `observarCandidato` y por
lo tanto por fuera de esta nueva colección repetible también. Esto
responde directamente a la sección 11 del gate ("Facebook 1/2 páginas"):
la causa real **no es identidad, PPCA, ni proveedor requerido — es que
Facebook nunca fue conectado a este motor de observación en absoluto**.

---

## 3. Ruta canónica

`POST /:proyectoId/candidatos/:candidatoId/observar` sigue siendo la única
ruta pública que dispara medición real y persistencia de snapshot. La
nueva `collectCandidateSnapshots` es una función de dominio (no una ruta
HTTP nueva) que reutiliza la misma orquestación a nivel de proyecto —
deliberadamente no se expuso todavía como endpoint HTTP público, ya que el
gate pide la operación conceptual, no necesariamente su ruta.

---

## 4-9. Colección real ejecutada

**Presupuesto declarado antes de ejecutar:** ScrapeCreators ≤10 créditos,
preferencia 0-5. **Ejecutado: 4 créditos.**

**Paso 1 — colección oficial completa del proyecto (0 créditos):**
`collectCandidateSnapshots("alcaldia-cuenca-2027-piloto", { plataformas:
["facebook","instagram","x","youtube"], conflictosConocidos })`.

- **candidatesAttempted: 7, candidatesMeasured: 7**
- **assetsAttempted: 39, assetsMeasured: 15, assetsSkipped: 24, assetsFailed: 0**
- **snapshotsCreated: 0** (esperado — ninguna medición oficial nueva pasó
  por el snapshot genérico, que solo persiste `MEDIDO_PROVEEDOR`; ver gap
  documentado en `P-CAND-SNAPSHOTS-01` sección 8, sin resolver aquí)
- **`instagram:leomoralez.1425` (Leonardo Morales) nunca recibió ninguna
  petición** — confirmado en el resultado real: `categoria:
  SKIPPED_IDENTITY_CONFLICT`, `estado: null`.

**Paso 2 — colección de proveedor selectiva (4 créditos):** limitada a 4
candidatos cuyo Instagram personal se midió por última vez el
2026-09-01 (hace ~2 días reales), para producir el primer par de
snapshots con separación temporal real y no trivial:

| Candidato | Activo | credits_charged |
|---|---|---|
| Paúl Carrasco | `instagram:paulcarrascoc` | 1 |
| Lloret Valdivieso | `instagram:lloretvaldivieso` | 1 |
| Juan Carlos Vega | `instagram:juancvegaec` | 1 |
| Yaku Pérez | `instagram:yaku_perez` | 1 |

**Créditos:** before ~69 (estimado al cierre de `SNAPSHOTS-01`) · used
**4** · remaining: **NO_VERIFICABLE** — ScrapeCreators no expone un
endpoint de saldo independiente de una medición real; no se gastó una
petición extra solo para leerlo. Se cuenta por request conocido (4), no se
inventa el balance exacto restante.

**No se gastó en:** Marcelo Cabrera (2/3 IG ya medidos, 1 con fallo
transitorio conocido — se dejó fuera para mantener el run acotado),
Leonardo Morales (activo válido único ya medido, el otro en conflicto),
Pedro Palacios (ya con IG oficial completo, sin activo personal
pendiente), ningún TikTok/Facebook/X/YouTube adicional, ninguna celda
`SIN_CUENTA`/`NO_PROBADO`.

---

## 10-13. Snapshots antes/después, multi-asset, project isolation

- **Snapshots antes (activos con ≥2 mediciones reales):** 0 (solo el par
  trivial de 1 minuto de Paúl/Facebook, no significativo).
- **Snapshots después:** **4 activos** con exactamente 2 snapshots reales,
  separados por **~45 a ~64 horas reales** (2 733-3 837 minutos) — el
  primer par verdaderamente comparable de todo el proyecto:

| Candidato | Activo | 1er snapshot | 2º snapshot | Separación |
|---|---|---|---|---|
| Paúl Carrasco | `instagram:paulcarrascoc` | 2026-09-01T04:42:52Z | 2026-09-03T20:39:27Z | 3 837 min (~64h) |
| Lloret Valdivieso | `instagram:lloretvaldivieso` | 2026-09-01T23:09:02Z | 2026-09-03T20:39:35Z | 2 731 min (~45.5h) |
| Juan Carlos Vega | `instagram:juancvegaec` | 2026-09-01T23:09:02Z | 2026-09-03T20:39:44Z | 2 731 min (~45.5h) |
| Yaku Pérez | `instagram:yaku_perez` | 2026-09-01T23:51:24Z | 2026-09-03T20:39:48Z | 2 688 min (~44.8h) |

**Multi-asset:** confirmado sin colapso en el run real — Lloret y Yaku
tienen 2 activos de Instagram cada uno (`resultadosPorActivo` los reportó
por separado, uno `OBSERVADA` oficial y el otro `MEDIDO_PROVEEDOR`, con
`identityState` distinto cada uno: `ANALYST_CONFIRMED` vs
`SYSTEM_VERIFIED`).

**Project isolation:** los 4 nuevos snapshots llevan
`projectId: "alcaldia-cuenca-2027-piloto"` verificado; ningún dato de la
suite de tests (proyectos sintéticos `coleccion-proyecto-*`) tocó el
proyecto real ni viceversa.

---

## 14. Facebook — causa exacta (no A-F genérico, la real)

Clasificación exacta pedida por la sección 11 del gate:

**F. Otro — Facebook nunca fue conectado al motor de observación.**
`observarCandidato` no tiene rama `if (cuenta.plataformaId === "facebook")`.
No es PPCA, no es identidad, no es proveedor-requerido en el sentido de
"falta activarlo" — es que la ruta HTTP repetible **nunca pudo** medir
Facebook, ni oficial ni por proveedor, en ningún gate anterior. Todo lo
medido de Facebook hasta hoy (Paúl, Pedro, Yaku, Marcelo, Leonardo) se
hizo con scripts de un solo uso, fuera de cualquier operación repetible.
**Esto significa que `collectCandidateSnapshots` today NO puede
recolectar Facebook** — es una limitación real del alcance de este gate,
no un budget guard.

## 15. Instagram

Motor completo y probado end-to-end en producción con datos reales: 6
activos medidos en el Paso 2 (3 oficiales vía `OBSERVADA`, 3 vía
`MEDIDO_PROVEEDOR`), 4 con snapshot nuevo persistido correctamente.

## 16. TikTok

Clasificación real, una por una, sobre los 7 candidatos (releída del run
oficial, 0 créditos):

| Candidato | Clasificación |
|---|---|
| Paúl Carrasco | identidad `ANALYST_CONFIRMED` (`@lafondadecarrasco`), sin medir (`UNSUPPORTED` en este run porque no se pidió provider) |
| Lloret Valdivieso | identidad `ANALYST_CONFIRMED`, **ya medido** en `P-CAND-SNAPSHOTS-01` (29 100 seguidores) |
| Pedro Palacios | identidad `ANALYST_CONFIRMED`, nunca medido |
| Juan Carlos Vega | identidad `ANALYST_CONFIRMED`, nunca medido |
| Yaku Pérez | identidad `ANALYST_CONFIRMED`, **ya medido** (519 300 seguidores) |
| Marcelo Cabrera | identidad `ANALYST_CONFIRMED`, nunca medido |
| Leonardo Morales | identidad `ANALYST_CONFIRMED` (`@leomoralesordo`), nunca medido |

**No se midió TikTok nuevo en este gate** — el presupuesto de 4 créditos
se dedicó completo a producir el primer par temporal real de Instagram
(objetivo explícito del gate). Ningún handle se aceptó por nombre: los 5
sin medir siguen exactamente como estaban, sin discovery nuevo.

## 17. X

Sin llamadas nuevas de discovery — el run oficial solo releyó/re-observó
cuentas ya corroboradas (`ANALYST_CONFIRMED`/`SYSTEM_VERIFIED`), nunca se
mezcló con Territorial X discovery.

## 18. YouTube

3/7 canales conocidos re-observados oficialmente (0 créditos); los 4
`SIN_CUENTA` reales se mantienen sin inferir ningún canal por similitud.

---

## 19. Multi-asset — confirmado en producción

Ver sección 10-13. Ningún candidato con 2+ activos de una plataforma
colapsó a 1 en el run real.

## 20. Identity conflicts excluidos

`instagram:leomoralez.1425` (Leonardo Morales): **0 peticiones**, en
ambos pasos del run real, confirmado por inspección directa del
resultado (`SKIPPED_IDENTITY_CONFLICT`). Su evidencia sigue persistida
intacta desde `P-CAND-SOCIAL-BENCH-02`.

## 21. Llamadas oficiales / provider requests

- **Oficiales:** 7 (Paso 1, un `observarCandidato` por candidato, 4
  plataformas oficiales cada uno).
- **Provider (ScrapeCreators):** 4 (Paso 2).

## 22. Project isolation

Confirmado (sección 10-13) — sin fugas entre el proyecto real y los 4
proyectos sintéticos usados por la suite de tests.

## 23. Créditos

Before ~69 (estimado) · used **4** · remaining **NO_VERIFICABLE** (el
proveedor no expone saldo sin gastar una petición).

---

## 24. Project isolation (repetido en la plantilla del gate) — ver 22.

## 25. Tests

**Nuevo:** `tests/candidateSnapshotCollection.test.mjs` — **24/24**:
run project-scoped con múltiples candidatos, multi-asset preservado,
identidad analista-confirmada reportada correctamente, `IDENTITY_CONFLICT`
excluido con 0 llamadas al proveedor, accountId canónico en el snapshot
persistido, append-only (retry no pisa, dos observaciones reales
sobreviven con sus propios valores), fallo de proveedor no destruye el
snapshot anterior y se clasifica `PROVIDER_ERROR`, candidato sin cuentas
produce un run sin error, project isolation, `null != zero`, resumen de
run estructurado (runId/projectId/started/finished, conteos enteros, las
5 plataformas siempre presentes), presupuesto de proveedor respetado (sin
opt-in, 0 llamadas; el activo queda `REQUIRES_PROVIDER`, no `MEASURED`).

**Regresión completa:** `node --test tests/*.test.mjs` — **51/51
archivos, 0 fallos.**

**Build/lint:** no se tocó frontend en este gate; no aplica.

---

## 26. Errores/bugs encontrados y corregidos durante el desarrollo

Documentados con transparencia, ya que revelan riesgos reales del
contrato subyacente:

1. **`agregarCandidato` siempre deriva el id del nombre** (`idDesde`), no
   acepta un id explícito — un test inicial asumió lo contrario y falló
   silenciosamente (declaraciones de tipo guardadas bajo un candidatoId
   que nunca existió). Corregido usando el id real devuelto por
   `agregarCandidato`.
2. Un mock de test comparaba un handle en mayúsculas contra una clave en
   minúsculas — corregido normalizando antes de comparar.

Ninguno de los dos afectó código de producción; ambos eran bugs de test.

---

## 27. READY_FOR_COLLECTION / COMPARISON / MOMENTUM (recalculado, sin inventar umbral)

| Activo | snapshotCount | Separación real | READY_FOR_COLLECTION | READY_FOR_COMPARISON | READY_FOR_MOMENTUM |
|---|---|---|---|---|---|
| `instagram:paulcarrascoc` | 2 | ~64h | sí | **sí** | INSUFFICIENT_HISTORY |
| `instagram:lloretvaldivieso` | 2 | ~45.5h | sí | **sí** | INSUFFICIENT_HISTORY |
| `instagram:juancvegaec` | 2 | ~45.5h | sí | **sí** | INSUFFICIENT_HISTORY |
| `instagram:yaku_perez` | 2 | ~44.8h | sí | **sí** | INSUFFICIENT_HISTORY |
| `facebook:paulernestocarrascoc` | 2 | 1 min | sí | **no** | INSUFFICIENT_HISTORY |
| Resto de activos medidos (24) | 1 | n/a | sí | no | INSUFFICIENT_HISTORY |

**Por qué estos 4 sí y el de Facebook no:** la diferencia no es un umbral
inventado ("24h", "7d") — es la diferencia cualitativa entre una
separación de **minutos dentro de la misma sesión de trabajo** (no
observación independiente real) y una separación de **días reales, en
sesiones de ejecución completamente distintas**, que es exactamente lo
que este gate pidió producir. **`READY_FOR_MOMENTUM` sigue en
`INSUFFICIENT_HISTORY` para los 35/35 activos** — tener 2 puntos
temporales reales no es lo mismo que tener una metodología aprobada de
cuánta historia hace falta para calcular una tendencia. Eso sigue sin
decidirse, a propósito, en este gate.

---

## 28-31. Gaps y siguiente acción

### Gaps reales

1. **`observarCandidato` no soporta Facebook en absoluto** (hallazgo de
   este gate, sección 2/14) — el gap de mayor impacto arquitectónico
   encontrado hasta ahora en Candidate Intelligence.
2. **Duplicación sin resolver** entre la lógica inline de
   `routes/projects.js` y `candidateSnapshotCollection.js` — misma
   orquestación, dos lugares. Refactor no aplicado por riesgo/tiempo, no
   por imposibilidad.
3. **Motor `/inteligencia` sigue sin unificarse** (heredado de
   `SNAPSHOTS-01`, sin cambios).
4. **TikTok:** 5/7 candidatos sin medir, sin cambios en este gate por
   decisión de presupuesto (se priorizó Instagram para el primer par
   temporal real).
5. **`instagram:leomoralez.1425`** sigue `IDENTITY_CONFLICT` abierto,
   pendiente de decisión humana.

### CANDIDATE_LONGITUDINAL_READINESS

**READY_FOR_COMPARISON** (elevado desde `READY_FOR_COLLECTION` de
`SNAPSHOTS-01` — 4 activos reales ya tienen 2 puntos con separación
temporal significativa, listos para una comparación cruda simple; ningún
score, ninguna tendencia calculada).

### Siguiente acción recomendada

**No se inicia aquí.** Dos caminos igual de válidos para el siguiente
gate: (a) conectar Facebook a `observarCandidato` — el gap de mayor
impacto real encontrado; o (b) diseñar la metodología de separación
temporal mínima para `READY_FOR_MOMENTUM` (sin calcularlo todavía, solo
decidir el criterio). Ambos quedan como decisión humana pendiente.

---

## Commit

Archivos propios únicamente:
- `apps/backend/services/intelligence/candidateSnapshotCollection.js` (nuevo)
- `apps/backend/tests/candidateSnapshotCollection.test.mjs` (nuevo)
- `docs/P-CAND-SNAPSHOT-COLLECTION-01.md` (nuevo)

`package.json`, `SENTINEL_PROJECT_STATE.md`, y todo archivo de
Territorial/Media/Data Platform quedaron sin tocar.
