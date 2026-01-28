import { Router } from 'express';
import { CleanScryfallService } from '../services/scryfall-clean';
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
 * 1. SYNCHRONISATION DES SETS
 */
router.post('/sync/sets', async (req, res) => {
  try {
    const { force = false } = req.body;
    
    console.log(`🚀 Starting sets synchronization: force=${force}`);
    
    const scryfallService = new CleanScryfallService();
    await scryfallService.syncSets(force);
    
    res.json({ 
      success: true, 
      message: 'Sets synchronization completed successfully',
      type: 'sets',
      force
    });
    
  } catch (error) {
    console.error('❌ Sets synchronization failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * 2. SYNCHRONISATION DES CARTES
 */
router.post('/sync/cards', async (req, res) => {
  try {
    const { setCode, language = 'en', force = false } = req.body;
    
    console.log(`🚀 Starting cards synchronization: setCode=${setCode}, language=${language}, force=${force}`);
    
    const scryfallService = new CleanScryfallService();
    await scryfallService.syncCards(setCode, language, force);
    
    res.json({ 
      success: true, 
      message: 'Cards synchronization completed successfully',
      type: 'cards',
      setCode,
      language,
      force
    });
    
  } catch (error) {
    console.error('❌ Cards synchronization failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * 3. MISE À JOUR DES TRADUCTIONS FRANÇAISES
 */
router.post('/sync/french-translations', async (req, res) => {
  try {
    const { setCode } = req.body;
    
    console.log(`🚀 Starting French translations update: setCode=${setCode}`);
    
    const scryfallService = new CleanScryfallService();
    await scryfallService.updateFrenchTranslations(setCode);
    
    res.json({ 
      success: true, 
      message: 'French translations update completed successfully',
      type: 'french-translations',
      setCode
    });
    
  } catch (error) {
    console.error('❌ French translations update failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * ENDPOINTS DE TEST
 */
router.post('/test/sets', async (req, res) => {
  try {
    console.log('🧪 Testing sets synchronization...');
    
    const scryfallService = new CleanScryfallService();
    await scryfallService.testSyncSets();
    
    res.json({ 
      success: true, 
      message: 'Sets synchronization test completed successfully'
    });
    
  } catch (error) {
    console.error('❌ Sets synchronization test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

router.post('/test/cards', async (req, res) => {
  try {
    const { setCode = 'dmu' } = req.body;
    
    console.log(`🧪 Testing cards synchronization with set: ${setCode}`);
    
    const scryfallService = new CleanScryfallService();
    await scryfallService.testSyncCards(setCode);
    
    res.json({ 
      success: true, 
      message: 'Cards synchronization test completed successfully',
      setCode
    });
    
  } catch (error) {
    console.error('❌ Cards synchronization test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

router.post('/test/french-translations', async (req, res) => {
  try {
    const { setCode = 'dmu' } = req.body;
    
    console.log(`🧪 Testing French translations update with set: ${setCode}`);
    
    const scryfallService = new CleanScryfallService();
    await scryfallService.testUpdateFrench(setCode);
    
    res.json({ 
      success: true, 
      message: 'French translations update test completed successfully',
      setCode
    });
    
  } catch (error) {
    console.error('❌ French translations update test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * ENDPOINT DE STATISTIQUES
 */
router.get('/sync/stats', async (req, res) => {
  try {
    const scryfallService = new CleanScryfallService();
    // TODO: Implement stats method if needed
    
    res.json({ 
      success: true, 
      message: 'Stats endpoint - to be implemented'
    });
    
  } catch (error) {
    console.error('❌ Stats retrieval failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;
