import { ScryfallService } from '../services/scryfall';

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error('Usage: ts-node src/scripts/sync-set.ts <setCode>');
    process.exit(1);
  }
  const svc = new ScryfallService();
  await svc.syncSets(); // ensure set exists
  await svc.syncCards(code);
  console.log(`Sync completed for set ${code}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
