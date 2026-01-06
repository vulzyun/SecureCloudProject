# Guide d'intégration Backend-Frontend

## 🎯 Modifications effectuées

### Backend

#### 1. **Nouveau endpoint de création d'utilisateur**
- **Route**: `POST /api/admin/users`
- **Accès**: Admin uniquement
- **Body**:
  ```json
  {
    "username": "john_doe",
    "role": "viewer|dev|admin",
    "email": "john@example.com" // optionnel
  }
  ```
- **Réponse**: Objet User complet avec tous les champs

#### 2. **Modèles mis à jour**

##### User Model
```python
class User(SQLModel, table=True):
    id: int | None
    email: str
    username: str
    role: Role  # "admin", "dev", "viewer"
    created_at: datetime
    updated_at: datetime
```

##### Pipeline Model
```python
class Pipeline(SQLModel, table=True):
    id: int | None
    name: str
    repo_url: str
    github_url: str  # alias pour repo_url
    branch: str
    status: str  # "pending", "running", "completed", "failed"
    created_by: str  # username du créateur
    created_at: datetime
    updated_at: datetime
```

#### 3. **Endpoints mis à jour**

| Endpoint | Méthode | Accès | Description |
|----------|---------|-------|-------------|
| `/api/me` | GET | Tous | Récupère l'utilisateur courant (objet User complet) |
| `/api/admin/users` | GET | Admin | Liste tous les utilisateurs |
| `/api/admin/users` | POST | Admin | Crée un nouvel utilisateur |
| `/api/admin/users/{user_id}/role` | PUT | Admin | Met à jour le rôle d'un utilisateur |
| `/api/pipelines` | GET | Tous | Liste tous les pipelines |
| `/api/pipelines` | POST | Dev, Admin | Crée un nouveau pipeline |
| `/api/pipelines/{id}/run` | POST | Dev, Admin | Lance un pipeline |

#### 4. **Rôles disponibles**
- **viewer**: Peut uniquement voir les pipelines
- **dev**: Peut créer et lancer des pipelines
- **admin**: Accès complet, gestion des utilisateurs

### Frontend

#### 1. **Types TypeScript synchronisés**
```typescript
export type Role = "viewer" | "dev" | "admin";

export interface User {
  id: number;
  email: string;
  username: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: number;
  name: string;
  repo_url: string;
  github_url: string;
  branch: string;
  status: "pending" | "running" | "completed" | "failed";
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

#### 2. **API Frontend**
```typescript
// Auth
authAPI.getCurrentUser() -> User

// Users
userAPI.getAllUsers() -> User[]
userAPI.createUser(username, role, email?) -> User
userAPI.updateUserRole(userId, role) -> { ok, id, role }

// Pipelines
pipelineAPI.getAllPipelines() -> Pipeline[]
pipelineAPI.createPipeline(githubUrl, name) -> Pipeline
pipelineAPI.runPipeline(id) -> { runId }
```

#### 3. **AdminPanel amélioré**
- **Onglet "Gestion des utilisateurs"**: 
  - Affiche tous les utilisateurs avec email, rôle et date de création
  - Permet de modifier le rôle d'un utilisateur existant
  
- **Onglet "Créer un utilisateur"**:
  - Formulaire pour créer un nouvel utilisateur
  - Champs: username (requis), email (optionnel), role (requis)
  - Si email non fourni, génère automatiquement: `username@local`

#### 4. **Dashboard mis à jour**
- Remplacé "contributor" par "dev" dans toute l'interface
- Les viewers voient maintenant un message les invitant à contacter un admin
- Supprimé la fonctionnalité de demande de changement de rôle
- Les dev et admin peuvent créer et lancer des pipelines

## 🚀 Comment utiliser

### Démarrer le backend
```bash
cd backend
# Installer les dépendances si nécessaire
pip install -r requirements.txt

# Lancer le serveur
uvicorn app.main:app --reload
```

### Démarrer le frontend
```bash
cd frontend
# Installer les dépendances si nécessaire
npm install

# Lancer le serveur de développement
npm run dev
```

### Configuration
- **Backend**: Fichier `.env` à la racine du dossier backend
  - `FRONTEND_URL`: URL du frontend (défaut: http://localhost:5173)
  - `DATABASE_URL`: URL de la base de données
  - `BOOTSTRAP_ADMIN_EMAIL`: Email de l'admin bootstrap

- **Frontend**: Fichier `.env` à la racine du dossier frontend
  - `VITE_API_URL`: URL de l'API backend (défaut: http://127.0.0.1:8000)

## 📝 Exemples d'utilisation

### Créer un utilisateur via l'API
```bash
curl -X POST http://localhost:8000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "role": "dev",
    "email": "john@example.com"
  }'
```

### Mettre à jour le rôle d'un utilisateur
```bash
curl -X PUT http://localhost:8000/api/admin/users/2/role \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
```

### Créer un pipeline
```bash
curl -X POST http://localhost:8000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon Pipeline",
    "github_url": "https://github.com/user/repo"
  }'
```

## ✅ Checklist de vérification

- [x] Backend et frontend utilisent les mêmes types de rôles (viewer, dev, admin)
- [x] Endpoint POST /api/admin/users créé pour créer des utilisateurs
- [x] Tous les modèles incluent created_at et updated_at
- [x] Pipeline inclut created_by et status
- [x] Frontend adapté pour utiliser les vrais endpoints
- [x] AdminPanel inclut un formulaire de création d'utilisateur
- [x] Types TypeScript synchronisés avec les modèles Python
- [x] Configuration CORS correctement définie
- [x] Variables d'environnement configurées

## 🔒 Sécurité

- Tous les endpoints admin sont protégés par `require_role(Role.admin)`
- Les pipelines peuvent être créés/lancés par dev et admin seulement
- Les viewers ont un accès en lecture seule
- L'authentification se fait via les headers oauth2-proxy
