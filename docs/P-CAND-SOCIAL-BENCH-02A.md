# P-CAND-SOCIAL-BENCH-02A

**Reconciliación del benchmark + prioridad de referencia del analista +
seguridad de identidad**
2026-09-01 · **0 requests externas, 0 créditos consumidos** · Base:
`P-CAND-SOCIAL-BENCH-02` (commit `22ab50c`)

> Gate de reconciliación, no de medición. Todo lo que sigue se construyó
> releyendo datos ya persistidos (`fichaIdentidad`, `snapshotsDe`) con un
> clasificador puro, cero red.

---

## 1. Causa exacta del 36 vs 35

El benchmark real (`socialBenchmarkMatrix.js`) siempre produjo exactamente
35 celdas mutuamente exclusivas — cada celda recibe un único `estado`, y
`construirMatrizBenchmark` ya sumaba `tally` correctamente sobre esos 35
resultados. **El error estaba en la tabla resumen escrita a mano** del
reporte anterior: la celda de Juan Carlos Vega/Facebook es
`NO_PROBADO_SIN_REFERENCIA` (no existe ninguna URL de Facebook declarada
por el analista para él — confirmado de nuevo en este gate). Esa celda se
contó **dos veces**: una vez dentro de la fila `NO_PROBADO = 7` y otra vez
en la fila separada `NO_PROBADO_SIN_REFERENCIA = 1`. El valor correcto de
`NO_PROBADO` (excluyendo esa celda) es **6**, no 7. `6 + 1 = 7` celdas
"nunca medidas por ninguna vía", que sumadas a las otras 4 categorías dan
exactamente 35.

**No fue un bug de clasificación ni de datos — fue un error de
transcripción en la tabla ejecutiva.** Se corrige aquí con una tabla
regenerada directamente desde el clasificador, no escrita a mano, y con un
test que impide que vuelva a pasar desapercibido (`suma = 35`, sección 17).

---

## 2. Taxonomía de identidad — reutilizada, no inventada

`services/projects/projectStore.js#fichaIdentidad` ya distingue, por cada
cuenta consolidada, tres señales booleanas independientes:
`declaradaPorAnalista`, `descubiertaPorSentinel`, `corroboradaPorSentinel`.
Este gate solo les da nombre a las combinaciones que esos tres campos ya
permiten distinguir — no crea una tabla ni un campo nuevo en el Lake:

| IDENTITY_STATE | Condición | Significado |
|---|---|---|
| `ANALYST_CONFIRMED` | `declaradaPorAnalista === true` | El analista proporcionó la URL. Semilla fuerte, tiene precedencia. |
| `SYSTEM_VERIFIED` | `corroboradaPorSentinel === true` (y no hay conflicto) | Sentinel corroboró la cuenta con ≥1 proveedor de discovery. |
| `DISCOVERED` | `descubiertaPorSentinel === true`, sin corroborar | Encontrada automáticamente, sin confirmar. |
| `IDENTITY_CONFLICT` | Revisión humana explícita de evidencia real | Contradicción fuerte detectada — nunca inferida solo de un score bajo. |
| `NO_ASSET_CONFIRMED` | Sin cuenta en absoluto | No hay ninguna señal de identidad para esa celda. |

Implementado en `services/intelligence/socialBenchmarkMatrix.js` (nuevas
exportaciones `IDENTITY_STATES`, `identidadDeCuenta`,
`clasificarCeldaConIdentidad`, `snapshotReadinessDeActivo` — todo aditivo,
las funciones del gate anterior no cambiaron).

---

## 3-4. Regla aplicada: la referencia del analista es semilla, no filtro ni verificación eterna

Verificado con datos reales: **las 35 celdas nunca perdieron una
referencia del analista por no tener medición.** Ejemplo — Paúl
Carrasco/TikTok: `declaradaPorAnalista: true` (`@lafondadecarrasco`), pero
`corroboradaPorSentinel: false`. Su `identityState` es `ANALYST_CONFIRMED`
y su `measurementState` sigue siendo `NO_PROBADO` — ambos coexisten sin
que uno se coma al otro. Ninguna celda de este benchmark convierte una
referencia del analista en `NO_PROBADO` de identidad; `NO_PROBADO` en este
benchmark describe siempre **medición**, no identidad.

---

## 5-6. Auditoría completa: referencias del analista por candidato/plataforma

Datos reales, releídos de `cuentasReferencia` (0 requests):

| Candidato | FB | IG | TikTok | X | YT |
|---|---|---|---|---|---|
| Paúl Carrasco | ✅ analista | ✅ analista | ✅ analista | ❌ ninguna | ✅ analista |
| Lloret Valdivieso | ✅ analista (2 cuentas) | ✅ analista | ✅ analista | ❌ ninguna | ✅ analista |
| Pedro Palacios | ✅ analista | ✅ analista | ✅ analista | ✅ analista | ❌ ninguna |
| Juan Carlos Vega | ❌ **ninguna** | ✅ analista | ✅ analista | ✅ analista | ❌ ninguna |
| Yaku Pérez | ✅ analista | ✅ analista | ✅ analista | ✅ analista | ✅ analista (+1 revocada) |
| Marcelo Cabrera | ✅ analista | ✅ analista | ✅ analista | ✅ analista | ❌ ninguna |
| Leonardo Morales | ✅ analista | ✅ analista (**solo 1 de 2** IG activos) | ✅ analista | ✅ analista | ❌ ninguna |

**Total de referencias declaradas por el analista: 27** (de 35 celdas
posibles; las 8 celdas restantes son las 4 `SIN_CUENTA` reales de YouTube +
Vega/Facebook + las 3 celdas sin referencia declarada del listado de
arriba). **27 de 27 fueron reconocidas correctamente como
`ANALYST_CONFIRMED`** por el clasificador — ninguna fue ignorada ni
degradada a `NO_PROBADO` de identidad. **0 referencias fueron reemplazadas
incorrectamente por discovery**: el caso que parecía serlo
(`leomoralez.1425`) resultó ser un activo **adicional** descubierto por
Sentinel, no un reemplazo de la referencia declarada — la referencia
original del analista (`leonardomorales1988`) sigue intacta y sin tocar.

---

## 7. La referencia del analista no cerró Full Discovery

Confirmado: cada candidato con Instagram `ANALYST_CONFIRMED` conserva,
además, cualquier activo adicional que Sentinel encontró por su cuenta
(ejemplo: Marcelo Cabrera tiene 3 activos de Instagram — 1 declarado, 2
más presentes en el expediente). El benchmark nunca truncó la búsqueda a
"solo la cuenta declarada".

---

## 8. Leonardo Morales — homónimo, evidencia real (releída, 0 requests)

Dato exacto (no "leonardomorales13" como sugería el prompt — el handle
real persistido es **`leomoralez.1425`**, verificado contra
`fichaIdentidad` y contra el snapshot real medido en `P-CAND-SOCIAL-BENCH-02`):

```
id: "instagram:leomoralez.1425"
declaradaPorAnalista: false
descubiertaPorSentinel: true
corroboradaPorSentinel: true   (1 proveedor: SerpAPI/Google)
correspondencia: 14            (score de coincidencia de nombre, muy bajo)
```

Medición real (ya persistida en BENCH-02): 48 510 seguidores, cuenta
**verificada**, biografía real *"Futbolista de @clubatleticobelgrano"*
(club argentino). Nada de esto corresponde a un candidato político de
Cuenca, Ecuador.

**Decisión de este gate:** `instagram:leomoralez.1425` se registra en un
registro explícito de conflictos conocidos
(`conflictosConocidos = new Set(["instagram:leomoralez.1425"])`, decidido
por revisión humana de la evidencia real, no por el score de
correspondencia por sí solo). Su `identityState` es `IDENTITY_CONFLICT`.
**Se excluye del cálculo de medición de la celda** — no alimenta
`coverage`, `followers`, ranking, ni ningún insumo futuro de Momentum/IPID.
El snapshot real permanece persistido tal cual (no se borra evidencia),
con la advertencia ya escrita en `limitations` desde BENCH-02.

**La referencia declarada por el analista para Leonardo Morales/TikTok**
(`@leomoralesordo`) se usa como referencia fuerte de identidad
(`ANALYST_CONFIRMED`), completamente independiente del homónimo de
Instagram — un rechazo en una plataforma no contamina la identidad
confirmada en otra.

**Resultado en la celda Leonardo Morales/Instagram:** `MEDIDO`, `1/1`
activos válidos — el único activo NO conflictuado
(`leonardomorales1988`, `ANALYST_CONFIRMED`) está medido; el homónimo
queda fuera del conteo, no lo infla ni lo mezcla.

---

## 9. Paúl Carrasco — TikTok

| | |
|---|---|
| Referencia del analista | **Sí** — `@lafondadecarrasco`, `declaradaPorAnalista: true` |
| Corroboración automática del sistema (`corroboradaPorSentinel`) | **No** — `false`, 0 proveedores de discovery |
| Corroboración circunstancial nueva (BENCH-02) | El nombre público de su página de Facebook real es "La Fonda de Carrasco" |
| Estado de identidad | `ANALYST_CONFIRMED` — **no** se eleva a `SYSTEM_VERIFIED` |
| Incertidumbre restante | La coincidencia de nombre de marca entre una Page de Facebook y un handle de TikTok no prueba que la misma persona administre ambas cuentas. Sigue siendo circunstancial. |
| Estado de medición | `NO_PROBADO` (nunca medido en TikTok) |

---

## 10. Identidad ≠ Medición — matriz completa (35/35)

| Candidato | Plataforma | IDENTITY | MEASUREMENT |
|---|---|---|---|
| Paúl Carrasco | Facebook | ANALYST_CONFIRMED | PARCIAL (1/2) |
| Paúl Carrasco | Instagram | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Paúl Carrasco | TikTok | ANALYST_CONFIRMED | NO_PROBADO |
| Paúl Carrasco | X | SYSTEM_VERIFIED | NO_PROBADO |
| Paúl Carrasco | YouTube | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Lloret Valdivieso | Facebook | ANALYST_CONFIRMED | PARCIAL (1/2) |
| Lloret Valdivieso | Instagram | ANALYST_CONFIRMED | MEDIDO (2/2) |
| Lloret Valdivieso | TikTok | ANALYST_CONFIRMED | REQUIERE_PROVEEDOR |
| Lloret Valdivieso | X | SYSTEM_VERIFIED | MEDIDO (1/1) |
| Lloret Valdivieso | YouTube | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Pedro Palacios | Facebook | ANALYST_CONFIRMED | PARCIAL (1/2) |
| Pedro Palacios | Instagram | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Pedro Palacios | TikTok | ANALYST_CONFIRMED | NO_PROBADO |
| Pedro Palacios | X | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Pedro Palacios | YouTube | NO_ASSET_CONFIRMED | SIN_CUENTA |
| Juan Carlos Vega | Facebook | NO_ASSET_CONFIRMED | NO_PROBADO_SIN_REFERENCIA |
| Juan Carlos Vega | Instagram | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Juan Carlos Vega | TikTok | ANALYST_CONFIRMED | NO_PROBADO |
| Juan Carlos Vega | X | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Juan Carlos Vega | YouTube | NO_ASSET_CONFIRMED | SIN_CUENTA |
| Yaku Pérez | Facebook | ANALYST_CONFIRMED | PARCIAL (1/2) |
| Yaku Pérez | Instagram | ANALYST_CONFIRMED | PARCIAL (1/2) |
| Yaku Pérez | TikTok | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Yaku Pérez | X | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Yaku Pérez | YouTube | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Marcelo Cabrera | Facebook | ANALYST_CONFIRMED | PARCIAL (1/2) |
| Marcelo Cabrera | Instagram | ANALYST_CONFIRMED | PARCIAL (2/3) |
| Marcelo Cabrera | TikTok | ANALYST_CONFIRMED | NO_PROBADO |
| Marcelo Cabrera | X | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Marcelo Cabrera | YouTube | NO_ASSET_CONFIRMED | SIN_CUENTA |
| Leonardo Morales | Facebook | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Leonardo Morales | Instagram | ANALYST_CONFIRMED (+1 IDENTITY_CONFLICT excluido) | MEDIDO (1/1 válido) |
| Leonardo Morales | TikTok | ANALYST_CONFIRMED | NO_PROBADO |
| Leonardo Morales | X | ANALYST_CONFIRMED | MEDIDO (1/1) |
| Leonardo Morales | YouTube | NO_ASSET_CONFIRMED | SIN_CUENTA |

---

## 11. SIN_CUENTA — auditoría de honestidad

Las 4 celdas `SIN_CUENTA` (Pedro/YT, Vega/YT, Marcelo/YT, Leonardo/YT)
tienen `discoveryConfirmada: true` porque un gate anterior real
(`P-CAND-SOCIAL-COVERAGE-01`) ejecutó discovery de YouTube para estos
candidatos y no encontró canal — decisión ya tomada con evidencia, no
reabierta aquí. Ninguna de las 4 tiene referencia de analista para
YouTube. **Vega/Facebook NO es `SIN_CUENTA`** — es
`NO_PROBADO_SIN_REFERENCIA`, exactamente porque no existe ni referencia
declarada ni evidencia de que se ejecutó discovery de Facebook para él.

---

## 12. Persistencia de Instagram — verificación local, 0 requests

Releídas las 6 mediciones reales persistidas en BENCH-02
(`instagram:juancvegaec`, `instagram:hmarcelocabrera`,
`instagram:marcelocabrerap`, `instagram:leonardomorales1988`,
`instagram:leomoralez.1425`, `instagram:lloretvaldivieso`):

- `projectId`: `alcaldia-cuenca-2027-piloto` en las 6 — correcto.
- `candidateId`: coincide con el dueño real de cada activo — correcto.
- `accountId`: clave incluye el activo (multi-asset no colapsado) —
  correcto, verificado releyendo Marcelo (3 activos, 2 snapshots
  distintos, ninguno pisó al otro).
- `provider`: `scrapecreators` en las 6 — correcto.
- `observedAt`/`capturedAt`: presente y estable en relectura — correcto.
- Dedupe: clave del Lake es
  `snapshot-<candidato>-<plataforma>-<activo_normalizado>-<instante>` — no
  se sobreescribió ningún snapshot anterior, cada relectura devuelve el
  mismo contenido.

**Deuda reusable que sigue existiendo (reportada, no escondida):** la ruta
HTTP de Instagram (`POST /observar` con `proveedorInstagram: true`) sigue
sin persistir automáticamente el snapshot del perfil medido por
proveedor — la persistencia de las 6 mediciones de BENCH-02 se hizo con un
script de gate, no por la ruta HTTP en producción. Esto ya estaba
declarado como limitación en `P-CAND-INSTAGRAM-HTTP-01` y en BENCH-02; no
es nuevo, pero sigue sin resolverse y afecta a cualquier futura llamada a
esa ruta con `proveedorInstagram: true` fuera de un gate manual.

---

## 13. Hallazgo nuevo de este gate: inconsistencia de formato de `accountId` entre pipelines

Durante la reconciliación, comparar `fichaIdentidad` (capa de identidad
consolidada, normaliza a minúsculas) contra `snapshotsDe` (snapshots reales
de observación) reveló **4 mismatches de formato**, todos en snapshots
más antiguos que la capa de identidad consolidada:

| Candidato | Plataforma | accountId del snapshot | accountId de la identidad consolidada |
|---|---|---|---|
| Paúl Carrasco | YouTube | `youtube:@paulcarrascocarpio9219` | `youtube:ucxp6qogn2ksjfcea-izjmdw` (channel ID, no handle) |
| Juan Carlos Vega | X | `x:JuanCVegaEC` | `x:juancvegaec` (solo diferencia de mayúsculas) |
| Yaku Pérez | YouTube | `youtube:@yakuperez4230` | `youtube:yakuperez4230` (prefijo `@`) |
| Marcelo Cabrera | X | `x:MarceloHCabrera` | `x:marcelohcabrera` (solo diferencia de mayúsculas) |
| — | — | *(Paúl/YouTube es el único caso handle-vs-channel-ID; los otros 3 son solo case)* | |

**Esto NO afectó la matriz final del BENCH-02 original** porque su
inventario se construyó leyendo `cuentasReferencia`/`activosDeCandidato`
directamente (misma fuente que los snapshots viejos), sin pasar por la
capa `fichaIdentidad` normalizada. Pero **sí habría producido falsos
`NO_PROBADO`** si algún futuro benchmark construyera su matriz a partir de
`fichaIdentidad` sin normalizar antes de comparar contra snapshots — como
ocurrió al primer intento de esta misma reconciliación (ver el script de
este gate, que normaliza case y prefijo `@` antes de comparar). **Gap real
para un gate futuro:** unificar el formato de `accountId` entre el
pipeline de observación X/YouTube antiguo y la capa de identidad
consolidada — no se corrigió aquí porque tocar datos persistidos está
fuera del alcance de un gate de reconciliación de solo lectura.

---

## 14. Conteo primario exacto (mutuamente exclusivo, suma = 35)

| primaryStatus | Cuántas |
|---|---|
| MEDIDO | 16 |
| PARCIAL | 7 |
| SIN_CUENTA | 4 |
| NO_PROBADO | 6 |
| NO_PROBADO_SIN_REFERENCIA | 1 |
| REQUIERE_PROVEEDOR | 1 |
| **TOTAL** | **35** |

Referencias del analista: **27 encontradas**, **27 reconocidas
correctamente** (`ANALYST_CONFIRMED`), **0 ignoradas incorrectamente**, **0
reemplazadas por discovery**. `SYSTEM_VERIFIED`: 2 celdas (Paúl/X,
Lloret/X — corroboradas por SerpAPI, no declaradas por el analista).
`IDENTITY_CONFLICT`: 1 (`instagram:leomoralez.1425`, excluido de
medición). Homónimos rechazados: 1.

---

## 15. Snapshot readiness vs. Momentum readiness

| Candidato/Plataforma | snapshotCount (activo medido) | readyForSnapshotCollection | readyForMomentum |
|---|---|---|---|
| Todos los activos con `identityState` ∈ {ANALYST_CONFIRMED, SYSTEM_VERIFIED, DISCOVERED} y ≥1 medición | 1 (la mayoría) o 2 (Paúl Carrasco/Facebook) | **true** | `INSUFFICIENT_HISTORY` |
| `instagram:leomoralez.1425` (conflicto) | 1 | **false** | `INSUFFICIENT_HISTORY` |
| Celdas `SIN_CUENTA` / `NO_PROBADO*` | 0 | n/a (sin activo medible) | `INSUFFICIENT_HISTORY` |

**Ningún candidato/plataforma tiene `readyForMomentum` distinto de
`INSUFFICIENT_HISTORY` en este gate.** No se inventó ningún umbral de
separación temporal — ni siquiera para Paúl Carrasco/Facebook, cuyos 2
snapshots están separados por minutos de la misma sesión, no por un
período real. `readyForSnapshotCollection = true` es la clasificación
correcta para 23 de las 35 celdas: pueden empezar a acumular historia real
en la próxima sesión de observación, aunque hoy no tengan aún ninguna serie
válida para Momentum.

---

## 16. Candidate readiness (sin cambios respecto a BENCH-02)

**OPERATIVO_CON_LIMITACIONES.** Esta reconciliación no cambió el conteo
real de cobertura (35 celdas siguen siendo 16/7/4/6/1/1) — solo corrigió
la tabla resumen y añadió la capa de identidad. La clasificación de
readiness de BENCH-02 sigue vigente.

---

## 17. Tests

**Nuevo:** `tests/socialBenchmarkIdentity.test.mjs` — 14 casos, todos
verdes: exactamente 35 celdas con `primaryStatus` mutuamente exclusivo y
suma exacta 35; referencia del analista como semilla fuerte de identidad;
`ANALYST_CONFIRMED` nunca degrada a `NO_PROBADO` de identidad;
`ANALYST_CONFIRMED != SYSTEM_VERIFIED` automático; la referencia del
analista no detiene el discovery completo; identity state separado de
measurement state; conflicto de identidad excluye al activo de la
medición; homónimo rechazado con evidencia preservada (nunca borrada);
multi-asset preservado con identidades mixtas; `SIN_CUENTA` exige
`discoveryConfirmada` explícita; snapshot readiness ≠ momentum readiness;
`readyForSnapshotCollection = false` para un activo en conflicto; pureza/
project isolation del clasificador; `null` en followers no se confunde con
0 al excluir por conflicto.

**Regresión completa:** `node --test tests/*.test.mjs` — **48/48 archivos,
0 fallos** (incluye los 14 tests de `socialBenchmarkMatrix.test.mjs` del
gate anterior, sin ningún cambio de comportamiento).

---

## 18. Requests / créditos

**0 requests externas. 0 créditos consumidos.** Toda la reconciliación se
hizo releyendo `fichaIdentidad` y `snapshotsDe` ya persistidos. El único
punto que no pudo resolverse sin red — confirmar de forma definitiva si
`leomoralez.1425` pertenece o no a otra persona real (más allá de la
lectura de su bio ya medida) — **no se intentó resolver con una nueva
llamada**; se documentó como conflicto abierto para revisión humana,
conforme a la preferencia absoluta de 0 requests de este gate.

---

## 19. Commit

Archivos propios únicamente:
- `apps/backend/services/intelligence/socialBenchmarkMatrix.js` (extensión aditiva)
- `apps/backend/tests/socialBenchmarkIdentity.test.mjs` (nuevo)
- `docs/P-CAND-SOCIAL-BENCH-02A.md` (nuevo)

`package.json`, `SENTINEL_PROJECT_STATE.md`, y todo archivo de
Territorial/Media/Data Platform quedaron sin tocar (dirty foreign
verificado antes de commitear, igual que en el gate base).

---

## 20. Gaps reales restantes

1. **TikTok** sigue siendo la plataforma con menor cobertura (6 de 7
   candidatos sin medición real) — sin cambios respecto a BENCH-02.
2. **Inconsistencia de formato de `accountId`** entre el pipeline de
   observación X/YouTube y la capa de identidad consolidada (sección 13) —
   nuevo hallazgo de este gate, no corregido (fuera de alcance de
   reconciliación de solo lectura).
3. **Persistencia automática de Instagram vía HTTP** sigue pendiente
   (sección 12) — limitación ya conocida, no resuelta aquí.
4. **`instagram:leomoralez.1425`** sigue como `IDENTITY_CONFLICT` abierto,
   pendiente de decisión final de un analista humano (¿retirar la
   declaración del expediente, o dejarla marcada permanentemente como
   rechazada?).
5. **Facebook**: en 5 de 7 candidatos solo se midió 1 de 2 páginas
   declaradas — sin cambios respecto a BENCH-02.

---

## Siguiente gate recomendado

**No se inicia aquí.** El gap de mayor impacto identificado en ambos
gates (BENCH-02 y esta reconciliación) sigue siendo el cierre de TikTok.
Un segundo candidato de alto valor para el siguiente gate es resolver la
inconsistencia de `accountId` entre pipelines (sección 13), porque puede
producir falsos negativos silenciosos en cualquier herramienta futura que
lea `fichaIdentidad` en vez de `cuentasReferencia` directamente.
