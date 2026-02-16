# Purchase Site Integration Guide

## ✅ Integration Complete!

Your scanner is now connected to the same Supabase database as your purchase site.

## 📋 Required Ticket Fields

When creating tickets in your purchase site, ensure these columns are populated:

### Core Fields (Required by Scanner)
```javascript
{
  // Primary identifier - must match qr_code_value
  ticket_id: "MGY-1B-20251112-FCA98E4B-V2RL",
  
  // Event info
  event_name: "New Years Eve 2025 Celebration",  // Event name from events table
  ticket_type: "General Admission",               // Ticket type name from ticket_types table
  
  // Guest info
  guest_name: "luis don",                         // Customer name
  guest_email: "luismbadillo13@gmail.com",       // Customer email
  
  // QR code data (same as ticket_id)
  qr_code_data: "MGY-1B-20251112-FCA98E4B-V2RL", // QR code content
  
  // Status flags
  is_used: false,                                 // Boolean - false when issued
  status: "issued",                               // "issued", "scanned", "refunded"
  
  // Timestamps
  purchase_date: "2025-01-12T10:30:00Z",         // ISO timestamp
  scanned_at: null,                               // Will be populated by scanner
}
```

### Existing Fields (Already in Your Schema)
```javascript
{
  // UUID fields
  id: "uuid",                    // Primary key
  order_id: "uuid",              // Order reference
  ticket_type_id: "uuid",        // Foreign key to ticket_types
  event_id: "uuid",              // Foreign key to events
  
  // QR fields
  qr_code_value: "string",       // SAME as ticket_id
  qr_token: "uuid",              // Token for QR verification
  qr_signature: "string",        // Security signature
  
  // Attendee fields
  attendee_name: "string",       // SAME as guest_name
  attendee_email: "string",      // SAME as guest_email
  
  // Pricing
  price: 75.00,                  // Ticket price
  fee_total: 7.50,               // Fees
  
  // Timestamps
  issued_at: "timestamp",        // When ticket was created
  created_at: "timestamp",
  updated_at: "timestamp",
}
```

## 🔄 Update Your Purchase Site Code

When creating tickets, populate **both** the old and new fields:

```javascript
// Example: Creating a ticket in your purchase site
const ticket = await supabase.from('tickets').insert({
  // UUID fields
  id: generatedUUID,
  order_id: orderUUID,
  ticket_type_id: ticketTypeUUID,
  event_id: eventUUID,
  
  // QR fields
  qr_code_value: ticketIdString,
  qr_token: qrTokenUUID,
  qr_signature: generatedSignature,
  
  // Attendee fields (legacy)
  attendee_name: customerName,
  attendee_email: customerEmail,
  
  // ✨ NEW FIELDS FOR SCANNER (add these!)
  ticket_id: ticketIdString,           // ← Same as qr_code_value
  event_name: eventNameString,         // ← From events.name (not just ID)
  ticket_type: ticketTypeString,       // ← From ticket_types.name (not just ID)
  guest_name: customerName,            // ← Same as attendee_name
  guest_email: customerEmail,          // ← Same as attendee_email
  qr_code_data: ticketIdString,        // ← Same as ticket_id
  is_used: false,                      // ← Always false when creating
  status: 'issued',                    // ← Default status
  purchase_date: new Date().toISOString(),
  
  // Pricing
  price: priceAmount,
  fee_total: feeAmount,
  
  // Timestamps
  issued_at: new Date().toISOString(),
})
```

## 🧪 Test Ticket (Already Working!)

Your test ticket is ready:
- **Ticket ID**: `MGY-1B-20251112-FCA98E4B-V2RL`
- **Event**: New Years Eve 2025 Celebration
- **Type**: General Admission
- **Guest**: luis don
- **Email**: luismbadillo13@gmail.com
- **Status**: ✅ Ready to scan

## 📱 How to Test in Scanner

1. **Open scanner app**: http://localhost:5173
2. **Log in** (or use Demo Login)
3. **Go to Scanner page**
4. **Manual Entry**: Enter `MGY-1B-20251112-FCA98E4B-V2RL`
5. **Should show**: ✅ "Entry granted - Welcome!"

## 🔍 Troubleshooting

### "Invalid ticket" error
- Check if `ticket_id` column is populated
- Verify `event_name` and `ticket_type` are set (not just IDs)
- Ensure `is_used` is `false` and `status` is `"issued"`

### "Already scanned" error
- Check `is_used` field - should be `false`
- Check `status` field - should be `"issued"` not `"scanned"`

### QR code not working
- Verify QR code contains the `ticket_id` value (not a URL or JSON)
- The QR should contain ONLY the string: `MGY-1B-20251112-FCA98E4B-V2RL`

## 📊 Database Schema Applied

The following columns were added to your `tickets` table:
- `ticket_id` (text, unique)
- `event_name` (text)
- `ticket_type` (text)
- `guest_name` (text)
- `guest_email` (text)
- `qr_code_data` (text)
- `is_used` (boolean, default false)
- `purchase_date` (timestamp)

Plus additional optional columns for advanced features:
- `guest_phone` (text)
- `price_paid` (numeric)
- `scanned_by` (uuid)
- `stripe_payment_id` (text)
- `metadata` (jsonb)

## 🎯 Next Steps

1. ✅ Schema applied
2. ✅ Test ticket verified
3. 🔄 Update purchase site to populate new columns
4. 🧪 Test end-to-end: Purchase → Scan
5. 🚀 Deploy to production

## 📞 Support

If tickets still aren't scanning:
1. Check Supabase logs for errors
2. Verify all required columns are populated
3. Test with manual entry first (before QR scanning)
4. Check browser console for error messages

