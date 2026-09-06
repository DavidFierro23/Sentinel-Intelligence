-- apps/backend/scripts/migrations/001_lake_records.sql
--
-- SENTINEL-HISTORICAL-CLOUD-01
--
-- Tabla generica que reproduce, en PostgreSQL, exactamente el modelo de
-- registro del Knowledge Lake (apps/backend/services/knowledgeLake/
-- lakeWriter.js, CAMPOS_MODELO + claveEntidad + version + hash). No se
-- crean tablas tipadas por dominio (candidates/collection_runs/etc.) en
-- esta migracion: eso exigiria reescribir projectStore.js y el resto de
-- llamadas a escribirEnLake/leerTodos para hablar SQL en vez de la
-- interfaz del Lake, lo cual esta fuera de alcance de este gate (no se
-- debe alterar logica de Candidate/Territorial/Media).
--
-- En cambio, esta tabla es el reemplazo directo del adaptador de fichero:
-- el resto del sistema (lakeWriter, lakeIndexer, lakeReader, projectStore,
-- el scheduler de Candidate, etc.) sigue hablando EXCLUSIVAMENTE con la
-- interfaz anexar()/leerTodos()/contar()/particiones()/estado() del Lake,
-- sin saber ni importarle si el adaptador de abajo es un fichero JSONL o
-- esta tabla.
--
-- NO DESTRUCTIVA: solo CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT
-- EXISTS. Segura de correr mas de una vez.
--
-- ROLLBACK LOGICO: no hay DROP en este archivo a proposito. Si hay que
-- deshacer esta migracion, el rollback es "dejar de usar el adaptador
-- postgres" (volver a SENTINEL_LAKE_ADAPTER=fichero) -- los datos en esta
-- tabla no se pierden ni hace falta borrarlos para volver al adaptador de
-- fichero.

CREATE TABLE IF NOT EXISTS lake_records (
  id              BIGSERIAL PRIMARY KEY,

  -- Identidad del registro tal como la genera lakeWriter.js
  registro_id     TEXT NOT NULL,           -- registro.id, "lk-<hashCorto>"
  hash            TEXT NOT NULL,
  hash_anterior   TEXT,

  -- Gobierno / aislamiento (DT1) -- OBLIGATORIO, nunca NULL
  tenant_id       TEXT NOT NULL,
  proyecto_id     TEXT NOT NULL,

  -- Identidad de entidad y version -- columna vertebral del versionado
  clave_entidad   TEXT NOT NULL,           -- tenant::proyecto::tipo::entidad
  tipo_entidad    TEXT NOT NULL,
  entidad         TEXT,
  version         INT NOT NULL,

  -- Particion / tiempo, para consultas por rango sin tener que abrir el JSONB
  particion         TEXT NOT NULL,          -- "2026/09/05"
  fecha_deteccion   TIMESTAMPTZ NOT NULL,
  fecha_hecho       TIMESTAMPTZ,

  -- El registro completo, integro, tal como lo produce construirRegistro()
  -- en lakeWriter.js. Ninguna transformacion de campos: si el modelo del
  -- Lake gana un campo nuevo manana, esta tabla no necesita una migracion
  -- para guardarlo.
  registro        JSONB NOT NULL,

  escrito_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ESTA restriccion es la que el gate SENTINEL-DATA-PERSISTENCE-01
  -- identifico como el arreglo real al race de version confirmado
  -- empiricamente (20 escrituras concurrentes a la misma entidad
  -- produjeron 20 "version 1"): aqui, la segunda escritura con el mismo
  -- (clave_entidad, version) es rechazada por la base de datos, no
  -- aceptada silenciosamente.
  CONSTRAINT uq_lake_records_entidad_version UNIQUE (clave_entidad, version)
);

CREATE INDEX IF NOT EXISTS idx_lake_records_proyecto
  ON lake_records (tenant_id, proyecto_id, fecha_deteccion);

CREATE INDEX IF NOT EXISTS idx_lake_records_clave_entidad
  ON lake_records (clave_entidad, version DESC);

CREATE INDEX IF NOT EXISTS idx_lake_records_tipo
  ON lake_records (tenant_id, proyecto_id, tipo_entidad);

CREATE INDEX IF NOT EXISTS idx_lake_records_particion
  ON lake_records (particion);

-- Tabla de control de migracion -- permite que el importador JSONL sepa
-- que fecha de corte ya se importo, sin depender de contar filas (que no
-- distingue "ya importado" de "importado parcialmente").
CREATE TABLE IF NOT EXISTS lake_migration_log (
  id                BIGSERIAL PRIMARY KEY,
  ejecutado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_count      INT NOT NULL,
  inserted          INT NOT NULL,
  already_present   INT NOT NULL,
  failed            INT NOT NULL,
  target_count      INT NOT NULL,
  detalle           JSONB
);
