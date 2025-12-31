# 🧪 Manual End-to-End Test Instructions
## Complete Flow with Screenshot Guide

Follow these steps to test the entire system and capture screenshots at each stage.

---

## 🎯 Test Flow Overview

```
1. Main Site → View Events
2. Purchase Site → Select & Purchase Ticket  
3. Purchase Site → View Ticket (QR Code)
4. Scanner Site → Scan Ticket
5. Scanner Site → Dashboard → View Analytics
```

---

## 📋 STEP 1: Main Site - Browse Events

**URL:** http://localhost:3000

**What to Do:**
1. Open http://localhost:3000 in your browser
2. You should see a list of upcoming events
3. Look for events with status "published"
4. Click on an event card or "Buy Tickets" button

**What to Screenshot:**
- 📸 **Screenshot 1:** Main site homepage with events list
- 📸 **Screenshot 2:** Event card hover state (if applicable)

**What to Verify:**
- ✅ Events are displayed correctly
- ✅ Event images load
- ✅ Dates and times are correct
- ✅ "Buy Tickets" buttons work

---

## 🛒 STEP 2: Purchase Site - Select Tickets

**URL:** http://localhost:5173/events

**What to Do:**
1. Navigate to http://localhost:5173/events
2. Find an event (or use the event from Step 1)
3. Click on the event to view details
4. You'll see ticket types (General Admission, VIP, etc.)
5. Select a ticket type
6. Choose quantity (1-10)
7. Click "BUY TICKETS" button

**What to Screenshot:**
- 📸 **Screenshot 3:** Purchase site events list
- 📸 **Screenshot 4:** Event detail page with ticket selection
- 📸 **Screenshot 5:** Ticket type cards showing availability

**What to Verify:**
- ✅ Event details display correctly
- ✅ Ticket types show prices and fees
- ✅ Availability badges work (e.g., "100 left", "Sold Out")
- ✅ Quantity selector works
- ✅ Total price calculates correctly

---

## 💳 STEP 3: Purchase Site - Checkout

**URL:** http://localhost:5173/checkout?event=[eventId]&ticket=[ticketTypeId]

**What to Do:**
1. After selecting tickets, you'll be redirected to checkout
2. Review order summary:
   - Event name
   - Ticket type(s)
   - Quantity
   - Subtotal
   - Fees
   - Total
3. Fill in customer information:
   - Full Name
   - Email Address
   - Phone Number (optional)
4. (Optional) Enter promo code
5. Click "Proceed to Payment" or "Checkout"

**What to Screenshot:**
- 📸 **Screenshot 6:** Checkout page with order summary
- 📸 **Screenshot 7:** Customer information form

**What to Verify:**
- ✅ Order summary is accurate
- ✅ Form validation works
- ✅ Price calculations are correct

---

## 💰 STEP 4: Payment (Stripe Test Mode)

**What to Do:**
1. You'll be redirected to Stripe checkout
2. Use test card: **4242 4242 4242 4242**
3. Expiry: Any future date (e.g., 12/25)
4. CVC: Any 3 digits (e.g., 123)
5. ZIP: Any 5 digits (e.g., 12345)
6. Complete payment

**What to Screenshot:**
- 📸 **Screenshot 8:** Stripe checkout page (optional)

**What to Verify:**
- ✅ Stripe checkout loads
- ✅ Payment processes successfully
- ✅ Redirects to confirmation page

---

## 🎟️ STEP 5: View Ticket (CRITICAL SCREENSHOT)

**URL:** http://localhost:5173/checkout/success?session_id=[session]&orderId=[orderId]

**What to Do:**
1. After payment, you'll see order confirmation
2. Your ticket should be displayed with:
   - Event name and date
   - Ticket type
   - **QR CODE** (most important!)
   - Attendee name
   - Order number
   - Ticket ID
3. The QR code should be clearly visible and scannable

**What to Screenshot:**
- 📸 **⭐ SCREENSHOT 9: TICKET WITH QR CODE** ⭐
  - This is the most important screenshot!
  - Make sure QR code is clear and visible
  - Show all ticket details

**What to Verify:**
- ✅ Ticket displays correctly
- ✅ QR code is visible and clear
- ✅ All ticket information is accurate
- ✅ QR code can be scanned (test with phone camera)

---

## 📱 STEP 6: Scanner Site - Scan Ticket

**URL:** http://localhost:5175/scanner

**What to Do:**
1. Open http://localhost:5175/scanner in a new tab/window
2. Log in as staff/employee (or use demo login if available)
3. Navigate to the Scanner page
4. Select the event (if event selector exists)
5. Click "Start Scanning" or enable camera
6. **Scan the QR code from Step 5** (use the screenshot or display ticket on another device)
7. Watch for validation result

**What to Screenshot:**
- 📸 **⭐ SCREENSHOT 10: SCANNER INTERFACE** ⭐
  - Show the scanner with camera view
  - Or show manual entry option
- 📸 **⭐ SCREENSHOT 11: TICKET VALIDATION RESULT** ⭐
  - Show ticket details after scan
  - Show "Valid" or "Success" message
  - Show attendee name, event name, ticket type

**What to Verify:**
- ✅ Scanner opens camera (or manual entry works)
- ✅ QR code scans successfully
- ✅ Ticket details display correctly:
  - Attendee name
  - Event name
  - Ticket type
  - Status (should show as valid/issued)
- ✅ Success message appears
- ✅ Ticket status updates to "scanned"

---

## 📊 STEP 7: Scanner Site - Owner Dashboard

**URL:** http://localhost:5175/dashboard

**What to Do:**
1. Navigate to http://localhost:5175/dashboard
2. Log in as owner (if not already)
3. View the dashboard analytics:
   - **Revenue Cards:** Today, Week, Month, All Time
   - **Key Metrics:**
     - Tickets Purchased
     - Tickets Scanned
     - Active Events
     - Scan Rate %
   - **Recent Purchases Table:**
     - Should show your test order
     - Order ID, Customer Email, Amount, Status

**What to Screenshot:**
- 📸 **⭐ SCREENSHOT 12: OWNER DASHBOARD** ⭐
  - Show all analytics cards
  - Show revenue metrics
  - Show recent purchases table
- 📸 **Screenshot 13:** Recent purchases table (zoomed in)

**What to Verify:**
- ✅ Dashboard loads correctly
- ✅ Revenue shows your test order amount
- ✅ Tickets Purchased count includes your ticket
- ✅ Tickets Scanned count includes scanned ticket (if scanned)
- ✅ Scan Rate is calculated correctly
- ✅ Your order appears in Recent Purchases table
- ✅ Order details are correct (email, amount, status)

---

## 📈 STEP 8: Scanner Site - Event Management

**URL:** http://localhost:5175/events

**What to Do:**
1. Navigate to http://localhost:5175/events
2. Find the event you purchased tickets for
3. Click to view/edit event details
4. Check ticket sales information:
   - Total capacity
   - Tickets sold
   - Tickets available
   - Revenue generated

**What to Screenshot:**
- 📸 **Screenshot 14:** Event management page
- 📸 **Screenshot 15:** Event details showing ticket sales

**What to Verify:**
- ✅ Event appears in list
- ✅ Ticket sales data is accurate
- ✅ Can see sold vs available tickets
- ✅ Revenue matches dashboard

---

## 🔍 STEP 9: Verify Data Flow

**Check Database (Optional):**

You can verify the data in Supabase Dashboard:

1. **Orders Table:**
   - Your order should appear
   - Status should be "paid"
   - Total should match payment

2. **Tickets Table:**
   - Your ticket should appear
   - Status should be "issued" or "scanned"
   - QR token should be present

3. **Ticket Scan Logs:**
   - If scanned, should have an entry
   - Shows scan timestamp

---

## ✅ Success Checklist

After completing all steps, verify:

- [x] Event appears on Main Site
- [x] Can navigate to Purchase Site
- [x] Can select tickets
- [x] Can complete checkout
- [x] Ticket displays with QR code
- [x] QR code scans successfully
- [x] Ticket validates correctly
- [x] Dashboard shows order
- [x] Analytics are accurate
- [x] Event management shows sales

---

## 📸 Screenshot Summary

**Required Screenshots:**

1. ✅ Main Site - Events List
2. ✅ Purchase Site - Event Detail
3. ✅ Purchase Site - Ticket Selection
4. ✅ Purchase Site - Checkout Page
5. ⭐ **Purchase Site - Ticket with QR Code** (MOST IMPORTANT)
6. ⭐ **Scanner Site - Scanner Interface**
7. ⭐ **Scanner Site - Ticket Validation Result**
8. ⭐ **Scanner Site - Owner Dashboard** (MOST IMPORTANT)
9. ✅ Scanner Site - Event Management

---

## 🎉 Test Complete!

After completing all steps and taking screenshots, you'll have verified:

✅ **Customer Journey:** Browse → Select → Purchase → View Ticket  
✅ **Staff Operations:** Scan Ticket → Validate  
✅ **Owner Analytics:** Dashboard → Revenue → Reports  

**All systems working correctly!** 🚀

---

## 💡 Quick Test Tips

1. **Use Test Cards:** Stripe test mode accepts 4242 4242 4242 4242
2. **Multiple Devices:** Use phone for scanning, computer for purchasing
3. **Browser DevTools:** Check console for any errors
4. **Network Tab:** Verify API calls succeed
5. **Database:** Check Supabase Dashboard to verify data

---

## 🐛 If Something Doesn't Work

**Event Not Appearing:**
- Check event status is 'published'
- Check is_active is true
- Refresh page

**Can't Purchase:**
- Check ticket availability
- Verify Stripe keys configured
- Check browser console

**QR Code Won't Scan:**
- Ensure QR code is clear and visible
- Check camera permissions
- Try manual entry option

**Dashboard Wrong:**
- Refresh dashboard
- Check database directly
- Verify RLS policies

---

**Ready to test! Follow the steps above and capture screenshots at each stage.** 📸

