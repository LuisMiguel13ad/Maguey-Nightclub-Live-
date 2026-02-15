# Roadmap: Maguey Nightclub Live

## Milestones

- ✅ **v1.0 Production Hardening** — Phases 1-13 (shipped 2026-02-09) — [Full details](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 Launch Readiness** — Phases 14-23 (started 2026-02-13) — [Full details](milestones/v2.0-ROADMAP.md)

## Phases

<details>
<summary>✅ v1.0 Production Hardening (Phases 1-13) — SHIPPED 2026-02-09</summary>

- [x] Phase 1: Payment Flow Hardening (6/6 plans) — completed 2026-01-29
- [x] Phase 2: Email Reliability (6/6 plans) — completed 2026-01-30
- [x] Phase 3: Scanner System Hardening (5/5 plans) — completed 2026-01-30
- [x] Phase 4: VIP System Reliability (7/7 plans) — completed 2026-01-30
- [x] Phase 5: Dashboard Accuracy (5/5 plans) — completed 2026-01-31
- [x] Phase 6: Infrastructure & Monitoring (5/5 plans) — completed 2026-01-31
- [x] Phase 7: UX Polish (7/7 plans) — completed 2026-01-31
- [x] Phase 8: GA End-to-End Testing (4/4 plans) — completed 2026-01-31
- [x] Phase 9: VIP End-to-End Testing (7/7 plans) — completed 2026-02-01
- [x] Phase 10: Load Testing & Performance (5/5 plans) — completed 2026-02-01
- [x] Phase 11: Error Handling & Recovery (4/4 plans) — completed 2026-02-01
- [x] Phase 12: Launch Readiness Review (3/3 plans) — completed 2026-02-01
- [x] Phase 13: Code Cleanup & Scanner Consolidation (2/2 plans) — completed 2026-02-09

</details>

### v2.0 Launch Readiness (Phases 14-23) — IN PROGRESS

- [x] Phase 14: Auth Foundation & Account Setup (3/3 plans) — completed 2026-02-13
  - [x] 14-01-PLAN.md — Create Supabase auth accounts (owner + employee) + verification script
  - [x] 14-02-PLAN.md — Wire AuthContext to real Supabase auth, gate localStorage behind DEV
  - [x] 14-03-PLAN.md — Credential verification automation (env consistency, key validation)
- [x] Phase 15: Auth Hardening & Login Flows (3/3 plans) — completed 2026-02-13
  - [x] 15-01-PLAN.md — Owner login page at /auth/owner with password reset & invitation support
  - [x] 15-02-PLAN.md — Employee login page at /auth/employee with mobile-optimized UI & remember-me
  - [x] 15-03-PLAN.md — Replace Auth.tsx with redirect, eliminate demo code, wire sign-out targets
- [x] Phase 16: Route Protection (2/2 plans) — completed 2026-02-13
  - [x] 16-01-PLAN.md — Create ProtectedRoute component with role-based guards + 403 Unauthorized page
  - [x] 16-02-PLAN.md — Wrap all 30+ routes with ProtectedRoute in App.tsx + post-login redirect
- [x] Phase 17: Security Lockdown (4/4 plans) — completed 2026-02-14
  - [x] 17-01-PLAN.md — Move QR signature verification to server-side Edge Function
  - [x] 17-02-PLAN.md — Migrate all 11 Edge Functions to shared CORS handler
  - [x] 17-03-PLAN.md — Remove anonymous VIP RLS access, add token-based RPC
  - [x] 17-04-PLAN.md — Reject unsigned QR codes in scanner (manual entry preserved)
- [x] Phase 18: Scanner Improvements (4/4 plans) — completed 2026-02-15
  - [x] 18-01-PLAN.md — Auto-detect tonight's event + date display in dropdown
  - [x] 18-02-PLAN.md — Offline mode: reject unknown tickets with "NOT IN CACHE" overlay
  - [x] 18-03-PLAN.md — Log failed scans to server scan_logs (fire-and-forget)
  - [x] 18-04-PLAN.md — Rate limit manual entry (5/min) + display device ID in header
- [x] Phase 19: Dashboard Data Accuracy (3/3 plans) — completed 2026-02-14
  - [x] 19-01-PLAN.md — Fix orders query with tickets join (real ticket_count/ticket_type)
  - [x] 19-02-PLAN.md — Staff name resolution service (replace UUIDs with names)
  - [x] 19-03-PLAN.md — Targeted real-time refresh (split loadData + useDashboardRealtime)
- [x] Phase 20: Dashboard & UI Bloat Cleanup (4/4 plans) — completed 2026-02-15
  - [x] 20-01-PLAN.md — Gate 6 monitoring routes behind requireDev, hide MONITORING sidebar in production
  - [x] 20-02-PLAN.md — Add System Health to sidebar, finalize simplified 9-item structure
  - [x] 20-03-PLAN.md — Rename Analytics tabs, rebrand Fraud as Security Alerts, simplify Notification Rules
  - [x] 20-04-PLAN.md — Gate NFC behind VITE_ENABLE_NFC feature flag, confirm dead code status
- [ ] Phase 21: VIP & Events Polish (0/5 plans)
- [ ] Phase 22: Code Quality & Refactoring (0/4 plans)
- [ ] Phase 23: CI/CD & Production Deployment (0/3 plans)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Payment Flow Hardening | v1.0 | 6/6 | Complete | 2026-01-29 |
| 2. Email Reliability | v1.0 | 6/6 | Complete | 2026-01-30 |
| 3. Scanner System Hardening | v1.0 | 5/5 | Complete | 2026-01-30 |
| 4. VIP System Reliability | v1.0 | 7/7 | Complete | 2026-01-30 |
| 5. Dashboard Accuracy | v1.0 | 5/5 | Complete | 2026-01-31 |
| 6. Infrastructure & Monitoring | v1.0 | 5/5 | Complete | 2026-01-31 |
| 7. UX Polish | v1.0 | 7/7 | Complete | 2026-01-31 |
| 8. GA End-to-End Testing | v1.0 | 4/4 | Complete | 2026-01-31 |
| 9. VIP End-to-End Testing | v1.0 | 7/7 | Complete | 2026-02-01 |
| 10. Load Testing & Performance | v1.0 | 5/5 | Complete | 2026-02-01 |
| 11. Error Handling & Recovery | v1.0 | 4/4 | Complete | 2026-02-01 |
| 12. Launch Readiness Review | v1.0 | 3/3 | Complete | 2026-02-01 |
| 13. Code Cleanup & Scanner Consolidation | v1.0 | 2/2 | Complete | 2026-02-09 |
| 14. Auth Foundation & Account Setup | v2.0 | 3/3 | Complete | 2026-02-13 |
| 15. Auth Hardening & Login Flows | v2.0 | 3/3 | Complete | 2026-02-13 |
| 16. Route Protection | v2.0 | 2/2 | Complete | 2026-02-13 |
| 17. Security Lockdown | v2.0 | 4/4 | Complete | 2026-02-14 |
| 18. Scanner Improvements | v2.0 | 4/4 | Complete | 2026-02-15 |
| 19. Dashboard Data Accuracy | v2.0 | 3/3 | Complete | 2026-02-14 |
| 20. Dashboard & UI Bloat Cleanup | v2.0 | 4/4 | Complete | 2026-02-15 |
| 21. VIP & Events Polish | v2.0 | 0/5 | Not Started | — |
| 22. Code Quality & Refactoring | v2.0 | 0/4 | Not Started | — |
| 23. CI/CD & Production Deployment | v2.0 | 0/3 | Not Started | — |
