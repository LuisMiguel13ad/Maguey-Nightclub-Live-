-- Add referral_code column to orders for promoter referral tracking
-- Promoters share unique links (?ref=<their-user-uuid>)
-- When an order is placed via a referral link, this column stores the promoter's user UUID

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Index for fast analytics queries (filter/group by referral_code)
CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON public.orders(referral_code)
  WHERE referral_code IS NOT NULL;

COMMENT ON COLUMN public.orders.referral_code IS
  'UUID of the promoter who referred this sale via ?ref= URL parameter. NULL = direct sale.';
