#!/bin/bash
# Database bootstrap script
# This script is run during PostgreSQL container initialization

set -e

echo "Bootstrapping analytics database..."

# Wait for PostgreSQL to be ready
until pg_isready -U postgres; do
  echo 'Waiting for PostgreSQL to be ready...'
  sleep 1
done

echo "PostgreSQL is ready!"

# Create additional users if needed (beyond the default postgres)
if [ ! -z "$DB_USER" ] && [ "$DB_USER" != "postgres" ]; then
  echo "Creating database user: $DB_USER"
  psql -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" || echo "User already exists"
  psql -U postgres -c "ALTER USER $DB_USER WITH SUPERUSER;" || true
fi

echo "Database bootstrap completed!"
