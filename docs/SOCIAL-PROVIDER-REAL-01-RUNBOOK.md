# SOCIAL-PROVIDER-REAL-01 — RUNBOOK

**Qué hacer, en orden, el día que Bright Data apruebe la cuenta.**
Preparado en `SOCIAL-PROVIDER-REAL-01-PREP` · 2026-08-31 · 0 requests · 0 USD

> **Estado de Bright Data hoy: `PROVEEDOR_CANDIDATO` · `EN_REVISION`.**
> No está aprobado para operar. Nada de lo que sigue se ha ejecutado.

---

## 0. Lo que ya está listo (no hay que volver a hacerlo)

| Pieza | Dónde | Estado |
|---|---|---|
| Contrato de publicación | `services/intelligence/publicationObservation.js` | ya existía |
| Contrato de métrica | idem, `crearSnapshotDeMetrica` | ya existía |
| **Contrato de comentario** | `services/intelligence/commentObservation.js` | **nuevo** |
| **Límite de proveedor** | `services/intelligence/externalSocialProvider.js` | **nuevo** |
| Matriz de capacidades por proveedor | idem, `PROVEEDORES` | **nuevo** |
| Fixtures sintéticos | `tests/fixtures/*.sample.json` | **nuevo** |
| Tests del límite | `tests/externalProvider.test.mjs` (48) | **nuevo** |
| Snapshots multi-activo | `projectStore.guardarSnapshots` | corregido en P-CAND-TIKTOK-01 |

**Lo que falta es exactamente una cosa:** el cliente HTTP que llame a Bright
Data y le pase el payload al normalizador. Todo lo de después ya funciona y
está probado contra fixtures.

---

## 1. Alta de la cuenta — la hace una persona

Sentinel **no** crea cuentas externas. Estos pasos son manuales:

1. Entrar en `brightdata.com` con la cuenta ya en revisión.
2. Confirmar el plan gratuito: **5.000 registros/mes, sin tarjeta**.
3. Crear una API key del **Scraper API**.

**No pegar la clave en el chat, ni en un issue, ni en un log.**

---

## 2. Cargar la credencial

En `apps/backend/.env`, que está en `.gitignore` y nunca entra en git:

```
SOCIAL_EXTERNAL_PROVIDER_ENABLED=true
BRIGHTDATA_API_KEY=<la clave>
```

**La bandera sola no habilita nada.** `proveedorHabilitado()` exige las tres
cosas: bandera encendida, credencial presente **y** proveedor marcado como
aprobado en el registro. Encender una variable de entorno no aprueba a un
proveedor; hay test que lo fija.

Para aprobarlo hay que cambiar, a mano y con la fecha del gate, en
`externalSocialProvider.js`:

```js
estadoComercial: "APROBADO",
aprobadoParaOperar: true
```

Eso es deliberadamente un cambio de código y no de configuración: aprobar un
proveedor es una decisión que debe quedar en el historial de git.

---

## 3. Escribir el cliente (lo único que falta)

Un adapter en `services/ingest/adapters/`, siguiendo el patrón de los que ya
existen. **No** un motor nuevo.

Responsabilidad única: hablar HTTP con el proveedor y devolver el payload
crudo. La traducción al contrato de Sentinel ya está hecha:

```js
normalizarPublicacionDeProveedor({ providerId, platformId, payload, mapa, ... })
normalizarComentariosDeProveedor({ providerId, platformId, payload, mapa, ... })
```

El `mapa` de campos vive fuera del dominio, que es lo que permite cambiar de
proveedor sin tocar Candidate Intelligence. El de TikTok ya está escrito en el
test como ejemplo funcionando.

---

## 4. Las tres pruebas, en este orden

### 4.1 Facebook de un tercero — `@pedropalaciosu`

Es el activo con el que ya se midió el bloqueo oficial en P-CAND-FACEBOOK-01,
así que el resultado es **directamente comparable**: ahí Meta devolvió
`400 (#100)`.

Validar sobre **1 post**:

- [ ] `postId` presente y estable
- [ ] `permalink` canónico y abrible en un navegador
- [ ] `publishedAt`
- [ ] `text`
- [ ] al menos **una métrica real** (reactions, comments_count o shares)

### 4.2 Comentarios de ese mismo post

**Este es el paso que decide el gate.** Sin texto de comentarios, Comments
Intelligence sigue sin fuente y el proveedor no resuelve lo que se compró.

- [ ] `commentId`
- [ ] **`text`** con contenido real
- [ ] `publishedAt`
- [ ] relación con el post (`postId` / `postPermalink`)
- [ ] `parentCommentId` si hay respuestas

### 4.3 TikTok — `@yaku.perez`

El de identidad mejor resuelta (correspondencia 40) y ya confirmado por oEmbed.

- [ ] `followers`
- [ ] posts/videos con `permalink` y `timestamp`
- [ ] `views`
- [ ] `likes`
- [ ] `comments_count`
- [ ] `shares`
- [ ] texto de comentarios

### 4.4 Instagram — **solo si aporta valor**

Una de las 9 cuentas personales que `business_discovery` no alcanza. Si Meta
ya lo cubre, **no se compra**: no tiene sentido pagar por lo que la vía oficial
entrega mejor y más barato.

---

## 5. Persistir y reejecutar

1. Persistir **una** ejecución real con los contratos existentes
   (`guardarPublicaciones`, `guardarSnapshots`).
2. **Reejecutar** la misma consulta.
3. Comprobar:
   - [ ] las publicaciones **no se duplican**
   - [ ] `publicationId` y `commentId` idénticos entre ejecuciones
   - [ ] `firstObservedAt` **no se mueve**
   - [ ] `lastObservedAt` **avanza**
   - [ ] los lotes se acumulan (serie append-only)

Sin el paso 2 no se sabe si los IDs del proveedor son estables, y unos IDs
inestables convierten cada ejecución en datos nuevos: el histórico se vuelve
basura sin avisar.

---

## 6. Actualizar la matriz, celda a celda

Solo lo que se midió. Cada capacidad pasa de `UNVERIFIED_PROVIDER` a:

- `SUPPORTED` — llegó completo
- `PARTIAL` — llegó incompleto
- `UNSUPPORTED` — se pidió y no lo entrega
- `NO_DATA` — respondió sin dato
- `BLOCKED` — algo lo impidió

**No se marca en bloque.** Si se midieron posts y no comentarios, comentarios
sigue `UNVERIFIED_PROVIDER`. Es la misma disciplina que se aplicó a Meta y a
TikTok.

---

## 7. Criterio de aprobación

**APROBADO** exige las tres:

| | Requisito |
|---|---|
| **Facebook** | dato real de tercero + post real + ID estable + permalink + ≥1 métrica real |
| **TikTok** | dato real + video real + ID estable + métricas reales |
| **Comments** | ≥1 plataforma con texto real + comment ID + timestamp + relación con el post |

Si falta cualquiera: **PARCIAL**. Y solo con las tres se puede escribir
`MEDIDO_PROVEEDOR` en la matriz.

---

## 8. Presupuesto

| Concepto | Estimado |
|---|---|
| Facebook: 1 page + 1 post + comentarios | ~40 registros |
| TikTok: 1 perfil + 5 videos + comentarios | ~160 registros |
| Instagram (si aplica) | ~40 registros |
| Reejecución para dedup | ×2 |
| **Total** | **~500 registros** |

Cabe de sobra en los **5.000 gratuitos del mes**. **Coste esperado: 0 USD.**

Si el primer post trae 2.000 comentarios, parar y poner tope antes de seguir:
el comentario es lo que dispara el consumo.

---

## 9. Lo que NO se hace en el gate real

- No se contrata plan de pago.
- No se introduce tarjeta.
- No se miden los 7 candidatos: eso es `P-CAND-SOCIAL-BENCH-02`, después.
- No se pega la API key en ningún log, informe ni chat.
- No se declara ninguna plataforma resuelta sin haberla medido.

---

## 10. Riesgo que hay que aceptar antes de empezar

Bright Data **raspa web pública; no es un proveedor licenciado** por Meta ni
por TikTok. Va contra los ToS de las plataformas aunque el dato sea público, y
la continuidad no está garantizada.

Lo que sí se conserva es la citabilidad: los permalinks son canónicos y
cualquiera puede abrir la publicación y comprobarla.

**Es una decisión de negocio, no técnica.** Está documentada en
`docs/SOCIAL-PROVIDER-EVAL-01.md` §6 y le corresponde al responsable del
proyecto tomarla antes de ejecutar este runbook.
