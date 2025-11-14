"""
Prometheus metrics server for Celery worker
"""

import os
import sys
import time
import signal
import threading

# Add apps directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from apps.worker.utils.metrics import init_metrics
from apps.worker.settings import settings

class MetricsServer:
    """Standalone metrics server"""
    
    def __init__(self):
        self.running = False
        self.shutdown_event = threading.Event()
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        print(f"Received signal {signum}, shutting down...")
        self.shutdown_event.set()
    
    def run(self):
        """Run the metrics server"""
        # Register signal handlers
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        print(f"Starting Prometheus metrics server on port {settings.prometheus_port}")
        
        # Initialize metrics
        init_metrics(settings.prometheus_port)
        
        self.running = True
        print(f"Metrics server running on http://localhost:{settings.prometheus_port}")
        
        # Keep the server running
        try:
            while self.running and not self.shutdown_event.is_set():
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        finally:
            print("Metrics server stopped")
            self.running = False

if __name__ == '__main__':
    server = MetricsServer()
    server.run()