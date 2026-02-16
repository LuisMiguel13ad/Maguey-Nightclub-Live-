# Complete Event Testing Guide - PRE THANKSGIVING BASH

## 📋 Overview

This guide walks you through creating the event, purchasing a ticket, scanning it, and verifying everything appears correctly in the dashboard.

**Test User Email:** `demo@maguey.com` (or your test account email)

---

## STEP 1: Create Event in Dashboard

### 1.1 Navigate to Event Management
- **URL:** `http://localhost:5175/events` (or your dashboard URL)
- **Login:** Use your owner account credentials

### 1.2 Create New Event
1. Click **"Create Event"** button
2. Fill in the following details:

**Basic Information:**
- **Event Name:** `PRE THANKSGIVING BASH`
- **Description:** 
```
Join us for an epic Pre Thanksgiving Bash featuring HANE Rodriguez with special guests HER PANTH, LKII NORTEÑA, Dj Calle, and ALMAS DE ACERO.

Event Details:
- Headliner: HANE Rodriguez
- Supporting Acts: HER PANTH, LKII NORTEÑA, Dj Calle, ALMAS DE ACERO
- Age: 16+ with parent, 21+ to drink
- Share required before 8 PM
- Women free before 10 PM
- Men $35 before 10 PM

Presented by LA EMPRESA MUSIC & EVENTOS PERRONES
```

- **Date:** `2025-11-26` (November 26, 2025)
- **Time:** `21:00` (9:00 PM)
- **Venue Name:** `Maguey Delaware`
- **Venue Address:** `3320 Old Capitol Trail`
- **City:** `Wilmington`

**Event Status:**
- **Status:** Select `Published` (so it appears on all sites immediately)

**Ticket Types:**
Add these ticket types:

1. **Women - Before 10 PM**
   - Name: `Women - Before 10 PM`
   - Price: `0.00`
   - Capacity: `200`

2. **Men - Before 10 PM**
   - Name: `Men - Before 10 PM`
   - Price: `35.00`
   - Capacity: `300`

3. **General Admission - After 10 PM**
   - Name: `General Admission - After 10 PM`
   - Price: `50.00`
   - Capacity: `200`

### 1.3 Save Event
- Click **"Save Event"**
- ✅ **SCREENSHOT 1:** Event created confirmation message
- ✅ **SCREENSHOT 2:** Event list showing "PRE THANKSGIVING BASH"

---

## STEP 2: Verify Event on All Sites

### 2.1 Main Website (Marketing Site)
- **URL:** `http://localhost:3000` (or your main site URL)
- Navigate to Events page
- ✅ **SCREENSHOT 3:** Main website showing "PRE THANKSGIVING BASH" event

### 2.2 Purchase Website (Ticket Sales)
- **URL:** `http://localhost:5173/events` (or your purchase site URL)
- Navigate to Events page
- ✅ **SCREENSHOT 4:** Purchase website showing "PRE THANKSGIVING BASH" event
- Click on the event to view details
- ✅ **SCREENSHOT 5:** Event detail page showing ticket types and pricing

---

## STEP 3: Purchase Ticket

### 3.1 Login to Purchase Site
- **URL:** `http://localhost:5173/login`
- **Email:** `demo@maguey.com` (or your test account email)
- **Password:** `demo1234` (or your test password)
- ✅ **SCREENSHOT 6:** Login successful

### 3.2 Select Event and Tickets
1. Navigate to Events page
2. Click on **"PRE THANKSGIVING BASH"**
3. Select ticket type: **"Men - Before 10 PM"** ($35)
4. Select quantity: `1`
5. Click **"BUY TICKETS"** or **"Add to Cart"**
- ✅ **SCREENSHOT 7:** Checkout page with ticket selected

### 3.3 Complete Checkout
1. Fill in customer information:
   - **Name:** `Test Customer`
   - **Email:** `demo@maguey.com` (same as login)
   - **Phone:** `(555) 123-4567`
2. Click **"Proceed to Payment"**
3. Use Stripe test card:
   - **Card Number:** `4242 4242 4242 4242`
   - **Expiry:** Any future date (e.g., `12/25`)
   - **CVC:** Any 3 digits (e.g., `123`)
   - **ZIP:** Any 5 digits (e.g., `12345`)
4. Complete payment
- ✅ **SCREENSHOT 8:** Payment processing page
- ✅ **SCREENSHOT 9:** Order confirmation page

### 3.4 View Ticket
- After payment, you should see your ticket with QR code
- ✅ **SCREENSHOT 10:** Ticket page showing QR code clearly
- **IMPORTANT:** Save this QR code - you'll need it for scanning!

---

## STEP 4: Verify Order in Dashboard

### 4.1 Check Recent Purchases
- **URL:** `http://localhost:5175/dashboard`
- Navigate to Dashboard
- Scroll to **"Recent Purchases"** section
- ✅ **SCREENSHOT 11:** Dashboard showing order for "PRE THANKSGIVING BASH"
- Verify:
  - Customer email: `demo@maguey.com`
  - Event name: `PRE THANKSGIVING BASH`
  - Ticket type: `Men - Before 10 PM`
  - Amount: `$35.00`
  - Status: `completed`

### 4.2 Check Analytics
- Scroll to **Analytics Dashboard** section
- Check **"Total Revenue"** - should show at least $35
- Check **"Tickets Sold"** - should show at least 1
- ✅ **SCREENSHOT 12:** Analytics showing updated revenue

---

## STEP 5: Scan Ticket Manually

### 5.1 Navigate to Scanner
- **URL:** `http://localhost:5175/scanner`
- Login if needed (use owner or staff account)

### 5.2 Manual Entry Test
1. Find the **"Manual Entry"** or **"Enter Ticket ID"** field
2. Enter the **Ticket ID** from your ticket (e.g., `MGY-1B-20251126-XXXXX-XXXX`)
3. Click **"Scan"** or **"Validate"**
- ✅ **SCREENSHOT 13:** Scanner page before scan
- ✅ **SCREENSHOT 14:** Scanner showing "Ticket Valid" or "Entry Granted"
- Verify:
  - Event name matches
  - Ticket type matches
  - Customer name matches
  - Status shows as "scanned"

---

## STEP 6: Scan Ticket with QR Code

### 6.1 Prepare QR Code
- Open the ticket page from Step 3.4
- Have the QR code visible on screen (or print it)

### 6.2 Scan QR Code
1. On Scanner page, click **"Scan QR Code"** or enable camera
2. Point camera at QR code (or upload QR code image)
3. Scanner should automatically detect and validate
- ✅ **SCREENSHOT 15:** Scanner camera view showing QR code
- ✅ **SCREENSHOT 16:** Scanner showing successful QR scan result

### 6.3 Verify Scan Result
- Should show:
  - ✅ "Ticket Valid"
  - ✅ "Entry Granted"
  - ✅ Event name: "PRE THANKSGIVING BASH"
  - ✅ Ticket type: "Men - Before 10 PM"
  - ✅ Customer: "Test Customer"
  - ✅ Status: "Scanned"

---

## STEP 7: Verify Scan in Dashboard

### 7.1 Check Activity Feed
- **URL:** `http://localhost:5175/dashboard`
- Scroll to **"Activity Feed"** section
- ✅ **SCREENSHOT 17:** Activity Feed showing ticket scan entry
- Verify:
  - Shows ticket scan event
  - Shows customer name
  - Shows event name
  - Shows timestamp

### 7.2 Check Analytics Updates
- Check **"Tickets Scanned"** count - should be 1
- Check **"Conversion Rate"** - should show percentage
- ✅ **SCREENSHOT 18:** Analytics showing updated scan statistics

### 7.3 Check Recent Purchases Update
- Go back to **"Recent Purchases"**
- The order should now show as scanned
- ✅ **SCREENSHOT 19:** Recent Purchases showing scanned status

---

## STEP 8: Verify Transaction Details

### 8.1 Check Order Details
- In Dashboard, click on the order from Recent Purchases
- Or navigate to Analytics → Sales Performance
- ✅ **SCREENSHOT 20:** Order details showing:
  - Order ID
  - Customer email
  - Event name
  - Ticket type
  - Amount paid
  - Purchase date/time
  - Scan status

### 8.2 Check Revenue Breakdown
- Navigate to **Analytics** → **Sales Performance** tab
- Check **"Event Comparison"** chart
- Should show "PRE THANKSGIVING BASH" with $35 revenue
- ✅ **SCREENSHOT 21:** Analytics showing event revenue breakdown

---

## 📸 Screenshot Checklist Summary

1. ✅ Event created confirmation
2. ✅ Event list showing "PRE THANKSGIVING BASH"
3. ✅ Main website showing event
4. ✅ Purchase website showing event
5. ✅ Event detail page with ticket types
6. ✅ Login successful on purchase site
7. ✅ Checkout page with ticket selected
8. ✅ Payment processing
9. ✅ Order confirmation
10. ✅ Ticket page with QR code
11. ✅ Dashboard Recent Purchases showing order
12. ✅ Dashboard Analytics showing revenue
13. ✅ Scanner page before scan
14. ✅ Scanner showing manual scan success
15. ✅ Scanner camera view with QR code
16. ✅ Scanner showing QR scan success
17. ✅ Activity Feed showing scan
18. ✅ Analytics showing scan statistics
19. ✅ Recent Purchases showing scanned status
20. ✅ Order details page
21. ✅ Analytics event revenue breakdown

---

## 🧪 Automated Verification Script

Run this script to verify all steps programmatically:

```bash
cd maguey-gate-scanner
npx tsx test-complete-event-flow.ts
```

This will check:
- ✅ Event exists and is published
- ✅ Ticket types are created
- ✅ Order exists for test user
- ✅ Ticket exists with QR code
- ✅ QR code can be scanned
- ✅ Dashboard stats are updated

---

## ⚠️ Troubleshooting

### Event Not Showing on Sites
- Check event status is "Published"
- Check `is_active = true` in database
- Refresh pages (or wait for real-time sync)

### Ticket Purchase Fails
- Verify Stripe test keys are configured
- Check browser console for errors
- Verify event has ticket types with capacity > 0

### QR Code Won't Scan
- Verify QR code is clear and not blurry
- Check ticket has `qr_token` field populated
- Verify scanner has camera permissions

### Dashboard Not Updating
- Refresh dashboard page
- Check browser console for errors
- Verify Supabase connection is active

---

## ✅ Success Criteria

All tests pass when:
- [x] Event appears on all 3 sites
- [x] Can purchase ticket successfully
- [x] Order appears in dashboard
- [x] Ticket can be scanned manually
- [x] Ticket can be scanned with QR code
- [x] Scan appears in Activity Feed
- [x] Revenue updates in Analytics
- [x] All transactions visible in dashboard

---

**Last Updated:** November 2025
**Test User:** demo@maguey.com

