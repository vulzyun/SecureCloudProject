#!/bin/bash

# Script pour démarrer backend + frontend

echo "🚀 Démarrage de l'application SecureCloud..."

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Vérifier si on est dans le bon répertoire
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet${NC}"
    exit 1
fi

# Fonction pour arrêter les processus
cleanup() {
    echo -e "\n${RED}🛑 Arrêt des serveurs...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# 1. Démarrer le backend
echo -e "${BLUE}📦 Démarrage du backend (FastAPI)...${NC}"
cd backend
python -m uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Attendre que le backend démarre
sleep 3

# 2. Démarrer le frontend
echo -e "${BLUE}⚛️  Démarrage du frontend (React + Vite)...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "\n${GREEN}✅ Application démarrée !${NC}"
echo -e "${GREEN}   Backend:  http://localhost:8000${NC}"
echo -e "${GREEN}   Frontend: http://localhost:5173${NC}"
echo -e "\n${BLUE}💡 Appuyez sur Ctrl+C pour arrêter les serveurs${NC}\n"

# Attendre indéfiniment
wait
