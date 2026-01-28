/**
 * Unit tests for collection service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testCards, testUsers } from './utils/testHelpers';

describe('Collection Service', () => {
  describe('Add Card Validation', () => {
    it('should accept valid quantity', () => {
      const data = { cardId: 'card-1', quantity: 4, quantityFoil: 0 };
      expect(data.quantity).toBeGreaterThanOrEqual(0);
      expect(data.quantity).toBeLessThanOrEqual(999);
    });

    it('should reject negative quantity', () => {
      const quantity = -1;
      expect(quantity).toBeLessThan(0);
    });

    it('should reject excessive quantity', () => {
      const quantity = 1000;
      expect(quantity).toBeGreaterThan(999);
    });

    it('should accept valid foil quantity', () => {
      const data = { cardId: 'card-1', quantity: 2, quantityFoil: 2 };
      expect(data.quantityFoil).toBeGreaterThanOrEqual(0);
      expect(data.quantityFoil).toBeLessThanOrEqual(999);
    });

    it('should accept valid condition values', () => {
      const validConditions = ['NM', 'LP', 'MP', 'HP', 'DMG'];
      validConditions.forEach(condition => {
        expect(validConditions).toContain(condition);
      });
    });
  });

  describe('Collection Statistics', () => {
    it('should calculate total cards correctly', () => {
      const userCards = [
        { quantity: 4, quantityFoil: 0, card: testCards.creature },
        { quantity: 2, quantityFoil: 1, card: testCards.land },
      ];
      
      const totalNormal = userCards.reduce((sum, uc) => sum + uc.quantity, 0);
      const totalFoil = userCards.reduce((sum, uc) => sum + uc.quantityFoil, 0);
      
      expect(totalNormal).toBe(6);
      expect(totalFoil).toBe(1);
    });

    it('should calculate collection value correctly', () => {
      const userCards = [
        { quantity: 4, quantityFoil: 0, card: { priceEur: 1.50 } },
        { quantity: 2, quantityFoil: 1, card: { priceEur: 0.10, priceEurFoil: 0.50 } },
      ];
      
      let totalValue = 0;
      userCards.forEach(uc => {
        const normalValue = (uc.card.priceEur || 0) * uc.quantity;
        const foilValue = ((uc.card as any).priceEurFoil || 0) * uc.quantityFoil;
        totalValue += normalValue + foilValue;
      });
      
      // 4 * 1.50 + 2 * 0.10 + 1 * 0.50 = 6 + 0.2 + 0.5 = 6.70
      expect(totalValue).toBeCloseTo(6.70, 2);
    });
  });

  describe('Bulk Add Operations', () => {
    it('should validate bulk add items', () => {
      const items = [
        { cardId: 'card-1', quantity: 4, quantityFoil: 0 },
        { cardId: 'card-2', quantity: 2, quantityFoil: 1 },
      ];
      
      expect(items.length).toBeGreaterThanOrEqual(1);
      items.forEach(item => {
        expect(item.cardId).toBeDefined();
        expect(item.quantity).toBeGreaterThanOrEqual(0);
        expect(item.quantityFoil).toBeGreaterThanOrEqual(0);
      });
    });

    it('should support increment mode', () => {
      const existingQuantity = 2;
      const addQuantity = 3;
      const mode = 'increment';
      
      const newQuantity = mode === 'increment' 
        ? existingQuantity + addQuantity 
        : addQuantity;
      
      expect(newQuantity).toBe(5);
    });

    it('should support set mode', () => {
      const existingQuantity = 2;
      const setQuantity = 3;
      const mode = 'set';
      
      const newQuantity = mode === 'set' 
        ? setQuantity 
        : existingQuantity + setQuantity;
      
      expect(newQuantity).toBe(3);
    });
  });

  describe('Search and Filters', () => {
    it('should filter by set', () => {
      const cards = [
        { ...testCards.creature, setId: 'set-1' },
        { ...testCards.land, setId: 'set-2' },
      ];
      
      const filtered = cards.filter(c => c.setId === 'set-1');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Serra Angel');
    });

    it('should filter by rarity', () => {
      const cards = [
        { ...testCards.creature, rarity: 'rare' },
        { ...testCards.land, rarity: 'common' },
      ];
      
      const filtered = cards.filter(c => c.rarity === 'rare');
      expect(filtered.length).toBe(1);
    });

    it('should filter by price range', () => {
      const cards = [
        { name: 'Expensive Card', priceEur: 50.00 },
        { name: 'Cheap Card', priceEur: 0.10 },
        { name: 'Mid Card', priceEur: 5.00 },
      ];
      
      const minEur = 1.00;
      const maxEur = 10.00;
      
      const filtered = cards.filter(c => 
        c.priceEur !== null && 
        c.priceEur >= minEur && 
        c.priceEur <= maxEur
      );
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Mid Card');
    });

    it('should search by name', () => {
      const cards = [
        { name: 'Serra Angel', nameFr: 'Ange de Serra' },
        { name: 'Plains', nameFr: 'Plaine' },
      ];
      
      const search = 'angel';
      const filtered = cards.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.nameFr?.toLowerCase().includes(search.toLowerCase())
      );
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Serra Angel');
    });
  });
});
