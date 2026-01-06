# 🚀 Guide de Démarrage Rapide

## Installation initiale

### Backend
```bash
cd backend
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

## Démarrage de l'application

### Option 1 : Script automatique (recommandé)
```bash
chmod +x start.sh
./start.sh
```

### Option 2 : Manuel

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## URLs d'accès

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **Documentation API:** http://localhost:8000/docs

## Configuration

### Backend
Le backend utilise `oauth2-proxy` pour l'authentification. En mode développement, `AuthGuard.tsx` simule un utilisateur admin.

### Frontend
Pour désactiver le mode DEV et utiliser oauth2-proxy réel:
- Ouvrir `frontend/src/components/AuthGuard.tsx`
- Changer `const DEV_MODE = true;` en `const DEV_MODE = false;`

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────┐
│   Browser   │─────▶│  oauth2-proxy│─────▶│  FastAPI │
│  (React)    │◀─────│              │◀─────│  Backend │
└─────────────┘      └──────────────┘      └──────────┘
     :5173                  :4180              :8000
```

## Fonctionnalités par rôle

### Viewer (lecture seule)
✅ Voir les pipelines
❌ Créer des pipelines
❌ Lancer des pipelines
❌ Gérer les utilisateurs

### Dev (développeur)
✅ Voir les pipelines
✅ Créer des pipelines
✅ Lancer des pipelines
❌ Gérer les utilisateurs

### Admin (administrateur)
✅ Voir les pipelines
✅ Créer des pipelines
✅ Lancer des pipelines
✅ Créer des utilisateurs
✅ Modifier les rôles

## Endpoints principaux

### Authentification
- `GET /api/me` - Informations utilisateur actuel

### Administration (admin only)
- `GET /api/admin/users` - Liste des utilisateurs
- `POST /api/admin/users` - Créer un utilisateur
- `PUT /api/admin/users/{id}/role` - Changer le rôle

### Pipelines (dev/admin)
- `GET /api/pipelines` - Liste des pipelines
- `POST /api/pipelines` - Créer un pipeline
- `POST /api/pipelines/{id}/run` - Lancer un pipeline

### Runs
- `GET /api/runs/{id}/history` - Historique d'un run
- `GET /api/runs/{id}/events` - Stream SSE des événements

## Tests

```bash
# Backend
cd backend
pytest

# Frontend (build uniquement)
cd frontend
npm run build
```

## Troubleshooting

### Port déjà utilisé
Si le port 8000 ou 5173 est déjà utilisé:
```bash
# Trouver le processus
lsof -i :8000
lsof -i :5173

# Tuer le processus
kill -9 <PID>
```

### Erreurs d'import
```bash
cd frontend
rm -rf node_modules/.vite
npm install
```

### Base de données
La base SQLite est créée automatiquement au premier démarrage dans `backend/secure_cloud.db`.

Pour la réinitialiser:
```bash
cd backend
rm secure_cloud.db
# Redémarrer le backend
```
