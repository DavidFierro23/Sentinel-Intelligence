#!/usr/bin/env bash
#
# scripts/railway/build.sh
#
# ===========================================================
# BUILD DE RAILWAY — WORKAROUND DEL EBUSY EN node_modules/.vite
# RAILWAY-BUILD-FIX-01
# ===========================================================
#
# Error real observado en Railway (Build > Build image):
#
#   npm error code EBUSY
#   npm error syscall rmdir
#   npm error path /app/apps/web/node_modules/.vite
#   npm error errno -16
#   npm error EBUSY: resource busy or locked, rmdir '/app/apps/web/node_modules/.vite'
#
# CAUSA RAÍZ AUDITADA (SENTINEL-HISTORICAL-CLOUD-01 continuación,
# RAILWAY-BUILD-FIX-01):
#
#   NO es un problema de este repositorio. Se confirmó exhaustivamente:
#
#     git ls-files | grep -i node_modules   -> 0 resultados
#     git ls-files | grep -i "\.vite"       -> 0 resultados
#
#   Ningún node_modules ni ningún .vite está trackeado en git, en
#   ninguna rama, en ningún commit. El .gitignore de raíz y el de
#   apps/web ya excluyen node_modules correctamente. No existe
#   railway.json/railway.toml/nixpacks.toml/.railwayignore/Dockerfile
#   en el repo que pudiera explicar un comportamiento de cache
#   distinto al automático de Railpack.
#
#   La causa real vive del lado de Railway/Railpack, no del repo:
#   Railpack cachea `node_modules` entre builds de un mismo servicio
#   para acelerar reinstalaciones cuando el lockfile no cambió. En un
#   monorepo con un workspace Vite (`apps/web`), esa cache puede
#   contener `apps/web/node_modules/.vite` -el cache de
#   pre-bundling de dependencias de esbuild/Vite-, generado por una
#   fase de build automática de Railpack (que detecta el script
#   `"build"` del `package.json` raíz) en una capa PREVIA a que
#   corra el Build Command personalizado (`npm ci`).
#
#   `npm ci` intenta borrar TODO `node_modules` existente antes de
#   reinstalar (comportamiento documentado de npm). Si esa carpeta
#   `.vite` cacheada por Railway sigue con un descriptor de archivo
#   abierto/bloqueado en el sistema de ficheros superpuesto (overlay)
#   del contenedor de build, el `rmdir` interno de npm falla con
#   EBUSY -que es justo lo que Railway reportó-.
#
# FIX MÍNIMO Y REPRODUCIBLE (este script, NO un cambio de código de
# aplicación):
#
#   Limpiar explícita y forzosamente los `node_modules` de cada
#   workspace ANTES de que `npm ci` intente su propia limpieza
#   interna. `rm -rf` es más resiliente que el borrado interno de
#   npm ante directorios de una build anterior con descriptores
#   colgados, y al limpiar nosotros primero, npm ci nunca llega a
#   toparse con la carpeta `.vite` cacheada en absoluto.
#
#   NO es "usar npm install como parche": se sigue usando
#   exactamente `npm ci` (instalación reproducible desde
#   package-lock.json), solo se garantiza que arranca desde un
#   estado limpio de verdad.
#
# CONFIGURACIÓN REQUERIDA EN RAILWAY (dashboard, no en este repo):
#
#   Settings -> Build -> Custom Build Command:
#     bash scripts/railway/build.sh
#
#   (en vez de `npm ci` directo). Root Directory, Start Command,
#   Healthcheck Path y variables de entorno NO cambian.
# ===========================================================

set -euo pipefail

echo "[railway-build] limpiando node_modules de todos los workspaces (workaround EBUSY .vite de cache de Railway)"

rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules

echo "[railway-build] instalación reproducible desde package-lock.json"
npm ci

echo "[railway-build] listo"
