#!/bin/bash

# Golf Directory Deployment Script for DigitalOcean
# This script handles the deployment process with PM2

set -euo pipefail  # Exit on error, undefined vars, pipe failures

echo "🚀 Starting Golf Directory Deployment..."

# Configuration
APP_NAME="golf-directory"
# Auto-detect app directory
if [ -d "/opt/golf-frontend/golf-directory" ]; then
    APP_DIR="/opt/golf-frontend/golf-directory"
elif [ -d "/home/golf-directory" ]; then
    APP_DIR="/home/golf-directory"
else
    APP_DIR="${PWD}"
fi

NODE_VERSION="20"
BACKUP_DIR="/tmp/golf-directory-backup-$(date +%Y%m%d-%H%M%S)"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Function to handle deployment failure
handle_failure() {
    print_error "Deployment failed! Rolling back..."
    if [ -d "$BACKUP_DIR" ]; then
        print_info "Restoring from backup: $BACKUP_DIR"
        pm2 stop $APP_NAME 2>/dev/null || true
        cp -r "$BACKUP_DIR"/* "$APP_DIR/" || true
        pm2 start $APP_NAME 2>/dev/null || print_warning "Failed to restore previous version"
    fi
    exit 1
}

# Set up error handling
trap handle_failure ERR

print_info "Using app directory: $APP_DIR"

# Check if running as root (warn but don't exit)
if [[ $EUID -eq 0 ]]; then
   print_warning "Running as root - this is not recommended for production!"
fi

# Navigate to app directory
cd "$APP_DIR" || { print_error "App directory not found: $APP_DIR"; exit 1; }

# Create backup
print_info "Creating backup..."
mkdir -p "$BACKUP_DIR"
cp -r .next "$BACKUP_DIR/" 2>/dev/null || print_warning "No .next directory to backup"
cp package.json "$BACKUP_DIR/" 2>/dev/null || true

# Check Node.js version
NODE_CURRENT=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_CURRENT" -lt "$NODE_VERSION" ]; then
    print_warning "Node.js version $NODE_CURRENT detected. Recommended: $NODE_VERSION+"
fi

# Check if git repo exists
if [ -d ".git" ]; then
    # Pull latest code
    echo "📥 Pulling latest code..."
    git fetch origin
    LOCAL_COMMIT=$(git rev-parse HEAD)
    REMOTE_COMMIT=$(git rev-parse origin/main)
    
    if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
        git pull origin main || { print_error "Failed to pull latest code"; exit 1; }
        print_success "Code updated"
    else
        print_info "Code already up to date"
    fi
else
    print_warning "Not a git repository - skipping code pull"
fi

# Check for environment file
if [ ! -f .env.production ]; then
    if [ -f .env.production.example ]; then
        print_warning "Creating .env.production from example..."
        cp .env.production.example .env.production
        print_error "Please update .env.production with your actual values and run deploy again"
    else
        print_error ".env.production file not found"
    fi
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production=false || { print_error "Failed to install dependencies"; exit 1; }

# Run linting and type checking
echo "🔍 Running checks..."
npm run lint || print_warning "Linting issues found"

# Build the application
echo "🔨 Building application..."
NODE_ENV=production npm run build || { print_error "Build failed"; exit 1; }

# Run database migrations if script exists
if [ -f "scripts/setup-database.sh" ]; then
    echo "🗄️  Running database migrations..."
    npm run db:migrate || print_warning "Database migration failed - continuing anyway"
fi

# Stop the existing PM2 process
echo "🛑 Stopping existing process..."
pm2 stop $APP_NAME 2>/dev/null || echo "No existing process to stop"
pm2 delete $APP_NAME 2>/dev/null || echo "No existing process to delete"

# Start the application with PM2
echo "🚀 Starting application with PM2..."
pm2 start npm --name "$APP_NAME" -- start || { print_error "Failed to start application"; exit 1; }

# Wait for application to start
sleep 5

# Health check
print_info "Performing health check..."
if curl -f http://localhost:3000/api/stats >/dev/null 2>&1; then
    print_success "Health check passed"
else
    print_warning "Health check failed - application may still be starting"
fi

# Save PM2 configuration
pm2 save || print_warning "Failed to save PM2 configuration"

# Set PM2 to start on boot
pm2 startup systemd -u "$USER" --hp "/home/$USER" 2>/dev/null || print_info "PM2 startup already configured"

# Clean up old backup
if [ -d "$BACKUP_DIR" ]; then
    rm -rf "$BACKUP_DIR"
fi

print_success "Deployment completed successfully!"

# Show application status
echo ""
echo "📊 Application Status:"
pm2 status $APP_NAME

# Show memory usage
echo ""
echo "💾 System Resources:"
free -h | head -2
df -h / | tail -1

# Show logs
echo ""
echo "📜 Recent logs:"
pm2 logs $APP_NAME --lines 10 --nostream

echo ""
print_success "Golf Directory is now running!"
print_info "Local: http://localhost:3000"
print_info "Use 'pm2 logs $APP_NAME' to view logs"
print_info "Use 'pm2 monit' for real-time monitoring"
print_info "Use 'pm2 restart $APP_NAME' to restart"