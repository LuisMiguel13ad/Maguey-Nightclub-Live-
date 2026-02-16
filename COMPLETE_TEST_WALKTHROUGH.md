# 🧪 Complete End-to-End Test Walkthrough
## Step-by-Step Guide with Screenshot Locations

This guide walks you through testing the entire system from purchase to scanning to dashboard analytics.

---

## 🎯 Test Flow Overview

```
Main Site → Purchase Site → Ticket Display → Scanner → Dashboard
```

---

## 📋 STEP-BY-STEP INSTRUCTIONS

### **STEP 1: Main Site - Browse Events** 📸

**URL:** http://localhost:3000

**What to Do:**
1. Open http://localhost:3000 in your browser
2. You should see upcoming events displayed
3. Events should show:
   - Event image
   - Event name
   - Date and time
   - Genre/category
   - "Buy Tickets" button

**Available Test Events:**
- "Reggaeton Fridays - November 21" (has tickets available)
- "GRUPO EXTERMINADOR Y LOS TERRIBLES DEL NORTE" (has ticket types)
- "Cumbia Nights - November 23" (has ticket types)

**Screenshot:** 📸 Take screenshot of the events list

**Verify:**
- ✅ Events are displayed
- ✅ Images load correctly
- ✅ Dates are formatted properly
- ✅ "Buy Tickets" buttons are visible

---

### **STEP 2: Purchase Site - Select Event** 📸

**URL:** http://localhost:5173/events

**What to Do:**
1. Navigate to http://localhost:5173/events
2. Find an event (or click "Buy Tickets" from Main Site)
3. Click on an event card
4. You'll see the event detail page with:
   - Large event image
   - Event name, date, time
   - Venue information
   - Ticket types available

**Screenshot:** 📸 Take screenshot of event detail page

**Verify:**
- ✅ Event details display correctly
- ✅ Ticket types are shown
- ✅ Prices and fees are displayed
- ✅ Availability badges work

---

### **STEP 3: Purchase Site - Select Tickets** 📸

**On Event Detail Page:**

**What to Do:**
1. Scroll to ticket selection section
2. You'll see ticket types grouped by category:
   - VIP (if available)
   - General Admission
   - Service
   - Sections
3. Each ticket type shows:
   - Name
   - Price + Fees
   - Availability ("X left" or "Sold Out")
   - "BUY TICKETS" button
4. Select a ticket type
5. Choose quantity (1-10)
6. Click "BUY TICKETS"

**Screenshot:** 📸 Take screenshot of ticket selection with availability badges

**Verify:**
- ✅ Ticket types display correctly
- ✅ Availability shows accurate counts
- ✅ Price calculations are correct
- ✅ Quantity selector works

---

### **STEP 4: Purchase Site - Checkout** 📸

**URL:** http://localhost:5173/checkout?event=[eventId]&ticket=[ticketTypeId]

**What to Do:**
1. Review order summary:
   - Event name
   - Ticket type(s)
   - Quantity
   - Subtotal
   - Fees
   - Total
2. Fill in customer information:
   - **Full Name:** Test Customer
   - **Email:** test@example.com
   - **Phone:** (555) 123-4567 (optional)
3. (Optional) Enter promo code
4. Click "Proceed to Payment" or "Checkout"

**Screenshot:** 📸 Take screenshot of checkout page with order summary

**Verify:**
- ✅ Order summary is accurate
- ✅ Form fields work correctly
- ✅ Price breakdown is correct

---

### **STEP 5: Payment - Stripe Checkout** 📸

**What to Do:**
1. You'll be redirected to Stripe checkout
2. Use test card:
   - **Card Number:** 4242 4242 4242 4242
   - **Expiry:** 12/25 (any future date)
   - **CVC:** 123 (any 3 digits)
   - **ZIP:** 12345 (any 5 digits)
3. Complete payment

**Screenshot:** 📸 (Optional) Stripe checkout page

**Verify:**
- ✅ Stripe checkout loads
- ✅ Payment processes successfully
- ✅ Redirects to success page

---

### **STEP 6: Purchase Site - Order Confirmation** 📸

**URL:** http://localhost:5173/checkout/success?session_id=[session]&orderId=[orderId]

**What to Do:**
1. After payment, you'll see confirmation page
2. Page shows:
   - Success message
   - Order ID
   - Email confirmation message
   - "View My Tickets" button
3. Click "View My Tickets" button

**Screenshot:** 📸 Take screenshot of order confirmation page

**Verify:**
- ✅ Success message displays
- ✅ Order ID is shown
- ✅ "View My Tickets" button works

---

### **STEP 7: Purchase Site - View Ticket with QR Code** ⭐ CRITICAL 📸

**URL:** http://localhost:5173/ticket/[ticketId] or http://localhost:5173/account

**What to Do:**
1. After clicking "View My Tickets", you'll see your ticket
2. The ticket page displays:
   - **Event image** at the top
   - **Event name** and date
   - **QR CODE** (large, centered) ⭐
   - **Ticket type** (General Admission, VIP, etc.)
   - **Attendee name**
   - **Order number**
   - **Download/Share buttons**

**CRITICAL SCREENSHOT:** 📸⭐
- **Take a clear screenshot of the ticket page showing the QR code**
- Make sure QR code is large and visible
- Show all ticket details

**What to Verify:**
- ✅ QR code is clearly visible
- ✅ QR code can be scanned (test with phone camera)
- ✅ Event name is correct
- ✅ Ticket type is correct
- ✅ Attendee name matches
- ✅ All details are accurate

**How to Access Ticket Directly:**
- After purchase, tickets are stored in sessionStorage
- Navigate to: http://localhost:5173/account (if account page exists)
- Or use direct ticket URL: http://localhost:5173/ticket/[ticketId]

---

### **STEP 8: Scanner Site - Scan Ticket** ⭐ CRITICAL 📸

**URL:** http://localhost:5175/scanner

**What to Do:**
1. Open http://localhost:5175/scanner in a new tab/window
2. Log in as staff/employee:
   - Use demo login if available
   - Or use owner credentials
3. Navigate to Scanner page
4. Select the event (if event selector exists)
5. Start scanning:
   - **Option A:** Enable camera and scan QR code from Step 7
   - **Option B:** Use manual entry - enter the QR token from ticket
6. After scanning, you'll see:
   - Ticket validation result
   - Ticket details:
     - Attendee name
     - Event name
     - Ticket type
     - Status (Valid/Issued)
   - Success message

**CRITICAL SCREENSHOTS:** 📸⭐
- **Screenshot 1:** Scanner interface (camera view or manual entry screen)
- **Screenshot 2:** Ticket validation result (showing ticket details after scan)

**What to Verify:**
- ✅ Scanner opens successfully
- ✅ QR code scans (or manual entry works)
- ✅ Ticket details display correctly:
  - ✅ Attendee name matches
  - ✅ Event name matches
  - ✅ Ticket type matches
  - ✅ Status shows as "Valid" or "Issued"
- ✅ Success message appears
- ✅ Ticket status updates to "scanned" in database

**Manual Entry Option:**
If camera doesn't work, use manual entry:
1. Click "Manual Entry" or similar button
2. Enter the QR token from the ticket (shown on ticket page)
3. Click "Validate" or "Lookup"

---

### **STEP 9: Scanner Site - Owner Dashboard** ⭐ CRITICAL 📸

**URL:** http://localhost:5175/dashboard

**What to Do:**
1. Navigate to http://localhost:5175/dashboard
2. Log in as owner (if not already)
3. View the dashboard which shows:

   **Revenue Cards (Top Row):**
   - Today's Revenue
   - Week's Revenue
   - Month's Revenue
   - All Time Revenue

   **Key Metrics Cards:**
   - Tickets Purchased (total count)
   - Tickets Scanned (total count)
   - Active Events (count)
   - Scan Rate (percentage)

   **Recent Purchases Table:**
   - Scroll down to see table
   - Should show your test order:
     - Order ID
     - Customer Email (test@example.com)
     - Amount ($30.00 or your order total)
     - Status ("paid")
     - Date/Time

**CRITICAL SCREENSHOT:** 📸⭐
- **Take screenshot of entire dashboard showing:**
  - All revenue cards
  - All metrics cards
  - Recent purchases table with your order visible

**What to Verify:**
- ✅ Dashboard loads correctly
- ✅ Revenue shows your order amount:
  - Today's Revenue includes your order (if purchased today)
  - All Time Revenue includes your order
- ✅ Tickets Purchased count increased by 1
- ✅ Tickets Scanned count increased by 1 (if you scanned it)
- ✅ Scan Rate is calculated correctly
- ✅ Your order appears in Recent Purchases table:
  - Order ID matches
  - Email: test@example.com
  - Amount matches your purchase
  - Status: "paid"

---

### **STEP 10: Scanner Site - Event Management** 📸

**URL:** http://localhost:5175/events

**What to Do:**
1. Navigate to http://localhost:5175/events
2. Find the event you purchased tickets for
3. Click to view/edit event details
4. Check ticket sales information:
   - Total ticket types
   - Tickets sold
   - Tickets available
   - Revenue generated

**Screenshot:** 📸 Take screenshot of event management showing sales data

**What to Verify:**
- ✅ Event appears in list
- ✅ Ticket sales data is accurate
- ✅ Shows sold vs available tickets
- ✅ Revenue matches dashboard

---

## 📸 Complete Screenshot Checklist

**Required Screenshots (in order):**

1. ✅ **Main Site** - Events list page
2. ✅ **Purchase Site** - Event detail page
3. ✅ **Purchase Site** - Ticket selection page
4. ✅ **Purchase Site** - Checkout page
5. ✅ **Purchase Site** - Order confirmation
6. ⭐ **Purchase Site - Ticket with QR Code** (MOST IMPORTANT)
7. ⭐ **Scanner Site - Scanner Interface**
8. ⭐ **Scanner Site - Ticket Validation Result**
9. ⭐ **Scanner Site - Owner Dashboard** (MOST IMPORTANT)
10. ✅ **Scanner Site - Event Management**

---

## 🔍 Data Verification

### Check Database (Supabase Dashboard):

**1. Verify Order:**
```sql
SELECT * FROM orders 
WHERE purchaser_email = 'test@example.com' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected:**
- Order exists
- Status: "paid"
- Total: matches your purchase amount
- Event ID: matches selected event

**2. Verify Ticket:**
```sql
SELECT t.*, o.purchaser_email, e.name as event_name
FROM tickets t
JOIN orders o ON o.id = t.order_id
JOIN events e ON e.id = t.event_id
WHERE o.purchaser_email = 'test@example.com'
ORDER BY t.created_at DESC
LIMIT 1;
```

**Expected:**
- Ticket exists
- QR token is present
- Status: "issued" or "scanned"
- Attendee name matches

**3. Verify Scan Log:**
```sql
SELECT * FROM ticket_scan_logs 
WHERE ticket_id = '[your_ticket_id]'
ORDER BY scanned_at DESC
LIMIT 1;
```

**Expected:**
- Scan log exists (if scanned)
- Scan result: "success"
- Timestamp matches scan time

---

## ✅ Success Criteria

**Test is successful if:**

- [x] Can browse events on Main Site
- [x] Can navigate to Purchase Site
- [x] Can select and purchase tickets
- [x] Payment processes successfully
- [x] Ticket displays with QR code
- [x] QR code is scannable
- [x] Scanner validates ticket successfully
- [x] Dashboard shows order
- [x] Analytics are accurate
- [x] Event management shows sales

---

## 🎯 Quick Reference URLs

**Main Site:**
- Home: http://localhost:3000
- Events: http://localhost:3000 (events listed on home)

**Purchase Site:**
- Events: http://localhost:5173/events
- Event Detail: http://localhost:5173/event/[eventId]
- Checkout: http://localhost:5173/checkout?event=[eventId]&ticket=[ticketTypeId]
- Ticket View: http://localhost:5173/ticket/[ticketId]
- Account: http://localhost:5173/account

**Scanner Site:**
- Scanner: http://localhost:5175/scanner
- Dashboard: http://localhost:5175/dashboard
- Events: http://localhost:5175/events
- Login: http://localhost:5175/auth

---

## 💡 Pro Tips

1. **Use Two Devices:**
   - Computer: For purchasing and viewing ticket
   - Phone: For scanning QR code (or use screenshot on phone)

2. **Stripe Test Cards:**
   - Success: 4242 4242 4242 4242
   - Decline: 4000 0000 0000 0002

3. **Manual Entry:**
   - If camera doesn't work, use manual entry
   - Enter QR token from ticket page

4. **Browser DevTools:**
   - F12 → Console tab
   - Check for errors
   - Network tab → Verify API calls

5. **Database Check:**
   - Supabase Dashboard → Table Editor
   - Verify data at each step

---

## 🐛 Troubleshooting

**Event Not Showing:**
- Check: `status = 'published'` and `is_active = true`
- Refresh page
- Check browser console

**Can't Purchase:**
- Check ticket availability
- Verify Stripe keys configured
- Check browser console for errors

**QR Code Won't Scan:**
- Use manual entry option
- Verify QR token format
- Check ticket status in database

**Dashboard Wrong:**
- Refresh dashboard
- Check database directly
- Verify RLS policies allow access

**Ticket Not Displaying:**
- Check order was created successfully
- Verify ticket was created
- Check browser console for errors
- Try direct ticket URL: /ticket/[ticketId]

---

## 🎉 Test Complete!

After completing all steps and taking screenshots, you'll have:

✅ **Verified Customer Journey:** Browse → Select → Purchase → View Ticket  
✅ **Verified Staff Operations:** Scan Ticket → Validate  
✅ **Verified Owner Analytics:** Dashboard → Revenue → Reports  
✅ **Screenshots of All Key Screens**

**All systems working correctly!** 🚀

---

**Ready to start testing! Follow the steps above and capture screenshots at each stage.** 📸

