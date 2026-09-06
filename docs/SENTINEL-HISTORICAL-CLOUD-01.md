# SENTINEL-HISTORICAL-CLOUD-01 — Auditoría y diseño de histórico cloud 24/7

Terminal 4 — Data / Infrastructure / Disaster Recovery. Continúa
`SENTINEL-DR-SECRET-RECOVERY-01` (commit `ca2406c`). Modo: **auditar →
diseñar → implementar solo lo seguro → detenerse si requiere acción
humana.**

**Resultado de este gate: `STOP_INTERVENTION_REQUIRED`.** No existe ni
PostgreSQL/Supabase ni un runtime cloud configurado. Por regla explícita
del gate (CASO 4), no se inventaron cuentas, no se creó ningún servicio con
datos falsos, y no se tocó `package.json` para añadir una dependencia de
base de datos sin autorización previa. Este documento es el plan exacto,
más la auditoría completa que lo sustenta.

No se hizo push. No se tocó `SENTINEL_PROJECT_STATE.md`. No se tocó
Candidate/Territorial/Media/UX. Cero llamadas a proveedores externos
durante este gate.

---

## 1. Arquitectura encontrada (auditoría real, Fase A)

### 1.1 Variables de entorno (nombre y presencia únicamente, sin valores)

| Variable | Presencia | Set/Empty | Propósito |
|---|---|---|---|
| `DATABASE_URL` | ABSENTE | — | — |
| `POSTGRES_URL`/`POSTGRES_HOST`/`POSTGRES_PORT`/`POSTGRES_DATABASE`/`POSTGRES_USER`/`POSTGRES_PASSWORD` | ABSENTE (todas) | — | — |
| `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_DB_URL`/`SUPABASE_DATABASE_URL` | ABSENTE (todas) | — | — |
| `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`/`R2_ENDPOINT`/`R2_ACCOUNT_ID` | ABSENTE (todas) | — | La autenticación de R2 vive en `rclone.conf`, fuera de `.env`, por diseño de gates anteriores |
| `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` | ABSENTE | — | — |
| `AWS_*`/`S3_*` | ABSENTE (todas) | — | — |
| `SENTINEL_LAKE_ADAPTER` | ABSENTE en `.env` real | — | Solo existe en `.env.example` con default `fichero`; el código cae al default `"fichero"` si no está seteada (`lakeAdapter.js:302`) |
| `SENTINEL_BACKUP_RCLONE_REMOTE` | ABSENTE en `.env` | — | Intencional: vive solo en el wrapper de Task Scheduler / entorno del cron, nunca en `.env` ni en el repo |
| `CANDIDATE_SCHEDULER_ENABLED` | ABSENTE | — | El scheduler arranca por defecto; solo se desactiva con el valor literal `"false"` (`server.js:132`) |
| `PORT` | PRESENTE | SET | Config no sensible |
| `BRAVE_API_KEY`, `YOUTUBE_API_KEY`, `INSTAGRAM_ACCESS_TOKEN`, `FACEBOOK_USER_ACCESS_TOKEN`, `META_APP_ID`, `META_APP_SECRET`, `SCRAPECREATORS_API_KEY`, `X_BEARER_TOKEN`, `SOCIAL_EXTERNAL_PROVIDER_ENABLED` | PRESENTES | SET | Proveedores de datos (auditados por nombre en `SENTINEL-DR-SECRET-RECOVERY-01`) |
| `SERPAPI_KEY` | ABSENTE | — | El código real usa `SERPAPI_API_KEY` (alias aceptado), ya documentado en el gate de secretos |
| `META_API_VERSION` | ABSENTE | — | Usa el default `v23.0` del código |

**Conclusión: cero variables de PostgreSQL, Supabase, R2/S3/AWS/Cloudflare
existen en `apps/backend/.env`.** El sistema corre hoy exclusivamente sobre
el adaptador de fichero por default de código, no por configuración
explícita.

### 1.2 Adaptadores de datos

| Adaptador | Estado | Evidencia |
|---|---|---|
| `FILE_ADAPTER` (fichero) | **IMPLEMENTED** | `lakeAdapter.js:118-240`, JSONL append-only por partición diaria |
| `MEMORY_ADAPTER` (memoria) | **IMPLEMENTED** (solo dev/test) | `lakeAdapter.js:55-99` |
| `POSTGRES_ADAPTER` | **NOT_IMPLEMENTED** | No existe en `ADAPTADORES_DISPONIBLES` (`lakeAdapter.js:293-297`, solo `memoria`/`fichero`/`minio`); cero código `pg`/`Pool(` en todo `apps/backend` |
| `SUPABASE_ADAPTER` | **NOT_IMPLEMENTED** | Cero uso de `createClient`/`@supabase/supabase-js` en todo el árbol |
| `OBJECT_STORAGE_ADAPTER` (minio) | **PARTIAL** (stub declarado, no funcional) | `lakeAdapter.js:254-282`, cada método lanza excepción por diseño explícito |

**Hallazgo relevante:** un único comentario en
`services/media/mediaUniverseStore.js:55` dice *"T4 esta migrando a
PostgreSQL en paralelo"* — es una nota de **otra terminal (Media)**
escribiendo su módulo desacoplado del adaptador de almacenamiento,
anticipando este mismo gate. **No es evidencia de que la migración ya
empezó**: no hay ningún cliente, conexión, ni adaptador Postgres en el
código. Confirma que otras terminales ya diseñan pensando en esta
migración futura, lo cual es una buena señal para el diseño de la interfaz
(§3).

### 1.3 Inventario de datos locales

`apps/backend/data/`: **31 archivos, ~11 MB.**

| Carpeta | Archivos | Tamaño |
|---|---|---|
| `knowledge-lake/2026/08` | 10 | 4.3 MB |
| `knowledge-lake/2026/09` | 5 | 1.5 MB |
| `territorial-evidence/2026/08` | 2 | 472 KB |
| `territorial-evidence/2026/09` | 3 | 1.5 MB |
| `territorial-rss-rotation/2026` | 2 | 68 KB |
| `territorial-snapshots/2026/08` | 5 | 80 KB |
| `territorial-snapshots/2026/09` | 1 | 8 KB |
| `territorial-sources/2026` | 2 | 480 KB |
| `territorial-topics/2026` | 1 | 2.2 MB |

**No existe una carpeta `data/candidate/` ni `data/project/` separada** —
todo Candidate (proyectos, candidatos, expedientes, collection runs,
observaciones IPDO, ranking snapshots) vive dentro de
`data/knowledge-lake/`, escrito por `projectStore.js` vía `escribirEnLake`.
El crecimiento reciente (2.2 MB solo en `territorial-topics`, gate T2
`2093415`) confirma actividad concurrente real de otras terminales durante
este mismo periodo.

### 1.4 Candidate Scheduler — implementación real

`apps/backend/services/intelligence/candidateObservationScheduler.js`
(550 líneas, leído completo):

- **Arranque:** `server.js:13` importa `iniciarSchedulerGlobal`;
  `server.js:132-140` lo invoca dentro de `app.listen`, condicionado a que
  `CANDIDATE_SCHEDULER_ENABLED !== "false"` — **encendido por defecto**, y
  solo corre mientras este proceso Node de este equipo esté vivo.
- **Auto-enrollment dinámico**, dos niveles, ninguno hardcodeado:
  - Proyectos: `iniciarSchedulerGlobal` (línea 501) relee `listarProyectos()`
    cada `intervaloDeDescubrimientoMs` (default 15 min).
  - Candidatos: `resolverCandidatosActivos(projectId)` (línea 129) relee
    `contenidoDeProyecto(projectId)` en cada corrida y filtra
    `activo !== false` — **candidato #8 entraría sin cambiar código**.
- **Colectores:** `ejecutarObservacionDiaria` (línea 171) llama
  `collectCandidateSnapshots`, limitado a `PLATAFORMAS_COLECCION` menos
  `"tiktok"` (deuda documentada, línea 207).
- **Persistencia:** todo vía `projectStore.js` → `escribirEnLake`:
  `guardarCollectionRun` (3707), `guardarObservacionIPDO` (3734),
  `guardarRankingSnapshot` (3761). Sin base de datos separada.
- **Timezone:** `TIMEZONE_OPERACIONAL = "America/Guayaquil"` (línea 68),
  `fechaLocalObservacion` (línea 96) usa `Intl.DateTimeFormat` — **no está
  hardcodeado a UTC**, ya respeta el requisito de este gate (§37).
- **Idempotencia:** `yaSeColectoHoy(projectId, fecha)` (línea 112) relee
  `collectionRunsDe(projectId)` **desde el Lake persistido**, no desde
  memoria — sobrevive un reinicio de proceso a mitad del día. Lo que SÍ es
  solo memoria y no sobrevive un reinicio: el `setInterval`/temporizador de
  descubrimiento (`schedulers` Map, línea 410). La recuperación tras
  reinicio depende de que `iniciarSchedulerGlobal` vuelva a descubrir el
  proyecto y dispare un `tick()` inmediato (línea 455) — funciona, pero no
  es una cola de trabajo durable.
- **Collection run:** objeto completo (líneas 282-318) con
  `collectionRunId`, `startedAt/completedAt`, `localObservationDate`,
  `triggerType`, `status`, desgloses de presupuesto/activos/plataformas,
  `methodVersion`.
- **IPDO/ranking:** solo si `candidatosActivos.length >= 2` (línea 324);
  persistidos por candidato (`ipdoObservation`, línea 355) y una vez por
  corrida (`rankingSnapshot`, línea 373). Un fallo aquí no invalida el
  collection run ya persistido (línea 389).
- **Presupuesto:** `aplicarPresupuesto` (línea 150) tope `maxRequestsPerRun`
  (default 500), nunca gasta crédito de proveedor pago en corridas
  normales (línea 214-217) — coherente con el baseline real de "0
  créditos" del gate anterior de Candidate.

### 1.5 R2 / Backup — estado real

Scripts ya committeados y confirmados funcionando:
`backup-data-offsite.sh`, `restore-data-offsite.sh`,
`run-scheduled-backup.ps1`, `create-secret-recovery-package.sh`,
`upload-secret-package.sh`, `restore-secret-recovery-package.sh` (todos
auditados en gates anteriores, re-confirmados aquí).

Evidencia de ejecución real reciente:
`scripts/backup/logs/scheduled-backup-20260905-032534.log` →
`Resultado: EXITO`, 1.004.717 bytes subidos. `rclone.conf` **existe** en
este equipo (`%APPDATA%\rclone\rclone.conf`, solo existencia verificada,
nunca contenido). Paquete de secretos real ya presente
(`sentinel-secrets-20260903T223600Z.tar.gpg`).

**`R2_BACKUP = READY`** (evaluado por completitud de código/config y
evidencia de logs, no por una comprobación de conectividad en vivo dentro
de este gate, tal como exige la directiva).

### 1.6 Runtime / deployment — búsqueda exhaustiva

| Runtime | Config existente |
|---|---|
| Dockerfile / docker-compose.yml | NO ENCONTRADO |
| GitHub Actions (`.github/workflows/*`) | NO ENCONTRADO |
| railway.json / render.yaml / fly.toml / vercel.json | NO ENCONTRADO |
| Cloudflare Workers | NO ENCONTRADO |
| Supabase Edge Functions | NO ENCONTRADO |
| cron externo (cron-job.org u otro) | NO ENCONTRADO |
| Windows Task Scheduler | EXISTE — pero solo para el backup de datos, no para el scheduler de Candidate |

**No existe contenedorización, CI/CD, ni ejecución externa de ningún tipo.**
El único "scheduler" real fuera de este proceso Node es el backup diario de
datos, que es un caso completamente distinto.

### 1.7 Dependencias

`apps/backend/package.json`: `axios`, `cors`, `dotenv`, `express`,
`rss-parser`, `whois-json`. `apps/web/package.json`: `react`,
`react-dom`, `lucide-react`, `react-force-graph-2d` + toolchain de build.
**Cero** de `pg`, `postgres`, `@supabase/supabase-js`, `prisma`, `knex`,
`drizzle-orm`, `sequelize` en ningún `package.json` ni en
`package-lock.json` (grep completo, cero coincidencias transitivas).

**Consecuencia directa:** cualquier adaptador Postgres real necesita una
dependencia npm nueva. Por regla de este gate (§29), **esto exige detenerse
antes de tocar `package.json`** — ver §6 (DEPENDENCY_REQUIRED).

---

## 2. Arquitectura objetivo

```
                    SENTINEL CLOUD (objetivo, NO desplegado)
                         24/7
                          |
                 SENTINEL SCHEDULER
                          |
               +----------+----------+
               |                     |
         Candidate Jobs        futuros jobs
         (ya implementado,     (Territorial, Media,
          hoy solo local)       Reporting — no tocar
                                 en este gate)
               |
               v
            Collectors
         (ya implementado)
               |
               v
        Persistent Data Layer
               |
          PostgreSQL Cloud
        (NO EXISTE TODAVÍA)
               |
      +--------+---------+
      |                  |
 historical state     collection runs
 snapshots            IPDO observations
 ranking history      provenance
      |
      v
 Cloudflare R2
 (YA EXISTE Y FUNCIONA — backup/export/recovery)
```

**Lo único nuevo en esta arquitectura respecto a hoy es el bloque
"PostgreSQL Cloud" + un runtime que no sea este laptop.** Todo lo demás
(scheduler, colectores, lógica IPDO/ranking, R2) ya existe y ya funciona;
el problema es exclusivamente **dónde corre** y **dónde persiste**.

---

## 3. Modelo mínimo cloud (diseño, sin implementar — CASO 4)

Diseño de contrato, no migración ejecutada, no dependencia instalada.
Reutiliza exactamente los campos que ya produce
`candidateObservationScheduler.js` — no se inventan campos nuevos.

```sql
-- Requiere extensión pgcrypto o gen_random_uuid() nativo (PG13+)
-- para IDs, o reutilizar los IDs ya generados por el Lake (recomendado:
-- reutilizar, para que la migración sea trazable 1:1 con el JSONL origen).

CREATE TABLE IF NOT EXISTS projects (
  project_id      TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL DEFAULT 'sentinel-local',
  nombre          TEXT NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'activo',
  creado_en       TIMESTAMPTZ NOT NULL,
  payload         JSONB NOT NULL   -- resto de campos del proyecto, sin perder nada del original
);

CREATE TABLE IF NOT EXISTS candidates (
  candidate_id    TEXT NOT NULL,
  project_id      TEXT NOT NULL REFERENCES projects(project_id),
  tenant_id       TEXT NOT NULL DEFAULT 'sentinel-local',
  nombre          TEXT NOT NULL,
  activo          BOOLEAN NOT NULL DEFAULT true,
  agregado_en     TIMESTAMPTZ NOT NULL,
  payload         JSONB NOT NULL,
  PRIMARY KEY (project_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS candidate_assets (
  project_id        TEXT NOT NULL,
  candidate_id      TEXT NOT NULL,
  platform          TEXT NOT NULL,
  asset_id          TEXT NOT NULL,       -- canonicalAccountId
  activo            BOOLEAN NOT NULL DEFAULT true,
  payload           JSONB NOT NULL,
  PRIMARY KEY (project_id, candidate_id, platform, asset_id),
  FOREIGN KEY (project_id, candidate_id) REFERENCES candidates(project_id, candidate_id)
);

-- APPEND-ONLY. Nunca UPDATE de un run existente salvo transición de estado
-- controlada (ver "estado de un run" más abajo); nunca DELETE.
CREATE TABLE IF NOT EXISTS collection_runs (
  collection_run_id     TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL DEFAULT 'sentinel-local',
  project_id            TEXT NOT NULL,
  started_at            TIMESTAMPTZ NOT NULL,
  completed_at          TIMESTAMPTZ,
  local_observation_date DATE NOT NULL,       -- America/Guayaquil, calculado en el worker, no en la DB
  trigger_type          TEXT NOT NULL CHECK (trigger_type IN ('NORMAL_DAILY_RUN','FORCED_MANUAL_RUN')),
  status                TEXT NOT NULL CHECK (status IN ('SUCCESS','PARTIAL','FAILED','SKIPPED_ALREADY_COLLECTED')),
  candidates_planned    INT,
  candidates_observed   INT,
  assets_planned        INT,
  assets_observed       INT,
  platforms_attempted   JSONB,
  platforms_succeeded   JSONB,
  platforms_partial     JSONB,
  platforms_failed      JSONB,
  requests_used         INT,
  credits_used          INT,
  provider_breakdown    JSONB,
  errors                JSONB,
  limitations           JSONB,
  method_version        TEXT NOT NULL,

  -- IDEMPOTENCIA: la restricción real. Un NORMAL_DAILY_RUN no puede
  -- duplicarse para el mismo proyecto+día. Un FORCED_MANUAL_RUN SÍ puede
  -- coexistir con el normal del mismo día (es una corrida manual
  -- deliberada, distinta por diseño — igual que ya distingue el código
  -- actual). No se inventa un uniqueness que rompa las corridas forzadas.
  CONSTRAINT uq_normal_daily_run
    UNIQUE NULLS NOT DISTINCT (project_id, local_observation_date, trigger_type)
    -- Nota Postgres 15+: NULLS NOT DISTINCT. En versiones anteriores,
    -- lograr el mismo efecto con un índice único parcial:
    --   CREATE UNIQUE INDEX ... ON collection_runs (project_id, local_observation_date)
    --   WHERE trigger_type = 'NORMAL_DAILY_RUN';
);

CREATE TABLE IF NOT EXISTS candidate_asset_snapshots (
  snapshot_id       TEXT PRIMARY KEY,
  collection_run_id TEXT NOT NULL REFERENCES collection_runs(collection_run_id),
  project_id        TEXT NOT NULL,
  candidate_id      TEXT NOT NULL,
  platform          TEXT NOT NULL,
  asset_id          TEXT NOT NULL,
  observed_at       TIMESTAMPTZ NOT NULL,
  local_observation_date DATE NOT NULL,
  method_version    TEXT NOT NULL,
  provider          TEXT,
  coverage          JSONB,
  evidence_refs     JSONB,
  metrics           JSONB NOT NULL,   -- followers/views/interacciones tal como llegan, sin fusionar

  -- Un mismo asset no produce dos snapshots para el mismo run.
  UNIQUE (collection_run_id, project_id, candidate_id, platform, asset_id)
);

CREATE TABLE IF NOT EXISTS candidate_ipdo_observations (
  observation_id    TEXT PRIMARY KEY,
  collection_run_id TEXT NOT NULL REFERENCES collection_runs(collection_run_id),
  project_id        TEXT NOT NULL,
  candidate_id      TEXT NOT NULL,
  local_observation_date DATE NOT NULL,
  method_version    TEXT NOT NULL,
  score             NUMERIC,
  breakdown         JSONB,
  coverage          JSONB,

  UNIQUE (collection_run_id, project_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS candidate_ranking_snapshots (
  ranking_snapshot_id TEXT PRIMARY KEY,
  collection_run_id   TEXT NOT NULL REFERENCES collection_runs(collection_run_id),
  project_id          TEXT NOT NULL,
  local_observation_date DATE NOT NULL,
  method_version       TEXT NOT NULL,
  universe_candidate_ids JSONB NOT NULL,
  universe_size          INT NOT NULL,
  ranking                JSONB NOT NULL,   -- orden ya calculado, tal como lo produce el código actual

  UNIQUE (collection_run_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_runs_project_date ON collection_runs (project_id, local_observation_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_project_candidate ON candidate_asset_snapshots (project_id, candidate_id, local_observation_date);
CREATE INDEX IF NOT EXISTS idx_ipdo_project_candidate ON candidate_ipdo_observations (project_id, candidate_id, local_observation_date);
```

**Extensibilidad futura (Territorial/Media, NO implementada ahora):**
`territorial_observations`, `topic_observations`, `trend_radar_snapshots`,
`source_universe`, `media_observations`, `media_source_snapshots` seguirían
exactamente el mismo patrón (`project_id`/`tenant_id` obligatorios,
append-only, `UNIQUE` sobre la combinación natural de claves + fecha
operacional). No se crean estas tablas en este gate — solo se deja
constancia de que el esquema de arriba no las bloquea.

---

## 4. Migración — principio y verificación (diseño)

```
JSONL (data/knowledge-lake/**)
   |
   v
validar (esquema esperado por tipo de registro)
   |
   v
transformar (registro Lake -> fila de tabla, reutilizando IDs existentes)
   |
   v
insertar en PostgreSQL (idempotente: ON CONFLICT DO NOTHING sobre la PK/UNIQUE natural)
   |
   v
verificar (SOURCE_COUNT vs INSERTED vs ALREADY_PRESENT vs TARGET_COUNT)
   |
   v
habilitar adaptador cloud (SENTINEL_LAKE_ADAPTER=postgres, cuando exista ese adaptador)
```

**No destructivo:** el JSONL permanece intacto siempre; la migración solo
lee. **Idempotente:** reintentar el importador completo no duplica nada,
porque cada tabla tiene una restricción `UNIQUE`/PK natural derivada de
identificadores que YA existen en el JSONL (no se generan IDs nuevos para
registros que ya tienen uno). **No se ejecuta en este gate** — no hay
Postgres contra el cual correrlo.

---

## 5. Idempotencia y concurrencia cloud (diseño)

- **Un solo `NORMAL_DAILY_RUN` por `(project_id, local_observation_date)`**,
  garantizado por la restricción `UNIQUE` de §3 — a diferencia de hoy
  (`yaSeColectoHoy` relee y compara en aplicación, con una ventana de
  carrera teórica entre leer y escribir), la base de datos lo haría
  imposible aunque dos workers arrancaran al mismo tiempo.
- **Lock de concurrencia entre workers:** recomendado un *advisory lock* de
  PostgreSQL (`pg_try_advisory_lock(hashtext(project_id))`) tomado al
  iniciar el ciclo de un proyecto y liberado al terminar — si un segundo
  worker/pod/restart intenta el mismo proyecto mientras el lock está
  tomado, se retira sin intentar escribir. Alternativa equivalente: una
  tabla `job_leases` con `(project_id, leased_by, leased_until)` y
  `INSERT ... ON CONFLICT DO NOTHING`. Cualquiera de las dos es
  demostrable con una prueba de dos procesos concurrentes contra la misma
  fila.
- **Esto no está implementado** — es el diseño que resolvería
  `CLOUD_CONCURRENCY_LOCK`, hoy `NOT_VERIFIED` porque no hay cloud.

---

## 6. `DEPENDENCY_REQUIRED` — STOP antes de tocar `package.json`

Por regla explícita de este gate (§29), me detengo aquí en vez de editar
`apps/backend/package.json`:

- **Dependencia necesaria:** un cliente PostgreSQL para Node — la opción
  más simple y estándar es `pg` (el driver oficial, sin ORM). Alternativas
  evaluadas: `postgres` (driver más nuevo, buen soporte de tipos), `knex`
  (query builder, añade una capa), `prisma`/`drizzle-orm` (ORMs completos,
  más pesados de lo que este caso necesita — el modelo de arriba es simple
  y no requiere un ORM).
- **Recomendación: `pg`**, por ser el driver estándar de facto, mínimo,
  ampliamente usado en Node, y suficiente para un adaptador que solo
  necesita `INSERT ... ON CONFLICT` y `SELECT`s simples — coherente con
  "no introducir dependencia pesada innecesaria" (§28 del gate).
- **NO se instaló.** Requiere autorización humana explícita antes de tocar
  `package.json`, ya marcado en gates anteriores como archivo
  históricamente compartido/conflictivo entre terminales.

---

## 7. Comparación de runtime 24/7 (sin elegir ni comprar)

Ninguno de los tres tiene configuración existente en el repo — comparación
basada en compatibilidad conocida con un proceso Node de larga duración,
sin inventar precios exactos.

| Criterio | Railway | Render | Fly.io |
|---|---|---|---|
| Proceso Node siempre activo | Sí (worker/service) | Sí (background worker) | Sí (VM persistente) |
| Deploy desde GitHub privado | Sí | Sí | Sí (vía `fly deploy`, típicamente con Dockerfile) |
| Requiere Dockerfile | No obligatorio (Nixpacks detecta Node) | No obligatorio (build nativo) | Generalmente sí (o buildpack) — este repo no tiene Dockerfile hoy |
| Variables de entorno/secrets | Sí, panel propio | Sí, panel propio | Sí, vía `fly secrets` |
| Logs | Sí, integrados | Sí, integrados | Sí, integrados |
| Health checks | Sí | Sí | Sí |
| Complejidad de setup inicial | Baja | Baja | Media (requiere `fly.toml` + típicamente Docker) |
| Lock-in | Bajo (es solo Node) | Bajo | Bajo, pero el flujo Docker-first añade fricción si no se quiere mantener un Dockerfile |

**Recomendación primaria: Railway.** Menor fricción para desplegar el
`server.js` actual tal cual, sin Dockerfile nuevo. **Alternativa: Render**,
prácticamente equivalente en simplicidad, buena opción si Railway no
conviene por algún motivo de cuenta/región. **Fly.io se descarta como
primera opción** solo por requerir más trabajo de empaquetado (Docker) que
los otros dos para el mismo resultado — no por incompatibilidad.

**Cloudflare Workers explícitamente NO elegido**: no soporta un proceso
Node de larga duración con conexión persistente a Postgres y `setInterval`
de la forma en que el scheduler actual está escrito (modelo de ejecución
por request, no de proceso persistente) — habría exigido reescribir el
scheduler, que este gate explícitamente no debe hacer.

**Supabase explícitamente NO elegido como runtime** — es candidato para la
base de datos (Postgres gestionado), no para correr el worker Node.

---

## 8. Coste (estimación cualitativa — `PRICE_VERIFICATION_REQUIRED`)

No se navegó a ningún sitio externo para verificar precios vigentes, por
regla explícita del gate. Categorías a presupuestar cuando se verifique en
vivo:

- **PostgreSQL/Supabase**: normalmente existe un tier gratuito/de entrada
  de bajo coste adecuado para el volumen actual (~11 MB, cientos de filas)
  — `PRICE_VERIFICATION_REQUIRED` antes de decidir tier.
- **Runtime worker** (Railway/Render): normalmente tienen un tier de
  entrada de bajo coste para un solo proceso pequeño siempre activo —
  `PRICE_VERIFICATION_REQUIRED`.
- **R2**: ya auditado en `SENTINEL-DATA-PERSISTENCE-01` — free tier
  generoso (10 GB, 1M/10M operaciones Clase A/B), el uso actual está muy
  por debajo. No requiere reverificación en este gate.
- **APIs de proveedores** (SerpAPI, Meta, etc.): sin cambio — el scheduler
  ya opera en corridas normales con 0 créditos pagos, confirmado en el
  baseline real de Candidate.

**No se compró ni contrató nada en este gate.**

---

## 9. Veredictos obligatorios

```
LOCAL_FILE_PERSISTENCE           = READY
R2_BACKUP                        = READY
POSTGRES_ADAPTER                 = NOT_IMPLEMENTED
POSTGRES_CONNECTION              = NOT_CONFIGURED
SUPABASE_CONNECTION              = NOT_CONFIGURED
HISTORICAL_CLOUD_SCHEMA          = PARTIAL   (diseñado en §3, no creado en ninguna DB real)
MIGRATION_TOOL                   = NOT_READY (diseño en §4, no hay código ni DB destino)
MIGRATION_STATUS                 = NOT_STARTED
CLOUD_RUNTIME                    = NOT_CONFIGURED
CLOUD_SCHEDULER                  = NOT_READY
CLOUD_DAILY_OBSERVATION          = NOT_VERIFIED
DYNAMIC_CANDIDATE_ENROLLMENT_CLOUD = NOT_VERIFIED (verificado en LOCAL, ver §1.4; no en cloud porque no existe cloud)
MULTI_ASSET_CLOUD                = NOT_VERIFIED
CLOUD_IDEMPOTENCY                = NOT_VERIFIED
CLOUD_CONCURRENCY_LOCK           = NOT_VERIFIED
PROJECT_ISOLATION_CLOUD          = NOT_VERIFIED
R2_DB_BACKUP                     = PENDING (no hay DB todavía que respaldar)
LOCAL_RUNTIME_DEPENDENCY         = YES
PC_CAN_BE_OFF_WITHOUT_MISSING_DAILY_CANDIDATE_OBSERVATION = NO
```

---

## 10. Respuestas literales obligatorias

**A. ¿Dónde se guarda hoy el histórico vivo de Sentinel?**
En `apps/backend/data/knowledge-lake/` (JSONL append-only), vía el
adaptador de fichero del Knowledge Lake. Candidate, Territorial y Media
comparten ese mismo mecanismo — no hay una base de datos separada para
ninguno.

**B. ¿Dónde quedará el histórico vivo después de este gate?**
En el mismo lugar que antes: `apps/backend/data/knowledge-lake/`. Este
gate no migró nada porque no existe destino cloud configurado
(`POSTGRES_CONNECTION = NOT_CONFIGURED`).

**C. ¿R2 es la base de datos principal del histórico?**
**NO.** R2 es backup/archivo/recuperación (ya en uso, funcionando). El
histórico vivo transaccional sigue siendo el JSONL local; el destino
objetivo para eso es PostgreSQL, no R2, tal como esta misma directiva
establece explícitamente (§11 del gate).

**D. ¿Puedo apagar mi computador esta noche y Sentinel seguirá creando la
observación diaria de Candidate?**
**NO.** No existe runtime cloud ni base de datos cloud configurados; el
scheduler de Candidate depende por completo de que `server.js` siga
corriendo en este equipo.

**E. Si el worker cloud falla durante dos días, ¿Sentinel inventará
snapshots de esos días al volver?**
**NO.** Ni hoy ni en el diseño propuesto. El mecanismo de idempotencia
(§1.4, §5) solo permite recuperar el run pendiente del día actual si el
proceso se reinicia dentro del mismo día operacional; días completos
perdidos deben registrarse como un hueco (`OBSERVATION_GAP`), nunca
rellenarse con valores fabricados — el propio código actual ya sigue este
principio (no hay ninguna ruta que "rellene" un día perdido con datos
inventados).

**F. ¿El candidato #8 seguirá entrando automáticamente en cloud?**
**TODAVÍA NO VERIFICADO** — el mecanismo de auto-enrollment ya está
implementado y verificado en local (§1.4: `resolverCandidatosActivos` relee
el proyecto en cada corrida, sin hardcodear candidatos), y el diseño del
esquema cloud (§3) no introduce ninguna lista fija de candidatos que
rompería esto. Pero no puede certificarse "en cloud" porque no hay cloud
donde probarlo todavía.

**G. ¿Los JSONL locales serán eliminados?**
**NO.** Ni en este gate ni en el diseño de migración (§4, principio
no-destructivo explícito).

**H. ¿Ya podemos empezar Momentum?**
**NO.** No existe histórico temporal real suficiente, y este gate no
cambia esa realidad — solo prepara el camino para que ese histórico pueda
acumularse sin depender de que la laptop esté encendida.

---

## 11. Health, alertas, cutover, rollback — diseño (no implementado)

- **Health:** un endpoint simple (`/health` o script CLI) que reporte
  `UP/DOWN` del worker, `last successful run`, `next expected run`, `last
  failure`, conteo de candidatos/assets, requests usados — suficiente
  según la propia directiva ("no construir dashboard grande"). No
  implementado en este gate porque no hay worker cloud que exponga nada
  todavía.
- **Alertas:** hook conceptual para `daily run FAILED`, `run missing`,
  `provider auth expires`, `credits low` — documentado como trabajo de un
  gate futuro, sin introducir un proveedor de alertas nuevo ahora.
- **Cutover** (cuando cloud exista de verdad): (1) DB cloud lista, (2)
  migración verificada con conteos coincidentes, (3) worker cloud
  desplegado y con al menos una corrida real exitosa, (4) desactivar
  `CANDIDATE_SCHEDULER_ENABLED` local (`=false`), (5) worker cloud activo
  como única fuente, (6) verificar health, (7) verificar que el siguiente
  run programado ocurre, (8) conservar todos los datos locales, (9)
  confirmar que el backup offsite sigue corriendo.
- **Rollback:** si el cloud falla, reactivar `CANDIDATE_SCHEDULER_ENABLED`
  local, mantener el JSONL como estaba, no perder las observaciones cloud
  ya válidas (quedan en Postgres, se reconcilian después por
  `collection_run_id`/IDs naturales, nunca se sobrescriben).

---

## 12. Runbook (comandos reales, existentes, verificados)

```bash
# Ver estado local del Lake (conteo, integridad, dimensiones)
cd apps/backend && node -e "import('./services/knowledgeLake/lakeQuery.js').then(m => m.estadoLake().then(console.log))"

# Ver backups offsite existentes (requiere rclone configurado)
rclone lsl r2-sentinel:sentinel-backups

# Ejecutar el backup manual de datos
bash apps/backend/scripts/backup/backup-data-offsite.sh

# Ejecutar un restore de prueba (NUNCA sobre apps/backend/data en producción)
bash apps/backend/scripts/backup/restore-data-offsite.sh /tmp/algun-directorio-vacio

# Crear el paquete cifrado de secretos (passphrase interactiva)
bash apps/backend/scripts/secrets/create-secret-recovery-package.sh
bash apps/backend/scripts/secrets/upload-secret-package.sh

# Deshabilitar el scheduler local de Candidate (una vez exista alternativa cloud)
# En apps/backend/.env:
#   CANDIDATE_SCHEDULER_ENABLED=false

# Habilitar de nuevo (rollback)
#   CANDIDATE_SCHEDULER_ENABLED=true   (o eliminar la línea, es el default)
```

**No existen todavía** (porque no existe cloud): comandos para migrar,
verificar conteos cloud, ver collection runs/snapshots/IPDO/ranking desde
Postgres, ver salud del worker cloud, activar/detener el worker cloud. Se
documentarán en el gate en que esa infraestructura exista de verdad — no
se inventan aquí.

---

## 13. Limitaciones y pendientes

1. Sin Postgres/Supabase configurado — bloqueante para todo lo demás.
2. Sin runtime cloud configurado — bloqueante para "PC apagado, Sentinel
   sigue observando".
3. Añadir `pg` requiere tocar `apps/backend/package.json` — requiere
   autorización humana explícita (§6).
4. El esquema de §3 es diseño, no ha sido creado ni probado contra ninguna
   instancia real de Postgres.
5. El scheduler actual, aunque ya es "cloud-restart-safe" en su lógica de
   idempotencia (lee de almacenamiento persistente, no de memoria), su
   temporizador de descubrimiento sigue siendo un `setInterval` en memoria
   de proceso — migrarlo a un runtime cloud con reinicios/redeploys
   frecuentes necesitará el lock de concurrencia de §5 para ser seguro de
   verdad.
6. `R2_DB_BACKUP` (backup de la futura base Postgres hacia R2) queda
   `PENDING` — no hay DB que respaldar todavía.

---

## STOP_INTERVENTION_REQUIRED

**QUÉ FALTA:** una instancia de PostgreSQL gestionado (Supabase u
equivalente) y un runtime cloud para correr un proceso Node de larga
duración (Railway recomendado, Render como alternativa). Ninguno de los
dos existe hoy.

**POR QUÉ:** sin ambos, es imposible que "el PC pueda estar apagado y
Sentinel siga observando" — es literalmente la definición del objetivo de
este gate, y no puede lograrse sin crear cuentas/servicios reales, lo cual
esta directiva prohíbe hacer automáticamente.

**DÓNDE HACER CLICK (Supabase):**
1. Ir a `supabase.com` → crear cuenta / iniciar sesión.
2. "New Project" → elegir organización → nombre del proyecto (sugerido:
   `sentinel-intelligence`) → elegir una contraseña segura para la base de
   datos (generarla con un gestor de contraseñas, no reutilizar ninguna
   existente) → elegir la región disponible más cercana a Ecuador/LATAM
   que ofrezca el panel (documentar cuál se eligió realmente, no asumir
   una).
2.1. Confirmar tier: **Pro** como mínimo si esto va a producción real
   (Free no tiene backups automáticos, ver `SENTINEL-DATA-PERSISTENCE-01`
   §A.3).
3. Una vez creado, ir a Project Settings → Database → copiar la cadena de
   conexión (`Connection string`, modo "Session" o "Transaction pooling"
   según se decida).

**QUÉ CREAR:** el proyecto Supabase descrito arriba. Nada más — no crear
tablas manualmente todavía, eso lo hace la migración cuando este gate
continúe.

**QUÉ VARIABLE CONFIGURAR:** `DATABASE_URL` (o `POSTGRES_URL`, a decidir en
el siguiente gate) en `apps/backend/.env` — **nunca pegar el valor en este
chat**, configurarla directamente en el archivo `.env` local.

**CÓMO VERIFICAR:** una vez configurada, decir "ya configuré
DATABASE_URL" — el siguiente gate la detectará por presencia (`PRESENT`),
nunca pidiendo ver el valor.

**QUÉ NO COMPARTIR:** la contraseña de la base de datos, la cadena de
conexión completa, ninguna clave de servicio (`service_role`) de Supabase.

**DÓNDE HACER CLICK (runtime, Railway recomendado):**
1. `railway.app` → crear cuenta / iniciar sesión con GitHub.
2. "New Project" → "Deploy from GitHub repo" → seleccionar
   `DavidFierro23/Sentinel-Intelligence` (requiere autorizar el acceso de
   Railway al repo privado — un permiso de GitHub, no un secreto de
   Sentinel).
3. **No desplegar todavía** — solo conectar el repo. El siguiente gate
   configurará el comando de arranque, variables de entorno y el `root
   directory` (`apps/backend`) antes de un primer deploy real.

**QUÉ MENSAJE PEGAR DESPUÉS PARA CONTINUAR:**

> "Ya creé el proyecto Supabase y configuré DATABASE_URL en
> apps/backend/.env. Ya conecté el repo a Railway (sin desplegar
> todavía). Continúa SENTINEL-HISTORICAL-CLOUD-01: implementa el
> adaptador Postgres, corre la migración, y prepara el deploy."

Ese mensaje autoriza además, implícitamente, a tocar `apps/backend/package.json`
para añadir `pg` — si no es así, decirlo explícitamente al continuar.

---

# ADDENDUM — Continuación tras Supabase + Railway creados (commit `bb031f8`)

Usuario confirmó: proyecto Supabase creado, `DATABASE_URL` configurada en
`apps/backend/.env`; proyecto Railway creado, repo conectado, servicio
`OFFLINE`, sin deployment. Autorización explícita para tocar
`apps/backend/package.json` únicamente para añadir `pg`.

## Dependencia

`pg@^8.23.0` — no existía ninguna dependencia equivalente (reconfirmado).
Añadida a `apps/backend/package.json` mediante `npm install pg --workspace
apps/backend`, aislando el cambio del resto del archivo (que tenía una
modificación ajena sin commitear en la sección `scripts.test`) con `git add
-p`, para no incluir esa modificación ajena en el commit.

## 1. Verificación de conexión PostgreSQL

`DATABASE_URL=PRESENT`. Host: pooler de Supabase (`*.pooler.supabase.*`),
puerto `:6543` → **Transaction Pooler**, no Session Pooler (discrepancia
con lo indicado en el mensaje del usuario — se reporta tal como se
observó, no como se asumió). Usuario en formato `postgres.<project-ref>`,
correcto para el pooler.

**Resultado de la conexión real: `CONNECT_OK=false`.**
`ERROR_SANITIZED=password authentication failed for user "postgres"`
(mensaje del propio Postgres, sanitizado — sin cadena de conexión, sin
contraseña). El formato del URI se verificó estructuralmente sin leer su
contenido (exactamente 1 `@`, exactamente 2 `:` antes del `@`, sin
artefactos de doble-codificación) — no hay evidencia de un error de
formato; el rechazo es a nivel de autenticación real. Reconfirmado dos
veces en momentos distintos de este gate, mismo resultado ambas veces.

**Diagnóstico más probable:** contraseña incorrecta o desactualizada (p.
ej., copiada antes de un reseteo, o con un error de tipeo). No se puede
determinar más sin ver el valor, lo cual este gate no hace.

**Recomendación:** en el dashboard de Supabase → Project Settings →
Database → **Reset database password** → copiar la nueva cadena de
conexión completa (no reescribirla a mano) → pegarla directamente en
`apps/backend/.env`, reemplazando la actual.

Script permanente y reutilizable para repetir esta verificación en
cualquier momento, sin exponer secretos:
`apps/backend/scripts/migrations/check-postgres-connection.mjs`.

## 2. Compatibilidad del pooler

**Confirmada por diseño, no por conexión en vivo** (bloqueado por el punto
1): `postgresAdapter.js` usa exclusivamente `pool.query(texto, valores)`
con parámetros posicionales, nunca sentencias con nombre
(`client.query({ name, text, values })`). node-postgres no cachea una
sentencia preparada del lado del servidor a menos que se le pida
explícitamente un `name` — el patrón usado aquí es seguro bajo PgBouncer
en modo transacción, donde cada consulta puede caer en una conexión de
backend distinta. El script de verificación además prueba explícitamente
una consulta parametrizada en una SEGUNDA conexión del pool
(`SECOND_CONNECTION_PARAM_QUERY_OK`), que es exactamente el escenario que
fallaría si hubiera un problema real de compatibilidad — pendiente de
poder ejecutarse hasta resolver el punto 1.

## 3. Adaptador PostgreSQL — implementado

`apps/backend/services/knowledgeLake/postgresAdapter.js`. Reemplazo
directo del adaptador de fichero (misma interfaz
`anexar/leerTodos/contar/particiones/estado`), registrado en
`lakeAdapter.js` (`ADAPTADORES_DISPONIBLES` + `case "postgres"`), **sin
tocar** `lakeQuery.js`, `projectStore.js`,
`candidateObservationScheduler.js`, ni ningún código de
Candidate/Territorial/Media. Una sola tabla genérica `lake_records`
(JSONB + columnas promovidas para índices), no tablas tipadas por
dominio — evita reescribir cualquier lógica existente.

`lakeWriter.js` recibió un único cambio aditivo: capturar
`VersionConflictError` (lanzado solo por el adaptador postgres) y
traducirlo a `{escrito:false, conflictoDeVersion:true, reintentable:true}`
— el mismo patrón que ya existe para "sin cambios". Los adaptadores
memoria/fichero nunca lanzan este error, así que su comportamiento es
idéntico a antes (confirmado: los 16+5+2+5 tests existentes de
`persistencia.test.mjs` y `tests/storage/*` siguen en verde sin
modificación).

## 4. Migraciones — no destructivas

`apps/backend/scripts/migrations/001_lake_records.sql`. Solo `CREATE TABLE
IF NOT EXISTS`/`CREATE INDEX IF NOT EXISTS`. Sin `DROP`. **No aplicada
contra ninguna base real** — bloqueado por el punto 1. Rollback lógico:
no hay nada que deshacer en la base (nunca se ejecutó); volver atrás en
código es simplemente no seleccionar `SENTINEL_LAKE_ADAPTER=postgres`.

## 5. Importación JSONL → PostgreSQL — idempotente, validada en `--dry-run`

`apps/backend/scripts/migrate-jsonl-to-postgres.mjs`. Ejecutado en modo
`--dry-run` (sin tocar ninguna base de datos) contra los datos reales
locales:

```
SOURCE_COUNT=914
CLAVES_UNICAS=911
REGISTROS_SIN_CAMPOS_OBLIGATORIOS=0
```

**Hallazgo importante, no fabricado ni ignorado:** 914 registros pero solo
911 combinaciones únicas de `(claveEntidad, version)` — **3 colisiones
reales de versión ya existen en el JSONL de producción actual**, la misma
condición de carrera confirmada empíricamente (de forma sintética) en
`SENTINEL-DATA-PERSISTENCE-01`. Investigado sin imprimir contenido:

| tipoEntidad | proyectoId | version | copias | hashes distintos |
|---|---|---|---|---|
| persona | osint-investigacion-adhoc | 2 | 2 | 2 (contenido genuinamente distinto) |
| persona | osint-investigacion-adhoc | 1 | 2 | 2 (contenido genuinamente distinto) |
| documento | catalogo-proyectos | 2 | 2 | 2 (contenido genuinamente distinto) |

Los tres pares tienen **hashes distintos** — no son duplicados exactos,
son dos escrituras concurrentes reales que calcularon el mismo número de
versión para la misma entidad, exactamente el bug ya documentado. **La
migración, tal como está diseñada, insertaría solo la PRIMERA de cada par
(por orden de lectura del JSONL) y trataría la segunda como
`ALREADY_PRESENT`** vía `ON CONFLICT DO NOTHING` — lo cual es seguro
(no corrompe nada, no lanza excepción) pero significa que el contenido de
la segunda escritura de cada par **no llegaría a Postgres** tal como está.
Esto no es peor que el estado actual (el lector del Lake ya tiene que
elegir una de las dos versiones ambiguas hoy), pero se marca aquí como
`MIGRATION_INVARIANT_WARNING` — una decisión sobre qué hacer con estos 3
pares (¿conservar ambas bajo una clave sintética adicional? ¿investigar
cuál es la versión "correcta"?) debe tomarse en un gate dedicado de
integridad de datos, no improvisarse aquí.

**No se ejecutó la migración real** (requiere conexión, bloqueada por el
punto 1).

## 6. Conteos e invariantes: local vs PostgreSQL

**No verificable todavía** — no hay tabla creada ni datos insertados en
ningún Postgres real. `MIGRATION_STATUS = NOT_STARTED`.

## 7. Idempotencia / lock distribuido para el scheduler cloud

**Diseño implementado y probado sin DB real** (`tests/storage/
postgresAdapterContract.test.mjs`, 5/5 PASS): la restricción `UNIQUE
(clave_entidad, version)` de la tabla `lake_records` **es** el mecanismo
de lock distribuido — dos workers/pods/restarts que intenten crear el
mismo `NORMAL_DAILY_RUN` para el mismo proyecto+día competirían por la
misma fila; solo el primero en comprometer la transacción gana, el
segundo recibe `VersionConflictError` → `{escrito:false,
conflictoDeVersion:true}`, sin duplicar nada y sin lanzar una excepción no
controlada.

**No se modificó `candidateObservationScheduler.js`** para invocar
explícitamente este mecanismo — por diseño de este gate (restricción
explícita de no alterar lógica de Candidate). El mecanismo ya protege
automáticamente cualquier escritura que pase por `escribirEnLake` una vez
que el adaptador activo sea `postgres`, sin necesitar ningún cambio en el
scheduler: la protección vive en la capa de almacenamiento, no en la
lógica de negocio. Verificado con un adaptador simulado que lanza
`VersionConflictError` (no con dos procesos reales concurrentes contra
Postgres, porque no hay Postgres real accesible todavía).

## 8. Enrollment dinámico y multi-asset

**Sin cambios** — `candidateObservationScheduler.js` no fue tocado. La
auto-inscripción de candidatos y el modelo multi-asset siguen exactamente
como se auditaron en la Fase A original (§1.4 de este documento): releen
el proyecto desde el Lake en cada corrida, sin listas hardcodeadas. Como
el adaptador es transparente para ellos, seguirán funcionando igual bajo
`postgres` que bajo `fichero` — pero esto es una inferencia de diseño, no
`VERIFIED` en cloud, porque no hay cloud real corriendo todavía.

## 9. Timezone

**Sin cambios** — `TIMEZONE_OPERACIONAL = "America/Guayaquil"` para la
lógica diaria ya estaba correcto (§1.4). El almacenamiento en
`lake_records` usa `TIMESTAMPTZ` (UTC internamente en Postgres, como
corresponde), y `particion`/`local_observation_date` se calculan en la
aplicación exactamente igual que hoy — no se introdujo ninguna
dependencia del timezone del servidor cloud.

## 10. File adapter disponible para rollback

**Sí, sin cambios.** `SENTINEL_LAKE_ADAPTER=fichero` (o simplemente no
setear la variable) sigue siendo el comportamiento por defecto exacto de
antes de este gate. El adaptador postgres es aditivo, nunca reemplaza al
de fichero salvo que se seleccione explícitamente.

## 11. Railway — configuración real determinada (no inventada)

- **Root Directory recomendado: la raíz del repositorio**, NO
  `apps/backend` — porque el proyecto usa **npm workspaces**
  (`workspaces: ["apps/*", "packages/*"]` en el `package.json` raíz), y
  resolver dependencias correctamente (incluyendo `pg`, recién añadido)
  requiere que `npm install`/`npm ci` corra desde la raíz.
- **Build Command real: `npm ci`** (usa `package-lock.json`, ya
  actualizado con `pg` en este gate, para una instalación reproducible).
- **Start Command real, ya existente, sin inventar nada nuevo:**
  `npm run dev:backend` — script YA definido en el `package.json` raíz
  (`"dev:backend": "npm run dev --workspace apps/backend"`), que a su vez
  ejecuta `"dev": "node server.js"` de `apps/backend/package.json`. Es
  exactamente el mismo comando que ya se usa en desarrollo local — no se
  inventó un comando nuevo para producción.
- **Compatibilidad de puerto confirmada:** `server.js:119` usa
  `process.env.PORT || 3001` — compatible de fábrica con el puerto que
  Railway inyecta automáticamente.

### Variables que Railway necesitará (SOLO nombres, nunca valores)

| Variable | Ya existe en `.env` local | Notas |
|---|---|---|
| `DATABASE_URL` | Sí (con el problema de auth del punto 1) | Debe corregirse antes de copiar a Railway |
| `SENTINEL_LAKE_ADAPTER` | No (usa default `fichero` hoy) | Debe configurarse como `postgres` en Railway para que el cloud use la DB, no un fichero local que no existiría ahí |
| `BRAVE_API_KEY` | Sí | proveedor |
| `YOUTUBE_API_KEY` | Sí | proveedor |
| `INSTAGRAM_ACCESS_TOKEN` | Sí | proveedor Meta |
| `FACEBOOK_USER_ACCESS_TOKEN` | Sí | proveedor Meta |
| `META_APP_ID` | Sí | proveedor Meta |
| `META_APP_SECRET` | Sí | proveedor Meta |
| `SCRAPECREATORS_API_KEY` | Sí | proveedor social externo |
| `X_BEARER_TOKEN` | Sí | proveedor X |
| `SOCIAL_EXTERNAL_PROVIDER_ENABLED` | Sí | feature flag |
| `SERPAPI_API_KEY` | Sí | proveedor web principal |
| `PORT` | Opcional | Railway inyecta el suyo automáticamente; no hace falta configurarlo a mano |

**No se creó ningún servicio en Railway ni se desplegó nada en este
gate.**

## 12. Pruebas ejecutadas en este gate

| Prueba | Resultado |
|---|---|
| `tests/persistencia.test.mjs` (existente, sin tocar) | 16/16 PASS, sin regresión |
| `tests/storage/lakeRestartPersistence.test.mjs` (existente) | 5/5 PASS |
| `tests/storage/lakeConcurrentWrites.test.mjs` (existente) | 2/2 PASS (mismo veredicto RIESGO ya documentado para el adaptador de fichero, sin cambio — este gate no modifica ese comportamiento del adaptador de fichero) |
| `tests/storage/lakeProjectIsolation.test.mjs` (existente) | 5/5 PASS |
| `tests/storage/postgresAdapterContract.test.mjs` (nuevo, sin DB real) | 5/5 PASS |
| `migrate-jsonl-to-postgres.mjs --dry-run` contra datos reales | Ejecutado, ver §5 — sin escritura, sin conexión |
| `check-postgres-connection.mjs` contra Supabase real | Ejecutado dos veces, `CONNECT_OK=false` ambas veces, error sanitizado |

**Requests a proveedores externos durante todo este gate: 0** (SerpAPI,
Meta, Brave, X, YouTube, ScrapeCreators — ninguno se invocó). **No se
ejecutó una segunda observación Candidate real del día.**

## 13. Bloqueo restante

**Único bloqueo real: la contraseña de `DATABASE_URL` es rechazada por
Supabase.** Todo el código, esquema, importador y adaptador están listos
para correr en el momento en que esa credencial se corrija — no se
requiere ningún cambio de código adicional para eso, solo corregir el
valor en `.env` (o, si se prefiere, en el propio Supabase resetear la
contraseña y pegar la nueva cadena completa).

## Veredictos actualizados de este addendum

```
POSTGRES_ADAPTER          = IMPLEMENTED (no probado contra DB real)
POSTGRES_CONNECTION       = PARTIAL (presente, alcanzable a nivel de red, credencial rechazada)
SUPABASE_CONNECTION       = PARTIAL (mismo motivo)
HISTORICAL_CLOUD_SCHEMA   = PARTIAL (SQL escrito, no aplicado)
MIGRATION_TOOL            = READY (idempotente, validado en --dry-run contra datos reales)
MIGRATION_STATUS          = NOT_STARTED (bloqueado por conexión)
CLOUD_RUNTIME             = PARTIAL (proyecto Railway creado, repo conectado, servicio OFFLINE, sin deploy)
CLOUD_SCHEDULER           = NOT_READY
CLOUD_DAILY_OBSERVATION   = NOT_VERIFIED
DYNAMIC_CANDIDATE_ENROLLMENT_CLOUD = NOT_VERIFIED
MULTI_ASSET_CLOUD         = NOT_VERIFIED
CLOUD_IDEMPOTENCY         = PARTIAL (mecanismo implementado y probado con adaptador simulado, no con Postgres real)
CLOUD_CONCURRENCY_LOCK    = PARTIAL (mismo motivo -- la restricción UNIQUE es el lock, no probada en vivo)
PROJECT_ISOLATION_CLOUD   = NOT_VERIFIED
R2_DB_BACKUP              = PENDING
LOCAL_RUNTIME_DEPENDENCY  = YES
PC_CAN_BE_OFF_WITHOUT_MISSING_DAILY_CANDIDATE_OBSERVATION = NO
```

**No se hizo push. No se desplegó nada en Railway.**

---

# ADDENDUM 2 — Segunda corrección de credencial, todavía falla

Usuario reseteó la contraseña en Supabase, volvió a copiar la cadena
completa, y seleccionó explícitamente **Session Pooler** (no Transaction
Pooler). No se compartió ninguna credencial.

## Verificación sanitizada

`DATABASE_URL=PRESENT`. **`POOLER_MODE=Session Pooler`,
`POOLER_PORT=5432`** (confirmado por patrón: NO se encontró `:6543`, SÍ se
encontró `:5432` y el host `pooler.supabase.*`) — el usuario corrigió
exactamente lo que se le pidió.

**Verificaciones estructurales adicionales, todas limpias** (sin ver el
valor): exactamente 1 `@`, exactamente 2 `:` antes del `@`, sin comillas
sobrantes al inicio/fin del valor, esquema `postgres(ql)://` correcto,
sin CR/salto de línea residual al final de la línea, **project-ref de
exactamente 20 caracteres** (el formato real de Supabase) presente en el
usuario `postgres.<project-ref>`. No hay ningún indicio de error de
formato, copiado parcial, o comillas accidentales.

## Resultado de conexión

**`CONNECT_OK=false`, mismo error: `password authentication failed for
user "postgres"`.** Sanitizado, sin secretos. Esta es la TERCERA vez que
se prueba en este gate (dos con Transaction Pooler, una con Session
Pooler tras reseteo), con el mismo resultado exacto las tres veces.

**Por regla explícita del gate, al ser `CONNECT_OK=false` no se ejecutó
ninguno de los pasos posteriores** (migraciones, importación, conteos,
auditoría de colisiones contra una base real, segunda importación,
pruebas de idempotencia contra Postgres real). Esos pasos siguen listos
para correr en cuanto la conexión funcione — no requieren ningún cambio de
código adicional.

**Diagnóstico:** dado que el formato es estructuralmente correcto en las
tres pruebas y el error es específicamente de autenticación (no de
resolución de host, no de TLS, no de "base de datos no existe"), las
causas más probables, en orden: (1) la propagación del reseteo de
contraseña en Supabase puede tardar hasta 1-2 minutos en aplicarse al
pooler compartido — reintentar tras una espera corta; (2) posible copia
desde un proyecto Supabase distinto al que se reseteó (si existe más de
un proyecto); (3) un carácter especial en la contraseña que el propio
panel de Supabase no haya URL-codificado al mostrar la cadena (esto
ocurre si se elige una contraseña personalizada en vez de la generada
automáticamente). No se puede diagnosticar más sin ver el valor.

## Punto 5 — ¿Es `UNIQUE(clave_entidad, version)` suficiente como lock del daily run?

**Hallazgo real, investigado en el código, sin necesitar conexión a
DB:** en `candidateObservationScheduler.js:184`:

```js
const collectionRunId = `run-${projectId}-${localObservationDate}-${ahora.getTime()}`;
```

**`ahora.getTime()` es un timestamp de reloj de pared, no determinista.**
Esto significa que el `entidad`/`claveEntidad` de un `collectionRun` en el
Lake **no es el mismo** para dos ejecuciones del mismo proyecto en el
mismo día — cada invocación genera una clave distinta. Consecuencia
directa: **`UNIQUE(clave_entidad, version)` NO protege contra dos
`NORMAL_DAILY_RUN` concurrentes del mismo proyecto+día**, porque ambos
workers escribirían bajo claves de entidad *diferentes*, cada una con su
propia versión 1 — la restricción nunca se activaría, porque nunca
colisionan a nivel de clave.

**Lo que hoy evita el duplicado es únicamente la comprobación de
aplicación** `yaSeColectoHoy()` (relee `collectionRunsDe(projectId)` antes
de empezar) — un patrón de "leer, decidir, escribir" con una ventana de
carrera real entre el momento en que dos workers leen "todavía no
recolectado" y el momento en que ambos empiezan a escribir. Es exactamente
la clase de problema que un lock distribuido está pensado para cerrar, y
hoy no está cerrado a nivel de base de datos.

**`DISTRIBUTED_DAILY_LOCK_READY = NO`** — el diseño de `lake_records` por
sí solo no lo resuelve.

### Dos opciones, ninguna implementada todavía

**Opción A — recomendada, no toca `candidateObservationScheduler.js`:**
un *advisory lock* de PostgreSQL
(`pg_try_advisory_lock(hashtext(projectId || ':' || localObservationDate))`)
tomado por el worker cloud (en un futuro punto de integración, fuera de
este gate) antes de decidir si corre el `NORMAL_DAILY_RUN` del día, y
liberado al terminar. No requiere cambiar cómo se genera
`collectionRunId` ni ningún otro campo del scheduler — es una capa
adicional alrededor de la decisión de "¿corro hoy o no?", no un cambio a
qué se persiste.

**Opción B — más simple pero SÍ toca Candidate:** cambiar
`collectionRunId` para que sea determinista por
`(projectId, localObservationDate, triggerType)` **solo para
`NORMAL_DAILY_RUN`** (ej. `run-${projectId}-${localObservationDate}-NORMAL_DAILY_RUN`,
sin timestamp), dejando `FORCED_MANUAL_RUN` con su timestamp actual (para
que corridas forzadas repetidas sigan siendo distinguibles, como ya exige
el diseño existente). Esto haría que la restricción `UNIQUE(clave_entidad,
version)` capturara el duplicado automáticamente, sin necesitar ningún
lock adicional — pero es un cambio de una línea dentro de
`candidateObservationScheduler.js:184`, lógica de Candidate.

**No se implementó ninguna de las dos en este gate.** Por instrucción
explícita del usuario, cualquier cambio a
`candidateObservationScheduler.js` requiere demostrar la necesidad primero
y detenerse a pedir autorización — esto es exactamente esa demostración.
Recomendación: Opción A antes del cutover cloud, porque no introduce
ningún riesgo sobre la lógica de Candidate ya validada con datos reales.

## Veredictos de esta ronda

```
CONNECT_OK                     = false
POOLER_MODE                    = Session Pooler
POOLER_PORT                    = 5432
MIGRATIONS_OK                  = NO_EJECUTADO (bloqueado por CONNECT_OK=false)
TABLES_CREATED                 = ninguna
JSONL_SOURCE_COUNT              = 914 (sin cambio, dry-run previo)
POSTGRES_COUNT                  = N/A (no hay Postgres accesible)
COLLISIONS_FOUND                = 3 (detectadas en el dry-run anterior contra el JSONL local)
COLLISIONS_PRESERVED            = NO_APLICABLE_TODAVIA (no se ha corrido el importador contra una DB real; el mecanismo de preservación explícita -- ver diseño pendiente -- aún no se implementó porque no hay conexión contra la cual probarlo)
SECOND_IMPORT_INSERTED           = N/A (no hubo primera importación real)
IDEMPOTENCY_CERTIFIED            = NO
APPEND_ONLY_CERTIFIED            = NO (certificado solo con adaptador simulado, no con Postgres real)
DISTRIBUTED_DAILY_LOCK_READY      = NO (hallazgo nuevo: la clave de collectionRun no es determinista por día -- ver arriba)
```

**No se hizo push. No se hizo deploy. No se tocó
`candidateObservationScheduler.js`.**

---

# ADDENDUM 3 — Conexión restablecida, migración real ejecutada y certificada

Tras el Addendum 2, un reintento posterior (probablemente por demora de
propagación del reseteo de contraseña en el pooler compartido de
Supabase, ~horas después) tuvo éxito:

```
CONNECT_OK=true
PG_VERSION=17.6
PARAM_QUERY_OK=true
SECOND_CONNECTION_PARAM_QUERY_OK=true
```

Confirmado con **Session Pooler, puerto 5432**, tal como el usuario
configuró.

## Migraciones aplicadas

Ambos archivos SQL (`001_lake_records.sql`, `002_lake_records_version_conflicts.sql`)
aplicados contra la base real. **Tablas creadas y verificadas:**

```
TABLES_CREATED = lake_migration_log, lake_records, lake_records_version_conflicts
LAKE_RECORDS_CONSTRAINTS = lake_records_pkey, uq_lake_records_entidad_version
```

## Primera corrida real de importación

```
SOURCE_COUNT=914
INSERTED=907
ALREADY_PRESENT=0
COLLISIONS_PRESERVED=3
FAILED=4
TARGET_COUNT=907
```

**Los 4 fallos fueron reales y se diagnosticaron con precisión**: 4
registros de tipo `publicacion` (piezas de medios, `elmercurio.com.ec`)
tienen `fechaHecho` almacenado como texto no-ISO (`"23 ago 2023"`, fecha
en español sin parsear) en vez de una fecha real — un problema de calidad
de datos **preexistente en el JSONL de origen**, no introducido por esta
migración. Postgres, correctamente, rechazó ese valor para una columna
`TIMESTAMPTZ`.

**Corrección aplicada** (en `postgresAdapter.js`, código propio de este
mismo gate, no en Candidate/Media): `fechaHecho` ya es un campo opcional
en el modelo del Lake (`lakeWriter.js` lo trata como `?? null` sin validar
formato desde siempre). Se añadió `fechaValidaONull()`, que guarda `NULL`
en la columna promovida `fecha_hecho` cuando el valor no es una fecha
parseable — **sin perder el dato**: el valor original completo sigue
íntegro dentro de la columna `registro` (JSONB), que ya lo tenía. Ningún
registro se descarta por esto.

## Segunda corrida — idempotencia + los 4 corregidos

```
SOURCE_COUNT=914
INSERTED=4
ALREADY_PRESENT=907
COLLISIONS_PRESERVED=3
FAILED=0
TARGET_COUNT=911
```

Los 907 ya importados NO se duplicaron (`ALREADY_PRESENT=907`, exacto).
Los 4 antes fallidos ahora entraron limpio. `TARGET_COUNT=911` coincide
**exactamente** con `CLAVES_UNICAS=911` del `--dry-run` original contra el
JSONL — la migración está completa y es trazable 1:1 con el origen.

**Hallazgo de precisión en el propio contador** (no un problema de datos):
`COLLISIONS_PRESERVED=3` volvió a reportarse en esta segunda corrida
aunque no se preservó nada nuevo (los 3 ya estaban preservados de la
primera corrida) — el contador no distinguía "inserción nueva en la tabla
de conflictos" de "ya estaba, `ON CONFLICT DO NOTHING` no hizo nada".
**Corregido** en el propio script (`RETURNING id` + comprobar
`rowCount`), separando `COLLISIONS_PRESERVED` (nuevas) de
`COLLISIONS_ALREADY_PRESERVED` (ya existentes). Verificado directamente
contra la tabla (`SELECT COUNT(*)`): **exactamente 3 filas, nunca
duplicadas**, confirmando que el dato en sí siempre fue correcto —
solo el mensaje de consola era impreciso.

## Tercera corrida — confirma el contador corregido y cierra la certificación

```
SOURCE_COUNT=914
INSERTED=0
ALREADY_PRESENT=911
COLLISIONS_PRESERVED=0
COLLISIONS_ALREADY_PRESERVED=3
FAILED=0
TARGET_COUNT=911
```

Exactamente lo esperado: nada nuevo, nada duplicado, los 3 conflictos
reconocidos correctamente como ya preservados.

## Auditoría de las 3 colisiones — cómo se preservaron, explícitamente

Verificado en vivo contra `lake_records_version_conflicts`:
**exactamente 3 filas**, cada una con su `registro` completo en JSONB (el
contenido íntegro del registro "perdedor"), más `registro_id_canonico` y
`hash_canonico` apuntando a cuál versión quedó en `lake_records` como la
canónica. **Ningún contenido se perdió**: ambas versiones de cada par
colisionado existen hoy en la base — una en `lake_records` (la que "ganó"
por orden de importación), la otra en `lake_records_version_conflicts`
(preservada, marcada `resuelto=false`, a la espera de una decisión humana
sobre cuál de las dos es la correcta). Esa decisión **no se tomó en este
gate** — no es una decisión técnica de migración, es una decisión sobre
cuál observación histórica de investigación es la válida, y corresponde a
quien conoce el caso, no a este gate de infraestructura.

## Verificación de invariantes contra la base real

```
POSTGRES_COUNT=911
DISTINCT_PROJECTS=16
PROJECT_A_ROWS=621  PROJECT_B_ROWS=29
CROSS_PROJECT_KEY_LEAK=false
DUPLICATE_ENTIDAD_VERSION_ROWS=0
```

**`PROJECT_ISOLATION_CLOUD` verificado contra datos reales** (no solo
contra un fixture sintético): dos proyectos reales de los 16 presentes,
cero fuga de claves entre ellos. **`APPEND_ONLY_CERTIFIED` verificado**:
cero filas con `(clave_entidad, version)` duplicado — la restricción
`UNIQUE` sostiene la garantía también bajo datos de producción reales, no
solo en el test sintético del gate anterior.

Suite de regresión completa (persistencia + 4 suites de storage + 2
suites nuevas) re-ejecutada tras ambas correcciones de código: **32/32
PASS, sin regresión.** JSONL de origen confirmado intacto (31 archivos,
mismo tamaño, antes y después de las tres corridas de importación).

## Veredictos finales certificados de este addendum

```
CONNECT_OK                       = true
POOLER_MODE                      = Session Pooler
POOLER_PORT                      = 5432
MIGRATIONS_OK                    = true
TABLES_CREATED                   = lake_migration_log, lake_records, lake_records_version_conflicts
JSONL_SOURCE_COUNT                = 914 (911 claves únicas)
POSTGRES_COUNT                    = 911
COLLISIONS_FOUND                 = 3
COLLISIONS_PRESERVED             = true (3/3, verificado en la tabla lateral, contenido íntegro, ninguno descartado)
SECOND_IMPORT_INSERTED            = 0 (tercera corrida; la segunda corrida insertó 4 tras la corrección de fecha)
IDEMPOTENCY_CERTIFIED             = SÍ (tres corridas, conteo estable en 911, cero duplicados)
APPEND_ONLY_CERTIFIED             = SÍ (verificado contra Postgres real, no solo simulado)
DISTRIBUTED_DAILY_LOCK_READY       = NO (sin cambio -- hallazgo del Addendum 2 sigue vigente, ver arriba: el collectionRunId no es determinista por día; requiere Opción A o B, ninguna implementada, pendiente de autorización)
PROJECT_ISOLATION_CLOUD           = VERIFIED (contra datos reales, 2 de 16 proyectos probados, 0 fugas)
```

**No se hizo push. No se hizo deploy en Railway. No se tocó
`candidateObservationScheduler.js`. No se resolvió la decisión sobre cuál
de las 2 versiones de cada una de las 3 colisiones es la "correcta" — eso
es una decisión humana de investigación, no de infraestructura.**

---

# ADDENDUM 4 — Lock distribuido (Opción A): primitiva implementada y certificada, NO integrada

Decisión autorizada por el usuario: implementar Opción A (advisory lock),
sin tocar `candidateObservationScheduler.js`; las 3 colisiones históricas
quedan preservadas sin resolver, sin bloquear el cutover.

## Punto de integración real — verificado, no asumido

Se leyó `candidateObservationScheduler.js:171-244`
(`ejecutarObservacionDiaria`) línea por línea antes de escribir nada:

- Líneas 187-204: la comprobación `yaSeColectoHoy` (¿ya se corrió hoy?).
- Línea 234: la llamada a `collectCandidateSnapshots` (consumo real de
  proveedores).

**Ambas viven en la misma función, en el mismo archivo.** No existe
ningún módulo intermedio, ningún hook, ninguna capa de infraestructura ya
existente que se ejecute entre la decisión "¿corro hoy?" y el consumo de
proveedores sin que sea código de `candidateObservationScheduler.js`
mismo. **Confirmado: no existe un punto seguro de integración sin
modificar ese archivo.** Por la decisión explícita del usuario de no
tocarlo, la primitiva de lock se implementó y certificó de forma
completamente aislada, lista para conectarse con un cambio mínimo (una
línea envolviendo la llamada a `collectCandidateSnapshots`) el día que se
autorice.

## Primitiva implementada

`apps/backend/services/knowledgeLake/dailyRunLock.js` — `pg_try_advisory_lock`
de sesión (no de transacción), clave determinista
`hashtext(projectId), hashtext(fechaOperativa)` (dos enteros derivados por
Postgres mismo, sin memoria de proceso, sin hostname, sin timestamp
aleatorio). `fechaOperativaGuayaquil()` duplica deliberadamente la lógica
de `fechaLocalObservacion()` del scheduler (mismo cálculo vía
`Intl.DateTimeFormat`) en vez de importarla, para no crear una dependencia
de infraestructura hacia código de Candidate.

**Regla de conexión única respetada**: `intentarLockDiario`/`liberarLockDiario`
operan sobre el mismo `client` (`pool.connect()`, nunca `pool.query()`)
desde la adquisición hasta la liberación — nunca se suelta la conexión al
pool entre medio.

## Pruebas de concurrencia — contra Postgres real, cero proveedores

`tests/storage/dailyRunLock.test.mjs`, **17/17 PASS**, ejecutado contra la
base Supabase real de este gate:

| Escenario pedido | Resultado |
|---|---|
| Worker A adquiere, Worker B simultáneo mismo projectId+fecha | A=true, B=false |
| A libera, B reintenta | B=true |
| Proyecto distinto, mismo día | ambos adquieren, sin bloqueo cruzado |
| Mismo proyecto, fecha distinta | ambos adquieren, sin bloqueo cruzado |
| Excepción dentro de la sección crítica | se propaga, y el lock igual se libera (`finally`) — reintento posterior adquiere |
| Éxito normal | libera y devuelve el resultado de `fn` |
| Lock ya tomado | `fn` **nunca se ejecuta** — la protección ocurre antes de cualquier trabajo |
| Conexión terminada abruptamente sin liberar (proceso "caído") | Postgres libera el lock de sesión automáticamente; un worker nuevo adquiere sin quedar huérfano |
| Límite de zona horaria America/Guayaquil alrededor de medianoche UTC | `04:59Z` → día anterior, `05:00Z` → día nuevo, correcto |

Verificado tras la suite: `LAKE_RECORDS_COUNT=911` y
`CONFLICTS_COUNT=3` sin cambio (los advisory locks son estado de sesión
de PostgreSQL, no filas — no tocan ninguna tabla de negocio),
`ADVISORY_LOCKS_HELD_NOW=0` (ningún lock quedó tomado tras la suite).
**Cero requests a proveedores. Cero observaciones Candidate reales.**

## Estado real: primitiva lista, integración pendiente de autorización

`DISTRIBUTED_DAILY_LOCK_IMPLEMENTED = true` para la **primitiva** —
completamente construida, probada contra Postgres real, con los 9
escenarios exigidos, todos verdes.

Pero **el `NORMAL_DAILY_RUN` real de `candidateObservationScheduler.js`
sigue protegido HOY únicamente por la comprobación de aplicación
`yaSeColectoHoy`**, no por este lock — porque conectar ambos exige tocar
ese archivo, y la decisión de este gate fue explícitamente no hacerlo. Es
decir: si dos instancias del worker cloud llegaran a correr
simultáneamente contra el mismo proyecto el mismo día (por ejemplo,
durante un redeploy con solape, o si alguien escala a más de una réplica),
la ventana de carrera que motivó este gate **seguiría abierta en el
código real**, aunque la solución ya esté construida y esperando.

Por eso `DISTRIBUTED_DAILY_LOCK_READY` se reporta como **NO** para el
sistema completo (aunque la primitiva en sí está lista) — "listo" en el
sentido del gate significa que el `NORMAL_DAILY_RUN` real está protegido,
y hoy no lo está todavía.

## ¿Estamos listos para el cutover de Railway?

**Técnicamente, para un despliegue de una sola réplica: sí**, en el
sentido de que el riesgo es exactamente el mismo que existe hoy en el
proceso local (protección solo por aplicación, sin lock de base de
datos) — no se empeora nada al mover el proceso a Railway, siempre que
Railway se configure para correr **una única instancia**, no réplicas
horizontales.

**Para un despliegue con más de una réplica, o durante ventanas de
redeploy con solape: no todavía** — ese es exactamente el escenario que
el lock de Opción A resolvería, y no está conectado.

`RAILWAY_READY_FOR_CUTOVER = PARCIAL` — listo en el sentido de que
Postgres, migración, e idempotencia de datos están certificados; no
"listo sin condiciones" porque el lock distribuido, ya construido, no
protege todavía la ejecución real.

## Veredictos de este addendum

```
DISTRIBUTED_DAILY_LOCK_IMPLEMENTED = true (primitiva, aislada, no integrada)
LOCK_SCOPE                          = session-level, pg_try_advisory_lock(hashtext(projectId), hashtext(fechaOperativa))
LOCK_BEFORE_PROVIDER_CONSUMPTION    = SÍ, por diseño y demostrado en test (LOCK-7); NO integrado en ejecutarObservacionDiaria todavía
SAME_PROJECT_SAME_DAY_SECOND_WORKER_BLOCKED = SÍ (demostrado, LOCK-1)
DIFFERENT_PROJECT_ALLOWED           = SÍ (demostrado, LOCK-3)
DIFFERENT_DAY_ALLOWED               = SÍ (demostrado, LOCK-4)
LOCK_RELEASE_AFTER_SUCCESS          = SÍ (demostrado, LOCK-6)
LOCK_RELEASE_AFTER_FAILURE          = SÍ (demostrado, LOCK-5, vía finally)
PROCESS_RESTART_SAFE                = SÍ (demostrado, LOCK-8, auto-liberación de sesión de PostgreSQL)
TIMEZONE_BOUNDARY_TEST              = PASS (demostrado, LOCK-9, America/Guayaquil UTC-5)
CANDIDATE_SCHEDULER_MODIFIED        = NO
REAL_PROVIDER_REQUESTS              = 0
REAL_CANDIDATE_RUNS                 = 0
DISTRIBUTED_DAILY_LOCK_READY        = NO (la primitiva sí; el sistema real, no, hasta integrarla)
RAILWAY_READY_FOR_CUTOVER           = PARCIAL (ver explicación arriba)
```

**No se hizo push. No se hizo deploy. No se tocó
`candidateObservationScheduler.js`. No se declara
`PC_CAN_BE_OFF_WITHOUT_MISSING_DAILY_CANDIDATE_OBSERVATION=YES`.**

---

# ADDENDUM 5 — Lock distribuido integrado en el scheduler (autorización explícita)

Autorización humana explícita: tocar `candidateObservationScheduler.js`
ÚNICAMENTE para integrar la primitiva de lock ya certificada. Ningún
otro cambio de lógica Candidate.

## Refactor — exactamente qué cambió

El cuerpo completo de `ejecutarObservacionDiaria` (comprobación
`yaSeColectoHoy`, resolución de candidatos activos, presupuesto,
llamada a `collectCandidateSnapshots`, persistencia del
`collectionRun`, cálculo de IPDO/ranking) se movió, **sin modificar
una sola línea de su lógica interna**, dentro de una función anidada
`cuerpoDeLaObservacion()` — una closure sobre las mismas variables que
ya existían. La única lógica nueva es la que decide **si** llamar a
esa función directamente o envolverla con el lock:

```js
const debeUsarLockDistribuido =
  triggerType === TIPOS_DISPARO.NORMAL_DAILY_RUN &&
  !forzar &&
  process.env.SENTINEL_LAKE_ADAPTER === "postgres";

if (!debeUsarLockDistribuido) {
  return cuerpoDeLaObservacion();   // exactamente el comportamiento de antes
}

const { ejecutado, resultado } = await conLockDiario(
  obtenerPoolLockCompartido(), projectId, localObservationDate, cuerpoDeLaObservacion
);

if (!ejecutado) return { ...status: ESTADOS_RUN.SKIPPED_LOCKED... };
return resultado;
```

**Ningún cambio** a: fórmulas de IPDO, `calcularIPDO`,
`extraerInsumosCandidato`, `collectCandidateSnapshots`, multi-asset,
`resolverCandidatosActivos` (enrollment dinámico), aliases, identidad,
ranking, generación de reportes, frecuencia diaria (`intervaloDeChequeoMs`/
`horaDisparoLocal`, sin tocar), ni la semántica de `NORMAL_DAILY_RUN`
frente a `FORCED_MANUAL_RUN`. Único añadido semántico: el estado
`ESTADOS_RUN.SKIPPED_LOCKED`, distinto de `FAILED` y de
`SKIPPED_ALREADY_COLLECTED` — no es un error operativo, es la
protección funcionando.

## Con `SENTINEL_LAKE_ADAPTER` distinto de `postgres`

`debeUsarLockDistribuido` es `false` — `cuerpoDeLaObservacion()` se
llama directamente, sin ningún lock, exactamente como antes de este
gate. Confirmado por la suite existente
`tests/candidateObservationScheduler.test.mjs` (adaptador `memoria`):
**23/23 PASS, sin modificar ese archivo de test, sin ninguna
regresión.**

## Integración probada contra Postgres real — cero requests a proveedores

Nueva suite `tests/candidateSchedulerDistributedLock.test.mjs`,
**9/9 PASS**, con `SENTINEL_LAKE_ADAPTER=postgres` real y candidatos
fixture **sin ninguna cuenta social declarada** (mismo patrón que la
suite existente con memoria: cero activos que medir, cero llamadas de
red externas).

| Escenario | Resultado |
|---|---|
| Dos workers simultáneos, mismo proyecto+día (`Promise.all` real, dos conexiones a Postgres compitiendo de verdad) | Exactamente uno `SKIPPED_LOCKED`, exactamente uno ejecuta |
| Worker bloqueado | 0 candidatos observados, 0 requests, **ningún `collectionRun` propio persistido** — no se creó una segunda observación |
| Tercera llamada, ya sin contención de lock | `SKIPPED_ALREADY_COLLECTED` — la idempotencia existente (`yaSeColectoHoy`) sigue siendo la primera línea de defensa, el lock es una capa adicional, no un reemplazo |
| Proyecto distinto, mismo día | ambos ejecutan, sin bloqueo cruzado |
| Mismo proyecto, día distinto | `collectionRunId`/`localObservationDate` distintos, sin contención |
| `FORCED_MANUAL_RUN` sobre un día ya colectado | ejecuta igual — el lock nunca se activa para corridas forzadas, por diseño |
| Requests a proveedores en las 9 pruebas | **0** |

**Nota de alcance, documentada explícitamente**: este fixture, al usar
el adaptador postgres real, escribió efectivamente en la tabla de
producción `lake_records` (2 proyectos, 2 candidatos, 4
`collectionRun`) — no hay forma de evitarlo sin violar el principio
append-only del Lake, y son claramente identificables por su
`proyectoId` (`fixture-lock-scheduler-a-*`/`fixture-lock-scheduler-b-*`).
Verificado que **no afectaron los 911 registros migrados ni los 3
conflictos preservados**: `LAKE_RECORDS_COUNT` pasó de 911 a 919
(exactamente +8, el fixture), `CONFLICTS_COUNT` se mantuvo en 3.

## Regresión completa tras la integración

```
tests/candidateObservationScheduler.test.mjs   23/23 PASS (sin cambios, adapter=memoria)
tests/candidateSchedulerDistributedLock.test.mjs  9/9 PASS (nuevo, adapter=postgres real)
tests/persistencia.test.mjs                    16/16 PASS
tests/storage/lakeRestartPersistence.test.mjs   5/5  PASS
tests/storage/lakeConcurrentWrites.test.mjs     2/2  PASS
tests/storage/lakeProjectIsolation.test.mjs     5/5  PASS
tests/storage/postgresAdapterContract.test.mjs  5/5  PASS
tests/storage/migrationCollisionPolicy.test.mjs 4/4  PASS
tests/storage/dailyRunLock.test.mjs            17/17 PASS
```

**Total: 86/86 PASS. Cero requests a proveedores reales en toda la
sesión de este gate. Cero observaciones Candidate reales (ningún
candidato con cuenta social real fue tocado).**

## Veredictos finales de este addendum

```
DISTRIBUTED_DAILY_LOCK_IMPLEMENTED        = true
DISTRIBUTED_DAILY_LOCK_INTEGRATED         = true
LOCK_ACQUIRED_BEFORE_PROVIDER_CALLS       = true (demostrado: el worker bloqueado nunca ejecutó resolverCandidatosActivos/aplicarPresupuesto/collectCandidateSnapshots)
SECOND_WORKER_PROVIDER_CALLS              = 0
SECOND_WORKER_RESULT                      = SKIPPED_LOCKED (estado explícito, no ambiguo, no tratado como error)
LOCK_RELEASE_AFTER_SUCCESS                = true
LOCK_RELEASE_AFTER_FAILURE                = true (certificado en la primitiva, Addendum 4)
DIFFERENT_PROJECT_ALLOWED                 = true
DIFFERENT_DAY_ALLOWED                     = true
FILE_ADAPTER_REGRESSION                   = NINGUNA (23/23 suite existente, sin tocar)
POSTGRES_ADAPTER_REGRESSION               = NINGUNA (86/86 en total)
CANDIDATE_REGRESSION                      = NINGUNA
REAL_PROVIDER_REQUESTS                    = 0
REAL_CANDIDATE_RUNS                       = 0 (solo fixtures sin cuentas sociales)
DISTRIBUTED_DAILY_LOCK_READY              = SÍ
RAILWAY_READY_FOR_CUTOVER                 = SÍ, técnicamente (Postgres + migración + lock distribuido integrado y probado); el push y el deploy siguen sin hacerse, pendientes de autorización aparte
```

**No se hizo push. No se hizo deploy. No se declara
`PC_CAN_BE_OFF_WITHOUT_MISSING_DAILY_CANDIDATE_OBSERVATION=YES`** — eso
requiere además el push, la configuración real de Railway, el
deployment, y la verificación de persistencia desde el propio Railway,
ninguno de los cuales ocurrió en este gate.
