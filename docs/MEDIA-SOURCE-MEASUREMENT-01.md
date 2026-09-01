# MEDIA-SOURCE-MEASUREMENT-01 — Medir los activos conocidos

**Fecha:** 2026-09-01
**Gate anterior:** MEDIA-SOURCE-UNIVERSE-01 (`f16336a`)
**Requests externos: 16 gratuitos (RSS/web). Créditos de proveedor: 0. Coste: 0,00 USD.**

---

## 1. Reutilización de arquitectura — no hay ningún motor nuevo

Antes de escribir nada se auditó la infraestructura de observación existente.
**No se creó `mediaFacebookEngine`, `mediaInstagramEngine` ni ningún equivalente.**
Lo que hay es una correspondencia:

```
MEDIA ENTITY → ACTIVO → observador que YA existe

  dominio  →  publicMetadata        (media, respeta robots.txt)
  feed     →  rssAdapter            (ingest)
  social   →  candidateObservation  (intelligence), enrutado por
              socialSourceRouting (oficial-primero)
```

Se reutilizan además `mediaTime` para fechas, `esFeedDeComentarios` de la línea
territorial, y `fuenteParaActivo` / `OFICIAL_NO_PUEDE` / `OFICIAL_FALLO_TEMPORAL`
de Candidate. Si mañana Candidate mejora `observarX`, Media mejora con él.

---

## 2. Identidad ≠ medición

Dos preguntas distintas, en campos distintos:

| | Pregunta | Estados |
|---|---|---|
| `identityState` | ¿de quién es este activo? | `ANALYST_DECLARED` · `DISCOVERED` · `CORROBORATED` · `VERIFIED` · `CONFLICT` · `UNRESOLVED` |
| `measurementState` | ¿podemos leerlo? | `MEDIDO_OFICIAL` · `MEDIDO_PROVEEDOR` · `MEDIDO_PUBLICO` · `PARCIAL` · `BLOQUEADO` · `REQUIERE_CREDENCIAL` · `REQUIERE_PROVEEDOR` · `NO_SOPORTADO` · `NO_PROBADO` · `VACIO` · `IDENTIDAD_INSUFICIENTE` · `SIN_ACTIVO_CONOCIDO` |

**Un activo en `CONFLICT` o `UNRESOLVED` no se mide.** Medirlo atribuiría cifras
a quien quizá no las generó, y eso es peor que no tener cifras.

`ANALYST_DECLARED` es una **referencia fuerte** —se mide, y antes— pero **no**
equivale a verificado por el sistema.

---

## 3. El conflicto real que encontró el corpus

`x:tomebamba` lo reclaman **dos entidades**: «La Voz del Tomebamba» (descubierta
de la pieza de X) y «Radio Tomebamba» (declarada por el analista con ese mismo
handle). Pueden ser el mismo medio — y el sistema **no lo adivina**. Los dos
activos quedan `IDENTIDAD_INSUFICIENTE` y ninguno se mide hasta que alguien lo
resuelva.

## 4. Una verificación humana que la medición contradijo

En el gate anterior verifiqué «Radio Tomebamba» por HTTP con
`por=analista@sentinel`. Al medir, su dominio **no resuelve**:
`getaddrinfo ENOTFOUND radiotomebamba.com.ec`.

La entidad sigue `VERIFIED` en identidad y su website queda `NO_PROBADO` y su
feed `BLOQUEADO`. **Es exactamente el comportamiento correcto**: verificar es una
afirmación humana sobre *de quién es*, no una comprobación de que el servidor
exista. Que las dos cosas puedan discrepar es la razón de separarlas.

---

## 5. Matriz media × activo — resultado real

| Entidad | Canal | Identidad | Medición | Piezas |
|---|---|---|---|---|
| El Mercurio | website | CORROBORATED | **MEDIDO_PUBLICO** | 10 |
| El Universo | website | DISCOVERED | **MEDIDO_PUBLICO** | 40 |
| Expreso | website | DISCOVERED | **MEDIDO_PUBLICO** | 40 |
| Primicias | website | DISCOVERED | PARCIAL | — |
| Prefectura del Azuay | website | DISCOVERED | BLOQUEADO (403) | — |
| Radio Tomebamba | website | VERIFIED | NO_PROBADO (DNS) | — |
| Radio Tomebamba | rss | VERIFIED | BLOQUEADO (DNS) | — |
| Radio Tomebamba | facebook | VERIFIED | REQUIERE_CREDENCIAL | — |
| @elmercurioec · @unsiontv · @manteteinformado | facebook | DISCOVERED | REQUIERE_CREDENCIAL | — |
| @notivozec | threads | DISCOVERED | NO_SOPORTADO | — |
| La Voz del Tomebamba · Radio Tomebamba | x | **CONFLICT** | IDENTIDAD_INSUFICIENTE | — |

**14 activos · 4 medidos · 90 publicaciones observadas.**

---

## 6. Resultados por plataforma

- **RSS / web:** el resultado del gate. 3 dominios medidos leyendo el feed que
  su propio sitio declara. Se descarta el feed de **comentarios** de El Mercurio
  con `esFeedDeComentarios`: leerlo daría «publicaciones» que son respuestas de
  lectores.
- **Facebook:** 4 activos, todos `REQUIERE_CREDENCIAL`. La vía existe y no se
  intenta: contar una llamada que no salió falsearía el único número que este
  proyecto vigila.
- **Instagram / TikTok / YouTube:** sin activos conocidos en este universo →
  `SIN_ACTIVO_CONOCIDO`, que no es `NO_PROBADO`.
- **X:** 2 activos, ambos en conflicto de identidad.
- **Threads:** `NO_SOPORTADO` — no hay vía de observación en la infraestructura
  actual. No es un fallo.

**Un feed entrega contenido, nunca métricas.** Por eso el estado es
`MEDIDO_PUBLICO` / `PARCIAL` y `metricas.disponibles` es `[]` con la nota
explícita: no hay audiencia, lectores ni alcance en esta vía.

---

## 7. Snapshots y preparación longitudinal

**28 snapshots** (dos ejecuciones × 14 activos) · **14 series** ·
**14/14 `readyForLongitudinal`**.

Los snapshots se escriben **también cuando el estado es BLOQUEADO**: «lo
intentamos y no se pudo» es información longitudinal — un medio que empieza a
bloquear es un hecho observable.

**Este gate NO calcula momentum.** Solo declara si existe serie.

---

## 8. Publicaciones y deduplicación

**90 publicaciones**, todas con `publishedAt` real (90/90), separado de
`observedAt`. Las fechas pasan por `mediaTime`: no se reimplementó ningún parser.

Dedup por URL canónica normalizada — la misma clave que usa `mediaCorpus`.
Verificado: reejecutar deja **90 → 90** publicaciones y sube los snapshots de 14
a 28. Una misma pieza vista por dos vías es **una** publicación con dos
procedencias.

---

## 9. Bylines — solo preparación

**26 firmas** distintas llegaron con las publicaciones (Andrés Mazza, Christian
Sánchez Mendieta, Patricia Naula Herembás, Valeria Alvear…). Se **persisten** en
el campo `autor` de cada publicación y **no** se crea ninguna entidad periodista.

⚠️ T2 ya tiene `services/territorial/journalistUniverse.js`. La entidad
periodista debe converger a una representación **compartida**: construirla aquí
sería el error que MEDIA-SOURCE-UNIVERSE-01 evitó con las cuatro estructuras de
fuentes.

---

## 10. Presupuesto

El plan se declara **antes** de gastar, con un endpoint propio
(`GET /:proyectoId/medicion/plan`), igual que `/pieza/plan`.

| | Previsto | Real |
|---|---|---|
| Llamadas | 13 | 16 |
| Créditos de proveedor | 0 | **0** |
| Coste | — | **0,00 USD** |

Las 3 llamadas extra son la lectura de los feeds descubiertos, que el plan no
podía prever: no se sabe que un dominio declara feed hasta visitarlo. Todas
gratuitas.

**Ningún crédito de ScrapeCreators se usó.** El proveedor solo entra cuando la
vía oficial declara que **no puede**, nunca cuando falló por algo nuestro —hay
test que lo fija con `CREDENCIAL_EXPIRADA`—.

---

## 11. Antes / después

| | Antes | Después |
|---|---|---|
| Entidades | 11 | 11 |
| Activos | 14 | 14 |
| Activos medidos | **0** | **4** |
| Publicaciones | 0 | **90** |
| Snapshots | 0 | **28** |
| Bylines | 0 | **26** |
| Series longitudinales | 0 | **14** |

---

## 12. Regresiones

Ninguna. Ranking idéntico (El Mercurio #1, 2 en ventana / 8 en corpus),
normalización temporal idéntica (11/28, 5 en 90d), universo idéntico (11/14),
render 53/53.

Las publicaciones nuevas se escriben con `submotor: media_measurement` y **no**
entran en el corpus de `mediaCorpus` (`media_piece`), así que el ranking no se
contamina. Conectarlas es una decisión de metodología que este gate no tomaba.

---

## 13. Aislamiento

Verificado: medir el proyecto A deja el B con **0 snapshots**. Sin `projectId`
no se mide.

---

## 14. Gaps

1. **Las 90 publicaciones no alimentan el ranking todavía.** Están en el Lake y
   separadas del corpus de piezas. Conectarlas cambia lo que el ranking mide.
2. **Facebook necesita credencial.** 4 activos esperando.
3. **El conflicto `x:tomebamba` necesita una decisión humana**; no hay UI para
   resolverlo (`PATCH` y alias existen por API).
4. **Threads no tiene vía.** Un activo.
5. **Las 5 entidades `OTHER`** siguen sin clasificar: son cuentas sociales sin
   evidencia de qué son. No se forzó.
6. Las suites nuevas **no están en `npm test`**: `package.json` sigue mezclado.

---

## 15. Readiness

**`MEDIA_INTELLIGENCE_READINESS: PARCIAL`** — 4 de 14 activos medidos.

No se redondea hacia arriba. Lo que sí se cumple: **cada activo conocido tiene un
estado explicable**, y ninguno queda en silencio.

---

## 16. Comprobaciones

| | |
|---|---|
| `mediaMeasurement.test.mjs` | **29 / 29** |
| `mediaSourceUniverse` · `mediaTime` | 32 / 32 · 28 / 28 |
| Media registradas | 142 / 142 |
| Suite completa backend | **1.473**, 0 fallos |
| Render de pantalla | **53 / 53** |
| Build | limpio |
| Lint | 6 preexistentes; **0 en Media** |
| Créditos de proveedor | **0** |

---

## 17. Siguiente gate

**`MEDIA-CORPUS-INTEGRATION-01`** — conectar las 90 publicaciones medidas al
corpus que alimenta el ranking, con la decisión metodológica explícita: hoy el
ranking mide *piezas analizadas y su amplificación*, y añadir el flujo RSS
cambia qué significa «presencia observada». Es una decisión de producto, no un
cableado, y por eso no se hizo aquí.
