from __future__ import annotations

"""FastAPI application entrypoint for the Connector API service."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import settings
from .database import init_db
from .routes import datasources


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.include_router(datasources.router)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
