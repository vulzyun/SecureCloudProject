from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .db import init_db
from .auth.routes import router as auth_router
from .pipelines.routes import router as pipelines_router
from .auth.admin_routes import router as admin_router
from .users.routes import router as users_router

app = FastAPI(title="CI/CD API")

# CORS - autoriser le frontend direct ET oauth2-proxy
allowed_origins = [
    "http://localhost:5173",      # Frontend Vite direct
    "http://localhost:4180",      # oauth2-proxy
    "http://127.0.0.1:5173",      # Frontend Vite via 127.0.0.1
    "http://127.0.0.1:4180",      # oauth2-proxy via 127.0.0.1
    "http://0.0.0.0:5173",        # Vite sur toutes les interfaces
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.on_event("startup")
def _startup():
    init_db()

@app.get(
    "/api/health",
    tags=["Health"],
    summary="Health check endpoint",
    description="""
    Check if the API is running and responsive.
    
    **No authentication required.**
    
    Returns a simple status indicator.
    """,
    responses={
        200: {
            "description": "API is healthy",
            "content": {
                "application/json": {
                    "example": {"status": "UP"}
                }
            }
        }
    }
)
def health():
    """Health check endpoint."""
    return {"status": "UP"}

app.include_router(auth_router)
app.include_router(pipelines_router)
app.include_router(admin_router)
app.include_router(users_router)
