#!/bin/bash
# View logs for Docker Compose services

set -e

# Color codes
CYAN='\033[0;36m'
NC='\033[0m'

# Service list
services=(
  "postgres"
  "redis"
  "minio"
  "analytics-api"
  "ml-service"
  "web"
  "celery-worker"
  "celery-beat"
  "otel-collector"
  "jaeger"
  "prometheus"
  "grafana"
)

echo "=========================================="
echo "Docker Compose Service Logs"
echo "=========================================="
echo ""
echo "Available services:"
echo ""

for i in "${!services[@]}"; do
  echo "$((i+1)). ${services[$i]}"
done

echo ""
echo "0. All services"
echo "Q. Quit"
echo ""

read -p "Select service (0-${#services[@]}): " -r choice

case $choice in
  0)
    docker-compose logs -f
    ;;
  Q|q)
    echo "Exiting..."
    exit 0
    ;;
  *)
    if [[ $choice =~ ^[0-9]+$ ]] && [ $choice -gt 0 ] && [ $choice -le ${#services[@]} ]; then
      service_index=$((choice - 1))
      service_name=${services[$service_index]}
      
      echo ""
      echo -e "${CYAN}=== Logs for $service_name ===${NC}"
      echo ""
      
      docker-compose logs -f "$service_name"
    else
      echo "Invalid selection"
      exit 1
    fi
    ;;
esac
