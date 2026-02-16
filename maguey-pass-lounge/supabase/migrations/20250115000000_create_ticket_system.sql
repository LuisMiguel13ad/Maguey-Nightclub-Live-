-- Migration: Create Ticket System Tables
-- This migration creates all necessary tables for the ticket purchase and scanner system
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events Table
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  genre VARCHAR,
  image_url VARCHAR NOT NULL,  -- Event image URL
  venue_name VARCHAR NOT NULL,
  venue_address VARCHAR NOT NULL,
  city VARCHAR,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id VARCHAR NOT NULL REFERENCES events(id),
  customer_first_name VARCHAR NOT NULL,
  customer_last_name VARCHAR NOT NULL,
  customer_email VARCHAR NOT NULL,
  customer_phone VARCHAR,
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
  stripe_payment_intent_id VARCHAR,
  stripe_session_id VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id VARCHAR UNIQUE NOT NULL,  -- Unique ticket ID (e.g., MGY-PF-20251115-ABC123)
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_id VARCHAR NOT NULL REFERENCES events(id),  -- Link to event
  ticket_type VARCHAR NOT NULL,  -- e.g., 'ga', 'vip', 'expedited'
  ticket_type_name VARCHAR NOT NULL,  -- e.g., 'General Admission', 'VIP Entry'
  status VARCHAR NOT NULL DEFAULT 'issued',  -- issued, checked_in, expired, cancelled
  price DECIMAL(10, 2) NOT NULL,
  fee DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checked_in_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments Table (for tracking Stripe payments)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR DEFAULT 'usd',
  status VARCHAR NOT NULL,  -- succeeded, failed, pending
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Events: Public read access
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

-- Orders: Users can only see their own orders
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid()::text = customer_email OR auth.role() = 'service_role');

-- Tickets: Users can only see their own tickets
CREATE POLICY "Users can view their own tickets"
  ON tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = tickets.order_id
      AND orders.customer_email = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  );

-- Payments: Users can only see their own payments
CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
      AND orders.customer_email = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to update updated_at
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE events IS 'Event information including name, date, venue, and image';
COMMENT ON TABLE orders IS 'Customer orders for tickets';
COMMENT ON TABLE tickets IS 'Individual tickets with QR codes and event linkage';
COMMENT ON TABLE payments IS 'Payment records from Stripe';

COMMENT ON COLUMN tickets.ticket_id IS 'Unique ticket identifier used in QR codes (format: MGY-PF-YYYYMMDD-XXXXXX)';
COMMENT ON COLUMN tickets.event_id IS 'Foreign key linking ticket to event';
COMMENT ON COLUMN events.image_url IS 'URL to event image used for tickets and scanner display';

