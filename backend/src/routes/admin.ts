import { Router } from 'express';
import { z } from 'zod';
import { adminService } from '../services/admin';
import { UnifiedScryfallService } from '../services/scryfall-unified';
import { HybridScryfallService } from '../services/scryfall-hybrid';
import { runExtrasDelta } from '../services/extras-delta';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { adminLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply admin rate limiting
router.use(adminLimiter);

// Toutes les routes nécessitent une authentification et des droits admin
router.use(authenticateToken);
router.use(requireAdmin);

// Schémas de validation
const userQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 100) : 50),
  search: z.string().optional()
});

const syncQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 20) : 20)
});

const cleanupSchema = z.object({
  daysToKeep: z.number().min(1).max(365).default(30)
});

/**
 * GET /api/admin/stats
 * Récupère les statistiques générales de l'application
 */
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await adminService.getGeneralStats();
    res.json(stats);
  } catch (error) {
    console.error('Erreur récupération statistiques admin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/users
 * Récupère la liste des utilisateurs avec pagination
 */
router.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const query = userQuerySchema.parse(req.query);
    
    const result = await adminService.getUsers(query.page, query.limit, query.search);
    
    res.json(result);
  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Paramètres invalides', 
        details: error.issues 
      });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/admin/users/:userId
 * Met à jour un utilisateur
 */
router.put('/users/:userId', async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    
    const user = await adminService.updateUser(userId, req.body);
    
    res.json(user);
  } catch (error) {
    console.error('Erreur mise à jour utilisateur:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Données invalides', 
        details: error.issues 
      });
    }
    if (error instanceof Error && (
      error.message === 'Cette adresse email est déjà utilisée' ||
      error.message === 'Ce nom d\'utilisateur est déjà utilisé'
    )) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Supprime un utilisateur
 */
router.delete('/users/:userId', async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    
    // Empêcher l'auto-suppression
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }
    
    await adminService.deleteUser(userId);
    
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    if (error instanceof Error && error.message === 'Utilisateur non trouvé') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/sync/logs
 * Récupère les logs de synchronisation
 */
router.get('/sync/logs', async (req: AuthenticatedRequest, res) => {
  try {
    const query = syncQuerySchema.parse(req.query);
    
    const result = await adminService.getSyncLogs(query.page, query.limit);
    
    res.json(result);
  } catch (error) {
    console.error('Erreur récupération logs sync:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Paramètres invalides', 
        details: error.issues 
      });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/sync/trigger
 * Déclenche une synchronisation manuelle
 */
router.post('/sync/trigger', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await adminService.triggerSync(req.body);
    
    res.json(result);
  } catch (error) {
    console.error('Erreur déclenchement sync:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Données invalides', 
        details: error.issues 
      });
    }
    if (error instanceof Error && error.message === 'Une synchronisation est déjà en cours') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/performance
 * Récupère les métriques de performance
 */
router.get('/performance', async (req: AuthenticatedRequest, res) => {
  try {
    const metrics = await adminService.getPerformanceMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Erreur récupération métriques:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/health
 * Récupère les statistiques de santé du système
 */
router.get('/health', async (req: AuthenticatedRequest, res) => {
  try {
    const health = await adminService.getSystemHealth();
    res.json(health);
  } catch (error) {
    console.error('Erreur récupération santé système:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/cleanup
 * Nettoie les données anciennes
 */
router.post('/cleanup', async (req: AuthenticatedRequest, res) => {
  try {
    const { daysToKeep } = cleanupSchema.parse(req.body);
    
    const result = await adminService.cleanupOldData(daysToKeep);
    
    res.json(result);
  } catch (error) {
    console.error('Erreur nettoyage données:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Données invalides', 
        details: error.issues 
      });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ================================
// ROUTES NOUVEAU SERVICE UNIFIED
// ================================

const unifiedService = new UnifiedScryfallService();
const hybridService = new HybridScryfallService();

/**
 * POST /api/admin/sync-unified/sets
 * Synchronise tous les sets avec le nouveau service unifié
 */
router.post('/sync-unified/sets', async (req: AuthenticatedRequest, res) => {
  try {
    const { force = false } = req.body;
    
    console.log(`🚀 Admin ${req.user?.username} started UNIFIED sets sync (force: ${force})`);
    
    // Lancer la synchronisation en arrière-plan
    unifiedService.syncSetsUnified(force).catch(error => {
      console.error('❌ Unified sets sync failed:', error);
    });
    
    res.json({ 
      message: 'Synchronisation des sets unifiée démarrée en arrière-plan',
      type: 'unified-sets',
      force 
    });
  } catch (error) {
    console.error('Erreur démarrage sync unified sets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/sync-unified/cards
 * Synchronise toutes les cartes avec traductions françaises directement
 */
router.post('/sync-unified/cards', async (req: AuthenticatedRequest, res) => {
  try {
    const { setCode, force = false } = req.body;
    
    console.log(`🚀 Admin ${req.user?.username} started UNIFIED cards sync (set: ${setCode || 'ALL'}, force: ${force})`);
    
    // Lancer la synchronisation en arrière-plan
    unifiedService.syncCardsUnified(setCode, force).catch(error => {
      console.error('❌ Unified cards sync failed:', error);
    });
    
    res.json({ 
      message: `Synchronisation unifiée des cartes démarrée${setCode ? ` pour le set ${setCode}` : ' pour TOUTES les cartes Magic'}`,
      type: 'unified-cards',
      setCode: setCode || 'ALL',
      scope: setCode ? 'single-set' : 'all-magic-cards',
      force 
    });
  } catch (error) {
    console.error('Erreur démarrage sync unified cards:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ================================
// ROUTES NOUVEAU SERVICE HYBRID (EN+FR en première passe)
// ================================

/**
 * POST /api/admin/sync-hybrid/sets
 * Upsert des sets via client HTTP optimisé
 */
router.post('/sync-hybrid/sets', async (req: AuthenticatedRequest, res) => {
  try {
    const { force = false } = req.body;
    hybridService.syncSets(force).catch((e) => console.error('Hybrid sets failed', e));
    res.json({ message: 'Hybrid sets sync started', force });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/sync-hybrid/cards
 * Synchronise un set (EN+FR en une passe)
 */
router.post('/sync-hybrid/cards', async (req: AuthenticatedRequest, res) => {
  try {
    const { setCode, force = false } = req.body;
    if (!setCode) return res.status(400).json({ error: 'setCode requis' });
    hybridService.syncCardsBySet(setCode, force).catch((e) => console.error('Hybrid cards failed', e));
    res.json({ message: `Hybrid cards sync started for ${setCode}`, setCode, force });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/sync-hybrid/full
 * Sets + toutes cartes EN+FR
 */
router.post('/sync-hybrid/full', async (req: AuthenticatedRequest, res) => {
  try {
    const { force = false } = req.body;
    hybridService.fullSync(force).catch((e) => console.error('Hybrid full failed', e));
    res.json({ message: 'Hybrid full sync started', force });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/sync-unified/full
 * Synchronisation complète - sets puis toutes les cartes avec traductions
 */
router.post('/sync-unified/full', async (req: AuthenticatedRequest, res) => {
  try {
    const { setCode, force = false } = req.body;
    
    console.log(`🚀 Admin ${req.user?.username} started FULL UNIFIED sync (set: ${setCode || 'ALL'}, force: ${force})`);
    
    // Lancer la synchronisation complète en arrière-plan
    unifiedService.fullSyncUnified(setCode, force).catch(error => {
      console.error('❌ Full unified sync failed:', error);
    });
    
    res.json({ 
      message: `Synchronisation complète unifiée démarrée${setCode ? ` pour le set ${setCode}` : ' pour TOUTE l\'histoire de Magic'}`,
      type: 'unified-full',
      setCode: setCode || 'ALL',
      scope: setCode ? 'single-set' : 'all-magic-history',
      features: [
        'Récupération directe anglais + français',
        'Aucune limitation Standard',
        'Processus unifié en une seule étape',
        'Toutes les cartes de l\'histoire de Magic'
      ],
      force 
    });
  } catch (error) {
    console.error('Erreur démarrage full unified sync:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/sync-unified/test
 * Test rapide avec un petit set
 */
router.post('/sync-unified/test', async (req: AuthenticatedRequest, res) => {
  try {
    const { setCode = 'dmu' } = req.body;
    
    console.log(`🧪 Admin ${req.user?.username} started UNIFIED test sync with set ${setCode}`);
    
    // Lancer le test en arrière-plan
    unifiedService.syncCardsTestUnified(setCode).catch(error => {
      console.error('❌ Unified test sync failed:', error);
    });
    
    res.json({ 
      message: `Test de synchronisation unifiée démarré avec le set ${setCode}`,
      type: 'unified-test',
      setCode 
    });
  } catch (error) {
    console.error('Erreur démarrage test unified sync:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/scryfall/delta-extras
 * Import delta des cartes extras manquantes (global ou pour un set)
 */
router.post('/scryfall/delta-extras', async (req: AuthenticatedRequest, res) => {
  try {
    const { setCode } = req.body || {};
    console.log(`⚙️  Admin ${req.user?.username} triggered extras delta${setCode? ' for '+setCode:''}`);
    const summary = await runExtrasDelta({ setCode });
    res.json({ message: 'Delta extras terminé', summary });
  } catch (error) {
    console.error('Erreur delta extras:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error instanceof Error ? error.message : 'Unknown' });
  }
});

export default router;
