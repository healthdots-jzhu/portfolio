---
agent: agent
description: Run a periodic delta-only code review focused on new changes since the previous review baseline, covering bugs, regressions, security, infra risks, and missing tests.
---
# Periodic Code Review

Perform a periodic review of this repository as a staff-level reviewer.

## Review Goal
Identify the most important issues that could cause:

- Functional bugs or behavioral regressions
- Security or authorization vulnerabilities covering TOP 10 OWASP API risks
- Data integrity or migration risk
- Infrastructure/CI deployment risk
- Missing or insufficient tests for changed behavior
- No secrets/passwords/keys should be committed

Prioritize actionable findings over broad commentary.

## Scope
Default to delta-only review since the previous review baseline.

Review only changed files in the delta first, then inspect adjacent high-risk code paths only when required to validate impact.

When a baseline cannot be determined from saved metadata, use the initial fallback strategy below. Only stop and ask for a baseline if fallback resolution also fails.

Targeted surfaces for delta review:

- Backend API in `APIs/Portfolio.Api`
- Frontend SPA in `portfolio-frontend`
- Infrastructure in `terraform`
- CI/CD workflows in `.github/workflows`

If the request includes a commit range, branch diff, PR, or changed-files list, treat that as the baseline/scope source of truth.

## Baseline Rules
Determine review baseline in this order:

1. Explicit user-provided baseline (`baseline` input).
2. Baseline metadata from the latest review log in `logs/code-review-*.txt`.
3. Fallback checkpoint file `logs/last-code-review-baseline.txt` if present.
4. Initial fallback strategy for first run:
	- Prefer `merge-base(default-branch, head)` as `ReviewBaseline`.
	- If default-branch reference is unavailable, use `HEAD~1`.
	- If repository has only one commit, use root commit as both baseline and head.

Baseline metadata to capture in each review log:

- `ReviewBaseline`: starting commit/PR/reference used for delta
- `ReviewHead`: ending commit/PR/reference reviewed

After completing a review, update/create `logs/last-code-review-baseline.txt` with the reviewed head reference.

## High-Risk Focus Areas
- Auth and claims handling in `Program.cs` and related auth flow
- API route and `PATH_BASE` alignment with ALB paths
- Secret naming consistency across app config, Terraform, and workflows
- RDS schema/migration compatibility with existing production data
- Terraform resources with `prevent_destroy`
- Terraform remote state safety (S3 backend + DynamoDB lock table)

## Required Review Process
1. Resolve baseline and head references.
2. Collect delta change context from git diff or PR files using that baseline.
3. Read relevant code paths, not just changed lines.
4. Verify contract consistency across backend, frontend, Terraform, and workflows where applicable.
5. Evaluate tests for changed behavior; flag missing coverage.
6. Produce findings ordered by severity.
7. Write review notes to `logs/code-review-YYYYMMDD-HHMMSS.txt`.
8. Record/update baseline checkpoint for the next periodic review.

## Severity Definitions
- Critical: likely production outage, data loss, auth bypass, or major security exposure
- High: severe bug/regression or high-risk deploy/infra issue
- Medium: correctness, maintainability, or reliability issue with moderate impact
- Low: minor robustness, clarity, or consistency issue

## Output Requirements
Return findings first, ordered by severity. For each finding include:

- Severity
- Title
- Evidence with file references and key lines
- Why it is a risk
- Concrete fix recommendation

Then include:

- Open questions/assumptions (if any)
- Residual risks and testing gaps
- Brief change summary only after findings
- Baseline metadata (`ReviewBaseline`, `ReviewHead`)

If no findings are discovered, explicitly state that and list residual risks/testing gaps.

## Repository-Constrained Checks
- Use PowerShell command style for any commands in the review notes.
- Do not recommend committing secrets or `.env` values.
- For Terraform findings, explicitly mention blast radius and state implications.
- For API/route/auth findings, check both backend and frontend impact.

## Optional Inputs
If provided by the user, honor these parameters:

- `scope`: directories/files to focus on
- `baseline`: commit SHA, branch, or PR number
- `head`: ending commit SHA, branch, or PR number
- `cadence`: weekly, pre-release, post-incident
- `strictness`: standard or deep

If not provided, run standard strictness on the resolved delta only.