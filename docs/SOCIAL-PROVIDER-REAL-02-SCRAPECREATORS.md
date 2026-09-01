# SOCIAL-PROVIDER-REAL-02 — ScrapeCreators, validación real

**Facebook + TikTok + texto de comentarios, medidos desde Sentinel**
2026-08-31 · **8 requests** · **8 créditos** · **86 restantes** · **0 USD**

> Bright Data no se tocó: sigue `BLOQUEADO_POR_PROVEEDOR`, 0 requests, $0.

---

## 1. Qué se demostró

Los tres huecos que arrastraba Candidate Intelligence desde
`P-CAND-FACEBOOK-01` y `P-CAND-TIKTOK-01` quedan **medidos con datos reales**,
sobre activos del proyecto piloto, a través del adapter genérico y persistidos
en el Knowledge Lake.

    Facebook de terceros    MEDIDO_PROVEEDOR
    TikTok con métricas     MEDIDO_PROVEEDOR
    Texto de comentarios    MEDIDO_PROVEEDOR   en las dos plataformas

**Es la primera vez que Sentinel tiene texto de comentarios de cualquier
plataforma.** Instagram lo niega (400 code 100), Facebook oficial lo bloquea
por permisos y TikTok no tiene vía pública. Comments Intelligence pasa de «sin
fuente» a «con fuente».

---

## 2. Facebook — Pedro Palacios Ullauri

Activo leído del Lake, no inventado: `facebook:pedropalaciosu`.

### Perfil — 1 request

    id           100044226859609        ← id estable de Page
    name         Pedro Palacios Ullauri
    followers    57.000
    likeCount    57.624
    category     política

`followers` y `likeCount` son **cifras distintas** y no se funden.

### Publicaciones — 1 request, 3 posts

| Post | Reacciones | Comentarios | Views | Shares |
|---|---|---|---|---|
| `1679933406824205` | 157 | 16 | NO_DISPONIBLE | NO_DISPONIBLE |
| `1677250907092455` | 508 | 122 | NO_DISPONIBLE | NO_DISPONIBLE |
| `1676342253849987` | 64 | 13 | NO_DISPONIBLE | NO_DISPONIBLE |

**El desglose de reacciones por tipo llega**, y no es un adorno. En el post del
medio:

    like 173 · haha 325 · love 8 · care 1 · wow 1 · anger 0

**Más «haha» que «me gusta».** Para lectura política eso es señal, y un
`reactionCount: 508` agregado la habría escondido entera.

### Comentarios — 1 request

    declarados por la plataforma   122
    observados en este corpus       10
    con texto                        8
    cobertura                    MUESTRA

Campos reales: `id` (base64 estable), `text`, `created_at` en ISO,
`reaction_count`, `reply_count`, desglose de reacciones y autor.

**2 de 10 llegaron sin texto.** No se determinó si son comentarios de solo
imagen o una limitación del proveedor, y por eso se cuenta aparte en lugar de
darlo por bueno.

---

## 3. TikTok — Yaku Pérez

Activo leído del Lake: `tiktok:yaku.perez`.

### Perfil — 1 request

    user id      6898126188256297986    ← id estable
    nickname     Yaku
    followers    519.300
    following    58
    likes        5.200.000
    videos       357

Todo esto es exactamente lo que oEmbed **no** daba. `P-CAND-TIKTOK-01` cerró
con «identidad sí, métricas no»; esto cierra la otra mitad.

### Vídeos — 1 request, 10 vídeos

| Vídeo | Views | Likes | Comentarios | Shares |
|---|---|---|---|---|
| `7678894296220634375` | 2.198 | 102 | 8 | 16 |
| `7676207704582540552` | 23.481 | 445 | 20 | 52 |
| `7670364599140633863` | 14.820 | 348 | 19 | 36 |

Las cuatro métricas llegan. **TikTok sí da shares; Facebook no.**

### Comentarios — 1 request

    declarados   110
    observados    20
    con texto     20
    cobertura  MUESTRA

Campos: `cid`, `text`, `create_time` (unix), `digg_count`,
`reply_comment_total`, `comment_language`.

---

## 4. Rerun — 2 requests

Lo que de verdad decide, y no que devuelva 200 dos veces:

    publicaciones            3 → 3    SIN DUPLICAR
    publicationId            estables
    firstObservedAt          ESTABLE
    lastObservedAt           AVANZA
    observationCount         1 → 2
    commentId (TikTok)       20 de 20 comunes
    comentario firstObservedAt   ESTABLE

**Los IDs del proveedor son estables.** Unos IDs inestables convertirían cada
ejecución en datos nuevos y el histórico se volvería basura sin avisar.

---

## 5. Capacidades: solo lo demostrado

### ScrapeCreators · Facebook

| Capacidad | Estado |
|---|---|
| account, followers, posts, reactions, comments_count, **comment_text** | **SUPPORTED** |
| shares | **UNSUPPORTED** |
| video_views | **NO_DATA** |
| historical | UNVERIFIED_PROVIDER |

### ScrapeCreators · TikTok

| Capacidad | Estado |
|---|---|
| account, followers, following, total_likes, posts, views, likes, comments_count, **comment_text**, shares | **SUPPORTED** |
| historical | UNVERIFIED_PROVIDER |

### ScrapeCreators · Instagram

Todo `UNVERIFIED_PROVIDER`: **no se probó.**

### Tres ausencias que no son la misma

Esta es la parte que más fácil se colapsa, y colapsarla haría creer que
Facebook «no da» lo mismo en tres casos distintos:

- **`shares` → UNSUPPORTED.** El endpoint no tiene el campo. No existe.
- **`video_views` → NO_DATA.** Se pidió sobre **tres publicaciones que sí eran
  vídeo** y volvió `null` las tres veces. Se preguntó, y no vino.
- **`historical` → UNVERIFIED.** No se paginó. No se sabe.

---

## 6. Lo que esto **no** demuestra

- **No es cobertura de los 7 candidatos.** Se midieron **dos activos**. El
  resto sigue `REQUIERE_PROVEEDOR` hasta ser observado.
- **No es cobertura histórica.** No se paginó en ninguna plataforma.
- **No es el corpus completo de comentarios.** 10 de 122 y 20 de 110 son
  **muestras**, y el contrato lo dice en el propio dato.
- **No cubre Instagram.** No se probó.
- **No cubre perfiles personales de Facebook.** El activo medido es una Page.

---

## 7. Arquitectura: el proveedor no bajó al dominio

    socialProviderClient (genérico)
      → scrapeCreatorsMapper (capa de proveedor)
      → externalSocialProvider (normalizador)
      → contratos de publicación / comentario / snapshot
      → Knowledge Lake

`candidateObservation` y la matriz social **no saben que ScrapeCreators
existe**. El único archivo con conocimiento específico es el mapper, que es su
sitio. Cambiar de proveedor sigue siendo cambiar un mapper y una entrada de
registro.

No se creó `ScrapeCreatorsFacebookEngine` ni nada parecido.

### Dos cosas que la documentación no decía

**Con `trim=true` los vídeos traen `url`, no `share_url`.** Costó una llamada
descubrirlo; queda escrito en el mapper para que no cueste otra.

**Las fechas vienen en tres formatos:** unix en los posts de Facebook, unix en
TikTok e ISO 8601 en los comentarios de Facebook. Se normalizan en el mapper,
porque el normalizador genérico no debe saber de formatos de nadie.

---

## 8. Aprobación y seguridad

**La aprobación es un cambio de código**, no una variable de entorno:
`aprobadoParaOperar: true` con su gate y su fecha, para que quede en el
historial de git. Alcanza **solo** a ScrapeCreators — Bright Data, SocialCrawl
y Data365 siguen sin aprobar, y hay test que lo comprueba.

La clave se lee del entorno. **No aparece** en la URL, ni en el resultado, ni
en la traza, ni en el error, ni en lo persistido, ni en este documento. Se
verificó explícitamente sobre el volcado crudo y sobre lo escrito en el Lake.

---

## 9. Presupuesto

| Fase | Requests | Créditos |
|---|---|---|
| Facebook perfil / posts / comentarios | 3 | 3 |
| TikTok perfil / vídeos / comentarios | 3 | 3 |
| Rerun | 2 | 2 |
| **Total** | **8** | **8** |

**Créditos restantes: 86 de 100.** Coste: **0 USD**. No se compró nada, no se
introdujo tarjeta.

El comentario sigue siendo lo que mandará el coste al escalar: 1 crédito
devuelve 10–20 comentarios, así que un corpus completo de un post de 122
necesitaría paginar.

---

## 10. Riesgo, sin suavizar

ScrapeCreators **raspa web pública; no es un proveedor licenciado** por Meta ni
por TikTok. Va contra los ToS de las plataformas aunque el dato sea público, y
la continuidad no está garantizada — Bright Data acaba de demostrar que un
proveedor puede desaparecer sin aviso.

Lo que sí se conserva es la citabilidad: todos los permalinks son canónicos y
cualquiera puede abrir la publicación y comprobarla.

**Es una decisión de negocio, no técnica.** Está tomada al aprobar el
proveedor, y queda registrada con fecha en el código.

---

## 11. Veredicto

**¿ScrapeCreators resuelve los gaps principales de Facebook + TikTok + comment
text para el piloto?**

**SÍ**, para lo medido: dos activos reales, dos plataformas, texto de
comentarios en ambas, IDs estables y persistencia verificada.

Con dos condiciones que no se pueden olvidar al escalar: **el histórico sigue
sin verificar** y **el corpus de comentarios es una muestra**, no el universo.
