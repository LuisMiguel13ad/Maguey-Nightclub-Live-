# Testing Guide

## Overview

This guide helps you test the complete ticket system including event images, database migrations, and scanner functionality.

## Prerequisites

1. ✅ Supabase project created
2. ✅ Database migrations run (see `DATABASE_SETUP.md`)
3. ✅ Environment variables configured
4. ✅ Supabase client initialized

## Test Checklist

### 1. Database Setup Tests

#### Test 1.1: Verify Tables Exist
```sql
-- Run in Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('events', 'orders', 'tickets', 'payments');
-- Should return 4 rows
```

#### Test 1.2: Verify Events Table Has image_url
```sql
SELECT id, name, image_url 
FROM events;
-- Should return events with image_url populated
```

#### Test 1.3: Verify Tickets Table Has event_id
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tickets' 
AND column_name IN ('event_id', 'ticket_id');
-- Should return both columns
```

#### Test 1.4: Verify Scanner View
```sql
SELECT * FROM ticket_scan_view LIMIT 1;
-- Should return view structure (may be empty if no tickets yet)
```

### 2. Event Data Tests

#### Test 2.1: Check Seeded Events
```sql
SELECT id, name, image_url, date, time 
FROM events 
ORDER BY date;
-- Should return 3 events with images
```

#### Test 2.2: Verify Event Images
```sql
SELECT id, name, image_url 
FROM events 
WHERE image_url IS NULL OR image_url = '';
-- Should return 0 rows (all events have images)
```

### 3. Ticket Generation Tests

#### Test 3.1: Create Test Order and Ticket
```sql
-- Insert test order
INSERT INTO orders (
  event_id,
  customer_first_name,
  customer_last_name,
  customer_email,
  total,
  status
) VALUES (
  '1',
  'Test',
  'User',
  'test@example.com',
  50.00,
  'paid'
) RETURNING id;

-- Note the order_id from result, then insert ticket
-- Replace 'ORDER_ID_HERE' with actual order ID
INSERT INTO tickets (
  ticket_id,
  order_id,
  event_id,
  ticket_type,
  ticket_type_name,
  status,
  price,
  fee,
  total,
  expires_at
) VALUES (
  'MGY-PF-20251115-TEST01',
  'ORDER_ID_HERE',  -- Replace with actual order ID
  '1',  -- Event ID for Reggaeton Nights
  'vip',
  'VIP Entry',
  'issued',
  50.00,
  0,
  50.00,
  '2025-11-15 23:59:59'
);
```

#### Test 3.2: Verify Ticket Has event_id
```sql
SELECT 
  t.ticket_id,
  t.event_id,
  e.name AS event_name,
  e.image_url AS event_image
FROM tickets t
JOIN events e ON t.event_id = e.id
WHERE t.ticket_id = 'MGY-PF-20251115-TEST01';
-- Should return ticket with event name and image
```

### 4. Scanner Service Tests

#### Test 4.1: Test Scanner Query
```sql
SELECT * FROM ticket_scan_view 
WHERE ticket_id = 'MGY-PF-20251115-TEST01';
-- Should return complete ticket data with event image
```

#### Test 4.2: Test Scanner Component
1. Start dev server: `npm run dev`
2. Navigate to `/scanner-test` (if route added) or use the component
3. Enter ticket ID: `MGY-PF-20251115-TEST01`
4. Click "Scan"
5. Verify:
   - ✅ Event image displays
   - ✅ Event name displays
   - ✅ Ticket details display
   - ✅ Status shows "Valid"

### 5. Email Template Tests

#### Test 5.1: Verify Email Template Includes Event Image
1. Check `src/lib/email-template.ts`
2. Verify template includes:
   ```html
   ${ticket.eventImage ? `
     <img src="${ticket.eventImage}" alt="${ticket.eventName}" class="ticket-image" />
   ` : ''}
   ```

#### Test 5.2: Test Email Generation (Manual)
```typescript
import { generateTicketEmailHTML } from '@/lib/email-template';
import { createTicketData } from '@/lib/ticket-generator';

const ticket = await createTicketData({
  eventId: '1',
  eventImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=1200&fit=crop',
  eventName: 'Reggaeton Nights',
  eventDate: '2025-11-15',
  eventTime: '10:00 PM',
  venue: 'Maguey Nightclub',
  venueAddress: '123 Main St, Wilmington, DE 19801',
  ticketType: 'VIP Entry',
  ticketHolderName: 'Test User',
  orderId: 'test-order-123',
  price: 50.00,
});

const emailHTML = generateTicketEmailHTML([ticket], 'Test User', 'test-order-123');
console.log(emailHTML);
// Verify email HTML contains event image
```

### 6. Webhook Handler Tests

#### Test 6.1: Verify Webhook Stores event_id
1. Check `backend-example/stripe-webhook.ts`
2. Verify ticket creation includes:
   ```typescript
   event_id: order.event_id,  // ✅ Store event_id
   ```

#### Test 6.2: Verify Webhook Includes eventImage in Email
Check webhook handler includes:
```typescript
eventId: event.id,
eventImage: event.image_url || event.image || '',
```

### 7. Integration Tests

#### Test 7.1: Complete Flow Test
1. **Create Order**: Via checkout or manually
2. **Generate Tickets**: Via webhook or manually
3. **Verify Ticket**: Check database has `event_id`
4. **Scan Ticket**: Use scanner service
5. **Verify Display**: Event image shows in scanner

#### Test 7.2: Multi-Event Test
1. Create tickets for different events
2. Scan each ticket
3. Verify correct event image displays for each

### 8. Frontend Component Tests

#### Test 8.1: ScannerTicketDisplay Component
```typescript
import { ScannerTicketDisplay } from '@/components/scanner/ScannerTicketDisplay';

// Test with mock data
<ScannerTicketDisplay
  ticket={{
    ticket_id: 'MGY-PF-20251115-TEST01',
    status: 'issued',
    ticket_type_name: 'VIP Entry',
    event_name: 'Reggaeton Nights',
    event_image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=1200&fit=crop',
    event_date: '2025-11-15',
    event_time: '10:00 PM',
    venue_name: 'Maguey Nightclub',
    venue_address: '123 Main St, Wilmington, DE 19801',
    customer_first_name: 'Test',
    customer_last_name: 'User',
    expires_at: '2025-11-15T23:59:59Z',
  }}
/>
```

#### Test 8.2: Scanner Service Functions
```typescript
import { scanTicket, checkInTicket } from '@/lib/scanner-service';

// Test scan
const result = await scanTicket('MGY-PF-20251115-TEST01');
console.log(result);
// Should return ticket with event_image

// Test check-in
const checkInResult = await checkInTicket('MGY-PF-20251115-TEST01');
console.log(checkInResult);
// Should return success: true
```

## Common Issues & Solutions

### Issue: "ticket_scan_view does not exist"
**Solution**: Run migration `20250115000001_add_event_image_to_tickets.sql`

### Issue: "event_id column does not exist"
**Solution**: Run migration `20250115000001_add_event_image_to_tickets.sql`

### Issue: "Event image not displaying"
**Solution**: 
1. Verify `events.image_url` is populated
2. Check `tickets.event_id` links to correct event
3. Verify scanner query joins correctly

### Issue: "RLS blocking scanner queries"
**Solution**: 
- Use service role key for scanner
- Or create scanner-specific RLS policy

### Issue: "Event image URL is empty"
**Solution**: 
1. Run seed migration: `20250115000002_seed_events.sql`
2. Or manually update events with image URLs

## Automated Testing Script

Create a test script to verify everything:

```typescript
// test-scanner.ts
import { scanTicket } from './src/lib/scanner-service';

async function testScanner() {
  console.log('Testing scanner...');
  
  const result = await scanTicket('MGY-PF-20251115-TEST01');
  
  if (result.success && result.ticket) {
    console.log('✅ Ticket found');
    console.log('✅ Event image:', result.ticket.event_image ? 'Present' : 'Missing');
    console.log('✅ Event name:', result.ticket.event_name);
    console.log('✅ Event ID:', result.ticket.event_id);
  } else {
    console.error('❌ Ticket not found:', result.error);
  }
}

testScanner();
```

## Next Steps

After testing:
1. ✅ All tests pass
2. ✅ Event images display correctly
3. ✅ Scanner shows event context
4. ✅ Database schema is correct
5. ✅ Ready for production

## Production Checklist

- [ ] All migrations run successfully
- [ ] Events have image_url populated
- [ ] Tickets have event_id populated
- [ ] Scanner view works correctly
- [ ] Email templates include event images
- [ ] Webhook stores event_id correctly
- [ ] Scanner displays event images
- [ ] RLS policies configured correctly
- [ ] Test tickets created and verified

