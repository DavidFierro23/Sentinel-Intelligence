# MEDIA-UX-CERT-01 — Certificación visual de Media Intelligence

**Fecha:** 2026-09-01
**Gate anterior:** MEDIA-UX-HOME-01 (`80aa56d`)
**Alcance:** certificar la experiencia real del módulo y corregir **solo** los
problemas UX/UI encontrados durante la inspección. Sin proveedores, sin ranking
compuesto, sin `MEDIA-SOURCE-UNIVERSE-01`.

**Requests externos: 0. Coste: 0,00 USD.**

---

## 1. Cómo se certificó, y qué no cubre

Este entorno **no tiene navegador automatizable**: no hay Playwright ni
Puppeteer instalados y no se expone ninguna herramienta de navegador. Decirlo
importa, porque cambia el valor de lo que sigue.

Lo que **sí** se hizo, y es real:

| Comprobación | Cómo |
|---|---|
| La app corre de verdad | Backend en `:3001` y Vite en `:5173`, ambos respondiendo 200 |
| Vite compila y sirve el módulo | `GET /src/media/MediaIntelligenceModule.jsx` → 200, JSX transformado |
| El backend responde el contrato completo | `GET /api/media/modulo` y `GET /api/media/:proyectoId/home` |
| **Las ocho secciones se renderizan** | `tests/media-home.check.jsx` renderiza los componentes REALES con la respuesta REAL de la API y examina el HTML |
| Analizar publicación sigue viva | `/pieza/plan` e `/pieza/historial` contra un backend recién arrancado |

Lo que **no** se hizo:

- No hay capturas de pantalla.
- No se comprobó color, espaciado, tipografía real ni responsive en un viewport.
- No se ejercitó ninguna interacción: el desplegable «¿Por qué?» se verifica por
  su **dato**, no por su clic.

Por eso este gate certifica **contenido y semántica de pantalla**, no
apariencia. La revisión de apariencia sigue siendo humana.

La verificación de render sigue la convención que el propio repositorio ya
tenía (`vite.ssr.config.js`, `vite.identity-ssr.config.js`), nacida de
`P-CAND-ASSET-TYPE-UI-FIX-01`: *que la función devuelva el dato no significa que
la pantalla lo pinte*.

```
curl .../api/media/<proyecto>/home?ventana=90d -o home.json
npx vite build --config vite.media-ssr.config.js
node dist-ssr-media/check.mjs ./home.json
```

**Resultado: 47 comprobaciones, 0 fallos**, en las ventanas `90d` y `hoy`.

### Ruta para la certificación visual humana

```
npm run dev:backend        # :3001
npm run dev:web            # :5173
→ Medios
→ Resumen · Ranking / presencia · Analizar publicación
```

---

## 2. Pantallas inspeccionadas

`resumen`, `medios`, `periodistas`, `creadores`, `historias`, `amplificación`,
`ranking / presencia`, `fuentes / evidencias` y `analizar publicación`.

---

## 3. Problemas encontrados

Ninguno **P0**: el módulo se entendía y se usaba. Todos los hallazgos fueron de
semántica engañosa (P1) o de jerarquía (P2).

### P1-1 · Un balanceador de AWS figuraba como medio, en el puesto #5

`mw-public-alb-prod-1982631391.us-east-1.elb.amazonaws.com` aparecía en el
ranking **entre El Universo y Expreso**. Es el servidor de origen desde el que
se sirvió una página, no una cabecera. En una presentación de campaña se lee
como un medio más.

Es el mismo error de categoría que `google.com`, que el gate anterior ya había
resuelto, pero la regla estaba atada al tipo del catálogo y este host no está en
ningún catálogo.

**Corregido.** `esHostDeInfraestructura()` reconoce sufijos que nunca son una
marca editorial (`.elb.amazonaws.com`, `.cloudfront.net`, `.akamaized.net`,
`.fastly.net`, `.azureedge.net`…). El host sale del ranking a la lista de
artefactos, **visible y con su motivo**, con clase propia `INFRAESTRUCTURA`
—distinta de `AGREGADOR`, porque no se arreglan igual—.

La lista es corta a propósito: un dominio propio raro se queda donde está.
Preferimos una fuente sin clasificar a una reclasificada por parecerlo, y hay un
test que lo fija.

### P1-2 · Identificadores técnicos donde debían ir nombres

La tabla Candidatos × Medios pintaba `paul-carrasco-carpio` tal cual. En una
pantalla de campaña eso parece que el sistema no sabe quién es.

**Corregido.** El nombre se resuelve del proyecto (`contenidoDeProyecto`), la
misma fuente que la ficha del candidato. **El id no se pierde**: viaja debajo,
porque es lo que permite auditar la arista. Si el proyecto no responde, se
muestra el id y la HOME sigue funcionando.

### P1-3 · Ids de unidad territorial en la tabla

La columna de cobertura mostraba `ec-azuay-cuenca`. `MEDIA-REAL-DEMO-01` ya
había fijado la regla contraria —«se muestra el NOMBRE del ámbito, nunca el id
técnico»— y esta tabla la incumplía.

**Corregido.** `unidadPorId()` → «Cuenca», «Azuay». El id sigue disponible en
`territorioId` para auditar.

### P1-4 · Estados crudos en pantalla

Se pintaban `COBERTURA_INSUFICIENTE`, `METODOLOGIA EN CONSTRUCCION`,
`FECHA_NO_NORMALIZADA`.

**Corregido.** El backend emite `etiqueta` junto a `estado`: «Cobertura
insuficiente», «Metodología en construcción», «Fecha no normalizada». Se traduce
**en un solo sitio** —el vocabulario— porque dos diccionarios divergen. El valor
técnico **no desaparece**: quien audita lo necesita, y hay un test que comprueba
que ambos viajan.

### P1-5 · El ranking no se llamaba como debía

Se titulaba «Presencia observada». Ahora **«PRESENCIA MEDIÁTICA OBSERVABLE ·
90 días»**, con el título decidido en el backend para que no haya dos nombres de
la misma lista, y con la **nota metodológica visible** debajo:

> Ranking basado en evidencia digital observable dentro de las fuentes y la
> ventana seleccionadas. No mide audiencia, alcance ni influencia, y el corpus
> no es el ecosistema mediático.

### P1-6 · La ventana se leía como «cero actividad»

Con `HOY` la pantalla mostraba `0` y nada más. El problema real no es que no
haya actividad: es que **26 piezas no se pueden situar en el tiempo**.

**Corregido.** Las dos cifras van pegadas y no se suman:

> `0 pieza(s) situada(s) en la ventana · 26 con fecha no normalizada`

La normalización **no** se resuelve aquí: es `MEDIA-TIME-NORMALIZATION-01`.

### P1-7 · Artefactos mezclados con medios en Candidatos × Medios

`google.com` figuraba como una de las «fuentes» de un candidato, con el mismo
peso visual que El Mercurio.

**Corregido.** Las dos listas se separan y se cuentan aparte: Paúl Carrasco pasa
de «7 fuentes» a **6 fuentes + 1 artefacto declarado**; Lloret de 6 a **4 + 2**.
La cifra baja, y es más verdadera.

### P2-1 · Una lista ordenada sin explicación

**Añadido «¿Por qué?»** por fila. No pide nada al backend: la justificación
viaja en la fila, construida **solo con hechos contables** del corpus —piezas,
ventana, aristas hacia candidatos, procedencia de la clase, correspondencia— y
con su límite declarado:

> Estas razones explican la POSICIÓN en el corpus observado. No explican
> audiencia, alcance ni importancia editorial, que este corpus no mide.

«Ver evidencia» queda **deshabilitado y declarado**, no inventado: la lista de
evidencias por fuente llega con `MEDIA-SOURCE-UNIVERSE-01`.

### P2-2 · La pantalla no dejaba ver hacia dónde crece

**Añadido, sin encender nada:** Top 10 / 20 / 50 visibles, con los tamaños que
el corpus no alcanza atenuados y el motivo en el tooltip; y las seis dimensiones
futuras —Presencia, Interacción, Amplificación, Conversación, Video, Momentum—
con **solo Presencia activa** y cada una declarando qué le falta.

---

## 4. Estado por sección

| Sección | Estado | Nota |
|---|---|---|
| Resumen | ✅ CERTIFICADO | 16 cifras, todas con estado; ventana con su par explícito |
| Ranking / presencia | ✅ CERTIFICADO | 9 fuentes + 2 artefactos separados; «¿Por qué?» por fila |
| Candidatos × Medios | 🟡 PARCIAL | nombres reales y artefactos separados; `piezas por candidato` sigue `NO_DISPONIBLE` por diseño |
| Amplificación | ✅ CERTIFICADO | 26 / 10 / 2 sin sumar; sin afirmar copia ni causalidad |
| Historias / temas | 🟡 PARCIAL | «Cobertura insuficiente» correcta: la amplificación no persiste titular |
| Medios | ✅ CERTIFICADO | + Universo de medios preparado |
| Periodistas | 🟡 PARCIAL | 1 firma; declarado como mínimo, no como total |
| Creadores | 🟡 PARCIAL | 0 con evidencia + 5 sin clasificar, mostrados aparte |
| Fuentes / evidencias | ✅ CERTIFICADO | trazabilidad y aislamiento del proyecto |
| Analizar publicación | ✅ FUNCIONA | intacta, como herramienta interna |

### Demos reales, verificadas por HTTP tras reiniciar el backend

| Demo | Resultado |
|---|---|
| Carrasco / La Voz del Tomebamba | 5 snapshots desde `knowledge_lake`, views **5.966** |
| Lloret / El Mercurio | 2 snapshots, métricas `null` con motivo: una web no publica contadores |

---

## 5. Preparación declarada

- **Universo de medios:** espacio y botón `+ Agregar medio · próximamente`,
  **deshabilitado**. No se pintó formulario: uno que no guarda es peor que
  ninguno, porque el analista escribe un medio y lo pierde.
- **Top 10/20/50 y dimensiones futuras:** visibles y atenuadas, cada una con su
  requisito.
- **Sentinel AI:** sin implementar. El backend declara 4 de 7 preguntas
  sostenibles; faltan los ejes `ventanaAnterior`, `incidencia` y `territorio`.

---

## 6. Pendientes que este gate NO resuelve

| Pendiente | Gate |
|---|---|
| 26 piezas sin fecha normalizada | `MEDIA-TIME-NORMALIZATION-01` |
| Padrón de medios, alta manual, deduplicación, verificación | `MEDIA-SOURCE-UNIVERSE-01` |
| Territorio por pieza: GEO-1 lo resuelve y la fila no lo guarda | pendiente |
| Piezas por candidato: la arista se deduplica por par | pendiente |
| Titular de las piezas de amplificación, que bloquea los temas | pendiente |
| Certificación visual con navegador y capturas | requiere navegador en el entorno |

---

## 7. Comprobaciones

| | |
|---|---|
| Render de pantalla | **47 / 47**, ventanas `90d` y `hoy` |
| Suites de Media | **39 / 39**, 0 fallos |
| Suite completa backend | **1.472** (1.331 + 141), 0 fallos |
| Build | limpio |
| Lint | 6 errores **preexistentes** (Dashboard.jsx ×5, KnowledgeGraph.jsx ×1); **0 en Media** |
| Requests externos | **0** — X, Meta, YouTube, SerpAPI, otros |
