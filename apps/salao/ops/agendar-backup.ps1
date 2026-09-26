# Agenda o backup diário às 4h (depois do fechamento). Rodar como Administrador.
$script = Join-Path $PSScriptRoot "backup.ps1"
$acao = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$gatilho = New-ScheduledTaskTrigger -Daily -At 4am
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable:$false
Register-ScheduledTask -TaskName "Xis Diniz - Backup do salao" -Action $acao -Trigger $gatilho `
  -Settings $config -User "SYSTEM" -RunLevel Highest -Force | Out-Null
Write-Host "Backup agendado para todo dia às 4h (roda mesmo se o PC estava desligado nesse horário)."
