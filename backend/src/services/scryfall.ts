import axios from 'axios';
import { prisma } from '../db/prisma';

export interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  set_type: string;
  released_at: string;
  card_count: number;
  icon_svg_uri?: string;
  search_uri?: string;
}

export interface ScryfallCard {
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
  colors: string[];
  color_identity: string[];
  rarity: string;
  set: string;
  collector_number: string;
  lang: string;
  image_uris?: any;
  prices?: any;
  legalities?: any;
  // Flags used to determine extras
  booster?: boolean;
  promo?: boolean;
  variation?: boolean;
  full_art?: boolean;
  frame_effects?: string[];
  promo_types?: string[];
  border_color?: string;
}

export class ScryfallService {
  private readonly baseUrl = 'https://api.scryfall.com';
  private readonly delayMs = 100; // Respect Scryfall's rate limit

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async makeRequest(url: string): Promise<any> {
    try {
      await this.delay(this.delayMs);
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Scryfall API error: ${error.response?.status} - ${error.response?.statusText}`);
        if (error.response?.status === 429) {
          // Rate limited, wait longer
          await this.delay(1000);
          return this.makeRequest(url);
        }
      }
      throw error;
    }
  }

  async syncSets(): Promise<void> {
    try {
      console.log('Starting sets synchronization...');
      
      await prisma.scryfallSync.create({
        data: {
          type: 'sets',
          lastSync: new Date(),
          status: 'RUNNING',
          message: 'Starting sets sync'
        }
      });

      const setsData = await this.makeRequest(`${this.baseUrl}/sets`);
      const sets: ScryfallSet[] = setsData.data;

      let processedCount = 0;

      for (const setData of sets) {
        // Skip digital-only sets and funny sets for now
        if (['alchemy', 'funny', 'memorabilia'].includes(setData.set_type)) {
          continue;
        }

        try {
          await prisma.set.upsert({
            where: { scryfallId: setData.id },
            update: {
              code: setData.code,
              name: setData.name,
              type: setData.set_type,
              releasedAt: setData.released_at ? new Date(setData.released_at) : null,
              cardCount: setData.card_count,
              iconSvgUri: setData.icon_svg_uri,
              searchUri: setData.search_uri,
              updatedAt: new Date()
            },
            create: {
              scryfallId: setData.id,
              code: setData.code,
              name: setData.name,
              type: setData.set_type,
              releasedAt: setData.released_at ? new Date(setData.released_at) : null,
              cardCount: setData.card_count,
              iconSvgUri: setData.icon_svg_uri,
              searchUri: setData.search_uri
            }
          });

          processedCount++;
        } catch (error) {
          console.error(`Error processing set ${setData.code}:`, error);
        }
      }

      await prisma.scryfallSync.create({
        data: {
          type: 'sets',
          lastSync: new Date(),
          status: 'SUCCESS',
          message: `Successfully synced ${processedCount} sets`,
          recordsProcessed: processedCount
        }
      });

      console.log(`Sets sync completed. Processed ${processedCount} sets.`);
    } catch (error) {
      await prisma.scryfallSync.create({
        data: {
          type: 'sets',
          lastSync: new Date(),
          status: 'FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recordsProcessed: 0
        }
      });
      console.error('Sets sync failed:', error);
      throw error;
    }
  }

  async syncCards(setCode?: string): Promise<void> {
    try {
      console.log(`Starting cards synchronization${setCode ? ` for set ${setCode}` : ''}...`);
      
      // Validation du setCode si fourni
      if (setCode && (setCode.length < 2 || setCode.length > 10)) {
        throw new Error(`Code de set invalide: ${setCode}`);
      }
      
      // Ne pas accepter des codes qui sont des codes de langue
      if (setCode && ['fr', 'en', 'de', 'es', 'it', 'pt', 'ja', 'ko', 'ru', 'zhs', 'zht'].includes(setCode.toLowerCase())) {
        throw new Error(`Code de set invalide (code de langue): ${setCode}`);
      }
      
      await prisma.scryfallSync.create({
        data: {
          type: 'cards',
          lastSync: new Date(),
          status: 'RUNNING',
          message: `Starting cards sync${setCode ? ` for ${setCode}` : ''}`
        }
      });

      let searchUrl = `${this.baseUrl}/cards/search?q=`;
      if (setCode) {
        // Fetch ALL printings for the set, including showcase/EXTRAS and variations
        searchUrl += `set:${setCode}`;
      } else {
        // Sync only standard-legal cards as a baseline
        searchUrl += `format:standard`;
      }
      // Ensure we fetch each printing and include extras/variations
      const extraParams = `&unique=prints&include_extras=true&include_variations=true`;
      searchUrl += extraParams;

      let processedCount = 0;
      let hasMore = true;
      let nextPageUrl = searchUrl;

      while (hasMore) {
  const cardsData = await this.makeRequest(nextPageUrl);
        const cards: ScryfallCard[] = cardsData.data;

        for (const cardData of cards) {
          try {
            // Find the set in our database
            const set = await prisma.set.findUnique({
              where: { code: cardData.set }
            });

            if (!set) {
              console.warn(`Set ${cardData.set} not found in database, skipping card ${cardData.name}`);
              continue;
            }

            // Check if we need French translation
            let nameFr = null;
            let typeLineFr = null;
            let oracleTextFr = null;

            if (cardData.lang === 'en') {
              // Try to get French version
              try {
                const frenchUrl = `${this.baseUrl}/cards/${cardData.set}/${cardData.collector_number}?lang=fr`;
                console.log(`Trying to fetch French version from: ${frenchUrl}`);
                const frenchCard = await this.makeRequest(frenchUrl);
                nameFr = frenchCard.name;
                typeLineFr = frenchCard.type_line;
                oracleTextFr = frenchCard.oracle_text;
              } catch (error) {
                console.log(`French version not found for ${cardData.name} (${cardData.set}/${cardData.collector_number})`);
                // French version doesn't exist, that's okay
              }
            }

      // Compute isExtra from Scryfall flags
      const frameEffects = (cardData.frame_effects || []) as any;
      const promoTypes = (cardData.promo_types || []) as any;
      // Special frame effects that indicate extras (showcase, borderless treatments, etc.)
      const extraFrameEffects = ['extendedart', 'showcase', 'borderless', 'etched', 'inverted', 'shatteredglass', 'textless', 'fandfc'];
      const hasSpecialFrame = Array.isArray(frameEffects) && frameEffects.some((f: string) => extraFrameEffects.includes(f));
      const hasPromo = cardData.promo === true || (Array.isArray(promoTypes) && promoTypes.length > 0);
      const isNonBooster = cardData.booster === false;
      const isVariation = cardData.variation === true;
      // Note: full_art alone is NOT an indicator of extras - many normal cards are full-art
      const isExtra = Boolean(hasPromo || isVariation || hasSpecialFrame || isNonBooster);

  const prismaAny = prisma as any;
  await prismaAny.card.upsert({
              where: { scryfallId: cardData.id },
              update: {
                oracleId: cardData.oracle_id,
                name: cardData.name,
                nameFr: nameFr,
                manaCost: cardData.mana_cost,
                cmc: cardData.cmc,
                typeLine: cardData.type_line,
                typeLineFr: typeLineFr,
                oracleText: cardData.oracle_text,
                oracleTextFr: oracleTextFr,
                power: cardData.power,
                toughness: cardData.toughness,
                loyalty: cardData.loyalty,
                colors: JSON.stringify(cardData.colors || []) as any,
                colorIdentity: JSON.stringify(cardData.color_identity || []) as any,
                rarity: cardData.rarity,
                collectorNumber: cardData.collector_number,
                lang: cardData.lang,
                imageUris: JSON.stringify(cardData.image_uris || {}),
                prices: JSON.stringify(cardData.prices || {}),
                // numeric EUR price for DB-level sorting/filtering
                priceEur: (() => {
                  try {
                    const eur = (cardData.prices as any)?.eur;
                    const n = eur !== null && eur !== undefined ? parseFloat(String(eur)) : NaN;
                    return Number.isFinite(n) ? n : null;
                  } catch { return null; }
                })(),
                priceEurFoil: (() => {
                  try {
                    const eurf = (cardData.prices as any)?.eur_foil;
                    const n = eurf !== null && eurf !== undefined ? parseFloat(String(eurf)) : NaN;
                    return Number.isFinite(n) ? n : null;
                  } catch { return null; }
                })(),
                legalities: JSON.stringify(cardData.legalities || {}),
        booster: cardData.booster,
        promo: cardData.promo,
        variation: cardData.variation,
        fullArt: cardData.full_art,
        frameEffects: JSON.stringify(cardData.frame_effects || []),
        promoTypes: JSON.stringify(cardData.promo_types || []),
        borderColor: cardData.border_color,
        isExtra,
                updatedAt: new Date()
              },
              create: {
                scryfallId: cardData.id,
                oracleId: cardData.oracle_id,
                name: cardData.name,
                nameFr: nameFr,
                manaCost: cardData.mana_cost,
                cmc: cardData.cmc,
                typeLine: cardData.type_line,
                typeLineFr: typeLineFr,
                oracleText: cardData.oracle_text,
                oracleTextFr: oracleTextFr,
                power: cardData.power,
                toughness: cardData.toughness,
                loyalty: cardData.loyalty,
                colors: JSON.stringify(cardData.colors || []) as any,
                colorIdentity: JSON.stringify(cardData.color_identity || []) as any,
                rarity: cardData.rarity,
                collectorNumber: cardData.collector_number,
                lang: cardData.lang,
                imageUris: JSON.stringify(cardData.image_uris || {}),
                prices: JSON.stringify(cardData.prices || {}),
                // numeric EUR price for DB-level sorting/filtering
                priceEur: (() => {
                  try {
                    const eur = (cardData.prices as any)?.eur;
                    const n = eur !== null && eur !== undefined ? parseFloat(String(eur)) : NaN;
                    return Number.isFinite(n) ? n : null;
                  } catch { return null; }
                })(),
                priceEurFoil: (() => {
                  try {
                    const eurf = (cardData.prices as any)?.eur_foil;
                    const n = eurf !== null && eurf !== undefined ? parseFloat(String(eurf)) : NaN;
                    return Number.isFinite(n) ? n : null;
                  } catch { return null; }
                })(),
                legalities: JSON.stringify(cardData.legalities || {}),
        booster: cardData.booster,
        promo: cardData.promo,
        variation: cardData.variation,
        fullArt: cardData.full_art,
        frameEffects: JSON.stringify(cardData.frame_effects || []),
        promoTypes: JSON.stringify(cardData.promo_types || []),
        borderColor: cardData.border_color,
        isExtra,
                setId: set.id
              }
            });

            processedCount++;
          } catch (error) {
            console.error(`Error processing card ${cardData.name}:`, error);
          }
        }

        hasMore = cardsData.has_more;
        nextPageUrl = cardsData.next_page;

        console.log(`Processed ${processedCount} cards so far...`);
      }

      await prisma.scryfallSync.create({
        data: {
          type: 'cards',
          lastSync: new Date(),
          status: 'SUCCESS',
          message: `Successfully synced ${processedCount} cards`,
          recordsProcessed: processedCount
        }
      });

      console.log(`Cards sync completed. Processed ${processedCount} cards.`);
    } catch (error) {
      await prisma.scryfallSync.create({
        data: {
          type: 'cards',
          lastSync: new Date(),
          status: 'FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recordsProcessed: 0
        }
      });
      console.error('Cards sync failed:', error);
      throw error;
    }
  }

  async updateFrenchTranslations(): Promise<void> {
    try {
      console.log('Starting French translations update...');
      
      // Get all English cards without French translations
      const englishCards = await prisma.card.findMany({
        where: {
          lang: 'en',
          nameFr: null
        },
        take: 100 // Process in batches
      });

      let updatedCount = 0;

      for (const card of englishCards) {
        try {
          const set = await prisma.set.findUnique({
            where: { id: card.setId }
          });

          if (!set) continue;

          const frenchCard = await this.makeRequest(
            `${this.baseUrl}/cards/${set.code}/${card.collectorNumber}/fr`
          );

          await prisma.card.update({
            where: { id: card.id },
            data: {
              nameFr: frenchCard.name,
              typeLineFr: frenchCard.type_line,
              oracleTextFr: frenchCard.oracle_text,
              updatedAt: new Date()
            }
          });

          updatedCount++;
        } catch (error) {
          // French version doesn't exist, skip
          continue;
        }
      }

      console.log(`Updated ${updatedCount} cards with French translations.`);
    } catch (error) {
      console.error('French translations update failed:', error);
      throw error;
    }
  }

  async getLastSync(type: 'sets' | 'cards'): Promise<Date | null> {
    const lastSync = await prisma.scryfallSync.findFirst({
      where: { 
        type,
        status: 'SUCCESS'
      },
      orderBy: { createdAt: 'desc' }
    });

    return lastSync?.lastSync || null;
  }
}
