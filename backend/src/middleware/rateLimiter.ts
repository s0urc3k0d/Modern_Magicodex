import rateLimit from 'express-rate-limit';

// Configuration différente selon l'environnement
const isDevelopment = process.env.NODE_ENV === 'development';

// Global rate limiter - generous to avoid blocking legitimate users
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: isDevelopment ? 5000 : 500, // Generous: users adding many cards at once
  message: {
    error: 'Trop de requêtes, veuillez réessayer dans quelques minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: !isDevelopment,
});

// Auth endpoints rate limiter (more restrictive to prevent brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: isDevelopment ? 100 : 10, // Slightly relaxed but still protective
  message: {
    error: 'Trop de tentatives de connexion, veuillez réessayer plus tard.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: !isDevelopment,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// API endpoints rate limiter (moderate for regular browsing)
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: isDevelopment ? 500 : 120, // ~2 requests/sec average, allows bursts
  message: {
    error: 'Trop de requêtes API, veuillez ralentir.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: !isDevelopment,
});

// Collection bulk operations limiter - very generous for initial setup
// Users adding their entire collection need high throughput
export const collectionBulkLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: isDevelopment ? 2000 : 500, // 500 bulk ops per 5 min = ~100 cards/min
  message: {
    error: 'Ajout en masse temporairement limité. Attendez quelques minutes avant de continuer.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: !isDevelopment,
});

// Collection single card operations - generous for rapid adds
export const collectionCardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: isDevelopment ? 1000 : 300, // 300 cards/min should handle rapid scanning
  message: {
    error: 'Ajout de cartes temporairement limité. Attendez quelques secondes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: !isDevelopment,
});

// Admin endpoints rate limiter (moderate for dashboard)
export const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: isDevelopment ? 1000 : 100,
  message: {
    error: 'Trop de requêtes admin, veuillez réessayer.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: !isDevelopment,
});

// Deck operations limiter - moderate, decks are edited less frequently
export const deckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: isDevelopment ? 500 : 150, // Enough for active deck building
  message: {
    error: 'Trop d\'opérations sur les decks, veuillez ralentir.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: !isDevelopment,
});
