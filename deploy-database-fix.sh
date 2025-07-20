#!/bin/bash

# Deploy database SSL fix to DigitalOcean
echo "🔧 Deploying database SSL fix..."

# Check if server IP is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <server-ip>"
    echo "Example: $0 161.35.139.108"
    exit 1
fi

SERVER_IP="$1"
APP_DIR="/opt/golf-frontend/golf-directory"

echo "📤 Copying fixed database.ts to server..."
scp -o StrictHostKeyChecking=no src/lib/database.ts root@${SERVER_IP}:${APP_DIR}/src/lib/

echo "🚀 Rebuilding and restarting application..."
ssh -o StrictHostKeyChecking=no root@${SERVER_IP} << EOF
cd ${APP_DIR}

# Stop current process
pkill -f "next start" || true
sleep 2

# Rebuild application
echo "🔨 Building application..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
    
    # Start application in background
    nohup npm start > /tmp/nextjs.log 2>&1 &
    
    # Wait and check if started
    sleep 8
    if pgrep -f "next start" > /dev/null; then
        echo "🎉 Application restarted successfully!"
        
        # Test database connection
        echo "🔍 Testing database connection..."
        curl -s http://localhost:3000/api/stats | head -5
        
        if [ $? -eq 0 ]; then
            echo "✅ Database connection test passed!"
        else
            echo "❌ Database connection test failed"
        fi
    else
        echo "❌ Failed to start application"
        echo "📋 Recent logs:"
        tail -20 /tmp/nextjs.log
    fi
else
    echo "❌ Build failed"
    npm run build
fi
EOF

echo "🏁 Deployment complete!"