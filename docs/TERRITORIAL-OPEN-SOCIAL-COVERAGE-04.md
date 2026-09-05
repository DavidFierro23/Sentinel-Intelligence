# TERRITORIAL-OPEN-SOCIAL-COVERAGE-04

**Ampliación real de la escucha y el descubrimiento — Cuenca 2027**

Terminal 2 · Territorial Intelligence
Base: `98fe015` — TERRITORIAL-SOURCE-COVERAGE-MATRIX-01
Ejecutado: 2026-09-05

---

## El resultado que cambia el mapa

> **TikTok SÍ permite descubrimiento abierto por palabra clave, con el proveedor y las credenciales que ya teníamos.**

El veredicto anterior —`KNOWN_ACCOUNT_ONLY`— era **correcto sobre nuestra integración y falso sobre las capacidades actuales del proveedor**. La documentación de ScrapeCreators en 2026 expone búsqueda por keyword y hashtag en TikTok, Instagram, YouTube, Reddit, Threads, Bluesky, Pinterest y LinkedIn. Nuestro `externalSocialProvider.js` solo declaraba 12 endpoints por handle/URL.

Comprobado con una llamada real: **30 resultados, 26 autores nuevos, 100 % con fecha, URL canónica y métricas, 27 de 30 territorialmente corroborados, 1 crédito.**

Y un detalle que solo aparece probando: **la documentación se equivoca en el nombre del parámetro.** Dice `keyword`; el real es `query`. Con `keyword` devuelve `HTTP 400 missing_parameter` y cobra 0.

---

## 1. Baseline BEFORE

| | |
|---|---|
| Corpus | **619** |
| con fecha / sin fecha | 605 / 14 |
| CORROBORADO / PROBABLE | 249 / 14 |
| AMBIGUO / FUERA / NO_RESOLUBLE | 56 / 14 / 284 |
| PUBLIC_CONVERSATION | 143 |
| MEDIA / INSTITUTIONAL / SEARCH_RESULT / OTHER | 288 / 84 / 11 / 83 |
| Dominios / actores únicos | 133 / 138 |
| Local corroborada / nacional | 145 / 212 |
| Organizaciones / comunidades / medios locales | **0 / 0 / 3** |
| RSS share | **60,3 %** |
| PRIMARY / EXPANDED / temas | 239 / 253 / **37** |
| Proveedores | 4 |

---

## 2. FASE A1 · GDELT — diagnóstico resuelto

Estado previo: `UNKNOWN`, 0 evidencias en toda la historia del proyecto.

**5 consultas controladas, progresivas de estrecha a amplia:**

| Prueba | Estado | Resultados |
|---|---|---|
| como el colector (con ventana 7d) | **LIMITE_DE_TASA** HTTP 429 | 0 |
| sin ventana | **OK** | **29 válidas, 11 dominios, 29/29 con fecha, 29/29 con URL canónica** |
| `Azuay` | LIMITE_DE_TASA | 0 |
| control amplio `Ecuador` | LIMITE_DE_TASA | 0 |
| frase exacta | LIMITE_DE_TASA | 0 |

**Causa: (C) responde vacío por rate-limiting, no (D) contrato roto ni (G) proveedor inútil.** GDELT devuelve HTTP 429 en 4 de 5 llamadas seguidas, y la que pasa trae evidencia de buena calidad. El presupuesto del colector es 2 consultas por pasada disparadas una detrás de otra: la segunda casi siempre moría, y **el 429 se registraba como «sin resultados»** sin que nadie lo notara. De ahí el cero acumulado.

**Cableado corregido** en el propio adaptador, no en el colector, para que cualquier llamador se beneficie sin acordarse:
- espaciado mínimo de 5 s entre llamadas
- **un** reintento ante 429
- y si vuelve a fallar, `aviso: "LIMITE_DE_TASA no significa que no haya contenido. No contar esto como cero."`

**Error propio declarado:** mi script diagnóstico no retuvo los cuerpos de las 29 evidencias, y el presupuesto de GDELT quedó agotado. Están **medidas y no persistidas**. La ingestión ocurrirá en la próxima pasada, ya con espaciado.

---

## 3. FASE A2 · Google News — cableado

Estado previo: `IMPLEMENTED_NOT_WIRED`, 114 evidencias en el legado sin `projectId`.

5 consultas, **40 items** (8 por consulta), 100 % con fecha.

**El problema que había que resolver:** su enlace es un **redirector `news.google.com/rss/articles/CB…`**, no la URL del medio. El dominio real está en el sufijo del titular (`… - elmercurio.com.ec`), que es donde el feed lo publica. Se toma de ahí —evidencia presente en el dato, no invención— y la evidencia viaja con `avisoCanonical` diciendo que la URL es de un agregador.

| | |
|---|---|
| Requests | 5 |
| Raw / válidas / únicas | 40 / 40 / 39 |
| **Nuevas** | **39** |
| Fuentes nuevas | 6 (1 local: `eldigitaldecuenca.com`) |
| Con fecha | **100 %** |
| CORROBORADO / PROBABLE / AMBIGUO / NO_RES | 16 / 4 / 16 / 3 |
| **INCREMENTAL_YIELD** | **0,975** |

Dominios nuevos: `lahora.com.ec`, `eldigitaldecuenca.com`, `eltelegrafo.com.ec`, `ecuavisa.com`, `laprensa.com.ec`, **`lmneuquen.com`** — este último es Neuquén, Argentina: la ambigüedad de «Cuenca» reaparece, y el resolutor lo deja en AMBIGUO.

Entra por el ledger canónico. **No se creó un segundo store.**

---

## 4. FASE A3 · DuckDuckGo

Estado previo: `CONFIGURED_NOT_USED`, 0 evidencias.

5 consultas con el intervalo obligatorio de 3,6 s. **50 items, todas OK.**

| | |
|---|---|
| Requests | 5 |
| Raw / únicas | 50 / 49 |
| **Nuevas** | **48** |
| **Fuentes nuevas** | **23** (4 locales) |
| **Con fecha** | **0 %** |
| CORROBORADO / PROBABLE / AMBIGUO | 39 / 4 / 6 |
| **INCREMENTAL_YIELD** | **0,96** |

**Aporta diversidad de fuentes como ningún otro motor: 23 dominios nuevos con 5 requests.** Y tiene el peor déficit temporal del corpus: **ninguna de sus 48 piezas trae fecha editorial**, así que las 48 quedan fuera de las cinco ventanas. `undated` pasó de 14 a 62.

Ruido real en sus dominios: `cuenca.es` (¡España!), `tripadvisor.com`, `mapcarta.com`, `facebook.com`, `instagram.com`, `youtube.com`. El contenido menciona Cuenca+Azuay —de ahí los 39 corroborados— pero las fuentes no son locales. Es la separación `SOURCE_LOCALITY ≠ CONTENT_TERRITORIALITY` funcionando.

**Veredicto: `USEFUL`** por diversidad de descubrimiento, con la limitación temporal declarada.

---

## 5. FASE A4 · Comentarios — y el defecto que salió buscándolos

**Auditoría:** ni `xAdapter` ni `youtubeAdapter` exponen comentarios. ScrapeCreators sí los declara en las tres plataformas. `X · COMMENTS = UNSUPPORTED`; `YouTube · COMMENTS = NOT_IMPLEMENTED` — la API los ofrece, nuestro adaptador no.

Intenté una prueba mínima de viabilidad sobre un vídeo ya observado, y ahí apareció el hallazgo:

> **Las 83 URLs canónicas de YouTube del corpus son enlaces muertos.**

`commentThreads` devolvió `videoNotFound`. Causa: `textUtils.js:326`, `normalizarUrl` devuelve **toda** la URL en minúsculas:

```js
return `${host}${ruta}${parametros ? `?${parametros}` : ""}`.toLowerCase();
```

Bajar el **host** es correcto —DNS no distingue mayúsculas—. Bajar **ruta y query** viola RFC 3986 y destruye identificadores sensibles a mayúsculas. Medido:

| | |
|---|---|
| YouTube con `canonicalUrl` | 83 |
| **con el ID todo en minúsculas** | **83 de 83** |
| X con `status/` numérico | 143 (no afectados) |
| Otras URLs con segmento alfanumérico largo | 47 candidatas |

**No se corrigió `textUtils.js` en este gate.** Es infraestructura compartida por Media, Candidate y conversation, y cambiar la normalización cambiaría las claves de deduplicación de todo el sistema, con riesgo de reinserción masiva. Queda declarado como **`SHARED_URL_CASE_DEBT`**, con el mismo criterio que `SHARED_GEO_CONTEXT_DEBT`.

**Consecuencia:** `COMMENTS_COLLECTION = NOT_READY`, y el motivo no es «no lo implementamos» sino «las URLs persistidas no resuelven a contenido de plataforma».

---

## 6. FASE C · Investigación de proveedores (2026)

### TikTok

**Research API oficial:** query por keyword y hashtag existe, pero el acceso está **restringido a investigadores académicos y ONG aprobadas; las solicitudes comerciales se rechazan** típicamente. En 2026 se amplió con Creator Search Insights y analítica de hashtags.

**Terceros con keyword/hashtag search:** ScrapeCreators, Phyllo, KeyAPI, SocQ, EnsembleData, SociaVault, TikLiveAPI.

→ **`TIKTOK_OPEN_DISCOVERY = AVAILABLE`**, vía proveedor ya contratado.

### Instagram

**Oficial:** Hashtag Search existe en la Graph API pero exige cuenta Business/Creator, App Review con verificación de negocio y demo, y está **limitada a 30 hashtags únicos por 7 días**. Las cuentas personales no tienen acceso alguno.

**Terceros:** ScrapeCreators declara búsqueda de hashtag y perfil, Search Reels y Trending Reels. EnsembleData desde ~200 $/mes por 5 000 unidades/día. Apify Instagram Hashtag Scraper.

→ **`INSTAGRAM_OPEN_DISCOVERY = PROVIDER_REQUIRED`**: la capacidad existe en el proveedor que ya tenemos, pero **no la he demostrado** — mi ruta de endpoint era inventada y devolvió 404 con 0 créditos. Falta la ruta correcta de la documentación.

### Facebook

**CrowdTangle cerró el 14 de agosto de 2024.** Su reemplazo es la **Meta Content Library**, que **sí busca posts públicos por palabra clave en Facebook, Instagram y Threads en casi tiempo real** — pero es de acceso controlado, exige verificación institucional vía **ICPSR** y está **restringida a investigadores académicos y sin ánimo de lucro, lo que excluye a medios y a uso comercial**. En 2026 Meta deprecó más métricas de Page Insights.

→ **`FACEBOOK_OPEN_DISCOVERY = PROVIDER_REQUIRED`**. La vía oficial existe y **no nos es accesible**: Sentinel es una plataforma comercial de inteligencia política. Queda la vía de terceros (ScrapeCreators declara búsqueda de anunciantes/empresas; Apify tiene un scraper de búsqueda de posts; Data365).

### Otras plataformas

| | Estado | Nota |
|---|---|---|
| **Threads** | `PROVIDER_REQUIRED` | Cubierto por Meta Content Library (inaccesible) y declarado por ScrapeCreators. Sin conector propio. **No se conecta por moda.** |
| **Reddit** | `PROVIDER_REQUIRED` · utilidad local sin medir | ScrapeCreators declara keyword search. Volumen para Cuenca **no medido**: no se conecta solo porque sea fácil. |
| **Telegram** | `NOT_IMPLEMENTED` | Solo canales y contenido público con acceso legítimo. **Grupos privados fuera por decisión**, no por dificultad. |
| **Google Trends** | `NOT_IMPLEMENTED` · familia aparte | Representaría `SEARCH_INTEREST`, nunca `PUBLIC_CONVERSATION`. Sus valores no se mezclan con posts, noticias ni comentarios. |

### ScrapeCreators — reverificado (§13)

**Ya no es cierto que sea known-account-only.** Su documentación actual declara:

- **TikTok:** Search Users, Search by Hashtag, **Search by Keyword**, Top Search, popular creators, descubrimiento por canción
- **Instagram:** búsqueda de hashtag y perfil, Search Reels, Trending Reels, descubrimiento por audio
- **YouTube:** búsqueda general con typeahead, descubrimiento por hashtag, Trending Shorts
- **Reddit, Twitter, Threads, Bluesky, Pinterest, LinkedIn, Rumble:** keyword search
- Facebook: búsqueda de anunciantes y empresas

Sin límites de tasa declarados (recomiendan <500 concurrentes), modelo de créditos con endpoint de saldo. **1 crédito por request** en el endpoint probado.

→ **`RECOMMENDED_CONNECT`** para TikTok keyword discovery. Ya está contratado, tiene créditos y la capacidad está demostrada.

---

## 7. FASE D · Benchmark de proveedores

| Provider | Req | Créditos | Raw | Válidas | Nuevas | Fuentes | Actores | Local | Con fecha | Dup | Open discovery | Coste | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `google_news` | 5 | 0 | 40 | 40 | **39** | 6 nuevas | 6 | 1 local | **100 %** | 2,5 % | sí (news) | $0 | **RECOMMENDED_CONNECT** |
| `ddg_web` | 5 | 0 | 50 | 50 | **48** | **23 nuevas** | 23 | 4 locales | **0 %** | 2 % | sí (web) | $0 | **USEFUL_SECONDARY** |
| `gdelt_doc` | 5 | 0 | 29 (1 de 5) | 29 | N/A · no retenidas | 11 | N/A | N/A | **100 %** | N/A | sí (news) | $0 | **RECOMMENDED_BENCHMARK_MORE** |
| **`scrapecreators_tiktok`** | 2 | **1 cobrado** | 30 | 30 | **30** | 26 autores | **26 nuevos** | N/A | **100 %** | 0 % | **DEMOSTRADO** | 1 créd. | **RECOMMENDED_CONNECT** |
| `scrapecreators_instagram` | 1 | **0** | 0 | 0 | 0 | 0 | 0 | — | — | — | **NO_DEMOSTRADO** (404, ruta mía errónea) | $0 | **RECOMMENDED_BENCHMARK_MORE** |
| `brave_web` | 0 | 0 | — | — | — | — | — | — | — | — | sí | $0 | ya operativo |
| `serpapi_google` | 0 | 0 | — | — | — | — | — | — | — | — | sí | 756/1000 | ya operativo |

**Créditos ScrapeCreators:** `CREDITS_BEFORE = 51` · `CREDITS_USED = 2` · `CREDITS_REMAINING = 49` — **verificable**, el proveedor lo devuelve en cada respuesta. Las llamadas fallidas cobraron **0**.
Otros proveedores: **`NO_VERIFICABLE`** salvo SerpAPI (756/1000, sin usar).

**Coste monetario adicional del gate: $0.** No se compró nada, no se activó ningún plan.

### Lo que dice el benchmark, no el volumen

DDG trae **más** resultados que Google News (50 vs 40) y **más** fuentes nuevas (23 vs 6). Pero **0 % con fecha** frente a **100 %**. Para un corpus que alimenta ventanas temporales, Google News aporta señal utilizable y DDG aporta descubrimiento de fuentes. Son valores distintos y ninguno domina.

Y TikTok con **2 requests** y **1 crédito** trajo **26 actores nuevos** —la mayor incorporación de actores por petición de todo el proyecto— con `INCREMENTAL_YIELD = 1,0`.

---

## 8. Corpus BEFORE / AFTER

| | Before | After | Δ |
|---|---|---|---|
| **Total** | 619 | **736** | **+117** |
| con fecha | 605 | 674 | +69 |
| **sin fecha** | 14 | **62** | **+48** (todas de DDG) |
| **CORROBORADO** | 249 | **330** | **+81** |
| PROBABLE | 14 | 22 | +8 |
| AMBIGUO | 56 | 80 | +24 |
| FUERA | 14 | 14 | 0 |
| NO_RESOLUBLE | 284 | 288 | +4 |
| **PUBLIC_CONVERSATION** | 143 | **173** | **+30** |
| MEDIA | 288 | 327 | +39 |
| INSTITUTIONAL | 84 | 101 | +17 |
| SEARCH_RESULT | 11 | 42 | +31 |
| OTHER | 83 | 83 | 0 |
| **Dominios únicos** | 133 | **188** | **+55** |
| **Actores únicos** | 138 | **196** | **+58** |
| Local corroborada | 145 | 173 | +28 |
| Nacional | 212 | 227 | +15 |
| **Organizaciones** | 0 | **0** | **0** |
| **Comunidades** | 0 | **0** | **0** |
| Medios locales | 3 | 3 | 0 |
| **RSS share** | **60,3 %** | **50,7 %** | **−9,6 pts** |
| PRIMARY / EXPANDED | 239 / 253 | **282 / 300** | +43 / +47 |
| Proveedores | 4 | **7** | +3 |

Proveedores después: `rss_directo` 373 · `x_api` 143 · `youtube_data` 83 · `ddg_web` 48 · `google_news` 39 · `scrapecreators_tiktok` 30 · `brave_web` 20.

**Organizaciones y comunidades siguen en 0.** Tres gates lo han intentado. No se reclasificó nada para que la cifra dejara de ser cero.

---

## 9. Reproceso de Topic Normalization

**Mismo algoritmo, mismo método, mismo umbral 0,18.** No se retocó nada para producir más temas.

| | Before | After |
|---|---|---|
| PRIMARY | 239 | **282** |
| Temas | 37 | **41** |
| Clasificadas | 104 | **141** |
| Sin clasificar | 109 | 121 |
| Grupo mayor | 11 (4,6 %) | **12 (4,3 %)** |

**Sin mega-cluster:** el grupo mayor bajó en proporción pese a crecer el corpus.

### Estabilidad de los 37 temas baseline

| | |
|---|---|
| `STABLE` | **27** |
| `DISAPPEARED` | 10 |
| `NEW` | 14 |

Los 10 «desaparecidos» no se perdieron: **absorbieron evidencia nueva y su firma de términos canónicos cambió**, así que emiten otro `topicId`. Es el comportamiento esperado de un id derivado del contenido, y el contrato ya prevé `mergedFrom`/`splitFrom` para registrar el linaje cuando se implemente.

### El tema que demuestra el valor del gate

```
intercambiador monay · monay iess
  n=12  fuentes=10  7D=12
  proveedores: x_api, youtube_data, rss_directo, scrapecreators_tiktok
```

**Cuatro plataformas hablando del mismo hecho**, incluida TikTok por primera vez. Y `festival cuy` ahora cruza RSS, X y TikTok. El descubrimiento abierto de TikTok no creó temas aislados: **se integró en asuntos reales ya detectados**.

---

## 10. Segunda foto temporal

```
collectionRunId  open-social-04-2026-09-05T23:33:59.810Z
startedAt        2026-09-05T23:33:59.810Z
completedAt      2026-09-05T23:34:00.901Z
temas            41 persistidos
pasadas          2   <-- SEGUNDA FOTO
```

**Ya existen dos puntos temporales comparables.** No se calculó Momentum: solo se dejaron los datos.

**Aislamiento:** proyecto A = 736, proyecto B = 0.

---

## 11. Cobertura BEFORE / AFTER por capacidad

| Plataforma | Capacidad | Before | After | Proveedor | Limitación |
|---|---|---|---|---|---|
| **TikTok** | `OPEN_KEYWORD_DISCOVERY` | **UNSUPPORTED** | **OPERATIVE_WITH_LIMITATIONS** | scrapecreators | 1 crédito/request; docs con el parámetro mal |
| **TikTok** | `HASHTAG_DISCOVERY` | UNSUPPORTED | **AVAILABLE_NOT_TESTED** | scrapecreators | endpoint declarado, sin probar |
| TikTok | `PUBLISHED_AT` | UNKNOWN | **OPERATIVE** | scrapecreators | 100 % en la muestra |
| TikTok | `PUBLIC_METRICS` | UNKNOWN | **OPERATIVE** | scrapecreators | views, likes, comments, shares |
| TikTok | `PAGINATION` | UNKNOWN | **OPERATIVE** | scrapecreators | cursor devuelto |
| Instagram | `HASHTAG_DISCOVERY` | UNSUPPORTED | **PROVIDER_REQUIRED** | scrapecreators | declarado, ruta no obtenida |
| Facebook | `OPEN_KEYWORD_DISCOVERY` | UNSUPPORTED | **PROVIDER_REQUIRED** | MCL / terceros | MCL solo académico vía ICPSR |
| Threads | todas | NOT_IMPLEMENTED | **PROVIDER_REQUIRED** | — | sin conector |
| Reddit | `OPEN_KEYWORD_DISCOVERY` | NOT_IMPLEMENTED | **PROVIDER_REQUIRED** | scrapecreators | utilidad local sin medir |
| X | `PAGINATION` | UNKNOWN | UNKNOWN | — | no se gastó presupuesto en ejercitarla |
| YouTube | `COMMENTS` | NOT_IMPLEMENTED | **BLOCKED por URL** | — | `SHARED_URL_CASE_DEBT` |
| GDELT | news discovery | **UNKNOWN** | **OPERATIVE_WITH_LIMITATIONS** | gdelt | rate-limit; espaciado añadido |
| Google News | news discovery | IMPLEMENTED_NOT_WIRED | **OPERATIVE** | googleNewsService | URL de agregador |
| DuckDuckGo | web discovery | CONFIGURED_NOT_USED | **OPERATIVE_WITH_LIMITATIONS** | duckProvider | 0 % con fecha |

---

## 12. Presupuesto

| Recurso | Autorizado | Usado | Saldo |
|---|---|---|---|
| GDELT | 5 | **5** | N/A |
| Google News | 5 | **5** | N/A |
| DuckDuckGo | 5 | **5** | N/A |
| ScrapeCreators | prueba mínima | **2 requests, 1 crédito** | **49 verificable** |
| Brave | 10 | **0** | NO_VERIFICABLE |
| SerpAPI | 5 | **0** | 756/1000 |
| X | 5 | **0** | NO_VERIFICABLE |
| YouTube | 5 | **2 unidades** (sondeo de comentarios) | NO_VERIFICABLE |
| **Coste monetario** | — | — | **$0** |

No se compró nada. No se activó ningún plan de pago.

---

## 13. Cuatro errores propios

1. **El script diagnóstico de GDELT no retuvo los cuerpos.** 29 evidencias válidas medidas y perdidas, con el presupuesto agotado. Se corrigió el método para las fases siguientes, que retuvieron todo.
2. **`naturalezaPorProveedor` no conocía los proveedores nuevos.** Las 30 piezas de TikTok caían en `OTHER` y la conversación pública se quedaba clavada en 143 teniendo 173.
3. **`TOPE_DE_GRUPO` bloqueaba fusiones legítimas en corpus diminutos.** Con 4 documentos el tope era 3, e impedía una unión de similitud 0,58. Ahora no se aplica por debajo de 20 documentos: con 4 piezas no existe el concepto de mega-cluster.
4. **El `providerId` por observación salía de la unión acumulada.** `providersSeenBy[0]` es el primer proveedor *histórico*, así que **cada reobservación volvía a anotar el proveedor original y un motor nuevo sobre la misma pieza nunca quedaba registrado**. Verificado el arreglo: Google News y DuckDuckGo sobre la misma URL ahora dan `['google_news','ddg_web']` en lugar de `['google_news','google_news']`.

Los cuatro los encontraron las pruebas o la inspección de la salida, no una revisión posterior.

---

## 14. Pruebas y regresiones

`territorial-open-social`: **27 pruebas, 0 fallos**, cubriendo A–W. Cero red — los adaptadores reciben `fetch` inyectado.

**Batería territorial: 978 pruebas, 0 fallos.** Candidate: `socialProviders` 36, `xReal` 37, `candidateIntelligence` 100, `accountIntelligence` 36. Media: `mediaPiece` 42, `mediaTime` 29, `mediaHome` 41, `mediaSourceUniverse` 33. Todas verdes.

`npm run build` correcto. `npm run lint`: 6 errores **preexistentes y ajenos**, sin tocar.

---

## 15. Huecos que quedan

1. **`SHARED_URL_CASE_DEBT`** — 83 URLs de YouTube muertas por lowercasing de ruta y query en `textUtils.js`. Bloquea comentarios. No se toca: cambiaría claves de dedup de Media y Candidate.
2. **Organizaciones = 0 y comunidades = 0** tras tres gates. Causa medida: renderizado en cliente.
3. **48 evidencias de DDG sin fecha** — fuera de todas las ventanas.
4. **Instagram hashtag discovery declarado y sin demostrar.**
5. **Facebook sin vía comercial** para descubrimiento abierto: MCL es académico.
6. **GDELT medido y sin ingerir** — 29 evidencias perdidas por mi propio script.
7. **`X · PAGINATION` sigue `UNKNOWN`.**
8. **`SHARED_GEO_CONTEXT_DEBT`** intacta.
9. **Medios locales siguen en 3.**

---

## 16. Veredictos

| | |
|---|---|
| `EXISTING_LISTENING_CAPABILITIES` | **IMPROVED** |
| `GDELT` | **PARTIAL** |
| `GOOGLE_NEWS` | **OPERATIVE** |
| `DDG` | **USEFUL** |
| `COMMENTS_COLLECTION` | **NOT_READY** |
| `FACEBOOK_OPEN_DISCOVERY` | **PROVIDER_REQUIRED** |
| `INSTAGRAM_OPEN_DISCOVERY` | **PROVIDER_REQUIRED** |
| **`TIKTOK_OPEN_DISCOVERY`** | **AVAILABLE** |
| `OPEN_SOCIAL_COLLECTION_COVERAGE` | **PARTIAL** |
| `PUBLIC_CONVERSATION_COLLECTION_COVERAGE` | **PARTIAL** |
| `LOCAL_ORGANIZATION_COVERAGE` | **INSUFFICIENT** |
| `LOCAL_COMMUNITY_COVERAGE` | **INSUFFICIENT** |
| `NEW_PAID_PROVIDER_REQUIRED` | **NO** |
| `TOPIC_REPROCESS_READINESS` | **READY** |
| `TREND_RADAR_READINESS` | **READY_WITH_LIMITATIONS** |

`OPEN_SOCIAL_COLLECTION_COVERAGE` sigue **PARTIAL** y no `GOOD`: pasamos de 2 a 3 plataformas con descubrimiento abierto de 5, y Facebook e Instagram siguen sin demostrar.

`PUBLIC_CONVERSATION` sigue **PARTIAL** pero ya no depende de una sola plataforma: **X 143 + TikTok 30**, y eso elimina el punto único de fallo que era GAP-02.

**`NEW_PAID_PROVIDER_REQUIRED = NO`**: la capacidad que faltaba estaba en un proveedor ya contratado y con créditos. Lo que hace falta es **usarlo**, no comprar otro.

`TREND_RADAR_READINESS = READY_WITH_LIMITATIONS`: hay **dos fotos temporales**, 41 temas, 4 plataformas en el tema principal y 282 piezas en PRIMARY. Las limitaciones que deben viajar con cada salida: 50,7 % del corpus sigue siendo RSS, 62 piezas sin fecha, y cero organizaciones y comunidades.

---

## 17. Siguiente recomendación exacta

**`TERRITORIAL-TREND-RADAR-01`**, con tres condiciones que salen de lo medido:

1. **La ventana temporal es el eje.** El tema del intercambiador tiene `7D=12`; el de Farmasol, `7D=0` con casi las mismas piezas. Y las 62 piezas sin fecha no pueden entrar en ninguna ventana.
2. **`uniqueSources` y `providerDiversity` deben ponderar.** El tema del intercambiador cruza 4 plataformas y 10 fuentes; el de la Casa de la Cultura tiene 12 piezas de 3 fuentes y `rssShare` alto. No son comparables por volumen.
3. **Hay exactamente dos fotos.** Suficiente para una primera derivada, insuficiente para hablar de tendencia estable. Debe declararse.

**Antes o en paralelo, dos trabajos acotados y baratos:** cablear TikTok keyword discovery al colector con presupuesto explícito de créditos (capacidad demostrada, GAP-01 cerrable), y abrir un gate propio para `SHARED_URL_CASE_DEBT` coordinado con T1 y T3, porque hoy 83 enlaces del corpus no resuelven.

**STOP.** No se inicia Trend Radar. No se contrata proveedor. No se compran créditos. No se toca Candidate, Media, Momentum ni Sentinel AI. Se espera revisión humana.

---

## Fuentes consultadas

- [How Developers Use the TikTok Search API (2026) — Phyllo](https://www.getphyllo.com/post/tiktok-content-discovery-how-developers-use-the-tiktok-search-api-iv)
- [TikTok Search API for Keyword-Led Video Discovery — SocQ](https://socq.ai/apis/tiktok/search)
- [TikTok Hashtag Search API — KeyAPI](https://www.keyapi.ai/apis/tiktok/content/hashtag-search)
- [TikTok Data Scraping API — EnsembleData](https://ensembledata.com/tiktok-api)
- [IG Hashtag Search — Meta for Developers](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-hashtag-search)
- [Instagram API Deprecated Again? What to Actually Do in 2026 — SociaVault](https://sociavault.com/blog/instagram-api-deprecated-alternative-2026)
- [Instagram Hashtag Scraper — Apify](https://apify.com/apify/instagram-hashtag-scraper)
- [Meta Content Library and API — Transparency Center](https://transparency.meta.com/researchtools/meta-content-library/)
- [CrowdTangle — Transparency Center](https://transparency.meta.com/researchtools/other-data-catalogue/crowdtangle/)
- [Meta Is Getting Rid of CrowdTangle — Columbia Journalism Review](https://www.cjr.org/tow_center/meta-is-getting-rid-of-crowdtangle.php)
- [Scrape Creators API — documentación](https://docs.scrapecreators.com/)
