from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..db import get_session
from ..models import User, Role
from .proxy import require_role

router = APIRouter(prefix="/api/admin")

@router.post("/users")
def create_user(
    payload: dict,
    session: Session = Depends(get_session),
    _: User = Depends(require_role(Role.admin)),
):
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

@router.get("/users")
def list_users(
    session: Session = Depends(get_session),
    _: User = Depends(require_role(Role.admin)),
):
    return session.exec(select(User).order_by(User.id.desc())).all()

@router.put("/users/{user_id}/role")
def set_role(
    user_id: int,
    payload: dict,
    session: Session = Depends(get_session),
    _: User = Depends(require_role(Role.admin)),
):
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
