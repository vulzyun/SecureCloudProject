#!/bin/bash

# Script de démarrage pour le projet SecureCloud

echo "🚀 SecureCloud Project - Démarrage"
echo "=================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
function info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

function success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function error() {
    echo -e "${RED}❌ $1${NC}"
}

# Menu
echo "Que voulez-vous faire?"
echo "1) Démarrer le backend"
echo "2) Démarrer le frontend"
echo "3) Démarrer les deux (backend + frontend)"
echo "4) Tester les APIs"
echo "5) Réinitialiser la base de données"
echo ""
read -p "Votre choix (1-5): " choice

case $choice in
    1)
        info "Démarrage du backend..."
        cd backend
        if [ ! -d "venv" ]; then
            info "Création de l'environnement virtuel..."
            python3 -m venv venv
        fi
        source venv/bin/activate
        info "Installation des dépendances..."
        pip install -r requirements.txt > /dev/null 2>&1
        success "Backend prêt!"
        info "Démarrage du serveur sur http://127.0.0.1:8000"
        uvicorn app.main:app --reload
        ;;
    2)
        info "Démarrage du frontend..."
        cd frontend
        if [ ! -d "node_modules" ]; then
            info "Installation des dépendances..."
            npm install
        fi
        success "Frontend prêt!"
        info "Démarrage du serveur sur http://localhost:5173"
        npm run dev
        ;;
    3)
        info "Démarrage du backend et du frontend..."
        
        # Démarrer le backend en arrière-plan
        cd backend
        if [ ! -d "venv" ]; then
            info "Création de l'environnement virtuel pour le backend..."
            python3 -m venv venv
        fi
        source venv/bin/activate
        info "Installation des dépendances backend..."
        pip install -r requirements.txt > /dev/null 2>&1
        info "Démarrage du backend..."
        uvicorn app.main:app --reload > ../backend.log 2>&1 &
        BACKEND_PID=$!
        success "Backend démarré (PID: $BACKEND_PID)"
        cd ..
        
        # Attendre que le backend soit prêt
        sleep 3
        
        # Démarrer le frontend en arrière-plan
        cd frontend
        if [ ! -d "node_modules" ]; then
            info "Installation des dépendances frontend..."
            npm install > /dev/null 2>&1
        fi
        info "Démarrage du frontend..."
        npm run dev > ../frontend.log 2>&1 &
        FRONTEND_PID=$!
        success "Frontend démarré (PID: $FRONTEND_PID)"
        cd ..
        
        success "Tout est démarré!"
        echo ""
        info "Backend: http://127.0.0.1:8000"
        info "Frontend: http://localhost:5173"
        echo ""
        echo "Logs:"
        echo "  - Backend: backend.log"
        echo "  - Frontend: frontend.log"
        echo ""
        echo "Pour arrêter les serveurs:"
        echo "  kill $BACKEND_PID $FRONTEND_PID"
        echo ""
        read -p "Appuyez sur Entrée pour arrêter les serveurs..."
        kill $BACKEND_PID $FRONTEND_PID
        success "Serveurs arrêtés"
        ;;
    4)
        info "Test des APIs..."
        if [ ! -f "test_api.py" ]; then
            error "Fichier test_api.py introuvable!"
            exit 1
        fi
        python3 test_api.py
        ;;
    5)
        info "Réinitialisation de la base de données..."
        read -p "⚠️  Êtes-vous sûr? Toutes les données seront perdues! (y/N): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            cd backend
            if [ -f "data.db" ]; then
                rm data.db
                success "Base de données supprimée"
            fi
            if [ -f "data.db-shm" ]; then
                rm data.db-shm
            fi
            if [ -f "data.db-wal" ]; then
                rm data.db-wal
            fi
            info "Redémarrez le backend pour recréer la base de données"
        else
            info "Annulé"
        fi
        ;;
    *)
        error "Choix invalide!"
        exit 1
        ;;
esac
