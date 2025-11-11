import {
  generateTokenCode,
  isValidTokenFormat,
  parseTokenCode,
  generateTokenBatch
} from '../src/utils/tokenGenerator';

describe('Token Generator', () => {
  describe('generateTokenCode', () => {
    it('should generate a token with correct format', () => {
      const token = generateTokenCode();
      expect(isValidTokenFormat(token)).toBe(true);
    });

    it('should start with EA-', () => {
      const token = generateTokenCode();
      expect(token.startsWith('EA-')).toBe(true);
    });

    it('should have correct length', () => {
      const token = generateTokenCode();
      expect(token.length).toBe(16); // EA-XXXXXXXX-XXXX = 16 chars (EA- + 8 + - + 4)
    });

    it('should accept custom sequence number', () => {
      const token = generateTokenCode(42);
      expect(token.endsWith('-0042')).toBe(true);
    });

    it('should generate simple format tokens with custom prefix', () => {
      const token = generateTokenCode(undefined, true, 'VIP');
      expect(token.startsWith('VIP')).toBe(true);
      expect(token.length).toBe(7); // VIP + 4 digits
      expect(isValidTokenFormat(token)).toBe(true);
    });

    it('should convert custom prefix to uppercase', () => {
      const token = generateTokenCode(undefined, true, 'vip');
      expect(token.startsWith('VIP')).toBe(true);
    });

    it('should support long custom prefixes', () => {
      const token = generateTokenCode(undefined, true, 'LAUNCH2025');
      expect(token.startsWith('LAUNCH2025')).toBe(true);
      expect(token.length).toBe(14); // LAUNCH2025 + 4 digits
      expect(isValidTokenFormat(token)).toBe(true);
    });
  });

  describe('isValidTokenFormat', () => {
    it('should validate correct format', () => {
      expect(isValidTokenFormat('EA-A1B2C3D4-0001')).toBe(true);
      expect(isValidTokenFormat('EA-X9Y8Z7W6-0123')).toBe(true);
    });

    it('should reject incorrect formats', () => {
      expect(isValidTokenFormat('')).toBe(false);
      expect(isValidTokenFormat('EA-')).toBe(false);
      expect(isValidTokenFormat('EA-ABCDEFGH-')).toBe(false);
      expect(isValidTokenFormat('INVALID')).toBe(false);
      expect(isValidTokenFormat('ea-a1b2c3d4-0001')).toBe(false); // lowercase
      expect(isValidTokenFormat('EA-A1B2C3D4-000')).toBe(false); // wrong sequence length
    });
  });

  describe('parseTokenCode', () => {
    it('should parse valid token', () => {
      const result = parseTokenCode('EA-A1B2C3D4-0001');
      expect(result).toEqual({
        hash: 'A1B2C3D4',
        sequence: '0001',
        format: 'complex'
      });
    });

    it('should parse simple format tokens', () => {
      const result = parseTokenCode('VIP1234');
      expect(result).toEqual({
        prefix: 'VIP',
        number: '1234',
        format: 'simple'
      });
    });

    it('should parse long custom prefix tokens', () => {
      // Generate a token with a long custom prefix and parse it back
      const token = generateTokenCode(undefined, true, 'LAUNCH2025');
      const result = parseTokenCode(token);
      expect(result).toEqual({
        prefix: 'LAUNCH2025',
        number: expect.stringMatching(/^\d{4}$/),
        format: 'simple'
      });
    });

    it('should return null for invalid token', () => {
      expect(parseTokenCode('INVALID')).toBe(null);
      expect(parseTokenCode('')).toBe(null);
    });
  });

  describe('generateTokenBatch', () => {
    it('should generate correct number of tokens', () => {
      const tokens = generateTokenBatch(5);
      expect(tokens).toHaveLength(5);
      tokens.forEach(token => {
        expect(isValidTokenFormat(token)).toBe(true);
      });
    });

    it('should generate unique tokens', () => {
      const tokens = generateTokenBatch(10);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(10);
    });

    it('should accept custom start sequence', () => {
      const tokens = generateTokenBatch(3, { startSequence: 100 });
      expect(tokens[0].endsWith('-0100')).toBe(true);
      expect(tokens[1].endsWith('-0101')).toBe(true);
      expect(tokens[2].endsWith('-0102')).toBe(true);
    });

    it('should generate tokens with custom prefix', () => {
      const tokens = generateTokenBatch(3, { simpleFormat: true, customPrefix: 'VIP' });
      expect(tokens).toHaveLength(3);
      tokens.forEach(token => {
        expect(token.startsWith('VIP')).toBe(true);
        expect(isValidTokenFormat(token)).toBe(true);
      });
    });

    it('should generate unique tokens with custom prefix', () => {
      const tokens = generateTokenBatch(10, { simpleFormat: true, customPrefix: 'TEST' });
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(10);
      tokens.forEach(token => {
        expect(token.startsWith('TEST')).toBe(true);
      });
    });

    it('should handle long custom prefixes in batch', () => {
      const tokens = generateTokenBatch(2, { simpleFormat: true, customPrefix: 'LAUNCH2025' });
      expect(tokens).toHaveLength(2);
      tokens.forEach(token => {
        expect(token.startsWith('LAUNCH2025')).toBe(true);
        expect(token.length).toBe(14); // LAUNCH2025 + 4 digits
      });
    });
  });
});
