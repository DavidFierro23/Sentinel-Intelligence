#!/usr/bin/env bash
#
# apps/backend/scripts/backup/restore-data-offsite.sh
#
# ===========================================================
# RESTORE DESDE BACKUP OFFSITE — apps/backend/data
# ===========================================================
#
# Contraparte de backup-data-offsite.sh. Descarga un paquete
# (el más reciente por defecto, o uno concreto si se pasa su
# nombre) desde el remoto S3-compatible, VERIFICA su checksum,
# y lo extrae a un directorio de destino explícito.
#
# REGLA DEL ADDENDUM DE DISASTER RECOVERY:
#
#   BACKUP NO PROBADO MEDIANTE RESTORE = BACKUP NO CERTIFICADO.
#
# Este script existe para poder cumplir esa regla de verdad,
# no solo declararla: debe poder ejecutarse periódicamente
# contra un directorio de prueba (NUNCA directamente sobre
# apps/backend/data en producción) para confirmar que lo que
# se sube de verdad se puede recuperar.
#
# NUNCA sobrescribe apps/backend/data automáticamente. El
# destino es SIEMPRE un argumento explícito, y si ya existe y
# no está vacío, el script se detiene en vez de fusionar o
# sobrescribir en silencio.
#
# USO
#   ./restore-data-offsite.sh <directorio-destino> [nombre-de-paquete.tar.gz]
#
# Ejemplo — prueba de restore mensual, sin tocar producción:
#   ./restore-data-offsite.sh /tmp/sentinel-restore-test-2026-09
#
# Ejemplo — recuperación real tras pérdida del equipo (ver
# runbook completo en docs/SENTINEL-DATA-PERSISTENCE-01.md,
# sección "Disaster Recovery Plan"):
#   ./restore-data-offsite.sh apps/backend/data
#   # (solo si apps/backend/data no existe todavía en el equipo nuevo)
# ===========================================================

set -euo pipefail

REMOTE="${SENTINEL_BACKUP_RCLONE_REMOTE:-}"
TARGET_DIR="${1:-}"
REQUESTED_PACKAGE="${2:-}"

fail() {
  echo "[restore] ERROR: $1" >&2
  exit 1
}

[ -n "$REMOTE" ] || fail "SENTINEL_BACKUP_RCLONE_REMOTE no está definida."
[ -n "$TARGET_DIR" ] || fail "uso: $0 <directorio-destino> [nombre-de-paquete.tar.gz]"
command -v rclone >/dev/null 2>&1 || fail "rclone no está instalado."
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum no está disponible."
command -v tar >/dev/null 2>&1 || fail "tar no está disponible."

if [ -d "$TARGET_DIR" ] && [ -n "$(ls -A "$TARGET_DIR" 2>/dev/null)" ]; then
  fail "${TARGET_DIR} ya existe y no está vacío. Este script no fusiona ni sobrescribe: elige un destino vacío o nuevo."
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if [ -z "$REQUESTED_PACKAGE" ]; then
  echo "[restore] ningún paquete especificado: buscando el más reciente en ${REMOTE}"
  REQUESTED_PACKAGE="$(rclone lsf "$REMOTE" --include "sentinel-data-*.tar.gz" | sort | tail -n1)"
  [ -n "$REQUESTED_PACKAGE" ] || fail "no se encontró ningún paquete sentinel-data-*.tar.gz en ${REMOTE}"
fi

echo "[restore] paquete elegido: ${REQUESTED_PACKAGE}"

rclone copyto "${REMOTE}/${REQUESTED_PACKAGE}" "${WORKDIR}/${REQUESTED_PACKAGE}"
rclone copyto "${REMOTE}/${REQUESTED_PACKAGE}.sha256" "${WORKDIR}/${REQUESTED_PACKAGE}.sha256" \
  || fail "no existe ${REQUESTED_PACKAGE}.sha256 en el remoto: sin checksum no se puede certificar integridad, y este script no restaura sin verificar."

echo "[restore] verificando checksum"
EXPECTED="$(cat "${WORKDIR}/${REQUESTED_PACKAGE}.sha256")"
ACTUAL="$(sha256sum "${WORKDIR}/${REQUESTED_PACKAGE}" | awk '{print $1}')"

[ "$EXPECTED" = "$ACTUAL" ] || fail "CHECKSUM NO COINCIDE. esperado=${EXPECTED} actual=${ACTUAL}. El paquete pudo corromperse en tránsito o en el remoto. NO se extrae un paquete con integridad no verificada."

echo "[restore] checksum OK: ${ACTUAL}"

mkdir -p "$TARGET_DIR"
tar -xzf "${WORKDIR}/${REQUESTED_PACKAGE}" -C "$TARGET_DIR" --strip-components=1

echo "[restore] extraído en ${TARGET_DIR}"
echo "[restore] conteo de líneas por almacén (para comparar contra el manifiesto del origen):"
find "$TARGET_DIR" -name "*.jsonl" -exec wc -l {} + | tail -n1 || true

echo "[restore] VALIDACIÓN PENDIENTE: compara estos conteos y el checksum contra el estado"
echo "[restore] conocido antes de declarar este restore satisfactorio. Un restore que"
echo "[restore] 'se ve bien' sin comparar conteos no es una validación."
