/**
 * Tests for cookie configuration
 */

import { describe, it, expect } from 'vitest';
import {
  REFRESH_TOKEN_COOKIE,
  getRefreshTokenCookieOptions,
  getClearCookieOptions,
  TOKEN_CONFIG,
  validatePassword,
} from '../../src/config/cookies';

describe('Cookie Configuration', () => {
  describe('REFRESH_TOKEN_COOKIE', () => {
    it('should have correct cookie name', () => {
      expect(REFRESH_TOKEN_COOKIE).toBe('magicodex_refresh');
    });
  });

  describe('getRefreshTokenCookieOptions', () => {
    it('should return httpOnly: true', () => {
      const options = getRefreshTokenCookieOptions();
      expect(options.httpOnly).toBe(true);
    });

    it('should have sameSite: strict', () => {
      const options = getRefreshTokenCookieOptions();
      expect(options.sameSite).toBe('strict');
    });

    it('should have path: /api/auth', () => {
      const options = getRefreshTokenCookieOptions();
      expect(options.path).toBe('/api/auth');
    });

    it('should have maxAge of 7 days', () => {
      const options = getRefreshTokenCookieOptions();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(options.maxAge).toBe(sevenDaysMs);
    });

    it('should set secure based on NODE_ENV', () => {
      const originalEnv = process.env.NODE_ENV;
      
      // Test production
      process.env.NODE_ENV = 'production';
      let options = getRefreshTokenCookieOptions();
      expect(options.secure).toBe(true);
      
      // Test development
      process.env.NODE_ENV = 'development';
      options = getRefreshTokenCookieOptions();
      expect(options.secure).toBe(false);
      
      // Restore
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('getClearCookieOptions', () => {
    it('should return httpOnly: true', () => {
      const options = getClearCookieOptions();
      expect(options.httpOnly).toBe(true);
    });

    it('should have correct path', () => {
      const options = getClearCookieOptions();
      expect(options.path).toBe('/api/auth');
    });
  });

  describe('TOKEN_CONFIG', () => {
    it('should have 15 minute access token expiry', () => {
      expect(TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY).toBe('15m');
    });

    it('should have 7 day refresh token expiry', () => {
      expect(TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS).toBe(7);
    });

    it('should have minimum password length of 8', () => {
      expect(TOKEN_CONFIG.PASSWORD_MIN_LENGTH).toBe(8);
    });
  });

  describe('validatePassword', () => {
    it('should reject password shorter than minimum', () => {
      const result = validatePassword('short');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Le mot de passe doit contenir au moins 8 caractères');
    });

    it('should reject password without uppercase', () => {
      const result = validatePassword('password123');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('majuscule'))).toBe(true);
    });

    it('should reject password without lowercase', () => {
      const result = validatePassword('PASSWORD123');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('minuscule'))).toBe(true);
    });

    it('should reject password without number', () => {
      const result = validatePassword('Password');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('chiffre'))).toBe(true);
    });

    it('should accept valid password', () => {
      const result = validatePassword('Password123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept complex password', () => {
      const result = validatePassword('MyS3cur3P@ssw0rd!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
