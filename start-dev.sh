#!/bin/bash

echo "🎮 Démarrage de Modern Magicodex en mode développement..."

# Fonction pour vérifier si un port est en cours d'utilisation
check_port() {
    if lsof -i :$1 >/dev/null 2>&1; then
        echo "⚠️  Le port $1 est déjà utilisé"
        return 1
    fi
    return 0
}

# Vérification des ports
echo "📡 Vérification des ports..."
check_port 3000 || echo "   Backend sera peut-être sur un autre port"
check_port 5173 || echo "   Frontend sera peut-être sur un autre port"

# Démarrage du backend
echo "🔧 Démarrage du backend..."
cd /workspaces/Modern_Magicodex/backend
npm run dev &
BACKEND_PID=$!

# Attendre un peu avant de démarrer le frontend
sleep 2

# Démarrage du frontend
echo "⚛️  Démarrage du frontend..."
cd /workspaces/Modern_Magicodex/frontend
npm run dev &
FRONTEND_PID=$!

echo "🚀 Serveurs démarrés !"
echo "   Backend : http://localhost:3000"
echo "   Frontend : http://localhost:5173"
echo ""
echo "💡 Pour arrêter les serveurs, utilisez Ctrl+C ou :"
echo "   kill $BACKEND_PID $FRONTEND_PID"

# Attendre les processus
wait
