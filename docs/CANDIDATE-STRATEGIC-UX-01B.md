# CANDIDATE-STRATEGIC-UX-01B — La matriz canónica de cinco plataformas

**Fecha:** 2026-09-03
**Commit base:** `7eb0b2a` (CANDIDATE-STRATEGIC-UX-01)
**Cierre operacional de referencia:** `07fc51c`

Corrección posterior a un gate que pasó los tests y **falló la certificación
visual**. No rediseña nada: expone lo que ya estaba calculado.

`EXTERNAL_REQUESTS = 0` · `CREDITS_USED = 0`

---

## 1. Causa raíz: por qué la UI parecía medir solo X y YouTube

`BaselineT0Panel.jsx` tenía **las columnas escritas a mano**, y solo para dos
plataformas:

```
X segs · X pub · orig · rep · X vistas · X likes
YT subs · YT víd · YT vistas · Cobertura
```

El payload de `/linea-base` traía **las cinco** en `candidatos[].plataformas`
(`facebook`, `instagram`, `tiktok`, `x`, `youtube`). El panel solo leía
`plataformas.x` y `plataformas.youtube`.

**Facebook, Instagram y TikTok llegaban al navegador y no se pintaban nunca.**

Como esa era la única tabla de la pantalla, Candidate Intelligence parecía medir
dos plataformas. La pregunta del usuario —«¿dónde están Facebook, Instagram y
TikTok?»— describía la pantalla con exactitud.

---

## 2. Causa raíz: 30/5 frente a 26/3/4/1/1

No es pérdida de granularidad. Son **tres cosas distintas**, y una de ellas no
existe como código ejecutable.

### a) `/linea-base` → 30 MEDIDO + 5 SIN_CUENTA

Usa `ESTADOS_PLATAFORMA_T0` y deriva el estado de **publicaciones observadas**.
Solo tiene cinco valores y ninguno para «parcial» ni «requiere proveedor».

### b) El cierre canónico → **22 MEDIDO / 3 PARCIAL / 5 NO_SOPORTADO / 5 IDENTIDAD_INSUFICIENTE**

`clasificarCeldaConIdentidad` + `cerrarCelda`, sobre **snapshots por activo** y
fuerza de identidad. Es la taxonomía que este gate expone.

### c) El 26/3/4/1/1 certificado → **no es reproducible**

`operationalClosure.js` **no tiene ningún consumidor** en `services/` ni en
`routes/`:

```
quien usa operationalClosure → tests/operationalClosure.test.mjs
```

Y ese test son **6 pruebas unitarias sobre fixtures sintéticos** (62 líneas).
Nunca abre el Lake, nunca recorre 7 candidatos, nunca produce 35 celdas.

Además, **dos de sus entradas decisivas no se persisten en ningún sitio**:

| Entrada | Estado hoy |
|---|---|
| `discoveryConfirmada` | sin evidencia persistida → siempre `false` |
| `conflictosConocidos` | sin almacenamiento → siempre `∅` |

Así que cualquier ejecución de hoy obtiene forzosamente esos valores, y la
distribución certificada quedó en un informe, no en datos. **No se fuerza a
26/3/4/1/1** (§33 lo prohíbe explícitamente).

### La prueba concreta de que a) y b) responden preguntas distintas

**Paúl Carrasco en X:** `/linea-base` dice `MEDIDO`; el cierre dice
`NO_SOPORTADO`. Tiene **3 activos de X descubiertos y 0 snapshots de X** (sus 8
snapshots son de TikTok, Facebook, Instagram y YouTube). El `MEDIDO` venía de
**publicaciones** observadas, no de una métrica de cuenta.

Las dos afirmaciones son ciertas y hablan de objetos distintos.

---

## 3. ⚠️ Tercera causa raíz: `accountId` que no casan

Encontrada al construir el read model, y explica buena parte de la diferencia.

```
ficha     youtube:yakuperez4230        ← identidad
snapshot  youtube:@yakuperez4230       ← medición (857 suscriptores)
                    ↑ no casa
```

Para Paúl Carrasco es peor: la ficha guarda el id de canal
`youtube:ucxp6qogn2ksjfcea-izjmdw` y el snapshot el handle
`youtube:@paulcarrascocarpio9219`.

`activoCubierto()` compara por `accountId`, así que **no encuentra la medición y
la celda queda sin cubrir** aunque el dato exista y esté persistido.

**4 celdas afectadas** (2 en YouTube, 2 en X).

No se arregla aquí: normalizar la clave cambia semántica de identidad y de
persistencia, que §29 excluye. **Pero no se oculta.** Cada celda afectada lleva
`medicionesHuerfanas` con los dos ids, y la matriz lo declara como limitación
`ACCOUNT_ID_SIN_CASAR`. Sin eso, la celda diría «sin vía disponible» mientras
hay 857 suscriptores medidos.

---

## 4. Fuente canónica y contrato

**Fuente:** `socialBenchmarkMatrix.clasificarCeldaConIdentidad` +
`operationalClosure.cerrarCelda`, **sin tocarlas**. El nuevo read model solo
reúne las entradas ya persistidas —activos de la ficha, snapshots— y las llama
35 veces. Si mañana `cerrarCelda` cambia, la matriz cambia con ella.

**Read model:** `services/intelligence/candidatePlatformMatrix.js`
**Ruta:** `GET /api/proyectos/:proyectoId/matriz-plataformas` — solo lee.

Contrato por celda, con los dos ejes separados (§30):

```
{ plataforma,
  identidad:  { estado, porActivo[], conflictos[], tieneConflicto },
  medicion:   { estado, estadoPrevio, motivo },
  activos:    [{ accountId, handle, url, identityState }],
  activosTotal, activosCubiertos,
  metrica:    { nombre, valor, accountId, capturedAt, provider, activosConMetrica } | null,
  snapshots,
  medicionesHuerfanas: { total, accountIds[], activosDeLaFicha[], motivo } | null }
```

`discoveryConfirmada` se pasa **siempre en `false`** y está comentado por qué: el
contrato de `clasificarCelda` dice «si no hay evidencia de que se ejecutó, debe
llegar false: NUNCA se asume». Pasarlo en `true` convertiría «no tenemos semilla»
en «no tiene cuenta».

---

## 5. Distribución real de las 35 celdas

| Estado | Celdas |
|---|---|
| MEDIDO | **22** |
| NO_SOPORTADO | **5** |
| IDENTIDAD_INSUFICIENTE | **5** |
| PARCIAL | **3** |
| **Total resueltas** | **35 / 35** |

Identidad dominante: **28 ANALYST_CONFIRMED · 2 SYSTEM_VERIFIED · 5
NO_ASSET_CONFIRMED**.

### Facebook

| Candidato | Medición | Métrica |
|---|---|---|
| Paúl Carrasco | MEDIDO | 119.000 seguidores |
| Lloret | PARCIAL | 55.855 |
| Pedro Palacios | MEDIDO | 57.000 |
| Juan Carlos Vega | IDENTIDAD_INSUFICIENTE | — |
| Yaku Pérez | PARCIAL | 531.000 |
| Marcelo Cabrera | MEDIDO | 60.000 |
| Leonardo Morales | MEDIDO | 7.700 |

### Instagram

| Candidato | Medición | Métrica |
|---|---|---|
| Paúl Carrasco | MEDIDO | 987 |
| Lloret | MEDIDO | 360 |
| Pedro Palacios | MEDIDO | 9.718 |
| Juan Carlos Vega | MEDIDO | 4.742 |
| Yaku Pérez | MEDIDO | 683 |
| Marcelo Cabrera | PARCIAL | 654 |
| Leonardo Morales | MEDIDO | 48.510 |

### TikTok — **7 de 7 MEDIDO**

Paúl 33.300 · Lloret 29.100 · Palacios 7.085 · Vega 1.856 · Yaku 519.300 ·
Cabrera 1.155 · Morales 12.800 seguidores.

§20 confirmado: TikTok **no** está globalmente sin resolver.

### X

| Candidato | Medición | Métrica |
|---|---|---|
| Paúl Carrasco | NO_SOPORTADO | — (3 activos, 0 snapshots) |
| Lloret | MEDIDO | 29.413 |
| Pedro Palacios | MEDIDO | 29.372 |
| Juan Carlos Vega | NO_SOPORTADO ⚠ huérfana | — |
| Yaku Pérez | MEDIDO | 131.305 |
| Marcelo Cabrera | NO_SOPORTADO ⚠ huérfana | — |
| Leonardo Morales | MEDIDO | 2.270 |

### YouTube

| Candidato | Medición | Métrica |
|---|---|---|
| Paúl Carrasco | NO_SOPORTADO ⚠ huérfana | — |
| Lloret | MEDIDO | 26 suscriptores |
| Pedro Palacios | IDENTIDAD_INSUFICIENTE | — |
| Juan Carlos Vega | IDENTIDAD_INSUFICIENTE | — |
| Yaku Pérez | NO_SOPORTADO ⚠ huérfana | — |
| Marcelo Cabrera | IDENTIDAD_INSUFICIENTE | — |
| Leonardo Morales | IDENTIDAD_INSUFICIENTE | — |

---

## 6. Tratamientos

**PPCA.** No hay ningún estado `REQUIERE_PPCA` en el contrato de cierre y no se
inventa. El estado que sí existe para «la cuenta está pero medirla exige algo
nuestro» es `REQUIERE_PROVEEDOR`, con motivo *«no medido por decisión de
presupuesto, no por imposibilidad»*. La UI lo soporta. En el piloto no aparece
porque todas las celdas de Facebook con activos ya tienen snapshot.

**No soportado.** `NO_SOPORTADO` = no hay vía conocida ni oficial ni de
proveedor. X y YouTube no tienen fallback probado en este proyecto: su única vía
es la oficial. Se distingue de `SIN_CUENTA` y de `IDENTIDAD_INSUFICIENTE`.

**Missing.** Métrica ausente → `null` en el contrato y `—` en pantalla, con
tooltip *«Un «—» no es un cero»*. Cuatro pruebas lo fijan, incluida una sobre un
snapshot `CUENTA_CONFIRMADA` (confirma identidad, no mide).

**Identidad ≠ medición.** Dos campos distintos en cada celda. El caso que lo
demuestra: **Yaku Pérez en YouTube** es `ANALYST_CONFIRMED` con medición
`NO_SOPORTADO`.

**Cobertura X/5** (§12). Se parte en dos porque «5/5» decía *medidas* y no lo
eran:

- **`3 de 5 medidas`** — solo `MEDIDO`. `PARCIAL` no cuenta.
- **`5 de 5 resueltas`** — cada celda tiene estado explícito.

Con nota: *«Resueltas NO significa medidas.»* Ningún porcentaje.

---

## 7. La tabla heredada (§14)

**No se elimina.** Sus columnas —originales frente a republicaciones, vistas y
me gusta de las originales— son datos reales que no están en ningún otro sitio.

Lo que cambia:

| | Antes | Ahora |
|---|---|---|
| Título | «Línea base digital · T0» | **«Línea base comparable disponible para X y YouTube»** |
| Posición | única tabla de la pantalla | debajo de la matriz, en la pestaña Redes |
| Alcance | implícitamente total | *«No representa toda la presencia digital del candidato»* |
| Columna «Cobertura» | `5/5`, leído como medidas | **«Con publicaciones»**, con su tooltip |
| Color de esa columna | verde ≥2, ámbar =1 | neutro — el umbral de 2 era un resto de cuando solo X y YouTube eran legibles |
| `momentum.estado` | enum crudo `HISTORICO_INSUFICIENTE` en monospace | frase, con el enum en el `title` |
| `comparabilidad.estado` | enum en minúsculas con espacios | frase traducida |

---

## 8. Preservado de `7eb0b2a`

Verificado por las 101 invariantes de render, que siguen verdes: sin «Solidez»;
«Cobertura de datos» como indicador técnico; seis dimensiones; Momentum
`HISTÓRICO INSUFICIENTE`; **`historico.ventanas[].delta` no se consume**; ningún
`−29.053`; identidad ≠ medición; disclaimer electoral; «Observación activa»;
«Actualizar observación»; LinkedIn y web como activos adicionales fuera de la
matriz 5×7; project isolation; navegación intacta.

`CANDIDATE_TEMPORAL_COMPARABILITY_DEBT` — declarada, sin intentar arreglarla.

---

## 9. IPDO — conflicto de concurrencia

⚠️ **Durante este gate T1 creó `apps/backend/services/intelligence/digitalPresenceIndex.js`**
(untracked, mtime 18:33, `IPDO_METHOD_VERSION = "IPDO_V1"`, pesos, `calcularIPDO`).

**No se tocó, no se importó, no se apoyó nada en él y no se ha stageado.** No se
implementó IPDO, ni scores 0–100, ni rankings, y no se modificó
`digitalPresence.js`.

Nota de coordinación: mi ruta nueva vive en `routes/projects.js` (limpio al
empezar). T1 necesitará añadir la suya en el mismo fichero; son regiones
distintas, pero conviene saberlo.

---

## 10. Comprobaciones

| | |
|---|---|
| Matriz canónica (nuevo) | **25 / 25** |
| Render de Candidate | **101 / 101** (94 sin payload + 7 sobre el real) |
| Render de Media | **53 / 53**, intactas |
| Render del workspace | **60 / 60**, intactas |
| Suite backend completa | **1.331**, 0 fallos |
| Cierre e identidad | operationalClosure 6 · benchmarkMatrix 14 · benchmarkIdentity 14, sin cambios |
| Suites de Media | 40 · 28 · 32 · 31 · 25 · 5 |
| Build | limpio |
| Lint | 6 **preexistentes** (Dashboard ×5, KnowledgeGraph ×1); 0 nuevos |
| Peticiones externas | **0** · créditos **0** |

La ruta se probó por HTTP en una **instancia aparte en el puerto 3099**, que se
detuvo al terminar. El backend del usuario (PID 6140, `:3001`) no se tocó.
`HTTP 200`, 42 KB, 81 ms.

**Aislamiento:** piloto 7 candidatos / 35 celdas; ensayo 0 / 0; sin `projectId`
devuelve `ok:false` con motivo.

---

## 11. Ficheros

**Nuevos:** `apps/backend/services/intelligence/candidatePlatformMatrix.js` ·
`apps/backend/tests/candidatePlatformMatrix.test.mjs` ·
`apps/web/src/candidato/MatrizPlataformas.jsx`

**Modificados:** `apps/backend/routes/projects.js` (una ruta GET + un import) ·
`apps/web/src/components/ProjectsModule.jsx` ·
`apps/web/src/components/BaselineT0Panel.jsx` ·
`apps/web/src/candidato/dimensionesEstrategicas.js` ·
`apps/web/src/workspace/estados.js` · `apps/web/tests/candidate-ux.check.jsx`

**No tocados:** `digitalPresenceIndex.js` (T1), `socialBenchmarkMatrix.js`,
`operationalClosure.js`, `candidateBaseline.js`, cualquier collector o adapter,
`SENTINEL_PROJECT_STATE.md`, `apps/backend/package.json` (mezclado y con BOM —
tampoco se corrige el BOM).

---

## 12. URL de certificación

```
http://localhost:5174/?proyecto=alcaldia-cuenca-2027-piloto&modulo=candidatos
```

### ⚠️ Precondición: reiniciar el backend

`GET /matriz-plataformas` es una ruta nueva y el proceso de `:3001` (PID 6140,
arrancado hoy a las 17:20) corre `node server.js` **sin watcher**. Hasta que se
reinicie devuelve 404 y la matriz aparecerá vacía.

```
# detener el PID 6140 y volver a arrancar
npm run dev --workspace apps/backend
```

### Dónde mirar

La matriz es **lo primero** bajo la cabecera del proyecto, titulada
**«Presencia por plataforma · 7 candidatos × 5 plataformas»**, antes de las
fichas. También encabeza la pestaña **Redes**, con la tabla X/YouTube debajo.

| | Comprobar |
|---|---|
| ☐ | 7 filas de candidatos |
| ☐ | **Facebook** visible |
| ☐ | **Instagram** visible |
| ☐ | **TikTok** visible |
| ☐ | **X** visible |
| ☐ | **YouTube** visible |
| ☐ | Pie: «35 de 35 celdas resueltas» + 22 Medido · 5 Sin vía · 5 Identidad insuficiente · 3 Parcial |
| ☐ | Estados en palabras, ningún `MAYUSCULA_CON_GUION` |
| ☐ | Celdas sin dato con `—`, ningún «0 seguidores» |
| ☐ | Dos líneas por celda: estado arriba, «Referencia confirmada por analista» debajo |
| ☐ | Cobertura: «3 de 5 medidas» sobre «5 de 5 resueltas» |
| ☐ | Cuatro celdas con «⚠ medición sin activo que case» |
| ☐ | X y YouTube ya no dominan: son dos columnas de cinco |
| ☐ | «adicionales: LinkedIn 1» en el segundo nivel de la ficha, fuera de la matriz |
| ☐ | Momentum «Histórico insuficiente» |
| ☐ | Ningún `−29.053` |
| ☐ | Disclaimer electoral |
| ☐ | Sin «Solidez» |

En pantalla estrecha la tabla se desplaza en horizontal; **ninguna plataforma se
oculta**, que es como se produjo el defecto original.

---

## 13. Gaps

1. **`accountId` que no casan** (§3). 4 celdas. Normalizar la clave entre ficha y
   snapshots es un gate de backend de Candidate: afecta identidad y persistencia.
2. **`operationalClosure.js` seguía sin consumidor.** Ahora lo tiene, pero
   `candidateSnapshotCollection.js` **sigue sin ninguno** — la deuda del
   «repeatable TikTok branch» que menciona §20.
3. **`discoveryConfirmada` no se persiste.** Mientras siga así, ninguna celda
   podrá cerrarse como `SIN_CUENTA`, y las 5 `IDENTIDAD_INSUFICIENTE` no se
   distinguirán de una ausencia real de cuenta.
4. **`conflictosConocidos` no tiene almacén.** `instagram:leomoralez.1425` **sigue
   presente** en la ficha de Leonardo Morales como `ATRIBUIDA` con
   `correspondencia: 14`, y cuenta como activo. La exclusión de la que habla §17
   nunca se persistió, así que ningún read model puede reproducirla. **No se
   inventó un set a mano** — eso sería hardcodear (§31) y reinterpretar identidad
   (§17). Dos pruebas fijan el estado real: el mecanismo funciona cuando se le
   pasa el conflicto, y hoy nada se lo pasa.
5. **`ventanas[].delta` sigue mal** en el backend. La UI no lo consume.
6. Las suites nuevas siguen fuera de `npm test` (`package.json` mezclado).

---

## 14. Veredictos

```
CANDIDATE_FIVE_PLATFORM_MATRIX         = APPROVED
CANDIDATE_OPERATIONAL_STATE_EXPOSURE   = APPROVED
IDENTITY_MEASUREMENT_SEPARATION        = APPROVED
CANDIDATE_PLATFORM_UX                  = READY_FOR_HUMAN_CERTIFICATION
```

`CANDIDATE_OPERATIONAL_STATE_EXPOSURE` se aprueba porque la taxonomía completa
llega a la UI desde la fuente certificada, con las 35 celdas resueltas y sin
degradar a dos estados. Las tres carencias de datos de §13.3 y §13.4 son deuda
del modelo de persistencia, no de la exposición, y quedan declaradas en la propia
respuesta del endpoint en lugar de disimuladas.
