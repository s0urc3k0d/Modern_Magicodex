import { prisma } from '../db/prisma';
import { computeIsExtra } from '../utils/extras';

interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors?: string[];
  color_identity?: string[];
  rarity: string;
  collector_number: string;
  set: string;
  set_name: string;
  lang: string;
  image_uris?: any;
  prices?: any;
  legalities?: any;
  keywords?: string[];
  artist?: string;
  flavor_text?: string;
}

export class CleanScryfallService {
  private baseUrl = 'https://api.scryfall.com';
  private prisma = prisma;
  private requestDelay = 100; // 100ms between requests


  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 1. SYNCHRONISATION DES SETS
   * Synchronise tous les sets depuis l'API Scryfall
   */
  async syncSets(force: boolean = false): Promise<void> {
    try {
      console.log('🚀 Starting sets synchronization...');
      const startTime = Date.now();

      const response = await fetch('https://api.scryfall.com/sets');
      if (!response.ok) {
        throw new Error(`Scryfall API error: ${response.status} - ${response.statusText}`);
      }

      const { data: sets } = await response.json() as any;
      console.log(`📥 Fetched ${sets.length} sets from Scryfall API`);

      let processedCount = 0;
      let createdCount = 0;
      let updatedCount = 0;

      // Process sets in batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < sets.length; i += BATCH_SIZE) {
        const batch = sets.slice(i, i + BATCH_SIZE);
        
        const promises = batch.map(async (setData: any) => {
          try {
            const existingSet = await this.prisma.set.findUnique({
              where: { code: setData.code.toUpperCase() }
            });

            const setDbData = {
              scryfallId: setData.id,
              code: setData.code.toUpperCase(),
              name: setData.name,
              releasedAt: setData.released_at ? new Date(setData.released_at) : null,
              cardCount: setData.card_count || 0,
              type: setData.set_type,
              iconSvgUri: setData.icon_svg_uri || ''
            };

            if (existingSet && !force) {
              return { action: 'skipped' };
            }

            await this.prisma.set.upsert({
              where: { code: setData.code.toUpperCase() },
              update: setDbData,
              create: setDbData
            });

            return { action: existingSet ? 'updated' : 'created' };

          } catch (error) {
            console.error(`❌ Error processing set ${setData.code}:`, error);
            return { action: 'error' };
          }
        });

        const results = await Promise.all(promises);
        
        results.forEach((result: any) => {
          if (result) {
            processedCount++;
            if (result.action === 'created') createdCount++;
            if (result.action === 'updated') updatedCount++;
          }
        });

        const progress = Math.min(i + BATCH_SIZE, sets.length);
        const percent = Math.round((progress / sets.length) * 100);
        console.log(`📊 Progress: ${progress}/${sets.length} sets (${percent}%) - Created: ${createdCount}, Updated: ${updatedCount}`);
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      await this.prisma.scryfallSync.create({
        data: {
          type: 'sets',
          status: 'SUCCESS',
          lastSync: new Date(),
          message: `Processed ${processedCount} sets in ${duration}s`,
          recordsProcessed: processedCount
        }
      });

      console.log(`🎉 Sets synchronization completed successfully!`);
      console.log(`📈 Performance stats:`);
      console.log(`   - Total processed: ${processedCount} sets`);
      console.log(`   - Created: ${createdCount} sets`);
      console.log(`   - Updated: ${updatedCount} sets`);
      console.log(`   - Duration: ${duration} seconds`);

    } catch (error) {
      console.error('❌ Error during sets synchronization:', error);
      
      await this.prisma.scryfallSync.create({
        data: {
          type: 'sets',
          status: 'FAILED',
          lastSync: new Date(),
          message: error instanceof Error ? error.message : 'Unknown error',
          recordsProcessed: 0
        }
      });
      
      throw error;
    }
  }

  /**
   * MISE À JOUR DES NOMS FRANÇAIS DES SETS
   * Recherche les noms français des extensions via l'API Scryfall
   */
  async updateFrenchSetNames(): Promise<void> {
    try {
      console.log('🚀 Starting French set names update...');
      const startTime = Date.now();

      // Base de données de traductions manuelles pour les extensions principales
      const frenchSetNames: Record<string, string> = {
        // Extensions récentes
        'LTR': 'Le Seigneur des Anneaux : Chroniques de la Terre du Milieu',
        'WOE': 'Terres Sauvages d\'Eldraine',
        'LCI': 'Les Cavernes Oubliées d\'Ixalan',
        'MOM': 'L\'Invasion des Machines',
        'ONE': 'Phyrexia : Tous Seront Un',
        'BRO': 'La Guerre Fratricide',
        'DMU': 'Dominaria Uni',
        'SNC': 'Avenues de Nouvelle-Capenna',
        'NEO': 'Kamigawa : La Dynastie Néon',
        'VOW': 'Innistrad : Serment Écarlate',
        'MID': 'Innistrad : Chasse de Minuit',
        'AFR': 'Aventures dans les Royaumes Oubliés',
        'STX': 'Strixhaven : École des Mages',
        'KHM': 'Kaldheim',
        
        // Extensions classiques
        'WAR': 'La Guerre des Planeswalkers',
        'RNA': 'L\'Allégeance de Ravnica',
        'GRN': 'Les Guildes de Ravnica',
        'DOM': 'Dominaria',
        'RIX': 'Les Rivaux d\'Ixalan',
        'XLN': 'Ixalan',
        'HOU': 'L\'Âge de la Destruction',
        'AKH': 'Amonkhet',
        'AER': 'La Révolte Éthérique',
        'KLD': 'Kaladesh',
        'EMN': 'La Lune Hermétique',
        'SOI': 'Ténèbres sur Innistrad',
        'OGW': 'Le Serment des Sentinelles',
        'BFZ': 'La Bataille de Zendikar',
        'ORI': 'Origines de Magic',
        'DTK': 'Les Dragons de Tarkir',
        'FRF': 'Destin Reforgé',
        'KTK': 'Les Khans de Tarkir',
        'M15': 'Magic 2015',
        'JOU': 'Incursion dans Nyx',
        'BNG': 'Né des Dieux',
        'THS': 'Theros',
        'M14': 'Magic 2014',
        'DGM': 'Le Labyrinthe du Dragon',
        'GTC': 'Insurrection',
        'RTR': 'Retour sur Ravnica',
        'M13': 'Magic 2013',
        'AVR': 'Retour d\'Avacyn',
        'DKA': 'Ténèbres sur Innistrad',
        'ISD': 'Innistrad',
        'M12': 'Magic 2012',
        'NPH': 'La Nouvelle Phyrexia',
        'MBS': 'Assiégés Mirrodins',
        'SOM': 'Cicatrices de Mirrodin',
        'M11': 'Magic 2011',
        'ROE': 'L\'Éveil du Monde',
        'WWK': 'Worldwake',
        'ZEN': 'Zendikar',
        'M10': 'Magic 2010'
      };

      // Récupérer tous les sets qui n'ont pas de nom français
      const sets = await this.prisma.set.findMany({
        where: {
          nameFr: null
        },
        orderBy: { releasedAt: 'desc' }
      });

      console.log(`📥 Found ${sets.length} sets without French names`);

      let processedCount = 0;
      let updatedCount = 0;
      let notFoundCount = 0;

      for (const set of sets) {
        try {
          console.log(`🔍 Processing set "${set.name}" (${set.code})`);
          
          let frenchName: string | null = null;

          // 1. Vérifier d'abord dans notre base de données manuelle
          if (frenchSetNames[set.code.toUpperCase()]) {
            frenchName = frenchSetNames[set.code.toUpperCase()];
            console.log(`📚 Found manual translation: "${frenchName}"`);
          } else {
            // 2. Essayer de trouver via l'API Scryfall (méthode existante améliorée)
            const searchQuery = `set:${set.code.toLowerCase()} lang:fr`;
            const searchUrl = `${this.baseUrl}/cards/search?q=${encodeURIComponent(searchQuery)}&unique=cards&page=1`;
            
            const response = await fetch(searchUrl);
            await this.delay(this.requestDelay);

            if (response.ok) {
              const data = await response.json() as any;
              
              if (data.data && data.data.length > 0) {
                const frenchCard = data.data[0];
                const frenchSetName = frenchCard.set_name;
                
                if (frenchSetName && frenchSetName !== set.name) {
                  frenchName = frenchSetName;
                  console.log(`🔍 Found via API: "${frenchName}"`);
                }
              }
            }
          }

          // 3. Mettre à jour si on a trouvé une traduction
          if (frenchName) {
            await this.prisma.set.update({
              where: { id: set.id },
              data: { nameFr: frenchName }
            });
            
            console.log(`✅ Updated set ${set.code}: "${set.name}" → "${frenchName}"`);
            updatedCount++;
          } else {
            console.log(`ℹ️  No French translation found for set ${set.code}`);
            notFoundCount++;
          }

          processedCount++;

          // Progress reporting
          if (processedCount % 20 === 0) {
            const progress = Math.round((processedCount / sets.length) * 100);
            console.log(`📊 Progress: ${processedCount}/${sets.length} sets (${progress}%) - Updated: ${updatedCount}, Not found: ${notFoundCount}`);
          }

        } catch (error) {
          console.error(`❌ Error processing set ${set.code}:`, error);
          processedCount++;
        }
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      await this.prisma.scryfallSync.create({
        data: {
          type: 'sets-french',
          status: 'SUCCESS',
          lastSync: new Date(),
          message: `Updated ${updatedCount} French set names in ${duration}s`,
          recordsProcessed: processedCount
        }
      });

      console.log(`🎉 French set names update completed successfully!`);
      console.log(`📈 Performance stats:`);
      console.log(`   - Total processed: ${processedCount} sets`);
      console.log(`   - Updated: ${updatedCount} sets`);
      console.log(`   - Not found: ${notFoundCount} sets`);
      console.log(`   - Duration: ${duration} seconds`);
      console.log(`   - Speed: ${Math.round(processedCount / duration)} sets/second`);

    } catch (error) {
      console.error('❌ Error during French set names update:', error);
      
      await this.prisma.scryfallSync.create({
        data: {
          type: 'sets-french',
          status: 'FAILED',
          lastSync: new Date(),
          message: error instanceof Error ? error.message : 'Unknown error',
          recordsProcessed: 0
        }
      });
      
      throw error;
    }
  }

  /**
   * 2. SYNCHRONISATION DES CARTES
   * Synchronise les cartes depuis l'API Scryfall (nécessite que les sets soient déjà synchronisés)
   */
  async syncCards(setCode?: string, language: string = 'en', force: boolean = false): Promise<void> {
    try {
      console.log(`🚀 Starting cards synchronization...`);
      console.log(`📍 Set: ${setCode || 'all'}, Language: ${language}, Force update: ${force}`);
      
      const startTime = Date.now();
      
      // Build search query
      let searchQuery = '';
      if (setCode) {
        searchQuery = `set:${setCode.toLowerCase()}`;
      } else {
        // Synchroniser toutes les cartes, pas seulement celles légales en Standard
        searchQuery = '*';
      }
      if (language !== 'en') {
        searchQuery += ` lang:${language}`;
      }
      
      console.log(`🔍 Search query: ${searchQuery}`);
      
      // Fetch all cards from API
      let allCards: ScryfallCard[] = [];
      let nextUrl: string | null = `${this.baseUrl}/cards/search?q=${encodeURIComponent(searchQuery)}&unique=cards&order=set`;
      
      while (nextUrl) {
        console.log(`🔄 Requesting: ${nextUrl}`);
        const response = await fetch(nextUrl);
        
        if (response.ok) {
          const responseData = await response.json() as any;
          allCards = allCards.concat(responseData.data);
          nextUrl = responseData.has_more ? responseData.next_page : null;
          
          console.log(`   Fetched ${responseData.data.length} cards, total so far: ${allCards.length}`);
          await this.delay(this.requestDelay);
        } else if (response.status === 404) {
          console.log(`⚠️  No cards found for query: ${searchQuery}`);
          break;
        } else {
          throw new Error(`Scryfall API error: ${response.status} - ${response.statusText}`);
        }
      }

      if (allCards.length === 0) {
        console.log(`⚠️  No cards found for query: ${searchQuery}`);
        return;
      }

      console.log(`✅ Fetched ${allCards.length} cards from API`);
      console.log(`⚡ Starting parallel database operations...`);

      // Process cards in parallel batches
      const BATCH_SIZE = 100;
      const CONCURRENCY = 10;
      let processedCount = 0;
      let updatedCount = 0;
      let createdCount = 0;

      for (let i = 0; i < allCards.length; i += BATCH_SIZE) {
        const batch = allCards.slice(i, i + BATCH_SIZE);
        
        // Process each batch in parallel chunks
        const chunks = [];
        for (let j = 0; j < batch.length; j += CONCURRENCY) {
          chunks.push(batch.slice(j, j + CONCURRENCY));
        }
        
        for (const chunk of chunks) {
          const promises = chunk.map(async (cardData) => {
            try {
              // Check if card already exists
              let existingCard = null;
              if (!force) {
                existingCard = await this.prisma.card.findUnique({
                  where: { scryfallId: cardData.id }
                });
              }

              if (existingCard && !force) {
                return { action: 'skipped' };
              }

              // Get the set (must exist)
              const set = await this.prisma.set.findUnique({
                where: { code: cardData.set.toUpperCase() }
              });

              if (!set) {
                console.warn(`⚠️  Set ${cardData.set} not found, skipping card ${cardData.name}`);
                return { action: 'skipped' };
              }

              // Prepare card data
              const cardDbData = {
                scryfallId: cardData.id,
                oracleId: cardData.oracle_id,
                name: cardData.name,
                manaCost: cardData.mana_cost || null,
                cmc: cardData.cmc,
                typeLine: cardData.type_line,
                oracleText: cardData.oracle_text || null,
                power: cardData.power || null,
                toughness: cardData.toughness || null,
                loyalty: cardData.loyalty || null,
                colors: JSON.stringify(cardData.colors || []),
                colorIdentity: JSON.stringify(cardData.color_identity || []),
                rarity: cardData.rarity,
                collectorNumber: cardData.collector_number,
                lang: cardData.lang,
                imageUris: JSON.stringify(cardData.image_uris || {}),
                prices: JSON.stringify(cardData.prices || {}),
                legalities: JSON.stringify(cardData.legalities || {}),
                // Extras fields
                booster: (cardData as any).booster,
                promo: (cardData as any).promo,
                variation: (cardData as any).variation,
                fullArt: (cardData as any).full_art,
                frameEffects: JSON.stringify((cardData as any).frame_effects || []),
                promoTypes: JSON.stringify((cardData as any).promo_types || []),
                borderColor: (cardData as any).border_color || null,
                isExtra: computeIsExtra(cardData as any),
                setId: set.id,
                updatedAt: new Date()
              };

              // Upsert the card
              await this.prisma.card.upsert({
                where: { scryfallId: cardData.id },
                update: cardDbData,
                create: cardDbData
              });

              return { action: existingCard ? 'updated' : 'created' };

            } catch (cardError) {
              console.error(`❌ Error processing card ${cardData.name}:`, cardError);
              return { action: 'error' };
            }
          });

          const results = await Promise.all(promises);
          
          results.forEach(result => {
            if (result) {
              processedCount++;
              if (result.action === 'created') createdCount++;
              if (result.action === 'updated') updatedCount++;
            }
          });

          await this.delay(50);
        }

        const progress = Math.min(i + BATCH_SIZE, allCards.length);
        const percent = Math.round((progress / allCards.length) * 100);
        console.log(`📊 Progress: ${progress}/${allCards.length} cards (${percent}%) - Created: ${createdCount}, Updated: ${updatedCount}`);
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      const cardsPerSecond = Math.round(processedCount / duration);

      await this.prisma.scryfallSync.create({
        data: {
          type: 'cards',
          status: 'SUCCESS',
          lastSync: new Date(),
          message: `Processed ${processedCount} cards in ${duration}s (${cardsPerSecond} cards/sec)`,
          recordsProcessed: processedCount
        }
      });

      console.log(`🎉 Cards synchronization completed successfully!`);
      console.log(`📈 Performance stats:`);
      console.log(`   - Total processed: ${processedCount} cards`);
      console.log(`   - Created: ${createdCount} cards`);
      console.log(`   - Updated: ${updatedCount} cards`);
      console.log(`   - Duration: ${duration} seconds`);
      console.log(`   - Speed: ${cardsPerSecond} cards/second`);

    } catch (error) {
      console.error('❌ Error during cards synchronization:', error);
      
      await this.prisma.scryfallSync.create({
        data: {
          type: 'cards',
          status: 'FAILED',
          lastSync: new Date(),
          message: error instanceof Error ? error.message : 'Unknown error',
          recordsProcessed: 0
        }
      });
      
      throw error;
    }
  }

  /**
   * 3. MISE À JOUR DES TRADUCTIONS FRANÇAISES (VERSION OPTIMISÉE)
   * Met à jour les cartes anglaises avec leurs traductions françaises
   */
  async updateFrenchTranslations(setCode?: string): Promise<void> {
    // 🔒 Système de verrou pour éviter les exécutions multiples
    const lockKey = `french-translations-${setCode || 'all'}`;
    const existingLock = await this.prisma.scryfallSync.findFirst({
      where: {
        type: 'french-update-lock',
        message: lockKey,
        status: 'RUNNING'
      }
    });

    if (existingLock) {
      console.log('⚠️  French translations update already running, skipping...');
      return;
    }

    // Créer le verrou
    const lock = await this.prisma.scryfallSync.create({
      data: {
        type: 'french-update-lock',
        status: 'RUNNING',
        lastSync: new Date(),
        message: lockKey,
        recordsProcessed: 0
      }
    });

    try {
      console.log(`🚀 Starting French translations update: setCode=${setCode}`);
      console.log('🇫🇷 Starting French translations update...');
      const startTime = Date.now();
      
      // Get English cards without French translations
      const whereClause: any = {
        lang: 'en',
        OR: [
          { nameFr: null },
          { nameFr: '' },
          { oracleTextFr: null },
          { oracleTextFr: '' }
        ]
      };

      if (setCode) {
        const set = await this.prisma.set.findUnique({
          where: { code: setCode.toUpperCase() }
        });
        if (!set) {
          throw new Error(`Set ${setCode} not found`);
        }
        whereClause.setId = set.id;
      }

      const englishCards = await this.prisma.card.findMany({
        where: whereClause,
        select: { 
          id: true, 
          scryfallId: true, 
          name: true,
          nameFr: true,
          oracleTextFr: true,
          set: { select: { code: true } }
        }
      });

      if (englishCards.length === 0) {
        console.log('ℹ️  No English cards found needing French translations');
        return;
      }

      console.log(`📥 Found ${englishCards.length} cards needing French translations`);

      let processedCount = 0;
      let updatedCount = 0;
      let notFoundCount = 0;

      // � CONFIGURATION ajustée pour éviter les erreurs 429
      const BATCH_SIZE = 25; // Réduction des batches
      const CONCURRENCY = 3; // Réduction de la concurrence

      for (let i = 0; i < englishCards.length; i += BATCH_SIZE) {
        const batch = englishCards.slice(i, i + BATCH_SIZE);
        
        const chunks = [];
        for (let j = 0; j < batch.length; j += CONCURRENCY) {
          chunks.push(batch.slice(j, j + CONCURRENCY));
        }
        
        for (const chunk of chunks) {
          const promises = chunk.map(async (card: any) => {
            try {
              // Ajouter un délai progressif pour éviter le rate limiting
              await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100)); // 100-400ms
              
              // � NOUVELLE APPROCHE : Rechercher la version française par nom
              // L'endpoint /fr ne semble pas fonctionner, utilisons la recherche
              const searchQuery = encodeURIComponent(`!"${card.name}" lang:fr`);
              const response = await fetch(`${this.baseUrl}/cards/search?q=${searchQuery}`, {
                headers: { 'User-Agent': 'Modern Magicodex/1.0' }
              });
              
              console.log(`🔍 Searching French for "${card.name}": Status ${response.status}`);
              
              if (response.ok) {
                const searchResult = await response.json() as any;
                
                if (searchResult.data && searchResult.data.length > 0) {
                  const frenchCard = searchResult.data[0];
                  console.log(`📝 French data for ${card.name}:`, {
                    printed_name: frenchCard.printed_name,
                    printed_type_line: frenchCard.printed_type_line,
                    printed_text: frenchCard.printed_text ? frenchCard.printed_text.substring(0, 50) + '...' : null
                  });
                  
                  await this.prisma.card.update({
                    where: { id: card.id },
                    data: {
                      nameFr: frenchCard.printed_name || null,
                      typeLineFr: frenchCard.printed_type_line || null,
                      oracleTextFr: frenchCard.printed_text || null
                    }
                  });
                  
                  return { action: 'updated' };
                } else {
                  console.log(`❌ No French version found for ${card.name}`);
                  return { action: 'not_found' };
                }
              } else if (response.status === 404) {
                // Version française non trouvée
                return { action: 'not_found' };
              } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
            } catch (cardError) {
              console.error(`❌ Error getting French version for ${card.name}:`, cardError);
              return { action: 'not_found' };
            }
          });

          const results = await Promise.all(promises);
          
          results.forEach(result => {
            if (result) {
              processedCount++;
              if (result.action === 'updated') updatedCount++;
              if (result.action === 'not_found') notFoundCount++;
            }
          });

          await this.delay(200); // Délai augmenté entre les chunks pour éviter les 429
        }

        const progress = Math.min(i + BATCH_SIZE, englishCards.length);
        const percent = Math.round((progress / englishCards.length) * 100);
        console.log(`📊 Progress: ${progress}/${englishCards.length} cards (${percent}%) - Updated: ${updatedCount}, Not found: ${notFoundCount}`);
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      const cardsPerSecond = processedCount > 0 ? Math.round(processedCount / duration) : 0;

      await this.prisma.scryfallSync.create({
        data: {
          type: 'french-update',
          status: 'SUCCESS',
          lastSync: new Date(),
          message: `Updated ${updatedCount} cards with French translations in ${duration}s (${cardsPerSecond} cards/sec)`,
          recordsProcessed: processedCount
        }
      });

      console.log(`🎉 French translations update completed successfully!`);
      console.log(`📈 Performance stats:`);
      console.log(`   - Total processed: ${processedCount} cards`);
      console.log(`   - Updated: ${updatedCount} cards`);
      console.log(`   - Not found: ${notFoundCount} cards`);
      console.log(`   - Duration: ${duration} seconds`);
      console.log(`   - Speed: ${cardsPerSecond} cards/second`);

    } catch (error) {
      console.error('❌ Error during French translations update:', error);
      
      await this.prisma.scryfallSync.create({
        data: {
          type: 'french-update',
          status: 'FAILED',
          lastSync: new Date(),
          message: error instanceof Error ? error.message : 'Unknown error',
          recordsProcessed: 0
        }
      });
      
      throw error;
    } finally {
      // 🔓 Libérer le verrou
      await this.prisma.scryfallSync.update({
        where: { id: lock.id },
        data: { 
          status: 'COMPLETED'
        }
      });
    }
  }

  /**
   * TEST METHODS
   */
  async testSyncSets(): Promise<void> {
    console.log(`🧪 Testing sets synchronization...`);
    return this.syncSets(true);
  }

  async testSyncCards(setCode: string = 'dmu'): Promise<void> {
    console.log(`🧪 Testing cards synchronization with set: ${setCode}`);
    return this.syncCards(setCode, 'en', true);
  }

  async testUpdateFrench(setCode: string = 'dmu'): Promise<void> {
    console.log(`🧪 Testing French translations update with set: ${setCode}`);
    return this.updateFrenchTranslations(setCode);
  }
}
