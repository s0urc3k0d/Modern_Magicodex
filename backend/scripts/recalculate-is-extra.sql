-- Recalcule isExtra pour toutes les cartes basé sur la logique corrigée
-- 
-- Usage:
--   psql "postgresql://user:pass@host:5432/db" -f scripts/recalculate-is-extra.sql

-- Afficher le nombre de cartes avant correction
SELECT 
  'Avant correction:' as status,
  COUNT(*) FILTER (WHERE is_extra = true) as extras,
  COUNT(*) FILTER (WHERE is_extra = false) as standard,
  COUNT(*) as total
FROM cards;

-- Mettre à jour is_extra = false pour les cartes qui ne devraient PAS être extras
-- (cartes avec uniquement universesbeyond, boosterfun, etc. comme promo_types)
UPDATE cards
SET is_extra = false, updated_at = NOW()
WHERE is_extra = true
  AND promo IS NOT TRUE
  AND variation IS NOT TRUE  
  AND booster IS NOT FALSE
  AND (
    frame_effects IS NULL 
    OR frame_effects = '[]'
    OR NOT (
      frame_effects::text ILIKE '%extendedart%'
      OR frame_effects::text ILIKE '%showcase%'
      OR frame_effects::text ILIKE '%borderless%'
      OR frame_effects::text ILIKE '%etched%'
      OR frame_effects::text ILIKE '%inverted%'
      OR frame_effects::text ILIKE '%shatteredglass%'
      OR frame_effects::text ILIKE '%textless%'
    )
  )
  AND (
    promo_types IS NULL 
    OR promo_types = '[]'
    OR (
      -- Seulement des promo types non-extra (universesbeyond, boosterfun, ff*)
      promo_types::text ILIKE '%universesbeyond%'
      OR promo_types::text ILIKE '%boosterfun%'
      OR promo_types::text ~ '"ff[ivx]+'
    )
    AND NOT (
      -- Pas de vrais promo types
      promo_types::text ILIKE '%prerelease%'
      OR promo_types::text ILIKE '%promopacks%'
      OR promo_types::text ILIKE '%bundle%'
      OR promo_types::text ILIKE '%buyabox%'
      OR promo_types::text ILIKE '%gameday%'
      OR promo_types::text ILIKE '%intropack%'
      OR promo_types::text ILIKE '%league%'
      OR promo_types::text ILIKE '%planeswalkerstamped%'
      OR promo_types::text ILIKE '%playerrewards%'
      OR promo_types::text ILIKE '%premiereshop%'
      OR promo_types::text ILIKE '%release%'
      OR promo_types::text ILIKE '%setpromo%'
      OR promo_types::text ILIKE '%stamped%'
      OR promo_types::text ILIKE '%tourney%'
      OR promo_types::text ILIKE '%wizardsplaynetwork%'
    )
  );

-- Afficher le nombre de lignes modifiées
SELECT 'Cartes mises à jour (extras -> standard):' as status, COUNT(*) as count
FROM cards 
WHERE updated_at > NOW() - INTERVAL '1 minute';

-- Afficher le nombre de cartes après correction
SELECT 
  'Après correction:' as status,
  COUNT(*) FILTER (WHERE is_extra = true) as extras,
  COUNT(*) FILTER (WHERE is_extra = false) as standard,
  COUNT(*) as total
FROM cards;
