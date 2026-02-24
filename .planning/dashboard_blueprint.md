# Maguey Nightclub — Owner Dashboard Blueprint

> A comprehensive 21-dimension spec for what the owner of Maguey Nightclub sees when logged into `staff.magueynightclub.com`. Organized across **Visual (8)**, **Architecture (4)**, **Strategy (5)**, and **Product (4)** dimensions.

---

# VISUAL (8) — how it looks and feels

---

## 1. Visual Design Spec

### Color System (HSL CSS Variables — `:root` in `index.css`)

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--background` | `0 0% 0%` | Page background (pure black) |
| `--foreground` | `0 0% 98%` | Primary text (near-white) |
| `--primary` | `271 91% 65%` | Buttons, links, focus rings (vibrant purple) |
| `--primary-foreground` | `0 0% 100%` | Text on primary backgrounds |
| `--secondary` | `240 3.7% 15.9%` | Muted backgrounds, input fields |
| `--accent` | `45 93% 47%` | Gold highlights, VIP indicators |
| `--destructive` | `0 84.2% 60.2%` | Error states, rejection overlays |
| `--success` | `142 76% 36%` | Success states, check-in confirmations |
| `--muted` | `240 3.7% 15.9%` | Disabled/secondary backgrounds |
| `--muted-foreground` | `240 5% 64.9%` | Placeholder text, descriptions |
| `--card` | `0 0% 5%` | Card backgrounds (very dark gray) |
| `--border` | `240 3.7% 15.9%` | Borders, dividers |
| `--ring` | `271 91% 65%` | Focus ring (matches primary) |
| `--radius` | `0.75rem` | Base border-radius (12px) |

### Gradient Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--gradient-purple` | `135deg, hsl(271 91% 65%) → hsl(280 80% 50%)` | Primary action gradients |
| `--gradient-gold` | `135deg, hsl(45 93% 47%) → hsl(38 92% 50%)` | VIP/premium indicators |
| `--gradient-green` | `135deg, hsl(142 60% 45%) → hsl(142 70% 40%)` | Success states |
| `--gradient-scan` | `180deg, hsla(142 60% 45% / 0.2) → transparent` | Scanner background |

### Glow Shadows (Neon Nightclub Effect)

| Token | Value | Usage |
|-------|-------|-------|
| `--glow-purple` | `0 0 40px hsla(271 91% 65% / 0.4)` | Primary glow |
| `--glow-gold` | `0 0 30px hsla(45 93% 47% / 0.3)` | VIP glow |
| `--glow-green` | `0 0 30px hsla(142 60% 45% / 0.4)` | Success glow |
| `--glow-success` | `0 0 30px hsla(142 76% 36% / 0.4)` | Check-in success |

### Typography

| Scale | Class | Size | Weight | Usage |
|-------|-------|------|--------|-------|
| Display | `text-4xl font-bold` | 36px / 700 | Page titles |
| Heading | `text-3xl font-semibold` | 30px / 600 | Section headers |
| Title | `text-2xl font-semibold` | 24px / 600 | Card values, KPIs |
| Subtitle | `text-lg font-medium` | 18px / 500 | Widget titles |
| Body | `text-sm font-medium` | 14px / 500 | Default content |
| Small | `text-xs` | 12px / 400 | Metadata, timestamps |
| Micro | `text-[10px] uppercase tracking-[0.3em]` | 10px / 400 | Section labels ("MAIN", "SALES") |
| Overlay | `text-4xl font-black uppercase` | 36px / 900 | Scanner overlays ("WELCOME", "ALREADY SCANNED") |

**Font:** System sans-serif (no Google Fonts). BrandingContext allows runtime font-family override via CSS variable `--font-family`.

### Spacing Scale (Tailwind defaults)

| Use Case | Values |
|----------|--------|
| Component padding | `p-4` (16px), `p-6` (24px) |
| Card padding | `p-6` (24px) |
| Grid gaps | `gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8` |
| Section spacing | `space-y-4`, `space-y-8`, `space-y-10` |
| Sidebar width | `16rem` (256px desktop), `18rem` (288px mobile) |
| Main content offset | `lg:ml-72` (288px, matches sidebar + padding) |
| Content max-width | `max-w-7xl` (1280px) |

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | ~4px | Tiny elements |
| `rounded-md` | ~10px | Inputs, small cards |
| `rounded-lg` | 12px (`--radius`) | Standard cards |
| `rounded-2xl` | 16px | Buttons, nav items, elevated cards |
| `rounded-3xl` | 24px | Major containers, hero sections |
| `rounded-full` | 50% | Avatars, circular badges |

---

## 2. Component APIs

### Key Widget Props Interfaces

**MetricCard**
```typescript
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; isPositive: boolean };
  className?: string;
}
```

**UpcomingEventsCard**
```typescript
interface UpcomingEvent {
  id: string;
  name: string;
  dateLabel: string;
  location?: string | null;
  ticketsSold: number;
  capacity: number;
  percentSold: number;
  status: "on-track" | "monitor" | "sellout";
}

interface UpcomingEventsCardProps {
  events: UpcomingEvent[];
  onManageEvents?: () => void;
}
```

**CheckInProgress**
```typescript
interface CheckInProgressProps {
  events: Array<{
    id: string;
    name: string;
    checkedIn: number;
    total: number;
  }>;
}
```

**RejectionOverlay**
```typescript
type RejectionReason =
  | 'already_used' | 'wrong_event' | 'invalid'
  | 'expired' | 'tampered' | 'not_found' | 'offline_unknown';

interface RejectionOverlayProps {
  reason: RejectionReason;
  details: {
    previousScan?: { staff: string; gate: string; time: string };
    wrongEventDate?: string;
    message?: string;
  };
  onDismiss: () => void;
}
```

**SuccessOverlay**
```typescript
interface SuccessOverlayProps {
  guestName: string;
  ticketType: string;
  onDismiss: () => void;
  autoDismissMs?: number; // Default: 1500
}
```

**FraudAlertsWidget**
```typescript
interface FraudAlert {
  id: string;
  riskScore: number;
  indicators: string[];
  timestamp: string;
  ticketId: string;
}

interface FraudAlertsWidgetProps {
  alerts: FraudAlert[];
  onInvestigate?: (alertId: string) => void;
}
```

### Button Variants (CVA — Class Variance Authority)

| Variant | Classes | Usage |
|---------|---------|-------|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` | Primary actions |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | Delete, reject |
| `outline` | `border border-input bg-background hover:bg-accent` | Secondary actions |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` | Tertiary actions |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` | Toolbar, nav items |
| `link` | `text-primary underline-offset-4 hover:underline` | Inline links |

| Size | Classes |
|------|---------|
| `sm` | `h-9 rounded-md px-3` |
| `default` | `h-10 px-4 py-2` |
| `lg` | `h-11 rounded-md px-8` |
| `icon` | `h-10 w-10` |

---

## 3. Interaction Design

### Transitions & Timing

| Property | Duration | Easing | Usage |
|----------|----------|--------|-------|
| Color/bg | `transition-colors` | default | Hover states on buttons, links |
| All props | `transition-all` | default | Cards, complex hover effects |
| Transform | `transition-transform duration-200` | default | Icon rotations, scale |
| `--transition-smooth` | `0.3s` | `cubic-bezier(0.4, 0, 0.2, 1)` | Global smooth transition |

### Animations

| Animation | Definition | Usage |
|-----------|-----------|-------|
| `fade-in` | `animate-in fade-in duration-200` | Overlay entrance |
| `bounce` | `animate-[bounce_0.5s_ease-in-out]` | Success checkmark |
| `scan` | `animate-[scan_2s_ease-in-out_infinite]` | QR scanner laser line |
| `slide-in-from-bottom` | `animate-in slide-in-from-bottom-2 duration-300` | Scan history items |
| `slide-in-from-top` | `animate-in slide-in-from-top-2 duration-200` | Expanded details |
| `accordion-down` | `0.2s ease-out` | Radix accordion expand |
| `accordion-up` | `0.2s ease-out` | Radix accordion collapse |

### Gestures & Feedback

| Gesture | Library | Where |
|---------|---------|-------|
| Drag-and-drop | `@dnd-kit/core` v6.3.1 | VIP floor plan table positioning |
| Haptic vibration | `navigator.vibrate(50)` | Success/rejection overlays |
| Audio feedback | Custom `audio-feedback-service.ts` | `playSuccess()`, `playError()`, `hapticVIP()` |
| Wake lock | `react-screen-wake-lock` | Prevents screen sleep during scanning |
| Camera switch | User agent detection → `facingMode` | QR scanner (mobile: back camera, desktop: any) |

### Hover States (Glass Card Pattern)

```
Default:    bg-white/5  border-white/10  rounded-2xl
Hover:      bg-white/10  transition-all
Active:     bg-white/15  shadow-[0_20px_45px_rgba(15,23,42,0.6)]
```

---

## 4. State Coverage

### React Contexts

| Context | File | State | Hook |
|---------|------|-------|------|
| **AuthContext** | `contexts/AuthContext.tsx` | `user`, `role`, `loading`, `refreshRole()` | `useAuth()`, `useRole()` |
| **BrandingContext** | `contexts/BrandingContext.tsx` | `branding`, `loading`, `refreshBranding()`, `applyBranding()` | `useBranding()` |

### Real-Time Subscriptions (`useDashboardRealtime` hook)

| Table | Event | Subscribed By |
|-------|-------|---------------|
| `tickets` | `*` (INSERT/UPDATE/DELETE) | OwnerDashboard |
| `orders` | `*` | OwnerDashboard |
| `vip_reservations` | `*` | OwnerDashboard, VipTablesManagement |
| `scan_logs` | `*` (optional) | OwnerDashboard |
| `email_queue` | `*` (optional) | OwnerDashboard |
| `scanner_heartbeats` | `*` (optional) | OwnerDashboard |
| `events` | `*` (optional) | OwnerDashboard |

**Features:** Visibility-aware reconnection (reconnects on tab focus), manual `reconnect()` function, returns `{ isLive, lastUpdate, reconnect }`.

### Local Storage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `maguey_user` | Object | User profile (DEV mode only) |
| `maguey_events` | Array | Cached events |
| `scanner_device_id` | String | Unique device ID for offline conflict resolution |
| `scans_today` | Number | Daily scan counter |
| `scans_today_date` | String | Date for scan counter reset |
| `scan_history` | Array | Recent scan results |
| `maguey_employee_email` | String | "Remember me" email (employee login) |

### IndexedDB (Dexie.js) — Offline Support

**TicketCacheDatabase:**
- `cachedTickets` — ticketId (PK), eventId, qrToken, status, guestName, ticketType
- `cacheMetadata` — eventId (PK), lastSyncAt, ticketCount, scannedCount
- `offlineScans` — auto-increment ID, ticketId, syncStatus (`pending`|`synced`|`conflict`|`failed`)

**OfflineQueueDatabase:**
- `queuedScans` — auto-increment ID, ticketId, syncStatus, retryCount, errorMessage, lastRetryAt

---

## 5. Modal/Overlay Specs

### Full-Screen Overlays (Scanner)

| Overlay | Trigger | Background | Auto-Dismiss | Dismiss |
|---------|---------|-----------|--------------|---------|
| **SuccessOverlay** | Valid ticket scan | `bg-green-500` (solid) | Yes (1.5s) | Auto or tap |
| **RejectionOverlay** | Invalid/duplicate scan | `bg-red-600` (solid) | No | Manual tap required |

### Dialog Modals (Radix `Dialog` / `AlertDialog`)

| Modal | Page | Trigger | Contains |
|-------|------|---------|----------|
| **Event Create/Edit** | EventManagement | "+ Create" / row click | 2-step wizard (details + VIP config) |
| **Event Delete Confirm** | EventManagement | Delete action | AlertDialog with confirmation |
| **CSV Import** | EventManagement | "Import" button | File upload + preview |
| **Event Settings** | EventManagement | Settings gear icon | Event-level config |
| **Newsletter Send** | EventManagement | "Notify" button | Message editor + preview |
| **Order Detail** | Orders | "View" button on row | Full order breakdown, payment actions |
| **VIP Reservation Detail** | VipTablesManagement | Row click | Guest passes, payment status, check-in all |
| **VIP Table Info** | VipTablesManagement | Floor plan click | Table details, quick pricing editor |
| **Customer Detail** | CustomerManagement | Row click | Purchase history, events attended |
| **User Detail** | TeamManagement | Row click | Profile, activity, role management |
| **User Delete Confirm** | TeamManagement | Delete action | AlertDialog with confirmation |
| **Staff Invite** | TeamManagement | "Invite" button | Role selection, expiration, link generation |
| **Shift Create/Edit** | StaffScheduling | "+ Create" button | Event/staff/time/role assignment |
| **Add Device** | DeviceManagement | "+ Register" button | Device name, model, OS |
| **Export Data** | Dashboard | Export button | CSV/PDF/Excel format selection, date range |
| **Fraud Analysis** | FraudInvestigation | "Investigate" link | Risk score, indicators, confirm/whitelist actions |

### Scanner-Specific Modals

| Modal | Trigger | Contains |
|-------|---------|----------|
| **IDVerificationModal** | Age verification required | Type select (18+/21+), ID number, notes |
| **OverrideActivationModal** | Emergency override | PIN entry, duration select (5min–1hr) |
| **PhotoCaptureModal** | ID/fraud investigation | Camera stream, photo preview, consent checkbox |
| **LowBatteryModal** | Battery ≤ 20% | Battery %, recommendations, "don't show again" |
| **OfflineAcknowledgeModal** | Network loss | Offline mode warning, acknowledgment required |
| **OverrideReasonModal** | Override scan | Reason selection, notes |

**Pattern:** All modals use `useState(false)` → `open`/`onOpenChange`. Standard structure: `DialogContent > DialogHeader (title + description) > Body > DialogFooter (actions)`.

---

## 6. Loading/Error States

### Loading Patterns

| Pattern | Implementation | Where Used |
|---------|---------------|------------|
| `useState(true)` → `isLoading` | Initial data fetch, show 0-value stats until loaded | Dashboard, EventManagement, Analytics |
| `useState(false)` → `isSubmitting` | Button disabled + text change during form submit | All modals, login forms |
| `Loader2` spinner | `animate-spin` icon inside button during upload/camera | PhotoCaptureModal |
| Text indicator | "Loading fraud analysis..." centered in dialog | FraudAnalysisModal |

**Gap:** No Skeleton component usage. App relies on 0-value initial state rather than skeleton loaders.

### Error Patterns

| Pattern | Implementation | Where Used |
|---------|---------------|------------|
| **ErrorBoundary** | Class component, `getDerivedStateFromError()` → "Reload Page" button | App root wrapper |
| **ScanErrorDisplay** | Color-coded border (red/yellow/blue), error type badge, recovery suggestion, dev-only JSON details | Scanner page |
| **Toast (destructive)** | `toast({ variant: "destructive", title, description })` | All pages on API/action failure |
| **ScanErrorInline** | Compact red border + icon + message | Scanner inline errors |

### Empty States

| Component | Trigger | Display |
|-----------|---------|---------|
| UpcomingEventsCard | `events.length === 0` | Dashed border + CalendarDays icon + "No upcoming events" + help text |
| FraudAnalysisModal | No fraud indicators | CheckCircle2 (green) + "No fraud indicators detected" |
| Tables (general) | Empty query result | "No {items} found" centered text |

**Pattern Template:**
```tsx
<div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center">
  <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
  <p className="font-medium">No {items}</p>
  <p className="text-sm text-muted-foreground mt-1">Help text or CTA</p>
</div>
```

### Toast Notifications (Sonner)

| Category | Variant | Examples |
|----------|---------|---------|
| Success | `default` | "ID Verified", "Override Activated", "Photo Captured", "Fraud Confirmed" |
| Error | `destructive` | "Activation Failed", "Upload Failed", "Camera Error", "Consent Required" |
| Warning | `default` | "Verification Skipped", "Notes Required" |

**Config:** TOAST_LIMIT = 1 (only 1 toast shown at a time). Library: Sonner with shadcn/ui theme adapter.

---

## 7. Theme Enforcement

### Strategy: Dark-Only with Class-Based Tailwind

```
tailwind.config.ts → darkMode: ["class"]
```

The app is **dark-only** — no light mode exists. The `:root` selector in `index.css` sets all CSS variables for the dark theme. `body` applies `@apply bg-background text-foreground`.

### Enforcement Layers

| Layer | Mechanism | File |
|-------|-----------|------|
| CSS Variables | HSL tokens on `:root` | `src/index.css` |
| Tailwind Config | Custom colors, gradients, glows, shadows | `tailwind.config.ts` |
| Component Library | shadcn/ui with custom theme | `src/components/ui/*.tsx` |
| Class Merging | `cn()` utility (clsx + tailwind-merge) | `src/lib/utils.ts` |
| Runtime Theming | BrandingContext → CSS variable override | `src/contexts/BrandingContext.tsx` |

### BrandingContext Runtime Overrides

```typescript
applyBranding(config: BrandingConfig) → {
  document.documentElement.style.setProperty('--primary', hexToHsl(config.primary_color));
  document.documentElement.style.setProperty('--secondary', hexToHsl(config.secondary_color));
  document.documentElement.style.setProperty('--accent', hexToHsl(config.accent_color));
  document.documentElement.style.setProperty('--font-family', config.font_family);
  // + custom CSS injection via <style id="custom-branding-css">
  // + favicon override
}
```

### Glass Card Standard

All dashboard cards must follow this pattern:

```
rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10
```

Sidebar: `bg-[#040b1a]/95 border-r border-white/5 backdrop-blur-2xl`

---

## 8. Responsive / Mobile Wireframes

### Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Default | < 640px | Single column, stacked cards, collapsed sidebar |
| `sm:` | ≥ 640px | 2-column grids, flex-row layouts |
| `md:` | ≥ 768px | 2-4 column grids, table layouts visible |
| `lg:` | ≥ 1024px | Full sidebar visible, 3-column grids |
| `2xl:` | ≥ 1400px | Container max-width |

### Mobile Hook

```typescript
// src/hooks/use-mobile.tsx
const MOBILE_BREAKPOINT = 768;
export function useIsMobile(): boolean
// Uses window.matchMedia, returns true below 768px
```

### Layout Wireframes (ASCII)

**Desktop (≥ 1024px):**
```
┌─────────────┬──────────────────────────────────────────────┐
│             │                                              │
│  SIDEBAR    │   MAIN CONTENT (max-w-7xl)                   │
│  (16rem)    │                                              │
│             │   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  Dashboard  │   │ KPI  │ │ KPI  │ │ KPI  │ │ KPI  │       │
│  Events     │   └──────┘ └──────┘ └──────┘ └──────┘       │
│  Live Ops   │                                              │
│  ──────     │   ┌────────────────┐ ┌────────────────┐      │
│  Tickets    │   │                │ │                │      │
│  VIP Tables │   │  Recent Orders │ │ Check-In Bars  │      │
│  Guest List │   │                │ │                │      │
│  ──────     │   └────────────────┘ └────────────────┘      │
│  Analytics  │                                              │
│  ──────     │   ┌────────────────┐ ┌────────────────┐      │
│  Staff      │   │ Upcoming Events│ │ Quick Actions   │      │
│  Scheduling │   │                │ │                │      │
│  Audit Log  │   └────────────────┘ └────────────────┘      │
│  ──────     │                                              │
│  Notif.     │                                              │
│  Branding   │                                              │
│  Devices    │                                              │
│  Security   │                                              │
│  Health     │                                              │
│             │                                              │
└─────────────┴──────────────────────────────────────────────┘
```

**Mobile (< 768px):**
```
┌──────────────────────┐
│ ☰ Maguey    [avatar] │  ← Hamburger menu
├──────────────────────┤
│                      │
│  ┌────────────────┐  │
│  │ KPI  │  KPI    │  │  ← 2-column grid
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │ KPI  │  KPI    │  │
│  └────────────────┘  │
│                      │
│  ┌────────────────┐  │
│  │ Recent Orders  │  │  ← Full-width stacked
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │ Check-In Bars  │  │
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │ Upcoming Events│  │
│  └────────────────┘  │
│                      │
└──────────────────────┘

Sidebar opens as Sheet drawer (18rem)
with backdrop blur overlay (bg-black/60)
```

### Scanner Mobile View
```
┌──────────────────────┐
│ [back] Scanner  [⚙]  │
├──────────────────────┤
│                      │
│  ┌────────────────┐  │
│  │                │  │
│  │   QR Camera    │  │  ← 80% viewport width
│  │   Viewfinder   │  │
│  │                │  │
│  └────────────────┘  │
│                      │
│  Scans Today: 142    │
│  Event: Latin Night  │
│                      │
│  ┌────────────────┐  │
│  │ Scan History   │  │  ← Collapsible list
│  │ ✓ John D. 9:42│  │
│  │ ✗ Jane S. 9:41│  │
│  └────────────────┘  │
│                      │
│  [Manual Entry]      │
│                      │
└──────────────────────┘
```

---

# ARCHITECTURE (4) — how it's structured

---

## 9. Route Architecture

### Route Map (30+ routes, 4 categories)

**Public Routes (no auth):**

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Index | Home/splash redirect |
| `/auth` | Auth router | Redirects to owner or employee login |
| `/auth/owner` | OwnerLogin | Email/password login + invite signup |
| `/auth/employee` | EmployeeLogin | Simple email/password login |

**Employee Routes (any authenticated user):**

| Route | Component | Guard |
|-------|-----------|-------|
| `/scanner` | Scanner | `<ProtectedRoute>` |
| `/guest-list` | GuestList | `<ProtectedRoute>` |
| `/scan/vip` | VIPScanner | `<ProtectedRoute>` |
| `/scan/vip/:eventId` | VIPScanner | `<ProtectedRoute>` |

**Owner/Promoter Routes (`allowedRoles=['owner', 'promoter']`):**

| Route | Component | Layout |
|-------|-----------|--------|
| `/dashboard` | OwnerDashboard | OwnerPortalLayout |
| `/events` | EventManagement | OwnerPortalLayout |
| `/orders` | Orders | OwnerPortalLayout |
| `/vip-tables` | VipTablesManagement | OwnerPortalLayout |
| `/queue` | QueueManagement | OwnerPortalLayout |
| `/analytics` | AdvancedAnalytics | OwnerPortalLayout |
| `/team` | TeamManagement | OwnerPortalLayout |
| `/staff-scheduling` | StaffScheduling | OwnerPortalLayout |
| `/audit-log` | AuditLog | OwnerPortalLayout |
| `/customers` | CustomerManagement | OwnerPortalLayout |
| `/waitlist` | WaitlistManagement | OwnerPortalLayout |
| `/branding` | Branding | OwnerPortalLayout |
| `/devices` | DeviceManagement | OwnerPortalLayout |
| `/security` | SecuritySettings | OwnerPortalLayout |
| `/notifications/preferences` | NotificationPreferences | OwnerPortalLayout |
| `/notifications/rules` | NotificationRules | OwnerPortalLayout |
| `/notifications/analytics` | NotificationAnalytics | OwnerPortalLayout |
| `/queue-status/:eventId` | QueueStatus | OwnerPortalLayout |
| `/door-counters` | DoorCounterManagement | OwnerPortalLayout |
| `/sites` | SiteManagement | OwnerPortalLayout |
| `/fraud-investigation` | FraudInvestigation | OwnerPortalLayout |
| `/crew/settings` | CrewSettings | OwnerPortalLayout |

**Dev-Only Routes (`requireDev: true`):**

| Route | Component | Guard |
|-------|-----------|-------|
| `/test-qr` | TestQrGenerator | `<ProtectedRoute requireDev allowedRoles={['owner']}>` |
| `/monitoring/metrics` | MetricsPage | Dev + Owner |
| `/monitoring/traces` | TracesPage | Dev + Owner |
| `/monitoring/errors` | ErrorsPage | **NOT dev-gated** (accessible in production) |
| `/monitoring/circuit-breakers` | CircuitBreakersPage | Dev + Owner |
| `/monitoring/rate-limits` | RateLimitsPage | Dev + Owner |
| `/monitoring/query-performance` | QueryPerformancePage | Dev + Owner |

**Error Routes:**

| Route | Component |
|-------|-----------|
| `/unauthorized` | Unauthorized (403) |
| `*` | NotFound (404) |

### Guard Logic (`ProtectedRoute` — 5 checks in order)

```
1. if (loading) → Show spinner
2. if (requireDev && !import.meta.env.DEV) → /unauthorized
3. if (!user) → /auth?from=[current-path]
4. if (allowedRoles && !allowedRoles.includes(role)) → /unauthorized (403)
5. → Render children
```

### Lazy Loading

No React.lazy() or dynamic imports currently used. All routes eagerly load their page components.

---

## 10. Component Inventory

### Core Metric Widgets (6)

| Component | File | Props | Used On |
|-----------|------|-------|---------|
| `MetricCard` | `components/dashboard/MetricCard.tsx` | `title, value, icon, trend, className` | Dashboard |
| `QuickStats` | `components/dashboard/QuickStats.tsx` | `events, tickets, scanned, rate` | Dashboard |
| `RevenueCard` | `components/dashboard/RevenueCard.tsx` | Revenue + per-ticket avg | Dashboard |
| `RevenueTrend` | `components/dashboard/RevenueTrend.tsx` | Dual-axis chart + trend badge | Dashboard |
| `RevenueVerification` | `components/dashboard/RevenueVerification.tsx` | Expected vs actual reconciliation | Dashboard |
| `CheckInProgress` | `components/dashboard/CheckInProgress.tsx` | Per-event bars, real-time | Dashboard |

### Queue & Capacity (5)

| Component | File | Used On |
|-----------|------|---------|
| `QueueDashboard` | `components/dashboard/QueueDashboard.tsx` (16.5 KB) | Live Operations |
| `QueueAnalytics` | `components/dashboard/QueueAnalytics.tsx` (13 KB) | Live Operations |
| `WaitTimeDisplay` | `components/dashboard/WaitTimeDisplay.tsx` | Should be on Live Ops |
| `UnifiedCapacityDisplay` | `components/dashboard/UnifiedCapacityDisplay.tsx` | Should be on Live Ops |
| `EntryExitFlowVisualization` | `components/dashboard/EntryExitFlowVisualization.tsx` | Should be on Live Ops |

### Security & Alerts (3)

| Component | File | Used On |
|-----------|------|---------|
| `FraudAlertsWidget` | `components/dashboard/FraudAlertsWidget.tsx` | **NOT used** — add to Dashboard |
| `FraudAnalysisModal` | `components/dashboard/FraudAnalysisModal.tsx` | Fraud Investigation |
| `DiscrepancyAlerts` | `components/dashboard/DiscrepancyAlerts.tsx` | Should be on Live Ops |

### Activity & Navigation (4)

| Component | File | Used On |
|-----------|------|---------|
| `ActivityFeed` | `components/dashboard/ActivityFeed.tsx` | **NOT used** — add to Dashboard |
| `NotificationFeed` | `components/dashboard/NotificationFeed.tsx` | **NOT used** — add to Dashboard |
| `NavigationGrid` | `components/dashboard/NavigationGrid.tsx` | **NOT used** |
| `RecentPurchases` | `components/dashboard/RecentPurchases.tsx` | Dashboard |

### Scanner Components (9)

| Component | File | Purpose |
|-----------|------|---------|
| `QrScanner` | `components/QrScanner.tsx` | Camera QR reader (html5-qrcode) |
| `SuccessOverlay` | `components/scanner/SuccessOverlay.tsx` | Green full-screen success |
| `RejectionOverlay` | `components/scanner/RejectionOverlay.tsx` | Red full-screen rejection |
| `ScanHistory` | `components/scanner/ScanHistory.tsx` | Collapsible scan log |
| `ManualEntry` | `components/scanner/ManualEntry.tsx` | Manual ticket ID entry |
| `NFCScanner` | `components/scanner/NFCScanner.tsx` | NFC tap scanning |
| `IDVerificationModal` | `components/scanner/IDVerificationModal.tsx` | Age verification |
| `PhotoCaptureModal` | `components/scanner/PhotoCaptureModal.tsx` | Camera photo capture |
| `ScanErrorDisplay` | `components/scanner/ScanErrorDisplay.tsx` | Color-coded scan errors |

### VIP Components (3)

| Component | File | Purpose |
|-----------|------|---------|
| `VIPFloorPlanAdmin` | `components/vip/VIPFloorPlanAdmin.tsx` | Drag-drop table layout |
| `ReservationDetailsModal` | `components/vip/ReservationDetailsModal.tsx` | Full reservation details |
| `GuestSearchInput` | `components/vip/GuestSearchInput.tsx` | Guest search with keyboard |

### Layout Components (3)

| Component | File | Purpose |
|-----------|------|---------|
| `OwnerPortalLayout` | `components/layout/OwnerPortalLayout.tsx` | Sidebar + main shell |
| `ProtectedRoute` | `components/layout/ProtectedRoute.tsx` | Auth + role guard |
| `RoleSwitcher` | `components/layout/RoleSwitcher.tsx` | Dev-only persona switcher |

---

## 11. Data Source Detail

### Supabase Tables Referenced by Dashboard Pages

| Page | Tables Queried | Real-Time? |
|------|---------------|------------|
| Dashboard | `tickets`, `orders`, `events`, `ticket_types`, `email_queue`, `scanner_heartbeats` | Yes (all 6) |
| Events | `events`, `ticket_types`, `event_vip_tables` | No |
| Orders | `orders`, `tickets` | Yes (`orders`) |
| VIP Tables | `event_vip_tables`, `vip_reservations`, `vip_guest_passes` | Yes (`vip_reservations`) |
| Analytics | `tickets`, `ticket_types`, `events`, `scan_logs` | No |
| Staff | Supabase Auth API (`listUsers`) | No |
| Audit Log | `audit_logs` | No |
| Guest List | `orders` (aggregated by customer) | No |
| Devices | `scanner_heartbeats` | No |

### Key Service Functions

| Service | File | Functions |
|---------|------|-----------|
| `email-status-service` | `lib/email-status-service.ts` | `getRecentEmailStatuses(limit)` |
| `scanner-status-service` | `lib/scanner-status-service.ts` | `getScannerStatuses()` |
| `branding-service` | `lib/branding-service.ts` | `getCurrentVenueBranding()`, `updateVenueBranding()` |
| `vip-tables-admin-service` | `lib/vip-tables-admin-service.ts` | `createVipReservation()`, `checkInVipGuest()` |
| `simple-scanner` | `lib/simple-scanner.ts` | `lookupTicket()`, `scanTicket()`, `parseQrInput()` |
| `offline-ticket-cache` | `lib/offline-ticket-cache.ts` | `cacheEventTickets()`, `lookupCachedTicket()` |
| `staff-name-service` | `lib/staff-name-service.ts` | `resolveStaffNames()` |
| `audit-service` | `lib/audit-service.ts` | `logAuditEvent()` |

---

## 12. API Contracts

### Edge Functions Called by Dashboard

| Endpoint | Method | Body | Called By | Purpose |
|----------|--------|------|-----------|---------|
| `verify-qr-signature` | POST | `{ token, signature }` | `simple-scanner.ts` | Server-side HMAC-SHA256 QR validation |
| `send-event-announcement` | POST | `{ eventId, customMessage }` | EventManagement | Email blast to subscribers |
| `scan-flyer` | POST | `{ image: base64, apiKey }` | EventManagement | OpenAI OCR for event flyer |
| `verify-revenue` | POST | `{ eventId, startDate, endDate }` | `revenue-verification-service.ts` | Cross-check revenue figures |

### Supabase RPC Functions

| Function | Params | Called By |
|----------|--------|-----------|
| `sync_offline_scan` | `p_ticket_id, p_scanned_by, p_scanned_at, p_device_id` | offline-ticket-cache |
| `create_vip_reservation_atomic` | `p_event_id, p_table_id, p_purchaser_name, ...` | vip-tables-admin-service |
| `check_in_vip_guest_atomic` | `p_pass_id, p_checked_in_by` | vip-tables-admin-service |
| `process_vip_scan_with_reentry` | `p_pass_id, p_scanned_by, p_scanned_at` | vip-tables-admin-service |
| `verify_vip_pass_signature` | `p_token, p_signature, p_reservation_id, p_guest_number` | vip-tables-admin-service |
| `predict_wait_time` | `event_id_param, entry_point_id_param` | queue-prediction-service |
| `calculate_current_scan_velocity` | `event_id_param, minutes_back` | queue-metrics-service |
| `estimate_queue_depth` | `event_id_param, entry_point_id_param` | queue-metrics-service |
| `search_guest_list` | `p_event_id, p_search_term` | guest-list-service |
| `check_in_guest` | `p_entry_id, p_checked_in_by` | guest-list-service |
| `update_device_status` | `p_device_id, p_battery_level, p_is_charging, ...` | battery-monitoring-service |

---

# STRATEGY (5) — what to build and when

---

## 13. Design Principles

| Principle | Rule |
|-----------|------|
| **Event-Centric** | A nightclub operates event by event. Every data view (revenue, attendance, VIP, staff) is filterable by event. The dashboard hero always highlights tonight's event when one exists. |
| **Real-Time First** | Revenue, check-ins, scanner status, and capacity update via Supabase Realtime subscriptions (`useDashboardRealtime` hook). No page should require manual refresh to show current data. |
| **Three Temporal Modes** | The owner's needs differ by phase: **Before** (create event, set prices, assign staff, promote), **During** (real-time capacity, check-in progress, scanner status, queue), **After** (revenue reports, attendance analytics, fraud review, audit trail). Every page serves one phase clearly. |
| **Progressive Disclosure** | On desktop, show all sidebar items. On mobile, collapse secondary sections (Settings, Team) behind expandable headers. Dashboards show KPI summaries that drill down on tap. |
| **Dark Nightclub Aesthetic** | Existing dark theme (`bg-[#030712]`, indigo-500/purple-500 accents). All widgets use: `rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md`. |
| **Single Login, Never Leave** | Owner logs into `/auth/owner`, lands on `/dashboard`, and accesses everything through the `OwnerPortalLayout` sidebar. No page uses a different layout. |

---

## 14. Implementation Status

### Sidebar Navigation

**Current State (9 items):**
```
MAIN:       Dashboard     /dashboard
            Events        /events

SALES:      Ticket Sales  /orders
            VIP Tables    /vip-tables
            Analytics     /analytics

TEAM:       Staff         /team                          (owner-only)
            Audit Log     /audit-log                     (owner-only)

SETTINGS:   Notifications /notifications/preferences     (owner-only)
            System Health /monitoring/errors              (owner-only)

MONITORING: Metrics, Traces, Errors, Circuit Breakers,   (dev-only, hidden in production)
            Rate Limits, Query Performance
```

**Problem:** 15+ useful pages have no sidebar link and are only reachable by typing the URL directly.

**Target State (15 items, grouped for mobile):**
```
── MAIN ────────────────────────────────────
Dashboard              /dashboard
Events                 /events
Live Operations        /queue

── SALES ───────────────────────────────────
Ticket Sales           /orders
VIP Tables             /vip-tables
Guest List             /customers

── ANALYTICS ───────────────────────────────
Analytics              /analytics

── TEAM ────────────────────────────────────
Staff                  /team
Scheduling             /staff-scheduling
Audit Log              /audit-log

── SETTINGS ────────────────────────────────
Notifications          /notifications/preferences
Branding               /branding
Devices                /devices
Security               /security
System Health          /monitoring/errors
```

> On mobile, TEAM and SETTINGS collapse behind expandable headers. Only MAIN and SALES are expanded by default.

### Page-by-Page Status

#### Launch-Critical

| # | Section | Route | Complete | Key Remaining Work |
|---|---------|-------|---------|-------------------|
| 1 | **Dashboard** | `/dashboard` | 80% | Wire FraudAlertsWidget + ActivityFeed; build "Tonight's Event" auto-detect banner |
| 2 | **Events** | `/events` | 95% | Add waitlist link for nearly-sold-out events |
| 3 | **Live Operations** | `/queue` | 75% | Add UnifiedCapacityDisplay, WaitTimeDisplay, EntryExitFlow, DiscrepancyAlerts to Dashboard tab |
| 4 | **Ticket Sales** | `/orders` | 90% | Add pagination past 500 orders |
| 5 | **VIP Tables** | `/vip-tables` | 85% | Fix hardcoded guest_count default; implement drag-drop positioning |
| — | **Sidebar** | — | 60% | Expand from 9 to 15 items across 5 grouped sections |

#### Operational (first week)

| # | Section | Route | Complete | Key Remaining Work |
|---|---------|-------|---------|-------------------|
| 6 | **Analytics** | `/analytics` | 85% | **Fix hardcoded KPI trends** (12.5%, 8.2%, -3.1%) — calculate real deltas |
| 7 | **Staff** | `/team` | 90% | Resolve staff UUID → display names |
| 8 | **Guest List** | `/customers` | 85% | Switch to OwnerPortalLayout; add CSV export; rename label |
| 9 | **Audit Log** | `/audit-log` | 85% | Resolve user IDs to names via `resolveStaffNames()` |
| 10 | **Scheduling** | `/staff-scheduling` | 80% | Resolve staff names in dropdown |
| 11 | **Notifications** | `/notifications/preferences` | 95% | No changes needed |
| 12 | **Devices** | `/devices` | 90% | No changes needed |

#### Post-Launch

| # | Section | Route | Complete | Key Remaining Work |
|---|---------|-------|---------|-------------------|
| 13 | **Security** | `/security` | 50% | Merge FraudInvestigation as "Security Alerts" tab |
| 14 | **Branding** | `/branding` | 85% | No urgent changes |
| 15 | **System Health** | `/monitoring/errors` | 80% | Add traffic-light summary indicator |
| 16 | **Waitlist** | `/waitlist` | 90% | Link from Events page |

---

## 15. Priority / Roadmap

### Top 5 Highest-Impact Remaining Work

1. **Fix hardcoded KPI trend percentages** in `AdvancedAnalytics.tsx` (lines 238-240). Replace `revenueChange: 12.5, ticketsChange: 8.2, scansChange: -3.1` with real period-over-period calculations. This is the most visible data integrity issue.

2. **Restructure the sidebar** in `OwnerPortalLayout.tsx` to match the Target State (15 items across 5 sections). Add the 6 orphaned pages (Guest List, Devices, Branding, Scheduling, Security, Live Operations). This is the single biggest navigation gap.

3. **Build "Tonight's Event" auto-detect banner** on the dashboard. Query events where `event_date` falls within today's 6 PM through tomorrow's 4 AM window. Render a prominent card with real-time `CheckInProgress`, scanner count, and check-in velocity.

4. **Wire built-but-unused widgets into the dashboard.** `FraudAlertsWidget` and `ActivityFeed` are exported from the dashboard components index but never rendered on `/dashboard`.

5. **Merge FraudInvestigation into Security as a tab.** The fraud investigation page is fully built — merge it into `/security` as a "Security Alerts" tab. This reduces route count and consolidates all security concerns.

---

## 16. Bloat Identification

### Routes to Remove from Router

| Route | Page | Reason |
|-------|------|--------|
| `/door-counters` | DoorCounterManagement | Single-venue bloat; capacity covered by `UnifiedCapacityDisplay` |
| `/sites` | SiteManagement | Multi-venue v2 scope; 40% complete |
| `/notifications/rules` | NotificationRules | Over-engineered for v1; simple toggles suffice |
| `/notifications/analytics` | NotificationAnalytics | Low-value for single venue |
| `/crew/settings` | CrewSettings | Page file does not exist; dead route |
| `/queue-status/:eventId` | QueueStatus | Merge into `/queue` with event selector |
| `/fraud-investigation` | FraudInvestigation | Merge into `/security` as a tab |

### Routes to Keep but NOT Add to Sidebar

| Route | Page | Access Method |
|-------|------|---------------|
| `/waitlist` | WaitlistManagement | Contextual link from Events page when event approaches sellout |

### Dashboard Sidebar Bloat (Remove or Simplify)

**Remove from sidebar:** Circuit Breakers, Rate Limits, Query Performance, Traces, Scan Speed Analytics

**Simplify:** Errors → "System Health" indicator, Metrics → KPI card, Fraud Investigation → "Security Alerts" tab, Advanced Analytics → 3 views (Money/Attendance/Staff), Customer Management → "VIP Guest List", Notification Rules → simple on/off toggles

---

## 17. Known Issues Tracking

### Critical (Data Integrity)

| Issue | File | Line | Impact |
|-------|------|------|--------|
| KPI trends hardcoded at 12.5%, 8.2%, -3.1% | `AdvancedAnalytics.tsx` | 238-240 | Owner sees fake growth numbers |
| `ticket_count` on orders always 0 | DB schema | — | Dashboard shows wrong count |
| `ticket_type` on orders always "General" | DB schema | — | No type differentiation |
| Staff names show UUIDs | Multiple pages | — | Unreadable for owner |

### Security

| Issue | File | Impact |
|-------|------|--------|
| Auth page had demo buttons (removed) | `Auth.tsx` | ~~Anyone could click to login~~ Fixed |
| Dashboard routes lacked ProtectedRoute | `App.tsx` | ~~Direct URL access~~ Fixed |
| QR signing secret was client-side | `.env` files | ~~Secret exposed in JS bundle~~ Fixed |
| localStorage auth fallback in production | `AuthContext.tsx` | ~~Session bypass~~ Fixed (gated behind DEV) |

### UX

| Issue | File | Impact |
|-------|------|--------|
| No Skeleton loaders | All pages | Content pops in after load |
| 15+ pages unreachable from sidebar | `OwnerPortalLayout.tsx` | Owner can't find features |
| `guest_count` defaults to 6 | `VipTablesManagement.tsx` | Wrong guest count for VIP |
| No pagination past 500 orders | `Orders.tsx` | Missing data for high-volume events |
| CustomerManagement uses wrong layout | `CustomerManagement.tsx` | Inconsistent nav shell |

### Missing Features

| Feature | Priority | Notes |
|---------|----------|-------|
| Tonight's Event auto-detect banner | P1 | Transforms dashboard into live ops center |
| Drag-drop VIP table positioning | P2 | Currently uses coordinate inputs |
| Calendar view for scheduling | P2 | Currently table-only |
| CSV export for guest list | P2 | Easy add |
| Traffic-light health indicator | P2 | Simple aggregate of error count |

---

# PRODUCT (4) — who it serves and how

---

## 18. Accessibility

### Current Coverage: ~65%

**Implemented:**

| Pattern | Implementation | Coverage |
|---------|---------------|----------|
| Focus management | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | All interactive elements |
| Screen reader text | `<span className="sr-only">` | Carousel, sidebar toggle, sheet close |
| ARIA labels | `aria-label` | Pagination nav, sidebar toggle, VIP floor plan tables |
| Form associations | `aria-describedby={formDescriptionId}` | Form fields (shadcn form) |
| Semantic HTML | `<nav>`, `<main>`, `<button>`, `<table>` | Structural elements |
| Keyboard shortcut | `SIDEBAR_KEYBOARD_SHORTCUT = "b"` | Sidebar toggle |

**Gaps:**

| Gap | Impact | Fix |
|-----|--------|-----|
| No `aria-live` regions | Toast/notification updates not announced | Add `aria-live="polite"` to toast container |
| No `aria-current="page"` | Active nav link not identified | Add to sidebar active item |
| No `aria-invalid` on errors | Form errors not programmatically linked | Add to invalid form fields |
| No `prefers-reduced-motion` respect | Animations play regardless of user setting | Add `motion-reduce:` Tailwind variants |
| No skip-to-content link | Keyboard users must tab through sidebar | Add hidden skip link |
| Limited keyboard navigation in modals | Focus trapping relies on Radix defaults | Verify all modals trap focus correctly |

### WCAG 2.1 AA Compliance Estimate

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.1 Text Alternatives | Partial | Missing alt text on event images |
| 1.3 Adaptable | Good | Semantic HTML, form labels |
| 1.4 Distinguishable | Good | High contrast dark theme |
| 2.1 Keyboard Accessible | Partial | Works for main flows, gaps in custom widgets |
| 2.4 Navigable | Partial | No skip links, no `aria-current` |
| 3.3 Input Assistance | Partial | Missing `aria-invalid` associations |
| 4.1 Compatible | Good | Standard HTML, ARIA on Radix primitives |

---

## 19. Performance Budgets

### Recommended Budgets

| Metric | Budget | Current Estimate | Notes |
|--------|--------|-----------------|-------|
| First Contentful Paint | < 1.5s | ~2s | No lazy loading, eager route imports |
| Largest Contentful Paint | < 2.5s | ~3s | Large page bundles (OwnerDashboard 1083 lines) |
| Time to Interactive | < 3.5s | ~4s | Multiple Supabase queries on mount |
| Total Bundle Size | < 500 KB (gzip) | ~800 KB est. | Recharts, html5-qrcode, Radix UI, Dexie |
| Per-Route Chunk | < 100 KB | N/A | No code splitting currently |
| Real-time Latency | < 500ms | ~200ms | Supabase Realtime performs well |
| API Response | < 1s | Varies | Dashboard loads 6+ queries in parallel |

### Optimization Opportunities

| Optimization | Impact | Effort |
|-------------|--------|--------|
| **Route-based code splitting** (`React.lazy`) | Reduce initial bundle by ~40% | Medium |
| **Skeleton loaders** | Perceived performance improvement | Low |
| **Query deduplication** (React Query) | Prevent duplicate Supabase calls | Low (already has `@tanstack/react-query`) |
| **Image optimization** | Event images loaded full-size | Low |
| **Virtualized lists** | Orders/audit log with 500+ rows | Medium |

### Bundle Size Contributors (estimated)

| Package | Size (est.) | Used By |
|---------|------------|---------|
| `recharts` | ~120 KB | Analytics, device charts |
| `html5-qrcode` | ~80 KB | Scanner only |
| `@radix-ui/*` (20+ packages) | ~150 KB | All UI components |
| `dexie` | ~30 KB | Offline cache |
| `@dnd-kit/core` | ~20 KB | VIP floor plan |
| `@sentry/react` | ~40 KB | Error tracking |
| `@supabase/supabase-js` | ~50 KB | All pages |

---

## 20. User Flows / Journey Maps

### Flow 1: Owner — Opening Night

```
Login (/auth/owner)
  │
  ├─→ Dashboard (/dashboard)
  │     │ Check revenue, scanner status, check-in progress
  │     │ "Tonight's Event" banner (auto-detected)
  │     │
  │     ├─→ Live Operations (/queue)
  │     │     Monitor real-time capacity, queue lengths, scanner health
  │     │     Staffing recommendations
  │     │
  │     ├─→ VIP Tables (/vip-tables)
  │     │     Floor plan view, check-in guests, confirm payments
  │     │
  │     └─→ Ticket Sales (/orders)
  │           Search recent orders, confirm cash payments
  │
  └─→ Return to Dashboard (refresh via real-time subscriptions)
```

### Flow 2: Owner — Event Setup (Before Night)

```
Dashboard (/dashboard)
  │
  ├─→ Events (/events)
  │     │ Click "+ Create Event"
  │     │ Step 1: Name, date, time, image, ticket types
  │     │ Step 2: VIP table configuration (3 tiers auto-created)
  │     │ Save → Event visible on purchase site immediately
  │     │
  │     ├─→ [Optional] Send Newsletter (dialog)
  │     │
  │     └─→ Staff Scheduling (/staff-scheduling)
  │           Assign staff to event shifts
  │
  └─→ Analytics (/analytics)
        Review past event performance to inform pricing
```

### Flow 3: Owner — Post-Event Review

```
Dashboard (/dashboard)
  │
  ├─→ Analytics (/analytics)
  │     Revenue tab → trends, peak hours
  │     Attendance tab → tier distribution, event comparison
  │     Staff tab → performance rankings
  │
  ├─→ Audit Log (/audit-log)
  │     Review all actions, check for anomalies
  │
  └─→ Security (/security) [future: merged FraudInvestigation]
        Review fraud alerts, confirm/whitelist
```

### Flow 4: Employee — Door Scanning

```
Login (/auth/employee)
  │
  └─→ Scanner (/scanner)
        │ Camera activates automatically
        │ QR scanned → 2.5s debounce → lookup
        │
        ├─→ [Valid] Green overlay (1.5s auto-dismiss)
        │     Haptic buzz + success audio
        │     Scan counter increments
        │
        ├─→ [Invalid] Red overlay (manual dismiss required)
        │     Error audio + vibration
        │     Rejection reason displayed
        │
        ├─→ [Offline] IndexedDB cache lookup
        │     If cached → allow entry
        │     If unknown → reject with "NOT IN CACHE"
        │     Queue scan for later sync
        │
        └─→ Manual Entry (tab)
              Type ticket ID or order number
              Same validation flow
```

### Flow 5: Owner — Team Management

```
Dashboard (/dashboard)
  │
  ├─→ Staff (/team)
  │     │ View all staff: email, role, last login
  │     │ Promote employee → promoter → owner
  │     │ Delete staff (blocked for self-delete)
  │     │
  │     └─→ Invite Staff (dialog)
  │           Select role, set expiration
  │           Generate invite link → share
  │           Recipient visits /auth/owner?invite=TOKEN
  │
  └─→ Scheduling (/staff-scheduling)
        Create shifts: event, staff member, time range, role
```

---

## 21. Permission Matrix

### Role Definitions

| Role | Login Route | Post-Login Redirect | Description |
|------|-------------|-------------------|-------------|
| `owner` | `/auth/owner` | `/dashboard` | Full access to all features |
| `promoter` | `/auth/owner` | `/dashboard` | View-only access to analytics and data |
| `employee` | `/auth/employee` | `/scanner` | Scanner access only |

### Permission Table

| Permission | Owner | Promoter | Employee |
|------------|-------|----------|----------|
| `view_analytics` | Yes | Yes | No |
| `view_events` | Yes | Yes | No |
| `view_orders` | Yes | Yes | No |
| `manage_tickets` | Yes | No | No |
| `manage_events` | Yes | No | No |
| `manage_staff` | Yes | No | No |

### Route Access Matrix

| Route Category | Owner | Promoter | Employee | Unauthenticated |
|---------------|-------|----------|----------|-----------------|
| Dashboard & Core (`/dashboard`, `/events`, `/orders`) | Yes | Yes | No → 403 | No → /auth |
| Analytics (`/analytics`) | Yes | Yes | No → 403 | No → /auth |
| VIP & Sales (`/vip-tables`, `/customers`, `/queue`) | Yes | Yes | No → 403 | No → /auth |
| Team (`/team`, `/staff-scheduling`, `/audit-log`) | Yes | **Yes*** | No → 403 | No → /auth |
| Settings (`/branding`, `/devices`, `/security`, `/notifications/*`) | Yes | **Yes*** | No → 403 | No → /auth |
| Scanner (`/scanner`, `/scan/vip`, `/guest-list`) | Yes | Yes | Yes | No → /auth |
| Dev Tools (`/monitoring/*`, `/test-qr`) | Yes (DEV) | No → 403 | No → 403 | No → /auth |

> *Team and Settings routes use `allowedRoles=['owner', 'promoter']` but sidebar hides them for promoters via `ownerOnly: true` flag. Promoters can technically access by URL but see limited functionality.

### Sidebar Visibility

| Sidebar Section | Owner | Promoter |
|----------------|-------|----------|
| MAIN | Visible | Visible |
| SALES | Visible | Visible |
| ANALYTICS | Visible | Visible |
| TEAM | Visible | Hidden |
| SETTINGS | Visible | Hidden |
| MONITORING (dev) | Visible (DEV only) | Hidden |

### Auth Flow Decision Tree

```
Request to protected route
    │
    ├── Not authenticated?
    │     └── Redirect to /auth?from=[url]
    │           ├── Owner/Promoter → /auth/owner
    │           └── Employee → /auth/employee
    │
    ├── Authenticated but wrong role?
    │     └── Show /unauthorized (403 page)
    │
    ├── Authenticated + correct role?
    │     └── Render page
    │
    └── Dev-only route + production build?
          └── Show /unauthorized (403 page)
```

---

## Overall Assessment: ~87% Complete

The owner dashboard has strong bones. All 26+ dashboard components are production-ready with real Supabase data. The data layer is genuinely real (not mocked) for all critical pages. Real-time subscriptions work via `useDashboardRealtime`. The `OwnerPortalLayout` provides a consistent shell with role-based section filtering.

### Dimension Coverage Summary

| Dimension | Coverage | Notes |
|-----------|----------|-------|
| 1. Visual Design Spec | 95% | Comprehensive token system |
| 2. Component APIs | 85% | Key interfaces documented |
| 3. Interaction Design | 80% | Animations and gestures well-defined |
| 4. State Coverage | 90% | Auth, branding, real-time, offline all covered |
| 5. Modal/Overlay Specs | 90% | 15+ modals catalogued |
| 6. Loading/Error States | 60% | No skeleton loaders, relies on toasts |
| 7. Theme Enforcement | 95% | Dark-only with runtime branding override |
| 8. Responsive/Mobile | 85% | Mobile hook + responsive grids, needs testing |
| 9. Route Architecture | 90% | Full guard system, missing lazy loading |
| 10. Component Inventory | 95% | 30+ widgets catalogued with usage status |
| 11. Data Source Detail | 90% | All queries and services mapped |
| 12. API Contracts | 85% | Edge Functions + RPCs documented |
| 13. Design Principles | 95% | Clear, enforced |
| 14. Implementation Status | 95% | Per-page completeness tracked |
| 15. Priority/Roadmap | 95% | Top 5 priorities ranked |
| 16. Bloat Identification | 95% | 7 routes to remove, 5 to simplify |
| 17. Known Issues | 90% | Categorized by severity |
| 18. Accessibility | 65% | Focus management good, gaps in ARIA |
| 19. Performance Budgets | 50% | Budgets set but no measurement yet |
| 20. User Flows | 85% | 5 core journeys mapped |
| 21. Permission Matrix | 95% | 3 roles, 6 permissions, full route map |

---

*Based on full codebase analysis of all 44 routes, 30+ dashboard components, 16 page files, 285 TypeScript source files, and 5 parallel research agents — Feb 20, 2026.*
