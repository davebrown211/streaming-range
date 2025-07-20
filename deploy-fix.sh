#!/bin/bash

# Deploy the API fixes to the DigitalOcean server
echo "Copying fixed API files to server..."

# Copy the fixed API routes and database config
scp -o StrictHostKeyChecking=no src/app/api/video-of-the-day/route.ts root@161.35.139.108:/opt/golf-frontend/golf-directory/src/app/api/video-of-the-day/
scp -o StrictHostKeyChecking=no src/app/api/videos-with-audio/route.ts root@161.35.139.108:/opt/golf-frontend/golf-directory/src/app/api/videos-with-audio/
scp -o StrictHostKeyChecking=no src/lib/database.ts root@161.35.139.108:/opt/golf-frontend/golf-directory/src/lib/

echo "Rebuilding and restarting the application..."
ssh -o StrictHostKeyChecking=no root@161.35.139.108 << 'EOF'
cd /opt/golf-frontend/golf-directory

# Stop the current process
pkill -f "next start" || true
sleep 2

# Rebuild the application
npm run build

# Start the application in the background
nohup npm start > /tmp/nextjs.log 2>&1 &

# Wait a moment and check if it's running
sleep 5
if pgrep -f "next start" > /dev/null; then
    echo "✅ Application restarted successfully"
    curl -s http://localhost:3000/api/video-of-the-day | head -5
else
    echo "❌ Failed to start application"
    tail -20 /tmp/nextjs.log
fi
EOF

echo "Deployment complete!"