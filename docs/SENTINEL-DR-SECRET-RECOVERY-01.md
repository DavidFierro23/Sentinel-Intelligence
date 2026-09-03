# SENTINEL-DR-SECRET-RECOVERY-01 — Recuperación de secretos sin exponerlos

Terminal 4 — Data Platform / Disaster Recovery. Continúa
`SENTINEL-DR-SCHEDULED-BACKUP-01`. Este gate es exclusivamente Secret
Recovery: no se tocó Supabase, PostgreSQL, Bucket Lock, segunda nube, ni
Candidate/Territorial/Media/UX/`SENTINEL_PROJECT_STATE.md`.

**Este gate NO cambia `DISASTER_RECOVERY_READY` a SÍ** — faltan
componentes posteriores (DB/PITR cuando exista PostgreSQL), tal como exige
la directiva.

Ningún valor de ningún secreto aparece en este documento, en los scripts,
ni fue impreso durante la ejecución de este gate.

## 1. Commit base

`7b187a7` (cierre de `SENTINEL-DR-SCHEDULED-BACKUP-01`), más los commits de
otras terminales que llegaron durante este gate (no tocados).

## 2. Secretos/configuración auditados, por nombre

Inventario real de `apps/backend/.env` (13 variables con asignación,
confirmado por conteo de líneas, **ningún valor leído ni impreso**):

| VARIABLE_NAME | PRESENT | CATEGORY | RECOVERY_REQUIRED |
|---|---|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | true | REQUIRED_FOR_RUNTIME | true |
| `FACEBOOK_USER_ACCESS_TOKEN` | true | REQUIRED_FOR_RUNTIME | true |
| `META_APP_ID` | true | REQUIRED_FOR_RUNTIME | true |
| `META_APP_SECRET` | true | REQUIRED_FOR_RUNTIME | true |
| `SERPAPI_API_KEY` | true | REQUIRED_FOR_RUNTIME (proveedor web principal) | true |
| `X_BEARER_TOKEN` | true | REQUIRED_FOR_RUNTIME (adapter X activo en producción) | true |
| `BRAVE_API_KEY` | true | OPTIONAL_PROVIDER | true |
| `YOUTUBE_API_KEY` | true | OPTIONAL_PROVIDER | true |
| `SCRAPECREATORS_API_KEY` | true | OPTIONAL_PROVIDER (proveedor social externo aprobado) | true |
| `SOCIAL_EXTERNAL_PROVIDER_ENABLED` | true | DEVELOPMENT_ONLY / feature flag (no es secreto) | true (cambia comportamiento) |
| `PORT` | true | DEVELOPMENT_ONLY (no es secreto) | false |
| `GOOGLE_API_KEY` | true | **DEPRECATED** — sin ninguna referencia en el código actual (`grep` vacío en todo `apps/backend`) | false |
| `GOOGLE_CX` | true | **DEPRECATED** — mismo hallazgo | false |

**Hallazgo adicional:** `.env.example` estaba desactualizado — no
documentaba `X_BEARER_TOKEN`, `SCRAPECREATORS_API_KEY`, ni tenía una línea
real (no comentada) para `SOCIAL_EXTERNAL_PROVIDER_ENABLED`, pese a que las
tres están activas en el `.env` real y las dos primeras son necesarias para
funcionalidad en producción. Esto significa que, antes de este gate,
reconstruir Sentinel solo a partir de `.env.example` habría dejado a
alguien sin saber que esas tres piezas existían. Corregido en el punto 11.

`SERPAPI_API_KEY` vs `SERPAPI_KEY`: el código (`serpapiProvider.js`) acepta
ambos nombres a propósito; el `.env` real usa `SERPAPI_API_KEY`. No es un
error, es redundancia deliberada del proveedor.

**Totales:** 13 variables auditadas. 6 `REQUIRED_FOR_RUNTIME`, 3
`OPTIONAL_PROVIDER`, 2 configuración no sensible, 2 `DEPRECATED`.

## 3. Categorías

Ver tabla del punto 2. Sin variables `UNKNOWN` — cada una pudo clasificarse
con evidencia de código (uso real, o ausencia total de uso para las
deprecadas).

## 4. Archivos sensibles auditados

`apps/backend/.env`, `apps/backend/.env.bak`, `apps/backend/.env.example`,
`%APPDATA%\rclone\rclone.conf` (solo existencia, nunca contenido),
`apps/backend/scripts/backup/logs/*.log` (los tres generados en el gate
anterior), todos los `docs/*.md` del repo, y el historial completo de git
(`--all`, no solo `HEAD`).

## 5. Tracked secrets

**`TRACKED_SECRETS = 0`.** Confirmado por `git ls-files` (solo
`.env.example` está trackeado) y por `git check-ignore -v` sobre
`apps/backend/.env` y `apps/backend/.env.bak` (ambos cubiertos por reglas
existentes de `.gitignore`). Además, `git log --all -- .env .env.bak
apps/backend/.env apps/backend/.env.bak` no devuelve ningún commit en toda
la historia: nunca estuvieron trackeados, ni siquiera antes de existir la
regla de `.gitignore`.

## 6. Secret files in data backup

**`SECRET_FILES_IN_DATA_BACKUP = 0`.** Reconfirmado en este gate (ya
establecido estructuralmente en gates anteriores): `backup-data-offsite.sh`
ejecuta `tar -czf ... -C "$BACKEND_DIR" data`, empaquetando únicamente el
subdirectorio `data/`; `.env`/`.env.bak` viven un nivel arriba y no forman
parte de ningún árbol que el script toque. Ninguna ruta de código permite
que entren.

Escaneo adicional de patrones de credencial hardcodeada (`AKIA...`, bloques
`BEGIN...PRIVATE KEY`, `sk-...`, prefijo de token de Meta `EAAG...`) sobre
**todo** el historial de git (`--all`, no solo los commits pendientes de
gates anteriores) y sobre `scripts/`, `docs/`, y los logs locales: **0
coincidencias en todos los casos.** No se activó ninguna condición de STOP.

## 7. Estrategia de cifrado

**GPG simétrico, AES-256, KDF SHA-512 con 65.011.712 iteraciones de S2K**
(`gpg --symmetric --cipher-algo AES256 --s2k-digest-algo SHA512
--s2k-count 65011712`).

Elegido sobre `openssl enc` porque el formato OpenPGP es autodescriptivo:
descifrar solo requiere `gpg --decrypt`, sin tener que recordar los flags
exactos usados al cifrar (un error clásico de `openssl enc`, que produce
basura silenciosa si el modo/KDF no coincide exactamente). GPG trae además
verificación de integridad incorporada al formato.

**Ninguna herramienta nueva instalada.** Tanto `gpg` (v. bundlada con Git
for Windows, `C:\Program Files\Git\usr\bin\gpg.exe`) como `openssl` (v3.5.7,
también de Git for Windows) ya estaban disponibles en este equipo; se
auditó su presencia antes de decidir, tal como exige el gate.

**La passphrase nunca es generada, recibida como argumento, ni almacenada
por ningún script de este gate.** `gpg` la pide de forma interactiva
(pinentry) directamente en la terminal de quien ejecuta el script. Por
decisión explícita del usuario en este gate, **la creación del paquete real
la ejecuta el usuario en su propia terminal**, no esta sesión — así la
passphrase real nunca toca ninguna herramienta de automatización.

## 8. Ubicación offsite del paquete cifrado (sin credenciales)

`r2-sentinel:sentinel-backups/secrets/` — un subprefijo dentro del **mismo**
bucket ya aprobado (`sentinel-backups`), no un bucket nuevo. Separado
lógicamente del backup diario de datos (`.tar.gz` sin prefijo) para que
nunca se mezclen ni se sobrescriban entre sí, y para que la actualización
del paquete de secretos sea siempre una subida manual y explícita
(`upload-secret-package.sh`), nunca parte de la tarea programada diaria
(`SentinelDataOffsiteBackup`) ni de ningún cron. El token de mínimo
privilegio ya emitido (Object Read & Write sobre `sentinel-backups`) cubre
cualquier prefijo del bucket sin necesitar un permiso nuevo.

## 9. Bootstrap de rclone (dependencia circular resuelta)

Si el equipo perdido era el único lugar con `rclone.conf`, no se puede usar
`rclone` para bajar el propio paquete que permitiría reconfigurar `rclone`.
Documentado como procedimiento humano, no como contenido del paquete:

1. Login humano en `dash.cloudflare.com` (protegido por lo que la persona
   conoce/tiene — cuenta + MFA de Cloudflare — no por un archivo del disco
   perdido).
2. R2 → bucket `sentinel-backups` → carpeta `secrets/` → descargar
   manualmente el `.tar.gpg` más reciente y su `.sha256`.
3. Verificar el checksum a mano (`sha256sum`).
4. Descifrar con `gpg --decrypt` directamente, con la passphrase que la
   persona guardó en su gestor de contraseñas.
5. Solo después de tener secretos + un nuevo `Access Key`/`Secret` de R2
   (regenerado desde el dashboard), reconfigurar `rclone` en el equipo
   nuevo.

**Decisión explícita: NO incluir `rclone.conf` dentro del paquete cifrado**,
ni siquiera cifrado. Guardar la credencial que hace falta para bajar el
propio backup dentro del backup sería una dependencia circular real. Exigir
acceso humano directo a Cloudflare como vía de bootstrap es válido y,
razonablemente, más seguro que la alternativa.

## 10. Recuperación de proveedores

| PROVIDER | ENV_VARIABLES | REGENERATABLE | RECOVERY_METHOD | CRITICALITY |
|---|---|---|---|---|
| SerpAPI | `SERPAPI_API_KEY` (alias `SERPAPI_KEY`) | yes | dashboard de serpapi.com | alta — proveedor web principal |
| YouTube Data API v3 | `YOUTUBE_API_KEY` | yes | Google Cloud Console | media-alta — identifica emisores YouTube |
| Brave Search API | `BRAVE_API_KEY` | yes | brave.com/search/api | media |
| Meta — Instagram Login | `INSTAGRAM_ACCESS_TOKEN` | yes, requiere flujo de reautorización humano | Meta for Developers / Graph API Explorer + intercambio con `META_APP_ID`/`META_APP_SECRET` | alta |
| Meta — Facebook Login for Business | `FACEBOOK_USER_ACCESS_TOKEN` | yes, mismo flujo | Meta for Developers | alta |
| Meta — credenciales de app | `META_APP_ID`, `META_APP_SECRET` | yes | panel de la app en Meta for Developers | alta — necesarias para refrescar los dos tokens anteriores |
| ScrapeCreators | `SCRAPECREATORS_API_KEY` | asumido (proveedor comercial externo, ver `docs/SOCIAL-PROVIDER-REAL-02-SCRAPECREATORS.md`) | dashboard del proveedor | alta — proveedor social externo activo |
| X (Twitter) API | `X_BEARER_TOKEN` | asumido (requiere cuenta de desarrollador X) | developer.x.com | alta — adapter activo en producción |
| Cloudflare R2 | credenciales viven en `rclone.conf`, no en `.env` | yes | dashboard de Cloudflare → R2 → API Tokens | crítica — de ella depende recuperar todo lo demás offsite |
| Google Custom Search (legacy) | `GOOGLE_API_KEY`, `GOOGLE_CX` | n/a | **DEPRECATED**, sin código que las use hoy | ninguna |

No se inventó ningún proveedor fuera de los confirmados por variable real
en `.env` o por uso real en código.

## 11. `.env.example`

Actualizado en este gate (auditado primero, como exige la directiva antes
de tocar un archivo de plantilla compartido). Cambios, todos aditivos, sin
tocar ningún valor real:

- `SOCIAL_EXTERNAL_PROVIDER_ENABLED=false` pasó de ser solo un ejemplo
  comentado a una línea real de la plantilla (con su valor seguro por
  defecto, `false`).
- Añadida `SCRAPECREATORS_API_KEY=` con comentario y referencia a su doc.
- Añadida una sección nueva `X (TWITTER)` con `X_BEARER_TOKEN=`.

**Decisión explícita: NO se añadieron `GOOGLE_API_KEY`/`GOOGLE_CX`** a la
plantilla — están presentes en el `.env` real pero sin ningún uso en el
código actual (`DEPRECATED`, punto 2). Una plantilla de recuperación debe
reflejar lo que Sentinel necesita hoy, no arrastrar configuración muerta;
si en el futuro se confirma que hacen falta, se añaden entonces con
justificación, no por precaución.

## 12. Prueba de cifrado

Ejecutada con **datos sintéticos** (`DUMMY_TEST_KEY_ONE`/
`DUMMY_TEST_KEY_TWO`, valores obviamente falsos) y una **passphrase
desechable** generada y destruida dentro de la misma prueba — nunca se usó
el `.env` real ni una passphrase real. Empaquetado en `tar`, cifrado con
exactamente los mismos parámetros de GPG que usará el script real
(`create-secret-recovery-package.sh`), en un directorio temporal fuera del
repo. **PASS.**

## 13. Prueba de descifrado

Sobre el mismo artefacto sintético: verificación de checksum SHA-256 antes
de descifrar (`MATCH`), descifrado con `gpg --decrypt`, extracción, y
comparación byte a byte del contenido recuperado contra el original
(`diff`, sin diferencias). **PASS.**

## 14. Checksum

`CHECKSUM_VERIFIED = SÍ` para la prueba sintética (verificado antes de
descifrar, como exige el propio diseño del script). Para el paquete REAL de
secretos: **pendiente** — no existe todavía, porque su creación es una
acción que el usuario decidió ejecutar él mismo, con su propia passphrase,
fuera de esta sesión (ver punto 16).

## 15. Cleanup

Todo el material de la prueba sintética —directorio temporal, `.tar` sin
cifrar, `.tar.gpg`, checksum, y el `.env` de prueba— se borró con `shred -u`
donde estuvo disponible (fallback a borrado normal si no) y se confirmó que
el directorio temporal ya no existía tras la limpieza. **PASS.** No quedó
ningún artefacto de esta prueba ni en el repo ni en ningún directorio
persistente del sistema.

## 16. Riesgos

1. **El paquete real de secretos todavía no existe offsite.** El mecanismo
   está listo y probado, pero hasta que el usuario ejecute
   `create-secret-recovery-package.sh` + `upload-secret-package.sh` con su
   propia passphrase, `SECRET_RECOVERY` no puede certificarse en SÍ pleno
   (ver punto 14 de esta lista y el veredicto final).
2. **La passphrase, una vez creada, vive únicamente en la memoria del
   usuario y en el gestor de contraseñas que elija.** Si se pierde, el
   paquete cifrado es irrecuperable — es el trade-off correcto (nadie más
   puede descifrarlo tampoco), pero debe quedar dicho: no hay "recuperar la
   passphrase olvidada".
3. **`META_APP_ID`/`META_APP_SECRET`/tokens de Meta tienen vigencia
   limitada** (ver punto 17) — un paquete cifrado viejo puede contener un
   token ya caducado en el momento de una recuperación real. Mitigación:
   regenerar el token de Meta es parte esperada del procedimiento de
   recuperación si el paquete tiene más de ~60 días.
4. **`.env.bak` sigue existiendo sin cifrar en el equipo actual**, como ya
   se documentó en `SENTINEL-DATA-PERSISTENCE-01`. Este gate no lo tocó (no
   forma parte del paquete cifrado, ver punto 2 de las decisiones de
   diseño) — sigue siendo un punto único de fallo local, ahora mitigado
   porque el paquete cifrado offsite cubre la misma información de forma
   segura, pero el archivo sin cifrar en disco sigue siendo una superficie
   de riesgo si el equipo es comprometido en vida (no perdido).
5. **`GOOGLE_API_KEY`/`GOOGLE_CX` deprecadas siguen en `.env` real.** No es
   un riesgo de seguridad per se, pero es higiene pendiente: confirmar que
   de verdad no se usan y rotarlas/eliminarlas en un gate de limpieza
   dedicado, no en este.

## 17. Metadata del token de Meta (sin exponer el valor)

`configured = true` (`INSTAGRAM_ACCESS_TOKEN` y `FACEBOOK_USER_ACCESS_TOKEN`
ambos presentes). `token_type`: no determinable con certeza sin decodificar
el token (que este gate no hizo) — por convención del propio proyecto
(comentarios en `.env.example` y en `services/intelligence/
candidateObservation.js`) se asume de larga duración (~60 días, obtenido
mediante intercambio con `META_APP_ID`/`META_APP_SECRET`) en vez del token
corto de Graph API Explorer (~1 hora), pero **no se verificó en vivo**.
`expiry known/unknown`: **UNKNOWN** — no existe ningún metadato de fecha de
emisión o expiración almacenado junto al token en `.env` ni en código. No se
cambió, ni se intentó renovar, el token en este gate.

## 18-19-20-21-22-23-24-25. Estados finales

Ver reporte final más abajo — se listan ahí para evitar duplicar la misma
tabla dos veces en el documento.

## 26. Próximo gate recomendado

1. **El usuario ejecuta, en su propia terminal:**
   ```
   cd apps/backend
   bash scripts/secrets/create-secret-recovery-package.sh
   bash scripts/secrets/upload-secret-package.sh
   ```
   con su propia passphrase (gpg la pedirá dos veces), y la guarda de
   inmediato en su gestor de contraseñas. Solo entonces `SECRET_RECOVERY`
   pasa de `PARCIAL` a `SÍ`.
2. Confirmar en un gate breve de verificación que el paquete real subido es
   descifrable (con la passphrase real, sin que Claude Code la vea —
   verificación que el propio usuario ejecuta y solo reporta PASS/FAIL).
3. Gate de higiene: confirmar y eliminar `GOOGLE_API_KEY`/`GOOGLE_CX` si se
   confirma que están muertas, y decidir sobre `.env.bak` en disco.
4. Bucket Lock sobre `sentinel-backups/secrets/` (ya diseñado en
   `SENTINEL-DATA-PERSISTENCE-01`, no activado todavía).
5. Cuando exista PostgreSQL: `DB_BACKUP`/`DB_PITR`, únicos componentes que
   faltan para poder evaluar `DISASTER_RECOVERY_READY` de verdad.
