/**
 * Token format: EA-{8-char-hash}-{4-digit-sequence}
 * Examples: EA-A1B2C3D4-0001, EA-X9Y8Z7W6-0002
 */

const TOKEN_PREFIX = 'EA';
const HASH_LENGTH = 8;
const SEQUENCE_LENGTH = 4;

// Use URL-safe alphabet for better readability and security
const hashAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const sequenceAlphabet = '0123456789';

// Simple custom alphabet generator to avoid ES module issues
const customAlphabet = (alphabet: string, length: number) => {
  return () => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
  };
};

const generateHash = customAlphabet(hashAlphabet, HASH_LENGTH);
const generateSequence = customAlphabet(sequenceAlphabet, SEQUENCE_LENGTH);

/**
 * Generates a unique early access token code
 * @param sequenceNumber Optional sequence number (auto-incremented if not provided)
 * @param simpleFormat If true, generates simple format like BETA2025 instead of EA-XXXX-XXXX
 * @param customPrefix Custom prefix to use instead of random ones (only for simple format)
 * @returns Token code in format EA-{hash}-{sequence} or simple format
 */
export function generateTokenCode(sequenceNumber?: number, simpleFormat = false, customPrefix?: string): string {
  if (simpleFormat) {
    // Generate simple shared codes like BETA2025, ALPHA001, etc.
    let prefix: string;
    if (customPrefix) {
      // Use custom prefix for vanity tokens
      prefix = customPrefix.toUpperCase();
    } else {
      // Use random prefix for regular tokens
      const prefixes = ['BETA', 'ALPHA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA', 'ETA'];
      prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    }
    const number = Math.floor(Math.random() * 9999) + 1;
    return `${prefix}${number.toString().padStart(4, '0')}`;
  }

  // Original complex format for unique codes
  const hash = generateHash();
  const sequence = sequenceNumber?.toString().padStart(SEQUENCE_LENGTH, '0') || generateSequence();
  return `${TOKEN_PREFIX}-${hash}-${sequence}`;
}

/**
 * Validates token code format (supports both complex and simple formats)
 * @param tokenCode Token code to validate
 * @returns True if format is valid
 */
export function isValidTokenFormat(tokenCode: string): boolean {
  // Complex format: EA-A1B2C3D4-0001 (exactly 8 alphanumeric chars)
  const complexPattern = /^EA-[A-Z0-9]{8}-[0-9]{4}$/;
  // Simple format: BETA2025, ALPHA001, VIP1234, LAUNCH20250001, etc.
  const simplePattern = /^[A-Z0-9]{2,20}[0-9]{4}$/;

  return complexPattern.test(tokenCode) || simplePattern.test(tokenCode);
}

/**
 * Extracts components from a valid token code
 * @param tokenCode Valid token code
 * @returns Object with components (different for complex vs simple formats)
 */
export function parseTokenCode(tokenCode: string): { hash?: string; sequence?: string; prefix?: string; number?: string; format: 'complex' | 'simple' } | null {
  if (!isValidTokenFormat(tokenCode)) {
    return null;
  }

  // Check if it's complex format
  if (tokenCode.startsWith('EA-')) {
    const parts = tokenCode.split('-');
    return {
      hash: parts[1],
      sequence: parts[2],
      format: 'complex'
    };
  }

  // Simple format: extract prefix and number (supports custom prefixes of varying lengths)
  const match = tokenCode.match(/^([A-Z0-9]{2,20})([0-9]{4})$/);
  if (match) {
    return {
      prefix: match[1],
      number: match[2],
      format: 'simple'
    };
  }

  return null;
}

/**
 * Generates multiple unique token codes
 * @param count Number of tokens to generate
 * @param options Configuration options for generation
 * @returns Array of unique token codes
 */
export function generateTokenBatch(
  count: number,
  options: {
    startSequence?: number;
    simpleFormat?: boolean;
    customPrefix?: string;
  } = {}
): string[] {
  const { startSequence, simpleFormat = false, customPrefix } = options;
  const tokens: string[] = [];
  const usedTokens = new Set<string>();

  for (let i = 0; i < count; i++) {
    let tokenCode: string;
    let attempts = 0;
    const maxAttempts = simpleFormat ? 1000 : 100; // More attempts for simple format

    do {
      const sequenceNum = startSequence !== undefined ? startSequence + i : undefined;
      tokenCode = generateTokenCode(sequenceNum, simpleFormat, customPrefix);
      attempts++;
    } while (usedTokens.has(tokenCode) && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique token after maximum attempts');
    }

    tokens.push(tokenCode);
    usedTokens.add(tokenCode);
  }

  return tokens;
}
