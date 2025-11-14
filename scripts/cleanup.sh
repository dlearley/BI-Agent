#!/bin/bash
# Cleanup script for Docker Compose services
# Removes containers, volumes, and networks

set -e

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Docker Compose Cleanup"
echo "=========================================="
echo ""
echo -e "${YELLOW}WARNING: This script will remove containers and volumes${NC}"
echo ""

# Ask for confirmation
read -p "Do you want to remove all containers? (y/N): " -n 1 -r confirm_containers
echo ""

remove_volumes=false
if [[ $confirm_containers =~ ^[Yy]$ ]]; then
  read -p "Do you also want to remove volumes (CAUTION: deletes data)? (y/N): " -n 1 -r confirm_volumes
  echo ""
  
  if [[ $confirm_volumes =~ ^[Yy]$ ]]; then
    remove_volumes=true
  fi
fi

if [[ ! $confirm_containers =~ ^[Yy]$ ]]; then
  echo "Cleanup cancelled."
  exit 0
fi

echo ""
echo "=========================================="

# Stop services
echo "Stopping services..."
docker-compose stop || true

# Remove containers
echo "Removing containers..."
docker-compose rm -f

# Remove volumes if requested
if [ "$remove_volumes" = true ]; then
  echo "Removing volumes..."
  docker-compose down -v
else
  echo "Removing networks..."
  docker-compose down
fi

echo ""
echo -e "${GREEN}Cleanup completed!${NC}"
echo ""
echo "To completely clean up Docker:"
echo "  docker image prune        - Remove unused images"
echo "  docker volume prune       - Remove unused volumes"
echo "  docker network prune      - Remove unused networks"
echo ""
