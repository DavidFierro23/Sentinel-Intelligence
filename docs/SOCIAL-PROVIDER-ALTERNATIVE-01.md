# SOCIAL-PROVIDER-ALTERNATIVE-01

**Alternativa real a Bright Data para cerrar Facebook + TikTok + Comments**
2026-08-31 · **0 requests a proveedores** · **0 USD** · Bright Data no se tocó

> **Ningún proveedor está verificado.** Estado máximo alcanzado en este
> documento: `UNVERIFIED_PROVIDER`. Nada de lo que sigue es cobertura.

---

## 1. Bright Data deja de ser camino crítico

    estadoComercial: BLOQUEADO_POR_PROVEEDOR
    aprobadoParaOperar: false
    bloqueadoDesde: 2026-08-31
    requests: 0 · coste: 0 USD

La cuenta sigue suspendida pese a haberse enviado la verificación. **No se hizo
ni una sola petición** en este gate, no se pagó, no se añadió tarjeta, no se
volvió a verificar.

**Y esto no es un fallo de Sentinel.** No lo es del adapter, ni de la URL de
Pedro Palacios, ni de Facebook, ni de TikTok: nunca se llegó a hacer una
llamada. El bloqueo es del proveedor y está registrado como tal en el código,
no solo aquí.

Se conserva como candidato futuro. Deja de ser dependencia.

---

## 2. El criterio que ordenó la búsqueda

Con una campaña con fecha encima, la pregunta dejó de ser «quién tiene mejor
cobertura» y pasó a ser **«a quién puedo probar hoy»**.

Eso parte a los proveedores en dos grupos, y el corte es más decisivo que
cualquier tabla de features:

| | Alta autoservicio | Llamada comercial primero |
|---|---|---|
| se puede probar hoy | **sí** | no |

---

## 3. Los tres evaluados

### 3.1 ScrapeCreators — **PROVEEDOR #1**

`scrapecreators.com` · docs públicas en `docs.scrapecreators.com`

**Cubre exactamente los cuatro huecos**, y eso se comprobó endpoint por
endpoint en su documentación:

| Hueco | Endpoint |
|---|---|
| Facebook perfil/Page | `/v1/facebook/profile` |
| Facebook publicaciones | `/v1/facebook/profile/posts` |
| **Facebook comentarios** | `/v1/facebook/post/comments` |
| Facebook respuestas | `/v1/facebook/post/comment/replies` |
| TikTok perfil | `/v1/tiktok/profile` |
| TikTok vídeos | `/v3/tiktok/profile/videos` · `/v2/tiktok/video` |
| **TikTok comentarios** | `/v1/tiktok/video/comments` |
| TikTok respuestas | `/v1/tiktok/video/comment/replies` |

- **Acceso:** **100 créditos gratis, sin tarjeta.** Alta autoservicio.
- **Precio:** $47 / 25.000 créditos (~$1,88 por 1.000) · $497 / 500.000
  (~$0,99 por 1.000). **Los créditos no caducan** y los resultados cacheados
  cuestan 0.
- **Autenticación:** cabecera `x-api-key`. **Ningún endpoint funciona sin
  clave** — por eso no se pudo probar hoy.
- **Documentación:** pública, con OpenAPI. No hace falta hablar con nadie para
  leerla, que es lo que lo pone por delante de Data365.

**Veredicto: APTO_PARA_PRUEBA — requiere alta manual.**

### 3.2 SocialCrawl — **PROVEEDOR #2**

`socialcrawl.dev`

- 51 plataformas, 420 endpoints. **Facebook 24 · TikTok 33 · Instagram 36.**
- Documenta "Post Comments" y "Video Comment Replies": **comentarios con
  texto y respuestas** en las dos plataformas que nos faltan.
- Esquema unificado entre plataformas —autor, engagement, metadata—, que
  encaja bien con nuestro normalizador.
- **Acceso:** **100 créditos gratis, sin tarjeta.** Sin suscripción: 1 crédito
  por llamada, £15 / 2.500 hasta £299 / 150.000. Créditos sin caducidad.

Queda en #2 solo porque su documentación pública **detalla menos los campos**
por endpoint. En cobertura declarada es comparable.

**Veredicto: APTO_PARA_PRUEBA — requiere alta manual.**

### 3.3 Data365 — descartado para la vía rápida

`data365.co`

- Cobertura declarada buena: Facebook, Instagram, X, TikTok, Reddit, Threads,
  Pinterest, con comentarios públicos y el desglose de reacciones más rico que
  se encontró en el gate anterior.
- **Trial de 14 días sin tarjeta** — pero el acceso y **la documentación de
  créditos llegan después de una llamada introductoria**.
- Precio: ~$0,60 / 1.000 registros desde ~300 €/mes.

No es que sea peor. Es que **no se puede probar hoy**, y hoy es el criterio.

**Veredicto: REQUIERE_LLAMADA_COMERCIAL.**

---

## 4. Comparativa

| | ScrapeCreators | SocialCrawl | Data365 |
|---|---|---|---|
| Facebook Pages terceros | DOCUMENTADO | DOCUMENTADO | DOCUMENTADO |
| Facebook posts | DOCUMENTADO | DOCUMENTADO | DOCUMENTADO |
| **Facebook comment_text** | **DOCUMENTADO** | **DOCUMENTADO** | **DOCUMENTADO** |
| Facebook replies | DOCUMENTADO | DOCUMENTADO | NO_DOCUMENTADO |
| TikTok perfil + métricas | DOCUMENTADO | DOCUMENTADO | DOCUMENTADO |
| **TikTok comment_text** | **DOCUMENTADO** | **DOCUMENTADO** | NO_DOCUMENTADO |
| Instagram | DOCUMENTADO | DOCUMENTADO | DOCUMENTADO |
| Histórico | NO_DOCUMENTADO | NO_DOCUMENTADO | NO_DOCUMENTADO |
| IDs estables / permalinks | NO_PROBADO | NO_PROBADO | NO_PROBADO |
| Ecuador / LATAM | NO_DOCUMENTADO | NO_DOCUMENTADO | NO_DOCUMENTADO |
| Trial | 100 créditos | 100 créditos | 14 días |
| **Tarjeta** | **no** | **no** | no |
| **Acceso inmediato** | **sí** | **sí** | **no** |
| Precio | $47 / 25K | £15 / 2,5K | ~300 €/mes |
| Veredicto | **APTO_PARA_PRUEBA** | APTO_PARA_PRUEBA | REQUIERE_LLAMADA |

**Todo lo anterior es DOCUMENTADO, no PROBADO.** Ninguna celda de la matriz de
capacidades se movió: los tres siguen en `UNVERIFIED_PROVIDER`.

**Ninguno documenta histórico de comentarios.** Es el hueco que sigue abierto
para todos y que tendrá que cubrir el Lake acumulando snapshots.

### Puntuación cualitativa

| Dimensión | Peso | ScrapeCreators | SocialCrawl | Data365 |
|---|---|---|---|---|
| Facebook | 25% | ALTO | ALTO | ALTO |
| TikTok | 25% | ALTO | ALTO | MEDIO |
| Comment text | 20% | ALTO | ALTO | MEDIO |
| Histórico | 10% | NO_VERIFICADO | NO_VERIFICADO | NO_VERIFICADO |
| IDs / provenance | 10% | NO_VERIFICADO | NO_VERIFICADO | NO_VERIFICADO |
| Integración | 5% | ALTO | MEDIO | BAJO |
| Coste / trial | 5% | ALTO | ALTO | BAJO |

---

## 5. Prueba real: **no ejecutada, y por qué**

**Los tres exigen crear una cuenta.** ScrapeCreators y SocialCrawl lo dicen
explícitamente: *todas* las peticiones requieren `x-api-key` y no hay ningún
endpoint abierto.

Sentinel **no crea cuentas externas en nombre del usuario**, así que el gate se
detiene aquí y entrega instrucciones en lugar de resultados.

Los activos que se usarían están **leídos del Lake, no inventados**:

    Facebook   facebook:pedropalaciosu          DECLARADA_POR_ANALISTA
               https://www.facebook.com/pedropalaciosu
               (también existe facebook:pedropalaciosullauri, ATRIBUIDA)

    TikTok     tiktok:yaku.perez                REVALIDADA
               https://www.tiktok.com/@yaku.perez

No se usa `@lafondadecarrasco`: su atribución quedó
`COMPATIBLE_NO_CONFIRMADA` y probar con ella mezclaría dos preguntas
distintas —si el proveedor sirve y si la cuenta es del candidato—.

---

## 6. Lo que sí se construyó: la pieza que faltaba

`SOCIAL-PROVIDER-REAL-01-PREP` había dejado todo menos el cliente HTTP. Ahora
existe: **`services/ingest/adapters/socialProviderClient.js`**.

Es **genérico a propósito**. Bright Data cayó, y un cliente escrito para Bright
Data habría que tirarlo hoy. Este lee del registro la base, la cabecera de
autenticación y los endpoints: **cambiar de proveedor es cambiar una entrada de
datos**, no este archivo.

Cuatro decisiones que están fijadas por test:

**La guarda va antes de la red.** Un cliente que sale a la red y luego
comprueba si podía ya gastó el crédito. Hoy los cuatro proveedores devuelven
`llamadas: 0` aunque se les pase la bandera encendida y una clave.

**No se inventan URLs.** Si el proveedor no declara ese endpoint para esa
plataforma, se devuelve `ENDPOINT_NO_DECLARADO` y no se gasta crédito.

**La clave nunca sale.** Viaja en cabecera —jamás en la URL— y se redacta del
resultado, de la traza y del mensaje de error. Incluido el caso feo: cuando el
propio proveedor hace eco de la clave en su error, que es justo el texto que
alguien copia y pega.

**Los bloqueos no se confunden.** 401/403 credencial · 402 facturación · 429
cuota · resto error. Misma lección que X-REAL-01: leer un 402 como problema de
credencial manda a revisar el token cuando lo que falta es pagar.

**Lo que el cliente NO hace,** declarado en su propio diagnóstico: rotación de
proxies, resolución de captchas, falsificación de huella y automatización de
login. Si un proveedor necesitara eso de nuestra parte, el proveedor no sirve.

**Resultado:** ejecutar la prueba real ya no depende de escribir código. Depende
de que exista una clave.

---

## 7. Qué necesitamos de usted — exactamente

Tres pasos, ~5 minutos, **$0**:

1. **Crear cuenta en ScrapeCreators** (`app.scrapecreators.com`) — 100 créditos
   gratis, **sin tarjeta**.
2. **Copiar la API key** desde su panel.
3. **Pegarla en `apps/backend/.env`**, que está en `.gitignore`:

   ```
   SOCIAL_EXTERNAL_PROVIDER_ENABLED=true
   SCRAPECREATORS_API_KEY=<la clave>
   ```

**No la pegue en el chat.** No hace falta que yo la vea: el código la lee del
entorno.

Y una cuarta cosa que hago yo, no la configuración: marcar el proveedor como
aprobado en el registro. Es un cambio de código deliberado, para que aprobar un
proveedor quede en el historial de git y no en la máquina de alguien.

Si prefiere SocialCrawl, el procedimiento es idéntico con
`SOCIALCRAWL_API_KEY`, y habría que añadir sus endpoints al registro.

---

## 8. La prueba, cuando haya clave

Presupuesto estimado: **~10 créditos de los 100 gratuitos.**

| Paso | Llamadas |
|---|---|
| Facebook perfil `pedropalaciosu` | 1 |
| Facebook 1 post | 1 |
| Facebook comentarios de ese post | 1 |
| TikTok perfil `yaku.perez` | 1 |
| TikTok 1 vídeo | 1 |
| TikTok comentarios | 1 |
| Rerun para dedup e IDs estables | ×2 |

Y se comprueba lo que de verdad decide, no que devuelva 200: **texto de
comentarios**, permalink canónico, e **IDs estables entre las dos ejecuciones**
con `firstObservedAt` inmóvil y `lastObservedAt` avanzando.

Cada capacidad se promueve **una a una**. Si se miden posts y no comentarios,
comentarios sigue `UNVERIFIED_PROVIDER`.

---

## 9. Candidate Intelligence **no espera**

Decisión explícita de este gate: la falta de proveedor **no bloquea** el
avance.

    X                      MEDIDO_OFICIAL      sigue generando snapshots
    YouTube                MEDIDO_OFICIAL      sigue generando snapshots
    Instagram profesional  MEDIDO_OFICIAL      3 de 12 activos
    Instagram personal     NO_SOPORTADO        9 de 12, ninguna vía oficial
    Facebook propio        PARCIAL             metadata; posts sin permiso
    Facebook terceros      REQUIERE_PROVEEDOR  10 de 11 activos
    TikTok identidad       MEDIDO_OFICIAL      oEmbed, gratis
    TikTok métricas        REQUIERE_PROVEEDOR
    Comment text           NO_PROBADO          ninguna plataforma

Ninguna celda queda ambigua. No hace falta que todo esté en verde: hace falta
que todo esté **resuelto**, y un `REQUIERE_PROVEEDOR` explícito es un resultado,
no un hueco.

El siguiente gate —`P-CAND-SOCIAL-BENCH-02`— puede ejecutarse **ya**, con estos
estados declarados, mientras la validación del proveedor sigue en paralelo.

---

## 10. Riesgo, sin suavizar

Los tres candidatos **raspan web pública; ninguno es proveedor licenciado** por
Meta ni por TikTok. Va contra los ToS de las plataformas aunque el dato sea
público, y la continuidad no está garantizada.

Lo que sí se conserva es la citabilidad: los permalinks son canónicos.

Bright Data acaba de demostrar el otro riesgo, el operativo: **un proveedor
puede desaparecer sin aviso**. Por eso el cliente es genérico y por eso la
arquitectura es híbrida — lo que ya funciona por vía oficial no se sustituye.

**Es una decisión de negocio, no técnica.**
