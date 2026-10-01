param(
  [string]$Repository = "moneyfund/nexus",
  [string]$KeyDirectory = "$env:USERPROFILE\.nexus"
)

$ErrorActionPreference = "Stop"
$privateKey = Join-Path $KeyDirectory "nexus-updater.key"
$publicKey = "$privateKey.pub"

New-Item -ItemType Directory -Force -Path $KeyDirectory | Out-Null

if ((Test-Path $privateKey) -or (Test-Path $publicKey)) {
  throw "Ya existe una clave NEXUS en $KeyDirectory. No se sobrescribió."
}

$securePassword = Read-Host "Crea una contraseña para la clave privada de NEXUS Update" -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
  if ([string]::IsNullOrWhiteSpace($password)) {
    throw "La contraseña de firma no puede quedar vacía."
  }

  Write-Host "Generando claves de firma en $KeyDirectory ..."
  npx --yes @tauri-apps/cli@latest signer generate -w $privateKey -p $password

  if (!(Test-Path $privateKey) -or !(Test-Path $publicKey)) {
    throw "Tauri no generó el par de claves esperado."
  }

  $privateContent = Get-Content -Raw $privateKey
  $publicContent = Get-Content -Raw $publicKey

  if (Get-Command gh -ErrorAction SilentlyContinue) {
    try {
      gh auth status | Out-Null
      Write-Host "Guardando secretos cifrados en GitHub Actions ..."
      $privateContent | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $Repository
      $password | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo $Repository
      $publicContent | gh secret set NEXUS_UPDATER_PUBKEY --repo $Repository
      Write-Host "GitHub Actions quedó configurado."
    } catch {
      Write-Warning "GitHub CLI no está autenticado. Configura los tres secretos manualmente en Settings > Secrets and variables > Actions."
    }
  } else {
    Write-Warning "GitHub CLI no está instalado. Configura los tres secretos manualmente en Settings > Secrets and variables > Actions."
  }

  Write-Host ""
  Write-Host "CLAVE PRIVADA: $privateKey"
  Write-Host "CLAVE PUBLICA: $publicKey"
  Write-Host ""
  Write-Host "IMPORTANTE: conserva ambos archivos en un respaldo seguro. Nunca subas nexus-updater.key al repositorio ni lo compartas por chat."
  Write-Host "Secretos requeridos:"
  Write-Host "  TAURI_SIGNING_PRIVATE_KEY"
  Write-Host "  TAURI_SIGNING_PRIVATE_KEY_PASSWORD"
  Write-Host "  NEXUS_UPDATER_PUBKEY"
} finally {
  if ($passwordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  }
  Remove-Variable password -ErrorAction SilentlyContinue
}
