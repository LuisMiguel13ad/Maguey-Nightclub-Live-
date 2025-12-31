# Maguey Ticket System Integration Architecture

## System Overview

This document outlines how to connect:
1. **Main Nightclub Website** (Info display - optional integration)
2. **Ticket Purchase Website** (Stripe payments + QR generation)
3. **Ticket Scanner System** (Current project - QR validation)

## Architecture Diagram

```
┌─────────────────────┐
│  Main Club Website  │  (Optional - can display event info)
│  (Info Display)     │
└─────────────────────┘
         │
         │ (can read events)
         ▼
┌─────────────────────────────────────────────────┐
│              Supabase Database                   │
│  ┌──────────────┐  ┌──────────────┐            │
│  │   Events     │  │   Tickets    │            │
│  │   Table      │  │   Table      │            │
│  └──────────────┘  └──────────────┘            │
│  ┌──────────────┐  ┌──────────────┐            │
│  │   Orders     │  │   Payments   │            │
│  │   Table      │  │   Table      │            │
│  └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────┘
         ▲                      ▲
         │                      │
         │                      │
┌────────┴─────────┐  ┌─────────┴──────────┐
│ Ticket Purchase  │  │  Ticket Scanner    │
│    Website       │  │     (Current)     │
│                  │  │                    │
│ • Stripe Checkout│  │ • QR Code Scanner │
│ • QR Generation  │  │ • Validation      │
│ • Email Delivery │  │ • Entry Logging    │
└──────────────────┘  └────────────────────┘
```

## Required Database Schema Updates

### 1. Events Table (for capacity management)
```sql
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  event_date timestamp with time zone NOT NULL,
  venue_capacity integer NOT NULL,
  ticket_types jsonb NOT NULL, -- [{"name": "VIP", "price": 50, "capacity": 100}, ...]
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### 2. Orders Table (Stripe payment tracking)
```sql
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id text UNIQUE NOT NULL,
  stripe_customer_id text,
  customer_email text NOT NULL,
  customer_name text,
  total_amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded
  event_name text NOT NULL,
  ticket_count integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);
```

### 3. Payments Table (Payment records)
```sql
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  stripe_payment_intent_id text UNIQUE NOT NULL,
  amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'usd',
  status text NOT NULL, -- succeeded, failed, refunded
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
```

### 4. Updated Tickets Table (add missing fields)
```sql
-- Add new columns to existing tickets table
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS qr_code_data text UNIQUE, -- The actual QR code string
  ADD COLUMN IF NOT EXISTS price_paid decimal(10,2),
  ADD COLUMN IF NOT EXISTS stripe_payment_id text,
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;
```

## Integration Flow

### Phase 1: Ticket Purchase Flow

1. **Customer selects event** → Query `events` table for availability
2. **Selects ticket type/quantity** → Check capacity in real-time
3. **Stripe Checkout** → Create payment intent
4. **Payment Success Webhook** → 
   - Create order record
   - Generate unique ticket IDs
   - Generate QR codes (store as `qr_code_data`)
   - Insert tickets into database
   - Send email with QR code tickets
5. **Customer receives email** → Digital tickets with QR codes

### Phase 2: Ticket Generation Service

**Unique Ticket ID Format:**
```
MGY-{EVENT_CODE}-{TIMESTAMP}-{RANDOM}
Example: MGY-PF-20250115-ABC123XYZ
```

**QR Code Generation:**
- Use the `ticket_id` as the QR code content
- Store QR code image/PDF in Supabase Storage (optional)
- Or generate on-the-fly from `qr_code_data`

### Phase 3: Scanner Integration

Your current scanner already:
- ✅ Reads QR codes
- ✅ Validates against `tickets` table
- ✅ Filters by event
- ✅ Prevents duplicates
- ✅ Logs scans

**No changes needed** - it already works with the shared database!

## Required Functionalities

### 1. **Stripe Webhook Handler** (Serverless Function)

**Purpose:** Handle Stripe payment webhooks securely

**Location:** Create as Supabase Edge Function or separate API endpoint

**Events to handle:**
- `payment_intent.succeeded` → Create tickets
- `payment_intent.failed` → Mark order as failed
- `charge.refunded` → Mark tickets as refunded

**Key Logic:**
```javascript
// Pseudo-code for webhook handler
async function handleStripeWebhook(event) {
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    
    // 1. Create order record
    const order = await createOrder({
      stripe_payment_intent_id: paymentIntent.id,
      customer_email: paymentIntent.customer_email,
      // ... other order data
    });
    
    // 2. Generate tickets
    const tickets = await generateTickets({
      orderId: order.id,
      eventName: paymentIntent.metadata.event_name,
      ticketType: paymentIntent.metadata.ticket_type,
      quantity: paymentIntent.metadata.quantity,
      customerEmail: paymentIntent.customer_email,
      customerName: paymentIntent.metadata.customer_name,
    });
    
    // 3. Send email with QR codes
    await sendTicketEmail(tickets);
  }
}
```

### 2. **Ticket Generation Service**

**Purpose:** Generate unique tickets with QR codes

**Key Functions:**
- Generate unique `ticket_id`
- Create QR code (store `qr_code_data` or generate image)
- Insert into `tickets` table
- Return ticket data for email

**QR Code Library:** Use `qrcode` (Node.js) or `qrcode.js` (browser)

### 3. **Event Capacity Management**

**Real-time availability check:**
```sql
-- Check available tickets for an event
SELECT 
  e.name,
  e.venue_capacity,
  COUNT(t.id) as tickets_sold,
  e.venue_capacity - COUNT(t.id) as tickets_available
FROM events e
LEFT JOIN tickets t ON t.event_name = e.name AND t.is_used = false
WHERE e.name = 'Perreo Fridays'
GROUP BY e.id;
```

### 4. **Email Service** (Ticket Delivery)

**Purpose:** Send digital tickets with QR codes

**Options:**
- **Resend** (recommended for email)
- **SendGrid**
- **Supabase Email** (if using Supabase)
- **Postmark**

**Email should include:**
- Event details
- Ticket ID
- QR code image (or link to view)
- Instructions for entry

### 5. **API Endpoints Needed**

**For Ticket Purchase Website:**

1. **GET /api/events/:name/availability**
   - Returns real-time ticket availability
   - Event capacity, sold, remaining

2. **POST /api/orders/create-checkout**
   - Creates Stripe checkout session
   - Returns checkout URL

3. **GET /api/tickets/:orderId**
   - Retrieve tickets for an order (after payment)

**For Scanner (already exists):**
- ✅ Ticket validation via Supabase queries
- ✅ Scan logging
- ✅ Real-time updates

## Security Considerations

1. **Webhook Security:**
   - Verify Stripe webhook signatures
   - Never trust webhook payloads without verification

2. **QR Code Security:**
   - Use cryptographically secure random IDs
   - Include checksum/validation in ticket_id
   - Prevent ticket_id guessing

3. **Database Security:**
   - Row Level Security (RLS) policies
   - Separate policies for:
     - Public (read events/availability)
     - Customers (read their own tickets)
     - Staff (read/update all tickets)

4. **Rate Limiting:**
   - Limit ticket generation rate
   - Prevent brute force QR scanning

## Implementation Checklist

### Phase 1: Database Setup
- [ ] Create `events` table
- [ ] Create `orders` table
- [ ] Create `payments` table
- [ ] Update `tickets` table with new columns
- [ ] Set up RLS policies
- [ ] Create database functions for capacity checks

### Phase 2: Ticket Purchase Website
- [ ] Set up Stripe account
- [ ] Create Stripe checkout integration
- [ ] Build event selection page
- [ ] Implement real-time availability display
- [ ] Create webhook handler endpoint
- [ ] Implement ticket generation service
- [ ] Set up email service for ticket delivery

### Phase 3: QR Code System
- [ ] Choose QR code library
- [ ] Implement unique ticket ID generator
- [ ] Create QR code generation service
- [ ] Store QR code data in database
- [ ] Generate ticket PDFs/images for email

### Phase 4: Integration Testing
- [ ] Test full purchase flow
- [ ] Verify tickets appear in scanner
- [ ] Test duplicate prevention
- [ ] Test capacity limits
- [ ] Test webhook error handling

## Next Steps

1. **Create database migration** for new tables
2. **Set up Stripe account** and get API keys
3. **Build webhook handler** (Supabase Edge Function recommended)
4. **Implement ticket generation** service
5. **Set up email service** for ticket delivery
6. **Test end-to-end flow**

## Example Ticket Purchase Flow

```
Customer → Selects "Perreo Fridays" (VIP)
         → Checks availability (100 VIP tickets available)
         → Selects quantity: 2
         → Enters email/name
         → Stripe Checkout ($100 total)
         → Payment succeeds
         → Webhook triggers
         → System generates:
           - Ticket 1: MGY-PF-20250115-ABC123
           - Ticket 2: MGY-PF-20250115-XYZ789
         → QR codes generated
         → Email sent with 2 tickets
         → Tickets visible in scanner database
         → Scanner can validate both tickets
```

