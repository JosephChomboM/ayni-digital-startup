from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "localhost"
    database_url: str = "postgresql+psycopg://ayni:ayni@localhost:5432/ayni"

    # LLM for the nlp module. Without a key, entity extraction uses spaCy only.
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-20b"
    llm_timeout_seconds: float = 5.0

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # Supabase gives DATABASE_URL as postgresql://; SQLAlchemy needs the driver.
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
