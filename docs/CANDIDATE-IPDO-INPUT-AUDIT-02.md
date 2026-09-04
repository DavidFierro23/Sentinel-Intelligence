# CANDIDATE-IPDO-INPUT-AUDIT-02

**Auditoría de insumos cross-plataforma de IPDO_V1**
2026-09-04 · **0 requests externas, 0 créditos** · Base: `07fc51c`
(operational closure) + `e948382` (IPDO_V1)

---

## Respuesta directa a la pregunta central

**F. Los datos existen, están persistidos y llegan al read-model
(`publicacionesDe`), pero `digitalPresenceIndex.js` no los consume
porque los nombres de campo no coinciden (`CONTRACT_MISMATCH`).**

No es A (nunca recolectados), no es B (recolectados y perdidos), no
es D (mal asociados al candidato) — es un desajuste de nombre de
campo entre el mapeador de cada proveedor y el extractor de IPDO.
Demostrado con evidencia reproducible en la sección 4.

---

## 1. Cadena auditada

```
PROVIDER/COLLECTOR → RAW RESULT → NORMALIZATION → ACCOUNT ID →
PERSISTENCE → SNAPSHOT/PUBLICATION → READ MODEL → IPDO INPUT → SUBSCORE
```

| Etapa | Facebook | Instagram | TikTok | X (control) | YouTube (control) |
|---|---|---|---|---|---|
| Collector | ✅ ScrapeCreators (`perfilDeFacebook`/`publicacionesDeFacebook`) | ✅ `instagram_graph` (oficial) + ScrapeCreators (fallback) | ✅ ScrapeCreators | ✅ `x_api` | ✅ `youtube_data` |
| Raw result | ✅ | ✅ | ✅ | ✅ | ✅ |
| Persistencia (`publicacionesDe`) | ✅ 3 pubs, 1 candidato | ✅ 28 pubs, 4 candidatos | ✅ 10 pubs, 1 candidato | ✅ 48 pubs, 7 candidatos | ✅ 13 pubs, 3 candidatos |
| Read model expone | ✅ | ✅ | ✅ | ✅ | ✅ |
| **IPDO consume correctamente** | ❌ (mismatch total) | ⚠️ parcial | ⚠️ parcial | ✅ | ✅ |

**La cadena nunca se rompe antes del read model.** Se rompe
exactamente en el último eslabón: `IPDO INPUT`.

---

## 2. Matriz de 35 celdas — resumen ejecutivo

Auditoría completa candidato×plataforma sobre datos reales
(`tests/ipdoInputAudit.test.mjs`, 19/19, cero red). Resumen (detalle
completo reproducible ejecutando el test):

| Candidato | FB perfil/contenido | IG perfil/contenido | TT perfil/contenido | X perfil/contenido | YT perfil/contenido |
|---|---|---|---|---|---|
| Paúl Carrasco | perfil✅/contenido✅(mismatch) | perfil✅/contenido✅(parcial) | perfil✅/contenido❌(0 pubs) | perfil❌/contenido❌ | perfil✅/contenido✅ |
| Lloret Valdivieso | perfil✅/contenido❌(0 pubs) | perfil✅/contenido✅(parcial, oficial) | perfil✅/contenido❌(0 pubs) | perfil✅/contenido✅ | perfil✅/contenido✅ |
| Pedro Palacios | perfil✅/contenido✅(mismatch) | perfil✅/contenido✅(parcial, oficial) | perfil✅/contenido❌(0 pubs) | perfil✅/contenido✅ | SIN_CUENTA |
| Juan Carlos Vega | IDENTIDAD_INSUFICIENTE | perfil✅/contenido❌(0 pubs) | perfil✅/contenido❌(0 pubs) | perfil✅/contenido✅ | SIN_CUENTA |
| Yaku Pérez | perfil✅/contenido❌(0 pubs) | perfil✅/contenido✅(parcial, oficial) | perfil✅/contenido✅(mismatch parcial) | perfil✅/contenido✅ | perfil✅/contenido✅ |
| Marcelo Cabrera | perfil✅/contenido❌(0 pubs) | perfil✅/contenido❌(0 pubs) | perfil✅/contenido❌(0 pubs) | perfil✅/contenido✅ | SIN_CUENTA |
| Leonardo Morales | perfil✅/contenido❌(0 pubs) | perfil✅(1 válido)/contenido❌ | perfil✅/contenido❌(0 pubs) | perfil✅/contenido✅ | SIN_CUENTA |

**Nota importante:** "contenido❌(0 pubs)" no significa "sin
publicaciones observables" en todos los casos — significa que la
llamada real ejecutada en `P-CAND-OPERATIONAL-CLOSURE-01` fue
`operacion: "perfil"` únicamente (por control de presupuesto,
documentado explícitamente en ese gate), nunca se pidieron
publicaciones para esos activos. Es `NOT_COLLECTED` a nivel de
contenido, no una pérdida de datos.

---

## 3. Facebook — auditoría profunda

**Créditos del cierre operacional:** 8, 7 mediciones nuevas, 1 error
(`yakuperezoficial`). Localizadas exactamente:

| Candidato | Página | Persistido en | Campos de perfil | Publicaciones persistidas |
|---|---|---|---|---|
| Paúl Carrasco | `paulernestocarrascoc`, `paul.carrascocarpio.3` | `snapshotsDe` | `followers` (119000, null en la 2ª) | 3 (de un gate previo, `P-CAND-SOCIAL-BENCH-02`) |
| Pedro Palacios | `pedropalaciosu`, `pedropalaciosullauri` | `snapshotsDe` | `followers` (57000, 8900) | 0 nuevas en este gate (perfil solamente) |
| Yaku Pérez | `yakuperezgu` ✅ / `yakuperezoficial` ❌ error | `snapshotsDe` | `followers` (531000) | 0 |
| Marcelo Cabrera | `marcelocabrerap`, `marcelocabrerapa` | `snapshotsDe` | `followers` (60000, null) | 0 |

**Las 3 publicaciones de Facebook que SÍ existen** (Pedro Palacios,
de un gate anterior) contienen métricas reales:

```
ultima por metrica: { views:null, likes:null, reactions:157, commentsCount:16, shares:null }
ultima por metrica: { views:null, likes:null, reactions:508, commentsCount:122, shares:null }
```

**El campo `likes` está siempre `null` para Facebook.** El valor
real de "me gusta/reacciones" vive en `reactions`. El campo
`comments` no existe en absoluto para estas publicaciones — el
conteo real vive en `commentsCount`.

`digitalPresenceIndex.js#extraerInsumosCandidato` busca
literalmente `ultimaDe("likes")` y `ultimaDe("comments")` — ninguno
de los dos encuentra nada real para Facebook. **Causa raíz:
`CONTRACT_MISMATCH`.** No es `COLLECTION`, no es `PERSISTENCE`, no
es `NORMALIZATION` (el dato SÍ está normalizado, con nombre propio y
consistente) — es que el extractor de IPDO no conoce ese nombre.

---

## 4. TikTok — auditoría profunda

**Créditos del cierre operacional:** 5, 5/5 exitosos (Paúl, Pedro,
Vega, Marcelo, Leonardo) + Yaku y Lloret ya medidos en gates
anteriores. Las mediciones que ScrapeCreators certificó como reales
para `profile/videos/comments` (`P-CAND-SNAPSHOTS-01`,
`P-CAND-SOCIAL-BENCH-02`) sí incluyeron contenido — pero **solo para
Yaku Pérez**, la única con 10 videos reales persistidos:

```
tiktok, yaku-perez: ultima por metrica: { views:2198, likes:102, reactions:null, commentsCount:8, shares:16 }
                     ultima por metrica: { views:23481, likes:445, reactions:null, commentsCount:20, shares:52 }
```

**`views` y `likes` SÍ tienen el nombre correcto** (`digitalPresenceIndex.js`
los lee bien) — TikTok's mapper usa "likes" literalmente, a
diferencia de Facebook. **`shares` también se captura** (el
extractor hace `ultimaDe("reposts") ?? ultimaDe("shares")`, con
fallback correcto). **Solo `commentsCount` se pierde** (el extractor
busca `"comments"`, no existe ese nombre para TikTok).

**Separación exigida por el gate — `HISTORICAL_DATA_EXISTS` vs.
`REPEATABLE_ORCHESTRATION_COMPLETE`:** las 5 mediciones de perfil
del cierre operacional (Paúl, Pedro, Vega, Marcelo, Leonardo) fueron
**solo perfil** (`operacion: "perfil"`, sin publicaciones) — un
script directo, no `observarCandidato` (que no tiene rama TikTok,
hallazgo ya certificado). Sus 10 videos con métricas reales
pertenecen **solo a Yaku**, de una medición **anterior y distinta**
(`P-CAND-SOCIAL-BENCH-02`, cuando sí se pidieron videos). Los datos
existen para Yaku; la orquestación repetible de contenido para el
resto de candidatos **nunca se ejecutó** (`NOT_COLLECTED`, no un
fallo de persistencia).

**Root cause TikTok: `CONTRACT_MISMATCH` (comentarios) + `NOT_COLLECTED` (contenido de 6/7 candidatos, por decisión de presupuesto en gates previos, no por límite técnico).**

---

## 5. Instagram — auditoría profunda

Dos proveedores coexisten, con nombres distintos:

**`instagram_graph` (oficial, Business Discovery):**
```
{ metrica: "likes", value: null, provider: "instagram_graph" }
{ metrica: "comments", value: 10, provider: "instagram_graph" }
```
`likes` es `null` **por limitación real de la API de Meta**
(business_discovery no expone conteo de "me gusta" por publicación,
solo comentarios) — esto **no es un bug nuestro**, es
`TEMPORAL`/`CONTRACT`-neutro: el dato genuinamente no existe por esa
vía. `comments` SÍ usa el nombre correcto y SÍ es leído
correctamente por IPDO.

**`scrapecreators` (fallback, cuentas personales):**
```
{ metrica: "likes", value: 57, provider: "scrapecreators" }
{ metrica: "commentsCount", value: 5, provider: "scrapecreators" }
```
`likes` usa el nombre correcto (a diferencia de Facebook) y SÍ es
capturado. `commentsCount` no, mismo mismatch que Facebook/TikTok.

**Clasificación honesta por candidato** (según pedido del gate:
`FULL_CONTENT_METRICS`/`PROFILE_ONLY`/`PARTIAL`/`UNSUPPORTED_ACCOUNT_TYPE`/
`PROVIDER_BLOCKED`/`NO_ACCOUNT`/`IDENTITY_INSUFFICIENT`):

| Candidato | Clasificación | Motivo |
|---|---|---|
| Paúl Carrasco | `PARTIAL` | scrapecreators: likes✅ comments❌(mismatch) |
| Lloret Valdivieso | `PARTIAL` | instagram_graph: likes=null(real), comments✅ |
| Pedro Palacios | `PARTIAL` | instagram_graph: likes=null(real), comments✅ |
| Juan Carlos Vega | `PROFILE_ONLY` | 0 publicaciones persistidas |
| Yaku Pérez | `PARTIAL` | instagram_graph: likes=null(real), comments✅ |
| Marcelo Cabrera | `PROFILE_ONLY` | 0 publicaciones persistidas |
| Leonardo Morales | `PROFILE_ONLY` (1 activo válido) | 0 publicaciones persistidas; el otro activo es el homónimo excluido |

**Root cause Instagram: `CONTRACT_MISMATCH` (comments vía scrapecreators) + `NOT_COLLECTED` (contenido de Vega/Marcelo/Leonardo) + limitación real de API (likes vía Meta oficial, no es un bug).**

---

## 6. X — control

```
{ metrica: "likes", value: 12, provider: "x_api" }
{ metrica: "comments", value: 22, provider: "x_api" }
{ metrica: "reposts", value: 5, provider: "x_api" }
{ metrica: "views", value: 3523, provider: "x_api" }
```
**Los 4 nombres coinciden EXACTAMENTE con lo que
`digitalPresenceIndex.js` busca.** `x_api`'s mapper fue construido
usando esos nombres literales desde el principio. Esto explica, sin
ambigüedad, por qué X funciona perfecto: no hay mismatch, punto.

## 7. YouTube — control

```
{ metrica: "views", value: 172 }
{ metrica: "likes", value: 0 }
{ metrica: "comments", value: 0 }
```
Mismo caso: `youtube_data`'s mapper usa los nombres exactos que IPDO
espera. **Diferencia de contrato exacta encontrada:** `x_api` y
`youtube_data` (los dos providers MÁS ANTIGUOS del proyecto,
construidos ANTES de que existiera `scrapeCreatorsMapper.js`) usan
nombres de metrica que después se volvieron el estándar implícito de
`digitalPresenceIndex.js` (escrito consumiendo esos dos como
referencia). `scrapeCreatorsMapper.js` (Facebook/Instagram/TikTok)
se escribió después, con su propia convención de nombres
(`commentsCount`, `reactions`) documentada en su propio archivo, sin
que nadie reconciliara ambas convenciones al construir IPDO.

---

## 8. Perfil vs. contenido — separación aplicada

`followers`/`subscribers` (**PROFILE**): `AVAILABLE` en 5/5
plataformas, confirmado en el gate anterior — sigue siendo cierto,
no cambia con esta auditoría.

`posts/videos con métricas` (**CONTENT**): existen realmente para
Facebook (3, 1 candidato), Instagram (28, 4 candidatos), TikTok (10,
1 candidato) — pero **el volumen de contenido con datos completos es
mucho menor que en X (48, 7 candidatos) y YouTube (13, 3
candidatos)**, porque la mayoría de las llamadas de cierre
operacional pidieron **solo perfil** (control de presupuesto, ya
documentado). No se afirma "TikTok está medido" (solo perfil, 6 de 7
candidatos) ni "TikTok no tiene datos" (Yaku sí tiene contenido
real, con nombres parcialmente compatibles).

---

## 9. Comentarios — corpus de TEXTO (distinto del conteo por publicación)

**Hallazgo separado y más grave:** `projectStore.js` **no tiene
ninguna función de persistencia de corpus de comentarios**
(`guardarComentarios`/`comentariosDe` no existen). Los "10/122
comentarios de Pedro Palacios (FB)" y "20/110 de Yaku Pérez
(TikTok)" reportados en gates anteriores (`P-CAND-FACEBOOK-01`,
`SOCIAL-PROVIDER-REAL-02`) fueron **calculados en memoria durante la
llamada real y nunca persistidos** — `commentObservation.js` define
las funciones puras (`crearComentarioObservado`,
`crearCorpusDeComentarios`) pero nadie las conecta a una escritura
en el Lake. **Root cause: `COLLECTED_NOT_PERSISTED`.** El conteo
agregado de comentarios por publicación (`commentsCount`) SÍ está
persistido (visto en la sección 3-5); el TEXTO de cada comentario
individual no.

**Implicación para IPDO:** no hay riesgo de doble conteo con el
corpus de texto porque **no existe** como insumo disponible hoy.

---

## 10. Snapshots — distribución real

| Plataforma | Snapshots | Contienen |
|---|---|---|
| Instagram | 15 | `followers`, `postsObserved`, `metricsAvailable` |
| Facebook | 14 | ídem |
| TikTok | 9 | ídem |
| X | 6 | ídem |
| YouTube | 3 | ídem |
| **Total** | **47** | — |

Todos los snapshots son de **perfil** (followers), consistente con
`operationalClosure.js`'s definición de MEDIDO (sección 12).

## 11. Evidence Ledger / Knowledge Lake

Se encontraron 16-51 evidencias por candidato con URLs de
`facebook.com`/`instagram.com`/`tiktok.com` — pero son **resultados
de búsqueda web indexando la página de perfil** (ej. "Pedro Palacios
Ullauri (@PedroPalaciosU) · 57629 likes"), no contenido/publicaciones
scrapeadas. **No hay contenido de FB/IG/TikTok duplicado entre
`evidenciasDe` y `publicacionesDe`** — son fuentes genuinamente
distintas (medios/buscadores vs. proveedor social). Sin riesgo de
doble conteo aquí.

---

## 12. Semántica de MEDIDO (`operationalClosure.js`/`socialBenchmarkMatrix.js`)

**Respuesta exacta a la pregunta del gate: A. identidad + alguna
métrica de PERFIL.** `clasificarCelda`/`activoCubierto` deciden
MEDIDO mirando `snapshotsDe` (perfil), nunca `publicacionesDe`
(contenido). **`MEDIDO` NO implica que exista contenido ni
interacciones.** Esto es exactamente la distinción que la sección 17
del gate pedía documentar: un candidato puede estar `MEDIDO` en
Facebook (tiene snapshot de seguidores) y aun así aportar `null` a
la dimensión `Interaction` de IPDO (sin publicaciones o con
publicaciones cuyos campos IPDO no reconoce).

---

## 13. Mapeo de campos IPDO — inventario exacto

| IPDO_METRIC | Campo esperado | Fuente esperada | Facebook real | Instagram real | TikTok real |
|---|---|---|---|---|---|
| engagement (likes) | `metrica === "likes"` | `publicacionesDe` | `reactions` ⚠️ | `likes` ✅ (scrapecreators) / `null` real (oficial) | `likes` ✅ |
| engagement (comments) | `metrica === "comments"` | `publicacionesDe` | `commentsCount` ⚠️ | `commentsCount` ⚠️ (scrapecreators) / `comments` ✅ (oficial) | `commentsCount` ⚠️ |
| engagement (reposts) | `metrica === "reposts"` con fallback `"shares"` | `publicacionesDe` | `shares` (siempre null en datos reales) | `shares` (siempre null) | `shares` ✅ (fallback funciona) |
| attention (views) | `metrica === "views"` | `publicacionesDe` | siempre null en datos reales | siempre null en datos reales | `views` ✅ |

---

## 14. Contract mismatches confirmados

1. **Facebook `reactions` vs `likes`** — el extractor nunca lee `reactions`.
2. **Facebook/Instagram(scrapecreators)/TikTok `commentsCount` vs `comments`** — el extractor nunca lee `commentsCount`.
3. **Instagram(oficial) `likes: null`** — no es mismatch, es limitación real de Meta Business Discovery (no expone likes por publicación). Documentado para no confundirlo con un bug.

## 15. Datos huérfanos / IDs

No se encontraron publicaciones con `candidateId`/`accountId`
inconsistentes en esta auditoría — todas las publicaciones de
FB/IG/TikTok revisadas llevan el `accountId` canónico correcto
(minúsculas, sin `@`), consistente con la estabilización de
`P-CAND-SNAPSHOTS-01`. No se encontró el problema de huérfanos en
esta capa.

## 16. Compatibilidad temporal

`PRESENCE` (snapshots de perfil) = `CURRENT_STOCK`. `INTERACTION`/
`CONVERSATION` (publicaciones/evidencias) = `OBSERVATION_WINDOW`,
pero la ventana **no es la misma para todas las plataformas**: X/
YouTube acumulan desde 2026-08-28, Facebook/TikTok/Instagram desde
fechas dispersas (2026-08-31 a 2026-09-03) según cuándo se ejecutó
cada gate. **`CANDIDATE_TEMPORAL_COMPARABILITY_DEBT` sigue vigente**
(ya declarada en `CANDIDATE-DIGITAL-PRESENCE-INDEX-01.md`), no
resuelta ni empeorada por esta auditoría.

## 17. Riesgo de doble conteo

Ninguno detectado activamente (comentarios de texto no persistidos,
evidencias no se solapan con publicaciones). **Riesgo latente
documentado:** si en el futuro se persiste el corpus de texto de
comentarios (sección 9), habría que decidir explícitamente si cuenta
en `Interaction.engagement` (ya cubierto por `commentsCount` una vez
arreglado el mismatch) o en `Conversation` — **no ambos**, para no
duplicar la misma señal.

---

## 18. Auditoría de cobertura metodológica

**Conclusión: la cobertura ALTA reportada para los 7 candidatos es
técnicamente correcta según su propia definición (¿cuántas de las 8
señales esperadas son computables?), pero está SOBRE-INTERPRETABLE.**
Los 7 candidatos llegan a ALTA porque `accountCoverage` y `audience`
(Presence) están bien poblados, y `activity`/`engagement`/`attention`
(Interaction) resultan computables gracias a X (presente en 6/7
candidatos) y/o YouTube — **no porque Facebook/Instagram/TikTok
aporten señal real de contenido**. Un candidato puede mostrar
`methodologicalCoverage: ALTA` mientras 3 de 5 plataformas
contribuyen únicamente con `Presence`, nunca con `Interaction`. La
cobertura **no distingue** "la señal no existe" de "la señal existe
pero el extractor no la lee por un nombre de campo distinto" — ambos
casos se ven idénticos desde `methodologicalCoverage`.
**`IPDO_COVERAGE_RATING_INTEGRITY = NEEDS_REVISION`.**

---

## 19. Traza completa: Yaku Pérez, Conversation = 0

Insumos crudos reales (releídos en este gate, verificados con test
M, reproducibles):

| Candidato | thirdPartyVolume | mediaDiversity | publicConversation |
|---|---|---|---|
| Paúl Carrasco | 64 | 22 | 54 |
| Lloret Valdivieso | 90 | 23 | 70 |
| Pedro Palacios | 46 | 14 | 34 |
| Juan Carlos Vega | 42 | 16 | 40 |
| **Yaku Pérez** | **39** | **12** | **25** |
| Marcelo Cabrera | 42 | 17 | 30 |
| Leonardo Morales | 42 | 17 | 32 |

Yaku tiene el **valor mínimo absoluto de los 7** en los tres
sub-indicadores simultáneamente. Bajo min-max relativo, el mínimo
del grupo normaliza a exactamente `0` en cada uno, y la combinación
ponderada de tres ceros es `0`. **`RAW_CONVERSATION_VOLUME` de Yaku
NO es cero** (39 hechos distintos, 12 medios, 25 piezas de
conversación — volumen real, nada despreciable en términos
absolutos). **`RELATIVE_CONVERSATION_SCORE` sí es 0** porque es
relativo a candidatos con volumen aún mayor (Lloret: 90/23/70).

**Texto recomendado para UI** (sin implementarlo en este gate, solo
recomendado): en vez de mostrar "Conversación: 0/100" sin contexto,
mostrar algo como *"Conversación: 0/100 (relativo al grupo) — 39
menciones de terceros observadas, la cifra más baja de los 7
candidatos del proyecto"*, para que `0` nunca se lea como "ausencia
de conversación".

---

## 20. Tabla final por plataforma

| Platform | Profile data | Content data | Interaction data | Comments (corpus texto) | Persisted | Read model | IPDO | Root cause |
|---|---|---|---|---|---|---|---|---|
| Facebook | ✅ 7/7 | ✅ 1/7 (3 pubs) | ❌ (mismatch total) | ❌ no persistido | ✅ | ✅ | ❌ | `CONTRACT_MISMATCH` |
| Instagram | ✅ 7/7 | ✅ 4/7 (28 pubs) | ⚠️ parcial (comments sí en oficial, no en scrapecreators) | ❌ no persistido | ✅ | ✅ | ⚠️ | `CONTRACT_MISMATCH` + `NOT_COLLECTED` (3/7) |
| TikTok | ✅ 7/7 | ✅ 1/7 (10 pubs, Yaku) | ⚠️ parcial (likes+shares sí, comments no) | ❌ no persistido | ✅ | ✅ | ⚠️ | `CONTRACT_MISMATCH` (comments) + `NOT_COLLECTED` (6/7) |
| X | ✅ 6/7 | ✅ 7/7 (48 pubs) | ✅ completo | n/a | ✅ | ✅ | ✅ | — |
| YouTube | ✅ 3/7 | ✅ 3/7 (13 pubs) | ✅ completo | n/a | ✅ | ✅ | ✅ | — |

## 21. Tabla final por candidato (compacta)

| Candidato | FB | IG | TT | X | YT | IPDO input completeness |
|---|---|---|---|---|---|---|
| Paúl Carrasco | P✅/C⚠️ | P✅/C⚠️ | P✅/C❌ | P❌/C❌ | P✅/C✅ | PARCIAL |
| Lloret Valdivieso | P✅/C❌ | P✅/C⚠️ | P✅/C❌ | P✅/C✅ | P✅/C✅ | PARCIAL |
| Pedro Palacios | P✅/C⚠️ | P✅/C⚠️ | P✅/C❌ | P✅/C✅ | SIN_CUENTA | PARCIAL |
| Juan Carlos Vega | IDENT.INSUF. | P✅/C❌ | P✅/C❌ | P✅/C✅ | SIN_CUENTA | PARCIAL |
| Yaku Pérez | P✅/C❌ | P✅/C⚠️ | P✅/C⚠️ | P✅/C✅ | P✅/C✅ | PARCIAL |
| Marcelo Cabrera | P✅/C❌ | P✅/C❌ | P✅/C❌ | P✅/C✅ | SIN_CUENTA | PARCIAL (solo X aporta interaction real) |
| Leonardo Morales | P✅/C❌ | P✅(1 activo)/C❌ | P✅/C❌ | P✅/C✅ | SIN_CUENTA | PARCIAL (solo X aporta interaction real) |

`P` = profile, `C` = content. ✅ completo/correcto, ⚠️ parcial
(mismatch), ❌ ausente o no consumido.

---

## 22. Root cause classification (por hueco, categoría única)

| Hueco | Categoría |
|---|---|
| Facebook likes (todas las publicaciones) | `CONTRACT_MISMATCH` |
| Facebook comments (todas las publicaciones) | `CONTRACT_MISMATCH` |
| Instagram comments vía scrapecreators | `CONTRACT_MISMATCH` |
| Instagram likes vía oficial (Meta) | no es un hueco reparable: limitación real de API, `UNSUPPORTED` |
| TikTok comments (Yaku) | `CONTRACT_MISMATCH` |
| TikTok contenido (6/7 candidatos) | `NOT_COLLECTED` |
| Facebook contenido (6/7 candidatos, salvo Pedro) | `NOT_COLLECTED` |
| Instagram contenido (Vega, Marcelo, Leonardo) | `NOT_COLLECTED` |
| Corpus de texto de comentarios (todas las plataformas) | `COLLECTED_NOT_PERSISTED` |
| Pedro Palacios/YouTube, Vega/YouTube, Marcelo/YouTube, Leonardo/YouTube | `NO_ACCOUNT` (`SIN_CUENTA`, ya certificado en gates anteriores) |
| Juan Carlos Vega/Facebook | `IDENTITY_INSUFFICIENT` (ya certificado) |
| Homónimo Leonardo/Instagram | `IDENTITY_CONFLICT` (ya certificado, sigue excluido) |

---

## 23. Decisión de recolección por plataforma

| Plataforma | `RECOLLECTION_REQUIRED` | Motivo |
|---|---|---|
| Facebook | **NO** | El contenido de Pedro ya existe; el resto son `NOT_COLLECTED` por decisión de presupuesto anterior, no por imposibilidad — recolectar más NO resuelve el mismatch, que es lo que realmente bloquea a IPDO hoy |
| Instagram | **PARTIAL** | Vega/Marcelo/Leonardo no tienen contenido persistido; recolectarlo sería útil, pero el mismatch de `commentsCount` seguiría bloqueando comments incluso con más datos |
| TikTok | **PARTIAL** | 6/7 candidatos sin contenido; útil recolectar, pero de nuevo el mismatch de comments persiste independientemente |
| X | **NO** | Ya completo y correctamente consumido |
| YouTube | **NO** | Ya completo (para quien tiene canal) y correctamente consumido |

**Conclusión central: reparar el mapeo (`IPDO_MAPPING`) es
prerequisito y de mayor impacto inmediato que recolectar más datos.**
Recolectar sin reparar el mapeo simplemente produciría más datos que
IPDO seguiría sin leer.

## 24. Decisión de reparación por plataforma (`REPAIR_LAYER`)

| Plataforma | `REPAIR_LAYER` |
|---|---|
| Facebook | `IPDO_MAPPING` |
| Instagram | `IPDO_MAPPING` |
| TikTok | `IPDO_MAPPING` |
| X | `NONE` |
| YouTube | `NONE` |
| Corpus de comentarios (texto) | `PERSISTENCE` (fuera del alcance de IPDO_MAPPING; gate aparte) |

---

## 25. Tests

`tests/ipdoInputAudit.test.mjs` — **19/19**, cero red: 7 candidatos
enumerados, 5 plataformas, 35 celdas, homónimo excluido, missing≠0
con datos reales, perfil≠contenido confirmado con datos reales,
contract mismatch confirmado con evidencia reproducible (`reactions`,
`commentsCount`), semántica de MEDIDO documentada y verificada,
conteos deterministas de snapshots/evidencias, cero fetch real,
project isolation, inventario de mapeo IPDO completo, traza
reproducible de Yaku Conversation=0, sin secretos impresos.

## 26. Regresiones

`node --test tests/*.test.mjs` — **57/58 archivos, 1 fallo
preexistente y ajeno** (`ingest-real.test.mjs`, chequeo de
`.env.example` de Territorial, no relacionado, no tocado).

## 27. External requests / créditos

**0 requests externas. 0 créditos.** Toda la auditoría se hizo
releyendo datos ya persistidos.

---

## 28. Veredictos

| Veredicto | Resultado |
|---|---|
| `FACEBOOK_IPDO_INPUT` | **NOT_READY** |
| `INSTAGRAM_IPDO_INPUT` | **PARTIAL** |
| `TIKTOK_IPDO_INPUT` | **PARTIAL** |
| `X_IPDO_INPUT` | **READY** |
| `YOUTUBE_IPDO_INPUT` | **READY** |
| `IPDO_CROSS_PLATFORM_INPUT_INTEGRITY` | **PARTIAL** |
| `IPDO_COVERAGE_RATING_INTEGRITY` | **NEEDS_REVISION** |
| `RECOLLECTION_REQUIRED` | **PARTIAL** (solo Instagram/TikTok se beneficiarían de más contenido; el mapeo es la reparación de mayor impacto en las 3 plataformas) |

---

## 29. Siguiente recomendación exacta de reparación

**Gate de reparación de mapeo (`IPDO_MAPPING`), no de recolección.**
Alcance mínimo sugerido: extender
`digitalPresenceIndex.js#extraerInsumosCandidato` para que
`ultimaDe()` reconozca alias de nombre por metrica
(`likes` ∪ `reactions`, `comments` ∪ `commentsCount`), documentando
la equivalencia y sin cambiar pesos, normalización, ranking ni
frontend — exactamente el tipo de corrección que **este gate de
auditoría no estaba autorizado a hacer** (sección 28 del gate:
"correcciones de instrumentación/auditoría que no alteren resultados
productivos" sí, pero un cambio en `extraerInsumosCandidato` altera
directamente los scores de producción, por lo que se deja
documentado y pendiente de un gate propio, con su propia validación
de sensibilidad y regresión antes de aprobarse).
