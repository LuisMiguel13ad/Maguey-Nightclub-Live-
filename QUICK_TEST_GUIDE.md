# 🚀 Quick Test Guide - End-to-End Flow

## ⚡ Fast Track Testing (5 Minutes)

### Prerequisites
- ✅ All 3 servers running:
  - Scanner: http://localhost:5175
  - Main: http://localhost:3000  
  - Purchase: http://localhost:5173

---

## 🎯 Quick Test Steps

### 1️⃣ Main Site → Browse Events
**URL:** http://localhost:3000

- Open in browser
- Verify events are displayed
- **Screenshot:** Events list page

**Test Event Available:**
- "Reggaeton Fridays - November 21" (has tickets)
- "GRUPO EXTERMINADOR Y LOS TERRIBLES DEL NORTE" (has ticket types)
- "Cumbia Nights - November 23" (has ticket types)

---

### 2️⃣ Purchase Site → Buy Ticket
**URL:** http://localhost:5173/events

**Steps:**
1. Click on an event (e.g., "Reggaeton Fridays - November 21")
2. Select ticket type (General Admission or VIP)
3. Select quantity
4. Click "BUY TICKETS"
5. Fill checkout form:
   - Name: Test Customer
   - Email: test@example.com
   - Phone: (555) 123-4567
6. Click "Proceed to Payment"
7. Use Stripe test card: **4242 4242 4242 4242**
8. Complete payment

**Screenshots:**
- Event detail page
- Checkout page
- Payment confirmation

---

### 3️⃣ View Ticket (QR Code) ⭐
**URL:** http://localhost:5173/checkout/success?session_id=[session]&orderId=[orderId]

**After payment, you'll see:**
- Order confirmation
- **Ticket with QR Code** ⭐
- Ticket details (event, type, attendee name)

**CRITICAL SCREENSHOT:**
- 📸 **Ticket page showing QR code clearly**

**What to verify:**
- QR code is visible and clear
- Event name is correct
- Ticket type is correct
- Attendee name matches
- QR code can be scanned (test with phone camera)

---

### 4️⃣ Scanner Site → Scan Ticket ⭐
**URL:** http://localhost:5175/scanner

**Steps:**
1. Log in (or use demo login)
2. Navigate to Scanner page
3. Select event (if selector exists)
4. Enable camera or use manual entry
5. **Scan the QR code from Step 3**
   - Option A: Use screenshot on another device
   - Option B: Use manual entry (enter QR token)
6. Verify ticket details appear

**CRITICAL SCREENSHOTS:**
- 📸 **Scanner interface** (camera view or manual entry)
- 📸 **Ticket validation result** (showing ticket details)

**What to verify:**
- Scanner opens successfully
- QR code scans (or manual entry works)
- Ticket details display:
  - ✅ Attendee name
  - ✅ Event name
  - ✅ Ticket type
  - ✅ Status: "Valid" or "Issued"
- Success message appears
- Ticket status updates to "scanned"

---

### 5️⃣ Dashboard → View Analytics ⭐
**URL:** http://localhost:5175/dashboard

**Steps:**
1. Navigate to Owner Dashboard
2. View analytics cards:
   - Revenue (Today, Week, Month, All Time)
   - Tickets Purchased
   - Tickets Scanned
   - Active Events
   - Scan Rate %
3. Scroll to "Recent Purchases" table
4. Find your test order

**CRITICAL SCREENSHOT:**
- 📸 **Dashboard showing:**
  - Revenue metrics
  - Ticket counts
  - Scan rate
  - Recent purchases table with your order

**What to verify:**
- Revenue shows your order amount
- Tickets Purchased count increased
- Tickets Scanned count increased (if scanned)
- Scan Rate calculated correctly
- Your order appears in Recent Purchases:
  - Order ID
  - Customer Email (test@example.com)
  - Amount ($30.00 or your total)
  - Status: "paid"

---

## 📸 Screenshot Checklist

**Required Screenshots:**

1. ✅ Main Site - Events List
2. ✅ Purchase Site - Event Detail
3. ✅ Purchase Site - Checkout
4. ⭐ **Purchase Site - Ticket with QR Code** (MOST IMPORTANT)
5. ⭐ **Scanner Site - Scanner Interface**
6. ⭐ **Scanner Site - Ticket Validation Result**
7. ⭐ **Scanner Site - Owner Dashboard** (MOST IMPORTANT)
8. ✅ Scanner Site - Event Management (optional)

---

## 🔍 Quick Verification

### Check Database (Supabase Dashboard):

**Orders Table:**
```sql
SELECT * FROM orders 
WHERE purchaser_email = 'test@example.com' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Tickets Table:**
```sql
SELECT t.*, o.purchaser_email, e.name as event_name
FROM tickets t
JOIN orders o ON o.id = t.order_id
JOIN events e ON e.id = t.event_id
WHERE o.purchaser_email = 'test@example.com'
ORDER BY t.created_at DESC
LIMIT 1;
```

**Verify:**
- Order exists with status "paid"
- Ticket exists with QR token
- Ticket status is "issued" or "scanned"

---

## 🎯 Test Event IDs (for direct links)

**Event:** "Reggaeton Fridays - November 21"
- ID: `207a005d-b1d6-477b-b2a0-722b926d268c`
- Direct link: http://localhost:5173/event/207a005d-b1d6-477b-b2a0-722b926d268c

**Event:** "GRUPO EXTERMINADOR Y LOS TERRIBLES DEL NORTE"
- ID: `a4409aa6-1e34-4663-976f-afa09bba60b4`
- Direct link: http://localhost:5173/event/a4409aa6-1e34-4663-976f-afa09bba60b4

---

## 💡 Pro Tips

1. **Use Two Devices:**
   - Computer: For purchasing and viewing ticket
   - Phone: For scanning QR code

2. **Stripe Test Cards:**
   - Success: 4242 4242 4242 4242
   - Decline: 4000 0000 0000 0002

3. **Manual Entry (if camera doesn't work):**
   - Scanner site has manual entry option
   - Enter the QR token from ticket

4. **Check Browser Console:**
   - F12 → Console tab
   - Look for any errors
   - Verify API calls succeed

---

## ✅ Success Indicators

**Everything is working if:**
- ✅ Events appear on all sites
- ✅ Can purchase tickets successfully
- ✅ Ticket displays with QR code
- ✅ QR code scans successfully
- ✅ Dashboard shows order
- ✅ Analytics are accurate

---

## 🐛 Quick Fixes

**Event not showing:**
- Check: `status = 'published'` and `is_active = true`
- Refresh page

**Can't purchase:**
- Check ticket availability
- Verify Stripe keys configured
- Check browser console

**QR won't scan:**
- Use manual entry option
- Verify QR token format
- Check ticket status

**Dashboard wrong:**
- Refresh dashboard
- Check database directly
- Verify RLS policies

---

**Ready to test! Follow the steps above and capture screenshots.** 📸

