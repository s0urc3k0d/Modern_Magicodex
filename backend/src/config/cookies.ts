/**
 * Cookie configuration for secure refresh tokens
 */

import type { CookieOptions } from 'express';

// Cookie name for refresh token
export const REFRESH_TOKEN_COOKIE = 'magicodex_refresh';

// Cookie options for refresh token
export function getRefreshTokenCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true,           // Not accessible via JavaScript
    secure: isProduction,     // HTTPS only in production
    sameSite: 'lax',          // Permet navigation normale tout en protégeant contre CSRF
    path: '/',                // Envoyé pour toutes les routes (refresh plus fiable)
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours en millisecondes
  };
}

// Cookie options to clear the refresh token
export function getClearCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  };
}

// Token configuration
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '1h',        // 1 heure (augmenté pour meilleure UX)
  REFRESH_TOKEN_EXPIRY_DAYS: 30,    // 30 jours (augmenté pour moins de reconnexions)
  
  // Password requirements
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBER: true,
  PASSWORD_REQUIRE_SPECIAL: false,
  
  // Rate limiting
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
} as const;

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < TOKEN_CONFIG.PASSWORD_MIN_LENGTH) {
    errors.push(`Le mot de passe doit contenir au moins ${TOKEN_CONFIG.PASSWORD_MIN_LENGTH} caractères`);
  }
  
  if (TOKEN_CONFIG.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule');
  }
  
  if (TOKEN_CONFIG.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une minuscule');
  }
  
  if (TOKEN_CONFIG.PASSWORD_REQUIRE_NUMBER && !/\d/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre');
  }
  
  if (TOKEN_CONFIG.PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un caractère spécial');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
