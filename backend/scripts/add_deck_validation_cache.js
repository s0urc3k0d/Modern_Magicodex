// One-off script to add deck validation cache columns if they are missing.
// Use this when Prisma migrate baseline is problematic; it performs idempotent ALTERs.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='decks'`;
  const existing = rows.map(r => r.column_name);
  const pending = [];
  if (!existing.includes('lastValidationAt')) pending.push(`ALTER TABLE "decks" ADD COLUMN "lastValidationAt" TIMESTAMP(3);`);
  if (!existing.includes('lastValidationValid')) pending.push(`ALTER TABLE "decks" ADD COLUMN "lastValidationValid" BOOLEAN;`);
  if (!existing.includes('lastValidationIssues')) pending.push(`ALTER TABLE "decks" ADD COLUMN "lastValidationIssues" JSONB;`);
  if (!pending.length) {
    console.log('All validation cache columns already present. Nothing to do.');
  } else {
    for (const sql of pending) {
      console.log('Executing:', sql);
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('Added columns:', pending.length);
  }
}

main()
  .catch(err => {
    console.error('Error applying validation cache columns:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
