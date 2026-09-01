# TERRITORIAL-CREDENTIAL-ACTIVATION-01

## Activar el discovery social que ya existe — YouTube y X

**Fecha:** 2026-09-01 · **Proyecto:** `alcaldia-cuenca-2027-piloto`
**Coste:** **0 USD** · 0 unidades de cuota · 0 créditos · 0 peticiones externas

---

## Resumen en una frase

Los dos conectores **existen, están auditados y quedan conectados al pipeline
territorial**. Ninguno tiene credencial, así que **no se ejecutó ningún benchmark real**.
Activarlos es ahora una variable de entorno, y hay 30 pruebas sin red que lo demuestran.

---

## 1. YouTube — auditoría

| | |
|---|---|
| Fichero | `services/ingest/adapters/youtubeAdapter.js` (927 líneas) |
| Función de discovery | **`buscar(consulta, opciones)`** |
| Endpoint | `https://www.googleapis.com/youtube/v3/search` |
| Parámetros | `type=video`, `order=date`, `relevanceLanguage=es`, `regionCode=EC`, `publishedAfter` |
| Otros endpoints | `resolverCanales()` → `/channels` · `resolverCanalPorHandle()` |
| Credencial | `YOUTUBE_API_KEY` **o** `YOUTUBE_DATA_API_KEY` |
| Lectura de la credencial | **perezosa** — en `server.js` los `import` se evalúan antes de `dotenv.config()` |
| **Coste declarado** | `COSTE_UNIDADES.search = 100` de `CUOTA_DIARIA_GRATUITA = 10000` |
| Salida | `{ estado, evidencias, recibidas, canalesDetectados, unidadesConsumidas, latenciaMs, motivo }` |
| Estados | `OK` · `SIN_CREDENCIAL` · `CUOTA_AGOTADA` · `BLOQUEADO` · `ERROR` |
| Conectado a Territorial | **sí**, desde TERRITORIAL-FRESH-01 · presupuesto **1 consulta/pasada** |
| Dedup | `crossProviderDedup` en el orquestador, común a todos los proveedores |
| Persistencia | `evidenceLedger` con `projectId`, `publishedAt`, `firstObservedAt`, URL canónica |
| Territorio | lo resuelve `geoResolver` sobre el texto, **no la consulta** |

> El propio adapter ya documenta la trampa: *«`regionCode` acota la región de
> RELEVANCIA, no la ubicación del contenido. "Cuenca" con `regionCode` EC sigue pudiendo
> devolver Cuenca de España»*.

**Verificación de la cuota:** los valores están declarados como constantes en el
adapter (`COSTE_UNIDADES.search = 100`, `CUOTA_DIARIA_GRATUITA = 10000`) y la prueba los
fija. **No se verificó contra la documentación de Google en este gate** —no había
credencial que justificara la consulta— así que se reportan como *declarados en el
código*, no como *confirmados contra el proveedor*.

### YOUTUBE_CREDENTIAL_STATUS: **AUSENTE**

```
estaConfigurado()            false
YOUTUBE_API_KEY presente     false
YOUTUBE_DATA_API_KEY         false
buscar() sin clave           SIN_CREDENCIAL, 0 unidades, 0 llamadas
```

---

## 2. X — auditoría

| | |
|---|---|
| Fichero | `services/ingest/adapters/xAdapter.js` (627 líneas) |
| Función de discovery | **`buscarMenciones(consulta, opciones)`** |
| Endpoint | `https://api.x.com/2/tweets/search/recent` |
| **Ventana** | **7 días.** El archivo completo pertenece a niveles superiores de la API |
| `max_results` | 10–100, acotado por el adapter |
| Campos | `created_at, public_metrics, author_id, lang, referenced_tweets` |
| Credencial | `X_BEARER_TOKEN` **o** `TWITTER_BEARER_TOKEN` |
| Salida | `{ estado, evidencias, llamadas, ventana, limitacion }` |
| Estados | `OK` · `SIN_CREDENCIAL` · `ERROR` |
| Conectado a Territorial | **NO lo estaba. Este gate lo conecta** |
| Paginación | no implementada — una llamada por consulta |
| Dependencia de nivel | **`max_results` y el volumen mensual dependen del tier. NO conocido** |

### X_CREDENTIAL_STATUS: **AUSENTE**

```
estaConfigurado()            false
X_BEARER_TOKEN presente      false
TWITTER_BEARER_TOKEN         false
buscarMenciones() sin clave  SIN_CREDENCIAL, 0 llamadas
diagnostico().variableEntorno  X_BEARER_TOKEN
```

### X_TIER_STATUS: **DESCONOCIDO**

No se puede determinar el nivel sin credencial. Por eso el presupuesto se fijó en **1
consulta por pasada** y su motivo lo dice: *«su límite depende del nivel contratado, que
NO conocemos: pedir más de una consulta con un techo desconocido es la forma más rápida
de agotar algo que no sabemos medir»*.

**No se hizo ninguna llamada real.** El §10 del gate lo exigía: sin coste conocido, no
se llama.

---

## 3. Lo que este gate construyó

Como ambas credenciales están ausentes, el trabajo entregable era **dejar la activación
a una variable de entorno**. Tres cambios:

### a · X conectado al recolector territorial

El adapter existía desde Candidate y **nadie lo invocaba desde Territorial**. Ahora se
llama igual que RSS, GDELT y YouTube: sin reimplementar nada.

```
PRESUPUESTO_POR_PASADA.x_api = 1
MOTIVO_PRESUPUESTO.x_api     = «7 días, límite del tier NO conocido»
consultasPara("x_api")       = la consulta neutra más limpia del plan
estadoAdapters()             = 4 filas, x_api con su variableEntorno
```

Comprobado con `fetch` inyectado:

```
https://api.x.com/2/tweets/search/recent?query=...&max_results=25
  &tweet.fields=created_at,public_metrics,author_id,lang,referenced_tweets
  &expansions=author_id&user.fields=username,name
```

### b · Autor por resultado — sin él no hay descubrimiento de actores

`tweet.fields` ya traía `author_id`, que es un número: sirve para deduplicar y no para
saber quién publica. **Sin el handle, el discovery encontraría conversación sin emisor:
el mismo problema que ya tenemos con Google News.**

Se añadió `expansions=author_id&user.fields=username,name`, **opt-in**. El adapter lo
comparte Candidate, donde `buscarMenciones` se usa sobre cuentas ya conocidas y el autor
no hace falta: cambiar el comportamiento por defecto le habría añadido coste sin darle
nada. Su suite (`socialProviders`, 35 pruebas) pasa sin cambios.

Resultado medido con `fetch` inyectado:

```
sourceId=x:a0   publisher=cuenta0   https://x.com/cuenta0/status/p0
sourceId=x:a1   publisher=cuenta1   https://x.com/cuenta1/status/p1
```

Cada post queda atribuido a **su cuenta**, no a la plataforma. Eso alimenta el Actor
Universe, que detecta el prefijo `x:`.

**Privacidad:** se piden `username` y `name` de cuentas **públicas** — lo mínimo para
procedencia, dedup y alta de actor. Ni métricas de seguidores, ni biografía, ni ubicación
declarada. Hay una prueba que lo fija.

### c · La ventana del proveedor viaja en el lote

`ventanaDelProveedor: "7d"`. Sin este campo, «0 resultados» se leería como «no hay nada»
cuando significa **«no hay nada en los últimos siete días»**.

---

## 4. Benchmark real: NO EJECUTADO

Ninguna llamada externa. Motivo: ambas credenciales ausentes.

| | |
|---|---|
| Peticiones YouTube | **0** |
| Cuota YouTube consumida | **0 de 10.000 unidades** |
| Peticiones X | **0** |
| Vídeos descubiertos | 0 |
| Canales descubiertos | 0 |
| Posts descubiertos | 0 |
| Cuentas descubiertas | 0 |
| Créditos ScrapeCreators | **0** |
| Coste | **0 USD** |

## 5. Antes / después

**Sin cambios en el corpus, y eso es lo correcto:** no se recolectó nada.

| | antes | después |
|---|---|---|
| Evidencias | 353 | 353 |
| Observaciones | ~1.154 | ~1.154 |
| Plataformas observadas | web | web |
| Tipos de contenido | artículo | artículo |
| **Adapters conectados a Territorial** | 3 | **4** |
| **X en el pipeline territorial** | no | **sí, esperando llave** |
| Firmas | 63 | **63** (sin tocar) |

> Más volumen no era el objetivo. El objetivo era que la activación dejara de ser
> trabajo de ingeniería.

## 6. Territorio: la regla se mantiene

Tres pruebas explícitas fijan que **la consulta no demuestra geografía**:

- una pieza de X buscada con «Cuenca» → `TERRITORIO_NO_RESOLUBLE`
- un vídeo de YouTube buscado con «Cuenca» → no atribuible
- solo el resolutor sobre el texto produce `TERRITORIO_EXPLICITO`

La procedencia de la consulta viaja **aparte** del territorio.

## 7. Discovery ≠ Measurement

| | X | YouTube |
|---|---|---|
| Contenido descubierto | post | vídeo |
| Actor descubierto | cuenta pública (`x:<id>`) | canal (`youtube:<id>`) |
| Fuente verificada | **no automáticamente** — entra `DESCUBIERTO` | igual |
| Activo medido | requiere paso posterior | requiere `resolverCanales()` |

Hay pruebas de que una cuenta descubierta **no** se marca comprobada ni verificada por
analista.

---

## 8. ACCIÓN HUMANA EXACTA

Sentinel no puede crear estas credenciales. Sin valores secretos:

### YouTube

| campo | valor |
|---|---|
| PLATFORM | YouTube Data API v3 |
| CREDENTIAL REQUIRED | API key |
| CONSOLE | Google Cloud Console → APIs y servicios → Credenciales |
| PERMISSIONS/SCOPE | habilitar **YouTube Data API v3**; una API key basta (sin OAuth) |
| VARIABLE EXPECTED | **`YOUTUBE_API_KEY`** en `apps/backend/.env` |
| NEXT HUMAN STEP | crear la key, restringirla a YouTube Data API v3, pegarla en `.env` local y reiniciar el backend |
| Coste | gratis hasta 10.000 unidades/día · una búsqueda = 100 |

### X

| campo | valor |
|---|---|
| PLATFORM | X API v2 |
| CREDENTIAL REQUIRED | Bearer token de app |
| CONSOLE | X Developer Portal → Projects & Apps → Keys and tokens |
| PERMISSIONS/SCOPE | acceso de **lectura** a `tweets/search/recent`. **Confirmar que el nivel lo incluye** |
| VARIABLE EXPECTED | **`X_BEARER_TOKEN`** en `apps/backend/.env` |
| NEXT HUMAN STEP | comprobar el nivel, generar el bearer, pegarlo en `.env` local y reiniciar |
| Coste | **depende del nivel. Verificar antes de activar** |

> **No pegar ninguna clave en el chat.** Van en `apps/backend/.env`, que está en
> `.gitignore`.

Al reiniciar, `estadoAdapters()` cambia solo: los estados se leen del adapter, no están
escritos a mano.

---

## 9. Fuera de este gate

TikTok, Instagram y Facebook siguen **sin ruta de open discovery**. TikTok es oEmbed
—confirma una URL que ya tienes—; Meta no ofrece búsqueda pública por territorio.
Documentado y no intentado.

ScrapeCreators: **0 créditos**. Ya está demostrado que observa activos conocidos y no
descubre. Data365: no integrado, sigue candidato para creadores, comunidades y
comentarios. Topic Normalization y Trend Radar: no ejecutados; 452 señales / 353
evidencias se conserva como baseline.

## 10. Limitaciones

- **Ninguna llamada real a ninguna de las dos APIs.** Todo lo verificado usa `fetch`
  inyectado. Que la construcción de la consulta sea correcta **no garantiza** que el
  proveedor responda lo esperado.
- La cuota de YouTube está **declarada en el código**, no confirmada contra Google.
- El nivel de X es **DESCONOCIDO**: `max_results=25` podría rechazarse en niveles bajos.
- Sin paginación: una llamada por consulta.
- La ventana de X son **7 días**, y no hay forma de ampliarla sin niveles superiores.

## 11. Siguiente gate

**Si aparecen las credenciales:** `TERRITORIAL-SOCIAL-BENCHMARK-01` — ejecutar el
benchmark real acotado (máximo 5 búsquedas de YouTube, 1–2 de X), medir vídeos, canales,
posts y cuentas nuevas, y comprobar cuántos resultados sobreviven al resolutor
territorial.

**Si no aparecen:** `TERRITORIAL-TOPIC-NORMALIZATION-01` — 452 señales para 353
evidencias hace ilegible la agenda y no depende de nadie externo. Es el único trabajo
grande pendiente que no está bloqueado por una llave.
