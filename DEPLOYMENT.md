# 🚀 Magicodex - Guide de Déploiement Complet

Guide de déploiement de l'application Magicodex sur un serveur Ubuntu/Debian avec **Docker**, **PostgreSQL** (existant sur VPS), et **Nginx** en reverse proxy avec HTTPS.

> **Note** : Ce guide suppose que vous avez déjà PostgreSQL et Nginx installés sur votre VPS. L'application et Redis tournent dans des conteneurs Docker.

---

## 📋 Table des matières

1. [Architecture de déploiement](#1-architecture-de-déploiement)
2. [Prérequis serveur](#2-prérequis-serveur)
3. [Installation de Docker](#3-installation-de-docker)
4. [Configuration PostgreSQL](#4-configuration-postgresql)
5. [Déploiement Docker](#5-déploiement-docker)
6. [Configuration Nginx](#6-configuration-nginx)
7. [Configuration HTTPS avec Certbot](#7-configuration-https-avec-certbot)
8. [Monitoring et logs](#8-monitoring-et-logs)
9. [Sauvegarde et restauration](#9-sauvegarde-et-restauration)
10. [Mise à jour de l'application](#10-mise-à-jour-de-lapplication)
11. [Dépannage](#11-dépannage)
12. [Checklist de déploiement](#12-checklist-de-déploiement)
13. [Déploiement PM2 (alternative sans Docker)](#13-déploiement-pm2-alternative-sans-docker)

---

## 1. Architecture de déploiement

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼ (port 443 HTTPS)
┌─────────────────────────────────────────────────────────────────┐
│                     NGINX (sur le VPS)                           │
│  - Reverse proxy                                                 │
│  - Certificat SSL (Let's Encrypt)                               │
│  - Compression gzip                                              │
│  - Sert les fichiers statiques du frontend                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  /api/*         │  │  /              │  │  /api/metrics   │
│  Backend API    │  │  Frontend SPA   │  │  Prometheus     │
│  (Docker:3001)  │  │  (fichiers      │  │  (Docker:3001)  │
│                 │  │   statiques)    │  │                 │
└────────┬────────┘  └─────────────────┘  └─────────────────┘
         │
┌────────┴─────────────────────────────────────────┐
│                 DOCKER COMPOSE                    │
│  ┌─────────────┐          ┌─────────────┐        │
│  │  Backend    │◄────────►│   Redis     │        │
│  │  Node.js    │          │   Cache     │        │
│  │  :3001      │          │   :6379     │        │
│  └──────┬──────┘          └─────────────┘        │
└─────────┼────────────────────────────────────────┘
          │
          ▼ (host.docker.internal)
┌─────────────────┐
│   PostgreSQL    │
│   (VPS:5432)    │
│   existant      │
└─────────────────┘
```

**Résumé - Ports utilisés :**
| Service | Port | Localisation | Usage |
|---------|------|--------------|-------|
| Nginx | 80, 443 | VPS | Reverse proxy HTTPS |
| Backend API | 3001 | Docker → VPS | API Node.js |
| PostgreSQL | 5432 | VPS | Base de données (existante) |
| Redis | 6379 | Docker (interne) | Cache |

> ⚠️ **Important** : Redis n'est pas exposé sur le VPS, il reste interne au réseau Docker. Seul le port 3001 est exposé en local (`127.0.0.1:3001`).

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

### Services existants sur le VPS
- **PostgreSQL** : Base de données existante (port 5432)
- **Nginx** : Reverse proxy existant (ports 80, 443)

---

## 3. Installation de Docker

### 3.1 Connexion au serveur et mise à jour

```bash
# Connexion SSH
ssh user@votre-serveur

# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des outils de base
sudo apt install -y curl wget git
```

### 3.2 Installation de Docker

```bash
# Installation via le script officiel
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter l'utilisateur au groupe docker (évite d'utiliser sudo)
sudo usermod -aG docker $USER

# Se déconnecter et reconnecter pour appliquer les changements
exit
# Puis se reconnecter en SSH
```

### 3.3 Installation de Docker Compose

```bash
# Docker Compose est inclus avec Docker Engine depuis la v20.10
# Vérification
docker compose version

# Si non disponible, installer le plugin
sudo apt install -y docker-compose-plugin
```

### 3.4 Vérification de l'installation

```bash
# Vérifier Docker
docker --version
docker run hello-world

# Vérifier Docker Compose
docker compose version
```

### 3.5 Installation de Certbot (pour HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## 4. Configuration PostgreSQL

> **Note** : Si PostgreSQL est déjà configuré sur votre VPS, passez à l'étape 4.3 pour autoriser les connexions depuis Docker.

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

Ajouter ces lignes (avant les autres règles `local`) :

```
# Magicodex application (local et Docker)
local   magicodex_prod    magicodex                         scram-sha-256
host    magicodex_prod    magicodex    127.0.0.1/32         scram-sha-256
# Autoriser les connexions depuis Docker (réseau docker0)
host    magicodex_prod    magicodex    172.17.0.0/16        scram-sha-256
host    magicodex_prod    magicodex    172.18.0.0/16        scram-sha-256
```

### 4.3 Configuration pour accepter les connexions réseau

```bash
# Éditer la configuration principale
sudo nano /etc/postgresql/15/main/postgresql.conf
```

Modifier la ligne `listen_addresses` :

```conf
# Écouter sur localhost ET l'interface Docker
listen_addresses = 'localhost,172.17.0.1'
```

```bash
# Redémarrer PostgreSQL
sudo systemctl restart postgresql
```

### 4.4 Test de connexion

```bash
psql -U magicodex -d magicodex_prod -h localhost
# Entrer le mot de passe quand demandé
# Taper \q pour quitter
```

---

## 5. Déploiement Docker

### 5.1 Clonage du projet

```bash
# Créer le répertoire de l'application
sudo mkdir -p /var/www/magicodex
sudo chown -R $USER:$USER /var/www/magicodex

cd /var/www/magicodex

# Cloner depuis Git
git clone https://github.com/s0urc3k0d/Modern_Magicodex.git .
```

### 5.2 Configuration des variables d'environnement

```bash
# Créer le fichier .env pour Docker
cp docker/.env.example docker/.env
nano docker/.env
```

Contenu du fichier `docker/.env` :

```env
# ==================================================
# MAGICODEX - Configuration Docker Production
# ==================================================

# === Base de données (PostgreSQL sur le VPS) ===
# Utiliser l'IP de l'interface docker0 du VPS (172.17.0.1 sur Linux)
DATABASE_URL=postgresql://magicodex:VOTRE_MOT_DE_PASSE@172.17.0.1:5432/magicodex_prod

# === JWT (générer avec: openssl rand -base64 64) ===
JWT_SECRET=VOTRE_CLE_SECRETE_TRES_LONGUE_ET_ALEATOIRE
JWT_REFRESH_SECRET=AUTRE_CLE_SECRETE_POUR_REFRESH_TOKENS

# === URLs ===
FRONTEND_URL=https://magicodex.votre-domaine.com

# === Scryfall API (optionnel) ===
SCRYFALL_DELAY_MS=100
```

**Important** : Générer les secrets JWT :

```bash
# JWT Secret (access tokens)
openssl rand -base64 64

# JWT Refresh Secret (refresh tokens)
openssl rand -base64 64
```

> **Note** : Les variables `PORT`, `NODE_ENV` et `REDIS_URL` sont déjà définies dans le `docker-compose.yml`, inutile de les dupliquer dans `.env`.

### 5.3 Trouver l'IP de l'interface Docker

```bash
# L'IP est généralement 172.17.0.1
ip addr show docker0 | grep inet

# Ou utiliser host.docker.internal (si supporté)
# Dans docker-compose.yml, ajouter:
# extra_hosts:
#   - "host.docker.internal:host-gateway"
```

### 5.4 Build et démarrage des conteneurs

```bash
cd /var/www/magicodex

# Build des images
docker compose build

# Démarrage en mode détaché
docker compose up -d

# Vérifier que les conteneurs tournent
docker compose ps

# Voir les logs
docker compose logs -f
```

### 5.5 Vérification du déploiement

```bash
# Vérifier que l'API répond
curl http://localhost:3001/api/health/live
# Réponse attendue: {"status":"ok","timestamp":"..."}

# Vérifier les services (DB + Redis)
curl http://localhost:3001/api/health/ready
# Réponse attendue: {"status":"ok","services":{"database":"ok","redis":"ok"},...}
```

### 5.6 Configuration du démarrage automatique

Docker Compose redémarre automatiquement les conteneurs grâce à `restart: unless-stopped`.

Pour s'assurer que Docker démarre au boot :

```bash
sudo systemctl enable docker
```

### 5.7 Build du frontend

Le frontend est servi par Nginx, pas par Docker :

```bash
cd /var/www/magicodex/frontend

# Installer les dépendances
npm ci

# Build de production
npm run build

# Les fichiers sont dans frontend/dist/
```

---

## 6. Configuration Nginx

### 6.1 Version AVANT Certbot (HTTP uniquement)

Cette configuration permet d'obtenir le certificat SSL via Certbot. Certbot modifiera ensuite automatiquement ce fichier.

```bash
sudo nano /etc/nginx/sites-available/magicodex
```

```nginx
# Configuration Nginx pour Magicodex - AVANT CERTBOT
# Cette version est utilisée pour obtenir le certificat SSL

server {
    listen 80;
    listen [::]:80;
    server_name magicodex.sourcekod.fr www.magicodex.sourcekod.fr;

    # === Logs ===
    access_log /var/log/nginx/magicodex_access.log;
    error_log /var/log/nginx/magicodex_error.log;

    # === Fichiers statiques du frontend ===
    root /var/www/magicodex/frontend/dist;
    index index.html;

    # Cache pour les assets statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # === API Backend ===
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
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
    location / {
        try_files $uri $uri/ /index.html;
    }

    # === Sécurité ===
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

### 6.2 Activation du site

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

## 7. Configuration HTTPS avec Certbot

### 7.1 Obtention du certificat SSL

**Note** : Assurez-vous que votre domaine pointe bien vers l'IP du serveur avant cette étape.

```bash
# Obtenir le certificat (avec www et sans www)
sudo certbot --nginx -d magicodex.sourcekod.fr -d www.magicodex.sourcekod.fr --email votre@email.com --agree-tos --non-interactive
```

Ou en mode interactif :

```bash
sudo certbot --nginx -d magicodex.sourcekod.fr -d www.magicodex.sourcekod.fr
```

Suivre les instructions :
1. Entrer votre email
2. Accepter les conditions
3. Choisir si vous voulez partager votre email
4. Certbot modifiera automatiquement la config Nginx

### 7.2 Version APRÈS Certbot (HTTPS complet)

Après l'exécution de Certbot, remplacez entièrement le fichier par cette version complète et optimisée :

```bash
sudo nano /etc/nginx/sites-available/magicodex
```

```nginx
# Configuration Nginx pour Magicodex - VERSION COMPLÈTE avec HTTPS

# Redirection HTTP vers HTTPS + www vers non-www
server {
    listen 80;
    listen [::]:80;
    server_name magicodex.sourcekod.fr www.magicodex.sourcekod.fr;

    # Redirection permanente vers HTTPS (domaine principal)
    return 301 https://magicodex.sourcekod.fr$request_uri;
}

# Redirection www vers non-www en HTTPS
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;

    server_name www.magicodex.sourcekod.fr;

    ssl_certificate /etc/letsencrypt/live/magicodex.sourcekod.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/magicodex.sourcekod.fr/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://magicodex.sourcekod.fr$request_uri;
}

# Serveur HTTPS principal
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;  # Syntaxe moderne pour HTTP/2

    server_name magicodex.sourcekod.fr;

    # === Certificats SSL (généré par Certbot) ===
    ssl_certificate /etc/letsencrypt/live/magicodex.sourcekod.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/magicodex.sourcekod.fr/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # === Sécurité HTTP Headers ===
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Content Security Policy (adapté pour Scryfall + Google Fonts)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: https://cards.scryfall.io https://svgs.scryfall.io; connect-src 'self' https://api.scryfall.com;" always;

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

Après modification :

```bash
# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

### 7.3 Vérification du certificat

```bash
# Vérifier les certificats installés
sudo certbot certificates

# Tester le renouvellement automatique
sudo certbot renew --dry-run
```

### 7.4 Renouvellement automatique

Certbot configure automatiquement un timer systemd pour le renouvellement. Vérifier :

```bash
sudo systemctl list-timers | grep certbot
```

---

## 8. Monitoring et logs

### 8.1 Endpoints de monitoring intégrés

L'application expose des endpoints de monitoring prêts pour la production :

```
GET /api/health/live     → Vérification de vie (liveness probe)
GET /api/health/ready    → Vérification de disponibilité (readiness probe)
GET /api/metrics         → Métriques Prometheus
```

**Liveness probe** (`/api/health/live`) :
```json
{"status": "ok", "timestamp": "2024-01-01T12:00:00.000Z"}
```

**Readiness probe** (`/api/health/ready`) :
```json
{
  "status": "ok",
  "services": {
    "database": "ok",
    "redis": "ok"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Métriques Prometheus** (`/api/metrics`) - format texte incluant :
- `http_requests_total` - Nombre total de requêtes HTTP
- `http_request_duration_seconds` - Durée des requêtes
- `nodejs_*` - Métriques Node.js (heap, event loop, GC)
- `process_*` - Métriques processus (CPU, mémoire)

### 8.2 Visualisation des logs Docker

```bash
# Logs en temps réel de tous les conteneurs
docker compose logs -f

# Logs du backend uniquement
docker compose logs -f backend

# Dernières 200 lignes
docker compose logs --tail 200 backend

# Logs Nginx (sur le VPS)
sudo tail -f /var/log/nginx/magicodex_access.log
sudo tail -f /var/log/nginx/magicodex_error.log

# Logs PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### 8.3 Intégration Prometheus/Grafana (optionnel)

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'magicodex'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/api/metrics'
    scheme: 'http'
```

### 8.4 Commandes Docker utiles

```bash
# Status des conteneurs
docker compose ps

# Ressources utilisées
docker stats

# Inspecter un conteneur
docker compose exec backend sh

# Vérifier les logs Redis
docker compose exec redis redis-cli INFO stats
```

---

## 9. Sauvegarde et restauration

### 9.1 Sauvegarde de la base de données

```bash
# Créer le répertoire de sauvegarde
sudo mkdir -p /var/backups/magicodex

# Sauvegarde manuelle
sudo -u postgres pg_dump magicodex_prod | gzip > /var/backups/magicodex/db_$(date +%Y%m%d_%H%M%S).sql.gz

# Vérifier la sauvegarde
ls -lh /var/backups/magicodex/
```

### 9.2 Restauration

```bash
# Arrêter les conteneurs
docker compose down

# Restaurer depuis un backup
gunzip -c /var/backups/magicodex/db_YYYYMMDD_HHMMSS.sql.gz | sudo -u postgres psql magicodex_prod

# Redémarrer
docker compose up -d
```

### 9.3 Sauvegarde automatique (cron)

```bash
# Créer le script de backup
cat > /var/www/magicodex/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/magicodex"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
sudo -u postgres pg_dump magicodex_prod | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Garder les 30 derniers jours
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /var/www/magicodex/scripts/backup.sh

# Ajouter au cron (tous les jours à 3h)
(crontab -l 2>/dev/null; echo "0 3 * * * /var/www/magicodex/scripts/backup.sh") | crontab -
```

---

## 10. Mise à jour de l'application

### 10.1 Mise à jour standard

```bash
cd /var/www/magicodex

# 1. Sauvegarder avant la mise à jour
sudo -u postgres pg_dump magicodex_prod | gzip > /var/backups/magicodex/pre_update_$(date +%Y%m%d_%H%M%S).sql.gz

# 2. Récupérer le code
git fetch origin
git reset --hard origin/main

# 3. Rebuild et redémarrage des conteneurs
docker compose down
docker compose build
docker compose up -d

# 4. Vérifier
docker compose ps
curl http://localhost:3001/api/health/ready
```

### 10.2 Appliquer les migrations

```bash
# Les migrations s'appliquent automatiquement au démarrage du conteneur
# Pour les appliquer manuellement :
docker compose exec backend npx prisma migrate deploy
```

### 10.3 Mettre à jour le frontend

```bash
cd /var/www/magicodex/frontend
npm ci
npm run build
# Les fichiers sont servis directement par Nginx
```

---

## 11. Dépannage

### 11.1 L'application ne démarre pas

```bash
# Vérifier les logs Docker
docker compose logs backend

# Vérifier que PostgreSQL accepte les connexions depuis Docker
sudo -u postgres psql -c "SELECT 1;"

# Vérifier les ports
ss -tlnp | grep -E '(3001|5432|6379)'
```

### 11.2 Erreur de connexion à PostgreSQL

```bash
# Vérifier que Docker peut atteindre PostgreSQL
docker compose exec backend sh -c 'nc -zv 172.17.0.1 5432'

# Vérifier pg_hba.conf
sudo cat /etc/postgresql/*/main/pg_hba.conf | grep magicodex

# Vérifier que PostgreSQL écoute sur l'interface Docker
sudo cat /etc/postgresql/*/main/postgresql.conf | grep listen_addresses
```

### 11.3 Redis ne répond pas

```bash
# Vérifier le conteneur Redis
docker compose logs redis
docker compose exec redis redis-cli ping
```

### 11.4 Problèmes de certificat SSL

```bash
# Renouveler manuellement
sudo certbot renew --force-renewal

# Vérifier les certificats
sudo certbot certificates
```

### 11.5 Commandes de diagnostic

```bash
# État des conteneurs
docker compose ps

# Ressources utilisées
docker stats

# Espace disque
df -h

# Taille de la base
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('magicodex_prod'));"

# Connexions réseau
ss -tlnp | grep -E '(3001|5432|6379|80|443)'
```

---

## 12. Checklist de déploiement

### ✅ Prérequis VPS

- [ ] Accès SSH avec sudo
- [ ] PostgreSQL configuré (port 5432)
- [ ] Nginx configuré (ports 80, 443)
- [ ] Ports 22, 80, 443 ouverts

### ✅ Installation

- [ ] Docker installé (`docker --version`)
- [ ] Docker Compose installé (`docker compose version`)
- [ ] Utilisateur ajouté au groupe docker
- [ ] Certbot installé

### ✅ Configuration PostgreSQL

- [ ] Utilisateur `magicodex` créé
- [ ] Base `magicodex_prod` créée
- [ ] `pg_hba.conf` autorise les connexions Docker (172.17.0.0/16)
- [ ] `postgresql.conf` écoute sur 172.17.0.1

### ✅ Déploiement Docker

- [ ] Code cloné dans `/var/www/magicodex`
- [ ] `docker/.env` configuré avec les bonnes valeurs
- [ ] Secrets générés (JWT_SECRET, COOKIE_SECRET)
- [ ] Conteneurs démarrés (`docker compose up -d`)
- [ ] Health check OK (`curl localhost:3001/api/health/ready`)

### ✅ Frontend

- [ ] `npm ci && npm run build` dans `/frontend`
- [ ] Fichiers dans `/var/www/magicodex/frontend/dist/`

### ✅ Configuration Nginx

- [ ] Configuration créée dans `sites-available`
- [ ] Lien symbolique dans `sites-enabled`
- [ ] Test OK (`nginx -t`)
- [ ] Nginx rechargé

### ✅ HTTPS

- [ ] Certificat obtenu via Certbot
- [ ] Redirection HTTP → HTTPS
- [ ] Renouvellement automatique configuré

### ✅ Post-déploiement

- [ ] Application accessible publiquement
- [ ] Authentification fonctionnelle
- [ ] API docs accessible (`/api/docs`)
- [ ] Sauvegarde automatique configurée

---

## 📞 Commandes de référence rapide

```bash
# === Docker ===
docker compose up -d          # Démarrer
docker compose down           # Arrêter
docker compose logs -f        # Logs temps réel
docker compose restart        # Redémarrer
docker compose ps             # Status
docker stats                  # Ressources

# === Mise à jour ===
git pull && docker compose down && docker compose build && docker compose up -d

# === Nginx ===
sudo nginx -t                 # Tester config
sudo systemctl reload nginx   # Recharger

# === PostgreSQL ===
sudo -u postgres psql magicodex_prod

# === Health checks ===
curl http://localhost:3001/api/health/live
curl http://localhost:3001/api/health/ready

# === Logs ===
docker compose logs -f backend
sudo tail -f /var/log/nginx/magicodex_error.log

# === Sauvegarde ===
sudo -u postgres pg_dump magicodex_prod | gzip > backup.sql.gz
```

---

## 13. Annexe : Déploiement PM2 (alternative sans Docker)

Si vous préférez ne pas utiliser Docker, vous pouvez déployer avec PM2. Voir la documentation complète dans [DEPLOYMENT_PM2.md](./DEPLOYMENT_PM2.md) ou consultez l'historique Git pour la version précédente de ce guide.

**Résumé PM2** :
```bash
# Installation
npm install -g pm2
pm2 startup

# Démarrage
pm2 start ecosystem.config.cjs
pm2 save

# Gestion
pm2 status / logs / restart / reload
```

---

**Document mis à jour** : Janvier 2026  
**Version** : 4.0.0 (Docker)  
**Stack** : Docker + PostgreSQL (VPS) + Nginx (VPS) + Redis (Docker) + Let's Encrypt
