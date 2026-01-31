# Phase 5: Dashboard Accuracy - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Owner dashboard displays accurate real-time data across all metrics — revenue, ticket counts, VIP reservations, and event sync. This phase ensures data accuracy and proper visualization of existing dashboard components. New dashboard features belong in other phases.

</domain>

<decisions>
## Implementation Decisions

### Revenue Display
- Show gross revenue (what customers paid), not net after fees
- Full breakdown: Event → ticket type → individual transactions
- All payments are final/completed — no pending payment states to track
- VIP revenue shows table price + any linked GA tickets from unified checkout combined
- USD formatting with cents ($X,XXX.XX)
- Both per-event detail AND time-based summaries (daily/weekly/monthly aggregates)
- No comparisons to previous events

### Real-time Behavior
- All dashboard data should update in real-time via Supabase subscriptions
- Always-visible live indicator (pulsing dot or "Live" badge) to show data is current
- Silent retry on connection drop — no user-facing warning unless extended outage
- Reconnect automatically without alerting user

### Data Discrepancies
- Show both data sources when mismatch detected: "DB: $5,000 vs Stripe: $5,100"
- Real-time reconciliation: check Stripe on each dashboard load
- Both database and Stripe must agree — flag any discrepancy between them
- Full audit trail: log all detected mismatches with timestamps and details
- Transparency over hiding discrepancies

### Analytics Charts
- Three primary visualizations:
  1. Sales over time (line chart showing ticket sales leading up to event)
  2. Revenue breakdown (pie/bar showing GA vs VIP split)
  3. Check-in rate (live progress bar of check-ins vs sold)
- Auto-scale time granularity based on date range selected (hourly for short ranges, daily for longer)
- Check-in progress: Simple display ("125 / 200 checked in" with progress bar)
- Events sorted: Upcoming events first, past events below

### Export Capability
- Both CSV and PDF export
- CSV for raw transaction data (spreadsheet-ready)
- PDF for reports and summaries

### VIP Table Section
- Existing VIP table section and floor plan view should be validated and polished
- Ensure all necessary components are present
- Remove anything unnecessary
- Already has 4-panel view from Phase 4 work

### Claude's Discretion
- Refund display approach (deducted from total vs shown separately)
- Acceptable delay from payment to dashboard update
- Quick stats overview section design
- Past events archiving strategy

</decisions>

<specifics>
## Specific Ideas

- Owner expects real-time feel — data should update as transactions happen
- Transparency is important: if numbers don't match Stripe, show both figures rather than hiding the discrepancy
- VIP section already exists and works — this phase is about accuracy validation and polish, not new features
- All sales are final (no pending states), so payment status complexity is minimal

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-dashboard-accuracy*
*Context gathered: 2026-01-30*
