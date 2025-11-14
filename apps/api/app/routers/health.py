from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check endpoint"""
    try:
        # Test database connection
        await db.execute(text("SELECT 1"))
        return HealthResponse(
            status="healthy",
            database="connected"
        )
    except Exception as e:
        return HealthResponse(
            status="unhealthy",
            database="disconnected",
            error=str(e)
        )