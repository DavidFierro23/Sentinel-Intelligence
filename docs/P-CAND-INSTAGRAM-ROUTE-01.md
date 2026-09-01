# P-CAND-INSTAGRAM-ROUTE-01

**Conectar el fallback real de Instagram al flujo de observación**
2026-09-01 · **0 requests externas** (todo probado con `fetch` inyectado) · **81 créditos ScrapeCreators sin tocar**

> Este gate no mide cobertura nueva de ningún candidato. Conecta un mecanismo
> ya validado con datos reales (`P-CAND-INSTAGRAM-FALLBACK-01`, commit
> `06bf6fe`) al flujo que Candidate Intelligence usa de verdad.

---

## 1. Qué estaba pendiente

El gate anterior dejó todo construido y probado por separado:

    socialSourceRouting.js          decide la fuente (21 tests)
    instagramProviderFallback.js    compone routing + cliente + mapper (13 tests)

pero **ninguno de los dos estaba conectado** a `observarCandidato`, que es la
función que Candidate Intelligence invoca de verdad para observar un
candidato. El fallback existía y funcionaba en aislamiento; no se podía
disparar desde el flujo real.

---

## 2. Arquitectura final

```
observarCandidato({ ..., proveedorInstagram })
  │
  ├─ cuenta.plataformaId === "instagram"
  │
  ├─ 1. observarInstagram()              ← Meta oficial, SIN CAMBIOS
  │
  ├─ 2. ¿proveedorInstagram presente?
  │      │
  │      NO  → resultado = r (oficial), tal cual siempre
  │      │
  │      SÍ  → observarInstagramConFallback({ cuenta, resultadoOficial: r, ... })
  │             │
  │             ├─ fuenteParaActivo() decide:
  │             │    r.estado === OBSERVADA        → no llama al proveedor
  │             │    r.estado ∈ OFICIAL_NO_PUEDE    → SÍ llama al proveedor
  │             │    r.estado ∈ OFICIAL_FALLO_TEMPORAL → no llama (se arregla solo)
  │             │
  │             └─ pedirAlProveedor() (guarda de bandera+aprobación+credencial)
  │                    │
  │                    OK  → perfilDeInstagram() mapea → MEDIDO_PROVEEDOR
  │                    NO  → resultado = { ...r, proveedorError }, estado oficial intacto
```

**Cuándo gana Meta:** siempre que `observarInstagram()` devuelva `OBSERVADA`.
El proveedor ni se consulta — la decisión ocurre dentro de
`fuenteParaActivo()`, reutilizada sin duplicar.

**Cuándo entra ScrapeCreators:** solo cuando el estado oficial está en
`OFICIAL_NO_PUEDE` (`NO_SOPORTADO_PERSONAL` es el caso real medido: cuentas de
Instagram declaradas personales). Estados de **fallo temporal nuestro**
(`CREDENCIAL_EXPIRADA`, `CUOTA_AGOTADA`, `NO_EJECUTABLE` por falta de vínculo
con una Página) **NO abren el fallback** — se arreglan renovando la
credencial, no comprando el dato.

---

## 3. El opt-in, y por qué es la pieza que hace esto seguro

```js
observarCandidato({
  ...,
  proveedorInstagram: { id: "scrapecreators", entorno, fetchImpl }
})
```

`proveedorInstagram` es `null` por defecto. **Sin pasarlo, el comportamiento
de `observarCandidato` es idéntico, byte a byte, al de antes de este gate.**
Verificado ejecutando las 34 suites de Candidate Intelligence **antes y
después** de la integración: mismos 1236 checks (menos los 31 nuevos, que se
sumaron después), 0 fallos en ambos casos.

Ni siquiera pasar el objeto `proveedorInstagram` garantiza una llamada real:
por debajo siguen actuando, sin duplicarse, dos guardas ya probadas:

1. `fuenteParaActivo()` — solo abre la puerta si el estado oficial lo permite.
2. `pedirAlProveedor()` (`socialProviderClient.js`) — exige `SOCIAL_EXTERNAL_PROVIDER_ENABLED=true`,
   proveedor **aprobado** en el registro, y credencial presente. Las tres
   condiciones, siempre.

---

## 4. Estados posibles en `resultados[i]`

| `estado` | Significa | `canalProveedor` | `resultadoOficial` |
|---|---|---|---|
| `OBSERVADA` | Meta midió | — | — |
| `NO_SOPORTADO_PERSONAL` (sin opt-in, o proveedor no pudo) | Meta no alcanza; sin proveedor disponible | — | (es el mismo objeto) |
| **`MEDIDO_PROVEEDOR`** | ScrapeCreators midió lo que Meta no alcanzó | perfil mapeado | conservado íntegro |
| `NO_EJECUTABLE` | Falta infraestructura nuestra (sin Página vinculada) | — | — |

**`MEDIDO_OFICIAL` no es un string nuevo**: se decidió deliberadamente **no
renombrar** `OBSERVADA`, para no tocar la semántica que ya usan `igRoute`,
`multiAsset`, `socialCoverage` y el resto de la suite. "Meta ganó" se
reconoce porque el resultado **no tiene** `sourceKind`/`canalProveedor`, no
por un literal distinto.

---

## 5. Provenance, y la regla que no se rompe nunca

Cuando `MEDIDO_PROVEEDOR`:

```js
{
  estado: "MEDIDO_PROVEEDOR",
  sourceKind: "provider",
  provider: "scrapecreators",
  datoLicenciadoPorLaPlataforma: false,
  canalProveedor: { followers, following, mediaCount, ... },   // del proveedor
  canal: null,                                                  // NUNCA se rellena con datos ajenos
  resultadoOficial: { estado: "NO_SOPORTADO_PERSONAL", ... },  // INTACTO
  estadoOficialConservado: "NO_SOPORTADO_PERSONAL"
}
```

**`canal` (el campo que llena Meta) se deja en `null` a propósito.** Forzar el
perfil de un proveedor distinto dentro de ese campo invitaría a comparar
`followers` de Meta con `followers` de ScrapeCreators como si fueran la misma
medición — no lo son, y este gate no reinterpreta métricas.

**El estado oficial nunca desaparece.** Viaja completo en `resultadoOficial`,
no resumido. Es lo que impide que una observación de proveedor sustituya
silenciosamente a la constancia de que Meta no alcanza ese activo.

---

## 6. Los diez estados de prueba exigidos, uno por uno

| # | Caso | Resultado verificado |
|---|---|---|
| A | Meta mide | Proveedor no llamado (baseline sin opt-in) |
| B | Meta no soporta, proveedor habilitado | `MEDIDO_PROVEEDOR`, perfil real mapeado |
| C | Proveedor deshabilitado (sin bandera) | Estado explícito (`proveedorError.estado = "PROVEEDOR_DESHABILITADO"`), nunca excepción |
| D | Proveedor falla: 401 / 429 / timeout | No tumba la observación; `CREDENCIAL_RECHAZADA` / `CUOTA_AGOTADA` distinguidos; estado oficial preservado |
| E | Multi-activo (2 Instagram) | Los dos aparecen, cada uno con su `accountId`, ninguno colapsa |
| F | Reobservación (proxy de dedup) | `accountProviderId` idéntico entre dos ejecuciones |
| G | Provenance | `MEDIDO_PROVEEDOR !== OBSERVADA`, nunca se confunden |
| H | Project isolation | Mismo `accountId` en dos `projectId` distintos no comparte estado |
| I | Budget guard | Proveedor con bandera+clave pero **sin aprobar** sigue bloqueado (dos capas independientes) |
| C bis | Fallo temporal (`NO_EJECUTABLE`) | NO abre el fallback aunque haya opt-in |

**31/31 en `tests/candidateInstagramFallbackRoute.test.mjs`**, sin red.

---

## 7. Presupuesto de este gate

**0 requests externas.** Todo se probó con `fetch` inyectado reproduciendo la
forma real ya medida sobre `@paulcarrascoc` en el gate anterior. No se repitió
`profile`, `posts` ni `comments` reales — no hacía falta: lo que cambiaba era
el cableado, no la respuesta del proveedor, que ya está certificada.

**81 créditos de ScrapeCreators, sin tocar.**

---

## 8. Limitaciones

- El opt-in solo cubre **perfil** (igual que `instagramProviderFallback.js`).
  Publicaciones y comentarios vía proveedor siguen sin estar en el flujo
  automático — se ejecutaron como scripts puntuales en el gate anterior.
- La ruta HTTP (`routes/projects.js`, `POST /observar`) **sigue sin pasar**
  `proveedorInstagram`. La integración de este gate vive en la capa de
  servicio (`candidateObservation.js`); activar el fallback desde la interfaz
  real exige que la ruta construya y pase ese objeto, con su propio diseño de
  presupuesto de créditos por request HTTP — deliberadamente fuera de este
  gate corto.
- `NO_EJECUTABLE` (falta de Página vinculada) **no abre el fallback**, ni
  antes ni ahora. Es una decisión ya tomada en el gate de routing: no se
  reabre aquí.
- `package.json` sigue con cambios mezclados de otras terminales — no se
  tocó, ni para registrar la nueva suite de tests.

---

## 9. Qué queda listo para `P-CAND-SOCIAL-BENCH-02`

- El **motor** de fallback está conectado y probado end-to-end a nivel de
  servicio: dado un candidato con activos de Instagram, `observarCandidato`
  puede resolver oficial→proveedor→estado explícito sin intervención manual.
- **No está conectado a la ruta HTTP.** El benchmark de los 7 candidatos, si
  se ejecuta a través de la ruta real, seguirá viendo Instagram solo por Meta
  oficial. Si se ejecuta invocando `observarCandidato` directamente con
  `proveedorInstagram` configurado, sí vería el fallback.
- Los 9 activos personales de Instagram del piloto **siguen sin medirse
  masivamente** — este gate no ejecutó ninguna medición nueva, solo conectó
  el mecanismo.
