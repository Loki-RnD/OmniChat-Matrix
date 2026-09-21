# Copyright 2026 Loki Ventures
# SPDX-License-Identifier: AGPL-3.0-only
$ErrorActionPreference = "Stop"
foreach ($name in @("jade-demo", "element")) {
    $recordPath = Join-Path $PSScriptRoot ".state/$name-process.json"
    if (!(Test-Path -LiteralPath $recordPath)) { continue }
    $record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
    $ownedProcess = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if ($ownedProcess -and $ownedProcess.StartTime.ToUniversalTime().ToString("o") -eq $record.started) {
        & taskkill.exe /PID $record.pid /T /F
    } else { Write-Host "$name process has already stopped; no other process was touched." }
}
& "C:/Program Files/Docker/Docker/resources/bin/docker.exe" compose -f (Join-Path $PSScriptRoot "compose.yaml") stop
