# Atualiza o sistema no PC do restaurante. Rodar como Administrador, FORA do
# horário de funcionamento:  powershell -ExecutionPolicy Bypass -File ops\deploy.ps1
$ErrorActionPreference = "Stop"
$servico = "xisdinizsalao.exe"
$app = Split-Path -Parent $PSScriptRoot
$raiz = Resolve-Path (Join-Path $app "..\..")

Write-Host "==> Backup antes de atualizar"
& (Join-Path $PSScriptRoot "backup.ps1")

Write-Host "==> Baixando a versão nova"
git -C $raiz pull --ff-only

Write-Host "==> Instalando dependências"
Push-Location $raiz
pnpm install --frozen-lockfile
Pop-Location

Push-Location $app
Write-Host "==> Aplicando migrations do banco"
pnpm db:migrate

Write-Host "==> Gerando build"
pnpm build

Write-Host "==> Reiniciando o serviço"
$svc = Get-Service | Where-Object { $_.Name -eq $servico -or $_.DisplayName -eq "Xis Diniz Salao" } | Select-Object -First 1
if ($svc) {
  Restart-Service -InputObject $svc
  Write-Host "Serviço reiniciado."
} else {
  Write-Host "Serviço não encontrado. Instale com: pnpm servico:instalar"
}
Pop-Location

Write-Host "==> Conferindo /health"
Start-Sleep -Seconds 8
try {
  Invoke-RestMethod "http://localhost:3000/health" | ConvertTo-Json -Depth 4
} catch {
  Write-Warning "O /health não respondeu. Veja os logs em apps\salao\dist\daemon\"
}
