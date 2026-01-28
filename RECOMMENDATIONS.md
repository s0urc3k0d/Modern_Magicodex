# Magicodex – Recommandations Stratégiques & Techniques

Dernière génération: 2025-11-17

Ce document synthétise des recommandations issues de l'analyse du code, du schéma Prisma, des middlewares, des services Scryfall, de l'architecture frontend (React/Vite/React Query) et des documents fournis (`ARCHITECTURE.md`, `README.md`, `PROJECT_REQUIREMENTS.md`). L'objectif est d'améliorer robustesse, performance, maintenabilité, sécurité, testabilité et évolutivité.

## 1. Vue Stratégique
Le projet est déjà bien structuré (monorepo, séparation back/front, usage de TypeScript, React Query, Prisma, FTS5, PWA facultative). Les priorités doivent viser:
- Stabiliser la couche de synchronisation Scryfall (unifier, rendre idempotent, observabilité claire).
- Réduire la logique JSON string → parse répétée (centralisation + typage fort).
- Introduire une vraie couche de tests (unitaires + intégration + contrats API) avant refactors majeurs.
- Préparer migration progressive SQLite → PostgreSQL (ou conserver SQLite pour dev + Postgres prod) tout en gardant FTS robuste.
- Mettre en place rafraîchissement tokens + durcissement sécurité (XSS, JWT rotation, séparation rôles).
- Instrumenter logs structurés + métriques (latence, taille sync, invalidations caches) + suivi erreurs.

## 2. Architecture Générale
### Observations
- Backend Express monolithique mais logique métier surtout concentrée dans des services Scryfall et routes.
- Absence de découpage clair Domain / Application / Infrastructure.
- Multiples scripts ad-hoc (maintenance, backfill) sans orchestrateur commun ou interface CLI unifiée.
- Frontend utilise lazy loading et Query Client isolé OK; manque potentielle séparation feature modules.
- JSON sérialisé dans la DB pour champs cartes (imageUris, prices, colors...).

### Recommandations
1. Introduire un dossier `backend/src/modules/{cards,sets,decks,collection,auth}` avec:
	- `controllers` (ou routes minces)
	- `services` (métier pur)
	- `repositories` (accès Prisma)
	- `schemas` (Zod pour validation I/O)
2. Centraliser conversions JSON dans un utilitaire unique (`parseCardFields(card)` déjà partiel) + types TS partagés dans `shared/` (ex: `CardPrices`, `ImageUris`).
3. Normaliser prix: extraire colonne `prices` en table séparée `CardPriceHistory` pour historiser et éviter parsing constant (optionnel P2).
4. Introduire un bus interne (simple queue en mémoire / BullMQ si Redis) pour tâches longues (sync sets, sync cards, backfills) pour ne pas bloquer thread requêtes.
5. Définir des interfaces de service Scryfall: `IScryfallSync { syncSets(opts), syncCards(opts), syncTranslations(batchSize) }` pour échanger implémentations (baseline vs optimized) sans exposer toutes les variantes dans l'API publique.
6. Extraire logique FTS5 dans un module `fts/index.ts` avec initialisation, health, et fallback.
7. Préparer passage à PostgreSQL: abstraction sur fonctions spécifiques SQLite (`$queryRawUnsafe` FTS) via interface `ISearchProvider`.

## 3. Backend – Performances & Robustesse
### Points Identifiés
- Upsert cartes dans boucle: risque latence élevé (N requêtes) et contention.
- Délai fixe 100ms → potentiellement sous-optimal (burst adaptatif préférable).
- Pas de pagination contrôlée/limite sur endpoints d’admin (risque de charges inattendues).
- Pas d’Etag / Cache-Control sur réponses statiques.
- Price backfill script séparé; aligner lors de sync.

### Actions
P0 (immédiat):
- Regrouper upserts en batch: construire tableau data → utiliser `prisma.$transaction([...])` ou `createMany` + `updateMany` si possible (fallback upsert par lot 25-50).
- Ajouter limite paramètre max `limit` homogène (déjà 100 pour cartes) sur sets/users.
- Ajouter index composite (`setId, rarity`) si requêtes filtrées fréquentes.

P1:
- Implementer un scheduler adaptatif: si 429 reçu → augmenter délai exponentiel.
- Ajouter endpoint /api/admin/sync/status avec métriques JSON.
- Ajouter pré-calculs agrégations collection (ex: table matérialisée ou `UserCollectionStats`).

P2:
- Worker séparé (process ou container) pour tasks Scryfall + file Redis.
- Introduire cache Redis pour fréquences élevées (recherche sets, decks populaires, FTS résultat partiel).

## 4. Base de Données & Modélisation
### Observations
- SQLite avec FTS5 triggers — bonne base dev mais limites concurrence et scaling.
- JSON string pour arrays/colors/prices → empêche indexation fine et requêtes analytiques.
- Index prix ajoutés (priceEur, priceEurFoil) OK pour filtrage simple.
- Absence historique prix / évolution.

### Recommandations
P0:
- Vérifier intégrité triggers FTS sur migration Postgres (prévoir passage à pg_search ou tsvector).
- Uniformiser types numériques (CMC float: arrondir ?). Utiliser DECIMAL pour prix.
- Ajouter contrainte CHECK pour `board` deck_cards (`IN ('main','side','maybe')`).

P1:
- Passer à Postgres pour production: avantages sur concurrence, extensions (pg_trgm pour fuzzy), JSONB pour legalities/prices.
- Créer table `card_prices` (id, cardId, date, eur, eurFoil) pour historique.
- Partitionner `card_prices` par mois si volumineux.

P2:
- Créer vue matérialisée `card_search_index` (name, typeLine, oracleText, setCode) + GIN index sur tsvector.
- Ajouter table `sync_jobs` détaillée (stages, durations, partial failures).

## 5. Frontend – Organisation & Performance
### Observations
- Composant `CardGrid` très long (>400 lignes) mélange logique filtres + UI.
- Parsing JSON couleurs dans composant (couplage au format backend).
- Beaucoup de state locaux; absence de memoisation sélective sur listes volumineuses.
- Virtualisation (react-window) OK mais rowHeight fixe → peut tronquer contenu si hauteur variable.
- AuthContext stocke token en localStorage (exposé à XSS). Pas de refresh token.
- ErrorBoundary purge SW/caches – utile mais procédure agressive.

### Recommandations
P0:
- Extraire logique filtres `useCardFilters()` hook dédié (entrées: raw cards/userCards → sortie: filtered + stats).
- Centraliser parsing cards dans service frontend (`mapApiCard(raw)`), éviter duplication dans chaque composant.
- Ajouter `React.memo`/`useCallback` sur handlers `onAddToCollection`, `onUpdateQuantity` pour réduire re-renders.
- Utiliser `suspense` + skeletons (déjà suspense fallback simple, améliorer UX).

P1:
- Introduire module `features/cards` avec composants atomiques (FilterPanel, ViewToggle, CardStatsBar).
- Ajouter préfetch queries (React Query `prefetchQuery`) pour sets lors de navigation vers collection.
- Migrer token vers cookie httpOnly (si même domaine) ou stockage mémoire + refresh token endpoint.
- Ajouter mode accessibilité (focus visible, alt text images, ARIA labels).

P2:
- Décomposer pages en segments chargés dynamiquement (code splitting par feature route + vendor chunk review).
- Ajouter instrumentation web vitals (CLS, LCP) + envoi à backend.
- Implémenter optimistic UI pour modifications de quantité.

## 6. Sécurité
### Observations
- JWT simple sans rotation ni refresh, en localStorage (risque vol via XSS).
- Absence vérification force mot de passe côté serveur mentionnée dans code.
- Rate limiter global OK mais segmentation IP/proxy partielle.
- Pas de audit log actions admin.

### Recommandations
P0:
- Ajouter validation mot de passe (longueur, complexité) avec Zod.
- Masquer cause exacte d’erreur login (uniformiser message).
- Ajouter `helmet` directives CSP plus strictes (bloquer inline script sauf hash, autoriser images Scryfall). Ajuster déjà config.

P1:
- Passer token d’accès en durée courte (15m) + refresh token en cookie httpOnly + endpoint `/api/auth/refresh` (rotation + blacklist old). 
- Ajouter audit log (`admin_audit_logs`: userId, action, entity, before, after, ts).
- Implémenter règle de verrouillage compte après X tentatives ratées (sans révéler si email existe).

P2:
- Ajouter signature des sync jobs (enregistrement hash) pour traçabilité.
- Implémenter Sentry ou autre pour suivi exceptions.

## 7. Observabilité & Logs
### Observations
- Logs console non structurés (morgan combined) → difficile agrégation.
- Pas de métriques (sync durée, taille, taux erreurs).

### Recommandations
P0:
- Introduire logger structuré (pino/winston) avec champs: `reqId`, `userId`, `route`, `durationMs`.
- Ajouter middleware `requestId` (UUID v4) + injection dans res.locals.

P1:
- Exposer endpoint `/api/admin/metrics` (auth admin) avec: nb users, nb cards, lastSync sets/cards, syncSuccessRate, avgSyncDuration.
- Intégrer Prometheus (express-prom-bundle) + Grafana.

P2:
- OpenTelemetry traces (sync pipeline, DB queries longues). Export OTLP vers collector.

## 8. Tests & Qualité
### Observations
- Aucun test backend (`npm test` placeholder). Frontend a vitest mais pas d’implémentation visible.

### Stratégie Proposée
1. Backend: Jest ou Vitest (node) + `supertest` pour routes clés (auth, cards search, collection stats).
2. Unitaires: parse JSON card, compute isExtra, services Scryfall (mock axios).
3. Intégration: cycle syncSets+syncCards → validation contenu DB (utiliser SQLite in-memory ou Postgres test).
4. Contrats: générer spec OpenAPI (zod-to-openapi) + tests de conformité.
5. Frontend: tests composants filtres, AuthContext flows, CardDisplay interactions.
6. E2E: Playwright/Cypress pour parcours: login → add card → build deck.
7. CI: GitHub Actions (lint, typecheck, test, build) + badges README.

## 9. Performance & Scalabilité
### Pistes
- Batching DB writes (décrit plus haut) → réduction IO.
- Cache L2 (Redis) pour sets, deck lists, user stats.
- CDN images via Scryfall direct; préchargement lazy.
- Worker hors process (BullMQ) pour sync.
- Compression (gzip/brotli) sur Nginx.

### Mesures à Ajouter
- Latence moyenne endpoints (p95/p99).
- Temps de sync sets/cards + nombre d’erreurs.
- Mémoire utilisée par Node (heap, rss) post sync increments.

## 10. DevOps & Déploiement
### Recommandations
P0:
- Créer `Dockerfile` backend + multi-stage (builder + runner) & `Dockerfile` frontend (vite build → nginx static).
- Fichier `docker-compose.yml` (services: backend, frontend, db, redis).
- Script `start.sh` produire build production + lancer via PM2 (cluster mode).

P1:
- GitHub Actions: build images, pousser vers registry, déploiement auto staging.
- Ajouter scan vulnérabilités (npm audit, Trivy image).
- Gestion secrets: GitHub OIDC + Vault ou secrets manager cloud.

P2:
- Infrastructure as Code (Terraform) pour DB, load balancer, CDN.
- Blue/Green ou Canary deploys (feature flags pour nouveaux services Scryfall).

## 11. Developer Experience (DX)
### Actions
P0:
- Ajouter ESLint config partagée racine + Prettier (cohérence format). Actuellement pas Prettier.
- Script `lint:fix` + hook pre-commit (Husky).
- Ajouter `shared/` pour types communs (Card, Set, Prices...).

P1:
- Générer client API typed (OpenAPI → fetch wrapper) pour remplacer duplication services manuels.
- Storybook pour composants UI (CardDisplay, ManaSymbol, Filters) – facilite design & test visuel.

P2:
- Bundle analyzer (rollup-plugin-visualizer) pour optimiser splits.
- Migration vers `tanstack/router` si besoin data-driven routes + loader patterns.

## 12. Roadmap Priorisée
### P0 (1–2 semaines)
- Logger structuré + requestId
- Refactor batch syncCards (transaction par lot)
- Hook `useCardFilters` + découpage `CardGrid`
- Tests unitaires parse JSON + route /api/cards
- Sécurisation mot de passe & messages auth
- Centralisation parseCardJsonFields & types partagés

### P1 (3–6 semaines)
- Refresh token flow + cookie httpOnly
- Migration Postgres (shadow db + dual write phase optionnel)
- Audit log admin
- Metrics endpoint + Prometheus
- Decomposition services Scryfall via interface + job queue basique
- Tests intégration sync pipeline

### P2 (2–3 mois)
- Historique prix & vues matérialisées
- OpenTelemetry instrumentation
- Worker BullMQ + Redis cluster
- Postgres FTS (tsvector) + abandon FTS5
- Storybook + design system cartes
- E2E tests Playwright (CI)

## 13. Quick Wins
- Ajouter champ `X-Request-Id` middleware.
- `cache-control: public, max-age=300` sur sets & static manifest.
- `prisma.card.findMany` SELECT ciblé (éviter fields inutiles sur listing simple).
- Remplacer parse couleurs manual par utilitaire central.
- Ajouter `aria-label` sur boutons filtres couleurs.

## 14. Risques & Mitigations
| Risque | Impact | Mitigation |
|--------|--------|------------|
| Migration Postgres mal synchronisée | Perte données | Phase dual-write + backups + tests réplication |
| Refactor syncCards introduit incohérences | Cartes manquantes | Tests intégration + checksum des sets |
| Rotation JWT mal implémentée | Déconnexion massive | Phase feature flag + logs surveillés |
| Ajout Redis FTS cache incohérent | Résultats obsolètes | TTL court + invalidation sur upsert batch |
| Historique prix croît rapidement | Gonflement stockage | Partition mensuelle + purge > N mois |

## 15. Futures Évolutions (Idées)
- Analyse valeur collection (agrégation prix, delta historique).
- Recommandations de terrains auto basées sur distribution mana curve.
- Système de tags user sur cartes & decks.
- Recherche fuzzy (lexems, distance Levenshtein) via pg_trgm.
- Mode offline enrichi (cache index recherche, ajout différé).
- Export deck formats multiples (Arena, MTGO, Plain Text, CSV).
- Feature "Trade Matcher" (croisement wishlists utilisateurs).

## 16. Contrat Qualité Minimal à Mettre en Place
- Build CI: Lint (ESLint), Typecheck (tsc --noEmit), Tests (>=80% services critiques), Vulnerability scan.
- Déploiement: migration DB idempotente + health check avant bascule.
- Observabilité: logs structurés + métriques latence + erreurs /min.

## 17. Checklist D’Implémentation Immédiate (P0)
1. Créer `backend/src/utils/cardFields.ts` (fonction parse + types) & remplacement usages.
2. Introduire logger pino + middleware requestId.
3. Refactor syncCards en batch (transaction 25–50 éléments).
4. Hook `useCardFilters` + découpage `CardGrid` en sous-composants.
5. Ajouter tests vitest backend (parse, /api/cards, isExtra).
6. Validation mot de passe Zod (min length, classes de caractères) + messages unifiés.

## 18. Notes Finales
Rester itératif: ne pas bloquer livraison de valeur utilisateur par une migration massive. Prioriser instrumentation + tests avant refactor complexe. Documenter chaque changement de modèle (changelog technique). Ce fichier peut servir de backlog structuré — cocher sections au fur et à mesure dans un système de tickets.

---
Document généré automatiquement. Mettre à jour périodiquement après grands refactors.
