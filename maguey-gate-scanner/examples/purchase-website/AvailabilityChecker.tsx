/**
 * Example: Availability Checker Component for Purchase Website
 * 
 * Displays real-time ticket availability for an event.
 * Updates automatically when tickets are purchased.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface AvailabilityCheckerProps {
  eventName: string
}

interface AvailabilityData {
  event_name: string
  total_capacity: number
  tickets_sold: number
  tickets_available: number
  ticket_types: Array<{
    name: string
    price: number
    capacity: number
  }>
}

export function AvailabilityChecker({ eventName }: AvailabilityCheckerProps) {
  const [availability, setAvailability] = useState<AvailabilityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAvailability() {
      try {
        setLoading(true)
        const { data, error } = await supabase.rpc('get_event_availability', {
          event_name_param: eventName
        })

        if (error) throw error

        if (data && data.length > 0) {
          setAvailability(data[0])
        } else {
          setError('Event not found')
        }
      } catch (err: any) {
        setError(err.message)
        console.error('Error fetching availability:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAvailability()

    // Subscribe to real-time ticket changes
    const channel = supabase
      .channel(`availability-${eventName}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets',
          filter: `event_name=eq.${eventName}`,
        },
        () => {
          // Refetch availability when new tickets are created
          fetchAvailability()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventName])

  if (loading) {
    return (
      <div className="availability-loading">
        <p>Checking availability...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="availability-error">
        <p>Error: {error}</p>
      </div>
    )
  }

  if (!availability) {
    return null
  }

  const isSoldOut = availability.tickets_available === 0
  const capacityPercentage = (availability.tickets_sold / availability.total_capacity) * 100

  return (
    <div className="availability-checker">
      <h3>Ticket Availability</h3>

      <div className="availability-summary">
        <div className="availability-stat">
          <span className="stat-label">Total Capacity:</span>
          <span className="stat-value">{availability.total_capacity}</span>
        </div>
        <div className="availability-stat">
          <span className="stat-label">Tickets Sold:</span>
          <span className="stat-value">{availability.tickets_sold}</span>
        </div>
        <div className="availability-stat">
          <span className="stat-label">Available:</span>
          <span className={`stat-value ${isSoldOut ? 'sold-out' : ''}`}>
            {availability.tickets_available}
          </span>
        </div>
      </div>

      <div className="capacity-bar">
        <div
          className="capacity-fill"
          style={{ width: `${capacityPercentage}%` }}
        />
      </div>

      {isSoldOut && (
        <div className="sold-out-message">
          <strong>Sold Out!</strong> This event is at full capacity.
        </div>
      )}

      <div className="ticket-types">
        <h4>Ticket Types</h4>
        {availability.ticket_types.map((type, index) => (
          <div key={index} className="ticket-type">
            <div className="ticket-type-name">{type.name}</div>
            <div className="ticket-type-price">${type.price.toFixed(2)}</div>
            <div className="ticket-type-capacity">
              Capacity: {type.capacity}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .availability-checker {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .availability-summary {
          display: flex;
          gap: 24px;
          margin-bottom: 16px;
        }

        .availability-stat {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 14px;
          color: #666;
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }

        .stat-value.sold-out {
          color: #d32f2f;
        }

        .capacity-bar {
          width: 100%;
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .capacity-fill {
          height: 100%;
          background: linear-gradient(90deg, #4caf50, #ff9800, #f44336);
          transition: width 0.3s;
        }

        .sold-out-message {
          background: #ffebee;
          color: #c62828;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
          text-align: center;
        }

        .ticket-types {
          margin-top: 16px;
        }

        .ticket-types h4 {
          margin-bottom: 12px;
        }

        .ticket-type {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: white;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .ticket-type-name {
          font-weight: 600;
        }

        .ticket-type-price {
          color: #0066cc;
          font-weight: bold;
        }

        .ticket-type-capacity {
          color: #666;
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}

