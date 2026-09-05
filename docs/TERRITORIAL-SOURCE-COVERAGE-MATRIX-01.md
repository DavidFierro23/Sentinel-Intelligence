# TERRITORIAL-SOURCE-COVERAGE-MATRIX-01

**Matriz canónica de cobertura de recolección — Cuenca 2027**

Terminal 2 · Territorial Intelligence
Base: `b94f94b` — TERRITORIAL-TOPIC-NORMALIZATION-01
Ejecutado: 2026-09-05 · `coverage-matrix-1.0.0`

---

## La regla que organiza todo el documento

> **COBERTURA DE FUENTES ≠ COBERTURA DE POBLACIÓN**

Esta matriz describe qué fuentes puede observar Sentinel. **No** describe ciudadanos, penetración electoral ni representatividad estadística. Ninguna celda autoriza a decir «el X % de Cuenca».

**Peticiones externas: 0. Créditos: 0. Coste: $0.** Auditoría de código, configuración, adaptadores y ledger persistido, con el `fetch` global contado en cada ejecución y en cada prueba.

---

## 1. Inventario de motores — 16 auditados

| Motor | Familia | Credencial | Config. | Cableado a Territorial | Estado |
|---|---|---|---|---|---|
| `rss_directo` | NEWS | no | sí | **sí** | **OPERATIVE** |
| `x_api` | SOCIAL_OPEN | `X_BEARER_TOKEN` | sí | **sí** | OPERATIVE_WITH_LIMITATIONS |
| `youtube_data` | SOCIAL_OPEN | `YOUTUBE_API_KEY` | sí | **sí** | OPERATIVE_WITH_LIMITATIONS |
| `brave_web` | WEB | `BRAVE_API_KEY` | sí | **sí** | OPERATIVE_WITH_LIMITATIONS |
| `serpapi_google` | WEB | `SERPAPI_API_KEY` | sí | **sí** | OPERATIVE_WITH_LIMITATIONS |
| `gdelt_doc` | NEWS | no | sí | **sí** | **UNKNOWN** |
| `ddg_web` | WEB | no | sí | mesh | **CONFIGURED_NOT_USED** |
| `google_news_rss` | NEWS | no | sí | **no** | **IMPLEMENTED_NOT_WIRED** |
| `instagram_graph` | SOCIAL_KNOWN | `INSTAGRAM_ACCESS_TOKEN` | sí | **no** | **IMPLEMENTED_NOT_WIRED** |
| `tiktok_adapter` | SOCIAL_KNOWN | no | sí | **no** | **IMPLEMENTED_NOT_WIRED** |
| `scrapecreators` | SOCIAL_KNOWN | `SCRAPECREATORS_API_KEY` | sí | mesh | **KNOWN_ACCOUNT_ONLY** |
| `google_cse` | WEB | falta `GOOGLE_CSE_ID` | no | no | NOT_IMPLEMENTED |
| `reddit` · `threads` · `telegram` | SOCIAL_OPEN | — | no | no | NOT_IMPLEMENTED |
| `google_trends` | SEARCH_INTEREST | — | no | no | NOT_IMPLEMENTED |

Resumen: **1 OPERATIVE · 4 OPERATIVE_WITH_LIMITATIONS · 1 UNKNOWN · 1 CONFIGURED_NOT_USED · 3 IMPLEMENTED_NOT_WIRED · 1 KNOWN_ACCOUNT_ONLY · 5 NOT_IMPLEMENTED.**

**«Existe el fichero» no significa «está operativo».** Cinco motores tienen código —tres con credencial presente— y no están conectados al flujo territorial. Esa es la columna que incomoda y por eso existe.

Credenciales presentes (presencia y longitud, nunca valores): `YOUTUBE_API_KEY` 39 · `X_BEARER_TOKEN` 116 · `BRAVE_API_KEY` 31 · `SERPAPI_API_KEY` 64 · `SCRAPECREATORS_API_KEY` 28 · `META_APP_ID` 16 · `META_APP_SECRET` 32 · **`FACEBOOK_USER_ACCESS_TOKEN` 212** · **`INSTAGRAM_ACCESS_TOKEN` 186** · `GOOGLE_API_KEY` 39.
Ausentes: `GOOGLE_CSE_ID` · `DATA365_API_KEY` · `APIFY_TOKEN` · `REDDIT_CLIENT_ID` · `TELEGRAM_BOT_TOKEN` · `GOOGLE_TRENDS_KEY`.

---

## 2. Aporte real al corpus — desde el ledger

Corpus del proyecto: **619**. Observaciones en el libro: 1 689. **Legado sin `projectId`: 145.**

| Proveedor | n | fuentes | actores | con fecha | sin fecha | CORR | PROB | AMB | FUERA | NO_RES |
|---|---|---|---|---|---|---|---|---|---|---|
| `rss_directo` | **373** | 20 | 20 | 373 | 0 | 121 | 12 | 12 | 1 | **225** |
| `x_api` | 143 | **74** | **74** | 143 | 0 | **70** | 0 | 24 | 13 | 36 |
| `youtube_data` | 83 | 29 | 29 | 83 | 0 | 43 | 1 | 17 | 0 | 22 |
| `brave_web` | 20 | 15 | 15 | 6 | **14** | 15 | 1 | 3 | 0 | 1 |

Naturaleza: `rss_directo` MEDIA 285 · INST 78 · ACAD 10. `x_api` **CONV 143** (todas). `youtube_data` OTHER 83 (todas). `brave_web` SEARCH 11 · INST 6 · MEDIA 3.

**El contraste que decide la lectura:** RSS trae 373 piezas de **20 fuentes** y 225 son `NO_RESOLUBLE`; X trae 143 de **74 fuentes** y 70 corroboradas. Volumen y cobertura no son lo mismo.

### Aporte incremental

**`NOT_RECONSTRUCTABLE`** para los tres primeros gates: el ledger registra `providers[]` por evidencia pero no el estado del corpus en el instante de cada inserción, y las pasadas de los gates 1–3 no dejaron instantánea. Lo que **sí** consta:

- **Ninguna evidencia del corpus tiene más de un proveedor** (0 compartidas de 619). No significa que no haya contenido duplicado: significa que dos proveedores nunca produjeron el mismo `evidenceId`, porque cada uno vive en su propio espacio de identificadores.
- Medido en el gate del mesh: **X tuvo 52 % de solapamiento** con el corpus previo (13 de 25 ya conocidas); búsqueda y YouTube, 0 %.
- Medido en persistencia: 60 piezas de entrada → 40 insertadas, 20 deduplicadas.
- Medido en descubrimiento local: 47 → 36 insertadas, 11 deduplicadas; y El Nuevo Tiempo 10 → 10 insertadas, 0 duplicadas.

### Legado

`google_news` 114 · `rss_directo` 20 · `youtube_data` 6 · `x_api` 5 = 145 evidencias sin `projectId`, **fuera de todo cómputo del proyecto** por diseño.

---

## 3. Matriz social — la tabla que decide el siguiente gate

| Capacidad | X | YouTube | Facebook | Instagram | TikTok |
|---|---|---|---|---|---|
| `OPEN_KEYWORD_DISCOVERY` | **OPER·LIM** | **OPER·LIM** | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| `OPEN_TOPIC_DISCOVERY` | **OPER·LIM** | **OPER·LIM** | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| `HASHTAG_DISCOVERY` | **OPER·LIM** | UNKNOWN | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| `KNOWN_ACCOUNT_PROFILE` | **OPERATIVE** | **OPERATIVE** | **OPERATIVE** | BLOCKED_PROVIDER | **OPERATIVE** |
| `KNOWN_ACCOUNT_CONTENT` | **OPER·LIM** | **OPERATIVE** | **OPERATIVE** | BLOCKED_PROVIDER | **OPERATIVE** |
| `COMMENTS` | UNSUPPORTED | NOT_IMPLEMENTED | UNKNOWN | UNKNOWN | UNKNOWN |
| `SEARCH_BY_DATE` | **OPER·LIM** | **OPERATIVE** | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| `HISTORICAL_DEPTH` | BLOCKED_PERMISSION | **OPER·LIM** | **OPER·LIM** | UNKNOWN | **OPER·LIM** |
| `PAGINATION` | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `CANONICAL_URL` | **OPERATIVE** | **OPERATIVE** | **OPERATIVE** | UNKNOWN | **OPERATIVE** |
| `AUTHOR_ACTOR` | **OPERATIVE** | **OPERATIVE** | **OPERATIVE** | UNKNOWN | **OPERATIVE** |
| `PUBLISHED_AT` | **OPERATIVE** | **OPERATIVE** | UNKNOWN | UNKNOWN | UNKNOWN |
| `PUBLIC_METRICS` | **OPER·LIM** | **OPER·LIM** | UNKNOWN | UNKNOWN | UNKNOWN |
| `GEO_SIGNAL` | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| `LANGUAGE_SIGNAL` | **OPERATIVE** | **OPER·LIM** | UNKNOWN | UNKNOWN | UNKNOWN |
| `RAW_TEXT` | **OPERATIVE** | **OPER·LIM** | **OPERATIVE** | UNKNOWN | **OPER·LIM** |
| `EVIDENCE_PROVENANCE` | **OPERATIVE** | **OPERATIVE** | **OPER·LIM** | UNKNOWN | **OPER·LIM** |

| | X | YouTube | Facebook | Instagram | TikTok |
|---|---|---|---|---|---|
| Descubrimiento cubierto | **3/3** | **2/3** | **0/3** | **0/3** | **0/3** |
| Observación cubierta | 2/3 | 2/3 | 2/3 | **0/3** | 2/3 |
| Capacidades cubiertas | 13/17 | 13/17 | 7/17 | **0/17** | 7/17 |
| `UNKNOWN` | 1 | 2 | 5 | **10** | 5 |
| **Permite escucha abierta** | **sí** | **sí** | **no** | **no** | **no** |

**Solo 2 de 5 plataformas sociales permiten escucha abierta.** `GEO_SIGNAL` es `UNSUPPORTED` en las cinco: ninguna plataforma nos da ubicación, y por eso el territorio se resuelve por el texto. `PAGINATION` es `UNKNOWN` en las cinco: nunca se ejercitó.

Cada celda lleva su razón escrita. Hay prueba de que ninguna razón puede ser una palabra sola — cuatro celdas tenían «Sin geo.» y las pruebas las rechazaron.

---

## 4. Ausencia no es cero — regla de producto

Lo que se dice:

> `TikTok · OPEN_KEYWORD_DISCOVERY = UNSUPPORTED` con los conectores actuales: la superficie pública disponible no ofrece esta capacidad.

Lo que **nunca** se dice:

> «0 conversación en TikTok» — sería una afirmación sobre el territorio, no sobre nuestra instrumentación.

La función `redactarAusencia` produce las dos formulaciones a la vez para que la correcta esté siempre a mano. Y **`UNKNOWN` no se convierte en `UNSUPPORTED`**: no haber comprobado algo no es haber comprobado que no funciona.

---

## 5. Discovery vs Observation

```
DISCOVERY     encontrar actores y contenidos que todavía NO conocemos
OBSERVATION   medir una cuenta o URL que YA conocemos
```

Candidate demostró que la observación de cuentas conocidas funciona en Facebook, Instagram y TikTok. **Eso no significa que Territorial pueda descubrir conversación en esas plataformas.** Viven en filas separadas de la matriz y hay prueba que lo fija.

---

## 6. Estados que merecen explicación

### GDELT = `UNKNOWN`

Implementado, sin credencial necesaria, **cableado al colector con presupuesto 2 por pasada** — y **0 evidencias en el proyecto y 0 en el legado**.

Sin salir a la red no se puede distinguir «nunca se llegó a llamar» de «respondió vacío» o «el error se silenció»: **`NOT_RECONSTRUCTABLE`**. Por eso `UNKNOWN` y no `UNSUPPORTED`, y por eso **no cuenta entre los operativos**: un motor que no ha aportado nada en toda la historia del proyecto no cubre nada.

Su propio diagnóstico declara además que **no devuelve extracto** —solo titular, dominio, idioma y fecha—, lo que daría mucho menos texto al motor de temas.

### Google News = `IMPLEMENTED_NOT_WIRED`

Implementado en `googleNewsService.js` **sobre el feed RSS de `news.google.com`**. Produjo **114 evidencias en el legado sin `projectId`**. Ningún fichero de `territorial/`, `ingest/` ni `routes/` lo importa. Su producción histórica quedó fuera del proyecto.

### ScrapeCreators = `KNOWN_ACCOUNT_ONLY`

**12 endpoints** —perfil, publicaciones, publicación, comentarios, respuestas— en las tres plataformas. **Todos piden `url` o `handle`.** Y `CAPACIDADES_POR_PLATAFORMA` no contiene ninguna capacidad de búsqueda, hashtag ni discovery: **comprobado programáticamente, devuelve `false`**.

Medido: Facebook 6 publicaciones y TikTok 10 con 3 créditos; **Instagram 0 en 7 intentos** con `internal_server_error` consistente y 0 créditos cobrados. **0 evidencias persistidas**: lo observado en los benchmarks nunca se ingirió al corpus.

### Reddit · Threads · Telegram · Google Trends = `NOT_IMPLEMENTED`

Solo aparecen en contratos y en el registro de familias futuras. Sin conector, sin credencial. Su utilidad para Cuenca **no se asume**. Telegram, cuando llegue, solo canales públicos con acceso legítimo — grupos privados quedan fuera por decisión, no por dificultad. **Google Trends representaría `SEARCH_INTEREST`, no `PUBLIC_CONVERSATION`**, y sus valores no se pueden mezclar con evidencia social.

---

## 7. Cobertura por familia — el criterio no es volumen

| Familia | Nivel | Por qué |
|---|---|---|
| `INSTITUTIONS` | **GOOD** | 9 entidades con dominio institucional inequívoco y feeds legibles. La mejor cubierta. |
| `WEB` | PARTIAL | Brave y SerpAPI con descubrimiento abierto, pero 20 evidencias y 14 sin fecha. DDG sin usar. |
| `NEWS` | PARTIAL | 373 piezas de **solo 20 fuentes** y 225 `NO_RESOLUBLE`. GDELT en 0, Google News sin cablear. |
| `SOCIAL_OPEN` | PARTIAL | Solo X y YouTube: 226 evidencias de 103 fuentes. **3 de 5 plataformas sin descubrimiento.** |
| `SOCIAL_KNOWN_ACCOUNT` | PARTIAL | Facebook y TikTok demostrados (16 piezas), Instagram bloqueada. **0 ingeridas.** |
| `LOCAL_MEDIA` | PARTIAL | 4 entidades: 3 corroboradas y 1 probable, en una ciudad con más medios. |
| `UNIVERSITIES` | PARTIAL | 3 entidades, pero solo 1 publica feed legible y aportó 10 piezas con 0 corroboradas. |
| `PUBLIC_CONVERSATION` | PARTIAL | 143 evidencias de 74 emisores, **todas de X**. Una sola plataforma. |
| `ORGANIZATIONS` | **INSUFFICIENT** | **0 entidades.** Causa medida: renderizado en cliente, ratio texto/HTML 2,2 %. |
| `COMMUNITIES` | **INSUFFICIENT** | **0 entidades.** No se reclasificó ninguna institución para que dejara de ser cero. |
| `SEARCH_INTEREST` | **UNAVAILABLE** | Sin fuente legítima de volumen de búsquedas. |

Resumen: 1 GOOD · 7 PARTIAL · 2 INSUFFICIENT · 1 UNAVAILABLE.

**`INSTITUTIONS` es GOOD con muchas menos piezas que `NEWS`**, que es PARTIAL. Eso es intencionado: el nivel se basa en diversidad de fuentes y actores, plataformas disponibles, capacidad de descubrimiento y sesgos conocidos — no en volumen. Hay prueba.

Y `INSUFFICIENT` no significa que el territorio no tenga esas fuentes: **significa que no podemos corroborarlas con la instrumentación actual.**

---

## 8. Huecos priorizados

| ID | Hueco | Impacto | Dato que lo justifica |
|---|---|---|---|
| **GAP-01** | Descubrimiento abierto en Facebook, Instagram y TikTok | **ALTO** | 3 de 5 plataformas sin ninguna capacidad de descubrimiento; 12 endpoints y ninguno acepta consulta |
| **GAP-02** | Conversación pública en una sola plataforma | **ALTO** | 143 de 143 `PUBLIC_CONVERSATION` vienen de `x_api`; YouTube aporta 83 y las 83 quedan en `OTHER` |
| **GAP-03** | Organizaciones locales sin corroborar | **ALTO** | 0 entidades; ratio texto/HTML del 2,2 % al 3,2 % |
| **GAP-04** | Comunidades sin corroborar | **ALTO** | 0 entidades tras dos gates de expansión dirigida |
| **GAP-05** | GDELT cableado y sin producir | MEDIO | Presupuesto 2/pasada, 0 evidencias acumuladas |
| **GAP-06** | Google News implementado y no cableado | MEDIO | 114 evidencias en el legado, 0 importaciones |
| **GAP-07** | Comentarios como capacidad no ejercitada | MEDIO | Endpoints declarados en 3 plataformas, nunca llamados desde Territorial |
| **GAP-08** | Fecha editorial en resultados de búsqueda | BAJO | 14 de 20 de Brave sin `publishedAt` |
| **GAP-09** | DuckDuckGo configurado y sin usar | BAJO | 0 consultas en gates territoriales |

**GAP-05, GAP-06, GAP-07 y GAP-09 no necesitan proveedor nuevo: son capacidad ya construida y sin activar.**

---

## 9. Contrato de cobertura

```js
sourceCoverage = {
  family, platform, provider, capability, status,
  esCoberturaReal, esDescubrimiento,
  evidenceCount, uniqueSources, uniqueActors, temporalCoverage,
  limitations[], evidenceRefs[] /* máx. 25: índice, no almacén */,
  lastVerifiedAt, projectId, tenantId, methodVersion,
  ausencia { formulacionCorrecta, formulacionProhibida },
  declaracion /* no describe población */
}
```

Project-scoped. `evidenceRefs` guarda **referencias, no copias**: la evidencia vive en el ledger.

## 10. Tema × Cobertura — diseñado, no implementado

`coberturaDeTema(tema, aporte)` devuelve `coverageStatus`, `missingCapabilities` y las dos formulaciones:

- permitida: *«actividad observable en las fuentes cubiertas por Sentinel para este tema»*
- prohibida: *«tema viral en Cuenca»*

Verificado: el tema del intercambiador (11 piezas, 9 fuentes, 3 proveedores) sale **GOOD**; el de Farmasol (10 piezas, **1 fuente**) sale **INSUFFICIENT**. Y ambos declaran que Facebook, Instagram y TikTok quedan sin observar, así que el tema podría tener actividad no observable.

---

## 11. Requisitos para un proveedor candidato

**Obligatorios:** al menos una de Facebook/Instagram/TikTok · **búsqueda por palabra clave o tema con endpoint documentado, no solo por perfil** · búsqueda por hashtag · URL canónica · autor identificable · `publishedAt` real cuando exista y declarado ausente cuando no · paginación · filtro por idioma o región · **disponibilidad en Ecuador verificada, no declarada** · límites de tasa explícitos · modelo de coste explícito · términos y cumplimiento revisables.

**Deseables:** métricas públicas · comentarios cuando sea lícito · profundidad histórica más allá de 7 días · precisión a nivel Cuenca · retención compatible con un ledger append-only.

**Criterio de rechazo:** *known-account-only NO cumple el requisito. Es exactamente lo que ya tenemos, y es lo que produjo cero descubrimiento en tres plataformas.*

**Cómo se mide:** con una consulta real por palabra clave en al menos una plataforma, contando piezas nuevas, actores nuevos y territorialmente corroborables. **Un folleto no cuenta como evidencia.**

**Categorías a investigar:** APIs de social listening · proveedores de datos de plataforma · APIs oficiales · proveedores de búsqueda e índice · proveedores de noticias y eventos.

**Candidatos conocidos** — marcados `KNOWN_CANDIDATE`, **ninguno recomendado**: ScrapeCreators (medido para cuenta conocida, sin discovery) · Data365 (requiere llamada comercial) · SocialCrawl (autoservicio sin probar) · Bright Data (bloqueado por el proveedor) · EnsembleData (descartado).

---

## 12. Pruebas y regresiones

`territorial-coverage-matrix`: **30 pruebas, 0 fallos**, cubriendo A–V. Cero red.

Protegen las cuatro confusiones que han sido errores reales en este proyecto: *existe ≠ operativo* (B) · *cuenta conocida ≠ descubrimiento abierto* (C) · *no soportado ≠ cero* (D) · *cobertura de fuentes ≠ cobertura de población* (T).

**Batería territorial: 951 pruebas, 0 fallos.** Candidate: `socialProviders` 36, `xReal` 37, `candidateIntelligence` 100, `accountIntelligence` 36 — verdes. Media: `mediaPiece` 42, `mediaTime` 29, `mediaHome` 41, `mediaSourceUniverse` 33 — verdes.

`npm run build` correcto. `npm run lint`: 6 errores **preexistentes y ajenos** en `Dashboard.jsx` y `KnowledgeGraph.jsx`, sin tocar.

**Un error propio, corregido:** clasifiqué `gdelt_doc` como `OPERATIVE_WITH_LIMITATIONS` pese a tener 0 evidencias en toda la historia del proyecto. Un motor que no ha aportado nada no cubre nada, y sin red no se puede saber por qué: pasó a `UNKNOWN`, que es lo que el propio gate exige no convertir en `UNSUPPORTED`. Y cuatro celdas tenían razones de una palabra («Sin geo.»): las pruebas las rechazaron y se ampliaron.

**Aislamiento:** la celda de cobertura es project-scoped y el ledger sigue devolviendo 0 para un proyecto inexistente.

---

## 13. Las siete preguntas

**1. ¿Qué ve Sentinel bien hoy?** Instituciones locales — 9 entidades con dominio inequívoco y feeds legibles. Es la única familia `GOOD`. Y la conversación pública de X: 74 emisores distintos, 100 % con fecha, 70 corroboradas.

**2. ¿Qué ve parcialmente?** Siete familias. Noticias con mucho volumen y poca diversidad (20 fuentes). Web con descubrimiento pero sin fechas. Medios locales con 4 entidades. Universidades con 3 entidades y 1 feed. Cuenta conocida en Facebook y TikTok, demostrada pero **sin ingerir**.

**3. ¿Qué no puede descubrir?** Facebook, Instagram y TikTok: **0 de 3 capacidades de descubrimiento** en cada una. Organizaciones y comunidades locales. Interés de búsqueda. Reddit, Threads, Telegram.

**4. ¿Dónde depende de cuentas conocidas?** En las tres plataformas donde ScrapeCreators es el único acceso. Todo el contenido de Facebook y TikTok llega porque **otra fuente identificó antes al actor**.

**5. ¿Qué plataformas sociales son el mayor hueco?** **Facebook, Instagram y TikTok**, en ese orden de esfuerzo. Instagram es el caso extremo: **0 de 17 capacidades cubiertas y 10 `UNKNOWN`** porque falla antes de poder medir nada.

**6. ¿Qué motor aporta contenido único?** Los cuatro aportan exclusivamente —ninguna evidencia tiene dos proveedores— pero en calidad distinta: **X aporta la única conversación pública** (143 de 143) y la mayor diversidad (74 fuentes); **RSS aporta el volumen** (373) con la menor diversidad (20 fuentes) y el mayor desperdicio (225 no resolubles); YouTube aporta 29 canales con naturaleza indeterminada; Brave aporta 15 dominios nuevos pero 14 sin fecha.

**7. ¿Qué motores investigar primero?** Ninguno externo todavía. **Primero activar lo que ya existe:** diagnosticar GDELT (cableado y en 0), cablear Google News (114 piezas históricas), ejercitar comentarios (endpoints declarados y nunca llamados), activar DuckDuckGo. Después, y solo después, evaluar un proveedor con descubrimiento abierto real.

---

## 14. Veredictos

| | |
|---|---|
| `WEB_COLLECTION_COVERAGE` | **PARTIAL** |
| `NEWS_COLLECTION_COVERAGE` | **PARTIAL** |
| `OPEN_SOCIAL_COLLECTION_COVERAGE` | **PARTIAL** |
| `KNOWN_ACCOUNT_SOCIAL_COVERAGE` | **PARTIAL** |
| `LOCAL_MEDIA_COVERAGE` | **PARTIAL** |
| `LOCAL_ORGANIZATION_COVERAGE` | **INSUFFICIENT** |
| `LOCAL_COMMUNITY_COVERAGE` | **INSUFFICIENT** |
| `PUBLIC_CONVERSATION_COLLECTION_COVERAGE` | **PARTIAL** |
| `NEW_PROVIDER_EVALUATION_REQUIRED` | **YES** |

`OPEN_SOCIAL_COLLECTION_COVERAGE = PARTIAL` y no `INSUFFICIENT` porque X y YouTube funcionan de verdad y aportan 226 evidencias de 103 fuentes. Pero son 2 de 5 plataformas, y la conversación pública depende de una sola.

`PUBLIC_CONVERSATION_COLLECTION_COVERAGE = PARTIAL`: 74 emisores distintos es diversidad real, pero **un único punto de fallo y un único sesgo de plataforma**.

`NEW_PROVIDER_EVALUATION_REQUIRED = YES` — con una condición: los requisitos de la sección 11 son el criterio, y **cuatro de los nueve huecos no necesitan proveedor alguno**.

---

## 15. Siguiente recomendación exacta

**`TERRITORIAL-OPEN-SOCIAL-COVERAGE-04`**, con este orden y esta justificación:

1. **Primero los cuatro huecos gratuitos** (GAP-05, GAP-06, GAP-07, GAP-09): diagnosticar GDELT, cablear Google News, ejercitar comentarios en Facebook y TikTok, activar DuckDuckGo. Es capacidad ya construida y sin activar, y el hueco de conversación pública podría reducirse con los comentarios de activos que ya observamos.
2. **Después** evaluar proveedores contra los requisitos de la sección 11, midiendo con una consulta real y no con documentación.
3. **Nunca** aceptar known-account-only como respuesta a GAP-01: es lo que ya tenemos.

**STOP.** No se investiga ningún proveedor. No se conecta ninguna API. No se recolecta. No se inicia Trend Radar, ni Candidate, ni Media, ni Sentinel AI. Se espera revisión humana.
