# Phase 7: UX Polish - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve user experience across all three apps — loading states, error messages, mobile scanner interface, and checkout flow speed. Goal is smooth feedback during all operations with the checkout flow completing in under 60 seconds.

</domain>

<decisions>
## Implementation Decisions

### Loading State Design
- Skeleton screens for content loading (not spinners)
- Match existing theme colors for skeleton placeholders
- Consistent feel across apps, flexible implementation per context
- Comprehensive coverage for ALL async operations equally

**Claude's Discretion:**
- Button loading patterns (spinner vs disabled + skeleton)
- Skeleton animation style (pulse vs shimmer vs static)
- Progress feedback for longer operations (step-by-step vs simple message)
- Timeout messaging ("taking longer than usual")

### Error Message Experience
- Professional/formal tone (e.g., "An error occurred. Please contact support if this persists.")
- Always include action buttons (every error has at least one recovery action)
- Display as toast notifications
- Errors persist until dismissed (no auto-dismiss)

### Mobile Scanner Interface
- Support both portrait and landscape with auto-rotate
- Haptic feedback with distinct patterns (quick buzz for success, longer for rejection)
- Full screen camera viewfinder with minimal UI overlay
- Auto-dismiss for success overlays (current 1.5s), tap required for rejections
- Audio feedback with distinct sounds for success/failure
- Full overlay when going offline — staff must acknowledge before continuing
- Swipe gestures for quick access (up for stats, down for event selector)
- Dark UI default optimized for nightclub environment
- Visible battery indicator in scanner UI

**Claude's Discretion:**
- Touch target sizes
- Screen timeout/sleep behavior

### Checkout Flow Speed
- Faster transitions are priority for perceived speed
- Breadcrumb trail progress indicator ("Tickets > Details > Payment")
- Form validation on submit only (not inline)
- Remember returning visitor info (name, email) in localStorage for prefill
- Fade in/out transitions between checkout steps

</decisions>

<specifics>
## Specific Ideas

- Scanner needs to work in dark nightclub environments — dark UI default
- Gate staff may wear gloves — touch targets should accommodate
- Offline mode must be clearly acknowledged before scanning continues
- Twitter-style "new posts" indicator pattern works well for content updates
- Checkout should feel instant — crossfade transitions, no waiting

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-ux-polish*
*Context gathered: 2026-01-31*
