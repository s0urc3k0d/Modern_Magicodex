import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';

const router = Router();

// ==================
// In-memory cache for sets (they rarely change)
// ==================
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const setsCache = new Map<string, CacheEntry<any>>();
const SETS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = setsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    setsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  setsCache.set(key, {
    data,
    expiresAt: Date.now() + SETS_CACHE_TTL
  });
}

// Export cache invalidator for admin routes
export function invalidateSetsCache(): void {
  setsCache.clear();
}

// Schémas de validation
const setQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 500) : 50),
  search: z.string().optional(),
  type: z.string().optional()
});

/**
 * GET /api/sets
 * Récupère tous les sets avec pagination et filtres
 */
router.get('/', async (req, res) => {
  try {
    const query = setQuerySchema.parse(req.query);
    const offset = (query.page - 1) * query.limit;
    
    // Try cache for unfiltered first page (common case)
    const cacheKey = `sets:${query.page}:${query.limit}:${query.search || ''}:${query.type || ''}`;
    const cached = getCached<{ sets: any[]; pagination: any }>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const where: any = {};

    // Filtres de recherche
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { nameFr: { contains: query.search } },
        { code: { contains: query.search } }
      ];
    }

    if (query.type) {
      where.type = { contains: query.type };
    }

    const [sets, total] = await Promise.all([
      prisma.set.findMany({
        where,
        select: {
          id: true,
          scryfallId: true,
          code: true,
          name: true,
          nameFr: true,
          type: true,
          releasedAt: true,
          cardCount: true,
          iconSvgUri: true,
          _count: {
            select: { cards: true }
          }
        },
        orderBy: { releasedAt: 'desc' },
        skip: offset,
        take: query.limit
      }),
      prisma.set.count({ where })
    ]);

    const result = {
      sets,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
    
    // Cache the result
    setCache(cacheKey, result);

    res.json(result);
  } catch (error) {
    console.error('Erreur récupération sets:', error);
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
 * GET /api/sets/:setId
 * Récupère un set spécifique
 */
router.get('/:setId', async (req, res) => {
  try {
    const { setId } = req.params;
    
    // Try cache
    const cacheKey = `set:${setId}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const set = await prisma.set.findUnique({
      where: { id: setId },
      include: {
        _count: {
          select: {
            cards: true
          }
        }
      }
    });

    if (!set) {
      return res.status(404).json({ error: 'Set non trouvé' });
    }
    
    // Cache the result
    setCache(cacheKey, set);

    res.json(set);
  } catch (error) {
    console.error('Erreur récupération set:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/sets/:setId/cards
 * Récupère toutes les cartes d'un set
 */
router.get('/:setId/cards', async (req, res) => {
  try {
    const { setId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = (page - 1) * limit;
    const extrasParam = (req.query.extras as string | undefined)?.toLowerCase();
    const extrasFilter = extrasParam === 'true' ? true : extrasParam === 'false' ? false : undefined;

    // Vérifier que le set existe
    const set = await prisma.set.findUnique({
      where: { id: setId }
    });

    if (!set) {
      return res.status(404).json({ error: 'Set non trouvé' });
    }

    const whereClause: any = { setId };
    if (typeof extrasFilter === 'boolean') {
      whereClause.isExtra = extrasFilter;
    }

    // Use raw SQL for proper numeric sorting of collector numbers
    // Extract leading digits for numeric sort, then suffix for alphabetic sort
    const extrasCondition = typeof extrasFilter === 'boolean' 
      ? `AND "isExtra" = ${extrasFilter}` 
      : '';
    
    const [cards, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`
        SELECT c.*, 
               row_to_json(s.*) as set
        FROM cards c
        JOIN sets s ON c."setId" = s.id
        WHERE c."setId" = $1 ${extrasCondition}
        ORDER BY 
          CAST(NULLIF(regexp_replace("collectorNumber", '[^0-9].*', '', 'g'), '') AS INTEGER) ASC NULLS LAST,
          "collectorNumber" ASC
        LIMIT $2 OFFSET $3
      `, setId, limit, offset),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT COUNT(*) as count FROM cards WHERE "setId" = $1 ${extrasCondition}
      `, setId)
    ]);

    const total = Number(countResult[0]?.count || 0);

    res.json({
      set,
      cards,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur récupération cartes du set:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
