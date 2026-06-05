param(
  [int] $ApiPort = 4000,
  [int] $ExpoPort = 8081
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Runlogs = Join-Path $Root ".runlogs"
$Cloudflared = Join-Path $Runlogs "cloudflared.exe"
$ApiUrlFile = Join-Path $Runlogs "external-test-current.json"
$ErrorFile = Join-Path $Runlogs "external-test-error.log"

trap {
  Ensure-Runlogs
  $message = $_ | Out-String
  $message | Set-Content -Path $ErrorFile -Encoding UTF8
  Write-Error $message
  exit 1
}

function Ensure-Runlogs {
  New-Item -ItemType Directory -Force -Path $Runlogs | Out-Null
}

function Stop-ListeningProcess([int] $Port) {
  $processIds = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    if ($processId -and $processId -ne $PID) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Stop-Cloudflared {
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
}

function Stop-Ngrok {
  Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
}

function Ensure-Cloudflared {
  if (Test-Path $Cloudflared) {
    return
  }

  Invoke-WebRequest `
    -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" `
    -OutFile $Cloudflared
}

function Wait-HttpJson([string] $Url, [int] $TimeoutSeconds = 60) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      return Invoke-RestMethod -Uri $Url -TimeoutSec 10
    } catch {
      Start-Sleep -Seconds 2
    }
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $Url"
}

function Wait-ExternalJson([string] $Url, [int] $TimeoutSeconds = 120) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = $null
  do {
    try {
      return Invoke-RestMethod -Uri $Url -TimeoutSec 20
    } catch {
      $lastError = $_
      Start-Sleep -Seconds 3
    }
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for external URL $Url. Last error: $lastError"
}

function Wait-ExternalBundle([string] $Url, [int] $TimeoutSeconds = 120) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = $null
  do {
    try {
      return Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 60
    } catch {
      $lastError = $_
      Start-Sleep -Seconds 3
    }
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for external bundle $Url. Last error: $lastError"
}

function Start-Api {
  $env:RUNMATE_ENV = "development"
  $env:STORE_DRIVER = "in-memory"
  $env:REQUIRE_AUTH = "true"
  $env:API_HOST = "0.0.0.0"
  $env:API_PORT = "$ApiPort"

  $apiOut = Join-Path $Runlogs "api-external-out.log"
  $apiErr = Join-Path $Runlogs "api-external-err.log"
  $process = Start-Process `
    -FilePath "C:\Program Files\nodejs\node.exe" `
    -ArgumentList "apps/api/dist/apps/api/src/main.js" `
    -WorkingDirectory $Root `
    -RedirectStandardOutput $apiOut `
    -RedirectStandardError $apiErr `
    -PassThru `
    -WindowStyle Hidden

  Wait-HttpJson "http://127.0.0.1:$ApiPort/health" | Out-Null
  return $process
}

function Start-Expo {
  $mobile = Join-Path $Root "apps/mobile"
  $expoLog = Join-Path $Runlogs "expo-external-combined.log"
  Remove-Item $expoLog -ErrorAction SilentlyContinue
  $command = @"
`$env:EXPO_NO_TELEMETRY='true'
Set-Location '$mobile'
& 'C:\Program Files\nodejs\npx.cmd' expo start --tunnel --go --port $ExpoPort --clear *> '$expoLog'
"@

  $process = Start-Process `
    -FilePath "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $command `
    -PassThru `
    -WindowStyle Hidden

  Wait-HttpJson "http://127.0.0.1:$ExpoPort/status" | Out-Null
  return $process
}

function Wait-ExpoTunnelUrl([int] $TimeoutSeconds = 120) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = $null
  do {
    try {
      $response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 10
      $tunnel = $response.tunnels |
        Where-Object { $_.public_url -like "http://*.exp.direct" } |
        Select-Object -First 1
      if ($tunnel) {
        return $tunnel.public_url
      }
    } catch {
      $lastError = $_
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for Expo tunnel URL. Last error: $lastError"
}

function Start-CloudflareTunnel([int] $Port, [string] $Name) {
  $out = Join-Path $Runlogs "cloudflared-$Name-out.log"
  $err = Join-Path $Runlogs "cloudflared-$Name-err.log"
  $process = Start-Process `
    -FilePath $Cloudflared `
    -ArgumentList "tunnel --url http://127.0.0.1:$Port --no-autoupdate" `
    -WorkingDirectory $Root `
    -RedirectStandardOutput $out `
    -RedirectStandardError $err `
    -PassThru `
    -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(90)
  do {
    $logs = @()
    $logs += Get-Content $out -ErrorAction SilentlyContinue
    $logs += Get-Content $err -ErrorAction SilentlyContinue
    $match = $logs | Select-String -Pattern "https://[a-zA-Z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
    if ($match) {
      return @{
        Process = $process
        Url = $match.Matches[0].Value
      }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for Cloudflare tunnel URL for $Name"
}

function Update-MobileEnv([string] $ApiUrl) {
  $envPath = Join-Path $Root "apps/mobile/.env"
  @"
EXPO_PUBLIC_RUNTIME_ENV=preview
EXPO_PUBLIC_API_URL=$ApiUrl
EXPO_PUBLIC_WS_URL=$($ApiUrl.Replace("https://", "wss://").Replace("http://", "ws://"))/ws
EXPO_PUBLIC_ENABLE_DEMO_FALLBACK=false
"@ | Set-Content -Path $envPath -Encoding UTF8
}

Ensure-Runlogs
Ensure-Cloudflared

Stop-ListeningProcess $ApiPort
Stop-ListeningProcess $ExpoPort
if ($ExpoPort -ne 443) {
  Stop-ListeningProcess 443
}
Stop-Cloudflared
Stop-Ngrok
Start-Sleep -Seconds 2

$apiProcess = Start-Api
$apiTunnel = Start-CloudflareTunnel $ApiPort "api"
Update-MobileEnv $apiTunnel.Url

$expoProcess = Start-Expo
$expoTunnelUrl = Wait-ExpoTunnelUrl

$health = Wait-ExternalJson "$($apiTunnel.Url)/health"
$manifest = Wait-ExternalJson $expoTunnelUrl
$bundleUrl = "$expoTunnelUrl/apps/mobile/index.bundle?platform=android&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=app&unstable_transformProfile=hermes-stable"
$bundle = Wait-ExternalBundle $bundleUrl

$result = [ordered]@{
  apiUrl = $apiTunnel.Url
  wsUrl = "$($apiTunnel.Url.Replace("https://", "wss://").Replace("http://", "ws://"))/ws"
  expoManifestUrl = $expoTunnelUrl
  expoGoUrl = $expoTunnelUrl.Replace("http://", "exp://").Replace("https://", "exps://")
  apiProcessId = $apiProcess.Id
  apiTunnelProcessId = $apiTunnel.Process.Id
  expoProcessId = $expoProcess.Id
  expoTunnelProcessId = (Get-Process ngrok -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id)
  apiHealth = $health
  expoHostUri = $manifest.extra.expoClient.hostUri
  bundleStatus = [int] $bundle.StatusCode
  bundleHasPublicApi = $bundle.Content.Contains($apiTunnel.Url.Replace("https://", "").Replace("http://", ""))
  bundleHasOldLanIp = $bundle.Content.Contains("192.168.219.116")
  startedAt = (Get-Date).ToString("o")
}

$result | ConvertTo-Json -Depth 8 | Set-Content -Path $ApiUrlFile -Encoding UTF8
$result | ConvertTo-Json -Depth 8
