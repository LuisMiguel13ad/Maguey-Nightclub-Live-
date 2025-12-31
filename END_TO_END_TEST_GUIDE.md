# End-to-End Test Guide

This guide walks you through testing the complete flow across all three sites.

## Prerequisites

✅ All three development servers are running:
- Scanner Site: http://localhost:5175
- Main Site: http://localhost:3000
- Purchase Site: http://localhost:5173

---

## Test 1: Main Site Event Listings ✅

### Steps:
1. Open http://localhost:3000 in your browser
2. Check the homepage for event listings
3. Verify events are displaying with:
   - Event name
   - Date and time
   - Venue information
   - Event images
   - "Get Tickets" or "Buy Tickets" buttons

### Expected Results:
- ✅ Events are displayed correctly
- ✅ Each event card has a "Get Tickets" button
- ✅ Clicking "Get Tickets" navigates to purchase site

### Verification:
- Open browser console (F12) → Check for errors
- Verify events are loading from Supabase
- Check that purchase URLs are generated correctly

---

## Test 2: Purchase Site Navigation ✅

### Steps:
1. From main site, click "Get Tickets" on any event
2. Should navigate to: `http://localhost:5173/event/{eventId}`
3. Verify the purchase site loads the event details

### Expected Results:
- ✅ Navigation works correctly
- ✅ Purchase site displays event information
- ✅ Ticket types are shown with prices
- ✅ "Add to Cart" or quantity selectors are visible

### Verification:
- Check URL contains correct event ID
- Verify event name matches main site
- Check ticket types are displayed

---

## Test 3: Purchase Flow (Simulated) ✅

### Steps:
1. On purchase site, select ticket quantities
2. Click "Checkout" or "Continue to Payment"
3. Fill in customer information:
   - First Name
   - Last Name
   - Email
   - Phone (optional)
4. Review order summary
5. **Note:** For testing without payment, you can:
   - Use Stripe test mode with card: `4242 4242 4242 4242`
   - Or simulate the flow up to payment page

### Expected Results:
- ✅ Ticket selection works
- ✅ Order summary shows correct totals
- ✅ Customer form validates correctly
- ✅ Can proceed to payment page

### Verification:
- Check browser console for errors
- Verify ticket quantities update totals
- Check form validation works

---

## Test 4: Ticket Generation & QR Code ✅

### Steps:
1. Complete a test purchase (or use existing ticket)
2. After payment, you should receive:
   - Order confirmation
   - Ticket details
   - QR code image
3. Verify QR code is displayed

### Expected Results:
- ✅ Order is created in database
- ✅ Tickets are generated with QR codes
- ✅ QR code contains:
   - Ticket ID
   - Event information
   - Security signature

### Verification:
- Check `/checkout/success` page shows ticket
- Verify QR code image is displayed
- Check ticket details are correct

---

## Test 5: Scanner QR Code Validation ✅

### Steps:
1. Open scanner site: http://localhost:5175/scanner
2. Use QR code scanner (camera or manual entry)
3. Scan the QR code from purchased ticket
4. Verify ticket validation

### Expected Results:
- ✅ Scanner recognizes QR code
- ✅ Ticket details are displayed:
   - Event name
   - Ticket holder name
   - Ticket type
   - Purchase date
- ✅ Ticket status shows as "valid" or "scanned"
- ✅ Scan is logged in database

### Verification:
- Check scanner displays ticket information
- Verify ticket status updates to "scanned"
- Check scan log is created

---

## Test 6: Event Synchronization ✅

### Steps:
1. Open scanner site: http://localhost:5175/events
2. Create a new event (or update existing)
3. Save the event
4. Check main site: http://localhost:3000
5. Check purchase site: http://localhost:5173/events

### Expected Results:
- ✅ Event appears on main site automatically
- ✅ Event appears on purchase site automatically
- ✅ No page refresh needed (real-time sync)

### Verification:
- Events sync within seconds
- All three sites show same event data
- Real-time subscriptions working

---

## Test 7: Full End-to-End Flow ✅

### Complete Flow:
1. **Create Event** (Scanner Site)
   - Go to http://localhost:5175/events
   - Click "New Event"
   - Fill in event details
   - Add ticket types
   - Save event

2. **View on Main Site**
   - Go to http://localhost:3000
   - Verify event appears
   - Click "Get Tickets"

3. **Purchase Ticket** (Purchase Site)
   - Select ticket quantities
   - Complete checkout
   - Complete payment (test mode)

4. **Receive Ticket**
   - View ticket with QR code
   - Download/save QR code

5. **Scan Ticket** (Scanner Site)
   - Go to http://localhost:5175/scanner
   - Scan QR code
   - Verify ticket validation

### Expected Results:
- ✅ Event created → Appears on all sites
- ✅ Ticket purchased → QR code generated
- ✅ QR code scanned → Ticket validated
- ✅ Complete flow works end-to-end

---

## Troubleshooting

### Events Not Appearing:
- Check Supabase connection
- Verify `is_active = true` for events
- Check real-time subscriptions are active
- Review browser console for errors

### Purchase Not Working:
- Verify Stripe keys are configured
- Check Supabase RLS policies
- Review order creation in database
- Check webhook is receiving events

### QR Code Not Scanning:
- Verify QR code format is correct
- Check scanner has camera permissions
- Verify ticket exists in database
- Check ticket status is "issued"

### Navigation Issues:
- Verify `VITE_PURCHASE_SITE_URL` is set
- Check URLs are using correct ports
- Verify event IDs match across sites

---

## Quick Test Checklist

- [ ] Main site displays events
- [ ] "Buy Tickets" buttons work
- [ ] Purchase site loads event details
- [ ] Ticket selection works
- [ ] Checkout form validates
- [ ] Order creation works
- [ ] QR code is generated
- [ ] Scanner can read QR code
- [ ] Ticket validation works
- [ ] Event sync works across sites

---

## Test Data

### Test Event Example:
- **Name:** "Test Event - End-to-End"
- **Date:** Future date
- **Venue:** Test Venue
- **Ticket Types:**
  - General Admission: $25 (100 available)
  - VIP: $50 (50 available)

### Test Customer:
- **Name:** Test User
- **Email:** test@example.com
- **Card:** 4242 4242 4242 4242 (Stripe test)

---

## Success Criteria

✅ All tests pass when:
1. Events sync across all three sites
2. Navigation links work correctly
3. Purchase flow completes successfully
4. QR codes are generated and scannable
5. Scanner validates tickets correctly
6. No console errors
7. Database records are created correctly

---

**Last Updated:** November 19, 2025

