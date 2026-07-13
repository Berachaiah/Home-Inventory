from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str = "akanbi-inventory-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    GROQ_API_KEY: str = ""
    SUPABASE_URL: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "admin@akanbi.local"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
