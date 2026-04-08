# ─────────────────────────────────────────────────────────────────
# ProTrader Database Backup Script (Windows PowerShell)
#
# Usage:
#   .\scripts\backup-db.ps1                        # backup to .\backups\
#   .\scripts\backup-db.ps1 -BackupDir D:\backups  # custom dir
#   .\scripts\backup-db.ps1 -RetainDays 14         # keep 14 days
# ─────────────────────────────────────────────────────────────────
param(
    [string]$BackupDir = ".\backups",
    [int]$RetainDays = 7
)

$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Target = Join-Path $BackupDir $Timestamp

# DB credentials
$PgUser     = if ($env:POSTGRES_USER)     { $env:POSTGRES_USER }     else { "protrader" }
$PgPassword = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "protrader_dev" }
$PgDb       = if ($env:POSTGRES_DB)       { $env:POSTGRES_DB }       else { "protrader" }
$PgHost     = if ($env:POSTGRES_HOST)     { $env:POSTGRES_HOST }     else { "localhost" }
$PgPort     = if ($env:POSTGRES_PORT)     { $env:POSTGRES_PORT }     else { "5435" }

$TsUser     = if ($env:TIMESCALE_USER)     { $env:TIMESCALE_USER }     else { "protrader" }
$TsPassword = if ($env:TIMESCALE_PASSWORD) { $env:TIMESCALE_PASSWORD } else { "protrader_dev" }
$TsDb       = if ($env:TIMESCALE_DB)       { $env:TIMESCALE_DB }       else { "marketdata" }
$TsHost     = if ($env:TIMESCALE_HOST)     { $env:TIMESCALE_HOST }     else { "localhost" }
$TsPort     = if ($env:TIMESCALE_PORT)     { $env:TIMESCALE_PORT }     else { "5433" }

Write-Host "=== ProTrader Database Backup - $Timestamp ===" -ForegroundColor Cyan

New-Item -ItemType Directory -Path $Target -Force | Out-Null

# --- Main PostgreSQL ---
Write-Host "[1/2] Backing up PostgreSQL ($PgDb)..." -ForegroundColor Yellow
$env:PGPASSWORD = $PgPassword
$mainDump = Join-Path $Target "protrader_main.dump"
& pg_dump -h $PgHost -p $PgPort -U $PgUser -d $PgDb --format=custom --compress=9 --file=$mainDump
$mainSize = (Get-Item $mainDump).Length / 1MB
Write-Host "    OK protrader_main.dump ($([math]::Round($mainSize,1)) MB)" -ForegroundColor Green

# --- TimescaleDB ---
Write-Host "[2/2] Backing up TimescaleDB ($TsDb)..." -ForegroundColor Yellow
$env:PGPASSWORD = $TsPassword
$tsDump = Join-Path $Target "protrader_timescale.dump"
& pg_dump -h $TsHost -p $TsPort -U $TsUser -d $TsDb --format=custom --compress=9 --file=$tsDump
$tsSize = (Get-Item $tsDump).Length / 1MB
Write-Host "    OK protrader_timescale.dump ($([math]::Round($tsSize,1)) MB)" -ForegroundColor Green

# --- Prune old backups ---
if ($RetainDays -gt 0) {
    Write-Host "Pruning backups older than $RetainDays days..." -ForegroundColor Yellow
    Get-ChildItem -Path $BackupDir -Directory |
        Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-$RetainDays) } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Backup complete -> $Target" -ForegroundColor Cyan
$env:PGPASSWORD = $null
