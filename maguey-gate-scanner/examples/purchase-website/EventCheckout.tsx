/**
 * Example: Event Checkout Component for Purchase Website
 * 
 * This component handles the checkout flow:
 * 1. Fetches event details
 * 2. Checks availability
 * 3. Creates Stripe checkout session
 * 4. Redirects to Stripe
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { loadStripe } from '@stripe/stripe-js'
import { AvailabilityChecker } from './AvailabilityChecker'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

interface Event {
  id: string
  name: string
  description: string | null
  event_date: string
  venue_capacity: number
  ticket_types: Array<{
    name: string
    price: number
    capacity: number
  }>
}

interface TicketType {
  name: string
  price: number
  capacity: number
  available: number
}

export function EventCheckout() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [selectedTicketType, setSelectedTicketType] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availability, setAvailability] = useState<any>(null)

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return

      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .eq('status', 'published')
          .single()

        if (error) throw error
        setEvent(data)

        // Set first ticket type as default
        if (data.ticket_types && data.ticket_types.length > 0) {
          setSelectedTicketType(data.ticket_types[0].name)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()
  }, [id])

  const handleCheckout = async () => {
    if (!event || !selectedTicketType || !customerEmail || !customerName) {
      setError('Please fill in all fields')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      // Check availability one more time before checkout
      const ticketType = event.ticket_types.find(
        (t: TicketType) => t.name === selectedTicketType
      )

      if (!ticketType) {
        throw new Error('Invalid ticket type')
      }

      // Check availability
      const { data: soldCount } = await supabase.rpc('get_ticket_count_by_type', {
        event_name_param: event.name,
        ticket_type_param: selectedTicketType,
      })

      const available = ticketType.capacity - (soldCount || 0)

      if (available < quantity) {
        throw new Error(`Only ${available} tickets available`)
      }

      // Create checkout session
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: event.name,
          ticketType: selectedTicketType,
          quantity,
          price: ticketType.price,
          customerEmail,
          customerName,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create checkout session')
      }

      const { sessionId } = await response.json()
      const stripe = await stripePromise

      if (!stripe) {
        throw new Error('Stripe failed to load')
      }

      // Redirect to Stripe Checkout
      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId,
      })

      if (stripeError) {
        throw stripeError
      }
    } catch (err: any) {
      setError(err.message)
      setProcessing(false)
    }
  }

  if (loading) {
    return <div>Loading event...</div>
  }

  if (error && !event) {
    return <div>Error: {error}</div>
  }

  if (!event) {
    return <div>Event not found</div>
  }

  const selectedType = event.ticket_types.find(
    (t: TicketType) => t.name === selectedTicketType
  )

  const totalPrice = selectedType ? selectedType.price * quantity : 0

  return (
    <div className="event-checkout">
      <h1>{event.name}</h1>
      {event.description && <p>{event.description}</p>}

      <AvailabilityChecker eventName={event.name} />

      <div className="checkout-form">
        <h2>Select Tickets</h2>

        <div className="form-group">
          <label>Ticket Type</label>
          <select
            value={selectedTicketType}
            onChange={(e) => setSelectedTicketType(e.target.value)}
          >
            {event.ticket_types.map((type: TicketType) => (
              <option key={type.name} value={type.name}>
                {type.name} - ${type.price.toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Quantity</label>
          <input
            type="number"
            min="1"
            max="10"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          />
        </div>

        <div className="form-group">
          <label>Your Name</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            required
          />
        </div>

        <div className="total">
          <strong>Total: ${totalPrice.toFixed(2)}</strong>
        </div>

        {error && <div className="error">{error}</div>}

        <button
          onClick={handleCheckout}
          disabled={processing || !selectedTicketType || !customerEmail || !customerName}
          className="btn-checkout"
        >
          {processing ? 'Processing...' : 'Proceed to Checkout'}
        </button>
      </div>
    </div>
  )
}

