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

-- RPC function for getting token analytics (admin operations)
CREATE OR REPLACE FUNCTION get_token_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_created', COUNT(*),
    'total_redeemed', COALESCE(SUM(current_redemptions), 0),
    'total_available', COALESCE(SUM(max_redemptions), 0),
    'total_active', COUNT(*) FILTER (WHERE is_active = true AND current_redemptions < max_redemptions AND (expires_at IS NULL OR expires_at > NOW())),
    'total_expired', COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= NOW()),
    'redemption_rate', CASE WHEN COUNT(*) > 0 THEN SUM(current_redemptions)::float / COUNT(*)::float ELSE 0 END,
    'average_time_to_redemption', (
      SELECT AVG(EXTRACT(EPOCH FROM (redeemed_at - created_at))/86400)
      FROM early_access_tokens
      WHERE redeemed_at IS NOT NULL AND created_at IS NOT NULL
    )
  ) INTO result
  FROM early_access_tokens;

  RETURN result;
END;
$$;

-- RPC function for querying tokens (admin operations)
CREATE OR REPLACE FUNCTION query_tokens_admin(
  status_filter text DEFAULT 'all',
  limit_count integer DEFAULT 100,
  offset_count integer DEFAULT 0,
  created_by_filter uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  query_sql text;
BEGIN
  -- Build the base query
  query_sql := 'SELECT * FROM early_access_tokens WHERE true';

  -- Apply status filtering
  IF status_filter = 'active' THEN
    query_sql := query_sql || ' AND is_active = true AND current_redemptions < max_redemptions AND (expires_at IS NULL OR expires_at > NOW())';
  ELSIF status_filter = 'redeemed' THEN
    query_sql := query_sql || ' AND current_redemptions >= max_redemptions';
  ELSIF status_filter = 'expired' THEN
    query_sql := query_sql || ' AND expires_at IS NOT NULL AND expires_at <= NOW()';
  ELSIF status_filter = 'inactive' THEN
    query_sql := query_sql || ' AND is_active = false';
  END IF;

  -- Apply created_by filtering
  IF created_by_filter IS NOT NULL THEN
    query_sql := query_sql || ' AND created_by = ''' || created_by_filter || '''';
  END IF;

  -- Apply ordering and pagination
  query_sql := query_sql || ' ORDER BY created_at DESC LIMIT ' || limit_count || ' OFFSET ' || offset_count;

  -- Execute the query
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_sql || ') t' INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Comments for documentation
COMMENT ON TABLE early_access_tokens IS 'Stores early access tokens for controlled beta access - supports both single-use and shared codes';
COMMENT ON COLUMN early_access_tokens.token_code IS 'Unique token code in format EA-{8-char-hash}-{4-digit-sequence} or simplified shared codes';
COMMENT ON COLUMN early_access_tokens.max_redemptions IS 'Maximum number of users who can redeem this token (1 for unique codes, N for shared codes)';
COMMENT ON COLUMN early_access_tokens.current_redemptions IS 'Current number of users who have redeemed this token';
COMMENT ON COLUMN early_access_tokens.redeemed_users IS 'Array of user IDs who have redeemed this shared token';
COMMENT ON COLUMN early_access_tokens.metadata IS 'Extensible JSON field for future features like usage limits, feature flags, cohorts';
