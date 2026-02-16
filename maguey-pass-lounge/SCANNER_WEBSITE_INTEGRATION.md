# Scanner Website Integration Guide

## Overview

This ticket purchase website connects to your **separate ticket scanner website** through a shared Supabase database. When tickets are purchased here, they automatically become available in your scanner website.

## Architecture

```
Ticket Purchase Website (This Site)
    ↓
  Stripe Payment
    ↓
  Webhook Handler
    ↓
  Creates Tickets in Database
    ↓
  Shared Supabase Database
    ↓
Your Scanner Website (Separate Site)
    ↓
  Reads Tickets from Database
    ↓
  Displays Event Images
    ↓
  Validates & Checks In Tickets
```

## Shared Database

Both websites use the **same Supabase database**:

### Tables Created
- ✅ `events` - Event information with `image_url`
- ✅ `orders` - Customer orders
- ✅ `tickets` - Individual tickets with `event_id` linking to events
- ✅ `payments` - Payment records

### Key Features
- ✅ Tickets automatically linked to events via `event_id`
- ✅ Event images available via `events.image_url`
- ✅ Scanner view (`ticket_scan_view`) for optimized queries
- ✅ Real-time synchronization (tickets appear immediately)

## For Your Scanner Website

### Database Connection

Your scanner website should connect to the same Supabase database:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,      // Same as purchase site
  process.env.SUPABASE_ANON_KEY  // Same as purchase site
);
```

### Query Tickets with Event Images

Use the `ticket_scan_view` for optimized queries:

```typescript
// Scan a ticket by ticket_id (from QR code)
const { data: ticket, error } = await supabase
  .from('ticket_scan_view')
  .select('*')
  .eq('ticket_id', scannedTicketId)
  .single();

// ticket.event_image - Event image URL
// ticket.event_name - Event name
// ticket.event_id - Event ID
// All ticket details included
```

### Example Scanner Query

```typescript
async function scanTicket(ticketId: string) {
  const { data, error } = await supabase
    .from('ticket_scan_view')
    .select('*')
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

  return { 
    valid: true, 
    ticket: data,
    eventImage: data.event_image,  // ✅ Event image available
    eventName: data.event_name
  };
}
```

### Check In Tickets

```typescript
async function checkInTicket(ticketId: string) {
  const { error } = await supabase
    .from('tickets')
    .update({
      status: 'checked_in',
      checked_in_at: new Date().toISOString(),
    })
    .eq('ticket_id', ticketId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
```

## Reference Implementation

I've created reference components for your scanner website (not used in this purchase site):

### Location
- `src/lib/scanner-service.ts` - Scanner service functions
- `src/components/scanner/ScannerTicketDisplay.tsx` - UI component example

### Usage in Your Scanner Website

You can copy these files to your scanner website as reference:

1. **Scanner Service** (`scanner-service.ts`)
   - Functions for scanning tickets
   - Returns ticket data with event images
   - Handles check-in functionality

2. **Scanner Component** (`ScannerTicketDisplay.tsx`)
   - Displays ticket with event image
   - Shows event details
   - Check-in button
   - Status badges

## Database Schema

### ticket_scan_view

This view joins tickets with events and orders for easy scanning:

```sql
SELECT * FROM ticket_scan_view WHERE ticket_id = 'MGY-PF-20251115-ABC123';
```

Returns:
- All ticket fields
- `event_name` - Event name
- `event_image` - Event image URL ✅
- `event_date` - Event date
- `event_time` - Event time
- `venue_name` - Venue name
- `customer_first_name` - Customer name
- `customer_last_name` - Customer name
- All other ticket/order details

## Setup Steps

### 1. Run Database Migrations

Run the migrations in your Supabase project (same project both sites use):

1. `supabase/migrations/20250115000000_create_ticket_system.sql`
2. `supabase/migrations/20250115000001_add_event_image_to_tickets.sql`
3. `supabase/migrations/20250115000002_seed_events.sql`

### 2. Configure Scanner Website

In your scanner website, add environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Use Scanner View

In your scanner website, query the `ticket_scan_view`:

```typescript
// Example: Scan ticket
const ticket = await scanTicket('MGY-PF-20251115-ABC123');
console.log(ticket.event_image); // Event image URL
console.log(ticket.event_name);  // Event name
```

## Data Flow

### Purchase Flow
1. Customer purchases ticket on **this website**
2. Stripe payment succeeds
3. Webhook handler creates ticket in database
4. Ticket includes `event_id` linking to event
5. Ticket immediately available in database

### Scanner Flow
1. Staff scans QR code on **your scanner website**
2. QR code contains `ticket_id` (e.g., "MGY-PF-20251115-ABC123")
3. Scanner website queries `ticket_scan_view`
4. Returns ticket with event image and details
5. Staff validates and checks in ticket
6. Ticket status updated to `checked_in`

## Event Images

### How Event Images Work

1. **Events Table**: Each event has `image_url` column
2. **Tickets Table**: Each ticket has `event_id` linking to event
3. **Scanner View**: Joins tickets with events to include `event_image`
4. **Scanner Display**: Shows event image when scanning ticket

### Example Display

```typescript
// In your scanner website
const ticket = await scanTicket('MGY-PF-20251115-ABC123');

// Display event image
<img src={ticket.event_image} alt={ticket.event_name} />

// Display event name
<h2>{ticket.event_name}</h2>

// Display ticket details
<p>Ticket ID: {ticket.ticket_id}</p>
<p>Status: {ticket.status}</p>
```

## Real-Time Updates

Since both sites use the same database, changes are immediately visible:

- ✅ New tickets appear in scanner immediately
- ✅ Check-ins update in real-time
- ✅ Event images always current
- ✅ Event updates sync automatically (see Realtime Setup below)
- ✅ No synchronization needed

## Event Synchronization (Automatic Updates)

When you update events on the purchase website, they automatically update on your scanner website (and vice versa) using Supabase Realtime.

### Setup Realtime for Events

1. **Enable Realtime in Supabase**:
   - Go to Database → Replication
   - Enable Realtime for the `events` table
   - Or run: `ALTER PUBLICATION supabase_realtime ADD TABLE events;`

2. **Use Events Service in Scanner Website**:
   
   Copy `src/lib/events-service.ts` to your scanner website, then:
   
   ```typescript
   import { subscribeToEvents } from '@/lib/events-service';
   
   useEffect(() => {
     // Subscribe to events - automatically updates when events change!
     const unsubscribe = subscribeToEvents((events) => {
       // Update your scanner UI with latest events
       setEvents(events);
     });
     
     return () => unsubscribe();
   }, []);
   ```

3. **Benefits**:
   - ✅ Update events once, both sites update automatically
   - ✅ Real-time synchronization (changes appear within 1-2 seconds)
   - ✅ No manual refresh needed
   - ✅ Event images always current

See `REALTIME_SETUP.md` for detailed setup instructions.

## Security

### Row Level Security (RLS)

RLS policies are configured:
- **Events**: Public read access
- **Orders**: Users see only their own orders
- **Tickets**: Users see only their own tickets

### For Scanner Website

For your scanner website, use **service role key** (bypasses RLS) or create scanner-specific policies:

```typescript
// Scanner website should use service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Service role key
);
```

## Testing

### Test Ticket Creation

1. Purchase a ticket on this website
2. Check database for new ticket
3. Verify ticket has `event_id`
4. Scan ticket in your scanner website
5. Verify event image displays

### Test Scanner Query

```sql
-- In Supabase SQL Editor
SELECT * FROM ticket_scan_view 
WHERE ticket_id = 'YOUR-TICKET-ID';
-- Should return ticket with event_image
```

## Summary

✅ **This Purchase Website**:
- Creates tickets with `event_id`
- Stores event images in `events.image_url`
- Tickets automatically linked to events

✅ **Your Scanner Website**:
- Queries `ticket_scan_view` for tickets
- Gets event images automatically via JOIN
- Displays event context when scanning
- All data synchronized via shared database

✅ **No Integration Needed**:
- Both sites use same database
- No API calls between sites
- Real-time synchronization
- Event images always available

## Reference Files for Your Scanner Website

You can use these as reference in your scanner website:

- `src/lib/scanner-service.ts` - Scanner service functions
- `src/components/scanner/ScannerTicketDisplay.tsx` - UI component example
- `SCANNER_INTEGRATION_GUIDE.md` - Detailed scanner integration guide

These files are not used in this purchase website - they're just examples for your scanner site.

