import re
import uuid
import time
from typing import Dict, Any
from app.models import NL2SQLRequest, NL2SQLResponse, QueryValidationResult
from app.services.llm_client import llm_client
from app.services.vector_store import vector_store
from app.services.sql_validator import validator
from app.services.cost_estimator import cost_estimator
from app.services.query_cache import query_cache
from app.prompts.few_shot_examples import build_prompt, SYSTEM_PROMPT, FEW_SHOT_EXAMPLES
import psycopg2
from app.config import settings


class NL2SQLService:
    def __init__(self):
        self.llm = llm_client
        self.vector_store = vector_store
        self.validator = validator
        self.cache = query_cache
    
    async def generate_sql(self, request: NL2SQLRequest) -> NL2SQLResponse:
        start_time = time.time()
        
        # Check cache first
        cached_result = self.cache.get(request.question, request.org_id)
        if cached_result:
            return NL2SQLResponse(
                query_id=cached_result['query_id'],
                question=request.question,
                sql=cached_result['sql'],
                validation=QueryValidationResult(**cached_result['validation']),
                cost_estimate=cached_result['cost_estimate'],
                cached=True,
                execution_time_ms=(time.time() - start_time) * 1000
            )
        
        # Generate embedding for the question
        question_embedding = self.llm.generate_embedding(request.question)
        
        # Fetch relevant schemas from vector store
        relevant_schemas = self.vector_store.fetch_relevant_schemas(
            question_embedding,
            request.org_id
        )
        
        # Build schema context
        schema_contexts = []
        for schema in relevant_schemas:
            schema_contexts.append(
                f"Table: {schema.table_name}\n"
                f"Schema:\n{schema.schema_definition}\n"
                f"Description: {schema.description}\n"
                f"Relevance: {schema.similarity_score:.2f}"
            )
        
        # Build prompt with few-shot examples
        prompt = build_prompt(
            request.question,
            schema_contexts,
            FEW_SHOT_EXAMPLES
        )
        
        # Generate SQL using LLM
        raw_sql = self.llm.generate_sql(prompt, SYSTEM_PROMPT)
        
        # Clean up the SQL (remove markdown code blocks if present)
        sql = self._clean_sql(raw_sql)
        
        # Validate the SQL
        validation = self.validator.validate(sql)
        
        if not validation.is_valid:
            # Return error response
            query_id = str(uuid.uuid4())
            return NL2SQLResponse(
                query_id=query_id,
                question=request.question,
                sql=sql,
                validation=validation,
                cost_estimate=0.0,
                cached=False,
                execution_time_ms=(time.time() - start_time) * 1000
            )
        
        # Get cost estimate
        cost_info = cost_estimator.estimate_cost(
            sql,
            validation.estimated_cost
        )
        
        # Store query in database
        query_id = self._store_query(
            request.org_id,
            request.user_id,
            request.question,
            sql,
            validation,
            cost_info
        )
        
        # Cache the result
        cache_data = {
            'query_id': query_id,
            'sql': sql,
            'validation': validation.model_dump(),
            'cost_estimate': cost_info['estimated_cost']
        }
        self.cache.set(request.question, request.org_id, cache_data)
        
        execution_time = (time.time() - start_time) * 1000
        
        return NL2SQLResponse(
            query_id=query_id,
            question=request.question,
            sql=sql,
            validation=validation,
            cost_estimate=cost_info['estimated_cost'],
            cached=False,
            execution_time_ms=execution_time
        )
    
    def _clean_sql(self, raw_sql: str) -> str:
        # Remove markdown code blocks
        sql = re.sub(r'```sql\s*', '', raw_sql)
        sql = re.sub(r'```\s*', '', sql)
        
        # Remove extra whitespace
        sql = sql.strip()
        
        # Ensure it ends with semicolon
        if not sql.endswith(';'):
            sql += ';'
        
        return sql
    
    def _store_query(
        self,
        org_id: str,
        user_id: str,
        question: str,
        sql: str,
        validation: QueryValidationResult,
        cost_info: Dict[str, Any]
    ) -> str:
        query_id = str(uuid.uuid4())
        
        try:
            conn = psycopg2.connect(settings.database_url)
            cursor = conn.cursor()
            
            # Create table if not exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS nl2sql_queries (
                    query_id VARCHAR(255) PRIMARY KEY,
                    org_id VARCHAR(255) NOT NULL,
                    user_id VARCHAR(255),
                    question TEXT NOT NULL,
                    sql_query TEXT NOT NULL,
                    is_valid BOOLEAN NOT NULL,
                    estimated_cost FLOAT,
                    estimated_rows INTEGER,
                    validation_errors TEXT[],
                    validation_warnings TEXT[],
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Insert query
            cursor.execute("""
                INSERT INTO nl2sql_queries 
                (query_id, org_id, user_id, question, sql_query, is_valid, 
                 estimated_cost, estimated_rows, validation_errors, validation_warnings)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                query_id,
                org_id,
                user_id,
                question,
                sql,
                validation.is_valid,
                validation.estimated_cost,
                validation.estimated_rows,
                validation.errors or [],
                validation.warnings or []
            ))
            
            conn.commit()
            cursor.close()
            conn.close()
            
        except Exception as e:
            print(f"Error storing query: {e}")
        
        return query_id


nl2sql_service = NL2SQLService()
