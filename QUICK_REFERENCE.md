# 🎯 Quick Reference - Commandes utiles

## Démarrage

### Démarrage rapide (tout)
```bash
./start.sh
# Choisir l'option 3
```

### Backend uniquement
```bash
cd backend
source venv/bin/activate  # ou venv\Scripts\activate sur Windows
uvicorn app.main:app --reload
```

### Frontend uniquement
```bash
cd frontend
npm run dev
```

## Tests

### Test des endpoints
```bash
python3 test_api.py
```

### Tests backend
```bash
cd backend
source venv/bin/activate
pytest
```

## Endpoints principaux

### Utilisateur courant
```bash
curl http://127.0.0.1:8000/api/me
```

### Liste des utilisateurs (Admin)
```bash
curl http://127.0.0.1:8000/api/admin/users
```

### Créer un utilisateur (Admin)
```bash
curl -X POST http://127.0.0.1:8000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "role": "dev", "email": "test@mail.com"}'
```

### Modifier le rôle (Admin)
```bash
curl -X PUT http://127.0.0.1:8000/api/admin/users/1/role \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

### Liste des pipelines
```bash
curl http://127.0.0.1:8000/api/pipelines
```

### Créer un pipeline (Dev/Admin)
```bash
curl -X POST http://127.0.0.1:8000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "github_url": "https://github.com/test/repo"}'
```

### Lancer un pipeline (Dev/Admin)
```bash
curl -X POST http://127.0.0.1:8000/api/pipelines/1/run
```

## Base de données

### Réinitialiser la base de données
```bash
cd backend
rm data.db data.db-shm data.db-wal
# Redémarrer le backend
```

### Voir la structure de la base
```bash
cd backend
sqlite3 data.db ".schema"
```

### Voir les utilisateurs
```bash
cd backend
sqlite3 data.db "SELECT * FROM user;"
```

### Voir les pipelines
```bash
cd backend
sqlite3 data.db "SELECT * FROM pipeline;"
```

## Dépendances

### Backend - Installer les dépendances
```bash
cd backend
pip install -r requirements.txt
```

### Frontend - Installer les dépendances
```bash
cd frontend
npm install
```

### Frontend - Mettre à jour les dépendances
```bash
cd frontend
npm update
```

## Build Production

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm run build
# Les fichiers seront dans dist/
```

## Logs

### Backend - Voir les logs
```bash
tail -f backend.log
```

### Frontend - Voir les logs
```bash
tail -f frontend.log
```

## Variables d'environnement

### Backend (.env)
```env
ENV=dev
DATABASE_URL=sqlite:///./data.db
FRONTEND_URL=http://localhost:5173
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
```

### Frontend (.env)
```env
VITE_API_URL=http://127.0.0.1:8000
```

## Utilitaires

### Vérifier que le backend est accessible
```bash
curl http://127.0.0.1:8000/api/health
```

### Formater le code Python
```bash
cd backend
black app/
```

### Lint le code TypeScript
```bash
cd frontend
npm run lint
```

## Docker (si applicable)

### Build et run
```bash
docker-compose up --build
```

### Arrêter
```bash
docker-compose down
```

## Raccourcis IDE

### VS Code - Formater le fichier
- Mac: `Shift + Option + F`
- Windows/Linux: `Shift + Alt + F`

### VS Code - Aller à la définition
- Mac/Windows/Linux: `F12` ou `Cmd/Ctrl + Click`

### VS Code - Recherche globale
- Mac: `Cmd + Shift + F`
- Windows/Linux: `Ctrl + Shift + F`

## Troubleshooting rapide

### Port déjà utilisé (Backend)
```bash
lsof -ti:8000 | xargs kill -9
```

### Port déjà utilisé (Frontend)
```bash
lsof -ti:5173 | xargs kill -9
```

### Réinstaller les dépendances frontend
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Réinstaller les dépendances backend
```bash
cd backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
