# Blank Screen Troubleshooting Guide

## Quick Diagnosis Steps

### 1. Check if Dev Servers are Running

**Purchase Site (maguey-pass-lounge):**
```bash
cd maguey-pass-lounge
npm run dev
```
- Should start on `http://localhost:5173` (or next available port)
- Look for: `Local: http://localhost:XXXX`

**Scanner Site (maguey-gate-scanner):**
```bash
cd maguey-gate-scanner
npm run dev
```
- Should start on `http://localhost:5174` (or next available port)
- Look for: `Local: http://localhost:XXXX`

### 2. Check Browser Console

Open DevTools (F12 or Cmd+Option+I) and check:
- **Console tab**: Look for red error messages
- **Network tab**: Check if files are loading (200 status)
- **Elements tab**: Check if `<div id="root">` exists and has content

### 3. Common Issues & Fixes

#### Issue: "Cannot find module" or Import Errors
**Fix:**
```bash
# In each project directory
npm install
npm run build  # Verify no build errors
```

#### Issue: Supabase Connection Errors
**Fix:** Check `.env` files have:
```env
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-key
```

#### Issue: Blank Screen with No Errors
**Possible causes:**
1. **Error Boundary catching errors silently**
   - Check browser console for errors
   - Look for error messages in the DOM

2. **Missing root element**
   - Verify `index.html` has `<div id="root"></div>`
   - Check `main.tsx` is loading correctly

3. **Route not matching**
   - Try navigating to `/events` directly
   - Check if default route is configured

### 4. Verify Files Exist

**Purchase Site:**
- ✅ `src/main.tsx` - Entry point
- ✅ `src/App.tsx` - Main app component
- ✅ `src/pages/Events.tsx` - Landing page
- ✅ `index.html` - HTML template

**Scanner Site:**
- ✅ `src/main.tsx` - Entry point
- ✅ `src/App.tsx` - Main app component
- ✅ `src/pages/Index.tsx` - Landing page (redirects to /auth)
- ✅ `index.html` - HTML template

### 5. Test Builds

Both sites should build successfully:
```bash
# Purchase site
cd maguey-pass-lounge
npm run build  # Should complete without errors

# Scanner site
cd maguey-gate-scanner
npm run build  # Should complete without errors
```

### 6. Clear Cache & Restart

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear browser cache
# Chrome: Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)
# Or hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

### 7. Check Port Conflicts

If ports are in use, Vite will use the next available port:
- Check terminal output for actual port number
- Look for: `Local: http://localhost:XXXX`

### 8. Verify Environment Variables

**Purchase Site (.env):**
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_STRIPE_PUBLISHABLE_KEY=...
VITE_EMAIL_API_KEY=...
VITE_EMAIL_FROM_ADDRESS=...
```

**Scanner Site (.env):**
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Expected Behavior

### Purchase Site (maguey-pass-lounge)
- **URL:** `http://localhost:5173` (or next available)
- **Should show:** Events listing page with event cards
- **If blank:** Check console for errors

### Scanner Site (maguey-gate-scanner)
- **URL:** `http://localhost:5174` (or next available)
- **Should show:** Login selection screen briefly, then redirect to `/auth`
- **If blank:** Check console for errors

## Still Not Working?

1. **Share browser console errors** (F12 → Console tab)
2. **Share terminal output** from `npm run dev`
3. **Check if builds succeed** (`npm run build`)
4. **Verify you're accessing the correct URL** (check terminal for actual port)






