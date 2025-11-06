// Example Next.js API route for token validation
// Save this as: essayagent_webapp/src/app/api/early-access/validate/route.ts

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
