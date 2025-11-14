"""
Database migration script for Celery worker tables

This script creates the necessary database tables for the Celery worker
to function properly with the analytics platform.
"""

import sys
import os

# Add the apps directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from apps.worker.utils.database import create_analytics_tables_if_not_exist
import structlog

logger = structlog.get_logger(__name__)

def main():
    """Create analytics tables if they don't exist"""
    try:
        logger.info("Creating analytics tables for Celery worker...")
        create_analytics_tables_if_not_exist()
        logger.info("Analytics tables created successfully!")
        
    except Exception as exc:
        logger.error("Failed to create analytics tables", error=str(exc))
        sys.exit(1)

if __name__ == '__main__':
    main()