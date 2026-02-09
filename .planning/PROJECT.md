# Maguey Nightclub Live

## What This Is

A complete ticketing and event management platform for Maguey Nightclub. Customers can purchase general admission tickets or book VIP tables, receive QR codes via email, and get scanned at the door. The owner manages everything through a comprehensive dashboard — creating events, tracking sales, viewing analytics, and managing VIP reservations. Three interconnected apps work together: a marketing site, a ticket purchase site, and a gate scanner with admin dashboard. Production-hardened with 28 validated requirements across payment flows, email delivery, scanning, VIP management, and infrastructure.

## Core Value

Customers can buy tickets/VIP tables, receive QR codes, and get scanned at the door seamlessly — a complete end-to-end flow that rivals Ticketmaster and Eventbrite.

## Current State

**Shipped:** v1.0 Production Hardening (2026-02-09)
- 13 phases, 66 plans executed across 40 days
- 28/28 requirements verified, GO decision approved
- ~142K LOC TypeScript across 3 applications

**What's live:**
- Hardened payment flows with webhook idempotency and database constraints
- Queue-based email delivery with retry logic and Resend webhook integration
- Production-ready scanner with offline capability and VIP re-entry support
- Database-enforced VIP state transitions with real-time floor plan
- Infrastructure monitoring: health checks, rate limiting, Sentry, structured logging
- Full E2E test suites (Cypress + Playwright) and load test infrastructure (k6)

## Requirements

### Validated

- ✓ **Event Management** — Create, edit, publish events with multi-tier tickets — existing
- ✓ **GA Ticket Purchase** — Buy general admission tickets via Stripe checkout — existing
- ✓ **VIP Table Booking** — Reserve VIP tables with tier pricing (premium/front-row/standard) — existing
- ✓ **QR Code Generation** — Tickets include signed QR codes for gate entry — existing
- ✓ **Ticket Scanning** — QR and NFC scanning with signature verification — existing
- ✓ **Owner Dashboard** — Real-time revenue, ticket analytics, event management — existing
- ✓ **VIP Management** — Floor plan visualization, reservations, guest check-in — existing
- ✓ **Cross-Site Sync** — Events sync from dashboard to purchase and marketing sites — existing
- ✓ **Staff Management** — Team accounts, shift scheduling, device management — existing
- ✓ **Analytics** — Revenue trends, attendance patterns, ticket tier performance — existing
- ✓ **Newsletter System** — Email announcements to subscribers — existing
- ✓ **Marketing Site** — Public website showcasing nightclub and events — existing
- ✓ **End-to-end payment reliability** — GA + VIP payments with idempotency and error handling — v1.0
- ✓ **Email delivery reliability** — Queue-based retry mechanism with Resend webhook tracking — v1.0
- ✓ **Scanner QR verification hardening** — Consolidated base64 signatures, offline mode, re-entry — v1.0
- ✓ **VIP state transition enforcement** — Database triggers for forward-only transitions — v1.0
- ✓ **Dashboard data accuracy** — Revenue reconciliation with Stripe, real-time subscriptions — v1.0
- ✓ **Health check endpoints** — All critical services monitored — v1.0
- ✓ **Rate limiting** — Upstash Redis tiered limits on public endpoints — v1.0
- ✓ **Error tracking** — Sentry integration for frontends and edge functions — v1.0
- ✓ **Structured logging** — JSON logs with request ID correlation — v1.0
- ✓ **UX polish** — Loading states, error messages, mobile scanner enhancements — v1.0
- ✓ **GA E2E testing** — Cypress test suite for complete GA flow — v1.0
- ✓ **VIP E2E testing** — Playwright test suite for complete VIP flow — v1.0
- ✓ **Load testing** — k6 infrastructure for 100 concurrent VUs — v1.0
- ✓ **Error recovery** — Webhook retry, email retry, scanner offline queue — v1.0
- ✓ **Launch readiness** — 28/28 requirements verified, support runbook complete — v1.0
- ✓ **Code cleanup** — Consolidated QR signatures, removed deprecated VIP webhook — v1.0

### Active

(No active requirements — define next milestone with `/gsd:new-milestone`)

### Out of Scope

- Mobile native apps — Web-first, responsive design sufficient for v1
- Real-time chat/messaging — Not core to ticketing flow
- Ticket resale/transfer — Adds complexity, defer to future
- Multiple venue support — Single venue (Maguey Delaware) for v1
- Advanced fraud detection ML — Basic fraud investigation UI exists, ML deferred

## Context

**Technical Environment:**
- Three React + TypeScript + Vite applications in a monorepo
- Supabase PostgreSQL database with Edge Functions for backend logic
- Stripe for payment processing (GA checkout sessions, VIP payment intents)
- Resend for transactional emails (ticket delivery, confirmations)
- Real-time subscriptions via Supabase for live dashboard updates
- Upstash Redis for rate limiting
- Sentry for error tracking

**Codebase:**
- ~142,000 LOC TypeScript across 487 files
- Comprehensive codebase mapping at `.planning/codebase/`
- Test suites: Vitest (unit), Cypress (GA E2E), Playwright (VIP E2E), k6 (load)

**Remaining operational TODOs:**
- Configure production environment variables (see `.planning/milestones/v1.0-ROADMAP.md` for full list)
- Configure GitHub Secrets for E2E CI pipeline
- Set up pg_cron job for email queue processor
- Install k6 for load testing execution

## Constraints

- **Tech Stack**: Must use existing stack (React, Supabase, Stripe) — significant investment already made
- **No Deletions**: Improve and update existing code only — do not remove working features
- **Budget**: Minimize new service integrations — use existing Stripe, Supabase, Resend
- **Compatibility**: Support modern browsers, responsive for mobile scanning at gate

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Three separate apps vs monolith | Separation of concerns: public site, customer purchase, staff operations | ✓ Good — clean boundaries |
| Supabase over custom backend | Rapid development, built-in auth, real-time, edge functions | ✓ Good — enabled fast iteration |
| Stripe for all payments | Industry standard, handles compliance, trusted by customers | ✓ Good — reliable payment processing |
| QR codes with HMAC signatures | Secure validation without database lookup at gate | ✓ Good — base64 encoding consolidated |
| Real-time dashboard updates | Owner needs live data during events | ✓ Good — Supabase Realtime works well |
| Queue-based email delivery | Decouple email from webhook response time | ✓ Good — webhook stays under 5s |
| Fail-open rate limiting | Availability over strict limiting when Upstash unavailable | ✓ Good — no false rejections |
| jsdom + crypto.subtle polyfill | Enable Web Crypto API in Vitest test environment | ✓ Good — all tests pass |

---
*Last updated: 2026-02-09 after v1.0 milestone*
