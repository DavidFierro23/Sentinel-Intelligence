# META-PUBLIC-ACCESS-01

Viabilidad de la vía **oficial** de Meta para que Sentinel observe datos públicos
de **terceros** —candidatos que no administramos— en Instagram y Facebook.

**Fecha:** 2026-08-28 · **Gate:** META-PUBLIC-ACCESS-01
**Naturaleza:** documental. No se cambió configuración, no se generaron tokens,
no se inició App Review ni Business Verification.

---

## Documentos oficiales consultados

| Documento | Qué aportó |
|---|---|
| [Instagram Platform](https://developers.facebook.com/docs/instagram-platform) | los flujos vigentes y cuál soporta terceros |
| [IG User `business_discovery`](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery) | nodo, token, permisos, tipos de cuenta y campos |
| [Page Public Content Access](https://developers.facebook.com/docs/features-reference/page-public-content-access) | estado actual y requisitos |
| [Business Verification](https://developers.facebook.com/docs/development/release/business-verification) | cuándo es obligatoria |
| [Access Levels](https://developers.facebook.com/docs/graph-api/overview/access-levels) | Standard vs Advanced |
| [Permissions Reference](https://developers.facebook.com/docs/permissions) | vigencia de cada permiso |
| [Page node](https://developers.facebook.com/docs/graph-api/reference/page/) | qué campos de una Page ajena son públicos |

Todo lo que sigue sale de ahí. Lo que no esté documentado se marca
`NO_DOCUMENTADO`, no se infiere.

---

## La cadena, en una frase

> Para leer a un tercero hace falta **Advanced Access**; Advanced Access exige
> **Business Verification**; y el endpoint que sirve a terceros vive en el flujo
> de **Facebook Login**, no en el que tenemos.

Los tres eslabones están confirmados por documentación oficial, y ninguno es
opcional.

---

## 1 · Los flujos de Instagram

Meta documenta dos vías relevantes, y la diferencia entre ellas es exactamente
nuestro problema.

| | Instagram API **con Instagram Login** | Instagram API **con Facebook Login for Business** |
|---|---|---|
| Host | `graph.instagram.com` | `graph.facebook.com` |
| Token | Instagram User token | **Facebook User access token** |
| Cuentas | Business y Creator | Business y Creator **vinculadas a una Página** |
| Página de Facebook | no hace falta | **obligatoria** |
| Para qué | mensajería, publicación, comentarios, menciones **de la cuenta conectada** | lo anterior **más** metadatos y métricas de **otras** cuentas |
| `business_discovery` | **no** | **sí** |
| Estado | vigente | vigente |

**Es el que tenemos.** El token que usa Sentinel hoy es de la columna izquierda.
Por eso la etapa A de META-IG-REAL-01 funcionó entera y la B devolvió 190.

---

## 2 · `business_discovery` — vigente, y con condiciones

Sigue existiendo y no aparece marcado como deprecado.

```
GET graph.facebook.com/{nuestro-ig-user-id}
    ?fields=business_discovery.username(OBJETIVO){...}
```

- **Se consulta sobre NUESTRO nodo**, no sobre el del objetivo. Preguntamos «yo,
  que soy esta cuenta, quiero saber de esa otra».
- **Token:** *Facebook User access token*. Confirmado en la referencia oficial.
- **Permisos:** `instagram_basic`, `instagram_manage_insights`,
  `pages_read_engagement`. Si el rol sobre la Página vino por Business Manager,
  además `ads_management` o `ads_read`.
- **Solo cuentas Business o Creator.** Las personales no están soportadas.
- **Limitación documentada:** no devuelve datos de cuentas con restricción de
  edad.

### Qué devuelve de un tercero

| Dato | Estado |
|---|---|
| `username`, `name` | `SI_TERCERO` |
| `followers_count`, `media_count` | `SI_TERCERO` |
| `media` (publicaciones) | `SI_TERCERO` |
| `like_count`, `comments_count` por publicación | `SI_TERCERO` |
| `view_count` en media | `SI_TERCERO` |
| `biography`, `website`, `profile_picture_url` | `NO_DOCUMENTADO` en la referencia del edge; la doc habla de «campos públicos» sin enumerarlos |
| `follows_count` | `NO_DOCUMENTADO` para terceros |
| insights: `reach`, `impressions`, `saved`, `shares`, `plays` | `SOLO_PROPIO` — la referencia de `business_discovery` **no los menciona** |
| histórico / serie temporal | `NO` — ninguna API lo entrega; lo construye Sentinel con snapshots |

**El punto que más importa:** los cinco insights que sí obtuvimos en
META-IG-REAL-01 —`reach`, `saved`, `shares`, `total_interactions`, `views`— son
`OWNER_INSIGHT`. No aparecen documentados para terceros. Lo que se puede esperar
de un candidato es sensiblemente menos que lo que vimos de nuestra cuenta.

---

## 3 · El error 190, explicado

| Pregunta | Respuesta |
|---|---|
| ¿El token de Instagram Login sirve solo para `graph.instagram.com`? | Sí para nuestro caso: `business_discovery` no existe en ese host |
| ¿`business_discovery` exige token de Facebook? | **Sí**, *Facebook User access token* |
| ¿El endpoint probado era de `graph.facebook.com`? | Sí |
| ¿El error es consistente con mezclar dos familias de token? | **Sí**, completamente |
| ¿Qué flujo genera el token correcto? | Facebook Login for Business, con Página vinculada |

`Cannot parse access token` es literalmente eso: el host no sabe leer un token
que no es suyo. **No es una credencial inválida** — la misma funcionó tres veces
contra el otro host minutos antes.

---

## 4 · Permisos

Todos vigentes; ninguno marcado como deprecado. Conviven dos familias porque
sirven a los dos flujos.

| Permiso | Para qué | App Review | Familia |
|---|---|---|---|
| `instagram_basic` | leer perfil y contenido de una cuenta IG | sí | Facebook Login |
| `instagram_manage_insights` | insights y `business_discovery` | sí | Facebook Login |
| `pages_read_engagement` | leer contenido publicado por la Página | sí | Facebook Login |
| `pages_show_list` | listar las Páginas que gestiona una persona | sí | Facebook Login |
| `business_management` | gestionar activos vía Business Manager | sí | Business Manager |
| `instagram_business_basic` | metadatos básicos, flujo Instagram Login | sí | Instagram Login |

`instagram_business_manage_insights` **no aparece** en la referencia de permisos
consultada: `NO_DOCUMENTADO`.

---

## 5 · Standard vs Advanced Access — el eslabón decisivo

| | Standard Access | Advanced Access |
|---|---|---|
| A quién alcanza | **solo usuarios con un rol en la app** | cualquier usuario |
| ¿Sirve para un candidato? | **no** | sí |
| Requisito | ninguno | **Business Verification** |

Esto es lo que convierte la Business Verification en obligatoria y no opcional:
un candidato nunca va a tener un rol en nuestra app, así que Standard Access no
lo alcanza **por definición**.

### Matriz de Business Verification

| Caso | ¿Obligatoria? |
|---|---|
| A · desarrollar y probar con cuentas propias | **No** |
| B · solicitar Advanced Access | **Sí** |
| C · App Review | no consta como requisito aparte; en la práctica va con B |
| D · `business_discovery` sobre terceros | **Sí**, porque exige Advanced Access |
| E · Pages públicas de terceros (PPCA) | **Sí**, explícito en la doc de PPCA |
| F · producción multiusuario | **Sí** |
| G · Tech Provider | `NO_DOCUMENTADO` en las fuentes consultadas |

Que A sea «no» explica por qué META-IG-REAL-01 funcionó: probamos con nuestra
propia cuenta, y ahí no hace falta nada.

---

## 6 · Facebook Pages de terceros

**Page Public Content Access sigue activo.** No aparece deprecado ni renombrado.

- Permite leer datos públicos de Páginas que **no administramos**, sin
  `pages_read_engagement` ni `pages_read_user_content`.
- **Exige App Review y Business Verification.**
- En modo desarrollo solo alcanza a Páginas de administradores, desarrolladores
  o testers de la app. Para el resto, revisión.
- Caso de uso que Meta lista como admitido: **analizar o mostrar publicaciones e
  interacción en Páginas**. Es literalmente lo nuestro.

### Qué se puede leer de una Página ajena

| Dato | Estado |
|---|---|
| identidad, nombre | `PUBLIC DATA` |
| `fan_count` / seguidores | `PUBLIC DATA` con PPCA |
| `posts` / `feed` | `APP-REVIEW DATA` (PPCA) |
| `videos` | `APP-REVIEW DATA` (PPCA) |
| comentarios públicos | `APP-REVIEW DATA` (PPCA) |
| reacciones | `NO_DOCUMENTADO` como accesible por PPCA |
| shares | `NO_DOCUMENTADO` como accesible por PPCA |
| reels | `NO_DOCUMENTADO` |
| video views | `PAGE-ADMIN DATA` |
| insights | `PAGE-ADMIN DATA` |
| histórico | `NO` |

Y una restricción transversal: *«se requiere un Page access token para cualquier
campo que pueda incluir información de usuarios»*.

---

## 7 · Perfiles personales — la respuesta que decide la cobertura

| Plataforma | Tipo de cuenta | ¿Vía oficial sin autorización del titular? |
|---|---|---|
| Instagram | Business / Creator | **Sí**, con la cadena completa |
| Instagram | **personal** | **NO** |
| Facebook | **Página** | **Sí**, con PPCA |
| Facebook | **perfil personal** | **NO** |

`business_discovery` solo soporta cuentas Business o Creator. Y ninguna vía
oficial abre un perfil personal de Facebook.

**Esto afecta directamente a Candidate Intelligence.** El candidato patrón tiene
un **perfil personal** de Facebook, no una Página: por la vía oficial de Meta es
inalcanzable, hoy y después de cualquier revisión.

---

## 8 · Matriz Instagram

| Capacidad | Cuenta propia | Profesional de tercero | Personal de tercero |
|---|---|---|---|
| identity / username / name | `MEDIDO` | `DOCUMENTADO_DISPONIBLE` | `NO_DISPONIBLE` |
| biography · website · profile_picture | `MEDIDO` | `NO_DOCUMENTADO` | `NO_DISPONIBLE` |
| followers | `MEDIDO` | `DOCUMENTADO_DISPONIBLE` | `NO_DISPONIBLE` |
| following | `MEDIDO` | `NO_DOCUMENTADO` | `NO_DISPONIBLE` |
| media_count | `MEDIDO` | `DOCUMENTADO_DISPONIBLE` | `NO_DISPONIBLE` |
| posts | `MEDIDO` | `DOCUMENTADO_DISPONIBLE` | `NO_DISPONIBLE` |
| reels | `NO_PROBADO` | `NO_DOCUMENTADO` | `NO_DISPONIBLE` |
| likes · comments | `MEDIDO` | `DOCUMENTADO_DISPONIBLE` | `NO_DISPONIBLE` |
| views / plays | `MEDIDO` (owner) | `NO_DOCUMENTADO` | `NO_DISPONIBLE` |
| reach · impressions · shares · saves | `MEDIDO` (owner) | `SOLO_PROPIO` | `NO_DISPONIBLE` |
| insights | `MEDIDO` (owner) | `SOLO_PROPIO` | `NO_DISPONIBLE` |
| histórico | `NO_DISPONIBLE` | `NO_DISPONIBLE` | `NO_DISPONIBLE` |

Todo lo de la columna «profesional de tercero» está además condicionado a
`REQUIERE_ADVANCED_ACCESS` + `REQUIERE_APP_REVIEW` +
`REQUIERE_BUSINESS_VERIFICATION`.

## 9 · Matriz Facebook

| Capacidad | Página propia | Página de tercero | Perfil personal |
|---|---|---|---|
| identity | disponible | `DOCUMENTADO_DISPONIBLE` | `NO_DISPONIBLE` |
| followers / fan_count | disponible | `REQUIERE_APP_REVIEW` (PPCA) | `NO_DISPONIBLE` |
| posts | disponible | `REQUIERE_APP_REVIEW` | `NO_DISPONIBLE` |
| videos | disponible | `REQUIERE_APP_REVIEW` | `NO_DISPONIBLE` |
| reels | disponible | `NO_DOCUMENTADO` | `NO_DISPONIBLE` |
| reactions / likes | disponible | `NO_DOCUMENTADO` | `NO_DISPONIBLE` |
| comments | disponible | `REQUIERE_APP_REVIEW` | `NO_DISPONIBLE` |
| shares | disponible | `NO_DOCUMENTADO` | `NO_DISPONIBLE` |
| views | disponible | `SOLO_PROPIO` | `NO_DISPONIBLE` |
| engagement / insights | disponible | `SOLO_PROPIO` | `NO_DISPONIBLE` |
| histórico | `NO` | `NO` | `NO_DISPONIBLE` |

---

## 10 · Recomendación

### RUTA C — HÍBRIDA

Cinco razones, todas apoyadas en lo anterior:

1. **La vía oficial existe y es legítima para cuentas profesionales.** No es un
   callejón sin salida: `business_discovery` sigue vigente y PPCA también, y el
   caso de uso «analizar publicaciones e interacción en Páginas» está listado
   como admitido. Merece la pena recorrerla.

2. **Pero no cubre perfiles personales, y eso no se arregla con dinero ni con
   tiempo.** Es una decisión de producto de Meta. Cualquier candidato con cuenta
   personal queda fuera para siempre por esta vía — y el candidato patrón es uno
   de ellos en Facebook.

3. **El coste no es dinero, es dependencia.** Business Verification y App Review
   los concede Meta, no se compran, y pueden denegarse o cambiar de criterio.
   Apostar toda la cobertura de dos plataformas a eso es un riesgo de producto,
   no técnico.

4. **Lo que se obtendría de un tercero es bastante menos de lo que vimos.** Ni
   reach, ni saves, ni shares: solo perfil, seguidores, publicaciones, likes y
   comentarios. Suficiente para el modelo, pero conviene no esperar el nivel de
   detalle de la cuenta propia.

5. **Ya hay dos plataformas funcionando sin nada de esto.** YouTube y X entregan
   terceros sin autorización ni revisión. La prioridad razonable es apoyarse en
   lo que ya mide y añadir Meta oficial en paralelo, sin bloquear el producto
   mientras Meta decide.

### Lo que la ruta híbrida significa en concreto

- **Seguir con Meta oficial** para las cuentas **profesionales**: es gratis en
  licencia y legítima.
- **Evaluar proveedor comercial** solo para lo que la vía oficial no cubre
  —cuentas personales— y decidir con presupuesto en mano, no antes.
- **No bloquear** el benchmark multicandidato esperando a Meta: YouTube y X ya
  lo sostienen.

### Antes de invertir semanas, un dato que falta

Cuántos de los siete candidatos usan cuenta **profesional** y cuántos
**personal**, en Instagram y en Facebook. Si la mayoría son personales, la vía
oficial de Meta rinde poco y la conversación se vuelve sobre proveedor. Ese
recuento cuesta minutos y cambia la decisión.

---

## Lo que este documento no dice

No dice que la revisión vaya a aprobarse: eso lo decide Meta caso por caso y
aquí solo se evalúa viabilidad técnica y documental. Tampoco dice cuánto tarda:
no consta en la documentación consultada y no se estima.
