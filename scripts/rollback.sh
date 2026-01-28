#!/bin/bash

# ============================================
# Script de restauration de base de données
# Usage: ./rollback.sh
# ============================================

BACKUP_DIR="/var/backups/magicodex"
DB_NAME="magicodex_prod"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "========================================"
echo "🔄 Restauration de base de données"
echo "========================================"
echo ""

# Vérifier que des sauvegardes existent
if [ -z "$(ls -A $BACKUP_DIR/*.sql.gz 2>/dev/null)" ]; then
    echo -e "${RED}❌ Aucune sauvegarde trouvée dans $BACKUP_DIR${NC}"
    exit 1
fi

# Lister les sauvegardes disponibles
echo "📋 Sauvegardes disponibles:"
echo "=========================="
ls -lht $BACKUP_DIR/db_*.sql.gz 2>/dev/null | head -15 | nl
echo ""

# Demander le fichier à restaurer
echo "Entrez le numéro de la sauvegarde à restaurer (ou le nom complet du fichier):"
read INPUT

# Si c'est un numéro, récupérer le fichier correspondant
if [[ "$INPUT" =~ ^[0-9]+$ ]]; then
    BACKUP_FILE=$(ls -t $BACKUP_DIR/db_*.sql.gz 2>/dev/null | sed -n "${INPUT}p")
else
    BACKUP_FILE="$BACKUP_DIR/$INPUT"
fi

# Vérifier que le fichier existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Fichier non trouvé: $BACKUP_FILE${NC}"
    exit 1
fi

# Afficher les informations sur la sauvegarde
echo ""
echo "📦 Sauvegarde sélectionnée:"
ls -lh "$BACKUP_FILE"
echo ""

# Confirmation
echo -e "${YELLOW}⚠️  ATTENTION: Cette action va ÉCRASER toutes les données actuelles!${NC}"
echo ""
echo "Tapez 'RESTAURER' pour confirmer:"
read CONFIRM

if [ "$CONFIRM" != "RESTAURER" ]; then
    echo "Annulé."
    exit 0
fi

echo ""
echo "🔄 Arrêt de l'application..."
pm2 stop magicodex-api

echo "🔄 Création d'une sauvegarde de sécurité..."
SAFETY_BACKUP="$BACKUP_DIR/pre_rollback_$(date +%Y%m%d_%H%M%S).sql.gz"
sudo -u postgres pg_dump $DB_NAME | gzip > "$SAFETY_BACKUP"
echo "   Sauvegarde de sécurité: $SAFETY_BACKUP"

echo "🔄 Restauration en cours..."
if gunzip -c "$BACKUP_FILE" | sudo -u postgres psql $DB_NAME; then
    echo -e "${GREEN}✅ Restauration terminée${NC}"
else
    echo -e "${RED}❌ Erreur lors de la restauration${NC}"
    echo "   La sauvegarde de sécurité est disponible: $SAFETY_BACKUP"
fi

echo "🔄 Redémarrage de l'application..."
pm2 start magicodex-api

echo ""
echo "========================================"
echo -e "${GREEN}✅ Processus terminé${NC}"
echo "========================================"
pm2 status
