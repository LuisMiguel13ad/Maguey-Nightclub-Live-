---
phase: 23-cicd-deployment
plan: 01
subsystem: ci-cd
tags: [github-actions, automation, testing, deployment]
dependency_graph:
  requires: []
  provides: [ci-cd-pipeline, automated-testing, build-validation]
  affects: [all-workspaces]
tech_stack:
  added: []
  patterns: [github-actions-workflow, parallel-e2e-testing, job-dependencies]
key_files:
  created:
    - .github/workflows/e2e.yml
  modified: []
decisions:
  - title: "Sequential job dependencies (lint -> unit-test -> build -> e2e)"
    rationale: "Fail-fast approach saves CI minutes by stopping at first failure point"
  - title: "Fixed E2E spec distribution across 4 containers without duplication"
    rationale: "Container 1 and 2 both running happy-path/**/*.cy.ts was a bug causing redundant test execution"
  - title: "Include maguey-nights in lint and build jobs"
    rationale: "Marketing site was missing from CI pipeline despite being production-deployed"
metrics:
  duration_seconds: 62
  tasks_completed: 1
  files_modified: 1
  commits: 1
  completed_at: "2026-02-15T21:44:49Z"
---

# Phase 23 Plan 01: GitHub Actions CI/CD Pipeline

**One-liner:** Enabled automatic CI/CD with lint -> unit-test -> build -> e2e job sequence across all 3 workspaces with fixed E2E spec distribution

## What Was Done

### Task 2: Fix and enable the CI/CD workflow (COMPLETE)

**Changes to `.github/workflows/e2e.yml`:**

1. **Uncommented push/PR triggers** - Pipeline now runs automatically on pushes and PRs to main and develop branches
2. **Added `lint` job** - Runs ESLint on all 3 workspaces (pass-lounge, gate-scanner, maguey-nights)
3. **Added `unit-test` job** - Runs Vitest tests for pass-lounge and gate-scanner (maguey-nights has no test script)
4. **Updated `build` job** - Now builds all 3 sites including maguey-nights (was missing)
5. **Fixed E2E spec duplication** - Container 1 now runs `health-check.cy.ts,smoke.cy.ts` instead of duplicating happy-path with container 2
6. **Configured job dependencies** - Pipeline execution order: lint -> unit-test -> build -> e2e

**E2E Spec Distribution (Fixed):**
- Container 1: health-check.cy.ts, smoke.cy.ts (2 specs)
- Container 2: happy-path/**/*.cy.ts (3 specs)
- Container 3: edge-cases/**/*.cy.ts (5 specs)
- Container 4: offline/**/*.cy.ts (2 specs)

**Verification:**
- YAML syntax valid (GitHub Actions will parse successfully)
- Push/PR triggers enabled on lines 5 and 7
- All 4 jobs present: lint, unit-test, build, e2e
- maguey-nights appears in both lint and build jobs
- Container 1 no longer runs happy-path specs (duplication fixed)

## Deviations from Plan

None - plan executed exactly as written.

## Task 1: Manual Action Required (NOT DONE BY CLAUDE)

**User must configure 7 GitHub repository secrets before pipeline can run:**

Go to: https://github.com/LuisMiguel13ad/Maguey-Nightclub-Live-/settings/secrets/actions

Add these secrets (values from CLAUDE.md):

1. `VITE_SUPABASE_URL` = `https://djbzjasdrwvbsoifxqzd.supabase.co`
2. `VITE_SUPABASE_ANON_KEY` = (anon key from CLAUDE.md)
3. `SUPABASE_SERVICE_ROLE_KEY` = (service role key from CLAUDE.md)
4. `STRIPE_TEST_PK` = `pk_test_51SdKwiK9xNUVZKDuAzJsTllAGm5ZshO9WsNjD9EvNqYL6KX65FpnIpG23FSXbOHmMvXyNavlPpCOKvUchgFyhraB00TkmKNBqx`
5. `STRIPE_TEST_SK` = `sk_test_51SdKwiK9xNUVZKDukmYheWf07z1vgS2dc5pqB35BhHxd90QRwJqblqxPtMprzyyUOfvcc162KrDV1o8ce6gsx3nZ009X7wd543`
6. `SCANNER_TEST_EMAIL` = `Luismbadillo13@gmail.com`
7. `SCANNER_TEST_PASSWORD` = `MagueyScanner123`

**After secrets are configured, the next push to main or develop will trigger the full CI/CD pipeline.**

## Files Modified

| File | Change |
|------|--------|
| .github/workflows/e2e.yml | Created complete CI/CD workflow with 4 jobs (lint, unit-test, build, e2e) |

## Commits

| Hash | Message |
|------|---------|
| 5ee1911 | feat(23-01): enable CI/CD pipeline with lint, test, and build jobs |

## Impact

**Immediate:**
- CI/CD pipeline ready to run (pending GitHub secrets configuration)
- Automated quality gates on all PRs and pushes
- E2E test parallelization optimized (4 containers, no duplication)

**Long-term:**
- Prevents regressions from reaching main branch
- Reduces manual testing burden on developers
- Provides confidence for production deployments

## Success Criteria Verification

- [x] CI/CD workflow YAML is valid and has push/PR triggers enabled
- [x] Pipeline runs lint -> unit-test -> build -> e2e in correct dependency order
- [x] All 3 sites are linted and built
- [x] Unit tests run for pass-lounge and gate-scanner
- [x] E2E specs are distributed across 4 containers without duplication
- [ ] After GitHub secrets are set (Task 1), a push to main triggers the full pipeline *(user action required)*

## Next Steps

1. **User:** Configure 7 GitHub secrets per Task 1 instructions
2. **User:** Push a commit to main or develop to trigger first pipeline run
3. **Team:** Monitor first pipeline run for any environment-specific issues
4. **Next plan:** 23-02 (Vercel deployment configuration)

## Self-Check: PASSED

**Files created:**
```bash
[ -f ".github/workflows/e2e.yml" ] && echo "FOUND: .github/workflows/e2e.yml"
```
FOUND: .github/workflows/e2e.yml

**Commits exist:**
```bash
git log --oneline --all | grep -q "5ee1911" && echo "FOUND: 5ee1911"
```
FOUND: 5ee1911

**Workflow structure verified:**
- 4 jobs defined (lint, unit-test, build, e2e)
- Push/PR triggers uncommented
- maguey-nights in lint and build
- Container 1 runs health+smoke (not happy-path)
