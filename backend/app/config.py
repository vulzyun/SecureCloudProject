from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    env: str = "prod"
    database_url: str = "sqlite:///./data.db"
    frontend_url: str = "http://localhost:5173"

    # si l'email match, on force ADMIN (pratique pour démarrer)
    bootstrap_admin_email: str | None = None

settings = Settings()
