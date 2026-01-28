#!/bin/bash
set -e

# ============================================
# Script de déploiement Magicodex
# Usage: ./deploy.sh
# ============================================

APP_DIR="/var/www/magicodex"
BACKUP_DIR="/var/backups/magicodex"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/magicodex/deploy_$DATE.log"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de logging
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${BLUE}${message}${NC}"
    echo "$message" >> $LOG_FILE
}

log_success() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1"
    echo -e "${GREEN}${message}${NC}"
    echo "$message" >> $LOG_FILE
}

log_error() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1"
    echo -e "${RED}${message}${NC}"
    echo "$message" >> $LOG_FILE
}

log_warning() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1"
    echo -e "${YELLOW}${message}${NC}"
    echo "$message" >> $LOG_FILE
}

# Création des répertoires si nécessaire
mkdir -p $BACKUP_DIR
mkdir -p /var/log/magicodex

echo ""
echo "========================================"
echo "🚀 Déploiement Magicodex"
echo "   Date: $(date)"
echo "========================================"
echo ""

# 1. Sauvegarde de la base de données
log "📦 Sauvegarde de la base de données..."
if sudo -u postgres pg_dump magicodex_prod | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"; then
    BACKUP_SIZE=$(ls -lh "$BACKUP_DIR/db_$DATE.sql.gz" | awk '{print $5}')
    log_success "Sauvegarde créée: db_$DATE.sql.gz ($BACKUP_SIZE)"
else
    log_error "Échec de la sauvegarde de la base de données!"
    exit 1
fi

# 2. Pull des dernières modifications
log "📥 Récupération du code depuis Git..."
cd $APP_DIR
if git fetch origin && git reset --hard origin/main; then
    COMMIT=$(git rev-parse --short HEAD)
    log_success "Code mis à jour (commit: $COMMIT)"
else
    log_error "Échec de la récupération du code!"
    exit 1
fi

# 3. Backend: Installation et build
log "📚 Installation des dépendances backend..."
cd $APP_DIR/backend
npm ci --production=false

log "🔨 Build du backend..."
if npm run build; then
    log_success "Backend compilé"
else
    log_error "Échec du build backend!"
    exit 1
fi

# 4. Migration de la base de données
log "🗃️ Migration de la base de données..."
npx prisma generate
if npx prisma migrate deploy; then
    log_success "Migrations appliquées"
else
    log_warning "Pas de nouvelles migrations ou erreur"
fi

# Nettoyage des devDependencies
log "🧹 Nettoyage des devDependencies..."
npm prune --production

# 5. Frontend: Installation et build
log "🎨 Build du frontend..."
cd $APP_DIR/frontend
npm ci
if npm run build; then
    log_success "Frontend compilé"
else
    log_error "Échec du build frontend!"
    exit 1
fi

# 6. Mise à jour des permissions
log "🔒 Mise à jour des permissions..."
sudo chown -R www-data:www-data $APP_DIR
sudo chmod -R 755 $APP_DIR
sudo chmod 600 $APP_DIR/backend/.env
log_success "Permissions mises à jour"

# 7. Redémarrage de l'application (zero-downtime)
log "🔄 Rechargement de l'application..."
cd $APP_DIR
if pm2 reload ecosystem.config.cjs --update-env; then
    log_success "Application rechargée"
else
    log_error "Échec du rechargement PM2!"
    exit 1
fi

# 8. Vérification du health check
log "🏥 Vérification du health check..."
sleep 3

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:3001/health)

if [ "$HEALTH_STATUS" = "200" ]; then
    log_success "Health check OK (HTTP 200)"
else
    log_error "Health check FAILED (HTTP $HEALTH_STATUS)"
    log_warning "Vérifiez les logs: pm2 logs magicodex-api"
    exit 1
fi

# 9. Nettoyage des anciennes sauvegardes (garder 7 jours)
log "🧹 Nettoyage des anciennes sauvegardes..."
DELETED=$(find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete -print | wc -l)
log "   $DELETED ancienne(s) sauvegarde(s) supprimée(s)"

# Résumé final
echo ""
echo "========================================"
echo -e "${GREEN}🎉 Déploiement terminé avec succès!${NC}"
echo "   Durée: $SECONDS secondes"
echo "   Commit: $COMMIT"
echo "   Sauvegarde: db_$DATE.sql.gz"
echo "========================================"
echo ""

# Afficher le statut PM2
pm2 status
