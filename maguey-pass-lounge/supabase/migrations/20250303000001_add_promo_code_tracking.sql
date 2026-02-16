-- Migration: Add promo code tracking to orders
-- Allows tracking which promo codes were used and enforcing usage limits

-- Add promo_code_id column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promotions(id);

-- Create index for promo code lookups
CREATE INDEX IF NOT EXISTS idx_orders_promo_code_id ON orders(promo_code_id);

-- Add comment
COMMENT ON COLUMN orders.promo_code_id IS 'Reference to the promotion code used for this order';

