from __future__ import annotations

"""Application configuration settings for the Connector API service."""

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env files."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field(default="Connector API Service")
    app_version: str = Field(default="1.0.0")

    database_url: str = Field(default="sqlite+pysqlite:///./connectors.db", alias="DATABASE_URL")

    kms_provider: str = Field(default="local_fernet", alias="KMS_PROVIDER")
    kms_fernet_key: Optional[str] = Field(default=None, alias="KMS_FERNET_KEY")
    kms_aws_key_id: Optional[str] = Field(default=None, alias="KMS_AWS_KEY_ID")

    celery_broker_url: str = Field(default="memory://", alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(default="rpc://", alias="CELERY_RESULT_BACKEND")
    celery_task_always_eager: bool = Field(default=True, alias="CELERY_TASK_ALWAYS_EAGER")
    celery_task_eager_propagates: bool = Field(default=True, alias="CELERY_TASK_EAGER_PROPAGATES")

    sdk_default_timeout: float = Field(default=30.0, alias="SDK_DEFAULT_TIMEOUT")


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings instance."""

    return Settings()


settings = get_settings()
