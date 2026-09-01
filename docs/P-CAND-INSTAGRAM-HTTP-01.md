# P-CAND-INSTAGRAM-HTTP-01

**Activar Instagram oficial→proveedor en la ruta HTTP real**
2026-09-01 · **0 requests externas** (todo probado con `fetch` inyectado) · **81 créditos ScrapeCreators sin tocar**

> Último tramo del cable. `P-CAND-INSTAGRAM-ROUTE-01` conectó el fallback a
> `observarCandidato`; este gate conecta la ruta HTTP real a ese mismo
> `observarCandidato`, sin tocar ni reimplementar nada de lo ya construido.

---

## 1. Qué faltaba

`observarCandidato` ya soportaba el parámetro `proveedorInstagram`, probado
exhaustivamente a nivel de servicio. Pero `routes/projects.js` — la ruta que
Sentinel usa de verdad — nunca lo pasaba. Por HTTP, Instagram seguía viendo
solo Meta oficial.

---

## 2. Ruta HTTP exacta

```
POST /api/proyectos/:proyectoId/candidatos/:candidatoId/observar
```

`apps/backend/routes/projects.js`, línea ~1277. Es el **único** llamador de
`observarCandidato` en todo el backend (verificado por grep). Ninguna ruta
`GET` lo invoca — `GET /identidad` y `GET /inteligencia` usan
`fichaIdentidad()` y `componerInteligencia()` respectivamente, funciones
completamente distintas que nunca tocan Meta ni ningún proveedor externo.

---

## 3. El opt-in: dos capas, ninguna suficiente por sí sola

```json
POST /observar
{
  "plataformas": ["instagram"],
  "proveedorInstagram": true
}
```

**Capa 1 — el cliente pide.** Sin `proveedorInstagram: true` en el cuerpo de
la petición, el comportamiento es **idéntico** al de antes de este gate.
Verificado: `igRoute.test.mjs` sigue en 30/30 sin ningún cambio.

**Capa 2 — el servidor decide si de verdad puede.** El campo del cuerpo
**nunca** se traduce directamente en una llamada real. La ruta construye:

```js
const proveedorInstagram =
  req.body?.proveedorInstagram === true
    ? { id: "scrapecreators", entorno: process.env }
    : null;
```

`entorno: process.env` — **leído del servidor, nunca del cliente.** Un
cliente no puede mandar su propia clave ni fingir que el entorno está
configurado. Por debajo, sin duplicar nada, siguen actuando las guardas ya
probadas en gates anteriores: `SOCIAL_EXTERNAL_PROVIDER_ENABLED`, el
proveedor **aprobado** en el registro (`scrapecreators`, y solo ese), y la
credencial presente.

---

## 4. Official first, verificado por HTTP real

Sobre un candidato con dos activos de Instagram (uno profesional que Meta
mide, uno personal que no):

```
POST /observar { proveedorInstagram: true }

resultados: [
  { accountId: "instagram:terceroprofesionalhttp", estado: "OBSERVADA", sourceKind: null },
  { accountId: "instagram:cuentapersonalhttp",      estado: "MEDIDO_PROVEEDOR", sourceKind: "provider" }
]

resumen: { observadas: 1, medidoProveedor: 1 }
```

**El proveedor no se llama ni una vez para el activo que Meta ya mide** —
contado por interceptor de red, verificado en la suite. El routing sigue
siendo **por activo**, no por candidato: es exactamente el diseño de
`socialSourceRouting.js`, ahora demostrado por HTTP.

---

## 5. Cost guard: qué puede llamar al proveedor y qué no

| Acción | ¿Puede disparar el proveedor? |
|---|---|
| `POST /observar` con `proveedorInstagram: true` | **Sí**, y solo por activo elegible |
| `POST /observar` sin ese campo | No — comportamiento de siempre |
| `GET /identidad` | **No** — no llama a `observarCandidato` |
| `GET /inteligencia` | **No** — usa `componerInteligencia`, otro motor |
| Listar candidatos, abrir proyecto, navegación UI | **No** — ninguna de esas rutas toca observación |

Verificado explícitamente (test I): un `GET /identidad` con el entorno
completamente habilitado para el proveedor hace **cero** llamadas a
`api.scrapecreators.com`.

---

## 6. Estados en la respuesta HTTP

Se reutilizan los nombres reales del contrato existente — **ninguna
taxonomía paralela**:

| Campo | Cuándo aparece |
|---|---|
| `estado: "OBSERVADA"` | Meta midió (sin cambios respecto a siempre) |
| `estado: "NO_SOPORTADO_PERSONAL"` | Meta no alcanza; sin proveedor o proveedor no habilitado |
| `estado: "MEDIDO_PROVEEDOR"` | ScrapeCreators midió lo que Meta no alcanzó |
| `sourceKind`, `provider` | Solo presentes cuando `MEDIDO_PROVEEDOR` |
| `canalProveedor` | Perfil mapeado del proveedor, **nunca** dentro de `canal` |
| `estadoOficialConservado` | La razón por la que Meta no alcanzaba, conservada siempre |
| `proveedorIntentado`, `proveedorError` | Cuando se intentó el fallback y no pudo: `PROVEEDOR_DESHABILITADO`, `CREDENCIAL_RECHAZADA` (401), `CUOTA_AGOTADA` (429), o error de red |

`canal` se deja en `null` cuando mide el proveedor — a propósito, igual que
en el gate anterior. Meta y ScrapeCreators no son formas equivalentes; no se
fuerzan dentro del mismo campo.

---

## 7. Errores del proveedor: nunca tumban la observación

Probado con 401, 429 y una excepción de red (timeout simulado):

- La ruta HTTP siempre responde **200**, nunca **500**, por un fallo del
  proveedor.
- El activo profesional del mismo candidato **sigue observándose
  normalmente** — un fallo en un activo no arrastra a los demás.
- La causa queda **clasificada con precisión** (`CREDENCIAL_RECHAZADA` ≠
  `CUOTA_AGOTADA`) para saber qué hacer después sin adivinar.
- **Nada se inventa**: sin `canalProveedor`, sin followers en 0.

---

## 8. Provenance y project isolation

Ningún secreto sale en la respuesta HTTP — verificado explícitamente (test
B): ni la clave del proveedor, ni el App Secret de Meta, ni ningún
`access_token` en texto plano.

**Project isolation:** el mismo handle de Instagram, declarado personal en
un proyecto y sin declarar en otro, produce resultados **independientes**.
El segundo proyecto no llega a `MEDIDO_PROVEEDOR` porque no tiene la
declaración que abre la vía — la declaración de un proyecto no se filtra al
otro (test H).

---

## 9. Prueba end-to-end

**Se demostró completo sin ninguna request real.** El servidor Express se
levanta de verdad (`app.listen` en puerto efímero) y se le habla por HTTP
real; solo se interceptan `graph.facebook.com` y `api.scrapecreators.com`,
dejando pasar todo lo demás — incluidas las peticiones al propio servidor de
prueba. Esto certifica el cableado completo:

```
HTTP request real → Express route → observarCandidato
  → socialSourceRouting → instagramProviderFallback
  → socialProviderClient → respuesta HTTP
```

**No hizo falta gastar el request real permitido.** El cableado quedó
certificado por completo con mocks: 31 casos, cero red hacia proveedores
reales.

---

## 10. Presupuesto de este gate

**0 requests externas.** **81 créditos de ScrapeCreators, sin tocar** (igual
que en el gate anterior).

---

## 11. Tests

`tests/instagramHttpFallback.test.mjs` — **31/31**, casos A–J completos:
oficial gana, fallback real, sin opt-in del cliente, opt-in del cliente pero
entorno bloqueado, 401, 429, timeout, multi-activo, project isolation, GET
no dispara nada, y contador exacto de llamadas (presupuesto).

Regresión completa: **35 suites de Candidate Intelligence, 1267 checks, 0
fallos** — incluye `igRoute.test.mjs` sin ningún cambio (30/30, idéntico al
estado previo a este gate).

---

## 12. Limitaciones

- El fallback por HTTP solo cubre **perfil** (mismo alcance que
  `instagramProviderFallback.js`). Publicaciones y comentarios vía proveedor
  siguen fuera del flujo automático — explícitamente fuera de alcance de
  este gate.
- **No hay UI todavía** que envíe `proveedorInstagram: true`. El campo existe
  en el contrato HTTP y está probado, pero ningún botón de la interfaz lo
  activa aún.
- No se implementó persistencia de snapshots para el perfil medido por
  proveedor — fuera de alcance explícito de este gate ("solo HTTP wiring").
- `SENTINEL_PROJECT_STATE.md` tenía una edición ajena sin commitear en el
  momento de este gate (T3 retirando su propia sección `§18-M5`). **No se
  tocó el archivo.** Queda como actualización pendiente.
- `apps/backend/package.json` sigue mezclado entre terminales — no se tocó.

---

## 13. Readiness para P-CAND-SOCIAL-BENCH-02

El cableado HTTP está completo y probado. Si el benchmark de los 7
candidatos se ejecuta contra la ruta real con `proveedorInstagram: true` en
el cuerpo de cada petición, verá `MEDIDO_PROVEEDOR` en los activos personales
elegibles. Si se ejecuta sin ese campo (comportamiento por defecto), verá
exactamente lo mismo que antes de este gate: Instagram solo por Meta
oficial.

**Decisión pendiente de quien ejecute el benchmark:** activar o no el
fallback por request, y qué política de coste aplicar si se activa para los
7 candidatos a la vez (créditos por activo elegible, no por candidato).
