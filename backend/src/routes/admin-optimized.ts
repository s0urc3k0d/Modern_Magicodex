import { Router } from 'express';
import { OptimizedScryfallService } from '../services/scryfall-optimized';
import { cleanDatabase } from '../scripts/clean-database';

const router = Router();

/**
 * Clean database endpoint - removes all cards for fresh testing
 */
router.post('/database/clean', async (req, res) => {
  try {
    console.log('🧹 Database cleanup requested');
    
    const result = await cleanDatabase();
    
    res.json({ 
      success: true, 
      message: 'Database cleaned successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Test endpoint for optimized synchronization
 */
router.post('/sync/optimized', async (req, res) => {
  try {
    const { type, setCode, language = 'fr', force = false } = req.body;
    
    console.log(`🚀 Starting optimized sync: type=${type}, setCode=${setCode}, language=${language}, force=${force}`);
    
    const scryfallService = new OptimizedScryfallService();
    
    if (type === 'cards-test') {
      // Test with a small set first
      await scryfallService.syncCardsTestOptimized(setCode || 'dmu');
      res.json({ 
        success: true, 
        message: 'Optimized test sync completed successfully',
        type: 'cards-test',
        setCode: setCode || 'dmu'
      });
    } else if (type === 'cards') {
      // Full optimized sync
      await scryfallService.syncCardsOptimized(setCode, language, force);
      res.json({ 
        success: true, 
        message: 'Optimized cards sync completed successfully',
        type: 'cards',
        language,
        setCode: setCode || 'all standard'
      });
    } else if (type === 'french-update') {
      // Update French translations
      await scryfallService.updateFrenchTranslationsOptimized();
      res.json({ 
        success: true, 
        message: 'French translations update completed successfully',
        type: 'french-update'
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid sync type. Use: cards-test, cards, or french-update' 
      });
    }
    
  } catch (error) {
    console.error('❌ Optimized sync failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get sync performance stats
 */
router.get('/sync/stats', async (req, res) => {
  try {
    const { prisma } = await import('../db/prisma');
    
    // Get recent sync records
    const recentSyncs = await prisma.scryfallSync.findMany({
      where: { type: 'cards' },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    // Get card counts by language
    const cardStats = await prisma.card.groupBy({
      by: ['lang'],
      _count: {
        id: true
      }
    });
    
    // Get total cards count
    const totalCards = await prisma.card.count();
    
    res.json({
      success: true,
      data: {
        totalCards,
        cardsByLanguage: cardStats,
        recentSyncs: recentSyncs.map(sync => ({
          id: sync.id,
          type: sync.type,
          status: sync.status,
          message: sync.message,
          recordsProcessed: sync.recordsProcessed,
          lastSync: sync.lastSync,
          createdAt: sync.createdAt
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting sync stats:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;
