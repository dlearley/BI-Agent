import psycopg2
from datetime import datetime
from app.tasks.celery_app import celery_app
from app.config import settings
from app.services.sql_validator import validator


@celery_app.task(name='materialize_query_results')
def materialize_query_results(query_id: str, org_id: str, output_table: str = None):
    """
    Celery task to materialize NL2SQL query results into a table.
    
    Args:
        query_id: The ID of the query to materialize
        org_id: Organization ID
        output_table: Optional custom output table name
    
    Returns:
        dict with status and details
    """
    try:
        conn = psycopg2.connect(settings.database_url)
        cursor = conn.cursor()
        
        # Fetch the query
        cursor.execute("""
            SELECT sql_query, question, is_valid 
            FROM nl2sql_queries 
            WHERE query_id = %s AND org_id = %s;
        """, (query_id, org_id))
        
        result = cursor.fetchone()
        if not result:
            return {
                'status': 'error',
                'message': f'Query {query_id} not found'
            }
        
        sql_query, question, is_valid = result
        
        if not is_valid:
            return {
                'status': 'error',
                'message': 'Cannot materialize invalid query'
            }
        
        # Revalidate before execution
        validation = validator.validate(sql_query)
        if not validation.is_valid:
            return {
                'status': 'error',
                'message': 'Query validation failed',
                'errors': validation.errors
            }
        
        # Generate output table name if not provided
        if not output_table:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_table = f"nl2sql_result_{query_id.replace('-', '_')}_{timestamp}"
        
        # Create materialized table
        # Remove trailing semicolon from the query
        clean_query = sql_query.rstrip(';')
        
        materialization_sql = f"""
            CREATE TABLE {output_table} AS
            {clean_query};
        """
        
        cursor.execute(materialization_sql)
        
        # Get row count
        cursor.execute(f"SELECT COUNT(*) FROM {output_table};")
        row_count = cursor.fetchone()[0]
        
        # Record materialization in tracking table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS nl2sql_materializations (
                id SERIAL PRIMARY KEY,
                query_id VARCHAR(255) NOT NULL,
                org_id VARCHAR(255) NOT NULL,
                output_table VARCHAR(255) NOT NULL,
                row_count INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (query_id) REFERENCES nl2sql_queries(query_id)
            );
        """)
        
        cursor.execute("""
            INSERT INTO nl2sql_materializations 
            (query_id, org_id, output_table, row_count)
            VALUES (%s, %s, %s, %s);
        """, (query_id, org_id, output_table, row_count))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'status': 'success',
            'query_id': query_id,
            'output_table': output_table,
            'row_count': row_count,
            'message': f'Query results materialized to {output_table}'
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Materialization failed: {str(e)}'
        }


@celery_app.task(name='cleanup_old_materializations')
def cleanup_old_materializations(days_old: int = 7):
    """
    Celery task to clean up old materialized tables.
    
    Args:
        days_old: Remove materializations older than this many days
    
    Returns:
        dict with cleanup status
    """
    try:
        conn = psycopg2.connect(settings.database_url)
        cursor = conn.cursor()
        
        # Find old materializations
        cursor.execute("""
            SELECT id, output_table 
            FROM nl2sql_materializations 
            WHERE created_at < NOW() - INTERVAL '%s days';
        """, (days_old,))
        
        old_tables = cursor.fetchall()
        dropped_count = 0
        
        for mat_id, table_name in old_tables:
            try:
                cursor.execute(f"DROP TABLE IF EXISTS {table_name};")
                cursor.execute(
                    "DELETE FROM nl2sql_materializations WHERE id = %s;",
                    (mat_id,)
                )
                dropped_count += 1
            except Exception as e:
                print(f"Error dropping table {table_name}: {e}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'status': 'success',
            'tables_dropped': dropped_count,
            'message': f'Cleaned up {dropped_count} old materializations'
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Cleanup failed: {str(e)}'
        }
