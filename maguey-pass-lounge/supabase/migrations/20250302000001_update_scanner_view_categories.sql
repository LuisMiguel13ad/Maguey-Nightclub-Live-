-- Migration: Update ticket_scan_view to include category and section information
-- This makes category data available to scanner website automatically

BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS ticket_scan_view;

-- Recreate view with category and section information
CREATE OR REPLACE VIEW ticket_scan_view AS
SELECT 
  -- Ticket fields (scanner searches by these)
  t.id,
  t.qr_token,                    -- ← Scanner searches by THIS (UUID)
  t.ticket_id,                   -- Human-readable ID (display only)
  t.order_id,
  t.event_id,                    -- ← UUID foreign key to events table
  t.ticket_type_id,              -- ← UUID foreign key to ticket_types table
  t.attendee_name,               -- ← Scanner expects this field name
  t.attendee_email,
  -- Legacy fields (for backward compatibility)
  t.ticket_type,                 -- Text field (deprecated, use ticket_type_id)
  t.ticket_type_name,            -- Text field (deprecated, use ticket_types.name)
  t.status,
  t.price,
  COALESCE(t.fee, t.fee_total, 0) AS fee,
  t.total,
  t.issued_at,
  t.checked_in_at,
  t.expires_at,
  t.created_at,
  t.updated_at,
  -- Event information
  e.name AS event_name,
  e.image_url AS event_image,
  COALESCE(e.event_date, e.date) AS event_date,
  COALESCE(e.event_time, e.time) AS event_time,
  e.venue_name,
  e.venue_address,
  e.city,
  -- Order information (handle both purchaser_* and customer_* column names)
  COALESCE(
    o.purchaser_email,
    o.customer_email
  ) AS customer_email,
  COALESCE(
    SPLIT_PART(o.purchaser_name, ' ', 1),
    o.customer_first_name
  ) AS customer_first_name,
  COALESCE(
    CASE 
      WHEN o.purchaser_name IS NOT NULL AND POSITION(' ' IN o.purchaser_name) > 0 
      THEN SUBSTRING(o.purchaser_name FROM POSITION(' ' IN o.purchaser_name) + 1)
      ELSE NULL
    END,
    o.customer_last_name
  ) AS customer_last_name,
  o.total AS order_total,
  -- Ticket type category information (from ticket_types table if ticket_type_id exists)
  COALESCE(tt.category, 'general') AS ticket_category,
  tt.section_name,
  tt.section_description,
  tt.name AS ticket_type_full_name,
  -- Additional ticket fields for scanner compatibility
  t.attendee_name AS guest_name,      -- Alias for backward compatibility
  t.attendee_email AS guest_email,    -- Alias for backward compatibility
  t.qr_code_value AS qr_code_data,    -- QR code data (contains qr_token)
  (t.status = 'checked_in' OR t.status = 'scanned') AS is_used,
  t.issued_at AS purchase_date
FROM tickets t
JOIN events e ON t.event_id = e.id
JOIN orders o ON t.order_id = o.id
LEFT JOIN ticket_types tt ON t.ticket_type_id = tt.id;

-- Add comment
COMMENT ON VIEW ticket_scan_view IS 'View for scanner to quickly access ticket with event image, category, and section details';

COMMIT;

