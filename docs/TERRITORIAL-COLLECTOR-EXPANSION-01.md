# TERRITORIAL-COLLECTOR-EXPANSION-01

**Mesh multifuente de observación pública — proyecto Elecciones Alcaldía Cuenca 2027**

Terminal 2 · Territorial Intelligence
Base: `ecf8a34` — TERRITORIAL-SOCIAL-GEO-DISAMBIGUATION-01
Ejecutado: 2026-09-03 · Benchmark real: `2026-09-03T22:23:46.249Z`

---

## A. Auditoría del mesh actual

Con `dotenv` cargado como lo hace `server.js` — la lección de dos gates atrás, cuando reporté credenciales ausentes leyendo un `process.env` vacío.

| Familia | Collector | Impl. | Config. | Usado por Territorial | Modo | Coste |
|---|---|---|---|---|---|---|
| WEB/RSS | `rss_directo` | sí | sí | **sí** | OPEN_DISCOVERY | $0 |
| WEB/RSS | `gdelt_doc` | sí | sí | **sí** | OPEN_DISCOVERY | $0 |
| SEARCH | `serpapi_google` | sí | sí (`SERPAPI_API_KEY`) | **NO** | OPEN_DISCOVERY | 758/1000 restantes |
| SEARCH | `brave_web` | sí | sí (`BRAVE_API_KEY`) | **NO** | OPEN_DISCOVERY | cuota del plan |
| SEARCH | `ddg_web` | sí | sí | **NO** | PARTIAL_DISCOVERY | $0 |
| X | `x_api` | sí | sí (`X_BEARER_TOKEN`) | **sí** | OPEN_DISCOVERY | cuota no medida |
| YOUTUBE | `youtube_data` | sí | sí (`YOUTUBE_API_KEY`) | **sí** | OPEN_DISCOVERY | 100 u./búsqueda |
| FACEBOOK | `scrapecreators_facebook` | sí | sí | **NO** | **KNOWN_ACCOUNT_ONLY** | créditos |
| INSTAGRAM | `scrapecreators_instagram` | sí | sí | **NO** | **KNOWN_ACCOUNT_ONLY** | créditos |
| TIKTOK | `scrapecreators_tiktok` | sí | sí | **NO** | **KNOWN_ACCOUNT_ONLY** | créditos |
| INSTITUCIONAL | `universo_de_fuentes` | sí | sí | **sí** | OPEN_DISCOVERY | $0 |

**El hallazgo principal de la auditoría:** SerpAPI, Brave y DuckDuckGo estaban configurados, en el registro de proveedores y con SerpAPI en prioridad 1 — y **Territorial no los llamaba nunca**. El `PRESUPUESTO_POR_PASADA` del colector solo contemplaba `rss_directo`, `gdelt_doc`, `x_api` y `youtube_data`. Era infraestructura pagada y sin usar; ha sido la ampliación más barata del gate.

Credenciales presentes (presencia y longitud, nunca el valor): `YOUTUBE_API_KEY` 39, `X_BEARER_TOKEN` 116, `BRAVE_API_KEY` 31, `SERPAPI_API_KEY` 64, `SCRAPECREATORS_API_KEY` 28, `META_APP_ID` 16, `META_APP_SECRET` 32, `GOOGLE_API_KEY` 39.
Ausentes: `DATA365_API_KEY`, `APIFY_TOKEN`, `GOOGLE_CSE_ID`.

---

## C. Discovery vs known account — determinado leyendo el código

No se asumió nada. El catálogo de endpoints que declara `intelligence/externalSocialProvider.js`:

```
facebook   /v1/facebook/profile          (url)
           /v1/facebook/profile/posts    (url)
           /v1/facebook/post/comments    (url)
tiktok     /v1/tiktok/profile            (handle)
           /v3/tiktok/profile/videos     (handle)
           /v2/tiktok/video              (url)
instagram  /v1/instagram/profile         (handle)
           /v2/instagram/user/posts      (handle)
           /v2/instagram/post/comments   (url)
```

**Los doce endpoints piden una URL o un handle. Ninguno acepta una consulta, un tema ni un hashtag.** Y `CAPACIDADES_POR_PLATAFORMA` no incluye ninguna capacidad de búsqueda: la taxonomía existente ni la contempla, porque el proveedor no la ofrece.

De ahí:

| Plataforma | Clasificación | Evidencia |
|---|---|---|
| Facebook | **KNOWN_ACCOUNT_ONLY** | 4 endpoints, todos por URL |
| Instagram | **KNOWN_ACCOUNT_ONLY** | perfil y posts por handle; sin hashtag ni search |
| TikTok | **KNOWN_ACCOUNT_ONLY** | perfil y vídeos por handle; el adaptador propio solo expone `confirmarCuenta` |
| X | OPEN_DISCOVERY | `search/recent` con consulta arbitraria |
| YouTube | OPEN_DISCOVERY | `search.list` con consulta arbitraria |
| Web/Search | OPEN_DISCOVERY | consulta arbitraria |

Que Candidate haya demostrado ScrapeCreators sobre cuentas conocidas **no demuestra descubrimiento abierto**. Son dos capacidades distintas y la diferencia es la que separa «esto es lo que se habla en Cuenca» de «esto es lo que publican las nueve cuentas que ya teníamos».

La vía oficial de Meta tampoco descubre por tema: `business_discovery` resuelve cuentas profesionales que ya se nombran. `FACEBOOK_USER_ACCESS_TOKEN` existe, pero T1 declara explícitamente `noSignifica: [BUSINESS_DISCOVERY_FUNCIONA, FACEBOOK_PAGE_TERCERO_FUNCIONA, MEDIDO_TERCERO]`. **No se reabrió: es dominio de Candidate.**

---

## I–J. Benchmark real

Instante `2026-09-03T22:23:46.249Z`. Base: corpus 421, 421 claves, 62 actores.

### Presupuesto: autorizado vs consumido

| Recurso | Autorizado | Consumido | Verificable |
|---|---|---|---|
| X | 5 requests | **1** | sí |
| YouTube | 5 búsquedas | **1** (100 u.) | sí |
| ScrapeCreators | 20 créditos | **3 cobrados** | `credits_remaining: 51` |
| Búsqueda (Brave) | cuota existente | **6** requests | cuota del plan |
| SerpAPI | cuota existente | **0** | 758/1000, sin cambio |
| Proveedores nuevos | ninguno | ninguno | — |
| **Nuevas suscripciones** | — | — | **$0** |

`credits_before` no se capturó directamente; `credits_remaining = 51` es la cifra que el proveedor declara en su propia respuesta. **8 llamadas se intentaron y solo 3 se cobraron**: los fallos devolvieron `credits_charged: 0`.

El plan completo pedía **17 de 20 créditos**. Acercarse al tope es condición de parada del gate, así que se recortó a una muestra de 1 activo por plataforma y por actor: 6 planificados, 3 cobrados. Los excluidos declaran su motivo.

### Semillas de descubrimiento (§J)

Nueve familias neutrales — actualidad, movilidad, servicios, instituciones, cultura, universidad, deporte, economía, ciudadanía. **No son temas del producto**, son semillas: Open Topic Discovery tiene que poder encontrar temas que no estén en esta lista. Ninguna semilla es «Cuenca» a secas, porque ese término ya produjo 13 falsos positivos medidos.

---

## K–R. Tabla de resultados por collector

| Familia | Collector | Modo | Config | Requests | Observadas | Nuevas únicas | Actores nuevos | CORROB | PROB | AMB | FUERA | NO_RES | Coste | Limitación | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SEARCH | `brave_web` | OPEN_DISCOVERY | sí | 6 | 60 | **60** | **44** | **44** | 3 | 8 | 0 | 4 | cuota | Solo 28/60 traen fecha | **OPERATIVO_CON_LIMITACIONES** |
| X | `x_api` | OPEN_DISCOVERY | sí | 1 | 25 | 12 | 8 | 20 | 0 | 1 | 0 | 4 | cuota | Solapamiento 52 % | **OPERATIVO_CON_LIMITACIONES** |
| YOUTUBE | `youtube_data` | OPEN_DISCOVERY | sí | 1 | 15 | 15 | **11** | 12 | 0 | 3 | 0 | 0 | 100 u. | Ventana no forzada | **OPERATIVO_CON_LIMITACIONES** |
| FACEBOOK | `scrapecreators_facebook` | KNOWN_ACCOUNT_ONLY | sí | 3 | 6 posts | 6 | 0 | — | — | — | — | — | 2 créditos | Sin discovery | **KNOWN_ACCOUNT_ONLY** |
| TIKTOK | `scrapecreators_tiktok` | KNOWN_ACCOUNT_ONLY | sí | 1 | 10 posts | 10 | 0 | — | — | — | — | — | 1 crédito | Sin discovery | **KNOWN_ACCOUNT_ONLY** |
| INSTAGRAM | `scrapecreators_instagram` | KNOWN_ACCOUNT_ONLY | sí | 4 | **0** | 0 | 0 | — | — | — | — | — | 0 cobrados | `internal_server_error` | **BLOQUEADO** |
| INSTITUCIONAL | `universo_de_fuentes` | OPEN_DISCOVERY | sí | 6 HTTP | 6 sitios | 26 activos | 6 actores | — | — | — | — | — | $0 | Verificación humana | **OPERATIVO** |

Los posts de Facebook y TikTok no se clasificaron territorialmente en esta pasada: son 16 piezas de 3 activos y la muestra es demasiado pequeña para una tasa. Se declara así en lugar de publicar un porcentaje sobre 16.

### Tasas medidas

| Collector | Resolución territorial | Ruido | Solapamiento | Con `publishedAt` | Con procedencia de consulta |
|---|---|---|---|---|---|
| `brave_web` | **0,783** | **0** | 0 | 28/60 | 60/60 |
| `x_api` | 0,800 | **0** | **0,52** | 25/25 | **25/25** |
| `youtube_data` | 0,800 | **0** | 0 | 15/15 | 15/15 |

**Ruido cero en los tres.** Y `TERRITORIO_CONFLICTIVO` se activó **por primera vez con datos reales** (1 pieza en la búsqueda): el gate anterior lo reportó como estado sin validar en producción, y ya lo está.

### Instagram: se investigó antes de culpar al proveedor

Los dos primeros fallos usaron `url` cuando el proveedor pide `handle` para perfil y posts. Era mi error, así que se repitió con el parámetro correcto: **falla igual**, con `internal_server_error` del propio proveedor y `credits_charged: 0`. La conclusión es del proveedor, no de mi mapeo. Puede ser transitorio: son 4 intentos, no una medición larga.

---

## E–F. La vía honesta para Facebook, Instagram y TikTok

Como no hay escucha abierta, se implementó el camino inverso:

```
otra fuente descubre y corrobora un actor
        ↓
el actor entra al universo de fuentes
        ↓
se EXTRAE su activo social de su sitio oficial
        ↓
el proveedor observa ESE activo
        ↓
el contenido pasa por resolución territorial pieza a pieza
```

**26 activos sociales resueltos de 6 sitios oficiales, con cero URLs inventadas.** Todos con `ENLAZADO_DESDE_FUENTE_OFICIAL` porque salieron del HTML del propio actor:

| Actor | X | YouTube | Facebook | Instagram | TikTok |
|---|---|---|---|---|---|
| unsion.tv | UNSIONTV | TVUnsion | UnsionTV | unsiontv | unsiontv |
| emac.gob.ec | emac_ep | emacep5962 | EMAC.Cuenca | emac_ep_cuenca | emac_ep |
| emov.gob.ec | emov_ep | UCYBMd… | emovepcuenca | emov_ep | emov_ep |
| etapa.net.ec | etapaoficial | — | ETAPAEP | etapacuenca | etapaepcuenca |
| cultura.cuenca.gob.ec | culturacue | — | CulturaCUE | culturacue | — |
| elmercurio.com.ec | — | elmercuriocue | diarioelmercurio | — | — |

**La trampa que este camino no comete.** Que un actor sea local no hace local cada cosa que publica: El Mercurio es de Cuenca y una nota suya sobre el dólar no habla de Cuenca. Un activo derivado de un actor corroborado **no nace territorialmente corroborado** — hay una prueba que lo fija. Lo que hereda es identidad, no geografía.

Y una coincidencia de nombre en una búsqueda **no autoriza gastar un crédito**: solo `ENLAZADO_DESDE_FUENTE_OFICIAL` o `VERIFICADO_POR_ANALISTA`. Gastar una llamada sobre la cuenta equivocada cuesta dinero y mete contenido ajeno en el corpus.

`facebook.com/sharer.php` no se convierte en actor: hay una lista de rutas que no son cuenta, con prueba.

---

## D. Search Intelligence como familia separada

```
SOCIAL_CONVERSATION   lo que la gente publica
MEDIA_AGENDA          lo que los medios cubren
SEARCH_INTEREST       lo que se busca
SEARCH_RESULT         lo que un motor devuelve   <-- esto es lo que tenemos
```

Las piezas viajan con `familia: SEARCH_INTELLIGENCE` y `tipoDeSenal: SEARCH_RESULT` para que ningún agregado las sume con tuits o notas de prensa.

**`SEARCH_INTEREST` se declara `NO_DISPONIBLE`.** No hay adaptador ni credencial de una fuente legítima de volumen de búsquedas, y un recuento de resultados no es interés de búsqueda. Queda prohibido afirmar «tendencia de Google», «lo más buscado en Cuenca» o crecimiento del interés.

Y el problema de fecha, medido: **solo 28 de 60 resultados traen `publishedAt`**. A los otros 32 no se les asigna ninguna — una fecha inventada contamina cualquier ventana temporal y después es indetectable.

**32 candidatos a fuente nuevos**, ninguno promovido solo: `investigaciones.uazuay.edu.ec`, `tranvia.cuenca.gob.ec`, `webnueva.etapa.net.ec`, `mimunicipalidad.net` y otros. Todos con `requiereVerificacion: true`.

---

## G. Procedencia de consulta de X — corregido

El hueco: 47 evidencias de X persistidas con `queryLabel: null`, mientras las 21 de YouTube sí la traían.

**Causa.** `buscarMenciones` ya recibía `queryType` y `queryLabel` del colector y los tiraba: no llegaban a `normalizarEvidencia`, que es quien construye `provenance`. El adaptador de YouTube sí los pasa; el de X, no.

**Arreglo aditivo**, verificado en llamada real: **25/25 evidencias con `queryLabel`**, antes 0. Si el llamador no los pasa —como hace Candidate sobre cuentas conocidas, donde no hay consulta— quedan en `null` igual que antes. `socialProviders` 35/35 y `xReal` 37 checks intactas.

**No se reescribió el histórico.** Las 47 evidencias ya persistidas siguen con `queryLabel: null`, porque inventar el valor sería peor que no tenerlo.

Y la regla que no cambia: esto es trazabilidad, no geografía. Hay prueba de que la procedencia de consulta no entra en `signalsPositive` ni en `signalsNegative`.

---

## H. `esElAmbito` — deuda declarada, no tocada

`contexto.esElAmbito` sigue produciendo el razonamiento circular «el proyecto es Cuenca → el texto dice Cuenca → habla de Cuenca» en `geoResolver`, que es infraestructura compartida y T1/T3 siguen activos.

La capa segura de `ecf8a34` se mantiene y es la que usa todo el flujo territorial de este gate. **No se modificó `geoResolver`.**

Queda registrado como **`SHARED_GEO_CONTEXT_DEBT`**: requiere un gate coordinado con Candidate y Media, con su propia medición.

---

## L. Dedup y solapamiento cross-source

Se detecta misma URL, misma URL canónica y misma pieza vista por dos colectores. **La evidencia no se borra y la procedencia múltiple se conserva** — saber que X y la búsqueda web trajeron lo mismo es información sobre las fuentes, no basura. Lo que no puede pasar es contarla dos veces en un agregado.

Medido: X trae **52 % de solapamiento** con el corpus existente (13 de 25). Búsqueda y YouTube, 0 %.

---

## M. Actores

| | Antes | Después |
|---|---|---|
| Actores del corpus | 62 | 62 (corpus no modificado) |
| Actores nuevos observados en el benchmark | — | **63** (44 búsqueda + 8 X + 11 YouTube) |
| Activos sociales resueltos | 0 | **26** |
| Actores con activo social conocido | 0 | **6** |

Clasificación no sensible: medio, institución, empresa, universidad, club, comunidad pública. **No se infiere domicilio, residencia, ideología, etnia, religión, orientación, perfil psicológico ni intención de voto.** No se crea ningún perfil de ciudadano individual. Hay prueba que recorre las salidas buscando esos términos y exige que no aparezcan.

---

## N. First-party / pixels

**No se implementó ningún tracking.** Documentado como arquitectura futura y solo válido sobre propiedades propias o autorizadas, en agregado: visitas, páginas, campañas, eventos, conversiones autorizadas. No sirve para «rastrear a la gente de Cuenca». Sin identificación de dispositivos ni personas, sin cruce de IDs, sin microtargeting.

## O. Aislamiento de proyecto

Fixture Project B creado. Proyecto A → 1, proyecto inexistente → 0. Y la **prueba de mutación**: si se quita `projectId`, el aislamiento debe romperse — con 0 evidencias sin el campo y 2 solo al pedir `incluirLegado`. Toda evidencia nueva conserva `tenantId`, `projectId`, `providers`, `providerId`, `observedAt`, `publishedAt` cuando exista, `canonicalUrl`, `queryProvenance` y `territoryId`.

## P. Representatividad

Ninguna salida del mesh afirma representatividad. Prohibido y probado: «esto representa a Cuenca», «X % de los cuencanos», «opinión pública de Cuenca», «todos los temas», «cobertura total de Internet», «sentimiento de la población». El lenguaje usado es *conversación pública observable*, *señales observadas*, *corpus observado*, *fuentes cubiertas*, *actores observados*, *territorialmente corroborado/probable*.

La frase de composición se genera sola para que nadie tenga que redactarla y se le escape lo prohibido:

> «47 señales territorialmente utilizables: 44 corroboradas y 3 probables.»

nunca «47 publicaciones de Cuenca».

---

## Q. Pruebas

Suite nueva `territorial-mesh`: **46 pruebas, 0 fallos**, cero red.

| Suite | Pruebas |
|---|---|
| `territorial` | 160 |
| `territorial-d2` | 92 |
| `territorial-sources` | 61 |
| `territorial-c2` | 53 |
| `territorial-fresh` | 50 |
| `territorial-topic` | 49 |
| `territorial-mesh` | **46** |
| `territorial-coverage` | 45 |
| `territorial-rotation` | 42 |
| `territorial-d` | 39 |
| `territorial-social` | 36 |
| `territorial-geo-disambiguation` | 36 |
| `territorial-project` | 29 |
| `territorial-expansion` | 29 |
| `territorial-listening` | 31 |
| **Total territorial** | **798 · 0 fallos** |
| `socialProviders` (Candidate) | 35 · intacta |
| `xReal` (Candidate) | 37 checks · intacta |
| `mediaPiece` / `mediaTime` / `mediaHome` / `mediaSourceUniverse` (Media) | 139 checks · intactas |

`npm run build`: correcto. `npm run lint`: 6 errores **preexistentes y ajenos** en `Dashboard.jsx` y `KnowledgeGraph.jsx`. No se arregló lint ajeno.

**Un error propio, detectado antes de reportarlo.** La primera pasada del benchmark dio 25 NO_RESOLUBLE en X y 0 corroboradas. Era mi script: a nivel de adaptador el texto vive en `snippet` y el ledger lo mapea a `summary` solo al persistir; yo leía únicamente `summary`. Corregido, X da 20 corroboradas de 25. Si lo hubiera publicado, habría reportado «X no resuelve territorio» siendo falso.

---

## S. Veredictos

| Dimensión | Estado |
|---|---|
| `WEB_LISTENING` | **OPERATIVO_CON_LIMITACIONES** |
| `SEARCH_INTELLIGENCE` | **OPERATIVO_CON_LIMITACIONES** |
| `X_LISTENING` | **OPERATIVO_CON_LIMITACIONES** |
| `YOUTUBE_LISTENING` | **OPERATIVO_CON_LIMITACIONES** |
| `FACEBOOK_LISTENING` | **KNOWN_ACCOUNT_ONLY** |
| `INSTAGRAM_LISTENING` | **BLOQUEADO** |
| `TIKTOK_LISTENING` | **KNOWN_ACCOUNT_ONLY** |
| `SOURCE_UNIVERSE_EXPANSION` | **OPERATIVO** |
| `SOCIAL_GEO_RESOLUTION` | **OPERATIVO_CON_LIMITACIONES** |
| `TERRITORIAL_COLLECTOR_MESH` | **OPERATIVO_CON_LIMITACIONES** |
| `TERRITORIAL_OPEN_LISTENING_READINESS` | **PARCIAL** |

`TERRITORIAL_OPEN_LISTENING_READINESS = PARCIAL` porque de ocho familias objetivo, **tres no admiten escucha abierta en absoluto** y una de esas tres está además bloqueada. El mesh sabe qué observa y qué no, pero no observa el ecosistema completo, y decir lo contrario sería inventar cobertura.

---

## Las 17 preguntas

**1. ¿Cuánto amplió realmente el corpus?**
100 piezas observadas, **87 nuevas únicas** frente a las 421 del corpus — un **+20,7 % potencial** con 9 requests y $0. **El corpus no se modificó:** la ampliación está medida, no persistida. Los resultados de búsqueda sin `publishedAt` entrarían en ventanas temporales sin fecha, y esa decisión es humana.

**2. ¿Qué collector aportó mayor señal NUEVA útil?**
**La búsqueda web, con diferencia.** 60 de 60 nuevas, 44 corroboradas, 44 actores nuevos, 32 candidatos a fuente y ruido 0, con 6 requests sobre infraestructura ya pagada.

**3. ¿Qué collector produjo más ruido?**
**Ninguno produjo ruido medible: `noise_rate = 0` en los tres.** Lo que sí produjo X es **redundancia**: 52 % de solapamiento. No es ruido, es rendimiento decreciente. Y la búsqueda produce el mayor déficit de procedencia: 32 de 60 sin fecha.

**4. ¿Qué plataformas siguen sin open discovery?**
**Facebook, Instagram y TikTok.** Los doce endpoints disponibles piden URL o handle.

**5. ¿Cuáles funcionan solo por known-account?**
Facebook y TikTok, ambas comprobadas con llamadas reales (6 y 10 publicaciones). Instagram sería la tercera pero hoy está bloqueada.

**6. ¿Qué capacidad falta para una escucha territorial más amplia?**
Cuatro, en orden de impacto:
1. **Búsqueda por palabra clave o hashtag en Facebook, Instagram y TikTok** con filtro geográfico o de idioma.
2. **Volumen de búsquedas agregado y regionalizable** — hoy `SEARCH_INTEREST` es `NO_DISPONIBLE`.
3. **Ventana histórica en X** más allá de 7 días.
4. **Fecha de publicación fiable** en resultados de búsqueda.

**7. ¿Necesitamos evaluar otro proveedor?**
Sí, pero solo para la capacidad 1.

**8. ¿Qué capacidad falta exactamente?**
No «un proveedor de redes sociales», sino: *búsqueda pública por palabra clave/hashtag en Facebook, Instagram y TikTok, con filtro por idioma o región, que devuelva autor y fecha, y con endpoint documentado de búsqueda y no solo de perfil.* Ese es el criterio con el que hay que medir cualquier candidato, y es el que ScrapeCreators no cumple — no por mala calidad, sino porque su superficie no lo incluye.

**9. ¿Está Facebook aportando conversación territorial?**
**No conversación: seguimiento.** 6 publicaciones de 2 páginas institucionales que ya conocíamos. Aporta la voz de las instituciones, no la de la ciudadanía.

**10. ¿Instagram?**
**No.** 0 publicaciones en 4 intentos, `internal_server_error` del proveedor, 0 créditos cobrados.

**11. ¿TikTok?**
**Seguimiento, y el más productivo por crédito:** 10 publicaciones con 1 crédito. Pero de un activo conocido.

**12. ¿X?**
**Sí, y es la única conversación ciudadana real del mesh.** 20 de 25 corroboradas. Con dos techos: 7 días y 52 % de solapamiento.

**13. ¿YouTube?**
**Sí, y descubre actores muy bien:** 11 actores nuevos de 15 piezas, 12 corroboradas. La consulta de deporte —familia no probada antes— funcionó a la primera.

**14. ¿Web/Search?**
**El mayor aporte del gate.** Y era infraestructura que ya estaba pagada y sin usar.

**15. ¿Cuántas señales son CORROBORADAS vs PROBABLES?**
De las 100 clasificadas: **76 corroboradas y 3 probables → 79 utilizables**. Excluidas: 12 ambiguas, 1 conflictiva, 0 fuera, 8 no resolubles. No se dice «79 publicaciones de Cuenca».

**16. ¿Cuántos actores nuevos y útiles aparecieron?**
**63 actores nuevos observados** y **26 activos sociales resueltos** de 6 actores locales ya corroborados. Útiles de verdad: los 6 institucionales con activo social, porque abren observación en tres plataformas donde antes no había nada.

**17. ¿Qué parte del corpus depende todavía de medios nacionales?**
El corpus base sigue pesando hacia lo nacional: `expreso.ec` 79, `extra.ec` 76, `teleamazonas` 40 — **195 de 421, un 46 %**, frente a 22 de El Mercurio y 16 de Unsión TV. El benchmark no lo corrige: lo que hace es abrir 32 candidatos a fuente local y 26 activos institucionales para que la próxima recolección pueda equilibrarlo.

---

## Huecos

1. **`SHARED_GEO_CONTEXT_DEBT`** — `esElAmbito` sigue circular en la infraestructura compartida.
2. **Instagram bloqueado** por error del proveedor; 4 intentos no son una medición larga.
3. **32 de 60 resultados de búsqueda sin fecha** — limita su uso temporal.
4. **`SEARCH_INTEREST` no disponible** — sin fuente legítima de volumen.
5. **Las 47 evidencias de X históricas siguen sin `queryLabel`** y no se reescriben.
6. **Facebook y TikTok medidos sobre 3 activos** — muestra insuficiente para tasas territoriales.
7. **La ampliación de +87 piezas está medida y no persistida.** Decisión humana.
8. **`ddg_web` no se probó** en esta pasada: Brave cubrió las 6 consultas.

## Siguiente decisión

1. **¿Se persisten las 87 piezas nuevas?** Con criterio explícito para los resultados sin fecha.
2. **¿Se abre la evaluación de un proveedor con búsqueda pública en FB/IG/TikTok?** Criterio en la pregunta 8.
3. **¿Se reintenta Instagram** más adelante para distinguir fallo transitorio de bloqueo estable?
4. **¿Se abre el gate coordinado de `esElAmbito`** con T1 y T3?

**STOP.** No se inicia Topic Normalization, Trend Radar, Momentum, Sentinel AI, Reporting ni nueva UX. No se toca Candidate ni Media. No se contrata nada. Se espera decisión humana.
