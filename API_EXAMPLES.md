# 📡 Exemples de requêtes API

Ce fichier contient des exemples de requêtes pour tous les endpoints de l'API.

## 🔐 Authentification

### Obtenir l'utilisateur courant
```http
GET /api/me HTTP/1.1
Host: 127.0.0.1:8000
Content-Type: application/json
```

**Réponse (200 OK)**:
```json
{
  "id": 1,
  "email": "admin@example.com",
  "username": "admin",
  "role": "admin",
  "created_at": "2025-01-06T10:00:00",
  "updated_at": "2025-01-06T10:00:00"
}
```

## 👥 Gestion des utilisateurs (Admin uniquement)

### 1. Liste tous les utilisateurs

```http
GET /api/admin/users HTTP/1.1
Host: 127.0.0.1:8000
Content-Type: application/json
```

**Réponse (200 OK)**:
```json
[
  {
    "id": 1,
    "email": "admin@example.com",
    "username": "admin",
    "role": "admin",
    "created_at": "2025-01-06T10:00:00",
    "updated_at": "2025-01-06T10:00:00"
  },
  {
    "id": 2,
    "email": "dev@example.com",
    "username": "developer",
    "role": "dev",
    "created_at": "2025-01-06T10:30:00",
    "updated_at": "2025-01-06T10:30:00"
  }
]
```

### 2. Créer un nouvel utilisateur

```http
POST /api/admin/users HTTP/1.1
Host: 127.0.0.1:8000
Content-Type: application/json

{
  "username": "john_doe",
  "role": "dev",
  "email": "john@example.com"
}
```

**Paramètres**:
- `username` (string, requis): Nom d'utilisateur unique
- `role` (string, requis): "viewer", "dev" ou "admin"
- `email` (string, optionnel): Email de l'utilisateur (génère username@local si non fourni)

**Réponse (200 OK)**:
```json
{
  "id": 3,
  "email": "john@example.com",
  "username": "john_doe",
  "role": "dev",
  "created_at": "2025-01-06T11:00:00",
  "updated_at": "2025-01-06T11:00:00"
}
```

**Erreurs possibles**:
- `400 Bad Request`: Username manquant ou rôle invalide
- `400 Bad Request`: Utilisateur existe déjà
- `403 Forbidden`: Accès non autorisé (non admin)

### 3. Modifier le rôle d'un utilisateur

```http
PUT /api/admin/users/3/role HTTP/1.1
Host: 127.0.0.1:8000
Content-Type: application/json

{
  "role": "admin"
}
```

**Paramètres**:
- `role` (string, requis): "viewer", "dev" ou "admin"

**Réponse (200 OK)**:
```json
{
  "ok": true,
  "id": 3,
  "role": "admin"
}
```

**Erreurs possibles**:
- `400 Bad Request`: Rôle invalide
- `404 Not Found`: Utilisateur non trouvé
- `403 Forbidden`: Accès non autorisé (non admin)

## 🚀 Gestion des pipelines

### 1. Liste tous les pipelines

```http
GET /api/pipelines HTTP/1.1
Host: 127.0.0.1:8000
Content-Type: application/json
```

**Réponse (200 OK)**:
```json
[
  {
    "id": 1,
    "name": "Backend API",
    "repo_url": "https://github.com/user/backend",
    "github_url": "https://github.com/user/backend",
    "branch": "main",
    "status": "completed",
    "created_by": "developer",
    "created_at": "2025-01-06T09:00:00",
    "updated_at": "2025-01-06T09:30:00"
  },
  {
    "id": 2,
    "name": "Frontend App",
    "repo_url": "https://github.com/user/frontend",
    "github_url": "https://github.com/user/frontend",
    "branch": "main",
    "status": "pending",
    "created_by": "admin",
    "created_at": "2025-01-06T10:00:00",
    "updated_at": "2025-01-06T10:00:00"
  }
]
```

### 2. Créer un pipeline (Dev/Admin)

```http
POST /api/pipelines HTTP/1.1
Host: 127.0.0.1:8000
Content-Type: application/json

{
  "name": "Test Pipeline",
  "github_url": "https://github.com/user/test-repo",
  "branch": "develop"
}
```

**Paramètres**:
- `name` (string, requis): Nom du pipeline
- `github_url` ou `repo_url` (string, requis): URL du dépôt GitHub
- `branch` (string, optionnel): Branche à utiliser (défaut: "main")

**Réponse (200 OK)**:
```json
{
  "id": 3,
  "name": "Test Pipeline",
  "repo_url": "https://github.com/user/test-repo",
  "github_url": "https://github.com/user/test-repo",
  "branch": "develop",
  "status": "pending",
  "created_by": "john_doe",
  "created_at": "2025-01-06T11:30:00",
  "updated_at": "2025-01-06T11:30:00"
}
```

**Erreurs possibles**:
- `400 Bad Request`: Nom ou URL manquant
- `403 Forbidden`: Accès non autorisé (viewer)

### 3. Lancer un pipeline (Dev/Admin)

```http
POST /api/pipelines/1/run HTTP/1.1
Host: 127.0.0.1:8000
Content-Type: application/json
```

**Réponse (200 OK)**:
```json
{
  "runId": 42
}
```

**Erreurs possibles**:
- `404 Not Found`: Pipeline non trouvé
- `403 Forbidden`: Accès non autorisé (viewer)

### 4. Suivre les événements d'un run (SSE)

```http
GET /api/runs/42/events HTTP/1.1
Host: 127.0.0.1:8000
Accept: text/event-stream
```

**Réponse (Stream)**:
```
event: message
data: {"stage": "clone", "status": "running"}

event: message
data: {"stage": "build", "status": "running"}

event: message
data: {"stage": "test", "status": "completed"}
```

## 🔧 Health Check

### Vérifier l'état de l'API

```http
GET /api/health HTTP/1.1
Host: 127.0.0.1:8000
```

**Réponse (200 OK)**:
```json
{
  "status": "UP"
}
```

## 📝 Exemples avec curl

### Créer un utilisateur
```bash
curl -X POST http://127.0.0.1:8000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "role": "dev",
    "email": "alice@example.com"
  }'
```

### Modifier un rôle
```bash
curl -X PUT http://127.0.0.1:8000/api/admin/users/2/role \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

### Créer un pipeline
```bash
curl -X POST http://127.0.0.1:8000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Pipeline",
    "github_url": "https://github.com/user/repo"
  }'
```

### Lancer un pipeline
```bash
curl -X POST http://127.0.0.1:8000/api/pipelines/1/run \
  -H "Content-Type: application/json"
```

## 📝 Exemples avec JavaScript (fetch)

### Créer un utilisateur
```javascript
const response = await fetch('http://127.0.0.1:8000/api/admin/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'alice',
    role: 'dev',
    email: 'alice@example.com'
  }),
  credentials: 'include'
});

const user = await response.json();
console.log(user);
```

### Lister les pipelines
```javascript
const response = await fetch('http://127.0.0.1:8000/api/pipelines', {
  credentials: 'include'
});

const pipelines = await response.json();
console.log(pipelines);
```

## 🔑 Codes de réponse

| Code | Description |
|------|-------------|
| 200 | Succès |
| 400 | Mauvaise requête (paramètres invalides) |
| 401 | Non authentifié |
| 403 | Non autorisé (manque de permissions) |
| 404 | Ressource non trouvée |
| 500 | Erreur serveur |

## 📊 Tableau récapitulatif des permissions

| Endpoint | viewer | dev | admin |
|----------|--------|-----|-------|
| GET /api/me | ✅ | ✅ | ✅ |
| GET /api/admin/users | ❌ | ❌ | ✅ |
| POST /api/admin/users | ❌ | ❌ | ✅ |
| PUT /api/admin/users/{id}/role | ❌ | ❌ | ✅ |
| GET /api/pipelines | ✅ | ✅ | ✅ |
| POST /api/pipelines | ❌ | ✅ | ✅ |
| POST /api/pipelines/{id}/run | ❌ | ✅ | ✅ |
| GET /api/runs/{id}/events | ✅ | ✅ | ✅ |
