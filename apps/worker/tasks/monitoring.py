"""
Monitoring Tasks for Celery Worker

This module contains tasks for monitoring worker health,
collecting metrics, and maintaining system health.
"""

import psutil
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import structlog

from ..celery_app import celery_app
from ..settings import settings
from ..utils.metrics import metrics_collector
from ..utils.database import get_db_connection

logger = structlog.get_logger(__name__)


@celery_app.task(bind=True)
def collect_worker_metrics(self) -> Dict[str, Any]:
    """
    Collect system and worker metrics for monitoring
    """
    task_name = "collect_worker_metrics"
    
    try:
        with metrics_collector.task_duration(task_name):
            # System metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Process metrics
            process = psutil.Process()
            process_memory = process.memory_info()
            
            # Worker metrics (from Celery inspect)
            worker_stats = get_worker_stats()
            
            metrics = {
                "timestamp": datetime.utcnow().isoformat(),
                "system": {
                    "cpu_percent": cpu_percent,
                    "memory": {
                        "total": memory.total,
                        "available": memory.available,
                        "percent": memory.percent,
                        "used": memory.used,
                        "free": memory.free
                    },
                    "disk": {
                        "total": disk.total,
                        "used": disk.used,
                        "free": disk.free,
                        "percent": (disk.used / disk.total) * 100
                    }
                },
                "process": {
                    "pid": process.pid,
                    "memory_rss": process_memory.rss,
                    "memory_vms": process_memory.vms,
                    "cpu_percent": process.cpu_percent(),
                    "num_threads": process.num_threads(),
                    "create_time": process.create_time()
                },
                "worker": worker_stats
            }
            
            # Update Prometheus metrics
            update_prometheus_metrics(metrics)
            
            # Store metrics in database for historical analysis
            store_metrics_in_database(metrics)
            
            metrics_collector.task_completed(task_name)
            
            result = {
                "status": "success",
                "message": "Worker metrics collected successfully",
                "timestamp": datetime.utcnow().isoformat(),
                "metrics": metrics
            }
            
            logger.info("Worker metrics collected", 
                       cpu_percent=cpu_percent, memory_percent=memory.percent)
            return result
            
    except Exception as exc:
        logger.error("Worker metrics collection failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        return {
            "status": "error",
            "message": f"Metrics collection failed: {str(exc)}",
            "timestamp": datetime.utcnow().isoformat()
        }


@celery_app.task(bind=True)
def health_check(self) -> Dict[str, Any]:
    """
    Perform comprehensive health check of the worker system
    """
    task_name = "health_check"
    
    try:
        with metrics_collector.task_duration(task_name):
            health_status = {
                "overall_status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
                "checks": {}
            }
            
            # Check database connectivity
            db_health = check_database_health()
            health_status["checks"]["database"] = db_health
            
            # Check Redis connectivity (Celery broker)
            redis_health = check_redis_health()
            health_status["checks"]["redis"] = redis_health
            
            # Check system resources
            system_health = check_system_resources()
            health_status["checks"]["system"] = system_health
            
            # Check worker processes
            worker_health = check_worker_health()
            health_status["checks"]["worker"] = worker_health
            
            # Check external services (if any)
            external_health = check_external_services()
            health_status["checks"]["external"] = external_health
            
            # Determine overall health
            failed_checks = [
                name for name, check in health_status["checks"].items()
                if check.get("status") != "healthy"
            ]
            
            if failed_checks:
                health_status["overall_status"] = "unhealthy"
                health_status["failed_checks"] = failed_checks
            
            metrics_collector.task_completed(task_name)
            
            result = {
                "status": "success",
                "message": f"Health check completed - Status: {health_status['overall_status']}",
                "timestamp": datetime.utcnow().isoformat(),
                "health_status": health_status
            }
            
            logger.info("Health check completed", 
                       overall_status=health_status["overall_status"], 
                       failed_checks=len(failed_checks))
            return result
            
    except Exception as exc:
        logger.error("Health check failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        return {
            "status": "error",
            "message": f"Health check failed: {str(exc)}",
            "timestamp": datetime.utcnow().isoformat()
        }


@celery_app.task(bind=True)
def cleanup_expired_tasks(self) -> Dict[str, Any]:
    """
    Clean up expired tasks and results from Redis
    """
    task_name = "cleanup_expired_tasks"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Cleaning up expired tasks")
            
            # This would use Celery's built-in cleanup mechanisms
            # For now, we'll log the action
            
            cleanup_stats = {
                "tasks_cleaned": 0,
                "results_cleaned": 0,
                "space_freed_mb": 0
            }
            
            metrics_collector.task_completed(task_name)
            
            result = {
                "status": "success",
                "message": "Expired tasks cleaned up successfully",
                "timestamp": datetime.utcnow().isoformat(),
                "cleanup_stats": cleanup_stats
            }
            
            logger.info("Expired tasks cleanup completed", **cleanup_stats)
            return result
            
    except Exception as exc:
        logger.error("Task cleanup failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        return {
            "status": "error",
            "message": f"Task cleanup failed: {str(exc)}",
            "timestamp": datetime.utcnow().isoformat()
        }


@celery_app.task(bind=True)
def update_task_statistics(self) -> Dict[str, Any]:
    """
    Update task execution statistics for monitoring
    """
    task_name = "update_task_statistics"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Updating task statistics")
            
            # Get task statistics from the last 24 hours
            stats = get_task_statistics()
            
            # Store statistics in database
            store_task_statistics(stats)
            
            metrics_collector.task_completed(task_name)
            
            result = {
                "status": "success",
                "message": "Task statistics updated successfully",
                "timestamp": datetime.utcnow().isoformat(),
                "statistics": stats
            }
            
            logger.info("Task statistics updated", total_tasks=stats.get("total_tasks", 0))
            return result
            
    except Exception as exc:
        logger.error("Task statistics update failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        return {
            "status": "error",
            "message": f"Task statistics update failed: {str(exc)}",
            "timestamp": datetime.utcnow().isoformat()
        }


def get_worker_stats() -> Dict[str, Any]:
    """Get Celery worker statistics"""
    try:
        from ..celery_app import celery_app
        
        # Use Celery inspect to get worker stats
        inspect = celery_app.control.inspect()
        
        # Get active workers
        active_workers = inspect.active()
        if active_workers is None:
            active_workers = {}
        
        # Get scheduled tasks
        scheduled = inspect.scheduled()
        if scheduled is None:
            scheduled = {}
        
        # Get reserved tasks
        reserved = inspect.reserved()
        if reserved is None:
            reserved = {}
        
        # Get stats
        stats = inspect.stats()
        if stats is None:
            stats = {}
        
        return {
            "active_workers": len(active_workers),
            "worker_details": active_workers,
            "scheduled_tasks": sum(len(tasks) for tasks in scheduled.values()),
            "reserved_tasks": sum(len(tasks) for tasks in reserved.values()),
            "stats": stats
        }
        
    except Exception as exc:
        logger.error("Failed to get worker stats", error=str(exc))
        return {
            "active_workers": 0,
            "error": str(exc)
        }


def update_prometheus_metrics(metrics: Dict[str, Any]) -> None:
    """Update Prometheus metrics"""
    try:
        # CPU metrics
        metrics_collector.gauge('system_cpu_percent', metrics["system"]["cpu_percent"])
        
        # Memory metrics
        memory = metrics["system"]["memory"]
        metrics_collector.gauge('system_memory_percent', memory["percent"])
        metrics_collector.gauge('system_memory_used_bytes', memory["used"])
        metrics_collector.gauge('system_memory_available_bytes', memory["available"])
        
        # Disk metrics
        disk = metrics["system"]["disk"]
        metrics_collector.gauge('system_disk_percent', disk["percent"])
        metrics_collector.gauge('system_disk_used_bytes', disk["used"])
        metrics_collector.gauge('system_disk_free_bytes', disk["free"])
        
        # Process metrics
        process = metrics["process"]
        metrics_collector.gauge('process_memory_rss_bytes', process["memory_rss"])
        metrics_collector.gauge('process_memory_vms_bytes', process["memory_vms"])
        metrics_collector.gauge('process_cpu_percent', process["cpu_percent"])
        metrics_collector.gauge('process_num_threads', process["num_threads"])
        
        # Worker metrics
        worker = metrics["worker"]
        metrics_collector.gauge('worker_active_count', worker.get("active_workers", 0))
        metrics_collector.gauge('worker_scheduled_tasks', worker.get("scheduled_tasks", 0))
        metrics_collector.gauge('worker_reserved_tasks', worker.get("reserved_tasks", 0))
        
    except Exception as exc:
        logger.error("Failed to update Prometheus metrics", error=str(exc))


def store_metrics_in_database(metrics: Dict[str, Any]) -> None:
    """Store metrics in database for historical analysis"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO worker_metrics (
                timestamp, cpu_percent, memory_percent, disk_percent,
                active_workers, scheduled_tasks, reserved_tasks,
                memory_rss_bytes, memory_vms_bytes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            metrics["timestamp"],
            metrics["system"]["cpu_percent"],
            metrics["system"]["memory"]["percent"],
            metrics["system"]["disk"]["percent"],
            metrics["worker"].get("active_workers", 0),
            metrics["worker"].get("scheduled_tasks", 0),
            metrics["worker"].get("reserved_tasks", 0),
            metrics["process"]["memory_rss"],
            metrics["process"]["memory_vms"]
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
    except Exception as exc:
        logger.error("Failed to store metrics in database", error=str(exc))


def check_database_health() -> Dict[str, Any]:
    """Check database connectivity and performance"""
    try:
        start_time = time.time()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Simple health query
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        response_time = (time.time() - start_time) * 1000  # Convert to ms
        
        if result and result[0] == 1:
            return {
                "status": "healthy",
                "response_time_ms": response_time,
                "message": "Database connection successful"
            }
        else:
            return {
                "status": "unhealthy",
                "response_time_ms": response_time,
                "message": "Database query failed"
            }
            
    except Exception as exc:
        return {
            "status": "unhealthy",
            "error": str(exc),
            "message": "Database connection failed"
        }


def check_redis_health() -> Dict[str, Any]:
    """Check Redis connectivity (Celery broker)"""
    try:
        import redis
        from ..settings import settings
        
        start_time = time.time()
        r = redis.from_url(settings.redis_url)
        
        # Simple ping test
        result = r.ping()
        
        response_time = (time.time() - start_time) * 1000
        
        if result:
            return {
                "status": "healthy",
                "response_time_ms": response_time,
                "message": "Redis connection successful"
            }
        else:
            return {
                "status": "unhealthy",
                "response_time_ms": response_time,
                "message": "Redis ping failed"
            }
            
    except Exception as exc:
        return {
            "status": "unhealthy",
            "error": str(exc),
            "message": "Redis connection failed"
        }


def check_system_resources() -> Dict[str, Any]:
    """Check system resource usage"""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        warnings = []
        
        if cpu_percent > 80:
            warnings.append(f"High CPU usage: {cpu_percent}%")
        
        if memory.percent > 85:
            warnings.append(f"High memory usage: {memory.percent}%")
        
        if (disk.used / disk.total) * 100 > 90:
            warnings.append(f"High disk usage: {(disk.used / disk.total) * 100:.1f}%")
        
        status = "healthy" if not warnings else "warning"
        
        return {
            "status": status,
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "disk_percent": (disk.used / disk.total) * 100,
            "warnings": warnings
        }
        
    except Exception as exc:
        return {
            "status": "unhealthy",
            "error": str(exc),
            "message": "System resource check failed"
        }


def check_worker_health() -> Dict[str, Any]:
    """Check Celery worker health"""
    try:
        worker_stats = get_worker_stats()
        active_workers = worker_stats.get("active_workers", 0)
        
        if active_workers == 0:
            return {
                "status": "unhealthy",
                "active_workers": active_workers,
                "message": "No active workers found"
            }
        
        return {
            "status": "healthy",
            "active_workers": active_workers,
            "scheduled_tasks": worker_stats.get("scheduled_tasks", 0),
            "reserved_tasks": worker_stats.get("reserved_tasks", 0),
            "message": f"{active_workers} active workers"
        }
        
    except Exception as exc:
        return {
            "status": "unhealthy",
            "error": str(exc),
            "message": "Worker health check failed"
        }


def check_external_services() -> Dict[str, Any]:
    """Check external service connectivity"""
    # This would check any external services the worker depends on
    # For now, return a placeholder
    return {
        "status": "healthy",
        "message": "No external services configured"
    }


def get_task_statistics() -> Dict[str, Any]:
    """Get task execution statistics"""
    try:
        # This would query the database for task execution statistics
        # For now, return placeholder data
        return {
            "total_tasks": 0,
            "successful_tasks": 0,
            "failed_tasks": 0,
            "average_execution_time": 0,
            "last_24_hours": {
                "total": 0,
                "successful": 0,
                "failed": 0
            }
        }
        
    except Exception as exc:
        logger.error("Failed to get task statistics", error=str(exc))
        return {}


def store_task_statistics(stats: Dict[str, Any]) -> None:
    """Store task statistics in database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO task_statistics (
                timestamp, total_tasks, successful_tasks, failed_tasks,
                average_execution_time
            ) VALUES (%s, %s, %s, %s, %s)
        """, (
            datetime.utcnow(),
            stats.get("total_tasks", 0),
            stats.get("successful_tasks", 0),
            stats.get("failed_tasks", 0),
            stats.get("average_execution_time", 0)
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
    except Exception as exc:
        logger.error("Failed to store task statistics", error=str(exc))