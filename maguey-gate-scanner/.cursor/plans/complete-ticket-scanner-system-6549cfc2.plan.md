<!-- 6549cfc2-c9ad-48e6-a306-a6832c713aa7 f67d9f68-637a-44ab-8cfa-7e22bae0ae52 -->
# Remove Customer Portal and Waitlist Management

## Overview

The scanner site should be staff/owner-only. Customer-facing features (Customer Portal and Waitlist Management) will be handled by the purchase site.

## Changes Required

### 1. Remove Customer Portal

**Files to modify:**

- `src/App.tsx` - Remove import and route
- `src/pages/CustomerPortal.tsx` - Delete file

**Actions:**

- Remove `import CustomerPortal from "./pages/CustomerPortal";` from App.tsx
- Remove `<Route path="/customer-portal" element={<CustomerPortal />} />` from routes
- Delete `src/pages/CustomerPortal.tsx` entirely

### 2. Remove Waitlist Management UI

**Files to modify:**

- `src/App.tsx` - Remove import and route
- `src/components/Navigation.tsx` - Remove navigation button
- `src/pages/WaitlistManagement.tsx` - Delete file

**Actions:**

- Remove `import WaitlistManagement from "./pages/WaitlistManagement";` from App.tsx
- Remove `<Route path="/waitlist" element={<WaitlistManagement />} />` from routes
- Remove waitlist navigation button from Navigation.tsx (lines 180-188)
- Remove `ListChecks` import if no longer used
- Delete `src/pages/WaitlistManagement.tsx` entirely

**Note:** Keep the database migration `supabase/migrations/20250128000003_add_waitlist.sql` since the purchase site will use the waitlist table.

### 3. Keep SMS Integration

**No changes needed** - SMS integration is already staff-focused for:

- Capacity threshold alerts
- Fraud alerts
- Device offline alerts
- Low battery warnings
- Critical system issues

## Verification Steps

1. Verify `/customer-portal` route returns 404
2. Verify `/waitlist` route returns 404
3. Verify navigation no longer shows Customer Portal or Waitlist links
4. Verify SMS notification system still works for staff alerts
5. Confirm database migrations remain intact for purchase site integration