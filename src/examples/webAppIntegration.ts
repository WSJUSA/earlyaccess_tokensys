// WebApp Integration Example
// This file shows how to integrate the early access token system into essayagent_webapp

/*
## 1. Install the dependency

In essayagent_webapp directory:
```bash
npm install ../essayagent_tokensys
```

## 2. Database Setup

Run the SQL migration in your Supabase dashboard:
- Copy the contents of `src/db/schema.sql` and execute in Supabase SQL editor

## 3. Environment Variables

Add to your .env.local:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 4. API Routes

Create the following API routes in essayagent_webapp/src/app/api/early-access/
*/

// ================================
// API Route: /api/early-access/validate/route.ts
// ================================
export const validateRoute = `
// essayagent_webapp/src/app/api/early-access/validate/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createValidationHandler } from 'essayagent-tokensys';

export async function POST(request: Request) {
  try {
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
    return handler(request, {
      clientIP: request.headers.get('x-forwarded-for') || undefined
    });
  } catch (error) {
    console.error('API route error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`;

// ================================
// API Route: /api/early-access/generate/route.ts (Admin only)
// ================================
export const generateRoute = `
// essayagent_webapp/src/app/api/early-access/generate/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createTokenService } from 'essayagent-tokensys';

export async function POST(request: Request) {
  try {
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

    // Check if user is authenticated (add your admin check here)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { count = 1 } = await request.json();
    const tokenService = createTokenService(supabase);

    const tokens = await tokenService.generateTokenBatch({ count });

    return Response.json(tokens);
  } catch (error) {
    console.error('Generate tokens error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`;

// ================================
// API Route: /api/early-access/tokens/route.ts (Admin only)
// ================================
export const tokensRoute = `
// essayagent_webapp/src/app/api/early-access/tokens/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createTokenService } from 'essayagent-tokensys';

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    const { searchParams } = new URL(request.url);

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

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = searchParams.get('status') as any || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');

    const tokenService = createTokenService(supabase);
    const tokens = await tokenService.queryTokens({
      status,
      limit
    });

    return Response.json(tokens);
  } catch (error) {
    console.error('Get tokens error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`;

// ================================
// Modified Signup Component
// ================================
export const signupComponent = `
// essayagent_webapp/src/components/auth/SignupForm.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TokenInput } from 'essayagent-tokensys';
import { EarlyAccessToken } from 'essayagent-tokensys';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatedToken, setValidatedToken] = useState<EarlyAccessToken | null>(null);
  const [error, setError] = useState('');

  const supabase = createClient();

  const handleTokenValidated = (token: EarlyAccessToken) => {
    setValidatedToken(token);
    setError('');
  };

  const handleTokenInvalid = (errorMsg: string) => {
    setValidatedToken(null);
    setError(errorMsg);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatedToken) {
      setError('Please validate your early access token first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create the account
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signupError) throw signupError;

      if (data.user) {
        // Redeem the token for this user
        const response = await fetch('/api/early-access/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenCode: validatedToken.token_code,
            userId: data.user.id
          })
        });

        if (!response.ok) {
          console.error('Failed to redeem token, but account created');
        }

        // Redirect to success page or dashboard
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Early Access Signup</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Token Input - Required first step */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Early Access Token *
          </label>
          <TokenInput
            onTokenValidated={handleTokenValidated}
            onTokenInvalid={handleTokenInvalid}
            validateEndpoint="/api/early-access/validate"
          />
        </div>

        {/* Email and Password - Only shown after token validation */}
        {validatedToken && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-3 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full p-3 border rounded-md"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </>
        )}

        {error && (
          <div className="text-red-600 text-sm p-3 bg-red-50 rounded-md">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
`;

// ================================
// Admin Dashboard Page
// ================================
export const adminDashboard = `
// essayagent_webapp/src/app/admin/early-access/page.tsx
'use client';

import { TokenAdmin } from 'essayagent-tokensys';

export default function EarlyAccessAdminPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Early Access Token Management</h1>
      <TokenAdmin
        supabaseUrl="/api/early-access"
        onError={(error) => console.error('Admin error:', error)}
      />
    </div>
  );
}
`;

// ================================
// Middleware Update (Optional)
// ================================
export const middlewareUpdate = `
// essayagent_webapp/src/middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if user has early access
  if (session?.user) {
    const { data: tokenData } = await supabase
      .from('early_access_tokens')
      .select('id')
      .eq('redeemed_by', session.user.id)
      .single();

    // If no token redeemed, redirect to signup or show message
    if (!tokenData) {
      // Allow access to certain pages or redirect
      // return NextResponse.redirect(new URL('/early-access-required', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/assignments/:path*'],
};
`;

/*
## 5. Usage Instructions

1. **User Journey:**
   - User receives token (EA-XXXX-XXXX)
   - Goes to signup page
   - Enters token in TokenInput component
   - Token gets validated via API
   - If valid, email/password fields appear
   - User completes signup
   - Token gets marked as redeemed

2. **Admin Features:**
   - Visit /admin/early-access to manage tokens
   - Generate batches of tokens
   - View analytics and redemption stats
   - Export tokens for distribution

3. **Security:**
   - Rate limiting on validation endpoint
   - Server-side token validation
   - Admin routes protected by authentication
   - Tokens are single-use (one redemption per token)

This integration provides a complete early access system that can scale from initial testing to full production use.
*/
