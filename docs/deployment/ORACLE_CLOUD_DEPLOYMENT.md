# Oracle Cloud Always Free Deployment Guide

Deploy OpenAlert to Oracle Cloud's Always Free tier for permanent, free hosting.

## What You Get (FREE Forever)

- **4 ARM CPU cores** (Ampere A1)
- **24 GB RAM**
- **200 GB storage**
- **10 TB bandwidth/month**
- **Public IPv4 address**

This is more than enough to run OpenAlert with PostgreSQL and Redis.

## Prerequisites

- Oracle Cloud account (free)
- SSH client (built into Windows 10+, Mac, Linux)
- Domain name (optional, for HTTPS)

---

## Step 1: Create Oracle Cloud Account

1. Go to https://www.oracle.com/cloud/free/
2. Click "Start for free"
3. Fill in details (requires credit card for verification, but won't be charged)
4. Verify email and phone
5. Wait for account activation (usually instant, sometimes 24 hours)

---

## Step 2: Create Always Free VM Instance

### 2.1 Launch Instance

1. Log into Oracle Cloud Console
2. Click **"Create a VM Instance"** or navigate to:
   - Menu → Compute → Instances → Create Instance

### 2.2 Configure Instance

**Name**: `openalert-server` (or any name you want)

**Placement**:
- Leave default (your home region)

**Image and Shape**:
1. Click **"Edit"** next to "Image and shape"
2. Click **"Change Image"**
   - Select: **Ubuntu 22.04** (recommended) or Ubuntu 24.04
   - Click "Select Image"
3. Click **"Change Shape"**
   - Click **"Ampere"** (ARM-based processor)
   - Select: **VM.Standard.A1.Flex**
   - Set OCPUs: **4** (maximum for free tier)
   - Set Memory: **24 GB** (maximum for free tier)
   - Click "Select Shape"

**Networking**:
- Leave default VCN (Virtual Cloud Network)
- **Assign a public IPv4 address**: YES (should be checked)

**Add SSH Keys**:
Choose one option:

**Option A - Generate new keys** (Easiest):
- Select "Generate a key pair for me"
- Click "Save Private Key" - IMPORTANT: Save this file! You can't download it again
- Click "Save Public Key" (optional)

**Option B - Use existing SSH key**:
- Select "Upload public key files (.pub)"
- Upload your existing `id_rsa.pub` or `id_ed25519.pub`

**Boot Volume**:
- Leave default (50 GB is fine, or increase to 200 GB for free tier max)

### 2.3 Create Instance

1. Click **"Create"**
2. Wait 2-3 minutes for provisioning
3. Note the **Public IP Address** (you'll need this)

Example: `132.145.xxx.xxx`

---

## Step 3: Configure Firewall Rules

Oracle Cloud has two firewalls you need to configure:

### 3.1 Security List Rules (Cloud Firewall)

1. Go to **Networking → Virtual Cloud Networks**
2. Click your VCN (usually "vcn-xxxxx")
3. Click **"Security Lists"** in left sidebar
4. Click the default security list
5. Click **"Add Ingress Rules"**

Add these rules one by one:

**Rule 1 - HTTP**
- Source CIDR: `0.0.0.0/0`
- IP Protocol: `TCP`
- Destination Port Range: `80`
- Description: `HTTP`

**Rule 2 - HTTPS**
- Source CIDR: `0.0.0.0/0`
- IP Protocol: `TCP`
- Destination Port Range: `443`
- Description: `HTTPS`

**Rule 3 - Custom Port (if needed for testing)**
- Source CIDR: `0.0.0.0/0`
- IP Protocol: `TCP`
- Destination Port Range: `3001,5173`
- Description: `Dev servers`

Click "Add Ingress Rules" after each one.

### 3.2 OS Firewall (iptables/firewalld)

We'll configure this after connecting to the server.

---

## Step 4: Connect to Your Server

### Windows (PowerShell/CMD)

```powershell
# Navigate to where you saved the private key
cd Downloads

# Set permissions (if using WSL/Git Bash)
chmod 400 ssh-key-*.key

# Connect
ssh -i ssh-key-*.key ubuntu@YOUR_PUBLIC_IP
```

### Mac/Linux

```bash
# Move key to .ssh folder
mv ~/Downloads/ssh-key-*.key ~/.ssh/oracle_key
chmod 400 ~/.ssh/oracle_key

# Connect
ssh -i ~/.ssh/oracle_key ubuntu@YOUR_PUBLIC_IP
```

**First connection**: Type `yes` when asked about fingerprint.

---

## Step 5: Initial Server Setup

Once connected via SSH, run these commands:

### 5.1 Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 5.2 Configure OS Firewall

```bash
# Allow HTTP
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT

# Allow HTTPS
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Allow custom ports (for testing without reverse proxy)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5173 -j ACCEPT

# Save rules
sudo netfilter-persistent save

# If command not found, install first:
sudo apt install iptables-persistent -y
sudo netfilter-persistent save
```

### 5.3 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker ubuntu

# Start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Re-login for group changes (exit and ssh back in)
exit
```

**Re-connect via SSH** (same command as before)

### 5.4 Verify Docker

```bash
docker --version
# Should show: Docker version 24.x.x or higher
```

### 5.5 Install Docker Compose

```bash
# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify
docker compose version
# Should show: Docker Compose version v2.x.x
```

---

## Step 6: Deploy OpenAlert

### 6.1 Clone Repository

```bash
# Install git if needed
sudo apt install git -y

# Clone OpenAlert
cd ~
git clone https://github.com/cyclopsgd/openalert.git
cd openalert
```

### 6.2 Configure Environment

```bash
# Copy example env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Edit API environment
nano apps/api/.env
```

**Update these values in `apps/api/.env`**:

```env
NODE_ENV=production
PORT=3001
API_URL=http://YOUR_PUBLIC_IP:3001
FRONTEND_URL=http://YOUR_PUBLIC_IP

# CORS - Add your public IP
ALLOWED_ORIGINS=http://YOUR_PUBLIC_IP,http://YOUR_PUBLIC_IP:5173

# Database
DATABASE_URL=postgresql://openalert:openalert_dev@localhost:5432/openalert

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT - CHANGE THESE IN PRODUCTION!
JWT_SECRET=your-super-secret-jwt-key-change-this
COOKIE_SECRET=your-super-secret-cookie-key-change-this

# Email (optional - add SendGrid later)
# SENDGRID_API_KEY=
# SENDGRID_FROM_EMAIL=
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

**Update frontend environment**:

```bash
nano apps/web/.env.local
```

```env
VITE_API_URL=http://YOUR_PUBLIC_IP:3001
```

Save with `Ctrl+X`, `Y`, `Enter`.

### 6.3 Start Database and Redis

```bash
# Start PostgreSQL and Redis
cd docker
docker compose up -d

# Verify they're running
docker compose ps
```

### 6.4 Install Dependencies and Build

```bash
cd ~/openalert

# Install dependencies
npm install

# Build backend
cd apps/api
npm run build

# Build frontend
cd ../web
npm run build
```

### 6.5 Run Database Migrations

```bash
cd ~/openalert/apps/api

# Generate migration (if needed)
npm run db:generate

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

### 6.6 Start Application with PM2

PM2 keeps your application running and restarts it if it crashes.

```bash
# Install PM2
sudo npm install -g pm2

# Start backend
cd ~/openalert/apps/api
pm2 start npm --name "openalert-api" -- run start:prod

# Start frontend (serve built files)
cd ~/openalert/apps/web
pm2 serve dist 5173 --name "openalert-web" --spa

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Copy and run the command it shows
```

### 6.7 Verify Application

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs openalert-api
pm2 logs openalert-web

# Check if ports are listening
sudo netstat -tlnp | grep -E '3001|5173'
```

---

## Step 7: Access Your Application

Open in browser:
```
http://YOUR_PUBLIC_IP:5173
```

**Default login**:
- Email: `alice@example.com`
- Password: `password123`

Or:
- Email: `test@openalert.com`
- Password: `password123`

---

## Step 8: Setup Nginx Reverse Proxy (Optional but Recommended)

This allows you to access via port 80 instead of 5173/3001.

### 8.1 Install Nginx

```bash
sudo apt install nginx -y
```

### 8.2 Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/openalert
```

Paste this configuration:

```nginx
# OpenAlert Nginx Configuration

# Redirect HTTP to HTTPS (after SSL setup)
# server {
#     listen 80;
#     server_name YOUR_DOMAIN_OR_IP;
#     return 301 https://$server_name$request_uri;
# }

server {
    listen 80;
    server_name YOUR_PUBLIC_IP;

    # For SSL (after certbot setup), use these instead:
    # listen 443 ssl http2;
    # ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;

    # Frontend (React app)
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Replace `YOUR_PUBLIC_IP` with your actual IP.

### 8.3 Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/openalert /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

Now access via: `http://YOUR_PUBLIC_IP` (port 80, no need for :5173)

---

## Step 9: Setup SSL with Let's Encrypt (Optional - Requires Domain)

If you have a domain name pointing to your Oracle Cloud IP:

### 9.1 Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 9.2 Get SSL Certificate

```bash
# Replace with your domain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts:
- Enter email
- Agree to terms
- Choose whether to redirect HTTP to HTTPS (choose 2 for redirect)

### 9.3 Auto-renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically sets up a cron job for renewal
```

Now access via: `https://yourdomain.com`

---

## Step 10: Useful Management Commands

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs openalert-api
pm2 logs openalert-web

# Restart apps
pm2 restart openalert-api
pm2 restart openalert-web

# Stop apps
pm2 stop openalert-api
pm2 stop all

# Delete apps
pm2 delete openalert-api
```

### Docker Commands

```bash
# View running containers
docker ps

# View logs
docker compose -f ~/openalert/docker/docker-compose.yml logs postgres
docker compose -f ~/openalert/docker/docker-compose.yml logs redis

# Restart database
docker compose -f ~/openalert/docker/docker-compose.yml restart postgres

# Stop all containers
docker compose -f ~/openalert/docker/docker-compose.yml down

# Start all containers
docker compose -f ~/openalert/docker/docker-compose.yml up -d
```

### Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Restart
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### System Monitoring

```bash
# Check CPU and memory
htop

# Check disk space
df -h

# Check running processes
ps aux | grep node

# Check open ports
sudo netstat -tlnp
```

---

## Troubleshooting

### Can't Access Application

1. **Check firewalls**:
   ```bash
   sudo iptables -L -n | grep -E '80|443|3001|5173'
   ```

2. **Check if services are running**:
   ```bash
   pm2 status
   docker ps
   sudo systemctl status nginx
   ```

3. **Check logs**:
   ```bash
   pm2 logs
   sudo tail -f /var/log/nginx/error.log
   ```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check database connectivity
docker exec -it openalert-postgres psql -U openalert -d openalert

# View database logs
docker logs openalert-postgres
```

### Out of Memory

```bash
# Check memory usage
free -h

# Restart services
pm2 restart all
docker compose -f ~/openalert/docker/docker-compose.yml restart
```

### Port Already in Use

```bash
# Find what's using a port
sudo lsof -i :3001

# Kill a process
sudo kill -9 PID
```

---

## Updating OpenAlert

When you want to update to the latest version:

```bash
cd ~/openalert

# Stop applications
pm2 stop all

# Pull latest code
git pull origin main

# Install new dependencies
npm install

# Rebuild
cd apps/api && npm run build
cd ../web && npm run build

# Run migrations
cd ~/openalert/apps/api
npm run db:migrate

# Restart
pm2 restart all
```

---

## Security Best Practices

### 1. Change Default Passwords

```bash
# Change database password in docker-compose.yml
nano ~/openalert/docker/docker-compose.yml

# Update DATABASE_URL in .env
nano ~/openalert/apps/api/.env
```

### 2. Use Strong JWT Secrets

```bash
# Generate random secrets
openssl rand -base64 32

# Update in apps/api/.env
JWT_SECRET=<generated-secret>
COOKIE_SECRET=<generated-secret>
```

### 3. Setup Fail2Ban (Prevents Brute Force)

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Regular Updates

```bash
# Update system packages weekly
sudo apt update && sudo apt upgrade -y

# Update Docker images
cd ~/openalert/docker
docker compose pull
docker compose up -d
```

### 5. Setup Backups

```bash
# Create backup script
nano ~/backup-openalert.sh
```

```bash
#!/bin/bash
# OpenAlert Backup Script

BACKUP_DIR=~/backups
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker exec openalert-postgres pg_dump -U openalert openalert > $BACKUP_DIR/db_$DATE.sql

# Backup environment files
cp ~/openalert/apps/api/.env $BACKUP_DIR/api_env_$DATE
cp ~/openalert/apps/web/.env.local $BACKUP_DIR/web_env_$DATE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x ~/backup-openalert.sh

# Add to cron (daily at 2 AM)
crontab -e
# Add this line:
0 2 * * * /home/ubuntu/backup-openalert.sh >> /home/ubuntu/backup.log 2>&1
```

---

## Cost Breakdown

**Oracle Cloud Always Free Tier**:
- VM Instance: **$0** (4 cores, 24GB RAM)
- Storage: **$0** (200 GB)
- Bandwidth: **$0** (10 TB/month)
- Public IP: **$0**

**Optional Costs**:
- Domain name: ~$10-15/year (from Namecheap, Cloudflare, etc.)
- Email service (SendGrid): Free tier includes 100 emails/day

**Total Monthly Cost**: **$0** 🎉

---

## Next Steps

1. ✅ Set up monitoring (PM2 dashboard, Grafana)
2. ✅ Configure email notifications (SendGrid)
3. ✅ Set up Azure AD SSO
4. ✅ Add custom domain
5. ✅ Enable HTTPS with Let's Encrypt
6. ✅ Configure automated backups
7. ✅ Set up log aggregation

---

## Support

If you run into issues:
1. Check the troubleshooting section above
2. View application logs: `pm2 logs`
3. Check system logs: `journalctl -xe`
4. Review Oracle Cloud documentation: https://docs.oracle.com/en-us/iaas/

---

## Summary

You now have OpenAlert running on Oracle Cloud's Always Free tier with:
- ✅ 4 CPU cores and 24 GB RAM
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ PM2 process management
- ✅ Nginx reverse proxy (optional)
- ✅ SSL certificate (optional)
- ✅ Automatic restarts
- ✅ **$0/month cost** 🎉

Access your application at:
- Without Nginx: `http://YOUR_PUBLIC_IP:5173`
- With Nginx: `http://YOUR_PUBLIC_IP`
- With SSL: `https://yourdomain.com`

Enjoy your free OpenAlert instance!
