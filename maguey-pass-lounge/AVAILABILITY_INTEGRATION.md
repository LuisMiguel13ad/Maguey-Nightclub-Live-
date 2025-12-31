# Real-Time Availability Integration

This document explains how the ticket purchase website integrates with your scanner website API to display real-time ticket availability.

## Overview

The ticket purchase website can now fetch real-time availability data from your scanner website's API endpoint. This allows customers to see:
- How many tickets are available for each ticket type
- Sold out status
- Low stock warnings (≤5 tickets remaining)
- Total sold vs. total capacity

## Setup

### 1. Environment Variable

Add the scanner API URL to your `.env` file:

```bash
VITE_SCANNER_API_URL=https://scanner-api.com
```

**Note:** This is optional. If not configured, the website will work normally without availability checks.

### 2. Scanner API Endpoint

Your scanner website must expose an endpoint at:

```
GET /functions/v1/event-availability/{eventName}
```

Where `{eventName}` is the URL-encoded event name.

### Expected API Response Format

```json
{
  "eventName": "Reggaeton Nights",
  "ticketTypes": [
    {
      "ticketTypeCode": "VIP-001",
      "available": 15,
      "total": 50,
      "sold": 35
    },
    {
      "ticketTypeCode": "GEN-001",
      "available": 0,
      "total": 100,
      "sold": 100
    }
  ]
}
```

**Field Descriptions:**
- `eventName`: The exact event name (must match the event name in your database)
- `ticketTypes`: Array of availability for each ticket type
  - `ticketTypeCode`: Must match the `code` field in your `ticket_types` table
  - `available`: Number of tickets still available
  - `total`: Total capacity for this ticket type
  - `sold`: Number of tickets already sold

## How It Works

### 1. Event Detail Page (`/event/:eventId`)

When a user views an event:
1. The page fetches event data from Supabase
2. It calls the scanner API to get real-time availability
3. Each ticket type displays:
   - **Green badge**: "X left" (if available > 5)
   - **Orange badge**: "X left" (if available ≤ 5)
   - **Red badge**: "Sold Out" (if available = 0)
   - **Sold count**: "X of Y sold" (if total > 0)
4. Sold-out tickets are disabled and grayed out

### 2. Checkout Page (`/checkout`)

When selecting tickets:
1. Availability is fetched and displayed for each ticket type
2. Users cannot select more tickets than available
3. Sold-out tickets cannot be added to cart
4. Quantity selectors respect availability limits

## Implementation Details

### Service Function

The `getEventAvailability()` function in `src/lib/events-service.ts`:
- Fetches availability from scanner API
- Handles errors gracefully (falls back to no availability if API fails)
- Returns `null` if scanner API URL is not configured

### Matching Ticket Types

Availability is matched using the `code` field from the `ticket_types` table:
- Each ticket type has a unique `code` (e.g., "VIP-001", "GEN-001")
- The scanner API returns `ticketTypeCode` which must match this `code`
- If no match is found, the ticket type shows no availability badge

## Error Handling

The integration is designed to be resilient:
- **No API URL configured**: Works normally, no availability shown
- **API request fails**: Logs warning, continues without availability
- **Invalid response format**: Logs warning, continues without availability
- **Network error**: Logs warning, continues without availability

This ensures the website always works, even if the scanner API is temporarily unavailable.

## Testing

### Test Without Scanner API

1. Don't set `VITE_SCANNER_API_URL`
2. Website works normally
3. No availability badges shown

### Test With Scanner API

1. Set `VITE_SCANNER_API_URL=https://your-scanner-api.com`
2. Ensure your scanner API endpoint returns the correct format
3. Verify ticket types have matching `code` values
4. Check that availability badges appear correctly

### Test Sold Out Status

1. Set availability to 0 for a ticket type
2. Verify "Sold Out" badge appears
3. Verify ticket cannot be selected
4. Verify button is disabled

## Scanner API Implementation Example

Here's an example implementation for your scanner website:

```typescript
// Example scanner API endpoint handler
export async function getEventAvailability(eventName: string) {
  // 1. Find event by name
  const { data: event } = await supabase
    .from('events')
    .select('id, name')
    .eq('name', decodeURIComponent(eventName))
    .single();

  if (!event) {
    return { eventName, ticketTypes: [] };
  }

  // 2. Get all ticket types for this event
  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('id, code, total_inventory')
    .eq('event_id', event.id);

  // 3. Count sold tickets for each type
  const availability = await Promise.all(
    ticketTypes.map(async (type) => {
      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('ticket_type_id', type.id)
        .eq('status', 'issued');

      const sold = count || 0;
      const total = type.total_inventory || 0;
      const available = Math.max(0, total - sold);

      return {
        ticketTypeCode: type.code,
        available,
        total,
        sold,
      };
    })
  );

  return {
    eventName: event.name,
    ticketTypes: availability,
  };
}
```

## Benefits

1. **Real-Time Updates**: Customers see current availability
2. **Prevent Overselling**: Cannot purchase sold-out tickets
3. **Better UX**: Clear visual indicators for availability
4. **Inventory Management**: Helps manage capacity across both sites

## Notes

- Availability is fetched once when the page loads
- For real-time updates, refresh the page or implement polling
- The scanner API should cache results appropriately to avoid database overload
- Consider rate limiting the availability endpoint

