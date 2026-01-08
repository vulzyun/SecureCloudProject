from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..db import get_session
from ..models import User, Role, RoleRequest, RequestStatus, Pipeline
from .proxy import require_role

router = APIRouter(prefix="/api/admin", tags=["Admin - User Management"])

@router.post(
    "/users",
    status_code=201,
    summary="Create a new user",
    description="""
    Create a new user with specified username and role.
    
    **Permissions:** Admin only
    
    **Available roles:**
    - `viewer`: Can only view pipelines and runs
    - `dev`: Can view, create and run pipelines
    - `admin`: Full access including user management
    
    **Request body:**
    ```json
    {
      "username": "john_doe",
      "role": "dev",
      "email": "john@company.com"  // optional, auto-generated if not provided
    }
    ```
    """,
    responses={
        201: {
            "description": "User created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": 2,
                        "username": "john_doe",
                        "email": "john_doe@local",
                        "role": "dev",
                        "created_at": "2026-01-06T10:30:00Z",
                        "updated_at": "2026-01-06T10:30:00Z"
                    }
                }
            }
        },
        400: {
            "description": "Invalid role or user already exists",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_role": {
                            "summary": "Invalid role",
                            "value": {"detail": "Invalid role"}
                        },
                        "user_exists": {
                            "summary": "User already exists",
                            "value": {"detail": "User already exists"}
                        }
                    }
                }
            }
        },
        403: {
            "description": "Forbidden - Admin access required"
        }
    }
)
def create_user(
    payload: dict,
    session: Session = Depends(get_session),
    _: User = Depends(require_role(Role.admin)),
):
    """Create a new user (admin only)."""
    username = payload.get("username")
    role = payload.get("role", "viewer")
    
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    
    if role not in {r.value for r in Role}:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Vérifier si l'utilisateur existe déjà
    existing = session.exec(select(User).where(User.username == username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Créer un email basé sur le username
    email = payload.get("email", f"{username}@local")
    
    user = User(email=email, username=username, role=Role(role))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@router.get(
    "/users",
    summary="List all users",
    description="""
    Retrieve a list of all users in the system.
    
    **Permissions:** Admin only
    
    Returns all user information including ID, username, email, role and timestamps.
    """,
    responses={
        200: {
            "description": "List of all users",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": 1,
                            "username": "admin_test",
                            "email": "admin@test.com",
                            "role": "admin",
                            "created_at": "2026-01-06T10:30:00Z"
                        },
                        {
                            "id": 2,
                            "username": "john_doe",
                            "email": "john.doe@company.com",
                            "role": "dev",
                            "created_at": "2026-01-06T11:00:00Z"
                        }
                    ]
                }
            }
        },
        403: {"description": "Forbidden - Admin access required"}
    }
)
def list_users(
    session: Session = Depends(get_session),
    _: User = Depends(require_role(Role.admin)),
):
    """List all users (admin only)."""
    return session.exec(select(User).order_by(User.id.desc())).all()

@router.put(
    "/users/{user_id}/role",
    summary="Update user role",
    description="""
    Change the role of an existing user.
    
    **Permissions:** Admin only
    
    **Request body:**
    ```json
    {
      "role": "admin"  // viewer, dev, or admin
    }
    ```
    """,
    responses={
        200: {
            "description": "Role updated successfully",
            "content": {
                "application/json": {
                    "example": {"ok": True, "id": 2, "role": "admin"}
                }
            }
        },
        400: {"description": "Invalid role"},
        403: {"description": "Forbidden - Admin access required"},
        404: {"description": "User not found"}
    }
)
def set_role(
    user_id: int,
    payload: dict,
    session: Session = Depends(get_session),
    _: User = Depends(require_role(Role.admin)),
):
    """Update user role (admin only)."""
    role = payload.get("role")
    if role not in {r.value for r in Role}:
        raise HTTPException(status_code=400, detail="Invalid role")

    u = session.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    u.role = Role(role)
    session.add(u)
    session.commit()
    session.refresh(u)
    return {"ok": True, "id": u.id, "role": u.role}

@router.delete(
    "/users/{user_id}",
    summary="Delete a user",
    description="""
    Delete a user from the system.
    
    **Permissions:** Admin only
    
    **Behavior:**
    - Deletes the user account
    - Deletes all pending and rejected role requests for this user
    - Approved role requests are kept for audit purposes
    - Pipelines created by the user are preserved (created_by field is cleared)
    - Runs created by the user are preserved (created_by field is cleared)
    
    **Note:** An admin cannot delete themselves. At least one admin must remain in the system.
    """,
    responses={
        200: {
            "description": "User deleted successfully",
            "content": {
                "application/json": {
                    "example": {
                        "ok": True,
                        "id": 2,
                        "username": "john_doe",
                        "deleted_role_requests": 2
                    }
                }
            }
        },
        400: {"description": "Bad request - Cannot delete the last admin or yourself"},
        403: {"description": "Forbidden - Admin access required"},
        404: {"description": "User not found"}
    }
)
def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_role(Role.admin)),
):
    """Delete a user (admin only)."""
    # Récupérer l'utilisateur à supprimer
    user_to_delete = session.get(User, user_id)
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Empêcher un admin de se supprimer lui-même
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    
    # Empêcher de supprimer le dernier admin
    if user_to_delete.role == Role.admin:
        admin_count = session.exec(select(User).where(User.role == Role.admin)).all()
        if len(admin_count) <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin user")
    
    # Supprimer les demandes de rôle associées (sauf les approbations pour audit)
    role_requests = session.exec(
        select(RoleRequest).where(RoleRequest.user_id == user_id)
    ).all()
    deleted_requests = 0
    for request in role_requests:
        if request.status != RequestStatus.approved:
            session.delete(request)
            deleted_requests += 1
    
    # Nettoyer les pipelines créés par cet utilisateur (garder les pipelines mais effacer created_by)
    pipelines = session.exec(
        select(Pipeline).where(Pipeline.created_by == user_to_delete.username)
    ).all()
    for pipeline in pipelines:
        pipeline.created_by = ""
        session.add(pipeline)
    
    # Supprimer l'utilisateur
    session.delete(user_to_delete)
    session.commit()
    
    return {
        "ok": True,
        "id": user_id,
        "username": user_to_delete.username,
        "deleted_role_requests": deleted_requests
    }

# ========================
# ROLE REQUEST MANAGEMENT
# ========================

@router.get(
    "/role-requests",
    summary="List all pending role requests",
    description="""
    Retrieve a list of all pending role requests in the system.
    
    **Permissions:** Admin only
    
    Returns role requests with user information.
    """,
    responses={
        200: {
            "description": "List of role requests",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": 1,
                            "user_id": 2,
                            "requested_role": "admin",
                            "status": "pending",
                            "created_at": "2026-01-08T10:30:00Z",
                            "updated_at": "2026-01-08T10:30:00Z"
                        }
                    ]
                }
            }
        },
        403: {"description": "Forbidden - Admin access required"}
    }
)
def list_role_requests(
    session: Session = Depends(get_session),
    _: User = Depends(require_role(Role.admin)),
):
    """List all pending role requests (admin only)."""
    requests = session.exec(
        select(RoleRequest)
        .where(RoleRequest.status == RequestStatus.pending)
        .order_by(RoleRequest.created_at.asc())
    ).all()
    return requests

@router.put(
    "/role-requests/{request_id}/approve",
    summary="Approve a role request",
    description="""
    Approve a role request and update the user's role accordingly.
    
    **Permissions:** Admin only
    """,
    responses={
        200: {
            "description": "Role request approved and user role updated",
            "content": {
                "application/json": {
                    "example": {
                        "ok": True,
                        "request_id": 1,
                        "user_id": 2,
                        "new_role": "admin"
                    }
                }
            }
        },
        403: {"description": "Forbidden - Admin access required"},
        404: {"description": "Role request not found"}
    }
)
def approve_role_request(
    request_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_role(Role.admin)),
):
    """Approve a role request (admin only)."""
    role_request = session.get(RoleRequest, request_id)
    if not role_request:
        raise HTTPException(status_code=404, detail="Role request not found")
    
    # Récupérer l'utilisateur
    user = session.get(User, role_request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Mettre à jour le rôle de l'utilisateur
    user.role = role_request.requested_role
    role_request.status = RequestStatus.approved
    
    session.add(user)
    session.add(role_request)
    session.commit()
    
    return {
        "ok": True,
        "request_id": role_request.id,
        "user_id": user.id,
        "new_role": user.role
    }

@router.put(
    "/role-requests/{request_id}/reject",
    summary="Reject a role request",
    description="""
    Reject a role request.
    
    **Permissions:** Admin only
    """,
    responses={
        200: {
            "description": "Role request rejected",
            "content": {
                "application/json": {
                    "example": {
                        "ok": True,
                        "request_id": 1
                    }
                }
            }
        },
        403: {"description": "Forbidden - Admin access required"},
        404: {"description": "Role request not found"}
    }
)
def reject_role_request(
    request_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_role(Role.admin)),
):
    """Reject a role request (admin only)."""
    role_request = session.get(RoleRequest, request_id)
    if not role_request:
        raise HTTPException(status_code=404, detail="Role request not found")
    
    role_request.status = RequestStatus.rejected
    session.add(role_request)
    session.commit()
    
    return {
        "ok": True,
        "request_id": role_request.id
    }
