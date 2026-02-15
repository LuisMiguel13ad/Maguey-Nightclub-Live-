---
phase: 21-vip-events-polish
plan: 03
subsystem: marketing-site
tags: [cleanup, seo, dead-code-removal]
dependency_graph:
  requires: []
  provides: [seo-basics, clean-eventpage]
  affects: [marketing-site, search-indexing]
tech_stack:
  added: [sitemap-xml, json-ld-schema]
  patterns: [structured-data, search-optimization]
key_files:
  created:
    - maguey-nights/public/sitemap.xml
  modified:
    - maguey-nights/src/pages/EventPage.tsx
    - maguey-nights/public/robots.txt
    - maguey-nights/index.html
decisions:
  - summary: "Removed 90-line fallbackEvents object - dead code never referenced in component"
    context: "EventPage.tsx declared fallbackEvents but component uses only database-driven event state from fetchEventById"
  - summary: "Static sitemap covers 9 main pages - dynamic event pages deferred to Phase 23"
    context: "Event detail pages (/events/:id) are dynamic and would require build-time generation or serverless function"
  - summary: "Used NightClub schema type for JSON-LD - valid Schema.org subclass of EntertainmentBusiness"
    context: "More specific than generic Restaurant or LocalBusiness - accurately represents the venue type"
metrics:
  duration_seconds: 130
  tasks_completed: 2
  files_modified: 4
  lines_removed: 98
  lines_added: 62
  commits: 2
  completed_date: "2026-02-15"
---

# Phase 21 Plan 03: Marketing Site Cleanup Summary

Removed hardcoded fallback events and added SEO basics (sitemap.xml, robots.txt Sitemap directive, JSON-LD).

## One-liner

Cleaned EventPage.tsx by removing 90 lines of dead code (fallbackEvents), added sitemap.xml with 9 static routes, robots.txt Sitemap directive, and Organization/NightClub JSON-LD structured data for search engine indexing.

## What Was Done

### Task 1: Remove Hardcoded Fallback Events from EventPage.tsx

**Objective:** Delete the fallbackEvents object and unused image imports - 90 lines of dead code never referenced.

**Changes:**
- Deleted `fallbackEvents` object (lines 84-173) containing 8 hardcoded event definitions
- Removed 8 unused image imports only used by fallbackEvents:
  - eventReggaeton, eventChampagne, eventFiesta
  - venueMainstage, venueVip, venuePatio
  - social1, social2
- Component remains purely database-driven via `fetchEventById()`
- Verified `vipTables` array (lines 176-281) is still used by seating tab JSX and was NOT removed

**Verification:**
- `grep -n "fallbackEvents"` returns no matches
- Build succeeds with no errors or warnings
- Component data flow unchanged: `useEffect → fetchEventById → setEvent → render`
- Loading state shows Loader2 spinner
- Error state shows "Event Not Found"

**Commit:** `67fe827` - refactor(21-03): remove hardcoded fallback events from EventPage

### Task 2: Add sitemap.xml, robots.txt Sitemap Directive, and JSON-LD

**Objective:** Add SEO basics to marketing site for search engine indexing.

**Changes:**

1. **Created sitemap.xml** (`maguey-nights/public/sitemap.xml`):
   - 9 static marketing site routes with proper priority and changefreq
   - Homepage (priority 1.0, weekly)
   - Upcoming Events (0.9, weekly)
   - Restaurant (0.8, monthly)
   - Gallery (0.7, monthly)
   - Contact, About Us (0.6, monthly)
   - Careers, FAQ (0.5, monthly)
   - Policies (0.3, yearly)
   - Note: Dynamic event pages (/events/:id) deferred to Phase 23 - requires build-time generation or serverless function

2. **Updated robots.txt** (`maguey-nights/public/robots.txt`):
   - Added Sitemap directive: `Sitemap: https://magueynightclub.com/sitemap.xml`
   - Kept all existing User-agent rules (Googlebot, Bingbot, Twitterbot, facebookexternalhit, *)

3. **Added JSON-LD to index.html** (`maguey-nights/index.html`):
   - Schema.org `@type: "NightClub"` (specific subclass of EntertainmentBusiness)
   - Business info: name, description, url, telephone
   - PostalAddress: 3320 Old Capitol Trail, Wilmington, DE 19808
   - GeoCoordinates: lat 39.7447, lng -75.6243
   - OpeningHoursSpecification: Friday/Saturday 21:00-03:00
   - Social links: Instagram, Facebook
   - Image reference: `/images/branding/maguey-logo.jpg`
   - Price range: $$

**Verification:**
- `cat sitemap.xml | head -3` shows valid XML with `<urlset>` and proper namespace
- `grep "Sitemap:" robots.txt` shows the directive
- `grep "application/ld+json" index.html` shows the script tag
- Build succeeds: `npm run build`
- Files copied to dist: `ls dist/sitemap.xml dist/robots.txt` confirms both present

**Commit:** `2b9e307` - feat(21-03): add SEO basics - sitemap, robots directive, and JSON-LD

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification criteria passed:

- ✅ No hardcoded fallback events in EventPage.tsx
- ✅ sitemap.xml present with 9 URLs
- ✅ robots.txt has Sitemap directive
- ✅ JSON-LD NightClub structured data in index.html
- ✅ Build succeeds with no errors
- ✅ sitemap.xml and robots.txt appear in dist/

## Requirements Resolved

**From Maguey-GSD-Framework.xlsx:**

- **R29 (P1):** Remove hardcoded fallback events from marketing site - RESOLVED
  - EventPage.tsx no longer has fallbackEvents object
  - Component shows loading state or error state when DB fails (no hardcoded fallbacks)

- **R46 (P1):** Add sitemap.xml and robots.txt - RESOLVED
  - sitemap.xml created with 9 static routes
  - robots.txt updated with Sitemap directive

- **R47 (P1):** Add JSON-LD structured data - RESOLVED
  - Organization/NightClub schema with complete business info
  - Address, hours, social links, geo coordinates

## Technical Notes

### EventPage.tsx Data Flow

After cleanup, the component data flow is:

```
useEffect(eventId)
  → fetchEventById(eventId) from eventService
    → setEvent(eventData) if found
    → setError() if not found

Render:
  - loading: <Loader2 /> + "Loading event..."
  - error: "Event Not Found" + link to /upcoming-events
  - success: event data from database
```

No fallback logic. No hardcoded events. Purely database-driven.

### SEO Strategy

**Current (v1):** Static sitemap covers main pages. JSON-LD describes the venue (NightClub organization).

**Future (Phase 23):** Dynamic event pages can be added to sitemap via:
- Build-time generation: Fetch events from Supabase during `vite build`, generate sitemap dynamically
- Serverless function: `/api/sitemap.xml` endpoint that queries DB and returns XML
- Pre-rendering: Static site generation for event detail pages

Per-event JSON-LD (MusicEvent schema) would ideally be rendered by EventPage.tsx using react-helmet-async, but that library is not installed. Can be added when needed.

### Dead Code Analysis

The fallbackEvents object was:
- **Declared:** Line 84 (`const fallbackEvents = { ... }`)
- **Never used:** Not referenced in any JSX, not in conditional rendering, not in error fallback
- **Why it existed:** Likely leftover from early development when DB integration wasn't complete
- **Safe to remove:** Component already has proper loading/error states via fetchEventById

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| maguey-nights/src/pages/EventPage.tsx | Removed fallbackEvents object + 8 image imports | -98 |
| maguey-nights/public/sitemap.xml | Created XML sitemap with 9 routes | +47 |
| maguey-nights/public/robots.txt | Added Sitemap directive | +2 |
| maguey-nights/index.html | Added JSON-LD structured data | +31 |

**Total:** 4 files modified, 62 lines added, 98 lines removed (net -36 lines)

## Self-Check: PASSED

### Files Created
```bash
[ -f "maguey-nights/public/sitemap.xml" ] && echo "FOUND: sitemap.xml" || echo "MISSING: sitemap.xml"
# Output: FOUND: sitemap.xml
```

### Commits Exist
```bash
git log --oneline --all | grep -q "67fe827" && echo "FOUND: 67fe827" || echo "MISSING: 67fe827"
# Output: FOUND: 67fe827

git log --oneline --all | grep -q "2b9e307" && echo "FOUND: 2b9e307" || echo "MISSING: 2b9e307"
# Output: FOUND: 2b9e307
```

### Build Verification
```bash
cd maguey-nights && npm run build
# Output: ✓ built in 4.25s

ls dist/sitemap.xml dist/robots.txt
# Output: Both files present in dist/
```

All verification checks passed. Plan execution complete.

## Impact

### User-Facing
- Marketing site EventPage.tsx is now cleaner and faster (98 fewer lines to parse)
- Search engines can now discover and index the marketing site via sitemap.xml
- Google/Bing will show rich snippets with business info (hours, address, phone) from JSON-LD

### Developer-Facing
- EventPage.tsx is easier to maintain (removed 90 lines of dead code)
- No more confusion about whether fallbackEvents is used
- SEO infrastructure in place for future enhancements (dynamic event pages in Phase 23)

### Performance
- Negligible performance impact (removed unused code, added 1KB sitemap + 2KB JSON-LD)
- Build time unchanged
- No runtime performance change

## Next Steps

**Immediate (this phase):**
- Continue to 21-04 and 21-05 (VIP drag-drop and sharing features)

**Future (Phase 23 - CI/CD & Production):**
- Add dynamic event pages to sitemap (build-time or serverless)
- Install react-helmet-async for per-event MusicEvent JSON-LD
- Consider adding BreadcrumbList JSON-LD for event detail pages
- Verify Google Search Console picks up sitemap after deployment

## Lessons Learned

1. **Dead code accumulates during rapid development** - The fallbackEvents object was likely created when DB integration wasn't complete, then forgotten.

2. **Always verify usage before deletion** - Checked that vipTables array was still used by seating tab JSX before removing anything.

3. **SEO is incremental** - Static sitemap covers main pages for v1. Dynamic pages can be added later without breaking existing setup.

4. **Schema.org has specific types** - NightClub is more accurate than Restaurant or LocalBusiness for our venue type.

## Completion

All tasks complete. EventPage.tsx cleaned, SEO basics in place. Marketing site is now search-engine friendly and has 90 fewer lines of dead code.
