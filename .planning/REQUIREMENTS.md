# Requirements: Maguey Nightclub Live

**Defined:** 2026-01-29
**Core Value:** Customers can buy tickets/VIP tables, receive QR codes, and get scanned at the door seamlessly

## v1 Requirements

Requirements for launch readiness. Each maps to roadmap phases.

### Payment Reliability

- [ ] **PAY-01**: GA ticket payment completes end-to-end (checkout → Stripe → webhook → ticket created)
- [ ] **PAY-02**: VIP table payment completes end-to-end (booking → Stripe → webhook → reservation confirmed)
- [ ] **PAY-03**: Webhook handles duplicate events idempotently (no duplicate tickets)
- [ ] **PAY-04**: Payment failures show clear error messages to customers

### Email Delivery

- [ ] **EMAIL-01**: Ticket confirmation emails deliver reliably (retry on failure)
- [ ] **EMAIL-02**: VIP reservation emails include correct QR codes and table details
- [ ] **EMAIL-03**: Failed email sends are logged and can be manually retried

### Scanner Reliability

- [ ] **SCAN-01**: Valid QR codes are accepted at gate
- [ ] **SCAN-02**: Invalid/tampered QR codes are rejected with clear feedback
- [ ] **SCAN-03**: Already-scanned tickets show "already used" status
- [ ] **SCAN-04**: Scanner works offline and syncs when back online

### VIP System

- [ ] **VIP-01**: VIP reservations show correct status (pending → confirmed → checked-in)
- [ ] **VIP-02**: Concurrent checkins don't cause race conditions
- [ ] **VIP-03**: VIP guest passes link correctly to main reservation
- [ ] **VIP-04**: VIP floor plan reflects real-time availability

### Dashboard Accuracy

- [ ] **DASH-01**: Revenue figures match actual Stripe transactions
- [ ] **DASH-02**: Ticket counts match database records
- [ ] **DASH-03**: Event creation syncs to purchase site within 30 seconds
- [ ] **DASH-04**: VIP reservations appear in real-time

### Infrastructure

- [ ] **INFRA-01**: Health check endpoints exist for monitoring
- [ ] **INFRA-02**: Rate limiting prevents API abuse
- [ ] **INFRA-03**: Error tracking captures production issues (Sentry)
- [ ] **INFRA-04**: Logs are structured and searchable

### UX Polish

- [ ] **UX-01**: Loading states show during async operations
- [ ] **UX-02**: Error messages are user-friendly (not technical)
- [ ] **UX-03**: Mobile experience works for gate scanning
- [ ] **UX-04**: Checkout flow completes in under 60 seconds

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Analytics

- **ANALYTICS-01**: Conversion funnel visualization (views → cart → purchase)
- **ANALYTICS-02**: Customer lifetime value tracking
- **ANALYTICS-03**: Peak hour predictions based on historical data
- **ANALYTICS-04**: Exportable reports (PDF/CSV)

### Enhanced Security

- **SEC-01**: Two-factor authentication for owner login
- **SEC-02**: IP-based access control for dashboard
- **SEC-03**: Audit log for all administrative actions
- **SEC-04**: Automated fraud detection scoring

### Marketing Features

- **MKT-01**: Promo code support for discounts
- **MKT-02**: Early access tickets for newsletter subscribers
- **MKT-03**: Social media sharing with OG images
- **MKT-04**: Referral tracking

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Mobile native apps | Web-first, responsive design sufficient for v1 |
| Real-time chat | Not core to ticketing flow |
| Ticket resale/transfer | Adds complexity, defer to future |
| Multiple venue support | Single venue (Maguey Delaware) for v1 |
| Advanced fraud ML | Basic fraud UI exists, ML deferred |
| Video streaming | Out of scope for ticketing platform |
| Third-party integrations | Focus on core flow first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAY-01 | TBD | Pending |
| PAY-02 | TBD | Pending |
| PAY-03 | TBD | Pending |
| PAY-04 | TBD | Pending |
| EMAIL-01 | TBD | Pending |
| EMAIL-02 | TBD | Pending |
| EMAIL-03 | TBD | Pending |
| SCAN-01 | TBD | Pending |
| SCAN-02 | TBD | Pending |
| SCAN-03 | TBD | Pending |
| SCAN-04 | TBD | Pending |
| VIP-01 | TBD | Pending |
| VIP-02 | TBD | Pending |
| VIP-03 | TBD | Pending |
| VIP-04 | TBD | Pending |
| DASH-01 | TBD | Pending |
| DASH-02 | TBD | Pending |
| DASH-03 | TBD | Pending |
| DASH-04 | TBD | Pending |
| INFRA-01 | TBD | Pending |
| INFRA-02 | TBD | Pending |
| INFRA-03 | TBD | Pending |
| INFRA-04 | TBD | Pending |
| UX-01 | TBD | Pending |
| UX-02 | TBD | Pending |
| UX-03 | TBD | Pending |
| UX-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 0
- Unmapped: 27 ⚠️

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 after initial definition*
