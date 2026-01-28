/**
 * Tests for validation schemas
 */
import { describe, it, expect } from 'vitest';
import { 
  loginSchema, 
  registerSchema, 
  changePasswordSchema,
  addCardSchema,
  createDeckSchema,
} from '../lib/validation';

describe('Auth Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const data = { email: 'test@example.com', password: 'password123' };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const data = { email: 'not-an-email', password: 'password123' };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject empty email', () => {
      const data = { email: '', password: 'password123' };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const data = { email: 'test@example.com', password: '' };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const data = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'password123',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject short username', () => {
      const data = {
        email: 'test@example.com',
        username: 'ab',
        password: 'password123',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const data = {
        email: 'test@example.com',
        username: 'validuser',
        password: '12345',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject username with invalid characters', () => {
      const data = {
        email: 'test@example.com',
        username: 'user name', // space not allowed
        password: 'password123',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept username with dash and underscore', () => {
      const data = {
        email: 'test@example.com',
        username: 'user_name-123',
        password: 'password123',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('changePasswordSchema', () => {
    it('should accept valid password change', () => {
      const data = {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      };
      const result = changePasswordSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const data = {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
        confirmPassword: 'different',
      };
      const result = changePasswordSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject short new password', () => {
      const data = {
        currentPassword: 'oldpass123',
        newPassword: '12345',
        confirmPassword: '12345',
      };
      const result = changePasswordSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});

describe('Collection Validation Schemas', () => {
  describe('addCardSchema', () => {
    it('should accept valid card data', () => {
      const data = {
        cardId: 'card-123',
        quantity: 4,
        quantityFoil: 0,
        condition: 'NM',
        language: 'en',
      };
      const result = addCardSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject negative quantity', () => {
      const data = {
        cardId: 'card-123',
        quantity: -1,
        quantityFoil: 0,
      };
      const result = addCardSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject quantity over 999', () => {
      const data = {
        cardId: 'card-123',
        quantity: 1000,
        quantityFoil: 0,
      };
      const result = addCardSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid condition', () => {
      const data = {
        cardId: 'card-123',
        quantity: 4,
        quantityFoil: 0,
        condition: 'INVALID',
      };
      const result = addCardSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});

describe('Deck Validation Schemas', () => {
  describe('createDeckSchema', () => {
    it('should accept valid deck data', () => {
      const data = {
        name: 'My Awesome Deck',
        format: 'Standard',
        description: 'A great deck',
        isPublic: false,
      };
      const result = createDeckSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty deck name', () => {
      const data = {
        name: '',
        format: 'Standard',
      };
      const result = createDeckSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject missing format', () => {
      const data = {
        name: 'My Deck',
      };
      const result = createDeckSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject description over 1000 characters', () => {
      const data = {
        name: 'My Deck',
        format: 'Standard',
        description: 'a'.repeat(1001),
      };
      const result = createDeckSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});
