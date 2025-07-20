#!/bin/bash

# Database Setup Script for Golf Directory
# This script creates all necessary tables and runs migrations

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
elif [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
else
    print_error "No environment file found. Please create .env.production or .env.local"
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL not set in environment"
fi

echo "🗄️  Golf Directory Database Setup"
echo "================================="
print_info "Database URL: ${DATABASE_URL%%@*}@****"

# Function to run SQL file
run_sql_file() {
    local file=$1
    local description=$2
    
    print_info "$description"
    psql "$DATABASE_URL" -f "$file" || print_error "Failed to run $file"
    print_success "$description completed"
}

# Create base schema
print_info "Creating base schema..."
run_sql_file "src/lib/schema.sql" "Base schema creation"

# Run migrations in order
print_info "Running migrations..."
run_sql_file "src/lib/migrations/004_add_quota_tracking.sql" "Migration 004: Quota tracking"
run_sql_file "src/lib/migrations/005_add_audio_url_to_video_analyses.sql" "Migration 005: Audio URL"
run_sql_file "src/lib/migrations/006_add_content_type.sql" "Migration 006: Content type"

# Run optimizations
print_info "Running database optimizations..."
run_sql_file "src/scripts/optimize-database.sql" "Database optimizations"

# Verify tables
print_info "Verifying database setup..."
psql "$DATABASE_URL" -c "\dt" || print_error "Failed to verify tables"

print_success "Database setup completed successfully!"

# Show table counts
echo ""
echo "📊 Database Status:"
psql "$DATABASE_URL" -c "
SELECT 
    'youtube_videos' as table_name, COUNT(*) as count FROM youtube_videos
UNION ALL
SELECT 
    'youtube_channels', COUNT(*) FROM youtube_channels
UNION ALL
SELECT 
    'video_analyses', COUNT(*) FROM video_analyses
UNION ALL
SELECT 
    'monitored_channels', COUNT(*) FROM monitored_channels
UNION ALL
SELECT 
    'api_quota_usage', COUNT(*) FROM api_quota_usage;
"