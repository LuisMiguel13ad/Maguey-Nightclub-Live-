-- Migration: Create User Loyalty System
-- Tracks user loyalty points, credits, and membership tiers

-- Create user_loyalty table
CREATE TABLE IF NOT EXISTS user_loyalty (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL, -- For users without accounts
  points INTEGER DEFAULT 0,
  credits DECIMAL(10, 2) DEFAULT 0,
  membership_tier VARCHAR DEFAULT 'bronze' CHECK (membership_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(email)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_loyalty_user_id ON user_loyalty(user_id);
CREATE INDEX IF NOT EXISTS idx_user_loyalty_email ON user_loyalty(email);
CREATE INDEX IF NOT EXISTS idx_user_loyalty_tier ON user_loyalty(membership_tier);

-- Enable RLS
ALTER TABLE user_loyalty ENABLE ROW LEVEL SECURITY;

-- Users can view their own loyalty data
CREATE POLICY "Users can view their own loyalty"
  ON user_loyalty FOR SELECT
  USING (auth.uid()::text = user_id::text OR auth.jwt()->>'email' = email);

-- Service role can manage all loyalty data
CREATE POLICY "Service role can manage loyalty"
  ON user_loyalty FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update membership tier based on total_spent
CREATE OR REPLACE FUNCTION update_membership_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_spent >= 1000 THEN
    NEW.membership_tier = 'platinum';
  ELSIF NEW.total_spent >= 500 THEN
    NEW.membership_tier = 'gold';
  ELSIF NEW.total_spent >= 200 THEN
    NEW.membership_tier = 'silver';
  ELSE
    NEW.membership_tier = 'bronze';
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update tier on total_spent change
CREATE TRIGGER update_loyalty_tier
  BEFORE UPDATE ON user_loyalty
  FOR EACH ROW
  WHEN (OLD.total_spent IS DISTINCT FROM NEW.total_spent)
  EXECUTE FUNCTION update_membership_tier();

-- Trigger to update updated_at
CREATE TRIGGER update_user_loyalty_updated_at
  BEFORE UPDATE ON user_loyalty
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE user_loyalty IS 'User loyalty program tracking points, credits, and membership tiers';
COMMENT ON COLUMN user_loyalty.points IS 'Loyalty points earned from purchases (e.g., 1 point per $1 spent)';
COMMENT ON COLUMN user_loyalty.credits IS 'Available credits that can be applied to purchases';
COMMENT ON COLUMN user_loyalty.membership_tier IS 'Membership tier based on total spending: bronze, silver, gold, platinum';

