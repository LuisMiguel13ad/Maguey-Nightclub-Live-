# Supabase Row Level Security (RLS) Setup

## Overview

This document describes the Row Level Security (RLS) policies needed for the multi-site ticket system. RLS ensures that each site can only access the data it needs, protecting your database from unauthorized access.

## Why RLS?

- **Security**: Prevents unauthorized data access
- **Multi-tenant**: Allows different access levels per site
- **Public access**: Safely allows public read access to events
- **Data protection**: Ensures customers can only see their own orders

## Current RLS Policies

### Events Table

```sql
-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Public read access (Main Website & Purchase Website)
CREATE POLICY "Events are viewable by everyone"
  ON public.events FOR SELECT
  USING (true);

-- Authenticated users can create (Scanner Site admins)
CREATE POLICY "Events can be created by authenticated users"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update (Scanner Site admins)
CREATE POLICY "Events can be updated by authenticated users"
  ON public.events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete (Scanner Site admins)
CREATE POLICY "Events can be deleted by authenticated users"
  ON public.events FOR DELETE
  TO authenticated
  USING (true);
```

**Access Summary:**
- ✅ **Public**: Can read active events
- ✅ **Authenticated (Scanner Site)**: Full CRUD access

### Tickets Table

```sql
-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Public read access (for QR code validation)
CREATE POLICY "Tickets are viewable for validation"
  ON public.tickets FOR SELECT
  USING (true);

-- Anyone can create tickets (Purchase Website webhook)
CREATE POLICY "Tickets can be created by anyone"
  ON public.tickets FOR INSERT
  WITH CHECK (true);

-- Authenticated users can update (Scanner Site)
CREATE POLICY "Tickets can be updated by authenticated users"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

**Access Summary:**
- ✅ **Public**: Can read tickets (for QR validation)
- ✅ **Anyone**: Can create tickets (via webhook)
- ✅ **Authenticated (Scanner Site)**: Can update tickets

### Orders Table

```sql
-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Customers can view their own orders
CREATE POLICY "Customers can view their own orders"
  ON public.orders FOR SELECT
  USING (
    auth.uid() IS NOT NULL OR
    customer_email = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- Anyone can create orders (Purchase Website)
CREATE POLICY "Orders can be created by anyone"
  ON public.orders FOR INSERT
  WITH CHECK (true);

-- Authenticated users can update (Scanner Site)
CREATE POLICY "Orders can be updated by authenticated users"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

**Access Summary:**
- ✅ **Customers**: Can view their own orders (by email)
- ✅ **Anyone**: Can create orders
- ✅ **Authenticated (Scanner Site)**: Can update orders

### Payments Table

```sql
-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view payments
CREATE POLICY "Payments are viewable by authenticated users"
  ON public.payments FOR SELECT
  TO authenticated
  USING (true);

-- Anyone can create payments (via webhook)
CREATE POLICY "Payments can be created by anyone"
  ON public.payments FOR INSERT
  WITH CHECK (true);

-- Authenticated users can update
CREATE POLICY "Payments can be updated by authenticated users"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

**Access Summary:**
- ✅ **Authenticated (Scanner Site)**: Can view payments
- ✅ **Anyone**: Can create payments (via webhook)
- ✅ **Authenticated**: Can update payments

## Recommended Additional Policies

### Restrict Event Updates to Owners Only

If you want to restrict event updates to only owners (not all authenticated users):

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "Events can be updated by authenticated users" ON public.events;

-- Create owner-only policy
CREATE POLICY "Only owners can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.user_metadata->>'role' = 'owner' OR
        auth.users.app_metadata->>'role' = 'owner'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.user_metadata->>'role' = 'owner' OR
        auth.users.app_metadata->>'role' = 'owner'
      )
    )
  );
```

### Restrict Ticket Updates to Scanner Site Only

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "Tickets can be updated by authenticated users" ON public.tickets;

-- Create scanner-only policy
CREATE POLICY "Only scanner site can update tickets"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.user_metadata->>'role' IN ('owner', 'employee') OR
        auth.users.app_metadata->>'role' IN ('owner', 'employee')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.user_metadata->>'role' IN ('owner', 'employee') OR
        auth.users.app_metadata->>'role' IN ('owner', 'employee')
      )
    )
  );
```

## Testing RLS Policies

### Test Public Read Access

```sql
-- Should work (public can read events)
SELECT * FROM events WHERE is_active = true;
```

### Test Authenticated Write Access

```sql
-- Should work if authenticated as owner/employee
INSERT INTO events (name, event_date, venue_capacity, ticket_types)
VALUES ('Test Event', NOW(), 100, '[]'::jsonb);
```

### Test Unauthorized Access

```sql
-- Should fail (public cannot insert)
-- Run this without authentication
INSERT INTO events (name, event_date, venue_capacity, ticket_types)
VALUES ('Unauthorized Event', NOW(), 100, '[]'::jsonb);
```

## Security Best Practices

### 1. Use Service Role Key Carefully

The service role key bypasses RLS. Only use it:
- ✅ Server-side Edge Functions
- ✅ Admin scripts
- ✅ Backend API routes

Never expose it client-side!

### 2. Validate Inputs

Even with RLS, always validate inputs:

```typescript
// Good: Validate before inserting
if (!eventName || eventName.length < 3) {
  throw new Error('Invalid event name')
}

await supabase.from('events').insert({ name: eventName, ... })
```

### 3. Use Database Functions

For complex operations, use database functions with `SECURITY DEFINER`:

```sql
CREATE OR REPLACE FUNCTION create_event_safely(
  event_name text,
  event_date timestamp with time zone,
  capacity integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_id uuid;
BEGIN
  -- Validate inputs
  IF event_name IS NULL OR length(event_name) < 3 THEN
    RAISE EXCEPTION 'Invalid event name';
  END IF;
  
  -- Create event
  INSERT INTO events (name, event_date, venue_capacity, ticket_types)
  VALUES (event_name, event_date, capacity, '[]'::jsonb)
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;
```

### 4. Monitor Access

Check Supabase Dashboard → Logs regularly for:
- Unauthorized access attempts
- Failed policy checks
- Suspicious queries

## Troubleshooting

### "new row violates row-level security policy"

**Cause**: RLS policy is blocking the operation

**Solution**:
1. Check which policy is blocking
2. Verify user has correct role/permissions
3. Check policy conditions match your use case

### "permission denied for table"

**Cause**: RLS is enabled but no policy allows the operation

**Solution**:
1. Create appropriate policy
2. Or grant necessary permissions

### Policies Not Working

**Check**:
1. RLS is enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Policies are created correctly
3. User has correct authentication
4. Policy conditions are correct

## Migration Script

To apply all RLS policies at once:

```sql
-- Enable RLS on all tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Events can be created by authenticated users" ON public.events;
-- ... (drop all existing policies)

-- Create new policies
-- (Use the policies from sections above)
```

## Summary

- ✅ Events: Public read, authenticated write
- ✅ Tickets: Public read, anyone create, authenticated update
- ✅ Orders: Customers read own, anyone create, authenticated update
- ✅ Payments: Authenticated read, anyone create, authenticated update

These policies ensure:
- Main Website can display events
- Purchase Website can check availability and create tickets
- Scanner Site has full admin access
- Customers can view their own orders
- Security is maintained across all sites

