import { runExtrasDelta } from '../services/extras-delta';

async function main() {
  console.log('[delta-extras] Démarrage via script ...');
  const summary = await runExtrasDelta();
  console.log('[delta-extras] Résumé:', summary);
}

main().catch((e) => {
  console.error('[delta-extras] Echec:', e);
  process.exit(1);
});
