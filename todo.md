# Maguey Nightclub Live — Feature Roadmap & Todo

## WAVE 1: Quick Wins — COMPLETE ✓
- [x] Apple Pay / Google Pay — Stripe Checkout Sessions + Dynamic Payment Methods
- [x] Clone Event Template — `handleCloneEvent()` in EventManagement.tsx
- [x] Age Verification at Purchase — Owner dropdown (None/18+/21+), checkout guard, DB migration
- [x] JSON-LD Structured Data — `json-ld.ts` utility, 4 schema builders, index.html enhanced

## WAVE 2: Core Competitive Features — COMPLETE ✓
- [x] Social Sharing — ShareButton.tsx (Web Share API + fallback), EventPage, EventDetail, OrderSuccess
- [x] Event Discovery (Search + Filter) — UpcomingEvents.tsx search + genre chips + date filter + URL params
- [x] Promoter Referral Tracking — `?ref=` capture, orders.referral_code, PromoterDashboard.tsx, owner analytics
- [x] Ticket Transfer — transfer-ticket Edge Function, ticket-transfer-service.ts, Account.tsx, scanner rejection

## WAVE 3: Premium Experience — COMPLETE ✓ (4/5 shipped, #10 deferred)
- [x] #13 — Automated Event Reminder Emails — `send-event-reminders` Edge Function, `event_reminder_log` table, Account.tsx opt-out toggle
- [x] #9  — Dynamic / Early-Bird Pricing — `ticket_type_price_tiers` table, tier UI in EventManagement.tsx, urgency counter in EventDetail.tsx, server-side price in checkout + webhook
- [x] #11 — Customer CRM / Lifetime Value — `customer_stats` VIEW, CustomerManagement.tsx (gate-scanner), SuccessOverlay "Welcome back" banner, Early Access email toggle
- [x] #12 — Embedded Checkout Widget — CheckoutDrawer.tsx (maguey-nights), embed mode in App.tsx (pass-lounge), EventPage.tsx wired up
- [ ] #10 — Apple Wallet + Google Wallet — DEFERRED (requires Apple Developer cert + Google Cloud account — client billing)
  - UI stubs in Ticket.tsx:161-179. When ready: build `add-to-wallet` Edge Function + replace stubs
  - Env secrets needed: GOOGLE_WALLET_SERVICE_ACCOUNT, GOOGLE_WALLET_ISSUER_ID, APPLE_PASS_TYPE_IDENTIFIER, APPLE_TEAM_IDENTIFIER, APPLE_PASS_CERTIFICATE

## WAVE 4: Future
- [ ] Email Marketing Campaigns — bulk send to past attendees, segment by event attended

## TECHNICAL DEBT — Must Close Before / Shortly After Launch
- [ ] Switch Stripe to production keys (`pk_test_*` → `pk_live_*` in Vercel + Supabase secrets)
- [ ] Configure GitHub Secrets for CI/CD (9 secrets: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_TEST_PK, STRIPE_TEST_SK, SCANNER_TEST_EMAIL, SCANNER_TEST_PASSWORD, OWNER_TEST_EMAIL, OWNER_TEST_PASSWORD)
- [ ] Add test coverage to `stripe-webhook/index.ts` (1,489 lines, zero tests — highest-risk code)
- [ ] Enable TypeScript strict mode in `maguey-pass-lounge` and `maguey-gate-scanner`
- [ ] Fix hardcoded data: `ticket_count` always 0, `ticket_type` always "General" on orders table

## VIP SECTION — Bug Fixes & Gaps
> Identified via full competitive analysis (Tixr, Ticket Fairy, Eventbrite) + backend audit (April 2026).
> Floor plan layout in `VIPFloorPlanAdmin.tsx` is intentional — DO NOT touch the grid/layout.

- [x] **[HIGH] Backfill `price_cents` for legacy DB rows** — Migration `20260401000000_backfill_price_cents.sql` applied: backfills NULL rows + enforces NOT NULL constraint going forward.
  — `maguey-pass-lounge/supabase/migrations/20260401000000_backfill_price_cents.sql`

- [x] **[HIGH] Remove client-price fallback in `create-vip-payment-intent`** — Returns hard error "Table price not configured. Contact venue." when `price_cents` is NULL. No client-supplied fallback.
  — `maguey-pass-lounge/supabase/functions/create-vip-payment-intent/index.ts:160`

- [x] **[MEDIUM] Decide canonical VIP admin UI** — Conflict warning added to `VIPTableManager.tsx`: "VIP table pricing is also managed from the Owner Dashboard (gate scanner app). Changes made here and from the dashboard are both saved directly — last save wins. Coordinate with your venue manager before editing prices."
  — `maguey-pass-lounge/src/pages/admin/VIPTableManager.tsx:431-437`

- [x] **[LOW] Add `is_active` filter to `getTablesForEvent()`** — `.eq('is_active', true)` added to both queries in the function. Admin behavior now consistent with purchase site.
  — `maguey-gate-scanner/src/lib/vip-tables-admin-service.ts:156,221`

- [x] **[LOW] Fix dead-code `bottles_included` in `VIPSetupManager`** — Save handler now uses `parseInt(String(formData.bottles_included)) || 1` from the actual form field.
  — `maguey-gate-scanner/src/components/vip/VIPSetupManager.tsx:332`

- [x] **[LOW] Label demo data clearly on floor plan** — Amber banner "DEMO — No tables configured for this event. Select an event or add tables to see real layout." shown when `tables.length === 0`. Grid/layout untouched.
  — `maguey-gate-scanner/src/components/vip/VIPFloorPlanAdmin.tsx:241-245`

## TICKET SCANNER — Bug Fixes & Improvements
> Identified via full competitive analysis (Ticketmaster SafeTix, AXS Mobile ID, TicketLeap) + full codebase & DB audit (April 2026).
> Scanner is production-ready (B+ / 87%). All items are post-launch polish.

- [x] **[MEDIUM] Fix hardcoded staff/gate names** — `ScanContext` interface added to simple-scanner.ts; `resolveStaffNames()` from staff-name-service.ts resolves actual staff name from auth UUID; `context?.deviceLabel` used as gate name; both online + offline scan paths updated.
  — `maguey-gate-scanner/src/lib/simple-scanner.ts:429-436`, `maguey-gate-scanner/src/pages/Scanner.tsx:492-495`

- [x] **[MEDIUM] Scanner Ticket-Type Filter Mode** — 3-button toggle (All / GA Only / VIP Only) in Scanner.tsx sidebar; filter check after successful scan rejects mismatched ticket type with red overlay; haptic + history logging on filter rejection.
  — `maguey-gate-scanner/src/pages/Scanner.tsx:154,556-601,968-983`, `maguey-gate-scanner/src/components/scanner/ScannerSettingsPanel.tsx:30-31,144-185`

- [x] **[MEDIUM] Persist scanner device ID in Dexie.js** — `deviceMeta` table added to Dexie schema v2 in offline-ticket-cache.ts; `getOrInitDeviceId()` reads from IndexedDB first, migrates from localStorage if present, keeps both in sync; Scanner.tsx initializes on mount via useEffect.
  — `maguey-gate-scanner/src/lib/offline-ticket-cache.ts:54-116`, `maguey-gate-scanner/src/pages/Scanner.tsx:177-179`

- [x] **[LOW] Fix VIP re-entry naming confusion** — `entryType?: 'first_entry' | 'reentry'` added to ScanResult interface; `rejectionReason` union no longer includes 'reentry'; VIP re-entry success path uses `entryType: 'reentry'`; Scanner.tsx updated to check `result.entryType === 'reentry'`; RejectionOverlay type cleaned up.
  — `maguey-gate-scanner/src/lib/simple-scanner.ts:23,407`, `maguey-gate-scanner/src/pages/Scanner.tsx:642`, `maguey-gate-scanner/src/components/scanner/RejectionOverlay.tsx:13-20`

- [x] **[LOW] Document scanner-service.ts** — File is NOT dead: used by batch-scan-service.ts (production) + integration tests. Clarifying doc comment added explaining role vs simple-scanner.ts and consolidation TODO.
  — `maguey-gate-scanner/src/lib/scanner-service.ts:1-8`

## PERMANENTLY SKIPPED
- ~~Ticket Add-Ons / Upsell~~ — not a priority for this venue type
- ~~Promoter Commission Automation~~ — owner knows promoters personally, manual math fine for 1 venue
- ~~Reserved GA Seating~~ — dance floor venue, no numbered GA seats; VIP tables cover premium
- ~~Mobile-Only Ticket Lock (SafeTix rotating barcode)~~ — complex, no clear ROI for 1 venue

## POST-LAUNCH CHECKLIST
- [ ] Rotate QR signing secret: `ALTER DATABASE postgres SET app.qr_signing_secret = 'NEW_SECRET'`
- [ ] Set `ALLOWED_ORIGINS` env var in Supabase Edge Functions to production domains
- [ ] Rotate Resend email API key (old key may have been exposed in early development)
- [ ] Verify all Vercel env vars set across 3 projects
- [ ] Verify Stripe webhook endpoint URL updated for production domain
