# MEDIA-SOURCE-UNIVERSE-01 — Universo de medios por proyecto

**Fecha:** 2026-09-01
**Gate anterior:** MEDIA-TIME-NORMALIZATION-01 (`909cadc`)
**Requests externos: 0. Coste: 0,00 USD.**

---

## 1. El modelo previo, tras auditar lo que ya existía

Antes de crear nada se localizaron **cuatro** estructuras que ya representan
fuentes. Ninguna se duplicó:

| Módulo | Qué representa hoy | Limitación |
|---|---|---|
| `conversation/mediaRegistry` | Catálogo semilla por dominio | Lista escrita a mano; no acumula |
| `conversation/sourceUniverse` | Registro de fuentes con estados y orígenes | Indexa por dominio; en memoria; sin proyecto |
| `ingest/mediaSourceRegistry` | Medios y sus feeds RSS | En memoria; sin proyecto |
| `territorial/verifiedSourceUniverse` | Fuentes verificadas de un territorio | De la línea territorial; por territorio, no por proyecto |

De `sourceUniverse` se **reutiliza el vocabulario entero** —`TIPOS_SOURCE`,
`SUBTIPOS_MEDIA`, `ESTADOS_SOURCE`, `ORIGENES_SOURCE`— por reexport, no por
copia. Crear una taxonomía paralela habría producido dos verdades sobre la
misma pregunta.

### Lo que ninguna modelaba

**Una entidad media por encima de los dominios.** Las cuatro indexan por
dominio, pero «La Voz del Tomebamba» es *una* entidad que posee un sitio, una
Página de Facebook, un Instagram, una cuenta de X, un canal de YouTube y un
feed. Con un registro por dominio, esa emisora son seis fuentes y ninguna sabe
de las otras.

Y faltaba que eso **persistiera** y fuera **por proyecto**: `crearUniverso()`
vive en memoria y se reconstruye en cada llamada, así que nada de lo que un
analista declare sobrevive a la petición.

---

## 2. El modelo nuevo

```
MEDIA ENTITY  (media:elmercurio.com.ec)
  ├── canonicalName · aliases[] · tipo · subtipo
  ├── scope { declarado, editorialInferido: null }
  ├── activos[]        DOMINIO · SOCIAL · FEED   (N por plataforma)
  ├── origen · estado · verificación
  ├── firstObservedAt · lastObservedAt · activa
  ├── procedencia[] · evidenceIds[]
  └── historial[]
```

**Cinco reglas** sostienen el modelo:

1. **ENTIDAD ≠ DOMINIO ≠ ACTIVO.** Colapsarlos pierde activos; separarlos de más
   duplica emisores.
2. **N activos por plataforma.** Clave = `plataforma + handle normalizado`, la
   misma regla que Candidate desde `P-CAND-FB-MULTI-ASSET-01`.
3. **Declarar no es verificar.** Ninguna acumulación de declaraciones asciende
   sola a `VERIFICADA`.
4. **No se deduplica por nombre.** «El Diario» existe en media docena de países.
5. **La infraestructura no entra.** Si entra, acaba en un ranking.

El id sale del **dominio**, no del nombre: un medio se renombra y el id no puede
cambiar con él, porque es lo que ata las evidencias.

---

## 3. Entidades reales del proyecto piloto

**11 entidades · 14 activos** (6 dominios, 7 sociales, 1 feed) · 3 artefactos
fuera · 0 sin resolver · 0 posibles duplicados.

| Entidad | Tipo | Estado | Origen | Piezas | Activos |
|---|---|---|---|---|---|
| El Mercurio | MEDIA | OBSERVADA | evidencia | 8 | `elmercurio.com.ec` |
| Radio Tomebamba | MEDIA | **VERIFICADA** | **analista** | 0 | dominio + feed + `x:tomebamba` + `facebook:radiotomebamba` |
| @elmercurioec | OTHER | DESCUBIERTA | evidencia | 1 | `facebook:elmercurioec` |
| @unsiontv | OTHER | DESCUBIERTA | evidencia | 1 | `facebook:unsiontv` |
| @manteteinformado | OTHER | DESCUBIERTA | evidencia | 1 | `facebook:manteteinformado` |
| @notivozec | OTHER | DESCUBIERTA | evidencia | 1 | `threads:notivozec` |
| La Voz del Tomebamba | OTHER | DESCUBIERTA | evidencia | 1 | `x:tomebamba` |
| El Universo | MEDIA | DESCUBIERTA | evidencia | 1 | `eluniverso.com` |
| Expreso | MEDIA | DESCUBIERTA | evidencia | 1 | `expreso.ec` |
| Primicias | MEDIA | DESCUBIERTA | evidencia | 1 | `primicias.ec` |
| Prefectura del Azuay | INSTITUTION | DESCUBIERTA | evidencia | 1 | `azuay.gob.ec` |

Por tipo: MEDIA 5 · OTHER 5 · INSTITUTION 1. Por estado: DESCUBIERTA 9 ·
OBSERVADA 1 · VERIFICADA 1.

### Artefactos excluidos, con su motivo

| Dominio | Piezas | Motivo |
|---|---|---|
| `google.com` | 7 | Agregador / redirector de buscador |
| `mw-public-alb-…elb.amazonaws.com` | 2 | Host de infraestructura |
| `instagram.com` | 2 | Plataforma sin cuenta identificable en la URL (`/p/…`) |

---

## 4. Descubrimiento

Recorre las piezas ya observadas. **No hace ninguna petición**: lee el corpus,
no Internet.

La pieza clave del algoritmo: una publicación de `x.com` **no** crea la entidad
«x.com». Crea la entidad de la **cuenta**, y la cuenta se ata a un medio del
catálogo solo si un analista lo confirma.

### Dos defectos reales que encontró el corpus

**`threads.com` entraba como si fuera una cabecera.** `sourceUniverse.esPlataforma`
no lo conoce, y ese fichero lo comparten conversation y territorial. Se combina
con una tabla local en vez de ampliar el fichero ajeno. La pieza era
`threads.com/@notivozec/post/…`: el emisor es la cuenta.

**El nombre del emisor a veces ES el dominio.** El corpus trae
`nombreEmisor: "threads.com"`, lo que dejaba una entidad llamada «threads.com»
cuyo único activo era `@notivozec`. Si el nombre no aporta nada sobre la cuenta,
gana el handle.

---

## 5. Declaración del analista

`POST /api/media/:proyectoId/universo` → `origen = analista`,
`estado = DESCUBIERTA`, **`verificación ≠ VERIFICADA`**, con el motivo escrito
en el propio objeto y no solo en la documentación.

Verificado en real: «Radio Tomebamba» declarada con 4 activos (dominio, feed, X,
Facebook) → guardada, **no verificada**.

---

## 6. Verificación

`POST …/universo/:id/verificar` **exige decir quién verifica**. Sin autor
devuelve 422 y no cambia nada — comprobado por HTTP.

---

## 7. Deduplicación

| Caso | Resultado |
|---|---|
| `elmercurio.com.ec` vs `www.elmercurio.com.ec` | **Funde** — mismo dominio |
| Alias declarado que apunta al dominio de la otra | **Funde** |
| «El Diario» (`eldiario.ec`) vs «El Diario» (`eldiario.com.ar`) | **NO funde**, y se declara el par |
| `@elmercurioec` vs `El Mercurio` | **NO funde** — se propone la correspondencia, sin confirmar |

El último caso es el importante: la cuenta de Facebook de El Mercurio y el sitio
de El Mercurio **no se unen automáticamente**. Se propone la correspondencia con
su fuerza y su estado, y un analista decide. Unirlas por parecido de handle es
exactamente lo que la regla 4 prohíbe.

---

## 8. Multi-activo

Probado: dos Páginas de Facebook del mismo medio son **dos activos**; una
entidad sostiene dominio + social + feed a la vez; el mismo handle en dos
plataformas son dos activos distintos.

Un activo en una plataforma **fuera** de la lista de canales (Threads, LinkedIn)
no queda invisible: se cuenta en `activosFueraDeCanales`. Lo encontró el corpus
real — `@notivozec` aparecía con cero canales teniendo un activo.

---

## 9. Evidencia y procedencia

Cada entidad conserva `evidenceIds[]`, `procedencia[]` acumulada,
`firstObservedAt` y `lastObservedAt` sobre el rango real. Ninguna evidencia se
reescribe: el descubrimiento **deriva**, no muta.

---

## 10. Aislamiento por proyecto

Verificado con **el mismo dominio en dos proyectos**: identidad de dominio
compartida, recuentos separados (A = 2 piezas, B = 1). Un medio declarado en A
no aparece en B. Comprobado también por HTTP contra un segundo proyecto real:
0 entidades, 0 fugas.

---

## 11. Cobertura

Por entidad y por canal: `website · rss · facebook · instagram · tiktok · x ·
youtube`, con estados `ENCONTRADO / SIN_ACTIVO_CONOCIDO / …`.

**ENCONTRADO no es MEDIDO**, y hay test que lo fija: saber que existe una cuenta
no es haber leído una métrica de ella. Ningún canal pasa a MEDIDO en este gate.

---

## 12. Periodistas — solo preparación

Este gate **no** construye Journalist Intelligence. Se comprobó que la firma
(`Patricia Naula Herembás`) sigue llegando desde el corpus y se podrá atar a su
entidad cuando exista el módulo.

⚠️ **Coordinación necesaria:** Terminal 2 ha creado
`services/territorial/journalistUniverse.js`. No se tocó. Antes de construir
Journalist Intelligence en Media hay que decidir si esa entidad es compartida o
si son dos cosas distintas — exactamente el error que este gate evitó con las
cuatro estructuras de fuentes.

---

## 13. Contrato UI-ready — y UI construida

La UI **no estaba en conflicto** (nadie más tocaba `apps/web`), así que se
construyó:

- Tabla del universo en **Medios**: nombre, tipo, territorio declarado, activos,
  origen, estado, última observación, más las correspondencias propuestas.
- Artefactos excluidos y posibles duplicados, declarados y visibles.
- **`+ Agregar medio` funcional**, cerrando la promesa que
  `MEDIA-UX-CERT-01` dejó como «próximamente». El formulario es mínimo a
  propósito: lo que importa no son los campos sino la regla, y el aviso dice que
  lo que entra queda declarado y sin verificar.

`GET /api/media/universo/contrato` publica vocabulario y campos del alta para
que la UI se construya contra el contrato y no al revés.

---

## 14. Limitaciones

1. **El ranking sigue nombrando por dominio.** `mediaHome` muestra
   «threads.com» donde el universo dice `@notivozec`. Consumir el universo desde
   el ranking es un cambio de metodología y el gate lo prohibía.
2. **Las correspondencias no se confirman por UI.** El backend las propone; falta
   la acción de confirmar. `PATCH` y `verificar` existen por API.
3. **Los tipos de las cuentas sociales son `OTHER`.** Correcto —no hay evidencia
   de qué son— pero significa que 5 de 11 entidades están sin clasificar.
4. **`editorialInferido` está siempre en `null`.** Deliberado: publicar sobre un
   territorio no declara cobertura sobre él.
5. **Ninguna suite de Media nueva está en `npm test`**: `package.json` sigue
   mezclando líneas sin commitear de otra terminal y el gate prohibía tocarlo.
   Se ejecutan con `node tests/<suite>.test.mjs`.

---

## 15. Comprobaciones

| | |
|---|---|
| `mediaSourceUniverse.test.mjs` | **32 / 32** |
| `mediaTime.test.mjs` | 28 / 28 |
| Suites de Media registradas | 142 / 142 |
| Suite completa backend | **1.473**, 0 fallos |
| Render de pantalla | **53 / 53** con universo; 47/47 sin él |
| Regresión ranking | idéntica (El Mercurio #1, 2 en ventana / 8 en corpus) |
| Regresión tiempo | idéntica (11/28 normalizadas, 5 en 90d) |
| Build | limpio |
| Lint | 6 errores preexistentes; **0 en Media** |
| Requests externos | **0** |

---

## 16. Siguiente gate

**`MEDIA-SOURCE-COVERAGE-01`** — pasar los activos conocidos de `ENCONTRADO` a
`MEDIDO`: leer los feeds RSS que el universo ya conoce y observar las cuentas
sociales por las vías que Candidate ya tiene validadas. Es el paso que convierte
un padrón en observación, y el universo ya declara exactamente qué falta por
canal y por entidad.
