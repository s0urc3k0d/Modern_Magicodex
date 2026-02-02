import { Router } from 'express';
import { z } from 'zod';
import { collectionService } from '../services/collection';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { collectionCardLimiter, collectionBulkLimiter } from '../middleware/rateLimiter';
import { prisma } from '../server';

const router = Router();

// Simple in-memory cache for collection stats (per user+groupBy)
type StatsCacheEntry = { data: any; expiresAt: number };
const statsCache = new Map<string, StatsCacheEntry>();
const STATS_TTL_MS = 60 * 1000; // 60 seconds

// Export a light invalidator for other modules (e.g., when collection changes)
export function invalidateCollectionStatsCache(userId?: string) {
  if (!userId) { statsCache.clear(); return; }
  for (const key of statsCache.keys()) {
    if (key.startsWith(`${userId}::`)) statsCache.delete(key);
  }
}

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Schémas de validation pour les query parameters
const collectionQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 10000) : 50),
  setId: z.string().optional(),
  colors: z.string().optional().transform(val => val ? val.split(',') : undefined),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']).optional(),
  search: z.string().optional(),
  hasCard: z.string().optional().transform(val => val === 'true'),
  extras: z.string().optional().transform(val => val === 'true' ? true : (val === 'false' ? false : undefined)),
  duplicates: z.string().optional().transform(val => val === 'true'),
  typeContains: z.string().optional(),
  text: z.string().optional(),
  textMode: z.enum(['and', 'or']).optional().default('and'),
  minEur: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  maxEur: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  sort: z.enum(['releasedAt', 'name', 'collectorNumber', 'price']).optional().default('releasedAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc')
});

const statsQuerySchema = z.object({
  groupBy: z.enum(['set', 'color', 'rarity', 'type']).default('set'),
  includeZero: z.string().optional().transform(val => val === 'true'),
  extras: z.string().optional().transform(val => val === 'true' ? true : (val === 'false' ? false : undefined))
});

/**
 * @swagger
 * /collection:
 *   get:
 *     summary: Récupérer la collection de l'utilisateur
 *     tags: [Collection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: setId
 *         schema:
 *           type: string
 *         description: Filtrer par code de set
 *       - in: query
 *         name: rarity
 *         schema:
 *           type: string
 *           enum: [common, uncommon, rare, mythic]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche par nom de carte
 *     responses:
 *       200:
 *         description: Collection paginée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const query = collectionQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const filters = {
      setId: query.setId,
      colors: query.colors,
      rarity: query.rarity,
      search: query.search,
      hasCard: query.hasCard,
      extras: query.extras,
      duplicates: query.duplicates,
      typeContains: query.typeContains,
      textWords: query.text ? query.text.split(/\s+/).filter(Boolean) : undefined,
      textMode: query.textMode,
      // pass-through additional filters for service post-filtering
      minEur: query.minEur,
      maxEur: query.maxEur,
      sort: query.sort,
      order: query.order
    };

    const result = await collectionService.getUserCollection(
      userId,
      query.page,
      query.limit,
      filters
    );

    res.json(result);
  } catch (error) {
    console.error('Erreur récupération collection:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Paramètres invalides', 
        details: error.issues 
      });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Schema for cursor pagination
const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 500) : 50),
  direction: z.enum(['forward', 'backward']).optional().default('forward'),
  setId: z.string().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']).optional(),
  hasCard: z.string().optional().transform(val => val === 'true'),
  extras: z.string().optional().transform(val => val === 'true' ? true : (val === 'false' ? false : undefined)),
  sort: z.enum(['name', 'collectorNumber', 'price', 'updatedAt']).optional().default('updatedAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc')
});

/**
 * @swagger
 * /collection/cursor:
 *   get:
 *     summary: Récupérer la collection avec pagination curseur
 *     description: Plus performant pour les grandes collections
 *     tags: [Collection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: ID de la dernière carte vue
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [forward, backward]
 *           default: forward
 *     responses:
 *       200:
 *         description: Collection avec curseur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursorPaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/cursor', async (req: AuthenticatedRequest, res) => {
  try {
    const query = cursorQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const result = await collectionService.getUserCollectionCursor(userId, {
      cursor: query.cursor,
      limit: query.limit,
      direction: query.direction,
      setId: query.setId,
      rarity: query.rarity,
      hasCard: query.hasCard,
      extras: query.extras,
      sort: query.sort,
      order: query.order,
    });

    res.json(result);
  } catch (error) {
    console.error('Erreur pagination curseur:', error);
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
 * @swagger
 * /collection/search:
 *   get:
 *     summary: Rechercher dans la collection
 *     tags: [Collection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Terme de recherche
 *     responses:
 *       200:
 *         description: Résultats de recherche
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/search', async (req: AuthenticatedRequest, res) => {
  try {
    const query = collectionQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const filters = {
      setId: query.setId,
      colors: query.colors,
      rarity: query.rarity,
      search: query.search,
      hasCard: query.hasCard,
      extras: query.extras,
      typeContains: query.typeContains,
      textWords: query.text ? query.text.split(/\s+/).filter(Boolean) : undefined,
      textMode: query.textMode,
      minEur: query.minEur,
      maxEur: query.maxEur,
      sort: query.sort,
      order: query.order
    } as any;

    const result = await collectionService.getUserCollection(
      userId,
      query.page,
      query.limit,
      filters
    );

    res.json(result);
  } catch (error) {
    console.error('Erreur recherche collection:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Paramètres invalides', details: error.issues });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /collection/stats:
 *   get:
 *     summary: Statistiques de la collection
 *     tags: [Collection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [set, color, rarity, type]
 *           default: set
 *     responses:
 *       200:
 *         description: Statistiques de collection
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CollectionStats'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const query = statsQuerySchema.parse(req.query);
    const userId = req.user!.id;

  const cacheKey = `${userId}::${query.groupBy}::extras=${query.extras === undefined ? 'all' : String(query.extras)}`;
    const now = Date.now();
    const cached = statsCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return res.json(cached.data);
    }

  const stats = await collectionService.getCollectionStats(userId, query);
    statsCache.set(cacheKey, { data: stats, expiresAt: now + STATS_TTL_MS });
    res.json(stats);
  } catch (error) {
    console.error('Erreur récupération statistiques:', error);
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
 * GET /api/collection/sets/:setId/missing
 * Récupère les cartes manquantes d'un set
 */
router.get('/sets/:setId/missing', async (req: AuthenticatedRequest, res) => {
  try {
    const setId = req.params.setId as string;
    const userId = req.user!.id;

  const extrasParam = (req.query.extras as string) ?? undefined;
  const extras = extrasParam === 'true' ? true : (extrasParam === 'false' ? false : undefined);

  const result = await collectionService.getMissingCardsFromSet(userId, setId, { extras });

    res.json(result);
  } catch (error) {
    console.error('Erreur récupération cartes manquantes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/collection/cards
 * Récupère les cartes de la collection pour une liste d'IDs de cartes
 * Query: ids=cardId1,cardId2,...
 */
router.get('/cards', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const idsParam = (req.query.ids as string) || '';
    const oracleIdsParam = (req.query.oracleIds as string) || '';
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
    const oracleIds = oracleIdsParam.split(',').map((s) => s.trim()).filter(Boolean);

    if (oracleIds.length > 0) {
      const userCardsByOracle = await collectionService.getUserCollectionByOracleIds(userId, oracleIds);
      return res.json(userCardsByOracle);
    }

    if (ids.length > 0) {
      const userCards = await collectionService.getUserCollectionByCardIds(userId, ids);
      return res.json(userCards);
    }

    return res.json([]);
  } catch (error) {
    console.error('Erreur récupération collection par IDs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/collection/cards
 * Ajoute une carte à la collection
 */
router.post('/cards', collectionCardLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userCard = await collectionService.addCardToCollection(userId, req.body);
  // Invalidate stats cache for this user
  invalidateCollectionStatsCache(userId);
    res.status(201).json(userCard);
  } catch (error) {
    console.error('Erreur ajout carte:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Données invalides', 
        details: error.issues 
      });
    }
    if (error instanceof Error && error.message === 'Carte non trouvée') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/collection/cards/bulk
 * Ajout ou mise à jour en masse des cartes
 * Body: { items: [{ cardId, quantity, quantityFoil }...], mode: 'increment' | 'set' }
 */
router.post('/cards/bulk', collectionBulkLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const summary = await collectionService.bulkAddOrUpdate(userId, req.body);
    invalidateCollectionStatsCache(userId);
    res.status(200).json({ success: true, summary });
  } catch (error) {
    console.error('Erreur bulk add:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.issues });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/collection/cards/:cardId
 * Met à jour une carte dans la collection
 * Query param: language (requis - identifie l'entrée unique)
 */
router.put('/cards/:cardId', collectionCardLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const cardId = req.params.cardId as string;
    const userId = req.user!.id;
    // La langue identifie l'entrée unique à mettre à jour
    const language = (req.query.language as string) || req.body.language || 'fr';

    const userCard = await collectionService.updateCardInCollection(userId, cardId, language, req.body);

    if (!userCard) {
      invalidateCollectionStatsCache(userId);
      return res.status(200).json({ message: 'Carte supprimée de la collection' });
    }
    invalidateCollectionStatsCache(userId);
    res.json(userCard);
  } catch (error) {
    console.error('Erreur mise à jour carte:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Données invalides', 
        details: error.issues 
      });
    }
    if (error instanceof Error && error.message === 'Carte non trouvée dans la collection') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/collection/cards/:cardId
 * Supprime une carte de la collection
 * Query param: language (requis - identifie l'entrée unique)
 */
router.delete('/cards/:cardId', async (req: AuthenticatedRequest, res) => {
  try {
    const cardId = req.params.cardId as string;
    const userId = req.user!.id;
    const language = (req.query.language as string) || 'fr';

    await collectionService.removeCardFromCollection(userId, cardId, language);
  invalidateCollectionStatsCache(userId);
    res.json({ message: 'Carte supprimée de la collection' });
  } catch (error) {
    console.error('Erreur suppression carte:', error);
    if (error instanceof Error && error.message === 'Carte non trouvée dans la collection') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Wishlist & Trade list endpoints ---
// List all list items (wishlist/trade)
router.get('/lists', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
  const prismaAny = prisma as any;
  const items = await prismaAny.userListItem.findMany({
      where: { userId },
      include: { card: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(items);
  } catch (error) {
    console.error('Erreur récupération listes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upsert item
router.post('/lists', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { cardId, type, quantity = 1, notes, condition = 'NM', language = 'en', isFoil = false, isSigned = false, isAltered = false, askingPrice } = req.body || {};
    if (!cardId || !type) return res.status(400).json({ error: 'cardId et type requis' });
    const prismaAny = prisma as any;
    const item = await prismaAny.userListItem.upsert({
      where: { 
        userId_cardId_type_condition_language_isFoil_isSigned_isAltered: { 
          userId, cardId, type, condition, language, isFoil, isSigned, isAltered 
        } 
      },
      update: { quantity, notes, askingPrice },
      create: { userId, cardId, type, quantity, notes, condition, language, isFoil, isSigned, isAltered, askingPrice },
      include: { card: true }
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Erreur upsert liste:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete item
router.delete('/lists/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
  const prismaAny = prisma as any;
  const found = await prismaAny.userListItem.findUnique({ where: { id } });
    if (!found || found.userId !== userId) return res.status(404).json({ error: 'Élément non trouvé' });
  await prismaAny.userListItem.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression liste:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
