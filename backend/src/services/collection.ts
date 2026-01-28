import { prisma } from '../db/prisma';
import { z } from 'zod';
import { searchCardIds } from '../utils/cardSearch';
import { getPriceFromJson } from '../utils/cardHelpers';

// Cursor pagination schema
const cursorPaginationSchema = z.object({
  cursor: z.string().optional(), // UserCard ID to start after
  limit: z.number().min(1).max(100).default(50),
  direction: z.enum(['forward', 'backward']).default('forward'),
});

// Schémas de validation Zod
const addCardToCollectionSchema = z.object({
  cardId: z.string(),
  quantity: z.number().min(1).max(999).default(1),
  quantityFoil: z.number().min(0).max(999).default(0),
  condition: z.enum(['NM', 'LP', 'MP', 'HP', 'DMG']).default('NM'),
  language: z.string().min(2).max(3).default('en'),
  notes: z.string().optional()
});

const updateCardInCollectionSchema = z.object({
  quantity: z.number().min(0).max(999).optional(),
  quantityFoil: z.number().min(0).max(999).optional(),
  condition: z.enum(['NM', 'LP', 'MP', 'HP', 'DMG']).optional(),
  language: z.string().min(2).max(3).optional(),
  notes: z.string().optional()
});

const collectionStatsSchema = z.object({
  groupBy: z.enum(['set', 'color', 'rarity', 'type']).default('set'),
  includeZero: z.boolean().default(false),
  extras: z.boolean().optional()
});

// Bulk add/update schema
const bulkAddSchema = z.object({
  items: z.array(z.object({
    cardId: z.string(),
    quantity: z.number().int().min(0).max(999).default(0),
    quantityFoil: z.number().int().min(0).max(999).default(0),
    // Optional overrides (future extension)
    condition: z.enum(['NM', 'LP', 'MP', 'HP', 'DMG']).optional(),
    language: z.string().min(2).max(3).optional(),
    notes: z.string().optional()
  })).min(1),
  // mode = increment (add to existing quantities) | set (replace quantities exactly)
  mode: z.enum(['increment', 'set']).default('increment')
});

export class CollectionService {
  
  /**
   * Récupère la collection complète d'un utilisateur avec pagination et filtres
   */
  async getUserCollection(
    userId: string,
    page: number = 1,
    limit: number = 50,
    filters?: {
      setId?: string;
      colors?: string[];
      rarity?: string;
      search?: string;
      hasCard?: boolean; // true = seulement les cartes possédées
      extras?: boolean;
      typeContains?: string;
      textWords?: string[];
      textMode?: 'and' | 'or';
      // sorting
      sort?: 'releasedAt' | 'name' | 'collectorNumber' | 'price';
      order?: 'asc' | 'desc';
      // price range in EUR
      minEur?: number;
      maxEur?: number;
    }
  ) {
    const offset = (page - 1) * limit;

    const where: any = {
      userId,
      ...(filters?.hasCard && { 
        OR: [
          { quantity: { gt: 0 } },
          { quantityFoil: { gt: 0 } }
        ]
      })
    };

    // Unify search behavior with cards FTS: if search/text provided, precompute matching card IDs
    let prefilteredIds: string[] | undefined;
    const f = filters || {} as any;
    const q = (f.search && f.search.trim().length >= 2)
      ? f.search.trim()
      : (f.textWords && f.textWords.length > 0 ? f.textWords.join(' ') : undefined);
    if (q) {
      try {
        prefilteredIds = await searchCardIds(prisma as any, q, Math.max(limit * 5, 500), {
          colors: (f.colors || []).map((c: string) => String(c).toUpperCase()),
          rarity: (f.rarity as any) || undefined,
          typeContains: f.typeContains || undefined,
          priceMin: f.minEur,
          priceMax: f.maxEur,
          extras: f.extras
        });
        if (!prefilteredIds || prefilteredIds.length === 0) {
          return {
            userCards: [],
            pagination: { page, limit, total: 0, totalPages: 0 }
          };
        }
      } catch (e) {
        // If helper fails, proceed without prefilter (fallback to existing LIKE filters below)
        prefilteredIds = undefined;
      }
    }

    // Filtres sur les cartes
    if (f.setId || f.colors || f.rarity || f.search || f.extras !== undefined || f.typeContains || (f.textWords && f.textWords.length > 0) || f.minEur !== undefined || f.maxEur !== undefined || prefilteredIds) {
      where.card = {};
      
      if (f.setId) {
        where.card.setId = f.setId;
      }
      
      if (f.colors && f.colors.length > 0) {
        // Pour SQLite, chercher dans le JSON string
        // Recherche la première couleur dans la chaîne JSON
        const colorToSearch = `"${f.colors[0]}"`;
        where.card.colorIdentity = {
          contains: colorToSearch
        };
      }
      
      if (f.rarity) {
        where.card.rarity = f.rarity;
      }

      if (f.extras !== undefined) {
        where.card.isExtra = f.extras;
      }
      
      if (!prefilteredIds && f.search) {
        where.card.OR = [
          { name: { contains: f.search } },
          { nameFr: { contains: f.search } },
          { typeLine: { contains: f.search } },
          { typeLineFr: { contains: f.search } }
        ];
      }

      if (f.typeContains) {
        where.card = {
          ...(where.card || {}),
          OR: [
            ...(where.card?.OR ?? []),
            { typeLine: { contains: f.typeContains } },
            { typeLineFr: { contains: f.typeContains } }
          ]
        };
      }

      if (!prefilteredIds && f.textWords && f.textWords.length > 0) {
        const words = f.textWords.filter(Boolean);
        if (words.length > 0) {
          const wordToOr = (w: string) => ({
            OR: [
              { name: { contains: w } },
              { nameFr: { contains: w } },
              { oracleText: { contains: w } },
              { oracleTextFr: { contains: w } },
              { typeLine: { contains: w } },
              { typeLineFr: { contains: w } }
            ]
          });
          if (f.textMode === 'or') {
            where.card = {
              ...(where.card || {}),
              OR: [
                ...(where.card?.OR ?? []),
                ...words.map(wordToOr)
              ]
            };
          } else {
            // 'and' mode: all words must match somewhere
            where.card = {
              ...(where.card || {}),
              AND: [
                ...(where.card?.AND ?? []),
                ...words.map(wordToOr)
              ]
            };
          }
        }
      }

      // Apply prefiltered IDs when available
      if (prefilteredIds && prefilteredIds.length > 0) {
        (where.card as any).id = { in: prefilteredIds };
      }
      // Numeric EUR price filter (uses DB column when available)
      if (f.minEur !== undefined || f.maxEur !== undefined) {
        const priceCond: any = {};
        if (f.minEur !== undefined) priceCond.gte = f.minEur;
        if (f.maxEur !== undefined) priceCond.lte = f.maxEur;
        (where.card as any).priceEur = priceCond;
      }
    }

    // Determine sorting
    const sort = filters?.sort ?? 'releasedAt';
    const order = filters?.order ?? (sort === 'releasedAt' || sort === 'price' ? 'desc' : 'asc');

    // Sorting and pagination
    let userCardsRaw: any[] = [];
    let total = 0;
    // Prisma-level sorting
    let orderBy: any[] = [];
    if (sort === 'price') {
      // Exclude rows without price when sorting by price
      where.card = {
        ...(where.card || {}),
        NOT: [{ priceEur: null }]
      } as any;
      orderBy = [{ card: { priceEur: order } }, { card: { name: 'asc' } }, { card: { collectorNumber: 'asc' } }];
    } else if (sort === 'name') {
      orderBy = [{ card: { name: order } }, { card: { collectorNumber: 'asc' } }];
    } else if (sort === 'collectorNumber') {
      orderBy = [{ card: { collectorNumber: order } }, { card: { name: 'asc' } }];
    } else { // releasedAt default
      orderBy = [{ card: { set: { releasedAt: order } } }, { card: { collectorNumber: 'asc' } }];
    }

    const [rows, cnt] = await Promise.all([
      prisma.userCard.findMany({
        where,
        include: { card: { include: { set: true } } },
        orderBy,
        skip: offset,
        take: limit
      }),
      prisma.userCard.count({ where })
    ]);
    userCardsRaw = rows; total = cnt;

    // No post-filter needed; price filtering uses DB column now
    const userCards = userCardsRaw;

    return {
      userCards,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Récupère la collection avec pagination par curseur (plus performant pour grandes collections)
   * Utilise l'ID de la dernière carte vue comme curseur pour la page suivante
   */
  async getUserCollectionCursor(
    userId: string,
    options: {
      cursor?: string;
      limit?: number;
      direction?: 'forward' | 'backward';
      setId?: string;
      rarity?: string;
      hasCard?: boolean;
      extras?: boolean;
      sort?: 'name' | 'collectorNumber' | 'price' | 'updatedAt';
      order?: 'asc' | 'desc';
    } = {}
  ) {
    const { 
      cursor, 
      limit = 50, 
      direction = 'forward',
      setId,
      rarity,
      hasCard,
      extras,
      sort = 'updatedAt',
      order = 'desc'
    } = options;

    // Build where clause
    const where: any = {
      userId,
      ...(hasCard && { 
        OR: [
          { quantity: { gt: 0 } },
          { quantityFoil: { gt: 0 } }
        ]
      })
    };

    // Card filters
    if (setId || rarity || extras !== undefined) {
      where.card = {};
      if (setId) where.card.setId = setId;
      if (rarity) where.card.rarity = rarity;
      if (extras !== undefined) where.card.isExtra = extras;
    }

    // Determine ordering
    let orderBy: any[] = [];
    const sortOrder = direction === 'backward' ? (order === 'asc' ? 'desc' : 'asc') : order;
    
    switch (sort) {
      case 'name':
        orderBy = [{ card: { name: sortOrder } }, { id: sortOrder }];
        break;
      case 'collectorNumber':
        orderBy = [{ card: { collectorNumber: sortOrder } }, { id: sortOrder }];
        break;
      case 'price':
        where.card = { ...(where.card || {}), NOT: [{ priceEur: null }] };
        orderBy = [{ card: { priceEur: sortOrder } }, { id: sortOrder }];
        break;
      default: // updatedAt
        orderBy = [{ updatedAt: sortOrder }, { id: sortOrder }];
    }

    // Cursor-based query
    const queryOptions: any = {
      where,
      include: { card: { include: { set: true } } },
      orderBy,
      take: limit + 1, // Fetch one extra to determine if there's a next page
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1; // Skip the cursor item itself
    }

    const results = await prisma.userCard.findMany(queryOptions);

    // Determine if there are more results
    const hasMore = results.length > limit;
    const userCards = hasMore ? results.slice(0, limit) : results;

    // If going backward, reverse the results to maintain correct order
    if (direction === 'backward') {
      userCards.reverse();
    }

    // Get cursors for navigation
    const nextCursor = hasMore && userCards.length > 0 
      ? userCards[userCards.length - 1].id 
      : null;
    const prevCursor = cursor && userCards.length > 0 
      ? userCards[0].id 
      : null;

    return {
      userCards,
      pagination: {
        nextCursor,
        prevCursor,
        hasMore,
        limit,
      }
    };
  }

  /**
   * Récupère les cartes de la collection d'un utilisateur pour une liste d'IDs de carte
   */
  async getUserCollectionByCardIds(userId: string, cardIds: string[]) {
    const userCards = await prisma.userCard.findMany({
      where: {
        userId,
        cardId: { in: cardIds }
      },
      select: {
        cardId: true,
        quantity: true,
        quantityFoil: true
      }
    });

    return userCards;
  }

  /**
   * Récupère les quantités par oracleId (toutes éditions confondues)
   */
  async getUserCollectionByOracleIds(userId: string, oracleIds: string[]) {
    // Trouver toutes les cartes correspondant aux oracleIds
    const cards = await prisma.card.findMany({
      where: { oracleId: { in: oracleIds } },
      select: { id: true, oracleId: true }
    });

    const byOracle: Record<string, string[]> = {};
    for (const c of cards) {
      if (!c.oracleId) continue;
      byOracle[c.oracleId] = byOracle[c.oracleId] || [];
      byOracle[c.oracleId].push(c.id);
    }

    // Récupérer les userCards pour ces IDs
    const allCardIds = Object.values(byOracle).flat();
    if (allCardIds.length === 0) return [] as Array<{ oracleId: string; quantity: number; quantityFoil: number }>;

    const userCards = await prisma.userCard.findMany({
      where: { userId, cardId: { in: allCardIds } },
      select: { cardId: true, quantity: true, quantityFoil: true }
    });

    // Agréger par oracleId
    const totals: Record<string, { quantity: number; quantityFoil: number }> = {};
    for (const [oracleId, ids] of Object.entries(byOracle)) {
      totals[oracleId] = { quantity: 0, quantityFoil: 0 };
    }
    for (const uc of userCards) {
  const oracle = cards.find((c: any) => c.id === uc.cardId)?.oracleId;
      if (!oracle) continue;
      totals[oracle].quantity += uc.quantity;
      totals[oracle].quantityFoil += uc.quantityFoil;
    }

    return Object.entries(totals).map(([oracleId, t]) => ({ oracleId, quantity: t.quantity, quantityFoil: t.quantityFoil }));
  }

  /**
   * Ajoute ou met à jour une carte dans la collection
   */
  async addCardToCollection(userId: string, data: z.infer<typeof addCardToCollectionSchema>) {
    const validatedData = addCardToCollectionSchema.parse(data);

    // Vérifier que la carte existe
    const card = await prisma.card.findUnique({
      where: { id: validatedData.cardId }
    });

    if (!card) {
      throw new Error('Carte non trouvée');
    }

    // Upsert de la carte dans la collection (clé unique: userId + cardId + language)
    const userCard = await prisma.userCard.upsert({
      where: {
        userId_cardId_language: {
          userId,
          cardId: validatedData.cardId,
          language: validatedData.language
        }
      },
      update: {
        quantity: validatedData.quantity,
        quantityFoil: validatedData.quantityFoil,
        condition: validatedData.condition,
        notes: validatedData.notes
      },
      create: {
        userId,
        cardId: validatedData.cardId,
        quantity: validatedData.quantity,
        quantityFoil: validatedData.quantityFoil,
        condition: validatedData.condition,
        language: validatedData.language,
        notes: validatedData.notes
      },
      include: {
        card: {
          include: {
            set: true
          }
        }
      }
    });

    return userCard;
  }

  /**
   * Bulk add or update many cards in a single batched sequence of transactions.
   * Optimized to reduce round-trips and rate limiting pressure.
   * - mode=increment: adds the provided quantities to existing (creating entries if absent)
   * - mode=set: replaces the quantities exactly (can also zero out which will delete row)
   * Returns a summary for UI feedback.
   */
  async bulkAddOrUpdate(userId: string, payload: z.infer<typeof bulkAddSchema>) {
    const { items, mode } = bulkAddSchema.parse(payload);

    // Deduplicate by cardId+language (sum quantities for increment mode)
    const dedup = new Map<string, { cardId: string; quantity: number; quantityFoil: number; condition?: string; language: string; notes?: string }>();
    for (const it of items) {
      const lang = it.language || 'en';
      const key = `${it.cardId}::${lang}`;
      const existing = dedup.get(key);
      if (existing) {
        existing.quantity += it.quantity;
        existing.quantityFoil += it.quantityFoil;
      } else {
        dedup.set(key, { cardId: it.cardId, quantity: it.quantity, quantityFoil: it.quantityFoil, condition: it.condition, language: lang, notes: it.notes });
      }
    }
    const finalItems = Array.from(dedup.values());

    // Fetch existing userCards for these cardIds (all languages)
    const existingUserCards = await prisma.userCard.findMany({
      where: { userId, cardId: { in: finalItems.map(f => f.cardId) } }
    });
    // Map by cardId+language
    const existingMap = new Map(existingUserCards.map((uc: any) => [`${uc.cardId}::${uc.language}`, uc]));

    let affected = 0;
    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Chunk operations to avoid exceeding SQLite variable limits (e.g., ~999)
    const CHUNK_SIZE = 200;
    for (let i = 0; i < finalItems.length; i += CHUNK_SIZE) {
      const slice = finalItems.slice(i, i + CHUNK_SIZE);
      await prisma.$transaction(async (tx: any) => {
        for (const entry of slice) {
          // Validate card existence (skip silently if not found)
            const card = await tx.card.findUnique({ where: { id: entry.cardId } });
            if (!card) continue;
          const mapKey = `${entry.cardId}::${entry.language}`;
          const existing: any = existingMap.get(mapKey);
          if (!existing) {
            if (entry.quantity === 0 && entry.quantityFoil === 0) continue; // nothing to insert
            await tx.userCard.create({
              data: {
                userId,
                cardId: entry.cardId,
                quantity: entry.quantity,
                quantityFoil: entry.quantityFoil,
                condition: (entry.condition as any) || 'NM',
                language: entry.language || 'en',
                notes: entry.notes
              }
            });
            created += 1; affected += 1;
          } else {
            let newQuantity: number;
            let newQuantityFoil: number;
            if (mode === 'increment') {
              newQuantity = existing.quantity + entry.quantity;
              newQuantityFoil = existing.quantityFoil + entry.quantityFoil;
            } else { // set
              newQuantity = entry.quantity;
              newQuantityFoil = entry.quantityFoil;
            }

            if (newQuantity === 0 && newQuantityFoil === 0) {
              await tx.userCard.delete({
                where: { userId_cardId_language: { userId, cardId: entry.cardId, language: entry.language } }
              });
              deleted += 1; affected += 1;
            } else {
              await tx.userCard.update({
                where: { userId_cardId_language: { userId, cardId: entry.cardId, language: entry.language } },
                data: {
                  quantity: newQuantity,
                  quantityFoil: newQuantityFoil,
                  ...(entry.condition && { condition: entry.condition as any }),
                  ...(entry.language && { language: entry.language }),
                  ...(entry.notes && { notes: entry.notes })
                }
              });
              updated += 1; affected += 1;
            }
          }
        }
      });
    }

    return {
      mode,
      requested: items.length,
      processed: finalItems.length,
      affected,
      created,
      updated,
      deleted
    };
  }

  /**
   * Met à jour une carte dans la collection
   * Note: language est requis car la clé unique est (userId, cardId, language)
   */
  async updateCardInCollection(
    userId: string, 
    cardId: string,
    language: string,
    data: z.infer<typeof updateCardInCollectionSchema>
  ) {
    const validatedData = updateCardInCollectionSchema.parse(data);

    const userCard = await prisma.userCard.findUnique({
      where: {
        userId_cardId_language: {
          userId,
          cardId,
          language
        }
      }
    });

    if (!userCard) {
      throw new Error('Carte non trouvée dans la collection');
    }

    // Si les quantités sont mises à 0, supprimer l'entrée
    if (validatedData.quantity === 0 && validatedData.quantityFoil === 0) {
      await prisma.userCard.delete({
        where: {
          userId_cardId_language: {
            userId,
            cardId,
            language
          }
        }
      });
      return null;
    }

    const updatedUserCard = await prisma.userCard.update({
      where: {
        userId_cardId_language: {
          userId,
          cardId,
          language
        }
      },
      data: validatedData,
      include: {
        card: {
          include: {
            set: true
          }
        }
      }
    });

    return updatedUserCard;
  }

  /**
   * Supprime une carte de la collection
   * Note: language est requis car la clé unique est (userId, cardId, language)
   */
  async removeCardFromCollection(userId: string, cardId: string, language: string) {
    const userCard = await prisma.userCard.findUnique({
      where: {
        userId_cardId_language: {
          userId,
          cardId,
          language
        }
      }
    });

    if (!userCard) {
      throw new Error('Carte non trouvée dans la collection');
    }

    await prisma.userCard.delete({
      where: {
        userId_cardId_language: {
          userId,
          cardId,
          language
        }
      }
    });

    return { success: true };
  }

  /**
   * Récupère les statistiques de collection
   */
  async getCollectionStats(userId: string, options?: z.infer<typeof collectionStatsSchema>) {
    const validatedOptions = collectionStatsSchema.parse(options || {});
    const extras = validatedOptions.extras;

  // Récupérer toutes les cartes de l'utilisateur avec leurs prix
    const userCardsWithPrices = await prisma.userCard.findMany({
      where: ({ 
        userId,
        ...(extras !== undefined ? { card: { is: { isExtra: extras } } } : {})
      } as any),
      include: { card: true }
    });

    // Calculer la valeur totale (utilise priceEur/priceEurFoil si disponible, sinon fallback JSON)
    let totalValue = 0;
    userCardsWithPrices.forEach((userCard: any) => {
      const card: any = userCard.card;
      const eurPrice = card.priceEur ?? getPriceFromJson(card.prices, 'eur') ?? 0;
      const eurFoilPrice = card.priceEurFoil ?? getPriceFromJson(card.prices, 'eur_foil') ?? 0;
      totalValue += (eurPrice * userCard.quantity) + (eurFoilPrice * userCard.quantityFoil);
    });

    // Statistiques générales
    const generalStats = await prisma.userCard.aggregate({
      where: ({ 
        userId,
        ...(extras !== undefined ? { card: { is: { isExtra: extras } } } : {})
      } as any),
      _sum: {
        quantity: true,
        quantityFoil: true
      },
      _count: {
        _all: true
      }
    });

    // Statistiques par groupement
    let groupedStats;
    
    switch (validatedOptions.groupBy) {
      case 'set': {
        const setCards = await prisma.userCard.findMany({
          where: ({
            userId,
            ...(extras !== undefined ? { card: { is: { isExtra: extras } } } : {})
          } as any),
          include: { card: { include: { set: true } } }
        });
  const setStats = new Map<string, { set: any; uniqueCards: number; totalCards: number; totalFoils: number; totalInScope?: number }>();
        const seenBySet = new Map<string, Set<string>>();
  setCards.forEach((uc: any) => {
          const c = uc.card as any;
          const sId = c.setId as string;
          if (!setStats.has(sId)) {
            setStats.set(sId, { set: c.set, uniqueCards: 0, totalCards: 0, totalFoils: 0 });
            seenBySet.set(sId, new Set<string>());
          }
          const bucket = setStats.get(sId)!;
          const seen = seenBySet.get(sId)!;
          if (!seen.has(c.id)) {
            bucket.uniqueCards += 1;
            seen.add(c.id);
          }
          bucket.totalCards += uc.quantity;
          bucket.totalFoils += uc.quantityFoil;
        });
        // When extras scope is selected, compute per-set totalInScope so UI can compute completion properly.
        if (extras !== undefined) {
          const setIds = Array.from(setStats.keys());
          if (setIds.length > 0) {
            const cardsBySet = await prisma.card.findMany({
              where: ({ setId: { in: setIds }, isExtra: extras } as any),
              select: { id: true, setId: true }
            });
            const totals = new Map<string, number>();
            for (const c of cardsBySet) {
              totals.set(c.setId, (totals.get(c.setId) || 0) + 1);
            }
            for (const [sid, bucket] of setStats.entries()) {
              const t = totals.get(sid) || 0;
              if (t > 0) bucket.totalInScope = t;
            }
          }
        }
        groupedStats = Array.from(setStats.values());
        break;
      }

      case 'rarity':
        const rarityCards = await prisma.userCard.findMany({
          where: ({ 
            userId,
            ...(extras !== undefined ? { card: { is: { isExtra: extras } } } : {})
          } as any),
          include: { card: true }
        });
        
        const rarityStats = new Map();
  rarityCards.forEach((userCard: any) => {
          const rarity = userCard.card.rarity;
          if (!rarityStats.has(rarity)) {
            rarityStats.set(rarity, {
              rarity,
              uniqueCards: 0,
              totalCards: 0,
              totalFoils: 0
            });
          }
          const current = rarityStats.get(rarity);
          current.uniqueCards += 1;
          current.totalCards += userCard.quantity;
          current.totalFoils += userCard.quantityFoil;
        });
        
        groupedStats = Array.from(rarityStats.values());
        break;

      case 'color':
        const colorCards = await prisma.userCard.findMany({
          where: ({ 
            userId,
            ...(extras !== undefined ? { card: { is: { isExtra: extras } } } : {})
          } as any),
          include: { card: true }
        });
        
        const colorStats = new Map();
  colorCards.forEach((userCard: any) => {
          // Parser le JSON des couleurs
          let colors: string[] = [];
          const colorIdentityString = userCard.card.colorIdentity;
          
          if (colorIdentityString && typeof colorIdentityString === 'string') {
            try {
              const parsed = JSON.parse(colorIdentityString);
              colors = Array.isArray(parsed) ? parsed : [];
            } catch {
              colors = [];
            }
          }
          
          if (colors.length === 0) colors = ['Colorless'];
          
          colors.forEach(color => {
            if (!colorStats.has(color)) {
              colorStats.set(color, {
                color,
                uniqueCards: 0,
                totalCards: 0,
                totalFoils: 0
              });
            }
            const current = colorStats.get(color);
            current.uniqueCards += 1;
            current.totalCards += userCard.quantity;
            current.totalFoils += userCard.quantityFoil;
          });
        });
        
        groupedStats = Array.from(colorStats.values());
        break;

      default:
        groupedStats = [];
    }

    return {
      general: {
  uniqueCards: generalStats._count?._all ?? 0,
  totalCards: (generalStats._sum?.quantity as number | null) ?? 0,
  totalFoils: (generalStats._sum?.quantityFoil as number | null) ?? 0,
        totalValue: Math.round(totalValue * 100) / 100 // Arrondir à 2 décimales
      },
      grouped: groupedStats
    };
  }

  /**
   * Récupère les cartes manquantes d'un set pour l'utilisateur
   */
  async getMissingCardsFromSet(userId: string, setId: string, opts?: { extras?: boolean }) {
    const extras = opts?.extras;
    // Toutes les cartes du set
    const allSetCards = await prisma.card.findMany({
      where: { setId, ...(extras !== undefined ? { isExtra: extras } : {}) },
      include: { set: true }
    });

    // Cartes possédées par l'utilisateur dans ce set
    const ownedCards = await prisma.userCard.findMany({
      where: {
        userId,
        card: { setId, ...(extras !== undefined ? { isExtra: extras } : {}) }
      },
      include: { card: true }
    });

  const ownedCardIds = new Set(ownedCards.map((uc: any) => uc.cardId));
    
  const missingCards = allSetCards.filter((card: any) => !ownedCardIds.has(card.id));

    return {
      setInfo: allSetCards[0]?.set,
      totalCards: allSetCards.length,
      ownedCards: ownedCards.length,
      missingCards: missingCards.length,
      completionPercentage: Math.round((ownedCards.length / allSetCards.length) * 100),
      cards: missingCards
    };
  }
}

export const collectionService = new CollectionService();
