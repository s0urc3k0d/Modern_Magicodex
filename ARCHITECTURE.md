# Magicodex – Architecture technique

Dernière mise à jour: 2025-11-14

## Vue d'ensemble

- Objectif: gestion de collection MTG, construction de decks, synchronisation des cartes/sets depuis Scryfall, statistiques et PWA basique.
- Monorepo: `backend/` (API Express + Prisma) et `frontend/` (React + Vite + React Query + Tailwind).

## Backend

- Langage/Framework: Node.js + Express (TypeScript)
- ORM/DB: Prisma, SQLite par défaut (migrations Prisma). Migration possible vers PostgreSQL.
- Recherche plein texte: SQLite FTS5 via table/triggers créés au démarrage; fallback `LIKE`.
- Auth: JWT (stocké côté client), middleware `auth`, protection admin, rate limiting et helmet.
- Services Scryfall: plusieurs implémentations (`scryfall-*.ts`) reflétant différentes stratégies (baseline, clean batching, hybrid EN+FR, optimized concurrent, unified), plus un script de delta pour extras.
- Tâches planifiées: cron quotidien pour synchronisation.
- Scripts maintenance: nettoyage DB, import/export, détection doublons, résumé de set, génération token admin, make-admin.

### Principaux domaines/extrémités (routes)
- Authentification: register/login/change-password
- Utilisateurs: liste/admin (suppression)
- Sets & Cards: listing, recherche (FTS), identification par collector/year, cartes d'un set
- Collection: stats (group by set/couleur/rareté/type), missing, bulk add/update, wishlist/trade
- Decks: CRUD, duplication, import/export MTGA, analytics (average CMC, mana curve, couleurs, types)
- Admin: déclencheurs de sync (sets, cartes, full), logs de sync, nettoyage DB, métriques simples

### Modèle de données (Prisma – résumé)
- `User`, `Set`, `Card`, `UserCard`, `Deck`, `DeckCard`, `UserListItem` (wishlist/trade), `ScryfallSync`
- Particularités:
  - `Card` a des champs JSON sérialisés en string (`prices`, `imageUris`, `colorIdentity`), `isExtra`, liens vers `Set`
  - FTS5 sur cartes pour recherche textuelle
  - Contrainte collectorNumber non unique (variantes autorisées)

### Recherche de cartes
- Table virtuelle FTS5 + triggers pour tenir l’index à jour
- Fallback LIKE si FTS indisponible
- Endpoints dédiés: texte FTS, identification par collectorNumber (+ métadonnées heuristiques)

### Synchronisation Scryfall
- Variantes historiques de services, toutes exposées (admin):
  - Baseline vs clean (batching), hybrid (EN puis FR overlay), optimized (parallélisme), unified (couverture complète)
- Service `extras-delta`: ajout des promos/variantes manquantes
- Journalisation via `ScryfallSync`

## Frontend

- Stack: React 19, Vite 7, React Router 7, React Query 5, Tailwind, Framer Motion, Chart.js, react-window (virtualisation), PWA (optionnel).
- Robustesse runtime: `DynamicQueryProvider` et `lib/rq.ts` chargent react-query dynamiquement; `ErrorBoundary` propose purge des caches (SW + CacheStorage) en cas de chunks corrompus.
- Auth: `AuthContext` (token en localStorage), redirection/guard, toasts.
- Pages clés:
  - Collection: stats, recherche, filtres avancés (rareté, couleurs, type, texte AND/OR, prix), vue groupée par set ou grille
  - Decks: liste, builder (drag & drop main/side, suggestions terrains, légalité simple), view (stats/visual)
  - Admin: overview, utilisateurs, synchronisation (sets/carte/full, delta extras) et logs, nettoyage DB
  - Stats collection: graphes Pie/Bar par groupement (set/couleur/rareté/type)
  - Missing By Set: cartes manquantes par extension (standard/extras)
  - Scan: décodeur code‑barres + OCR Tesseract (reconnaissance collector/name) → FTS → ajout
- Composants structurants: `Layout`, `Navbar`, `Sidebar`, `RequireAdmin`, `CardGrid`/`CardDisplay` (contrôles quantités + wishlist/trade), `CollectionBySet` (expansions), `AddCardModal`/`BulkAddBySetModal`.

### Flux de données (principaux)
- Auth: login/register → token → Authorization Bearer → middleware backend
- Collection: fetch paginé (100/page) agrégé côté client; filtrage client; mutations bulk/atomiques → invalidation caches
- Decks: builder fait mutations par carte; ownership overlay par oracleIds; export/import MTGA
- Admin: actions de sync déclenchent jobs backend; affichage logs
- Scan/OCR: caméra → ZXing/Tesseract → recherche/identify → ajout collection

## Déploiement
- Cible: PM2 + Nginx reverse proxy (API `/api`, frontend statique), TLS via Certbot
- .env: secrets JWT, DB path/URL, ports…
- Recommandation: éviter dev proxy en prod; builder le frontend

## Observabilité & Sécurité (actuel)
- Logs consoles simples, pas d’APM/OTel
- Rate limiter, Helmet, admin gating OK
- JWT en localStorage (pas de refresh token)

## Points notables/risques
- Multiples `PrismaClient` instanciés selon services
- Duplication/variantes Scryfall (dont une version “broken”)
- Parsing JSON (prices/imageUris/colors) répété dans de nombreux composants
- Filtres volumineux côté client (collection) → coût mémoire et re-renders
- Heuristique `isExtra` répliquée (backend/frontend)
- OCR/Tesseract sur thread principal (risque UX sur machines modestes)

---

Ce document synthétise l’état actuel pour guider les recommandations et refactors ciblés.
