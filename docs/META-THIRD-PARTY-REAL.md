# META-THIRD-PARTY-REAL-01

Prueba real mínima: ¿puede Sentinel observar **hoy** una cuenta de candidato
tercero por vía oficial de Meta?

**Fecha:** 2026-08-30 · **Llamadas Meta:** 4 · **Reintentos:** 0

---

## Activos probados

Ambos salen del expediente real, declarados por el analista en
`P-CAND-ASSET-TYPE-DECLARE-01`.

| | Instagram | Facebook |
|---|---|---|
| handle | `jotalloretv` | `jotalloretv` |
| `assetType` | `INSTAGRAM_PROFESSIONAL` | `FACEBOOK_PAGE` |
| `assetTypeSource` | `ANALYST_DECLARATION` | `ANALYST_DECLARATION` |
| `assetTypeVerification` | `NO_VERIFICADA` | `NO_VERIFICADA` |

Los dos eran los mejores candidatos posibles para la prueba: si algo tenía que
funcionar, era con estos.

---

## Configuración disponible

`INSTAGRAM_ACCESS_TOKEN` — token de **Instagram Login**, de
`META-IG-REAL-01`. Nada más. No hay token de Facebook Login, ni App ID, ni
Page token.

---

## Llamadas y resultados

### 1 · Control: nuestra propia cuenta

```
GET graph.instagram.com/v23.0/me           → HTTP 200
```

Cuenta propia resuelta, tipo `BUSINESS`. **El token está vivo.** Esta llamada
no aporta nada sobre terceros; existe para que los dos fallos siguientes sean
legibles.

### 2 · Instagram · descubrimiento de tercero

```
GET graph.instagram.com/v23.0/{nuestro_id}
    ?fields=business_discovery.username(jotalloretv){...}

→ HTTP 400 · code 100
  «Tried accessing nonexisting field (business_discovery)»
```

**`NO_SOPORTADO_POR_FLUJO_ACTUAL`.**

Esto es información nueva. `META-IG-REAL-01` había medido el mismo campo contra
`graph.facebook.com` y recibido un 190, que podía estar tapando otra cosa. Lo
que faltaba era preguntar al host que **sí** acepta nuestro token.

La respuesta no es «te falta un permiso»: **el campo no existe ahí**. La vía de
Instagram Login no tiene descubrimiento de terceros, y ninguna combinación de
permisos sobre este token lo va a producir. Un 400 así es mejor que un 403:
cierra la pregunta en vez de dejarla abierta.

### 3 · Facebook · Page de tercero

```
GET graph.facebook.com/v23.0/jotalloretv
    ?fields=id,name,username,followers_count,fan_count

→ HTTP 400 · code 190 · OAuthException
  «Invalid OAuth access token - Cannot parse access token»
```

**`BLOQUEADO_CREDENCIAL`.**

Se eligió la petición más simple que responde a la pregunta. Si falla la más
simple, falla por la razón estructural y no por la complejidad de la peticion.

**Lo que está demostrado:** no tenemos credencial para este host.

**Lo que NO está demostrado** — y es exactamente lo que se sobreinterpreta: que
haga falta App Review o Business Verification. Este error se detiene *antes* de
evaluar permisos, al parsear la credencial. Sobre permisos no dice nada.

El control de la llamada 1 es lo que impide el error de lectura: el mismo token
acababa de devolver 200 en `graph.instagram.com`. «Invalid OAuth access token»
leído literalmente manda a regenerar el token, que es justo lo que no hay que
hacer.

### 4 · Comentarios

**No ejecutada.** Ninguna plataforma devolvió una publicación de tercero, así
que no había nada sobre lo que preguntar. Registrarlo como
`COMMENTS_NOT_AVAILABLE` sería inventar una medición que no se hizo.

---

## Datos reales obtenidos del tercero

**Ninguno.** Ni identidad, ni seguidores, ni publicaciones, ni métricas.

No se persistió nada: no hay publicaciones, ni snapshots, ni métricas en cero.
Solo quedaron registrados los bloqueos, con su HTTP, su código Meta, su
endpoint lógico y su fecha.

---

## Matriz de capacidad

| Capacidad | Instagram | Facebook |
|---|---|---|
| identity | `BLOQUEADO` | `BLOQUEADO` |
| followers | `BLOQUEADO` | `BLOQUEADO` |
| publications | `BLOQUEADO` | `BLOQUEADO` |
| likes / comments_count | `BLOQUEADO` | `BLOQUEADO` |
| views | `BLOQUEADO` | `BLOQUEADO` |
| comments_text | `NO_PROBADO` | `NO_PROBADO` |
| comment_timestamp | `NO_PROBADO` | `NO_PROBADO` |
| replies | `NO_PROBADO` | `NO_PROBADO` |
| pagination | `NO_PROBADO` | `NO_PROBADO` |
| historical archive | `NO_PROBADO` | `NO_PROBADO` |

X y YouTube: sin cambios, siguen `MEDIDO_TERCERO`.

### Comments Intelligence

`COMMENTS_NOT_TESTED` en las dos. El bloqueo está aguas arriba y está
demostrado; los comentarios nunca se pidieron.

Queda fijada una obligación de lenguaje para cuando esto funcione:

> **COMENTARIOS OBSERVADOS ≠ TODOS LOS COMENTARIOS.**
> Ninguna fuente garantiza cobertura total. Un corpus paginado y con límites de
> rate es una muestra, y decir «los comentarios dicen X» sobre una muestra es
> una afirmación falsa sobre el universo.

---

## `habilitaBenchmark()`

Sin cambios: `instagram = false`, `facebook = false`.

No hubo observación de tercero, así que no hay nada que discutir. Habilitarlo
con lo obtenido habría sido tomar la documentación por evidencia.

---

## Lo que cambia respecto a antes del gate

Antes teníamos una hipótesis razonable con un indicio ambiguo. Ahora:

1. **Instagram Login no descubre terceros.** No es un permiso: el campo no
   existe en ese host. Cerrado.
2. **El único camino restante para Meta oficial es Facebook Login for
   Business.** Y no está montado.
3. **El coste de averiguarlo es un token, no una revisión de Meta.** Hasta
   tener un token de ese flujo, cualquier error que aparezca hablará de la
   credencial y no de permisos — así que App Review y Business Verification
   siguen siendo preguntas sin plantear.

---

## META-FB-LOGIN-SETUP-01 (2026-08-30)

Gate de preparación. **Cero llamadas Meta.**

### El defecto que había detrás del bloqueo

El adaptador tenía **una** lista de variables y una sola función `credencial()`,
y el token que devolvía se enviaba a los dos hosts. Con un único token
configurado eso parece inofensivo. No lo era: es lo que produjo el
`400 · code 190` de la llamada 3.

Y el defecto habría **sobrevivido a la solución**. Al añadir un token de
Facebook, `graph.facebook.com` habría seguido recibiendo el de Instagram,
porque era el primero de la lista. El mismo 190 — ahora con la credencial
correcta guardada al lado y sin usarse, que es el peor caso: parece que la
configuración ya está hecha.

### Corregido

El token lo decide el **host**, no el orden de una lista:

| Host | Familia | Variable |
|---|---|---|
| `graph.instagram.com` | Instagram User access token | `INSTAGRAM_ACCESS_TOKEN` |
| `graph.facebook.com` | Facebook User access token | `FACEBOOK_USER_ACCESS_TOKEN` |

**Sin respaldo cruzado.** Si falta el que toca, la llamada no se hace: devuelve
`SIN_CREDENCIAL` con `llamadas: 0` y la familia que falta. Contar una llamada
que no salió falsearía el único número que este proyecto vigila.

`sanitizar()` redacta ahora las dos familias — el error de un host puede traer
el token del otro, y redactar solo uno lo dejaría a la vista justo en el
mensaje que alguien va a copiar y pegar.

### Credencial requerida, por vía

| | Instagram `business_discovery` | Facebook Page pública |
|---|---|---|
| credencial | Facebook User access token | Facebook User access token |
| flujo | Facebook Login for Business | Facebook Login for Business |
| permisos | `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list` | Page Public Content Access |
| nivel para terceros | Advanced Access | Advanced Access |

Las dos vías comparten familia de token. Lo que no comparten es el permiso.

### Lo que un token NO resuelve

Standard Access alcanza **solo a usuarios y Páginas con un rol en la app**. Un
candidato nunca lo va a tener. Así que con la credencial correcta y sin Advanced
Access, el reintento sobre un candidato seguirá fallando — pero fallará con un
error de **permisos**, que es información que hoy no tenemos.

Eso es exactamente lo que mediría `META-THIRD-PARTY-REAL-02`, y es la razón de
hacerlo: convierte una hipótesis documental en una causa demostrada.

    CREDENCIAL_PARSEABLE  !=  MEDIDO_TERCERO

### Credencial validada — 1 llamada

```
GET graph.facebook.com/v23.0/me?fields=id,name    → HTTP 200
```

`CREDENCIAL_PARSEABLE`. `FACEBOOK_USER_ACCESS_TOKEN` presente, 297 caracteres,
cadena distinta de la de Instagram.

La llamada pregunta por el **titular del token**, no por un tercero, y es la más
barata que separa tres cosas que se confunden:

| | significa |
|---|---|
| no se parsea | familia equivocada |
| **se parsea** | **familia correcta** ← estamos aquí |
| se parsea y falla | familia correcta, permisos por ver |

Esta llamada responde la primera. Nada más. `validarCredencialDeFacebook()`
devuelve `titularIdentificado: boolean` y **no** el nombre ni el id: para
validar un token no hace falta el nombre de nadie, y lo que no se devuelve no
acaba en un log.

### App Review y Business Verification

**Todavía no demostrados.** La documentación dice que Advanced Access exige
Business Verification, y Advanced Access es necesario para terceros. Pero
ninguna respuesta de Meta nos lo ha dicho aún, porque ninguna llamada ha llegado
a evaluar permisos.

La distinción no es un tecnicismo: es la diferencia entre «lo leí» y «lo medí».

---

## META-THIRD-PARTY-REAL-02 (2026-08-30)

Reintento con `FACEBOOK_USER_ACCESS_TOKEN`. **7 llamadas Meta.**

### Lo primero: el primer intento salió contaminado

La llamada de prerequisito —`GET graph.facebook.com/me/accounts`— devolvió esto:

```
pageId  725422874136257
nombre  Jota Lloret
username  jotalloretv
instagram_business_account  jotalloretv
```

**El token administra la Página del candidato patrón y su Instagram vinculado.**

Así que las dos primeras sondas preguntaron por *nuestro propio activo*:

| Sonda | Resultado | Lo que realmente era |
|---|---|---|
| `business_discovery(jotalloretv)` | HTTP 200, 10 821 seguidores | nuestra cuenta preguntando por sí misma |
| Page `jotalloretv` | HTTP 200, 55 859 seguidores | Página que administramos |

Datos reales, cifras reales, y **cero evidencia sobre terceros**. Un resultado
positivo con el sujeto equivocado se lee exactamente igual que un éxito.

Sin la llamada de prerequisito, este gate habría declarado `MEDIDO_TERCERO` con
evidencia de `MEDIDO_PROPIO`.

Se repitió contra un candidato que **no** aparece en `me/accounts`.

### Instagram · tercero genuino: MEDIDO_TERCERO

```
GET graph.facebook.com/v23.0/{nuestro_ig_id}
    ?fields=business_discovery.username(OBJETIVO){...}     → HTTP 200
```

| | |
|---|---|
| username / name | ✓ |
| followers_count | **9 719** |
| media_count | **1 635** |
| muestra | 5 publicaciones |
| por publicación | `id`, `permalink`, `timestamp`, `media_type`, `like_count`, `comments_count` |
| likes de la muestra | 19 · 28 · 15 · 36 · 30 |

**No volvieron:** `follows_count`, `view_count`. **No se pidieron:** `reach`,
`impressions`, `saved`, `shares` — son `OWNER_INSIGHT`.

### Facebook · tercero genuino: BLOQUEADO_PERMISOS

```
GET graph.facebook.com/v23.0/{page}?fields=id,name,username,fan_count
→ HTTP 400 · code 100 · OAuthException
```

Meta nombra **tres** alternativas, y no son igual de caras:

- permiso `pages_read_engagement`
- feature **Page Public Content Access**
- feature **Page Public Metadata Access**

Esto sí es una causa demostrada: el error llega a evaluar permisos y los
enumera. Reducirlo a «hace falta App Review» perdería la única pista útil.

**Business Verification no aparece mencionada.**

### Comentarios · Instagram: PARTIAL

`comments_count` llega por publicación del tercero. El **texto** no:

```
...business_discovery.username(){media{comments{text,timestamp,username}}}
→ HTTP 400 · code 100 · «Please read documentation for supported fields»
```

Recuento sí, texto no — y esto último es una **medición**, no una suposición. Con
solo el recuento no se puede analizar ni un comentario.

No se probó la arista `/{ig-media-id}/comments` directa.

### Verificación técnica de tipo

`business_discovery` solo responde sobre cuentas profesionales, así que
**responder es la evidencia del tipo**. Tres activos pasan a `META_API` /
`VERIFICADA`; los otros 20 siguen intactos en `ANALYST_DECLARATION`.

| Activo | Tipo | Nota |
|---|---|---|
| `instagram:pedropalaciosu` | `INSTAGRAM_PROFESSIONAL` | tercero genuino |
| `instagram:jotalloretv` | `INSTAGRAM_PROFESSIONAL` | activo propio; el tipo se sostiene, el acceso no |
| `facebook:jotalloretv` | `FACEBOOK_PAGE` | activo propio |

### Discrepancia con la documentación

`META-PUBLIC-ACCESS-01` documentó que terceros exigen **Advanced Access** y
**Business Verification**. La llamada funcionó sin que consten concedidos.

Lo medido es que **funciona**. *Por qué* funciona no está demostrado, y no
conviene deducirlo. Queda registrada la discrepancia en lugar de reescribir una
de las dos.

### `habilitaBenchmark()`

| | antes | después |
|---|---|---|
| instagram | `false` | **`true`** |
| facebook | `false` | `false` |

Instagram entra con 7 capacidades sobre un tercero genuino: identidad, cuenta,
followers, publicaciones, likes, comments, url_verificable. El mismo baremo con
el que entraron X y YouTube — ser más estricto solo con Instagram sería
arbitrario.

`views` y `shares` **no** ascienden: son `OWNER_INSIGHT` y no vinieron del
tercero. Moverlas sería presentar una cifra nuestra como si fuera de un
candidato.

**Aviso de cobertura:** `business_discovery` solo alcanza cuentas
profesionales. De los 12 Instagram del proyecto, solo los declarados
profesionales son observables.

### Defecto encontrado de paso

`guardarDeclaracionesDeTipo` usaba `candidato + fecha` como clave de entidad.
Dos lotes del mismo candidato con el mismo `declaradoEn` producían la **misma**
entidad, y el Lake devuelve la última versión: el primer lote seguía escrito y
dejaba de leerse, con `escrito: true`. La clave lleva ahora un discriminante de
contenido.

---

## Siguiente decisión

Con Meta oficial cerrado por credencial, hay dos caminos y son excluyentes en
esfuerzo: montar Facebook Login for Business, o dejar Meta y usar lo que ya
mide.

El dato que decide: **X y YouTube ya sostienen el benchmark.** Nada está
bloqueado esperando a Meta.
