// Domain-level normalization utilities for Cards
// Re-exports common helpers and adds domain-specific extras.

import type { Card } from '../../types';
import {
  // parseJsonField (unused here),
  parseImageUris as _parseImageUris,
  parsePrices as _parsePrices,
  pickCardImageUrl,
  getCardPriceEUR,
} from '../../lib/card-normalize';

export const parseImageUris = _parseImageUris;
export const parsePrices = _parsePrices;
export { pickCardImageUrl, getCardPriceEUR };

// Extract color identity from potential JSON string or array, fallback to letter scan
export function extractColors(card: Pick<Card, 'colorIdentity'> | { colorIdentity?: unknown }): string[] {
  const raw = (card as any).colorIdentity;
  let ci: string[] = [];
  if (Array.isArray(raw)) ci = raw as string[];
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) ci = parsed as string[];
      else if (typeof parsed === 'string') ci = parsed.split('').filter((ch) => 'WUBRG'.includes(ch));
      else ci = raw.split('').filter((ch) => 'WUBRG'.includes(ch));
    } catch {
      ci = raw.split('').filter((ch) => 'WUBRG'.includes(ch));
    }
  }
  // normalize and dedupe preserving WUBRG order
  const order = ['W', 'U', 'B', 'R', 'G'];
  const set = new Set(ci);
  return order.filter((c) => set.has(c));
}

// Sort cards/userCards by collector number, then suffix (e.g., 1, 2, ..., 10, 10a)
export function sortByCollector<T extends { card?: { collectorNumber?: string } } | { collectorNumber?: string }>(arr: T[]): T[] {
  const parseCollectorNumber = (cn?: string) => {
    if (!cn) return { num: Number.POSITIVE_INFINITY, suffix: '' };
    const m = cn.match(/^(\d+)([A-Za-z]*)$/);
    if (m) return { num: parseInt(m[1], 10), suffix: m[2] || '' };
    const m2 = cn.match(/(\d+)/);
    if (m2) return { num: parseInt(m2[1], 10), suffix: cn.replace(m2[1], '') };
    return { num: Number.POSITIVE_INFINITY, suffix: cn };
  };
  const getCN = (x: any) => (x.card?.collectorNumber ?? x.collectorNumber) as string | undefined;
  return arr.slice().sort((a, b) => {
    const pa = parseCollectorNumber(getCN(a));
    const pb = parseCollectorNumber(getCN(b));
    if (pa.num !== pb.num) return pa.num - pb.num;
    if (pa.suffix === pb.suffix) return 0;
    if (!pa.suffix) return -1;
    if (!pb.suffix) return 1;
    return pa.suffix.localeCompare(pb.suffix);
  });
}

// Safe extra/variant detection with backend flag preference, fallback heuristics
export function isExtraSafe(card: Partial<Card> & { collectorNumber?: string }): boolean {
  if (typeof (card as any).isExtra === 'boolean') return Boolean((card as any).isExtra);
  const cn = card.collectorNumber;
  if (!cn) return false;
  if (/^[A-Za-z]-/.test(cn)) return true; // e.g., A-143
  if (/^\d+[A-Za-z]+$/.test(cn)) return true; // e.g., 10a
  const m = cn.match(/(\d+)/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 400) return true;
  }
  return false;
}

export function normalizeCardBasics(card: Card) {
  const imageUris = parseImageUris(card);
  const prices = parsePrices(card);
  const colors = extractColors(card);
  return { imageUris, prices, colors };
}
