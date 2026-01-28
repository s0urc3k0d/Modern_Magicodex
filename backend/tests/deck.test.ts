/**
 * Unit tests for deck validation
 */
import { describe, it, expect } from 'vitest';
import { testCards } from './utils/testHelpers';

// Deck format rules (mirroring backend/frontend)
const FORMATS = ['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Historic', 'Commander', 'Pauper'];

const SINGLETON_FORMATS = new Set(['Commander']);

const MAIN_MINIMUM: Record<string, number> = {
  Standard: 60,
  Pioneer: 60,
  Modern: 60,
  Legacy: 60,
  Vintage: 60,
  Historic: 60,
  Commander: 99,
  Pauper: 60,
};

const SIDEBOARD_LIMIT: Record<string, number> = {
  Standard: 15,
  Pioneer: 15,
  Modern: 15,
  Legacy: 15,
  Vintage: 15,
  Historic: 15,
  Commander: 0, // No sideboard in Commander
  Pauper: 15,
};

const COPY_LIMIT: Record<string, number> = {
  Standard: 4,
  Pioneer: 4,
  Modern: 4,
  Legacy: 4,
  Vintage: 4,
  Historic: 4,
  Commander: 1, // Singleton
  Pauper: 4,
};

// Simulated deck cards for testing
interface TestDeckCard {
  card: {
    id: string;
    name: string;
    typeLine: string;
  };
  quantity: number;
  board: 'main' | 'side';
}

function validateDeck(format: string, mainboard: TestDeckCard[], sideboard: TestDeckCard[]) {
  const issues: string[] = [];
  
  // Check mainboard minimum
  const mainCount = mainboard.reduce((sum, dc) => sum + dc.quantity, 0);
  const minRequired = MAIN_MINIMUM[format] || 60;
  if (mainCount < minRequired) {
    issues.push(`Mainboard: ${mainCount}/${minRequired} cartes minimum`);
  }
  
  // Check sideboard limit
  const sideCount = sideboard.reduce((sum, dc) => sum + dc.quantity, 0);
  const sideLimit = SIDEBOARD_LIMIT[format] ?? 15;
  if (sideCount > sideLimit) {
    issues.push(`Sideboard: ${sideCount}/${sideLimit} cartes maximum`);
  }
  
  // Check copy limits
  const copyLimit = COPY_LIMIT[format] || 4;
  const cardCounts = new Map<string, number>();
  
  [...mainboard, ...sideboard].forEach(dc => {
    const name = dc.card.name;
    // Basic lands are unlimited
    if (dc.card.typeLine.includes('Basic Land')) return;
    
    const current = cardCounts.get(name) || 0;
    cardCounts.set(name, current + dc.quantity);
  });
  
  cardCounts.forEach((count, name) => {
    if (count > copyLimit) {
      issues.push(`${name}: ${count}/${copyLimit} exemplaires maximum`);
    }
  });
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

describe('Deck Validation', () => {
  describe('Format Rules', () => {
    it('should have all formats defined', () => {
      FORMATS.forEach(format => {
        expect(MAIN_MINIMUM[format]).toBeDefined();
      });
    });

    it('should identify singleton formats', () => {
      expect(SINGLETON_FORMATS.has('Commander')).toBe(true);
      expect(SINGLETON_FORMATS.has('Standard')).toBe(false);
    });
  });

  describe('Mainboard Validation', () => {
    it('should pass with 60 cards in Standard', () => {
      const mainboard: TestDeckCard[] = Array(15).fill(null).map((_, i) => ({
        card: { id: `card-${i}`, name: `Card ${i}`, typeLine: 'Creature' },
        quantity: 4,
        board: 'main' as const,
      }));
      
      const result = validateDeck('Standard', mainboard, []);
      expect(result.valid).toBe(true);
    });

    it('should fail with less than 60 cards in Standard', () => {
      const mainboard: TestDeckCard[] = Array(10).fill(null).map((_, i) => ({
        card: { id: `card-${i}`, name: `Card ${i}`, typeLine: 'Creature' },
        quantity: 4,
        board: 'main' as const,
      }));
      
      const result = validateDeck('Standard', mainboard, []);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('40/60');
    });

    it('should require 99 cards in Commander', () => {
      const mainboard: TestDeckCard[] = Array(60).fill(null).map((_, i) => ({
        card: { id: `card-${i}`, name: `Card ${i}`, typeLine: 'Creature' },
        quantity: 1,
        board: 'main' as const,
      }));
      
      const result = validateDeck('Commander', mainboard, []);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('99');
    });
  });

  describe('Sideboard Validation', () => {
    it('should pass with 15 sideboard cards', () => {
      const mainboard: TestDeckCard[] = Array(15).fill(null).map((_, i) => ({
        card: { id: `card-${i}`, name: `Card ${i}`, typeLine: 'Creature' },
        quantity: 4,
        board: 'main' as const,
      }));
      const sideboard: TestDeckCard[] = Array(5).fill(null).map((_, i) => ({
        card: { id: `side-${i}`, name: `Side ${i}`, typeLine: 'Instant' },
        quantity: 3,
        board: 'side' as const,
      }));
      
      const result = validateDeck('Standard', mainboard, sideboard);
      expect(result.valid).toBe(true);
    });

    it('should fail with more than 15 sideboard cards', () => {
      const mainboard: TestDeckCard[] = Array(15).fill(null).map((_, i) => ({
        card: { id: `card-${i}`, name: `Card ${i}`, typeLine: 'Creature' },
        quantity: 4,
        board: 'main' as const,
      }));
      const sideboard: TestDeckCard[] = Array(8).fill(null).map((_, i) => ({
        card: { id: `side-${i}`, name: `Side ${i}`, typeLine: 'Instant' },
        quantity: 3,
        board: 'side' as const,
      }));
      
      const result = validateDeck('Standard', mainboard, sideboard);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Sideboard'))).toBe(true);
    });
  });

  describe('Copy Limit Validation', () => {
    it('should allow 4 copies in Standard', () => {
      const mainboard: TestDeckCard[] = [
        { card: { id: 'c1', name: 'Serra Angel', typeLine: 'Creature' }, quantity: 4, board: 'main' },
        ...Array(14).fill(null).map((_, i) => ({
          card: { id: `card-${i}`, name: `Card ${i}`, typeLine: 'Creature' },
          quantity: 4,
          board: 'main' as const,
        })),
      ];
      
      const result = validateDeck('Standard', mainboard, []);
      expect(result.valid).toBe(true);
    });

    it('should fail with more than 4 copies in Standard', () => {
      const mainboard: TestDeckCard[] = [
        { card: { id: 'c1', name: 'Serra Angel', typeLine: 'Creature' }, quantity: 5, board: 'main' },
        ...Array(14).fill(null).map((_, i) => ({
          card: { id: `card-${i}`, name: `Card ${i}`, typeLine: 'Creature' },
          quantity: 4,
          board: 'main' as const,
        })),
      ];
      
      const result = validateDeck('Standard', mainboard, []);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Serra Angel'))).toBe(true);
    });

    it('should allow unlimited basic lands', () => {
      const mainboard: TestDeckCard[] = [
        { card: { id: 'plains', name: 'Plains', typeLine: 'Basic Land — Plains' }, quantity: 20, board: 'main' },
        ...Array(10).fill(null).map((_, i) => ({
          card: { id: `card-${i}`, name: `Card ${i}`, typeLine: 'Creature' },
          quantity: 4,
          board: 'main' as const,
        })),
      ];
      
      const result = validateDeck('Standard', mainboard, []);
      expect(result.valid).toBe(true);
    });

    it('should enforce singleton in Commander', () => {
      const mainboard: TestDeckCard[] = [
        { card: { id: 'c1', name: 'Sol Ring', typeLine: 'Artifact' }, quantity: 2, board: 'main' },
        ...Array(97).fill(null).map((_, i) => ({
          card: { id: `card-${i}`, name: `Card ${i}`, typeLine: 'Creature' },
          quantity: 1,
          board: 'main' as const,
        })),
      ];
      
      const result = validateDeck('Commander', mainboard, []);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Sol Ring'))).toBe(true);
    });
  });

  describe('Cross-board Copy Count', () => {
    it('should count copies across mainboard and sideboard', () => {
      const mainboard: TestDeckCard[] = [
        { card: { id: 'c1', name: 'Lightning Bolt', typeLine: 'Instant' }, quantity: 4, board: 'main' },
        ...Array(14).fill(null).map((_, i) => ({
          card: { id: `card-${i}`, name: `Card ${i}`, typeLine: 'Creature' },
          quantity: 4,
          board: 'main' as const,
        })),
      ];
      const sideboard: TestDeckCard[] = [
        { card: { id: 'c1', name: 'Lightning Bolt', typeLine: 'Instant' }, quantity: 1, board: 'side' },
      ];
      
      const result = validateDeck('Modern', mainboard, sideboard);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Lightning Bolt') && i.includes('5/4'))).toBe(true);
    });
  });
});

describe('Deck Statistics', () => {
  it('should calculate mana curve correctly', () => {
    const deckCards = [
      { card: { cmc: 1 }, quantity: 8 },
      { card: { cmc: 2 }, quantity: 12 },
      { card: { cmc: 3 }, quantity: 10 },
      { card: { cmc: 4 }, quantity: 6 },
      { card: { cmc: 5 }, quantity: 4 },
    ];
    
    const manaCurve = new Map<number, number>();
    deckCards.forEach(dc => {
      const cmc = dc.card.cmc;
      manaCurve.set(cmc, (manaCurve.get(cmc) || 0) + dc.quantity);
    });
    
    expect(manaCurve.get(1)).toBe(8);
    expect(manaCurve.get(2)).toBe(12);
    expect(manaCurve.get(3)).toBe(10);
  });

  it('should calculate average CMC correctly', () => {
    const deckCards = [
      { card: { cmc: 1 }, quantity: 4 },
      { card: { cmc: 2 }, quantity: 4 },
      { card: { cmc: 3 }, quantity: 4 },
    ];
    
    const totalCmc = deckCards.reduce((sum, dc) => sum + (dc.card.cmc * dc.quantity), 0);
    const totalCards = deckCards.reduce((sum, dc) => sum + dc.quantity, 0);
    const avgCmc = totalCmc / totalCards;
    
    // (1*4 + 2*4 + 3*4) / 12 = 24/12 = 2
    expect(avgCmc).toBe(2);
  });

  it('should calculate color distribution correctly', () => {
    const deckCards = [
      { card: { colorIdentity: '["W"]' }, quantity: 20 },
      { card: { colorIdentity: '["U"]' }, quantity: 16 },
      { card: { colorIdentity: '["W","U"]' }, quantity: 8 },
      { card: { colorIdentity: '[]' }, quantity: 16 }, // Lands/colorless
    ];
    
    const colorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    
    deckCards.forEach(dc => {
      try {
        const colors = JSON.parse(dc.card.colorIdentity);
        colors.forEach((c: string) => {
          if (c in colorCounts) {
            colorCounts[c as keyof typeof colorCounts] += dc.quantity;
          }
        });
      } catch {}
    });
    
    expect(colorCounts.W).toBe(28); // 20 + 8
    expect(colorCounts.U).toBe(24); // 16 + 8
    expect(colorCounts.B).toBe(0);
  });
});
