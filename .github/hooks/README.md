
Hooks: PreToolUse (allow) + PostToolUse (auto-format)
===============================================

Overview
--------
- `PreToolUse`: non-interactive validator that returns `allow`. The agent will not be prompted for permission.
- `PostToolUse`: runs best-effort formatting after workspace-modifying tool runs (for example `apply_patch`). It attempts repository-appropriate formatters:
	- `dotnet format` for the API solution (if `dotnet` is available)
	- `npx prettier --write .` in `portfolio-frontend` (if `npx` is available)

Files
-----
- `pretool-validate.json` — hook configuration (in this folder)
- `scripts/validate-pretool.sh` — POSIX PreToolUse validator (always `allow`)
- `scripts/validate-pretool.ps1` — PowerShell PreToolUse validator (always `allow`)
- `scripts/posttool-format.sh` — POSIX PostToolUse auto-formatter (best-effort)
- `scripts/posttool-format.ps1` — PowerShell PostToolUse auto-formatter (best-effort)

How it behaves
---------------
- When a tool invocation is about to run, the PreToolUse hook returns `{ permissionDecision: "allow" }` so the agent continues without interactive permission requests.
- After the tool completes, the PostToolUse hook checks whether `apply_patch` was involved and then runs formatters in-place. The hook edits files directly in the workspace (same as any local formatter would).

How to test locally
--------------------

POSIX (Bash):

```bash
printf '%s' '{"toolName":"apply_patch"}' | .github/hooks/scripts/posttool-format.sh
```

PowerShell (Windows / pwsh):

```powershell
'{"toolName":"apply_patch"}' | .\.github\hooks\scripts\posttool-format.ps1
```

Notes & next steps
------------------
- These formatters are best-effort: if a formatter is unavailable the script will continue without failing the hook.
- To add or change formatters (e.g., ESLint auto-fix, additional dotnet projects), update the PostToolUse scripts.
- If you prefer `deny` for any tool, modify `pretool-validate.json` and `validate-pretool.*` accordingly.

