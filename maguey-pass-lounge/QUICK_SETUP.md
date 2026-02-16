# Quick Setup Guide

## Step 1: Run Database Migrations in Supabase

### 1.1 Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar

### 1.2 Run Migration 1: Create Ticket System
1. Click **New Query**
2. Copy the entire contents of `supabase/migrations/20250115000000_create_ticket_system.sql`
3. Paste into the SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. ✅ Should see: "Success. No rows returned"

### 1.3 Run Migration 2: Add Event Image Support
1. Click **New Query**
2. Copy the entire contents of `supabase/migrations/20250115000001_add_event_image_to_tickets.sql`
3. Paste into the SQL Editor
4. Click **Run**
5. ✅ Should see: "Success. No rows returned"

### 1.4 Run Migration 3: Seed Events
1. Click **New Query**
2. Copy the entire contents of `supabase/migrations/20250115000002_seed_events.sql`
3. Paste into the SQL Editor
4. Click **Run**
5. ✅ Should see: "Success. No rows returned" or "INSERT 0 3"

## Step 2: Verify Database Setup

### 2.1 Run Verification Queries
1. In SQL Editor, click **New Query**
2. Copy and paste the contents of `VERIFY_DATABASE.sql`
3. Click **Run**
4. Verify:
   - ✅ 4 tables exist (events, orders, tickets, payments)
   - ✅ 3 events are seeded
   - ✅ All events have image_url populated
   - ✅ tickets table has event_id column
   - ✅ ticket_scan_view exists

### 2.2 Quick Verification
Run these quick queries:

```sql
-- Check events
SELECT id, name, image_url FROM events;
-- Should show 3 events with image URLs

-- Check view
SELECT * FROM ticket_scan_view LIMIT 1;
-- Should work (may return empty if no tickets yet)
```

## Step 3: Connect Your Scanner Website

### 3.1 Scanner Website Integration
This purchase website connects to your **separate scanner website** through the shared database.

**Your scanner website should:**
1. Connect to the same Supabase database
2. Use `ticket_scan_view` to query tickets
3. Display event images from the query results

See `SCANNER_WEBSITE_INTEGRATION.md` for detailed integration guide.

### 3.2 Reference Components
Reference scanner components are available in this repo (for your scanner website):
- `src/lib/scanner-service.ts` - Scanner service functions (copy to your scanner site)
- `src/components/scanner/ScannerTicketDisplay.tsx` - UI component example (copy to your scanner site)

These are **examples only** - not used in this purchase website.

### 3.3 Create a Test Ticket (Optional)
To test the scanner, you can create a test ticket in Supabase:

```sql
-- First, create a test order
INSERT INTO orders (
  event_id,
  customer_first_name,
  customer_last_name,
  customer_email,
  total,
  status
) VALUES (
  '1',
  'Test',
  'User',
  'test@example.com',
  50.00,
  'paid'
) RETURNING id;

-- Then create a test ticket (replace ORDER_ID with the ID from above)
INSERT INTO tickets (
  ticket_id,
  order_id,
  event_id,
  ticket_type,
  ticket_type_name,
  status,
  price,
  fee,
  total,
  expires_at
) VALUES (
  'MGY-PF-20251115-TEST01',
  'ORDER_ID_HERE',  -- Replace with actual order ID
  '1',
  'vip',
  'VIP Entry',
  'issued',
  50.00,
  0,
  50.00,
  '2025-11-15 23:59:59'
);
```

### 3.4 Test in Your Scanner Website
1. In your scanner website, scan ticket: `MGY-PF-20251115-TEST01`
2. ✅ Should see:
   - Event image displayed (from `ticket_scan_view.event_image`)
   - Event name: "Reggaeton Nights"
   - Ticket details
   - Check-in functionality

**Note**: This purchase website does not include a scanner - use your separate scanner website to validate tickets.

## Step 4: Verify Everything Works

### ✅ Checklist
- [ ] All 3 migrations ran successfully
- [ ] 3 events exist in database
- [ ] All events have image_url
- [ ] tickets table has event_id column
- [ ] ticket_scan_view exists
- [ ] Purchase website working (ticket creation)
- [ ] Scanner website connected to same database
- [ ] Scanner website can query ticket_scan_view
- [ ] Event images display in scanner website

## Troubleshooting

### Migration Errors
- **"relation already exists"**: Tables already exist, this is fine
- **"column already exists"**: Column already exists, migration is safe to run again
- **"permission denied"**: Check you're using the correct Supabase project

### Scanner Website Issues
- **"ticket_scan_view does not exist"**: Run migration 2 again in Supabase
- **"ticket not found"**: Create a test ticket first (see Step 3.3)
- **"RLS policy violation"**: Use service role key for scanner website, or check RLS policies
- **"Event image not showing"**: Verify `ticket_scan_view` query includes `event_image` field

### Dev Server Issues
- **Port already in use**: Stop other servers or change port in `vite.config.ts`
- **Cannot connect**: Check `.env` file has correct Supabase credentials

## Next Steps

1. ✅ Migrations complete
2. ✅ Database verified
3. ✅ Purchase website ready
4. ✅ Scanner website can connect
5. 🎯 Ready for production!

For more details, see:
- `DATABASE_SETUP.md` - Full database setup guide
- `SCANNER_WEBSITE_INTEGRATION.md` - Connect your scanner website
- `ARCHITECTURE.md` - System architecture overview
- `SCANNER_INTEGRATION_GUIDE.md` - Scanner integration reference code

