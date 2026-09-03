#!/usr/bin/env bash
#
# apps/backend/scripts/secrets/create-secret-recovery-package.sh
#
# ===========================================================
# PAQUETE CIFRADO DE RECUPERACION DE SECRETOS
# SENTINEL-DR-SECRET-RECOVERY-01
# ===========================================================
#
# Empaqueta las variables sensibles de Sentinel (apps/backend/.env)
# en un archivo cifrado con GPG (simetrico, AES-256), listo para
# subir a un lugar offsite. NO sube nada por si mismo: eso es un
# paso deliberado, separado, para que subir el paquete cifrado sea
# siempre una decision explicita, no automatica.
#
# POR QUE GPG Y NO openssl enc
#   openssl enc exige recordar EXACTAMENTE los mismos flags de
#   cifra (algoritmo, modo, iteraciones de KDF, sal) para poder
#   descifrar; un desajuste produce basura sin avisar. El formato
#   OpenPGP de gpg es autodescriptivo: `gpg --decrypt` basta, y
#   trae verificacion de integridad incorporada. Tanto gpg como
#   openssl ya estan instalados en este equipo (vienen con Git for
#   Windows) — no se anadio ninguna dependencia nueva para esto.
#
# QUE ENTRA AL PAQUETE
#   - apps/backend/.env  (la fuente de verdad real de secretos)
#   NO entra apps/backend/.env.bak (es una copia sin cifrar del
#   propio .env; incluirla en el paquete cifrado no anadiria nada,
#   y menos secretos sin cifrar tocados es mejor).
#   NO entra rclone.conf por defecto — ver seccion "BOOTSTRAP DE
#   RCLONE" en docs/SENTINEL-DR-SECRET-RECOVERY-01.md: guardar la
#   credencial que hace falta para bajar el propio backup DENTRO
#   del backup es una dependencia circular. La recuperacion de
#   rclone se documenta como un procedimiento humano aparte
#   (Cloudflare dashboard), no como contenido de este paquete.
#
# LA PASSPHRASE
#   Este script NUNCA la recibe como argumento, variable de
#   entorno, ni la genera por si mismo. gpg la pide de forma
#   interactiva (pinentry), directamente en la terminal de quien
#   ejecuta el script. Eso es intencional: la passphrase no debe
#   pasar nunca por ninguna herramienta de automatizacion, log, ni
#   historial de comandos.
#
# USO
#   cd apps/backend
#   bash scripts/secrets/create-secret-recovery-package.sh
#
#   gpg pedira la passphrase dos veces (confirmacion). El archivo
#   resultante queda en:
#     scripts/secrets/output/sentinel-secrets-<timestamp>.tar.gpg
#
#   Ese directorio esta en .gitignore. Subirlo a R2 es un paso
#   MANUAL y APARTE (ver upload-secret-package.sh), nunca
#   automatico ni parte del backup diario de datos.
# ===========================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${BACKEND_DIR}/.env"
OUTPUT_DIR="${SCRIPT_DIR}/output"

fail() {
  echo "[secret-package] ERROR: $1" >&2
  exit 1
}

command -v gpg >/dev/null 2>&1 || fail "gpg no esta disponible. Deberia venir con Git for Windows (C:\\Program Files\\Git\\usr\\bin\\gpg.exe)."
command -v tar >/dev/null 2>&1 || fail "tar no esta disponible."
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum no esta disponible."
[ -f "$ENV_FILE" ] || fail "no existe ${ENV_FILE}: nada que empaquetar."

mkdir -p "$OUTPUT_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

mkdir -p "${STAGING}/sentinel-secrets"
cp "$ENV_FILE" "${STAGING}/sentinel-secrets/.env"

# Metadata SIN valores: solo para que quien recupere sepa que
# esperar, sin tener que abrir el .env para contarlas.
grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" > "${STAGING}/sentinel-secrets/VARIABLE_COUNT.txt" || true

TAR_NAME="sentinel-secrets-${TIMESTAMP}.tar"
tar -cf "${STAGING}/${TAR_NAME}" -C "$STAGING" sentinel-secrets

ENCRYPTED_NAME="sentinel-secrets-${TIMESTAMP}.tar.gpg"
ENCRYPTED_PATH="${OUTPUT_DIR}/${ENCRYPTED_NAME}"

echo "[secret-package] gpg pedira una passphrase (dos veces, para confirmar)."
echo "[secret-package] Esa passphrase NO se guarda en ningun archivo de este repo."
echo "[secret-package] Guardala de inmediato en tu gestor de contrasenas: sin ella, este paquete no sirve de nada."

gpg --symmetric \
    --cipher-algo AES256 \
    --s2k-digest-algo SHA512 \
    --s2k-count 65011712 \
    --output "$ENCRYPTED_PATH" \
    "${STAGING}/${TAR_NAME}"

sha256sum "$ENCRYPTED_PATH" | awk '{print $1}' > "${ENCRYPTED_PATH}.sha256"

BYTES="$(stat -c%s "$ENCRYPTED_PATH" 2>/dev/null || stat -f%z "$ENCRYPTED_PATH")"

echo "[secret-package] listo: ${ENCRYPTED_NAME} (${BYTES} bytes)"
echo "[secret-package] checksum: $(cat "${ENCRYPTED_PATH}.sha256")"
echo "[secret-package] ubicacion local: ${ENCRYPTED_PATH}"
echo "[secret-package] siguiente paso manual: revisar y luego subirlo con upload-secret-package.sh"
