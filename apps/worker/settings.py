"""
Settings for Celery Worker Application
"""

import os
from typing import Optional
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Application settings"""
    
    # Database settings
    database_url: str = Field(
        default="postgresql://user:password@localhost:5432/analytics_db",
        env="DATABASE_URL"
    )
    
    # Redis settings
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        env="REDIS_URL"
    )
    
    # Celery settings
    celery_broker_url: Optional[str] = Field(default=None, env="CELERY_BROKER_URL")
    celery_result_backend: Optional[str] = Field(default=None, env="CELERY_RESULT_BACKEND")
    
    # dbt settings
    dbt_project_path: str = Field(
        default="/home/engine/project/dbt",
        env="DBT_PROJECT_PATH"
    )
    dbt_profiles_dir: str = Field(
        default="/home/engine/project/dbt",
        env="DBT_PROFILES_DIR"
    )
    
    # API settings for communicating with main service
    analytics_api_url: str = Field(
        default="http://localhost:3000",
        env="ANALYTICS_API_URL"
    )
    api_secret_key: str = Field(
        default="your-secret-key",
        env="API_SECRET_KEY"
    )
    
    # Monitoring settings
    prometheus_port: int = Field(
        default=8000,
        env="PROMETHEUS_PORT"
    )
    flower_port: int = Field(
        default=5555,
        env="FLOWER_PORT"
    )
    
    # Circuit breaker settings
    circuit_breaker_failure_threshold: int = Field(
        default=5,
        env="CIRCUIT_BREAKER_FAILURE_THRESHOLD"
    )
    circuit_breaker_recovery_timeout: int = Field(
        default=60,
        env="CIRCUIT_BREAKER_RECOVERY_TIMEOUT"
    )
    
    # Retry settings
    task_default_retry_delay: int = Field(
        default=60,
        env="TASK_DEFAULT_RETRY_DELAY"
    )
    task_max_retries: int = Field(
        default=3,
        env="TASK_MAX_RETRIES"
    )
    
    # Concurrency settings
    worker_concurrency_analytics: int = Field(
        default=2,
        env="WORKER_CONCURRENCY_ANALYTICS"
    )
    worker_concurrency_dbt: int = Field(
        default=1,
        env="WORKER_CONCURRENCY_DBT"
    )
    worker_concurrency_alerts: int = Field(
        default=4,
        env="WORKER_CONCURRENCY_ALERTS"
    )
    worker_concurrency_reports: int = Field(
        default=2,
        env="WORKER_CONCURRENCY_REPORTS"
    )
    
    # Alert settings
    alert_webhook_url: Optional[str] = Field(default=None, env="ALERT_WEBHOOK_URL")
    alert_email_smtp_host: Optional[str] = Field(default=None, env="ALERT_EMAIL_SMTP_HOST")
    alert_email_smtp_port: int = Field(default=587, env="ALERT_EMAIL_SMTP_PORT")
    alert_email_username: Optional[str] = Field(default=None, env="ALERT_EMAIL_USERNAME")
    alert_email_password: Optional[str] = Field(default=None, env="ALERT_EMAIL_PASSWORD")
    
    # Report settings
    report_output_dir: str = Field(
        default="/tmp/reports",
        env="REPORT_OUTPUT_DIR"
    )
    report_retention_days: int = Field(
        default=30,
        env="REPORT_RETENTION_DAYS"
    )
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    @property
    def celery_broker_url_resolved(self) -> str:
        """Get Celery broker URL with fallback to Redis URL"""
        return self.celery_broker_url or self.redis_url
    
    @property
    def celery_result_backend_resolved(self) -> str:
        """Get Celery result backend URL with fallback to Redis URL"""
        return self.celery_result_backend or self.redis_url


# Global settings instance
settings = Settings()