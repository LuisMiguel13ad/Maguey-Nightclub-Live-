# Scanner Integration Summary

## ✅ Integration Status: COMPLETE

Your ticket scanner website is **already integrated** with this ticket purchase website. No additional setup needed!

## How It Works

Both websites share the **same Supabase database**. When tickets are purchased here, they automatically become available in your scanner website.

```
Ticket Purchase Website (This Site)
    ↓
  Creates Tickets in Database
    ↓
  Shared Supabase Database
    ↓
Your Scanner Website (Separate Site)
    ↓
  Reads Tickets from Database
    ↓
  Displays Event Images & Validates Tickets
```

## Database Connection

Both sites use the same Supabase project:

```typescript
// Same configuration in both websites
const supabase = createClient(
  process.env.SUPABASE_URL,      // Same URL
  process.env.SUPABASE_ANON_KEY   // Same anon key
);
```

## Scanner Queries

Your scanner website should query the `ticket_scan_view`:

```typescript
// In your scanner website
const { data: ticket, error } = await supabase
  .from('ticket_scan_view')
  .select('*')
  .eq('ticket_id', scannedTicketId)
  .single();

// Returns ticket with:
// - ticket.event_image (Event image URL)
// - ticket.event_name (Event name)
// - ticket.event_date, ticket.event_time
// - ticket.venue_name, ticket.venue_address
// - All ticket details
// - Customer information
```

## Reference Files

Reference implementations are available in this repo (for your scanner website):

- `src/lib/scanner-service.ts` - Scanner service functions
- `src/components/scanner/ScannerTicketDisplay.tsx` - UI component example

**Note:** These files are examples only - they are not used in this purchase site. You can copy them to your scanner website.

## Data Flow

### Purchase Flow
1. Customer purchases ticket on **this website**
2. Order created in `orders` table
3. Tickets created in `tickets` table with `event_id`
4. Tickets immediately available in database

### Scanner Flow
1. Staff scans QR code on **your scanner website**
2. QR code contains `ticket_id` (e.g., "MGY-PF-20251115-ABC123")
3. Scanner queries `ticket_scan_view` with `ticket_id`
4. Returns ticket with event image and all details
5. Staff validates and checks in ticket
6. Ticket status updated to `checked_in`

## Event Images

Event images are automatically included:

- Events stored with `image_url` in `events` table
- Tickets linked to events via `event_id`
- Scanner view (`ticket_scan_view`) joins tickets with events
- Event image available as `ticket.event_image` in scanner

## Real-Time Synchronization

- ✅ New tickets appear immediately after purchase
- ✅ Check-ins update in real-time
- ✅ Event updates sync automatically
- ✅ No API calls needed between sites
- ✅ No delay or synchronization issues

## Testing Integration

### Test Purchase Flow
1. Purchase a ticket on this website
2. Note the `ticket_id` from the ticket page
3. Go to your scanner website
4. Scan the QR code or enter `ticket_id`
5. Verify event image displays
6. Verify ticket details are correct

### Test Scanner Query
```sql
-- In Supabase SQL Editor
SELECT * FROM ticket_scan_view 
WHERE ticket_id = 'YOUR-TICKET-ID';
-- Should return ticket with event_image
```

## Security

### Row Level Security (RLS)
- **Events**: Public read access
- **Orders**: Users see only their own orders
- **Tickets**: Users see only their own tickets

### For Scanner Website
Your scanner website should use **service role key** (bypasses RLS) or create scanner-specific policies:

```typescript
// Scanner website should use service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Service role key
);
```

## Summary

✅ **No Integration Needed** - Already connected via shared database  
✅ **Event Images** - Automatically available via `ticket_scan_view`  
✅ **Real-Time Sync** - Changes appear immediately  
✅ **Scanner Compatible** - Tickets formatted for scanner use  
✅ **Ready to Use** - Purchase tickets here, scan them there

## Next Steps

1. ✅ Verify scanner website connects to same Supabase database
2. ✅ Use `ticket_scan_view` for ticket queries
3. ✅ Display `event_image` when scanning tickets
4. ✅ Test end-to-end flow (purchase → scan)

## Support

If you need help:
- Check `SCANNER_WEBSITE_INTEGRATION.md` for detailed guide
- Review `src/lib/scanner-service.ts` for reference implementation
- Verify database connection in both sites
- Check `ticket_scan_view` exists in Supabase

