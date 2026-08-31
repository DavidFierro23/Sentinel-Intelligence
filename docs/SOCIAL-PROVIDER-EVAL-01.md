# SOCIAL-PROVIDER-EVAL-01

**Evaluación de proveedores para cerrar la cobertura social de Candidate Intelligence**
Fecha: 2026-08-31 · Gate de evaluación · **0 USD gastados** · **0 requests pagas**

> **Estado máximo alcanzable en este documento: `PROVEEDOR_CANDIDATO`.**
> Que la documentación de un proveedor diga que cubre Facebook o TikTok **no**
> declara la plataforma resuelta. Solo una prueba contra una cuenta real de
> nuestros candidatos permite pasar a `MEDIDO_PROVEEDOR`.

---

## 1. Por qué existe este gate

Cuatro gates anteriores midieron, con llamadas reales, qué entregan las APIs
oficiales. El resultado es una cobertura desigual:

| Plataforma | Estado real | Vía |
|---|---|---|
| X | **OPERATIVO** | API oficial |
| YouTube | **OPERATIVO** (donde hay cuenta) | API oficial |
| Instagram profesional | **OPERATIVO** — 3 de 12 activos | Meta `business_discovery` |
| Instagram personal | **NO_SOPORTADO** — 9 de 12 activos | ninguna vía oficial |
| Facebook propio | **PARCIAL** — solo metadata | Meta Graph |
| Facebook terceros | **BLOQUEADO** — 10 de 11 activos | requiere PPCA |
| TikTok | **IDENTIDAD SÍ, MÉTRICAS NO** | oEmbed público |

Lo que falta **no lo cierra ningún trabajo de ingeniería nuestro**. Lo cierra
una licencia, una revisión de Meta, o un proveedor.

---

## 2. Los huecos exactos

Un proveedor se evalúa **solo** contra esto. Lo que ya funciona no se compra.

### A · Facebook terceros — prioridad MUY ALTA
Page ID, nombre, URL, username, followers/fan_count · post ID, permalink,
timestamp, texto, tipo · reactions, comments_count, shares, video views ·
**texto de comentarios**, timestamp, comment ID, replies · histórico y polling.

**Perfiles personales de Facebook:** evaluar expresamente. No asumir cobertura.

### B · TikTok — prioridad MUY ALTA
Ya tenemos identidad gratis por oEmbed. Falta **todo lo demás**: followers,
following, likes totales, media_count · video ID, permalink, timestamp,
caption · views, likes, comments_count, shares · **texto de comentarios**,
replies · histórico.

### C · Instagram — prioridad MEDIA
Solo lo que Meta **no** da: cuentas personales públicas, **texto de
comentarios**, replies, histórico adicional.

### Comments Intelligence es criterio prioritario
Hoy Sentinel **no tiene fuente confirmada de texto de comentarios en ninguna
plataforma**. `comments_count` no es `comment_text`, y confundirlos dejaría
Pulso Electoral Digital sin materia prima.

---

## 3. Proveedores investigados (4)

Fuente principal: documentación oficial del proveedor. Lo no documentado se
marca **NO DOCUMENTADO** y no se rellena.

### 3.1 Bright Data — `PROVEEDOR_CANDIDATO` · **APTO_PARA_PRUEBA**

Empresa israelí/estadounidense de infraestructura de datos web.
Web: `brightdata.com` · Docs: `docs.brightdata.com`

| | Facebook | Instagram | TikTok |
|---|---|---|---|
| Perfiles/Pages terceros | ✅ por URL de Page | ✅ | ✅ |
| Posts | ✅ | ✅ | ✅ |
| **Texto de comentarios** | ✅ scraper dedicado | ✅ | ✅ |
| Comment ID / timestamp | ✅ | ✅ | ✅ |
| Replies | ✅ `get_all_replies` | ✅ nº replies | ✅ |
| Reactions / likes | ✅ | ✅ | ✅ |
| Shares | ✅ | — | ✅ |
| Views | video views | — | ✅ |
| Histórico | ✅ `start_date`/`end_date` | NO DOCUMENTADO | NO DOCUMENTADO |

- **Entradas aceptadas (FB):** URL de Page, grupo, post o perfil. Cubre
  **Pages de terceros por URL**, que es exactamente nuestro hueco A.
- **Precio:** 5.000 registros/mes **gratis, sin tarjeta** · PAYG **$1,50/1K**
  registros (posts/comments/TikTok) y **$0,75/1K** en el scraper de Facebook
  posts según su tabla de producto · Plan Scale $499/mes con 384.000 registros.
- **Datasets pre-recolectados:** desde $250 por 100K registros.
- **Trial:** sí, sin tarjeta.
- **Riesgo:** es **scraping de web pública**, no dato licenciado por la
  plataforma. Ver §6.

### 3.2 Data365 — `PROVEEDOR_CANDIDATO` · **REQUIERE_CONTACTO_COMERCIAL**

Web: `data365.co`

- **Plataformas:** Instagram, Facebook, X, TikTok, Reddit, Threads, Pinterest.
- **Facebook:** perfiles, posts, **comentarios públicos**, y un desglose de
  reacciones inusualmente completo — *like, love, haha, wow, sad, angry,
  support* — además de comment counts, shares, timestamps y tagged users.
  Declara soportar **cualquier Page pública**.
- **TikTok:** el ejemplo de respuesta de su documentación muestra
  `follower_count`, `heart_count`, `video_count`.
- **Precio:** **NO PÚBLICO.** Paquetes por endpoints usados.
- **Trial:** 14 días gratis, sin tarjeta aparente, pero **exige una llamada
  introductoria** antes de dar acceso.
- **Rate limits:** NO DOCUMENTADO públicamente.
- **Por qué interesa:** el desglose de reacciones por tipo es el más rico
  encontrado, y para lectura política *angry* vs *love* no es un matiz menor.

### 3.3 Apify — `APTO_PARCIAL`

Web: `apify.com` · Marketplace de *Actors*.

- **Plataformas:** hay Actors para Facebook, Instagram y TikTok, incluidos
  posts y comentarios.
- **Precio:** Free **$5/mes de crédito, sin tarjeta** · Starter $19 · Scale
  $199 · Business $999. Los Actors cobran *pay per event* o *pay per usage*
  sobre ese crédito.
- **Riesgo estructural:** la cobertura no la sostiene Apify sino **cada Actor,
  muchos de terceros**. La calidad, el contrato de salida y el mantenimiento
  varían por Actor. Para una campaña con fecha, depender de un Actor
  comunitario que puede romperse sin aviso es un riesgo operativo real.
- **Cuándo sí:** como plan B barato o para cubrir un hueco puntual.

### 3.4 EnsembleData — **NO_APTO** para nuestro hueco #1

Web: `ensembledata.com`

- **Plataformas:** TikTok, Instagram, YouTube, Threads, Reddit, Twitch, X,
  Snapchat. **No cubre Facebook.**
- **Precio:** planes mensuales de ~$100 a ~$1.400; Bronze $200/mes con 5.000
  unidades/día. Modelo de *units* por endpoint.
- **Veredicto:** técnicamente sólido para TikTok, pero **Facebook terceros es
  nuestra prioridad MUY ALTA y no lo cubre**. Comprarlo dejaría abierto el
  hueco más caro.

### 3.5 Referencia oficial: Meta Content Library — **NO_APTO (elegibilidad)**

Ya documentado en gates anteriores. Es la vía **licenciada** por Meta y sería
la de mejor defensa legal, pero su elegibilidad es **académica sin ánimo de
lucro**. Sentinel es un producto comercial. Se registra para que la comparación
sea honesta: la opción legalmente más limpia existe y **no nos admite**.

---

## 4. Matriz comparativa

| Proveedor | FB terceros | TikTok métricas | IG personales | Comment text | Histórico | IDs/permalink | Ecuador/LATAM | Precio | Trial | Integración | Riesgo | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Bright Data** | SÍ | SÍ | SÍ (público) | **SÍ (3 plat.)** | SÍ (FB, por fecha) | SÍ | Global, no restringe | $1,50/1K · 5K gratis/mes | Sí, sin tarjeta | Media | ToS plataforma | **APTO_PARA_PRUEBA** |
| **Data365** | SÍ | SÍ | NO DOCUMENTADO | SÍ | NO DOCUMENTADO | SÍ | Global | **No público** | 14 d, con llamada | Media | Precio opaco | **REQUIERE_CONTACTO_COMERCIAL** |
| **Apify** | Según Actor | Según Actor | Según Actor | Según Actor | Según Actor | Según Actor | Global | $5 gratis · $19+ | Sí, sin tarjeta | Alta (varía) | Actor puede romperse | **APTO_PARCIAL** |
| **EnsembleData** | **NO** | SÍ | SÍ | Parcial | NO DOCUMENTADO | SÍ | Global | $100–$1.400/mes | NO DOCUMENTADO | Media | No cubre FB | **NO_APTO** |
| Meta Content Library | SÍ | — | — | SÍ | SÍ | SÍ | Global | Gratis | — | — | No elegibles | **NO_APTO** |

### Puntuación (cualitativa donde no hay datos)

| Dimensión | Peso | Bright Data | Data365 | Apify |
|---|---|---|---|---|
| Cobertura de huecos | 30% | **ALTO** | ALTO | MEDIO |
| Comments Intelligence | 20% | **ALTO** | ALTO | MEDIO |
| Calidad/estabilidad API | 15% | ALTO | MEDIO (no verificado) | BAJO |
| Histórico | 10% | MEDIO | NO ESTIMABLE | BAJO |
| IDs/permalinks/evidencia | 10% | ALTO | ALTO | MEDIO |
| Coste | 10% | **ALTO** (transparente) | BAJO (opaco) | ALTO |
| Condiciones/licencia | 5% | MEDIO | MEDIO | BAJO |

No se asigna número global: hacerlo daría una precisión que estos datos no
tienen.

---

## 4-bis. Comments Intelligence: la tabla que decide

Comentarios es el **criterio de corte**. Un proveedor que solo entrega el
conteo **no es** una solucion de Comments Intelligence, y no debe presentarse
como tal.

### Bright Data — segun su documentacion de producto

| | Facebook | Instagram | TikTok |
|---|---|---|---|
| `comments_count` | SI | SI | SI |
| **`comment_text`** | **SI** | **SI** | **SI** |
| replies | SI (`get_all_replies`) | SI (numero de replies) | SI |
| comment ID | SI | NO DOCUMENTADO | NO DOCUMENTADO |
| timestamp | SI | SI | SI |
| historico de comentarios | NO DOCUMENTADO | NO DOCUMENTADO | NO DOCUMENTADO |

### Data365

| | Facebook | Instagram | TikTok |
|---|---|---|---|
| `comments_count` | SI | SI | SI |
| **`comment_text`** | **SI** | NO DOCUMENTADO | NO DOCUMENTADO |
| replies | NO DOCUMENTADO | NO DOCUMENTADO | NO DOCUMENTADO |
| comment ID | NO DOCUMENTADO | NO DOCUMENTADO | NO DOCUMENTADO |
| timestamp | SI | NO DOCUMENTADO | NO DOCUMENTADO |
| historico de comentarios | NO DOCUMENTADO | NO DOCUMENTADO | NO DOCUMENTADO |

### Apify

| | Facebook | Instagram | TikTok |
|---|---|---|---|
| todo lo anterior | **SEGUN EL ACTOR** | **SEGUN EL ACTOR** | **SEGUN EL ACTOR** |

No es evasion de la pregunta: en un marketplace la capacidad la define cada
Actor y su autor, no la plataforma. Responderlo de otro modo seria inventar.

### EnsembleData

| | Facebook | Instagram | TikTok |
|---|---|---|---|
| cobertura | **NO EXISTE** | parcial | SI |

**Lectura.** Solo **Bright Data** documenta `comment_text` en las tres
plataformas. Data365 lo documenta con certeza en Facebook. Ninguno documenta
**historico de comentarios**, que es un hueco que sigue abierto para todos y
que Sentinel tendra que cubrir acumulando snapshots en el Lake.

**Y nada de esto esta medido.** Es documentacion del proveedor, que es
exactamente el tipo de afirmacion que este proyecto no acepta como evidencia
hasta probarla.

---

## 5. Coste estimado del piloto

**ESTIMACIÓN, no medición.** Supuestos declarados:

- 7 candidatos · Facebook + TikTok + Instagram-hueco (X y YouTube siguen por
  API oficial y **no cuestan proveedor**).
- Por ronda y candidato: 1 perfil + 10 publicaciones + ~30 comentarios por
  publicación ≈ **310 registros por plataforma**.
- 3 plataformas × 7 candidatos ≈ **6.500 registros por ronda**.
- Ronda semanal.

| Ventana | Rondas | Registros | Coste a $1,50/1K |
|---|---|---|---|
| Mensual | 4 | ~26.000 | **~$39/mes** |
| 90 días | 13 | ~85.000 | **~$127** |

**El comentario es el que manda el coste.** Si un post viral trae 2.000
comentarios en vez de 30, la estimación se multiplica. Por eso conviene
empezar con un tope de comentarios por publicación y medirlo antes de subirlo.

Los 5.000 registros/mes gratis cubren **una ronda de prueba completa** sin
gastar un dólar.

---

## 6. Lo legal, dicho claro

Esto es lo más importante del documento y no debe suavizarse.

**Bright Data, Data365 y Apify obtienen los datos de Facebook, Instagram y
TikTok raspando la web pública, no bajo licencia de la plataforma.** Ninguno
es un *licensed data provider* de Meta o TikTok.

Consecuencias reales:

1. **Va contra los ToS de las plataformas**, aunque el dato sea público. El
   riesgo contractual lo asume quien lo usa, no solo quien lo raspa.
2. **La continuidad no está garantizada.** Un cambio de la plataforma puede
   dejar un endpoint sin datos, y eso llegaría en mitad de una campaña.
3. **La citabilidad sí se conserva**, que es lo que salva el caso de uso: los
   permalinks son canónicos y cualquiera puede abrir la publicación y
   comprobarla. La evidencia es reencontrable aunque la vía de obtención sea
   discutible.
4. **La vía legalmente limpia existe y no nos admite** (Meta Content Library,
   elegibilidad académica).

**Esto no es una decisión técnica. Es una decisión de negocio y de riesgo, y
le corresponde al responsable del proyecto, no a este gate.**

Lo que sí recomienda este gate: si se contrata, **revisar los ToS del
proveedor sobre almacenamiento, retención y redistribución en informes**, y
dejar registrada la procedencia en cada dato (`provider`, `observedAt`,
`permalink`), que es algo que Sentinel ya hace por contrato.

---

## 7. Arquitectura recomendada: híbrida

No depender de un proveedor único. Cada fuente donde es más fuerte:

    X                      API oficial          ya operativo
    YouTube                API oficial          ya operativo
    Instagram profesional  Meta business_disc.  ya operativo
    Facebook propio        Meta Graph           metadata; posts tras permiso
    Facebook terceros      PROVEEDOR            hueco A
    TikTok métricas        PROVEEDOR            hueco B
    TikTok identidad       oEmbed público       ya operativo, gratis
    Instagram personal     PROVEEDOR            hueco C
    Histórico              Knowledge Lake       propio, normalizado

**Por qué híbrida y no un proveedor para todo:** lo que ya funciona por vía
oficial es más barato, más estable y más defendible. Sustituirlo por un
proveedor añadiría coste y riesgo legal a cambio de nada.

El histórico lo construye Sentinel. Ninguna plataforma ni proveedor entrega
serie temporal propia; el Lake ya acumula snapshots append-only, y eso es un
activo que no se compra.

### Cómo entraría el proveedor sin contaminar el dominio

    Provider API
      → adapter de plataforma (mismo puerto que instagramAdapter/xAdapter)
      → contrato normalizado de publicación y comentario
      → evidenceId derivado del permalink
      → Knowledge Lake
      → snapshots
      → Candidate Intelligence

**No** se crean `ProviderFacebookEngine` ni `ProviderTikTokEngine`. El
proveedor es un **detalle del adapter**, igual que hoy lo es Meta. Cambiar de
proveedor debe ser cambiar un adapter, no reescribir Candidate Intelligence.

El puerto ya existe (`platformAdapterPort.js`) y el contrato de observación
también (`candidateObservation.js`). **No hace falta código nuevo para
decidir**; hará falta un adapter cuando se apruebe la prueba.

---

## 8. PPCA en paralelo

**Sigue siendo recomendable: SÍ.**

- **Qué cubriría:** Pages de terceros por vía oficial — posts, comentarios
  públicos, fan_count — eliminando el hueco A entero y con defensa legal.
- **Qué dependencia eliminaría:** la de proveedor para Facebook. TikTok
  seguiría necesitándolo igual.
- **Por qué no bloquea el MVP:** exige App Review y Business Verification, y
  el plazo no lo controlamos.

`docs/META-FB-PUBLIC-ACCESS-REQUEST.md` sigue preparado y sin enviar.

Y antes que nada, algo que cuesta minutos y no depende de nadie: el caso de
uso *"Administrar todos los aspectos de tu página"* ya se agregó a la app,
pero **`pages_read_user_content` no aparece como permiso seleccionable** en la
configuración actual. **No se regeneró token a ciegas.** Hasta resolver eso,
Facebook propio sigue limitado a metadata.

---

## 9. Decisión

### Proveedor #1 recomendado para prueba: **Bright Data**

Es el único de los cuatro que cubre **los tres huecos a la vez** —Facebook
terceros, TikTok métricas e Instagram— y el único con **texto de comentarios
documentado en las tres plataformas**, que es el criterio prioritario. Tiene
precio público y transparente, acepta URLs de Page de terceros directamente,
permite ventana histórica por fechas en Facebook, y ofrece **5.000 registros
al mes sin tarjeta**, suficiente para una prueba real completa a coste cero.

### Proveedor #2: **Data365**

El desglose de reacciones por tipo —*love, haha, wow, sad, angry, support*— es
el más rico encontrado, y para lectura política la diferencia entre *love* y
*angry* es señal, no adorno. Se queda en #2 porque **el precio no es público**
y exige una llamada comercial antes de dar acceso, lo que no encaja con una
decisión que hay que tomar en días.

### Proveedor #3: **Apify**

Plan B barato: $5/mes gratis sin tarjeta y $19 el primer plan. Sirve para
cubrir un hueco puntual o para contrastar un dato. No como base de la
operación, porque la cobertura la sostiene cada Actor y no la plataforma.

### ¿Un solo proveedor puede cerrar FB + TikTok + comments?

**SÍ — NO VERIFICADO.** La documentación de Bright Data dice que sí en las
tres plataformas. **No está probado contra nuestros candidatos**, y hasta que
lo esté el estado es `PROVEEDOR_CANDIDATO`. No hace falta combinación de
proveedores si la prueba confirma la documentación.

Si la prueba falla en Facebook: combinación mínima **Data365 → Facebook** +
**Bright Data → TikTok**.

---

## 10. Prueba real recomendada (siguiente gate)

Con la cuota gratuita, sin tarjeta:

1. **1 Facebook Page de tercero** — `@pedropalaciosu`, el activo con el que ya
   se midió el bloqueo oficial. Comparable directo.
2. **1 TikTok de candidato** — `@yaku.perez`, el de identidad mejor resuelta.
3. **1 Instagram que Meta no cubra** — una de las 9 cuentas personales.

Y en cada uno comprobar lo que de verdad decide: **que llegue texto de
comentarios**, que el permalink sea canónico y que los IDs sean estables entre
dos ejecuciones. Sin eso, la cobertura es aparente.

---


### Qué tenemos que hacer nosotros para ejecutar SOCIAL-PROVIDER-REAL-01

Ninguno de estos pasos se ejecuto en este gate. Requieren autorizacion
explicita porque implican dar de alta una cuenta externa:

1. **Crear cuenta en Bright Data.** Plan gratuito: 5.000 registros/mes,
   **sin tarjeta**. El alta la hace una persona, no Sentinel.
2. **Obtener la API key** del Scraper API en el panel del proveedor.
3. **Cargarla en `apps/backend/.env`** como `BRIGHTDATA_API_KEY`. El `.env`
   esta en `.gitignore` y no entra en git, como el resto de credenciales.
4. **Escribir el adapter** sobre el puerto que ya existe —el proveedor es un
   detalle del adapter, no un motor nuevo— y probar:
   - 1 Facebook Page de tercero: `@pedropalaciosu`
   - 1 TikTok de candidato: `@yaku.perez`
   - 1 Instagram personal de los 9 que Meta no alcanza
5. **Comprobar lo que de verdad decide**, y no que la llamada devuelva 200:
   que llegue **texto de comentarios**, que el permalink sea canonico y que
   los IDs sean estables entre dos ejecuciones.

Si el paso 5 falla en Facebook, la combinacion minima pasa a ser
**Data365 para Facebook** + **Bright Data para TikTok**, y eso obliga a una
llamada comercial con Data365 antes de poder probar.

---

## 11. Auditoría de atribución TikTok (incluida en este gate)

Vía oEmbed gratuita. **2 llamadas, 0 USD.** Solo los activos de riesgo con
correspondencia 0.

| Activo | Candidato | HTTP | displayName | Veredicto |
|---|---|---|---|---|
| `@lafondadecarrasco` | Paúl Carrasco Carpio | 200 | **"La Fonda de Carrasco"** | `COMPATIBLE_NO_CONFIRMADA` |
| `@leomoralesordo` | Leonardo Morales | 200 | **"Leo Morales"** | `COMPATIBLE_NO_CONFIRMADA` |

Las dos cuentas **existen**. Ninguna queda confirmada, y existir no es
pertenecer.

- **`@lafondadecarrasco`** comparte un solo token con el candidato
  (*carrasco*) y su nombre visible describe **un negocio de hostelería**, no a
  una persona. Puede ser un local de la familia; puede no tener relación. Como
  activo de campaña de un candidato, **no se sostiene**, y medirlo como si
  fuera su cuenta sería atribuirle actividad que no es suya. Recomendación:
  revisar con el analista antes de incluirlo en cualquier medición.
- **`@leomoralesordo`** → *"Leo Morales"* es un diminutivo natural de Leonardo
  Morales. Es **compatible**, y sigue sin ser prueba: hay muchos Leo Morales.

Ninguna se degrada ni se borra en este gate: la decisión sobre un activo
declarado por el analista es del analista.

---

## 12. Huecos que seguirían abiertos incluso con proveedor

- **Perfiles personales de Facebook.** No los abre ninguna vía oficial y no
  hay evidencia de que un proveedor los cubra legítimamente. Afecta a 1 de 11
  activos. Estado honesto: **NO_SOPORTADO**.
- **Insights de propietario** —reach, impressions, saved, video views
  completas—. No existen para una cuenta ajena por ninguna vía, ni oficial ni
  de proveedor. No se compran porque no existen.
- **Histórico anterior a la primera observación.** El Lake solo tiene lo que
  Sentinel ha visto. Los datasets pre-recolectados de Bright Data podrían
  cubrir parte, y eso está **NO VERIFICADO**.

---

## 13. Qué NO se hizo en este gate

No se contrató nada. No se introdujo tarjeta. No se crearon cuentas externas.
No se gastó X, YouTube, Meta, SerpAPI ni Brave. No se modificó código de
producción.

Las únicas llamadas fueron **2 a oEmbed de TikTok**, gratuitas, para la
auditoría de atribución.
