import { prisma } from '../db/prisma';

/**
 * Backfill script to populate Card.priceEur from Card.prices (JSON string with Scryfall prices)
 * - Reads all cards in batches
 * - Parses prices.eur and updates priceEur as a numeric value
 */
async function main() {
  console.log('Starting backfill of priceEur and priceEurFoil from prices JSON...');
  const batchSize = 1000;
  let offset = 0;
  let updated = 0;

  while (true) {
  const prismaAny = prisma as any;
  const cards: Array<{ id: string; prices: string | null; priceEur: number | null; priceEurFoil: number | null }> = await prismaAny.card.findMany({
      skip: offset,
      take: batchSize,
      select: { id: true, prices: true, priceEur: true, priceEurFoil: true }
    });
    if (cards.length === 0) break;

    const updates = cards
      .map((c: { id: string; prices: string | null; priceEur: number | null; priceEurFoil: number | null }) => {
        if (!c.prices) return { id: c.id, priceEur: null as number | null, priceEurFoil: null as number | null };
        try {
          const parsed = JSON.parse(c.prices || '{}');
          const eur = parsed?.eur;
          const n = eur !== null && eur !== undefined ? parseFloat(String(eur)) : NaN;
          const eurf = parsed?.eur_foil;
          const nf = eurf !== null && eurf !== undefined ? parseFloat(String(eurf)) : NaN;
          return { id: c.id, priceEur: Number.isFinite(n) ? n : null, priceEurFoil: Number.isFinite(nf) ? nf : null };
        } catch {
          return { id: c.id, priceEur: null as number | null, priceEurFoil: null as number | null };
        }
      })
      .filter(Boolean) as Array<{ id: string; priceEur: number | null; priceEurFoil: number | null }>;

    if (updates.length > 0) {
      const prismaAny = prisma as any;
      await prisma.$transaction(
        updates.map((u) =>
          prismaAny.card.update({ where: { id: u.id }, data: { priceEur: u.priceEur, priceEurFoil: u.priceEurFoil } })
        )
      );
      updated += updates.length;
      console.log(`Updated ${updates.length} rows (total ${updated})...`);
    }

    offset += batchSize;
  }

  console.log(`Backfill complete. Total rows updated: ${updated}`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
