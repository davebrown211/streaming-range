#!/bin/bash

# DigitalOcean Droplet Setup Script for Golf Directory
# Run this script on a fresh Ubuntu 22.04 droplet as root

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

echo "🏌️ Golf Directory - DigitalOcean Droplet Setup"
echo "=============================================="

# Update system
print_info "Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
print_info "Installing essential packages..."
apt install -y curl git build-essential python3 python3-pip ffmpeg nginx certbot python3-certbot-nginx ufw

# Install Node.js 20
print_info "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
print_success "Node.js $(node -v) installed"

# Install PM2 globally
print_info "Installing PM2..."
npm install -g pm2
print_success "PM2 installed"

# Install yt-dlp
print_info "Installing yt-dlp for transcript downloads..."
pip3 install yt-dlp
print_success "yt-dlp installed"

# Install PostgreSQL
print_info "Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
print_success "PostgreSQL installed and started"

# Create application user
print_info "Creating application user..."
useradd -m -s /bin/bash golf || echo "User already exists"
usermod -aG sudo golf

# Create application directory
print_info "Creating application directory..."
mkdir -p /home/golf-directory
chown golf:golf /home/golf-directory

# Setup PostgreSQL
print_info "Setting up PostgreSQL database..."
sudo -u postgres psql <<EOF
CREATE USER golf WITH PASSWORD 'changeme';
CREATE DATABASE golf_directory OWNER golf;
GRANT ALL PRIVILEGES ON DATABASE golf_directory TO golf;
\q
EOF
print_success "PostgreSQL database created"

# Configure firewall
print_info "Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Next.js (temporary, remove after nginx setup)
ufw --force enable
print_success "Firewall configured"

# Create nginx configuration
print_info "Creating nginx configuration..."
cat > /etc/nginx/sites-available/golf-directory <<'EOF'
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable nginx site
ln -sf /etc/nginx/sites-available/golf-directory /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
print_success "Nginx configured"

# Create deployment script for the golf user
print_info "Setting up deployment scripts..."
cat > /home/golf-directory/initial-setup.sh <<'EOF'
#!/bin/bash

# Clone the repository
echo "📥 Cloning repository..."
git clone https://github.com/your-username/golf-directory.git . || exit 1

# Copy environment file
echo "📋 Setting up environment..."
cp .env.production.example .env.production

echo ""
echo "⚠️  IMPORTANT: Edit .env.production with your actual values:"
echo "   - Database password (update the PostgreSQL password too)"
echo "   - YouTube API key"
echo "   - ElevenLabs API key (optional)"
echo "   - Domain/IP address"
echo ""
echo "Then run: ./deploy.sh"
EOF

chmod +x /home/golf-directory/initial-setup.sh
chown -R golf:golf /home/golf-directory

# Create systemd service for PM2
print_info "Setting up PM2 systemd service..."
sudo -u golf bash -c "cd /home/golf-directory && pm2 startup systemd -u golf --hp /home/golf"

# Final instructions
echo ""
echo "=============================================="
print_success "Droplet setup completed!"
echo ""
echo "Next steps:"
echo "1. Switch to the golf user: ${GREEN}su - golf${NC}"
echo "2. Navigate to app directory: ${GREEN}cd /home/golf-directory${NC}"
echo "3. Run initial setup: ${GREEN}./initial-setup.sh${NC}"
echo "4. Edit .env.production with your configuration"
echo "5. Update PostgreSQL password: ${GREEN}sudo -u postgres psql -c \"ALTER USER golf PASSWORD 'your-secure-password';\"${NC}"
echo "6. Run deployment: ${GREEN}./deploy.sh${NC}"
echo ""
echo "Optional:"
echo "- Point your domain to this droplet's IP"
echo "- Run: ${GREEN}sudo certbot --nginx -d your-domain.com${NC} for SSL"
echo ""
print_info "Default PostgreSQL credentials:"
echo "  Database: golf_directory"
echo "  User: golf"
echo "  Password: changeme (CHANGE THIS!)"
echo ""