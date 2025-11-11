#!/bin/bash

# Analytics Backend Setup Script
# This script sets up the development environment for the analytics backend

set -e  # Exit on any error

echo "🚀 Setting up Analytics Backend..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi
    print_success "Node.js $(node -v) found"
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        print_warning "pnpm not found. Installing pnpm..."
        npm install -g pnpm
    fi
    print_success "pnpm $(pnpm -v) found"
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL client not found. Please install PostgreSQL."
        echo "  - macOS: brew install postgresql"
        echo "  - Ubuntu: sudo apt-get install postgresql-client"
        echo "  - Windows: Download from https://postgresql.org/download/"
    else
        print_success "PostgreSQL client found"
    fi
    
    # Check Redis
    if ! command -v redis-cli &> /dev/null; then
        print_warning "Redis client not found. Please install Redis."
        echo "  - macOS: brew install redis"
        echo "  - Ubuntu: sudo apt-get install redis-tools"
        echo "  - Windows: Download from https://redis.io/download"
    else
        print_success "Redis client found"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    pnpm install
    print_success "Dependencies installed"
}

# Setup environment variables
setup_env() {
    if [ ! -f .env ]; then
        print_status "Creating .env file from template..."
        cp .env.example .env
        print_warning "Please edit .env file with your database and Redis credentials"
        print_status "Default configuration has been applied for development"
    else
        print_status ".env file already exists"
    fi
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Read database configuration from .env
    if [ -f .env ]; then
        source .env
    else
        # Use default values
        DATABASE_URL=${DATABASE_URL:-"postgresql://username:password@localhost:5432/analytics_db"}
        DB_HOST=${DATABASE_HOST:-"localhost"}
        DB_PORT=${DATABASE_PORT:-"5432"}
        DB_NAME=${DATABASE_NAME:-"analytics_db"}
        DB_USER=${DATABASE_USER:-"username"}
        DB_PASSWORD=${DATABASE_PASSWORD:-"password"}
    fi
    
    # Parse DATABASE_URL if individual variables are not set
    if [ -z "$DB_HOST" ] && [ -n "$DATABASE_URL" ]; then
        # Extract components from DATABASE_URL
        DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
        DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
        DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\([^@]*\)@.*/\1/p')
    fi
    
    print_status "Testing database connection..."
    
    # Test database connection
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        print_success "Database connection successful"
        
        # Run migrations
        print_status "Running database migrations..."
        pnpm migrate
        print_success "Database migrations completed"
        
        # Load sample data (optional)
        if [ "$1" = "--with-sample-data" ]; then
            print_status "Loading sample data..."
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f jobs/refresh/create_sample_data.sql
            print_success "Sample data loaded"
        fi
        
    else
        print_error "Cannot connect to database. Please check your configuration in .env"
        print_status "Database configuration:"
        echo "  Host: $DB_HOST"
        echo "  Port: $DB_PORT"
        echo "  Database: $DB_NAME"
        echo "  User: $DB_USER"
        exit 1
    fi
}

# Setup Redis
setup_redis() {
    print_status "Testing Redis connection..."
    
    if [ -f .env ]; then
        source .env
    fi
    
    REDIS_HOST=${REDIS_HOST:-"localhost"}
    REDIS_PORT=${REDIS_PORT:-"6379"}
    
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &> /dev/null; then
        print_success "Redis connection successful"
    else
        print_error "Cannot connect to Redis. Please check your configuration in .env"
        print_status "Redis configuration:"
        echo "  Host: $REDIS_HOST"
        echo "  Port: $REDIS_PORT"
        exit 1
    fi
}

# Setup dbt (optional)
setup_dbt() {
    if [ "$1" = "--with-dbt" ] || [ "$2" = "--with-dbt" ]; then
        print_status "Setting up dbt..."
        
        # Check Python
        if ! command -v python3 &> /dev/null; then
            print_error "Python 3 is required for dbt. Please install Python 3.8+"
            exit 1
        fi
        
        # Check pip
        if ! command -v pip3 &> /dev/null; then
            print_error "pip3 is required for dbt. Please install pip3"
            exit 1
        fi
        
        # Install dbt
        print_status "Installing dbt-postgres..."
        pip3 install dbt-postgres
        print_success "dbt installed"
        
        # Test dbt connection
        print_status "Testing dbt connection..."
        cd dbt
        
        # Set environment variables for dbt
        export DBT_USER=${DATABASE_USER:-"username"}
        export DBT_PASSWORD=${DATABASE_PASSWORD:-"password"}
        export DBT_DATABASE=${DATABASE_NAME:-"analytics_db"}
        export DBT_HOST=${DATABASE_HOST:-"localhost"}
        export DBT_PORT=${DATABASE_PORT:-"5432"}
        
        if dbt debug --target dev &> /dev/null; then
            print_success "dbt connection successful"
            print_status "You can now run dbt with: pnpm analytics:run"
        else
            print_warning "dbt connection failed. You may need to configure profiles.yml manually"
        fi
        
        cd ../..
    fi
}

# Build application
build_app() {
    print_status "Building application..."
    pnpm build
    print_success "Application built successfully"
}

# Run tests
run_tests() {
    if [ "$1" = "--with-tests" ] || [ "$2" = "--with-tests" ]; then
        print_status "Running tests..."
        pnpm test
        print_success "Tests completed"
    fi
}

# Print next steps
print_next_steps() {
    echo ""
    print_success "Setup completed successfully! 🎉"
    echo ""
    echo "Next steps:"
    echo "  1. Start the development server:"
    echo "     pnpm dev"
    echo ""
    echo "  2. Or start with Docker:"
    echo "     docker-compose up -d"
    echo ""
    echo "  3. Access the API:"
    echo "     http://localhost:3000/api/v1/analytics"
    echo ""
    echo "  4. Check health status:"
    echo "     http://localhost:3000/health"
    echo ""
    echo "  5. View analytics documentation:"
    echo "     open README.md"
    echo ""
    echo "Optional commands:"
    echo "  - Refresh analytics: pnpm analytics:refresh refresh"
    echo "  - Run dbt: pnpm analytics:run"
    echo "  - Run tests: pnpm test"
    echo "  - View queue stats: curl http://localhost:3000/api/v1/analytics/queue/stats"
    echo ""
    
    if [ "$1" = "--with-dbt" ] || [ "$2" = "--with-dbt" ]; then
        echo "dbt commands:"
        echo "  - Run models: cd dbt && dbt run"
        echo "  - Test data: cd dbt && dbt test"
        echo "  - Generate docs: cd dbt && dbt docs generate"
        echo ""
    fi
}

# Main execution
main() {
    echo "Analytics Backend Setup Script"
    echo "============================="
    echo ""
    
    check_dependencies
    install_dependencies
    setup_env
    setup_database "$@"
    setup_redis
    setup_dbt "$@"
    build_app
    run_tests "$@"
    print_next_steps "$@"
}

# Parse command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --with-sample-data    Load sample data into the database"
    echo "  --with-dbt           Set up dbt for analytics transformations"
    echo "  --with-tests         Run tests after setup"
    echo "  --help, -h           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Basic setup"
    echo "  $0 --with-sample-data # Setup with sample data"
    echo "  $0 --with-dbt        # Setup with dbt support"
    echo "  $0 --with-sample-data --with-dbt --with-tests  # Full setup"
    exit 0
fi

# Run main function with all arguments
main "$@"