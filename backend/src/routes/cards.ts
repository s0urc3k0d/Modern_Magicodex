import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { searchCardIds } from '../utils/cardSearch';
import { parseCardJsonFields } from '../utils/cardHelpers';

const router = Router();

// Schémas de validation
const cardQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 500) : 50),
  search: z.string().optional(),
  setId: z.string().optional(),
  colors: z.string().optional().transform(val => val ? val.split(',') : undefined),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']).optional(),
  type: z.string().optional(),
  cmc: z.string().optional().transform(val => val ? parseInt(val) : undefined)
});

const identifyQuerySchema = z.object({
  collector: z.string().min(1),
  year: z.string().optional().transform((val) => val ? parseInt(val) : undefined),
  rarity: z.enum(['common','uncommon','rare','mythic']).optional(),
  lang: z.string().optional()
});

/**
 * GET /api/cards
 * Recherche de cartes avec filtres
 */
router.get('/', async (req, res) => {
  try {
    const query = cardQuerySchema.parse(req.query);
    const offset = (query.page - 1) * query.limit;

    const where: any = {};

    // Filtres de recherche
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { nameFr: { contains: query.search } },
        { typeLine: { contains: query.search } },
        { typeLineFr: { contains: query.search } },
        { oracleText: { contains: query.search } },
        { oracleTextFr: { contains: query.search } }
      ];
    }

    if (query.setId) {
      where.setId = query.setId;
    }

    if (query.colors && query.colors.length > 0) {
      // Pour SQLite, rechercher dans la chaîne JSON
      const colorSearches = query.colors.map(color => ({
        colorIdentity: { contains: `"${color}"` }
      }));
      
      if (where.OR) {
        where.OR = [...where.OR, ...colorSearches];
      } else {
        where.OR = colorSearches;
      }
    }

    if (query.rarity) {
      where.rarity = query.rarity;
    }

    if (query.type) {
      where.OR = [
        { typeLine: { contains: query.type } },
        { typeLineFr: { contains: query.type } }
      ];
    }

    if (query.cmc !== undefined) {
      where.cmc = query.cmc;
    }

    const [cardsRaw, total] = await Promise.all([
      prisma.card.findMany({
        where,
        include: {
          set: true
        },
        orderBy: [
          { set: { releasedAt: 'desc' } },
          { collectorNumber: 'asc' }
        ],
        skip: offset,
        take: query.limit
      }),
      prisma.card.count({ where })
    ]);

    // Parse JSON fields pour le frontend
    const cards = cardsRaw.map(parseCardJsonFields);

    res.json({
      cards,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    console.error('Erreur recherche cartes:', error);
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
 * GET /api/cards/fts
 * Recherche plein texte FTS5 (SQLite) pour des requêtes rapides
 */
router.get('/fts', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(String(req.query.limit || '50')), 100);
    const colorsParam = String(req.query.colors || '').trim();
    const rarity = String(req.query.rarity || '').trim();
    const typeContains = String(req.query.typeContains || '').trim();
    const priceMinRaw = String(req.query.priceMin || '').trim();
    const priceMaxRaw = String(req.query.priceMax || '').trim();
    const extrasRaw = String(req.query.extras || '').trim();
    const priceMin = priceMinRaw ? parseFloat(priceMinRaw) : undefined;
    const priceMax = priceMaxRaw ? parseFloat(priceMaxRaw) : undefined;
    const colors = colorsParam ? colorsParam.split(',').map(c=>c.toUpperCase()).filter(c=>['W','U','B','R','G','C'].includes(c)) : [];
    if (!q || q.length < 2) {
      return res.json({ cards: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
    }

    const ids = await searchCardIds(prisma as any, q, limit * 2, {
      colors,
      rarity: (rarity as any) || undefined,
      typeContains: typeContains || undefined,
      priceMin,
      priceMax,
      extras: extrasRaw === 'true' ? true : (extrasRaw === 'false' ? false : undefined)
    });

    if (ids.length === 0) {
      return res.json({ cards: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
    }

    // Fetch full rows via Prisma and preserve order according to ids
    const cardsRaw = await prisma.card.findMany({
      where: { id: { in: ids.slice(0, limit) } },
      include: { set: true }
    });
    const order = new Map<string, number>();
    ids.forEach((id, idx) => order.set(id, idx));
    const cards = cardsRaw
      .map(parseCardJsonFields)
      .sort((a: any, b: any) => (order.get(a.id)! - order.get(b.id)!));

    return res.json({ cards: cards.slice(0, limit), pagination: { page: 1, limit, total: Math.min(ids.length, limit), totalPages: 1 } });
  } catch (error) {
    console.error('Erreur FTS:', error);
    // Fallback: if FTS virtual table is missing, degrade gracefully to simple LIKE search
    const message = (error as any)?.meta?.message || (error as any)?.message || '';
    const code = (error as any)?.code;
    if (code === 'P2010' && /no such table: cards_fts/i.test(message)) {
      try {
        const limit = Math.min(parseInt(String(req.query.limit || '50')), 100);
        const q = String(req.query.q || '').trim();
        const where: any = {
          OR: [
            { name: { contains: q } },
            { nameFr: { contains: q } },
            { typeLine: { contains: q } },
            { typeLineFr: { contains: q } },
            { oracleText: { contains: q } },
            { oracleTextFr: { contains: q } }
          ]
        };

        const results = await prisma.card.findMany({
          where,
          include: { set: true },
          orderBy: [
            { set: { releasedAt: 'desc' } },
            { collectorNumber: 'asc' }
          ],
          take: limit
        });
        const cards = results.map(parseCardJsonFields);
        return res.json({ cards, pagination: { page: 1, limit, total: cards.length, totalPages: 1 } });
      } catch (e) {
        console.error('Erreur fallback FTS:', e);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/cards/identify
 * Identification par numéro de collection et métadonnées bas de carte
 * Query: collector=123a&year=2021&rarity=rare&lang=fr
 */
router.get('/identify', async (req, res) => {
  try {
    const q = identifyQuerySchema.parse(req.query);
    const where: any = { collectorNumber: q.collector };
    if (q.rarity) where.rarity = q.rarity;
    if (q.lang) where.lang = q.lang;

    // Filtre par année de sortie du set si fournie
    let dateFilter: any = undefined;
    if (typeof q.year === 'number' && !Number.isNaN(q.year)) {
      const start = new Date(q.year, 0, 1);
      const end = new Date(q.year + 1, 0, 1);
      dateFilter = { gte: start, lt: end };
    }

    const cardsRaw = await prisma.card.findMany({
      where,
      include: { set: true },
      orderBy: [
        // Plus récent d'abord
        { set: { releasedAt: 'desc' } },
        { collectorNumber: 'asc' }
      ]
    });

    // Appliquer filtre année sur set côté JS si nécessaire (SQLite/nullable dates)
    const filtered = dateFilter
      ? cardsRaw.filter((c: any) => c.set?.releasedAt && c.set.releasedAt >= dateFilter.gte && c.set.releasedAt < dateFilter.lt)
      : cardsRaw;

    const cards = filtered.map(parseCardJsonFields);
    return res.json({ cards, count: cards.length });
  } catch (error) {
    console.error('Erreur identify:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Paramètres invalides', details: error.issues });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/cards/search
 * Recherche avancée de cartes (alias pour compatibilité)
 */
router.get('/search', (req, res) => {
  res.redirect(307, '/api/cards' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''));
});

/**
 * GET /api/cards/:cardId
 * Récupère une carte spécifique
 */
router.get('/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;

    const cardRaw = await prisma.card.findUnique({
      where: { id: cardId },
      include: {
        set: true
      }
    });

    if (!cardRaw) {
      return res.status(404).json({ error: 'Carte non trouvée' });
    }

    // Parse JSON fields pour le frontend
    const card = parseCardJsonFields(cardRaw);

    res.json(card);
  } catch (error) {
    console.error('Erreur récupération carte:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
