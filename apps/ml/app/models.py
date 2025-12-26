from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class NL2SQLRequest(BaseModel):
    question: str = Field(..., description="Natural language question")
    org_id: str = Field(..., description="Organization ID for context")
    user_id: Optional[str] = Field(None, description="User ID for audit trail")
    schema_hints: Optional[List[str]] = Field(None, description="Optional schema hints")


class QueryValidationResult(BaseModel):
    is_valid: bool
    sql: Optional[str] = None
    errors: List[str] = []
    warnings: List[str] = []
    estimated_cost: Optional[float] = None
    estimated_rows: Optional[int] = None


class NL2SQLResponse(BaseModel):
    query_id: str
    question: str
    sql: str
    validation: QueryValidationResult
    cost_estimate: float
    cached: bool = False
    execution_time_ms: float


class QueryExecutionRequest(BaseModel):
    query_id: str
    execute: bool = False
    materialize: bool = False


class SchemaEmbedding(BaseModel):
    table_name: str
    schema_definition: str
    description: Optional[str]
    similarity_score: float


class FewShotExample(BaseModel):
    question: str
    sql: str
    context: Optional[str] = None


class MaterializeTaskRequest(BaseModel):
    query_id: str
    org_id: str
    output_table: Optional[str] = None
