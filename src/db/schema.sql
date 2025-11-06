-- Early Access Token System Database Schema
-- Run this migration in your Supabase SQL editor

-- Create the early_access_tokens table
CREATE TABLE IF NOT EXISTS early_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_code VARCHAR(64) UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Shared code fields (replaces single-user redemption)
  max_redemptions INTEGER DEFAULT 1, -- How many users can redeem this code
  current_redemptions INTEGER DEFAULT 0, -- How many have redeemed so far
  redeemed_users UUID[] DEFAULT '{}', -- Array of user IDs who redeemed
  -- Legacy single-user fields (for backward compatibility)
  redeemed_by UUID REFERENCES auth.users(id), -- NULL for shared codes
  redeemed_at TIMESTAMP WITH TIME ZONE, -- First redemption time
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL for no expiration
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}' -- For future extensibility
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_early_access_tokens_code ON early_access_tokens(token_code);
CREATE INDEX IF NOT EXISTS idx_early_access_tokens_redeemed_by ON early_access_tokens(redeemed_by);
CREATE INDEX IF NOT EXISTS idx_early_access_tokens_created_by ON early_access_tokens(created_by);
CREATE INDEX IF NOT EXISTS idx_early_access_tokens_active ON early_access_tokens(is_active) WHERE is_active = true;
-- New indexes for shared code functionality
CREATE INDEX IF NOT EXISTS idx_early_access_tokens_max_redemptions ON early_access_tokens(max_redemptions);
CREATE INDEX IF NOT EXISTS idx_early_access_tokens_current_redemptions ON early_access_tokens(current_redemptions);
CREATE INDEX IF NOT EXISTS idx_early_access_tokens_redeemed_users ON early_access_tokens USING GIN(redeemed_users);

-- Add RLS (Row Level Security) policies
ALTER TABLE early_access_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Allow token validation for active tokens (authenticated users)
CREATE POLICY "Allow token validation" ON early_access_tokens
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

-- Policy: Users can view tokens they created, redeemed, or are in the redeemed_users array
CREATE POLICY "Users can view their own tokens" ON early_access_tokens
  FOR SELECT USING (
    auth.uid() = created_by OR
    auth.uid() = redeemed_by OR
    (auth.uid() = ANY(redeemed_users))
  );

-- Policy: Only authenticated users can insert tokens (for admin creation)
CREATE POLICY "Authenticated users can create tokens" ON early_access_tokens
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update tokens for redemption if they haven't already redeemed it
CREATE POLICY "Users can update tokens for redemption" ON early_access_tokens
  FOR UPDATE USING (
    auth.uid() = created_by OR
    (is_active = true AND
     current_redemptions < max_redemptions AND
     (auth.uid() != ALL(redeemed_users)))
  );

-- Comments for documentation
COMMENT ON TABLE early_access_tokens IS 'Stores early access tokens for controlled beta access - supports both single-use and shared codes';
COMMENT ON COLUMN early_access_tokens.token_code IS 'Unique token code in format EA-{8-char-hash}-{4-digit-sequence} or simplified shared codes';
COMMENT ON COLUMN early_access_tokens.max_redemptions IS 'Maximum number of users who can redeem this token (1 for unique codes, N for shared codes)';
COMMENT ON COLUMN early_access_tokens.current_redemptions IS 'Current number of users who have redeemed this token';
COMMENT ON COLUMN early_access_tokens.redeemed_users IS 'Array of user IDs who have redeemed this shared token';
COMMENT ON COLUMN early_access_tokens.metadata IS 'Extensible JSON field for future features like usage limits, feature flags, cohorts';
