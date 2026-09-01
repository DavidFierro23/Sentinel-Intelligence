# TERRITORIAL-OPEN-LISTENING-EXPANSION-01

## Escucha digital pública abierta — Cuenca

**Fecha:** 2026-09-01 · **Proyecto:** `alcaldia-cuenca-2027-piloto`
**Coste:** **0 USD** · 0 créditos de proveedor · solo HTTP público

---

## 1. Baseline

| | |
|---|---|
| Evidencias | 319 |
| Observaciones | 922 |
| Dominios | 14 |
| Actores | 14 |
| Señales | 403 |
| A · territorio explícito | 127 |
| B · fuente local sin topónimo | 12 |
| C · nacional relacionado | 180 |
| Fuentes locales con feed | 9 |

---

## 2. Auditoría de infraestructura: qué hay y en qué estado

Se auditó el repositorio antes de escribir una línea de conector. Resultado, sin
exponer secretos:

| motor | en el repo | credencial | capacidad |
|---|---|---|---|
| `youtubeAdapter` | 927 líneas | **SIN_CREDENCIAL** | `buscar()` → **discovery real**, + `resolverCanales`, `resolverCanalPorHandle` |
| `xAdapter` | 627 líneas | **SIN_CREDENCIAL** | `buscarMenciones()` sobre `/tweets/search/recent` → **discovery, ventana 7 días** |
| `tiktokAdapter` | 344 líneas | no requiere | **oEmbed**: `confirmarCuenta()` de una URL conocida. **Sin búsqueda** |
| `instagramAdapter` | 1.632 líneas | **SIN_CREDENCIAL** | Graph API de activos conocidos |
| `braveProvider` | 379 líneas | **sin configurar** | `buscar()` → web abierta |
| `serpapiProvider` | — | **sin configurar** | web abierta |
| `duckProvider` | — | **no requiere · OK** | `buscar()` → **la única ruta web operativa hoy** |
| `socialProviderClient` (ScrapeCreators) | 339 líneas | bandera **APAGADA** | `SOCIAL_EXTERNAL_PROVIDER_ENABLED` off: ningún proveedor externo sale a la red |

> **El código de discovery para YouTube y X ya existe.** Lo que falta es la llave, no el
> conector. Eso cambia el orden de prioridades: no hay que construir, hay que habilitar.

---

## 3. Discovery ≠ Observation — la distinción que decide todo

| plataforma | DISCOVERY (¿quién/qué importa?) | OBSERVATION (activo conocido) |
|---|---|---|
| Web abierta | **SÍ** — Duck operativo; Brave/SerpAPI sin llave | n/a |
| YouTube | **SÍ, en el código** — `buscar()`; bloqueado por llave | sí |
| X | **SÍ, en el código** — `search/recent`, 7 días; bloqueado por llave | sí |
| TikTok | **NO** — oEmbed solo confirma una URL que ya tienes | sí, vía ScrapeCreators |
| Instagram | **NO** — Graph API no busca por territorio | sí |
| Facebook | **NO** — sin búsqueda pública | sí, páginas públicas |

**ScrapeCreators**, mapeado en el repo (`scrapeCreatorsMapper.js`): `perfilDe*`,
`publicacionesDe*`, `comentariosDe*` para Facebook, TikTok e Instagram.

> **Todo lo que ScrapeCreators expone es OBSERVACIÓN de activos conocidos. No hay una
> sola función de búsqueda ni de descubrimiento.** Es excelente para lo que hace y no
> resuelve la pregunta territorial: *¿quién importa en Cuenca?*

Esa asimetría es la conclusión central del gate: **Candidate parte de un nombre;
Territorial no sabe a quién buscar.**

---

## 4. La ruta que sí funciona hoy: búsqueda web

`duckProvider` está configurado y responde. Tres consultas, sin credencial, **coste 0**:

```
Deportivo Cuenca noticias oficiales      OK  10 resultados
cultura eventos Cuenca Ecuador agenda    OK  10 resultados
Universidad de Cuenca noticias           OK  10 resultados
                                         → 17 dominios NUEVOS
```

### Lo que encontró que el corpus RSS no podía encontrar

| fuente | dominio | veredicto | hueco que cierra |
|---|---|---|---|
| **Club Deportivo Cuenca** | `clubdeportivocuenca.com` | **VERIFICADO_FEED** | **deporte local** |
| **Dirección General de Cultura de Cuenca** | `cultura.cuenca.gob.ec` | **VERIFICADO_FEED** | **cultura y agenda de eventos** |
| **Casa de la Cultura · Núcleo del Azuay** | `cceazuay.gob.ec` | **VERIFICADO_FEED** | **cultura** |
| **Agencia Universitaria de Noticias** | `agencianoticiasuc.com` | **VERIFICADO_FEED** | **universidad** |
| El Digital de Cuenca | `eldigitaldecuenca.com` | VERIFICADO_SIN_FEED | medio digital local |
| CD Cuenca Deportiva | `cuencadeportiva.com` | NO_PUBLICA_RSS | deporte |

Además aparecieron **activos sociales públicos** de actores locales ya conocidos:
Deportivo Cuenca en Facebook, YouTube e Instagram; UCuenca en X. Eso es el patrón
correcto: **descubrir por búsqueda, observar por proveedor.**

### La trampa propia de la búsqueda por texto

Las mismas consultas devolvieron `ociocuenca.es` y
`agendacultural.castillalamancha.es`: **son Cuenca, ESPAÑA**. Un descubridor por texto
no distingue cantones homónimos. Por eso ninguna fuente entra sin comprobación HTTP ni
sin que un analista declare su ámbito, y la nota queda escrita en el módulo.

**Limitación real de Duck:** raspado HTML con limitación de tasa (~1–2 consultas
seguidas), prioridad 3, presupuesto 2 consultas por investigación. Es una ruta de
descubrimiento **puntual**, no un motor de monitorización continua.

---

## 5. El filón de $0 que estábamos tirando: las firmas

`rssAdapter` extraía el autor de `dc:creator` y `author` desde INGEST-REAL-01, y el
libro de evidencias **lo descartaba al persistir**.

Medido sobre cuatro feeds locales reales:

```
El Mercurio             10 items, 10 con author   ej. Andrés Mazza
La Voz del Tomebamba    10 items, 10 con author   ej. Juan Pablo Campoverde
Unsión TV               10 items, 10 con author   ej. Redes Sociales
EMAC EP                 10 items, 10 con author   ej. Pedro Andrade
                        40 de 40 (100 %)
```

Se estaba perdiendo el **100 %** de una señal ya presente en los datos.

### Resultado tras persistirla

| | |
|---|---|
| Evidencias con firma | **208 de 353** |
| **Firmas distintas** | **63** |
| Clasificadas PERSONA | 54 |
| Clasificadas SECCIÓN | 2 |
| Sin clasificar | 7 |
| Medios con firma | **16** |

### Firma no es periodista

Los mismos feeds devuelven personas («Andrés Mazza»), secciones («Redes Sociales») y
etiquetas de sistema («Administrador CCE Azuay», «Publicacion Noticias»). Tratarlas
igual produciría un periodista llamado Redes Sociales.

La firma se guarda siempre —es un hecho sobre la pieza— y la promoción a PERSONA exige
que el clasificador de entidades lo respalde, **con su confianza expuesta**. Sigue
fallando de forma visible: tipa «Publicacion Noticias» como PERSONA. Se declara.

### Privacidad — un problema que este gate creó y corrigió

La primera pasada persistió `agencianoticiasuc@gmail.com` en el campo de autor. **Un
correo es un dato de contacto personal, no una firma editorial.** Se añadió
minimización al persistir: se conserva el usuario, se descarta el dominio.

Una firma guarda **nombre publicado, medio y piezas**. Nada más: ni contacto, ni redes,
ni biografía, ni atributos sensibles. `datosPersonales` es `null` por decisión, con
prueba que lo fija.

---

## 6. Expansión por enlaces: hipótesis descartada con medición

Se auditó el corpus buscando URLs sociales explotables:

```
319 evidencias · 319 con canonicalUrl
    2 URLs sociales en canonicalUrl
    0 URLs sociales dentro de los resúmenes
```

Los resúmenes de RSS son extractos de texto sin enlaces. **La expansión por enlaces no
daría prácticamente nada con este corpus.** Se descarta como vía principal —barato de
comprobar, barato de descartar— y solo tendría sentido con cuerpos completos, que no se
guardan por política de almacenamiento.

---

## 7. Matriz de cobertura

| dimensión | estado | evidencias | causa |
|---|---|---|---|
| Noticias | **OPERATIVO** | 353 | evidencia real |
| RSS de medios | **OPERATIVO** | 353 | 19 feeds comprobados |
| Instituciones | **OPERATIVO** | 51 | 6 instituciones locales con feed |
| Enlaces y dominios | **OPERATIVO** | 353 | URL canónica y dominio resueltos |
| Medios digitales | PARCIAL | 353 | universo no exhaustivo |
| **Periodistas** | **PARCIAL** ← era NO_PROBADO | **208** | 63 firmas en 16 medios; promoción heurística |
| Temas emergentes | PARCIAL | 452 señales | sobre-fragmentación |
| Territorio explícito | PARCIAL | 155 | 186 piezas nacionales sin topónimo |
| Histórico | PARCIAL | 353 | empezó hace dos días |
| Tendencias | PARCIAL | 0 declarables | sin ventana comparable observada |
| Web abierta | **REQUIERE_PROVEEDOR** | 0 | Brave/SerpAPI sin llave; Duck sirve para discovery puntual |
| YouTube | NO_PROBADO | 0 | **conector con búsqueda listo**, sin llave |
| X | NO_PROBADO | 0 | **`search/recent` listo**, sin llave |
| Facebook · Instagram · TikTok | NO_PROBADO | 0 | sin ruta de descubrimiento territorial |
| Comentarios públicos | NO_DISPONIBLE | 0 | requiere proveedor |
| Influencers y creadores | NO_DISPONIBLE | 0 | requiere descubrimiento social |
| Comunidades públicas | NO_DISPONIBLE | 0 | requiere búsqueda por lugar |
| Marcas y empresas | NO_PROBADO | 0 | no se intentó observarlas como fuente |

**4 OPERATIVO · 6 PARCIAL · 6 NO_PROBADO · 3 NO_DISPONIBLE · 1 REQUIERE_PROVEEDOR.**

**Fuera de alcance por decisión:** rastreo individual, dispositivos, atributos sensibles,
perfiles privados, inferencia de comportamiento político individual.

---

## 8. Antes / después

| | ANTES | DESPUÉS | CAMBIO |
|---|---|---|---|
| Evidencias | 319 | **353** | +34 |
| Observaciones | 922 | **1.154** | +232 |
| Dominios | 14 | **18** | +4 |
| Actores | 14 | **18** | +4 |
| **Firmas** | **0** | **63** | **+63** ← dimensión nueva |
| Medios con firma | 0 | **16** | +16 |
| Fuentes locales con feed | 9 | **12** | +3 |
| Feeds elegibles | 15 | **19** | +4 |
| Fichas del universo | 33 | **39** | +6 |
| A · territorio explícito | 127 | **155** | **+28** |
| B · fuente local sin topónimo | 12 | 12 | — |
| C · nacional relacionado | 180 | 186 | +6 |
| D · no resoluble | 0 | **0** | — |
| Tipos de actor | 3 | 3 | — |
| Plataformas | web | **web** | — |
| Señales | 403 | 452 | +49 |

**Las 34 evidencias nuevas vinieron íntegras de las 4 fuentes descubiertas** en su
primera pasada (pasada 18: 34 observadas, 34 nuevas, 0 duplicadas). Las pasadas 19 y 20
dieron **0 nuevas y 198 duplicadas**: el dedup aguanta.

### Diversidad y dominancia

```
79  expreso.ec        22 % del corpus
76  extra.ec
40  teleamazonas.com
22  elmercurio.com.ec
16  unsion.tv
```

**SOURCE_DOMINANCE_RISK: no.** La fuente principal está en el 22 %, por debajo del
umbral declarado del 30 %. Antes de la expansión Extra llegaba al 27 %: **la
diversificación bajó la dominancia**.

### ¿Encontró algo que el RSS anterior no podía? — SÍ

- un **club de fútbol** (Club Deportivo Cuenca)
- dos **fuentes culturales** con agenda de eventos
- una **agencia universitaria** de noticias
- **63 firmas** en 16 medios: una dimensión de actor que no existía
- **activos sociales públicos** de actores locales, listos para observación futura

Lo que **no** aparece todavía: creadores, comunidades, comentarios, marcas, turismo,
clima, entretenimiento. Todos dependen de plataformas sin ruta de descubrimiento.

---

## 9. Proveedores: qué sí y qué no

### ScrapeCreators — reutilizable para OBSERVAR, no para DESCUBRIR

| capacidad | Candidate | Territorial | tipo |
|---|---|---|---|
| Perfil de FB/IG/TikTok | sí | **sí, si le damos la cuenta** | observación |
| Publicaciones | sí | **sí, si le damos la cuenta** | observación |
| **Comentarios públicos** | sí | **sí, si le damos el post** | observación |
| Búsqueda por palabra clave | — | **NO existe** | — |
| Descubrimiento de creadores | — | **NO existe** | — |

**Créditos usados: 0.** No se gastó ninguno porque la auditoría del mapper resolvió la
pregunta: no hay endpoint de búsqueda. Gastar créditos no habría cambiado la respuesta.

**Dónde sí encaja:** los activos sociales que la búsqueda web descubrió —Deportivo
Cuenca en FB/YouTube/IG, UCuenca en X— son exactamente activos conocidos. Ese es el
patrón viable: **Duck descubre la cuenta, ScrapeCreators la observa.**

### Data365 — sigue justificado, sin cambios

Este gate **confirmó que no hay alternativa** a su hueco: ninguna plataforma del stack
permite descubrimiento por territorio, y el agregador tampoco revela actores locales.
Creadores, comunidades y comentarios siguen en `NO_DISPONIBLE`. **No se contrató ni se
probó.**

### GDELT — su argumento se ha debilitado más

El valor era doble: geo explícita e histórico. **El geo ya no es el cuello de botella:**
A pasó de 107 a 155 en dos gates sin proveedor. Y su DOC API sigue inalcanzable desde
esta máquina. Queda el histórico, por BigQuery. **No integrar todavía.**

### No se investigaron proveedores adicionales

La consigna era investigarlos solo si existía un gap no cubierto por infraestructura
propia + ScrapeCreators + Data365. **No aplica:** los gaps restantes se cubren con
credenciales de YouTube y X —cuyo código de discovery ya existe— o con Data365. Añadir
SaaS a la lista habría sido ruido.

---

## 10. Modelo de coste para monitorizar Cuenca 24/7

| ruta | requests/día | driver de coste | estado |
|---|---|---|---|
| RSS (19 feeds, 8 por pasada) | ~96 con 12 pasadas | ninguno, feeds públicos | **0 USD** |
| Búsqueda web (Duck) | 2–6 | limitación de tasa, no dinero | **0 USD** |
| YouTube discovery | 1 búsqueda = **100 de 10.000 unidades**/día | cuota diaria | requiere llave |
| X `search/recent` | según nivel | **DESCONOCIDO** — depende del tier | requiere llave |
| Brave | 1 por consulta | tarifa por consulta, **DESCONOCIDA** sin cuenta | requiere llave |
| ScrapeCreators | 1 por activo/post | créditos por petición | flag apagada |
| Data365 | ~0,60 USD/1.000 registros | volumen | **REQUIERE COTIZACIÓN** |

**Crecimiento de almacenamiento observado:** 1.154 observaciones y 353 evidencias en
tres días de operación intermitente. Con 12 pasadas diarias de 19 feeds la estimación es
de **cientos de observaciones/día**, que el ledger append-only absorbe sin problema; el
coste real aparecería si se añaden cuerpos completos o comentarios.

> Las cifras marcadas DESCONOCIDO **no se inventan**. Exigen cuenta o cotización.

---

## 11. Arquitectura recomendada

El diseño objetivo del gate ya está implementado en su tramo web/news. Lo que falta son
las dos ramas sociales, y ambas dependen de credenciales o proveedor:

```
                    OPEN LISTENING
          ┌───────────────┼────────────────┐
      WEB/NEWS          SOCIAL          VIDEO
    Duck ✅ RSS ✅   sin ruta ❌      YouTube 🔑
          └───────────────┼────────────────┘
                    RAW EVIDENCE ✅
                  IDENTITY/DEDUPE ✅
            SOURCE/ACTOR/FIRMA UNIVERSE ✅
                  KNOWLEDGE LAKE ✅
             TERRITORIAL INTELLIGENCE ✅
                TOPIC NORMALIZATION ⏳
                    TREND RADAR ⏳
```

**Flujo de crecimiento automático del Source Universe**, ya operativo en su primer tramo:

```
seed → evidencia observada → búsqueda web → dominio candidato
     → comprobación HTTP → clasificación por analista → universo → rotación
```

Lo que le falta para cerrarse solo: que el descubrimiento se dispare **desde las señales
del corpus** en lugar de consultas escritas a mano. Eso es diseño, no credencial.

---

## 12. Limitaciones

- **Ninguna plataforma social fue probada.** Todas quedan `NO_PROBADO` o
  `NO_DISPONIBLE`, no «cero».
- La clasificación de firmas es **heurística sin verificar** y falla visiblemente.
- Duck tiene limitación de tasa: sirve para descubrimiento puntual, no continuo.
- **452 señales para 353 evidencias**: la fragmentación empeora al crecer el corpus.
- 0 tendencias declarables: el histórico tiene dos días.
- No se leyeron términos de servicio de ninguna plataforma ni proveedor.

## 13. Siguiente gate

**`TERRITORIAL-CREDENTIAL-ACTIVATION-01`** — habilitar YouTube y X.

Es la conclusión que sale de la auditoría, no una preferencia: **el código de
descubrimiento para las dos plataformas ya existe y está probado en Candidate**. No hay
que construir nada. Con una llave de YouTube Data API y una de X se pasarían dos
dimensiones de `NO_PROBADO` a medible, y son las dos únicas donde el discovery
territorial es técnicamente posible hoy sin contratar a nadie.

Si no hay llaves disponibles, la alternativa es
**`TERRITORIAL-TOPIC-NORMALIZATION-01`**: 452 señales para 353 evidencias ya hace que la
agenda no sea legible, y no depende de nadie externo.
