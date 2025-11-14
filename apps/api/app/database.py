from __future__ import annotations

"""Database utilities and session management."""

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


def _create_engine(database_url: str) -> Engine:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, echo=False, future=True, connect_args=connect_args)


engine: Engine = _create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""


def configure_engine(database_url: str) -> None:
    """Reconfigure engine and session factory (useful for tests)."""

    global engine, SessionLocal
    engine = _create_engine(database_url)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session for FastAPI dependencies."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Provide a transactional scope around a series of operations."""

    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:  # pragma: no cover - defensive rollback
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    """Initialize database schema if it does not already exist."""

    Base.metadata.create_all(bind=engine)
