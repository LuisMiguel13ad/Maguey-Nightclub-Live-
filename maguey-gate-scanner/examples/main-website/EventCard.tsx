/**
 * Example: Event Card Component for Main Website
 * 
 * Displays a single event card with details and link to purchase site.
 */

import { format } from 'date-fns'

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
  is_active: boolean
}

interface EventCardProps {
  event: Event
  purchaseSiteUrl: string
}

export function EventCard({ event, purchaseSiteUrl }: EventCardProps) {
  const eventDate = new Date(event.event_date)
  const formattedDate = format(eventDate, 'EEEE, MMMM d, yyyy')
  const formattedTime = format(eventDate, 'h:mm a')

  // Get lowest price from ticket types
  const lowestPrice = event.ticket_types.length > 0
    ? Math.min(...event.ticket_types.map(t => t.price))
    : 0

  // Build purchase URL with event context
  const purchaseUrl = `${purchaseSiteUrl}/event/${event.id}?name=${encodeURIComponent(event.name)}`

  return (
    <div className="event-card">
      <div className="event-header">
        <h2 className="event-name">{event.name}</h2>
        {event.description && (
          <p className="event-description">{event.description}</p>
        )}
      </div>

      <div className="event-details">
        <div className="event-date">
          <strong>Date:</strong> {formattedDate}
        </div>
        <div className="event-time">
          <strong>Time:</strong> {formattedTime}
        </div>
        {lowestPrice > 0 && (
          <div className="event-price">
            <strong>Starting at:</strong> ${lowestPrice.toFixed(2)}
          </div>
        )}
      </div>

      <div className="event-actions">
        <a
          href={purchaseUrl}
          className="btn-primary"
          target="_self"
        >
          Buy Tickets
        </a>
      </div>

      <style jsx>{`
        .event-card {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 24px;
          background: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .event-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .event-header {
          margin-bottom: 16px;
        }

        .event-name {
          font-size: 24px;
          font-weight: bold;
          margin: 0 0 8px 0;
          color: #333;
        }

        .event-description {
          color: #666;
          margin: 0;
          line-height: 1.5;
        }

        .event-details {
          margin-bottom: 20px;
        }

        .event-details > div {
          margin-bottom: 8px;
          color: #555;
        }

        .event-details strong {
          color: #333;
          margin-right: 8px;
        }

        .event-price {
          font-size: 18px;
          font-weight: bold;
          color: #0066cc;
        }

        .event-actions {
          margin-top: 20px;
        }

        .btn-primary {
          display: inline-block;
          padding: 12px 24px;
          background: #0066cc;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          font-weight: 600;
          transition: background 0.2s;
        }

        .btn-primary:hover {
          background: #0052a3;
        }
      `}</style>
    </div>
  )
}

