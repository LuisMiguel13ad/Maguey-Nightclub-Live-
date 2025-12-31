# Quick Start: Ticket System Integration

## What You Need to Build

### ✅ Already Done (Your Scanner)
- Database schema for tickets
- QR code scanning
- Ticket validation
- Event filtering
- Duplicate prevention
- Scan logging

### 🚧 Need to Build (Ticket Purchase System)

1. **Stripe Integration**
   - Payment processing
   - Checkout session creation
   - Webhook handling

2. **Ticket Generation**
   - Unique ticket ID generation
   - QR code creation
   - Database insertion

3. **Email Service**
   - Ticket delivery via email
   - QR code images in emails

4. **Event Management**
   - Capacity tracking
   - Real-time availability

## Step-by-Step Implementation

### Phase 1: Database Setup (30 minutes)

1. Run the migration:
```bash
supabase migration up
```

2. Verify tables created:
```sql
SELECT * FROM events;
SELECT * FROM orders;
SELECT * FROM payments;
```

### Phase 2: Stripe Setup (1 hour)

1. **Create Stripe Account**
   - Go to https://stripe.com
   - Get API keys from Dashboard

2. **Install Stripe SDK**
   ```bash
   # For your ticket purchase website
   npm install stripe @stripe/stripe-js
   ```

3. **Set Environment Variables**
   ```env
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Phase 3: Build Ticket Purchase Page (2-3 hours)

**Key Components Needed:**

1. **Event Selection Page**
   - List available events
   - Show capacity/availability
   - Link to purchase

2. **Ticket Purchase Form**
   - Select ticket type (VIP/General)
   - Select quantity
   - Enter customer info (name, email, phone)
   - Call Stripe Checkout

3. **Success Page**
   - Display tickets
   - Show QR codes
   - Email confirmation

**Example Purchase Flow:**
```typescript
// 1. User selects event and quantity
const handlePurchase = async () => {
  // 2. Create checkout session
  const response = await fetch('/api/create-checkout', {
    method: 'POST',
    body: JSON.stringify({
      eventName: 'Perreo Fridays',
      ticketType: 'VIP',
      quantity: 2,
      customerEmail: 'customer@example.com',
    }),
  })
  
  const { url } = await response.json()
  
  // 3. Redirect to Stripe Checkout
  window.location.href = url
}
```

### Phase 4: Webhook Handler (1-2 hours)

1. **Create Supabase Edge Function**
   - Use example from `INTEGRATION_EXAMPLES.md`
   - Deploy to Supabase

2. **Configure Webhook in Stripe**
   - Point to your Supabase function URL
   - Select events: `payment_intent.succeeded`

3. **Test Webhook**
   ```bash
   stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
   stripe trigger payment_intent.succeeded
   ```

### Phase 5: QR Code Generation (1 hour)

**Install QR Code Library:**
```bash
npm install qrcode
npm install @types/qrcode --save-dev
```

**Generate QR Codes:**
```typescript
import QRCode from 'qrcode'

// Generate QR code image
const qrCodeImage = await QRCode.toDataURL(ticketId)

// Store in database or send in email
```

### Phase 6: Email Service (1-2 hours)

**Option 1: Resend (Recommended)**
```bash
npm install resend
```

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'tickets@maguey.club',
  to: customerEmail,
  subject: 'Your Maguey Club Tickets',
  html: generateTicketEmailHTML(tickets),
  attachments: qrCodeImages, // Attach QR codes
})
```

**Option 2: SendGrid / Postmark**
- Similar implementation
- Follow their documentation

### Phase 7: Real-time Availability (30 minutes)

**Add to Ticket Purchase Page:**
```typescript
import { useEventAvailability } from '@/hooks/useEventAvailability'

function TicketPurchase({ eventName }) {
  const { availability } = useEventAvailability(eventName)
  
  return (
    <div>
      <p>{availability.tickets_available} tickets remaining</p>
      {/* Purchase form */}
    </div>
  )
}
```

## Testing Checklist

### ✅ Purchase Flow
- [ ] Customer can select event
- [ ] Availability updates in real-time
- [ ] Stripe checkout works
- [ ] Payment succeeds
- [ ] Webhook receives payment event
- [ ] Tickets created in database
- [ ] Email sent with tickets
- [ ] QR codes visible in email

### ✅ Scanner Integration
- [ ] Tickets appear in scanner database
- [ ] QR codes scan correctly
- [ ] Validation works
- [ ] Duplicate prevention works
- [ ] Event filtering works

### ✅ Edge Cases
- [ ] Sold out events show correctly
- [ ] Failed payments don't create tickets
- [ ] Refunds handled correctly
- [ ] Invalid QR codes rejected

## Current System Status

### ✅ Scanner System (Complete)
Your scanner already:
- ✅ Reads QR codes containing `ticket_id`
- ✅ Validates against `tickets` table
- ✅ Filters by selected event
- ✅ Prevents duplicate scans
- ✅ Logs all scans
- ✅ Works offline (local storage mode)

### 🔄 What Scanner Will Automatically Work With

Once tickets are in the database:
1. **Tickets created by purchase system** → Immediately visible in scanner
2. **QR codes** → Scanner reads `ticket_id` from QR code
3. **Event filtering** → Already implemented
4. **Real-time updates** → Supabase real-time subscriptions (optional enhancement)

## Recommended Architecture

```
┌─────────────────────────────────────────┐
│      Ticket Purchase Website            │
│  (Separate project/domain)              │
│                                          │
│  • React/Next.js                         │
│  • Stripe Checkout                       │
│  • QR Code Generation                    │
│  • Email Service                         │
└──────────────┬──────────────────────────┘
               │
               │ HTTP Requests
               │ (Supabase Client)
               ▼
┌─────────────────────────────────────────┐
│         Supabase Database               │
│                                          │
│  • events                                │
│  • orders                                │
│  • payments                              │
│  • tickets  ←── Scanner reads here      │
│  • scan_logs                             │
└──────────────┬──────────────────────────┘
               │
               │ Supabase Client
               │ (Same database)
               ▼
┌─────────────────────────────────────────┐
│      Ticket Scanner (Current)           │
│  (This project)                         │
│                                          │
│  • QR Code Scanner                       │
│  • Ticket Validation                    │
│  • Event Filtering                      │
│  • Scan Logging                         │
└─────────────────────────────────────────┘
```

## Key Integration Points

### 1. Shared Database
- Both systems use the same Supabase database
- Scanner reads from `tickets` table
- Purchase system writes to `tickets` table
- Real-time sync (automatic with Supabase)

### 2. QR Code Format
- **Standard:** QR code contains `ticket_id` (e.g., "MGY-PF-20250115-ABC123")
- Scanner reads QR → Extracts `ticket_id` → Validates in database
- No changes needed to scanner!

### 3. Ticket ID Generation
- Must be unique
- Format: `MGY-{EVENT_CODE}-{DATE}-{RANDOM}`
- Stored in `tickets.ticket_id` column
- Also stored in `tickets.qr_code_data` (same value)

### 4. Event Matching
- Purchase system uses `event_name` from `events` table
- Scanner filters by `event_name` in `tickets` table
- Both use same event names (e.g., "Perreo Fridays")

## Next Steps

1. **Run Database Migration** (15 min)
   ```bash
   supabase migration up
   ```

2. **Set Up Stripe Account** (30 min)
   - Get API keys
   - Configure webhooks

3. **Build Ticket Purchase Page** (4-6 hours)
   - Event selection
   - Stripe checkout
   - Success page

4. **Create Webhook Handler** (2 hours)
   - Deploy Supabase Edge Function
   - Test with Stripe CLI

5. **Implement Email Service** (2 hours)
   - Set up Resend/SendGrid
   - Create email templates
   - Send tickets

6. **Test End-to-End** (1 hour)
   - Full purchase flow
   - Verify tickets in scanner

## Estimated Total Time

- **Database Setup:** 30 minutes
- **Stripe Integration:** 2 hours
- **Ticket Purchase Website:** 4-6 hours
- **Webhook Handler:** 2 hours
- **Email Service:** 2 hours
- **Testing:** 1-2 hours

**Total: 12-15 hours** of development time

## Support & Resources

- **Stripe Docs:** https://stripe.com/docs
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **QR Code Library:** https://www.npmjs.com/package/qrcode
- **Resend (Email):** https://resend.com/docs

## Questions?

The scanner system is **already complete** and ready to work with tickets from your purchase system. Just make sure:
1. Tickets are inserted into the `tickets` table
2. `ticket_id` matches the QR code content
3. `event_name` matches your event names
4. All required fields are populated

Once tickets are in the database, your scanner will automatically work!

