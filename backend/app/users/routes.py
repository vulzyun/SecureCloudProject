from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from datetime import datetime
from ..db import get_session
from ..models import User, Role, RoleRequest, RequestStatus
from ..auth.proxy import require_role, get_current_user

router = APIRouter(prefix="/api/users", tags=["Users"])

# Fonction utilitaire pour obtenir le rôle suivant
def get_next_roles(current_role: Role) -> list[Role]:
    """Retourne la liste des rôles supérieurs possibles"""
    if current_role == Role.viewer:
        return [Role.dev, Role.admin]
    elif current_role == Role.dev:
        return [Role.admin]
    else:  # admin
        return []

@router.post(
    "/me/request-role",
    summary="Demander une promotion de rôle",
    description="""
    Les utilisateurs avec les rôles 'viewer' ou 'dev' peuvent demander une promotion.
    
    **Permissions:** Authenticated users with role 'viewer' or 'dev'
    
    **Request body:**
    ```json
    {
      "requested_role": "admin"  // ou "dev" si actuellement viewer
    }
    ```
    """,
    responses={
        201: {
            "description": "Demande de rôle créée avec succès",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "user_id": 2,
                        "requested_role": "admin",
                        "status": "pending",
                        "created_at": "2026-01-08T10:30:00Z"
                    }
                }
            }
        },
        400: {
            "description": "Demande invalide",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_role": {
                            "summary": "Rôle invalide ou déjà possédé",
                            "value": {"detail": "Invalid requested role"}
                        },
                        "pending_request": {
                            "summary": "Demande déjà en attente",
                            "value": {"detail": "Pending request already exists for this role"}
                        },
                        "admin_cannot_request": {
                            "summary": "Admin ne peut pas demander",
                            "value": {"detail": "Admin users cannot request role changes"}
                        }
                    }
                }
            }
        },
        403: {
            "description": "Forbidden - Only viewer and dev can request roles"
        }
    }
)
def request_role(
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Demander une promotion de rôle (viewer ou dev seulement)."""
    
    # Les admins ne peuvent pas demander une promotion
    if current_user.role == Role.admin:
        raise HTTPException(status_code=403, detail="Admin users cannot request role changes")
    
    requested_role_str = payload.get("requested_role")
    if not requested_role_str:
        raise HTTPException(status_code=400, detail="requested_role is required")
    
    # Vérifier que le rôle demandé existe
    try:
        requested_role = Role(requested_role_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid requested role")
    
    # Vérifier que le rôle demandé est supérieur au rôle actuel
    next_roles = get_next_roles(current_user.role)
    if requested_role not in next_roles:
        raise HTTPException(status_code=400, detail="Invalid requested role")
    
    # Vérifier s'il existe déjà une demande en attente pour ce rôle
    existing = session.exec(
        select(RoleRequest).where(
            (RoleRequest.user_id == current_user.id) &
            (RoleRequest.requested_role == requested_role) &
            (RoleRequest.status == RequestStatus.pending)
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Pending request already exists for this role")
    
    # Créer la demande
    role_request = RoleRequest(
        user_id=current_user.id,
        requested_role=requested_role,
        status=RequestStatus.pending
    )
    session.add(role_request)
    session.commit()
    session.refresh(role_request)
    
    return role_request

@router.get(
    "/me/requests",
    summary="Voir ses demandes de rôle",
    description="""
    Récupère toutes les demandes de rôle pour l'utilisateur connecté.
    
    **Permissions:** Authenticated users
    """,
    responses={
        200: {
            "description": "Liste des demandes",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": 1,
                            "user_id": 2,
                            "requested_role": "admin",
                            "status": "pending",
                            "created_at": "2026-01-08T10:30:00Z"
                        }
                    ]
                }
            }
        }
    }
)
def get_my_requests(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Récupérer mes demandes de rôle."""
    requests = session.exec(
        select(RoleRequest)
        .where(RoleRequest.user_id == current_user.id)
        .order_by(RoleRequest.created_at.desc())
    ).all()
    return requests

@router.get(
    "/me/available-roles",
    summary="Voir les rôles disponibles à demander",
    description="""
    Retourne la liste des rôles que l'utilisateur peut demander.
    Pour les admins, retourne une liste vide.
    
    **Permissions:** Authenticated users
    """,
    responses={
        200: {
            "description": "Rôles disponibles",
            "content": {
                "application/json": {
                    "example": ["dev", "admin"]
                }
            }
        }
    }
)
def get_available_roles(
    current_user: User = Depends(get_current_user),
):
    """Obtenir les rôles disponibles à demander."""
    if current_user.role == Role.admin:
        return []
    return [role.value for role in get_next_roles(current_user.role)]
