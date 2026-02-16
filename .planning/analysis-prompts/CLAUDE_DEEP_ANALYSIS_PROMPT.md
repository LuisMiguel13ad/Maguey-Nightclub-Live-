# Claude Code Deep Analysis Prompt

Use this prompt when you bring the Antigravity + NotebookLM results back to Claude Code.

---

## The Prompt (copy everything below the line)

---

I just ran a full analysis of this project using Antigravity + NotebookLM. Here are their findings:

[PASTE THE ANTIGRAVITY/NOTEBOOKLM RESULTS HERE]

---

Now I need you to go deeper. Antigravity scanned the surface — I need you to find what it missed. Do the following:

### 1. Validate Their Findings
Read the actual source code for every issue they flagged. For each one, tell me:
- Is it a real problem or a false positive?
- If real, how severe is it? (critical / high / medium / low)
- What's the exact fix? (show me the code)

### 2. Trace Every Critical Path End-to-End
Actually follow the code execution for these flows. Read every file in the chain. Find where things can break:

**Flow A — GA Ticket Purchase:**
User selects event → adds tickets → Stripe checkout session created → payment succeeds → Stripe webhook fires → order + tickets created in DB → QR codes generated with HMAC signature → email queued → email sent via Resend → user receives ticket

**Flow B — VIP Table Booking:**
User selects event → views floor plan → picks table → enters guest info → Payment Intent created → payment confirmed → VIP reservation created → state transitions (pending → confirmed → checked_in) → VIP pass generated

**Flow C — Ticket Scanning:**
Scanner app loads → staff authenticates → scans QR code → signature verified against HMAC secret → ticket status checked → ticket marked as used → scan logged → re-entry handling

**Flow D — Event Lifecycle:**
Admin creates event in gate-scanner → event appears in pass-lounge and nights → tickets go on sale → event sells out (availability updates) → day of event (scanning begins) → post-event (analytics generated)

For each flow: what happens when step N fails? Is there recovery? Is data left in an inconsistent state?

### 3. Security Deep Dive
Don't just check configs — read the actual implementation:
- Find the HMAC signing code. Read it. Is the secret properly protected? Could it be brute-forced?
- Find every Stripe webhook handler. Does it verify signatures before processing? What about replay attacks?
- Find every Supabase query. Are any bypassing RLS? Are any using the service role key client-side?
- Find every environment variable usage. Are any VITE_ prefixed secrets that shouldn't be exposed?
- Check the auth implementation. How are sessions managed? What's the token refresh flow? Are there any privilege escalation paths?

### 4. Database Integrity
Read the migration files and check:
- Are there foreign key constraints on all relationships?
- Can an order exist without tickets? Can tickets exist without an order?
- What happens if the VIP state transition trigger fails mid-transaction?
- Are there any tables without proper indexes for the queries hitting them?
- Is the email queue properly handling concurrent workers?

### 5. What They Definitely Missed
Antigravity can see files but it can't reason about:
- Race conditions in concurrent ticket purchases (two people buying the last ticket)
- Webhook ordering issues (what if Stripe sends events out of order?)
- Offline scanner sync conflicts (two scanners scan the same ticket offline)
- Memory leaks in long-running scanner sessions
- Bundle size impact of the monitoring system on the scanner app (which runs on mobile devices)
- Whether the k6 load test thresholds actually match your expected production traffic

### 6. Production Readiness Gaps
Based on your deep analysis, give me a ranked list:
- **Must fix before launch** (data loss / security / payment issues)
- **Should fix before launch** (reliability / UX / edge cases)
- **Can fix after launch** (optimizations / nice-to-haves)

For every item, reference the exact file and line number.

### 7. Scaling Assessment
If I wanted to run this for 3 nightclub venues instead of 1:
- What in the current architecture breaks?
- What database changes are needed?
- Which Edge Functions need multi-tenant support?
- What's the estimated effort?

### 8. Dependency & Build Health
Run these commands and analyze the results:
- `npm audit` in each of the 3 app directories — flag critical/high vulnerabilities
- `npx vite-bundle-visualizer` or equivalent — what's the production bundle size for each app?
- **Critical check:** The gate-scanner app runs on staff mobile phones at the venue entrance, possibly on weak cellular signal. Is the bundle size acceptable? Is the monitoring system (metrics, traces, circuit breakers) bloating it?
- Are there outdated major versions of React, Vite, Supabase client, or Stripe SDK?
- Are there dependencies duplicated across apps that should be shared?

### 9. Accessibility Audit
Check the customer-facing flows specifically:
- Can the ticket purchase flow (events → checkout → payment → confirmation) be completed with keyboard only?
- Do all form inputs in the VIP booking flow have proper labels and ARIA attributes?
- Is there sufficient color contrast on the event cards, buttons, and ticket display?
- Does the scanner app work with screen readers? (Staff accessibility matters)
- Are error messages announced to screen readers via ARIA live regions?

### 10. Decision Log Validation
Read `.planning/STATE.md` — it contains 376+ architectural decisions made over 40 days across 13 phases. Audit them:
- Are any decisions **contradictory** to each other? (e.g., one says "fail-open" and another implies strict validation)
- Are any decisions **outdated** given later phases that changed the code?
- Are any decisions **risky for production** that weren't risky during development?
- Which decisions would **break if scaling to multiple venues**?
- Flag the top 10 decisions that most urgently need review.

### 11. Test Coverage Gaps
Map exactly which critical flows are NOT covered by automated tests:
- Plans 09-04 (Manual UAT: VIP scanner flows) and 09-05 (Manual UAT: GA+VIP link re-entry) were **deferred** — these flows have NO automated test coverage
- Which Edge Functions have tests vs. which only have "behavior specification" documentation tests?
- Are there any database triggers (like the VIP state transition trigger) with no test coverage?
- What percentage of the 90 routes have E2E test coverage?
- Which error recovery paths (webhook retry, email retry, offline sync) are tested vs. assumed working?

### 12. Code Health Metrics
Scan the entire codebase and report:
- **TypeScript `any` count:** How many `any` types across all files? List the worst offenders.
- **`@ts-ignore` / `@ts-expect-error` count:** Where are type safety escapes?
- **Code duplication:** Are there near-identical Supabase client setups, Stripe helpers, or auth utilities copied across 2-3 apps?
- **Console.log in production code:** How many `console.log` statements exist outside of test files?
- **Unused exports:** Are there exported functions/types that nothing imports?
- **Dead routes:** Are all 90 routes actually reachable from the UI, or are some orphaned?
- **TODO/FIXME/HACK comments:** List all of them with file locations.

### 13. Legal & Compliance Verification
Read the actual pages and code:
- Find the privacy policy page. Does it accurately describe what data is collected (names, emails, payment tokens)?
- Find the terms of service page. Does it cover ticket purchase terms and match the refund logic in the code?
- Find the refund policy page. Does the stated policy match what `cancel-event-with-refunds` Edge Function actually does?
- Is there any cookie consent mechanism? Check for tracking scripts, analytics, or third-party cookies.
- Can a user delete their account and data? Search for any data deletion endpoints or UI.
- Verify Stripe integration never stores raw card data — search for any PAN, CVV, or card number handling in your code.
- Is there any age verification? This is a 21+ nightclub — check if the purchase flow or entry flow validates age.
- Check data retention: how long are `scan_logs`, `orders`, `tickets`, and `email_queue` records kept? Is there any cleanup?

### 14. Third-Party Service Capacity
Check the actual service configurations and calculate whether they can handle a sold-out 500-person event night:
- **Stripe:** Search for any rate limiting headers or retry logic. Calculate: if 500 tickets sell in 10 minutes, that's ~50 checkout sessions + 50 webhooks per minute. Can Stripe handle it on your plan?
- **Supabase:** Read the Supabase client config. What's the connection pool size? How many realtime subscriptions can run simultaneously? (Owner dashboard + scanner + checkout all subscribe at once during events)
- **Resend:** Read the email queue processor. What's the batch size? If 500 tickets sell, that's 500 emails to queue and send. At the current batch rate (10/minute from STATE.md decisions), that's 50 minutes to deliver all tickets. Is that acceptable?
- **Upstash Redis:** Read the rate limiting implementation. What happens if Redis itself hits its daily command limit? (The code uses fail-open, but verify)
- **Vercel:** Check `vercel.json` for function configuration. Are there memory limits, duration limits, or concurrency limits that could bottleneck during peak traffic?

For each service, answer: **will it survive a sold-out Saturday night?**

---

Be specific. Reference exact files and line numbers. Show me code for every fix you recommend. Don't be polite — be thorough.
