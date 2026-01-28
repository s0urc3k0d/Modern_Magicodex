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

export function computeIsExtra(card: ScryfallCardRaw): boolean {
  const frameEffects = (card.frame_effects || []);
  const promoTypes = (card.promo_types || []);
  
  // Special frame effects that indicate extras (showcase, borderless treatments, etc.)
  const extraFrameEffects = ['extendedart', 'showcase', 'borderless', 'etched', 'inverted', 'shatteredglass', 'textless', 'fandfc'];
  const hasSpecialFrame = Array.isArray(frameEffects) && frameEffects.some((f) => extraFrameEffects.includes(f));
  
  // Promo cards are extras
  const hasPromo = card.promo === true || (Array.isArray(promoTypes) && promoTypes.length > 0);
  
  // Cards not found in boosters are extras (but only if explicitly set to false)
  const isNonBooster = card.booster === false;
  
  // Variation flag indicates alternate art
  const isVariation = card.variation === true;
  
  // Note: full_art alone is NOT an indicator of extras
  // Many normal cards (like basic lands) are full-art in their standard booster version
  // The 'fullart' frame_effect is different and is handled in extraFrameEffects
  
  return Boolean(hasPromo || isVariation || hasSpecialFrame || isNonBooster);
}
