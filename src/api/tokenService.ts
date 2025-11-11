import { SupabaseClient } from '@supabase/supabase-js';
import { TokenDatabase } from '../db/queries';
import { generateTokenBatch, isValidTokenFormat } from '../utils/tokenGenerator';
import {
  EarlyAccessToken,
  TokenValidationResult,
  TokenGenerationOptions,
  TokenRedemptionOptions,
  TokenQueryOptions,
  TokenAnalytics,
  BatchTokenGenerationOptions
} from '../types';

export class TokenService {
  private db: TokenDatabase;

  constructor(supabaseClient: SupabaseClient) {
    this.db = new TokenDatabase(supabaseClient);
  }

  /**
   * Generates a single token and stores it in the database
   */
  async generateToken(options: TokenGenerationOptions = {}): Promise<EarlyAccessToken> {
    const isShared = (options as any).max_redemptions > 1;
    const simpleFormat = (options as any).simpleFormat || isShared;

    // Generate token codes until we find one that doesn't exist
    let tokenCode: string;
    let attempts = 0;
    const maxAttempts = simpleFormat ? 50 : 10; // More attempts for simple format

    do {
      tokenCode = generateTokenBatch(1, { simpleFormat })[0];
      attempts++;
    } while (await this.db.tokenExists(tokenCode) && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique token after maximum attempts');
    }

    return this.db.createToken(tokenCode, options);
  }

  /**
   * Generates multiple tokens in batch
   */
  async generateTokenBatch(options: BatchTokenGenerationOptions): Promise<EarlyAccessToken[]> {
    const { count, shared_code, max_redemptions, simple_format, start_sequence, custom_prefix } = options;
    const simpleFormat = simple_format || shared_code || (max_redemptions && max_redemptions > 1);

    const tokenCodes = generateTokenBatch(count, {
      startSequence: start_sequence,
      simpleFormat,
      customPrefix: custom_prefix
    });
    const tokens: EarlyAccessToken[] = [];

    for (const tokenCode of tokenCodes) {
      // Check for uniqueness (though very unlikely with our generation method)
      if (!(await this.db.tokenExists(tokenCode))) {
        // Set default max_redemptions for shared codes
        const tokenOptions = {
          ...options,
          max_redemptions: max_redemptions || (shared_code ? 25 : 1) // Default 25 for shared, 1 for unique
        };

        const token = await this.db.createToken(tokenCode, tokenOptions);
        tokens.push(token);
      }
    }

    return tokens;
  }

  /**
   * Validates a token code
   */
  async validateToken(tokenCode: string): Promise<TokenValidationResult> {
    // First check format
    if (!isValidTokenFormat(tokenCode)) {
      return {
        valid: false,
        error: 'Invalid token format'
      };
    }

    // Check database
    const token = await this.db.validateToken(tokenCode);

    if (!token) {
      return {
        valid: false,
        error: 'Token not found, already redeemed, expired, or inactive'
      };
    }

    return {
      valid: true,
      token
    };
  }

  /**
   * Redeems a token for a user
   */
  async redeemToken(tokenCode: string, userId: string, options: Partial<TokenRedemptionOptions> = {}): Promise<EarlyAccessToken> {
    const redemptionOptions: TokenRedemptionOptions = {
      redeemed_by: userId,
      ...options
    };

    return this.db.redeemToken(tokenCode, redemptionOptions);
  }

  /**
   * Queries tokens with filtering
   */
  async queryTokens(options: TokenQueryOptions = {}): Promise<EarlyAccessToken[]> {
    return this.db.queryTokens(options);
  }

  /**
   * Gets system analytics
   */
  async getAnalytics(): Promise<TokenAnalytics> {
    return this.db.getAnalytics();
  }

  /**
   * Deactivates a token
   */
  async deactivateToken(tokenCode: string): Promise<void> {
    return this.db.deactivateToken(tokenCode);
  }
}

// Factory function for easier usage
export function createTokenService(supabaseClient: SupabaseClient): TokenService {
  return new TokenService(supabaseClient);
}
