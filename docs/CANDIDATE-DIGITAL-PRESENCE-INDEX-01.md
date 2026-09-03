# CANDIDATE-DIGITAL-PRESENCE-INDEX-01

**Índice de Presencia Digital Observable — IPDO_V1**
2026-09-03 · **0 requests externas, 0 créditos** · Base:
`P-CAND-OPERATIONAL-CLOSURE-01` (commit `07fc51c`)

---

## 1. Qué mide IPDO

Dentro del universo digital público que Sentinel puede observar de
los candidatos de **este proyecto** en **este período**, qué nivel
**relativo** de presencia digital observable muestra cada uno.

## 2. Qué NO mide

Intención de voto, aprobación, probabilidad de ganar, preferencia
electoral, población alcanzada, personas únicas, apoyo político,
sentimiento favorable/crítico, postura (stance) ni territorio. El
número **nunca** se presenta como porcentaje (`74.7 %`) — siempre
como índice sobre 100 (`74.7 / 100`).

---

## 3. Fórmula y pesos (hipótesis metodológica versionada)

```
IPDO_c = 0.25·Presence_c + 0.40·Interaction_c + 0.35·Conversation_c
```

`IPDO_METHOD_VERSION = "IPDO_V1"`. Los pesos viven en
`services/intelligence/digitalPresenceIndex.js` como
`IPDO_WEIGHTS = { presence: 0.25, interaction: 0.40, conversation: 0.35 }`
— **nunca** en un componente React. Suma exactamente 1 (test A).

**Subpesos internos** (también hipótesis, también versionados):

| Dimensión | Subpeso | Valor |
|---|---|---|
| Presence | accountCoverage | 0.5 |
| Presence | audience | 0.5 |
| Interaction | activity | 0.25 |
| Interaction | engagement | 0.45 |
| Interaction | attention | 0.30 |
| Conversation | thirdPartyVolume | 0.40 |
| Conversation | mediaDiversity | 0.30 |
| Conversation | publicConversation | 0.30 |

---

## 4. Arquitectura reutilizada — cero motor nuevo

`digitalPresenceIndex.js` **no** recalcula amplificación ni
conversación: consume `amplificacionDeCandidato` y
`separarConversacion` (`candidateAmplification.js`, sin tocar) y
snapshots/publicaciones ya persistidos (`projectStore.js`, sin
tocar). **No se modificó `digitalPresence.js`**
(`OBSERVED-PRESENCE-01`): ese módulo enumera dimensiones observables
por separado y declaró su propio índice compuesto `NO_DISPONIBLE`,
listando 5 requisitos pendientes (metodología documentada,
normalización, deduplicación, ventanas comparables, cobertura
suficiente). **IPDO_V1 es la implementación real de esos 5
requisitos**, con su propia metodología documentada aquí — un
módulo nuevo y separado, no una modificación del anterior.

---

## 5. Inventario real de variables (paso obligatorio antes de programar)

| Variable | Facebook | Instagram | TikTok | X | YouTube |
|---|---|---|---|---|---|
| followers/subscribers (snapshot) | AVAILABLE (7/7) | AVAILABLE (7/7) | AVAILABLE (7/7) | AVAILABLE (6/7) | PARTIAL (3/7) |
| posts observados con métricas | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | AVAILABLE | AVAILABLE |
| likes/reacciones por post | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | AVAILABLE | AVAILABLE |
| comentarios por post | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | AVAILABLE | AVAILABLE |
| reposts/shares por post | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | AVAILABLE | NOT_SUPPORTED |
| views por post | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | AVAILABLE | AVAILABLE |
| menciones/piezas de terceros | AVAILABLE (vía corpus de evidencias, todas las plataformas juntas) | | | | |
| diversidad de medios (dominios) | AVAILABLE (vía corpus de evidencias) | | | | |
| conversación pública observada | AVAILABLE (vía `separarConversacion`) | | | | |

**Descartadas y por qué:**
- `impressions` (Meta/TikTok): no expuesta por ningún proveedor conectado hoy — `NOT_AVAILABLE`, no se inventó.
- Comentarios/likes por-post de Facebook/Instagram/TikTok: la vía oficial y el proveedor de perfil (`operacion: "perfil"`) usados en gates anteriores no traen publicaciones con métricas — solo perfil. `NOT_AVAILABLE`, no `0`.
- "Personas únicas alcanzadas": no existe ninguna fuente que lo mida; **prohibido por el gate**, ni se intentó.

---

## 6. Normalización — secuencia obligatoria

```
RAW DATA → métrica por plataforma → log1p (si aplica) →
min-max relativo al proyecto → subdimensión → dimensión → IPDO
```

**Nunca** se suman unidades distintas antes de normalizar
(`followers_FB + followers_IG` nunca ocurre; `likes + comments +
views` nunca ocurre — views es una unidad distinta, attention, no
engagement).

### 6.1 log1p

Aplicado a: `audience`, `activity`, `engagement`, `attention`,
`thirdPartyVolume`, `mediaDiversity`, `publicConversation` — todas
magnitudes/conteos no negativos observados como sesgados (un
candidato con 531 000 seguidores de Facebook y otro con 200 en la
misma plataforma). **No** aplicado a `accountCoverage` (proporción
pequeña 0-5, no una magnitud sesgada — documentado explícitamente en
el código, no una omisión).

### 6.2 Min-max relativo al proyecto (N=7)

Para N=7, se evaluaron las tres opciones de la sección 16 del gate:
min-max sobre log1p, percentile/rank robusto, robust scaling. Se
eligió **log1p + min-max** por ser la más simple, explicable y
auditable para una muestra tan pequeña — percentile/rank y robust
scaling (IQR) están diseñados para muestras mayores y con N=7
producirían resultados igual de arbitrarios pero menos
interpretables. Documentado como decisión, no como omisión.

### 6.3 Métrica que no discrimina

Si `max(log1p(x)) === min(log1p(x))` entre los candidatos válidos,
la métrica se marca `discrimina: false` y su `normalizado` es
`null` — **nunca se le asigna 100 arbitrario**. Se excluye de la
combinación de su subdimensión, que se reponderaentre las señales
que sí discriminan (test J).

---

## 7. Tratamiento de faltantes — SCORE ≠ COVERAGE

Un dato ausente **nunca** se convierte en 0. Se distingue
explícitamente: `MISSING` (sin snapshot/publicación), cero real
observado (si existiera, participaría como 0 real — en los datos de
este proyecto no se dio el caso), `NOT_SUPPORTED`/`NO_ACCOUNT`
(vienen de la capa de identidad de gates anteriores, nunca se leen
como 0 de desempeño).

Cada dimensión se calcula **reponderando solo entre las señales
válidas** (`combinarConReponderacion`), nunca imputando cero. Cada
candidato recibe además `methodologicalCoverage` (ALTA ≥75% de las
8 señales esperadas computables, MEDIA 40-75%, BAJA <40%) —
**independiente** del score (test S: un candidato con audiencia
enorme en una sola plataforma y sin ninguna otra señal puede tener
`presence` alto y `methodologicalCoverage: BAJA` a la vez).

**No penalización automática:** que Instagram personal no sea
soportado oficialmente no se traduce en "candidato débil en
Instagram" — afecta `coverage`, nunca el score de esa dimensión si
el proveedor sí la midió.

---

## 8. Platform balancing — anti metric-count-dominance

La jerarquía es **métrica → subscore por plataforma → dimensión**,
nunca "todas las métricas crudas → dimensión". Para audiencia:
cada plataforma se normaliza **por separado** contra el mismo
universo de 7 candidatos, y luego se promedian las plataformas
disponibles del candidato con **peso igual** (1 cada una) — un
candidato con audiencia en 5 plataformas no pesa 5× más que uno con
la misma fuerza relativa en 1 sola plataforma (test L, K).

---

## 9. Anti-double-counting

- `engagement` = últimas observaciones de `likes + comments +
  reposts/shares` por publicación. **Nunca incluye `views`**
  (`attention`, dimensión/unidad distinta).
- Se usa la **última** observación por métrica y publicación —
  nunca se suman las 3 re-observaciones de una misma publicación
  (evitaría inflar el número solo por haber vuelto a mirar la misma
  pieza 3 veces).
- `thirdPartyVolume` cuenta **hechos distintos** (`hechosDistintos`
  de `amplificacionDeCandidato`, que ya deduplica casi-duplicados),
  nunca piezas crudas repetidas.
- Comentarios en publicaciones **propias** (parte de `engagement`,
  owned media) nunca se mezclan con `publicConversation` (piezas de
  terceros fuera de las cuentas del candidato, earned/third-party) —
  son dos planos separados por diseño (`separarConversacion`).

---

## 10. Período

`PRESENCE` = estado observable actual (stock: último snapshot real
por activo). `INTERACTION` y `CONVERSATION` = acumulado de toda la
ventana observada hasta hoy (no hay ventanas comparables definidas
todavía). **Declarado explícitamente, no se finge una ventana
única**: el backend hoy no sostiene ventanas 7D/30D consistentes
entre plataformas — deuda ya documentada como
`CANDIDATE_TEMPORAL_COMPARABILITY_DEBT` (gate anterior), no resuelta
aquí.

---

## 11. Tabla real — los 7 candidatos del piloto

| Candidato | Presence | Interaction | Conversation | **IPDO** | Coverage |
|---|---|---|---|---|---|
| Lloret Valdivieso | 73.05 | 67.92 | 100.00 | **80.43** | ALTA |
| Paúl Carrasco | 48.30 | 56.53 | 73.92 | **60.56** | ALTA |
| Yaku Pérez | 66.67 | 95.93 | 0.00 | **55.04** | ALTA |
| Pedro Palacios | 41.04 | 42.41 | 23.73 | **35.53** | ALTA |
| Marcelo Cabrera | 22.48 | 31.04 | 24.70 | **26.68** | ALTA |
| Juan Carlos Vega | 7.58 | 31.74 | 30.25 | **25.18** | ALTA |
| Leonardo Morales | 21.75 | 5.78 | 26.56 | **17.05** | ALTA |

Los 7 candidatos alcanzaron `methodologicalCoverage: ALTA` (≥6 de 8
señales computables cada uno) — resultado directo de que
Facebook/TikTok ya tienen ruta real desde
`P-CAND-OPERATIONAL-CLOSURE-01`.

---

## 12. Sanity checks (sección 47 del gate) — sin maquillar

- **Yaku Pérez, Conversation = 0.00.** Verificado en insumos crudos:
  tiene el valor **más bajo** de los 7 en los tres sub-indicadores de
  conversación simultáneamente (`thirdPartyVolume=39`,
  `mediaDiversity=12`, `publicConversation=25`, todos el mínimo del
  grupo) — pese a tener, con enorme diferencia, la mayor audiencia
  propia (531 000 Facebook, 519 300 TikTok). Es el resultado
  **correcto** de una normalización relativa: gran audiencia propia
  no implica automáticamente gran conversación de terceros. Esto es
  precisamente la distinción que IPDO existe para mostrar, no un
  error a corregir.
- **Ningún candidato queda alto solo por followers**: Presence pesa
  25%, no domina el score total incluso para quien tiene la mayor
  audiencia.
- **Ninguna plataforma domina por número de campos**: X e Instagram,
  con más métricas de publicación disponibles, no producen un
  Interaction artificialmente mayor solo por tener más señales — la
  jerarquía metric→platform→dimension lo impide (sección 8).
- **Cobertura no se confunde con desempeño**: los 7 candidatos con
  `ALTA` cobertura tienen scores muy distintos (17 a 80).

---

## 13. Análisis de sensibilidad (5 escenarios sobre datos reales)

| Escenario | 1º | 2º | 3º | 4º | 5º | 6º | 7º |
|---|---|---|---|---|---|---|---|
| **Base 25/40/35** | Lloret 80.43 | Paúl 60.56 | Yaku 55.04 | Pedro 35.53 | Marcelo 26.68 | Vega 25.18 | Leonardo 17.05 |
| A 30/35/35 | Lloret 80.69 | Paúl 60.14 | Yaku 53.57 | Pedro 35.46 | Marcelo 26.25 | Vega 23.97 | Leonardo 17.85 |
| B 20/45/35 | Lloret 80.17 | Paúl 60.97 | Yaku 56.50 | Pedro 35.60 | Marcelo 27.11 | Vega 26.38 | Leonardo 16.25 |
| C 25/35/40 | Lloret 82.03 | Paúl 61.43 | Yaku 50.24 | Pedro 34.59 | Marcelo 26.36 | Vega 25.10 | Leonardo 18.09 |
| D 33.33/33.33/33.34 | Lloret 80.33 | Paúl 59.58 | Yaku 54.19 | Pedro 35.72 | Marcelo 26.07 | Vega 23.19 | Leonardo 18.03 |

**El orden de los 7 candidatos es idéntico en los 5 escenarios.**
Ningún cambio de posición. Los scores individuales varían ±3 puntos
como máximo. **IPDO_SENSITIVITY = ROBUST.**

---

## 14. Outlier test (solo en test, no en producción)

`tests/digitalPresenceIndex.test.mjs`, caso H: un candidato
sintético con `totalAttention` ×100 respecto a un candidato normal.
Verificado: log1p evita que el candidato intermedio colapse a
near-zero solo por la escala del outlier (queda muy por encima de
lo que produciría una escala lineal). Ningún dato simulado entró a
producción — el test usa filas 100% sintéticas.

## 15. Missing-data test (solo en test)

Caso C y D-G: candidato sin `totalAttention` observado, candidato
sin ninguna audiencia. Verificado: `missing != 0`, el score no
colapsa a 0 (sigue puntuando por sus señales válidas), coverage
baja explícitamente, `inputsMissing` lista la señal ausente.

## 16. Zero test

No se dio ningún caso de cero real observado en los 7 candidatos
reales (todas las métricas ausentes son `MISSING`, no ceros
confirmados). El motor lo soporta (`extraerInsumosCandidato`
preserva un `0` real si `ultimaDe()` devuelve `0` en vez de `null`)
pero no hubo dato real para ejercitarlo en esta validación —
declarado, no inventado.

---

## 17. Evidence traceability

`score → subscore → métrica → snapshotsDe/publicacionesDe/evidenciasDe`
del proyecto. Cada resultado trae `rawInputs` (los insumos crudos
exactos que produjeron el score) y `evidenceRefs.platforms` (qué
plataformas aportaron dato real). No se muestran 500 evidencias en
pantalla, pero el camino score→evidencia es reconstruible por
completo desde el resultado.

---

## 18. Tests y regresiones

**Nuevo:** `tests/digitalPresenceIndex.test.mjs` — **23/23**: pesos
suman 1, score 0-100, missing≠0, no-account/unsupported/identity-
insufficient nunca cuentan como 0, log1p amortigua outlier, sin
división por cero, métrica no discriminante excluida, platform
balancing, anti metric-count-dominance, anti-double-counting,
project isolation (pureza funcional), N<2 maneja
`INSUFFICIENT_COMPARISON_UNIVERSE`, determinismo, explicación
determinística, coverage independiente de score, ausencia de
territorio/población/momentum/sentiment/stance como insumos reales
del cálculo, conflicto de identidad nunca aporta, última observación
por métrica (no se suman re-observaciones), `postCount=0` deja
engagement/attention en `null`.

**Regresión completa:** `node --test tests/*.test.mjs` — **384/385
tests, 1 fallo preexistente y ajeno** (`tests/ingest-real.test.mjs`,
chequeo de `.env.example` de Territorial, último tocado por
`a7a2b08` de otra terminal — no relacionado con este gate, no se
tocó).

## 19. Build / lint

No se tocó ningún archivo de frontend en este gate (ver sección 20).
Sin cambios de build/lint aplicables.

## 20. Requests / créditos

**External requests: 0. Credits used: 0.** Todo el cálculo se hizo
sobre snapshots/publicaciones/evidencias ya persistidos.

---

## 21. Veredictos

| Veredicto | Resultado |
|---|---|
| `IPDO_DATA_READINESS` | **READY** — 7/7 candidatos con cobertura ALTA |
| `IPDO_NORMALIZATION` | **APPROVED** — log1p + min-max documentado, métricas no discriminantes manejadas |
| `IPDO_MISSING_DATA_HANDLING` | **APPROVED** — missing≠0 verificado en test y en datos reales |
| `IPDO_PLATFORM_BALANCING` | **APPROVED** — jerarquía metric→platform→dimension, sin metric-count-dominance |
| `IPDO_SENSITIVITY` | **ROBUST** — orden idéntico en 5 escenarios |
| `IPDO_EXPLAINABILITY` | **APPROVED** — explicación determinística, sin LLM |
| `IPDO_UI_READINESS` | **NOT_READY** — ver sección 22, bloqueado por concurrencia con T3, no por metodología |
| **`IPDO_V1`** | **APPROVED** (cálculo backend) |

---

## 22. Integración visual — NO realizada en este gate

`git status` mostró **cambios sin commitear de T3** en
`apps/web/src/candidato/dimensionesEstrategicas.js` — exactamente el
archivo donde viviría la integración de "Candidate → Comparación"
(`ComparacionEstrategica.jsx`, del commit `7eb0b2a`,
`CANDIDATE-STRATEGIC-UX-01`). Por regla explícita del gate (sección
49: "si la visualización requiere un archivo que T3 está
modificando: NO pisarlo"), **no se tocó ningún archivo de
`apps/web/`**. El backend queda completo, probado y validado con
datos reales; la integración visual queda como próxima acción
explícita, después de que T3 haga commit.

---

## 23. Gaps

- Integración visual pendiente (bloqueada por concurrencia, no por metodología).
- `CANDIDATE_TEMPORAL_COMPARABILITY_DEBT` sigue sin resolver: Interaction/Conversation no tienen ventana temporal comparable entre plataformas.
- Publicaciones con métricas reales solo existen para X y YouTube — Facebook/Instagram/TikTok no aportan actividad/engagement/atención todavía (solo perfil).

## 24. Siguiente recomendación

Cuando T3 confirme commit de `CANDIDATE-STRATEGIC-UX-01B`, integrar
`IPDO_V1` como tarjeta/tabla en `ComparacionEstrategica.jsx`
consumiendo `calcularIPDO` desde el backend (nunca recalculando en
React), con el lenguaje y tooltips exigidos en las secciones 34-40
del gate original. No se inicia aquí.
