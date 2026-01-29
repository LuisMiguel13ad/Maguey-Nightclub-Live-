# Maguey Nightclub Live

## What This Is

A complete ticketing and event management platform for Maguey Nightclub. Customers can purchase general admission tickets or book VIP tables, receive QR codes via email, and get scanned at the door. The owner manages everything through a comprehensive dashboard — creating events, tracking sales, viewing analytics, and managing VIP reservations. Three interconnected apps work together: a marketing site, a ticket purchase site, and a gate scanner with admin dashboard.

## Core Value

Customers can buy tickets/VIP tables, receive QR codes, and get scanned at the door seamlessly — a complete end-to-end flow that rivals Ticketmaster and Eventbrite.

## Requirements

### Validated

<!-- Shipped and working — inferred from existing codebase -->

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

### Active

<!-- Current scope — launch readiness -->

- [ ] End-to-end payment flow reliability (GA + VIP)
- [ ] Email delivery reliability (retry mechanism for failed sends)
- [ ] Scanner QR verification hardening
- [ ] VIP state transition testing (race condition prevention)
- [ ] Dashboard-to-site data sync verification
- [ ] Health check endpoints for monitoring
- [ ] Rate limiting on public endpoints
- [ ] Launch checklist completion

### Out of Scope

<!-- Explicit boundaries -->

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

**Current State:**
- All core features built and tested in development
- Not yet live — preparing for production launch
- Comprehensive codebase mapping completed (`.planning/codebase/`)
- CONCERNS.md documents 15+ technical debt items and test gaps

**Known Issues:**
- No email retry if Resend fails (customer might not receive QR)
- Payment → ticket flow not E2E tested in production conditions
- VIP concurrent checkin race conditions possible
- Scanner QR verification paths not fully tested
- Large components (1000+ lines) need refactoring for maintainability

## Constraints

- **Tech Stack**: Must use existing stack (React, Supabase, Stripe) — significant investment already made
- **No Deletions**: Improve and update existing code only — do not remove working features
- **Timeline**: Launch ASAP — prioritize reliability over new features
- **Budget**: Minimize new service integrations — use existing Stripe, Supabase, Resend
- **Compatibility**: Support modern browsers, responsive for mobile scanning at gate

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Three separate apps vs monolith | Separation of concerns: public site, customer purchase, staff operations | — Pending |
| Supabase over custom backend | Rapid development, built-in auth, real-time, edge functions | — Pending |
| Stripe for all payments | Industry standard, handles compliance, trusted by customers | — Pending |
| QR codes with HMAC signatures | Secure validation without database lookup at gate | — Pending |
| Real-time dashboard updates | Owner needs live data during events | — Pending |

---
*Last updated: 2026-01-29 after project initialization*
