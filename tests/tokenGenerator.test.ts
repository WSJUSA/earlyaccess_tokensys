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
      expect(token.length).toBe(18); // EA-XXXXXXXX-XXXX = 18 chars
    });

    it('should accept custom sequence number', () => {
      const token = generateTokenCode(42);
      expect(token.endsWith('-0042')).toBe(true);
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
        sequence: '0001'
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
      const tokens = generateTokenBatch(3, 100);
      expect(tokens[0].endsWith('-0100')).toBe(true);
      expect(tokens[1].endsWith('-0101')).toBe(true);
      expect(tokens[2].endsWith('-0102')).toBe(true);
    });
  });
});
