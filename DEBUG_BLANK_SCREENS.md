# Debug Steps for Blank Screens

I've added debug logging to help identify the issue. Here's what to do:

## Step 1: Check Browser Console

1. Open both sites in your browser:
   - Purchase: `http://localhost:5173`
   - Scanner: `http://localhost:5174`

2. Open DevTools (F12 or Cmd+Option+I)

3. Go to **Console** tab

4. Look for these debug messages:
   - `🚀 Starting app initialization...`
   - `✅ Root element found, creating React root...`
   - `✅ React root created, rendering app...`
   - `✅ App rendered successfully`
   - `📱 App component rendering...`
   - `📅 Events component rendering...` (for purchase site)
   - `🏠 Index component rendering...` (for scanner site)

## Step 2: Check for Red Debug Banner

I've added a **red debug banner** at the top of both pages that should be visible if React is rendering:
- Purchase site: Shows "DEBUG: Events component rendered with X events"
- Scanner site: Shows "DEBUG: Index component rendered"

## Step 3: Check Network Tab

1. Go to **Network** tab in DevTools
2. Refresh the page (F5)
3. Look for:
   - `main.tsx` - should be 200 (success)
   - `index.css` - should be 200 (success)
   - Any files with 404 or 500 errors

## Step 4: Check Elements Tab

1. Go to **Elements** tab
2. Look for `<div id="root">`
3. Check if it has any content inside
4. If it's empty, React isn't rendering

## What to Share

Please share:
1. **Console output** - Copy all the console messages (especially any errors)
2. **Do you see the red debug banner?** (Yes/No)
3. **Network tab** - Any failed requests? (screenshot if possible)
4. **Elements tab** - Does `<div id="root">` have content? (screenshot if possible)

## Expected Console Output

You should see something like:
```
🚀 Starting app initialization...
Root element: <div id="root">...</div>
✅ Root element found, creating React root...
✅ React root created, rendering app...
✅ App rendered successfully
📱 App component rendering...
📅 Events component rendering... (or 🏠 Index component rendering...)
🔄 Loading events...
```

If you see errors instead, share them!






