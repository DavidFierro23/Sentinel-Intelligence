# apps/backend/scripts/backup/run-scheduled-backup.ps1
#
# ===========================================================
# WRAPPER PARA WINDOWS TASK SCHEDULER - SENTINEL-DR-SCHEDULED-BACKUP-01
# ===========================================================
#
# Envuelve backup-data-offsite.sh (bash) para que Task Scheduler
# pueda invocarlo, capturar su codigo de salida real, y dejar un
# log tecnico SIN secretos.
#
# Deliberadamente escrito en ASCII puro (sin tildes ni comillas
# tipograficas): un caracter no-ASCII mal decodificado bajo la
# code page por defecto de PowerShell 5.1 puede romper el parser
# a mitad de una cadena (ya ocurrio una vez con un guion largo
# durante el desarrollo de este mismo script). Task Scheduler
# ejecuta powershell.exe sin control sobre esa code page, asi que
# la robustez pesa mas aqui que la tilde.
#
# QUE HACE
#   1. Localiza este repo de forma robusta (relativo a su propia
#      ubicacion, no a un path fijo de un usuario).
#   2. Localiza Git Bash. Si no existe, falla con exit distinto de
#      0 y lo dice en el log; no inventa una ruta.
#   3. Localiza `rclone` en PATH; si no esta, busca en la ruta de
#      instalacion de WinGet conocida de este equipo y la anade
#      SOLO al PATH del proceso hijo (no toca el PATH del sistema
#      ni el de la sesion de PowerShell del usuario).
#   4. Exporta UNICAMENTE `SENTINEL_BACKUP_RCLONE_REMOTE`
#      (`r2-sentinel:sentinel-backups`; no es secreto, es el
#      nombre de un remote ya configurado localmente por el
#      usuario; la autenticacion real vive en rclone.conf, que
#      este script nunca lee ni imprime).
#   5. Ejecuta backup-data-offsite.sh sin modificarlo.
#   6. Escribe un log en scripts/backup/logs/ con timestamp,
#      exito/fallo, nombre de archive, bytes, checksum, duracion
#      y exit code; nunca con contenido de rclone.conf, tokens,
#      ni contenido de los JSONL.
#   7. Termina con `exit <codigo real del script bash>`, para que
#      Task Scheduler registre "Last Run Result" con el resultado
#      verdadero, no siempre 0.
#
# QUE NO HACE
#   - No lee ni imprime rclone.conf, ni ninguna credencial.
#   - No modifica apps/backend/data.
#   - No borra backups remotos.
#   - No instala nada.
# ===========================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$LogDir = Join-Path $ScriptDir "logs"
$BashScriptRelative = "scripts/backup/backup-data-offsite.sh"

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$RunId = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "scheduled-backup-$RunId.log"

function Write-Log([string]$Line) {
    $stamped = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Line"
    Add-Content -Path $LogFile -Value $stamped
}

Write-Log "=== SENTINEL scheduled backup run $RunId ==="
Write-Log "Backend dir: $BackendDir"

# ---- localizar Git Bash --------------------------------------
$GitBash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path $GitBash)) {
    Write-Log "ERROR: Git Bash no encontrado en $GitBash. No se puede ejecutar backup-data-offsite.sh."
    exit 1
}
Write-Log "Git Bash: OK"

# ---- localizar rclone (sin tocar PATH del sistema) -----------
$RcloneOnPath = Get-Command rclone -ErrorAction SilentlyContinue
if ($RcloneOnPath) {
    $RcloneDir = Split-Path -Parent $RcloneOnPath.Source
    Write-Log "rclone encontrado en PATH: $($RcloneOnPath.Source)"
} else {
    $Candidate = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "rclone.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $Candidate) {
        Write-Log "ERROR: rclone no encontrado ni en PATH ni bajo WinGet Packages."
        exit 1
    }
    $RcloneDir = $Candidate.DirectoryName
    Write-Log "rclone localizado (no en PATH) en: $($Candidate.FullName)"
}

# ---- ejecutar el script bash existente, sin modificarlo -------
$Env:PATH = "$RcloneDir;$Env:PATH"
$Env:SENTINEL_BACKUP_RCLONE_REMOTE = "r2-sentinel:sentinel-backups"

$Started = Get-Date
Write-Log "Ejecutando $BashScriptRelative via Git Bash..."

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $GitBash
$psi.Arguments = "-c `"cd '$($BackendDir -replace '\\','/')' && bash $BashScriptRelative`""
$psi.WorkingDirectory = $BackendDir
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.EnvironmentVariables["PATH"] = $Env:PATH
$psi.EnvironmentVariables["SENTINEL_BACKUP_RCLONE_REMOTE"] = $Env:SENTINEL_BACKUP_RCLONE_REMOTE

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$proc.Start() | Out-Null
$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()
$ExitCode = $proc.ExitCode

$Duration = (Get-Date) - $Started

# ---- parsear SOLO lo no sensible del output del script --------
# Linea real emitida por backup-data-offsite.sh:
#   [backup] paquete: <nombre> (<bytes> bytes), checksum: <hash>
$PackageLine = ($stdout -split "`n") | Where-Object { $_ -match '^\[backup\] paquete:' } | Select-Object -First 1
if ($PackageLine -match 'paquete:\s+(\S+)\s+\((\d+)\s+bytes\),\s+checksum:\s+([0-9a-f]{64})') {
    $ArchiveName = $Matches[1]
    $ArchiveBytes = $Matches[2]
    $ArchiveChecksum = $Matches[3]
} else {
    $ArchiveName = "(no determinado - ver log de error)"
    $ArchiveBytes = "?"
    $ArchiveChecksum = "?"
}

$UploadConfirmed = ($stdout -match '\[backup\] subida confirmada por rclone')

Write-Log "Exit code del script: $ExitCode"
Write-Log "Duracion: $([math]::Round($Duration.TotalSeconds, 1))s"
Write-Log "Archive: $ArchiveName"
Write-Log "Bytes: $ArchiveBytes"
Write-Log "Checksum (SHA-256 del propio empaquetado, no un secreto): $ArchiveChecksum"
Write-Log "Subida confirmada por rclone: $UploadConfirmed"
Write-Log "Resultado: $(if ($ExitCode -eq 0) { 'EXITO' } else { 'FALLO' })"

if ($ExitCode -ne 0) {
    Write-Log "--- stderr del script (sin credenciales: el script nunca las imprime) ---"
    Write-Log $stderr
}

Write-Log "=== fin del run $RunId ==="

exit $ExitCode
