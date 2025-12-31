# Scanner Integration Guide

## ⚠️ Important Note

**This is a ticket purchase website. The scanner is a separate website.**

This guide provides reference code and examples for your **separate scanner website**. The components in this repo are examples only - they are not used in this purchase site.

## Event Image Display in Scanner

This guide explains how to update your **separate ticket scanner website** to display event images when scanning tickets.

## Quick Start

Reference components and services are available (for your scanner website):

1. **Scanner Service**: `src/lib/scanner-service.ts` - Functions for scanning tickets (reference)
2. **Scanner Component**: `src/components/scanner/ScannerTicketDisplay.tsx` - UI component example (reference)

These files are examples you can copy to your scanner website - they are **not used in this purchase site**.

## Using the Components

### Option 1: Use Scanner Service (Recommended)

```typescript
import { scanTicket, checkInTicket } from '@/lib/scanner-service';

// Scan a ticket
const result = await scanTicket('MGY-PF-20251115-ABC123');
if (result.success && result.ticket) {
  console.log(result.ticket.event_image); // Event image URL
  console.log(result.ticket.event_name);  // Event name
}
```

### Option 2: Use Scanner Component

```typescript
import { ScannerTicketDisplay } from '@/components/scanner/ScannerTicketDisplay';

<ScannerTicketDisplay
  ticket={{
    ticket_id: 'MGY-PF-20251115-ABC123',
    status: 'issued',
    ticket_type_name: 'VIP Entry',
    event_name: 'Reggaeton Nights',
    event_image: 'https://...',
    event_date: '2025-11-15',
    event_time: '10:00 PM',
    venue_name: 'Maguey Nightclub',
    venue_address: '123 Main St',
    customer_first_name: 'John',
    customer_last_name: 'Doe',
    expires_at: '2025-11-15T23:59:59Z',
  }}
  onCheckIn={async (ticketId) => {
    await checkInTicket(ticketId);
  }}
/>
```

### Option 3: Test Page

Visit `/scanner-test` in your app to test the scanner functionality.

## Database Schema

Ensure your `tickets` table has an `event_id` column that links to the `events` table:

```sql
-- tickets table should have:
ticket_id VARCHAR PRIMARY KEY
event_id VARCHAR REFERENCES events(id)
order_id VARCHAR
status VARCHAR
-- ... other fields

-- events table should have:
id VARCHAR PRIMARY KEY
name VARCHAR
image_url VARCHAR  -- or image VARCHAR
date DATE
time TIME
venue_name VARCHAR
-- ... other fields
```

## Scanner Implementation

When scanning a ticket QR code, the scanner should:

### 1. Read QR Code
```typescript
// QR code contains only ticket_id (e.g., "MGY-PF-20251115-ABC123")
const ticketId = scannedQRCode;
```

### 2. Lookup Ticket in Database
```typescript
// Query ticket with event data
const { data: ticket, error } = await supabase
  .from('tickets')
  .select(`
    *,
    events (
      id,
      name,
      image_url,
      date,
      time,
      venue_name
    )
  `)
  .eq('ticket_id', ticketId)
  .single();
```

### 3. Display Event Image
```typescript
// In your scanner UI component
if (ticket && ticket.events) {
  return (
    <div className="scanner-result">
      {/* Event Image */}
      <img 
        src={ticket.events.image_url} 
        alt={ticket.events.name}
        className="event-image"
      />
      
      {/* Event Name */}
      <h2>{ticket.events.name}</h2>
      
      {/* Ticket Details */}
      <div className="ticket-details">
        <p>Ticket ID: {ticket.ticket_id}</p>
        <p>Status: {ticket.status}</p>
        <p>Date: {ticket.events.date}</p>
        <p>Venue: {ticket.events.venue_name}</p>
      </div>
      
      {/* Validation Status */}
      {ticket.status === 'issued' && (
        <div className="valid-ticket">
          ✅ Valid Ticket
        </div>
      )}
    </div>
  );
}
```

## Benefits

1. **Visual Verification**: Staff can visually confirm ticket belongs to correct event
2. **Better UX**: Event image helps identify event quickly
3. **Error Prevention**: Visual mismatch helps catch wrong event tickets
4. **Professional Look**: Scanner UI looks more polished with event branding

## Example Scanner Flow

```
1. Scan QR Code → ticket_id: "MGY-PF-20251115-ABC123"
2. Query Database:
   SELECT tickets.*, events.*
   FROM tickets
   JOIN events ON tickets.event_id = events.id
   WHERE tickets.ticket_id = 'MGY-PF-20251115-ABC123'
3. Display:
   - Event Image (from events.image_url)
   - Event Name
   - Ticket Status
   - Validation Result
4. Check-in/Validate:
   - Update ticket status to 'checked_in'
   - Record check-in time
```

## Database Query Example

```typescript
// Complete scanner query example
async function scanTicket(ticketId: string) {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      ticket_id,
      status,
      ticket_type,
      ticket_type_name,
      issued_at,
      events (
        id,
        name,
        image_url,
        date,
        time,
        venue_name,
        venue_address
      )
    `)
    .eq('ticket_id', ticketId)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Ticket not found' };
  }

  // Check if ticket is valid
  if (data.status !== 'issued') {
    return { 
      valid: false, 
      error: `Ticket already ${data.status}`,
      ticket: data 
    };
  }

  // Check if event date matches today
  const today = new Date().toISOString().split('T')[0];
  if (data.events.date !== today) {
    return { 
      valid: false, 
      error: 'Ticket not valid for today',
      ticket: data 
    };
  }

  return { 
    valid: true, 
    ticket: data,
    event: data.events 
  };
}
```

## UI Component Example

```typescript
// ScannerResult.tsx
interface ScannerResultProps {
  ticket: {
    ticket_id: string;
    status: string;
    events: {
      id: string;
      name: string;
      image_url: string;
      date: string;
      time: string;
      venue_name: string;
    };
  };
}

export function ScannerResult({ ticket }: ScannerResultProps) {
  return (
    <div className="scanner-result">
      {/* Event Image Header */}
      <div className="event-header">
        <img 
          src={ticket.events.image_url} 
          alt={ticket.events.name}
          className="event-image"
        />
        <div className="event-overlay">
          <h2>{ticket.events.name}</h2>
          <p>{new Date(ticket.events.date).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Ticket Info */}
      <div className="ticket-info">
        <p><strong>Ticket ID:</strong> {ticket.ticket_id}</p>
        <p><strong>Status:</strong> {ticket.status}</p>
        <p><strong>Venue:</strong> {ticket.events.venue_name}</p>
      </div>

      {/* Actions */}
      {ticket.status === 'issued' && (
        <button onClick={handleCheckIn}>
          Check In Ticket
        </button>
      )}
    </div>
  );
}
```

## CSS Example

```css
.scanner-result {
  max-width: 400px;
  margin: 0 auto;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.event-header {
  position: relative;
  height: 200px;
}

.event-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.event-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  padding: 20px;
  color: white;
}

.ticket-info {
  padding: 20px;
  background: white;
}
```

## Summary

With `event_id` stored in the database and event images available, your scanner can:
- ✅ Display event image when scanning tickets
- ✅ Validate ticket belongs to correct event
- ✅ Show event context to staff
- ✅ Provide better visual verification
- ✅ Improve overall scanner UX

The event image makes it easy to visually confirm tickets are for the correct event, reducing errors and improving the scanning experience.

