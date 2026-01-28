#!/bin/bash

# Script de démarrage pour Modern Magicodex
# Ce script démarre le backend et le frontend simultanément

echo "🚀 Démarrage de Modern Magicodex..."

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer avant de continuer."
    exit 1
fi

# Vérifier si npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé. Veuillez l'installer avant de continuer."
    exit 1
fi

# Fonction pour démarrer le backend
start_backend() {
    echo "🔧 Démarrage du backend..."
    cd backend
    
    if [ ! -d "node_modules" ]; then
        echo "📦 Installation des dépendances du backend..."
        npm install
    fi
    
    if [ ! -f ".env" ]; then
        echo "⚙️ Création du fichier .env pour le backend..."
        cp .env.example .env
        echo "📝 Veuillez configurer votre base de données dans backend/.env"
    fi
    
    # Générer le client Prisma s'il n'existe pas
    if [ ! -d "node_modules/.prisma" ]; then
        echo "🔧 Génération du client Prisma..."
        npm run prisma:generate
    fi
    
    echo "🚀 Démarrage du serveur backend sur http://localhost:3001"
    npm run dev &
    BACKEND_PID=$!
    cd ..
}

# Fonction pour démarrer le frontend
start_frontend() {
    echo "🎨 Démarrage du frontend..."
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        echo "📦 Installation des dépendances du frontend..."
        npm install
    fi
    
    if [ ! -f ".env" ]; then
        echo "⚙️ Création du fichier .env pour le frontend..."
        cp .env.example .env
    fi
    
    echo "🚀 Démarrage du serveur frontend sur http://localhost:5173"
    npm run dev &
    FRONTEND_PID=$!
    cd ..
}

# Fonction de nettoyage
cleanup() {
    echo ""
    echo "🛑 Arrêt des serveurs..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

# Capturer Ctrl+C pour nettoyer proprement
trap cleanup SIGINT

# Démarrer les services
start_backend
sleep 2
start_frontend

echo ""
echo "✅ Modern Magicodex est maintenant en cours d'exécution !"
echo "📱 Frontend: http://localhost:5173"
echo "🔌 Backend API: http://localhost:3001"
echo "💾 Prisma Studio: npm run prisma:studio (dans le dossier backend)"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter les serveurs..."

# Attendre que les processus se terminent
wait
