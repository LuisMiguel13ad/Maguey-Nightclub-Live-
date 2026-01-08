# Quick Fix for Blank Screens

## ✅ Status Check

Both dev servers are **running**:
- ✅ Purchase site: Port 5173
- ✅ Scanner site: Port 3005

Both sites **build successfully** ✅

## 🔍 Immediate Steps

### 1. Check the Correct URLs

**Purchase Site:**
- URL: `http://localhost:5173`
- Should show: Events listing page

**Scanner Site:**
- URL: `http://localhost:3005`
- Should show: Login selection screen (briefly), then redirects to `/auth`

### 2. Open Browser Console

1. Open the site in your browser
2. Press **F12** (or Cmd+Option+I)
3. Check **Console** tab for errors
4. Check **Network** tab for failed requests

### 3. Hard Refresh

- **Mac:** Cmd + Shift + R
- **Windows:** Ctrl + Shift + R

### 4. Try Incognito/Private Window

This bypasses cache issues.

## 🚨 Most Likely Causes

### Cause 1: Browser Console Errors
**Check:** Open DevTools → Console tab
**Look for:** Red error messages
**Fix:** Share the error message

### Cause 2: Wrong URL
**Check:** Are you accessing the correct port?
- Purchase: `http://localhost:5173` (not 5174, 5175, etc.)
- Scanner: `http://localhost:3005` (not 3006, etc.)

### Cause 3: Cached Broken Build
**Fix:**
```bash
# Stop dev servers (Ctrl+C in terminals)
# Clear browser cache
# Restart dev servers
cd maguey-pass-lounge && npm run dev
cd ../maguey-gate-scanner && npm run dev
```

### Cause 4: Missing Environment Variables
**Check:** `.env` files exist
**Fix:** Ensure Supabase credentials are set

## 📋 What I Need From You

1. **What URL are you accessing?** (exact address)
2. **What do you see?** (completely blank? loading spinner? error message?)
3. **Browser console errors?** (F12 → Console tab → screenshot or copy errors)
4. **Network tab status?** (F12 → Network tab → any red/failed requests?)

## 🎯 Expected Behavior

### Purchase Site (`http://localhost:5173`)
- Shows header with "MAGUEY" logo
- Shows event hero slider (if events exist)
- Shows events grid below
- If no events: Shows "No events found" message

### Scanner Site (`http://localhost:3005`)
- Shows login selection screen for 2 seconds
- Then redirects to `/auth` (login page)
- If blank: Check console for navigation errors

## ⚡ Quick Test

Try accessing these URLs directly:
- `http://localhost:5173/events` (should show events page)
- `http://localhost:3005/auth` (should show login page)

If these work but the root doesn't, it's a routing issue.










