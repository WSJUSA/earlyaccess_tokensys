// Main exports for the Early Access Token System

// Core API
export { createTokenService, TokenService } from './api/tokenService';

// Validation endpoint
export {
  createValidationHandler,
  nextJsApiRouteExample,
  expressMiddlewareExample,
  cleanupRateLimitStore
} from './api/validationEndpoint';

// Components
export { TokenInput } from './components/TokenInput';
export { TokenAdmin } from './components/TokenAdmin';

// Utilities
export {
  generateTokenCode,
  isValidTokenFormat,
  parseTokenCode,
  generateTokenBatch
} from './utils/tokenGenerator';

// Types
export type {
  EarlyAccessToken,
  TokenValidationResult,
  TokenGenerationOptions,
  TokenRedemptionOptions,
  TokenQueryOptions,
  TokenAnalytics,
  BatchTokenGenerationOptions
} from './types';

// Database (for advanced usage)
export { TokenDatabase } from './db/queries';
