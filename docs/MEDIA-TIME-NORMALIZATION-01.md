# MEDIA-TIME-NORMALIZATION-01 — Normalización temporal sin inventar fechas

**Fecha:** 2026-09-01
**Gate anterior:** MEDIA-UX-CERT-01 (`aa6be74`)
**Requests externos: 0. Coste: 0,00 USD.**

---

## 1. Una corrección al baseline que yo mismo reporté

Los gates anteriores decían «26 piezas en `FECHA_NO_NORMALIZADA`». Al inventariar
pieza por pieza, esa cifra mezclaba **dos estados distintos**:

| Estado real | Piezas | ¿Se puede normalizar? |
|---|---|---|
| `FECHA_NO_NORMALIZADA` — hay un valor y no es ISO | **9** | Sí, si es inequívoco |
| `SIN_EVIDENCIA` — no hay ningún valor de fecha | **17** | **No**, sin reingestión |
| Ya normalizada | 2 | — |

La distinción no es cosmética: una se arregla con un parser y la otra solo
volviendo a la fuente. Colapsarlas hacía parecer que el gate podía resolver 26
casos cuando el techo real eran 9.

---

## 2. Los patrones encontrados

Las 9 con valor son todas del mismo tipo: **fecha corta en español devuelta por
el buscador**.

```
3 jul 2026     expreso.ec            2 jul 2026     elmercurio.com.ec
2 jul 2026     threads.com           9 jul 2024     elmercurio.com.ec
21 may 2025    elmercurio.com.ec     15 may 2023    eluniverso.com
12 sept 2025   primicias.ec          23 ago 2023    elmercurio.com.ec
3 jul 2026     elmercurio.com.ec
```

Las 17 sin valor vienen de `google.com` (7), `facebook.com` (3),
`instagram.com` (2), el host de infraestructura (2), `elmercurio.com.ec` (2) y
`azuay.gob.ec` (1). Son enlaces que el buscador devolvió sin fecha, no fechas
que no sepamos leer.

---

## 3. La escalera de fuentes temporales

De más fuerte a más débil. La primera que resuelve gana, y el método queda
registrado en la pieza:

| # | Método | Ejemplo | Precisión |
|---|---|---|---|
| A | `ISO_8601` | `2026-07-03T00:40:32Z` | instante |
| B | `TEXTO_ES_INEQUIVOCO` | `3 jul 2026`, `3 de julio de 2026` | día |
| C | `NUMERICA_INEQUIVOCA` | `21/05/2025` — solo si el día > 12 | día |
| D | `RELATIVO_A_OBSERVACION` | `ayer`, `hace 2 horas` — con referencia | día / instante |
| — | *(ninguna)* | `publishedAt` sigue `null` | — |

**No hay un peldaño para «usar `observedAt`».** Es deliberado, y hay un test que
comprueba que no existe ningún camino que lo permita.

---

## 4. El detalle que decide si «HOY» significa algo

`3 jul 2026` tiene precisión de **día**, no de instante. Convertirlo a
`2026-07-03T00:00:00Z` parece inofensivo y no lo es: en `America/Guayaquil`
(UTC−5) esa medianoche UTC son **las 19:00 del 2 de julio**, así que la pieza
caería en el día anterior.

Con las ventanas de calendario que usa Sentinel —HOY es un día local, no 24
horas rodantes— eso desplaza piezas de un día al otro de forma sistemática. Por
eso una fecha de día se ancla a la **medianoche local**:

```
3 jul 2026  →  2026-07-03T05:00:00.000Z  →  local: 2026-07-03  ✓
```

Se aplica lo mismo a una fecha ISO **sin hora** (`2026-07-03`): la precisión del
dato no cambia porque el formato sea ISO.

---

## 5. Lo que se negó a normalizar, y por qué

| Caso | Decisión | Motivo |
|---|---|---|
| `03/07/2026` | **No se resuelve** | Puede ser 3 de julio o 7 de marzo. La convención del publicador no viaja en el dato. Elegir DD/MM «porque en Latinoamérica se usa así» acertaría muchas veces y fallaría **en silencio** el resto: la peor combinación posible. |
| `21/05/2025` | Sí se resuelve | No hay mes 21. El propio número desambigua. |
| `ayer` sin `observedAt` | **No se resuelve** | Sin saber cuándo se leyó, no es una fecha: es una frase. |
| `30 feb 2026` | **No se resuelve** | El día no existe en ese mes. |
| `3 jul 1850` / `3 jul 2400` | **No se resuelve** | Fuera de rango: en un corpus de campaña eso es un fallo de parseo, no un dato. |
| Sin valor | **No se resuelve** | No es un formato desconocido: no hay dato que interpretar. |

Los motivos **no se colapsan** en «no se pudo». `SIN_VALOR` se arregla
reingiriendo; `AMBIGUA` no se arregla nunca sin más contexto. Mezclarlos
ocultaría cuál tiene solución.

---

## 6. Por qué NO hubo backfill

La normalización ocurre **al leer**, no reescribiendo el Lake. Es una decisión,
no un atajo:

- el valor crudo queda intacto y siempre reauditable;
- es **idempotente por construcción**: leer dos veces no puede duplicar nada,
  ni mover un id, ni crear una versión;
- mejorar el parser mañana mejora **todo** el corpus sin un backfill, incluidas
  las filas que hoy no se resuelven.

Un backfill habría escrito 9 versiones nuevas de piezas para obtener el mismo
resultado, con riesgo de sobrescribir una fecha válida y sin ganar nada que no
se pueda derivar. Verificado: `registrosEnLake` es idéntico antes y después de
dos lecturas.

---

## 7. Antes / después

### Normalización

| | Antes | Después |
|---|---|---|
| Piezas con fecha utilizable | **2** de 28 | **11** de 28 |
| Proporción datable | 7 % | **39 %** |
| `FECHA_NO_NORMALIZADA` | 9 | **0** |
| `SIN_EVIDENCIA` (sin valor) | 17 | 17 — *no normalizable sin reingestión* |

Métodos aplicados: `TEXTO_ES_INEQUIVOCO` 9 · `ISO_8601` 2.

### Ventanas

| Ventana | Antes (dentro) | Después (dentro) | Sin fecha |
|---|---|---|---|
| HOY | 0 | 0 | 17 |
| 7D | 0 | 0 | 17 |
| 15D | 0 | 0 | 17 |
| 30D | 0 | 0 | 17 |
| **90D** | **1** | **5** | 17 |

HOY–30D siguen en 0 y es correcto: la pieza datable más reciente es de julio de
2026. Un 0 aquí es una **medición**, no un hueco.

### Ranking (90d) — el cambio más visible

| Antes | Después |
|---|---|
| #1 La Voz del Tomebamba (1) | **#1 El Mercurio (2 en ventana, 8 en corpus)** |
| #2 El Mercurio (**0**, con 8 en corpus) | #2 Expreso (1) |
| resto en «Cobertura insuficiente» | #3 threads.com (1) · #4 La Voz del Tomebamba (1) |
| | #8 El Universo (**0**) · #9 Primicias (**0**) |

El Mercurio pasa de aparentar inactividad a encabezar la lista con actividad
**real dentro de la ventana**. Y El Universo y Primicias muestran **0**
legítimo: tienen piezas datables (2023, 2025) que caen fuera de los 90 días.
Eso es exactamente lo que pedía el criterio «un medio con piezas históricas
fuera de ventana no debe aparecer como si tuviera actividad actual».

Facebook e Instagram siguen en «Cobertura insuficiente»: sus piezas no tienen
fecha, así que no se les asigna un 0.

---

## 8. Lo que no cambió

- **Candidatos × Medios** intacto: Carrasco 6 fuentes / 7 evidencias, Lloret 4 / 6.
  `piezas por candidato` sigue `NO_DISPONIBLE`: la arista se deduplica por par y
  no enumera piezas. No se inventó.
- **Amplificación**: 26 en corpus / 10 fuentes / 2 contenidos, sin sumar. Ahora
  además 4 situadas en la ventana de 90d. Sigue sin afirmar copia, causalidad ni
  coordinación.
- **Incidencia**: sigue `METODOLOGIA_EN_CONSTRUCCION`. Su motivo se recalcula
  solo y ya dice «17 no se pueden situar» en vez de 26. Normalizar fechas no
  crea la segunda ventana comparable que le falta.
- **Dedupe, ids y aislamiento por proyecto**: verificados, sin cambios.

---

## 9. Limitaciones declaradas

1. **17 piezas seguirán sin fecha** hasta que se reingiera con un adaptador que
   capture la fecha del resultado del buscador. Este gate no hace requests.
2. Las fechas derivadas de día tienen **precisión de día**, no de hora. El campo
   `precision` lo declara; no se debe usar para ordenar dentro de un mismo día.
3. `03/07/2026` y equivalentes **nunca** se resolverán sin conocer la convención
   del publicador. No es un defecto pendiente: es una decisión.
4. Las relativas (`ayer`, `hace 2 horas`) están implementadas y probadas, pero
   **el corpus actual no contiene ninguna**. Su cobertura real está sin medir
   contra datos de producción.

---

## 10. Comprobaciones

| | |
|---|---|
| `mediaTime.test.mjs` | **28 / 28** |
| Suites de Media registradas | **142 / 142** |
| Suite completa backend | **1.473** (1.331 + 142), 0 fallos |
| Render de pantalla | **47 / 47** en `90d` y `hoy` |
| Build | limpio |
| Lint | 6 errores preexistentes; **0 en Media** |
| Requests externos | **0** |

Tres tests existentes cambiaron de *fixture* y **ninguno se debilitó**: usaban
`3 jul 2026` como ejemplo de fecha no interpretable, y ahora se resuelve. Pasan
a `03/07/2026`, que sigue siendo genuinamente ambigua, y se añadió su
contraparte que comprueba que la fecha en español **sí** se resuelve.

`mediaTime.test.mjs` **no está registrado en `npm test`**: `package.json` sigue
mezclando líneas sin commitear de otra terminal y este gate tenía prohibido
tocarlo. Se ejecuta con `node tests/mediaTime.test.mjs`.

---

## 11. Siguiente gate

`MEDIA-SOURCE-UNIVERSE-01`. La normalización temporal ya no lo bloquea: el
ranking responde a la ventana y las fuentes están separadas en medio /
artefacto / infraestructura / sin clasificar.

Queda registrado, para cuando toque, que reingerir la amplificación capturando
la fecha del buscador cerraría las 17 piezas restantes.
