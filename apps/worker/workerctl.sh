#!/bin/bash

# Celery Worker Management Script

set -e

# Configuration
WORKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_PATH="${PYTHON_PATH:-python3}"
VENV_PATH="${VENV_PATH:-$WORKER_DIR/venv}"
LOG_DIR="${LOG_DIR:-$WORKER_DIR/logs}"
PID_DIR="${PID_DIR:-$WORKER_DIR/pids}"
ENV_FILE="${ENV_FILE:-$WORKER_DIR/.env}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Create necessary directories
create_directories() {
    mkdir -p "$LOG_DIR" "$PID_DIR"
}

# Check if virtual environment exists
check_venv() {
    if [ ! -d "$VENV_PATH" ]; then
        log "Creating virtual environment..."
        $PYTHON_PATH -m venv "$VENV_PATH"
    fi
    
    if [ ! -f "$VENV_PATH/bin/activate" ]; then
        error "Virtual environment not found at $VENV_PATH"
        exit 1
    fi
}

# Activate virtual environment
activate_venv() {
    source "$VENV_PATH/bin/activate"
}

# Install dependencies
install_deps() {
    log "Installing dependencies..."
    pip install -r "$WORKER_DIR/requirements.txt"
}

# Setup
setup() {
    log "Setting up Celery worker environment..."
    create_directories
    check_venv
    activate_venv
    install_deps
    
    # Copy environment file if it doesn't exist
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$WORKER_DIR/.env.example" ]; then
            cp "$WORKER_DIR/.env.example" "$ENV_FILE"
            warn "Environment file created from example. Please edit $ENV_FILE with your configuration."
        else
            warn "No .env.example file found. Creating empty .env file."
            touch "$ENV_FILE"
        fi
    fi
    
    log "Setup completed successfully!"
}

# Start worker
start_worker() {
    local queue="${1:-analytics}"
    local concurrency="${2:-2}"
    
    log "Starting Celery worker for queue: $queue (concurrency: $concurrency)"
    
    activate_venv
    
    celery -A apps.worker.celery_app worker \
        --loglevel=info \
        --queues="$queue" \
        --concurrency="$concurrency" \
        --logfile="$LOG_DIR/worker-$queue.log" \
        --pidfile="$PID_DIR/worker-$queue.pid" \
        --detach
    
    log "Worker started for queue: $queue"
}

# Start all workers
start_all_workers() {
    log "Starting all Celery workers..."
    
    # Analytics worker
    start_worker "analytics" 2
    
    # dbt worker (lower concurrency due to resource intensity)
    start_worker "dbt" 1
    
    # Alerts worker (higher concurrency for quick processing)
    start_worker "alerts" 4
    
    # Reports worker
    start_worker "reports" 2
    
    # Monitoring worker
    start_worker "monitoring" 1
    
    log "All workers started successfully!"
}

# Start beat scheduler
start_beat() {
    log "Starting Celery beat scheduler..."
    
    activate_venv
    
    celery -A apps.worker.celery_app beat \
        --loglevel=info \
        --logfile="$LOG_DIR/beat.log" \
        --pidfile="$PID_DIR/beat.pid" \
        --detach
    
    log "Beat scheduler started!"
}

# Start Flower monitoring
start_flower() {
    log "Starting Flower monitoring..."
    
    activate_venv
    
    python "$WORKER_DIR/flower.py" > "$LOG_DIR/flower.log" 2>&1 &
    echo $! > "$PID_DIR/flower.pid"
    
    log "Flower monitoring started on http://localhost:5555"
}

# Start metrics server
start_metrics() {
    log "Starting Prometheus metrics server..."
    
    activate_venv
    
    python "$WORKER_DIR/metrics_server.py" > "$LOG_DIR/metrics.log" 2>&1 &
    echo $! > "$PID_DIR/metrics.pid"
    
    log "Metrics server started on http://localhost:8000"
}

# Stop worker
stop_worker() {
    local queue="${1:-analytics}"
    local pid_file="$PID_DIR/worker-$queue.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        log "Stopping worker for queue: $queue (PID: $pid)"
        
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            
            # Wait for graceful shutdown
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 30 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                warn "Force killing worker for queue: $queue"
                kill -9 "$pid"
            fi
        fi
        
        rm -f "$pid_file"
        log "Worker stopped for queue: $queue"
    else
        warn "No PID file found for worker queue: $queue"
    fi
}

# Stop all workers
stop_all_workers() {
    log "Stopping all Celery workers..."
    
    stop_worker "analytics"
    stop_worker "dbt"
    stop_worker "alerts"
    stop_worker "reports"
    stop_worker "monitoring"
    
    log "All workers stopped!"
}

# Stop beat scheduler
stop_beat() {
    local pid_file="$PID_DIR/beat.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        log "Stopping beat scheduler (PID: $pid)"
        
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            
            # Wait for graceful shutdown
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                warn "Force killing beat scheduler"
                kill -9 "$pid"
            fi
        fi
        
        rm -f "$pid_file"
        log "Beat scheduler stopped"
    else
        warn "No PID file found for beat scheduler"
    fi
}

# Stop Flower
stop_flower() {
    local pid_file="$PID_DIR/flower.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        log "Stopping Flower monitoring (PID: $pid)"
        
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
        fi
        
        rm -f "$pid_file"
        log "Flower monitoring stopped"
    else
        warn "No PID file found for Flower monitoring"
    fi
}

# Stop metrics server
stop_metrics() {
    local pid_file="$PID_DIR/metrics.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        log "Stopping metrics server (PID: $pid)"
        
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
        fi
        
        rm -f "$pid_file"
        log "Metrics server stopped"
    else
        warn "No PID file found for metrics server"
    fi
}

# Stop all services
stop_all() {
    log "Stopping all Celery services..."
    
    stop_all_workers
    stop_beat
    stop_flower
    stop_metrics
    
    log "All services stopped!"
}

# Restart all services
restart_all() {
    log "Restarting all Celery services..."
    
    stop_all
    sleep 2
    start_all
    
    log "All services restarted!"
}

# Start all services
start_all() {
    log "Starting all Celery services..."
    
    start_all_workers
    start_beat
    start_flower
    start_metrics
    
    log "All services started successfully!"
    echo ""
    echo "Service URLs:"
    echo "  - Flower Monitoring: http://localhost:5555"
    echo "  - Prometheus Metrics: http://localhost:8000"
    echo ""
    echo "Log files:"
    echo "  - Workers: $LOG_DIR/worker-*.log"
    echo "  - Beat: $LOG_DIR/beat.log"
    echo "  - Flower: $LOG_DIR/flower.log"
    echo "  - Metrics: $LOG_DIR/metrics.log"
}

# Show status
status() {
    log "Checking service status..."
    echo ""
    
    # Check workers
    for queue in analytics dbt alerts reports monitoring; do
        local pid_file="$PID_DIR/worker-$queue.pid"
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                echo "✓ Worker ($queue): Running (PID: $pid)"
            else
                echo "✗ Worker ($queue): Not running (stale PID file)"
            fi
        else
            echo "✗ Worker ($queue): Not running"
        fi
    done
    
    # Check beat
    local beat_pid_file="$PID_DIR/beat.pid"
    if [ -f "$beat_pid_file" ]; then
        local pid=$(cat "$beat_pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "✓ Beat Scheduler: Running (PID: $pid)"
        else
            echo "✗ Beat Scheduler: Not running (stale PID file)"
        fi
    else
        echo "✗ Beat Scheduler: Not running"
    fi
    
    # Check flower
    local flower_pid_file="$PID_DIR/flower.pid"
    if [ -f "$flower_pid_file" ]; then
        local pid=$(cat "$flower_pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "✓ Flower Monitoring: Running (PID: $pid)"
        else
            echo "✗ Flower Monitoring: Not running (stale PID file)"
        fi
    else
        echo "✗ Flower Monitoring: Not running"
    fi
    
    # Check metrics
    local metrics_pid_file="$PID_DIR/metrics.pid"
    if [ -f "$metrics_pid_file" ]; then
        local pid=$(cat "$metrics_pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "✓ Metrics Server: Running (PID: $pid)"
        else
            echo "✗ Metrics Server: Not running (stale PID file)"
        fi
    else
        echo "✗ Metrics Server: Not running"
    fi
    
    echo ""
}

# Show help
show_help() {
    echo "Celery Worker Management Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  setup                 Setup the worker environment"
    echo "  start-all            Start all services"
    echo "  stop-all             Stop all services"
    echo "  restart-all          Restart all services"
    echo "  start-worker QUEUE   Start worker for specific queue"
    echo "  stop-worker QUEUE    Stop worker for specific queue"
    echo "  start-beat           Start beat scheduler"
    echo "  stop-beat            Stop beat scheduler"
    echo "  start-flower         Start Flower monitoring"
    echo "  stop-flower          Stop Flower monitoring"
    echo "  start-metrics        Start metrics server"
    echo "  stop-metrics         Stop metrics server"
    echo "  status               Show service status"
    echo "  help                 Show this help message"
    echo ""
    echo "Available queues: analytics, dbt, alerts, reports, monitoring"
    echo ""
    echo "Environment variables:"
    echo "  PYTHON_PATH          Python executable (default: python3)"
    echo "  VENV_PATH            Virtual environment path (default: ./venv)"
    echo "  LOG_DIR              Log directory (default: ./logs)"
    echo "  PID_DIR              PID file directory (default: ./pids)"
    echo "  ENV_FILE             Environment file (default: ./.env)"
    echo ""
    echo "Examples:"
    echo "  $0 setup                                    # Initial setup"
    echo "  $0 start-all                               # Start all services"
    echo "  $0 start-worker analytics 4                # Start analytics worker with 4 processes"
    echo "  $0 status                                  # Check service status"
}

# Main script logic
case "${1:-help}" in
    setup)
        setup
        ;;
    start-all)
        start_all
        ;;
    stop-all)
        stop_all
        ;;
    restart-all)
        restart_all
        ;;
    start-worker)
        if [ -z "$2" ]; then
            error "Queue name required"
            echo "Usage: $0 start-worker QUEUE [CONCURRENCY]"
            exit 1
        fi
        start_worker "$2" "${3:-2}"
        ;;
    stop-worker)
        if [ -z "$2" ]; then
            error "Queue name required"
            echo "Usage: $0 stop-worker QUEUE"
            exit 1
        fi
        stop_worker "$2"
        ;;
    start-beat)
        start_beat
        ;;
    stop-beat)
        stop_beat
        ;;
    start-flower)
        start_flower
        ;;
    stop-flower)
        stop_flower
        ;;
    start-metrics)
        start_metrics
        ;;
    stop-metrics)
        stop_metrics
        ;;
    status)
        status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac