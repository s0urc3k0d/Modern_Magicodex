import { Router } from 'express';

// Minimal server-exposed deck rules to keep client and server in sync
// Keep in sync with frontend/src/domain/decks/rules.ts

type DeckFormat = 'Standard' | 'Pioneer' | 'Modern' | 'Legacy' | 'Vintage' | 'Historic' | 'Commander' | 'Alchemy' | 'Brawl' | 'Pauper' | 'Casual';

const FORMATS: DeckFormat[] = ['Standard','Pioneer','Modern','Legacy','Vintage','Historic','Commander','Alchemy','Brawl','Pauper','Casual'];

const SINGLETON_FORMATS = ['Commander'] as DeckFormat[];

const MAIN_MINIMUM: Record<DeckFormat, number> = {
  Standard: 60,
  Pioneer: 60,
  Modern: 60,
  Legacy: 60,
  Vintage: 60,
  Historic: 60,
  Commander: 99,
  Alchemy: 60,
  Brawl: 60,
  Pauper: 60,
  Casual: 60,
};

const SIDEBOARD_LIMIT: Partial<Record<DeckFormat, number>> = {
  Standard: 15,
  Pioneer: 15,
  Modern: 15,
  Legacy: 15,
  Vintage: 15,
  Historic: 15,
};

const BANLIST: Record<DeckFormat, string[]> = {
  Standard: [],
  Pioneer: [],
  Modern: [],
  Legacy: [],
  Vintage: [],
  Historic: [],
  Commander: [],
  Alchemy: [],
  Brawl: [],
  Pauper: [],
  Casual: [],
};

const router = Router();

// GET /api/rules
router.get('/', (_req, res) => {
  res.json({
    formats: FORMATS,
    singletonFormats: SINGLETON_FORMATS,
    mainMinimum: MAIN_MINIMUM,
    sideboardLimit: SIDEBOARD_LIMIT,
    banlist: BANLIST,
    version: 1,
  });
});

export default router;
