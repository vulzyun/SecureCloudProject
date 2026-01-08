from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    env: str = "dev"  # Par défaut en mode dev pour développement local
    database_url: str = "sqlite:///./data.db"
    frontend_url: str = "http://localhost:5173"

    # si l'email match, on force ADMIN (pratique pour démarrer)
    bootstrap_admin_email: str | None = None
    
    # Token SonarCloud
    sonar_token: str | None = None

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
