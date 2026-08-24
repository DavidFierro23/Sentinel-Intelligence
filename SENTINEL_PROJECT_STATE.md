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
| Alias que alimenten el planificador del backend | 🔴 hoy solo `localStorage`. **No implementado en LÍNEA A**: requiere anuncio `PATCH ALIAS DISPONIBLE` y autorización aparte |
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
| 2026-08-24 | reset pre-piloto | Retirados los 6 proyectos de prueba con la API oficial y creado `alcaldia-cuenca-2027-piloto` con baseline cero verificado. **0 entradas del Lake eliminadas**: es append-only por diseño. BUG-09 encontrado y evitado: crear el nombre pedido habría resucitado un proyecto eliminado con 4 candidatos. Snapshot en `docs/auditorias/SNAP-001`. Nueva §18-ter. |
| 2026-08-24 | LÍNEA A | Tubería de identidad corregida: L-1 zona de apellidos, L-2 semilla de referencia sin autoverificación, L-3 contexto destilado. Nueva §18-bis. BUG-07 y BUG-08 declarados sin corregir. 189 pruebas sin cuota, 0 fallos. Pilotos reales NO ejecutados. |
| 2026-08-24 | `b2dcdc5` | Creación del documento maestro de continuidad. Estado verificado por inspección del repositorio: 4 routers, 12 endpoints de proyecto, 14 componentes congelados existentes, Knowledge Lake en fichero con persistencia verificada, LÍNEA B territorial sin integrar. |
