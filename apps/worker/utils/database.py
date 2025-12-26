"""
Database Utilities

This module provides database connection utilities and helper functions.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Optional, Dict, Any, List
import structlog

from ..settings import settings
from .circuit_breaker import db_circuit_breaker

logger = structlog.get_logger(__name__)


@contextmanager
def get_db_connection():
    """
    Context manager for database connections with circuit breaker protection
    """
    connection = None
    try:
        connection = psycopg2.connect(
            settings.database_url,
            cursor_factory=RealDictCursor
        )
        yield connection
    except Exception as exc:
        logger.error("Database connection failed", error=str(exc))
        raise exc
    finally:
        if connection:
            connection.close()


@db_circuit_breaker
def execute_query(query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
    """
    Execute a database query and return results
    
    Args:
        query: SQL query to execute
        params: Optional query parameters
    
    Returns:
        List of result rows as dictionaries
    """
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            
            if cursor.description:
                results = cursor.fetchall()
                return [dict(row) for row in results]
            else:
                # For INSERT/UPDATE/DELETE operations
                conn.commit()
                return [{"affected_rows": cursor.rowcount}]


@db_circuit_breaker
def execute_scalar(query: str, params: Optional[tuple] = None) -> Any:
    """
    Execute a query and return the first column of the first row
    
    Args:
        query: SQL query to execute
        params: Optional query parameters
    
    Returns:
        Single scalar value
    """
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            result = cursor.fetchone()
            return result[0] if result else None


@db_circuit_breaker
def execute_batch(queries: List[tuple]) -> List[Dict[str, Any]]:
    """
    Execute multiple queries in a transaction
    
    Args:
        queries: List of (query, params) tuples
    
    Returns:
        List of results for each query
    """
    with get_db_connection() as conn:
        results = []
        with conn.cursor() as cursor:
            for query, params in queries:
                cursor.execute(query, params)
                
                if cursor.description:
                    result = cursor.fetchall()
                    results.append([dict(row) for row in result])
                else:
                    results.append({"affected_rows": cursor.rowcount})
        
        conn.commit()
        return results


def test_database_connection() -> Dict[str, Any]:
    """Test database connectivity"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 as test")
                result = cursor.fetchone()
                
                if result and result[0] == 1:
                    return {
                        "status": "success",
                        "message": "Database connection successful"
                    }
                else:
                    return {
                        "status": "error",
                        "message": "Database query returned unexpected result"
                    }
                    
    except Exception as exc:
        return {
            "status": "error",
            "message": f"Database connection failed: {str(exc)}"
        }


def get_table_info(table_name: str) -> Dict[str, Any]:
    """Get information about a database table"""
    query = """
        SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position
    """
    
    try:
        columns = execute_query(query, (table_name,))
        
        # Get row count
        count_query = f"SELECT COUNT(*) FROM {table_name}"
        row_count = execute_scalar(count_query)
        
        return {
            "table_name": table_name,
            "columns": columns,
            "row_count": row_count
        }
        
    except Exception as exc:
        logger.error("Failed to get table info", table_name=table_name, error=str(exc))
        return {"error": str(exc)}


def create_analytics_tables_if_not_exist() -> None:
    """Create analytics tables if they don't exist"""
    tables = [
        """
        CREATE TABLE IF NOT EXISTS analytics_catalog (
            id SERIAL PRIMARY KEY,
            table_name VARCHAR(255) NOT NULL,
            schema_name VARCHAR(255) NOT NULL,
            table_type VARCHAR(50) NOT NULL,
            description TEXT,
            last_updated TIMESTAMP DEFAULT NOW(),
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS analytics_refresh_log (
            id SERIAL PRIMARY KEY,
            task_type VARCHAR(100) NOT NULL,
            view_name VARCHAR(255),
            started_at TIMESTAMP NOT NULL,
            completed_at TIMESTAMP,
            status VARCHAR(50) NOT NULL,
            duration_seconds INTEGER,
            error_message TEXT,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS analytics_alerts (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            query TEXT NOT NULL,
            threshold DECIMAL(10,2) NOT NULL,
            operator VARCHAR(10) NOT NULL,
            notification_channels JSONB NOT NULL,
            last_triggered TIMESTAMP,
            trigger_count INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            priority INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS analytics_alert_logs (
            id SERIAL PRIMARY KEY,
            alert_id INTEGER REFERENCES analytics_alerts(id),
            triggered_at TIMESTAMP NOT NULL,
            current_value DECIMAL(10,2),
            threshold_value DECIMAL(10,2),
            operator VARCHAR(10),
            notification_results JSONB,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS analytics_thresholds (
            id SERIAL PRIMARY KEY,
            metric_name VARCHAR(255) NOT NULL,
            query TEXT NOT NULL,
            warning_threshold DECIMAL(10,2),
            critical_threshold DECIMAL(10,2),
            comparison_operator VARCHAR(10) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS analytics_reports (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            report_type VARCHAR(100) NOT NULL,
            schedule_type VARCHAR(50),
            query TEXT NOT NULL,
            format VARCHAR(20) DEFAULT 'csv',
            recipients JSONB,
            delivery_method VARCHAR(50) DEFAULT 'email',
            file_path VARCHAR(500),
            last_generated TIMESTAMP,
            row_count INTEGER,
            generation_time_seconds DECIMAL(10,2),
            status VARCHAR(50) DEFAULT 'pending',
            error_message TEXT,
            is_active BOOLEAN DEFAULT true,
            schedule_config JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS worker_metrics (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP NOT NULL,
            cpu_percent DECIMAL(5,2),
            memory_percent DECIMAL(5,2),
            disk_percent DECIMAL(5,2),
            active_workers INTEGER,
            scheduled_tasks INTEGER,
            reserved_tasks INTEGER,
            memory_rss_bytes BIGINT,
            memory_vms_bytes BIGINT,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS task_statistics (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP NOT NULL,
            total_tasks INTEGER DEFAULT 0,
            successful_tasks INTEGER DEFAULT 0,
            failed_tasks INTEGER DEFAULT 0,
            average_execution_time DECIMAL(10,2),
            created_at TIMESTAMP DEFAULT NOW()
        )
        """
    ]
    
    for table_query in tables:
        try:
            execute_query(table_query)
            logger.info("Analytics table created or verified")
        except Exception as exc:
            logger.error("Failed to create analytics table", error=str(exc))
            raise