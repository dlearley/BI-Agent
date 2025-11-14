#!/usr/bin/env python3
"""
Seed demo data for NL2SQL service testing.
Creates sample schemas and embeddings in the vector store.
"""

import sys
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()

from app.services.vector_store import vector_store
from app.services.llm_client import llm_client

# Demo schemas
DEMO_SCHEMAS = [
    {
        "org_id": "demo_org",
        "table_name": "orders",
        "schema": """CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- Indexes
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(status);""",
        "description": "Order transactions with customer references, amounts, and status tracking"
    },
    {
        "org_id": "demo_org",
        "table_name": "customers",
        "schema": """CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active'
);

-- Indexes
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status);""",
        "description": "Customer information including contact details and account status"
    },
    {
        "org_id": "demo_org",
        "table_name": "order_items",
        "schema": """CREATE TABLE order_items (
    item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);""",
        "description": "Line items for orders, linking products and quantities"
    },
    {
        "org_id": "demo_org",
        "table_name": "products",
        "schema": """CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_price ON products(price);""",
        "description": "Product catalog with pricing and inventory information"
    },
    {
        "org_id": "demo_org",
        "table_name": "users",
        "schema": """CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);""",
        "description": "User accounts with roles and authentication tracking"
    }
]


def seed_demo_schemas():
    """Seed demo schemas into the vector store"""
    print("Setting up vector store...")
    try:
        vector_store.setup_schema_embeddings_table()
        print("✓ Vector store initialized")
    except Exception as e:
        print(f"✗ Failed to initialize vector store: {e}")
        return False
    
    print(f"\nSeeding {len(DEMO_SCHEMAS)} demo schemas...")
    
    for i, schema_data in enumerate(DEMO_SCHEMAS, 1):
        table_name = schema_data['table_name']
        print(f"\n[{i}/{len(DEMO_SCHEMAS)}] Processing {table_name}...")
        
        try:
            # Generate embedding
            print(f"  - Generating embedding...")
            schema_text = f"{schema_data['schema']}\n\n{schema_data['description']}"
            embedding = llm_client.generate_embedding(schema_text)
            print(f"  ✓ Embedding generated (dimension: {len(embedding)})")
            
            # Add to vector store
            print(f"  - Adding to vector store...")
            success = vector_store.add_schema_embedding(
                org_id=schema_data['org_id'],
                table_name=table_name,
                schema_definition=schema_data['schema'],
                embedding=embedding,
                description=schema_data['description']
            )
            
            if success:
                print(f"  ✓ {table_name} added successfully")
            else:
                print(f"  ✗ Failed to add {table_name}")
        
        except Exception as e:
            print(f"  ✗ Error processing {table_name}: {e}")
    
    print("\n" + "="*60)
    print("Demo data seeding completed!")
    print("="*60)
    print("\nYou can now test the NL2SQL service with questions like:")
    print("  - Show me total revenue by month")
    print("  - What are the top 10 customers by revenue?")
    print("  - How many active users do we have?")
    print("  - List all products in the electronics category")
    print("  - Show me order details for customer ID 123")
    
    return True


if __name__ == "__main__":
    print("="*60)
    print("NL2SQL Demo Data Seeder")
    print("="*60)
    
    if not os.getenv("LLM_API_KEY"):
        print("\n⚠️  Warning: LLM_API_KEY not set in environment")
        print("Please set LLM_API_KEY in your .env file")
        sys.exit(1)
    
    success = seed_demo_schemas()
    sys.exit(0 if success else 1)
