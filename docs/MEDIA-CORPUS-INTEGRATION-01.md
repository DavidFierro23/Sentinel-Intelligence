# MEDIA-CORPUS-INTEGRATION-01 — Integrar el corpus medido

**Fecha:** 2026-09-03
**Commit base:** `990bbba` (MEDIA-SOURCE-MEASUREMENT-01)
**Requests externos: 0. Créditos de proveedor: 0. Coste: 0,00 USD.**

Último gate técnico aislado de Media.

---

## 1. Arquitectura encontrada

| | Dónde |
|---|---|
| Corpus analítico anterior | `mediaCorpus.leerCorpusDeProyecto`, filtrando `linaje.submotor = media_piece` (clases `pieza` y `pieza_amplificacion`) |
| Las 90 publicaciones | `linaje.submotor = media_measurement`, clase `publicacion_de_medio` |
| Store que las persiste | `mediaMeasurementStore` |
| Endpoint del ranking | `GET /api/media/:proyectoId/home` |
| Función de Presencia | `construirPresencia` en `mediaHome.js` |
| Fechas | `mediaTime`, aplicado en `mediaCorpus.normalizarPieza` |
| `projectId` | filtro del Lake por dimensión `proyecto` |
| Dedup existente | `clavePieza` (`normalizarUrl`) en `mediaCorpus`; y `crossProviderDedup` en `ingest`, ya usado por `pieceAmplification` |

**No se creó un segundo corpus.** Se añadió una **vista canónica**
(`mediaCanonicalCorpus`) sobre los dos almacenes que ya existen. Nada se copia y
nada se reescribe.

La reconciliación **no se programó de nuevo**: la hace `crossProviderDedup`, que
ya distinguía los cuatro criterios y ya declaraba la regla que importa —«dos
medios distintos publicando el mismo texto son DOS publicaciones»—. Este gate
solo traduce su traza a las cinco clases pedidas.

---

## 2. Corpus antiguo (antes)

| | |
|---|---|
| Piezas totales | **28** (2 analizadas + 26 amplificación) |
| Datadas | 11 |
| Sin fecha | 17 |
| HOY / 7D / 15D / 30D | 0 / 0 / 0 / 0 |
| 90D | **1** |

## 3. Corpus de medición

**90 publicaciones**, las 90 con `publishedAt` real. Confirmado en este gate:
sigue siendo 90, con 90 claves únicas.

---

## 4. Estrategia de reconciliación

`118 entradas → 15 excluidas → 103 canónicas`. **No es 28 + 90 = 118**: primero
se excluye lo que no es publicación editorial, y después se reconcilia.

| Clase | Resultado |
|---|---|
| **EXACT_DUPLICATE** | 0 |
| **PROBABLE_DUPLICATE** | 0 |
| **REPUBLICATION** | 0 |
| **DISTINCT_PUBLICATION** | 103 |
| **EXCLUDED_ARTIFACT** | 15 |

Cero solapes es el resultado **real** y coherente: la amplificación llegó de
búsquedas y las 90 medidas de los feeds de los propios medios, y no coincidieron
en ninguna URL. El mecanismo sí está probado con fixtures (tests A, B, C, D, E).

### Exclusiones, con su motivo

| Motivo | Piezas |
|---|---|
| `ARTEFACTO_DE_RECOLECCION` (google.com) | 7 |
| `DOMINIO_DE_PLATAFORMA` (facebook, instagram, threads) | 6 |
| `HOST_DE_INFRAESTRUCTURA` (balanceador AWS) | 2 |

Nada se oculta: los 5 dominios siguen visibles en
`presencia.artefactosDeRecoleccion`, ahora **con el recuento de piezas
excluidas**, que antes no existía.

---

## 5. Procedencia

Una pieza canónica conserva **todas** sus rutas: `procedencias[]`,
`observacionesPorRuta[]`, `firstObservedAt`, `lastObservedAt` y
`duplicadosAbsorbidos`. Las republicaciones quedan enlazadas en
`republicadaCon[]` **sin fundirse**.

Rutas en el corpus del piloto: `MEDIA_MEASUREMENT` 90 · `AMPLIFICACION` 11 ·
`ANALISIS_DE_PIEZA` 2.

---

## 6. Corpus canónico final

| | |
|---|---|
| Piezas totales | **103** |
| Datadas | **100** |
| Sin fecha | 3 |
| Medios representados | **6** |
| HOY | 0 |
| 7D | **82** |
| 15D | **87** |
| 30D | **88** |
| 90D | **94** |

`HOY = 0` es una **medición**: los feeds se leyeron el 1 de septiembre y hoy es
el 3, así que ninguna pieza se publicó hoy. Proporción datable: **97,1 %**
(antes 39 %).

---

## 7. Ranking — antes y después

**Antes (90D):** #1 El Mercurio (2) · #2 Expreso (1) · #3 threads.com (1) ·
#4 La Voz del Tomebamba (1). Y **7D estaba entero a cero.**

**Después (90D):**

| # | Fuente | Ventana | Corpus |
|---|---|---|---|
| 1 | Expreso | **41** | 41 |
| 2 | El Universo | **40** | 41 |
| 3 | El Mercurio | **12** | 18 |
| 4 | La Voz del Tomebamba | 1 | 1 |
| 5 | Prefectura del Azuay | Cobertura insuficiente | 1 |
| 6 | Primicias | 0 | 1 |

**Después (7D):** El Universo 40 · Expreso 32 · El Mercurio 10.

Se actualizó **el ranking existente**. No hay ranking nuevo, ni pesos, ni score,
ni influencia, ni audiencia, ni alcance, ni share of voice.

### Un cambio de criterio, declarado

El ranking pasa de 9 filas a **6**. Las tres que salen —`facebook.com`,
`instagram.com`, `threads.com`— tienen aristas hacia candidatos pero **cero
piezas canónicas**: sus publicaciones eran raíces de plataforma, donde el emisor
es la cuenta y no el dominio. Presencia es aparición en el corpus, y una fuente
con cero apariciones no está presente. No se ocultan: van a
`presencia.fuentesSinPiezasCanonicas` con su motivo, y sus relaciones siguen
contando en Candidatos × Medios.

---

## 8. Explicabilidad

Cada fila responde «¿Por qué está aquí?» con contribuciones observables reales,
y el recuento de la razón **coincide con el dato de la fila** (test P). Ejemplo
real de Expreso:

- 41 pieza(s) de esta fuente en el corpus del proyecto.
- 41 de 41 pieza(s) datables caen dentro de la ventana de 90 días.
- Aristas MEDIO_PUBLICA_SOBRE observadas hacia: Paúl Carrasco Carpio.
- Dominio expreso.ec presente en el catálogo semilla.

Con su límite declarado: *no explican audiencia, alcance ni importancia
editorial*. Ninguna razón afirma causalidad, y hay test que lo comprueba.

---

## 9. Top N

Se ofrecen 10 / 20 / 50 y se muestran **6**, que es lo que hay. No se fabrica
ninguna fila (test O).

---

## 10. Identidad

`x:tomebamba` **sigue sin resolver**, reclamado por «La Voz del Tomebamba» y
«Radio Tomebamba». Su pieza queda con `mediaEntityId: null`,
`atribucionEnConflicto: true` y las dos entidades en disputa declaradas.

La pieza es **real** —la cuenta publicó ese post— y lo que está en duda es de qué
cabecera es la cuenta. Conservarla sin atribuir es la única lectura honesta:
borrarla perdería evidencia, atribuirla sumaría a una de las dos algo que quizá
es de la otra. Las publicaciones **medidas** de un activo en conflicto se
excluyen del corpus (test I).

`ANALYST_DECLARED ≠ SYSTEM_VERIFIED` y `identityState` sigue separado de
`measurementState`.

---

## 11. Comentarios

**0 comentarios observados**, y es un conteo real del submotor correspondiente.
El feed de comentarios de El Mercurio sigue fuera.

### Un defecto encontrado y corregido

La guarda de feeds de comentarios del corpus canónico **estaba muerta**:
`esFeedDeComentarios` parsea con `new URL()` y exige esquema, y las claves
canónicas vienen normalizadas **sin** esquema, así que devolvía siempre `false`.
No se había notado porque la capa de medición ya descarta ese feed antes de
leerlo, así que ninguna publicación de ese origen llegaba. Corregido, y con test
propio (F).

---

## 12. Snapshots — corrección de la semántica del gate anterior

MEDIA-SOURCE-MEASUREMENT-01 reportó «28 snapshots, 14/14 series listas» teniendo
**4 de 14 activos medidos**. Las dos cifras no podían ser ciertas a la vez, y la
equivocada era la segunda: se contaba como serie cualquier par de snapshots,
incluidos los que solo guardaban un **estado**.

Tres clases, ahora explícitas:

| Clase | Piloto |
|---|---|
| `METRIC_BEARING_SNAPSHOT` | **0** |
| `CONTENT_BEARING_SNAPSHOT` | 6 |
| `TECHNICAL_STATUS_SNAPSHOT` | 36 |

| | Antes (reportado) | Ahora (real) |
|---|---|---|
| Series analíticas listas | «14/14» | **0 / 14** |
| Series de volumen | — | **3 / 14** |

Un snapshot que dice `REQUIERE_CREDENCIAL` dos días seguidos **no es una serie**:
es la misma ausencia registrada dos veces. Y un feed entrega piezas, no cifras,
así que habilita serie de **volumen**, no de rendimiento.

**No se calcula Media Momentum**, y hay test que lo comprueba sobre la respuesta
serializada.

---

## 13. Un segundo defecto latente, corregido

Las filas de publicación medida usaban la URL normalizada como `entidad` del
Lake, igual que las piezas analizadas. Como `claveEntidad` se compone de
`tenant + proyecto + tipoEntidad + entidad` y **no incluye el submotor**, una
publicación medida de la misma URL se convertía en una **versión nueva de la
pieza analizada**: una lectura con `soloVigentes` dejaba de ver la pieza, con su
emisor, sus métricas y su amplificación.

No se perdía el dato, **desaparecía de las lecturas**, que es peor porque no se
nota. No se manifestó en producción porque el solape real era 0.

Corregido con prefijo `pub:`. Las filas anteriores siguen leyéndose: el filtro es
por submotor y clase, no por la forma de la clave. Y `aFormaDedup` normaliza
ahora la clave siempre en lugar de confiar en la del almacén, para que la
reconciliación no dependa de la disciplina de cada escritor.

---

## 14. Aislamiento por proyecto

Verificado: integrar en A deja B intacto, 0 fugas en ambos sentidos. Sin
`projectId` no hay corpus canónico.

---

## 15. Coste

| | |
|---|---|
| Requests externos | **0** |
| Créditos ScrapeCreators | **0** |
| Requests API oficial | **0** |
| Coste | **0,00 USD** |

Todo se ejecutó sobre datos ya persistidos. Verificado además que con los canales
desactivados la medición hace **0 llamadas reales**.

---

## 16. Comprobaciones

| | |
|---|---|
| `mediaCorpusIntegration.test.mjs` | **25 / 25** (A–V) |
| `mediaHome` · `mediaTime` · `mediaSourceUniverse` · `mediaMeasurement` | 40 · 28 · 32 · 31, **0 fallos** |
| Suite completa backend | **1.473**, 0 fallos |
| Render de pantalla | **53 / 53** en `90d`, `7d` y `hoy` |
| Build | limpio |
| Lint | 6 errores preexistentes; **0 en Media** |

**Tres aserciones existentes cambiaron y ninguna se debilitó:** dos porque el
artefacto ahora se clasifica por motivo y trae recuento de piezas (más
información que antes), y una porque afirmaba que dos snapshots cualesquiera
bastaban para una serie — que es exactamente el defecto corregido. Se añadieron
además tres pruebas nuevas de semántica de snapshot.

---

## 17. Frontend

Cambio **mínimo y necesario**: sin él, el Resumen mostraba «1 analizada · 3
relacionadas» sobre un corpus de 103 piezas, ocultando las 90 medidas. Se añadió
la tarjeta «Piezas medidas» y una sección «Cómo se formó este corpus» con la
reconciliación y las rutas de observación.

No se rediseñó Sidebar, ni navegación, ni se creó Resumen global ni Sentinel AI.

---

## 18. MEDIA_INTELLIGENCE_READINESS

**`OPERATIVO_CON_LIMITACIONES`**

Lo que funciona: corpus canónico reconciliado y auditable, ventanas reales
(7D/15D/30D/90D con datos), ranking explicable, aislamiento certificado,
identidad separada de medición.

Lo que no: 0 series con métricas (los feeds no las dan), Facebook esperando
credencial, un conflicto de identidad sin resolver, y 4 de 14 activos medidos.

---

## 19. Estado de la línea Media

Siete gates cerrados: `PIECE-01/02` → `REAL-DEMO-01` → `UX-HOME-01` →
`UX-CERT-01` → `TIME-NORMALIZATION-01` → `SOURCE-UNIVERSE-01` →
`SOURCE-MEASUREMENT-01` → `CORPUS-INTEGRATION-01`.

**Media queda congelado como línea técnica aislada.**
