# Maguey Nightclub Support Runbook

> **For:** Venue owners and operators
> **Purpose:** Quickly resolve common issues during events
> **Format:** Find your symptom, follow the steps
> **Last updated:** 2026-01-31

---

## Quick Reference

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Customer didn't receive email | Email in queue | Check Email Status in Dashboard |
| Payment shows "failed" | Card declined | Customer should try different card |
| Scanner shows "offline" | Network issue | Check WiFi, wait for auto-sync |
| Ticket shows "already used" | Duplicate scan | Verify with ticket holder |
| VIP table not showing reserved | Sync delay | Refresh dashboard, wait 30 seconds |

---

## Payment Issues

### P-01: Customer says payment failed but was charged

**Symptom:** Customer shows bank charge, but no ticket received

**Diagnosis:**
1. Open Owner Dashboard
2. Go to Orders section
3. Search by customer email
4. Check order status

**Resolution by status:**
- **Status: paid** - Ticket was created. Check spam folder. Use Email Status to resend.
- **Status: pending** - Payment still processing. Wait 5 minutes, then check again.
- **Status: failed** - Payment was refunded automatically. Customer should try again.

**If ticket missing but order is paid:**
1. Note the Order ID
2. Contact support with Order ID
3. Support can manually create ticket

**Escalation:** If issue persists after 15 minutes, contact tech support.

---

### P-02: Customer card declined at checkout

**Symptom:** Error message on checkout page

**Diagnosis:** This is normal - card was rejected by bank.

**Resolution:**
1. Ask customer to try a different card
2. Check for typos in card number
3. Ensure card is not expired
4. For international cards, ask customer to call bank

**Common decline reasons:**
- Insufficient funds
- Card expired
- Security block (international transaction)
- Daily limit exceeded

**No action needed by venue** - customer handles with their bank.

---

### P-03: Payment succeeded but ticket not created

**Symptom:** Customer has confirmation from Stripe but no ticket

**Diagnosis:**
1. This is rare - our system retries 5 times automatically
2. Check Payment Failures in Dashboard
3. Look for entry with customer email

**Resolution:**
1. If in Payment Failures: Note the error message
2. Contact tech support with:
   - Customer email
   - Stripe payment ID (from Stripe dashboard)
   - Event name

**Escalation:** Always escalate - requires manual ticket creation.

---

### P-04: VIP reservation not confirmed after payment

**Symptom:** Payment charged but reservation shows "pending"

**Diagnosis:**
1. Check VIP Reservations in Dashboard
2. Find reservation by customer email
3. Check status column

**Resolution by status:**
- **pending** - Payment may still be processing. Wait 5 minutes.
- **confirmed** - Reservation is good. Customer may have old cache - ask them to refresh.
- **Not found** - Check customer has correct email. May need manual lookup.

**If payment succeeded but reservation stuck in pending:**
1. Note reservation ID
2. Note payment ID from email
3. Contact tech support for manual confirmation

---

## Email Issues

### E-01: Customer didn't receive confirmation email

**Symptom:** Customer completed purchase but no email in inbox

**Diagnosis:**
1. Open Owner Dashboard
2. Go to Email Status section
3. Search by customer email
4. Check email status

**Resolution by status:**
- **delivered** - Email was sent successfully. Check spam/junk folder.
- **sent** - Email sent, waiting for delivery confirmation. Wait 5 minutes.
- **pending** - Email queued for sending. Will send within 1 minute.
- **failed** - Email failed to send. Click Retry button.

**Common email issues:**
- Typo in email address (can't retry - need new order)
- Corporate email blocking (ask for personal email)
- Full inbox (customer needs to clear space)

**Manual resend:**
1. Find the email entry in Email Status
2. Click "Retry" button
3. Email will be re-queued and sent within 1 minute

---

### E-02: Email shows "failed" status

**Symptom:** Email Status shows red "failed" badge

**Diagnosis:**
1. Check the error message shown
2. Common errors:
   - "Invalid recipient" - email address doesn't exist
   - "Mailbox full" - customer inbox is full
   - "Blocked by recipient" - spam filter

**Resolution:**
1. For invalid recipient: Contact customer for correct email, create new order
2. For mailbox full: Ask customer to clear inbox, then retry
3. For blocked: Ask customer to whitelist @magueynightclub.com, then retry

**To retry:**
1. Click "Retry" button next to failed email
2. Monitor status - should change to "pending" then "sent"

**If retry fails multiple times:**
1. Note the email ID and error
2. Contact tech support

---

### E-03: VIP email missing QR codes

**Symptom:** VIP confirmation received but QR codes not visible

**Diagnosis:** This can happen if email client blocks images

**Resolution:**
1. Ask customer to "Load images" in their email client
2. Or: Direct customer to their VIP pass page at:
   `tickets.magueynightclub.com/vip-pass/[TOKEN]`
3. Token is in the email (View Pass Online link)

**Alternative:** Customer can show email confirmation at door, staff can look up reservation by name.

---

### E-04: Wrong email address used

**Symptom:** Customer entered wrong email at checkout

**Diagnosis:** Tickets are tied to email - can't change after purchase

**Resolution:**
1. For GA tickets: Customer can show ID matching name on order
2. For VIP: Look up reservation by name in Dashboard
3. Manual verification at door is acceptable

**Prevention:** Checkout page shows "double-check your email" warning

---

## Scanner Issues

### S-01: Scanner shows "Offline" banner

**Symptom:** Red banner at top of scanner app, scans being queued

**Diagnosis:** Scanner lost network connection

**Resolution:**
1. Check WiFi connection on device
2. Move closer to WiFi router
3. If using mobile data, check signal strength

**While offline:**
- Scanner continues to work!
- Scans are saved locally
- Will sync automatically when back online

**After reconnecting:**
1. Banner should disappear
2. Queued scans sync automatically
3. Check sync status in scanner settings

---

### S-02: Ticket shows "Already Used"

**Symptom:** Red rejection screen with "Already Used" message

**Diagnosis:** This ticket was scanned before

**Resolution:**
1. Ask guest when they entered previously
2. Check scan history in scanner (shows recent scans)
3. For VIP: Re-entry IS allowed - scanner should show "Re-entry Granted"

**If guest claims first entry:**
1. Check if another scanner scanned this ticket
2. Ticket may have been shared (screenshot)
3. Venue policy: First scan wins

**VIP re-entry:**
- VIP tickets allow multiple scans
- Should show gold "Re-Entry" banner, not red rejection

---

### S-03: "Invalid Ticket" rejection

**Symptom:** Red screen saying ticket is invalid

**Common causes:**
1. **Screenshot of QR code** - QR was captured, not original
2. **Wrong event** - Ticket is for different event
3. **Cancelled ticket** - Refunded or voided

**Resolution:**
1. Ask to see purchase confirmation email
2. Verify event name matches tonight's event
3. Look up ticket by email in Dashboard

**If legitimate ticket showing invalid:**
1. Note the ticket ID shown on rejection screen
2. Manual entry: Use ticket ID instead of QR
3. If still invalid, contact tech support

---

### S-04: Scanner app not loading

**Symptom:** White screen or loading forever

**Diagnosis:** App crashed or cache issue

**Resolution:**
1. Force close app and reopen
2. If on browser: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Clear browser cache for scanner URL
4. Try different browser/device

**Last resort:**
1. Use backup scanner device
2. Manual check-in: Mark names on printed list
3. Reconcile with system after event

---

### S-05: Manual entry not finding ticket

**Symptom:** Typing ticket ID returns "Not Found"

**Diagnosis:**
1. Ticket ID format: MGY-XXXXXXXX-XXXX
2. VIP pass format: VIP-PASS-XXXXXXXX

**Resolution:**
1. Verify exact characters (O vs 0, l vs 1)
2. Try scanning QR instead
3. Search by customer email in Dashboard

---

## Appendix

### A: Dashboard Navigation

**Owner Dashboard:** [scanner-url]/dashboard

| Section | What It Shows | When To Use |
|---------|---------------|-------------|
| Overview | Tonight's stats | Quick check |
| Orders | All purchases | Find customer orders |
| Email Status | Email delivery | Resend emails |
| VIP Reservations | Table bookings | Check VIP status |
| Scanner Status | Device status | Troubleshoot scanners |
| Payment Failures | Failed transactions | Manual resolution |

---

### B: Escalation Contacts

**Tech Support**
- Email: support@magueynightclub.com
- Response time: 15 minutes during events

**Include in all support requests:**
1. Customer email
2. Event name and date
3. Order ID or Ticket ID (if available)
4. Screenshot of error
5. Steps you already tried

---

### C: Common Error Messages Decoded

| Error Message | Plain English | Action |
|---------------|---------------|--------|
| "Network error" | No internet | Check WiFi |
| "Invalid signature" | Fake/modified QR | Reject entry |
| "Ticket not found" | Not in our system | Verify with Dashboard |
| "Already checked in" | Used before | Ask about re-entry |
| "Payment declined" | Bank rejected | Try different card |
| "Email delivery failed" | Bad email address | Get correct email |

---

### D: Emergency Procedures

**Complete system down:**
1. Use printed backup ticket list
2. Manual check-in with name verification
3. ID must match name on ticket
4. Mark checked-in on paper list
5. Reconcile after system restored

**Scanner devices all offline:**
1. One staff member uses phone as hotspot
2. Connect one scanner to hotspot
3. Process guests through single scanner
4. Others can queue normally

---

*Last updated: 2026-01-31*
*Version: 1.0*
