# Demo Account Test Credentials

## Quick Access Login

**Email:** `demo@maguey.com`  
**Password:** `demo1234`

**Quick Login Button:** Available on http://localhost:5173/login

---

## Test Tickets Created

### Latest Order (Just Created)
- **Order ID:** `b11f7dc2-1285-4cfd-b324-483a716d1caf`
- **Event:** PRE THANKSGIVING BASH
- **Tickets:** 5 tickets
- **Total:** $175.00 ($35 × 5)

### Ticket Details
All tickets are linked to: `demo@maguey.com`

1. **Ticket 1:** `MGY-DEMO-777580-1`
   - QR Token: `97fa49d7-c63f-4c91-bca2-4fa120614b01`

2. **Ticket 2:** `MGY-DEMO-777580-2`
   - QR Token: `a5dd1c01-5cea-46df-a7bd-a86479198f56`

3. **Ticket 3:** `MGY-DEMO-777580-3`
   - QR Token: `6d79a525-16fc-4d4b-b14f-3d01cd60fca9`

4. **Ticket 4:** `MGY-DEMO-777580-4`
   - QR Token: `4cb8b4d2-5c2d-4a3a-b319-d2b396ca66ac`

5. **Ticket 5:** `MGY-DEMO-777580-5`
   - QR Token: `a0492836-44ff-4dbd-a7d4-2fdfa183aa6f`

---

## Testing Steps

### 1. View Tickets
1. Go to: **http://localhost:5173/login**
2. Click **"Quick Login (Demo Account)"** button
3. You'll be redirected to: **http://localhost:5173/account**
4. You should see **"PRE THANKSGIVING BASH"** listed under "Upcoming Events"
5. Click on the event or "View Ticket" to see QR codes

### 2. Test QR Code Scanning
1. Go to: **http://localhost:5175/scanner**
2. Login with owner/staff account
3. Use **Manual Entry** and enter one of the QR tokens above
4. Verify "Entry Granted" appears

---

## Database Status

✅ **Constraint Removed:** `tickets_unique_attendee_per_order` constraint has been dropped  
✅ **Tickets Created:** 5 tickets linked to `demo@maguey.com`  
✅ **Order Created:** Order linked to user ID `ea00ba79-3e8c-439c-af5a-1e109656dd46`  
✅ **Email Match:** All tickets use exact email `demo@maguey.com` to satisfy security policies

---

## Troubleshooting

### If tickets don't appear:
1. **Hard refresh browser:** Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Log out and log back in** using Quick Login button
3. **Check browser console** for any errors
4. **Verify account:** Make sure you're logged in as `demo@maguey.com`

### If Quick Login fails:
1. The account exists and email is confirmed
2. Try manual login with credentials above
3. If still fails, account may need to be recreated

---

## For Future Testing

**Always use these credentials for testing:**
- **Email:** `demo@maguey.com`
- **Password:** `demo1234`

All test tickets and orders should be created for this account so you can easily view them via the Quick Login button.

