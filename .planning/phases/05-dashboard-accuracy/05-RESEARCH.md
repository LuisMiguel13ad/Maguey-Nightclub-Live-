# Phase 5: Dashboard Accuracy - Research

**Researched:** 2026-01-31
**Domain:** Real-time dashboard data accuracy, Stripe reconciliation, analytics visualization
**Confidence:** HIGH

## Summary

This phase focuses on ensuring the owner dashboard displays accurate real-time data across all metrics: revenue figures, ticket counts, VIP reservations, and event synchronization. The codebase already has substantial dashboard infrastructure including Recharts visualizations, Supabase real-time subscriptions, report export capabilities (CSV/PDF/Excel), and discrepancy detection patterns.

The primary challenge is **revenue reconciliation between the database and Stripe**. Currently, revenue is calculated from ticket prices stored in the database, but there's no verification against Stripe's authoritative payment records. The user decision requires showing both figures when discrepancies exist ("DB: $5,000 vs Stripe: $5,100").

**Primary recommendation:** Create a Supabase Edge Function that queries Stripe's Balance Transactions API on dashboard load to compare against database totals, logging discrepancies to a `revenue_discrepancies` audit table for transparency.

## Standard Stack

The codebase already uses established libraries for this domain.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 2.15.4 | Charts and graphs | Already used extensively in Dashboard.tsx, OwnerDashboard.tsx |
| @supabase/supabase-js | 2.78.0 | Real-time subscriptions | postgres_changes already implemented throughout codebase |
| jsPDF | 3.0.3 / 2.5.2 | PDF export | Already in report-service.ts with working implementation |
| xlsx | 0.18.5 | Excel export | Already in report-service.ts for revenue reports |
| date-fns | 3.6.0 | Date formatting/manipulation | Already used throughout dashboard components |
| stripe | 20.0.0 | Server-side Stripe API | Already in Edge Functions for payment processing |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| html2canvas | 1.4.1 | HTML to canvas for PDF | Dashboard screenshot exports |
| papaparse | 5.5.3 | CSV parsing | Already available in gate-scanner |
| @tanstack/react-query | 5.83.0 | Server state caching | Already wrapping dashboard data fetching |

### No New Libraries Needed

All required functionality can be achieved with existing stack. The focus is on:
1. Adding Stripe verification to existing revenue calculations
2. Enhancing existing real-time subscriptions with reconnection handling
3. Extending existing export capabilities for new report types

## Architecture Patterns

### Existing Dashboard Structure
```
maguey-gate-scanner/src/
├── pages/
│   ├── Dashboard.tsx           # Analytics dashboard (scan stats, revenue)
│   ├── OwnerDashboard.tsx      # Owner overview (KPIs, insights)
│   ├── AdvancedAnalytics.tsx   # Deep analytics
├── components/
│   ├── dashboard/
│   │   ├── RecentPurchases.tsx # Recent order feed
│   │   ├── RevenueTrend.tsx    # Revenue chart component
│   └── ui/
│       └── chart.tsx           # Recharts wrapper (ChartContainer, etc.)
├── lib/
│   ├── analytics-service.ts    # Ticket/event analytics
│   └── report-service.ts       # CSV/PDF/Excel exports
```

### Pattern 1: Real-time Subscription with Reconnection
**What:** Supabase postgres_changes subscription with visibility-aware reconnection
**When to use:** All dashboard real-time updates
**Example:**
```typescript
// Source: Existing pattern from OwnerDashboard.tsx + Supabase best practices
useEffect(() => {
  let channel: RealtimeChannel | null = null;
  let lastUpdateTime = Date.now();

  const setupSubscription = () => {
    channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        lastUpdateTime = Date.now();
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        lastUpdateTime = Date.now();
        loadData();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsLive(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsLive(false);
          // Fetch any missed updates since lastUpdateTime
          loadData();
        }
      });
  };

  // Handle visibility changes (tab focus)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Reconnect and fetch missed updates
      if (channel) supabase.removeChannel(channel);
      setupSubscription();
      loadData(); // Catch up on any missed updates
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  setupSubscription();

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (channel) supabase.removeChannel(channel);
  };
}, []);
```

### Pattern 2: Revenue Reconciliation Service
**What:** Compare database revenue totals with Stripe balance transactions
**When to use:** Dashboard load, periodic verification
**Example:**
```typescript
// Edge Function: verify-revenue
import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

// Fetch balance transactions for a date range
const transactions = await stripe.balanceTransactions.list({
  created: { gte: startTimestamp, lte: endTimestamp },
  type: 'charge', // Only successful charges
  limit: 100,
});

// Sum gross amounts (amount field is in cents, positive for charges)
const stripeGrossRevenue = transactions.data
  .filter(t => t.amount > 0)
  .reduce((sum, t) => sum + t.amount, 0);

// Compare with database total (tickets.price + vip_reservations.amount_paid_cents)
// Log discrepancy if difference > threshold (e.g., $1)
```

### Pattern 3: Live Indicator Component
**What:** Visual indicator showing real-time connection status
**When to use:** All dashboard views
**Example:**
```typescript
// LiveIndicator.tsx
interface LiveIndicatorProps {
  isLive: boolean;
  lastUpdate?: Date;
}

export function LiveIndicator({ isLive, lastUpdate }: LiveIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={`relative flex h-2 w-2 ${isLive ? '' : 'opacity-50'}`}>
        {isLive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-green-500' : 'bg-gray-400'}`} />
      </span>
      <span className="text-xs text-muted-foreground">
        {isLive ? 'Live' : 'Reconnecting...'}
      </span>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Polling instead of subscriptions:** Already using postgres_changes; don't add setInterval polling
- **Calculating revenue client-side only:** Must verify against Stripe server-side
- **Full data reload on every change:** Use targeted updates where possible
- **Hiding discrepancies:** User decision requires transparency with dual-source display

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom canvas rendering | jsPDF (already in report-service.ts) | Multi-page, formatting, headers already solved |
| Excel export | Manual XLSX building | xlsx library (already installed) | Complex spreadsheet features handled |
| Real-time subscriptions | WebSocket management | Supabase RealtimeChannel | Reconnection, auth, filtering built-in |
| Currency formatting | Manual string formatting | Intl.NumberFormat (already used) | Locale-aware, proper rounding |
| Date range calculations | Manual date math | date-fns (already used) | Timezone handling, edge cases |
| Chart rendering | SVG/Canvas direct | Recharts (already used) | Responsive, tooltips, legends |

**Key insight:** The codebase already has working implementations of all these patterns. The task is extending and connecting them, not building from scratch.

## Common Pitfalls

### Pitfall 1: Supabase Subscription Memory Leaks
**What goes wrong:** Subscriptions not cleaned up on component unmount or route changes
**Why it happens:** Missing cleanup in useEffect, or creating multiple subscriptions
**How to avoid:** Always return cleanup function; use ref to track channel
**Warning signs:** Browser memory increasing over time, duplicate events firing
**Existing pattern:** See OwnerDashboard.tsx `realtimeChannelRef` usage

### Pitfall 2: Revenue Calculation Inconsistencies
**What goes wrong:** Different components show different revenue figures
**Why it happens:** Multiple calculation methods (some from tickets table, some from orders table)
**How to avoid:** Single source of truth function; document which total is shown (gross vs net)
**Warning signs:** Dashboard cards show different totals than detailed breakdowns
**User decision:** Show gross revenue (what customer paid), not net after fees

### Pitfall 3: Stripe API Rate Limits
**What goes wrong:** Dashboard fails to load during high traffic
**Why it happens:** Calling Stripe API on every dashboard load without caching
**How to avoid:** Cache Stripe data with 5-minute TTL; background refresh
**Warning signs:** 429 errors from Stripe, slow dashboard loads

### Pitfall 4: Real-time Subscription Gaps During Tab Background
**What goes wrong:** Data becomes stale when user switches tabs
**Why it happens:** Browser throttles WebSocket connections for background tabs
**How to avoid:** Re-fetch data on visibility change; track lastUpdateTime
**Warning signs:** User sees outdated data after returning to tab
**Source:** [Supabase GitHub Discussion #27513](https://github.com/orgs/supabase/discussions/27513)

### Pitfall 5: Recharts Performance with Large Datasets
**What goes wrong:** UI freezes when rendering many data points
**Why it happens:** SVG-based rendering creates DOM nodes for each point
**How to avoid:** Aggregate data (hourly for day view, daily for month); limit to <100 points
**Warning signs:** Laggy chart interactions, browser unresponsive
**Source:** [Recharts Performance Guide](https://recharts.github.io/en-US/guide/performance/)

### Pitfall 6: Export Blocking UI
**What goes wrong:** Dashboard freezes during large PDF/Excel exports
**Why it happens:** Synchronous file generation in main thread
**How to avoid:** Show loading state; consider Web Workers for large exports
**Warning signs:** UI unresponsive during export

## Code Examples

### Revenue Reconciliation Edge Function
```typescript
// supabase/functions/verify-revenue/index.ts
// Source: Stripe Balance Transactions API pattern
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { eventId, startDate, endDate } = await req.json();

  // 1. Get database revenue
  const { data: tickets } = await supabase
    .from('tickets')
    .select('price')
    .eq('event_id', eventId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { data: vipReservations } = await supabase
    .from('vip_reservations')
    .select('amount_paid_cents')
    .eq('event_id', eventId)
    .eq('status', 'confirmed');

  const dbTicketRevenue = tickets?.reduce((sum, t) => sum + (t.price || 0), 0) || 0;
  const dbVipRevenue = vipReservations?.reduce((sum, v) => sum + (v.amount_paid_cents / 100), 0) || 0;
  const dbTotalRevenue = dbTicketRevenue + dbVipRevenue;

  // 2. Get Stripe revenue (balance transactions are in cents)
  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

  let stripeRevenue = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const transactions = await stripe.balanceTransactions.list({
      created: { gte: startTimestamp, lte: endTimestamp },
      type: 'charge',
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    stripeRevenue += transactions.data.reduce((sum, t) => sum + t.amount, 0);
    hasMore = transactions.has_more;
    if (transactions.data.length > 0) {
      startingAfter = transactions.data[transactions.data.length - 1].id;
    }
  }

  const stripeRevenueFormatted = stripeRevenue / 100; // Convert cents to dollars
  const discrepancy = Math.abs(dbTotalRevenue - stripeRevenueFormatted);

  // 3. Log discrepancy if significant (> $1)
  if (discrepancy > 1) {
    await supabase.from('revenue_discrepancies').insert({
      event_id: eventId,
      db_revenue: dbTotalRevenue,
      stripe_revenue: stripeRevenueFormatted,
      discrepancy_amount: discrepancy,
      checked_at: new Date().toISOString(),
    });
  }

  return new Response(JSON.stringify({
    dbRevenue: dbTotalRevenue,
    stripeRevenue: stripeRevenueFormatted,
    hasDiscrepancy: discrepancy > 1,
    discrepancyAmount: discrepancy,
  }), { headers: { 'Content-Type': 'application/json' } });
});
```

### Dashboard Data Hook with Real-time
```typescript
// hooks/useDashboardData.ts
// Source: Pattern from existing OwnerDashboard.tsx enhanced with reconnection
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useDashboardData(eventId?: string) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const channelRef = useRef<RealtimeChannel | null>(null);

  const loadData = useCallback(async () => {
    // Fetch dashboard data
    const [ticketStats, vipStats, revenueVerification] = await Promise.all([
      fetchTicketStats(eventId),
      fetchVIPStats(eventId),
      verifyRevenue(eventId), // Call Edge Function
    ]);

    setData({ ticketStats, vipStats, revenueVerification });
    setLastUpdate(new Date());
  }, [eventId]);

  useEffect(() => {
    const setupSubscription = () => {
      channelRef.current = supabase
        .channel(`dashboard-${eventId || 'all'}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_reservations' }, loadData)
        .subscribe((status) => {
          setIsLive(status === 'SUBSCRIBED');
        });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }
        setupSubscription();
        loadData(); // Catch up on missed updates
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    loadData();
    setupSubscription();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [eventId, loadData]);

  return { data, isLive, lastUpdate, refresh: loadData };
}
```

### Time-granularity Auto-scaling for Charts
```typescript
// utils/chartGranularity.ts
// Source: User decision for auto-scaling time granularity
import { differenceInDays, differenceInHours, format, eachDayOfInterval, eachHourOfInterval } from 'date-fns';

export function getChartGranularity(startDate: Date, endDate: Date) {
  const daysDiff = differenceInDays(endDate, startDate);

  if (daysDiff <= 1) {
    // 24 hours or less: hourly granularity
    return {
      interval: 'hourly',
      format: (date: Date) => format(date, 'ha'), // "3PM"
      getIntervals: () => eachHourOfInterval({ start: startDate, end: endDate }),
    };
  } else if (daysDiff <= 14) {
    // 2 weeks or less: daily granularity
    return {
      interval: 'daily',
      format: (date: Date) => format(date, 'MMM d'), // "Jan 15"
      getIntervals: () => eachDayOfInterval({ start: startDate, end: endDate }),
    };
  } else {
    // More than 2 weeks: weekly granularity
    return {
      interval: 'weekly',
      format: (date: Date) => format(date, 'MMM d'), // Week starting date
      getIntervals: () => getWeekIntervals(startDate, endDate),
    };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for updates | Supabase postgres_changes | Already implemented | Real-time without polling overhead |
| Single revenue source | DB + Stripe verification | This phase | Transparency and accuracy |
| Manual CSV export | jsPDF + xlsx libraries | Already implemented | Professional reports |
| Static dashboard | Real-time subscriptions | Already implemented | Live data feel |

**Current in codebase:**
- Recharts 2.15.4 (current stable)
- Supabase realtime v2 (postgres_changes)
- jsPDF 3.0.3 (latest major)
- xlsx 0.18.5 (stable)

## Open Questions

1. **Stripe Balance Transactions Access**
   - What we know: Stripe API provides balance_transactions endpoint
   - What's unclear: Whether current Stripe API key has permission for this endpoint
   - Recommendation: Test in development; may need to request expanded API access

2. **Revenue Discrepancy Threshold**
   - What we know: Small discrepancies may occur due to timing
   - What's unclear: What threshold is acceptable before flagging
   - Recommendation: Start with $1 threshold; adjust based on feedback

3. **Event Sync Timing (30-second requirement)**
   - What we know: Events table uses postgres_changes subscriptions
   - What's unclear: Whether purchase site (maguey-pass-lounge) has real-time subscriptions set up
   - Recommendation: Verify both apps subscribe to events table changes

## Sources

### Primary (HIGH confidence)
- Existing codebase: `Dashboard.tsx`, `OwnerDashboard.tsx`, `report-service.ts`, `analytics-service.ts`
- [Stripe Balance Transactions API](https://docs.stripe.com/reports/payout-reconciliation) - Official documentation
- [Supabase Realtime Subscriptions](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes) - Official documentation

### Secondary (MEDIUM confidence)
- [Stripe Reporting and Reconciliation](https://docs.stripe.com/plan-integration/get-started/reporting-reconciliation) - Best practices
- [Supabase Reconnection Discussion](https://github.com/orgs/supabase/discussions/27513) - Community patterns
- [Recharts Performance Guide](https://recharts.github.io/en-US/guide/performance/) - Official performance documentation

### Tertiary (LOW confidence)
- WebSearch results for real-time dashboard patterns (2026) - General guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use in codebase
- Architecture: HIGH - Extending existing patterns with clear examples
- Pitfalls: HIGH - Based on codebase analysis + official documentation
- Stripe reconciliation: MEDIUM - API pattern clear but needs testing

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (30 days - stable technologies, no major changes expected)
