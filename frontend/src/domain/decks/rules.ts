// Centralized deck rules and helpers for formats

export type DeckFormat = 'Standard' | 'Pioneer' | 'Modern' | 'Legacy' | 'Vintage' | 'Historic' | 'Commander' | 'Alchemy' | 'Brawl' | 'Pauper' | 'Casual';

// Formats with singleton rule for mainboard
export const SINGLETON_FORMATS = new Set<DeckFormat>(['Commander']);

// Minimum mainboard size per format
export const MAIN_MINIMUM: Record<DeckFormat, number> = {
  Standard: 60,
  Pioneer: 60,
  Modern: 60,
  Legacy: 60,
  Vintage: 60,
  Historic: 60,
  Commander: 99,
  Alchemy: 60,
  Brawl: 60,
  Pauper: 60,
  Casual: 60,
};

// Sideboard limit when applicable
export const SIDEBOARD_LIMIT: Partial<Record<DeckFormat, number>> = {
  Standard: 15,
  Pioneer: 15,
  Modern: 15,
  Legacy: 15,
  Vintage: 15,
  Historic: 15,
  // Commander has no sideboard by default; others can be added as needed
};

// Banlists by format (names should match either FR or EN; comparison is case-insensitive)
// Keep empty to avoid accidental blocking; populate incrementally as needed.
export const BANLIST: Record<DeckFormat, string[]> = {
  Standard: [],
  Pioneer: [],
  Modern: [],
  Legacy: [],
  Vintage: [],
  Historic: [],
  Commander: [],
  Alchemy: [],
  Brawl: [],
  Pauper: [],
  Casual: [],
};

export function isSingletonFormat(format: string): boolean {
  return SINGLETON_FORMATS.has(format as DeckFormat);
}

export function getMainMinimum(format: string): number {
  return MAIN_MINIMUM[(format as DeckFormat)] ?? 60;
}

export function getSideboardLimit(format: string): number | undefined {
  return (SIDEBOARD_LIMIT as any)[format];
}

export function getBanList(format: string): string[] {
  return BANLIST[(format as DeckFormat)] ?? [];
}

export function copyLimitFor(format: string): number {
  return isSingletonFormat(format) ? 1 : 4;
}
