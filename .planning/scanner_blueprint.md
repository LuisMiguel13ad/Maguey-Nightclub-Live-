# Maguey Nightclub — Scanner Blueprint

> A comprehensive spec for what door staff see when scanning tickets at `staff.magueynightclub.com/scanner`, organized by **pages, widgets, data flows, and components**. Each section is annotated with current implementation status.

---

## Design Principles

Six rules govern every screen an employee sees while scanning at the door.

| # | Principle | Rule |
|---|-----------|------|
| 1 | **Sub-500ms feedback** | From QR capture to full-screen green/red overlay must be under 500ms. Every millisecond matters when the crowd is 200 deep. Async operations (fraud detection, audit logging) must never block the scan response. |
| 2 | **Binary visual outcome** | Full-screen GREEN = let them in. Full-screen RED = stop. No ambiguous cards, no partial states, no "maybe." The overlay must be visible from 10 feet away, in a dark venue with strobe lights and loud music. |
| 3 | **Offline-first resilience** | WiFi drops every time 300 phones join the same AP at 11 PM. The scanner must continue working with cached tickets, queue scans for sync, and make the offline state visually unmistakable (orange banner + acknowledgment). |
| 4 | **Zero navigation during scanning** | Door staff should never leave the scanner screen during an active shift. Event selection, mode switching (QR/NFC/manual), and scan history must be accessible without page navigation. Every tap away from the camera is a lost second. |
| 5 | **VIP differentiation** | VIP guests pay 10-50x a GA ticket. The scanner must instantly communicate VIP status with distinct audio (tier-specific tones), haptic (triple pulse), and visual feedback (table assignment overlay) so the host can greet them properly. |
| 6 | **Fail-safe, not fail-open** | Unknown tickets offline are rejected (not accepted). Unsigned QR codes from camera scans are rejected. Override mode requires a 4-digit PIN, is time-limited (5-60 min), and is fully audited. Security before convenience. |

---

## Employee Navigation

### Current State

Employees have 4 operational routes, accessed via a left-side Sheet (hamburger menu) inside Scanner.tsx:

```
/auth/employee        EmployeeLogin.tsx       Login page (public)
/scanner              Scanner.tsx             Main QR/NFC/Manual scanning
/guest-list           GuestListCheckIn.tsx    Guest list rapid check-in
/scan/vip             VipScannerPage.tsx      VIP guest pass scanning
/scan/vip/:eventId    VipScannerPage.tsx      VIP scanning for specific event
```

**Sidebar items (Sheet inside Scanner.tsx):**
```
Scanner       /scanner          (Camera icon)
Guest List    /guest-list       (ListChecks icon)
Settings      /crew/settings    (Settings icon)
Sign Out                        (bottom, destructive)
```

**Bottom navigation bar (always visible on Scanner.tsx):**
```
Manual        (Keyboard icon, left)
QR Camera     (Camera icon, elevated center)
NFC           (Radio icon, right — only if VITE_ENABLE_NFC=true)
```

### Target State (Minimal Changes)

The navigation is correct for employee operations. The 4 pages cover all door scenarios. The sidebar is minimal and appropriate. The bottom nav provides instant scan mode switching without leaving the page.

**One gap to fix:** The `/crew/settings` route is gated to `owner/promoter` roles in `App.tsx` (line 90), but the employee sidebar links to it. Employees clicking "Settings" see the Unauthorized page.

**Recommended fix:** Either create a lightweight employee settings page at `/scanner/settings` (device name, sound preferences, dark/light mode) or change the route guard to allow employee access with limited settings.

**One navigation gap:** Guest List and VIP Scanner pages have no persistent "Back to Scanner" button. Staff must use the browser back button.

---

## Page-by-Page Breakdown

### 1. Employee Login — `/auth/employee`

**File:** `maguey-gate-scanner/src/pages/auth/EmployeeLogin.tsx`

**Purpose:** Authenticate door staff with email/password before granting scanner access. Separate from owner login (`/auth/owner`).

| Widget | What It Shows | Status |
|--------|--------------|--------|
| **Email input** | Employee email with "Remember me" checkbox (stores in localStorage) | ✅ Built |
| **Password input** | Password field with show/hide toggle | ✅ Built |
| **Submit button** | "Sign In" with loading spinner | ✅ Built |
| **Error display** | Login failure message (invalid credentials, network error) | ✅ Built |
| **Role redirect** | After login: employee → `/scanner`, owner/promoter → `/dashboard` | ✅ Built |
| **ProtectedRoute wrapper** | Auth check on all scanner routes, redirect to `/auth` if unauthenticated | ✅ Built |
| **Auth.tsx redirector** | Generic `/auth` route auto-redirects to `/auth/employee` by default | ✅ Built |

**Priority Notes:**
- P0 RESOLVED: Demo buttons removed. Separate `/auth/employee` and `/auth/owner` login pages exist.
- P0 RESOLVED: `ProtectedRoute` component wraps all employee routes with auth check.
- REMAINING: The generic `/auth` page still exists as a landing page. Consider redirecting `/auth` to `/auth/employee` by default for staff devices.

---

### 2. Main Scanner — `/scanner`

The primary door scanning interface. Full-screen camera feed with overlays. This is where 95% of employee time is spent.

**File:** `maguey-gate-scanner/src/pages/Scanner.tsx` (1,133 lines)

#### Top Bar Widgets

| Widget | What It Shows | Status |
|--------|--------------|--------|
| **Menu button** | Hamburger icon, opens left sidebar Sheet (Scanner / Guest List / Settings / Sign Out) | ✅ Built |
| **Event Selector** | Center dropdown: event name + date, "TONIGHT" green badge on date-matched events, auto-selects tonight's event on mount | ✅ Built |
| **Device ID** | Top-right, last 6 chars of scanner device ID, tap to copy full ID to clipboard | ✅ Built |
| **Battery Indicator** | Top-right, percentage + icon (Low/Medium/Full/Charging), Battery API events, hidden if API unavailable | ✅ Built (`BatteryIndicator.tsx`) |
| **Sync Button** | Top-right, Cloud/WifiOff icon, yellow badge with pending scan count, tap to manually sync, spin animation while syncing | ✅ Built |

#### Main Scanning Area

| Widget | What It Shows | Status |
|--------|--------------|--------|
| **QR Camera Feed** | Full-screen back-camera video, html5-qrcode at 10 FPS, 280px neon-cornered viewfinder, animated scanning line | ✅ Built (`QrScanner.tsx`) |
| **Manual Entry** | Full-screen keyboard input, "MAGUEY-XXXX" placeholder, rate-limited 5/min per device, disabled while processing | ✅ Built (inline) |
| **NFC Scanner** | Full-screen NFC waiting state with ripple animation, Web NFC API, auto-retry on error | ✅ Built (`NFCScanner.tsx`, behind `VITE_ENABLE_NFC` flag) |

#### Overlays (Full-Screen, z-100)

| Widget | What It Shows | Status |
|--------|--------------|--------|
| **Success Overlay (GA)** | Green background, 132px bouncing checkmark, guest name, 1.5s auto-dismiss, `playSuccess()` + `hapticSuccess()` (50ms vibrate) | ✅ Built (`SuccessOverlay.tsx`) |
| **Success Overlay (VIP via SuccessOverlay)** | Green background, table name + tier + holder + guest count, `playTierSuccess('vip')` + `hapticVIP()` (triple pulse) | ✅ Built (`SuccessOverlay.tsx` with VIP props) |
| **VIP Guest Pass Overlay** | Green background, tier-colored badge (gold/blue/purple), table + floor section, guest X of Y, party progress bar, 2s auto-dismiss, `playTierSuccess('vip')` + triple-pulse haptic, "Scan Next" dismiss button | ✅ Built (`VipSuccessOverlay.tsx`) |
| **Re-entry Overlay (GA)** | Same as GA success + gold "RE-ENTRY GRANTED" banner at top, last entry timestamp, `hapticReentry()` (double pulse) | ✅ Built (`SuccessOverlay.tsx` with `isReentry` prop) |
| **Re-entry Overlay (VIP Guest Pass)** | Same as VIP Guest Pass overlay + gold "RE-ENTRY GRANTED" banner at top, last entry timestamp | ✅ Built (`VipSuccessOverlay.tsx` with `isReentry` prop) |
| **Rejection Overlay** | Red background, 132px X icon, reason-specific title/subtitle (7 reasons), previous scan details, "Scan Next" manual dismiss button, `playError()` + `hapticRejection()` (200-100-200ms pattern) | ✅ Built (`RejectionOverlay.tsx`) |

#### Rejection Reasons (7 types)

| Reason | Title | Subtitle Example |
|--------|-------|-----------------|
| `already_used` | "Already Scanned" | "Scanned by [staff] at [gate] at [time]" |
| `wrong_event` | "Wrong Event" | "This ticket is for [event] on [date]" |
| `invalid` | "Invalid Ticket" | "This ticket could not be validated" |
| `expired` | "Expired Ticket" | "This ticket has expired" |
| `tampered` | "Security Alert" | "QR code signature verification failed" |
| `not_found` | "Not Found" | "No ticket matching this code exists" |
| `offline_unknown` | "Unknown (Offline)" | "Ticket not in offline cache" |

#### Status Indicators

| Widget | What It Shows | Status |
|--------|--------------|--------|
| **Offline Banner** | Fixed top (z-70), orange pulsing "OFFLINE MODE" + WifiOff icon, pending sync count badge | ✅ Built (`OfflineBanner.tsx`) |
| **Offline Acknowledge Modal** | Full-screen orange (z-200), requires "I Understand - Continue Scanning" tap before offline scanning proceeds | ✅ Built (`OfflineAcknowledgeModal.tsx`) |
| **Check-in Counter** | Fixed bar: "Checked in: X / Y" with real-time Supabase subscription, falls back to IndexedDB cache offline | ✅ Built (`CheckInCounter.tsx`) |
| **Scan History** | Bottom area (z-40), last 5 scans, color-coded green/red rows, expandable with guest name/event/error, only visible when scanner is idle | ✅ Built (`ScanHistory.tsx`) |

#### Bottom Navigation

| Widget | What It Shows | Status |
|--------|--------------|--------|
| **Mode Switcher** | 3 buttons: Manual (Keyboard) / QR Camera (elevated center, Camera) / NFC (Radio), instant mode switching with cleanup | ✅ Built (inline) |

#### Background Services

| Widget | What It Shows | Status |
|--------|--------------|--------|
| **Wake Lock** | Keeps screen on while in QR or NFC mode via Screen Wake Lock API, re-acquires on tab visibility change | ✅ Built (`useWakeLock` hook) |
| **Heartbeat** | Sends scanner status to `scanner_heartbeats` table every 30s (event, scans today, pending, online status) | ✅ Built (`scanner-status-service.ts`) |
| **Audio Feedback** | Web Audio API singleton: success tone, VIP tier tone, error tone — separate frequencies per outcome | ✅ Built (`audio-feedback-service.ts`) |
| **Haptic Feedback** | `navigator.vibrate()` patterns: success (50ms), VIP (triple pulse), re-entry (double pulse), rejection (200-100-200ms) | ✅ Built (`audio-feedback-service.ts`) |
| **Fraud Detection** | 6 async checks after each scan (non-blocking): duplicate IP, rapid velocity, geographic impossibility, device mismatch, VPN, multi-ticket rapid | ✅ Built (`fraud-detection-service.ts`) |

#### Built but NOT Wired

| Widget | What It Does | Why It Should Be Wired |
|--------|-------------|----------------------|
| **LowBatteryModal** | Battery warning at 20/10/5% with recommendations and "Don't show again" option | Phone dying mid-shift with 300 people in line is a disaster. Component exists at `components/scanner/LowBatteryModal.tsx` — needs trigger in Scanner.tsx |
| **OverrideActivationModal** | Emergency override with 4-digit PIN, duration selector (5-60 min), predefined reasons, fully audited | When a VIP host says "let them in" and the system says no, staff needs a way to override. Component at `components/scanner/OverrideActivationModal.tsx` |
| **BatchQueue** | Party ticket queue management: group detection, party size badge, approve batch, remove individual | Groups of 4-6 arriving together currently scanned one-by-one. Component at `components/scanner/BatchQueue.tsx` |
| **ShiftStatus** | Clock in/out toggle, current shift stats (scans today, duration, avg rate), upcoming shifts | Employee time tracking exists but isn't accessible from Scanner. Component at `components/dashboard/ShiftStatus.tsx` |
| **IDVerificationModal** | Age/ID verification: ID type selector, number input, photo capture option | Age verification for 21+ events. Full flow at `components/scanner/IDVerificationModal.tsx` |
| **RiskIndicatorBadge** | Fraud risk score badge on scanned tickets | Fraud detection runs but results aren't displayed to scanner operator. Component at `components/scanner/RiskIndicatorBadge.tsx` |
| **ScanErrorDisplay** | Error card with recovery suggestions and retry/report actions | Better error UX than current toast messages. Component at `components/scanner/ScanErrorDisplay.tsx` |

**Priority Notes:**
- P1: Event auto-detection uses exact date match (`toISOString().split('T')[0]`). A Friday night event at 10 PM that runs past midnight stops auto-detecting at 12:00 AM Saturday. Should use a 6 PM–5 AM night window.
- P1: `debugGetSampleTickets()` call runs on every mount in production. Should be gated behind `import.meta.env.DEV`.
- P1: Unsigned QR codes from manual entry are accepted (by design — staff typing a ticket ID should not need a signature). QR camera + NFC scans do require valid HMAC signatures.

---

### 3. Guest List Check-In — `/guest-list`

Rapid name-based check-in for guest-listed attendees. Optimized for speed — designed to process 800 guests quickly via search-and-tap flow.

**File:** `maguey-gate-scanner/src/pages/GuestListCheckIn.tsx` (336 lines)

| Widget | What It Shows | Status |
|--------|--------------|--------|
| **Event Selector** | Dropdown, auto-selects first upcoming active event | ✅ Built |
| **Stats Row (4 cards)** | Total Guests, Checked In (green), Pending (yellow), Plus Ones — refreshes every 5s via realtime | ✅ Built |
| **Search Input** | Auto-focused, triggers search on 1+ chars, debounced | ✅ Built (`GuestSearchInput.tsx`) |
| **Search Results** | Matching guests with name, plus-one count, status, check-in button | ✅ Built (`GuestSearchResults.tsx`) |
| **Plus-One Confirmation** | After tapping guest: confirm plus-one count before check-in | ✅ Built |
| **Recent Check-Ins** | Right sidebar (1/3 width on desktop), shows recent check-ins for this event by this scanner | ✅ Built (`RecentGuestCheckIns.tsx`) |
| **CSV Export** | Export button, downloads guest list as CSV | ✅ Built |
| **Rapid Flow** | After check-in: clears search, refocuses input, invalidates React Query cache for instant update | ✅ Built |
| **Empty State** | "Ready to check in guests" placeholder with Users icon | ✅ Built |
| **Back to Scanner** | Persistent header button to return to `/scanner` | ❌ Not Built |
| **Offline Support** | Continue guest list check-in when WiFi drops | ❌ Not Built |

**Data Flow:**
1. Type guest name → React Query search with debounce
2. Results show guest name, plus-one count, status
3. Tap guest → confirm plus-one count → `checkInGuest()` via `guest-list-service.ts`
4. Toast confirmation → search cleared → input refocused → next guest

**Data Sources:**
- `guest_list_entries` table (status, plus_ones, guest name)
- `guest_lists` table (event_id)
- `guest-list-service.ts` (searchGuests, checkInGuest, getGuestListStats, exportGuestListToCSV)

**Priority Notes:**
- No offline support for guest list check-in. Requires network connection. This is a gap if WiFi drops during guest list processing. Should show a clear "requires network" message rather than failing silently.
- No back-to-scanner navigation — staff must use browser back button or type URL.
- Uses a different visual style from Scanner.tsx (light card-based layout vs dark full-screen). Acceptable because guest list check-in is a fundamentally different workflow (name lookup vs scan).

---

### 4. VIP Scanner — `/scan/vip` and `/scan/vip/:eventId`

> **UPDATE (Feb 2026):** The main scanner at `/scanner` now handles VIP guest passes natively. When a VIP QR code is scanned on the main scanner, it detects `meta.reservationId`, routes to the VIP lookup path, and shows a dedicated `VipSuccessOverlay` with tier badge, table info, guest progress bar, and re-entry banner. The standalone VIP scanner below remains as an optional advanced view but is no longer required for normal door operations.

Dedicated VIP guest pass scanning with tier-colored result cards and re-entry tracking.

**File:** `maguey-gate-scanner/src/pages/VipScannerPage.tsx` (277 lines)

| Widget | What It Shows | Status |
|--------|--------------|--------|
| **Header** | Sticky top bar: Crown icon, "VIP Scanner" title, Back button to `/scanner` | ✅ Built |
| **Event Selector** | Top-right dropdown, auto-selects from URL param or first published event | ✅ Built |
| **VIPScanner Component** | QR camera, signature verification, reservation status check, guest number tracking | ✅ Built (`VIPScanner.tsx`) |
| **Offline Banner** | Orange alert when offline, shows pending VIP scan count | ✅ Built (inside VIPScanner) |
| **Pending Sync Banner** | Blue alert when online with queued scans, "Sync Now" button | ✅ Built (inside VIPScanner) |
| **VipTableGuestResult** | Result card with tier coloring (Premium=gold, Standard=blue, Regular=purple), table name, guest number, re-entry banner | ✅ Built (`VipTableGuestResult.tsx`) |
| **Audio/Haptic** | Same feedback service as main scanner | ✅ Built |
| **Full-Screen Success/Rejection Overlays** | Binary green/red overlays matching main scanner | ❌ Not Built (uses card-based results instead) |

**VIP Scan Flow:**
1. QR scanned → parse JSON payload (token, signature, meta.reservationId, meta.guestNumber)
2. If offline → queue via `vip-offline-queue-service.ts`, show "queued" success
3. If signature present → verify via `verifyPassSignature()` Edge Function
4. Lookup guest pass by QR token → check pass status
5. Verify reservation status (confirmed/checked_in/completed = valid)
6. Check event match if eventId provided
7. Process check-in via `processVipScanWithReentry()` (handles re-entry)
8. Display `VipTableGuestResult` with tier colors and guest count

**Data Sources:**
- `vip_guest_passes` table (QR token, status, guest number)
- `vip_reservations` table (table info, tier, holder, status)
- `event_vip_tables` table (table name, tier)
- Separate offline queue: `vip-offline-queue-service.ts` (own Dexie database)

**Priority Notes:**
- VIP scanner uses card-based results (`VipTableGuestResult`) instead of full-screen overlays. In a dark, loud venue, VIP scan results are less visible than GA results. VIP feedback should be MORE visible, not less. Add `SuccessOverlay`/`RejectionOverlay` to the VIP flow.
- The VIP scanner uses a separate offline queue database from the main scanner. Two Dexie databases with independent sync cycles.
- The "Back" button correctly navigates to `/scanner`.

---

## Complete Scan Flow

```
                           ┌─ SCAN INPUT ──────────────────────┐
                           │                                    │
                    QR Camera          Manual Entry        NFC Tag
                   (10 FPS)            (typed ID)        (Web NFC)
                       │                    │                 │
                       └────────┬───────────┘─────────────────┘
                                │
                                ▼
                ┌─ DEBOUNCE / RATE LIMIT ───────────┐
                │  QR: 2.5s cooldown (same code)    │
                │  Manual: 5 per minute per device  │
                │  NFC: immediate (unique per tag)  │
                └──────────────┬────────────────────┘
                               │
                               ▼
                ┌─ parseQrInput() ──────────────────┐
                │  JSON? → extract token + sig + meta│
                │  Plain text? → use as ticket ID    │
                └───────┬──────────────┬────────────┘
                        │              │
                  Has Signature    No Signature
                        │              │
                        ▼              ▼
             ┌─ verifySignature() ┐  QR/NFC scan?
             │ Edge Function call │  → REJECT "tampered"
             │ (server-side HMAC) │  Manual entry?
             └───┬──────┬────────┘  → ALLOW (no sig needed)
              Valid   Invalid               │
                │       │                   │
                │       ▼                   │
                │    REJECT                 │
                │   "tampered"              │
                │                           │
                ▼                           ▼
         ┌─ VIP DETECTION ────────────────────────┐
         │ meta.reservationId present?             │
         │  YES → processVipPassScan() (VIP path)  │
         │    Success → VIP SUCCESS OVERLAY         │
         │    Fail → fall through to GA path        │
         │  NO → continue to GA path                │
         └──────────────┬─────────────────────────┘
                        │
                ┌───────────────────────────┐
                │    ONLINE or OFFLINE?     │
                └───────┬──────────┬────────┘
                     Online     Offline
                        │           │
                        ▼           ▼
                   findTicket()  validateOffline()
                   (Supabase)    (IndexedDB cache)
                        │           │
                   ┌────┴────┐ ┌────┴─────┐
                 Found  Not   In      Not in
                   │   Found  Cache    Cache
                   │     │     │        │
                   │     ▼     │        ▼
                   │  VIP      │   Has meta.
                   │ FALLBACK  │   reservationId?
                   │ (try VIP  │   YES → queue VIP
                   │  lookup)  │   NO → REJECT
                   │     │     │   "offline_unknown"
                   │  ┌──┴──┐  │
                   │ VIP  Not  │
                   │ found VIP │
                   │  │    │   │
                   │  ▼    ▼   │
                   │ VIP  REJECT│
                   │ OVERLAY "not│
                   │       found"│
                   │           │
                   ▼           ▼
                ┌─ DUPLICATE CHECK ─────────────┐
                │ is_used=true OR status=scanned │
                └───────┬──────────┬─────────────┘
                      Used       Fresh
                        │           │
                        ▼           │
              ┌─ VIP RE-ENTRY? ─┐   │
              │ checkVipLinked  │   │
              │ TicketReentry() │   │
              └──┬─────────┬───┘   │
             VIP-linked  Not VIP   │
                 │           │     │
                 ▼           ▼     │
              RE-ENTRY    REJECT   │
              SUCCESS    "already  │
              (gold       _used"   │
              banner)              │
                 │                 │
                 │                 ▼
                 │      ┌─ MARK AS SCANNED ──────┐
                 │      │ UPDATE tickets:         │
                 │      │  is_used = true          │
                 │      │  status = 'scanned'      │
                 │      │  scanned_at = now()       │
                 │      └──────────┬──────────────┘
                 │                 │
                 └────────┬────────┘
                          │
                          ▼
               ┌─ POST-SCAN (async, non-blocking) ─┐
               │ logScan() → scan_logs INSERT       │
               │ logFailedScan() (if rejected)      │
               │ fraud detection (6 checks)         │
               │ event publish (TicketScanned)       │
               └──────────┬────────────────────────┘
                          │
                          ▼
               ┌─ RESULT OVERLAY ──────────────────┐
               │                                    │
               │  SUCCESS:           REJECTION:     │
               │  Green full-screen  Red full-screen│
               │  Checkmark bounce   X icon         │
               │  Guest name         Reason title   │
               │  VIP table info     Details        │
               │  1.5s auto-dismiss  Manual dismiss │
               │  playSuccess()      playError()    │
               │  hapticSuccess()    hapticReject()  │
               └──────────┬────────────────────────┘
                          │
                          ▼
               ┌─ CLEANUP ─────────────────────────┐
               │ Add to scan history (localStorage) │
               │ Increment scansToday counter       │
               │ Reset to idle state                │
               │ Heartbeat update (30s interval)    │
               └────────────────────────────────────┘
```

**Performance:**

| Operation | Latency | Blocking |
|-----------|---------|----------|
| QR parsing | <50ms | Yes |
| Signature verify (Edge Function) | 100-200ms | Yes |
| Ticket lookup (Supabase) | 50-150ms | Yes |
| Status update (Supabase) | 50-100ms | Yes |
| Scan log insert | 50-100ms | No (async) |
| Fraud detection (6 checks) | 200-500ms | No (async) |
| **Total blocking time** | **250-500ms** | — |

---

## Offline Architecture

### Cache Layer (`offline-ticket-cache.ts`, 582 lines)

```
┌─────────────────────────────────────────────────┐
│              Dexie.js (IndexedDB)                │
│                                                  │
│  cachedTickets:                                  │
│    ticketId (PK), eventId, qrToken,              │
│    qrSignature, status (valid|scanned),          │
│    guestName, ticketType, scannedAt,             │
│    scannedBy, syncedAt                           │
│                                                  │
│  cacheMetadata:                                  │
│    eventId (PK), eventName, lastSyncAt,          │
│    ticketCount, totalCapacity, scannedCount      │
│                                                  │
│  offlineScans:                                   │
│    id (auto PK), ticketId, qrToken,              │
│    scannedAt, scannedBy, deviceId,               │
│    syncStatus (pending|synced|conflict|failed),  │
│    conflictResolution { winner, time, device }   │
└─────────────────────────────────────────────────┘
```

### Queue Layer (`offline-queue-service.ts`, 374 lines)

```
┌─────────────────────────────────────────────────┐
│         OfflineQueueDatabase (Dexie.js)          │
│                                                  │
│  queuedScans:                                    │
│    id (auto PK), ticketId, qrToken,              │
│    scannedBy, scannedAt, deviceId,               │
│    syncStatus (pending|syncing|synced|failed),   │
│    retryCount (0-10), errorMessage,              │
│    lastRetryAt, scanMetadata { eventId, type }   │
└─────────────────────────────────────────────────┘
```

### Cache Freshness

| Event | Action |
|-------|--------|
| Event selected | `ensureCacheIsFresh(eventId)` called |
| Cache age > 5 minutes | Full re-download from Supabase |
| Cache age ≤ 5 minutes | Skip refresh (fresh) |
| Online → Offline | Cache already populated, continue scanning |
| Offline → Online | `syncPendingScans()` auto-syncs every 5s |

### Sync Strategy

| Parameter | Value |
|-----------|-------|
| Auto-sync interval | 5 seconds (when online) |
| Batch size | 5 parallel syncs |
| Batch delay | 100ms between batches |
| Retry backoff | Exponential: 1s → 2s → 4s → 8s → 16s → 32s → 60s max |
| Max retries | 10 |
| Cleanup | Synced scans older than 7 days auto-deleted |
| Conflict resolution | First-scan-wins (timestamp comparison via `sync_offline_scan` RPC) |

### Offline Decision Matrix

| Scenario | Behavior | Reason |
|----------|----------|--------|
| Ticket in cache, status=valid | ACCEPT, mark scanned locally, queue for sync | Normal offline scan |
| Ticket in cache, status=scanned | REJECT "already_used" | Duplicate prevention |
| Ticket NOT in cache | REJECT "offline_unknown" | Security: unknown tickets rejected |
| Wrong event in cache | REJECT "wrong_event" | Event filtering enforced |
| QR signature invalid vs cache | REJECT "tampered" | Cached signature comparison |
| Network returns mid-scan | Continue offline flow, sync later | No mid-scan switching |

### VIP Offline Queue (separate)

The VIP scanner has its own offline queue (`vip-offline-queue-service.ts`) with a separate Dexie database. Follows the same pattern: queue → auto-sync at 5s → exponential backoff. Stores VIP-specific data (reservation ID, guest number, signature).

---

## Component Inventory

### Scan Input Components (5)

| Component | File | Purpose | Used By | Status |
|-----------|------|---------|---------|--------|
| `QrScanner` | `components/scanner/QrScanner.tsx` | html5-qrcode camera, 10 FPS, back camera, 280px neon viewfinder | Scanner.tsx, VIPScanner.tsx | ✅ Active |
| `ScannerInput` | `components/scanner/ScannerInput.tsx` | USB barcode scanner / keyboard buffer capture | Not used in Scanner.tsx | ✅ Built, not wired |
| `NFCScanner` | `components/scanner/NFCScanner.tsx` | Web NFC API reader with auto-retry | Scanner.tsx (behind feature flag) | ✅ Active |
| `ManualEntry` | `components/scanner/ManualEntry.tsx` | 4-tab lookup: ticket ID, name, email, phone | Not used (Scanner has simpler inline version) | ✅ Built, not wired |
| `GuestSearchInput` | `components/vip/GuestSearchInput.tsx` | Debounced text search for guest names | GuestListCheckIn.tsx | ✅ Active |

### Result Overlay Components (3)

| Component | File | Purpose | Used By | Status |
|-----------|------|---------|---------|--------|
| `SuccessOverlay` | `components/scanner/SuccessOverlay.tsx` | Full-screen green, 132px checkmark bounce, GA/VIP-linked/re-entry variants, 1.5s auto-dismiss | Scanner.tsx | ✅ Active |
| `VipSuccessOverlay` | `components/scanner/VipSuccessOverlay.tsx` | Full-screen green, tier badge (gold/blue/purple), table + floor section, guest X of Y, party progress bar, 2s auto-dismiss | Scanner.tsx (unified scanner) | ✅ Active |
| `RejectionOverlay` | `components/scanner/RejectionOverlay.tsx` | Full-screen red, 132px X icon, 7 rejection reasons, manual dismiss required | Scanner.tsx | ✅ Active |

### Result Card Components (2)

| Component | File | Purpose | Used By | Status |
|-----------|------|---------|---------|--------|
| `TicketResult` | `components/scanner/TicketResult.tsx` (467 lines) | Expandable ticket details: tier coloring, scan history, photo gallery, override display, risk indicators | Not used in Scanner.tsx | ✅ Built, not wired |
| `VipTableGuestResult` | `components/vip/VipTableGuestResult.tsx` (316 lines) | VIP result card: tier colors (gold/blue/purple), table details, guest number, re-entry banner | VIPScanner.tsx | ✅ Active |

### Status Indicator Components (5)

| Component | File | Purpose | Used By | Status |
|-----------|------|---------|---------|--------|
| `CheckInCounter` | `components/scanner/CheckInCounter.tsx` | "Checked in: X / Y" with Supabase realtime, offline IndexedDB fallback | Scanner.tsx | ✅ Active |
| `BatteryIndicator` | `components/scanner/BatteryIndicator.tsx` | Battery % + icon, 30s refresh, Battery API events | Scanner.tsx | ✅ Active |
| `OfflineBanner` | `components/scanner/OfflineBanner.tsx` | Orange pulsing "OFFLINE MODE" + pending count | Scanner.tsx | ✅ Active |
| `SyncStatusIndicator` | `components/dashboard/SyncStatusIndicator.tsx` | Detailed sync status with progress bar | Not used in Scanner.tsx | ✅ Built, not wired |
| `ShiftStatus` | `components/dashboard/ShiftStatus.tsx` | Clock in/out, scan stats, upcoming shifts | Not used in Scanner.tsx | ✅ Built, not wired |

### Modal Components (7)

| Component | File | Purpose | Used By | Status |
|-----------|------|---------|---------|--------|
| `OfflineAcknowledgeModal` | `components/scanner/OfflineAcknowledgeModal.tsx` | Full-screen orange, "I Understand" tap required before offline scanning | Scanner.tsx | ✅ Active |
| `LowBatteryModal` | `components/scanner/LowBatteryModal.tsx` | Battery warning at 20/10/5%, recommendations, "Don't show again" | Not triggered in Scanner.tsx | ✅ Built, not wired |
| `OverrideActivationModal` | `components/scanner/OverrideActivationModal.tsx` | Emergency override: 4-digit PIN, duration (5-60 min), predefined reasons, audited | Not triggered in Scanner.tsx | ✅ Built, not wired |
| `OverrideReasonModal` | `components/scanner/OverrideReasonModal.tsx` | Override reason selection from predefined list | Not triggered | ✅ Built, not wired |
| `IDVerificationModal` | `components/scanner/IDVerificationModal.tsx` | Age/ID verification: type selector, number input, photo option | Not triggered | ✅ Built, not wired |
| `PhotoCaptureModal` | `components/scanner/PhotoCaptureModal.tsx` | Camera photo capture for ID verification | Not triggered | ✅ Built, not wired |
| `PhotoComparison` | `components/scanner/PhotoComparison.tsx` | Side-by-side ID photo comparison | Not triggered | ✅ Built, not wired |

### History & Display Components (4)

| Component | File | Purpose | Used By | Status |
|-----------|------|---------|---------|--------|
| `ScanHistory` | `components/scanner/ScanHistory.tsx` | Last 5 scans, color-coded, expandable rows | Scanner.tsx | ✅ Active |
| `GuestSearchResults` | `components/vip/GuestSearchResults.tsx` | Guest list search results with check-in action | GuestListCheckIn.tsx | ✅ Active |
| `GuestCheckInCard` | `components/vip/GuestCheckInCard.tsx` | Individual VIP guest check-in card | VIP flows | ✅ Active |
| `RecentGuestCheckIns` | `components/dashboard/RecentGuestCheckIns.tsx` | Recent check-in list for sidebar | GuestListCheckIn.tsx | ✅ Active |

### Group Processing (1)

| Component | File | Purpose | Used By | Status |
|-----------|------|---------|---------|--------|
| `BatchQueue` | `components/scanner/BatchQueue.tsx` (268 lines) | Party ticket queue: group detection, party size badge, approve/reject batch | Not triggered in Scanner.tsx | ✅ Built, not wired |

### Error Handling (2)

| Component | File | Purpose | Used By | Status |
|-----------|------|---------|---------|--------|
| `ScanErrorDisplay` | `components/scanner/ScanErrorDisplay.tsx` | Error card with recovery suggestions, retry/report actions | Not used in Scanner.tsx | ✅ Built, not wired |
| `ErrorBoundary` | `components/shared/ErrorBoundary.tsx` | React error boundary wrapping entire app | App.tsx | ✅ Active |

### Unused/Alternative Components (3)

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| `FullScreenScanner` | `components/scanner/FullScreenScanner.tsx` | Alternative full-screen scanner layout | Built, not used |
| `ScanResultOverlay` | `components/scanner/ScanResultOverlay.tsx` | Combined result overlay (older version) | Built, not used |
| `ScannerSettingsPanel` | `components/scanner/ScannerSettingsPanel.tsx` | Scanner configuration panel | Built, not used |

---

## Service Layer

### Core Scan Services

| Service | File | Lines | Purpose | Used By |
|---------|------|-------|---------|---------|
| `simple-scanner.ts` | `lib/simple-scanner.ts` | ~900 | Unified scan logic: parseQrInput (with meta), findTicket, scanTicket (GA + VIP detection + VIP fallback), processVipPassScan, scanTicketOffline (VIP offline queue), logScan, logFailedScan, getActiveEvents | **Scanner.tsx** (active) |
| `scanner-service.ts` | `lib/scanner-service.ts` | 1,867 | Extended: tracing, fraud, re-entry modes, pagination, event publishing, audit logging | Not used by Scanner.tsx |

### Offline Services

| Service | File | Lines | Purpose |
|---------|------|-------|---------|
| `offline-ticket-cache.ts` | `lib/offline-ticket-cache.ts` | 582 | Dexie.js cache: sync, validate, mark scanned, conflict resolution, freshness check |
| `offline-queue-service.ts` | `lib/offline-queue-service.ts` | 374 | Scan queue: queue, sync (batch 5), exponential backoff, auto-sync 5s |
| `vip-offline-queue-service.ts` | `lib/vip-offline-queue-service.ts` | ~300 | VIP scan queue: separate Dexie DB, same sync pattern |

### Support Services

| Service | File | Lines | Purpose |
|---------|------|-------|---------|
| `audio-feedback-service.ts` | `lib/audio-feedback-service.ts` | ~200 | Web Audio API tones + Navigator.vibrate patterns |
| `battery-monitoring-service.ts` | `lib/battery-monitoring-service.ts` | ~100 | Battery API wrapper, getDeviceInfo |
| `scanner-status-service.ts` | `lib/scanner-status-service.ts` | 114 | Heartbeat upsert every 30s to scanner_heartbeats |
| `fraud-detection-service.ts` | `lib/fraud-detection-service.ts` | 620 | 6 fraud checks: duplicate IP, rapid velocity, geographic impossibility, device mismatch, VPN, multi-ticket |
| `emergency-override-service.ts` | `lib/emergency-override-service.ts` | ~200 | PIN-based override: activate, verify, deactivate, audit |
| `rate-limiter.ts` | `lib/rate-limiter.ts` | ~100 | Manual entry rate limiting (5/min per device) |
| `guest-list-service.ts` | `lib/guest-list-service.ts` | ~300 | Guest search, check-in, stats, CSV export |

### Fraud Detection — 6 Checks

| Check | Severity | Score Range | Detection Method |
|-------|----------|-------------|------------------|
| `duplicate_ip_scans` | HIGH | 40-80 | Same ticket from multiple IPs in 30 min |
| `rapid_scan_velocity` | HIGH | 30-70 | >2 scans/min from same device in 5 min |
| `geographic_impossibility` | CRITICAL | 90 | >100km apart in <60 min (Haversine formula) |
| `device_fingerprint_mismatch` | MEDIUM | 35 | Same ticket from multiple devices in 30 min |
| `vpn_detected` | LOW | 15 | VPN/proxy detected from IP metadata |
| `multiple_tickets_rapid_scan` | MEDIUM | 25 | 3+ different tickets from same device in 5 min |

Risk 80+ = alert staff (non-blocking). Risk 90+ = block scan.

### Database Tables Touched

| Table | Operations | Service |
|-------|-----------|---------|
| `tickets` | SELECT (find), UPDATE (mark scanned) | simple-scanner.ts |
| `scan_logs` | INSERT (log result) | simple-scanner.ts |
| `events` | SELECT (active events list) | simple-scanner.ts |
| `vip_linked_tickets` | SELECT (VIP link check) | Scanner.tsx |
| `vip_guest_passes` | SELECT (QR token lookup), UPDATE (check-in) | simple-scanner.ts (unified scanner) |
| `vip_reservations` | SELECT (reservation details + status check) | simple-scanner.ts (unified scanner) |
| `scanner_heartbeats` | UPSERT (heartbeat every 30s) | scanner-status-service.ts |
| `vip_guest_passes` | SELECT (lookup), UPDATE (check-in) | vip-admin-service.ts |
| `vip_reservations` | SELECT (reservation details) | vip-admin-service.ts |
| `guest_list_entries` | SELECT (search), UPDATE (check-in) | guest-list-service.ts |
| `scan_metadata` | INSERT (fraud detection context) | fraud-detection-service.ts |
| `emergency_override_logs` | INSERT (override audit) | emergency-override-service.ts |

---

## Summary: Sections at a Glance

### Launch-Critical (must work perfectly on Day 1)

| Feature | Component(s) | Status | Notes |
|---------|-------------|--------|-------|
| QR scan → success/reject overlay | Scanner.tsx + QrScanner + SuccessOverlay + RejectionOverlay | ✅ Complete | Sub-500ms on modern phones |
| HMAC signature verification | simple-scanner.ts → verify-qr-signature Edge Function | ✅ Complete | Server-side only, fail-closed |
| Ticket lookup (4-field search) | simple-scanner.ts `findTicket()` | ✅ Complete | id, ticket_id, qr_code_data, qr_token |
| Duplicate scan detection | simple-scanner.ts (is_used + status check) | ✅ Complete | Checks both fields |
| VIP re-entry | simple-scanner.ts + `check_vip_linked_ticket_reentry` RPC | ✅ Complete | Gold "RE-ENTRY GRANTED" banner |
| Check-in counter (real-time) | CheckInCounter.tsx | ✅ Complete | Supabase realtime + IndexedDB fallback |
| Event auto-select (tonight) | Scanner.tsx useEffect | 🟡 Partial | Exact date match only — no night window |
| Offline scanning + cache | offline-ticket-cache.ts + offline-queue-service.ts | ✅ Complete | Reject unknown, cache validation, exponential backoff |
| Offline banner + acknowledge | OfflineBanner.tsx + OfflineAcknowledgeModal.tsx | ✅ Complete | Orange full-screen acknowledgment |
| Audio + haptic feedback | audio-feedback-service.ts | ✅ Complete | Tier-differentiated tones and vibration |
| Wake lock (screen stays on) | useWakeLock hook | ✅ Complete | Re-acquires on tab visibility change |
| Employee authentication | ProtectedRoute + EmployeeLogin | ✅ Complete | Auth check on all routes |
| Manual ticket entry | Scanner.tsx inline form | ✅ Complete | Rate limited 5/min |
| Scan logging | simple-scanner.ts logScan() + logFailedScan() | ✅ Complete | Fire-and-forget, non-blocking |

### Operational (should work, non-blocking for launch)

| Feature | Component(s) | Status | Notes |
|---------|-------------|--------|-------|
| Guest list check-in | GuestListCheckIn.tsx | ✅ Complete | No offline support |
| VIP guest pass scanning | Scanner.tsx (unified) + VipScannerPage (optional) | ✅ Complete | Main scanner handles VIP via `processVipPassScan()` + `VipSuccessOverlay` |
| Battery indicator | BatteryIndicator.tsx | ✅ Complete | Hidden if API unavailable |
| Scanner heartbeat | scanner-status-service.ts | ✅ Complete | 30s interval |
| Scan history (local) | ScanHistory.tsx + localStorage | ✅ Complete | Last 10, persisted |
| Sync status + manual sync | Scanner.tsx inline | ✅ Complete | Pending count badge |
| NFC scanning | NFCScanner.tsx | ✅ Complete | Behind VITE_ENABLE_NFC flag |
| QR scan debounce (2.5s) | Scanner.tsx refs | ✅ Complete | Prevents double-scan |
| Fraud detection (background) | fraud-detection-service.ts | ✅ Complete | 6 checks, async, non-blocking |

### Post-Launch (built but not wired — wire incrementally)

| Feature | Component(s) | Status | Impact |
|---------|-------------|--------|--------|
| Low battery warning | LowBatteryModal.tsx | Built, not wired | HIGH — phone dying mid-shift |
| Emergency override | OverrideActivationModal.tsx + emergency-override-service.ts | Built, not wired | HIGH — VIP host "let them in" |
| Full-screen VIP overlays | `VipSuccessOverlay.tsx` in unified Scanner.tsx + `RejectionOverlay` for VIP rejections | ✅ Complete | Unified scanner shows full-screen VIP overlay with tier badge, table info, guest progress, re-entry banner |
| Batch/group check-in | BatchQueue.tsx + batch-scan-service.ts | Built, not wired | MEDIUM — parties of 4-6 |
| ID verification | IDVerificationModal + PhotoCaptureModal + PhotoComparison | Built, not wired | MEDIUM — 21+ events |
| Shift clock in/out | ShiftStatus.tsx + shift-service.ts | Built, not wired | MEDIUM — time tracking |
| Fraud risk badge | RiskIndicatorBadge.tsx | Built, not wired | LOW — staff awareness |
| 4-tab manual entry | ManualEntry.tsx | Built, not used | LOW — Scanner has simpler inline version |
| USB scanner support | ScannerInput.tsx | Built, not used | LOW — phones are primary scanners |
| Scanner settings panel | ScannerSettingsPanel.tsx | Built, not used | LOW — no settings to configure yet |

---

## Known Issues

### P0 (Security / Auth)

| Issue | Current Status |
|-------|---------------|
| Demo buttons on Auth.tsx | ✅ RESOLVED — separate /auth/employee and /auth/owner pages |
| ProtectedRoute on all routes | ✅ RESOLVED — all scanner routes wrapped with auth check |
| localStorage auth fallback | ⚠️ NEEDS VERIFICATION — AuthContext.tsx may need `import.meta.env.DEV` guard |

### P1 (Functional)

| Issue | Impact | Fix |
|-------|--------|-----|
| Event auto-detect uses exact date, not night window | Friday events vanish at midnight. Saturday morning shifts start with confusion. | Change to 6 PM–5 AM window: if current hour < 5 AM, check yesterday's date too |
| `debugGetSampleTickets()` runs in production | Console noise, unnecessary DB query on every Scanner mount | Gate behind `import.meta.env.DEV` |
| Guest list has no offline support | Cannot check in guest-listed people if WiFi drops | Add offline cache for guest list entries or show "requires network" message |
| No back-to-scanner from Guest List | Staff stuck on non-scanner pages without browser back | Add persistent "Back to Scanner" header button |
| `/crew/settings` owner-gated but in employee sidebar | Employees see Unauthorized page when tapping Settings | Create employee settings page or change route guard |
| ~~VIP scanner uses card results not full-screen overlays~~ | ~~VIP feedback less visible than GA in dark venue~~ | ✅ RESOLVED — Unified scanner at `/scanner` now handles VIP guest passes with dedicated `VipSuccessOverlay` (full-screen green, tier badge, table info, guest progress bar, 2s auto-dismiss). Standalone VIP scanner at `/scan/vip` still uses card results but is no longer the primary VIP scanning path. |

### P2 (Polish)

| Issue | Impact | Fix |
|-------|--------|-----|
| Scanner.tsx at 1,133 lines | Maintainability | Extract scan processing into `useScanProcessor` hook |
| Two separate offline queue databases (GA + VIP) | Complexity | Consider unifying into single queue with type field |
| ManualEntry.tsx (4-tab) not used | Dead code | Remove or replace inline version |
| TicketResult.tsx (467 lines) not used | Dead code | Remove or wire as optional detail view |
| scanner-service.ts (1,867 lines) not used | Dead code | Scanner.tsx uses simple-scanner.ts instead |

---

## Overall Assessment: ~88% Complete

The scanner is **production-ready for GA ticket scanning and VIP guest pass scanning**. The unified scanner at `/scanner` handles all QR code types — GA tickets, VIP guest passes, and VIP-linked GA re-entries — with dedicated overlays for each. The core loop — QR capture, signature verification, ticket/VIP lookup, duplicate detection, VIP re-entry, success/rejection overlays, audio/haptic feedback, offline caching and queue, real-time check-in counter — is fully built and functional.

### What Makes It Good

1. **Full-screen overlays are correct.** Green/red at z-100 with 1.5s auto / manual dismiss is exactly what door staff needs in a dark, loud venue.
2. **Unified scanner handles all QR types.** One scanner at `/scanner` processes GA tickets, VIP guest passes, and VIP-linked re-entries. Door staff never need to switch apps or pages.
3. **Offline architecture is thorough.** Dexie.js caching, queue with exponential backoff, first-scan-wins conflict resolution, staff acknowledgment modal. VIP passes queued offline via separate VIP queue.
4. **HMAC verification is server-only.** The signing secret never reaches the client. Signatures verified via Edge Function. Fail-closed on error.
5. **VIP differentiation is rich.** Dedicated `VipSuccessOverlay` with tier-colored badge, table + floor section, guest number, party progress bar, re-entry banner. Different haptic patterns and audio tones for GA vs VIP vs re-entry.
6. **Wake lock prevents screen sleep.** Critical for a phone scanning for 6+ hours.
7. **Fraud detection runs asynchronously.** 6 checks including geographic impossibility (Haversine formula). Never blocks scan response.

### Top 5 Highest-Impact Remaining Work

1. **Fix event auto-detect to use 6 PM–5 AM night window** — Friday night events vanish from auto-select at midnight. Every Saturday morning shift starts with manual event selection confusion. File: `maguey-gate-scanner/src/pages/Scanner.tsx` (event auto-detect useEffect).

2. **Wire LowBatteryModal at 20/10/5% thresholds** — A phone dying mid-shift with 300 people in line is a disaster. The `LowBatteryModal` component already exists and is complete — it just needs to be triggered in Scanner.tsx using Battery API events. Files: `Scanner.tsx`, `components/scanner/LowBatteryModal.tsx`.

3. ~~**Add full-screen overlays to VIP scanner**~~ — ✅ RESOLVED. The unified scanner at `/scanner` now handles VIP guest passes with a dedicated `VipSuccessOverlay` showing tier badge, table info, guest progress bar, and re-entry banner. The standalone VIP scanner at `/scan/vip` still uses card results but is no longer the primary scanning path.

4. **Wire emergency override in Scanner UI** — When a VIP host says "let them in" and the system says no, staff needs a way to override. The `OverrideActivationModal` exists with PIN auth, duration limits, and audit logging — it just needs a trigger (long-press on rejection overlay, or hidden button). Files: `Scanner.tsx`, `components/scanner/OverrideActivationModal.tsx`.

5. **Add "Back to Scanner" navigation from Guest List and VIP pages** — Staff on the Guest List page cannot get back to the scanner without browser back. Add a persistent header affordance on all non-scanner employee pages. Files: `GuestListCheckIn.tsx`, `VipScannerPage.tsx`.

---

*Based on full codebase analysis of all scanner pages, 47+ components, 10 service files, and offline architecture — Feb 17, 2026.*
