# Phase 22: Code Quality & Refactoring — Research

## RESEARCH COMPLETE

## 1. orders-service.ts Analysis (maguey-pass-lounge)

**File:** `src/lib/orders-service.ts` — 2,598 lines, 51 exports (27 functions, 24 types)
**No existing `src/lib/orders/` directory.**

### Exported Symbols by Domain

**Types (24 exports):**
- CheckoutSelectionItem, CheckoutSelectionRecord, OrderLineItem, CreateOrderInput, CreatedOrderResult, CreateOrderOptions
- OrdersQueryOptions, AdminOrderRow, PaginatedOrderRow, OrderFilters
- TicketsQueryOptions, AdminTicketRow
- DashboardStats, OrderSummary, OrderReportRow, SummaryRange
- UserTicket

**Domain 1: Email/Circuit Breaker (~10 lines)**
- getEmailCircuitStatus()

**Domain 2: Order Creation (~400 lines, lines 355-753)**
- mapCheckoutSelectionToLineItems()
- createOrderWithTickets() — 398 lines, primary order creation
- createOrderWithTicketsResult() — non-throwing variant
- createOrderWithSaga() — saga orchestrator
- getSagaExecution(), getRecentSagaExecutions()

**Domain 3: Availability Checking (~60 lines, lines 292-353)**
- checkLineItemsAvailability()
- validateLineItemsAvailability()
- getLineItemsAvailabilityMap()

**Domain 4: Ticket Insertion (~350 lines, lines 1283-1625)**
- insertTicketsForOrder() — single line item
- insertTicketsForOrderBatch() — multiple line items
- (internal: generateHumanReadableTicketId)

**Domain 5: Email & Refunds (~160 lines, lines 1630-1788)**
- resendTicket()
- requestRefund()

**Domain 6: Order Queries (~230 lines, lines 1805-2088)**
- getOrders(), getOrdersPaginated(), getEventOrdersPaginated(), getUserOrdersPaginated(), getOrdersCursor()

**Domain 7: Ticket Queries (~35 lines, lines 2203-2238)**
- getTickets()

**Domain 8: Reporting (~150 lines, lines 2240-2384)**
- getDashboardStats(), getOrderSummary(), getOrderReportRows()

**Domain 9: User Tickets (~175 lines, lines 2386-2596)**
- getUserTickets(), getTicketById()

### Consumer Files (12 files import from orders-service)

| File | Imports |
|------|---------|
| pages/Account.tsx | getUserTickets, UserTicket |
| pages/Ticket.tsx | getTicketById, UserTicket |
| pages/admin/DashboardHome.tsx | getDashboardStats |
| pages/admin/OrdersList.tsx | getOrdersPaginated, getEventOrdersPaginated |
| pages/admin/Reports.tsx | getOrderSummary, getOrderReportRows |
| pages/admin/TicketList.tsx | getTickets |
| __tests__/integration/test-helpers.ts | createOrderWithTickets, CreatedOrderResult, CreateOrderInput |
| __tests__/integration/order-flow.test.ts | createOrderWithTickets, CreateOrderInput |
| lib/__tests__/orders-service.test.ts | Multiple functions |
| lib/test-n1-fix.ts | availability functions |
| lib/test-n1-query-counter.ts | availability functions |
| lib/test-pagination.ts | pagination functions |

### Internal Dependencies

supabase, ticket-generator, email-template, saga-executor, cache, circuit-breaker, email-queue, availability-service, pagination helpers, monitoring, tracing, error-tracker, logger, rate-limiter

---

## 2. AuthContext.tsx Analysis (maguey-pass-lounge)

**File:** `src/contexts/AuthContext.tsx` — 841 lines, 5 exports
**22 consumer files across the app.**

### Section Breakdown

| Section | Lines | Methods |
|---------|-------|---------|
| Imports & Interfaces | 1-48 | AuthContextType definition |
| AuthProvider Setup | 62-126 | Session init, auth state listener |
| Email/Password Auth | 128-247 | signUp, signIn, signOut, logActivity |
| OAuth Providers | 268-342 | Google, Facebook, Apple, GitHub |
| Password/Magic Link | 344-419 | resetPassword, signInWithMagicLink, verifyMagicLink |
| 2FA System | 421-570 | enable2FA, verify2FA, disable2FA |
| Profile Management | 572-686 | updateProfile, uploadAvatar |
| Email/Password Updates | 688-753 | resendVerification, updatePassword, updateEmail |
| Session Status | 755-774 | getSessionStatus |
| Phone Auth Stubs | 776-795 | signInWithPhone, verifyPhoneOTP (unimplemented) |
| Context Export | 797-840 | value object, useAuth hook |

### Consumer Files (22 imports)

Core: App.tsx, ProtectedRoute.tsx
Auth UI: BiometricPrompt, AvatarUpload, ProgressiveSignupWizard, MagicLinkButton, ActivityLogTable, ReferralCodeInput, EmailVerificationBanner, AuthButton
Pages: Login, Account, Payment, Checkout, VipTableReservation, ResetPassword, AccountSettings, Profile, ForgotPassword, VerifyEmail, TwoFactorSetup

---

## 3. Component Directory Analysis (maguey-gate-scanner)

**134 total .tsx files:**
- 47 at top level (flat)
- 87 in subdirectories

### Existing Subdirectories

| Directory | Files | Content |
|-----------|-------|---------|
| ui/ | 52 | shadcn/ui primitives (no change needed) |
| scanner/ | 10 | SuccessOverlay, RejectionOverlay, OfflineBanner, etc. |
| dashboard/ | 9 | RevenueCard, CheckInProgress, MetricCard, etc. |
| admin/ | 9 | Monitoring dashboards (DEV-gated) |
| vip/ | 5 | VIPScanner, VIPFloorPlanAdmin, etc. |
| layout/ | 2 | OwnerPortalLayout + 1 other |

### Existing Barrel Files

- `vip/index.ts` — exports all 5 VIP components
- `scanner/index.ts` — exports 3 of 10 scanner components (partial)
- No barrel files for: ui/, dashboard/, admin/

### Top-Level Files to Reorganize (47 files)

**Scanner domain (15):** BatteryIndicator, IDVerificationModal, LowBatteryModal, ManualEntry, NFCScanner, QrScanner, RiskIndicatorBadge, ScanErrorDisplay, ScannerInput, TicketResult, OverrideActivationModal, OverrideReasonModal, PhotoCaptureModal, PhotoComparison, PhotoGallery

**Dashboard domain (12):** ActivityFeed, DiscrepancyAlerts, FraudAlertsWidget, FraudAnalysisModal, NotificationFeed, QueueDashboard, RecentGuestCheckIns, ShiftStatus, SyncDetailsPanel, SyncStatusIndicator, WaitTimeDisplay, UnifiedCapacityDisplay

**VIP domain (5):** GuestCheckInCard, GuestSearchInput, GuestSearchResults, VipTableGuestResult, TierManagement

**Layout (2):** ProtectedRoute, Navigation

**Analytics (3):** QueueAnalytics, EntryExitFlowVisualization, StaffingRecommendations

**Settings (4):** ColorPicker, FontSelector, RoleSwitcher, DeviceInfoCard

**Events (2):** EventBulkImport, AssetUpload

**Shared (2):** ErrorBoundary, ScrollToTop

**Edge cases (2):** BatchQueue → scanner/, UserDetailsModal → admin/

---

## 4. TypeScript Configuration

### Current State (all 3 sites identical)

```json
// tsconfig.app.json
"strict": false,
"noImplicitAny": false,
"strictNullChecks": false,
"noUnusedLocals": false,
"noUnusedParameters": false
```

### maguey-nights File Count

107 TypeScript files in src/ (including 44+ shadcn/ui components)

### Import Pattern

All sites use `@/*` → `./src/*` path alias (configured in both tsconfig.json and vite.config.ts). The `@/` pattern is used consistently in main source files. Relative imports only appear in test files.

---

## 5. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Broken imports after file moves | Barrel index.ts re-exports, build verification |
| Auth regression from context split | Keep AuthContextType interface, useAuth() hook unchanged |
| Component move breaks pages | One domain batch at a time, build after each |
| Strict mode too many errors | Start with maguey-nights (simplest), fallback to strictNullChecks only |
