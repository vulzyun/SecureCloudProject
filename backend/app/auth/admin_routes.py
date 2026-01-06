from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..db import get_session
from ..models import User, Role
from .proxy import require_role

router = APIRouter(prefix="/api/admin")

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
