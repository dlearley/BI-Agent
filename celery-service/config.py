"""
Celery configuration
"""
import os
from kombu import Exchange, Queue
from datetime import timedelta

# Broker settings
broker_url = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
result_backend = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')

# Task settings
task_serializer = 'json'
accept_content = ['json']
result_serializer = 'json'
timezone = os.getenv('CELERY_TIMEZONE', 'UTC')
enable_utc = True

# Task routing
task_routes = {
    'tasks.analytics.*': {'queue': 'analytics'},
    'tasks.ml.*': {'queue': 'ml'},
    'tasks.data.*': {'queue': 'data'},
}

# Queue configuration
task_default_queue = 'default'
task_queues = (
    Queue('default', Exchange('default'), routing_key='default'),
    Queue('analytics', Exchange('analytics'), routing_key='analytics'),
    Queue('ml', Exchange('ml'), routing_key='ml'),
    Queue('data', Exchange('data'), routing_key='data'),
)

# Schedule settings for beat
beat_schedule = {
    'refresh-analytics': {
        'task': 'tasks.analytics.refresh_views',
        'schedule': timedelta(hours=1),
        'options': {'queue': 'analytics'}
    },
    'update-ml-models': {
        'task': 'tasks.ml.update_models',
        'schedule': timedelta(days=1),
        'options': {'queue': 'ml'}
    },
}

# Result backend settings
result_expires = 3600  # 1 hour
result_persistent = True

# Worker settings
worker_prefetch_multiplier = 1
worker_max_tasks_per_child = 1000
worker_disable_rate_limits = False

# Logging
worker_hijack_root_logger = False
worker_log_format = '[%(asctime)s: %(levelname)s/%(processName)s] %(message)s'
worker_task_log_format = '[%(asctime)s: %(levelname)s/%(processName)s][%(task_name)s(%(task_id)s)] %(message)s'
