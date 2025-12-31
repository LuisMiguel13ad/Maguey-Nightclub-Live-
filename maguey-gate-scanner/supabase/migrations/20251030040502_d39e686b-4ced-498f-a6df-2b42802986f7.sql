-- Create tickets table for Maguey Nightclub
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id text NOT NULL UNIQUE,
  event_name text NOT NULL,
  ticket_type text NOT NULL,
  purchase_date timestamp with time zone NOT NULL DEFAULT now(),
  is_used boolean NOT NULL DEFAULT false,
  scanned_at timestamp with time zone,
  scanned_by uuid REFERENCES auth.users(id),
  guest_name text,
  guest_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create scan_logs table for audit trail
CREATE TABLE public.scan_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  scanned_by uuid REFERENCES auth.users(id),
  scan_result text NOT NULL,
  scanned_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb
);

-- Enable Row Level Security
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated staff to view and update tickets
CREATE POLICY "Staff can view all tickets"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can update ticket status"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for scan logs
CREATE POLICY "Staff can view all scan logs"
  ON public.scan_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert scan logs"
  ON public.scan_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert sample tickets for testing
INSERT INTO public.tickets (ticket_id, event_name, ticket_type, guest_name, guest_email) VALUES
  ('MGY-2025-001', 'Friday Night Sessions', 'VIP', 'Alex Rivera', 'alex@example.com'),
  ('MGY-2025-002', 'Friday Night Sessions', 'General Admission', 'Sam Chen', 'sam@example.com'),
  ('MGY-2025-003', 'Saturday Fiesta', 'VIP', 'Jordan Martinez', 'jordan@example.com'),
  ('MGY-2025-004', 'Saturday Fiesta', 'General Admission', 'Taylor Swift', 'taylor@example.com'),
  ('MGY-2025-005', 'Sunday Brunch Party', 'VIP', 'Morgan Lee', 'morgan@example.com');