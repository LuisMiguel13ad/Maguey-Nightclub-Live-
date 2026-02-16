# Phase 21: VIP & Events Polish

**Priority:** P1 | **Effort:** 2 days | **Dependencies:** None
**Goal:** Fix VIP floor plan, sharing, sync, remove hardcoded events, add SEO basics.

## Issues Addressed

| GSD # | Issue | Requirement |
|-------|-------|-------------|
| 23 | Floor plan visual only (no drag-drop) | R26 |
| 24 | Invite links require manual copy-paste | R27 |
| 25 | VIP table sync to purchase site not called | R28 |
| 26 | Hardcoded fallback events on marketing site | R29 |
| 31 | No sitemap.xml, robots.txt, structured data | R30 |

## Plans

| Plan | Objective | Wave |
|------|-----------|------|
| 21-01 | VIP floor plan drag-drop positioning | 1 |
| 21-02 | VIP invite link one-tap sharing | 1 |
| 21-03 | Explicit VIP table sync to purchase site | 1 |
| 21-04 | Remove hardcoded fallback events on marketing site | 1 |
| 21-05 | Add sitemap.xml, robots.txt, JSON-LD structured data | 1 |

## Key Files

- `maguey-gate-scanner/src/components/vip/VIPFloorPlanAdmin.tsx` — Floor plan
- `maguey-gate-scanner/src/lib/vip-tables-admin-service.ts` — VIP CRUD
- `maguey-gate-scanner/src/lib/cross-site-sync.ts` — Cross-site sync
- `maguey-nights/src/pages/Events.tsx` — Hardcoded fallback events
- `maguey-nights/public/` — sitemap.xml, robots.txt

## Success Criteria

- Floor plan supports drag-drop table positioning
- Invite links shareable via Web Share API or one-tap copy
- VIP table changes trigger sync to purchase site
- Marketing site shows empty state (not hardcoded events) when DB fails
- sitemap.xml, robots.txt, and JSON-LD present on marketing site
