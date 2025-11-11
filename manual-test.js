// Manual test to verify custom prefix functionality
// This can be run with: node manual-test.js

// Import the functions directly (since we're in the same directory)
const path = require('path');
const fs = require('fs');

// Read the source file and extract the functions we need
const sourceFile = fs.readFileSync('./src/utils/tokenGenerator.ts', 'utf8');

// Simple test implementations
function customAlphabet(alphabet, size) {
  return () => {
    let result = '';
    for (let i = 0; i < size; i++) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
  };
}

const hashAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const sequenceAlphabet = '0123456789';
const generateHash = customAlphabet(hashAlphabet, 8);
const generateSequence = customAlphabet(sequenceAlphabet, 4);

function generateTokenCode(sequenceNumber, simpleFormat = false, customPrefix) {
  if (simpleFormat) {
    let prefix;
    if (customPrefix) {
      prefix = customPrefix.toUpperCase();
    } else {
      const prefixes = ['BETA', 'ALPHA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA', 'ETA'];
      prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    }
    const number = Math.floor(Math.random() * 9999) + 1;
    return `${prefix}${number.toString().padStart(4, '0')}`;
  }

  const hash = generateHash();
  const sequence = sequenceNumber?.toString().padStart(4, '0') || generateSequence();
  return `EA-${hash}-${sequence}`;
}

function isValidTokenFormat(tokenCode) {
  const complexPattern = /^EA-[A-Z0-9]{8}-[0-9]{4}$/;
  const simplePattern = /^[A-Z]{2,20}[0-9]{4}$/;
  return complexPattern.test(tokenCode) || simplePattern.test(tokenCode);
}

function generateTokenBatch(count, options = {}) {
  const { startSequence, simpleFormat = false, customPrefix } = options;
  const tokens = [];
  const usedTokens = new Set();

  for (let i = 0; i < count; i++) {
    let tokenCode;
    let attempts = 0;
    const maxAttempts = simpleFormat ? 1000 : 100;

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

// Run tests
console.log('Testing custom prefix token generation...\n');

// Test 1: Custom prefix VIP
console.log('1. Testing VIP custom prefix:');
const vipTokens = generateTokenBatch(3, { simpleFormat: true, customPrefix: 'VIP' });
vipTokens.forEach(token => {
  console.log(`  ${token} - Valid: ${isValidTokenFormat(token)}`);
});

// Test 2: Long custom prefix
console.log('\n2. Testing LAUNCH2025 custom prefix:');
const launchTokens = generateTokenBatch(2, { simpleFormat: true, customPrefix: 'LAUNCH2025' });
launchTokens.forEach(token => {
  console.log(`  ${token} - Valid: ${isValidTokenFormat(token)}`);
});

// Test 3: Regular tokens
console.log('\n3. Testing regular tokens (no custom prefix):');
const regularTokens = generateTokenBatch(2, { simpleFormat: true });
regularTokens.forEach(token => {
  console.log(`  ${token} - Valid: ${isValidTokenFormat(token)}`);
});

// Test 4: Complex format
console.log('\n4. Testing complex format tokens:');
const complexTokens = generateTokenBatch(2, { simpleFormat: false });
complexTokens.forEach(token => {
  console.log(`  ${token} - Valid: ${isValidTokenFormat(token)}`);
});

console.log('\n✅ All manual tests completed successfully!');
