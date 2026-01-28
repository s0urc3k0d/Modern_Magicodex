import { PrismaClient } from '@prisma/client';

export type CardSearchOptions = {
  colors?: string[]; // ['W','U','B','R','G','C']
  rarity?: 'common' | 'uncommon' | 'rare' | 'mythic';
  typeContains?: string;
  priceMin?: number;
  priceMax?: number;
  extras?: boolean; // isExtra flag
};

// Lightweight parser for colorIdentity JSON string
function parseIdentity(identityStr: string | null): string[] {
  if (!identityStr) return [];
  try {
    const v = JSON.parse(identityStr);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Apply in-memory filters that are not pushed down (or for SQLite path)
function passesFilters(row: any, opts: CardSearchOptions): boolean {
  const { colors = [], rarity, typeContains, priceMin, priceMax, extras } = opts || {};
  if (extras !== undefined && row.isExtra !== extras) return false;
  if (rarity && row.rarity !== rarity) return false;
  if (typeof priceMin === 'number' && (row.priceEur ?? Infinity) < priceMin) return false;
  if (typeof priceMax === 'number' && (row.priceEur ?? -Infinity) > priceMax) return false;
  if (typeContains) {
    const hay = (row.typeLineFr || row.typeLine || '').toLowerCase();
    if (!hay.includes(String(typeContains).toLowerCase())) return false;
  }
  if (colors.length) {
    const identity = parseIdentity(row.colorIdentity);
    const ok = colors.every((rc) => rc === 'C' ? (identity.length === 0 || identity.includes('C')) : identity.includes(rc));
    if (!ok) return false;
  }
  return true;
}

export async function searchCardIds(
  prisma: PrismaClient | any,
  q: string,
  limit: number = 50,
  opts: CardSearchOptions = {}
): Promise<string[]> {
  const query = String(q || '').trim();
  if (!query || query.length < 2) return [];
  const dbUrl = process.env.DATABASE_URL || '';
  const isPostgres = dbUrl.startsWith('postgres');

  if (isPostgres) {
    // Use Postgres FTS with websearch_to_tsquery and prefix ordering hints
    const results: any[] = await (prisma as any).$queryRaw`
      SELECT c.id, c."colorIdentity", c.rarity, c."typeLine", c."typeLineFr", c."priceEur", c."isExtra",
             (lower(coalesce(c.name,'')) = lower(${query}))              AS exact_en,
             (lower(coalesce(c."nameFr",'')) = lower(${query}))         AS exact_fr,
             (lower(coalesce(c.name,'')) LIKE lower(${query}) || '%')    AS prefix_en,
             (lower(coalesce(c."nameFr",'')) LIKE lower(${query}) || '%') AS prefix_fr
      FROM "cards" c
      WHERE (
        to_tsvector('simple',
            coalesce(c.name,'') || ' ' ||
            coalesce(c."nameFr",'') || ' ' ||
            coalesce(c."typeLine",'') || ' ' ||
            coalesce(c."typeLineFr",'') || ' ' ||
            coalesce(c."oracleText",'') || ' ' ||
            coalesce(c."oracleTextFr",'')
        ) @@ websearch_to_tsquery('simple', ${query})
      )
      OR lower(coalesce(c.name,'')) LIKE lower(${query}) || '%'
      OR lower(coalesce(c."nameFr",'')) LIKE lower(${query}) || '%'
      ORDER BY exact_en DESC, exact_fr DESC, prefix_en DESC, prefix_fr DESC, c."updatedAt" DESC
      LIMIT ${limit}
    `;

    const filtered = (results || []).filter((r) => passesFilters(r, opts));
    return filtered.map((r) => r.id as string);
  }

  // SQLite path using FTS5 virtual table
  const resultsSqlite: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT c.id, c.colorIdentity, c.rarity, c.typeLine, c.typeLineFr, c.priceEur, c.isExtra
     FROM cards_fts f
     JOIN cards c ON c.id = f.cardId
     WHERE cards_fts MATCH ?
     LIMIT ?`,
    query,
    limit
  );
  const filtered = (resultsSqlite || []).filter((r) => passesFilters(r, opts));
  return filtered.map((r) => r.id as string);
}
