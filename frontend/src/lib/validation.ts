/**
 * Shared validation schemas using Zod for frontend form validation
 * Mirrors backend validation schemas for consistency
 */
import { z } from 'zod';

// ==================
// Auth Schemas
// ==================

export const loginSchema = z.object({
  email: z.string()
    .min(1, 'L\'email est requis')
    .email('Format d\'email invalide'),
  password: z.string()
    .min(1, 'Le mot de passe est requis'),
});

export const registerSchema = z.object({
  email: z.string()
    .min(1, 'L\'email est requis')
    .email('Format d\'email invalide'),
  username: z.string()
    .min(3, 'Le nom d\'utilisateur doit faire au moins 3 caractères')
    .max(30, 'Le nom d\'utilisateur ne peut pas dépasser 30 caractères')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Caractères autorisés : lettres, chiffres, - et _'),
  password: z.string()
    .min(6, 'Le mot de passe doit faire au moins 6 caractères')
    .max(100, 'Le mot de passe est trop long'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Le mot de passe actuel est requis'),
  newPassword: z.string()
    .min(6, 'Le nouveau mot de passe doit faire au moins 6 caractères'),
  confirmPassword: z.string()
    .min(1, 'La confirmation est requise'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

// ==================
// Collection Schemas
// ==================

export const addCardSchema = z.object({
  cardId: z.string().min(1, 'ID de carte requis'),
  quantity: z.number()
    .int('La quantité doit être un entier')
    .min(0, 'Quantité invalide')
    .max(999, 'Maximum 999 exemplaires'),
  quantityFoil: z.number()
    .int('La quantité foil doit être un entier')
    .min(0, 'Quantité invalide')
    .max(999, 'Maximum 999 exemplaires'),
  condition: z.enum(['NM', 'LP', 'MP', 'HP', 'DMG']).default('NM'),
  language: z.string().min(2).max(3).default('en'),
  notes: z.string().max(500, 'Notes trop longues').optional(),
});

export const bulkAddSchema = z.object({
  items: z.array(z.object({
    cardId: z.string().min(1),
    quantity: z.number().int().min(0).max(999).default(0),
    quantityFoil: z.number().int().min(0).max(999).default(0),
  })).min(1, 'Au moins une carte requise'),
  mode: z.enum(['increment', 'set']).default('increment'),
});

// ==================
// Deck Schemas
// ==================

export const createDeckSchema = z.object({
  name: z.string()
    .min(1, 'Le nom du deck est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  description: z.string()
    .max(1000, 'La description est trop longue')
    .optional(),
  format: z.string()
    .min(1, 'Le format est requis'),
  archetype: z.string().optional(),
  isPublic: z.boolean().default(false),
});

export const updateDeckSchema = createDeckSchema.partial();

export const addCardToDeckSchema = z.object({
  cardId: z.string().min(1, 'ID de carte requis'),
  quantity: z.number()
    .int()
    .min(1, 'Minimum 1 carte')
    .max(99, 'Maximum 99 exemplaires'),
  board: z.enum(['main', 'side', 'maybe']).default('main'),
});

// ==================
// Search Schemas
// ==================

export const searchFiltersSchema = z.object({
  query: z.string().optional(),
  colors: z.array(z.string()).optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']).optional(),
  setId: z.string().optional(),
  minEur: z.number().min(0).optional(),
  maxEur: z.number().min(0).optional(),
  extras: z.boolean().optional(),
});

// ==================
// Type exports
// ==================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AddCardInput = z.infer<typeof addCardSchema>;
export type BulkAddInput = z.infer<typeof bulkAddSchema>;
export type CreateDeckInput = z.infer<typeof createDeckSchema>;
export type UpdateDeckInput = z.infer<typeof updateDeckSchema>;
export type AddCardToDeckInput = z.infer<typeof addCardToDeckSchema>;
export type SearchFiltersInput = z.infer<typeof searchFiltersSchema>;
