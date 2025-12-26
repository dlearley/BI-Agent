from __future__ import annotations

"""Shared pytest fixtures for the Connector API tests."""

import importlib
import os
from pathlib import Path
from typing import Generator

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

# Configure environment for tests before importing the application modules.
TEST_DB_PATH = Path(__file__).parent / "test_datasources.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ.setdefault("DATABASE_URL", f"sqlite+pysqlite:///{TEST_DB_PATH}")
os.environ.setdefault("CELERY_BROKER_URL", "memory://")
os.environ.setdefault("CELERY_RESULT_BACKEND", "rpc://")
os.environ.setdefault("CELERY_TASK_ALWAYS_EAGER", "1")
os.environ.setdefault("CELERY_TASK_EAGER_PROPAGATES", "1")
os.environ.setdefault("KMS_FERNET_KEY", Fernet.generate_key().decode())

import apps.api.app.config as app_config
import apps.api.app.connectors.kms as kms_module
import apps.api.app.database as database_module
import apps.api.app.tasks.celery_app as celery_app_module
import apps.api.app.tasks.datasource as datasource_tasks_module
from apps.api.app.connectors.registry import registry


@pytest.fixture(scope="session", autouse=True)
def configure_application_state() -> Generator[None, None, None]:
    """Ensure application modules honour the test configuration."""

    app_config.get_settings.cache_clear()
    app_config.settings = app_config.get_settings()
    database_module.configure_engine(app_config.settings.database_url)
    database_module.init_db()
    kms_module.kms_client = kms_module.build_kms(app_config.settings)
    importlib.reload(celery_app_module)
    importlib.reload(datasource_tasks_module)
    try:
        yield
    finally:
        database_module.Base.metadata.drop_all(bind=database_module.engine)
        if TEST_DB_PATH.exists():
            TEST_DB_PATH.unlink()


@pytest.fixture(autouse=True)
def clean_state() -> Generator[None, None, None]:
    """Reset registry and database tables between tests."""

    registry.clear()
    database_module.Base.metadata.drop_all(bind=database_module.engine)
    database_module.Base.metadata.create_all(bind=database_module.engine)
    yield
    registry.clear()
    database_module.Base.metadata.drop_all(bind=database_module.engine)


@pytest.fixture()
def client() -> TestClient:
    from apps.api.app.main import app

    return TestClient(app)
