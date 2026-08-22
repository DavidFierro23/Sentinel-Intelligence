# ARQ-PUI-001 — Protocolo Universal de Investigación

| Campo | Valor |
|---|---|
| Estado | **Implementado** |
| Versión | 1.0 |
| Fecha | 2026-08-22 |
| Sprint | 3.2.3 — Cierre definitivo del Discovery Engine |
| Ámbito | `apps/backend/services/social/`, `apps/web/src/components/` |
| No afecta a | `docs/constitution/`, War Room (UX-WR-001 v2.0 congelada) |

---

## 1. Las reglas congeladas y dónde se hacen cumplir

| Regla | Dónde vive | Cómo se comprueba |
|---|---|---|
| Nunca lógica específica por candidato | todo el pipeline | auditoría: ningún nombre propio de objetivo en código ejecutable, solo en comentarios |
| Toda persona ejecuta el mismo pipeline | `osintEngine.investigarObjetivo` | una sola ruta, sin ramas por objetivo |
| Toda información pasa por limpieza antes del dashboard | `osintEngine` § PUI | clasificar y construir el perfil ejecutivo ocurre en el backend, nunca en React |
| Nunca guardar duplicados | `permanentIdentityProfile` | huella de contenido: si el conjunto de cuentas es idéntico, no se escribe versión |
| Nunca mezclar medios con cuentas oficiales | `accountClassifier` | colecciones separadas + borde por clase en el grafo |
| TikTok obligatorio | `platformAdapters` | prioridad 1 y una consulta garantizada en la primera pasada |
| Mantener QA-1 | — | los cinco casos con 8 comprobaciones cada uno |

## 2. Bloque A — Pipeline Universal

**Etapas, idénticas para todo objetivo:**

```
Perfil de Referencia → Discovery (4 vías) → Identity Matcher (S1,S2,S6,S7,S8)
   → Social Evidence → Clasificación → Enriquecimiento → Perfil Ejecutivo
   → Perfil Permanente → Grafo
```

### El defecto que impedía cubrir seis plataformas

El planificador recorría plataforma por plataforma emitiendo **dos** consultas
de cada una:

```
x anclada · x nombre · facebook anclada · facebook nombre · youtube anclada · …
```

Con el presupuesto del proveedor en 4, X y Facebook se lo comían entero.
Medido en Daniel Noboa: **4 consultas OK y 6 Bloqueado**. YouTube, TikTok,
LinkedIn e Instagram nunca se ejecutaban.

Corrección: **reparto a lo ancho**. Primero una consulta anclada por
plataforma, después las variantes por nombre. Si el presupuesto se agota, se
agota habiendo tocado las seis.

Presupuesto de SerpAPI: 4 → **6**, una por plataforma obligatoria. Coste real:
~41 investigaciones mensuales en el plan gratuito en lugar de ~62.

Resultado: Noboa pasa de 3 cuentas a **5**, ganando YouTube y LinkedIn.

## 3. Bloque B — Deduplicación, URLs y Perfil Permanente

Dedup por `plataforma + handle normalizado`. Verificado que **no** colapsa
cuentas legítimamente distintas: `RedInformativaCuenca` en Facebook y
`redinformativacuenca` en TikTok son dos cuentas del mismo medio y se conservan
ambas.

**PIP** persiste cada investigación sobre el Knowledge Lake (append-only,
versionado) y devuelve qué cambió: cuentas nuevas y cuentas no reaparecidas.

Una cuenta que no reaparece **no** se declara eliminada: puede que el
proveedor no la devolviera esa vez. Misma disciplina que separa `ausencia` de
`no_comprobada`.

*Defecto corregido:* el modelo del Lake mapea `entrada.datos`; el PIP enviaba
`contenido`, así que escribía registros con `datos: null`. Pérdida de datos
silenciosa, y la razón de que la comprobación de duplicados no tuviera nada que
comparar.

*Límite declarado:* la clave es nombre normalizado + país. Dos homónimos en el
mismo país comparten perfil, y la misma persona buscada con otro nombre tendría
otro. Resolver identidad entre variantes es un problema abierto y no se finge
resuelto.

## 4. Bloque C — Clasificación

El problema medido: con SerpAPI devolviendo resultados reales, el panel se
llenaba de medios que **hablan** del objetivo. En Lloret, `@jotalloretv` —su
única cuenta real— quedaba **último**, tras 26 medios.

La causa es que CB-1 bonifica el contexto compatible, y un medio de Cuenca que
cubre elecciones tiene contexto perfectamente compatible. CB-1 distingue un
homónimo extranjero; no distingue «habla de X» de «es X».

**El orden de las reglas es lo esencial**, y aquí está el contraejemplo que lo
demuestra:

```
@jotalloretv  →  "Jota Lloret V"
```

Termina en «tv». Un léxico de medios ingenuo habría clasificado como medio la
única cuenta real encontrada. Por eso la regla de nombre precede al léxico.

### Tres defectos que el propio QA destapó

1. **El título del resultado no es el nombre de la cuenta.** La primera versión
   buscaba el nombre del objetivo también en el título, y el título de una
   publicación de un medio *siempre* menciona al objetivo —por eso se encontró
   la URL—. Resultado: Lloret con 8 de 8 cuentas «suyas». Solo cuenta el nombre
   del titular, extraído del patrón canónico `Nombre (@handle)`.

2. **Tokens cortos como subcadena.** El perfil personal de LinkedIn
   `ing-ivonne-carolina-pineda-bermeo-…` se clasificó como MEDIO porque «ap»
   (Associated Press) aparece dentro de «caro**lina p**ineda». Los términos de
   ≤3 caracteres exigen ahora borde de palabra.

3. **El apellido es obligatorio.** Con «basta un token» se atribuyó a Juan
   Carlos Vega la cuenta `@juan-carlos-garcía-macías`, que es otra persona:
   coincidían «juan» y «carlos», nombres de pila que comparten miles de
   personas. El último token del nombre buscado es el discriminante.

Nada se borra: un medio es inteligencia —quién cubre al objetivo importa—, se
separa en su propia colección con su motivo.

## 5. Bloque D — Grafo limpio

Un nodo por cuenta. **El relleno indica la plataforma; el borde, la clase.**
Leyenda permanente y no plegable: un grafo donde no se distingue la cuenta del
objetivo de un medio que lo cubre induce exactamente el error que el protocolo
prohíbe.

## 6. Bloque E — Lo que se puede y lo que no

Medido sobre una investigación completa de Daniel Noboa (75 evidencias
sociales, 30 web): **cero** apariciones de seguidores, followers, suscriptores
o bio. Las 64 apariciones de «seguidores» son las declaraciones que el propio
sistema emite para decir que no los tiene.

| Campo | Estado |
|---|---|
| cargo | **entregado** — del Perfil de Referencia |
| país | **entregado** — del Perfil de Referencia |
| última evidencia fechada | **entregado** — fecha que Google devuelve |
| seguidores | **no leído** — vive dentro del perfil |
| biografía | **no leído** — vive dentro del perfil |

«Seguidores vivos» y «bio viva» exigen la API de cada plataforma: Facebook
Graph pide app revisada, X cobra, Instagram solo sirve cuentas propias
autorizadas, LinkedIn prohíbe el raspado, TikTok pide app aprobada. Ese acceso
sigue congelado por decisión del Founder y cerrado de hecho.

«Última actividad» se etiqueta como **última evidencia fechada**: es la fecha
de lo más reciente que el buscador indexó, no la del último mensaje de la
cuenta. Confundirlas haría que un analista dedujera silencio de una cuenta
activa.

## 7. Bloque F — Índice de Huella Digital

| Componente | Máximo |
|---|---|
| Cobertura de plataformas | 40 |
| Solidez de la mejor correspondencia | 30 |
| Corroboración multiproveedor | 20 |
| Declaración en base de referencia | 10 |

Declara qué **no** mide: no es audiencia —sin API no hay seguidores— y no es
identidad —el techo sigue siendo `probable` (IA2)—.

## 8. QA — los cinco casos

Cada caso con 8 comprobaciones: 6 plataformas consultadas, TikTok presente,
ningún medio mezclado, tope humano ≤97, sin duplicados, apellido obligatorio en
toda tarjeta, huella explicada, resumen presente. **40 de 40.**

| Objetivo | Cuentas | Huella | Mejor cuenta |
|---|---|---|---|
| Daniel Noboa | 5 en 5 plataformas | 80 — amplia | `@DanielNoboaOk` 97/100 |
| Juan Cristóbal Lloret | 1 | 18 — mínima | `@jotalloretv` 35/100 |
| Yaku Pérez | 6 | 64 — moderada | `@yakuperezg` 97/100 |
| Marcelo Cabrera | 3 | 52 — moderada | `@MarceloHCabrera` 97/100 |
| Juan Carlos Vega | 4 | 37 — limitada | `@JuanCVegaEC` 56/100 |

Vega prioriza al candidato ecuatoriano; el cantante de Ciudad Rodrigo no
aparece. `@marcelo17965608` («claudio marcelo cabrera») **sí** se atribuye:
lleva el apellido de verdad, es un homónimo, y la capa de confianza lo deja en
30/100. Clasificar responde «qué clase de cuenta es»; CB-1 responde «es la
persona correcta».

---

*Sentinel Intelligence Platform — trazabilidad IA4.*
