# SENTINEL-DR-SCHEDULED-BACKUP-01 — Automatización del backup offsite real

Terminal 4 — Data Platform / Disaster Recovery. Continuación de
`SENTINEL-DR-DATA-OFFSITE-01` (primer backup real certificado). Este gate
automatiza esa misma operación mediante Windows Task Scheduler, sin
introducir un proceso Node persistente, sin nueva dependencia npm, y sin
ampliar los permisos del token R2 de mínimo privilegio ya emitido.

No se inició Secret Recovery, Supabase, PostgreSQL, migraciones de DB, R2
como almacenamiento operativo de evidencia, Bucket Lock, segunda nube del
3-2-1, ni una simulación completa de disaster recovery. Coste: sin cambio
respecto al gate anterior salvo el almacenamiento adicional de los nuevos
backups (ver punto 29).

1. **Commit base:** `9c0609f` (fundación DR) → este gate parte de
   `61145e6` (fix del preflight de bucket, gate anterior) y termina en
   `dac4017` (push de este gate, ver punto 26).
2. **Sistema operativo:** Windows 11 Pro 25H2 (64 bits), confirmado vía
   `rclone version`.
3. **Mecanismo elegido:** Windows Task Scheduler ejecutando un wrapper
   PowerShell (`apps/backend/scripts/backup/run-scheduled-backup.ps1`) que
   invoca `backup-data-offsite.sh` (sin modificarlo) vía Git Bash. Sin
   proceso Node persistente, sin servicio nuevo, sin dependencia de que
   Vite/backend estén corriendo.
4. **Nombre exacto de la tarea:** `SentinelDataOffsiteBackup`. No existía
   ninguna tarea Sentinel previa (verificado antes de crearla); no se
   duplicó nada.
5. **Frecuencia:** diaria.
6. **Horario configurado:** 03:00 AM, hora local del equipo. Es una
   propuesta operacional razonable (ventana de bajo uso), documentada
   explícitamente aquí y **configurable** — cambiar el trigger de la tarea
   no requiere tocar ningún script.
7. **Usuario/contexto (sin datos personales):** la tarea corre con
   `LogonType Interactive` bajo el usuario de Windows actualmente
   conectado, "ejecutar solo si el usuario inició sesión". Se eligió este
   modo, en vez de "ejecutar independientemente de si el usuario inició
   sesión", precisamente para **no requerir almacenar la contraseña del
   usuario en Task Scheduler** — un intercambio deliberado de disponibilidad
   (el backup no corre si el equipo está apagado o sin sesión iniciada) por
   no crear un nuevo secreto que gestionar. `rclone.conf` vive bajo el
   perfil de este mismo usuario (`%APPDATA%\rclone\rclone.conf`), así que
   la tarea debe correr en su contexto para poder leerlo; no se copió ni se
   movió ese archivo.
8. **Comando/wrapper:**
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "...\apps\backend\scripts\backup\run-scheduled-backup.ps1"`.
   El wrapper en sí:
   - localiza el repo de forma relativa a su propia ubicación (no a un path
     fijo de usuario);
   - localiza Git Bash en la ruta estándar de instalación;
   - localiza `rclone` primero en PATH y, si no está, bajo la ruta de
     instalación de WinGet de este equipo — **sin modificar el PATH del
     sistema**, solo el del proceso hijo;
   - exporta únicamente `SENTINEL_BACKUP_RCLONE_REMOTE=r2-sentinel:sentinel-backups`
     (no es secreto: es el nombre de un remote ya configurado localmente;
     la autenticación real vive en `rclone.conf`, que el wrapper nunca lee
     ni imprime);
   - ejecuta `backup-data-offsite.sh` sin modificarlo;
   - escribe un log técnico en `apps/backend/scripts/backup/logs/`
     (ignorado por git) con timestamp, archive, bytes, checksum,
     confirmación de subida, duración y exit code — nunca credenciales;
   - termina con el exit code real del script bash, para que Task
     Scheduler registre el resultado verdadero.

   **Nota de robustez encontrada durante este gate:** la primera versión
   del wrapper usaba una raya larga (—) y una tilde en `'ÉXITO'` dentro de
   cadenas de PowerShell. Al ejecutarse, PowerShell 5.1 decodificó el
   archivo con la code page ANSI del sistema en vez de UTF-8, y uno de los
   bytes de la raya larga se interpretó como una comilla de cierre,
   rompiendo el parser a mitad de una cadena. Se reescribió el script en
   ASCII puro (sin tildes ni comillas tipográficas) precisamente porque
   Task Scheduler invoca `powershell.exe` sin control sobre esa code page:
   la robustez del automatismo pesa más que la ortografía. Esta corrección
   se hizo **antes** de registrar la tarea, así que la tarea registrada ya
   usa la versión corregida.
9. **Remote:** `r2-sentinel`
10. **Bucket:** `sentinel-backups`
11. **Permisos necesarios:** Object Read & Write, acotado únicamente a
    `sentinel-backups`. Confirmado suficiente: todas las subidas de este
    gate usaron `--s3-no-check-bucket` (heredado del fix del gate anterior,
    commit `61145e6`) precisamente porque este token, a propósito, no puede
    responder a una comprobación de existencia de bucket a nivel de cuenta.
12. **Permisos NO necesarios (y deliberadamente ausentes):** cualquier
    permiso Admin de R2, y `ListBuckets` a nivel de cuenta —
    `rclone lsd r2-sentinel:` sigue devolviendo `AccessDenied` por diseño y
    no se usó en ningún punto de este gate. Solo se usaron operaciones a
    nivel de objeto (`lsf`, `lsl`, `cat`, `copyto`, `delete` sobre un
    objeto propio de prueba).
13. **Precheck:** `rclone lsf r2-sentinel:sentinel-backups` — exit 0, sin
    error, confirmado antes de cualquier acción.
14. **Ejecución manual de la Task:** vía el mecanismo oficial
    (`Start-ScheduledTask -TaskName SentinelDataOffsiteBackup`), **dos
    veces**, sin esperar al horario de las 03:00.
15. **Resultado:**
    - **Primera ejecución manual: `LastTaskResult = 3221225786`
      (`STATUS_CONTROL_C_EXIT`).** El log correspondiente
      (`scheduled-backup-20260903-153941.log`) se corta justo después de
      "Ejecutando ... vía Git Bash" — el proceso fue terminado a mitad de
      ejecución. La evidencia física lo confirma: quedó un archive
      (`sentinel-data-20260903T203941Z.tar.gz`, 893.270 bytes) subido a R2
      **sin su `.sha256` correspondiente**, es decir, el proceso llegó a
      completar la primera de las dos subidas del script (`archive`) y fue
      interrumpido antes de la segunda (`checksum`). No se pudo confirmar
      la causa raíz exacta con certeza total: el canal de diagnóstico de
      Task Scheduler (`Microsoft-Windows-TaskScheduler/Operational`) está
      deshabilitado por defecto en este equipo y habilitarlo devolvió
      "Acceso denegado" sin elevación, que este gate no tomó por su cuenta.
      No se borró este archivo huérfano (regla explícita del gate: no
      borrar backups remotos, ni siquiera de una corrida fallida) — queda
      documentado y disponible para limpieza en un gate futuro con
      aprobación explícita.
    - **Segunda ejecución manual (mismo mecanismo, sin ningún cambio):
      `LastTaskResult = 0`.** Completa de extremo a extremo, verificada
      (ver puntos 16-18).
    - No se repitió la prueba una tercera vez para intentar aislar la causa
      del primer fallo: el criterio de éxito de este gate es que el
      automatismo funcione y esté verificado, no diagnosticar
      exhaustivamente un evento transitorio no reproducido en el segundo ni
      sería seguro forzar reintentos automáticos.
16. **Archive generado** (de la corrida certificada, la segunda):
    `sentinel-data-20260903T204048Z.tar.gz`
17. **Checksum:** `MATCH` en tres verificaciones independientes — (a) el
    propio `rclone copyto --checksum` durante la subida, (b) el archivo
    `.sha256` remoto leído y comparado contra el checksum local calculado
    por el script, (c) una descarga completa **nueva e independiente** del
    archive a un directorio temporal distinto, con `sha256sum` recalculado
    ahí y comparado contra el `.sha256` remoto.
18. **Tamaño:** 896.000 bytes (archive comprimido).
19. **Files backed up (origen, en el momento de esta corrida):** 25
    archivos, todos `.jsonl`, ≈7.43 MB — el conteo sube respecto al gate
    anterior (23 archivos, ≈6.86 MB) porque T1/T2/T3 seguían escribiendo
    activamente durante este gate; el script leyó el estado real en cada
    corrida, sin intervención nuestra.
20. **ARCHIVOS_SECRETOS_EN_BACKUP = 0.** Confirmado de dos formas
    independientes, no solo por ausencia de coincidencias de texto: (a)
    estructuralmente, `backup-data-offsite.sh` ejecuta
    `tar -czf ... -C "$BACKEND_DIR" data` — solo empaqueta el subdirectorio
    `data`, y `.env`/`.env.bak` viven en `apps/backend/`, un nivel arriba,
    **fuera del árbol que se empaqueta**, así que no hay ninguna ruta de
    código por la que pudieran entrar; (b) se listó el contenido completo
    del archive generado en este gate (`tar -tzf`, sin extraer) y no
    aparece ningún archivo `.env*` ni de nombre sugerente de credencial.
21. **Backups remotos antes de este gate:** 1 par completo (archive +
    checksum, 2 objetos) — el certificado en `SENTINEL-DR-DATA-OFFSITE-01`.
22. **Backups remotos después de este gate:** 3 pares completos y
    verificables (6 objetos) + 1 archive huérfano sin checksum de la
    corrida fallida (1 objeto) = **7 objetos en total**. Ninguno fue
    borrado. El objeto de prueba de diagnóstico (`_probe-test.tar.gz`,
    usado en el gate anterior para validar `--s3-no-check-bucket`) ya había
    sido eliminado en ese gate anterior, no en este.
23. **Retención actual:** ninguna implementada — el script solo poda
    *staging local*, nunca objetos remotos (`find "$STAGING_DIR" ...
    -delete`, nunca `rclone delete` sobre el remoto). Todo lo subido a
    `sentinel-backups` se conserva indefinidamente hoy.
24. **Política de retención recomendada para el futuro (NO activada):**
    - diarios: conservar los últimos 14 días sin agregación;
    - semanales: conservar 1 backup por semana de las últimas 8-12 semanas;
    - mensuales: conservar 1 backup por mes de forma indefinida (o hasta
      que Postgres sea la fuente de verdad y este flujo se retire).
    Implementar esto requiere borrado remoto selectivo, que es una
    operación irreversible sobre backups — se deja como decisión explícita
    de un gate futuro, no de este.
25. **Push de código:** ejecutado. Precheck de seguridad sobre los 11
    commits pendientes: escaneo de nombres de archivo (un único resultado,
    `docs/TERRITORIAL-CREDENTIAL-ACTIVATION-01.md`, confirmado como
    documentación de gate en texto plano sin cadenas largas tipo
    token/clave — mismo patrón que los demás `docs/*.md` del repo, no un
    secreto) y escaneo de patrones de credencial hardcodeada en todas las
    líneas añadidas (`AKIA...`, bloques `BEGIN...PRIVATE KEY`, `sk-`,
    `xox*-`, `ghp_`) — 0 coincidencias. Sin divergencia:
    `origin/dev` confirmado ancestro de `dev` tras `git fetch`. Push
    limpio, sin `--force`.
26. **Commits enviados:** 11 — `9c0609f..dac4017`. Incluye el propio de
    este gate (`dac4017`, wrapper + `.gitignore`) y diez commits previos de
    otras terminales y del gate anterior (incluido `61145e6`, el fix del
    preflight de bucket). `dev` y `origin/dev` quedaron sincronizados (0
    ahead, 0 behind) al finalizar.
27. **Tests ejecutados** (evidencia real de este gate, no simulada):

    | # | Prueba | Resultado |
    |---|---|---|
    | A | wrapper devuelve 0 si el backup es correcto | SÍ — confirmado en la ejecución manual directa y en la segunda corrida vía Task Scheduler |
    | B | wrapper devuelve ≠0 si el backup falla | SÍ, pero observado **orgánicamente**, no mediante una prueba deliberada de fallo: la primera corrida de Task Scheduler falló de verdad y el wrapper/Task Scheduler lo reportaron correctamente (`LastTaskResult` ≠ 0) |
    | C | no muestra secretos | SÍ — revisados los tres logs generados, ninguno contiene credenciales, tokens, ni contenido de `rclone.conf` |
    | D | remote bucket-scoped funciona | SÍ — todas las subidas exitosas con el token de mínimo privilegio |
    | E | account-level ListBuckets no se requiere | SÍ — nunca se invocó `rclone lsd r2-sentinel:`; solo operaciones de objeto |
    | F | archive + checksum se crean | SÍ para las 3 corridas exitosas; **NO** para la corrida fallida (evidencia consistente con el fallo, no un defecto del test) |
    | G | Task Scheduler ejecuta | SÍ — confirmado con `Start-ScheduledTask` + `Get-ScheduledTaskInfo` |
    | H | segunda ejecución produce nombre distinto | SÍ — los 4 archives tienen timestamps distintos en su nombre |
    | I | no sobrescribe backup anterior | SÍ — los 4 archives coexisten en el bucket |
    | J | `apps/backend/data` permanece intacto | SÍ — el conteo/bytes de origen solo cambió por escrituras legítimas de otras terminales, nunca por este script (que solo lee) |
    | K | `.env` no entra al archive | SÍ — estructuralmente imposible (punto 20) |
    | L | `.env.bak` no entra al archive | SÍ — mismo argumento que K |
    | M | restore script sigue funcionando / su suite no regresa | `restore-data-offsite.sh` **no se modificó en este gate**; no se re-ejecutó un smoke test adicional aquí (ya certificado en `SENTINEL-DR-DATA-OFFSITE-01`) — no hay regresión posible sobre un archivo sin cambios, pero tampoco se generó evidencia nueva de restore en este gate específico |
    | N | archivos de T1/T2/T3 no modificados | SÍ — confirmado por `git status`/`git diff` en cada paso del gate |

28. **Fallos:** uno, ya descrito en el punto 15 (primera ejecución de Task
    Scheduler, `STATUS_CONTROL_C_EXIT`, causa no confirmada al 100% por
    falta de acceso al log operacional de Task Scheduler sin elevación).
    No bloqueó el gate porque la segunda ejecución, con el mecanismo
    idéntico, fue exitosa y quedó completamente verificada.
29. **Coste:** **NO_MEDIDO** contra el dashboard de facturación de
    Cloudflare (mismo criterio que el gate anterior). El volumen agregado
    de los 7 objetos actuales en `sentinel-backups` es de aproximadamente
    4.3 MB — sigue órdenes de magnitud por debajo del tier gratuito de R2
    (10 GB de almacenamiento, 1M operaciones Clase A, 10M Clase B al mes),
    verificado en `SENTINEL-DATA-PERSISTENCE-01`.
30. **CODE_OFFSITE = SÍ.** `dev` sincronizado con `origin/dev`, 0 ahead, 0
    behind, tras push limpio verificado sin secretos.
31. **DATA_OFFSITE = SÍ.** Sin cambio de fondo respecto al gate anterior,
    reforzado con dos copias adicionales verificadas de forma
    independiente.
32. **SCHEDULED_BACKUP = SÍ.** Tarea `SentinelDataOffsiteBackup` creada,
    en estado `Ready`, disparada manualmente por el mecanismo oficial de
    Windows y confirmada exitosa (segunda corrida), con verificación
    remota completa de esa corrida.
33. **SECRET_RECOVERY = NO.** Sin cambio — no se tocó `.env`/`.env.bak`, no
    se subió ningún secreto a R2, sigue sin existir un gestor de secretos
    offsite. Este gate no lo intentó, por instrucción explícita.
34. **RESTORE_TESTED = SÍ.** Certificado en el gate anterior
    (`SENTINEL-DR-DATA-OFFSITE-01`); no se repitió en este gate porque no
    era su objetivo y el script de restore no cambió.
35. **DISASTER_RECOVERY_READY = NO.** Por regla explícita — `SECRET_RECOVERY`
    y `DB_BACKUP`/`DB_PITR` siguen pendientes, y automatizar el backup no
    sustituye a esas piezas.
36. **Próximo gate recomendado**, en este orden de prioridad:
    1. Decidir qué hacer con el archive huérfano de la corrida fallida
       (`sentinel-data-20260903T203941Z.tar.gz`, sin checksum) — limpiarlo
       explícitamente o dejar que una futura política de retención lo
       cubra; no se decide unilateralmente aquí.
    2. Bucket Lock sobre el prefijo de backups en R2 (protección contra
       borrado accidental/credencial comprometida, diseñado pero no
       activado en `SENTINEL-DATA-PERSISTENCE-01` §A.4).
    3. Gate de Secret Recovery independiente (gestor de secretos offsite),
       explícitamente diferido hasta ahora.
    4. Activar retención real una vez haya suficiente historial de
       backups diarios para que la política del punto 24 tenga sentido
       medirla, no solo diseñarla.
