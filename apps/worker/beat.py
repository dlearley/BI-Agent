"""
Main entry point for Celery beat scheduler
"""

import os
import sys
from celery import Celery
from celery.beat import Beat

# Add the apps directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from apps.worker.celery_app import celery_app

if __name__ == '__main__':
    beat = Beat(app=celery_app)
    beat.start()