/**
 * Tests for API error handling utilities
 */
import { describe, it, expect } from 'vitest';
import { 
  getErrorMessage, 
  isNetworkError, 
  isAuthError, 
  isRateLimitError,
  isValidationError,
} from '../lib/apiErrors';
import type { AxiosError } from 'axios';

// Helper to create mock Axios errors
function createAxiosError(
  status: number,
  data?: Record<string, unknown>,
  message = 'Request failed'
): AxiosError {
  const error = new Error(message) as AxiosError;
  error.isAxiosError = true;
  error.response = {
    status,
    data: data || {},
    statusText: 'Error',
    headers: {},
    config: {} as any,
  };
  error.config = {} as any;
  return error;
}

function createNetworkError(): AxiosError {
  const error = new Error('Network Error') as AxiosError;
  error.isAxiosError = true;
  error.response = undefined;
  error.code = 'ERR_NETWORK';
  error.config = {} as any;
  return error;
}

describe('getErrorMessage', () => {
  it('should extract error from response.data.error', () => {
    const error = createAxiosError(400, { error: 'Email invalide' });
    expect(getErrorMessage(error)).toBe('Email invalide');
  });

  it('should extract error from response.data.message', () => {
    const error = createAxiosError(400, { message: 'Validation failed' });
    expect(getErrorMessage(error)).toBe('Validation failed');
  });

  it('should return status message for known HTTP codes', () => {
    const error401 = createAxiosError(401);
    expect(getErrorMessage(error401)).toContain('Session expirée');

    const error404 = createAxiosError(404);
    expect(getErrorMessage(error404)).toContain('non trouvée');

    const error429 = createAxiosError(429);
    expect(getErrorMessage(error429)).toContain('Trop de requêtes');

    const error500 = createAxiosError(500);
    expect(getErrorMessage(error500)).toContain('Erreur serveur');
  });

  it('should handle network errors', () => {
    const error = createNetworkError();
    expect(getErrorMessage(error)).toContain('connexion');
  });

  it('should handle standard Error objects', () => {
    const error = new Error('Something went wrong');
    expect(getErrorMessage(error)).toBe('Something went wrong');
  });

  it('should return fallback for unknown errors', () => {
    expect(getErrorMessage(null)).toContain('inattendue');
    expect(getErrorMessage(undefined)).toContain('inattendue');
    expect(getErrorMessage('string error')).toContain('inattendue');
  });

  it('should translate known error patterns', () => {
    const error = createAxiosError(400, { error: 'Invalid token' });
    expect(getErrorMessage(error)).toContain('Session');
  });
});

describe('Error type checkers', () => {
  describe('isNetworkError', () => {
    it('should return true for network errors', () => {
      const error = createNetworkError();
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return false for HTTP errors', () => {
      const error = createAxiosError(500);
      expect(isNetworkError(error)).toBe(false);
    });

    it('should return false for non-axios errors', () => {
      expect(isNetworkError(new Error('test'))).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for 401 errors', () => {
      const error = createAxiosError(401);
      expect(isAuthError(error)).toBe(true);
    });

    it('should return true for 403 errors', () => {
      const error = createAxiosError(403);
      expect(isAuthError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = createAxiosError(400);
      expect(isAuthError(error)).toBe(false);
    });
  });

  describe('isRateLimitError', () => {
    it('should return true for 429 errors', () => {
      const error = createAxiosError(429);
      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = createAxiosError(500);
      expect(isRateLimitError(error)).toBe(false);
    });
  });

  describe('isValidationError', () => {
    it('should return true for 400 errors', () => {
      const error = createAxiosError(400);
      expect(isValidationError(error)).toBe(true);
    });

    it('should return true for 422 errors', () => {
      const error = createAxiosError(422);
      expect(isValidationError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = createAxiosError(500);
      expect(isValidationError(error)).toBe(false);
    });
  });
});
