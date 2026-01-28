#!/bin/bash

# ============================================
# Script de health check automatique
# Usage: ./healthcheck.sh
# Ajouter au cron: */5 * * * * /var/www/magicodex/scripts/healthcheck.sh
# ============================================

API_URL="http://localhost:3001/health"
LOG_FILE="/var/log/magicodex/healthcheck.log"
MAX_RETRIES=3
RETRY_DELAY=10

# Optionnel: URL de webhook pour notifications (Slack, Discord, etc.)
WEBHOOK_URL=""

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# Fonction de notification
notify() {
    if [ -n "$WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$1\"}" \
            "$WEBHOOK_URL" > /dev/null 2>&1
    fi
}

# Fonction de vérification
check_health() {
    curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL" 2>/dev/null
}

# Vérification initiale
status=$(check_health)

if [ "$status" = "200" ]; then
    # Tout va bien, sortie silencieuse
    exit 0
fi

# Problème détecté
log "⚠️ Health check failed (HTTP $status)"

# Tentatives de récupération
for i in $(seq 1 $MAX_RETRIES); do
    log "   Tentative $i/$MAX_RETRIES: Redémarrage de l'application..."
    
    pm2 restart magicodex-api > /dev/null 2>&1
    sleep $RETRY_DELAY
    
    status=$(check_health)
    if [ "$status" = "200" ]; then
        log "✅ Application récupérée après $i tentative(s)"
        notify "✅ Magicodex: Application récupérée après redémarrage automatique"
        exit 0
    fi
done

# Échec après toutes les tentatives
log "❌ CRITIQUE: L'application ne répond pas après $MAX_RETRIES tentatives!"
notify "🚨 ALERTE CRITIQUE: Magicodex API ne répond pas! Intervention manuelle requise."

exit 1
