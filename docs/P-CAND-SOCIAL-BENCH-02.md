# P-CAND-SOCIAL-BENCH-02

**Benchmark real — 7 candidatos x 5 redes, proyecto `alcaldia-cuenca-2027-piloto`**
2026-09-01 · **10 créditos ScrapeCreators consumidos de 81** (6 Instagram, 4
Facebook; 1 intento adicional falló con `credits_charged: 0`) · **~71
créditos restantes**

> Primer benchmark end-to-end de Candidate Intelligence: no valida un
> conector aislado, mide la cobertura de datos REAL de los 7 candidatos del
> piloto sobre las 5 plataformas objetivo, reutilizando todo lo persistido
> antes de gastar un solo crédito nuevo.

**Importante — alcance del lenguaje:** "cobertura" en este documento
significa exclusivamente **cobertura de medición de datos** (¿existe un
snapshot real, de qué fuente, de cuándo?). No se usa, ni se calcula, ninguna
noción de popularidad, influencia, intención de voto o desempeño político.
Los números de seguidores se reportan como el dato crudo que son, no como
una métrica de éxito.

---

## 1. Candidatos reales del piloto (7, ninguno inventado)

| # | candidatoId | Nombre |
|---|---|---|
| 1 | paul-carrasco-carpio | Paúl Carrasco Carpio |
| 2 | juan-cristobal-lloret-valdivieso | Juan Cristóbal Lloret Valdivieso |
| 3 | pedro-palacios-ullauri | Pedro Palacios Ullauri |
| 4 | juan-carlos-vega | Juan Carlos Vega |
| 5 | yaku-perez | Yaku Pérez |
| 6 | marcelo-cabrera-palacios | Marcelo Cabrera Palacios |
| 7 | leonardo-morales | Leonardo Morales |

---

## 2. Matriz ejecutiva (7 x 5 = 35 celdas, todas explícitas)

| Candidato | Facebook | Instagram | TikTok | X | YouTube |
|---|---|---|---|---|---|
| Paúl Carrasco | PARCIAL (1/2, 119 000) | MEDIDO (985) | NO_PROBADO⚑ | NO_PROBADO | MEDIDO (15) |
| Lloret Valdivieso | PARCIAL (1/2, 55 855, propio) | MEDIDO (2/2: 10 822 oficial + 360 proveedor) | REQUIERE_PROVEEDOR (identidad sí, métrica no) | MEDIDO (29 413) | MEDIDO (26) |
| Pedro Palacios | PARCIAL (1/2, 57 000) | MEDIDO (9 718) | NO_PROBADO | MEDIDO (29 372) | SIN_CUENTA |
| Juan Carlos Vega | NO_PROBADO_SIN_REFERENCIA | MEDIDO (4 743) | NO_PROBADO | MEDIDO (2 502) | SIN_CUENTA |
| Yaku Pérez | PARCIAL (1/2, 531 000) | PARCIAL (1/2, 83 233) | MEDIDO (519 300) | MEDIDO (131 305) | MEDIDO (857) |
| Marcelo Cabrera | PARCIAL (1/2, 60 000) | PARCIAL (2/3, 11 094 + 654) | NO_PROBADO | MEDIDO (48 742) | SIN_CUENTA |
| Leonardo Morales | MEDIDO (7 700) | MEDIDO (2/2, 1 047 + 48 510⚑) | NO_PROBADO⚑ | MEDIDO (2 270) | SIN_CUENTA |

`⚑` = riesgo de atribución declarado explícitamente en la sección 9. Ningún
número entre paréntesis es una interpretación: es exactamente el `followers`
persistido en el snapshot.

### Tally de estados (35 celdas)

| Estado | Cuántas | Significado |
|---|---|---|
| MEDIDO | 16 | Todos los activos declarados de esa celda tienen medición real |
| PARCIAL | 7 | Multi-activo: algunos medidos, otros no (nunca colapsado) |
| SIN_CUENTA | 4 | Discovery real se ejecutó (P-CAND-SOCIAL-COVERAGE-01) y no encontró cuenta |
| NO_PROBADO | 7 | Cuenta(s) declarada(s), nunca medida por ninguna vía |
| NO_PROBADO_SIN_REFERENCIA | 1 | Ni siquiera existe referencia declarada por el analista (Vega/Facebook) |
| REQUIERE_PROVEEDOR | 1 | Identidad confirmada, sin métrica todavía (TikTok Lloret) |
| **Total** | **35** | — |

Ninguna celda quedó "no sabemos". `NO_PROBADO_SIN_REFERENCIA` es
deliberadamente distinto de `SIN_CUENTA`: para Vega, Facebook nunca se
declaró ni se investigó — no es lo mismo que investigar y no encontrar nada.

---

## 3. Qué cambió en este gate (mediciones reales nuevas)

### 3.1 Instagram — vía HTTP real (`POST /observar`, `proveedorInstagram:true`)

Ejecutado contra un servidor Express real (instancia efímera con el mismo
`routes/projects.js`, para no reiniciar el servidor compartido en 3001 que
usan otras terminales), con `SOCIAL_EXTERNAL_PROVIDER_ENABLED=true` y
credencial real de ScrapeCreators:

| Candidato | Activo | Resultado |
|---|---|---|
| Juan Carlos Vega | `juancvegaec` | MEDIDO_PROVEEDOR, 4 743 seguidores |
| Marcelo Cabrera | `hmarcelocabrera` | MEDIDO_PROVEEDOR, 11 094 seguidores |
| Marcelo Cabrera | `hugo_marcelo_cabrera_palacios` | **Falló**: `ERROR_PROVEEDOR`, IG bloqueó al proveedor (500, `credits_charged: 0`) |
| Marcelo Cabrera | `marcelocabrerap` | MEDIDO_PROVEEDOR, 654 seguidores |
| Leonardo Morales | `leonardomorales1988` | MEDIDO_PROVEEDOR, 1 047 seguidores |
| Leonardo Morales | `leomoralez.1425` | MEDIDO_PROVEEDOR, 48 510 seguidores — **ver riesgo de atribución, sección 9** |
| Lloret Valdivieso | `lloretvaldivieso` | MEDIDO_PROVEEDOR, 360 seguidores |

6 créditos consumidos, 1 intento con 0 créditos cobrados (falla del
proveedor, no nuestra). El fallo NO tumbó la observación de los demás
activos del mismo candidato ni del mismo request — verificado en la
respuesta real.

**Hallazgo de este gate:** la ruta HTTP mide en vivo pero **no persistía**
snapshot del perfil medido por proveedor — limitación declarada
explícitamente en `P-CAND-INSTAGRAM-HTTP-01` sección 12. Este gate corrigió
ese vacío: las 6 mediciones reales se persistieron con
`guardarSnapshots`, verificado por relectura de inventario después de
escribir.

### 3.2 Facebook — llamada directa al proveedor (sin ruta HTTP: no existe todavía)

No hay ruta HTTP de fallback para Facebook (a diferencia de Instagram); se
reutilizó el mismo patrón validado en `SOCIAL-PROVIDER-REAL-02`
(`pedirAlProveedor` + `perfilDeFacebook` + `guardarSnapshots`), solo perfil,
sin publicaciones ni comentarios (control de presupuesto):

| Candidato | Página | Seguidores reales |
|---|---|---|
| Paúl Carrasco | `paulernestocarrascoc` | 119 000 |
| Yaku Pérez | `yakuperezgu` | 531 000 |
| Marcelo Cabrera | `marcelocabrerap` | 60 000 |
| Leonardo Morales | `leonardomoralesab` | 7 700 |

4 créditos consumidos, 4/4 exitosos.

---

## 4. Presupuesto real vs. declarado

- **Declarado antes de ejecutar:** máximo ~25 créditos, preferencia de
  reutilizar primero.
- **Ejecutado:** 10 créditos (6 Instagram + 4 Facebook), muy por debajo del
  techo.
- **Créditos restantes estimados:** ~71 de 81 (el conteo exacto lo confirma
  el propio proveedor en la respuesta de cada llamada; el último valor
  observado fue `credits_remaining: 79` a mitad del lote de Instagram, antes
  de las 4 llamadas de Facebook).
- **Por qué no se gastó más:** cada celda que quedó `NO_PROBADO` o
  `PARCIAL` es una decisión, no un olvido — se prefirió demostrar el
  patrón multi-candidato/multi-activo con datos reales en las plataformas de
  mayor vacío (Instagram personal, Facebook de terceros) antes que agotar el
  presupuesto persiguiendo el 100% de las celdas.

---

## 5. READY_FOR_LONGITUDINAL (≥2 snapshots comparables del mismo activo)

| Candidato | Plataforma | Activo | # snapshots | Primero | Último |
|---|---|---|---|---|---|
| Paúl Carrasco | Facebook | `paulernestocarrascoc` | 2 | 2026-09-01T04:06 | 2026-09-01T23:07 |
| Yaku Pérez | TikTok | `yaku.perez` | 2 (1 identidad + 1 métrica — **no ambos cuentan como comparables de métrica**, ver nota) |

**Nota de honestidad:** el segundo snapshot de Paúl Carrasco/Facebook se
generó en esta misma sesión (persistencia del resultado ya medido, sin
segunda llamada real), separado por minutos, no por un período relevante
para tendencia. Es técnicamente "≥2 snapshots del mismo activo" pero **no**
se recomienda usarlo todavía como serie longitudinal real — se necesita una
segunda medición en una sesión posterior, con separación de días, para que
la comparación tenga sentido. El resto de candidatos/plataformas con
medición real tienen exactamente 1 snapshot del activo medido por proveedor
en este gate: quedan listos para longitudinal en la PRÓXIMA medición, no en
esta.

---

## 6. Corpora de comentarios reales existentes (reportados, no analizados)

Ningún análisis de sentimiento, NLP o interpretación de contenido se hizo
sobre estos corpora — solo se reporta su existencia y tamaño, per el
requisito explícito de este gate.

| Candidato | Plataforma | Declarados | Observados | Texto disponible |
|---|---|---|---|---|
| Pedro Palacios Ullauri | Facebook | 122 | 10 | 10 |
| Yaku Pérez | TikTok | 110 | 20 | 20 |

Ningún otro candidato tiene corpus de comentarios persistido en este
proyecto a la fecha de este gate.

---

## 7. Los dos activos de atribución previamente marcados como riesgo

Ninguno se promovió a confirmado en este gate — ninguna nueva evidencia de
propiedad se recolectó para TikTok específicamente:

- **`@lafondadecarrasco`** (TikTok, Paúl Carrasco): sigue
  `COMPATIBLE_NO_CONFIRMADA`, **NO_PROBADO** en este benchmark (nunca
  medido). Nueva corroboración circunstancial de este gate: la página de
  Facebook real de Paúl Carrasco (`paulernestocarrascoc`) tiene como nombre
  público **"La Fonda de Carrasco"** — coincide con el handle de TikTok.
  Esto hace la atribución más plausible, pero sigue sin ser una
  confirmación (una página de Facebook y un handle de TikTok pueden
  coincidir en nombre de marca sin ser administrados por la misma persona).
- **`@leomoralesordo`** (TikTok, Leonardo Morales): sigue
  `COMPATIBLE_NO_CONFIRMADA`, **NO_PROBADO** en este benchmark. Sin cambios.

---

## 8. Gap analysis por plataforma

| Plataforma | Tipo de vacío dominante | Detalle |
|---|---|---|
| Facebook | Proveedor (parcial) | 7/7 candidatos tienen ≥1 página elegible; solo 1 de 2 páginas por candidato se midió en promedio (control de presupuesto, no imposibilidad técnica) |
| Instagram | Resuelto en gran parte | De 9 activos personales elegibles al inicio del gate, 6 quedaron medidos, 1 con error transitorio del proveedor (reintentable), 2 sin intentar (Yaku personal, Marcelo hugo_marcelo ya reintentado y fallido) |
| TikTok | Identidad vs. métrica | 5 de 7 candidatos sin ningún intento; Lloret tiene identidad confirmada sin métrica; Yaku es el único con métrica real completa |
| X | Prácticamente resuelto | 6/7 candidatos con medición oficial completa; Paúl Carrasco es el único vacío real (3 handles sin resolver desde antes de este gate) |
| YouTube | Discovery ya cerrado | 3/7 candidatos con canal medido; 4/7 confirmados `SIN_CUENTA` por discovery real de un gate anterior — no es un vacío pendiente, es un resultado |

---

## 9. Riesgo de atribución nuevo, descubierto en este gate

**`instagram:leomoralez.1425`, declarado por el analista como cuenta
personal de Leonardo Morales.** La medición real (ScrapeCreators, vía la
ruta HTTP oficial→proveedor) devolvió:

- Biografía real: *"Futbolista de @clubatleticobelgrano"*
- Cuenta **verificada**
- 48 510 seguidores

Club Atlético Belgrano es un club de fútbol argentino. Nada en el perfil
medido corresponde a un candidato político de Cuenca, Ecuador. **Esto
sugiere fuertemente un homónimo, no la cuenta del candidato.**

El snapshot se persistió tal cual —el dato real no se descarta—, pero se
etiquetó explícitamente con esta advertencia en `limitations`, y esta celda
**no debe contarse como cobertura confiable** hasta que un analista revise
manualmente la atribución. Se recomienda como acción de seguimiento directa
antes de cualquier uso de este número.

---

## 10. Project isolation

Verificado explícitamente: las 10 llamadas reales de este gate (6 Instagram
+ 4 Facebook) se dirigieron todas a cuentas y candidatos de
`alcaldia-cuenca-2027-piloto`; cada snapshot persistido lleva
`projectId: "alcaldia-cuenca-2027-piloto"` y `accountId` como parte de la
clave del Lake (no colapsa multi-activo, patrón ya establecido en
P-CAND-TIKTOK-01). No se leyó, escribió, ni referenció ningún otro proyecto
en ningún momento de este gate.

---

## 11. Pruebas

**Nuevo:** `services/intelligence/socialBenchmarkMatrix.js` — módulo real
(no un script de un solo uso) que clasifica cualquier celda
candidato×plataforma en un estado explícito a partir de activos y
snapshots ya persistidos, sin red. `tests/socialBenchmarkMatrix.test.mjs` —
**14/14**, casos A–N: cobertura completa de 35 celdas, ningún estado
null/"no sabemos", multi-activo preservado, oficial gana sin proveedor,
fallback correctamente solicitado, SIN_CUENTA nunca fabricado sin
`discoveryConfirmada` explícita, null no se confunde con 0, identity-only
(oEmbed) no cuenta como métrica, project isolation documentada, provenance
sin confundir proveedor con oficial, error de un activo no tumba el resto,
el clasificador es puro (cero red), y READY_FOR_LONGITUDINAL exige ≥2
snapshots reales del mismo activo (no identity-only).

**Regresión completa:** 47 suites de prueba de Candidate/Territorial/Media
ejecutadas (`node --test tests/*.test.mjs`), **0 fallos** en ninguna,
incluidas las 4 suites reales de Instagram/proveedor que este gate no tocó
en su lógica (`instagramHttpFallback`, `instagramProviderFallback`,
`socialProviderClient`, `igRoute`).

**Frontend:** `npm run build` en `apps/web` — build limpio (solo la
advertencia preexistente de tamaño de chunk, no relacionada). `npm run
lint` — 6 errores preexistentes en `Dashboard.jsx` y `KnowledgeGraph.jsx`,
ninguno tocado por este gate ni por ningún gate de Candidate Intelligence;
fuera de alcance.

---

## 12. Clasificación de readiness — Candidate Intelligence Social

**OPERATIVO_CON_LIMITACIONES.**

Justificación: 23 de 35 celdas (66%) tienen al menos una medición real
(`MEDIDO` + `PARCIAL`); las plataformas de mayor solidez (X, YouTube) están
prácticamente resueltas por discovery + medición oficial; Instagram pasó de
tener 9 activos personales sin tocar a 6 medidos en este gate; Facebook
tiene el patrón de proveedor validado en 5 candidatos distintos. Las
limitaciones que impiden `OPERATIVO` sin calificar: TikTok sigue
mayormente sin medir (solo 1/7 con métrica real), Facebook mide solo 1 de
2 páginas por candidato en promedio, y un riesgo de atribución real
(sección 9) exige revisión humana antes de reportar esa celda como
confiable.

---

## 13. Limitaciones declaradas

- Instagram: `hugo_marcelo_cabrera_palacios` sigue sin medir tras un fallo
  transitorio real del proveedor (IG bloqueando ScrapeCreators, no un
  límite de cuota ni de credencial) — reintentable sin rediseño.
- Facebook: solo se midió 1 página por candidato (control de presupuesto);
  la segunda página declarada de Paúl, Pedro, Yaku y Marcelo sigue
  `REQUIERE_PROVEEDOR`.
- No se pidieron publicaciones ni comentarios nuevos de Facebook ni
  Instagram en este gate — solo perfil, para mantener el presupuesto bajo.
- TikTok sigue siendo la plataforma con menor cobertura del benchmark: 5 de
  7 candidatos sin ningún intento de medición.
- `instagram:leomoralez.1425` (Leonardo Morales) tiene un riesgo de
  atribución real y no resuelto — ver sección 9.
- `apps/backend/package.json` sigue mezclado entre terminales — no se tocó.
- `SENTINEL_PROJECT_STATE.md` — ver decisión en el reporte final de este
  gate.

---

## 14. Próximo gate sugerido (no iniciado en este gate)

Cerrar TikTok (5 candidatos sin medir) y la segunda página de Facebook por
candidato, además de resolver manualmente el riesgo de atribución de
`leomoralez.1425`, serían los pasos de mayor impacto para pasar de
`OPERATIVO_CON_LIMITACIONES` a `OPERATIVO`. **No se inicia aquí** — fuera
del alcance de este gate.
