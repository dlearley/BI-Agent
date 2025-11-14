# NL2SQL FastAPI Service

Natural Language to SQL conversion service with LLM integration, safety rails, and query caching.

## Features

- **NL2SQL Conversion**: Convert natural language questions to SQL queries using LLM
- **Vector Store Integration**: Fetch relevant schema embeddings from PostgreSQL with pgvector
- **Few-Shot Prompting**: Uses few-shot examples to improve SQL generation quality
- **Safety Rails**: 
  - SQL AST parsing and validation
  - Blocks dangerous operations (DROP, DELETE, etc.)
  - EXPLAIN-based cost estimation
  - Row count limits
- **Query Caching**: Redis-based caching of generated queries
- **Cost Estimation**: Heuristic-based query complexity analysis
- **Celery Tasks**: Background materialization of query results
- **Integration Tests**: Comprehensive tests with mocked LLM

## Architecture

```
app/
├── main.py                 # FastAPI application
├── config.py              # Configuration settings
├── models.py              # Pydantic models
├── services/
│   ├── nl2sql.py          # Main NL2SQL service
│   ├── llm_client.py      # OpenAI-compatible LLM client
│   ├── vector_store.py    # PostgreSQL vector store
│   ├── sql_validator.py   # SQL safety validation
│   ├── cost_estimator.py  # Query cost estimation
│   └── query_cache.py     # Redis cache
├── tasks/
│   ├── celery_app.py      # Celery configuration
│   └── materialize.py     # Materialization tasks
└── prompts/
    └── few_shot_examples.py # Prompt templates
```

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Configuration

Key environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `LLM_API_KEY`: OpenAI API key
- `LLM_MODEL`: Model to use (default: gpt-4)
- `MAX_QUERY_COST`: Maximum allowed query cost
- `ALLOWED_OPERATIONS`: Comma-separated list of allowed SQL operations

## Running the Service

### Development

```bash
# Start the FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start Celery worker (in another terminal)
celery -A app.tasks.celery_app worker --loglevel=info
```

### Docker

```bash
# Build the image
docker build -t nl2sql-service .

# Run the container
docker run -p 8000:8000 --env-file .env nl2sql-service
```

## API Endpoints

### POST /nl2sql

Convert natural language to SQL.

**Request:**
```json
{
  "question": "Show me total revenue by month",
  "org_id": "org_123",
  "user_id": "user_456",
  "schema_hints": ["orders", "customers"]
}
```

**Response:**
```json
{
  "query_id": "uuid-here",
  "question": "Show me total revenue by month",
  "sql": "SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as total_revenue FROM orders GROUP BY month ORDER BY month DESC;",
  "validation": {
    "is_valid": true,
    "errors": [],
    "warnings": [],
    "estimated_cost": 15.5,
    "estimated_rows": 100
  },
  "cost_estimate": 15.5,
  "cached": false,
  "execution_time_ms": 234.5
}
```

### POST /materialize

Materialize query results as a table.

**Request:**
```json
{
  "query_id": "uuid-here",
  "org_id": "org_123",
  "output_table": "revenue_summary"
}
```

**Response:**
```json
{
  "status": "submitted",
  "task_id": "celery-task-id",
  "query_id": "uuid-here",
  "message": "Materialization task submitted"
}
```

### GET /materialize/{task_id}

Check materialization task status.

### POST /cache/invalidate

Invalidate query cache.

## Safety Rails

The service implements multiple layers of safety:

1. **Keyword Blocking**: Blocks dangerous SQL keywords (DROP, DELETE, etc.)
2. **Pattern Matching**: Detects SQL injection patterns
3. **AST Parsing**: Validates SQL structure
4. **Cost Estimation**: Uses EXPLAIN to estimate query cost
5. **Row Limits**: Warns about queries returning many rows
6. **Operation Whitelist**: Only allows configured operations (default: SELECT)

## Testing

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run specific test
pytest tests/test_nl2sql.py::TestSQLValidator::test_dangerous_keywords_blocked
```

## Vector Store Setup

The service uses PostgreSQL with pgvector for schema embeddings:

```sql
-- Enable pgvector
CREATE EXTENSION vector;

-- Schema embeddings table is created automatically on startup
-- You can add schema embeddings via the vector_store service
```

### Adding Schema Embeddings

```python
from app.services.vector_store import vector_store
from app.services.llm_client import llm_client

# Generate embedding for schema
schema_text = """
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    amount DECIMAL(10,2),
    created_at TIMESTAMP
);
"""

embedding = llm_client.generate_embedding(schema_text)

# Add to vector store
vector_store.add_schema_embedding(
    org_id="org_123",
    table_name="orders",
    schema_definition=schema_text,
    embedding=embedding,
    description="Order transactions"
)
```

## Celery Tasks

### Materialize Query Results

Materializes a query result into a permanent table:

```python
from app.tasks.materialize import materialize_query_results

result = materialize_query_results.delay(
    query_id="query-uuid",
    org_id="org_123",
    output_table="my_results"
)
```

### Cleanup Old Materializations

Removes old materialized tables:

```python
from app.tasks.materialize import cleanup_old_materializations

result = cleanup_old_materializations.delay(days_old=7)
```

## Performance Considerations

- **Caching**: Queries are cached by (question, org_id) key
- **Vector Search**: Uses IVFFlat index for fast similarity search
- **Cost Estimation**: EXPLAIN runs on a separate connection pool
- **Async Operations**: Main service uses FastAPI async for better concurrency

## Monitoring

The service logs key metrics:

- Query generation time
- Cache hit/miss rates
- Validation failures
- Cost estimates

Integrate with your observability stack for full monitoring.

## Security

- API keys should be stored securely (use secrets management)
- Database credentials should use least-privilege access
- SQL validation prevents dangerous operations
- All queries are logged for audit trail

## License

Part of the BI-Agent analytics platform.
