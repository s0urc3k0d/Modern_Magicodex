import { prisma } from '../db/prisma';

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

interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  released_at: string;
  set_type: string;
  card_count: number;
  icon_svg_uri?: string;
}

export class OptimizedScryfallService {
  private baseUrl = 'https://api.scryfall.com';
  private prisma = prisma;
  private requestDelay = 100; // 100ms between requests (Scryfall recommends 50-100ms)


  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async makeRequest(url: string): Promise<any> {
    try {
      console.log(`🔄 Requesting: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`⚠️  404 Not Found: ${url}`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      await this.delay(this.requestDelay);
      return data;
    } catch (error) {
      console.error(`❌ API request failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Synchronize sets from Scryfall API
   */
  async syncSetsOptimized(force: boolean = false): Promise<void> {
    try {
      console.log('🚀 Starting OPTIMIZED sets synchronization...');
      const startTime = Date.now();

      // Fetch all sets from Scryfall
      const response = await fetch('https://api.scryfall.com/sets');
      if (!response.ok) {
        throw new Error(`Scryfall API error: ${response.status} - ${response.statusText}`);
      }

      const { data: sets } = await response.json();
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

            const result = await this.prisma.set.upsert({
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
        
        results.forEach(result => {
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

      console.log(`🎉 OPTIMIZED sets synchronization completed successfully!`);
      console.log(`📈 Performance stats:`);
      console.log(`   - Total processed: ${processedCount} sets`);
      console.log(`   - Created: ${createdCount} sets`);
      console.log(`   - Updated: ${updatedCount} sets`);
      console.log(`   - Duration: ${duration} seconds`);

    } catch (error) {
      console.error('❌ Error during OPTIMIZED sets synchronization:', error);
      
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
   * Optimized cards synchronization with parallel processing
   * Assumes sets are already synchronized
   */
  async syncCardsOptimized(setCode?: string, language: string = 'en', force: boolean = false): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Starting OPTIMIZED cards synchronization${setCode ? ` for set ${setCode}` : ' for all Standard cards'}...`);
      console.log(`📍 Language: ${language}, Force update: ${force}`);
      
      // Mark sync as running
      await this.prisma.scryfallSync.create({
        data: {
          type: 'cards',
          status: 'RUNNING',
          lastSync: new Date(),
          message: `Starting optimized sync${setCode ? ` for ${setCode}` : ''}`
        }
      });

      // Build search query with direct language filter
      let searchQuery = 'legal:standard';
      if (setCode) {
        searchQuery += ` set:${setCode}`;
      }
      
      // Add language filter directly to the search query for better efficiency
      if (language === 'fr') {
        searchQuery += ' lang:fr';
      }

      console.log(`🔍 Search query: ${searchQuery}`);

      const searchUrl = `${this.baseUrl}/cards/search?q=${encodeURIComponent(searchQuery)}&unique=cards&order=set`;
      
      // Step 1: Fetch all cards from all pages
      let allCards: ScryfallCard[] = [];
      let nextUrl: string | null = searchUrl;
      
      console.log(`📥 Fetching all cards from Scryfall API...`);
      
      while (nextUrl) {
        const response = await this.makeRequest(nextUrl);
        
        if (response && response.data) {
          allCards = allCards.concat(response.data);
          nextUrl = response.has_more ? response.next_page : null;
          
          console.log(`   Fetched ${response.data.length} cards, total so far: ${allCards.length}`);
        } else {
          break;
        }
      }

      if (allCards.length === 0) {
        console.log(`⚠️  No cards found for query: ${searchQuery}`);
        return;
      }

      console.log(`✅ Fetched ${allCards.length} cards from API`);
      console.log(`⚡ Starting parallel database operations...`);

      // Process cards in parallel batches for maximum efficiency
      const BATCH_SIZE = 100;        // Larger batches for database efficiency
      const CONCURRENCY = 10;        // More parallel operations
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
          // Process all cards in the chunk in parallel
          const promises = chunk.map(async (cardData) => {
            try {
              // Check if card already exists (only if not forcing update)
              let existingCard = null;
              if (!force) {
                existingCard = await this.prisma.card.findUnique({
                  where: { scryfallId: cardData.id }
                });
              }

              if (existingCard && !force) {
                return { action: 'skipped' };
              }

              // Get the set (it should exist now)
              const set = await this.prisma.set.findUnique({
                where: { code: cardData.set.toUpperCase() }
              });

              if (!set) {
                console.warn(`⚠️  Set ${cardData.set} still not found, skipping card ${cardData.name}`);
                return { action: 'skipped' };
              }

              // Prepare card data for database
              const cardDbData = {
                scryfallId: cardData.id,
                oracleId: cardData.oracle_id,
                name: cardData.name,
                nameFr: language === 'fr' ? cardData.name : null,
                manaCost: cardData.mana_cost || '',
                cmc: cardData.cmc || 0,
                typeLine: cardData.type_line || '',
                typeLineFr: language === 'fr' ? cardData.type_line : null,
                oracleText: cardData.oracle_text || '',
                oracleTextFr: language === 'fr' ? cardData.oracle_text : null,
                power: cardData.power || null,
                toughness: cardData.toughness || null,
                loyalty: cardData.loyalty || null,
                colors: JSON.stringify(cardData.colors || []),
                colorIdentity: JSON.stringify(cardData.color_identity || []),
                rarity: cardData.rarity || 'common',
                collectorNumber: cardData.collector_number || '',
                lang: cardData.lang || language,
                imageUris: JSON.stringify(cardData.image_uris || {}),
                prices: JSON.stringify(cardData.prices || {}),
                legalities: JSON.stringify(cardData.legalities || {}),
                setId: set.id,
                updatedAt: new Date()
              };

              // Upsert the card
              const result = await this.prisma.card.upsert({
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

          // Wait for all parallel operations in this chunk to complete
          const results = await Promise.all(promises);
          
          // Count results
          results.forEach(result => {
            if (result) {
              processedCount++;
              if (result.action === 'created') createdCount++;
              if (result.action === 'updated') updatedCount++;
            }
          });

          // Small delay between chunks to be nice to the database
          await this.delay(50);
        }

        const progress = Math.min(i + BATCH_SIZE, allCards.length);
        const percent = Math.round((progress / allCards.length) * 100);
        console.log(`📊 Progress: ${progress}/${allCards.length} cards (${percent}%) - Created: ${createdCount}, Updated: ${updatedCount}`);
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      const cardsPerSecond = Math.round(processedCount / duration);

      // Mark sync as successful
      await this.prisma.scryfallSync.create({
        data: {
          type: 'cards',
          status: 'SUCCESS',
          lastSync: new Date(),
          message: `Processed ${processedCount} cards in ${duration}s (${cardsPerSecond} cards/sec)`,
          recordsProcessed: processedCount
        }
      });

      console.log(`🎉 OPTIMIZED cards synchronization completed successfully!`);
      console.log(`📈 Performance stats:`);
      console.log(`   - Total processed: ${processedCount} cards`);
      console.log(`   - Created: ${createdCount} cards`);
      console.log(`   - Updated: ${updatedCount} cards`);
      console.log(`   - Duration: ${duration} seconds`);
      console.log(`   - Speed: ${cardsPerSecond} cards/second`);
      console.log(`   - Language: ${language}`);

    } catch (error) {
      console.error('❌ Error during OPTIMIZED cards synchronization:', error);
      
      // Mark sync as failed
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
   * Quick test with a small set to verify the optimization works
   */
  async syncCardsTestOptimized(setCode: string = 'dmu'): Promise<void> {
    console.log(`🧪 Testing optimized sync with set: ${setCode}`);
    return this.syncCardsOptimized(setCode, 'fr', true);
  }

  /**
   * Update English cards with French translations in batches
   * Optimized version with parallel processing
   */
  async updateFrenchTranslationsOptimized(setCode?: string): Promise<void> {
    try {
      console.log('🇫🇷 Starting optimized French translations update...');
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

      const BATCH_SIZE = 50;
      const CONCURRENCY = 5; // Lower concurrency for French API calls

      for (let i = 0; i < englishCards.length; i += BATCH_SIZE) {
        const batch = englishCards.slice(i, i + BATCH_SIZE);
        
        // Process in smaller concurrent chunks to respect rate limits
        const chunks = [];
        for (let j = 0; j < batch.length; j += CONCURRENCY) {
          chunks.push(batch.slice(j, j + CONCURRENCY));
        }
        
        for (const chunk of chunks) {
          const promises = chunk.map(async (card) => {
            try {
              // Search for French version of the card
              const searchQuery = `!"${card.name}" set:${card.set.code.toLowerCase()} lang:fr`;
              const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&unique=cards`);
              
              await this.delay(100); // Rate limiting
              
              if (response.ok) {
                const data = await response.json() as any;
                if (data.data && data.data.length > 0) {
                  const frenchCard = data.data[0];
                  
                  // Update the English card with French translations
                  await this.prisma.card.update({
                    where: { id: card.id },
                    data: {
                      nameFr: frenchCard.name || card.nameFr,
                      oracleTextFr: frenchCard.oracle_text || card.oracleTextFr
                    }
                  });
                  
                  return { action: 'updated' };
                }
              }
              
              return { action: 'not_found' };
              
            } catch (error) {
              console.error(`❌ Error updating French translation for ${card.name}:`, error);
              return { action: 'error' };
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

          // Delay between chunks
          await this.delay(200);
        }

        const progress = Math.min(i + BATCH_SIZE, englishCards.length);
        const percent = Math.round((progress / englishCards.length) * 100);
        console.log(`📊 Progress: ${progress}/${englishCards.length} cards (${percent}%) - Updated: ${updatedCount}, Not found: ${notFoundCount}`);
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      await this.prisma.scryfallSync.create({
        data: {
          type: 'french-update',
          status: 'SUCCESS',
          lastSync: new Date(),
          message: `Updated ${updatedCount} cards with French translations in ${duration}s`,
          recordsProcessed: processedCount
        }
      });

      console.log(`🎉 OPTIMIZED French translations update completed successfully!`);
      console.log(`📈 Performance stats:`);
      console.log(`   - Total processed: ${processedCount} cards`);
      console.log(`   - Updated: ${updatedCount} cards`);
      console.log(`   - Not found: ${notFoundCount} cards`);
      console.log(`   - Duration: ${duration} seconds`);

    } catch (error) {
      console.error('❌ Error during OPTIMIZED French translations update:', error);
      
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
    }
  }
}
