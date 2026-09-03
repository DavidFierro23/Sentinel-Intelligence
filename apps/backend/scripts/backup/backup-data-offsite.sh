#!/usr/bin/env bash
#
# apps/backend/scripts/backup/backup-data-offsite.sh
#
# ===========================================================
# BACKUP OFFSITE DIARIO — apps/backend/data (Knowledge Lake +
# almacenes territoriales), mientras JSONL siga siendo la
# fuente de verdad (SENTINEL-DATA-PERSISTENCE-01 / ADDENDUM DR)
# ===========================================================
#
# QUÉ HACE
#   1. Empaqueta apps/backend/data en un .tar.gz con fecha.
#   2. Calcula un checksum SHA-256 del paquete.
#   3. Sube AMBOS (paquete + checksum) a un remoto S3-compatible
#      (Cloudflare R2, o cualquier otro) vía `rclone`.
#   4. Poda copias locales de staging más viejas que N días.
#
# QUÉ NO HACE
#   - No borra ni modifica apps/backend/data. Es de solo lectura
#     sobre los datos de origen.
#   - No sube nada a git. apps/backend/data ya está en
#     .gitignore y debe seguir estándolo: un backup de datos NO
#     es un commit.
#   - No incluye ningún secreto. Las credenciales del remoto
#     viven en la configuración propia de `rclone`
#     (`rclone config`), nunca en este script ni en variables
#     de entorno que el repo pueda ver.
#   - No se ejecuta automáticamente por tener este archivo en el
#     repo. Hace falta configurarlo explícitamente (ver abajo).
#
# POR QUÉ rclone Y NO UN SDK DE AWS
#   Evita añadir una dependencia npm nueva a package.json —que
#   en este gate está fuera de alcance para esta terminal— y
#   habla el mismo protocolo S3 con cualquier proveedor
#   compatible (R2, S3, B2, MinIO), lo cual es exactamente el
#   requisito de "no vendor lock-in" de este gate.
#
# CONFIGURACIÓN REQUERIDA (una sola vez, fuera de este repo)
#   1. Instalar rclone: https://rclone.org/downloads/
#   2. `rclone config` → crear un remoto tipo "Cloudflare R2"
#      (o "Amazon S3" apuntando a otro proveedor). rclone guarda
#      las credenciales cifradas en ~/.config/rclone/rclone.conf,
#      FUERA de este repositorio.
#   3. Exportar, en el entorno donde corra el cron (NO en el
#      repo), estas dos variables:
#
#        SENTINEL_BACKUP_RCLONE_REMOTE="r2-sentinel:sentinel-backups"
#        SENTINEL_BACKUP_RETENTION_DAYS="14"   (opcional, default 14)
#
#   4. Cron sugerido (diario, 03:00 hora local):
#
#        0 3 * * * /usr/bin/env bash /ruta/a/apps/backend/scripts/backup/backup-data-offsite.sh >> /var/log/sentinel-backup.log 2>&1
#
# VERIFICACIÓN
#   Este script NO certifica el backup. Un backup solo se
#   certifica probando su restore (ver restore-data-offsite.sh
#   y la regla del ADDENDUM: BACKUP NO PROBADO = BACKUP NO
#   CERTIFICADO).
# ===========================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DATA_DIR="${BACKEND_DIR}/data"

REMOTE="${SENTINEL_BACKUP_RCLONE_REMOTE:-}"
RETENTION_DAYS="${SENTINEL_BACKUP_RETENTION_DAYS:-14}"
STAGING_DIR="${SENTINEL_BACKUP_STAGING_DIR:-${BACKEND_DIR}/.backup-staging}"
DRY_RUN="${SENTINEL_BACKUP_DRY_RUN:-false}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_NAME="sentinel-data-${TIMESTAMP}.tar.gz"
CHECKSUM_NAME="${ARCHIVE_NAME}.sha256"

fail() {
  echo "[backup] ERROR: $1" >&2
  exit 1
}

[ -n "$REMOTE" ] || fail "SENTINEL_BACKUP_RCLONE_REMOTE no está definida. No se ejecuta un backup 'a ningún sitio'."
command -v rclone >/dev/null 2>&1 || fail "rclone no está instalado. Ver cabecera de este script para instalarlo."
command -v tar >/dev/null 2>&1 || fail "tar no está disponible."
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum no está disponible."
[ -d "$DATA_DIR" ] || fail "no existe ${DATA_DIR}: nada que respaldar."

mkdir -p "$STAGING_DIR"

echo "[backup] empaquetando ${DATA_DIR} -> ${STAGING_DIR}/${ARCHIVE_NAME}"
tar -czf "${STAGING_DIR}/${ARCHIVE_NAME}" -C "${BACKEND_DIR}" data

sha256sum "${STAGING_DIR}/${ARCHIVE_NAME}" | awk '{print $1}' > "${STAGING_DIR}/${CHECKSUM_NAME}"

BYTES="$(stat -c%s "${STAGING_DIR}/${ARCHIVE_NAME}" 2>/dev/null || stat -f%z "${STAGING_DIR}/${ARCHIVE_NAME}")"
echo "[backup] paquete: ${ARCHIVE_NAME} (${BYTES} bytes), checksum: $(cat "${STAGING_DIR}/${CHECKSUM_NAME}")"

if [ "$DRY_RUN" = "true" ]; then
  echo "[backup] SENTINEL_BACKUP_DRY_RUN=true: no se sube nada al remoto. Paquete queda en ${STAGING_DIR}."
else
  echo "[backup] subiendo a ${REMOTE}/"
  #
  # --s3-no-check-bucket: un token con privilegio mínimo (Object
  # Read & Write, sin permiso de administración del bucket) no
  # puede responder a la comprobación de existencia de bucket que
  # rclone hace por defecto antes de subir (una llamada
  # CreateBucket bajo el capó), y sin este flag la subida falla
  # con AccessDenied aunque el permiso de escritura sí exista. No
  # es una ampliación de permisos: es decirle a rclone que no
  # pregunte algo que este token, a propósito, no puede responder.
  rclone copyto "${STAGING_DIR}/${ARCHIVE_NAME}" "${REMOTE}/${ARCHIVE_NAME}" --checksum --s3-no-check-bucket
  rclone copyto "${STAGING_DIR}/${CHECKSUM_NAME}" "${REMOTE}/${CHECKSUM_NAME}" --checksum --s3-no-check-bucket
  echo "[backup] subida confirmada por rclone (--checksum verifica contenido, no solo tamaño/fecha)."
fi

echo "[backup] podando staging local con más de ${RETENTION_DAYS} días"
find "$STAGING_DIR" -maxdepth 1 -name "sentinel-data-*.tar.gz*" -mtime "+${RETENTION_DAYS}" -print -delete || true

echo "[backup] listo: ${ARCHIVE_NAME}"
