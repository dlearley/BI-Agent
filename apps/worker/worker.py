"""
Main entry point for Celery worker
"""

import os
import sys
from celery import Celery

# Add the apps directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from apps.worker.celery_app import celery_app

if __name__ == '__main__':
    celery_app.start()