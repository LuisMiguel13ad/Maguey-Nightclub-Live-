# Phase 21: VIP & Events Polish - Research

**Researched:** 2026-02-15
**Domain:** UI/UX polish, drag-and-drop, Web APIs, SEO/structured data
**Confidence:** HIGH

## Summary

Phase 21 addresses 5 polish issues across VIP management, event fallbacks, and SEO. The primary technical domains are: (1) drag-and-drop positioning for VIP floor plans, (2) Web Share API integration for invite links, (3) cross-site sync extension for VIP tables, (4) dead code removal from marketing site, and (5) SEO metadata generation.

**Current State:**
- Floor plan uses Flexbox flow layout with `display_order` integer field, no x/y coordinates in DB
- `invite_code` field exists in DB but is always null, no share UI components exist
- `cross-site-sync.ts` syncs events only, not VIP tables (though both sites share same Supabase DB)
- Marketing site has 90-line hardcoded fallback events object that is never referenced
- robots.txt exists but lacks Sitemap directive, no sitemap.xml, no JSON-LD structured data

**Primary recommendation:** Use @dnd-kit/core for drag-drop (modern, maintained, 10kb), add DB migration for position_x/position_y columns, implement Web Share API with clipboard fallback, extend cross-site-sync with VIP table notification, delete dead code, use vite-plugin-sitemap + manual JSON-LD for SEO.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.1.0 | Drag-and-drop positioning | Modern, lightweight (10kb), accessible, maintained actively (vs deprecated react-beautiful-dnd) |
| @dnd-kit/sortable | ^8.0.0 | Sortable helpers for dnd-kit | Official companion for list/grid sorting |
| Web Share API | Native | Share invite links | Browser native, zero dependencies, mobile-first UX |
| Clipboard API | Native | Fallback for desktop sharing | navigator.clipboard.writeText() already used in codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-sitemap | ^0.7.1 | Generate sitemap.xml at build | Automatic route discovery from dist folder |
| @types/node | ^20.x | Node types for build scripts | TypeScript support for manual sitemap generation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core | react-beautiful-dnd | react-beautiful-dnd deprecated by Atlassian, no longer maintained, hello-pangea/dnd is community fork |
| @dnd-kit/core | pragmatic-drag-and-drop | Atlassian's new headless solution, smaller bundle but more verbose API, less React-idiomatic |
| Web Share API | Email/SMS links | More complex, requires backend, loses native share sheet UX |
| vite-plugin-sitemap | Manual XML generation | More control but requires maintaining route list manually |

**Installation:**
```bash
cd maguey-gate-scanner
npm install @dnd-kit/core @dnd-kit/sortable

cd maguey-nights
npm install -D vite-plugin-sitemap
```

## Architecture Patterns

### Recommended Project Structure
No new directories needed — all changes fit existing structure:
```
maguey-gate-scanner/src/
├── components/vip/VIPFloorPlanAdmin.tsx  # Add drag-drop, replace Flexbox with absolute positioning
├── lib/vip-tables-admin-service.ts       # Add updateTablePosition() function
├── lib/cross-site-sync.ts                # Add syncVipTables() function
└── pages/VipTablesManagement.tsx         # Add share button, Web Share API

maguey-nights/src/
├── pages/EventPage.tsx                   # Remove fallbackEvents object (lines 84-173)
├── data/events.ts                        # Delete entire file (unused)
└── pages/UpcomingEvents.tsx              # Already has graceful empty state (lines 96-145)

maguey-nights/
├── vite.config.ts                        # Add vite-plugin-sitemap
├── public/robots.txt                     # Add Sitemap directive
└── index.html                            # Add JSON-LD script tag
```

### Pattern 1: Drag-Drop with @dnd-kit/core

**What:** Coordinate-based absolute positioning with transform-based dragging
**When to use:** Floor plans, dashboards, visual editors requiring free-form positioning

**Example:**
```typescript
// Source: https://docs.dndkit.com/api-documentation/draggable
import { DndContext, useDraggable, DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

function DraggableTable({ table, position }: { table: EventVIPTable, position: { x: number, y: number } }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: table.id,
    data: { table }
  });

  const style = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    transform: CSS.Translate.toString(transform), // Use transform for performance
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TableButton table={table} />
    </div>
  );
}

function FloorPlan({ tables }: { tables: EventVIPTable[] }) {
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta } = event;
    const table = active.data.current?.table;

    // Calculate new position from delta
    const newX = table.position_x + delta.x;
    const newY = table.position_y + delta.y;

    // Update in database
    await vipTablesAdminService.updateTablePosition(table.id, { x: newX, y: newY });
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="relative w-full h-[800px]">
        {tables.map(table => (
          <DraggableTable
            key={table.id}
            table={table}
            position={{ x: table.position_x || 0, y: table.position_y || 0 }}
          />
        ))}
      </div>
    </DndContext>
  );
}
```

**Key points:**
- Use `transform: translate()` NOT `top/left` during drag for performance (avoids repaints)
- Store final positions as `position_x` and `position_y` in database after `onDragEnd`
- Coordinate system: top-left origin (0,0), x increases right, y increases down
- Collision detection not needed for floor plan (tables can overlap during drag)

### Pattern 2: Web Share API with Clipboard Fallback

**What:** Native share sheet on mobile, clipboard copy on desktop
**When to use:** Sharing URLs, text, or files with progressive enhancement

**Example:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
async function shareInviteLink(inviteCode: string, eventName: string) {
  const purchaseBaseUrl = import.meta.env.VITE_PURCHASE_SITE_URL ||
    (import.meta.env.DEV ? 'http://localhost:3016' : 'https://tickets.maguey.club');
  const url = `${purchaseBaseUrl}/checkout?event=${eventId}&vip=${inviteCode}`;

  const shareData = {
    title: `Join VIP Table - ${eventName}`,
    text: `You're invited to join my VIP table at ${eventName}!`,
    url: url
  };

  // Check if Web Share API is supported and can share
  if (navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      toast({ title: 'Shared successfully' });
    } catch (err) {
      // User cancelled share dialog — not an error
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
        fallbackToCopy(url); // Fallback on error
      }
    }
  } else {
    // Desktop or unsupported browser — copy to clipboard
    fallbackToCopy(url);
  }
}

async function fallbackToCopy(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast({ title: 'Link copied to clipboard', description: 'Share with your guests' });
  } catch (err) {
    // Final fallback: show link in modal for manual copy
    console.error('Clipboard write failed:', err);
    showManualCopyModal(url);
  }
}
```

**Key points:**
- `navigator.canShare()` checks browser support AND if data is shareable (HTTPS required)
- Web Share API requires user gesture (button click) — not available on page load
- `AbortError` means user dismissed share sheet — handle gracefully, no toast
- Clipboard API already used in codebase (VipTablesManagement.tsx line 883)

### Pattern 3: Cross-Site Sync Extension

**What:** Extend existing sync service with VIP table notifications
**When to use:** After VIP table create/update/delete operations

**Example:**
```typescript
// Source: existing cross-site-sync.ts pattern
export async function syncVipTables(eventId: string, action: 'create' | 'update' | 'delete'): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, syncedSites: [], failedSites: ["main", "purchase"], errors: ["Supabase not configured"] };
  }

  try {
    const { data: user } = await supabase.auth.getUser();

    // Log sync operation
    const { data: syncLog, error: logError } = await supabase
      .from("cross_site_sync_log")
      .insert({
        sync_type: "vip_tables",
        source_site: "scanner",
        target_sites: ["purchase"],
        status: "pending",
        synced_by: user?.user?.id || null,
      })
      .select()
      .single();

    if (logError) throw logError;

    // VIP tables are automatically synced via Supabase real-time subscriptions
    // This function mainly logs the sync operation and can trigger custom notifications
    const syncedSites = ["purchase"]; // Scanner is source, main site doesn't show VIP

    // Update sync log as successful
    await supabase
      .from("cross_site_sync_log")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        details: { event_id: eventId, action, synced_sites: syncedSites },
      })
      .eq("id", syncLog.id);

    return { success: true, syncedSites, failedSites: [] };
  } catch (error: any) {
    return { success: false, syncedSites: [], failedSites: ["purchase"], errors: [error.message] };
  }
}
```

**Key points:**
- VIP tables already sync automatically via Supabase real-time (shared DB)
- Explicit sync call is for **logging and notifications**, not actual data sync
- Call after VIP table CRUD operations in VipTablesManagement.tsx
- Uses existing `cross_site_sync_log` table schema

### Pattern 4: JSON-LD Structured Data for Events

**What:** Schema.org Event markup in JSON-LD format for search engines
**When to use:** Event detail pages, event listings (improves Google Search rich results)

**Example:**
```typescript
// Source: https://schema.org/Event + https://developers.google.com/search/docs/appearance/structured-data/event
function EventJsonLd({ event }: { event: EventDisplay }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    "name": event.name,
    "description": event.description,
    "image": event.image_url,
    "startDate": `${event.event_date}T${event.event_time}`,
    "endDate": event.end_date ? `${event.end_date}T${event.end_time}` : undefined,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "location": {
      "@type": "Place",
      "name": event.venue_name || "Maguey Nightclub",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "3320 Old Capitol Trail",
        "addressLocality": "Wilmington",
        "addressRegion": "DE",
        "postalCode": "19808",
        "addressCountry": "US"
      }
    },
    "offers": {
      "@type": "Offer",
      "url": `https://tickets.magueynightclub.com/events/${event.id}`,
      "price": event.min_ticket_price,
      "priceCurrency": "USD",
      "availability": event.tickets_available > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      "validFrom": new Date().toISOString()
    },
    "performer": {
      "@type": "MusicGroup",
      "name": event.artist
    },
    "organizer": {
      "@type": "Organization",
      "name": "Maguey Nightclub",
      "url": "https://magueynightclub.com"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

// Usage in EventPage.tsx:
<Helmet>
  <EventJsonLd event={event} />
</Helmet>
```

**Key points:**
- Use `MusicEvent` type for nightclub events (subtype of Event)
- `eventStatus` and `eventAttendanceMode` are required by Google
- Include `offers` with price and availability for rich search results
- Place script tag in `<head>` via React Helmet or append to index.html for static markup

### Pattern 5: Vite Sitemap Generation

**What:** Automatic sitemap.xml generation from build output
**When to use:** Static sites, SPAs with known routes

**Example:**
```typescript
// Source: https://github.com/jbaubree/vite-plugin-sitemap
// vite.config.ts
import sitemap from 'vite-plugin-sitemap';

export default defineConfig({
  plugins: [
    react(),
    sitemap({
      hostname: 'https://magueynightclub.com',
      exclude: ['/admin', '/checkout', '/payment'],
      dynamicRoutes: async () => {
        // Fetch events from Supabase to generate /events/:id routes
        const { data: events } = await supabase.from('events').select('id');
        return events?.map(e => `/events/${e.id}`) || [];
      },
      robots: [
        { userAgent: '*', allow: '/' },
        { userAgent: 'Googlebot', allow: '/' }
      ]
    })
  ]
});
```

**Alternative (manual generation):**
```typescript
// scripts/generate-sitemap.ts
import { writeFileSync } from 'fs';
import { supabase } from '../src/integrations/supabase/client';

async function generateSitemap() {
  const baseUrl = 'https://magueynightclub.com';
  const { data: events } = await supabase.from('events').select('id, updated_at');

  const urls = [
    { loc: '/', lastmod: new Date().toISOString(), priority: 1.0 },
    { loc: '/upcoming-events', lastmod: new Date().toISOString(), priority: 0.9 },
    { loc: '/restaurant', lastmod: new Date().toISOString(), priority: 0.8 },
    { loc: '/contact', lastmod: new Date().toISOString(), priority: 0.7 },
    ...events.map(e => ({
      loc: `/events/${e.id}`,
      lastmod: e.updated_at,
      priority: 0.9
    }))
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${baseUrl}${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  writeFileSync('public/sitemap.xml', sitemap);
  console.log('Sitemap generated with', urls.length, 'URLs');
}

generateSitemap();
```

**Key points:**
- vite-plugin-sitemap runs at build time, scans dist folder for HTML files
- For dynamic routes (events), must provide `dynamicRoutes` function
- Manual generation gives more control but requires pre-build script
- Update robots.txt with `Sitemap: https://magueynightclub.com/sitemap.xml`

### Anti-Patterns to Avoid

- **Storing pixel coordinates without viewport context:** Don't save absolute pixels — save as percentages or within a fixed-size container (e.g., 1200x800px floor plan canvas)
- **Using top/left during drag:** Performance killer — use `transform: translate()` during drag, commit to position_x/y on drop
- **Generating sitemap on every request:** Generate at build time or cache aggressively — don't query DB per visitor
- **Hardcoding event data client-side:** Already verified as anti-pattern — always fetch from Supabase
- **Forgetting HTTPS requirement for Web Share API:** Will silently fail on HTTP, no fallback triggered

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop library | Custom onMouseDown/onMouseMove handlers | @dnd-kit/core | Handles touch, accessibility, collision detection, performance optimization, edge cases (scroll containers, transforms) |
| Sitemap XML generation | String concatenation with forEach | vite-plugin-sitemap or established XML builder | XML escaping, encoding, schema compliance, automatic route discovery |
| JSON-LD schema | Manually typing schema.org properties | TypeScript types from @types/schema-dts (optional) or copy official examples | Schema.org has 100+ properties per type, easy to miss required fields |
| Share functionality | Custom share modal with email/SMS forms | Web Share API + clipboard fallback | Native OS share sheet, platform-specific integrations (AirDrop, Nearby Share), zero UI code |

**Key insight:** Drag-and-drop is deceptively complex — touch events, pointer capture, scroll auto-scroll, nested containers, collision detection, and accessibility all require specialized handling. @dnd-kit/core is 10kb and battle-tested.

## Common Pitfalls

### Pitfall 1: Database Schema Migration for Coordinates

**What goes wrong:** Adding position_x/position_y columns but forgetting to backfill existing tables or handle nulls
**Why it happens:** Migration adds columns as nullable, but drag-drop code expects numbers
**How to avoid:**
```sql
-- Migration: 20260215000000_add_table_positions.sql
ALTER TABLE event_vip_tables
  ADD COLUMN position_x INTEGER,
  ADD COLUMN position_y INTEGER;

-- Backfill with default grid positions based on table_number
UPDATE event_vip_tables
SET
  position_x = CASE
    WHEN table_number IN (1,2,3) THEN 50         -- Left wing
    WHEN table_number IN (4,5,6,7) THEN 300      -- Center front row
    WHEN table_number = 8 THEN 550               -- Right wing
    WHEN table_number BETWEEN 9 AND 14 THEN 250  -- Standard top row
    WHEN table_number BETWEEN 15 AND 20 THEN 250 -- Standard bottom row
    ELSE 300
  END,
  position_y = CASE
    WHEN table_number = 1 THEN 100
    WHEN table_number = 2 THEN 200
    WHEN table_number = 3 THEN 300
    WHEN table_number IN (4,5,6,7) THEN 150
    WHEN table_number = 8 THEN 100
    WHEN table_number BETWEEN 9 AND 14 THEN 350
    WHEN table_number BETWEEN 15 AND 20 THEN 450
    ELSE 200
  END
WHERE position_x IS NULL OR position_y IS NULL;
```
**Warning signs:** TypeError: Cannot read property 'x' of null, tables rendering at (0,0), tables stacked on top of each other

### Pitfall 2: Web Share API Requires HTTPS and User Gesture

**What goes wrong:** Share functionality works on localhost but fails in production, or errors on page load
**Why it happens:** `navigator.share()` requires secure context (HTTPS) and transient activation (user click)
**How to avoid:**
- Always wrap in user event handler (onClick, not useEffect)
- Check `navigator.canShare` before calling `navigator.share`
- Test on real device (Safari iOS, Chrome Android) — desktop browsers have limited support
- Provide clipboard fallback for desktop users
**Warning signs:** "NotAllowedError: Share operation not allowed", "SecurityError: The operation is insecure", share works on localhost but not production

### Pitfall 3: Cross-Site Sync Logging Without Real-Time Subscription

**What goes wrong:** Calling syncVipTables() but purchase site doesn't reflect changes until page refresh
**Why it happens:** Supabase real-time subscriptions not set up on purchase site for event_vip_tables
**How to avoid:**
- Verify purchase site has `.on('postgres_changes', ...)` subscription for `event_vip_tables`
- Check Supabase dashboard → Database → Replication → enable real-time for `event_vip_tables` table
- Test by opening scanner and purchase site side-by-side, create table, verify live update
**Warning signs:** Sync log shows "success" but changes appear only after refresh, WebSocket connection not established

### Pitfall 4: Deleting Dead Code Without Grep Verification

**What goes wrong:** Deleting fallbackEvents or events.ts file breaks build because of hidden import somewhere
**Why it happens:** Dynamic imports, commented code, or conditional imports not caught by IDE search
**How to avoid:**
```bash
# Before deleting, search entire codebase
grep -r "fallbackEvents" maguey-nights/src/
grep -r "from.*data/events" maguey-nights/src/
grep -r "import.*events.ts" maguey-nights/src/

# Check build output after deletion
npm run build
# Look for errors like "Cannot find module './data/events'"
```
**Warning signs:** Build succeeds locally but fails in CI/CD, Vercel deployment fails with "Module not found"

### Pitfall 5: Sitemap Missing Dynamic Event Routes

**What goes wrong:** sitemap.xml only includes static pages (/events, /restaurant), not individual event pages (/events/abc123)
**Why it happens:** vite-plugin-sitemap scans dist folder HTML files, but SPA routes aren't pre-rendered
**How to avoid:**
- Use `dynamicRoutes` option to fetch event IDs from Supabase
- Or pre-build event pages with static site generation (SSG)
- Or manually generate sitemap in pre-build script
- Verify sitemap.xml includes `/events/[actual-event-id]` entries
**Warning signs:** Google Search Console shows "Discovered - not indexed" for event URLs, sitemap.xml only has 5-10 URLs

## Code Examples

Verified patterns from official sources:

### Draggable Table with Position Persistence

```typescript
// Source: https://docs.dndkit.com/api-documentation/draggable + existing VIPFloorPlanAdmin.tsx pattern
import { DndContext, DragEndEvent, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface TablePosition {
  id: string;
  x: number;
  y: number;
}

function DraggableTableButton({ table, position }: { table: EventVIPTable, position: TablePosition }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: table.id,
    data: { table, position }
  });

  const style = {
    position: 'absolute' as const,
    left: position.x,
    top: position.y,
    transform: CSS.Translate.toString(transform),
    touchAction: 'none', // Prevent scrolling during drag on mobile
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <AdminTableButton table={table} isSelected={false} hasReservation={false} onClick={() => {}} />
    </div>
  );
}

export function VIPFloorPlanAdmin({ tables, onUpdatePosition }: {
  tables: EventVIPTable[],
  onUpdatePosition: (tableId: string, x: number, y: number) => Promise<void>
}) {
  const [positions, setPositions] = useState<Map<string, TablePosition>>(
    new Map(tables.map(t => [t.id, { id: t.id, x: t.position_x || 0, y: t.position_y || 0 }]))
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta } = event;
    const tableId = active.id as string;
    const currentPos = positions.get(tableId);

    if (!currentPos) return;

    const newX = currentPos.x + delta.x;
    const newY = currentPos.y + delta.y;

    // Optimistic update
    setPositions(prev => new Map(prev).set(tableId, { id: tableId, x: newX, y: newY }));

    // Persist to database
    try {
      await onUpdatePosition(tableId, newX, newY);
    } catch (error) {
      // Rollback on error
      setPositions(prev => new Map(prev).set(tableId, currentPos));
      toast({ title: 'Failed to save position', variant: 'destructive' });
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="relative w-full h-[800px] bg-zinc-950 rounded-xl border border-emerald-900/50">
        {tables.map(table => {
          const pos = positions.get(table.id) || { id: table.id, x: 0, y: 0 };
          return <DraggableTableButton key={table.id} table={table} position={pos} />;
        })}
      </div>
    </DndContext>
  );
}
```

### Share Button with Web Share API

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share + existing clipboard pattern
import { Share2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

function ShareInviteButton({ reservation, event }: { reservation: VipReservation, event: EventDisplay }) {
  const { toast } = useToast();

  const handleShare = async () => {
    if (!reservation.invite_code) {
      toast({ title: 'No invite code', description: 'Generate invite code first', variant: 'destructive' });
      return;
    }

    const purchaseBaseUrl = import.meta.env.VITE_PURCHASE_SITE_URL ||
      (import.meta.env.DEV ? 'http://localhost:3016' : 'https://tickets.maguey.club');
    const url = `${purchaseBaseUrl}/checkout?event=${event.id}&vip=${reservation.invite_code}`;

    const shareData = {
      title: `Join VIP Table - ${event.name}`,
      text: `You're invited to join Table ${reservation.table_number} at ${event.name}!`,
      url: url
    };

    // Try Web Share API first (mobile)
    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast({ title: 'Shared successfully' });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
          fallbackToCopy(url);
        }
        // AbortError = user cancelled, no notification needed
      }
    } else {
      // Fallback to clipboard (desktop)
      fallbackToCopy(url);
    }
  };

  const fallbackToCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Invite link copied',
        description: 'Share this link with guests to join the VIP table'
      });
    } catch (err) {
      console.error('Clipboard write failed:', err);
      toast({
        title: 'Copy failed',
        description: url,
        variant: 'destructive'
      });
    }
  };

  return (
    <Button onClick={handleShare} variant="outline" size="sm">
      {navigator.canShare ? <Share2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
      Share Invite
    </Button>
  );
}
```

### JSON-LD Event Structured Data

```typescript
// Source: https://schema.org/Event + https://developers.google.com/search/docs/appearance/structured-data/event
import { Helmet } from 'react-helmet-async';

function EventStructuredData({ event }: { event: EventDisplay }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    "name": event.name,
    "description": event.description,
    "image": event.image_url,
    "startDate": `${event.event_date}T${event.event_time}`,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "location": {
      "@type": "Place",
      "name": "Maguey Nightclub",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "3320 Old Capitol Trail",
        "addressLocality": "Wilmington",
        "addressRegion": "DE",
        "postalCode": "19808",
        "addressCountry": "US"
      }
    },
    "offers": {
      "@type": "Offer",
      "url": `https://tickets.magueynightclub.com/events/${event.id}`,
      "price": event.min_ticket_price || "0",
      "priceCurrency": "USD",
      "availability": event.tickets_available > 0 ?
        "https://schema.org/InStock" : "https://schema.org/SoldOut",
      "validFrom": new Date().toISOString()
    },
    "performer": {
      "@type": "MusicGroup",
      "name": event.artist
    },
    "organizer": {
      "@type": "Organization",
      "name": "Maguey Nightclub",
      "url": "https://magueynightclub.com"
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
}

// Usage in EventPage.tsx:
function EventPage() {
  const { event, loading } = useEvent();

  if (loading || !event) return null;

  return (
    <>
      <EventStructuredData event={event} />
      {/* Rest of component */}
    </>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit/core or pragmatic-drag-and-drop | 2022 | Atlassian deprecated react-beautiful-dnd, community fork (hello-pangea/dnd) exists but official support moved to new libraries |
| Manual share modals | Web Share API + clipboard fallback | 2020-2023 | Native share sheet on mobile (iOS 12+, Android Chrome 89+), zero UI code, platform-specific integrations |
| Hand-rolled XML sitemap | vite-plugin-sitemap or Next.js generateSitemap() | 2024+ | Build-time generation, automatic route discovery, reduces manual maintenance |
| OG tags only | OG tags + JSON-LD structured data | 2021+ | Google Search rich results require JSON-LD, OG tags still needed for social media previews |

**Deprecated/outdated:**
- react-beautiful-dnd: Deprecated 2022, use @dnd-kit/core or hello-pangea/dnd fork
- Hardcoded fallback events on client: Anti-pattern, always fetch from database
- Sitemap generation on request: Should be build-time or cached, not per-request

## Open Questions

1. **Floor plan coordinate system: absolute pixels vs percentage?**
   - What we know: Current code has no positioning, need to add position_x/position_y
   - What's unclear: Fixed container size (e.g., 1200x800px) or responsive percentages?
   - Recommendation: Use fixed-size container (1200x800px) with CSS scaling for smaller screens — simpler math, predictable layout

2. **Invite code generation: when and how?**
   - What we know: `invite_code` field exists in DB but is always null
   - What's unclear: Should it be auto-generated on reservation creation or on-demand when share button clicked?
   - Recommendation: Generate on reservation creation (add to create_vip_reservation_atomic RPC), use nanoid or crypto.randomUUID().slice(0,8)

3. **Sitemap update frequency: build-time only or scheduled regeneration?**
   - What we know: Events change weekly/monthly
   - What's unclear: Static sitemap vs cron job vs API endpoint
   - Recommendation: Build-time generation for v1, add Vercel cron job for weekly regeneration in v2 if events change frequently

## Sources

### Primary (HIGH confidence)
- [dnd-kit official docs](https://docs.dndkit.com/) - Drag-and-drop API, examples, best practices
- [MDN Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API) - Browser API specification, support table
- [Schema.org Event](https://schema.org/Event) - Official Event type properties
- [Google Event Structured Data](https://developers.google.com/search/docs/appearance/structured-data/event) - Google Search requirements for rich results
- [Supabase event_vip_tables migration](file:///Users/luismiguel/Desktop/Maguey-Nightclub-Live/maguey-pass-lounge/supabase/migrations/20250619000000_create_event_vip_tables.sql) - Current schema (no position columns)

### Secondary (MEDIUM confidence)
- [Top 5 Drag-and-Drop Libraries for React in 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) - Comparison of dnd-kit vs react-beautiful-dnd vs pragmatic-drag-and-drop
- [vite-plugin-sitemap GitHub](https://github.com/jbaubree/vite-plugin-sitemap) - Sitemap plugin API, configuration options
- [LogRocket Web Share API guide](https://blog.logrocket.com/advanced-guide-web-share-api-navigator-share/) - Advanced usage patterns, error handling
- [Can I Use Web Share](https://caniuse.com/web-share) - Browser support matrix (Safari iOS 12+, Chrome Android 89+, limited desktop)

### Tertiary (LOW confidence)
- PostgreSQL column position: Cannot reorder columns without table rebuild (no ALTER COLUMN POSITION)
- Clipboard API works in all modern browsers with HTTPS (verified by existing codebase usage)

## Metadata

**Confidence breakdown:**
- Drag-and-drop: HIGH - @dnd-kit/core is established standard (10k+ GitHub stars, active maintenance)
- Web Share API: HIGH - MDN docs, verified browser support, existing clipboard pattern in codebase
- Cross-site sync: HIGH - Existing pattern in cross-site-sync.ts, same Supabase DB already shared
- Dead code removal: HIGH - Verified with grep, no imports found
- SEO/structured data: MEDIUM - vite-plugin-sitemap works but requires manual dynamic route config, JSON-LD standard but implementation varies

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days — @dnd-kit stable, Web Share API mature, SEO standards slow-changing)
