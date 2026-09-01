# P-CAND-INSTAGRAM-FALLBACK-01

**ScrapeCreators como fallback real de Instagram cuando Meta oficial no alcanza**
2026-08-31 · **5 requests · 5 créditos (86→81) · $0 USD** (dentro del saldo gratuito)

> Este gate **no mide cobertura actual** de ningún candidato. Valida el
> **mecanismo** de fallback con dos activos reales del proyecto piloto.

---

## 1. Objetivo

Meta oficial (`business_discovery`) solo alcanza cuentas de Instagram
Business/Creator. 9 de los 12 activos del piloto son personales y quedan
`NO_SOPORTADO_PERSONAL` — cero cobertura por vía oficial, sin remedio posible
por ese camino.

Este gate demuestra que ScrapeCreators **sí puede medir esos 9 activos**, y
deja construida la regla de decisión que evita que un dato raspado sustituya
a uno oficial cuando el oficial ya funciona.

---

## 2. Activos usados (leídos del Lake, no inventados)

### CONTROL — `@pedropalaciosu`
Activo que Meta **ya mide** (`MEDIDO_TERCERO`, `business_discovery`). Sirve
para comprobar consistencia: si ScrapeCreators devuelve algo muy distinto
para una cuenta que ya conocemos, es señal de que el mapeo está mal.

- **id:** `11337989179`
- **followers observados:** 9.718 · **following:** 227 · **posts declarados:** 12
- Coincide razonablemente con la medición oficial de Meta.
- **Finalidad: control de consistencia. NO se interpreta como popularidad
  electoral.**

### FALLBACK — `@paulcarrascoc`
Único Instagram de Paúl Carrasco Carpio, **personal** (`NO_SOPORTADO_PERSONAL`
en Meta). Su cobertura de Instagram es **cero** por vía oficial — es el hueco
real, no un ejemplo de laboratorio.

- **id:** `3623701117`
- **followers observados:** 985 · **following:** 200 · **posts declarados:** 266
- **12 publicaciones devueltas en la muestra**, todas de **2019** (21 sep – 10
  oct). **La cuenta está inactiva desde hace años.**
- **5 comentarios reales observados**, cobertura de esa muestra: **5 de 5
  declarados** (`COMPLETA`).

**No se presenta `@paulcarrascoc` como actividad actual.** El activo sirve
para validar técnicamente el mecanismo de fallback, no para afirmar presencia
digital vigente del candidato.

---

## 3. Requests y créditos

| # | Endpoint | Estado | Créditos restantes |
|---|---|---|---|
| 1 | `perfil` control `pedropalaciosu` | OK | 85 |
| 2 | `perfil` fallback `paulcarrascoc` | OK | 84 |
| 3 | `publicaciones` fallback | OK | 83 |
| 4 | `comentarios` fallback | OK | 82 |
| 5 | rerun `perfil` fallback | OK | 81 |

**5 requests, 5 créditos, 86→81, $0 USD** (saldo gratuito). **Ninguna request
adicional se ejecutó durante el cierre de este gate** — todo lo de este
documento, salvo lo ya listado arriba, sale de datos recuperados de la
ejecución anterior.

---

## 4. Validaciones técnicas

- **Persistencia real:** snapshot de cuenta, 12 publicaciones, corpus de 5
  comentarios, todo vía los contratos existentes (`accountContracts`,
  `externalSocialProvider`, `commentObservation`).
- **Dedup / rerun:** id de cuenta estable (`3623701117`), publicaciones
  `3→3` sin duplicar (verificado en el rerun de perfil, que no reescribe
  publicaciones), `firstObservedAt` inmóvil, `observationCount` `1→2`.
- **Project isolation:** verificado contra los otros proyectos del Lake — 0
  fugas de datos de `alcaldia-cuenca-2027-piloto` en ningún otro proyecto.
- **Provenance:** `provider: "scrapecreators"`, `datoLicenciadoPorLaPlataforma: false`,
  `sourceKind: "provider"`. Ninguna credencial persistida ni expuesta.
- **Estado Meta previo conservado:** el snapshot del fallback registra
  explícitamente que la vía oficial dio `NO_SOPORTADO_PERSONAL` — ese motivo
  **no se sobrescribe** por haber medido con el proveedor.

---

## 5. Arquitectura de routing (`socialSourceRouting.js`)

Regla, por **activo** y no por candidato:

    1. Meta oficial, si esa vía puede medir ESE activo.
    2. ScrapeCreators, solo si la oficial no puede.
    3. Estado explícito (SIN_FUENTE), si ninguna puede.

Estados: `MEDIDO_OFICIAL`, `MEDIDO_PROVEEDOR`, `SIN_FUENTE`, `NO_PROBADO`.

**Por qué por activo:** Yaku Pérez tiene `@yakuperezg` (profesional, Meta lo
mide) y `@yaku_perez` (personal, Meta no). Enrutar por candidato mandaría los
dos al proveedor y perdería la medición oficial —mejor dato y gratis— del
primero.

**Un fallo temporal de la oficial NO abre el fallback.** `CREDENCIAL_EXPIRADA`,
`CUOTA_AGOTADA` y similares no son motivo de fallback: se arreglan renovando
la credencial, no comprando el dato. Solo los estados que significan «esta vía
no alcanza y no lo hará» (`NO_SOPORTADO_PERSONAL`, `BLOQUEADO_META`,
`REQUIERE_PPCA`, etc.) abren la puerta.

**El proveedor nunca funde cifras con la oficial.** Son dos observaciones con
dos procedencias (`marcaDeFuente`), nunca un promedio.

21 tests sintéticos cubren: prioridad oficial, fallback real, estado
explícito sin fuente, no-fallback por fallo temporal, routing por activo (caso
Yaku), multi-asset sin colapsar (3 activos de Marcelo Cabrera), preservación
del estado oficial, y aislamiento conceptual entre proyectos.

---

## 6. Routing: **PREPARADO_NO_ENGANCHADO** en la ruta HTTP

Existe una función orquestadora real y probada —
`services/intelligence/instagramProviderFallback.js`— que compone
`socialSourceRouting` + `socialProviderClient` + `scrapeCreatorsMapper` y
**sí llama al cliente genérico real** (13 tests con `fetch` inyectado, sin
red). Dado un `resultadoOficial` de `observarInstagram()`, decide si cae al
proveedor y devuelve un perfil mapeado con la marca de fuente correcta,
**preservando siempre el resultado oficial intacto**.

**Lo que falta, y por qué no se hizo en este gate:** ni `candidateObservation.js`
ni `routes/projects.js` (`POST /observar`) invocan todavía esta función. Esos
dos archivos sostienen la mayoría de la suite de Candidate Intelligence
(`igRoute`, `multiAsset`, `socialCoverage`, `realObservation`,
`candidateIntelligence`, `crossLinkEvidence`, `baselineT0` — 1205 checks en
total). Engancharlo ahí exige además diseñar presupuesto de créditos y manejo
de errores por HTTP, que es más superficie de la autorizada para un gate
corto.

**Punto de integración exacto que queda pendiente:** en
`candidateObservation.js`, dentro del bloque `if (cuenta.plataformaId ===
"instagram")` de `observarCandidato` (línea ~1177), tras obtener `r` de
`observarInstagram()`, invocar `observarInstagramConFallback({ cuenta,
resultadoOficial: r })` cuando `r.estado` esté en `OFICIAL_NO_PUEDE`, de forma
**opt-in** (parámetro nuevo, sin cambiar el comportamiento de ningún llamador
existente).

---

## 7. Limitaciones

- ScrapeCreators **raspa web pública; no es proveedor licenciado** por
  Instagram/Meta. Va contra los ToS aunque el dato sea público.
- **Histórico no verificado**: no se paginó en ninguna llamada.
- La muestra de 12 publicaciones **no equivale al histórico completo** (266
  declaradas).
- El fallback se validó técnicamente con **una cuenta personal antigua**
  (inactiva desde 2019) — el mecanismo funciona; no implica que todos los
  activos personales tengan actividad reciente medible.
- El orquestador de fallback solo pide **perfil**; no incluye publicaciones ni
  comentarios (esos ya se ejecutaron como script puntual en este gate, no como
  servicio reutilizable).

---

## 8. Veredicto

**Instagram queda con arquitectura de tres niveles, validada técnicamente:**

    Meta oficial (primario)
      → ScrapeCreators (fallback por activo, cuando Meta no alcanza)
        → estado explícito (SIN_FUENTE) si ninguno puede

`MEDIDO_OFICIAL` / `MEDIDO_PROVEEDOR` / `SIN_FUENTE` / `NO_PROBADO` cubren
todos los casos sin colapsar ausencias en ceros ni en "sin datos" genérico.

**El mecanismo funciona con datos reales.** Lo que falta es conectarlo a la
ruta HTTP de observación — trabajo identificado, acotado y no ejecutado en
este gate por disciplina de alcance.
