# Blank Screen Diagnosis & Quick Fix

## ✅ Current Status

- **Both sites build successfully** ✅
- **Dev servers are running** ✅
  - Purchase site: Port 5173 (or next available)
  - Scanner site: Port 3005 (or next available)

## 🔍 Quick Diagnosis

### Step 1: Check Browser Console

1. Open the site in your browser
2. Press **F12** (or Cmd+Option+I on Mac) to open DevTools
3. Go to **Console** tab
4. Look for **red error messages**
5. Share any errors you see

### Step 2: Check Network Tab

1. In DevTools, go to **Network** tab
2. Refresh the page (F5)
3. Look for files with **red status codes** (4xx, 5xx)
4. Check if `main.tsx` and other JS files are loading (should be 200)

### Step 3: Check Elements Tab

1. In DevTools, go to **Elements** tab
2. Look for `<div id="root">`
3. Check if it has any content inside
4. If it's empty, the React app isn't rendering

## 🚨 Common Issues & Fixes

### Issue 1: JavaScript Errors in Console

**Symptoms:**
- Red errors in browser console
- "Cannot read property of undefined"
- "Module not found"

**Fix:**
```bash
# Stop dev servers (Ctrl+C)
# Clear and reinstall
cd maguey-pass-lounge
rm -rf node_modules package-lock.json
npm install

cd ../maguey-gate-scanner
rm -rf node_modules package-lock.json
npm install

# Restart dev servers
npm run dev
```

### Issue 2: Supabase Connection Errors

**Symptoms:**
- Console shows Supabase errors
- "Missing Supabase credentials"

**Fix:**
Check `.env` files exist and have:
```env
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-key
```

### Issue 3: Import Errors from VIP Components

**Symptoms:**
- "Cannot find module '@/components/vip'"
- Import errors in console

**Fix:**
The VIP components should be properly exported. Verify:
- `maguey-pass-lounge/src/components/vip/index.ts` exists
- `maguey-gate-scanner/src/components/vip/index.ts` exists

### Issue 4: Route Not Found

**Symptoms:**
- Blank screen
- No console errors
- Network shows 404 for routes

**Fix:**
- Try accessing `/events` directly
- Check if default route is configured

## 🛠️ Immediate Actions

### 1. Hard Refresh Browser
- **Mac:** Cmd + Shift + R
- **Windows/Linux:** Ctrl + Shift + R

### 2. Clear Browser Cache
- Chrome: Settings → Privacy → Clear browsing data
- Or use incognito/private window

### 3. Check Actual URLs

**Purchase Site:**
- Check terminal output for: `Local: http://localhost:XXXX`
- Access that exact URL

**Scanner Site:**
- Check terminal output for: `Local: http://localhost:XXXX`
- Access that exact URL

### 4. Verify Dev Servers Are Running

```bash
# Check if processes are running
ps aux | grep "vite\|node" | grep -v grep

# Or check ports
lsof -i :5173  # Purchase site
lsof -i :3005  # Scanner site
```

## 📋 What to Share

If still not working, please share:

1. **Browser Console Errors** (screenshot or copy/paste)
2. **Network Tab** - Any failed requests (screenshot)
3. **Terminal Output** from `npm run dev` (first 20 lines)
4. **URL you're accessing** (exact address)
5. **Browser you're using** (Chrome, Firefox, Safari, etc.)

## 🎯 Expected URLs

After running `npm run dev`, you should see:

**Purchase Site:**
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Scanner Site:**
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:3005/
  ➜  Network: use --host to expose
```

Access the **Local** URL shown in your terminal!










