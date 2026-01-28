import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script pour nettoyer toutes les cartes et sets de la base de données
 * Permet de tester les améliorations de synchronisation en conditions réelles
 */
async function cleanDatabase() {
  try {
    console.log('🧹 Starting database cleanup...');
    
    // Get current counts
    const currentCounts = {
      cards: await prisma.card.count(),
      sets: await prisma.set.count(),
      userCards: await prisma.userCard.count(),
      deckCards: await prisma.deckCard.count(),
      scryfallSyncs: await prisma.scryfallSync.count()
    };
    
    console.log('📊 Current database state:');
    console.log(`   - Cards: ${currentCounts.cards}`);
    console.log(`   - Sets: ${currentCounts.sets}`);
    console.log(`   - User Cards: ${currentCounts.userCards}`);
    console.log(`   - Deck Cards: ${currentCounts.deckCards}`);
    console.log(`   - Scryfall Syncs: ${currentCounts.scryfallSyncs}`);
    
    if (currentCounts.cards === 0 && currentCounts.sets === 0) {
      console.log('✅ Database is already clean - no cards or sets to delete!');
      return;
    }
    
    console.log('🗑️  Starting deletion process...');
    
    // Delete in correct order due to foreign key constraints
    
    // 1. Delete deck cards (references cards)
    if (currentCounts.deckCards > 0) {
      console.log('   Deleting deck cards...');
      const deletedDeckCards = await prisma.deckCard.deleteMany({});
      console.log(`   ✅ Deleted ${deletedDeckCards.count} deck cards`);
    }
    
    // 2. Delete user cards (references cards)
    if (currentCounts.userCards > 0) {
      console.log('   Deleting user cards...');
      const deletedUserCards = await prisma.userCard.deleteMany({});
      console.log(`   ✅ Deleted ${deletedUserCards.count} user cards`);
    }
    
    // 3. Delete all cards
    console.log('   Deleting all cards...');
    const deletedCards = await prisma.card.deleteMany({});
    console.log(`   ✅ Deleted ${deletedCards.count} cards`);
    
    // 4. Delete all sets (after cards are deleted)
    console.log('   Deleting all sets...');
    const deletedSets = await prisma.set.deleteMany({});
    console.log(`   ✅ Deleted ${deletedSets.count} sets`);
    
    // 5. Optionally clean sync history (keep for debugging)
    console.log('   Cleaning old sync records (keeping last 5)...');
    const oldSyncs = await prisma.scryfallSync.findMany({
      orderBy: { createdAt: 'desc' },
      skip: 5 // Keep last 5 records
    });
    
    if (oldSyncs.length > 0) {
      const deletedSyncs = await prisma.scryfallSync.deleteMany({
        where: {
          id: {
            in: oldSyncs.map((sync: any) => sync.id)
          }
        }
      });
      console.log(`   ✅ Deleted ${deletedSyncs.count} old sync records`);
    }
    
    // Verify cleanup
    const finalCounts = {
      cards: await prisma.card.count(),
      sets: await prisma.set.count(),
      userCards: await prisma.userCard.count(),
      deckCards: await prisma.deckCard.count(),
      scryfallSyncs: await prisma.scryfallSync.count()
    };
    
    console.log('🎉 Database cleanup completed successfully!');
    console.log('📊 Final database state:');
    console.log(`   - Cards: ${finalCounts.cards}`);
    console.log(`   - Sets: ${finalCounts.sets}`);
    console.log(`   - User Cards: ${finalCounts.userCards}`);
    console.log(`   - Deck Cards: ${finalCounts.deckCards}`);
    console.log(`   - Scryfall Syncs: ${finalCounts.scryfallSyncs}`);
    
    return {
      success: true,
      deleted: {
        cards: deletedCards.count,
        sets: deletedSets.count,
        userCards: currentCounts.userCards,
        deckCards: currentCounts.deckCards
      },
      finalCounts
    };
    
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running this script directly
if (require.main === module) {
  cleanDatabase()
    .then(() => {
      console.log('✅ Cleanup script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup script failed:', error);
      process.exit(1);
    });
}

export { cleanDatabase };
