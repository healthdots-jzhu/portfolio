Param()

# debug-oidc.ps1
# - If ACTIONS_ID_TOKEN_REQUEST_URL and ACTIONS_ID_TOKEN_REQUEST_TOKEN are set, requests the OIDC token
#   from the Actions runtime token endpoint and decodes the JWT payload.
# - If TEST_TOKEN is set, uses that JWT instead (useful for local testing).

Set-StrictMode -Version Latest

function Decode-Base64Url {
    param([string]$s)
    if (-not $s) { return "" }
    $s = $s.Replace('-','+').Replace('_','/')
    switch ($s.Length % 4) {
        0 { }
        2 { $s += '==' }
        3 { $s += '=' }
        Default { $s += '=' * (4 - ($s.Length % 4)) }
    }
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($s))
}

$reqUrl = $env:ACTIONS_ID_TOKEN_REQUEST_URL
$reqToken = $env:ACTIONS_ID_TOKEN_REQUEST_TOKEN
$testToken = $env:TEST_TOKEN

if (-not $reqUrl -or -not $reqToken) {
    if (-not $testToken) {
        Write-Error "ACTIONS_ID_TOKEN_REQUEST_URL or ACTIONS_ID_TOKEN_REQUEST_TOKEN missing and TEST_TOKEN not provided."
        exit 2
    }
    Write-Host "Using TEST_TOKEN (local test mode)"
    $jwt = $testToken
} else {
    Write-Host "Requesting ID token from runtime endpoint..."
    try {
        $resp = Invoke-RestMethod -Uri $reqUrl -Headers @{ Authorization = "Bearer $reqToken" } -Method Get -ErrorAction Stop
    } catch {
        Write-Error "Failed to GET token endpoint: $($_.Exception.Message)"
        exit 3
    }
    if ($null -eq $resp.value -or $resp.value -eq '') {
        Write-Error "Token endpoint returned empty 'value' field. Response: $($resp | ConvertTo-Json -Depth 5)"
        exit 4
    }
    $jwt = $resp.value
}

# Validate JWT structure
$parts = $jwt -split '\.'
if ($parts.Length -lt 2) {
    Write-Error "Malformed JWT (expected at least header.payload)."
    exit 5
}

try {
    $payloadJson = Decode-Base64Url $parts[1]
    $payloadObj = $payloadJson | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Error "Failed to decode/parse JWT payload: $($_.Exception.Message)"
    exit 6
}

Write-Host "Decoded JWT payload:"
$payloadObj | ConvertTo-Json -Depth 10

# Helpful output: show `sub` and `aud` if present
if ($payloadObj.psobject.Properties.Name -contains 'sub') { Write-Host "sub: $($payloadObj.sub)" }
if ($payloadObj.psobject.Properties.Name -contains 'aud') { Write-Host "aud: $($payloadObj.aud)" }

exit 0
