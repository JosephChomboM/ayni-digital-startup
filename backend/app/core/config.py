from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Written by the deploy pipeline with the commit SHA, so smoke tests can confirm
# that the new version is the one answering.
VERSION_FILE = Path(__file__).resolve().parents[2] / "VERSION"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "localhost"
    database_url: str = "postgresql+psycopg://ayni:ayni@localhost:5432/ayni"

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # Railway exposes DATABASE_URL as postgresql://; SQLAlchemy needs the driver.
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def version(self) -> str:
        return VERSION_FILE.read_text().strip() if VERSION_FILE.exists() else "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()
