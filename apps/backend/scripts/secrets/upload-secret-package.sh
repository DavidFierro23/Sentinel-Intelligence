#!/usr/bin/env bash
#
# apps/backend/scripts/secrets/upload-secret-package.sh
#
# ===========================================================
# SUBIDA MANUAL Y EXPLICITA DEL PAQUETE CIFRADO DE SECRETOS
# ===========================================================
#
# Deliberadamente SEPARADO de backup-data-offsite.sh y de la
# tarea programada diaria. Los secretos cambian con mucha menos
# frecuencia que los datos y no deben viajar en cada corrida
# automatica: cada actualizacion de este paquete es una accion
# humana consciente, no un cron.
#
# Sube el .tar.gpg (y su .sha256) MAS RECIENTE de
# scripts/secrets/output/ a:
#
#   r2-sentinel:sentinel-backups/secrets/
#
# Un subdirectorio propio dentro del MISMO bucket ya aprobado,
# para separar logicamente "datos" de "secretos" sin crear un
# bucket nuevo ni pedir un permiso nuevo (el token de Object
# Read & Write ya cubre cualquier prefijo del bucket).
#
# USO
#   bash scripts/secrets/upload-secret-package.sh
#
# QUE NO HACE
#   - No genera el paquete (usa create-secret-recovery-package.sh
#     primero).
#   - No hace publico nada.
#   - No cambia politica de acceso ni permisos.
#   - No borra versiones anteriores del paquete en el remoto: cada
#     subida queda con su propio timestamp, igual que el backup de
#     datos.
# ===========================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/output"
REMOTE="${SENTINEL_SECRET_RCLONE_REMOTE:-r2-sentinel:sentinel-backups/secrets}"

fail() {
  echo "[secret-upload] ERROR: $1" >&2
  exit 1
}

command -v rclone >/dev/null 2>&1 || fail "rclone no esta instalado o no esta en PATH de esta sesion."
[ -d "$OUTPUT_DIR" ] || fail "no existe ${OUTPUT_DIR}: corre create-secret-recovery-package.sh primero."

LATEST="$(ls -t "${OUTPUT_DIR}"/sentinel-secrets-*.tar.gpg 2>/dev/null | head -n1 || true)"
[ -n "$LATEST" ] || fail "no hay ningun paquete .tar.gpg en ${OUTPUT_DIR}."
[ -f "${LATEST}.sha256" ] || fail "falta el checksum de ${LATEST}. No se sube un paquete sin checksum."

NAME="$(basename "$LATEST")"

echo "[secret-upload] subiendo ${NAME} a ${REMOTE}/"
rclone copyto "$LATEST" "${REMOTE}/${NAME}" --checksum --s3-no-check-bucket
rclone copyto "${LATEST}.sha256" "${REMOTE}/${NAME}.sha256" --checksum --s3-no-check-bucket

echo "[secret-upload] confirmado. Verificando listado remoto..."
rclone lsf "$REMOTE" --include "${NAME}*"

echo "[secret-upload] listo. El contenido descifrado nunca salio de este equipo; solo viajo el .tar.gpg cifrado."
