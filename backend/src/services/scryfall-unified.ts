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

export class UnifiedScryfallService {
  private baseUrl = 'https://api.scryfall.com';
  private prisma = prisma;
  private requestDelay = 200; // 200ms pour éviter rate limiting


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
        if (response.status === 429) {
          console.log(`⚠️  Rate limited, waiting 2 seconds...`);
          await this.delay(2000);
          return this.makeRequest(url); // Retry
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
   * Helper pour déterminer si un set devrait avoir une version française
   */
  private shouldCheckFrench(setCode: string, releasedAt: string): boolean {
    // Ne vérifier que les sets récents (post 2020) et certains sets populaires
    const releaseYear = new Date(releasedAt).getFullYear();
    const recentSets = releaseYear >= 2020;
    
    // Sets spécifiques connus pour avoir des versions françaises
    const knownFrenchSets = [
      'khm', 'stx', 'afr', 'mid', 'vow', 'neo', 'snc', 'dmu', 'bro', 'one', 
      'mom', 'woe', 'lci', 'mkm', 'otj', 'blb', 'dsk'
    ];
    
    return recentSets || knownFrenchSets.includes(setCode.toLowerCase());
  }

  /**
   * Synchronize sets from Scryfall API
   */
  async syncSetsUnified(force: boolean = false): Promise<void> {
    try {
      console.log('🚀 Starting UNIFIED sets synchronization...');
      const startTime = Date.now();

      const response = await fetch('https://api.scryfall.com/sets');
      if (!response.ok) {
        throw new Error(`Scryfall API error: ${response.status} - ${response.statusText}`);
      }

      const responseData = await response.json() as { data: any[] };
      const { data: sets } = responseData;
      console.log(`📥 Fetched ${sets.length} sets from Scryfall API`);

      let processedCount = 0;
      let createdCount = 0;
      let updatedCount = 0;
      let frenchFoundCount = 0;

      // Traitement séquentiel pour éviter rate limiting
      for (let i = 0; i < sets.length; i++) {
        const setData = sets[i];
        
        try {
          const existingSet = await this.prisma.set.findUnique({
            where: { code: setData.code.toUpperCase() }
          });

          if (existingSet && !force) {
            processedCount++;
            continue;
          }

          // Essayer de récupérer le nom français (seulement pour certains sets récents)
          let frenchName = null;
          if (this.shouldCheckFrench(setData.code, setData.released_at)) {
            try {
              const frenchSearchUrl = `${this.baseUrl}/cards/search?q=set:${setData.code}+lang:fr&unique=cards`;
              const frenchResponse = await this.makeRequest(frenchSearchUrl);
              
              if (frenchResponse && frenchResponse.data && frenchResponse.data.length > 0) {
                // Extraire le nom français du set depuis la première carte
                frenchName = frenchResponse.data[0].set_name || null;
                if (frenchName && frenchName !== setData.name) {
                  frenchFoundCount++;
                  console.log(`   🇫🇷 Found French name for ${setData.code}: "${frenchName}"`);
                } else {
                  frenchName = null; // Pas vraiment français si identique
                }
              }
            } catch (error) {
              console.log(`   📝 No French cards found for set ${setData.code}`);
            }
          }

          const setDbData = {
            scryfallId: setData.id,
            code: setData.code.toUpperCase(),
            name: setData.name,
            nameFr: frenchName,
            releasedAt: setData.released_at ? new Date(setData.released_at) : null,
            cardCount: setData.card_count || 0,
            type: setData.set_type,
            iconSvgUri: setData.icon_svg_uri || ''
          };

          await this.prisma.set.upsert({
            where: { code: setData.code.toUpperCase() },
            update: setDbData,
            create: setDbData
          });

          processedCount++;
          if (existingSet) {
            updatedCount++;
          } else {
            createdCount++;
          }

        } catch (error) {
          console.error(`❌ Error processing set ${setData.code}:`, error);
        }

        // Progress toutes les 50 sets
        if (i % 50 === 0 || i === sets.length - 1) {
          const percent = Math.round(((i + 1) / sets.length) * 100);
          console.log(`📊 Progress: ${i + 1}/${sets.length} sets (${percent}%) - Created: ${createdCount}, Updated: ${updatedCount}, French: ${frenchFoundCount}`);
        }
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      await this.prisma.scryfallSync.create({
        data: {
          type: 'sets',
          status: 'SUCCESS',
          lastSync: new Date(),
          message: `Processed ${processedCount} sets in ${duration}s (${frenchFoundCount} with French names)`,
          recordsProcessed: processedCount
        }
      });

      console.log(`🎉 UNIFIED sets synchronization completed successfully!`);
      console.log(`📈 Performance stats:`);
      console.log(`   - Total processed: ${processedCount} sets`);
      console.log(`   - Created: ${createdCount} sets`);
      console.log(`   - Updated: ${updatedCount} sets`);
      console.log(`   - With French names: ${frenchFoundCount} sets`);
      console.log(`   - French coverage: ${Math.round((frenchFoundCount / processedCount) * 100)}%`);
      console.log(`   - Duration: ${duration} seconds`);

    } catch (error) {
      console.error('❌ Error during UNIFIED sets synchronization:', error);
      
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
   * Unified cards synchronization - récupère TOUTES les cartes avec traductions directement
   */
  async syncCardsUnified(setCode?: string, force: boolean = false): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Starting UNIFIED cards synchronization${setCode ? ` for set ${setCode}` : ' for ALL cards'}...`);
      console.log(`🌍 Will fetch both English and French versions in one process`);
      
      await this.prisma.scryfallSync.create({
        data: {
          type: 'cards',
          status: 'RUNNING',
          lastSync: new Date(),
          message: `Starting unified sync${setCode ? ` for ${setCode}` : ' for all cards'}`
        }
      });

      // NOUVELLE APPROCHE : Recherche par langue anglaise seulement
      let searchQuery = 'lang:en'; // Seulement cartes anglaises
      if (setCode) {
        searchQuery += ` set:${setCode}`;
      }

      console.log(`🔍 Search query: ${searchQuery} (NO Standard limitation)`);

      const searchUrl = `${this.baseUrl}/cards/search?q=${encodeURIComponent(searchQuery)}&unique=cards&order=set`;
      
      // Étape 1: Récupérer toutes les cartes anglaises
      let allEnglishCards: ScryfallCard[] = [];
      let nextUrl: string | null = searchUrl;
      
      console.log(`📥 Fetching ALL English cards from Scryfall API...`);
      
      while (nextUrl) {
        const response = await this.makeRequest(nextUrl);
        
        if (response && response.data) {
          allEnglishCards = allEnglishCards.concat(response.data);
          nextUrl = response.has_more ? response.next_page : null;
          
          console.log(`   Fetched ${response.data.length} English cards, total so far: ${allEnglishCards.length}`);
        } else {
          break;
        }
      }

      if (allEnglishCards.length === 0) {
        console.log(`⚠️  No English cards found for query: ${searchQuery}`);
        return;
      }

      console.log(`✅ Fetched ${allEnglishCards.length} English cards from API`);
      console.log(`🇫🇷 Now processing cards with French translations...`);

      // Étape 2: Pour chaque carte anglaise, essayer de récupérer la version française
      let processedCount = 0;
      let createdCount = 0;
      let updatedCount = 0;
      let frenchFoundCount = 0;

      for (let i = 0; i < allEnglishCards.length; i++) {
        const englishCard = allEnglishCards[i];
        
        try {
          // Vérifier si la carte existe déjà
          let existingCard = null;
          if (!force) {
            existingCard = await this.prisma.card.findUnique({
              where: { scryfallId: englishCard.id }
            });
          }

          if (existingCard && !force) {
            processedCount++;
            continue;
          }

          // Récupérer le set depuis la DB
          const set = await this.prisma.set.findUnique({
            where: { code: englishCard.set.toUpperCase() }
          });

          if (!set) {
            console.warn(`⚠️  Set ${englishCard.set} not found, skipping card ${englishCard.name}`);
            continue;
          }

          // Essayer de récupérer la version française
          let frenchCard: ScryfallCard | null = null;
          try {
            const frenchUrl = `${this.baseUrl}/cards/${englishCard.set.toLowerCase()}/${englishCard.collector_number}/fr`;
            frenchCard = await this.makeRequest(frenchUrl);
            if (frenchCard) {
              frenchFoundCount++;
            }
          } catch (error) {
            // Version française n'existe pas, continuer avec seulement l'anglaise
          }

          // Préparer les données pour la base de données
          const cardDbData = {
            scryfallId: englishCard.id,
            oracleId: englishCard.oracle_id,
            name: englishCard.name,
            nameFr: frenchCard?.name || null,
            manaCost: englishCard.mana_cost || '',
            cmc: englishCard.cmc || 0,
            typeLine: englishCard.type_line || '',
            typeLineFr: frenchCard?.type_line || null,
            oracleText: englishCard.oracle_text || '',
            oracleTextFr: frenchCard?.oracle_text || null,
            power: englishCard.power || null,
            toughness: englishCard.toughness || null,
            loyalty: englishCard.loyalty || null,
            colors: JSON.stringify(englishCard.colors || []),
            colorIdentity: JSON.stringify(englishCard.color_identity || []),
            rarity: englishCard.rarity || 'common',
            collectorNumber: englishCard.collector_number || '',
            lang: 'en', // Carte de base en anglais
            imageUris: JSON.stringify(englishCard.image_uris || {}),
            prices: JSON.stringify(englishCard.prices || {}),
            priceEur: (() => {
              try {
                const eur = (englishCard.prices as any)?.eur;
                const n = eur !== null && eur !== undefined ? parseFloat(String(eur)) : NaN;
                return Number.isFinite(n) ? n : null;
              } catch { return null; }
            })(),
            priceEurFoil: (() => {
              try {
                const eurf = (englishCard.prices as any)?.eur_foil;
                const n = eurf !== null && eurf !== undefined ? parseFloat(String(eurf)) : NaN;
                return Number.isFinite(n) ? n : null;
              } catch { return null; }
            })(),
            legalities: JSON.stringify(englishCard.legalities || {}),
            setId: set.id,
            updatedAt: new Date()
          };

          // Insérer/mettre à jour la carte
          const prismaAny = this.prisma as any;
          await prismaAny.card.upsert({
            where: { scryfallId: englishCard.id },
            update: cardDbData,
            create: cardDbData
          });

          processedCount++;
          if (existingCard) {
            updatedCount++;
          } else {
            createdCount++;
          }

        } catch (cardError) {
          console.error(`❌ Error processing card ${englishCard.name}:`, cardError);
        }

        // Progress toutes les 100 cartes
        if (i % 100 === 0 || i === allEnglishCards.length - 1) {
          const percent = Math.round(((i + 1) / allEnglishCards.length) * 100);
          console.log(`📊 Progress: ${i + 1}/${allEnglishCards.length} cards (${percent}%) - Created: ${createdCount}, Updated: ${updatedCount}, French: ${frenchFoundCount}`);
        }
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      const cardsPerSecond = Math.round(processedCount / duration);

      await this.prisma.scryfallSync.create({
        data: {
          type: 'cards',
          status: 'SUCCESS',
          lastSync: new Date(),
          message: `UNIFIED: Processed ${processedCount} cards (${frenchFoundCount} with French) in ${duration}s`,
          recordsProcessed: processedCount
        }
      });

      console.log(`🎉 UNIFIED cards synchronization completed successfully!`);
      console.log(`📈 Performance stats:`);
      console.log(`   - Total processed: ${processedCount} cards`);
      console.log(`   - Created: ${createdCount} cards`);
      console.log(`   - Updated: ${updatedCount} cards`);
      console.log(`   - With French translations: ${frenchFoundCount} cards`);
      console.log(`   - Coverage: ${Math.round((frenchFoundCount / processedCount) * 100)}% French coverage`);
      console.log(`   - Duration: ${duration} seconds`);
      console.log(`   - Speed: ${cardsPerSecond} cards/second`);
      console.log(`   - NO Standard limitation applied ✅`);

    } catch (error) {
      console.error('❌ Error during UNIFIED cards synchronization:', error);
      
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
   * Test rapide avec un petit set
   */
  async syncCardsTestUnified(setCode: string = 'dmu'): Promise<void> {
    console.log(`🧪 Testing unified sync with set: ${setCode}`);
    return this.syncCardsUnified(setCode, true);
  }

  /**
   * Synchronisation complète - sets puis cartes
   */
  async fullSyncUnified(setCode?: string, force: boolean = false): Promise<void> {
    console.log('🚀 Starting FULL UNIFIED synchronization...');
    console.log('📋 This will sync ALL cards from Magic history, not just Standard!');
    
    const startTime = Date.now();
    
    try {
      // 1. Synchroniser les sets d'abord
      await this.syncSetsUnified(force);
      
      // 2. Ensuite synchroniser les cartes avec traductions
      await this.syncCardsUnified(setCode, force);
      
      const endTime = Date.now();
      const totalDuration = Math.round((endTime - startTime) / 1000);
      
      console.log(`🎉 FULL UNIFIED synchronization completed in ${totalDuration} seconds!`);
      console.log(`✨ All cards from Magic history are now available with French translations!`);
      
    } catch (error) {
      console.error('❌ Full unified synchronization failed:', error);
      throw error;
    }
  }
}
