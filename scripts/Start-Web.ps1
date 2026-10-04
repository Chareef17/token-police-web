$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectPath
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodePath = $nodeCommand.Source }
else { $nodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Install Node.js 24.17 or newer first.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectPath '.next\BUILD_ID'))) { throw 'Build the project with pnpm build first.' }
$syncProcess = Start-Process -FilePath $nodePath -ArgumentList @('--env-file-if-exists=.env.local','scripts/index-ge6.mjs','--watch') -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru
try {
  Write-Host 'TokenPolice Web: http://127.0.0.1:3000 (Ctrl+C to stop)'
  & $nodePath --env-file-if-exists=.env.local node_modules/next/dist/bin/next start --hostname 127.0.0.1
} finally {
  if (-not $syncProcess.HasExited) { Stop-Process -Id $syncProcess.Id }
}
