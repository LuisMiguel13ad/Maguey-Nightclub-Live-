# Supabase Realtime Setup Guide

This guide explains how to enable Realtime subscriptions for automatic event synchronization between the ticket purchase website and the scanner website.

## Why Realtime?

When you update events on one website (purchase site or scanner site), they will **automatically** update on the other website in real-time. No manual refresh needed!

## Step 1: Enable Realtime for Events Table

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Database** → **Replication**
4. Find the `events` table in the list
5. Toggle **Realtime** to **ON** for the `events` table

Alternatively, you can run this SQL in the SQL Editor:

```sql
-- Enable Realtime for events table
ALTER PUBLICATION supabase_realtime ADD TABLE events;
```

## Step 2: Verify Realtime is Enabled

Run this query to verify:

```sql
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN tablename = 'events' THEN 'Enabled'
    ELSE 'Check manually'
  END as realtime_status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

You should see the `events` table listed.

## Step 3: Test the Integration

### On Purchase Website:

1. Open the Events page (`/events`)
2. Events should load from the database automatically
3. If you update an event in Supabase, the page should update automatically

### On Scanner Website:

1. Connect to the same Supabase database
2. Use the `subscribeToEvents` function from `events-service.ts`
3. Events will sync automatically when updated

## How It Works

1. **Events Service** (`src/lib/events-service.ts`):
   - `subscribeToEvents()` creates a Realtime subscription
   - Listens for INSERT, UPDATE, DELETE events on the `events` table
   - Automatically refetches events when changes occur
   - Calls the callback function with updated events

2. **Events Page** (`src/pages/Events.tsx`):
   - Subscribes to events on component mount
   - Updates the UI automatically when events change
   - Unsubscribes on component unmount

3. **Event Detail Page** (`src/pages/EventDetail.tsx`):
   - Fetches individual events by ID
   - Can also subscribe to specific event changes if needed

## Troubleshooting

### Events not updating automatically?

1. **Check Realtime is enabled**: Go to Database → Replication and verify `events` table is enabled
2. **Check browser console**: Look for any errors related to Supabase Realtime
3. **Check network tab**: Verify WebSocket connection is established (look for `realtime` connection)
4. **Check RLS policies**: Ensure your RLS policies allow reading the `events` table

### Connection issues?

1. Verify your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
2. Check that your Supabase project allows Realtime connections
3. Ensure your network allows WebSocket connections

## Scanner Website Integration

To connect your separate scanner website:

1. **Use the same Supabase credentials**:
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   
   const supabase = createClient(
     process.env.SUPABASE_URL,      // Same as purchase site
     process.env.SUPABASE_ANON_KEY  // Same as purchase site
   );
   ```

2. **Copy the events-service.ts file** to your scanner website

3. **Subscribe to events**:
   ```typescript
   import { subscribeToEvents } from '@/lib/events-service';
   
   useEffect(() => {
     const unsubscribe = subscribeToEvents((events) => {
       // Update your scanner UI with events
       setEvents(events);
     });
     
     return () => unsubscribe();
   }, []);
   ```

4. **That's it!** Events will automatically sync between both websites.

## Benefits

✅ **Automatic Sync**: Update events once, both sites update automatically  
✅ **Real-time**: Changes appear instantly (usually within 1-2 seconds)  
✅ **No Manual Refresh**: Users don't need to refresh the page  
✅ **Scalable**: Works with multiple websites connected to the same database  
✅ **Reliable**: Built on Supabase's proven Realtime infrastructure

## Next Steps

- [ ] Enable Realtime for `events` table in Supabase Dashboard
- [ ] Test event updates and verify automatic sync
- [ ] Integrate events-service.ts into your scanner website
- [ ] Test synchronization between both websites

