# Roadmap: Maguey Nightclub Live

## Overview

This roadmap focuses on hardening the existing platform for production launch. All core features are built — the work ahead ensures reliability, accuracy, and polish across payment flows, email delivery, scanning operations, VIP reservations, dashboard analytics, infrastructure monitoring, and user experience. The final phases validate the complete system through comprehensive testing and launch readiness review.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Payment Flow Hardening** - Ensure GA and VIP payments complete reliably end-to-end
- [x] **Phase 2: Email Reliability** - Guarantee ticket and VIP confirmation emails deliver consistently
- [x] **Phase 3: Scanner System Hardening** - Validate scanner correctly accepts/rejects QR codes and handles offline mode
- [x] **Phase 4: VIP System Reliability** - Fix race conditions and ensure correct status transitions
- [x] **Phase 5: Dashboard Accuracy** - Verify all analytics match source of truth
- [x] **Phase 6: Infrastructure & Monitoring** - Add health checks, rate limiting, error tracking, and logging
- [x] **Phase 7: UX Polish** - Improve loading states, error messages, and mobile experience
- [x] **Phase 8: GA End-to-End Testing** - Validate complete GA ticket flow from purchase to gate scan
- [x] **Phase 9: VIP End-to-End Testing** - Validate complete VIP reservation flow including guest passes
- [x] **Phase 10: Load Testing & Performance** - Test all systems under production-level traffic
- [x] **Phase 11: Error Handling & Recovery** - Validate edge cases and failure recovery across all flows
- [ ] **Phase 12: Launch Readiness Review** - Final validation checklist before production go-live

## Phase Details

### Phase 1: Payment Flow Hardening
**Goal**: Payment flows complete reliably without failures or duplicate charges
**Depends on**: Nothing (first phase)
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04
**Success Criteria** (what must be TRUE):
  1. Customer completes GA ticket purchase and receives ticket confirmation in database
  2. Customer completes VIP table booking and receives confirmed reservation in database
  3. Webhook processes duplicate Stripe events without creating duplicate tickets or reservations
  4. Failed payments show clear, actionable error messages to customers (not technical stack traces)
**Plans**: 6 plans

Plans:
- [x] 01-01-PLAN.md — Database constraints and payment_failures table
- [x] 01-02-PLAN.md — Webhook idempotency and non-blocking email
- [x] 01-03-PLAN.md — Frontend error handling with toast/retry
- [x] 01-04-PLAN.md — Owner notification system for payment failures
- [x] 01-05-PLAN.md — Failure scenario tests (E2E + integration)
- [x] 01-06-PLAN.md — Load tests for 50 concurrent payments

### Phase 2: Email Reliability
**Goal**: Confirmation emails deliver consistently with correct content
**Depends on**: Phase 1 (needs payment completion to test emails)
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03
**Success Criteria** (what must be TRUE):
  1. GA ticket confirmation emails deliver within 2 minutes of purchase with valid QR code
  2. VIP reservation confirmation emails include correct QR code and table assignment details
  3. Failed email sends are logged in database with retry capability
  4. Resend API failures trigger fallback retry logic
**Plans**: 6 plans

Plans:
- [x] 02-01-PLAN.md — Database schema for email queue and delivery tracking
- [x] 02-02-PLAN.md — Queue processor edge function with retry logic
- [x] 02-03-PLAN.md — Resend webhook handler for delivery status
- [x] 02-04-PLAN.md — Wire stripe-webhook to queue emails
- [x] 02-05-PLAN.md — Dashboard email status and retry UI
- [x] 02-06-PLAN.md — Email reliability tests

### Phase 3: Scanner System Hardening
**Goal**: Scanner reliably validates tickets with correct accept/reject behavior and works offline
**Depends on**: Phase 2 (needs valid tickets with QR codes to test)
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04
**Success Criteria** (what must be TRUE):
  1. Valid QR codes from confirmed tickets scan successfully at gate
  2. Invalid, tampered, or expired QR codes are rejected with clear visual feedback
  3. Already-scanned tickets show "already used" status and block re-entry
  4. Scanner continues to work without network connection and syncs checkins when reconnected
  5. Scanner handles concurrent scan attempts without race conditions
**Plans**: 5 plans

Plans:
- [x] 03-01-PLAN.md — Full-screen feedback overlays (success/rejection)
- [x] 03-02-PLAN.md — Offline ticket cache service
- [x] 03-03-PLAN.md — Scan history, check-in counter, offline banner
- [x] 03-04-PLAN.md — Enhanced error details and offline validation
- [x] 03-05-PLAN.md — Dashboard scanner status and verification

### Phase 4: VIP System Reliability
**Goal**: VIP reservations maintain correct state through entire lifecycle with re-entry support
**Depends on**: Phase 1 (needs payment flow working)
**Requirements**: VIP-01, VIP-02, VIP-03, VIP-04
**Success Criteria** (what must be TRUE):
  1. VIP reservation status transitions correctly: pending -> confirmed -> checked_in -> completed
  2. Invalid state transitions (e.g., checked_in -> confirmed) are rejected at database level
  3. VIP host and linked guests can re-enter venue (multiple scans allowed)
  4. VIP floor plan shows real-time table availability via Supabase Realtime
  5. Owner can cancel event with automatic refunds for all VIP reservations
  6. Linked GA tickets get VIP treatment (re-entry allowed, shown as "Guest of Table X")
**Plans**: 7 plans

Plans:
- [x] 04-01-PLAN.md — State transition enforcement (database trigger for forward-only)
- [x] 04-02-PLAN.md — Re-entry detection (VIP scan with re-entry support)
- [x] 04-03-PLAN.md — Realtime floor plan updates (Supabase subscriptions)
- [x] 04-04-PLAN.md — Owner event cancellation (bulk refund flow)
- [x] 04-05-PLAN.md — VIP scanner re-entry UI (enhanced display for re-entry/linked guests)
- [x] 04-06-PLAN.md — GA scanner VIP link detection (linked tickets get VIP re-entry)
- [x] 04-07-PLAN.md — Unified VIP checkout (GA ticket + VIP table in single purchase)

### Phase 5: Dashboard Accuracy
**Goal**: Owner dashboard displays accurate real-time data across all metrics
**Depends on**: Phases 1-4 (needs all data sources working correctly)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Revenue figures in dashboard match Stripe transaction totals exactly
  2. Ticket count displays match database query results for each event
  3. Events created in owner dashboard appear on purchase site within 30 seconds
  4. VIP reservations show in dashboard immediately after confirmation
  5. Analytics charts update in real-time as transactions occur
**Plans**: 5 plans

Plans:
- [x] 05-01-PLAN.md — Revenue reconciliation infrastructure (DB schema + Edge Function)
- [x] 05-02-PLAN.md — Live indicator and real-time subscription enhancements
- [x] 05-03-PLAN.md — Revenue discrepancy display and dashboard integration
- [x] 05-04-PLAN.md — Event sync verification and check-in progress visualization
- [x] 05-05-PLAN.md — Dashboard accuracy validation and verification

### Phase 6: Infrastructure & Monitoring
**Goal**: Production monitoring and protection systems are operational
**Depends on**: Phase 5 (needs complete system to monitor)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Health check endpoints exist for all critical services and return correct status
  2. Rate limiting protects APIs from abuse without blocking legitimate traffic
  3. Sentry captures and reports production errors with full context
  4. Application logs are structured JSON and searchable by request ID
  5. Critical errors trigger alerts via configured notification channel
**Plans**: 5 plans

Plans:
- [x] 06-01-PLAN.md — Health check endpoint (DB, Stripe, Resend, edge functions)
- [x] 06-02-PLAN.md — Rate limiting with Upstash Redis (tiered limits)
- [x] 06-03-PLAN.md — Sentry integration (frontends + edge functions)
- [x] 06-04-PLAN.md — Structured JSON logging with request ID
- [x] 06-05-PLAN.md — Email alert digest system (pg_cron + Resend)

### Phase 7: UX Polish
**Goal**: User experience is smooth with clear feedback during all operations
**Depends on**: Phases 1-4 (UX improvements apply to working flows)
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. Loading spinners appear during all async operations (payment, email, scanning)
  2. Error messages are customer-friendly without technical jargon
  3. Gate scanner interface works smoothly on mobile devices in portrait/landscape
  4. Complete checkout flow from ticket selection to confirmation takes under 60 seconds
  5. All buttons have disabled states during processing to prevent double-submission
**Plans**: 7 plans

Plans:
- [x] 07-01-PLAN.md — Shared loading state components (LoadingButton, skeletons, useLoadingState)
- [x] 07-02-PLAN.md — Centralized error message utilities (persistent toasts with actions)
- [x] 07-03-PLAN.md — Mobile scanner enhancements (wake lock, haptics, offline modal, battery)
- [x] 07-04-PLAN.md — Checkout UX components (stepper, form persistence, transitions)
- [x] 07-05-PLAN.md — Integrate loading states into maguey-pass-lounge pages
- [x] 07-06-PLAN.md — Integrate scanner UX enhancements into Scanner.tsx
- [x] 07-07-PLAN.md — Integrate checkout UX enhancements into Checkout.tsx

### Phase 8: GA End-to-End Testing
**Goal**: Complete general admission flow validated from purchase to gate entry
**Depends on**: Phases 1, 2, 3, 7 (all GA components hardened)
**Requirements**: Cross-cut validation of PAY-01, EMAIL-01, SCAN-01, SCAN-02, SCAN-03, UX-01, UX-04
**Success Criteria** (what must be TRUE):
  1. Test purchase completes: payment -> webhook -> ticket creation -> email delivery -> QR code received
  2. Test QR code scans successfully at gate and marks ticket as used
  3. Second scan attempt correctly shows "already used" error
  4. Invalid QR codes are rejected with clear feedback
  5. Complete flow completes in under 2 minutes from payment to email delivery
**Plans**: 4 plans

Plans:
- [x] 08-01-PLAN.md — Cypress setup and custom commands
- [x] 08-02-PLAN.md — Health checks and CI workflow
- [x] 08-03-PLAN.md — Happy path tests (purchase, email, scan)
- [x] 08-04-PLAN.md — Edge case and offline tests

### Phase 9: VIP End-to-End Testing
**Goal**: Complete VIP reservation flow validated including guest passes
**Depends on**: Phases 1, 2, 3, 4, 7 (all VIP components hardened)
**Requirements**: Cross-cut validation of PAY-02, EMAIL-02, VIP-01, VIP-02, VIP-03, VIP-04, SCAN-01
**Success Criteria** (what must be TRUE):
  1. Test VIP booking completes: payment -> webhook -> reservation confirmed -> email with table details
  2. VIP floor plan shows table as booked immediately after confirmation
  3. VIP QR code scans successfully and marks reservation as checked-in
  4. Guest passes link correctly and scan independently at gate
  5. Multiple concurrent checkins for same reservation handled correctly
**Plans**: 7 plans

Plans:
- [x] 09-01-PLAN.md — Migration verification and seed data setup
- [x] 09-02-PLAN.md — Playwright: VIP checkout E2E test
- [x] 09-03-PLAN.md — Playwright: Floor plan realtime updates test
- [x] 09-04-PLAN.md — Manual UAT: VIP scanner flows (first entry, re-entry)
- [x] 09-05-PLAN.md — Manual UAT: GA ticket with VIP link re-entry
- [x] 09-06-PLAN.md — Concurrency test: Multiple simultaneous check-ins
- [x] 09-07-PLAN.md — Email delivery verification

### Phase 10: Load Testing & Performance
**Goal**: System handles production-level traffic without degradation
**Depends on**: Phases 8, 9 (end-to-end flows validated)
**Requirements**: Cross-cut validation supporting all requirements under load
**Success Criteria** (what must be TRUE):
  1. System handles 100 concurrent ticket purchases without errors
  2. Scanner handles 10 simultaneous scans at gate without lag
  3. Dashboard loads within 3 seconds under normal traffic
  4. Webhook processing handles burst of 50 events without timeouts
  5. Database queries complete within acceptable thresholds under peak load
**Plans**: 5 plans

Plans:
- [x] 10-01-PLAN.md — k6 setup, shared configuration, and helper utilities
- [x] 10-02-PLAN.md — Ticket purchase load test (100 concurrent VUs)
- [x] 10-03-PLAN.md — Scanner burst test (10 simultaneous scans)
- [x] 10-04-PLAN.md — Dashboard performance test (20 concurrent viewers)
- [x] 10-05-PLAN.md — Webhook burst test (50 events in 10 seconds)

### Phase 11: Error Handling & Recovery
**Goal**: System recovers gracefully from all failure scenarios
**Depends on**: Phase 10 (load testing may reveal edge cases)
**Requirements**: Cross-cut validation of PAY-04, EMAIL-03, SCAN-02, UX-02
**Success Criteria** (what must be TRUE):
  1. Stripe webhook failures retry automatically and eventually succeed
  2. Email delivery failures are logged and can be manually retried from dashboard
  3. Scanner shows clear error state when network is unavailable
  4. Payment failures don't leave orphaned records in database
  5. All error states show user-friendly recovery instructions
**Plans**: 4 plans

Plans:
- [x] 11-01-PLAN.md — Payment failure test suite (webhook retry, idempotency, orphan prevention)
- [x] 11-02-PLAN.md — Email failure test suite (retry, bounce handling, dashboard retry UI)
- [x] 11-03-PLAN.md — Scanner offline test suite (offline mode, queue sync, error messages)
- [x] 11-04-PLAN.md — Support runbook (symptom-based troubleshooting guide)

### Phase 12: Launch Readiness Review
**Goal**: Final validation that all systems are production-ready
**Depends on**: Phase 11 (all hardening and testing complete)
**Requirements**: Validation of all 28 v1 requirements
**Success Criteria** (what must be TRUE):
  1. All 28 v1 requirements pass manual verification checklist
  2. Production environment variables and secrets are configured correctly
  3. Backup and recovery procedures are documented and tested
  4. Support runbook exists for common issues (payment failures, email issues, scanner problems)
  5. Go/no-go decision made based on objective criteria
**Plans**: TBD

Plans:
- [ ] 12-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Payment Flow Hardening | 6/6 | Complete | 2026-01-29 |
| 2. Email Reliability | 6/6 | Complete | 2026-01-30 |
| 3. Scanner System Hardening | 5/5 | Complete | 2026-01-30 |
| 4. VIP System Reliability | 7/7 | Complete | 2026-01-30 |
| 5. Dashboard Accuracy | 5/5 | Complete | 2026-01-31 |
| 6. Infrastructure & Monitoring | 5/5 | Complete | 2026-01-31 |
| 7. UX Polish | 7/7 | Complete | 2026-01-31 |
| 8. GA End-to-End Testing | 4/4 | Complete | 2026-01-31 |
| 9. VIP End-to-End Testing | 7/7 | Complete | 2026-02-01 |
| 10. Load Testing & Performance | 5/5 | Complete | 2026-02-01 |
| 11. Error Handling & Recovery | 4/4 | Complete | 2026-02-01 |
| 12. Launch Readiness Review | 0/TBD | Not started | - |
