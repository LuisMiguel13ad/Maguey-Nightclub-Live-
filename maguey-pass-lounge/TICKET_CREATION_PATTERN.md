# Correct Ticket Creation Pattern

This document shows the correct pattern for creating tickets that are compatible with the scanner system.

## Key Points

1. **Scanner searches by `qr_token`** - The QR code should encode the `qr_token` (UUID), not `ticket_id`
2. **Use UUID foreign keys** - `event_id` and `ticket_type_id` should be UUIDs, not strings
3. **Field naming** - Use `attendee_name` (not `guest_name`)

## Correct Pattern

```typescript
// On Purchase Website - CORRECTED ticket creation
async function createTicket(orderData) {
  // First, get the event ID (UUID)
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('name', 'New Years Eve 2025 Celebration')
    .single()

  // Then get the ticket_type ID (UUID)
  const { data: ticketType } = await supabase
    .from('ticket_types')
    .select('id')
    .eq('code', 'GA')  // or match by name
    .eq('event_id', event.id)
    .single()

  // Generate QR token (this is what scanner searches for)
  const qrToken = crypto.randomUUID()  // e.g., "625a23e7-23b1-4f66-bbf3-6029b9e6a7aa"

  // Create ticket with scanner-compatible schema
  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      qr_token: qrToken,              // ← Scanner searches by THIS
      event_id: event.id,             // ← UUID foreign key
      ticket_type_id: ticketType.id,  // ← UUID foreign key
      attendee_name: 'Test User',     // ← Scanner expects this field name
      order_id: orderData.orderId,
      status: 'issued',
      issued_at: new Date().toISOString()
    })
    .select()
    .single()

  // The QR code should encode the qr_token
  const qrCodeData = qrToken

  return { ticket, qrToken }
}
```

## Scanner Lookup

The scanner should:
1. Scan QR code → Get JSON payload: `{"token": "uuid", "signature": "...", "meta": {...}}`
2. Parse JSON → Extract `token` field (this is the `qr_token`)
3. Search database by `qr_token`:

```typescript
// Scanner workflow
async function scanTicket(qrCodeData: string) {
  // Step 1: Parse QR code JSON payload
  const payload = JSON.parse(qrCodeData)
  const qrToken = payload.token  // Extract token from QR payload
  
  // Step 2: Search database by qr_token
  const { data: ticket } = await supabase
    .from('ticket_scan_view')
    .select('*')
    .eq('qr_token', qrToken)  // ← Search by qr_token (UUID)
    .single()
  
  return ticket
}
```

## Important Notes

### QR Code Content
- **QR code encodes**: `qr_token` (UUID)
- **NOT**: `ticket_id` (human-readable string)

### Foreign Keys
- `event_id`: Must be UUID from `events.id`
- `ticket_type_id`: Must be UUID from `ticket_types.id`
- Do NOT use string IDs or event names

### Field Names
- Use `attendee_name` (not `guest_name`)
- Use `attendee_email` (not `guest_email`)

## Current Implementation Status

### ✅ Purchase Website (`orders-service.ts`)
- Currently uses `ticket_id` for QR codes
- May need update to use `qr_token` as primary scanner identifier

### ⚠️ Scanner Service (`scanner-service.ts`)
- Currently searches by `ticket_id`
- Should be updated to search by `qr_token` instead

## Migration Path

If you want to switch to `qr_token`-based scanning:

1. **Update Scanner** to search by `qr_token`:
   ```typescript
   .eq('qr_token', scannedQRToken)
   ```

2. **Update QR Code Generation** to encode `qr_token`:
   ```typescript
   const qrCodeData = qrToken  // Not ticket_id
   ```

3. **Ensure all tickets have `qr_token`** set correctly

## Test Script

The test script (`test-create-ticket.ts`) now follows this pattern:
- Generates `qr_token` as UUID
- Uses UUID foreign keys
- Sets `qr_code_value` to `qr_token`
- Creates ticket with correct schema

