# Golf Directory - DigitalOcean Deployment Guide

This guide walks you through deploying the Golf Directory application on DigitalOcean.

## Prerequisites

- DigitalOcean account
- YouTube Data API key
- (Optional) ElevenLabs API key for AI audio generation
- Domain name (optional, can use IP address)

## Quick Start

### 1. Create a Droplet

1. Log into DigitalOcean
2. Create a new Droplet:
   - **Image**: Ubuntu 22.04 LTS
   - **Size**: Basic plan, 2GB RAM minimum (4GB recommended)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH keys (recommended) or password

### 2. Initial Server Setup

SSH into your droplet as root and run the setup script:

```bash
# Download and run the setup script
wget https://raw.githubusercontent.com/your-repo/golf-directory/main/setup-droplet.sh
chmod +x setup-droplet.sh
./setup-droplet.sh
```

This script will:
- Install Node.js 20, PostgreSQL, nginx, PM2
- Create application user and directories
- Configure firewall and nginx
- Set up PostgreSQL database

### 3. Deploy the Application

Switch to the golf user and deploy:

```bash
# Switch to golf user
su - golf

# Navigate to app directory
cd /home/golf-directory

# Clone your repository
git clone https://github.com/your-repo/golf-directory.git .

# Copy and edit environment file
cp .env.production.example .env.production
nano .env.production
```

Update `.env.production` with your values:
- `DATABASE_URL`: Update password (default: changeme)
- `YOUTUBE_API_KEY`: Your YouTube API key
- `ELEVENLABS_API_KEY`: Your ElevenLabs key (optional)
- `NEXTAUTH_URL`: Your domain or http://your-ip:3000

### 4. Update Database Password

```bash
# Update PostgreSQL password
sudo -u postgres psql -c "ALTER USER golf PASSWORD 'your-secure-password';"
```

### 5. Run Deployment

```bash
# Install dependencies and build
npm ci
npm run build

# Set up database
npm run db:setup

# Start with PM2
pm2 start npm --name "golf-directory" -- start
pm2 save
pm2 startup
```

## Manual Deployment Steps

If you prefer manual setup over scripts:

### Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install other dependencies
sudo apt install -y git postgresql nginx python3-pip ffmpeg
sudo npm install -g pm2
pip3 install yt-dlp
```

### Database Setup

```bash
# Create database and user
sudo -u postgres psql
CREATE USER golf WITH PASSWORD 'your-password';
CREATE DATABASE golf_directory OWNER golf;
\q

# Run migrations
npm run db:setup
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL Certificate (Optional)

```bash
sudo certbot --nginx -d your-domain.com
```

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://golf:password@localhost:5432/golf_directory
YOUTUBE_API_KEY=your_youtube_api_key

# Optional
ELEVENLABS_API_KEY=your_elevenlabs_key
CRON_SECRET=random_string_for_security
```

## Monitoring

```bash
# View logs
pm2 logs golf-directory

# Monitor resources
pm2 monit

# Check status
pm2 status
```

## Updating

To update the application:

```bash
cd /home/golf-directory
./deploy.sh
```

## Troubleshooting

### Database Connection Issues
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify credentials in `.env.production`
- Check database exists: `sudo -u postgres psql -l`

### Application Not Starting
- Check logs: `pm2 logs golf-directory`
- Verify Node.js version: `node -v` (should be 20+)
- Check environment file: `cat .env.production`

### AI Features Not Working
- Verify API keys are set correctly
- Check quota limits on YouTube/ElevenLabs
- Look for errors in logs: `pm2 logs golf-directory | grep -i error`

### Port Already in Use
- Check what's using port 3000: `sudo lsof -i :3000`
- Kill process if needed: `sudo kill -9 <PID>`

## Docker Deployment (Alternative)

If you prefer Docker:

```bash
# Build image
docker build -t golf-directory .

# Run container
docker run -d \
  --name golf-directory \
  -p 3000:3000 \
  --env-file .env.production \
  golf-directory
```

## Support

For issues or questions:
- Check application logs: `pm2 logs`
- Review nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Database logs: `sudo tail -f /var/log/postgresql/postgresql-*.log`