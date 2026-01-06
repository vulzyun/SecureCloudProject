# Exemples de requêtes SQL PostgreSQL pour le backend

## 1. Création des tables

```sql
-- Table des utilisateurs
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des pipelines
CREATE TABLE pipelines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    github_url TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des demandes de changement de rôle
CREATE TABLE role_change_requests (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    requested_role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_pipelines_created_by ON pipelines(created_by);
CREATE INDEX idx_role_requests_status ON role_change_requests(status);
```

## 2. Vérifier si un utilisateur existe

```sql
SELECT * FROM users WHERE username = $1;
```

## 3. Créer un utilisateur avec le rôle "viewer"

```sql
INSERT INTO users (username, role)
VALUES ($1, 'viewer')
ON CONFLICT (username) DO NOTHING
RETURNING *;
```

## 4. Récupérer le rôle d'un utilisateur

```sql
SELECT role FROM users WHERE username = $1;
```

## 5. Mettre à jour le rôle d'un utilisateur

```sql
UPDATE users
SET role = $2, updated_at = CURRENT_TIMESTAMP
WHERE username = $1
RETURNING *;
```

## 6. Vérifier et créer un utilisateur (utilisé par le endpoint /api/auth/check-or-create)

```sql
-- D'abord vérifier
SELECT * FROM users WHERE username = $1;

-- Si n'existe pas, créer
INSERT INTO users (username, role)
VALUES ($1, 'viewer')
RETURNING *;

-- Si existe déjà, récupérer
SELECT * FROM users WHERE username = $1;
```

## 7. Créer une demande de changement de rôle

```sql
INSERT INTO role_change_requests (username, requested_role)
VALUES ($1, $2)
RETURNING *;
```

## 8. Récupérer toutes les demandes en attente

```sql
SELECT * FROM role_change_requests
WHERE status = 'pending'
ORDER BY created_at DESC;
```

## 9. Approuver/Rejeter une demande de changement de rôle

```sql
-- Mettre à jour la demande
UPDATE role_change_requests
SET status = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- Si approuvé, mettre à jour le rôle de l'utilisateur
UPDATE users
SET role = (SELECT requested_role FROM role_change_requests WHERE id = $1),
    updated_at = CURRENT_TIMESTAMP
WHERE username = (SELECT username FROM role_change_requests WHERE id = $1)
RETURNING *;
```

## 10. Créer un pipeline

```sql
INSERT INTO pipelines (name, github_url, created_by, status)
VALUES ($1, $2, $3, 'pending')
RETURNING *;
```

## 11. Récupérer tous les pipelines

```sql
SELECT * FROM pipelines
ORDER BY created_at DESC;
```

## 12. Lancer un pipeline (mettre à jour le statut)

```sql
UPDATE pipelines
SET status = 'running', updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;
```

## 13. Récupérer tous les utilisateurs (pour les admins)

```sql
SELECT * FROM users
ORDER BY created_at DESC;
```

## Exemple de middleware backend (Python/FastAPI)

```python
from fastapi import Header, HTTPException

async def get_current_user(x_auth_request_user: str = Header(None)):
    """
    Récupère l'utilisateur depuis le header X-Auth-Request-User envoyé par OAuth2 Proxy
    """
    if not x_auth_request_user:
        raise HTTPException(status_code=403, detail="Unauthorized - No auth header")
    
    return x_auth_request_user

async def check_or_create_user(username: str, db):
    """
    Vérifie si l'utilisateur existe dans la BD, sinon le crée avec le rôle viewer
    """
    # Vérifier si l'utilisateur existe
    user = await db.fetchrow("SELECT * FROM users WHERE username = $1", username)
    
    if not user:
        # Créer l'utilisateur avec le rôle viewer
        user = await db.fetchrow(
            "INSERT INTO users (username, role) VALUES ($1, 'viewer') RETURNING *",
            username
        )
    
    return user
```

## Variables d'environnement (.env)

```bash
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/securecloud

# Liste des admins (séparés par des virgules)
ADMIN_USERS=admin1,admin2,admin3

# API Configuration
VITE_API_URL=http://localhost:8000
```
