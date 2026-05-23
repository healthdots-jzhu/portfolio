#!/usr/bin/env pwsh
<#
PostToolUse PowerShell script: auto-format after workspace-modifying tool runs (apply_patch).
Best-effort: runs `dotnet format` for API solution and `npx prettier --write` for the frontend if available.
#>

$input = [Console]::In.ReadToEnd() | Out-String

$applyPatchDetected = $false
try {
    $json = ConvertFrom-Json $input -ErrorAction SilentlyContinue
    if ($json -and $json.PSObject.Properties.Name -contains 'toolName') {
        if ($json.toolName -match 'apply_patch') { $applyPatchDetected = $true }
    }
} catch { }

if (-not $applyPatchDetected -and $input -match 'apply_patch') { $applyPatchDetected = $true }

if ($applyPatchDetected) {
    Write-Output "PostToolUse: detected apply_patch — running formatters (best-effort)."

    # dotnet format
    if (Get-Command dotnet -ErrorAction SilentlyContinue) {
        if (Test-Path 'APIs/Portfolio.Api/Portfolio.Api.sln') {
            Write-Output "Running dotnet format in APIs/Portfolio.Api..."
            Push-Location 'APIs/Portfolio.Api'
            try { dotnet format --severity info } catch { Write-Output "dotnet format failed: $_" }
            Pop-Location
        } else {
            $slnFiles = Get-ChildItem -Path . -Filter *.sln -ErrorAction SilentlyContinue
            foreach ($s in $slnFiles) {
                Write-Output "Running dotnet format on $($s.FullName)..."
                try { dotnet format $s.FullName } catch { Write-Output "dotnet format failed: $_" }
            }
        }
    }

    # Prettier via npx
    if (Get-Command npx -ErrorAction SilentlyContinue) {
        if (Test-Path 'portfolio-frontend\package.json') {
            Write-Output "Running 'npx prettier --write' in portfolio-frontend..."
            Push-Location 'portfolio-frontend'
            try { & npx --yes prettier --write . } catch { Write-Output "Prettier run failed: $_" }
            Pop-Location
        }
    }
    Write-Output "PostToolUse: formatting complete."
} else {
    Write-Output "PostToolUse: no apply_patch detected — skipping auto-format."
}

@{ continue = $true } | ConvertTo-Json -Depth 5
exit 0
