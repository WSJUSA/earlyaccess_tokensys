# Early Access Token System - Setup Guide

This guide provides step-by-step instructions for integrating the Early Access Token System into your web application.

## Prerequisites

- Node.js 18+ and npm
- Access to Supabase project
- Your web application codebase

## Step 1: Install the Token System

In your web application directory:

```bash
npm install ../earlyaccess_tokensys
```

## Step 2: Database Setup

1. **Connect to Supabase SQL Editor**
   - Go to your Supabase dashboard
   - Navigate to SQL Editor

2. **Run the Schema Migration**
   - Copy the entire contents of `earlyaccess_tokensys/src/db/schema.sql`
   - Paste and execute in the Supabase SQL editor

3. **Verify Tables Created**
   - Check that `early_access_tokens` table exists
   - Verify indexes are created
   - Confirm RLS policies are applied

## Step 3: Create API Routes

Create the following API routes in `essayagent_webapp/src/app/api/early-access/`

### 3.1 Token Validation Endpoint

Create `validate/route.ts`:

```typescript
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
```

### 3.2 Token Generation Endpoint (Admin Only)

Create `generate/route.ts`:

```typescript
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

    // Verify admin authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add admin role check here
    // if (!await isUserAdmin(user.id)) {
    //   return Response.json({ error: 'Admin access required' }, { status: 403 });
    // }

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
```

### 3.3 Token Query Endpoint (Admin Only)

Create `tokens/route.ts`:

```typescript
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

    // Verify admin authentication
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
```

### 3.4 Token Redemption Endpoint

Create `redeem/route.ts`:

```typescript
// essayagent_webapp/src/app/api/early-access/redeem/route.ts
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tokenCode } = await request.json();
    if (!tokenCode) {
      return Response.json({ error: 'Token code required' }, { status: 400 });
    }

    const tokenService = createTokenService(supabase);
    const redeemedToken = await tokenService.redeemToken(tokenCode, user.id);

    return Response.json(redeemedToken);
  } catch (error: any) {
    console.error('Redeem token error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Step 4: Update Signup Flow

### 4.1 Modify the Signup Component

Update your existing signup component to include token validation:

```typescript
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
            tokenCode: validatedToken.token_code
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
```

## Step 5: Create Admin Dashboard

### 5.1 Create Admin Page

Create `essayagent_webapp/src/app/admin/early-access/page.tsx`:

```typescript
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
```

### 5.2 Add Analytics Endpoint (Optional)

Create `analytics/route.ts` for admin dashboard analytics:

```typescript
// essayagent_webapp/src/app/api/early-access/analytics/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createTokenService } from 'essayagent-tokensys';

export async function GET() {
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

    // Verify admin authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenService = createTokenService(supabase);
    const analytics = await tokenService.getAnalytics();

    return Response.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Step 6: Update Authentication Middleware (Optional)

If you want to restrict access to users with early access tokens, update your middleware:

```typescript
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
```

## Step 7: Testing the Integration

1. **Generate Test Tokens**
   - Visit `/admin/early-access`
   - Generate a few test tokens
   - Copy one token code

2. **Test Signup Flow**
   - Go to signup page
   - Enter the token code
   - Complete signup
   - Verify token is marked as redeemed

3. **Verify Database**
   - Check Supabase that token has `redeemed_by` and `redeemed_at` set

## Step 8: Production Deployment

1. **Environment Variables**
   - Ensure all Supabase environment variables are set in production

2. **Database Migration**
   - Run the schema migration in production Supabase instance

3. **Access Control**
   - Implement proper admin role checking in API routes
   - Add authentication to admin dashboard routes

4. **Monitoring**
   - Monitor API endpoints for errors
   - Track token redemption metrics

## Troubleshooting

### Common Issues

1. **Token validation fails**
   - Check API route is correctly implemented
   - Verify Supabase connection
   - Check database table exists

2. **Admin dashboard not loading**
   - Ensure admin authentication is working
   - Check API endpoints return correct data

3. **Token generation fails**
   - Verify database permissions
   - Check for unique constraint violations

### Debug Steps

1. Check browser console for JavaScript errors
2. Check server logs for API errors
3. Verify Supabase connection and permissions
4. Test API endpoints directly with tools like Postman

## Security Considerations

- API endpoints include rate limiting
- Admin routes require authentication
- Tokens are validated server-side
- Database uses Row Level Security (RLS)
- Token codes are not logged in plain text

## Next Steps

1. **Add Admin Role Management**
   - Implement proper admin user roles
   - Add user management features

2. **Enhanced Analytics**
   - Track user engagement post-redemption
   - Add conversion funnels

3. **Token Expiration**
   - Implement time-based token expiration
   - Add renewal workflows

4. **Email Integration**
   - Automated token distribution via email
   - Welcome emails for new users

This completes the basic setup of the Early Access Token System. The system is now ready for initial testing with a small group of users.
