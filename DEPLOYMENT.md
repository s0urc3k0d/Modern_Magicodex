# 🚀 Magicodex - Guide de Déploiement Complet

Guide de déploiement de l'application Magicodex sur un serveur Ubuntu/Debian vierge avec **Node.js**, **PM2**, **PostgreSQL**, et **Nginx** en reverse proxy avec HTTPS.

---

## 📋 Table des matières

1. [Architecture de déploiement](#1-architecture-de-déploiement)
2. [Prérequis serveur](#2-prérequis-serveur)
3. [Installation des dépendances système](#3-installation-des-dépendances-système)
4. [Configuration PostgreSQL](#4-configuration-postgresql)
5. [Déploiement de l'application](#5-déploiement-de-lapplication)
6. [Configuration PM2](#6-configuration-pm2)
7. [Configuration Nginx](#7-configuration-nginx)
8. [Configuration HTTPS avec Certbot](#8-configuration-https-avec-certbot)
9. [Variables d'environnement](#9-variables-denvironnement)
10. [Scripts de maintenance](#10-scripts-de-maintenance)
11. [Monitoring et logs](#11-monitoring-et-logs)
12. [Sauvegarde et restauration](#12-sauvegarde-et-restauration)
13. [Mise à jour de l'application](#13-mise-à-jour-de-lapplication)
14. [Dépannage](#14-dépannage)
15. [Checklist de déploiement](#15-checklist-de-déploiement)

---

## 1. Architecture de déploiement

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼ (port 443 HTTPS)
┌─────────────────────────────────────────────────────────────────┐
│                        NGINX                                     │
│  - Reverse proxy                                                 │
│  - Certificat SSL (Let's Encrypt)                               │
│  - Compression gzip                                              │
│  - Cache fichiers statiques                                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  /api/*         │  │  /              │  │  /api/docs      │
│  Backend API    │  │  Frontend SPA   │  │  Swagger UI     │
│  (port 3001)    │  │  (fichiers      │  │  (port 3001)    │
│                 │  │   statiques)    │  │                 │
└────────┬────────┘  └─────────────────┘  └─────────────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
│   (port 5432)   │
└─────────────────┘
```

**Résumé :**
- **Nginx** écoute sur les ports 80 (redirigé vers 443) et 443
- Les requêtes `/api/*` sont proxifiées vers le backend Node.js (port 3001)
- Les fichiers statiques du frontend sont servis directement par Nginx
- **PM2** gère le processus Node.js avec redémarrage automatique
- **PostgreSQL** stocke toutes les données utilisateur

---

## 2. Prérequis serveur

### Configuration minimale recommandée
- **OS** : Ubuntu 22.04 LTS ou Debian 12
- **CPU** : 2 vCPU
- **RAM** : 2 Go minimum (4 Go recommandé)
- **Stockage** : 20 Go SSD
- **Réseau** : IP publique statique

### Accès requis
- Accès SSH avec sudo
- Nom de domaine pointant vers l'IP du serveur (pour HTTPS)
- Ports 22 (SSH), 80 (HTTP), 443 (HTTPS) ouverts

---

## 3. Installation des dépendances système

### 3.1 Connexion au serveur et mise à jour

```bash
# Connexion SSH
ssh user@votre-serveur

# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des outils de base
sudo apt install -y curl wget git build-essential software-properties-common
```

### 3.2 Installation de Node.js (LTS v20.x)

```bash
# Ajout du dépôt NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Installation de Node.js
sudo apt install -y nodejs

# Vérification
node -v  # Devrait afficher v20.x.x
npm -v   # Devrait afficher 10.x.x
```

### 3.3 Installation de PM2

```bash
# Installation globale de PM2
sudo npm install -g pm2

# Configuration du démarrage automatique
pm2 startup systemd
# Suivre les instructions affichées (copier/coller la commande sudo)

# Vérification
pm2 -v
```

### 3.4 Installation de Nginx

```bash
# Installation
sudo apt install -y nginx

# Démarrage et activation au boot
sudo systemctl start nginx
sudo systemctl enable nginx

# Vérification
sudo systemctl status nginx
```

### 3.5 Installation de PostgreSQL

```bash
# Installation de PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Démarrage et activation
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Vérification
sudo systemctl status postgresql
psql --version
```

### 3.6 Installation de Certbot (pour HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## 4. Configuration PostgreSQL

### 4.1 Création de l'utilisateur et de la base de données

```bash
# Connexion en tant qu'utilisateur postgres
sudo -u postgres psql
```

Dans le shell PostgreSQL :

```sql
-- Créer l'utilisateur (remplacez 'motdepasse_securise' par un vrai mot de passe)
CREATE USER magicodex WITH PASSWORD 'motdepasse_securise';

-- Créer la base de données
CREATE DATABASE magicodex_prod OWNER magicodex;

-- Accorder tous les privilèges
GRANT ALL PRIVILEGES ON DATABASE magicodex_prod TO magicodex;

-- Connexion à la base pour accorder les privilèges sur le schéma
\c magicodex_prod

-- Accorder les privilèges sur le schéma public
GRANT ALL ON SCHEMA public TO magicodex;

-- Quitter
\q
```

### 4.2 Configuration de l'authentification

```bash
# Éditer la configuration d'authentification
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

Ajouter cette ligne (avant les autres règles `local`) :

```
# Magicodex application
local   magicodex_prod    magicodex                         scram-sha-256
host    magicodex_prod    magicodex    127.0.0.1/32         scram-sha-256
```

```bash
# Redémarrer PostgreSQL
sudo systemctl restart postgresql
```

### 4.3 Test de connexion

```bash
psql -U magicodex -d magicodex_prod -h localhost
# Entrer le mot de passe quand demandé
# Taper \q pour quitter
```

---

## 5. Déploiement de l'application

### 5.1 Création du répertoire de l'application

```bash
# Créer le répertoire de l'application
sudo mkdir -p /var/www/magicodex
sudo chown -R $USER:$USER /var/www/magicodex
```

### 5.2 Clonage du projet

```bash
cd /var/www/magicodex

# Option A: Depuis Git
git clone https://github.com/votre-repo/magicodex.git .

# Option B: Upload via SCP depuis votre machine locale
# Sur votre machine Windows (PowerShell):
# scp -r C:\DEV\magicodex\* user@serveur:/var/www/magicodex/

# Option C: Upload via rsync (plus rapide pour les mises à jour)
# rsync -avz --exclude 'node_modules' --exclude '.git' -e ssh ./ user@serveur:/var/www/magicodex/
```

### 5.3 Configuration des variables d'environnement

```bash
# Créer le fichier .env pour le backend
nano /var/www/magicodex/backend/.env
```

Contenu du fichier `.env` :

```env
# === Base de données ===
DATABASE_URL="postgresql://magicodex:motdepasse_securise@localhost:5432/magicodex_prod?schema=public"

# === JWT ===
# Générer avec: openssl rand -base64 64
JWT_SECRET="VOTRE_CLE_SECRETE_TRES_LONGUE_ET_ALEATOIRE"

# === Serveur ===
PORT=3001
NODE_ENV=production

# === URLs ===
FRONTEND_URL=https://magicodex.votre-domaine.com

# === Rate Limiting ===
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
```

**Important** : Générer un vrai JWT_SECRET :

```bash
openssl rand -base64 64
```

### 5.4 Installation des dépendances et build

```bash
# Backend
cd /var/www/magicodex/backend
npm ci --production=false  # Inclut les devDependencies pour le build
npm run build
npm prune --production     # Supprime les devDependencies après le build

# Frontend
cd /var/www/magicodex/frontend
npm ci
npm run build
```

### 5.5 Migration de la base de données

```bash
cd /var/www/magicodex/backend

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations en production
npx prisma migrate deploy

# (Optionnel) Vérifier la base de données
npx prisma studio
```

### 5.6 Vérification des permissions

```bash
# Donner les permissions correctes
sudo chown -R www-data:www-data /var/www/magicodex
sudo chmod -R 755 /var/www/magicodex

# Le fichier .env doit être lisible par l'application
sudo chmod 640 /var/www/magicodex/backend/.env
sudo chown www-data:www-data /var/www/magicodex/backend/.env
```

---

## 6. Configuration PM2

### 6.1 Fichier de configuration PM2

Créer le fichier `/var/www/magicodex/ecosystem.config.cjs` :

```bash
nano /var/www/magicodex/ecosystem.config.cjs
```

```javascript
module.exports = {
  apps: [
    {
      name: 'magicodex-api',
      cwd: '/var/www/magicodex/backend',
      script: 'dist/server.js',
      instances: 'max',  // Utilise tous les CPU disponibles (mode cluster)
      exec_mode: 'cluster',
      
      // Variables d'environnement
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      
      // Gestion des logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/magicodex/error.log',
      out_file: '/var/log/magicodex/out.log',
      merge_logs: true,
      
      // Gestion de la mémoire
      max_memory_restart: '500M',
      
      // Redémarrage automatique
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 1000,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};
```

### 6.2 Création du répertoire de logs

```bash
sudo mkdir -p /var/log/magicodex
sudo chown -R www-data:www-data /var/log/magicodex
```

### 6.3 Démarrage de l'application

```bash
cd /var/www/magicodex

# Démarrer l'application
pm2 start ecosystem.config.cjs

# Sauvegarder la configuration PM2
pm2 save

# Vérifier le statut
pm2 status
pm2 logs magicodex-api
```

### 6.4 Commandes PM2 utiles

```bash
# Voir le statut
pm2 status

# Voir les logs en temps réel
pm2 logs magicodex-api

# Voir les 100 dernières lignes de logs
pm2 logs magicodex-api --lines 100

# Redémarrer l'application
pm2 restart magicodex-api

# Recharger sans downtime (0-downtime reload)
pm2 reload magicodex-api

# Arrêter l'application
pm2 stop magicodex-api

# Supprimer l'application de PM2
pm2 delete magicodex-api

# Monitoring en temps réel
pm2 monit

# Informations détaillées
pm2 show magicodex-api
```

---

## 7. Configuration Nginx

### 7.1 Création du fichier de configuration

```bash
sudo nano /etc/nginx/sites-available/magicodex
```

```nginx
# Configuration Nginx pour Magicodex
# Remplacez 'magicodex.votre-domaine.com' par votre domaine

# Redirection HTTP vers HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name magicodex.votre-domaine.com;
    
    # Redirection permanente vers HTTPS
    return 301 https://$server_name$request_uri;
}

# Serveur HTTPS principal
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name magicodex.votre-domaine.com;

    # === Certificats SSL (sera configuré par Certbot) ===
    # Ces lignes seront ajoutées automatiquement par certbot
    # ssl_certificate /etc/letsencrypt/live/magicodex.votre-domaine.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/magicodex.votre-domaine.com/privkey.pem;
    # include /etc/letsencrypt/options-ssl-nginx.conf;
    # ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # === Sécurité HTTP Headers ===
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Content Security Policy (adapté pour Scryfall)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cards.scryfall.io https://svgs.scryfall.io; font-src 'self'; connect-src 'self' https://api.scryfall.com;" always;

    # === Logs ===
    access_log /var/log/nginx/magicodex_access.log;
    error_log /var/log/nginx/magicodex_error.log;

    # === Compression Gzip ===
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/json
        application/xml
        application/xml+rss
        image/svg+xml;

    # === Fichiers statiques du frontend ===
    root /var/www/magicodex/frontend/dist;
    index index.html;

    # Cache pour les assets statiques (JS, CSS, images)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # === API Backend ===
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        
        # Headers pour le proxy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (si nécessaire à l'avenir)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Taille max des requêtes (pour upload d'images, import bulk)
        client_max_body_size 10M;
    }

    # === Health check endpoint ===
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    # === SPA Fallback ===
    # Toutes les autres routes sont gérées par le frontend React
    location / {
        try_files $uri $uri/ /index.html;
    }

    # === Sécurité: bloquer l'accès aux fichiers sensibles ===
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ ^/(\.env|package\.json|tsconfig\.json|node_modules) {
        deny all;
    }
}
```

### 7.2 Activation du site

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/magicodex /etc/nginx/sites-enabled/

# Supprimer la configuration par défaut
sudo rm -f /etc/nginx/sites-enabled/default

# Tester la configuration
sudo nginx -t

# Si le test est OK, recharger Nginx
sudo systemctl reload nginx
```

---

## 8. Configuration HTTPS avec Certbot

### 8.1 Obtention du certificat SSL

**Note** : Assurez-vous que votre domaine pointe bien vers l'IP du serveur avant cette étape.

```bash
# Obtenir le certificat (remplacez par votre domaine et email)
sudo certbot --nginx -d magicodex.votre-domaine.com --email votre@email.com --agree-tos --non-interactive
```

Ou en mode interactif :

```bash
sudo certbot --nginx -d magicodex.votre-domaine.com
```

Suivre les instructions :
1. Entrer votre email
2. Accepter les conditions
3. Choisir si vous voulez partager votre email
4. Certbot modifiera automatiquement la config Nginx

### 8.2 Vérification du certificat

```bash
# Vérifier les certificats installés
sudo certbot certificates

# Tester le renouvellement automatique
sudo certbot renew --dry-run
```

### 8.3 Renouvellement automatique

Certbot configure automatiquement un timer systemd pour le renouvellement. Vérifier :

```bash
sudo systemctl list-timers | grep certbot
```

---

## 9. Variables d'environnement

### 9.1 Fichier .env complet pour la production

```env
# ==================================================
# MAGICODEX - Configuration Production
# ==================================================

# === Base de données PostgreSQL ===
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA
DATABASE_URL="postgresql://magicodex:VOTRE_MOT_DE_PASSE@localhost:5432/magicodex_prod?schema=public"

# === Authentification JWT ===
# IMPORTANT: Générer une clé unique avec: openssl rand -base64 64
# Ne JAMAIS utiliser la même clé en dev et en prod
JWT_SECRET="VOTRE_CLE_SECRETE_64_CARACTERES_MINIMUM_GENEREE_ALEATOIREMENT"

# === Configuration serveur ===
PORT=3001
NODE_ENV=production

# === URLs ===
# URL du frontend pour CORS
FRONTEND_URL=https://magicodex.votre-domaine.com

# === Rate Limiting ===
# Fenêtre en millisecondes (60000 = 1 minute)
RATE_LIMIT_WINDOW=60000
# Nombre max de requêtes par fenêtre par IP
RATE_LIMIT_MAX=100
```

### 9.2 Génération sécurisée du JWT_SECRET

```bash
# Sur Linux/Mac
openssl rand -base64 64

# Alternative
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### 9.3 Sécurisation du fichier .env

```bash
# Permissions restrictives (lisible uniquement par le propriétaire)
chmod 600 /var/www/magicodex/backend/.env

# Vérifier que le fichier n'est pas versionné dans Git
cat /var/www/magicodex/.gitignore | grep .env
# Doit contenir: .env ou backend/.env
```

---

## 10. Scripts de maintenance

### 10.1 Script de déploiement automatisé

Créer `/var/www/magicodex/scripts/deploy.sh` :

```bash
#!/bin/bash
set -e

# ============================================
# Script de déploiement Magicodex
# ============================================

APP_DIR="/var/www/magicodex"
BACKUP_DIR="/var/backups/magicodex"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/magicodex/deploy_$DATE.log"

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "🚀 Démarrage du déploiement Magicodex"

# 1. Sauvegarde de la base de données
log "📦 Sauvegarde de la base de données..."
mkdir -p $BACKUP_DIR
sudo -u postgres pg_dump magicodex_prod | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"
log "   Sauvegarde créée: $BACKUP_DIR/db_$DATE.sql.gz"

# 2. Pull des dernières modifications
log "📥 Récupération du code depuis Git..."
cd $APP_DIR
git fetch origin
git reset --hard origin/main
log "   Code mis à jour"

# 3. Backend: Installation et build
log "📚 Installation des dépendances backend..."
cd $APP_DIR/backend
npm ci --production=false
log "   Build du backend..."
npm run build
log "   Nettoyage des devDependencies..."
npm prune --production

# 4. Migration de la base de données
log "🗃️ Migration de la base de données..."
npx prisma generate
npx prisma migrate deploy
log "   Migrations appliquées"

# 5. Frontend: Installation et build
log "🎨 Build du frontend..."
cd $APP_DIR/frontend
npm ci
npm run build
log "   Frontend compilé"

# 6. Mise à jour des permissions
log "🔒 Mise à jour des permissions..."
sudo chown -R www-data:www-data $APP_DIR
sudo chmod -R 755 $APP_DIR
sudo chmod 600 $APP_DIR/backend/.env

# 7. Redémarrage de l'application (zero-downtime)
log "🔄 Rechargement de l'application..."
cd $APP_DIR
pm2 reload ecosystem.config.cjs --update-env
log "   Application rechargée"

# 8. Vérification du health check
log "✅ Vérification du health check..."
sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$HEALTH" = "200" ]; then
    log "   Health check OK (HTTP 200)"
else
    log "❌ Health check FAILED (HTTP $HEALTH)"
    log "   Rollback peut être nécessaire!"
    exit 1
fi

# 9. Nettoyage des anciennes sauvegardes (garder 7 jours)
log "🧹 Nettoyage des anciennes sauvegardes..."
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

log "🎉 Déploiement terminé avec succès!"
log "   Durée: $SECONDS secondes"

# Afficher le statut PM2
pm2 status
```

```bash
# Rendre le script exécutable
chmod +x /var/www/magicodex/scripts/deploy.sh

# Créer le dossier scripts s'il n'existe pas
mkdir -p /var/www/magicodex/scripts
```

### 10.2 Script de rollback

Créer `/var/www/magicodex/scripts/rollback.sh` :

```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/magicodex"

echo "📋 Sauvegardes disponibles:"
echo "=========================="
ls -lh $BACKUP_DIR/*.sql.gz 2>/dev/null | tail -10

if [ -z "$(ls -A $BACKUP_DIR/*.sql.gz 2>/dev/null)" ]; then
    echo "❌ Aucune sauvegarde trouvée dans $BACKUP_DIR"
    exit 1
fi

echo ""
echo "Entrez le nom du fichier de sauvegarde (ex: db_20251125_030000.sql.gz):"
read BACKUP_FILE

FULL_PATH="$BACKUP_DIR/$BACKUP_FILE"

if [ ! -f "$FULL_PATH" ]; then
    echo "❌ Fichier non trouvé: $FULL_PATH"
    exit 1
fi

echo ""
echo "⚠️  ATTENTION: Vous allez restaurer la base de données depuis:"
echo "   $FULL_PATH"
echo ""
echo "Cette action va ÉCRASER toutes les données actuelles!"
echo ""
read -p "Êtes-vous sûr de vouloir continuer? (tapez 'oui' pour confirmer): " CONFIRM

if [ "$CONFIRM" != "oui" ]; then
    echo "Annulé."
    exit 0
fi

echo "🔄 Arrêt de l'application..."
pm2 stop magicodex-api

echo "🔄 Restauration en cours..."
gunzip -c "$FULL_PATH" | sudo -u postgres psql magicodex_prod

echo "🔄 Redémarrage de l'application..."
pm2 start magicodex-api

echo "✅ Restauration terminée!"
pm2 status
```

### 10.3 Script de health check automatique

Créer `/var/www/magicodex/scripts/healthcheck.sh` :

```bash
#!/bin/bash

API_URL="http://localhost:3001/health"
LOG_FILE="/var/log/magicodex/healthcheck.log"
MAX_RETRIES=3
RETRY_DELAY=10

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 $API_URL)
    echo $response
}

# Vérification initiale
status=$(check_health)

if [ "$status" = "200" ]; then
    # Tout va bien, pas de log pour éviter la pollution
    exit 0
fi

log "⚠️ Health check failed (HTTP $status), tentative de récupération..."

# Tentatives de récupération
for i in $(seq 1 $MAX_RETRIES); do
    log "   Tentative $i/$MAX_RETRIES: Redémarrage de PM2..."
    pm2 restart magicodex-api
    sleep $RETRY_DELAY
    
    status=$(check_health)
    if [ "$status" = "200" ]; then
        log "✅ Application récupérée après $i tentative(s)"
        exit 0
    fi
done

log "❌ CRITIQUE: L'application ne répond pas après $MAX_RETRIES tentatives!"
log "   Intervention manuelle requise."

# Optionnel: Envoyer une notification (décommenter et configurer)
# curl -X POST -H 'Content-type: application/json' \
#     --data '{"text":"🚨 ALERTE: Magicodex API DOWN!"}' \
#     "VOTRE_WEBHOOK_SLACK_OU_DISCORD"

exit 1
```

Ajouter au cron :

```bash
# Éditer le crontab
crontab -e

# Ajouter (vérification toutes les 5 minutes)
*/5 * * * * /var/www/magicodex/scripts/healthcheck.sh
```

### 10.4 Script de sauvegarde automatique

Créer `/var/www/magicodex/scripts/backup.sh` :

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/magicodex"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
LOG_FILE="/var/log/magicodex/backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# Création du répertoire si nécessaire
mkdir -p $BACKUP_DIR

# Sauvegarde
log "📦 Démarrage de la sauvegarde..."
sudo -u postgres pg_dump magicodex_prod | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Vérification
if [ -f "$BACKUP_DIR/db_$DATE.sql.gz" ]; then
    SIZE=$(ls -lh "$BACKUP_DIR/db_$DATE.sql.gz" | awk '{print $5}')
    log "✅ Sauvegarde créée: db_$DATE.sql.gz ($SIZE)"
else
    log "❌ Échec de la sauvegarde!"
    exit 1
fi

# Suppression des anciennes sauvegardes
log "🧹 Nettoyage des sauvegardes > $RETENTION_DAYS jours..."
DELETED=$(find $BACKUP_DIR -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
log "   $DELETED fichier(s) supprimé(s)"

# Statistiques
TOTAL=$(ls $BACKUP_DIR/*.sql.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh $BACKUP_DIR | awk '{print $1}')
log "📊 Total: $TOTAL sauvegardes, $TOTAL_SIZE utilisés"
```

Ajouter au cron (sauvegarde quotidienne à 3h) :

```bash
crontab -e

# Ajouter
0 3 * * * /var/www/magicodex/scripts/backup.sh
```

---

## 11. Monitoring et logs

### 11.1 Visualisation des logs

```bash
# Logs PM2 (application) en temps réel
pm2 logs magicodex-api

# Logs PM2 avec timestamp
pm2 logs magicodex-api --timestamp

# Dernières 200 lignes
pm2 logs magicodex-api --lines 200

# Logs d'erreur uniquement
pm2 logs magicodex-api --err

# Logs Nginx - accès
sudo tail -f /var/log/nginx/magicodex_access.log

# Logs Nginx - erreurs
sudo tail -f /var/log/nginx/magicodex_error.log

# Logs PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Logs système
journalctl -u nginx -f
journalctl -u postgresql -f
```

### 11.2 Monitoring PM2

```bash
# Dashboard temps réel (CPU, mémoire, requêtes)
pm2 monit

# Informations détaillées sur l'application
pm2 show magicodex-api

# Métriques JSON (pour scripts)
pm2 jlist

# Status rapide
pm2 status
```

### 11.3 Configuration Logrotate

Créer `/etc/logrotate.d/magicodex` :

```bash
sudo nano /etc/logrotate.d/magicodex
```

```
/var/log/magicodex/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs 2>/dev/null || true
    endscript
}
```

### 11.4 Commandes utiles de diagnostic

```bash
# Utilisation CPU/RAM
htop

# Espace disque
df -h

# Utilisation mémoire
free -h

# Processus Node.js
ps aux | grep node

# Connexions réseau
ss -tlnp | grep -E '(3001|5432|80|443)'

# Connexions actives à PostgreSQL
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname='magicodex_prod';"

# Taille de la base de données
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('magicodex_prod'));"
```

---

## 12. Sauvegarde et restauration

### 12.1 Sauvegarde manuelle

```bash
# Sauvegarde de la base de données
sudo -u postgres pg_dump magicodex_prod > /var/backups/magicodex/manual_backup.sql

# Sauvegarde compressée
sudo -u postgres pg_dump magicodex_prod | gzip > /var/backups/magicodex/manual_backup.sql.gz

# Sauvegarde du code (si modifications locales)
tar -czvf /var/backups/magicodex/code_backup.tar.gz -C /var/www magicodex --exclude='node_modules'
```

### 12.2 Restauration

```bash
# Restauration depuis un fichier SQL
sudo -u postgres psql magicodex_prod < /var/backups/magicodex/manual_backup.sql

# Restauration depuis un fichier compressé
gunzip -c /var/backups/magicodex/manual_backup.sql.gz | sudo -u postgres psql magicodex_prod

# Si vous devez recréer la base de données
sudo -u postgres psql -c "DROP DATABASE magicodex_prod;"
sudo -u postgres psql -c "CREATE DATABASE magicodex_prod OWNER magicodex;"
gunzip -c /var/backups/magicodex/backup.sql.gz | sudo -u postgres psql magicodex_prod
```

### 12.3 Sauvegarde distante (optionnel)

Pour une sauvegarde sur un serveur distant ou S3 :

```bash
# Vers un serveur distant via SCP
scp /var/backups/magicodex/db_*.sql.gz user@backup-server:/backups/magicodex/

# Vers AWS S3 (nécessite aws-cli configuré)
aws s3 cp /var/backups/magicodex/db_$(date +%Y%m%d).sql.gz s3://votre-bucket/magicodex/
```

---

## 13. Mise à jour de l'application

### 13.1 Mise à jour standard

```bash
# Utiliser le script de déploiement
/var/www/magicodex/scripts/deploy.sh
```

### 13.2 Mise à jour manuelle étape par étape

```bash
cd /var/www/magicodex

# 1. Sauvegarder la base
sudo -u postgres pg_dump magicodex_prod | gzip > /var/backups/magicodex/pre_update_$(date +%Y%m%d_%H%M%S).sql.gz

# 2. Récupérer le code
git fetch origin
git reset --hard origin/main

# 3. Mettre à jour le backend
cd backend
npm ci --production=false
npm run build
npx prisma generate
npx prisma migrate deploy
npm prune --production

# 4. Mettre à jour le frontend
cd ../frontend
npm ci
npm run build

# 5. Corriger les permissions
cd ..
sudo chown -R www-data:www-data /var/www/magicodex
sudo chmod -R 755 /var/www/magicodex

# 6. Recharger l'application (zero-downtime)
pm2 reload ecosystem.config.cjs

# 7. Vérifier
pm2 status
curl http://localhost:3001/health
```

### 13.3 Mise à jour des dépendances système

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Mise à jour de Node.js (si nécessaire)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Reconstruire les modules natifs
cd /var/www/magicodex/backend
npm rebuild

# Redémarrer
pm2 restart magicodex-api
```

---

## 14. Dépannage

### 14.1 L'application ne démarre pas

```bash
# 1. Vérifier les logs PM2
pm2 logs magicodex-api --lines 100

# 2. Vérifier que le port n'est pas utilisé
sudo lsof -i :3001

# 3. Vérifier les variables d'environnement
cat /var/www/magicodex/backend/.env

# 4. Tester le démarrage manuel
cd /var/www/magicodex/backend
NODE_ENV=production node dist/server.js

# 5. Vérifier les permissions
ls -la /var/www/magicodex/backend/

# 6. Vérifier que le build existe
ls -la /var/www/magicodex/backend/dist/
```

### 14.2 Erreurs de base de données

```bash
# 1. Vérifier que PostgreSQL fonctionne
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT 1"

# 2. Vérifier que la base existe
sudo -u postgres psql -c "\l" | grep magicodex

# 3. Vérifier les permissions utilisateur
sudo -u postgres psql -c "\du" | grep magicodex

# 4. Tester la connexion avec les credentials de l'app
psql "postgresql://magicodex:VOTRE_MOT_DE_PASSE@localhost:5432/magicodex_prod"

# 5. Vérifier la DATABASE_URL dans .env
grep DATABASE_URL /var/www/magicodex/backend/.env

# 6. Regénérer le client Prisma
cd /var/www/magicodex/backend
npx prisma generate
```

### 14.3 Erreurs Nginx (502 Bad Gateway, 504 Timeout)

```bash
# 1. Vérifier que l'API répond localement
curl http://localhost:3001/health

# 2. Vérifier la configuration Nginx
sudo nginx -t

# 3. Vérifier les logs Nginx
sudo tail -50 /var/log/nginx/magicodex_error.log

# 4. Vérifier que Nginx écoute
sudo ss -tlnp | grep nginx

# 5. Recharger Nginx
sudo systemctl reload nginx
```

### 14.4 Erreurs SSL/HTTPS

```bash
# 1. Vérifier le certificat
sudo certbot certificates

# 2. Renouveler si expiré
sudo certbot renew

# 3. Vérifier la configuration SSL
openssl s_client -connect magicodex.votre-domaine.com:443 -servername magicodex.votre-domaine.com

# 4. Vérifier les dates d'expiration
echo | openssl s_client -connect magicodex.votre-domaine.com:443 2>/dev/null | openssl x509 -noout -dates
```

### 14.5 Problèmes de performance

```bash
# 1. Monitoring général
htop

# 2. Mémoire utilisée par Node
pm2 show magicodex-api | grep memory

# 3. Requêtes lentes PostgreSQL (nécessite pg_stat_statements)
sudo -u postgres psql -d magicodex_prod -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# 4. Nombre de connexions actives
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='magicodex_prod';"

# 5. Taille des tables
sudo -u postgres psql -d magicodex_prod -c "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;"
```

### 14.6 Problèmes de mémoire

```bash
# Si l'application consomme trop de mémoire:
# 1. Vérifier la configuration PM2 (max_memory_restart)
cat /var/www/magicodex/ecosystem.config.cjs

# 2. Réduire le nombre d'instances si nécessaire
pm2 scale magicodex-api 2  # Réduire à 2 instances

# 3. Redémarrer pour libérer la mémoire
pm2 restart magicodex-api
```

---

## 15. Checklist de déploiement

### ✅ Avant le déploiement

- [ ] Serveur accessible en SSH
- [ ] Nom de domaine configuré (DNS A record → IP serveur)
- [ ] Ports 22, 80, 443 ouverts dans le firewall
- [ ] Accès sudo disponible
- [ ] Sauvegarde de l'ancienne version (si mise à jour)

### ✅ Installation système

- [ ] Système mis à jour (`apt update && apt upgrade`)
- [ ] Node.js v20.x installé (`node -v`)
- [ ] npm installé (`npm -v`)
- [ ] PM2 installé (`pm2 -v`)
- [ ] PM2 configuré au démarrage (`pm2 startup`)
- [ ] PostgreSQL installé et démarré
- [ ] Nginx installé et démarré
- [ ] Certbot installé

### ✅ Configuration base de données

- [ ] Utilisateur PostgreSQL `magicodex` créé
- [ ] Base de données `magicodex_prod` créée
- [ ] Permissions accordées à l'utilisateur
- [ ] `pg_hba.conf` configuré
- [ ] Test de connexion réussi

### ✅ Déploiement application

- [ ] Code cloné dans `/var/www/magicodex`
- [ ] Fichier `.env` créé avec les bonnes valeurs
- [ ] `JWT_SECRET` généré et unique
- [ ] `DATABASE_URL` correcte
- [ ] Dépendances backend installées (`npm ci`)
- [ ] Backend compilé (`npm run build`)
- [ ] Client Prisma généré (`npx prisma generate`)
- [ ] Migrations appliquées (`npx prisma migrate deploy`)
- [ ] Dépendances frontend installées
- [ ] Frontend compilé (`npm run build`)
- [ ] Permissions fichiers correctes (`chown www-data`)

### ✅ Configuration PM2

- [ ] `ecosystem.config.cjs` créé
- [ ] Répertoire `/var/log/magicodex` créé
- [ ] Application démarrée (`pm2 start`)
- [ ] Configuration sauvegardée (`pm2 save`)
- [ ] Health check local OK (`curl localhost:3001/health`)

### ✅ Configuration Nginx

- [ ] Fichier de configuration créé dans `sites-available`
- [ ] Lien symbolique créé dans `sites-enabled`
- [ ] Configuration par défaut supprimée
- [ ] Configuration testée (`nginx -t`)
- [ ] Nginx rechargé (`systemctl reload nginx`)

### ✅ HTTPS

- [ ] Certificat SSL obtenu via Certbot
- [ ] Redirection HTTP → HTTPS active
- [ ] Test HTTPS réussi (accès via navigateur)
- [ ] Renouvellement automatique configuré (`certbot renew --dry-run`)

### ✅ Post-déploiement

- [ ] Application accessible publiquement
- [ ] Inscription/Connexion fonctionnelle
- [ ] Documentation API accessible (`/api/docs`)
- [ ] Scripts de maintenance créés et exécutables
- [ ] Sauvegarde automatique configurée (cron)
- [ ] Health check automatique configuré (cron)
- [ ] Logrotate configuré

---

## 📞 Commandes de référence rapide

```bash
# === PM2 ===
pm2 status                    # Statut de l'application
pm2 logs magicodex-api       # Logs en temps réel
pm2 restart magicodex-api    # Redémarrer
pm2 reload magicodex-api     # Reload sans downtime
pm2 monit                    # Dashboard monitoring

# === Nginx ===
sudo nginx -t                 # Tester la configuration
sudo systemctl reload nginx   # Recharger la configuration
sudo systemctl restart nginx  # Redémarrer Nginx

# === PostgreSQL ===
sudo -u postgres psql         # Console PostgreSQL
sudo systemctl status postgresql

# === Logs ===
pm2 logs magicodex-api --lines 100
sudo tail -f /var/log/nginx/magicodex_error.log

# === Déploiement ===
/var/www/magicodex/scripts/deploy.sh

# === Sauvegarde ===
/var/www/magicodex/scripts/backup.sh
```

---

**Document créé le** : 25 novembre 2025  
**Version** : 2.0.0  
**Stack** : Node.js 20 + Express 5 + PostgreSQL 15 + PM2 + Nginx + Let's Encrypt
