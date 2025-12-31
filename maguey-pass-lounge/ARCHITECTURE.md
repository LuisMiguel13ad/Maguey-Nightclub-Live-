# System Architecture

## Overview

This is a **ticket purchase website** that connects to a **separate ticket scanner website** through a shared Supabase database.

## System Components

### 1. Ticket Purchase Website (This Site)
- **Purpose**: Customer-facing ticket purchase system
- **Features**: 
  - Event browsing
  - Ticket selection
  - Stripe checkout
  - User authentication
  - Digital ticket display
- **Location**: This repository

### 2. Ticket Scanner Website (Separate Site)
- **Purpose**: Staff-facing ticket validation system
- **Features**:
  - QR code scanning
  - Ticket validation
  - Check-in functionality
  - Event image display
- **Location**: Your separate scanner website repository

### 3. Shared Supabase Database
- **Purpose**: Single source of truth for all ticket data
- **Tables**:
  - `events` - Event information with images
  - `orders` - Customer orders
  - `tickets` - Individual tickets with event linkage
  - `payments` - Payment records
- **Access**: Both websites connect to same database

## Data Flow

### Purchase Flow
```
Customer visits purchase website
    ↓
Selects event and tickets
    ↓
Completes Stripe checkout
    ↓
Webhook handler receives payment confirmation
    ↓
Creates order in database
    ↓
Generates tickets with event_id
    ↓
Stores tickets in database
    ↓
Sends email with tickets
```

### Scanner Flow
```
Staff opens scanner website
    ↓
Scans QR code (contains ticket_id)
    ↓
Queries ticket_scan_view
    ↓
Retrieves ticket with event image
    ↓
Displays ticket details
    ↓
Validates ticket
    ↓
Checks in ticket (updates status)
```

## Database Schema

### Events Table
```sql
events (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  image_url VARCHAR NOT NULL,  -- Event image
  date DATE NOT NULL,
  time TIME NOT NULL,
  venue_name VARCHAR NOT NULL,
  ...
)
```

### Tickets Table
```sql
tickets (
  id UUID PRIMARY KEY,
  ticket_id VARCHAR UNIQUE NOT NULL,  -- QR code data
  event_id VARCHAR REFERENCES events(id),  -- Links to event
  order_id UUID REFERENCES orders(id),
  status VARCHAR NOT NULL,
  ...
)
```

### Scanner View
```sql
ticket_scan_view (
  -- All ticket fields
  ticket_id,
  event_id,
  status,
  ...
  -- Event fields (via JOIN)
  event_name,
  event_image,  -- ✅ Event image from events table
  event_date,
  event_time,
  venue_name,
  ...
  -- Order fields (via JOIN)
  customer_first_name,
  customer_last_name,
  ...
)
```

## Key Features

### ✅ Event Images
- Events stored with `image_url` in `events` table
- Tickets linked to events via `event_id`
- Scanner view automatically includes event image
- No additional queries needed

### ✅ Real-Time Synchronization
- Both sites use same database
- Tickets appear immediately after purchase
- Check-ins update in real-time
- No API calls between sites

### ✅ Event Linkage
- Every ticket has `event_id`
- Tickets always linked to correct event
- Event images always available
- Easy to filter by event

## Integration Points

### Database Connection
Both websites use same Supabase project:
```typescript
// Same in both websites
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

### Scanner Queries
Scanner website queries `ticket_scan_view`:
```typescript
// Scanner website
const ticket = await supabase
  .from('ticket_scan_view')
  .select('*')
  .eq('ticket_id', scannedTicketId)
  .single();

// ticket.event_image - Available automatically
// ticket.event_name - Available automatically
```

### Ticket Creation
Purchase website creates tickets with `event_id`:
```typescript
// Purchase website (webhook)
await supabase.from('tickets').insert({
  ticket_id: 'MGY-PF-20251115-ABC123',
  event_id: '1',  // ✅ Links to event
  order_id: orderId,
  ...
});
```

## Security

### Row Level Security (RLS)
- **Events**: Public read access
- **Orders**: Users see only their own orders
- **Tickets**: Users see only their own tickets
- **Scanner**: Uses service role key (bypasses RLS)

### Environment Variables
- Same Supabase credentials for both sites
- Scanner uses service role key for admin access
- Purchase site uses anon key for user access

## Benefits of This Architecture

### ✅ Separation of Concerns
- Purchase site focuses on sales
- Scanner site focuses on validation
- No code coupling between sites

### ✅ Shared Data
- Single source of truth
- No data synchronization needed
- Real-time updates

### ✅ Scalability
- Sites can scale independently
- Database handles all data
- No API rate limits between sites

### ✅ Event Images
- Stored once in events table
- Available to both sites
- No duplication

## Migration Strategy

### For Purchase Website (This Site)
1. ✅ Run database migrations
2. ✅ Configure Supabase connection
3. ✅ Set up Stripe webhook
4. ✅ Test ticket creation

### For Scanner Website (Your Site)
1. ✅ Connect to same Supabase database
2. ✅ Use `ticket_scan_view` for queries
3. ✅ Display event images from query results
4. ✅ Implement check-in functionality

## Testing

### Test Purchase Flow
1. Purchase ticket on this website
2. Verify ticket created in database
3. Verify ticket has `event_id`
4. Check scanner website can see ticket

### Test Scanner Flow
1. Scan ticket in scanner website
2. Verify event image displays
3. Verify ticket details correct
4. Check in ticket
5. Verify status updated in database

## Summary

This architecture provides:
- ✅ Clean separation between purchase and scanner
- ✅ Shared database for synchronization
- ✅ Event images automatically available
- ✅ Real-time updates
- ✅ Scalable and maintainable

Both websites work independently but share the same database, ensuring data consistency and real-time synchronization without tight coupling.

