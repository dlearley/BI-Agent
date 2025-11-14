"""
Celery Worker Configuration for Analytics Platform

This module configures Celery workers for handling analytics tasks including:
- Query refreshes
- Materializations
- dbt runs
- Alerts
- Reports
"""

import os
from celery import Celery
from kombu import Queue
from .settings import settings
from .utils.circuit_breaker import CircuitBreaker
from .utils.metrics import metrics_collector

# Create Celery app
celery_app = Celery(
    'analytics_worker',
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        'apps.worker.tasks.analytics',
        'apps.worker.tasks.dbt_tasks',
        'apps.worker.tasks.alerts',
        'apps.worker.tasks.reports',
        'apps.worker.tasks.monitoring'
    ]
)

# Configure queues
celery_app.conf.task_routes = {
    'apps.worker.tasks.analytics.*': {'queue': 'analytics'},
    'apps.worker.tasks.dbt_tasks.*': {'queue': 'dbt'},
    'apps.worker.tasks.alerts.*': {'queue': 'alerts'},
    'apps.worker.tasks.reports.*': {'queue': 'reports'},
    'apps.worker.tasks.monitoring.*': {'queue': 'monitoring'},
}

# Define queues
celery_app.conf.task_queues = (
    Queue('analytics', routing_key='analytics'),
    Queue('dbt', routing_key='dbt'),
    Queue('alerts', routing_key='alerts'),
    Queue('reports', routing_key='reports'),
    Queue('monitoring', routing_key='monitoring'),
)

# Task configuration
celery_app.conf.task_serializer = 'json'
celery_app.conf.result_serializer = 'json'
celery_app.conf.accept_content = ['json']
celery_app.conf.result_expires = 3600
celery_app.conf.timezone = 'UTC'
celery_app.conf.enable_utc = True

# Worker configuration
celery_app.conf.worker_prefetch_multiplier = 1
celery_app.conf.task_acks_late = True
celery_app.conf.worker_max_tasks_per_child = 1000

# Retry and backoff configuration
celery_app.conf.task_reject_on_worker_lost = True
celery_app.conf.task_default_retry_delay = 60  # seconds
celery_app.conf.task_max_retries = 3
celery_app.conf.task_default_exponential_backoff = True
celery_app.conf.task_retry exponential_backoff_max_retry_delay = 600

# Concurrency limits per queue
celery_app.conf.worker_concurrency = {
    'analytics': 2,
    'dbt': 1,  # dbt runs are resource intensive
    'alerts': 4,  # Alerts should be processed quickly
    'reports': 2,
    'monitoring': 1,
}

# Beat schedule configuration
celery_app.conf.beat_schedule = {
    # Catalog refresh tasks
    'refresh-catalog-every-5-minutes': {
        'task': 'apps.worker.tasks.analytics.refresh_catalog',
        'schedule': 300.0,  # 5 minutes
        'options': {'queue': 'analytics'}
    },
    'refresh-materialized-views-hourly': {
        'task': 'apps.worker.tasks.analytics.refresh_materialized_views',
        'schedule': 3600.0,  # 1 hour
        'options': {'queue': 'analytics'}
    },
    
    # dbt tasks
    'run-dbt-models-daily': {
        'task': 'apps.worker.tasks.dbt_tasks.run_dbt_models',
        'schedule': 86400.0,  # 24 hours at 2 AM
        'options': {'queue': 'dbt'},
        'args': (['--models', 'staging', 'kpis'],)
    },
    'dbt-test-daily': {
        'task': 'apps.worker.tasks.dbt_tasks.run_dbt_tests',
        'schedule': 86400.0,  # 24 hours at 3 AM
        'options': {'queue': 'dbt'}
    },
    
    # Alert processing
    'process-alerts-every-2-minutes': {
        'task': 'apps.worker.tasks.alerts.process_pending_alerts',
        'schedule': 120.0,  # 2 minutes
        'options': {'queue': 'alerts'}
    },
    'check-alert-thresholds-every-5-minutes': {
        'task': 'apps.worker.tasks.alerts.check_threshold_conditions',
        'schedule': 300.0,  # 5 minutes
        'options': {'queue': 'alerts'}
    },
    
    # Report generation
    'generate-daily-reports': {
        'task': 'apps.worker.tasks.reports.generate_scheduled_reports',
        'schedule': 86400.0,  # 24 hours at 6 AM
        'options': {'queue': 'reports'},
        'args': ('daily',)
    },
    'generate-weekly-reports': {
        'task': 'apps.worker.tasks.reports.generate_scheduled_reports',
        'schedule': 604800.0,  # 7 days on Monday at 8 AM
        'options': {'queue': 'reports'},
        'args': ('weekly',)
    },
    
    # Monitoring and metrics
    'collect-metrics-every-minute': {
        'task': 'apps.worker.tasks.monitoring.collect_worker_metrics',
        'schedule': 60.0,  # 1 minute
        'options': {'queue': 'monitoring'}
    },
    'health-check-every-5-minutes': {
        'task': 'apps.worker.tasks.monitoring.health_check',
        'schedule': 300.0,  # 5 minutes
        'options': {'queue': 'monitoring'}
    },
}

# Initialize circuit breakers for external services
db_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=60,
    expected_exception=Exception
)

dbt_circuit_breaker = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=120,
    expected_exception=Exception
)

# Configure task signals for metrics
@celery_app.task(bind=True)
def task_with_metrics(self, task_func, *args, **kwargs):
    """Wrapper to add metrics to all tasks"""
    task_name = self.name
    
    with metrics_collector.task_duration(task_name):
        try:
            metrics_collector.task_started(task_name)
            result = task_func(*args, **kwargs)
            metrics_collector.task_completed(task_name)
            return result
        except Exception as e:
            metrics_collector.task_failed(task_name, str(e))
            raise

# Import tasks to register them
from .tasks import analytics, dbt_tasks, alerts, reports, monitoring