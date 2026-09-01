# TERRITORIAL-LOCAL-SOURCE-EXPANSION-01

## Ampliar el universo local de fuentes de Cuenca

**Fecha:** 2026-09-01
**Proyecto:** `alcaldia-cuenca-2027-piloto`
**Coste:** **0 USD** · solo HTTP público · sin credenciales, sin proveedores de pago

---

## 1. Baseline

Al abrir el gate, medido sobre el ledger:

| | |
|---|---|
| Evidencias del proyecto | 284 |
| Observaciones | 689 |
| Dominios en el corpus | 11 |
| Fichas en el universo | 28 |
| Feeds elegibles | 11 |
| **Fuentes locales con feed** | **6** |
| Territorio explícito (A) | 107 |
| Fuente local sin topónimo (B) | 4 |
| Nacional relacionado (C) | 173 |

Las 6 locales: El Mercurio, Unsión TV, EMAC EP, EMOV EP, ETAPA EP, Prefectura del Azuay.
Solo **dos** eran medios; el resto, instituciones.

**Diagnóstico de partida:** 202 de 284 evidencias venían de cuatro medios nacionales
(Extra 76, Expreso 74, Teleamazonas 40, Plan V 12). No por fallo del pipeline: porque
apenas había fuentes locales que ocuparan las plazas de rotación.

---

## 2. Descubrimiento: qué se intentó y qué se encontró

### El registro oficial existe pero no es alcanzable

El **Consejo de Comunicación del Ecuador** publica un listado oficial de medios
registrados (`LISTADO-DE-MEDIOS-DE-COMUNICACION`, PDF actualizado). Sería la fuente
autoritativa que este proyecto lleva declarando que nunca consultó.

**No es alcanzable desde esta máquina.** Medido en tres URLs:

```
consejodecomunicacion.gob.ec/                        UND_ERR_CONNECT_TIMEOUT  10.670 ms
…/2025/06/LISTADO-DE-MEDIOS-…-JUNIO-2025.pdf         UND_ERR_CONNECT_TIMEOUT  10.622 ms
…/2025/01/LISTADO-DE-MEDIOS-…-2024.pdf               UND_ERR_CONNECT_TIMEOUT  10.584 ms
```

Fallo en fase de **conexión**, reproducible: el mismo bloqueo de red que afecta a GDELT.
Queda como pendiente accionable: el usuario puede descargar el PDF y pasarlo.

### Google News como descubridor de fuentes — el hallazgo contraintuitivo

Método (D) del gate: 3 consultas RSS gratuitas sobre Cuenca, **300 piezas, 40
publicadores distintos**. Coste 0.

```
74  elmercurio.com.ec        21  Ecuavisa            4  eltelegrafo.com.ec
69  Primicias                10  Metro Ecuador       3  MSN
34  El Universo               8  elcomercio.com      6  Ecuador 221
23  expreso.ec                7  extra.ec            6  Vistazo
```

> **El agregador no revela ningún medio local nuevo de Cuenca.** Su cobertura del cantón
> está dominada por El Mercurio y por medios nacionales. Y al revés: `eltiempo.com.ec`,
> `lavozdeltomebamba.com` y `unsion.tv` **no aparecen** entre los 40 publicadores.

La conclusión importa para la estrategia: **los feeds directos dan más cobertura local
que el agregador**. El ecosistema local de Cuenca visible a agregadores es genuinamente
delgado; no es que Sentinel lo estuviera pasando por alto.

### Una corrección al catálogo semilla

`radiotomebamba.com.ec` —entrada del catálogo— da **ENOTFOUND**. Las guías de radio
públicas apuntan a la misma emisora (102.1 FM Cuenca) con el dominio
`lavozdeltomebamba.com`, que **sí responde y publica feed**.

El catálogo tenía el dominio equivocado. Corregido con evidencia, no por suposición.

---

## 3. Fuentes nuevas comprobadas

Verificación real: **106 peticiones HTTP** (30 robots.txt, 45 portadas, 31 feeds) + 13
en una segunda pasada. **0 USD.**

| fuente | dominio | veredicto | feeds útiles |
|---|---|---|---|
| **La Voz del Tomebamba** | `lavozdeltomebamba.com` | **VERIFICADO_FEED** · reclasificada a **MEDIO_LOCAL** | 2 |
| **Farmasol EP** | `farmasol.gob.ec` | **VERIFICADO_FEED** · institución local | 1 |
| **EMUVI EP** | `emuvi.gob.ec` | **VERIFICADO_FEED** · institución local | 1 |
| Cuerpo de Bomberos | `bomberos.gob.ec` | VERIFICADO_FEED · **ámbito no confirmado** | 1 |

La reclasificación de La Voz del Tomebamba es la más barata y la más rentable: ya
aportaba 10 evidencias, contadas como «nacional / sin declarar» **solo porque nadie la
había clasificado**.

`bomberos.gob.ec` responde y publica feed, pero **no se le declaró cobertura cantonal**:
puede ser nacional y no se confirmó. Entra al universo sin territorio.

## 4. Fuentes rechazadas, y por qué

| dominio | veredicto | motivo |
|---|---|---|
| `ecuador221.com` | INACCESIBLE | **ENOTFOUND** — el dominio no existe. Apareció 6 veces en el agregador con otro dominio |
| `radiotomebamba.com.ec` | INACCESIBLE | **ENOTFOUND** — entrada errónea del catálogo |
| `eltiempo.com.ec` | INACCESIBLE | **ECONNRESET** reproducible, con y sin `www`. Diario real de Cuenca desde 1955: **el hueco más molesto** |
| `ondacero.com.ec` | INACCESIBLE | ENOTFOUND |

## 5. Sitios comprobados SIN feed — registrados, no inventados

**Nueve** fuentes responden y **no publican feed**. No se les fabrica uno:

```
cuenca.gob.ec          GAD Municipal de Cuenca      ← la más relevante que falta
deportivocuenca.com    Deportivo Cuenca             ← el club existe, sin RSS
uazuay.edu.ec          Universidad del Azuay
primicias.ec · elcomercio.com · eltelegrafo.com.ec · vistazo.com
laposta.ec · ecuadorinmediato.com
```

Vía futura para todas: web abierta (Brave/SerpAPI), Google News, sitemap, o un conector
legítimo. Alimenta el coverage audit como `NO_PUBLICA_RSS`, que es un hecho sobre el
sitio y no un fallo nuestro.

`ucuenca.edu.ec` queda en `VERIFICADO_SIN_FEED`: declara feed y **responde vacío**. Un
feed abandonado no es lo mismo que no tener feed.

---

## 6. Antes / después

| | ANTES | DESPUÉS | CAMBIO |
|---|---|---|---|
| Fichas en el universo | 28 | **33** | +5 |
| Feeds elegibles | 11 | **15** | +4 |
| **Fuentes locales con feed** | **6** | **9** | **+3** |
| Medios locales con feed | 2 | **3** | +1 |
| Instituciones locales con feed | 4 | **6** | +2 |
| Fuentes con territorio declarado | 13 | **16** | +3 |
| Dominios en el corpus | 11 | **14** | +3 |
| Actores | 11 | **14** | +3 |
| Evidencias del proyecto | 284 | **319** | +35 |
| Observaciones | 689 | **922** | +233 |
| Con resumen | 283 | 318 | +35 |
| Con fecha | 284/284 | **319/319** | — |
| Territorio explícito (A) | 107 | **127** | **+20** |
| Fuente local sin topónimo (B) | 4 | **12** | +8 |
| Nacional relacionado (C) | 173 | **180** | +7 |
| No resoluble (D) | 0 | **0** | — |
| Señales | 377 | 403 | +26 |

**Ratio local / nacional** (A+B frente a C, en conteo absoluto):

```
ANTES     111  vs  173
DESPUÉS   139  vs  180
```

El peso local sube en términos absolutos y relativos, sin inflar volumen: **de las 35
evidencias nuevas, 28 vinieron de las tres fuentes nuevas** en su primera pasada.

### La rotación se llenó de fuentes locales

Antes, con 6 locales, los nacionales ocupaban plazas por falta de alternativas. Ahora,
en la pasada 16, las 8 plazas fueron: El Mercurio, Unsión TV, **La Voz del Tomebamba**,
EMAC, Prefectura del Azuay, EMOV, ETAPA, **EMUVI** — **8 de 8 territoriales**.

### Observación real, tres pasadas

```
pasada 15 · ciclo 7 · 4 feeds    28 obs   28 nuevas    0 dup   ← las 3 fuentes nuevas
pasada 16 · ciclo 8 · 8 feeds    74 obs    2 nuevas   72 dup   ← 8/8 territoriales
pasada 17 · ciclo 8 · 6 feeds   131 obs    5 nuevas  126 dup
                                 corpus: 284 → 319
```

Las fuentes nuevas entraron **primero** —nunca se habían intentado— y el dedup absorbió
198 repeticiones sin duplicar nada. Un feed inaccesible (`gk.city`) no tumbó el ciclo.

---

## 7. Temas nuevos

Aparecen dos asuntos de dominio que antes no estaban en cabeza:

- **Agua y saneamiento** — 10 evidencias, **7 fuentes**, 3 territorios
- **Ambiente y territorio** — 9 evidencias, 5 fuentes, 2 territorios

Coherente con las fuentes nuevas: ETAPA (agua), EMAC (aseo), EMUVI (vivienda), Farmasol.

**NO aparecen**, y se dice: Deportivo Cuenca (su sitio no publica feed), cultura,
universidad (feed vacío), comercio, turismo, clima, eventos, entretenimiento, moda,
marcas. Siguen viviendo en plataformas que no observamos.

## 8. Geografía

Se mantiene la regla sin aflojarla: **fuente local ≠ territorio de la pieza**. B pasó de
4 a 12 —más fuentes locales, más piezas suyas sin topónimo— y **ninguna se atribuye al
cantón**. Hay una prueba explícita de que ampliar el universo no convierte C en A.

## 9. Fragmentación

**403 señales para 319 evidencias.** Sigue habiendo más señales que piezas.

Corrección pequeña y contenida aplicada: nuevo tipo **`GENERICO`** para tokens que
aparecen en cualquier noticia. Medido en el corpus real: «caso» 9, «autoridades» 10,
«país» 9, «cerca» 8. La lista se declara en `topicTerritoryCrosstab.js` y **no** en
`stopConcepts.js`, que es compartido y cambiaría el comportamiento de otros gates.

Regla igual que `LUGAR` y `TEMPORAL`: **todos** los tokens deben ser genéricos. «caso
Serrano» sigue siendo un tema. Y hay una prueba de que el descubrimiento **sigue siendo
abierto**: «Deportivo Cuenca», «festival de artes escénicas» y «lluvias e inundaciones»
se clasifican como TEMA aunque no estén en ninguna lista.

Persisten residuos verbales («deja», «después», «paso», «mantiene»). **Exige rediseño
del motor de descubrimiento: queda para `TERRITORIAL-TOPIC-NORMALIZATION-01`.**

## 10. Gaps restantes

| gap | qué lo cierra |
|---|---|
| `cuenca.gob.ec` sin feed — el GAD Municipal | web abierta o sitemap |
| `eltiempo.com.ec` ECONNRESET | diagnóstico de red, o vía alternativa |
| Registro oficial de medios inalcanzable | descarga manual del PDF |
| Deportivo Cuenca, cultura, turismo, comercio | plataformas sociales |
| Creadores, comunidades, comentarios | proveedor |
| Fragmentación de señales | rediseño del motor |
| Tendencias | tiempo observando |

## 11. Impacto en los proveedores

**GDELT — ¿sigue justificándose? SÍ, pero con menos fuerza que antes.**
Su valor era doble: geo explícita e histórico. El geo **pesa menos ahora**: el problema
medido no era geocodificar sino tener fuentes locales, y eso se movió sin proveedor (A:
107→127). El histórico sigue siendo un argumento intacto. Y su vía DOC API sigue
inalcanzable desde esta máquina, así que solo serviría por BigQuery.

**Data365 — ¿sigue justificándose? SÍ, sin cambios.**
Este gate no tocó su hueco. Creadores, comunidades y comentarios siguen en
`NO_DISPONIBLE`, y este gate **confirmó que no hay ruta alternativa**: el agregador no
revela actores locales y las plataformas no permiten descubrimiento por territorio. Es
la única dimensión que sigue ausente por completo.

**ScrapeCreators — no para descubrimiento territorial.**
Sirve para **activos públicos conocidos**. Podría ser útil *después* de tener una lista
curada de cuentas locales, no para encontrarlas. **0 créditos gastados.**

## 12. Siguiente gate

**`TERRITORIAL-TOPIC-NORMALIZATION-01`.** El universo local creció lo que se podía
mover sin proveedor ni credencial: quedan 9 sitios comprobados sin feed y un registro
oficial inalcanzable. El cuello de botella se ha desplazado de las **fuentes** a la
**señal**: 403 señales para 319 evidencias hace que la agenda no sea legible, y eso ya
no se arregla con umbrales.

---

## Requests y coste

| operación | peticiones |
|---|---|
| Verificación de fuentes (robots + portadas + feeds) | 106 + 13 |
| Descubrimiento vía Google News RSS | 3 |
| Registro oficial (fallidos) | 3 |
| Lecturas de feed en 3 pasadas | 18 |
| **Google News · YouTube · GDELT · SerpAPI · Brave · Data365 · ScrapeCreators** | **0 de pago** |
| **COSTE TOTAL** | **0 USD** |

## Pruebas

`territorial-expansion` **29** nuevo. Territorial completo: **742** en 12 suites. SSR
127 · render con datos reales 15 = **884**. Cero regresiones.

## Fuentes consultadas

- [Consejo de Comunicación del Ecuador — Listado de medios (inalcanzable desde esta máquina)](https://www.consejodecomunicacion.gob.ec/wp-content/uploads/2025/06/LISTADO-DE-MEDIOS-DE-COMUNICACION-JUNIO-2025.pdf)
- [El Tiempo (Ecuador) — Wikipedia](https://en.wikipedia.org/wiki/El_Tiempo_(Ecuador))
- [La Voz del Tomebamba, 102.1 FM, Cuenca — TuneIn](https://tunein.com/radio/La-Voz-del-Tomebamba-1021-s103041/)
- [La Voz del Tomebamba, 1070 kHz AM, Cuenca — Online Radio Box](https://onlineradiobox.com/ec/lavozdeltomebamba/?lang=en)
- [Telecuenca / AcademiaTV — cerrada en 2025](https://en.wikipedia.org/wiki/Telecuenca)
