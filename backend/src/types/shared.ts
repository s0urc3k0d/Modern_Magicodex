/**
 * Shared Types for Magicodex
 * These types are used by both backend and frontend
 * Keep in sync between /backend/src/types/shared.ts and /frontend/src/types/shared.ts
 */

// =============================================================================
// Card Types
// =============================================================================

export interface CardPrices {
  usd?: string | null;
  usd_foil?: string | null;
  eur?: string | null;
  eur_foil?: string | null;
  tix?: string | null;
}

export interface CardImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface CardLegalities {
  standard?: string;
  pioneer?: string;
  modern?: string;
  legacy?: string;
  vintage?: string;
  commander?: string;
  brawl?: string;
  historic?: string;
  pauper?: string;
  [key: string]: string | undefined;
}

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';
export type ColorIdentity = ManaColor[];

export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus';

export type Condition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';

// =============================================================================
// Deck Types
// =============================================================================

export type DeckFormat = 
  | 'Standard' 
  | 'Pioneer' 
  | 'Modern' 
  | 'Legacy' 
  | 'Vintage' 
  | 'Historic' 
  | 'Commander' 
  | 'Alchemy' 
  | 'Brawl' 
  | 'Pauper' 
  | 'Casual';

export type DeckArchetype = 
  | 'Aggro' 
  | 'Control' 
  | 'Midrange' 
  | 'Combo' 
  | 'Ramp' 
  | 'Tempo' 
  | 'Prison' 
  | 'Burn';

export type DeckBoard = 'main' | 'side' | 'maybe';

// =============================================================================
// List Types
// =============================================================================

export type ListType = 'WISHLIST' | 'TRADE';

// =============================================================================
// API Response Types
// =============================================================================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CursorPaginationMeta {
  nextCursor?: string;
  prevCursor?: string;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  details?: unknown;
  code?: string;
}

// =============================================================================
// Sync Types
// =============================================================================

export type SyncStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

export type SyncType = 'sets' | 'cards' | 'translations' | 'full';
