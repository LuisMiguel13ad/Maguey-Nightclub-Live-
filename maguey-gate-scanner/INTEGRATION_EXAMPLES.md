# Integration Implementation Examples

## 1. Stripe Webhook Handler (Supabase Edge Function)

**File:** `supabase/functions/stripe-webhook/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  const body = await req.text()
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent)
      break
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
      break
    case 'charge.refunded':
      await handleRefund(event.data.object as Stripe.Charge)
      break
    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata
  
  // 1. Create or update order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .upsert({
      stripe_payment_intent_id: paymentIntent.id,
      stripe_customer_id: paymentIntent.customer as string,
      customer_email: paymentIntent.receipt_email || metadata.customer_email,
      customer_name: metadata.customer_name,
      customer_phone: metadata.customer_phone,
      total_amount: paymentIntent.amount / 100, // Convert from cents
      currency: paymentIntent.currency,
      status: 'completed',
      event_name: metadata.event_name,
      ticket_count: parseInt(metadata.quantity || '1'),
      ticket_type: metadata.ticket_type,
      completed_at: new Date().toISOString(),
    }, {
      onConflict: 'stripe_payment_intent_id',
    })
    .select()
    .single()

  if (orderError) {
    console.error('Error creating order:', orderError)
    return
  }

  // 2. Generate tickets
  const tickets = await generateTickets({
    orderId: order.id,
    eventName: metadata.event_name,
    ticketType: metadata.ticket_type,
    quantity: parseInt(metadata.quantity || '1'),
    customerEmail: paymentIntent.receipt_email || metadata.customer_email,
    customerName: metadata.customer_name,
    customerPhone: metadata.customer_phone,
    pricePaid: paymentIntent.amount / 100,
    stripePaymentId: paymentIntent.id,
  })

  // 3. Create payment record
  await supabase.from('payments').insert({
    order_id: order.id,
    stripe_payment_intent_id: paymentIntent.id,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency,
    status: 'succeeded',
  })

  // 4. Send email with tickets
  await sendTicketEmail(tickets, order.customer_email)

  console.log(`Successfully processed payment for ${tickets.length} tickets`)
}

async function generateTickets(params: {
  orderId: string
  eventName: string
  ticketType: string
  quantity: number
  customerEmail: string
  customerName?: string
  customerPhone?: string
  pricePaid: number
  stripePaymentId: string
}) {
  const tickets = []

  for (let i = 0; i < params.quantity; i++) {
    // Generate unique ticket ID
    const ticketId = generateUniqueTicketId(params.eventName)
    
    // QR code data (use ticket_id as QR content)
    const qrCodeData = ticketId

    const ticket = {
      ticket_id: ticketId,
      order_id: params.orderId,
      event_name: params.eventName,
      ticket_type: params.ticketType,
      guest_name: params.customerName,
      guest_email: params.customerEmail,
      guest_phone: params.customerPhone,
      price_paid: params.pricePaid / params.quantity, // Price per ticket
      stripe_payment_id: params.stripePaymentId,
      qr_code_data: qrCodeData,
      is_used: false,
      purchase_date: new Date().toISOString(),
      metadata: {
        generated_at: new Date().toISOString(),
        order_index: i + 1,
      },
    }

    tickets.push(ticket)
  }

  // Insert all tickets
  const { data, error } = await supabase
    .from('tickets')
    .insert(tickets)
    .select()

  if (error) {
    console.error('Error creating tickets:', error)
    throw error
  }

  return data || []
}

function generateUniqueTicketId(eventName: string): string {
  // Event code mapping
  const eventCodes: Record<string, string> = {
    'Perreo Fridays': 'PF',
    'Regional Mexicano': 'RM',
    'Cumbia Nights': 'CN',
  }

  const eventCode = eventCodes[eventName] || 'MGY'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 9).toUpperCase()
  
  // Format: MGY-PF-20250115-ABC123XYZ
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
  return `MGY-${eventCode}-${date}-${random}`
}

async function sendTicketEmail(tickets: any[], customerEmail: string) {
  // TODO: Implement email service (Resend, SendGrid, etc.)
  // For now, log the tickets
  console.log(`Sending ${tickets.length} tickets to ${customerEmail}`)
  
  // Example with Resend:
  // const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
  // await resend.emails.send({
  //   from: 'Maguey Club <tickets@maguey.club>',
  //   to: customerEmail,
  //   subject: 'Your Tickets - Maguey Club',
  //   html: generateTicketEmailHTML(tickets),
  // })
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  await supabase
    .from('orders')
    .update({ status: 'failed' })
    .eq('stripe_payment_intent_id', paymentIntent.id)
}

async function handleRefund(charge: Stripe.Charge) {
  // Update payment status
  await supabase
    .from('payments')
    .update({ 
      status: 'refunded',
      refund_amount: charge.amount_refunded / 100,
    })
    .eq('stripe_payment_intent_id', charge.payment_intent)

  // Update order status
  await supabase
    .from('orders')
    .update({ status: 'refunded' })
    .eq('stripe_payment_intent_id', charge.payment_intent)

  // Mark tickets as refunded (optional - you might want to keep them but mark differently)
  // await supabase
  //   .from('tickets')
  //   .update({ is_used: true, metadata: { refunded: true } })
  //   .eq('stripe_payment_id', charge.payment_intent)
}
```

## 2. Ticket Purchase API (Checkout Creation)

**File:** `supabase/functions/create-checkout/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  try {
    const { eventName, ticketType, quantity, customerEmail, customerName, customerPhone } = await req.json()

    // 1. Check availability
    const { data: availability } = await supabase
      .rpc('get_event_availability', { event_name_param: eventName })

    if (!availability || availability.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const event = availability[0]
    const ticketTypeConfig = event.ticket_types.find((t: any) => t.name === ticketType)
    
    if (!ticketTypeConfig) {
      return new Response(
        JSON.stringify({ error: 'Invalid ticket type' }),
        { status: 400 }
      )
    }

    // Check if enough tickets available
    const { data: soldCount } = await supabase
      .rpc('get_ticket_count_by_type', {
        event_name_param: eventName,
        ticket_type_param: ticketType,
      })

    if ((soldCount || 0) + quantity > ticketTypeConfig.capacity) {
      return new Response(
        JSON.stringify({ error: 'Not enough tickets available' }),
        { status: 400 }
      )
    }

    // 2. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${eventName} - ${ticketType}`,
            description: `Ticket for ${eventName}`,
          },
          unit_amount: Math.round(ticketTypeConfig.price * 100), // Convert to cents
        },
        quantity: quantity,
      }],
      mode: 'payment',
      success_url: `${Deno.env.get('FRONTEND_URL')}/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('FRONTEND_URL')}/tickets/cancel`,
      customer_email: customerEmail,
      metadata: {
        event_name: eventName,
        ticket_type: ticketType,
        quantity: quantity.toString(),
        customer_name: customerName || '',
        customer_phone: customerPhone || '',
      },
    })

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

## 3. QR Code Generation (Client-side)

**For Ticket Purchase Website:**

```typescript
import QRCode from 'qrcode'

// Generate QR code image from ticket ID
async function generateQRCode(ticketId: string): Promise<string> {
  try {
    // Generate QR code as data URL (base64 image)
    const qrCodeDataUrl = await QRCode.toDataURL(ticketId, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
    })
    return qrCodeDataUrl
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw error
  }
}

// Generate QR code SVG
async function generateQRCodeSVG(ticketId: string): Promise<string> {
  return await QRCode.toString(ticketId, {
    type: 'svg',
    width: 300,
  })
}

// Usage in React component
function TicketDisplay({ ticketId }: { ticketId: string }) {
  const [qrCode, setQrCode] = useState<string>('')

  useEffect(() => {
    generateQRCode(ticketId).then(setQrCode)
  }, [ticketId])

  return (
    <div className="ticket">
      <h3>Ticket ID: {ticketId}</h3>
      {qrCode && <img src={qrCode} alt="QR Code" />}
    </div>
  )
}
```

## 4. Real-time Availability Check (React Hook)

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function useEventAvailability(eventName: string) {
  const [availability, setAvailability] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAvailability = async () => {
      const { data, error } = await supabase
        .rpc('get_event_availability', { event_name_param: eventName })

      if (!error && data && data.length > 0) {
        setAvailability(data[0])
      }
      setLoading(false)
    }

    checkAvailability()
    
    // Refresh every 30 seconds
    const interval = setInterval(checkAvailability, 30000)
    return () => clearInterval(interval)
  }, [eventName])

  return { availability, loading }
}

// Usage
function TicketPurchasePage({ eventName }: { eventName: string }) {
  const { availability, loading } = useEventAvailability(eventName)

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <h2>{eventName}</h2>
      <p>Tickets Available: {availability?.tickets_available}</p>
      <p>Tickets Sold: {availability?.tickets_sold}</p>
      {/* Ticket purchase form */}
    </div>
  )
}
```

## 5. Email Template (HTML)

```html
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
  <h1>Your Maguey Club Tickets</h1>
  <p>Thank you for your purchase! Here are your tickets:</p>
  
  {{#each tickets}}
  <div class="ticket">
    <h3>Ticket #{{ticket_id}}</h3>
    <p><strong>Event:</strong> {{event_name}}</p>
    <p><strong>Type:</strong> {{ticket_type}}</p>
    <p><strong>Price:</strong> ${{price_paid}}</p>
    <div class="qr-code">
      <img src="{{qr_code_image_url}}" alt="QR Code" />
    </div>
    <p><small>Present this QR code at the door for entry</small></p>
  </div>
  {{/each}}
  
  <p>We look forward to seeing you at the event!</p>
</body>
</html>
```

## Setup Instructions

1. **Install Stripe CLI** for webhook testing:
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

2. **Set Environment Variables** in Supabase:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY` (or your email service)
- `FRONTEND_URL`

3. **Deploy Edge Functions**:
```bash
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout
```

4. **Configure Stripe Webhook** in Stripe Dashboard:
- Endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
- Events: `payment_intent.succeeded`, `payment_intent.failed`, `charge.refunded`

