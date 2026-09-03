# SENTINEL-UX-CONSOLIDATION-01 — Project Intelligence Workspace

**Fecha:** 2026-09-03
**Commit base:** `8ce7791` (MEDIA-CORPUS-INTEGRATION-01)

Reorganiza la experiencia alrededor del **proyecto activo**. No reconstruye
ningún motor: Candidate, Territorial y Media siguen siendo los mismos.

---

## 1. Arquitectura UX encontrada

| Pieza | Estado antes |
|---|---|
| `App.jsx` | 495 líneas; estado `modulo`, render por ramas `modulo === "…"` |
| `Sidebar.jsx` | 8 entradas, 2 declaradas `reservado` |
| `investigacion` | **Un solo nodo OSINT** montado una vez, mostrado/oculto para `investigaciones` y `knowledge_graph` |
| `Dashboard.jsx` | existe, no montado desde el menú |
| Proyecto activo | no existía como contexto; `?proyecto=` solo abría el módulo de proyectos |
| Ventana temporal | cada módulo la tenía por su cuenta |

**El hallazgo que ordenó el gate:** `knowledge_graph` nunca fue un motor. App ya
montaba el mismo componente para él y para `investigaciones`, y solo cambiaba
qué se veía. El menú sugería dos motores donde había uno.

---

## 2. Navegación — antes y después

| Antes | Después |
|---|---|
| War Room `[RESERVADO]` | — |
| Investigaciones | **Resumen** ← punto de entrada |
| Knowledge Graph | **Candidatos** |
| Candidatos | **Territorio** |
| Correlación Viva `[RESERVADO]` | **Medios** |
| Territorio | **Investigaciones** |
| Medios | **Sentinel AI** `[EN PREP.]` |
| Configuración | *(separada por una línea)* **Configuración** |

Seis destinos ordenados por la **pregunta** que responden. Ninguna entrada
primaria queda `RESERVADO`: todas llevan a algo.

---

## 3. Mapping de ids antiguos

`moduleRegistry.js` separa **etiqueta de navegación** de **id interno**. Ningún
id se renombró: `media_pieza` y `mapa` se conservan porque son la clave con la
que App monta el módulo y la que llevan los enlaces guardados. Renombrarlos
habría roto deep links por un motivo cosmético.

| Id antiguo | Destino | Por qué |
|---|---|---|
| `war_room` | `resumen` | Preguntaba «¿qué está pasando ahora?». Esa pregunta la responde Resumen, con datos reales |
| `knowledge_graph` | `investigaciones` + vista `relaciones` | El grafo vive donde se investiga a un actor |
| `correlacion` | `sentinel_ai` | Capacidad interna; su destino natural |
| desconocido | `resumen` | No se rompe: abre Resumen y lo dice |

`?modulo=war_room` sigue funcionando y muestra **una vez** el motivo de la
redirección. Un enlace que cambia de destino en silencio confunde más que uno
roto.

---

## 4. Proyecto activo

Contexto en `App.jsx`, persistido en `?proyecto=` (enlace reproducible) y en
`localStorage` (recargar no devuelve al punto de partida). Franja compacta de
56 px con proyecto, territorio declarado y ventana.

**Sin proyecto no se muestran métricas globales mezcladas.** El Lake contiene
datos de varios proyectos —dos de ellos de prueba— y sumarlos daría cifras que
no son de ninguna campaña. Se muestra «Selecciona un proyecto para comenzar»,
con la razón escrita.

Si hay **un solo** proyecto se abre; si hay varios se pide elegir en lugar de
adivinar.

La ventana solo aparece donde hay soporte temporal real —Resumen y Medios—:
ofrecer un control que la pantalla ignora es peor que no ofrecerlo.

---

## 5. Resumen

Nuevo punto de entrada. **No calcula ninguna métrica propia**: agrega lo que
cada módulo ya mide, con su estado.

| Bloque | Fuente | Estado |
|---|---|---|
| Cambios y señales | *no hay endpoint de series* | `HISTÓRICO INSUFICIENTE`, declarado |
| Candidatos | `GET /api/proyectos/:id` | 7 candidatos reales; Momentum declarado, no sustituido |
| Territorio | `GET /api/territorio/salud` | Resolución social `EN CALIBRACIÓN` |
| Medios | `GET /api/media/:id/home` | Cifras y ranking reales |
| Evidencias | del payload de Medios | Reconciliación y «lo que no sabemos» |

Ningún porcentaje de avance, ningún `+0 %`, ningún score compuesto. Hay test que
comprueba que **no aparece ningún `%`** en la pantalla.

El disclaimer electoral está visible en el bloque de Candidatos.

---

## 6–8. Candidate · Territorial · Media

**Preservados sin tocar sus motores.** `ProjectsModule`, `TerritorialModule` y
`MediaIntelligenceModule` se montan igual que antes.

⚠️ **`TerritorialWorkspace.jsx` tenía cambios sin commitear de T2 y no se
tocó.** Solo se mantiene montado.

Media conserva **las 53 invariantes de render**, verificadas verdes tras el
cambio. Su metodología no se alteró.

### Un bug real encontrado y corregido

`MediaIntelligenceModule` pedía `GET /api/projects/` y la ruta es
**`/api/proyectos/`**. Devolvía 404 desde MEDIA-UX-HOME-01: **el selector de
proyecto de Medios estaba vacío en el navegador**. No salió a la luz porque toda
la verificación de Media se hizo con llamadas directas al servicio o con
payloads inyectados en el render check.

Es exactamente la clase de fallo que solo aparece al abrir la aplicación, y es
la razón por la que este gate existe.

---

## 9. Investigaciones

Reencuadre, sin implementar Investigations Intelligence. Seis vistas:

- **Hallazgos** y **Mapa de relaciones** → reales, sobre el **mismo nodo OSINT**
  que ya se montaba. Cambiar de vista no vuelve a consultar nada.
- **Contraste / Lado B**, **Narrativas**, **Crisis**, **Expedientes** →
  `EN PREPARACIÓN`, declaradas. Sin pantallas vacías ni contenido simulado.

---

## 10. Sentinel AI

Destino real que declara que **no está conectado**. La caja de consulta está
`disabled` y no hay ninguna respuesta generada. Declara los cinco ejes que habría
que cruzar con su estado real, y las preguntas que tendrá que responder — que son
el contrato de diseño del workspace.

---

## 11–13. War Room · Knowledge Graph · Correlación Viva

| | Antes | Ahora |
|---|---|---|
| **War Room** | entrada primaria `[RESERVADO]` | fuera del menú; `war_room` → Resumen |
| **Knowledge Graph** | entrada primaria | vista dentro de Investigaciones |
| **Correlación Viva** | entrada primaria `[RESERVADO]` | fuera del menú; → Sentinel AI |

**Ninguna capacidad se borró.** El componente `Reservado` de App se retiró porque
quedó sin uso: los tres ids redirigen a donde vive su respuesta, así que ya no
hace falta una pantalla que diga «esto no existe».

---

## 14. Estados honestos

`workspace/estados.js` traduce en **un solo sitio** lo que antes cada línea
resolvía a su manera: Media traducía `COBERTURA_INSUFICIENTE`, Candidate mostraba
`REQUIERE_PROVEEDOR` crudo y Territorial usaba sus propios estados. El analista
veía tres idiomas en tres pantallas del mismo producto.

29 estados con frase y tono. El valor técnico viaja en el `title` para quien
audita. **El rojo no se usa para un dato que falta** — ámbar para «no lo
sabemos», verde para «medido», rojo solo para un conflicto que exige decisión
humana.

Hay test que comprueba que **ningún enum crudo** aparece en pantalla.

---

## 15. Project isolation

`tests/workspaceIsolation.test.mjs`, **5/5**. Verifica en los tres módulos
project-scoped que cambiar de proyecto cambia corpus, universo y ranking; que las
evidencias no cruzan; que sin `projectId` ninguno devuelve datos; y que escribir
en un proyecto no mueve el ranking del otro.

Sobre el Lake real, con los dos proyectos que existen: el piloto tiene corpus y
`ensayo-tipos` tiene 0 y **lo declara** en lugar de mostrar un cero como si fuera
una medición del ecosistema.

---

## 16. Comprobaciones

| | |
|---|---|
| Render del workspace | **60 / 60** (`vite.workspace-ux.config.js`) |
| Render de Media | **53 / 53**, intactas |
| Aislamiento de proyecto | **5 / 5** |
| Suites de Media | 40 · 28 · 32 · 31 · 25, **0 fallos** |
| Suite completa backend | **1.473**, 0 fallos |
| Build | limpio |
| Lint | 6 errores **preexistentes** (Dashboard.jsx ×5, KnowledgeGraph.jsx ×1); 0 nuevos |

Tres errores de lint que introduje se corrigieron en el gate: un helper exportado
junto a un componente (rompe fast refresh — regla que el propio `Sidebar` ya
declaraba), un `setState` sincrónico en un efecto, y dos imports muertos.

---

## 17. Ficheros de frontend

**Nuevos:** `workspace/moduleRegistry.js` · `workspace/estados.js` ·
`workspace/EstadoChip.jsx` · `workspace/ProjectHeader.jsx` ·
`workspace/ResumenModule.jsx` · `workspace/SentinelAIModule.jsx` ·
`workspace/InvestigacionesModule.jsx` · `workspace/SinProyecto.jsx` ·
`tests/workspace-ux.check.jsx` · `vite.workspace-ux.config.js`

**Modificados:** `App.jsx` · `components/Sidebar.jsx` ·
`media/MediaIntelligenceModule.jsx`

**No tocados:** `territorio/**` (T2 tiene trabajo sin commitear),
`components/ProjectsModule.jsx`, `components/OSINT.jsx`,
`components/KnowledgeGraph.jsx`, `components/Dashboard.jsx`.

---

## 18. URL de certificación

```
http://localhost:5174/?proyecto=alcaldia-cuenca-2027-piloto&modulo=resumen
```

`5173` también sirve el código nuevo y vale igual.

### ⚠️ Precondición: reiniciar el backend

El proceso de `:3001` (PID 8896) **arrancó el 31 de agosto a las 23:27**, tres
días antes del commit base, y Node corre sin watcher. Sirve código anterior a
los últimos cuatro gates de Media: devuelve **28 piezas** en lugar de 103 y **10
filas** de ranking en lugar de 6.

No se mató porque lo arrancó otra terminal. Para certificar con los datos
integrados:

```
# detener el proceso 8896 y volver a arrancar
npm run dev:backend
```

La reorganización de navegación **es visible sin reiniciar**; las cifras del
corpus integrado, no.

### Qué debe verse

1. Sidebar con **seis** destinos y Configuración aparte. Sin War Room, sin
   Knowledge Graph, sin Correlación Viva.
2. Franja de contexto con «Elecciones Alcaldía Cuenca 2027 · Cuenca · Azuay ·
   Ecuador» y las cinco ventanas.
3. **Resumen** como pantalla de entrada, con cinco bloques y estados honestos.
4. `?modulo=war_room` → abre Resumen y explica la redirección.
5. `?modulo=knowledge_graph` → Investigaciones, vista Mapa de relaciones.
6. **Medios** con el selector de proyecto **ya poblado** (el bug del 404).
7. **Sentinel AI** con la caja desactivada.

---

## 19. Gaps

1. **Backend de `:3001` obsoleto** — precondición de certificación, no código.
2. **Candidate y Territorial conservan su navegación interna.** Las estructuras
   secundarias que el gate describe (Candidato → Ranking/Redes/Contenido…,
   Territorio → Temas/Territorios/Tema×Territorio…) **no se implementaron**:
   habría exigido tocar `ProjectsModule` y `TerritorialWorkspace`, y el segundo
   tiene trabajo sin commitear de T2. Es el recorte consciente de este gate.
3. **«Cobertura de datos»** sigue con su nombre actual dentro de Candidate; la
   democión visual de «solidez del expediente» no se aplicó por lo mismo.
4. **Dashboard.jsx** sigue sin montarse desde el menú y con sus 5 errores de
   lint. No se tocó.
5. Las suites nuevas **no están en `npm test`**: `package.json` sigue mezclado.

---

## 20. UX_READINESS

**`READY_FOR_HUMAN_CERTIFICATION`**

Con la precondición del punto 18: reiniciar `:3001` para ver las cifras del
corpus integrado.
