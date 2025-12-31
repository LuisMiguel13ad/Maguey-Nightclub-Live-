# 🖼️ Upload Flyer Image to Event

## ✅ Event Recreated Successfully!

The event "PRE THANKSGIVING BASH" has been recreated with all details:
- ✅ Event name: PRE THANKSGIVING BASH
- ✅ Date: November 26, 2025
- ✅ Time: 9:00 PM
- ✅ Venue: Maguey Delaware
- ✅ Description: Complete with all artist details
- ✅ Ticket types: 3 types created
- ✅ Status: Published
- ⏳ **Flyer image: NEEDS TO BE UPLOADED**

---

## 📋 Step-by-Step: Upload Flyer Image

### Method 1: Through Dashboard UI (Easiest)

1. **Open Dashboard:**
   - URL: `http://localhost:5175/events`
   - Login with your owner account

2. **Find the Event:**
   - Look for "PRE THANKSGIVING BASH" in the events list
   - Click the **"Edit"** button (pencil icon) next to it

3. **Upload Flyer:**
   - Scroll down to the **"Event Image"** section
   - Click **"Choose File"** button
   - Select your flyer image file (JPG, PNG, WebP, or GIF)
   - **Maximum file size:** 5MB
   - Click **"Upload Image"** button
   - Wait for upload to complete

4. **Save Event:**
   - Scroll to bottom of form
   - Click **"Save Event"** button
   - You should see a success message

5. **Verify:**
   - The event should now show the flyer image
   - Refresh Main Website: http://localhost:3000
   - Refresh Purchase Website: http://localhost:5173/events
   - The flyer should appear on both sites!

---

### Method 2: Using Flyer Scanning Feature

If you have OpenAI API key configured:

1. **Go to Events Page:**
   - URL: `http://localhost:5175/events`

2. **Edit Event:**
   - Find "PRE THANKSGIVING BASH"
   - Click "Edit"

3. **Upload & Scan:**
   - Upload the flyer image
   - Click **"Auto-fill Details from Flyer"** button
   - This will extract event details AND attach the image
   - Review the auto-filled details
   - Click "Save Event"

---

## 🔍 Verify Event is Visible

After uploading the flyer, verify:

1. **Dashboard:** http://localhost:5175/events
   - Event should show with flyer image

2. **Main Website:** http://localhost:3000
   - Hard refresh (Cmd+Shift+R)
   - Event should appear in events list
   - Flyer should be visible

3. **Purchase Website:** http://localhost:5173/events
   - Hard refresh (Cmd+Shift+R)
   - Event should appear in events list
   - Click event to see flyer on detail page

---

## ⚠️ Troubleshooting

### Event Still Not Showing?

1. **Restart Development Servers:**
   ```bash
   # Stop servers (Ctrl+C)
   # Restart Main Website
   cd maguey-nights
   npm run dev
   
   # Restart Purchase Website
   cd maguey-pass-lounge
   npm run dev
   ```

2. **Hard Refresh Browsers:**
   - Mac: Cmd+Shift+R
   - Windows: Ctrl+Shift+R

3. **Check Browser Console:**
   - Press F12 → Console tab
   - Look for errors or event count

### Image Upload Fails?

- Check file size (must be under 5MB)
- Check file format (JPG, PNG, WebP, or GIF)
- Check browser console for errors
- Verify Supabase Storage bucket "event-images" exists

---

## 📸 Expected Result

After uploading:

- ✅ Event shows on all 3 sites
- ✅ Flyer image displays on event cards
- ✅ Flyer shows on event detail pages
- ✅ All event details are correct
- ✅ Ticket types are available for purchase

---

**The event is ready - just needs the flyer image uploaded through the dashboard!**

