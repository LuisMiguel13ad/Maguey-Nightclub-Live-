# 🎟️ Test Ticket Information

## Existing Test Ticket for Quick Testing

**Ticket ID:** `80947d01-4d36-4526-81d3-33f7ce2be4cf`  
**QR Token:** `037bf9c8-3f59-4031-9e44-f54c005ef7ab`  
**Status:** `issued` (ready to scan)

**Ticket Details:**
- **Event:** Reggaeton Fridays - November 21
- **Ticket Type:** VIP
- **Attendee:** Test Customer
- **Email:** testcustomer@maguey.com
- **Order ID:** `471754da-46cd-41fe-aeda-45e1fea5b01b`
- **Total:** $75.00

---

## 🔗 Direct Test Links

### View Ticket (Purchase Site):
http://localhost:5173/ticket/80947d01-4d36-4526-81d3-33f7ce2be4cf

### Scan Ticket (Scanner Site):
http://localhost:5175/scanner
- Use manual entry: `037bf9c8-3f59-4031-9e44-f54c005ef7ab`

### View Dashboard:
http://localhost:5175/dashboard

### View Event:
http://localhost:5173/event/207a005d-b1d6-477b-b2a0-722b926d268c

---

## 📸 Quick Test Steps

1. **View Ticket:** Open http://localhost:5173/ticket/80947d01-4d36-4526-81d3-33f7ce2be4cf
   - 📸 **Screenshot:** Ticket page with QR code

2. **Scan Ticket:** Open http://localhost:5175/scanner
   - Enter QR token: `037bf9c8-3f59-4031-9e44-f54c005ef7ab`
   - 📸 **Screenshot:** Scanner interface and validation result

3. **View Dashboard:** Open http://localhost:5175/dashboard
   - 📸 **Screenshot:** Dashboard with analytics

---

## 🎯 Full Purchase Flow Test

To test the complete purchase flow:

1. **Main Site:** http://localhost:3000
   - Browse events
   - Click "Buy Tickets"

2. **Purchase Site:** http://localhost:5173/events
   - Select event
   - Choose tickets
   - Complete checkout
   - Use Stripe test card: 4242 4242 4242 4242

3. **View Ticket:** After purchase, click "View My Tickets"
   - 📸 **Screenshot:** Ticket with QR code

4. **Scan Ticket:** http://localhost:5175/scanner
   - Scan QR code
   - 📸 **Screenshot:** Validation result

5. **Dashboard:** http://localhost:5175/dashboard
   - View analytics
   - 📸 **Screenshot:** Dashboard

---

**Ready to test!** Follow COMPLETE_TEST_WALKTHROUGH.md for detailed instructions.

