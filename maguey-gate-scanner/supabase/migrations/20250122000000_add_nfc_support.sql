-- Migration: Add NFC Support for Ticket Scanning
-- This migration adds NFC-related columns and scan method tracking

-- ============================================
-- 1. ADD NFC FIELDS TO TICKETS TABLE
-- ============================================
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS nfc_tag_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS nfc_signature text;

-- Create index for faster NFC tag lookups
CREATE INDEX IF NOT EXISTS idx_tickets_nfc_tag_id ON public.tickets(nfc_tag_id);

-- ============================================
-- 2. ADD SCAN METHOD TO SCAN_LOGS TABLE
-- ============================================
ALTER TABLE public.scan_logs 
  ADD COLUMN IF NOT EXISTS scan_method text DEFAULT 'qr' CHECK (scan_method IN ('qr', 'nfc', 'manual'));

-- Create index for scan method queries
CREATE INDEX IF NOT EXISTS idx_scan_logs_scan_method ON public.scan_logs(scan_method);

-- Add comment for documentation
COMMENT ON COLUMN public.tickets.nfc_tag_id IS 'Unique NFC tag identifier for NFC-enabled tickets';
COMMENT ON COLUMN public.tickets.nfc_signature IS 'NFC signature for ticket validation (optional)';
COMMENT ON COLUMN public.scan_logs.scan_method IS 'Method used to scan the ticket: qr, nfc, or manual';

