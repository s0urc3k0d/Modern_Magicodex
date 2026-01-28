# 🎮 Modern Magicodex

Une application web moderne pour la gestion de votre collection Magic: The Gathering et la création de decks.

## ✨ Fonctionnalités

### 🔐 Authentification
- Inscription et connexion sécurisées
- Gestion de session avec JWT
- Protection des routes

### 📚 Gestion de Collection
- Interface intuitive pour gérer votre collection
- Informations pratiques rapidement accessibles :
  - Nombre de cartes possédées avec pourcentages
  - Distinction classique/foil
  - Nombre d'exemplaires par carte
  - Extensions organisées par blocs expand/collapse

### 🃏 Création de Decks
- Interface simple et intuitive
- Informations utiles en temps réel :
  - Graphique des couleurs présentes
  - Répartition créatures/sorts/terrains
  - Courbe de mana
  - Auto-completion des terrains selon les couleurs
- Import/Export format MTGA

### 🌍 Intégration Scryfall
- Synchronisation automatique des cartes
- Support français/anglais
- Base de données complète Magic

### 👨‍💻 Panel Administrateur
- Gestion des utilisateurs
- Synchronisation manuelle Scryfall
- Statistiques globales

## 🛠️ Stack Technique

### Backend
- **Node.js** avec **Express**
- **TypeScript** pour la sécurité des types
- **Prisma ORM** avec **SQLite** (par défaut) ou PostgreSQL
- **JWT** pour l'authentification
- **Scryfall API** pour les données Magic

### Frontend
- **React 18** avec **TypeScript**
- **Vite** pour le build rapide
- **Tailwind CSS** avec thème Magic
- **React Query** pour la gestion des données
- **React Router** pour la navigation
- **Framer Motion** pour les animations

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 18+
- npm ou yarn

### Configuration rapide

1. **Installation des dépendances :**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

2. **Configuration de la base de données :**
```bash
cd backend
# Créer le fichier .env (SQLite par défaut)
cp .env.example .env
# Appliquer les migrations
npx prisma migrate dev
```

3. **Démarrage en développement :**
```bash
# Option 1 : Script automatique (recommandé)
./start-dev.sh

# Option 2 : Démarrage manuel
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

4. **Accès à l'application :**
- Frontend : http://localhost:5173
- Backend API : http://localhost:3001 (via proxy /api côté frontend)

## 📁 Structure du Projet

```
Modern_Magicodex/
├── backend/                 # API Node.js/Express
│   ├── src/
│   │   ├── routes/         # Routes API
│   │   ├── middleware/     # Middlewares Express
│   │   ├── services/       # Services (Scryfall, etc.)
│   │   └── server.ts       # Point d'entrée
│   ├── prisma/
│   │   └── schema.prisma   # Schéma base de données
│   └── package.json
├── frontend/               # Application React
│   ├── src/
│   │   ├── components/     # Composants réutilisables
│   │   ├── pages/          # Pages principales
│   │   ├── hooks/          # Hooks personnalisés
│   │   ├── services/       # Services API
│   │   └── App.tsx         # Point d'entrée React
│   └── package.json
└── start-dev.sh           # Script de démarrage
```

## 🔧 Configuration

### Variables d'environnement Backend (.env)
```env
DATABASE_URL="file:./dev.db"           # SQLite par défaut
JWT_SECRET="votre-secret-jwt-super-securise"
PORT=3001
NODE_ENV=development
```

### Base de données
Le schéma Prisma inclut :
- **Users** : Gestion des utilisateurs
- **Sets** : Extensions Magic
- **Cards** : Cartes avec support multilingue
- **UserCards** : Collection des utilisateurs
- **Decks** : Decks des utilisateurs
- **DeckCards** : Composition des decks

## 🎯 Utilisation

### Première connexion
1. Créez un compte via l'interface d'inscription
2. Connectez-vous avec vos identifiants
3. L'application synchronisera automatiquement les données Scryfall

### Gestion de collection
- Ajoutez des cartes à votre collection
- Visualisez vos statistiques
- Filtrez par extension, couleur, type

### Création de decks
- Créez un nouveau deck
- Ajoutez des cartes depuis votre collection
- Visualisez les statistiques en temps réel
- Exportez au format MTGA

## 🔄 Synchronisation Scryfall

L'application se synchronise automatiquement avec Scryfall pour :
- Nouvelles extensions
- Mises à jour de cartes
- Traductions françaises
- Images et données

## 🐛 Dépannage

### Ports déjà utilisés
Si les ports 3000 ou 5173 sont occupés :
```bash
# Trouver le processus utilisant le port
lsof -i :3000
lsof -i :5173

# Tuer le processus si nécessaire
kill -9 <PID>
```

### Base de données
```bash
# Réinitialiser la base de données
cd backend
npx prisma migrate reset

# Régénérer le client Prisma
npx prisma generate
```

### Cache npm
```bash
# Nettoyer le cache npm
npm cache clean --force

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

## 📊 Monitoring

### Logs de développement
- Backend : Console avec timestamps et niveaux
- Frontend : Console du navigateur + React Developer Tools

### Base de données
```bash
# Accès direct à la base
cd backend
npx prisma studio
```

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature
3. Committez vos changes
4. Pushez vers la branche
5. Ouvrez une Pull Request

## 📄 Licence

Le fichier LICENSE actuel est sous GPLv3. Si vous souhaitez utiliser MIT à la place, remplacez le fichier et mettez à jour cette section en conséquence.

## 🙏 Remerciements

- [Scryfall](https://scryfall.com/) pour leur excellente API
- La communauté Magic: The Gathering
- Les contributeurs open source

---

**Happy Gaming! 🎮✨** 🃏

Une application web moderne pour la gestion de collections et decks Magic: The Gathering, conçue avec des technologies de pointe et une interface utilisateur intuitive respectant l'univers visuel de MTG.

## 🌟 Fonctionnalités

### ✅ Fonctionnalités implémentées
- **Architecture moderne** : Stack complète React + Node.js + TypeScript
- **Interface utilisateur** : Design moderne avec Tailwind CSS et thème MTG
- **Structure de base** : Authentification, routing, layout responsif
- **Base de données** : Schéma Prisma optimisé pour MTG
- **API Scryfall** : Service d'intégration pour récupérer les données de cartes

### 🚧 En cours de développement
- **Système d'authentification** : Register/Login sécurisé
- **Gestion de collection** : Interface intuitive avec statistiques avancées
- **Constructeur de decks** : Création de decks avec analyses en temps réel
- **Panel d'administration** : Gestion utilisateurs et synchronisation API
- **Synchronisation Scryfall** : Import automatique des cartes et traductions françaises

### 🎯 Fonctionnalités prévues
- **Collection avancée** :
  - Gestion par extension avec blocs expand/collapse
  - Suivi des exemplaires (classique/foil)
  - Statistiques détaillées (pourcentages, valeur, completion)
  - Recherche et filtres puissants

- **Constructeur de decks** :
  - Interface drag & drop intuitive
  - Graphiques des couleurs en temps réel
  - Courbe de mana et analyses statistiques
  - Autofill des terrains selon les couleurs
  - Import/Export format MTGA
  - Support multi-formats (Standard, Commander, Modern, etc.)
  - Validation de légalité automatique

## 🛠️ Technologies utilisées

### Frontend
- **React 18** avec TypeScript
- **Vite** pour le build rapide
- **Tailwind CSS** pour le styling
- **Framer Motion** pour les animations
- **React Query** pour la gestion des données
- **React Hook Form** + **Zod** pour les formulaires
- **React Router** pour la navigation
- **Chart.js** pour les graphiques

### Backend
- **Node.js** avec **Express**
- **TypeScript** pour la sécurité des types
- **Prisma** comme ORM avec PostgreSQL
- **JWT** pour l'authentification
- **Bcrypt** pour le hashage des mots de passe
- **Express Rate Limit** pour la protection
- **Node-cron** pour les tâches planifiées

### Base de données
- **PostgreSQL** comme base de données principale
- **Prisma** pour les migrations et modèles
- Schéma optimisé pour les données Magic: The Gathering

## 🚀 Installation et démarrage

### Prérequis
- Node.js 18+ et npm
- PostgreSQL 14+
- Git

### Configuration de la base de données
1. Installez PostgreSQL
2. Créez une nouvelle base de données :
   ```sql
   CREATE DATABASE modern_magicodex;
   ```

### Installation du backend
```bash
cd backend
npm install

# Copiez et configurez les variables d'environnement
cp .env.example .env

# Éditez le fichier .env avec vos paramètres de base de données
# DATABASE_URL="postgresql://username:password@localhost:5432/modern_magicodex"

# Générez le client Prisma et appliquez les migrations
npm run prisma:generate
npm run prisma:migrate

# Démarrez le serveur de développement
npm run dev
```

### Installation du frontend
```bash
cd frontend
npm install

# Copiez et configurez les variables d'environnement
cp .env.example .env

# Démarrez le serveur de développement
npm run dev
```

### Accès à l'application
- **Frontend** : http://localhost:5173
- **Backend API** : http://localhost:3001
- **Prisma Studio** : `npm run prisma:studio` (depuis le dossier backend)

## 📁 Structure du projet

```
Modern_Magicodex/
├── frontend/                 # Application React
│   ├── src/
│   │   ├── components/      # Composants réutilisables
│   │   ├── pages/          # Pages de l'application
│   │   ├── contexts/       # Contextes React (Auth, etc.)
│   │   ├── services/       # Services API
│   │   ├── hooks/          # Hooks personnalisés
│   │   ├── types/          # Types TypeScript
│   │   └── utils/          # Utilitaires
│   │   ├── public/             # Assets statiques
│   └── package.json
├── backend/                  # API Express
│   ├── src/
│   │   ├── routes/         # Routes API
│   │   ├── controllers/    # Contrôleurs
│   │   ├── services/       # Services métier
│   │   ├── middleware/     # Middlewares Express
│   │   └── utils/          # Utilitaires
│   ├── prisma/
│   │   └── schema.prisma   # Schéma de base de données
│   └── package.json
├── shared/                   # Types et utilitaires partagés
└── docs/                    # Documentation
```

## 🎨 Design et UX

L'interface respecte l'identité visuelle de Magic: The Gathering :
- **Palette de couleurs** : Noir, or, couleurs de mana
- **Typographie** : Police Beleren pour les titres MTG
- **Iconographie** : Symboles de mana officiels
- **Animations** : Transitions fluides avec Framer Motion
- **Responsive** : Interface adaptative mobile/desktop

## 🔧 Scripts disponibles

### Backend
```bash
npm run dev          # Démarrage en mode développement
npm run build        # Build pour la production
npm run start        # Démarrage en production
npm run prisma:generate  # Génération du client Prisma
npm run prisma:migrate   # Application des migrations
npm run prisma:studio    # Interface Prisma Studio
```

### Frontend
```bash
npm run dev          # Démarrage en mode développement
npm run build        # Build pour la production
npm run preview      # Aperçu du build de production
npm run lint         # Vérification ESLint
```

## 🔐 Sécurité

- **Authentification JWT** avec refresh tokens
- **Hashage bcrypt** pour les mots de passe
- **Rate limiting** sur les endpoints sensibles
- **Validation** côté client et serveur avec Zod
- **Protection CORS** configurée
- **Headers de sécurité** avec Helmet

## 🌐 API Scryfall

L'application utilise l'API Scryfall pour :
- Récupération des données d'extensions
- Import des cartes avec images
- Traductions françaises automatiques
- Mise à jour périodique des prix
- Validation de légalité des formats

## 📈 Performance

- **Lazy loading** des images de cartes
- **Pagination** intelligente des listes
- **Cache** optimisé avec React Query
- **Optimisation** des requêtes Prisma
- **CDN** pour les assets statiques

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Fork le projet
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est sous licence ISC. Voir le fichier `LICENSE` pour plus de détails.

## 🙏 Remerciements

- **Scryfall** pour leur API exceptionnelle
- **Wizards of the Coast** pour Magic: The Gathering
- La communauté open source pour les outils utilisés

---

**Modern Magicodex** - Gérez votre passion pour Magic: The Gathering avec style ! ✨