import { prisma } from '../db/prisma';
import { ScryfallHttpClient } from './scryfall-http';

type ScryCard = {
  id: string;
  oracle_id: string;
  name: string;
  printed_name?: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  printed_type_line?: string;
  oracle_text?: string;
  printed_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors?: string[];
  color_identity?: string[];
  rarity?: string;
  collector_number: string;
  set: string;
  set_name: string;
  lang: string;
  image_uris?: any;
  prices?: any;
  legalities?: any;
  card_faces?: Array<{
    name?: string;
    oracle_text?: string;
    type_line?: string;
    image_uris?: any;
  }>;
};

type ScrySet = {
  id: string;
  code: string;
  name: string;
  released_at?: string;
  set_type: string;
  card_count?: number;
  icon_svg_uri?: string;
};

export class HybridScryfallService {
  private base = 'https://api.scryfall.com';
  private http = new ScryfallHttpClient({ delayMs: 150 });
  private prisma = prisma;

  private async paginate<T = any>(url: string): Promise<T[]> {
    type Page<U> = { data: U[]; has_more?: boolean; next_page?: string };
    let next: string | null = url;
    const all: T[] = [];
    while (next) {
      const page: Page<T> = await this.http.getJson<Page<T>>(next);
      if (page && Array.isArray(page.data) && page.data.length) all.push(...page.data);
      next = page && page.has_more ? page.next_page ?? null : null;
    }
    return all;
  }

  // 1) Sets sync (upsert)
  async syncSets(force = false) {
    const data = await this.http.getJson<{ data: ScrySet[] }>(`${this.base}/sets`);
    let processed = 0, created = 0, updated = 0;
    for (const s of data.data) {
      const payload = {
        scryfallId: s.id,
        code: s.code.toUpperCase(),
        name: s.name,
        releasedAt: s.released_at ? new Date(s.released_at) : null,
        cardCount: s.card_count ?? 0,
        type: s.set_type,
        iconSvgUri: s.icon_svg_uri ?? '',
      };
      // Check by scryfallId first (primary key from Scryfall)
      const existingById = await this.prisma.set.findUnique({ where: { scryfallId: payload.scryfallId } });
      if (existingById && !force) { processed++; continue; }
      
      // Also check if code exists with different scryfallId (code changed in Scryfall)
      const existingByCode = await this.prisma.set.findUnique({ where: { code: payload.code } });
      if (existingByCode && existingByCode.scryfallId !== payload.scryfallId) {
        // Code collision - update the existing record by scryfallId
        console.log(`Set code collision: ${payload.code} (old scryfallId: ${existingByCode.scryfallId}, new: ${payload.scryfallId})`);
      }
      
      // Upsert by scryfallId (the stable identifier from Scryfall)
      await this.prisma.set.upsert({ 
        where: { scryfallId: payload.scryfallId }, 
        update: { ...payload, scryfallId: undefined }, // Don't update scryfallId itself
        create: payload 
      });
      processed++;
      existingById ? updated++ : created++;
      if (processed % 50 === 0) console.log(`Sets ${processed} (C:${created}/U:${updated})`);
    }
    await this.prisma.scryfallSync.create({
      data: { type: 'sets', status: 'SUCCESS', lastSync: new Date(), message: `Hybrid: ${processed} sets`, recordsProcessed: processed }
    });
  }

  // 2) Cards sync per set with EN+FR first pass
  async syncCardsBySet(setCode: string, force = false) {
    const set = await this.prisma.set.findUnique({ where: { code: setCode.toUpperCase() } });
    if (!set) throw new Error(`Set ${setCode} not found in DB`);

  // Use Scryfall set filter alias `e:` and filter by printed language.
  const enUrl = `${this.base}/cards/search?q=${encodeURIComponent(`e:${setCode.toLowerCase()} lang:en`)}&unique=cards&order=set`;
  const frUrl = `${this.base}/cards/search?q=${encodeURIComponent(`e:${setCode.toLowerCase()} lang:fr`)}&unique=cards&order=set`;

    console.log(`Fetching EN for ${setCode}`);
    const enCards = await this.paginate<ScryCard>(enUrl);
    console.log(`Fetching FR for ${setCode}`);
    let frCards: ScryCard[] = [];
    try {
      frCards = await this.paginate<ScryCard>(frUrl);
    } catch (err: any) {
      // Scryfall returns 404 for searches with no results. Treat as empty FR list.
      const msg = (err && err.message) ? String(err.message) : '';
      if (msg.includes('HTTP 404')) {
        console.warn(`No FR prints found for ${setCode}, continuing with EN only.`);
        frCards = [];
      } else {
        // Re-throw unexpected errors
        throw err;
      }
    }

    // Index FR by oracle_id (fallback: by set+collector)
    const frByOracle = new Map<string, ScryCard>();
    for (const c of frCards) if (c.oracle_id) frByOracle.set(c.oracle_id, c);

    // Prepare rows
    const now = new Date();
    const rows = enCards.map((en) => {
      const fr = en.oracle_id ? frByOracle.get(en.oracle_id) : undefined;
      const colors = JSON.stringify(en.colors ?? []);
      const colorId = JSON.stringify(en.color_identity ?? []);

      const pickText = (card?: ScryCard) => {
        if (!card) return undefined;
        // handle MDFC text fallback
        if (card.oracle_text) return card.oracle_text;
        if (Array.isArray(card.card_faces) && card.card_faces.length) {
          return card.card_faces.map((f) => f.oracle_text).filter(Boolean).join(' // ');
        }
        return undefined;
      };

      const pickType = (card?: ScryCard) => {
        if (!card) return undefined;
        if (card.type_line) return card.type_line;
        if (Array.isArray(card.card_faces) && card.card_faces.length) {
          return card.card_faces.map((f) => f.type_line).filter(Boolean).join(' // ');
        }
        return undefined;
      };

      const pickPrintedType = (card?: ScryCard) => {
        if (!card) return undefined;
        if (card.printed_type_line) return card.printed_type_line;
        return undefined;
      };

      const pickPrintedText = (card?: ScryCard) => {
        if (!card) return undefined;
        if (card.printed_text) return card.printed_text;
        return undefined;
      };

      const imageUris = en.image_uris ?? (Array.isArray(en.card_faces) ? en.card_faces[0]?.image_uris : undefined) ?? {};

  return {
        scryfallId: en.id,
        oracleId: en.oracle_id,
        name: en.name,
        // Prefer printed_name for localized value per Scryfall docs
        nameFr: fr?.printed_name ?? fr?.name ?? null,
        manaCost: en.mana_cost ?? '',
        cmc: en.cmc ?? 0,
        typeLine: pickType(en) ?? '',
        typeLineFr: pickPrintedType(fr) ?? pickType(fr) ?? null,
        oracleText: pickText(en) ?? '',
        oracleTextFr: pickPrintedText(fr) ?? null,
        power: en.power ?? null,
        toughness: en.toughness ?? null,
        loyalty: en.loyalty ?? null,
        colors,
        colorIdentity: colorId,
        rarity: en.rarity ?? 'common',
        collectorNumber: en.collector_number ?? '',
  // Base row in EN, with FR overlays where available
  lang: 'en',
        imageUris: JSON.stringify(imageUris),
        prices: JSON.stringify(en.prices ?? {}),
        legalities: JSON.stringify(en.legalities ?? {}),
        setId: set.id,
        updatedAt: now,
      };
    });

    // Split create vs update
    const existing = await this.prisma.card.findMany({
      where: { scryfallId: { in: rows.map((r) => r.scryfallId) } },
      select: { scryfallId: true },
    });
  const existingIds = new Set(existing.map((e: any) => e.scryfallId));
    const toCreate = rows.filter((r) => !existingIds.has(r.scryfallId));
    const toUpdate = rows.filter((r) => existingIds.has(r.scryfallId));

    // createMany in chunks
    const chunk = async <T>(arr: T[], n = 500, fn: (part: T[]) => Promise<any>) => {
      for (let i = 0; i < arr.length; i += n) await fn(arr.slice(i, i + n));
    };

    let created = 0, updated = 0;
    await chunk(toCreate, 500, async (part) => {
      if (part.length === 0) return;
      await this.prisma.card.createMany({ data: part });
      created += part.length;
    });

    // Update via upsert in chunks (fallback without raw upsertMany)
    await chunk(toUpdate, 200, async (part) => {
      await this.prisma.$transaction(
        part.map((row) =>
          this.prisma.card.upsert({ where: { scryfallId: row.scryfallId }, create: row, update: row })
        )
      );
      updated += part.length;
    });

    await this.prisma.scryfallSync.create({
      data: {
        type: 'cards',
        status: 'SUCCESS',
        lastSync: new Date(),
        message: `Hybrid ${setCode}: +${created}/~${updated}`,
        recordsProcessed: created + updated,
      },
    });
    console.log(`Hybrid set ${setCode}: created ${created}, updated ${updated}`);
  }

  async syncAllCards(force = false) {
    // Sync recent/major sets first to shorten perceived time
    const sets = await this.prisma.set.findMany({ orderBy: { releasedAt: 'desc' } });
    for (const s of sets) {
      try {
        await this.syncCardsBySet(s.code, force);
      } catch (e) {
        console.warn(`Set ${s.code} failed:`, e);
      }
    }
  }

  async fullSync(force = false) {
    await this.syncSets(force);
    await this.syncAllCards(force);
  }
}
