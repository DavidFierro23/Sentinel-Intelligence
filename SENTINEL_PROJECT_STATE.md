# SENTINEL INTELLIGENCE
## Estado Maestro del Proyecto

**Estado:** DESARROLLO ACTIVO
**Documento:** FUENTE MAESTRA DE CONTINUIDAD

> **Regla:** Este documento describe el estado **comprobado** del sistema.
> No sustituir hechos por suposiciones.

| Campo | Valor comprobado |
|---|---|
| Fecha de actualización | 2026-08-24 |
| Rama | `dev` |
| Último commit | `b2dcdc5` — *feat(projects): project lifecycle management and UTF-8 diagnosis* (2026-08-24 00:16 −05) |
| Versión monorepo | `sentinel-intelligence-platform` 0.1.0 |
| Versión backend | `sentinel-backend` 1.0.0 |
| Versión frontend | `web` 0.0.0 (sin versionar) |
| Entorno | Windows 11 · Node 24 · npm workspaces (`apps/*`, `packages/*`) |
| Puerto backend | 3001 (`process.env.PORT`) |
| Puerto frontend | Vite 8.2 — 5173 por defecto |
| Repositorio | `github.com/DavidFierro23/Sentinel-Intelligence` (privado) |

**Estado de trabajo en curso al generar este documento** (`git status`):

```
 M apps/backend/server.js               ← sesión territorial (LÍNEA B)
?? SENTINEL_PROJECT_STATE.md            ← este documento
?? apps/backend/an.json                 ← sesión territorial (salida de ejemplo)
?? apps/backend/an2.json                ← sesión territorial
?? apps/backend/an3.json                ← sesión territorial
?? apps/backend/srv.log                 ← sesión territorial
?? apps/backend/routes/territorio.js    ← sesión territorial
?? apps/backend/services/conversation/  ← sesión territorial
?? apps/backend/services/geo/           ← sesión territorial
```

La LÍNEA B estaba trabajando **durante** la generación de este documento: los
archivos `an2.json`, `an3.json` y `srv.log` aparecieron mientras se inspeccionaba
el repositorio.

Estos cambios **no** son de esta tarea y **no se han revertido ni comiteado**. Ver §29.

---

## 1. Visión del sistema

Sentinel Intelligence es un **Centro de Inteligencia Digital** basado en fuentes
abiertas. Su propósito es construir expedientes de inteligencia sobre personas y
organizaciones públicas a partir de evidencia verificable, declarando siempre lo
que no sabe.

### Capacidades y estado real

| Capacidad | Estado | Comprobación |
|---|---|---|
| Investigación OSINT individual | ✅ OPERATIVO | `GET /api/osint/google/:objetivo` |
| Descubrimiento de identidad digital | ✅ OPERATIVO | Discovery Engine + 4 vías |
| Cuentas sociales (6 plataformas) | ✅ OPERATIVO | `PlatformGrid`, cobertura obligatoria |
| Separación medios / instituciones | ✅ OPERATIVO | `accountClassifier.js` |
| Evidencias y trazabilidad | ✅ OPERATIVO | linaje en cada ficha |
| Identidades plausibles (homónimos) | ✅ OPERATIVO | `plausibleIdentities.js` |
| Knowledge Graph | 🟡 PARCIAL | nodos y clases sí; relaciones entre nodos no |
| Proyectos electorales | ✅ OPERATIVO | `routes/projects.js` + persistencia |
| Candidatos y expedientes | ✅ OPERATIVO | verificado tras reinicio de backend |
| Actores de referencia | ✅ OPERATIVO | opcional, `incluirEnComparativo` = false |
| Correlación observable actor↔candidato | 🟡 PARCIAL | motor sí; UI de resultados no |
| Índice de Cobertura | ✅ OPERATIVO | `CoverageIndexPanel.jsx` |
| Comparación entre candidatos | 🟡 PARCIAL | cobertura y cuentas; sin evolución histórica |
| Análisis territorial | 🟡 DESARROLLO PARALELO | ver §14 |
| Conversación digital | 🟡 DESARROLLO PARALELO | ver §14 |
| Inteligencia accionable | 🔴 PENDIENTE | no existe capa de recomendación |
| War Room | 🔒 RESERVADO | diseño congelado UX-WR-001 v2.0 |
| Mapa Territorial (UI) | 🔒 RESERVADO | entrada de menú declarada `reservado` |
| Correlación Viva (UI) | 🔒 RESERVADO | entrada de menú declarada `reservado` |
| Sentinel Decision Intelligence | 🔒 RESERVADO | `docs/architecture/Sentinel-Decision-Intelligence.md` |

---

## 2. Arquitectura actual

Diagrama **corregido según el código**: la clasificación ocurre *después* de
identidad/evidencia, no antes, y el Knowledge Lake recibe expedientes de proyecto
pero **no** las evidencias de cada investigación.

```
FUENTES                    SerpAPI · DuckDuckGo · Google News
                           Wikidata · Wikipedia · Wayback · Whois
   ↓
SEARCH PROVIDER LAYER      failover, presupuesto e intervalo por proveedor
   ↓
DISCOVERY ENGINE           4 vías: handle observado · evidencia fusión ·
                           consulta dirigida · plataforma declarada (Wikidata)
   ↓
IDENTITY MATCHER           S1 S2 S6 S7 S8 + CB-1 + topes de concurrencia
   ↓
SOCIAL EVIDENCE ENGINE     ficha única, dedup, URL canónica, linaje, hash
   ↓
CLASIFICACIÓN              cuenta_personal · medio · institución · pendiente
   ↓
PERFIL EJECUTIVO           huella digital, tarjetas, colecciones separadas
   ↓
KNOWLEDGE LAKE             proyectos, candidatos, actores, expedientes
   ↓                       (append-only, aislado por projectId)
INTERFAZ                   apps/web
```

| Capa | Ubicación |
|---|---|
| Frontend | `apps/web` — React 19 + Vite 8.2, sin router externo |
| Backend | `apps/backend` — Express, ESM |
| Persistencia | Knowledge Lake, adaptador de fichero (§7) |
| Motores | `apps/backend/services/**` (§8) |
| Proveedores externos | `apps/backend/services/providers/` |
| Rutas API | `apps/backend/routes/` (§6) |

---

## 3. Frontend — `apps/web`

18 componentes en `src/components/`, 3 servicios en `src/services/`, tema único
en `src/styles/theme.css`.

### Menú definitivo (`Sidebar.jsx`, estado declarado en el propio código)

| Entrada | Estado en código | Módulo real |
|---|---|---|
| War Room | `reservado` | pantalla declarativa |
| Investigaciones | `operativo` | `OSINT.jsx` |
| Knowledge Graph | `operativo` | vista de `OSINT.jsx` |
| Candidatos | `operativo` | `ProjectsModule.jsx` |
| Correlación Viva | `reservado` | pantalla declarativa |
| Mapa Territorial | `reservado` | pantalla declarativa |
| Configuración | `operativo` | salud + módulos técnicos |

### Módulos

**Investigaciones** — ✅ OPERATIVO
Archivo: `OSINT.jsx`. Depende de `PlausibleIdentitiesPanel`, `CoverageIndexPanel`,
`ExecutiveDashboard`, `ExecutiveProfilePanel`, `PlatformGrid`,
`EvidenceConfidencePanel`, `SocialAccountsPanel`, `KnowledgeGraph`,
`ReferenceProfilePanel`, `LoadingInvestigation`.
Funciona: investigación completa, deep link `?q=`, orden del informe, panel de
identidades plausibles.
Falta: seleccionar una identidad plausible y reinvestigar solo con su evidencia
(botón presente, acción no conectada).

**Proyectos / Candidatos** — ✅ OPERATIVO
Archivo: `ProjectsModule.jsx`. Lista persistente, creación, candidatos con cuenta
de referencia, actores opcionales, ciclo de vida (§21), deep link `?proyecto=`.
Falta: vista de expediente completo del candidato dentro del proyecto; hoy se
muestra un resumen (`+N cuentas · +N medios · +N evidencias web`).

**Knowledge Graph** — 🟡 PARCIAL
Archivo: `KnowledgeGraph.jsx`. Ver §13.

**Dashboard Ejecutivo** — ✅ OPERATIVO
Archivo: `ExecutiveDashboard.jsx`. Cuenta principal, huella, evidencias,
plataformas, narrativa dominante, riesgos de la investigación, alias, evidencia
de la fotografía.

**Índice de Cobertura** — ✅ OPERATIVO
Archivo: `CoverageIndexPanel.jsx`. Ver §12.

**Confianza por evidencia** — ✅ OPERATIVO
Archivo: `EvidenceConfidencePanel.jsx`. Barras expandibles por subsistema.

**Correlación Viva / Mapa Territorial / War Room** — 🔒 RESERVADO
Pantallas declarativas en `App.jsx` que explican qué son y qué falta.

**Configuración** — ✅ OPERATIVO
Salud del backend cada 30 s + `AIRouter` y `Dashboard` como módulos técnicos.

### Servicios frontend

| Archivo | Función |
|---|---|
| `aliasMemory.js` | alias por objetivo en `localStorage`; **no** alimenta el planificador del backend |
| `avatarService.js` | ⚠️ PENDIENTE DE VERIFICACIÓN — no revisado en esta tarea |
| `sentinelBridge.js` | ⚠️ PENDIENTE DE VERIFICACIÓN — no revisado en esta tarea |

---

## 4. Backend — `apps/backend`

`server.js` monta CORS abierto, `express.json()`, salud y cuatro routers.

### Servicios (nivel 1 de `services/`)

```
assets/            avatar/          conversation/*     geo/*
identity/          knowledgeLake/   projects/          providers/
social/            + servicios sueltos: fusionSearchEngine, googleService,
                     googleNewsService, searchProviderLayer, referenceProfileService,
                     identityCorrelationService, identityService, socialDiscoveryService,
                     textUtils, waybackService, whoisService, avatarService, osintEngine
```
`*` = LÍNEA B, sin integrar (§14).

---

## 5. Endpoints REALES

Enumerados desde los archivos de ruta. No se documenta nada que no exista.

### Salud
| Método | Ruta |
|---|---|
| GET | `/health` |
| GET | `/api/health` |

### OSINT — `routes/osint.js`
| Método | Ruta |
|---|---|
| POST | `/api/osint/google` |
| GET | `/api/osint/google/:objetivo` |
| GET | `/api/osint/health` |

### Assets — `routes/assets.js`
| Método | Ruta |
|---|---|
| GET | `/api/assets/estado` |
| GET | `/api/assets/:assetId/ficha` |
| GET | `/api/assets/:assetId` |

### Proyectos — `routes/projects.js`
| Método | Ruta |
|---|---|
| GET | `/api/proyectos/catalogo` |
| GET | `/api/proyectos` |
| POST | `/api/proyectos` |
| GET | `/api/proyectos/:proyectoId` |
| POST | `/api/proyectos/:proyectoId/renombrar` |
| POST | `/api/proyectos/:proyectoId/estado` |
| POST | `/api/proyectos/:proyectoId/candidatos` |
| POST | `/api/proyectos/:proyectoId/candidatos/:candidatoId/investigar` |
| POST | `/api/proyectos/:proyectoId/actores` |
| POST | `/api/proyectos/:proyectoId/actores/:actorId/comparativo` |
| POST | `/api/proyectos/:proyectoId/actores/:actorId/investigar` |
| POST | `/api/proyectos/:proyectoId/correlacion/:actorId/:candidatoId` |

### Territorial — `routes/territorio.js` — ✅ LÍNEA B, núcleo verificado
| Método | Ruta |
|---|---|
| GET | `/api/territorio/catalogo` |
| GET | `/api/territorio/salud` |
| POST | `/api/territorio/recargar` |
| POST | `/api/territorio/resolver` |
| POST | `/api/territorio/analisis` |
| POST | `/api/territorio/conversacion` |

---

## 6. Knowledge Lake

| Aspecto | Estado comprobado |
|---|---|
| Adaptador por defecto | **`fichero`** (`crearAdaptador`: `tipo \|\| SENTINEL_LAKE_ADAPTER \|\| "fichero"`) |
| Alternativas | `memoria`, `minio` (declarado) |
| Ubicación real | `apps/backend/data/knowledge-lake/AAAA/MM/DD.jsonl` |
| Contenido actual | `2026/08/21.jsonl`, `23.jsonl`, `24.jsonl` — 96 KB |
| Modelo | **append-only**; cada cambio es una versión nueva con `hashAnterior` |
| Aislamiento | clave compuesta `tenantId::proyectoId::tipoEntidad::entidad` |
| Escritura | `escribirEnLake` → validación DT1/DT3 obligatoria (tenantId, proyectoId, fuente, linaje.submotor) |
| Lectura | `obtenerVersionEntidad`, `obtenerHistorialEntidad`, `obtenerEventosProyecto` |
| Persistencia tras reinicio | ✅ **verificada**: 4 proyectos recuperados de disco tras reiniciar el backend |
| Compatibilidad de nombres | `contenidoDeProyecto` lee `expediente-<tipo>-<id>` **y** el heredado `expediente-<id>` |
| En git | **no**: `.gitignore` línea 12 excluye `apps/backend/data/` |

### Qué se conserva

Proyectos (catálogo `catalogo-proyectos`), candidatos (`candidato-<id>`), actores
(`actor-<id>`), expedientes (`expediente-<tipo>-<id>`) con cuentas, medios,
instituciones, recuentos de evidencia y huella digital.

**No se conserva** en el Lake: las evidencias individuales de cada investigación
ni el grafo. Se recalculan al investigar.

---

## 7. Motores de investigación

| Motor | Archivo | Estado | Congelado |
|---|---|---|---|
| OSINT Engine | `services/osintEngine.js` | ✅ | Sí |
| Discovery Engine | `services/social/discovery/discoveryEngine.js` | ✅ | Sí |
| Platform Adapters | `services/social/discovery/platformAdapters.js` | ✅ | Sí |
| Social URL Classifier (SD-1A) | `services/social/discovery/socialUrlClassifier.js` | ✅ | Sí |
| Context Boost (CB-1) | `services/social/identity/contextBoost.js` | ✅ | Sí |
| Identity Matcher | `services/social/identity/identityMatcher.js` | ✅ | Sí |
| Confidence contracts | `services/social/socialContracts.js` | ✅ | Sí |
| Social Evidence Engine | `services/social/evidence/socialEvidenceEngine.js` | ✅ | Sí |
| Account Classifier | `services/social/classification/accountClassifier.js` | ✅ | Sí |
| Platform Scanner (Wikidata) | `services/social/platforms/platformScanner.js` | ✅ | No |
| Avatar Intelligence | `services/avatar/avatarIntelligenceEngine.js` | ✅ | No |
| Asset Gateway | `services/assets/assetGateway.js` | ✅ | No |
| Search Provider Layer | `services/searchProviderLayer.js` | ✅ | No |
| Fusion Search Engine | `services/fusionSearchEngine.js` | ✅ | No |
| Plausible Identities | `services/identity/plausibleIdentities.js` | ✅ | No |
| Project Context | `services/projects/projectContext.js` | ✅ | No |
| Project Store | `services/projects/projectStore.js` | ✅ | No |
| Actor Correlation | `services/projects/actorCorrelation.js` | ✅ | No |
| SerpAPI Provider | `services/providers/serpapiProvider.js` | ✅ | Sí |
| Brave Provider | `services/providers/braveProvider.js` | 🟡 sin credencial | No |
| DuckDuckGo Provider | `services/providers/duckProvider.js` | ✅ último recurso | No |

### Detalle de los principales

**Discovery Engine** — 4 vías: `handle_observado`, `evidencia_fusion`,
`consulta_dirigida`, `plataforma_declarada`.
Entradas: perfil de referencia + opciones. Salidas: candidatos, cobertura por
plataforma, trazas, descartados con motivo.
Advertencia: la vía `plataforma_declarada` (Wikidata) no consume cuota de
buscador y se ejecuta antes de las consultas dirigidas.

**Identity Matcher** — señales S1 nombre, S2 usuario, S6 enlaces oficiales,
S7 presencia cruzada, S8 declaración de referencia. S3/S4/S5 declaradas
**no implementadas** (exigen leer el perfil en la plataforma).
Topes por concurrencia: 1→45, 2→70, 3→88, 4→97, 5→97. **Tope absoluto 97**,
exigido por `validarCorrespondencia`: el sistema nunca emite 100.

**SD-1A** — clasifica la ruta de una URL en perfil, canal, página, vídeo, post o
no-cuenta. Aplica los patrones a la ruta con su capitalización original y
excluye la cadena de consulta.

**CB-1** — ajuste por contexto tras el tope de concurrencia. Veto a 29 cuando el
contexto es incompatible.

**Avatar Intelligence** — cascada de 4 niveles: Wikipedia → perfil oficial
(declarado inaccesible) → Wikidata P18 → avatar generado local. 4 puertas de
verificación de nombre. **Nunca descarga imágenes privadas.**

---

## 8. Proyectos electorales

```
PROYECTO  (catálogo · id estable · territorio · dignidad · tipo · fecha · estado)
   ↓
CANDIDATOS  (rol declarado por el analista · cuentas de referencia)
   ↓
EXPEDIENTES  (cuentas · medios · instituciones · recuentos · huella)

aparte, y sin afectar a los candidatos:
ACTORES DE REFERENCIA  (opcional · nivel · incluirEnComparativo = false)
```

| Campo | Comprobado |
|---|---|
| `projectId` | derivado del nombre, **estable**; renombrar no lo cambia |
| territorio | `pais`, `provincia`, `canton` |
| dignidad | del proyecto, o propia del candidato/actor |
| tipo de elección | `tipoEleccion` |
| fecha | opcional |
| cuenta de referencia | `tipo: cuenta_referencia`, `origen: analista`, `estado: proporcionada_por_analista`, `verificadaPorSentinel: false` |
| persistencia | ✅ verificada tras Ctrl+R y tras reinicio de backend |
| recuperación | `GET /api/proyectos` y `GET /api/proyectos/:id` |
| expediente vivo | segunda investigación **actualiza**, no duplica; devuelve diferencial |

Regla: **el rol electoral lo declara el analista**. `rolOrigen: "analista"`.
Sentinel no inventa candidaturas.

---

## 9. Contexto por nivel del actor

Implementado en `services/projects/projectContext.js`. Verificado en código.

| Nivel | Ancla territorial | Fuerza |
|---|---|---|
| `cantonal` | cantón | 24 |
| `provincial` | provincia | 24 |
| `nacional` | país | 24 |
| `internacional` | ninguna | — |

Además: dignidad con fuerza 22. El **resto** del territorio del proyecto se
declara con fuerza 6.

### Criterio que evita limitar a un actor nacional

`extraerAnclas` ordena por fuerza descendente y el planificador toma **dos**
anclas. Un término derivado de evidencia no supera 10. Por tanto:

- solo el ancla del **nivel del actor** y la dignidad pueden ocupar esas dos
  plazas;
- el resto del territorio queda por debajo de 10, informa pero no acota.

Comprobado: candidato cantonal → `Cuenca + alcaldía`; actor nacional en el mismo
proyecto → `Ecuador + presidencia`. El cantón no entra.

El contexto declara además `ambitoDelPerfil`, `territorioDelProyecto` y
`requiereDosNiveles` para separar perfil nacional de presencia territorial.

**Dos anclas, no tres**: medido — con tres, `site:x.com "Pedro Palacios" Cuenca
alcaldia Azuay` no devolvía ninguna cuenta que sí existía.

---

## 10. Identidad y homónimos

| Elemento | Estado | Archivo |
|---|---|---|
| Identidades plausibles | ✅ | `services/identity/plausibleIdentities.js` |
| Separación territorial | ✅ | semilla por país del TLD del dominio |
| Cuentas atribuidas | ✅ | clase `cuenta_personal` |
| Cuentas institucionales | ✅ | clase `institucion` |
| Medios | ✅ | clase `medio` |
| Homónimos | ✅ | apellido obligatorio + CB-1 |
| Nivel de confianza | ✅ | correspondencia 0–97 con desglose |

**Algoritmo de identidades plausibles:** semillas por país declarado en el TLD
del dominio (`.ec` vs `.es`, evidencia dura), y atracción de las evidencias
neutras solo si la similitud es clara. Lo ambiguo se declara sin asignar.

**Regla absoluta:** *Sentinel NO confirma automáticamente identidades.* El techo
del sistema es `probable`; `confirmado` y `descartado` solo puede asignarlos un
analista (`esEstadoAutomatico` lo hace cumplir).

---

## 11. Índice de Cobertura

✅ OPERATIVO — `apps/web/src/components/CoverageIndexPanel.jsx`.
Se calcula **en la interfaz** sobre lo que devuelve el motor.

| Dimensión | Peso |
|---|---|
| Redes verificadas | 30 |
| Foto oficial | 15 |
| Medios relacionados | 15 |
| Narrativas detectadas | 15 |
| Grafo construido | 15 |
| Alias | 10 |

Escala: 90–100 verde · 70–89 azul · 50–69 amarillo · 30–49 naranja · 0–29 rojo.

> **Cobertura ≠ popularidad · Cobertura ≠ intención de voto · Cobertura ≠ apoyo electoral**

Cobertura representa el nivel de **completitud del expediente** según las
dimensiones implementadas. Tooltip obligatorio presente en el componente.

Es distinta de la **Huella Digital**, que la calcula el backend y mide la
presencia pública del objetivo (cobertura de plataformas 40, solidez 30,
corroboración 20, declaración 10).

---

## 12. Knowledge Graph

🟡 PARCIAL — `KnowledgeGraph.jsx`

| Elemento | Estado |
|---|---|
| Nodo central (objetivo) | ✅ |
| Un nodo por cuenta | ✅ |
| Nodos de dominio | ✅ |
| Clases y colores oficiales | ✅ cuenta oficial, institución, medio, pendiente |
| Aliado / Oposición | 🔴 en la leyenda, **sin datos**: el Core no las clasifica |
| Leyenda permanente | ✅ |
| Filtros de vista | ✅ ejecutiva (por defecto), ecosistema, medios, instituciones |
| Hover con evidencia | ✅ plataforma, clase, confianza, proveedor, modo de acceso |
| **Relaciones entre nodos** | 🔴 **no existen**: todos los enlaces van del objetivo a cada nodo |
| Temas como nodos | 🔴 pendiente |
| Grafo del actor de referencia | 🔴 pendiente |

Limitación principal: el grafo es **radial**, no relacional. No hay aristas
candidato↔medio ni cuenta↔cuenta.

Bug conocido: `KnowledgeGraph.jsx:95` — `setState` dentro de un efecto
(preexistente, ver §22).

---

## 13. Inteligencia Territorial — LÍNEA B

✅ **NÚCLEO IMPLEMENTADO Y VERIFICADO EN EJECUCIÓN REAL** — 2026-08-24
Documento de arquitectura: `docs/architecture/Inteligencia-Territorial-y-Conversacion-Publica.md` (ARQ-GEO-001).

Implementa la especificación **ya congelada** en UX-WR-001 §1, §6 y §12, con los
nombres de archivo que ese documento fijó en §10.2. No inventa arquitectura.

### Qué está implementado y probado

| Componente | Estado |
|---|---|
| Territory Registry (jerarquías arbitrarias) | ✅ 40 unidades · **sin geometría** |
| Geo Resolver (4 procedencias) | ✅ verificado con 9 casos de desambiguación |
| Spatial Aggregator (GEO-1) | ✅ nunca desagrega: por construcción, no por comprobación |
| Normalizer | ✅ implementado y **bloqueado**: sin denominador no calcula |
| Territorial Timeline | ✅ series por unidad + barra de observación |
| Anomaly Detector | ✅ mediana + MAD (robusto a valores extremos) |
| Public Conversation Engine | ✅ recolección · temas · encuadre · medios · actores · serie |
| Trazabilidad de motores | ✅ incluye los **no ejecutados** y por qué |
| Attribution Engine | ⛔ UX-3 — requiere histórico para calibrar |
| Replay Reconstructor | ⛔ UX-3 |

### Search Layer — sin duplicar proveedores

Territorial consume los **mismos** proveedores que candidatos vía
`searchProviderLayer.buscarWeb()`: mismo presupuesto, mismo circuito de salud,
mismo *fallback*, mismo saldo de SerpAPI.

Exclusivo de territorial: el **planner** (ancla por provincia y país), el **Geo
Resolver**, el **Media Registry** y el extractor de temas. No se reutiliza el
Identity Matcher para geografía.

### Estados de motor — cuatro cosas distintas

`OK` · `SIN_RESULTADOS` · `NO_EJECUTADO` · `SIN_CREDENCIAL` · `ERROR` ·
`TIMEOUT` · `BLOQUEADO` · `NO_IMPLEMENTADO`.

Solo los dos primeros permiten afirmar ausencia. Los demás son huecos de
cobertura y viajan al bloque «Lo que no sabemos».

### Ejecución real verificada (Cuenca, modo `noticias`, coste 0)

```
29 evidencias · 16 publicadores · 29/29 ubicadas · 0 sin ubicar
Cuenca 28 (con dato) · Machángara 1 (muestra insuficiente)
GEO-1: 28 atribuciones a parroquia impedidas → agregadas en cantón
1 medio local · 7 nacionales · 4,93 s
```

Modo `web` verificado aparte con **1** búsqueda de cuota: SerpAPI `OK`,
9 resultados, correctamente declarado.

### Defectos encontrados y corregidos en esta línea

1. **`Cuenca` sin anclaje devolvía Cuenca de España** (feria de San Julián, la
   A-3). El `gl=EC` no basta. Toda consulta lleva ahora ancla territorial.
2. **Ambigüedad interna ≠ externa.** Un diario local desambigua «Baños» pero no
   «avenida Sucre» ni «río Machángara».
3. **Google News ocultaba al publicador** (todo `news.google.com`). Se rescata
   del titular: 1 → 16 publicadores.
4. **Nombre del territorio y del medio se volvían «temas».**
5. **`buscarGoogleNews` sin timeout** colgaba la petición HTTP más de 2 min.
   Acotado a 12 s por consulta y 45 s totales, sin tocar el servicio compartido.
6. **Nombres sin tildes** en la UI (`Machangara`, `Banos`). Corregidos; la
   coincidencia sigue siendo insensible a tildes.

---

## 13-bis. Datos oficiales integrados — GATE A (2026-08-24)

✅ **Fuentes oficiales auditadas, descargadas, validadas e integradas.**
Procedencia completa en `services/geo/territories/fuentes-oficiales.json`.

| Fuente | Institución | Estado | Licencia |
|---|---|---|---|
| **Geometría** | CONALI — Ministerio de Gobierno | ✅ **INTEGRADA** | CC BY |
| **Población** | GAD Cuenca (censo INEC 2022) | ⚠️ **INTEGRADA CON RESTRICCIÓN** | **CC NonCommercial** |
| **Padrón** | CNE | ⛔ **ACCESO OFICIAL BLOQUEADO** (HTTP 403) | — |

### Geometría — 22 de 41 unidades

Dataset `Organización Territorial Parroquial`, 131 MB, SHP en **EPSG:32717**.
Reproyectado a EPSG:4326 con Transverse Mercator inversa **validada**:
`(714383, 9679807)` UTM → `(-79.0713, -2.8952)`, dentro de Cuenca.
Simplificación Douglas-Peucker 30 m: **388 028 → 5 586 puntos**, error de área medio **0,054 %**.
Las superficies se calculan sobre la geometría **completa**, no la simplificada.

**21 parroquias rurales + 1 cabecera cantonal.** Las 15 urbanas **no tienen geometría**: la DPA nacional no las desagrega.

### Códigos DPA oficiales

Cada unidad rural lleva su `codigoOficial` (`010151`–`010171`), el cantón `0101` y la provincia `01`. **Resuelve el bloqueo para unir con INEC y CNE.**

### Unidad reconocida ≠ geometría disponible

Las 15 urbanas quedan **`verificado: true`** (respaldo: [GAD Cuenca](https://www.cuenca.gob.ec/page_divisionpolitica), ordenanza de 1982) con **`geometriaDisponible: false`**. Existen oficialmente; lo que falta es el polígono.

### Población — censo 2022, no proyección

596 101 habitantes en 22 unidades. **`tipoDato: "CENSO"`, `anio: 2022`.**
No hay proyecciones parroquiales: el INEC solo llega a cantón.
La población cantonal **no se repartió** entre parroquias (comprobado en tests).

### Dos bloqueos nuevos, declarados

1. **Conflicto de nivel.** Los denominadores son de dos niveles (`parroquia` y `bloque_urbano_agregado`). El normalizador **bloquea la mezcla** y solo habilita dentro de un mismo nivel.
2. **Licencia CC-NC.** El denominador poblacional **prohíbe uso comercial**. Sentinel es SaaS propietario. Decisión pendiente del analista.

### Validación cruzada independiente

Las áreas calculadas desde la geometría CONALI **coinciden con las publicadas por el GAD** — diferencia máxima 0,44 km², atribuible al redondeo del CSV.

---

## 13-ter. Gazetteer territorial — GATE B (2026-08-25)

✅ **Implementado sobre la arquitectura existente**, sin registro paralelo.

Nuevo nivel bajo parroquia: `toponimo` (barrio · sector · vía · hito).
Fichero `territories/toponimos-cuenca.json` — **9 entradas, ninguna verificada**.

### La separación que sostiene el gate

`geoContracts.autorizaAtribucion()` introduce un límite **distinto de GEO-1**:

| Límite | Pregunta que responde |
|---|---|
| **GEO-1** | ¿hasta dónde llega el **dato**? |
| **autorizaAtribucion** | ¿hasta dónde llega la **unidad**? |

Un topónimo con `resolucionMaximaAutorizada: null` **no ubica nada**. Registra la mención y punto.

Sin esta separación, un gazetteer de barrios sería una máquina de fabricar precisión: cada barrio reconocido produciría un punto en el mapa sostenido únicamente por que alguien escribió su nombre en un JSON.

### Comportamiento verificado

| Texto | Resultado |
|---|---|
| «Comerciantes de **El Vado** piden seguridad» | ⛔ no ubica · mención registrada |
| «Comerciantes de El Vado, **en Cuenca**» | ✅ cantón *(por «Cuenca», no por El Vado)* · mención registrada |
| «Congestión en la **Avenida de las Américas**» | ⛔ no ubica ni con fuente local — una vía atraviesa varias unidades |
| «Obras en **Sayausí**» | ✅ parroquia rural · con geometría |
| «Feria en **Totoracocha**» | ✅ parroquia urbana · **sin** geometría (atribución nominal válida) |
| «El Vado **y** Las Herrerías, en Cuenca» | ✅ cantón · **2** menciones no certificadas |

**Ninguna relación barrio→parroquia inferida.** Todos con `padre: null`, `padreFuente: "pendiente"`. Ninguna coordenada inventada.

---

## 13-quater. Topic Engine 2 — GATE C (2026-08-25)

✅ **Tres niveles y cuatro filtros.** `services/conversation/topicEngine2.js`.

### Antes → Después, mismo corpus

```
ANTES                                    DESPUÉS
Movilidad y transporte              →    CATEGORÍA Movilidad y transporte
                                            TEMA    congestión y tráfico
                                            SUBTEMA Avenida de las Américas
                                            emergente · 3 ev · 3 fuentes · serie 3

Proceso electoral                   →    CATEGORÍA Proceso electoral
                                            TEMA    candidaturas
                                            SUBTEMA Alcaldía de Cuenca

azuay · wikipedia · ciudad · capital →    ELIMINADO (referencia + promocional)
clima · pronóstico · tiempo · agosto →    ELIMINADO (automatizado + casi-duplicado)
```

### Los cuatro filtros, cada uno contra un defecto medido

| # | Filtro | Fichero | Defecto que mata |
|---|---|---|---|
| 1 | **Tipo de contenido** | `contentTypeClassifier.js` | Wikipedia, turismo y bancos de imágenes formaban `azuay · capital · provincia · ciudad` |
| 2 | **Casi-duplicados** | `nearDuplicate.js` | 3 boletines diarios del clima contaban como 3 evidencias |
| 3 | **Stop-concepts** | `stopConcepts.js` | territorio, **ancestros**, meses, publicador, términos de la query |
| 4 | **Residuo puro** | `stopConcepts.js` | etiqueta hecha solo de stop-concepts |

**Nada se borra.** El contenido excluido se conserva, se cuenta y se declara.

### Expediente de cada tema

`nombre` · `categoría` · `subtemas` · `estado` · `evidencias` · `volumenObservado` · `repeticionesIncluidas` · `primeraObservación` · `últimaObservación` · `serie` · `fuentes` · `fuentesDistintas` · `territorios` · `encuadre` · `términos` · `metodoClasificacion` · `explicación` · `confianza` · `limitaciones` · `índices` (→ evidencias)

**Estados:** `consolidado` (≥5 evidencias **y** ≥2 fuentes) · `emergente` (≥3 y ≥2) · `evidencia_insuficiente`.

Un tema sostenido por **una sola fuente** lo declara como limitación: es un medio insistiendo, no cobertura.

### Tres frases que viajan en cada respuesta

> El volumen mide **publicación**, no opinión ciudadana.
> Las publicaciones **no son personas**.
> Un tema que crece **no indica apoyo político**.

### Lo que NO se hizo

Tendencias comparando ventanas: **no implementado**. Exige recolectar la ventana anterior, y Google News ofrece una ventana móvil de semanas, no un archivo. Sin eso, «en crecimiento» sería una afirmación sin baseline.

---

## 14. Pendientes críticos territoriales

🔴 **CRÍTICO** — sin esto el módulo es funcional pero incompleto:

| # | Pendiente | Bloquea | Estado |
|---|---|---|---|
| 1 | ~~GeoJSON de parroquias rurales~~ | — | ✅ **RESUELTO** (CONALI) |
| 2 | **Geometría de las 15 parroquias urbanas** | mapa completo, coropleta urbana | 🔴 no publicada por el GAD |
| 3 | ~~Población parroquial~~ | — | ✅ **RESUELTO** con restricción de licencia |
| 4 | **Licencia comercial del denominador poblacional** | uso comercial de métricas normalizadas | 🔴 CC-NC; requiere permiso del GAD o fuente INEC |
| 5 | **Padrón electoral CNE** | normalización por elector | 🔴 HTTP 403, requiere gestión manual |
| 6 | **Polígono del Centro Histórico** | sector patrimonial | 🔴 única unidad con `verificado:false` |
| 7 | **Credencial Brave** | segundo proveedor web | 🔴 `BRAVE_API_KEY` |
| 8 | Attribution Engine · Replay Reconstructor | atribución y reconstrucción | UX-3 |
| 9 | Ingesta continua | separar actividad de observación | riesgo WR-7 |
| 10 | **Nomenclatura oficial de barrios y sectores** del GAD, con su relación a parroquia | resolución infra-parroquial | 🔴 no localizada; 9 topónimos son candidatos sin certificar |
| 11 | **Ventana temporal anterior** en el recolector | tendencias, emergentes, «en crecimiento» | 🔴 Google News no da archivo histórico |

`POST /api/territorio/recargar` integra 1–4 **sin reiniciar el backend y sin
cambiar arquitectura**.

`poblacionOficial` y `padronElectoral` son denominadores **distintos**: nunca se
usa uno como el otro.

### Reglas obligatorias — vigentes

- geometría = `null`;
- población = `null` si no existe fuente oficial;
- padrón = `null` si no existe fuente oficial;
- `verificado: false` en las 40 unidades;
- etiqueta **«Dato oficial pendiente de integración»** hasta la interfaz;
- **no inventar porcentajes poblacionales**;
- **no inventar métricas per cápita** — implementado como *ausencia de código*
  en `normalizer.js`, no como aviso;
- **no inventar geometrías**;
- **no llamar «penetración» ni «cobertura poblacional»** a una intensidad
  relativa. El ranking usa **conteo absoluto** con escala por **cuantiles sobre
  las unidades con dato**, y lo declara.

---

## 15. Fuentes y proveedores

| Fuente | Tipo real | Estado |
|---|---|---|
| SerpAPI (Google) | **API oficial de terceros** sobre resultados de Google | ✅ prioridad 1 |
| Brave Search | API oficial | 🟡 implementado, **sin credencial** |
| DuckDuckGo | **raspado de HTML** | ✅ prioridad 3, último recurso |
| Google News | **RSS / búsqueda web** | ✅ semilla |
| Wikidata | **API pública** | ✅ cuentas declaradas + P18 |
| Wikipedia | **API pública** | ✅ fotografía nivel 1 |
| Wayback | API pública | ✅ |
| Whois | consulta pública | ✅ |
| Facebook · Instagram · X · TikTok · YouTube · LinkedIn | **descubrimiento mediante buscador** | ✅ |

> **No existe integración con ninguna API de plataforma social.** Las cuentas se
> descubren por buscador y por declaración en Wikidata. Nunca se lee el perfil,
> por lo que seguidores, biografía, verificación y recuento de publicaciones se
> declaran **no leídos**.

Distinción usada en el sistema:

| Concepto | Significado |
|---|---|
| API | se consulta un endpoint oficial (SerpAPI, Wikidata, Wikipedia) |
| búsqueda web | se consulta un buscador (SerpAPI/Google, DuckDuckGo) |
| fuente abierta | contenido público accesible sin credencial |
| semilla del analista | URL aportada por una persona: `cuenta_referencia` |
| evidencia derivada | dato obtenido de otra evidencia (handle desde una URL) |

---

## 16. SerpAPI

| Aspecto | Valor comprobado |
|---|---|
| Archivo | `services/providers/serpapiProvider.js` |
| Credencial | `SERPAPI_KEY` o `SERPAPI_API_KEY` en `apps/backend/.env` (lectura perezosa) |
| Prioridad | 1 (antes de Brave y DuckDuckGo) |
| Presupuesto por investigación | **6 consultas** — una por plataforma obligatoria |
| Intervalo | 250 ms |
| Motores que dependen | Discovery Engine (vía 3), Fusion Search Engine, Search Provider Layer |
| Control de consumo | presupuesto por investigación + guarda de saldo antes de gastar + descuento local del saldo memorizado |
| Consulta de saldo | `account.json` (no consume búsquedas), memorizado 5 min |
| Cuota agotada | se declara `Bloqueado`, **nunca** «sin resultados» |
| **Saldo actual** | **consultar en tiempo de ejecución** — `GET /api/osint/health` o `account.json` |

Limitaciones conocidas: el plan gratuito da un saldo mensual que **no se
recupera esperando**; con presupuesto 6 cubre ~41 investigaciones por cada 250
búsquedas.

---

## 17. Componentes congelados

**«Congelado» significa que no debe modificarse durante un hotfix sin
autorización explícita del analista.**

Los 14 declarados en los sprints previos. **Todos verificados como existentes**
en esta tarea:

| Componente | Archivo |
|---|---|
| SD-1A | `services/social/discovery/socialUrlClassifier.js` |
| CB-1 | `services/social/identity/contextBoost.js` |
| SerpAPI Provider | `services/providers/serpapiProvider.js` |
| Identity Matcher | `services/social/identity/identityMatcher.js` |
| Social Contracts | `services/social/socialContracts.js` |
| Lake Writer | `services/knowledgeLake/lakeWriter.js` |
| Lake Query | `services/knowledgeLake/lakeQuery.js` |
| Lake Indexer | `services/knowledgeLake/lakeIndexer.js` |
| Lake Adapter | `services/knowledgeLake/lakeAdapter.js` |
| Social Evidence Engine | `services/social/evidence/socialEvidenceEngine.js` |
| Account Classifier | `services/social/classification/accountClassifier.js` |
| Discovery Engine | `services/social/discovery/discoveryEngine.js` |
| OSINT Engine | `services/osintEngine.js` |
| Platform Adapters | `services/social/discovery/platformAdapters.js` |

### Excepciones autorizadas

| Fecha | Componente | Autorización | Alcance |
|---|---|---|---|
| 2026-08-24 | `accountClassifier.js` | LÍNEA A, L-1 | **Exclusivamente** la regla de apellido. Ver §18-bis |
| 2026-08-24 | `discoveryEngine.js` | LÍNEA A, L-2 | VÍA 0 y marca de no corroboración |
| 2026-08-24 | `osintEngine.js` | LÍNEA A, L-2 | Entregar `cuentasReferencia` al Social Intelligence |
| 2026-08-24 | `platformAdapters.js` | patch alias → planner | **Solo** la PASADA 3 de alias. Ver §18-quater |
| 2026-08-24 | `osintEngine.js` | patch alias → planner | `perfil.aliasDeclarados` |
| 2026-08-24 | `discoveryEngine.js` | GATE P-CAND-01 | **Solo** exponer `aliasUsados` en el retorno. Ver §18-sexies |

`platformAdapters.js` y `socialUrlClassifier.js` (SD-1A) se **usaron** como
autoridades —anclas y lectura de URL— sin modificarse. `socialIntelligenceLayer.js`
no está en la lista de congelados: es un conducto.

---

## 18. Pruebas realizadas

Registradas en los mensajes de commit del repositorio.

| Objetivo | Resultado registrado | Commit |
|---|---|---|
| Daniel Noboa | foto Wikipedia 97 + 6/6 plataformas con cuenta | `c65d680` |
| Juan Cristóbal Lloret | `@jotalloretv` única atribuida, 10 medios separados | `c65d680` |
| Yaku Pérez | 5 cuentas, `@yakuperezg` 97/100 | `c65d680` |
| Marcelo Cabrera | 5 cuentas, `@hmarcelocabrera` 78/100 | `c65d680` |
| Pedro Palacios | 0 atribuidas sin falsos positivos; `@MunicipioDeCuenca` separada como institución | `c65d680` |
| Pedro Palacios (en proyecto) | Facebook 90 · Instagram 84 · X 79 | `d964999` |
| Juan Carlos Vega | `@JuanCVegaEC` 56/100; el cantante no aparece; sin foto antes que la de un homónimo | `c65d680` |
| Nombre inexistente | 0 cuentas, 0 evidencias, 6 plataformas no comprobadas | `c65d680` |

Auditoría formal: `docs/auditorias/AUD-001-Discovery-Planner-Pedro-Palacios.json`
— 48 URLs evaluadas con las 6 consultas obligatorias.

⚠️ Los resultados detallados de cada prueba viven en los mensajes de commit, no
en un informe consolidado. **Prueba registrada históricamente; consolidación
pendiente.**

---

## 18-bis. LÍNEA A — Tubería de identidad corregida (2026-08-24)

Commit `fix(projects): restore candidate identity discovery coverage`.
HEAD auditado en la autorización: `c37d1e0`. HEAD real al implementar:
`4a0e2d8` — la sesión Territorial commiteó entre la auditoría y la
implementación. Sin conflicto: ningún archivo territorial se tocó y sus
107 pruebas siguen pasando.

### Causa raíz

Tres defectos independientes, en tres capas distintas, que se sumaban para
producir el mismo síntoma —«el candidato del proyecto no tiene cuentas»— y
que **empeoraban cuanto más preciso era el analista**.

**1 · La regla de apellido exigía el ÚLTIMO token.**
`accountClassifier.llevaNombreDelObjetivo` pedía que la coincidencia cayera
en el último token de ≥4 caracteres del nombre escrito. Con dos tokens
funciona. Con tres o cuatro, cada apellido añadido estrechaba el filtro:

| Nombre escrito | Token exigido | Consecuencia |
|---|---|---|
| `Yaku Pérez Guartambel` | `guartambel` | perdía 5 de 6 cuentas |
| `Juan Cristóbal Lloret Valdivieso` | `valdivieso` | perdía `@jotalloretv` |
| `Paúl Carrasco Carpio` | `carpio` | 0 cuentas |

Escribir el nombre completo —lo que un analista hace para ser exacto— hacía
la atribución más estricta. El incentivo estaba invertido.

**2 · `cuentasReferencia` era decorativa.**
Las URLs que el analista escribía se guardaban en el expediente y
`osintEngine` las devolvía en la respuesta (línea 1098, un eco). No llegaban
al planificador, ni al Discovery, ni al matcher. El motor volvía a buscar a
ciegas y, si no las reencontraba, la cuenta que el analista había escrito no
aparecía en el resultado.

**3 · Fusion usaba la frase del formulario como contexto.**
`planificarConsultas` concatenaba `contexto.rol` + `contexto.pais`. En modo
proyecto `contexto.rol` es el texto libre del analista, así que la consulta
salía con ocho palabras:

    "Pedro Palacios" Candidato a Alcalde de Cuenca Ecuador

Un buscador web con ocho palabras devuelve lo que las contiene casi todas, y
las cuentas sociales no lo hacen. La consulta era tan precisa que no
encontraba nada. Fusion no leía `contextoMaestro.anclas`, que ya existían
destiladas.

### Correcciones

| ID | Archivo | Cambio |
|---|---|---|
| L-1 | `services/social/classification/accountClassifier.js` | `zonaDeApellidos(tokens)`: descarta los nombres de pila iniciales y exige **uno cualquiera** de los apellidos restantes. Léxico `NOMBRES_DE_PILA` (~200 nombres, tipo de token, sin ningún nombre de objetivo) con **respaldo posicional** cuando no reconoce el primer token. |
| L-2 | `services/social/discovery/discoveryEngine.js` | **VÍA 0** — las URLs del analista entran al Discovery con `via: "cuenta_referencia"`, `origen: "analista"` y `noCuentaComoCorroboracion: true`. |
| L-2 | `services/social/socialIntelligenceLayer.js` | Conducto de `cuentasReferencia`. |
| L-2 | `services/osintEngine.js` | Entrega la semilla al Social Intelligence en lugar de solo devolverla. |
| L-3 | `services/fusionSearchEngine.js` | La consulta de contexto usa las **dos anclas más fuertes** vía `extraerAnclas`, una sola autoridad compartida con el planificador social. |

**L-1 no se convirtió en «cualquier token vale».** La coincidencia sigue
teniendo que caer en un apellido: `Juan Carlos Vega` continúa exigiendo
`vega`, y `@juan-carlos-garcía-macías` continúa rechazado. Ese es el falso
positivo que la regla vieja existía para frenar, y sigue frenado.

**L-1 es inerte para nombres de dos tokens.** Con dos tokens la zona de
apellidos es el segundo, exactamente lo que exigía la regla anterior. Ningún
objetivo de dos tokens —`Pedro Palacios`, `Daniel Noboa`— puede empeorar por
construcción, no por medición.

### Regla absoluta — no autoverificación

Una cuenta que el analista escribió **no puede servir de prueba de sí
misma**. Si entrara como un hallazgo cualquiera, Sentinel se sumaría puntos
de corroboración por «encontrar» lo que le acaban de dictar.

El filtro se aplica **en el límite del Discovery**, no en cada señal: los
orígenes marcados quedan fuera de las dos listas que alimentan S6.

| Lista | Alimenta | La referencia entra |
|---|---|---|
| `proveedores` | corroboración multi-proveedor (`officialLinkSignal.js:181`) | **no** |
| `vias` | vías independientes (`officialLinkSignal.js:220`) | **no** |
| `origenes` | trazabilidad | sí, con su marca |
| `viasDeclaradas` | transparencia hacia el analista | sí |

El segundo punto era el menos evidente y el más peligroso:
`cuenta_referencia` **no** está en `VIAS_DERIVADAS`, así que habría contado
como «vía que aporta información nueva». Filtrar en el límite significa que
una señal futura que lea `vias` hereda la garantía sin tener que acordarse
de ella.

Negarle puntos no es esconderla: el origen consta con `origen: "analista"`,
y `aportadaPorAnalista` lo expone a la interfaz. Y si un proveedor real
encuentra la misma cuenta por su cuenta, **ese** origen sí corrobora, porque
es independiente.

### Reclasificación a cuota cero

Sin ejecutar ninguna búsqueda: se reclasificaron los grupos de candidatos
reales que el Discovery ya había producido, contra el nombre largo del
proyecto, con la regla vieja y con la nueva. El grupo es idéntico en ambos
casos; lo único que cambia es la regla.

| Candidato | Grupo | Antes | Después | Recuperadas | Rechazadas |
|---|---|---|---|---|---|
| Paúl Carrasco Carpio | — | — | — | — | sin grupo guardado |
| Juan Cristóbal Lloret Valdivieso | 42 | 0 | 1 | 1 | 0 |
| Pedro Palacios | 71 | 0 | 0 | 0 | 0 |
| Yaku Pérez Guartambel | 40 | 0 | 6 | 6 | 2 |
| Juan Carlos Vega *(control)* | 56 | 4 | 4 | 0 | 1 |

Recuperadas: `@jotalloretv` (X) y las seis de Yaku Pérez —X, Instagram ×2,
Facebook ×2, TikTok—, todas rechazadas antes por no llevar `guartambel`.

**Pedro Palacios 0 → 0 no es un fallo de L-1.** Su grupo de 71 candidatos no
contiene **ninguna** URL con la cadena `palacio`: la cuenta nunca llegó al
clasificador. Es un problema de Discovery, que es lo que atacan L-2 y L-3, y
solo el piloto real puede medirlo.

**Paúl Carrasco Carpio no tiene grupo guardado.** Su caso solo puede
validarse en el piloto real. Lo que sí está demostrado en prueba unitaria es
el mecanismo: la zona pasa a ser `{carrasco, carpio}` y `@paulcarrascoc`
—rechazada por la regla vieja, que exigía `carpio`— ahora se atribuye.

### Pruebas

`npm test --workspace apps/backend` — **189 comprobaciones, 0 fallos.**
Ninguna consume cuota ni red.

| Fichero | Cubre | Resultado |
|---|---|---|
| `tests/territorial.test.mjs` | LÍNEA B, preexistente | 107 / 0 |
| `tests/identidad.test.mjs` | T8 zona de apellidos + **regresión de falso positivo** | 19 / 0 |
| `tests/referencia.test.mjs` | T3 semilla + T4 no autoverificación | 19 / 0 |
| `tests/contexto.test.mjs` | T5 cobertura de plataformas + T6 contexto destilado | 28 / 0 |
| `tests/persistencia.test.mjs` | T7 expediente persistente | 16 / 0 |

Decisiones de las pruebas que conviene no deshacer:

- **`identidad.test.mjs` prueba los dos defectos opuestos.** El bloque T8.c
  (falsos positivos) no es un extra: un test que solo cubriera los falsos
  negativos permitiría «cualquier token vale» como corrección válida.
- **`referencia.test.mjs` usa un helper `async`.** Varias comprobaciones
  vuelven a llamar al Discovery; con un `t()` sincrónico una promesa siempre
  es verdadera y esas pruebas habrían pasado sin comprobar nada.
- **`persistencia.test.mjs` fuerza `SENTINEL_LAKE_ADAPTER=memoria`** antes de
  importar el store, y su primera comprobación verifica que el lake arranca
  vacío. El Lake es append-only: un test que escribiera en
  `data/knowledge-lake` ensuciaría datos de trabajo en cada ejecución.
- **T1 y T2 no se ejecutaron**: consumen cuota de proveedor.

### Hallazgos declarados, NO corregidos

Fuera del alcance de esta autorización. Ver BUG-07 y BUG-08 en §22.

---

## 18-ter. Reset controlado pre-piloto (2026-08-24)

Objetivo: partir de un estado limpio antes del piloto real de candidatos.

### Lo que NO se pudo hacer, y por qué

**No se eliminó ninguna entrada del Knowledge Lake. No se puede.**

El Lake es append-only **por diseño de interfaz**, no por convención. El
adaptador expone solo `anexar` y `leerTodos`; `eliminar` está en
`OPERACIONES_PROHIBIDAS` y `lakeWriter` la define como una función que lanza
excepción. El propio módulo lo dice:

> «La ausencia de esas dos operaciones EN LA INTERFAZ es lo que hace real el
> append-only: no basta con no llamarlas, es que no hay forma de llamarlas.»

Un `purgeProject` que borrara entradas exigiría **añadir `eliminar` al
adaptador** —destruyendo la garantía sobre la que se apoya toda la
auditabilidad— y reescribir ficheros JSONL con read-modify-write, que es
exactamente lo que el diseño prohíbe. No se hizo, y no se debe hacer sin una
decisión de arquitectura explícita.

### Lo que sí se hizo: aislamiento, no borrado

La limpieza no requería borrar. El baseline cero se logró por la clave de
aislamiento `tenant::proyecto::tipo::entidad`: un `proyectoId` nuevo no puede
leer entradas de otro. **Verificado**, no supuesto.

| Operación | Mecanismo | Entradas borradas |
|---|---|---|
| Retirar los 6 proyectos de prueba | `cambiarEstadoProyecto(id,'eliminado')`, API oficial existente | 0 |
| Crear el proyecto del piloto | `POST /api/proyectos`, ruta normal | 0 |

El Lake pasó de **71 a 73 entradas**: solo se anexó. Sus datos siguen
íntegros y auditables, fuera de la vista.

### El riesgo real que se encontró — y que era el verdadero problema

El peligro no era la basura acumulada. Era éste:

`crearProyecto` deriva el id del nombre (`idDesde(nombre)`) y **no comprueba
colisiones**. El nombre pedido, `Elecciones Alcaldía Cuenca 2027`, genera
`elecciones-alcaldia-cuenca-2027`, que **ya existía** como proyecto eliminado
con 4 candidatos, 1 actor de referencia y una `dignidad` con U+FFFD.

Crear el proyecto por el camino obvio habría escrito una versión nueva de esa
misma entidad: el proyecto habría **resucitado a `activo`** heredando sus 4
candidatos y reintroduciendo BUG-04. Reproducido en lake aislado antes de
tocar nada. Es el fallo exacto que §13 del reset manda detectar.

Solución sin código nuevo: `crearProyecto` ya acepta `datos.id`, y la ruta
pasa `req.body` completo. El proyecto del piloto usa un id explícito distinto
y conserva el nombre exacto. Ver **BUG-09**.

### Estado resultante

| Campo | Valor |
|---|---|
| `proyectoId` | `alcaldia-cuenca-2027-piloto` |
| `nombre` | `Elecciones Alcaldía Cuenca 2027` |
| Territorio | Ecuador · Azuay · Cuenca |
| Dignidad | `Alcaldía de Cuenca` |
| Nivel / anclas | cantonal — `Cuenca` 24, `alcaldia` 22 |
| `codificacionSospechosa` | `false` |
| Baseline | candidatos 0 · actores 0 · expedientes 0 · evidencias propias 0 |

UTF-8 verificado **por bytes** en el JSONL: `Alcald` + `c3 ad` + `a`. Sin
U+FFFD y sin doble codificación. Durante la verificación mi propia consola
mostró `AlcaldÃ­a`; el dato en disco era correcto y el fallo estaba en la
tubería de lectura. Es la misma disciplina de BUG-04: comprobar los bytes
antes de culpar a una capa.

### Proyectos retirados

| `proyectoId` | Candidatos | Actores | Entradas en el Lake |
|---|---|---|---|
| `elecciones-alcaldia-cuenca-2027-hf` | 4 | 0 | 8 + 1 doc |
| `elecciones-alcaldia-cuenca-2027` | 4 | 1 | 10 + 2 doc |
| `elecciones-seccionales-cuenca-2027` | 2 | 0 | 6 + 3 doc |
| `elecciones-loja-2027` | 1 | 0 | 2 + 3 doc |
| `elecciones-alcaldia-2026` | 1 | 0 | 2 + 2 doc |
| `prueba-utf-8-naeiou` | 0 | 0 | 0 + 6 doc |

Auditoría: `docs/auditorias/SNAP-001-reset-pre-piloto-real.json`.

### Conservado a propósito

- **`osint-investigacion-adhoc`** — 24 entradas. Son investigaciones de modo
  individual: no pertenecen a ningún proyecto. **Dato compartido, no se toca.**
- **`t::p::persona::x1` y `x2`** — 2 entradas de un ensayo del Lake del
  2026-08-21, tenant `t`, `datos` vacíos. No están en el catálogo de
  proyectos y no pertenecen a ninguno. Ante la duda, no se borran: se
  declaran.
- **Territorial y datasets oficiales** — viven en
  `apps/backend/services/geo/territories/` (árbol de código, no el Lake).
  Fuera de toda superficie de purga. `git status` limpio, 107/107 pruebas.
- **`pedro-palacios` aparecía en 5 proyectos distintos.** Ninguna operación se
  hizo por nombre de candidato, solo por `proyectoId`.

### Límite honesto de este reset

Los expedientes retirados **siguen siendo recuperables** por id directo,
porque nada se borró. Para el piloto es irrelevante —viven en otros
`proyectoId` y el proyecto nuevo no puede alcanzarlos—, pero no debe
describirse como una purga destructiva: no lo es.

---

## 18-quater. Alias → Discovery Planner (2026-08-24)

Commit `fix(projects): feed aliases into discovery planner`. El pendiente
estaba **ABIERTO**; verificado contra HEAD siguiendo un alias de punta a
punta, no por suposicion.

### Donde moria el alias

| Paso | Que pasaba |
|---|---|
| `apps/web/src/services/aliasMemory.js` | Aprende alias de un resultado y los guarda en `localStorage` (`sentinel.alias.v1`) |
| `OSINT.jsx:389`, `ExecutiveDashboard.jsx:14` | `recordar()` se pasa como **prop** a `CoverageIndexPanel` |
| — | **Fin del recorrido.** Ningun `fetch` incluye alias; ninguna ruta del backend los acepta |
| `platformAdapters.planificarConsultasDerivadas` | Usaba solo `perfil.nombrePrincipal` |

El propio modulo lo declaraba: «NO alimenta el planificador de consultas […]
La reutilizacion es asistida, no automatica. Presentarla como automatica seria
mentir sobre lo que hace el sistema.» Era cierto.

**`perfil.variantes` no eran estos alias.** Fusion ya las usaba (pasos 5 y 7
de `planificarConsultas`), pero las deriva `referenceProfileService` de la
evidencia de la propia investigacion. No se mezclan con los alias declarados:
mezclarlos perderia la procedencia.

### Cadena implementada

| Archivo | Cambio |
|---|---|
| `projects/projectStore.js` | `agregarCandidato` guarda `datos.aliases` con `origen: "analista"` y `noCuentaComoCorroboracion: true`; acumula, deduplica sin acentos ni mayusculas y descarta el que iguale al nombre principal |
| `routes/projects.js` | Los entrega a `investigarObjetivo` |
| `services/osintEngine.js` | Los pone en `perfil.aliasDeclarados`, campo propio, antes del planificador |
| `social/discovery/platformAdapters.js` | **PASADA 3** del MISMO planificador. No hay planner paralelo |

### Las dos reglas que lo sostienen

**Amplian, no reemplazan.** El plan crece de 10 a 12 consultas. El nombre
principal conserva **todas** las suyas y las seis plataformas siguen
cubiertas. Los alias van **al final**: cuando el presupuesto del proveedor se
agota debe perderse lo ultimo, no lo primero, y un alias no puede costarle a
una plataforma su consulta. Sin alias declarados el plan es identico al
anterior, consulta por consulta.

**Un alias no verifica identidad.** Solo genera consultas. No llega al
`accountClassifier`, que sigue juzgando la atribucion contra
`nombrePrincipal` y solo contra el:

> el alias amplia el **recall**; el nombre principal gobierna la **precision**

Si un alias pudiera atribuir, bastaria escribir «Alcalde» en el formulario
para que cualquier cuenta que lo lleve pasara a ser del candidato: el analista
habria dictado la conclusion y Sentinel se la habria devuelto como hallazgo.
Comprobado que declarar `Alcalde de Cuenca` **no** convierte
`@alcaldedecuenca` en cuenta del candidato, que la atribucion es identica con
y sin alias, y que un alias no rescata lo que el apellido rechaza.

Van anclados al contexto: un alias es mas corto y ambiguo que el nombre
completo, asi que sin anclas es justo la consulta que devuelve homonimos.

### Caso verificado — nombre + alias

Objetivo `Juan Cristobal Lloret Valdivieso`, alias `Jota Lloret` y
`J. C. Lloret`, proyecto cantonal de Cuenca:

```
site:x.com "Juan Cristobal Lloret Valdivieso" Cuenca alcalde   <- 6 plataformas
site:x.com "Juan Cristobal Lloret Valdivieso"                  <- reserva
"Jota Lloret" Cuenca alcalde                                   <- alias, al final
"J. C. Lloret" Cuenca alcalde
"Juan Cristobal Lloret Valdivieso" Cuenca alcalde              <- general
```

### Pruebas

`tests/alias.test.mjs` — 19 comprobaciones. Suite completa **208, 0 fallos**,
ninguna consume cuota. Territorial 107/107.

### Lo que NO queda cerrado

Se cierra la ruta **autoritativa**: alias declarados en el expediente del
candidato, persistidos en el Lake, que alimentan el planificador.

**Sigue abierto** que los alias *aprendidos* en el navegador se reutilicen
solos: `aliasMemory` continua siendo `localStorage` y de presentacion. Nadie
los sube. Ver BUG-10.

---

## 18-quinquies. Piloto real Paul + Lloret — diagnostico (2026-08-24)

Sin ejecutar busquedas nuevas. Todo lo que sigue sale de la persistencia.

### Que ocurrio de verdad

| | Paul Carrasco Carpio | Juan Cristobal Lloret Valdivieso |
|---|---|---|
| Candidato creado | 19:55:10 | 19:58:03 |
| Expedientes escritos | **1** (19:56:40) | **2** (19:58:45 y 20:00:13) |
| `estadoInvestigacion` | `completada` | `completada` |
| Cuentas atribuidas | 1 | 2 |
| Huella | 14 | 22 |

**Las dos investigaciones terminaron y persistieron.** Lloret se investigo
**dos veces**: la segunda no aporto ninguna cuenta nueva —cuentas, huella y
evidencias web identicas— y consumio cuota otra vez. Clasificacion del caso
Lloret: **A — termino correctamente pero la interfaz no actualizo su estado.**

### BUG-11 — causa raiz demostrada

`ProjectsModule.jsx`, funcion `investigar()`. Al volver la respuesta parchea
el candidato en memoria con `resultado`, `cobertura`, `cuentas` y
`expediente`, y **no escribe `estadoInvestigacion`**. Ese es justo el campo
que deciden el boton y la insignia:

```js
c.estadoInvestigacion === "completada" ? "Actualizar investigacion"
                                       : "Investigar candidato"
```

Por que Paul si y Lloret no: el porcentaje se muestra con
`c.resumen?.huellaDigital ?? c.cobertura`, que **tiene respaldo**, y
`estadoInvestigacion` **no tiene ninguno**. Paul se investigo antes de la
ultima carga de la pagina, asi que su `estadoInvestigacion` llego del backend
ya como `completada`. Lloret se investigo despues: sus numeros aparecieron por
el parche en memoria y su estado se quedo con el valor de la carga.

Consecuencia real, y no es cosmetica: el boton seguia invitando a investigar,
el analista pulso otra vez y **se gasto cuota por duplicado**. Eso es lo que
explica el segundo expediente de Lloret.

### Cobertura 14 vs 22 — reproducida exactamente

El indice **no mide volumen**. No entran medios ni evidencias.

| Componente | Paul | Lloret |
|---|---|---|
| Cobertura de plataformas (40) | 7 — 1 de 6 | **13 — 2 de 6** |
| Solidez de la mejor correspondencia (30) | 7 — mejor 22/100 | **9 — mejor 31/100** |
| Corroboracion multiproveedor (20) | 0 | 0 |
| Declaracion en base de referencia (10) | 0 | 0 |
| **Total** | **14** | **22** |

Lloret puntua mas con menos medios y menos evidencias porque tiene el doble de
plataformas con cuenta atribuible y una correspondencia mejor. El indice mide
dimensiones, no cantidad: **queda validado**.

### L-1 y L-2 verificados en produccion

**L-1 funciono.** `x.com/jotalloretv` quedo atribuida con correspondencia 31.
Es la cuenta que la regla anterior perdia por exigir `valdivieso`.

**L-2 funciono, y se comporto como debia.** Las dos cuentas de referencia del
analista —la de Paul y la de Lloret— estan guardadas con `proveedores: []`.
No se autoverificaron ni una vez.

Y el filtro de L-2 quedo **exonerado** como causa de la regresion de abajo:
comprobado sin cuota que cuando los proveedores devuelven la cuenta, los dos
se conservan intactos; el filtro solo excluye el origen del analista.

### La regresion que NO queda explicada

Comparando con el expediente historico del proyecto retirado
`elecciones-alcaldia-cuenca-2027-hf` (05:35, anterior a L-1/L-2/L-3), **solo
como referencia diagnostica**:

| | Historico 05:35 | Piloto 20:00 |
|---|---|---|
| Huella | **49** | 22 |
| Facebook `juancristobal.lloretvaldivieso` | corr **86**, proveedores **DuckDuckGo + SerpAPI** | corr **25**, proveedores **[]** |
| Otra cuenta | Instagram `jotalloretv` corr 24 | X `jotalloretv` corr 31 |
| Evidencias web | **40** | 28 |

La misma cuenta de Facebook paso de estar corroborada por dos proveedores
independientes a no estar corroborada por ninguno. Con ella se fueron los
puntos de S6 y de S7, y la huella cayo de 49 a 22. Ademas el piloto recogio
un 30 % menos de evidencia web.

**No se puede determinar por que.** Y el motivo de que no se pueda es un
defecto en si mismo: ver BUG-12.

### Lo que el piloto NO permite reconstruir

`resumirExpediente` guarda cuentas, medios, instituciones y contadores. **No
guarda** las consultas ejecutadas, la cobertura por plataforma, las trazas del
Discovery ni los candidatos rechazados —y el motor **si los calcula**:
`perfilEjecutivo` produce `indeterminadas` y `coberturaPlataformas`, y se
descartan al persistir—. No hay logs en disco.

Consecuencia: las secciones de queries reales, resultados por plataforma y
cuentas rechazadas **no pueden responderse con evidencia**. Los planes que
figuran en el informe son **reconstruccion determinista** del planificador con
las entradas conocidas, no registro de ejecucion.

---

## 18-sexies. GATE P-CAND-01 — Observabilidad de Full Discovery (2026-08-24)

Commit `fix(projects): persist discovery trace and investigation state`.
HEAD de referencia: `d771e81`. Sin consumir cuota.

**P-CAND-01: EN REPRUEBA REAL.**

### BUG-12 — CERRADO POR CODIGO/TEST

Pendiente de confirmacion en ejecucion real.

El motor ya calculaba la traza y `resumirExpediente` la tiraba al persistir.
Ahora sobrevive. No se recalcula nada y no hay un segundo motor: se leen las
estructuras que `descubrirCandidatos` y `perfilEjecutivo` ya devuelven.

| Seccion nueva del expediente | De donde sale |
|---|---|
| `traza.consultas` | `descubrimiento.intentos` (lanzadas, con proveedor, estado y resultados) **+** las de `plan` que nunca salieron |
| `traza.coberturaPlataformas` | `social.cobertura` normalizada al contrato de cinco estados |
| `traza.candidatosSociales` | `social.candidatos` cruzado con el veredicto de `perfilEjecutivo` |
| `traza.urlsDescartadas` | `descubrimiento.descartados` (SD-1A) |
| `traza.proveedores` | `resumirSesion`: intentadas, completadas, bloqueos, errores, resultados |
| `traza.anclasUsadas` / `aliasUsados` | `planificacion` |

No se persisten claves de API ni payloads de proveedor: solo consultas,
estados y recuentos.

**El coste monetario no se inventa.** `costeMonetario: null` con nota
explicita. Lo observable son consultas, y eso es lo que se registra.

**Los recortes se declaran.** Topes de 120 candidatos y 60 consultas por
expediente, para que un Lake append-only no crezca sin limite, con
`candidatosTruncados` y `consultasTruncadas` llevando la cuenta. Un recorte
silencioso se leeria como «esto es todo lo que habia», que es el error que
este patch corrige.

### Contrato de Full Discovery

Cada una de las seis plataformas obligatorias declara **exactamente uno** de
cinco estados:

| Estado | Significa |
|---|---|
| `ATRIBUIDA` | hay una cuenta atribuida al objetivo |
| `ENCONTRADA_NO_ATRIBUIDA` | se hallaron candidatos y ninguno paso el clasificador |
| `BUSCADA_SIN_RESULTADO` | se consulto correctamente y no habia nada |
| `NO_EJECUTADA` | no se lanzo ninguna consulta |
| `ERROR_PROVIDER` | se intento y el proveedor no respondio |

Las tres ultimas son las que el diagnostico del piloto **no pudo
distinguir**. `ENCONTRADA_NO_ATRIBUIDA` es la que permite preguntar, con
datos, si el matcher pierde cuentas que el Discovery si encontro.

Ninguno de los cinco afirma que la persona no tenga cuenta. Sentinel declara
lo que observo.

### BUG-11 — CERRADO POR CODIGO/TEST

Pendiente de confirmacion visual real.

`investigar()` parcheaba el candidato en memoria y omitia
`estadoInvestigacion`. Ahora **recarga el estado autoritativo del backend**
tras investigar. No se deduce «completada» de que la peticion no fallara: eso
seria simular un exito que no consta en la persistencia.

Lo unico que se conserva del parche es `expediente`, el «que hay de nuevo» de
esa ejecucion, que no esta en el estado persistido y solo puede venir de esa
respuesta. `resultado` se elimino del parche: se escribia y no se leia en
ningun sitio.

La tarjeta muestra ahora insignia, boton **Actualizar investigacion** y
**ultima actualizacion** desde `resumen.actualizadoEn`.

Efecto practico: se detiene el gasto de cuota duplicado que produjo el segundo
expediente de Lloret.

### Pruebas

`tests/traza.test.mjs` — 31 comprobaciones sobre un resultado fijo, sin red.
Prueban el viaje completo `resultado -> registrarInvestigacion -> Lake ->
contenidoDeProyecto`, porque el defecto estaba justamente en el paso de
persistir; un test sobre el objeto en memoria no habria detectado nada.

Suite completa: **239 comprobaciones, 0 fallos** (antes 208).

### Retrocompatibilidad

Los dos expedientes del piloto anterior no tienen `traza` y siguen leyendose
sin error: la interfaz no la lee, y `estadoInvestigacion` se sigue derivando
de que exista expediente. La traza aparecera en la primera reejecucion.

---

## 18-septies. P-CAND-01 — Lectura de la reprueba real de Lloret (2026-08-24)

**La traza NO se persistio. La pregunta de por que Lloret termina con 2
cuentas sigue sin respuesta.** No por falta de codigo, sino por una guarda
anterior que el patch de BUG-12 no contemplo.

### Lo que dice la evidencia

| Comprobacion | Resultado |
|---|---|
| Ultima escritura en el Knowledge Lake | **2026-08-24 15:00:13 local** = el v2 del piloto original |
| Expediente v3 de Lloret | **no existe** |
| `traza` en el ultimo expediente | **ausente** |
| Backend en 3001 | PID 6548, arrancado **15:31:55** |
| Commit `845e91a` | **15:29:49** |

El proceso arranco **dos minutos despues del commit**: el backend **si tenia
el patch**. La reprueba se ejecuto de verdad y consumio cuota. Y la traza se
calculo y se tiro.

### Causa raiz — la guarda `sinCambios`

`registrarInvestigacion` decide si escribir con una comparacion que precede a
BUG-12:

```js
const sinCambios =
  anterior !== null &&
  JSON.stringify(anterior.clavesCuenta) === JSON.stringify(actual.clavesCuenta) &&
  (anterior.medios || []).length === actual.medios.length &&
  anterior.evidenciasWeb === actual.evidenciasWeb;

if (!sinCambios) { await escribirEnLake(...) }
```

La reprueba devolvio exactamente los mismos tres valores del v2 —las dos
mismas claves de cuenta, 7 medios, 28 evidencias web—, asi que `sinCambios`
fue `true` y **`escribirEnLake` no se llamo nunca**. De ahi el `+0 / +0 / +0`
y el mensaje «Sin cambios relevantes desde la ultima investigacion.»: es la
salida literal de esa rama.

El patch de BUG-12 añadio la traza al contenido persistido y **no reviso quien
decide persistir**. La consecuencia es la peor posible: la traza solo se
guarda cuando el resumen cambia, y una reejecucion —que es justo cuando se
necesita la traza— es el caso en que nunca cambia.

Es un defecto del patch, no del diagnostico previo.

### Defecto latente que la misma guarda esconde

La comparacion mira **tres** campos. Si cambiaran `huellaDigital`,
`instituciones` o `evidenciasSociales` y esos tres coincidieran, la escritura
tambien se omitiria y el expediente quedaria con datos viejos sin avisar.

Y la guarda es **redundante**: el propio Lake ya detecta la escritura
redundante por hash (`lakeWriter`, «sin cambios respecto a la version
anterior»), sobre el contenido completo y no sobre tres campos elegidos a
mano. Hay dos autoridades decidiendo lo mismo, y la mas debil es la que gana
porque actua primero.

### Estado de los bugs tras la reprueba

**BUG-12 — NO CONFIRMADO EN PRUEBA REAL.** Cerrado por codigo y test (31
comprobaciones), pero la ejecucion real no lo ejercito: la traza no llego al
Lake. Vuelve a P0.

**BUG-11 — NO CONFIRMADO EN PRUEBA REAL.** El boton quedo correcto, pero eso
**no lo demuestra**: el candidato ya estaba `completada` en la persistencia
desde las 19:58 UTC, y la version anterior del codigo tampoco borraba ese
valor —solo omitia escribirlo—. El escenario que distingue el patch es
investigar un candidato que este `sin_investigar` al cargar la pagina, y esta
reprueba no lo hizo. El cambio esta en su sitio y probado; la confirmacion
real sigue pendiente.

### Coste de esta reprueba

Consultas reales gastadas en SerpAPI y DuckDuckGo, sin registro. El consumo
observable que BUG-12 iba a persistir se perdio con la misma escritura
omitida.

### Alias

Esta ejecucion **no tuvo alias declarado**: la interfaz todavia no permite
añadirlos y `aliases` estaba vacio. «Jota Lloret» no se usa como entrada
retroactiva. El pendiente de alias en la interfaz sigue abierto.

---

## 18-octies. Hotfix BUG-13 — hallazgo vs ejecucion (2026-08-24)

Commit `fix(projects): persist zero-delta investigation runs`.

### Causa

`registrarInvestigacion` omitia `escribirEnLake` cuando el resumen no
cambiaba. Correcto para los hallazgos —reinvestigar no debe duplicar cuentas—
y catastrofico para la traza: **una reejecucion sin delta es exactamente el
caso en que se necesita mirar la traza, y era el unico en que se tiraba.**

### La separacion

Un solo registro representaba dos cosas distintas. Ahora son dos.

| | Que es | Se deduplica |
|---|---|---|
| **Expediente** | el conjunto ACUMULADO de hallazgos: cuentas, medios, instituciones | **si**, sin tocar |
| **Ejecucion** | el EVENTO de haber investigado: cuando, con que consultas, con que respuestas | **no**: siempre se guarda |

Un hecho no deja de haber ocurrido porque su resultado coincida con el de
ayer.

**No se duplica ningun hallazgo para forzar que un hash cambie.** Lo que se
persiste aparte es el evento, que es genuinamente nuevo. La deduplicacion
global de evidencias y el append-only quedan intactos.

### Identidad de ejecucion

Entidad propia por ejecucion:
`ejecucion-<tipo>-<candidatoId>-<instante ISO>`, con
`investigacionId` derivado del mismo instante.

**Sin aleatoriedad.** Dos investigaciones distintas son dos hechos distintos y
ya se distinguen por cuando ocurrieron. El instante es el mismo valor
autoritativo que ya se escribia en `actualizadoEn`.

`contenidoDeProyecto` expone por candidato `ejecuciones`,
`totalEjecuciones` y `ultimaEjecucion` — esta ultima es la que lleva la traza
de la ultima vez que se busco de verdad, haya cambiado algo o no.

### Delta cero es un resultado valido

`delta: {cuentas: 0, medios: 0, evidenciasWeb: 0}` coexiste con
`ejecucionRegistrada: true` y `trazaPersistida: true`. El retorno declara los
dos hechos por separado:

    ejecucionRegistrada      la investigacion consta
    expedienteActualizado    aporto hallazgos nuevos

Que el segundo sea `false` no vuelve `false` al primero.

### Dos defectos de construccion encontrados al implementar

**Clave del Lake en minusculas.** `claveLake` normaliza la entidad a
minusculas y el instante ISO lleva `T` y `Z` mayusculas, asi que una clave
reconstruida a mano no encontraba nada. Se usa la `claveEntidad` autoritativa
que el indice ya devuelve, en lugar de rearmarla. Elimina toda una clase de
fallo.

**`clavesCuenta` y `cuentas` tienen fuentes distintas.** El diferencial
deduplica con `clavesCuenta`, que se deriva de
`clasificacionCuentas.cuentasObjetivo`, mientras `cuentas` viene de
`perfilEjecutivo.tarjetas`. Si las dos divergen, el delta sale mal. Es
**preexistente** y queda **declarado, no corregido**: tocarlo era cambiar la
deduplicacion, que esta autorizacion excluye. Anotado en el test para que no
haya que volver a diagnosticarlo desde cero.

### Pruebas

`tests/ejecucion.test.mjs` — 28 comprobaciones. Reproducen el caso exacto:
investigacion N con 2 cuentas / 7 medios / 28 evidencias, y N+1 con las
mismas, mas una tercera identica. Demuestran que N+1 se registra, que los
hallazgos no se duplican, que N y N+1 son recuperables y que la traza de N+1
conserva queries, providers, `coberturaPlataformas`, rechazados con motivo,
errores de proveedor, truncamientos y `costeMonetario: null`.

Suite completa: **267 comprobaciones, 0 fallos** (antes 239). Sin red.

Retrocompatible: los candidatos del piloto anterior devuelven
`totalEjecuciones: 0` y `ultimaEjecucion: null` sin error.

### Estado

| | |
|---|---|
| **BUG-11** | **CERRADO**, confirmado en prueba real por observacion del analista |
| **BUG-12** | **EN REPRUEBA REAL** — codigo y test existentes, desbloqueado por este hotfix |
| **BUG-13** | **CERRADO POR CODIGO/TEST**, pendiente confirmacion real |
| **P-CAND-01** | **EN REPRUEBA REAL** |

---

## 18-nonies. P-CAND-01 — Reprueba real con traza (2026-08-24)

**La traza funciono. Por primera vez hay datos reales de las seis
plataformas.** Y revelan dos defectos de fidelidad de la propia traza que
impiden cerrar la pregunta.

    investigacionId  inv-candidato-juan-cristobal-lloret-valdivieso-2026-08-24T21:12:18.342Z
    ejecutadaEn      2026-08-24T21:12:18.342Z
    delta            0 cuentas · 0 medios · 0 evidencias web
    resumen          2 cuentas · 6 medios · 26 evidencias web · huella 22

Se escribieron **dos** registros: la ejecucion (v1) y el expediente (v3, porque
medios bajo de 7 a 6 y evidencias web de 28 a 26).

### Cobertura real de las seis plataformas

| Plataforma | Estado | Consultas | Proveedor | Resultados | Candidatos | Atribuidos |
|---|---|---|---|---|---|---|
| X | `ATRIBUIDA` | 2 (1 OK, 1 bloqueada) | SerpAPI | 10 | 10 | 1 |
| Facebook | `ATRIBUIDA` | 2 (1 OK, 1 bloqueada) | SerpAPI | 8 | 14 | 1 |
| Instagram | `BUSCADA_SIN_RESULTADO` **(mal etiquetado)** | 1 OK | SerpAPI | **10** | 0 | 0 |
| TikTok | `BUSCADA_SIN_RESULTADO` **(mal etiquetado)** | 1 OK | SerpAPI | **1** | 0 | 0 |
| LinkedIn | `ENCONTRADA_NO_ATRIBUIDA` | 1 OK | SerpAPI | 2 | 2 | **0** |
| YouTube | `ERROR_PROVIDER` | 2, ambas bloqueadas | — | 0 | 0 | 0 |

Proveedores: **SerpAPI** 6 intentadas, 5 completadas, 1 error, 31 resultados.
**DuckDuckGo** 2 intentadas, **2 bloqueos**, 0 resultados. **Brave** 0
intentos: sigue sin credencial.

5 de 10 consultas sociales no obtuvieron respuesta. Las bloqueadas son todas
de la segunda pasada —la reserva por nombre— y la general: el presupuesto de
SerpAPI se agoto en la primera pasada y DuckDuckGo bloqueo el 100 % de lo que
le llego.

### Por que Instagram y TikTok dieron cero

Las 12 URLs descartadas lo explican, y **no es un fallo del sistema**:

- **Instagram, 11 descartes**: todas son publicaciones, no perfiles —`/p/…` y
  `/reel/…`—. SD-1A se nego a convertir un post en cuenta, que es exactamente
  su trabajo. Dos llevaban propietario en la ruta
  (`/nuevotiempocuenca/reel/…`, `/toquillaradio/p/…`) y son **medios**, no
  Lloret.
- **TikTok, 1 descarte**: `/@segundo.cabrera82/photo/…`, otra persona.

La busqueda de Instagram devolvio 10 resultados y **ninguno era una URL de
perfil**. Eso NO es «se busco y no habia nada»: es «se busco, hubo 10
resultados y todos eran contenido». Colapsar las dos cosas es justo lo que el
contrato de cinco estados existe para evitar, y la normalizacion lo esta
colapsando. **Defecto de la traza, no del Discovery.**

### El defecto que impide cerrar

**`traza.candidatosSociales` esta VACIO** —`totalCandidatosSociales: 0`—
mientras la cobertura declara **26 candidatos** (10 en X, 14 en Facebook, 2 en
LinkedIn) de los que solo **2 se atribuyeron**.

Causa: `candidatosSociales()` lee `resultado.social.candidatos`, y
`socialIntelligenceLayer` **no expone ese campo**. Devuelve `fichas`. El
campo correcto existe y lleva `origenes`, `vias`, `proveedores` y
`corroboracion`; la procedencia del analista se deriva de
`origenes.some(o => o.origen === "analista")`.

Consecuencia: **24 candidatos de 26 se rechazaron sin motivo registrado.** La
pregunta de P-CAND-01 —si el matcher pierde cuentas que el Discovery si
encontro— sigue sin poder responderse, y LinkedIn es el caso que mas la pide:
2 candidatos, 0 atribuidos, motivos invisibles.

### Causa por plataforma

| Plataforma | Causa |
|---|---|
| X | SIN PROBLEMA |
| Facebook | SIN PROBLEMA |
| Instagram | SIN PROBLEMA en el motor · **traza mal etiquetada** |
| TikTok | SIN PROBLEMA en el motor · **traza mal etiquetada** |
| YouTube | **PROVIDER** — DuckDuckGo bloqueo 2/2, presupuesto de SerpAPI agotado |
| LinkedIn | **indeterminado**: parece MATCHER, no verificable sin los motivos |

### Estado de los bugs

| | |
|---|---|
| **BUG-11** | **CERRADO Y CONFIRMADO EN PRUEBA REAL**. Estado y boton correctos |
| **BUG-12** | **CONFIRMADO EN PRUEBA REAL como mecanismo**: la traza sobrevivio motor → ejecucion → Lake → lectura, con consultas, proveedores, cobertura y descartes. **Con dos defectos de fidelidad**, ver BUG-15 |
| **BUG-13** | **CONFIRMADO EN PRUEBA REAL**: la ejecucion se persistio con delta 0/0/0. Matiz: en esta corrida `sinCambios` fue `false` (medios y evidencias bajaron), asi que la rama `sinCambios: true` sigue probada solo por test |
| **BUG-15** | **NUEVO**: la traza lee un campo inexistente y etiqueta mal una plataforma que si devolvio resultados |
| **P-CAND-01** | **REQUIERE PATCH** |

### Dato nuevo, no explicado

Esta corrida encontro **menos** que la anterior: 6 medios frente a 7, 26
evidencias web frente a 28. Con DuckDuckGo bloqueando el 100 % y el
presupuesto de SerpAPI agotandose en la primera pasada, la cobertura depende
de un solo proveedor. Sigue sin explicar la regresion 49 → 22 frente al
historico.

---

## 18-decies. Hotfix BUG-15 — traza fiel (2026-08-24)

Commit `fix(projects): preserve social candidate rejection trace`.
Objetivo: hacer fiel la traza existente. Nada mas. No se toco el Matcher, ni
los umbrales, ni el presupuesto, ni los proveedores, ni la clasificacion.

### 1 · La fuente real de los candidatos

`candidatosSociales()` leia `resultado.social.candidatos`, campo que
`socialIntelligenceLayer` **no expone** —devuelve `fichas`—. La lista salia
vacia siempre: en la reprueba real se perdieron los motivos de **24 rechazos
de 26 candidatos**. Un campo mal elegido convirtio la traza en un formulario
en blanco.

Ahora se lee **`resultado.clasificacionCuentas`**, que es la mejor fuente
porque trae las dos mitades en el mismo objeto:

| | |
|---|---|
| el **veredicto** | `clasificacion.clase` y sus razones |
| la **procedencia** | `origenes`, `vias`, `proveedores`, `corroboracion` |

Sus cuatro grupos —`cuentasObjetivo`, `medios`, `instituciones`,
`indeterminadas`— son el grupo completo ya clasificado. `social.fichas` queda
como respaldo si la clasificacion no llega a construirse, y en ese caso el
motivo lo dice en lugar de quedarse en blanco.

Se persiste por candidato: plataforma, URL, handle, displayName, provider,
query de origen, score, aceptado/rechazado, motivo, `origenes`, `vias`,
`corroboracion` y procedencia del analista.

**Dos campos que el consolidador no propaga se DERIVAN de los origenes**, en
lugar de darlos por perdidos: `aportadaPorAnalista`
(`origenes.some(o => o.origen === "analista")`) y `viasDeclaradas` (los
origenes marcados `noCuentaComoCorroboracion`). El dato existe; solo habia que
mirarlo donde esta.

**No se cambio como se clasifica.** Solo se preserva lo que el motor ya
decidio.

### 2 · Estados de cobertura corregidos

`coberturaNormalizada()` decidia `BUSCADA_SIN_RESULTADO` mirando solo si hubo
consulta con exito y cero candidatos, **sin mirar los resultados**. Instagram
devolvio DIEZ enlaces —todos publicaciones y reels— y quedo etiquetada como si
la busqueda hubiera vuelto vacia.

Son dos hechos que no se pueden colapsar:

    no habia nada                  ausencia
    habia contenido, no perfiles   no atribuible

Ahora la normalizacion cuenta `resultadosDelBuscador` y los descartes de nivel
URL:

| Caso | Estado |
|---|---|
| hay cuenta atribuida | `ATRIBUIDA` |
| hay candidatos, ninguno atribuido | `ENCONTRADA_NO_ATRIBUIDA` |
| **hubo resultados o descartes, ningun perfil** | `ENCONTRADA_NO_ATRIBUIDA` |
| consulta OK y **cero** resultados | `BUSCADA_SIN_RESULTADO` |
| consulta lanzada y proveedor no respondio | `ERROR_PROVIDER` |
| ninguna consulta lanzada | `NO_EJECUTADA` |

Cada fila lleva ahora `resultadosDelBuscador`, `urlsDescartadas`,
`motivosDeDescarte` y una `explicacion` en palabras. Para Instagram:
*«El buscador devolvió 10 resultado(s) y 3 URL(s) se descartaron por no
identificar una cuenta. No se encontró ningún perfil atribuible; no es una
ausencia.»*

Instagram y TikTok pasan a `ENCONTRADA_NO_ATRIBUIDA` con sus descartes y
motivos visibles. **Nunca se afirma que la plataforma «no exista» para el
objetivo.**

### 3 · Los fixtures anteriores probaban una suposicion

Al aplicar el patch, tres pruebas de `traza.test.mjs` fallaron. No era una
regresion: aquellos fixtures se habian escrito contra `perfilEjecutivo`, que
es una **proyeccion para la interfaz**, en lugar de contra
`clasificacionCuentas`, que es la estructura del motor.

Es la misma raiz del bug. El test confirmaba mi suposicion y pasaba en verde
mientras la traza real salia vacia. Se reescribieron los fixtures con la forma
real —cada cuenta con `origenes`, `vias`, `proveedores`, `corroboracion`,
`correspondencia` y `clasificacion`— y las aserciones se **reforzaron**, no se
debilitaron. Un fixture que no se parece a la realidad no prueba nada.

### 4 · Pruebas

`tests/cobertura.test.mjs` — **25 comprobaciones**. Ejercitan los cinco
estados, uno por uno, con el caso que a cada uno le corresponde:

- **LinkedIn obligatorio**: los 2 candidatos sobreviven con score 18 y 6,
  motivo exacto de rechazo, provider, query, `origenes`, `vias`,
  `corroboracion` y `displayName`.
- Instagram con 10 resultados y 0 perfiles → `ENCONTRADA_NO_ATRIBUIDA`, con
  aserción explicita de que **no** es `BUSCADA_SIN_RESULTADO`.
- TikTok con 1 resultado de otra persona → idem.
- **YouTube con consulta OK y cero resultados → `BUSCADA_SIN_RESULTADO`**: la
  contraparte. Si esta fallara, el patch habria eliminado el estado en lugar
  de arreglarlo.
- Proveedor bloqueado → `ERROR_PROVIDER`. Consulta no lanzada →
  `NO_EJECUTADA`.
- La referencia del analista: origen analista, cero proveedores, cero vias
  corroborantes, `noCuentaComoCorroboracion`, y su via declarada visible
  aparte. Y una cuenta hallada por proveedor **si** conserva su corroboracion.

Suite completa: **292 comprobaciones, 0 fallos** (antes 267). Sin red. Lake
real intacto en 83 entradas. Lint del frontend sin cambios: los 6
preexistentes de BUG-01 y BUG-02.

### Estado

| | |
|---|---|
| **BUG-15** | **CERRADO POR CODIGO/TEST**, pendiente confirmacion real |
| **P-CAND-01** | **EN ULTIMA REPRUEBA REAL** |

---

## 18-undecies. Ejecucion real 22:14 — Full Discovery diagnosticado (2026-08-24)

**La traza funciono entera.** 29 candidatos persistidos con motivo, 16 URLs
descartadas con su razon, las seis plataformas con estado y recuento. Por
primera vez se puede decir con evidencia donde se pierde cada cuenta.

    investigacionId  inv-candidato-juan-cristobal-lloret-valdivieso-2026-08-24T22:14:19.006Z
    ejecutadaEn      2026-08-24T22:14:19.006Z
    delta            +1 cuenta · +1 medio · +14 evidencias web
    expediente       v4
    ejecuciones      5

Las tres ejecuciones intermedias (21:49, 21:51, 21:53) quedaron registradas
con delta 0/0/0: **BUG-13 confirmado en produccion**, cinco veces.

### Cobertura de las seis plataformas

| Plataforma | Estado | Res. | Descart. | Cand. | Atrib. | Proveedor |
|---|---|---|---|---|---|---|
| Facebook | `ATRIBUIDA` | 8 | 1 | 16 | 1 | OK + Error |
| X | `ATRIBUIDA` | 10 | 0 | 10 | 1 | OK + Bloqueado |
| Instagram | `ATRIBUIDA` | 9 | 10 | 1 | 1 | OK |
| LinkedIn | `ENCONTRADA_NO_ATRIBUIDA` | 2 | 0 | 2 | 0 | OK |
| YouTube | `ENCONTRADA_NO_ATRIBUIDA` | 3 | 4 | 0 | 0 | OK + Error |
| TikTok | `ENCONTRADA_NO_ATRIBUIDA` | 1 | 1 | 0 | 0 | OK |

Proveedores: SerpAPI 6 intentadas / 5 completadas / 1 error / 30 resultados ·
DuckDuckGo 2 / 1 / 1 bloqueo / 3 resultados · **Brave 0 intentos, sigue sin
credencial**.

### Las tres cuentas atribuidas

| Plataforma | URL | Score | Origen | Proveedores | Corrob. |
|---|---|---|---|---|---|
| Facebook | `facebook.com/juancristobal.lloretvaldivieso` | **86** | analista | DuckDuckGo + SerpAPI | **2, multiproveedor** |
| X | `x.com/jotalloretv` | 46 | Sentinel | SerpAPI | 1 |
| **Instagram** | **`instagram.com/jotalloretv`** | 21 | Sentinel | DuckDuckGo | 1 |

**La cuenta nueva es `instagram.com/jotalloretv`.** No llego por la consulta
`site:instagram.com` —esa devolvio 9 resultados, todos publicaciones y reels,
los 10 descartes de Instagram— sino por **`evidencia_fusion` y
`handle_observado`**: la encontro la capa web, no la consulta dirigida a la
plataforma.

**L-2 confirmado en produccion, y del modo mas claro posible.** La cuenta de
Facebook la escribio el analista y su `viasDeclaradas` sigue siendo
`cuenta_referencia`, sin corroborar. Pero esta vez DOS proveedores reales la
devolvieron por su cuenta, y **esos** si corroboraron: score 25 → 86. El
origen del analista no puntuo; el hallazgo independiente si. Es exactamente el
comportamiento que se diseño.

### 26 rechazos, todos con motivo

- **Facebook, 15**: medios (`RedInformativaCuenca`, `PrimiciasEcuador`,
  `NoticiasenCuenca`, `ecuavisa`, `wradioec`), instituciones
  (`municipioguachapala`, `DiegoMatovelleoficial`) y 8 que no llevan el nombre.
- **X, 9**: un medio (`WRadioEc`) y 8 que no llevan el nombre.
- **LinkedIn, 2**: `esteban-segarra-coello` y `paul-andrés-coronel`.

Ni un solo falso positivo. Ni un solo perfil plausible de Lloret rechazado.

### Instagram y TikTok frente a la referencia externa

Comparado **despues** de leer la traza, y sin insertar nada:

| Referencia | Veredicto |
|---|---|
| `instagram.com/jotalloretv` | **FUE ENCONTRADO Y ATRIBUIDO** |
| `tiktok.com/@jotalloretv` | **NO FUE ENCONTRADO POR DISCOVERY** |

TikTok no aparece en ninguna parte de la traza: ni candidato, ni descarte. Su
unica consulta —`site:tiktok.com "Juan Cristóbal Lloret Valdivieso" Cuenca
alcaldia`— devolvio **1 resultado**, la foto de `@segundo.cabrera82`, otra
persona. **TikTok recibio una sola consulta**: la pasada de reserva por nombre
solo cubre adaptadores con `presupuesto >= 2 && prioridad === 1`, y TikTok,
Instagram y LinkedIn quedan fuera.

### LinkedIn no es un problema del Matcher

Los 2 candidatos son `esteban-segarra-coello-a89a36172` y
`paul-andrés-coronel-639245308`, ambos con motivo «no lleva el nombre del
objetivo». **No corresponden a Lloret.** El rechazo es correcto y no hay
perdida que corregir.

### YouTube — ENCONTRADA_NO_ATRIBUIDA

3 resultados, **todos `watch?v=`**. La URL de un video no contiene a su
propietario, y declararlo canal seria inventar la cuenta. El descarte es
correcto. Una consulta ademas dio `Error`.

### La huella 22 → 53, componente a componente

**No mide popularidad, ni intencion de voto, ni apoyo ciudadano.** Mide la
amplitud y solidez de la presencia publica DOCUMENTADA.

| Componente | 21:12 | 22:14 | Delta |
|---|---|---|---|
| Cobertura de plataformas (40) | 13 — 2 de 6 | 20 — 3 de 6 | **+7** |
| Solidez de la mejor correspondencia (30) | 9 — mejor 31 | 26 — mejor **86** | **+17** |
| Corroboracion multiproveedor (20) | 0 | 7 — 1 de 3 | **+7** |
| Declaracion en base de referencia (10) | 0 | 0 | 0 |
| **Total** | **22** | **53** | **+31** |

**El motor del salto es la solidez, +17 de los +31.** Y esa subida viene de
que la cuenta de Facebook paso de 1 proveedor a 2: DuckDuckGo respondio esta
vez la consulta que antes bloqueo. La persona no cambio, y lo que se sabe de
ella apenas cambio: **cambio que un buscador contestara.**

Eso es un riesgo de lectura, no un defecto de calculo. Un numero que salta 31
puntos entre dos ejecuciones del mismo dia, presentado como «53 %» junto al
nombre de un candidato, invita a leerse como respaldo politico. **Se abre
pendiente de UX/metrica**: ver BUG-16.

### Estado

| | |
|---|---|
| **BUG-11** | CERRADO, confirmado en produccion |
| **BUG-12** | **CONFIRMADO EN PRODUCCION** — 29 candidatos, 16 descartes, 6 plataformas |
| **BUG-13** | **CONFIRMADO EN PRODUCCION** — 5 ejecuciones, 4 con delta cero |
| **BUG-15** | **CONFIRMADO EN PRODUCCION** — todos los rechazos con motivo, y los estados corregidos |
| **P-CAND-01** | causa aislada: **DISCOVERY**, reparto de consultas |

### Causa por plataforma

| Plataforma | Causa |
|---|---|
| Facebook | NINGUNO |
| X | NINGUNO |
| Instagram | NINGUNO |
| LinkedIn | NINGUNO — los candidatos no son el objetivo |
| YouTube | **DISCOVERY** — `site:youtube.com` devuelve videos, no canales |
| TikTok | **DISCOVERY** — una sola consulta, sin pasada de reserva |

**No es el Matcher.** No hay ni un perfil plausible de Lloret rechazado. No es
PERSISTENCIA/UI: la traza llego intacta. El proveedor limita, pero no es la
causa de TikTok: su consulta funciono y devolvio a otra persona.

---

## 18-duodecies. P-CAND-01 Handle Propagation (2026-08-24)

Commit `feat(discovery): propagate attributed handles across platforms`.

### Estado

**IMPLEMENTADO — LISTO PARA PRUEBA REAL.** 324 comprobaciones, 0 fallos.

### Que resuelve

En la ejecucion real de las 22:14 Sentinel atribuyo `jotalloretv` en X y en
Instagram, y TikTok se quedo sin cuenta: su unica consulta —nombre completo
mas contexto— devolvio un solo resultado, de otra persona. **El perfil de
TikTok con ese mismo handle nunca se busco.** Un handle ya confirmado en dos
plataformas es la mejor pista para las que faltan.

### Regla central

    MISMO HANDLE != MISMA PERSONA

La propagacion **solo genera candidatos**. Aumenta el recall y no toca la
precision: lo que se encuentre pasa por el mismo clasificador de cuentas, y si
el nombre no corresponde, se rechaza. Atribuir por igualdad de nombre de
usuario seria autoverificacion, y de la peor clase: suponer que un nombre es
una identidad.

### Arquitectura — la ruta, sin motores paralelos

    expediente (cuentas atribuidas)      routes/projects.js
    handlesObservados (evidencia web)    referenceProfileService
    cuentasReferencia (analista)         projectStore
              ↓
    perfil.handlesConocidos              osintEngine
              ↓
    semillasDeHandle: normaliza y dedup  platformAdapters
              ↓
    PASADA 4 del MISMO planificador      platformAdapters
              ↓
    via: "handle_propagado"              discoveryEngine
              ↓
    Account Classifier SIN CAMBIOS       accountClassifier
              ↓
    traza -> expediente                  projectStore

Ningun planner, discovery, matcher ni sistema de identidad paralelo. El
clasificador y los umbrales **no se tocaron**.

### Tres procedencias, con distinto peso

| Procedencia | Corrobora |
|---|---|
| **Atribuida** — Sentinel la clasifico en una investigacion anterior | si |
| **Observada** — aparecio en la evidencia web de esta investigacion | si |
| **Del analista** — la URL que escribio | **no**: `noCuentaComoCorroboracion: true` |

Una semilla deja de ser «solo del analista» en cuanto Sentinel la ve por su
cuenta. La declaracion orienta la busqueda; no es evidencia independiente.

### Orden y presupuesto

La propagacion va **despues** de la pasada anclada por plataforma y de la
reserva por nombre, y **antes** de la consulta general. Asi no le quita el
turno a ninguna consulta de plataforma —las que garantizan cobertura— y solo
se adelanta a la general, que es la menos especifica. Ninguna consulta
existente se elimino: el plan de Lloret pasa de 10 a 14.

Tope propio de **4** consultas propagadas por plan. Lo que no cabe se declara
en `propagadasTruncadas`; lo omitido por estar la plataforma ya resuelta, en
`propagacionOmitidaPorAtribuida`. Los topes globales no se subieron.

No se gasta en plataformas que ya tienen cuenta atribuida: con `jotalloretv`
atribuido en X e Instagram, la propagacion va a Facebook, YouTube, TikTok y
LinkedIn, y omite las dos primeras.

### Profile-first — dos huecos cerrados

Revisados los tres casos del gate. `youtube.com/channel/UC…` y `/c/…` **ya
funcionaban**; `watch` y `shorts` **ya** se rechazaban correctamente. Los
huecos reales eran dos, y los dos costaron cuentas en la ejecucion real:

| URL | Antes | Ahora |
|---|---|---|
| `instagram.com/toquillaradio/p/…` | descartada entera | cuenta `toquillaradio`, `derivado` |
| `tiktok.com/@usuario/photo/…` | descartada entera | cuenta `usuario`, `derivado` |

El propietario **no se adivina: esta escrito en la ruta**. Es el mismo
criterio que ya se aplicaba a `x.com/usuario/status/123` y a
`tiktok.com/@usuario/video/123`. Lo que sigue sin propietario legible
—`/p/ABC`, `/reel/ABC`, `watch?v=`, `shorts/`— sigue rechazado: declararlo
cuenta seria inventarla.

Toda cuenta derivada de una URL de contenido pasa por el clasificador. Que
`toquillaradio` sea legible no la hace del objetivo: se separa como medio.

### YouTube

Su debilidad medida —el buscador devuelve videos, no canales— se ataca con la
infraestructura existente: la propagacion pregunta
`site:youtube.com "<handle>"`, que apunta a canal y no a contenido. **Sin
scraping, sin API nueva, sin credenciales nuevas.**

### Trazabilidad

Cada consulta propagada y cada candidato que produce conservan `via`,
`handle`, `plataformaOrigen`, `cuentaOrigen`, `cuentaOrigenAtribuida`,
`origenAnalista`, `noCuentaComoCorroboracion`, query, provider y el veredicto
del clasificador con su motivo. La traza responde: *«esta cuenta aparecio
porque Sentinel propago el handle X que ya tenia en la plataforma Y»*. BUG-15
intacto.

### Riesgos asumidos y como se acotan

| Riesgo | Acotacion |
|---|---|
| Un homonimo con el mismo handle | El clasificador lo rechaza; probado con objetivo distinto y mismo handle |
| Gasto de presupuesto | Tope de 4, se omiten plataformas resueltas, va despues de las de plataforma |
| Handle del analista como evidencia | Marcado `noCuentaComoCorroboracion` |
| Propietario inventado desde contenido | Solo se extrae si esta escrito en la ruta; el resto sigue rechazado |
| Ruido por handles cortos | Menos de 3 caracteres no se propaga |

### Archivos

| Archivo | Cambio |
|---|---|
| `social/discovery/platformAdapters.js` | `normalizarSemillaHandle`, `semillasDeHandle`, PASADA 4, metadata en el plan |
| `social/discovery/socialUrlClassifier.js` | dos patrones de propietario en ruta de contenido |
| `social/discovery/discoveryEngine.js` | via y procedencia del plan al candidato y al origen |
| `social/socialIntelligenceLayer.js` | conducto del resumen |
| `osintEngine.js` | `perfil.handlesConocidos` con sus tres procedencias |
| `routes/projects.js` | handles atribuidos desde el expediente |
| `projects/projectStore.js` | la traza persiste el resumen de propagacion |
| `tests/propagacion.test.mjs` | **32 comprobaciones** (T1–T14) |

### Pruebas

| Suite | Comprobaciones |
|---|---|
| territorial | 107 |
| identidad · referencia · contexto | 19 · 19 · 28 |
| persistencia · alias | 16 · 19 |
| traza · ejecucion · cobertura | 31 · 28 · 25 |
| **propagacion** | **32** |
| **Total** | **324, 0 fallos** |

Sin red, sin cuota. Lake real intacto en 89 entradas.

### Proxima accion

Reiniciar el backend y ejecutar **una sola** investigacion de Lloret. Leer
`ultimaEjecucion.traza`: debe aparecer
`site:tiktok.com "jotalloretv"` con `via: handle_propagado`, y el veredicto
del clasificador sobre lo que devuelva.

**Benchmark de aceptacion, no de codigo**: el analista sabe que existe
`tiktok.com/@jotalloretv`. No esta escrito en ninguna parte del sistema y no
debe estarlo. Si aparece atribuido, la propagacion funciono; si aparece y se
rechaza, hay que mirar el motivo; si no aparece, el limite esta en el
proveedor.

---

## 18-terdecies. Prueba real 2026-08-25 15:58 — propagacion a medias (2026-08-25)

    investigacionId  inv-candidato-juan-cristobal-lloret-valdivieso-2026-08-25T15:58:56.031Z
    ejecutadaEn      2026-08-25T15:58:56.031Z
    totalEjecuciones 6
    expediente       v5
    delta            0 / 0 / 0
    resumen          2 cuentas · 5 medios · 33 evidencias web · huella 42

### Handle propagation: se ejecuto, con el handle equivocado

`consultasPropagadas: 4`, `propagadasTruncadas: 2`,
`handlesPropagados: ["juancristobal.lloretvaldivieso"]`.

**`jotalloretv` no se propago nunca.** Y `propagacionOmitidaPorAtribuida` salio
**vacio**, asi que dos de las cuatro consultas propagadas fueron a X y a
Facebook, que **ya tenian cuenta atribuida**.

| Plataforma | Consulta propagada | Provider | Estado |
|---|---|---|---|
| X | `site:x.com "juancristobal.lloretvaldivieso"` | — | **Error** |
| Facebook | `site:facebook.com "juancristobal…"` | — | **Error** |
| YouTube | `site:youtube.com "juancristobal…"` | — | **Error** |
| TikTok | `site:tiktok.com "juancristobal…"` | — | **Error** |

Ninguna obtuvo respuesta.

### Defecto 1 — el punto exacto donde murio

`routes/projects.js` lee `candidato.expediente?.cuentas`, y el candidato lo
obtiene con **`obtenerCandidato`**, que devuelve el registro crudo del Lake.
**Ese registro no tiene campo `expediente`**: lo ensambla
`contenidoDeProyecto`, no el lector individual.

Consecuencia: `handlesAtribuidos` llego **siempre vacio**. La unica semilla fue
la URL que escribio el analista, y por eso `atribuida` era `false` en todas,
`yaResueltas` quedo vacio y la propagacion gasto consultas en plataformas ya
resueltas en lugar de en las que faltaban.

Es un defecto introducido en `b88015c`. Ver **BUG-17**.

### Defecto 2 — la propagacion va detras del presupuesto

**8 de 14 consultas no obtuvieron respuesta.** SerpAPI agoto sus 6 intentos
(4 completadas, 2 errores) y DuckDuckGo hizo 2. Las 6 primeras —la pasada
anclada por plataforma— consumieron todo.

Las 3 de reserva por nombre y las 4 propagadas y la general: **todas Error**.

La decision de colocar la propagacion **despues** de la reserva por nombre se
tomo para no degradar ninguna consulta existente. El efecto medido es que la
propagacion **nunca llega a ejecutarse**: el presupuesto muere antes. Y las 3
de reserva que van delante tampoco aportaron nada —fallaron las tres—, asi que
estan ocupando el turno sin producir.

Aun con el handle correcto, la consulta de TikTok habria fallado igual. Ver
**BUG-18**.

### Cobertura real de las seis plataformas

| Plataforma | Estado | Res. | Descart. | Cand. | Atrib. | Lanz./OK | Proveedor |
|---|---|---|---|---|---|---|---|
| X | `ATRIBUIDA` | 10 | 0 | 10 | 1 | 3 / 1 | OK + Error |
| Facebook | `ATRIBUIDA` | 9 | 0 | 11 | 1 | 3 / 1 | OK + Error |
| Instagram | `ENCONTRADA_NO_ATRIBUIDA` | **1** | 2 | 0 | **0** | 1 / 1 | OK |
| TikTok | `ENCONTRADA_NO_ATRIBUIDA` | 1 | 0 | **1** | 0 | 2 / 1 | OK + Error |
| YouTube | `ENCONTRADA_NO_ATRIBUIDA` | 3 | 4 | 0 | 0 | 3 / 1 | OK + Error |
| LinkedIn | `ENCONTRADA_NO_ATRIBUIDA` | 2 | 0 | 2 | 0 | 1 / 1 | OK |

### Lo que SI funciono: profile-first, confirmado en produccion

TikTok produjo **1 candidato**: `tiktok.com/@segundo.cabrera82`. En la
ejecucion anterior esa misma URL era un `/photo/…` que se descartaba entera.
Ahora se extrae el propietario, entra al pipeline y el clasificador **lo
rechaza** por «no lleva el nombre del objetivo».

Es exactamente el comportamiento diseñado: la URL de contenido cede su
propietario legible, y la identidad la sigue decidiendo el clasificador.

### Las cuentas de esta ejecucion, y la que desaparecio

| Plataforma | URL | Score | Vias | Proveedores |
|---|---|---|---|---|
| X | `x.com/jotalloretv` | 62 | evidencia_fusion, consulta_dirigida | DuckDuckGo + SerpAPI |
| Facebook | `facebook.com/juancristobal.lloretvaldivieso` | 49 | handle_observado, evidencia_fusion | DuckDuckGo |

**Desaparecio `instagram.com/jotalloretv`.** En la ejecucion de las 22:14 se
habia encontrado por `evidencia_fusion` con DuckDuckGo. Esta vez la consulta de
Instagram devolvio **1 resultado** en lugar de 9, y la evidencia web no
contenia la URL del perfil. No se volvio a encontrar.

### Defecto 3 — el expediente es un snapshot, no una acumulacion

Y aqui esta el hallazgo de fondo, que explica ademas un misterio de dos dias.

`resumirExpediente` reconstruye `cuentas` desde el `perfilEjecutivo` de **esta**
ejecucion. No acumula: **reemplaza**. Una cuenta atribuida en una ejecucion
anterior **desaparece del expediente** si el proveedor no la devuelve otra vez.

Eso explica:

- 53 % → 42 % y 3 → 2 cuentas hoy;
- y la regresion **49 → 22** del 24 de agosto, que quedo sin explicar.

No era perdida de corroboracion ni un problema de agregacion: es que el
expediente no tiene memoria de sus propios hallazgos. Ver **BUG-19**, que es
el mas importante de los tres.

### La huella 42, componente a componente

| Componente | 22:14 | 15:58 |
|---|---|---|
| Cobertura de plataformas (40) | 20 — 3 de 6 | **13 — 2 de 6** |
| Solidez de la mejor correspondencia (30) | 26 — mejor 86 | **19 — mejor 62** |
| Corroboracion multiproveedor (20) | 7 — 1 de 3 | **10 — 1 de 2** |
| Declaracion (10) | 0 | 0 |
| **Total** | **53** | **42** |

Reproducido exacto. La corroboracion **subio**; lo que bajo fue la cobertura
—una cuenta menos— y la solidez, porque la mejor correspondencia cayo de 86 a
49→62 al perder Facebook uno de sus dos proveedores.

**Nada de esto es una caida politica.** Es variabilidad de proveedor, y el
expediente la convierte en perdida permanente por no acumular. Combinacion de
**variabilidad de providers + reemplazo de snapshot**.

### Diseño de producto — la tarjeta es insuficiente

Esta prueba lo confirma. El analista vio «42 %, 2 cuentas» y no pudo ver que:

- Instagram se habia encontrado ayer y hoy no;
- 8 de 14 consultas no obtuvieron respuesta;
- TikTok si devolvio un candidato, y por que se rechazo;
- Brave sigue con 0 intentos;
- ninguna plataforma esta declarada ausente.

Todo eso ya esta persistido en la traza. **Alimenta P-CAND-UX-01.**

### Estado

| | |
|---|---|
| **Handle Propagation** | ejecuta, pero con la semilla equivocada y sin presupuesto |
| **Profile-first** | **CONFIRMADO EN PRODUCCION** |
| **TikTok `@jotalloretv`** | **PROPAGACION NO SE EJECUTO** para ese handle |
| **P-CAND-01** | **REQUIERE PATCH** |

---

## 18-quaterdecies. Final Identity Stability Gate (2026-08-25)

Commits `fix(projects): preserve consolidated candidate identities` y
`fix(discovery): use consolidated identities for prioritized propagation`.

**411 comprobaciones, 0 fallos.** Sin red, sin cuota.

### La arquitectura, ahora explicita

Sentinel separa cuatro cosas que antes se confundian en una:

    1. DISCOVERY DE IDENTIDAD    descubrir de quien son las cuentas
    2. INVENTARIO CONSOLIDADO    conservar las ya atribuidas
    3. ACCOUNT INTELLIGENCE      observar que cambia en ellas   (futuro)
    4. DISCOVERY EXTERNO         menciones, medios, conversacion (futuro)

La doctrina que se implementa:

    DISCOVERY → MATCHER → ATRIBUCION → CUENTA CONSOLIDADA → MONITOREO

y la que se elimina:

    DISCOVERY → ATRIBUCION → siguiente corrida → borrar → redescubrir

### BUG-19 — causa y correccion

`resumirExpediente` reconstruia `cuentas` desde el `perfilEjecutivo` de la
ultima ejecucion. **No acumulaba: reemplazaba.**

    Antes:  cuentas: (pe?.tarjetas || []).map(...)
    Ahora:  cuentas: consolidarIdentidades(anterior, resultado, contexto)

La regla, escrita en el codigo:

> **La ausencia de observacion no revoca una identidad.**

Que un buscador no devuelva hoy una cuenta no dice nada sobre si esa cuenta es
del candidato. Dice algo sobre el buscador. Es la misma familia de error que
confundir «ausencia» con «no comprobada» —ya corregida en la cobertura por
plataforma— y faltaba aqui.

### Dos planos que no se mezclan

| Plano | Campos | Quien lo decide |
|---|---|---|
| **Identidad** | `estado` | el clasificador y el analista |
| **Observacion** | `seenInCurrentRun`, `lastSeenAt`, `lastCheckedAt` | el proveedor |

`CONSOLIDADA` + no reencontrada no es una contradiccion: es la descripcion
honesta de lo que sabemos. `lastCheckedAt` avanza porque **si** se miro;
`lastSeenAt` no, porque no se vio.

### Modelo de cuenta consolidada

Clave canonica `plataformaId:handle` normalizado. Estados:

| Estado | Significa |
|---|---|
| `DESCUBIERTA` | hallada, sin veredicto |
| `ATRIBUIDA` | el clasificador la atribuyo en esta ejecucion |
| `CONSOLIDADA` | sostenida en el inventario del proyecto |
| `DECLARADA_POR_ANALISTA` | la escribio el analista |
| `REVALIDADA` | consolidada y vuelta a observar |
| `NO_REENCONTRADA_EN_ULTIMA_VERIFICACION` | no se pudo ver esta vez |
| `REVOCADA` | retirada **por decision**, nunca por ausencia |

Historia por cuenta: `firstSeenAt`, `lastSeenAt`, `lastCheckedAt`,
`seenInCurrentRun`, `ultimaEjecucionObservada`, `proveedoresHistoricos`,
`proveedoresUltimaObservacion`, `corroboracion`, `vias`, `origen`,
`referenciaAnalista`, `noCuentaComoCorroboracion`, `evidenciaAtribucion`.

**Limite declarado, no disimulado**: los expedientes escritos antes de este
contrato no traen marcas de tiempo. Quedan en `null` con
`historiaIncompleta: true`. Inventar una fecha plausible seria un dato falso
con apariencia de dato.

**Append-only intacto.** Cada consolidacion se anexa como version nueva; nada
se reescribe. Probado.

### Un efecto secundario que habia que resolver

Con el inventario consolidado, las claves de cuenta ya no cambian cuando una
cuenta deja de reencontrarse —siguen todas—, asi que la guarda `sinCambios`
habria dejado de reescribir el expediente y `seenInCurrentRun` se habria
quedado con el valor de ayer. Se añadio una **huella del plano de
observacion** a esa comparacion.

Consecuencia visible: la primera reejecucion **si** reescribe, porque la cuenta
pasa de `ATRIBUIDA` a `REVALIDADA` —un cambio real—; la segunda ya no. La
deduplicacion se conserva sin mentir sobre el estado.

### BUG-17 — causa y correccion

`routes/projects.js` leia `candidato.expediente?.cuentas`, pero obtenia el
candidato con `obtenerCandidato`, que devuelve el registro crudo del Lake
**sin campo `expediente`**. `handlesAtribuidos` llegaba siempre vacio.

Ahora pide `inventarioConsolidado(proyectoId, "candidato", candidatoId)` al
store. Y `contenidoDeProyecto` pasa a leer el expediente con la **misma**
funcion `expedienteDe`: una sola lectura autoritativa, para que dos sitios no
discrepen sobre cual es el expediente vigente.

Verificado: el planificador recibe `jotalloretv`, **incluida** la cuenta de
Instagram que no se reencontro.

### BUG-18 — causa y correccion

La propagacion iba al final. En produccion las cuatro consultas propagadas
dieron `Error` sin proveedor: SerpAPI agotaba sus seis intentos en la pasada
anclada. Y las tres reservas por nombre que iban delante **fallaron las tres**:
ocupaban el turno sin producir.

Nuevo orden, por **valor esperado** y no por antiguedad:

| # | Pasada | Por que ahi |
|---|---|---|
| 1 | anclada por plataforma | la cobertura de las 6 es lo que no se puede perder |
| 2 | **handles propagados** a plataformas faltantes | un handle ya confirmado en dos plataformas es la pista mas fuerte |
| 3 | reserva por nombre | fallo 3 de 3 en produccion |
| 4 | general | la menos especifica |

`site:tiktok.com "jotalloretv"` pasa de la **posicion 13 a la 8**, dentro de
los 8 intentos que el presupuesto real alcanzo. **Ningun tope se subio** y
ninguna consulta existente se elimino.

### Reglas de identidad, intactas

`accountClassifier` **sin tocar**. Umbrales **sin tocar**.

    MISMO HANDLE != MISMA PERSONA

La propagacion solo genera candidatos. Probado que el mismo handle con otro
objetivo **no** se atribuye. La referencia del analista persiste, orienta y
**no corrobora**. Nada hardcodeado: ni `jotalloretv` ni `Lloret` aparecen en
el codigo.

### Preparado, no implementado

**P-CAND-UX-01**: el inventario ya distingue `DECLARADA_POR_ANALISTA` de
descubierta y de corroborada, asi que el formulario del analista podra
alimentarlo sin rehacer nada.

**Account Intelligence**: una cuenta consolidada tiene clave estable, historia
y estado, asi que puede convertirse en objetivo de monitoreo. Discovery de
identidad y monitoreo siguen siendo procesos distintos y sus datos no se
mezclan.

**Discovery no necesita redescubrir todo siempre**: las cuentas consolidadas ya
no dependen de una busqueda diaria para seguir existiendo. La reverificacion
sigue activa: actualiza `lastSeenAt`, `lastCheckedAt`, proveedores y
corroboracion, sin reconstruir la identidad.

### Pruebas

`tests/identidadConsolidada.test.mjs` — **36 comprobaciones** (T1–T16).
Cubren: la cuenta que desaparece del buscador y no del inventario; provider en
error, cero resultados y presupuesto agotado; reaparicion sin duplicar y sin
reescribir `firstSeenAt`; el inventario alimentando la propagacion; el orden
del plan; el mismo handle de otra persona rechazado; la referencia del
analista; expedientes historicos; y que el Lake sigue sin admitir `eliminar`.

| Suite | Comprobaciones |
|---|---|
| territorial | 158 |
| identidad · referencia · contexto | 19 · 19 · 28 |
| persistencia · alias | 16 · 19 |
| traza · ejecucion · cobertura | 31 · 28 · 25 |
| propagacion | 32 |
| **identidadConsolidada** | **36** |
| **Total** | **411, 0 fallos** |

Lake real intacto en 92 entradas.

### Estado

| | |
|---|---|
| **BUG-19** | **CERRADO POR CODIGO/TEST**, pendiente confirmacion real |
| **BUG-17** | **CERRADO POR CODIGO/TEST**, pendiente confirmacion real |
| **BUG-18** | **CERRADO POR CODIGO/TEST**, pendiente confirmacion real |
| **P-CAND-01** | **NO CERRADO**. Falta una unica prueba real |

---

## 18-quindecies. Validacion real 2026-08-25 17:23 (2026-08-25)

    investigacionId  inv-candidato-juan-cristobal-lloret-valdivieso-2026-08-25T17:23:55.558Z
    ejecutadaEn      2026-08-25T17:23:55.558Z
    expediente       v6
    inventario       3 cuentas · 3 observadas · 0 no reencontradas
    porEstado        REVALIDADA 2 · ATRIBUIDA 1
    huella           35

### BUG-17 — VALIDADO EN REAL

    handlesPropagados: ["jotalloretv", "juancristobal.lloretvaldivieso"]

`jotalloretv` se propago, obtenido de las cuentas consolidadas de **X** y de
**Instagram**. Antes de la correccion la lista llegaba vacia y solo se
propagaba la URL del analista.

Y la omision funciono: `propagacionOmitidaPorAtribuida` lista las seis
combinaciones de X, Facebook e Instagram con los dos handles. **Ninguna
consulta se gasto en una plataforma ya consolidada.**

### BUG-18 — VALIDADO EN REAL, con un limite que aparece detras

`site:tiktok.com "jotalloretv"` esta en la **posicion 8** del plan, **antes**
de las tres reservas por nombre (posiciones 11, 12 y 13). El reordenamiento
hizo exactamente lo que debia: de la posicion 13 a la 8.

Y por primera vez **una consulta propagada se ejecuto de verdad**:

    7. [youtube] OK  DuckDuckGo Web  6 resultados   site:youtube.com "jotalloretv"

Pero la de TikTok, inmediatamente despues, dio `Error` sin proveedor.

**El limite es de capacidad, no de orden.** SerpAPI tiene presupuesto 6 y
DuckDuckGo 2: **ocho intentos en total**. Las siete primeras consultas
—las seis de cobertura por plataforma mas la primera propagada— los agotaron.
La posicion 8 es la primera que ya no tiene proveedor que la sirva.

Reordenar era necesario y no es suficiente: **el plan pide mas de lo que la
capacidad da**. Brave sigue con **0 intentos** por falta de credencial, y es la
capacidad que falta.

### TikTok — clasificacion

**B — el proveedor fallo.** La consulta se planifico, quedo delante de las
reservas y se intento; ningun proveedor tenia capacidad para servirla.

No es A (llego al plan y se intento), no es C ni D ni E ni F: **no hubo
respuesta que clasificar**. Y por tanto **no se puede afirmar nada** sobre si
`tiktok.com/@jotalloretv` existe o de quien es. Sentinel declara lo que
observo, y aqui no observo.

### BUG-19 — no contradicho, y NO ejercitado

Las tres cuentas del inventario se observaron en esta corrida:
`noReencontradas: 0`. **Ninguna cuenta consolidada desaparecio.**

Pero hay que decirlo con precision: **la rama de preservacion no se ejercito**.
Todo se reencontro, asi que la produccion no tuvo ocasion de demostrar que una
cuenta no reencontrada sobrevive. Esta probado por test —36 comprobaciones— y
la produccion no lo contradice; no es lo mismo que confirmarlo.

`instagram.com/jotalloretv` **si esta en el inventario**, y con matiz
importante: entro como `ATRIBUIDA`, no como `REVALIDADA`. El codigo anterior la
habia **borrado** del estado vigente a las 15:58, y la consolidacion no puede
resucitar lo que ya no estaba: se reencontro y volvio a entrar como nueva. El
Lake conserva la v4 donde estaba, asi que la historia existe; lo que se perdio
en su momento fue el estado vigente, que es justo lo que BUG-19 corrige de
ahora en adelante.

### Inventario consolidado

| Plataforma | URL | Estado | Vista | Corresp. | Prov. historicos | Prov. ultima obs. | Analista |
|---|---|---|---|---|---|---|---|
| X | `x.com/jotalloretv` | REVALIDADA | si | 46 | DuckDuckGo + SerpAPI | SerpAPI | no |
| Facebook | `facebook.com/juancristobal.lloretvaldivieso` | REVALIDADA | si | 49 | DuckDuckGo | DuckDuckGo | **si** |
| Instagram | `instagram.com/jotalloretv` | ATRIBUIDA | si | 21 | DuckDuckGo | DuckDuckGo | no |

La de Facebook conserva `referenciaAnalista: true` y
`noCuentaComoCorroboracion: true`: **la declaracion del analista sigue sin
corroborar nada**, aunque un proveedor la haya devuelto.

`proveedoresHistoricos` acumula —X recuerda a los dos que la han visto— y
`proveedoresUltimaObservacion` dice quien la vio esta vez. Los dos planos,
separados y visibles.

### Dos imprecisiones detectadas, declaradas y no corregidas

**BUG-20.** X y Facebook vienen de un expediente anterior al contrato y por
tanto sin marcas de tiempo. Al reobservarlas, `firstSeenAt` tomo el instante de
**esta** corrida, de modo que afirma «vistas por primera vez hoy» cuando en
realidad se conocian desde el 24 de agosto. `historiaIncompleta: true` avisa,
pero el valor sigue siendo una suposicion con apariencia de dato. Deberia
quedarse en `null` mientras la historia sea incompleta.

**BUG-21.** La huella cayo a 35 y el motivo es instructivo: el indice lee
`corroboracion.totalProveedores`, que es **la ultima observacion**, no
`proveedoresHistoricos`. X fue devuelta hoy solo por SerpAPI, asi que su
corroboracion cuenta 1 y el componente multiproveedor bajo a 0 pese a que dos
proveedores distintos la han visto. Es la misma volatilidad de BUG-16, ahora
con una causa concreta y una solucion evidente: leer el historico. Se declara,
no se toca.

### Veredicto

**P-CAND-01 VALIDADO EN REAL.** La condicion de fallo del gate —que una cuenta
consolidada desapareciera por ausencia del proveedor— **no ocurrio**. BUG-17 y
BUG-18 quedan demostrados en produccion.

Lo que queda abierto no es un defecto de identidad: es **capacidad de
proveedores**. Ocho intentos no alcanzan para seis plataformas mas propagacion.

---

## 19. Persistencia de proyectos

✅ OPERATIVO — commit `99a632b`. Confirmado por el código:

| Elemento | Estado |
|---|---|
| `GET /api/proyectos` | ✅ lista persistida, solo activos por defecto |
| `GET /api/proyectos/:id` | ✅ proyecto + candidatos + actores + expedientes |
| Carga al montar | ✅ `useEffect` en `ProjectsModule.jsx` |
| Recuperación de candidatos | ✅ por prefijo de entidad bajo el `proyectoId` |
| Recuperación de expedientes | ✅ nombre actual y heredado |
| Deep link `?proyecto=` | ✅ y `App.jsx` abre el módulo si está presente |
| Persistencia tras Ctrl+R | ✅ verificada |
| Persistencia tras reinicio de backend | ✅ verificada |
| Recarga no dispara investigación | ✅ solo lectura |

**Causa del defecto original:** el almacenamiento nunca falló. Faltaban las
lecturas: no existía `GET /api/proyectos` y el frontend guardaba todo en
`useState` sin cargar nada al montarse.

---

## 20. Gestión del ciclo de vida

✅ OPERATIVO — commit `b2dcdc5`.

| Acción | Estado | Detalle |
|---|---|---|
| Renombrar | ✅ | solo el nombre visible; `projectId` estable; conserva `nombreAnterior` |
| Archivar | ✅ | fuera de la vista principal; conserva todo; «Ver archivados» |
| Restaurar | ✅ | desde archivados |
| Eliminar | ✅ | **borrado lógico** con modal de dos pasos |

Estados: `activo` · `archivado` · `eliminado`.
Un proyecto eliminado no aparece en Mis proyectos pero sigue recuperable con
`?estado=eliminado`. **Nada se destruye.**

Menú contextual `[…]` por tarjeta; sin botón destructivo permanente.

---

## 21. UTF-8

✅ **CORREGIDO — causa identificada, no era un defecto de código.**

**Causa:** los bytes en disco son `EF BF BD`, que es U+FFFD, el carácter de
reemplazo. El texto ya estaba corrupto **al guardarse**, no al mostrarse.

**Origen:** los registros afectados se crearon con `curl` en línea desde Git Bash
en Windows, que corrompe la tilde antes de que llegue a la aplicación.

**Verificación:** enviando bytes correctos desde un fichero (`C3 AD` = `í`), se
guarda `C3 AD` y el API devuelve `C3 AD`. El pipeline es UTF-8 limpio de extremo
a extremo. El proyecto creado desde el navegador muestra `Alcaldía de Cuenca`
correctamente.

**Solución aplicada:** detección y declaración. `listarProyectos` marca
`codificacionSospechosa` y los campos afectados; la tarjeta lo advierte. **No se
corrige por sustitución**: adivinar qué decía un texto corrupto sería inventar
datos.

Registros afectados: 4 proyectos creados durante QA. La decisión de eliminarlos
es del analista.

---

## 22. Bugs conocidos

| ID | Severidad | Módulo | Descripción | Estado | Bloquea demo | Próxima acción |
|---|---|---|---|---|---|---|
| BUG-01 | Baja | `Dashboard.jsx` | 5 errores ESLint `react-hooks/static-components`: componentes creados en render | Abierto, **preexistente** | No | Extraer los `Item` fuera del render |
| BUG-02 | Baja | `KnowledgeGraph.jsx:95` | `setState` dentro de efecto (carga del avatar) | Abierto, **preexistente** | No | Derivar el avatar sin efecto |
| BUG-03 | Media | Discovery Planner | Selección de anclas sin corroboración mínima: en modo **individual** una noticia de un homónimo extranjero desvía las 6 consultas. **Intermitente** | Abierto | No | Exigir corroboración ≥2 o ancla geográfica |
| BUG-04 | Baja | 4 proyectos de QA | Texto con U+FFFD en `dignidad` y `tipoEleccion` | Declarado (§21) | No | Decisión del analista: eliminar o recrear |
| BUG-05 | Media | `KnowledgeGraph.jsx` | Grafo radial: no hay relaciones entre nodos | Abierto | No | Aristas cuenta↔medio y cuenta↔cuenta |
| BUG-06 | Baja | `PlausibleIdentitiesPanel.jsx` | «Investigar esta identidad» presente sin acción conectada | Abierto | No | Conectar reinvestigación con la evidencia del grupo |
| BUG-07 | Media | `projects/projectContext.js:134` | `nivelPorDefecto` compara contra `prefectura` / `presidencia` (el cargo), pero el analista escribe `Prefecto` / `Presidente` / `Asambleísta` (la persona). **Todas** las dignidades en forma personal caen a `cantonal`, y en un proyecto provincial o nacional sin `nivel` declarado la provincia o el país se quedan en fuerza 6 —por debajo del umbral de evidencia— y **no llegan a ser ancla**. Detectado en LÍNEA A (§18-bis) | Abierto, **no corregido: fuera de la autorización L-1/L-2/L-3** | No | Aceptar la forma personal de cada dignidad, o exigir `nivel` explícito en el formulario |
| BUG-21 | Media | `social/executive/executiveProfile.js` `indiceHuellaDigital` | El componente de corroboracion multiproveedor lee `corroboracion.totalProveedores`, que refleja **la ultima observacion**, no `proveedoresHistoricos`. En la validacion real X fue devuelta solo por SerpAPI y su corroboracion conto 1, bajando el componente a 0, pese a que DuckDuckGo y SerpAPI la han visto ambos. Es la causa concreta de la volatilidad de BUG-16 (§18-quindecies) | Abierto, **declarado y no corregido** | No | Contar los proveedores historicos, no los de la ultima corrida |
| BUG-20 | Baja | `services/projects/projectStore.js` `consolidarIdentidades` | Una cuenta que viene de un expediente anterior al contrato no tiene `firstSeenAt`; al reobservarla toma el instante de la corrida actual, afirmando «vista por primera vez hoy» cuando se conocia desde antes. `historiaIncompleta: true` avisa, pero el valor es una suposicion con apariencia de dato (§18-quindecies) | Abierto, **declarado y no corregido** | No | Dejar `firstSeenAt` en `null` mientras `historiaIncompleta` sea true |
| BUG-19 | **Crítica** | `services/projects/projectStore.js` `resumirExpediente` | **CERRADO POR CODIGO/TEST** (§18-quaterdecies), pendiente confirmacion real. Descripcion original: El expediente **reemplaza** sus cuentas con las de la ultima ejecucion en lugar de acumularlas. Una cuenta atribuida antes **desaparece** si el proveedor no la devuelve otra vez. Explica 53 % → 42 % con 3 → 2 cuentas (§18-terdecies) **y la regresion 49 → 22 del 24 de agosto que quedo sin explicar**. El Lake conserva las versiones, asi que nada se pierde en disco: lo que se pierde es el estado vigente que ve el analista | Abierto | **Sí: borra hallazgos reales** | Acumular cuentas por clave plataforma+handle conservando la ultima vez que se observo cada una, y declarar las no reencontradas en vez de borrarlas |
| BUG-18 | **Alta** | `social/discovery/platformAdapters.js` orden del plan | **CERRADO POR CODIGO/TEST** (§18-quaterdecies), pendiente confirmacion real. Descripcion original: La propagacion de handles va detras de la reserva por nombre y **el presupuesto muere antes de llegar**: en la prueba real las 4 propagadas dieron Error, igual que las 3 de reserva que van delante y no aportaron nada. 8 de 14 consultas sin respuesta. La colocacion se eligio para no degradar consultas existentes; el efecto medido es que la pasada nueva no se ejecuta nunca (§18-terdecies) | Abierto | **Sí: la propagacion no llega a probarse** | Adelantar la propagacion por delante de la reserva por nombre, que ya fallo tres de tres, sin subir topes globales |
| BUG-17 | **Alta** | `routes/projects.js` | **CERRADO POR CODIGO/TEST** (§18-quaterdecies), pendiente confirmacion real. Descripcion original: Lee `candidato.expediente?.cuentas` para construir `handlesAtribuidos`, pero obtiene el candidato con `obtenerCandidato`, que devuelve el registro crudo del Lake **sin campo `expediente`** —lo ensambla `contenidoDeProyecto`—. `handlesAtribuidos` llega siempre vacio: `jotalloretv` nunca se propago y la unica semilla fue la URL del analista, que al no estar `atribuida` dejo `yaResueltas` vacio y gasto consultas en X y Facebook, ya resueltas. Introducido en `b88015c`, detectado en §18-terdecies | Abierto, **es el patch siguiente** | **Sí: anula la propagacion** | Leer las cuentas del expediente con la misma via que `contenidoDeProyecto`, o pasarlas ya resueltas a la ruta |
| BUG-16 | Media | Interfaz — indice de huella digital | La huella salto de 22 % a 53 % entre dos ejecuciones del mismo dia, y **+17 de los +31 vienen de que un buscador respondiera** una consulta que antes bloqueo: la cuenta de Facebook paso de 1 a 2 proveedores y su correspondencia de 25 a 86. El calculo es correcto y el indice mide lo que dice medir —amplitud y solidez de la presencia DOCUMENTADA—, pero un numero tan volatil presentado como «53 %» junto al nombre de un candidato invita a leerse como respaldo politico. Detectado en §18-undecies | Abierto | No | Mostrar los cuatro componentes junto al total, etiquetar que NO mide, y declarar la cobertura de proveedores de esa ejecucion |
| BUG-15 | **Alta** | `services/projects/projectStore.js` `candidatosSociales` / `coberturaNormalizada` | **CERRADO Y CONFIRMADO EN PRODUCCION** (§18-undecies). Descripcion original: | Dos defectos de fidelidad de la traza. **(1)** `candidatosSociales()` lee `resultado.social.candidatos`, campo que `socialIntelligenceLayer` no expone —devuelve `fichas`—, asi que la lista de candidatos y sus motivos de rechazo sale SIEMPRE vacia: en la reprueba real, 24 de 26 candidatos rechazados sin motivo registrado. **(2)** `coberturaNormalizada()` decide `BUSCADA_SIN_RESULTADO` mirando solo si hubo consulta con exito y cero candidatos, sin mirar los RESULTADOS: Instagram devolvio 10 resultados —todos publicaciones, no perfiles— y quedo etiquetada como si la busqueda hubiera vuelto vacia. Colapsa «no habia nada» con «habia contenido, no perfiles», que es lo que el contrato de cinco estados existe para evitar. Detectado en §18-nonies | Abierto, **es el patch siguiente** | **Si: sin esto no se puede decidir si el matcher pierde cuentas** | Leer `social.fichas` y derivar la procedencia de `origenes`; contar resultados en la normalizacion |
| BUG-14 | Media | `services/projects/projectStore.js` `resumirExpediente` / diferencial | `clavesCuenta` —la clave con la que el diferencial deduplica hallazgos— se deriva de `clasificacionCuentas.cuentasObjetivo`, mientras `cuentas` viene de `perfilEjecutivo.tarjetas`. Dos fuentes para la misma cosa: si divergen, el delta de cuentas sale mal. Detectado al implementar BUG-13 (§18-octies) | Abierto, **preexistente, declarado y no corregido**: tocarlo era cambiar la deduplicacion, excluida de la autorizacion | No | Derivar ambas de la misma fuente |
| BUG-13 | **Alta** | `services/projects/projectStore.js` `registrarInvestigacion` | **CERRADO POR CODIGO/TEST** (§18-octies), pendiente confirmacion real. Descripcion original: | La guarda `sinCambios` omite `escribirEnLake` cuando coinciden tres campos del resumen (claves de cuenta, numero de medios, evidencias web). Tras el patch de BUG-12 eso **descarta la traza de auditoria completa** en cualquier reejecucion que no cambie el resumen, que es exactamente cuando la traza se necesita. Demostrado en la reprueba real de Lloret (§18-septies): la investigacion corrio, gasto cuota y no escribio nada. Ademas la guarda es redundante —el Lake ya detecta la escritura redundante por hash del contenido completo— y al mirar solo tres campos puede omitir cambios reales en `huellaDigital`, `instituciones` o `evidenciasSociales` | Abierto, **es el patch siguiente** | **Si: impide diagnosticar cualquier reprueba** | Dejar que el Lake decida la redundancia por hash y reservar `sinCambios` solo para el mensaje al analista |
| BUG-11 | **Alta** | `apps/web/src/components/ProjectsModule.jsx` `investigar()` | **CERRADO POR CODIGO/TEST** (§18-sexies), pendiente confirmacion visual real. Descripcion original: | Al terminar una investigacion se parchea el candidato en memoria con `resultado`, `cobertura`, `cuentas` y `expediente`, pero **no con `estadoInvestigacion`**, que es el campo del que dependen el boton y la insignia «Investigacion completada». El porcentaje tiene respaldo (`c.resumen?.huellaDigital ?? c.cobertura`); el estado no. Resultado: los numeros se actualizan y el boton sigue diciendo «Investigar candidato». **Provoca gasto de cuota duplicado**: en el piloto el analista volvio a pulsar y Lloret se investigo dos veces (§18-quinquies) | Abierto, **causa raiz demostrada, no corregido** | No, pero **gasta cuota** | Escribir `estadoInvestigacion: "completada"` y `resumen` en el parche, o recargar el contenido del proyecto tras investigar |
| BUG-12 | **Alta** | `services/projects/projectStore.js` `resumirExpediente` | **CERRADO POR CODIGO/TEST** (§18-sexies), pendiente confirmacion en ejecucion real. Descripcion original: | El expediente **descarta la traza de auditoria que el motor ya calculo**: no persiste consultas ejecutadas, cobertura por plataforma, trazas del Discovery ni candidatos rechazados (`perfilEjecutivo.indeterminadas` y `coberturaPlataformas` se producen y se tiran). Sin logs en disco, una investigacion no se puede diagnosticar despues: no hay forma de saber si una plataforma se busco y no habia nada, o no se busco. Bloqueo el diagnostico de la regresion de Lloret (§18-quinquies) | Abierto, **no corregido** | **Si, para diagnosticar pilotos** | Persistir consultas, cobertura por plataforma y rechazados con su motivo. Es la doctrina de `ausencia` != `no_comprobada` aplicada al expediente |
| BUG-10 | Media | `apps/web/src/services/aliasMemory.js` `esAliasValido` | Exige que el alias contenga el **ultimo** token del nombre (`partes[partes.length-1]`) —el defecto exacto que L-1 corrigio en el backend— y su comentario afirma «misma regla que el clasificador», que ya es **falso**. Para `Juan Cristobal Lloret Valdivieso` exigiria `valdivieso` y rechazaria `Jota Lloret`, el propio ejemplo del encabezado del modulo. Detectado al cerrar el gate de alias (§18-quater) | Abierto, **no corregido: frontend, fuera del patch alias -> planner** | No | Reutilizar la zona de apellidos de L-1, o subir la validacion al backend |
| BUG-09 | **Alta** | `projects/projectStore.js` `crearProyecto` | El id se deriva del nombre (`idDesde`) y **no se comprueba si ya existe**. Crear un proyecto cuyo nombre coincida con uno eliminado escribe una versión nueva de la MISMA entidad: el proyecto **resucita a `activo` heredando candidatos, actores y expedientes**, y con ellos cualquier dato corrupto previo. Reproducido en lake aislado durante el reset (§18-ter) | Abierto, **evitado con un id explícito, no corregido** | **Sí, para cualquier reset futuro** | Rechazar la creación si el id existe —incluso eliminado— y ofrecer recuperar o usar otro id. No resucitar en silencio |
| BUG-08 | Baja | `social/discovery/discoveryEngine.js:398` | `planificarConsultasSociales` está exportada y **nadie la llama**: el motor planifica con `planificarConsultasDerivadas`. Cubre 3 de 6 plataformas (deja fuera X, YouTube y LinkedIn) y no aplica anclas. Si alguien la conectara creyendo que es el planificador, perdería la mitad de la cobertura. Fijado por prueba en `tests/contexto.test.mjs` | Abierto, **no corregido: archivo congelado** | No | Eliminarla o marcarla como obsoleta en una limpieza autorizada |

BUG-03 **queda cerrado en modo proyecto** por el Contexto Maestro (§9); sigue
abierto en modo individual, donde no hay contexto del analista. L-3 (§18-bis)
**no lo cierra**: destila las anclas que el proyecto ya declara, y en modo
individual deja el comportamiento anterior intacto a propósito.

---

## 23. Pendientes críticos

### P0 — bloquea prueba/demo
*Ninguno detectado.* La gestión de proyectos, la persistencia y el UTF-8 están
resueltos y verificados.

### P1 — necesario para MVP
| Pendiente | Estado |
|---|---|
| Prueba real de candidato en proyecto con semilla del analista | 🔴 planificada, ver §24. **Tubería corregida y probada sin cuota (§18-bis); los pilotos de Paúl, Lloret, Pedro y Yaku NO se han ejecutado** |
| Regresion de cobertura social de Lloret: 49 -> 22 respecto al historico | 🔴 **NO EXPLICADA**. La cuenta de Facebook perdio sus dos proveedores. Filtro de L-2 exonerado por prueba. Falta traza de auditoria (BUG-12) |
| Persistir la traza de auditoria del expediente | 🟢 **BUG-12 CONFIRMADO EN PRUEBA REAL** como mecanismo (§18-nonies), con dos defectos de fidelidad en BUG-15 |
| Estado de investigacion en la interfaz | 🟢 **BUG-11 CERRADO**, confirmado en prueba real |
| La guarda `sinCambios` descartaba la traza en reejecuciones | 🟢 **BUG-13 CONFIRMADO EN PRUEBA REAL** (§18-nonies) |
| La traza lee un campo inexistente y etiqueta mal una plataforma | 🟢 **BUG-15 CONFIRMADO EN PRODUCCION** (§18-undecies) |
| Huella digital volatil segun la respuesta del proveedor | 🔴 **BUG-16**: 22 % → 53 % en el mismo dia, +17 por un buscador que contesto. Riesgo de lectura politica |
| TikTok recibe una sola consulta, sin pasada de reserva | 🔴 la propagada existio pero con el handle equivocado y dio Error. Ver BUG-17 y BUG-18 |
| Profile-first: propietario legible en ruta de contenido | 🟢 **CONFIRMADO EN PRODUCCION** (§18-terdecies): `@segundo.cabrera82` entro como candidato y el clasificador lo rechazo |
| `site:youtube.com` devuelve videos, no canales | 🟡 **Handle Propagation** pregunta por handle, que apunta a canal. Pendiente prueba real |
| **P-CAND-UX-01 Identidad Asistida por Analista** | 🔴 en cola. **La prueba del 25-ago lo confirma como necesario**: el analista vio «42 %, 2 cuentas» sin poder ver que Instagram se hallo ayer y hoy no, que 8 de 14 consultas no respondieron, ni por que se rechazo el candidato de TikTok. Todo eso ya esta en la traza |
| Zona horaria America/Guayaquil en la interfaz | 🔴 en cola |
| Brave / fallback de proveedores | 🔴 sin credencial: 0 intentos en las dos ultimas ejecuciones |
| Account Intelligence | 🔴 en cola |
| Snapshots historicos | 🔴 en cola |
| Media Intelligence | 🔴 en cola |
| Public Conversation Intelligence | 🔴 en cola |
| Indice de Presencia e Incidencia Digital | 🔴 en cola |
| Momentum | 🔴 en cola |
| Change Attribution | 🔴 en cola |
| Sentinel AI Assistant / Pregúntale a Sentinel | 🔴 en cola |
| Cobertura dependiente de un solo proveedor | 🔴 DuckDuckGo bloqueo 2/2 y Brave sigue sin credencial: el presupuesto de SerpAPI se agota en la primera pasada |
| `clavesCuenta` y `cuentas` derivan de fuentes distintas | 🔴 **BUG-14**, preexistente, declarado y no corregido |
| **P-CAND-01** — estabilidad de identidad | 🟢 **VALIDADO EN REAL** (§18-quindecies). Ninguna cuenta consolidada desaparecio |
| El expediente borraba cuentas ya atribuidas si no se reencontraban | 🟡 **BUG-19**: no contradicho en real, pero la rama de preservacion **no se ejercito** (todo se reencontro). Probado por test |
| `handlesAtribuidos` llegaba vacio a la propagacion | 🟢 **BUG-17 VALIDADO EN REAL**: `jotalloretv` propagado desde X e Instagram |
| La propagacion nunca alcanzaba el presupuesto | 🟢 **BUG-18 VALIDADO EN REAL**: TikTok de la posicion 13 a la 8, y una propagada se ejecuto |
| **Capacidad de proveedores insuficiente para el plan** | 🔴 **P0 nuevo**. 8 intentos totales (SerpAPI 6 + DuckDuckGo 2) no alcanzan para 6 plataformas mas propagacion. Brave sigue con 0 intentos por falta de credencial. Es el unico bloqueo real de la cobertura de 6 plataformas |
| `tiktok.com/@jotalloretv` | 🔴 **no observado**: la consulta se intento y ningun proveedor tenia capacidad. No se puede afirmar nada sobre esa cuenta |
| Reverificacion programada de cuentas consolidadas | 🔴 la arquitectura lo soporta; la politica de cuando revisar no esta definida |
| Verificar en piloto real que Pedro Palacios recibe candidatos al Discovery | 🔴 su grupo guardado no contenía ninguna URL con `palacio`; L-1 no podía cambiarlo |
| Verificar Paúl Carrasco Carpio con búsqueda real | 🔴 no existe grupo guardado; el mecanismo está probado en unitario |
| Expediente visual completo del candidato dentro del proyecto | 🔴 hoy solo hay resumen |
| Comparación entre candidatos con más de una dimensión | 🟡 cobertura y cuentas |
| Histórico / evolución del expediente | 🔴 el Lake versiona; no hay vista |
| UI de resultados de correlación observable | 🟡 motor listo, sin vista |
| Territorial con fuentes oficiales | 🔴 ver §14 |

### P2 — mejora posterior
| Pendiente | Estado |
|---|---|
| Evidencia auditable en todos los paneles | 🟡 en foto, cuentas y confianza; no en medios ni temas |
| Índice de cobertura del proyecto (agregado) | 🔴 |
| Relaciones en el Knowledge Graph | 🔴 BUG-05 |
| Errores ESLint preexistentes | 🟡 BUG-01, BUG-02 |
| Selección de identidad plausible | 🔴 BUG-06 |
| Alias que alimenten el planificador del backend | 🟡 **cerrado para los alias DECLARADOS** (§18-quater): expediente → ruta → motor → PASADA 3 del planificador. Sigue abierto que los alias *aprendidos* en el navegador se reutilicen solos |
| Alias aprendidos en el navegador que se reutilicen sin intervención | 🔴 `aliasMemory` es `localStorage` y de presentación; nadie los sube al backend |
| `esAliasValido` usa la regla de apellido anterior a L-1 | 🔴 **BUG-10**, declarado en §18-quater y no corregido |
| `nivelPorDefecto` no reconoce las dignidades en forma personal | 🔴 BUG-07, declarado en LÍNEA A y no corregido |
| `planificarConsultasSociales` huérfana y con cobertura parcial | 🔴 BUG-08, declarado en LÍNEA A y no corregido |
| `crearProyecto` resucita proyectos eliminados al coincidir el nombre | 🔴 **BUG-09**, declarado en el reset §18-ter y no corregido |
| El Lake no tiene forma de purgar por proyecto | 🔴 append-only por diseño. Si alguna vez se necesita de verdad, exige decisión de arquitectura: lápida versionada, o retención por partición. **No añadir `eliminar` al adaptador** |
| Credencial de Brave | 🔴 externa al equipo |

---

## 24. Próxima prueba real — PLAN, no ejecutada

> **No ejecutar durante la creación de este documento.**

**Proyecto:** Elecciones Alcaldía Cuenca 2027
País Ecuador · Provincia Azuay · Cantón Cuenca · Dignidad Alcaldía de Cuenca ·
Tipo Elección seccional

**Primer candidato:** Pedro Palacios
**Semilla:** nombre + rol declarado por el analista + URL de Facebook aportada
por el analista.

**Objetivo:** comprobar descubrimiento real en Facebook, Instagram, X, TikTok,
YouTube y LinkedIn; y después identidad, foto, alias, cuentas, medios, menciones,
temas, grafo, cobertura y evidencias.

**Coste estimado:** 6 búsquedas SerpAPI por investigación.

---

## 25. Actor de referencia — prueba posterior

**Daniel Noboa** · actor de referencia · nivel nacional · territorio Ecuador.

Secuencia:
1. Agregarlo con `incluirEnComparativo` **OFF** → comprobar que los candidatos
   no cambian, y que su ámbito de perfil es Ecuador y no Cuenca.
2. Activar **ON** → comprobar que aparece un análisis separado de correlación
   observable y que el expediente base de los candidatos no se modifica.

Reglas: el actor **no** se convierte en candidato, **no** aparece en la lista de
candidatos y **no** altera automáticamente la cobertura ni el grafo de nadie.

---

## 26. Decisiones de arquitectura (ADL)

**ADR-001 — Knowledge Lake persistente en fichero**
Decisión: adaptador `fichero` por defecto en `apps/backend/data/knowledge-lake/`.
Motivo: los expedientes deben sobrevivir al reinicio sin infraestructura externa.
Estado: Vigente. Commit: `99a632b` (verificado).

**ADR-002 — Aislamiento por `projectId` en la clave del Lake**
Decisión: clave `tenantId::proyectoId::tipoEntidad::entidad`.
Motivo: el aislamiento entre proyectos debe ser estructural, no un filtro que
alguien pueda olvidar.
Estado: Vigente. Commit: `d964999`.

**ADR-003 — La cuenta semilla la aporta el analista y no se asciende**
Decisión: `cuenta_referencia` con `origen: analista` y
`verificadaPorSentinel: false`.
Motivo: Sentinel no puede atribuirse una conclusión que tomó una persona.
Estado: Vigente. Commit: `d964999`.

**ADR-004 — Separación candidato / actor de referencia**
Decisión: prefijos de entidad distintos (`candidato-`, `actor-`) y expedientes
separados por tipo.
Motivo: un actor no puede colarse en la lista de candidatos por accidente si no
está guardado ahí.
Estado: Vigente. Commit: `00b94d2`.

**ADR-005 — Contexto según el nivel territorial del actor**
Decisión: el ancla territorial depende del nivel declarado; el resto del
territorio queda por debajo del umbral de evidencia.
Motivo: acotar a un presidente por cantón devuelve su relación con ese cantón, no
su perfil.
Estado: Vigente. Commit: `00b94d2`.

**ADR-006 — El sistema no confirma identidades**
Decisión: techo `probable`; `confirmado`/`descartado` solo por analista; tope
absoluto 97 exigido por el validador.
Motivo: la certeza absoluta no es una salida legítima de un sistema de
inferencia.
Estado: Vigente. Commit: `707a254`.

**ADR-007 — Evidencia antes que inferencia**
Decisión: `ausencia` ≠ `no_comprobada`; `bloqueado` ≠ `0 resultados`; `null` ≠ `0`.
Motivo: confundirlos hace que el analista lea «no existe» donde el sistema solo
puede decir «no lo sé».
Estado: Vigente. Transversal.

**ADR-008 — La cobertura no es intención electoral**
Decisión: tooltip obligatorio y declaración explícita en el panel y en la
comparación.
Motivo: un porcentaje junto al nombre de un candidato invita a leerlo como
apoyo electoral.
Estado: Vigente. Commit: `bc8e64c`.

**ADR-009 — Correlación observable, nunca causal**
Decisión: la salida incluye una lista `noImplica` en el propio contrato.
Motivo: la prohibición debe estar en el dato, no solo en la documentación.
Estado: Vigente. Commit: `00b94d2`.

**ADR-010 — Un solo motor, dos modos**
Decisión: `investigarObjetivo(objetivo, opciones)`; sin `opciones` es modo
individual, con `contextoMaestro` es modo proyecto.
Motivo: dos motores divergirían.
Estado: Vigente. Commit: `d964999`.

Documentos formales previos: `docs/adr/ADR-000-01`, `docs/adr/ADR-033-01`,
`docs/architecture/Protocolo-Universal-de-Investigacion.md`.

---

## 27. Commits importantes

Verificados con `git log`. Todos existen.

| Commit | Fecha | Descripción | Módulo |
|---|---|---|---|
| `b2dcdc5` | 2026-08-24 | Ciclo de vida del proyecto y diagnóstico UTF-8 | Proyectos |
| `99a632b` | 2026-08-24 | Persistencia y recuperación de proyectos | Proyectos · Lake |
| `00b94d2` | 2026-08-23 | ARQ-INV-003: contexto por nivel, UI de proyectos, identidades plausibles | Proyectos · Identidad |
| `9dbb831` | 2026-08-23 | Byte NUL en `projectContext` | Proyectos |
| `d964999` | 2026-08-23 | ARQ-INV-002: modos de investigación y contexto electoral | Proyectos · Motor |
| `bc8e64c` | 2026-08-23 | Índice de cobertura, auditoría de descubrimiento, deep link | UX · Auditoría |
| `c65d680` | 2026-08-23 | Búsqueda, grafo, dashboard y confianza explicable | UX · Motor |
| `bd3e33f` | 2026-08-22 | Unificación del encabezado | Branding |
| `bc4dc06` | 2026-08-22 | Logo oficial del búho | Branding |
| `f1efbe2` | 2026-08-22 | Branding oficial | Branding |
| `21efab8` | 2026-08-22 | ARQ-PUI-001: Protocolo Universal de Investigación | Motor |
| `961e98c` | 2026-08-20 | Nodo de grafo por cuenta | Grafo |

---

## 28. Estado de sesiones paralelas

**LÍNEA A — Proyectos · Persistencia · Gestión**
Estado: comiteada hasta `b2dcdc5`. Árbol limpio en sus archivos.
Archivos propios: `routes/projects.js`, `services/projects/**`,
`services/identity/plausibleIdentities.js`, `components/ProjectsModule.jsx`,
`components/PlausibleIdentitiesPanel.jsx`.

**LÍNEA B — Inteligencia Territorial**
Estado: 🟡 **sin comitear y en desarrollo activo**. Modifica `server.js` y añade
`routes/territorio.js`, `services/geo/**`, `services/conversation/**` y salidas
de ejemplo (`an.json`, `an2.json`, `an3.json`, `srv.log`).

⚠️ Estos archivos aparecieron y cambiaron mientras se generaba este documento.
Su recuento exacto puede diferir: comprobar con `git status`.

### ⚠️ Advertencia de integración

**No modificar simultáneamente archivos compartidos sin integración
controlada.** Atención especial a:

| Archivo | Riesgo actual |
|---|---|
| `apps/backend/server.js` | 🔴 **modificado por LÍNEA B ahora mismo** |
| `apps/web/src/App.jsx` | 🟡 tocado por LÍNEA A; la UI territorial lo necesitará |
| `apps/web/src/components/Sidebar.jsx` | 🟡 el menú es «definitivo»; añadir entradas exige acuerdo |

Antes de integrar LÍNEA B: comitear o guardar sus cambios, y revisar `server.js`
en conjunto.

---

## 29. Reglas de desarrollo

1. **No inventar datos.** Si no hay evidencia: «No comprobado».
2. **No confirmar identidades automáticamente.** El techo es `probable`.
3. **Toda conclusión importante conserva su evidencia** (fuente, fecha, motivo).
4. **Diferenciar dato, inferencia y declaración del analista.**
5. **No consumir APIs durante QA estructural** cuando no sea necesario.
6. **No modificar componentes congelados** sin autorización explícita.
7. **No destruir el Knowledge Lake** durante pruebas. Borrado lógico siempre.
8. **No hacer `git reset`** para resolver conflictos sin autorización.
9. **Español como idioma funcional**; la marca permanece en inglés.
10. **Sentinel Intelligence** es el nombre de marca y no se traduce ni se
    duplica con variantes.

---

## 30. Checklist para nueva sesión

**ANTES DE MODIFICAR CÓDIGO:**

```
[ ] Leer SENTINEL_PROJECT_STATE.md
[ ] Ejecutar git status
[ ] Revisar rama
[ ] Revisar último commit
[ ] Identificar archivos modificados
[ ] Identificar componentes congelados (§17)
[ ] Confirmar módulo de trabajo
[ ] Evitar conflictos con la otra sesión (§28)
[ ] Confirmar si la tarea consume APIs
[ ] Confirmar criterios de QA
```

---

## 31. Protocolo de actualización

Después de cada sprint importante:

1. actualizar la fecha;
2. actualizar el último commit;
3. marcar capacidades (✅ 🟡 🔴 🔒);
4. registrar bugs nuevos;
5. cerrar bugs resueltos;
6. actualizar pendientes (P0/P1/P2);
7. registrar decisiones nuevas en el ADL;
8. registrar pruebas;
9. actualizar el próximo paso.

**No reescribir historia.** Añadir al historial, no sustituirlo.

---

## Historial del documento

| Fecha | Commit | Cambio |
|---|---|---|
| 2026-08-25 | validacion real 17:23 | **P-CAND-01 VALIDADO EN REAL.** Ninguna cuenta consolidada desaparecio: inventario de 3, todas observadas. BUG-17 validado —`jotalloretv` propagado desde las consolidadas de X e Instagram, y ninguna consulta gastada en plataforma ya resuelta—. BUG-18 validado: TikTok por handle pasa de la posicion 13 a la 8 y una propagada se ejecuto por fin (`site:youtube.com "jotalloretv"`, 6 resultados). BUG-19 no contradicho pero NO ejercitado: todo se reencontro. El bloqueo restante es de CAPACIDAD de proveedores: 8 intentos no alcanzan para 6 plataformas mas propagacion, y Brave sigue sin credencial. BUG-20 y BUG-21 declarados sin corregir. Nueva §18-quindecies. |
| 2026-08-25 | Identity Stability Gate | Implementado el inventario consolidado: una cuenta atribuida ya no desaparece porque un buscador no la devuelva. `estado` habla de identidad; `seenInCurrentRun`, `lastSeenAt` y `lastCheckedAt`, de observacion. NO_REENCONTRADA no es REVOCADA. BUG-17 cerrado leyendo el inventario autoritativo en lugar de un campo inexistente; BUG-18 reordenando el MISMO planificador por valor esperado, con la consulta de TikTok de la posicion 13 a la 8 y sin subir topes. Clasificador y umbrales sin tocar. 411 pruebas, 0 fallos. Nueva §18-quaterdecies. |
| 2026-08-25 | prueba real 15:58 | La propagacion se ejecuto —4 consultas— pero con la semilla equivocada: `handlesAtribuidos` llega vacio porque la ruta lee un campo que el lector crudo no tiene (BUG-17), asi que `jotalloretv` nunca se propago y dos consultas fueron a plataformas ya resueltas. Las cuatro dieron Error: el presupuesto muere antes de llegar a la pasada nueva (BUG-18). Profile-first CONFIRMADO en produccion: `@segundo.cabrera82` entro como candidato y el clasificador lo rechazo. Y el hallazgo de fondo: el expediente REEMPLAZA sus cuentas en vez de acumularlas, asi que `instagram.com/jotalloretv` desaparecio al no reencontrarse — esto explica 53→42 y tambien la regresion 49→22 del 24 de agosto (BUG-19, critico). Nueva §18-terdecies. |
| 2026-08-24 | Handle Propagation | Los handles atribuidos, observados y declarados se normalizan, deduplican y propagan a las plataformas sin cuenta, en el MISMO planificador y sin tocar el clasificador ni los umbrales. Plan de Lloret de 10 a 14 consultas, ninguna eliminada; tope de 4 propagadas con truncamiento declarado. Profile-first: dos huecos cerrados —propietario legible en ruta de contenido de Instagram y foto de TikTok—; watch/shorts y /p/ sin propietario siguen rechazados. Regla MISMO HANDLE != MISMA PERSONA probada con objetivo distinto. 324 pruebas, 0 fallos. Nueva §18-duodecies. |
| 2026-08-24 | ejecucion real 22:14 | Full Discovery diagnosticado con traza completa: 29 candidatos, 26 rechazos con motivo, 16 descartes, 6 plataformas. 3 cuentas, 6 medios, 40 evidencias, delta +1/+1/+14, huella 53. Cuenta nueva `instagram.com/jotalloretv`, hallada por la capa web y no por la consulta dirigida. `tiktok.com/@jotalloretv` NO fue encontrado: TikTok recibe una sola consulta. LinkedIn no es Matcher: los 2 candidatos no son el objetivo. BUG-12, BUG-13 y BUG-15 confirmados en produccion. BUG-16 abierto por volatilidad de la huella. Nueva §18-undecies. |
| 2026-08-24 | hotfix BUG-15 | Traza fiel. Los candidatos se leen de `clasificacionCuentas`, que trae veredicto y procedencia juntos; `aportadaPorAnalista` y `viasDeclaradas` se derivan de los origenes. La cobertura cuenta los resultados del buscador: Instagram con 10 enlaces y ningun perfil ya no se etiqueta como ausencia. Los fixtures anteriores probaban una proyeccion en lugar de la estructura del motor —la misma raiz del bug— y se reescribieron con la forma real, reforzando las aserciones. 292 pruebas, 0 fallos. Nueva §18-decies. |
| 2026-08-24 | P-CAND-01 reprueba | Primera traza real de las seis plataformas. BUG-11, BUG-12 y BUG-13 confirmados en prueba real. Instagram devolvio 10 resultados, todos publicaciones: SD-1A hizo bien su trabajo. YouTube bloqueado por proveedor. Pero `candidatosSociales` sale vacio porque lee un campo inexistente, asi que 24 de 26 rechazos no tienen motivo registrado y LinkedIn (2 candidatos, 0 atribuidos) no es verificable. BUG-15 registrado como unico patch siguiente. Nueva §18-nonies. |
| 2026-08-24 | hotfix BUG-13 | Separados hallazgo y ejecucion. El expediente sigue deduplicando; la ejecucion se guarda siempre, en entidad propia identificada por su instante autoritativo, sin aleatoriedad y sin duplicar hallazgos. Delta cero convive con ejecucion registrada y traza persistida. BUG-14 declarado sin corregir. 267 pruebas, 0 fallos. Nueva §18-octies. BUG-11 cerrado, BUG-12 y P-CAND-01 en reprueba real. |
| 2026-08-24 | P-CAND-01 lectura | Reprueba real leida. La traza NO se persistio: la guarda `sinCambios` de `registrarInvestigacion`, anterior a BUG-12, omitio la escritura porque el resumen no cambio. La investigacion corrio y gasto cuota. BUG-13 registrado como unico patch siguiente. BUG-11 y BUG-12 vuelven a NO CONFIRMADO en prueba real. La pregunta de las 2 cuentas sigue sin respuesta. Nueva §18-septies. |
| 2026-08-24 | GATE P-CAND-01 | BUG-12 y BUG-11 cerrados por codigo y test. El expediente persiste consultas, cobertura por plataforma en contrato de cinco estados, candidatos rechazados con motivo y consumo por proveedor. La interfaz recarga el estado autoritativo tras investigar. 239 pruebas, 0 fallos. Nueva §18-sexies. Pendiente reprueba real de Lloret. |
| 2026-08-24 | piloto Paul + Lloret | Diagnostico sin cuota. Las dos investigaciones terminaron; Lloret se ejecuto DOS veces por BUG-11, cuya causa raiz queda demostrada. Cobertura 14 vs 22 reproducida exactamente: el indice mide dimensiones, no volumen. L-1 y L-2 verificados en produccion. Regresion de Lloret 49 -> 22 NO explicada; filtro de L-2 exonerado por prueba. BUG-11 y BUG-12 registrados. Nueva §18-quinquies. |
| 2026-08-24 | alias → planner | Pendiente crítico verificado ABIERTO y cerrado para los alias declarados: cadena expediente → ruta → motor → PASADA 3, sin planner paralelo. Los alias amplían el Discovery y no verifican identidad. BUG-10 declarado sin corregir. Nueva §18-quater. 208 pruebas, 0 fallos. |
| 2026-08-24 | reset pre-piloto | Retirados los 6 proyectos de prueba con la API oficial y creado `alcaldia-cuenca-2027-piloto` con baseline cero verificado. **0 entradas del Lake eliminadas**: es append-only por diseño. BUG-09 encontrado y evitado: crear el nombre pedido habría resucitado un proyecto eliminado con 4 candidatos. Snapshot en `docs/auditorias/SNAP-001`. Nueva §18-ter. |
| 2026-08-24 | LÍNEA A | Tubería de identidad corregida: L-1 zona de apellidos, L-2 semilla de referencia sin autoverificación, L-3 contexto destilado. Nueva §18-bis. BUG-07 y BUG-08 declarados sin corregir. 189 pruebas sin cuota, 0 fallos. Pilotos reales NO ejecutados. |
| 2026-08-24 | `b2dcdc5` | Creación del documento maestro de continuidad. Estado verificado por inspección del repositorio: 4 routers, 12 endpoints de proyecto, 14 componentes congelados existentes, Knowledge Lake en fichero con persistencia verificada, LÍNEA B territorial sin integrar. |
