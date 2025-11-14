"""
Analytics Tasks for Celery Worker

This module contains tasks related to analytics data refreshes,
catalog updates, and materialized view maintenance.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
import psycopg2
from psycopg2.extras import execute_values
import structlog

from ..celery_app import celery_app, db_circuit_breaker
from ..settings import settings
from ..utils.metrics import metrics_collector
from ..utils.database import get_db_connection

logger = structlog.get_logger(__name__)


@celery_app.task(
    bind=True,
    max_retries=settings.task_max_retries,
    default_retry_delay=settings.task_default_retry_delay,
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True
)
def refresh_catalog(self) -> Dict[str, Any]:
    """
    Refresh the analytics catalog metadata
    
    This task updates catalog information including:
    - Available tables and views
    - Schema information
    - Last updated timestamps
    """
    task_name = "refresh_catalog"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Starting catalog refresh")
            
            with db_circuit_breaker:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Update catalog tables
                update_queries = [
                    """
                    UPDATE analytics_catalog 
                    SET last_updated = NOW(), 
                        status = 'active'
                    WHERE status = 'stale'
                    """,
                    
                    """
                    INSERT INTO analytics_refresh_log (task_type, started_at, status)
                    VALUES ('catalog_refresh', NOW(), 'running')
                    ON CONFLICT (task_type) DO UPDATE SET
                        started_at = EXCLUDED.started_at,
                        status = EXCLUDED.status,
                        attempt_count = analytics_refresh_log.attempt_count + 1
                    """
                ]
                
                for query in update_queries:
                    cursor.execute(query)
                
                # Get catalog statistics
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_tables,
                        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_tables
                    FROM analytics_catalog
                """)
                
                stats = cursor.fetchone()
                
                # Update refresh log
                cursor.execute("""
                    UPDATE analytics_refresh_log 
                    SET completed_at = NOW(), 
                        status = 'completed',
                        metadata = %s
                    WHERE task_type = 'catalog_refresh'
                """, ({"total_tables": stats[0], "active_tables": stats[1]},))
                
                conn.commit()
                cursor.close()
                conn.close()
                
                metrics_collector.task_completed(task_name)
                
                result = {
                    "status": "success",
                    "message": "Catalog refreshed successfully",
                    "timestamp": datetime.utcnow().isoformat(),
                    "stats": {
                        "total_tables": stats[0],
                        "active_tables": stats[1]
                    }
                }
                
                logger.info("Catalog refresh completed", **result)
                return result
                
    except Exception as exc:
        logger.error("Catalog refresh failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        
        # Update refresh log with error
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE analytics_refresh_log 
                SET completed_at = NOW(), 
                    status = 'failed',
                    error_message = %s
                WHERE task_type = 'catalog_refresh'
            """, (str(exc),))
            conn.commit()
            cursor.close()
            conn.close()
        except Exception as log_exc:
            logger.error("Failed to update refresh log", error=str(log_exc))
        
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=settings.task_max_retries,
    default_retry_delay=settings.task_default_retry_delay,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True
)
def refresh_materialized_views(self, view_names: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Refresh materialized views for analytics
    
    Args:
        view_names: Optional list of specific views to refresh. If None, refresh all.
    """
    task_name = "refresh_materialized_views"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Starting materialized views refresh", view_names=view_names)
            
            with db_circuit_breaker:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Get views to refresh
                if view_names:
                    views_to_refresh = view_names
                else:
                    cursor.execute("""
                        SELECT matviewname 
                        FROM pg_matviews 
                        WHERE schemaname = 'analytics'
                    """)
                    views_to_refresh = [row[0] for row in cursor.fetchall()]
                
                refresh_results = []
                
                for view_name in views_to_refresh:
                    try:
                        start_time = datetime.utcnow()
                        
                        # Refresh the materialized view
                        cursor.execute(f'REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.{view_name}')
                        
                        end_time = datetime.utcnow()
                        duration = (end_time - start_time).total_seconds()
                        
                        # Log the refresh
                        cursor.execute("""
                            INSERT INTO analytics_refresh_log (
                                task_type, view_name, started_at, completed_at, 
                                status, duration_seconds
                            ) VALUES (%s, %s, %s, %s, %s, %s)
                        """, (
                            'materialized_view_refresh',
                            view_name,
                            start_time,
                            end_time,
                            'completed',
                            duration
                        ))
                        
                        refresh_results.append({
                            "view_name": view_name,
                            "status": "success",
                            "duration_seconds": duration
                        })
                        
                        logger.info("Materialized view refreshed", 
                                  view_name=view_name, duration=duration)
                        
                    except Exception as view_exc:
                        logger.error("Failed to refresh materialized view", 
                                   view_name=view_name, error=str(view_exc))
                        
                        refresh_results.append({
                            "view_name": view_name,
                            "status": "failed",
                            "error": str(view_exc)
                        })
                
                conn.commit()
                cursor.close()
                conn.close()
                
                successful_refreshes = sum(1 for r in refresh_results if r["status"] == "success")
                total_refreshes = len(refresh_results)
                
                metrics_collector.task_completed(task_name)
                
                result = {
                    "status": "success",
                    "message": f"Refreshed {successful_refreshes}/{total_refreshes} materialized views",
                    "timestamp": datetime.utcnow().isoformat(),
                    "results": refresh_results,
                    "summary": {
                        "total": total_refreshes,
                        "successful": successful_refreshes,
                        "failed": total_refreshes - successful_refreshes
                    }
                }
                
                logger.info("Materialized views refresh completed", **result["summary"])
                return result
                
    except Exception as exc:
        logger.error("Materialized views refresh failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    retry_backoff=True
)
def update_query_statistics(self) -> Dict[str, Any]:
    """
    Update query performance statistics
    """
    task_name = "update_query_statistics"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Updating query statistics")
            
            with db_circuit_breaker:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Update statistics for analytics tables
                tables = [
                    'analytics_pipeline_kpis',
                    'analytics_compliance_kpis', 
                    'analytics_revenue_kpis',
                    'analytics_outreach_kpis'
                ]
                
                for table in tables:
                    cursor.execute(f'ANALYZE analytics.{table}')
                
                # Log statistics update
                cursor.execute("""
                    INSERT INTO analytics_refresh_log (task_type, started_at, completed_at, status)
                    VALUES ('query_statistics_update', NOW(), NOW(), 'completed')
                """)
                
                conn.commit()
                cursor.close()
                conn.close()
                
                metrics_collector.task_completed(task_name)
                
                result = {
                    "status": "success",
                    "message": f"Updated statistics for {len(tables)} tables",
                    "timestamp": datetime.utcnow().isoformat(),
                    "tables_updated": tables
                }
                
                logger.info("Query statistics updated", tables=len(tables))
                return result
                
    except Exception as exc:
        logger.error("Query statistics update failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        raise self.retry(exc=exc)


@celery_app.task(bind=True)
def cleanup_old_refresh_logs(self) -> Dict[str, Any]:
    """
    Clean up old refresh logs to prevent table bloat
    """
    task_name = "cleanup_old_refresh_logs"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Cleaning up old refresh logs")
            
            with db_circuit_breaker:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Delete logs older than 30 days
                cursor.execute("""
                    DELETE FROM analytics_refresh_log 
                    WHERE completed_at < NOW() - INTERVAL '30 days'
                """)
                
                deleted_count = cursor.rowcount
                
                conn.commit()
                cursor.close()
                conn.close()
                
                metrics_collector.task_completed(task_name)
                
                result = {
                    "status": "success",
                    "message": f"Cleaned up {deleted_count} old refresh log entries",
                    "timestamp": datetime.utcnow().isoformat(),
                    "deleted_count": deleted_count
                }
                
                logger.info("Old refresh logs cleaned up", deleted_count=deleted_count)
                return result
                
    except Exception as exc:
        logger.error("Refresh log cleanup failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        # Don't retry cleanup tasks
        return {
            "status": "error",
            "message": f"Cleanup failed: {str(exc)}",
            "timestamp": datetime.utcnow().isoformat()
        }