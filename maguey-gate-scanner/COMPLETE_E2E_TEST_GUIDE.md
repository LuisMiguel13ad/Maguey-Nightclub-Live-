# Complete End-to-End Test Guide - 5 Tickets

## ✅ Automated Test Results

**Status: 100% PASSED** ✅

### Test Summary
- ✅ Event Verification: Event found and published
- ✅ Ticket Type: Found "Men - Before 10 PM" ($35)
- ✅ Order Creation: Order created successfully
- ✅ Ticket Creation: 5 tickets created
- ✅ Order Verification: Order visible in dashboard
- ✅ QR Code Scanning: 2 tickets scanned via QR code
- ✅ Manual Scanning: 3 tickets scanned manually
- ✅ Dashboard Analytics: Analytics calculated correctly

### Created Test Data
- **Order ID**: `b70fc2a2-955b-4e73-9378-8207ecfd7e68`
- **Tickets Created**: 5 tickets
- **Tickets Scanned**: 5 tickets (2 QR + 3 manual)
- **Total Revenue**: $175 ($35 × 5)
- **Event**: PRE THANKSGIVING BASH

---

## 📋 Manual Testing Steps

Since I cannot interact with browsers directly, please complete these manual steps to verify the full user experience:

### 1. 🌐 Main Website Verification
**URL**: http://localhost:3000

**Steps**:
1. Open the main website in your browser
2. Verify "PRE THANKSGIVING BASH" appears in the events list
3. Click on the event to view details
4. Verify event information displays correctly:
   - Event name: PRE THANKSGIVING BASH
   - Date: November 26, 2025 (Wednesday)
   - Time: 9:00 PM
   - Venue: Maguey Delaware
   - Address: 3320 Old Capitol Trail, Wilmington DE 19808
5. Click "Buy Tickets" button
6. Verify redirect to Purchase Website

**Screenshots Needed**:
- [ ] Event listing page showing PRE THANKSGIVING BASH
- [ ] Event detail page

---

### 2. 🛒 Purchase Website - Buy 5 Tickets
**URL**: http://localhost:5173/events

**Steps**:
1. Navigate to Purchase Website
2. **Login** (if required):
   - Email: `demo@maguey.com`
   - Password: `demo1234`
3. Find "PRE THANKSGIVING BASH" in the events list
4. Click on the event
5. Select ticket type: **"Men - Before 10 PM"** ($35)
6. Set quantity to **5 tickets**
7. Click "Add to Cart" or "Checkout"
8. Review order summary:
   - Should show: 5 × $35 = $175
9. Proceed to checkout
10. Use Stripe test card:
    - Card Number: `4242 4242 4242 4242`
    - Expiry: Any future date (e.g., `12/25`)
    - CVC: Any 3 digits (e.g., `123`)
    - ZIP: Any 5 digits (e.g., `12345`)
11. Complete payment
12. After payment confirmation, navigate to "My Tickets" or "Tickets" page
13. Verify 5 tickets are displayed with QR codes

**Screenshots Needed**:
- [ ] Event listing on Purchase Website
- [ ] Event detail with ticket types
- [ ] Checkout page showing 5 tickets selected
- [ ] Payment confirmation page
- [ ] Tickets page showing 5 tickets with QR codes

---

### 3. 📱 Scanner Site - QR Code Scanning
**URL**: http://localhost:5175/scanner

**Steps**:
1. Navigate to Scanner Site
2. Login with owner/staff account
3. Select "PRE THANKSGIVING BASH" event (if event selector exists)
4. **Test QR Code Scanning**:
   - Click "Scan QR Code" or enable camera
   - Scan QR code from **2-3 tickets** purchased above
   - Verify each scan shows:
     - ✅ "Entry Granted" or "Valid Ticket"
     - Ticket holder name
     - Ticket type
     - Event name
5. Verify scan appears in activity log

**Screenshots Needed**:
- [ ] Scanner page before scanning (empty state)
- [ ] QR code scan in progress (camera view)
- [ ] Successful QR scan result showing "Entry Granted"

---

### 4. 📱 Scanner Site - Manual Scanning
**URL**: http://localhost:5175/scanner

**Steps**:
1. On the same scanner page
2. **Test Manual Entry**:
   - Click "Manual Entry" or find ticket ID input field
   - Enter ticket ID manually for **2-3 tickets** (from purchased tickets)
   - Ticket ID format: `MGY-1B-20251126-XXXXXX-XXXX`
   - Click "Verify" or "Scan"
   - Verify each manual scan shows:
     - ✅ "Entry Granted" or "Valid Ticket"
     - Ticket details
3. Verify manual scans appear in activity log

**Screenshots Needed**:
- [ ] Manual entry field
- [ ] Successful manual scan result showing "Entry Granted"

---

### 5. 📊 Dashboard Verification
**URL**: http://localhost:5175/dashboard

**Steps**:
1. Navigate to Owner Dashboard
2. **Check Recent Purchases**:
   - Should show order for 5 tickets
   - Customer: demo@maguey.com
   - Total: $175
   - Status: Paid/Completed
3. **Check Analytics**:
   - Total Revenue: Should show $175+ (includes test order)
   - Tickets Sold: Should show 5+ tickets
   - Conversion Rate: Should reflect scanned tickets
4. **Check Activity Feed**:
   - Should show scan entries for all scanned tickets
   - Should show order creation
5. **Check KPI Cards**:
   - Tickets Scanned: Should match number of scans performed
   - Revenue: Should reflect $175 from this order
   - Active Events: Should show PRE THANKSGIVING BASH

**Screenshots Needed**:
- [ ] Recent Purchases section showing order
- [ ] Analytics page showing $175 revenue
- [ ] Activity Feed showing scan entries
- [ ] KPI cards updated with metrics
- [ ] Full dashboard overview

---

## 📸 Complete Screenshot Checklist

### Main Website (2 screenshots)
- [ ] Event listing showing PRE THANKSGIVING BASH
- [ ] Event detail page

### Purchase Website (5 screenshots)
- [ ] Event listing
- [ ] Event detail with ticket types
- [ ] Checkout page (5 tickets selected)
- [ ] Payment confirmation
- [ ] Tickets page showing 5 tickets with QR codes

### Scanner Site (4 screenshots)
- [ ] Before scanning (empty state)
- [ ] QR code scan in progress
- [ ] Successful QR scan result
- [ ] Manual entry field
- [ ] Successful manual scan result

### Dashboard (5 screenshots)
- [ ] Recent Purchases showing order
- [ ] Analytics showing $175 revenue
- [ ] Activity Feed showing scans
- [ ] KPI cards updated
- [ ] Full overview with all metrics

**Total: 17 Screenshots**

---

## 🔍 Verification Checklist

After completing all manual steps, verify:

- [ ] Event appears on Main Website
- [ ] Event appears on Purchase Website
- [ ] Can purchase 5 tickets successfully
- [ ] Payment processes correctly
- [ ] Tickets display with QR codes
- [ ] QR code scanning works (2-3 tickets)
- [ ] Manual scanning works (2-3 tickets)
- [ ] Order appears in Dashboard Recent Purchases
- [ ] Revenue shows $175 in Analytics
- [ ] Activity Feed shows all scans
- [ ] KPI cards updated correctly

---

## 🐛 Troubleshooting

### Event Not Showing
- **Solution**: Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- **Solution**: Restart development servers:
  ```bash
  # Main Website
  cd maguey-nights && npm run dev
  
  # Purchase Website
  cd maguey-pass-lounge && npm run dev
  ```

### Tickets Not Scanning
- **Solution**: Verify ticket QR code contains the `qr_token` UUID
- **Solution**: Check scanner is connected to correct Supabase project
- **Solution**: Verify RLS policies allow ticket reading

### Dashboard Not Updating
- **Solution**: Refresh dashboard page
- **Solution**: Check browser console for errors
- **Solution**: Verify Supabase real-time subscriptions are active

---

## 📊 Test Data Reference

### Test Order Details
- **Order ID**: `b70fc2a2-955b-4e73-9378-8207ecfd7e68`
- **Customer Email**: `demo@maguey.com`
- **Ticket Type**: Men - Before 10 PM
- **Quantity**: 5 tickets
- **Price per Ticket**: $35
- **Total**: $175
- **Status**: Paid

### Test Tickets Created (Automated)
- 5 tickets created successfully
- All 5 tickets scanned (2 QR + 3 manual)
- QR tokens available for testing

### Event Details
- **Name**: PRE THANKSGIVING BASH
- **Date**: November 26, 2025 (Wednesday)
- **Time**: 9:00 PM
- **Venue**: Maguey Delaware
- **Address**: 3320 Old Capitol Trail, Wilmington DE 19808

---

## ✅ Success Criteria

The test is considered successful when:

1. ✅ Event visible on both Main and Purchase websites
2. ✅ Can purchase 5 tickets through Purchase Website
3. ✅ Payment processes successfully
4. ✅ Tickets display with valid QR codes
5. ✅ QR code scanning works (minimum 2 tickets)
6. ✅ Manual scanning works (minimum 2 tickets)
7. ✅ Order appears in Dashboard Recent Purchases
8. ✅ Revenue shows $175 in Dashboard Analytics
9. ✅ Activity Feed shows all scan entries
10. ✅ All 17 screenshots captured

---

## 🎉 Next Steps

After completing all manual tests:

1. Review all screenshots
2. Verify all checkboxes are checked
3. Document any issues found
4. Test edge cases (if time permits):
   - Invalid QR code scanning
   - Already-scanned ticket
   - Expired ticket
   - Wrong event ticket

---

**Test Completed**: _______________  
**Tester Name**: _______________  
**Issues Found**: _______________  
**Notes**: _______________

