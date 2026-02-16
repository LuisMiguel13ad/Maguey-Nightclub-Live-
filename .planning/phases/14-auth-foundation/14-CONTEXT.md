# Phase 14: Auth Foundation & Account Setup

**Priority:** P0 | **Effort:** 2 days | **Dependencies:** None (first phase)
**Goal:** Establish real Supabase authentication as the foundation for all subsequent auth work.

## Issues Addressed

| GSD # | Issue | Requirement |
|-------|-------|-------------|
| 46 | Create owner account in Supabase Auth | R10 |
| 47 | Create employee/scanner account in Supabase Auth | R11 |
| 48 | Wire AuthContext to use Supabase credentials | R12 |
| 9 | localStorage auth fallback leaks to production | R09 |
| 49 | Verify .env files consistent across sites | R35 |
| 50 | Verify Stripe test keys functional | R36 |
| 51 | Verify Resend email API key active | R37 |

## Plans

| Plan | Objective | Wave |
|------|-----------|------|
| 14-01 | Create Supabase auth accounts (owner + employee) + verification script | 1 |
| 14-02 | Wire AuthContext to real Supabase auth, gate localStorage behind DEV | 2 |
| 14-03 | Credential verification automation (env consistency, key validation) | 1 |

## Key Files

- `maguey-gate-scanner/src/contexts/AuthContext.tsx` — localStorage fallback at lines 41-51, 60-72, 82-93, 114-124
- `maguey-gate-scanner/src/lib/localStorage.ts` — localStorage service used as auth fallback
- `maguey-gate-scanner/src/lib/supabase-config.ts` — `isSupabaseConfigured()` check
- `maguey-gate-scanner/src/lib/auth.ts` — Role management, `getUserRole()`, `setUserRole()`

## Context Decisions

| Decision | Rationale |
|----------|-----------|
| Owner account: info@magueynightclub.com | Per CLAUDE.md — primary owner credentials |
| Employee account: Luismbadillo13@gmail.com | Per CLAUDE.md — scanner staff credentials |
| Gate localStorage behind `import.meta.env.DEV` | Production builds must ONLY use Supabase sessions |
| Credential scripts use Supabase admin API | Service role key enables programmatic account creation |

## Success Criteria

- Owner can log in with real Supabase credentials
- Employee can log in with real Supabase credentials
- localStorage fallback does NOT activate in production builds
- All 3 sites have consistent .env files
- Stripe and Resend keys validated as functional
