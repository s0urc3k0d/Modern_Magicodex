import axios from 'axios';
import { prisma } from '../db/prisma';
import { computeIsExtra } from '../utils/extras';

interface ScryfallCardRaw {
  id: string;
  oracle_id: string;
  name: string;
  set: string;
  collector_number: string;
  lang: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors?: string[];
  color_identity?: string[];
  rarity?: string;
  image_uris?: any;
  prices?: any;
  legalities?: any;
  booster?: boolean;
  promo?: boolean;
  variation?: boolean;
  full_art?: boolean;
  frame_effects?: string[];
  promo_types?: string[];
  border_color?: string;
}

const SCRYFALL_BASE = 'https://api.scryfall.com';

// computeIsExtra now imported from shared utils

async function fetchAllPrintsForSet(code: string): Promise<ScryfallCardRaw[]> {
  const query = `set:${code}`;
  let url = `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(query)}&unique=prints&include_extras=true&include_variations=true&order=set`;
  const all: ScryfallCardRaw[] = [];
  while (url) {
    const { data } = await axios.get(url);
    if (Array.isArray(data.data)) all.push(...(data.data as ScryfallCardRaw[]));
    url = data.has_more ? data.next_page : null;
    await new Promise(r => setTimeout(r, 80));
  }
  return all;
}

export async function runExtrasDelta(options: { setCode?: string } = {}) {
  const started = Date.now();
  const sets = await prisma.set.findMany({
    where: {
      NOT: { type: { in: ['alchemy','funny','memorabilia'] } },
      ...(options.setCode ? { code: options.setCode.toUpperCase() } : {})
    },
    orderBy: { releasedAt: 'desc' }
  });

  let totalCreated = 0;
  let totalScanned = 0;
  const perSet: Array<{ code: string; created: number; scanned: number }> = [];

  for (const set of sets) {
    try {
      const prints = await fetchAllPrintsForSet(set.code.toLowerCase());
      totalScanned += prints.length;
      const extras = prints.filter(p => computeIsExtra(p));
      if (!extras.length) {
        perSet.push({ code: set.code, created: 0, scanned: prints.length });
        continue;
      }
      const existing = await prisma.card.findMany({
        where: { scryfallId: { in: extras.map(e => e.id) } },
        select: { scryfallId: true }
      });
      const existingSet = new Set(existing.map((e: any) => e.scryfallId));
      const toCreate: any[] = [];
      for (const c of extras) {
        if (existingSet.has(c.id)) continue;
        const isExtra = computeIsExtra(c);
        toCreate.push({
          scryfallId: c.id,
            oracleId: c.oracle_id,
            name: c.name,
            nameFr: null,
            manaCost: c.mana_cost || null,
            cmc: c.cmc ?? null,
            typeLine: c.type_line || '',
            typeLineFr: null,
            oracleText: c.oracle_text || null,
            oracleTextFr: null,
            power: c.power || null,
            toughness: c.toughness || null,
            loyalty: c.loyalty || null,
            colors: JSON.stringify(c.colors || []),
            colorIdentity: JSON.stringify(c.color_identity || []),
            rarity: c.rarity || 'common',
            collectorNumber: c.collector_number,
            lang: c.lang || 'en',
            imageUris: JSON.stringify(c.image_uris || {}),
            prices: JSON.stringify(c.prices || {}),
            legalities: JSON.stringify(c.legalities || {}),
            booster: c.booster,
            promo: c.promo,
            variation: c.variation,
            fullArt: c.full_art,
            frameEffects: JSON.stringify(c.frame_effects || []),
            promoTypes: JSON.stringify(c.promo_types || []),
            borderColor: c.border_color || null,
            isExtra: isExtra,
            setId: set.id,
        });
      }
      if (toCreate.length) {
        for (let i = 0; i < toCreate.length; i += 250) {
          await prisma.card.createMany({ data: toCreate.slice(i, i + 250) });
        }
      }
      totalCreated += toCreate.length;
      perSet.push({ code: set.code, created: toCreate.length, scanned: prints.length });
    } catch (err) {
      perSet.push({ code: set.code, created: 0, scanned: 0 });
    }
  }

  const durationSeconds = (Date.now() - started) / 1000;

  await prisma.scryfallSync.create({
    data: {
      type: 'cards',
      status: 'SUCCESS',
      lastSync: new Date(),
      message: `Delta extras API: +${totalCreated}`,
      recordsProcessed: totalCreated
    }
  });

  return {
    created: totalCreated,
    scanned: totalScanned,
    sets: perSet,
    durationSeconds,
    setFilter: options.setCode || null
  };
}
