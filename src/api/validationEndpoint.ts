// Using any to avoid version conflicts between library and consumer Supabase versions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createTokenService } from './tokenService';

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10 // 10 requests per 15 minutes
};

/**
 * Checks if a request should be rate limited
 */
function checkRateLimit(identifier: string, config: RateLimitConfig = DEFAULT_RATE_LIMIT): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(identifier);

  if (!existing || now > existing.resetTime) {
    // First request or window expired
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return false;
  }

  if (existing.count >= config.maxRequests) {
    return true; // Rate limited
  }

  existing.count++;
  return false;
}

/**
 * Cleans up expired rate limit entries (should be called periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Express.js/Next.js API route handler for token validation
 * Usage in Next.js: /api/early-access/validate/route.ts
 */
export async function createValidationHandler(supabaseClient: any) {
  const tokenService = createTokenService(supabaseClient);

  return async function validateTokenHandler(
    request: Request,
    context?: { clientIP?: string }
  ): Promise<Response> {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      // Rate limiting based on IP
      const clientIP = context?.clientIP ||
                      (request as any).ip ||
                      (request as any).headers?.get?.('x-forwarded-for') ||
                      'unknown';

      if (checkRateLimit(clientIP)) {
        return new Response(JSON.stringify({
          error: 'Too many requests. Please try again later.'
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '900' // 15 minutes
          }
        });
      }

      // Parse request body
      let body: { tokenCode?: string };
      try {
        body = await request.json();
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { tokenCode } = body;

      if (!tokenCode || typeof tokenCode !== 'string') {
        return new Response(JSON.stringify({
          error: 'tokenCode is required and must be a string'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Trim whitespace and validate format
      const trimmedToken = tokenCode.trim();

      if (trimmedToken.length === 0) {
        return new Response(JSON.stringify({ error: 'Token code cannot be empty' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate token
      const result = await tokenService.validateToken(trimmedToken);

      // Log validation attempt (in production, use proper logging)
      console.log(`Token validation attempt: ${trimmedToken.substring(0, 6)}... - ${result.valid ? 'VALID' : 'INVALID'}`);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Token validation error:', error);

      return new Response(JSON.stringify({
        error: 'Internal server error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}

/**
 * Next.js API route example
 * Save this as: /api/early-access/validate/route.ts
 */
export const nextJsApiRouteExample = `
// app/api/early-access/validate/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createValidationHandler } from 'earlyaccess-tokensys';

export async function POST(request: Request) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const handler = createValidationHandler(supabase);
  return handler(request, { clientIP: request.headers.get('x-forwarded-for') || undefined });
}
`;

/**
 * Express.js middleware example
 */
export const expressMiddlewareExample = `
// server.js
const express = require('express');
const { createValidationHandler } = require('earlyaccess-tokensys');

const app = express();
app.use(express.json());

app.post('/api/early-access/validate', async (req, res) => {
  const handler = createValidationHandler(supabaseClient);
  const response = await handler(req);
  res.status(response.status).json(await response.json());
});
`;
