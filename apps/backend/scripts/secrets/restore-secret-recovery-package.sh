#!/usr/bin/env bash
#
# apps/backend/scripts/secrets/restore-secret-recovery-package.sh
#
# ===========================================================
# RESTAURAR SECRETOS DESDE EL PAQUETE CIFRADO OFFSITE
# ===========================================================
#
# Contraparte de create-secret-recovery-package.sh /
# upload-secret-package.sh. Descarga el paquete mas reciente (o
# uno especifico) desde R2, verifica su checksum, y lo descifra
# a un directorio de destino EXPLICITO.
#
# NUNCA escribe directamente sobre apps/backend/.env. El destino
# es siempre un argumento, y si ya existe y no esta vacio, el
# script se detiene: restaurar secretos no debe poder sobrescribir
# en silencio una configuracion de trabajo.
#
# BOOTSTRAP — SI rclone.conf TAMBIEN SE PERDIO
#   Este script asume que `rclone` ya esta configurado con el
#   remote `r2-sentinel`. Si el equipo que se perdio era el UNICO
#   lugar donde vivia rclone.conf, hay una dependencia circular:
#   no se puede usar rclone para bajar el paquete que permitiria
#   reconfigurar rclone.
#
#   Para ese caso, el paquete cifrado tambien se puede descargar
#   SIN rclone, directamente desde el panel de Cloudflare
#   (dashboard web, con el login humano de la cuenta de
#   Cloudflare — protegido por lo que la persona conoce/tiene,
#   no por un archivo en el disco perdido):
#
#     1. Iniciar sesion en dash.cloudflare.com
#     2. R2 -> bucket sentinel-backups -> carpeta secrets/
#     3. Descargar el .tar.gpg mas reciente y su .sha256
#     4. Verificar el checksum manualmente:
#          sha256sum archivo.tar.gpg   (comparar con el .sha256)
#     5. Descifrar con gpg directamente (ver mas abajo), sin
#        pasar por este script.
#
#   Esto es deliberado, no un hueco: guardar la credencial que
#   hace falta para bajar el propio backup DENTRO del backup
#   cifrado seria una dependencia circular real. Requerir acceso
#   humano a Cloudflare como via de bootstrap es valido y
#   probablemente mas seguro que la alternativa.
#
# USO (con rclone ya configurado)
#   bash scripts/secrets/restore-secret-recovery-package.sh <directorio-destino> [nombre-del-paquete.tar.gpg]
#
# La passphrase la pide gpg de forma interactiva, igual que al
# crear el paquete. Este script nunca la recibe como argumento.
# ===========================================================

set -euo pipefail

REMOTE="${SENTINEL_SECRET_RCLONE_REMOTE:-r2-sentinel:sentinel-backups/secrets}"
TARGET_DIR="${1:-}"
REQUESTED_PACKAGE="${2:-}"

fail() {
  echo "[secret-restore] ERROR: $1" >&2
  exit 1
}

[ -n "$TARGET_DIR" ] || fail "uso: $0 <directorio-destino> [nombre-del-paquete.tar.gpg]"
command -v rclone >/dev/null 2>&1 || fail "rclone no disponible. Ver BOOTSTRAP en la cabecera de este script para la via sin rclone."
command -v gpg >/dev/null 2>&1 || fail "gpg no disponible."
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum no disponible."
command -v tar >/dev/null 2>&1 || fail "tar no disponible."

if [ -d "$TARGET_DIR" ] && [ -n "$(ls -A "$TARGET_DIR" 2>/dev/null)" ]; then
  fail "${TARGET_DIR} ya existe y no esta vacio. Este script no sobrescribe: elige un destino vacio o nuevo."
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if [ -z "$REQUESTED_PACKAGE" ]; then
  echo "[secret-restore] buscando el paquete mas reciente en ${REMOTE}"
  REQUESTED_PACKAGE="$(rclone lsf "$REMOTE" --include "sentinel-secrets-*.tar.gpg" | sort | tail -n1)"
  [ -n "$REQUESTED_PACKAGE" ] || fail "no se encontro ningun paquete sentinel-secrets-*.tar.gpg en ${REMOTE}"
fi

echo "[secret-restore] paquete elegido: ${REQUESTED_PACKAGE}"

rclone copyto "${REMOTE}/${REQUESTED_PACKAGE}" "${WORKDIR}/${REQUESTED_PACKAGE}"
rclone copyto "${REMOTE}/${REQUESTED_PACKAGE}.sha256" "${WORKDIR}/${REQUESTED_PACKAGE}.sha256" \
  || fail "no existe ${REQUESTED_PACKAGE}.sha256 en el remoto: sin checksum no se puede certificar integridad."

echo "[secret-restore] verificando checksum del archivo CIFRADO (antes de tocar la passphrase)"
EXPECTED="$(cat "${WORKDIR}/${REQUESTED_PACKAGE}.sha256")"
ACTUAL="$(sha256sum "${WORKDIR}/${REQUESTED_PACKAGE}" | awk '{print $1}')"

[ "$EXPECTED" = "$ACTUAL" ] || fail "CHECKSUM NO COINCIDE. El paquete cifrado pudo corromperse en transito. NO se intenta descifrar un paquete con integridad no verificada."

echo "[secret-restore] checksum OK."
echo "[secret-restore] gpg pedira la passphrase para descifrar."

mkdir -p "$TARGET_DIR"
gpg --decrypt --output "${WORKDIR}/decrypted.tar" "${WORKDIR}/${REQUESTED_PACKAGE}"
tar -xf "${WORKDIR}/decrypted.tar" -C "$TARGET_DIR" --strip-components=1

echo "[secret-restore] extraido en ${TARGET_DIR}"
echo "[secret-restore] archivos presentes:"
find "$TARGET_DIR" -type f -printf '%f\n' 2>/dev/null || find "$TARGET_DIR" -type f -exec basename {} \;

echo "[secret-restore] VALIDACION PENDIENTE: confirma que .env esta presente y no vacio antes de"
echo "[secret-restore] copiarlo a apps/backend/.env. Este script deliberadamente NO lo copia solo:"
echo "[secret-restore] mover secretos al lugar final es una decision humana, no automatica."
