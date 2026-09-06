# CANDIDATE-LONGITUDINAL-FOUNDATION-01

**Auditoría de histórico real + fundación de observación diaria automática**
2026-09-05/06 · Base: `b2f2900` y los commits de este gate

---

## 1. Qué se auditó y qué se encontró (Fase A)

Antes de este gate, Sentinel **NO tenía ningún mecanismo de
ejecución continua** para Candidate Intelligence:

- `grep -rn "setInterval"` en todo `apps/backend` (excluyendo
  `node_modules`/tests): **cero resultados**, en cualquier dominio.
- El único archivo con la palabra "scheduler"
  (`services/ingest/collectorScheduler.js`) es un **contrato
  declarativo** de Territorial (T2): "Define QUÉ se recogería,
  CADA CUÁNTO y CON QUÉ PRESUPUESTO. No arranca nada." Su único
  importador es `routes/territorio.js`.

Toda la historia real que existía (7 candidatos, `alcaldia-cuenca-2027-piloto`)
venía de ejecuciones manuales de gates anteriores, agrupadas en
5 fechas: 26, 28, 31 de agosto y 1, 3 de septiembre de 2026 — nunca
un patrón diario.

### Verificación de append-only (real, con evidencia)

`guardarSnapshots` construye la clave de entidad como
`snapshot-<candidatoId>-<platform>-<claveActivo>-<capturedAt>`
(`projectStore.js:2780`). Como `capturedAt` cambia en cada
observación, cada escritura genera una entidad **distinta**; nunca
se sobreescribe una anterior. Evidencia real: Lloret/Instagram tiene
2 entidades leíbles simultáneamente
(`2026-09-01T23:09:02.343Z` con 360 seguidores,
`2026-09-03T20:39:35.311Z` con 360 seguidores) — mismo valor, pero
dos observaciones reales distintas, ambas conservadas.

**Verdicto: `CANDIDATE_APPEND_ONLY_HISTORY = VERIFIED`.**

### Reconstrucción de deltas reales (los 2 candidatos con más historia)

Yaku Pérez (9 snapshots, 6 activos) y Lloret Valdivieso (8
snapshots, 6 activos) son los de mayor historial real.

| Candidato | Activo | Primera obs. | Última obs. | Delta |
|---|---|---|---|---|
| Yaku Pérez | Instagram (yaku_perez) | 2026-09-01 | 2026-09-03 | 682 → 683 (+1) |
| Yaku Pérez | Facebook (yakuperezgu) | 2026-09-01 | 2026-09-03 | 531.000 → 531.000 (+0) |
| Lloret | Instagram (lloretvaldivieso) | 2026-09-01 | 2026-09-03 | 360 → 360 (+0) |

**Advertencia encontrada durante la auditoría:** el TikTok de ambos
candidatos pasa de `followers: null` (`CUENTA_CONFIRMADA`, identidad
confirmada sin medir) a un número real (`MEDIDO_PROVEEDOR`). Esa
transición **no es una variación de audiencia**: es un cambio de
estado de medición. Reportarla como "+519.300 seguidores" sería un
error de interpretación — se documenta aquí explícitamente para que
ningún consumidor futuro del histórico cometa ese error.

### Auditoría Yaku Pérez — Conversation = 0/100

- **RAW INPUTS:** `thirdPartyVolume=39`, `mediaDiversity=12`, `publicConversation=25` (los tres > 0, ninguno es cero real).
- **PEER DISTRIBUTION** (7 candidatos): `thirdPartyVolume` va de 39 (Yaku) a 90 (Lloret); `mediaDiversity` de 12 (Yaku) a 23 (Lloret); `publicConversation` de 25 (Yaku) a 70 (Lloret).
- **MIN/MAX:** Yaku es el **mínimo del grupo en las 3 señales crudas simultáneamente**, por eso la normalización relativa (min-max) lo coloca en 0 exacto en la dimensión combinada.
- **Clasificación final: `RELATIVE_MINIMUM`** (no `TRUE_ZERO`, no `COVERAGE_GAP`, no `BUG`). Se revisaron las 3 dimensiones × 7 candidatos: Yaku/Conversation es el **único** caso de dimensión=0 con señal cruda > 0 en todo el universo.

## 2. Qué se implementó (Fase B): fundación de observación diaria

`apps/backend/services/intelligence/candidateObservationScheduler.js` (nuevo).

### Enrollment dinámico

Cada corrida vuelve a leer `contenidoDeProyecto(projectId)` — nunca
hay un `candidateId` fijo en el código. `resolverCandidatosActivos`
filtra por `candidato.activo !== false` (hoy ningún candidato tiene
ese campo, así que todos cuentan; forward-compatible con una futura
desactivación sin tocar este archivo). Probado con un candidato
agregado *después* de la primera corrida (test B3,
`candidateObservationScheduler.test.mjs`): entra solo a la siguiente
corrida.

### Multi-proyecto dinámico

`iniciarSchedulerGlobal()` llama `listarProyectos()` (proyectos
`ACTIVO`) cada 15 minutos y arranca un scheduler por proyecto que
todavía no lo tenga. Ningún `projectId` está hardcodeado; hoy solo
existe `alcaldia-cuenca-2027-piloto`, pero un proyecto nuevo entra
solo, sin reiniciar el backend.

### Idempotencia diaria

`fechaLocalObservacion(ahora, timezone)` calcula la fecha local en
`America/Guayaquil` con `Intl.DateTimeFormat` — el timestamp
interno (`startedAt`, `capturedAt`, etc.) siempre se guarda en UTC.
Antes de ejecutar una corrida `NORMAL_DAILY_RUN`,
`yaSeColectoHoy(projectId, fecha)` revisa `collectionRunsDe` — si ya
existe una corrida `SUCCESS`/`PARTIAL` para esa fecha, la nueva
corrida devuelve `SKIPPED_ALREADY_COLLECTED` sin tocar ningún
proveedor ni hacer ninguna llamada externa (test E2, verificado con
contador de llamadas real). `forzar: true` (o
`triggerType: FORCED_MANUAL_RUN`) sí ejecuta aunque ya se haya
colectado hoy — es la vía para un disparo manual explícito.

### Presupuesto real (no solo declarado)

`aplicarPresupuesto()` estima activos por candidato **antes** de
llamar al proveedor y, si la suma supera `maxRequestsPerRun`, excluye
candidatos completos (nunca a mitad de camino) de la corrida —quedan
en `candidatesExcludedByBudget`, el run pasa a `PARTIAL`, y se
declara la limitación `BUDGET_EXHAUSTED` en texto explícito. Las
corridas `NORMAL_DAILY_RUN` **nunca** activan
`proveedorInstagram`/`proveedorFacebook` (0 créditos garantizados
por diseño, no por buena suerte); solo una `FORCED_MANUAL_RUN` con
`maxProviderCreditsPerRun > 0` puede activarlos.

### Persistencia (nuevo en `projectStore.js`)

Tres series append-only nuevas, mismo patrón que
`guardarSnapshots`/`snapshotsDe`:

- `guardarCollectionRun`/`collectionRunsDe` (`collectionrun-<id>`) — auditoría completa de cada corrida.
- `guardarObservacionIPDO`/`observacionesIPDOde` (`ipdoobs-<candidatoId>-<observedAt>`) — un punto histórico de IPDO por candidato y corrida.
- `guardarRankingSnapshot`/`rankingSnapshotsDe` (`rankingsnap-<collectionRunId>`) — el ranking completo de ese corte, con `universeCandidateIds`/`universeSize` explícitos para que un cambio de universo (7→8 candidatos, probado en test H) se detecte como `UNIVERSE_CHANGED` en vez de compararse ingenuamente.

### Observability / operación

Nuevos endpoints en `routes/projects.js` (solo lectura + un disparo
manual explícito; el scheduler real vive en `server.js`):

```
GET  /api/proyectos/:proyectoId/scheduler/estado
GET  /api/proyectos/scheduler/estado
GET  /api/proyectos/:proyectoId/scheduler/corridas
GET  /api/proyectos/:proyectoId/scheduler/ranking-historico
GET  /api/proyectos/:proyectoId/candidatos/:candidatoId/ipdo-historico
POST /api/proyectos/:proyectoId/scheduler/forzar-corrida
```

`server.js` arranca `iniciarSchedulerGlobal()` al levantar el
backend, deshabilitable con `CANDIDATE_SCHEDULER_ENABLED=false`
(ningún test existente levanta `server.js` directamente, así que
esto no afecta ninguna suite).

## 3. Primera corrida real controlada (línea base)

Ejecutada una sola vez, `alcaldia-cuenca-2027-piloto`,
`NORMAL_DAILY_RUN`, presupuesto declarado antes de ejecutar
(`maxRequestsPerRun=500`, proveedor de pago deshabilitado):

```
collectionRunId: run-alcaldia-cuenca-2027-piloto-2026-09-05-1788658242887
startedAt:       2026-09-06T01:30:42.887Z   <- LONGITUDINAL_BASELINE_START
completedAt:     2026-09-06T01:30:56.813Z
status:          SUCCESS
candidatesObserved: 7 / 7
assetsObserved:  16 / 50   (X: 9/9, YouTube: 3/3, Instagram: 3/12, Facebook: 1/11, TikTok: 0/7 — sin vía oficial)
requestsUsed:    50
creditsUsed:     0
```

Verificado que sobrevive fuera de memoria: releído en un **proceso
Node completamente nuevo**, sin ningún estado compartido, con el
mismo `collectionRunId`, el mismo `rankingSnapshot`
(`universeSize: 7`, líder Lloret Valdivieso 80,15) y la misma
observación IPDO de Yaku Pérez (score 64,24).

`LONGITUDINAL_BASELINE_START = 2026-09-06T01:30:42.887Z`. Ninguna
observación anterior a esta fecha se declara comparable con las
futuras — son historia manual de gates previos, no una serie
automática.

## 4. Informe: correcciones de la revisión humana

- **100% español en el cuerpo ejecutivo**: "Presence"/"Interaction"/"Conversation" y códigos internos (`MEDIDO_PROVEEDOR`, `IDENTIDAD_INSUFICIENTE`, etc.) ya no aparecen fuera del **Apéndice técnico** (sección 9, única sección que los muestra).
- **Nombre completo del IPDO** la primera vez que aparece: "Índice de Presencia Digital Observable (IPDO)".
- **Coma decimal, nunca `%`**: `80,2 / 100`.
- **Período real**: "Generado el" (instante de ejecución) separado de "Datos observados" (ventana real, min-max de `capturedAt`); ambos en hora `America/Guayaquil`, almacenados internamente en UTC.
- **Fotos**: solo de `ficha.foto` ya persistida (nunca se resuelve una foto nueva desde el informe); si falta, placeholder Sentinel real (`services/avatarService.js`, SVG local con iniciales, cero red) — probado con un candidato sintético sin ninguna cuenta.
- **Logo Sentinel real**: `apps/web/public/branding/owl-320.png` (activo de marca ya existente, el mismo owl del resto del producto), incrustado en base64 en el HTML — informe autónomo, abrible sin conexión.
- **Yaku Conversation=0**: caveat visible con las 3 cifras crudas reales, antes de que pueda malinterpretarse.

## 5. Cómo operar el scheduler (comandos reales)

```bash
# Arrancar el backend con el scheduler activo (por defecto)
node apps/backend/server.js

# Deshabilitar el scheduler explícitamente
CANDIDATE_SCHEDULER_ENABLED=false node apps/backend/server.js

# Ver estado del scheduler de un proyecto
curl http://localhost:3001/api/proyectos/alcaldia-cuenca-2027-piloto/scheduler/estado

# Ver historial completo de corridas (auditoría)
curl http://localhost:3001/api/proyectos/alcaldia-cuenca-2027-piloto/scheduler/corridas

# Forzar una corrida manual ahora mismo (FORCED_MANUAL_RUN)
curl -X POST http://localhost:3001/api/proyectos/alcaldia-cuenca-2027-piloto/scheduler/forzar-corrida

# Regenerar el informe (siempre cero red, lee solo lo ya persistido)
node apps/backend/scripts/generateCandidateReport.mjs alcaldia-cuenca-2027-piloto
```

## 6. Tests

- `tests/candidateObservationScheduler.test.mjs` — **23/23** (enrollment dinámico, multi-asset, dos días con reloj inyectado, restart idempotente cero-red, fallo parcial, presupuesto agotado, cambio de universo 7→8, project isolation).
- `tests/candidateReportQuality.test.mjs` — **32/32** (período, zona horaria, nombre IPDO, español ejecutivo, sin códigos técnicos en el cuerpo, coma decimal, fotos, Yaku, logo, print CSS, disclaimers, isolation, sin secretos).
- `tests/candidateReportPhotoPlaceholder.test.mjs` — **4/4** (placeholder Sentinel real, cero red).
- Regresión completa: **83/83 archivos de test propios de este cambio pasan**; el único fallo preexistente y ajeno sigue siendo `tests/ingest-real.test.mjs` (Territorial, no tocado, documentado desde el gate anterior).

## 7. Lo que este gate NO hace (deliberado)

- No implementa Momentum ni Change Attribution: solo preserva los insumos crudos (`rankingSnapshotsDe`, `observacionesIPDOde`) para que un gate futuro los calcule cuando exista suficiente historia real.
- No agrega TikTok a la observación automática (sin rama oficial en `observarCandidato`, deuda ya documentada).
- No toca Territorial, Media, ni `SENTINEL_PROJECT_STATE.md`.
- La dependencia de runtime local se declara explícitamente en el reporte final: el scheduler solo genera observaciones nuevas si el proceso de Node sigue corriendo.
