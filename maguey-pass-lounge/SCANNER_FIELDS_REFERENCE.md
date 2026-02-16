# Scanner Fields Reference

This document defines the exact fields the scanner expects when querying tickets.

## Scanner Query Pattern

The scanner searches tickets using these **primary fields**:

```typescript
{
  qr_token: string,           // ← Scanner searches by THIS field (UUID)
  event_id: uuid,             // ← Foreign key to events table (UUID)
  ticket_type_id: uuid,       // ← Foreign key to ticket_types table (UUID)
  attendee_name: string,      // ← Scanner expects this field name
  // ... joins with events and ticket_types tables for display data
}
```

## Database Schema

### Tickets Table (Direct Fields)

The `tickets` table stores:

```sql
tickets (
  id UUID PRIMARY KEY,
  qr_token UUID UNIQUE NOT NULL,      -- ← Scanner searches by THIS
  ticket_id VARCHAR,                   -- Human-readable ID (display only)
  event_id UUID REFERENCES events(id), -- ← UUID foreign key
  ticket_type_id UUID REFERENCES ticket_types(id), -- ← UUID foreign key
  attendee_name VARCHAR,              -- ← Scanner expects this
  attendee_email VARCHAR,
  order_id UUID REFERENCES orders(id),
  status VARCHAR,
  price DECIMAL,
  fee_total DECIMAL,
  qr_signature VARCHAR,
  qr_code_url VARCHAR,
  qr_code_value VARCHAR,              -- Contains qr_token
  issued_at TIMESTAMP,
  checked_in_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Scanner View (`ticket_scan_view`)

The scanner queries `ticket_scan_view` which joins tickets with events and ticket_types:

```sql
SELECT 
  -- Primary scanner fields
  t.qr_token,                    -- ← Scanner searches by THIS
  t.event_id,                   -- ← UUID foreign key
  t.ticket_type_id,             -- ← UUID foreign key
  t.attendee_name,              -- ← Scanner expects this
  
  -- Joined data (for display)
  e.name AS event_name,         -- From events table JOIN
  e.image_url AS event_image,   -- From events table JOIN
  tt.name AS ticket_type_full_name, -- From ticket_types table JOIN
  tt.category AS ticket_category,    -- From ticket_types table JOIN
  
  -- Other ticket fields
  t.status,
  t.price,
  t.fee,
  t.total,
  ...
FROM tickets t
JOIN events e ON t.event_id = e.id
JOIN orders o ON t.order_id = o.id
LEFT JOIN ticket_types tt ON t.ticket_type_id = tt.id
```

## Scanner Service Implementation

### Search by qr_token

```typescript
// Scanner searches by qr_token (UUID from QR code)
const { data: ticket } = await supabase
  .from('ticket_scan_view')
  .select('*')
  .eq('qr_token', qrToken)  // ← Search by qr_token (UUID)
  .single()
```

### Expected Response

The scanner receives:

```typescript
{
  // Primary fields (from tickets table)
  qr_token: "625a23e7-23b1-4f66-bbf3-6029b9e6a7aa",  // UUID
  event_id: "1bf4c0a8-765f-45b2-a2a3-7b9a19f7a1d6",  // UUID foreign key
  ticket_type_id: "723fc306-8ada-4828-b6dc-46739bb48aa8", // UUID foreign key
  attendee_name: "John Doe",                         // String
  
  // Joined data (from events table)
  event_name: "New Years Eve 2025 Celebration",
  event_image: "https://...",
  event_date: "2025-12-31",
  event_time: "21:00:00",
  venue_name: "Maguey Pass Lounge",
  
  // Joined data (from ticket_types table)
  ticket_type_full_name: "General Admission",
  ticket_category: "general",
  section_name: null,
  
  // Other fields
  status: "issued",
  price: 75.00,
  fee: 7.50,
  total: 82.50,
  ...
}
```

## Key Points

### ✅ Correct Usage

1. **Scanner searches by `qr_token`** (UUID)
   - QR code encodes JSON: `{"token": "uuid", "signature": "...", "meta": {...}}`
   - Scanner extracts `token` from JSON and searches by `qr_token`

2. **Foreign keys are UUIDs**
   - `event_id`: UUID reference to `events.id`
   - `ticket_type_id`: UUID reference to `ticket_types.id`
   - NOT text fields like `event_name` or `ticket_type`

3. **Field naming**
   - Use `attendee_name` (NOT `guest_name`)
   - Use `attendee_email` (NOT `guest_email`)

### ❌ Incorrect Usage

- ❌ Searching by `ticket_id` (human-readable string)
- ❌ Using `event_name` text field instead of `event_id` UUID
- ❌ Using `ticket_type` text field instead of `ticket_type_id` UUID
- ❌ Using `guest_name` instead of `attendee_name`

## Migration

If you need to update the scanner view to include these fields, run:

```sql
-- Migration: Update ticket_scan_view to include qr_token, ticket_type_id, attendee_name
-- See: supabase/migrations/20250302000001_update_scanner_view_categories.sql
```

## Testing

Test the scanner query:

```typescript
// Test scanner lookup
const qrToken = "625a23e7-23b1-4f66-bbf3-6029b9e6a7aa"
const { data } = await supabase
  .from('ticket_scan_view')
  .select('qr_token, event_id, ticket_type_id, attendee_name, event_name, event_image')
  .eq('qr_token', qrToken)
  .single()

console.log('Scanner fields:', {
  qr_token: data.qr_token,        // ✅ UUID
  event_id: data.event_id,         // ✅ UUID
  ticket_type_id: data.ticket_type_id, // ✅ UUID
  attendee_name: data.attendee_name,    // ✅ String
  event_name: data.event_name,     // ✅ From JOIN
  event_image: data.event_image    // ✅ From JOIN
})
```

