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

## 13-quinquies. Open Topic Discovery + Geo Foundation — GATE C2 (2026-08-25)

✅ **Descubrimiento abierto**, sin taxonomía previa.

### La decisión arquitectónica

```
ANTES                          AHORA
categorías predefinidas   →    corpus observado
   ↓                              ↓
búsquedas temáticas            OPEN TOPIC DISCOVERY
   ↓                              ↓
"estos son los temas"          clusters descubiertos
                                  ↓
                               TOPIC ENGINE 2 (organiza)
```

Las categorías **ayudan a organizar** lo descubierto. Ya no deciden por sí solas qué existe.

### Por qué hacía falta — auditado

| Titular | Categoría en las 12 declaradas |
|---|---|
| «Lluvias e inundaciones anegan calles» | **ninguna** |
| «Festival de artes escénicas» | **ninguna** |
| «Sismo se sintió en la madrugada» | **ninguna** |

Un motor que solo mirase la taxonomía respondería «en Cuenca se habla de gestión pública» **el día de una inundación**.

### Dos falsos positivos por polisemia, corregidos

| Titular | Antes | Ahora |
|---|---|---|
| «Deportivo Cuenca ganó el **partido**» | Proceso electoral | sin categoría → descubierto como *Deportivo Cuenca* |
| «**Corte** de energía eléctrica» | Agua y saneamiento | sin categoría |

El término no se elimina del léxico: se exige que **no sostenga la categoría él solo**. Con un segundo término de la misma categoría, la asignación vuelve.

### Señales de descubrimiento

Entidades nombradas · bigramas frecuentes · coocurrencia. **Sin dependencias nuevas.**

Se evaluó incorporar *embeddings* y se descartó por dos motivos: un cluster semántico no puede explicar **por qué** agrupó (IA1), y un modelo que se actualiza rompe la reproducibilidad que exige Replay.

### Ejemplo verificado

```
Deportivo Cuenca      3 docs · 3 fuentes · entidad nombrada
lluvias·inundaciones  3 docs · 3 fuentes · coocurrencia
festival artes        2 docs · 2 fuentes · bigrama
sismo                 1 doc  → NO forma tema
```

### Geo Intelligence Foundation

| Pieza | Fichero |
|---|---|
| Geolocalización formal de evidencia | `geo/evidenceGeolocation.js` |
| Zonas analíticas | `geo/analyticalZones.js` |
| Tema × territorio | `geo/topicTerritoryCrosstab.js` |
| Contratos de capas futuras | `contracts/futureLayers.js` |

**Seis métodos de geolocalización** declarados por evidencia. **Multi-territorio**: `territorioDetectado` + `mencionesTerritoriales[]` — «El Vado y Las Herrerías, en Cuenca» conserva las tres.

**Zonas analíticas: registro VACÍO.** No existe división oficial Norte/Sur de Cuenca. Se entrega la capacidad de definirlas, con criterio, autor y fecha obligatorios. `unidadOficial: false` siempre. Geometría solo derivada si **todas** las hijas tienen polígono — media zona pintada sugiere que el resto no tiene actividad.

### Contratos declarados, cero implementación

`DIGITAL_BEHAVIOR` (agregado, nunca individual) · `VENTANAS_COMPARABLES` · `CANDIDATE_OVERLAY` (solo lectura) · `CAMPAIGN_DECISION` · **`DATA-PROVIDER-EVAL-01`**

### Sesgo de recolección — declarado, no resuelto

De las 4 consultas por defecto, **2 llevan vocabulario de gestión pública**. El corpus llega inclinado. C2 no lo corrige; lo que hace es no añadir un **segundo** sesgo al interpretar.

---

## 13-sexies. Agenda / Radar + Mapa verificado — GATE D + F1 (2026-08-25)

✅ La pantalla responde **«¿qué está pasando en Cuenca?»**, no «¿qué categorías existen en la base?».

### La agenda fusiona dos orígenes

Un mismo asunto puede llegar **descubierto** por el corpus, **clasificado** por la taxonomía, o las dos cosas. `geo/territorialAgenda.js` los une **cuando comparten ≥ 60 % de sus evidencias** —por índices, que es un hecho, no por parecido de etiqueta, que sería una interpretación— y conserva de dónde vino cada uno.

Un tema descubierto **sin categoría no se esconde**. Es justo el hallazgo que C2 existe para no perder.

### Actividad observada — fórmula abierta, sin score opaco

```
actividad = 0.50 · evidencias_norm
          + 0.35 · fuentes_norm
          + 0.15 · recencia
```

| Peso | Por qué |
|---|---|
| evidencias 0.50 | señal más directa de que algo se publica |
| fuentes 0.35 | veinte notas de un medio no son veinte de ocho; sin este peso, un medio insistiendo encabezaría la agenda |
| recencia 0.15 | sin ventana comparable, la recencia dice **cuándo** se publicó, no si crece |

Normaliza contra el **máximo del propio lote**: interesa el orden dentro de esta observación, no una escala absoluta que no existe. **No se muestra como puntuación**: ordena, y las tres dimensiones se enseñan por separado.

**Umbral absoluto antes que el relativo** (≥ 2 evidencias **y** ≥ 2 fuentes). En un lote donde todo es débil, el mejor de los débiles no es «alta actividad»: es señal insuficiente.

### Estados permitidos

`alta actividad observada` · `actividad media` · `actividad baja` · `señal insuficiente`

**«Emergente», «creciendo» y «viral» quedan prohibidos** hasta que exista ventana anterior. La comprobación de interfaz los rechaza salvo cuando aparecen **negados**.

> Un uso real detectado y corregido: `TopicsPanel` etiquetaba como «emergente» el
> origen `origen !== "lexico"`. En el motor esa palabra significa **procedencia**
> —«hallado sin léxico previo»—; en pantalla se lee como **tendencia**. Se
> renombró la etiqueta visible a **«descubierto en el corpus»**. El contrato del
> motor no cambió.

### El mapa: cómo un mapa correcto salió vacío

Primera captura real: `unidadesPintables: 0`, `evidenciasFueraDelMapa: 30`.

No era un fallo de dibujo. GEO-1 retiene a nivel **cantón** casi toda la evidencia de prensa —una nota provincial no autoriza a bajar a parroquia— y **el cantón no tiene polígono**: CONALI publica parroquias y cabeceras, no contornos cantonales.

Resuelto con la regla ya escrita para zonas analíticas: **geometría derivada solo si todas las hijas tienen polígono**. El cantón se compone como `MultiPolygon` de sus 22 parroquias y **viaja marcado**:

```
geometriaDerivada: true    poligonosOrigen: [22 ids]
```

| Registro | Antes | Ahora |
|---|---|---|
| unidades con polígono **propio** | 22 | 22 |
| unidades **dibujables** | 22 | **23** |
| de ellas derivadas | 0 | **1** |

En la interfaz un límite derivado se dibuja con **contorno discontinuo** y el pie declara: *«unión declarada, no un polígono publicado por la institución»*.

Con evidencia real: **27 de 30 evidencias dentro del mapa**; fuera quedan Azuay (provincia, sin polígono) y Machángara (parroquia urbana, sin polígono). Ambas aparecen en **«lugares mencionados sin geometría disponible»**: un mapa que omite en silencio media ciudad sugiere que allí no pasa nada.

### Tres estados de relleno, no intercambiables

| Estado | Tratamiento |
|---|---|
| muestra suficiente | color de la rampa |
| **muestra insuficiente** | hachurado, **nunca rampa** |
| sin evidencia | hachurado «sin dato» |

La rampa se calcula **solo** con las unidades que superan el umbral: si entrasen las de muestra insuficiente, dos evidencias sueltas moverían los cuantiles y recolorearían a las que sí tienen respaldo. Es el mismo error que produjo la penetración del 238 % que originó GEO-1.

> Defecto encontrado al alinear mapa y ranking: el mapa coloreaba por
> `evidencias > 0` e **ignoraba `sePinta`**, así que pintaba con color pleno lo
> que el ranking marcaba en gris.

### Sesgo de consulta: promovido a siempre visible

Estaba plegado tras «ver más». Esta limitación no matiza un dato suelto: **inclina la agenda entera**. Si el corpus se pidió con vocabulario de gestión, que la gestión encabece no es un hallazgo, es un eco de la consulta.

Las limitaciones que siguen plegadas **se anuncian con su número**. Una limitación que el usuario no sabe que existe es una limitación no declarada.

### Conducta digital — bloque desactivado

Enumera las dimensiones que tendría (móvil/desktop, Android/iOS, franja horaria) **sin un solo valor**, y declara que *el dispositivo no se infiere*: que una nota salga en una app no dice desde qué teléfono la leyó nadie.

### Sin MapLibre, por ahora

UX-WR-001 especifica MapLibre para el War Room completo. Para F1 hay 22 polígonos de un cantón en EPSG:4326: SVG con proyección equirectangular corregida por latitud da el mismo resultado a esta escala y evita megabytes de dependencia. **El agregado que alimenta el mapa no cambia** cuando entre MapLibre.

### Ficheros

| Pieza | Fichero |
|---|---|
| Agenda + radar + mapa (motor) | `geo/territorialAgenda.js` |
| Cabecera ejecutiva · aviso · conducta | `territorio/panels/{ExecutiveHeader,CoverageWarning,DigitalBehaviorPanel}.jsx` |
| Agenda · radar · detalle de tema | `territorio/agenda/{AgendaPanel,RadarPanel,TopicDrawer}.jsx` |
| Mapa · sin geometría · panel de unidad | `territorio/map/{TerritorialMap,PlacesWithoutGeometry,TerritoryPanel}.jsx` |

### Pruebas

| Suite | Resultado |
|---|---|
| `territorial.test.mjs` | **160** ✅ |
| `territorial-c2.test.mjs` | **53** ✅ |
| `territorial-d.test.mjs` | **39** ✅ |
| `web/tests/ssr-render.check.jsx` | **82** ✅ |

La comprobación de interfaz **no es una captura**: renderiza React en servidor con la respuesta **real** de la API (`web/tests/payload-real.json`, 30 evidencias, coste 0) y verifica lo que un ojo no verifica automáticamente —que no aparezca «0 habitantes», que ningún porcentaje se presente como penetración, que las limitaciones estén visibles—. **No** verifica color, espaciado ni jerarquía visual: eso sigue requiriendo validación humana.

Ninguna prueba consulta la red ni consume cuota.

---

## 13-septies. Open Listening Foundation — GATE D2 (2026-08-25)

✅ Se corrige **la entrada**, no el ranking.

### El problema, medido antes de tocar nada

| | |
|---|---|
| consultas del plan | **4** |
| con vocabulario de gestión | **2 de 4 = 50 %** |
| evidencia entrada por ellas | **14 de 30 = 47 %** |
| motores que aportaron algo | **1 de 6** (Google News RSS) |
| «fuentes» declaradas | 7 — pero la mayor era **YouTube**, una plataforma, con el 40 % |

El motor descubría que «en Cuenca se habla de gestión pública». Se le estaba preguntando eso.

> Maquillar el ranking habría falsificado dos veces: una al pedir el corpus inclinado y otra al disimularlo.

### Query Planner — de 4 consultas fijas a un generador

`conversation/queryPlanner.js`. Seis tipos declarados: `NEUTRAL` · `TEMÁTICA` · `ACTOR` · `INSTITUCIONAL` · `MEDIA` · `CREATOR`.

| | antes | ahora |
|---|---|---|
| consultas | 4 | **9** |
| neutrales | 2 (50 %) | **6 (67 %)** |
| con gestión | 2 (50 %) | 2 (22 %) — **declaradas** `INSTITUCIONAL` |
| temáticas por defecto | — | **ninguna** |

Las neutras van **primero** porque los motores tienen tope de consultas: lo que va delante es lo que se ejecuta. `hoy`, `noticias`, `actualidad`, `qué pasa` son marcadores de recencia y de género, no de tema: no inclinan hacia gestión, ni hacia deporte, ni hacia cultura.

**El ancla territorial sigue siendo obligatoria.** «Cuenca» a secas devuelve Cuenca de España.

**Solo el corpus neutral sostiene la Agenda General.** El dirigido responde a una pregunta que alguien formuló. Cada evidencia registra **todas** las consultas que la trajeron: sin eso, una nota que aparece en la neutral y en la institucional se clasificaría según el orden de ejecución del plan en vez de según los hechos.

### Source Universe — quién habla y cómo lo sabemos

`conversation/sourceUniverse.js`. Ocho tipos, cinco estados, procedencia acumulada.

```
DESCUBIERTA → OBSERVADA → VERIFICADA
                INACTIVA · BLOQUEADA
```

**Descubrir no es verificar.** Una fuente observada 20 veces sigue en `OBSERVADA`; solo un catálogo con respaldo o un analista **con autor y motivo** la mueven a `VERIFICADA`. Si el descubrimiento se autoverificara, el registro sería un espejo de la recolección en lugar de una fuente de verdad.

**Una plataforma no es un emisor.** YouTube alojando doce vídeos no son doce fuentes ni una fuente: es una plataforma con doce emisores sin identificar.

`usoComercialPermitido: null` **bloquea igual que `false`**. Lo que no se ha comprobado no se puede afirmar.

### Source Classifier — con razones, y con derecho a no decidir

`conversation/sourceClassifier.js`. Ocho clases; `NO_DETERMINADO` es un resultado válido.

| señal | confianza | por qué |
|---|---|---|
| declaración de analista (con autor) | 0.95 | manda sobre todo |
| `.gob.ec` | 0.92 | hecho administrativo: solo el Estado lo registra |
| catálogo semilla | 0.80 | no contrastado contra registro oficial de medios |
| plataforma conocida | 0.85 | → `WEB_PUBLICA`, **nunca** `CREADOR` |
| señal de comunidad declarada | 0.55 | nombre o dominio de la propia fuente |
| `.org` | 0.45 | lo registra cualquiera |

**No hay umbral de seguidores.** «Más de N seguidores = creador» parece objetivo y no lo es: N no sale de ningún sitio, y el recuento ni siquiera se lee.

**`CIUDADANIA_COMUNIDAD` designa una fuente colectiva observable**, nunca a un individuo que «represente» a la ciudadanía. `clasificarPersona()` devuelve `NO_DETERMINADO` por diseño.

> Dos defectos corregidos durante la implementación. El clasificador consultaba la **URL** de Google News en lugar del dominio del publicador ya resuelto: las seis fuentes de prensa salían `NO_DETERMINADO` y el reparto por clase se perdía entero. Y el sufijo débil `.org` se evaluaba **antes** que la señal explícita de comunidad, así que un colectivo vecinal salía `ORGANIZACION` y la agenda ciudadana quedaba vacía con una fuente ciudadana delante.

### Entity ≠ Topic — el defecto que la validación visual destapó

`conversation/entityTopicSeparation.js`.

```
ANTES                          AHORA
01 Marisol Peñaloza  4ev       01 elecciones seccionales  3ev
02 elecciones secc.  3ev       02 denuncian falta         3ev
03 denuncian falta   3ev       03 Gestión y gobernanza    2ev
04 Gestión y gob.    2ev
                               ENTIDADES OBSERVADAS
                               Marisol Peñaloza (persona)
                                 → aparece en: Gestión y gobernanza
```

El primer puesto no era un tema: era una **persona**. Un nombre propio es un sujeto sin predicado, y además los nombres propios son la señal más discriminante del corpus —por eso el descubridor los usa—, así que tienden a encabezar **siempre**. El resultado era una agenda llena de nombres que escondía los asuntos.

**La corrección no es borrar.** La entidad conserva sus evidencias, se muestra en su propio bloque y declara **con qué temas aparece**. Se pierde un puesto en un ranking equivocado y se gana la relación, que es lo que un analista usa.

| entidad | ¿puede ser tema? |
|---|---|
| `PERSON` · `ORGANIZATION` · `PLACE` | **no** |
| `EVENT` | **sí** — «el paro de noviembre» es evento y tema |

El **gazetteer manda sobre la morfología**: «Santa Ana» parece nombre de persona y es una parroquia de Cuenca.

> Defecto encontrado al medirlo sobre el corpus real: la persona se separaba de los temas **descubiertos** y volvía a entrar por los **clasificados**, donde el Topic Engine 2 la emite como `emergente-marisol`. Filtrar una sola rama es no filtrar. Ahora se separan las dos y las entidades se deduplican por nombre.

### Diversidad — volumen no es diversidad

`conversation/sourceDiversity.js`. Herfindahl-Hirschman **normalizado**, calculado solo sobre **emisores** (las plataformas quedan fuera).

Sobre el corpus real: **7 «fuentes» → 6 emisores + 1 plataforma**. HHI 0.178 (moderada), dominante El Mercurio con el 30 %.

Toda proporción se etiqueta **«% del corpus observado»**. Nunca «% de la ciudadanía»: convertir publicaciones en porcentaje de personas es el error del 238 % que originó GEO-1, trasladado de la geografía a la audiencia.

Concentración alta **no es un defecto**: si un solo medio cubre el cantón, eso es un hecho del territorio. Lo que no se puede es llamarlo diverso.

### Cinco agendas separadas

Reparto real del corpus de Cuenca:

| agenda | evidencias | fuentes | % |
|---|---|---|---|
| Mediática | 18 | 6 | 60 % |
| Digital | 12 | 1 | 40 % |
| **Ciudadana** | **0** | — | — |
| **Institucional** | **0** | — | — |
| **Creadores** | **0** | — | — |

**Tres agendas a cero.** Sin este panel esa composición no se ve y la pantalla parece hablar de la ciudad entera.

> **Vacío no es silencio.** Que la agenda ciudadana esté a cero no significa que la ciudadanía calle: significa que ninguna consulta trajo una fuente comunitaria. Es una carencia de la **observación**, no un hallazgo sobre el territorio. Se dice con esas palabras, en la interfaz y en `coverageLimitations`.

«Agenda digital» significa **«llegó por plataforma sin emisor identificado»**, no «lo que se dice en redes».

### Snapshots — acumular desde hoy

`territorial/snapshotStore.js`. Append-only, JSONL particionado, mismo patrón que el Knowledge Lake. **No existe `writeFile` en el módulo.**

Entra en este gate y no en E1 por una razón de calendario, no de arquitectura:

> Google News no da archivo histórico. La ventana anterior de Cuenca **no se puede recuperar: hay que acumularla.** Cada día sin guardar snapshots es una comparación que ya no se podrá hacer nunca. Si el almacén empezara con E1, E1 nacería ciego.

Guarda la **forma** del corpus, no el corpus. No es cuestión de espacio: guardar las 30 notas invitaría a recalcular el pasado con la lógica de hoy, y entonces la comparación mediría cambios del código, no del territorio.

Una corrección se **anexa** como snapshot nuevo que declara a cuál sustituye. El original permanece.

La **huella** excluye el instante: dos capturas idénticas en contenido comparten huella, y eso permite decir «no ha cambiado nada» en lugar de «no lo sé».

### Ventanas comparables — la mitad que impide inventarlas

`24h · 7d · 15d · 30d · 90d`. Sin ventana anterior: **`SIN_VENTANA_COMPARABLE`**, `variacion: null`.

La forma de la respuesta es **la misma exista o no** la ventana: un consumidor que lea `variacion` sin comprobar `disponible` lee `null`, no un número inventado. No se compara contra otra duración ni contra otro territorio.

### Matriz de proveedores — declarado ≠ integrado ≠ aportó

`providers/providerAudit.js`, leída del registro real.

| | |
|---|---|
| declarados | 6 |
| implementados | 5 |
| integrados (con credencial) | 3 |
| **aportaron evidencia** | **1** |
| sin coste conocido | 3 |

Las 30 evidencias vinieron de Google News RSS. Un panel que dijera «4 proveedores configurados» mentiría por omisión.

**`costoPorConsulta: null` significa NO SE SABE y se propaga** a `costoEstimadoEjecucion`. No se rellena con precios de lista, no se estima por comparación y no se pone 0 «porque no hemos pagado». Un coste inventado se convierte en la base de una decisión de compra. Sin traza de ejecución, `enUso` sale `null`, que no es lo mismo que `false`.

### DATA-PROVIDER-EVAL-01 — estructura de benchmark

`contracts/providerBenchmark.js`. Caso fijo **BENCH-CUENCA-01**: mismo territorio, mismas consultas ancladas, misma ventana. Sin caso fijo, comparar proveedores es comparar anécdotas.

**19 métricas.** La que decide es **coste por evidencia útil**: integra volumen, calidad y precio. Un proveedor que devuelve 500 resultados de los que 480 son duplicados o hablan de Cuenca de España es peor que uno que devuelve 40 útiles.

**13 candidatos**, ninguno contratado ni integrado. De ninguno se afirma que funcione bien en Ecuador: eso es lo primero que el benchmark tendría que demostrar. Todas las fichas con **todas las métricas en `null`** — un benchmark sin ejecutar no es un benchmark con resultado cero.

Tres incógnitas que el benchmark debería resolver primero:

- **YouTube Data API** — el 40 % del corpus llega por ahí sin emisor identificado; es el mayor hueco de identificación que hay hoy.
- **RSS directos de medios locales** — la opción más barata y la que más elevaría la diversidad: leer El Mercurio directamente resuelve el publicador sin rescatarlo del sufijo del titular.
- **GDELT** — tiene archivo histórico, que es justo lo que falta; por medir su cobertura de prensa local ecuatoriana.

### AI Router — auditoría primero

**Sentinel no usa hoy ningún modelo de lenguaje.** Comprobado sobre el árbol de servicios y `package.json`: axios, cors, dotenv, express, rss-parser, whois-json. **Cero** llamadas a Anthropic, OpenAI, Google o cualquier proveedor de IA.

Todo lo que parece inteligencia —descubrimiento de temas, encuadre, separación entidad/tema, geolocalización— es determinista y explicable por construcción.

`contracts/aiRouter.js` define el contrato `AIProviderAdapter` y **ocho tareas**, cada una con:

- `reemplazaDeterminista: false` — se aplica **encima** de un resultado que ya existe
- `puedeCrearHechos: false` — **sin excepción y sin campo para cambiarlo**
- `degradaA` — qué pasa si no hay proveedor; sin ruta de degradación, no puede integrarse

> Un modelo puede **etiquetar, resumir y explicar**. No puede **decidir qué existe**: un tema que solo un modelo encuentra no es reproducible y no sostiene un informe.

`elegirProveedor()` **no elige a nadie sin métricas medidas**. Un proveedor sin medir es un proveedor desconocido, y ese es hoy el estado de los tres que se nombran en cualquier conversación sobre IA. Fiabilidad primero, latencia después, coste como desempate: un modelo barato que devuelve JSON inválido el 10 % de las veces cuesta más en revisión de lo que ahorra.

**AI-EVAL-01** registrada como pendiente. Criterio eliminatorio: **alucinación**. Criterio menos comparable y más importante aquí: **español de Ecuador** — «parroquia», «cantón», «prefecto» y «GAD» significan cosas concretas y un modelo entrenado sobre español peninsular las lee mal.

> Hoy Sentinel funciona sin IA. Eso no es una carencia que tapar: es la línea base contra la que cualquier integración tiene que demostrar mejora.

### Ficheros

| Pieza | Fichero |
|---|---|
| Generador de consultas | `conversation/queryPlanner.js` |
| Registro de fuentes | `conversation/sourceUniverse.js` |
| Clasificación de fuente | `conversation/sourceClassifier.js` |
| Entidad ≠ tema | `conversation/entityTopicSeparation.js` |
| Diversidad y agendas | `conversation/sourceDiversity.js` |
| Snapshots append-only | `territorial/snapshotStore.js` |
| Matriz de proveedores | `providers/providerAudit.js` |
| Benchmark | `contracts/providerBenchmark.js` |
| Contrato de IA | `contracts/aiRouter.js` |
| Interfaz | `territorio/agenda/{EntitiesPanel,SourceAgendasPanel}.jsx` |

`conversationHarvester.planificarConsultas` **delega** en el nuevo planificador; no se duplicó el recolector ni se añadió un adaptador.

### Pruebas

| Suite | |
|---|---|
| `territorial.test.mjs` | **160** ✅ |
| `territorial-c2.test.mjs` | **53** ✅ |
| `territorial-d.test.mjs` | **39** ✅ |
| `territorial-d2.test.mjs` | **92** ✅ |
| `web/tests/ssr-render.check.jsx` | **97** ✅ |

**441 comprobaciones.** Ninguna consulta la red ni consume cuota.

---

## 13-octies. INGEST-REAL-01 — adquisición multifuente (2026-08-25)

✅ Sentinel deja de depender de una sola búsqueda.

### El diagnóstico, medido antes de tocar nada

> La arquitectura analítica estaba más avanzada que la capacidad de adquisición.

| | |
|---|---|
| motores declarados | 6 |
| **motores que aportaron algo** | **1** — Google News RSS |
| techo bruto | 4 consultas × 8 resultados = **32** |
| «fuentes» | 7 → **6 emisores + 1 plataforma** |
| corpus sin emisor identificado | **12 de 30 (40 %)** |
| agendas a cero | 3 de 5 |

### Lo que ya existía y NO se duplicó

**Brave estaba enteramente implementado** contra su API oficial; solo le faltaba credencial. `rss-parser` ya era dependencia. `nearDuplicate.js` y `normalizarUrl` —con limpieza de UTM— ya existían. Source Universe, snapshots y Knowledge Lake, también.

`googleNewsService.js` lo comparte `osintEngine` (Línea A) y **no se tocó**: su tope de 8 resultados es el techo de 32, y el adapter RSS se construyó aparte en lugar de modificarlo.

### Contrato común de evidencia

Con un proveedor, el formato del proveedor *era* el de la evidencia. Con seis, cada uno trae su vocabulario:

```
Google News   title, link, contentSnippet, pubDate
Brave         title, url, description, age
YouTube       snippet.title, id.videoId, publishedAt
GDELT         title, url, seendate, domain
RSS directo   title, link, summary|content, published
```

Sin contrato común, la deduplicación entre proveedores es imposible: no hay campo sobre el que comparar. `rawMetadataReference` conserva de dónde salió cada campo — la normalización no puede ser un embudo que tira la procedencia.

**Política de almacenamiento** por defecto: `SOLO_REFERENCIA`. Un titular y un enlace son cita; el artículo entero puede no serlo. Si nadie ha comprobado que se puede guardar el texto, no se guarda.

### Deduplicación multifuente — la pieza que no puede fallar

La misma nota puede llegar por cinco proveedores. **Eso no son cinco evidencias**, y no es un detalle de limpieza: sin dedup, cada proveedor añadido **infla** el corpus sin aportar nada y todas las métricas se mueven por razones ajenas al territorio. Peor: las fuentes independientes subirían, porque cinco proveedores parecerían cinco puntos de vista.

| criterio | fuerza |
|---|---|
| URL canónica idéntica | certeza |
| URL normalizada idéntica | certeza práctica |
| mismo dominio + título ≥ 0.88 | muy probable |
| **título ≥ 0.88 en dominios distintos** | **sindicación, NO duplicado** |

El cuarto es el delicado. Que El Universo y Expreso publiquen la misma nota de agencia **no** las convierte en la misma evidencia: son dos medios que decidieron publicarla, y esa decisión es información. Se marcan `sindicadas` y se conservan las dos.

> Un duplicado es la misma publicación vista dos veces. Dos medios publicando lo mismo son dos publicaciones.

`providersSeenBy[]` y `sourceObservations[]` no se borran nunca: cinco proveedores trayendo la misma nota es **corroboración**, y es el dato que el benchmark necesita para saber qué aporta cada uno de nuevo.

### Adapters

| adapter | credencial | qué aporta |
|---|---|---|
| **RSS directo** | ninguna | el publicador **no se adivina: es el feed**. Resuelve el problema de Google News |
| **YouTube Data** | `YOUTUBE_API_KEY` | convierte «vino de YouTube» en «lo publicó este canal» |
| **GDELT DOC 2.0** | ninguna | el único con **archivo histórico** por rango cerrado |
| **Brave** | `BRAVE_API_KEY` | ya estaba implementado; ahora declarado en la matriz |

**RSS no adivina rutas.** Probar `/rss`, `/feed`, `/rss.xml` es el patrón de peticiones que un servidor lee como escaneo, y produce falsos positivos (muchos sitios devuelven 200 con una página de error). Un feed entra cuando el sitio lo **declara** en `<link rel="alternate">` o cuando lo aporta un analista. Si no hay, el medio queda `SIN_RSS` —que es un hecho, no un fallo— y **no se sustituye por raspado**.

`SIN_RSS` ≠ `INACCESIBLE`: la primera es del medio, la segunda puede ser nuestra.

**YouTube separa plataforma de emisor.** El `sourceId` de un vídeo es `youtube:UC_canal`, no `youtube.com`. Doce vídeos pasan de ser «una fuente» a doce emisores. El país del canal es una **declaración del canal**, no una localización: no autoriza a atribuir territorio. Los suscriptores se leen porque son públicos pero **no clasifican**: no hay umbral defendible de «influencer». No se leen comentarios.

Coste de YouTube: **10.000 unidades/día, una búsqueda cuesta 100**. No es dinero, es presupuesto.

**GDELT se implementó pese a la duda**, por tres razones: la API es pública y sin contrato (deuda baja), sin adapter no hay forma de medir la duda, y devuelve `domain` en cada resultado, así que **mide su propia cobertura local** sin trabajo extra. Si el benchmark demuestra que no cubre Azuay, se desactiva y la ficha queda como prueba de que se comprobó.

> GDELT responde **200 con HTML** cuando la consulta está mal formada. Sin detectarlo, un error de sintaxis se leería como «cero resultados» — la misma confusión que el Search Provider Layer existe para evitar.

### Media Source Registry

`conversation/mediaRegistry.js` es un catálogo semilla y responde «¿qué es elmercurio.com.ec?». Lo que no puede hacer es **acumular**: no guarda qué feeds tiene un medio, ni cuándo se comprobó, ni si el intento falló. Sin eso, cada ejecución redescubre todo desde cero.

**`lastCheckedAt` es la razón de ser del módulo**, y protege una distinción:

```
lastSeenAt     la última vez que el medio PUBLICÓ
lastCheckedAt  la última vez que Sentinel MIRÓ
```

Confundirlas convierte «no hemos mirado» en «no ha publicado».

### Scheduler — contrato, sin proceso continuo

La ingesta continua tiene un modo de fallo caro y silencioso: un job mal configurado gasta cuota de madrugada y nadie se entera hasta que las investigaciones fallan por falta de saldo. Con SerpAPI eso es un **saldo mensual compartido con el Discovery Engine**.

Frecuencia mínima por proveedor, y **se eleva** en lugar de rechazar el job:

| proveedor | mínimo | por qué |
|---|---|---|
| RSS directo | 1 h | la prensa local no publica más a menudo |
| Google News | 3 h | ventana móvil: cada hora devuelve casi lo mismo |
| GDELT | 6 h | límite de tasa |
| YouTube · Brave | 12 h | cuota / credencial de pago |
| **SerpAPI** | **24 h** | saldo mensual compartido |

Un **hueco de ingesta** no es un periodo sin actividad: es un periodo sin observación.

### Coverage observability

> **La ausencia de cobertura tiene que ser visible.**

Tres estados que no son el mismo:

```
se preguntó y no había  →  ausencia observada     ← el único que autoriza «no hay»
se preguntó y falló     →  ausencia de lectura
no se preguntó          →  ausencia de pregunta
```

Verificado en ejecución real: **«6 de 6 proveedores no respondieron. NO se puede afirmar que algo no exista: solo que no llegó.»** — 7 huecos declarados.

### E1 Temporal Foundation

Dos formas de no poder comparar, y la segunda es la que se pasa por alto:

- `SIN_VENTANA_COMPARABLE` — no existe la ventana anterior
- **`HISTORICO_INSUFICIENTE`** — existe, pero cubre menos del 80 % del periodo

Si el primer snapshot es de hace tres días y se pide una ventana de 30, hay ventana anterior *técnicamente*, pero cubre el 10 %. Tratarlo como comparación válida es **peor** que no comparar: da un número con aspecto de tendencia calculado sobre casi nada.

Estado real hoy: **5 de 5 ventanas con histórico insuficiente**. El histórico empieza con el primer snapshot y no se reconstruye; un hueco no se interpola, porque interpolar produciría una serie creíble que nadie observó.

**Recencia no es crecimiento.** Que algo se publique hoy no dice que esté creciendo.

### Defecto encontrado en la propia auditoría

La matriz de proveedores deducía la credencial del **estado del registro**. Los proveedores que no pasan por la Search Provider Layer —YouTube entre ellos— tienen `estado: null`, ninguna cadena decía «sin configurar», y la matriz los daba por **integrados sin tener clave**. Exactamente lo que ese módulo existe para impedir.

Corregido: ahora se comprueba el entorno de verdad. Resultado honesto: **5 integrados, 3 bloqueados por credencial**.

Y dos más, encontrados por T31:

- `mediaRegistryCuenca.js` cableaba el territorio en el **nombre del fichero** sin tener una sola línea específica de Cuenca → `mediaSourceRegistry.js`
- la ficha de GDELT lo cableaba en **nombres de campo** (`coberturaCuenca`, `relevanciaCuenca`) → `coberturaTerritorio`, `relevanciaTerritorial`

### Benchmark antes / después

La línea base **está medida, no estimada**: es el corpus real del 2026-08-25 guardado en `apps/web/tests/payload-real.json`. Un benchmark cuyo punto de partida se recuerda de memoria mide lo que uno quiere que haya mejorado.

La comparación se hace sobre **evidencias únicas** y **emisores identificados**, no sobre volumen bruto: si las 30 nuevas son las mismas 30 vistas por otro proveedor, el corpus no ha crecido.

`tasaDuplicado` va a **subir**, y está bien: significa corroboración.

**Sin ejecutar** — faltan las dos credenciales.

### Seguridad

`.env.example` con **solo nombres**, nunca valores. `.gitignore` llevaba `.env.*`, que también ignoraba la plantilla: se añadió la excepción `!.env.example`.

### Ficheros

| Pieza | Fichero |
|---|---|
| Contrato de evidencia | `ingest/evidenceContract.js` |
| Dedup multifuente | `ingest/crossProviderDedup.js` |
| Orquestador | `ingest/ingestOrchestrator.js` |
| Registro de medios | `ingest/mediaSourceRegistry.js` |
| Scheduler | `ingest/collectorScheduler.js` |
| Cobertura | `ingest/coverageObservability.js` |
| Adapters | `ingest/adapters/{rss,youtube,gdelt}Adapter.js` |
| Ventanas E1 | `territorial/temporalWindows.js` |
| Benchmark ingesta | `contracts/ingestBenchmark.js` |
| Viabilidad social | `contracts/socialPlatformFeasibility.js` |

### Pruebas

| Suite | |
|---|---|
| `territorial` · `-c2` · `-d` · `-d2` | 160 · 53 · 39 · 92 ✅ |
| **`ingest-real.test.mjs`** | **93** ✅ |
| `ssr-render.check.jsx` | 97 ✅ |

**534 comprobaciones.** Ningún adapter toca su API real: los que necesitan respuesta usan `fetch` inyectado con fixture. Cero red, cero cuota.

---

## 13-nonies. Roadmap territorial

Orden oficial:

```
✅ A    Datos oficiales
✅ B    Gazetteer
✅ C    Topic Engine 2
✅ C2   Open Topic Discovery + Geo Foundation
✅ D    Agenda / Radar UI
🟡 F1   Mapa verificado — sin zonas analíticas ni MapLibre
✅ D2   Open Listening Foundation
✅ INGEST-REAL-01  Adquisición multifuente
→  1.  Primera prueba real multifuente        ← siguiente, EXIGE CREDENCIALES
   2.  DATA-PROVIDER-EVAL real
   3.  Ampliar providers donde el benchmark demuestre valor
   4.  E1 / Pulse
   5.  Topic × Territory avanzado
   6.  Origin / Amplification
   7.  Media / Creator Intelligence
   8.  Candidate Overlay
   9.  Correlation Engine
  10.  Sentinel Insight
```

Evaluaciones registradas: **`DATA-PROVIDER-EVAL-01`** (estructura definida, ninguna ficha ejecutada) · **`AI-ROUTER-EVAL`** (contrato definido, cero adaptadores) · **`AI-EVAL-01`** (pendiente, no iniciada).

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
| 12 | ~~Sesgo de consulta del recolector~~ | — | ✅ **CORREGIDO EN LA ENTRADA** (D2): de 2/4 con gestión a 6/9 neutrales; las institucionales se declaran como tales y el sesgo residual se mide y se muestra |
| 13 | **`DATA-PROVIDER-EVAL-01`** | integrar cualquier proveedor comercial | 🔴 evaluación no iniciada |
| 14 | Ampliar taxonomía: clima/desastres, cultura, deportes, energía | categorías para lo ya descubierto | 🟡 el descubrimiento abierto lo suple mientras tanto |
| 15 | **Polígono cantonal oficial de Cuenca** | dibujar el cantón sin derivar | 🟡 el mapa usa una **unión declarada** de las 22 parroquias, marcada como derivada |
| 16 | **Zonas analíticas en la interfaz** | lectura por zonas | 🟡 motor listo (`analyticalZones.js`), registro **vacío**, sin interfaz — F2 |
| 17 | **MapLibre, basemap y zoom** | War Room completo (UX-WR-001) | 🟡 F1 usa SVG; el agregado no cambia al migrar |
| 18 | **`territorial-c2`, `-d`, `-d2` e `ingest-real` fuera de `npm test`** | ejecución automática de la suite territorial | 🟡 `apps/backend/package.json` lo mantiene **Línea A** (modificado sin commitear otra vez en este gate); no se toca desde esta línea |
| 19 | **Emisores dentro de plataformas sin identificar** | diversidad real, agenda de creadores | 🔴 40 % del corpus llega por YouTube sin saber quién publica — requiere YouTube Data API, en `DATA-PROVIDER-EVAL-01` |
| 20 | **Agendas ciudadana, institucional y de creadores a cero** | lectura no exclusivamente mediática | 🔴 ninguna consulta trae fuentes comunitarias ni institucionales propias; es carencia de observación, ya declarada en la interfaz |
| 21 | **RSS directos de medios locales** | diversidad y resolución del publicador | 🟡 la mejora más barata disponible: leer El Mercurio directamente evita rescatar el publicador del sufijo del titular |
| 22 | **`AI-EVAL-01`** | integrar cualquier modelo de lenguaje | 🔴 no iniciada; hoy Sentinel funciona sin IA y esa es la línea base |
| 23 | **Snapshots acumulándose desde 2026-08-25** | ventanas comparables (E1) | 🟡 el histórico empieza hoy; **5 de 5 ventanas con histórico insuficiente** |
| 24 | **`BRAVE_API_KEY`** | segundo buscador web y su benchmark | 🔴 adapter completo desde antes de D2; solo falta la clave |
| 25 | **`YOUTUBE_API_KEY`** | identificar los emisores del 40 % del corpus | 🔴 adapter completo; es el hueco más grande que hay hoy |
| 26 | **Cobertura de GDELT en Azuay** | decidir si el histórico real es viable | 🟡 adapter implementado, cobertura SIN MEDIR; se decide con `fuentesNuevas` |
| 27 | **Feeds RSS de medios de Cuenca** | diversidad y publicador sin adivinar | 🟡 el adapter lee feeds DECLARADOS; falta recorrer los sitios y registrar cuáles publican |
| 28 | **Benchmark antes/después sin ejecutar** | demostrar que el stack nuevo mejora | 🔴 bloqueado por las dos credenciales |
| 29 | **Términos de servicio sin leer** | integrar cualquier plataforma social | 🔴 `legalTermsStatus: NO_LEIDO` en las 5 plataformas del registro |

`POST /api/territorio/recargar` integra 1–4 **sin reiniciar el backend y sin
cambiar arquitectura**.

`poblacionOficial` y `padronElectoral` son denominadores **distintos**: nunca se
usa uno como el otro.

### Reglas obligatorias — vigentes

- geometría = `null`;
- población = `null` si no existe fuente oficial;
- padrón = `null` si no existe fuente oficial;
- `verificado: false` en las unidades sin respaldo oficial — **10 de 50** hoy
  (9 topónimos candidatos + Centro Histórico); las 40 restantes están
  verificadas contra CONALI o DPA;
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

## 18-sexdecies. P-CAND-UX-01 Ficha de identidad (2026-08-25)

Commit `feat(projects): add assisted candidate identity workspace`.
**453 comprobaciones, 0 fallos.** Sin red, sin cuota.

**P-CAND-01: VALIDADO FUNCIONALMENTE / provider-limited.** No se reabre.

### La interfaz, antes y despues

Antes la tarjeta decia «42 %, 2 cuentas». Con eso el analista no podia ver que
Instagram se habia hallado el dia anterior y hoy no, que ocho de catorce
consultas no obtuvieron respuesta, ni por que se habia rechazado un candidato
de TikTok. **Todo eso ya estaba persistido; solo faltaba mostrarlo.**

Ahora la ficha muestra foto, nombre, alias, proyecto y **las siete plataformas
—las seis redes y la web— tambien las vacias**, cada una con estado,
procedencia, ultima verificacion, proveedores y accion de abrir. Nada queda
detras de un «+3 cuentas»: si hay tres cuentas, se ven las tres.

### Modelo de identidad

`cuentasReferencia` deja de ser un campo por plataforma y pasa a ser una
**coleccion**. El modelo anterior era `instagram: string`, asi que un candidato
con dos cuentas de Instagram —la personal y la de campana, que es lo normal—
solo podia tener una.

Cada entrada: `id` (plataforma + handle normalizado), `plataformaId`,
`plataforma`, `url`, `handle`, `origen`, `pertenenciaDeclarada`,
`verificadaPorSentinel`, `noCuentaComoCorroboracion`, `creadaEn`,
`actualizadaEn`, `estado`.

La plataforma se lee **del dominio** con SD-1A, no de la casilla del
formulario: si el analista pega una URL de Instagram en el campo de Facebook,
manda la URL.

### Las dos distinciones que la ficha no pierde

    declarada por el analista   vs   corroborada por Sentinel
    no reencontrada             vs   no existe

La primera es de procedencia y **las dos pueden ser verdad a la vez**: que una
persona escribiera la URL no impide que un proveedor la encuentre despues por
su cuenta. La ficha muestra ambas.

La segunda es la diferencia entre una limitacion nuestra y una afirmacion sobre
alguien. Una plataforma sin cuenta queda `PENDIENTE` con el texto «Sentinel no
tiene ninguna cuenta aqui. No es una afirmacion de que el candidato no use esta
plataforma». **Nunca se escribe «no tiene redes».**

### Foto

Se conserva `url`, `sourceUrl`, `origen`, `provider`, `obtenidaEn` y
`verificadaPorSentinel`. **No hay reconocimiento facial** y no se llama «foto
oficial» a una imagen solo porque se haya encontrado: la ficha dice de donde
salio y que Sentinel no la ha verificado. Sin imagen, marcador de posicion.

### Editar identidad

`PATCH /api/proyectos/:id/candidatos/:cid`. Todas las redes son **opcionales**
y **no hay que borrar y recrear**: recrear perderia el expediente, las
ejecuciones y el inventario consolidado, que es justo lo que no se quiere
perder al corregir una errata.

Lo que llega con valor se actualiza; lo que llega vacio se deja. **El id no
cambia** aunque cambie el nombre —es la clave con la que el Lake guarda el
expediente—, igual que al renombrar un proyecto.

Retirar una cuenta es **explicito, por su id**: un formulario enviado a medias
no puede borrar identidad. Y el Lake conserva su historia: nada se destruye.

### Comprobar redes

Reutiliza la ruta de investigacion, que **ya reverifica sin destruir**: el
inventario consolidado conserva las cuentas atribuidas aunque el proveedor
falle. Probado: una comprobacion sin ningun hallazgo conserva todas las cuentas
y las marca `NO_REENCONTRADA`, nunca `REVOCADA`.

No se ejecuto durante el desarrollo. Consume cuota, asi que se lanza solo
cuando el analista lo pide.

`Analizar actividad` queda visible y **deshabilitado**, con su motivo: Account
Intelligence no esta implementado.

### La metrica

`huellaDigital` se presentaba como un porcentaje suelto junto al nombre de un
candidato, y **en rojo cuando era bajo**. Con ese formato un 53 % se lee como
respaldo y un 35 % como caida, y no mide ninguna de las dos cosas.

Nombre elegido: **«Solidez del expediente»**. Es el exacto: la formula suma
cobertura de plataformas (40), solidez de la mejor correspondencia (30),
corroboracion multiproveedor (20) y declaracion en base de referencia (10). Es
decir, amplitud y solidez de lo documentado. «Cobertura de identidad»
describiria solo el primer componente, que son 40 de 100 puntos.

Se muestra como `Solidez 35/100`, con aclaracion al pasar el raton y desglose
por componentes al pulsar:

> Esta metrica refleja amplitud y corroboracion del expediente digital
> observado. No representa intencion de voto, popularidad ni apoyo ciudadano.

Y la escala de color es **neutra**: un expediente poco documentado no es
«malo», es poco documentado. El rojo queda para lo revocado y los errores
reales. **La formula no se toco.** BUG-16 queda **mitigado en la interfaz**.

### Hora local

Se **persiste en UTC** y se **muestra** en la hora del territorio del proyecto,
`America/Guayaquil` para Ecuador y configurable por proyecto. Un analista en
Cuenca que lee «17:23» tiene que poder compararlo con su reloj; obligarle a
restar cinco horas mentalmente termina en un hallazgo mal fechado. Si el
entorno no conoce la zona, se muestra UTC **etiquetado como UTC**, nunca
disfrazado de hora local.

### BUG-20 mitigado en la interfaz

Mientras `historiaIncompleta` sea true, la ficha **no escribe «vista por
primera vez»**: dice «historial previo incompleto», que es lo unico que
sabemos. El campo sigue mal en el modelo y BUG-20 **sigue abierto**.

### Archivos

| Archivo | Cambio |
|---|---|
| `services/projects/projectStore.js` | coleccion `cuentasReferencia`, foto, `editarCandidato`, `fichaIdentidad`, `PLATAFORMAS_FICHA`, `ESTADOS_IDENTIDAD_FICHA` |
| `routes/projects.js` | `GET …/identidad`, `PATCH …/candidatos/:cid` |
| `web/src/services/identidadCandidato.js` | **nuevo**: estados, procedencia, hora local, metrica, textos de BUG-20 |
| `web/src/components/CandidateIdentityCard.jsx` | **nuevo**: la ficha |
| `web/src/components/CandidateIdentityForm.jsx` | **nuevo**: editar identidad |
| `web/src/components/ProjectsModule.jsx` | cableado, metrica renombrada, hora local, `PATCH` |
| `tests/fichaIdentidad.test.mjs` | **nuevo**, 42 comprobaciones |

### Pruebas

42 comprobaciones nuevas: candidato sin redes, una red, varias, **dos cuentas
de la misma plataforma**, alias, foto y su procedencia, edicion, persistencia
tras relectura, inventario consolidado en la ficha, cuenta no reencontrada
visible, referencia que no autoverifica, corroboracion independiente,
`America/Guayaquil`, `historiaIncompleta` sin fecha inventada, metrica
renombrada y no politica, y que comprobar redes no borra cuentas.

Los helpers de la interfaz son funciones puras sin React, y por eso se prueban
desde Node: la interfaz no tiene arnes de pruebas propio.

| Suite | Total |
|---|---|
| las once anteriores | 411 |
| **fichaIdentidad** | **42** |
| **Total** | **453, 0 fallos** |

Build de la interfaz correcta. Lint: los 6 preexistentes de BUG-01 y BUG-02.
Lake real intacto en 95 entradas.

**Nota tecnica:** los iconos de marca se retiraron de `lucide-react`, asi que
se usan iconos genericos que describen la naturaleza de cada plataforma; el
nombre va escrito al lado, que es lo que de verdad la identifica.

### Proxima accion

Cargar la identidad real de los candidatos desde la interfaz. La ficha de
Lloret ya puede mostrar Facebook, X e Instagram **desde el inventario**, sin
una sola URL en el codigo. TikTok, YouTube y LinkedIn apareceran como
`PENDIENTE`, que es la situacion real.

`@jotalloretv` de TikTok **no se introduce a mano**: lo cargara el analista
desde el formulario, y quedara como declarado hasta que un proveedor lo
corrobore.

---

## 18-septendecies. P-CAND-UX-02 Edicion de identidad (2026-08-25)

Commit `fix(projects): enable assisted candidate identity editing`.
**495 comprobaciones, 0 fallos.** Sin red, sin cuota.

### Causa raiz — el formulario existia y era inalcanzable

`ProjectsModule.jsx` tiene cuatro ramas de render con retorno propio:

    993   if (cargando)
    1014  if (!proyecto && lista.length > 0 && !verFormProyecto)   ← LISTA
    1192  if (!proyecto)
    1340  return (…)                                              ← DETALLE

`CandidateIdentityForm` quedo montado en la rama **1014, la lista de
proyectos**. La ficha y el boton «Editar identidad» viven en la rama **1340,
el detalle**.

Al pulsar el boton desde el detalle, `editando` pasaba a `true` y ese JSX
estaba en una rama que ya habia retornado: **no se renderizaba nunca**. No era
un problema de estado, de CSS ni de viewport. Era el arbol equivocado.

El defecto lo introduje yo en el gate anterior: anclé la insercion en el primer
`{porEliminar && (` sin comprobar a que rama pertenecia. Ahora esta al cierre
del `return` final, con el comentario que explica por que.

### Dos defectos mas, encontrados en la auditoria

**Retirar una cuenta la BORRABA** en lugar de marcarla. `editarCandidato`
filtraba la entrada fuera del array, y con ella desaparecia por que se habia
declarado, cuando y quien lo hizo. §18 del gate pedia lo contrario.

Ahora se marca `REVOCADA` con `revocadaEn`, `revocadaPor` y `estadoAnterior`.
Y reintroducirla la **reactiva**: el analista cambio de opinion, y eso tambien
es una decision.

> `REVOCADA` es lo contrario de `NO_REENCONTRADA`. Una la decide una persona;
> la otra, el silencio de un buscador.

**La ficha no exponia el `id`** de cada cuenta, asi que la interfaz no podia
pedir una retirada por identidad exacta —comparar por handle suelto falla con
acentos y mayusculas—. Ahora lo expone.

### Antes / despues

| | Antes | Ahora |
|---|---|---|
| Editar identidad | el boton no hacia nada visible | abre un espacio de trabajo modal |
| Escribir una URL | imposible desde la interfaz | campo por plataforma, con `Agregar` |
| Varias cuentas por plataforma | soportado en el modelo, sin interfaz | «+ agregar» en cada plataforma |
| Retirar | borraba la entrada | marca `REVOCADA` y conserva historia |
| Foto | campo suelto | campo con vista previa y procedencia |
| Plataforma vacia | invisible en la edicion | tarjeta con su campo y su aclaracion |
| URL en la casilla equivocada | silencio | aviso: manda el dominio |

### La interfaz

Modal con **cabecera y pie fijos y cuerpo con scroll propio**: con siete
plataformas el contenido excede la pantalla, y un formulario cuyo boton de
guardar queda fuera del viewport es un formulario que no se puede usar.

Cabecera: «Editar identidad digital», nombre, proyecto · dignidad · territorio,
y la advertencia de procedencia. Pie: `Cancelar` · `Guardar cambios`, con el
recordatorio de que guardar es una declaracion y comprobar es una observacion.

`Guardar` esta deshabilitado si no hay cambios: no se envia un PATCH inutil.
`Cancelar` cierra y descarta el estado local **sin enviar nada**.

### Modelo final de `cuentasReferencia`

Coleccion, no campo por plataforma. Cada entrada:

    id                          plataformaId:handle normalizado
    plataformaId, plataforma    leidos del DOMINIO por SD-1A
    url, urlOriginal, handle
    origen                      "analista"
    pertenenciaDeclarada        true
    verificadaPorSentinel       false
    noCuentaComoCorroboracion   true
    estado                      DECLARADA_POR_ANALISTA | REVOCADA
    creadaEn, actualizadaEn
    revocadaEn, revocadaPor, estadoAnterior, reactivadaEn

**Varias cuentas por plataforma: soportado y probado.** Un candidato tiene
legitimamente Instagram personal y de campana.

### Procedencia: se acumula, no se sustituye

Lo que escribe el analista entra **declarado y sin verificar**. Si despues un
proveedor encuentra la misma cuenta por su cuenta, la ficha muestra **las dos**:
«declarada por el analista · corroborada por Sentinel». Probado.

La deteccion de plataforma la hace **SD-1A** en el backend. La interfaz solo
**avisa** si la URL parece de otra plataforma: no decide, y no hay clasificador
paralelo.

### Lo que guardar NO hace

Probado que un PATCH parcial —o vacio— **no borra nada** de lo que no menciona:
ni cuentas, ni alias, ni foto, ni expediente, ni ejecuciones, ni inventario
descubierto. Y el `candidateId` no cambia al corregir nombre o alias: es la
clave con la que el Lake guarda el expediente, y cambiarla desconectaria al
candidato de toda su historia. El nombre anterior se conserva.

### Preparado para Account Intelligence

Cada cuenta consolidada tiene clave estable, estado, procedencia,
`firstSeenAt`, `lastSeenAt`, `lastCheckedAt`, proveedores historicos y de
ultima observacion, y corroboracion. Es lo que un modulo de monitoreo
necesitara. **No se implementa nada de Account Intelligence en este gate** y el
modelo no queda acoplado a la interfaz.

### Pruebas

`tests/edicionIdentidad.test.mjs` — **40 comprobaciones**, T1 a T25.

Dos correcciones en mis propias pruebas antes de darlas por buenas: T5 quedo
escrita como una tautologia que no podia fallar —se elimino, T5b es la
comprobacion real— y la de higiene se detectaba a si misma, porque el patron
prohibido estaba escrito de una pieza en el fichero que inspecciona.

Esa prueba de higiene comprueba que **ninguna cuenta de ningun candidato real
aparece en el codigo**. El benchmark se carga desde la interfaz.

| Suite | Total |
|---|---|
| las doce anteriores | 455 |
| **edicionIdentidad** | **40** |
| **Total** | **495, 0 fallos** |

Build de la interfaz correcta. Lint: los 6 preexistentes de BUG-01 y BUG-02.

### Dato encontrado, no producido por este gate

El Lake tiene una ejecucion nueva a las **18:53:13** que **no** genero este
trabajo: no se ejecuto ninguna investigacion. Viene de fuera de la sesion.

Merece leerse porque confirma en produccion lo del gate anterior:
`inventario: {total: 3, observadas: 3, noReencontradas: 0, porEstado:
{REVALIDADA: 3}}` y `handlesPropagados: ["jotalloretv",
"juancristobal.lloretvaldivieso"]`. Huella de vuelta a 53 con 3 cuentas.
**BUG-17 y BUG-19 funcionando con datos reales.**

---

## 18-duodevicies. P-CAND-UX-03 Flujo y fotografia (2026-08-25)

Commit `fix(projects): refine candidate identity workflow and profile photo provenance`.
**527 comprobaciones, 0 fallos.** Sin red, sin cuota.

### Causa del comportamiento UX anterior

Al guardar, `guardarIdentidad` cerraba el modal pero **dejaba
`fichaAbierta`**, asi que la ficha completa seguia desplegada. Y usaba
`setAviso`, que es un aviso **persistente**: habia que cerrarlo a mano.

Con un candidato se tolera. Con veinte, cada guardado deja un panel abierto y
un aviso que cerrar, y la lista se vuelve ilegible.

### Antes / despues

| | Antes | Ahora |
|---|---|---|
| Tras guardar | modal cerrado, **ficha desplegada** | vuelve a la tarjeta compacta |
| Confirmacion | aviso persistente | flotante, se borra en 4 s |
| Orden | avisar y luego recargar | **recargar y luego colapsar**, para que la tarjeta no muestre un dato viejo ni un instante |
| Cancelar | cerraba el modal | igual: cierra solo el modal, la ficha sigue abierta |
| Error al guardar | modal abierto | igual, y **conserva lo escrito** |
| URL de cuenta en el campo de foto | se guardaba como `url` → **icono roto** | se rechaza con motivo |
| Imagen que falla al cargar | icono roto del navegador | avatar con iniciales |

### Contrato de fotografia

    url, sourceUrl
    origen                      analista | cuenta_declarada | cuenta_descubierta
    provider
    derivadaDeCuenta, cuentaId, plataformaId, handle
    obtenidaEn, ultimaComprobacion
    verificadaPorSentinel       hoy siempre false
    intentoRechazado            { url, motivo, esUrlDeCuenta, plataformaId }
    historial[]                 hasta 5, con reemplazadaEn
    utilizable, motivoNoUtilizable, esUrlDeCuenta   (calculados en la ficha)

**Jerarquia** implementada entera: `manual → instagram → facebook → tiktok →
x → youtube → linkedin → web`.

### El limite real, declarado

**No existe API de ninguna plataforma social en este sistema y el scraping
esta excluido.** Por tanto no hay mecanismo legitimo para obtener el avatar de
Instagram, Facebook, TikTok, X, YouTube ni LinkedIn.

La jerarquia esta completa y **esas plataformas registran
`no_disponible_sin_api` con su motivo** en `fotoNoDisponible`, en lugar de
fingir una imagen. Lo que si produce fotografia: una URL que escriba el
analista, y una imagen ya presente en el expediente —por ejemplo la que el
Avatar Intelligence Engine obtiene de Wikidata P18—.

Declarar la ausencia es la mitad del trabajo: sin eso, un hueco parece un
fallo del sistema y no una limitacion conocida.

### Procedencia: dos afirmaciones que no se mezclan

  **A** · Sentinel corroboro que la cuenta corresponde al candidato.
  **B** · Sentinel verifico el contenido de la fotografia.

Que la cuenta pase a corroborada **no** convierte su fotografia en verificada.
`verificadaPorSentinel` solo habla de B, que hoy nunca es cierta. Probado.

Y **nunca se llama «oficial»** a una imagen por haberla encontrado: se dice de
donde salio.

### Una URL de cuenta no es una URL de imagen

El defecto visible: se pego `facebook.com/usuario` en el campo de fotografia y
la interfaz lo puso como `src` de un `<img>`. El navegador dibujo su icono
roto.

`esUrlDeImagen` decide por extension o por servicio de imagenes conocido, y
`diagnosticarUrlFoto` explica el rechazo con palabras que el analista pueda
usar para corregirlo. La regla vive en el backend **y** en la interfaz a
proposito: el backend decide al guardar, la interfaz decide si intenta pintar.
Un test comprueba que no discrepan.

`CandidatePhoto` valida antes de pintar y ademas escucha `onError`: si la carga
falla, cae a un avatar con iniciales. **Nunca el icono roto.**

### Dato real encontrado

El expediente de Lloret tenia ya una **URL de cuenta de Facebook guardada como
fotografia**, escrita por el codigo anterior. No se corrige el dato del
analista sin que lo pida: se **diagnostica**. La ficha devuelve
`utilizable: false` con el motivo, y la interfaz lo dice en lugar de dejar un
hueco sin explicacion.

En la misma lectura se confirma que **P-CAND-UX-02 funciona con datos
reales**: TikTok y YouTube persistidos como `DECLARADA_POR_ANALISTA`, y
Facebook con **las dos procedencias a la vez** —declarada y corroborada—.

### Persistencia e historial

La fotografia vive en el expediente con `obtenidaEn` y `ultimaComprobacion`:
un re-render lee lo guardado y **no dispara ninguna obtencion**. Si dependiera
del render, cada pintado seria una peticion.

Al cambiar de fotografia la anterior **no se destruye**: pasa a `historial`
con su procedencia y `reemplazadaEn`, acotado a 5. Guardar la misma URL
actualiza la comprobacion y **no duplica** historia. El contrato admite crecer
a un historial completo sin rehacerlo.

### Pruebas

`tests/fotoIdentidad.test.mjs` — **32 comprobaciones**, T1 a T20.

Nota honesta sobre T1–T3: el flujo de la interfaz —cerrar, colapsar, confirmar—
es estado de React y no se puede ejercitar desde Node. Lo que se prueba es el
**contrato del que depende**: que guardar devuelva un aviso, que persista antes
de colapsar, y que un fallo no destruya nada. La comprobacion visual queda
para el analista.

| Suite | Total |
|---|---|
| las trece anteriores | 495 |
| **fotoIdentidad** | **32** |
| **Total** | **527, 0 fallos** |

Build correcta. Lint: **introduje dos errores** —dos imports que quedaron sin
usar al refactorizar la ficha— y los corregi; vuelve a los 6 preexistentes de
BUG-01 y BUG-02.

### Preparacion para Account Intelligence

Contrato minimo por cuenta, **verificado por prueba**: `id`, `plataformaId`,
`handle`, `url`, `estado`, procedencia (`declaradaPorAnalista`,
`descubiertaPorSentinel`, `corroboradaPorSentinel`), `corroboracion`,
`firstSeenAt`, `lastSeenAt`, `lastCheckedAt`, mas `candidatoId` en la ficha.

Es suficiente para que el proximo gate analice actividad **por cuenta** y la
consolide **por candidato**. No se implementa nada del motor y el modelo no
queda acoplado a la interfaz.

### Riesgos y limitaciones reales

- **Sin API de plataforma, la foto derivada de redes no es obtenible.** Es la
  limitacion dominante de este gate y esta declarada, no disimulada.
- El expediente de Lloret conserva una URL de cuenta en el campo de foto. No
  se toca: la corrige el analista desde la interfaz.
- `SERVICIOS_DE_IMAGEN` reconoce los CDN habituales; una URL de imagen sin
  extension en un dominio desconocido se rechazaria. Es el lado seguro del
  error: mejor pedir el enlace directo que dibujar una pagina.
- La confirmacion efimera usa `setTimeout`; si el modulo se desmontara justo
  antes, el temporizador quedaria huerfano. `ProjectsModule` no se desmonta en
  el flujo actual.

---

## 18-undevicies. P-CAND-UX-04 y P-CAND-AI-01 (2026-08-25)

Commits `feat(projects): resolve candidate photo from declared public sources`
y `feat(intelligence): add candidate account intelligence foundation`.

**590 comprobaciones, 0 fallos.** Sin red, sin cuota.

---

### PARTE A · Resolver de fotografia (P-CAND-UX-04)

#### Arquitectura

`services/intelligence/candidatePhotoResolver.js`. Entrada: `candidateId`,
cuentas del expediente y la foto manual si existe. Salida: `fotoActual`,
`intentos[]` y `limitaciones[]`.

La prioridad esta **centralizada** en `PRIORIDAD_FUENTES` —
`manual → instagram → facebook → tiktok → x → youtube → linkedin → web` —
justo para que ningun componente la reinvente con `if/else`: dos partes de la
interfaz decidiendo por su cuenta mostrarian fotos distintas del mismo
candidato.

#### La distincion que lo sostiene

    fotoManualUrl   enlace directo a una imagen que dio el analista
    fotoSourceUrl   pagina de una cuenta desde la que intentar obtenerla

Una pagina de perfil **nunca** se usa como `src` de un `<img>`: se lee su
metadata y se usa la imagen que **ella** declara.

#### Metodos de extraccion

Solo metadata publica estandar, en este orden: `og:image:secure_url`,
`og:image:url`, `og:image`, `twitter:image:src`, `twitter:image`, y `image` de
un bloque JSON-LD —admitiendo cadena, objeto con `url` o lista—.

No se recorre el DOM buscando «la imagen mas grande»: eso seria adivinar cual
es el retrato.

#### Validacion: una URL no vale por acabar en .jpg

Se pide la cabecera y se comprueba `Content-Type` `image/*`, que no sea HTML y
que el tamano sea razonable. Y se descartan por patron los favicon, sprites,
pixeles de seguimiento y **los logotipos de las plataformas**: aceptar uno
pondria el logo de Instagram como cara del candidato.

Si una clave da una imagen generica, se sigue probando las demas y el descarte
se registra.

#### Seguridad y procedencia

Sin login, sin cookies, sin cabecera de autenticacion, con tope de tiempo y
**tope de cuatro fuentes** por resolucion. Una peticion por fuente: no hay
scraping masivo. Un `401`, `403` o `429` se declara `BLOQUEADA` y **no se
intenta entrar de otra forma**.

Cada intento registra plataforma, `sourceUrl`, resultado, motivo, `httpStatus`,
metadata encontrada e `imageUrl`. Estados: `RESUELTA`, `SIN_METADATA`,
`BLOQUEADA`, `TIMEOUT`, `NO_IMAGEN`, `IMAGEN_GENERICA`, `ERROR` y
`NO_INTENTADA`.

**Los fallos no se ocultan.** La interfaz los muestra.

#### La distincion critica

    verifiedImageResource   la URL devuelve una imagen
    verificadaPorSentinel   Sentinel verifico a quien retrata

La primera se comprueba con una peticion HTTP. La segunda exigiria
reconocimiento facial, que este modulo **se prohibe**, y por eso es **siempre
false**. Un test comprueba que no se importa ninguna libreria de vision.

#### Persistencia

La resolucion ocurre solo cuando el analista pulsa «Obtener foto desde
fuentes». **Nunca en cada render**: una fotografia que se recalcula al pintar
seria una peticion por pintado. El resultado se persiste con toda su
procedencia y el historial de la anterior.

---

### PARTE B · Account Intelligence Fase 1 (P-CAND-AI-01)

#### Discovery no es monitoreo

    Discovery              ¿de quien es esta cuenta?
    Account Intelligence   ¿que ocurre en ella?

La primera ya esta resuelta y su respuesta vive en el inventario consolidado.
La segunda **no** se responde relanzando Full Discovery: seria repreguntar algo
que ya sabemos y pagarlo.

#### Modelo de observacion

`accountContracts.js` define `crearObservacion`, `crearPublicacion` y
`crearSnapshot`. Todos los campos publicos son **opcionales y `null` cuando no
se obtuvieron**.

> `null` no es cero. Cero seguidores es un dato; no saberlo es otra cosa.

Cada observacion declara `metricasDisponibles` y `metricasNoDisponibles`: sin
eso, un campo vacio no se distingue de uno que nadie intento leer.

#### Snapshots append-only

Uno por observacion, en su propia entidad del Lake identificada por instante.
**Nunca se sobrescribe el anterior**: sin la serie no hay 7d, 15d, 30d ni 90d y
comparar seria inventar.

El snapshot reserva `comparacion` con `snapshotAnterior`, `delta`,
`publicacionesDelPeriodo` y `temasActivos` — **contrato para Change
Attribution, que no se implementa**. Existe para no tener que rehacer el modelo
despues.

#### Actividad

Solo lo derivable de observaciones reales: publicaciones observadas a 7 y 30
dias, frecuencia y ultima actividad. Sin publicaciones observadas todo queda
`null` y aparece la advertencia:

> No se observo ninguna publicacion. Esto NO indica que el candidato no
> publique: indica que las fuentes disponibles no permiten leer sus
> publicaciones.

**No hay etiquetas alta/media/baja.** `REGLA_FRECUENCIA.etiquetas` es `null` a
proposito: con las fuentes actuales no se observa el total de publicaciones,
asi que cualquier etiqueta seria una conjetura con aspecto de dato.

#### Temas propios frente a temas sobre el candidato

    TEMAS_PROPIOS               lo que dicen las cuentas del candidato
    TEMAS_SOBRE_EL_CANDIDATO    lo que dicen medios y terceros

Se calculan por separado y cada resultado declara su ambito y **que no es**.
Confundirlos convertiria la agenda de un medio en el discurso del candidato.

Se **reutiliza** `conversation/topicExtractor.js`. No hay Topic Engine
paralelo, y un test lo comprueba.

#### Metricas no comparables

Una vista de TikTok, una reaccion de Facebook y un repost de X no miden lo
mismo. Se agrupan **por plataforma** y `METRICAS_NO_COMPARABLES.equivalencias`
es `null`: mientras no exista una normalizacion documentada, no hay totales
cruzados. El resumen no expone ningun agregado entre plataformas.

#### Sin puntuacion

`resumen.puntuacion` es `null` y lo dice en palabras: con las fuentes
disponibles no hay base para comparar candidatos. Un numero por candidato en
esta fase se leeria como un ranking politico.

#### El limite dominante, medido

De las siete plataformas, **una** permite lectura real hoy: la web propia.

| Plataforma | Capacidad | Metricas obtenibles hoy |
|---|---|---|
| Instagram | `API_REQUIRED` | ninguna |
| Facebook | `API_REQUIRED` | ninguna |
| X | `API_REQUIRED` | ninguna |
| TikTok | `API_REQUIRED` | ninguna |
| YouTube | `API_REQUIRED` | ninguna |
| LinkedIn | `BLOCKED` | ninguna |
| **Web oficial** | `PUBLIC_METADATA_ONLY` | titulo, descripcion, imagen |

Account Intelligence Fase 1 registra estructura, traza y snapshots, y **no
puede leer seguidores, publicaciones ni metricas de ninguna red social**. Esta
declarado en cada observacion.

`docs/ACCOUNT-PROVIDER-GAPS.md` recoge, plataforma por plataforma, que
necesitamos, que obtenemos, que falta y que API podria cubrirlo. **Los precios
figuran como `null`**: no los conozco y estimarlos en un documento de decision
seria peor que dejar el hueco. Orden sugerido: YouTube Data API primero
—es el unico acceso gratuito real—, LinkedIn descartado.

#### Interfaz

`Analizar actividad` deja de estar deshabilitado y abre el workspace con ocho
secciones: Resumen, Cuentas, Actividad, Publicaciones, Temas, Metricas,
Historico y Limitaciones.

**Abrir el panel NO sale a la red**: describe el estado y los limites. Observar
es un boton aparte, y solo lo pulsa el analista.

Casi todo esta vacio en esta fase, y esta bien. Lo que no puede pasar es que un
hueco parezca un dato: cada seccion vacia dice por que lo esta.

---

### Pruebas

| Suite | Comprobaciones |
|---|---|
| **fotoResolver** | **28** |
| **accountIntelligence** | **35** |
| las catorce anteriores | 527 |
| **Total** | **590, 0 fallos** |

Sin red: el `fetchImpl` se inyecta y cada caso declara que devuelve cada URL,
asi que las pruebas son deterministas y no dependen de que una pagina exista
hoy.

Build correcta. Lint: los 6 preexistentes de BUG-01 y BUG-02.

### Riesgos y limitaciones

- **La limitacion dominante es de acceso, no de codigo.** Sin API, Account
  Intelligence puede describir y trazar, no medir.
- La deteccion de imagenes genericas es por patron: un logotipo desconocido
  podria colarse. El lado seguro seria mas estricto, y entonces rechazaria
  retratos validos; se eligio el equilibrio y se declara.
- El resolver hace peticiones HTTP a paginas publicas. No es cuota de
  proveedor, pero es red: por eso solo se dispara cuando el analista lo pide.
- Las publicaciones tienen contrato y **ninguna fuente que las entregue**. La
  lista vacia lo dice.

---

## 18-vicies. Candidate Intelligence V1 (2026-08-25)

Commit `feat(intelligence): candidate longitudinal intelligence v1`.

**689 comprobaciones, 17 suites, 0 fallos.** Sin red y sin cuota.

Sentinel deja de «investigar un candidato» y empieza a **mantener un
expediente longitudinal** durante toda la campana.

---

### ARQUITECTURA CONGELADA

#### CANDIDATE-LONGITUDINAL-01

> Todo candidato incorporado a un proyecto de Sentinel mantiene un expediente
> longitudinal. Las nuevas observaciones se agregan; no reemplazan
> silenciosamente observaciones historicas.

Sin esto no se puede responder a ninguna pregunta sobre el pasado —que cuentas
habia en una fecha, que aparecio, que cambio entre dos ventanas— y son
exactamente las preguntas que hace un analista de campana. Una escritura
destructiva las borra todas de golpe.

#### OBSERVED-PRESENCE-01

> La presencia digital observada representa actividad encontrada dentro del
> universo de fuentes observado por Sentinel. No representa intencion de voto,
> apoyo ciudadano ni poblacion total.

El universo de fuentes son los proveedores de busqueda disponibles y las
paginas publicas legibles. No es aleatorio, no es representativo y no es una
muestra de nada.

---

### 1 · Account Resolution

`services/intelligence/accountResolution.js`.

Un candidato puede tener **varias cuentas en la misma plataforma** —perfil
personal y cuenta de campana— y ahi tambien se cuelan homonimos. La pregunta
«es del candidato?» no se responde con un booleano.

Ocho estados: `DECLARADA`, `DESCUBIERTA`, `CANDIDATA`, `CORROBORADA`,
`CONSOLIDADA`, `NO_REENCONTRADA`, `DUDOSA`, `DESCARTADA`. Conviven con
`ESTADOS_IDENTIDAD`; `ESTADO_EQUIVALENTE` traduce en una sola direccion y no
reescribe el expediente.

#### La regla

> Una cuenta DESCUBIERTA no pasa a CORROBORADA por parecerse el nombre.

El nombre es lo que hace que la miremos, no lo que la confirma. Se distinguen
senales **independientes** de las que dependen del nombre:

| Independientes | No corroboran |
|---|---|
| enlace cruzado desde cuenta consolidada | coincidencia de nombre |
| publicada en la web declarada | coincidencia de handle |
| biografia publica que identifica mas que el nombre | declaracion del analista |
| referencia externa independiente | |
| varios proveedores **por vias distintas** | |

Se pueden acumular mil senales dependientes y seguir sin poder corroborar. Es
deliberado: mil formas de comprobar que el nombre coincide siguen sin decir de
quien es la cuenta. La declaracion del analista no corrobora porque si contara,
Sentinel se estaria confirmando a si mismo.

`solidezDeAtribucion` da 25 puntos por senal independiente **distinta**, tope
100. Se publica solo porque es explicable: de cada punto se puede decir de
donde sale.

`accountId` es `plataforma:handle` normalizado — la misma forma que ya usaba la
ficha, a proposito: cambiarla habria roto las referencias existentes.

---

### 2 · Historico y ventanas

`services/intelligence/candidateTimeline.js`.

Cuatro ventanas: **7d, 30d, 90d y campana completa**. Tres estados:
`COMPARABLE`, `HISTORICO_INSUFICIENTE`, `SIN_OBSERVACIONES`.

Con una sola observacion no se dibuja tendencia: **una tendencia de un punto es
una opinion con forma de linea**. Y un delta cuya metrica falta en un extremo
es `null`, porque restar de un `null` produciria un numero inventado.

`crearSnapshotDeIdentidad` fotografia el inventario en un instante;
`compararInventarios` dice que aparecio y que no consta. El campo se llama
**`ausentesDelInventario`, no «desaparecidas»**: una cuenta que no aparece en la
foto nueva puede seguir existiendo perfectamente. Una baja es una decision y se
registra como `DESCARTADA`.

#### La distincion temporal

    firstObservedBySentinel     cuando lo vimos NOSOTROS
    fechaDeclaradaPorLaFuente   cuando dice la fuente que ocurrio

Si en octubre recuperamos una nota de agosto, Sentinel **no** observo nada en
agosto: observo en octubre una pieza fechada en agosto. Escribir la segunda
fecha en el primer campo produciria un expediente que afirma una vigilancia que
no existio.

---

### 3 · Corpus de evidencias append-only

El expediente guardaba el **recuento** de evidencias, no las evidencias. Con un
recuento no se puede deduplicar, ni agrupar replicas, ni saber que medio
publico que — que son justo las preguntas de Amplificacion.

`guardarEvidencias` escribe un lote por ejecucion en su propia entidad del
Lake, **fuera de la guarda `sinCambios`** y por la misma razon que la ejecucion:
lo que se guarda es un hecho fechado, no una version del expediente. Un lote
identico al de ayer sigue siendo la observacion de hoy.

`evidenciasDe` funde por URL conservando la **primera** vez que la vimos y
contando `vecesObservada`. Tope de 120 por lote, con el recorte declarado.

---

### 4 · Amplificacion

`services/intelligence/candidateAmplification.js`.

    PRESENCIA PROPIA    lo publican sus cuentas
    PRESENCIA GANADA    lo publican terceros

Diez cabeceras publicando la misma nota de agencia son **10 piezas, 1 hecho, N
fuentes**. Tres cifras, y solo la tercera se parece a lo que la gente imagina
cuando oye «diez medios hablaron del candidato». Se dan las tres por separado.

La agrupacion **reutiliza** `conversation/nearDuplicate.js` y la clasificacion
de fuentes `conversation/mediaRegistry.js`. No hay detectores paralelos.

Una URL es propia si coinciden dominio **y** handle en la ruta: otro perfil del
mismo dominio no es propio. Sin URL, la pieza queda `PLANO_INDETERMINADO` y no
se cuenta como ganada.

Cuatro planos de conversacion: candidato, medios, otros actores y conversacion
publica observable. Todos exponen `piezasObservadas` y **`personas: null`**. De
N publicaciones no se deduce N ciudadanos: una persona puede publicar cien
veces y cien cuentas pueden ser una sola operacion.

---

### 5 · Relaciones, Media y Territorio

`services/intelligence/candidateRelations.js`. Tres puentes definidos, no
completados.

Nueve tipos de relacion, todos **verbos observables**. Cada arista lleva
`evidenceIds` —sin evidencia no hay arista— y la advertencia:

> Una relacion digital observada no es una relacion personal ni politica. Un
> medio que publica sobre un candidato no es su aliado, y dos personas que
> aparecen en la misma nota no tienen por que conocerse.

`confidence` es `null` y se explica por que: la arista consta o no consta, no
hay nada que estimar.

`CONTRATO_MEDIA_RELATION` fija que debera devolver Media Intelligence —piezas
ya deduplicadas, `evidenceIds` verificables, diversidad en dominios— y declara
`disponibleHoy: false`. `validarPayloadDeMedios` rechaza lo que no cumpla.

Territorio: lo que se ubica es una **pieza**, nunca una persona. Se consume
GEO-1 y se rechaza lo que no autorice: metodo fuera del catalogo, `no_resoluble`
o unidad sin `autorizaAtribucion`. `METODOS_PROHIBIDOS` bloquea por nombre
`ip`, `dispositivo`, `usuario`, geolocalizacion de perfil e inferencia por
seguidores.

---

### 6 · Presencia digital observada

`services/intelligence/digitalPresence.js`. Seis dimensiones, cada una con su
metodologia escrita al lado: actividad propia, amplificacion externa, cobertura
mediatica, conversacion publica, diversidad de fuentes y persistencia temporal.

**El indice compuesto es `NO_DISPONIBLE` y su valor `null`**, con los cinco
requisitos que faltan enumerados: metodologia documentada, normalizacion entre
plataformas, deduplicacion de todo el corpus, ventanas comparables y cobertura
suficiente. Con cualquiera de ellos sin resolver el numero diria mas del estado
de nuestras fuentes que del candidato — y, como parece un dato, nadie lo leeria
asi.

Etiqueta de interfaz: **PRESENCIA DIGITAL OBSERVADA**. Vocabulario prohibido en
el motor: influencia electoral, apoyo, popularidad, intencion de voto,
liderazgo digital.

---

### 7 · Solidez del expediente — formula v2 (BUG-16)

`services/intelligence/expedienteSolidez.js`.

#### El defecto, medido

`indiceHuellaDigital` se calcula sobre `cuentasObjetivo`: las cuentas atribuidas
**en esa ejecucion**. Sus cuatro componentes dependen de esa lista. Cuando un
buscador no devolvio una cuenta ya consolidada, la cuenta salio de la lista y la
cifra cayo: el mismo expediente marco 53 y luego 42. No habia cambiado la
identidad del candidato; habia cambiado lo que un buscador devolvio ese dia.

> absence of evidence != evidence of absence

#### La separacion

    SOLIDEZ DE IDENTIDAD      sobre el INVENTARIO CONSOLIDADO,
                              que no pierde cuentas
    REENCONTRABILIDAD ACTUAL  cuanto de eso volvimos a ver

| Componente de la solidez | Puntos |
|---|---|
| Cobertura de plataformas | 35 |
| Corroboracion independiente | 35 |
| Procedencia documentada | 15 |
| Persistencia historica | 15 |

Ningun componente mira la ultima ejecucion, y cada uno lo declara con
`dependeDeLaUltimaEjecucion: false`. La reencontrabilidad **no se resta**: se
muestra al lado, con su advertencia de que mide a nuestros proveedores y no al
candidato.

Probado con la misma identidad antes y despues de un fallo de buscador: la
solidez es identica, la reencontrabilidad baja de 100 a 50.

La formula v1 sigue viva en `executiveProfile.js` y alimenta la tarjeta
compacta: no se toco para no alterar lo que ya funciona. La v2 se expone en el
workspace, que es donde se explica.

---

### 8 · Interfaz

`AccountIntelligencePanel` pasa a diez secciones: **Resumen, Identidad,
Actividad, Amplificacion, Medios, Temas, Relaciones, Territorio, Historico,
Evidencias**. La ficha compacta del candidato **sigue compacta**: todo lo
profundo vive en el workspace.

Abrir el panel **no sale a la red**. Observar es un boton aparte y solo lo pulsa
el analista.

En Identidad, cada cuenta muestra su estado de resolucion, su solidez y **cada
senal con su independencia a la vista** —«independiente» o «no corrobora»—, que
es lo que distingue una atribucion sostenida de un parecido de nombre.

---

### Migracion y compatibilidad

Nada se reescribe. Todo es aditivo:

- Las tres series nuevas viven en entidades propias del Lake; los expedientes
  existentes no se tocan.
- Los candidatos anteriores conservan identidad, cuentas, foto, expediente,
  investigaciones y procedencia.
- Sin `firstSeenAt`, la persistencia historica no se penaliza a ciegas: se
  declara `historiaIncompleta`.
- Sin corpus, cada seccion dice que el corpus se acumula desde la primera
  investigacion posterior a este contrato. Las anteriores solo guardaron
  recuentos, y eso no se puede reconstruir.

### Pruebas

| Suite | Comprobaciones |
|---|---|
| **candidateIntelligence** | **99** |
| las dieciseis anteriores | 590 |
| **Total** | **689, 0 fallos** |

Doce fixtures sinteticos y **dos candidatos ficticios independientes**. Se
comprueba explicitamente que una nueva investigacion no borra historia, que la
solidez no cae por un fallo de buscador, que diez copias no son diez senales y
que ningun modulo del gate menciona a un candidato concreto.

### Riesgos y limitaciones

- **Los enlaces cruzados llegan vacios hoy.** Para saber que la web declarada
  enlaza a una cuenta hay que leer esa web, y el panel no sale a la red al
  abrirse. Es la senal independiente que mas facil seria conseguir a
  continuacion.
- **El corpus arranca vacio para los candidatos existentes.** Las
  investigaciones anteriores guardaron recuentos, no piezas. Hasta la siguiente
  investigacion real, Amplificacion, Medios y Relaciones estaran vacios y lo
  dicen.
- El catalogo de medios es semilla: lo que no reconoce queda `desconocido` en
  lugar de clasificarse por conjetura.
- Territorio no vinculara nada hasta que las evidencias lleguen con contrato de
  GEO-1. Fabricar un canton plausible seria inventar cobertura territorial.
- Sigue en pie el limite dominante: seis de siete plataformas no se pueden
  leer sin API.

---

## 18-unvicies. P-CAND-02 Cross-Link Evidence (2026-08-26)

Commit `feat(intelligence): cross-link evidence and real observation readiness`.

**766 comprobaciones, 18 suites, 0 fallos.** Sin red y sin cuota.

Candidate Intelligence V1 dejo un hueco declarado: `enlacesCruzados` llegaba
vacio, asi que una cuenta declarada por el analista se quedaba en `DECLARADA`
para siempre. Este gate lo cierra.

---

### CONFLICTO DE ARQUITECTURA RESUELTO

La auditoria previa encontro trabajo ajeno —entonces sin commitear, integrado
despues en `86a2c3d`— que se solapaba con tres puntos de este gate:

| Fichero ajeno | Solapamiento | Decision |
|---|---|---|
| `ingest/adapters/youtubeAdapter.js` | adaptador de YouTube Data API v3 **completo** | NO se escribe otro |
| `ingest/evidenceContract.js` | `evidenceId`, `canonicalUrl`, `provenance` | NO se duplica; se referencia |
| `ingest/crossProviderDedup.js` | deduplicacion multifuente | NO se duplica |
| `.env.example` | `YOUTUBE_API_KEY` ya documentada | NO se toca |

Escribir un segundo adaptador de YouTube habria sido exactamente lo que el gate
prohibe. Pero cuando se decidio la arquitectura ese fichero **no estaba en
git**: importarlo de forma rigida habria dejado Candidate Intelligence
dependiendo de algo que funcionaba en esta maquina y se romperia en cualquier
otra. Al cerrar el gate ya esta integrado, pero la decision se mantiene: un
puerto no cuesta nada y sobrevive a que esa rama cambie de forma.

La solucion es un **puerto**, no un adaptador: `platformAdapterPort.js` declara
lo que se NECESITA, resuelve en caliente lo que HAY y declara la ausencia en
lugar de romper. Es la misma disciplina que ya gobierna las credenciales.

---

### 1 · Cross-Link Evidence

`services/intelligence/crossLinkEvidence.js`.

    pagina que Sentinel YA puede leer
      → enlace publico saliente
        → cuenta social identificada por SD-1A
          → evidencia independiente del nombre
            → Account Resolution

El valor de un enlace cruzado no esta en el parecido: esta en que **alguien
distinto de nosotros publico la asociacion**.

#### La cadena de confianza, dicha en voz alta

Cuando la pagina de origen es la web que el analista declaro:

    analista → web → cuenta

El analista aporta la **semilla**; la web aporta la **evidencia**. El enlace no
lo escribio el analista, y por eso cuenta. Pero si la web declarada fuera la
equivocada, todo lo que cuelgue de ella hereda el error — asi que la cadena
entera se guarda en `cadenaDeConfianza` y se puede inspeccionar.

Eso es **distinto** de que el analista declare la cuenta directamente: eso no
es evidencia de nada y sigue sin corroborar.

#### Contra la circularidad

`ACCOUNT_TO_ACCOUNT` exige `origenCorroborado: true`. Si no, dos cuentas que se
enlazan entre si se ascenderian mutuamente sin que nadie externo hubiera dicho
nada.

#### Hallazgo: los enlaces del mismo dominio son navegacion

Medido al escribir las pruebas. Leyendo una pagina de Facebook, el enlace
relativo `/contacto` se resuelve a `facebook.com/contacto` y SD-1A lo reconoce
—con razon— como una cuenta con handle «contacto».

Aceptarlo habria fabricado **una cuenta corroborada por cada elemento del
menu**: `/contacto`, `/privacy`, `/help`. Y como llegarian con senal
independiente, habrian ascendido solas.

Un enlace del mismo dominio que la pagina de origen no se distingue de la
navegacion del sitio, asi que no cuenta. Se descarta y **se declara** en
`descartadosPorMismoDominio`: un recorte silencioso aqui se leeria como «la
pagina no enlazaba nada».

---

### 2 · Direccionalidad

    WEB_TO_ACCOUNT                  → senal `web_declarada`
    ACCOUNT_TO_ACCOUNT              → senal `enlace_cruzado`
    EXTERNAL_REFERENCE_TO_ACCOUNT   → senal `referencia_independiente`

Tres direcciones que no valen lo mismo. La direccion viaja en la senal y en su
`relationId`, y solo la segunda exige origen corroborado.

---

### 3 · Deduplicacion e historico

`relationId` es la identidad **estable** de la relacion: la misma pagina
enlazando la misma cuenta es la misma relacion, la vuelvas a observar cien
veces.

| Campo | Comportamiento |
|---|---|
| `firstObservedAt` | **inmutable** |
| `lastObservedAt` | avanza |
| `observationCount` | se incrementa |
| `evidenceIds` | se acumulan |

Probado: cien observaciones del mismo enlace producen **25 puntos de solidez, no
100**. Si cada observacion contara, la corroboracion se inflaria sola volviendo
a mirar la misma pagina.

Una relacion que esta vez no se vio **no se borra**: entra en `noReobservadas`,
igual que las cuentas no reencontradas.

---

### 4 · Evidence-first

`services/intelligence/evidenceFirst.js`.

    insight → metric → evidenceId → source → observedAt → canonicalUrl

`crearAfirmacion` **rechaza** lo que no cumpla la cadena y enumera lo que falta,
en lugar de publicar la afirmacion con un hueco. Sin `canonicalUrl` no hay boton
«Ver evidencia», y eso es correcto: un boton que no lleva a ninguna parte es
peor que no ofrecerlo.

Los cuatro tipos de metrica —`absolutePerformance`, `relativePerformance`,
`velocity`, `amplification`— estan **declarados con su metodologia y sus
requisitos**, y los cuatro en `disponible: false`.

**No existe etiqueta «viral».** No hay umbral defendible: la misma cifra es
enorme para un candidato local y ordinaria para una cuenta nacional, y el numero
por si solo no distingue una publicacion que funciono de una que se promociono
con dinero. La palabra en un `insight` **invalida la afirmacion**, no se limpia.

---

### 5 · Publicaciones y metricas como snapshots

`services/intelligence/publicationObservation.js`.

    100k visualizaciones ayer
    150k visualizaciones hoy

no es un campo que paso de 100k a 150k. Son **dos observaciones**, y las dos se
guardan. Sustituir la primera destruye lo unico que hacia falta para saber que
crecio: el punto anterior.

Cada metrica declara `value`, `observedAt`, `provider`, `source` y
`availability`. Cinco estados de disponibilidad, y uno importa especialmente:
`OCULTO_POR_LA_CUENTA` **no es** lo mismo que no tener el dato — existe y esta
deliberadamente cerrado.

`null` no es cero, y **cero si es un dato**: se marca `DISPONIBLE`.

`firstObservedAt` de la publicacion es inmutable; `publishedAt` es otra cosa y
se guarda aparte. `serieDeMetrica` no calcula velocidad con un solo punto.

---

### 6 · Preparacion para observacion real — YouTube

`platformAdapterPort.js` declara las cuatro capacidades que Candidate
Intelligence necesita y comprueba cuales cumple realmente el adaptador
disponible, mirando si la funcion existe.

Estado medido hoy:

| Capacidad | Cumple |
|---|---|
| metadatos de cuenta | si (`resolverCanales`) |
| estadisticas de cuenta | si (`part=snippet,statistics`) |
| listado de publicaciones | si (`buscar`) |
| **estadisticas por publicacion** | **NO** |

El adaptador declara `ENDPOINT_VIDEOS` pero **no expone ninguna funcion que lo
use**. En la API de YouTube las cifras por video salen de
`videos.list?part=statistics`, que es una llamada distinta de la busqueda:
`search` no devuelve estadisticas.

Consecuencia: **incluso con la credencial puesta**, el rendimiento por
publicacion no es obtenible hasta que ese adaptador exponga esa funcion. Se
declara `CAPACIDAD_INCOMPLETA` en lugar de fallar en silencio.

Cuota y coste se leen del propio adaptador (`CUOTA_DIARIA_GRATUITA`,
`COSTE_UNIDADES`) y **no se copian a mano ni se estiman**: si no los declarara,
quedarian en `null`.

Comprobar la preparacion **no consume cuota**: solo mira si el adaptador existe
y si la variable de entorno esta definida.

---

### 7 · Integracion y verificacion end-to-end

Medido con el compositor real, sin red:

| | antes | despues de UNA senal |
|---|---|---|
| estado de la cuenta | `DECLARADA` | **`CORROBORADA`** |
| solidez de atribucion | 0 | **25** |
| solidez de identidad | 25 | **43** |

Y la declaracion del analista sigue registrada como `declaracion_del_analista
(no corrobora)` al lado de `web_declarada (independiente)`. Las dos cosas son
verdad y se ven las dos.

---

### 8 · Interfaz

Sin rediseno. Se anade solo lo necesario:

- las senales de cross-link de cada cuenta, con direccion, origen,
  `firstObservedAt`, `lastObservedAt` y numero de observaciones;
- boton **«Ver evidencia»** que solo se dibuja si hay URL canonica;
- estado de las cuatro metricas de rendimiento con lo que le falta a cada una;
- preparacion por plataforma, con la variable de entorno que hace falta;
- snapshots de metricas por publicacion, cada observacion con su instante.

---

### Pruebas

| Suite | Comprobaciones |
|---|---|
| **crossLinkEvidence** | **77** |
| las diecisiete anteriores | 689 |
| **Total** | **766, 0 fallos** |

Sin red: el `fetchImpl` se inyecta. Cubre los quince casos exigidos, mas
anticircularidad, enlaces del mismo dominio, aislamiento entre **dos proyectos
con un candidato del mismo nombre** y ausencia de credenciales en el codigo
—buscando la FORMA de una clave, no una clave concreta—.

### Riesgos y limitaciones

- **La semilla sigue siendo del analista.** Si la web declarada es la
  equivocada, las cuentas que enlace heredan el error. La cadena se guarda
  entera para poder auditarlo, pero el riesgo no desaparece.
- **Los enlaces del mismo dominio se descartan en bloque.** Un candidato con
  dos cuentas legitimas en la misma plataforma enlazadas entre si no obtendra
  corroboracion por esa via. Es el lado conservador a proposito: no se puede
  distinguir de la navegacion.
- **`EXTERNAL_REFERENCE_TO_ACCOUNT` no tiene todavia quien lo alimente.** La
  direccion existe y esta probada, pero ninguna ruta la genera: haria falta leer
  paginas de medios del corpus.
- **El adaptador de YouTube es trabajo de otra linea.** Ya esta integrado
  (`86a2c3d`), asi que el puerto lo resuelve. Si esa rama cambiara su superficie
  —renombrar `buscar` o `resolverCanales`—, el puerto lo detectaria como
  `CAPACIDAD_INCOMPLETA` en lugar de romperse, pero la capacidad se perderia
  hasta ajustarlo.
- Sin `YOUTUBE_API_KEY` no hay ninguna metrica real. Y con ella, faltara todavia
  la funcion de estadisticas por video.

---

## 18-duovicies. P-CAND-03 Prueba real multiplataforma (2026-08-27)

Commit `feat(intelligence): real youtube observation and social capability matrix`.

**805 comprobaciones, 19 suites, 0 fallos.** Primera observacion REAL de
plataforma: **3 unidades de cuota consumidas** de 10.000.

---

### 1 · Cross-link real: sin cross-links, y por que

Ejecutado contra el expediente real. **El candidato patron no tiene web
declarada**, asi que no existe fuente `WEB_TO_ACCOUNT`. La guarda de
anticircularidad dejo pasar exactamente **una** fuente: la pagina de Facebook,
la unica cuenta que Account Resolution considera CORROBORADA y cuya plataforma
admite lectura publica.

    facebook.com/<perfil>   HTTP 200   0 enlaces   SIN_ENLACES

La pagina responde y **no contiene ni un `href`**: Facebook sirve un armazon que
se rellena con JavaScript. Sin ejecutar un navegador no hay enlaces que leer, y
ejecutar un navegador para eludir eso es scraping evasivo.

**La ausencia de cross-links NO es ausencia de identidad.** El expediente sigue
con sus seis cuentas y sus estados; lo que falta es una via de corroboracion,
no la identidad.

#### Correccion de la guarda de anticircularidad

Antes, el origen `ACCOUNT_TO_ACCOUNT` se elegia por `corroboradaPorSentinel` de
la ficha, que solo significa «algun proveedor la devolvio». Eso es **mas laxo**
que el veredicto de Account Resolution, que exige una senal independiente del
nombre: una cuenta que el resolvedor considera CANDIDATA podia usarse como
origen y debilitar la guarda.

Ahora el origen lo decide el resolvedor. No puede haber dos autoridades sobre
lo mismo.

---

### 2 · YouTube real: la via de 3 unidades

`youtubeAdapter.js` tenia `search.list` y `channels.list` por ID. Faltaban tres
piezas, y se anadieron **a ese adapter** en lugar de escribir un segundo cliente:

| Anadido | Endpoint | Coste |
|---|---|---|
| `resolverCanalPorHandle` | `channels.list?forHandle` | 1 unidad |
| `listarSubidas` | `playlistItems.list` | 1 unidad |
| `resolverVideos` | `videos.list?part=snippet,statistics` | 1 unidad |

    100 unidades y una conjetura   frente a   3 unidades y un hecho

La alternativa era `search.list` con el nombre del candidato: 100 unidades y
ordenar por relevancia, es decir, aceptar el criterio de un buscador como
evidencia de identidad. `forHandle` no interpreta nada: devuelve el canal de ESE
handle o no devuelve nada.

#### Resultado medido

    canal        UCF4mSMXUhfbsO6PpiaRGvFA
    titulo       «Jota Lloret (Prefecto de Azuay)»
    handle       @jotalloretv   (del expediente, no de una busqueda)
    suscriptores 26        videos 3        vistas del canal 661
    territorio   ninguno declarado

Tres publicaciones observadas, con `viewCount`, `likeCount` y `commentCount`
reales. Una de ellas tiene **`commentCount = 0`**, que es un dato disponible con
valor cero — distinto de `null`, y el contrato lo distingue.

`shares` no existe en esta API y se declara `NO_DISPONIBLE` en lugar de
inventarse.

---

### 3 · Dos defectos propios, encontrados por la prueba real

Los dos son del mismo tipo: mi codigo violando mi propia doctrina.

#### `null` presentado como 0

Con el corpus vacio, `hechosDistintos` y `dominiosDistintos` valen 0 —agrupar
una lista vacia da cero grupos— y tres dimensiones de presencia se presentaban
como **observadas con valor 0**. Eso afirma «miramos y no hay amplificacion»
cuando lo cierto es «no hay nada que mirar». Ahora la condicion es el corpus,
no la cifra: sin piezas, `null` y motivo.

#### El historico decia «sin observaciones» con nueve snapshots

Las ventanas 7d/30d/90d miran los snapshots de CUENTA, que son 0. Pero habia
**nueve snapshots de metricas** de publicacion. Se anade `historico.metricas`
con una serie por metrica y por publicacion: las nueve en
`HISTORICO_INSUFICIENTE`, que es lo correcto —hay dato, no hay comparacion— en
lugar de un silencio que se lee como «no hay nada».

Un tercer defecto menor: el resumen de la matriz contaba
`medidasEnProduccion: 0` teniendo nueve, por una guarda de filtro que comparaba
contra `null`.

---

### 4 · Matriz de capacidades sociales

`socialCapabilityMatrix.js`. Doce capacidades × cinco plataformas = 60 celdas,
cada una con estado **y** con `verificacion`, que dice como se sabe:

| | disponibles | medidas en produccion | terceros |
|---|---|---|---|
| **YouTube** | 9 | **9** | si |
| TikTok | 2 | 0 | no |
| Facebook | 3 | 0 | no |
| Instagram | 2 | 0 | no |
| X | 11 | 0 | si |

**Solo YouTube tiene capacidades medidas.** Todo lo demas es documentacion
oficial sin comprobar, y se marca como tal: una capacidad documentada puede
caerse el dia que se intente.

#### La distincion que decide todo

    CUENTA PROPIA / AUTORIZADA   el titular nos da permiso
    CUENTA DE TERCERO            no nos lo da

Casi toda la documentacion de las APIs sociales habla del primer caso. Sentinel
hace inteligencia electoral: sus objetivos son terceros que no van a autorizar
nada. YouTube es la **excepcion** del grupo —entrega datos publicos de canales
de terceros sin autorizacion—, y de ahi que sea la unica que funciona hoy.

X es la segunda mejor situada: tecnicamente cubre terceros y es **la unica con
menciones disponibles**, que es justo lo que hace falta para amplificacion. Su
obstaculo no es el permiso, es el plan.

TikTok, Facebook e Instagram exigen autorizacion del titular o programa de
investigacion. Cada una lleva su `rutaConcreta`.

---

### 5 · Las dos cuentas de Instagram

El caso real existe y **se conserva intacto**:

    instagram @jotalloretv         DECLARADA   solidez 0
    instagram @lloretvaldivieso    CANDIDATA   solidez 0

Ninguna se borro, ninguna se fusiono, ninguna se declaro falsa. La pluralidad se
declara en `multiplesPorPlataforma` con su nota, y cada cuenta se sostiene con
sus propias senales: ninguna hereda la corroboracion de la otra.

### Estado final del expediente real

| plataforma | handle | estado | solidez |
|---|---|---|---|
| facebook | juancristobal.lloretvaldivieso | **CONSOLIDADA** | 25 |
| instagram | jotalloretv | DECLARADA | 0 |
| instagram | lloretvaldivieso | CANDIDATA | 0 |
| x | jotalloretv | CANDIDATA | 0 |
| tiktok | jotalloretv | DECLARADA | 0 |
| youtube | jotalloretv | DECLARADA | 0 |

Solidez de identidad **65/100**, reencontrabilidad **100%**.

Cinco de seis cuentas siguen sin senal independiente. Es el resultado correcto:
la unica via de corroboracion disponible —el cross-link— no produjo nada porque
Facebook no entrega enlaces sin JavaScript. **Observar YouTube no ascendio su
cuenta**, y eso es deliberado: poder leer una cuenta no dice de quien es.

---

### Riesgos y limitaciones

- **Cross-link sin fuente utilizable.** Sin web declarada y con Facebook
  sirviendo un armazon de JavaScript, no hay pagina legible que enlace cuentas.
  La via mas barata que queda es cargar la web oficial del candidato si existe.
- **El canal de YouTube es pequeno** —26 suscriptores, 661 vistas—. El pipeline
  esta validado; el volumen de datos que produce es el que hay.
- **Una sola observacion.** No se hizo una segunda para fabricar dos puntos: la
  serie temporal empieza cuando haya una segunda observacion real.
- Cuatro de cinco plataformas sin acceso a terceros. La evaluacion de
  proveedores para TikTok, Facebook, Instagram y X queda como gate propio.

---

## 18-tervicies. SOCIAL-PROVIDER-EVAL-01 (2026-08-27)

Commit `feat(intelligence): x adapter and social access evaluation`.

**842 comprobaciones, 20 suites, 0 fallos.** Cero llamadas reales: X no tiene
credencial todavia y el adapter se niega a salir a la red sin ella.

Evaluacion de las vias reales para observar candidatos que **no administramos**
en TikTok, Facebook, Instagram y X.

---

### La distincion que decide todo

    CUENTA PROPIA / AUTORIZADA   el titular nos da permiso
    CUENTA DE TERCERO            no nos lo da

Casi toda la documentacion de estas APIs describe el primer caso. Sentinel hace
inteligencia electoral: sus objetivos son terceros que no van a autorizar nada.

Y «requiere autorizacion» eran en realidad **dos cosas distintas** que la matriz
mezclaba:

| | quien decide | viable |
|---|---|---|
| **App Review** | la plataforma revisa NUESTRA app | si, es trabajo nuestro |
| **Autorizacion del titular** | el candidato observado | no, en este negocio |

Separarlas cambio el diagnostico de TikTok: no es que falte un permiso que
pedir, es que **ningun programa cubre el caso de uso**.

---

### Matriz: siete estados derivados

`ESTADOS_CELDA` con siete valores, y `celdaDe()` los **deriva** de
`estado` + `verificacion` + `requisito`. No hay una etiqueta paralela que alguien
pueda dejar desincronizada, y un test lo comprueba celda por celda.

| Capacidad | YouTube | X | Instagram | Facebook | TikTok |
|---|---|---|---|---|---|
| Identidad | **MEDIDO** | PLAN_PAGO | OFICIAL | OFICIAL | OFICIAL |
| Cuenta | **MEDIDO** | PLAN_PAGO | APP_REVIEW | OFICIAL | PROVEEDOR |
| Followers | **MEDIDO** | PLAN_PAGO | APP_REVIEW | APP_REVIEW | PROVEEDOR |
| Publicaciones | **MEDIDO** | PLAN_PAGO | APP_REVIEW | APP_REVIEW | PROVEEDOR |
| Views | **MEDIDO** | PLAN_PAGO | NO_DISPONIBLE | AUTORIZACION | PROVEEDOR |
| Likes | **MEDIDO** | PLAN_PAGO | APP_REVIEW | APP_REVIEW | PROVEEDOR |
| Comments | **MEDIDO** | PLAN_PAGO | APP_REVIEW | APP_REVIEW | PROVEEDOR |
| Shares | NO_DISPONIBLE | PLAN_PAGO | NO_DISPONIBLE | APP_REVIEW | PROVEEDOR |
| Menciones | OFICIAL | PLAN_PAGO | NO_DISPONIBLE | AUTORIZACION | PROVEEDOR |
| Busqueda | **MEDIDO** | PLAN_PAGO | NO_DISPONIBLE | NO_DISPONIBLE | NO_DISPONIBLE |
| Historico | NO_DISPONIBLE | PLAN_PAGO | NO_DISPONIBLE | NO_DISPONIBLE | NO_DISPONIBLE |
| URL verificable | **MEDIDO** | OFICIAL | OFICIAL | OFICIAL | OFICIAL |

De 60 casillas: 9 medidas, 11 tras un plan de pago, 11 inexistentes, 10 tras App
Review, 9 oficialmente disponibles, 8 solo por proveedor y 2 dependientes del
titular.

**Las nueve medidas son todas de YouTube.**

Dos correcciones que salieron al precisar la matriz, y las dos hacia peor:

- `menciones` de YouTube pasa a DISPONIBLE: `search.list` las encuentra con la
  credencial que ya tenemos. Resulta que **YouTube es la unica plataforma cuyas
  menciones se pueden pedir hoy**; las de X existen y estan detras de un plan.
- Las metricas de TikTok pasan de REQUIERE_AUTORIZACION a REQUIERE_PROVEEDOR.
  Decir «requiere autorizacion» sugeria un permiso que pedir, y no lo hay.

Los dos tests que afirmaban lo anterior se reescribieron hacia el invariante
real, que es mas fuerte: **ninguna celda puede llamarse MEDIDO sin haberse
medido**, en las cinco plataformas.

---

### X — adapter completo, esperando credencial

`services/ingest/adapters/xAdapter.js`, con la misma forma que el de YouTube
—`ID`, `estaConfigurado`, `diagnostico`, estado `SIN_CREDENCIAL`— para que entre
en el registro de la linea de ingesta sin adaptaciones.

    GET /2/users/by/username/:username
    GET /2/users/:id/tweets
    GET /2/tweets/search/recent

**Sin `X_BEARER_TOKEN` no hace ni una peticion.** No es que falle: no lo
intenta, y hay un test por cada funcion que lo comprueba contando llamadas.

Cuatro decisiones del adapter que conviene conocer:

- **Repost y cita se guardan separados.** Uno amplifica sin anadir nada, el otro
  comenta. Sumarlos borra la diferencia.
- **`impression_count` ausente es `NO_INCLUIDA_POR_LA_API`, no 0.** Su
  disponibilidad para publicaciones de terceros es lo primero que habra que
  comprobar en la llamada real.
- **La marca de verificado NO corrobora nada**: en X es una suscripcion de pago,
  no una comprobacion de identidad. Viaja con esa advertencia para que nadie la
  use como senal de atribucion.
- **Un 403 se distingue de un 429**: el primero suele significar «tu plan no
  incluye este endpoint» y el segundo «espera». Uno se resuelve contratando y el
  otro esperando.

`COSTE_POR_LLAMADA` es **`null`**. El precio depende del plan y ha cambiado
varias veces; un numero inventado aqui se convertiria en una linea de
presupuesto. Se cuentan llamadas, que si se pueden contar sin saber el precio.

#### Por que X es la siguiente

Es la unica pendiente que cubre terceros sin autorizacion del titular, la unica
que entrega **menciones** —la mitad que le falta a Candidate Intelligence, que
hoy solo mide lo que publica el candidato— y la unica cuyo obstaculo es una
decision nuestra en lugar de una solicitud que otro tiene que aprobar.

---

### Instagram, Facebook, TikTok

**Instagram — Business Discovery.** No necesita permiso del observado: necesita
que NOSOTROS tengamos cuenta profesional propia vinculada a una pagina de
Facebook y una app revisada por Meta. Y que el objetivo sea cuenta
**profesional**; las personales quedan fuera. Da identidad, seguidores,
publicaciones con permalink, likes y comentarios. NO da reproducciones de reels
de terceros, ni compartidos, ni menciones. Coste de licencia 0; el coste es
tiempo de revision.

**Facebook — Page Public Content Access.** Existe una via para terceros y no hay
que confundirla: el permiso lo concede Meta a nuestra app, no el titular de la
pagina. Con el se leen publicaciones, reacciones, comentarios y compartidos de
paginas ajenas. **Los perfiles personales quedan fuera de todo** — y el candidato
patron tiene precisamente un perfil personal, no una pagina.

**TikTok — tres APIs y ninguna sirve.** Display API opera sobre la cuenta que
inicia sesion; Research API cubre terceros pero su elegibilidad esta orientada a
investigacion academica sin animo de lucro; Commercial Content API solo cubre
contenido publicitario. **No se asume que podamos solicitar ni usar la Research
API.** La via realista es un proveedor con licencia.

---

### Evaluacion de proveedores

`docs/SOCIAL-PROVIDER-EVAL.md`. Ficha a rellenar, no recomendacion: **no se ha
contactado a ningun proveedor**. Shortlist de seis suites con cobertura Ecuador y
precio **sin verificar** en todas.

Dos criterios **eliminatorios**, y conviene tenerlos claros antes de mirar
precios:

1. **Sin derechos de almacenamiento no hay Candidate Intelligence.** Todo el
   modelo longitudinal depende de guardar snapshots. Un proveedor que solo
   permita consultar en vivo no sirve, por bueno que sea.
2. **Sin URL canonica por pieza, incumple evidence-first.** Una cifra sin enlace
   verificable no se puede publicar en este sistema.

Los precios figuran como `null` en todo el documento. No los conozco, cambian, y
estimarlos en un documento de decision seria peor que dejar el hueco.

### Riesgos y limitaciones

- **Lo unico verificado de X es la forma de los endpoints.** Que el plan
  contratado incluya lectura de timelines de terceros y `impression_count` esta
  por comprobar, y solo se comprueba pagando.
- **Instagram y Facebook dependen de una decision de Meta**, no nuestra. La App
  Review puede rechazar el caso de uso y no consta cuanto tarda.
- **El candidato patron tiene perfil personal de Facebook**, que ningun permiso
  abre. Conviene contar cuantos candidatos usan pagina antes de invertir en la
  revision.
- El adapter de X esta escrito y **nunca se ha ejecutado**. Su primera llamada
  real puede desmentir cualquiera de sus supuestos.

---

## 18-quatervicies. X-REAL-01 (2026-08-28)

Commit `feat(candidate): validate real X intelligence`.

**891 comprobaciones, 22 suites, 0 fallos.** Una sola llamada real, cero
reintentos.

### El resultado

    GET /2/users/by/username/<handle del expediente>
    → HTTP 402 Payment Required

    X_API_CREDENTIAL_OK_BUT_BILLING_BLOCKED

La cuenta esta en Pay-Per-Use con saldo cero. La secuencia se detuvo en la
primera llamada: no se pidio el timeline, no se pidieron menciones, no hubo
reintento.

#### Lo que un 402 dice y lo que no

    SI dice   que la credencial NO fue rechazada. Un token invalido
              devuelve 401, no 402.
    NO dice   que los demas endpoints funcionen. No se probaron.

Esa distincion es la razon de que la matriz ahora tenga dos etiquetas donde
antes tenia una: `REQUIERE_CREDITOS` para lo que se intento y fallo por saldo,
y `NO_PROBADO` para lo que se infiere cerrado por lo mismo pero no se llego a
pedir. Inferir es razonable; llamarlo medicion, no.

### Un defecto propio que encontro la prueba

El adapter devolvio `motivo: "HTTP 402"` **sin** el campo `httpStatus`, y mi
primer clasificador —que solo miraba el campo numerico y unas palabras clave—
lo etiqueto `ERROR`.

La parada fue correcta: se detuvo y no reintento. Pero el diagnostico habria
mandado a revisar el token cuando lo que faltaba era saldo. Ahora
`clasificarBloqueo` lee el codigo **tambien del texto**, y separa cuatro causas
que se parecen en pantalla y no se arreglan igual:

| codigo | significa | accion | reintentable |
|---|---|---|---|
| 401 | el token no vale | revisar credencial | no |
| 402 | hace falta pagar | cargar saldo | no |
| 403 | el plan no lo cubre | contratar otro nivel | no |
| 429 | demasiadas peticiones | esperar | si |

Solo uno de los cuatro es reintentable, y aun asi no se reintenta aqui: esperar
lo decide quien programa la siguiente observacion, no un bucle.

### Columna de X, con lo medido y lo inferido

| Capacidad | Celda | Como se sabe |
|---|---|---|
| identidad · cuenta · followers | `REQUIERE_CREDITOS` | **medido**: 402 |
| publicaciones · views · likes · comments · shares · menciones · busqueda | `NO_PROBADO` | inferido |
| historico | `REQUIERE_PLAN_PAGO` | otro nivel, no saldo |
| url_verificable | `OFICIAL_DISPONIBLE` | se construye sin API |

El archivo completo se deja aparte a proposito: aunque hubiera credito, ese
endpoint seguiria fuera del nivel contratado. Son dos obstaculos distintos.

### `observarX`

Traduce X al MISMO contrato comun que YouTube. Un post de X y un video de
YouTube son `PublicationObservation` con `platformId` distinto; no hay un
modelo paralelo.

Dos llamadas —perfil y timeline—, porque en X las metricas vienen EN el propio
post y no hace falta una tercera como `videos.list`. Un bloqueo detiene la
secuencia conservando lo ya leido: si el perfil salio bien y el timeline dio
429, las metricas de cuenta no se tiran.

### No se toco el adapter

`xAdapter.js` tenia trabajo sin commitear de la linea de Media (MEDIA-PIECE-02:
`resolverPosts` y la metrica `bookmarks`). **No se toco, no se stageo, no se
revirtio.** La clasificacion de bloqueos vive por eso en
`candidateObservation.js`, que es fichero propio — y ahi encaja igual de bien:
es logica de observacion, no de transporte.

### Riesgos y limitaciones

- **Sin saldo no hay nada de X.** Ni perfil, ni publicaciones, ni menciones. Y
  las menciones son la mitad que le falta a Candidate Intelligence: hoy solo
  mide lo que publica el candidato.
- **Siete capacidades siguen sin probar.** Que el 402 las cubra a todas es una
  inferencia razonable, no un hecho medido.
- **`impression_count` sigue sin comprobarse** para publicaciones de terceros.
  Era el objetivo de la segunda llamada y no se llego.
- **No se conoce el coste.** La cuenta es Pay-Per-Use y no consta cuanto cuesta
  cada llamada: `COSTE_NO_RESUELTO`.

---

## 18-quinvicies. X-REAL-01 reanudado — X operativo (2026-08-28)

Commit `feat(candidate): real X observation with live metrics`.

**897 comprobaciones, 22 suites, 0 fallos.** Dos llamadas reales, cero
reintentos.

Cargado el credito, se reanudo exactamente donde quedo el 402.

    GET /2/users/by/username   → HTTP 200
    GET /2/users/:id/tweets    → HTTP 200

### Perfil real

    id            242787369
    username      @jotalloretv          (del expediente, no de una busqueda)
    name          Jota Lloret Valdivieso
    created_at    2011-01-25
    followers     29.413
    following     2.458
    tweet_count   25.317
    verified      false

`listed_count` **no se capturo**, y conviene decirlo bien: no es que X no lo
devuelva, es que nuestro normalizador no lo mapea. La diferencia importa —una
cosa es un limite de la fuente y otra un hueco nuestro—.

### Las dos metricas que estaban en duda LLEGARON

`impression_count` y `bookmark_count`, en las cinco publicaciones. Eran la
incognita del gate y no hizo falta un nivel superior.

Seis metricas por publicacion, todas `DISPONIBLE`: likes, reposts, comments,
quotes, views y bookmarks.

### El hallazgo con mas consecuencias

**Tres de las cinco publicaciones eran retweets.** Y en un retweet X devuelve:

    like_count    0
    reply_count   0
    quote_count   0
    retweet_count 7      ← si trae valor
    impression_count 72  ← si trae valor

Las reacciones pertenecen al post original, no al acto de republicar. **No son
ceros reales de esa cuenta.**

Promediar retweets con publicaciones propias hunde cualquier media de
interaccion y haria parecer inactiva a una cuenta que en realidad amplifica
mucho. Con estos cinco posts, la media de likes sale 76 contando los retweets y
**190 sin ellos**: dos veces y media de diferencia por un detalle de contrato.

`normalizarPost` ya marca `esRepost`, `esCita` y `esRespuesta` desde
`referenced_tweets`. El filtro existe; hay que usarlo ANTES de cualquier
promedio, y el aviso viaja dentro de `medicionReal` para que no se olvide al
construir el benchmark.

### Contrato comun, comprobado

El Lake guarda ahora **8 publicaciones del mismo candidato: 3 de YouTube y 5 de
X**, en el mismo `PublicationObservation`, con 39 snapshots de metricas. Un post
de X y un video de YouTube son la misma cosa con `platformId` distinto: no hay
modelo paralelo, y ahora esta medido y no solo afirmado.

Relectura desde el Lake verificada: `publicationId`, `candidateId`, `accountId`,
`platformId`, `canonicalUrl`, `publishedAt`, `firstObservedAt`,
`lastObservedAt`, `evidenceId`, `provider` y las seis metricas con su instante.

Las 24 series de metricas quedan en `HISTORICO_INSUFICIENTE`: una sola
observacion. No se fabrico tendencia y no se hizo una segunda llamada para
inventar dos puntos.

### Columna de X

| Capacidad | Celda |
|---|---|
| identidad · cuenta · followers | **MEDIDO** |
| publicaciones · views · likes · comments · shares | **MEDIDO** |
| url_verificable | **MEDIDO** |
| menciones · busqueda | `NO_PROBADO` |
| historico | `REQUIERE_PLAN_PAGO` |

Nueve de doce medidas. Las menciones **no se probaron**: quedaban fuera del
presupuesto de este gate, y no se llaman disponibles por no haberse intentado.
El archivo completo sigue fuera aunque haya saldo: `search/all` es cuestion de
nivel, no de credito.

El 402 anterior **se conserva** en `medicionReal.historial`. Es la unica prueba
de que un Payment Required significaba saldo y no credencial, y esa leccion vale
mas que el estado actual.

### Riesgos y limitaciones

- **Los retweets contaminan cualquier promedio** si no se filtran. Es el riesgo
  concreto para el benchmark multicandidato.
- **Las menciones siguen sin probar**, y son la mitad que le falta a Candidate
  Intelligence: hoy solo mide lo que publica el candidato.
- **No se conoce el coste por llamada.** Se gastaron 2 requests de un saldo de
  25 USD; X no devolvio informacion de consumo en la respuesta y no se estima.
- Una sola observacion: la serie temporal empieza en la segunda.

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
| **Candidate Intelligence V1** | 🟢 **IMPLEMENTADO** (§18-vicies): Account Resolution, series longitudinales, amplificacion con deduplicacion, contratos de Media y Territorio, presencia observada sin indice y solidez v2 |
| **CANDIDATE-LONGITUDINAL-01** | 🟢 **ARQUITECTURA CONGELADA**: las observaciones se agregan, no reemplazan |
| **OBSERVED-PRESENCE-01** | 🟢 **ARQUITECTURA CONGELADA**: la presencia observada no es intencion de voto ni apoyo |
| Indice compuesto de presencia digital | 🔴 **NO DISPONIBLE a proposito**. Faltan metodologia, normalizacion, deduplicacion total, ventanas comparables y cobertura. No se publicara antes |
| Corpus de evidencias de los candidatos ya existentes | 🔴 arranca vacio: las investigaciones anteriores guardaron recuentos, no piezas. Se llena desde la siguiente investigacion real |
| Enlaces cruzados como senal independiente | 🟢 **IMPLEMENTADO** (§18-unvicies): tres direcciones, deduplicacion por identidad de relacion, `firstObservedAt` inmutable y anticircularidad. Verificado end-to-end: una cuenta DECLARADA pasa a CORROBORADA con una sola senal real |
| **P-CAND-03 Prueba real multiplataforma** | 🟢 **IMPLEMENTADO** (§18-duovicies): YouTube real con 3 unidades, matriz de 60 celdas, dos defectos propios corregidos |
| Estadisticas por publicacion de YouTube | 🟢 **RESUELTO**: `resolverVideos`, `resolverCanalPorHandle` y `listarSubidas` anadidos al adapter existente. Medido en produccion |
| Web declarada del candidato patron | 🔴 **no existe en el expediente**. Es la fuente `WEB_TO_ACCOUNT` que falta y la via de corroboracion mas barata que queda |
| Cross-link desde paginas con JavaScript | 🔴 Facebook responde 200 y no entrega ni un `href`. Sin navegador no hay enlaces, y usar uno seria scraping evasivo |
| **SOCIAL-PROVIDER-EVAL-01** | 🟢 **COMPLETADO** (§18-tervicies): matriz de 60 casillas con siete estados derivados, adapter de X completo y `docs/SOCIAL-PROVIDER-EVAL.md` |
| **X_BEARER_TOKEN** | 🟢 **CONFIGURADO Y ACEPTADO**. Probado en X-REAL-01: la API devuelve 402, no 401, asi que la credencial no fue rechazada |
| **Saldo de la cuenta X** | 🟢 **RESUELTO**: cargado credito, el 402 desaparecio y las dos llamadas devuelven 200 |
| **X operativo** | 🟢 **MEDIDO** (§18-quinvicies): 9 de 12 capacidades. Perfil, publicaciones y las seis metricas por publicacion |
| `impression_count` y `bookmark_count` de terceros | 🟢 **CONFIRMADAS**: llegaron en las cinco publicaciones. Era la incognita del gate |
| **Retweets en los promedios** | 🔴 **RIESGO ABIERTO para el benchmark**: en un retweet, likes/replies/quotes valen 0 porque son del post original. Con la muestra real, la media de likes pasa de 76 a 190 al filtrarlos. Usar `esRepost` ANTES de promediar |
| Menciones de X | 🔴 `NO_PROBADO`. `search/recent` quedaba fuera del presupuesto de este gate. Es la mitad que le falta a Candidate Intelligence |
| `listed_count` de X | 🔴 no lo mapea nuestro normalizador. Hueco propio, no limite de la fuente |
| Coste por llamada de X | 🔴 `COSTE_NO_RESUELTO`. 2 requests gastadas de 25 USD; X no devolvio consumo en la respuesta y no se estima |
| Archivo completo de X | 🔴 `search/all` sigue fuera: es cuestion de nivel, no de saldo |
| Precio real del plan de X | 🔴 `null`. Depende del plan y ha cambiado varias veces: se verifica en el portal, no se estima |
| Instagram Business Discovery | 🟡 **via identificada**: cuenta profesional propia + App Review de Meta. Coste de licencia 0, coste en tiempo de revision. Depende de una decision de Meta |
| Facebook Page Public Content Access | 🟡 **via identificada** para paginas. Los PERFILES personales no los abre ningun permiso, y el candidato patron tiene perfil |
| TikTok | 🔴 **ningun programa oficial cubre el caso de uso**. Display API exige login del titular, Research API no es elegible para uso comercial, Commercial Content API solo cubre publicidad. Unica via: proveedor con licencia |
| Registrar `x_api` en `providerAudit.js` | 🔴 fichero de Terminal 2. El adapter existe y su matriz de proveedores todavia no lo lista |
| Evaluacion de proveedores TikTok/Facebook/Instagram/X | 🟡 **ficha preparada**, ningun proveedor contactado. Dos criterios eliminatorios: derechos de almacenamiento y URL canonica por pieza |
| Segunda observacion real de YouTube | 🔴 la serie temporal empieza con ella. No se hizo una segunda llamada para fabricar dos puntos |
| **P-CAND-02 Cross-Link Evidence** | 🟢 **IMPLEMENTADO** (§18-unvicies) |
| **Contrato evidence-first** | 🟢 **IMPLEMENTADO**: `insight → metric → evidenceId → source → observedAt → canonicalUrl`. Una afirmacion sin la cadena completa no se publica |
| Metricas de rendimiento (absolute, relative, velocity, amplification) | 🔴 **contratos definidos, ninguna disponible**. Cada una declara su metodologia y sus requisitos. NO existe etiqueta «viral» |
| **YOUTUBE_API_KEY** | 🔴 **ACCION REQUERIDA DE DAVID**. Sin ella no hay ninguna metrica real. Ver §18-unvicies punto 6 |
| Estadisticas por publicacion de YouTube | 🔴 el adaptador de la linea de ingesta declara `ENDPOINT_VIDEOS` pero no expone funcion que lo use: `videos.list?part=statistics` es una llamada distinta de `search`. **Incluso con credencial, el rendimiento por publicacion no es obtenible hasta que exista** |
| `EXTERNAL_REFERENCE_TO_ACCOUNT` sin alimentador | 🔴 la direccion existe y esta probada; ninguna ruta la genera todavia |
| Enlaces del mismo dominio como corroboracion | 🟡 **descartados a proposito**: no se distinguen de la navegacion del sitio. Dos cuentas legitimas de la misma plataforma enlazadas entre si no corroboran por esa via |
| Media Intelligence | 🟡 **contrato definido** (`CONTRATO_MEDIA_RELATION`), `disponibleHoy: false`. El modulo pertenece a otra linea |
| Vinculo candidato x territorio | 🟡 **contrato definido**; no vinculara nada hasta que las evidencias lleguen con contrato de GEO-1 |
| Huella digital volatil segun la respuesta del proveedor | 🟢 **BUG-16 CORREGIDO EN EL MODELO** (§18-vicies): solidez v2 sobre el inventario consolidado, separada de la reencontrabilidad. Probado que la cifra no cambia cuando un buscador falla. La formula v1 sigue alimentando la tarjeta compacta. Original: 🟡 **mitigado en la interfaz** (§18-sexdecies): renombrada «Solidez del expediente», con aclaracion y escala neutra. La formula y la volatilidad siguen. Original: **BUG-16**: 22 % → 53 % en el mismo dia, +17 por un buscador que contesto. Riesgo de lectura politica |
| TikTok recibe una sola consulta, sin pasada de reserva | 🔴 la propagada existio pero con el handle equivocado y dio Error. Ver BUG-17 y BUG-18 |
| Profile-first: propietario legible en ruta de contenido | 🟢 **CONFIRMADO EN PRODUCCION** (§18-terdecies): `@segundo.cabrera82` entro como candidato y el clasificador lo rechazo |
| `site:youtube.com` devuelve videos, no canales | 🟡 **Handle Propagation** pregunta por handle, que apunta a canal. Pendiente prueba real |
| **P-CAND-UX-03 Flujo y fotografia** | 🟢 **IMPLEMENTADO** (§18-duodevicies). Pendiente prueba visual |
| **P-CAND-UX-02 Edicion de identidad** | 🟢 **CONFIRMADO CON DATOS REALES** (§18-duodevicies): TikTok y YouTube persistidos como declarados, Facebook con las dos procedencias |
| **P-CAND-UX-04 Resolver de fotografia** | 🟢 **IMPLEMENTADO** (§18-undevicies). Pendiente prueba real |
| **P-CAND-AI-01 Account Intelligence Fase 1** | 🟢 **IMPLEMENTADO** (§18-undevicies): contratos, observacion, snapshots append-only, temas propios, mapa de capacidades y workspace. **Sin puntuacion ni ranking** |
| **ACCOUNT-PROVIDER-GAPS** | 🟡 **documentado** en `docs/ACCOUNT-PROVIDER-GAPS.md`. Alimenta DATA-PROVIDER-EVAL. Precios `null`: no se estiman |
| Acceso a metricas de redes sociales | 🔴 **P0 de producto**: de siete plataformas solo la web propia permite lectura. YouTube Data API es el unico acceso gratuito real |
| Account Intelligence completo (publicaciones, series, momentum) | 🔴 Fase 1 sienta contratos; el motor completo sigue pendiente |
| Change Attribution | 🔴 contrato reservado en los snapshots, sin implementar |
| Fotografia derivada de cuentas sociales | 🟡 **resolver implementado**; sigue no obtenible en las seis redes: no hay API y el scraping esta excluido. Original: 🔴 **no obtenible**: no hay API de plataforma y el scraping esta excluido. Declarado en `fotoNoDisponible` |
| **P-CAND-UX-01 Identidad Asistida por Analista** | 🟢 **IMPLEMENTADO** (§18-sexdecies). Pendiente cargar identidad real desde la interfaz. Nota original: **La prueba del 25-ago lo confirma como necesario**: el analista vio «42 %, 2 cuentas» sin poder ver que Instagram se hallo ayer y hoy no, que 8 de 14 consultas no respondieron, ni por que se rechazo el candidato de TikTok. Todo eso ya esta en la traza |
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
| **P-CAND-01** — estabilidad de identidad | 🟢 **VALIDADO FUNCIONALMENTE / provider-limited** (§18-quindecies). Ninguna cuenta consolidada desaparecio |
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

**ADR-021 — La corroboracion exige evidencia externa, nunca parecido**
Decision: una cuenta asciende solo con una senal independiente del nombre.
Coincidencia de nombre, coincidencia de handle y declaracion del analista
aportan 0. Un enlace cruzado corrobora porque alguien distinto de Sentinel
publico la asociacion.
Motivo: mil formas de comprobar que el nombre coincide siguen sin decir de
quien es la cuenta. Y si la declaracion del analista contara, Sentinel se
estaria confirmando a si mismo.
Estado: Vigente. Gate: P-CAND-02 (§18-unvicies).

**ADR-022 — Las metricas son snapshots, no campos**
Decision: cada observacion de una metrica se anade a una serie con su
`observedAt`, `provider`, `source` y `availability`. Ninguna sustituye a otra.
`firstObservedAt` es inmutable.
Motivo: sustituir 100k por 150k destruye el punto anterior, que es lo unico que
permitia saber que crecio.
Estado: Vigente. Gate: P-CAND-02 (§18-unvicies).

**ADR-023 — Puerto de adaptadores en lugar de adaptador propio**
Decision: Candidate Intelligence declara las capacidades que necesita y resuelve
el adaptador en caliente. Ausencia y capacidad incompleta son resultados, no
excepciones.
Motivo: la linea de ingesta ya tiene un adaptador de YouTube completo. Escribir
otro habria duplicado un motor; importarlo de forma rigida habria atado
Candidate Intelligence a un fichero que no esta en git.
Estado: Vigente. Gate: P-CAND-02 (§18-unvicies).

**ADR-018 — CANDIDATE-LONGITUDINAL-01: las observaciones se agregan**
Decision: cada candidato mantiene series append-only —snapshots de cuenta,
snapshots de identidad y lotes de evidencias— en entidades propias del Lake.
Motivo: las preguntas de un analista de campana son sobre el pasado, y una
escritura destructiva las borra todas de golpe.
Estado: Vigente, congelada. Gate: Candidate Intelligence V1 (§18-vicies).

**ADR-019 — OBSERVED-PRESENCE-01: presencia observada, no apoyo**
Decision: las dimensiones observables se publican; el indice compuesto queda
`NO_DISPONIBLE` con sus requisitos enumerados. Etiqueta de interfaz
«PRESENCIA DIGITAL OBSERVADA».
Motivo: un numero unico por candidato se leeria como un ranking electoral, y
hoy mediria el estado de nuestras fuentes y no al candidato.
Estado: Vigente, congelada. Gate: Candidate Intelligence V1 (§18-vicies).

**ADR-020 — La solidez del expediente no depende de la ultima ejecucion**
Decision: solidez de identidad sobre el inventario consolidado, separada de la
reencontrabilidad actual. Nunca se multiplican ni se restan.
Motivo: penalizar el expediente porque un buscador no respondio convierte la
metrica en un termometro del proveedor. Absence of evidence != evidence of
absence.
Estado: Vigente. Gate: Candidate Intelligence V1 (§18-vicies).

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
| 2026-08-28 | X-REAL-01 reanudado | Cargado el credito, se reanudo la prueba donde quedo el 402. Dos llamadas, dos HTTP 200: perfil real con 29.413 seguidores y cinco publicaciones con seis metricas cada una. Las dos que estaban en duda —`impression_count` y `bookmark_count`— llegaron, y no hizo falta un nivel superior. El hallazgo con mas consecuencias no fue una cifra sino un detalle de contrato: tres de las cinco publicaciones eran retweets, y en un retweet X devuelve likes, replies y quotes a 0 porque las reacciones pertenecen al post original. No son ceros reales de la cuenta. Con esta misma muestra la media de likes pasa de 76 a 190 al filtrar los retweets: dos veces y media de diferencia, y el riesgo concreto para el benchmark multicandidato. `normalizarPost` ya marca `esRepost` desde `referenced_tweets`, y el aviso viaja dentro de la medicion para que no se olvide. El Lake guarda ahora 8 publicaciones del mismo candidato —3 de YouTube y 5 de X— en el mismo contrato y con 39 snapshots: que un post y un video sean la misma cosa con platformId distinto deja de ser una afirmacion y pasa a estar medido. Las 24 series quedan en HISTORICO_INSUFICIENTE y no se hizo una segunda llamada para fabricar dos puntos. Nueve de doce capacidades de X medidas; menciones y busqueda siguen NO_PROBADO por presupuesto, y no se llaman disponibles por no haberse intentado. El 402 anterior se conserva en el historial de la medicion. 897 pruebas, 0 fallos. Nueva §18-quinvicies. |
| 2026-08-28 | X-REAL-01 | Prueba real controlada de X con la credencial ya configurada. Una sola llamada, cero reintentos: `GET /2/users/by/username` devolvio HTTP 402 Payment Required. La cuenta esta en Pay-Per-Use con saldo cero, asi que la conclusion es X_API_CREDENTIAL_OK_BUT_BILLING_BLOCKED: un token invalido habria devuelto 401, de modo que la credencial no fue rechazada. La prueba encontro ademas un defecto propio: el adapter devolvio el codigo dentro del texto y sin campo `httpStatus`, y mi clasificador lo etiqueto ERROR — la parada fue correcta pero el diagnostico habria mandado a revisar el token en lugar del saldo. Ahora `clasificarBloqueo` lee el codigo tambien del texto y separa cuatro causas que se parecen y no se arreglan igual: 401 credencial, 402 saldo, 403 plan, 429 espera, con solo la ultima reintentable y aun asi sin bucle. La matriz gana dos etiquetas para no confundir medir con inferir: REQUIERE_CREDITOS para las tres capacidades que sirve el endpoint probado, NO_PROBADO para las siete que no se llegaron a pedir. `observarX` traduce X al mismo contrato comun que YouTube —un post y un video son PublicationObservation con platformId distinto— y un bloqueo detiene la secuencia conservando lo ya leido. No se toco `xAdapter.js`, que tenia trabajo sin commitear de la linea de Media. 891 pruebas, 0 fallos. Nueva §18-quatervicies. |
| 2026-08-27 | SOCIAL-PROVIDER-EVAL-01 | Evaluacion de las vias reales para observar candidatos que no administramos en las cuatro plataformas pendientes. El hallazgo que reordena todo: «requiere autorizacion» eran dos cosas distintas —que la plataforma revise NUESTRA app, que es trabajo nuestro, y que el observado nos de permiso, que es imposible en inteligencia electoral—. Separarlas cambio el diagnostico de TikTok: no falta un permiso que pedir, es que ningun programa cubre el caso de uso. Matriz de 60 casillas con siete estados DERIVADOS de estado + verificacion + requisito, con un test que comprueba celda por celda que no hay etiqueta paralela desincronizada. Al precisarla salieron dos correcciones hacia peor: las menciones de YouTube son alcanzables hoy con la credencial que ya tenemos —resulta que es la unica plataforma donde lo son— y las metricas de TikTok pasan a REQUIERE_PROVEEDOR. Los dos tests que afirmaban lo anterior se reescribieron hacia un invariante mas fuerte: ninguna celda puede llamarse MEDIDO sin haberse medido. Adapter de X completo con la misma forma que el de YouTube, que sin credencial NO hace ni una peticion —no es que falle: no lo intenta, y hay un test por funcion contando llamadas—. Repost y cita separados, `impression_count` ausente marcado NO_INCLUIDA_POR_LA_API y no 0, la marca de verificado declarada explicitamente como no evidencia porque es una suscripcion de pago, y 403 distinguido de 429 porque uno se resuelve contratando y el otro esperando. `COSTE_POR_LLAMADA` en null: el precio depende del plan y estimarlo seria una linea de presupuesto inventada. `docs/SOCIAL-PROVIDER-EVAL.md` con shortlist de seis proveedores, ninguno contactado, todos los precios null y dos criterios eliminatorios: sin derechos de almacenamiento no hay modelo longitudinal, y sin URL canonica se incumple evidence-first. 842 pruebas, 0 fallos, cero llamadas reales. Nueva §18-tervicies. |
| 2026-08-27 | P-CAND-03 Prueba real | Primera observacion REAL de plataforma: 3 unidades de cuota de 10.000. Se anaden al adapter existente `resolverCanalPorHandle`, `listarSubidas` y `resolverVideos` —las tres piezas que faltaban— en lugar de escribir un segundo cliente de YouTube. La via cuesta 3 unidades frente a las 100 de `search.list`, y sobre todo no interpreta nada: `forHandle` devuelve el canal de ESE handle o ninguno, mientras que buscar el nombre habria sido aceptar el criterio de relevancia de un buscador como evidencia de identidad. Canal resuelto con 26 suscriptores y 3 publicaciones con views, likes y comentarios reales; un `commentCount = 0` que es dato disponible y no `null`. Cross-link real ejecutado: sin web declarada, la unica fuente legible era Facebook, que responde 200 y no entrega ni un `href` porque se rellena con JavaScript. La ausencia de cross-links no es ausencia de identidad y se declara asi. Corregida la guarda de anticircularidad, que elegia el origen por una bandera mas laxa que el propio veredicto del resolvedor. Y dos defectos propios que encontro la prueba real: tres dimensiones de presencia mostraban 0 donde debia haber `null` —«miramos y no hay» en lugar de «no hay nada que mirar»—, y el historico decia «sin observaciones» teniendo nueve snapshots de metricas. Matriz de 60 celdas donde cada una declara si es medida o solo documentada: solo YouTube esta medida. Las dos cuentas de Instagram intactas. Observar YouTube NO ascendio su cuenta, que es el comportamiento correcto. 805 pruebas, 0 fallos. Nueva §18-duovicies. |
| 2026-08-26 | P-CAND-02 Cross-Link | Se cierra el hueco declarado de V1: `enlacesCruzados` ya no llega vacio. Tres direcciones —WEB_TO_ACCOUNT, ACCOUNT_TO_ACCOUNT, EXTERNAL_REFERENCE_TO_ACCOUNT— con senal de resolucion distinta cada una, deduplicacion por `relationId` estable y `firstObservedAt` inmutable: cien observaciones del mismo enlace dan 25 puntos de solidez, no 100. Anticircularidad: una cuenta sin corroborar no puede corroborar a otra. Hallazgo de las pruebas: los enlaces relativos de una pagina social se resuelven a perfiles falsos —`facebook.com/contacto`— y habrian fabricado una cuenta corroborada por cada elemento del menu; se descartan por mismo dominio y se declara el descarte. Contrato evidence-first que RECHAZA afirmaciones sin cadena completa hasta la evidencia primaria; cuatro tipos de metrica declarados y ninguno disponible; ninguna etiqueta «viral», y la palabra invalida la afirmacion. Metricas como snapshots: 100k ayer y 150k hoy son dos observaciones. Puerto de adaptadores en lugar de duplicar el adaptador de YouTube que ya existe en la linea de ingesta; se detecta que le falta `videos.list?part=statistics`, asi que el rendimiento por publicacion no sera obtenible ni con credencial. Verificado end-to-end sin red: DECLARADA/0 pasa a CORROBORADA/25 y la solidez de identidad de 25 a 43. 766 pruebas, 0 fallos. Nueva §18-unvicies. |
| 2026-08-25 | Candidate Intelligence V1 | Sentinel pasa de investigar un candidato a mantener un expediente longitudinal. Dos principios congelados: CANDIDATE-LONGITUDINAL-01 (las observaciones se agregan, no reemplazan) y OBSERVED-PRESENCE-01 (la presencia observada no es intencion de voto ni apoyo). Account Resolution con ocho estados y senales independientes frente a senales que dependen del nombre: una cuenta no pasa a corroborada por parecido de nombre ni por declaracion del analista. Ventanas 7d/30d/90d/campana con «historico insuficiente» en lugar de tendencias de un punto. Snapshots de identidad y corpus de evidencias append-only: el expediente guardaba recuentos y ahora guarda piezas, que es lo que permite deduplicar. Amplificacion separa presencia propia de ganada y da tres cifras distintas —piezas, hechos, fuentes—: diez cabeceras replicando una nota son un hecho. Cuatro planos de conversacion con `personas: null`. Contratos de Media y Territorio definidos y declarados no disponibles; territorio solo acepta lo que GEO-1 autoriza y bloquea IP, dispositivo y usuario por nombre. Presencia digital observada con seis dimensiones y indice compuesto NO DISPONIBLE. BUG-16 corregido en el modelo: solidez v2 sobre el inventario consolidado, probada identica antes y despues de un fallo de buscador, con la reencontrabilidad al lado y nunca restada. Workspace de diez secciones; ficha compacta intacta. 689 pruebas, 0 fallos. Nueva §18-vicies. |
| 2026-08-25 | P-CAND-UX-04 + AI-01 | Resolver de fotografia desde fuentes declaradas: metadata publica estandar, prioridad centralizada, validacion de recurso, descarte de logotipos y genericas, tope de cuatro fuentes, sin login ni cookies. `verifiedImageResource` no implica `verificadaPorSentinel`, que es siempre false. Account Intelligence Fase 1: contratos de cuenta, observacion, publicacion y snapshot append-only; actividad solo derivable de observaciones reales y sin etiquetas sin metodologia; temas propios separados de temas sobre el candidato reutilizando el Topic Engine; metricas agrupadas por plataforma y sin totales cruzados; ninguna puntuacion. Mapa de capacidades real: de siete plataformas solo la web permite lectura. ACCOUNT-PROVIDER-GAPS documentado con precios null. 590 pruebas, 0 fallos. Nueva §18-undevicies. |
| 2026-08-25 | P-CAND-UX-03 | Causa: al guardar se cerraba el modal pero la ficha quedaba desplegada y el aviso era persistente. Ahora se recarga, se colapsa y se confirma con un aviso que se borra solo. Contrato de fotografia con procedencia, historial acotado y `verificadaPorSentinel` que nunca hereda la corroboracion de la cuenta: son dos afirmaciones distintas. Una URL de cuenta ya no se acepta como imagen —era la causa del icono roto— y `CandidatePhoto` cae a iniciales si la carga falla. La jerarquia esta completa y las seis plataformas sociales quedan declaradas como no obtenibles sin API. Encontrada una URL de cuenta guardada como foto en el expediente real: se diagnostica, no se corrige sin permiso. 527 pruebas, 0 fallos. Nueva §18-duodevicies. |
| 2026-08-25 | P-CAND-UX-02 | Causa raiz: el formulario estaba montado en la rama de render de la LISTA de proyectos, que retorna antes que la del detalle, asi que al pulsar el boton su JSX no se renderizaba nunca. Defecto introducido por mi en el gate anterior al anclar la insercion sin comprobar la rama. Corregido y convertido en espacio de trabajo por plataforma, con varias cuentas, vista previa de foto y aviso de dominio. Dos defectos mas de la auditoria: retirar BORRABA la cuenta en vez de marcarla REVOCADA con su historia, y la ficha no exponia el id para retirar por identidad exacta. Probado que un PATCH parcial no borra nada y que el candidateId no cambia. 495 pruebas, 0 fallos. Nueva §18-septendecies. |
| 2026-08-25 | P-CAND-UX-01 | Ficha de identidad implementada. `cuentasReferencia` pasa de campo a coleccion y admite varias cuentas por plataforma; la plataforma se lee del dominio con SD-1A y no de la casilla. Las siete plataformas se muestran siempre, tambien las vacias, con `PENDIENTE` que no afirma ausencia. Declarada por el analista y corroborada por Sentinel se muestran a la vez. Editar identidad sin borrar y recrear, con el id intacto; retirar una cuenta es explicito por id. La metrica pasa a «Solidez del expediente» con aclaracion y escala neutra: BUG-16 mitigado en interfaz, formula sin tocar. Hora local `America/Guayaquil`, persistencia en UTC. BUG-20 mitigado en interfaz y abierto en el modelo. 453 pruebas, 0 fallos. Nueva §18-sexdecies. |
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
