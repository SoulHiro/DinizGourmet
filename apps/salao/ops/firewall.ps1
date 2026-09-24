# Libera a porta do servidor do salão para a rede local (celulares dos garçons).
# Rodar como Administrador:  powershell -ExecutionPolicy Bypass -File ops\firewall.ps1
param([int]$Porta = 3000)

$nome = "Xis Diniz Salao (porta $Porta)"
if (Get-NetFirewallRule -DisplayName $nome -ErrorAction SilentlyContinue) {
  Write-Host "Regra '$nome' já existe."
} else {
  New-NetFirewallRule -DisplayName $nome -Direction Inbound -Protocol TCP -LocalPort $Porta `
    -Action Allow -Profile Private,Domain | Out-Null
  Write-Host "Regra '$nome' criada (redes Privada e Domínio)."
}
Write-Host "Confira se a rede Wi-Fi do restaurante está marcada como 'Privada' no Windows."
