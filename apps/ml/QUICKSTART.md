# NL2SQL Service - Quick Start Guide

Get up and running with the NL2SQL service in 5 minutes.

## Prerequisites

- Python 3.11+
- PostgreSQL 12+ (with pgvector extension)
- Redis 6+
- OpenAI API key (or compatible LLM API)

## Installation

### 1. Create Virtual Environment

```bash
cd apps/ml
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database (must have pgvector extension)
DATABASE_URL=postgresql://postgres:password@localhost:5432/analytics_db

# Redis
REDIS_URL=redis://localhost:6379/0

# LLM (required for full functionality)
LLM_API_KEY=sk-your-openai-key-here
LLM_MODEL=gpt-4

# Optional: Celery for background tasks
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
```

## Running the Service

### Option 1: Local Development

```bash
# Start the FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal: Start Celery worker (optional)
celery -A app.tasks.celery_app worker --loglevel=info
```

### Option 2: Docker Compose

```bash
# Set your API key in environment
export LLM_API_KEY=sk-your-openai-key-here

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f nl2sql-api
```

## Testing the Service

### 1. Run the Demo (No API Key Needed)

```bash
python demo_example.py
```

This demonstrates:
- SQL validation with safety rails
- Query cost estimation
- Few-shot prompt construction

### 2. Run the Tests

```bash
pytest tests/ -v
```

Expected output: **19 passed in ~1s**

### 3. Test the API

Visit the interactive API docs: http://localhost:8000/docs

Or use curl:

```bash
curl -X POST http://localhost:8000/nl2sql \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Show me total revenue by month",
    "org_id": "demo_org",
    "user_id": "test_user"
  }'
```

## Setting Up Demo Data

### Enable pgvector Extension

```sql
-- Connect to your database
psql -U postgres -d analytics_db

-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### Seed Demo Schemas

```bash
# Requires LLM_API_KEY to be set
python seed_demo_data.py
```

This creates embeddings for 5 sample schemas:
- orders
- customers
- order_items
- products
- users

## Example Workflow

### 1. Generate SQL from Natural Language

```python
import httpx
import asyncio

async def generate_sql():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/nl2sql",
            json={
                "question": "What are the top 10 customers by revenue?",
                "org_id": "demo_org",
                "user_id": "test_user"
            }
        )
        return response.json()

result = asyncio.run(generate_sql())
print(f"Generated SQL: {result['sql']}")
print(f"Valid: {result['validation']['is_valid']}")
print(f"Cost: {result['cost_estimate']}")
```

### 2. Materialize Query Results

```python
async def materialize_query(query_id):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/materialize",
            json={
                "query_id": query_id,
                "org_id": "demo_org",
                "output_table": "top_customers"
            }
        )
        return response.json()

result = asyncio.run(materialize_query("your-query-id"))
print(f"Task ID: {result['task_id']}")
```

### 3. Check Task Status

```python
async def check_status(task_id):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://localhost:8000/materialize/{task_id}"
        )
        return response.json()

status = asyncio.run(check_status("your-task-id"))
print(f"Status: {status['status']}")
print(f"Result: {status['result']}")
```

## Safety Features Demonstration

The service includes multiple safety rails:

```python
# These will be blocked:
dangerous_queries = [
    "DROP TABLE users;",                    # Dangerous operation
    "DELETE FROM orders WHERE id = 1;",     # Not in allowed operations
    "SELECT * FROM users; DROP TABLE users;",  # Multiple statements
]

# These will pass validation:
safe_queries = [
    "SELECT * FROM orders WHERE status = 'completed';",
    "SELECT customer_id, SUM(amount) FROM orders GROUP BY customer_id;",
]
```

## Troubleshooting

### "OpenAI API key not set"

Set the environment variable:
```bash
export LLM_API_KEY=sk-your-key-here
```

Or add to `.env` file.

### "Connection refused" on PostgreSQL

Ensure PostgreSQL is running:
```bash
sudo service postgresql start
```

Or use Docker:
```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15
```

### "Could not estimate query cost"

This is normal if PostgreSQL isn't running. The service will still:
- Validate SQL syntax
- Check for dangerous operations
- Use heuristic cost estimation

### Tests failing with database errors

Tests use mocked connections, so they don't need a real database. If you see:
- ✅ 19 passed - All good!
- ❌ Failures - Check Python version (need 3.11+) and dependencies

## Next Steps

1. **Production Setup**: See [README.md](README.md) for deployment details
2. **API Reference**: Visit http://localhost:8000/docs for interactive docs
3. **Implementation Details**: See [IMPLEMENTATION.md](IMPLEMENTATION.md)
4. **Custom Few-Shot Examples**: Edit `app/prompts/few_shot_examples.py`
5. **Safety Configuration**: Adjust `app/config.py` settings

## Key Configuration Options

```python
# app/config.py

# SQL Safety
MAX_QUERY_COST = 1000.0           # Maximum allowed query cost
ALLOWED_OPERATIONS = ["SELECT"]   # Only allow read operations
MAX_ROWS_ESTIMATE = 10000         # Warn for large result sets

# LLM
LLM_MODEL = "gpt-4"              # Or gpt-3.5-turbo for faster/cheaper
LLM_TEMPERATURE = 0.0            # Deterministic output
LLM_MAX_TOKENS = 2000            # Maximum SQL length

# Caching
CACHE_TTL = 3600                 # 1 hour cache
```

## Support

- **Documentation**: See README.md and IMPLEMENTATION.md
- **Tests**: Check `tests/test_nl2sql.py` for examples
- **Demo**: Run `demo_example.py` for interactive demo
- **API Docs**: http://localhost:8000/docs

---

**Ready to convert natural language to SQL? Start the service and visit http://localhost:8000/docs!**
