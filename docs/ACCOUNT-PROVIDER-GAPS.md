# ACCOUNT-PROVIDER-GAPS

Mapa de lo que Account Intelligence **necesita** frente a lo que Sentinel
**puede leer hoy**, plataforma por plataforma.

No se compra nada en este gate. Este documento existe para que la decisión de
comprar acceso se tome sobre datos y no sobre intuición, y para alimentar
después `DATA-PROVIDER-EVAL`.

**Fecha:** 2026-08-25 · **Gate:** P-CAND-AI-01 · Fase 1

---

## Cómo leer este documento

`capacidad` es el estado real de nuestra infraestructura, no una aspiración:

| Estado | Significa |
|---|---|
| `ADAPTER_AVAILABLE` | hay adaptador propio y funciona |
| `PUBLIC_METADATA_ONLY` | solo metadata pública de la página |
| `API_REQUIRED` | haría falta la API oficial |
| `PROVIDER_REQUIRED` | haría falta un proveedor de datos |
| `BLOCKED` | la plataforma lo impide activamente |
| `UNSUPPORTED` | no contemplado |

`costo` es **`null` cuando lo desconozco**. No se estima: un precio inventado
en un documento de decisión es peor que un hueco.

---

## Resumen honesto

De las siete plataformas, **una** permite lectura real hoy: la web propia.
Las seis redes sociales requieren API o proveedor, y LinkedIn está
directamente bloqueado.

Eso significa que Account Intelligence Fase 1 puede **registrar la estructura,
la traza y los snapshots**, pero **no puede leer seguidores, publicaciones ni
métricas** de ninguna red social. Esa limitación está declarada en cada
observación, no disimulada.

---

## Instagram

- **capacidad:** `API_REQUIRED`
- **metadata pública:** no
- **lo que obtiene Sentinel hoy:** nada. La página de perfil no expone
  metadata utilizable sin autenticación.
- **lo que necesitamos:** seguidores · número de publicaciones · última
  publicación · métricas por publicación
- **qué podría cubrirlo:** Instagram Graph API (exige cuenta profesional y
  vinculación de la página) o un proveedor de datos con licencia
- **costo:** `null`
- **licencia:** Graph API requiere app revisada por Meta y permisos concretos
- **restricciones:** no da acceso a perfiles de terceros arbitrarios; el
  candidato tendría que vincular su cuenta, lo que no es viable en
  inteligencia electoral

---

## Facebook

- **capacidad:** `API_REQUIRED`
- **metadata pública:** sí (parcial)
- **lo que obtiene Sentinel hoy:** de una página pública, título e `og:image`.
  Ninguna métrica.
- **lo que necesitamos:** seguidores de página · publicaciones · reacciones ·
  comentarios
- **qué podría cubrirlo:** Facebook Graph API sobre páginas públicas, o
  proveedor con licencia
- **costo:** `null`
- **licencia:** app revisada por Meta
- **restricciones:** las páginas de figuras públicas suelen ser accesibles vía
  Graph; los perfiles personales, no

---

## X

- **capacidad:** `API_REQUIRED`
- **metadata pública:** no
- **lo que obtiene Sentinel hoy:** nada. La lectura sin API está cerrada.
- **lo que necesitamos:** seguidores · publicaciones · reposts · likes · vistas
- **qué podría cubrirlo:** X API, plan de pago
- **costo:** `null`
- **licencia:** términos de la API vigente
- **restricciones:** los planes bajos tienen cuotas muy limitadas; conviene
  medir el volumen real antes de elegir plan

---

## TikTok

- **capacidad:** `API_REQUIRED`
- **metadata pública:** sí (parcial)
- **lo que obtiene Sentinel hoy:** metadata de la ficha del perfil. Ni serie de
  publicaciones ni métricas fiables.
- **lo que necesitamos:** seguidores · vídeos · vistas · likes · comentarios ·
  shares
- **qué podría cubrirlo:** TikTok Display API o Research API, o proveedor con
  licencia
- **costo:** `null`
- **licencia:** la Research API exige solicitud y suele restringirse a
  instituciones académicas
- **restricciones:** el acceso comercial a datos de terceros es el más
  restrictivo del grupo

---

## YouTube

- **capacidad:** `API_REQUIRED`
- **metadata pública:** sí
- **lo que obtiene Sentinel hoy:** metadata de la página del canal.
- **lo que necesitamos:** suscriptores · vídeos · vistas · fecha del último
  vídeo
- **qué podría cubrirlo:** **YouTube Data API v3**
- **costo:** clave gratuita con cuota diaria
- **licencia:** términos de Google API
- **restricciones:** cuota por unidades; los suscriptores pueden estar ocultos
  por decisión del canal

> **Es la de mejor relación esfuerzo/valor del grupo.** Una clave gratuita
> daría datos estructurados reales de canal y vídeos. Si hay que empezar por
> algún sitio, es por aquí.

---

## LinkedIn

- **capacidad:** `BLOCKED`
- **metadata pública:** no
- **lo que obtiene Sentinel hoy:** nada.
- **lo que necesitamos:** cargo declarado · publicaciones
- **qué podría cubrirlo:** **ninguno legítimo hoy**
- **costo:** `null`
- **licencia:** la API no da acceso a perfiles de terceros
- **restricciones:** LinkedIn bloquea activamente la lectura automatizada y
  persigue el scraping. **Recomendación: no invertir aquí.**

---

## Web oficial

- **capacidad:** `PUBLIC_METADATA_ONLY`
- **metadata pública:** sí
- **lo que obtiene Sentinel hoy:** título, descripción, `og:image`; y el
  contenido es legible sin autenticación.
- **lo que necesitamos:** título · descripción · imagen · artículos publicados
- **qué podría cubrirlo:** **no hace falta nada**: es lectura pública normal
- **costo:** 0
- **licencia:** ninguna
- **restricciones:** conviene respetar `robots.txt` y no pedir con frecuencia
  agresiva

---

## Orden de inversión sugerido

Con la evidencia de hoy, y sujeto a que se mida el volumen real:

1. **YouTube Data API v3** — clave gratuita, datos estructurados reales. El
   único caso donde el acceso se consigue sin coste.
2. **Web oficial** — ya funciona; ampliar a lectura de artículos es trabajo
   propio, sin coste de licencia.
3. **Facebook Graph** sobre páginas públicas — viable para figuras públicas.
4. **X API** — decidir plan **después** de medir cuántas consultas al día hace
   falta de verdad.
5. **Instagram / TikTok** — requieren proveedor con licencia; evaluar coste
   frente a valor antes de comprometerse.
6. **LinkedIn** — **no invertir**: no hay vía legítima.

---

## Lo que este documento no dice

No dice qué proveedor comprar ni cuánto cuesta: los precios cambian y no los
conozco con certeza, así que figuran como `null`. La siguiente pieza es
`DATA-PROVIDER-EVAL`, que debería contrastar precio, cuota y licencia con el
volumen real que Sentinel necesite, medido y no supuesto.
