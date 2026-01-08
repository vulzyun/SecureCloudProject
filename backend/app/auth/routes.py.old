from fastapi import APIRouter, Depends
from ..models import User
from .proxy import get_current_user

router = APIRouter(prefix="/api", tags=["Authentication"])

@router.get(
    "/me",
    summary="Get current user information",
    description="""
    Returns the currently authenticated user's information.
    
    In DEV mode, returns a default admin user (admin@test.com).
    In PROD mode, extracts user from oauth2-proxy headers.
    
    **Authentication:**
    - DEV: Automatic admin user
    - PROD: Requires oauth2-proxy headers (X-Auth-Request-User, X-Auth-Request-Email)
    """,
    responses={
        200: {
            "description": "Current user information",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "username": "admin_test",
                        "email": "admin@test.com",
                        "role": "admin",
                        "created_at": "2026-01-06T10:30:00Z",
                        "updated_at": "2026-01-06T10:30:00Z"
                    }
                }
            }
        },
        401: {
            "description": "Unauthenticated - Missing oauth2-proxy headers",
            "content": {
                "application/json": {
                    "example": {"detail": "Unauthenticated (missing oauth2-proxy headers)"}
                }
            }
        }
    }
)
def me(user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return user
