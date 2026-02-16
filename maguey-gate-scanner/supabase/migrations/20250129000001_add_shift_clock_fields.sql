-- Migration: Add Clock In/Out Fields to Staff Shifts
-- This migration adds clock_in_at and clocked_out_at fields for shift tracking

ALTER TABLE public.staff_shifts
  ADD COLUMN IF NOT EXISTS clocked_in_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS clocked_out_at timestamp with time zone;

-- Create index for faster queries on active shifts
CREATE INDEX IF NOT EXISTS idx_staff_shifts_clocked_out ON public.staff_shifts(clocked_out_at)
  WHERE clocked_out_at IS NULL;

COMMENT ON COLUMN public.staff_shifts.clocked_in_at IS 'When the staff member clocked in for this shift';
COMMENT ON COLUMN public.staff_shifts.clocked_out_at IS 'When the staff member clocked out from this shift';

