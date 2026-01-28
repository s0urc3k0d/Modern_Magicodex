/**
 * Recalculates the isExtra field for all cards based on the corrected logic.
 * 
 * The previous logic incorrectly marked cards as extras if:
 * - full_art === true (many normal cards have full art, like basic lands)
 * - fullart was in frame_effects
 * 
 * The corrected logic only marks cards as extras if:
 * - promo === true or has promo_types
 * - variation === true
 * - booster === false (explicitly)
 * - Has special frame effects: extendedart, showcase, borderless, etched, inverted, shatteredglass, textless, fandfc
 * 
 * Usage: npx ts-node src/scripts/recalculate-is-extra.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const extraFrameEffects = ['extendedart', 'showcase', 'borderless', 'etched', 'inverted', 'shatteredglass', 'textless', 'fandfc'];

function computeIsExtraCorrected(card: {
  booster: boolean | null;
  promo: boolean | null;
  variation: boolean | null;
  frameEffects: string | null;
  promoTypes: string | null;
}): boolean {
  // Parse frame effects
  let frameEffects: string[] = [];
  if (card.frameEffects) {
    try {
      frameEffects = JSON.parse(card.frameEffects);
    } catch {
      frameEffects = [];
    }
  }

  // Parse promo types
  let promoTypes: string[] = [];
  if (card.promoTypes) {
    try {
      promoTypes = JSON.parse(card.promoTypes);
    } catch {
      promoTypes = [];
    }
  }

  // Special frame effects that indicate extras
  const hasSpecialFrame = Array.isArray(frameEffects) && 
    frameEffects.some((f) => extraFrameEffects.includes(f.toLowerCase()));

  // Promo cards are extras
  const hasPromo = card.promo === true || (Array.isArray(promoTypes) && promoTypes.length > 0);

  // Cards not found in boosters are extras (only if explicitly false)
  const isNonBooster = card.booster === false;

  // Variation flag indicates alternate art
  const isVariation = card.variation === true;

  // Note: full_art is intentionally NOT included - many normal cards are full-art
  return Boolean(hasPromo || isVariation || hasSpecialFrame || isNonBooster);
}

async function main() {
  console.log('Starting isExtra recalculation...');
  
  const batchSize = 1000;
  let processed = 0;
  let updated = 0;
  let cursor: string | undefined;

  while (true) {
    const cards = await prisma.card.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        name: true,
        collectorNumber: true,
        isExtra: true,
        booster: true,
        promo: true,
        variation: true,
        frameEffects: true,
        promoTypes: true,
      },
      orderBy: { id: 'asc' }
    });

    if (cards.length === 0) break;

    for (const card of cards) {
      const shouldBeExtra = computeIsExtraCorrected(card);
      
      if (card.isExtra !== shouldBeExtra) {
        await prisma.card.update({
          where: { id: card.id },
          data: { isExtra: shouldBeExtra }
        });
        updated++;
        
        if (updated <= 20 || updated % 100 === 0) {
          console.log(`Updated: ${card.name} (${card.collectorNumber}) - isExtra: ${card.isExtra} -> ${shouldBeExtra}`);
        }
      }
    }

    processed += cards.length;
    cursor = cards[cards.length - 1].id;
    
    console.log(`Processed ${processed} cards, updated ${updated} so far...`);
  }

  console.log(`\nCompleted! Processed ${processed} cards, updated ${updated} cards.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
