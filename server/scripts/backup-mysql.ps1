param([string]$OutputDir = "./backups", [string]$EnvFile = "./.env")
$ErrorActionPreference = "Stop"
if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$' -and $Matches[1] -like 'DB_*') {
      [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"', "'"), 'Process')
    }
  }
}
if (-not $env:DB_NAME -or -not $env:DB_USER) { throw "Defina DB_NAME e DB_USER no ambiente ou no arquivo .env." }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path $OutputDir "$($env:DB_NAME)-$stamp.sql"
$env:MYSQL_PWD = $env:DB_PASSWORD
try {
  $hostName = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
  $port = if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }
  & mysqldump --host=$hostName --port=$port --user=$env:DB_USER --single-transaction --routines --triggers $env:DB_NAME | Set-Content -Encoding utf8 $file
  if ($LASTEXITCODE -ne 0) { throw "mysqldump falhou." }
  Write-Output "Backup criado: $file"
}
finally { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
