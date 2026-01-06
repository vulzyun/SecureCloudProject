from fastapi import Header, HTTPException, Depends
from sqlmodel import Session, select
from ..db import get_session
from ..models import User, Role
from ..config import settings

def get_identity_from_headers(
    x_auth_request_email: str | None = Header(default=None, alias="X-Auth-Request-Email"),
    x_auth_request_user: str | None = Header(default=None, alias="X-Auth-Request-User"),
    x_forwarded_email: str | None = Header(default=None, alias="X-Forwarded-Email"),
    x_forwarded_user: str | None = Header(default=None, alias="X-Forwarded-User"),
) -> dict:
    """
    oauth2-proxy peut injecter différentes variantes selon le mode (auth_request / reverse-proxy).
    On accepte plusieurs noms.
    """
    email = x_auth_request_email or x_forwarded_email
    username = x_auth_request_user or x_forwarded_user

    if not email and not username:
        raise HTTPException(status_code=401, detail="Unauthenticated (missing oauth2-proxy headers)")

    if not username and email:
        username = email.split("@")[0]

    # si pas d'email, on fabrique un email technique (rare, mais évite None)
    if not email:
        email = f"{username}@local"

    return {"email": email, "username": username}

def get_current_user(
    ident: dict = Depends(get_identity_from_headers),
    session: Session = Depends(get_session),
) -> User:
    email = ident["email"]
    username = ident["username"]

    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        role = Role.viewer
        # bootstrap admin
        if settings.bootstrap_admin_email and email.lower() == settings.bootstrap_admin_email.lower():
            role = Role.admin

        user = User(email=email, username=username, role=role)
        session.add(user)
        session.commit()
        session.refresh(user)
    else:
        # si c'est l'admin bootstrap, on s'assure que le rôle reste admin
        if settings.bootstrap_admin_email and email.lower() == settings.bootstrap_admin_email.lower():
            if user.role != Role.admin:
                user.role = Role.admin
                session.add(user)
                session.commit()
                session.refresh(user)

    return user

def require_role(*roles: Role):
    def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return _guard
