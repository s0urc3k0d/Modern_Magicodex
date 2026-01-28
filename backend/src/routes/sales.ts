import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Conditions Cardmarket
const CARDMARKET_CONDITIONS = ['MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO'] as const;
type CardmarketCondition = typeof CARDMARKET_CONDITIONS[number];

// Langues supportées
const LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt', 'ja', 'ko', 'ru', 'zhs', 'zht'] as const;

// Mapping langue code vers nom Cardmarket
const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'fr': 'French',
  'de': 'German',
  'es': 'Spanish',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ru': 'Russian',
  'zhs': 'Simplified Chinese',
  'zht': 'Traditional Chinese',
};

// Mapping condition code vers nom Cardmarket
const CONDITION_NAMES: Record<string, string> = {
  'MT': 'Mint',
  'NM': 'Near Mint',
  'EX': 'Excellent',
  'GD': 'Good',
  'LP': 'Light Played',
  'PL': 'Played',
  'PO': 'Poor',
};

// Schémas de validation
const addToSaleSchema = z.object({
  cardId: z.string(),
  quantity: z.number().int().min(0).default(1),
  quantityFoil: z.number().int().min(0).default(0),
  condition: z.enum(CARDMARKET_CONDITIONS).default('NM'),
  language: z.enum(LANGUAGES).default('en'),
  isSigned: z.boolean().default(false),
  isAltered: z.boolean().default(false),
  askingPrice: z.number().positive().optional(),
  askingPriceFoil: z.number().positive().optional(),
  notes: z.string().optional(),
});

const updateSaleSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  quantityFoil: z.number().int().min(0).optional(),
  condition: z.enum(CARDMARKET_CONDITIONS).optional(),
  language: z.enum(LANGUAGES).optional(),
  isSigned: z.boolean().optional(),
  isAltered: z.boolean().optional(),
  askingPrice: z.number().positive().nullable().optional(),
  askingPriceFoil: z.number().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const bulkAddToSaleSchema = z.object({
  items: z.array(addToSaleSchema).min(1).max(100),
});

/**
 * @swagger
 * /sales:
 *   get:
 *     summary: Récupérer la liste des cartes à vendre
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // Récupérer les items de la liste FORSALE
    const saleItems = await prisma.userListItem.findMany({
      where: {
        userId,
        type: 'FORSALE',
      },
      include: {
        card: {
          include: {
            set: true,
          },
        },
      },
      orderBy: [
        { updatedAt: 'desc' },
      ],
    });

    // Calculer les stats
    const stats = {
      totalItems: saleItems.length,
      totalCards: saleItems.reduce((sum: number, item: typeof saleItems[0]) => sum + item.quantity, 0),
      totalValue: saleItems.reduce((sum: number, item: typeof saleItems[0]) => {
        const price = item.askingPrice || 0;
        return sum + (price * item.quantity);
      }, 0),
    };

    res.json({
      items: saleItems.map((item: typeof saleItems[0]) => ({
        id: item.id,
        card: {
          id: item.card.id,
          scryfallId: item.card.scryfallId,
          name: item.card.name,
          nameFr: item.card.nameFr,
          collectorNumber: item.card.collectorNumber,
          rarity: item.card.rarity,
          imageUris: item.card.imageUris ? JSON.parse(item.card.imageUris) : null,
          priceEur: item.card.priceEur,
          priceEurFoil: item.card.priceEurFoil,
          set: {
            id: item.card.set.id,
            code: item.card.set.code,
            name: item.card.set.name,
            nameFr: item.card.set.nameFr,
            iconSvgUri: item.card.set.iconSvgUri,
          },
        },
        quantity: item.quantity,
        condition: item.condition,
        language: item.language,
        isFoil: item.isFoil,
        isSigned: item.isSigned,
        isAltered: item.isAltered,
        askingPrice: item.askingPrice,
        notes: item.notes,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      stats,
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des ventes' });
  }
});

/**
 * @swagger
 * /sales:
 *   post:
 *     summary: Ajouter une carte à la liste de vente
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const data = addToSaleSchema.parse(req.body);

    // Vérifier que la carte existe
    const card = await prisma.card.findUnique({
      where: { id: data.cardId },
    });
    if (!card) {
      return res.status(404).json({ error: 'Carte non trouvée' });
    }

    // Créer ou mettre à jour l'item de vente
    // Note: on crée un item séparé pour chaque combinaison condition/language/foil
    const existingItem = await prisma.userListItem.findFirst({
      where: {
        userId,
        cardId: data.cardId,
        type: 'FORSALE',
        condition: data.condition,
        language: data.language,
        isFoil: data.quantityFoil > 0,
        isSigned: data.isSigned,
        isAltered: data.isAltered,
      },
    });

    let saleItem;
    if (existingItem) {
      // Mettre à jour la quantité
      saleItem = await prisma.userListItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + (data.quantityFoil > 0 ? data.quantityFoil : data.quantity),
          askingPrice: data.askingPrice || existingItem.askingPrice,
          notes: data.notes || existingItem.notes,
        },
        include: { card: { include: { set: true } } },
      });
    } else {
      // Créer un nouvel item
      const isFoil = data.quantityFoil > 0;
      saleItem = await prisma.userListItem.create({
        data: {
          userId,
          cardId: data.cardId,
          type: 'FORSALE',
          quantity: isFoil ? data.quantityFoil : data.quantity,
          condition: data.condition,
          language: data.language,
          isFoil,
          isSigned: data.isSigned,
          isAltered: data.isAltered,
          askingPrice: isFoil ? data.askingPriceFoil : data.askingPrice,
          notes: data.notes,
        },
        include: { card: { include: { set: true } } },
      });
    }

    res.status(201).json({
      message: 'Carte ajoutée à la liste de vente',
      item: saleItem,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.issues });
    }
    console.error('Add to sale error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout à la vente' });
  }
});

/**
 * @swagger
 * /sales/bulk:
 *   post:
 *     summary: Ajouter plusieurs cartes à la liste de vente
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 */
router.post('/bulk', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { items } = bulkAddToSaleSchema.parse(req.body);

    const results = await prisma.$transaction(async (tx: typeof prisma) => {
      const created: any[] = [];
      const updated: any[] = [];

      for (const item of items) {
        const isFoil = item.quantityFoil > 0;
        
        const existingItem = await tx.userListItem.findFirst({
          where: {
            userId,
            cardId: item.cardId,
            type: 'FORSALE',
            condition: item.condition,
            language: item.language,
            isFoil,
            isSigned: item.isSigned,
            isAltered: item.isAltered,
          },
        });

        if (existingItem) {
          const updatedItem = await tx.userListItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: existingItem.quantity + (isFoil ? item.quantityFoil : item.quantity),
              askingPrice: item.askingPrice || existingItem.askingPrice,
            },
          });
          updated.push(updatedItem);
        } else {
          const newItem = await tx.userListItem.create({
            data: {
              userId,
              cardId: item.cardId,
              type: 'FORSALE',
              quantity: isFoil ? item.quantityFoil : item.quantity,
              condition: item.condition,
              language: item.language,
              isFoil,
              isSigned: item.isSigned,
              isAltered: item.isAltered,
              askingPrice: isFoil ? item.askingPriceFoil : item.askingPrice,
              notes: item.notes,
            },
          });
          created.push(newItem);
        }
      }

      return { created, updated };
    });

    res.status(201).json({
      message: `${results.created.length} créés, ${results.updated.length} mis à jour`,
      created: results.created.length,
      updated: results.updated.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.issues });
    }
    console.error('Bulk add to sale error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout en masse' });
  }
});

/**
 * @swagger
 * /sales/{id}:
 *   patch:
 *     summary: Mettre à jour un item de vente
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const data = updateSaleSchema.parse(req.body);

    // Vérifier que l'item existe et appartient à l'utilisateur
    const existingItem = await prisma.userListItem.findFirst({
      where: {
        id,
        userId,
        type: 'FORSALE',
      },
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item de vente non trouvé' });
    }

    const updatedItem = await prisma.userListItem.update({
      where: { id },
      data: {
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.condition && { condition: data.condition }),
        ...(data.language && { language: data.language }),
        ...(data.isSigned !== undefined && { isSigned: data.isSigned }),
        ...(data.isAltered !== undefined && { isAltered: data.isAltered }),
        ...(data.askingPrice !== undefined && { askingPrice: data.askingPrice }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: { card: { include: { set: true } } },
    });

    res.json({
      message: 'Item mis à jour',
      item: updatedItem,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.issues });
    }
    console.error('Update sale error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

/**
 * @swagger
 * /sales/{id}:
 *   delete:
 *     summary: Retirer une carte de la liste de vente
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Vérifier que l'item existe et appartient à l'utilisateur
    const existingItem = await prisma.userListItem.findFirst({
      where: {
        id,
        userId,
        type: 'FORSALE',
      },
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item de vente non trouvé' });
    }

    await prisma.userListItem.delete({
      where: { id },
    });

    res.json({ message: 'Item retiré de la liste de vente' });
  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

/**
 * @swagger
 * /sales/sync-market-prices:
 *   post:
 *     summary: Synchroniser tous les prix demandés avec les prix du marché
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 */
router.post('/sync-market-prices', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // Récupérer tous les items de vente avec les infos de carte
    const saleItems = await prisma.userListItem.findMany({
      where: {
        userId,
        type: 'FORSALE',
      },
      include: {
        card: true,
      },
    });

    if (saleItems.length === 0) {
      return res.json({ message: 'Aucun article à synchroniser', updated: 0 });
    }

    // Mettre à jour chaque item avec le prix du marché
    let updatedCount = 0;
    await prisma.$transaction(async (tx: typeof prisma) => {
      for (const item of saleItems) {
        // Utiliser le prix foil si la carte est foil, sinon le prix normal
        const marketPrice = item.isFoil 
          ? (item.card.priceEurFoil || item.card.priceEur)
          : item.card.priceEur;

        if (marketPrice && marketPrice > 0) {
          await tx.userListItem.update({
            where: { id: item.id },
            data: { askingPrice: marketPrice },
          });
          updatedCount++;
        }
      }
    });

    res.json({ 
      message: `${updatedCount} prix synchronisés sur ${saleItems.length} articles`,
      updated: updatedCount,
      total: saleItems.length,
    });
  } catch (error) {
    console.error('Sync market prices error:', error);
    res.status(500).json({ error: 'Erreur lors de la synchronisation des prix' });
  }
});

/**
 * @swagger
 * /sales/export/cardmarket:
 *   get:
 *     summary: Exporter la liste de vente au format CSV Cardmarket
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     produces:
 *       - text/csv
 */
router.get('/export/cardmarket', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // Récupérer les items de vente
    const saleItems = await prisma.userListItem.findMany({
      where: {
        userId,
        type: 'FORSALE',
        quantity: { gt: 0 },
      },
      include: {
        card: {
          include: {
            set: true,
          },
        },
      },
    });

    if (saleItems.length === 0) {
      return res.status(400).json({ error: 'Aucune carte à exporter' });
    }

    // Générer le CSV
    // Format Cardmarket: "Quantity";"Name";"Expansion";"Language";"Condition";"isFoil";"isSigned";"isAltered";"Price";"Comments"
    const headers = [
      'Quantity',
      'Name',
      'Expansion',
      'Language',
      'Condition',
      'isFoil',
      'isSigned',
      'isAltered',
      'Price',
      'Comments',
    ];

    const rows = saleItems.map((item: typeof saleItems[0]) => {
      const langName = LANGUAGE_NAMES[item.language] || 'English';
      const condName = CONDITION_NAMES[item.condition] || 'Near Mint';
      
      return [
        item.quantity.toString(),
        item.card.name, // Nom EN pour Cardmarket
        item.card.set.name, // Nom complet de l'extension
        langName,
        condName,
        item.isFoil ? 'Yes' : 'No',
        item.isSigned ? 'Yes' : 'No',
        item.isAltered ? 'Yes' : 'No',
        item.askingPrice?.toFixed(2) || '',
        item.notes || '',
      ];
    });

    // Échapper les guillemets et formater en CSV avec point-virgule (format Cardmarket)
    const escapeCsv = (value: string) => {
      if (value.includes('"') || value.includes(';') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return `"${value}"`;
    };

    const csvContent = [
      headers.map(h => `"${h}"`).join(';'),
      ...rows.map((row: string[]) => row.map(escapeCsv).join(';')),
    ].join('\n');

    // Envoyer le fichier
    const filename = `magicodex-export-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + csvContent); // BOM UTF-8 pour Excel
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

/**
 * @swagger
 * /sales/stats:
 *   get:
 *     summary: Statistiques de la liste de vente
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    const items = await prisma.userListItem.findMany({
      where: {
        userId,
        type: 'FORSALE',
      },
      include: {
        card: true,
      },
    });

    // Calculer les stats
    const byCondition: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    let totalCards = 0;
    let totalValue = 0;
    let withPrice = 0;
    let withoutPrice = 0;

    items.forEach((item: typeof items[0]) => {
      totalCards += item.quantity;
      
      byCondition[item.condition] = (byCondition[item.condition] || 0) + item.quantity;
      byLanguage[item.language] = (byLanguage[item.language] || 0) + item.quantity;
      
      if (item.askingPrice) {
        totalValue += item.askingPrice * item.quantity;
        withPrice += item.quantity;
      } else {
        withoutPrice += item.quantity;
      }
    });

    res.json({
      totalItems: items.length,
      totalCards,
      totalValue,
      withPrice,
      withoutPrice,
      byCondition,
      byLanguage,
    });
  } catch (error) {
    console.error('Sales stats error:', error);
    res.status(500).json({ error: 'Erreur lors du calcul des stats' });
  }
});

export default router;
