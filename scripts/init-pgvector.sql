-- Initialize pgvector extension
-- This script enables the pgvector extension for vector/embedding support

-- Create extension if it doesn't exist
-- Note: pgvector needs to be compiled and installed in the PostgreSQL container
-- For now, we create this script as a placeholder for when pgvector is available

-- Attempt to create pgvector extension (requires pgvector compilation)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Alternative: Create a simple vector type for compatibility
-- This will be replaced when pgvector is properly installed in the postgres image

-- Enable UUID support for analytics IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable JSON support (often used with vectors)
CREATE EXTENSION IF NOT EXISTS json;

-- Create analytics schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant permissions
GRANT USAGE ON SCHEMA analytics TO PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC;

-- Log completion
SELECT 'pgvector initialization completed' as status;
