from app.models import FewShotExample
from typing import List


FEW_SHOT_EXAMPLES: List[FewShotExample] = [
    FewShotExample(
        question="Show me total revenue by month",
        sql="""SELECT 
    DATE_TRUNC('month', created_at) as month,
    SUM(amount) as total_revenue
FROM orders
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;""",
        context="Basic aggregation with date functions"
    ),
    FewShotExample(
        question="What are the top 10 customers by revenue?",
        sql="""SELECT 
    c.customer_id,
    c.customer_name,
    SUM(o.amount) as total_revenue
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.customer_name
ORDER BY total_revenue DESC
LIMIT 10;""",
        context="Join with aggregation and ordering"
    ),
    FewShotExample(
        question="How many active users do we have?",
        sql="""SELECT COUNT(DISTINCT user_id) as active_users
FROM users
WHERE status = 'active';""",
        context="Count distinct with filtering"
    ),
    FewShotExample(
        question="Show me the average order value per customer",
        sql="""SELECT 
    customer_id,
    COUNT(*) as order_count,
    AVG(amount) as avg_order_value,
    SUM(amount) as total_spent
FROM orders
GROUP BY customer_id
HAVING COUNT(*) > 0
ORDER BY avg_order_value DESC;""",
        context="Multiple aggregations with HAVING clause"
    ),
    FewShotExample(
        question="What percentage of orders were completed successfully?",
        sql="""SELECT 
    COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as completion_rate
FROM orders;""",
        context="Percentage calculation with CASE statement"
    ),
]


SYSTEM_PROMPT = """You are an expert SQL generator. Your task is to convert natural language questions into valid PostgreSQL queries.

Guidelines:
1. Generate only SELECT queries
2. Use proper JOIN syntax when combining tables
3. Include appropriate WHERE clauses for filtering
4. Use aggregations (COUNT, SUM, AVG, etc.) when needed
5. Add ORDER BY and LIMIT clauses when appropriate
6. Use table aliases for readability
7. Format the SQL query properly with indentation
8. Only return the SQL query, no explanations or markdown

Important: Only output the SQL query itself, without any markdown code blocks, explanations, or additional text."""


def build_prompt(question: str, schemas: List[str], examples: List[FewShotExample] = None) -> str:
    if examples is None:
        examples = FEW_SHOT_EXAMPLES[:3]  # Use first 3 examples by default
    
    prompt_parts = []
    
    # Add available schemas
    prompt_parts.append("Available database schemas:")
    prompt_parts.append("")
    for schema in schemas:
        prompt_parts.append(schema)
        prompt_parts.append("")
    
    # Add few-shot examples
    if examples:
        prompt_parts.append("Example questions and their SQL queries:")
        prompt_parts.append("")
        for i, example in enumerate(examples, 1):
            prompt_parts.append(f"Example {i}:")
            prompt_parts.append(f"Question: {example.question}")
            prompt_parts.append(f"SQL:\n{example.sql}")
            prompt_parts.append("")
    
    # Add the actual question
    prompt_parts.append("Now generate a SQL query for the following question:")
    prompt_parts.append(f"Question: {question}")
    prompt_parts.append("")
    prompt_parts.append("SQL:")
    
    return "\n".join(prompt_parts)
