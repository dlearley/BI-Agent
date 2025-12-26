from __future__ import annotations

"""Dependency helpers for FastAPI routes."""

from typing import Generator

from sqlalchemy.orm import Session

from .connectors.kms import KMSClient, kms_client
from .connectors.registry import ConnectorRegistry, registry
from .database import get_db as _get_db


def get_db() -> Generator[Session, None, None]:
    yield from _get_db()


def get_registry() -> ConnectorRegistry:
    return registry


def get_kms() -> KMSClient:
    return kms_client
