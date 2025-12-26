from __future__ import annotations

"""FastAPI application entrypoint with health checks and datasource connectors."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import from both branches
from app.core.config import settings
from app.core.database import engine, init_db
from app.routers import health
from app.routes import datasources
from app.models import Base


async def create_tables():
    """Create database tables (from core setup branch)"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Application lifespan handler (from connector framework branch)"""
    init_db()
    await create_tables()
    yield


def create_application() -> FastAPI:
    """Create and configure FastAPI application with both route sets"""
    app = FastAPI(
        title=settings.api_title,
        version=settings.api_version,
        description=settings.api_description,
        lifespan=lifespan,
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers from both branches
    app.include_router(health.router, prefix="/api/v1", tags=["health"])
    app.include_router(datasources.router, prefix="/api/v1/datasources", tags=["datasources"])
    
    return app


app = create_application()
