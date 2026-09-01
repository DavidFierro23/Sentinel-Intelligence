# SENTINEL-DATA-PERSISTENCE-01 — Auditoría de persistencia productiva y Knowledge Lake

Terminal 4 — Data Platform / Knowledge Lake. Gate de auditoría + arquitectura +
contratos + plan de migración + pruebas de persistencia. **No se ha desplegado
infraestructura nueva, no se ha instalado PostgreSQL, no se ha contratado
ningún servicio cloud, no se ha migrado ningún dato real.** Coste: $0.
Requests externas: 0.

Aislamiento respetado: no se tocó `apps/backend/package.json` (cambios
mezclados entre terminales, fuera de alcance), no se modificaron archivos de
Candidate/Territorial/Media/frontend/`.env`, y `SENTINEL_PROJECT_STATE.md`
queda sin tocar porque ya tenía cambios sin commitear de otra terminal en el
momento de esta auditoría (ver §22).

---

## 1. Executive summary

Sentinel Intelligence no usa ninguna base de datos hoy. Toda la persistencia
—proyectos, candidatos, actores, expedientes, ejecuciones de investigación,
piezas de medios, emisores, snapshots de métricas, evidencia territorial,
universo de fuentes, rotación de RSS— se implementa como ficheros **JSONL
append-only**, particionados por fecha, en `apps/backend/data/`. El
Knowledge Lake (`services/knowledgeLake/`) es el centro de gravedad
arquitectónico: la mayoría de módulos de negocio no mantienen almacén propio y
en su lugar escriben filas tipadas y versionadas dentro del mismo log
compartido, distinguidas por `tipoEntidad` y un discriminador `datos.clase`.

El diseño es deliberado y está bien razonado en el propio código (comentarios
extensos explican por qué JSONL, por qué append-only, por qué la clave de
entidad `tenantId::proyectoId::tipoEntidad::entidad`). No es un accidente ni
deuda técnica silenciosa: es una decisión de arquitectura explícita, con
límites también declarados explícitamente (adaptador MinIO reservado pero no
implementado; advertencias de "se pierde al reiniciar" en el adaptador de
memoria).

Dicho esto, esta auditoría encuentra tres riesgos reales de cara a operación
de campaña continua:

1. **Reconstrucción de índice en cada arranque, lineal con el volumen total**
   (§11): cada vez que el backend arranca, se leen TODOS los ficheros JSONL
   históricos para reconstruir los índices en memoria. Hoy son 5.76 MB; en una
   campaña activa de meses, esto crece sin límite y sin compactación.
2. **Race de versión confirmada empíricamente bajo escritura concurrente
   sobre la misma entidad** (§12): 20 escrituras concurrentes a la misma
   entidad produjeron 20 registros, todos declarándose versión 1. La cadena de
   versiones del Lake no es segura bajo concurrencia real, y Sentinel ya tiene
   varios motores/terminales que escriben.
3. **Ausencia total de backup/restore/recuperación de corrupción** (§17): no
   existe ningún mecanismo, ni siquiera manual, para recuperar el corpus si el
   disco donde vive `apps/backend/data/` se pierde, se corrompe o se borra
   por error.

Ninguno de estos riesgos es hipotético: los tres se demuestran con evidencia
de código y con pruebas ejecutadas contra fixtures aislados en este mismo
gate (§11, §12, §13).

**Veredicto (§23): APTO_CON_LIMITACIONES.** Ver razonamiento completo al
final del documento.

---

## 2. Current architecture

```
Módulos de negocio (proyectos, candidatos, media, territorial)
        |
        v
services/knowledgeLake/lakeQuery.js   ← punto de entrada único
        |
        +-- lakeAdapter.js   (memoria | fichero | minio*)
        +-- lakeIndexer.js   (índices en memoria, derivados, no persistidos)
        +-- lakeWriter.js    (modelo de registro, versionado, append-only)
        +-- lakeReader.js    (consultas, filtros, replay por instante)
        +-- lakeHash.js      (hash de contenido, cadena de integridad)
        +-- lakeVersioning.js (reconstrucción de estado en instante T)

* minio: declarado, no implementado (lanza excepción si se invoca).
```

Fuera del Lake compartido, cuatro almacenes territoriales independientes
siguen exactamente el mismo patrón (JSONL append-only, adaptador
memoria/fichero, reconstrucción de estado por plegado de observaciones), pero
NO pasan por el Lake:

- `services/territorial/evidenceLedger.js` → `data/territorial-evidence/`
- `services/territorial/snapshotStore.js` → `data/territorial-snapshots/`
- `services/territorial/sourceUniverseStore.js` → `data/territorial-sources/`
- `services/territorial/rssRotation.js` → `data/territorial-rss-rotation/`

`services/media/pieceSnapshot.js` añade además un `Map` en memoria de proceso
como caché/respaldo que se escribe **siempre**, en paralelo al intento de
escritura en el Lake — es volátil y se pierde en cada reinicio (ver §4, §11).

---

## 3. Physical storage today

Raíz: `apps/backend/data/`. Todo en JSONL (una línea = un JSON completo),
nunca JSON de array completo, y nunca reescrito.

| Almacén | Ruta | Partición |
|---|---|---|
| Knowledge Lake | `data/knowledge-lake/` | diaria: `YYYY/MM/DD.jsonl` |
| Evidencia territorial | `data/territorial-evidence/` | diaria, por `retrievedAt` |
| Snapshots territoriales | `data/territorial-snapshots/` | diaria, por `capturedAt` |
| Universo de fuentes territoriales | `data/territorial-sources/` | mensual: `YYYY/YYYY-MM.jsonl` |
| Rotación RSS territorial | `data/territorial-rss-rotation/` | mensual |

No existe ningún fichero de configuración de base de datos, ni variable de
entorno de conexión (`DATABASE_URL`, `DB_HOST`, etc.) en
`apps/backend/.env.example`. La única variable relacionada con
almacenamiento es `SENTINEL_LAKE_ADAPTER` (`fichero` por defecto, `memoria`,
`minio`). `package.json` no declara ninguna dependencia de base de datos
(`pg`, `mongoose`, `redis`, `better-sqlite3`, `knex`, `sequelize`, `prisma`
— ninguna presente).

---

## 4. Adapter inventory

`services/knowledgeLake/lakeAdapter.js` define tres adaptadores intercambiables
por `SENTINEL_LAKE_ADAPTER` (por defecto `fichero`):

| Adaptador | `persistente` | Uso | Sobrevive reinicio |
|---|---|---|---|
| `memoria` | `false` | desarrollo, **usado explícitamente por todos los tests** (`persistencia.test.mjs` fuerza `SENTINEL_LAKE_ADAPTER=memoria` antes de importar) | NO — confirmado empíricamente en §12 (RESTART-2) |
| `fichero` | `true` | producción inicial, JSONL particionado | SÍ — confirmado empíricamente en §12 (RESTART-1) |
| `minio` | declarado `persistente: true` pero `implementado: false` | reservado; **cualquier llamada lanza excepción** | N/A — no operativo |

Los cuatro almacenes territoriales independientes replican el mismo patrón de
tres adaptadores (memoria/fichero, sin minio) de forma redundante — cuatro
implementaciones de la misma idea en vez de una factorización compartida.

`pieceSnapshot.js` usa un quinto almacén, un `Map` de proceso, sin adaptador
seleccionable y sin opción de persistencia: siempre volátil.

**Qué sobrevive un reinicio real del backend:** todo lo que pasa por el
adaptador `fichero` (que es el default en ausencia de la variable de
entorno). **Qué NO sobrevive:** cualquier cosa escrita mientras
`SENTINEL_LAKE_ADAPTER=memoria` esté activo, y el caché `Map` de
`pieceSnapshot.js` siempre, sin importar el adaptador del Lake.

---

## 5. Data inventory

Ver también el hallazgo de investigación completo (auditoría de código, no
resumido) que sustenta esta tabla — está preservado como evidencia
verbatim en el anexo de commit de este gate.

| Tipo de dato | Módulo productor | Almacenamiento | Identificador | project/tenant en clave | Timestamps | Histórico |
|---|---|---|---|---|---|---|
| Proyecto | `projects/projectStore.js` | Lake, `tipoEntidad: "documento"`, catálogo compartido `CATALOGO` | `tenant::catalogo-proyectos::documento::<id>` | tenant fijo `"sentinel-local"`; catálogo compartido | `creadoEn`, `renombradoEn`, `archivadoEn`/`eliminadoEn` | Sí, versionado Lake |
| Candidato (expediente) | `projects/projectStore.js` | Lake, `tipoEntidad: "persona"`, `candidato-<id>` | `tenant::proyectoId::persona::candidato-<id>` | Sí, `proyectoId` real | `agregadoEn`, `actualizadoEn` | Sí, versionado Lake |
| Actor de referencia | `projects/projectStore.js` | igual, `actor-<id>` | igual esquema | Sí | `agregadoEn` | Sí |
| Ejecución de investigación | `projects/projectStore.js` | Lake, entidad propia por ejecución (`ejecucion-<tipo>-<id>-<timestamp>`) | por instante | Sí | `ejecutadaEn` | Cada ejecución es permanente, nunca se sobrescribe |
| Evidencia normalizada | `ingest/evidenceContract.js` | no persiste directamente; alimenta ledger territorial o Lake | `evidenceId = sha256(canonicalUrl\|título)` | no en este nivel; se añade aguas abajo | `publishedAt`, `observedAt` | N/A en esta capa |
| Observación de evidencia territorial | `territorial/evidenceLedger.js` | `data/territorial-evidence/` | `evidenceId` + una línea por `retrievedAt` | Sí, campo `projectId`, con huecos legados (`incluirLegado`) | `publishedAt`, `firstObservedAt` (inmutable), `lastObservedAt`, `retrievedAt` | Sí, se pliega en lectura |
| Snapshot territorial | `territorial/snapshotStore.js` | `data/territorial-snapshots/` | `snap-<hash>` | Sí, puede ser `null` | `capturedAt` | Sí, correcciones se anexan sin tocar el original |
| Universo de fuentes territoriales | `territorial/sourceUniverseStore.js` | `data/territorial-sources/` | `sourceId` (dominio) | **NO** — infraestructura compartida por diseño | `comprobadoEn`, `primeraComprobacionEn` (inmutable) | Sí |
| Rotación RSS | `territorial/rssRotation.js` | `data/territorial-rss-rotation/` | `feedUrl` + `scopeId` | Sí, vía `scopeId` (string, no clave estructural) | `instante`, `lastAttemptAt` | Sí |
| Pieza de medio (publicación) | `media/pieceStore.js` | Lake, `tipoEntidad: "publicacion"` | URL canónica | Sí | `fechaHecho`, `fechaDeteccion` | Sí, versionado Lake |
| Medio emisor | `media/pieceStore.js` | Lake, `tipoEntidad: "medio"` | dominio | Sí | — | Sí |
| Snapshot de pieza (métricas) | `media/pieceSnapshot.js` + `pieceStore.js` | **doble escritura**: fila Lake + `Map` volátil siempre | `snap-<hash(pieceId\|observedAt)>` | heredado del Lake | `observedAt` | Sí en Lake; NO en el caché volátil |
| Nodo de amplificación | `media/pieceStore.js` | Lake, `datos.clase: "pieza_amplificacion"` | URL propia | Sí | `fechaHecho` | Sí |
| Relación media–candidato | `media/pieceStore.js` | Lake, `datos.clase: "relacion"` | `origen->destino` | Sí | `timestamp` | Sí |
| Observación de publicación / comentario | `intelligence/publicationObservation.js`, `commentObservation.js` | **contrato definido, sin llamada de persistencia visible en estos módulos** | `pub-<hash>` / `cmt-<hash>` | vía campo `projectId` | `publishedAt`, `firstObservedAt`, `lastObservedAt` | Conceptualmente sí (`fusionarPublicacion`/`fusionarComentario`), pero el destino de escritura real no se localizó en el código auditado — **hallazgo abierto, ver §21** |
| Baseline T0 de candidato | `intelligence/candidateBaseline.js` | módulo de cómputo puro, sin persistencia propia | N/A | N/A | `generadoEn` | No aplica (T0 no tiene contra qué compararse) |

**No se inventó ningún campo que no exista en el código.** Donde el código no
mostraba destino de persistencia (observación de publicación/comentario), se
declara como hallazgo abierto en vez de asumir un almacén.

---

## 6. Historical/snapshot audit

Matriz pedida en la directiva original:

| Tipo | Histórico real | Sobrescribe | Append | Dedupe | Listo para Momentum |
|---|---|---|---|---|---|
| Candidato/expediente (Lake) | Sí, versión + hash-chain | No | Sí | Por `claveEntidad`, redundante se omite | Sí (point-in-time vía `lakeVersioning.js`) |
| Ejecución de investigación (Lake) | Sí, entidad propia por ejecución | No | Sí | No aplica (cada ejecución es única por diseño) | Sí |
| Publicación/pieza de medio (Lake) | Sí, versión + hash-chain | No | Sí | Por `claveEntidad` | Sí |
| Snapshot de métricas de pieza | Sí en Lake; **perdido en el caché volátil tras reinicio** | No en Lake; el `Map` sí se sustituye/pierde | Sí en Lake | Por `snapshotId`, duplicado exacto se rechaza | Parcial — depende de que la escritura en Lake haya tenido éxito, no solo el caché |
| Evidencia territorial | Sí, una línea por observación, plegado en lectura | No | Sí | Por `evidenceId` (hash de contenido) | Sí, con huecos legados declarados |
| Snapshot territorial | Sí | No (correcciones se anexan aparte) | Sí | Por huella de contenido | Sí |
| Universo de fuentes | Sí, una línea por comprobación | No | Sí | Por `sourceId` | Sí, pero sin `projectId` (§10) |
| Rotación RSS | Sí | No | Sí | Por `feedUrl`+`scopeId` | Sí |
| Observación de publicación/comentario | Conceptual (diseño de merge existe) | No, por diseño | Debería, destino no confirmado | Por `publicationId`/`commentId` (hash) | **No confirmable hoy** — ver §21 |

Ejemplo directo del enunciado de la directiva (followers 57000 → 57230 →
58910): el mecanismo que soportaría esto —`fusionarPublicacion` en
`intelligence/publicationObservation.js`— acumula la serie de snapshots de
métricas sin sobrescribir valores anteriores (mismo patrón que
`pieceSnapshot.js`, confirmado en el código). **Lo que no se pudo confirmar
en esta auditoría es a qué almacén concreto llega esa fusión** cuando el
origen es una cuenta social de candidato en vez de una pieza de medio — el
módulo produce el objeto fusionado pero no se localizó la llamada de
escritura correspondiente dentro del árbol auditado. Se marca como pregunta
abierta para el siguiente gate en vez de asumir dónde vive.

---

## 7. Project isolation

**Mecanismo:** estructural para todo lo que pasa por el Lake. La clave de
entidad es literalmente

```
tenantId :: proyectoId :: tipoEntidad :: entidad
```

(`lakeWriter.js`, función `claveEntidad`). Dos proyectos con una entidad del
mismo nombre producen dos claves distintas por construcción — no depende de
que nadie recuerde aplicar un filtro. Esto se **demostró empíricamente** en
`tests/storage/lakeProjectIsolation.test.mjs` (5/5 PASS, ver §12): mismo
nombre de candidato en `proyecto-a` y `proyecto-b`, cero fuga cruzada.

**Excepciones documentadas, no estructurales:**

- `territorial/sourceUniverseStore.js` **no tiene `projectId` en absoluto**
  — es infraestructura compartida entre proyectos por diseño explícito del
  propio módulo ("una fuente descubierta hoy no debe descubrirse de cero
  mañana para otro proyecto").
- `territorial/evidenceLedger.js` tiene `projectId` por observación, pero es
  un filtro de lectura, no una partición física, y admite un modo
  `incluirLegado` para observaciones anteriores a que existiera scoping de
  proyecto — es decir, hay un hueco histórico real, ya reconocido en el
  propio código.
- `territorial/rssRotation.js` usa un `scopeId` de tipo string
  (`proyecto:<id>` o `territorio:<id>`) como campo, filtrado en lectura —
  no es una clave estructural como la del Lake.

**Tenant:** hoy es un valor único hardcodeado, `"sentinel-local"`, en todos
los módulos observados. No existe lógica de despliegue multi-tenant real
todavía, aunque el campo `tenantId` es obligatorio en el modelo del Lake
(preparado, no usado).

**Conclusión:** 0 fugas cross-project están garantizadas por diseño para
proyectos/candidatos/media (el núcleo del negocio). El universo de fuentes
territoriales y, en menor medida, la evidencia territorial legada, son las
dos superficies donde el aislamiento es un filtro de aplicación, no una
garantía estructural.

---

## 8. Deduplication

Tres mecanismos distintos, no unificados:

1. **`ingest/crossProviderDedup.js`** — dedupe dentro de una sola pasada de
   ingesta, en memoria, sobre un array de evidencias, antes de que nada se
   persista. Cuatro criterios en orden de fuerza (URL canónica idéntica → URL
   normalizada idéntica → mismo dominio + título casi idéntico → título
   similar en dominio distinto, que se marca como *sindicación* y se
   conservan ambos porque es información, no ruido).
2. **`territorial/evidenceLedger.js`** — dedupe entre pasadas de ingesta en
   el tiempo, por `evidenceId` (hash de contenido). Reobservar la misma
   evidencia no crea una segunda entidad; se pliega en lectura con
   `observationCount` incremental y `firstObservedAt` congelado.
3. **`knowledgeLake/lakeHash.js`** — no es una clave de deduplicación de
   identidad; es un hash de **integridad de contenido**, usado para detectar
   alteración y para omitir versiones redundantes cuando el contenido no
   cambió.

**Física vs. relación analítica:** en la capa de evidencia territorial, una
evidencia se identifica una sola vez por `evidenceId`, pero el ledger es una
estructura plana por evidencia+observación — no modela relaciones N:M con
candidatos/temas como entidades propias; esa asociación ocurre aguas arriba o
se recalcula en lectura. En la capa del Lake, en cambio, las relaciones SÍ son
filas de primera clase: `media/pieceStore.js` escribe filas explícitas
`datos.clase: "relacion"` (`origen->destino`) separadas de la fila de la
pieza y separadas de la fila del emisor — el patrón se acerca a "evidencia +
aristas" en vez de copiar el contenido íntegro en cada entidad relacionada,
aunque sigue implementado como filas planas independientes en un mismo log de
apéndice, no como referencias de clave foránea en sentido relacional.

**Gap declarado:** no existe hoy un contrato único de "evidencia física" que
las tres capas (ingest, territorial, Lake) compartan; cada una resuelve
identidad/dedupe con su propio hash y su propio criterio.

---

## 9. Provenance

Campos verbatim usados (no homogéneos entre módulos):

- `evidenceContract.js`: `sourceId`, `providerId`, `platform`, `publisher`,
  `publisherDeclaradoPor`, `canonicalUrl`, `origenCanonical`, `publishedAt`,
  `observedAt`, `provenance{providerId,query,queryType,queryLabel,observedAt,
  avisoCanonical}`, `rawMetadataReference{providerId,claves,conservado}`,
  `evidenceId`.
- `evidenceLedger.js`: añade `territoryId`, `runId`, `retrievedAt`,
  `projectId`, `tenantId`, `emitterId`, `emitterStatus`, además de incrustar
  el `provenance` anterior cuando llega.
- `lakeWriter.js` (modelo del Lake): `fuente`, `motorOrigen`, `consulta`,
  `urlCanonica`, `linaje{submotor,derivadaDe,cadena,submotoresImplicados,
  modoAcceso,version}`.
- `commentObservation.js`: `provider`, `provenance{providerId,
  observationMethod,observedAt,rawReference}`.

**Inconsistencias reales, no forzadas a coincidir:**

- El Lake llama `motorOrigen`/`consulta` a lo que `evidenceContract.js` llama
  `providerId`/`query` — la misma idea, sin capa de mapeo compartida.
- `publisher` (declarado) vs. `emitterId`/`emitterStatus` (resuelto) son dos
  vocabularios de "quién publicó esto" que conviven sin reconciliar.
- La riqueza de `origenCanonical` (cómo se resolvió la URL canónica) se
  pierde al entrar al Lake, que solo guarda `urlCanonica` como string plano.
- `rawMetadataReference` (trazabilidad al campo bruto original) solo existe
  en la capa de ingesta y, por defecto, `conservado` es `null` — la
  trazabilidad de campo a campo se pierde a menos que se pida explícitamente
  conservar el bruto.
- `linaje.submotor` (trazabilidad interna del pipeline) y `provenance`
  (procedencia de la fuente externa) son dos sistemas de "de dónde vino esto"
  que coexisten sin una clave de unión documentada.

**Contrato mínimo común recomendado para el siguiente gate** (no implementado
en este): `providerId`, `observedAt`, `canonicalUrl`, `evidenceId`,
`rawReference` (opcional, con política de retención explícita) como el
subconjunto que todo módulo productor debería garantizar, dejando el resto
como extensiones específicas de cada dominio.

---

## 10. Volume

Medido con `find`/`du`/`stat` sobre `apps/backend/data/`, sin ninguna
llamada de red:

| Carpeta | Ficheros | Tamaño |
|---|---|---|
| `knowledge-lake/` | 11 | 4.5 MB |
| `territorial-evidence/` | 3 | 668 KB |
| `territorial-sources/` | 1 | 336 KB |
| `territorial-snapshots/` | 5 | 80 KB |
| `territorial-rss-rotation/` | 2 | 44 KB |
| **Total** | **22** | **≈5.76 MB** |

El Lake domina el volumen (~78% del total) porque es el sumidero compartido
de proyectos, candidatos y piezas de medios además de sus propios tipos.
Ficheros más grandes: `knowledge-lake/2026/08/27.jsonl` (1.50 MB),
`knowledge-lake/2026/08/28.jsonl` (1.07 MB).

**Esto es ACTUAL, medido, no proyectado.** No se calcula aquí ninguna
proyección de "X TB al año": eso requeriría supuestos explícitos sobre
cadencia de ingesta por campaña activa que este gate no tiene autorización
para inventar. Lo que sí es observable sin supuestos: no existe compactación
ni archivado — los ficheros diarios se acumulan indefinidamente, y el
indexador (`lakeIndexer.reconstruir()`) relee **todos** en cada arranque del
proceso (§4, §11), así que el coste de arranque crece linealmente con el
volumen histórico total, no con el volumen de un día.

---

## 11. Restart test

Ejecutado en `apps/backend/tests/storage/lakeRestartPersistence.test.mjs`,
contra un directorio temporal del SO, sin tocar `data/knowledge-lake` real.

```
RESTART-1  adaptador de fichero sobrevive un reinicio simulado
  PASS  la escritura inicial se acepta
  PASS  el índice reconstruido tras 'reiniciar' encuentra el registro en disco
  PASS  el conteo del adaptador coincide con lo escrito antes de reiniciar

RESTART-2  adaptador de memoria NO sobrevive un reinicio simulado
  PASS  la escritura en memoria se acepta
  PASS  tras 'reiniciar', el adaptador de memoria arranca vacío: el dato anterior se perdió

PASS: 5    FALL: 0
```

`cerrarLake()` simula el reinicio (destruye índice e instancia en memoria de
proceso); reabrir con la misma raíz de disco reconstruye el índice leyendo
todos los JSONL. Confirma exactamente lo que el código declara: el adaptador
`fichero` (default de producción) sobrevive; el adaptador `memoria` (default
de todos los tests actuales) no.

---

## 12. Concurrency risks

Ejecutado en `apps/backend/tests/storage/lakeConcurrentWrites.test.mjs`, 20
escrituras concurrentes (`Promise.all`) contra la MISMA entidad, fixture
aislado:

```
versiones asignadas: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
versiones únicas: 1 de 20 escrituras
huecos en la secuencia: []
líneas realmente anexadas en disco: 20

VEREDICTO DE CONCURRENCIA INTRA-PROCESO: RIESGO
```

**Todas las 20 escrituras concurrentes se aceptaron y las 20 llegaron a
disco (ninguna se perdió), pero las 20 se declaran a sí mismas "versión 1,
versión inicial, sin hash anterior"**. Esto confirma exactamente el riesgo
que el propio comentario de `lakeWriter.js` anticipa para `escribirLote`
("en paralelo se asignarían la misma versión") pero que no está mitigado
para llamadas paralelas a `escribir()` individual fuera de un lote: entre
`indice.ultimaVersionDe()` (lectura) y `indice.indexar()` (escritura), el
event loop puede intercalar N llamadas antes de que ninguna termine.

Clasificación pedida por la directiva:

| Escenario | Clasificación |
|---|---|
| Escrituras concurrentes a entidades DISTINTAS | NO_PROBADO en este gate (razonablemente SEGURO por partición de clave, pero no se ejecutó la prueba específica) |
| Escrituras concurrentes a la MISMA entidad, mismo proceso | **RIESGO — confirmado empíricamente**: colisión de número de versión, cadena de hash rota en la práctica (múltiples "versión 1" para la misma entidad) |
| Escrituras concurrentes desde procesos/terminales DISTINTOS a la misma entidad | RIESGO, por extensión lógica del resultado anterior — no hay locking de fichero ni de índice entre procesos, solo `appendFile` (que es atómico línea a línea pero no coordina el cálculo de versión) |
| Pérdida de líneas físicas en disco bajo concurrencia | SEGURO — confirmado: 20 de 20 llegaron a disco, `appendFile` no perdió ninguna |

**Consecuencia directa para Sentinel:** el propio gate advierte que "Sentinel
ya tiene múltiples motores/terminales" escribiendo. Si dos terminales
investigan al mismo candidato en la misma ventana de tiempo, el resultado
observado aquí implica que ambas escrituras pueden registrarse como
"versión 1" del expediente, rompiendo la cadena de integridad
(`verificarCadena` de `lakeHash.js` fallaría al encontrar dos "versión 1"
para la misma `claveEntidad`) sin que ninguna de las dos escrituras se
pierda ni falle visiblemente.

---

## 13. Target architecture

Diseño conceptual, sin desplegar nada:

```
                SOURCES / APIs
                     |
                     v
               INGESTION
             (crossProviderDedup, evidenceContract)
                     |
              normalize / dedupe
                     |
                     v
              KNOWLEDGE LAKE (abstracción)
                     |
          +----------+-----------+
          |                      |
          v                      v
      PostgreSQL           Object Storage
      entidades            evidencia bruta / artefactos
      relaciones           payloads de proveedor
      snapshots            reportes exportados
      métricas
          |
          v
       Search / AI
          |
          v
Candidate / Media / Territorial / Investigations / Reports
```

**Principio no negociable:** el Knowledge Lake sigue siendo una abstracción.
Los módulos de negocio (`projectStore.js`, `pieceStore.js`, etc.) ya hablan
con `lakeQuery.js`, no directamente con el adaptador — esto es una ventaja
real de la arquitectura actual: la migración a PostgreSQL puede implementarse
como un cuarto adaptador (`crearAdaptadorPostgres()`) detrás de la misma
interfaz `anexar()`/`leerTodos()`, sin tocar ni una línea de
`projectStore.js`, `pieceStore.js` ni ningún consumidor. Esto reduce el
riesgo de migración drásticamente frente a lo que sería reescribir cada
módulo de negocio.

---

## 14. PostgreSQL model (diseño, no despliegue)

Categorías propuestas, respetando los nombres reales del código donde ya
existen convenciones (`tipoEntidad`, `claveEntidad`, `proyectoId`), no
imponiendo nomenclatura nueva sin motivo:

```sql
-- Núcleo del Lake: una tabla de eventos append-only,
-- reflejo directo del modelo actual de lakeWriter.js
CREATE TABLE lake_records (
  id              TEXT PRIMARY KEY,        -- lk-<hashCorto>
  hash            TEXT NOT NULL,
  hash_anterior   TEXT,
  tenant_id       TEXT NOT NULL,
  proyecto_id     TEXT NOT NULL,
  clave_entidad   TEXT NOT NULL,           -- tenant::proyecto::tipo::entidad
  entidad         TEXT NOT NULL,
  tipo_entidad    TEXT NOT NULL,
  version         INT NOT NULL,
  fuente          TEXT,
  motor_origen    TEXT,
  url_canonica    TEXT,
  fecha_hecho     TIMESTAMPTZ,
  fecha_deteccion TIMESTAMPTZ NOT NULL,
  linaje          JSONB NOT NULL,
  datos           JSONB NOT NULL,
  escrito_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unicidad que PostgreSQL SÍ puede garantizar y que el
  -- adaptador de fichero actual no puede: una entidad no puede
  -- tener dos filas con el mismo número de versión.
  UNIQUE (clave_entidad, version)
);

CREATE INDEX idx_lake_proyecto      ON lake_records (proyecto_id, fecha_deteccion);
CREATE INDEX idx_lake_clave_entidad ON lake_records (clave_entidad, version DESC);
CREATE INDEX idx_lake_tipo          ON lake_records (tenant_id, proyecto_id, tipo_entidad);
CREATE INDEX idx_lake_evidencia     ON lake_records ((datos->>'evidenceId'));

-- Almacenes territoriales, hoy independientes del Lake:
-- se modelan igual (append-only, unicidad por clave+observación),
-- no se fuerza su fusión con lake_records sin evaluar el coste
-- de ese refactor en un gate futuro.
CREATE TABLE territorial_evidence_observations (
  evidence_id     TEXT NOT NULL,
  project_id      TEXT,              -- NULL permitido: huecos legados existentes
  territory_id    TEXT,
  retrieved_at    TIMESTAMPTZ NOT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at  TIMESTAMPTZ NOT NULL,
  published_at    TIMESTAMPTZ,
  provenance      JSONB,
  payload         JSONB NOT NULL,
  PRIMARY KEY (evidence_id, retrieved_at)
);

CREATE TABLE territorial_source_universe (
  source_id           TEXT NOT NULL,
  territorio_id       TEXT,
  comprobado_en       TIMESTAMPTZ NOT NULL,
  primera_comprobacion_en TIMESTAMPTZ NOT NULL,
  payload             JSONB NOT NULL,
  PRIMARY KEY (source_id, comprobado_en)
  -- Nota deliberada: sin project_id, igual que hoy — es
  -- infraestructura compartida por diseño (§7). No se le
  -- añade aislamiento que el propio dominio no pide.
);
```

**Por qué unicidad `(clave_entidad, version)` es el cambio de mayor valor:**
resuelve directamente el riesgo confirmado en §12. Una constraint `UNIQUE` en
PostgreSQL rechaza la segunda escritura concurrente con el mismo
`(clave_entidad, version)` en vez de aceptar ambas silenciosamente como hace
hoy el adaptador de fichero — convierte una corrupción silenciosa de la
cadena de versiones en un error explícito que el escritor puede reintentar
con el número de versión correcto.

`(project_id, entity_id)`, `(project_id, evidence_id)` y
`(project_id, observed_at)` quedan cubiertos por los índices propuestos
arriba; las consultas temporales (`obtenerEventosProyecto`, replay por
instante) se benefician directamente de `idx_lake_proyecto`.

---

## 15. Object storage model (diseño, no despliegue)

Qué NO debería vivir directamente en PostgreSQL, con referencia desde la
tabla `lake_records`/`territorial_evidence_observations` vía una tabla de
objetos:

```sql
CREATE TABLE object_references (
  object_key      TEXT PRIMARY KEY,   -- ruta/clave en el bucket
  hash            TEXT NOT NULL,      -- integridad de contenido
  size_bytes      BIGINT NOT NULL,
  content_type    TEXT NOT NULL,
  provider        TEXT,
  observed_at     TIMESTAMPTZ,
  retention_class TEXT NOT NULL,      -- ver §16
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Candidatos a mover a object storage en vez de JSONB inline: payloads brutos
de proveedor (`rawMetadataReference.conservado` cuando se decida conservarlo),
capturas/artefactos de evidencia autorizados, reportes exportados, y
cualquier documento grande que hoy no existe pero que Investigaciones/Lado B
va a producir. Compatible conceptualmente con S3; **no se elige proveedor en
este gate** (ver §19).

---

## 16. Retention

Clases propuestas, con recomendación explícita de que ninguna de estas es
capacidad actual — son diseño para aprobación:

| Clase | Retención propuesta | Backup | Notas |
|---|---|---|---|
| `STRUCTURED_METRIC` | indefinida mientras el proyecto esté activo | sí | snapshots de métricas — es la base de Momentum |
| `PUBLIC_EVIDENCE` | indefinida mientras el proyecto esté activo | sí | evidencia observable pública, no perfiles de comentaristas individuales |
| `RAW_PROVIDER_RESPONSE` | corto plazo (p. ej. 30-90 días) salvo que se marque como evidencia | opcional | por defecto hoy NO se conserva (`conservado: null`), ver §9 |
| `DERIVED_ANALYTICS` | mientras el proyecto esté activo | sí | resultados de NLP agregado, no perfiles individuales |
| `REPORT` | según política de cliente/campaña | sí | exportes formales |
| `TEMPORARY_ARTIFACT` | días | no | resultados intermedios de depuración |

**Principio ya presente en el código y que se mantiene:** no se construyen
perfiles personales de comentaristas — se guarda lo necesario para dedupe,
evidencia y NLP agregado, no para enriquecer individuos.

---

## 17. Backup/restore (recomendación, no capacidad actual)

**Hoy: cero.** Confirmado por ausencia total de código de backup, restore,
recuperación de corrupción o checksum de recuperación en los siete módulos
de almacenamiento auditados. Los únicos mecanismos "defensivos" existentes
son de solo-lectura: cada lector hace `try/catch` alrededor de
`JSON.parse` por línea y descarta líneas corruptas con un `console.error`
(no repara, no pone en cuarentena, no alerta más allá del log), y
`lakeReader.verificarTodo()`/`lakeWriter.verificar()` detectan alteración de
hash pero no corrigen nada — son auditoría, no recuperación.

**Recomendación** (RPO/RTO como propuesta, no SLA comercial):

- Backup automatizado diario de `apps/backend/data/` mientras siga en
  filesystem, y de la base de datos vía `pg_dump`/WAL una vez exista.
- RPO recomendado: ≤ 24h mientras se opera sobre filesystem plano (backup
  diario), ≤ 15 min una vez exista PostgreSQL con point-in-time recovery.
- RTO recomendado: a definir con el usuario según criticidad de campaña; no
  se propone un número sin ese contexto.
- Prueba de restore periódica obligatoria — un backup nunca probado no es un
  backup, es una copia sin verificar.

---

## 18. Migration strategy (propuesta, no ejecutada)

Fase A. El Lake de fichero actual sigue siendo la fuente de verdad; no se
toca.

Fase B. Construir `crearAdaptadorPostgres()` detrás de la misma interfaz
`anexar()`/`leerTodos()` de `lakeAdapter.js` — cero cambios en
`projectStore.js`, `pieceStore.js` ni ningún consumidor, exactamente igual
que pasar de `memoria` a `fichero` no cambió una línea del resto del Lake.

Fase C. Dual-read: escribir en ambos adaptadores en paralelo (fichero real +
Postgres experimental) durante una ventana de prueba, sin que Postgres sea
aún la fuente de verdad.

Fase D. Migrar una copia del corpus histórico (los 22 ficheros actuales,
5.76 MB) a Postgres mediante un script de importación que reproduzca
`leerTodos()` de cada adaptador de fichero y lo inserte respetando el orden
de versión.

Fase E. Comparar: conteo de registros, IDs, hashes, timestamps, relaciones,
cadenas de versión — usando exactamente `lakeReader.verificarTodo()` como
base de comparación de integridad entre ambos.

Fase F. Cambiar el adaptador por defecto a Postgres vía
`SENTINEL_LAKE_ADAPTER`.

Fase G. Mantener el adaptador de fichero disponible y los datos migrados
intactos como rollback durante un periodo de gracia.

**No se ejecuta ninguna fase de esta más allá del diseño en este gate.**

---

## 19. Contract tests

Suite mínima transversal propuesta para que cualquier adaptador
(`memoria` | `fichero` | `postgres` futuro) pase exactamente las mismas
pruebas:

- create / read
- append (nunca update destructivo)
- dedupe (por `claveEntidad`+contenido)
- historial de snapshots / versión
- aislamiento de proyecto
- aislamiento de tenant
- procedencia (`provenance`/`linaje` se conservan)
- persistencia tras reinicio
- escrituras concurrentes (detectar colisión de versión, no solo "no perder
  líneas")
- consulta por tiempo / por entidad / por evidencia
- paridad de migración (mismo resultado en fichero y en el adaptador nuevo)

**Ya implementado en este gate**, como fundación aislada de esta suite (no
modifica ningún módulo de negocio, corre contra fixtures propios en
directorio temporal):

- `apps/backend/tests/storage/lakeRestartPersistence.test.mjs` — persistencia
  tras reinicio (fichero vs. memoria).
- `apps/backend/tests/storage/lakeConcurrentWrites.test.mjs` — colisión de
  versión bajo escritura concurrente.
- `apps/backend/tests/storage/lakeProjectIsolation.test.mjs` — aislamiento
  estructural de proyecto.

Ejecución: `node tests/storage/<archivo>.test.mjs` desde `apps/backend/`
(no están cableados a `package.json`, deliberadamente, porque ese archivo
tiene cambios sin commitear de otra terminal fuera de nuestro alcance).

---

## 20. Infrastructure options — DECISIÓN PENDIENTE

Comparación breve para PostgreSQL gestionado + almacenamiento de objetos
compatible con S3, sobre los requisitos reales encontrados (append-only con
integridad verificable, project isolation, LATAM/Ecuador como mercado
primario, coste inicial bajo, sin equipo de operación de infraestructura
dedicado):

| Criterio | Managed PostgreSQL (ej. RDS/Cloud SQL/Supabase) | Object storage S3-compatible (ej. S3/R2/B2/MinIO auto-alojado) |
|---|---|---|
| Simplicidad | Alta si es gestionado; requiere modelar el adaptador nuevo | Alta, API S3 es estándar de facto |
| Coste inicial | Bajo en tiers pequeños; crece con almacenamiento+cómputo | Muy bajo, cobro por GB almacenado y egress |
| Backups | Nativos en los tres proveedores gestionados evaluados | Versionado de objetos nativo en S3/R2; MinIO requiere configurarlo |
| Latencia Ecuador/LATAM | Depende de región disponible; ninguno de los tres tiene datacenter en Ecuador — la región más cercana determina la latencia real, no evaluada aún | Igual — depende de la región elegida |
| Escalabilidad | Alta, vertical y con réplicas de lectura | Prácticamente ilimitada por diseño del modelo de objetos |
| Vendor lock-in | Bajo si se usa PostgreSQL estándar sin extensiones propietarias | Bajo, API S3 es portable entre proveedores |
| Seguridad | TLS + IAM nativo en los gestionados | Igual, con políticas de bucket |
| Integración Node.js | Excelente, `pg` es la librería estándar y madura | Excelente, SDKs oficiales de AWS/Cloudflare/Backblaze son maduros |
| Operación | Mínima si es gestionado (el proveedor gestiona parches/HA) | Mínima si es gestionado; MinIO auto-alojado añade carga operativa que Sentinel no tiene equipo para asumir hoy |

**Recomendación de dirección, sujeta a aprobación explícita del usuario:**
un PostgreSQL gestionado (no auto-alojado) más un object storage
S3-compatible gestionado (no MinIO auto-alojado, dado que el equipo de
Sentinel no tiene hoy capacidad operativa dedicada a infraestructura). La
elección de proveedor concreto queda **DECISIÓN PENDIENTE** hasta que el
usuario apruebe presupuesto y región.

---

## 21. Risks

1. **Race de versión bajo escritura concurrente** (§12) — confirmado
   empíricamente, severidad alta si dos terminales/motores escriben al mismo
   expediente en la misma ventana de tiempo.
2. **Reconstrucción de índice O(volumen total) en cada arranque** (§10) —
   hoy insignificante (5.76 MB), se vuelve un problema de tiempo de arranque
   sin compactación a medida que la campaña avanza.
3. **Cero backup/restore** (§17) — pérdida total del disco es pérdida total
   del corpus, sin ningún mecanismo de recuperación hoy.
4. **Aislamiento de proyecto no estructural en universo de fuentes y
   evidencia legada** (§7) — riesgo bajo hoy (son datos compartidos por
   diseño o huecos ya reconocidos), pero debe documentarse antes de que
   alguien asuma "0 fugas" como garantía universal.
5. **Destino de persistencia no confirmado para observaciones de
   publicación/comentario** (§5/§6) — hallazgo abierto: no se pudo verificar
   en el código auditado dónde aterrizan estos objetos, lo cual es un riesgo
   de opacidad más que de pérdida de datos (el propio módulo de negocio que
   los usa sabrá su destino real; queda para el siguiente gate confirmarlo
   con quien mantiene esos módulos, sin asumir).
6. **Doble escritura volátil en `pieceSnapshot.js`** (§4) — no es pérdida de
   dato (el Lake es la fuente autoritativa), pero es trabajo duplicado sin
   beneficio claro más allá de un caché de proceso que ya se documenta a sí
   mismo como "para el MVP y los tests".
7. **Cuatro implementaciones redundantes del mismo patrón de
   adaptador memoria/fichero** en los almacenes territoriales — no es un
   riesgo de datos, es deuda de mantenimiento: un fix de concurrencia o de
   integridad habría que aplicarlo cuatro veces si no se factoriza.

---

## 22. Recommended next gate

1. Implementar el adaptador PostgreSQL (§14/§18 Fase B) como cuarto
   adaptador detrás de la interfaz existente, empezando por la constraint
   `UNIQUE(clave_entidad, version)` que resuelve directamente el riesgo #1.
2. Confirmar con el mantenedor de `intelligence/publicationObservation.js` y
   `commentObservation.js` dónde persisten realmente hoy sus objetos
   fusionados (hallazgo abierto §5/§21) antes de diseñar su tabla Postgres.
3. Evaluar compactación/archivado del Lake de fichero como mitigación de
   corto plazo del riesgo #2, independiente de si se migra a Postgres.
4. Diseñar (no implementar) el mecanismo de backup automatizado mínimo
   sobre el filesystem actual mientras se decide la infraestructura
   definitiva — no dejar el corpus sin ninguna copia mientras dura la
   migración.
5. Someter la comparación de infraestructura (§20) al usuario para decisión
   de presupuesto/región antes de cualquier compra o despliegue.

`SENTINEL_PROJECT_STATE.md` tenía cambios sin commitear de otra terminal en
el momento de este gate; su actualización queda pendiente, tal como exige la
directiva original, para no interferir con trabajo ajeno.

---

## 23. Veredicto

**Clasificación del almacenamiento actual: APTO_CON_LIMITACIONES.**

No es `RIESGO_DE_PERDIDA`: el mecanismo de escritura es append-only de
verdad (confirmado por ausencia de rutas de código que sobrescriban, §5/§17),
sobrevive a un reinicio real cuando se usa el adaptador de producción
(confirmado empíricamente, §11), y el aislamiento de proyecto para el núcleo
del negocio es estructural y no un filtro opcional (confirmado
empíricamente, §7/§12).

No es `APTO_PRODUCCION` sin matices: hay una race de integridad de versión
confirmada bajo concurrencia real (§12), cero backup/restore (§17), y
crecimiento sin compactación que hoy es intrascendente pero no lo será tras
meses de campaña activa (§10).

**¿Se puede empezar campaña hoy confiando en que el histórico sobrevive?**

**SÍ, CON LIMITACIONES.** El histórico sí sobrevive a operación normal —
reinicios de backend, archivado/eliminación lógica de proyectos, múltiples
lecturas repetidas — siempre que el backend corra con
`SENTINEL_LAKE_ADAPTER=fichero` (el default) y nadie lo cambie a `memoria`
en producción por error. Las dos condiciones que deben vigilarse activamente
desde el primer día de campaña, no después:

1. Ningún backup existe todavía. Si el disco se pierde, el corpus se pierde
   íntegro. Esto debe resolverse (aunque sea con un backup manual/cron
   simple copiando `apps/backend/data/` a otro disco) antes de que el
   volumen de campaña haga esa pérdida costosa de verdad, no después de que
   ya lo sea.
2. Si más de una terminal/motor puede escribir al expediente del MISMO
   candidato en la misma ventana de tiempo, existe un riesgo confirmado de
   colisión de versión. Mientras no exista una mitigación (cola de
   escritura, lock, o la constraint de Postgres propuesta en §14), conviene
   evitar operativamente que dos procesos investiguen al mismo candidato de
   forma simultánea.

Ninguna de las dos limitaciones bloquea empezar hoy; ambas deben tratarse
como trabajo de la primera semana de operación real, no como deuda técnica
diferible indefinidamente.

---

# ADDENDUM — DISASTER RECOVERY PLAN

Añadido en un segundo gate, con rol de Senior Staff Data Platform Engineer +
SRE + arquitecto PostgreSQL. Principio de negocio: se debe poder perder por
completo el equipo de desarrollo y reconstruir Sentinel en otra máquina sin
perder código, proyectos, candidatos, assets, observaciones, snapshots,
métricas, medios, territorio, temas, evidencias, histórico ni reportes.

Todo lo que sigue es **diseño y verificación de estado actual**. No se ha
contratado Supabase, no se ha contratado Cloudflare R2, no se ha movido
ningún dato real, no se ha hecho push. Coste: $0. Requests externas:
únicamente lecturas de documentación pública de Supabase y Cloudflare para
no asumir capacidades de memoria (política explícita de este gate).

## A.1 Auditoría de git remoto (solo lectura, sin credenciales impresas)

```
git remote -v
  origin  https://github.com/DavidFierro23/Sentinel-Intelligence.git (fetch)
  origin  https://github.com/DavidFierro23/Sentinel-Intelligence.git (push)

git branch -vv
  * dev   [origin/dev: ahead 77]  feat(territorial): expand Cuenca local source universe
    main  [origin/main]           feat: Sentinel Intelligence Platform foundation (Milestone 1)

git status
  On branch dev, ahead of 'origin/dev' by 77 commits.
```

**CODE_OFFSITE_BACKUP: PARCIAL.**

Existe un remoto real en GitHub y `main`/`dev` tienen historia empujada en
algún punto pasado. Pero la rama de trabajo actual, `dev`, tiene **77
commits que existen únicamente en este equipo** — incluida toda la auditoría
de persistencia de este mismo gate y, previsiblemente, trabajo reciente de
las otras tres terminales activas (Candidate, Territorial, Media). Si este
equipo se pierde hoy, esos 77 commits desaparecen con él: el código en
GitHub queda 77 commits desactualizado respecto al último estado de trabajo.

**Esto se clasifica como RIESGO CRÍTICO**, no menor: no es un backup de datos
lo que falta aquí, es la mitad del "no depender de la laptop" — el código
mismo. La mitigación es mecánica y de bajo riesgo (`git push origin dev`),
pero **no se ejecuta en este gate**: un push no fue solicitado explícitamente
y esta auditoría se limita a leer y reportar, tal como exige la directiva
original ("NO hacer push automáticamente").

## A.2 Backup offsite de `apps/backend/data` (mientras JSONL sea la fuente de verdad)

`apps/backend/data/` está en `.gitignore` a propósito (correcto: un backup de
datos no debe vivir en el historial de git, que es público/compartido y no
está pensado para binarios de gran tamaño creciente). Eso significa que hoy
**no existe ninguna copia offsite de los datos**, solo la copia local en este
equipo — confirmado por la ausencia total de credenciales de backup en
`.env.example` (§9 del cuerpo principal) y de cualquier script de backup
antes de este gate.

**Preparado en este gate** (no ejecutado, requiere configuración externa
explícita antes de poder correr):

- `apps/backend/scripts/backup/backup-data-offsite.sh` — empaqueta
  `apps/backend/data` en un `.tar.gz` con fecha, calcula SHA-256, y lo sube
  vía `rclone` a cualquier remoto S3-compatible (R2, S3, B2, MinIO — sin
  atarse a uno). No incluye ningún secreto: las credenciales del remoto
  viven en la configuración propia de `rclone`, fuera del repo.
- `apps/backend/scripts/backup/restore-data-offsite.sh` — contraparte:
  descarga el paquete más reciente (o uno específico), **verifica el
  checksum antes de extraer**, y nunca sobrescribe un directorio destino que
  ya tenga contenido.

Por qué `rclone` y no un SDK: evita añadir una dependencia npm nueva a
`apps/backend/package.json`, que en este gate está fuera de alcance (cambios
mezclados de otra terminal), y habla el mismo protocolo con cualquier
proveedor S3-compatible — exactamente el requisito de "no vendor lock-in".

**DATA_OFFSITE: NO** (script listo, remoto sin configurar todavía — esto es
lo primero a resolver, antes que la migración a Postgres, porque cubre el
riesgo de pérdida total mientras JSONL siga siendo la fuente de verdad).

## A.3 Política de backup de PostgreSQL — Supabase (verificado en documentación oficial, no de memoria)

Fuente: `supabase.com/docs/guides/platform/backups`, `supabase.com/pricing`,
consultadas en este gate.

| Capacidad | Free | Pro ($25/mes) | Team ($599/mes) | Enterprise |
|---|---|---|---|---|
| Backups automáticos diarios | **No** | Sí | Sí | Sí |
| Retención de backup diario | — | 7 días | 14 días | 30 días (negociable) |
| Point-in-Time Recovery (PITR) | No disponible | Add-on de pago | Add-on de pago | Add-on de pago |
| Coste de PITR | — | ~$100/mes por cada ventana de 7 días (7/14/28 días = $100/$200/$400) | igual | negociable |

Detalles que cambian el diseño:

- **PITR sustituye al backup diario**, no lo complementa — al activarlo,
  Supabase deja de correr el backup diario clásico porque PITR (WAL
  continuo) ya es un superconjunto. Requiere además un add-on de cómputo
  mínimo ("Small"), coste adicional.
- **Restore es self-service** desde el Dashboard, sin ticket de soporte —
  pero el proyecto queda **inaccesible durante el restore**, y la duración
  del downtime depende del tamaño de la base. Esto debe planearse como una
  ventana de mantenimiento, no como una operación instantánea.
- **Los objetos de Storage API (buckets/archivos) NO están incluidos en el
  backup de la base de datos** — solo sus metadatos. Esto confirma que la
  estrategia de object storage (R2, §A.4) necesita su propio backup
  independiente del backup de Postgres; no se puede asumir que "hacer backup
  de la DB" cubre también los archivos.
- **Free tier no tiene backups automáticos en absoluto** y los proyectos
  gratuitos se pausan por inactividad (con aviso previo, recuperables hasta
  un año vía dashboard). Para Sentinel esto descarta el tier Free como
  opción seria desde el primer día de campaña real, más allá de una prueba.
- **Exportación independiente disponible siempre**, incluso sin backups
  gestionados: `supabase db dump --db-url <conexión> -f schema.sql` (y
  variantes `--data-only`, `--role-only`), o `pg_dump` directo contra el
  connection string. Esto es lo que permite una copia offsite VERDADERAMENTE
  independiente del propio backup de Supabase — no depender de un solo
  proveedor para tener un solo backup es el punto central del 3-2-1 (§A.6).
- **No confirmado en la documentación oficial**: si el almacenamiento de los
  backups de Supabase es multi-región o solo redundante dentro de una
  región. No se asume ninguna de las dos cosas.

**Recomendación de tier si Supabase se aprueba**: Pro como mínimo (no Free),
con PITR activado antes de considerar la migración "en producción" — sin
PITR, el RPO real de Supabase por sí solo sería de hasta 24h (backup diario),
que es peor que el RPO propuesto en §A.7.

`DB_BACKUP` y `DB_PITR` se marcan **PENDIENTE** más abajo porque hoy no
existe ningún proyecto Postgres desplegado — esto es la política verificada
para cuando se decida desplegarlo, no una capacidad actual.

## A.4 Cloudflare R2 — durabilidad, protección y backup (verificado, no de memoria)

Fuente: `developers.cloudflare.com/r2/*`, consultadas en este gate.

- **Durabilidad publicada: 99.999999999% (once nueves) anual**, por erasure
  coding + replicación **dentro de una región** (múltiples datacenters, no
  múltiples regiones geográficas). Es una cifra única, no escalonada por
  plan.
- **Hallazgo importante — R2 NO tiene versionado nativo de objetos hoy.**
  `GetBucketVersioning`/`PutBucketVersioning` figuran como no soportados en
  la API S3-compatible de R2, y existe una petición de la comunidad pidiendo
  esta característica, todavía sin resolver. **Esto es distinto de lo que
  suele asumirse de un almacenamiento S3-compatible por comparación con AWS
  S3**, y cambia el diseño: no se puede confiar en "activar versionado" como
  protección contra sobrescritura accidental o bug de aplicación.
- **Mitigación real disponible: Bucket Locks (WORM)** — impiden borrar o
  sobrescribir objetos durante un periodo (o indefinidamente), por bucket o
  por prefijo, hasta 1000 reglas, la más estricta gana. Limitación
  relevante: **un bucket no puede vaciarse mientras tenga reglas de lock
  activas**, así que hay que dimensionar la duración del lock con cuidado.
  No es modo "compliance" al estilo AWS (sin legal hold verdadero) — es
  gobernanza, no inmutabilidad regulatoria.
- **Reglas de ciclo de vida** existen (expiración, transición a Infrequent
  Access, limpieza de multipart incompletos) — útiles para `retention` de
  `RAW_PROVIDER_RESPONSE`/`TEMPORARY_ARTIFACT` (§16 del cuerpo principal),
  no para backup.
- **No existe replicación ni backup cruzado nativo entre proveedores.**
  Super Slurper y Sippy son herramientas de migración de ENTRADA hacia R2,
  no de respaldo de SALIDA — replicar R2 hacia un segundo bucket/proveedor
  requiere un script propio (el mismo patrón `rclone` de §A.2 sirve aquí
  también, porque R2 habla S3).
- **Egreso gratuito confirmado, sin excepción documentada por destino** — un
  script de backup que saque datos de R2 hacia otro proveedor no paga
  egreso por el lado de Cloudflare.
- **Control de acceso:** tokens de API con 4 niveles; los de nivel Objeto
  (no Admin) pueden acotarse a un bucket específico — recomendación directa
  de esta auditoría: usar SIEMPRE tokens de objeto acotados a un bucket, no
  tokens Admin de cuenta completa, para limitar el radio de daño de una
  credencial comprometida.
- **Precio orientativo:** almacenamiento estándar $0.015/GB-mes; 10 GB +
  1M operaciones Clase A + 10M operaciones Clase B gratis al mes.

**Consecuencia de diseño directa del hallazgo de versionado ausente:** dado
que Sentinel ya diseña su Lake como append-only con claves de contenido
(`lakeHash.js`, `evidenceId` por hash), la misma disciplina debe aplicarse a
los objetos en R2: **nunca reescribir la misma clave de objeto**. Cada
versión de un artefacto (captura, documento, export) debe escribirse con una
clave nueva derivada de su hash de contenido, igual que ya hace el Lake con
sus entidades. Esto convierte la ausencia de versionado nativo de R2 en un
no-problema para Sentinel específicamente, porque el patrón de escritura ya
iba a ser inmutable por diseño — pero es una regla que hay que imponer
explícitamente en el futuro adaptador de object storage, no algo que R2 dé
gratis.

**Recordatorio explícito del gate, confirmado por lo anterior: DURABILIDAD
≠ BACKUP.** Once nueves de durabilidad protege contra fallo de hardware de
Cloudflare. No protege contra: borrado accidental por un humano con
permisos, un despliegue con bug que sobrescribe/borra por clave equivocada,
o una credencial comprometida que borra el bucket — para eso hacen falta
Bucket Locks + tokens acotados + una copia independiente fuera de R2 (§A.6).

## A.5 ¿Supabase + R2 satisfacen los requisitos reales? — evaluación, no asunción

| Requisito de este gate | Supabase | Cloudflare R2 |
|---|---|---|
| Contrato estándar (Postgres / S3 API) | Sí, Postgres real, sin extensiones propietarias obligatorias | Sí, API S3-compatible |
| Backup gestionado | Sí, desde Pro ($25/mes) | No aplica (es object storage, no DB) |
| PITR | Sí, add-on de pago, ~$100–400/mes según ventana | No aplica |
| Restore self-service | Sí, con downtime proporcional al tamaño | No aplica directamente; restaurar un objeto es una operación de copia normal |
| Durabilidad | Estándar de Postgres gestionado (no auditado en detalle en este gate: fuera de alcance, es responsabilidad de Supabase/su proveedor cloud subyacente) | 11 nueves publicados |
| Protección contra sobrescritura/borrado accidental | Backups + PITR cubren la DB | **No hay versionado nativo — mitigar con Bucket Locks + claves inmutables por hash** |
| Egreso/coste para operar desde Ecuador/LATAM | Sin datacenter en la región; latencia no medida en este gate | Egreso gratuito, pero latencia tampoco medida en este gate |
| No vendor lock-in | Alto: Postgres estándar, `pg_dump` funciona siempre | Alto: API S3 estándar, migrable a AWS S3/otros con el mismo `rclone` |
| Coste para el tamaño actual de Sentinel (~6 MB) | Insignificante a este volumen; el coste real vendrá de cómputo/PITR, no de almacenamiento | Insignificante; probablemente dentro del tier gratuito por meses |

**Conclusión de esta evaluación: Supabase + Cloudflare R2 SÍ satisfacen los
requisitos reales encontrados** (contratos estándar, backup gestionado,
coste bajo al volumen actual, sin lock-in duro), **con dos condiciones que
deben cumplirse antes de declarar esto "listo para producción"**: (1) activar
el add-on de PITR en Supabase antes de confiar en él como única fuente de
recuperación de la DB, y (2) compensar la ausencia de versionado nativo de
R2 con Bucket Locks + disciplina de claves inmutables por hash. Ninguna de
las dos es una razón para descartar la combinación; ambas son configuración
pendiente, no defectos que obliguen a buscar otro proveedor. La decisión
final de contratar sigue siendo **DECISIÓN PENDIENTE** del usuario (§20 del
cuerpo principal).

## A.6 Estrategia 3-2-1 lógica para Sentinel

No se diseña una arquitectura enterprise innecesaria — tres copias reales,
razonables para una campaña activa:

1. **Producción**: PostgreSQL en Supabase (entidades/relaciones/versiones) +
   Cloudflare R2 (evidencia bruta, artefactos, reportes). Esta es la copia
   "caliente", la que sirve tráfico.
2. **Backup del propio servicio**: backups diarios + PITR de Supabase
   (dentro de la infraestructura de Supabase, gestionados por ellos); para
   R2, Bucket Locks sobre los prefijos de evidencia como protección contra
   borrado, más lifecycle rules para lo temporal.
3. **Copia/export independiente, fuera de ambos proveedores**: un `pg_dump`
   periódico (vía `supabase db dump` o directo) subido a un bucket
   S3-compatible DISTINTO del que sirve producción (puede ser otro bucket en
   otra cuenta de R2, o incluso otro proveedor como Backblaze B2, usando el
   mismo `rclone`), más el mismo mecanismo para un export de los objetos
   críticos de R2. Esta es la copia que sobrevive aunque Supabase Y
   Cloudflare tengan un incidente simultáneo o una cuenta se vea
   comprometida — el escenario que un backup "dentro del mismo proveedor"
   nunca cubre.

Mientras no exista Postgres (hoy), el punto 1 es el Lake de fichero local, el
punto 2 no existe todavía (§A.2, pendiente de configurar remoto), y el punto
3 tampoco. Es decir: **hoy Sentinel tiene 1 de 3 copias.** Pasar de 1 a 2
copias (configurar el remoto de `backup-data-offsite.sh`) es la acción de
mayor impacto por menor esfuerzo de todo este addendum.

## A.7 RPO / RTO propuestos (propuesta, no promesa)

| | Objetivo propuesto | Justificación |
|---|---|---|
| **RPO** (cuánto histórico se puede permitir perder) | **≤ 24 horas mientras el Lake siga siendo JSONL en disco local** (un backup diario offsite cubre esto una vez configurado); **≤ 15 minutos una vez exista Supabase con PITR activado** | Sentinel opera con datos observables públicos que se re-observan por diseño (`evidenceLedger`, `sourceUniverseStore` vuelven a comprobar), así que perder unas horas de la ÚLTIMA observación es recuperable re-ingresando; perder DÍAS de expedientes de candidato acumulados (cuentas declaradas por analista, ejecuciones históricas) no lo es, porque esas decisiones humanas no se vuelven a generar solas. |
| **RTO** (cuánto tiempo para recuperar servicio) | **≤ 4 horas para un equipo de desarrollo nuevo con el código ya en GitHub** (clonar, instalar, restaurar el backup de datos más reciente, levantar); **el downtime del restore de Supabase mismo queda fuera de este número** porque lo determina el tamaño de la base en el momento y Supabase no lo garantiza | No se promete un SLA comercial. 4 horas es razonable para un equipo pequeño sin guardia 24/7, asumiendo que el código YA está en GitHub (lo cual hoy NO es cierto del todo, §A.1) y que existe un backup de datos offsite reciente (lo cual hoy tampoco es cierto, §A.2). |

Estos números son alcanzables **una vez** se resuelvan los dos huecos
marcados PENDIENTE/NO en el estado final (§A.9) — no son una descripción de
la capacidad de recuperación actual, que hoy es peor que esto.

## A.8 Secretos — qué necesita recuperación, sin leer ni imprimir ninguno

Inventario conceptual, por nombre de variable únicamente, tomado de
`apps/backend/.env.example` (plantilla pública, sin valores):

- `SERPAPI_KEY`, `BRAVE_API_KEY`, `YOUTUBE_API_KEY` — proveedores de
  búsqueda/plataforma.
- `INSTAGRAM_ACCESS_TOKEN`, `FACEBOOK_USER_ACCESS_TOKEN`, `META_APP_ID`,
  `META_APP_SECRET` — familia Meta, dos tokens NO intercambiables (ver
  comentarios del propio `.env.example`).
- Futuras, comentadas y no activas: `BRIGHTDATA_API_KEY`, `DATA365_API_KEY`.
- Futuras, no existentes todavía pero necesarias tras este addendum: la
  cadena de conexión de Postgres (Supabase) y las credenciales de R2 (Access
  Key ID + Secret, o el token de R2 acotado a bucket recomendado en §A.4),
  más la configuración de `rclone` (`rclone.conf`) que usan los scripts de
  §A.2.

**Hallazgo de esta auditoría, sin leer su contenido:** existe un
`apps/backend/.env.bak` en disco (visible en el listado de archivos, no
abierto ni leído para esta auditoría). Es una copia sin cifrar de secretos,
en `.gitignore` (correcto, no está en git), pero **es exactamente el tipo de
archivo que desaparece si se pierde la laptop** — un backup de secretos que
solo existe en el mismo disco que se supone que estamos protegiendo contra
pérdida no cumple ninguna función de disaster recovery.

**Recomendación** (no implementada, requiere decisión y acceso del usuario):
mover la fuente de verdad de secretos a un gestor dedicado con backup propio
— opciones razonables para el tamaño de Sentinel: 1Password/Bitwarden con
un "vault" de equipo (bajo coste, ya resuelve compartir credenciales entre
terminales/personas), o variables de entorno gestionadas del propio
proveedor de despliegue si Sentinel llega a desplegarse en un servicio
gestionado (Railway/Render/Fly.io u otro) en vez de en la laptop. Lo mínimo
no negociable: que las credenciales necesarias para reconstruir Sentinel NO
vivan exclusivamente en `C:\Users\David\...`.

## A.9 Runbook — "laptop completamente perdida/robada/destruida"

Procedimiento exacto, con los comandos reales del repo (`package.json` raíz
y de `apps/web`), asumiendo que para cuando esto se necesite ya se resolvió
§A.1 (push pendiente) y §A.2 (backup offsite configurado):

1. **Adquirir/nuevo equipo** con Node.js instalado (versión compatible con
   `apps/web` — React 19 / Vite; no se fija aquí una versión exacta porque
   ninguno de los `package.json` del repo declara `engines`, hallazgo en sí
   mismo a corregir en un gate de tooling).
2. **Clonar repo remoto**: `git clone https://github.com/DavidFierro23/Sentinel-Intelligence.git`
   → esto solo recupera el código si §A.1 se resolvió (push hecho) antes de
   la pérdida. Verificar con `git log -1` que el commit más reciente
   coincide con lo esperado.
3. **Instalar dependencias**: `npm install` en la raíz (workspaces),
   confirmando que `apps/backend/package.json` y `apps/web/package.json` se
   resuelven sin error.
4. **Recuperar secretos de forma segura**: desde el gestor de secretos
   propuesto en §A.8 (NO desde ningún `.env.bak` de la laptop perdida, que
   por definición ya no existe) — reconstruir `apps/backend/.env` a partir
   de `apps/backend/.env.example` con los valores reales.
5. **Conectar DB**: configurar la cadena de conexión de Supabase recuperada
   en el paso 4. Confirmar conectividad con una consulta trivial antes de
   continuar.
6. **Conectar object storage**: configurar credenciales de R2 recuperadas en
   el paso 4, y la configuración de `rclone` para los scripts de §A.2.
7. **Restaurar backup si producción también sufrió pérdida/corrupción**:
   - Datos JSONL (mientras sigan siendo la fuente de verdad):
     `apps/backend/scripts/backup/restore-data-offsite.sh apps/backend/data`
   - Postgres (una vez migrado): restore de Supabase vía Dashboard (con
     downtime esperado, §A.3) o `pg_restore` desde el `pg_dump` más reciente
     de la copia independiente (§A.6, punto 3) si el incidente afectó a
     Supabase mismo.
   - R2: copiar de vuelta desde la copia independiente (§A.6, punto 3) los
     prefijos afectados.
8. **Validar checksums/counts**: comparar `sha256sum` del paquete restaurado
   contra el `.sha256` subido junto a él (automático dentro de
   `restore-data-offsite.sh`), y contar líneas JSONL por almacén
   (`find data -name "*.jsonl" -exec wc -l {} +`) contra el conteo esperado
   antes de la pérdida (documentado en el último backup exitoso, §A.2). No
   se declara un restore exitoso solo porque "no dio error".
9. **Levantar backend**: `npm run dev:backend` desde la raíz (equivalente a
   `node server.js` dentro de `apps/backend`).
10. **Levantar frontend**: `npm run dev:web` desde la raíz (Vite).
11. **Comprobar proyectos e histórico**: abrir la interfaz, listar proyectos
    (`listarProyectos()`), abrir el contenido de al menos un proyecto
    conocido (`contenidoDeProyecto()`) y confirmar que candidatos,
    expedientes y ejecuciones coinciden con lo esperado antes del incidente
    — el mismo tipo de verificación que ya hace
    `tests/persistencia.test.mjs`, pero contra el dato real restaurado, no
    contra un fixture.

**Objetivo futuro explícito, aún no alcanzado**: que ningún paso de este
runbook dependa de un fichero exclusivo de `C:\Users\David\...`. Hoy el paso
4 (secretos) y, mientras no se configure §A.2, el paso 7 (backup de datos),
SÍ dependen de esta máquina. Ese es precisamente el hueco que este addendum
existe para cerrar.

## A.10 Escenarios de recuperación adicionales (más allá de "laptop perdida")

- **Pérdida/corrupción de la DB (una vez exista Postgres)**: restore vía
  PITR de Supabase al segundo anterior al incidente (si el add-on está
  activo) o al backup diario más reciente (si no). Downtime esperado según
  §A.3. Verificar con `lakeReader.verificarTodo()`-equivalente sobre
  Postgres (a diseñar en el siguiente gate) antes de reabrir tráfico.
- **Borrado accidental** (de un objeto en R2, o de una fila en Postgres):
  para R2, un objeto protegido por Bucket Lock no puede haberse borrado
  mientras la regla estuviera activa — si se borró, es que no había regla
  cubriéndolo, lo cual es en sí mismo un hallazgo de configuración a
  corregir. Para Postgres, el append-only del modelo del Lake (§14 del
  cuerpo principal) significa que un "borrado" de negocio ya es lógico
  (marcar `estado: eliminado`), no físico — un DELETE físico accidental
  sobre `lake_records` sería un incidente de operación, cubierto por PITR.
- **Pérdida de object storage completo (bucket eliminado)**: cubierto
  únicamente por la copia independiente de §A.6 punto 3 — ni la durabilidad
  de 11 nueves ni los Bucket Locks protegen contra el borrado del bucket
  entero por quien tiene permisos de administrador de cuenta, que es
  exactamente por qué el punto 3 debe vivir en una cuenta/proveedor distinto.
- **Credencial comprometida**: mitigado por el uso de tokens R2 acotados a
  un bucket (§A.4) en vez de tokens Admin — limita qué puede hacer un
  atacante con una sola credencial filtrada. Para Postgres, credenciales de
  aplicación con privilegios mínimos (no el rol de superusuario de Supabase)
  para el uso cotidiano del backend.
- **Corrupción del Lake de fichero (mientras siga en uso)**: ya cubierto en
  el cuerpo principal (§8 original): las líneas corruptas se descartan en
  lectura, no se reparan. La única recuperación real es el backup offsite
  de §A.2 — no existe reparación en el propio formato JSONL.
- **Rollback de una migración** (Fase F/G de §18 del cuerpo principal): el
  adaptador de fichero permanece disponible y con los datos intactos durante
  el periodo de gracia — volver a `SENTINEL_LAKE_ADAPTER=fichero` es
  reversible mientras esa fase no se cierre formalmente.

## A.11 Estado de Disaster Recovery — no se declara nada "protegido" sin prueba

| Estado | Valor | Motivo |
|---|---|---|
| `CODE_OFFSITE` | **PARCIAL** | remoto existe, pero 77 commits de `dev` solo están en este equipo (§A.1) |
| `DATA_OFFSITE` | **NO** | script listo (§A.2), remoto sin configurar |
| `DB_BACKUP` | **PENDIENTE** | Supabase no contratado todavía; política verificada (§A.3), no activa |
| `DB_PITR` | **PENDIENTE** | depende de `DB_BACKUP`; es un add-on de pago, no incluido por defecto |
| `OBJECT_DURABILITY` | **PENDIENTE** | R2 no contratado todavía; la cifra de 11 nueves es de Cloudflare, no de una cuenta operativa de Sentinel |
| `OBJECT_BACKUP` | **PENDIENTE** | depende de `OBJECT_DURABILITY`; requiere Bucket Locks + copia independiente, ninguno configurado |
| `RESTORE_TESTED` | **NO** | no se ha ejecutado ningún restore real, ni siquiera del fixture de fichero, contra un backup subido a un remoto real (§11 del cuerpo principal probó reinicio de proceso, que es distinto de restore desde backup offsite) |
| `DISASTER_RECOVERY_READY` | **NO** | por regla explícita de este gate: no se declara Sentinel protegido hasta que `RESTORE_TESTED = SI`, y ni siquiera existe hoy un backup real que probar |

**Esto no es un fallo de este gate — es exactamente lo que una auditoría
honesta debe decir en el punto en que Sentinel está hoy: el diseño y las
herramientas están listas (scripts, política verificada, arquitectura
evaluada), pero nada de la protección real existe todavía porque nada de la
infraestructura offsite se ha contratado ni configurado.** El siguiente gate
debe cerrar, en este orden de prioridad por impacto/esfuerzo: (1) `git push`
del código pendiente, (2) configurar el remoto de `backup-data-offsite.sh` y
correrlo una vez, (3) decidir y contratar Supabase + R2, (4) ejecutar un
restore real de prueba y solo entonces recalificar `RESTORE_TESTED`.
