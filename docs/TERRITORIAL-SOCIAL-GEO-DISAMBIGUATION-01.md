# TERRITORIAL-SOCIAL-GEO-DISAMBIGUATION-01

**Desambiguación territorial de «Cuenca» en contenido social público**

Terminal 2 · Territorial Intelligence
Proyecto: `alcaldia-cuenca-2027-piloto`
Ejecutado: 2026-09-03

---

## 1. Commit base

`976bb55` — *feat(territorial): benchmark social listening connectors*.

Ese gate midió el problema. Este lo resuelve metodológicamente, o dice con precisión qué parte no resuelve.

---

## 2. El problema, localizado exactamente

El benchmark reportó que 25 atribuciones descansaban solo en la palabra «Cuenca». No dijo **por qué**. Este gate lo encontró.

El catálogo territorial ya declaraba lo correcto:

```
Cuenca
  ambiguo: true
  ambiguedad: "ambas"
  requiereContexto: ["azuay", "ecuador"]
  notaAmbiguedad: "Homónimo mayor: Cuenca (España), y además
                   'cuenca' es sustantivo común"
```

Y `geoResolver` **ya tenía una puerta** que respeta eso: un topónimo ambiguo no se resuelve sin contexto de respaldo. La puerta se saltaba por una de sus cuatro llaves:

```js
const respaldada =
  Boolean(contexto.formaInequivoca) ||
  contexto.terminos.length > 0 ||
  contexto.respaldadaPorFuente ||
  contexto.esElAmbito;          // <-- esta
```

`esElAmbito` significa «el topónimo **es** el ámbito que declaró el analista». Como el ámbito del piloto es `ec-azuay-cuenca`, cualquier texto que dijera «cuenca» satisfacía la puerta.

**Eso es circular: el proyecto ser de Cuenca se usaba como prueba de que el texto habla de Cuenca.** El propio comentario del resolutor advierte que pertenecer al ámbito del proyecto no es respaldo válido —y `dentroDelAmbito` está correctamente excluido— pero `esElAmbito` es la misma suposición con otro nombre.

No era un umbral mal calibrado. Era una puerta con una llave de más.

## 2-bis. Por qué NO se arregló en `geoResolver`

Porque ahí la llave hace falta, y porque el archivo no es mío.

Con prensa local, «el tranvía suma dos unidades» sin repetir «Azuay» es correctamente local, y esas piezas son la cobertura más útil del corpus. Quitar la llave en la infraestructura compartida cambiaría 13 falsos positivos medidos por un número mucho mayor de falsos negativos — exactamente lo que §3 del gate prohíbe. Además `geoResolver` lo consumen Candidate (T1) y Media (T3), que están trabajando ahora mismo.

Así que el resolutor sigue resolviendo y una capa nueva decide si lo resuelto es **apto para afirmar territorio**. La resolución se conserva entera.

**Recomendación para un gate futuro de infraestructura compartida:** revisar `esElAmbito` como llave de respaldo para unidades con `ambiguedad: "ambas"`. Requiere coordinación con T1 y T3 y su propia medición. No se hace aquí.

---

## 3. Universo social auditado

Del ledger real, con alcance de proyecto:

| | |
|---|---|
| Corpus del proyecto | **421** evidencias |
| web / RSS | 353 |
| social | **68** |
| — X | 47 |
| — YouTube | 21 |
| Emisores sociales distintos | 44 |

Nota de reconciliación: leyendo el JSONL en crudo salen 75 evidencias sociales; 7 son legado sin `projectId` y quedan fuera del proyecto por diseño. Las cifras de este informe son las de **68**, con alcance de proyecto. Es la misma cifra que reportó el benchmark.

---

## 4. Ambiguas iniciales

Sobre las 68, el resolutor ubicó 55 y **26 descansaban únicamente en `esElAmbito`**, sin ningún contexto exigido presente. Se identifican de forma auditable, no por estimación: leyendo las `razones` que el propio resolutor emite.

Firma de razón del grupo defectuoso:

```
toponimo "Cuenca" presente en el texto (+40)
el toponimo es el ambito declarado por el analista (+12)
la unidad pertenece al ambito declarado por el analista (+20)
```

Sin `contexto exigido presente: azuay`. Ese es el defecto, visible en los datos.

---

## 5. Gold set

26 evidencias reales del benchmark, etiquetadas a mano leyendo el texto de cada pieza. **La etiqueta no se deduce del nombre de la cuenta** (§8): `@sinfonicaLoja` no es «no local» por llamarse Loja, sino porque el concierto es en el Teatro Benjamín Carrión.

**Locales (13 en el conjunto de 28 revisado; 11 dentro del proyecto):** operativo antidroga con `#Cuenca`, barrio Retamas Altas, Unsión TV sobre la Policía en centros educativos, Quinto Río, feria El Arenal, tres concejales de Cuenca, EMOV EP y los radares, Milchichig, exalcalde Pedro Palacios, videovigilancia en el retorno a las aulas, Hospital José Carrasco Arteaga, defensa hídrica con bandera de Ecuador, Centrosur.

**No locales (13):** Nuevo León (México), Lambayeque (Perú), cuenca Amazónica, Sistema Cuenca Sur (Cuba), barrio Cuenca XV ×2 (Neuquén), la cuenta que **explica que «cuenca» es un término geográfico**, Pucón (Chile), Santa Lucía (Uruguay), abasto de agua de La Habana ×2, CortesCLM (España), Jujuy (Argentina).

**Inciertas (2), apartadas del cálculo:** `Diario Quisqueya` (contenido dice Cuenca, origen no verificable con la evidencia disponible) y `sinfonicaLoja`.

**El gold set es pequeño: 26 piezas.** No se extrapola a Internet ni a la conversación de Cuenca. Mide esta corrección sobre este corpus.

Corrección al informe anterior: el benchmark estimó «9–11 claramente foráneas». Contadas una por una son **13**. Mi estimación era baja.

---

## 6. Metodología

Resolución multiseñal en `socialGeoDisambiguation.js`. Dos pasadas sobre el lote, y el orden importa:

1. **Primera pasada:** clasifica solo por señales de **contenido**.
2. **Segunda pasada:** con los emisores que quedaron corroborados por contenido, reclasifica.

Así el vínculo territorial de un emisor descansa siempre en piezas corroboradas por contenido, nunca en otras piezas que también descansaban en el emisor. **Un emisor no puede corroborarse a sí mismo** — hay una prueba que lo fija.

`queryProvenance` viaja en un campo aparte y no entra en ninguna lista de señales.

---

## 7. Señales positivas

| Señal | Qué comprueba |
|---|---|
| `CONTEXTO_PAIS_O_PROVINCIA` | Azuay, Ecuador, 🇪🇨 en el texto. Es el contexto que el catálogo exige. |
| `TOPONIMO_LOCAL_NO_AMBIGUO` | Parroquia o sector del cantón **tomado del registro territorial**, excluyendo las que el registro marca ambiguas (Sucre, Santa Ana, Baños no discriminan). |
| `INSTITUCION_LOCAL` | GAD, EMOV, EMAC, ETAPA EP, EMUVI, Farmasol, Universidad de Cuenca, Municipio/Alcaldía de Cuenca, Prefectura del Azuay, tranvía. Salen del universo de fuentes comprobado, no de una lista inventada. |
| `DOMINIO_LOCAL_EN_UNIVERSO` | El enlace canónico apunta a un dominio con territorio declarado. |
| `METADATO_DEL_EMISOR` | Nombre público del canal o medio que dice Ecuador/Azuay explícitamente. Metadato público, no inferencia sobre una persona. |
| `EMISOR_LOCAL_CORROBORADO` | El emisor tiene otras piezas corroboradas por contenido. |

Las tres primeras son **de contenido** y son las únicas que corroboran por sí solas. Las tres últimas son **del emisor** y como máximo producen `TERRITORIO_PROBABLE`.

Por qué «Municipio» y «Alcaldía» discriminan: España usa «Ayuntamiento». Por qué EMOV/EMAC/ETAPA/GAD discriminan: son figuras ecuatorianas y no existen en la Cuenca de España.

---

## 8. Señales negativas

| Señal | Qué comprueba |
|---|---|
| `LUGAR_INCOMPATIBLE` | Otro lugar real nombrado literalmente: España, Castilla-La Mancha, Ceuta, Perú, Lambayeque, Chile, Pucón, Cuba, La Habana, Uruguay, México, Nuevo León, Argentina, Jujuy, Neuquén, banderas. |
| `USO_NO_GEOGRAFICO` | «cuenca» como sustantivo común: cuenca hidrográfica, minera, lacustre, amazónica, del río, Cuenca Sur, organismo de cuenca, «"cuenca" es un término». |

**La lista de lugares no es la metodología** (§5). Se pobló con lo que apareció de verdad en el corpus, no con un atlas, y solo cuenta como evidencia de conflicto cuando el texto la trae literalmente.

Y el límite que el gate fija expresamente: **el uso hidrográfico no descarta contenido ambiental local.** «El plan de manejo de la cuenca del río Tomebamba, en Cuenca, Azuay» es de Cuenca. Con anclaje local sólido se corrobora y la coocurrencia queda declarada en las señales. El conflicto se declara cuando hay anclaje local **y otro lugar real compitiendo** en el mismo texto — no por la mera presencia de la palabra.

---

## 9. BEFORE — TP/FP/TN/FN

Sobre el gold set (26 etiquetadas; 2 inciertas apartadas):

| | |
|---|---|
| TP | **11** |
| FP | **13** |
| TN | 0 |
| FN | 0 |

El sistema atribuía a Cuenca **todo** lo que llegaba. Cero falsos negativos porque no rechazaba nada, y 13 falsos positivos: más de la mitad de lo que afirmaba era de otro país o hablaba de una cuenca hidrográfica.

## 10. AFTER — TP/FP/TN/FN

Dos lecturas, porque la decisión sobre `PROBABLE` es del humano (§11):

**Estricto — solo `CORROBORADO` alimenta métricas** (lo implementado):

| | |
|---|---|
| TP | 3 |
| FP | **0** |
| TN | **13** |
| FN | **8** |

**Con `PROBABLE` admitido** (medido, no implementado):

| | |
|---|---|
| TP | 8 |
| FP | **0** |
| TN | **13** |
| FN | 3 |

**Lectura honesta.** Los 13 falsos positivos desaparecen en ambas variantes, y ninguna introduce uno nuevo. El coste está en el recall: en la variante estricta 8 piezas locales legítimas dejan de contar.

**Esas 8 no se destruyen.** 5 quedan como `TERRITORIO_PROBABLE` —visibles, auditables, con sus señales— y 3 como `TERRITORIO_AMBIGUO`. Ninguna sale del ledger ni del corpus observado. La diferencia entre las dos variantes es exactamente eso: si `PROBABLE` suma o no en un agregado.

**Dónde está el recall real: en `PROBABLE`.** Es la cifra que el humano debe decidir.

---

## 11-16. Reclasificación de las que solo se apoyaban en «Cuenca»

De las **26**:

| Estado | N |
|---|---|
| `TERRITORIO_CORROBORADO` | **4** |
| `TERRITORIO_PROBABLE` | **5** |
| `TERRITORIO_AMBIGUO` | **4** |
| `TERRITORIO_CONFLICTIVO` | **0** |
| `FUERA_TERRITORIO` | **13** |
| `TERRITORIO_NO_RESOLUBLE` | 0 |
| **Suma** | **26** ✓ |

La suma cuadra exactamente con el universo revisado.

Sobre las 68 sociales completas:

| Estado | N |
|---|---|
| `TERRITORIO_CORROBORADO` | 33 |
| `TERRITORIO_PROBABLE` | 5 |
| `TERRITORIO_AMBIGUO` | 4 |
| `TERRITORIO_CONFLICTIVO` | 0 |
| `FUERA_TERRITORIO` | 13 |
| `TERRITORIO_NO_RESOLUBLE` | 13 |
| **Suma** | **68** ✓ |

`TERRITORIO_CONFLICTIVO = 0` en datos reales. El estado existe, funciona y está probado, pero **con este corpus no se activó ninguna vez**: se declara para no presentarlo como validado en producción.

---

## 17-18. Corpus observado vs corpus territorialmente elegible

| | |
|---|---|
| **Corpus observado** (social) | **68** |
| **Corpus territorialmente elegible** | **33** |

Son dos conceptos y hay que poder decir los dos. Una pieza de Lambayeque traída por la búsqueda «Cuenca» es evidencia **real** de recolección: dice que la consulta trae ruido y cuánto. Se conserva y se reporta. Lo que no puede hacer es convertirse en conversación de Cuenca.

`ELIGIBLE_FOR_TERRITORIAL_METRICS = true` solo para `TERRITORIO_CORROBORADO`.
`false` para `PROBABLE`, `AMBIGUO`, `CONFLICTIVO`, `FUERA_TERRITORIO` y `NO_RESOLUBLE`.

`PROBABLE` queda fuera a propósito: su territorio descansa en el emisor, no en la pieza. Contarlo sería volver a la circularidad por otra puerta. Es la decisión que §11 deja al humano.

**La compuerta es efectiva, no decorativa.** `topicTerritoryCrosstab.construirMatriz` acepta `aptitudTerritorial`, un predicado opcional: una evidencia no apta pasa a `TERRITORIO_NO_RESUELTO` con motivo declarado y **sigue contando en el corpus observado**. Es opcional y no obligatoria porque encenderla por defecto cambiaría en silencio el resultado de Candidate y Media, que consumen la misma matriz.

## 19-20. Elegible por plataforma

| Plataforma | Observadas | Elegibles |
|---|---|---|
| X | 47 | **21** |
| YouTube | 21 | **12** |

---

## 21-22. Actores

| | |
|---|---|
| Emisores sociales distintos | 44 |
| Con vínculo territorial corroborado | **23** |
| Sin corroborar | **21** |

Los 23 se derivan **solo** de piezas corroboradas por contenido. Ninguno se promueve a `VERIFICADO_POR_ANALISTA`: eso lo firma una persona.

**Defecto residual medido, declarado y no ocultado.** `sinfonicaLoja` queda entre los 23 porque su texto menciona la Universidad de Cuenca, cuando el concierto es en Loja. **Mencionar una institución de Cuenca no es que el hecho ocurra en Cuenca**, y mi señal `INSTITUCION_LOCAL` no distingue esos dos casos. Es 1 de 26 en el gold set. No lo corrijo con una regla nueva sin medirla: inferir el lugar por el nombre de la cuenta es exactamente lo que §8 prohíbe.

---

## 23. Privacidad

Fuera de alcance y no ejecutado: vigilancia de individuos, dossiers, dispositivos, perfiles privados, atributos sensibles, microsegmentación política.

**A una persona no se le infiere residencia por publicar sobre Cuenca.** Hay una prueba que recorre la salida buscando `residen|domicili|vive en|coordenad|latitud|longitud` y exige que no aparezca nada. `Hola soy mauri` hablando de El Arenal no sitúa ni la pieza ni a la persona.

El vínculo territorial se establece sobre **emisores institucionales y medios**, y siempre por evidencia de contenido, nunca por el nombre de la cuenta.

## 24. Aislamiento de proyecto

Probado en dos niveles. En el módulo: reclasificar el proyecto A no altera el resultado del proyecto B, y un emisor corroborado en A no se filtra a B — la clasificación es función pura del lote. Y por HTTP contra el ledger real: `proyectoId: "proyecto-que-no-existe"` devuelve **0** evidencias observadas.

## 25-26. Peticiones externas y créditos

| | |
|---|---|
| Peticiones a X | **0** |
| Peticiones a YouTube | **0** |
| Créditos ScrapeCreators | **0** |
| Proveedores nuevos | ninguno |
| Coste | **$0** |

Todo se hizo sobre las evidencias ya persistidas, como pide §13. El endpoint declara `peticionesExternas: 0` y la batería corre con el `fetch` global contado.

## 27. Pruebas

Suite nueva `territorial-geo-disambiguation` con los 24 puntos A–X del gate: **36 pruebas, 0 fallos**. Los textos de los casos son las evidencias reales del benchmark, recortadas, y la ubicación se calcula con `geoResolver` de verdad: si el resolutor cambia, estas pruebas lo notan.

Batería territorial completa:

| Suite | Pruebas |
|---|---|
| `territorial` | 160 |
| `territorial-c2` | 53 |
| `territorial-d` | 39 |
| `territorial-d2` | 92 |
| `territorial-fresh` | 50 |
| `territorial-sources` | 61 |
| `territorial-rotation` | 42 |
| `territorial-topic` | 49 |
| `territorial-project` | 29 |
| `territorial-coverage` | 45 |
| `territorial-expansion` | 29 |
| `territorial-listening` | 31 |
| `territorial-social` | 36 |
| `territorial-geo-disambiguation` | **36** |
| **Total territorial** | **752 · 0 fallos** |
| `socialProviders` (Candidate) | 35 · intacta |
| `mediaPiece` / `mediaTime` / `mediaHome` (Media) | intactas |

Dos fallos propios detectados y corregidos durante el gate, ambos por las pruebas:

1. **Mi expectativa estaba mal, no el código.** Esperaba que «la cuenca del río Tomebamba en Cuenca, Azuay» diera `CONFLICTIVO`. Es contenido ambiental **de Cuenca**: el gate advierte expresamente de no tratarlo como foráneo. Se corrigió el criterio de conflicto —anclaje local **más otro lugar real**, no la mera palabra— y se corrigió la prueba.
2. **El endpoint compilaba y habría explotado al llamarlo.** `resolverUbicacion` no estaba importado y `reconstruirEstado` devuelve un `Map`, no un objeto; el filtro leía `providerId` cuando el campo es `providers` (array). Los tres errores se encontraron probando el endpoint por HTTP real contra el ledger, no importando el módulo. Un `import` que compila no prueba que la ruta funcione.

## 28. Build y lint

`npm run build`: correcto. `npm run lint`: **6 errores, todos preexistentes y ajenos** — `Dashboard.jsx` (5) y `KnowledgeGraph.jsx` (1). Ningún archivo de este gate añade errores.

---

## 29-30. Veredictos

### `SOCIAL_GEO_RESOLUTION = OPERATIVO_CON_LIMITACIONES`

Los 13 falsos positivos conocidos quedan excluidos, no se introduce ninguno nuevo, las fuentes locales conocidas no se destruyen —Unsión TV, WRadioEc, Bomberos, CNE Azuay, ECU911 conservan clasificación—, la consulta nunca cuenta como prueba y la ambigüedad es explícita.

Limitaciones que lo dejan fuera de OPERATIVO: gold set de 26 piezas, `CONFLICTIVO` sin activarse nunca en datos reales, el defecto residual de `sinfonicaLoja`, y una pérdida de recall real que en la variante estricta deja 8 piezas locales fuera de los agregados.

### `TERRITORIAL_METRICS_READINESS = OPERATIVO_CON_LIMITACIONES`

La compuerta existe, es efectiva y está probada: sin ella la matriz atribuye 3 de 3 al cantón; con ella, 1 de 3, y las otras dos siguen contando como observadas. Ya se puede publicar una métrica territorial de origen social diciendo sobre qué descansa: **33 de 68**, no 55.

La limitación es de composición, no de mecanismo: solo la mitad del corpus social sostiene territorio, y eso hay que decirlo junto a cada cifra.

---

## 31. Huecos

1. **`esElAmbito` sigue siendo llave de respaldo en `geoResolver`.** Corregido en mi capa, intacto en la infraestructura compartida. Cualquier otro consumidor que resuelva con `ambitoId = ec-azuay-cuenca` hereda el defecto. Necesita un gate coordinado con T1 y T3.
2. **Las 47 evidencias de X se persistieron con `queryLabel: null`.** Solo las 21 de YouTube traen procedencia de consulta. No afecta al territorio —la consulta nunca cuenta como prueba— pero impide auditar qué consulta trajo cada pieza de X. La causa está en el mapeo de `xAdapter`, compartido con Candidate; no se toca aquí.
3. **`TERRITORIO_CONFLICTIVO` no se ha activado con datos reales.** Probado sintéticamente, sin validar en producción.
4. **`INSTITUCION_LOCAL` no distingue «ocurre en Cuenca» de «menciona algo de Cuenca».** Medido: 1 caso de 26.
5. **Gold set de 26 piezas.** Suficiente para medir esta corrección; insuficiente para afirmar tasas generales.
6. **Recall en la variante estricta.** 8 piezas locales legítimas fuera de los agregados. El remedio candidato —admitir `PROBABLE`— está medido (TP 8, FP 0, FN 3) y espera decisión humana.

## 32. Siguiente decisión

Tres, en este orden:

1. **¿Entra `PROBABLE` en métricas territoriales?** Medido en ambas variantes. Mi recomendación: admitirlo con etiqueta visible «territorio del emisor, no de la pieza», porque ahí está el recall local y no introduce ningún falso positivo en el gold set.
2. **¿Se abre un gate para `esElAmbito` en la infraestructura compartida?** Requiere T1 y T3.
3. **¿Se corrige la procedencia de consulta en X?** Toca `xAdapter`, compartido con Candidate.

**STOP.** No se inicia Topic Normalization, ni Trend Radar, ni Sentinel AI, ni UX Consolidation. No se contrata ni se evalúa ningún proveedor nuevo. Se espera decisión humana.
