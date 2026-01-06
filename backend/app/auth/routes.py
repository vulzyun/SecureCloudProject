from fastapi import APIRouter, Depends
from ..models import User
from .proxy import get_current_user

router = APIRouter(prefix="/api")

@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user
