# Modern Magicodex - Cahier des charges

## Vue d'ensemble
Application web moderne pour la gestion de collections et decks Magic: The Gathering avec une interface intuitive et fluide respectant l'univers visuel de MTG.

## Fonctionnalités principales

### 🔐 Authentification
- Register / Login sécurisé
- Gestion des sessions utilisateurs
- Panel administrateur pour la gestion des utilisateurs

### 📚 Gestion de bibliothèque/collection
- Interface simple et intuitive
- Informations pratiques rapidement accessibles :
  - Nombre de cartes possédées avec pourcentages
  - Distinction classique/foil
  - Nombre d'exemplaires par carte
  - Organisation par extension avec blocs expand/collapse
  - Statistiques de collection en temps réel
  - Recherche et filtres avancés
  - Visualisation par rareté, couleur, type

### 🃏 Création de decks
- Interface de construction intuitive
- Informations utiles en temps réel :
  - Graphique des couleurs présentes
  - Répartition créatures/sorts/terrains/planeswalkers
  - Courbe de mana
  - Autofill des terrains selon les couleurs
- Import/Export format MTGA
- Modes de création :
  - Cartes limitées à la collection
  - Mode libre (toutes cartes)
- Types de decks supportés :
  - Standard, Commander, Modern, Legacy, etc.
- Archétypes : Aggro, Control, Midrange, Combo
- Validation de légalité automatique

### 🔌 Intégration API Scryfall
- Récupération optimisée des données (pagination, cache)
- Données en français avec fallback anglais
- Mise à jour automatique des traductions françaises
- Déclenchement manuel depuis le panel admin
- Synchronisation périodique des nouvelles cartes/extensions

### ⚙️ Panel administrateur
- Gestion des utilisateurs
- Déclenchement des synchronisations API
- Monitoring des performances
- Statistiques d'utilisation

## Stack technique recommandée

### Frontend
- **React 18** avec TypeScript
- **Vite** pour le build
- **Tailwind CSS** pour le styling
- **Framer Motion** pour les animations
- **React Query** pour la gestion des données
- **React Hook Form** pour les formulaires
- **Chart.js** pour les graphiques

### Backend
- **Node.js** avec **Express**
- **TypeScript**
- **Prisma** pour l'ORM
- **PostgreSQL** pour la base de données
- **JWT** pour l'authentification
- **Zod** pour la validation
- **Node-cron** pour les tâches planifiées

### Outils de développement
- **ESLint** + **Prettier**
- **Husky** pour les git hooks
- **Jest** pour les tests

## Architecture

```
modern-magicodex/
├── frontend/              # Application React
├── backend/               # API Express
├── shared/                # Types partagés
├── docs/                  # Documentation
└── database/              # Migrations et seeds
```

## Base de données

### Tables principales
- `users` - Utilisateurs
- `sets` - Extensions MTG
- `cards` - Cartes MTG
- `user_cards` - Collection utilisateur
- `decks` - Decks utilisateur
- `deck_cards` - Cartes dans les decks

## Design et UX
- Palette de couleurs inspirée de MTG (noir, or, couleurs de mana)
- Interface responsive
- Animations fluides
- Icônes de mana officielles
- Mode sombre/clair

## Performance et optimisation
- Pagination intelligente
- Cache Redis pour les données fréquentes
- Lazy loading des images
- Optimisation des requêtes base de données
- CDN pour les assets statiques

## Sécurité
- Validation côté client et serveur
- Protection CSRF
- Rate limiting sur l'API
- Hashage des mots de passe (bcrypt)
- Variables d'environnement pour les secrets

## Déploiement
- Variables d'environnement pour la configuration
- Scripts de migration de base de données
- Monitoring des erreurs
- Logs structurés
