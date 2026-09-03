# TERRITORIAL-SOCIAL-BENCHMARK-01

**Escucha social real y acotada para Cuenca — YouTube Data API v3 y X API v2**

Terminal 2 · Territorial Intelligence
Ejecutado: 2026-09-03 · Instante del benchmark: `2026-09-03T20:26:24.291Z`
Ventana observada: 7 días · `2026-08-28T05:00:00.000Z → 2026-09-04T04:59:59.999Z` (días calendario `America/Guayaquil`)

---

## 1. Objeto y pregunta

No se pregunta «¿podemos traer posts?». Eso ya se sabía. Se pregunta:

> **¿Qué aporta la escucha social que el corpus web no tenía ya?**

Contenido nuevo, actores nuevos, diversidad de emisores, piezas territorialmente resolubles. Volumen por volumen no es una respuesta.

La conclusión corta: **aporta actores reales que no estaban** —Unsión TV, W Radio, Bomberos de Cuenca, CNE Azuay, ECU911 Austro— **y a la vez rompe el guardarraíl territorial** que aguantaba bien con RSS. Las dos cosas son ciertas y la segunda es la más importante de este gate.

---

## 2. Precondición: credenciales

Antes de gastar una sola llamada se inspeccionó `estadoAdapters()` y `estaConfigurado()` de cada adaptador.

| Motor | `estaConfigurado()` | Variable | Estado |
|---|---|---|---|
| `rss_directo` | — | ninguna | CONFIGURADO |
| `gdelt_doc` | — | ninguna (API abierta) | CONFIGURADO |
| `youtube_data` | `true` | `YOUTUBE_API_KEY` (39 car.) | CONFIGURADO |
| `x_api` | `true` | `X_BEARER_TOKEN` (116 car.) | CONFIGURADO |
| Brave | `true` | `BRAVE_API_KEY` (31 car.) | CONFIGURADO |

Ninguna clave se imprimió: solo presencia y longitud.

### 2-bis. CORRECCIÓN DE DOS INFORMES ANTERIORES

En **TERRITORIAL-OPEN-LISTENING-EXPANSION-01** y en **TERRITORIAL-CREDENTIAL-ACTIVATION-01** reporté estas credenciales como **AUSENTES**. **Eso era falso.**

La causa fue mía: mis comprobaciones con `node -e` nunca llamaban a `dotenv.config()`, que sí ejecuta `server.js`. Leí un `process.env` vacío y concluí que el `.env` no las tenía. Las tres claves llevaban ahí todo el tiempo.

Consecuencias que hay que dar por corregidas:

- La matriz de cobertura marcaba **«Web abierta = REQUIERE_PROVEEDOR»**. Era incorrecto: Brave está configurado.
- Cualquier recomendación de «contratar un proveedor porque no hay credenciales» partía de un hecho falso.

El fallo no fue del sistema, fue de mi método de verificación. Una comprobación que no reproduce el arranque real del servidor no comprueba nada.

---

## 3. Presupuesto: autorizado frente a consumido

| Recurso | Autorizado | Consumido | Coste |
|---|---|---|---|
| YouTube `search.list` | 5 búsquedas | **5** | 500 de 10 000 unidades/día (5 %) |
| X `recent search` | 2 búsquedas | **2** | 2 peticiones |
| ScrapeCreators | 0 créditos | **0** | $0 |
| Data365 | prohibido | no invocado | — |
| GDELT pagado | prohibido | no invocado | — |
| Proveedores nuevos | prohibido | ninguno | — |
| **Total monetario** | — | — | **$0** |

Los topes se aplicaron en el propio script del benchmark, no por disciplina al teclear.

---

## 4. Resultado por consulta — YouTube

| Etiqueta | Estado | Brutas | Únicas | Canales | Unidades |
|---|---|---|---|---|---|
| `yt:neutral:base` | OK | 15 | 14 | 9 | 100 |
| `yt:neutral:noticias` | OK | 15 | 14 | 4 | 100 |
| `yt:institucional` | OK | **0** | 0 | 0 | 100 |
| `yt:cultura` | OK | **0** | 0 | 0 | 100 |
| `yt:ciudadano` | OK | **0** | 0 | 0 | 100 |

Tres consultas devolvieron **cero con éxito**: `OK` con `brutas=0`. No es un fallo y no se cuenta como fallo. Es el resultado más honesto del cuadro: *se preguntó y no había nada en la ventana*, que es distinto de *no se preguntó*.

## 5. Resultado por consulta — X

| Etiqueta | Estado | Brutas | Únicas | Ventana del proveedor |
|---|---|---|---|---|
| `x:neutral:base` | OK | 25 | 25 | 7 días |
| `x:ciudadano` | OK | 25 | 25 | 7 días |

Ambas llegaron al tope de 25 pedido. **Que se tope no significa que eso sea todo lo que existe**: significa que se pidió 25. No se puede inferir volumen total de la conversación desde un tope propio.

---

## 6. Persistencia

```
observadas 78 · NUEVAS 78 · duplicadas 0 · corpus previo 431
después: evidencias 421 · observaciones 1232
```

78 de 78 nuevas. Cero solapamiento con el corpus web: **la escucha social no repitió nada que ya estuviera**. Ese es el argumento más fuerte a favor de mantenerla.

| Plataforma | Evidencias |
|---|---|
| `web` | 353 |
| `x` | 47 |
| `youtube` | 21 |

---

## 7. Actores: 18 → 62

| Certeza | Actores |
|---|---|
| `COMPROBADO` | 18 |
| `DESCUBIERTO` | 44 |

Los 44 nuevos entran **todos** como `DESCUBIERTO`. Ninguno se promovió automáticamente: `VERIFICADO_POR_ANALISTA` solo lo firma una persona.

Hallazgos genuinos de Cuenca que el corpus web no tenía:

| Actor | Evidencias |
|---|---|
| `youtube:UCOw8…` Unsión TV | 13 |
| `x:229468495` WRadioEc | 11 |
| `x:1787285013093904384` cuencanosunidos | — |
| `x:2525848868` Bomberos_Cuenca | — |
| `x:720510248` CNEAzuay | — |
| `x:589368561` ECU911Austro | — |
| `x:35058064` elmercurioec | — |

Bomberos, CNE Azuay y ECU911 Austro son instituciones del cantón que **no publican RSS legible**. Por eso no estaban. Esto es exactamente el hueco que la escucha social cubre.

---

## 8. EL DEFECTO: «cuenca» es también un sustantivo común

Este es el hallazgo central del gate y contradice la cifra que yo iba a publicar.

La lectura ingenua del benchmark era **«62 de 78 evidencias con territorio explícito»**. Al auditar la lista de actores aparecieron cuentas de Perú, Cuba, Chile, Uruguay, México, Argentina y España. Se investigó antes de reportar el titular.

**Causa.** «Cuenca» es tres cosas simultáneamente:

1. el cantón de Azuay;
2. una ciudad de España;
3. un **sustantivo común** del castellano: *cuenca hidrográfica*, *cuenca del río*, *cuenca minera*, *cuenca del ojo*.

La regla del resolutor `topónimo "Cuenca" presente en el texto (+40)` es ciega a esa ambigüedad. Y el resolutor **ya lo sabía**: otorgó +40/+12 sin el bonus «topónimo no ambiguo +25». Sabía que el término es ambiguo y atribuyó igual.

**Falsos positivos confirmados a mano:**

| Cuenta | Contenido real | Lugar real |
|---|---|---|
| `@larepublica_pe` | racionamiento de agua | Lambayeque, Perú |
| `@RadioHabanaCuba` | «fuente de abasto de agua Cuenca Sur» | La Habana, Cuba |
| `@aguasaraucania` | gestión de agua | Pucón, Chile |
| `@MAmbienteuy` | ambiente | Uruguay |
| `@prensaobrera` | conflicto laboral | Jujuy, Argentina |
| `@eltoquecom` | — | La Habana, Cuba |
| `@LCAlatorre` | — | Nuevo León, México |
| `@JoseMartinBuroM` | Cortes de Castilla-La Mancha | España |
| `@sinfonicaLoja` | — | Loja, Ecuador |
| `@arelibiciteka` | *«"cuenca" es un término…»* | ninguno: habla del vocablo |

La última merece subrayado: el texto **explica que «cuenca» es un término técnico**, y el sistema lo contó como una pieza sobre el cantón.

**Cuantificación.**

```
evidencias sociales                                    68
ubicadas por el resolutor                              55
  con anclaje corroborante (Azuay/Ecuador/parroquia)   30
  SOLO por la palabra ambigua «cuenca»                 25   <-- frágiles
```

**Los 25 son una cota superior de sospechosos, no 25 falsos positivos confirmados.** Varios son Cuenca de verdad: Unsión TV sobre la Policía en centros educativos, «Tres concejales de Cuenca», los fotorradares de WRadioEc, la feria de El Arenal. Entre 9 y 11 de los 25 son claramente foráneos o hablan de cuencas hidrográficas.

**Por qué el guardarraíl aguantó con RSS y se rompió aquí.** El universo RSS lo publican medios ecuatorianos: el contexto desambigua gratis. La búsqueda social es global por construcción y trae el mundo entero. **El guardarraíl no era robusto, tenía suerte.**

---

## 9. Lo que se hizo con el defecto — y lo que NO

Se probó la corrección evidente: **exigir un segundo anclaje** (Azuay, Ecuador, una parroquia, una institución del cantón) para aceptar la atribución.

**Esa regla falla.** Rechaza contenido genuino de Cuenca —Unsión TV, WRadioEc, El Arenal— porque ninguno repite «Azuay»: no le hace falta a su audiencia. Cambiaría **25 falsos positivos medidos por un número desconocido de falsos negativos**.

Así que en este gate **no se decide: se declara**. En `territorialScope.js`:

- `esTerminoAmbiguo(t)` — lista corta y explícita, no deducida.
- `evaluarAmbiguedad({ razones, texto })` — lee la razón del resolutor y comprueba corroboración **sobre el texto de la pieza, nunca sobre la consulta**.
- La clasificación A viaja con `senalAmbigua`, `terminosDeLaAtribucion`, `corroboradoPorOtroAnclaje` y `advertenciaAmbiguedad`.
- `resumirAlcance` expone **`atribuidasSoloPorTerminoAmbiguo`**.

**La atribución se mantiene** (`territorioAtribuible: true`). Marcar no es descartar. Hay una prueba que fija ese comportamiento a propósito, para que nadie lo «arregle» sin medir.

Un error visible se corrige; uno silencioso, no. La desambiguación real —país del emisor, contexto de la cuenta, coocurrencia de topónimos— necesita su propio gate con su propio diseño y su propia medición.

---

## 10. Aislamiento de proyecto

```
proyecto A (cuenca-2027): 421 evidencias
fixture B:                  0        <-- correcto
```

La prueba de mutación de `territorial-project` sigue en pie: si se quita `projectId` del registro, el aislamiento debe romperse y la prueba debe fallar.

---

## 11. Concentración de emisores

| Emisor | Evidencias |
|---|---|
| expreso.ec | 79 |
| extra.ec | 76 |
| teleamazonas | 40 |
| elmercurio | 22 |
| unsion.tv | 16 |
| `youtube:UCOw8…` | 13 |

Los dos primeros son medios **nacionales**. El corpus sigue pesando hacia lo nacional: no es un fallo del resolutor, es la composición del universo de fuentes.

---

## 12. Lo que estas cifras NO permiten afirmar

- ❌ Que X o YouTube «representan la conversación de Cuenca». Son dos plataformas, dos y cinco consultas, siete días, topes propios.
- ❌ Penetración, población, padrón o porcentajes poblacionales.
- ❌ Intención de voto.
- ❌ «Lo más visto en Cuenca». Como máximo: *lo más visto en la muestra observada*.
- ❌ Residencia del autor. No se infiere de nada.
- ❌ Coordenadas o parroquia inventadas.
- ❌ Que 25 evidencias frágiles sean 25 falsos positivos. Es una cota superior.

`claimGuard.js` bloquea las prohibidas por regex con motivo y alternativa.

---

## 13. Privacidad

Fuera de alcance y no ejecutado: rastreo de individuos, dossiers de ciudadanos, dispositivos, perfiles privados, atributos sensibles, microsegmentación política, inferencias individuales de comportamiento.

Solo cuentas **públicas e institucionales o de medios**. `atributosSensibles: null` por decisión. Las firmas se minimizan con `firmaMinimizada` antes de persistir: el dominio de un correo se descarta en el punto de escritura, no al mostrar.

---

## 14. Observación de interfaz: los tuits no tienen título

Las evidencias de X llegan con `title` vacío —un tuit no tiene titular— y el texto vive en `summary`, que es justamente lo que lee el resolutor. Funciona para clasificar, pero cualquier vista que pinte `title` mostrará filas en blanco. Anotado como consideración de UI, no corregido en este gate.

---

## 15. Pruebas

| Suite | Pruebas |
|---|---|
| `territorial-sources` | 61 |
| `territorial-rotation` | 42 |
| `territorial-topic` | 49 |
| `territorial-project` | 29 |
| `territorial-coverage` | 45 |
| `territorial-expansion` | 29 |
| `territorial-listening` | 31 |
| `territorial-social` | **36** (30 + 6 de ambigüedad) |
| `socialProviders` (Candidate) | 35 · intacta |
| **Total** | **357 · 0 fallos** |

Las seis nuevas: reconocimiento del término ambiguo; marcado de la atribución frágil; no-marcado cuando hay segundo anclaje; no-marcado con topónimo no ambiguo; **la atribución no se revierte**; el resumen cuenta las frágiles aparte.

Toda la batería corre con el `fetch` global contado: cero llamadas de red.

`npm run build` correcto. `npm run lint`: 6 errores, todos preexistentes en `Dashboard.jsx` (5) y `KnowledgeGraph.jsx` (1), ajenos a este gate. `TerritorialWorkspace.jsx` limpio.

---

## 16. Veredictos

### `SOCIAL_LISTENING_VALUE = MEDIO`

**A favor:** 78 de 78 evidencias nuevas, cero duplicadas. 44 actores nuevos, con instituciones del cantón que no publican RSS. Coste $0 con 5 % de la cuota diaria de YouTube.

**En contra:** de 68 evidencias sociales, 25 atribuciones territoriales son frágiles y una parte confirmada es de otros países. Tres de cinco consultas de YouTube devolvieron cero. Dos consultas de X toparon en su propio límite, así que no se conoce el volumen real.

No es ALTO porque la mitad de la atribución territorial no se sostiene. No es BAJO porque los actores nuevos son reales y verificables uno a uno.

### `TERRITORIAL_OPEN_LISTENING_READINESS = PARCIAL`

Los conectores funcionan, están dentro de presupuesto y persisten con trazabilidad. **La resolución territorial sobre contenido social no está lista.** No es un ajuste de umbral: es un problema de desambiguación que necesita diseño propio.

---

## 17. Las siete preguntas

**1. ¿Aporta la escucha social contenido que el corpus web no tenía?**
Sí, sin ambigüedad. 78 de 78 nuevas, cero solapamiento.

**2. ¿Aporta actores nuevos?**
Sí. 18 → 62. Unsión TV, WRadioEc, Bomberos de Cuenca, CNE Azuay, ECU911 Austro. Todos `DESCUBIERTO`, ninguno promovido solo.

**3. ¿Es el contenido territorialmente resoluble?**
**Peor de lo que parecía.** 55 de 68 «ubicadas», pero 25 descansan únicamente en una palabra ambigua. La cifra utilizable es 30, no 62.

**4. ¿Se mantuvo el presupuesto?**
Sí. 5 YouTube, 2 X, 0 ScrapeCreators, $0.

**5. ¿Se puede decir que esto representa la conversación de Cuenca?**
No. Dos plataformas, siete consultas, siete días, topes propios. Decirlo sería inventar cobertura.

**6. ¿Hay riesgo de privacidad en lo recolectado?**
Bajo y acotado: cuentas públicas institucionales y de medios, firmas minimizadas, sin atributos sensibles ni inferencias individuales.

**7. ¿Está listo para producción?**
Los conectores sí. La atribución territorial sobre contenido social **no**. Publicar «62 con territorio explícito» sería publicar un número inflado.

---

## 18. Recomendación

Mantener ambos conectores activos con el presupuesto actual —el coste es cero y los actores nuevos son valiosos— y **no publicar métricas territoriales de origen social** hasta que exista un gate de desambiguación que mida sus propios falsos positivos y falsos negativos.

## 19. Estado del documento

Escrito después de ejecutar el benchmark y después de auditarlo. La cifra de titular que este gate iba a reportar —62 de 78— **no sobrevivió a su propia auditoría**, y esa es la razón de que este documento exista.
