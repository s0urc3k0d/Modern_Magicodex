import { prisma } from '../db/prisma';
import { z } from 'zod';
import { CleanScryfallService } from './scryfall-clean';

const scryfallService = new CleanScryfallService();

const syncOptionsSchema = z.object({
  type: z.enum(['sets', 'cards', 'full', 'french-translations', 'french-sets']),
  force: z.boolean().default(false),
  language: z.enum(['en', 'fr']).default('en'),
  setCode: z.string().optional()
});

export class AdminService {
  private syncInProgress = false;

  async triggerSync(options: z.infer<typeof syncOptionsSchema>) {
    const validatedOptions = syncOptionsSchema.parse(options);
    
    // Nettoyage des syncs bloquées
    await this.cleanupStuckSyncs();
    
    if (this.syncInProgress) {
      throw new Error('Une synchronisation est déjà en cours');
    }

    this.syncInProgress = true;

    try {
      const syncRecord = await prisma.scryfallSync.create({
        data: {
          type: validatedOptions.type,
          status: 'RUNNING',
          lastSync: new Date()
        }
      });

      let result;

      switch (validatedOptions.type) {
        case 'sets':
          console.log('Starting sets synchronization...');
          result = await scryfallService.syncSets();
          break;
          
        case 'cards':
          if (validatedOptions.setCode) {
            console.log(`Starting cards synchronization for set ${validatedOptions.setCode}...`);
            result = await scryfallService.syncCards(validatedOptions.setCode);
          } else {
            console.log('Starting cards synchronization for all Standard cards...');
            result = await scryfallService.syncCards(); // Synchronise toutes les cartes Standard
          }
          break;

        case 'french-translations':
          console.log('Starting French translations update...');
          result = await scryfallService.updateFrenchTranslations();
          break;

        case 'french-sets':
          console.log('Starting French set names update...');
          result = await scryfallService.updateFrenchSetNames();
          break;
          
        case 'full':
          console.log('Starting full synchronization...');
          await scryfallService.syncSets();
          console.log('Sets synchronization completed, starting cards synchronization...');
          result = await scryfallService.syncCards(); // Synchronise toutes les cartes Standard
          break;
          
        default:
          throw new Error('Type de synchronisation invalide');
      }

      await prisma.scryfallSync.update({
        where: { id: syncRecord.id },
        data: {
          status: 'SUCCESS',
          lastSync: new Date(),
          recordsProcessed: 0,
          message: 'Synchronisation terminée'
        }
      });

      return {
        success: true,
        syncId: syncRecord.id,
        result
      };

    } catch (error) {
      console.error('Erreur déclenchement sync:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      
      try {
        await prisma.scryfallSync.updateMany({
          where: {
            status: 'RUNNING',
            type: validatedOptions.type
          },
          data: {
            status: 'FAILED',
            lastSync: new Date(),
            message: errorMessage
          }
        });
      } catch (updateError) {
        console.error('Erreur mise à jour sync record:', updateError);
      }

      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  async getSystemStats() {
    const [totalUsers, totalSets, totalCards, totalDecks] = await Promise.all([
      prisma.user.count(),
      prisma.set.count(),
      prisma.card.count(),
      prisma.deck.count()
    ]);

    return {
      overview: {
        totalUsers,
        totalSets,
        totalCards,
        totalDecks
      }
    };
  }

  // Alias pour compatibilité avec les routes
  async getGeneralStats() {
    return this.getSystemStats();
  }

  async getUsers(page: number = 1, limit: number = 20, search?: string) {
    const skip = (page - 1) * limit;
    
    const where = search ? {
      OR: [
        { username: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          isAdmin: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async updateUser(userId: string, data: any) {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        updatedAt: true
      }
    });
  }

  async deleteUser(userId: string) {
    await prisma.user.delete({
      where: { id: userId }
    });
    return { success: true };
  }

  async getSyncLogs(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const [syncs, total] = await Promise.all([
      prisma.scryfallSync.findMany({
        skip,
        take: limit,
        orderBy: { lastSync: 'desc' }
      }),
      prisma.scryfallSync.count()
    ]);

    return {
      syncs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getPerformanceMetrics() {
    const [
      userCount,
      deckCount,
      avgCardsPerUser,
      mostActiveUsers,
      largestCollections
    ] = await Promise.all([
      prisma.user.count(),
      
      prisma.deck.count(),
      
      prisma.userCard.aggregate({
        _avg: { quantity: true }
      }).then((result: any) => result._avg.quantity || 0),
      
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          _count: {
            select: { decks: true }
          }
        },
        orderBy: {
          decks: { _count: 'desc' }
        },
        take: 5
      }),
      
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          _count: {
            select: { userCards: true }
          }
        },
        orderBy: {
          userCards: { _count: 'desc' }
        },
        take: 5
      })
    ]);

    const avgDecksPerUser = userCount > 0 ? deckCount / userCount : 0;

    return {
      averages: {
        decksPerUser: avgDecksPerUser,
        cardsPerUser: avgCardsPerUser
      },
      topUsers: {
        mostActiveUsers,
        largestCollections
      }
    };
  }

  async getSystemHealth() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      
      const [userCount, setCount, cardCount] = await Promise.all([
        prisma.user.count(),
        prisma.set.count(),
        prisma.card.count()
      ]);

      const lastSuccessfulSync = await prisma.scryfallSync.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { lastSync: 'desc' }
      });

      const daysSinceLastSync = lastSuccessfulSync 
        ? Math.floor((Date.now() - lastSuccessfulSync.lastSync!.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        status: 'healthy',
        database: {
          connected: true,
          users: userCount,
          sets: setCount,
          cards: cardCount
        },
        sync: {
          lastSuccessfulSync: lastSuccessfulSync?.lastSync || null,
          daysSinceLastSync,
          isStale: daysSinceLastSync ? daysSinceLastSync > 7 : false
        },
        timestamp: new Date()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date()
      };
    }
  }

  async cleanupOldData(daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deleted = await prisma.scryfallSync.deleteMany({
      where: {
        lastSync: {
          lt: cutoffDate
        },
        status: {
          in: ['SUCCESS', 'FAILED']
        }
      }
    });

    return {
      deletedRecords: deleted.count
    };
  }

  private async cleanupStuckSyncs() {
    // Nettoie les syncs en status 'RUNNING' depuis plus de 30 minutes
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    await prisma.scryfallSync.updateMany({
      where: {
        status: 'RUNNING',
        lastSync: {
          lt: thirtyMinutesAgo
        }
      },
      data: {
        status: 'FAILED',
        message: 'Synchronisation interrompue - timeout'
      }
    });
  }
}

export const adminService = new AdminService();
