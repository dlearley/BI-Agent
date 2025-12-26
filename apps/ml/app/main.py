from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.config import settings
from app.models import (
    NL2SQLRequest,
    NL2SQLResponse,
    MaterializeTaskRequest,
    QueryValidationResult
)
from app.services.nl2sql import nl2sql_service
from app.services.vector_store import vector_store
from app.tasks.materialize import materialize_query_results


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Setup database tables
    try:
        vector_store.setup_schema_embeddings_table()
        print("Vector store initialized")
    except Exception as e:
        print(f"Warning: Could not initialize vector store: {e}")
    
    yield
    
    # Shutdown: Cleanup
    vector_store.close()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Natural Language to SQL conversion service with safety rails",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version
    }


@app.post("/nl2sql", response_model=NL2SQLResponse)
async def nl2sql_endpoint(request: NL2SQLRequest):
    """
    Convert natural language question to SQL query.
    
    - Fetches relevant schema from vector store
    - Uses LLM with few-shot prompting to generate SQL
    - Validates SQL with safety rails
    - Returns executable SQL with cost estimates
    """
    try:
        response = await nl2sql_service.generate_sql(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/materialize")
async def materialize_endpoint(
    request: MaterializeTaskRequest,
    background_tasks: BackgroundTasks
):
    """
    Materialize query results as a table using Celery task.
    
    - Validates the query exists and is valid
    - Submits Celery task to materialize results
    - Returns task ID for tracking
    """
    try:
        # Submit Celery task
        task = materialize_query_results.apply_async(
            args=[request.query_id, request.org_id, request.output_table]
        )
        
        return {
            "status": "submitted",
            "task_id": task.id,
            "query_id": request.query_id,
            "message": "Materialization task submitted"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/materialize/{task_id}")
async def get_materialization_status(task_id: str):
    """
    Get the status of a materialization task.
    """
    from app.tasks.celery_app import celery_app
    
    task = celery_app.AsyncResult(task_id)
    
    return {
        "task_id": task_id,
        "status": task.status,
        "result": task.result if task.ready() else None
    }


@app.post("/cache/invalidate")
async def invalidate_cache(org_id: str, question: str = None):
    """
    Invalidate query cache.
    
    - If question provided, invalidates specific cache entry
    - Otherwise, clears all cache for org
    """
    from app.services.query_cache import query_cache
    
    if question:
        success = query_cache.invalidate(question, org_id)
        return {
            "status": "success" if success else "error",
            "message": f"Cache invalidated for question"
        }
    else:
        count = query_cache.clear_all(org_id)
        return {
            "status": "success",
            "message": f"Cleared {count} cache entries for org {org_id}"
        }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )
