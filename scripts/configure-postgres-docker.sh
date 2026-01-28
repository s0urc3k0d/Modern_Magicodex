#!/bin/bash
# =============================================================================
# Script de configuration PostgreSQL pour Docker
# =============================================================================
# Ce script configure PostgreSQL sur le VPS pour accepter les connexions
# depuis les conteneurs Docker.
#
# Usage: sudo ./scripts/configure-postgres-docker.sh
# =============================================================================

set -e

echo "🔧 Configuration de PostgreSQL pour Docker..."

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Trouver la version de PostgreSQL
PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
PG_CONF_DIR="/etc/postgresql/${PG_VERSION}/main"

if [ ! -d "$PG_CONF_DIR" ]; then
    echo -e "${RED}❌ Répertoire PostgreSQL non trouvé: $PG_CONF_DIR${NC}"
    echo "Versions disponibles:"
    ls /etc/postgresql/
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL version ${PG_VERSION} trouvé${NC}"

# 1. Configurer postgresql.conf pour écouter sur toutes les interfaces
# (ou au moins sur l'interface Docker)
PG_CONF="${PG_CONF_DIR}/postgresql.conf"

echo "📝 Modification de $PG_CONF..."

# Backup
sudo cp "$PG_CONF" "${PG_CONF}.backup.$(date +%Y%m%d)"

# Vérifier si listen_addresses est déjà configuré
if grep -q "^listen_addresses" "$PG_CONF"; then
    echo -e "${YELLOW}⚠ listen_addresses déjà configuré${NC}"
    grep "^listen_addresses" "$PG_CONF"
else
    # Ajouter listen_addresses pour Docker
    echo "" | sudo tee -a "$PG_CONF"
    echo "# Ajouté pour Docker" | sudo tee -a "$PG_CONF"
    echo "listen_addresses = 'localhost,172.17.0.1'" | sudo tee -a "$PG_CONF"
    echo -e "${GREEN}✓ listen_addresses configuré${NC}"
fi

# 2. Configurer pg_hba.conf pour autoriser les connexions Docker
PG_HBA="${PG_CONF_DIR}/pg_hba.conf"

echo "📝 Modification de $PG_HBA..."

# Backup
sudo cp "$PG_HBA" "${PG_HBA}.backup.$(date +%Y%m%d)"

# Vérifier si la règle Docker existe déjà
if grep -q "172.17.0.0/16" "$PG_HBA"; then
    echo -e "${YELLOW}⚠ Règle Docker déjà présente${NC}"
else
    # Ajouter la règle pour le réseau Docker
    echo "" | sudo tee -a "$PG_HBA"
    echo "# Connexions depuis Docker" | sudo tee -a "$PG_HBA"
    echo "host    all    all    172.17.0.0/16    md5" | sudo tee -a "$PG_HBA"
    echo -e "${GREEN}✓ Règle Docker ajoutée${NC}"
fi

# 3. Redémarrer PostgreSQL
echo "🔄 Redémarrage de PostgreSQL..."
sudo systemctl restart postgresql

# 4. Vérifier le statut
if sudo systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✓ PostgreSQL redémarré avec succès${NC}"
else
    echo -e "${RED}❌ Erreur au redémarrage de PostgreSQL${NC}"
    sudo systemctl status postgresql
    exit 1
fi

# 5. Afficher les informations de connexion
echo ""
echo "============================================="
echo -e "${GREEN}✅ Configuration terminée !${NC}"
echo "============================================="
echo ""
echo "📋 Pour votre fichier .env Docker, utilisez:"
echo ""
echo "  DATABASE_URL=postgresql://USER:PASSWORD@host.docker.internal:5432/DATABASE"
echo ""
echo "  Ou si host.docker.internal ne fonctionne pas:"
echo ""
echo "  DATABASE_URL=postgresql://USER:PASSWORD@172.17.0.1:5432/DATABASE"
echo ""
echo "============================================="
echo ""

# 6. Test de connexion depuis Docker (optionnel)
echo "🧪 Test de connexion..."
if command -v docker &> /dev/null; then
    docker run --rm --add-host=host.docker.internal:host-gateway postgres:16-alpine \
        pg_isready -h host.docker.internal -p 5432 -U postgres 2>/dev/null && \
        echo -e "${GREEN}✓ Connexion depuis Docker OK${NC}" || \
        echo -e "${YELLOW}⚠ Test échoué - vérifiez la configuration${NC}"
fi
