# TERRITORIAL-LOCAL-MEDIA-DISCOVERY-03

**Última expansión local dirigida antes de Topic Normalization — Cuenca 2027**

Terminal 2 · Territorial Intelligence
Base: `5e30152` — TERRITORIAL-LOCAL-SOURCE-EXPANSION-02
Recolección: 2026-09-03 · Cierre documental: 2026-09-04

---

## A. Objetivo

No expandir en general. Buscar los tres vacíos que el gate anterior **midió**: medios locales (solo 2), organizaciones (0) y comunidad (0).

El criterio no era volumen. Era diversidad local corroborada.

## B. Commit base

`5e30152`. Corpus de partida: **573**.

## C–D. Presupuesto: autorizado vs usado

| Recurso | Autorizado | Usado | Nota |
|---|---|---|---|
| Brave | 6 | **6** | **desperdiciados por un error propio** (ver E) |
| SerpAPI | 2 | **2** | máximo autorizado, agotado |
| X | 3 | **3** | |
| YouTube | 3 | **3** | |
| ScrapeCreators | 0 | **0** | |
| Instagram / Facebook / TikTok provider | 0 | **0** | |
| HTTP directo a sitios | — | ~40 | gratuito |
| **Coste** | — | **$0** | |

**Peticiones externas durante esta continuación documental: 0.** Todo lo que sigue se reconstruyó desde el ledger persistido, los artefactos locales y el código.

---

## E. Incidente: `url` frente a `enlace`

Las 6 consultas de Brave se ejecutaron y devolvieron **60 resultados**. Mi extractor leía `x.url || x.link`. El proveedor devuelve **`enlace`** y **`descripcion`**.

Resultado: *«dominios candidatos distintos: 0»* con 60 resultados en la mano.

**Efecto real:** las 6 peticiones autorizadas de Brave se gastaron sin producir un solo candidato, y no se pueden repetir dentro del presupuesto. Si no lo hubiera detectado, este gate habría reportado «no se encontraron medios ni organizaciones locales» y esa conclusión habría sido **falsa por un error mío**, no por el territorio.

Lo delató la aritmética: 6 consultas × 10 resultados = 60, y cero dominios. La detección vino de que el número no cuadraba, no de una prueba.

Queda como lección concreta: **verificar la forma de la respuesta de un proveedor antes de gastar el presupuesto entero contra ella.** `searchIntelligence.normalizarResultadoDeBusqueda` sí contemplaba `enlace`; mi script de descubrimiento, no.

## F. Resultado de SerpAPI

Dos consultas, el máximo autorizado. Saldo verificable: **756 de 1 000**, 243 usadas este mes, renueva el 2026-09-24.

**Consulta 1 — organizaciones:** 9 resultados. Candidato real: `camaracuenca.com` (Cámara de Comercio de Cuenca). El resto: `facebook.com`, `ec.linkedin.com`, `yandex.com`, `instagram.com`, `google.com` ×2, `cumbrecceni.uazuay.edu.ec`, `expreso.ec`.

**Consulta 2 — medios:** 9 resultados. Candidatos: `elnuevotiempo.com`, `elmercurio.com.ec` (ya conocido), `cpccs.gob.ec`, `dspace.utpl.edu.ec`, `dspace.ucuenca.edu.ec`, `revistachasqui.org`, `es.scribd.com`, más `facebook.com` y `google.com`.

Observación honesta: **más de la mitad de los resultados de ambas consultas fueron plataformas y agregadores**, no fuentes.

---

## G–H. Fuentes descubiertas y clasificación

11 dominios candidatos, 10 no conocidos por el universo, más 2 ambiguos de alto valor arrastrados del gate anterior. Verificados por HTTP directo (gratis).

| Estado | N | Dominios |
|---|---|---|
| `LOCAL_CORROBORADA` | **2** | `cumbrecceni.uazuay.edu.ec`, `dspace.ucuenca.edu.ec` |
| `LOCAL_PROBABLE` | **1** | `elnuevotiempo.com` |
| `AMBIGUA` | **8** | `camaracuenca.com`, `google.com`, `cpccs.gob.ec`, `dspace.utpl.edu.ec`, `revistachasqui.org`, `es.scribd.com`, `radio.corape.org.ec`, `ecuador221.com.ec` |
| `EXCLUIDA` | **1** | `facebook.com` |
| `NO_LOCAL` | 0 | — |

**Las 2 corroboradas son ambas académicas y ambas subdominios de entidades que ya estaban** (`uazuay.edu.ec`, `ucuenca.edu.ec`). Como entidades nuevas: **cero**. Y ninguna tenía RSS.

**8 activos sociales** descubiertos por enlace desde esos sitios (profundidad 1): `x/uazuay`, `youtube/UCUkESMoN6-hBdvh5bRrmLKQ`, 4 de Facebook (`cceni.uda`, `SC3Ecuador`, `Brainmark-…`, `uazuay`), `instagram/uda.oficial`, `tiktok/uazuay`. Todos válidos, todos de **una** entidad. 2 con descubrimiento abierto, 6 solo `KNOWN_ACCOUNT_OBSERVATION`.

---

## I–L. El Nuevo Tiempo: el único hallazgo real, y apareció corrigiendo un defecto propio

`elnuevotiempo.com` — periodismo digital de Cuenca — quedó primero en **AMBIGUA** con el motivo *«sin señal de Ecuador ni de Cuenca»*.

**Ese motivo era falso.** Su sitio declara Cuenca, Azuay y Ecuador. La causa era mi regla: la rama `LOCAL_PROBABLE` exigía dominio `.ec`, así que un medio local en `.com` no podía ser ni probable y caía al último caso con un motivo que mentía.

`lavozdeltomebamba.com` lo desmiente por sí solo: es un medio local **corroborado** y es `.com`. **El TLD no decide la localidad.**

Corregido, con el motivo final también precisado para que no vuelva a afirmar lo que no comprobó:

| | |
|---|---|
| `elnuevotiempo.com` | **`LOCAL_PROBABLE`** · familia **`MEDIOS_LOCALES`** |
| Razones | declara Cuenca junto a Azuay o Ecuador · sin anclaje físico verificable, no se corrobora · se describe como «Periodismo» |
| RSS | **encontrado**: `https://elnuevotiempo.com/feed/` |
| Piezas persistidas | **10**, todas con `publishedAt` |
| Territorial | 2 corroboradas · 3 ambiguas · 5 no resolubles |
| Corpus | **609 → 619** |

Nota de trazabilidad: las 10 piezas se guardaron con `domain: "web:elnuevotiempo.com"` porque el lector de feeds usa como dominio el `sourceId` que se le pasa. La verdad de la fuente queda en `feedUrl`. Es una inconsistencia de nomenclatura, no un error de dato, y obligó a normalizar el prefijo `web:` al medir composición.

## M. Deduplicación

Primera pasada del gate: 47 entradas → **36 insertadas, 11 deduplicadas**. El Nuevo Tiempo: 10 → **10 insertadas, 0 deduplicadas**. Segunda pasada de control: **0 insertadas, 47 deduplicadas** — idempotente. `sinSustitucionDeFecha: true` en todas.

---

## N. Diversidad por familia — entidades con evidencia en el corpus

| Familia · Estado | Entidades | Cuáles |
|---|---|---|
| `INSTITUCIONAL_PUBLICO` · CORROBORADA | **9** | emac, azuay, emov, etapa, emuvi, farmasol, cuenca.gob.ec, cceazuay, centrosur |
| `MEDIOS_LOCALES` · CORROBORADA | **3** | El Mercurio, Unsión TV, La Voz del Tomebamba |
| `MEDIOS_LOCALES` · PROBABLE | **1** | **El Nuevo Tiempo** |
| `UNIVERSIDAD_ACADEMIA` · CORROBORADA | **3** | U. de Cuenca, U. del Azuay, U. Católica de Cuenca |
| `OTROS_LOCALES` · CORROBORADA | **1** | Club Deportivo Cuenca |
| `ORGANIZACIONES` | **0** | — |
| `CULTURA_COMUNIDAD` | **0** | — |
| **Total** | **17** | |

**Medios locales: 2 → 4** (3 corroborados + 1 probable). **Organizaciones: 0 → 0. Comunidad: 0 → 0.**

El Club Deportivo Cuenca sigue en `OTROS_LOCALES`. **No se reclasificó a comunidad para que la cifra dejara de ser cero.**

## O. Local vs nacional

| | Antes (573) | Después (619) |
|---|---|---|
| Local corroborada | 135 (23,6 %) | **145 (23,4 %)** |
| Local probable | 0 | **10 (1,6 %)** |
| **Local total** | 23,6 % | **25,0 %** |
| Nacional | 212 (37,0 %) | **212 (34,2 %)** |
| Otra / no aplicable | 226 (39,4 %) | 252 (40,7 %) |

La evidencia nacional **no bajó en absoluto** —siguen siendo las mismas 212 piezas, no se borró ninguna— y su dominancia relativa cayó **2,8 puntos**.

El 40,7 % «otra» sigue siendo mayoritariamente contenido de X y YouTube, cuyo `domain` es `x:<id>` o `youtube:<canal>` y no un host web. **La clasificación de localidad es dominio-céntrica y no aplica a plataformas sociales**: ahí la localidad depende del actor, no del host. Es una limitación conocida del módulo.

## P. Conversación pública

| | Antes | Después |
|---|---|---|
| `PUBLIC_CONVERSATION` | 124 | **143** |
| Emisores distintos | — | **74** |
| Territorialmente corroboradas | — | **70 de 143** |

Auditado como pide el gate: 143 piezas de **74 emisores distintos**, así que no depende de una sola cuenta. 70 corroboradas y 0 probables. No se llama «ciudadanía» a todo X: es **conversación pública observable**.

## Q. Dependencia de RSS

| | Antes | Después |
|---|---|---|
| `rss_directo` | 353 (**63,4 %**) | 373 (**60,3 %**) |
| `x_api` | 124 | 143 |
| `youtube_data` | 66 | 83 |
| `brave_web` | 20 | 20 |

Sigue dominando: **6 de cada 10 piezas vienen de RSS**, y ahí es donde pesan los medios nacionales.

---

## R. La limitación estructural que explica los ceros

Esta es la conclusión más útil del gate y no era la esperada.

Medido sobre HTML servido:

| Sitio | HTML | Texto | Ratio | Scripts | ¿menciona Azuay/Ecuador? |
|---|---|---|---|---|---|
| `camaracuenca.com` | 85 493 | 1 923 | **2,2 %** | 25 | no / no |
| `elnuevotiempo.com` | 304 233 | 9 627 | **3,2 %** | 65 | sí / sí |
| `elmercurio.com.ec` | 1 049 293 | 2 295 | **0,2 %** | 91 | no / no |

**El Mercurio, que es una fuente local corroborada, no expone «Azuay» ni «Ecuador» en su HTML servido.** Solo está corroborado porque ya venía con territorio declarado y verificado en el universo. Hoy no sería corroborable por la vía de texto.

Se comprobó además a **profundidad 1** sobre 7 rutas por dominio (`/contacto`, `/nosotros`, `/quienes-somos`, `/about`…): ninguno de los cuatro candidatos de alto valor expone anclaje en ninguna.

**Conclusión metodológica: la ausencia de anclaje territorial en HTML estático NO equivale a `NO_LOCAL`.** Por eso `camaracuenca.com` queda `AMBIGUA` y no rechazada, y por eso los ceros de organizaciones y comunidad **no significan que Cuenca no las tenga** — significan que sus sitios no publican en servidor lo que hace falta para corroborarlas gratis.

La regla no se relajó para llenar el hueco.

## S. `camaracuenca.com`

Es la Cámara de Comercio de Cuenca. **Se mantiene `AMBIGUA`.** No se promovió a pesar de que el nombre lo haga parecer obvio: eso es exactamente lo que este proyecto ya aprendió a no hacer con la palabra «Cuenca».

Para corroborarla haría falta: evidencia institucional adicional, la página renderizada en cliente, un enlace desde una fuente oficial ya corroborada, o verificación manual de un analista.

## T. Candidatos que siguen ambiguos

`camaracuenca.com` · `radio.corape.org.ec` · `ecuador221.com.ec` · `cpccs.gob.ec` · `dspace.utpl.edu.ec` · `revistachasqui.org` · `es.scribd.com` · `google.com`, más las 14 del gate anterior. Ninguna promovida. Ninguna verificada por analista.

---

## U–V. Pruebas y regresiones

`territorial-media-discovery`: **24 pruebas, 0 fallos**, cubriendo A–T. Cero red.

Un fallo propio corregido durante la escritura: mi caso de prueba usaba «Periodismo Digital» y el patrón de medios no incluía `periodismo`. En lugar de debilitar la prueba, se añadió el término — es literalmente cómo se autodescribe un diario digital, y es la evidencia real del sitio.

| Suite | Pruebas |
|---|---|
| `territorial` | 160 |
| `territorial-d2` | 92 |
| `territorial-sources` | 61 |
| `territorial-c2` | 53 |
| `territorial-fresh` | 50 |
| `territorial-topic` | 49 |
| `territorial-mesh` | 46 |
| `territorial-coverage` | 45 |
| `territorial-rotation` | 42 |
| `territorial-d` | 39 |
| `territorial-social` | 36 |
| `territorial-geo-disambiguation` | 36 |
| `territorial-persistence` | 35 |
| `territorial-local-source` | 31 |
| `territorial-listening` | 31 |
| `territorial-project` | 29 |
| `territorial-expansion` | 29 |
| `territorial-media-discovery` | **24** |
| **Total territorial** | **888 · 0 fallos** |

Candidate: `socialProviders` 36, `xReal` 37, `candidateIntelligence` 100, `accountIntelligence` 36 — verdes.
Media: `mediaPiece` 42, `mediaTime` 29, `mediaHome` 41, `mediaSourceUniverse` 33 — verdes.

`npm run build` correcto. `npm run lint`: 6 errores **preexistentes y ajenos** en `Dashboard.jsx` y `KnowledgeGraph.jsx`. No se tocó lint ajeno.

**Aislamiento de proyecto:** A = 619, B = 0.

## W. Peticiones externas en esta continuación

**0.** El documento se reconstruyó desde el ledger, los artefactos locales y el código. Verificado con el `fetch` global contado: `PETICIONES EXTERNAS EN ESTE CIERRE: 0`.

---

## X. Huecos conocidos

1. **`ORGANIZACIONES` = 0** y **`CULTURA_COMUNIDAD` = 0.** No por ausencia en el territorio, sino porque sus sitios no exponen anclaje verificable en HTML servido.
2. **6 peticiones de Brave perdidas** por el incidente `url`/`enlace`. Presupuesto agotado, no repetible.
3. **`camaracuenca.com` sin corroborar**, siendo una organización local real.
4. **60,3 % del corpus sigue viniendo de RSS**, con peso nacional.
5. **284 piezas `NO_RESOLUBLE`** (45,9 %) y **56 `AMBIGUO`**.
6. **El 40,7 % del corpus queda en localidad «otra»** por la limitación dominio-céntrica.
7. **Las 14 piezas sin `publishedAt`** siguen fuera de toda ventana temporal.
8. **`SHARED_GEO_CONTEXT_DEBT` intacta:** `esElAmbito` sin tocar en `geoResolver`.
9. **Verificación limitada a HTML servido.** No hay renderizado en cliente y no se añadió.

---

## Z. `TOPIC_NORMALIZATION_INPUT_CONTRACT`

Lo que el próximo gate encontrará disponible, por pieza, en el ledger canónico `territorial/evidenceLedger.js`.

### Estratos del corpus

| Estrato | N | ¿Alimenta métricas territoriales? |
|---|---|---|
| `CORPUS_OBSERVADO` | **619** | no por sí solo |
| `CORROBORADO` | **249** | **sí — vista estricta** |
| `PROBABLE` | **14** | solo en vista ampliada, etiquetado |
| `UTILIZABLE_EXPANDED` | **263** | sí, declarando composición |
| `AMBIGUO` | 56 | **no** |
| `CONFLICTIVO` | 2 | **no** |
| `FUERA` | 14 | **no** |
| `NO_RESOLUBLE` | 284 | **no** |
| `TEMPORALLY_ELIGIBLE` | **605** | requisito para ventanas |
| `TEMPORALLY_INELIGIBLE` | 14 | fuera de HOY/7D/15D/30D/90D |

### Campos disponibles por pieza

```
evidenceId          identidad estable y clave de dedup
projectId           alcaldia-cuenca-2027-piloto
tenantId            sentinel
canonicalUrl        cuando existe
domain / sourceId   host o identificador de plataforma
publisher           nombre público del emisor, cuando existe
emitterId           cuando se resolvió
title / summary     texto disponible
publishedAt         fecha editorial · NULL si no se conoce
firstObservedAt     inmutable
lastObservedAt      última observación
retrievedAt         instante de la pasada
observationCount    veces observada
providers[]         rss_directo | x_api | youtube_data | brave_web
provenance{}        providerId, query, queryType, queryLabel, observedAt
author              firma minimizada, cuando existe
```

### Dimensiones derivadas, calculables sin red

```
SOURCE_LOCALITY         localSourceVerification.clasificarLocalidad
                        LOCAL_CORROBORADA | LOCAL_PROBABLE | NO_LOCAL
                        | AMBIGUA | NO_RESOLUBLE | EXCLUIDA
CONTENT_TERRITORIALITY  socialGeoDisambiguation.desambiguarTerritorio
                        TERRITORIO_CORROBORADO | PROBABLE | AMBIGUO
                        | CONFLICTIVO | FUERA_TERRITORIO | NO_RESOLUBLE
CONTENT_NATURE          MEDIA 288 | PUBLIC_CONVERSATION 143
                        | INSTITUTIONAL 84 | OTHER 83
                        | SEARCH_RESULT 11 | ACADEMIC 10
SOURCE_FAMILY           MEDIOS_LOCALES | INSTITUCIONAL_PUBLICO
                        | UNIVERSIDAD_ACADEMIA | ORGANIZACIONES
                        | CULTURA_COMUNIDAD | OTROS_LOCALES
TEMPORAL_ELIGIBILITY    derivada de publishedAt != null
```

### Reglas que el próximo gate no puede romper

1. **`SOURCE_LOCALITY` ≠ `CONTENT_TERRITORIALITY`.** Una fuente local no territorializa su contenido; una fuente nacional no invalida una pieza explícitamente territorial. Ambas direcciones tienen prueba.
2. **`CORROBORADO` y `PROBABLE` nunca se suman en silencio.** Toda cifra ampliada declara su composición: *«263 señales territorialmente utilizables: 249 corroboradas y 14 probables»*, nunca «263 publicaciones de Cuenca».
3. **`AMBIGUO`, `CONFLICTIVO`, `FUERA` y `NO_RESOLUBLE` no alimentan métricas territoriales principales.** Se conservan como evidencia.
4. **Solo lo temporalmente elegible entra en ventanas.** `publishedAt = null` no se rellena con `observedAt`.
5. **`queryProvenance` no es evidencia territorial.** Viaja aparte de las señales.
6. **Nada afirma representatividad.** El corpus es conversación digital pública observable, no población.

### Orden de trabajo sugerido

Primero **`CORROBORADO` (249)**. Después, como segunda vista y separada, **`CORROBORADO + PROBABLE` (263)**. Para ventanas, solo la intersección con `TEMPORALLY_ELIGIBLE`.

---

## Y. Veredictos

| Dimensión | Estado |
|---|---|
| `LOCAL_MEDIA_UNIVERSE` | **OPERATIVE_WITH_LIMITATIONS** |
| `LOCAL_ORGANIZATION_UNIVERSE` | **INSUFFICIENT** |
| `LOCAL_COMMUNITY_UNIVERSE` | **INSUFFICIENT** |
| `PUBLIC_CONVERSATION_COVERAGE` | **OPERATIVE_WITH_LIMITATIONS** |
| `SOURCE_DIVERSITY` | **IMPROVED** |
| `TERRITORIAL_LOCAL_SOURCE_EXPANSION` | **COMPLETE** |
| `TOPIC_NORMALIZATION_DATA_READINESS` | **READY_WITH_LIMITATIONS** |

`LOCAL_MEDIA_UNIVERSE` mejoró de 2 a 4 entidades y sigue con limitaciones: solo 3 corroboradas y una probable, en una ciudad que tiene más medios.

`LOCAL_ORGANIZATION_UNIVERSE` e `LOCAL_COMMUNITY_UNIVERSE` son **INSUFFICIENT** y se declara sin adornos: cero entidades. La causa está medida —renderizado en cliente— y no se disimuló reclasificando instituciones.

`SOURCE_DIVERSITY = IMPROVED`: 16 → 17 entidades, +2 medios, +19 piezas de conversación pública, +19 emisores, RSS de 63,4 % a 60,3 %, nacional de 37,0 % a 34,2 %. Mejora modesta y real.

`TERRITORIAL_LOCAL_SOURCE_EXPANSION = COMPLETE`. Este era el último gate de expansión general y se cierra. Lo que falta pasa a ser `KNOWN_COVERAGE_LIMITATIONS`, no un cuarto gate.

**`TOPIC_NORMALIZATION_DATA_READINESS = READY_WITH_LIMITATIONS`.** El corpus tiene 619 piezas, 249 territorialmente corroboradas, 605 temporalmente elegibles, 143 de conversación pública con 74 emisores distintos, 17 entidades locales en 4 familias, y cada pieza distingue localidad de fuente, territorialidad de contenido, naturaleza, procedencia y temporalidad. Es suficiente para preguntar **«¿qué temas aparecen con mayor recurrencia en las fuentes públicas observables relacionadas con Cuenca en los últimos 7 días?»** con filtros metodológicos explícitos.

No es `READY` porque persisten dos sesgos que deben viajar con cada resultado: **6 de cada 10 piezas vienen de RSS con peso nacional**, y **no hay ninguna organización ni colectivo comunitario corroborado**, así que los temas reflejarán medios e instituciones antes que tejido social.

No es `NOT_READY`: no hay ningún defecto técnico que impida procesar el corpus.

---

## Siguiente paso exacto

**`TOPIC-NORMALIZATION-01`**, sobre el estrato `CORROBORADO` (249 piezas) ∩ `TEMPORALLY_ELIGIBLE`, con el contrato de entrada de la sección Z y las dos limitaciones anteriores declaradas en cada salida.

**STOP.** No se ejecuta Topic Normalization. No se abre un cuarto gate de expansión. No se usa ningún proveedor. No se toca Candidate ni la UX de Media. Se espera decisión humana.
