# Phase 22: Code Quality & Refactoring

**Priority:** P1 | **Effort:** 3 days | **Dependencies:** Phases 14-16
**Goal:** Split oversized files, organize flat components, enable TypeScript strict mode.

## Issues Addressed

| GSD # | Issue | Requirement |
|-------|-------|-------------|
| 27 | orders-service.ts is 2,600 lines | R31 |
| 28 | AuthContext.tsx is 840 lines | R32 |
| 29 | 150+ components in flat directory | R33 |
| 30 | TypeScript strict mode disabled | R34 |

## Plans

| Plan | Objective | Wave |
|------|-----------|------|
| 22-01 | Split orders-service.ts into modules | 1 |
| 22-02 | Split AuthContext.tsx into providers | 1 |
| 22-03 | Organize 150+ flat components into domain directories | 1 |
| 22-04 | Enable TypeScript strict mode on marketing site | 1 |

## Key Files

- `maguey-pass-lounge/src/lib/orders-service.ts` — 2,600 lines
- `maguey-pass-lounge/src/contexts/AuthContext.tsx` — 840 lines
- `maguey-gate-scanner/src/components/` — 150+ flat files
- `maguey-nights/tsconfig.json` — Strict mode toggle

## Proposed Module Split (orders-service.ts)

```
maguey-pass-lounge/src/lib/orders/
  index.ts           — Re-exports
  order-creation.ts  — createOrder, createOrderWithTickets
  payment.ts         — processPayment, handleStripeCheckout
  email.ts           — sendConfirmation, queueEmail
  promo-codes.ts     — validatePromo, applyDiscount
  queries.ts         — getOrders, getOrderById
```

## Proposed Directory Structure (components)

```
maguey-gate-scanner/src/components/
  scanner/      — QR, manual entry, overlays, history
  dashboard/    — Metrics, charts, cards
  vip/          — Floor plan, reservations, scanner
  layout/       — Portal layouts, navigation
  ui/           — shadcn/ui primitives
  shared/       — Reusable across domains
```

## Success Criteria

- orders-service.ts split into 5+ focused modules
- AuthContext.tsx split into 3+ providers
- Components organized into domain directories
- All imports updated (no broken references)
- TypeScript strict mode enabled on marketing site
- All existing tests still pass
