-- Recalcule isExtra pour toutes les cartes basé sur la logique corrigée
-- 
-- Usage:
--   psql -h localhost -U magicodex -d magicodex -f scripts/recalculate-is-extra.sql
-- ou
--   psql $DATABASE_URL -f scripts/recalculate-is-extra.sql

-- Afficher le nombre de cartes avant correction
SELECT 
  'Avant correction:' as status,
  COUNT(*) FILTER (WHERE "isExtra" = true) as extras,
  COUNT(*) FILTER (WHERE "isExtra" = false) as standard,
  COUNT(*) as total
FROM "Card";

-- Mettre à jour isExtra = false pour les cartes qui ne devraient PAS être extras
-- (cartes avec uniquement universesbeyond, boosterfun, etc. comme promo_types)
UPDATE "Card"
SET "isExtra" = false, "updatedAt" = NOW()
WHERE "isExtra" = true
  AND "promo" IS NOT TRUE
  AND "variation" IS NOT TRUE  
  AND "booster" IS NOT FALSE
  AND (
    "frameEffects" IS NULL 
    OR "frameEffects" = '[]'
    OR NOT (
      "frameEffects"::text ILIKE '%extendedart%'
      OR "frameEffects"::text ILIKE '%showcase%'
      OR "frameEffects"::text ILIKE '%borderless%'
      OR "frameEffects"::text ILIKE '%etched%'
      OR "frameEffects"::text ILIKE '%inverted%'
      OR "frameEffects"::text ILIKE '%shatteredglass%'
      OR "frameEffects"::text ILIKE '%textless%'
    )
  )
  AND (
    "promoTypes" IS NULL 
    OR "promoTypes" = '[]'
    OR (
      -- Seulement des promo types non-extra (universesbeyond, boosterfun, ff*)
      "promoTypes"::text ILIKE '%universesbeyond%'
      OR "promoTypes"::text ILIKE '%boosterfun%'
      OR "promoTypes"::text ~ '"ff[ivx]+'
    )
    AND NOT (
      -- Pas de vrais promo types
      "promoTypes"::text ILIKE '%prerelease%'
      OR "promoTypes"::text ILIKE '%promopacks%'
      OR "promoTypes"::text ILIKE '%bundle%'
      OR "promoTypes"::text ILIKE '%buyabox%'
      OR "promoTypes"::text ILIKE '%gameday%'
      OR "promoTypes"::text ILIKE '%intropack%'
      OR "promoTypes"::text ILIKE '%league%'
      OR "promoTypes"::text ILIKE '%planeswalkerstamped%'
      OR "promoTypes"::text ILIKE '%playerrewards%'
      OR "promoTypes"::text ILIKE '%premiereshop%'
      OR "promoTypes"::text ILIKE '%release%'
      OR "promoTypes"::text ILIKE '%setpromo%'
      OR "promoTypes"::text ILIKE '%stamped%'
      OR "promoTypes"::text ILIKE '%tourney%'
      OR "promoTypes"::text ILIKE '%wizardsplaynetwork%'
    )
  );

-- Afficher le nombre de lignes modifiées
SELECT 'Cartes mises à jour (extras -> standard):' as status, COUNT(*) as count
FROM "Card" 
WHERE "updatedAt" > NOW() - INTERVAL '1 minute';

-- Afficher le nombre de cartes après correction
SELECT 
  'Après correction:' as status,
  COUNT(*) FILTER (WHERE "isExtra" = true) as extras,
  COUNT(*) FILTER (WHERE "isExtra" = false) as standard,
  COUNT(*) as total
FROM "Card";
