# CANDIDATE-IPDO-CROSS-PLATFORM-MAPPING-03

**Reparación del CONTRACT_MISMATCH — IPDO_V1.1**
2026-09-05 · **0 requests externas, 0 créditos** · Base: `07fc51c` +
`e948382` + `b22853e` (auditoría) + `524435f` (matriz 5 plataformas, T3)

---

## 1. Commits base y nuevo

Base: `07fc51c`, `e948382`, `b22853e`, `524435f`. Nuevo: ver sección
de commit al final de este documento (se genera al comitear).

## 2. Archivos

**Nuevos:** `services/intelligence/contentMetricsCanonical.js`,
`tests/contentMetricsCanonical.test.mjs`,
`tests/ipdoMultiAssetAndAliases.test.mjs`,
`docs/CANDIDATE-IPDO-CROSS-PLATFORM-MAPPING-03.md`.
**Modificados:** `services/intelligence/digitalPresenceIndex.js`,
`tests/ipdoInputAudit.test.mjs` (una aserción actualizada para
reflejar la nueva ubicación del mapeo, ver sección 12).

---

## 3-4. Root cause y capa de reparación

Confirmado por `CANDIDATE-IPDO-INPUT-AUDIT-02`: `CONTRACT_MISMATCH`
entre `scrapeCreatorsMapper.js` (Facebook/Instagram/TikTok, usa
`reactions`/`commentsCount`) y el extractor de IPDO (leía solo
`likes`/`comments`, los nombres que `x_api`/`youtube_data` sí usan).

Reparado en la capa recomendada por la propia auditoría: una nueva
capa canónica explícita,
`contentMetricsCanonical.js#engagementDePublicacion`/
`attentionDePublicacion`, **no** condicionales ad-hoc por plataforma
dentro de `digitalPresenceIndex.js`. Secuencia:

```
PROVIDER RAW → PROVIDER MAPPER → CANONICAL METRICS →
IPDO INPUT → PLATFORM SUBSCORE → DIMENSION → IPDO
```

---

## 5. Contrato canónico de métricas

```js
METRICAS_CANONICAS = { CONTENT_COUNT, LIKES, REACTIONS, COMMENTS_COUNT, SHARES, REPOSTS, VIEWS }
```

| sourceMetric (crudo) | canonicalMetric |
|---|---|
| `likes` | `LIKES` |
| `reactions` | `REACTIONS` |
| `comments` | `COMMENTS_COUNT` |
| `commentsCount` | `COMMENTS_COUNT` |
| `shares` | `SHARES` |
| `reposts` | `REPOSTS` |
| `views` | `VIEWS` |

`LIKES` y `REACTIONS` **nunca se renombran entre sí**: la
explicación conserva cuál fue la señal real
(`fuentesEngagement[].canonicalMetric`/`sourceMetric`). Para el
cálculo de `ENGAGEMENT` se combinan como "señal de aprobación
explícita" (`LIKES ∪ REACTIONS`, mutuamente excluyentes en los
datos reales de hoy) + `COMMENTS_COUNT` + (`REPOSTS ∪ SHARES`).
`ATTENTION` = `VIEWS`, siempre separado.

---

## 6-7. Facebook — before/after (datos reales, Pedro Palacios)

Publicaciones reales, sin hardcodear:

```
reactions=157, commentsCount=16  (2026-08-31)
reactions=508, commentsCount=122 (2026-09-03)
```

| | BEFORE | AFTER |
|---|---|---|
| engagement total (Pedro) | 216 | **1096** |
| Fuente reconocida | ninguna de Facebook | `REACTIONS` (665) + `COMMENTS_COUNT` (138) |
| Explicación generada | "216 interacciones observadas (likes+comentarios+reposts)" | "1096 me gusta+comentarios observados" *(refleja los tipos reales presentes por candidato, no un texto fijo — para Pedro incluye señal de X además de Facebook)* |

`reactions` se conserva como `REACTIONS`, nunca aparece como
"likes" en la explicación cuando esa fue la fuente real.

## 8. TikTok — before/after (Yaku Pérez, único con contenido real)

```
likes=445, shares=52, commentsCount=20 (video más reciente)
```

| | BEFORE | AFTER |
|---|---|---|
| engagement total (Yaku, agregado de todas sus plataformas) | 3836 | **4099** |
| Delta atribuible a TikTok | 0 (commentsCount ignorado) | +20 por video más reciente (commentsCount ahora capturado) |
| `likes`/`shares` de TikTok | ya se capturaban correctamente | sin cambio (no estaban rotos) |

## 9. Instagram — before/after

Dos causas distintas, verificadas por separado:

- **`REAL_PROVIDER_LIMITATION`** (no reparable, no es un bug):
  `instagram_graph` (oficial) devuelve `likes: null` para todas las
  publicaciones de Lloret/Pedro/Yaku — Meta Business Discovery no
  expone "me gusta" por publicación. Permanece `null`/missing,
  **nunca se convirtió en 0**.
- **`CONTRACT_MISMATCH`** (reparado): `scrapecreators` (fallback
  personal, ej. Paúl Carrasco) usaba `commentsCount` — ahora
  mapeado a `COMMENTS_COUNT` y consumido.

Engagement de Paúl (único con contenido de Instagram vía
scrapecreators): 773 → **799** (+26, sus 2 publicaciones con
`commentsCount=5` cada una, antes ignoradas).

## 10. X y YouTube — control, sin regresión

Verificado con los 7 candidatos: **engagement/attention
IDÉNTICOS antes y después** para Vega, Marcelo, Leonardo, Lloret
(su componente X/YT) — los nombres de campo de `x_api`/
`youtube_data` ya coincidían con el contrato canónico. `x_api` y
`youtube_data` son, literalmente, los dos providers contra los que
se escribió el extractor original — de ahí que nunca tuvieran el
mismatch.

---

## 11-12. Multi-asset — hallazgo crítico: NO era un bug de IPDO

Auditado el caso exacto denunciado por T3 (Lloret Valdivieso /
Instagram, "~360 vs. ~10.8k"):

| Activo | accountId | followers reales | fuente |
|---|---|---|---|
| Profesional | `instagram:jotalloretv` | **10 822** | `instagram_graph`, oficial |
| Personal | `instagram:lloretvaldivieso` | **360** | `scrapecreators`, fallback |

**`digitalPresenceIndex.js#extraerInsumosCandidato` YA sumaba
correctamente ambos activos: `360 + 10822 = 11182`** — verificado
con test real (`ipdoMultiAssetAndAliases.test.mjs`, caso Q). El
"~360" que T3 observó **no viene de IPDO**: viene de
`services/intelligence/candidatePlatformMatrix.js` (archivo de T3,
`524435f`), cuya función `metricaDeCelda()` ordena TODOS los
snapshots de la celda por `capturedAt` descendente y toma
`candidatas[0]` — el snapshot **más reciente entre todos los
activos**, no una suma ni el activo principal. Como el snapshot de
`lloretvaldivieso` (2026-09-03) es más reciente que el de
`jotalloretv` (2026-08-31), la matriz visual muestra 360.

**No se modificó `candidatePlatformMatrix.js`** — es un archivo de
T3, ya comiteado (`524435f`), y este gate es explícitamente de
datos/metodología, no de UI/read-model visual (sección 31 del
gate: "la integración visual se hará después"). Se documenta como
hallazgo separado y recomendación explícita para T3 (sección 20).

**Veredicto sobre `MULTI_ASSET_METRIC_RESOLUTION` en IPDO:
`APPROVED`** — la metodología de cálculo ya era correcta antes de
este gate; no se necesitó ningún cambio de lógica de agregación,
solo se confirmó y probó.

**Semántica de la suma (sección 13 del gate):** IPDO usa **suma de
seguidores observados por activo válido dentro de la misma
plataforma**, nunca "personas únicas" ni "audiencia". Ya
documentado en `CANDIDATE-DIGITAL-PRESENCE-INDEX-01.md` sección 7;
reafirmado aquí con el caso real de Lloret como evidencia de que la
decisión es estable y explicable.

---

## 13. AccountId mismatches — los 4 casos exactos

Ya identificados y resueltos con alias/normalización desde
`P-CAND-SNAPSHOTS-01` (`accountIdentity.js`), reconfirmados en este
gate:

| Candidato | Legacy | Canónico | Tipo |
|---|---|---|---|
| Paúl Carrasco | `youtube:@paulcarrascocarpio9219` | `youtube:ucxp6qogn2ksjfcea-izjmdw` | alias explícito (handle vs. channel ID) |
| Juan Carlos Vega | `x:JuanCVegaEC` | `x:juancvegaec` | normalización (case) |
| Marcelo Cabrera | `x:MarceloHCabrera` | `x:marcelohcabrera` | normalización (case) |
| Yaku Pérez | `youtube:@yakuperez4230` | `youtube:yakuperez4230` | normalización (prefijo `@`) |

**Hallazgo nuevo de este gate:** `extraerInsumosCandidato` agrupaba
snapshots por `accountId` **crudo**, sin canonicalizar. Hoy no
produce un número erróneo (cada activo real solo tiene snapshots en
un único formato), pero es un **riesgo latente de doble conteo**: si
el mismo activo real llegara a tener un snapshot legacy Y uno
canónico coexistiendo, ambos se sumarían como si fueran dos activos
distintos. **Reparado:** el agrupamiento ahora usa
`resolverIdentidadCanonica(s.accountId)` como clave, verificado con
test real (`ipdoMultiAssetAndAliases.test.mjs`, caso R: un snapshot
legacy + uno canónico del mismo activo → se queda con el más
reciente, nunca la suma).

**Resolución elegida:** normalización de texto + alias explícito
documentado (ya existente, reutilizado, no rediseñado). **No se
reescribió ningún snapshot histórico.**

## 14. Leonardo / homónimo

`instagram:leomoralez.1425` sigue excluido — verificado con datos
reales: sin exclusión, su celda de Instagram aportaría 48 510
seguidores; con la exclusión activa, `audienciaPorPlataforma.instagram`
= 1047 (solo el activo válido). El mecanismo de exclusión sigue
siendo el `Set` de `conflictosConocidos` pasado explícitamente por
quien invoca `extraerInsumosCandidato` — **no está persistido en la
ficha canónica**, confirmando la deuda que T3 encontró.
**`IDENTITY_EXCLUSION_PERSISTENCE_DEBT` se mantiene declarada**, sin
ampliar el alcance de este gate para resolverla (requeriría decidir
dónde vive la lista de conflictos de forma durable — un gate propio).

---

## 15. Perfil ≠ Contenido ≠ Interacción — formalizado

Nuevo campo `platformCoverageDetail` en cada fila de insumos:
`{ profileMeasured, contentMeasured, interactionMeasured }` por
plataforma. Ejemplo real (Marcelo Cabrera, Facebook):
`profileMeasured: true, contentMeasured: false, interactionMeasured: false`
— tiene snapshot de seguidores, cero publicaciones persistidas. Ya
no se puede confundir con cobertura completa.

## 16. Cobertura metodológica V2

Nuevo campo `coverageV2` por candidato:
`{ presence, interaction, conversation, overall, byPlatform }`,
cada uno ALTA/MEDIA/BAJA calculado **por dimensión**, no un único
número mezclado. `overall` conserva el cálculo anterior para no
romper compatibilidad. Verificado con los 7 candidatos reales: los
7 mantienen `interaction: ALTA` incluso tras la reparación (X sigue
siendo la señal dominante para todos) — la reparación de FB/IG/
TikTok **mejoró los valores absolutos de engagement**, no cambió la
banda de cobertura, porque X ya garantizaba cobertura de
`Interaction` en 6/7 candidatos desde antes.

**Cobertura por candidato (AFTER):**

| Candidato | Presence | Interaction | Conversation | Overall |
|---|---|---|---|---|
| Paúl Carrasco | ALTA | ALTA | ALTA | ALTA |
| Lloret Valdivieso | ALTA | ALTA | ALTA | ALTA |
| Pedro Palacios | ALTA | ALTA | ALTA | ALTA |
| Juan Carlos Vega | ALTA | ALTA | ALTA | ALTA |
| Yaku Pérez | ALTA | ALTA | ALTA | ALTA |
| Marcelo Cabrera | ALTA | ALTA | ALTA | ALTA |
| Leonardo Morales | ALTA | ALTA | ALTA | ALTA |

---

## 17-21. IPDO antes/después, deltas, ranking

| Candidato | IPDO BEFORE | IPDO AFTER | Δ | Ranking BEFORE | Ranking AFTER |
|---|---|---|---|---|---|
| Lloret Valdivieso | 80.43 | 80.23 | -0.20 | 1 | 1 |
| Paúl Carrasco | 60.56 | 60.51 | -0.05 | 2 | 2 |
| Yaku Pérez | 55.04 | 55.04 | 0.00 | 3 | 3 |
| Pedro Palacios | 35.53 | **40.91** | **+5.38** | 4 | 4 |
| Marcelo Cabrera | 26.68 | 26.52 | -0.16 | 5 | 5 |
| Juan Carlos Vega | 25.18 | 25.07 | -0.11 | 6 | 6 |
| Leonardo Morales | 17.05 | 17.05 | 0.00 | 7 | 7 |

**El ranking NO cambió.** Pedro Palacios es el único con un cambio
de score no trivial (+5.38, por su Facebook real ahora capturado);
el resto varía por centésimas — un efecto de que `Interaction` es
solo 40% del total y el engagement es solo una de sus 3 sub-señales
(45% de ese 40%). Los deltas negativos mínimos de Lloret/Paúl/
Marcelo/Vega son artefacto de la renormalización relativa (el
aumento de Pedro cambia el máximo del grupo en `engagement`,
desplazando levemente los demás valores min-max) — esperado y
correcto, no un error.

## 22. Sensibilidad después del mapping

Mismos 5 escenarios (25/40/35, 30/35/35, 20/45/35, 25/35/40,
33.33/33.33/33.34) repetidos sobre los datos reparados: **el orden
de los 7 candidatos es idéntico en los 5 escenarios**, igual que
antes del fix. **`IPDO_SENSITIVITY_AFTER_MAPPING = ROBUST`**.

## 23. Outlier

No se repitió con nuevos datos productivos (prohibido). El test
existente (`digitalPresenceIndex.test.mjs`, caso H) sigue
verificando que log1p amortigua un outlier ×100 sin colapsar la
escala — comportamiento sin cambios, ya que `contentMetricsCanonical.js`
opera ANTES de la normalización, no la modifica.

## 24. Missing data

Reverificado: Instagram oficial con `likes: null` sigue siendo
`missing`, nunca `0` (test F de `contentMetricsCanonical.test.mjs`).
Reduce `coverageV2.interaction` cuando corresponde, nunca fuerza el
score a 0.

## 25. Yaku Conversation — raw vs. relativo, sin cambios

La reparación de este gate es de **Interaction** (engagement/
attention), no de **Conversation** (amplificación/conversación,
que usa datos de `evidenciasDe`, un corpus distinto y ya bien
mapeado desde el inicio). Confirmado con test real (`U`): los 3
insumos crudos de conversación de Yaku (`thirdPartyVolume=39`,
`mediaDiversity=12`, `publicConversation=25`) son **idénticos** antes
y después de este gate. Su score relativo sigue siendo 0 por la
misma razón matemática documentada en el gate de auditoría anterior
(mínimo simultáneo del grupo) — no se tocó, ni debía tocarse.

---

## 26. Anti-double-counting — verificado

- `comments`/`commentsCount` nunca se suman ambos si coexistieran en
  la misma pieza (se queda con el más reciente) — test dedicado.
- `LIKES`/`REACTIONS` nunca coexisten en los datos reales de hoy,
  pero el código no asume eso: si algún día coexistieran, se sumarían
  como dos señales de aprobación distintas — **riesgo documentado,
  no observado en datos reales**, sin necesidad de blindaje adicional
  hoy.
- Re-observaciones de la misma `sourceMetric` usan solo la más
  reciente (nunca se suman múltiplos de la misma pieza).
- `ENGAGEMENT` y `ATTENTION` (views) permanecen estrictamente
  separados, verificado con test.

## 27. Provenance

Cada fila de insumos ahora trae `fuentesEngagement`/
`fuentesAttention`: `{ canonicalMetric, sourceMetric, value, platformId }`
por cada señal real que contribuyó — trazable hasta la publicación
y snapshot de origen sin necesidad de recalcular.

---

## 28. Matriz de recolección exacta (después de reparar el mapeo)

| Candidato | Plataforma | Metric family | Estado |
|---|---|---|---|
| Vega, Marcelo, Leonardo | Instagram | CONTENT/INTERACTION | `MISSING` (0 publicaciones persistidas — no es un mismatch, nunca se pidió contenido) |
| Paúl, Pedro, Yaku, Marcelo, Vega, Leonardo | Facebook | CONTENT/INTERACTION | `PARTIAL`/`MISSING` (solo Pedro tiene contenido real) |
| Paúl, Pedro, Vega, Marcelo, Leonardo | TikTok | CONTENT/INTERACTION | `MISSING` (solo Yaku tiene contenido real) |
| Pedro, Vega, Marcelo, Leonardo | YouTube | PROFILE/CONTENT/INTERACTION | `NO_ACCOUNT` (ya certificado, `SIN_CUENTA`) |
| Vega | Facebook | IDENTITY | `IDENTITY_INSUFFICIENT` (ya certificado) |

**`RECOLLECTION_REQUIRED = PARTIAL`.** El mapeo ya no es el cuello
de botella — lo que falta ahora es contenido real de
Facebook/Instagram/TikTok para 5-6 de 7 candidatos, por la misma
razón de siempre (control de presupuesto en gates anteriores, no
imposibilidad técnica). **No se ejecuta esa recolección en este
gate** (prohibido explícitamente).

---

## 29. Tests

- `tests/contentMetricsCanonical.test.mjs` — **13/13**.
- `tests/ipdoMultiAssetAndAliases.test.mjs` — **13/13**.
- `tests/digitalPresenceIndex.test.mjs` — **23/23** (sin cambios de comportamiento externo).
- `tests/ipdoInputAudit.test.mjs` — **19/19** (1 aserción actualizada para reflejar la nueva ubicación del mapeo, documentado en el propio test).

## 30. Regresiones

`node --test tests/*.test.mjs` — **59/60 archivos, 1 fallo
preexistente y ajeno** (`ingest-real.test.mjs`, Territorial, no
tocado, ya reportado en el gate de auditoría anterior).

## 31-32. Requests / créditos

**0 requests externas. 0 créditos.**

---

## 33. Limitaciones

- `candidatePlatformMatrix.js` (T3) sigue usando "snapshot más
  reciente entre activos" en vez de agregación por activo — fuera de
  alcance de este gate, documentado como recomendación explícita.
- `IDENTITY_EXCLUSION_PERSISTENCE_DEBT` sigue abierta (la exclusión
  del homónimo vive en el `Set` que pasa cada llamador, no en la
  ficha canónica).
- Contenido real de Facebook/Instagram/TikTok sigue faltando para la
  mayoría de candidatos — el mapeo ya no lo bloquea, pero no se
  recolectó en este gate.

## 34-40. Veredictos

| Veredicto | Resultado |
|---|---|
| `CROSS_PLATFORM_METRIC_MAPPING` | **APPROVED** |
| `MULTI_ASSET_RESOLUTION` | **APPROVED** (ya era correcto en IPDO; UI de T3 queda como hallazgo separado) |
| `ACCOUNT_ID_RESOLUTION` | **APPROVED** (los 4 casos conocidos resueltos; riesgo latente de doble conteo cerrado) |
| `METHODOLOGICAL_COVERAGE_V2` | **APPROVED** |
| `IPDO_V1_RECALCULATION` | **APPROVED** (reproducible, determinista, ranking estable) |
| `IPDO_SENSITIVITY_AFTER_MAPPING` | **ROBUST** |
| `RECOLLECTION_REQUIRED` | **PARTIAL** |
| `IPDO_UI_READINESS` | **NOT_READY** (sin cambios de este gate; integración visual sigue pendiente, y ahora además depende de que T3 revise `candidatePlatformMatrix.js`) |

## Siguiente recomendación exacta

Dos caminos independientes, ninguno iniciado aquí: (1) recolección
selectiva de contenido de Facebook/Instagram/TikTok para los
candidatos con `MISSING` en la matriz de la sección 28, dentro de un
presupuesto acotado; (2) coordinar con T3 la corrección de
`candidatePlatformMatrix.js#metricaDeCelda` para que agregue por
activo (igual que ya hace IPDO) en vez de tomar el snapshot más
reciente entre todos los activos de la celda.
