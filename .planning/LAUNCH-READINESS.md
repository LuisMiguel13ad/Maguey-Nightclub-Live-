# Launch Readiness Checklist

**Purpose:** Single source of truth for go/no-go launch decision. Maps all 28 v1 requirements to verification methods, evidence sources, and pass/fail status.

**Last Updated:** 2026-02-01

**Decision Threshold:** GO if weighted score >= 90% AND no critical failures

---

## Quick Reference

| Symptom | Requirement | Action |
|---------|-------------|--------|
| Payment not completing | PAY-01, PAY-02 | Check E2E test results, verify Stripe webhook logs |
| Duplicate tickets created | PAY-03 | Verify idempotency test suite |
| Unclear payment error | PAY-04 | Review error message UX tests |
| Email not received | EMAIL-01 | Check email queue status, run delivery test |
| Wrong QR in VIP email | EMAIL-02 | Verify VIP email test suite |
| No way to retry email | EMAIL-03 | Check dashboard email retry feature |
| Valid QR rejected | SCAN-01 | Run happy path scan test |
| Tampered QR accepted | SCAN-02 | Run invalid QR edge case test |
| Double entry allowed | SCAN-03 | Verify scan history tracking |
| Scanner fails offline | SCAN-04 | Run offline recovery tests |
| VIP status wrong | VIP-01 | Check state transition tests |
| Duplicate VIP check-ins | VIP-02 | Run concurrent check-in tests |
| Guest pass not linked | VIP-03 | Verify GA-VIP link tests |
| Floor plan stale | VIP-04 | Run realtime update tests |
| Revenue mismatch | DASH-01 | Run verify-revenue function |
| Ticket count wrong | DASH-02 | Check dashboard accuracy tests |
| Event sync slow | DASH-03 | Verify sync timing tests |
| VIP not appearing | DASH-04 | Check realtime subscription tests |
| Health check fails | INFRA-01 | Curl health endpoint |
| API abuse possible | INFRA-02 | Run rate limiting tests |
| Errors not tracked | INFRA-03 | Verify Sentry integration |
| Logs unstructured | INFRA-04 | Check structured logging |
| No loading indicator | UX-01 | Visual inspection of async operations |
| Technical error shown | UX-02 | Review error message tests |
| Scanner unusable mobile | UX-03 | Mobile device testing |
| Checkout too slow | UX-04 | Performance timing tests |

---

## Requirements Verification Matrix

### Payment Reliability (Critical - Weight: 25%)

| ID | Requirement | Verification Method | Evidence Type | Test/Source |
|----|-------------|---------------------|---------------|-------------|
| PAY-01 | GA ticket payment completes end-to-end | E2E test + Manual UAT | Automated + Manual | `e2e/specs/happy-path/purchase-flow.cy.ts` |
| PAY-02 | VIP table payment completes end-to-end | E2E test + Manual UAT | Automated + Manual | `maguey-pass-lounge/playwright/tests/vip-checkout.spec.ts` |
| PAY-03 | Webhook handles duplicates idempotently | Integration test | Automated | `maguey-pass-lounge/playwright/tests/webhook-idempotency.spec.ts` |
| PAY-04 | Payment failures show clear errors | E2E test | Automated | `e2e/specs/edge-cases/payment-failures.cy.ts` |

**Verification Status:**

- [ ] PAY-01: Run `npx cypress run --spec "e2e/specs/happy-path/purchase-flow.cy.ts"`
- [ ] PAY-02: Run `npx playwright test vip-checkout.spec.ts --project=chromium`
- [ ] PAY-03: Run `npx playwright test webhook-idempotency.spec.ts --project=chromium`
- [ ] PAY-04: Run `npx cypress run --spec "e2e/specs/edge-cases/payment-failures.cy.ts"`

---

### Email Delivery (Critical - Weight: 15%)

| ID | Requirement | Verification Method | Evidence Type | Test/Source |
|----|-------------|---------------------|---------------|-------------|
| EMAIL-01 | Ticket confirmation emails deliver reliably | E2E test + Delivery verification | Automated | `e2e/specs/happy-path/email-verification.cy.ts` |
| EMAIL-02 | VIP reservation emails include QR and table | E2E test | Automated | `maguey-pass-lounge/playwright/tests/vip-email-delivery.spec.ts` |
| EMAIL-03 | Failed sends logged and can be retried | Integration test | Automated | `maguey-pass-lounge/playwright/tests/email-retry.spec.ts` |

**Verification Status:**

- [ ] EMAIL-01: Run `npx cypress run --spec "e2e/specs/happy-path/email-verification.cy.ts"`
- [ ] EMAIL-02: Run `npx playwright test vip-email-delivery.spec.ts --project=chromium`
- [ ] EMAIL-03: Run `npx playwright test email-retry.spec.ts --project=chromium`

---

### Scanner Reliability (Critical - Weight: 20%)

| ID | Requirement | Verification Method | Evidence Type | Test/Source |
|----|-------------|---------------------|---------------|-------------|
| SCAN-01 | Valid QR codes accepted at gate | E2E test | Automated | `e2e/specs/happy-path/scan-flow.cy.ts` |
| SCAN-02 | Invalid/tampered QR rejected with feedback | E2E test | Automated | `e2e/specs/edge-cases/invalid-qr.cy.ts` |
| SCAN-03 | Already-scanned tickets show "already used" | E2E test | Automated | `e2e/specs/happy-path/scan-flow.cy.ts` (re-scan scenario) |
| SCAN-04 | Scanner works offline and syncs when online | E2E test | Automated | `e2e/specs/offline/offline-scan.cy.ts`, `e2e/specs/offline/offline-recovery.cy.ts` |

**Verification Status:**

- [ ] SCAN-01: Run `npx cypress run --spec "e2e/specs/happy-path/scan-flow.cy.ts"`
- [ ] SCAN-02: Run `npx cypress run --spec "e2e/specs/edge-cases/invalid-qr.cy.ts"`
- [ ] SCAN-03: Included in scan-flow.cy.ts
- [ ] SCAN-04: Run `npx cypress run --spec "e2e/specs/offline/*.cy.ts"`

---

### VIP System (High - Weight: 15%)

| ID | Requirement | Verification Method | Evidence Type | Test/Source |
|----|-------------|---------------------|---------------|-------------|
| VIP-01 | VIP status shows correct transitions | Database trigger test | Automated | `maguey-pass-lounge/playwright/tests/vip-checkout.spec.ts` |
| VIP-02 | Concurrent checkins don't cause race conditions | Load test + Integration | Automated | `maguey-pass-lounge/playwright/tests/vip-checkout.spec.ts`, `maguey-gate-scanner/load-tests/tests/concurrent-scans.js` |
| VIP-03 | VIP guest passes link to reservation | E2E test | Automated | GA-VIP link tests in scanner validation |
| VIP-04 | VIP floor plan reflects real-time availability | E2E test | Automated | `maguey-pass-lounge/playwright/tests/vip-floor-plan.spec.ts` |

**Verification Status:**

- [ ] VIP-01: Run `npx playwright test vip-checkout.spec.ts --project=chromium`
- [ ] VIP-02: Run `k6 run maguey-gate-scanner/load-tests/tests/concurrent-scans.js`
- [ ] VIP-03: Manual verification - VIP purchase includes GA ticket
- [ ] VIP-04: Run `npx playwright test vip-floor-plan.spec.ts --project=chromium`

---

### Dashboard Accuracy (High - Weight: 10%)

| ID | Requirement | Verification Method | Evidence Type | Test/Source |
|----|-------------|---------------------|---------------|-------------|
| DASH-01 | Revenue figures match Stripe transactions | Edge function verification | Automated | `maguey-pass-lounge/supabase/functions/verify-revenue/index.ts` |
| DASH-02 | Ticket counts match database records | Query verification | Automated | Dashboard component tests |
| DASH-03 | Event creation syncs within 30 seconds | Timing test | Automated | Real-time subscription tests |
| DASH-04 | VIP reservations appear in real-time | E2E test | Automated | `maguey-pass-lounge/playwright/tests/vip-floor-plan.spec.ts` |

**Verification Status:**

- [ ] DASH-01: Invoke `verify-revenue` edge function against production
- [ ] DASH-02: Compare dashboard counts with direct SQL query
- [ ] DASH-03: Create event, verify sync < 30s on purchase site
- [ ] DASH-04: Create VIP reservation, verify real-time dashboard update

---

### Infrastructure (Medium - Weight: 10%)

| ID | Requirement | Verification Method | Evidence Type | Test/Source |
|----|-------------|---------------------|---------------|-------------|
| INFRA-01 | Health check endpoints exist | HTTP request | Automated | `maguey-pass-lounge/supabase/functions/health-check/index.ts` |
| INFRA-02 | Rate limiting prevents API abuse | Integration test | Automated | `maguey-pass-lounge/supabase/functions/_shared/rate-limiter.ts` |
| INFRA-03 | Error tracking captures production issues | Sentry verification | Manual | `maguey-pass-lounge/supabase/functions/_shared/sentry.ts` |
| INFRA-04 | Logs are structured and searchable | Log inspection | Manual | `maguey-pass-lounge/supabase/functions/_shared/logger.ts` |

**Verification Status:**

- [x] INFRA-01: Health check endpoint verified (Phase 6)
- [x] INFRA-02: Rate limiting implemented and tested (Phase 6)
- [x] INFRA-03: Sentry integration complete (Phase 6)
- [x] INFRA-04: Structured logging implemented (Phase 6)

---

### UX Polish (Medium - Weight: 5%)

| ID | Requirement | Verification Method | Evidence Type | Test/Source |
|----|-------------|---------------------|---------------|-------------|
| UX-01 | Loading states show during async operations | Visual inspection | Manual | LoadingButton, Skeleton components |
| UX-02 | Error messages are user-friendly | Message review | Automated + Manual | Error handling tests |
| UX-03 | Mobile experience works for gate scanning | Device testing | Manual | Mobile device UAT |
| UX-04 | Checkout flow completes in under 60 seconds | Performance timing | Manual | Checkout flow timing |

**Verification Status:**

- [x] UX-01: Loading components implemented (Phase 7)
- [x] UX-02: User-friendly error messages (Phase 7)
- [x] UX-03: Mobile scanner UX integration (Phase 7)
- [x] UX-04: Checkout UX optimized (Phase 7)

---

## Go/No-Go Scorecard

### Category Weights

| Category | Weight | Max Points | Required for GO |
|----------|--------|------------|-----------------|
| Payment Reliability | 25% | 25 | No failures |
| Email Delivery | 15% | 15 | No failures |
| Scanner Reliability | 20% | 20 | No failures |
| VIP System | 15% | 15 | Max 1 non-critical |
| Dashboard Accuracy | 10% | 10 | Max 1 non-critical |
| Infrastructure | 10% | 10 | All pass |
| UX Polish | 5% | 5 | Max 1 non-critical |

### Scoring Rules

**Per-requirement scoring:**
- Pass: Full points (category weight / requirements in category)
- Partial: 50% points (non-critical issue documented)
- Fail: 0 points

**GO criteria:**
1. Weighted score >= 90%
2. No critical failures (Payment, Email, Scanner categories)
3. All INFRA requirements pass

**NO-GO criteria (any single):**
1. Any Payment, Email, or Scanner failure
2. Weighted score < 90%
3. Any INFRA failure

### Current Score

| Category | Pass | Partial | Fail | Score |
|----------|------|---------|------|-------|
| Payment Reliability | -/4 | -/4 | -/4 | -/25 |
| Email Delivery | -/3 | -/3 | -/3 | -/15 |
| Scanner Reliability | -/4 | -/4 | -/4 | -/20 |
| VIP System | -/4 | -/4 | -/4 | -/15 |
| Dashboard Accuracy | -/4 | -/4 | -/4 | -/10 |
| Infrastructure | 4/4 | 0/4 | 0/4 | 10/10 |
| UX Polish | 4/4 | 0/4 | 0/4 | 5/5 |

**Total:** -/100 (pending verification)
**Status:** PENDING VERIFICATION

---

## Verification Execution Log

### Pre-verification Checklist

- [ ] All test dependencies installed (`npm install`)
- [ ] Test database seeded with appropriate data
- [ ] Environment variables configured
- [ ] Stripe test mode enabled
- [ ] Resend test mode enabled

### Execution Record

| Date | Verifier | Category | Result | Notes |
|------|----------|----------|--------|-------|
| | | | | |

### Test Execution Commands

**Full E2E Suite:**
```bash
# Cypress E2E tests
cd /Users/luismiguel/Desktop/Maguey-Nightclub-Live
npx cypress run --config-file e2e/cypress.config.ts

# Playwright tests
cd maguey-pass-lounge
npx playwright test

# Load tests (requires k6)
k6 run load-tests/scenarios/ticket-purchase.js
k6 run load-tests/scenarios/scanner-burst.js
k6 run load-tests/scenarios/webhook-burst.js
k6 run load-tests/scenarios/dashboard-load.js
```

**Individual Category Tests:**
```bash
# Payment tests
npx cypress run --spec "e2e/specs/happy-path/purchase-flow.cy.ts"
npx playwright test vip-checkout.spec.ts
npx playwright test webhook-idempotency.spec.ts

# Email tests
npx cypress run --spec "e2e/specs/happy-path/email-verification.cy.ts"
npx playwright test vip-email-delivery.spec.ts
npx playwright test email-retry.spec.ts

# Scanner tests
npx cypress run --spec "e2e/specs/happy-path/scan-flow.cy.ts"
npx cypress run --spec "e2e/specs/edge-cases/invalid-qr.cy.ts"
npx cypress run --spec "e2e/specs/offline/*.cy.ts"

# VIP tests
npx playwright test vip-floor-plan.spec.ts
k6 run maguey-gate-scanner/load-tests/tests/concurrent-scans.js

# Infrastructure verification
curl -X GET https://[project-ref].supabase.co/functions/v1/health-check
```

---

## Exceptions and Known Issues

### Approved Exceptions

| ID | Issue | Reason | Approved By | Date |
|----|-------|--------|-------------|------|
| | | | | |

### Known Limitations

| ID | Limitation | Impact | Mitigation |
|----|------------|--------|------------|
| L-01 | Manual UAT deferred (09-04, 09-05) | VIP scanner flows not manually verified | Automated tests provide coverage |
| L-02 | Load tests require k6 installation | Can't run without k6 | Document k6 requirement |

### Post-Launch Monitoring

Items to watch closely after launch:

1. **Payment webhook processing time** - Alert if > 5s
2. **Email delivery rate** - Alert if < 95%
3. **Scanner offline queue size** - Alert if > 50 pending
4. **Revenue discrepancy alerts** - Review daily
5. **Sentry error rate** - Alert on spike

---

## Sign-off

### Technical Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| QA Lead | | | |

### Business Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Operations Lead | | | |

---

## Appendix: Test File Index

### Cypress E2E Tests (e2e/)

| File | Tests | Requirements |
|------|-------|--------------|
| `specs/smoke.cy.ts` | Smoke tests | General health |
| `specs/health-check.cy.ts` | Health endpoint | INFRA-01 |
| `specs/happy-path/purchase-flow.cy.ts` | GA purchase | PAY-01 |
| `specs/happy-path/email-verification.cy.ts` | Email delivery | EMAIL-01 |
| `specs/happy-path/scan-flow.cy.ts` | QR scanning | SCAN-01, SCAN-03 |
| `specs/edge-cases/payment-failures.cy.ts` | Payment errors | PAY-04 |
| `specs/edge-cases/invalid-qr.cy.ts` | Invalid QR | SCAN-02 |
| `specs/edge-cases/webhook-failures.cy.ts` | Webhook edge cases | PAY-03 |
| `specs/edge-cases/email-failures.cy.ts` | Email failures | EMAIL-03 |
| `specs/edge-cases/orphan-prevention.cy.ts` | Data integrity | PAY-01, PAY-02 |
| `specs/offline/offline-scan.cy.ts` | Offline scanning | SCAN-04 |
| `specs/offline/offline-recovery.cy.ts` | Offline sync | SCAN-04 |

### Playwright Tests (maguey-pass-lounge/playwright/tests/)

| File | Tests | Requirements |
|------|-------|--------------|
| `checkout.spec.ts` | Checkout flow | PAY-01 |
| `checkout-failures.spec.ts` | Payment failures | PAY-04 |
| `webhook-idempotency.spec.ts` | Duplicate handling | PAY-03 |
| `vip-checkout.spec.ts` | VIP purchase | PAY-02, VIP-01 |
| `vip-floor-plan.spec.ts` | Floor plan realtime | VIP-04, DASH-04 |
| `vip-email-delivery.spec.ts` | VIP emails | EMAIL-02 |
| `email-retry.spec.ts` | Email retry | EMAIL-03 |
| `scanner-offline.spec.ts` | Offline mode | SCAN-04 |
| `payment-recovery.spec.ts` | Payment recovery | PAY-04 |

### Load Tests (load-tests/)

| File | Tests | Requirements |
|------|-------|--------------|
| `scenarios/ticket-purchase.js` | Purchase load | PAY-01, PAY-02 |
| `scenarios/scanner-burst.js` | Scanner burst | SCAN-01, SCAN-02 |
| `scenarios/webhook-burst.js` | Webhook load | PAY-03 |
| `scenarios/dashboard-load.js` | Dashboard load | DASH-01, DASH-02 |

### Edge Function Tests

| File | Tests | Requirements |
|------|-------|--------------|
| `supabase/functions/process-email-queue/index.test.ts` | Queue processing | EMAIL-01 |
| `supabase/functions/resend-webhook/index.test.ts` | Webhook handling | EMAIL-01, EMAIL-03 |

---

*Document created: 2026-02-01*
*Reference: .planning/REQUIREMENTS.md*
