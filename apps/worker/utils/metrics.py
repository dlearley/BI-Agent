"""
Prometheus Metrics Collection

This module provides Prometheus metrics collection for the Celery worker.
"""

import time
from typing import Dict, Any
from prometheus_client import Counter, Histogram, Gauge, start_http_server, CollectorRegistry
import structlog

logger = structlog.get_logger(__name__)


class MetricsCollector:
    """
    Prometheus metrics collector for Celery worker
    """
    
    def __init__(self, registry: CollectorRegistry = None):
        self.registry = registry or CollectorRegistry()
        
        # Task metrics
        self.task_counter = Counter(
            'celery_worker_tasks_total',
            'Total number of tasks processed',
            ['task_name', 'status'],
            registry=self.registry
        )
        
        self.task_duration = Histogram(
            'celery_worker_task_duration_seconds',
            'Time spent processing tasks',
            ['task_name'],
            registry=self.registry
        )
        
        self.task_retry_counter = Counter(
            'celery_worker_task_retries_total',
            'Total number of task retries',
            ['task_name'],
            registry=self.registry
        )
        
        # Queue metrics
        self.queue_size = Gauge(
            'celery_worker_queue_size',
            'Current queue size',
            ['queue_name'],
            registry=self.registry
        )
        
        # System metrics
        self.system_cpu = Gauge(
            'system_cpu_percent',
            'System CPU usage percentage',
            registry=self.registry
        )
        
        self.system_memory = Gauge(
            'system_memory_percent',
            'System memory usage percentage',
            registry=self.registry
        )
        
        self.system_disk = Gauge(
            'system_disk_percent',
            'System disk usage percentage',
            registry=self.registry
        )
        
        # Process metrics
        self.process_memory_rss = Gauge(
            'process_memory_rss_bytes',
            'Process RSS memory usage in bytes',
            registry=self.registry
        )
        
        self.process_memory_vms = Gauge(
            'process_memory_vms_bytes',
            'Process VMS memory usage in bytes',
            registry=self.registry
        )
        
        self.process_cpu = Gauge(
            'process_cpu_percent',
            'Process CPU usage percentage',
            registry=self.registry
        )
        
        self.process_threads = Gauge(
            'process_num_threads',
            'Number of process threads',
            registry=self.registry
        )
        
        # Worker metrics
        self.worker_active = Gauge(
            'worker_active_count',
            'Number of active workers',
            registry=self.registry
        )
        
        self.worker_scheduled = Gauge(
            'worker_scheduled_tasks',
            'Number of scheduled tasks',
            registry=self.registry
        )
        
        self.worker_reserved = Gauge(
            'worker_reserved_tasks',
            'Number of reserved tasks',
            registry=self.registry
        )
        
        # Database metrics
        self.db_connection_time = Histogram(
            'db_connection_duration_seconds',
            'Database connection time in seconds',
            registry=self.registry
        )
        
        self.db_query_time = Histogram(
            'db_query_duration_seconds',
            'Database query time in seconds',
            ['query_type'],
            registry=self.registry
        )
        
        # Alert metrics
        self.alert_counter = Counter(
            'alerts_triggered_total',
            'Total number of alerts triggered',
            ['alert_type', 'severity'],
            registry=self.registry
        )
        
        # Report metrics
        self.report_counter = Counter(
            'reports_generated_total',
            'Total number of reports generated',
            ['report_type', 'format'],
            registry=self.registry
        )
        
        self.report_generation_time = Histogram(
            'report_generation_duration_seconds',
            'Time spent generating reports',
            ['report_type', 'format'],
            registry=self.registry
        )
    
    def task_started(self, task_name: str) -> None:
        """Record task start"""
        self.task_counter.labels(task_name=task_name, status='started').inc()
    
    def task_completed(self, task_name: str) -> None:
        """Record task completion"""
        self.task_counter.labels(task_name=task_name, status='completed').inc()
    
    def task_failed(self, task_name: str, error: str) -> None:
        """Record task failure"""
        self.task_counter.labels(task_name=task_name, status='failed').inc()
    
    def task_retried(self, task_name: str) -> None:
        """Record task retry"""
        self.task_retry_counter.labels(task_name=task_name).inc()
    
    def task_duration_context(self, task_name: str):
        """Get context manager for measuring task duration"""
        return self.task_duration.labels(task_name=task_name).time()
    
    def gauge(self, metric_name: str, value: float, labels: Dict[str, str] = None) -> None:
        """Set gauge metric value"""
        metric = getattr(self, metric_name, None)
        if metric and hasattr(metric, 'labels'):
            if labels:
                metric.labels(**labels).set(value)
            else:
                metric.set(value)
    
    def counter(self, metric_name: str, labels: Dict[str, str] = None) -> None:
        """Increment counter metric"""
        metric = getattr(self, metric_name, None)
        if metric and hasattr(metric, 'labels'):
            if labels:
                metric.labels(**labels).inc()
            else:
                metric.inc()
    
    def start_metrics_server(self, port: int = 8000) -> None:
        """Start Prometheus metrics HTTP server"""
        try:
            start_http_server(port, registry=self.registry)
            logger.info(f"Prometheus metrics server started on port {port}")
        except Exception as exc:
            logger.error("Failed to start metrics server", error=str(exc))
            raise
    
    def get_registry(self) -> CollectorRegistry:
        """Get the metrics registry"""
        return self.registry


# Global metrics collector instance
metrics_collector = MetricsCollector()


class TaskDuration:
    """Context manager for measuring task duration"""
    
    def __init__(self, task_name: str):
        self.task_name = task_name
        self.histogram = metrics_collector.task_duration.labels(task_name=task_name)
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        metrics_collector.task_started(self.task_name)
        return self.histogram.time()
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        if exc_type is None:
            metrics_collector.task_completed(self.task_name)
        else:
            metrics_collector.task_failed(self.task_name, str(exc_val))
        
        return False


def init_metrics(port: int = 8000) -> None:
    """Initialize metrics collection"""
    try:
        metrics_collector.start_metrics_server(port)
        logger.info("Metrics collection initialized", port=port)
    except Exception as exc:
        logger.error("Failed to initialize metrics", error=str(exc))
        raise