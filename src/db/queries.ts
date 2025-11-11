import { SupabaseClient } from '@supabase/supabase-js';
import { EarlyAccessToken, TokenGenerationOptions, TokenRedemptionOptions, TokenQueryOptions, TokenAnalytics } from '../types';

export class TokenDatabase {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Creates a new early access token in the database
   */
  async createToken(tokenCode: string, options: TokenGenerationOptions & { max_redemptions?: number } = {}): Promise<EarlyAccessToken> {
    const { data, error } = await this.supabase
      .from('early_access_tokens')
      .insert({
        token_code: tokenCode,
        created_by: options.created_by,
        max_redemptions: options.max_redemptions || 1, // Default to 1 (unique code)
        expires_at: options.expires_at?.toISOString(),
        metadata: options.metadata || {}
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create token: ${error.message}`);
    }

    return data;
  }

  /**
   * Validates a token code and returns token details if valid
   * For shared codes: checks if current_redemptions < max_redemptions
   * For unique codes: checks if redeemed_by is null (backward compatibility)
   */
  async validateToken(tokenCode: string): Promise<EarlyAccessToken | null> {
    const { data, error } = await this.supabase
      .from('early_access_tokens')
      .select('*')
      .eq('token_code', tokenCode)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to validate token: ${error.message}`);
    }

    // Check redemption limits based on token type
    if (data.max_redemptions > 1) {
      // Shared code: check if we have remaining redemptions
      if (data.current_redemptions >= data.max_redemptions) {
        return null; // No more redemptions available
      }
    } else {
      // Unique code (backward compatibility): check if already redeemed
      if (data.redeemed_by) {
        return null; // Already redeemed
      }
    }

    return data;
  }

  /**
   * Redeems a token for a user
   * Handles both shared codes (increment counter) and unique codes (single redemption)
   */
  async redeemToken(tokenCode: string, options: TokenRedemptionOptions): Promise<EarlyAccessToken> {
    // First validate the token
    const token = await this.validateToken(tokenCode);
    if (!token) {
      throw new Error('Token is not valid for redemption');
    }

    // Check if user has already redeemed this token (for shared codes)
    if (token.max_redemptions > 1 && token.redeemed_users.includes(options.redeemed_by)) {
      throw new Error('User has already redeemed this token');
    }

    // Prepare update based on token type
    const updateData: any = {
      metadata: { ...token.metadata, ...options.metadata }
    };

    if (token.max_redemptions > 1) {
      // Shared code: increment counter and add user to array
      updateData.current_redemptions = token.current_redemptions + 1;
      updateData.redeemed_users = [...token.redeemed_users, options.redeemed_by];
      // Set redeemed_at on first redemption
      if (token.current_redemptions === 0) {
        updateData.redeemed_at = new Date().toISOString();
      }
    } else {
      // Unique code: single redemption
      updateData.redeemed_by = options.redeemed_by;
      updateData.redeemed_at = new Date().toISOString();
    }

    // Update the token with redemption details
    const { data, error } = await this.supabase
      .from('early_access_tokens')
      .update(updateData)
      .eq('token_code', tokenCode)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to redeem token: ${error.message}`);
    }

    return data;
  }

  /**
   * Queries tokens with filtering options
   */
  async queryTokens(options: TokenQueryOptions = {}): Promise<EarlyAccessToken[]> {
    let query = this.supabase
      .from('early_access_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (options.status) {
      switch (options.status) {
        case 'active':
          // Active tokens: is_active = true (simplified for now)
          query = query.eq('is_active', true);
          break;
        case 'redeemed':
          // Redeemed tokens: has been redeemed (simplified for now)
          query = query.not('redeemed_by', 'is', null);
          break;
        case 'expired':
          query = query.lt('expires_at', new Date().toISOString());
          break;
        case 'inactive':
          query = query.eq('is_active', false);
          break;
      }
    }

    if (options.created_by) {
      query = query.eq('created_by', options.created_by);
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to query tokens: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Gets analytics data for the token system
   */
  async getAnalytics(): Promise<TokenAnalytics> {
    const { data, error } = await this.supabase.rpc('get_token_analytics');

    if (error) {
      console.warn('RPC get_token_analytics failed:', error);
      // Fallback to client-side calculation
      return this.calculateAnalytics();
    }

    return data;
  }


  /**
   * Client-side analytics calculation (final fallback)
   */
  private async calculateAnalytics(): Promise<TokenAnalytics> {
    const { data: allTokens, error } = await this.supabase
      .from('early_access_tokens')
      .select('*');

    if (error || !allTokens) {
      throw new Error(`Failed to calculate analytics: ${error?.message}`);
    }

    const now = new Date();
    const total_created = allTokens.length;
    // Total redeemed is sum of current_redemptions across all tokens
    const total_redeemed = allTokens.reduce((sum, t) => sum + t.current_redemptions, 0);
    // Total available redemptions is sum of max_redemptions across all tokens
    const total_available = allTokens.reduce((sum, t) => sum + t.max_redemptions, 0);
    const total_active = allTokens.filter(t =>
      t.is_active &&
      t.current_redemptions < t.max_redemptions &&
      (!t.expires_at || new Date(t.expires_at) > now)
    ).length;
    const total_expired = allTokens.filter(t => t.expires_at && new Date(t.expires_at) <= now).length;

    // Calculate average time to redemption
    const redeemedTokens = allTokens.filter(t => t.redeemed_at && t.created_at);
    const avgTimeToRedemption = redeemedTokens.length > 0
      ? redeemedTokens.reduce((acc, t) => {
          const created = new Date(t.created_at).getTime();
          const redeemed = new Date(t.redeemed_at!).getTime();
          return acc + (redeemed - created);
        }, 0) / redeemedTokens.length / (1000 * 60 * 60 * 24) // Convert to days
      : null;

    return {
      total_created,
      total_redeemed,
      total_available,
      total_active,
      total_expired,
      redemption_rate: total_created > 0 ? total_redeemed / total_created : 0,
      average_time_to_redemption: avgTimeToRedemption
    };
  }

  /**
   * Deactivates a token (soft delete)
   */
  async deactivateToken(tokenCode: string): Promise<void> {
    const { error } = await this.supabase
      .from('early_access_tokens')
      .update({ is_active: false })
      .eq('token_code', tokenCode);

    if (error) {
      throw new Error(`Failed to deactivate token: ${error.message}`);
    }
  }

  /**
   * Checks if a token code already exists
   */
  async tokenExists(tokenCode: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('early_access_tokens')
      .select('id')
      .eq('token_code', tokenCode)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check token existence: ${error.message}`);
    }

    return !!data;
  }
}
