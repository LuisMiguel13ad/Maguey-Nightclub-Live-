# Payment System Architecture - Complete Codebase Analysis

## Overview
This document contains the complete codebase for the ticket purchase payment system (`maguey-pass-lounge`). The system uses **Stripe Checkout (hosted payment page)** for payment processing.

---

## Table of Contents
1. [Payment Flow Architecture](#payment-flow-architecture)
2. [Frontend Components](#frontend-components)
3. [Backend Edge Functions](#backend-edge-functions)
4. [Stripe Integration](#stripe-integration)
5. [Database Schema](#database-schema)
6. [Environment Variables](#environment-variables)
7. [Known Issues](#known-issues)
8. [File Structure](#file-structure)

---

## Payment Flow Architecture

### High-Level Flow
```
User → Checkout Page → Payment Page → Stripe Checkout → Webhook → Ticket Creation
```

### Detailed Flow
1. **Checkout Page** (`/checkout?event={eventId}`)
   - User selects tickets and quantities
   - Validates availability (optional, non-blocking)
   - Redirects to Payment page with ticket data in URL

2. **Payment Page** (`/payment?event={eventId}&tickets={encodedJSON}`)
   - Displays event details and order summary
   - Shows "Pay $X.XX" button
   - On click: Calls `createCheckoutSession()` → Redirects to Stripe

3. **Stripe Checkout Session Creation** (Edge Function)
   - Creates order in database (status: "pending")
   - Creates Stripe Checkout Session
   - Returns `sessionId` and `url`

4. **Stripe Hosted Checkout**
   - User completes payment on Stripe's secure page
   - Stripe redirects to success/cancel URLs

5. **Webhook Handler** (Edge Function)
   - Receives `checkout.session.completed` event
   - Updates order status to "paid"
   - Creates tickets in database

---

## Frontend Components

### 1. Payment Page (`src/pages/Payment.tsx`)
**Purpose**: Displays order summary and initiates Stripe Checkout

**Key Features**:
- Parses tickets from URL parameters
- Calculates fees (6% XS fees, 9.6% processing, 7.4% entertainment tax)
- Displays event image and details
- Single "Pay $X.XX" button that redirects to Stripe

**Flow**:
```typescript
onClick → createCheckoutSession() → window.location.href = session.url
```

**Dependencies**:
- `@/lib/stripe` - Stripe integration
- `@/lib/events-service` - Event data fetching
- `@/contexts/AuthContext` - User authentication

---

### 2. Checkout Page (`src/pages/Checkout.tsx`)
**Purpose**: Ticket selection interface

**Key Features**:
- Displays event with ticket types
- Allows quantity selection
- Optional availability check (non-blocking)
- Promo code support
- Redirects to Payment page with encoded ticket data

**Flow**:
```typescript
handleCheckout() → encode tickets → navigate("/payment?event={id}&tickets={data}")
```

---

## Backend Edge Functions

### 1. create-checkout-session (`supabase/functions/create-checkout-session/index.ts`)

**Purpose**: Creates Stripe Checkout Session and order record

**Input**:
```typescript
{
  eventId: string;
  tickets: Array<{
    ticketTypeId: string;
    quantity: number;
    unitPrice: number;
    unitFee: number;
    displayName: string;
  }>;
  customerEmail: string;
  customerName: string;
  totalAmount: number;
  feesAmount?: number;
  successUrl: string;
  cancelUrl: string;
}
```

**Process**:
1. Validates required fields
2. Verifies event exists
3. Creates order in `orders` table (status: "pending")
4. Creates Stripe Checkout Session with line items
5. Updates order with `payment_reference` (session ID)

**Output**:
```typescript
{
  sessionId: string;
  url: string;
  orderId: string;
}
```

**Environment Variables Required**:
- `STRIPE_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL` (for redirect URLs)

---

### 2. stripe-webhook (`supabase/functions/stripe-webhook/index.ts`)

**Purpose**: Handles Stripe webhook events for payment completion

**Events Handled**:
- `checkout.session.completed`

**Process**:
1. Verifies webhook signature
2. Extracts order ID from session metadata
3. Updates order status to "paid"
4. Parses tickets from metadata
5. Creates ticket records in `tickets` table

**Ticket Creation**:
- Generates unique `ticket_id` (format: `MGY-{timestamp}-{random}`)
- Generates `qr_token` (UUID)
- Sets status to "issued"

**Environment Variables Required**:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

### 3. check-availability (`supabase/functions/check-availability/index.ts`)

**Purpose**: Validates ticket availability before checkout (optional, non-blocking)

**Input**:
```typescript
{
  eventId: string;
  ticketRequests: Array<{
    ticketTypeId: string;
    quantity: number;
  }>;
}
```

**Process**:
1. Verifies event exists and is published
2. For each ticket type:
   - Gets total inventory
   - Counts sold tickets (status: issued, used, scanned)
   - Counts active reservations (if function exists)
   - Calculates available = total - sold - reserved
3. Returns availability status

**Output**:
```typescript
{
  available: boolean;
  errors?: string[];
  details?: Array<{
    ticketTypeId: string;
    requested: number;
    available: number;
    total: number;
    sold: number;
  }>;
}
```

**Note**: This function gracefully handles missing `sum_active_reservations` database function.

---

## Stripe Integration

### Library: `src/lib/stripe.ts`

**Key Functions**:

#### `createCheckoutSession(orderData)`
- Calls Edge Function to create Stripe Checkout Session
- Protected by circuit breaker pattern
- Returns `{ url, sessionId, orderId }`

#### `redirectToCheckout(sessionId)`
- Uses Stripe.js to redirect to checkout
- Fallback if `url` is not provided

#### `checkPaymentAvailability()`
- Checks circuit breaker state
- Returns availability status

**Circuit Breaker**:
- Prevents cascading failures when Stripe API is down
- States: CLOSED (normal), OPEN (failing), HALF_OPEN (recovering)

---

## Database Schema

### Key Tables

#### `orders`
```sql
- id (UUID, PK)
- event_id (UUID, FK → events)
- purchaser_email (TEXT)
- purchaser_name (TEXT)
- subtotal (NUMERIC)
- fees_total (NUMERIC)
- total (NUMERIC)
- payment_provider (TEXT) -- "stripe"
- status (TEXT) -- "pending", "paid", "cancelled", "refunded"
- payment_reference (TEXT) -- Stripe session ID
- metadata (JSONB) -- Stores ticket data
- created_at (TIMESTAMP)
```

#### `tickets`
```sql
- id (UUID, PK)
- order_id (UUID, FK → orders)
- event_id (UUID, FK → events)
- ticket_type_id (UUID, FK → ticket_types)
- attendee_name (TEXT)
- attendee_email (TEXT)
- status (TEXT) -- "issued", "used", "scanned", "refunded"
- price (NUMERIC)
- fee_total (NUMERIC)
- qr_token (TEXT, UNIQUE) -- UUID for scanning
- qr_signature (TEXT) -- HMAC signature
- ticket_id (TEXT) -- Human-readable ID (MGY-...)
- issued_at (TIMESTAMP)
```

#### `ticket_types`
```sql
- id (UUID, PK)
- event_id (UUID, FK → events)
- name (TEXT)
- price (NUMERIC)
- fee (NUMERIC)
- total_inventory (INTEGER)
- code (TEXT) -- "GA", "VIP", etc.
```

#### `events`
```sql
- id (UUID, PK)
- name (TEXT)
- event_date (DATE)
- event_time (TIME)
- venue_name (TEXT)
- city (TEXT)
- image_url (TEXT)
- status (TEXT) -- "published", "draft"
- is_active (BOOLEAN)
```

### Database Functions

#### `sum_active_reservations(p_ticket_type_id UUID)`
- Returns count of active reservations for a ticket type
- Used by availability checking
- **Status**: Recently created, may not exist in all environments

---

## Environment Variables

### Frontend (`.env`)
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SCANNER_API_URL=https://... (optional, for availability checks)
```

### Supabase Edge Functions (Secrets)
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FRONTEND_URL=http://localhost:3016 (or production URL)
```

---

## Known Issues

### 1. Payment Form Not Showing
**Symptom**: Payment page shows order summary but no payment form
**Root Cause**: System uses Stripe Checkout (hosted page), not embedded form
**Expected Behavior**: Single "Pay $X.XX" button that redirects to Stripe

### 2. Reservation Function Error
**Symptom**: Error message about `sum_active_reservations` function
**Status**: ✅ FIXED - Function created, Edge Function handles missing function gracefully

### 3. Duplicate Function Declaration
**Symptom**: `SyntaxError: Identifier 'createSimplePaymentIntent' has already been declared`
**Status**: ✅ FIXED - Removed duplicate function definition

### 4. Circuit Breaker Tripping
**Symptom**: "Payment service is temporarily unavailable"
**Solution**: `forceStripeCircuitClose()` called on Payment page mount

---

## File Structure

```
maguey-pass-lounge/
├── src/
│   ├── pages/
│   │   ├── Payment.tsx          # Payment page (order summary + redirect)
│   │   └── Checkout.tsx         # Ticket selection page
│   ├── lib/
│   │   ├── stripe.ts            # Stripe integration library
│   │   ├── events-service.ts    # Event data fetching
│   │   └── orders-service.ts    # Order management
│   └── contexts/
│       └── AuthContext.tsx      # User authentication
├── supabase/
│   └── functions/
│       ├── create-checkout-session/
│       │   └── index.ts         # Creates Stripe session + order
│       ├── stripe-webhook/
│       │   └── index.ts         # Handles payment completion
│       └── check-availability/
│           └── index.ts         # Validates ticket availability
├── package.json
└── vite.config.ts
```

---

## Payment Flow Sequence Diagram

```
User          Frontend          Edge Function         Stripe          Database
 │                │                    │                │                │
 │──Select Tickets──>│                    │                │                │
 │                │                    │                │                │
 │<──Checkout Page───│                    │                │                │
 │                │                    │                │                │
 │──Click "Pay"───>│                    │                │                │
 │                │──createCheckoutSession()──>│                │                │
 │                │                    │──Create Order──>│                │
 │                │                    │<──Order ID──────│                │
 │                │                    │──Create Session──>│                │
 │                │                    │<──Session URL────│                │
 │                │<──{url, sessionId}──│                │                │
 │<──Redirect to Stripe───│                    │                │                │
 │                │                    │                │                │
 │──Complete Payment──>│                    │                │                │
 │                │                    │                │──Webhook Event──>│
 │                │                    │<──checkout.session.completed─────│
 │                │                    │──Update Order──>│                │
 │                │                    │──Create Tickets──>│                │
 │<──Redirect to Success───│                    │                │                │
```

---

## Testing Checklist

### Manual Testing Steps
1. ✅ Navigate to checkout page
2. ✅ Select tickets and quantities
3. ✅ Click "Checkout" button
4. ✅ Verify redirect to payment page
5. ✅ Verify order summary displays correctly
6. ✅ Click "Pay $X.XX" button
7. ✅ Verify redirect to Stripe Checkout
8. ✅ Complete test payment (use Stripe test card: 4242 4242 4242 4242)
9. ✅ Verify redirect to success page
10. ✅ Verify tickets created in database
11. ✅ Verify order status updated to "paid"

### Test Cards (Stripe Test Mode)
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires 3D Secure: `4000 0025 0000 3155`

---

## Error Handling

### Frontend Errors
- Network errors → User-friendly message
- Circuit breaker open → "Payment service temporarily unavailable"
- Missing configuration → Clear error with setup instructions

### Backend Errors
- Order creation failure → Returns 500 with error message
- Stripe API errors → Logged and returned to frontend
- Webhook signature verification failure → Returns 400

---

## Security Considerations

1. **Webhook Signature Verification**: ✅ Implemented
2. **CORS Headers**: ✅ Configured for Edge Functions
3. **Environment Variables**: ✅ Stored in Supabase secrets
4. **Circuit Breaker**: ✅ Prevents cascading failures
5. **Rate Limiting**: ✅ Implemented in orders-service

---

## Performance Optimizations

1. **Circuit Breaker**: Prevents repeated failed requests
2. **Caching**: Event data cached (5 minutes TTL)
3. **Batch Operations**: Ticket creation uses bulk inserts
4. **Availability Checks**: Non-blocking, doesn't delay checkout

---

## Next Steps for Architect Review

1. Review error handling and edge cases
2. Verify webhook idempotency
3. Check for race conditions in ticket creation
4. Review fee calculation logic
5. Verify redirect URL handling
6. Check database transaction isolation
7. Review security headers and CSP
8. Verify Stripe webhook endpoint configuration

---

## Contact & Support

For questions about this architecture:
- Check Supabase Edge Function logs
- Review Stripe Dashboard webhook logs
- Check browser console for frontend errors
- Review database for order/ticket records

---

**Last Updated**: Based on current codebase state
**Payment Method**: Stripe Checkout (Hosted Payment Page)
**Status**: Production-ready (with known issues documented above)

