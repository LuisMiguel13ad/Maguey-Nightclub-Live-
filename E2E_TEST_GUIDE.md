# 🧪 End-to-End Test Guide
## Complete Flow: Purchase → Ticket Display → Scanning → Dashboard

This guide walks you through testing the entire system flow with screenshots and verification steps.

---

## 🎯 Test Flow Overview

```
1. Main Site → Browse Events
2. Purchase Site → Select Tickets → Checkout
3. Purchase Site → View Ticket (with QR code)
4. Scanner Site → Scan QR Code
5. Scanner Site → Dashboard → View Analytics
```

---

## 📋 Pre-Test Checklist

- [ ] All three dev servers are running:
  - Scanner: http://localhost:5175
  - Main: http://localhost:3000
  - Purchase: http://localhost:5173
- [ ] Supabase is configured and connected
- [ ] Test event has been created (run test script)

---

## 🚀 Step-by-Step Test Instructions

### STEP 1: Main Site - Browse Events

**URL:** http://localhost:3000

**Actions:**
1. Open the main site in your browser
2. Verify you see the test event: "E2E Test Event - [date]"
3. Check event card shows:
   - Event image
   - Event name
   - Date and time
   - Genre
   - "Buy Tickets" button

**Expected Result:**
- Event appears in the events list
- Event card is clickable
- "Buy Tickets" button is visible

**Screenshot Location:**
- Take screenshot of events list
- Take screenshot of event card hover state

---

### STEP 2: Purchase Site - Select Tickets

**URL:** http://localhost:5173/events

**Actions:**
1. Navigate to Purchase Site
2. Find the test event
3. Click on the event to view details
4. Select ticket type (General Admission or VIP)
5. Select quantity (1-10)
6. Click "Buy Tickets" or "Add to Cart"

**Expected Result:**
- Event detail page loads
- Ticket types are displayed
- Availability shows (e.g., "100 left")
- Price and fees are shown
- Quantity selector works

**Screenshot Location:**
- Take screenshot of event detail page
- Take screenshot of ticket selection

---

### STEP 3: Purchase Site - Checkout & Payment

**URL:** http://localhost:5173/checkout?event=[eventId]&ticket=[ticketTypeId]

**Actions:**
1. Review order summary
2. Fill in customer information:
   - Name
   - Email
   - Phone (optional)
3. Apply promo code (optional)
4. Click "Proceed to Payment"
5. Complete Stripe checkout (use test card: 4242 4242 4242 4242)

**Expected Result:**
- Order summary is correct
- Form validation works
- Stripe checkout loads
- Payment succeeds
- Redirects to confirmation page

**Screenshot Location:**
- Take screenshot of checkout page
- Take screenshot of order confirmation

---

### STEP 4: Purchase Site - View Ticket

**URL:** http://localhost:5173/order/[orderId] or confirmation page

**Actions:**
1. After payment, view ticket confirmation
2. Verify ticket shows:
   - Event name
   - Ticket type
   - QR code
   - Attendee name
   - Order number
3. Download ticket (if option available)

**Expected Result:**
- Ticket displays correctly
- QR code is visible and scannable
- All ticket details are accurate
- Ticket can be saved/downloaded

**Screenshot Location:**
- **TAKE SCREENSHOT OF TICKET WITH QR CODE** ⭐
- Take screenshot of ticket details

---

### STEP 5: Scanner Site - Scan Ticket

**URL:** http://localhost:5175/scanner

**Actions:**
1. Log in as staff/employee
2. Navigate to Scanner page
3. Select the test event (if event selector exists)
4. Click "Start Scanning" or enable camera
5. Scan the QR code from Step 4
6. Verify ticket details appear:
   - Attendee name
   - Event name
   - Ticket type
   - Status (should show as valid)

**Expected Result:**
- Scanner opens camera
- QR code scans successfully
- Ticket details display correctly
- Status updates to "scanned"
- Success message appears

**Screenshot Location:**
- **TAKE SCREENSHOT OF SCANNER INTERFACE** ⭐
- Take screenshot of ticket validation result
- Take screenshot of success message

---

### STEP 6: Scanner Site - Dashboard Analytics

**URL:** http://localhost:5175/dashboard

**Actions:**
1. Navigate to Owner Dashboard
2. View analytics:
   - Revenue (Today, Week, Month, All Time)
   - Tickets Purchased
   - Tickets Scanned
   - Active Events
   - Scan Rate
3. Check Recent Purchases table
4. Verify your test order appears

**Expected Result:**
- Dashboard loads with stats
- Revenue shows the test order amount
- Tickets Purchased count includes your ticket
- Tickets Scanned count includes scanned ticket
- Recent Purchases table shows your order
- Scan rate is calculated correctly

**Screenshot Location:**
- **TAKE SCREENSHOT OF DASHBOARD** ⭐
- Take screenshot of analytics cards
- Take screenshot of recent purchases table

---

### STEP 7: Scanner Site - Event Management

**URL:** http://localhost:5175/events

**Actions:**
1. Navigate to Event Management
2. Find the test event
3. View event details
4. Check ticket sales:
   - Total sold
   - Available
   - Revenue

**Expected Result:**
- Event appears in list
- Event details are correct
- Ticket sales data is accurate
- Can edit/update event if needed

**Screenshot Location:**
- Take screenshot of event management page
- Take screenshot of event details

---

## 📊 Data Verification

### Check Database Directly:

```sql
-- Verify order exists
SELECT * FROM orders WHERE purchaser_email = 'test@example.com' ORDER BY created_at DESC LIMIT 1;

-- Verify ticket exists
SELECT * FROM tickets WHERE order_id = '[order_id]';

-- Verify scan log exists
SELECT * FROM ticket_scan_logs WHERE ticket_id = '[ticket_id]';

-- Check dashboard stats
SELECT 
  COUNT(*) as total_orders,
  SUM(total) as total_revenue
FROM orders 
WHERE event_id = '[event_id]';
```

---

## ✅ Success Criteria

All steps should complete without errors:

- [x] Event appears on Main Site
- [x] Event appears on Purchase Site
- [x] Can select and purchase tickets
- [x] Ticket displays with QR code
- [x] QR code scans successfully
- [x] Ticket status updates to "scanned"
- [x] Dashboard shows correct analytics
- [x] Order appears in recent purchases
- [x] Scan rate is calculated correctly

---

## 🐛 Troubleshooting

### Issue: Event doesn't appear
- Check event status is 'published'
- Check is_active is true
- Verify Supabase connection

### Issue: Can't purchase tickets
- Check ticket availability
- Verify Stripe keys are configured
- Check browser console for errors

### Issue: QR code won't scan
- Verify QR code is visible and clear
- Check camera permissions
- Verify QR token format is correct

### Issue: Dashboard shows wrong data
- Refresh dashboard
- Check database directly
- Verify RLS policies allow access

---

## 📸 Screenshot Checklist

Take screenshots of:

1. ✅ Main Site - Events List
2. ✅ Purchase Site - Event Detail
3. ✅ Purchase Site - Checkout Page
4. ✅ **Purchase Site - Ticket with QR Code** ⭐
5. ✅ Scanner Site - Scanner Interface
6. ✅ Scanner Site - Ticket Validation Result
7. ✅ **Scanner Site - Dashboard** ⭐
8. ✅ Scanner Site - Event Management

---

## 🎉 Test Complete!

After completing all steps, you should have:
- Verified the complete purchase flow
- Confirmed ticket generation works
- Validated QR code scanning
- Verified dashboard analytics
- Screenshots of all key screens

**All systems are working correctly!** 🚀

