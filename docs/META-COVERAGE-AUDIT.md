# META-COVERAGE-AUDIT-01

Auditoría de la cobertura **potencial** que Meta oficial podría aportar a los
siete candidatos reales, antes de invertir en Business Verification y App
Review.

**Fecha:** 2026-08-28 · **Proyecto:** Elecciones Alcaldía Cuenca 2027
**Naturaleza:** auditoría. No habilita Meta, no es `MEDIDO_TERCERO`.

---

## Metodología

1. Inventario de activos leído de la persistencia real, no de supuestos.
2. Un intento de clasificación por activo con **metadata pública**: una petición
   HTTP por URL, sin login, sin cookies, sin scraping agresivo.
3. **Un control** sobre páginas conocidas para comprobar que el clasificador
   discrimina de verdad.
4. Sin evidencia suficiente → `NO_CLASIFICADA`. Obligatorio.

El paso 3 es el que salvó esta auditoría. Conviene leerlo antes que los números.

---

## El control que cambió el resultado

La primera pasada clasificó **once de once** activos de Facebook como
`FACEBOOK_PROFILE`, con confianza MEDIA. Un resultado demasiado limpio.

Se probó el mismo clasificador contra tres páginas que no admiten discusión:

| URL de control | Es | Dijo el clasificador |
|---|---|---|
| `facebook.com/Meta` | Página | `FACEBOOK_PROFILE` (MEDIA) |
| `facebook.com/bbcnews` | Página | `FACEBOOK_PROFILE` (MEDIA) |
| `facebook.com/NASA` | Página | `FACEBOOK_PROFILE` (MEDIA) |

**0 % de acierto con confianza media.** Los tokens que se usaban como señal
—`userID`, `profile_id`, `entity_type`— están en el armazón que Facebook sirve a
cualquier visitante sin sesión, en cualquier URL. Eran plantilla.

La señal se retiró. Los once activos volvieron a `UNKNOWN`, que era la respuesta
honesta desde el principio.

Sin ese control, esta auditoría habría concluido *«los 7 candidatos usan perfiles
personales, Meta no cubre a nadie, no invertir»*. Una conclusión firme, accionable
y falsa.

---

## Inventario real

| Candidato | Activos | Plataformas | IG | FB |
|---|---|---|---|---|
| Paúl Carrasco Carpio | 6 | 5 | 1 | 2 |
| Juan Cristóbal Lloret | 9 | 7 | 2 | 2 |
| Pedro Palacios Ullauri | 8 | 5 | 1 | 2 |
| Juan Carlos Vega | 5 | 4 | 1 | **0** |
| Yaku Pérez | 7 | 5 | 2 | 2 |
| Marcelo Cabrera Palacios | 7 | 4 | 3 | 2 |
| Leonardo Morales | 6 | 5 | 2 | 1 |

**12 activos de Instagram** en 7 candidatos · **11 de Facebook** en 6.

Multi-activo: **4 candidatos** con más de un Instagram, **5** con más de un
Facebook. El modelo 1:N no es teórico: lo usa la mayoría del universo real.

---

## Clasificación

Las 23 URLs devolvieron **HTTP 200**. Ninguna dio una señal que discrimine.

| | Instagram | Facebook |
|---|---|---|
| profesional / página confirmada | **0** | **0** |
| personal / perfil confirmado | **0** | **0** |
| `NO_CLASIFICADA` | **12** | **11** |
| sin cuenta | 0 candidatos | 1 candidato |
| **tasa de clasificación** | **0 / 12 = 0 %** | **0 / 11 = 0 %** |

### Por qué Facebook no se deja clasificar

Todas las URLs son de vanidad —`facebook.com/nombre`—, que usan tanto los
perfiles como las páginas. El HTML sin sesión devuelve `og:type=video.other` en
la práctica totalidad de los casos, y ese valor no distingue nada.

### Por qué Instagram tampoco

`og:type=profile` aparece en casi todos, pero eso solo dice «es un perfil de
Instagram»: **no** distingue una cuenta *Business/Creator* de una personal, que
es justo lo que decide la elegibilidad.

### Los dos Facebook de Lloret

| Activo | Tipo | Evidencia |
|---|---|---|
| `facebook:juancristobal.lloretvaldivieso` | `UNKNOWN` | HTTP 200, `og:type=video.other`, no discrimina |
| `facebook:jotalloretv` | `UNKNOWN` | HTTP 200, `og:type=video.other`, no discrimina |

Siguen siendo **dos activos distintos**, no deduplicados. Cuál es la página
sigue sin resolverse por vía pública.

---

## Cobertura Meta

| | candidatos | % |
|---|---|---|
| **confirmadamente cubribles** | **0 / 7** | **0 %** |
| **cobertura desconocida** | **7 / 7** | **100 %** |
| confirmadamente fuera | 0 / 7 | 0 % |

Los tres números son distintos y ninguno se puede leer por otro. **`UNKNOWN` no
se suma a `NO`.** Que no hayamos podido demostrar que una cuenta es profesional
no demuestra que sea personal.

### Escenarios

**Conservador** — solo lo confirmado: Meta aporta **0 candidatos**.

**Pendiente** — 23 activos sin clasificar podrían cambiar el resultado por
completo. El rango real va de 0 a 7 candidatos, y hoy no se puede estrechar.

**No-Meta** — con la evidencia actual, **ningún candidato** está confirmadamente
fuera. No hay base para descartar Meta ni para adoptarlo.

---

## SOCIAL_COVERAGE_GAP

| Candidato | Instagram | Facebook | TikTok |
|---|---|---|---|
| Paúl Carrasco | NO_CLASIFICADO | NO_CLASIFICADO | NO_PROBADO |
| J. C. Lloret | NO_CLASIFICADO | NO_CLASIFICADO | NO_PROBADO |
| Pedro Palacios | NO_CLASIFICADO | NO_CLASIFICADO | NO_PROBADO |
| Juan Carlos Vega | NO_CLASIFICADO | **NO_CUENTA** | NO_PROBADO |
| Yaku Pérez | NO_CLASIFICADO | NO_CLASIFICADO | NO_PROBADO |
| Marcelo Cabrera | NO_CLASIFICADO | NO_CLASIFICADO | NO_PROBADO |
| Leonardo Morales | NO_CLASIFICADO | NO_CLASIFICADO | NO_PROBADO |

---

## Comparabilidad multicandidato

**INDETERMINADA.**

Umbral interno de Sentinel: es `INDETERMINADA` cuando más del 30 % de los
candidatos dependen de activos Meta sin clasificar. Aquí dependen el **100 %**.

> Estos umbrales son internos de Sentinel. No son un estándar académico ni de
> Meta.

---

## Valor incremental sobre X + YouTube

Hoy medimos a terceros en X y YouTube. Meta añadiría, **si la clasificación
resultara favorable**:

- una superficie más para los 7 candidatos con Instagram
- una más para los 6 con Facebook
- y sobre todo, cobertura donde hoy hay poca: cinco de los siete están en 1/5
  plataformas en la línea base T0

Pero **ese «si» es todo el problema**. Con 0 % de clasificación, el valor
incremental de Meta no es bajo: es **desconocido**. Y una inversión en App
Review y Business Verification hecha sobre un valor desconocido es una apuesta,
no una decisión.

Lo que sí se puede afirmar: incluso con Meta aprobado, sus métricas de terceros
serían menos de las que ya obtenemos de X —sin reach, sin saves, sin shares— y
no cubrirían a nadie con cuenta personal.

---

## Decisión de inversión

### META-INVESTIGAR-MAS

Cinco razones:

1. **La cobertura es desconocida, no baja.** 0 % confirmado y 100 % sin
   clasificar. Invertir ahora sería apostar; descartar ahora sería igual de
   infundado.
2. **Lo que falta cuesta minutos, no semanas.** La clasificación de 23 activos
   la resuelve el analista mirando las cuentas, o una lectura autenticada de
   nuestra propia sesión —que este gate no hace y no debe hacer—.
3. **App Review y Business Verification son irreversibles en tiempo.** Se tarda
   lo que Meta tarde, y no consta cuánto. Conviene entrar sabiendo a qué.
4. **El coste de esperar es cero.** X y YouTube ya sostienen el benchmark; no
   hay nada bloqueado por Meta.
5. **El dato que falta es barato y decisivo.** Si la mayoría resultan personales,
   Meta oficial se descarta con fundamento y la conversación pasa a proveedor. Si
   resultan profesionales, la inversión se justifica sola.

### ¿Hace falta proveedor comercial?

**INDETERMINADO**, y por plataforma:

- **Instagram** — indeterminado: depende de cuántas cuentas sean profesionales.
- **Facebook** — indeterminado por lo mismo, con un matiz: los perfiles
  personales no los cubre ninguna vía oficial, así que ahí el proveedor sería la
  **única** opción.
- **TikTok** — `NO_PROBADO`, y ya documentado en SOCIAL-PROVIDER-EVAL-01 como la
  única plataforma sin vía oficial para un producto comercial. Ahí el proveedor
  es la única ruta conocida.

---

## Gaps registrados

**`P-CAND-ASSET-DISCOVERY-02`** — no se abre. Durante la auditoría no aparecieron
señales nuevas de activos faltantes: la corrección de
`P-CAND-FB-MULTI-ASSET-01` ya eliminó el cierre por plataforma, y el inventario
—23 activos Meta en 7 candidatos, con 9 casos de multi-activo— sugiere que el
descubrimiento está funcionando.

**`P-CAND-UX-MULTI-ASSET-INPUT`** — registrado. El formulario de alta admite una
URL por plataforma; se añaden más por «Editar identidad». No se corrige aquí.

---

## DECLARED ASSET TYPE LAYER

*Añadido por `P-CAND-ASSET-TYPE-DECLARE-01` (2026-08-28).*

### Por qué existe

Esta auditoría clasificó **0 de 23** activos. No por falta de intentos: el HTML
público de Facebook y de Instagram sencillamente no distingue perfil de página
ni Business de personal, y el control con Meta, BBC y NASA lo dejó fuera de
duda.

Afinar el clasificador no era el camino. Un analista que abre la cuenta lo ve en
un segundo — el dato existe, solo que no está donde lo buscábamos.

Así que ahora el analista lo declara. Y **Sentinel no llama a eso una
verificación**.

### La separación, que es todo el punto

| Campo | Qué dice |
|---|---|
| `assetType` | el tipo, venga de donde venga |
| `assetTypeSource` | `ANALYST_DECLARATION` · `PUBLIC_METADATA` · `META_API` · `NINGUNA` |
| `assetTypeVerification` | `NO_VERIFICADA` mientras la fuente no sea `META_API` |

Un tipo sin procedencia es un tipo que dentro de un mes nadie sabrá si hay que
comprobar. Por eso los tres campos viajan juntos y la interfaz pinta
**DECLARADO POR ANALISTA** en ámbar, nunca «verificado».

Ninguna acumulación de declaraciones asciende a `VERIFICADA`: solo lo hace una
fuente de `FUENTES_VERIFICADAS`, y hoy esa lista contiene únicamente `META_API`.
`PUBLIC_METADATA` está deliberadamente fuera, por lo que pasó en esta auditoría.

### Tipos admitidos

**Facebook** — `UNKNOWN` · `FACEBOOK_PROFILE` · `FACEBOOK_PAGE`

**Instagram** — `UNKNOWN` · `INSTAGRAM_PROFESSIONAL` · `INSTAGRAM_BUSINESS` ·
`INSTAGRAM_CREATOR` · `INSTAGRAM_PERSONAL`

`INSTAGRAM_PROFESSIONAL` existe porque el analista suele saber que una cuenta es
profesional sin saber si Meta la tiene como Business o como Creator: en la
interfaz se ven casi igual. Obligarle a elegir sería obligarle a inventar. Para
la elegibilidad da lo mismo —las tres abren la misma vía— y para cualquier otra
cosa consta que no se afinó.

### Qué NO hace una declaración

No cambia el candidato, la URL ni el handle. No cambia el estado de identidad de
la cuenta. No la verifica ni la vuelve oficial. No borra, funde ni desplaza a
ningún otro activo. Y no habilita el benchmark.

La garantía no es una promesa: las declaraciones se guardan en **una serie
aparte del Lake**, no dentro de `cuentasReferencia`. La alternativa —meter el
tipo en el registro de identidad— habría funcionado, y cada clasificación
estaría reescribiendo el registro que sostiene la URL, el handle y el estado de
la cuenta por un campo que no tiene nada que ver. Aquí no puede alcanzarlos ni
por accidente, y el historial sale gratis: quién dijo qué, cuándo, y qué dijo
antes.

### Cobertura declarada ≠ cobertura confirmada

Tres cifras que no se suman y ninguna se lee por otra:

| | significa |
|---|---|
| `COBERTURA_CONFIRMADA` | verificada contra una API de Meta. La única que sostiene una inversión por sí sola |
| `COBERTURA_DECLARADA` | el analista dijo que el activo es de un tipo elegible. Hipótesis bien fundada, no comprobación |
| `COBERTURA_DESCONOCIDA` | nadie lo ha clasificado. **No es un «no»** |
| `SIN_COBERTURA` | *todos* sus activos son de un tipo que ninguna vía oficial alcanza |

Un activo declarado elegible obtiene
`POTENCIALMENTE_ELEGIBLE_META_DECLARADA`, que es un estado propio y no un matiz
de `POTENCIALMENTE_ELEGIBLE_META`. Quien decide invertir en App Review necesita
saber cuántos de sus activos elegibles lo son porque alguien los miró.

Dos reglas de recuento, que son las que se rompen solas:

- Un solo `UNKNOWN` devuelve al candidato a `DESCONOCIDA`. Para declararlo fuera
  hacen falta activos **y** que todos sean no elegibles.
- No tener cuenta en una plataforma es `SIN_ACTIVO`, no `NO_ELEGIBLE`. Un
  candidato del proyecto no tiene Facebook, y eso no dice nada sobre si su
  Facebook sería elegible.

### Estado al cerrar el gate

23 activos, **0 declarados**. Las cifras de esta auditoría no cambian: la capa
existe y está vacía a propósito. Clasificar es del analista.

Cuando haya declaraciones, la decisión sobre Meta se recalcula y se marca
**DECISIÓN PRELIMINAR BASADA EN DECLARACIÓN DE ANALISTA**. No se convierte en
evidencia de API por haberse recalculado.

---

## Limitaciones

- **Ninguna clasificación se resolvió.** Este documento describe lo que no
  sabemos con precisión, que es distinto de describir lo que hay.
- **El HTML público de Facebook no distingue perfil de página** para un visitante
  sin sesión. Comprobado con control, no supuesto.
- **Instagram no expone Business/Creator** en su HTML público.
- No se generaron tokens, no se tocó Meta, no se inició ninguna revisión.
