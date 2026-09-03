# TERRITORIAL-LOCAL-SOURCE-EXPANSION-02

**Expansión del universo de fuentes locales corroboradas — Cuenca 2027**

Terminal 2 · Territorial Intelligence
Base: `556fc6c` — TERRITORIAL-CORPUS-PERSISTENCE-01
Ejecutado: 2026-09-03

---

## 1. Metodología: las dos dimensiones que no son la misma

```
SOURCE_LOCALITY         ¿la fuente es de Cuenca?
CONTENT_TERRITORIALITY  ¿la pieza habla de Cuenca?
```

Independientes, y este gate solo responde la primera.

> El Mercurio es una fuente local corroborada. El Mercurio publica sobre el dólar. **Esa pieza no es territorialmente de Cuenca.**
>
> Expreso es un medio nacional. Expreso publica «el tranvía de Cuenca suma unidades». **Esa pieza sí se corrobora territorialmente.**

Las dos direcciones tienen prueba (B y C). Romper cualquiera produce un corpus que miente en sentido contrario: la primera inflaría lo local, la segunda lo perdería.

Cada ficha de fuente lleva escrito `contentTerritoriality: "NO APLICA. El territorio de cada pieza se resuelve por separado, pieza a pieza."`

**No se inventó ninguna fuente, URL, handle ni feed.** Todo partió de evidencia ya descubierta: los 44 dominios y los 26 activos del artefacto del gate anterior, más el universo de fuentes comprobado.

---

## 2. Clasificación de los 44 dominios descubiertos

| Estado | N |
|---|---|
| `LOCAL_CORROBORADA` | **16** |
| `AMBIGUA` | 14 |
| `NO_LOCAL` | 7 |
| `EXCLUIDA` | 7 |
| `LOCAL_PROBABLE` | 0 |
| `NO_RESOLUBLE` | 0 |

### Las 16 corroboradas — pero solo **10 entidades**

| Dominio | Familia | Entidad | Prioridad |
|---|---|---|---|
| `elmercurio.com.ec` | MEDIOS_LOCALES | elmercurio.com.ec | MEDIA |
| `lavozdeltomebamba.com` | MEDIOS_LOCALES | lavozdeltomebamba.com | MEDIA |
| `cuenca.gob.ec` | INSTITUCIONAL | cuenca.gob.ec | MEDIA |
| `tranvia.cuenca.gob.ec` | INSTITUCIONAL | cuenca.gob.ec | **ALTA** |
| `cuencaendatos.cuenca.gob.ec` | INSTITUCIONAL | cuenca.gob.ec | **ALTA** |
| `cultura.cuenca.gob.ec` | INSTITUCIONAL | cuenca.gob.ec | MEDIA |
| `etapa.net.ec` | INSTITUCIONAL | etapa.net.ec | MEDIA |
| `webnueva.etapa.net.ec` | INSTITUCIONAL | etapa.net.ec | **ALTA** |
| `centrosur.gob.ec` | INSTITUCIONAL | centrosur.gob.ec | MEDIA |
| `azuay.gob.ec` | INSTITUCIONAL | azuay.gob.ec | MEDIA |
| `cceazuay.gob.ec` | INSTITUCIONAL | cceazuay.gob.ec | MEDIA |
| `ucuenca.edu.ec` | UNIVERSIDAD | ucuenca.edu.ec | **ALTA** |
| `investigacion.ucuenca.edu.ec` | UNIVERSIDAD | ucuenca.edu.ec | **ALTA** |
| `uazuay.edu.ec` | UNIVERSIDAD | uazuay.edu.ec | **ALTA** |
| `investigaciones.uazuay.edu.ec` | UNIVERSIDAD | uazuay.edu.ec | **ALTA** |
| `ucacue.edu.ec` | UNIVERSIDAD | ucacue.edu.ec | **ALTA** |

**16 dominios → 10 entidades.** `webnueva.etapa.net.ec` es ETAPA con otro host; `tranvia.` y `cuencaendatos.` son el Municipio. Contarlos como fuentes nuevas habría inflado el universo con duplicados que parecen descubrimientos. Hay prueba (O).

### `NO_LOCAL` — el homónimo español, atrapado

| Dominio | Razón |
|---|---|
| `expreso.ec`, `eluniverso.com`, `extra.ec` | medio de alcance nacional |
| `ayuntamiento.cuenca.es` | **dominio de otro país que además contiene «cuenca»: es la Cuenca de España** |
| `educacionycultura.cuenca.es` | ídem |
| `larevistadetrenes.es`, `fulcrum.es` | dominio de otro país |

Es el mismo defecto que el gate `ecf8a34` midió en el contenido, ahora a nivel de fuente: dos dominios de la Cuenca de España habrían entrado como fuentes locales del cantón de Azuay.

### `EXCLUIDA` — no son fuentes

`x.com`, `twitter.com`, `es.wikipedia.org`, `en.wikipedia.org`, `play.google.com`, `moovitapp.com`, `es-us.noticias.yahoo.com`. Plataformas, enciclopedias y agregadores: no publican agenda local propia.

### `AMBIGUA` — 14, y ninguna se promueve

`mimunicipalidad.net`, `nlarenas.com`, `ectricol.com`, `cuencarent.com`, `ecuadorlegalonline.com`, `consultasec.com`, `bnamericas.com`, `radio.corape.org.ec`, `ecuador221.com.ec`, `agendaculturalnacional.casadelacultura.gob.ec`, `revistamundodiners.com`, `ecuraices.com`, `obs.agenda21culture.net`, `muchomejorecuador.org.ec`.

`cuencarent.com` es el caso didáctico: contiene «cuenca» y **eso no corrobora nada**. La ficha lo dice: *«el nombre contiene «cuenca», que NO es corroboración: es topónimo ambiguo y sustantivo común»*.

### Prioridad — reglas, no score

`ALTA` / `MEDIA` / `BAJA` / `EXCLUIR`, cada una con sus reglas escritas. **No hay ningún número del 0 al 100**: un score así parece objetivo y no se puede auditar. Hay prueba de que la salida no contiene ningún campo numérico.

Regla que produjo las 8 de prioridad ALTA: localidad corroborada **y** que no aporte todavía ninguna pieza al corpus — es decir, diversidad nueva frente al peso nacional.

---

## 3. Activos sociales — los 26 auditados

| | |
|---|---|
| `SOCIAL_ASSETS_REVIEWED` | **26** |
| `SOCIAL_ASSETS_VALID` | **26** |
| `SOCIAL_ASSETS_EXCLUDED` | 0 |
| `SOCIAL_ASSETS_UNRESOLVED` | 0 |
| **Entidades con activos** | **6** |

Por plataforma: Facebook 8, X 5, Instagram 5, YouTube 4, TikTok 4.

**Y la distinción que importa:** 9 activos son de plataformas con búsqueda abierta (X, YouTube) y **17 son solo `KNOWN_ACCOUNT_OBSERVATION`** (Facebook, Instagram, TikTok). Tener el activo no habilita descubrimiento abierto, y observar la cuenta oficial del Municipio no es escuchar a la ciudadanía. Ambas cosas con prueba.

**26 activos, 6 entidades.** Unsión TV tiene cinco activos y sigue siendo una entidad. `ENTIDAD`, `ACTIVO` y `EVIDENCIA` son tres cifras distintas y confundirlas infla la diversidad.

---

## 4. Benchmark real por fuente

### El resultado incómodo: las fuentes locales institucionales y académicas son casi inobservables por RSS

| Fuente | Familia | Canal | Requests | Estado | Observadas | CORROB | AMBIGUO | NO_RES |
|---|---|---|---|---|---|---|---|---|
| `tranvia.cuenca.gob.ec` | INSTITUCIONAL | web | 1 | **NO_PUBLICA_RSS** | 0 | — | — | — |
| `webnueva.etapa.net.ec` | INSTITUCIONAL | web | 1 | **NO_PUBLICA_RSS** | 0 | — | — | — |
| `cuencaendatos.cuenca.gob.ec` | INSTITUCIONAL | web | 1 | **NO_PUBLICA_RSS** | 0 | — | — | — |
| `investigaciones.uazuay.edu.ec` | ACADEMIA | web | 1 | **NO_PUBLICA_RSS** | 0 | — | — | — |
| `uazuay.edu.ec` | ACADEMIA | web | 1 | **NO_PUBLICA_RSS** | 0 | — | — | — |
| `investigacion.ucuenca.edu.ec` | ACADEMIA | web | 1 | **NO_PUBLICA_RSS** | 0 | — | — | — |
| `ucuenca.edu.ec` | ACADEMIA | rss | 3 | OK | **0** | 0 | 0 | 0 |
| `ucacue.edu.ec` | ACADEMIA | rss | 2 | OK | 10 | **0** | 9 | 0 |

**6 de 8 no publican RSS. `ucuenca.edu.ec` tiene dos feeds y devolvió 0 piezas. `ucacue.edu.ec` dio 10 piezas y ninguna territorialmente corroborada.**

Ese es el hallazgo central del gate y contradice su premisa optimista: los 32 candidatos incluían fuentes locales genuinas, pero **la mayoría no es observable con los mecanismos gratuitos disponibles**. No inventé un feed para ninguna.

### Lo que sí mejoró la composición: X y YouTube

| Consulta | Canal | Req | Observadas | CORROB | AMBIGUO | FUERA | NO_RES |
|---|---|---|---|---|---|---|---|
| `x:local:institucional` | X | 1 | 25 | 5 | 1 | 0 | **19** |
| `x:local:servicios` | X | 1 | 25 | **16** | 6 | 0 | 3 |
| `x:local:ciudadano` | X | 1 | 25 | 13 | 12 | 0 | 0 |
| `yt:local:unsion` | YouTube | 1 | 15 | 0 | 3 | 0 | **12** |
| `yt:local:municipio` | YouTube | 1 | 15 | **10** | 4 | 0 | 0 |
| `yt:local:servicios` | YouTube | 1 | 15 | 6 | 5 | 0 | 4 |

Dos observaciones que valen para el próximo gate: la consulta **institucional** de X dio 19 no resolubles de 25 —las cuentas de EMOV, EMAC y ETAPA no dicen «Cuenca» en sus tuits, hablan a quien ya sabe dónde está—, y **`servicios` fue la mejor consulta** con 16 de 25 corroboradas.

### Agregado

`REAL_INPUT = 130` · `INSERTED = 112` · `DEDUPLICATED = 18` · `SKIPPED = 0`

Segunda pasada: **INSERTED 0, DEDUPLICATED 130.** Idempotente. `sinSustitucionDeFecha: true`. Las 130 traían fecha: `TEMPORAL_INELIGIBLE = 0` en esta pasada.

---

## 5. Composición del corpus — BEFORE / AFTER

| | Before | After |
|---|---|---|
| `CORPUS` | 461 | **573** |
| `rss_directo` | 353 (**76,6 %**) | 363 (**63,4 %**) |
| `x_api` | 61 | 124 |
| `youtube_data` | 27 | 66 |
| `brave_web` | 20 | 20 |

**El peso relativo de RSS nacional bajó 13 puntos** sin borrar una sola pieza nacional.

### Localidad de la fuente

| | N | % |
|---|---|---|
| `LOCAL_CORROBORADA` | **135** | 23,6 % |
| `NO_LOCAL` (nacional) | 212 | 37,0 % |
| otra | 226 | 39,4 % |
| desconocida | 0 | 0 % |

**El 39,4 % «otra» merece explicación honesta:** son en su mayoría piezas de X y YouTube, cuyo `domain` es `x:<id>` o `youtube:<canal>` y no un dominio web. La clasificación de localidad de fuente es **dominio-céntrica y no aplica limpiamente a plataformas sociales**: la localidad de un tuit depende del actor, no del host. Es una limitación real del módulo, no un dato.

### Naturaleza del contenido (§19)

| | N |
|---|---|
| `MEDIA` | 288 |
| `PUBLIC_CONVERSATION` | **124** |
| `INSTITUTIONAL` | 84 |
| `OTHER` | 66 |
| `SEARCH_RESULT` | 11 |

Contenido institucional **no** se cuenta como conversación ciudadana. Y YouTube queda deliberadamente en `OTHER`: un canal de televisión es medio y un vecino con el móvil es conversación, y sin saber de quién es el canal se dice `OTHER` en lugar de elegir.

### Territorial

| | Before | After |
|---|---|---|
| `CORROBORADO` | 181 | **219** |
| `PROBABLE` | 14 | 14 |
| **`USABLE` (ampliado)** | **195** | **233** |
| `AMBIGUO` | 14 | **51** |
| `CONFLICTIVO` | 2 | 2 |
| `FUERA` | 13 | 14 |
| `NO_RESOLUBLE` | 237 | 273 |

> **233 señales territorialmente utilizables: 219 corroboradas y 14 probables.**

`AMBIGUO` subió de 14 a 51: **+37**. Es el coste real del contenido social y académico nuevo, y no se oculta. `NO_RESOLUBLE` sube porque el corpus es append-only.

### Temporal

`WITH_PUBLISHED_AT` 559 · `WITHOUT` 14 (las mismas de Brave del gate anterior; ninguna pieza nueva sin fecha).

**Aislamiento:** proyecto A 573, proyecto B 0.

---

## 6. Diversidad

| Familia | Entidades corroboradas |
|---|---|
| MEDIOS_LOCALES | **2** (El Mercurio, La Voz del Tomebamba) |
| INSTITUCIONAL_PUBLICO | **5** (Municipio, ETAPA, Centrosur, Prefectura del Azuay, CCE Azuay) |
| UNIVERSIDAD_ACADEMIA | **3** (U. de Cuenca, U. del Azuay, U. Católica de Cuenca) |
| ORGANIZACIONES | 0 |
| CULTURA_COMUNIDAD | 0 |
| **Total** | **10 entidades** |

Por canal: web 16 dominios · RSS 2 con feed legible · X 5 activos · YouTube 4 · Facebook-known 8 · Instagram-known 5 · TikTok-known 4.

**Huecos de diversidad evidentes:** cero organizaciones (cámaras, gremios, fundaciones) y cero comunidad/cultura entre las corroboradas. Solo dos medios locales. Ese es el vacío real del universo.

---

## 7. Candidatas para Media Source Universe (§28)

Lista estructurada, **nada ingresado**. No se tocó la UX ni la metodología de Media, y no se construyó un segundo universo de fuentes.

| Dominio | Clasificación | Candidata a Media |
|---|---|---|
| `elmercurio.com.ec` | MEDIA | **sí** |
| `lavozdeltomebamba.com` | MEDIA | **sí** |
| `cuenca.gob.ec` + 3 subdominios | INSTITUTIONAL | no |
| `etapa.net.ec` + 1 subdominio | INSTITUTIONAL | no |
| `centrosur.gob.ec`, `azuay.gob.ec`, `cceazuay.gob.ec` | INSTITUTIONAL | no |
| `ucuenca.edu.ec`, `uazuay.edu.ec`, `ucacue.edu.ec` + 2 subdominios | ACADEMIC | no |

Todas con `estadoDeDescubrimiento: DISCOVERED_BY_SENTINEL` y `requiereDecisionHumana: true`.

---

## 8. Presupuesto

| Recurso | Tope | Consumido |
|---|---|---|
| Brave | 6 | **0** |
| X | 3 | **3** |
| YouTube | 3 | **3** |
| SerpAPI | 0 (máx. 2) | **0** |
| ScrapeCreators | 0 | **0** |
| Instagram / Facebook / TikTok | 0 | **0** |
| HTTP directo a sitios locales | — | 11 (gratuito) |
| **Coste** | — | **$0** |

Brave quedó a 0 porque las 8 fuentes de prioridad alta se comprobaron por HTTP directo, que es gratis y más preciso: no hacía falta preguntarle a un motor por un dominio que ya se conocía.

---

## 9. Pruebas

Suite nueva `territorial-local-source`: **31 pruebas, 0 fallos**, cubriendo A–R. Cero red.

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
| `territorial-local-source` | **31** |
| `territorial-project` | 29 |
| `territorial-expansion` | 29 |
| `territorial-listening` | 31 |
| **Total territorial** | **864 · 0 fallos** |

Candidate: `socialProviders` 36, `xReal` 37, `candidateIntelligence` 100, `accountIntelligence` 36 — verdes.
Media: `mediaPiece` 42, `mediaTime` 29, `mediaHome` 41, `mediaSourceUniverse` 33 — verdes.
`npm run build` correcto. `npm run lint`: 6 errores **preexistentes y ajenos**, sin tocar.

### Dos errores propios

1. **`porNaturaleza` reportaba 0 `PUBLIC_CONVERSATION` con 124 piezas de X en el corpus.** La ficha de dominio ganaba siempre sobre el proveedor, y una pieza de X cae en `AMBIGUA` con naturaleza `OTHER`. Ahora la ficha decide solo cuando sabe algo (`ficha.familia != null`); si no, decide el proveedor. Prueba H-bis.
2. **Una prueba que no podía fallar.** La P estaba declarada con `t()` y un callback `async`: devolvía una promesa, `r === false` era falso y pasaba sin comprobar nada. Movida a `ta()` con aserciones reales.

---

## 10. Limitaciones

1. **6 de 8 fuentes locales de prioridad alta no publican RSS.** Institucional y académico son casi inobservables con los mecanismos gratuitos.
2. **`ucacue.edu.ec` dio 10 piezas y 0 corroboradas.** Contenido académico que no nombra el cantón.
3. **`AMBIGUO` subió +37.** Coste real del contenido nuevo.
4. **El 39,4 % del corpus queda en localidad «otra»** porque la clasificación es dominio-céntrica y no aplica a plataformas sociales.
5. **Solo 2 medios locales corroborados.** Cero organizaciones, cero comunidad/cultura.
6. **Las cuentas institucionales de X no dicen «Cuenca»:** 19 no resolubles de 25.
7. **Las 14 candidatas `AMBIGUA` siguen sin verificar** — exige trabajo humano.
8. **`SHARED_GEO_CONTEXT_DEBT` intacta.**

---

## 11. `TOPIC_NORMALIZATION_DATA_READINESS = PARCIAL`

**A favor.** El peso de RSS nacional cayó de 76,6 % a 63,4 %. Hay 233 señales utilizables frente a 195. Hay 124 piezas de conversación pública real, separadas de las 84 institucionales y de las 288 de medios. Hay 10 entidades locales corroboradas y 3 familias distintas. La procedencia y la temporalidad son auditables pieza a pieza.

**En contra.** El 63,4 % sigue siendo RSS con fuerte peso nacional, y 273 piezas —el 47,6 %— siguen sin resolver territorialmente. Solo hay **2 medios locales** y **cero organizaciones y cero comunidad**: los temas que saldrían serían los de las instituciones y los medios, no los de la ciudad. Y `AMBIGUO` creció más rápido que `CORROBORADO` en términos relativos.

No es `NO_LISTO` porque ya se puede distinguir con precisión qué viene de medios, de instituciones, de conversación y de búsqueda, y qué está corroborado frente a probable — que es exactamente lo que el criterio de éxito pedía.

No es `LISTO` porque preguntar «¿de qué habla Cuenca?» sobre 2 medios locales y 0 organizaciones daría una respuesta institucional, no urbana.

**No se inventa un umbral para aprobar.** El dato que faltaría para pasar a `LISTO` es concreto: más medios locales y presencia de organizaciones/comunidad entre las fuentes corroboradas.

---

## 12. NEXT_RECOMMENDED_GATE

**`TERRITORIAL-LOCAL-MEDIA-DISCOVERY-03`** — descubrimiento dirigido de **medios locales y organizaciones**, que es el hueco medido: 2 medios y 0 organizaciones.

Con dos aprendizajes de este gate incorporados: **el HTTP directo es mejor y más barato que preguntarle a un motor por un dominio que ya conoces**, y **la consulta de servicios funciona mucho mejor que la institucional** (16 de 25 corroboradas frente a 5 de 25).

Alternativa razonable si se prefiere no seguir expandiendo: **aceptar `PARCIAL` y arrancar Topic Normalization solo sobre el estrato `CORROBORADO`** (219 piezas), declarando explícitamente que los temas resultantes reflejan medios e instituciones y no a la ciudadanía. Es defendible, pero es una decisión sobre el alcance de las conclusiones, no un problema técnico.

**STOP.** No se inicia ningún gate. No se toca Topic Normalization, Trend Radar, Momentum, Change Attribution, Pulso Electoral Digital, IPID, Sentinel AI, stance, sentiment, UX de Media o Candidate, Reporting, ningún proveedor nuevo ni `esElAmbito`. Se espera decisión humana.
