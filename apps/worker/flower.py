"""
Flower monitoring service for Celery
"""

import os
import sys
from flower import command as flower_command

# Add apps directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from apps.worker.settings import settings

if __name__ == '__main__':
    # Configure Flower with our settings
    flower_options = [
        f'--broker={settings.celery_broker_url_resolved}',
        f'--port={settings.flower_port}',
        '--basic_auth=admin:admin',  # Should be configurable
        '--inspect_timeout=60',
        '--max_tasks=10000',
        '--format=json'
    ]
    
    # Start Flower
    flower_command.main(flower_options)