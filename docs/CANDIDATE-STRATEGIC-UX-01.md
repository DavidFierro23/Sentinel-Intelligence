# CANDIDATE-STRATEGIC-UX-01 — Candidate como inteligencia estratégica

**Fecha:** 2026-09-03
**Commit base UX:** `8346ed3` (SENTINEL-UX-CONSOLIDATION-01)
**Commit base Candidate:** `07fc51c` (P-CAND-OPERATIONAL-CLOSURE-01)

Gate de UX. **No se tocó ningún motor de recolección, ningún cálculo y ningún
conector.** Cero peticiones externas, cero créditos.

---

## 1. El hallazgo que ordenó el gate

Las ocho dimensiones estratégicas **ya existían en el backend**, completas y con
estados honestos. `GET /:proyecto/candidatos/:id/inteligencia` devuelve
`presencia`, `conversacion`, `amplificacion`, `medios`, `territorio`,
`historico`, `temas` y `evidencias`.

La ficha del candidato no consumía **ninguna**. Mostraba `huellaDigital`, es
decir «Solidez 68/100».

Y la línea base —estado por plataforma, comparabilidad, momentum— estaba
disponible en un endpoint que responde en **21 ms sin salir a la red**, escondida
detrás de un botón al final de la página: «Ver línea base digital».

**El problema nunca fue falta de datos. Era jerarquía.** Lo estratégico estaba
enterrado y lo técnico era el titular.

---

## 2. Jerarquía de KPI

| | Antes | Ahora |
|---|---|---|
| **Titular de la ficha** | `Solidez 68/100`, cian, junto al nombre | Las seis dimensiones |
| **Comparación** | Lista ordenada por cobertura, con barra de color | Matriz candidato × dimensión |
| **Cobertura de datos** | *era* el KPI | Línea gris en el segundo nivel + última columna marcada «indicador técnico» |
| **Momentum** | no aparecía | `HISTÓRICO INSUFICIENTE`, con el motivo del backend |

---

## 3. Solidez → Cobertura de datos

El cálculo **no se toca**. Cambia el nombre, el tamaño y el sitio.

«Solidez del expediente» describe bien lo que mide, pero abreviado a «Solidez»
junto al nombre de una persona y con un número grande al lado, se leía como
solidez **del candidato**. La pregunta que generaba era exactamente la que el
gate cita: «¿68 % de qué? ¿este va mejor?».

El nombre vive en **un solo sitio** (`METRICA` en `identidadCandidato.js`), que
es lo que permite que el cambio alcance también a la ficha de identidad. Tenerlo
duplicado fue lo que había permitido que el mismo 68 % apareciera en dos
formatos.

Aclaración asociada: *«Indica cuánto del expediente digital observable dispone
Sentinel. No mide desempeño electoral. No representa intención de voto,
aprobación, popularidad ni apoyo ciudadano.»*

---

## 4. Las seis dimensiones

`src/candidato/dimensionesEstrategicas.js` traduce campos que ya existían. **No
calcula ninguna métrica nueva.**

| Dimensión | Fuente | Estado en el piloto |
|---|---|---|
| Presencia digital | `linea-base.cobertura` | **5 de 5 plataformas medidas** |
| Conversación observable | `inteligencia.conversacion` | **147 piezas observadas** |
| Amplificación mediática | `inteligencia.medios` | **23 medios distintos** |
| Territorio | `inteligencia.territorio` | `SIN DATOS` — sin contrato GEO-1 |
| Cambio temporal | snapshots por cuenta | `PARCIAL` — 2 de 9 activos reobservados |
| Momentum | `linea-base.momentum` | `HISTÓRICO INSUFICIENTE` |

Ninguna se combina con otra. No hay total, promedio ni índice: el propio backend
ya se niega a producirlo — `presencia.indice` llega con `disponible:false` y cinco
requisitos sin cumplir.

### «Sin calcular» ≠ «Sin datos»

Conversación, medios y territorio se calculan por candidato. Hasta que se abra su
inteligencia aparecen como **«sin calcular»**, no como «sin datos»: afirmar que no
hay conversación observable sin haber mirado sería una afirmación falsa sobre esa
persona. En el piloto hay 147 piezas.

---

## 5. ⚠️ El delta que no se puede mostrar

**El hallazgo técnico más importante del gate.**

`inteligencia.historico.ventanas[].delta` **no es una tendencia del candidato y
no se usa.**

Para Lloret la ventana de 7 días declara `followers: -29053` y la de 30 días
`+334`, sobre periodos que contienen los mismos hechos. Aritméticamente imposible
en una serie real de audiencia.

El motivo, comprobado sobre los snapshots del piloto: el delta resta el último
snapshot menos el primero de la ventana, y esos dos snapshots son de **cuentas y
plataformas distintas**.

```
primero  2026-08-26  youtube:jotalloretv             26
ultimo   2026-09-03  instagram:lloretvaldivieso     360
------------------------------------------------------
delta                                              +334
```

El `+334` es 360 seguidores de una cuenta de Instagram menos 26 de un canal de
YouTube. El `−29.053` de la ventana de 7 días es esa misma cuenta de 360 menos
los 29.413 seguidores de X.

Pintado en una tarjeta, un estratega leería **«perdió 29.000 seguidores esta
semana»**. No perdió nada: cambió qué cuenta se observó al final.

El cambio se expresa entonces en lo único defendible hoy: **cuántos activos
tienen más de una observación**, agrupando por `accountId`. Es un recuento, no una
tendencia, y se nombra así. Hay test que falla si el `−29.053` aparece.

Corregir el campo en el backend es trabajo de un gate de Candidate, no de este.
Queda en gaps.

---

## 6. La comparación ya no es un ranking

Lo que había: lista ordenada por `cobertura` descendente, con barra de progreso y
color por tramos (verde ≥70, ámbar ≥50, rojo <30).

```
Juan Cristóbal Lloret  68%  ████████████
Pedro Palacios         68%  ████████████
Yaku Pérez             63%  ███████████
Paúl Carrasco          40%  ███████
```

Llevaba disclaimer, pero el orden y la barra decían lo contrario, y eso se lee
primero. Y lo que ordenaba la lista era la completitud del expediente: **Lloret
salía arriba porque se le había observado 22 veces contra 1 de Palacios**. La
posición medía cuánto trabajo habíamos hecho nosotros.

Ahora es una matriz candidato × dimensión con tres decisiones:

1. **Orden declarado**, sin `sort`. Cualquier criterio de orden se lee como
   posición.
2. **Sin barras.** Una barra codifica magnitud sobre un máximo, y aquí no hay
   máximo: 23 medios no está «más cerca de ganar» que 12.
3. **Cobertura de datos en la última columna**, en gris, bajo una cabecera que
   dice «indicador técnico». No ordena nada.

`colorCobertura` se elimina con ella: pintaba de rojo a los candidatos peor
documentados.

---

## 7. Multi-asset, y activos adicionales

Los activos se muestran **por plataforma**, no como total: «9 activos» esconde que
dos son de Facebook. Un candidato puede tener N por plataforma y encontrar uno no
cierra el discovery.

7 cuentas **no** es mejor candidato: es más superficie observable.

**LinkedIn y web se conservan y van aparte** (§21). En el piloto: LinkedIn en 5 de
7 candidatos, web en 1. No entran en la matriz de cinco plataformas porque no
tienen medición equivalente, y sumarlos daría una cobertura que nadie ha medido.

---

## 8. Identidad ≠ medición

En el piloto los **50 activos** están en `verificationStatus: NO_VERIFICADA`,
mientras 21 son `DECLARED_BY_ANALYST` y 29 `ASSOCIATED`.

Si la ficha mostrara «no verificada» como estado principal, el analista leería
que nada de lo que escribió sirve. Son dos ejes:

| | |
|---|---|
| `DECLARED_BY_ANALYST` | «Referencia confirmada por analista» — procedencia fuerte |
| `NO_VERIFICADA` | «Sin corroborar por Sentinel» — *No significa que la cuenta sea incorrecta* |

No se inventa ningún `SYSTEM_VERIFIED`.

---

## 9. Lenguaje auditado

| Antes | Ahora | Por qué |
|---|---|---|
| «Investigación completada» | **«Observación activa»** | Candidate hace observación longitudinal: el backend sigue reobservando y acumulando snapshots después de ese estado. «Completada» sugería que Sentinel dejó de mirar |
| «Actualizar investigación» | **«Actualizar observación»** | Es lo que ejecuta: relee cuentas y escribe snapshots |
| «Investigar candidato» | **«Observar candidato»** | igual |
| «Lo observado en X y YouTube» | **«…en Facebook, Instagram, TikTok, X y YouTube»** | Se quedó escrito cuando eran las dos plataformas legibles. El backend mide las cinco desde varios gates |
| «Ver línea base digital» | **«Ver detalle por plataforma»** | El dato ya está cargado; el botón abre el detalle |

Ningún comportamiento de backend cambió con estas etiquetas.

---

## 10. Subnavegación (§17)

Nueve secciones. **Cuatro reales, cinco declaradas.**

- **Resumen · Comparación · Redes** → contenido real ya existente.
- **Contenido · Conversación · Medios · Territorio · Histórico · Evidencias** →
  `EN PREPARACIÓN`.

Las declaradas **se pueden abrir**, y al abrirlas dicen qué responderán y **dónde
vive hoy ese dato**. Esa última línea evita el malentendido: sin ella,
«Conversación · EN PREP.» se leería como «Sentinel no observa conversación»,
cuando hay 147 piezas por candidato.

No existe la vista agregada de proyecto porque exige decidir cómo —o si— se suma
entre candidatos. No es que falten los datos.

---

## 11. Project isolation

Verificado en vivo sobre los dos proyectos del Lake:

```
alcaldia-cuenca-2027-piloto  → 7 candidatos
ensayo-tipos-1787962022520   → 0 candidatos
cruce entre proyectos        → 0
```

Cada respuesta declara su `proyectoId`. Candidate sigue completamente
project-scoped y el contexto «Elecciones Alcaldía Cuenca 2027 · Cuenca · Azuay ·
Ecuador» se conserva.

---

## 12. Comprobaciones

| | |
|---|---|
| Render de Candidate (nuevo) | **69 / 69** — incluye 7 sobre el payload real |
| Render de Media | **53 / 53**, intactas |
| Render del workspace | **60 / 60**, intactas |
| Suite backend completa | **1.331**, 0 fallos |
| Suites no registradas | 40 · 28 · 32 · 31 · 25 · 5 = **161**, 0 fallos |
| Build | limpio |
| Lint | 6 errores **preexistentes** (Dashboard ×5, KnowledgeGraph ×1); 0 en mis ficheros |
| Peticiones externas | **0** · créditos **0** |

### Dos fixtures actualizados, y por qué

`fichaIdentidad.test.mjs` y `edicionIdentidad.test.mjs` fijaban
`METRICA.nombre === "Solidez del expediente"`. Los dos se actualizan al nombre
nuevo **y se refuerzan**: el invariante que importaba no era la cadena, era que la
métrica no se lea como una propiedad política del candidato. Ahora también se
exige que niegue el desempeño electoral y que el nombre no contenga
«solidez/fuerza/apoyo/respaldo».

---

## 13. Ficheros

**Nuevos** — `src/candidato/`: `dimensionesEstrategicas.js` ·
`DimensionCelda.jsx` · `DimensionesStrip.jsx` · `ComparacionEstrategica.jsx` ·
`SeccionesNav.jsx` · `SeccionEnPreparacion.jsx` · `secciones.js`
— más `tests/candidate-ux.check.jsx` y `vite.candidate-ux.config.js`.

**Modificados:** `components/ProjectsModule.jsx` ·
`services/identidadCandidato.js` · `tests/fichaIdentidad.test.mjs` ·
`tests/edicionIdentidad.test.mjs`

**No tocados:** todo `territorio/**` y `services/ingest/**` (T2 trabaja en
TERRITORIAL-COLLECTOR-EXPANSION-01), `SENTINEL_PROJECT_STATE.md`,
`apps/backend/package.json` (mezclado y con BOM), scripts y docs de T4, y
cualquier conector o motor de Candidate.

---

## 14. URL de certificación

```
http://localhost:5174/?proyecto=alcaldia-cuenca-2027-piloto&modulo=candidatos
```

### Qué comprobar visualmente

1. **No aparece «Solidez» en ningún sitio.** Ningún `68/100` grande junto a un
   nombre.
2. Debajo de cada nombre, **seis dimensiones**: Presencia `5 de 5 plataformas
   medidas`, Momentum `Histórico insuficiente`, y Conversación / Medios /
   Territorio en **«sin calcular»** hasta abrir su inteligencia.
3. Al pulsar **«Ver inteligencia»** en un candidato, esas tres se rellenan con
   valores reales (147 piezas, 23 medios, territorio `Sin datos`).
4. **Comparación**: matriz, sin barras, **sin orden por porcentaje**. Lloret (68 %)
   **no** está primero. Última columna «Cobertura de datos · indicador técnico».
5. **Ningún «−29.053»** en ninguna pantalla.
6. El chip verde dice **«Observación activa»**; el botón, **«Actualizar
   observación»**.
7. Nueve pestañas; cinco con `EN PREP.` que al abrirse explican dónde vive el dato.
8. Segundo nivel gris: `Facebook 2 · Instagram 1 · …`, `adicionales: LinkedIn 1`,
   `Cobertura de datos 68%` al final de la línea.
9. Disclaimer visible bajo el territorio del proyecto.

**Precondición:** ninguna. El backend de `:3001` sirve `/linea-base`,
`/cobertura-meta` e `/inteligencia` correctamente — verificado en vivo con los 7
candidatos reales.

---

## 15. Gaps

1. **`historico.ventanas[].delta` sigue mal en el backend** (§5). La UI ya no lo
   consume, pero el campo sigue devolviendo cifras que cruzan cuentas. Debe
   calcularse por cuenta y métrica, o retirarse. Es trabajo de backend de
   Candidate.
2. **La matriz que reporta el gate (26 MEDIDO / 3 PARCIAL / 4 SIN_CUENTA / 1
   NO_SOPORTADO / 1 IDENTIDAD_INSUFICIENTE) no es la que sirve el endpoint.**
   `/linea-base` en vivo da **30 MEDIDO + 5 SIN_CUENTA = 35**. Los estados de
   `operationalClosure.js` **no están expuestos por ninguna ruta HTTP**, así que
   la UI no puede mostrarlos. Se muestra lo que el endpoint devuelve.
3. **Las cinco secciones declaradas** no tienen vista agregada de proyecto.
4. `AccountIntelligencePanel.jsx` muestra `{c.solidez?.valor ?? 0}/100` por
   cuenta: convierte «desconocido» en 0 y conserva la palabra «solidez» en un
   panel profundo. Es una métrica distinta —fuerza de correspondencia de
   identidad—, no el KPI de la ficha. No se tocó para no ampliar el gate.
5. Las secciones se conmutan con `display:none`, no desmontando: conserva paneles
   y formularios abiertos al cambiar de pestaña, a cambio de mantener el DOM.
6. Las suites nuevas **siguen fuera de `npm test`**: `apps/backend/package.json`
   está mezclado y además tiene BOM.

---

## 16. CANDIDATE_STRATEGIC_UX_READINESS

**`READY_FOR_HUMAN_CERTIFICATION`**
