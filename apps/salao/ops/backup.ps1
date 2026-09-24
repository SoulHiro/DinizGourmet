# Backup diário do banco do salão (pg_dump, formato custom).
# Agendar com: powershell -ExecutionPolicy Bypass -File ops\agendar-backup.ps1
#
# Guarda em $Destino (idealmente outro disco) e, se $Nuvem estiver definido
# (ex.: pasta sincronizada do Google Drive/OneDrive), copia para lá também.
param(
  [string]$Destino = "D:\backups\xis-diniz",
  [string]$Nuvem = $env:XIS_BACKUP_NUVEM,
  [int]$ManterDias = 30
)
$ErrorActionPreference = "Stop"

$app = Split-Path -Parent $PSScriptRoot
$envArquivo = Join-Path $app ".env"
$url = (Get-Content $envArquivo | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', ''
if (-not $url) { throw "DATABASE_URL não encontrada em $envArquivo" }

$pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgDump) { throw "pg_dump.exe não encontrado. O PostgreSQL está instalado?" }

New-Item -ItemType Directory -Force -Path $Destino | Out-Null
$arquivo = Join-Path $Destino ("salao-" + (Get-Date -Format "yyyy-MM-dd_HHmm") + ".dump")

& $pgDump.FullName --format=custom --no-owner --file=$arquivo $url
if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou (código $LASTEXITCODE)" }
Write-Host "Backup salvo em $arquivo"

if ($Nuvem) {
  try {
    New-Item -ItemType Directory -Force -Path $Nuvem | Out-Null
    Copy-Item $arquivo $Nuvem
    Write-Host "Cópia enviada para $Nuvem"
  } catch {
    Write-Warning "Não foi possível copiar para a nuvem agora (sem internet?). O backup local está ok."
  }
}

# Retenção: apaga backups locais mais velhos que $ManterDias.
Get-ChildItem $Destino -Filter "salao-*.dump" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$ManterDias) } |
  Remove-Item
