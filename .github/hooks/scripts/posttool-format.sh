#!/usr/bin/env bash
set -euo pipefail

# PostToolUse hook: best-effort auto-format after workspace-modifying tool runs (apply_patch)
input=$(cat || true)

# Detect apply_patch presence (best-effort)
if printf '%s' "$input" | grep -Eiq 'apply_patch'; then
  echo "PostToolUse: detected apply_patch — running formatters (best-effort)."

  # Run dotnet format in API project if dotnet is available and solution exists
  if command -v dotnet >/dev/null 2>&1; then
    if [ -f "APIs/Portfolio.Api/Portfolio.Api.sln" ]; then
      echo "Running 'dotnet format' in APIs/Portfolio.Api..."
      (cd APIs/Portfolio.Api && dotnet format --severity info) || echo "dotnet format failed; continuing"
    else
      # fallback: run dotnet format on any solution files found at repo root
      shopt -s nullglob 2>/dev/null || true
      slns=( *.sln )
      if [ ${#slns[@]} -gt 0 ]; then
        for s in "${slns[@]}"; do
          echo "Running 'dotnet format' on $s..."
          dotnet format "$s" || true
        done
      fi
    fi
  fi

  # Format frontend via Prettier using npx (best-effort)
  if command -v npx >/dev/null 2>&1 && [ -f "portfolio-frontend/package.json" ]; then
    echo "Running 'npx prettier --write' in portfolio-frontend..."
    (cd portfolio-frontend && npx --yes prettier --write .) || echo "prettier run failed; continuing"
  fi

  echo "PostToolUse: formatting complete."
else
  echo "PostToolUse: no apply_patch detected — skipping auto-format."
fi

printf '%s\n' '{"continue": true}'
exit 0
