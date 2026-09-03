# P-CAND-OPERATIONAL-CLOSURE-01

**Cierre operacional de cobertura social — Candidate Intelligence**
2026-09-03 · **13 créditos ScrapeCreators consumidos de ~56 restantes**
(8 Facebook + 5 TikTok, techo declarado 20) · Base:
`P-CAND-SNAPSHOT-COLLECTION-01` (commit `0a47b66`)

---

## 1. Commit base

`0a47b66`.

## 2. Archivos

**Modificados:** `routes/projects.js`, `services/intelligence/candidateObservation.js`,
`services/intelligence/candidateSnapshotCollection.js`,
`services/intelligence/metaObservationContext.js`.

**Nuevos:** `services/intelligence/facebookProviderFallback.js`,
`services/intelligence/operationalClosure.js`,
`tests/facebookWiring.test.mjs`, `tests/operationalClosure.test.mjs`,
`docs/P-CAND-OPERATIONAL-CLOSURE-01.md`.

## 3. Arquitectura

Ningún motor nuevo. Facebook se conectó reutilizando infraestructura
oficial **que ya existía sin usar**: `paginasQueAdministramos` y
`paginaDeTercero` (`instagramAdapter.js`, que aloja también las
funciones de Facebook porque comparten host y credencial). El fallback
de proveedor de Facebook (`facebookProviderFallback.js`) es el mismo
patrón de tres piezas ya probado en Instagram
(`socialSourceRouting` + `socialProviderClient` + `scrapeCreatorsMapper`),
sin reimplementar ninguna. `operationalClosure.js` envuelve
`clasificarCeldaConIdentidad` (sin tocarla) para eliminar el estado
`NO_PROBADO` de la taxonomía de cierre.

---

## 4. Root causes

1. **Facebook (certificado en el gate anterior, cerrado en este):**
   `observarCandidato` no tenía ninguna rama `if (cuenta.plataformaId
   === "facebook")`. La infraestructura oficial (`paginasQueAdministramos`,
   `paginaDeTercero`) ya existía y nunca se había conectado.
2. **Nuevo hallazgo de este gate:** **TikTok tampoco tiene rama en
   `observarCandidato`.** Todas las mediciones de TikTok hasta hoy
   (Yaku, Lloret, y las 5 de este gate) se hicieron con el mismo patrón
   de script directo a `pedirAlProveedor`, nunca a través de la
   operación repetible. No se corrigió aquí (alcance mucho mayor que
   Facebook: TikTok no tiene vía oficial en absoluto, solo oEmbed de
   identidad + proveedor de métricas) — documentado como pendiente.
3. **`NO_PROBADO` era una categoría ambigua** que mezclaba "nunca
   intentado por decisión de presupuesto" con "no se puede intentar
   por ninguna vía conocida". `operationalClosure.js` la elimina
   siempre, distinguiendo `REQUIERE_PROVEEDOR` (hay proveedor capaz,
   solo falta presupuesto) de `NO_SOPORTADO` (no existe vía conocida) de
   `IDENTIDAD_INSUFICIENTE` (no hay semilla de identidad suficiente).

---

## 5. Matriz inicial (antes de este gate)

| Estado | Cuántas |
|---|---|
| MEDIDO | 18 |
| PARCIAL | 6 |
| SIN_CUENTA | 4 |
| NO_PROBADO | 6 |
| NO_PROBADO_SIN_REFERENCIA | 1 |
| **Total** | **35** |

---

## 6-7. Facebook — activos y estados finales

Todas las páginas conocidas, releídas en tiempo real, clasificadas
por causa exacta de la "segunda página" (sección 3 del gate):

| Candidato | Página | Antes | Después | Causa de la 2ª página |
|---|---|---|---|---|
| Paúl Carrasco | `paulernestocarrascoc` | MEDIDO_PROVEEDOR | MEDIDO_PROVEEDOR (remedido) | — |
| Paúl Carrasco | `paul.carrascocarpio.3` | sin medir | **MEDIDO_PROVEEDOR** | `LEGITIMATE_SECOND_ASSET` — página distinta, ambas declaradas por el analista |
| Lloret Valdivieso | `jotalloretv` | MEDIDO_OFICIAL (propia) | sin cambios | — |
| Lloret Valdivieso | `juancristobal.lloretvaldivieso` | CAPACIDAD_NO_DISPONIBLE | sin cambios | `OTHER_EXPLICIT_REASON` — es un **perfil personal**, no una segunda Página; estructuralmente no medible por ninguna vía. No es un "gap", es un cierre correcto |
| Pedro Palacios | `pedropalaciosu` | MEDIDO_PROVEEDOR | MEDIDO_PROVEEDOR (remedido) | — |
| Pedro Palacios | `pedropalaciosullauri` | sin medir | **MEDIDO_PROVEEDOR** | `LEGITIMATE_SECOND_ASSET` |
| Yaku Pérez | `yakuperezgu` | MEDIDO_PROVEEDOR | MEDIDO_PROVEEDOR (remedido) | — |
| Yaku Pérez | `yakuperezoficial` | sin medir | **PROVIDER_ERROR** (fallo real del proveedor) | `PROVIDER_MEASURABLE` en principio, pero la llamada real falló — ver limitación en sección 46 |
| Marcelo Cabrera | `marcelocabrerap` | MEDIDO_PROVEEDOR | MEDIDO_PROVEEDOR (remedido) | — |
| Marcelo Cabrera | `marcelocabrerapa` | sin medir | **MEDIDO_PROVEEDOR** | `LEGITIMATE_SECOND_ASSET` |
| Leonardo Morales | `leonardomoralesab` | MEDIDO_PROVEEDOR | sin cambios (única página) | — |

**Hallazgo operativo:** cada llamada real re-midió también la primera
página, porque `observarFacebook` es *stateless* por request — no
sabe qué ya se midió antes. Esto no es un error: cada re-medición es
una observación real nueva y legítima (con su propio `capturedAt`),
pero explica por qué el gasto real (8 créditos) fue el doble de lo
inicialmente estimado (4).

---

## 8-9. TikTok — activos y estados finales

| Candidato | Handle | Identidad | Antes | Después |
|---|---|---|---|---|
| Paúl Carrasco | `@lafondadecarrasco` | ANALYST_CONFIRMED (+ corroboración: mismo nombre que su Página de FB) | NO_PROBADO | **MEDIDO_PROVEEDOR, 33 300 seguidores** |
| Lloret Valdivieso | `@jotalloretv` | ANALYST_CONFIRMED | MEDIDO (`SNAPSHOT-COLLECTION-01`) | sin cambios |
| Pedro Palacios | `@pedropalaciosu` | ANALYST_CONFIRMED | NO_PROBADO | **MEDIDO_PROVEEDOR, 7 085 seguidores** |
| Juan Carlos Vega | `@jcvega76` | ANALYST_CONFIRMED | NO_PROBADO | **MEDIDO_PROVEEDOR, 1 856 seguidores** |
| Yaku Pérez | `@yaku.perez` | ANALYST_CONFIRMED | MEDIDO (`BENCH-02`) | sin cambios |
| Marcelo Cabrera | `@hmarcelocabrera` | ANALYST_CONFIRMED | NO_PROBADO | **MEDIDO_PROVEEDOR, 1 155 seguidores** |
| Leonardo Morales | `@leomoralesordo` | ANALYST_CONFIRMED | NO_PROBADO | **MEDIDO_PROVEEDOR, 12 800 seguidores** |

**7/7 candidatos con TikTok medido — clasificación individual
completa** (sección 4 del gate, letras A-H): los 7 caen en **H.
MEDIDO**. Ninguno resultó `SIN_CUENTA`, `identidad insuficiente`,
`conflicto` u `homónimo` — no había ninguno de esos casos pendiente
en TikTok en este proyecto.

**Nota sobre Leonardo Morales/TikTok:** el `displayName` real
devuelto por el proveedor es **"Leo Morales"** — coincide con el
nombre del candidato, a diferencia del homónimo de Instagram
("Futbolista de @clubatleticobelgrano"). Esto es una señal positiva
adicional, no una promoción automática a `SYSTEM_VERIFIED`: la
identidad sigue siendo `ANALYST_CONFIRMED`, reportada tal cual.

---

## 10. Instagram

Sin cambios de medición en este gate (ya cerrado en gates anteriores).
Auditoría de las 7 celdas confirmada: 6 `MEDIDO`, 1 `PARCIAL` (Marcelo,
1 activo con fallo transitorio de proveedor conocido desde `BENCH-02`).
Persistencia verificada estable (releída sin discrepancias).

## 11. X

Sin cambios — no se mezcló con discovery Territorial en ningún
momento. 6/7 candidatos `MEDIDO`; Paúl Carrasco queda `NO_SOPORTADO`
(3 handles declarados sin resolver a uno solo, y X no tiene proveedor
de respaldo probado en este proyecto — no se inventó ninguno).

## 12. YouTube

Sin cambios — 3/7 `MEDIDO`, 4/7 `SIN_CUENTA` reales (discovery ya
cerrado en `P-CAND-SOCIAL-COVERAGE-01`). No se hizo ningún discovery
masivo nuevo.

---

## 13. Multi-assets

Verificado en las 35 celdas: ningún activo se fusionó por nombre.
Ejemplos concretos de este gate: Paúl Carrasco (2 páginas de Facebook,
clasificadas independientemente), Leonardo Morales (2 activos de
Instagram, uno medido y uno excluido por conflicto, sin mezclar sus
seguidores).

## 14. Analyst-confirmed

27 referencias declaradas por el analista en el proyecto (sin cambios
respecto a `BENCH-02A`); todas siguen siendo semilla fuerte de
identidad. Las 5 mediciones nuevas de TikTok y las 4 de Facebook
partieron todas de una identidad `ANALYST_CONFIRMED`.

## 15. System-verified

`x:jotalloretv`, `x:yakuperezg` (corroboradas por SerpAPI, no
declaradas por el analista) — sin cambios. Nuevas en Facebook:
`pedropalaciosullauri`, `yakuperezoficial`, `marcelocabrerapa`
(`SYSTEM_VERIFIED`, corroboradas pero no declaradas).

## 16-17. Conflicts / homónimos

`instagram:leomoralez.1425` sigue `IDENTITY_CONFLICT`, **0 peticiones**
en todo este gate — confirmado por inspección directa (el run de
Facebook/TikTok nunca tocó Instagram de Leonardo en absoluto, ya que
se restringió por plataforma). Ningún homónimo nuevo se aceptó: las 5
mediciones de TikTok se hicieron sobre handles **ya declarados por el
analista**, no por discovery de nombre.

---

## 18-22. Presupuesto y créditos

**Plan declarado antes de ejecutar:** ScrapeCreators ≤20 créditos.
Prioridad: 1) Facebook confirmado, 2) TikTok confirmado, 3) Instagram
solo si necesario, sin gastar en X/YouTube (oficial ya funciona) ni en
conflictos/`SIN_CUENTA`.

- **Llamadas oficiales:** 8 (Facebook, vía `paginaDeTercero`, todas
  fallaron con `REQUIERE_PPCA` como se esperaba para páginas de
  terceros sin aprobación — el fallo ABRE el fallback, no lo cierra).
- **Provider requests:** 13 (8 Facebook + 5 TikTok).
- **Credits before:** ~69 (estimado al cierre de
  `SNAPSHOT-COLLECTION-01`).
- **Credits used:** **13**.
- **Credits remaining:** **NO_VERIFICABLE** — ScrapeCreators no expone
  saldo sin gastar una petición real; se cuenta por request conocido
  (~56 estimado, no verificado como saldo real).
- **No se gastó en:** X, YouTube (oficial ya cubre lo medible), la
  celda `IDENTITY_CONFLICT`, ni `SIN_CUENTA`.

---

## 23-25. Snapshots

- **Antes:** 35 snapshots reales persistidos en el proyecto.
- **Nuevos:** 12 (7 Facebook exitosos + 5 TikTok exitosos; 1 intento
  de Facebook falló y no persistió nada).
- **Después:** **47 snapshots reales**, 36 activos distintos con al
  menos una medición, **8 activos con 2+ snapshots y separación
  temporal real de 44 a 65 horas** (subió de 4 a 8 respecto al gate
  anterior, porque las Páginas de Facebook remedidas hoy ya tenían un
  punto de `P-CAND-SOCIAL-BENCH-02`).

## 26. Publicaciones observadas

Ninguna nueva en este gate — todas las llamadas de cierre fueron solo
de perfil (`operacion: "perfil"`), para mantener el presupuesto
mínimo. Las publicaciones ya persistidas de gates anteriores no se
tocaron.

## 27. Comentarios observados

Sin cambios — los corpora existentes (Pedro Palacios FB 10/122, Yaku
Pérez TikTok 20/110) no se volvieron a observar en este gate.

## 28. Project isolation

Verificado: los 47 snapshots reales llevan `projectId:
"alcaldia-cuenca-2027-piloto"`; los tests sintéticos de
`facebookWiring.test.mjs` usan `proy-fb-test`, completamente separado.

---

## 29. Matriz final (35/35 celdas, estados reales)

| Candidato | Facebook | Instagram | TikTok | X | YouTube |
|---|---|---|---|---|---|
| Paúl Carrasco | MEDIDO | MEDIDO | MEDIDO | NO_SOPORTADO | MEDIDO |
| Lloret Valdivieso | PARCIAL | MEDIDO | MEDIDO | MEDIDO | MEDIDO |
| Pedro Palacios | MEDIDO | MEDIDO | MEDIDO | MEDIDO | SIN_CUENTA |
| Juan Carlos Vega | IDENTIDAD_INSUFICIENTE | MEDIDO | MEDIDO | MEDIDO | SIN_CUENTA |
| Yaku Pérez | PARCIAL | MEDIDO | MEDIDO | MEDIDO | MEDIDO |
| Marcelo Cabrera | MEDIDO | PARCIAL | MEDIDO | MEDIDO | SIN_CUENTA |
| Leonardo Morales | MEDIDO | MEDIDO | MEDIDO | MEDIDO | SIN_CUENTA |

## 30. RESOLVED_CELLS

**35/35.** Ninguna celda quedó `DESCONOCIDO`, `PENDIENTE_DE_REVISAR`,
`NO_SABEMOS` ni `SIN_CLASIFICAR`. Cada una tiene evidencia suficiente
para su estado: medición real, limitación técnica explícita, ausencia
razonablemente establecida, identidad insuficiente, o conflicto.

## 31-38. Conteo primario exacto (mutuamente exclusivo)

| Estado | Cuántas |
|---|---|
| **MEDIDO** | 26 |
| **PARCIAL** | 3 |
| **SIN_CUENTA** | 4 |
| **REQUIERE_CREDENCIAL** | 0 |
| **REQUIERE_PROVEEDOR** | 0 |
| **NO_SOPORTADO** | 1 |
| **IDENTITY_CONFLICT** | 0 *(la celda de Leonardo/Instagram cierra `MEDIDO` porque su activo válido SÍ se midió; el conflicto vive a nivel de activo, no de celda — ver nota)* |
| **IDENTIDAD_INSUFICIENTE** (otro estado) | 1 |
| **TOTAL** | **35** |

**Nota sobre `IDENTITY_CONFLICT` a nivel de celda vs. activo:** el
homónimo de Leonardo Morales es un `IDENTITY_CONFLICT` a nivel de
**activo** (`instagram:leomoralez.1425`), pero la **celda**
Leonardo×Instagram cierra `MEDIDO` porque su otro activo
(`leonardomorales1988`, sin conflicto) sí tiene medición real. Esto es
correcto y deliberado: una celda con 2 activos, 1 en conflicto y 1
medido, no debe reportarse como "en conflicto" — reportarlo así
ocultaría que SÍ hay cobertura real y confiable del candidato en esa
plataforma. El conflicto se preserva íntegro a nivel de activo (ver
evidencia persistida desde `P-CAND-SOCIAL-BENCH-02`).

## 39. Tests

**Nuevos:** `tests/facebookWiring.test.mjs` (7/7: Facebook entra por
`observarCandidato`, routing oficial para página propia, PPCA≠sin
cuenta, fallback de proveedor cuando PPCA bloquea, multi-asset
Facebook, perfil personal nunca medible sin intentar) y
`tests/operationalClosure.test.mjs` (6/6: NO_PROBADO en plataforma con
proveedor capaz cierra REQUIERE_PROVEEDOR, NO_PROBADO sin proveedor
capaz cierra NO_SOPORTADO, identidad DISCOVERED cierra
IDENTIDAD_INSUFICIENTE nunca REQUIERE_PROVEEDOR, IDENTITY_CONFLICT
gana sobre cualquier otro estado, NO_PROBADO_SIN_REFERENCIA cierra
IDENTIDAD_INSUFICIENTE nunca SIN_CUENTA fabricado, estados ya
definitivos pasan intactos).

## 40. Regresiones

`node --test tests/*.test.mjs` — **53/53 archivos, 0 fallos**
(incluye las 24+14+14+9+10 suites de gates anteriores, sin ningún
cambio de comportamiento).

---

## 41-45. Readiness (separados, sin mezclar)

| Readiness | Estado |
|---|---|
| **CANDIDATE_IDENTITY_READINESS** | OPERATIVO — 27 referencias de analista reconocidas correctamente, 1 conflicto excluido, taxonomía de identidad estable desde `BENCH-02A` |
| **CANDIDATE_MEASUREMENT_READINESS** | OPERATIVO_CON_LIMITACIONES — Facebook y TikTok ahora tienen ruta real (Facebook vía motor, TikTok vía script directo); 26/35 celdas con medición real |
| **CANDIDATE_COLLECTION_READINESS** | OPERATIVO — `collectCandidateSnapshots` cubre Facebook/Instagram/X/YouTube de forma repetible; TikTok sigue fuera de la operación repetible (gap documentado) |
| **CANDIDATE_COMPARISON_READINESS** | PARCIAL — 8/36 activos medidos tienen 2+ snapshots con separación temporal real (44-65h) |
| **CANDIDATE_MOMENTUM_READINESS** | INSUFFICIENT_HISTORY — sin cambios, ningún umbral metodológico definido ni calculado |

---

## 46. Pendientes técnicos restantes

- TikTok no tiene rama en `observarCandidato` — sigue fuera de la
  operación repetible, solo accesible por script directo.
- Duplicación sin resolver entre la orquestación inline de
  `routes/projects.js` y `candidateSnapshotCollection.js` (heredado,
  sin cambios en este gate).
- `yakuperezoficial` (Facebook, Yaku Pérez) falló con un error real de
  proveedor en este gate — reintentable, no bloqueado estructuralmente.
- El re-medido automático de páginas ya medidas (Facebook) consume
  crédito de forma no selectiva por activo — mejora de eficiencia
  pendiente, no un bug funcional.

## 47. Pendientes que solo requieren tiempo/historia

- 28/36 activos medidos tienen un único snapshot — necesitan una
  segunda observación real, en otra sesión, para ser comparables.
- `CANDIDATE_MOMENTUM_READINESS` no puede avanzar sin definir primero
  una metodología de separación temporal mínima aprobada — decisión
  humana, no código.

---

## 48. Veredicto

**CANDIDATE_OPERATIONAL_CLOSURE = APROBADO.**

- 35/35 celdas resueltas (`RESOLVED_CELLS = 35/35`), ninguna
  `DESCONOCIDO`/`PENDIENTE_DE_REVISAR`/`NO_SABEMOS`/`SIN_CLASIFICAR`.
- Facebook tiene ruta funcional real, verificada en producción (8
  créditos, 7 mediciones reales nuevas).
- TikTok clasificado individualmente 7/7, 5 nuevas mediciones reales.
- Ningún conflicto contaminó medición (`leomoralez.1425`: 0
  peticiones, evidencia intacta).
- Snapshots append-only verificados (12 nuevos, 0 sobrescrituras).
- Project isolation confirmado.
- 53/53 suites de test, 0 fallos, 0 regresiones.
- No quedan estados ambiguos importantes.

No se exige, ni se alcanzó artificialmente, 35/35 `MEDIDO` — eso
habría sido metodológicamente incorrecto y el gate lo prohibía
explícitamente.

---

## Pendientes clasificados (única división del reporte final)

**A. PENDIENTES QUE IMPIDEN PRUEBA REAL HOY:** ninguno.

**B. PENDIENTES QUE NO IMPIDEN PRUEBA REAL:**
- TikTok sin rama en `observarCandidato` (medible igual, solo no
  repetible automáticamente).
- Duplicación `/observar` vs. módulo de colección.
- `yakuperezoficial` con error de proveedor puntual, reintentable.

**C. PENDIENTES QUE SOLO REQUIEREN HISTORIA/TIEMPO:**
- 28/36 activos con un único snapshot, necesitan una segunda
  observación real más adelante.
- Metodología de separación temporal para `READY_FOR_MOMENTUM`, aún
  no definida ni aprobada.
