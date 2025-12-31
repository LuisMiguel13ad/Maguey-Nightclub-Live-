/**
 * Example: Ticket Creation Function for Purchase Website
 * 
 * This function creates tickets after successful Stripe payment.
 * Use this in your Stripe webhook handler or after payment confirmation.
 */

import { supabase } from '@/lib/supabase'

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

/**
 * Generate a unique ticket ID
 */
function generateTicketId(
  eventName: string,
  orderId: string,
  index: number
): string {
  const prefix = eventName.substring(0, 3).toUpperCase().replace(/\s/g, '')
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}-${index + 1}`
}

/**
 * Create tickets in the database after payment
 */
export async function createTickets(params: CreateTicketsParams) {
  const tickets = []

  // Generate tickets
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

  // Insert tickets into database
  const { data, error } = await supabase
    .from('tickets')
    .insert(tickets)
    .select()

  if (error) {
    console.error('Error creating tickets:', error)
    throw new Error(`Failed to create tickets: ${error.message}`)
  }

  console.log(`Created ${tickets.length} tickets for order ${params.orderId}`)

  return data
}

/**
 * Example usage in Stripe webhook handler
 */
export async function handlePaymentSuccess(session: any) {
  try {
    // 1. Create order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        stripe_payment_intent_id: session.payment_intent,
        stripe_checkout_session_id: session.id,
        customer_email: session.customer_email,
        customer_name: session.metadata?.customer_name,
        total_amount: (session.amount_total || 0) / 100, // Convert from cents
        currency: session.currency || 'usd',
        status: 'completed',
        event_name: session.metadata?.event_name,
        ticket_count: parseInt(session.metadata?.quantity || '1'),
        ticket_type: session.metadata?.ticket_type,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`)
    }

    // 2. Create tickets
    const tickets = await createTickets({
      orderId: order.id,
      eventName: session.metadata?.event_name,
      ticketType: session.metadata?.ticket_type,
      quantity: parseInt(session.metadata?.quantity || '1'),
      customerEmail: session.customer_email,
      customerName: session.metadata?.customer_name || '',
      stripePaymentIntentId: session.payment_intent,
      pricePaid: (session.amount_total || 0) / 100,
    })

    // 3. Send email with tickets (implement separately)
    // await sendTicketEmail(tickets, session.customer_email)

    return {
      success: true,
      orderId: order.id,
      tickets: tickets,
    }
  } catch (error: any) {
    console.error('Error handling payment success:', error)
    throw error
  }
}

/**
 * Example: Check availability before creating checkout session
 */
export async function checkAvailabilityBeforeCheckout(
  eventName: string,
  ticketType: string,
  quantity: number
): Promise<{ available: boolean; message?: string; availableCount?: number }> {
  try {
    // Get event availability
    const { data, error } = await supabase.rpc('get_event_availability', {
      event_name_param: eventName,
    })

    if (error) {
      throw error
    }

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

    // Get current sold count for this ticket type
    const { data: soldCount, error: countError } = await supabase.rpc(
      'get_ticket_count_by_type',
      {
        event_name_param: eventName,
        ticket_type_param: ticketType,
      }
    )

    if (countError) {
      throw countError
    }

    const available = ticketTypeConfig.capacity - (soldCount || 0)

    if (available < quantity) {
      return {
        available: false,
        message: `Only ${available} tickets available`,
        availableCount: available,
      }
    }

    return { available: true, availableCount: available }
  } catch (error: any) {
    console.error('Error checking availability:', error)
    return { available: false, message: error.message }
  }
}

