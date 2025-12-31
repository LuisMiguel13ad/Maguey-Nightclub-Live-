# Event Creation Fix - Instructions

## Problem
Event creation is blocked by:
1. **RLS (Row Level Security) policies** preventing inserts into the `events` table
2. **React hook errors** causing the Events page to crash
3. **Permission errors** when querying user-related tables

## Solution

### Option 1: Fix RLS Policies (Recommended)
Run the SQL migration to allow authenticated users to create events:

```bash
# In Supabase Dashboard > SQL Editor, run:
```

Copy and paste the contents of `supabase/migrations/fix_rls_for_events.sql` into the SQL Editor and execute it.

This will:
- Allow authenticated users to insert/update/delete events
- Allow public read access to published events (for main site and purchase site)

### Option 2: Use Service Role Key Script
If you have the Supabase service role key:

1. Get your service role key from: Supabase Dashboard > Settings > API > `service_role` key

2. Run the script:
```bash
cd maguey-gate-scanner
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here npx tsx create-event-with-service-key.ts
```

Or edit `create-event-with-service-key.ts` and replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual key.

### Option 3: Create Event via Supabase Dashboard
1. Go to Supabase Dashboard > Table Editor > `events`
2. Click "Insert" > "Insert row"
3. Fill in:
   - name: `La Maquinaria Norteña, La Energía Norteña y Mister Cumbia`
   - event_date: `2025-12-14`
   - event_time: `21:00:00`
   - venue_name: `El Maguey`
   - image_url: `https://boletaje.com/admin/img_principal/1764023314.png`
   - status: `published`
   - is_active: `true`
   - published_at: (current timestamp)

4. Then create ticket type in `ticket_types` table:
   - event_id: (the event ID from step 3)
   - name: `GENERAL`
   - code: `GEN`
   - price: `50.00`
   - total_inventory: `500`

## Files Created

1. **`supabase/migrations/fix_rls_for_events.sql`** - SQL migration to fix RLS policies
2. **`create-event-with-service-key.ts`** - Script to create event using service role key
3. **`create-event-authenticated.ts`** - Script to create event with authenticated session
4. **`create-event.ts`** - Basic script (requires RLS fix first)

## Next Steps After Creating Event

1. **Verify on Owner Dashboard** (http://localhost:3005/events)
   - Event should appear in the events list
   - Should be able to edit/delete it

2. **Verify on Main Site** (http://localhost:3000)
   - Event should appear in upcoming events section
   - Should be clickable and show details

3. **Verify on Purchase Site** (http://localhost:5173)
   - Event should appear in event listings
   - Should be purchasable

4. **Test Purchase Flow**
   - Purchase a ticket for the event
   - Verify ticket is created in `tickets` table
   - Verify order is created in `orders` table

5. **Test Scanner**
   - Use the ticket scanner (http://localhost:3005/scanner)
   - Scan the purchased ticket QR code
   - Verify it scans successfully

## Troubleshooting

### "Permission denied for table user" error
This is likely from a component trying to query user tables that don't exist or have RLS blocking access. The queries are already wrapped in try-catch, so they shouldn't break the page, but you may see console errors.

### "Rendered fewer hooks than expected" error
This React error suggests a component is conditionally calling hooks or has an early return. Check browser console for the specific component causing the issue.

### RLS still blocking after migration
Make sure:
- The migration ran successfully
- You're authenticated as a user (not anonymous)
- The user has the `owner` role in their metadata (if your RLS checks for role)

