# Demo Account Setup Guide

## Demo Account Credentials

For testing the ticket purchase flow, use these demo account credentials:

**Email:** `demo@maguey.com`  
**Password:** `demo1234`

## Setting Up the Demo Account

### Option 1: Create Account via Signup Page

1. Navigate to `/signup` in your application
2. Enter the demo credentials:
   - Email: `demo@maguey.com`
   - Password: `demo1234`
   - Confirm Password: `demo1234`
3. Complete the signup process
4. You'll be automatically logged in

### Option 2: Create Account in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Users**
3. Click **Add User** → **Create New User**
4. Enter:
   - Email: `demo@maguey.com`
   - Password: `demo1234`
   - Auto Confirm User: ✅ (checked)
5. Click **Create User**

### Option 3: Use SQL (Supabase SQL Editor)

```sql
-- Create demo user account
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'demo@maguey.com',
  crypt('demo1234', gen_salt('bf')), -- Password: demo1234
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"first_name": "Demo", "last_name": "User"}',
  FALSE,
  '',
  ''
);
```

## Testing the Complete Flow

### Step 1: Login with Demo Account

1. Navigate to `/login`
2. Enter:
   - Email: `demo@maguey.com`
   - Password: `demo1234`
3. Click **Sign In**

### Step 2: Browse Events

1. You'll be redirected to the events page (`/events`)
2. Browse available events
3. Click on an event to view details

### Step 3: Purchase Tickets

1. On the event detail page, click **BUY TICKETS** for a ticket type
2. You'll be redirected to `/checkout`
3. Select ticket quantities
4. Enter your information (pre-filled from demo account)
5. Click **Checkout**

### Step 4: Complete Payment (Demo Mode)

1. You'll be redirected to `/payment`
2. Fill in payment form (card details are simulated)
3. Click **Complete Purchase**
4. Order is created immediately (no actual Stripe charge)
5. Tickets are generated and stored in database

### Step 5: View Your Tickets

1. After successful purchase, you'll see a success page
2. Click **View My Tickets** or navigate to `/account`
3. You'll see your purchased tickets under "Upcoming Events"
4. Click **View Ticket** on any ticket

### Step 6: Access Digital Ticket with QR Code

1. On the ticket detail page (`/ticket/{ticket_id}`)
2. You'll see:
   - Event image
   - Event details (name, date, time, venue)
   - QR code (scannable by your scanner website)
   - Ticket holder information
   - Ticket ID

## Demo Mode Features

### Payment Processing
- ✅ Orders are created directly in database
- ✅ No actual Stripe charges
- ✅ Payment form is for demonstration only
- ✅ All orders marked as "paid" status

### Email Service
- ✅ Email sending is bypassed (not configured)
- ✅ Tickets are still generated and stored
- ✅ You can view tickets immediately in your account

### Ticket Generation
- ✅ QR codes are generated for each ticket
- ✅ Tickets are linked to events with event images
- ✅ Tickets are compatible with scanner website
- ✅ All ticket data stored in Supabase database

## Scanner Integration

Tickets purchased with the demo account are immediately available in your scanner website:

1. Purchase tickets using demo account
2. Go to your scanner website
3. Scan the QR code from the ticket page
4. Scanner will display:
   - Event image
   - Event details
   - Ticket validation status
   - Customer information

## Troubleshooting

### "User not found" or Login fails
- Verify the demo account exists in Supabase Auth
- Check email is exactly `demo@maguey.com`
- Ensure password is `demo1234`
- Try creating the account again via signup page

### No tickets showing in Account page
- Make sure you've completed a purchase
- Check that you're logged in with demo account
- Verify tickets exist in `tickets` table in Supabase
- Check browser console for errors

### QR code not displaying
- QR code is generated from `ticket_id`
- If `qr_code_url` is null, QR is generated via external API
- Check network tab for QR code image loading
- Verify `ticket_id` exists in database

## Next Steps

After testing with demo account:

1. ✅ Verify tickets appear in Account page
2. ✅ Verify tickets display QR codes
3. ✅ Test scanner website integration
4. ✅ Verify event images display correctly
5. ✅ Test multiple ticket purchases

## Production Setup

When ready for production:

1. Set up Stripe account and configure `VITE_STRIPE_PUBLISHABLE_KEY`
2. Configure email service (`VITE_EMAIL_API_KEY`, `VITE_EMAIL_FROM_ADDRESS`)
3. Remove demo account or change password
4. Update payment flow to use Stripe Checkout Session
5. Enable email sending for ticket delivery

