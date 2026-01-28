import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const codeArg = process.argv[2];
  if (!codeArg) {
    console.error('Usage: ts-node src/scripts/check-set-duplicates.ts <setCode>');
    process.exit(1);
  }
  const code = codeArg.toLowerCase();
  const set = await prisma.set.findFirst({ where: { code } });
  if (!set) {
    console.error(`Set not found for code: ${code}`);
    process.exit(1);
  }

  const cards = await prisma.card.findMany({
    where: { setId: set.id },
    select: { collectorNumber: true },
  });

  const counts: Record<string, number> = {};
  for (const c of cards) {
    counts[c.collectorNumber] = (counts[c.collectorNumber] || 0) + 1;
  }

  const duplicates = Object.entries(counts)
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1]);

  console.log(`Set ${code.toUpperCase()} total cards: ${cards.length}`);
  console.log(`Duplicate collectorNumbers (top 20):`);
  console.log(duplicates.slice(0, 20));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
