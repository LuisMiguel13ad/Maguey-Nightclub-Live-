# 🔧 Fix: Event Not Showing on Main & Purchase Sites

## ✅ CONFIRMED: Event Exists and Is Queryable

The test confirmed:
- ✅ Event "PRE THANKSGIVING BASH" exists in database
- ✅ Status: published
- ✅ is_active: true
- ✅ Date: 2025-11-26 (future date)
- ✅ Has 3 ticket types
- ✅ **Appears in query results** (4th event in list)
- ✅ All sites connected to SAME database

**The event IS in the database and SHOULD be visible.**

---

## 🔧 SOLUTION: Restart Development Servers

The most common reason events don't appear is that the development servers need to be restarted to pick up new data.

### Step 1: Restart Main Website

```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd maguey-nights
npm run dev
```

**Wait for:** Server to start on http://localhost:3000

### Step 2: Restart Purchase Website

```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd maguey-pass-lounge
npm run dev
```

**Wait for:** Server to start on http://localhost:5173

### Step 3: Hard Refresh Browser Pages

After servers restart:

1. **Main Website:** http://localhost:3000
   - Press: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)
   - Or: Open DevTools (F12) → Right-click refresh → "Empty Cache and Hard Reload"

2. **Purchase Website:** http://localhost:5173/events
   - Press: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)

---

## 🔍 Alternative: Check Browser Console

If restarting doesn't work:

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for:
   - `🔍 Fetching events for date >= 2025-11-20`
   - `📊 Query result: { dataCount: 22, error: 'none' }`
   - Any red error messages

**Expected Console Output:**
```
🔍 Fetching events for date >= 2025-11-20
🔍 Supabase URL: Set
🔍 Supabase Key: Set
📊 Query result: { dataCount: 22, error: 'none' }
```

If you see `dataCount: 22`, the event IS being fetched. The issue is display.

---

## 📋 Verify Event Position

The event "PRE THANKSGIVING BASH" is the **4th event** in the list (sorted by date). Make sure you're scrolling through all events:

**Event Order:**
1. Reggaeton Fridays - November 21
2. GRUPO EXTERMINADOR Y LOS TERRIBLES DEL NORTE
3. Cumbia Nights - November 23
4. **PRE THANKSGIVING BASH** ← Should be here!
5. Reggaeton Fridays - November 28
... (and 17 more events)

---

## 🎯 Quick Test

Run this to verify the event is queryable:

```bash
cd maguey-gate-scanner
npx tsx debug-event-visibility.ts
```

This will show you exactly what events are returned by the queries.

---

## ⚠️ If Still Not Showing

1. **Check the exact URL:**
   - Main Website: Should be `http://localhost:3000` (home page shows events)
   - Purchase Website: Should be `http://localhost:5173/events` (events page)

2. **Check if other events are showing:**
   - If NO events show → Connection issue
   - If OTHER events show → This specific event might have a display issue

3. **Check browser console for errors:**
   - Open DevTools (F12) → Console tab
   - Look for red errors
   - Copy error messages

4. **Verify servers are running:**
   ```bash
   # Check if servers are running
   curl http://localhost:3000  # Main Website
   curl http://localhost:5173  # Purchase Website
   ```

---

## ✅ Expected Result

After restarting servers and hard refreshing:

**Main Website (http://localhost:3000):**
- Should show "PRE THANKSGIVING BASH" in events list
- Date: November 26, 2025
- 4th event in the list

**Purchase Website (http://localhost:5173/events):**
- Should show "PRE THANKSGIVING BASH" in events list
- Clicking it shows 3 ticket types:
  - Women - Before 10 PM ($0)
  - Men - Before 10 PM ($35)
  - General Admission - After 10 PM ($50)

---

**The event is definitely in the database. Restart your servers and hard refresh your browsers!**

