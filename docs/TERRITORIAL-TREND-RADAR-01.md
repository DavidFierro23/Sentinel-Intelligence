# TERRITORIAL-TREND-RADAR-01

**Primer Trend Radar explicable — Cuenca 2027**

Terminal 2 · Territorial Intelligence
Base: `b9068fb` — TERRITORIAL-OPEN-SOCIAL-COVERAGE-04
Ejecutado: 2026-09-05 · `trend-radar-1.0.0`

---

## Lo que este radar no dice

No dice «viral». No dice «todo Cuenca habla de». No dice «la ciudadanía piensa». No dice «tema dominante en Cuenca». No dice intención de voto ni representatividad.

Dice, y solo dice: **«mayor actividad observable en las fuentes cubiertas»**, **«crecimiento observable entre dos observaciones»**, **«mayor diversidad de fuentes observadas»**.

**Peticiones externas: 0. Créditos: 0. Coste: $0.** Todo se calculó sobre el almacén de temas y el ledger persistidos, con el `fetch` global contado.

---

## 1. Observaciones disponibles

El almacén tenía **4 escrituras** y solo **2 son observaciones distintas**:

| # | Observación | Corpus | Temas | Umbral | Firma |
|---|---|---|---|---|---|
| 1 | `2026-09-05T14:30:01.234Z` | 239 | 37 | 0,18 | `e98733042177` |
| 2 | `2026-09-05T23:34:00.901Z` | 282 | 41 | 0,18 | `1c36e29d887f` |

Las otras dos son **re-ejecuciones idénticas** del segundo cálculo, escritas mientras se corregían defectos en el gate anterior. Tienen `runId` distinto y contenido igual: **colapsarlas era obligatorio**, porque tratarlas como cuatro puntos temporales habría inventado historia. El módulo las identifica por una firma de `corpus + nº de temas + conjunto de topicId` y lo declara por escrito.

---

## 2. Modelo temporal

Ventanas: **HOY · 7D · 15D · 30D · 90D**, y **solo con `publishedAt`**. `firstObservedAt` no sustituye a `publishedAt`; una pieza sin fecha no entra en ninguna ventana y sigue existiendo en el corpus.

Actividad total por ventana en la observación actual:

| Ventana | Suma de evidencia fechada en temas | Temas con actividad |
|---|---|---|
| HOY | 5 | 4 / 41 |
| **7D** | **77** | **31 / 41** |
| 15D | 106 | 35 / 41 |
| 30D | 141 | 38 / 41 |
| 90D | 166 | 41 / 41 |

**La ventana es el eje, no `evidenceCount`.** El caso que lo demuestra en datos reales: `farmasol` tiene **10 evidencias y `7D` = 0** — es un archivo de invitaciones a proveedores; `intercambiador monay` tiene **12 evidencias y `7D` = 12**. Ordenar por volumen los igualaría.

---

## 3. Modelo de actividad

Por tema y ventana: `evidenceCount` en la ventana, `evidenceCountTotal`, y **`fraccionEnVentana`** — la proporción del tema que cae dentro, que es lo que distingue un asunto que está pasando de un histórico.

`missing != zero`: si un tema no tiene `windowCounts` calculables, `evidenceCount` es **`null`** y `calculable: false`. Nunca cero.

## 4. Modelo de cambio

Con dos observaciones solo existe la **primera derivada**, y los nombres lo dicen:

`RISING_OBSERVED` · `FALLING_OBSERVED` · `STABLE_OBSERVED` · `NEWLY_OBSERVED` · `NO_LONGER_OBSERVED` · `INSUFFICIENT_TEMPORAL_EVIDENCE` · `TEMPORAL_COMPARISON_NOT_VALID`.

**No existe ningún `TREND_STABLE` ni `MOMENTUM_CONFIRMED`** — hay una prueba que recorre el enum y falla si aparecen.

Por tema: `previousWindowValue`, `currentWindowValue`, `absoluteDelta`, `relativeDelta`, `sourceDelta`, `providerDelta`, `conversationDelta`.

**Base cero:** con `previousWindowValue = 0` **no se emite porcentaje**. Se devuelve `relativeDelta: null` y `relativeDeltaNoCalculable: "base cero: el porcentaje no se emite"`.

Cada item lleva: *«Variación basada en dos observaciones. Requiere más puntos para confirmar una tendencia.»*

## 5. Modelo de diversidad

`uniqueSources` · `uniqueActors` · `providerCount` · `platformCount` · `sourceFamilyCount` · `UNIQUE_SOURCE_DIVERSITY` · `PROVIDER_PLATFORM_DIVERSITY` · `rssShare` · `concentracionDeFuente`.

Y tres concentraciones **por separado**, porque describen problemas distintos: `singleSourceConcentration`, `singleProviderConcentration`, `singleFamilyConcentration`.

**El RSS no se penaliza por ser RSS.** Lo que se detecta es la concentración: un tema con 10 piezas de 8 fuentes vía RSS tiene `DIVERSITY_CONFIDENCE` media o alta; uno con 10 piezas de 1 fuente la tiene baja, venga del canal que venga.

**`ACTIVITY` y `DIVERSITY_CONFIDENCE` van separadas**: un tema puede estar muy activo y ser poco fiable.

## 6. Ajuste por cobertura — la distinción más importante

```
OBSERVED_CONTENT_CHANGE     cambio en lo que se publica
COLLECTION_COVERAGE_CHANGE  cambio en lo que sabemos mirar
```

Entre las dos observaciones se activaron **tres motores**: Google News, DuckDuckGo y el descubrimiento abierto de TikTok. Un tema que crece porque ahora observamos TikTok **no está creciendo en el territorio: está creciendo en nuestra instrumentación**.

Cada item lleva `coverageExpansionContributed` y `motoresQueContribuyeron`. **Resultado medido: los 4 temas en crecimiento están marcados `[COBERTURA]`, y los 7 temas nuevos son todos `COVERAGE_EXPANSION`.** Ninguno es `NEW_TOPIC_DEFINITION` puro.

Ese es el hallazgo honesto del radar: **con estas dos observaciones no se puede atribuir ningún crecimiento al territorio.** Todo el movimiento observable es, al menos en parte, expansión de cobertura.

## 7. Linaje

`topicId` se deriva de los términos canónicos: si un tema absorbe evidencia y su firma cambia, emite otro id. Eso **no** significa que el asunto sea nuevo.

Emparejamiento en tres vías, con resultado real:

| Vía | N |
|---|---|
| `TOPIC_ID` (exacta) | **27** |
| `LINAJE_POR_CONTENIDO` (Jaccard ≥ 0,3) | **7** |
| `SIN_PAREJA` | 3 |
| Comparaciones inválidas | **0** |
| Temas nuevos | **7** |

Y la salvaguarda: si dos candidatos quedan a menos de 0,1 de distancia —señal típica de un **split**— la comparación se marca **`TEMPORAL_COMPARISON_NOT_VALID`** en lugar de elegir uno de los trozos e inventar el cambio. En esta pasada no se activó (0 inválidas), pero hay prueba sintética que la ejercita.

---

## 8. ¿Índice compuesto? Sensibilidad sobre 5 escenarios

| Escenario | Pesos (act/fuentes/plat) | Primero | 2.º |
|---|---|---|---|
| solo_actividad | 1 / 0 / 0 | **monay** | festival cuy |
| actividad_dominante | 0,6 / 0,25 / 0,15 | **monay** | concesiones mineras |
| equilibrado | 0,34 / 0,33 / 0,33 | **monay** | alcaldía · prefectura |
| diversidad_dominante | 0,2 / 0,5 / 0,3 | **monay** | alcaldía · prefectura |
| solo_diversidad | 0 / 0,6 / 0,4 | **monay** | alcaldía · prefectura |

| | |
|---|---|
| Top-5 estable en | **4 de 5** |
| Estabilidad del top-5 | **0,80** |
| Primeros distintos | **1** |
| **Veredicto** | **`ROBUST`** |

Un índice compuesto **sería** defendible: el primero no cambia en ningún escenario y el top-5 se mantiene en 4 de 5.

**Y aun así el radar no publica un número del 0 al 100.** El orden del 2.º al 4.º sí se mueve según los pesos, y `rankings` separados responden mejor a la pregunta real: actividad, cambio y diversidad son preguntas distintas y un número único las esconde. La sensibilidad se documenta para que la decisión sea informada, no para justificar un score.

---

## 9. Resultados reales

### TOP 10 · OBSERVED ACTIVITY (7D)

| # | Tema | 7D | Fuentes | Plat. | Conv. | Confianza | Cambio |
|---|---|---|---|---|---|---|---|
| 1 | **intercambiador monay · monay iess** | **12** | **10** | **4** | 5 | HIGH | RISING_OBSERVED |
| 2 | festival cuy · comunidad tablon | 6 | 4 | 3 | 2 | HIGH | RISING_OBSERVED |
| 3 | concesiones mineras · defensa agua | 6 | 6 | 2 | 5 | HIGH | RISING_OBSERVED |
| 4 | alcaldía de cuenca · prefectura del azuay | 5 | 6 | 3 | 1 | HIGH | RISING_OBSERVED |
| 5 | incendios forestales · altas temperaturas | 4 | 5 | 2 | 1 | HIGH | STABLE_OBSERVED |
| 6 | marcelo gallardo · ecuador entrenador | 3 | 2 | 1 | 0 | **LOW** | STABLE_OBSERVED |
| 7 | emov · emov ep · contrato radares | 3 | 3 | 2 | 0 | HIGH | STABLE_OBSERVED |
| 8 | quinto rio · actividad minera | 3 | 2 | 1 | 3 | MEDIUM | STABLE_OBSERVED |
| 9 | etapa · área intervenida | 3 | **1** | 1 | 3 | **LOW** | STABLE_OBSERVED |
| 10 | el mercurio · año lectivo | 3 | 2 | 2 | 0 | HIGH | STABLE_OBSERVED |

**No se esconden los temas poco informativos.** El nº 6 es sobre el entrenador de la selección ecuatoriana: territorialmente válido por mención, cívicamente marginal, y su `LOW` lo dice. El nº 9 tiene 3 piezas de **una sola fuente**.

### TOP OBSERVED GROWTH

| Δ | Tema | Cobertura |
|---|---|---|
| **+3** (3→6) | festival cuy · comunidad tablon | **[COBERTURA]** scrapecreators_tiktok |
| **+2** (3→5) | alcaldía de cuenca · prefectura del azuay | **[COBERTURA]** google_news |
| +1 (11→12) | intercambiador monay · monay iess | **[COBERTURA]** scrapecreators_tiktok |
| +1 (5→6) | concesiones mineras · defensa agua | **[COBERTURA]** google_news |

**Los cuatro están marcados.** Ninguno es crecimiento territorial limpio.

### TOP OBSERVED DECLINE

| Δ | Tema |
|---|---|
| −1 (1→0) | dolares |
| −1 (1→0) | celebra años · comic ecuador |
| −1 (2→1) | alerto préstamos · azuay xavier |

Descensos de una unidad sobre bases de 1 o 2: **ruido, no señal**, y con dos puntos no se puede decir más.

### NEWLY OBSERVED (7)

| Origen | Motor | Tema |
|---|---|---|
| COVERAGE_EXPANSION | scrapecreators_tiktok | cuenca azuay · azuay turismo |
| COVERAGE_EXPANSION | google_news | etapa · etapa ep |
| COVERAGE_EXPANSION | scrapecreators_tiktok | cuenca ecuador · azuayecuador |
| COVERAGE_EXPANSION | google_news | cristian zamora · cristian · zamora |
| COVERAGE_EXPANSION | scrapecreators_tiktok | cuenca azuay |
| COVERAGE_EXPANSION | google_news | ximena rojas · fiscal · rojas |
| COVERAGE_EXPANSION | scrapecreators_tiktok | alcalde |

**7 de 7 por expansión de cobertura. Cero por definición nueva.** Ningún tema «emergió»: emergió nuestra capacidad de verlo.

### HIGHEST SOURCE DIVERSITY

| Fuentes / ev | Div. | Tema |
|---|---|---|
| **10 / 12** | 0,833 | intercambiador monay |
| 6 / 8 | 0,750 | alcaldía · prefectura |
| **6 / 6** | **1,000** | concesiones mineras · defensa agua |
| 5 / 7 | 0,714 | emov · rendición de cuentas |
| **5 / 5** | **1,000** | incendios forestales |

### LOWEST SOURCE DIVERSITY

| Fuentes / ev | Div. | rssShare | Perfil | Tema |
|---|---|---|---|---|
| **1 / 10** | **0,100** | **1,00** | INSTITUTIONAL_HEAVY | **farmasol · arrendamiento** |
| 3 / 12 | 0,250 | 0,917 | INSTITUTIONAL_HEAVY | casa de la cultura |
| 1 / 3 | 0,333 | 0 | CONVERSATION_LED | etapa · área intervenida |
| 1 / 3 | 0,333 | 1,00 | INSTITUTIONAL_HEAVY | etapa · agua potable |
| 1 / 2 | 0,500 | 0 | CONVERSATION_LED | pedro palacios · exalcalde |

**Marcados claramente:** `single-source feed`, `institutional-heavy`, `coverage-expanded`. Nada se esconde.

### COVERAGE EXPANDED (13 temas)

`scrapecreators_tiktok` en intercambiador monay, festival cuy, cuenca azuay · turismo, cuenca ecuador · azuayecuador. `google_news` en alcaldía · prefectura, concesiones mineras, prefectura · precandidatos, etapa · etapa ep.

---

## 10. Traza obligatoria · intercambiador Monay-IESS

**Leída del almacén, no escrita a mano.**

```
topicId         t:46405f94e7a0
label           intercambiador monay · monay iess
actividad 7D    12 de 12   (fracción en ventana: 1,00)
fuentes         10        actores: 10
plataformas     4 -> X, YouTube, Web/RSS, TikTok
proveedores     x_api, youtube_data, rss_directo, scrapecreators_tiktok
TikTok          incorporado: true
conversación    conv=5  media=2  inst=0   perfil=MIXED
territorial     corroborado 12/12  (100 %)
cambio          RISING_OBSERVED   11 -> 12   Δ=+1   rel=+0,091
                Δfuentes=+1  Δproveedores=+1  Δconversación=0
cobertura       contribuyó: true (scrapecreators_tiktok)
linaje          LINAJE_POR_CONTENIDO  sim=0,778  anterior=t:0799d256a9e9
confianza       HIGH
                a favor: 5+ fuentes; 2+ plataformas; 70%+ corroborado; evidencia fechada
                en contra: nada
evidenceRefs    12  (ev-035caf37d6c3d065ff16e68a, ev-20f44c53ee55afc9f0d074a6, ...)
```

**POR QUÉ** (generado, sin LLM):

> · 12 de sus 12 evidencias caen en la ventana 7D.
> · Sube porque pasó de 11 a 12 evidencias fechadas y de 9 a 10 fuentes.
> · Aparece en 4 plataformas: X, YouTube, Web/RSS, TikTok.
> · **Creció sin que creciera la conversación pública: el aumento viene de medios o instituciones.**
> · 100 % de su evidencia está territorialmente corroborada por el contenido.

Nótese el linaje: su `topicId` cambió de `t:0799d256a9e9` a `t:46405f94e7a0` porque absorbió una pieza y su firma de términos canónicos varió. **Sin el emparejamiento por contenido este tema habría aparecido como «nuevo»** y su crecimiento real (+1) se habría perdido.

---

## 11. Inspección manual de 10 temas

Se verificó que el texto «por qué» coincide con las evidencias en cada caso:

| Caso | Tema | Verificado |
|---|---|---|
| Trazabilidad | intercambiador monay | 7D=12/12, 10 fuentes, 4 plataformas, HIGH ✓ |
| Institucional de una fuente | **farmasol** | 7D=0/10, 1 fuente, `INSTITUTIONAL_HEAVY`, **LOW** ✓ |
| Nuevo por cobertura | cuenca azuay · azuay turismo | «cobertura nueva, no necesariamente actividad nueva» ✓ |
| **Nuevo por definición** | **ninguno** | **los 7 nuevos son por cobertura** ✓ |
| Liderado por conversación | concesiones mineras | conv=5/6, `CONVERSATION_LED`, HIGH ✓ |
| Afectado por TikTok | intercambiador monay | provider marcado, cobertura=true ✓ |
| Baja diversidad | farmasol | div=0,10, rss=1,00 ✓ |
| Alta diversidad | intercambiador monay | 10 fuentes / 12 ev ✓ |
| Comparación no válida | ninguno en esta pasada | 0 inválidas; probado sintéticamente ✓ |
| Sin actividad en 7D | farmasol y 9 más | 10 de 41 temas con `7D=0` ✓ |

---

## 12. Contrato de salida y read model

```js
trendRadarItem = {
  topicId, label, window,
  activity   { evidenceCount, evidenceCountTotal, fraccionEnVentana, windowCounts, calculable },
  change     { previousWindowValue, currentWindowValue, absoluteDelta, relativeDelta,
               sourceDelta, providerDelta, conversationDelta, estado,
               coverageExpansionContributed, motoresQueContribuyeron, limitacion },
  diversity  { uniqueSources, uniqueActors, providerCount, platformCount, platforms,
               UNIQUE_SOURCE_DIVERSITY, PROVIDER_PLATFORM_DIVERSITY, rssShare,
               singleSource/Provider/FamilyConcentration, DIVERSITY_CONFIDENCE },
  conversation  { publicConversationCount, mediaCount, institutionalCount, perfil },
  territoriality{ corroborated, probable, corroboratedShare, nota },
  coverage      { coverageConfidence, aFavor, enContra, nota },
  lineage       { via, similitud, previousTopicId, comparacionValida },
  why[], evidenceRefs[] /* máx. 25 */, evidenceRefsTotal, providerRefs[],
  previousObservationId, currentObservationId,
  projectId, tenantId, methodVersion, limitations[]
}
```

**Endpoint:** `POST /api/territorio/trend-radar` con `{ proyectoId, ventana, universo }`. Verificado por HTTP real: **200 con 41 items**, rankings separados, `peticionesExternas: 0`. Sin `proyectoId` → **400** («el radar es project-scoped: sin proyecto mostraría temas de otra campaña»). Ventana no soportada → **400** con la lista.

**No se construyó frontend.** El read-model devuelve solo lo necesario para pintar, sin cuerpos de evidencia.

## 13. Persistencia y trazabilidad

Los temas ya viven en `data/territorial-topics` append-only. El radar **no persiste un corpus nuevo ni copia cuerpos**: se calcula al leer.

**Trazabilidad verificada contra el ledger real:** `tema → evidenceRefs → evidenceId → ledger → fuente, URL, publishedAt, texto`. Referencias topadas a 25 por item: es un índice, no un almacén.

**Aislamiento:** proyecto A con sus temas, proyecto B con los suyos, proyecto inexistente → 0 items y 0 observaciones.

---

## 14. Tres errores propios

1. **Trazabilidad rota.** `topicStore` no persistía `evidenceIds`, así que cada item del radar decía «12 evidencias» y devolvía `evidenceRefs: 0`. **Lo encontró la inspección manual del tema de Monay**, no una prueba. Un `evidenceId` es un identificador, no un cuerpo: añadirlo no duplica nada. Corregido y reescrita la observación.
2. **Definiciones duplicadas al reescribir.** Append-only significa que corregir un campo añade una línea; sin deduplicar por `topicId` dentro de cada instante, la observación reescrita contaba cada tema dos veces.
3. **Dos pruebas mal escritas.** Las pruebas W y X prohibían las **palabras** «viral», «intención de voto» y «representatividad», y fallaban contra los **propios descargos** del módulo — que dicen «NO es viralidad». Reescritas para exigir que cada aparición esté **negada**: ahora si alguien escribe «tema viral» sin negación, saltan.

---

## 15. Pruebas y regresiones

`territorial-trend-radar`: **30 pruebas, 0 fallos**, cubriendo A–Z. Cero red.

Las que más importan: **M y N**, que verifican que el radar no lea «ahora miramos TikTok» como «Cuenca habla más de esto»; **L**, que protege contra comparar un split; **I**, base cero sin porcentaje; **H**, que no exista ningún estado de tendencia estable.

**Batería territorial: 1 008 pruebas, 0 fallos.** Candidate: `socialProviders` 36, `xReal` 37, `candidateIntelligence` 100. Media: `mediaPiece` 42, `mediaHome` 41, `mediaSourceUniverse` 33. Todas verdes.

`npm run build` correcto. `npm run lint`: 6 errores **preexistentes y ajenos**, sin tocar.

---

## 16. Limitaciones

Cada item las lleva embebidas:

> «Basado en fuentes públicas observables cubiertas por Sentinel.»
> «No representa a toda la población de Cuenca.»
> «Con dos observaciones, el cambio es preliminar y no constituye una tendencia estable.»

Y las específicas del corpus, heredadas: **50,7 % del corpus sigue siendo RSS** · **62 piezas sin `publishedAt`** fuera de toda ventana · **organizaciones = 0 y comunidades = 0** · `SHARED_URL_CASE_DEBT` con 83 URLs de YouTube muertas · `SHARED_GEO_CONTEXT_DEBT` · las 29 evidencias de GDELT medidas y no ingeridas.

Y la limitación estructural de esta pasada: **las dos observaciones están separadas por 9 horas del mismo día**, no por un intervalo editorialmente significativo. Los deltas que se ven son en buena medida el efecto de haber activado tres motores entre una y otra.

---

## 17. Veredictos

| | |
|---|---|
| `TREND_RADAR_ACTIVITY_MODEL` | **APPROVED** |
| `TREND_RADAR_CHANGE_MODEL` | **APPROVED** |
| `TREND_RADAR_DIVERSITY_MODEL` | **APPROVED** |
| `COVERAGE_ADJUSTED_INTERPRETATION` | **APPROVED** |
| `TOPIC_LINEAGE_HANDLING` | **APPROVED** |
| `TREND_RADAR_EXPLAINABILITY` | **APPROVED** |
| `TREND_RADAR_SENSITIVITY` | **ROBUST** |
| `TREND_RADAR_DATA_READINESS` | **READY_WITH_LIMITATIONS** |
| `TREND_RADAR_UI_READINESS` | **READY_FOR_INTEGRATION** |

`COVERAGE_ADJUSTED_INTERPRETATION` aprobado con el dato delante: **13 temas marcados, los 4 crecimientos y los 7 temas nuevos**. El radar no atribuye al territorio lo que es nuestro.

`TOPIC_LINEAGE_HANDLING` aprobado y no parcial: 27 emparejados por id, 7 por contenido, 0 comparaciones inválidas, y la salvaguarda de split probada.

`TREND_RADAR_SENSITIVITY = ROBUST` — y aun así se publican dimensiones separadas, por diseño.

`READY_WITH_LIMITATIONS`: el modelo funciona y los datos alcanzan, pero **dos observaciones a 9 horas de distancia, con tres motores activados en medio, no son una serie temporal.**

---

## 18. Siguiente recomendación exacta

**Una segunda pasada de recolección con las mismas fuentes y sin activar ningún motor nuevo**, separada del último punto por al menos 24–48 horas.

Es la única forma de obtener un delta que sea `OBSERVED_CONTENT_CHANGE` limpio. Hoy los cuatro crecimientos del radar están marcados por cobertura, así que el radar funciona y **todavía no puede decir nada sobre el territorio**. Con un tercer punto sin cambios de instrumentación:

1. los deltas dejarían de estar contaminados,
2. habría base para una segunda derivada,
3. y `COVERAGE_EXPANDED` distinguiría de verdad los temas que crecen de los que solo se ven mejor.

Como trabajos acotados en paralelo: **cablear TikTok keyword discovery con presupuesto de créditos** (capacidad demostrada, hoy sin automatizar), e **ingerir las 29 evidencias de GDELT** ya con espaciado.

**STOP.** No se crea frontend. No se recolecta. No se inicia Momentum, Pulso, Candidate, Media ni Sentinel AI. Se espera revisión humana.
