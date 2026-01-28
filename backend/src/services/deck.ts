import { prisma } from '../db/prisma';
import { z } from 'zod';


// Schémas de validation Zod
const createDeckSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  format: z.enum(['Standard', 'Commander', 'Modern', 'Legacy', 'Vintage', 'Pioneer', 'Historic', 'Alchemy', 'Brawl', 'Pauper', 'Casual']),
  archetype: z.enum(['Aggro', 'Control', 'Midrange', 'Combo', 'Ramp', 'Tempo', 'Prison', 'Burn']).optional(),
  isPublic: z.boolean().default(false)
});

const updateDeckSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  format: z.enum(['Standard', 'Commander', 'Modern', 'Legacy', 'Vintage', 'Pioneer', 'Historic', 'Alchemy', 'Brawl', 'Pauper', 'Casual']).optional(),
  archetype: z.enum(['Aggro', 'Control', 'Midrange', 'Combo', 'Ramp', 'Tempo', 'Prison', 'Burn']).optional(),
  isPublic: z.boolean().optional()
});

const addCardToDeckSchema = z.object({
  cardId: z.string(),
  quantity: z.number().min(1).max(99),
  board: z.enum(['main', 'side', 'maybe']).default('main')
});

const updateDeckCardSchema = z.object({
  quantity: z.number().min(0).max(99).optional(),
  board: z.enum(['main', 'side', 'maybe']).optional()
});

export class DeckService {

  /**
   * Récupère tous les decks d'un utilisateur
   */
  async getUserDecks(userId: string, includePublic: boolean = false) {
    const where: any = includePublic 
      ? { OR: [{ userId }, { isPublic: true }] }
      : { userId };

    const decks = await prisma.deck.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true }
        },
        deckCards: {
          include: {
            card: {
              include: {
                set: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Calculer les statistiques pour chaque deck
    const decksWithStats = decks.map((deck: any) => {
      const mainboard = deck.deckCards.filter((dc: any) => dc.board === 'main');
      const sideboard = deck.deckCards.filter((dc: any) => dc.board === 'side');
      
      const mainboardCount = mainboard.reduce((sum: any, dc: any) => sum + dc.quantity, 0);
      const sideboardCount = sideboard.reduce((sum: any, dc: any) => sum + dc.quantity, 0);
      
      // Calcul des couleurs du deck
      const colorSet = new Set<string>();
  mainboard.forEach((dc: any) => {
        // Parser le JSON des couleurs pour chaque carte
        let cardColors: string[] = [];
        if (dc.card.colorIdentity && typeof dc.card.colorIdentity === 'string') {
          try {
            const parsed = JSON.parse(dc.card.colorIdentity);
            cardColors = Array.isArray(parsed) ? parsed : [];
          } catch {
            cardColors = [];
          }
        }
        cardColors.forEach(color => colorSet.add(color));
      });
      const colors = Array.from(colorSet);

      return {
        ...deck,
        mainboardCount,
        sideboardCount,
        colors,
        stats: this.calculateDeckStats(mainboard)
      };
    });

    return decksWithStats;
  }

  /**
   * Récupère un deck spécifique avec tous ses détails
   */
  async getDeckById(deckId: string, userId?: string) {
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        user: {
          select: { id: true, username: true }
        },
        deckCards: {
          include: {
            card: {
              include: {
                set: true
              }
            }
          },
          orderBy: [
            { board: 'asc' },
            { card: { cmc: 'asc' } },
            { card: { name: 'asc' } }
          ]
        }
      }
    });

    if (!deck) {
      throw new Error('Deck non trouvé');
    }

    // Vérifier les permissions
    if (!deck.isPublic && deck.userId !== userId) {
      throw new Error('Accès non autorisé à ce deck');
    }

  const mainboard = deck.deckCards.filter((dc: any) => dc.board === 'main');
  const sideboard = deck.deckCards.filter((dc: any) => dc.board === 'side');
  const maybeboard = deck.deckCards.filter((dc: any) => dc.board === 'maybe');

  const mainboardCount = mainboard.reduce((sum: any, dc: any) => sum + dc.quantity, 0);
  const sideboardCount = sideboard.reduce((sum: any, dc: any) => sum + dc.quantity, 0);

    // Calcul des couleurs du deck
    const colorSet = new Set<string>();
  mainboard.forEach((dc: any) => {
      // Parser le JSON des couleurs pour chaque carte
      let cardColors: string[] = [];
      if (dc.card.colorIdentity && typeof dc.card.colorIdentity === 'string') {
        try {
          const parsed = JSON.parse(dc.card.colorIdentity);
          cardColors = Array.isArray(parsed) ? parsed : [];
        } catch {
          cardColors = [];
        }
      }
      cardColors.forEach(color => colorSet.add(color));
    });
    const colors = Array.from(colorSet);

    return {
      ...deck,
      mainboardCount,
      sideboardCount,
      colors,
      mainboard,
      sideboard,
      maybeboard,
      stats: this.calculateDeckStats(mainboard),
      analytics: this.calculateDeckAnalytics(mainboard)
    };
  }

  /**
   * Crée un nouveau deck
   */
  async createDeck(userId: string, data: z.infer<typeof createDeckSchema>) {
    const validatedData = createDeckSchema.parse(data);

    const deck = await prisma.deck.create({
      data: {
        ...validatedData,
        userId,
        colors: JSON.stringify([]) as any, // Sera mis à jour lors de l'ajout de cartes
      },
      include: {
        user: {
          select: { id: true, username: true }
        }
      }
    });

    return deck;
  }

  /**
   * Met à jour un deck
   */
  async updateDeck(deckId: string, userId: string, data: z.infer<typeof updateDeckSchema>) {
    const validatedData = updateDeckSchema.parse(data);

    // Vérifier que l'utilisateur possède le deck
    const existingDeck = await prisma.deck.findUnique({
      where: { id: deckId }
    });

    if (!existingDeck || existingDeck.userId !== userId) {
      throw new Error('Deck non trouvé ou accès non autorisé');
    }

    const updatedDeck = await prisma.deck.update({
      where: { id: deckId },
      data: validatedData,
      include: {
        user: {
          select: { id: true, username: true }
        },
        deckCards: {
          include: {
            card: {
              include: {
                set: true
              }
            }
          }
        }
      }
    });

    return updatedDeck;
  }

  /**
   * Supprime un deck
   */
  async deleteDeck(deckId: string, userId: string) {
    // Vérifier que l'utilisateur possède le deck
    const existingDeck = await prisma.deck.findUnique({
      where: { id: deckId }
    });

    if (!existingDeck || existingDeck.userId !== userId) {
      throw new Error('Deck non trouvé ou accès non autorisé');
    }

    await prisma.deck.delete({
      where: { id: deckId }
    });

    return { success: true };
  }

  /**
   * Duplique un deck et toutes ses cartes
   */
  async duplicateDeck(deckId: string, userId: string) {
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: { deckCards: true }
    });

    if (!deck) {
      throw new Error('Deck non trouvé');
    }
    if (deck.userId !== userId) {
      throw new Error('Accès non autorisé à ce deck');
    }

    const newDeck = await prisma.deck.create({
      data: {
        name: `${deck.name} (copie)`,
        description: deck.description,
        format: deck.format,
        archetype: deck.archetype,
        colors: deck.colors,
        isPublic: false,
        userId: deck.userId,
        mainboardCount: deck.mainboardCount,
        sideboardCount: deck.sideboardCount,
      }
    });

    if (deck.deckCards.length > 0) {
      await prisma.deckCard.createMany({
  data: deck.deckCards.map((dc: any) => ({
          deckId: newDeck.id,
          cardId: dc.cardId,
          quantity: dc.quantity,
          board: dc.board,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      });
    }

    // Recompute metadata for the new deck
    await this.updateDeckMetadata(newDeck.id);

    return this.getDeckById(newDeck.id, userId);
  }

  /**
   * Ajoute ou met à jour une carte dans un deck
   */
  async addCardToDeck(deckId: string, userId: string, data: z.infer<typeof addCardToDeckSchema>) {
    const validatedData = addCardToDeckSchema.parse(data);

    // Vérifier que l'utilisateur possède le deck
    const deck = await prisma.deck.findUnique({
      where: { id: deckId }
    });

    if (!deck || deck.userId !== userId) {
      throw new Error('Deck non trouvé ou accès non autorisé');
    }

    // Vérifier que la carte existe
    const card = await prisma.card.findUnique({
      where: { id: validatedData.cardId }
    });

    if (!card) {
      throw new Error('Carte non trouvée');
    }

    // Ajouter/mettre à jour la carte dans le deck
    const deckCard = await prisma.deckCard.upsert({
      where: {
        deckId_cardId_board: {
          deckId,
          cardId: validatedData.cardId,
          board: validatedData.board
        }
      },
      update: {
        quantity: validatedData.quantity
      },
      create: {
        deckId,
        cardId: validatedData.cardId,
        quantity: validatedData.quantity,
        board: validatedData.board
      },
      include: {
        card: {
          include: {
            set: true
          }
        }
      }
    });

    // Mettre à jour les couleurs et compteurs du deck
    await this.updateDeckMetadata(deckId);

    return deckCard;
  }

  /**
   * Bulk upsert deck cards (create/update/remove) in a single transaction.
   * operations: array of { cardId, quantity, board }
   * If quantity = 0 -> remove entry if exists.
   */
  async bulkUpsertDeckCards(deckId: string, userId: string, operations: Array<{ cardId: string; quantity: number; board: 'main'|'side'|'maybe' }>) {
    // Verify deck ownership
    const deck = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck || deck.userId !== userId) {
      throw new Error('Deck non trouvé ou accès non autorisé');
    }

    if (!operations || operations.length === 0) {
      return { updated: 0 };
    }

    // Fetch all cards referenced to validate existence once
    const uniqueCardIds = Array.from(new Set(operations.map(o => o.cardId)));
    const existingCards = await prisma.card.findMany({ where: { id: { in: uniqueCardIds } } });
    const existingMap = new Set(existingCards.map((c: { id: string }) => c.id));
    const invalid = uniqueCardIds.filter(id => !existingMap.has(id));
    if (invalid.length) {
      throw new Error(`Cartes inexistantes: ${invalid.join(', ')}`);
    }

    const tx: any[] = [];
    for (const op of operations) {
      if (op.quantity <= 0) {
        tx.push(prisma.deckCard.deleteMany({ where: { deckId, cardId: op.cardId, board: op.board } }));
      } else {
        tx.push(
          prisma.deckCard.upsert({
            where: { deckId_cardId_board: { deckId, cardId: op.cardId, board: op.board } },
            update: { quantity: op.quantity },
            create: { deckId, cardId: op.cardId, quantity: op.quantity, board: op.board }
          })
        );
      }
    }

    await prisma.$transaction(tx);
    // Recompute metadata once
    await this.updateDeckMetadata(deckId);
    return { updated: operations.length };
  }

  /**
   * Validate deck against basic format rules (mainboard size, sideboard size, copy limits, banlists).
   * Requires userId to verify ownership.
   */
  async validateDeck(deckId: string, userId?: string) {
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: { deckCards: { include: { card: true } } }
    });
    if (!deck) throw new Error('Deck non trouvé');

    // Verify ownership: only owner can validate (unless deck is public)
    if (userId && deck.userId !== userId && !deck.isPublic) {
      throw new Error('Accès non autorisé à ce deck');
    }

    const format = deck.format as string;
    const mainboard = deck.deckCards.filter((dc: { board: string }) => dc.board === 'main');
    const sideboard = deck.deckCards.filter((dc: { board: string }) => dc.board === 'side');

    const mainCount = mainboard.reduce((s: number, dc: { quantity: number }) => s + dc.quantity, 0);
    const sideCount = sideboard.reduce((s: number, dc: { quantity: number }) => s + dc.quantity, 0);

    // Rules lookups (mirroring frontend domain rules)
    const SINGLETON_FORMATS = new Set(['Commander']);
    const MAIN_MINIMUM: Record<string, number> = {
      Standard: 60, Pioneer: 60, Modern: 60, Legacy: 60, Vintage: 60, Historic: 60,
      Commander: 99, Alchemy: 60, Brawl: 60, Pauper: 60, Casual: 60
    };
    const SIDEBOARD_LIMIT: Record<string, number> = {
      Standard: 15, Pioneer: 15, Modern: 15, Legacy: 15, Vintage: 15, Historic: 15
    } as Record<string, number>;
    const BANLIST: Record<string, string[]> = {
      Standard: [], Pioneer: [], Modern: [], Legacy: [], Vintage: [], Historic: [],
      Commander: [], Alchemy: [], Brawl: [], Pauper: [], Casual: []
    };

    const issues: string[] = [];

    // Main size
    const required = MAIN_MINIMUM[format] ?? 60;
    if (mainCount < required) issues.push(`Mainboard insuffisant (${mainCount}/${required})`);
    // Side size
    const sideLimit = SIDEBOARD_LIMIT[format];
    if (sideLimit && sideCount > sideLimit) issues.push(`Sideboard trop grand (${sideCount}/${sideLimit} max)`);

    // Copy limits
    const copyLimit = SINGLETON_FORMATS.has(format) ? 1 : 4;
    const countsByOracle: Record<string, { qty: number; name: string }> = {};
    for (const dc of mainboard) {
      const oracle = dc.card.oracleId || dc.card.id;
      const name = dc.card.nameFr || dc.card.name;
      const isBasic = ['Plains','Island','Swamp','Mountain','Forest','Wastes'].includes(dc.card.name);
      if (!countsByOracle[oracle]) countsByOracle[oracle] = { qty: 0, name };
      countsByOracle[oracle].qty += dc.quantity;
      if (!isBasic && countsByOracle[oracle].qty > copyLimit) {
        // Avoid pushing duplicate issue for same card
        if (!issues.find(i => i.includes(name))) {
          issues.push(`Copies excessives: ${name} (${countsByOracle[oracle].qty} > ${copyLimit})`);
        }
      }
    }

    // Banlist check
    const bannedList = new Set((BANLIST[format] || []).map(n => n.toLowerCase()));
    for (const dc of mainboard) {
      const nm = (dc.card.nameFr || dc.card.name || '').toLowerCase();
      if (bannedList.has(nm)) {
        issues.push(`Carte bannie: ${dc.card.nameFr || dc.card.name}`);
      }
    }

    // Commander identity (future enhancement) placeholder
    // if (format === 'Commander') { /* identity checks */ }

    const result = {
      deckId,
      format,
      mainCount,
      sideCount,
      valid: issues.length === 0,
      issues
    };

    // Persist cached validation metadata on the deck (non-blocking errors ignored)
    try {
      await prisma.deck.update({
        where: { id: deckId },
        data: {
          lastValidationAt: new Date(),
          lastValidationValid: result.valid,
          lastValidationIssues: result.issues as any
        }
      });
    } catch (e) {
      // Logging only; do not fail validation response
      console.warn('Validation cache update failed:', e);
    }

    return result;
  }

  /**
   * Met à jour une carte dans un deck
   */
  async updateDeckCard(
    deckId: string, 
    userId: string, 
    cardId: string, 
    board: string,
    data: z.infer<typeof updateDeckCardSchema>
  ) {
    const validatedData = updateDeckCardSchema.parse(data);

    // Vérifier que l'utilisateur possède le deck
    const deck = await prisma.deck.findUnique({
      where: { id: deckId }
    });

    if (!deck || deck.userId !== userId) {
      throw new Error('Deck non trouvé ou accès non autorisé');
    }

    const deckCard = await prisma.deckCard.findUnique({
      where: {
        deckId_cardId_board: {
          deckId,
          cardId,
          board: board as any
        }
      }
    });

    if (!deckCard) {
      throw new Error('Carte non trouvée dans le deck');
    }

    // Si la quantité est 0, supprimer la carte
    if (validatedData.quantity === 0) {
      await prisma.deckCard.delete({
        where: {
          deckId_cardId_board: {
            deckId,
            cardId,
            board: board as any
          }
        }
      });
      
      await this.updateDeckMetadata(deckId);
      return null;
    }

    const updatedDeckCard = await prisma.deckCard.update({
      where: {
        deckId_cardId_board: {
          deckId,
          cardId,
          board: board as any
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

    await this.updateDeckMetadata(deckId);
    return updatedDeckCard;
  }

  /**
   * Supprime une carte d'un deck
   */
  async removeCardFromDeck(deckId: string, userId: string, cardId: string, board: string) {
    // Vérifier que l'utilisateur possède le deck
    const deck = await prisma.deck.findUnique({
      where: { id: deckId }
    });

    if (!deck || deck.userId !== userId) {
      throw new Error('Deck non trouvé ou accès non autorisé');
    }

    const deckCard = await prisma.deckCard.findUnique({
      where: {
        deckId_cardId_board: {
          deckId,
          cardId,
          board: board as any
        }
      }
    });

    if (!deckCard) {
      throw new Error('Carte non trouvée dans le deck');
    }

    await prisma.deckCard.delete({
      where: {
        deckId_cardId_board: {
          deckId,
          cardId,
          board: board as any
        }
      }
    });

    await this.updateDeckMetadata(deckId);
    return { success: true };
  }

  /**
   * Met à jour les métadonnées du deck (couleurs, compteurs)
   */
  private async updateDeckMetadata(deckId: string) {
    const deckCards = await prisma.deckCard.findMany({
      where: { deckId },
      include: { card: true }
    });

  const mainboard = deckCards.filter((dc: any) => dc.board === 'main');
  const sideboard = deckCards.filter((dc: any) => dc.board === 'side');

  const mainboardCount = mainboard.reduce((sum: any, dc: any) => sum + dc.quantity, 0);
  const sideboardCount = sideboard.reduce((sum: any, dc: any) => sum + dc.quantity, 0);

    // Calcul des couleurs
    const colorSet = new Set<string>();
  mainboard.forEach((dc: any) => {
      // Parser le JSON des couleurs pour chaque carte
      let cardColors: string[] = [];
      if (dc.card.colorIdentity && typeof dc.card.colorIdentity === 'string') {
        try {
          const parsed = JSON.parse(dc.card.colorIdentity);
          cardColors = Array.isArray(parsed) ? parsed : [];
        } catch {
          cardColors = [];
        }
      }
      cardColors.forEach(color => colorSet.add(color));
    });
    const colors = Array.from(colorSet);

    await prisma.deck.update({
      where: { id: deckId },
      data: {
        colors: JSON.stringify(colors) as any, // Convertir en JSON pour SQLite
        mainboardCount,
        sideboardCount
      }
    });
  }

  /**
   * Calcule les statistiques de base d'un deck
   */
  private calculateDeckStats(mainboard: any[]) {
    const totalCards = mainboard.reduce((sum, dc) => sum + dc.quantity, 0);
    
    // Répartition par type
    const typeStats = {
      creatures: 0,
      instants: 0,
      sorceries: 0,
      artifacts: 0,
      enchantments: 0,
      planeswalkers: 0,
      lands: 0,
      other: 0
    };

    mainboard.forEach(dc => {
      const quantity = dc.quantity;
      const typeLine = dc.card.typeLine.toLowerCase();
      
      if (typeLine.includes('creature')) {
        typeStats.creatures += quantity;
      } else if (typeLine.includes('instant')) {
        typeStats.instants += quantity;
      } else if (typeLine.includes('sorcery')) {
        typeStats.sorceries += quantity;
      } else if (typeLine.includes('artifact')) {
        typeStats.artifacts += quantity;
      } else if (typeLine.includes('enchantment')) {
        typeStats.enchantments += quantity;
      } else if (typeLine.includes('planeswalker')) {
        typeStats.planeswalkers += quantity;
      } else if (typeLine.includes('land')) {
        typeStats.lands += quantity;
      } else {
        typeStats.other += quantity;
      }
    });

    return {
      totalCards,
      typeDistribution: typeStats
    };
  }

  /**
   * Calcule les analytics avancées d'un deck
   */
  private calculateDeckAnalytics(mainboard: any[]) {
    // Courbe de mana
    const manaCurve = new Array(10).fill(0); // CMC 0-9+
    
    // Répartition des couleurs
    const colorDistribution = {
      W: 0, U: 0, B: 0, R: 0, G: 0, C: 0
    };

    mainboard.forEach(dc => {
      const quantity = dc.quantity;
      const cmc = Math.min(dc.card.cmc || 0, 9);
      manaCurve[Math.floor(cmc)] += quantity;

      // Compter les symboles de mana dans le coût
      if (dc.card.manaCost) {
        const manaCost = dc.card.manaCost;
        const wCount = (manaCost.match(/\{W\}/g) || []).length;
        const uCount = (manaCost.match(/\{U\}/g) || []).length;
        const bCount = (manaCost.match(/\{B\}/g) || []).length;
        const rCount = (manaCost.match(/\{R\}/g) || []).length;
        const gCount = (manaCost.match(/\{G\}/g) || []).length;

        colorDistribution.W += wCount * quantity;
        colorDistribution.U += uCount * quantity;
        colorDistribution.B += bCount * quantity;
        colorDistribution.R += rCount * quantity;
        colorDistribution.G += gCount * quantity;
      }

      // Cartes colorless
      let cardColors: string[] = [];
      if (dc.card.colorIdentity && typeof dc.card.colorIdentity === 'string') {
        try {
          const parsed = JSON.parse(dc.card.colorIdentity);
          cardColors = Array.isArray(parsed) ? parsed : [];
        } catch {
          cardColors = [];
        }
      }
      
      if (cardColors.length === 0) {
        colorDistribution.C += quantity;
      }
    });

    // CMC moyen
    const totalCmc = mainboard.reduce((sum, dc) => sum + (dc.card.cmc || 0) * dc.quantity, 0);
    const totalCards = mainboard.reduce((sum, dc) => sum + dc.quantity, 0);
    const averageCmc = totalCards > 0 ? totalCmc / totalCards : 0;

    return {
      manaCurve,
      colorDistribution,
      averageCmc: Math.round(averageCmc * 100) / 100
    };
  }

  /**
   * Import d'un deck depuis MTGA
   */
  async importFromMTGA(userId: string, decklistText: string, deckName?: string) {
    const lines = decklistText.split('\n').filter(line => line.trim());
    const cards: { name: string; quantity: number; board: string }[] = [];
    let currentBoard = 'main';

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === 'Deck' || trimmedLine === '') {
        currentBoard = 'main';
        continue;
      }
      
      if (trimmedLine === 'Sideboard') {
        currentBoard = 'side';
        continue;
      }

      // Parse "4 Card Name"
      const match = trimmedLine.match(/^(\d+)\s+(.+)$/);
      if (match) {
        const quantity = parseInt(match[1]);
        const cardName = match[2].trim();
        
        cards.push({
          name: cardName,
          quantity,
          board: currentBoard
        });
      }
    }

    if (cards.length === 0) {
      throw new Error('Aucune carte trouvée dans le decklist');
    }

    // Créer le deck
    const deck = await this.createDeck(userId, {
      name: deckName || 'Deck importé MTGA',
      format: 'Standard', // Par défaut, l'utilisateur peut changer
      isPublic: false // Par défaut privé
    });

    // Rechercher et ajouter les cartes
    const notFoundCards: string[] = [];
    
    for (const cardData of cards) {
      // Rechercher la carte par nom
      const card = await prisma.card.findFirst({
        where: {
          OR: [
            { name: { equals: cardData.name } },
            { nameFr: { equals: cardData.name } }
          ]
        }
      });

      if (card) {
        await this.addCardToDeck(deck.id, userId, {
          cardId: card.id,
          quantity: cardData.quantity,
          board: cardData.board as 'main' | 'side'
        });
      } else {
        notFoundCards.push(cardData.name);
      }
    }

    const finalDeck = await this.getDeckById(deck.id, userId);

    return {
      deck: finalDeck,
      importStats: {
        totalCards: cards.length,
        foundCards: cards.length - notFoundCards.length,
        notFoundCards
      }
    };
  }

  /**
   * Export d'un deck vers MTGA
   */
  async exportToMTGA(deckId: string, userId?: string) {
    const deck = await this.getDeckById(deckId, userId);
    
    let mtgaFormat = `Deck\n`;
    
    // Mainboard
  deck.mainboard.forEach((deckCard: any) => {
      mtgaFormat += `${deckCard.quantity} ${deckCard.card.name}\n`;
    });

    // Sideboard
    if (deck.sideboard.length > 0) {
      mtgaFormat += `\nSideboard\n`;
  deck.sideboard.forEach((deckCard: any) => {
        mtgaFormat += `${deckCard.quantity} ${deckCard.card.name}\n`;
      });
    }

    return {
      deckName: deck.name,
      format: mtgaFormat.trim()
    };
  }
}

export const deckService = new DeckService();
