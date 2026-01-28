/**
 * Utility functions for card data manipulation
 * Centralized JSON parsing and card normalization
 */

import type { CardPrices, CardImageUris, CardLegalities, ColorIdentity } from '../types/shared';

// =============================================================================
// Safe JSON Parsing
// =============================================================================

/**
 * Safe JSON parse with fallback - handles null, undefined, and invalid JSON
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json || typeof json !== 'string') return fallback;
  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Parse color array from JSON string or array
 */
export function parseColors(value: string | string[] | null | undefined): ColorIdentity {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(c => ['W', 'U', 'B', 'R', 'G'].includes(c)) as ColorIdentity;
  return safeJsonParse<string[]>(value, []).filter(c => ['W', 'U', 'B', 'R', 'G'].includes(c)) as ColorIdentity;
}

/**
 * Parse prices from JSON string
 */
export function parsePrices(value: string | CardPrices | null | undefined): CardPrices {
  if (!value) return {};
  if (typeof value === 'object') return value;
  return safeJsonParse<CardPrices>(value, {});
}

/**
 * Parse image URIs from JSON string
 */
export function parseImageUris(value: string | CardImageUris | null | undefined): CardImageUris {
  if (!value) return {};
  if (typeof value === 'object') return value;
  return safeJsonParse<CardImageUris>(value, {});
}

/**
 * Parse legalities from JSON string
 */
export function parseLegalities(value: string | CardLegalities | null | undefined): CardLegalities {
  if (!value) return {};
  if (typeof value === 'object') return value;
  return safeJsonParse<CardLegalities>(value, {});
}

// =============================================================================
// Card Normalization
// =============================================================================

export interface NormalizedCard {
  imageUris: CardImageUris;
  colors: ColorIdentity;
  colorIdentity: ColorIdentity;
  legalities: CardLegalities;
  prices: CardPrices;
}

/**
 * Parse JSON string fields from a card record returned by Prisma
 * Handles imageUris, colors, colorIdentity, legalities, and prices
 * Returns strongly typed parsed objects
 */
export function parseCardJsonFields<T extends Record<string, unknown>>(card: T): T & NormalizedCard {
  return {
    ...card,
    imageUris: parseImageUris(card.imageUris as string | undefined),
    colors: parseColors(card.colors as string | undefined),
    colorIdentity: parseColors(card.colorIdentity as string | undefined),
    legalities: parseLegalities(card.legalities as string | undefined),
    prices: parsePrices(card.prices as string | undefined),
  };
}

// =============================================================================
// Price Utilities
// =============================================================================

/**
 * Get price from prices object or JSON string
 * @param prices - Prices object or JSON string
 * @param key - Price key (e.g., 'eur', 'usd', 'eur_foil')
 * @returns Price as number or null
 */
export function getPrice(
  prices: string | CardPrices | null | undefined, 
  key: keyof CardPrices
): number | null {
  const parsed = parsePrices(prices);
  const value = parsed[key];
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(num) ? num : null;
}

/**
 * @deprecated Use getPrice instead
 */
export function getPriceFromJson(pricesJson: string | null | undefined, key: string): number | null {
  return getPrice(pricesJson, key as keyof CardPrices);
}

/**
 * Get EUR price (prefers numeric priceEur field, falls back to prices JSON)
 */
export function getEurPrice(card: { priceEur?: number | null; prices?: string | null }): number | null {
  if (typeof card.priceEur === 'number' && Number.isFinite(card.priceEur)) {
    return card.priceEur;
  }
  return getPrice(card.prices, 'eur');
}

/**
 * Get EUR foil price
 */
export function getEurFoilPrice(card: { priceEurFoil?: number | null; prices?: string | null }): number | null {
  if (typeof card.priceEurFoil === 'number' && Number.isFinite(card.priceEurFoil)) {
    return card.priceEurFoil;
  }
  return getPrice(card.prices, 'eur_foil');
}

// =============================================================================
// Image Utilities
// =============================================================================

/**
 * Get best available image URL
 */
export function getImageUrl(
  imageUris: string | CardImageUris | null | undefined,
  preferredSize: 'small' | 'normal' | 'large' | 'art_crop' = 'normal'
): string | null {
  const parsed = parseImageUris(imageUris);
  
  // Priority order based on preference
  const priorities: Record<string, (keyof CardImageUris)[]> = {
    small: ['small', 'normal', 'large'],
    normal: ['normal', 'large', 'small'],
    large: ['large', 'normal', 'small'],
    art_crop: ['art_crop', 'normal', 'large'],
  };
  
  const order = priorities[preferredSize] || priorities.normal;
  for (const key of order) {
    if (parsed[key]) return parsed[key]!;
  }
  
  return null;
}

// =============================================================================
// Extra/Variant Detection
// =============================================================================

const EXTRA_FRAME_EFFECTS = new Set([
  'extendedart', 'showcase', 'borderless', 'etched', 
  'inverted', 'shatteredglass', 'textless', 'fandfc'
]);

/**
 * Determine if a card is an "extra" (promo/variant/special treatment)
 * Mirrors the backend logic for consistency
 */
export function computeIsExtra(card: {
  booster?: boolean | null;
  promo?: boolean | null;
  variation?: boolean | null;
  frameEffects?: string | string[] | null;
  promoTypes?: string | string[] | null;
}): boolean {
  const frameEffects = typeof card.frameEffects === 'string' 
    ? safeJsonParse<string[]>(card.frameEffects, [])
    : card.frameEffects || [];
    
  const promoTypes = typeof card.promoTypes === 'string'
    ? safeJsonParse<string[]>(card.promoTypes, [])
    : card.promoTypes || [];
  
  const hasSpecialFrame = frameEffects.some(f => EXTRA_FRAME_EFFECTS.has(f));
  const hasPromo = card.promo === true || promoTypes.length > 0;
  const isNonBooster = card.booster === false;
  const isVariation = card.variation === true;
  
  return hasPromo || isVariation || hasSpecialFrame || isNonBooster;
}

