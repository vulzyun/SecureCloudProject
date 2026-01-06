# Résumé des modifications - Intégration Backend-Frontend

## 📋 Ce qui a été fait

### 1. ✅ Backend - Nouveau endpoint de création d'utilisateur

**Fichier**: `backend/app/auth/admin_routes.py`

Ajout d'un nouvel endpoint `POST /api/admin/users` qui permet de créer un utilisateur avec:
- **username** (obligatoire): Le nom d'utilisateur
- **role** (obligatoire): Le rôle (viewer, dev, ou admin)
- **email** (optionnel): L'email de l'utilisateur (si non fourni, génère `username@local`)

```python
@router.post("/users")
def create_user(payload: dict, session: Session, _: User):
    # Crée un utilisateur avec username et role
    # Vérifie que l'utilisateur n'existe pas déjà
    # Retourne l'objet User complet
```

### 2. ✅ Backend - Modèles mis à jour

**Fichier**: `backend/app/models.py`

#### User Model
- Ajout de `created_at: datetime`
- Ajout de `updated_at: datetime`

#### Pipeline Model
- Ajout de `github_url: str` (alias pour repo_url)
- Ajout de `status: str` (pending/running/completed/failed)
- Ajout de `created_by: str` (username du créateur)
- Ajout de `created_at: datetime`
- Ajout de `updated_at: datetime`

### 3. ✅ Backend - Endpoints adaptés

**Fichier**: `backend/app/auth/routes.py`
- `/api/me` retourne maintenant l'objet User complet (au lieu d'un dict)

**Fichier**: `backend/app/pipelines/routes.py`
- `/api/pipelines` (POST) accepte maintenant `github_url` en plus de `repo_url`
- Enregistre le `created_by` (username) lors de la création
- Accessible par les rôles `dev` et `admin` (au lieu de seulement admin)

### 4. ✅ Frontend - Types synchronisés

**Fichier**: `frontend/src/types.ts`

- Changé `Role` de `"contributor"` vers `"dev"`
- Ajout de `email` dans `User`
- Ajout de tous les champs manquants dans `Pipeline`
- Suppression de `RoleChangeRequest` et `AuthUser` (non utilisés)

### 5. ✅ Frontend - API adaptée

**Fichier**: `frontend/src/api.ts`

- Simplifié `authAPI.getCurrentUser()` pour appeler `/api/me`
- Ajout de `userAPI.createUser(username, role, email?)` pour créer des utilisateurs
- Modifié `userAPI.updateUserRole()` pour utiliser l'ID utilisateur au lieu du username
- Suppression des endpoints de demande de changement de rôle
- Adaptation de tous les types de retour

### 6. ✅ Frontend - AdminPanel amélioré

**Fichier**: `frontend/src/components/AdminPanel.tsx`

**Onglet "Gestion des utilisateurs"**:
- Affiche maintenant l'email de chaque utilisateur
- Utilise un menu déroulant pour sélectionner l'utilisateur (au lieu d'un champ texte)
- Met à jour le rôle via l'ID utilisateur

**Onglet "Créer un utilisateur"** (NOUVEAU):
- Formulaire complet de création d'utilisateur
- Champs: username (requis), email (optionnel), role (requis)
- Message informatif si l'email n'est pas fourni
- Boutons "Créer" et "Annuler"

**Adaptations**:
- Remplacement de "contributor" par "dev" dans les couleurs de rôles
- Suppression de l'onglet "Demandes de rôle"

### 7. ✅ Frontend - Dashboard adapté

**Fichier**: `frontend/src/pages/Dashboard.tsx`

- Changé `isContributor` en `isDev` partout
- Suppression de `handleRequestRoleChange()`
- Message pour les viewers modifié (plus de bouton de demande)
- Adaptation des imports et types

### 8. ✅ Frontend - AuthGuard mis à jour

**Fichier**: `frontend/src/components/AuthGuard.tsx`

- Changé `AuthUser` vers `User` (type complet)
- Adaptation de l'utilisateur simulé en mode DEV
- Appel de `authAPI.getCurrentUser()` au lieu de `checkOrCreateUser()`

### 9. ✅ Documentation

**Fichiers créés**:
- `INTEGRATION_GUIDE.md`: Guide complet d'intégration avec exemples
- `test_api.py`: Script Python pour tester tous les endpoints

## 🎯 Résumé des changements de terminologie

| Avant | Après |
|-------|-------|
| `contributor` | `dev` |
| `AuthUser` | `User` |
| Demande de changement de rôle | Supprimé |
| Username pour mise à jour | User ID pour mise à jour |

## 📊 Mapping complet des rôles et permissions

| Rôle | Voir pipelines | Créer pipeline | Lancer pipeline | Gérer utilisateurs |
|------|---------------|----------------|-----------------|-------------------|
| viewer | ✅ | ❌ | ❌ | ❌ |
| dev | ✅ | ✅ | ✅ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ |

## 🔗 Endpoints disponibles

### Authentification
- `GET /api/me` - Récupère l'utilisateur courant

### Gestion des utilisateurs (Admin uniquement)
- `GET /api/admin/users` - Liste tous les utilisateurs
- `POST /api/admin/users` - Crée un nouvel utilisateur
- `PUT /api/admin/users/{user_id}/role` - Met à jour le rôle

### Pipelines
- `GET /api/pipelines` - Liste tous les pipelines (tous)
- `POST /api/pipelines` - Crée un pipeline (dev, admin)
- `POST /api/pipelines/{id}/run` - Lance un pipeline (dev, admin)

## ✨ Nouvelles fonctionnalités

1. **Création manuelle d'utilisateurs**: Les admins peuvent créer des utilisateurs directement depuis l'interface
2. **Gestion centralisée des rôles**: Changement de rôle plus intuitif avec sélection d'utilisateur
3. **Traçabilité des pipelines**: Chaque pipeline enregistre qui l'a créé
4. **Statuts de pipeline**: Les pipelines ont maintenant un statut explicite
5. **Timestamps complets**: Tous les objets ont created_at et updated_at

## 🚀 Pour tester

1. **Démarrer le backend**:
```bash
cd backend
uvicorn app.main:app --reload
```

2. **Démarrer le frontend**:
```bash
cd frontend
npm run dev
```

3. **Tester les endpoints** (optionnel):
```bash
python test_api.py
```

4. **Accéder à l'interface**:
   - Ouvrir http://localhost:5173
   - En mode DEV, vous êtes automatiquement connecté en tant qu'admin
   - Aller dans le panneau d'administration pour créer des utilisateurs

## ⚠️ Notes importantes

- Le mode développement simule un utilisateur admin (voir AuthGuard.tsx ligne 18)
- Pour la production, désactiver `DEV_MODE = false` dans AuthGuard.tsx
- Les emails sont générés automatiquement si non fournis: `username@local`
- La base de données doit être réinitialisée si vous changez les modèles
