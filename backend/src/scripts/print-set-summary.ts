import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseCollectorNumber(num: string) {
  // Handles formats like '123', '123a', 'A-143', '143s', etc.
  // Extract leading optional letter+hyphen (e.g., 'A-'), core number, and trailing letters
  const m = num.match(/^(?:([A-Za-z])\-)?(\d+)([A-Za-z+]*)$/);
  if (!m) return { n: Number.MAX_SAFE_INTEGER, suffix: '' };
  const [, prefixLetter, digits, suffix] = m;
  const base = parseInt(digits, 10);
  // Weight prefix letter slightly after base
  const prefixCode = prefixLetter ? prefixLetter.toLowerCase().charCodeAt(0) : 0;
  return { n: base * 1000 + prefixCode, suffix: (suffix || '').toLowerCase() };
}

async function main() {
  const codeArg = process.argv[2];
  if (!codeArg) {
    console.error('Usage: ts-node src/scripts/print-set-summary.ts <setCode>');
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
    select: { collectorNumber: true, name: true },
  });

  const total = cards.length;
  const sorted = cards
    .slice()
    .sort((a: any, b: any) => {
      const A = parseCollectorNumber(a.collectorNumber);
      const B = parseCollectorNumber(b.collectorNumber);
      if (A.n !== B.n) return A.n - B.n;
      return A.suffix.localeCompare(B.suffix);
    });

  const first10 = sorted.slice(0, 10);
  const last10 = sorted.slice(-10);

  console.log(`Set ${code.toUpperCase()} total cards: ${total}`);
  console.log('First 10 by collectorNumber:', first10.map((c: any) => c.collectorNumber));
  console.log('Last 10 by collectorNumber:', last10.map((c: any) => c.collectorNumber));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
