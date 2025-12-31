# Database Setup Guide

## Overview

This guide will help you set up the database schema for the ticket purchase and scanner system.

## Prerequisites

1. Supabase account (https://supabase.com)
2. Supabase project created
3. SQL Editor access in Supabase Dashboard

## Migration Files

Migration files available:

1. **20250115000000_create_ticket_system.sql** - Creates all tables and schema
2. **20250115000001_add_event_image_to_tickets.sql** - Ensures event_id and image_url columns exist
3. **20250115000002_seed_events.sql** - Seeds initial event data
4. **20250201000000_add_rls_policies.sql** - Adds promoter/scanner RLS policies
5. **20250201001000_create_promotions_table.sql** - Creates `promotions` table for promo codes
6. **20250301090000_update_tickets_add_security_columns.sql** - Ensures ticket QR/security columns exist

## Setup Steps

### Step 1: Run Main Migration

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/20250115000000_create_ticket_system.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

This creates:
- ✅ `events` table (with `image_url` column)
- ✅ `orders` table
- ✅ `tickets` table (with `event_id` column)
- ✅ `payments` table
- ✅ Indexes for performance
- ✅ Row Level Security (RLS) policies
- ✅ Triggers for `updated_at` timestamps

### Step 2: Run Event Image Migration

1. In SQL Editor, create a new query
2. Copy and paste contents of `supabase/migrations/20250115000001_add_event_image_to_tickets.sql`
3. Click **Run**

This ensures:
- ✅ `event_id` column exists in `tickets` table
- ✅ `image_url` column exists in `events` table
- ✅ Creates optimized view for scanner queries
- ✅ Adds indexes for JOIN performance

### Step 3: Ensure Ticket Security Columns

1. In SQL Editor, create a new query
2. Copy and paste contents of `supabase/migrations/20250301090000_update_tickets_add_security_columns.sql`
3. Click **Run**

This guarantees:
- ✅ `qr_token`, `qr_signature`, `status`, `issued_at`, `metadata` columns exist
- ✅ Existing rows backfilled with sensible defaults
- ✅ Comments documenting each security column

### Step 4: Seed Events Data

1. In SQL Editor, create a new query
2. Copy and paste contents of `supabase/migrations/20250115000002_seed_events.sql`
3. Click **Run**

This adds:
- ✅ 3 initial events (Reggaeton Nights, Cumbia Fest, Regional Mexican Night)
- ✅ Event images for each event
- ✅ All event details

> Optional: if you plan to offer promo codes, run `supabase/migrations/20250201001000_create_promotions_table.sql` and seed the `promotions` table with active codes.

### Step 4: Verify Setup

Run this query to verify everything is set up correctly:

```sql
-- Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('events', 'orders', 'tickets', 'payments');

-- Verify events have image_url
SELECT id, name, image_url 
FROM events;

-- Verify tickets table has event_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tickets' 
AND column_name IN ('event_id', 'ticket_id');

-- Test the scanner view
SELECT * FROM ticket_scan_view LIMIT 1;
```

## Database Schema

### Events Table
```sql
events (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  genre VARCHAR,
  image_url VARCHAR NOT NULL,  -- ✅ Event image
  venue_name VARCHAR NOT NULL,
  venue_address VARCHAR NOT NULL,
  city VARCHAR,
  description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Tickets Table
```sql
tickets (
  id UUID PRIMARY KEY,
  ticket_id VARCHAR UNIQUE NOT NULL,  -- QR code data
  order_id UUID REFERENCES orders(id),
  event_id VARCHAR REFERENCES events(id),  -- ✅ Links to event
  ticket_type VARCHAR NOT NULL,
  ticket_type_name VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  price DECIMAL(10, 2),
  fee DECIMAL(10, 2),
  total DECIMAL(10, 2),
  issued_at TIMESTAMP,
  checked_in_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Scanner View

A view `ticket_scan_view` has been created that joins tickets with events:

```sql
SELECT * FROM ticket_scan_view WHERE ticket_id = 'MGY-PF-20251115-ABC123';
```

This returns:
- All ticket data
- Event name, image, date, time, venue
- Customer information
- Order details

## Row Level Security (RLS)

Run migration `20250201000000_add_rls_policies.sql` to enable promoter/scanner policies. It:
- Enables RLS on `events`, `ticket_types`, `orders`, `tickets`, `ticket_scan_logs`
- Adds helper `jwt_role()` which reads the JWT `role` claim (defaults to `anon`)
- Grants:
  - anon/authenticated read-only access to events and ticket_types
  - promoters full CRUD on orders/tickets and read of scan logs
  - scanners read on orders/tickets/scan logs and update on ticket status

### Setting JWT Roles

Assign roles via Supabase Admin API:
```ts
import { createClient } from '@supabase/supabase-js';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

await admin.auth.admin.updateUserById(userId, {
  app_metadata: { role: 'promoter' }, // or 'scanner'
});
```

When issuing custom JWTs (Edge Functions, auth server), merge `app_metadata.role` into the JWT payload so `auth.jwt()` exposes it.

### Applying RLS Migrations

1. `supabase db push` to apply `20250201000000_add_rls_policies.sql`.
2. Verify policies:
   ```sql
   set role anon;
   select count(*) from events; -- succeeds

   reset role;
   set request.jwt.claims = '{"role": "scanner"}';
   select status from tickets limit 1; -- succeeds
   update tickets set status = 'scanned' limit 1; -- succeeds
   ```
3. Reset the `request.jwt.claims` setting after testing:
   ```sql
   reset session authorization;
   ```

- Promo codes rely on the `promotions` table; ensure only promoters can create/update entries.

## Testing

### Test Event Data
```sql
SELECT * FROM events;
-- Should return 3 events with image_url populated
```

### Test Ticket Creation (via webhook)
After a successful payment, tickets should be created with:
- ✅ `event_id` populated
- ✅ `ticket_id` in format: `MGY-PF-YYYYMMDD-XXXXXX`
- ✅ Status: `issued`

### Test Scanner Query
```sql
-- Simulate scanning a ticket
SELECT * FROM ticket_scan_view 
WHERE ticket_id = 'MGY-PF-20251115-ABC123';
-- Should return ticket with event image
```

## Troubleshooting

### "relation does not exist" error
- Make sure you ran the migrations in order
- Check that you're in the correct database/schema

### "column does not exist" error
- Run the second migration (`20250115000001_add_event_image_to_tickets.sql`)
- It adds missing columns safely

### RLS blocking queries
- For scanner, use service role key
- Or create a scanner-specific RLS policy

### Events not showing
- Run the seed migration (`20250115000002_seed_events.sql`)
- Or insert events manually via Supabase Dashboard

## Next Steps

1. ✅ Run all migrations
2. ✅ Verify tables and data
3. ✅ Test ticket scanning with `ScannerTicketDisplay` component
4. ✅ Integrate scanner service into your scanner project

## Scanner Integration

See `SCANNER_INTEGRATION_GUIDE.md` for:
- How to use `ScannerTicketDisplay` component
- How to use `scanner-service.ts` functions
- Complete scanner implementation examples

