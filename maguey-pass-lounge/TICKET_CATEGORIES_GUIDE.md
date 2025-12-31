# Ticket Categories System Guide

## Overview

The ticket system now supports **VIP**, **Service**, **Section**, and **General Admission** categories. This allows you to organize tickets by type and pricing tier, making it easier for customers to find what they need and for staff to manage different sections.

## Architecture

**All changes made in THIS purchase website** - Scanner website automatically syncs via shared database.

### How It Works

1. **Purchase Website** creates ticket types with categories
2. **Database** stores category information in `ticket_types` table
3. **Scanner Website** automatically reads category info from `ticket_scan_view`
4. **No scanner changes needed** - category data is automatically available

## Database Structure

### ticket_types Table

New columns added:
- `category` - 'general', 'vip', 'service', or 'section'
- `section_name` - Specific section name (e.g., 'VIP Section A', 'Bottle Service Table 1')
- `section_description` - Optional description
- `display_order` - Order for UI display (lower numbers first)

### ticket_scan_view

Updated to include:
- `ticket_category` - Category from ticket_types
- `section_name` - Section name from ticket_types
- `section_description` - Section description from ticket_types

## Category Types

### 1. General Admission (`general`)
- Regular entry tickets
- Examples: Male General Admission, Female General Admission, Expedited Entry
- Default category if not specified

### 2. VIP (`vip`)
- VIP entry with special access
- Examples: VIP Entry, VIP Section A, VIP Section B
- Displayed with yellow badge

### 3. Service (`service`)
- Bottle service, table service, reserved areas
- Examples: Bottle Service Table 1, Reserved Table Service, Premium Service Area
- Displayed with purple badge

### 4. Section (`section`)
- Specific dance floor sections or areas
- Examples: Main Dance Floor, Side Section, Balcony Access
- Displayed with blue badge

## Creating Ticket Types with Categories

### Via SQL (Supabase SQL Editor)

```sql
-- Example: Create VIP ticket type
INSERT INTO ticket_types (
  event_id,
  code,
  name,
  price,
  fee,
  limit_per_order,
  category,
  section_name,
  section_description,
  display_order
) VALUES (
  'event-id-here',
  'vip-entry',
  'VIP Entry',
  75.00,
  5.00,
  4,
  'vip',
  'VIP Section A',
  'Premium VIP area with bottle service access',
  1
);

-- Example: Create Bottle Service ticket type
INSERT INTO ticket_types (
  event_id,
  code,
  name,
  price,
  fee,
  limit_per_order,
  category,
  section_name,
  section_description,
  display_order
) VALUES (
  'event-id-here',
  'bottle-service-1',
  'Bottle Service Table 1',
  200.00,
  20.00,
  8,
  'service',
  'Bottle Service Table 1',
  'Reserved table with bottle service included',
  1
);

-- Example: Create General Admission ticket type
INSERT INTO ticket_types (
  event_id,
  code,
  name,
  price,
  fee,
  limit_per_order,
  category,
  display_order
) VALUES (
  'event-id-here',
  'male-ga',
  'Male General Admission',
  25.00,
  3.00,
  10,
  'general',
  1
);
```

## UI Display

### Event Detail Page
- Tickets grouped by category
- Category badges displayed (VIP, Service, Sections)
- Section names shown as badges
- Section descriptions displayed below ticket names
- Tickets sorted by `display_order` within each category

### Checkout Page
- Category badges for non-general tickets
- Section names displayed
- Section descriptions shown
- Tickets organized by category

### Ticket Page
- Category badge displayed (if not general)
- Section name badge
- Section description in highlighted box
- All category info visible

### Account Page
- Tickets grouped by category
- Category headers with ticket counts
- Section names displayed on tickets
- Easy to find VIP/service tickets

## Scanner Integration

### Automatic Availability

Category information is **automatically available** in your scanner website:

```typescript
// In your scanner website
const { data: ticket } = await supabase
  .from('ticket_scan_view')
  .select('*')
  .eq('ticket_id', scannedTicketId)
  .single();

// Available fields:
// ticket.ticket_category - 'general', 'vip', 'service', or 'section'
// ticket.section_name - Section name (e.g., 'VIP Section A')
// ticket.section_description - Section description
```

### Displaying Categories in Scanner

You can display category badges in your scanner UI:

```typescript
// Example scanner display
{ticket.ticket_category === 'vip' && (
  <Badge className="bg-yellow-500">VIP</Badge>
)}
{ticket.ticket_category === 'service' && (
  <Badge className="bg-purple-500">Service</Badge>
)}
{ticket.section_name && (
  <div>Section: {ticket.section_name}</div>
)}
```

## Migration Steps

### 1. Run Database Migrations

Run these migrations in Supabase SQL Editor (in order):

1. `supabase/migrations/20250302000000_add_ticket_categories.sql`
   - Adds category columns to ticket_types table
   - Creates indexes for performance

2. `supabase/migrations/20250302000001_update_scanner_view_categories.sql`
   - Updates ticket_scan_view to include category info
   - Makes categories available to scanner

### 2. Update Existing Ticket Types

If you have existing ticket types, update them with categories:

```sql
-- Update existing ticket types with categories
UPDATE ticket_types 
SET category = 'vip', 
    section_name = 'VIP Section',
    display_order = 1
WHERE name ILIKE '%vip%';

UPDATE ticket_types 
SET category = 'service',
    section_name = 'Bottle Service',
    display_order = 1
WHERE name ILIKE '%bottle%' OR name ILIKE '%service%';

UPDATE ticket_types 
SET category = 'general',
    display_order = 1
WHERE category IS NULL;
```

## Best Practices

### Category Selection

- **General**: Use for standard entry tickets (male/female/expedited)
- **VIP**: Use for premium entry with special access
- **Service**: Use for bottle service, table reservations, premium areas
- **Section**: Use for specific dance floor sections or areas

### Section Names

- Be descriptive: "VIP Section A" not just "VIP"
- Be consistent: Use same naming convention across events
- Keep it short: Section names appear in badges

### Display Order

- Lower numbers display first
- VIP typically: 1-10
- Service typically: 11-20
- Sections typically: 21-30
- General typically: 31+

### Pricing

- Different categories can have different pricing
- Service tickets typically highest price
- VIP tickets typically mid-high price
- General tickets typically lowest price

## Example Event Setup

```sql
-- Event: Reggaeton Nights
-- Event ID: 'reggaeton-nights-2025-03-15'

-- General Admission Tickets
INSERT INTO ticket_types (event_id, code, name, price, fee, category, display_order) VALUES
('reggaeton-nights-2025-03-15', 'male-ga', 'Male General Admission', 25.00, 3.00, 'general', 1),
('reggaeton-nights-2025-03-15', 'female-ga', 'Female General Admission', 20.00, 3.00, 'general', 2),
('reggaeton-nights-2025-03-15', 'expedited', 'Expedited Entry', 35.00, 3.00, 'general', 3);

-- VIP Tickets
INSERT INTO ticket_types (event_id, code, name, price, fee, category, section_name, section_description, display_order) VALUES
('reggaeton-nights-2025-03-15', 'vip-entry', 'VIP Entry', 75.00, 5.00, 'vip', 'VIP Section', 'Premium VIP area with expedited entry', 1),
('reggaeton-nights-2025-03-15', 'vip-section-a', 'VIP Section A', 100.00, 5.00, 'vip', 'VIP Section A', 'Front VIP section with best views', 2);

-- Service Tickets
INSERT INTO ticket_types (event_id, code, name, price, fee, category, section_name, section_description, display_order) VALUES
('reggaeton-nights-2025-03-15', 'bottle-table-1', 'Bottle Service Table 1', 200.00, 20.00, 'service', 'Bottle Service Table 1', 'Reserved table with bottle service included', 1),
('reggaeton-nights-2025-03-15', 'bottle-table-2', 'Bottle Service Table 2', 200.00, 20.00, 'service', 'Bottle Service Table 2', 'Reserved table with bottle service included', 2);

-- Section Tickets
INSERT INTO ticket_types (event_id, code, name, price, fee, category, section_name, section_description, display_order) VALUES
('reggaeton-nights-2025-03-15', 'main-floor', 'Main Dance Floor', 30.00, 3.00, 'section', 'Main Floor', 'Access to main dance floor area', 1),
('reggaeton-nights-2025-03-15', 'balcony', 'Balcony Access', 40.00, 3.00, 'section', 'Balcony', 'Elevated balcony with great views', 2);
```

## Testing

### Test Category Display

1. Create ticket types with different categories
2. View event detail page - verify tickets grouped by category
3. Go through checkout - verify category badges display
4. Purchase tickets - verify category info saved
5. View ticket page - verify category badges and section info
6. Check account page - verify tickets grouped by category

### Test Scanner Integration

1. Purchase tickets with different categories
2. Go to scanner website
3. Scan ticket QR code
4. Verify `ticket_category` field available
5. Verify `section_name` field available
6. Display category badge in scanner UI

## Troubleshooting

### Categories Not Displaying

- Verify migrations ran successfully
- Check `ticket_types` table has `category` column
- Verify ticket types have `category` set (not NULL)
- Check browser console for errors

### Scanner Not Seeing Categories

- Verify `ticket_scan_view` updated (run migration 2)
- Check `ticket_type_id` exists on tickets
- Verify JOIN in view works: `LEFT JOIN ticket_types tt ON t.ticket_type_id = tt.id`
- Test query: `SELECT ticket_category FROM ticket_scan_view LIMIT 1;`

### Tickets Not Grouping

- Verify `category` column populated in `ticket_types`
- Check `display_order` set correctly
- Verify UI code updated (EventDetail.tsx, Checkout.tsx, Account.tsx)

## Summary

✅ **Categories Added**: VIP, Service, Section, General  
✅ **Database Updated**: ticket_types table has category columns  
✅ **Scanner View Updated**: Categories available in ticket_scan_view  
✅ **UI Updated**: All pages display categories  
✅ **Scanner Ready**: Category info automatically available  
✅ **No Scanner Changes Needed**: Scanner reads from database

All category management happens in THIS purchase website. Scanner website automatically syncs via shared database!

