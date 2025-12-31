# Stripe Checkout Integration Setup

## Overview

The checkout system is now integrated with Stripe. Here's what you need to set up:

## Frontend Setup (✅ Complete)

The frontend is ready to use Stripe. It will:
1. Collect customer information
2. Create a checkout session via your backend API
3. Redirect to Stripe Checkout
4. Handle success/cancel redirects

## Backend API Required

You need to create a backend endpoint that creates Stripe checkout sessions.

### Endpoint: `POST /api/create-checkout-session`

**Request Body:**
```json
{
  "eventId": "1",
  "tickets": [
    {
      "ticketType": "general_admission",
      "quantity": 2,
      "price": 30,
      "name": "General Admission"
    }
  ],
  "customer": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "total": 133.00,
  "tableId": "optional-table-id"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Example Backend Implementation (Node.js/Express)

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { eventId, tickets, customer, total, tableId } = req.body;

    // Create order in database (optional, depends on your setup)
    const order = await createOrder({
      eventId,
      customer,
      total,
      status: 'pending',
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: tickets.map(ticket => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${ticket.name} - ${ticket.quantity}x`,
            description: `Ticket for event ${eventId}`,
          },
          unit_amount: Math.round(ticket.price * 100), // Convert to cents
        },
        quantity: ticket.quantity,
      })),
      mode: 'payment',
      customer_email: customer.email,
      success_url: `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/checkout?event=${eventId}`,
      metadata: {
        orderId: order.id,
        eventId: eventId,
        customerName: `${customer.firstName} ${customer.lastName}`,
      },
    });

    // Store session ID with order
    await updateOrder(order.id, {
      stripeSessionId: session.id,
    });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Example Backend Implementation (Supabase Edge Function)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
    });
  }

  try {
    const { eventId, tickets, customer, total } = await req.json();

    // Create order in Supabase
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        event_id: eventId,
        customer_first_name: customer.firstName,
        customer_last_name: customer.lastName,
        customer_email: customer.email,
        customer_phone: customer.phone || null,
        total: total,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: tickets.map(ticket => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${ticket.name} - ${ticket.quantity}x`,
            description: `Ticket for event ${eventId}`,
          },
          unit_amount: Math.round(ticket.price * 100),
        },
        quantity: ticket.quantity,
      })),
      mode: 'payment',
      customer_email: customer.email,
      success_url: `${Deno.env.get('FRONTEND_URL')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('FRONTEND_URL')}/checkout?event=${eventId}`,
      metadata: {
        orderId: order.id,
        eventId: eventId,
      },
    });

    // Update order with session ID
    await supabase
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
```

## Environment Variables

Create a `.env` file in your project root:

```env
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here

# Backend API URL
VITE_API_URL=http://localhost:3000/api
# Or for production:
# VITE_API_URL=https://your-api-domain.com/api

# Environment
VITE_ENV=development
```

## Stripe Webhook Setup

After payment, Stripe will send a webhook to create tickets. Set up a webhook endpoint:

**Webhook Endpoint:** `POST /api/stripe-webhook`

**Events to listen for:**
- `checkout.session.completed` - Payment successful, create tickets

**Example Webhook Handler:**

```javascript
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata.orderId;

    // Create tickets for this order
    await createTicketsForOrder(orderId);
    
    // Send email with tickets
    await sendTicketEmail(orderId);
  }

  res.json({ received: true });
});
```

## Testing

1. **Test Mode**: Use Stripe test keys (starts with `pk_test_`)
2. **Test Card**: Use `4242 4242 4242 4242` with any future expiry date and any CVC
3. **Test Flow**: 
   - Fill out checkout form
   - Click "Proceed to Payment"
   - Use test card in Stripe Checkout
   - Verify redirect to success page

## Next Steps

1. ✅ Frontend is ready
2. ⏳ Create backend API endpoint for checkout session
3. ⏳ Set up Stripe webhook handler
4. ⏳ Test the full flow
5. ⏳ Deploy to production

## Resources

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)

