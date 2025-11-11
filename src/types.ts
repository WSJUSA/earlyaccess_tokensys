export interface EarlyAccessToken {
  id: string;
  token_code: string;
  created_by: string | null;
  created_at: string;
  // Shared code fields
  max_redemptions: number;
  current_redemptions: number;
  redeemed_users: string[]; // Array of user IDs
  // Legacy single-user fields (for backward compatibility)
  redeemed_by: string | null;
  redeemed_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface TokenValidationResult {
  valid: boolean;
  token?: EarlyAccessToken;
  error?: string;
}

export interface TokenGenerationOptions {
  created_by?: string;
  expires_at?: Date;
  metadata?: Record<string, any>;
}

export interface TokenRedemptionOptions {
  redeemed_by: string;
  metadata?: Record<string, any>;
}

export interface TokenQueryOptions {
  limit?: number;
  offset?: number;
  status?: 'active' | 'redeemed' | 'expired' | 'inactive';
  created_by?: string;
}

export interface BatchTokenGenerationOptions extends TokenGenerationOptions {
  count: number;
  start_sequence?: number;
  // Shared code options
  shared_code?: boolean; // If true, generates shared codes instead of unique codes
  max_redemptions?: number; // How many users can use each shared code
  simple_format?: boolean; // If true, uses simple format like BETA2025 instead of EA-XXXX-XXXX
  // Vanity naming options
  custom_prefix?: string; // Custom prefix for vanity tokens (e.g., "VIP", "ESSAY", "BETA")
}

export interface SharedTokenGenerationOptions extends TokenGenerationOptions {
  max_redemptions: number;
  simple_format?: boolean;
}

export interface TokenAnalytics {
  total_created: number;
  total_redeemed: number;
  total_available: number;
  total_active: number;
  total_expired: number;
  redemption_rate: number;
  average_time_to_redemption: number | null;
}
