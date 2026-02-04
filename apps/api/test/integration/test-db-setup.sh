#!/bin/bash
# Test Database Setup Script
# Creates a separate test database for integration tests

set -e

echo "Setting up test database..."

# Database credentials
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-openalert}"
DB_PASSWORD="${DB_PASSWORD:-openalert_dev}"
DB_NAME="openalert_test"

# Check if PostgreSQL is running
if ! nc -z $DB_HOST $DB_PORT 2>/dev/null; then
    echo "Error: PostgreSQL is not running on $DB_HOST:$DB_PORT"
    echo "Start it with: docker-compose -f docker/docker-compose.yml up -d postgres"
    exit 1
fi

echo "PostgreSQL is running"

# Drop and recreate test database
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "Test database '$DB_NAME' created successfully"

# Run migrations
echo "Running database migrations..."
cd "$(dirname "$0")/../../"
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" npm run db:push

echo "Test database setup complete!"
echo "You can now run tests with: npm run test:integration"
