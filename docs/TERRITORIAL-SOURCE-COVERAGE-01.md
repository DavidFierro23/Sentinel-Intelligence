# TERRITORIAL-SOURCE-COVERAGE-01

## Qué puede escuchar Sentinel en Cuenca, y qué no

**Gate:** TERRITORIAL-SOURCE-COVERAGE-01
**Fecha:** 2026-09-01
**Proyecto:** `alcaldia-cuenca-2027-piloto` — «Elecciones Alcaldía Cuenca 2027»
**Coste:** **0 USD** · solo RSS público · sin credenciales, sin proveedores nuevos

---

## 0. La pregunta que contesta este documento

> Sin que nadie le siembre temas, **¿qué descubre Sentinel por sí solo sobre Cuenca?**

No «¿cuántas noticias tenemos?». La respuesta útil es un mapa de lo que vemos **y de
lo que no**, porque en inteligencia territorial lo que no se busca se lee como que no
existe.

---

## 1. Qué puede observar hoy

Con evidencia real, sobre el corpus del proyecto:

| | |
|---|---|
| Evidencias del proyecto | **284** |
| Observaciones acumuladas | **689** |
| Dominios distintos | 11 |
| Con resumen | 283 de 284 |
| Con fecha de publicación | **284 de 284** |
| Emisores resueltos | **100 %** por feed comprobado del propio medio |
| Actores observados | **11** — 6 medios, 4 instituciones, 1 sin clasificar |
| Plataformas | **solo `web`** |

Observación longitudinal real, dos pasadas del 1 de septiembre:

```
pasada 13 · ciclo 7 · 8 feeds    76 observadas   18 nuevas   58 duplicadas
pasada 14 · ciclo 7 · 3 feeds   101 observadas   89 nuevas   12 duplicadas
                                 corpus: 177 → 284
```

El dedup funciona contra el corpus **ya escrito**: 70 piezas del día anterior se
reconocieron y no se duplicaron. **El histórico es real y crece.**

## 2. Qué NO puede observar

- **Ninguna plataforma social por territorio.** No hay descubrimiento geográfico
  abierto: no se puede preguntar «qué se publica en Cuenca» a X, Facebook, Instagram
  ni TikTok. Los adapters existentes sirven para **activos públicos conocidos**, que es
  otra cosa.
- **Ningún creador ni influencer.** Todo el corpus es prensa e instituciones. Es la
  carencia más grande.
- **Ningún comentario público.**
- **Ninguna comunidad ni página pública.**
- **Ningún periodista como actor** — se resuelve el medio, no la firma.
- **Web abierta**: adapters completos, sin credencial.

---

## 3. Matriz de cobertura

Estados: `OPERATIVO` exige **evidencia real en el corpus**; un adapter configurado y
nunca ejecutado no cuenta.

| Dimensión | Estado | Evidencias | Actores | Qué falta |
|---|---|---|---|---|
| Noticias | **OPERATIVO** | 284 | 11 | Más feeds directos |
| RSS de medios | **OPERATIVO** | 284 | 11 | Recorrer más sitios locales |
| Instituciones | **OPERATIVO** | 36 | 4 | Resto de instituciones del cantón |
| Enlaces y dominios | **OPERATIVO** | 284 | 11 | Grafo de enlaces salientes |
| Medios digitales | PARCIAL | 284 | 11 | Universo no exhaustivo |
| Temas emergentes | PARCIAL | 377 señales | — | Consolidación semántica |
| Territorio explícito | PARCIAL | 107 | — | Extracción de entidades geográficas |
| Histórico | PARCIAL | 284 | — | **Tiempo, no código** |
| Tendencias | PARCIAL | 0 declarables | — | Días de observación |
| Web abierta | **REQUIERE_PROVEEDOR** | 0 | — | `BRAVE_API_KEY` |
| YouTube | NO_PROBADO | 0 | 0 | `YOUTUBE_API_KEY` propia |
| X · Facebook · Instagram · TikTok | NO_PROBADO | 0 | — | Descubrimiento por territorio |
| Periodistas | NO_PROBADO | 0 | 0 | Explotar el campo autor de los feeds |
| Marcas y empresas | NO_PROBADO | 0 | 0 | Registro de activos públicos |
| Comentarios públicos | **NO_DISPONIBLE** | 0 | — | Proveedor con acceso legítimo |
| Influencers y creadores | **NO_DISPONIBLE** | 0 | 0 | Descubrimiento social geográfico |
| Comunidades públicas | **NO_DISPONIBLE** | 0 | 0 | Búsqueda pública por lugar |

**Resumen: 4 OPERATIVO · 5 PARCIAL · 7 NO_PROBADO · 3 NO_DISPONIBLE · 1
REQUIERE_PROVEEDOR.** Las 20 dimensiones están resueltas conceptualmente.

### Fuera de alcance — decisión de producto, no carencia

Rastreo individual de personas · dispositivos o localización individual · atributos
sensibles · perfiles privados · inferencias individuales de comportamiento político.

> No se declara ningún porcentaje de «cobertura de internet en Cuenca». **No existe el
> denominador de esa fracción** y fingirlo sería peor que no decir nada.

---

## 4. Open Topic Discovery: qué encuentra sin que se lo siembren

**No se le pasó ninguna lista de temas.** Todo lo que sigue salió del corpus.

| señal | evidencias | fuentes | territorios |
|---|---|---|---|
| José Serrano | 53 | 5 | 2 |
| Cristian Zamora | 42 | 3 | 7 |
| Aquiles Álvarez | 31 | 6 | 2 |
| Seguridad ciudadana | 25 | 5 | 3 |
| Galo Osorio | 22 | 5 | 2 |
| Integridad pública | 21 | 6 | 2 |
| Gestión y gobernanza | 21 | 6 | 5 |
| Educación | 19 | 5 | 3 |
| Salud | 16 | 7 | 4 |
| Obra pública | 13 | 5 | 5 |
| Barcelona SC | 11 | 3 | 1 |
| Movilización social | 10 | 5 | 4 |
| Economía y empleo | 10 | 4 | 5 |
| Marcelo Gallardo | 10 | 4 | 2 |
| Movilidad y transporte | 9 | 5 | 2 |

**Sí descubre, sin sembrar:** política y actores políticos, seguridad, movilidad,
obra pública, educación, salud, economía y empleo, integridad pública, movilización
social y **deporte** (Barcelona SC, Marcelo Gallardo).

**No aparece nada de:** Deportivo Cuenca, clima, turismo, restaurantes y comercio,
conciertos y eventos, entretenimiento, moda, marcas, influencers, memes. No porque el
motor no pueda: **porque el corpus es prensa e instituciones.** Esos temas viven en
plataformas que no observamos.

### Quién vs qué

De las señales mostradas, **22 parecen un actor y no un asunto**. El clasificador
existente los separa y su veredicto viaja **con su confianza**, porque falla de forma
visible: tipa **«Barcelona SC» como PERSON** (0,65) por ser dos palabras capitalizadas.
Se expone en lugar de ocultarse.

### La fragmentación, medida y no maquillada

**377 señales para 284 evidencias.** Casi una señal por pieza no es una agenda: es una
lista. En el gate anterior eran 185 para 177, así que **empeora al crecer el corpus**.

Se probó subir `documentosMinimos` de 2 a 3 y el número **subió**. El umbral gobierna
la formación de clusters, no el ruido residual. Se revirtió en lugar de tocar un motor
compartido sin beneficio medido.

Lo que sí hace este gate: **clasificar la señal** —`TEMA` / `LUGAR` / `TEMPORAL`— y
marcar cuáles parecen un actor, para que el ruido se pueda **ver y filtrar** en lugar
de contarse como agenda. Sobreviven tokens genéricos como «caso» y «autoridades».

---

## 5. Source Universe: actores observados

11 actores derivados del corpus, no de una lista:

| clase | n |
|---|---|
| MEDIO | 6 |
| INSTITUCION | 4 |
| NO_CLASIFICADO | 1 |

Los 11 en `COMPROBADO` —feed comprobado del propio medio— y **cero verificados por
analista**. La cifra se cuenta para que la ausencia sea visible.

Cada actor lleva: `projectId`, `entityId` estable, nombre, alias observados, clase con
**su origen**, territorio, plataformas, URLs, evidencias que lo sustentan, primera y
última observación, procedencia y certeza.

> **Aparecer no es estar verificado.** Un actor que aparece una vez entra como
> `DESCUBIERTO`. Si el descubrimiento se autoverificase, el registro sería un espejo de
> la recolección en lugar de una fuente de verdad.

`atributosSensibles` es `null` **por decisión, no por olvido**.

---

## 6. Atención observable: lo que se puede decir

Se añadió una capa que convierte una medida en una frase **y se niega a producirla
cuando la medida no la sostiene**.

Permitido (todo atado a la muestra en el propio texto):

```
Extra · dominio más recurrente del corpus observado
José Serrano · mayor número de menciones observadas en la muestra
José Serrano · mayor amplificación detectada entre fuentes observadas
```

Prohibido, con el motivo de por qué:

| frase | qué le falta |
|---|---|
| «lo más visto en Cuenca» | mediría a toda la audiencia del territorio |
| «lo que piensa Cuenca» | publicar no es opinar, y quien no publica no aparece |
| «X % de la población» | denominador oficial con licencia |
| «penetración» / «per cápita» | denominador poblacional |
| «intención de voto» | encuesta con muestreo |

La respuesta de la API pasa por `revisarSalida` antes de enviarse. **Resultado en la
ejecución real: ninguna cadena afirma más de lo que los datos sostienen.**

---

## 7. Geografía: Cuenca vs nacional, resuelto

El gate anterior reportó «98 de 177 sin territorio» y se leyó como un fallo del
resolutor. **No lo era.** Con cuatro estados en lugar de dos:

| estado | n | qué significa |
|---|---|---|
| **A · TERRITORIO_EXPLICITO** | **107** | la pieza lo sostiene. **El único que cuenta** |
| B · FUENTE_LOCAL_SIN_TERRITORIO | **4** | medio local, pieza sin topónimo |
| C · NACIONAL_RELACIONADO | **173** | medio nacional del universo |
| D · TERRITORIO_NO_RESOLUBLE | **0** | ni pieza ni fuente sostienen nada |

Los cuatro **suman el corpus**: si no sumaran, alguna pieza se habría descartado en
silencio.

El diagnóstico correcto no era «el resolutor falla» sino **«el corpus es mayoritariamente
nacional»**: 173 de 284 piezas vienen de Expreso, Extra, Teleamazonas y Plan V, cuyos
artículos no mencionan Cuenca. Solo **4** son de medio local sin topónimo.

Ninguna de las tres últimas se atribuye al cantón. B se muestra como **«Fuente local ·
territorio de la pieza no demostrado»**: es una pista sobre la fuente, no sobre el
contenido.

---

## 8. Histórico

Empezó a acumular de verdad. `firstObservedAt` inmutable, `publishedAt` del medio, sin
backfill. Pero **0 tendencias declarables**: las ventanas anteriores no se observaban.

El mecanismo está probado con corpus sintético —`CRECIENDO`, `DISMINUYENDO`, `ESTABLE`
funcionan— y se niega a declarar sin ventana comparable, que es lo correcto. **Lo que
falta es tiempo, no código.**

---

## 9. Gaps ordenados por lo que los cierra

**Se cierran con tiempo:** tendencias, histórico.

**Se cierran con una credencial:** web abierta (`BRAVE_API_KEY`), YouTube
(`YOUTUBE_API_KEY`).

**Se cierran con trabajo propio:** periodistas (explotar el campo autor de los feeds,
la señal ya está en los datos), fragmentación del descubrimiento, más feeds locales.

**Solo se cierran con un proveedor nuevo:** creadores e influencers, comunidades y
páginas públicas, comentarios, descubrimiento social por territorio.

---

## 10. Proveedores recomendados SOLO por gap

No se recomienda ninguno «para tener más volumen». Cada uno responde a un hueco
concreto de la matriz:

| gap | proveedor | por qué ese y no otro |
|---|---|---|
| **Creadores, comunidades, conversación pública** | **Data365** | Es la dimensión ausente por completo. Trial 14 días **sin tarjeta**. |
| **Territorio explícito + histórico** | **GDELT Cloud** | Extracción geográfica explícita e histórico desde 1979. Sandbox **sin tarjeta**. |

**No se integra ninguno en este gate.** Meltwater y Brandwatch siguen descartados como
siguiente paso: exigen contrato de cinco cifras **antes** de poder comprobar si Cuenca
está cubierta.

**ScrapeCreators** no se usó: sirve para **activos públicos conocidos**, no para
descubrimiento geográfico abierto, y no se gastaron créditos.

---

## 11. Próximos gates priorizados

1. **`TERRITORIAL-LOCAL-SOURCE-EXPANSION-01`** — subir las 4 fuentes locales del corpus.
   Es lo único que mejora la señal territorial **sin proveedor y sin credencial**: hoy
   173 de 284 piezas son nacionales porque solo hay 6 medios locales con feed.
2. **`TERRITORIAL-JOURNALIST-01`** — periodistas desde el campo autor de los feeds. La
   señal ya está en los datos y no se procesa.
3. **`TERRITORIAL-PROVIDER-REAL-01`** — prueba real de GDELT Cloud o Data365, según qué
   hueco se decida cerrar primero. Requiere alta manual del usuario.
4. **`TERRITORIAL-TREND-RADAR-01`** — cuando haya días de histórico acumulado.

---

## 12. Límites de esta auditoría

- El corpus es de **un solo proveedor real** (`rss_directo`); Google News y YouTube
  están en el corpus histórico pero no en el del proyecto.
- **Ninguna dimensión social fue probada**: se declaran `NO_PROBADO` o `NO_DISPONIBLE`,
  no «cero».
- La clasificación de entidades es **heurística y sin verificar**.
- Los 11 actores están `COMPROBADO`, **ninguno verificado por analista**.
- No se leyeron términos de servicio de ninguna plataforma.
