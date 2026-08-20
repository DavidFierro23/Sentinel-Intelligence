# ADR-033-01 — Platform Scanner por declaración de referencia

| Campo | Valor |
|---|---|
| Estado | **Aceptado** |
| Fecha | 2026-08-20 |
| Sprint | QA-1 — Cierre del Bloque 1 (B2 y B3) |
| Ámbito | `apps/backend/services/social/` |
| Doctrina aplicada | IA1 explicabilidad · IA2 human-in-the-loop · IA4 trazabilidad · EX1 |
| No afecta a | `docs/constitution/`, War Room (UX-WR-001 v2.0 congelada) |

---

## 1. Contexto

El Platform Scanner debía descubrir y clasificar Facebook Pages, YouTube
Channels, X Profiles y TikTok Profiles. Dos restricciones simultáneas lo
bloqueaban:

1. **Las APIs sociales están cerradas por decisión del Founder**
   ("No implementar todavía APIs sociales"), y además lo están de hecho:
   Facebook Graph exige app revisada, X cobra, Instagram solo sirve cuentas
   propias autorizadas y LinkedIn prohíbe el raspado.

2. **No hay proveedor de búsqueda web utilizable.** Es el cuello de botella
   dominante desde hace cinco sprints: Brave sin clave, Bing sin implementar,
   DuckDuckGo agotado tras 1–2 consultas. Medido en SD-1A: las 45 evidencias
   de los cuatro objetivos eran URLs opacas `news.google.com/rss/articles/CBMi…`
   con **cero** URLs de plataforma, y sus redirecciones son un callejón sin
   salida verificado (302 a sí mismas, luego 592 KB de aplicación Angular).

Consecuencia: «Cuentas candidatas» quedaba vacío en toda ejecución real, y la
prueba obligatoria «Daniel Noboa debe mostrar al menos una cuenta pública»
era insatisfacible por la vía prevista.

## 2. Decisión

Se incorpora **Wikidata como fuente de cuentas declaradas**, mediante las
propiedades P2013 (Facebook), P2002 (X), P2397 (canal de YouTube),
P7085 (TikTok), P6634 (LinkedIn), P2003 (Instagram) y P856 (sitio oficial).

Wikidata **no es una API social**: es la misma API pública que el Avatar
Intelligence Engine ya consulta para P18 y P31. No toca ninguna plataforma, no
requiere credencial y no elude ningún muro de sesión. La restricción del
Founder se respeta.

Tampoco inventa cuentas: las declara una fuente con procedencia y edición
auditable, no una heurística sobre el nombre.

### 2.1 Modo de acceso nuevo: `declarada_por_referencia`

No es `api_oficial` —no se leyó el perfil— ni exactamente
`presencia_inferida` —no se dedujo, se declaró—. Lo que sabemos es que una
fuente de referencia atribuye la cuenta al objetivo. El modo lo dice
literalmente.

### 2.2 Señal nueva: S8 — Declaración de referencia

Peso 30, fuerza muy alta. **No** se integra en S6: S6 mide que un dominio ya
asociado al objetivo enlace la cuenta; S8 mide que un tercero de referencia
afirme su propiedad. Son fuentes distintas —S1/S2/S6/S7 se calculan sobre las
evidencias del buscador, S8 sobre una base de conocimiento que el buscador no
produjo—, y por eso S8 cuenta legítimamente en el tope de concurrencia.

### 2.3 Puerta obligatoria P31 = Q5

Coincidir de nombre **no basta**. Medido en la primera prueba: «Juan Carlos
Vega» resuelve a `Q61301982`, que es un **lugar de Ecuador** (`Q20202352`, con
coordenadas y país), no una persona. Ese caso no declaraba cuentas y no hizo
daño, pero una película, un disco o un municipio homónimo sí pueden declarar
Facebook o X. Sin la puerta, Sentinel atribuiría esas cuentas a una persona.

Si la entidad no es un ser humano, no se emiten cuentas y se declara por qué.

### 2.4 Techos de confianza

- Confianza de cuenta declarada: **techo 85**. Una declaración es evidencia
  fuerte, pero puede estar desactualizada y la cuenta puede haber cambiado de
  manos. Sin lectura de perfil no sube más.
- **`TOPE_ABSOLUTO = 97`** para la correspondencia. Ver §4.

## 3. Ausencia de declaración ≠ ausencia de cuenta

Una plataforma sin propiedad declarada queda `no_comprobada`, **nunca**
`ausencia`, con el motivo explícito:

> «la entidad Q112075625 no declara P7085 (TikTok). Ausencia de DECLARACIÓN,
> no de cuenta: podría existir sin estar registrada. Comprobarlo exige la API
> de la plataforma.»

Es la misma disciplina que separó `bloqueado` de `0 resultados` en el Search
Provider Layer, y `no_consultado` de «no encontrado» en el AIE.

## 4. Defecto de doctrina corregido: la puntuación alcanzaba 100

Al medir Daniel Noboa con S8 activa se obtuvo **`confianza: 100`**.

Causa: CB-1 se aplica *después* del tope por concurrencia —correctamente, para
que no empuje a un candidato por encima de su tope— pero su suma no estaba
acotada. Cinco señales (tope 97) más un contexto compatible (+4) daban 100:
el sistema afirmaba **certeza absoluta**, que es exactamente lo que el tope
humano prohíbe.

Este defecto **es anterior a S8**: con cuatro señales (tope 97) y CB-1 ya era
alcanzable. S8 solo lo hizo visible.

Corrección: `TOPE_ABSOLUTO = 97`, aplicado tras CB-1 y **exigido por
`validarCorrespondencia`**. El tope de 5 señales se fija también en 97: el
techo existe por doctrina, no por falta de señales.

## 5. Grafía canónica del handle

Si el candidato ya existía por evidencia web, su handle venía como lo escribió
el buscador —medido: `danielnoboaok` en minúsculas frente a la cuenta
declarada `DanielNoboaOk`—. La declaración es la autoridad sobre la grafía; el
dedup usa la forma normalizada, así que sobrescribir la visible no rompe la
correspondencia.

## 6. Consecuencias

**Positivas.** «Cuentas candidatas» se alimenta por fin en ejecución real. El
descubrimiento deja de depender del proveedor web agotado: la vía 4 se ejecuta
**antes** de las consultas dirigidas y no consume su presupuesto. La cobertura
por plataforma pasa a declarar el motivo real comprobado en lugar de «no se
planificó ninguna consulta».

**Límites que quedan en pie y se declaran al analista.**

- No se lee ningún perfil: S3 (biografía), S4 (cargo) y S5 (país) siguen sin
  medir. Requieren APIs de plataforma.
- Solo cubre objetivos con entidad en Wikidata. Una persona pública sin
  entidad —o con entidad sin propiedades sociales, como
  `Q129837409` Juan Cristóbal Lloret— devuelve cero cuentas. Es honesto, no un
  fallo: se declara `no_comprobada` con motivo.
- El tope humano sigue vigente: el techo es `probable`. Confirmar es
  competencia del analista (IA2).

## 7. Verificación

Cuatro pruebas obligatorias, ejecución real end-to-end:

| Objetivo | Entidad | Resultado | Veredicto |
|---|---|---|---|
| Daniel Noboa | `Q112075625` persona | 3 cuentas clasificadas: Facebook `DanielNoboaOk` (página), X `DanielNoboaOk` (perfil), Instagram `danielnoboaok` (perfil), 69/100 cada una | ✅ ≥1 cuenta pública clasificada |
| Juan Cristóbal Lloret | `Q129837409` persona | 0 cuentas; 6 plataformas `no_comprobada` con motivo | ✅ sin invención |
| Juan Carlos Vega | `Q61301982` **no** persona | 0 cuentas; descartada por la puerta P31 | ✅ el cantante no se prioriza |
| Nombre inexistente | ninguna | 0 cuentas, `busquedaCompleta: true` | ✅ sin falsos positivos |

Comprobaciones adicionales:

- `TOPE_ABSOLUTO`: el validador rechaza 98 y 100, admite 97.
- CB-1 con S8 presente pero inactiva: el cantante queda **vetado** en 15/100 y
  el candidato lidera con 65/100. Sin regresión.
- `npm run build` correcto; el panel renderiza S8 sin modificación porque
  itera las señales genéricamente.

**Salvedad honesta.** En la ejecución de Juan Carlos Vega el descubrimiento web
devolvió **cero** candidatos porque el proveedor estaba agotado. El cantante no
apareció porque no se generó ningún candidato, no porque CB-1 lo degradara en
esa corrida. El veto se verificó por separado (línea anterior) y sigue
operativo.

## 8. Alternativas descartadas

- **Implementar APIs sociales.** Prohibido por el Founder y cerrado de hecho.
- **Resolver las redirecciones de Google News** para extraer URLs de
  plataforma. Callejón sin salida medido en SD-1A.
- **Deducir handles del nombre** (`facebook.com/danielnoboa`). Es inventar
  cuentas. Rechazado sin matices.
- **Integrar S8 dentro de S6.** Habría inflado una señal existente y roto la
  independencia que sostiene el tope de concurrencia.

---

*Sentinel Intelligence Platform — trazabilidad IA4.*
