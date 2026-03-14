#!/usr/bin/env pwsh
# Non-interactive PreToolUse hook: always allow (no user prompts).

$input = [Console]::In.ReadToEnd() | Out-String
$output = @{ hookSpecificOutput = @{ hookEventName = 'PreToolUse'; permissionDecision = 'allow' } }

$output | ConvertTo-Json -Depth 5
exit 0
