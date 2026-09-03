from pathlib import Path

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    class Config:
        # Resolved relative to this file so the app loads the same backend/.env
        # regardless of the directory uvicorn/alembic/pytest is launched from.
        env_file = str(Path(__file__).resolve().parent.parent / ".env")

settings = Settings()
