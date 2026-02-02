/**
 * Recalculates the isExtra field for all cards based on the corrected logic.
 * 
 * Usage depuis le VPS (hors Docker):
 *   cd /var/www/magicodex/backend
 *   node scripts/recalculate-is-extra.js
 * 
 * Le script charge automatiquement les variables d'environnement depuis .env
 */

const fs = require('fs');
const path = require('path');

// Charger manuellement le .env sans dépendance externe
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('✅ Variables d\'environnement chargées depuis .env');
}

// Vérifier que DATABASE_URL est défini
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL non défini. Assurez-vous que le fichier .env existe et contient DATABASE_URL.');
  console.error('   Vous pouvez aussi l\'exporter manuellement: export DATABASE_URL="postgresql://..."');
  process.exit(1);
}

console.log('📦 Connexion à la base de données...');

// Utiliser Prisma depuis node_modules du backend (via Docker volume ou installation locale)
// Si pas disponible, on utilise pg directement
let prisma;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch (e) {
  console.log('⚠️  Prisma non disponible, utilisation de pg directement...');
  prisma = null;
}

// NOT included: fullart, legendary, enchantment, miracle, nyxtouched, companion, etc. (normal card frames)
const extraFrameEffects = ['extendedart', 'showcase', 'borderless', 'etched', 'inverted', 'shatteredglass', 'textless'];

// PromoTypes that do NOT indicate extras - they're just markers for set type or normal variants
const NON_EXTRA_PROMO_TYPES = [
  'universesbeyond',  // Collaboration sets (Marvel, Avatar, Final Fantasy, etc.)
  'boosterfun',       // Alternative art variants found in normal boosters
  'ffi', 'ffii', 'ffiii', 'ffiv', 'ffv', 'ffvi', 'ffvii', 'ffviii', 'ffix', 'ffx', 
  'ffxi', 'ffxii', 'ffxiii', 'ffxiv', 'ffxv', 'ffxvi',  // Final Fantasy markers
];

function computeIsExtraCorrected(card) {
  // Parse frame effects
  let frameEffects = [];
  if (card.frameEffects) {
    try {
      frameEffects = JSON.parse(card.frameEffects);
    } catch {
      frameEffects = [];
    }
  }

  // Parse promo types
  let promoTypes = [];
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

  // Filter out non-extra promo types before checking
  const significantPromoTypes = Array.isArray(promoTypes) 
    ? promoTypes.filter(pt => !NON_EXTRA_PROMO_TYPES.includes(pt.toLowerCase()))
    : [];

  // Promo cards are extras only if they have significant promo types
  const hasPromo = card.promo === true || significantPromoTypes.length > 0;

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
  let cursor = undefined;

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
