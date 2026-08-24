# ARQ-GEO-001 — Inteligencia Territorial y Conversación Pública

| Campo | Valor |
|---|---|
| Estado | **Implementado — sin datos oficiales** |
| Versión | 1.0 |
| Fecha | 2026-08-24 |
| Ámbito | `apps/backend/services/geo/`, `apps/backend/services/conversation/`, `apps/web/src/territorio/` |
| Implementa | UX-WR-001 §1, §6, §12 (Geo Intelligence Engine) · ARQ-SDI-000 §2 (fuente *Public Conversation*) |
| No modifica | `docs/constitution/`, UX-WR-001 (congelado), `services/social/`, `services/projects/` |
| Depende de | Search Provider Layer ✅ · Knowledge Lake ✅ · Territory Registry (nuevo) |

---

## 1. Qué se construyó y qué no

UX-WR-001 v2.0 está **congelado** y ya especificaba este motor con nombres de archivo exactos (§10.2, §12). Este módulo **no inventa arquitectura**: implementa la especificación existente hasta donde los datos disponibles lo permiten.

| Componente de UX-WR-001 §12.2 | Estado |
|---|---|
| Territory Registry | ✅ implementado, **sin geometría** |
| Geo Resolver | ✅ implementado, las cuatro procedencias |
| Spatial Aggregator | ✅ implementado, GEO-1 activa |
| Normalizer | ✅ implementado, **bloqueado por falta de denominadores** |
| Territorial Timeline | ✅ implementado |
| Anomaly Detector | ✅ implementado |
| Attribution Engine | ⛔ **no implementado** — UX-3, requiere histórico para calibrar |
| Replay Reconstructor | ⛔ **no implementado** — UX-3 |

Y un motor nuevo, que ARQ-SDI-000 §2 declaraba como fuente pendiente:

| Public Conversation Engine | Estado |
|---|---|
| Recolección con coste declarado | ✅ |
| Agrupación temática determinista | ✅ |
| Clasificación de encuadre léxica | ✅ |
| Registro de medios y cobertura | ✅ |
| Menciones por actor | ✅ |
| Serie temporal de volumen | ✅ |

---

## 2. Las tres carencias, declaradas

Ninguna se rellena con estimaciones. La regla operativa es **`null` + `verificado:false` + «Dato oficial pendiente de integración»**.

| Falta | Origen | Qué bloquea | Qué NO bloquea |
|---|---|---|---|
| **GeoJSON de las 36 parroquias** | GAD Cuenca / INEC | mapa, coropleta, superficie km² | resolución de topónimos, ranking, series, temas, medios |
| **Población (INEC)** | INEC | normalización por población, per cápita, penetración | conteo absoluto, ranking, variación propia entre periodos |
| **Padrón (CNE)** | CNE | normalización por padrón | conteo absoluto |

### La regla dura, y por qué no es solo un aviso

> Sin denominador oficial no se calcula ninguna métrica per cápita, ningún porcentaje poblacional y ninguna intensidad relativa.

No está implementada como advertencia sino como **ausencia de código**: en `normalizer.js` no existe ninguna rama que estime, interpole, reparta o impute un denominador ausente. Si el valor es `null`, la salida es `disponible: false` con motivo.

El precedente lo justifica. GEO-1 nació del informe de Meta Ads de la Prefectura del Azuay (27-may a 27-jun 2026): repartir el alcance provincial según peso poblacional del INEC — que es lo que haría cualquiera — produjo penetraciones del **134 %** y el **238 %**. Un denominador estimado no degrada la respuesta poco a poco: la invierte, y en silencio.

### Punto de inyección

Los tres datos entran **sin tocar una línea de código**:

```
services/geo/territories/
├── ec-azuay-cuenca.json                 añadir `geometria` a cada unidad
├── ec-azuay-cuenca-sectores.json        polígono del Centro Histórico
└── ec-azuay-cuenca-denominadores.json   rellenar valor + fuente + verificado
```

Y `POST /api/territorio/recargar` los relee sin reiniciar el backend.

---

## 3. GEO-1, hecha cumplir por construcción

`geoContracts.js` es la única fuente de verdad sobre procedencia y resolución. `spatialAggregator.js` la consulta y **solo sabe subir**: no existe ninguna ruta de código que reparta hacia abajo.

Consecuencia buscada: la prohibición de componer el Centro Histórico sumando parroquias (WR-D10, riesgo WR-4) **se cumple sin una comprobación que alguien pueda olvidar**. Componerlo sería bajar de parroquia a sector, y bajar no existe.

### Comportamiento verificado

| Caso | Resultado |
|---|---|
| Dato de cantón, se pide parroquia | Se agrega en cantón, se declara el bloqueo |
| Dato de sector sin ancestro parroquia | Sube a cantón, se declara la degradación |
| Dato de parroquia, se pide sector | Se queda en parroquia — nunca baja |
| Resolución efectiva ≠ pedida | Se anuncia **antes** de las cifras (§11 regla 3) |

---

## 4. Desambiguación de topónimos — el problema real

El catálogo de Cuenca está lleno de nombres que son también otra cosa. Resolverlos por presencia de la palabra repetiría, en versión geográfica, el fallo que AUD-001 documentó con Pedro Palacios.

### Dos ambigüedades que **no se resuelven igual**

| Clase | Ejemplo | Qué la despeja |
|---|---|---|
| **externa** | «Baños» (Cuenca) vs Baños de Agua Santa | La cobertura declarada de un medio local |
| **interna** | La parroquia «Sucre» vs la avenida Sucre | **Solo** contexto explícito en el texto |
| **ambas** | «Santa Ana» (Manabí + nombre oficial del propio cantón) | Se trata como interna |

Un diario de Cuenca publicando «avenida Sucre» no convierte la avenida en la parroquia: ahí la cobertura local, si acaso, agrava el error. Por eso la cobertura del medio abre la puerta **solo** para ambigüedad externa, y solo si es de provincia o más fina — un medio nacional cubre todo el país y no discrimina nada.

### Las cuatro vías de respaldo

1. La forma citada ya es inequívoca (`Santa Ana de los Ríos de Cuenca`, `Baños de Cuenca`)
2. El texto trae un término exigido por el catálogo
3. La unidad está dentro de la cobertura declarada de la fuente *(solo ambigüedad externa)*
4. El topónimo **es** el ámbito declarado por el analista

Pertenecer al ámbito del proyecto **no** es una de ellas: que el proyecto sea de Cuenca no impide que una nota hable de Baños de Ambato.

### Verificado

| Texto | Fuente | Resultado |
|---|---|---|
| «El Batán tendrá nueva vía» | El Mercurio (Cuenca) | ✅ `el-batan` · derivada · 78 |
| «El Batán tendrá nueva vía» | medio nacional | ⛔ sin ubicar |
| «El Batán tendrá nueva vía» | sin fuente | ⛔ sin ubicar |
| «Turistas llenan Baños» | El Mercurio | ✅ `banos` · derivada · 78 |
| «Choque en la avenida Sucre» | El Mercurio | ⛔ sin ubicar *(interna)* |
| «La parroquia Sucre celebra» | El Mercurio | ✅ `sucre` · derivada · 75 |
| «Cortes en Yanuncay y Totoracocha» | — | ✅ `ec-azuay-cuenca` · **agregada** · ancestro común |

El último caso es la regla contra el doble conteo: dos parroquias de igual peso no se atribuyen a una (arbitrario) ni a las dos (duplica la evidencia). Sube al ancestro común, que es literalmente lo que se sabe.

---

## 5. El anclaje de consultas — defecto medido y corregido

**Primera ejecución real.** Consulta `Cuenca` a Google News, con `gl=EC` ya puesto:

```
Feria de San Julián con Morante y Talavante
Accidente en la A-3 provoca retenciones
El eclipse visto desde el Cerro del Socorro
```

Todo de **Cuenca, España**. El parámetro regional no basta.

**Corrección:** el ancla territorial que declaró el analista entra en la consulta y no es opcional. Nunca se emite el nombre del ámbito a secas.

```
Cuenca Azuay  ·  Cuenca Ecuador  ·  Cuenca municipio alcaldía  ·  Cuenca concejo cantonal
```

**Segunda ejecución, misma fuente:**

```
Cuenca tiene nueve candidatos inscritos para la Alcaldía
Azuay confirma aspirantes para la Alcaldía de Cuenca y la Prefectura
Elecciones en Cuenca y Azuay: redes y estrategia electoral
```

Es la misma doctrina de `projectContext.js`: el territorio lo fija el analista y entra con fuerza superior a cualquier término derivado de evidencia. Si el ámbito no declara provincia ni país, las consultas se marcan `anclada: false` y se advierte.

---

## 5-bis. Search Layer — qué se comparte y qué es exclusivo

### Matriz de motores (verificada en ejecución, 2026-08-24)

| Motor | Archivo | Credencial | Territorial | Candidatos | Estado |
|---|---|---|---|---|---|
| **SerpAPI (Google)** | `providers/serpapiProvider.js` | `SERPAPI_API_KEY` ✅ | ✅ vía Search Provider Layer | ✅ | **ACTIVO** — 964/1000, Starter Plan |
| **Brave Search** | `providers/braveProvider.js` | `BRAVE_API_KEY` ❌ | ✅ (misma capa) | ✅ | **SIN CREDENCIAL** |
| **DuckDuckGo** | `providers/duckProvider.js` → `googleService.js` | no requiere | ✅ (misma capa) | ✅ | **ACTIVO** — último recurso |
| **Bing** | — | — | declarado | declarado | **NO IMPLEMENTADO** |
| **Google News (RSS)** | `googleNewsService.js` | no requiere | ✅ **principal** | ✅ semilla | **ACTIVO** |
| **Knowledge Lake** | `knowledgeLake/lakeQuery.js` | — | ✅ requiere `proyectoId` | ✅ | **ACTIVO** |
| Wikidata / Wikipedia | `social/discovery/*`, `avatar/*` | no requiere | ❌ no integrado | ✅ | ACTIVO en candidatos |
| Wayback · Whois | `waybackService.js`, `whoisService.js` | no requiere | ❌ no integrado | ✅ | ACTIVO en candidatos |
| Facebook · IG · X · TikTok · YouTube · LinkedIn | `social/discovery/platformAdapters.js` | — | ❌ no integrado | ✅ vía buscador | Sin API de plataforma |

> `googleService.js` **consulta DuckDuckGo**, no Google. El nombre se conserva por compatibilidad y el propio archivo lo declara en su cabecera.

### Lo que ya se comparte

```
                  SENTINEL SEARCH LAYER
                          |
        +-----------------+------------------+
        |                                    |
  Provider Registry                   Google News (RSS)
  SerpAPI · Brave · Duck · [Bing]            |
        |                                    |
  Search Provider Layer                      |
  presupuesto · salud · fallback             |
  trazabilidad de intentos                   |
        |                                    |
   +----+---------------------+--------------+
   |                          |
Candidate Planner      Territorial Planner
(fusionSearchEngine ·  (conversationHarvester ·
 discoveryEngine)       planificarConsultas)
   |                          |
Identity Matcher       Geo Resolver
(personas)             (territorio)
```

**Compartido:** los cuatro proveedores web, el presupuesto por sesión, el circuito de salud, la cadena de *fallback*, la trazabilidad de intentos, `textUtils` (normalización de URL y dominio) y el Knowledge Lake.

**No se duplicó ni un proveedor.** Territorial consume SerpAPI por `buscarWeb()`, exactamente igual que el Discovery Engine, y comparte el mismo saldo mensual.

### Lo que es exclusivo territorial, y por qué

| Pieza | Por qué no se reutiliza |
|---|---|
| **Territorial Planner** | Investiga un territorio, no una persona. Ancla por provincia y país y añade vocabulario de gestión pública; el planner de candidatos ancla por dignidad y plataforma. |
| **Geo Resolver** | Resuelve topónimos con procedencia. El Identity Matcher resuelve identidad de personas: aplicarlo a geografía sería usar señales de handle y nombre sobre entidades que no tienen ninguna. |
| **Media Registry** | La cobertura territorial de un medio no existe como concepto en el pipeline de candidatos. |
| **Topic Extractor · Framing** | Operan sobre un corpus territorial, no sobre las cuentas de un objetivo. |

### Cómo se incorpora un motor nuevo

Escribir un módulo en `services/providers/` con el contrato `{id, nombre, tipo, prioridad, buscar, estaConfigurado, diagnostico, presupuesto, intervaloMs}` y registrarlo en `providerRegistry.js`. **Ambos módulos lo consumen sin cambio alguno**: ni el Fusion Engine ni el Territorial Harvester conocen ningún buscador concreto.

Un motor que no encaje en ese contrato — un RSS, una API institucional — se integra como fuente propia del recolector, igual que Google News, y aparece en la traza con su propio estado.

---

## 6. Presupuesto de cuota

El plan de SerpAPI da **250 búsquedas al mes** — un saldo, no un límite por hora — y lo comparte con el Discovery Engine, que gasta 6 por investigación.

| Modo | Fuentes | Coste |
|---|---|---|
| `lake` | Knowledge Lake | **0** |
| `noticias` *(por defecto)* | Lake + Google News RSS | **0** |
| `web` | + hasta 3 consultas web | **1–3 búsquedas** |

Cada respuesta declara el coste, gastara o no. El módulo **no se ejecuta al montarse**: el analista pulsa, y antes de pulsar ve el coste del modo elegido.

---

## 7. Conversación pública ≠ conversación ciudadana

El módulo mide **publicación observable en la web abierta**. No mide opinión ciudadana.

La captura masiva de redes está **excluida por indicación expresa** (UX-WR-001 §15). Por eso se llama Conversación *Pública* y no *Ciudadana*, y por eso cada respuesta declara:

> Un aumento significa «se publicó más», no «importa más».

La aclaración va **encima** del gráfico en la interfaz. Debajo de la curva se lee después de haber interpretado el pico, y ya no corrige nada.

### Encuadre: cuatro etiquetas, y la cuarta es la importante

`no_determinable` no es un cajón de sastre: en la ejecución real fueron **24 de 29**. El reparto porcentual se calcula sobre las **determinadas** y las no determinables se muestran aparte con su cifra.

Metido en el denominador, «crítico 12 %» parece marginal. Fuera de él, el mismo dato es «crítico 60 % de lo clasificable, y el 83 % no se pudo clasificar». Las dos frases son ciertas; solo la segunda es útil.

El clasificador es **léxico, no semántico**. No detecta ironía ni negación: «el alcalde negó el incumplimiento» se clasifica como crítico. El fallo está medido, declarado y viaja en cada respuesta. Se acepta a cambio de determinismo y explicabilidad (IA1) — un modelo de lenguaje etiquetaría mejor y explicaría peor.

Y califica el **texto**, jamás a la persona. «Cobertura crítica sobre X» no es «X es criticable».

### Temas: deterministas, y por qué

Dos capas: léxico de dominio declarado (categorías con nombre auditable) y coocurrencia de términos frecuentes (temas emergentes, etiquetados por sus propios términos).

Sin modelo de lenguaje, y no por falta de medios: el mismo lote debe producir el mismo agrupamiento hoy y dentro de un mes. Sin esa estabilidad, **Replay Intelligence reconstruiría un pasado distinto del que ocurrió**.

Dos exclusiones aprendidas de la ejecución real:

- **El nombre del territorio no es tema.** Producía un tema «cuenca» con 15 de 24 evidencias: el criterio de búsqueda devuelto como hallazgo.
- **Un medio no es tema.** «elmercurio» aparecía con 4 evidencias. Quién publica es una dimensión real y el registro de medios la mide, pero es *otra* pregunta.

---

## 8. Estructura de archivos

```
apps/backend/services/geo/                    ← nombres de UX-WR-001 §10.2
├── geoContracts.js                  procedencias · resoluciones · GEO-1
├── territoryRegistry.js             unidades · jerarquías arbitrarias
├── geoResolver.js                   texto → unidad + procedencia
├── spatialAggregator.js             GEO-1 vive aquí
├── normalizer.js                    bloqueo duro sin denominador
├── territorialTimeline.js           series por unidad
├── anomalyDetector.js               mediana + MAD, robusto
├── geoIntelligenceEngine.js         orquestador
├── projectTerritoryBridge.js        único acoplamiento a projects/ (solo lectura)
└── territories/
    ├── territoryLoader.js
    ├── ec-azuay-cuenca.json                 36 parroquias, verificado:false
    ├── ec-azuay-cuenca-sectores.json        Centro Histórico
    └── ec-azuay-cuenca-denominadores.json   todo null, fuente pendiente

apps/backend/services/conversation/
├── conversationContracts.js         naturaleza · modos · presupuesto
├── conversationHarvester.js         recolección con coste declarado
├── topicExtractor.js                dos capas, determinista
├── framingClassifier.js             léxico, cuatro etiquetas
├── mediaRegistry.js                 catálogo semilla + cobertura
├── actorMentions.js                 nombre+apellido, nunca apellido suelto
├── conversationTimeline.js          volumen por tema y encuadre
└── publicConversationEngine.js      orquestador

apps/backend/routes/territorio.js    composición de los dos motores

apps/web/src/territorio/             precursor del War Room, sin mapa
├── TerritorialModule.jsx · TerritorialContext.jsx · useTerritorial.js
├── controls/  TerritorySelect · TimeRangeControl · NormalizationSelect
├── panels/    TerritorialRanking · ConversationVolume · Topics ·
│              MediaCoverage · ResolutionNotice · UnknownsBlock ·
│              CoverageDeclaration
└── viz/       palette.js (§13 validada) · EvolutionChart · DeltaBadge
```

### Dos decisiones de acoplamiento

**`geo/` no importa nada de `conversation/`.** El resolver recibe una *función* que le da la pista de cobertura por evidencia, y la inyecta la capa de rutas. Es el mismo patrón por el que el Fusion Engine no conoce a ningún buscador concreto.

**`apps/web/src/warroom/` queda intacto.** Esa ruta está reservada por el documento congelado para cuando existan MapLibre y el GeoJSON. `territorio/` es su precursor sin mapa y consume **el mismo motor**, así que no hay trabajo duplicado.

---

## 9. Endpoints

| Método | Ruta | Coste |
|---|---|---|
| `GET` | `/api/territorio/salud` | 0 |
| `GET` | `/api/territorio/catalogo` | 0 |
| `POST` | `/api/territorio/recargar` | 0 |
| `POST` | `/api/territorio/resolver` | 0 |
| `POST` | `/api/territorio/analisis` | según `modo` |
| `POST` | `/api/territorio/conversacion` | según `modo` |

`/resolver` es una herramienta de **auditoría**: permite comprobar por qué una evidencia se ubicó donde se ubicó, o por qué no. Sin ella, la desambiguación sería una caja negra.

---

## 9-bis. Trazabilidad de motores y estados diferenciados

Toda ejecución devuelve `conversacion.recoleccion.trazaMotores`, **incluidos los motores que no se consultaron**.

| Estado | Significado | ¿Permite afirmar ausencia? |
|---|---|---|
| `OK` | Respondió con resultados | **sí** |
| `SIN_RESULTADOS` | Respondió, no había nada | **sí** |
| `NO_EJECUTADO` | No se le preguntó | no |
| `SIN_CREDENCIAL` | No se puede preguntar | no |
| `ERROR` | Se le preguntó y falló | no |
| `TIMEOUT` | No respondió a tiempo | no |
| `BLOQUEADO` | Cuota o límite de tasa | no |
| `NO_IMPLEMENTADO` | Declarado, sin módulo | no |

Solo los dos primeros autorizan a decir «no hay nada publicado». Los demás son huecos de cobertura, y viajan al bloque «Lo que no sabemos» — no a un panel de diagnóstico aparte, porque cambian cómo se lee un resultado vacío.

### Límite de tiempo

`rss-parser` trae 60 s por defecto y `googleNewsService` no admite señal de aborto. Con cuatro consultas encadenadas eso son hasta cuatro minutos con la petición HTTP abierta — **medido: una ejecución de 2,5 s se quedó colgada más de dos minutos** cuando el feed dejó de responder.

No se modificó ese servicio (lo comparte el `osintEngine`): se acota desde el recolector con 12 s por consulta y 45 s totales. El estado resultante es `TIMEOUT`, distinto de `ERROR` y de `SIN_RESULTADOS`.

### Limitación conocida que se declara

`googleNewsService` devuelve `{total: 0, resultados: []}` tanto si no hubo noticias como si el feed falló, porque traga la excepción. En esas consultas **no se puede distinguir «sin noticias» de «feed no disponible»**, y la advertencia lo dice. Corregirlo exigiría tocar código compartido con el pipeline de candidatos, que esta línea de trabajo no modifica.

---

## 10. Ejecución real verificada — Cuenca, 2026-08-24

### 10.1 Modo `noticias` — coste 0

```
motores          Google News OK (4 consultas, 32 resultados)
                 Knowledge Lake NO_EJECUTADO (sin proyectoId)
                 SerpAPI NO_EJECUTADO (modo sin coste)
                 Brave SIN_CREDENCIAL · DuckDuckGo NO_EJECUTADO
                 Bing NO_IMPLEMENTADO
evidencias       29 · 29 con fecha · 16 publicadores declarados
territorio       parroquia (efectiva) · 29/29 ubicadas · 0 sin ubicar
                 Cuenca 28 (con dato) · Machángara 1 (muestra insuficiente)
GEO-1            28 atribuciones a parroquia impedidas → agregadas en cantón
medios           1 local (El Mercurio, desambigua) · 7 nacionales
temas            Gestión y gobernanza · Proceso electoral · clima
encuadre         3 crítico · 1 favorable · 1 neutro · 24 no determinable
tiempo           4,93 s
```

### 10.2 Modo `web` — coste 1 búsqueda

Verifica que el **proveedor compartido** funciona desde territorial:

```
SerpAPI (Google)   OK · 1 consulta · 9 resultados · 1 de cuota
evidencias         38 (29 noticias + 9 web) · 38/38 ubicadas
medios             16 dominios · 1 local · 7 nacionales · 4 desconocidos
                   (aparecen wikipedia y facebook, ausentes en modo noticias)
```

### 10.3 Desambiguación — nueve casos

| Texto | Fuente | Resultado |
|---|---|---|
| «El Batán tendrá nueva vía» | El Mercurio (cantonal) | ✅ `el-batan` |
| «El Batán tendrá nueva vía» | medio nacional | ⛔ sin ubicar |
| «El Batán tendrá nueva vía» | sin fuente | ⛔ sin ubicar |
| «Turistas llenan Baños» | El Mercurio | ✅ `banos` *(externa)* |
| «Choque en la avenida Sucre» | El Mercurio | ⛔ sin ubicar *(interna)* |
| «La parroquia Sucre celebra» | El Mercurio | ✅ `sucre` |
| «Contaminación del río Machángara» | El Mercurio | ⛔ sin ubicar *(interna)* |
| «La parroquia Machángara estrena obra» | El Mercurio | ✅ `machangara` |
| «Cortes en Yanuncay y Totoracocha» | — | ✅ cantón, **agregada** |

### 10.4 Nomenclatura

Los nombres visibles llevan su ortografía correcta —**Cañaribamba, El Batán, Gil Ramírez Dávalos, Huayna Cápac, Machángara, San Sebastián, Baños, San Joaquín, Sayausí, Centro Histórico**— y la coincidencia sigue siendo insensible a tildes: `Machangara` y `Machángara` resuelven a la misma unidad. La forma sin tilde queda como alias.

---

## 10-ter. Evidencia enriquecida — auditoría por unidad

`/analisis` devuelve `evidenciasEnriquecidas`: cada evidencia con su URL, título, medio (nombre, dominio, tipo, cobertura, si se resolvió por nombre), fecha, motor, territorio atribuido (unidad, nivel, procedencia, confianza), temas, encuadre y **sus limitaciones concretas**.

`fecha: null` significa «la fuente no la dio». No se omite el campo —parecería que no aplica— ni se rellena con la fecha de recolección, que es el dato más peligroso de inventar en una serie temporal.

---

## 10-quater. Dimensiones de conversación pública

Declaradas en `conversationContracts.DIMENSIONES` y expuestas en `/catalogo`.

| Dimensión | Estado | Límite declarado |
|---|---|---|
| Temas | ✅ IMPLEMENTADO | Determinista: solo categorías escritas + emergentes |
| Volumen | ✅ IMPLEMENTADO | Publicaciones, no lectores |
| Evolución temporal | ✅ IMPLEMENTADO | Sin ingesta continua no separa actividad de observación |
| Medios | ✅ IMPLEMENTADO | Catálogo semilla, no mide alcance |
| Actores | ✅ IMPLEMENTADO | Requiere actores declarados; apellido suelto no cuenta |
| Tendencias | 🟡 PARCIAL | Detecta desvíos de la propia serie, no tendencia sostenida |
| Sentimiento | 🟡 PARCIAL | **No es sentimiento**: es encuadre léxico del texto |
| Comunidades | ⛔ NO | Exigiría grafo de interacción → captura de redes, excluida |
| Creadores | ⛔ NO | La web abierta devuelve medios, no creadores |
| Engagement | ⛔ NO | No hay fuente de likes/comentarios. Un proxy sería inventar |
| Influencia | ⛔ NO | Sin audiencia no hay influencia medible |

---

## 11. Qué NO hace este módulo

| | Por qué |
|---|---|
| No desagrega bajo la resolución del dato | GEO-1 · WR-D1 |
| No estima denominadores ausentes | El precedente del 238 % |
| No afirma causa | WR-D13 — solo cabe contribución y secuencia |
| No captura redes a escala | Excluido por indicación expresa |
| No mide opinión ciudadana | Mide publicación |
| No mide alcance ni audiencia | Sería una opinión con formato de métrica |
| No presenta nada como oficial | Todo el catálogo lleva `verificado:false` |

---

## 12. Registro de decisiones

| # | Decisión | § |
|---|---|---|
| GEO-D1 | GEO-1 se cumple por construcción: el agregador solo sabe subir | 3 |
| GEO-D2 | Ambigüedad **interna** vs **externa**: la cobertura del medio solo despeja la externa | 4 |
| GEO-D3 | Cobertura de fuente discriminante solo si es de provincia o más fina | 4 |
| GEO-D4 | Empate entre unidades → ancestro común con procedencia `agregada` | 4 |
| GEO-D5 | Toda consulta lleva ancla territorial; nunca el ámbito a secas | 5 |
| GEO-D6 | Modo por defecto sin coste de cuota; el módulo no se ejecuta al montarse | 6 |
| GEO-D7 | Sin denominador oficial no hay per cápita — ausencia de código, no aviso | 2 |
| GEO-D8 | Agrupación temática determinista, exigida por Replay Intelligence | 7 |
| GEO-D9 | El reparto de encuadre se calcula sobre lo determinado, no sobre el total | 7 |
| GEO-D10 | `warroom/` intacto; `territorio/` es su precursor sobre el mismo motor | 8 |

---

## 13. Pendiente

| Qué | Requiere |
|---|---|
| Mapa y coropleta | GeoJSON oficial del GAD Cuenca / INEC |
| Normalización real | Población INEC · padrón CNE |
| Verificar nomenclatura | Contraste con GAD e INEC |
| `attributionEngine.js` | Histórico para calibrar umbrales (UX-3) |
| `replayReconstructor.js` | Lake append-only ✅ + instante T (UX-3) |
| Ingesta continua | Hoy Sentinel observa bajo demanda (riesgo WR-7) |
| Montaje en el menú | 1 línea en `App.jsx` + 1 en `Sidebar.jsx` — ver §14 |

---

## 14. Montaje pendiente en la interfaz

El módulo está completo pero **no montado**: `App.jsx` estaba siendo modificado por otro trabajo en paralelo y no se tocó.

**`apps/web/src/App.jsx`** — un import y sustituir el bloque `Reservado` de `mapa`:

```jsx
import TerritorialModule from "./territorio/TerritorialModule";

// …y donde hoy está el bloque {modulo === "mapa" && <Reservado … />}:
{modulo === "mapa" && <TerritorialModule />}
```

**`apps/web/src/Sidebar.jsx`** — la entrada `mapa` pasa de reservada a operativa:

```js
{
  id: "mapa",
  texto: "Territorio",
  icono: Map,
  estado: "operativo",
  nota: "Inteligencia territorial y conversación pública. Mapa pendiente del GeoJSON oficial."
}
```

---

## 15. Referencias

- `docs/architecture/War-Room-Operacional.md` (UX-WR-001 v2.0, **congelado**) — origen de GEO-1, las procedencias, la paleta y los nombres de archivo. **Se aplica; no se modifica.**
- `docs/architecture/Sentinel-Decision-Intelligence.md` (ARQ-SDI-000) — este módulo cubre dos de sus seis fuentes pendientes.
- `docs/architecture/Protocolo-Universal-de-Investigacion.md` (ARQ-PUI-001) — regla congelada «nunca mezclar medios con cuentas oficiales».
- `docs/auditorias/AUD-001-Discovery-Planner-Pedro-Palacios.json` — el fallo de homónimo cuya versión territorial cierra §5.
- `docs/constitution/` — Cap. 9 (IA1 explicabilidad, IA2 human-in-the-loop), Cap. 10 (DT3 linaje). **Se aplica; no se modifica.**

---

*Fin de ARQ-GEO-001 v1.0. Implementado sin datos oficiales, con las carencias declaradas en cada respuesta.*
