# TERRITORIAL-TOPIC-NORMALIZATION-01

**Normalización de temas observables — Cuenca 2027**

Terminal 2 · Territorial Intelligence
Base: `f528cb4` — TERRITORIAL-LOCAL-MEDIA-DISCOVERY-03
Ejecutado: 2026-09-05 · Método `topic-norm-1.0.0`

---

## 1. Qué es un tema aquí y qué no

Un tema es una **agrupación de evidencias textualmente relacionadas**. Nada más.

No es una tendencia, ni viralidad, ni opinión pública, ni preocupación ciudadana, ni importancia electoral, ni sentimiento. Ordenar los temas por `evidenceCount` es para inspección, **no es un Trend Score**. No se generó ningún `trendScore`, `viralityScore`, `importanceScore` ni `sentiment`, y hay una prueba que lo verifica.

**Cero red, cero créditos, $0.** Todo se calculó sobre el corpus persistido, con el `fetch` global contado en cada ejecución y en cada prueba.

---

## 2. Contrato de entrada y tamaños de corpus

| Universo | Definición | N |
|---|---|---|
| `CORPUS_OBSERVADO` | todo el ledger del proyecto | **619** |
| **`PRIMARY_TOPIC_CORPUS`** | `CORROBORADO` ∩ temporalmente elegible | **239** |
| **`SECONDARY_TOPIC_CORPUS`** | (`CORROBORADO` + `PROBABLE`) ∩ temporalmente elegible | **253** |

Excluidas de PRIMARY (380): `NO_RESOLUBLE` 284 · `AMBIGUO` 56 · `FUERA_TERRITORIO` 14 · `CONFLICTIVO` 2 · `PROBABLE` 14 · temporalmente inelegibles 14.

Nota: 249 piezas son `CORROBORADO`, pero **10 de ellas no tienen `publishedAt`** y por eso PRIMARY son 239, no 249. Ninguna se rellenó con `observedAt`.

**Nada se borró del ledger.** Lo excluido sigue ahí; simplemente no cuenta.

---

## 3. Inventario de texto — medido, no supuesto

| Proveedor | N | `title` | `summary` |
|---|---|---|---|
| `rss_directo` | 373 | 100 % (86 car.) | 100 % (226) |
| `x_api` | 143 | **0 %** | 100 % (271) |
| `youtube_data` | 83 | 100 % (64) | 84 % (120) |
| `brave_web` | 20 | 100 % (74) | 100 % (217) |

**Un tuit no tiene titular.** Un pipeline que solo lea `title` pierde 143 piezas enteras. Los únicos campos de contenido que existen son `title` y `summary`; no hay `text`, `content`, `headline` ni `description`.

En PRIMARY: 169 con título, **70 solo con resumen**. Tokens por documento: mín. 3, media 25,9, máx. 76. Con al menos una entidad conocida: 103 (43 %). Sin ningún término distintivo: **0**.

### La consulta no es contenido

`provenance.queryLabel` —«x:comunidad:local», «yt:medios:local»— **no entra en el texto del documento**. Si entrara, las consultas usadas para descubrir una pieza fabricarían su tema y el sistema encontraría exactamente lo que fue a buscar. Ese círculo ya se pagó caro en este proyecto con `esElAmbito`. La prueba I lo fija: verifica que ni la etiqueta ni la consulta aparecen en tokens ni en términos distintivos, y que no pueden unir una pieza con el tema minero real.

---

## 4. Pipeline de normalización

Determinista y versionado (`topic-norm-1.0.0`). **El original no se destruye**: la versión normalizada es derivada.

1. **Unicode NFC** y espacios — sin esto «á» compuesta y precompuesta son tokens distintos.
2. **Boilerplate de feeds** fuera. Los feeds de WordPress cierran con «La entrada X appeared first on Y»: sin quitarlo, `appeared` y `first` acabaron entre las keywords de tres temas —ETAPA, Universidad de Cuenca— como si fueran vocabulario del asunto. **Se detectó leyendo los temas producidos**, no antes.
3. **URLs** fuera (se cuentan).
4. **Menciones** `@cuenta` fuera del texto, guardadas como señal de actor.
5. **Hashtags**: se quita la almohadilla y **se conserva la palabra** — `#Cuenca` y `Cuenca` son el mismo término.
6. **Entidades** detectadas antes de quitar puntuación, contra un gazetteer de 40 entidades locales reales (ETAPA, EMOV, EMAC, Farmasol, Centrosur, tranvía, Loma Larga, Quimsacocha, El Arenal, ríos Tomebamba/Yanuncay/Machángara, hospitales, universidades…).
7. **Acentos y puntuación** fuera para comparar; dígitos sueltos fuera.
8. **Stopwords** del español (≈180) y tokens de menos de 3 caracteres.
9. **Bigramas y trigramas** de tokens contiguos.

### Términos genéricos: atenuados, no borrados

`cuenca`, `ecuador`, `azuay`, `hoy`, `noticia`, `ciudad`, `video`… están en casi todo el corpus y no distinguen nada. **No se eliminan**: se atenúan al 15 % en el vector TF-IDF y no pueden fundamentar una unión por sí solos. Así siguen formando parte de entidades —«Universidad de **Cuenca**», «Deportivo **Cuenca**», «Municipio de **Cuenca**»— que sí discriminan.

---

## 5. Alternativas de agrupación comparadas

Tres métodos, misma entrada, mismo gold set:

| Método | Cómo decide |
|---|---|
| **A · `TFIDF_COSENO`** | TF-IDF sobre tokens + coseno. |
| **B · `SOLAPAMIENTO_LEXICO`** | Jaccard sobre términos distintivos y entidades. |
| **C · `HIBRIDO`** | **Puerta dura**: sin término distintivo compartido el valor es **cero**, por alto que sea el coseno. Pasada la puerta, ordena el coseno. |

No se usaron embeddings: no hay infraestructura local instalada y §12 prohíbe descargar modelos. No se usó ningún LLM — §27 exige clasificación determinista y auditable, y el nombre del tema se deriva de la evidencia.

Agrupación aglomerativa de una pasada, **orden determinista por `evidenceId`**, comparando contra el **miembro más parecido** del grupo y no contra un centroide: un centroide de asuntos mezclados atrae cualquier cosa y realimenta el mega-cluster.

---

## 6. Gold set

**44 evidencias reales** del corpus, etiquetadas a mano leyendo cada pieza. 10 grupos de asunto, 5 piezas sueltas como trampa deliberada, 3 pares marcados `UNCERTAIN` que no entran en precisión ni recall.

Composición: `x_api` 22 · `rss_directo` 16 · `youtube_data` 6. `PUBLIC_CONVERSATION` 22 · `INSTITUTIONAL` 10 · `MEDIA` 6 · `OTHER` 6. Localidad de fuente: `LOCAL_CORROBORADA` 16 · `AMBIGUA` 28.

**820 pares evaluables** (57 `SAME`, 763 `DIFFERENT`).

**Grupos:** intercambiador Monay-IESS (7) · operativo antidroga Paccha-Nulti (3) · candidaturas alcaldía/prefectura (4) · Festival del Cuy en Nulti (3) · concesiones mineras y defensa del agua (5) · obras de agua potable de ETAPA (3) · caudales de ríos de ETAPA (2) · muros vía Cuenca-Girón (3) · volcamiento vía Molleturo (2) · invitaciones a proveedores de Farmasol (4).

**Trampas** — mismo vocabulario, asunto distinto:
- cortes de agua de ETAPA **≠** obras de agua potable de ETAPA
- riego El Coco en Nulti **≠** Festival del Cuy en Nulti
- alumbrado público vía Molleturo **≠** volcamiento vía Molleturo
- aniversario de la CCE **≠** agenda de conciertos de la CCE

**`UNCERTAIN`:** casi accidente *en* el intercambiador vs su inauguración · un vídeo que solo trae `#noboa #mineria` sin texto · deslizamiento vs volcamiento en la misma vía.

**No se usó `queryLabel` como verdad** en ninguna etiqueta.

---

## 7. Sensibilidad de umbral

Con la configuración final (`HIBRIDO`), sobre PRIMARY:

| Umbral | P | R | F1 | falsos merge | falsos split | temas | mayor | sin clasificar |
|---|---|---|---|---|---|---|---|---|
| 0,42 | 1,000 | 0,105 | 0,190 | 0 | 51 | 19 | 10 | 186 |
| 0,34 | 1,000 | 0,193 | 0,324 | 0 | 46 | 22 | 10 | 177 |
| 0,30 | 1,000 | 0,193 | 0,324 | 0 | 46 | 24 | 10 | 172 |
| 0,24 | 1,000 | 0,193 | 0,324 | 0 | 46 | 30 | 10 | 153 |
| **0,18** | **0,957** | **0,772** | **0,854** | **2** | **13** | **37** | **11** | **109** |
| 0,12 | 0,893 | 0,877 | 0,885 | 6 | 7 | 36 | 15 | 73 |

**Umbral elegido: 0,18.** F1 0,854 con solo 2 falsos merges. A 0,12 el F1 sube 3 puntos pero los falsos merges se triplican, y las fusiones erróneas son mucho peores que las divisiones: un tema fundido crea un asunto grande falso, mientras que uno partido solo subcuenta.

**En ningún método ni umbral apareció un mega-cluster:** el grupo mayor va de 10 a 15 piezas, entre el 4,2 % y el 6,3 % de 239.

### Un error propio que cambió la decisión

Con la primera versión, el umbral 0,18 daba R=0,368 y elegí 0,12. Al inspeccionar la traza de un tema real descubrí que **la primera evidencia de cada grupo quedaba marcada `REVIEW_REQUIRED` para siempre** —«no hay con qué comparar»— aunque el grupo fuera sólido: 36 temas, 36 piezas marcadas sin motivo, y sus pares contados como divisiones falsas.

Corregido —la semilla hereda su confianza al cerrarse el grupo—, el recall a 0,18 pasó de **0,368 a 0,772** y la tasa de clasificación de 0,506 a 0,653. **La decisión de umbral cambió porque el bug la había distorsionado.** Se detectó leyendo la salida, no con una prueba.

---

## 8. Falsos merges y falsos splits en la configuración elegida

**2 falsos merges:**
1. `volcamiento vía Cuenca-Molleturo` + `alumbrado público vía Cuenca-Molleturo` — misma vía, asuntos distintos.
2. `aniversario de la CCE` + `agenda de conciertos de la CCE` — misma institución, eventos distintos.

Los dos son de la clase **«misma entidad o mismo lugar, otro evento»**, la más difícil, y son exactamente dos de las cuatro trampas que diseñé: la métrica es significativa porque las trampas funcionan.

**13 falsos splits**, concentrados en el grupo del intercambiador y en el operativo policial: piezas del mismo hecho con vocabulario muy distinto («puente elevado» / «paso a desnivel» / «intercambiador Monay-IESS»).

**Limitación estructural declarada:** un cluster basado en entidad puede fundir eventos no relacionados del mismo emisor. Es el caso 2, está medido y no se disimuló.

---

## 9. Resultados reales

### PRIMARY (`CORROBORADO` ∩ temporal)

| | |
|---|---|
| corpus | **239** |
| temas | **37** |
| clasificadas | 104 |
| requieren revisión | 26 |
| sin clasificar | **109** |
| tasa de clasificación | **0,435** |
| grupo mayor | **11 (4,6 %)** |

### EXPANDED (`+ PROBABLE`)

| | |
|---|---|
| corpus | **253** |
| temas | **39** |
| clasificadas | 112 |
| sin clasificar | 113 |
| tasa | 0,443 |
| grupo mayor | 11 (4,3 %) |

**35 de 37 `topicId` son estables entre PRIMARY y EXPANDED**, 2 solo en PRIMARY y 4 nuevos o cambiados en EXPANDED. Añadir las 14 piezas `PROBABLE` no reordena el universo temático: lo amplía en los márgenes. **Los dos universos no se mezclan.**

### Temas principales — solo para inspección

| # | Tema | n | fuentes | actores | rssShare | naturaleza | 7D |
|---|---|---|---|---|---|---|---|
| 1 | **cuenca azogues · intercambiador monay** | 11 | **9** | **9** | 0,18 | CONV 5 · OTHER 4 · MEDIA 2 | **11** |
| 2 | casa de la cultura | 10 | **1** | 1 | **1,00** | INSTITUTIONAL 10 | 2 |
| 3 | farmasol · arrendamiento | 10 | **1** | 1 | **1,00** | INSTITUTIONAL 10 | 0 |
| 4 | azuay ecuador · competencia radio | 9 | 5 | 5 | 0,00 | OTHER 9 | 0 |
| 5 | emov · rendición de cuentas | 7 | 5 | 5 | 0,86 | INST 5 · OTHER 1 · MEDIA 1 | 1 |
| 6 | concesiones mineras · defensa del agua | 5 | 5 | 5 | 0,00 | **CONV 5** | 5 |

**El tema 1 es el que justifica el gate:** 11 piezas de 9 fuentes distintas y 3 plataformas —X, YouTube y RSS— hablando del mismo hecho con palabras diferentes, agrupadas sin intervención humana.

**Los temas 2 y 3 son honestos y poco informativos:** 10 piezas cada uno pero **1 sola fuente y `rssShare` 1,00**. Son feeds institucionales — el 3 son literalmente invitaciones a proveedores para arrendamientos. El módulo lo declara en `limitations`: *«Dominado por RSS (100 %): refleja agenda mediática antes que conversación pública»*. Un tema con 10 piezas de una fuente **no equivale** a uno con 10 piezas de 10 fuentes, y por eso `uniqueSources` y `sourceDiversity` viajan siempre al lado de `evidenceCount`.

**El tema 4 es una limitación real:** contenido de radios en YouTube, territorialmente válido por «Azuay» pero de Paute, y con `7D=0` y `30D=0` — material antiguo. Territorialmente correcto, cívicamente irrelevante.

### Composición y sesgo

Naturaleza en las evidencias tematizadas: `PUBLIC_CONVERSATION` 38 · `INSTITUTIONAL` 35 · `OTHER` 31 · `MEDIA` 24 · `SEARCH_RESULT` 2.

**RSS en evidencias tematizadas: 59/130 = 45,4 %**, frente al **60,3 %** del corpus completo. La agrupación surface proporcionalmente más conversación social que el corpus bruto, porque los temas multi-fuente tienden a ser sucesos y no boletines.

Local/nacional del corpus base: local corroborada 23,4 % · local probable 1,6 % · nacional 34,2 % · otra 40,7 %.

Ventanas: solo con `publishedAt` elegible. Las 14 piezas sin fecha no entran en ninguna, ni siquiera siendo territorialmente corroboradas.

---

## 10. Identidad del tema y etiqueta

**`topicId` no depende del ranking.** Si dependiera, el tema 3 de hoy sería el 5 de mañana y no se podría seguir nada en el tiempo. Se deriva de un hash SHA-1 de los 6 términos canónicos ordenados del grupo.

**Y no depende del corpus.** La primera versión pesaba los términos por su rareza IDF en el corpus, lo que hacía que el `topicId` **cambiara al añadir otro tema a la entrada**: cambiaba el IDF, el orden de términos, la firma y el hash. Lo detectó la prueba N. Ahora la firma se calcula solo con lo que hay dentro del grupo —en cuántas de sus piezas aparece cada término, con las entidades pesando doble—, así que es independiente del vecindario.

**La etiqueta se deriva de la evidencia**, sin LLM: entidades dominantes, luego frases distintivas, luego términos sueltos. `«ETAPA · agua potable»`, no `«Problemas importantes de la ciudad»`.

Metadatos para futuro sin perder historia: `mergedFrom`, `splitFrom`, `relatedTopicIds`, `parentTopicId`.

---

## 11. Confianza y sin clasificar

`HIGH` / `MEDIUM` / `LOW` derivadas de la similitud frente al umbral. **No se inventa precisión probabilística.**

`LOW` no se fuerza: la asignación queda `REVIEW_REQUIRED`. Un grupo de una sola pieza no es un tema — es una pieza sin compañía — y queda `UNCLASSIFIED` en lugar de inflar el recuento de temas con singletons.

**109 sin clasificar de 239 (45,6 %) y no se persigue el 100 %.** Es la composición real de una ventana de noticias locales: muchas piezas son sucesos únicos sin cobertura repetida.

---

## 12. Persistencia

`data/territorial-topics/AAAA/AAAA-MM.jsonl`, append-only.

Se persisten **definiciones de tema, asignaciones e instantáneas**. **No se copia el cuerpo de ninguna evidencia** — verificado: buscar «PUENTE ELEVADO» en el almacén de temas devuelve `false`. Duplicarlo crearía dos verdades que se desincronizan.

Persistido: PRIMARY 37 definiciones + 239 asignaciones · EXPANDED 39 + 253. Releído tras persistir: 37 temas, 239 asignaciones.

Append-only porque un tema puede fundirse, partirse o crecer entre pasadas. Si cada cálculo sobrescribiera el anterior, no habría forma de responder «¿cómo se veía este tema la semana pasada?», que es justo lo que necesitará Trend Radar.

### Trazabilidad

```
tema t:0799d256a9e9 (cuenca azogues · intercambiador monay)
  → asignación: CLASSIFIED, confidence HIGH
  → evidenceId ev-035caf37d6c3d065ff16e68a
  → x_api / x:… → canonicalUrl → publishedAt
  → cuerpo original en territorial/evidenceLedger.js
```

## 13. Aislamiento de proyecto

Proyecto A: corpus 239, **37 temas**. Proyecto B (fixture): corpus 0, **0 temas**.

Tres capas: `persistirTemas` **lanza excepción si falta `projectId`** — sin él los temas de una campaña aparecerían en otra; la lectura filtra por proyecto; y la **prueba de mutación** demuestra que quitar el filtro hace visibles las evidencias de ambos proyectos, es decir que el filtro es lo que aísla.

---

## 14. Pruebas

`territorial-topics`: **33 pruebas, 0 fallos**, cubriendo A–Z. Cero red.

Los textos de los casos son evidencias reales del corpus, recortadas.

**Dos defectos propios que las pruebas atraparon antes de que llegaran al informe:**

1. **J** — la entrada no deduplicaba por `evidenceId`: tres documentos únicos y un tema que decía tener cinco. `evidenceId` es la clave canónica del proyecto y aquí faltaba.
2. **N** — `topicId` cambiaba al añadir otro tema, porque su firma dependía del IDF del corpus.

**Y uno que atrapó la inspección de la salida**, no una prueba: la semilla de cada grupo quedaba `REVIEW_REQUIRED` para siempre. Cambió el umbral elegido.

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
| `territorial-topics` | **33** |
| `territorial-local-source` | 31 |
| `territorial-listening` | 31 |
| `territorial-project` | 29 |
| `territorial-expansion` | 29 |
| `territorial-media-discovery` | 24 |
| **Total territorial** | **921 · 0 fallos** |

Candidate: `socialProviders` 36, `xReal` 37, `candidateIntelligence` 100 — verdes.
Media: `mediaPiece` 42, `mediaHome` 41, `mediaSourceUniverse` 33 — verdes.

`npm run build` correcto. `npm run lint`: 6 errores **preexistentes y ajenos** en `Dashboard.jsx` y `KnowledgeGraph.jsx`, sin tocar.

---

## 15. Contrato de salida

Por tema: `topicId` · `topicLabel` · `parentTopicId` · `keywords[]` · `entities[]` · `evidenceCount` · `evidenceIds[]` · `uniqueSources` · `uniqueActors` · `providers[]` · `sourceFamilies[]` · `contentNatureBreakdown` · `territorialStratumBreakdown` · `rssEvidenceCount` · `rssShare` · `sourceDiversity` · `actorDiversity` · `providerDiversity` · `publishedAtRange` · `firstObservedAt` · `lastObservedAt` · `windowCounts` · `methodVersion` · `mergedFrom` · `splitFrom` · `relatedTopicIds` · `limitations[]`.

Por asignación: `evidenceId` · `topicId` · `estado` (`CLASSIFIED` / `REVIEW_REQUIRED` / `UNCLASSIFIED`) · `confidence` · `reasons[]` · `methodVersion`.

`uniqueActors` se llama **actores**, nunca personas — hay prueba.

---

## 16. Limitaciones que viajan con el dato

Cada tema lleva sus `limitations` embebidas:

> «Un tema es una agrupación de evidencias textualmente relacionadas. NO es una tendencia, ni viralidad, ni opinión pública, ni preocupación ciudadana.»
>
> «Los temas representan patrones en la conversación pública observable dentro de las fuentes cubiertas por Sentinel. **No representan a toda la población de Cuenca.**»

Y las del corpus, heredadas y verificables desde los datos: **RSS 60,3 %** del corpus base · `LOCAL_ORGANIZATION_UNIVERSE = INSUFFICIENT` (0 entidades) · `LOCAL_COMMUNITY_UNIVERSE = INSUFFICIENT` (0 entidades) · 45,6 % del corpus PRIMARY sin clasificar · 2 falsos merges conocidos de la clase «misma entidad, otro evento».

---

## 17. Veredictos

| | |
|---|---|
| `TOPIC_NORMALIZATION_INPUT_INTEGRITY` | **APPROVED** |
| `TOPIC_CLUSTER_QUALITY` | **APPROVED** |
| `TOPIC_TRACEABILITY` | **APPROVED** |
| `TOPIC_PROJECT_ISOLATION` | **APPROVED** |
| `TOPIC_NORMALIZATION_READINESS` | **READY_WITH_LIMITATIONS** |

`INPUT_INTEGRITY` aprobado: PRIMARY y EXPANDED separados y medidos, los cuatro estados excluidos verificados uno a uno, `publishedAt` nunca inventado, `queryLabel` fuera del contenido con prueba, dedup por `evidenceId`.

`CLUSTER_QUALITY` aprobado con los números delante: **ningún mega-cluster** en 18 configuraciones probadas (mayor 4,2–6,3 %), variantes del mismo asunto agrupadas —11 piezas de 9 fuentes y 3 plataformas—, asuntos que comparten palabra clave **no** fusionados —obras de agua vs caudales de ríos—, P=0,957 y R=0,772 sobre un gold set de 44 piezas con trampas, y 2 falsos merges declarados por nombre.

`READY_WITH_LIMITATIONS` y no `READY` porque el 45,6 % de PRIMARY queda sin clasificar, los dos temas más grandes son feeds institucionales de una sola fuente, y el corpus mantiene su sesgo mediático con cero organizaciones y cero comunidad.

---

## 18. Siguiente recomendación

**`TERRITORIAL-TREND-RADAR-01`**, sobre los 37 temas de PRIMARY persistidos, con tres condiciones que salen de lo medido aquí:

1. **La ventana temporal es el eje, no `evidenceCount`.** El tema 1 tiene `7D=11` y el tema 3 `7D=0` con las mismas 10-11 piezas: uno está pasando ahora y el otro es histórico administrativo. Ordenar por volumen los iguala.
2. **`uniqueSources` debe ponderar.** Un tema de 10 piezas y 1 fuente no es comparable con uno de 11 piezas y 9 fuentes, y el corpus tiene ejemplos de los dos.
3. **Se necesitan al menos dos pasadas** para hablar de tendencia. Hoy hay una sola instantánea persistida: sin un segundo punto no hay momentum, solo una foto.

**STOP.** No se inicia Trend Radar. No se abre Candidate × Topic, ni integración con Media, ni Sentinel AI, ni nuevo discovery, ni ningún proveedor. Se espera revisión humana.
