# SENTINEL INTELLIGENCE
## Estado Maestro del Proyecto

**Estado:** DESARROLLO ACTIVO
**Documento:** FUENTE MAESTRA DE CONTINUIDAD

> **Regla:** Este documento describe el estado **comprobado** del sistema.
> No sustituir hechos por suposiciones.

| Campo | Valor comprobado |
|---|---|
| Fecha de actualización | **2026-09-01** (última sección territorial: §13-septdecies) |
| Rama | `dev` |
| Último commit **base** de esta actualización | `a369ed2` — *feat(candidate): close Facebook coverage assessment* (Terminal 1 comiteó 4 veces mientras se cerraba este gate) |
| Último commit **territorial** | `6ba1d7c` — *feat(territorial): expand Cuenca local source universe* → le siguen los de §13-septdecies |
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

> **Nota de 2026-08-31 (§13-undecies).** El bloque de `git status` de arriba es el del
> **24 de agosto** y se conserva sin tocar como registro de aquel momento. No describe
> el estado actual del repositorio. Al cerrar TERRITORIAL-SOURCE-UNIVERSE-01, la línea
> territorial tenía su árbol limpio y había cambios sin comitear de **otras líneas**
> —`instagramAdapter.js` y `socialCapabilityMatrix.js`, de Candidate Intelligence— que
> **no se tocaron ni se incluyeron** en su commit.

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
| **Media Intelligence — módulo** | ✅ OPERATIVO | `GET /api/media/:proyectoId/home`, `MediaIntelligenceModule.jsx`, §18-M4 |
| Media · analizar una publicación | ✅ OPERATIVO | `POST /api/media/pieza/analizar`, herramienta interna del módulo, §18-M1/M2/M3 |
| Media · presencia observada (ranking) | ✅ OPERATIVO | recuento sobre el corpus, sin score y sin influencia, §18-M4 |
| Media · candidatos × medios | 🟡 PARCIAL | fuentes distintas y evidencias sí; piezas por candidato no, la arista se deduplica por par |
| Media · historias / temas | 🟡 PARCIAL | la amplificación no persiste titular: `COBERTURA_INSUFICIENTE` declarada |
| Media · territorio del corpus | 🔴 PENDIENTE | GEO-1 lo resuelve por pieza y la fila no lo guarda |
| Media · incidencia | 🔴 PENDIENTE | `METODOLOGIA_EN_CONSTRUCCION` por contrato; nunca devuelve valor |
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

## 13-nonies. TERRITORIAL-FRESH-01 — escucha actual (2026-08-28)

✅ Territorio responde **«¿qué está pasando HOY en Cuenca?»**.

### La distinción que define el gate

> **ENCONTRADO HOY ≠ PUBLICADO HOY**

Cuatro instantes, y ninguno sustituye a otro:

| campo | qué es |
|---|---|
| `publishedAt` | lo que declara la fuente |
| `firstObservedAt` | primera vez que Sentinel la vio — **inmutable** |
| `lastObservedAt` | última vez que volvió a verla |
| `retrievedAt` | instante de **esta** ejecución |

Usar `retrievedAt` como `publishedAt` convertiría cada recolección en «hoy han pasado 60 cosas», que es falso **y crece cada vez que se pulsa actualizar**.

### Prueba real, 28 ago 2026 · ventana HOY · escucha ampliada

| | |
|---|---|
| corpus | **63 evidencias** |
| **publicado hoy** | **8** |
| encontrado hoy, publicado antes | **55** |
| fecha no resuelta | 0 |

Sin separar esas dos cifras, la pantalla habría dicho «63 cosas hoy». Había 8. **Un orden de magnitud.**

Distribución por `publishedAt`: hoy 8 · ayer 0 · 2–7 días 6 · anterior **49**.

> Hallazgo: **el recolector base no respeta la ventana pedida.** Google News devuelve su ventana móvil completa independientemente de `desde`/`hasta`. Pedir HOY no restringe lo que entra; lo que hace el sistema es **clasificarlo correctamente**. Sin la distinción de frescura, pedir «hoy» habría devuelto 49 evidencias de hace más de una semana presentadas como actuales.

### Por qué un día calendario y no 24 horas rodantes

Ecuador va a **UTC−5**. Entre las 19:00 y la medianoche de Cuenca, el servidor en UTC ya está en el día siguiente: **calculando en UTC, «hoy» se vaciaría cada tarde.**

La ventana se calcula con `Intl.DateTimeFormat` en `America/Guayaquil`. Comprobado: a las 02:00 UTC del 28, la fecha local sigue siendo el 27.

**Ninguna fecha está fija en el código.** El 27 de agosto era la fecha esperada de la validación; el reloj marcó el 28 y el sistema lo calculó solo.

### Reejecutar no multiplica el corpus

`territorial/evidenceLedger.js`, append-only. Dos pasadas seguidas el mismo día:

| | pasada 1 | pasada 2 |
|---|---|---|
| observadas | 57 | 57 |
| **nuevas para Sentinel** | 57 | **0** |
| ya conocidas | 0 | **57** |
| corpus acumulado | 64 | **64** |

> Defecto corregido durante la prueba: el ledger solo admitía evidencias con `evidenceId`, campo que únicamente emiten los adapters de INGEST-REAL-01. **56 de 63 evidencias quedaban fuera — el 89 %.** «Reejecutar no duplica» solo era cierto para el 11 % del corpus. Ahora la huella se calcula con el mismo contrato para todo el corpus.

`firstObservedAt` es inmutable: si cada pasada lo reescribiera, el histórico diría que Sentinel se enteró de todo hoy.

### Adapters conectados, no reimplementados

Auditoría: `ingestOrchestrator`, `evidenceContract`, `crossProviderDedup` y los adapters RSS/GDELT/YouTube **existían y nadie los invocaba**. `ingest/territorialCollector.js` los conecta; `conversationHarvester` sigue exactamente igual.

Presupuesto por pasada: RSS 8 feeds · GDELT 2 consultas · **YouTube 1**. Una búsqueda de YouTube cuesta 100 de 10.000 unidades diarias; cuatro actualizaciones al día ya son 400.

### Proveedores en la prueba real: 2 de 9 aportaron

```
Google News    OK              56 evidencias
YouTube        OK               7 evidencias · 5 canales · 100 unidades
GDELT          TIEMPO_AGOTADO   no alcanzable desde esta máquina
RSS directo    SIN_FUENTES      no hay feeds declarados todavía
SerpAPI · Brave · DuckDuckGo    NO_EJECUTADO (modo sin coste web)
Bing           NO_IMPLEMENTADO
```

> Defecto corregido: GDELT devolvía `fetch failed` a secas. La causa real vive en `error.cause.code` —`UND_ERR_CONNECT_TIMEOUT`— y es lo que distingue «no responde desde esta máquina» de «rechazó la consulta». Hubo que diagnosticarlo por separado; ahora viaja en el motivo.

El panel declara **cuántos aportaron**, no cuántos existen. «No ejecutado» y «ejecutado sin resultados» no son lo mismo: solo el segundo permite decir que no hay nada.

### HOY ⊂ 7 días, verificado

```
HOY  2026-08-28T05:00:00Z → 2026-08-29T04:59:59Z
7D   2026-08-22T05:00:00Z → 2026-08-29T04:59:59Z
```

Las dos ventanas se calculan por calendario en la misma zona. Si HOY fuera calendario y 7d resta de milisegundos, el subconjunto no lo sería.

### Ficheros

| Pieza | Fichero |
|---|---|
| Ventana del día y frescura | `territorial/dayWindow.js` |
| Libro de observaciones | `territorial/evidenceLedger.js` |
| Conexión de adapters | `ingest/territorialCollector.js` |
| Interfaz | `territorio/panels/{FreshnessPanel,ProvidersStatusPanel}.jsx` |

### Pruebas

`territorial` 160 · `c2` 53 · `d` 39 · `d2` 92 · `ingest-real` 93 · **`territorial-fresh` 50** · SSR **114** = **601**.

> La suite `territorial-fresh` salía a internet en su primera versión: dos peticiones reales a `api.gdeltproject.org`. Se añadió inyección de `fetch` y `parseURL`, y se verificó con un contador que ahora hace **cero** llamadas de red. «Sin red» tiene que ser comprobable, no una intención.

---

## 13-undecies. TERRITORIAL-SOURCE-UNIVERSE-01 — fuentes locales comprobadas (2026-08-31)

✅ RSS deja de estar **estructuralmente** `SIN_FUENTES`.

### El defecto que cierra este gate

`territorialCollector` recibe `feeds` y, si llega vacía, declara `SIN_FUENTES` y no
ejecuta RSS. Es lo correcto: no sale a descubrir feeds en mitad de una recolección.

**Pero nadie le pasaba feeds nunca.** `routes/territorio.js` los tomaba solo del
cuerpo de la petición. En TERRITORIAL-FRESH-01 eso se midió: 56 de 63 evidencias
—el **89 %**— por un único proveedor que además oculta al publicador.

### Comprobado ≠ verificado

Dos palabras distintas, a propósito:

| | |
|---|---|
| **comprobado** | Sentinel fue al sitio por HTTP y anotó qué pasó. Observación nuestra, con fecha. |
| **verificado** | contrastado contra un registro **oficial** de medios por un analista. |

`registroOficialContrastado: false` en **las 28 fichas**: no se ha consultado ningún
registro oficial de medios del Ecuador. Haber leído un feed no verifica a nadie;
solo demuestra que el feed responde.

### Cinco estados, ninguno redundante

Lo que los separa es **quién tiene el problema** y **qué se puede afirmar después**.

| estado | qué significa | ¿reintentar? |
|---|---|---|
| `VERIFICADO_FEED` | declara feed, responde y es parseable | único que alimenta al recolector |
| `NO_PUBLICA_RSS` | la portada respondió y no declara feed | no: es un hecho del medio |
| `VERIFICADO_SIN_FEED` | declara feed y ninguno resultó usable | sitio comprobado, feed no |
| `INACCESIBLE` | la portada no respondió | puede ser nuestro |
| `NO_RESUELTO` | no se llegó a comprobar | nunca afirma nada |

### Comprobación real · 31 ago 2026 · 28 candidatos

```
VERIFICADO_FEED       12      20 feeds válidos
NO_PUBLICA_RSS         9
INACCESIBLE            3
VERIFICADO_SIN_FEED    2
NO_RESUELTO            2      robots.txt lo desaconseja
```

Comprobadas —el sitio respondió— **23 de 28**. Coste **0 USD**, 91 peticiones HTTP a
robots.txt, portadas y feeds públicos. Ninguna credencial.

**Fuentes con feed válido:**

| fuente | tipo | territorio | feed |
|---|---|---|---|
| El Mercurio | medio local | cantón | `elmercurio.com.ec/feed/` |
| Unsión TV | medio local | cantón | `unsion.tv/feed/` |
| EMAC EP | institución | cantón | `emac.gob.ec/feed/` |
| EMOV EP | institución | cantón | `www.emov.gob.ec/feed/` |
| ETAPA EP | institución | cantón | `www.etapa.net.ec/feed/` |
| Prefectura del Azuay | institución | provincia | `www.azuay.gob.ec/feed/` |
| La Voz del Tomebamba | **no clasificado** | no declarado | `www.lavozdeltomebamba.com/feed/` |
| Expreso · Extra · GK · Plan V · Teleamazonas | nacionales | **cobertura de Azuay NO medida** | 5 feeds |

> El dominio propuesto **resolvió**: `lavozdeltomebamba.com` existe y publica feed. Y
> sigue en `NO_CLASIFICADO`, porque la clasificación de medios sale del catálogo, no
> del nombre. Su relación con `radiotomebamba.com.ec` **no está establecida**.

### El estado de una fuente varia entre pasadas

`gk.city` dio `INACCESIBLE` en una pasada y `VERIFICADO_FEED` en la siguiente; sus
feeds devolvieron 403 en una tercera. El almacen reconstruye **la ultima
comprobacion**, asi que la lectura actual del universo puede diferir en una o dos
fuentes de las cifras de arriba, que son las de la pasada del 31 de agosto.

Comprobado en la ruta ya montada: `GET /api/territorio/fuentes` devuelve **28
fuentes** y **11 feeds disponibles** con el estado persistido en ese momento.

Esto no es un defecto del registro: es lo que hay. Un sitio que responde a veces es
distinto de uno que no responde nunca, y por eso se guarda **cuando** se miro y no
solo **que** se vio.

### Lo que la comprobación descubrió sobre el catálogo semilla

`fetch failed` no distingue dos cosas muy distintas. Es la misma lección que dejó
GDELT en FRESH-01: la causa vive en `error.cause.code`.

```
ondacero.com.ec         ENOTFOUND    el dominio NO EXISTE en el DNS
radiotomebamba.com.ec   ENOTFOUND    el dominio NO EXISTE en el DNS
eltiempo.com.ec         ECONNRESET   existe y corta la conexión
```

> **Dos de las cinco entradas locales del catálogo semilla apuntan a dominios que no
> resuelven.** Es un hecho sobre el catálogo, no sobre la red, y por eso se anota
> aparte. **No se sustituyen por dominios inventados.**

Y `www` no es adivinar una ruta: es el host canónico. Probarlo **una** vez, y solo en
el camino de error, recuperó tres sitios —entre ellos la **Prefectura del Azuay**, que
pasó de `INACCESIBLE` a `VERIFICADO_FEED`, y `cuenca.gob.ec`, que resultó
`NO_PUBLICA_RSS`—.

### Pasada RSS real

| | |
|---|---|
| feeds resueltos | 20 |
| feeds leídos | **8** — tope de `PRESUPUESTO_POR_PASADA.rss_directo` |
| evidencias | **106** |
| **publicado hoy** | **27** |
| encontrado hoy, publicado antes | **79** |
| fecha no resuelta | **0** |
| duplicados contra el corpus previo | **0** de 81 |

Distribución por `publishedAt`: hoy 27 · ayer 18 · 2–7 días 18 · anterior 43.

**Emisores resueltos: 8 de 8 — ninguno sin identificar.**

```
40  Expreso                 nacional
10  El Mercurio             local
10  Unsión TV               local
10  EMAC EP                 institución
10  EMOV EP                 institución
10  Prefectura del Azuay    institución
10  La Voz del Tomebamba    local, no clasificado
 6  ETAPA EP                institución
```

66 de 106 evidencias —el **62 %**— vienen de fuentes de Cuenca/Azuay. El publicador
**no se adivina: es el feed.** Cero evidencias con el publicador sin resolver, frente
al 40 % del corpus que en FRESH-01 llegaba por YouTube sin saber quién publica.

> **La agenda institucional pasa de CERO a cuatro fuentes propias.** Era el pendiente
> #20: «ninguna consulta trae fuentes institucionales propias». Ya las trae.

Los duplicados son **0 de 81** porque el corpus previo es de Google News y YouTube, que
entregan otras URL. La idempotencia sí quedó demostrada en el almacén de fuentes: **196
comprobaciones registradas, 28 fuentes**, `nuevasParaSentinel: 0` en las reejecuciones.

### Dos defectos corregidos durante la prueba

**1 · Los feeds de comentarios se comían el presupuesto.** WordPress declara `/feed/` y
`/comments/feed/` en el mismo `link rel=alternate`. Medido: el de comentarios ocupó una
de las ocho plazas y metió **10 comentarios en el corpus etiquetados como NOTICIA**.
Ahora constan en la ficha —el sitio los declara— y no se recolectan.

**2 · Los nacionales desplazaban a las instituciones del cantón.** Con orden por
prioridad pura, `gk.city` (P2) entró antes que EMAC, EMOV y ETAPA (P3) y agotó el
presupuesto con dos feeds que devolvieron 403. Ahora ordena **territorio declarado
primero** y después prioridad: en un módulo territorial, el orden inverso es el que
sirve. Resultado medido: de 6 de 8 plazas para nacionales a **7 de 8 territoriales**.

### Lo que NO se hizo

- **No se adivinan rutas.** Ni `/rss` ni `/feed` ni `/rss.xml`. Un feed entra cuando el
  sitio lo DECLARA en su `link rel=alternate`. Fijado en pruebas: el camino feliz gasta
  exactamente 2 peticiones y ninguna a una ruta adivinada.
- **No se raspa.** Sin feed, la respuesta es «no publica feed».
- **No se reimplementó RSS.** `descubrirFeeds` y `leerFeed` son de INGEST-REAL-01 y se
  invocan tal cual. `conversationHarvester` no se tocó.
- **No se creó un segundo catálogo.** La clasificación sigue saliendo de
  `conversation/mediaRegistry.js`. Este gate añade *qué comprobar* y *qué resultó*.
- **No se leyó ninguna licencia.** `usoComercialPermitido: null` en las 28 fichas, y
  null bloquea igual que false.
- **No se tocó la frescura.** `publishedAt`, `firstObservedAt`, `lastObservedAt` y
  `retrievedAt` siguen intactos, y hay pruebas que lo fijan.

### robots.txt se lee antes de la portada

Su ausencia **no** es una prohibición: un 404 significa que el sitio no publica reglas.
Se anota `NO_PUBLICADO` y se sigue. Si prohíbe la ruta, la fuente queda `NO_RESUELTO`
—no `INACCESIBLE`—, porque `INACCESIBLE` invita a reintentar y esto no. Ecuavisa y La
Hora quedaron ahí: **se respeta y se dice**.

Se elige el grupo de reglas más específico que nos aplique —nuestro token, y `*` si
no—: una regla escrita para Googlebot no nos concierne.

### Ficheros

| Pieza | Fichero |
|---|---|
| Contrato, candidatos y resolución de feeds | `territorial/verifiedSourceUniverse.js` |
| Comprobación real y robots.txt | `territorial/sourceVerifier.js` |
| Persistencia append-only | `territorial/sourceUniverseStore.js` |
| Rutas y conexión al recolector | `routes/territorio.js` |

`GET /api/territorio/fuentes` **no sale a internet**: devuelve lo comprobado.
`POST /api/territorio/fuentes/verificar` es la única operación que sale a la red.
Separarlas evita que abrir un panel pida la portada de veinte medios.

El almacén vive en `apps/backend/data/territorial-sources/`, partición mensual,
`appendFile` y sin `writeFile`. `primeraComprobacionEn` es inmutable, por la misma razón
que `firstObservedAt`.

### Pruebas

`territorial` 160 · `c2` 53 · `d` 39 · `d2` 92 · `ingest-real` 93 · `territorial-fresh`
50 · **`territorial-sources` 60** · SSR 114 = **661**.

Sin red, y comprobable: la suite envuelve el `fetch` global con un contador y la última
prueba **falla** si algún caso se escapa a internet. Marca **cero**.

---

## 13-duodecies. TERRITORIAL-RSS-ROTATION-01 — rotación del universo RSS (2026-08-31)

✅ Ninguna fuente comprobada se queda fuera indefinidamente.

### Corrección de una cifra del gate anterior

§13-undecies dejó el pendiente #30 diciendo que **«12 feeds sin leer»**. Esa cifra
estaba mal y se corrige aquí:

| | |
|---|---|
| feeds **registrados** en las fichas | 20 |
| de los cuales, feeds de **comentarios** | 8 — declarados por el sitio, no recolectables |
| feeds **recolectables** (uno por fuente) | **12** |
| presupuesto por pasada | 8 |
| **fuentes que no se leían nunca** | **4**, no 12 |

Las cuatro eran `expreso.ec`, `extra.ec`, `teleamazonas.com` y —según el estado del
día— `gk.city` o `planv.com.ec`: todas nacionales, todas al final del orden
territorial. El problema era real; su tamaño estaba exagerado por contar como feed
utilizable lo que era un feed de comentarios.

### El algoritmo

Cinco reglas, y ninguna aleatoria:

1. **El ciclo manda.** Un ciclo termina cuando cada feed elegible ha sido atendido
   —o diferido con motivo— una vez. Mientras queden pendientes, ninguna fuente ya
   atendida repite.
2. **Dentro de los pendientes**: territorio declarado primero, después prioridad,
   después el que se intentó hace más tiempo, y la URL como desempate final.
3. **Nunca intentado va antes que cualquier fecha.**
4. **Un feed que falla queda atendido igualmente.** Si no, se llevaría una plaza en
   cada pasada y el ciclo no cerraría nunca.
5. **La pasada de cierre puede usar menos plazas que el presupuesto.** No se rellena
   con fuentes del ciclo siguiente: gastar plazas por gastarlas no trae información y
   haría ilegible el recuento de cobertura.

Es lo que convierte la prioridad en **orden de servicio** en lugar de en privilegio
permanente. Una nacional válida entra más tarde que una local, pero entra.

> El presupuesto **no se elevó**. `PRESUPUESTO_POR_PASADA.rss_directo` sigue siendo 8
> y es del recolector. Lo único que cambia es **cuáles** ocho.

Con 11 feeds y 8 plazas el ciclo cierra en 2 pasadas. Con 20 cerraría en 3. Nada de
eso está escrito en el código: sale de las dos cifras, y las pruebas lo comprueban con
10, 30 y 100 feeds.

### Backoff acotado

Un feed que falla se salta las siguientes `min(fallos, 4)` pasadas. Acotado a
propósito: sin tope, tres fallos seguidos apartarían una fuente durante semanas, y un
503 de una tarde no es un medio muerto.

Se cuenta en **pasadas, no en horas**. No hay demonio que garantice cada cuánto ocurre
una pasada, así que medir el backoff en tiempo sería inventar precisión.

### Seis estados, y uno que NO es fallo

| estado | ¿penaliza? | por qué |
|---|---|---|
| `OK` | no | trajo entradas |
| `SIN_RESULTADOS` | **no** | el feed **respondió** y no traía nada. Eso sí autoriza a decir «no ha publicado» |
| `ERROR_FUENTE` | sí | respondió algo que no es un feed |
| `INACCESIBLE` | sí | no se pudo leer: no autoriza a decir nada |
| `NO_PUBLICA_RSS` | sí | el feed dejó de existir |
| `NO_RESUELTO` | no | seleccionado y sin resultado anotado. No se inventa un OK |

Penalizar a un medio por no haber publicado hoy lo apartaría de la rotación justo
cuando vuelva a publicar. **Ausencia no es cero**, y aquí eso es una regla de código.

### Tres instantes que no se confunden

```
lastAttemptAt    la última vez que Sentinel LO INTENTÓ
lastSuccessAt    la última vez que el feed RESPONDIÓ
publishedAt      lo que el MEDIO declara haber publicado
```

Un feed que no se intentó no es un feed sin novedades.

### Ámbito: por proyecto, no por territorio

`scopeId` es el proyecto cuando hay proyecto y el territorio cuando no, y se declara
cuál de los dos se usó. Dos proyectos sobre el mismo cantón rotan por separado: la
cobertura de uno no puede dar por escuchada una fuente que el otro no ha leído.
Comprobado en pruebas con almacén compartido.

### Prueba real · 31 ago 2026 · solo RSS

11 feeds elegibles, presupuesto 8, **coste 0 USD**. Cero peticiones a Google News,
YouTube, GDELT, SerpAPI y Brave: `habilitados: ["rss_directo"]` y nada más.

| | pasada 7 · ciclo 4 | pasada 8 · ciclo 4 | pasada 9 · ciclo 5 |
|---|---|---|---|
| seleccionados | **8** | **3** | **8** |
| repetidos del ciclo | 0 | 0 | — (ciclo nuevo) |
| OK | 8 | 3 | 8 |
| fallos | 0 | 0 | 0 |
| evidencias | 76 | 101 | 76 |
| **nuevas** | 76 | 101 | **0** |
| **duplicadas** | 0 | 0 | **76** |
| publicado hoy | 21 | 43 | 21 |
| encontrado hoy / publicado antes | 55 | 58 | 55 |
| fecha no resuelta | 0 | 0 | 0 |
| plazas sin usar | 0 | 5 | 0 |
| cierra ciclo | no | **sí** | no |

**Cobertura del ciclo 4: 11/11.** Cero solapamiento dentro del ciclo, cero fuentes
nunca atendidas, cero starvation.

La pasada 9 es la prueba del dedup: al abrir el ciclo 5 vuelven a entrar los mismos
ocho feeds, se releen 76 evidencias y **ninguna es nueva**. `nuevasParaSentinel: 0` no
es un fallo de recolección: es que no ha pasado nada nuevo en esos feeds.

> Las evidencias de esta prueba **no se escribieron** en el libro de evidencias: el
> dedup se midió contra el corpus existente sin mutarlo. Contaminar el corpus es
> trabajo de la ruta de análisis, no de un gate de rotación.

El estado se leyó del fichero en cada pasada, así que la rotación **sobrevive a un
reinicio**: las pasadas 7–9 continúan la numeración de una ejecución anterior del
mismo día, que es exactamente lo que demuestra la persistencia.

### Un defecto del recolector corregido de paso

Los ocho lotes de RSS salían **sin identidad de feed**: `{providerId, estado,
recibidas}` y nada más. Ocho lotes indistinguibles entre sí no permiten saber cuál
falló, y sin eso no hay rotación posible. Se añadieron `feedUrl` y `sourceId` al lote
—cambio aditivo, las suites previas no cambian—.

También estaba mal `topePorPasada`: leía `presupuesto.rss_directo` cuando la forma real
es `presupuesto.aplicado.rss_directo`, así que **siempre era null**. Corregido.

### Observabilidad

`escuchaAmpliada.rotacionRss` responde «¿qué fuentes RSS todavía no se han escuchado en
este ciclo?» sin ejecutar nada: `feedsVerificados`, `presupuestoPorPasada`, `ciclo`,
`cobertura`, `pendientes`, `diferidasEnCiclo`, `nuncaAtendidas` y `proximaCohorte`.

> **La próxima cohorte sí se declara; la fecha no.** El algoritmo es determinista, así
> que QUÉ entrará se puede saber. CUÁNDO no: no hay demonio de ingesta, y
> `proximaRotacion` es `null` con su motivo. Poner una fecha sería inventarla.

### Interfaz

`ProvidersStatusPanel` muestra el ciclo, la cobertura `8/11`, cuántas faltan por
escuchar y la próxima cohorte con la advertencia de que no hay fecha. Si no hay
rotación activa, el bloque **no aparece**: no se inventa un ciclo. Tres casos de SSR lo
fijan, incluido el que comprueba que no se imprime una fecha futura.

### Ficheros

| Pieza | Fichero |
|---|---|
| Algoritmo, backoff, ámbito y almacén | `territorial/rssRotation.js` |
| Atribución del lote a su feed | `ingest/territorialCollector.js` |
| Selección, anotación y observabilidad | `routes/territorio.js` |
| Interfaz | `territorio/panels/ProvidersStatusPanel.jsx` |

Almacén en `apps/backend/data/territorial-rss-rotation/`, partición mensual,
`appendFile` y sin `writeFile`.

### Pruebas

`territorial` 160 · `c2` 53 · `d` 39 · `d2` 92 · `ingest-real` 93 · `territorial-fresh`
50 · `territorial-sources` 61 · **`territorial-rotation` 42** = **590** en backend, más
SSR **120** = **710**.

Nuevo script: **`npm run test:territorial`** ejecuta las ocho suites territoriales de
una vez. Sigue **fuera de `npm test`**: esa línea la mantiene la Línea A y no se toca
desde aquí (pendiente #18).

Sin red y comprobable: contador sobre el `fetch` global, y marca cero.

---

## 13-terdecies. TERRITORIAL-TOPIC-TERRITORY-01 — tema × territorio (2026-08-31)

✅ El corpus territorial se convierte en una matriz **explicable y auditable**.

### Qué se completó, y qué NO se creó

`topicTerritoryCrosstab.js` existía desde el Gate C2 y contaba evidencias por tema y
unidad. Con eso no se podía responder ninguna de las preguntas que justifican el
módulo: *¿qué fuentes hablan de esto aquí?*, *¿está creciendo?*, *¿qué evidencia lo
sostiene?*

Se **completó ese fichero**. No hay un segundo motor de temas: `topicExtractor`,
`openTopicDiscovery`, `entityTopicSeparation`, `geoResolver` y `dayWindow` se invocan
tal cual. Lo que se añade es la celda completa y la comparación de ventanas.

### La celda

| campo | qué es |
|---|---|
| `tema` · `origenTema` · `tipoSenal` | clasificado o descubierto; TEMA o LUGAR |
| `territorioId` · `territorio` · `nivel` | unidad y resolución reales |
| `evidencias` · `fuentes` · `emisores` | conteos separados |
| `emisoresSinResolver` | el hueco, **fuera** del conteo de emisores |
| `publicadoHoy` · `publicado7d` | frescura dentro de la celda |
| `rangoPublicacion` · `primeraObservacion` · `ultimaObservacion` | qué publicó el medio, cuándo lo vimos |
| `coverageStatus` · `coberturaEvidencial` | dos preguntas distintas |
| `atribucion` | **por qué** se asignó ese territorio |
| `evidenceIds` | sin esto no hay auditoría: hay una cifra que hay que creerse |

### Tema no es lugar

En el corpus real, la señal con más evidencias era **«cuenca», con 30**, seguida de
«azuay · estado» con 4. Ninguna de las dos es un tema: son el territorio. El extractor
las produce como etiquetas emergentes porque el topónimo es, literalmente, la palabra
que más se repite en un corpus territorial.

Dejarlas en el ranking convierte «¿de qué se habla en Cuenca?» en «de Cuenca».

El criterio es verificable y no una lista escrita a mano: se comparan los tokens del
nombre contra los **topónimos del registro territorial**, que se inyectan. Si todos los
tokens significativos son topónimos, la señal es `LUGAR`. `alcaldia cuenca` se queda
como `TEMA` —`alcaldia` no es un topónimo— y `agua en Cuenca` también.

Las filas de LUGAR **no se borran**: su evidencia es real. Salen del ranking y se
cuentan aparte.

### Territorio indeterminado, visible

No se fuerza una parroquia. Si la evidencia solo sostiene «Cuenca», el territorio es
Cuenca a nivel cantón. Si solo sostiene «Azuay», es Azuay. Si no sostiene nada, va a la
fila **`TERRITORIO_NO_RESUELTO`**, que se muestra.

Descartar esas evidencias haría que el total de la matriz no cuadrase con el corpus y
nadie sabría por qué.

### Dos coberturas, porque son dos preguntas

```
coberturaEvidencial   ¿hay suficiente evidencia y de suficientes fuentes?
coverageStatus        ¿además, estábamos observando durante la ventana?
```

El histórico manda: sin observación, el conteo es incompleto y presentarlo como
cobertura sería informar mal. Pero el juicio evidencial **no se borra**, porque una
celda con seis evidencias de cuatro medios no es lo mismo que una con una de uno, y
ambas saldrían como `HISTORICO_INSUFICIENTE`.

### Prueba real · 31 ago 2026 · corpus persistido, 0 peticiones externas

| | |
|---|---|
| observaciones en el libro | 234 |
| **evidencias distintas** | **81** |
| con titular / con fecha | 81 / 81 |
| dominios distintos | 6 |
| proveedores | `google_news` 74 · `youtube_data` 7 |
| inicio de observación | **2026-08-28T17:44:20Z** |
| señales | 8 clasificadas + 26 descubiertas = **34** |
| de las descubiertas → entidades / temas | **5 / 21** |
| territorio resuelto | **77** de 81 · 4 sin resolver |
| procedencia | derivada 77 · desconocida 4 |

**Territorios observados:** Cuenca (cantón) 65 · Azuay (provincia) 10 · **Machángara
(parroquia) 1** · Ecuador (país) 1.

> Una evidencia se resolvió a **parroquia**. La resolución infra-cantonal existe y
> funciona; lo que falta es geometría oficial para dibujarla.

**Matriz por ventana:**

| ventana | celdas | temas | señales que son lugar | territorios | ev. en ventana | ¿histórico cubre? |
|---|---|---|---|---|---|---|
| hoy | 0 | 0 | 0 | 0 | 0 | **sí** |
| 7d | 6 | 4 | 2 | 2 | 18 | no |
| 15d | 9 | 7 | 2 | 2 | 23 | no |
| 30d | 14 | 9 | 4 | 2 | 32 | no |
| 90d | 29 | 19 | 4 | 3 | 50 | no |

**Temas reales, tras separar entidades y lugares:**

```
clasificados        Gestión y gobernanza 23 · Movilidad y transporte 8
                    Proceso electoral 7 · Movilización social 4
                    Seguridad ciudadana 3 · Agua y saneamiento 3

descubiertos        alcaldía cuenca 10 · precandidatos 6 · estado excepción 4
                    cuenca prefectura 4 · proyecto minero 4
                    elecciones seccionales 3
```

**Tres cruces reales (ventana 30d, solo TEMA):**

| # | tema | territorio | ev. | fuentes | emisores | cobertura | evidencial |
|---|---|---|---|---|---|---|---|
| 1 | Gestión y gobernanza | Cuenca · cantón | 4 | 1 | 0 (+4 sin resolver) | HISTORICO_INSUFICIENTE | COBERTURA_BAJA |
| 2 | alcaldía cuenca | Cuenca · cantón | 3 | 1 | 0 (+3 sin resolver) | HISTORICO_INSUFICIENTE | COBERTURA_BAJA |
| 3 | elecciones seccionales | Cuenca · cantón | 2 | 1 | 0 (+2 sin resolver) | HISTORICO_INSUFICIENTE | COBERTURA_BAJA |

Cada uno con sus `evidenceId`, su rango de publicación y su atribución territorial
—`procedencia: derivada`, `confianza: 72`, `topónimo "Cuenca" presente en el texto
(+40)`—.

> **Cero emisores resueltos en los tres cruces.** El corpus persistido es de Google
> News, que oculta al publicador detrás de `news.google.com`: la fuente se identifica
> como `agregador` y el emisor queda `null`. El universo RSS de §13-undecies resuelve
> 8 de 8 publicadores, pero sus evidencias **no están en el libro**: las pasadas de
> rotación midieron el dedup sin escribir en el corpus. Es la limitación más visible de
> esta prueba.

### Comparación temporal: el mecanismo funciona, el corpus es joven

| ventana | ¿observábamos la anterior? | resultado |
|---|---|---|
| 7d · 15d · 30d | **no** | 34 de 34 señales → `HISTORICO_INSUFICIENTE` |
| hoy vs ayer | **sí** | `MUESTRA_INSUFICIENTE`: 1 evidencia entre las dos ventanas |

Sentinel empezó a observar el 28 de agosto. La ventana anterior de 7 días empieza el
18: **no se puede comparar contra un periodo que no se observaba.**

> El caso que esto evita, medido: el tema «cuenca» tenía **20 evidencias en la ventana
> de 30 días y 1 en la anterior**. Sin la guarda, la pantalla habría declarado un
> crecimiento del 1.900 %. Lo que había era un corpus que empezó el 28 de agosto.

Las dos guardas están probadas por separado con corpus sintético: `CRECIENDO`,
`DISMINUYENDO` y `ESTABLE` funcionan cuando se observaban las dos ventanas y hay
muestra; con base cero **no se da variación relativa**, porque «+infinito %» por una
primera aparición no es información.

### Lo que no se calcula, y por qué

`porcentajePoblacion`, `penetracion`, `perCapita`, `porcentajeElectores`, `padron`,
`intencionVoto`, `aprobacion`, `influencia`, `probabilidadElectoral`: **ausentes del
código**, no avisados en un texto. Comprobado en la prueba real y fijado en pruebas.

La métrica es **conteo absoluto**. No hay denominador poblacional con licencia
comercial (#4) ni padrón accesible (#5).

`viral` es `null` con motivo `NO_DISPONIBLE`: exige velocidad de propagación y origen,
que este módulo no observa. **«Emergente» no se declara**: solo el hecho
`primeraObservacionEnLaVentana`, porque una señal nueva para nosotros puede ser vieja
en el territorio.

### Tres defectos corregidos durante la prueba

**1 · El rango de publicación salía invertido.** El libro mezcla dos formatos de
`publishedAt` —ISO y RFC 2822— porque cada proveedor la declara a su manera y el
contrato no la normaliza. Ordenar esas cadenas alfabéticamente ponía `Wed, 26 Aug`
después de `2026-08-28`: el rango real medido era «desde 28-ago hasta 26-ago». Ahora se
ordena por instante.

**2 · El nombre del territorio se imprimía como `[object Object]`.** `resolverUbicacion`
devuelve `unidad` como objeto y el agregador como cadena. La matriz acepta las dos.

**3 · Las señales que son topónimos encabezaban el ranking.** Resuelto con
`clasificarSenal` contra el gazetteer.

### Interfaz

`TopicTerritoryPanel.jsx`: matriz + cajón de evidencia, selector de ventana, filtro por
territorio y conmutador «solo temas». Se carga **a demanda** contra
`POST /api/territorio/tema-territorio`, que lee el corpus persistido y **no sale a
internet**: abrir una vista de temas no puede costar una recolección.

Se montó dentro de `TerritorialModule.jsx`. **No se tocaron `App.jsx` ni `Sidebar.jsx`**
—los tiene Media Intelligence sin commitear— ni se rediseñó nada.

**Mapa:** sin geometría oficial de las unidades urbanas, la lectura territorial es por
tabla. El panel lo dice y no dibuja polígonos sin fuente oficial.

### Ficheros

| Pieza | Fichero |
|---|---|
| Matriz, ventanas, tendencia, tema/lugar | `geo/topicTerritoryCrosstab.js` |
| Ruta sobre corpus persistido | `routes/territorio.js` → `POST /tema-territorio` |
| Interfaz | `territorio/panels/TopicTerritoryPanel.jsx` |

### Pruebas

`territorial` 160 · `c2` 53 · `d` 39 · `d2` 92 · `ingest-real` 93 · `fresh` 50 ·
`sources` 61 · `rotation` 42 · **`topic` 49** = **639** en backend, más SSR **126** =
**765**.

`npm run test:territorial` ejecuta las nueve suites territoriales. Sin red, con contador
sobre `fetch` que marca cero.

---

## 13-quaterdecies. TERRITORIAL-ACCELERATION-02 — histórico, proyecto, proveedores y UX (2026-08-31)

✅ El circuito se cierra: **RSS → ledger → Tema×Territorio → histórico**, con el
proyecto como ámbito.

### 1 · RSS al libro de evidencias

Las pasadas de §13-duodecies midieron el dedup **sin escribir** en el corpus: era la
decisión conservadora de un gate sobre rotación. El efecto secundario lo midió
§13-terdecies —los tres cruces reales salieron con **cero emisores resueltos**— porque
el corpus persistido seguía siendo de Google News.

Sin escritura no hay histórico, y sin histórico no hay tendencia.

`POST /api/territorio/observar` ejecuta **solo `rss_directo`** y persiste. Tres pasadas
reales:

| pasada | ciclo | feeds | observadas | **nuevas** | duplicadas | corpus | publicado hoy |
|---|---|---|---|---|---|---|---|
| 10 | 5 | 3 | 101 | **101** | 0 | 101 | 43 |
| 11 | 6 | 8 | 76 | **76** | 0 | 177 | 22 |
| 12 | 6 | 3 | 101 | **0** | **101** | 177 | 43 |

La tercera pasada es la prueba del dedup contra el corpus **ya persistido**: releyó 101
evidencias y ninguna era nueva. El corpus se queda en 177.

**No hay backfill.** `publishedAt` es del medio, `firstObservedAt` de Sentinel, y
ninguno se toca. El histórico empieza cuando empieza.

### 2 · Emisores: de 0 a 177

| | |
|---|---|
| **RESUELTO** | **177 de 177** |
| vía | `feed_comprobado_del_medio` en el 100 % |
| emisores distintos | **11** |
| OBSERVADO_NO_VERIFICADO · NO_RESUELTO | 0 · 0 |

`emitterResolver.js` acredita por una sola vía: **el feed es del propio medio y está
comprobado en el universo de fuentes**. Leer al medio en su casa es lo único que
acredita.

Tres estados, y la diferencia importa:

| estado | qué significa |
|---|---|
| `RESUELTO` | feed del propio medio, comprobado |
| `OBSERVADO_NO_VERIFICADO` | señal razonable sin comprobar: título de un feed desconocido, o dominio en el catálogo semilla |
| `NO_RESUELTO` | no se sabe. **Un agregador cae aquí, y eso no es un fallo**: es un hecho sobre el agregador |

No se infiere emisor por parecido de cadenas. Rescatar al publicador del sufijo del
titular ya estaba marcado como frágil y no se usa.

### 3 · Todo pertenece a un proyecto

El libro es infraestructura **compartida**; la lectura es **por proyecto**.
`reconstruirEstado(observaciones, { projectId })` filtra, y sin `projectId` se lee el
corpus completo **y la respuesta lo dice**.

Las 234 observaciones anteriores a este gate no llevan proyecto. No se descartan en
silencio —serían 234 observaciones reales desaparecidas— ni se cuentan dentro de una
campaña: quedan como **legado**, fuera de cualquier proyecto salvo que se pidan con
`incluirLegado`.

Comprobado con dos proyectos y evidencia distinta:

```
A → 4 evidencias, ninguna de B
B → 3 evidencias, ninguna de A
legado → 2, fuera de ambos
proyecto inexistente → 0, no el corpus entero
```

> **La prueba que sostiene a las demás** quita `projectId` de los registros y **exige
> que el aislamiento se rompa**: A pasa a 0 y el corpus sigue en 9. Sin ese caso, una
> prueba de aislamiento podría estar pasando por casualidad y nadie se enteraría.

Se aisla también la rotación (`proyecto:` vs `territorio:`), la matriz, los conteos, las
fuentes y las ventanas.

### 4 · Baseline del proyecto piloto

`alcaldia-cuenca-2027-piloto` — «Elecciones Alcaldía Cuenca 2027», cantón Cuenca. Es un
proyecto **real** del almacén, no una cadena inventada.

| | |
|---|---|
| Evidencias del proyecto | **177** |
| Dominios | 11 |
| Con resumen persistido | **176 de 177** |
| Emisores resueltos | **177** |
| Territorio resuelto | 79 · **98 sin resolver** |
| Señales | 22 clasificadas + ~185 descubiertas |
| Territorios observados | 11 |
| Celdas por ventana | hoy 266 · 7d 375 · 15d 416 · 30d 418 · 90d 474 |
| Tendencias declarables | **0** |

Se midió dinámicamente. **No está hardcodeado**: si el ledger cambia, el baseline
cambia.

### 5 · Dos regresiones de calidad, declaradas

**a · El territorio resuelto cayó de 4/81 sin resolver a 98/177.** No es un defecto del
resolutor: el corpus RSS trae medios **nacionales** —Expreso, Extra, Teleamazonas, Plan
V— cuyos artículos no mencionan Cuenca. Un artículo nacional sin topónimo cantonal no se
puede ubicar, y **no se fuerza**. Es exactamente el hueco que un proveedor con
extracción geográfica cerraría.

**b · El descubrimiento abierto se sobre-fragmenta.** Con los resúmenes persistidos, el
motor propone ~185 señales para 177 evidencias: una señal por evidencia no es una
agenda. Se probó subir `documentosMinimos` de 2 a 3 y **el número subió** —de 175 a
185—, porque ese umbral gobierna la formación de clusters y no el ruido residual. Se
revirtió en lugar de tocar un motor compartido sin beneficio medido.

Lo que sí hace este gate: **clasificar la señal**. Se añadió `TIPOS_SENAL.TEMPORAL`
porque el motor empezó a proponer «agosto · lunes» con ocho evidencias —la fecha del
artículo, no su asunto—. Los nombres de mes y de día son una lista cerrada del idioma:
comprobable, no inventada. Con `LUGAR` y `TEMPORAL`, el ruido se puede **ver y filtrar**
en lugar de contarse como agenda.

### 6 · Evaluación de proveedores

Documento: **`docs/TERRITORIAL-PROVIDER-EVAL-01.md`**. Coste **0 USD**, ninguna cuenta
creada, ninguna tarjeta.

| proveedor | estado | trial | coste | Cuenca |
|---|---|---|---|---|
| **#1 GDELT Cloud (BigQuery)** | `APTO_PARA_PRUEBA` | **sandbox sin tarjeta** | **0 USD** | NO PROBADO |
| **#2 Data365** | `APTO_PARA_PRUEBA` | 14 días sin tarjeta | ~300 EUR/mes | NO PROBADO |
| #3 Meltwater | `REQUIERE_CONTACTO` | no hay | ~65.000 USD/año | NO PROBADO |
| #4 Brandwatch | `REQUIERE_CONTACTO` | no hay | ~50.000 USD/año | NO PROBADO |

**Ecuador y Cuenca están `NO VERIFICADO` en los cuatro.** Ninguno se marca `OPERATIVO`:
eso exige una prueba real que no se pudo ejecutar en ninguno. No se produce puntuación
numérica: con el 20 % del peso sin verificar, cualquier total sería falsa precisión.

**#1 GDELT Cloud** porque es el único que se puede **comprobar antes de decidir**, gratis
y sin tarjeta, y el único con extracción geográfica explícita —lo que ataca las 98
evidencias sin territorio— más histórico desde 1979.

**#2 Data365** porque aporta **conversación pública, que Sentinel no observa en
absoluto**. No es una mejora incremental: es una dimensión nueva.

Meltwater y Brandwatch exigen contrato de cinco cifras **antes** de poder comprobar si
Cuenca está cubierta. Para un proyecto cantonal, ese es exactamente el riesgo que la
evaluación existe para evitar.

#### Evidencia propia — PROBADO

La vía **DOC API** de GDELT sigue inalcanzable desde esta máquina, medida dos veces:

```
Cuenca Ecuador   TIEMPO_AGOTADO   UND_ERR_CONNECT_TIMEOUT   10.619 ms
Azuay Ecuador    TIEMPO_AGOTADO   UND_ERR_CONNECT_TIMEOUT   10.640 ms
```

Fallo en la **fase de conexión**, el mismo que TERRITORIAL-FRESH-01: bloqueo
**reproducible**, no un incidente. Eso **refuerza** BigQuery —otro endpoint— y a la vez
significa que la cobertura de GDELT sobre Cuenca **sigue sin medir**.

`GET /api/territorio/proveedores` declara el estado real, y `OPERATIVO` exige haber
aportado evidencia al corpus:

```
rss_directo    OPERATIVO       278 observaciones
google_news    OPERATIVO       227 observaciones
youtube_data   OPERATIVO         7 observaciones
gdelt_doc      NO_ALCANZABLE     0 observaciones
```

### 7 · Interfaz: nueve secciones

`TerritorialWorkspace.jsx` sustituye a `TopicTerritoryPanel.jsx`, que hacía solo la
matriz y **se retiró** para no dejar dos implementaciones de la misma vista.

Cabecera permanente: **proyecto activo · territorio base · ventana**. Sin proyecto no se
muestra corpus, se pide uno: *«una cifra global leída como si fuera de una campaña
informa peor que no tener cifra»*.

| sección | qué responde |
|---|---|
| Resumen | panorama en ~10 s: evidencias, fuentes, emisores, temas, territorios, publicado hoy, cobertura temporal |
| Temas | asuntos, con su cambio |
| Territorios | dónde aparecen, con la geometría ausente declarada |
| Tema × Territorio | la matriz aprobada en §13-terdecies, integrada, con cajón de evidencia |
| Tendencias | cambios entre ventanas comparables |
| Fuentes | 28 fichas: tipo, territorio, estado, feed, última comprobación |
| Evidencias | título, fuente, emisor, publicado, observado, territorio, proveedor, id |
| Cobertura | qué observamos y **qué todavía no** |
| Proveedores | 4 motores reales + 4 candidatos en evaluación |

Tendencias **no maquilla**: con 0 declarables dice *«Sentinel está acumulando
observaciones para establecer una línea base temporal comparable»*.

**No se tocaron `App.jsx` ni `Sidebar.jsx`** —los tiene Media Intelligence sin
commitear—: el workspace se monta dentro de `TerritorialModule.jsx`.

### 8 · Certificación de la interfaz

Vite sirve en `localhost:5173` (HTTP 200) y `TerritorialWorkspace.jsx` se transpila y
sirve (134 KB). Los tres endpoints que consume devuelven 200 con payloads reales (671 KB
· 54 KB · 3,1 KB).

Y hay una comprobación nueva más fuerte que «renderiza sin romperse»:
`tests/workspace-real.check.jsx` renderiza **las nueve secciones con los payloads
reales** y exige **contenido** —las cifras del corpus, nombres de tema, territorios,
fuentes y proveedores—, más que ninguna sección imprima un porcentaje poblacional. **15
casos, todos en verde.**

> **Lo que NO se pudo hacer: mirar la pantalla.** No hay navegador en este entorno, así
> que color, espaciado y jerarquía **no están certificados visualmente**. Por eso este
> gate se reporta **PARCIAL** y no aprobado.

### 9 · Preparación de Sentinel AI

Cada celda de la matriz ya es un objeto consumible con `projectId`, tema, territorio,
ventana, cambio, conteos de evidencia y fuente, `evidenceIds`, `coverageStatus` y
limitaciones. Toda conclusión futura de IA puede **llegar a la evidencia** por id, sin
duplicarla.

### 10 · Ficheros

| Pieza | Fichero |
|---|---|
| Ledger con proyecto y campos completos | `territorial/evidenceLedger.js` |
| Resolución de emisor | `territorial/emitterResolver.js` |
| Señal TEMPORAL | `geo/topicTerritoryCrosstab.js` |
| Observar, proveedores, ámbito de proyecto | `routes/territorio.js` |
| Interfaz | `territorio/TerritorialWorkspace.jsx` |
| Evaluación | `docs/TERRITORIAL-PROVIDER-EVAL-01.md` |

### 11 · Pruebas

`territorial` 160 · `c2` 53 · `d` 39 · `d2` 92 · `ingest-real` 93 · `fresh` 50 ·
`sources` 61 · `rotation` 42 · `topic` 49 · **`project` 29** = **668** en backend.

SSR **127** + **workspace con datos reales 15** = **810** en total.

`npm run test:territorial` ejecuta las diez suites territoriales. Sin red, con contador
sobre `fetch` que marca cero.

**Coste del gate: 0 USD.** Peticiones externas: solo RSS público (14 lecturas de feed en
tres pasadas) y 2 intentos fallidos a GDELT. Google News 0 · YouTube 0 · SerpAPI 0 ·
Brave 0.

---

## 13-quindecies. TERRITORIAL-SOURCE-COVERAGE-01 — radiografía de la escucha (2026-09-01)

✅ Las **20 dimensiones** del espacio público de Cuenca quedan resueltas
conceptualmente, con evidencia de cada estado.

Documento completo: **`docs/TERRITORIAL-SOURCE-COVERAGE-01.md`**.

### La pregunta del gate, contestada

> Sin sembrarle temas, ¿qué descubre Sentinel por sí solo?

**Sí descubre**, sin lista previa: política y actores políticos —José Serrano 53
evidencias, Cristian Zamora 42, Aquiles Álvarez 31—, seguridad ciudadana 25, integridad
pública 21, gestión y gobernanza 21, educación 19, salud 16, obra pública 13,
movilización social 10, economía y empleo 10, movilidad 9 y **deporte** (Barcelona SC,
Marcelo Gallardo).

**No aparece nada** de Deportivo Cuenca, clima, turismo, comercio, conciertos, moda,
marcas, influencers ni memes. No porque el motor no pueda: **porque el corpus es prensa
e instituciones** y esos temas viven en plataformas que no observamos.

### Observación longitudinal real

```
pasada 13 · 8 feeds    76 observadas   18 nuevas   58 duplicadas
pasada 14 · 3 feeds   101 observadas   89 nuevas   12 duplicadas
                       corpus del proyecto: 177 → 284
```

70 piezas del día anterior se reconocieron y no se duplicaron: **el histórico es real y
crece**. 689 observaciones acumuladas, 284 evidencias, 283 con resumen, 284 con fecha,
**100 % de emisores resueltos**.

### Matriz de cobertura

**4 OPERATIVO** (noticias, RSS, instituciones, enlaces) · **5 PARCIAL** (medios
digitales, temas emergentes, territorio, histórico, tendencias) · **7 NO_PROBADO** ·
**3 NO_DISPONIBLE** (creadores, comunidades, comentarios) · **1 REQUIERE_PROVEEDOR**
(web abierta).

`OPERATIVO` exige **evidencia real en el corpus**: un adapter configurado y nunca
ejecutado no cuenta. Cada fila declara sus conectores, sus evidencias, su limitación,
**por qué tiene ese estado** y qué falta para mejorarla.

> No se declara ningún porcentaje de «cobertura de internet»: no existe el denominador
> de esa fracción. Y lo fuera de alcance —rastreo individual, atributos sensibles,
> perfiles privados— se declara como **decisión de producto**, no como carencia.

### Geografía: el diagnóstico anterior estaba mal

§13-quaterdecies reportó «98 de 177 sin territorio» y se leyó como fallo del resolutor.
**No lo era.** Con cuatro estados en lugar de dos:

| estado | n |
|---|---|
| **A · TERRITORIO_EXPLICITO** — la pieza lo sostiene, **el único que cuenta** | **107** |
| B · FUENTE_LOCAL_SIN_TERRITORIO — medio local, pieza sin topónimo | **4** |
| C · NACIONAL_RELACIONADO — medio nacional del universo | **173** |
| D · TERRITORIO_NO_RESOLUBLE | **0** |

El problema real no es de resolución: **el corpus es mayoritariamente nacional**. Solo 4
piezas son de medio local sin topónimo. Los cuatro estados **suman el corpus**; si no
sumaran, alguna pieza se habría descartado en silencio.

B se muestra como «**Fuente local · territorio de la pieza no demostrado**»: pista sobre
la fuente, no sobre el contenido. Ninguna de las tres últimas se atribuye al cantón.

### Qué se puede afirmar

Capa nueva que convierte una medida en una frase **y se niega a producirla cuando la
medida no la sostiene**. Permitido: «mayor número de menciones observadas en la
muestra», «dominio más recurrente del corpus observado». Prohibido con su motivo: «lo
más visto en Cuenca», «lo que piensa Cuenca», cualquier porcentaje poblacional,
«intención de voto».

La respuesta de la API pasa por `revisarSalida` antes de enviarse. En la ejecución real:
**ninguna cadena afirma más de lo que los datos sostienen**.

### Actores

11 derivados del corpus — 6 medios, 4 instituciones, 1 sin clasificar. Los 11
`COMPROBADO` y **cero verificados por analista**: la cifra se cuenta para que la
ausencia sea visible. `atributosSensibles` es null **por decisión, no por olvido**.

De las señales descubiertas, **22 parecen un actor y no un asunto**. El clasificador
falla de forma visible —tipa **«Barcelona SC» como PERSON**— y su confianza viaja con
el veredicto en lugar de ocultarse.

### La fragmentación empeora al crecer el corpus

**377 señales para 284 evidencias**, frente a 185/177 del gate anterior. Subir
`documentosMinimos` volvió a empeorarlo. Se clasifica la señal —TEMA / LUGAR /
TEMPORAL / parece actor— para poder filtrarla, pero el motor sigue produciendo ruido:
sobreviven tokens como «caso» y «autoridades».

### Ficheros

| Pieza | Fichero |
|---|---|
| Cuenca vs nacional (A/B/C/D) | `territorial/territorialScope.js` |
| Qué se puede afirmar | `territorial/claimGuard.js` |
| Matriz de 20 dimensiones | `territorial/listeningCoverage.js` |
| Actores observados | `territorial/actorUniverse.js` |
| Auditoría | `routes/territorio.js` → `POST /cobertura` |

### Pruebas

`territorial-coverage` **45** nuevo. Total territorial: **713** en backend (11 suites),
más SSR 127 y render con datos reales 15 = **855**.

> La suite NO se registró en `package.json`: el fichero tenía cambios sin commitear de
> otra línea y el gate prohíbe tocarlo mezclado. Se ejecuta con
> `node tests/territorial-coverage.test.mjs`.

**Coste: 0 USD.** Solo RSS público (11 lecturas de feed). Google News 0 · YouTube 0 ·
GDELT 0 · SerpAPI 0 · Brave 0 · ScrapeCreators 0 créditos.

---

## 13-sexdecies. TERRITORIAL-LOCAL-SOURCE-EXPANSION-01 — más Cuenca en el corpus (2026-09-01)

✅ Fuentes locales con feed: **6 → 9**. Territorio explícito: **107 → 127**.

Documento completo: **`docs/TERRITORIAL-LOCAL-SOURCE-EXPANSION-01.md`**.

### El hallazgo contraintuitivo

Se usó Google News como **descubridor de fuentes** —método (D), 3 consultas RSS
gratuitas, 300 piezas, 40 publicadores— y el resultado fue el contrario del esperado:

```
74  elmercurio.com.ec     69  Primicias     34  El Universo     23  expreso.ec
```

> **El agregador no revela ni un medio local nuevo de Cuenca.** Su cobertura del cantón
> la dominan El Mercurio y los nacionales. Y al revés: `eltiempo.com.ec`,
> `lavozdeltomebamba.com` y `unsion.tv` **no aparecen** entre los 40 publicadores.

Conclusión para la estrategia: **los feeds directos dan más cobertura local que el
agregador**. El ecosistema local visible a agregadores es genuinamente delgado; no es
que Sentinel lo estuviera pasando por alto.

### El registro oficial existe y no es alcanzable

El **Consejo de Comunicación del Ecuador** publica un listado oficial de medios: la
fuente autoritativa que este proyecto llevaba declarando que nunca consultó. Medido en
tres URLs, **`UND_ERR_CONNECT_TIMEOUT`** en fase de conexión —el mismo bloqueo de red
que afecta a GDELT—. Queda como pendiente accionable: descarga manual del PDF.

### Fuentes nuevas comprobadas

| fuente | veredicto |
|---|---|
| **La Voz del Tomebamba** | `VERIFICADO_FEED` · **reclasificada a MEDIO_LOCAL** |
| **Farmasol EP** | `VERIFICADO_FEED` · institución local |
| **EMUVI EP** | `VERIFICADO_FEED` · institución local |
| Cuerpo de Bomberos | `VERIFICADO_FEED` · **ámbito NO confirmado**, sin cobertura declarada |

La reclasificación de La Voz del Tomebamba fue lo más barato y lo más rentable: ya
aportaba 10 evidencias contadas como «nacional / sin declarar» **solo porque nadie la
había clasificado**. Y de paso corrige el catálogo semilla:
`radiotomebamba.com.ec` da **ENOTFOUND** y las guías de radio públicas apuntan a la
misma emisora con el dominio correcto.

Rechazadas con motivo: `ecuador221.com` ENOTFOUND · `eltiempo.com.ec` **ECONNRESET
reproducible** —diario real de Cuenca desde 1955, el hueco más molesto— ·
`ondacero.com.ec` ENOTFOUND.

### Nueve sitios comprobados SIN feed, registrados y no inventados

`cuenca.gob.ec` —**el GAD Municipal**— · `deportivocuenca.com` —el club existe, sin
RSS— · `uazuay.edu.ec` · primicias, elcomercio, eltelegrafo, vistazo, laposta,
ecuadorinmediato. No se les fabrica un feed. `ucuenca.edu.ec` declara feed y responde
**vacío**, que no es lo mismo.

### Antes / después

| | antes | después |
|---|---|---|
| Fuentes locales con feed | 6 | **9** |
| Medios locales con feed | 2 | **3** |
| Instituciones locales con feed | 4 | **6** |
| Feeds elegibles | 11 | **15** |
| Dominios en el corpus | 11 | **14** |
| Evidencias del proyecto | 284 | **319** |
| Observaciones | 689 | **922** |
| **Territorio explícito (A)** | 107 | **127** |
| Fuente local sin topónimo (B) | 4 | 12 |
| Nacional relacionado (C) | 173 | 180 |
| No resoluble (D) | 0 | **0** |

Ratio local/nacional en conteo absoluto: **111 vs 173 → 139 vs 180**. Sin inflar
volumen: de las 35 evidencias nuevas, **28 vinieron de las tres fuentes nuevas** en su
primera pasada.

**La rotación se llenó de locales.** En la pasada 16 las 8 plazas fueron El Mercurio,
Unsión TV, La Voz del Tomebamba, EMAC, Prefectura, EMOV, ETAPA y EMUVI: **8 de 8
territoriales**. Antes los nacionales las ocupaban por falta de alternativas.

### Temas nuevos, y los que siguen sin aparecer

Aparecen **Agua y saneamiento** (10 ev, 7 fuentes) y **Ambiente y territorio** (9 ev),
coherentes con ETAPA, EMAC, EMUVI y Farmasol.

**No aparecen** —y se dice—: Deportivo Cuenca (su sitio no publica feed), cultura,
universidad (feed vacío), comercio, turismo, clima, eventos, moda, marcas.

### La regla no se aflojó

B pasó de 4 a 12 —más fuentes locales, más piezas suyas sin topónimo— y **ninguna se
atribuye al cantón**. Hay una prueba explícita de que ampliar el universo no convierte
C en A.

### Fragmentación: corrección pequeña aplicada

**403 señales para 319 evidencias.** Nuevo tipo **`GENERICO`** para tokens que aparecen
en cualquier noticia: medido en el corpus real, «caso» 9, «autoridades» 10, «país» 9,
«cerca» 8. La lista vive en `topicTerritoryCrosstab.js` y **no** en `stopConcepts.js`,
que es compartido.

Misma regla que LUGAR y TEMPORAL: **todos** los tokens deben ser genéricos, así que
«caso Serrano» sigue siendo un tema. Y hay prueba de que el descubrimiento **sigue
siendo abierto**: «Deportivo Cuenca», «festival de artes escénicas» y «lluvias e
inundaciones» se clasifican como TEMA sin estar en ninguna lista.

Persisten residuos verbales —«deja», «después», «paso»— que **exigen diseño del
motor**: queda para `TERRITORIAL-TOPIC-NORMALIZATION-01`.

### Impacto en los proveedores

**GDELT: sigue justificándose, con MENOS fuerza.** Su argumento geo **pesa menos**: el
problema medido no era geocodificar sino tener fuentes locales, y eso se movió sin
proveedor (A: 107→127). El histórico sigue intacto como argumento.

**Data365: sigue justificándose, sin cambios.** Este gate **confirmó que no hay ruta
alternativa** a su hueco: el agregador no revela actores locales y ninguna plataforma
permite descubrimiento por territorio. Creadores, comunidades y comentarios siguen en
`NO_DISPONIBLE`.

**ScrapeCreators: 0 créditos.** Sirve para activos públicos conocidos, no para
encontrarlos.

### Pruebas y coste

`territorial-expansion` **29** nuevo · territorial **742** en 12 suites · SSR 127 ·
render real 15 = **884**. Cero regresiones.

**Coste 0 USD.** 140 peticiones HTTP públicas: 119 de verificación, 3 de descubrimiento
por agregador, 3 fallidas al registro oficial, 18 lecturas de feed. Nada de pago.

---

## 13-septdecies. TERRITORIAL-OPEN-LISTENING-EXPANSION-01 — escucha abierta (2026-09-01)

✅ Dos vías de escucha nuevas a coste cero, más una dimensión de actor que se estaba
tirando. Documento: **`docs/TERRITORIAL-OPEN-LISTENING-EXPANSION-01.md`**.

### La distinción que decide todo: DISCOVERY ≠ OBSERVATION

Candidate parte de un nombre y observa su cuenta. **Territorial no sabe a quién
buscar.** Auditados los ocho motores del repositorio con esa lente:

| motor | credencial | discovery |
|---|---|---|
| `youtubeAdapter` | **SIN_CREDENCIAL** | **`buscar()` existe y funciona** |
| `xAdapter` | **SIN_CREDENCIAL** | **`search/recent` existe**, ventana 7 días |
| `duckProvider` | **no requiere · OK** | **la única ruta web operativa hoy** |
| `braveProvider` · `serpapiProvider` | sin configurar | web abierta |
| `tiktokAdapter` | no requiere | **oEmbed: solo confirma una URL que ya tienes** |
| `instagramAdapter` | SIN_CREDENCIAL | activos conocidos |
| ScrapeCreators (`socialProviderClient`) | bandera **apagada** | — |

> **El código de discovery para YouTube y X ya existe.** Falta la llave, no el conector.
> Eso cambia el orden de prioridades: no hay que construir, hay que habilitar.

Y sobre ScrapeCreators, auditado su mapper: `perfilDe*`, `publicacionesDe*`,
`comentariosDe*`. **Todo es observación de activos conocidos; no hay una sola función de
búsqueda.** Es excelente para lo que hace y no responde a *¿quién importa en Cuenca?*
**0 créditos gastados**: la auditoría del código resolvió la pregunta.

### Las firmas: se perdía el 100 %

`rssAdapter` extraía el autor desde INGEST-REAL-01 y el libro lo descartaba al
persistir. Medido sobre cuatro feeds locales: **40 de 40 items lo declaran**.

Ahora se persiste: **208 de 353 evidencias con firma, 63 firmas en 16 medios**, 54
clasificadas como persona.

**Firma no es periodista.** Los feeds devuelven personas —«Andrés Mazza»—, secciones
—«Redes Sociales»— y etiquetas de sistema. La promoción a PERSONA exige respaldo del
clasificador y su confianza viaja con el veredicto, porque falla de forma visible.

**Privacidad — un problema que el gate creó y corrigió.** La primera pasada persistió
un correo en el campo de autor. Se minimiza al persistir: usuario sí, dominio no. Una
firma guarda nombre publicado, medio y piezas, y nada más.

### Descubrimiento por búsqueda web: lo que el RSS no podía encontrar

Tres consultas a DuckDuckGo, sin credencial, **coste 0** → 17 dominios nuevos. Cuatro
comprobados por HTTP y con feed:

| fuente | hueco que cierra |
|---|---|
| **Club Deportivo Cuenca** | **deporte local** |
| **Dirección General de Cultura de Cuenca** | **cultura y agenda de eventos** |
| **Casa de la Cultura · Núcleo del Azuay** | **cultura** |
| **Agencia Universitaria de Noticias** | **universidad** |

Aparecieron además **activos sociales públicos** de actores locales —Deportivo Cuenca en
FB/YouTube/IG, UCuenca en X—. Ese es el patrón viable: **Duck descubre la cuenta,
ScrapeCreators la observa.**

> **La trampa propia de la búsqueda por texto:** las mismas consultas devolvieron
> `ociocuenca.es` y `agendacultural.castillalamancha.es`, que son **Cuenca de ESPAÑA**.
> Un descubridor por texto no distingue cantones homónimos. Ninguna fuente entra sin
> comprobación ni sin que un analista declare su ámbito.

### Expansión por enlaces: hipótesis descartada con medición

319 evidencias, **2 URLs sociales** en `canonicalUrl` y **0** en los resúmenes. Los
extractos de RSS no llevan enlaces. Barato de comprobar, barato de descartar.

### Antes / después

| | antes | después |
|---|---|---|
| Evidencias | 319 | **353** |
| Observaciones | 922 | **1.154** |
| Dominios · actores | 14 · 14 | **18 · 18** |
| **Firmas** | **0** | **63** en 16 medios |
| Fuentes locales con feed | 9 | **12** |
| Feeds elegibles | 15 | **19** |
| **A · territorio explícito** | 127 | **155** |
| C · nacional | 180 | 186 |
| D · no resoluble | 0 | **0** |
| Plataformas | web | **web** |

Las 34 evidencias nuevas vinieron **íntegras** de las cuatro fuentes descubiertas. Las
pasadas siguientes: 0 nuevas y 198 duplicadas.

**SOURCE_DOMINANCE_RISK: no.** La fuente principal bajó al 22 % —estaba en 27 %—: la
diversificación reduce la dominancia.

### Matriz: 20 dimensiones

**4 OPERATIVO · 6 PARCIAL · 6 NO_PROBADO · 3 NO_DISPONIBLE · 1 REQUIERE_PROVEEDOR.**
«Periodistas» pasa de `NO_PROBADO` a **`PARCIAL`** —y no a OPERATIVO: la promoción es
heurística y hay 145 piezas sin firma—.

### Proveedores

**GDELT: su argumento se debilita más.** El geo ya no es el cuello de botella —A pasó
de 107 a 155 en dos gates sin proveedor—. Queda el histórico, por BigQuery.

**Data365: sigue justificado, sin cambios.** El gate **confirmó que no hay
alternativa**: ninguna plataforma del stack permite descubrimiento por territorio.

**No se investigaron proveedores adicionales**: los gaps restantes se cubren con
credenciales de YouTube y X, cuyo código ya existe.

### Escalabilidad

RSS 24/7: **0 USD**. YouTube: 100 de 10.000 unidades por búsqueda. X: **DESCONOCIDO**,
depende del nivel. Brave y Data365: **REQUIEREN COTIZACIÓN**. Las cifras desconocidas
**no se inventan**.

### Pruebas y coste

`territorial-listening` **31** nuevo · territorial **802** en 13 suites · SSR 127.
**Coste 0 USD**, 0 créditos, ~160 peticiones HTTP públicas.

---

## 13-decies. Roadmap territorial

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
✅ TERRITORIAL-FRESH-01             Escucha del día · frescura
✅ TERRITORIAL-SOURCE-UNIVERSE-01   Fuentes locales comprobadas · RSS operativo
✅ TERRITORIAL-RSS-ROTATION-01      Rotación del universo RSS · sin starvation
✅ TERRITORIAL-TOPIC-TERRITORY-01   Matriz tema × territorio · evidencia auditable
🟡 TERRITORIAL-ACCELERATION-02      RSS al ledger · proyecto · proveedores · UX — PARCIAL: sin certificación visual
✅ TERRITORIAL-SOURCE-COVERAGE-01  Radiografía de la escucha · 20 dimensiones resueltas
✅ TERRITORIAL-LOCAL-SOURCE-EXPANSION-01  Universo local 6→9 fuentes con feed
✅ TERRITORIAL-OPEN-LISTENING-EXPANSION-01  Discovery web · firmas · deporte y cultura
→  1.  Primera prueba real multifuente        ← siguiente, EXIGE CREDENCIALES
   2.  DATA-PROVIDER-EVAL real
   3.  Ampliar providers donde el benchmark demuestre valor
   4.  E1 / Pulse
   5.  ~~Topic × Territory~~  ✅ §13-terdecies (avanzado: pendiente el radar)
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
| 20 | **Agendas ciudadana y de creadores a cero** | lectura no exclusivamente mediática | 🟡 la **institucional está RESUELTA** (§13-undecies: EMAC, EMOV, ETAPA y Prefectura, con feed propio). Ciudadana y de creadores siguen a cero: sigue siendo carencia de observación, ya declarada en la interfaz |
| 21 | ~~RSS directos de medios locales~~ | — | ✅ **RESUELTO** (§13-undecies): 12 fuentes con feed válido, 106 evidencias reales y **8 de 8 publicadores resueltos**. El publicador ya no se rescata del sufijo del titular: es el feed |
| 22 | **`AI-EVAL-01`** | integrar cualquier modelo de lenguaje | 🔴 no iniciada; hoy Sentinel funciona sin IA y esa es la línea base |
| 23 | **Snapshots acumulándose desde 2026-08-25** | ventanas comparables (E1) | 🟡 el histórico empieza hoy; **5 de 5 ventanas con histórico insuficiente** |
| 24 | **`BRAVE_API_KEY`** | segundo buscador web y su benchmark | 🔴 adapter completo desde antes de D2; solo falta la clave |
| 25 | **`YOUTUBE_API_KEY`** | identificar los emisores del 40 % del corpus | 🔴 adapter completo; es el hueco más grande que hay hoy |
| 26 | **Cobertura de GDELT en Azuay** | decidir si el histórico real es viable | 🟡 adapter implementado, cobertura SIN MEDIR; se decide con `fuentesNuevas` |
| 27 | ~~Feeds RSS de medios de Cuenca~~ | — | ✅ **RESUELTO** (§13-undecies): 28 candidatos recorridos, 23 comprobados, 20 feeds válidos registrados con procedencia y fecha |
| 28 | **Benchmark antes/después sin ejecutar** | demostrar que el stack nuevo mejora | 🔴 bloqueado por las dos credenciales |
| 29 | **Términos de servicio sin leer** | integrar cualquier plataforma social | 🔴 `legalTermsStatus: NO_LEIDO` en las 5 plataformas del registro |

| 30 | ~~El tope de 8 feeds por pasada deja fuentes sin leer~~ | — | ✅ **RESUELTO** (§13-duodecies) con rotación por ciclos, sin elevar el presupuesto. **La cifra del enunciado estaba mal**: de 20 feeds registrados, 8 eran de comentarios, así que los recolectables eran **12** y las fuentes nunca leídas **4**, no 12. Cobertura real medida: **11/11 en 2 pasadas** |
| 31 | **Dos dominios del catálogo semilla no resuelven** | cobertura de radio local | 🔴 `ondacero.com.ec` y `radiotomebamba.com.ec` dan **ENOTFOUND**: no existen en el DNS. Requieren dominio real verificable; **no se sustituyen por uno inventado** |
| 32 | **El Tiempo (`eltiempo.com.ec`) corta la conexión** | segundo diario de Cuenca | 🔴 **ECONNRESET** con y sin `www`. El dominio existe; el fallo puede ser nuestro o suyo. Sin diagnosticar |
| 33 | **Ecuavisa y La Hora prohibidos por robots.txt** | ampliar nacionales | 🟡 quedan `NO_RESUELTO` y **se respeta**. Levantarlo es una decisión de negocio —permiso del medio—, no un problema técnico |
| 34 | **La Voz del Tomebamba sin clasificar** | clasificación y orden territorial | 🟡 el dominio propuesto resolvió y publica feed, pero sigue `NO_CLASIFICADO` y **sin cobertura declarada**, así que ordena detrás de las territoriales. Exige entrada de catálogo con respaldo |
| 35 | **Licencia y términos de los 12 feeds sin leer** | uso comercial del contenido sindicado | 🔴 `usoComercialPermitido: null` en las 28 fichas. Leer un feed público no autoriza a explotarlo: null bloquea igual que false |
| 36 | **Sin interfaz del universo de fuentes** | que el analista vea qué se escucha | 🟡 `GET /api/territorio/fuentes` responde y **ningún panel lo muestra**. Hoy solo se ve por API |
| 37 | **Recomprobación periódica sin programar** | que el universo no envejezca | 🟡 `ultimaComprobacionEn` existe y es correcto, pero **nadie decide cuándo volver a mirar**. Un `NO_PUBLICA_RSS` de hoy puede ser falso en un mes |
| 38 | **Cobertura de Azuay de los nacionales sin medir** | saber si aportan territorio | 🟡 5 nacionales con feed válido y `coberturaTerritorialMedida: false`. Uno solo —Expreso— aportó 40 de 106 evidencias sin que se sepa cuántas eran de Azuay |

| 39 | **Sin ingesta programada, la rotación depende de que alguien pida un análisis** | cerrar ciclos sin intervención | 🟡 el algoritmo es determinista y sabe QUÉ toca, pero no CUÁNDO: `proximaRotacion` es null a propósito. Un ciclo puede quedarse a medias indefinidamente si nadie ejecuta. Es el pendiente #9 (ingesta continua) visto desde la rotación |
| 40 | **La rotación no reintenta dentro de la misma pasada** | aprovechar plazas perdidas | 🟡 si un feed falla, su plaza no se reasigna a otra fuente en esa pasada: se pierde. Con 0 fallos medidos hoy no molesta; con varios sí |
| 41 | **Los feeds de comentarios no se aprovechan** | escucha de la reacción ciudadana | 🟡 8 feeds de comentarios están comprobados y **excluidos** de la recolección de noticias, con razón. Serían la primera fuente ciudadana real del módulo, pero exigen su propio contrato: un comentario no es una nota de prensa |
| 42 | **`gk.city` alterna entre alcanzable e inaccesible** | estabilidad del universo elegible | 🟡 el número de feeds elegibles varía entre 11 y 12 según la última comprobación. La rotación lo tolera —el universo variable está cubierto por pruebas— pero la cobertura declarada cambia de denominador |

| 43 | ~~El corpus persistido no incluye las evidencias del universo RSS~~ | — | ✅ **RESUELTO** (§13-quaterdecies): `POST /observar` persiste. 177 evidencias del proyecto y **177 de 177 emisores RESUELTOS** por feed comprobado del propio medio |
| 44 | ~~El libro de evidencias no guarda la descripción~~ | — | ✅ **RESUELTO** (§13-quaterdecies): el ledger guarda `summary`. **176 de 177** evidencias del proyecto lo traen. Efecto secundario en #48 |
| 45 | **`publishedAt` no está normalizado en el contrato de evidencia** | cualquier orden o serie temporal | 🟡 el libro mezcla ISO y RFC 2822 según el proveedor. Ya rompió el rango de publicación una vez; la matriz ordena por instante, pero el contrato debería normalizarlo en la entrada |
| 46 | **Sin histórico observado, ninguna tendencia es declarable** | Trend Radar | 🟡 **el histórico ya acumula** desde §13-quaterdecies, pero empezó hoy: 0 tendencias declarables. El mecanismo funciona y está probado; lo que falta es **tiempo observando**, no código |
| 47 | **La matriz no se expone dentro de `/analisis`** | leer temas y recolección en una sola vista | 🟡 vive en `POST /tema-territorio` a propósito, para que abrir la vista no cueste una recolección. Integrarlas exigiría separar análisis de recolección en la propia ruta |

| 48 | **El descubrimiento abierto se sobre-fragmenta con el texto completo** | que la agenda sea legible | 🔴 ~185 señales para 177 evidencias: una señal por evidencia no es una agenda. Subir `documentosMinimos` de 2 a 3 **empeoró** el número (175→185): el umbral gobierna clusters, no el ruido residual. Mitigado clasificando la señal (LUGAR, TEMPORAL) para poder filtrarla; exige trabajo en el motor |
| 49 | **El corpus es mayoritariamente nacional** | lectura territorial | 🟡 **DIAGNÓSTICO CORREGIDO** (§13-quindecies): no era fallo del resolutor. De 284 piezas, **173 son de medios nacionales** y solo **4** de medio local sin topónimo; 107 tienen territorio explícito. Lo que falta no es geocodificación: son **medios locales con feed** |
| 50 | **La interfaz territorial no está certificada visualmente** | cerrar §13-quaterdecies como APROBADO | 🟡 no hay navegador en el entorno de trabajo. Vite sirve (200), los tres endpoints devuelven payloads reales y las nueve secciones renderizan con **contenido real** verificado (15 casos), pero **color, espaciado y jerarquía no se han mirado**. Requiere revisión humana en `localhost:5173` |
| 51 | **234 observaciones de legado sin `projectId`** | cobertura histórica del proyecto | 🟡 anteriores a §13-quaterdecies. No se descartan ni se cuentan dentro de una campaña: quedan como legado, visibles solo con `incluirLegado`. Asignarlas exigiría decidir a qué proyecto perteneció cada una, y eso **no se inventa** |
| 52 | **Prueba real de GDELT Cloud pendiente de una cuenta de Google** | decidir el proveedor #1 | 🔴 el sandbox de BigQuery no pide tarjeta, pero **exige un alta manual** que Sentinel no puede hacer. Pasos exactos en `docs/TERRITORIAL-PROVIDER-EVAL-01.md` §7 |
| 53 | **Términos y licencias de los cuatro proveedores sin leer** | cualquier uso comercial | 🔴 incluido GDELT, que es condición previa a explotarlo comercialmente |

| 54 | **Fuentes locales con feed: 9** | que la señal territorial sea local | 🟡 **MEJORADO** (§13-sexdecies): de 6 a 9, y territorio explícito de 107 a 127. Lo que queda ya **no se cierra sin proveedor**: 9 sitios comprobados no publican feed —incluido `cuenca.gob.ec`— y el registro oficial de medios es inalcanzable desde esta máquina |
| 55 | **Cero creadores, comunidades y comentarios** | escucha no mediática | 🔴 tres dimensiones en `NO_DISPONIBLE`. No hay descubrimiento social por territorio: no se puede preguntar «qué se publica en Cuenca» a ninguna plataforma. Requiere proveedor |
| 56 | ~~Periodistas sin extraer del campo autor~~ | — | ✅ **RESUELTO** (§13-septdecies): 40 de 40 items de feeds locales declaran autor y se estaba tirando el 100 %. Ahora **63 firmas en 16 medios**, con minimización de correos y sin construir perfiles |
| 57 | **La clasificación de entidades es heurística y falla visiblemente** | separar quién de qué | 🟡 tipa «Barcelona SC» como PERSON por ser dos palabras capitalizadas. Se expone con su confianza en lugar de ocultarse, pero no está verificada |
| 58 | **`territorial-coverage` fuera de `test:territorial`** | ejecución automática | 🟡 `package.json` tenía cambios sin commitear de otra línea y el gate prohíbe tocarlo mezclado. Registrarla cuando el fichero esté limpio |

| 59 | **`cuenca.gob.ec` responde y NO publica feed** | agenda del GAD Municipal | 🔴 la institución más relevante del cantón queda fuera de la escucha por esta vía. No se le fabrica un feed. Vía futura: web abierta o sitemap |
| 60 | **`eltiempo.com.ec` da ECONNRESET reproducible** | segundo diario de Cuenca | 🔴 con y sin `www`, medido en dos gates. El dominio existe; el fallo puede ser nuestro o suyo, y sin diagnosticar |
| 61 | **Registro oficial de medios del Ecuador inalcanzable** | contrastar el catálogo contra una fuente autoritativa | 🔴 el Consejo de Comunicación publica el listado en PDF y da `UND_ERR_CONNECT_TIMEOUT` en tres URLs. **Accionable por el usuario**: descargarlo y pasarlo |
| 62 | **403 señales para 319 evidencias** | que la agenda sea legible | 🔴 el cuello de botella se ha movido de las fuentes a la señal. Mitigado clasificando `GENERICO`, pero persisten residuos verbales que **exigen diseño del motor**: `TERRITORIAL-TOPIC-NORMALIZATION-01` |
| 63 | **`territorial-coverage` y `territorial-expansion` fuera de `test:territorial`** | ejecución automática | 🟡 `package.json` sigue con cambios sin commitear de otra línea. Se ejecutan a mano |

| 64 | **YouTube y X tienen discovery en el código y NO tienen llave** | dos dimensiones enteras | 🔴 `youtubeAdapter.buscar()` y `xAdapter.buscarMenciones()` existen y están probados en Candidate. **No hay que construir nada**: falta `YOUTUBE_API_KEY` y la credencial de X. Es el gate de mayor valor por unidad de esfuerzo |
| 65 | **ScrapeCreators no puede descubrir, solo observar** | creadores y comunidades | 🟡 auditado su mapper: perfil, publicaciones y comentarios de activos CONOCIDOS. Cero funciones de búsqueda. Encaja **después** de que la búsqueda web descubra la cuenta |
| 66 | **La búsqueda por texto no distingue cantón homónimo** | fiabilidad del descubrimiento | 🟡 medido: `ociocuenca.es` y `agendacultural.castillalamancha.es` son Cuenca de España. Mitigado exigiendo comprobación HTTP y declaración de ámbito por analista |
| 67 | **La clasificación de firma a persona es heurística** | fiabilidad de la dimensión periodistas | 🟡 tipa «Publicacion Noticias» como PERSONA. Se expone con su confianza; verificar contra los propios medios queda pendiente |
| 68 | **452 señales para 353 evidencias** | legibilidad de la agenda | 🔴 la fragmentación empeora cada vez que crece el corpus. Sigue exigiendo diseño del motor: `TERRITORIAL-TOPIC-NORMALIZATION-01` |
| 69 | **`SENTINEL_PROJECT_STATE.md` se está reescribiendo desde copias obsoletas** | integridad del documento maestro | 🔴 dos veces en dos gates el árbol de trabajo apareció con cientos de líneas borradas de secciones **ya commiteadas** —de Media y de Territorial—. Los commits territoriales se hacen por hunk desde HEAD para no propagarlo, pero **conviene revisar qué proceso lo reescribe** |

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

## 18-sexvicies. P-CAND-BENCH-01 — Linea base T0 (2026-08-28)

Commit `feat(candidate): establish real multicandidate T0 baseline`.

**933 comprobaciones, 23 suites, 0 fallos.** 10 requests de X y 6 unidades de
YouTube: exactamente lo planificado, sin una sola de mas.

Primera medicion real de los **siete candidatos** del proyecto.

### La tabla

| Candidato | X segs | pub | orig | rep | reply | quote | indet | X vistas | YT subs | YT vistas | cob |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Paul Carrasco | — | — | — | — | — | — | — | — | 15 | 999 | 1/5 |
| J. C. Lloret | 29.413 | 5 | 0 | 0 | 0 | 0 | **5** | — | 26 | — | 2/5 |
| Pedro Palacios | 29.372 | 5 | 1 | 0 | 4 | 0 | 0 | 807 | — | — | 1/5 |
| Juan Carlos Vega | 2.502 | 5 | 4 | 1 | 0 | 0 | 0 | 6.158 | — | — | 1/5 |
| Yaku Perez | 131.305 | 4 | 4 | 0 | 0 | 0 | 0 | 7.976 | 857 | 1.457 | 2/5 |
| Marcelo Cabrera | 48.742 | 5 | 0 | 4 | 1 | 0 | 0 | — | — | — | 1/5 |
| Leonardo Morales | 2.270 | 5 | 2 | 0 | 1 | 2 | 0 | 400 | — | — | 1/5 |

Un guion es **ausencia de dato**, nunca un cero.

### Lo que la separacion por tipo dejo ver

La regla de X-REAL-01 —no promediar repost con publicaciones propias— no era
teorica. Aplicada a siete candidatos reales, aparecen tres perfiles distintos
que una media unica habria borrado:

- **Marcelo Cabrera**: 4 de 5 republicaciones y ninguna original. Su
  rendimiento propio es `—`, no 0: en esa muestra no publico contenido propio
  que medir. Sin la separacion habria aparecido con una media de interaccion
  ridicula y la lectura habria sido «no le hacen caso», cuando lo que hace es
  amplificar.
- **Pedro Palacios**: 4 de 5 son respuestas. Es conversacion, no publicacion, y
  va en su propia columna.
- **Juan Carlos Vega y Yaku Perez**: 4 originales cada uno. Son los unicos dos
  con rendimiento propio comparable en X.

### Cobertura, no porcentaje

    2/5 plataformas objetivo medidas

y no «40 %». El porcentaje supondria que X, YouTube, Instagram, Facebook y
TikTok pesan igual, y no hay metodologia que lo sostenga. `porcentaje` es `null`
a proposito y lo declara.

Solo dos candidatos —Lloret y Yaku— llegan a 2/5. Los otros cinco estan en 1/5 y
quedan **PARCIALMENTE_COMPARABLE**: compararlos globalmente los perjudicaria por
un hueco de medicion nuestro, no por su actividad.

### Un defecto propio que encontro el expediente real

Las publicaciones guardadas antes de que existiera `tipoPublicacion` no traen el
campo. Y `undefined` **no** es `NO_DETERMINADO`: las cinco publicaciones de X de
Lloret se contaban en el total y **desaparecian del desglose** —cinco
observadas, cero clasificadas—.

Peor aun: su fila mostraba `orig: 0`, que se lee como «no publica nada propio»
cuando lo cierto es que no sabemos de que tipo son. Ahora se normalizan a
`NO_DETERMINADO`, los buckets suman siempre el total, y `tipoIndeterminado`
explica que la columna esta vacia por desconocimiento y no por inactividad.

### Lo que NO hace este gate

    NO hay IPID.
    NO hay ranking.
    NO hay ganador.
    NO se suman vistas de X con vistas de YouTube.

Las observaciones son **por plataforma** y descriptivas: «dentro de la muestra
observada y solo en X, Yaku Perez acumulo mas vistas en sus publicaciones
originales». Con 4 y 5 publicaciones por candidato, eso es lo unico que la
muestra sostiene.

`momentum` es `HISTORICO_INSUFICIENTE`: T0 es el primer punto y no hay contra
que compararlo.

### Presupuesto

| | previsto | real |
|---|---|---|
| requests X | 10 | **10** |
| unidades YouTube | 6 | **6** |

Lloret **no se volvio a observar**: sus datos son de hace horas y repetirlos
habria costado 2 requests y 3 unidades para no aprender nada. Su T0 es la
observacion de X-REAL-01 y P-CAND-03, con sus instantes reales.

Coste monetario de X: `COSTE_NO_RESUELTO`. Se gastaron 10 requests de un saldo
de 25 USD y la API no devuelve consumo por llamada.

### Detalles tecnicos que aparecieron

- **Paul Carrasco tiene un channelId, no un handle** (`UC...`, porque su URL es
  `/channel/`). `forHandle` no lo resuelve; ahora se detecta la forma y se usa
  `channels.list?id`, derivando la lista de subidas con la convencion
  `UC` → `UU`. Si fallara, `listarSubidas` devolveria vacio y quedaria
  declarado.
- **Yaku devolvio 4 publicaciones y no 5.** El tamano de muestra se declara por
  candidato: comparar 4 con 5 no es lo mismo que comparar 5 con 5.

### Riesgos y limitaciones

- **Cinco de siete candidatos estan en 1/5 de cobertura.** La tabla describe
  bien lo poco que se puede ver, y lo poco que se puede ver es poco.
- **Las publicaciones de Lloret siguen sin tipo** hasta que se reobserve. No se
  infiere por heuristica.
- **Muestras de 4 y 5 publicaciones.** Sirven para validar el pipeline, no para
  caracterizar una cuenta con miles de posts.
- Instagram, Facebook y TikTok siguen sin medir, y son tres de las cinco
  plataformas objetivo.

---

## 18-septemvicies. META-IG-REAL-01 (2026-08-28)

Commit `feat(candidate): validate real Instagram capabilities`.

**967 comprobaciones, 24 suites, 0 fallos.** 4 requests reales, cero
reintentos.

### El resultado en una linea

Instagram funciona **entero** sobre nuestra propia cuenta y **no llega** a la de
un candidato.

### Etapa A — cuenta propia: todo verde

    GET graph.instagram.com/v23.0/me            200
    GET graph.instagram.com/v23.0/me/media      200
    GET graph.instagram.com/v23.0/{id}/insights 200

Perfil completo —id, username, name, `account_type: BUSINESS`, seguidores,
seguidos, numero de publicaciones—: **los ocho campos pedidos volvieron**.

Cinco publicaciones con `permalink` y `timestamp`, todas IMAGE. Y los cinco
insights pedidos —`reach`, `saved`, `shares`, `total_interactions`, `views`—
devueltos sin excepcion.

### Etapa B — tercero: bloqueada

    GET graph.facebook.com/v23.0/{ig}?business_discovery(...)
    400 · codigo 190 · «Invalid OAuth access token - Cannot parse access token»

#### El diagnostico que cambia la accion

Leido literalmente, ese error manda a regenerar el token. Y seria perder la
tarde: **el mismo token acababa de funcionar** tres veces contra
`graph.instagram.com`.

    El sintoma dice «credencial». La causa es «flujo».

El token pertenece a Instagram Login; `business_discovery` vive en
`graph.facebook.com`, que solo acepta tokens de Facebook Login. Por eso el
adapter no lo clasifica como `CREDENCIAL_RECHAZADA` sino como
`NO_SOPORTADO_POR_ESTA_CONFIGURACION`, con el requisito exacto que falta.

### La distincion que hizo falta ese dia

`vocero593_` respondio a todo sin un fallo. Con la matriz anterior eso habria
puesto Instagram en `MEDIDO` y lo habria dejado entrar al benchmark
multicandidato.

Y habria sido falso: se midio NUESTRA cuenta. Ninguno de los siete candidatos
nos va a dar un token.

    MEDIDO_PROPIO    funciona sobre una cuenta que administramos
    MEDIDO_TERCERO   funciona sobre una cuenta que no controlamos

Solo la segunda habilita el benchmark. La matriz ahora las separa en las cinco
plataformas, y quedo asi:

| | medido sobre terceros | medido sobre cuenta propia |
|---|---|---|
| YouTube | 9 | 0 |
| X | 9 | 0 |
| **Instagram** | **0** | **8** |
| Facebook | 0 | 0 |
| TikTok | 0 | 0 |

### PUBLIC_METRIC frente a OWNER_INSIGHT

Cada metrica declara su alcance, y no es un detalle cosmetico:

    like_count, comments_count    PUBLIC_METRIC   los ve cualquiera
    reach, saved, shares, views   OWNER_INSIGHT   solo el que administra

Los cinco insights que obtuvimos **no existirian** para el Instagram de un
candidato. Presentarlos algun dia como «datos publicos del candidato» seria el
error caro de este modulo, y por eso la etiqueta viaja con cada cifra.

### Lo que NO se persistio

`vocero593_` **no es un candidato**. Guardar sus publicaciones en el Lake habria
metido datos de una cuenta propia en el corpus de inteligencia electoral, asi
que no se persistio nada: la etapa A demuestra capacidad, no aporta expediente.

### El token no aparece en ningun sitio

Viaja en la query porque la API lo exige, y por eso ninguna URL sale del adapter
sin pasar por `sanitizar()`. Lo que se registra es la RUTA. Hay cuatro tests
dedicados a esto, incluido el caso en que Meta devuelve la peticion completa
dentro del mensaje de error.

### Riesgos y limitaciones

- **Instagram no entra al benchmark.** Cero capacidades sobre terceros.
- **Los REELS no se probaron**: las cinco publicaciones de la muestra eran
  IMAGE, asi que las metricas propias de reel siguen sin comprobarse.
- **Facebook Login es un camino largo**: pagina vinculada, App Review y
  Business Verification, y la concesion la decide Meta, no nosotros.
- Y aun consiguiendolo, `business_discovery` solo alcanza cuentas
  **profesionales**. Un candidato con perfil personal seguiria fuera.

---

## 18-duodetricies. META-PUBLIC-ACCESS-01 (2026-08-28)

Commit `docs(candidate): assess official Meta public access`.

**975 comprobaciones, 24 suites, 0 fallos.** Gate documental: cero requests
reales, cero tokens generados, nada configurado en Meta.

Detalle completo con fuentes en `docs/META-PUBLIC-ACCESS.md`.

### La cadena, confirmada con documentacion oficial

> Para leer a un tercero hace falta **Advanced Access**; Advanced Access exige
> **Business Verification**; y el endpoint que sirve a terceros vive en el flujo
> de **Facebook Login**, no en el que tenemos.

Los tres eslabones estan documentados y ninguno es opcional.

### Lo demostrado

El error 190 de META-IG-REAL-01 queda explicado con fuente: la referencia
oficial de `business_discovery` exige un **Facebook User access token**, y
nuestro token es de Instagram Login. `Cannot parse access token` es literalmente
eso — el host no sabe leer un token que no es suyo—, no una credencial invalida.

### Lo documentado, que no es lo mismo que medido

`business_discovery` **sigue vigente** y devolveria de un tercero: `username`,
`name`, `followers_count`, `media_count`, `media`, y `like_count`,
`comments_count` y `view_count` por publicacion.

**No** devolveria `reach`, `impressions`, `saved` ni `shares`: no aparecen
documentados para terceros. Los cinco insights que obtuvimos de nuestra cuenta
son `OWNER_INSIGHT` y no existirian para un candidato.

`Page Public Content Access` tambien sigue vigente, y Meta lista explicitamente
como caso admitido «analizar o mostrar publicaciones e interaccion en Paginas»,
que es literalmente lo nuestro.

### La respuesta que decide la cobertura

| Plataforma | Tipo de cuenta | ¿Via oficial sin autorizacion? |
|---|---|---|
| Instagram | Business / Creator | **si**, con la cadena completa |
| Instagram | **personal** | **NO** |
| Facebook | **Pagina** | **si**, con PPCA |
| Facebook | **perfil personal** | **NO** |

Y el candidato patron tiene **perfil personal** de Facebook. Por la via oficial
de Meta es inalcanzable, hoy y despues de cualquier revision. Esto no se arregla
con dinero ni con tiempo: es una decision de producto de Meta.

### Lo no demostrado

Nada se probo contra la red. `PRUEBA_REAL_NO_EJECUTADA — REQUIERE CONFIGURACION
PREVIA`: no tenemos el tipo de token que exige `business_discovery`, y probar a
ciegas habria gastado una llamada para confirmar lo que la documentacion ya
dice.

### La regla, ahora ejecutable

META-IG-REAL-01 enseno lo facil que es que una plataforma ascienda sola. Este
gate anade el riesgo contrario: documentar lo que Meta PODRIA dar y que eso
cuente como capacidad.

`habilitaBenchmark(plataformaId)` responde con una funcion en lugar de una
convencion:

    youtube    habilita=true    9 capacidades sobre terceros
    x          habilita=true    9 capacidades sobre terceros
    instagram  habilita=false   solo 8 sobre nuestra propia cuenta
    facebook   habilita=false   ninguna
    tiktok     habilita=false   ninguna

Ni medir lo propio ni leer la documentacion habilitan. Solo `MEDIDO_TERCERO`.

### Recomendacion: RUTA HIBRIDA

- **Seguir con Meta oficial** para cuentas **profesionales**: la via existe, es
  legitima y no cuesta licencia.
- **Evaluar proveedor comercial** solo para lo que la via oficial no cubre
  —cuentas y perfiles personales—, con presupuesto en mano y no antes.
- **No bloquear** el benchmark esperando a Meta: YouTube y X ya lo sostienen sin
  revision ni verificacion.

### El dato que falta antes de invertir semanas

Cuantos de los siete candidatos usan cuenta **profesional** y cuantos
**personal**, en Instagram y en Facebook. Si la mayoria son personales, la via
oficial rinde poco y la conversacion se vuelve sobre proveedor. Ese recuento
cuesta minutos y cambia la decision.

### Riesgos

- **El coste no es dinero, es dependencia.** App Review y Business Verification
  los concede Meta y pueden denegarse o cambiar de criterio. No se afirma que
  vayan a aprobarse: aqui solo se evalua viabilidad.
- **Lo obtenible de un tercero es bastante menos** que lo visto en la cuenta
  propia: ni reach, ni saves, ni shares.
- No consta cuanto tarda la revision, y no se estima.

---

## 18-undetricies. P-CAND-FB-MULTI-ASSET-01 (2026-08-28)

Commit `fix(candidate): preserve multiple Facebook assets`.

**1007 comprobaciones, 25 suites, 0 fallos.** Sin red, sin cuota.

### El caso

Juan Cristobal Lloret tiene **dos activos de Facebook** declarados por el
analista. Y tambien dos de Instagram.

### La regla, ahora explicita

    UN CANDIDATO PUEDE TENER N ACTIVOS POR PLATAFORMA.

Perfil, pagina, pagina de campana, pagina historica. Encontrar uno no significa
haberlos encontrado todos, y ninguno sustituye a otro.

### El modelo 1:N ya funcionaba

Los dos activos sobreviven las tres capas —`cuentasReferencia`, expediente
consolidado y ficha— y la interfaz ya los pinta: `p.cuentas.map(...)` recorre
todas las cuentas de cada plataforma, no la primera.

La clave de identidad del activo es `plataforma + handle normalizado`. Dos
handles distintos son dos activos, aunque compartan candidato, plataforma y
nombre.

**No hizo falta corregir nada de persistencia ni de interfaz.**

### El defecto que si aparecio, en discovery

En la propagacion de handles:

```
/* Plataformas que ya tienen cuenta atribuida: no se tocan. */
if (yaResueltas.has(adaptador.plataformaId)) { omitir }
```

La intencion era buena —no gastar presupuesto repreguntando por algo resuelto—
pero cerraba de mas: en cuanto Facebook tenia **una** cuenta atribuida, la
propagacion dejaba de buscar en Facebook **entera**. El segundo activo no se
buscaba nunca por esa via.

Corregido: se omite el **par** `plataforma:handle`, no la plataforma. Se
conserva el ahorro de no repreguntar lo mismo y desaparece el cierre falso.

Es un arreglo local, de una linea conceptual, dentro del planificador que ya
existia. No se subio ningun tope y el truncamiento se sigue declarando.

### Clasificacion: UNKNOWN, y es la respuesta correcta

`candidateAssets.js` clasifica un activo de Facebook **solo con lo persistido**.

    /profile.php?id=   PERFIL
    /people/           PERFIL
    /pages/  /pg/      PAGINA
    og:type            decide, si existe

Las dos URLs de Lloret son de **vanidad** —`facebook.com/nombre`—, y esa forma
la usan tanto los perfiles como las paginas. Asi que las dos quedan `UNKNOWN`.

No es pereza: inventar el tipo llevaria a esperar de un perfil algo que ninguna
API va a dar nunca. El modulo declara ademas **como se sabria**: leyendo su
`og:type`, resolviendo el id con la API que hoy no tenemos para terceros, o que
el analista lo declare.

### Elegibilidad Meta: por activo, y no es medicion

| Tipo | Elegibilidad |
|---|---|
| `FACEBOOK_PAGE` | `POTENCIALMENTE_ELEGIBLE_META` via Page Public Content Access |
| `FACEBOOK_PROFILE` | `NO_ELEGIBLE_META_PUBLIC_PAGE_API` |
| `UNKNOWN` | `INDETERMINADA` |

Un candidato no es «elegible para Meta»: lo son o no sus activos, uno por uno.
Una pagina elegible **no** vuelve elegible al perfil del mismo candidato.

Y lo que mas facil se confunde: `POTENCIALMENTE_ELEGIBLE` **no es**
`MEDIDO_TERCERO` y **no habilita el benchmark**. `habilitaBenchmark("facebook")`
sigue devolviendo `false`.

### Relacion con el candidato: no se regala oficialidad

    senal independiente   → OFFICIAL, VERIFICADA
    algun proveedor       → ASSOCIATED, NO_VERIFICADA
    lo dijo el analista   → DECLARED_BY_ANALYST, NO_VERIFICADA

Tener mas seguidores no asciende a nadie. Hay un test que lo fija.

Estado real de los dos activos de Lloret hoy: uno `ASSOCIATED` y otro
`DECLARED_BY_ANALYST`, los dos `NO_VERIFICADA`.

### Activo principal: deliberadamente `null`

No se elige uno automaticamente. `primaryForDisplay` y `primaryForObservation`
son decisiones distintas y ninguna se deduce del numero de seguidores. Elegir
por seguidores es exactamente lo que hace desaparecer al otro de la vista.

### Gap menor, no corregido

El formulario de **alta** admite una sola URL por plataforma. No es una
restriccion del modelo —por «Editar identidad» se anaden las que hagan falta, y
asi se cargaron las dos de Lloret— pero conviene saberlo.

### Riesgos

- **Los dos activos de Facebook siguen sin tipificar.** Hasta que se lea su
  `og:type` no se sabe cual es pagina, y por tanto no se sabe si alguno es
  elegible para Meta.
- **Instagram tambien tiene dos activos** con el mismo problema pendiente.
- El tope de propagacion sigue siendo 4: abrir la plataforma no garantiza que el
  segundo handle entre en el plan, solo que ya no se descarta por principio.

---

## 18-tricies. META-COVERAGE-AUDIT-01 (2026-08-28)

Commit `feat(candidate): audit Meta candidate eligibility`.

**1015 comprobaciones, 25 suites, 0 fallos.** 26 lecturas de metadata publica,
cero cuota de proveedor, cero tokens.

Detalle completo en `docs/META-COVERAGE-AUDIT.md`.

### El control que salvo la auditoria

La primera pasada clasifico **once de once** activos de Facebook como
`FACEBOOK_PROFILE`, con confianza MEDIA. Demasiado limpio.

Se probo el clasificador contra tres paginas que no admiten discusion —Meta,
BBC News y NASA—: **las tres salieron «perfil»**. Los tokens usados como senal
—`userID`, `profile_id`, `entity_type`— estan en el armazon que Facebook sirve
sin sesion, en cualquier URL. Eran plantilla.

    0 % de acierto con confianza MEDIA.

La senal se retiro y los once volvieron a `UNKNOWN`, que era la respuesta
honesta. Sin ese control, este gate habria concluido «los 7 usan perfiles
personales, Meta no cubre a nadie, no invertir»: firme, accionable y falsa.

Un clasificador que acierta el 0 % con confianza alta es peor que uno que dice
«no lo se»: el segundo deja el hueco a la vista.

### Inventario real

**23 activos Meta**: 12 de Instagram en los 7 candidatos, 11 de Facebook en 6.

**Nueve casos de multi-activo**: 4 candidatos con mas de un Instagram, 5 con mas
de un Facebook. El modelo 1:N no es teorico — lo usa la mayoria del universo
real.

### Clasificacion: 0 de 23

Las 23 URLs devolvieron HTTP 200 y ninguna dio senal que discrimine.

| | Instagram | Facebook |
|---|---|---|
| confirmadas elegibles | 0 | 0 |
| confirmadas no elegibles | 0 | 0 |
| `NO_CLASIFICADA` | 12 | 11 |
| tasa de clasificacion | **0 %** | **0 %** |

Facebook: todas son URLs de vanidad y el HTML sin sesion devuelve
`og:type=video.other`, que no distingue. Instagram: `og:type=profile` aparece
casi siempre, pero no separa Business/Creator de personal, que es justo lo que
decide la elegibilidad.

### Cobertura Meta

    confirmadamente cubribles     0/7      0 %
    cobertura DESCONOCIDA         7/7    100 %
    confirmadamente fuera         0/7      0 %

Los tres numeros son distintos y ninguno se lee por otro. **`UNKNOWN` no se suma
a `NO`**: no haber demostrado que una cuenta es profesional no demuestra que sea
personal.

Comparabilidad: **INDETERMINADA** — el umbral interno la fija cuando mas del
30 % de los candidatos dependen de activos sin clasificar; aqui dependen el
100 %.

### Decision: META-INVESTIGAR-MAS

La cobertura no es baja: es **desconocida**. Invertir ahora seria apostar y
descartar ahora seria igual de infundado.

Lo que falta cuesta minutos —clasificar 23 activos— frente a semanas de App
Review y Business Verification cuya duracion no consta. Y el coste de esperar es
cero: X y YouTube ya sostienen el benchmark.

### Lo que este gate NO cambio

`habilitaBenchmark()` sigue igual: YouTube y X en `true`, Instagram, Facebook y
TikTok en `false`. Auditar cobertura no es medir, y hay tests que lo fijan.

### Riesgos

- **No se resolvio ninguna clasificacion.** Este gate describe con precision lo
  que no sabemos.
- El HTML publico de Facebook **no distingue** perfil de pagina sin sesion:
  comprobado con control, no supuesto.
- Los perfiles personales no los cubre ninguna via oficial, asi que si la
  clasificacion resultara mayoritariamente personal, el proveedor seria la unica
  ruta.

---

## 18-untricies. P-CAND-ASSET-TYPE-DECLARE-01 (2026-08-28)

Commit `feat(candidate): support analyst-declared Meta asset types`.

**1037 comprobaciones, 25 suites, 0 fallos.** Sin red, sin cuota, sin tokens.

### El problema que resuelve

META-COVERAGE-AUDIT-01 clasifico **0 de 23** activos Meta y demostro por que:
el HTML publico no distingue perfil de pagina ni Business de personal.

Afinar el clasificador no era el camino. Una persona que abre la cuenta lo ve en
un segundo — el dato existe, solo que no esta donde lo buscabamos.

Asi que ahora lo declara el analista. Y Sentinel **no llama a eso una
verificacion**.

### La separacion, que es todo el gate

| Campo | Que dice |
|---|---|
| `assetType` | el tipo, venga de donde venga |
| `assetTypeSource` | `ANALYST_DECLARATION` / `PUBLIC_METADATA` / `META_API` / `NINGUNA` |
| `assetTypeVerification` | `NO_VERIFICADA` mientras la fuente no sea `META_API` |

    ANALYST_DECLARATION != VERIFICADO_TECNICAMENTE

Es facil de escribir y facil de perder: basta con que alguien, dentro de tres
meses, pinte un check verde al lado de un tipo declarado para que una hipotesis
se convierta en una comprobacion sin que nadie lo decida.

Ninguna acumulacion de declaraciones asciende a `VERIFICADA`: solo lo hace una
fuente de `FUENTES_VERIFICADAS`, que hoy contiene unicamente `META_API`.
`PUBLIC_METADATA` esta fuera a proposito, por lo que paso en la auditoria.

### Tipos admitidos

    Facebook    UNKNOWN · FACEBOOK_PROFILE · FACEBOOK_PAGE

    Instagram   UNKNOWN · INSTAGRAM_PROFESSIONAL · INSTAGRAM_BUSINESS
                INSTAGRAM_CREATOR · INSTAGRAM_PERSONAL

`INSTAGRAM_PROFESSIONAL` existe porque el analista suele saber que una cuenta es
profesional sin saber si Meta la tiene como Business o Creator: en la interfaz
se ven casi igual. Obligarle a elegir seria obligarle a inventar. Para la
elegibilidad da lo mismo —las tres abren la misma via— y para lo demas consta
que no se afino.

### Serie aparte, y la razon importa

Las declaraciones NO viven en `cuentasReferencia`. Meterlas ahi habria
funcionado, y cada clasificacion estaria reescribiendo el registro que sostiene
la URL, el handle y el estado de identidad de la cuenta por un campo que no
tiene nada que ver.

En su propia serie del Lake no puede alcanzarlos ni por accidente, y el
historial sale gratis: quien dijo que, cuando, y que dijo antes. Corregirse no
borra que antes se dijo otra cosa.

### Cobertura en tres niveles

    COBERTURA_CONFIRMADA    verificada contra una API de Meta
    COBERTURA_DECLARADA     lo dijo el analista
    COBERTURA_DESCONOCIDA   nadie lo ha clasificado

No se suman y ninguna se lee por otra. Un activo declarado elegible obtiene
`POTENCIALMENTE_ELEGIBLE_META_DECLARADA`, estado propio y no matiz del otro:
quien firma una inversion en App Review necesita saber cuantos de sus activos
elegibles lo son porque alguien los miro.

Dos reglas de recuento, que son las que se rompen solas:

- Un solo `UNKNOWN` devuelve al candidato a `DESCONOCIDA`. Para declararlo fuera
  hacen falta activos **y** que todos sean no elegibles.
- No tener cuenta en una plataforma es `SIN_ACTIVO`, no `NO_ELEGIBLE`. Juan
  Carlos Vega no tiene Facebook, y eso no dice nada sobre si su Facebook seria
  elegible.

### El caso Lloret, ensayado

Sus dos activos de Facebook admiten uno `FACEBOOK_PROFILE` y otro
`FACEBOOK_PAGE` a la vez, sin deduplicarse y sin que ninguno desplace al otro.
El candidato pasa a `COBERTURA_DECLARADA` por la pagina y su perfil sigue
`NO_ELEGIBLE`: la elegibilidad es por activo, nunca por candidato.

**Cual es cual no lo decide el slug ni Sentinel.** El ensayo se hizo en un
proyecto desechable; el proyecto real sigue con 0 declaraciones.

### Lo que este gate NO cambio

`habilitaBenchmark()` sigue igual: YouTube y X en `true`, Instagram, Facebook y
TikTok en `false`. Hay un test que declara dos activos elegibles y comprueba que
la funcion real no se mueve.

### Riesgos

- **Los 23 activos siguen sin clasificar.** El gate entrega la capacidad, no la
  clasificacion. Mientras nadie declare, la cobertura Meta sigue DESCONOCIDA 7/7.
- **CORRECCION POSTERIOR (§18-duotricies).** Este gate reporto el selector como
  disponible en la interfaz. Lo estaba en `AccountIntelligencePanel`, que no es
  la pantalla donde el analista edita cuentas: en «Editar identidad digital» no
  aparecia, y la ruta que la alimenta ni siquiera devolvia los tipos. Corregido
  al dia siguiente. La afirmacion sobre dominio y persistencia se sostiene; la
  de interfaz era incompleta.
- Una declaracion es tan buena como la memoria de quien la hizo. Por eso lleva
  firma y fecha, y por eso no asciende a verificada.
- Si el analista declara un tipo que contradice a la URL —`/profile.php?id=` es
  inequivoco— se conserva la declaracion y el conflicto queda visible en el
  activo. Una de las dos esta mal y conviene saberlo.

---

## 18-duotricies. P-CAND-ASSET-TYPE-UI-FIX-01 (2026-08-29)

Commit `fix(candidate): render Meta asset type selectors`.

**1042 comprobaciones de backend, 25 suites, 0 fallos** + **13 de render**.
Sin red de proveedores, sin cuota, sin tokens.

### Causa raiz

El gate anterior reporto «selector por activo Meta» y no era falso: el selector
existia y funcionaba. Estaba en `AccountIntelligencePanel.jsx`, pestana
Identidad.

La pantalla donde el analista edita cuentas es otra:
`CandidateIdentityForm.jsx`, «Editar identidad digital». Ahi no habia nada.

Dos fallos encadenados, y el segundo es el importante:

1. El componente elegido no era el de esa pantalla.
2. **`GET /identidad` —la ruta que alimenta el editor— no devolvia los tipos.**
   Solo viajaban por `/inteligencia`. Aunque el selector hubiera estado en el
   componente correcto, no habria tenido con que pintarse.

Comprobado, no supuesto: la ficha real del backend en ejecucion no traia
`activosMeta`.

### Por que las 1037 pruebas no lo vieron

Porque ninguna miraba HTML. El backend devolvia los tipos correctamente y el
dominio estaba bien; el fallo vivia entero en la distancia entre «la funcion
devuelve el dato» y «la pantalla lo pinta».

Esa distancia ahora tiene una prueba:
`apps/web/tests/identity-form.check.jsx` renderiza la pantalla real con la
respuesta real de la API y cuenta los `<select>`.

    npm run check:identidad --workspace apps/web
    node apps/web/dist-ssr-identidad/check.mjs ficha.json

Una leccion que conviene no perder: un gate que reporta UI y solo prueba dominio
esta reportando lo que cree, no lo que hay.

### La correccion

`GET /identidad` devuelve ahora un bloque `activosMeta.porActivo` indexado por
id de activo, con el tipo, su procedencia, su verificacion y los tipos
admitidos de esa plataforma. Se lee del Lake; no sale a la red.

El selector vive dentro de la tarjeta de cada cuenta, **debajo** del estado de
identidad y separado por una linea:

    @jotalloretv
    Consolidada · revalidada          <- ESTADO DE IDENTIDAD
    ─────────────────────────
    Tipo  [ Pagina / Fan Page ▼ ]     <- TIPO DEL ACTIVO
    declarado por analista · no verificado

Son dos preguntas distintas: *de quien es la cuenta* y *que clase de cuenta es*.
Una cuenta puede estar consolidada con evidencia y seguir sin que nadie sepa si
es un perfil o una pagina.

### Guardado

Al cambiar el selector, no al pulsar «Guardar cambios». No es un descuido:
declarar el tipo NO es una edicion de identidad y no debe viajar en el mismo
PATCH que el nombre o las cuentas. Usa el endpoint de
P-CAND-ASSET-TYPE-DECLARE-01, sin segunda persistencia.

### Validado por HTTP contra el backend real

En un proyecto desechable, con dos Facebook y dos Instagram:

    facebook:ensayo.perfil      FACEBOOK_PROFILE        NO_ELEGIBLE_META_PUBLIC_PAGE_API
    facebook:ensayopagina       FACEBOOK_PAGE           POTENCIALMENTE_ELEGIBLE_META_DECLARADA
    instagram:ensayo_pro        INSTAGRAM_PROFESSIONAL  POTENCIALMENTE_ELEGIBLE_META_DECLARADA
    instagram:ensayo_personal   INSTAGRAM_PERSONAL      NO_ELEGIBLE_META_OFICIAL_TERCEROS

Los cuatro sobreviven a releer la ficha. Cambiar el primero no movio a los
otros tres. Las cuentas —id, URL, handle, estado— quedaron identicas antes y
despues.

### Un defecto de accesibilidad que aparecio de paso

Lloret usa el mismo handle en Facebook y en Instagram —`jotalloretv`—, asi que
dos selectores tenian etiqueta identica y un lector de pantalla los anunciaba
igual. La etiqueta lleva ahora la plataforma delante.

Lo encontro la prueba de render al contar dos selectores donde esperaba uno.

### Lo que este gate NO cambio

`habilitaBenchmark()` sigue igual. `verificadaPorSentinel` no se toca. Ninguna
declaracion asciende a `META_API` ni a `VERIFICADA`.

### Requiere reinicio del backend

`npm run dev:backend` es `node server.js`, sin watcher: el proceso en marcha
sirve el codigo con el que arranco. **Hay que reiniciarlo** para que
`/identidad` devuelva `activosMeta`. Vite recarga solo.

### Riesgos

- El selector tambien sigue en `AccountIntelligencePanel`. No es un problema
  —leen y escriben el mismo sitio— pero son dos superficies que mantener.
- La prueba de render comprueba texto y estructura, no color ni espaciado. No
  sustituye a mirar la pantalla.
- Los 23 activos reales siguen sin clasificar. El gate entrega la pantalla, no
  la clasificacion.

---

## 18-tertricies. META-THIRD-PARTY-REAL-01 (2026-08-30)

Commit `feat(candidate): validate Meta third-party observation`.

**1051 comprobaciones, 25 suites, 0 fallos.** **4 llamadas Meta**, 0 reintentos.

Detalle en `docs/META-THIRD-PARTY-REAL.md`.

### La pregunta y la respuesta

Puede Sentinel observar HOY una cuenta de candidato tercero por via oficial de
Meta. **No.** Y ya se sabe por que, que es lo que faltaba.

Los dos activos probados salieron del expediente, declarados por el analista:
un Instagram `INSTAGRAM_PROFESSIONAL` y un Facebook `FACEBOOK_PAGE`. Los
mejores candidatos posibles: si algo tenia que funcionar, era con estos.

### Lo que aporta este gate

    1  GET graph.instagram.com/me                    200
    2  GET graph.instagram.com/{id}?business_discovery   400 · code 100
    3  GET graph.facebook.com/{page}?fields=...          400 · code 190
    4  comentarios                                    NO EJECUTADA

**La llamada 2 es la que aporta informacion nueva.** META-IG-REAL-01 habia
medido `business_discovery` contra `graph.facebook.com` y recibido un 190, que
podia estar tapando otra cosa. Lo que faltaba era preguntar al host que SI
acepta nuestro token.

    «Tried accessing nonexisting field (business_discovery)»

No es un permiso que falte: **el campo no existe ahi**. La via de Instagram
Login no descubre terceros, y ningun permiso sobre este token lo va a producir.
Un 400 asi es mejor que un 403 — cierra la pregunta en lugar de dejarla
abierta.

### El control que hace legibles los fallos

La llamada 1 existe solo para eso. Con `graph.instagram.com/me` devolviendo 200
en la misma sesion, el 190 de la llamada 3 ya no se puede leer como «token
invalido»: el token esta vivo, el host es otro.

Sin ese control, «Invalid OAuth access token» manda a regenerar el token. Seria
perder el tiempo.

### Causa demostrada vs hipotesis

Lo que el 190 demuestra: **no tenemos credencial para `graph.facebook.com`**.

Lo que NO demuestra, y es lo que se sobreinterpreta: que haga falta App Review
o Business Verification. El error se detiene ANTES de evaluar permisos, al
parsear la credencial. Sobre permisos no dice nada, y consta en la matriz como
`noDemostrado`.

Hasta que exista un token de Facebook Login, cualquier error hablara de la
credencial. App Review y Business Verification siguen siendo preguntas sin
plantear.

### Comentarios: NO_PROBADO, que no es NO_DISPONIBLE

Ninguna plataforma devolvio una publicacion de tercero, asi que no habia nada a
lo que pedirle comentarios. Marcarlo `COMMENTS_NOT_AVAILABLE` seria inventar
una medicion.

Queda fijada la obligacion de lenguaje para cuando funcione:

    COMENTARIOS OBSERVADOS != TODOS LOS COMENTARIOS

Un corpus paginado y con limites de rate es una muestra. Decir «los comentarios
dicen X» sobre una muestra es una afirmacion falsa sobre el universo.

### Nada se persistio

Cero publicaciones, cero snapshots, cero metricas. Un test lo fija: una llamada
bloqueada no puede devolver cifras en cero, porque un cero es una medicion y la
ausencia no lo es.

### Lo que este gate NO cambio

`habilitaBenchmark()` sigue igual. Las declaraciones del analista siguen
`NO_VERIFICADA`: las llamadas fallaron, asi que ni ascendieron ni se
degradaron.

### Riesgos

- **Sigue sin haber ninguna observacion de tercero en Meta.** Dos de las cinco
  plataformas objetivo estan cerradas y una —TikTok— sin probar.
- El siguiente paso cuesta un token, no una revision de Meta. Pero tras ese
  token puede aparecer la cadena entera de App Review y Business Verification,
  cuya duracion no consta.
- El coste de no hacer nada es cero: X y YouTube ya sostienen el benchmark.

---

## 18-quatertricies. META-FB-LOGIN-SETUP-01 (2026-08-30)

Commit `fix(candidate): select Meta token by host family`.

**1059 comprobaciones, 25 suites, 0 fallos.** **Cero llamadas Meta.**

### El defecto que habia detras del bloqueo

META-THIRD-PARTY-REAL-01 concluyo «falta un token de Facebook Login». Cierto, y
no era todo.

El adaptador tenia UNA lista de variables y una sola `credencial()`, y el token
que devolvia se enviaba a los dos hosts. Con un solo token configurado eso
parece inofensivo: es justo lo que produjo el `400 · code 190`.

Y **habria sobrevivido a la solucion**. Al anadir el token de Facebook,
`graph.facebook.com` habria seguido recibiendo el de Instagram porque era el
primero de la lista. El mismo 190, ahora con la credencial correcta guardada al
lado y sin usarse — el peor caso posible, porque parece que la configuracion ya
esta hecha y el error dice «regenera el token».

Este gate era «preparar la credencial». Lo que habia que preparar primero era el
codigo que la elige.

### Corregido

El token lo decide el HOST, no el orden de una lista:

    graph.instagram.com   INSTAGRAM_ACCESS_TOKEN        Instagram Login
    graph.facebook.com    FACEBOOK_USER_ACCESS_TOKEN    Facebook Login

Sin respaldo cruzado. Si falta el que toca, la llamada **no se hace**:
`SIN_CREDENCIAL`, `llamadas: 0` y la familia que falta. Contar una llamada que
no salio falsearia el unico numero que este proyecto vigila.

`sanitizar()` redacta las dos familias: el error de un host puede traer el token
del otro, y redactar solo uno lo dejaria a la vista precisamente en el mensaje
que alguien va a copiar y pegar.

### Ocho pruebas antiguas cambiaron, y no se debilitaron

Pedian una respuesta simulada de `graph.facebook.com` y llegaban al `fetch`
inyectado usando un token que ese host nunca habria aceptado: **vivian del
defecto sin saberlo**. Ahora la suite declara las dos credenciales ficticias, y
las pruebas que comprueban la ausencia de una la borran explicitamente, que es
mas honesto que depender de que no este.

### Credencial requerida, por via

Las dos vias comparten familia de token —Facebook User access token, flujo
Facebook Login for Business— y no comparten permiso:

    business_discovery   instagram_basic, instagram_manage_insights,
                         pages_read_engagement, pages_show_list

    Page publica         Page Public Content Access

### Credencial validada — una llamada

    GET graph.facebook.com/v23.0/me?fields=id,name    HTTP 200

`CREDENCIAL_PARSEABLE`. El token que genero el usuario es de la familia
correcta: 297 caracteres y cadena distinta de la de Instagram.

La llamada pregunta por el titular del token, no por un tercero. Separa tres
cosas que se confunden —no se parsea, se parsea, se parsea y falla por
permisos— y responde solo la primera.

`validarCredencialDeFacebook()` devuelve `titularIdentificado: boolean` y NO el
nombre ni el id. Para validar un token no hace falta el nombre de nadie, y lo
que no se devuelve no acaba en un log.

### Lo que un token NO resuelve

Standard Access alcanza **solo a usuarios y Paginas con un rol en la app**. Un
candidato nunca lo va a tener, asi que con la credencial correcta y sin Advanced
Access el reintento sobre un candidato seguira fallando.

Pero fallara con un error de **permisos**, y eso es informacion que hoy no
tenemos. Es exactamente lo que mediria META-THIRD-PARTY-REAL-02: convertir una
hipotesis documental en una causa demostrada.

    CREDENCIAL_PARSEABLE != MEDIDO_TERCERO

`estadoDeCredenciales()` lo declara en el propio dato: con el token presente,
`facebookLogin.alcanza` sigue **vacio**, porque tener la credencial no dice a
quien alcanza.

### App Review y Business Verification: todavia no demostrados

La documentacion dice que Advanced Access exige Business Verification y que
terceros exigen Advanced Access. Pero ninguna respuesta de Meta nos lo ha dicho:
ninguna llamada ha llegado a evaluar permisos.

La distincion no es un tecnicismo. Es la diferencia entre «lo lei» y «lo medi»,
y este proyecto lleva cuatro gates sosteniendola.

### Riesgos

- **La credencial ya esta y validada**, pero eso solo cierra la pregunta del
  flujo. El acceso a terceros sigue sin medir.
- Incluso con el token, el reintento sobre un candidato fallara mientras la app
  este en Standard Access. Lo que se gana es saber por que.
- El coste de no hacer nada sigue siendo cero: X y YouTube sostienen el
  benchmark.

---

## 18-quintricies. META-THIRD-PARTY-REAL-02 (2026-08-30)

Commit `feat(candidate): revalidate Meta third-party access`.

**1076 comprobaciones, 25 suites, 0 fallos.** **7 llamadas Meta.**

Detalle en `docs/META-THIRD-PARTY-REAL.md`.

### El hallazgo que casi rompe el gate

La llamada de prerequisito, `GET graph.facebook.com/me/accounts`, devolvio que
el token **administra la Pagina del candidato patron** y su Instagram vinculado.

Asi que las dos primeras sondas preguntaron por NUESTRO PROPIO ACTIVO:

    business_discovery(patron)   HTTP 200   10.821 seguidores
    Page del patron              HTTP 200   55.859 seguidores

Datos reales, cifras reales, cero evidencia sobre terceros. **Un resultado
positivo con el sujeto equivocado se lee exactamente igual que un exito**, y
sin esa llamada de prerequisito este gate habria declarado `MEDIDO_TERCERO` con
evidencia de `MEDIDO_PROPIO`.

Se repitio contra un candidato que no aparece en `me/accounts`. Esa es la
medicion que sostiene todo lo demas.

### Instagram: MEDIDO_TERCERO

    GET graph.facebook.com/{ig}?fields=business_discovery.username()   200

Volvio username, name, followers_count (9.719), media_count (1.635) y cinco
publicaciones con id, permalink, timestamp, media_type, like_count y
comments_count. Likes de la muestra: 19, 28, 15, 36, 30.

No volvieron `follows_count` ni `view_count`. No se pidieron `reach`,
`impressions`, `saved` ni `shares`: son OWNER_INSIGHT.

### Facebook: BLOQUEADO_PERMISOS

    Page que ADMINISTRAMOS   HTTP 200
    Page de un TERCERO       HTTP 400 · code 100

La primera parece un exito y no lo es: funciono porque administramos esa
Pagina. Es el comportamiento documentado de Standard Access, ahora medido.

La segunda trae el diagnostico entero, con **tres** alternativas nombradas por
Meta y que no cuestan lo mismo:

    permiso pages_read_engagement
    feature Page Public Content Access
    feature Page Public Metadata Access

Esta si es causa demostrada: el error llega a evaluar permisos y los enumera.
**Business Verification no aparece mencionada.**

### Comentarios de Instagram: PARCIAL

`comments_count` llega por publicacion del tercero. El TEXTO no:

    ...media{comments{text,timestamp,username}}
    HTTP 400 · code 100 · «Please read documentation for supported fields»

Recuento si, texto no, y esto ultimo es una MEDICION. Con solo el recuento no
se puede analizar ni un comentario, asi que Comments Intelligence sigue sin
fuente por esta via.

### Verificacion tecnica del tipo

`business_discovery` solo responde sobre cuentas profesionales: **responder ES
la evidencia del tipo**. Tres activos pasan a `META_API` / `VERIFICADA` y los
otros veinte quedan intactos en `ANALYST_DECLARATION`.

Nuevo `crearVerificacionDeTipo`, que exige endpoint y evidencia y rechaza
resultar UNKNOWN: «verifique que no lo se» no es un estado.

### habilitaBenchmark(): Instagram entra

    instagram   false -> TRUE
    facebook    false -> false

Siete capacidades sobre un tercero genuino: identidad, cuenta, followers,
publicaciones, likes, comments, url_verificable. **El mismo baremo con el que
entraron X y YouTube** — ser mas estricto solo con Instagram seria arbitrario.

`views` y `shares` NO ascienden: son OWNER_INSIGHT y no vinieron del tercero.
Moverlas seria presentar una cifra nuestra como si fuera de un candidato, que
es justo lo que la separacion PROPIO/TERCERO existe para impedir.

### Discrepancia con la documentacion, registrada

META-PUBLIC-ACCESS-01 documento que terceros exigen Advanced Access y Business
Verification. La llamada funciono sin que consten concedidos.

Lo medido es que funciona. POR QUE funciona no esta demostrado y no conviene
deducirlo, asi que se registra la discrepancia en lugar de reescribir una de
las dos.

### Defecto encontrado de paso

`guardarDeclaracionesDeTipo` usaba `candidato + fecha` como clave de entidad.
Dos lotes del mismo candidato con el mismo `declaradoEn` producian la MISMA
entidad, y el Lake devuelve la ultima version: el primer lote seguia escrito y
dejaba de leerse, con `escrito: true`. Fallaba en silencio. La clave lleva
ahora un discriminante de contenido.

### Once aserciones cambiaron, ninguna se debilito

Afirmaban que Instagram no tenia MEDIDO_TERCERO y que Meta no habilitaba nada.
Era verdad y dejo de serlo. Cada una se reescribio hacia el invariante mas
fuerte que sigue vivo: que lo propio y lo de terceros conviven sin mezclarse,
que MEDIDO_PROPIO no habilita por si solo —y ahora lo demuestra Facebook— y que
lo que asciende a una plataforma es una llamada, no un documento.

### Riesgos

- **Una sola cuenta medida.** Instagram habilita con la misma evidencia con la
  que habilitaron X y YouTube, y es una muestra de uno.
- **Cobertura parcial por diseno.** `business_discovery` solo alcanza cuentas
  profesionales: los Instagram personales del proyecto quedan fuera para
  siempre por esta via.
- **El token pertenece a un activo del candidato patron.** Eso merece una
  decision explicita: hoy «nuestra cuenta propia» en Meta es su Pagina.
- Facebook sigue cerrado, y las tres alternativas de Meta no se han comparado.

---

## 18-sextricies. P-CAND-SOCIAL-COVERAGE-01 (2026-08-30)

Commit `feat(candidate): operationalize Instagram and Facebook coverage`.

**1101 comprobaciones, 26 suites, 0 fallos.** **1 llamada Meta.**

### Lo que paso

El gate iba a pasar Instagram de prueba a operacion sobre los siete candidatos.
No llego a ejecutarse: **el token de Facebook caduco entre gates**.

    Session has expired on Sunday, 30-Aug-26 21:00:00 PDT.
    The current time is Sunday, 30-Aug-26 21:00:56 PDT.

Cincuenta y seis segundos. Los tokens del Graph API Explorer viven alrededor de
una hora, y ese detalle no aparecio en ningun gate anterior porque las pruebas
duraban minutos.

Es un hallazgo de operacion, no de arquitectura: la via funciona y la credencial
con la que se probo no sirve para operar.

### La distincion que se anadio por esto

    CREDENCIAL_RECHAZADA   el token esta mal. Revisar de donde salio.
    CREDENCIAL_EXPIRADA    el token estuvo bien. Duraba poco.

Antes las dos caian en la primera, y la accion que sugiere es «regenera el
token». Regenerar otro corto caduca igual antes de la siguiente ejecucion. Lo
que hace falta es un token de larga duracion, que es otro tramite.

Nuevo `tokenDeLargaDuracion()`, que hace el intercambio de ~1 hora a ~60 dias.
Exige `META_APP_ID` y `META_APP_SECRET`; si faltan, lo dice y no intenta la
llamada.

### Lo que SI quedo construido

**`observarInstagram`**, dentro de `candidateObservation` y bajo el mismo
contrato que `observarX` y `observarYouTube`. Una llamada por activo: Meta
permite anidar la muestra en el propio `fields`, asi que pedir metrica por
metrica gastaria mas sin obtener nada distinto.

El campo que impide el falso positivo:

    alcanceDeLaMedicion:  MEDIDO_TERCERO | MEDIDO_PROPIO_AUTORIZADO

**No sale de la respuesta de Meta.** Sobre una cuenta propia y sobre una ajena
la respuesta es identica —mismos campos, mismo 200— y ahi estuvo el riesgo en
META-THIRD-PARTY-REAL-02. Sale de cruzar el handle con `me/accounts`, y por eso
`cuentasPropias` es un parametro obligatorio en la practica: sin el, la funcion
no puede afirmar que midio un tercero.

**Nuevo estado `NO_SOPORTADO_PERSONAL`.** `business_discovery` solo responde
sobre cuentas Business o Creator. Sobre una personal devuelve error, y leerlo
como `CUENTA_NO_RESUELTA` diria «no encontramos la cuenta» cuando la verdad es
«la cuenta esta ahi y esta via no la abre, ni ahora ni tras ninguna revision».
Una invita a revisar el handle; la otra, a buscar otra fuente.

**Instagram registrado en el puerto de adaptadores.** Es el caso mas extremo de
lo que ese mapa resuelve: una sola funcion cumple las cuatro capacidades.

**`matrizSocialDelProyecto()`**, con siete estados de celda que se niegan a
colapsar en «sin datos»: `SIN_CUENTA`, `NO_SOPORTADO`, `BLOQUEADO`,
`NO_PROBADO`, `PARCIAL`, `MEDIDO` y `MEDIDO_PROPIO`. Dos reglas fijadas por
test: dos de tres activos medidos es PARCIAL y no MEDIDO, y `MEDIDO_PROPIO` no
cuenta como cobertura del candidato.

**`evidenceId` derivado del permalink.** Estable entre ejecuciones, que es lo
que impide duplicar la misma publicacion al volver a observar. Un id aleatorio
serviria para deduplicar dentro de una ejecucion y para nada entre dos.

### Facebook: la respuesta concreta

El error de Meta nombraba tres alternativas. Consultada la documentacion
oficial, **solo una es real**:

| Alternativa | Estado |
|---|---|
| `pages_read_engagement` | no aplica: es un permiso sobre Paginas donde tenemos rol |
| Page Public Metadata Access | **sustituida por PPCA**, y no se puede pedir si el envio incluye PPCA |
| **Page Public Content Access** | la via |

PPCA exige **App Review** y **Business Verification**, las dos verbatim en su
documentacion. En modo desarrollo solo alcanza Paginas cuyo administrador tenga
rol en nuestra app — que es exactamente lo medido: la Pagina que administramos
dio 200 y la de otro candidato dio 400.

**No hay ningun cambio de configuracion que abra Paginas de terceros sin
revision.**

Y un dato que cambia la prioridad: PPCA habilita `/page-post/comments`, o sea
**texto de comentarios publicos**. Instagram no lo entrega —medido, HTTP 400
code 100—, asi que **PPCA no es «tambien Facebook»: es la condicion para que
Comments Intelligence tenga fuente**.

Preparado `docs/META-FB-PUBLIC-ACCESS-REQUEST.md`. No se envio nada.

### Matriz social real del proyecto

    CANDIDATO                 X         YOUTUBE   INSTAGRAM FACEBOOK  TIKTOK
    Paul Carrasco             NO_PROB   MEDIDO    NO_PROB   NO_PROB   NO_PROB
    J. C. Lloret              MEDIDO    MEDIDO    NO_PROB   NO_PROB   NO_PROB
    Pedro Palacios            MEDIDO    SIN_CTA   NO_PROB   NO_PROB   NO_PROB
    Juan Carlos Vega          MEDIDO    SIN_CTA   NO_PROB   SIN_CTA   NO_PROB
    Yaku Perez                MEDIDO    MEDIDO    NO_PROB   NO_PROB   NO_PROB
    Marcelo Cabrera           MEDIDO    SIN_CTA   NO_PROB   NO_PROB   NO_PROB
    Leonardo Morales          MEDIDO    SIN_CTA   NO_PROB   NO_PROB   NO_PROB

Instagram queda `NO_PROBADO` en los siete, con 12 activos declarados y cero
observados. Es el estado honesto: la capacidad existe, la credencial caduco y
no se rellena nada.

### Riesgos

- **Instagram multicandidato sigue sin ejecutarse.** El gate entrega el motor,
  no los datos.
- Solo 3 de los 12 activos de Instagram estan declarados profesionales. Los
  personales no los alcanza `business_discovery` por diseno, asi que la
  cobertura maxima esperable por esta via es parcial y conviene saberlo antes de
  ejecutar.
- El token de Meta administra la Pagina de un candidato del proyecto. Sigue
  siendo una decision pendiente y ahora tambien afecta a que se declara a Meta
  en el envio de PPCA.

---

## 18-septricies. P-CAND-IG-MULTICANDIDATO-01 (2026-08-31)

**1101 comprobaciones, 26 suites, 0 fallos.** **4 llamadas Meta.**
Cero llamadas a X, YouTube, TikTok y buscadores.

### Antes del gate: el PASO 5 quedo validado

El intercambio a token de larga duracion **ya estaba hecho** cuando empezo esta
sesion, y no habia constancia de ello en ningun sitio: ni commit, ni log, ni
entrada en este documento. Se determino con `debug_token`, que es la unica
fuente que lo puede decir.

    emitido      2026-08-31T05:06:31Z
    caduca       2026-10-30  (~60 dias)
    acceso datos 2026-11-29  (~90 dias)
    permisos     pages_show_list, instagram_basic,
                 instagram_manage_insights, pages_read_engagement,
                 public_profile

No se regenero. `GET /me` devolvio 200 con el helper que ya existia. El contrato
sigue siendo `FACEBOOK_USER_ACCESS_TOKEN`: no se creo variable nueva.

**La leccion de operacion:** un token de 60 dias que nadie apunta es un token
que el proximo gate va a volver a generar. La caducidad vive en Meta, no en el
repositorio, y por eso queda escrita aqui.

### La ejecucion

Doce activos de Instagram, siete candidatos. Tres elegibles, y **solo esos tres
gastaron llamada**.

Los nueve declarados `INSTAGRAM_PERSONAL` no se consultaron. La razon no es
ahorro: `elegibilidadMeta` ya dice que ninguna via oficial abre una cuenta
personal, asi que la llamada solo habria confirmado lo que el contrato afirma.
Quedan `NO_SOPORTADO_PERSONAL` con procedencia **DECLARADA**, que no es lo mismo
que MEDIDA, y se reporta con esa etiqueta puesta.

    @jotalloretv      OBSERVADA  MEDIDO_PROPIO_AUTORIZADO   10.822 seguidores
    @pedropalaciosu   OBSERVADA  MEDIDO_TERCERO              9.718 seguidores
    @yakuperezg       OBSERVADA  MEDIDO_TERCERO             83.233 seguidores

**Primera medicion multicandidato de terceros en Instagram.** Dos candidatos
que no administramos, quince publicaciones con permalink, timestamp y metricas.

Y la distincion volvio a ganarse el sitio: `@jotalloretv` salio
`MEDIDO_PROPIO_AUTORIZADO` porque aparece en `me/accounts`. La respuesta de Meta
es identica a la de un tercero —mismos campos, mismo 200— y sin esa
comprobacion previa el gate habria contado tres terceros donde hay dos.

### AUSENTE != 0, medido otra vez

    likes      12 DISPONIBLE   3 NO_DISPONIBLE
    comments   15 DISPONIBLE   0 NO_DISPONIBLE

Tres publicaciones de `@jotalloretv` no traen `like_count`. Quedan
`NO_DISPONIBLE`, no en cero: un cero es una medicion y la ausencia no lo es.

`comments_count` **si se mide**, y en `@pedropalaciosu` hay dos ceros que son
ceros de verdad. `comments_text` sigue `NO_SOPORTADO` por esta via —400 code 100
medido en el gate anterior—, asi que Comments Intelligence continua sin fuente
hasta PPCA.

`reach`, `impressions`, `saved` y `shares` no se pidieron: son OWNER_INSIGHT y
no existirian para el Instagram de un candidato ajeno.

### Dedup verificado sin gastar Meta

Reescrito el mismo lote: los lotes suben de 3 a 4 y las publicaciones se quedan
en 5, con `publicationId` y `evidenceId` unicos. Volver a llamar a Meta para
comprobarlo habria gastado tres llamadas para observar lo mismo.

### Matriz social real del proyecto

    CANDIDATO                 X         YOUTUBE   INSTAGRAM       FACEBOOK  TIKTOK
    Paul Carrasco             NO_PROB   MEDIDO    NO_SOPORTADO    NO_PROB   NO_PROB
    J. C. Lloret              MEDIDO    MEDIDO    MEDIDO_PROPIO   NO_PROB   NO_PROB
    Pedro Palacios            MEDIDO    SIN_CTA   MEDIDO (1/1)    NO_PROB   NO_PROB
    Juan Carlos Vega          MEDIDO    SIN_CTA   NO_SOPORTADO    SIN_CTA   NO_PROB
    Yaku Perez                MEDIDO    MEDIDO    PARCIAL (1/2)   NO_PROB   NO_PROB
    Marcelo Cabrera           MEDIDO    SIN_CTA   NO_SOPORTADO    NO_PROB   NO_PROB
    Leonardo Morales          MEDIDO    SIN_CTA   NO_SOPORTADO    NO_PROB   NO_PROB

Instagram deja de ser `NO_PROBADO` en los siete: 1 MEDIDO, 1 PARCIAL,
1 MEDIDO_PROPIO y 4 NO_SOPORTADO. Las dos reglas del gate anterior se cumplieron
sobre datos reales: Yaku queda **PARCIAL** con uno de dos activos medidos, y
Lloret **MEDIDO_PROPIO**, que no cuenta como cobertura.

X y YouTube se reconstruyeron de lo ya persistido en el Lake. No se volvio a
preguntar a nadie.

### habilitaBenchmark.instagram

**TRUE, y ya lo era.** Paso a true en META-THIRD-PARTY-REAL-02 y esta fijado por
test. Este gate **no lo cambio**: lo respaldo. Lo que antes sostenia un tercero
genuino ahora lo sostienen dos, en un proyecto real y con la matriz distinguiendo
cual de los tres activos medidos era nuestro.

La regla sigue siendo una funcion y no una costumbre: solo `MEDIDO_TERCERO`
habilita. Si lo unico medido hubiera sido `@jotalloretv`, seguiria en false.

### Riesgos

- **La cobertura de Instagram es estructuralmente parcial.** 9 de 12 activos son
  personales y ninguna revision de Meta los abre. El techo por esta via son 3 de
  12, y hoy se alcanzo entero.
- **Un solo candidato tiene cobertura de tercero completa en Instagram.** Pedro
  Palacios. Yaku queda parcial y Lloret no cuenta.
- El token sigue administrando la Pagina de un candidato del proyecto. La
  decision sigue pendiente y ahora hay una medicion que lo evidencia en el dato.
- La ruta HTTP `POST /:proyectoId/candidatos/:candidatoId/observar` **no puede
  disparar Instagram todavia**: no pasa `idParaBusinessDiscovery` ni
  `cuentasPropias` a `observarCandidato`, asi que por ahi `observarInstagram`
  devuelve `NO_EJECUTABLE`. El motor funciona —este gate lo ejecuto por los
  servicios— y lo que falta es cablear dos parametros. No se toco en este gate.

---

## 18-octricies. P-CAND-IG-ROUTE-01 (2026-08-31)

**1131 comprobaciones, 27 suites, 0 fallos.** **2 llamadas Meta.**
Cero llamadas a X, YouTube, TikTok y buscadores.

Gate corto y de una sola cosa: hacer utilizable por la ruta normal el motor
que el gate anterior dejo funcionando.

### El problema, en una linea

`POST /:proyectoId/candidatos/:candidatoId/observar` no pasaba
`idParaBusinessDiscovery` ni `cuentasPropias` a `observarCandidato`, asi que
`observarInstagram` devolvia `NO_EJECUTABLE` por HTTP mientras el mismo motor
medía sin problema desde un script.

### Causa raiz, que es mas interesante que el sintoma

Los dos parametros no estan en el expediente del candidato: **se derivan del
token**. Nadie los cableo porque el gate que construyo `observarInstagram` los
resolvio a mano en su propio script, y ahi funcionaban.

Y **1101 pruebas en verde no lo vieron**, porque todas las suites de servicio
pasaban esos parametros a mano tambien. Probaban el motor; el cableado no
tenia prueba. Un fallo que solo existe en la costura entre dos piezas no lo ve
ninguna prueba que construya las piezas por separado.

### La correccion

**Nuevo `metaObservationContext.js`.** Resuelve el contexto y declara sus
estados: `RESUELTO`, `NO_REQUERIDO`, `SIN_CREDENCIAL`,
`SIN_VINCULO_INSTAGRAM`, `ERROR`.

Vive en el **backend** y no es un detalle de organizacion: los dos datos se
derivan del token, asi que resolverlos en el cliente exigiria mandarle la
credencial de Meta al navegador. El cliente pide «observa a este candidato»;
que Paginas administramos no es asunto suyo.

Una llamada, y **solo si la ejecucion incluye Instagram**. Pedir
`me/accounts` para observar YouTube seria gastar por nada, y hay test que lo
fija.

**Un activo personal declarado ya no gasta llamada.** La guarda vive en
`observarInstagram` y no en la ruta, para que la regla alcance a todos los que
llamen y no solo a este camino. Va *antes* del control de
`idParaBusinessDiscovery` a proposito: que una cuenta sea personal no depende
de nuestra configuracion, y decir `NO_EJECUTABLE` mandaria a revisar nuestras
Paginas cuando no hay nada que revisar.

**`procedenciaDelEstado`, nuevo campo.** El mismo `NO_SOPORTADO_PERSONAL`
puede venir de una declaracion del analista o de un error de Meta, y no valen
lo mismo:

    DECLARADA   lo dijo el analista. No se pregunto.
    MEDIDA      lo dijo Meta.

**La respuesta HTTP ya distingue tercero de propio.** Antes devolvia
`estado: OBSERVADA` para las dos, asi que en pantalla medir a un candidato y
medir nuestra propia cuenta se veian igual. Ahora viajan
`alcanceDeLaMedicion`, `notaAlcance`, `procedenciaDelEstado` y `assetType`.

**Defecto encontrado de paso:** el lote de publicaciones se guardaba con
`provider: "youtube_data"` fijo, asi que un lote de Instagram quedaba
etiquetado como si viniera de YouTube. Ahora el proveedor del lote se deriva
de lo observado.

### Lo que NO viaja al cliente

Ni el token, ni el App Secret, ni el id de nuestra cuenta de Instagram, ni los
handles propios. La respuesta lleva `cuentasPropiasDetectadas` —un numero— y
el estado. Dos tests lo fijan.

### Prueba de ruta: 30 comprobaciones nuevas

`tests/igRoute.test.mjs` **monta el router de verdad** y le habla por HTTP en
un puerto efimero. Lo unico simulado es `graph.facebook.com`, con la forma
real de las respuestas medidas en gates anteriores.

Es la prueba que faltaba: la que recorre la costura.

    HTTP -> observarCandidato -> observarInstagram -> adapter -> Lake

Fija las tres distinciones sobre la misma carga simulada —identica para las
dos cuentas, para que el alcance no pueda salir de la respuesta—, que multi-
asset sigue en pie con dos activos del mismo candidato sin colapsarse, que la
cuenta personal recibe **cero** llamadas, y que observar dos veces no duplica.

### Prueba real, 2 llamadas

Por la ruta HTTP normal, contra el proyecto piloto:

    POST /api/proyectos/alcaldia-cuenca-2027-piloto
         /candidatos/pedro-palacios-ullauri/observar
         {"plataformas":["instagram"],"maximo":5}

    HTTP 200
    instagram:pedropalaciosu   OBSERVADA   MEDIDO_TERCERO
    followers 9.718   media_count 1.635   5 publicaciones
    contextoMeta RESUELTO      persistido true

Idempotencia comprobada **entre gates**, que es la comprobacion que vale:

    firstObservedAt  2026-08-31T15:53:08.897Z   (del gate anterior, intacto)
    lastObservedAt   2026-08-31T17:06:16.410Z   (esta ejecucion)
    publicaciones    5, sin duplicar
    lotes            4, la serie acumula
    snapshots        4 por publicacion

Las cinco publicaciones conservan su `publicationId` y su `evidenceId`. Lo que
avanza es `lastObservedAt` y lo que crece es la serie de metricas.

### Deuda declarada: el puerto pide la credencial equivocada

`business_discovery` viaja con el token de **Facebook Login**, pero el puerto
de adaptadores pregunta por `estaConfigurado()`, que sigue significando «hay
token de **Instagram** Login». Sin el, el adaptador entero queda
`SIN_CREDENCIAL` y la via no se intenta.

Se descubrio porque la prueba de ruta fallo con solo el token de Facebook
puesto.

**No se ha corregido**, y a proposito: esa semantica se fijo deliberadamente
en META-FB-LOGIN-SETUP-01 por compatibilidad, y cambiarla es una decision
sobre familias de credenciales, no parte de este cableado. Hoy no muerde
porque el `.env` real tiene las dos.

**Muerde el dia que alguien despliegue con solo el token que esta via
necesita** y reciba un `NO_EJECUTABLE` que habla de la credencial equivocada.
Queda escrito en el test que lo encontro.

### Estado de la interfaz: NO EXPUESTA

El backend esta operativo y **el frontend no llama a `/observar`**.
Comprobado: los unicos endpoints de candidato que usa la interfaz son `foto`,
`identidad`, `inteligencia` y `tipos-activo`.

El boton «Observar cuentas» existe, en
`apps/web/src/components/ProjectsModule.jsx` → `observarCuentas()`, y llama a
`/inteligencia`, que es el camino de Account Intelligence y otro motor. No
llega a este.

No se toco: cambiar a donde apunta ese boton alteraria una funcion distinta y
es alcance de un gate de UX.

    BACKEND ROUTE   FUNCIONAL
    UI REAL         NO EXPUESTA

### Riesgos

- **La capacidad no es alcanzable por el analista todavia.** Existe y esta
  probada de punta a punta; falta un disparador en la interfaz.
- La deuda de la credencial del puerto sigue abierta y hoy es invisible.
- La cobertura maxima de Instagram sigue siendo 3 de 12 activos por razones
  estructurales, no de cableado.

---

## 18-nonricies. P-CAND-TIKTOK-01 (2026-08-31)

**1165 comprobaciones, 28 suites, 0 fallos.** **8 peticiones HTTP a TikTok.**
**Coste 0 USD.** Cero llamadas a X, Meta, YouTube y buscadores.

Gate de factibilidad: que puede medir Sentinel HOY en TikTok, con evidencia y
sin contratar a nadie.

### Inventario

Siete activos TikTok persistidos, **uno por candidato**, ninguno SIN_CUENTA y
**cero publicaciones** persistidas antes de este gate.

    Paul Carrasco       @lafondadecarrasco   REVALIDADA    corresp  0
    J. C. Lloret        @jotalloretv         REVALIDADA    corresp 20
    Pedro Palacios      @pedropalaciosu      DECLARADA     corresp 20
    Juan Carlos Vega    @jcvega76            DECLARADA     corresp 15
    Yaku Perez          @yaku.perez          REVALIDADA    corresp 40
    Marcelo Cabrera     @hmarcelocabrera     DECLARADA     corresp 25  SerpAPI
    Leonardo Morales    @leomoralesordo      DECLARADA     corresp  0

Dos con **correspondencia 0** —`@lafondadecarrasco` y `@leomoralesordo`— que no
se tocan en este gate y conviene mirar: un handle atribuido con correspondencia
cero es una atribucion sin sostener, y «La Fonda de Carrasco» no suena a cuenta
personal de un candidato.

### Vias oficiales: ninguna aplica, y ya estaba estudiado

No se repitio la investigacion. `socialCapabilityMatrix` ya documentaba las
tres, y sigue siendo cierto:

| API | Por que no |
|---|---|
| Display API | opera sobre la cuenta que INICIA SESION. El candidato tendria que darnos acceso a la suya |
| Research API | si cubre terceros, y su elegibilidad es academica sin animo de lucro. Sentinel es un producto comercial |
| Commercial Content API | solo contenido publicitario. Ninguna metrica organica |

Es la unica plataforma del grupo donde el problema **no es un permiso que pedir
ni un plan que pagar**: el caso de uso no encaja en ningun programa.

### Via publica: `oembed`, y SI entrega algo

Endpoint publico y documentado de TikTok, sin credencial y sin coste. Sobre la
URL de un **perfil** devuelve HTTP 200 con:

    author_name        el nombre visible REAL
    author_url         la URL canonica
    embed_product_id   el handle
    embed_type         "profile"

Y **nada mas**. Ni un seguidor.

**El control que lo hace utilizable.** Un endpoint que responde 200 a cualquier
cosa no prueba existencia. Se probo con dos handles inventados:

    @sentinel_control_no_existe_0987654321   HTTP 400
    @zzzz_handle_inexistente_qwerty_31082026 HTTP 400

Asi que un 200 aqui **si es evidencia de que la cuenta existe**. Sin ese control
esto no se podria usar como senal, y la leccion viene de
META-COVERAGE-AUDIT-01, donde un clasificador dio «perfil» con confianza media
para Meta, BBC y NASA.

**Y el nombre visible no es un eco del handle**, que es lo que lo convierte en
senal de identidad y no en un espejo:

    @jotalloretv  ->  "Jota Lloret Valdivieso"
    @yaku.perez   ->  "Yaku"

### El HTML publico: 200 vacio, y ahi se para

Tambien se midio. HTTP 200, **1.462 bytes**, sin Open Graph, sin
`followerCount`, sin ninguna cifra. No es un bloqueo y no es un captcha: TikTok
no sirve datos a un cliente que no ejecuta JavaScript.

Sacar cifras de ahi exigiria ejecutar su JavaScript o firmar sus peticiones, y
eso es **raspado evasivo**. No se hace, y no solo por lo legal: un dato asi no
se puede citar en un informe, no se puede auditar y desaparece en cuanto la
plataforma cambia algo.

### Prueba real: 2 activos, 2 llamadas

Los dos de mejor identidad resuelta segun el expediente y de candidatos
distintos. Se verifico contra el inventario en lugar de reutilizar
`@jotalloretv` por costumbre:

    @yaku.perez    CUENTA_CONFIRMADA  200  displayName "Yaku"
    @jotalloretv   CUENTA_CONFIRMADA  200  displayName "Jota Lloret Valdivieso"

Persistido con el contrato social existente —`crearSnapshot` y
`guardarSnapshots`, sin ningun modelo TikTok paralelo—, y con
`followers: null`. **No 0.** Un 0 seria una medicion; esto es una ausencia.

### Nuevo `tiktokAdapter.js`

Deliberadamente pequeno: no es un adaptador a medio hacer, es del tamano de la
unica via que existe. Estados propios —`CUENTA_CONFIRMADA`,
`CUENTA_NO_EXISTE`, `RESPUESTA_INESPERADA`, `ERROR_PROVEEDOR`— y la lista de lo
que no entrega **viaja con cada resultado**, no en un comentario.

### Dos defectos encontrados por el camino

**1 · `habilitaBenchmark` era demasiado laxa.** La regla miraba si habia
ALGUNA celda `MEDIDO`. Al marcar `identidad` como medida, TikTok habria entrado
al benchmark multicandidato **sin un seguidor, sin una publicacion y sin una
metrica**.

Ahora exige que lo medido sea una **cifra**: followers, publicaciones, views,
likes, comments o shares. Saber que una cuenta existe es identidad, y la
identidad no se compara. X, YouTube e Instagram no se mueven —las tres tienen
metricas medidas sobre terceros— y TikTok se queda en false con el motivo
explicado en el dato.

**2 · La clave de los snapshots colapsaba el multi-activo.** Era
`candidato + plataforma + instante`, sin el activo. Un candidato con dos cuentas
en la misma plataforma observadas en la misma ejecucion producia **la misma
entidad**, y el Lake devuelve la ultima version: el primer activo seguia escrito
y dejaba de leerse.

Y fallaba en silencio, porque la escritura devuelve `escrito: true`. Es el mismo
defecto que META-THIRD-PARTY-REAL-02 encontro en
`guardarDeclaracionesDeTipo`, en otro sitio. Lo encontro el test de multi-activo
de este gate.

No afecta solo a TikTok: cualquier candidato con dos cuentas de X observadas en
una misma ejecucion estaba perdiendo una de la serie. La lectura es por prefijo
`snapshot-<candidato>-`, asi que **lo ya escrito sigue leyendose y no hay que
migrar nada**.

### Techo real de cobertura

    MEDIDO_PUBLICO     existencia, handle, displayName, URL canonica
    NO_DISPONIBLE      followers, following, likes totales, media_count,
                       publicaciones, views, likes, comments_count, shares,
                       texto de comentarios, historico

El techo no es «poco»: es **identidad sin metricas**. Sirve para confirmar que
una cuenta existe y como se llama —util para sostener una atribucion—, y no
sirve para medir a un candidato ni para compararlo con otro.

### ¿SUFICIENTE PARA CAMPANA? **NO**

Una campana necesita saber si un candidato crece, que publica y que rendimiento
tiene. Por esta via no hay ni una cifra, asi que no se puede responder a nada de
eso.

**Requiere SOCIAL-PROVIDER-EVAL-01**, y con alcance exacto: followers,
publicaciones con permalink y fecha, views, likes, comments_count, shares, texto
de comentarios, acceso historico, limites de rate, estabilidad del contrato y
condiciones de licencia que permitan citar el dato en un informe.

No se contrato ni se integro nada.

### Riesgos

- **Dos atribuciones con correspondencia 0** siguen en el expediente sin
  sostener. `oembed` puede ayudar: confirma existencia y nombre visible por
  cuatro llamadas y cero dolares.
- El techo de TikTok no lo mueve ningun trabajo de ingenieria nuestro. Lo mueve
  una licencia.
- La deuda del puerto de adaptadores de P-CAND-IG-ROUTE-01 sigue abierta.

---

## 18-quadragies. P-CAND-FACEBOOK-01 (2026-08-31)

**1200 comprobaciones, 29 suites, 0 fallos.** **3 llamadas Meta.** **Coste 0 USD.**
Cero llamadas a X, YouTube, TikTok y buscadores.

Gate de cierre. Facebook deja de ser una investigacion abierta.

### Inventario

Once activos Facebook: **10 Pages y 1 Profile**, con un candidato SIN_CUENTA
(Juan Carlos Vega) y **cinco candidatos con dos activos**, asi que el
multi-activo es la norma y no la excepcion.

Solo uno esta **VERIFICADA por META_API**: `@jotalloretv`, que es
precisamente la Pagina que el token administra. Los otros diez son
`ANALYST_DECLARATION` / `NO_VERIFICADA`, y declarar no es verificar.

### La prueba: tres llamadas, dos sujetos

    me/accounts                        200
    /{page-propia}/posts               400 · (#10)
    /{page-tercero}                    400 · (#100)

**Lo que si llega de la Pagina propia:** id, name, username, `fan_count` y
`followers_count` — **55.855** medido. Identidad y seguidores, reales.

**El hallazgo.** Hasta hoy se creia que sobre la Pagina propia funcionaba todo,
porque META-THIRD-PARTY-REAL-02 la habia leido con 200. Lo que funcionaba era la
**metadata**. Las publicaciones no:

    GET /{page-id}/posts   HTTP 400 · (#10)
    "requires the 'pages_read_user_content' permission
     or the 'Page Public Content Access' feature"

Ningun gate anterior habia pedido `/posts`. El token tiene
`pages_read_engagement` y **no** `pages_read_user_content`.

### Los dos 400 no se arreglan igual

Es la distincion que cierra el gate:

| | sobre lo PROPIO | sobre un TERCERO |
|---|---|---|
| codigo | `(#10)` | `(#100)` |
| falta | un **permiso del token** | una **feature de la app** |
| se arregla | regenerando el token | App Review + Business Verification |
| coste | minutos | semanas, y puede que nunca |

Confundirlos manda a pedir App Review cuando basta un token, o al reves.

Y un matiz que el mensaje de Meta esconde: el error del tercero nombra
`pages_read_engagement` como alternativa, **y el token ya lo tiene**. Ese
permiso solo aplica a Paginas donde tenemos rol. Para terceros, de las tres
alternativas que Meta lista, solo sirve una **feature**.

Esta vez el bloqueo se midio con un token de larga duracion validado y vivo,
asi que queda descartado que la causa fuera la credencial.

### Capacidades: cierre campo por campo

    IDENTIDAD        MEDIDO_PROPIO_AUTORIZADO   id, name, username
    FOLLOWERS        MEDIDO_PROPIO_AUTORIZADO   fan_count y followers_count
    PUBLICACIONES    BLOQUEADO_PERMISO_TOKEN    (#10) sobre lo propio
                     REQUIERE_PPCA              sobre terceros
    REACTIONS        NO_MEDIDO                  cae con /posts
    COMMENTS_COUNT   NO_MEDIDO                  idem
    COMMENT_TEXT     NO_MEDIDO                  idem
    SHARES           NO_MEDIDO                  idem
    VIDEO_VIEWS      NO_DISPONIBLE              OWNER_INSIGHT; no existe para un tercero
    HISTORICO        NO_DISPONIBLE              ninguna via entrega serie temporal

`fan_count` y `followers_count` son **cifras distintas** y Meta las devuelve por
separado. No se funden ni se rellena una con la otra.

Nada de esto es un cero. Un cero seria una medicion.

### Comentarios: la fuente sigue sin cerrarse

La sonda de texto de comentarios viajaba anidada en `/posts`, asi que **cayo con
la misma llamada**. Sigue sin saberse si Facebook entrega texto de comentarios de
una Pagina propia.

Lo que si esta fijado por test es el contrato: cuando el permiso exista, la
funcion devuelve `id`, `created_time`, `message` y `permalink_url` por
comentario, y `textoDeComentarios: DISPONIBLE`.

Para **terceros**, el texto de comentarios sigue dependiendo de PPCA, que es lo
que ya establecio P-CAND-SOCIAL-COVERAGE-01: PPCA no es «tambien Facebook», es
la condicion para que Comments Intelligence tenga fuente.

### Nueva `publicacionesDePaginaPropia`

En el adaptador que ya alberga la familia de `graph.facebook.com`, sin motor
paralelo. Pide el token **de la Pagina** —las publicaciones no se leen con el
del usuario— y ese token no se devuelve, no se registra y no aparece en la
traza. Hay test que lo comprueba.

`pedir()` acepta ahora un token explicito por esa razon: sin el,
`/{page}/posts` devuelve un 190 que habla de permisos cuando lo que pasa es que
se envio la credencial equivocada.

Y una decision de nombres: `reactions.summary` cuenta **todas** las reacciones
—me gusta, me encanta, me enfada—. Se llama `reactions` y no `likes`, porque
llamarlo likes inflaria los likes con enfados. Fijado por test.

### Decision PPCA

**¿Vale la pena? SI, PERO EN PARALELO.**

A favor: es la unica via oficial a Paginas de terceros, Meta lista
explicitamente nuestro caso de uso —analizar publicaciones e interaccion en
Paginas— y es la que abre el texto de comentarios publicos, que es la fuente
de Comments Intelligence.

En contra: exige **App Review y Business Verification**, las dos verbatim en la
documentacion, y su concesion es historicamente restrictiva. El plazo no lo
controlamos.

**Recomendacion: solicitar PPCA en paralelo y NO bloquear la prueba de campana
esperandola.** El expediente `docs/META-FB-PUBLIC-ACCESS-REQUEST.md` ya esta
preparado y no se ha enviado nada.

Y antes que eso, algo que cuesta minutos: **regenerar el token con
`pages_read_user_content`** para desbloquear la Pagina propia. No abre
terceros, pero cierra la pregunta de los comentarios y da un caso completo con
el que validar el contrato entero.

### ¿SUFICIENTE PARA CAMPANA SIN PROVEEDOR? **NO**

Diez de once activos son de candidatos que no administramos, y sobre ellos hoy
no se obtiene ni el nombre de la Pagina.

### Huecos para SOCIAL-PROVIDER-EVAL-01

    FACEBOOK terceros   identidad de Page, fan_count/followers, posts,
                        permalink, fecha, texto, reactions, comments_count,
                        shares, texto de comentarios, video views, historico

    FACEBOOK perfiles   NO los cubre ninguna via oficial, y probablemente
                        tampoco un proveedor con licencia. Declararlo antes
                        de comprar.

    TIKTOK              followers, following, likes, media_count, posts,
                        views, likes, comments_count, shares, texto de
                        comentarios, historico
                        (identidad y URL SI las cubre oembed, gratis)

    INSTAGRAM           cuentas personales —9 de 12 activos— y texto de
                        comentarios. Lo demas ya esta cubierto por
                        business_discovery y NO hace falta comprarlo.

La lista sale de resultados medidos, no de suposiciones: lo que ya funciona no
se compra.

### Ruta normal de Candidate

**NO cubre Facebook.** `observarCandidato` tiene rama para `x`, `instagram` y
`youtube`, y ninguna para `facebook`.

No se cableo a proposito: hoy `/posts` esta bloqueado, asi que anadir la rama
solo produciria un camino nuevo que unicamente sabe devolver un bloqueo. Se
cablea cuando el permiso exista.

### Riesgos

- **Diez de once activos Facebook son de terceros y estan cerrados.** No es un
  problema de ingenieria: es una licencia o una revision.
- El unico activo con acceso es de un candidato del proyecto, y lo administramos
  nosotros. Eso sigue siendo una decision pendiente y ahora tambien afecta a que
  se declara a Meta en el envio de PPCA.
- El texto de comentarios de Facebook sigue **sin medir**, asi que Comments
  Intelligence sigue sin fuente confirmada en ninguna plataforma.
- Un activo con correspondencia 0 —`@paulernestocarrascoc`— sigue declarado
  FACEBOOK_PAGE sin nada que lo sostenga.

---

## 18-unquadragies. SOCIAL-PROVIDER-EVAL-01 (2026-08-31)

**Gate de evaluacion.** **0 USD.** **0 requests pagas.** Dos llamadas
gratuitas a oEmbed de TikTok para la auditoria de atribucion. Sin cambios de
codigo.

Entregable: `docs/SOCIAL-PROVIDER-EVAL-01.md`.

### La pregunta que cierra

Cuatro gates midieron que dan las APIs oficiales. Lo que falta —Facebook de
terceros, metricas de TikTok, Instagram personal y **texto de comentarios en
las tres**— no lo cierra ningun trabajo de ingenieria nuestro. Lo cierra una
licencia, una revision de Meta, o un proveedor.

### Cuatro proveedores, contra los huecos y no contra su folleto

| Proveedor | FB terceros | TikTok metricas | Comment text | Precio | Veredicto |
|---|---|---|---|---|---|
| **Bright Data** | SI | SI | **SI, 3 plataformas** | $1,50/1K · 5K gratis/mes | **APTO_PARA_PRUEBA** |
| Data365 | SI | SI | SI (solo FB documentado) | **no publico** | REQUIERE_CONTACTO_COMERCIAL |
| Apify | segun Actor | segun Actor | segun Actor | $5 gratis · $19+ | APTO_PARCIAL |
| EnsembleData | **NO** | SI | parcial | $100-$1.400/mes | **NO_APTO** |

EnsembleData es solido en TikTok y **no cubre Facebook**, que es la prioridad
mas alta: comprarlo dejaria abierto el hueco mas caro.

Se registra tambien **Meta Content Library**, la via licenciada por Meta y la
de mejor defensa legal, para que la comparacion sea honesta: existe, y su
elegibilidad es academica sin animo de lucro. **No nos admite.**

### Comentarios, que es el criterio de corte

Solo **Bright Data** documenta `comment_text` en las tres plataformas.
Data365 lo documenta con certeza en Facebook. **Ninguno documenta historico de
comentarios**, asi que ese hueco queda abierto para todos y lo tendra que
cubrir el Lake acumulando snapshots.

Un proveedor que solo entrega el conteo no es una solucion de Comments
Intelligence, y no debe presentarse como tal.

### Recomendacion

**Bright Data para la prueba.** Unico que cubre los tres huecos a la vez y
unico con texto de comentarios documentado en las tres plataformas. Precio
publico, acepta URLs de Page de tercero, ventana historica por fechas en
Facebook, y **5.000 registros al mes sin tarjeta**: la prueba real cabe entera
en la cuota gratuita.

Coste estimado del piloto —**estimacion, no medicion**— con 7 candidatos, tres
plataformas y ronda semanal: **~$39/mes**. El comentario es lo que manda el
coste: un post viral con 2.000 comentarios multiplica la cifra, asi que
conviene empezar con tope por publicacion.

### Lo legal, sin suavizar

**Bright Data, Data365 y Apify raspan la web publica. Ninguno es proveedor
licenciado por Meta o TikTok.** Va contra los ToS de las plataformas aunque el
dato sea publico, y la continuidad no esta garantizada: un cambio de
plataforma puede dejar un endpoint seco en mitad de campana.

Lo que si se conserva es la citabilidad, que es lo que salva el caso de uso:
los permalinks son canonicos y cualquiera puede abrir la publicacion y
comprobarla.

**No es una decision tecnica. Es de negocio y de riesgo, y le corresponde al
responsable del proyecto, no a este gate.**

### Arquitectura: hibrida, no proveedor unico

    X, YouTube, Instagram profesional   API oficial       ya operativo
    Facebook propio                     Meta Graph        metadata
    TikTok identidad                    oEmbed publico    ya operativo, gratis
    Facebook terceros, TikTok metricas  PROVEEDOR         los huecos
    Instagram personal y comentarios    PROVEEDOR         solo donde aporte
    Historico                           Knowledge Lake    propio

Lo que ya funciona por via oficial es mas barato, mas estable y mas
defendible: sustituirlo por un proveedor anadiria coste y riesgo legal a
cambio de nada.

El proveedor entra como **detalle de un adapter**, igual que hoy lo es Meta:
`platformAdapterPort` y el contrato de observacion ya existen. Nada de
`ProviderFacebookEngine`. Cambiar de proveedor debe ser cambiar un adapter, no
reescribir Candidate Intelligence.

Y el historico no se compra: ninguna plataforma ni proveedor entrega serie
temporal propia. El Lake ya la acumula.

### Auditoria de atribucion TikTok, resuelta dentro del gate

Dos llamadas gratuitas sobre los activos de correspondencia 0:

    @lafondadecarrasco   200   "La Fonda de Carrasco"   COMPATIBLE_NO_CONFIRMADA
    @leomoralesordo      200   "Leo Morales"            COMPATIBLE_NO_CONFIRMADA

Las dos existen y **ninguna queda confirmada**: existir no es pertenecer.

`@lafondadecarrasco` comparte un solo token con el candidato y su nombre
visible describe **un negocio de hosteleria**, no a una persona. Medirlo como
cuenta del candidato le atribuiria actividad que no es suya. `@leomoralesordo`
—«Leo Morales»— es compatible con Leonardo Morales y sigue sin ser prueba.

No se degrada ni se borra ninguna: la decision sobre un activo declarado por
el analista es del analista.

### PPCA en paralelo: SI

Sigue siendo recomendable y **no bloquea el MVP**. Hecho nuevo comprobado a
mano fuera de este gate: el caso de uso «Administrar todos los aspectos de tu
pagina» se agrego correctamente a la app, y aun asi
**`pages_read_user_content` NO aparece como permiso seleccionable** en el
Graph API Explorer. **No se regenero token a ciegas.**

Eso no resuelve Facebook de terceros y no se gasto mas tiempo en Meta aqui.

### Huecos que seguirian abiertos incluso con proveedor

- **Perfiles personales de Facebook.** Ninguna via oficial y ninguna evidencia
  de cobertura legitima de proveedor. NO_SOPORTADO.
- **Insights de propietario** —reach, impressions, saved—. No existen para una
  cuenta ajena por ninguna via. No se compran porque no existen.
- **Historico de comentarios.** Ningun proveedor lo documenta.
- **Historico anterior a la primera observacion.** NO VERIFICADO si los
  datasets pre-recolectados lo cubren.

### Riesgos

- **Estado maximo alcanzado: PROVEEDOR_CANDIDATO.** Que la documentacion diga
  que cubre Facebook no declara Facebook resuelto. Solo una prueba contra
  nuestros candidatos permite `MEDIDO_PROVEEDOR`, y este gate no la hizo.
- Toda la comparativa se apoya en documentacion del proveedor, que es
  exactamente el tipo de afirmacion que este proyecto no acepta como evidencia
  hasta medirla.
- La decision de raspar por proveedor esta pendiente de una persona.

---

## 18-duoquadragies. SOCIAL-PROVIDER-REAL-01-PREP (2026-08-31)

**1248 comprobaciones, 30 suites, 0 fallos.** **0 requests externos.** **0 USD.**

Estado: **PREPARADO · ESPERANDO_APROBACION_PROVEEDOR.**

Bright Data sigue en revision. Se aprovecho la espera para dejar el limite
construido y probado, de modo que el dia que aprueben la cuenta lo unico que
falte sea el cliente HTTP.

### Lo que faltaba de verdad

Al auditar los contratos existentes antes de escribir nada aparecio que la
publicacion y la metrica **ya estaban resueltas** desde P-CAND-03:
`crearPublicacionObservada` ya cubre postId, permalink, publishedAt, texto,
metricas, procedencia, evidenceId y las tres fechas. No habia que crear nada.

Lo que no existia era **el contrato de comentario**. Y no existia por una
razon: hasta hoy ninguna via entregaba texto —Instagram lo niega con 400 code
100, Facebook cayo con /posts y TikTok no tiene via publica—. Se escribe ahora,
**antes de tener el dato**, para que el dia que llegue no se invente una forma
nueva bajo la presion de que ya hay payloads esperando.

### Nuevo `commentObservation.js`

`commentId` estable, relacion con el post, `parentCommentId` para respuestas,
texto, y las tres fechas con la misma regla que las publicaciones:
`firstObservedAt` no se reescribe nunca.

Dos decisiones que van en el contrato y no en un comentario:

**El autor se guarda sin perfilado.** Nombre visible e id de plataforma, que es
lo minimo para deduplicar y contar participantes unicos. No se cruza con
identidad real, no se enriquece y no se puntua. El propio objeto lleva la lista
`noSeHace`.

**El corpus separa siempre dos cifras:** los comentarios que la plataforma
DECLARA y los que se OBSERVARON. Con 3 de 12 la cobertura es `MUESTRA` y no
`COMPLETA`, y la frase viaja con el dato:

    COMENTARIOS OBSERVADOS != TODOS LOS COMENTARIOS

Ademas se separan tres estados que se confunden con facilidad: `OBSERVADO`
—llego texto—, `SOLO_RECUENTO` —llego el numero y no el texto— y
`SIN_COMENTARIOS` —cero declarado, que es un cero MEDIDO y no una ausencia—.

### Nuevo `externalSocialProvider.js` — el limite, no el motor

    El nombre del proveedor NO puede aparecer en el dominio.

No hay ni un `if (provider === "brightdata")`. Hay un registro de proveedores y
un normalizador que traduce cualquier payload al contrato que ya existe. El
mapa de campos se pasa desde fuera, y eso es justo lo que impide que el
proveedor entre en Candidate Intelligence.

Probado con dos payloads de forma distinta: Facebook con campos planos y TikTok
con `stats.play_count` anidado. **El mismo normalizador produce el mismo
contrato**, y hay test que recorre el objeto entero comprobando que el nombre
del proveedor solo aparece en campos de procedencia —`provider`,
`providerId`, `observationMethod`— y nunca en la identidad, el contenido o el
valor de una metrica.

Nada de `BrightDataFacebookEngine`. Un proveedor es una FUENTE, no un modelo.

### El estado que impide la mentira mas facil

    UNVERIFIED_PROVIDER

Todo lo que un proveedor declara entra asi. Las tres plataformas de Bright Data
—27 capacidades— estan en `UNVERIFIED_PROVIDER`, y `estadoDeProveedores()`
devuelve `ningunoVerificado: true`.

Que su documentacion diga que cubre Facebook **no es cobertura**. Solo una
prueba real contra una cuenta de nuestros candidatos mueve una celda, y se
movera **una a una**, no en bloque.

EnsembleData queda inscrito con Facebook en `UNSUPPORTED` para que su hueco
este en el dato y no solo en un documento.

### La bandera no aprueba a nadie

`SOCIAL_EXTERNAL_PROVIDER_ENABLED` esta documentada en `.env.example` y
apagada. **No se toco `.env`.**

Y encenderla no basta: `proveedorHabilitado()` exige bandera, credencial **y**
que el proveedor este marcado como aprobado en el registro. Hay test que
enciende la bandera, pone una clave ficticia y comprueba que Bright Data
**sigue deshabilitado** porque esta `EN_REVISION`.

Aprobar un proveedor es un cambio de codigo y no de configuracion, a proposito:
asi queda en el historial de git y no en la maquina de alguien.

### Fixtures sinteticos

Tres, marcados `TEST_FIXTURE` y `NO_REAL_DATA`, con valores inventados y sin
nombres de candidatos. Uno de los comentarios viene **sin texto a proposito**,
para fijar que una ausencia no se convierte en cadena vacia ni en cero.

### 48 comprobaciones nuevas

Cubren lo que puede romperse en silencio: proveedor sin verificar no cuenta,
ausencia distinta de cero, un 0 real se conserva como 0, IDs estables entre
ejecuciones, `firstObservedAt` inmutable y `lastObservedAt` avanzando, texto de
comentario preservado, texto anterior conservado si cambia, multi-activo sin
colapsar, aislamiento entre proyectos, proveedor desconocido rechazado y
ninguna credencial en los contratos ni en la procedencia.

### Riesgos

- **Nada de esto es cobertura.** Es un limite construido y probado contra
  fixtures. La cobertura real la decide `SOCIAL-PROVIDER-REAL-01`.
- Falta **una sola pieza**: el cliente HTTP del proveedor. Todo lo que viene
  despues ya esta probado.
- La decision de usar un proveedor que raspa sigue pendiente de una persona.
  Documentada en `docs/SOCIAL-PROVIDER-EVAL-01.md` §6.

---

## 18-triquadragies. SOCIAL-PROVIDER-ALTERNATIVE-01 (2026-08-31)

**1272 comprobaciones, 31 suites, 0 fallos.** **0 requests a proveedores.**
**0 USD.**

### Bright Data deja de ser camino critico

    estadoComercial: BLOQUEADO_POR_PROVEEDOR
    aprobadoParaOperar: false
    requests: 0 · coste: 0 USD

La cuenta sigue suspendida pese a haberse enviado la verificacion. No se hizo
ni una peticion, no se pago, no se anadio tarjeta y no se volvio a verificar.

**No es un fallo de Sentinel**, ni del adapter, ni de la URL de Pedro Palacios,
ni de Facebook, ni de TikTok: nunca se llego a hacer una llamada. El bloqueo es
del proveedor y queda registrado como tal **en el codigo**, no solo en un
documento.

### El criterio que ordeno la busqueda

Con una campana con fecha encima la pregunta dejo de ser «quien tiene mejor
cobertura» y paso a ser **«a quien puedo probar hoy»**. Eso parte a los
proveedores en dos, y el corte decide mas que cualquier tabla de features:
alta autoservicio frente a llamada comercial previa.

### Tres evaluados

| | Facebook | TikTok | comment_text | Trial | Tarjeta | Hoy | Veredicto |
|---|---|---|---|---|---|---|---|
| **ScrapeCreators** | SI | SI | **SI** | 100 creditos | no | **SI** | **APTO_PARA_PRUEBA** |
| SocialCrawl | SI | SI | SI | 100 creditos | no | SI | APTO_PARA_PRUEBA |
| Data365 | SI | SI | SI | 14 dias | no | **NO** | REQUIERE_LLAMADA_COMERCIAL |

**ScrapeCreators queda #1** porque cubre los cuatro huecos con endpoints
verificados uno a uno en su documentacion publica —Facebook profile, posts,
comments y comment replies; TikTok profile, videos, comments y replies—, con
documentacion abierta y OpenAPI, sin necesidad de hablar con nadie.

Data365 no es peor: es que **no se puede probar hoy**, porque su documentacion
de creditos llega despues de una llamada introductoria.

**Nada de esto es cobertura.** Los tres siguen en `UNVERIFIED_PROVIDER` y
`estadoDeProveedores()` sigue devolviendo `ningunoVerificado: true`. Ninguno
documenta historico de comentarios: ese hueco queda abierto para todos y lo
tendra que cubrir el Lake.

### La prueba real NO se ejecuto, y por que

Los tres exigen crear cuenta: **ningun endpoint funciona sin API key**.
Sentinel no crea cuentas externas en nombre del usuario, asi que el gate se
detiene ahi y entrega instrucciones en lugar de resultados.

Los activos que se usarian estan **leidos del Lake, no inventados**:
`facebook:pedropalaciosu` y `tiktok:yaku.perez`. No se usa
`@lafondadecarrasco`, cuya atribucion quedo `COMPATIBLE_NO_CONFIRMADA`:
probar con ella mezclaria dos preguntas distintas —si el proveedor sirve y si
la cuenta es del candidato—.

### Lo que si se construyo: la pieza que faltaba

Nuevo **`socialProviderClient.js`**. El PREP habia dejado todo menos el cliente
HTTP; ahora existe, y es **generico a proposito**: Bright Data cayo, y un
cliente escrito para Bright Data habria que tirarlo hoy. Lee del registro la
base, la cabecera y los endpoints, asi que cambiar de proveedor es cambiar una
entrada de datos.

Cuatro cosas fijadas por test:

**La guarda va antes de la red.** Un cliente que sale a la red y luego
comprueba si podia ya gasto el credito. Hoy los cuatro proveedores devuelven
`llamadas: 0` aunque se les pase la bandera encendida y una clave.

**No se inventan URLs.** Endpoint no declarado, `ENDPOINT_NO_DECLARADO` y cero
credito.

**La clave nunca sale.** Va en cabecera —jamas en la URL— y se redacta del
resultado, la traza y el error, incluido el caso feo en que el proveedor hace
eco de la clave en su propio mensaje, que es justo el texto que alguien copia y
pega.

**Los bloqueos no se confunden:** 401/403 credencial, 402 facturacion, 429
cuota. Misma leccion que X-REAL-01.

Y lo que el cliente **no** hace, declarado en su diagnostico: rotacion de
proxies, captchas, huellas y logins. Si un proveedor necesitara eso de nuestra
parte, el proveedor no sirve.

Al extraer `armarPeticion` y `clasificarRespuestaHttp` como piezas puras se
resolvio un problema real de diseno: la guarda exige proveedor aprobado, asi
que sin separarlas no se podian probar **sin aprobar a alguien de verdad o sin
abrir un agujero en la guarda**.

**Resultado: ejecutar la prueba ya no depende de escribir codigo. Depende de
que exista una clave.**

### Candidate Intelligence NO espera

Decision explicita: la falta de proveedor no bloquea el avance.

    X, YouTube, Instagram profesional   MEDIDO_OFICIAL      snapshots siguen
    Instagram personal                  NO_SOPORTADO        9 de 12
    Facebook propio                     PARCIAL             solo metadata
    Facebook terceros                   REQUIERE_PROVEEDOR  10 de 11
    TikTok identidad                    MEDIDO_OFICIAL      oEmbed, gratis
    TikTok metricas                     REQUIERE_PROVEEDOR
    Comment text                        NO_PROBADO          ninguna plataforma

Ninguna celda queda ambigua. No hace falta que todo este en verde: hace falta
que todo este **resuelto**, y un `REQUIERE_PROVEEDOR` explicito es un resultado
y no un hueco.

### Riesgos

- Los tres candidatos raspan web publica y ninguno es proveedor licenciado.
  Decision de negocio, documentada y pendiente de una persona.
- **Bright Data acaba de demostrar el riesgo operativo: un proveedor puede
  desaparecer sin aviso.** Por eso el cliente es generico y la arquitectura
  hibrida.
- Ninguna capacidad esta verificada. La primera que se promueva debe hacerlo
  una a una y con la fecha del gate.

---

## 18-quadriquadragies. SOCIAL-PROVIDER-REAL-02 (2026-08-31)

**1311 comprobaciones, 32 suites, 0 fallos.** **8 requests · 8 creditos · 86
restantes · 0 USD.** Bright Data no se toco.

Entregable: `docs/SOCIAL-PROVIDER-REAL-02-SCRAPECREATORS.md`.

### Lo que cierra

Los tres huecos que Candidate Intelligence arrastraba desde P-CAND-FACEBOOK-01
y P-CAND-TIKTOK-01 quedan **medidos con datos reales**, sobre activos del
proyecto piloto, por el adapter generico y persistidos en el Lake:

    Facebook de terceros    MEDIDO_PROVEEDOR
    TikTok con metricas     MEDIDO_PROVEEDOR
    Texto de comentarios    MEDIDO_PROVEEDOR   en las DOS plataformas

**Es la primera vez que Sentinel tiene texto de comentarios de alguna
plataforma.** Instagram lo niega con 400 code 100, Facebook oficial lo bloquea
por permisos y TikTok no tiene via publica. Comments Intelligence pasa de «sin
fuente» a «con fuente».

### Facebook — Pedro Palacios, 3 llamadas

Perfil: id estable `100044226859609`, **57.000 seguidores** y **57.624 likes**,
que son cifras distintas y no se funden. Tres publicaciones con reacciones y
comentarios reales.

**El desglose de reacciones por tipo llega, y no es adorno.** En una
publicacion: `like 173` frente a **`haha 325`**. Mas «haha» que «me gusta», y
un `reactionCount: 508` agregado lo habria escondido entero.

Comentarios: **10 observados de 122 declarados**, 8 con texto, cobertura
`MUESTRA`. Los otros 2 llegaron sin texto y **no se determino** si son
comentarios de solo imagen o un limite del proveedor, asi que se cuentan
aparte en lugar de darlos por buenos.

### TikTok — Yaku Perez, 3 llamadas

Perfil: id estable, **519.300 seguidores**, 58 siguiendo, 5,2 M de likes, 357
videos. Exactamente lo que oEmbed no daba: P-CAND-TIKTOK-01 cerro con
«identidad si, metricas no», y esto cierra la otra mitad.

Diez videos con las cuatro metricas —views, likes, comentarios y shares—.
Comentarios: **20 observados de 110**, los 20 con texto.

**TikTok si entrega shares; Facebook no.**

### Rerun — 2 llamadas

    publicaciones        3 -> 3    SIN DUPLICAR
    publicationId        estables
    firstObservedAt      ESTABLE
    lastObservedAt       AVANZA
    observationCount     1 -> 2
    commentId TikTok     20 de 20 comunes

**Los IDs del proveedor son estables.** Unos IDs inestables convertirian cada
ejecucion en datos nuevos y el historico se volveria basura sin avisar.

### Tres ausencias que NO son la misma

Es lo que mas facil se colapsa, y colapsarlo haria creer que Facebook «no da»
lo mismo en tres casos distintos:

    shares         UNSUPPORTED   el endpoint no tiene el campo
    video_views    NO_DATA       se pidio sobre TRES videos reales
                                 y volvio null las tres veces
    historical     UNVERIFIED    no se pagino: no se sabe

### Capacidades promovidas, una a una

ScrapeCreators pasa a **SUPPORTED** en 6 capacidades de Facebook y 10 de
TikTok. Instagram entero sigue `UNVERIFIED_PROVIDER` porque **no se probo**, y
`historical` sigue sin verificar en las dos.

Aprobar y verificar a ScrapeCreators **no movio a nadie mas**: Bright Data,
SocialCrawl y Data365 siguen sin aprobar y con cero capacidades medidas, con
test que lo comprueba.

### Lo que esto NO demuestra

- **No es cobertura de los 7 candidatos.** Se midieron **dos activos**; el
  resto sigue `REQUIERE_PROVEEDOR` hasta ser observado.
- **No es cobertura historica.**
- **No es el corpus completo de comentarios**: 10 de 122 y 20 de 110 son
  muestras, y el contrato lo dice en el propio dato.
- **No cubre Instagram** ni perfiles personales de Facebook.

### El proveedor no bajo al dominio

    socialProviderClient (generico)
      -> scrapeCreatorsMapper (capa de proveedor)
      -> externalSocialProvider (normalizador)
      -> contratos de publicacion / comentario / snapshot
      -> Knowledge Lake

`candidateObservation` y la matriz social **no saben que ScrapeCreators
existe**. El unico archivo con conocimiento del proveedor es el mapper, que es
su sitio.

Dos cosas que la documentacion no decia y costaron una llamada: con
`trim=true` los videos traen `url` y **no** `share_url`, y las fechas vienen en
tres formatos —unix en posts de Facebook y en TikTok, ISO en comentarios de
Facebook—. Las dos quedan resueltas en el mapper y escritas para que no cuesten
otra.

### Aprobacion y seguridad

La aprobacion es un **cambio de codigo con fecha y gate**, no una variable de
entorno, para que quede en el historial. Alcanza solo a ScrapeCreators.

La clave se lee del entorno y **no aparece** en la URL, el resultado, la traza,
el error, lo persistido ni la documentacion. Verificado sobre el volcado crudo
y sobre lo escrito en el Lake.

Aislamiento de proyecto comprobado: el dato real de Cuenca no aparece en
ninguno de los otros 5 proyectos del Lake.

### Riesgos

- ScrapeCreators **raspa web publica y no es proveedor licenciado**. Va contra
  los ToS aunque el dato sea publico. La citabilidad si se conserva: los
  permalinks son canonicos.
- **Un proveedor puede desaparecer sin aviso**, como acaba de hacer Bright
  Data. Por eso el cliente es generico y el mapper es reemplazable.
- Al escalar, el comentario mandara el coste: 1 credito devuelve 10-20
  comentarios, asi que un corpus completo exige paginar.
- `apps/backend/package.json` sigue mezclando lineas de T1 y T3, asi que se
  dejo **sin commitear**. Las suites nuevas estan registradas en disco y
  corren.

---

## 18-M. MEDIA INTELLIGENCE — historial de la línea

**Por qué esta serie se numera aparte.** Las secciones `18-bis … 18-quadriquadragies`
son una única secuencia de ordinales latinos que Candidate y Territorial
extienden a la vez desde dos terminales. Media escribe en el mismo documento y
tomar el siguiente ordinal significaba, en la práctica, elegir uno que otra
terminal ya estaba usando sin saberlo. `18-M1 … 18-M4` no puede colisionar con
ninguno de los dos y mantiene el orden histórico legible.

**Los cuatro gates de Media existían en el repositorio y no en este documento.**
Se recuperan de los commits reales (`0c98d58`, `ad7c2f8`, `df97ed3`, `1c88033`)
y del corpus persistido, no de la memoria de nadie. La causa del desfase queda
registrada porque volverá a pasar: los tres primeros cerraron sin ejecutar el
protocolo §31, y una reanudación posterior encontró el documento tres gates por
detrás del árbol de trabajo.

---

## 18-M1. MEDIA-PIECE-01 — analizar una publicación (2026-08-26)

Commit `0c98d58`. Pegar una URL y obtener pieza, emisor, métricas observables,
candidato relacionado, amplificación, temas, conversación, territorio, snapshot
y evidencias. Cumple el `CONTRATO_MEDIA_RELATION` que `candidateRelations.js`
había predeclarado como `CONTRATO_DEFINIDO_SIN_IMPLEMENTAR`.

### Lo que reutiliza sin duplicar

`evidenceContract`, `crossProviderDedup`, `nearDuplicate`, `sourceUniverse`,
`mediaRegistry`, `sourceClassifier`, `topicEngine2`, `openTopicDiscovery`,
`stopConcepts`, `actorMentions`, `geoResolver`, `geoContracts` (GEO-1),
`evidenceGeolocation`, `candidateRelations`, `candidateAmplification`,
`socialCapabilityMatrix`, `youtubeAdapter`, `searchProviderLayer`,
`knowledgeLake`. Ni un motor paralelo.

### Garantías fijadas por test

- `value:null` nunca se convierte en 0; se declara por qué falta.
- Los snapshots se anexan; T0 no se sobrescribe nunca.
- Con un solo punto: `HISTORICO_INSUFICIENTE`, sin crecimiento inventado.
- El rol por defecto entre dos piezas es `COBERTURA_RELACIONADA`: publicar
  después no prueba copia.
- 15 piezas / 10 fuentes / 1 contenido se cuentan por separado.
- El territorio pasa por GEO-1 o no se afirma.
- No existe campo de influencia, población ni intención de voto, y un test lo
  comprueba sobre la respuesta serializada.
- Un vídeo no se atribuye al dominio de la plataforma: el emisor es la cuenta.

### Aislamiento

Todo el código nuevo en `services/media/`, `routes/media.js` y
`apps/web/src/media/`. Ficheros ajenos tocados: `server.js` (1 línea),
`App.jsx` (2) y `Sidebar.jsx` (entrada de menú).

---

## 18-M2. MEDIA-PIECE-02 — brecha real de X y Facebook (2026-08-27)

Commit `ad7c2f8`. Audita por qué una publicación de X no traía métricas y por
qué un reel de Facebook no resolvía nada.

**Causa X:** el adapter ya mapeaba las métricas en `normalizarPost`, pero no
existía ninguna función para resolver un post por su ID: había mapa y no había
camino. Se añade `xAdapter.resolverPosts` —espejo de `youtubeAdapter.resolverVideos`—
y `bookmark_count` al mapa, porque el usuario ve «guardados» en pantalla y el
modelo no los contemplaba. Quedaba un bloqueo que NO era de código: faltaba
`X_BEARER_TOKEN`.

**Causa Facebook:** no había lector de metadata pública. Sin título no hay temas
—el motor agrupa por coocurrencia del titular— ni consultas útiles de
amplificación: 3 de 4 se construyen con él. Las cinco líneas vacías del informe
tenían una sola causa.

### Nuevo

- `publicMetadata.js`: Open Graph / Twitter Card / JSON-LD **comprobando
  robots.txt antes de pedir la página**, con User-Agent identificado, sin
  cookies y sin rodear ningún muro. Un muro se declara
  `BLOQUEADA_POR_LA_PLATAFORMA`. Caché de robots con TTL de 15 min: sin
  caducidad, una regla derogada seguiría vigente mientras el proceso viviera.
- `pieceFieldMatrix.js`: matriz POR CAMPO con seis estados, sin modificar
  `socialCapabilityMatrix`, que responde otra pregunta.
- Fallback web: un snippet puede aportar el titular, siempre con procedencia
  `snippet_de_buscador` y `esContenidoOriginal:false`. Nunca rellena una métrica.

### Dos fallos que detectaron los propios tests

- Un vídeo de YouTube/X se atribuía al dominio de la plataforma; ahora el emisor
  queda pendiente y se resuelve al leer la API.
- La matriz marca `instagram.*` DISPONIBLE con `alcanceMedicion` PROPIA. Leerlo
  sin mirar el alcance habría prometido métricas de terceros inalcanzables;
  `comprobarCoherencia` pasa a ser scope-aware.

46 tests nuevos; suite completa 121, 0 fallos, ninguna toca la red.
**No se declara Facebook ni X resueltos:** se reconoce la URL y se resuelve id y
canónica; las métricas siguen bloqueadas por credencial (X) y por revisión de
app de Meta (Facebook).

---

## 18-M3. MEDIA-REAL-DEMO-01 — dos demos reales (2026-08-31)

Commits `df97ed3` y `1c88033`. Primer análisis real con métricas de la API
oficial de X, sobre el proyecto `alcaldia-cuenca-2027-piloto`.

**Credencial:** no había ninguna diferencia de mecanismo entre Candidate y
Media. `X_BEARER_TOKEN` simplemente no existía cuando MEDIA-PIECE-02 auditó;
está en el mismo `apps/backend/.env` y lo lee el mismo `xAdapter`. Una sola
fuente de credencial.

### Siete defectos reales encontrados y corregidos

1. El texto REAL devuelto por la API de X se descartaba: el orquestador solo
   leía `titulo`, y una publicación de X no tiene título. El fallback web
   acababa poniendo el snippet de un buscador encima del contenido real.
2. El emisor mostraba el handle en vez del nombre de la API: «tomebamba» en
   lugar de «La Voz del Tomebamba».
3. El fallback web se disparaba en TODA pieza de X buscando un título que la
   propia matriz declara `NO_DISPONIBLE`, gastando tres consultas para nada.
4. La comparación de nombres nunca casaba: `variantesDeNombre` devuelve
   variantes sin acentos y el texto real los lleva. Una pieza que nombraba al
   candidato salía como «no lo menciona».
5. El Lake RECHAZABA las 18 filas de cada análisis por falta de `tenantId` (DT1)
   y `linaje.submotor` (DT3) mientras `guardarAnalisis` informaba
   `persistido: true`. Ahora `persistido` refleja lo realmente escrito.
6. La misma pieza recibía DOS claves de entidad según si la API había respondido
   (`x.com/…` vs `https://x.com/…`), lo que rompía el dedup y el histórico.
7. Se arrastraban limitaciones ya resueltas («autor no resuelto» junto al nombre
   del autor). Se podan las que dejaron de ser verdad.

### §6 · Clasificación del emisor

Se añade `NO_CLASIFICADO` y se deja de devolver `CREADOR` por defecto: en un
panel «CREADOR» se lee como conclusión y no había evidencia. Nuevo
`emitterCorrespondence`: el catálogo conoce `radiotomebamba.com.ec` y la pieza
llega de `x.com/tomebamba`; se propone la correspondencia con su fuerza y su
motivo, marcada `OBSERVADA_NO_VERIFICADA`, y **NO cambia la clase** hasta que un
analista confirme. Una coincidencia parcial exige cubrir el 60 % del handle.

### Territorio derivado del proyecto (`1c88033`)

El territorio no aparecía porque GEO-1 detecta el topónimo «Cuenca» y se niega a
resolverlo sin contexto: el registro lo declara ambiguo. Esa negativa es
correcta y no se tocó. Lo que faltaba era darle el contexto que el proyecto YA
declara: `obtenerProyecto` devuelve país, provincia y cantón, y
`territoryRegistry.resolverAmbito` sabe traducirlos. **No se codifica ningún
territorio en el motor**, y un test comprueba que el orquestador no menciona
ninguna ciudad, provincia ni id de unidad.

### Las dos demos, verificadas en el Lake

| | CASO 1 | CASO 2 |
|---|---|---|
| Pieza | `x.com/tomebamba/status/2072842895451643961` | `elmercurio.com.ec/cuenca/2025/05/14/dos-anos-gestion-prefectura-juan-lloret-azuay` |
| Emisor | «La Voz del Tomebamba», cuenta `89563373`, vía `x_api` | El Mercurio, `medio_local` del catálogo |
| Clase | `NO_CLASIFICADO` (correcta) | `MEDIO` |
| Candidato | `paul-carrasco-carpio` | `juan-cristobal-lloret-valdivieso` |
| Autor | — | Patricia Naula Herembás |
| Métricas | 6/6 medidas: views 5.966 · likes 13 · comentarios 11 · shares 6 · quotes 0 · guardados 2 | 6/6 `NO_DISPONIBLE` con motivo, `value:null` |
| Territorio | Cuenca (cantón, confianza 80) por GEO-1 | — |

130 y 133 tests declarados en los commits. **Reproducidos hoy: 102** con los
tres ficheros de Media existentes, 0 fallos. La diferencia queda declarada y sin
explicar; no hay ninguna prueba en rojo.

---

## 18-M4. MEDIA-UX-HOME-01 — el módulo dentro del proyecto (2026-09-01)

Hasta este gate, **«Analizar publicación» era literalmente todo Media
Intelligence**, y el menú lo decía para no prometer un módulo inexistente. Ahora
el módulo existe y analizar una publicación es una de sus nueve secciones.

### Lo que se construyó

- `mediaVocabulary.js` — vocabulario oficial. Fija las palabras ANTES de que
  exista la métrica, que es el único momento en que fijarlas sirve.
- `mediaCorpus.js` — lee el corpus del proyecto desde el Lake.
- `mediaHome.js` — las agregaciones de la vista.
- `GET /api/media/modulo` y `GET /api/media/:proyectoId/home?ventana=` en el
  MISMO router. No hay una segunda API de Media.
- `MediaIntelligenceModule.jsx` — la vista, con `MediaPieceModule` dentro.

### Las tres dimensiones, y la que no tiene valor

`PRESENCIA OBSERVADA` y `AMPLIFICACIÓN OBSERVADA` son recuentos auditables fila
a fila. `INCIDENCIA` se devuelve **siempre sin valor**, con estado
`METODOLOGIA_EN_CONSTRUCCION` y sus cuatro requisitos: existe como concepto
precisamente para que nadie la sustituya por un conteo. El motivo va con datos
reales, no genérico: de 28 piezas del corpus, 26 no se pueden situar en el
tiempo, y sin orden temporal no se puede afirmar que una fuente aparezca antes
del crecimiento de un tema.

### Por qué no se usó `obtenerEventosProyecto`

Existe y hace casi esto, pero su proyección DESCARTA `datos`, que es donde vive
todo lo de Media. Ampliarla habría tocado un fichero compartido con Candidate y
Territorial. Se usa la misma pareja que ella usa por dentro —`indice.buscar` más
`lector.aplicarFiltros`—. **Cero ficheros compartidos del Lake modificados.**

### Los tres controles que sostienen las cifras

1. **Aislamiento por proyecto.** El Lake real contiene filas de Media de tres
   proyectos, dos de ellos de pruebas. Una HOME que las sumara mostraría piezas
   inventadas en un panel de campaña. El filtro es por `proyectoId` y **el
   recuento de lo excluido viaja en la respuesta**, para que el aislamiento sea
   auditable y no una promesa. Verificado por HTTP contra un segundo proyecto
   real (`ensayo-tipos-…`): 0 piezas, 0 filas de ranking.
2. **Solo la versión vigente.** La pieza de X se ha reanalizado cuatro veces:
   contar filas convertiría «volver a mirar» en «más presencia». 166 filas → 47
   entidades.
3. **Clave normalizada.** La misma pieza se guardó bajo `https://x.com/…` y
   `x.com/…` por el defecto 6 de MEDIA-REAL-DEMO-01. La fila antigua no se borra
   —el Lake es append-only—: se colapsa al leer y el número de colapsos se
   declara.

### El cero que no es un cero

El caso que obligó a `medidaEnVentana()`: El Mercurio tiene 8 piezas observadas
y ninguna con fecha ISO utilizable. Con un recuento único, la ventana HOY
devolvía **0** y la fila se leía «El Mercurio no publicó nada», que es lo
contrario de lo que ocurre. Ahora hay tres resultados posibles y solo uno es un
número: sin piezas → `0` y es una medición; con piezas y ninguna datable →
`null` + `COBERTURA_INSUFICIENTE`; con piezas datables → el recuento. El ranking
muestra **dos columnas**, ventana y corpus.

### La fecha que no se adivina

Las piezas de amplificación llegan de un buscador con fechas como «3 jul 2026».
`new Date("3 jul 2026")` es inválida en JS y un parser de meses en español
situaría la pieza en una ventana que nadie observó. Solo se acepta ISO-8601
estricto; el resto es `FECHA_NO_NORMALIZADA` y se cuenta. Tampoco se usa la
fecha de DETECCIÓN como sustituta: una nota de 2023 detectada hoy caería en HOY.

### El agregador que habría arruinado el ranking

`google.com` aparece con 7 piezas —más que casi cualquier medio— porque la
cobertura se recogió con SerpAPI y los enlaces vuelven envueltos en
`google.com/goto?url=…`. No es un medio: es un artefacto de nuestra propia
recolección. `mediaRegistry` ya lo tipa como AGREGADOR, así que el ranking lo
separa en `artefactosDeRecoleccion`, **visible y declarado**. Ocultarlo sería
tan malo como rankearlo.

### Ventanas

Se reutiliza `dayWindow` de la línea territorial: HOY es el día CALENDARIO en
`America/Guayaquil`, y las cinco ventanas se alinean al mismo huso para que HOY
sea un subconjunto exacto. **No se implementó ningún motor temporal paralelo.**
La ventana filtra datos reales: sobre el corpus del piloto, HOY/7d/15d/30d
sitúan 0 piezas y 90d sitúa 1.

### Defecto encontrado por la validación HTTP, y corregido

`historialDePieza` filtraba `clase === "snapshot"` sobre el historial de
VERSIONES que devuelve `obtenerHistorialEntidad` —versión, hash, fechas,
integridad—, que **no incluye `datos`**. El histórico volvía vacío aunque el
Lake tuviera los snapshots. Era invisible porque el respaldo en memoria sí los
tenía: dentro de una misma sesión el panel se veía correcto y el hueco solo
aparecía tras reiniciar el backend. Ahora se leen los registros del índice, por
las dos claves, deduplicados por `snapshotId`. Verificado en un proceso limpio:
X devuelve 5 snapshots desde `knowledge_lake` con sus 6 métricas reales, y El
Mercurio 2.

### Cifras reales del proyecto piloto, ventana 90d

Corpus 28 piezas · 2 analizadas · 26 relacionadas · 2 contenidos · 10 fuentes
originales + 1 artefacto · 4 medios · 1 periodista · 0 creadores · 1 institución
· 5 no clasificados · 2 candidatos · 28 evidencias. Temas
`COBERTURA_INSUFICIENTE`, territorio `NO_DISPONIBLE`.

Presencia: #1 La Voz del Tomebamba `NO_CLASIFICADO` (1 en ventana, 1 en corpus),
#2 El Mercurio `MEDIO` (0 en ventana, 8 en corpus, 2 candidatos).
Candidatos × medios: Paúl Carrasco 7 fuentes distintas / 7 evidencias; J. C.
Lloret 6 / 6. Piezas por candidato `NO_DISPONIBLE` con el motivo técnico exacto:
la arista se deduplica por el par (fuente, candidato).

### Lo que este gate NO hizo

No implementa motor conversacional: `sentinelAI.implementado` es `false` y solo
se declara qué preguntas sostiene ya la forma de la vista y qué ejes faltan a
las demás —4 de 7 respondibles; faltan `ventanaAnterior`, `incidencia` y
`territorio`—. No persiste territorio ni titulares nuevos. No ejecuta
proveedores: **0 requests externos, 0 USD**.

### Certificación visual

Backend verificado por HTTP en un puerto aparte para no tocar el 3001 de otra
terminal. UI implementada y construida (`npm run build` limpio), **sin
certificación visual en navegador**: corresponde a MEDIA-UX-CERT-01.

134 pruebas de Media, 0 fallos; suite completa 1.382, 0 fallos. Las suites de
Media quedan registradas en `npm test` vía `test:media`.

---

## 18-quinquadragies. P-CAND-INSTAGRAM-FALLBACK-01 (2026-08-31)

**5 requests · 5 creditos (86->81) · $0 USD.** ScrapeCreators no se toco mas
alla de estas cinco llamadas; ninguna request adicional se ejecuto durante el
cierre del gate.

Entregable: `docs/P-CAND-INSTAGRAM-FALLBACK-01.md`.

### El hueco exacto

Meta oficial solo alcanza cuentas de Instagram Business/Creator.
**9 de los 12 activos del piloto son personales** y quedan
`NO_SOPORTADO_PERSONAL`, sin remedio posible por esa via. Este gate demuestra
que ScrapeCreators **si puede medirlos**, y construye la regla que evita que un
dato raspado sustituya a uno oficial cuando el oficial ya funciona.

### Dos activos reales, leidos del Lake

**CONTROL** `@pedropalaciosu` —Meta ya lo mide, `MEDIDO_TERCERO`— id
`11337989179`, 9.718 followers, 227 following, 12 posts: coincide
razonablemente con la medicion oficial, que es justo su proposito: control de
consistencia, no medicion nueva.

**FALLBACK** `@paulcarrascoc` —unico Instagram de Paul Carrasco Carpio,
personal, `NO_SOPORTADO_PERSONAL` en Meta, cobertura CERO por via oficial— id
`3623701117`, 985 followers, 200 following, 266 posts declarados. Las 12
publicaciones devueltas son **todas de 2019**: la cuenta esta inactiva desde
hace anos. 5 comentarios reales observados, **5 de 5 declarados** (`COMPLETA`).

**No se presenta `@paulcarrascoc` como actividad actual.** El activo valida el
mecanismo, no la vigencia del candidato en la red.

### Arquitectura de routing (`socialSourceRouting.js`)

Regla por **ACTIVO**, nunca por candidato:

    1. Meta oficial, si esa via puede medir ESE activo.
    2. ScrapeCreators, solo si la oficial no puede.
    3. Estado explicito (SIN_FUENTE), si ninguna puede.

Yaku Perez es el caso que obliga a decidir por activo: `@yakuperezg`
—profesional, Meta lo mide— y `@yaku_perez` —personal, Meta no—. Enrutar por
candidato mandaria los dos al proveedor y perderia la medicion oficial del
primero, que es mejor dato y ademas gratis.

**Un fallo temporal de la oficial NO abre el fallback.** `CREDENCIAL_EXPIRADA`
o `CUOTA_AGOTADA` se arreglan renovando la credencial, no comprando el dato.
Solo los estados que dicen «esta via no alcanza y no lo hara»
—`NO_SOPORTADO_PERSONAL`, `BLOQUEADO_META`, `REQUIERE_PPCA`— abren la puerta.

**El proveedor nunca funde cifras con la oficial.** Son dos observaciones con
dos procedencias (`marcaDeFuente`), nunca un promedio: promediarlas
produciria un numero que no midio nadie.

**El estado oficial previo se conserva siempre.** Cuando el proveedor mide un
activo que Meta no alcanza, el motivo del fallo oficial queda anotado junto al
nuevo estado —`estadoOficialConservado`—, porque es justo lo que decide si
merece la pena pedir acceso oficial algun dia.

21 tests sinteticos cubren los siete casos exigidos: prioridad oficial,
fallback real, estado explicito sin fuente, no-fallback por fallo temporal,
routing por activo (Yaku), multi-asset sin colapsar (3 activos de Marcelo
Cabrera), y preservacion del estado oficial.

### Routing: PREPARADO_NO_ENGANCHADO en la ruta HTTP

Nuevo `instagramProviderFallback.js`: una funcion orquestadora REAL —no un
stub— que compone `socialSourceRouting` + `socialProviderClient` +
`scrapeCreatorsMapper`, llama al cliente generico de verdad y preserva siempre
el resultado oficial. 13 tests con `fetch` inyectado, sin red.

**Lo que falta:** ni `candidateObservation.js` ni `routes/projects.js`
invocan todavia esta funcion. Esos dos archivos sostienen 1205 comprobaciones
de la suite de Candidate —igRoute, multiAsset, socialCoverage,
realObservation, candidateIntelligence, crossLinkEvidence, baselineT0—.
Engancharlo exige ademas disenar presupuesto de creditos y manejo de errores
por HTTP: mas superficie de la que autoriza un gate corto.

**Punto de integracion exacto, documentado y no adivinado:** en
`observarCandidato`, dentro del bloque de Instagram (linea ~1177 de
`candidateObservation.js`), tras `observarInstagram()`, invocar
`observarInstagramConFallback({ cuenta, resultadoOficial: r })` cuando
`r.estado` este en `OFICIAL_NO_PUEDE`, como parametro opt-in que no cambia el
comportamiento de ningun llamador existente.

### Validaciones

- **Persistencia real:** snapshot de cuenta, 12 publicaciones, corpus de 5
  comentarios, con los contratos existentes.
- **Dedup/rerun:** id de cuenta estable, publicaciones sin duplicar,
  `firstObservedAt` inmovil, `observationCount` 1->2.
- **Project isolation:** 0 fugas en los otros proyectos del Lake.
- **Provenance:** `sourceKind: provider`, `datoLicenciadoPorLaPlataforma:
  false`, sin credenciales persistidas ni expuestas.
- **Regresion cero:** 33 suites de Candidate ejecutadas tras los cambios,
  **1205 comprobaciones adicionales, 0 fallos** —ni `candidateObservation.js`
  ni `routes/projects.js` se tocaron, asi que el riesgo era estructuralmente
  bajo, y se verifico igual—. Dos aserciones de `socialProviderClient.test.mjs`
  que asumian que Instagram no tenia endpoints declarados se actualizaron a la
  nueva realidad —ahora si los tiene— y se sumo una prueba positiva en su
  lugar, sin debilitar ninguna.

### Limitaciones

- ScrapeCreators raspa web publica; no es proveedor licenciado por
  Instagram/Meta.
- Historico no verificado: no se pagino.
- La muestra de 12 publicaciones no equivale a las 266 declaradas.
- El fallback se probo con una cuenta personal inactiva desde 2019: el
  mecanismo funciona, no implica actividad reciente en los demas activos
  personales.
- El orquestador solo pide perfil; publicaciones y comentarios se ejecutaron
  como script puntual en este gate, no como servicio reutilizable todavia.

### Riesgos

- La cobertura real de los 9 activos personales restantes sigue sin medirse:
  este gate valido el mecanismo con uno solo.
- El punto de enganche a la ruta HTTP queda identificado y sin ejecutar.
- `package.json` sigue mixto entre T1 y T3; no se toco.

---

## 18-sexquadragies. P-CAND-INSTAGRAM-ROUTE-01 (2026-09-01)

**31 comprobaciones nuevas, 0 requests externas.** ScrapeCreators no se toco:
siguen los mismos 81 creditos del gate anterior.

Entregable: `docs/P-CAND-INSTAGRAM-ROUTE-01.md`.

### Lo que estaba pendiente

`socialSourceRouting.js` e `instagramProviderFallback.js` quedaron
construidos y probados por separado en el gate anterior, pero **ninguno
estaba conectado** a `observarCandidato` -la funcion que Candidate
Intelligence invoca de verdad-. El fallback existia y funcionaba en
aislamiento; no se podia disparar desde el flujo real.

### La conexion, opt-in y sin tocar la semantica existente

Nuevo parametro `proveedorInstagram` en `observarCandidato`, `null` por
defecto. **Sin pasarlo, el comportamiento es identico byte a byte al de antes
de este gate** -verificado ejecutando las 34 suites de Candidate antes y
despues de la integracion: mismos 1236 checks, 0 fallos en ambos casos-.

Cuando se activa, no se duplica ninguna decision: `observarCandidato` llama
siempre a `observarInstagramConFallback`, que internamente reutiliza
`fuenteParaActivo` para decidir si la via oficial alcanza. Por debajo siguen
actuando, sin cambios, las dos guardas ya probadas en el gate anterior:
`fuenteParaActivo` decide si corresponde intentar el proveedor, y
`pedirAlProveedor` exige bandera de entorno, proveedor aprobado y credencial
antes de tocar la red.

### Nuevo estado, sin renombrar los que ya existian

`ESTADOS_OBSERVACION_REAL.MEDIDO_PROVEEDOR`, aditivo. **No se renombro
`OBSERVADA` a `MEDIDO_OFICIAL`**: eso habria tocado la semantica que ya usan
`igRoute`, `multiAsset`, `socialCoverage` y el resto de la suite, que el gate
prohibe expresamente. "Meta gano" se reconoce porque el resultado no tiene
`sourceKind` ni `canalProveedor`, no por un literal nuevo.

### Provenance, y la regla que no se rompe

    canal: null                    -- NUNCA se rellena con datos del proveedor
    canalProveedor: { ... }        -- el perfil real, en su propio campo
    resultadoOficial: { ... }      -- el estado oficial, INTACTO y completo
    estadoOficialConservado: "NO_SOPORTADO_PERSONAL"

`canal` se deja en null a proposito: forzar el perfil de un proveedor
distinto ahi invitaria a comparar `followers` de Meta con `followers` de
ScrapeCreators como si fueran la misma medicion, que es justo lo que este
gate prohibe reinterpretar. El estado oficial nunca desaparece: viaja
completo en `resultadoOficial`, no resumido.

### Los diez casos de prueba, todos verificados

A) Meta gana y el proveedor no se llama. B) Fallback real: perfil mapeado,
`MEDIDO_PROVEEDOR`. C) Proveedor deshabilitado: estado explicito
-`proveedorError.estado = "PROVEEDOR_DESHABILITADO"`-, nunca excepcion. D)
Proveedor falla -401, 429, timeout-: no tumba la observacion, distingue
`CREDENCIAL_RECHAZADA` de `CUOTA_AGOTADA`, preserva el estado oficial. E)
Multi-activo: dos Instagram del mismo candidato resuelven de forma
independiente, ninguno colapsa. F) Reobservacion: `accountProviderId`
identico entre dos ejecuciones, un resultado por activo. G) Provenance:
`MEDIDO_PROVEEDOR` y `OBSERVADA` nunca se confunden. H) Project isolation:
mismo `accountId` en dos `projectId` distintos no comparte estado. I) Budget
guard: proveedor con bandera y clave pero SIN aprobar sigue bloqueado -dos
capas independientes-. C bis) Un fallo temporal -`NO_EJECUTABLE` por falta de
Pagina vinculada- NO abre el fallback aunque haya opt-in: se arregla
vinculando la Pagina, no comprando el dato.

31/31 en `tests/candidateInstagramFallbackRoute.test.mjs`, cero red.

### Presupuesto

**0 requests externas en todo el gate.** Todo se probo con `fetch` inyectado
reproduciendo la forma real ya medida sobre `@paulcarrascoc` en
P-CAND-INSTAGRAM-FALLBACK-01. No hacia falta repetir `profile`, `posts` ni
`comments` reales: lo que cambiaba era el cableado, no la respuesta del
proveedor, que ya estaba certificada. **81 creditos de ScrapeCreators, sin
tocar.**

### Limitaciones

- El opt-in solo cubre **perfil**, igual que el orquestador del gate anterior.
  Publicaciones y comentarios via proveedor siguen sin estar en el flujo
  automatico.
- **La ruta HTTP sigue sin pasar `proveedorInstagram`.** La conexion de este
  gate vive en la capa de servicio (`candidateObservation.js`); activar el
  fallback desde `routes/projects.js` exige ademas disenar presupuesto de
  creditos por request HTTP, deliberadamente fuera de este gate corto.
- `NO_EJECUTABLE` sigue sin abrir el fallback, la misma decision del gate
  anterior, no reabierta aqui.
- `apps/backend/package.json` sigue con cambios mezclados de otras
  terminales: no se toco, ni para registrar la nueva suite de tests.

### Riesgos

- El motor esta conectado a nivel de servicio y probado end-to-end sin red;
  la ruta HTTP real todavia no lo expone.
- Los 9 activos personales de Instagram del piloto siguen sin medirse
  masivamente: este gate conecto el mecanismo, no ejecuto mediciones nuevas.
- Isolation multiterminal: T2 y T3 seguian trabajando en paralelo durante
  este gate -nuevos archivos territoriales y de media aparecieron a mitad de
  sesion-; ninguno se toco, y `SENTINEL_PROJECT_STATE.md` se verifico limpio
  de cambios ajenos sin comitear justo antes de esta seccion aditiva.

---

## 18-M5. MEDIA-UX-CERT-01 — certificación visual del módulo (2026-09-01)

Gate corto de certificación y corrección. **0 requests externos, 0 USD.**
Entregable: `docs/MEDIA-UX-CERT-01.md`.

### Qué se certificó, y qué NO cubre

Este entorno **no tiene navegador automatizable** —ni Playwright ni Puppeteer—,
así que no hay capturas ni comprobación de color, espaciado o responsive. Decirlo
importa, porque cambia el valor de lo que sigue.

Lo que sí es real: la app corre (`:3001` y `:5173` respondiendo 200), Vite compila
y sirve el módulo, el backend responde el contrato completo, y **las ocho
secciones se renderizan con la respuesta REAL de la API** mediante
`tests/media-home.check.jsx`, siguiendo la convención de render que el repositorio
ya tenía desde `P-CAND-ASSET-TYPE-UI-FIX-01`: *que la función devuelva el dato no
significa que la pantalla lo pinte*. **47 comprobaciones, 0 fallos**, en `90d` y
en `hoy`.

Certifica **contenido y semántica de pantalla**, no apariencia. La revisión de
apariencia sigue siendo humana, y la ruta está escrita en el documento.

### Siete correcciones P1, todas de semántica engañosa

Ninguna P0: el módulo se entendía y se usaba.

**1 · Un balanceador de AWS figuraba como medio, en el puesto #5.**
`mw-public-alb-prod-…elb.amazonaws.com` aparecía entre El Universo y Expreso. Es
el servidor de origen desde el que se sirvió una página, no una cabecera. Es el
mismo error de categoría que `google.com`, que el gate anterior ya había resuelto,
pero aquella regla estaba atada al tipo del catálogo y este host no está en ningún
catálogo. Nuevo `esHostDeInfraestructura()` con sufijos que nunca son marca
editorial; el host sale a la lista de artefactos con clase propia
`INFRAESTRUCTURA`, distinta de `AGREGADOR` porque no se arreglan igual. La lista
es corta a propósito: un dominio propio raro se queda donde está, y hay test que
lo fija.

**2 · Identificadores técnicos donde iban nombres.** La tabla pintaba
`paul-carrasco-carpio`. Se resuelve del proyecto, y el id NO se pierde: viaja
debajo, porque es lo que permite auditar la arista.

**3 · Ids de unidad territorial.** Se mostraba `ec-azuay-cuenca`.
`MEDIA-REAL-DEMO-01` ya había fijado la regla contraria y esta tabla la incumplía.
Ahora «Cuenca» y «Azuay», con el id disponible en `territorioId`.

**4 · Estados crudos en pantalla.** `COBERTURA_INSUFICIENTE` pasa a «Cobertura
insuficiente», traducido en UN solo sitio —el vocabulario— porque dos diccionarios
divergen. El valor técnico no desaparece: viaja al lado y hay test que lo exige.

**5 · El ranking no se llamaba como debía.** Pasa a **PRESENCIA MEDIÁTICA
OBSERVABLE · 90 días**, con el título decidido en el backend para que no haya dos
nombres de la misma lista, y con la nota metodológica visible.

**6 · La ventana se leía como «cero actividad».** Con HOY se mostraba `0` a secas
cuando la verdad es que 26 piezas no se pueden situar en el tiempo. Ahora las dos
cifras van pegadas y no se suman: «0 pieza(s) situada(s) en la ventana · 26 con
fecha no normalizada». La normalización es `MEDIA-TIME-NORMALIZATION-01`.

**7 · Artefactos mezclados con medios en Candidatos × Medios.** `google.com`
figuraba como una «fuente» de un candidato con el mismo peso que El Mercurio. Se
separan y se cuentan aparte: Carrasco pasa de 7 fuentes a **6 + 1 artefacto**, y
Lloret de 6 a **4 + 2**. La cifra baja y es más verdadera.

### Dos añadidos P2

**¿Por qué está aquí?** por fila del ranking. No pide nada al backend: la
justificación viaja en la fila, construida solo con hechos contables —piezas,
ventana, aristas, procedencia de la clase, correspondencia— y con su límite
declarado. «Ver evidencia» queda deshabilitado y declarado, no inventado.

**Top 10/20/50 y las seis dimensiones futuras** visibles y atenuadas, con solo
PRESENCIA activa y cada una declarando qué le falta. El diseño ya no bloquea la
evolución.

### Preparación, sin encender nada

Universo de medios con `+ Agregar medio · próximamente` **deshabilitado**: no se
pintó formulario, porque uno que no guarda es peor que ninguno —el analista
escribe un medio y lo pierde—.

### Separación vista / contenedor

`MediaIntelligenceVista` se separa de `MediaIntelligenceModule`. Sin esa
separación la pantalla solo se puede comprobar abriendo un navegador, porque los
datos llegan en un `useEffect` que el render de servidor no ejecuta.

### Comprobaciones

Render 47/47 · Media 39/39 · suite completa 1.472, 0 fallos · build limpio · lint
con los 6 errores preexistentes y **0 en Media** · 0 requests externos.

---

## 18-M6. MEDIA-TIME-NORMALIZATION-01 — fechas sin inventarlas (2026-09-01)

**0 requests externos, 0 USD.** Entregable:
`docs/MEDIA-TIME-NORMALIZATION-01.md`.

### Una corrección al baseline que este documento traía

Los gates anteriores decían «26 piezas en `FECHA_NO_NORMALIZADA`». Inventariando
pieza por pieza, esa cifra mezclaba dos estados distintos: **9** con un valor que
no era ISO, y **17 sin ningún valor de fecha**. La distinción no es cosmética —
una se arregla con un parser y la otra solo volviendo a la fuente—, y
colapsarlas hacía parecer que el gate podía resolver 26 casos cuando el techo
real eran 9.

### La escalera de fuentes temporales

`ISO_8601` → `TEXTO_ES_INEQUIVOCO` → `NUMERICA_INEQUIVOCA` →
`RELATIVO_A_OBSERVACION`. La primera que resuelve gana y el método queda
registrado en la pieza. **No hay un peldaño para «usar `observedAt`»**, y hay un
test que comprueba que no existe ningún camino que lo permita.

### El detalle que decide si «HOY» significa algo

`3 jul 2026` tiene precisión de DÍA. Anclarlo a `2026-07-03T00:00:00Z` parece
inofensivo y no lo es: en `America/Guayaquil` esa medianoche UTC son las 19:00
del 2 de julio, así que la pieza caería en el día anterior. Con ventanas de
calendario eso desplaza piezas de un día al otro sistemáticamente. Se ancla a la
**medianoche local** y se declara `precision: "DIA"`. Lo mismo para una fecha ISO
sin hora: la precisión del dato no cambia porque el formato sea ISO.

### Lo que se negó a normalizar

`03/07/2026` puede ser 3 de julio o 7 de marzo y la convención del publicador no
viaja en el dato: queda `AMBIGUA`. Elegir DD/MM «porque en Latinoamérica se usa
así» acertaría muchas veces y fallaría **en silencio** el resto, que es la peor
combinación posible. `21/05/2025` sí se resuelve, porque no hay mes 21. `ayer`
sin instante de observación no se resuelve. Los motivos no se colapsan en «no se
pudo»: `SIN_VALOR` se arregla reingiriendo y `AMBIGUA` no se arregla nunca.

### Por qué NO hubo backfill

La normalización ocurre **al leer**. El valor crudo queda intacto, la operación
es idempotente por construcción —leer dos veces no puede duplicar nada ni mover
un id— y mejorar el parser mañana mejora todo el corpus sin backfill. Un backfill
habría escrito 9 versiones nuevas para el mismo resultado, con riesgo de
sobrescribir una fecha válida. Verificado: `registrosEnLake` idéntico tras dos
lecturas.

### Antes / después

Piezas con fecha utilizable **2 → 11** de 28; proporción datable **7 % → 39 %**;
`FECHA_NO_NORMALIZADA` **9 → 0**; `SIN_EVIDENCIA` 17, sin cambio y no
normalizable sin reingestión. Ventana 90d **1 → 5** piezas situadas; HOY–30D
siguen en 0 y es correcto, porque la pieza datable más reciente es de julio.

En el ranking, **El Mercurio pasa de aparentar inactividad —0 con 8 piezas en
corpus— a encabezar la lista con 2 piezas reales dentro de la ventana**. El
Universo y Primicias muestran **0 legítimo**: tienen piezas datables de 2023 y
2025, fuera de los 90 días. Facebook e Instagram siguen en cobertura
insuficiente, porque sus piezas no tienen fecha y no se les asigna un 0.

### Lo que no cambió

Candidatos × Medios intacto, con `piezas por candidato` todavía `NO_DISPONIBLE`
porque la arista se deduplica por par. Amplificación sigue sin afirmar copia ni
causalidad. Incidencia sigue `METODOLOGIA_EN_CONSTRUCCION`: su motivo se
recalcula solo y ya dice 17 en vez de 26, pero normalizar fechas no crea la
segunda ventana comparable que le falta.

### Comprobaciones

`mediaTime.test.mjs` 28/28 · Media registradas 142/142 · suite completa 1.473, 0
fallos · render 47/47 · build limpio · lint con los 6 preexistentes y 0 en Media.

Tres tests cambiaron de *fixture* y ninguno se debilitó: usaban `3 jul 2026` como
ejemplo de fecha no interpretable y ahora se resuelve, así que pasan a
`03/07/2026`, que sigue siendo genuinamente ambigua; se añadió la contraparte que
comprueba que la fecha en español sí se resuelve.

`mediaTime.test.mjs` **no está registrado en `npm test`**: `package.json` sigue
mezclando líneas sin commitear de otra terminal y este gate tenía prohibido
tocarlo.

---

## 18-M7. MEDIA-SOURCE-UNIVERSE-01 — universo de medios por proyecto (2026-09-01)

**0 requests externos, 0 USD.** Entregable:
`docs/MEDIA-SOURCE-UNIVERSE-01.md`.

### Lo que ya existía, y por qué no se duplicó

Antes de crear nada se auditaron cuatro estructuras que ya representan fuentes:
`conversation/mediaRegistry` (catálogo semilla), `conversation/sourceUniverse`
(registro con estados y orígenes), `ingest/mediaSourceRegistry` (medios y feeds)
y `territorial/verifiedSourceUniverse` (fuentes verificadas de un territorio).

De `sourceUniverse` se **reutiliza el vocabulario entero** por reexport, no por
copia: tipos, subtipos, estados y orígenes. Una taxonomía paralela habría
producido dos verdades sobre la misma pregunta.

Lo que ninguna modelaba es la pieza que faltaba: **una entidad media por encima
de los dominios**. Las cuatro indexan por dominio, pero «La Voz del Tomebamba»
es UNA entidad que posee sitio, Facebook, Instagram, X, YouTube y feed; con un
registro por dominio son seis fuentes y ninguna sabe de las otras. Y faltaba que
persistiera y fuera por proyecto: `crearUniverso()` vive en memoria y nada de lo
que un analista declare sobrevive a la petición.

### Las cinco reglas

ENTIDAD ≠ DOMINIO ≠ ACTIVO · N activos por plataforma, con clave
`plataforma + handle` como en Candidate · **declarar no es verificar** · **no se
deduplica por nombre**, porque «El Diario» existe en media docena de países · la
infraestructura no entra, porque si entra acaba en un ranking.

El id sale del **dominio**, no del nombre: un medio se renombra y el id no puede
cambiar con él, porque es lo que ata las evidencias.

### Los dos planos que no se mezclan

El **descubrimiento** se deriva del corpus en cada lectura y NO se persiste: si
se guardara, al mejorar el clasificador mañana quedarían congeladas las
entidades mal tipadas de hoy. Lo que se persiste es la **intervención humana**
—declarar, editar, verificar, dar de baja—, que no se puede derivar de nada. Al
leer, los dos planos se funden y lo declarado gana sobre lo inferido.

### Resultado real sobre el piloto

**11 entidades · 14 activos** (6 dominios, 7 sociales, 1 feed) · 3 artefactos
fuera · 0 sin resolver · 0 posibles duplicados. Por tipo: MEDIA 5, OTHER 5,
INSTITUTION 1. Por estado: DESCUBIERTA 9, OBSERVADA 1, VERIFICADA 1.

Fuera del universo, con su motivo: `google.com` (agregador, 7 piezas), el
balanceador de AWS (infraestructura, 2) e `instagram.com` (plataforma sin cuenta
identificable en la URL, 2).

### Dos defectos que encontró el corpus real

`threads.com` entraba como si fuera una cabecera, porque
`sourceUniverse.esPlataforma` no lo conoce y ese fichero lo comparten
conversation y territorial; se combina con una tabla local en vez de ampliar el
fichero ajeno. Y el nombre del emisor a veces ES el dominio —el corpus trae
`nombreEmisor: "threads.com"`—, lo que dejaba una entidad llamada «threads.com»
cuyo único activo era `@notivozec`: si el nombre no aporta nada sobre la cuenta,
gana el handle.

### El caso que define la deduplicación

`@elmercurioec` y `El Mercurio` **no se funden**. Se propone la correspondencia
con su fuerza y su estado, sin confirmar, y decide un analista. Unirlas por
parecido de handle es exactamente lo que la regla prohíbe. Sí funden
`elmercurio.com.ec` y `www.elmercurio.com.ec`, y funde un alias declarado.

### UI construida

`apps/web` no estaba en conflicto, así que se construyó la tabla del universo en
**Medios** y se cerró la promesa que `MEDIA-UX-CERT-01` dejó como
«próximamente»: **`+ Agregar medio` guarda de verdad**, y lo que entra queda
DECLARADO y sin verificar, con el aviso en la propia pantalla.

### Coordinación pendiente

Terminal 2 ha creado `services/territorial/journalistUniverse.js`. No se tocó.
Antes de construir Journalist Intelligence en Media hay que decidir si esa
entidad es compartida — exactamente el error que este gate evitó con las cuatro
estructuras de fuentes.

### Comprobaciones

`mediaSourceUniverse` 32/32 · `mediaTime` 28/28 · Media registradas 142/142 ·
suite completa 1.473, 0 fallos · render 53/53 con universo y 47/47 sin él ·
ranking y normalización temporal sin regresión · build limpio · lint con los 6
preexistentes y 0 en Media.

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
| **Linea base T0** | 🟢 **CREADA** (§18-sexvicies): siete candidatos reales medidos en X y YouTube, con cobertura y comparabilidad declaradas |
| **X operativo** | 🟢 **MEDIDO** (§18-quinvicies): 9 de 12 capacidades. Perfil, publicaciones y las seis metricas por publicacion |
| Cobertura de los candidatos | 🔴 cinco de siete estan en **1/5 plataformas**. Solo Lloret y Yaku llegan a 2/5 |
| Tipo de las publicaciones antiguas de Lloret | 🔴 `NO_DETERMINADO`: se guardaron antes del contrato. Se sabra al reobservar; no se infiere por heuristica |
| Segunda observacion (T1) | 🔴 sin ella no hay momentum. T0 es el primer punto y `HISTORICO_INSUFICIENTE` es el estado correcto |
| IPID | 🔴 **NO IMPLEMENTADO a proposito**. Hace falta mas cobertura multiplataforma, snapshots longitudinales y metodologia aprobada |
| `impression_count` y `bookmark_count` de terceros | 🟢 **CONFIRMADAS**: llegaron en las cinco publicaciones. Era la incognita del gate |
| **Retweets en los promedios** | 🔴 **RIESGO ABIERTO para el benchmark**: en un retweet, likes/replies/quotes valen 0 porque son del post original. Con la muestra real, la media de likes pasa de 76 a 190 al filtrarlos. Usar `esRepost` ANTES de promediar |
| Menciones de X | 🔴 `NO_PROBADO`. `search/recent` quedaba fuera del presupuesto de este gate. Es la mitad que le falta a Candidate Intelligence |
| `listed_count` de X | 🔴 no lo mapea nuestro normalizador. Hueco propio, no limite de la fuente |
| Coste por llamada de X | 🔴 `COSTE_NO_RESUELTO`. 2 requests gastadas de 25 USD; X no devolvio consumo en la respuesta y no se estima |
| Archivo completo de X | 🔴 `search/all` sigue fuera: es cuestion de nivel, no de saldo |
| Precio real del plan de X | 🔴 `null`. Depende del plan y ha cambiado varias veces: se verifica en el portal, no se estima |
| **Instagram cuenta propia** | 🟢 **MEDIDO_PROPIO** (§18-septemvicies): perfil, publicaciones e insights funcionando. 8 capacidades |
| **Instagram terceros** | 🔴 **BLOQUEADO**: `business_discovery` devuelve 400/190 porque el token es de Instagram Login y el endpoint exige Facebook Login. **Instagram NO entra al benchmark multicandidato** |
| Facebook Login for Business | 🔴 **ACCION REQUERIDA** y **confirmada con documentacion oficial** (§18-duodetricies): `business_discovery` exige Facebook User access token, Advanced Access, App Review y Business Verification |
| **Cuentas personales en Meta** | 🔴 **INALCANZABLES POR VIA OFICIAL**, ni ahora ni tras la revision. Afecta al candidato patron, que tiene perfil personal de Facebook |
| **Multi-activo por plataforma** | 🟢 **VERIFICADO** (§18-undetricies): el modelo 1:N funciona en persistencia, dominio e interfaz. Lloret tiene 2 activos de Facebook y 2 de Instagram |
| Cierre de discovery por plataforma | 🟢 **CORREGIDO**: la propagacion omitia la plataforma entera al encontrar una cuenta; ahora omite el par `plataforma:handle` |
| **Tipificacion de los 23 activos Meta** | 🔴 **0 de 23 clasificados**. La capacidad de declararlos ya existe (§18-untricies); falta que el analista los clasifique. Es el dato que bloquea la decision sobre Meta |
| **Instagram de terceros** | 🟢 **MEDIDO_TERCERO** (§18-quintricies): `business_discovery` responde con identidad, followers, publicaciones, likes y comments_count de una cuenta profesional ajena. Solo alcanza cuentas profesionales |
| Observacion de Instagram multicandidato | 🟡 **MOTOR LISTO, SIN EJECUTAR** (§18-sextricies): `observarInstagram` integrado en el pipeline; el token caduco antes de correrlo |
| Duracion del token de Meta | 🔴 **~1 hora**: los del Graph API Explorer no sirven para operar. Falta el intercambio a ~60 dias, que exige `META_APP_ID` y `META_APP_SECRET` |
| Facebook de terceros: via exacta | 🟢 **DETERMINADA** (§18-sextricies): Page Public Content Access, con App Review y Business Verification. Las otras dos alternativas que Meta nombraba no son reales |
| Comentarios de Instagram | 🟡 **PARCIAL**: el recuento llega, el TEXTO no —medido, HTTP 400 code 100—. Comments Intelligence sigue sin fuente por esta via |
| Titularidad del token de Meta | 🟡 **decision pendiente**: el token administra la Pagina del candidato patron, asi que «nuestra cuenta propia» en Meta es su activo |
| **Facebook de terceros** | 🔴 **BLOQUEADO POR PERMISOS** (§18-quintricies): Meta nombra tres alternativas —`pages_read_engagement`, Page Public Content Access o Page Public Metadata Access— y no menciona Business Verification |
| Eleccion de token por host | 🟢 **CORREGIDO** (§18-quatertricies): cada host recibe su familia y no hay respaldo cruzado. Sin el que toca, la llamada no se hace |
| `FACEBOOK_USER_ACCESS_TOKEN` | 🟢 **CONFIGURADO Y VALIDADO** (§18-quatertricies): `CREDENCIAL_PARSEABLE`, HTTP 200 en `graph.facebook.com/me`. Parseable no es acceso a terceros |
| App Review / Business Verification | 🟡 **TODAVIA NO DEMOSTRADOS**: la documentacion los exige para Advanced Access, pero ninguna llamada ha llegado a evaluar permisos |
| Comments Intelligence | 🟡 `COMMENTS_NOT_TESTED` en IG y FB: el bloqueo esta aguas arriba. Regla ya fijada: comentarios observados != todos los comentarios |
| Declaracion de tipo por el analista | 🟢 **FUNCIONAL Y VISIBLE** (§18-untricies, corregida en §18-duotricies): selector dentro de «Editar identidad digital», serie propia en el Lake, procedencia y verificacion separadas |
| Cobertura de pruebas sobre la UI | 🟡 **parcial**: hay render check para el editor de identidad (§18-duotricies) y para los paneles territoriales. El resto de pantallas solo tienen pruebas de dominio, que no ven el HTML |
| **Cobertura Meta** | 🔴 **DESCONOCIDA 7/7**. No es baja: es que no se pudo determinar. `UNKNOWN` no se cuenta como `NO` |
| Clasificacion por HTML publico de Facebook | 🟢 **descartada con control**: paginas conocidas salian como «perfil». La senal era plantilla del armazon sin sesion |
| `P-CAND-UX-MULTI-ASSET-INPUT` | 🟡 **backlog**: el alta admite una URL por plataforma; se anaden mas por «Editar identidad» |
| `P-CAND-ASSET-DISCOVERY-02` | 🟢 **no hace falta abrirlo**: 23 activos y 9 casos de multi-activo sugieren que el discovery funciona tras la correccion anterior |
| Formulario de alta con una URL por plataforma | 🟡 **gap menor**: no es restriccion del modelo, se anaden por «Editar identidad» |
| Recuento profesional vs personal de los 7 candidatos | 🔴 **dato que falta antes de invertir en App Review**. Si la mayoria son personales, la via oficial rinde poco |
| `habilitaBenchmark()` | 🟢 la regla MEDIDO_TERCERO es ahora una funcion, no una convencion |
| REELS de Instagram | 🔴 `NO_PROBADO`: las cinco publicaciones de la muestra eran IMAGE |
| Instagram Business Discovery | 🟡 **via identificada y medida como bloqueada**. Aun consiguiendola, solo alcanza cuentas PROFESIONALES: un candidato con perfil personal seguiria fuera |
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
| 2026-09-01 | MEDIA-SOURCE-UNIVERSE-01 | Universo de medios persistente y por proyecto. 0 requests externos, 0 USD. Antes de crear nada se auditaron las CUATRO estructuras que ya representan fuentes —mediaRegistry, sourceUniverse, ingest/mediaSourceRegistry y territorial/verifiedSourceUniverse— y ninguna se duplico: de sourceUniverse se reutiliza el vocabulario entero por reexport, porque una taxonomia paralela habria producido dos verdades sobre la misma pregunta. Lo que ninguna modelaba es la pieza que faltaba, UNA ENTIDAD MEDIA POR ENCIMA DE LOS DOMINIOS: las cuatro indexan por dominio, pero «La Voz del Tomebamba» es una entidad que posee sitio, Facebook, Instagram, X, YouTube y feed, y con un registro por dominio son seis fuentes que no saben unas de otras; y faltaba que persistiera y fuera por proyecto, porque crearUniverso() vive en memoria y nada de lo que un analista declare sobrevive a la peticion. Cinco reglas: ENTIDAD != DOMINIO != ACTIVO; N activos por plataforma con clave plataforma+handle igual que Candidate; DECLARAR NO ES VERIFICAR; NO se deduplica por nombre, porque «El Diario» existe en media docena de paises; y la infraestructura no entra, porque si entra acaba en un ranking. El id sale del DOMINIO y no del nombre: un medio se renombra y el id no puede cambiar con el, porque es lo que ata las evidencias. Dos planos que no se mezclan: el descubrimiento se deriva del corpus en cada lectura y NO se persiste —si se guardara, al mejorar el clasificador manana quedarian congeladas las entidades mal tipadas de hoy—, mientras que lo que si se persiste es la intervencion humana, que no se puede derivar de nada; al leer, los dos se funden y lo declarado gana sobre lo inferido. Resultado real sobre el piloto: 11 entidades y 14 activos —6 dominios, 7 sociales, 1 feed—, 3 artefactos fuera, 0 sin resolver y 0 posibles duplicados, con MEDIA 5, OTHER 5 e INSTITUTION 1, y estados DESCUBIERTA 9, OBSERVADA 1 y VERIFICADA 1. Fuera del universo con su motivo: google.com como agregador con 7 piezas, el balanceador de AWS como infraestructura con 2, e instagram.com como plataforma sin cuenta identificable en la URL con 2. Dos defectos que encontro el corpus real: threads.com entraba como si fuera una cabecera porque sourceUniverse.esPlataforma no lo conoce y ese fichero lo comparten conversation y territorial, asi que se combina con una tabla local en vez de ampliar el ajeno; y el nombre del emisor a veces ES el dominio —el corpus trae nombreEmisor «threads.com»—, lo que dejaba una entidad llamada threads.com cuyo unico activo era @notivozec, asi que si el nombre no aporta nada sobre la cuenta gana el handle. El caso que define la deduplicacion: @elmercurioec y El Mercurio NO se funden, se propone la correspondencia sin confirmar y decide un analista, porque unirlas por parecido de handle es justo lo que la regla prohibe; si funden elmercurio.com.ec con www.elmercurio.com.ec y si funde un alias declarado. Verificar exige decir QUIEN verifica y sin autor devuelve 422, comprobado por HTTP. Desactivar no borra: conserva activos, evidencias e historia. Aislamiento comprobado con el MISMO dominio en dos proyectos, con recuentos separados y 0 fugas. ENCONTRADO no es MEDIDO y hay test que lo fija: ningun canal pasa a MEDIDO en este gate. La UI no estaba en conflicto, asi que se construyo la tabla del universo en Medios y se cerro la promesa que MEDIA-UX-CERT-01 dejo como «proximamente»: + Agregar medio guarda de verdad, y lo que entra queda DECLARADO y sin verificar con el aviso en la propia pantalla. Coordinacion pendiente: T2 ha creado territorial/journalistUniverse.js y no se toco; antes de construir Journalist Intelligence en Media hay que decidir si esa entidad es compartida, que es exactamente el error que este gate evito con las cuatro estructuras de fuentes. mediaSourceUniverse 32/32, mediaTime 28/28, Media registradas 142/142, suite completa 1.473 con 0 fallos, render 53/53 con universo y 47/47 sin el, ranking y normalizacion temporal sin regresion, build limpio y lint con los 6 preexistentes y 0 en Media. Nueva §18-M7 y docs/MEDIA-SOURCE-UNIVERSE-01.md. |
| 2026-09-01 | MEDIA-TIME-NORMALIZATION-01 | Normalizacion temporal de las piezas de Media sin inventar una sola fecha. 0 requests externos, 0 USD. Empieza corrigiendo el baseline que este documento traia: «26 piezas en FECHA_NO_NORMALIZADA» mezclaba dos estados distintos —9 con un valor que no era ISO y 17 SIN NINGUN valor de fecha—, y la distincion no es cosmetica porque una se arregla con un parser y la otra solo volviendo a la fuente; colapsarlas hacia parecer que el gate podia resolver 26 casos cuando el techo real eran 9. Escalera de fuentes temporales con el metodo registrado en cada pieza: ISO_8601, TEXTO_ES_INEQUIVOCO, NUMERICA_INEQUIVOCA y RELATIVO_A_OBSERVACION, sin ningun peldano para «usar observedAt» y con un test que comprueba que no existe camino que lo permita. El detalle que decide si HOY significa algo: «3 jul 2026» tiene precision de DIA, y anclarlo a medianoche UTC lo pondria a las 19:00 del 2 de julio en Guayaquil, desplazando piezas de un dia al otro de forma sistematica con ventanas de calendario; se ancla a medianoche LOCAL y se declara precision DIA, y lo mismo se aplica a una fecha ISO sin hora porque la precision del dato no cambia por el formato. Lo que se niega a resolver: 03/07/2026 queda AMBIGUA porque puede ser 3 de julio o 7 de marzo y la convencion del publicador no viaja en el dato —elegir DD/MM acertaria muchas veces y fallaria EN SILENCIO el resto, la peor combinacion posible—, mientras 21/05/2025 si se resuelve porque no hay mes 21; «ayer» sin instante de observacion tampoco se resuelve; y los motivos no se colapsan en «no se pudo», porque SIN_VALOR se arregla reingiriendo y AMBIGUA no se arregla nunca sin mas contexto. NO hubo backfill, y es una decision: la normalizacion ocurre AL LEER, asi que el valor crudo queda intacto, la operacion es idempotente por construccion —leer dos veces no puede duplicar nada ni mover un id— y mejorar el parser manana mejora todo el corpus sin reescribir nada; un backfill habria escrito 9 versiones nuevas para el mismo resultado con riesgo de sobrescribir una fecha valida, y se verifico que registrosEnLake es identico tras dos lecturas. Antes/despues: piezas con fecha utilizable 2 -> 11 de 28, proporcion datable 7% -> 39%, FECHA_NO_NORMALIZADA 9 -> 0, SIN_EVIDENCIA 17 sin cambio por no ser normalizable sin reingestion; ventana 90d 1 -> 5 piezas situadas, y HOY-30D siguen en 0 correctamente porque la pieza datable mas reciente es de julio. El cambio mas visible esta en el ranking: El Mercurio pasa de aparentar inactividad —0 con 8 piezas en corpus— a encabezar la lista con 2 piezas reales dentro de la ventana, mientras El Universo y Primicias muestran un 0 LEGITIMO por tener piezas datables de 2023 y 2025 fuera de los 90 dias, y Facebook e Instagram siguen en cobertura insuficiente porque sus piezas no tienen fecha y no se les asigna un cero. Sin cambios en Candidatos x Medios, donde piezas por candidato sigue NO_DISPONIBLE porque la arista se deduplica por par, ni en Amplificacion, que sigue sin afirmar copia ni causalidad; Incidencia sigue METODOLOGIA_EN_CONSTRUCCION y su motivo se recalcula solo diciendo ya 17 en vez de 26, porque normalizar fechas no crea la segunda ventana comparable que le falta. Tres tests cambiaron de fixture y ninguno se debilito: usaban «3 jul 2026» como ejemplo de fecha no interpretable y ahora se resuelve, asi que pasan a 03/07/2026, que sigue siendo genuinamente ambigua, y se anadio la contraparte que comprueba que la fecha en espanol SI se resuelve. mediaTime.test.mjs 28/28, Media registradas 142/142, suite completa 1.473 con 0 fallos, render de pantalla 47/47, build limpio, lint con los 6 preexistentes y 0 en Media. La suite nueva NO se registra en npm test porque package.json sigue mezclando lineas sin comitear de otra terminal y este gate tenia prohibido tocarlo. Nueva §18-M6 y docs/MEDIA-TIME-NORMALIZATION-01.md. |
| 2026-09-01 | MEDIA-UX-CERT-01 | Certificacion visual de Media Intelligence y correccion de lo que la inspeccion encontro. 0 requests externos y 0 USD. Primero lo que este gate NO puede afirmar: el entorno no tiene navegador automatizable —ni Playwright ni Puppeteer—, asi que no hay capturas ni comprobacion de color, espaciado o responsive, y la revision de apariencia sigue siendo humana. Lo que si es real: la app corre con backend en 3001 y Vite en 5173 respondiendo 200, Vite compila y sirve el modulo, el backend responde el contrato entero, y las OCHO secciones se renderizan con la respuesta REAL de la API mediante tests/media-home.check.jsx, siguiendo la convencion de render que el repositorio ya tenia desde P-CAND-ASSET-TYPE-UI-FIX-01 —que la funcion devuelva el dato no significa que la pantalla lo pinte—: 47 comprobaciones, 0 fallos, en 90d y en hoy. Ninguna P0: el modulo se entendia y se usaba. Siete correcciones P1, todas de semantica engañosa. La que mas importa: un balanceador de AWS, mw-public-alb-...elb.amazonaws.com, figuraba en el puesto #5 del ranking ENTRE El Universo y Expreso; es el servidor de origen desde el que se sirvio una pagina, no una cabecera, y es el mismo error de categoria que google.com salvo que aquella regla estaba atada al tipo del catalogo y este host no esta en ningun catalogo —nuevo esHostDeInfraestructura() con sufijos que nunca son marca editorial, el host pasa a artefactos con clase propia INFRAESTRUCTURA distinta de AGREGADOR porque no se arreglan igual, y la lista se deja corta a proposito con un test que fija que un dominio propio raro NO se reclasifica por parecerlo—. Las otras seis: identificadores tecnicos donde iban nombres (paul-carrasco-carpio pintado tal cual; se resuelve del proyecto y el id no se pierde, viaja debajo porque es lo que permite auditar la arista); ids de unidad territorial (ec-azuay-cuenca en pantalla, incumpliendo la regla que MEDIA-REAL-DEMO-01 ya habia fijado; ahora Cuenca y Azuay, con el id en territorioId); estados crudos (COBERTURA_INSUFICIENTE pasa a «Cobertura insuficiente», traducido en UN solo sitio porque dos diccionarios divergen, y el crudo no desaparece porque quien audita lo necesita); el titulo del ranking, que pasa a PRESENCIA MEDIATICA OBSERVABLE con la ventana y la nota metodologica visibles, decidido en el backend para que no haya dos nombres de la misma lista; la ventana que se leia como «cero actividad» cuando la verdad es que 26 piezas no se pueden situar en el tiempo, y ahora muestra el par pegado y no sumable «0 situada(s) en la ventana · 26 con fecha no normalizada»; y los artefactos mezclados con medios en Candidatos x Medios, donde google.com figuraba como «fuente» de un candidato con el mismo peso que El Mercurio —separados y contados aparte, Carrasco baja de 7 fuentes a 6 mas 1 artefacto y Lloret de 6 a 4 mas 2, la cifra baja y es mas verdadera—. Dos añadidos P2: «¿Por que esta aqui?» por fila, que no pide nada al backend porque la justificacion viaja en la fila construida solo con hechos contables y con su limite declarado, y «Ver evidencia» deshabilitado y declarado en lugar de inventado; y Top 10/20/50 mas las seis dimensiones futuras visibles y atenuadas, con solo PRESENCIA activa y cada una declarando que le falta, para que el diseño no bloquee la evolucion. Universo de medios preparado con «+ Agregar medio · proximamente» DESHABILITADO: no se pinto formulario, porque uno que no guarda es peor que ninguno. Se separa MediaIntelligenceVista de MediaIntelligenceModule, sin lo cual la pantalla solo se puede comprobar abriendo un navegador. Las dos demos reales reproducen tras reiniciar el backend: Tomebamba 5 snapshots desde knowledge_lake con views 5.966, El Mercurio 2 con metricas null y motivo. Render 47/47, Media 39/39, suite completa 1.472, 0 fallos, build limpio, lint con los 6 preexistentes y 0 en Media. Nueva §18-M5 y docs/MEDIA-UX-CERT-01.md. |
| 2026-09-01 | P-CAND-INSTAGRAM-ROUTE-01 | Fallback de Instagram conectado al flujo real de observacion, 0 requests externas, 81 creditos de ScrapeCreators sin tocar. socialSourceRouting.js e instagramProviderFallback.js quedaron probados por separado en el gate anterior pero ninguno estaba conectado a observarCandidato; nuevo parametro proveedorInstagram, null por defecto, con el que sin pasarlo el comportamiento es identico byte a byte al de antes -verificado ejecutando las 34 suites de Candidate antes y despues, mismos 1236 checks, 0 fallos en ambos casos-. Cuando se activa no se duplica ninguna decision: se llama siempre a observarInstagramConFallback, que reutiliza fuenteParaActivo internamente, con las dos guardas del gate anterior intactas por debajo -bandera de entorno, proveedor aprobado y credencial-. Nuevo estado MEDIDO_PROVEEDOR aditivo, sin renombrar OBSERVADA a MEDIDO_OFICIAL para no tocar la semantica que ya usan igRoute, multiAsset, socialCoverage y el resto de la suite: Meta gano se reconoce porque el resultado no tiene sourceKind ni canalProveedor, no por un literal nuevo. Provenance con canal en null a proposito -forzar el perfil de un proveedor distinto ahi invitaria a comparar followers de Meta con followers de ScrapeCreators como si fueran la misma medicion- y resultadoOficial siempre intacto y completo, nunca resumido. Diez casos de prueba verificados: Meta gana sin llamar al proveedor, fallback real con perfil mapeado, proveedor deshabilitado con estado explicito PROVEEDOR_DESHABILITADO y nunca excepcion, fallos 401/429/timeout que no tumban la observacion y distinguen CREDENCIAL_RECHAZADA de CUOTA_AGOTADA, multi-activo sin colapsar, reobservacion con id estable, provenance sin confundir MEDIDO_PROVEEDOR con OBSERVADA, project isolation entre projectId distintos, budget guard con dos capas independientes, y un fallo temporal NO_EJECUTABLE que sigue sin abrir el fallback. 31/31 en tests/candidateInstagramFallbackRoute.test.mjs, cero red: todo se probo con fetch inyectado reproduciendo la forma real ya medida sobre @paulcarrascoc, sin repetir profile/posts/comments reales porque lo que cambiaba era el cableado y no la respuesta del proveedor. Limitaciones declaradas: el opt-in solo cubre perfil, la ruta HTTP routes/projects.js sigue sin pasar proveedorInstagram -disenar presupuesto de creditos por request HTTP queda fuera de este gate corto-, y NO_EJECUTABLE sigue sin abrir el fallback por decision ya tomada. package.json sigue mezclado entre terminales y no se toco. T2 y T3 trabajaban en paralelo durante el gate -nuevos archivos territoriales y de media aparecieron a mitad de sesion-; ninguno se toco y SENTINEL_PROJECT_STATE.md se verifico limpio de cambios ajenos sin comitear justo antes de esta seccion. Nueva §18-sexquadragies y docs/P-CAND-INSTAGRAM-ROUTE-01.md. |
| 2026-08-31 | P-CAND-INSTAGRAM-FALLBACK-01 | ScrapeCreators validado como fallback real de Instagram cuando Meta oficial no alcanza: 5 requests, 5 creditos (86->81), 0 USD. El hueco es real: 9 de 12 activos de Instagram del piloto son personales y Meta les da cobertura cero sin remedio posible por esa via. Dos activos reales del Lake: CONTROL @pedropalaciosu, que Meta ya mide y que ScrapeCreators reprodujo con 9.718 followers coincidentes -sirve solo de control de consistencia-; y FALLBACK @paulcarrascoc, unico Instagram de Paul Carrasco y personal, con cobertura cero por Meta, donde ScrapeCreators devolvio 985 followers, 12 publicaciones -todas de 2019, cuenta inactiva- y 5 de 5 comentarios reales con texto, cobertura COMPLETA. No se presenta la cuenta inactiva como actividad vigente: solo valida el mecanismo. Nuevo socialSourceRouting.js con la regla por ACTIVO -Meta oficial primero, proveedor solo si la oficial no puede, estado explicito SIN_FUENTE si ninguna puede-, con Yaku Perez como caso que obliga a decidir por activo y no por candidato -su Instagram profesional lo mide Meta y el personal no-, con un fallo temporal de la oficial -credencial expirada, cuota agotada- que NO abre el fallback porque se arregla renovando la credencial y no comprando el dato, y con el estado oficial previo siempre conservado junto al nuevo estado del proveedor. 21 tests sinteticos cubren los siete casos exigidos, incluido multi-asset con tres activos de Marcelo Cabrera sin colapsar. Nuevo instagramProviderFallback.js, una funcion orquestadora real -no un stub- que compone el routing, el cliente generico y el mapper y preserva siempre el resultado oficial, con 13 tests sin red. Routing declarado PREPARADO_NO_ENGANCHADO en la ruta HTTP: ni candidateObservation.js ni routes/projects.js la invocan todavia, porque esos dos archivos sostienen 1205 comprobaciones de la suite de Candidate y engancharla exige ademas disenar presupuesto de creditos y manejo de errores por HTTP, mas superficie de la que autoriza un gate corto; el punto de integracion exacto queda documentado -linea ~1177 de candidateObservation.js, como parametro opt-in que no cambia ningun llamador existente-. Validado: persistencia real con los contratos existentes, dedup y rerun con firstObservedAt inmovil y observationCount 1->2, aislamiento de proyecto con 0 fugas, provenance sin credenciales, y regresion cero verificada ejecutando las 33 suites de Candidate -1205 comprobaciones adicionales, 0 fallos- pese a que el riesgo ya era bajo por no haber tocado los dos archivos centrales. Dos aserciones de socialProviderClient.test.mjs que asumian que Instagram no tenia endpoints declarados se actualizaron a la nueva realidad sin debilitarlas, sumando una prueba positiva. Limitaciones declaradas: ScrapeCreators raspa web publica, historico no verificado, la muestra no equivale al total declarado, y el fallback solo pide perfil por ahora. Sin cambios en .env, T2 ni T3. Nueva §18-quinquadragies y docs/P-CAND-INSTAGRAM-FALLBACK-01.md. |
| 2026-09-01 | MEDIA-UX-HOME-01 | Media Intelligence deja de ser «Analizar publicacion»: esa pantalla pasa a ser una de sus nueve secciones y el modulo abre por su HOME del proyecto. 0 requests externos y 0 USD, porque la vista solo lee el Knowledge Lake. El vocabulario se fija ANTES que la metrica, que es el unico momento en que fijarlo sirve: PRESENCIA OBSERVADA y AMPLIFICACION OBSERVADA son recuentos auditables fila a fila, e INCIDENCIA se devuelve SIEMPRE sin valor con METODOLOGIA_EN_CONSTRUCCION y sus cuatro requisitos —existe como concepto para que nadie la sustituya por un conteo—, con el motivo calculado sobre datos reales y no generico: de 28 piezas, 26 no se pueden situar en el tiempo. Tres controles sostienen las cifras. AISLAMIENTO: el Lake real tiene Media de tres proyectos, dos de pruebas, y sumarlos habria puesto piezas inventadas en un panel de campana; el filtro es por proyectoId y el recuento de lo excluido VIAJA en la respuesta, verificado por HTTP contra un segundo proyecto real que devuelve 0 piezas y 0 filas. VIGENCIA: la pieza de X se reanalizo cuatro veces y contar filas convertiria «volver a mirar» en «mas presencia» —166 filas, 47 entidades—. CLAVE NORMALIZADA: la misma pieza vive bajo `https://x.com/…` y `x.com/…` por el defecto 6 de MEDIA-REAL-DEMO-01, y como el Lake es append-only no se borra sino que se colapsa al leer, declarando los colapsos. El caso que obligo a `medidaEnVentana()`: El Mercurio tiene 8 piezas y ninguna con fecha ISO, asi que la ventana HOY devolvia 0 y la fila se leia «no publico nada», lo contrario de lo que ocurre; ahora sin piezas es 0 y es una medicion, con piezas y ninguna datable es null + COBERTURA_INSUFICIENTE, y el ranking muestra dos columnas, ventana y corpus. Las fechas de buscador tipo «3 jul 2026» no se interpretan —`new Date` las da invalidas y un parser de meses en espanol situaria la pieza en una ventana que nadie observo—, y la fecha de DETECCION no sustituye a la de publicacion o una nota de 2023 caeria en HOY. `google.com` aparece con 7 piezas, mas que casi cualquier medio, porque SerpAPI envuelve los enlaces en `google.com/goto?url=`: no es un medio sino residuo de nuestro metodo, asi que sale del ranking a una lista de artefactos VISIBLE, porque ocultarlo seria tan malo como rankearlo. Ventanas reutilizando `dayWindow` de la linea territorial —HOY es dia calendario en America/Guayaquil y las cinco se alinean al mismo huso—, sin motor temporal paralelo, y filtran datos reales: HOY/7/15/30 situan 0 y 90d situa 1. No se uso `obtenerEventosProyecto` porque su proyeccion descarta `datos`, que es donde vive todo lo de Media, y ampliarla habria tocado un fichero compartido con Candidate y Territorial: cero ficheros del Lake modificados. Defecto encontrado por la validacion HTTP y corregido: `historialDePieza` filtraba `clase === "snapshot"` sobre el historial de VERSIONES, que no trae `datos`, asi que el historico volvia vacio con los snapshots guardados; era invisible porque el respaldo en memoria si los tenia y el hueco solo aparecia al reiniciar el backend. Verificado en proceso limpio: X devuelve 5 snapshots desde knowledge_lake con views 5.966, likes 13, comentarios 11, shares 6, quotes 0 y guardados 2, y El Mercurio 2. Cifras reales del piloto a 90d: 28 piezas, 10 fuentes originales, 4 medios, 1 periodista, 0 creadores, 1 institucion, 5 no clasificados, 2 candidatos, 28 evidencias; temas COBERTURA_INSUFICIENTE porque la amplificacion no persiste titular, territorio NO_DISPONIBLE porque GEO-1 lo resuelve por pieza y la fila no lo guarda. @tomebamba sigue NO_CLASIFICADO con su correspondencia OBSERVADA_NO_VERIFICADA: no se asciende a MEDIO. Sentinel AI NO implementado, solo declarado: 4 de 7 preguntas respondibles por la forma de la vista. UI construida y sin certificacion visual en navegador, que corresponde a MEDIA-UX-CERT-01. 134 pruebas de Media, suite completa 1.382, 0 fallos; suites de Media registradas en `npm test` via `test:media`. Nuevas §18-M1 a §18-M4, que recuperan ademas los tres gates de Media que el documento no tenia. |
| 2026-08-31 | SOCIAL-PROVIDER-REAL-02 | ScrapeCreators validado con datos reales desde Sentinel: 8 requests, 8 creditos, 86 restantes y 0 USD, sin tocar Bright Data. Cierra los tres huecos que Candidate arrastraba: Facebook de terceros, TikTok con metricas y —por primera vez en cualquier plataforma— TEXTO DE COMENTARIOS, con lo que Comments Intelligence pasa de «sin fuente» a «con fuente». Facebook Pedro Palacios en 3 llamadas: perfil con id estable, 57.000 seguidores y 57.624 likes que son cifras distintas y no se funden, tres publicaciones con reacciones y comentarios reales, y un desglose de reacciones por tipo que no es adorno —en una publicacion haha 325 supera a like 173, y un reactionCount agregado de 508 lo habria escondido entero—; comentarios 10 observados de 122 declarados, 8 con texto, y los 2 restantes contados aparte porque no se determino si son de solo imagen o un limite del proveedor. TikTok Yaku Perez en 3 llamadas: id estable, 519.300 seguidores, 5,2 M de likes y 357 videos —exactamente lo que oEmbed no daba, cerrando la otra mitad de P-CAND-TIKTOK-01—, diez videos con views, likes, comentarios y shares, y 20 comentarios de 110 todos con texto; TikTok si entrega shares y Facebook no. Rerun de 2 llamadas: sin duplicar, publicationId y commentId estables, firstObservedAt inmovil, lastObservedAt avanzando y observationCount subiendo, que es lo que de verdad decide porque unos IDs inestables convertirian cada ejecucion en datos nuevos. Tres ausencias que NO son la misma y que colapsadas harian creer que Facebook no da lo mismo en tres casos distintos: shares UNSUPPORTED porque el endpoint no tiene el campo, video_views NO_DATA porque se pidio sobre tres publicaciones que SI eran video y volvio null las tres veces, e historical UNVERIFIED porque no se pagino. Capacidades promovidas una a una: 6 de Facebook y 10 de TikTok a SUPPORTED, Instagram entero sigue sin verificar porque no se probo, y aprobar a ScrapeCreators no movio a Bright Data, SocialCrawl ni Data365, con test que lo comprueba. Lo que NO demuestra, dicho explicitamente: no es cobertura de los 7 candidatos —se midieron dos activos—, no es historico, y los corpus de comentarios son muestras y no el universo. El proveedor no bajo al dominio: candidateObservation y la matriz social no saben que existe, y el unico archivo con conocimiento especifico es el mapper. Dos cosas que la documentacion no decia y costaron una llamada: con trim=true los videos traen url y no share_url, y las fechas vienen en tres formatos distintos segun endpoint. La aprobacion del proveedor es un cambio de codigo con fecha y gate y no una variable de entorno, para que quede en el historial. La clave no aparece en URL, resultado, traza, error, persistencia ni documentacion, verificado sobre el volcado crudo y sobre el Lake, y el aislamiento de proyecto se comprobo contra los otros 5 proyectos. Riesgo declarado: raspa web publica, no es proveedor licenciado, y un proveedor puede desaparecer sin aviso como acaba de hacer Bright Data. package.json quedo sin commitear por seguir mezclando lineas de T1 y T3. 1311 pruebas, 0 fallos. Nueva §18-quadriquadragies y docs/SOCIAL-PROVIDER-REAL-02-SCRAPECREATORS.md. |
| 2026-08-31 | SOCIAL-PROVIDER-ALTERNATIVE-01 | Bright Data deja de ser camino critico: la cuenta sigue suspendida pese a la verificacion enviada y queda registrada en el codigo como BLOQUEADO_POR_PROVEEDOR, con 0 requests y 0 USD; no es un fallo de Sentinel ni del adapter ni del activo de Pedro Palacios, porque nunca se llego a hacer una llamada. El criterio que ordeno la busqueda dejo de ser quien tiene mejor cobertura y paso a ser a quien puedo probar hoy, y ese corte —alta autoservicio frente a llamada comercial previa— decide mas que cualquier tabla de features. Tres evaluados: ScrapeCreators queda #1 porque cubre los cuatro huecos con endpoints verificados uno a uno en documentacion publica con OpenAPI —Facebook profile, posts, comments y comment replies; TikTok profile, videos, comments y replies—, con 100 creditos gratis y sin tarjeta; SocialCrawl queda #2 con 24 endpoints de Facebook y 33 de TikTok, tambien 100 creditos sin tarjeta, y detalla menos los campos; Data365 queda fuera de la via rapida no por ser peor sino porque su documentacion de creditos llega despues de una llamada introductoria. Nada de esto es cobertura: los tres siguen UNVERIFIED_PROVIDER y ninguno documenta historico de comentarios, hueco que tendra que cubrir el Lake. La prueba real NO se ejecuto y se dice por que: los tres exigen API key y ningun endpoint funciona sin ella, y Sentinel no crea cuentas externas en nombre del usuario, asi que el gate entrega instrucciones en lugar de resultados; los activos que se usarian estan leidos del Lake y no inventados —facebook:pedropalaciosu y tiktok:yaku.perez—, descartando @lafondadecarrasco porque su atribucion quedo COMPATIBLE_NO_CONFIRMADA y probar con ella mezclaria si el proveedor sirve con si la cuenta es del candidato. Lo que si se construyo es la pieza que faltaba desde el PREP: socialProviderClient.js, generico a proposito porque un cliente escrito para Bright Data habria que tirarlo hoy, leyendo base, cabecera y endpoints del registro. Cuatro cosas fijadas por test: la guarda va antes de la red —hoy los cuatro proveedores devuelven llamadas 0 aunque se les pase bandera y clave—, no se inventan URLs, la clave viaja en cabecera y se redacta del resultado, la traza y el error incluido el caso en que el proveedor hace eco de ella, y los bloqueos no se confunden entre credencial, facturacion y cuota. Extraer armarPeticion y clasificarRespuestaHttp como piezas puras resolvio un problema real: la guarda exige proveedor aprobado, asi que sin separarlas no se podian probar sin aprobar a alguien de verdad o sin abrir un agujero en la guarda. Ejecutar la prueba ya no depende de escribir codigo sino de que exista una clave. Y una decision explicita: Candidate Intelligence NO espera al proveedor —X, YouTube e Instagram profesional siguen generando snapshots y las celdas pendientes quedan como REQUIERE_PROVEEDOR, que es un resultado y no un hueco—. 1272 pruebas, 0 fallos. Nueva §18-triquadragies y docs/SOCIAL-PROVIDER-ALTERNATIVE-01.md. |
| 2026-08-31 | SOCIAL-PROVIDER-REAL-01-PREP | Preparacion del limite de proveedor social externo mientras Bright Data sigue en revision: 0 requests externos y 0 USD. Al auditar los contratos antes de escribir nada aparecio que publicacion y metrica ya estaban resueltas desde P-CAND-03, asi que no habia que crear nada; lo que no existia era el contrato de COMENTARIO, y no existia porque hasta hoy ninguna via entregaba texto —Instagram lo niega con 400 code 100, Facebook cayo con /posts y TikTok no tiene via publica—. Se escribe ahora, antes de tener el dato, para que el dia que llegue no se invente una forma nueva bajo la presion de que ya hay payloads esperando. Nuevo commentObservation.js con commentId estable, relacion con el post, parentCommentId, y firstObservedAt que no se reescribe nunca; el autor se guarda sin perfilado —nombre visible e id de plataforma, lo minimo para deduplicar y contar participantes, sin cruzar con identidad real ni enriquecer ni puntuar, con la lista noSeHace en el propio objeto—; y el corpus separa siempre los comentarios que la plataforma DECLARA de los que se OBSERVARON, con la obligacion de lenguaje COMENTARIOS OBSERVADOS != TODOS LOS COMENTARIOS viajando en el dato y tres estados que se confunden facil: OBSERVADO, SOLO_RECUENTO y SIN_COMENTARIOS, que es un cero medido y no una ausencia. Nuevo externalSocialProvider.js como limite y no como motor: no hay ni un if sobre el nombre del proveedor, sino un registro y un normalizador que traduce cualquier payload al contrato existente con el mapa de campos pasado desde fuera; probado con dos formas distintas —Facebook plano y TikTok con stats.play_count anidado— produciendo el mismo contrato, y con un test que recorre el objeto entero comprobando que el nombre del proveedor solo aparece en campos de procedencia y nunca en la identidad, el contenido o el valor de una metrica. Nada de BrightDataFacebookEngine: un proveedor es una fuente, no un modelo. El estado UNVERIFIED_PROVIDER impide la mentira mas facil —las 27 capacidades declaradas de Bright Data estan sin verificar y estadoDeProveedores devuelve ningunoVerificado true—, porque que la documentacion diga que cubre Facebook no es cobertura y las celdas se moveran una a una tras medir. La bandera SOCIAL_EXTERNAL_PROVIDER_ENABLED queda documentada en .env.example y apagada, sin tocar .env, y encenderla no basta: hay test que la pone en true con clave ficticia y comprueba que Bright Data sigue deshabilitado por estar EN_REVISION, porque aprobar un proveedor es un cambio de codigo y no de configuracion para que quede en el historial de git. Tres fixtures sinteticos marcados TEST_FIXTURE y NO_REAL_DATA, uno de ellos con un comentario sin texto a proposito. 48 comprobaciones nuevas sobre lo que puede romperse en silencio: ausencia distinta de cero, 0 real conservado, IDs estables entre ejecuciones, firstObservedAt inmutable, texto anterior conservado si cambia, multi-activo, aislamiento de proyecto, proveedor desconocido rechazado y ninguna credencial persistida. Falta una sola pieza, el cliente HTTP; todo lo posterior ya esta probado. Nada de esto es cobertura: la decide SOCIAL-PROVIDER-REAL-01. 1248 pruebas, 0 fallos. Nueva §18-duoquadragies y docs/SOCIAL-PROVIDER-REAL-01-RUNBOOK.md. |
| 2026-08-31 | SOCIAL-PROVIDER-EVAL-01 | Evaluacion de proveedores para cerrar la cobertura social, 0 USD y 0 requests pagas: las unicas dos llamadas fueron a oEmbed de TikTok, gratuitas, para la auditoria de atribucion incluida en el gate. Cuatro proveedores evaluados contra los huecos reales y no contra su folleto —Facebook de terceros, metricas de TikTok, Instagram personal y texto de comentarios en las tres—: Bright Data cubre los tres huecos a la vez y es el unico con comment_text documentado en las tres plataformas, con precio publico ($1,50/1K y 5.000 registros al mes sin tarjeta), entrada por URL de Page de tercero y ventana historica por fechas en Facebook; Data365 tiene el desglose de reacciones mas rico —love, haha, wow, sad, angry, support, que para lectura politica es senal y no adorno— pero su precio NO es publico y exige llamada comercial antes de dar acceso; Apify es plan B barato con la cobertura sostenida por cada Actor y no por la plataforma, lo que con fecha de campana encima es un riesgo operativo real; y EnsembleData queda NO_APTO porque no cubre Facebook, que es la prioridad mas alta, asi que comprarlo dejaria abierto el hueco mas caro. Se registra ademas Meta Content Library, la via licenciada y de mejor defensa legal, para que la comparacion sea honesta: existe y su elegibilidad academica no nos admite. Comentarios como criterio de corte: solo Bright Data documenta comment_text en las tres plataformas, ninguno documenta historico de comentarios —hueco que tendra que cubrir el Lake— y un proveedor que solo entrega el conteo no es una solucion de Comments Intelligence. Lo legal se dice sin suavizar: los tres candidatos raspan web publica y ninguno es proveedor licenciado por Meta o TikTok, va contra los ToS aunque el dato sea publico y la continuidad no esta garantizada; lo que si se conserva es la citabilidad, porque los permalinks son canonicos. Es una decision de negocio y de riesgo que le corresponde al responsable del proyecto y no al gate. Arquitectura recomendada hibrida y no proveedor unico: X, YouTube e Instagram profesional por API oficial, identidad de TikTok por oEmbed gratis, proveedor solo para los huecos, e historico propio en el Knowledge Lake porque ninguna plataforma ni proveedor entrega serie temporal. El proveedor entraria como detalle de un adapter sobre el puerto que ya existe, sin ProviderFacebookEngine. Coste estimado del piloto, declarado como estimacion y no medicion, ~$39/mes con ronda semanal sobre 7 candidatos y tres plataformas, con el aviso de que el comentario es lo que manda el coste. Auditoria de atribucion TikTok resuelta dentro del gate: @lafondadecarrasco y @leomoralesordo existen las dos y ninguna queda confirmada —la primera es «La Fonda de Carrasco», un negocio de hosteleria, y medirla como cuenta del candidato le atribuiria actividad que no es suya—, y no se degrada ninguna porque la decision sobre un activo declarado es del analista. PPCA sigue en paralelo y no bloquea el MVP, con un hecho nuevo comprobado a mano: agregado el caso de uso de administrar la pagina, pages_read_user_content sigue sin aparecer como permiso seleccionable y no se regenero token a ciegas. Estado maximo alcanzado PROVEEDOR_CANDIDATO: que la documentacion diga que cubre Facebook no declara Facebook resuelto, y toda la comparativa se apoya en documentacion del proveedor, que es justo el tipo de afirmacion que este proyecto no acepta hasta medirla. Sin cambios de codigo. Nueva §18-unquadragies y docs/SOCIAL-PROVIDER-EVAL-01.md. |
| 2026-08-31 | P-CAND-FACEBOOK-01 | Cierre de Facebook: deja de ser una investigacion abierta. Tres llamadas Meta, 0 USD. Inventario de once activos —10 Pages y 1 Profile, un candidato SIN_CUENTA y cinco con dos activos, asi que el multi-activo es la norma—, con uno solo VERIFICADA por META_API: @jotalloretv, que es justo la Pagina que el token administra. El hallazgo cambia lo que se creia: hasta hoy se daba por hecho que sobre la Pagina propia funcionaba todo, porque META-THIRD-PARTY-REAL-02 la habia leido con 200, y lo que funcionaba era la METADATA. Las publicaciones no: GET /{page-id}/posts devolvio 400 (#10) «requires the pages_read_user_content permission or the Page Public Content Access feature», y ningun gate anterior habia pedido /posts. El token tiene pages_read_engagement y no pages_read_user_content. De ahi la distincion que cierra el gate: los dos 400 no se arreglan igual —sobre lo propio (#10) falta un PERMISO del token y se resuelve regenerandolo en minutos; sobre un tercero (#100) falta una FEATURE de la app y exige App Review y Business Verification—, y confundirlos manda a pedir revision cuando basta un token o al reves. Un matiz que el mensaje de Meta esconde: el error del tercero nombra pages_read_engagement como alternativa y el token YA lo tiene, porque ese permiso solo aplica a Paginas donde tenemos rol; para terceros solo sirve una feature. Esta vez el bloqueo se midio con un token de larga duracion validado y vivo, asi que queda descartado que la causa fuera la credencial. Lo que si llega de la Pagina propia: id, name, username, fan_count y followers_count —55.855 medido, y son dos cifras distintas que no se funden—, persistido con el contrato social existente y marcado MEDIDO_PROPIO_AUTORIZADO para que no cuente como cobertura. Cierre campo por campo: identidad y followers MEDIDO_PROPIO_AUTORIZADO; publicaciones BLOQUEADO_PERMISO_TOKEN sobre lo propio y REQUIERE_PPCA sobre terceros; reactions, comments_count, comment_text y shares NO_MEDIDO porque caen con la misma llamada; video_views NO_DISPONIBLE por ser OWNER_INSIGHT; historico NO_DISPONIBLE. La sonda de texto de comentarios viajaba anidada en /posts y cayo con ella, asi que Comments Intelligence sigue sin fuente confirmada en ninguna plataforma, aunque el contrato queda fijado por test para cuando el permiso exista. Nueva publicacionesDePaginaPropia en el adaptador que ya alberga la familia de graph.facebook.com, sin motor paralelo: pide el token DE LA PAGINA —las publicaciones no se leen con el del usuario— y ese token no se devuelve, no se registra y no aparece en la traza, con test que lo comprueba; pedir() acepta ahora un token explicito por esa razon. Decision de nombres fijada por test: reactions.summary cuenta todas las reacciones y se llama reactions y no likes, porque llamarlo likes inflaria los likes con enfados. Decision PPCA: SI pero EN PARALELO —es la unica via oficial a terceros y la que abre el texto de comentarios publicos, pero exige App Review y Business Verification y el plazo no lo controlamos, asi que no se bloquea la prueba de campana esperandola—; y antes que eso, regenerar el token con pages_read_user_content, que cuesta minutos y cierra la pregunta de los comentarios sobre la Pagina propia. ¿Suficiente para campana sin proveedor? NO: diez de once activos son de candidatos que no administramos y sobre ellos hoy no se obtiene ni el nombre de la Pagina. Huecos para SOCIAL-PROVIDER-EVAL-01 listados desde resultados medidos y no desde suposiciones, incluida la advertencia de que los perfiles personales probablemente no los cubra ni un proveedor y de que lo de Instagram que ya funciona no se compra. La ruta normal de Candidate NO cubre Facebook —observarCandidato no tiene rama— y no se cableo a proposito, porque hoy solo produciria un camino que sabe devolver un bloqueo. Tres aserciones antiguas cambiaron y ninguna se debilito: afirmaban que Facebook no tenia una sola medicion, y ahora tiene tres y se fija que las tres son PROPIA y que ninguna es de tercero. 1200 pruebas, 0 fallos. Nueva §18-quadragies. |
| 2026-08-31 | P-CAND-TIKTOK-01 | Factibilidad real de TikTok, 8 peticiones HTTP y 0 USD. Inventario: siete activos persistidos, uno por candidato, ninguno SIN_CUENTA y cero publicaciones previas; dos con correspondencia 0 —@lafondadecarrasco y @leomoralesordo— que quedan senalados como atribuciones sin sostener. Las tres APIs oficiales seguian sin aplicar y no se repitio la investigacion: Display API opera sobre la cuenta que inicia sesion, Research API es academica sin animo de lucro y Commercial Content API solo cubre publicidad; es la unica plataforma del grupo donde el problema no es un permiso que pedir ni un plan que pagar, porque el caso de uso no encaja en ningun programa. Lo nuevo es que la via publica SI entrega algo y quedo MEDIDA: oembed, endpoint publico documentado sin credencial y sin coste, devuelve sobre la URL de un perfil el nombre visible real, la URL canonica y el handle. Con control, que es lo que lo hace utilizable: dos handles inventados devolvieron HTTP 400, asi que un 200 es evidencia de existencia y no un 200 de cortesia —la leccion de META-COVERAGE-AUDIT-01, donde un clasificador dio «perfil» para Meta, BBC y NASA—. Y el nombre visible no es un eco del handle: @jotalloretv devuelve «Jota Lloret Valdivieso», lo que lo convierte en senal de identidad. El HTML publico tambien se midio: 200 con 1.462 bytes de armazon vacio, sin Open Graph y sin una cifra; no es bloqueo ni captcha, TikTok no sirve datos sin JavaScript, y sacar cifras de ahi exigiria ejecutar su JS o firmar sus peticiones, que es raspado evasivo y produce datos que no se pueden auditar ni citar. Prueba real sobre los dos activos de mejor identidad resuelta segun el expediente y de candidatos distintos, verificado contra el inventario en lugar de reutilizar @jotalloretv por costumbre: @yaku.perez y @jotalloretv, los dos CUENTA_CONFIRMADA con 200, persistidos con el contrato social existente y followers en null y no en 0. Nuevo tiktokAdapter.js deliberadamente pequeno, del tamano de la unica via que existe, con la lista de lo que no entrega viajando en cada resultado. Dos defectos encontrados por el camino: habilitaBenchmark miraba si habia ALGUNA celda MEDIDO, asi que marcar identidad habria metido TikTok al benchmark multicandidato sin un seguidor ni una metrica —ahora exige que lo medido sea una cifra, y X, YouTube e Instagram no se mueven porque las tres tienen metricas sobre terceros—; y la clave de los snapshots era candidato + plataforma + instante sin el activo, asi que un candidato con dos cuentas en la misma plataforma observadas en la misma ejecucion producia la MISMA entidad y el Lake devolvia solo la ultima, fallando en silencio con escrito true, el mismo defecto que META-THIRD-PARTY-REAL-02 encontro en guardarDeclaracionesDeTipo y que no afecta solo a TikTok: cualquier candidato con dos cuentas de X estaba perdiendo una de la serie; la lectura es por prefijo asi que no hay que migrar nada. Techo real: identidad sin metricas. Respuesta explicita a si basta para campana: NO —no hay una sola cifra, asi que no se puede decir si un candidato crece, que publica ni que rendimiento tiene—, y requiere SOCIAL-PROVIDER-EVAL-01 con alcance exacto: followers, publicaciones con permalink y fecha, views, likes, comments_count, shares, texto de comentarios, historico, limites de rate, estabilidad del contrato y licencia que permita citar el dato. No se contrato ni se integro nada. Cuatro aserciones antiguas cambiaron y ninguna se debilito: afirmaban que TikTok no tenia una sola medicion, y ahora tiene una y se declara cual es. 1165 pruebas, 0 fallos. Nueva §18-nonricies. |
| 2026-08-31 | P-CAND-IG-ROUTE-01 | Gate corto: hacer utilizable por la ruta normal el motor de Instagram que el gate anterior dejo funcionando. `POST /observar` no pasaba `idParaBusinessDiscovery` ni `cuentasPropias` a `observarCandidato`, asi que por HTTP `observarInstagram` devolvia NO_EJECUTABLE mientras el mismo motor medía sin problema desde un script. La causa raiz es mas interesante que el sintoma: los dos parametros no estan en el expediente porque se derivan del token, y el gate que construyo el motor los resolvio a mano en su propio script. Las 1101 pruebas en verde no lo vieron porque todas las suites de servicio los pasaban a mano tambien: probaban el motor, y el cableado no tenia prueba —un fallo que solo existe en la costura entre dos piezas no lo ve ninguna prueba que construya las piezas por separado—. Nuevo `metaObservationContext.js` con estados propios (RESUELTO, NO_REQUERIDO, SIN_CREDENCIAL, SIN_VINCULO_INSTAGRAM, ERROR), resuelto en el BACKEND porque los dos datos se derivan del token y hacerlo en el cliente exigiria mandarle la credencial de Meta al navegador; una sola llamada y solo si la ejecucion incluye Instagram, con test que fija que pedir me/accounts para observar YouTube no ocurre. Un activo personal declarado ya no gasta llamada, con la guarda en `observarInstagram` y no en la ruta para que alcance a todos los llamantes, y colocada ANTES del control de idParaBusinessDiscovery porque que una cuenta sea personal no depende de nuestra configuracion. Nuevo campo `procedenciaDelEstado`: el mismo NO_SOPORTADO_PERSONAL puede venir de una declaracion del analista (DECLARADA) o de un error de Meta (MEDIDA), y no valen lo mismo. La respuesta HTTP ya distingue tercero de propio —antes las dos eran «OBSERVADA» y en pantalla medir a un candidato y medir nuestra propia cuenta se veian igual— con alcanceDeLaMedicion, notaAlcance, procedenciaDelEstado y assetType. Defecto encontrado de paso: el lote de publicaciones se guardaba con provider youtube_data fijo, asi que un lote de Instagram quedaba etiquetado como de YouTube; ahora se deriva de lo observado. Nueva suite `igRoute.test.mjs` con 30 comprobaciones que monta el router de verdad y le habla por HTTP en un puerto efimero, simulando solo graph.facebook.com: es la prueba que recorre la costura, y fija las tres distinciones sobre una carga identica para las dos cuentas para que el alcance no pueda salir de la respuesta, que multi-asset sigue en pie, que la cuenta personal recibe cero llamadas y que observar dos veces no duplica. Prueba real por HTTP con Pedro Palacios: 200, MEDIDO_TERCERO, 9.718 seguidores, 5 publicaciones, persistido, con idempotencia comprobada ENTRE gates —firstObservedAt sigue en 15:53:08.897Z del gate anterior, lastObservedAt avanza a 17:06:16.410Z, 5 publicaciones sin duplicar, 4 lotes acumulados—. Deuda declarada y NO corregida: el puerto de adaptadores pregunta por estaConfigurado(), que significa «hay token de Instagram Login», mientras business_discovery viaja con el de Facebook Login; se fijo asi a proposito en META-FB-LOGIN-SETUP-01 y cambiarlo es una decision sobre familias de credenciales, no parte de este cableado. Hoy no muerde porque el .env tiene las dos, y morderia el dia que alguien despliegue con solo el token que esta via necesita. Estado de interfaz: BACKEND ROUTE FUNCIONAL y UI REAL NO EXPUESTA —el frontend no llama a /observar, y el boton «Observar cuentas» de ProjectsModule.jsx llama a /inteligencia, que es otro motor—; no se toco porque es alcance de un gate de UX. 1131 pruebas, 0 fallos, 2 llamadas Meta. Nueva §18-octricies. |
| 2026-08-31 | P-CAND-IG-MULTICANDIDATO-01 | Instagram pasa de motor a datos: primera medicion multicandidato de terceros, cuatro llamadas Meta en total. Antes del gate se determino que el PASO 5 ya estaba hecho y no constaba en ninguna parte —ni commit, ni log, ni este documento—: `debug_token` mostro un token emitido el 2026-08-31T05:06:31Z que caduca el 2026-10-30, unos 60 dias, con acceso a datos hasta el 2026-11-29 y los cinco permisos necesarios. No se regenero, y la caducidad queda escrita aqui porque vive en Meta y no en el repositorio, que es como se pierde. El contrato sigue siendo FACEBOOK_USER_ACCESS_TOKEN y no se creo variable nueva. De los doce activos de Instagram solo los tres elegibles gastaron llamada; los nueve declarados INSTAGRAM_PERSONAL no se consultaron porque `elegibilidadMeta` ya afirma que ninguna via oficial los abre y la llamada solo habria confirmado el contrato, asi que quedan NO_SOPORTADO_PERSONAL con procedencia DECLARADA y no MEDIDA, con la etiqueta puesta. Resultado: @pedropalaciosu y @yakuperezg MEDIDO_TERCERO con 9.718 y 83.233 seguidores, y @jotalloretv MEDIDO_PROPIO_AUTORIZADO con 10.822 porque aparece en me/accounts —la respuesta de Meta es identica a la de un tercero, mismo 200 y mismos campos, y sin esa comprobacion previa el gate habria contado tres terceros donde hay dos—. Quince publicaciones con permalink, timestamp y metricas; likes 12 DISPONIBLE y 3 NO_DISPONIBLE porque tres publicaciones de Lloret no traen like_count y quedan ausentes en lugar de en cero; comments_count medido en las quince, con dos ceros reales en Palacios; comments_text sigue NO_SOPORTADO por esta via hasta PPCA; reach, impressions, saved y shares no se pidieron por ser OWNER_INSIGHT. Dedup verificado sin gastar Meta reescribiendo el mismo lote: los lotes suben de 3 a 4 y las publicaciones se quedan en 5 con publicationId y evidenceId unicos. Instagram deja de ser NO_PROBADO en los siete candidatos y queda 1 MEDIDO, 1 PARCIAL, 1 MEDIDO_PROPIO y 4 NO_SOPORTADO, con las dos reglas del gate anterior cumplidas sobre datos reales: Yaku PARCIAL con uno de dos activos y Lloret MEDIDO_PROPIO sin contar como cobertura. X y YouTube se reconstruyeron de lo ya persistido en el Lake, sin volver a preguntar. habilitaBenchmark("instagram") sigue TRUE y este gate no lo cambio: lo respaldo, porque lo que antes sostenia un tercero genuino ahora lo sostienen dos. Riesgo estructural declarado: 9 de 12 activos son personales y ninguna revision de Meta los abre, asi que el techo de esta via son 3 de 12 y hoy se alcanzo entero. Detectado y no tocado: la ruta POST /observar no pasa idParaBusinessDiscovery ni cuentasPropias, asi que por HTTP Instagram devuelve NO_EJECUTABLE y falta cablear dos parametros. 1101 pruebas, 0 fallos. Nueva §18-septricies. |
| 2026-08-30 | P-CAND-SOCIAL-COVERAGE-01 | El gate iba a pasar Instagram de prueba a operacion sobre los siete candidatos y no llego a ejecutarse: el token de Facebook caduco entre gates, por cincuenta y seis segundos, porque los del Graph API Explorer viven alrededor de una hora y las pruebas anteriores duraban minutos. Es un hallazgo de operacion y no de arquitectura, y produjo la distincion que faltaba: CREDENCIAL_EXPIRADA no es CREDENCIAL_RECHAZADA, porque una manda a revisar de donde salio el token y la otra a conseguir uno de larga duracion —regenerar otro corto caduca igual—. Nuevo tokenDeLargaDuracion() para el intercambio a ~60 dias, que exige META_APP_ID y META_APP_SECRET y no intenta la llamada si faltan. Lo que si quedo construido: observarInstagram bajo el mismo contrato que observarX y observarYouTube, con una sola llamada por activo porque Meta permite anidar la muestra en el propio fields; el campo alcanceDeLaMedicion que separa MEDIDO_TERCERO de MEDIDO_PROPIO_AUTORIZADO y que NO sale de la respuesta de Meta —sobre una cuenta propia y una ajena la respuesta es identica, y ahi estuvo el riesgo del gate anterior— sino de cruzar el handle con me/accounts; el estado NO_SOPORTADO_PERSONAL, porque business_discovery solo responde sobre cuentas Business o Creator y leer ese error como CUENTA_NO_RESUELTA diria «no encontramos la cuenta» cuando la verdad es que la cuenta esta ahi y la via no la abre; Instagram registrado en el puerto de adaptadores, donde una sola funcion cumple las cuatro capacidades; matrizSocialDelProyecto con siete estados de celda que se niegan a colapsar en «sin datos», con dos reglas fijadas por test —dos de tres activos medidos es PARCIAL y no MEDIDO, y MEDIDO_PROPIO no cuenta como cobertura—; y evidenceId derivado del permalink, estable entre ejecuciones, que es lo que impide duplicar una publicacion al reobservar. Sobre Facebook se determino la via exacta: de las tres alternativas que Meta nombraba en su error, pages_read_engagement no aplica a terceros y Page Public Metadata Access esta sustituida, asi que solo queda Page Public Content Access, que exige App Review y Business Verification verbatim y en modo desarrollo solo alcanza Paginas cuyo administrador tenga rol en la app —exactamente lo medido—. No hay ningun cambio de configuracion que abra terceros sin revision. Y un dato que cambia la prioridad: PPCA habilita /page-post/comments, o sea texto de comentarios publicos, que Instagram no entrega; PPCA no es «tambien Facebook», es la condicion para que Comments Intelligence tenga fuente. Preparado docs/META-FB-PUBLIC-ACCESS-REQUEST.md sin enviar nada. 1101 pruebas, 0 fallos, 1 llamada Meta. Nueva §18-sextricies. |
| 2026-08-30 | META-THIRD-PARTY-REAL-02 | Reintento con la credencial correcta, siete llamadas. El hallazgo que casi rompe el gate llego en la llamada de prerequisito: `me/accounts` revelo que el token ADMINISTRA la Pagina del candidato patron y su Instagram vinculado, asi que las dos primeras sondas preguntaron por nuestro propio activo y devolvieron datos reales —10.821 y 55.859 seguidores— con cero evidencia sobre terceros. Un resultado positivo con el sujeto equivocado se lee exactamente igual que un exito, y sin esa llamada el gate habria declarado MEDIDO_TERCERO con evidencia de MEDIDO_PROPIO. Se repitio contra un candidato ausente de me/accounts. INSTAGRAM: MEDIDO_TERCERO — business_discovery devolvio username, name, followers_count 9.719, media_count 1.635 y cinco publicaciones con id, permalink, timestamp, media_type, like_count y comments_count; no volvieron follows_count ni view_count y no se pidieron los owner insights. FACEBOOK: BLOQUEADO_PERMISOS — la Page que administramos dio 200 y la de un tercero 400 code 100, con TRES alternativas nombradas por Meta que no cuestan lo mismo (pages_read_engagement, Page Public Content Access, Page Public Metadata Access) y sin mencionar Business Verification; esta si es causa demostrada porque el error llega a evaluar permisos. COMENTARIOS de Instagram PARCIAL: el recuento llega y el texto no, medido con un 400 code 100 al pedir comments{text} dentro de business_discovery.media, asi que Comments Intelligence sigue sin fuente por esta via. Tres activos pasan a META_API/VERIFICADA porque business_discovery solo responde sobre cuentas profesionales y responder ES la evidencia del tipo; los otros veinte quedan intactos. habilitaBenchmark("instagram") pasa a true con siete capacidades sobre un tercero genuino, el mismo baremo con el que entraron X y YouTube, mientras views y shares se quedan en PROPIO porque son OWNER_INSIGHT y no vinieron del tercero. Registrada una discrepancia con META-PUBLIC-ACCESS-01, que documentaba Advanced Access y Business Verification como obligatorios: la llamada funciono sin que consten, y POR QUE funciona no esta demostrado. Corregido un defecto encontrado de paso: guardarDeclaracionesDeTipo usaba candidato + fecha como clave de entidad, asi que dos lotes con el mismo declaradoEn colisionaban y el primero dejaba de leerse devolviendo escrito true. Once aserciones cambiaron y ninguna se debilito. 1076 pruebas, 0 fallos. Nueva §18-quintricies. |
| 2026-08-30 | META-FB-LOGIN-SETUP-01 | Gate de preparacion, cero llamadas Meta. El gate anterior concluyo «falta un token de Facebook Login», que era cierto y no era todo: el adaptador tenia UNA lista de variables y una sola funcion credencial(), y el token que devolvia se enviaba a los dos hosts. Eso es lo que produjo el 400 code 190, y habria sobrevivido a la solucion — al anadir el token de Facebook, graph.facebook.com habria seguido recibiendo el de Instagram porque era el primero de la lista, con el mismo 190 y la credencial correcta guardada al lado sin usarse, que es el peor caso posible porque parece que la configuracion ya esta hecha. Corregido: el token lo decide el host y no el orden de una lista, sin respaldo cruzado, y si falta el que toca la llamada no se hace —SIN_CREDENCIAL con llamadas 0 y la familia que falta—, porque contar una llamada que no salio falsearia el unico numero que este proyecto vigila. sanitizar() redacta ahora las dos familias, ya que el error de un host puede traer el token del otro y redactar solo uno lo dejaria a la vista precisamente en el mensaje que alguien va a copiar y pegar. Ocho pruebas antiguas cambiaron y no se debilitaron: pedian una respuesta simulada de graph.facebook.com y llegaban al fetch inyectado con un token que ese host nunca habria aceptado, asi que vivian del defecto sin saberlo. Documentada la credencial requerida por via —las dos comparten familia, Facebook User access token del flujo Facebook Login for Business, y no comparten permiso— y declarado que un token no resuelve el acceso: Standard Access alcanza solo a usuarios y Paginas con un rol en la app y un candidato nunca lo tendra, asi que el reintento seguira fallando, pero fallara con un error de permisos, que es informacion que hoy no existe. estadoDeCredenciales() lo declara en el dato: con el token presente, alcanza sigue vacio. App Review y Business Verification siguen TODAVIA NO DEMOSTRADOS porque ninguna llamada ha llegado a evaluar permisos, y la distincion entre «lo lei» y «lo medi» es la que sostiene los ultimos cuatro gates. 1059 pruebas, 0 fallos. Nueva §18-quatertricies. |
| 2026-08-30 | META-THIRD-PARTY-REAL-01 | Prueba quirurgica de si Sentinel puede observar hoy una cuenta de candidato tercero por via oficial de Meta, en cuatro llamadas y sobre los dos mejores activos posibles del expediente: un Instagram declarado INSTAGRAM_PROFESSIONAL y un Facebook declarado FACEBOOK_PAGE. No puede, y ahora se sabe por que. La llamada que aporta la informacion nueva es business_discovery contra graph.instagram.com, que nunca se habia probado: META-IG-REAL-01 lo habia medido contra graph.facebook.com y recibido un 190 que podia estar tapando otra cosa, y faltaba preguntar al host que SI acepta nuestro token. La respuesta fue HTTP 400 code 100, «Tried accessing nonexisting field (business_discovery)»: no es un permiso que falte, el campo no existe ahi, asi que la via de Instagram Login no descubre terceros y ningun permiso sobre este token lo va a producir. Un 400 asi es mejor que un 403 porque cierra la pregunta. La lectura de la Page de Facebook devolvio 190 OAuthException, y lo que eso demuestra es que no tenemos credencial para ese host; lo que NO demuestra —y es exactamente lo que se sobreinterpreta— es que haga falta App Review o Business Verification, porque el error se detiene antes de evaluar permisos, al parsear la credencial. Lo hace legible el control de la primera llamada: graph.instagram.com/me devolvio 200 con el mismo token en la misma sesion, asi que la credencial esta viva y el host es otro; sin ese control, «Invalid OAuth access token» manda a regenerar el token, que es justo lo que no hay que hacer. Comentarios: NO_PROBADO y no NO_DISPONIBLE, porque ninguna plataforma devolvio publicacion de tercero y no habia nada a lo que preguntar. Queda fijada la obligacion de lenguaje COMENTARIOS OBSERVADOS != TODOS LOS COMENTARIOS. Nada se persistio: cero publicaciones, cero snapshots, cero metricas, con un test que fija que una llamada bloqueada no puede devolver cifras en cero porque un cero es una medicion y la ausencia no lo es. habilitaBenchmark() sin cambios y las declaraciones del analista siguen NO_VERIFICADA. 1051 pruebas, 0 fallos. Nueva §18-tertricies y `docs/META-THIRD-PARTY-REAL.md`. |
| 2026-08-29 | P-CAND-ASSET-TYPE-UI-FIX-01 | El gate anterior reporto el selector de tipo Meta como hecho y no era falso: existia y funcionaba, pero en AccountIntelligencePanel, que es otra pantalla. Donde el analista edita cuentas —«Editar identidad digital», CandidateIdentityForm— no habia nada. Y detras habia un segundo fallo mas importante: la ruta GET /identidad que alimenta ese editor no devolvia los tipos, que solo viajaban por /inteligencia, asi que aunque el selector hubiera estado en el componente correcto no habria tenido con que pintarse; comprobado contra el backend en ejecucion, cuya ficha no traia activosMeta. Las 1037 pruebas no lo vieron porque ninguna miraba HTML: el dominio estaba bien y el fallo vivia entero en la distancia entre que la funcion devuelva el dato y que la pantalla lo pinte. Esa distancia ahora tiene prueba propia —identity-form.check.jsx renderiza la pantalla real con la respuesta real de la API y cuenta los select—. Corregido: /identidad devuelve activosMeta.porActivo con tipo, procedencia, verificacion y tipos admitidos, y el selector vive dentro de la tarjeta de cada cuenta, debajo del estado de identidad y separado de el, porque de quien es la cuenta y que clase de cuenta es son dos preguntas distintas. Se guarda al cambiarlo y no al pulsar «Guardar cambios», porque declarar el tipo no es una edicion de identidad y no debe viajar en el mismo PATCH. Validado por HTTP en un proyecto desechable con dos Facebook y dos Instagram: los cuatro tipos distintos sobreviven a releer la ficha, cambiar uno no movio a los otros y las cuentas quedaron identicas. De paso aparecio un defecto de accesibilidad que encontro la propia prueba de render: Lloret usa el mismo handle en Facebook y en Instagram, asi que dos selectores tenian etiqueta identica; ahora lleva la plataforma delante. habilitaBenchmark() sin cambios. 1042 pruebas de backend y 13 de render, 0 fallos. Requiere reiniciar el backend, que corre sin watcher. Nueva §18-duotricies. |
| 2026-08-28 | P-CAND-ASSET-TYPE-DECLARE-01 | La auditoria anterior clasifico 0 de 23 activos Meta y demostro que el HTML publico no distingue perfil de pagina ni Business de personal, asi que el camino no era afinar el clasificador: una persona que abre la cuenta lo ve en un segundo. Ahora el analista declara el tipo y Sentinel no llama a eso una verificacion. Tres campos que viajan juntos —assetType, assetTypeSource y assetTypeVerification— sostienen la regla ANALYST_DECLARATION != VERIFICADO_TECNICAMENTE, que es facil de escribir y facil de perder: basta con que alguien pinte un check verde al lado de un tipo declarado. Ninguna acumulacion de declaraciones asciende a VERIFICADA, porque solo lo hace una fuente de FUENTES_VERIFICADAS y hoy esa lista contiene unicamente META_API; PUBLIC_METADATA quedo fuera a proposito por lo que paso en la auditoria. Instagram admite INSTAGRAM_PROFESSIONAL ademas de Business y Creator, porque el analista suele saber que una cuenta es profesional sin saber cual de las dos y obligarle a elegir seria obligarle a inventar. Las declaraciones se guardan en una serie aparte del Lake y no dentro de cuentasReferencia: meterlas ahi habria hecho que cada clasificacion reescribiera el registro que sostiene la URL, el handle y el estado de identidad por un campo que no tiene nada que ver, y ademas se gana el historial —quien dijo que, cuando, y que dijo antes—. La cobertura pasa a tres niveles que no se suman: CONFIRMADA verificada contra API, DECLARADA dicha por el analista, DESCONOCIDA sin clasificar; un solo UNKNOWN devuelve al candidato a DESCONOCIDA y no tener cuenta en una plataforma es SIN_ACTIVO, no NO_ELEGIBLE. Ensayado con los dos Facebook de Lloret: admiten Page y Profile a la vez sin deduplicarse, el candidato pasa a DECLARADA por la pagina y su perfil sigue NO_ELEGIBLE. habilitaBenchmark() sin cambios, con un test que declara dos activos elegibles y comprueba que la funcion real no se mueve. 1037 pruebas, 0 fallos. Nueva §18-untricies. |
| 2026-08-28 | META-COVERAGE-AUDIT-01 | Auditoria de la cobertura potencial de Meta sobre los siete candidatos reales, antes de invertir en App Review. El hallazgo no fueron los numeros sino un control: la primera pasada clasifico once de once activos de Facebook como perfiles personales con confianza media, y al probar el mismo clasificador contra Meta, BBC News y NASA —paginas sin discusion— las tres salieron tambien «perfil». Los tokens usados como senal estan en el armazon que Facebook sirve sin sesion en cualquier URL: eran plantilla, 0 % de acierto con confianza media. Se retiro la senal y los once volvieron a UNKNOWN. Sin ese control el gate habria concluido «los 7 usan perfiles personales, Meta no cubre a nadie, no invertir»: firme, accionable y falsa. Inventario real: 23 activos Meta —12 de Instagram en los 7 candidatos y 11 de Facebook en 6—, con nueve casos de multi-activo, asi que el modelo 1:N lo usa la mayoria del universo. Clasificacion: 0 de 23. Facebook son todas URLs de vanidad y el HTML sin sesion devuelve og:type=video.other, que no distingue; Instagram devuelve og:type=profile, que no separa Business de personal. Cobertura confirmada 0/7, DESCONOCIDA 7/7, confirmadamente fuera 0/7 — y UNKNOWN no se suma a NO. Comparabilidad INDETERMINADA. Decision META-INVESTIGAR-MAS: la cobertura no es baja sino desconocida, lo que falta cuesta minutos frente a semanas de revision, y el coste de esperar es cero porque X y YouTube ya sostienen el benchmark. `habilitaBenchmark()` sin cambios, con tests que fijan que auditar no es medir. 1015 pruebas, 0 fallos. Nueva §18-tricies y `docs/META-COVERAGE-AUDIT.md`. |
| 2026-08-28 | P-CAND-FB-MULTI-ASSET-01 | Verificado con el expediente real que un candidato puede tener N activos por plataforma: Lloret tiene dos de Facebook y dos de Instagram, y los dos sobreviven persistencia, expediente, ficha e interfaz. La clave de identidad es plataforma + handle normalizado, asi que dos handles distintos son dos activos aunque compartan candidato, plataforma y nombre; no hizo falta corregir nada de persistencia ni de UI. El defecto aparecio en discovery: la propagacion de handles omitia la PLATAFORMA entera en cuanto tenia una cuenta atribuida, asi que el segundo activo de Facebook no se buscaba nunca por esa via. Corregido para omitir el par plataforma:handle, que conserva el ahorro de no repreguntar lo mismo y elimina el cierre falso. Nuevo `candidateAssets.js` que clasifica un activo solo con lo persistido: `/profile.php?id=` y `/people/` son perfil, `/pages/` y `/pg/` son pagina, y `og:type` decide si existe. Las dos URLs de Lloret son de vanidad y quedan UNKNOWN, que es la respuesta correcta: adivinar llevaria a esperar de un perfil algo que ninguna API entrega. La elegibilidad Meta se evalua POR ACTIVO —una pagina elegible no vuelve elegible al perfil del mismo candidato— y se declara que POTENCIALMENTE_ELEGIBLE no es MEDIDO_TERCERO ni habilita el benchmark. La relacion no se regala: solo con senal independiente se llega a OFFICIAL, y tener mas seguidores no asciende a nadie. El activo principal queda deliberadamente en null. 1007 pruebas, 0 fallos. Nueva §18-undetricies. |
| 2026-08-28 | META-PUBLIC-ACCESS-01 | Gate documental sobre la via oficial de Meta para terceros: cero requests, cero tokens, nada configurado. Confirmada con documentacion oficial la cadena completa —Advanced Access exige Business Verification, y `business_discovery` exige un Facebook User access token con Pagina vinculada, permisos y App Review—, lo que explica con fuente el error 190 del gate anterior: el host no sabe leer un token que no es suyo. Documentado lo que `business_discovery` SI devolveria de un tercero —username, name, followers_count, media_count, media, likes, comments y view_count— y lo que NO: reach, impressions, saved y shares no aparecen para terceros, asi que los cinco insights que obtuvimos de nuestra cuenta no existirian para un candidato. Page Public Content Access sigue vigente y Meta lista «analizar publicaciones e interaccion en Paginas» como caso admitido. La respuesta que decide la cobertura: las cuentas personales de Instagram y los perfiles personales de Facebook son inalcanzables por via oficial, y el candidato patron tiene precisamente un perfil personal. Prueba real NO ejecutada por decision: no tenemos el tipo de token requerido y probar a ciegas habria gastado una llamada para confirmar lo que la documentacion ya dice. Se anade `habilitaBenchmark()`, que convierte en funcion la regla de que solo MEDIDO_TERCERO habilita: ni medir la cuenta propia ni documentar la via de Meta ascienden una plataforma. Recomendacion: ruta hibrida, con el recuento de cuentas profesionales frente a personales como el dato que falta antes de invertir semanas en App Review. 975 pruebas, 0 fallos. Nueva §18-duodetricies y `docs/META-PUBLIC-ACCESS.md`. |
| 2026-08-28 | META-IG-REAL-01 | Primera prueba real de Instagram con la app propia y una cuenta profesional conectada. Cuatro requests, cero reintentos. La etapa A salio entera: perfil con los ocho campos pedidos, cinco publicaciones con permalink y timestamp, y los cinco insights —reach, saved, shares, total_interactions, views— devueltos sin excepcion. La etapa B se bloqueo: `business_discovery` respondio 400 con codigo 190, «Cannot parse access token». Leido literalmente eso manda a regenerar el token, y seria perder la tarde: el mismo token acababa de funcionar tres veces contra el otro host. El sintoma dice credencial y la causa es flujo — el token es de Instagram Login y ese endpoint solo acepta Facebook Login—, asi que se clasifica NO_SOPORTADO_POR_ESTA_CONFIGURACION con el requisito exacto que falta. El hallazgo de fondo fue otro: que nuestra cuenta respondiera a todo habria puesto Instagram en MEDIDO con la matriz anterior, y lo habria dejado entrar al benchmark multicandidato siendo falso, porque ninguno de los siete candidatos nos va a dar un token. La matriz ahora separa MEDIDO_PROPIO de MEDIDO_TERCERO en las cinco plataformas: Instagram tiene 8 propias y 0 de terceros; YouTube y X tienen 9 de terceros cada uno. Cada metrica declara ademas si es PUBLIC_METRIC u OWNER_INSIGHT, porque los cinco insights obtenidos no existirian para el Instagram de un candidato. No se persistio nada: `vocero593_` no es un candidato y meter sus publicaciones en el corpus habria contaminado el expediente. Cuatro tests dedicados a que el token no se filtre, incluido el caso en que Meta devuelve la peticion entera dentro del error. 967 pruebas, 0 fallos. Nueva §18-septemvicies. |
| 2026-08-28 | P-CAND-BENCH-01 | Primera linea base real T0 de los siete candidatos del proyecto, en X y YouTube. 10 requests de X y 6 unidades de YouTube: exactamente lo planificado. Lloret no se volvio a observar —sus datos eran de horas antes y repetirlos habria costado 5 llamadas para no aprender nada—, asi que su T0 son las observaciones de X-REAL-01 y P-CAND-03 con sus instantes reales. La regla de los retweets, aplicada a siete candidatos, dejo ver tres perfiles que una media unica habria borrado: Marcelo Cabrera republica 4 de 5 y no tiene rendimiento propio que medir —«—», no 0—; Pedro Palacios responde 4 de 5, que es conversacion y no publicacion; y solo Vega y Yaku tienen originales suficientes para comparar. La cobertura se expresa «2/5 plataformas objetivo medidas» y no en porcentaje, porque un 40 % supondria que las cinco plataformas pesan igual y no hay metodologia que lo sostenga. Cinco de siete candidatos quedan PARCIALMENTE_COMPARABLE: compararlos globalmente los perjudicaria por un hueco nuestro. Un defecto propio que encontro el expediente real: las publicaciones anteriores al contrato no traen `tipoPublicacion`, y `undefined` no es NO_DETERMINADO, asi que las cinco de Lloret se contaban en el total y desaparecian del desglose mostrando `orig: 0` —que se lee como «no publica nada propio»—. Ahora los buckets suman siempre el total y se declara que la columna esta vacia por desconocimiento. Tambien aparecio que Paul Carrasco tiene un channelId y no un handle, y que Yaku devolvio 4 publicaciones y no 5: el tamano de muestra se declara por candidato. Sin IPID, sin ranking, sin ganador: las observaciones son por plataforma y momentum es HISTORICO_INSUFICIENTE. 933 pruebas, 0 fallos. Nueva §18-sexvicies. |
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
