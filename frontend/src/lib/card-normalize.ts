// Lightweight normalization utilities for Card JSON fields coming from backend
// Some fields (imageUris, prices, colors, colorIdentity) may arrive as JSON strings.
// These helpers parse safely and provide convenient selectors.

import type { Card } from '../types';

type ImageUris = {
  small?: string;
  normal?: string;
  large?: string;
  art_crop?: string;
  [k: string]: string | undefined;
};

type Prices = {
  usd?: string;
  usd_foil?: string;
  eur?: string;
  eur_foil?: string;
  [k: string]: string | undefined;
};

export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return (value as T) ?? fallback;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return (parsed ?? fallback) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function parseImageUris(card: Pick<Card, 'imageUris'> | { imageUris?: unknown }): ImageUris {
  return parseJsonField<ImageUris>((card as any).imageUris, {});
}

export function parsePrices(card: Pick<Card, 'prices'> | { prices?: unknown }): Prices {
  return parseJsonField<Prices>((card as any).prices, {});
}

export function pickCardImageUrl(imageUris: ImageUris, preferred: 'normal' | 'large' | 'small' = 'normal'): string | null {
  const order: Array<keyof ImageUris> = preferred === 'normal'
    ? ['normal', 'large', 'small']
    : preferred === 'large'
      ? ['large', 'normal', 'small']
      : ['small', 'normal', 'large'];
  for (const key of order) {
    const url = imageUris[key];
    if (typeof url === 'string' && url.length > 0) return url;
  }
  return null;
}

export function getCardPriceEUR(prices: Prices, foil = false): number | null {
  const raw = foil ? prices.eur_foil : prices.eur;
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function normalizeCardBasics(card: Card) {
  const imageUris = parseImageUris(card);
  const prices = parsePrices(card);
  return { imageUris, prices };
}
