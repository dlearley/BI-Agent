#!/bin/bash
# Setup script for local development environment
# This script configures the local development network and Docker environment

set -e

echo "=========================================="
echo "Setting up local development environment"
echo "=========================================="

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo "✓ Creating .env file from .env.example..."
  cp .env.example .env
  echo "  Edit .env with your configuration"
else
  echo "✓ .env file already exists"
fi

# Create necessary directories
echo "✓ Creating required directories..."
mkdir -p analytics-service/logs
mkdir -p ml-service/logs
mkdir -p celery-service/logs
mkdir -p scripts/data

# Make scripts executable
chmod +x scripts/*.sh

# Check Docker installation
if ! command -v docker &> /dev/null; then
  echo "✗ Docker is not installed. Please install Docker to continue."
  exit 1
fi

echo "✓ Docker is installed"

# Check Docker Compose installation
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "✗ Docker Compose is not installed. Please install Docker Compose to continue."
  exit 1
fi

echo "✓ Docker Compose is installed"

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
  echo "✗ Docker daemon is not running. Please start Docker."
  exit 1
fi

echo "✓ Docker daemon is running"

echo ""
echo "=========================================="
echo "Local development environment setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review and update .env with your configuration"
echo "2. Run: docker-compose up"
echo "3. Access services:"
echo "   - Analytics API: http://localhost:3000"
echo "   - Web UI: http://localhost:3001"
echo "   - ML Service: http://localhost:8000"
echo "   - Grafana: http://localhost:3002"
echo "   - Jaeger: http://localhost:16686"
echo "   - Prometheus: http://localhost:9090"
echo "   - MinIO Console: http://localhost:9001"
echo ""
