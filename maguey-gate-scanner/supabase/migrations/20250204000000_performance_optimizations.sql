-- Migration: Performance Optimizations
-- Date: 2025-02-04
-- Purpose: Fix performance issues identified in comprehensive analysis
-- 
-- Changes:
-- 1. Add missing foreign key indexes
-- 2. Remove duplicate indexes
-- 3. Add composite indexes for common queries
-- 4. Optimize RLS policies (moved to separate migration for clarity)

-- ============================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================

-- branding_sync.synced_by foreign key index
CREATE INDEX IF NOT EXISTS idx_branding_sync_synced_by 
ON public.branding_sync(synced_by)
WHERE synced_by IS NOT NULL;

-- cross_site_sync_log.synced_by foreign key index
CREATE INDEX IF NOT EXISTS idx_cross_site_sync_log_synced_by 
ON public.cross_site_sync_log(synced_by)
WHERE synced_by IS NOT NULL;

-- scan_history.scanned_by foreign key index
CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_by 
ON public.scan_history(scanned_by)
WHERE scanned_by IS NOT NULL;

-- scan_history.user_id foreign key index
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id 
ON public.scan_history(user_id)
WHERE user_id IS NOT NULL;

-- ============================================
-- 2. REMOVE DUPLICATE INDEXES
-- ============================================

-- Remove duplicate index on events.event_date (keep idx_events_event_date)
DROP INDEX IF EXISTS public.idx_events_date;

-- ============================================
-- 3. ADD COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================

-- Waitlist queries: event_name + ticket_type + status (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waitlist') THEN
    CREATE INDEX IF NOT EXISTS idx_waitlist_event_ticket_status 
    ON public.waitlist(event_name, ticket_type, status)
    WHERE status IN ('waiting', 'notified');
  END IF;
END $$;

-- Events filtering: status + is_active (for published events)
CREATE INDEX IF NOT EXISTS idx_events_status_active 
ON public.events(status, is_active)
WHERE status = 'published' AND is_active = true;

-- Orders: purchaser_email + created_at (for user order queries)
CREATE INDEX IF NOT EXISTS idx_orders_email_created 
ON public.orders(purchaser_email, created_at DESC);

-- Tickets: event_id + status (for event ticket queries)
CREATE INDEX IF NOT EXISTS idx_tickets_event_status 
ON public.tickets(event_id, status)
WHERE status IN ('issued', 'used', 'scanned');

-- Tickets: qr_token lookup (for scanner)
CREATE INDEX IF NOT EXISTS idx_tickets_qr_token_lookup 
ON public.tickets(qr_token)
WHERE qr_token IS NOT NULL;

-- Ticket types: event_id + code (for availability queries)
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_code 
ON public.ticket_types(event_id, code);

-- ============================================
-- 4. ADD INDEXES FOR FREQUENTLY QUERIED COLUMNS
-- ============================================

-- Events: name lookup (for event name searches)
CREATE INDEX IF NOT EXISTS idx_events_name_lookup 
ON public.events(name);

-- Events: event_date for sorting
CREATE INDEX IF NOT EXISTS idx_events_date_sort 
ON public.events(event_date ASC)
WHERE is_active = true AND status = 'published';

-- Orders: event_id for event order queries
CREATE INDEX IF NOT EXISTS idx_orders_event_id_lookup 
ON public.orders(event_id);

-- Tickets: order_id for order ticket queries
CREATE INDEX IF NOT EXISTS idx_tickets_order_id_lookup 
ON public.tickets(order_id);

-- Tickets: ticket_type_id for availability checks
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type_lookup 
ON public.tickets(ticket_type_id, status)
WHERE status IN ('issued', 'used', 'scanned');

-- ============================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON INDEX idx_waitlist_event_ticket_status IS 
'Optimizes waitlist queries filtering by event, ticket type, and status';

COMMENT ON INDEX idx_events_status_active IS 
'Optimizes queries for published active events';

COMMENT ON INDEX idx_tickets_qr_token_lookup IS 
'Optimizes QR code lookups in scanner';

COMMENT ON INDEX idx_tickets_event_status IS 
'Optimizes event ticket queries by status';

