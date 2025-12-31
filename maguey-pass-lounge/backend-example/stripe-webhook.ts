/**
 * Complete Stripe Webhook Handler Example
 * This is a complete example that generates unique tickets and sends emails
 * 
 * For Supabase Edge Functions, save this as: supabase/functions/stripe-webhook/index.ts
 * For Node.js/Express, adapt this to your Express route handler
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

// ============================================
// RATE LIMITING (In-Memory)
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 50; // 50 requests per minute per IP

function getClientIP(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const resend = new Resend(Deno.env.get('RESEND_API_KEY') || '');

// Ticket generation functions (same as frontend)
function generateTicketId(eventDate: string | Date): string {
  const prefix = 'MGY-PF';
  const date = typeof eventDate === 'string' ? new Date(eventDate) : eventDate;
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const timestamp = Date.now().toString(36).toUpperCase().slice(-3);
  const random = Array.from({ length: 3 }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
  const suffix = (timestamp + random).slice(0, 6);
  return `${prefix}-${dateStr}-${suffix}`;
}

function generateUniqueTicketIds(eventDate: string | Date, quantity: number): string[] {
  const ticketIds = new Set<string>();
  while (ticketIds.size < quantity) {
    const ticketId = generateTicketId(eventDate);
    ticketIds.add(ticketId);
  }
  return Array.from(ticketIds);
}

function generateQRCodeUrl(ticketId: string, size: number = 300): string {
  const encodedTicketId = encodeURIComponent(ticketId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedTicketId}&ecc=M&margin=10`;
}

// Generate tickets for an order
async function generateTicketsForOrder(order: any, lineItems: any[]) {
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', order.event_id)
    .single();

  if (!event) throw new Error('Event not found');

  const tickets: any[] = [];
  
  // Parse ticket quantities from Stripe line items
  // Assumes line item names contain ticket type info
  const ticketQuantities: Record<string, number> = {};
  
  for (const item of lineItems) {
    // Extract ticket type from item description or name
    // Adjust this logic based on how you structure your Stripe line items
    const ticketType = item.description?.toLowerCase().replace(/\s+/g, '_') || 'general_admission';
    const quantity = item.quantity || 1;
    ticketQuantities[ticketType] = (ticketQuantities[ticketType] || 0) + quantity;
  }

  // Generate tickets for each type
  for (const [ticketType, quantity] of Object.entries(ticketQuantities)) {
    const ticketIds = generateUniqueTicketIds(event.date, quantity);
    
    for (const ticketId of ticketIds) {
      const qrCodeUrl = generateQRCodeUrl(ticketId);
      
      // Calculate per-ticket price
      const totalTickets = Object.values(ticketQuantities).reduce((a, b) => a + b, 0);
      const ticketPrice = order.total / totalTickets;
      
      // Save ticket to database with event_id and event image reference
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          ticket_id: ticketId,
          order_id: order.id,
          event_id: order.event_id,  // ✅ Store event_id
          ticket_type: ticketType,
          ticket_type_name: ticketType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          status: 'issued',
          price: ticketPrice,
          fee: 0, // Adjust based on your fee structure
          total: ticketPrice,
          issued_at: new Date().toISOString(),
          expires_at: new Date(event.date).toISOString(),
        })
        .select()
        .single();
      
      if (ticketError) {
        console.error('Error creating ticket:', ticketError);
        throw ticketError;
      }
      
      tickets.push({
        ticketId,
        qrCodeUrl,
        eventId: event.id,                    // NEW: Store event ID
        eventImage: event.image_url || event.image || '',  // NEW: Store event image
        eventName: event.name,
        eventDate: event.date,
        eventTime: event.time,
        venue: event.venue_name,
        venueAddress: event.venue_address,
        ticketType: ticket.ticket_type_name,
        ticketHolderName: `${order.customer_first_name} ${order.customer_last_name}`,
        orderId: order.id,
        price: ticket.price,
      });
    }
  }
  
  return tickets;
}

// Generate email HTML
function generateTicketEmailHTML(tickets: any[], customerName: string, orderId: string, frontendUrl: string) {
  const eventName = tickets[0]?.eventName || 'Event';
  const eventDate = tickets[0]?.eventDate || '';
  const eventTime = tickets[0]?.eventTime || '';
  
  // This is a simplified version - use the full template from email-template.ts
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .ticket { border: 2px solid #6366f1; border-radius: 8px; padding: 0; margin: 20px 0; overflow: hidden; }
        .ticket-image { width: 100%; height: 200px; object-fit: cover; display: block; }
        .ticket-content { padding: 20px; }
        .qr-code { text-align: center; margin: 20px 0; }
        .qr-code img { max-width: 250px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎫 Your Tickets for ${eventName}</h1>
        <p>Hi ${customerName},</p>
        <p>Thank you for your purchase! Your digital tickets are ready.</p>
        
        ${tickets.map(ticket => `
          <div class="ticket">
            ${ticket.eventImage ? `<img src="${ticket.eventImage}" alt="${ticket.eventName}" class="ticket-image" />` : ''}
            <div class="ticket-content">
              <h2>${ticket.eventName}</h2>
              <p><strong>Date:</strong> ${eventDate} at ${eventTime}</p>
              <p><strong>Venue:</strong> ${ticket.venue}</p>
              <p><strong>Ticket Type:</strong> ${ticket.ticketType}</p>
              <div class="qr-code">
                <img src="${ticket.qrCodeUrl}" alt="QR Code" />
                <p>Ticket ID: ${ticket.ticketId}</p>
              </div>
            </div>
          </div>
        `).join('')}
        
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p>View your tickets: <a href="${frontendUrl}/account">${frontendUrl}/account</a></p>
      </div>
    </body>
    </html>
  `;
}

// Send email with tickets
async function sendTicketEmail(order: any, tickets: any[]) {
  const customerName = `${order.customer_first_name} ${order.customer_last_name}`;
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://your-site.com';
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'Maguey <tickets@yourdomain.com>',
      to: order.customer_email,
      subject: `Your Tickets for ${tickets[0]?.eventName || 'Event'}`,
      html: generateTicketEmailHTML(tickets, customerName, order.id, frontendUrl),
    });

    if (error) {
      console.error('Error sending email:', error);
      // Don't throw - log error but don't fail the webhook
    } else {
      console.log('Email sent successfully:', data);
    }
  } catch (error) {
    console.error('Failed to send email:', error);
    // Don't throw - log error but don't fail the webhook
  }
}

// Main webhook handler
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ============================================
  // RATE LIMITING
  // ============================================
  const clientIP = getClientIP(req);
  const rateLimitResult = checkRateLimit(clientIP);

  if (!rateLimitResult.allowed) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
        retryAfter: rateLimitResult.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
        },
      }
    );
  }

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
    console.error('Webhook signature verification failed:', err);
    return new Response(
      JSON.stringify({ error: `Webhook Error: ${err.message}` }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    try {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (!orderId) {
        console.error('No orderId in session metadata');
        return new Response(
          JSON.stringify({ error: 'No orderId found' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get order from database
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        console.error('Order not found:', orderError);
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get Stripe line items to determine ticket quantities
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ['data.price.product'],
      });

      // Generate tickets
      const tickets = await generateTicketsForOrder(order, lineItems.data);

      // Update order status
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent as string,
        })
        .eq('id', orderId);

      // Send email with tickets
      await sendTicketEmail(order, tickets);

      console.log(`Successfully processed order ${orderId} with ${tickets.length} tickets`);

      return new Response(
        JSON.stringify({ received: true, ticketsGenerated: tickets.length }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Return success for other event types
  return new Response(
    JSON.stringify({ received: true }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
});

