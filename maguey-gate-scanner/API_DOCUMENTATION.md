# API Documentation

## Overview

This document describes the API endpoints available for integrating with the Maguey Ticket Scanner System. All endpoints are hosted as Supabase Edge Functions.

## Base URL

```
https://<your-project>.supabase.co/functions/v1
```

## Authentication

Most endpoints require authentication via the `apikey` header:

```
apikey: <your-supabase-anon-key>
```

Some endpoints (like webhooks) may require additional authentication via the `authorization` header:

```
authorization: Bearer <webhook-secret>
```

## Endpoints

### 1. Get Event Availability

Get real-time ticket availability for an event.

**Endpoint:** `GET /event-availability/:eventName`

**Parameters:**
- `eventName` (path parameter) - Name of the event

**Query Parameters:**
- `event_name` (optional) - Alternative way to specify event name

**Response:**
```json
{
  "event": {
    "id": "uuid",
    "name": "Perreo Fridays",
    "event_date": "2025-01-15T21:00:00Z",
    "is_active": true,
    "venue_capacity": 500
  },
  "availability": [
    {
      "name": "VIP",
      "price": 50.00,
      "capacity": 100,
      "sold": 75,
      "scanned": 45,
      "available": 25,
      "sold_out": false
    },
    {
      "name": "General Admission",
      "price": 25.00,
      "capacity": 400,
      "sold": 350,
      "scanned": 200,
      "available": 50,
      "sold_out": false
    }
  ],
  "summary": {
    "total_capacity": 500,
    "total_sold": 425,
    "total_scanned": 245,
    "total_available": 75,
    "is_sold_out": false
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Example:**
```bash
curl -X GET \
  "https://your-project.supabase.co/functions/v1/event-availability/Perreo%20Fridays" \
  -H "apikey: your-anon-key"
```

### 2. Create Tickets (Webhook)

Create tickets from the purchase site after payment.

**Endpoint:** `POST /ticket-webhook`

**Headers:**
- `Content-Type: application/json`
- `apikey: <your-anon-key>`
- `authorization: Bearer <webhook-secret>` (optional but recommended)

**Request Body:**
```json
{
  "tickets": [
    {
      "ticket_id": "MGY-PF-20250115-ABC123",
      "event_name": "Perreo Fridays",
      "ticket_type": "VIP",
      "guest_name": "John Doe",
      "guest_email": "john@example.com",
      "guest_phone": "+1234567890",
      "qr_code_data": "MGY-PF-20250115-ABC123",
      "order_id": "order-uuid",
      "price_paid": 50.00,
      "stripe_payment_id": "pi_xxx",
      "purchase_date": "2025-01-15T10:30:00Z",
      "metadata": {
        "custom_field": "value"
      }
    }
  ]
}
```

**Required Fields:**
- `ticket_id` - Unique ticket identifier
- `event_name` - Name of the event (must match event in database)
- `ticket_type` - Type of ticket (e.g., "VIP", "General Admission")

**Optional Fields:**
- `guest_name` - Customer name
- `guest_email` - Customer email
- `guest_phone` - Customer phone
- `qr_code_data` - QR code content (defaults to ticket_id)
- `order_id` - Order UUID
- `price_paid` - Ticket price
- `stripe_payment_id` - Stripe payment intent ID
- `purchase_date` - ISO timestamp (defaults to now)
- `metadata` - Additional JSON data

**Response:**
```json
{
  "success": true,
  "tickets_created": 1,
  "tickets": [
    {
      "id": "ticket-uuid",
      "ticket_id": "MGY-PF-20250115-ABC123",
      "event_name": "Perreo Fridays",
      "ticket_type": "VIP",
      "status": "issued",
      "is_used": false,
      ...
    }
  ]
}
```

**Error Responses:**
- `400` - Missing required fields
- `401` - Unauthorized (invalid webhook secret)
- `409` - Duplicate ticket_id
- `500` - Server error

**Example:**
```bash
curl -X POST \
  "https://your-project.supabase.co/functions/v1/ticket-webhook" \
  -H "Content-Type: application/json" \
  -H "apikey: your-anon-key" \
  -H "authorization: Bearer your-webhook-secret" \
  -d '{
    "tickets": [{
      "ticket_id": "MGY-PF-20250115-ABC123",
      "event_name": "Perreo Fridays",
      "ticket_type": "VIP",
      "guest_name": "John Doe",
      "guest_email": "john@example.com"
    }]
  }'
```

### 3. Get Order Tickets

Retrieve all tickets for a specific order.

**Endpoint:** `GET /order-tickets/:orderId`

**Parameters:**
- `orderId` (path parameter) - Order UUID

**Query Parameters:**
- `order_id` (optional) - Alternative way to specify order ID

**Response:**
```json
{
  "order_id": "order-uuid",
  "order": {
    "id": "order-uuid",
    "stripe_payment_intent_id": "pi_xxx",
    "customer_email": "john@example.com",
    "total_amount": 100.00,
    "status": "completed",
    ...
  },
  "tickets": [
    {
      "id": "ticket-uuid",
      "ticket_id": "MGY-PF-20250115-ABC123",
      "event_name": "Perreo Fridays",
      "ticket_type": "VIP",
      "status": "issued",
      "scanned_at": null,
      ...
    }
  ],
  "ticket_count": 2,
  "scanned_count": 0,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Example:**
```bash
curl -X GET \
  "https://your-project.supabase.co/functions/v1/order-tickets/order-uuid" \
  -H "apikey: your-anon-key"
```

## Integration Guide

### Purchase Site Integration

1. **After Payment Success:**
   - Call `/ticket-webhook` with ticket data
   - Store the returned ticket IDs
   - Send confirmation email to customer

2. **Check Availability:**
   - Call `/event-availability/:eventName` before showing purchase options
   - Display real-time availability to customers
   - Poll periodically or use real-time subscriptions

3. **Order Lookup:**
   - Call `/order-tickets/:orderId` to retrieve tickets for an order
   - Display ticket status (scanned/not scanned) to customers

### Real-time Updates

The scanner system uses Supabase real-time subscriptions. You can subscribe to ticket updates:

```typescript
import { supabase } from '@supabase/supabase-js';

const channel = supabase
  .channel('ticket-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'tickets',
    filter: 'order_id=eq.your-order-id'
  }, (payload) => {
    console.log('Ticket updated:', payload.new);
  })
  .subscribe();
```

## Error Handling

All endpoints return standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `500` - Internal Server Error

Error responses include a JSON body:
```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

## Rate Limiting

Currently, there are no rate limits enforced, but please use reasonable request rates. For high-volume scenarios, consider:

- Batching ticket creation requests
- Caching availability data
- Using real-time subscriptions instead of polling

## Security

1. **Webhook Secret:** Set `TICKET_WEBHOOK_SECRET` environment variable in Supabase to require authentication for webhook endpoints.

2. **API Keys:** Never expose service role keys in client-side code. Use anon keys for public endpoints.

3. **CORS:** Endpoints allow CORS from any origin. For production, consider restricting CORS origins.

## Testing

Test endpoints using:

1. **Supabase Dashboard:** Use the Edge Functions interface to test functions
2. **curl:** Use command-line tools as shown in examples
3. **Postman/Insomnia:** Import endpoints for easier testing
4. **Integration Tests:** Use the provided TypeScript service (`purchase-site-integration.ts`)

## Support

For issues or questions:
1. Check Supabase function logs in the dashboard
2. Verify database schema matches expected structure
3. Ensure environment variables are set correctly
4. Check CORS headers if calling from browser


