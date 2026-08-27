# SOCIAL-PROVIDER-EVAL-01

Evaluación de las vías reales para obtener datos de candidatos que **no
administramos** en TikTok, Facebook, Instagram y X.

**Fecha:** 2026-08-27 · **Gate:** SOCIAL-PROVIDER-EVAL-01
**Estado:** evaluación. **No se ha contratado ni contactado a ningún proveedor.**

---

## Advertencia sobre lo que este documento no sabe

Los precios, cuotas y niveles de acceso de estas plataformas **cambian con
frecuencia** y no los he verificado contra sus portales. Todo lo que figura como
`null` es un hueco declarado, no un cero: rellenarlo con una cifra plausible
convertiría este documento en una fuente de errores de presupuesto.

Lo que **sí** está fundado: la forma de los endpoints, qué permiso gobierna cada
acceso, y la distinción entre cuenta propia y cuenta de tercero. Eso es
estructural y cambia despacio.

La verificación de precios y cuotas es trabajo de una persona con acceso a los
portales, y está listada al final como acción concreta.

---

## La distinción que decide todo

```
CUENTA PROPIA / AUTORIZADA    el titular nos da permiso
CUENTA DE TERCERO             no nos lo da
```

Casi toda la documentación de las APIs sociales describe el primer caso. Sentinel
hace inteligencia electoral: sus objetivos son terceros que no van a autorizar
nada. **Leer «se puede consultar páginas públicas» como «cualquiera puede
consultar cualquier página» es el error que produce hojas de ruta imposibles.**

Y «requiere autorización» son en realidad dos cosas que no se parecen:

| | quién decide | ¿viable? |
|---|---|---|
| **App Review** | la plataforma revisa *nuestra* app | sí, es trabajo nuestro |
| **Autorización del titular** | el candidato observado | no, en este negocio |

---

## Matriz de capacidades

| Capacidad | YouTube | X | Instagram | Facebook | TikTok |
|---|---|---|---|---|---|
| Identidad | **MEDIDO** | PLAN_PAGO | OFICIAL_DISPONIBLE | OFICIAL_DISPONIBLE | OFICIAL_DISPONIBLE |
| Cuenta | **MEDIDO** | PLAN_PAGO | APP_REVIEW | OFICIAL_DISPONIBLE | PROVEEDOR |
| Followers | **MEDIDO** | PLAN_PAGO | APP_REVIEW | APP_REVIEW | PROVEEDOR |
| Publicaciones | **MEDIDO** | PLAN_PAGO | APP_REVIEW | APP_REVIEW | PROVEEDOR |
| Views | **MEDIDO** | PLAN_PAGO | NO_DISPONIBLE | AUTORIZACION | PROVEEDOR |
| Likes | **MEDIDO** | PLAN_PAGO | APP_REVIEW | APP_REVIEW | PROVEEDOR |
| Comments | **MEDIDO** | PLAN_PAGO | APP_REVIEW | APP_REVIEW | PROVEEDOR |
| Shares | NO_DISPONIBLE | PLAN_PAGO | NO_DISPONIBLE | APP_REVIEW | PROVEEDOR |
| Menciones | OFICIAL_DISPONIBLE | PLAN_PAGO | NO_DISPONIBLE | AUTORIZACION | PROVEEDOR |
| Búsqueda | **MEDIDO** | PLAN_PAGO | NO_DISPONIBLE | NO_DISPONIBLE | NO_DISPONIBLE |
| Histórico | NO_DISPONIBLE | PLAN_PAGO | NO_DISPONIBLE | NO_DISPONIBLE | NO_DISPONIBLE |
| URL verificable | **MEDIDO** | OFICIAL_DISPONIBLE | OFICIAL_DISPONIBLE | OFICIAL_DISPONIBLE | OFICIAL_DISPONIBLE |

Los estados salen de `services/intelligence/socialCapabilityMatrix.js` y se
**derivan** de `estado` + `verificacion` + `requisito`: no hay una etiqueta
paralela que alguien pueda dejar desincronizada.

```
MEDIDO               se ejecutó contra la API real y funcionó
OFICIAL_DISPONIBLE   existe y solo necesita la credencial que ya tenemos
REQUIERE_PLAN_PAGO   existe y está detrás de un plan
REQUIERE_APP_REVIEW  existe y la plataforma tiene que revisar nuestra app
REQUIERE_AUTORIZACION el titular observado tendría que darnos permiso
REQUIERE_PROVEEDOR   no hay vía oficial para nuestro caso de uso
NO_DISPONIBLE        no existe por ninguna vía
```

Reparto de las 60 casillas:

| | casillas |
|---|---|
| MEDIDO | 9 |
| REQUIERE_PLAN_PAGO | 11 |
| NO_DISPONIBLE | 11 |
| REQUIERE_APP_REVIEW | 10 |
| OFICIAL_DISPONIBLE | 9 |
| REQUIERE_PROVEEDOR | 8 |
| REQUIERE_AUTORIZACION | 2 |

**Solo nueve casillas están medidas, y las nueve son de YouTube.**

---

## X — la siguiente, y por qué

Es la **única** plataforma pendiente que cubre cuentas de terceros sin
autorización del titular, y la única que entrega **menciones**: quién habla del
candidato. Hoy Candidate Intelligence solo puede medir lo que el candidato
publica; esto añade la otra mitad.

Y su obstáculo es el único de los cuatro que se resuelve con una decisión nuestra
en lugar de con una solicitud a un tercero: un plan de pago.

### Endpoints

```
GET /2/users/by/username/:username?user.fields=public_metrics,description,created_at
GET /2/users/:id/tweets?tweet.fields=created_at,public_metrics
GET /2/tweets/search/recent?query=...&tweet.fields=created_at,public_metrics
GET /2/tweets/search/all            (niveles superiores)
```

Autenticación: **bearer token de aplicación**. No hace falta OAuth de usuario
para lectura pública — otra razón por la que es la más viable.

### Métricas por publicación

`like_count`, `retweet_count`, `reply_count`, `quote_count` y, cuando la API lo
incluye, `impression_count`.

Dos detalles que el adapter ya trata:

- **Repost y cita se guardan separados.** Uno amplifica sin añadir nada; el otro
  comenta. Sumarlos borra la diferencia.
- **`impression_count` no siempre viene** para publicaciones de terceros. Su
  ausencia se marca `NO_INCLUIDA_POR_LA_API`, que no es cero. Comprobarlo es uno
  de los objetivos de la primera llamada real.

### La marca de verificado no corrobora nada

En X es una **suscripción de pago**, no una comprobación de identidad. El adapter
la guarda con su advertencia para que nadie la use como señal de atribución.

### Lo que no sé de X

- El precio de cada nivel. `null`.
- Qué nivel exacto incluye lectura de timelines de terceros y `search/recent`.
  Históricamente el nivel gratuito **no** cubre lectura; hay que confirmarlo.
- Si `impression_count` llega para terceros en el nivel que se contrate.

---

## Instagram — Business Discovery

La pieza clave, y conviene entender qué autoriza:

**No necesita permiso del observado.** Necesita que *nosotros* tengamos una
cuenta profesional propia, vinculada a una página de Facebook, con una app
revisada por Meta. Y que la cuenta del objetivo sea **profesional** (business o
creator): las personales quedan fuera.

Para un candidato con cuenta de campaña, profesional es lo habitual. Para un
perfil personal, no hay vía.

```
GET /{ig-user-id}?fields=business_discovery.username(OBJETIVO){
  username,name,followers_count,media_count,
  media{id,caption,like_count,comments_count,media_type,permalink,timestamp}
}
```

Da: identidad, seguidores, publicaciones con `permalink` y `timestamp`,
`like_count` y `comments_count`.

**No da:** reproducciones de reels de terceros —son insights, y los insights son
de la cuenta propia—, compartidos, ni menciones de terceros.

### Requisitos

1. Cuenta profesional de Instagram propia, vinculada a una página de Facebook.
2. App en Meta for Developers.
3. App Review de `instagram_basic` e `instagram_manage_insights`.
4. Business Verification de la empresa.

Coste directo: **0** en licencia. El coste es **tiempo de revisión** y el riesgo
de que Meta rechace el caso de uso. No consta cuánto tarda.

---

## Facebook — Page Public Content Access

Hay una vía para terceros y no hay que confundirla con las otras: el permiso
**Page Public Content Access** permite leer contenido público de páginas que no
administramos. No lo autoriza el titular de la página: lo concede **Meta a
nuestra app**, tras App Review y verificación de empresa.

Históricamente su concesión es restrictiva y depende del caso de uso declarado.

```
GET /{page-id}?fields=id,name,fan_count,link
GET /{page-id}/posts?fields=id,created_time,permalink_url,message   (con PPCA)
GET /{post-id}?fields=comments.summary(true),reactions.summary(true),shares
```

**Los perfiles personales quedan fuera de todo.** No hay permiso que los abra —
y el candidato patrón tiene precisamente un perfil personal, no una página.

Las métricas de vídeo son insights de página y exigen el token de la página: para
un tercero no hay vía.

Meta Content Library (sucesora de CrowdTangle) cubriría menciones, pero su
elegibilidad está restringida a instituciones académicas: no es una vía para un
producto comercial.

---

## TikTok — tres APIs y ninguna sirve

| API | ¿cubre terceros? | por qué no sirve |
|---|---|---|
| Display API | no | opera sobre la cuenta que inicia sesión y autoriza por OAuth |
| Research API | sí | elegibilidad orientada a investigación académica sin ánimo de lucro |
| Commercial Content API | sí | solo contenido comercial y publicitario; nada orgánico |

Es la única plataforma del grupo donde el problema **no es un permiso que se
pueda pedir ni un plan que se pueda pagar**: es que el caso de uso no encaja en
ningún programa. De ahí que la respuesta sea proveedor.

**No se asume que podamos solicitar ni usar la Research API.** Si alguien quiere
explorarlo, el primer paso es leer sus términos vigentes, no escribir código.

---

## Evaluación de proveedores comerciales

**No se ha contactado a ninguno.** Esto es la ficha que hay que rellenar, no una
recomendación.

### Criterios

Cada proveedor debe evaluarse contra las mismas columnas, y **ninguna se rellena
por reputación de marca**:

| Criterio | Por qué importa |
|---|---|
| plataformas cubiertas | de nada sirve si le falta la que necesitamos |
| **perfiles públicos de terceros** | el criterio eliminatorio: si solo cubre cuentas propias, no sirve |
| publicaciones / vídeos | con `publishedAt` y URL |
| views · likes · comments · shares | qué métricas entrega de verdad, no en el folleto |
| followers | y si distingue oculto de ausente |
| menciones | quién habla del candidato |
| histórico | ¿entrega serie o solo el valor de hoy? |
| **cobertura Ecuador** | no se asume: muchos proveedores son fuertes en EE. UU. y flojos en LATAM |
| latencia de actualización | un dato de hace una semana no sirve en campaña |
| API | o solo panel: sin API no hay pipeline |
| **derechos de almacenamiento** | si no podemos guardar, no hay histórico longitudinal |
| **derechos de uso comercial** | licencias académicas no valen aquí |
| URLs canónicas / trazabilidad | sin evidencia primaria, incumple evidence-first |
| precio · cuota · prueba | `null` hasta que se pida presupuesto |
| estabilidad | cuántas veces han roto su API |

### Shortlist a evaluar

Suites de escucha social, todas con **cobertura Ecuador sin verificar** y
**precio sin verificar**:

| Proveedor | Nota |
|---|---|
| Brandwatch | histórico de X potencialmente amplio; comprobar TikTok |
| Talkwalker | comprobar cobertura LATAM |
| Meltwater | fuerte en medios; comprobar métricas sociales por publicación |
| Sprinklr | orientado a gestión; comprobar acceso a terceros |
| Pulsar | comprobar API y derechos de almacenamiento |
| YouScan | fuerte en imagen; comprobar Ecuador |

Y, aparte de las suites, **APIs de datos sociales especializadas**, que suelen ser
más baratas y más directas para este caso — pero que hay que filtrar por
legitimidad: varias operan raspando sin licencia, y eso queda descartado por
política, no por precio.

### Los dos criterios eliminatorios

1. **Sin derechos de almacenamiento no hay Candidate Intelligence.** Todo el
   modelo longitudinal depende de guardar snapshots. Un proveedor que solo
   permita consultar en vivo no sirve, por bueno que sea.
2. **Sin URL canónica por pieza, incumple evidence-first.** Una cifra sin enlace
   verificable no se puede publicar en este sistema.

---

## Acciones concretas

| # | Acción | Quién | Desbloquea |
|---|---|---|---|
| 1 | Crear proyecto y app en el portal de X, obtener bearer token, **anotar el precio real del nivel que incluya lectura de timelines** | David | 11 casillas de X |
| 2 | Poner `X_BEARER_TOKEN` en `apps/backend/.env` | David | primera llamada real de X |
| 3 | Crear cuenta profesional de Instagram propia + página de Facebook | David | inicia el camino de Instagram |
| 4 | App en Meta for Developers y solicitar App Review + Business Verification | David | 10 casillas de Instagram y Facebook |
| 5 | Pedir presupuesto a dos proveedores de la shortlist declarando el caso de uso | David | TikTok |
| 6 | Leer los términos vigentes de la TikTok Research API antes de escribir código | quien lo explore | descarta o abre TikTok |

### Credenciales necesarias

```
X_BEARER_TOKEN        pendiente        ← el siguiente paso
YOUTUBE_API_KEY       ya configurada
```

Ninguna otra plataforma se desbloquea con una credencial: Instagram y Facebook
necesitan revisión de app, y TikTok un proveedor.

---

## Qué conectar primero

**X.** Por este orden de razones:

1. Es la única pendiente que cubre **terceros sin autorización del titular**.
2. Es la única que da **menciones**, que es la mitad que le falta a Candidate
   Intelligence: hoy solo mide lo que publica el candidato.
3. Su obstáculo es una **decisión nuestra** —contratar un plan—, no una
   solicitud que otro tiene que aprobar.
4. El adapter ya está escrito y probado. Solo espera la credencial.

Después, **Instagram** vía Business Discovery: coste de licencia cero y el
candidato patrón tiene dos cuentas ahí. El coste es tiempo de revisión.

**Facebook** tercero, y con una advertencia: el candidato patrón tiene un
**perfil personal**, que ningún permiso abre. Habría que comprobar cuántos
candidatos usan página y cuántos perfil antes de invertir en la App Review.

**TikTok último**, no por prioridad de producto —es alta— sino porque es el único
que exige gasto en un proveedor y una negociación.
