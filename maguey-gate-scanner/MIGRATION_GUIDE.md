# Migration Guide: Re-entry Tracking

## Step 1: Apply the Migration

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/20250113000001_add_reentry_tracking.sql`
6. Paste into the SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)
8. Verify success - you should see "Success. No rows returned"

### Option B: Using Supabase CLI (If Installed)

```bash
# If you have Supabase CLI installed
supabase db push
```

## Step 2: Verify Migration

After running the migration, verify it worked:

1. Go to **Table Editor** in Supabase Dashboard
2. Check that `scan_history` table exists
3. Check that `tickets` table has new columns:
   - `current_status`
   - `entry_count`
   - `exit_count`
   - `last_entry_at`
   - `last_exit_at`

## Step 3: Test Features

### Test 1: Audio Feedback ✅

1. Start dev server: `npm run dev`
2. Navigate to Scanner page
3. Click the **Settings** icon (gear) to open Audio & Haptic Settings
4. Enable **Sound Feedback** and **Haptic Feedback**
5. Adjust volume slider
6. Click **Test Success**, **Test Error**, **Test Warning** buttons
7. You should hear sounds and feel vibrations (on mobile)
8. Scan a ticket - you should hear success/error sounds

### Test 2: Offline Queue ✅

1. Make sure dev server is running: `npm run dev`
2. Open browser DevTools (F12) → Network tab
3. Enable **Offline** mode (throttle to "Offline")
4. Scan a ticket
5. You should see:
   - "Scan Queued" toast message
   - Sync status showing "X pending"
6. Disable offline mode (set back to "Online")
7. Wait a few seconds - scans should auto-sync
8. You should see "Sync Complete" toast

### Test 3: Re-entry Tracking ✅

**Prerequisites:** Make sure migration is applied!

1. Navigate to Scanner page
2. Switch **Re-entry Mode** to "Re-entry" (not "Single")
3. Scan a ticket - should work normally
4. Scan the **same ticket again** - should work! (not blocked)
5. Check the ticket result - you should see:
   - Current Status badge (Inside/Outside)
   - Entry/Exit counts
   - Scan History timeline
6. Switch to "Exit Tracking" mode
7. Scan same ticket - should toggle between entry/exit

### Test 4: Dashboard Stats ✅

1. Navigate to Dashboard (owner role required)
2. Check for **"Currently Inside"** stat card
3. Should show count of tickets with `current_status = 'inside'`
4. This updates in real-time as tickets are scanned

## Troubleshooting

### Migration Fails

**Error: "relation already exists"**
- The table/columns already exist - this is fine, migration uses `IF NOT EXISTS`
- Check if migration partially ran

**Error: "permission denied"**
- Make sure you're using the SQL Editor with proper permissions
- Try running as service role if needed

### Audio Not Working

- Check browser permissions for audio
- Some browsers require user interaction before playing sounds
- Try clicking "Test Success" button first
- Check browser console for errors

### Offline Queue Not Working

- Make sure you're actually offline (check Network tab)
- Check browser console for IndexedDB errors
- Verify Dexie.js is installed: `npm list dexie`

### Re-entry Not Working

- **Most Important:** Make sure migration is applied!
- Check browser console for errors
- Verify you switched to "Re-entry" or "Exit Tracking" mode
- Check Supabase logs for errors

## Verification Checklist

- [ ] Migration applied successfully
- [ ] `scan_history` table exists
- [ ] `tickets` table has re-entry columns
- [ ] Audio feedback plays on scan
- [ ] Offline queue stores scans
- [ ] Auto-sync works when online
- [ ] Re-entry mode allows multiple scans
- [ ] Scan history shows in ticket results
- [ ] Dashboard shows "Currently Inside" count

## Need Help?

Check browser console (F12) for errors and Supabase Dashboard → Logs for database errors.

