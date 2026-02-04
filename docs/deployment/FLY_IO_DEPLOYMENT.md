# Fly.io Deployment Guide

Deploy OpenAlert to Fly.io in under 10 minutes with free PostgreSQL and Redis included.

## What You Get (Free Tier)

- **3 shared VMs** (256MB RAM each)
- **PostgreSQL database** (3GB storage)
- **Redis cache** (included free)
- **160GB bandwidth/month**
- **Public HTTPS URL** (automatic SSL)
- **No credit card required** for signup

Perfect for testing and light production use!

---

## Step 1: Install Fly CLI

### Windows (PowerShell)

```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### Mac/Linux

```bash
curl -L https://fly.io/install.sh | sh
```

### Verify Installation

```bash
fly version
# Should show: flyctl vX.X.X
```

---

## Step 2: Sign Up and Login

### Create Account

```bash
fly auth signup
```

This will:
1. Open browser
2. Sign up with email or GitHub
3. Verify email
4. No credit card required for free tier!

### Or Login if You Have Account

```bash
fly auth login
```

---

## Step 3: Prepare Application for Deployment

### 3.1 Create Fly Configuration Files

We'll deploy backend and frontend as separate apps.

#### Create Backend Configuration

```bash
cd C:\Projects\openalert\apps\api
```

Create `fly.toml`:

```bash
# Windows
type nul > fly.toml

# Or use this command to create and edit
notepad fly.toml
```

Paste this content:

```toml
# fly.toml - OpenAlert Backend

app = "openalert-api"
primary_region = "iad" # Change to closest region: iad (US East), lhr (London), fra (Frankfurt), syd (Sydney)

[build]
  [build.args]
    NODE_VERSION = "20"

[env]
  NODE_ENV = "production"
  PORT = "3001"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    timeout = "5s"
    path = "/health"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

#### Create Dockerfile for Backend

Create `Dockerfile` in `apps/api`:

```dockerfile
# OpenAlert Backend Dockerfile for Fly.io

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install dependencies
RUN npm ci --workspace=apps/api

# Copy source
COPY apps/api ./apps/api
COPY tsconfig.json ./

# Build
WORKDIR /app/apps/api
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install production dependencies only
RUN npm ci --workspace=apps/api --omit=dev

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY apps/api/drizzle ./apps/api/drizzle

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/main.js"]
```

### 3.2 Create Frontend Configuration

```bash
cd C:\Projects\openalert\apps\web
```

Create `fly.toml`:

```toml
# fly.toml - OpenAlert Frontend

app = "openalert-web"
primary_region = "iad" # Must match backend region

[build]
  [build.args]
    NODE_VERSION = "20"

[env]
  NODE_ENV = "production"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

#### Create Dockerfile for Frontend

Create `Dockerfile` in `apps/web`:

```dockerfile
# OpenAlert Frontend Dockerfile for Fly.io

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm ci --workspace=apps/web

# Copy source
COPY apps/web ./apps/web
COPY tsconfig.json ./

# Build
WORKDIR /app/apps/web

# Build argument for API URL (will be set during deployment)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production image - serve with nginx
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Custom nginx config for SPA
RUN echo 'server { \
    listen 8080; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
```

---

## Step 4: Deploy Backend

### 4.1 Create and Deploy Backend App

```bash
cd C:\Projects\openalert\apps\api

# Create the app (but don't deploy yet)
fly apps create openalert-api
```

### 4.2 Create PostgreSQL Database

```bash
# Create PostgreSQL database (free tier: 3GB)
fly postgres create --name openalert-db --region iad --initial-cluster-size 1

# When prompted:
# - VM size: shared-cpu-1x (256MB) - FREE
# - Volume size: 10GB (you get 3GB free)
```

Save the connection details shown! You'll need the password.

### 4.3 Attach Database to Backend

```bash
fly postgres attach openalert-db --app openalert-api
```

This automatically sets `DATABASE_URL` environment variable.

### 4.4 Create Redis

```bash
# Create Redis instance (free tier included)
fly redis create --name openalert-redis --region iad

# When prompted, select:
# - Plan: Free (256MB)
# - Eviction: disabled
```

This will output a Redis URL like: `redis://default:password@fly-openalert-redis.upstash.io`

### 4.5 Set Environment Variables

```bash
# Set Redis URL (use the URL from previous step)
fly secrets set REDIS_URL="redis://..." --app openalert-api

# Set other secrets
fly secrets set \
  JWT_SECRET="$(openssl rand -base64 32)" \
  COOKIE_SECRET="$(openssl rand -base64 32)" \
  NODE_ENV="production" \
  --app openalert-api
```

### 4.6 Deploy Backend

```bash
# Deploy!
fly deploy --app openalert-api

# This will:
# - Build Docker image
# - Upload to Fly.io
# - Start the app
# - Run health checks
```

### 4.7 Run Database Migrations

```bash
# SSH into the app
fly ssh console --app openalert-api

# Inside the container:
cd /app/apps/api
npm run db:migrate
npm run db:seed
exit
```

Or run as one-off command:

```bash
fly ssh console --app openalert-api -C "cd /app/apps/api && npm run db:migrate && npm run db:seed"
```

### 4.8 Get Backend URL

```bash
fly status --app openalert-api

# Or open in browser
fly open --app openalert-api
```

Your backend URL will be: `https://openalert-api.fly.dev`

---

## Step 5: Deploy Frontend

### 5.1 Create and Deploy Frontend App

```bash
cd C:\Projects\openalert\apps\web

# Create the app
fly apps create openalert-web
```

### 5.2 Set Frontend Environment Variables

```bash
# Set API URL to point to backend
fly secrets set VITE_API_URL="https://openalert-api.fly.dev" --app openalert-web
```

### 5.3 Deploy Frontend

```bash
# Deploy with build arg
fly deploy --app openalert-web --build-arg VITE_API_URL=https://openalert-api.fly.dev
```

### 5.4 Get Frontend URL

```bash
fly status --app openalert-web

# Or open in browser
fly open --app openalert-web
```

Your frontend URL will be: `https://openalert-web.fly.dev`

---

## Step 6: Update CORS Settings

The backend needs to allow requests from the frontend:

```bash
# Update CORS origins
fly secrets set \
  ALLOWED_ORIGINS="https://openalert-web.fly.dev" \
  FRONTEND_URL="https://openalert-web.fly.dev" \
  API_URL="https://openalert-api.fly.dev" \
  --app openalert-api

# Restart backend to apply changes
fly apps restart openalert-api
```

---

## Step 7: Test Your Deployment

### 7.1 Open Frontend

```bash
fly open --app openalert-web
```

Or go to: `https://openalert-web.fly.dev`

### 7.2 Login

Default credentials:
- Email: `alice@example.com`
- Password: `password123`

Or:
- Email: `test@openalert.com`
- Password: `password123`

### 7.3 Test Health Endpoints

```bash
# Backend health
curl https://openalert-api.fly.dev/health

# Should return: {"status":"ok"}
```

---

## Step 8: Monitoring and Management

### View Logs

```bash
# Backend logs
fly logs --app openalert-api

# Frontend logs
fly logs --app openalert-web

# Follow logs in real-time
fly logs --app openalert-api -f
```

### View App Status

```bash
# Backend status
fly status --app openalert-api

# Frontend status
fly status --app openalert-web

# Database status
fly status --app openalert-db
```

### Scale Apps

```bash
# Scale backend memory (if needed - costs extra)
fly scale memory 512 --app openalert-api

# Scale to multiple machines (costs extra)
fly scale count 2 --app openalert-api
```

### SSH into Apps

```bash
# Backend
fly ssh console --app openalert-api

# Frontend
fly ssh console --app openalert-web

# Database
fly postgres connect --app openalert-db
```

---

## Useful Commands

### Restart Apps

```bash
fly apps restart openalert-api
fly apps restart openalert-web
```

### Update Environment Variables

```bash
fly secrets set KEY=value --app openalert-api
```

### List Secrets

```bash
fly secrets list --app openalert-api
```

### View Metrics

```bash
fly dashboard --app openalert-api
```

### Update Deployment

```bash
# After making code changes
cd C:\Projects\openalert\apps\api
git pull
fly deploy --app openalert-api

cd C:\Projects\openalert\apps\web
fly deploy --app openalert-web
```

---

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
fly logs --app openalert-api

# Check if database is connected
fly ssh console --app openalert-api
env | grep DATABASE_URL
```

### Database Connection Issues

```bash
# Check database status
fly status --app openalert-db

# Connect to database directly
fly postgres connect --app openalert-db
```

### Frontend Not Loading

```bash
# Check logs
fly logs --app openalert-web

# Verify API URL is set
fly secrets list --app openalert-web
```

### CORS Errors

Update backend CORS settings:

```bash
fly secrets set ALLOWED_ORIGINS="https://openalert-web.fly.dev" --app openalert-api
fly apps restart openalert-api
```

### Out of Memory

```bash
# Check current memory
fly status --app openalert-api

# Scale up (costs extra beyond free tier)
fly scale memory 512 --app openalert-api
```

---

## Cost Management

### Free Tier Limits

**Included Free:**
- 3 shared-cpu-1x VMs (256MB each)
- 3GB PostgreSQL storage
- 160GB bandwidth/month
- Automatic SSL certificates

**What Costs Extra:**
- Additional VMs beyond 3
- Memory > 256MB per VM
- Storage > 3GB for PostgreSQL
- Bandwidth > 160GB/month

### Monitor Usage

```bash
# View billing dashboard
fly dashboard

# Or visit: https://fly.io/dashboard/personal/billing
```

### Stay Within Free Tier

Current deployment uses:
- ✅ 1 VM for backend (256MB)
- ✅ 1 VM for frontend (256MB)
- ✅ 1 VM for PostgreSQL (256MB)
- **Total: 3 VMs = FREE** ✅

---

## Updating Your App

### Update Backend Code

```bash
cd C:\Projects\openalert
git pull origin main

cd apps/api
fly deploy --app openalert-api
```

### Update Frontend Code

```bash
cd C:\Projects\openalert
git pull origin main

cd apps/web
fly deploy --app openalert-web --build-arg VITE_API_URL=https://openalert-api.fly.dev
```

### Run New Migrations

```bash
fly ssh console --app openalert-api -C "cd /app/apps/api && npm run db:migrate"
```

---

## Custom Domain (Optional)

### Add Your Domain

```bash
# Add domain to frontend
fly certs add yourdomain.com --app openalert-web

# Add domain to backend (API subdomain)
fly certs add api.yourdomain.com --app openalert-api
```

### Update DNS Records

Add these records to your domain:

```
Type: A
Name: @
Value: [IP from fly certs show]

Type: AAAA
Name: @
Value: [IPv6 from fly certs show]

Type: A
Name: api
Value: [IP from fly certs show]

Type: AAAA
Name: api
Value: [IPv6 from fly certs show]
```

### Update Environment Variables

```bash
# Update frontend to use custom domain
fly secrets set VITE_API_URL="https://api.yourdomain.com" --app openalert-web

# Update backend CORS
fly secrets set \
  ALLOWED_ORIGINS="https://yourdomain.com" \
  FRONTEND_URL="https://yourdomain.com" \
  API_URL="https://api.yourdomain.com" \
  --app openalert-api

# Restart apps
fly apps restart openalert-web
fly apps restart openalert-api
```

---

## Backup and Restore

### Backup Database

```bash
# Create snapshot
fly postgres db snapshots create --app openalert-db

# List snapshots
fly postgres db snapshots list --app openalert-db
```

### Download Database Backup

```bash
# Connect and export
fly postgres connect --app openalert-db

# Inside PostgreSQL:
\! pg_dump > backup.sql
```

### Restore Database

```bash
fly postgres connect --app openalert-db

# Inside PostgreSQL:
\i backup.sql
```

---

## Complete Deployment Summary

After following this guide, you have:

✅ Backend deployed at `https://openalert-api.fly.dev`
✅ Frontend deployed at `https://openalert-web.fly.dev`
✅ PostgreSQL database (3GB free)
✅ Redis cache (256MB free)
✅ Automatic HTTPS/SSL
✅ Health checks and monitoring
✅ Auto-scaling (within free tier)
✅ **$0/month** (within free tier limits)

---

## Quick Reference

```bash
# Deploy backend
cd apps/api && fly deploy --app openalert-api

# Deploy frontend
cd apps/web && fly deploy --app openalert-web

# View logs
fly logs --app openalert-api -f

# Restart
fly apps restart openalert-api

# SSH
fly ssh console --app openalert-api

# Status
fly status --app openalert-api

# Open in browser
fly open --app openalert-web
```

---

## Support

- **Fly.io Docs**: https://fly.io/docs
- **Community Forum**: https://community.fly.io
- **Status**: https://status.fly.io

---

## Next Steps

1. ✅ Set up monitoring
2. ✅ Configure email notifications (SendGrid)
3. ✅ Add custom domain
4. ✅ Set up automated backups
5. ✅ Configure Azure AD SSO

Enjoy your OpenAlert deployment! 🚀
