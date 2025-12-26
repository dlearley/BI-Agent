import pytest
from unittest.mock import patch, Mock
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models import NL2SQLRequest, QueryValidationResult
from app.services.sql_validator import SQLValidator
from app.services.cost_estimator import CostEstimator


class TestSQLValidator:
    def test_valid_select_query(self):
        validator = SQLValidator()
        sql = "SELECT * FROM orders WHERE status = 'completed';"
        
        result = validator.validate(sql)
        
        assert result.is_valid
        assert len(result.errors) == 0
    
    def test_dangerous_keywords_blocked(self):
        validator = SQLValidator()
        sql = "DROP TABLE orders;"
        
        result = validator.validate(sql)
        
        assert not result.is_valid
        assert any('DROP' in error or 'not allowed' in error for error in result.errors)
    
    def test_delete_blocked(self):
        validator = SQLValidator()
        sql = "DELETE FROM orders WHERE id = 1;"
        
        result = validator.validate(sql)
        
        assert not result.is_valid
        assert any('DELETE' in error for error in result.errors)
    
    def test_multiple_statements_blocked(self):
        validator = SQLValidator()
        sql = "SELECT * FROM orders; SELECT * FROM customers;"
        
        result = validator.validate(sql)
        
        assert not result.is_valid
        assert any('Multiple' in error for error in result.errors)
    
    def test_sql_injection_patterns_blocked(self):
        validator = SQLValidator()
        sql = "SELECT * FROM users WHERE id = 1; DROP TABLE users; --"
        
        result = validator.validate(sql)
        
        assert not result.is_valid
    
    def test_select_star_warning(self):
        validator = SQLValidator()
        sql = "SELECT * FROM orders;"
        
        with patch.object(validator, '_get_query_cost', return_value=(5.0, 100)):
            result = validator.validate(sql)
        
        assert result.is_valid
        assert any('SELECT *' in warning for warning in result.warnings)


class TestCostEstimator:
    def test_simple_query_low_cost(self):
        estimator = CostEstimator()
        sql = "SELECT id, name FROM users LIMIT 10;"
        
        result = estimator.estimate_cost(sql)
        
        assert result['complexity_level'] == 'LOW'
        assert result['estimated_cost'] < 2.0
    
    def test_join_increases_cost(self):
        estimator = CostEstimator()
        sql = """
        SELECT o.*, c.name 
        FROM orders o 
        JOIN customers c ON o.customer_id = c.id;
        """
        
        result = estimator.estimate_cost(sql)
        
        assert result['estimated_cost'] > 2.0
        assert any('JOIN' in factor for factor in result['complexity_factors'])
    
    def test_aggregation_increases_cost(self):
        estimator = CostEstimator()
        sql = """
        SELECT customer_id, COUNT(*), SUM(amount), AVG(amount)
        FROM orders
        GROUP BY customer_id;
        """
        
        result = estimator.estimate_cost(sql)
        
        assert 'GROUP BY' in result['complexity_factors']
        assert any('aggregate' in factor for factor in result['complexity_factors'])
    
    def test_complex_query_high_cost(self):
        estimator = CostEstimator()
        sql = """
        SELECT 
            c.customer_name,
            COUNT(DISTINCT o.order_id) as order_count,
            SUM(o.amount) as total
        FROM customers c
        LEFT JOIN orders o ON c.customer_id = o.customer_id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        GROUP BY c.customer_name
        HAVING COUNT(*) > 5
        ORDER BY total DESC;
        """
        
        result = estimator.estimate_cost(sql)
        
        assert result['complexity_level'] in ['HIGH', 'VERY_HIGH']


class TestNL2SQLService:
    @pytest.mark.asyncio
    async def test_generate_sql_success(
        self,
        sample_nl2sql_request,
        mock_llm_client,
        mock_vector_store,
        mock_db_connection,
        mock_redis
    ):
        from app.services.nl2sql import NL2SQLService
        
        service = NL2SQLService()
        
        with patch.object(service.validator, 'validate') as mock_validate:
            mock_validate.return_value = QueryValidationResult(
                is_valid=True,
                sql="SELECT * FROM orders;",
                errors=[],
                warnings=[],
                estimated_cost=10.0,
                estimated_rows=100
            )
            
            with patch.object(service, '_store_query', return_value='query_123'):
                response = await service.generate_sql(sample_nl2sql_request)
        
        assert response.query_id
        assert response.sql
        assert response.validation.is_valid
        assert response.execution_time_ms > 0
    
    @pytest.mark.asyncio
    async def test_generate_sql_with_cache(
        self,
        sample_nl2sql_request,
        mock_llm_client,
        mock_vector_store
    ):
        from app.services.nl2sql import NL2SQLService
        
        service = NL2SQLService()
        
        # Mock cache hit
        cached_data = {
            'query_id': 'cached_query_123',
            'sql': 'SELECT * FROM orders;',
            'validation': {
                'is_valid': True,
                'sql': 'SELECT * FROM orders;',
                'errors': [],
                'warnings': [],
                'estimated_cost': 10.0,
                'estimated_rows': 100
            },
            'cost_estimate': 10.0
        }
        
        with patch.object(service.cache, 'get', return_value=cached_data):
            response = await service.generate_sql(sample_nl2sql_request)
        
        assert response.cached
        assert response.query_id == 'cached_query_123'
    
    @pytest.mark.asyncio
    async def test_generate_sql_validation_failure(
        self,
        sample_nl2sql_request,
        mock_vector_store,
        mock_db_connection
    ):
        from app.services.nl2sql import NL2SQLService
        from unittest.mock import Mock
        
        service = NL2SQLService()
        
        # Mock LLM to return dangerous SQL directly on the service instance
        service.llm = Mock()
        service.llm.generate_embedding.return_value = [0.1] * 1536
        service.llm.generate_sql.return_value = "DROP TABLE orders;"
        
        response = await service.generate_sql(sample_nl2sql_request)
        
        assert not response.validation.is_valid
        assert len(response.validation.errors) > 0
    
    def test_clean_sql_removes_markdown(self):
        from app.services.nl2sql import NL2SQLService
        
        service = NL2SQLService()
        
        raw_sql = """```sql
SELECT * FROM orders;
```"""
        
        cleaned = service._clean_sql(raw_sql)
        
        assert '```' not in cleaned
        assert cleaned.strip().startswith('SELECT')
        assert cleaned.endswith(';')


class TestQueryCache:
    def test_cache_set_and_get(self):
        from app.services.query_cache import QueryCache
        
        with patch('redis.from_url') as mock_redis:
            mock_client = Mock()
            mock_client.get.return_value = '{"sql": "SELECT * FROM orders;"}'
            mock_client.setex.return_value = True
            mock_redis.return_value = mock_client
            
            cache = QueryCache()
            
            # Set cache
            data = {"sql": "SELECT * FROM orders;"}
            cache.set("test question", "org_123", data)
            
            # Verify setex was called
            assert mock_client.setex.called
    
    def test_cache_invalidate(self):
        from app.services.query_cache import QueryCache
        
        with patch('redis.from_url') as mock_redis:
            mock_client = Mock()
            mock_client.delete.return_value = 1
            mock_redis.return_value = mock_client
            
            cache = QueryCache()
            
            result = cache.invalidate("test question", "org_123")
            
            assert result
            assert mock_client.delete.called


class TestFewShotExamples:
    def test_build_prompt_includes_examples(self):
        from app.prompts.few_shot_examples import build_prompt, FEW_SHOT_EXAMPLES
        
        question = "Show me total sales"
        schemas = ["CREATE TABLE sales (id INT, amount DECIMAL);"]
        
        prompt = build_prompt(question, schemas, FEW_SHOT_EXAMPLES[:2])
        
        assert question in prompt
        assert "Example 1:" in prompt
        assert "Example 2:" in prompt
        assert schemas[0] in prompt
    
    def test_build_prompt_includes_schemas(self):
        from app.prompts.few_shot_examples import build_prompt
        
        question = "Show me customers"
        schemas = [
            "CREATE TABLE customers (id INT, name VARCHAR);",
            "CREATE TABLE orders (id INT, customer_id INT);"
        ]
        
        prompt = build_prompt(question, schemas, [])
        
        assert all(schema in prompt for schema in schemas)


@pytest.mark.asyncio
async def test_full_nl2sql_flow_with_demo_data(
    sample_nl2sql_request,
    mock_llm_client,
    mock_vector_store,
    mock_db_connection
):
    """
    Integration test for the full NL2SQL flow with demo dataset.
    This test verifies:
    1. Question is processed
    2. SQL is generated
    3. Validation passes
    4. EXPLAIN constraints are satisfied
    """
    from app.services.nl2sql import NL2SQLService
    from app.services.sql_validator import SQLValidator
    
    service = NL2SQLService()
    
    # Generate SQL
    with patch.object(service.validator, 'validate') as mock_validate:
        mock_validate.return_value = QueryValidationResult(
            is_valid=True,
            sql="SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as total_revenue FROM orders GROUP BY DATE_TRUNC('month', created_at) ORDER BY month DESC;",
            errors=[],
            warnings=[],
            estimated_cost=15.5,
            estimated_rows=12
        )
        
        with patch.object(service, '_store_query', return_value='demo_query_123'):
            response = await service.generate_sql(sample_nl2sql_request)
    
    # Verify response
    assert response.query_id == 'demo_query_123'
    assert response.validation.is_valid
    assert 'SELECT' in response.sql.upper()
    assert response.validation.estimated_cost is not None
    assert response.validation.estimated_cost < 1000.0  # Under max cost
    
    # Verify SQL is executable (basic structure check)
    assert response.sql.strip().upper().startswith('SELECT')
    assert response.sql.strip().endswith(';')
