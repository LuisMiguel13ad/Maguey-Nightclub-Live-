# Purchase Website Integration Guide

## Overview

This guide shows how to integrate your Purchase Website with the Scanner Site's Supabase database to sell tickets. The Purchase Website will read event data, check availability in real-time, create tickets after payment, and sync everything with the Scanner Site.

## Architecture

```
┌─────────────────────────────────────┐
│      Scanner Site (Admin)           │
│  • Creates/updates events           │
│  • Scans tickets                    │
└──────────────┬──────────────────────┘
               │
               │ Writes to
               ▼
┌─────────────────────────────────────┐
│      Supabase Database              │
│  • events table                    │
│  • tickets table                   │
│  • orders table                    │
└──────────────┬──────────────────────┘
               │
               │ Reads + Writes
               ▼
┌─────────────────────────────────────┐
│      Purchase Website (Sales)       │
│  • Displays events                  │
│  • Checks availability              │
│  • Creates tickets                  │
└─────────────────────────────────────┘
```

## Setup

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js stripe @stripe/stripe-js
```

### 2. Environment Variables

Create a `.env` file:

```env
# Supabase (same as Scanner Site)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...  # Server-side only!

# Email Service (for ticket delivery)
SENDGRID_API_KEY=your-sendgrid-key
# OR
RESEND_API_KEY=your-resend-key

# Purchase Site URL (for redirects)
VITE_PURCHASE_SITE_URL=https://your-purchase-site.com
```

### 3. Initialize Supabase Client

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## Fetching Event Details

### Get Single Event

```typescript
async function getEvent(eventId: string) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('is_active', true)
    .single()

  if (error) throw error
  return data
}
```

### Get Event by Name

```typescript
async function getEventByName(eventName: string) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('name', eventName)
    .eq('is_active', true)
    .single()

  if (error) throw error
  return data
}
```

## Checking Availability

### Using Database Function

```typescript
async function checkAvailability(eventName: string) {
  const { data, error } = await supabase.rpc('get_event_availability', {
    event_name_param: eventName
  })

  if (error) throw error
  
  if (!data || data.length === 0) {
    return null // Event not found
  }

  const result = data[0]
  
  return {
    eventName: result.event_name,
    totalCapacity: result.total_capacity,
    ticketsSold: result.tickets_sold,
    ticketsAvailable: result.tickets_available,
    ticketTypes: result.ticket_types.map((type: any) => ({
      name: type.name,
      price: type.price,
      capacity: type.capacity,
      // Calculate sold/available per type
      sold: 0, // You'll need to query this separately
      available: type.capacity
    }))
  }
}
```

### Using API Endpoint (Recommended)

If you've deployed the Supabase Edge Function:

```typescript
async function checkAvailabilityAPI(eventName: string) {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/event-availability/${encodeURIComponent(eventName)}`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  )

  if (!response.ok) {
    throw new Error('Failed to check availability')
  }

  return await response.json()
}
```

### Real-Time Availability Updates

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useAvailability(eventName: string) {
  const [availability, setAvailability] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initial fetch
    const fetchAvailability = async () => {
      const { data } = await supabase.rpc('get_event_availability', {
        event_name_param: eventName
      })
      if (data && data.length > 0) {
        setAvailability(data[0])
      }
      setLoading(false)
    }

    fetchAvailability()

    // Subscribe to ticket changes
    const channel = supabase
      .channel(`availability-${eventName}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets',
          filter: `event_name=eq.${eventName}`
        },
        () => {
          // Refetch when new tickets are created
          fetchAvailability()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventName])

  return { availability, loading }
}
```

## Creating Tickets After Payment

### Generate Unique Ticket ID

```typescript
function generateTicketId(eventName: string, orderId: string, index: number): string {
  const prefix = eventName.substring(0, 3).toUpperCase()
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}-${index + 1}`
}
```

### Create Tickets Function

```typescript
interface CreateTicketsParams {
  orderId: string
  eventName: string
  ticketType: string
  quantity: number
  customerEmail: string
  customerName: string
  customerPhone?: string
  stripePaymentIntentId: string
  pricePaid: number
}

async function createTickets(params: CreateTicketsParams) {
  const tickets = []

  for (let i = 0; i < params.quantity; i++) {
    const ticketId = generateTicketId(params.eventName, params.orderId, i)
    
    tickets.push({
      ticket_id: ticketId,
      event_name: params.eventName,
      ticket_type: params.ticketType,
      guest_name: params.customerName,
      guest_email: params.customerEmail,
      guest_phone: params.customerPhone || null,
      order_id: params.orderId,
      qr_code_data: ticketId, // QR code contains ticket_id
      price_paid: params.pricePaid,
      stripe_payment_id: params.stripePaymentIntentId,
      purchase_date: new Date().toISOString(),
      status: 'issued',
      is_used: false,
    })
  }

  const { data, error } = await supabase
    .from('tickets')
    .insert(tickets)
    .select()

  if (error) {
    console.error('Error creating tickets:', error)
    throw error
  }

  return data
}
```

## Stripe Integration

### Create Checkout Session

```typescript
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

async function createCheckoutSession(
  eventName: string,
  ticketType: string,
  quantity: number,
  price: number,
  customerEmail: string,
  customerName: string
) {
  // Call your backend API to create checkout session
  const response = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventName,
      ticketType,
      quantity,
      price,
      customerEmail,
      customerName,
    }),
  })

  const { sessionId } = await response.json()
  const stripe = await stripePromise

  // Redirect to Stripe Checkout
  const { error } = await stripe!.redirectToCheckout({ sessionId })
  
  if (error) {
    console.error('Stripe checkout error:', error)
  }
}
```

### Backend: Create Checkout Session

```typescript
// Server-side (API route or Edge Function)
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function createCheckoutSession(req: Request) {
  const {
    eventName,
    ticketType,
    quantity,
    price,
    customerEmail,
    customerName,
  } = await req.json()

  // Check availability first
  const { data: availability } = await supabase.rpc('get_event_availability', {
    event_name_param: eventName
  })

  if (!availability || availability.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Event not found' }),
      { status: 404 }
    )
  }

  const event = availability[0]
  const ticketTypeConfig = event.ticket_types.find(
    (t: any) => t.name === ticketType
  )

  if (!ticketTypeConfig) {
    return new Response(
      JSON.stringify({ error: 'Invalid ticket type' }),
      { status: 400 }
    )
  }

  // Check capacity
  const { data: soldCount } = await supabase.rpc('get_ticket_count_by_type', {
    event_name_param: eventName,
    ticket_type_param: ticketType,
  })

  if ((soldCount || 0) + quantity > ticketTypeConfig.capacity) {
    return new Response(
      JSON.stringify({ error: 'Not enough tickets available' }),
      { status: 400 }
    )
  }

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${eventName} - ${ticketType}`,
            description: `Ticket for ${eventName}`,
          },
          unit_amount: Math.round(price * 100), // Convert to cents
        },
        quantity: quantity,
      },
    ],
    mode: 'payment',
    customer_email: customerEmail,
    metadata: {
      event_name: eventName,
      ticket_type: ticketType,
      quantity: quantity.toString(),
      customer_name: customerName,
    },
    success_url: `${process.env.PURCHASE_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.PURCHASE_SITE_URL}/cancel`,
  })

  return new Response(
    JSON.stringify({ sessionId: session.id }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
```

## Webhook Handler (Create Tickets After Payment)

### Stripe Webhook Handler

```typescript
// Server-side (Supabase Edge Function or API route)
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function handleStripeWebhook(req: Request) {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature!, webhookSecret)
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }),
      { status: 400 }
    )
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Create order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        stripe_payment_intent_id: session.payment_intent as string,
        stripe_checkout_session_id: session.id,
        customer_email: session.customer_email!,
        customer_name: session.metadata?.customer_name,
        total_amount: (session.amount_total || 0) / 100, // Convert from cents
        currency: session.currency || 'usd',
        status: 'completed',
        event_name: session.metadata?.event_name!,
        ticket_count: parseInt(session.metadata?.quantity || '1'),
        ticket_type: session.metadata?.ticket_type!,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500 }
      )
    }

    // Create tickets
    const tickets = await createTickets({
      orderId: order.id,
      eventName: session.metadata?.event_name!,
      ticketType: session.metadata?.ticket_type!,
      quantity: parseInt(session.metadata?.quantity || '1'),
      customerEmail: session.customer_email!,
      customerName: session.metadata?.customer_name || '',
      stripePaymentIntentId: session.payment_intent as string,
      pricePaid: (session.amount_total || 0) / 100,
    })

    // Send email with tickets (see Email Service section)
    await sendTicketEmail(tickets, session.customer_email!)

    return new Response(
      JSON.stringify({ success: true, orderId: order.id }),
      { status: 200 }
    )
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}
```

## Email Service (Ticket Delivery)

### Using SendGrid

```typescript
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

async function sendTicketEmail(tickets: any[], customerEmail: string) {
  const eventName = tickets[0]?.event_name || 'Event'
  
  const html = `
    <h1>Your Tickets for ${eventName}</h1>
    <p>Thank you for your purchase! Here are your tickets:</p>
    
    ${tickets.map(ticket => `
      <div style="border: 1px solid #ccc; padding: 20px; margin: 20px 0;">
        <h2>Ticket: ${ticket.ticket_id}</h2>
        <p><strong>Event:</strong> ${ticket.event_name}</p>
        <p><strong>Type:</strong> ${ticket.ticket_type}</p>
        <p><strong>Price:</strong> $${ticket.price_paid}</p>
        <div style="text-align: center; margin: 20px 0;">
          <!-- QR Code would be generated here -->
          <p>QR Code: ${ticket.qr_code_data}</p>
        </div>
      </div>
    `).join('')}
    
    <p>Present your QR code at the door for entry.</p>
  `

  await sgMail.send({
    to: customerEmail,
    from: 'tickets@yourclub.com',
    subject: `Your Tickets for ${eventName}`,
    html,
  })
}
```

### Using Resend

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

async function sendTicketEmail(tickets: any[], customerEmail: string) {
  const eventName = tickets[0]?.event_name || 'Event'
  
  await resend.emails.send({
    from: 'Tickets <tickets@yourclub.com>',
    to: customerEmail,
    subject: `Your Tickets for ${eventName}`,
    html: generateTicketEmailHTML(tickets),
  })
}
```

## Order Confirmation Page

```typescript
import { useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function OrderSuccessPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [order, setOrder] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOrder() {
      if (!sessionId) return

      // Get order by Stripe session ID
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('stripe_checkout_session_id', sessionId)
        .single()

      if (!orderData) return

      setOrder(orderData)

      // Get tickets for this order
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('*')
        .eq('order_id', orderData.id)

      if (ticketsData) {
        setTickets(ticketsData)
      }

      setLoading(false)
    }

    fetchOrder()
  }, [sessionId])

  if (loading) return <div>Loading...</div>
  if (!order) return <div>Order not found</div>

  return (
    <div className="order-success">
      <h1>Order Confirmed!</h1>
      <p>Thank you for your purchase.</p>
      
      <div className="tickets">
        <h2>Your Tickets</h2>
        {tickets.map(ticket => (
          <div key={ticket.id} className="ticket">
            <p><strong>Ticket ID:</strong> {ticket.ticket_id}</p>
            <p><strong>Event:</strong> {ticket.event_name}</p>
            <p><strong>Type:</strong> {ticket.ticket_type}</p>
            <div className="qr-code">
              {/* Display QR code */}
              <p>QR: {ticket.qr_code_data}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Handling Sold-Out Scenarios

```typescript
async function checkAvailabilityBeforeCheckout(
  eventName: string,
  ticketType: string,
  quantity: number
): Promise<{ available: boolean; message?: string }> {
  const { data } = await supabase.rpc('get_event_availability', {
    event_name_param: eventName
  })

  if (!data || data.length === 0) {
    return { available: false, message: 'Event not found' }
  }

  const event = data[0]
  const ticketTypeConfig = event.ticket_types.find(
    (t: any) => t.name === ticketType
  )

  if (!ticketTypeConfig) {
    return { available: false, message: 'Invalid ticket type' }
  }

  const { data: soldCount } = await supabase.rpc('get_ticket_count_by_type', {
    event_name_param: eventName,
    ticket_type_param: ticketType,
  })

  const available = ticketTypeConfig.capacity - (soldCount || 0)

  if (available < quantity) {
    return {
      available: false,
      message: `Only ${available} tickets available`
    }
  }

  return { available: true }
}
```

## Summary

- ✅ Purchase Website reads events from Supabase
- ✅ Checks real-time availability before checkout
- ✅ Creates tickets after successful Stripe payment
- ✅ Tickets automatically appear in Scanner Site
- ✅ Email delivery with QR codes
- ✅ Order confirmation page

Your Purchase Website is now fully integrated with the Scanner Site!

