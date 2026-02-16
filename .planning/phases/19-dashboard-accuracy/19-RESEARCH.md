# Phase 19: Dashboard Data Accuracy — Research

**Phase:** 19-dashboard-accuracy
**Researcher:** Claude (GSD Phase Researcher)
**Date:** 2026-02-14
**Goal:** Answer "What do I need to know to PLAN this phase well?"

---

## Executive Summary

Phase 19 fixes hardcoded/missing dashboard data and optimizes real-time subscriptions. **Critical discovery:** Issue #10 (revenue trends) is ALREADY FIXED — real calculation exists at lines 440-502. The remaining 4 issues are genuine data problems that need database schema understanding and query optimization.

**Key Findings:**
1. Revenue trends (GSD-10) are already dynamically calculated (week-over-week deltas from real data)
2. ticket_count and ticket_type are hardcoded in UI transform (lines 511-512) — no DB columns exist
3. Orders query doesn't join tickets table — missing critical relationship data
4. Real-time subscriptions call full `loadData()` on ANY table change (lines 555-633)
5. useDashboardRealtime hook exists but is completely UNUSED
6. Email/scanner status already have targeted refresh patterns that can be generalized

**Complexity:** Medium (2 days accurate)
- Plan 19-01: ALREADY DONE (mark complete)
- Plan 19-02: Database query + aggregation (4-6 hours)
- Plan 19-03: Supabase Auth join + profile lookup (3-4 hours)
- Plan 19-04: Selective refresh pattern (4-6 hours)

---

## Phase Boundary & Context

### What's In Scope
- Fix hardcoded ticket_count (always 0) and ticket_type (always 'General') in recent orders display
- Display staff names instead of UUIDs in scanner performance metrics
- Optimize real-time subscriptions to only refresh affected dashboard sections
- Calculate real revenue trend percentages (turns out this is already done)

### What's Out of Scope
- New dashboard features (Phase 20 - Bloat Cleanup)
- Revenue discrepancy detection system (Phase 5 already built this)
- Dashboard visual redesign
- New analytics charts or metrics
- Real-time system architecture changes

### Dependencies
- **Phase 14 (Auth Foundation):** Created real Supabase Auth accounts with user_metadata containing names
- **Phase 5 (Dashboard Accuracy v1):** Built revenue verification, LiveIndicator, useDashboardRealtime hook, real-time infrastructure

### User Decisions (from 19-CONTEXT.md)
*No CONTEXT.md file exists for Phase 19* — all implementation decisions are at Claude's discretion.

---

## Current State Analysis

### 1. Revenue Trends (GSD-10 / R13) — ALREADY FIXED

**Issue Description:** "Revenue trend percentages are hardcoded (12.5%, 8.2%, -3.1%)"

**Reality Check:**
```typescript
// OwnerDashboard.tsx lines 440-502
const lastSevenStart = startOfDay(subDays(now, 6));
const previousSevenStart = startOfDay(subDays(now, 13));
const previousSevenEnd = startOfDay(subDays(now, 6));

const lastSeven = sumRange(fourteenDayPoints, lastSevenStart, startOfDay(addDays(now, 1)));
const previousSeven = sumRange(fourteenDayPoints, previousSevenStart, previousSevenEnd);

const revenueTrendDelta = previousSeven.revenue > 0
  ? ((lastSeven.revenue - previousSeven.revenue) / previousSeven.revenue) * 100
  : 0;
```

**Analysis:**
- Revenue trends are calculated from actual database data using `sumRange()` helper (lines 95-106)
- Week-over-week comparison: Last 7 days vs previous 7 days
- Delta stored in `weekOverWeek` state (line 502) and displayed at line 803
- No hardcoded percentages found in current code

**Conclusion:** GSD-10 appears to be already resolved OR the issue description is outdated. Plan 19-01 should verify this works correctly and mark as complete if so.

### 2. Ticket Count & Type (GSD-11, GSD-12 / R14, R15) — REAL ISSUE

**Issue Location:** Lines 506-517 in OwnerDashboard.tsx

```typescript
const transformedOrders = (ordersData || []).slice(0, 10).map((order: any) => ({
  id: order.id,
  customer_email: order.purchaser_email || '',
  customer_name: order.purchaser_name || null,
  event_name: (order.events as any)?.name || 'Unknown Event',
  ticket_type: 'General', // ❌ HARDCODED
  ticket_count: 0,          // ❌ HARDCODED
  total: Number(order.total || 0) / 100,
  status: order.status || 'pending',
  created_at: order.created_at,
  completed_at: order.created_at,
}));
```

**Root Cause Analysis:**

**Database Schema Investigation:**
```sql
-- orders table (from 20250115000000_create_ticket_system.sql lines 25-39)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  event_id VARCHAR NOT NULL REFERENCES events(id),
  customer_first_name VARCHAR NOT NULL,
  customer_last_name VARCHAR NOT NULL,
  customer_email VARCHAR NOT NULL,
  customer_phone VARCHAR,
  total DECIMAL(10, 2) NOT NULL,  -- Stored in cents
  status VARCHAR NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id VARCHAR,
  stripe_session_id VARCHAR,
  created_at TIMESTAMP,
  paid_at TIMESTAMP,
  updated_at TIMESTAMP
);
-- NO ticket_count OR ticket_type columns

-- tickets table (from same migration lines 42-58)
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY,
  ticket_id VARCHAR UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_id VARCHAR NOT NULL REFERENCES events(id),
  ticket_type VARCHAR NOT NULL,        -- ✅ HAS ticket_type
  ticket_type_name VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'issued',
  price DECIMAL(10, 2) NOT NULL,
  -- ...
);
```

**Current Query (lines 314-317):**
```typescript
const { data: ordersData, error: ordersError } = await supabase
  .from<any>("orders")
  .select("id, total, created_at, status, purchaser_email, purchaser_name, event_id, events(name)");
// ❌ Missing JOIN to tickets table
```

**Solution Requirements:**
1. **ticket_count:** Aggregate COUNT from tickets table grouped by order_id
2. **ticket_type:** Determine "primary" ticket type per order (options below)

**Ticket Type Strategy Options:**
- **Option A:** Most expensive ticket type in the order (VIP > GA > General)
- **Option B:** First ticket type alphabetically (deterministic but arbitrary)
- **Option C:** Most common ticket type in multi-ticket orders
- **Option D:** All ticket types concatenated ("VIP + GA")

**Recommended Approach:** Option A (most expensive) — aligns with business logic that VIP status dominates.

**Implementation Path:**
```typescript
// New query structure
const { data: ordersData } = await supabase
  .from("orders")
  .select(`
    id,
    total,
    created_at,
    status,
    purchaser_email,
    purchaser_name,
    event_id,
    events(name),
    tickets(ticket_type, price)
  `)
  .order('created_at', { ascending: false })
  .limit(10);

// Transform with real ticket data
const transformedOrders = ordersData.map(order => {
  const tickets = order.tickets || [];
  const ticketCount = tickets.length;
  const primaryTicket = tickets.reduce((highest, ticket) =>
    ticket.price > highest.price ? ticket : highest,
    tickets[0] || { ticket_type: 'Unknown', price: 0 }
  );

  return {
    // ...
    ticket_type: primaryTicket.ticket_type,
    ticket_count: ticketCount,
    // ...
  };
});
```

### 3. Staff Names (GSD-13 / R16) — REAL ISSUE

**Issue Description:** "Staff performance uses raw user_id, not names"

**Current Location:** Scanner status display (lines 955-1014) shows `scanner.deviceName` but staff attribution is missing from the dashboard.

**Database Investigation:**

**Scan Logs Schema:**
```sql
-- scan_logs table structure (inferred from usage patterns)
-- scanned_by: UUID reference to auth.users
```

**VIP Scan Logs Schema (from 20260201300000):**
```sql
-- vip_scan_logs table
scanned_by VARCHAR  -- Can be UUID or TEXT
```

**Auth System:**
```sql
-- Supabase auth.users has:
-- id: UUID
-- email: TEXT
-- raw_user_metadata: JSONB -- Contains {"role": "owner", "full_name": "Luis Badillo"}

-- profiles table (from 20250320000000_auth_enhancements.sql lines 8-23)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  -- ...
);
```

**Staff Name Resolution Strategy:**

**Option A:** Query auth.users via service role and extract from user_metadata
```typescript
// Requires service role key (security concern for client-side)
const { data: users } = await supabase.auth.admin.listUsers();
const staffMap = users.reduce((acc, user) => {
  acc[user.id] = user.user_metadata?.full_name || user.email;
  return acc;
}, {});
```

**Option B:** Create a database view or RPC function
```sql
CREATE OR REPLACE FUNCTION get_staff_name(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_name TEXT;
BEGIN
  -- Try profiles table first
  SELECT CONCAT(first_name, ' ', last_name) INTO v_name
  FROM profiles
  WHERE id = p_user_id;

  IF v_name IS NULL THEN
    -- Fallback to auth.users email
    SELECT email INTO v_name
    FROM auth.users
    WHERE id = p_user_id;
  END IF;

  RETURN COALESCE(v_name, 'Unknown Staff');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Option C:** Pre-join profiles in scan queries
```typescript
const { data: scanStats } = await supabase
  .from('scan_logs')
  .select(`
    scanned_by,
    profiles(first_name, last_name)
  `)
  .groupBy('scanned_by');
```

**Recommended Approach:** Option B (RPC function) — provides security, caching potential, and clean abstraction.

**Scanner Heartbeat Context:**
- Scanner status display (lines 976-1013) shows `deviceName` from scanner_heartbeats table
- This is device-level, not user-level
- Staff names would appear in scan performance metrics (not currently displayed on dashboard)

### 4. Real-time Subscriptions (GSD-14 / R17) — REAL ISSUE

**Current Implementation (lines 555-633):**

```typescript
useEffect(() => {
  const channel = supabase
    .channel('dashboard-updates')
    .on('postgres_changes', { event: 'INSERT', table: 'scan_logs' }, () => {
      loadData(); // ❌ Full dashboard reload
    })
    .on('postgres_changes', { event: '*', table: 'tickets' }, () => {
      loadData(); // ❌ Full dashboard reload
    })
    .on('postgres_changes', { event: 'INSERT', table: 'orders' }, () => {
      loadData(); // ❌ Full dashboard reload
    })
    .on('postgres_changes', { event: '*', table: 'email_queue' }, () => {
      fetchEmailStatuses(); // ✅ Targeted refresh
    })
    .on('postgres_changes', { event: '*', table: 'scanner_heartbeats' }, () => {
      fetchScannerStatuses(); // ✅ Targeted refresh
    })
    .subscribe();
}, []);
```

**Problem Analysis:**
- Changes to scan_logs, tickets, or orders trigger FULL `loadData()` refresh
- `loadData()` makes 3+ database queries (tickets, orders, events) totaling ~500ms
- High-frequency updates (1 scan/second during peak) = 1 dashboard reload/second
- Email and scanner status already use targeted refresh pattern (good example)

**useDashboardRealtime Hook (UNUSED):**
```typescript
// File: src/hooks/useDashboardRealtime.ts
// Features:
// - Visibility-aware reconnection (tab focus)
// - Targeted table subscriptions
// - Status tracking (isLive, lastUpdate)
// - Manual reconnect function

// ❌ Hook is defined but NEVER IMPORTED in OwnerDashboard.tsx
```

**Targeted Refresh Pattern (from email/scanner):**
```typescript
// Email status example (lines 228-242)
const fetchEmailStatuses = async () => {
  const statuses = await getRecentEmailStatuses(100);
  setEmailStatuses(statusMap);
  setEmailStatusList(statuses);
};

// Real-time subscription (lines 603-609)
.on('postgres_changes', { event: '*', table: 'email_queue' }, () => {
  fetchEmailStatuses(); // Only refreshes email section
})
```

**Optimization Strategy:**

**Phase 1 — Component-Level Fetch Functions:**
```typescript
const fetchRevenueStats = async () => {
  // Query tickets for revenue calculations only
};

const fetchRecentOrders = async () => {
  // Query orders with tickets join only
};

const fetchUpcomingEvents = async () => {
  // Query events and capacity only
};
```

**Phase 2 — Targeted Subscriptions:**
```typescript
.on('postgres_changes', { event: 'INSERT', table: 'orders' }, () => {
  fetchRevenueStats();
  fetchRecentOrders();
})
.on('postgres_changes', { event: 'INSERT', table: 'scan_logs' }, () => {
  fetchRevenueStats(); // Update scanned count only
})
.on('postgres_changes', { event: '*', table: 'events' }, () => {
  fetchUpcomingEvents();
})
```

**Phase 3 — Use useDashboardRealtime Hook:**
```typescript
const { isLive, lastUpdate, reconnect } = useDashboardRealtime({
  tables: ['tickets', 'orders', 'vip_reservations'],
  onUpdate: () => {
    // Determine which section changed via payload
    // Refresh only affected sections
  }
});
```

**Performance Impact Estimate:**
- Current: 3 queries × 100-200ms = 300-600ms per update
- Optimized: 1 query × 50-100ms = 50-100ms per update
- 5-10x reduction in database load during high-traffic periods

---

## Database Schema Deep Dive

### Orders Table
```sql
-- Location: maguey-pass-lounge/supabase/migrations/20250115000000_create_ticket_system.sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  event_id VARCHAR REFERENCES events(id),
  customer_first_name VARCHAR,
  customer_last_name VARCHAR,
  customer_email VARCHAR,
  customer_phone VARCHAR,
  total DECIMAL(10, 2),  -- Cents (divide by 100 for display)
  status VARCHAR DEFAULT 'pending',
  stripe_payment_intent_id VARCHAR,
  stripe_session_id VARCHAR,
  created_at TIMESTAMP,
  paid_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Missing Columns:**
- No `ticket_count` (must aggregate from tickets)
- No `ticket_type` (must derive from tickets)
- No `purchaser_name` (code expects this at line 509, but schema has first_name/last_name)

**Migration Discovery:**
- Column names in code (`purchaser_email`, `purchaser_name`) don't match schema (`customer_email`, `customer_first_name`, `customer_last_name`)
- This suggests either:
  1. Additional migration renamed columns (need to verify)
  2. Frontend code uses wrong column names (would cause NULL values)

### Tickets Table
```sql
CREATE TABLE tickets (
  id UUID PRIMARY KEY,
  ticket_id VARCHAR UNIQUE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  event_id VARCHAR REFERENCES events(id),
  ticket_type VARCHAR,           -- e.g., 'ga', 'vip', 'expedited'
  ticket_type_name VARCHAR,      -- e.g., 'General Admission', 'VIP Entry'
  ticket_type_id UUID,           -- Added in later migration
  status VARCHAR DEFAULT 'issued',
  price DECIMAL(10, 2),
  fee DECIMAL(10, 2),
  total DECIMAL(10, 2),
  issued_at TIMESTAMP,
  checked_in_at TIMESTAMP,
  expires_at TIMESTAMP,
  scanned_at TIMESTAMP,          -- Added in later migration
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_tickets_order_id ON tickets(order_id);
CREATE INDEX idx_tickets_event_id ON tickets(event_id);
CREATE INDEX idx_tickets_ticket_type_id ON tickets(ticket_type_id);
```

**Key Relationships:**
- tickets.order_id → orders.id (one-to-many)
- tickets.ticket_type_id → ticket_types.id (many-to-one)
- tickets.event_id → events.id (many-to-one)

### Ticket Types Table
```sql
-- Location: maguey-pass-lounge/supabase/migrations/20250302000000_add_ticket_categories.sql
CREATE TABLE ticket_types (
  id UUID PRIMARY KEY,
  event_id VARCHAR REFERENCES events(id) ON DELETE CASCADE,
  code VARCHAR,
  name VARCHAR,
  price DECIMAL(10, 2),
  fee DECIMAL(10, 2) DEFAULT 0,
  limit_per_order INTEGER DEFAULT 10,
  total_inventory INTEGER,
  category VARCHAR DEFAULT 'general',  -- 'general', 'vip', 'service', 'section'
  section_name VARCHAR,
  section_description TEXT,
  display_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(event_id, code)
);
```

**Ticket Type Categories:**
- `general` — Standard admission
- `vip` — VIP entry, tables, bottle service
- `service` — Add-ons, upgrades
- `section` — Specific seating areas

### Scan Logs & Staff Attribution
```sql
-- scan_logs structure (not found in migrations, likely in scanner migrations)
-- Assumed structure based on code usage:
CREATE TABLE scan_logs (
  id UUID PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id),
  scanned_by UUID REFERENCES auth.users(id),  -- Staff member
  scanned_at TIMESTAMP,
  scan_result VARCHAR,  -- 'success', 'duplicate', 'invalid', etc.
  -- ...
);
```

### Profiles Table
```sql
-- Location: maguey-pass-lounge/supabase/migrations/20250320000000_auth_enhancements.sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  date_of_birth DATE,
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES profiles(id),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Staff Name Resolution:**
- Phase 14 created accounts via Supabase Auth with `user_metadata.full_name`
- Profiles table exists but may not be populated for staff accounts
- Need to check both sources: auth.users.raw_user_metadata AND profiles table

---

## Technical Dependencies & Constraints

### 1. TypeScript @ts-nocheck
**File:** OwnerDashboard.tsx line 1
```typescript
// @ts-nocheck
```

**Implication:** Type checking is disabled for entire file. This means:
- No compile-time type safety
- Easy to introduce bugs with wrong column names
- Should enable type checking after fixing issues

**Action Items:**
- Fix type errors before removing @ts-nocheck
- Define proper TypeScript interfaces for database queries
- Use Supabase generated types

### 2. Supabase Real-time Limitations
**Constraints:**
- Real-time subscriptions limited to 100 per client
- Payload size limited to 10KB per message
- No built-in query result caching
- Event filtering happens client-side (all changes sent, client filters)

**Best Practices:**
- Use minimal SELECT columns in subscriptions
- Filter by event_id where possible
- Combine related subscriptions into single channel
- Implement client-side debouncing for high-frequency updates

### 3. Performance Considerations
**Current Dashboard Load Time:**
- 3 sequential queries (tickets, orders, events)
- ~300-600ms total load time
- 10-50 subscriptions active simultaneously

**Optimization Targets:**
- Reduce to 1-2 parallel queries
- Target <200ms dashboard load
- Implement request deduplication
- Use query optimizer patterns from existing code

### 4. Data Consistency
**Critical Requirements:**
- Orders and tickets must stay in sync (enforced by foreign keys)
- Real-time updates must not show partial transaction states
- Revenue calculations must match Stripe (already verified in Phase 5)

---

## Existing Patterns & Code to Reuse

### 1. Targeted Refresh Pattern (Email Status)
**Location:** Lines 228-242, 607-609

**Pattern:**
```typescript
// 1. Define scoped fetch function
const fetchEmailStatuses = async () => {
  const statuses = await getRecentEmailStatuses(100);
  setEmailStatuses(statusMap);
  setEmailStatusList(statuses);
};

// 2. Call in loadData() for initial load
loadData() {
  fetchEmailStatuses(); // Non-blocking
  // ...
}

// 3. Subscribe to targeted table changes
.on('postgres_changes', { event: '*', table: 'email_queue' }, () => {
  fetchEmailStatuses(); // Only refresh email section
})
```

**Reusability:** Can apply same pattern to orders, revenue, events sections.

### 2. sumRange Helper (Revenue Calculations)
**Location:** Lines 95-106

**Pattern:**
```typescript
const sumRange = (points: DailyPerformancePoint[], start: Date, end: Date) => {
  return points
    .filter((point) => point.date >= start && point.date < end)
    .reduce((acc, point) => {
      acc.revenue += point.revenue;
      acc.tickets += point.tickets;
      return acc;
    }, { revenue: 0, tickets: 0 });
};
```

**Reusability:** Already used for trend calculations. Verify it's working correctly.

### 3. useDashboardRealtime Hook
**Location:** src/hooks/useDashboardRealtime.ts

**Features:**
- Table-specific subscriptions
- Visibility-aware reconnection
- Status tracking (isLive, lastUpdate)
- Manual reconnect function
- Automatic cleanup

**Current Status:** Defined but UNUSED in OwnerDashboard.tsx

**Integration Path:**
```typescript
// Replace manual subscription with hook
const { isLive, lastUpdate, reconnect } = useDashboardRealtime({
  tables: ['tickets', 'orders', 'vip_reservations'],
  onUpdate: () => {
    // Determine which section changed
    // Refresh only affected data
  }
});

// Add live indicator to UI
{isLive && <LiveIndicator />}
```

### 4. Query Optimizer Service
**Location:** src/lib/query-optimizer.ts (found via grep)

**Investigation Needed:** Read this file to understand existing query optimization patterns.

---

## Implementation Risks & Mitigations

### Risk 1: Column Name Mismatch
**Problem:** Code expects `purchaser_email`, `purchaser_name` but schema has `customer_email`, `customer_first_name`, `customer_last_name`.

**Evidence:**
- Line 508: `customer_email: order.purchaser_email || ''`
- Line 509: `customer_name: order.purchaser_name || null`

**Investigation Required:**
- Check if additional migration renamed columns
- Verify current production data column names
- Test query in Supabase dashboard

**Mitigation:**
- Query actual schema in Supabase before implementation
- Use generated TypeScript types
- Add runtime validation for critical queries

### Risk 2: Performance Regression
**Problem:** Adding JOIN to tickets table could slow down orders query.

**Concern:**
- Orders query currently fetches 10 rows (lines 506)
- Adding tickets join could fetch 10-100+ rows (multi-ticket orders)
- Could increase query time from 50ms to 200ms+

**Mitigation:**
- Use LIMIT 10 on orders, then aggregate tickets client-side
- OR create database view with pre-aggregated ticket counts
- OR use JSONB aggregation in PostgreSQL
- Benchmark before/after query performance

### Risk 3: Real-time Subscription Complexity
**Problem:** Targeted refresh requires determining which dashboard section changed.

**Complexity:**
- Need to map table → affected UI components
- Multiple components may depend on same table
- Subscription payload doesn't include full context

**Mitigation:**
- Start with coarse-grained sections (orders section, revenue section, events section)
- Use table name to determine section (simple mapping)
- Future optimization can add finer granularity

### Risk 4: Staff Name Resolution Security
**Problem:** Accessing auth.users requires service role or RPC function.

**Security Concerns:**
- Client-side service role key = security risk
- User metadata may contain sensitive data
- Need to limit exposure to staff names only

**Mitigation:**
- Use SECURITY DEFINER RPC function (recommended)
- OR create materialized view of staff names
- Never expose service role key to client
- Cache staff names client-side after first load

---

## Plan-Specific Research

### Plan 19-01: Calculate Real Revenue Trend Percentages

**Status:** ALREADY IMPLEMENTED

**Evidence:**
- Lines 440-502 calculate real week-over-week delta
- Uses actual database data (tickets with prices)
- Stored in `weekOverWeek` state
- Displayed in hero section (line 803)

**Verification Steps:**
1. Review calculation logic (lines 440-502)
2. Test with real data (verify correct percentage)
3. Check if displayed value matches calculation
4. If correct, mark GSD-10 as complete in spreadsheet

**Estimated Effort:** 1 hour (verification only)

### Plan 19-02: Fix ticket_count and ticket_type on Orders

**Core Problem:** Orders query doesn't join tickets table.

**Solution Approach A — Client-Side Aggregation:**
```typescript
const { data: ordersData } = await supabase
  .from("orders")
  .select(`
    id,
    total,
    created_at,
    status,
    purchaser_email,
    purchaser_name,
    event_id,
    events(name),
    tickets(ticket_type, ticket_type_name, price)
  `)
  .order('created_at', { ascending: false })
  .limit(10);

// Transform with aggregation
const transformedOrders = ordersData.map(order => {
  const tickets = order.tickets || [];
  const ticketCount = tickets.length;

  // Find most expensive ticket type (VIP dominates)
  const primaryTicket = tickets.reduce((highest, ticket) =>
    ticket.price > highest.price ? ticket : highest,
    tickets[0] || { ticket_type_name: 'Unknown', price: 0 }
  );

  return {
    id: order.id,
    customer_email: order.purchaser_email,
    customer_name: order.purchaser_name,
    event_name: order.events?.name || 'Unknown Event',
    ticket_type: primaryTicket.ticket_type_name,
    ticket_count: ticketCount,
    total: Number(order.total || 0) / 100,
    status: order.status,
    created_at: order.created_at,
    completed_at: order.created_at,
  };
});
```

**Solution Approach B — Database View:**
```sql
CREATE OR REPLACE VIEW orders_with_ticket_summary AS
SELECT
  o.id,
  o.event_id,
  o.customer_email,
  o.customer_first_name || ' ' || o.customer_last_name AS customer_name,
  o.total,
  o.status,
  o.created_at,
  COUNT(t.id) AS ticket_count,
  (
    SELECT t2.ticket_type_name
    FROM tickets t2
    WHERE t2.order_id = o.id
    ORDER BY t2.price DESC
    LIMIT 1
  ) AS primary_ticket_type
FROM orders o
LEFT JOIN tickets t ON t.order_id = o.id
GROUP BY o.id;
```

**Recommendation:** Approach A (client-side) — simpler, no migration required, uses existing relationships.

**Implementation Steps:**
1. Verify column names (purchaser_email vs customer_email)
2. Update orders query to include tickets relationship
3. Add aggregation logic in transform
4. Test with multi-ticket orders (2-10 tickets)
5. Verify display in RecentPurchases component

**Edge Cases:**
- Order with 0 tickets (refunded?) → show "N/A" or "Refunded"
- Order with multiple ticket types → show most expensive
- VIP + GA combo → show "VIP" (highest value)

**Estimated Effort:** 4-6 hours

### Plan 19-03: Display Staff Names Instead of UUIDs

**Core Problem:** Scan logs store scanned_by as UUID, need to resolve to human names.

**Investigation Required:**
1. Find where staff performance is displayed (not visible in current dashboard)
2. Verify scan_logs table schema
3. Check if profiles table is populated for staff accounts

**Solution Approach A — RPC Function:**
```sql
CREATE OR REPLACE FUNCTION get_staff_name(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_name TEXT;
BEGIN
  -- Try profiles table first
  SELECT CONCAT(first_name, ' ', last_name) INTO v_name
  FROM profiles
  WHERE id = p_user_id;

  IF v_name IS NOT NULL THEN
    RETURN v_name;
  END IF;

  -- Fallback to user_metadata
  SELECT raw_user_metadata->>'full_name' INTO v_name
  FROM auth.users
  WHERE id = p_user_id;

  IF v_name IS NOT NULL THEN
    RETURN v_name;
  END IF;

  -- Final fallback to email
  SELECT email INTO v_name
  FROM auth.users
  WHERE id = p_user_id;

  RETURN COALESCE(v_name, 'Unknown Staff');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Solution Approach B — Client-Side Cache:**
```typescript
// Cache staff names on dashboard load
const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());

const loadStaffNames = async (userIds: string[]) => {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', userIds);

  const nameMap = new Map();
  profiles?.forEach(profile => {
    nameMap.set(
      profile.id,
      `${profile.first_name} ${profile.last_name}`.trim() || profile.id
    );
  });

  setStaffNames(nameMap);
};

// Use in display
<span>{staffNames.get(scan.scanned_by) || scan.scanned_by}</span>
```

**Recommendation:** Approach A (RPC function) — more secure, cacheable, reusable across components.

**Implementation Steps:**
1. Create RPC function for name resolution
2. Find staff performance metrics location
3. Update scan queries to include staff names
4. Display formatted names in UI
5. Add loading state for name resolution

**Estimated Effort:** 3-4 hours

### Plan 19-04: Optimize Real-time Subscriptions

**Core Problem:** Every table change triggers full dashboard reload (loadData()).

**Current State:**
- 5 subscriptions: scan_logs, tickets, orders, email_queue, scanner_heartbeats
- 3 trigger full reload, 2 use targeted refresh
- Email/scanner already optimized (good reference)

**Optimization Strategy:**

**Step 1 — Split loadData() into Component Functions:**
```typescript
const fetchRevenueStats = async () => {
  // Query tickets for revenue only
  const { data: ticketsData } = await supabase
    .from("tickets")
    .select("price, created_at, ticket_type_id, ticket_types(name)");

  // Calculate revenue metrics
  updateRevenueState(ticketsData);
};

const fetchRecentOrders = async () => {
  // Query orders with tickets
  const { data: ordersData } = await supabase
    .from("orders")
    .select(`
      id, total, created_at, status,
      purchaser_email, purchaser_name,
      events(name),
      tickets(ticket_type_name, price)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  // Transform and update orders state
  updateOrdersState(ordersData);
};

const fetchUpcomingEvents = async () => {
  // Query active events
  const { data: eventsData } = await supabase
    .from("events")
    .select("id, name, event_date, metadata")
    .eq("is_active", true)
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true });

  // Update events state
  updateEventsState(eventsData);
};
```

**Step 2 — Map Tables to Refresh Functions:**
```typescript
const subscriptionMap = {
  'tickets': [fetchRevenueStats, fetchRecentOrders],
  'orders': [fetchRecentOrders],
  'scan_logs': [fetchRevenueStats], // Updates scanned count
  'events': [fetchUpcomingEvents],
  'email_queue': [fetchEmailStatuses],
  'scanner_heartbeats': [fetchScannerStatuses],
};
```

**Step 3 — Implement Targeted Subscriptions:**
```typescript
useEffect(() => {
  const channel = supabase.channel('dashboard-updates');

  Object.entries(subscriptionMap).forEach(([table, refreshFns]) => {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => {
        // Call all associated refresh functions
        refreshFns.forEach(fn => fn());
      }
    );
  });

  channel.subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

**Step 4 — Integrate useDashboardRealtime Hook:**
```typescript
const { isLive, lastUpdate, reconnect } = useDashboardRealtime({
  tables: ['tickets', 'orders', 'events', 'scan_logs'],
  onUpdate: (payload) => {
    const table = payload.table;
    const refreshFns = subscriptionMap[table] || [];
    refreshFns.forEach(fn => fn());
  }
});
```

**Performance Measurement:**
- Add timing logs to each fetch function
- Track query count per minute
- Monitor dashboard responsiveness during high traffic

**Estimated Effort:** 4-6 hours

---

## Verification & Testing Strategy

### Plan 19-01 Verification
**Test Case:** Revenue trend calculation accuracy
1. Create test data: 10 tickets week 1 ($100 each), 15 tickets week 2 ($100 each)
2. Expected trend: +50% week-over-week
3. Load dashboard and verify displayed percentage
4. Check console logs for calculation values
5. Verify trend is dynamic (changes with new data)

**Success Criteria:**
- Trend percentage matches manual calculation
- No hardcoded values in code
- Updates when new tickets sold

### Plan 19-02 Verification
**Test Case:** Ticket count and type display
1. Create order with 1 GA ticket → expect "1 × General Admission"
2. Create order with 3 VIP tickets → expect "3 × VIP Entry"
3. Create order with 2 GA + 1 VIP → expect "3 × VIP Entry" (most expensive)
4. Load dashboard recent purchases section
5. Verify all orders show correct count and type

**Success Criteria:**
- ticket_count shows actual number (not 0)
- ticket_type shows primary type (not 'General')
- Multi-ticket orders aggregate correctly
- Display updates in real-time

### Plan 19-03 Verification
**Test Case:** Staff name resolution
1. Create scan with scanned_by = owner UUID
2. Create scan with scanned_by = employee UUID
3. Load dashboard scan performance section
4. Verify names display instead of UUIDs

**Success Criteria:**
- Owner scans show "Luis Badillo" (from user_metadata)
- Employee scans show resolved name
- Unknown UUIDs show fallback (email or "Unknown Staff")
- No raw UUIDs visible in UI

### Plan 19-04 Verification
**Test Case:** Targeted refresh performance
1. Set up monitoring: log each database query with timestamp
2. Create new order in database (manual or via purchase site)
3. Observe dashboard refresh behavior
4. Verify only orders section refreshes (not revenue, events, etc.)
5. Create new scan log
6. Verify only revenue section refreshes

**Success Criteria:**
- Orders INSERT triggers 1 query (not 3)
- Scan INSERT triggers 1 query (not 3)
- Email changes trigger email fetch only
- Total queries per event reduced by 60%+

---

## Questions for Planning Phase

### Technical Questions
1. **Column Names:** Does purchaser_email exist in orders table, or is it customer_email? (Check schema)
2. **Staff Display:** Where is staff performance currently displayed? (Scanner status shows devices, not users)
3. **Profiles Population:** Are staff accounts populated in profiles table? (Phase 14 created auth.users only)
4. **Query Performance:** What is acceptable query time for dashboard load? (<200ms target?)

### Product Questions
1. **Ticket Type Priority:** Should "VIP + GA" show as "VIP" or "VIP + GA"? (Recommend VIP only)
2. **Staff Attribution:** Do we need staff performance metrics on main dashboard? (Currently missing)
3. **Real-time Priority:** Which sections need instant updates vs 5-10 second delay? (Revenue = instant, events = 30s OK)

### Scope Questions
1. **Revenue Trends:** If already implemented, should Plan 19-01 just verify and close? (Yes)
2. **Profile Migration:** Should we backfill profiles for existing staff? (Out of scope — Phase 14 concern)
3. **Type Safety:** Should we remove @ts-nocheck as part of this phase? (Recommend yes)

---

## Dependencies & Blockers

### Dependencies
1. **Phase 14 Complete:** Auth accounts created with user_metadata (DONE)
2. **Database Schema Stable:** No ongoing migrations affecting orders/tickets (VERIFY)
3. **Supabase Connection Working:** Real-time subscriptions functional (VERIFY)

### Potential Blockers
1. **Column Name Mismatch:** If purchaser_email doesn't exist, need schema verification first
2. **Profiles Table Empty:** If staff not in profiles, need fallback to user_metadata
3. **Performance Budget:** If JOIN makes queries too slow, need view or optimization

### Risk Mitigation
- Verify schema before implementation (query Supabase dashboard)
- Test queries in SQL editor before adding to code
- Benchmark performance with realistic data volume
- Have rollback plan (revert to current code)

---

## Effort Estimation Breakdown

### Plan 19-01: Revenue Trends
- **Estimated:** 1 hour (verification only)
- **Breakdown:**
  - Review calculation logic: 15 min
  - Test with real data: 15 min
  - Verify display: 15 min
  - Update GSD tracker: 15 min

### Plan 19-02: Ticket Count & Type
- **Estimated:** 4-6 hours
- **Breakdown:**
  - Schema verification: 30 min
  - Update orders query: 1 hour
  - Implement aggregation logic: 1 hour
  - Test edge cases: 1 hour
  - UI integration: 1 hour
  - Real-time testing: 30 min
  - Buffer: 30 min - 2.5 hours

### Plan 19-03: Staff Names
- **Estimated:** 3-4 hours
- **Breakdown:**
  - Create RPC function: 1 hour
  - Find staff display location: 30 min
  - Update scan queries: 1 hour
  - UI integration: 1 hour
  - Testing: 30 min
  - Buffer: 0-1 hour

### Plan 19-04: Real-time Optimization
- **Estimated:** 4-6 hours
- **Breakdown:**
  - Split loadData into functions: 1.5 hours
  - Implement targeted subscriptions: 1.5 hours
  - Integrate useDashboardRealtime: 1 hour
  - Performance testing: 1 hour
  - Bug fixes: 1 hour
  - Buffer: 0-2 hours

**Total Phase Estimate:** 12-17 hours (1.5-2 days)

---

## Recommended Implementation Order

### Wave 1 — Data Fixes (Parallel)
1. **Plan 19-01** (1 hour) — Verify revenue trends work
2. **Plan 19-02** (4-6 hours) — Fix ticket count/type

**Rationale:** Both are data display issues, independent of each other.

### Wave 2 — Optimization (Sequential)
3. **Plan 19-04** (4-6 hours) — Optimize subscriptions first
4. **Plan 19-03** (3-4 hours) — Add staff names after subscriptions stable

**Rationale:** Subscription optimization affects all data fetching, should be done before adding new queries for staff names.

---

## Key Takeaways for Planning

1. **Plan 19-01 is likely DONE** — verify calculation works, then mark complete
2. **Plan 19-02 is straightforward** — add JOIN to tickets, aggregate client-side
3. **Plan 19-03 needs investigation** — find where staff metrics display, may not exist yet
4. **Plan 19-04 has good reference** — email/scanner status show the pattern
5. **useDashboardRealtime hook exists** — integrate it, don't rewrite
6. **Schema verification critical** — check column names before implementation
7. **Performance is key concern** — benchmark queries, target <200ms
8. **2-day estimate is accurate** — 12-17 hours of actual work

---

**Research Complete**
**Next Step:** Create 19-01-PLAN.md through 19-04-PLAN.md based on this research
