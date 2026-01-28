// Shared helper to compute whether a Scryfall card is considered an "extra" (variants, promos, non-booster, etc.)

export type ScryfallCardRaw = {
  booster?: boolean;
  promo?: boolean;
  variation?: boolean;
  full_art?: boolean;
  frame_effects?: string[];
  promo_types?: string[];
  border_color?: string;
};

// PromoTypes that do NOT indicate extras - they're just markers for set type or normal variants
const NON_EXTRA_PROMO_TYPES = [
  'universesbeyond',  // Collaboration sets (Marvel, Avatar, Final Fantasy, etc.)
  'boosterfun',       // Alternative art variants found in normal boosters
  'ffi', 'ffii', 'ffiii', 'ffiv', 'ffv', 'ffvi', 'ffvii', 'ffviii', 'ffix', 'ffx', 
  'ffxi', 'ffxii', 'ffxiii', 'ffxiv', 'ffxv', 'ffxvi',  // Final Fantasy markers
];

export function computeIsExtra(card: ScryfallCardRaw): boolean {
  const frameEffects = (card.frame_effects || []);
  const promoTypes = (card.promo_types || []);
  
  // Special frame effects that indicate extras (special treatments only)
  // NOT included: fullart, legendary, enchantment, miracle, nyxtouched, companion, etc. (normal card frames)
  const extraFrameEffects = ['extendedart', 'showcase', 'borderless', 'etched', 'inverted', 'shatteredglass', 'textless'];
  const hasSpecialFrame = Array.isArray(frameEffects) && frameEffects.some((f) => extraFrameEffects.includes(f));
  
  // Filter out non-extra promo types before checking
  const significantPromoTypes = Array.isArray(promoTypes) 
    ? promoTypes.filter(pt => !NON_EXTRA_PROMO_TYPES.includes(pt.toLowerCase()))
    : [];
  
  // Promo cards are extras only if they have significant promo types
  const hasPromo = card.promo === true || significantPromoTypes.length > 0;
  
  // Cards not found in boosters are extras (but only if explicitly set to false)
  const isNonBooster = card.booster === false;
  
  // Variation flag indicates alternate art
  const isVariation = card.variation === true;
  
  // Note: full_art alone is NOT an indicator of extras
  // Many normal cards (like basic lands) are full-art in their standard booster version
  // The 'fullart' frame_effect is different and is handled in extraFrameEffects
  
  return Boolean(hasPromo || isVariation || hasSpecialFrame || isNonBooster);
}
