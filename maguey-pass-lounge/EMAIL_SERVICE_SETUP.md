# Email Service Setup for Ticket Delivery

## Overview

After a successful payment, the system needs to:
1. Generate unique ticket IDs (no duplicates)
2. Create QR codes for each ticket
3. Generate digital ticket emails
4. Send emails to customers

> **Environment:** Set `VITE_QR_SIGNING_SECRET` in your frontend `.env` file. This secret is used to sign QR payloads so the scanner can verify authenticity.

## Backend Implementation

This needs to be implemented in your **backend webhook handler** (called after Stripe payment). Here's how to set it up:

### Step 1: Install Dependencies

**For Node.js/Express:**
```bash
npm install nodemailer @types/nodemailer
# OR use a service like SendGrid, Resend, etc.
npm install @sendgrid/mail
# OR
npm install resend
```

**For Supabase Edge Functions:**
```typescript
// Use Deno-compatible email service
import { Resend } from 'https://esm.sh/resend@2.0.0';
```

### Step 2: Webhook Handler (After Stripe Payment)

```typescript
// Example: Supabase Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '');
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

serve(async (req) => {
  const sig = req.headers.get('stripe-signature') || '';
  const body = await req.text();
  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
      status: 400,
    });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata.orderId;
    
    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, events(*)')
      .eq('id', orderId)
      .single();
    
    if (orderError) throw orderError;
    
    // Generate tickets
    const tickets = await generateTicketsForOrder(order);
    
    // Send email with tickets
    await sendTicketEmail(order, tickets);
  }

  return new Response(JSON.stringify({ received: true }));
});
```

### Step 3: Generate Tickets Function

```typescript
import {
  mapCheckoutSelectionToLineItems,
  createOrderWithTickets,
} from './orders-service';

async function generateTicketsForOrder(order: any) {
  const lineItems = mapCheckoutSelectionToLineItems(order.selection);

  const result = await createOrderWithTickets({
    eventId: order.event_id,
    purchaserEmail: order.customer_email,
    purchaserName: `${order.customer_first_name} ${order.customer_last_name}`,
    purchaserUserId: order.user_id ?? null,
    lineItems,
    metadata: order.metadata ?? {},
  });

  return result.ticketEmailPayloads;
}
```

`createOrderWithTickets` writes the order and ticket rows (including `qr_token` and `qr_signature`) and returns the ticket payloads you can pass to your email provider.

### Step 4: Send Email Function (Using Resend - Recommended)

```typescript
import { Resend } from 'resend';
import { generateTicketEmailHTML, generateTicketEmailText } from './email-template';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

async function sendTicketEmail(order: any, tickets: TicketData[]) {
  const customerName = `${order.customer_first_name} ${order.customer_last_name}`;
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'Maguey <tickets@yourdomain.com>',
      to: order.customer_email,
      subject: `Your Tickets for ${tickets[0].eventName}`,
      html: generateTicketEmailHTML(tickets, customerName, order.id),
      text: generateTicketEmailText(tickets, customerName, order.id),
    });

    if (error) {
      console.error('Error sending email:', error);
      throw error;
    }

    console.log('Email sent successfully:', data);
  } catch (error) {
    console.error('Failed to send email:', error);
    // Don't throw - log error but don't fail the webhook
    // You might want to queue this for retry
  }
}
```

### Step 5: Alternative Email Services

#### Option A: SendGrid

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

async function sendTicketEmail(order: any, tickets: TicketData[]) {
  const customerName = `${order.customer_first_name} ${order.customer_last_name}`;
  
  const msg = {
    to: order.customer_email,
    from: 'tickets@yourdomain.com',
    subject: `Your Tickets for ${tickets[0].eventName}`,
    html: generateTicketEmailHTML(tickets, customerName, order.id),
    text: generateTicketEmailText(tickets, customerName, order.id),
  };

  try {
    await sgMail.send(msg);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
```

#### Option B: Nodemailer (SMTP)

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function sendTicketEmail(order: any, tickets: TicketData[]) {
  const customerName = `${order.customer_first_name} ${order.customer_last_name}`;
  
  const mailOptions = {
    from: 'Maguey <tickets@yourdomain.com>',
    to: order.customer_email,
    subject: `Your Tickets for ${tickets[0].eventName}`,
    html: generateTicketEmailHTML(tickets, customerName, order.id),
    text: generateTicketEmailText(tickets, customerName, order.id),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
```

## Environment Variables

Add to your backend `.env`:

```env
# Email Service (choose one)
RESEND_API_KEY=re_your_key_here
# OR
SENDGRID_API_KEY=SG.your_key_here
# OR
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Frontend URL (for email links)
FRONTEND_URL=https://your-site.com
```

## Frontend Dashboard Environment

Promoter dashboard actions (resend ticket emails, request refunds) expect the following variables in the frontend `.env` file:

```env
VITE_EMAIL_API_KEY= # Resend API key (consider proxying through your backend in production)
VITE_EMAIL_FROM_ADDRESS=tickets@yourdomain.com
VITE_API_URL=https://your-backend.example.com/api
VITE_FRONTEND_URL=https://your-site.com
```

> ⚠️ **Security note:** embedding email or Stripe secrets in client-side code exposes them to users. For production deployments, route these actions through a secure backend and keep API keys server-side.

## Testing

1. **Test ticket generation:**
   ```typescript
   const ticketIds = generateUniqueTicketIds('2025-11-15', 5);
   console.log(ticketIds); // Should be 5 unique IDs
   ```

2. **Test email template:**
   ```typescript
   const html = generateTicketEmailHTML(tickets, 'John Doe', 'ORDER123');
   console.log(html); // Should generate HTML email
   ```

3. **Test email sending:**
   - Use test email addresses
   - Check spam folder
   - Verify QR codes load correctly

## Unique Ticket ID Guarantee

The ticket ID generation ensures uniqueness by:
1. **Prefix**: `MGY-PF` (identifies system)
2. **Date**: `YYYYMMDD` (event date)
3. **Suffix**: Timestamp + random (6 chars)
   - Uses `Date.now()` for time-based uniqueness
   - Adds random characters for additional uniqueness
   - Checks for duplicates within a batch

For production, you might want to:
- Add database constraint on `ticket_id` (UNIQUE)
- Check database before generating to ensure no duplicates
- Use UUID as fallback if needed

## Next Steps

1. ✅ Frontend utilities are ready (`src/lib/ticket-generator.ts`)
2. ✅ Email templates are ready (`src/lib/email-template.ts`)
3. ⏳ Implement backend webhook handler
4. ⏳ Set up email service
5. ⏳ Test email delivery
6. ⏳ Deploy to production

## Files Created

- `src/lib/ticket-generator.ts` - Ticket ID and QR code generation
- `src/lib/email-template.ts` - Email HTML/text templates
- `EMAIL_SERVICE_SETUP.md` - This documentation

