# Phase 3: Scanner System Hardening - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the gate scanner to reliably validate GA tickets and VIP reservations at the venue entrance. Scanner must work offline, handle concurrent scans, and provide clear feedback to gate staff. This phase focuses on the scanner app behavior, not new scanning capabilities.

</domain>

<decisions>
## Implementation Decisions

### Success Feedback
- Full green screen with large checkmark on successful scan
- Distinct audio tones: success beep vs failure buzz
- Haptic feedback: short vibration for success, longer for failure
- 1-2 second display, then auto-ready for next scan
- GA tickets: Minimal display (checkmark only) for maximum throughput
- VIP reservations: Full details (table name, tier, guest count, reservation holder name)
- VIP guest passes: Minimal display ('VIP Guest' + table number only)
- Show group check-in count on success ('3 of 5 guests checked in')
- Event check-in counter always visible at top ('Checked in: 234 / 500')

### Failure Feedback
- All red screen for any rejection type (no color-coding by reason)
- Very specific error messages with full details
- Already-used rejections show: scanned by [Staff], at [Gate], at [Time]
- Wrong-event tickets get distinct message: 'This ticket is for Saturday Feb 1st'
- No flagging system for suspicious scans - just reject and move on

### Scan History
- Visible list of last 5-10 recent scans
- Minimal row display: status icon, timestamp, ticket type (GA/VIP)
- Tap to expand and see full ticket details
- Color-coded rows: green background for success, red for failures

### Manual Entry
- Both options available: search by customer name OR enter ticket ID manually
- Use when QR scanner fails to read

### Screen Mode
- Standard mode always - no rapid scan mode
- Consistent interface regardless of gate traffic pace

### Offline Mode
- Prominent 'OFFLINE MODE' banner always visible when disconnected
- Cached validation: download ticket list automatically when event starts
- Validate tickets locally against cached data while offline
- New tickets not in cache: Accept with warning, flag for later verification when online

### Sync Behavior
- Auto-sync immediately when connection returns
- First scan wins for duplicate conflicts (keep earliest timestamp)
- Summary toast notification when sync completes ('Synced 47 check-ins')
- Viewable list of pending/unsynced check-ins while offline
- Auto-retry on sync failure (keep trying in background)
- 24-hour retention for unsynced offline data

### Dashboard Integration
- Owner dashboard shows real-time scanner online/offline status
- No distinction between offline and online check-ins once synced

### Claude's Discretion
- Exact animation timing and easing
- Sound frequency/tone selection
- Cache refresh strategy details
- Network detection implementation

</decisions>

<specifics>
## Specific Ideas

- GA scans optimized for speed (minimal info, quick dismiss)
- VIP scans prioritize information (table details matter for seating staff)
- History expandable on tap - staff can investigate without leaving scan screen
- Offline mode must be unmistakably obvious to prevent confusion

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 03-scanner-system-hardening*
*Context gathered: 2026-01-30*
