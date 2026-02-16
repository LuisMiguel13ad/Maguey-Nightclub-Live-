# Phase 16: Route Protection

**Priority:** P0 | **Effort:** 1.5 days | **Dependencies:** Phase 14, 15
**Goal:** Add authentication and role-based guards to all dashboard routes.

## Issues Addressed

| GSD # | Issue | Requirement |
|-------|-------|-------------|
| 6 | Dashboard routes not protected at route level | R06 |

## Plans

| Plan | Objective | Wave |
|------|-----------|------|
| 16-01 | Create ProtectedRoute component with role-based guards | 1 |
| 16-02 | Wrap all 30+ routes with ProtectedRoute in App.tsx | 2 |

## Key Files

- `maguey-gate-scanner/src/App.tsx` — 30+ unprotected routes (lines 53-91)
- New: `maguey-gate-scanner/src/components/ProtectedRoute.tsx`

## Route Classification

| Access Level | Routes |
|-------------|--------|
| Public | `/`, `/auth`, `/auth/owner`, `/auth/employee` |
| Employee (authenticated) | `/scanner`, `/guest-list`, `/scan/vip`, `/scan/vip/:eventId` |
| Owner only | `/dashboard`, `/events`, `/analytics`, `/audit-log`, `/security`, `/team`, `/orders`, `/vip-tables`, all `/monitoring/*`, all `/notifications/*`, `/branding`, `/customers`, `/sites`, `/waitlist`, `/queue`, `/devices`, `/door-counters`, `/staff-scheduling`, `/fraud-investigation` |
| Dev only | `/test-qr` |

## Context Decisions

| Decision | Rationale |
|----------|-----------|
| ProtectedRoute accepts role arrays | Flexible: `['owner']`, `['owner', 'promoter']`, `['employee', 'owner']` |
| Redirect to /auth when unauthenticated | Standard pattern — preserve attempted URL for post-login redirect |
| /test-qr gated behind `import.meta.env.DEV` | QR generator must not be accessible in production |
| Loading state shows spinner, not redirect | Prevent flash of login page during session check |

## Success Criteria

- Unauthenticated users redirected to /auth for any protected route
- Employee role sees 403 when accessing owner-only routes
- Owner role can access all routes
- /test-qr only accessible in development
