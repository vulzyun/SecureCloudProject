from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .db import init_db
from .auth.routes import router as auth_router
from .pipelines.routes import router as pipelines_router
from .auth.admin_routes import router as admin_router  # ✅ si tu crées le fichier

app = FastAPI(title="CI/CD API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,  # cookies via proxy
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _startup():
    init_db()

@app.get("/api/health")
def health():
    return {"status": "UP"}

app.include_router(auth_router)
app.include_router(pipelines_router)
app.include_router(admin_router)  # ✅
