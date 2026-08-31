# TERRITORIAL-PROVIDER-EVAL-01

## Evaluación de proveedores externos para Inteligencia Territorial

**Gate:** TERRITORIAL-ACCELERATION-02
**Fecha:** 2026-08-31
**Proyecto de referencia:** `alcaldia-cuenca-2027-piloto`
**Coste incurrido:** **0 USD** · ninguna tarjeta, ninguna cuenta creada, ningún contrato

---

## 0. Regla que gobierna este documento

> **DOCUMENTADO ≠ PROBADO.**

Que una página comercial diga «global coverage» no significa que Cuenca esté cubierta.
Ecuador y Cuenca se declaran **NO VERIFICADO** en los cuatro proveedores, porque en
ninguno se pudo medir. Ningún proveedor se marca `OPERATIVO`: eso exige una prueba real
que este gate no pudo ejecutar en ninguno de los cuatro.

Lo que sí se midió, con evidencia propia, está marcado como **PROBADO**.

---

## 1. Baseline del proyecto — contra qué se compara

Medido dinámicamente sobre el ledger al ejecutar este gate. **No está hardcodeado**: si
el ledger cambia, el baseline cambia.

| | |
|---|---|
| `projectId` | `alcaldia-cuenca-2027-piloto` |
| Evidencias del proyecto | **177** |
| Dominios distintos | 11 |
| Con resumen | 176 de 177 |
| **Emisores RESUELTOS** | **177 de 177** (vía feed comprobado del propio medio) |
| Territorio resuelto | 79 de 177 · **98 sin resolver** |
| Señales | 22 clasificadas + ~185 descubiertas |
| Territorios observados | 7 |
| Proveedor del corpus | `rss_directo` (100 %) |

**Ventanas (celdas de la matriz):** hoy 266 · 7d 375 · 15d 416 · 30d 418 · 90d 474.

**Comparación temporal:** todas las señales en `HISTORICO_INSUFICIENTE`. El histórico
del proyecto empezó hoy.

### Los tres huecos que un proveedor podría cerrar

1. **98 de 177 evidencias sin territorio resuelto.** El corpus RSS trae medios
   nacionales cuyos artículos no mencionan Cuenca. Un proveedor con **extracción
   explícita de entidades geográficas** cerraría esto.
2. **Cero conversación pública.** Sentinel observa medios e instituciones. No observa
   publicaciones ciudadanas, menciones ni engagement. Es una dimensión **ausente por
   completo**, no incompleta.
3. **Cero histórico anterior a hoy.** Ninguna tendencia es declarable. Un proveedor con
   archivo histórico daría línea base sin esperar semanas.

---

## 2. GDELT Cloud (BigQuery)

| Campo | Valor |
|---|---|
| Producto | GDELT 2.0 Events + Global Knowledge Graph, como dataset público de BigQuery |
| Web oficial | gdeltproject.org |
| Documentación API | Google Cloud Public Datasets · BigQuery |
| NEWS | **sí** — noticias globales, 100+ idiomas |
| SOCIAL | no |
| COMMENTS | no |
| EVENTS | **sí** — más de 300 categorías, ~58 campos por evento |
| ENTITIES | **sí** — personas, organizaciones, temas (GKG) |
| GEO | **sí** — extracción explícita de ubicaciones con nivel administrativo y coordenadas |
| HISTORICAL | **sí, el más profundo de los cuatro** — Events desde 1979; GKG 2.0 desde 2015 |
| REAL TIME | sí — actualización cada 15 minutos |
| **ECUADOR** | documentado a nivel país (cobertura global declarada) · **NO VERIFICADO** |
| **CUENCA** | **NO PROBADO** |
| STABLE IDs | sí — `GLOBALEVENTID`, `DocumentIdentifier` (URL) |
| PERMALINKS | sí — URL del artículo original |
| TIMESTAMPS | sí — fecha del evento y de la publicación |
| PROVENANCE | **buena** — URL, fuente, país de la fuente, idioma |
| **TRIAL** | **sí, real y sin tarjeta** — BigQuery *sandbox*: cuenta de Google, sin cuenta de facturación |
| FREE CREDITS | 1 TB de consulta procesada/mes · 10 GB de almacenamiento |
| PRECIO | **0 USD** dentro del sandbox. Fuera: 5 USD/TB tras el primer TB |
| CONTACT SALES | **no hace falta** |
| RATE LIMITS | los del sandbox: sin *streaming*, sin DML, tablas con caducidad de 60 días |
| RETENTION | dataset público permanente; las tablas propias caducan a 60 días en sandbox |
| STORAGE RIGHTS | dataset público; revisar licencia GDELT para uso comercial |
| REPORTING RIGHTS | pendiente de leer la licencia |

### Evidencia propia — PROBADO

La vía **DOC API** de GDELT está **inalcanzable desde esta máquina**, medido dos veces
en este gate:

```
Cuenca Ecuador   TIEMPO_AGOTADO   UND_ERR_CONNECT_TIMEOUT   10.619 ms
Azuay Ecuador    TIEMPO_AGOTADO   UND_ERR_CONNECT_TIMEOUT   10.640 ms
```

El fallo es en la **fase de conexión**, no un límite de tasa ni un rechazo de consulta.
Es el mismo `UND_ERR_CONNECT_TIMEOUT` que ya se documentó en TERRITORIAL-FRESH-01, así
que el bloqueo es **reproducible y estable**, no un incidente.

> Esto **refuerza** la opción BigQuery en lugar de descartarla: es otro endpoint y otro
> transporte. Pero significa que **la cobertura de GDELT sobre Cuenca sigue sin medir**,
> y no se va a afirmar sin medirla.

### Estado y qué añade

**Estado: `APTO_PARA_PRUEBA`**

Qué añade: histórico profundo, extracción geográfica explícita —lo único de los cuatro
que ataca directamente las 98 evidencias sin territorio— y evidencia con URL e id
estable. Todo a coste cero y sin tarjeta.

Qué **no** añade: conversación pública. GDELT es noticias, no redes.

---

## 3. Meltwater

| Campo | Valor |
|---|---|
| Producto | Media monitoring, social listening, contactos de medios, influencers |
| NEWS | sí | 
| SOCIAL | sí |
| COMMENTS | no documentado |
| EVENTS | no como tal |
| ENTITIES | sí |
| GEO | filtros geográficos documentados; granularidad cantonal **no documentada** |
| HISTORICAL | sí, según módulo y contrato |
| REAL TIME | sí |
| **ECUADOR** | **no documentado** en la información pública consultada |
| **CUENCA** | **NO PROBADO** |
| STABLE IDs / PERMALINKS / TIMESTAMPS | no verificable sin acceso |
| PROVENANCE | **NO VERIFICADO** |
| **TRIAL** | **no** — no hay prueba gratuita autoservicio; demo con comercial |
| PRECIO | no publicado. Contrato anual por presupuesto. Terceros reportan **~65.000 USD/año** de media y **>100.000 USD/año** en despliegues grandes |
| CONTACT SALES | **obligatorio** |
| RATE LIMITS · RETENTION · STORAGE · REPORTING | por contrato, no públicos |

**Riesgo de dependencia: ALTO.** Contrato anual, precio opaco, API solo en niveles
altos. Sin salida barata si la cobertura de Cuenca resulta pobre — y no se puede saber
antes de firmar.

### Estado y qué añade

**Estado: `REQUIERE_CONTACTO`** (de facto `REQUIERE_CONTRATO`)

Qué añadiría: cobertura de medios profesional y conversación social en un solo
proveedor. Qué impide evaluarlo: no hay forma gratuita de comprobar si Cuenca está
cubierta, y el coste de equivocarse es de cinco cifras.

---

## 4. Brandwatch

| Campo | Valor |
|---|---|
| Producto | Consumer Intelligence · escucha social |
| NEWS | parcial — su foco es social, no prensa local |
| SOCIAL | **sí, es su especialidad** |
| COMMENTS | sí, según plataforma y términos |
| EVENTS | no |
| ENTITIES | sí |
| GEO | filtros geográficos; granularidad cantonal **no documentada** |
| HISTORICAL | **~1 año** en planes base · 30 días es la opción barata · 2+ años solo Enterprise |
| REAL TIME | sí |
| **ECUADOR** | **no documentado** |
| **CUENCA** | **NO PROBADO** |
| PROVENANCE | **NO VERIFICADO** |
| **TRIAL** | **no** hay prueba pública. Demo + evaluación comercial. PoC solo negociado |
| PRECIO | no publicado. Terceros: desde **~800 USD/mes** hasta **15.000+ USD/mes**; ACV medio reportado **~50.000 USD/año** (rango observado 19.542–81.200 USD) |
| CONTACT SALES | **obligatorio** |

**Riesgo de dependencia: ALTO.** El histórico está escalonado por precio: la opción
asequible da 30 días, que es **menos de lo que Sentinel necesita** para declarar
tendencias en ventanas de 90 días.

### Estado y qué añade

**Estado: `REQUIERE_CONTACTO`**

Qué añadiría: conversación pública, la dimensión que Sentinel no tiene. Qué lo debilita
para este proyecto: es una herramienta de marca y consumidor, no de prensa local
cantonal, y su histórico asequible es más corto que nuestras ventanas.

---

## 5. Data365

| Campo | Valor |
|---|---|
| Producto | APIs de redes sociales para desarrolladores |
| NEWS | no |
| SOCIAL | **sí** — X, Instagram, Facebook, TikTok y otras |
| COMMENTS | **sí**, cuando la plataforma lo permite |
| EVENTS | no |
| ENTITIES | parcial |
| GEO | depende de la plataforma; granularidad cantonal **no documentada** |
| HISTORICAL | según plataforma y créditos |
| REAL TIME | sí |
| **ECUADOR** | **no documentado** específicamente |
| **CUENCA** | **NO PROBADO** |
| STABLE IDs / PERMALINKS / TIMESTAMPS | documentados a nivel de API |
| PROVENANCE | **NO VERIFICADO** |
| **TRIAL** | **sí — 14 días y SIN TARJETA**, previa llamada introductoria |
| FREE CREDITS | los del trial |
| PRECIO | por créditos, ligado a uso: **desde ~0,60 USD/1.000 registros**, planes desde **~300 EUR/mes** |
| CONTACT SALES | **sí para la documentación**: los valores de crédito se entregan tras una llamada introductoria |
| RETENTION · STORAGE · REPORTING | por contrato |

**Riesgo de dependencia: MEDIO.** Precio por uso y mensual, no anual: se puede parar.
Pero la documentación completa está detrás de una llamada, lo que impide evaluar el
coste real por adelantado.

### Estado y qué añade

**Estado: `APTO_PARA_PRUEBA`** (con `REQUIERE_CONTACTO` para la documentación)

Qué añade: **conversación pública, que Sentinel no observa en absoluto**. No es una
mejora incremental: es una dimensión nueva. Y el trial no pide tarjeta.

---

## 6. Ranking

Pesos del gate: cobertura nueva 30 % · Ecuador/Cuenca 20 % · recencia 15 % ·
geo/entidades 10 % · histórico 10 % · evidencia 10 % · coste 5 %.

**No se produce una puntuación numérica**: con Ecuador/Cuenca `NO VERIFICADO` en los
cuatro —el 20 % del peso— cualquier cifra total sería falsa precisión.

| criterio | GDELT Cloud | Data365 | Meltwater | Brandwatch |
|---|---|---|---|---|
| Cobertura nueva (30 %) | **ALTO** (histórico + geo) | **ALTO** (dimensión ausente) | ALTO | MEDIO |
| Ecuador/Cuenca (20 %) | NO VERIFICADO | NO VERIFICADO | NO VERIFICADO | NO VERIFICADO |
| Recencia (15 %) | **ALTO** (15 min) | ALTO | ALTO | ALTO |
| Geo/entidades (10 %) | **ALTO** — el único con extracción de ubicación explícita | BAJO | MEDIO | MEDIO |
| Histórico (10 %) | **ALTO** — 1979 / 2015 | MEDIO | MEDIO | **BAJO** en plan asequible |
| Evidencia/provenance (10 %) | **ALTO** — URL + id estable, verificable gratis | NO VERIFICADO | NO VERIFICADO | NO VERIFICADO |
| Coste (5 %) | **0 USD** (sandbox) | ~300 EUR/mes tras trial | ~65.000 USD/año | ~50.000 USD/año |
| **Evaluable sin tarjeta** | **SÍ** | **SÍ** | NO | NO |

### PROVEEDOR #1 — GDELT Cloud (BigQuery)

Porque es el único que se puede **comprobar antes de decidir**, a coste cero y sin
tarjeta, y porque es el único que ataca de frente el hueco más grande y más medido que
tenemos: **98 de 177 evidencias sin territorio resuelto**. Extracción geográfica
explícita, histórico desde 1979 y evidencia con URL e id estable.

La duda —¿cubre Cuenca?— se resuelve **midiendo, gratis**, en lugar de negociando.

### PROVEEDOR #2 — Data365

Porque aporta lo único que Sentinel no tiene en absoluto —conversación pública— con un
trial de 14 días **sin tarjeta** y un modelo mensual del que se puede salir. Es el
segundo porque su granularidad geográfica no está documentada y porque la documentación
de costes exige una llamada.

### Descartados para prueba en este gate

**Meltwater** y **Brandwatch**: ambos exigen contacto comercial y contrato de cinco
cifras anuales **antes** de poder comprobar si Cuenca está cubierta. Para un proyecto
cantonal, pagar decenas de miles al año por una cobertura no verificada es exactamente
el riesgo que este documento existe para evitar. No están descartados como productos:
están descartados **como siguiente paso**.

---

## 7. Recomendación operativa

**Proveedor recomendado para prueba real: GDELT Cloud vía BigQuery sandbox.**

- Requiere cuenta: **SÍ** — una cuenta de Google. No hace falta cuenta de facturación.
- Requiere tarjeta: **NO**.
- Coste de la prueba: **0 USD**.

### Qué tiene que hacer el usuario (no lo puede hacer Sentinel)

1. Entrar en `console.cloud.google.com/bigquery` con una cuenta de Google y **activar el
   sandbox** cuando lo ofrezca. No introducir tarjeta.
2. Crear un proyecto (el nombre es libre).
3. Consultar el dataset público de GDELT y ejecutar **una** consulta acotada a Ecuador
   sobre una ventana reciente, para medir cuántos documentos hay y de qué fuentes.
4. Pasar a Sentinel: el `projectId` de GCP y una credencial de servicio de solo lectura,
   **o** el resultado exportado en CSV/JSON.

### Qué medirá Sentinel con eso

Evidencias nuevas · fuentes nuevas · **fuentes locales nuevas** · temas nuevos ·
territorios nuevos · duplicados contra las 177 actuales · recencia · provenance · coste.

La pregunta que decide: **¿qué añade que Sentinel no tenga?** Concretamente: ¿reduce las
98 evidencias sin territorio, y aporta histórico anterior a hoy?

---

## 8. Límites de esta evaluación

- **Ningún proveedor fue probado contra Cuenca.** Ninguno se marca `OPERATIVO`.
- Los precios de Meltwater y Brandwatch vienen de **agregadores terceros**, no de los
  propios proveedores: son órdenes de magnitud, no presupuestos.
- No se leyeron los términos de servicio ni las licencias de uso comercial de ninguno de
  los cuatro. Para GDELT eso es condición previa a cualquier uso comercial.
- **Bright Data queda fuera** de esta evaluación: pertenece a Candidate/Social y tiene un
  bloqueo externo de cuenta.
- Ninguna cuenta fue creada, ninguna tarjeta introducida, ningún contrato aceptado.

## Fuentes

- [Try BigQuery using the sandbox — Google Cloud](https://docs.cloud.google.com/bigquery/docs/sandbox)
- [GDELT 2.0 Event Database — Google Cloud Marketplace](https://console.cloud.google.com/marketplace/product/the-gdelt-project/gdelt-2-events)
- [Google's BigQuery Provides Free Access to GDELT — SitePoint](https://www.sitepoint.com/googles-bigquery-provides-free-access-gdelt/)
- [Social Media API pricing — Data365](https://data365.co/pricing)
- [Social Media APIs for Developers — Data365](https://data365.co/)
- [Meltwater Software Pricing & Plans 2026 — Vendr](https://www.vendr.com/marketplace/meltwater)
- [Meltwater Pricing (2026) — Shadow](https://www.shadow.inc/resources/meltwater-pricing)
- [Brandwatch Software Pricing & Plans 2026 — Vendr](https://www.vendr.com/marketplace/brandwatch)
- [Brandwatch Pricing: How Much It Costs in 2026 — Archive](https://archive.com/blog/brandwatch-pricing)
