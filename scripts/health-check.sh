#!/bin/bash
# Health check script for Docker Compose services
# Verifies that all services are running and healthy

set -e

echo "=========================================="
echo "Checking service health..."
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service
check_service() {
  local service_name=$1
  local port=$2
  local endpoint=$3
  
  echo -n "Checking $service_name on port $port... "
  
  if timeout 5 bash -c "echo >/dev/tcp/localhost/$port" 2>/dev/null; then
    echo -e "${GREEN}✓ Running${NC}"
    return 0
  else
    echo -e "${RED}✗ Not responding${NC}"
    return 1
  fi
}

# Check all services
services_ok=true

check_service "PostgreSQL" 5432 || services_ok=false
check_service "Redis" 6379 || services_ok=false
check_service "MinIO" 9000 || services_ok=false
check_service "Analytics API" 3000 "/health" || services_ok=false
check_service "Web UI" 3001 || services_ok=false
check_service "ML Service" 8000 "/health" || services_ok=false
check_service "Prometheus" 9090 || services_ok=false
check_service "Grafana" 3002 || services_ok=false
check_service "Jaeger" 16686 || services_ok=false
check_service "OTel Collector" 4318 || services_ok=false

echo ""
echo "=========================================="

if [ "$services_ok" = true ]; then
  echo -e "${GREEN}All services are healthy!${NC}"
  echo ""
  echo "Service URLs:"
  echo "  - Analytics API: http://localhost:3000/health"
  echo "  - Web UI: http://localhost:3001"
  echo "  - ML Service: http://localhost:8000/health"
  echo "  - MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
  echo "  - Grafana: http://localhost:3002 (admin/admin)"
  echo "  - Jaeger UI: http://localhost:16686"
  echo "  - Prometheus: http://localhost:9090"
  exit 0
else
  echo -e "${RED}Some services are not healthy.${NC}"
  echo "Run: docker-compose logs -f"
  echo "to see service logs"
  exit 1
fi
