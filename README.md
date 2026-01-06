# 🚀 SecureCloud Project

Système de gestion de pipelines CI/CD avec authentification et contrôle d'accès basé sur les rôles (RBAC).

## 📁 Structure du projet

```
SecureCloudProject/
├── backend/              # API FastAPI
│   ├── app/
│   │   ├── auth/        # Authentification et gestion des utilisateurs
│   │   ├── pipelines/   # Gestion des pipelines
│   │   ├── config.py    # Configuration
│   │   ├── db.py        # Base de données
│   │   ├── main.py      # Point d'entrée
│   │   └── models.py    # Modèles de données
│   ├── tests/           # Tests
│   └── requirements.txt # Dépendances Python
│
├── frontend/            # Interface React + TypeScript
│   ├── src/
│   │   ├── components/  # Composants réutilisables
│   │   ├── pages/       # Pages de l'application
│   │   ├── api.ts       # Client API
│   │   └── types.ts     # Définitions TypeScript
│   └── package.json     # Dépendances Node.js
│
├── start.sh             # Script de démarrage
├── test_api.py          # Tests des endpoints
├── INTEGRATION_GUIDE.md # Guide d'intégration détaillé
└── CHANGEMENTS.md       # Résumé des modifications
```

## 🎯 Fonctionnalités

### Authentification et autorisation
- ✅ Authentification via oauth2-proxy (headers)
- ✅ 3 rôles: **viewer**, **dev**, **admin**
- ✅ RBAC complet pour tous les endpoints

### Gestion des utilisateurs (Admin)
- ✅ Créer un utilisateur (username, role, email)
- ✅ Lister tous les utilisateurs
- ✅ Modifier le rôle d'un utilisateur
- ✅ Interface d'administration intuitive

### Gestion des pipelines
- ✅ Créer un pipeline (nom, URL GitHub)
- ✅ Lister tous les pipelines
- ✅ Lancer un pipeline
- ✅ Suivi du statut (pending, running, completed, failed)
- ✅ Traçabilité (created_by, timestamps)

## 🚀 Démarrage rapide

### Option 1: Script automatique (recommandé)
```bash
./start.sh
```

### Option 2: Manuel

#### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Le backend sera accessible sur http://127.0.0.1:8000

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

Le frontend sera accessible sur http://localhost:5173

## 📝 Configuration

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

## 🔑 Rôles et permissions

| Rôle | Voir pipelines | Créer/Lancer pipeline | Gérer utilisateurs |
|------|---------------|----------------------|-------------------|
| **viewer** | ✅ | ❌ | ❌ |
| **dev** | ✅ | ✅ | ❌ |
| **admin** | ✅ | ✅ | ✅ |

## 📡 Endpoints API

### Authentification
- `GET /api/me` - Utilisateur courant

### Utilisateurs (Admin uniquement)
- `GET /api/admin/users` - Liste des utilisateurs
- `POST /api/admin/users` - Créer un utilisateur
- `PUT /api/admin/users/{id}/role` - Modifier le rôle

### Pipelines
- `GET /api/pipelines` - Liste des pipelines (tous)
- `POST /api/pipelines` - Créer un pipeline (dev, admin)
- `POST /api/pipelines/{id}/run` - Lancer un pipeline (dev, admin)

## 🧪 Tests

### Tester les endpoints
```bash
python3 test_api.py
```

### Tests unitaires backend
```bash
cd backend
pytest
```

## 📚 Documentation

- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)**: Guide complet d'intégration
- **[CHANGEMENTS.md](./CHANGEMENTS.md)**: Résumé détaillé des modifications

## 🔧 Développement

### Backend
- **Framework**: FastAPI
- **Base de données**: SQLite (SQLModel)
- **Authentification**: oauth2-proxy headers

### Frontend
- **Framework**: React + TypeScript
- **Build**: Vite
- **Style**: Tailwind CSS

## 📖 Exemple d'utilisation

### 1. Créer un utilisateur (Admin)
```bash
curl -X POST http://127.0.0.1:8000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "role": "dev",
    "email": "alice@example.com"
  }'
```

### 2. Créer un pipeline (Dev/Admin)
```bash
curl -X POST http://127.0.0.1:8000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon Super Pipeline",
    "github_url": "https://github.com/user/repo"
  }'
```

### 3. Lancer un pipeline (Dev/Admin)
```bash
curl -X POST http://127.0.0.1:8000/api/pipelines/1/run
```

## 🎨 Interface utilisateur

### Dashboard
- Vue d'ensemble des pipelines
- Création de nouveaux pipelines (dev/admin)
- Lancement des pipelines (dev/admin)

### Panel d'administration (Admin uniquement)
- **Onglet "Gestion des utilisateurs"**: 
  - Liste de tous les utilisateurs
  - Modification des rôles
  
- **Onglet "Créer un utilisateur"**:
  - Formulaire de création
  - Champs: username, email (optionnel), role

## ⚙️ Mode développement

Le frontend inclut un mode développement qui simule automatiquement un utilisateur admin. Pour le désactiver:

```typescript
// frontend/src/components/AuthGuard.tsx
const DEV_MODE = false; // Changer à false
```

## 🐛 Dépannage

### Le backend ne démarre pas
- Vérifier que Python 3.8+ est installé
- Vérifier que les dépendances sont installées: `pip install -r requirements.txt`
- Vérifier que le port 8000 est libre

### Le frontend ne démarre pas
- Vérifier que Node.js 16+ est installé
- Supprimer `node_modules` et réinstaller: `rm -rf node_modules && npm install`
- Vérifier que le port 5173 est libre

### Erreur CORS
- Vérifier que `FRONTEND_URL` dans `.env` du backend correspond à l'URL du frontend
- Le backend doit être démarré avant le frontend

## 📄 Licence

Ce projet est fourni à des fins éducatives.

## 👥 Auteurs

Projet SecureCloud - IMT

---

**Note**: Ce README documente l'état actuel du projet après l'intégration complète du backend et du frontend.
