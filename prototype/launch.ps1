# Copyright 2026 Loki Ventures
# SPDX-License-Identifier: AGPL-3.0-only
param([ValidateSet("Demo", "Chat", "Matrix", "All")][string]$Mode = "All", [switch]$SkipBuild)
$ErrorActionPreference = "Stop"
$prototypeRoot = $PSScriptRoot
$repoRoot = Split-Path $prototypeRoot -Parent
$nodeExe = Join-Path $prototypeRoot "toolchain/node_modules/node/bin/node.exe"
$pnpmScript = Join-Path $prototypeRoot "toolchain/node_modules/pnpm/bin/pnpm.cjs"
if (!(Test-Path -LiteralPath $nodeExe)) { throw "Run npm install --prefix prototype/toolchain --no-save node@22.18.0 pnpm@11.23.0 from the repository first." }
$gitRoot = Split-Path (Split-Path (Get-Command git).Source -Parent) -Parent
$env:PATH = (Split-Path $nodeExe -Parent) + ";" + (Join-Path $prototypeRoot "toolchain/node_modules/.bin") + ";" + (Join-Path $gitRoot "bin") + ";" + $env:PATH
$env:NX_DAEMON = "false"
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$logs = Join-Path $prototypeRoot "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $prototypeRoot ".state") | Out-Null
function RunPnpm([string[]]$CommandArgs) {
    & $nodeExe $pnpmScript @CommandArgs
    if ($LASTEXITCODE -ne 0) { throw "pnpm failed: $CommandArgs" }
}
function StartPrototype([string]$Name, [string]$WorkDir, [string[]]$CommandArgs, [int]$Port) {
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "$Name port $Port is already in use; leaving its process untouched."
        return
    }
    $quoted = @($pnpmScript) + $CommandArgs | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }
    $started = Start-Process -FilePath $nodeExe -ArgumentList $quoted -WorkingDirectory $WorkDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs "$Name.log") -RedirectStandardError (Join-Path $logs "$Name.err.log")
    @{ name = $Name; pid = $started.Id; started = $started.StartTime.ToUniversalTime().ToString("o") } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $prototypeRoot ".state/$Name-process.json") -Encoding UTF8
    Write-Host "$Name started (PID $($started.Id)) on http://localhost:$Port"
}
Push-Location $repoRoot
try {
    if ($Mode -eq "Matrix" -or $Mode -eq "All") {
        $dockerExe = "C:/Program Files/Docker/Docker/resources/bin/docker.exe"
        $compose = Join-Path $prototypeRoot "compose.yaml"
        & $dockerExe info --format '{{.ServerVersion}}'
        if ($LASTEXITCODE -ne 0) { throw "Start Docker Desktop, wait for the engine, and rerun." }
        $serverConfig = Join-Path $prototypeRoot ".state/synapse/homeserver.yaml"
        if (!(Test-Path -LiteralPath $serverConfig)) {
            New-Item -ItemType Directory -Force -Path (Split-Path $serverConfig -Parent) | Out-Null
            & $dockerExe compose -f $compose run --rm synapse generate
            if ($LASTEXITCODE -ne 0) { throw "Synapse configuration generation failed." }
            & $nodeExe (Join-Path $prototypeRoot "setup-matrix.ts") configure
            if ($LASTEXITCODE -ne 0) { throw "Synapse configuration failed." }
        }
        & $dockerExe compose -f $compose up -d
        if ($LASTEXITCODE -ne 0) { throw "Synapse startup failed." }
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            try { Invoke-RestMethod "http://127.0.0.1:8010/_matrix/client/versions" | Out-Null; $ready = $true; break } catch { Start-Sleep -Seconds 2 }
        }
        if (!$ready) { throw "Synapse is not ready; inspect docker compose logs." }
        & $nodeExe (Join-Path $prototypeRoot "setup-matrix.ts") seed
        if ($LASTEXITCODE -ne 0) { throw "Synthetic account setup failed." }
    }
    if ($Mode -eq "Demo" -or $Mode -eq "All") {
        StartPrototype "jade-demo" $repoRoot @("--filter", "@omnichat/jade-workspace", "dev") 3005
    }
    if ($Mode -eq "Chat" -or $Mode -eq "All") {
        if (!$SkipBuild) {
            RunPnpm @("exec", "nx", "run-many", "-t", "build", "-p", "@element-hq/element-web-module-api,@element-hq/element-web-shared-utils,@element-hq/web-shared-components")
            RunPnpm @("--filter", "@omnichat/jade-workspace", "build")
        }
        RunPnpm @("--filter", "element-web", "rethemendex")
        Copy-Item -LiteralPath (Join-Path $prototypeRoot "element-config.json") -Destination (Join-Path $repoRoot "apps/web/config.json")
        $moduleAssets = Join-Path $repoRoot "apps/web/webapp/jade"
        New-Item -ItemType Directory -Force -Path $moduleAssets | Out-Null
        Copy-Item -Path (Join-Path $repoRoot "modules/jade-workspace/lib/*") -Destination $moduleAssets -Recurse -Force
        # Shared packages are built above. Start webpack directly to avoid redundant Nx watch processes on Windows.
        StartPrototype "element" $repoRoot @("--filter", "element-web", "exec", "webpack-dev-server", "--output-path", "webapp", "--output-filename=bundles/_dev_/[name].js", "--output-chunk-filename=bundles/_dev_/[name].js", "--mode", "development", "--port", "3010", "--host", "127.0.0.1") 3010
    }
} finally { Pop-Location }
