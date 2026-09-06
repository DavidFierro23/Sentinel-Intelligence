-- apps/backend/scripts/migrations/002_lake_records_version_conflicts.sql
--
-- SENTINEL-HISTORICAL-CLOUD-01 (continuación)
--
-- La UNIQUE(clave_entidad, version) de 001_lake_records.sql protege contra
-- que una escritura NUEVA pise una versión ya existente. Pero el
-- importador encontró (en --dry-run contra los datos reales, antes de
-- tener conexión) 3 pares de registros que YA colisionan dentro del
-- propio JSONL de origen -- dos escrituras concurrentes históricas que
-- calcularon el mismo (claveEntidad, version) con contenido REALMENTE
-- distinto (hashes distintos).
--
-- Si el importador simplemente descartara el segundo de cada par (que es
-- lo que "ON CONFLICT DO NOTHING" haría por sí solo), su contenido se
-- perdería en silencio. Esta tabla existe para que eso NUNCA pase: el
-- importador, al detectar que el conflicto es por CONTENIDO DISTINTO (no
-- una repetición idéntica de una importación anterior), preserva el
-- registro perdedor aquí, íntegro, en vez de descartarlo.
--
-- NO DESTRUCTIVA. Solo CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS lake_records_version_conflicts (
  id                BIGSERIAL PRIMARY KEY,

  clave_entidad     TEXT NOT NULL,
  version           INT NOT NULL,

  -- Identidad del registro perdedor tal como llegó del JSONL
  registro_id       TEXT NOT NULL,
  hash              TEXT NOT NULL,
  registro          JSONB NOT NULL,

  -- Cual registro SÍ quedó como canónico en lake_records para esta misma
  -- (clave_entidad, version), para poder comparar los dos lado a lado.
  registro_id_canonico TEXT,
  hash_canonico        TEXT,

  motivo            TEXT NOT NULL DEFAULT 'colision_de_version_preexistente_en_origen',
  detectado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelto          BOOLEAN NOT NULL DEFAULT false,
  resolucion_nota   TEXT,

  -- Idempotencia de esta misma tabla: re-correr el importador no debe
  -- duplicar el registro de conflicto ya preservado.
  UNIQUE (registro_id)
);

CREATE INDEX IF NOT EXISTS idx_lake_conflicts_clave_entidad
  ON lake_records_version_conflicts (clave_entidad, version);
