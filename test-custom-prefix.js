// Simple test script to validate custom prefix functionality
const { generateTokenCode, generateTokenBatch, isValidTokenFormat, parseTokenCode } = require('./dist/utils/tokenGenerator.js');

console.log('Testing custom prefix token generation...');

// Test 1: Generate token with custom prefix
console.log('\n1. Testing generateTokenCode with custom prefix:');
const vipToken = generateTokenCode(undefined, true, 'VIP');
console.log('VIP Token:', vipToken);
console.log('Valid format:', isValidTokenFormat(vipToken));
console.log('Parsed:', parseTokenCode(vipToken));

// Test 2: Generate batch with custom prefix
console.log('\n2. Testing generateTokenBatch with custom prefix:');
const tokens = generateTokenBatch(3, { simpleFormat: true, customPrefix: 'TEST' });
console.log('TEST tokens:', tokens);
tokens.forEach(token => {
  console.log(`  ${token}: valid=${isValidTokenFormat(token)}`);
});

// Test 3: Generate regular tokens (no custom prefix)
console.log('\n3. Testing regular token generation:');
const regularTokens = generateTokenBatch(2, { simpleFormat: true });
console.log('Regular tokens:', regularTokens);
regularTokens.forEach(token => {
  console.log(`  ${token}: valid=${isValidTokenFormat(token)}`);
});

console.log('\nAll tests completed!');
