# 🔧 Fix Event Visibility Issue

## ✅ Event Status: CONFIRMED WORKING

The event "PRE THANKSGIVING BASH" exists in the database and passes all visibility checks:
- ✅ Status: published
- ✅ is_active: true  
- ✅ Date: 2025-11-26 (future date)
- ✅ Has 3 ticket types configured

**The event is queryable and should appear on all sites.**

---

## 🔍 Troubleshooting Steps

### Step 1: Hard Refresh Browser Pages

**Main Website:**
1. Go to: http://localhost:3000
2. Press: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows/Linux)
3. Or: Open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

**Purchase Website:**
1. Go to: http://localhost:5173/events
2. Press: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows/Linux)

**Dashboard:**
1. Go to: http://localhost:5175/events
2. Press: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows/Linux)

### Step 2: Check Browser Console

1. Open browser DevTools (F12)
2. Go to "Console" tab
3. Look for errors (red text)
4. Common issues:
   - `Supabase not configured` → Check .env file
   - `Network error` → Check if Supabase is accessible
   - `CORS error` → Check Supabase CORS settings

### Step 3: Verify Sites Are Running

Make sure all sites are running:

```bash
# Check if sites are running
# Main Website (port 3000)
curl http://localhost:3000

# Purchase Website (port 5173)
curl http://localhost:5173

# Scanner Dashboard (port 5175)
curl http://localhost:5175
```

### Step 4: Check Supabase Connection

**Main Website:**
- Check `.env` file has:
  ```
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```

**Purchase Website:**
- Check `.env` file has:
  ```
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```

**Scanner Dashboard:**
- Check `.env` file has:
  ```
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
  ```

### Step 5: Wait for Real-Time Sync

If you just created the event:
- Wait 5-10 seconds for real-time subscriptions to sync
- Or manually refresh the pages

### Step 6: Direct Database Query Test

Run this to verify the event is queryable:

```bash
cd maguey-gate-scanner
npx tsx debug-event-visibility.ts
```

This will show you exactly what events are being returned by the queries.

---

## 🎯 Quick Fix Commands

### Force Event Refresh (if needed)

```bash
cd maguey-gate-scanner
npx tsx check-event-status.ts
```

This will verify and fix any visibility issues automatically.

---

## 📋 What to Check

1. **Which site are you checking?**
   - [ ] Main Website (http://localhost:3000)
   - [ ] Purchase Website (http://localhost:5173/events)
   - [ ] Dashboard (http://localhost:5175/events)

2. **What do you see?**
   - [ ] No events at all
   - [ ] Other events but not "PRE THANKSGIVING BASH"
   - [ ] Error message
   - [ ] Loading spinner that never stops

3. **Browser Console Errors?**
   - Open DevTools (F12) → Console tab
   - Copy any red error messages

---

## ✅ Expected Results

After fixing, you should see:

**Main Website:**
- "PRE THANKSGIVING BASH" in the events list
- Date: November 26, 2025
- Should be 4th event in the list

**Purchase Website:**
- "PRE THANKSGIVING BASH" in the events list
- Clicking it shows 3 ticket types:
  - Women - Before 10 PM ($0)
  - Men - Before 10 PM ($35)
  - General Admission - After 10 PM ($50)

**Dashboard:**
- "PRE THANKSGIVING BASH" in the events list
- Status shows as "Published"
- Can edit/view event details

---

## 🆘 Still Not Working?

If the event still doesn't appear after trying all steps:

1. **Check the exact URL you're visiting**
   - Main Website: Should be `/` or `/events`
   - Purchase Website: Should be `/events`
   - Dashboard: Should be `/events`

2. **Verify event date**
   - Event date: 2025-11-26
   - Today: 2025-11-20
   - Event is in the future ✅

3. **Check RLS Policies**
   - Events table should allow public SELECT
   - Run: `npx tsx check-event-status.ts` to verify

4. **Check Network Tab**
   - Open DevTools → Network tab
   - Refresh page
   - Look for requests to Supabase
   - Check if they return the event data

---

**The event is definitely in the database and queryable. The issue is likely browser cache or connection configuration.**

