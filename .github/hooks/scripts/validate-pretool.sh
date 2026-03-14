#!/usr/bin/env bash
set -euo pipefail

# Read stdin but do no interactive prompting — always allow.
_input=$(cat || true)
printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
exit 0
