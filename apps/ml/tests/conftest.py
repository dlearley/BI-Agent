import pytest
from unittest.mock import Mock, patch
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


@pytest.fixture
def mock_llm_client():
    """Mock LLM client for testing"""
    with patch('app.services.llm_client.llm_client') as mock:
        # Mock generate_sql
        mock.generate_sql.return_value = """
SELECT 
    DATE_TRUNC('month', created_at) as month,
    SUM(amount) as total_revenue
FROM orders
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
"""
        
        # Mock generate_embedding
        mock.generate_embedding.return_value = [0.1] * 1536
        
        yield mock


@pytest.fixture
def mock_vector_store():
    """Mock vector store for testing"""
    with patch('app.services.vector_store.vector_store') as mock:
        from app.models import SchemaEmbedding
        
        mock.fetch_relevant_schemas.return_value = [
            SchemaEmbedding(
                table_name="orders",
                schema_definition="""CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    amount DECIMAL(10,2),
    created_at TIMESTAMP,
    status VARCHAR(50)
);""",
                description="Order transactions",
                similarity_score=0.95
            ),
            SchemaEmbedding(
                table_name="customers",
                schema_definition="""CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP
);""",
                description="Customer information",
                similarity_score=0.85
            )
        ]
        
        yield mock


@pytest.fixture
def mock_db_connection():
    """Mock database connection"""
    with patch('psycopg2.connect') as mock_connect:
        mock_conn = Mock()
        mock_cursor = Mock()
        
        # Mock query results
        mock_cursor.fetchone.return_value = [
            [{"Plan": {"Total Cost": 10.5, "Plan Rows": 100}}]
        ]
        
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn
        
        yield mock_connect


@pytest.fixture
def mock_redis():
    """Mock Redis client"""
    with patch('redis.from_url') as mock:
        mock_client = Mock()
        mock_client.get.return_value = None
        mock_client.setex.return_value = True
        mock.return_value = mock_client
        yield mock_client


@pytest.fixture
def sample_nl2sql_request():
    """Sample NL2SQL request"""
    from app.models import NL2SQLRequest
    
    return NL2SQLRequest(
        question="Show me total revenue by month",
        org_id="org_123",
        user_id="user_456"
    )
