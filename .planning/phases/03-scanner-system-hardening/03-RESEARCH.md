# Phase 3: Scanner System Hardening - Research

**Researched:** 2026-01-30
**Domain:** QR/NFC scanning, offline-first PWA, haptic/audio feedback
**Confidence:** HIGH

## Summary

The maguey-gate-scanner application already has a solid foundation for ticket scanning with QR code validation, signature verification, and basic offline queueing using Dexie.js (IndexedDB wrapper). The current implementation uses html5-qrcode for camera-based scanning, has an offline queue service with exponential backoff retry, and includes audio/haptic feedback services.

The main gaps between the current state and the Phase 3 requirements are:
1. **Full-screen feedback displays** - Current UI shows modal overlay but lacks the distinctive green/red full-screen flash patterns
2. **Detailed rejection feedback** - Current error messages are generic; needs staff/gate/time details for already-scanned tickets
3. **Scan history UI** - No visible recent scan history with expandable details
4. **Ticket list caching** - Offline mode queues scans but does not cache ticket data for local validation
5. **Event check-in counter** - No persistent visible counter at top of scanner
6. **Dashboard scanner status** - Owner dashboard does not show real-time scanner online/offline status

**Primary recommendation:** Enhance existing infrastructure rather than rebuilding. The Dexie.js offline queue, audio-feedback-service, and scanner-service patterns are well-designed and should be extended.

## Standard Stack

The codebase already uses the established libraries for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| html5-qrcode | 2.3.8 | QR code scanning | Browser-native camera API, no native dependencies |
| dexie | 4.2.1 | IndexedDB wrapper | Industry standard for offline-first PWAs |
| @noble/hashes | 1.8.0 | HMAC signature verification | Secure, modern crypto implementation |
| @supabase/supabase-js | 2.77.0 | Database/realtime | Already used across all apps |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.462.0 | Icons | Checkmark, X, alert icons for feedback |
| sonner | 1.7.4 | Toast notifications | Sync completion toasts |
| date-fns | 3.6.0 | Date formatting | Scan timestamp display |

### No Additional Libraries Needed
The current stack is complete. No new dependencies required for Phase 3.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── scanner/
│   │   ├── FullScreenScanner.tsx    # EXISTS - Main scanner with viewfinder
│   │   ├── ScanResultOverlay.tsx    # EXISTS - Needs enhancement for full-screen
│   │   ├── ScanHistory.tsx          # NEW - Recent scans list
│   │   └── CheckInCounter.tsx       # NEW - Event check-in counter badge
│   └── QrScanner.tsx                # EXISTS - html5-qrcode wrapper
├── lib/
│   ├── offline-queue-service.ts     # EXISTS - Scan queueing for offline
│   ├── offline-ticket-cache.ts      # NEW - Ticket list caching for offline validation
│   ├── audio-feedback-service.ts    # EXISTS - Sound/haptic patterns
│   ├── simple-scanner.ts            # EXISTS - Core scan logic
│   └── scanner-service.ts           # EXISTS - Full scanner with tracing
└── pages/
    └── Scanner.tsx                  # EXISTS - Main scanner page
```

### Pattern 1: Optimistic Offline Validation with Cached Ticket List

**What:** Cache event ticket list in IndexedDB for local validation when offline
**When to use:** Before every scan while offline to provide immediate accept/reject feedback

```typescript
// Source: Dexie.js patterns - https://dexie.org/
// offline-ticket-cache.ts pattern
class TicketCacheDatabase extends Dexie {
  cachedTickets!: Table<CachedTicket, string>;
  cacheMetadata!: Table<CacheMetadata, string>;

  constructor() {
    super('TicketCacheDatabase');
    this.version(1).stores({
      cachedTickets: 'ticketId, eventId, qrToken, status, syncedAt',
      cacheMetadata: 'eventId, lastSyncAt, ticketCount',
    });
  }
}

interface CachedTicket {
  ticketId: string;
  eventId: string;
  qrToken: string;
  qrSignature: string;
  status: 'valid' | 'scanned' | 'invalid';
  guestName?: string;
  ticketType: string;
  scannedAt?: string;
  scannedBy?: string;
  syncedAt: string;
}

// Pre-fetch ticket list when event starts or when online
async function syncTicketCache(eventId: string): Promise<void> {
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, qr_token, qr_signature, status, guest_name, ticket_type')
    .eq('event_id', eventId);

  await db.cachedTickets.bulkPut(tickets.map(t => ({
    ticketId: t.id,
    eventId,
    qrToken: t.qr_token,
    qrSignature: t.qr_signature,
    status: t.status === 'scanned' ? 'scanned' : 'valid',
    guestName: t.guest_name,
    ticketType: t.ticket_type,
    syncedAt: new Date().toISOString(),
  })));
}

// Local validation for offline mode
async function validateOffline(qrToken: string): Promise<{
  status: 'valid' | 'scanned' | 'not_in_cache';
  ticket?: CachedTicket;
}> {
  const ticket = await db.cachedTickets.where('qrToken').equals(qrToken).first();
  if (!ticket) return { status: 'not_in_cache' };
  return { status: ticket.status, ticket };
}
```

### Pattern 2: Full-Screen Feedback with Auto-Dismiss

**What:** Take over entire screen for scan result with color, icon, and sound
**When to use:** Immediately after any scan completes (success or failure)

```typescript
// Source: User decisions from 03-CONTEXT.md
interface ScanFeedback {
  type: 'success' | 'already_used' | 'invalid';
  ticketType: 'ga' | 'vip_reservation' | 'vip_guest';
  details: {
    guestName?: string;
    tableName?: string;
    tier?: string;
    guestCount?: string;         // "3 of 5 guests checked in"
    reservationHolder?: string;
    previousScan?: {
      staffName: string;
      gateName: string;
      time: string;
    };
    wrongEventDate?: string;      // "This ticket is for Saturday Feb 1st"
  };
}

// Auto-dismiss timing per context decision: 1-2 seconds
const DISMISS_DELAY_MS = 1500;

// GA tickets: Minimal display
// VIP reservations: Full details
// VIP guest passes: Minimal ('VIP Guest' + table number)
```

### Pattern 3: Scan History with Expandable Rows

**What:** Persistent list of last 5-10 scans with expandable detail view
**When to use:** Always visible below scanner, tap to expand

```typescript
// Source: User decisions from 03-CONTEXT.md
interface ScanHistoryEntry {
  id: string;
  timestamp: Date;
  status: 'success' | 'failure';
  ticketType: 'GA' | 'VIP';
  // Collapsed view shows: icon, timestamp, type
  // Expanded view shows full details
  details: {
    guestName: string;
    event: string;
    errorReason?: string;
  };
}

// Store in component state, persist last 10 to localStorage for reload
```

### Anti-Patterns to Avoid
- **Building custom audio synthesis** - Use existing audio-feedback-service.ts with Web Audio API
- **Polling for network status** - Use navigator.onLine with online/offline events
- **Blocking UI during sync** - Fire-and-forget sync, show toast when complete
- **Manual IndexedDB operations** - Always use Dexie.js wrapper

## Don't Hand-Roll

Problems that have existing solutions in the codebase:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Offline data storage | Custom localStorage JSON | Dexie.js (already installed) | Transaction safety, indexing, query API |
| Audio feedback | HTML5 Audio elements | audio-feedback-service.ts | Web Audio API for programmatic tones |
| QR scanning | Native camera API | html5-qrcode (already installed) | Cross-browser, handles permissions |
| Signature verification | Custom HMAC | @noble/hashes (already installed) | Timing-safe comparison, tested |
| Retry with backoff | Custom setTimeout chains | offline-queue-service.ts pattern | Exponential backoff already implemented |
| Network detection | Custom ping/fetch | navigator.onLine + events | Browser-native, reliable |

**Key insight:** The codebase already has most infrastructure pieces. Phase 3 is about connecting them properly and enhancing the UI layer, not rebuilding core services.

## Common Pitfalls

### Pitfall 1: Scan Debouncing Timing
**What goes wrong:** QR scanner fires multiple callbacks for same code, causing duplicate scans
**Why it happens:** html5-qrcode calls success callback continuously while code is in view
**How to avoid:** Already handled in Scanner.tsx with `lastScannedRef` and `SCAN_COOLDOWN` (2500ms)
**Warning signs:** "Already scanned" errors appearing for fresh scans

### Pitfall 2: Audio Context Blocked by Browser
**What goes wrong:** No sound plays on first scan
**Why it happens:** Browsers require user interaction before AudioContext can play
**How to avoid:** audio-feedback-service.ts already handles this with context.resume()
**Warning signs:** First scan silent, subsequent scans have audio

### Pitfall 3: IndexedDB Transaction Timeouts
**What goes wrong:** Dexie operations fail silently during long-running operations
**Why it happens:** IndexedDB transactions auto-commit when idle
**How to avoid:** Keep transactions short, don't await network calls inside transactions
**Warning signs:** Intermittent "transaction inactive" errors

### Pitfall 4: Race Condition on Concurrent Scans
**What goes wrong:** Two staff scan same ticket simultaneously, both show success
**Why it happens:** Database read and write are not atomic
**How to avoid:**
1. Use database-level atomic updates (SET status WHERE status != 'scanned')
2. First-scan-wins for offline mode (sync resolves by timestamp)
**Warning signs:** Duplicate check-ins in scan logs

### Pitfall 5: Camera Resource Not Released
**What goes wrong:** Camera stays active after navigating away, blocking other apps
**Why it happens:** Component unmounts but cleanup doesn't complete
**How to avoid:** QrScanner.tsx has proper cleanup with try-catch in useEffect cleanup
**Warning signs:** Camera LED stays on, battery drain

### Pitfall 6: Offline Mode Not Visually Obvious
**What goes wrong:** Staff doesn't realize they're scanning in offline mode
**Why it happens:** Subtle offline indicator, staff focused on line
**How to avoid:** Per context decision: prominent 'OFFLINE MODE' banner always visible
**Warning signs:** Support calls about "scans not showing up"

## Code Examples

### Example 1: Full-Screen Success Overlay (GA Ticket)

```typescript
// Source: User decisions from 03-CONTEXT.md
interface SuccessOverlayProps {
  ticketType: 'ga' | 'vip_reservation' | 'vip_guest';
  groupCheckIn?: { current: number; total: number };
  vipDetails?: {
    tableName: string;
    tier: string;
    guestCount: number;
    holderName: string;
  };
  onDismiss: () => void;
}

function SuccessOverlay({ ticketType, groupCheckIn, vipDetails, onDismiss }: SuccessOverlayProps) {
  useEffect(() => {
    playSuccess(); // or playTierSuccess for VIP
    const timer = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-[100] bg-green-500 flex flex-col items-center justify-center animate-in fade-in duration-200">
      <CheckCircle2 className="h-32 w-32 text-white mb-8 animate-[bounce_0.5s_ease-in-out]" />

      {ticketType === 'ga' && (
        // GA: Minimal display - just checkmark
        null
      )}

      {ticketType === 'vip_reservation' && vipDetails && (
        // VIP Reservation: Full details
        <div className="text-white text-center">
          <p className="text-3xl font-bold">{vipDetails.tableName}</p>
          <p className="text-xl opacity-80">{vipDetails.tier} Tier</p>
          <p className="text-lg opacity-60">{vipDetails.holderName}</p>
          <p className="text-lg">{vipDetails.guestCount} guests</p>
        </div>
      )}

      {ticketType === 'vip_guest' && (
        // VIP Guest Pass: Minimal
        <p className="text-2xl text-white font-bold">VIP Guest - Table {vipDetails?.tableName}</p>
      )}

      {groupCheckIn && (
        <p className="text-xl text-white/80 mt-4">
          {groupCheckIn.current} of {groupCheckIn.total} guests checked in
        </p>
      )}
    </div>
  );
}
```

### Example 2: Full-Screen Rejection Overlay

```typescript
// Source: User decisions from 03-CONTEXT.md
interface RejectionOverlayProps {
  reason: 'already_used' | 'wrong_event' | 'invalid' | 'expired' | 'tampered';
  details: {
    previousScan?: { staff: string; gate: string; time: string };
    wrongEventDate?: string;
    message?: string;
  };
  onDismiss: () => void;
}

function RejectionOverlay({ reason, details, onDismiss }: RejectionOverlayProps) {
  useEffect(() => {
    playError();
    // Longer vibration pattern for rejection
    navigator.vibrate?.([200, 100, 200]);
  }, []);

  const getMessage = () => {
    switch (reason) {
      case 'already_used':
        return (
          <>
            <p className="text-3xl font-bold mb-4">ALREADY SCANNED</p>
            <p className="text-xl opacity-80">
              Scanned by {details.previousScan?.staff}
            </p>
            <p className="text-lg opacity-60">
              at {details.previousScan?.gate}, {details.previousScan?.time}
            </p>
          </>
        );
      case 'wrong_event':
        return (
          <>
            <p className="text-3xl font-bold mb-4">WRONG EVENT</p>
            <p className="text-xl opacity-80">
              This ticket is for {details.wrongEventDate}
            </p>
          </>
        );
      default:
        return (
          <>
            <p className="text-3xl font-bold mb-4">INVALID</p>
            <p className="text-xl opacity-80">{details.message}</p>
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-red-600 flex flex-col items-center justify-center animate-in fade-in duration-200">
      <XCircle className="h-32 w-32 text-white mb-8" />
      <div className="text-white text-center px-8">
        {getMessage()}
      </div>
      <Button onClick={onDismiss} className="mt-8 bg-white text-red-600 hover:bg-white/90">
        Scan Next
      </Button>
    </div>
  );
}
```

### Example 3: Event Check-In Counter

```typescript
// Source: User decisions from 03-CONTEXT.md
interface CheckInCounterProps {
  eventId: string;
}

function CheckInCounter({ eventId }: CheckInCounterProps) {
  const [count, setCount] = useState({ checkedIn: 0, total: 0 });

  // Subscribe to realtime updates
  useEffect(() => {
    const fetchCount = async () => {
      const { count: checkedIn } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'scanned');

      const { count: total } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId);

      setCount({ checkedIn: checkedIn ?? 0, total: total ?? 0 });
    };

    fetchCount();

    // Realtime subscription for ticket status changes
    const channel = supabase
      .channel(`tickets:${eventId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tickets',
        filter: `event_id=eq.${eventId}`
      }, fetchCount)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [eventId]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm p-2 flex justify-center">
      <Badge variant="outline" className="text-lg px-4 py-2 border-white/20">
        <Users className="w-4 h-4 mr-2" />
        Checked in: {count.checkedIn} / {count.total}
      </Badge>
    </div>
  );
}
```

### Example 4: Offline Banner Component

```typescript
// Source: User decisions from 03-CONTEXT.md
function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const status = await getSyncStatus();
      setPendingCount(status.pending + status.failed);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-orange-500 text-white p-3 flex items-center justify-center gap-2 animate-pulse">
      <WifiOff className="w-5 h-5" />
      <span className="font-bold">OFFLINE MODE</span>
      {pendingCount > 0 && (
        <Badge variant="secondary" className="bg-white/20">
          {pendingCount} pending sync
        </Badge>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for offline | IndexedDB via Dexie.js | 2023+ | Transaction safety, larger storage, indexing |
| getUserMedia directly | html5-qrcode wrapper | 2022+ | Cross-browser compatibility, permission handling |
| setTimeout for debounce | useRef with timestamp | React 18+ | No re-renders, avoids stale closure issues |
| Polling for sync status | Supabase Realtime | 2024+ | Lower latency, less battery drain |

**Current in codebase:**
- Dexie.js 4.2.1 (latest)
- html5-qrcode 2.3.8 (latest)
- @noble/hashes 1.8.0 (modern crypto)

## Open Questions

Things that need validation during implementation:

1. **Scan log "scanned_by" field population**
   - What we know: Field exists in scan_logs table
   - What's unclear: How to get staff name (not just user ID) for "already scanned" display
   - Recommendation: May need JOIN or lookup in display layer

2. **Gate identification**
   - What we know: Context decision mentions "at [Gate]" for already-scanned feedback
   - What's unclear: No gate_id field visible in current schema
   - Recommendation: Clarify if this is a new field or if device_id should be used

3. **Ticket list cache size limits**
   - What we know: Need to cache tickets for offline validation
   - What's unclear: Large events could have 5000+ tickets
   - Recommendation: Use eventId filtering, implement cleanup of old events

## Sources

### Primary (HIGH confidence)
- Codebase analysis: maguey-gate-scanner/src/lib/* - Full read of existing implementation
- Database schema: maguey-gate-scanner/src/integrations/supabase/types.ts
- User decisions: .planning/phases/03-scanner-system-hardening/03-CONTEXT.md

### Secondary (MEDIUM confidence)
- [Dexie.js documentation](https://dexie.org/) - Sync patterns, liveQuery
- [MDN Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API) - Haptic patterns
- [html5-qrcode React patterns](https://github.com/scanapp-org/html5-qrcode-react) - Camera lifecycle

### Tertiary (LOW confidence)
- WebSearch results for PWA offline patterns - General guidance only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - Patterns derived from existing codebase
- Pitfalls: HIGH - Based on existing code patterns and known issues
- UI patterns: MEDIUM - Based on context decisions, implementation details TBD

**Research date:** 2026-01-30
**Valid until:** 60 days (stable domain, minimal library churn)

---

## Gap Analysis Summary

| Requirement | Current State | Gap | Effort |
|-------------|---------------|-----|--------|
| SCAN-01: Valid QR accepted | Working via simple-scanner.ts | None | - |
| SCAN-02: Invalid rejected with feedback | Basic error messages | Need detailed rejection UI | Medium |
| SCAN-03: Already-scanned status | Shows time, not staff/gate | Need enhanced error details | Low |
| SCAN-04: Offline with sync | Queue exists, no ticket cache | Need ticket list caching | Medium |
| Full green/red screen | Modal overlay exists | Need full-screen components | Low |
| Audio tones | audio-feedback-service exists | Tune frequencies | Low |
| Haptic feedback | Vibration exists | Tune patterns | Low |
| 1-2 sec auto-dismiss | Manual dismiss | Add timer | Low |
| GA minimal, VIP detailed | Same display for all | Conditional rendering | Low |
| Group check-in count | Not shown | Add to overlay | Low |
| Event counter at top | Not present | New component | Low |
| Scan history list | Not present | New component | Medium |
| Expandable details | Not present | Add to history | Low |
| OFFLINE banner | Subtle indicator | Make prominent | Low |
| First-scan-wins sync | Implemented | None | - |
| 24hr offline retention | 7 days currently | Update config | Low |
| Dashboard scanner status | Not present | Need realtime channel | Medium |
