# TERRITORIAL-CORPUS-PERSISTENCE-01

**Persistencia del corpus observable — proyecto Elecciones Alcaldía Cuenca 2027**

Terminal 2 · Territorial Intelligence
Base: `bc2daae` — TERRITORIAL-COLLECTOR-EXPANSION-01
Ejecutado: 2026-09-03 · Pasada real: `2026-09-03T22:53:20.187Z`

---

## 1. Decisión humana registrada

Persistir. Y persistir sin convertir incertidumbre en precisión falsa: una pieza sin fecha de publicación se guarda **con `publishedAt = null`** y sigue siendo evidencia útil, pero no entra en ninguna ventana temporal. `CORROBORADO` y `PROBABLE` pueden formar el corpus ampliado, nunca mezclados en silencio.

---

## 2. Store canónico — auditado antes de escribir

No se creó ningún store paralelo. Ningún archivo temporal es fuente de verdad.

```
CANONICAL_STORE    territorial/evidenceLedger.js
                   JSONL append-only en
                   data/territorial-evidence/AAAA/MM/DD.jsonl
DEDUP_KEY          evidenceId
PROJECT_SCOPE      projectId + tenantId
TEMPORAL_FIELDS    publishedAt · firstObservedAt · lastObservedAt · retrievedAt
PROVENANCE_FIELDS  providers[] · providerId · provenance{} · feedUrl ·
                   sourceId · domain · publisher
```

El escritor canónico es `registrarPasada`, que ya hacía `publishedAt: ev.publishedAt || null`. `corpusPersistence.js` es una envoltura fina que añade tres cosas: rechaza lo que no se puede persistir sin mentir, cuenta insertado/deduplicado/descartado, y deriva la elegibilidad temporal.

**Se verificó que no existe ningún fallback silencioso de fecha** aguas abajo: en `topicTerritoryCrosstab` la única lectura es `e.publishedAt || e.fecha || null` — ni `observedAt`, ni `new Date()`.

---

## 3. Recuperación del input real — lo que NO se pudo recuperar

**Los cuerpos de las 87 piezas del benchmark anterior no se persistieron en ninguna parte.** `mesh-metricas.json` guardó únicamente métricas agregadas, 6 etiquetas de consulta, 44 dominios y 6 mapas de activos. No hay evidencia cruda que releer.

Así que **no se reprodujeron las 87**. No se inventó ninguna pieza desde el informe y no se creó evidencia sintética: se recolectó de nuevo dentro del tope de este gate.

| | |
|---|---|
| `brave_web` | 2 consultas (tope) → 20 piezas únicas |
| `x_api` | 1 consulta (tope) → 25 piezas |
| `youtube_data` | 1 búsqueda (tope) → 15 piezas |
| **`REAL_INPUT_RECOVERED`** | **60** |

Los 16 posts de Facebook y TikTok del benchmark tampoco eran recuperables sin gastar créditos que este gate reserva para Instagram, y no se recolectaron.

---

## 4. Regla temporal — el invariante

```
publishedAt   cuándo se publicó el contenido
observedAt    cuándo lo vio Sentinel
```

No son intercambiables y no se sustituyen. La tentación es rellenar los nulos con el instante de la petición, porque así «todo tiene fecha» y las ventanas cuadran. Eso convierte incertidumbre en precisión falsa y **después es indetectable**: nadie puede distinguir «publicado hoy» de «observado hoy» mirando el dato.

`normalizarFechaDePublicacion` lee **solo** campos editoriales (`publishedAt`, `fecha`). Ignora `observedAt`, `retrievedAt`, `firstObservedAt` y `lastObservedAt`, y devuelve `null` ante una fecha ilegible. Hay una prueba que le pasa un objeto **con los cuatro campos de observación rellenos y ninguno editorial**, y exige `null`.

El informe de cada pasada certifica `sinSustitucionDeFecha: true` en el punto de escritura.

### Elegibilidad temporal — derivada, no almacenada

`publishedAt != null` → elegible. **No se añadió ningún campo booleano**: sería una segunda fuente de verdad que puede desincronizarse del dato que describe.

Y no hace falta filtrar en cada consulta, porque el invariante ya existe aguas abajo: `dentroDe(instante, ventana)` devuelve `false` con instante nulo. Una pieza sin fecha no entra en ninguna ventana **por contrato**, no por disciplina de quien consulta.

---

## 5. Resultados de la persistencia

| | |
|---|---|
| `TOTAL_CORPUS_BEFORE` | **421** |
| `REAL_INPUT_RECOVERED` | **60** |
| `NEW_INSERTED` | **40** |
| `DEDUPLICATED` | **20** |
| `SKIPPED` | **0** |
| `TOTAL_CORPUS_AFTER` | **461** |

Las 20 deduplicadas son piezas de X ya observadas: el solapamiento del 52 % que midió el gate anterior, funcionando.

### Idempotencia (§13)

Segunda pasada con la misma entrada, sobre las 40 piezas ya persistidas y **sin una sola llamada de red**:

```
INPUT_REAL   40
INSERTED      0   <-- idempotente
DEDUPLICATED 40
TOTAL_AFTER 461   <-- el corpus no se infla
```

Y `firstObservedAt` no se reescribe al repetir: avanza `lastObservedAt` y sube `observationCount`. Hay prueba.

### Reinicio (§15)

Se escribió con un adapter, se descartó, y se leyó con otro recién creado sobre el mismo almacén: **461 piezas, las 40 nuevas presentes**. La pieza sin fecha sigue sin fecha después del reinicio; la que tenía fecha la conserva idéntica. Memoria del proceso no basta, y por eso el adapter se recrea en la prueba.

### Distribución por collector

| Collector | Después | Delta |
|---|---|---|
| `rss_directo` | 353 | — |
| `x_api` | 61 | **+14** |
| `youtube_data` | 27 | **+6** |
| `brave_web` | **20** | **+20** |
| `gdelt_doc` | 0 en este proyecto | — |
| `facebook_known` / `instagram_known` / `tiktok_known` | 0 | — |

`brave_web` entra por primera vez al corpus persistido: en el gate anterior era infraestructura configurada y sin usar.

### Distribución temporal

| | |
|---|---|
| `WITH_PUBLISHED_AT` | **447** |
| `WITHOUT_PUBLISHED_AT` | **14** |
| `TEMPORAL_ELIGIBLE` | **447** |
| `TEMPORAL_INELIGIBLE` | **14** |

Motivo de los 14: **fecha no declarada por la fuente**, 0 por fecha ilegible. La distinción importa: lo primero es un límite del proveedor, lo segundo sería un fallo nuestro.

### Ventanas — solo con `publishedAt` elegible

| Ventana | Piezas |
|---|---|
| HOY | 64 |
| 7D | 309 |
| 15D | 340 |
| 30D | 358 |
| 90D | 396 |

Las 14 sin fecha **no aparecen en ninguna**. Comprobado también en el caso límite: una matriz construida solo con la pieza sin fecha y ventana de 90 días devuelve 0.

### Distribución territorial del corpus persistido

> **195 señales territorialmente utilizables: 181 corroboradas y 14 probables.**

| Estado | N |
|---|---|
| `CORROBORADO` | **181** |
| `PROBABLE` | **14** |
| **`AMPLIADO`** | **195** |
| `AMBIGUO` | 14 |
| `CONFLICTIVO` | 2 |
| `FUERA` | 13 |
| `NO_RESOLUBLE` | 237 |

Los 237 no resolubles son en su mayoría notas de medios nacionales sin topónimo: se conservan como evidencia y no suman en ninguna métrica territorial. **Nada se borra; se excluye de los agregados.**

Del input de 60: 40 corroboradas, 2 probables, 9 ambiguas, 9 no resolubles, 0 fuera.

---

## 6. Las piezas sin fecha (§23)

El gate anterior encontró 32 de 60 resultados Brave sin `publishedAt`. **Aquí son 14 de 20**, porque las consultas fueron dos y no seis. La proporción es parecida —70 % frente a 53 %— y el número no se forzó para hacerlo coincidir con el informe.

Su tratamiento verificado: persistidas, `publishedAt = null`, fuera de las cinco ventanas por comportamiento, y disponibles para evidencia, descubrimiento, actores y universo de fuentes. Una de ellas resuelve `TERRITORIO_CORROBORADO` sin tener fecha, que es exactamente el punto: **la utilidad territorial y la utilidad temporal son independientes**.

---

## 7. Source Universe

Recuperado del artefacto local del benchmark: **44 dominios**, de los cuales **12 ya estaban** en el universo de fuentes y **32 son candidatos nuevos**. Más **26 activos sociales** de 6 actores locales.

Ninguno se promueve solo: entran como `DESCUBIERTO_POR_BUSQUEDA` con `requiereVerificacion: true`. No se inventó ninguna URL, `facebook.com/sharer` no se convierte en actor, y una coincidencia de nombre no autoriza resolución automática.

**Y la regla metodológica, con prueba:** El Mercurio es un actor local de Cuenca; su nota sobre el dólar **no** es evidencia territorial de Cuenca. Un actor local corroborado no territorializa cada pieza que publica.

---

## 8. Aislamiento de proyecto

| | |
|---|---|
| Proyecto A (`alcaldia-cuenca-2027-piloto`) | **461** |
| Proyecto B (fixture) | **0** |

Tres capas de prueba: lectura cruzada en el ledger real; `persistirCorpus` **lanza excepción si falta `projectId`** —una evidencia sin proyecto se convertiría en corpus territorial global por accidente—; y la prueba de mutación: quitado el campo del registro, el proyecto lee 0, y solo aparece con `incluirLegado: true`.

---

## 9. Instagram — retry controlado

3 intentos, el tope. Activos reales enlazados desde sitio oficial, ningún handle inventado.

| Handle | Parámetro | Endpoint | Estado | Error del proveedor | Créditos | Resultados | ms |
|---|---|---|---|---|---|---|---|
| `unsiontv` | handle | `/v2/instagram/user/posts` | ERROR_PROVEEDOR | `internal_server_error` | **0** | 0 | 18 378 |
| `emov_ep` | handle | `/v2/instagram/user/posts` | ERROR_PROVEEDOR | `internal_server_error` | **0** | 0 | 18 167 |
| `etapacuenca` | handle | `/v2/instagram/user/posts` | ERROR_PROVEEDOR | `internal_server_error` | **0** | 0 | 18 353 |

Tres activos distintos, parámetro correcto, mismo error, ~18 s de latencia constante y **cero créditos cobrados**. Sumado a los 4 intentos del gate anterior: **7 intentos, 0 éxitos, 0 créditos**.

El patrón es consistente, no aleatorio. → `INSTAGRAM_KNOWN_ACCOUNT = BLOQUEADO_PROVEEDOR`.

No se dice «no soportado»: la API declara el endpoint y el proveedor cobra 0 al fallar, lo que indica que reconoce la petición y falla al servirla. Es un endpoint no operativo, no una capacidad ausente.

---

## 10. Presupuesto

| Recurso | Tope | Consumido |
|---|---|---|
| Brave | 2 | **2** |
| X | 1 | **1** |
| YouTube | 1 | **1** |
| Instagram | 3 requests | **3** |
| ScrapeCreators | 3 créditos | **0 cobrados** |
| SerpAPI | 0 | **0** |
| DuckDuckGo | 0 | **0** |
| **Coste adicional** | — | **$0** |

`credits_before`: **NO_VERIFICABLE** — no se capturó antes de la pasada.
`credits_used`: **0**, declarado por el proveedor en cada respuesta (`credits_charged: 0`).
`credits_remaining`: **51** según la última respuesta verificable del gate anterior; no se pudo reconfirmar porque las tres llamadas fallaron y su cuerpo de error no siempre incluye el saldo.

Las verificaciones posteriores a la recolección —idempotencia, reinicio, ventanas, aislamiento— se hicieron con **cero llamadas de red**, sobre lo ya persistido.

---

## 11. Pruebas

Suite nueva `territorial-persistence`: **35 pruebas, 0 fallos**, cubriendo A–V. Cero red.

| Suite | Pruebas |
|---|---|
| `territorial` | 160 |
| `territorial-d2` | 92 |
| `territorial-sources` | 61 |
| `territorial-c2` | 53 |
| `territorial-fresh` | 50 |
| `territorial-topic` | 49 |
| `territorial-mesh` | 46 |
| `territorial-coverage` | 45 |
| `territorial-rotation` | 42 |
| `territorial-d` | 39 |
| `territorial-social` | 36 |
| `territorial-geo-disambiguation` | 36 |
| `territorial-persistence` | **35** |
| `territorial-project` | 29 |
| `territorial-expansion` | 29 |
| `territorial-listening` | 31 |
| **Total territorial** | **833 · 0 fallos** |

Regresiones: Candidate `socialProviders` 36, `xReal` 37, `candidateIntelligence` 100, `accountIntelligence` 36 — todas verdes. Media `mediaPiece` 42, `mediaTime` 29, `mediaHome` 41, `mediaSourceUniverse` 33 — todas verdes.

`npm run build`: correcto. `npm run lint`: 6 errores **preexistentes y ajenos** en `Dashboard.jsx` y `KnowledgeGraph.jsx`. No se tocó lint ajeno.

### Un error propio, y cómo se detectó

La primera pasada real reportó `INSERTED: 0` con 60 piezas de entrada. Mi módulo leía `r.nuevas` y `r.revistas`, que **no existen**: el escritor canónico devuelve `r.metricas.nuevasParaSentinel` y `r.metricas.yaConocidas`.

Las 40 piezas **sí se habían escrito**. Lo delató que `TOTAL_CORPUS_AFTER` subiera de 421 a 461 mientras el contador decía 0. Contar por una vía distinta de la que escribe es precisamente cómo se producen esos huecos, y ahora las cifras salen del propio escritor.

Corregido y verificado sin gastar red: 40 entrada → 0 insertadas → 40 deduplicadas → 461 estable.

---

## 12. Veredictos

| Dimensión | Estado |
|---|---|
| `TERRITORIAL_CORPUS_PERSISTENCE` | **OPERATIVO** |
| `TEMPORAL_INTEGRITY` | **OPERATIVO** |
| `TERRITORIAL_STRATA` | **OPERATIVO** |
| `DEDUPLICATION` | **OPERATIVO** |
| `PROJECT_ISOLATION` | **OPERATIVO** |
| `SOURCE_UNIVERSE_ENRICHMENT` | **OPERATIVO_CON_LIMITACIONES** |
| `INSTAGRAM_KNOWN_ACCOUNT` | **BLOQUEADO_PROVEEDOR** |
| `INSTAGRAM_OPEN_DISCOVERY` | **NO_SOPORTADO_POR_PROVIDER_ACTUAL** |
| `TERRITORIAL_OPEN_LISTENING_READINESS` | **PARCIAL** |

`SOURCE_UNIVERSE_ENRICHMENT` con limitaciones porque los 32 candidatos y los 26 activos están identificados pero **ninguno verificado**: la promoción exige verificación HTTP y territorio declarado, y eso es trabajo humano.

`TERRITORIAL_OPEN_LISTENING_READINESS` se mantiene **PARCIAL**: nada en este gate amplió la cobertura del ecosistema. Facebook y TikTok siguen siendo known-account, Instagram sigue bloqueada. Persistir mejor no es observar más.

---

## 13. Limitaciones

1. **Las 87 piezas originales del benchmark se perdieron.** Se persistieron 40 reales de una recolección nueva y acotada. La cifra del informe anterior no es reproducible.
2. **14 piezas sin fecha** están fuera de todo análisis temporal, y lo seguirán estando: el motor no declara fecha y no se va a inventar.
3. **237 piezas `NO_RESOLUBLE`** — el 51 % del corpus — no aportan nada territorial. Es composición del universo de fuentes, no fallo del resolutor.
4. **`credits_before` no verificable.** Debe capturarse antes de la primera llamada en el próximo gate que gaste créditos.
5. **Facebook y TikTok con 0 piezas persistidas.** Se midieron en el benchmark y no se recuperaron aquí por presupuesto.
6. **`SHARED_GEO_CONTEXT_DEBT` intacta.** `esElAmbito` sigue circular en `geoResolver`.
7. **El corpus sigue dominado por medios nacionales:** `rss_directo` 353 de 461, un **77 %**, con `expreso.ec` y `extra.ec` a la cabeza.

---

## 14. Siguiente gate recomendado

**`C · LOCAL-SOURCE-EXPANSION` adicional.**

El dato que decide: **77 % del corpus persistido viene de `rss_directo`, dominado por medios nacionales**, y hay **237 piezas no resolubles** que son en su mayoría notas nacionales sin topónimo. El problema del corpus no es el tamaño ni la metodología: es la composición.

Y ya existe el material para corregirlo sin gastar nada: **32 candidatos a fuente y 26 activos sociales** esperando verificación, varios inequívocamente locales (`tranvia.cuenca.gob.ec`, `webnueva.etapa.net.ec`, `investigaciones.uazuay.edu.ec`).

Por qué no las otras tres:

- **`B · TOPIC-NORMALIZATION-01`** — sería normalizar temas sobre un corpus con 77 % de prensa nacional. Los temas que saldrían serían los del Ecuador, no los de Cuenca. Hacerlo ahora produciría metodología válida sobre datos sesgados, que es peor que no hacerlo.
- **`A · PROVIDER-OPEN-DISCOVERY-EVAL-01`** — el requisito está bien especificado y no urge: cuesta dinero y el cuello de botella actual es la composición local, no la ausencia de redes sociales.
- **`D · SHARED-GEO-CONTEXT-FIX`** — T1 y T3 están activos ahora mismo (Candidate UX en curso). Exige coordinación.

**STOP.** No se inicia ninguno. No se toca Topic Normalization, Trend Radar, Momentum, Change Attribution, Pulso Electoral Digital, Sentinel AI, Reporting, UX de Candidate o Media, ni el arreglo compartido de `esElAmbito`. Se espera decisión humana.
