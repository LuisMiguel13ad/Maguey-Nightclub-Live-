# Critical Implementation Guide

This guide provides detailed implementation steps for the **critical missing features** that block production deployment.

---

## 1. Stripe Payment Integration

### 1.1 Create Checkout Session API Endpoint

**File:** `maguey-pass-lounge/supabase/functions/create-checkout-session/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      eventId,
      ticketTypes,
      customerEmail,
      customerName,
      customerPhone,
    } = await req.json();

    // Validate availability
    const { data: availability, error: availError } = await supabase
      .rpc('check_event_availability', { event_id: eventId });

    if (availError) {
      throw new Error(`Availability check failed: ${availError.message}`);
    }

    // Verify tickets are available
    for (const ticketType of ticketTypes) {
      const available = availability.find(
        (a: any) => a.ticket_type === ticketType.type && a.available >= ticketType.quantity
      );
      if (!available) {
        throw new Error(`Not enough ${ticketType.type} tickets available`);
      }
    }

    // Calculate total
    const total = ticketTypes.reduce((sum: number, tt: any) => 
      sum + (tt.price + tt.fee) * tt.quantity, 0
    );

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: ticketTypes.map((tt: any) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${tt.name} - ${tt.quantity}x`,
            description: `Event tickets`,
          },
          unit_amount: Math.round((tt.price + tt.fee) * 100), // Convert to cents
        },
        quantity: tt.quantity,
      })),
      mode: 'payment',
      success_url: `${Deno.env.get('VITE_FRONTEND_URL')}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('VITE_FRONTEND_URL')}/checkout?canceled=true`,
      customer_email: customerEmail,
      metadata: {
        eventId,
        customerName,
        customerPhone: customerPhone || '',
        ticketTypes: JSON.stringify(ticketTypes),
      },
    });

    return new Response(
      JSON.stringify({ sessionId: session.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
```

### 1.2 Update Checkout Component

**File:** `maguey-pass-lounge/src/pages/Checkout.tsx`

Add payment handler:

```typescript
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const handlePayment = async (formData: CheckoutFormData) => {
  setIsLoading(true);
  setError(null);

  try {
    // Create checkout session
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          eventId: event?.id,
          ticketTypes: Object.values(selectedTickets),
          customerEmail: formData.email,
          customerName: `${formData.firstName} ${formData.lastName}`,
          customerPhone: formData.phone,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create checkout session');
    }

    const { sessionId } = await response.json();

    // Redirect to Stripe Checkout
    const stripe = await stripePromise;
    if (!stripe) {
      throw new Error('Stripe failed to load');
    }

    const { error: stripeError } = await stripe.redirectToCheckout({
      sessionId,
    });

    if (stripeError) {
      throw stripeError;
    }
  } catch (err: any) {
    setError(err.message || 'Payment failed. Please try again.');
    setIsLoading(false);
  }
};
```

### 1.3 Create Checkout Success Page

**File:** `maguey-pass-lounge/src/pages/CheckoutSuccess.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      // Fetch order by session ID
      supabase
        .from('orders')
        .select('*, tickets(*)')
        .eq('stripe_checkout_session_id', sessionId)
        .single()
        .then(({ data, error }) => {
          if (data) {
            setOrder(data);
          }
          setLoading(false);
        });
    }
  }, [sessionId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!order) {
    return (
      <div>
        <h1>Order Not Found</h1>
        <Link to="/">Return Home</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Payment Successful!</h1>
      <p>Your order #{order.id} has been confirmed.</p>
      <p>Tickets have been sent to {order.customer_email}</p>
      <Link to="/tickets">View Your Tickets</Link>
    </div>
  );
};
```

### 1.4 Update Stripe Webhook Handler

**File:** `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts`

Ensure webhook handler:
1. Verifies Stripe signature
2. Creates order in database
3. Generates tickets
4. Sends email (see email section)

---

## 2. Email Service Implementation

### 2.1 Choose Email Provider

**Recommended: Resend**

- Simple API
- Good deliverability
- Generous free tier
- Easy domain verification

### 2.2 Create Email Service

**File:** `maguey-pass-lounge/src/lib/email-service.ts`

```typescript
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.VITE_EMAIL_API_KEY);

export interface Ticket {
  id: string;
  ticket_id: string;
  ticket_type: string;
  ticket_type_name: string;
  qr_code?: string;
  event_name: string;
  event_date: string;
  venue_name: string;
}

export interface Order {
  id: string;
  customer_email: string;
  customer_name: string;
  total: number;
  created_at: string;
}

export async function sendTicketEmail(
  tickets: Ticket[],
  order: Order
): Promise<void> {
  const fromEmail = import.meta.env.VITE_EMAIL_FROM_ADDRESS || 'noreply@yourclub.com';
  
  const html = generateTicketEmailHTML(tickets, order);

  await resend.emails.send({
    from: fromEmail,
    to: order.customer_email,
    subject: `Your Maguey Tickets - Order #${order.id.slice(0, 8)}`,
    html,
  });
}

function generateTicketEmailHTML(tickets: Ticket[], order: Order): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .ticket { border: 2px solid #000; padding: 20px; margin: 20px 0; }
        .qr-code { text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>Your Maguey Tickets</h1>
      <p>Thank you for your purchase, ${order.customer_name}!</p>
      <p>Order #${order.id.slice(0, 8)}</p>
      <p>Total: $${order.total.toFixed(2)}</p>
      
      ${tickets.map(ticket => `
        <div class="ticket">
          <h2>${ticket.ticket_type_name}</h2>
          <p><strong>Event:</strong> ${ticket.event_name}</p>
          <p><strong>Date:</strong> ${new Date(ticket.event_date).toLocaleDateString()}</p>
          <p><strong>Venue:</strong> ${ticket.venue_name}</p>
          <p><strong>Ticket ID:</strong> ${ticket.ticket_id}</p>
          ${ticket.qr_code ? `
            <div class="qr-code">
              <img src="${ticket.qr_code}" alt="QR Code" />
            </div>
          ` : ''}
        </div>
      `).join('')}
      
      <p>See you at the event!</p>
      <p>The Maguey Team</p>
    </body>
    </html>
  `;
}

export async function sendOrderConfirmationEmail(order: Order): Promise<void> {
  const fromEmail = import.meta.env.VITE_EMAIL_FROM_ADDRESS || 'noreply@yourclub.com';
  
  await resend.emails.send({
    from: fromEmail,
    to: order.customer_email,
    subject: `Order Confirmation - Maguey`,
    html: `
      <h1>Order Confirmed</h1>
      <p>Thank you for your order, ${order.customer_name}!</p>
      <p>Order #${order.id.slice(0, 8)}</p>
      <p>Total: $${order.total.toFixed(2)}</p>
      <p>Your tickets will be sent shortly.</p>
    `,
  });
}
```

### 2.3 Integrate Email in Webhook Handler

**File:** `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts`

Add email sending after ticket creation:

```typescript
// After creating tickets
import { sendTicketEmail } from '../lib/email-service.ts';

// ... create tickets ...

// Send email
try {
  await sendTicketEmail(tickets, {
    id: order.id,
    customer_email: order.customer_email,
    customer_name: order.customer_name,
    total: order.total_amount,
    created_at: order.created_at,
  });
} catch (emailError) {
  console.error('Failed to send ticket email:', emailError);
  // Don't fail the webhook if email fails
}
```

### 2.4 Alternative: SendGrid Implementation

If using SendGrid instead:

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.VITE_EMAIL_API_KEY);

export async function sendTicketEmail(tickets: Ticket[], order: Order): Promise<void> {
  const msg = {
    to: order.customer_email,
    from: import.meta.env.VITE_EMAIL_FROM_ADDRESS,
    subject: `Your Maguey Tickets - Order #${order.id.slice(0, 8)}`,
    html: generateTicketEmailHTML(tickets, order),
  };

  await sgMail.send(msg);
}
```

---

## 3. Environment Variable Validation

### 3.1 Create Validation Script

**File:** `maguey-pass-lounge/src/lib/env-validation.ts`

```typescript
export function validateEnv(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'VITE_API_URL',
    'VITE_EMAIL_API_KEY',
    'VITE_EMAIL_FROM_ADDRESS',
    'VITE_FRONTEND_URL',
  ];

  required.forEach(key => {
    if (!import.meta.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Call in main.tsx
if (import.meta.env.PROD) {
  const { valid, errors } = validateEnv();
  if (!valid) {
    console.error('Environment validation failed:', errors);
    // Show error to user or prevent app from loading
  }
}
```

---

## 4. Testing Checklist

After implementing:

- [ ] Stripe checkout session creates successfully
- [ ] Payment processes correctly
- [ ] Webhook receives payment confirmation
- [ ] Tickets created in database
- [ ] Email sent with tickets
- [ ] QR codes generated correctly
- [ ] Checkout success page displays order
- [ ] Error handling works for failed payments
- [ ] Error handling works for failed emails

---

## 5. Deployment Steps

1. Deploy edge function:
   ```bash
   supabase functions deploy create-checkout-session
   ```

2. Set environment variables in Vercel/Supabase

3. Test in production:
   - Use Stripe test mode first
   - Verify webhook receives events
   - Test email delivery
   - Switch to live mode after verification

4. Monitor:
   - Check Stripe webhook logs
   - Check email provider logs
   - Monitor error tracking (Sentry)

---

## Next Steps

After implementing payments and email:

1. Set up monitoring (Sentry)
2. Add comprehensive testing
3. Configure CI/CD
4. Security hardening
5. Performance optimization

See `DEPLOYMENT_READINESS_REPORT.md` for full checklist.
