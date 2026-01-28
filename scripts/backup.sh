#!/bin/bash

# ============================================
# Script de sauvegarde automatique PostgreSQL
# Usage: ./backup.sh
# Ajouter au cron: 0 3 * * * /var/www/magicodex/scripts/backup.sh
# ============================================

BACKUP_DIR="/var/backups/magicodex"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
LOG_FILE="/var/log/magicodex/backup.log"
DB_NAME="magicodex_prod"

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Création du répertoire si nécessaire
mkdir -p $BACKUP_DIR
mkdir -p /var/log/magicodex

log "📦 Démarrage de la sauvegarde..."

# Sauvegarde de la base de données
BACKUP_FILE="$BACKUP_DIR/db_$DATE.sql.gz"
if sudo -u postgres pg_dump $DB_NAME | gzip > "$BACKUP_FILE"; then
    SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    log "✅ Sauvegarde créée: db_$DATE.sql.gz ($SIZE)"
else
    log "❌ Échec de la sauvegarde!"
    exit 1
fi

# Vérification de l'intégrité (test de décompression)
if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
    log "   Intégrité vérifiée ✓"
else
    log "⚠️  Attention: Le fichier de sauvegarde pourrait être corrompu"
fi

# Suppression des anciennes sauvegardes
log "🧹 Nettoyage des sauvegardes > $RETENTION_DAYS jours..."
DELETED=$(find $BACKUP_DIR -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
log "   $DELETED fichier(s) supprimé(s)"

# Statistiques
TOTAL=$(ls $BACKUP_DIR/db_*.sql.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh $BACKUP_DIR 2>/dev/null | awk '{print $1}')
log "📊 Total: $TOTAL sauvegardes, $TOTAL_SIZE utilisés"

# Liste des dernières sauvegardes
log "📋 Dernières sauvegardes:"
ls -lht $BACKUP_DIR/db_*.sql.gz 2>/dev/null | head -5 | while read line; do
    log "   $line"
done
