# Multi-Site Architecture Documentation

## Overview

This document describes the complete architecture for the 3-website ticket system:
1. **Main Website** (Marketing) - Displays events, links to purchase
2. **Purchase Website** (Sales) - Handles ticket sales and payments
3. **Scanner Site** (Admin) - Manages events and scans tickets

All three sites connect to the same Supabase database, with the Scanner Site serving as the single source of truth for event management.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                         │
│                 (Single Source of Truth)                     │
│                                                              │
│  Tables:                                                    │
│  • events          - Event information                      │
│  • tickets         - Ticket records                         │
│  • orders          - Purchase orders                        │
│  • payments        - Payment records                         │
│  • scan_logs       - Scan history                           │
│  • waitlist        - Waitlist entries                       │
│                                                              │
│  Functions:                                                 │
│  • get_event_availability()                                 │
│  • get_ticket_count_by_type()                               │
│  • get_unified_capacity()                                   │
│                                                              │
│  Edge Functions:                                            │
│  • event-availability  - API endpoint                       │
│  • ticket-webhook      - Create tickets                     │
│  • order-tickets       - Get order tickets                  │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌────────────────┐    ┌──────────────┐
│ Main Website  │    │ Purchase Site  │    │ Scanner Site│
│ (Marketing)   │    │ (Sales)        │    │ (Admin)     │
├───────────────┤    ├────────────────┤    ├──────────────┤
│ READ ONLY     │    │ READ + CREATE  │    │ FULL CONTROL│
│               │    │                │    │              │
│ Operations:   │    │ Operations:    │    │ Operations: │
│ • List events │    │ • List events  │    │ • CRUD events│
│ • Show details│    │ • Check avail  │    │ • Set prices │
│ • Link to buy │    │ • Create orders│    │ • Set capacity│
│               │    │ • Create tickets│   │ • Scan tickets│
│               │    │ • Send emails  │    │ • View analytics│
│               │    │                │    │ • Manage staff│
└───────────────┘    └────────────────┘    └──────────────┘
```

## Data Flow

### Event Creation Flow

```
1. Owner logs into Scanner Site
   ↓
2. Creates/updates event in /events page
   ↓
3. Data saved to Supabase events table
   ↓
4. Real-time subscription triggers
   ↓
5. Main Website & Purchase Website automatically update
```

### Ticket Purchase Flow

```
1. Customer visits Main Website
   ↓
2. Clicks "Buy Tickets" → Redirects to Purchase Website
   ↓
3. Purchase Website checks availability via Supabase
   ↓
4. Customer selects tickets and pays via Stripe
   ↓
5. Stripe webhook triggers ticket creation
   ↓
6. Tickets created in Supabase tickets table
   ↓
7. Email sent to customer with QR codes
   ↓
8. Tickets immediately available in Scanner Site
```

### Ticket Scanning Flow

```
1. Staff scans QR code in Scanner Site
   ↓
2. Scanner queries Supabase for ticket
   ↓
3. Validates ticket (not used, correct event, etc.)
   ↓
4. Updates ticket status to "scanned"
   ↓
5. Creates scan_log entry
   ↓
6. Updates capacity counters
   ↓
7. Real-time sync updates all scanners
```

## Database Schema

### Events Table

```sql
CREATE TABLE events (
  id uuid PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  event_date timestamp with time zone NOT NULL,
  venue_capacity integer NOT NULL,
  ticket_types jsonb NOT NULL, -- [{"name": "VIP", "price": 50.00, "capacity": 100}]
  is_active boolean DEFAULT true,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
```

**Example ticket_types:**
```json
[
  {
    "name": "VIP",
    "price": 50.00,
    "capacity": 100
  },
  {
    "name": "General Admission",
    "price": 25.00,
    "capacity": 400
  }
]
```

### Tickets Table

```sql
CREATE TABLE tickets (
  id uuid PRIMARY KEY,
  ticket_id text UNIQUE NOT NULL,
  event_name text NOT NULL,
  ticket_type text NOT NULL,
  guest_name text,
  guest_email text,
  guest_phone text,
  order_id uuid REFERENCES orders(id),
  qr_code_data text UNIQUE,
  price_paid decimal(10,2),
  stripe_payment_id text,
  status text DEFAULT 'issued',
  is_used boolean DEFAULT false,
  scanned_at timestamp with time zone,
  scanned_by uuid,
  purchase_date timestamp with time zone,
  created_at timestamp with time zone
);
```

### Orders Table

```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY,
  stripe_payment_intent_id text UNIQUE NOT NULL,
  stripe_checkout_session_id text,
  customer_email text NOT NULL,
  customer_name text,
  customer_phone text,
  total_amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'usd',
  status text DEFAULT 'pending',
  event_name text NOT NULL,
  ticket_count integer NOT NULL,
  ticket_type text NOT NULL,
  created_at timestamp with time zone,
  completed_at timestamp with time zone
);
```

## Security (Row Level Security)

### Events Table Policies

```sql
-- Public can read active events
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

-- Only authenticated users (Scanner Site admins) can modify
CREATE POLICY "Events can be managed by authenticated users"
  ON events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

### Tickets Table Policies

```sql
-- Public can read tickets (for QR validation)
CREATE POLICY "Tickets are viewable for validation"
  ON tickets FOR SELECT
  USING (true);

-- Purchase site can create tickets
CREATE POLICY "Tickets can be created by anyone"
  ON tickets FOR INSERT
  WITH CHECK (true);

-- Only Scanner Site can update tickets
CREATE POLICY "Tickets can be updated by authenticated users"
  ON tickets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

### Orders Table Policies

```sql
-- Customers can view their own orders
CREATE POLICY "Customers can view their own orders"
  ON orders FOR SELECT
  USING (
    auth.uid() IS NOT NULL OR
    customer_email = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- Purchase site can create orders
CREATE POLICY "Orders can be created by anyone"
  ON orders FOR INSERT
  WITH CHECK (true);
```

## API Endpoints

### Event Availability

**Endpoint:** `GET /functions/v1/event-availability/:eventName`

**Response:**
```json
{
  "event": {
    "id": "uuid",
    "name": "Perreo Fridays",
    "event_date": "2025-01-15T21:00:00Z",
    "venue_capacity": 500
  },
  "availability": [
    {
      "name": "VIP",
      "price": 50.00,
      "capacity": 100,
      "sold": 75,
      "available": 25,
      "sold_out": false
    }
  ],
  "summary": {
    "total_capacity": 500,
    "total_sold": 425,
    "total_available": 75,
    "is_sold_out": false
  }
}
```

### Ticket Webhook

**Endpoint:** `POST /functions/v1/ticket-webhook`

**Purpose:** Create tickets after payment

**Request:**
```json
{
  "orderId": "uuid",
  "eventName": "Perreo Fridays",
  "ticketType": "VIP",
  "quantity": 2,
  "customerEmail": "customer@example.com",
  "customerName": "John Doe",
  "stripePaymentIntentId": "pi_xxx",
  "pricePaid": 100.00
}
```

## Environment Variables

### Main Website

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Purchase Website

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...  # Server-side only
SENDGRID_API_KEY=your-key
VITE_PURCHASE_SITE_URL=https://your-purchase-site.com
```

### Scanner Site

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_QR_SIGNING_SECRET=your-secret
VITE_TWILIO_ACCOUNT_SID=your-sid
VITE_TWILIO_AUTH_TOKEN=your-token
# ... other scanner-specific vars
```

## CORS Configuration

In Supabase Dashboard → Settings → API:

Add allowed origins:
- `https://your-main-website.com`
- `https://your-purchase-website.com`
- `https://your-scanner-site.com`

## Real-Time Subscriptions

### Main Website Subscription

```typescript
// Subscribe to event changes
const channel = supabase
  .channel('events-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'events'
  }, () => {
    // Refetch events
    fetchEvents()
  })
  .subscribe()
```

### Purchase Website Subscription

```typescript
// Subscribe to ticket availability changes
const channel = supabase
  .channel('availability-changes')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'tickets',
    filter: `event_name=eq.${eventName}`
  }, () => {
    // Refetch availability
    checkAvailability()
  })
  .subscribe()
```

## Best Practices

### 1. Single Source of Truth

- ✅ Scanner Site is the only place to create/edit events
- ✅ Main Website and Purchase Website only read events
- ✅ All sites use same Supabase project

### 2. Availability Checking

- ✅ Always check availability before allowing checkout
- ✅ Use database functions for accurate counts
- ✅ Handle race conditions (multiple simultaneous purchases)

### 3. Error Handling

- ✅ Gracefully handle network errors
- ✅ Show user-friendly error messages
- ✅ Log errors for debugging

### 4. Performance

- ✅ Cache event data (5-10 minutes)
- ✅ Use real-time subscriptions sparingly
- ✅ Optimize database queries with indexes

### 5. Security

- ✅ Never expose service keys client-side
- ✅ Use RLS policies to protect data
- ✅ Validate all inputs server-side
- ✅ Verify Stripe webhook signatures

## Troubleshooting

### Events Not Showing on Main Website

1. Check Supabase connection
2. Verify `is_active = true` for events
3. Check CORS settings
4. Verify RLS policies allow public read

### Availability Not Updating

1. Check real-time subscription is active
2. Verify database function is working
3. Check for errors in browser console
4. Verify ticket creation is successful

### Tickets Not Appearing in Scanner

1. Verify ticket creation succeeded
2. Check `event_name` matches exactly
3. Verify `status = 'issued'`
4. Check Supabase logs for errors

### Webhook Not Creating Tickets

1. Verify webhook secret matches
2. Check Stripe webhook logs
3. Verify Supabase function is deployed
4. Check function logs in Supabase dashboard

## Testing Checklist

- [ ] Event created in Scanner appears on Main Website
- [ ] Event appears on Purchase Website
- [ ] Availability updates in real-time
- [ ] Ticket purchase creates tickets in database
- [ ] Tickets appear in Scanner Site immediately
- [ ] QR codes scan correctly
- [ ] Email delivery works
- [ ] Capacity limits enforced
- [ ] Sold-out events show correctly
- [ ] Real-time sync works across all sites

## Support

For issues:
1. Check Supabase Dashboard → Logs
2. Verify environment variables are set
3. Check browser console for errors
4. Review RLS policies
5. Test database functions directly

