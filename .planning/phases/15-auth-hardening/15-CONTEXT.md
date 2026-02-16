# Phase 15: Auth Hardening & Login Flows

**Priority:** P0 | **Effort:** 2 days | **Dependencies:** Phase 14
**Goal:** Create separate, role-appropriate login experiences and remove all demo/test shortcuts.

## Issues Addressed

| GSD # | Issue | Requirement |
|-------|-------|-------------|
| 7 | No separate owner vs employee login flow | R07 |
| 8 | Demo/test shortcuts on auth page | R08 |

## Plans

| Plan | Objective | Wave |
|------|-----------|------|
| 15-01 | Separate owner login flow (/auth/owner) | 1 |
| 15-02 | Separate employee login flow (/auth/employee) | 1 |
| 15-03 | Remove demo shortcuts and gate dev tools behind DEV flag | 2 |

## Key Files

- `maguey-gate-scanner/src/pages/Auth.tsx` — 500+ lines, `handleDemoLogin` (line 351), demo credentials (lines 382-386)
- `maguey-gate-scanner/src/lib/auth.ts` — Role management, permission matrix

## Context Decisions

| Decision | Rationale |
|----------|-----------|
| Owner: /auth/owner with email/password | Professional login for business owner |
| Employee: /auth/employee with simplified auth | Quick access for scanner staff at the door |
| /auth redirects to /auth/employee by default | Most common login is scanner staff |
| All demo functions gated behind `import.meta.env.DEV` | No demo access in production builds |

## Success Criteria

- Owner logs in at /auth/owner with email/password
- Employee logs in at /auth/employee with simplified flow
- No demo buttons visible in production
- Role-based redirect after login (owner → /dashboard, employee → /scanner)
