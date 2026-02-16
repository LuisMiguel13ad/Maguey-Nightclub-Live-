-- Migration: Add Staff Shifts Table
-- This migration creates the staff_shifts table for shift management

CREATE TABLE IF NOT EXISTS public.staff_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  shift_start timestamp with time zone NOT NULL,
  shift_end timestamp with time zone NOT NULL,
  role text NOT NULL DEFAULT 'scanner',
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_shifts_event_id ON public.staff_shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_user_id ON public.staff_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_shift_start ON public.staff_shifts(shift_start);

-- Enable RLS
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view shifts"
  ON public.staff_shifts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage shifts"
  ON public.staff_shifts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.user_metadata->>'role' = 'owner' OR auth.users.app_metadata->>'role' = 'owner')
    )
  );

COMMENT ON TABLE public.staff_shifts IS 'Staff shift assignments for events';


