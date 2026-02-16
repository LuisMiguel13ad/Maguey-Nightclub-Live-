# Antigravity + NotebookLM Full Analysis Prompt

## Project Context

You are analyzing **Maguey Nightclub Live** — a production-ready nightclub ticketing and event management platform. It is a multi-app monorepo with 3 separate React/TypeScript apps sharing a single Supabase (PostgreSQL) database.

### Architecture Overview

```
maguey-nights/         → Marketing site (18 routes) — Port 3017
maguey-pass-lounge/    → Ticket purchase + VIP booking (32 routes) — Port 3016
maguey-gate-scanner/   → Admin, scanning, analytics (32 routes + 6 monitoring) — Port 3015
```

All 3 apps share:
- Supabase PostgreSQL database with Row Level Security
- 26 Edge Functions total: 14 in pass-lounge (payments, webhooks, email), 12 in gate-scanner (scanning, notifications, capacity)
- Stripe integration (Checkout Sessions for GA, Payment Intents for VIP)
- Resend for transactional email delivery
- Sentry for monitoring, Upstash Redis for rate limiting
- Deployed on Vercel (3 separate deployments)

### Tech Stack
- React 18 + TypeScript 5 + Vite 5
- Supabase (database, auth, edge functions)
- Stripe (payments)
- Resend (email)
- Vitest (unit), Cypress (E2E GA), Playwright (E2E VIP), k6 (load testing)

---

## Phase 1: Filesystem Scan (Antigravity Agents)

Launch 3 parallel agents, one per app. Each agent should:

### Agent 1 — maguey-nights (Marketing Site)
Scan every file in `maguey-nights/`. Report on:
- All 18 routes and what each page does
- How events are fetched and displayed
- How the marketing site links to the purchase site (cross-app navigation)
- SEO setup (meta tags, Open Graph, structured data)
- Responsive design / mobile experience
- Image optimization and loading strategy
- Any dead code, unused components, or orphaned routes
- **INVESTIGATE:** Why does the marketing site contain `/admin`, `/scanner`, and `/scanner/mobile` routes? These are admin/scanning features in a public-facing site. Assess whether this is intentional, legacy code, or a security/architectural concern.

### Agent 2 — maguey-pass-lounge (Purchase Platform)
Scan every file in `maguey-pass-lounge/`. Report on:
- All 32 routes and the user journey through them
- GA ticket purchase flow: event selection → checkout → Stripe payment → ticket delivery
- VIP booking flow: floor plan → table selection → guest info → payment → confirmation
- Authentication system: login, signup, 2FA, magic links, password reset
- All 14 Edge Functions in `supabase/functions/` — what each does, error handling
- All 49 database migrations in `supabase/migrations/` — schema evolution
- Stripe integration patterns (webhook handling, idempotency, error recovery)
- Email delivery system (queue-based, retry logic, Resend webhooks)
- QR code generation and HMAC-SHA256 signing
- Admin dashboard capabilities
- State management patterns
- Error handling and user-facing error messages

### Agent 3 — maguey-gate-scanner (Admin/Scanner Platform)
Scan every file in `maguey-gate-scanner/`. Report on:
- All 37 routes + 6 monitoring routes
- QR/NFC ticket scanning with signature verification
- Offline scanning mode and sync recovery
- Owner dashboard: revenue, attendance, analytics
- Event management: create, edit, publish, manage tiers
- VIP management: floor plan editor, reservation tracking, state transitions
- Team management: staff accounts, shift scheduling, device management
- Advanced analytics and fraud investigation
- Monitoring system: metrics, traces, errors, circuit breakers, rate limits
- Audit logging

---

## Phase 1.5: Shared Infrastructure Scan

Launch a 4th agent to scan the root-level directories that sit outside the 3 apps. These contain critical cross-app logic:

### Agent 4 — Shared Infrastructure
Scan these root-level directories and report on:

**`e2e/`** — Shared Cypress test infrastructure
- Test specs: happy path, edge cases, offline, payment failures, webhook failures
- Custom commands: auth, purchase, scan, database operations
- Cross-app test flows (purchase in pass-lounge → scan in gate-scanner)
- `cypress.config.ts` — base URLs, timeouts, environment variables

**`load-tests/`** — k6 load test scenarios
- `ticket-purchase.js` — 100 VU GA ticket flow
- `scanner-burst.js` — Scanner burst testing
- `dashboard-load.js` — Dashboard performance
- `webhook-burst.js` — Webhook idempotency (50 requests, 5 req/sec)
- Performance thresholds: p95 < 500ms global, p95 < 200ms scanner, p95 < 3s dashboard

**`scripts/`** — Utility scripts
- `debug/` — Inspection and verification utilities
- `seed/` — Test data seeding scripts
- `e2e/` — End-to-end test scripts

**`.github/workflows/`** — CI/CD pipeline
- `e2e.yml` — Cypress E2E with 4 parallel containers (currently disabled — needs GitHub Secrets)
- Build artifact sharing between jobs

**`.planning/`** — Project documentation (critical for NotebookLM source feeding)
- `PROJECT.md` — Requirements, constraints, key decisions
- `ROADMAP.md` — Phase-by-phase execution history
- `STATE.md` — 376+ architectural decisions, pending TODOs, session context
- `codebase/ARCHITECTURE.md` — System architecture patterns
- `codebase/STACK.md` — Technology stack details
- `codebase/STRUCTURE.md` — Directory layout and conventions

---

## Phase 2: Cross-App Integration Analysis

After filesystem scans complete, analyze how the 3 apps connect:
- How does a ticket purchased in pass-lounge get verified in gate-scanner?
- How does an event created in gate-scanner appear in nights and pass-lounge?
- What is the QR code signing secret flow between apps?
- How do Stripe webhooks propagate state changes across the system?
- Are there any data consistency risks between apps?

---

## Phase 3: NotebookLM Synthesis (via MCP)

Push all findings into NotebookLM and execute:

### 3a. Deep Research
```
Query: "Critique this nightclub ticketing platform architecture against industry best practices for multi-location event management and POS systems. Compare against Ticketmaster, Eventbrite, and DICE architectures. Identify gaps."
Mode: deep
```

### 3b. Mind Map
Create a mind map of the full system architecture showing:
- All 3 apps and their relationships
- Database tables and relationships
- Edge Functions and what triggers them
- External service integrations (Stripe, Resend, Sentry, Redis)
- User flows (GA purchase, VIP booking, scanning, admin)

### 3c. Data Table
Create a cross-reference table:
| Feature | Pass-Lounge | Gate-Scanner | Nights | Status |
|---------|------------|--------------|--------|--------|
(Map every feature to which app owns it, which apps consume it, and current status)

### 3d. Audio Overview
```
Format: deep_dive
Topic: "Complete architecture review of Maguey Nightclub's ticketing platform — what works, what's risky, and what's missing before scaling to multiple venues"
```

### 3e. NotebookLM Source Feeding (CRITICAL)

Before running any NotebookLM analysis, upload these project files as **sources** (ground truth). Without these, NotebookLM only sees your agent summaries — not the actual documentation.

**Upload these files as NotebookLM sources:**
1. `.planning/PROJECT.md` — Requirements, constraints, key decisions
2. `.planning/STATE.md` — 376+ architectural decisions and pending TODOs
3. `.planning/codebase/ARCHITECTURE.md` — System architecture patterns
4. `.planning/codebase/STACK.md` — Technology stack
5. `.planning/codebase/STRUCTURE.md` — Directory layout
6. `ARCHITECTURE_FOR_REVIEW.md` — Comprehensive architecture review (36KB)
7. `maguey-pass-lounge/vercel.json` — Security headers and deployment config
8. `maguey-gate-scanner/vercel.json` — Security headers and deployment config
9. `maguey-nights/vercel.json` — Security headers and deployment config
10. `e2e/cypress.config.ts` — E2E test configuration

**Configure NotebookLM custom prompt:**
```
"You are the Master Architect for Maguey Nightclub Live. Analyze all inputs strictly against the PROJECT.md requirements, STATE.md architectural decisions, and ARCHITECTURE.md patterns provided as sources. Flag any deviations between the documentation and the actual codebase findings."
```

### 3f. Decision Audit

Feed the 376+ architectural decisions from `.planning/STATE.md` into NotebookLM and run:
```
Query: "Review all 376+ architectural decisions in STATE.md. Identify any that are: (1) contradictory to each other, (2) outdated given the current codebase state, (3) risky for production, or (4) should be revisited before scaling to multiple venues."
Mode: deep
```

---

## Phase 3.5: Live Site Testing (Browser Agent)

**This is Antigravity's unique advantage — use it.** Launch browser agents to actually navigate each app, not just read the code.

### Browser Agent 1 — maguey-nights (Marketing Site)
Navigate to the live marketing site and:
- Load the homepage — measure actual page load time, check for layout shift
- Click through every navigation link — are there any broken links or 404s?
- Open an event page — does it display correctly? Does the "Buy Tickets" button link to pass-lounge?
- Test on mobile viewport (375px width) — is the responsive layout working?
- Run Lighthouse audit — capture Performance, Accessibility, Best Practices, and SEO scores
- Screenshot every page for the analysis report

### Browser Agent 2 — maguey-pass-lounge (Purchase Platform)
Navigate to the live purchase site and:
- Browse the events listing — do events load? Are images optimized?
- Click into an event — does the checkout page render correctly?
- Try the VIP tables page — does the floor plan SVG render? Are tables clickable?
- Test the authentication flow — can you reach login/signup pages?
- Run Lighthouse audit on the events page AND the checkout page
- Test on mobile viewport — ticket purchasing is primarily mobile for nightclub customers
- Screenshot the full purchase flow

### Browser Agent 3 — maguey-gate-scanner (Admin/Scanner)
Navigate to the live scanner/admin site and:
- Load the login page — does it render?
- After auth, navigate to the owner dashboard — does data load?
- Open the scanner page — does the QR scanner initialize?
- Check the event management page — can you see event listings?
- Run Lighthouse audit — **this is critical** because this app runs on staff phones at the door
- Test on mobile viewport (this is the primary device for scanning)
- Measure Time to Interactive — staff can't wait for a slow scanner during a rush

### Lighthouse Score Targets
| Metric | Nights | Pass-Lounge | Gate-Scanner |
|--------|--------|-------------|--------------|
| Performance | > 90 | > 80 | > 85 (mobile critical) |
| Accessibility | > 90 | > 90 | > 80 |
| Best Practices | > 90 | > 90 | > 90 |
| SEO | > 90 | > 70 | N/A (admin app) |

---

## Phase 4: Security & Performance Scan

Analyze specifically:
- Vercel security headers in each app's `vercel.json`
- Row Level Security policies — are there gaps?
- HMAC-SHA256 QR signing implementation — any weaknesses?
- Stripe webhook signature verification — is it bulletproof?
- Rate limiting configuration — adequate for production traffic?
- Content Security Policy — does it allow only what's needed?
- Environment variable handling — any secrets exposed client-side?
- Authentication flows — session management, token expiry, 2FA implementation
- Database migration safety — any destructive migrations without rollback?

---

## Phase 4.5: Missing Analysis Dimensions

These are commonly overlooked in code analysis — scan for all of them:

### Accessibility (WCAG 2.1 AA)
- Are all interactive elements keyboard-navigable?
- Do images have alt text? Do form inputs have labels?
- Is there sufficient color contrast for text and buttons?
- Can the ticket purchase and VIP booking flows be completed without a mouse?
- Is the scanner app accessible? (Staff may have varying abilities)

### Dependency Health
- Run `npm audit` in each app directory — flag any critical/high vulnerabilities
- Check for outdated major versions of critical packages (React, Vite, Supabase client, Stripe)
- Are there duplicate dependencies across the 3 apps that could be hoisted?

### Bundle Size Analysis
- What is the production bundle size for each app?
- **Critical: maguey-gate-scanner runs on mobile phones at the venue door.** Is the bundle size acceptable for mobile with potentially weak cellular signal?
- Is the monitoring system (metrics, traces, circuit breakers) inflating the scanner bundle?
- Are there large dependencies that could be lazy-loaded or tree-shaken?

### Code Duplication Across Apps
- Are there shared patterns (Supabase client setup, Stripe helpers, auth utilities) duplicated across 2-3 apps?
- Should there be a shared package/library?
- Are type definitions duplicated or divergent between apps?

### TypeScript Strictness
- How many `any` types exist across the codebase?
- Are there files with `@ts-ignore` or `@ts-expect-error`?
- Is `strict: true` enabled in all tsconfig.json files?

### Browser Compatibility
- Project constraint: "Support modern browsers, responsive for mobile scanning at gate"
- Are there APIs used that lack support in Safari/iOS? (Important — many nightclub guests use iPhones)
- Does the scanner app work on both Android and iOS mobile browsers?

### Legal & Compliance
The platform collects personal information (names, emails) and processes payments. Check:
- Is there a privacy policy page? Does it cover data collection, storage, and sharing?
- Is there a terms of service page? Does it cover ticket purchase terms, refund policy?
- Does the refund policy page exist and match the actual refund logic in the code?
- Is there cookie consent / banner? (Required in many jurisdictions)
- Can users request data deletion? Is there a mechanism for "right to be forgotten"?
- Is PCI DSS compliance handled? (Stripe handles most of this, but verify no raw card data touches your servers)
- Are there any data retention policies? How long are scan logs, orders, and personal data kept?
- Is there an age verification mechanism? (Nightclub = 21+ venue)

### Third-Party Service Limits
Check whether the current service tiers can handle production traffic on a busy night:
- **Stripe:** What plan tier? What are the API rate limits? Can it handle 500+ concurrent checkouts during a popular event on-sale?
- **Supabase:** What plan tier? Connection pool limits? Realtime subscription limits? Edge Function invocation limits?
- **Resend:** What plan tier? Daily sending limit? Can it handle sending 500+ ticket emails in a burst after a popular event goes on sale?
- **Upstash Redis:** What plan tier? Daily command limit? Will rate limiting itself get rate-limited under load?
- **Sentry:** What plan tier? Event quota? Could a production error storm exhaust the monthly quota in one night?
- **Vercel:** What plan tier? Serverless function limits? Bandwidth limits? Will traffic spikes trigger overages?

For each service: document the current plan, the limits, and whether they're adequate for a 500-person sold-out event night.

### Pending Operational TODOs
Review these 11 unconfigured items from STATE.md — are any critical blockers?
1. OWNER_EMAIL environment variable
2. RESEND_API_KEY environment variable
3. RESEND_WEBHOOK_SECRET environment variable
4. Resend webhook endpoint in Resend Dashboard
5. pg_cron job for process-email-queue
6. UPSTASH_REDIS_REST_URL environment variable
7. UPSTASH_REDIS_REST_TOKEN environment variable
8. SENTRY_DSN environment variable (edge functions)
9. VITE_SENTRY_DSN environment variable (frontends)
10. GitHub Secrets for E2E CI (7 secrets needed)
11. k6 installation for load testing

---

## Phase 5: Deliverables Checklist

Produce these outputs:
1. Per-app folder-by-folder scan report
2. Shared infrastructure scan report (e2e, load-tests, scripts, CI/CD, docs)
3. Cross-app integration map
4. Security audit findings
5. Performance concerns (including bundle sizes)
6. Accessibility audit findings
7. Dependency health report (vulnerabilities, outdated packages)
8. Code health metrics (any types, duplication, dead code)
9. **Lighthouse reports for all 3 apps** (Performance, Accessibility, Best Practices, SEO)
10. **Live site screenshots** (every key page, mobile + desktop)
11. **Legal & compliance assessment** (privacy, terms, PCI, age verification, data retention)
12. **Third-party service limits report** (Stripe, Supabase, Resend, Upstash, Sentry, Vercel)
13. NotebookLM mind map (architecture)
14. NotebookLM data table (feature matrix)
15. NotebookLM audio deep-dive
16. NotebookLM deep research (industry comparison)
17. NotebookLM decision audit (376+ decisions)
18. List of all issues, risks, and recommendations ranked by severity
19. Pending operational TODOs assessment
20. Summary of everything that would need to change before scaling to multiple venues

---

## Output Format (IMPORTANT — for Claude Code handoff)

Structure ALL findings in this exact format so they paste cleanly into Claude Code:

```markdown
## [CATEGORY]: [Finding Title]
**Severity:** critical | high | medium | low
**App(s):** maguey-nights | maguey-pass-lounge | maguey-gate-scanner | shared
**File(s):** [exact file path(s)]
**Finding:** [1-2 sentence description]
**Evidence:** [code snippet or specific observation]
**Recommendation:** [what should be done]
```

Group findings by category:
1. SECURITY
2. PERFORMANCE
3. RELIABILITY
4. ACCESSIBILITY
5. CODE HEALTH
6. DEPENDENCY
7. INTEGRATION
8. COMPLIANCE
9. SERVICE LIMITS
10. MISSING FEATURE
11. OPERATIONAL

This format allows Claude Code to validate each finding against the actual source code efficiently.
