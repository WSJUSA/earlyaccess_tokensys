# Early Access Token System

A modular early access token system for TypeScript web applications. This system provides controlled access to beta features, private content, or limited releases through unique token codes. It is designed for use with a Supabase database.

## Features

- **Secure Token Generation**: Cryptographically secure token generation with collision resistance
- **Database-Backed**: Full audit trail of token creation, distribution, and redemption
- **Admin Management**: Simple interface for token generation and management
- **Supabase Integration**: Seamless integration with existing Supabase authentication
- **Extensible Design**: Built for future enhancements like expiration, usage limits, and revocation

## Installation

```bash
npm install ../earlyaccess_tokensys
```

Or for monorepo development:
```bash
npm install
cd ../essayagent_webapp
npm install ../earlyaccess_tokensys
```

## Database Setup

Run the database migration to create the required tables:

```sql
-- Run this in your Supabase SQL editor
CREATE TABLE early_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_code VARCHAR(64) UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  redeemed_by UUID REFERENCES auth.users(id),
  redeemed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB
);

CREATE INDEX idx_early_access_tokens_code ON early_access_tokens(token_code);
CREATE INDEX idx_early_access_tokens_redeemed_by ON early_access_tokens(redeemed_by);
```

## Token Types

### Unique Codes (1 user per code)
- **Format**: `EA-A1B2C3D4-0001` (complex, secure)
- **Usage**: One-time redemption per code
- **Use case**: Individual invitations, precise tracking

### Shared Codes (N users per code)
- **Format**: `BETA2025` (simple, shareable)
- **Usage**: Multiple users can redeem the same code
- **Use case**: Group access, classroom sharing, viral distribution

## Usage

### Generate Shared Codes

```typescript
import { createTokenService } from 'earlyaccess-tokensys';

// Generate 5 shared codes, each usable by 25 people
const sharedTokens = await tokenService.generateTokenBatch({
  count: 5,
  shared_code: true,
  max_redemptions: 25, // Each code can be used by 25 people
  simple_format: true   // Use BETA2025 format instead of EA-XXXX-XXXX
});
```

### Generate Unique Codes

```typescript
// Generate unique codes (1 user each)
const uniqueTokens = await tokenService.generateTokenBatch({
  count: 10,
  max_redemptions: 1, // Each code can only be used once
  simple_format: false // Use complex EA-XXXX-XXXX format
});
```

### Token Validation

```typescript
import { validateToken } from 'earlyaccess-tokensys';

const result = await validateToken('BETA2025');
if (result.valid) {
  const token = result.token!;
  console.log(`Token allows ${token.max_redemptions - token.current_redemptions} more redemptions`);
  console.log('Users who redeemed:', token.redeemed_users);
}
```

### Token Generation

```typescript
import { generateToken } from 'earlyaccess-tokensys';

const token = await generateToken();
console.log('Generated token:', token.code); // "EA-X9Y8Z7W6-0001"
```

### React Component Integration

```tsx
import { TokenInput } from 'earlyaccess-tokensys';

function SignupForm() {
  return (
    <form>
      <TokenInput onTokenValidated={(token) => console.log('Valid token:', token)} />
      {/* Rest of signup form */}
    </form>
  );
}
```

### Admin Component Integration

```tsx
import { TokenAdmin } from 'earlyaccess-tokensys';

function AdminDashboard() {
  return (
    <div>
      <h1>Token Management</h1>
      <TokenAdmin
        supabaseUrl="/api/early-access"
        onError={(error) => console.error('Admin error:', error)}
      />
    </div>
  );
}
```

## API Endpoints

### Validate Token
```
POST /api/early-access/validate
Content-Type: application/json

{
  "tokenCode": "EA-A1B2C3D4-0001"
}
```

Response:
```json
{
  "valid": true,
  "token": {
    "id": "uuid",
    "code": "EA-A1B2C3D4-0001",
    "created_at": "2025-10-17T10:00:00Z",
    "is_active": true
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Type checking
npm run type-check
```

## Quick Start

1. **Install**: `npm install ../ts_tokensys`
2. **Setup Database**: Run the SQL in `src/db/schema.sql` in Supabase
3. **Create API Routes**: See `SETUP.md` for complete integration guide
4. **Update Signup**: Use `TokenInput` component in your signup flow

## Features

- ✅ **Flexible Token Types**: Support for both unique codes (1 user) and shared codes (N users)
- ✅ **Multiple Formats**: Complex format (EA-A1B2C3D4-0001) and simple format (BETA2025)
- ✅ **Secure Token Generation**: Collision-resistant generation with uniqueness checks
- ✅ **Database-Backed**: Full audit trail with Supabase and RLS policies
- ✅ **Rate Limiting**: Built-in protection against abuse
- ✅ **Admin Component**: React component for token management interfaces
- ✅ **React Components**: Ready-to-use UI components
- ✅ **TypeScript**: Full type safety and IntelliSense
- ✅ **Modular Architecture**: Easy to extend and customize

## Architecture

- **Modular Design**: Standalone module that can be easily integrated
- **Database First**: All token state managed in Supabase
- **Security Focused**: Server-side validation, rate limiting, RLS policies
- **Scalable**: Built to handle thousands of tokens and users

## License

MIT
