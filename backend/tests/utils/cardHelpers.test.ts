/**
 * Tests for card helper utilities
 */

import { describe, it, expect } from 'vitest';
import {
  parsePrices,
  parseImageUris,
  parseColors,
  parseLegalities,
  safeJsonParse,
} from '../../src/utils/cardHelpers';

describe('Card Helpers', () => {
  describe('parsePrices', () => {
    it('should parse valid JSON string', () => {
      const jsonString = JSON.stringify({
        usd: '1.50',
        usd_foil: '3.00',
        eur: '1.20',
        eur_foil: '2.50',
      });
      
      const result = parsePrices(jsonString);
      
      expect(result.usd).toBe('1.50');
      expect(result.usd_foil).toBe('3.00');
      expect(result.eur).toBe('1.20');
      expect(result.eur_foil).toBe('2.50');
    });

    it('should pass through object directly', () => {
      const pricesObj = {
        usd: '2.00',
        eur: '1.80',
      };
      
      const result = parsePrices(pricesObj);
      
      expect(result.usd).toBe('2.00');
      expect(result.eur).toBe('1.80');
    });

    it('should return empty object for null input', () => {
      const result = parsePrices(null);
      expect(result).toEqual({});
    });

    it('should return empty object for undefined input', () => {
      const result = parsePrices(undefined);
      expect(result).toEqual({});
    });

    it('should return empty object for invalid JSON', () => {
      const result = parsePrices('not valid json');
      expect(result).toEqual({});
    });
  });

  describe('parseImageUris', () => {
    it('should parse valid image URIs JSON', () => {
      const jsonString = JSON.stringify({
        small: 'https://example.com/small.jpg',
        normal: 'https://example.com/normal.jpg',
        large: 'https://example.com/large.jpg',
        art_crop: 'https://example.com/art.jpg',
      });
      
      const result = parseImageUris(jsonString);
      
      expect(result.small).toBe('https://example.com/small.jpg');
      expect(result.normal).toBe('https://example.com/normal.jpg');
      expect(result.large).toBe('https://example.com/large.jpg');
      expect(result.art_crop).toBe('https://example.com/art.jpg');
    });

    it('should pass through object directly', () => {
      const imageObj = {
        normal: 'https://example.com/normal.jpg',
      };
      
      const result = parseImageUris(imageObj);
      expect(result.normal).toBe('https://example.com/normal.jpg');
    });

    it('should return empty object for null input', () => {
      const result = parseImageUris(null);
      expect(result).toEqual({});
    });
  });

  describe('parseColors', () => {
    it('should parse valid colors JSON', () => {
      const jsonString = JSON.stringify(['W', 'U', 'B']);
      
      const result = parseColors(jsonString);
      
      expect(result).toHaveLength(3);
      expect(result).toContain('W');
      expect(result).toContain('U');
      expect(result).toContain('B');
    });

    it('should pass through array directly', () => {
      const colorsArray = ['R', 'G'];
      
      const result = parseColors(colorsArray);
      
      expect(result).toHaveLength(2);
      expect(result).toContain('R');
      expect(result).toContain('G');
    });

    it('should filter invalid colors', () => {
      const result = parseColors(['W', 'X', 'U', 'invalid']);
      expect(result).toEqual(['W', 'U']);
    });

    it('should return empty array for null input', () => {
      const result = parseColors(null);
      expect(result).toEqual([]);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON string', () => {
      const result = safeJsonParse('{"key": "value"}', {});
      expect(result).toEqual({ key: 'value' });
    });

    it('should return default for invalid JSON', () => {
      const defaultValue = { default: true };
      const result = safeJsonParse('invalid json', defaultValue);
      expect(result).toEqual(defaultValue);
    });

    it('should return default for null input', () => {
      const result = safeJsonParse(null, []);
      expect(result).toEqual([]);
    });

    it('should return default for undefined input', () => {
      const result = safeJsonParse(undefined, 'default');
      expect(result).toBe('default');
    });

    it('should handle arrays', () => {
      const result = safeJsonParse('[1, 2, 3]', []);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle nested objects', () => {
      const nested = JSON.stringify({
        level1: {
          level2: {
            value: 'deep',
          },
        },
      });
      
      const result = safeJsonParse<{ level1: { level2: { value: string } } }>(nested, { level1: { level2: { value: '' } } });
      expect(result.level1.level2.value).toBe('deep');
    });
  });

  describe('parseLegalities', () => {
    it('should parse valid legalities JSON', () => {
      const jsonString = JSON.stringify({
        standard: 'legal',
        modern: 'legal',
        legacy: 'banned',
      });
      
      const result = parseLegalities(jsonString);
      
      expect(result.standard).toBe('legal');
      expect(result.modern).toBe('legal');
      expect(result.legacy).toBe('banned');
    });

    it('should return empty object for null', () => {
      const result = parseLegalities(null);
      expect(result).toEqual({});
    });
  });
});
