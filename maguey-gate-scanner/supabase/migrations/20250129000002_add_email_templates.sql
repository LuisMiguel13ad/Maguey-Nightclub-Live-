-- Migration: Add Email Templates Table
-- This migration creates the email_templates table for managing email templates

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  subject text NOT NULL,
  html text NOT NULL,
  text text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON public.email_templates(name);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Owners can manage email templates"
  ON public.email_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.user_metadata->>'role' = 'owner' OR auth.users.app_metadata->>'role' = 'owner')
    )
  );

CREATE POLICY "Authenticated users can view email templates"
  ON public.email_templates
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.email_templates IS 'Email templates for notifications and communications';

