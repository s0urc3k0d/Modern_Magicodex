import { describe, it, expect } from 'vitest';
import { extractColors, sortByCollector, isExtraSafe } from './normalize';

describe('card normalize', () => {
  it('extractColors parses arrays, JSON strings, and raw letters', () => {
    expect(extractColors({ colorIdentity: [ 'W', 'U' ] as any })).toEqual(['W','U']);
    expect(extractColors({ colorIdentity: '["B","R"]' as any })).toEqual(['B','R']);
    expect(extractColors({ colorIdentity: 'WUB' as any })).toEqual(['W','U','B']);
    expect(extractColors({ colorIdentity: undefined as any })).toEqual([]);
  });

  it('sortByCollector orders numerically then by suffix', () => {
    const items = [
      { collectorNumber: '10a' },
      { collectorNumber: '2' },
      { collectorNumber: '10' },
      { collectorNumber: '1' },
    ];
    const sorted = sortByCollector(items).map(i => i.collectorNumber);
    expect(sorted).toEqual(['1','2','10','10a']);
  });

  it('isExtraSafe prefers backend flag and falls back to heuristics', () => {
    expect(isExtraSafe({ isExtra: true } as any)).toBe(true);
    expect(isExtraSafe({ collectorNumber: 'A-143' } as any)).toBe(true);
    expect(isExtraSafe({ collectorNumber: '10a' } as any)).toBe(true);
    expect(isExtraSafe({ collectorNumber: '12' } as any)).toBe(false);
  });
});
