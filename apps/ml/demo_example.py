#!/usr/bin/env python3
"""
Demo example for NL2SQL service.
Shows how to use the service without requiring actual LLM API keys.
"""

import asyncio
from app.models import NL2SQLRequest
from app.services.sql_validator import SQLValidator
from app.services.cost_estimator import CostEstimator


async def demo_sql_validation():
    """Demonstrate SQL validation with safety rails"""
    print("="*60)
    print("SQL Validation Demo")
    print("="*60)
    
    validator = SQLValidator()
    
    # Test cases
    test_cases = [
        ("Valid SELECT", "SELECT * FROM orders WHERE status = 'completed';"),
        ("Dangerous DROP", "DROP TABLE orders;"),
        ("SQL Injection", "SELECT * FROM users WHERE id = 1; DROP TABLE users; --"),
        ("Valid JOIN", """
            SELECT o.order_id, c.customer_name 
            FROM orders o 
            JOIN customers c ON o.customer_id = c.customer_id
            LIMIT 10;
        """),
    ]
    
    for name, sql in test_cases:
        print(f"\n{name}:")
        print(f"SQL: {sql[:80]}...")
        
        result = validator.validate(sql)
        
        if result.is_valid:
            print("✓ VALID")
            if result.warnings:
                print(f"  Warnings: {', '.join(result.warnings)}")
        else:
            print("✗ INVALID")
            print(f"  Errors: {', '.join(result.errors)}")


async def demo_cost_estimation():
    """Demonstrate query cost estimation"""
    print("\n" + "="*60)
    print("Cost Estimation Demo")
    print("="*60)
    
    estimator = CostEstimator()
    
    queries = [
        ("Simple", "SELECT * FROM orders LIMIT 10;"),
        ("With JOIN", """
            SELECT o.*, c.name 
            FROM orders o 
            JOIN customers c ON o.customer_id = c.id;
        """),
        ("Complex Aggregation", """
            SELECT 
                c.customer_name,
                COUNT(DISTINCT o.order_id) as order_count,
                SUM(o.amount) as total,
                AVG(o.amount) as avg_amount
            FROM customers c
            LEFT JOIN orders o ON c.customer_id = o.customer_id
            GROUP BY c.customer_name
            HAVING COUNT(*) > 5
            ORDER BY total DESC;
        """),
    ]
    
    for name, sql in queries:
        print(f"\n{name}:")
        result = estimator.estimate_cost(sql)
        print(f"  Complexity: {result['complexity_level']}")
        print(f"  Estimated Cost: {result['heuristic_cost']:.2f}")
        if result['complexity_factors']:
            print(f"  Factors: {', '.join(result['complexity_factors'])}")


async def demo_few_shot_prompting():
    """Demonstrate few-shot prompt construction"""
    print("\n" + "="*60)
    print("Few-Shot Prompting Demo")
    print("="*60)
    
    from app.prompts.few_shot_examples import build_prompt, FEW_SHOT_EXAMPLES
    
    question = "What are the top 5 products by revenue?"
    schemas = [
        """CREATE TABLE products (
            product_id SERIAL PRIMARY KEY,
            product_name VARCHAR(255),
            category VARCHAR(100)
        );""",
        """CREATE TABLE order_items (
            item_id SERIAL PRIMARY KEY,
            product_id INTEGER,
            quantity INTEGER,
            price DECIMAL(10,2)
        );"""
    ]
    
    prompt = build_prompt(question, schemas, FEW_SHOT_EXAMPLES[:2])
    
    print(f"\nQuestion: {question}")
    print("\nGenerated Prompt (first 500 chars):")
    print(prompt[:500] + "...")


async def main():
    """Run all demos"""
    print("\n" + "="*60)
    print("NL2SQL Service Demo")
    print("="*60)
    print("\nThis demo shows the NL2SQL service capabilities without")
    print("requiring actual LLM API keys.\n")
    
    await demo_sql_validation()
    await demo_cost_estimation()
    await demo_few_shot_prompting()
    
    print("\n" + "="*60)
    print("Demo Complete!")
    print("="*60)
    print("\nTo use the full service with LLM integration:")
    print("1. Set LLM_API_KEY in your .env file")
    print("2. Run: uvicorn app.main:app --reload")
    print("3. Visit: http://localhost:8000/docs")
    print("\nFor testing, run: pytest tests/")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
