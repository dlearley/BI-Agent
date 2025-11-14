from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False
    )
    
    app_name: str = "NL2SQL Service"
    app_version: str = "1.0.0"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/analytics_db"
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl: int = 3600
    
    # LLM Configuration
    llm_provider: str = "openai"
    llm_api_key: Optional[str] = None
    llm_api_base: Optional[str] = None
    llm_model: str = "gpt-4"
    llm_temperature: float = 0.0
    llm_max_tokens: int = 2000
    
    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    
    # SQL Safety
    max_query_cost: float = 1000.0
    allowed_operations: list[str] = ["SELECT"]
    blocked_tables: list[str] = []
    max_rows_estimate: int = 10000
    
    # Vector Store
    embedding_dimension: int = 1536
    top_k_schemas: int = 5


settings = Settings()
