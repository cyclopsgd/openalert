# OpenAlert Deployment Guide

Complete guide to deploying OpenAlert in production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Reverse Proxy Configuration](#reverse-proxy-configuration)
- [Monitoring Setup](#monitoring-setup)
- [Backup and Recovery](#backup-and-recovery)
- [Upgrading](#upgrading)

## Prerequisites

### System Requirements

**Minimum (Development/Testing):**
- 2 CPU cores
- 4 GB RAM
- 20 GB disk space
- Ubuntu 20.04+ or similar Linux distribution

**Recommended (Production):**
- 4+ CPU cores
- 8+ GB RAM
- 100+ GB SSD storage
- Ubuntu 22.04 LTS or RHEL 8+

### Required Software

- **Node.js**: 20.x or higher
- **PostgreSQL**: 15.x or higher
- **Redis**: 7.x or higher
- **Docker**: 24.x or higher (for containerized deployment)
- **Docker Compose**: 2.x or higher (for development)

### Optional

- **Kubernetes**: 1.28+ (for production orchestration)
- **Nginx**: 1.24+ (reverse proxy)
- **Prometheus**: 2.45+ (metrics)
- **Grafana**: 10.x+ (dashboards)

### Domain and SSL

- Registered domain name (e.g., `openalert.example.com`)
- Valid SSL/TLS certificate (Let's Encrypt recommended)

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/openalert.git
cd openalert
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your production values:

```bash
# Application
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=https://openalert.example.com

# Database
DATABASE_URL=postgresql://openalert:STRONG_PASSWORD@postgres:5432/openalert

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Azure Entra ID (OAuth 2.0) - Optional for SSO
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here
AZURE_CLIENT_SECRET=your-client-secret-here

# JWT Authentication (REQUIRED - Generate a strong random secret)
JWT_SECRET=your-secure-random-secret-at-least-32-characters-long

# Application URLs
API_URL=https://openalert.example.com
FRONTEND_URL=https://openalert.example.com

# Notification Providers (Optional)
# Twilio (SMS & Voice)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+15551234567

# SendGrid (Email)
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=alerts@example.com

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Microsoft Teams
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/YOUR-WEBHOOK-URL

# Logging
LOG_LEVEL=info

# Rate Limiting (requests per minute)
RATE_LIMIT=1000

# Cookie Secret (REQUIRED - Generate a strong random secret)
COOKIE_SECRET=another-secure-random-secret-at-least-32-characters
```

### Environment Variable Explanations

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` for production deployment |
| `PORT` | Yes | Port the API listens on (default: 3001) |
| `ALLOWED_ORIGINS` | Yes | Comma-separated list of allowed CORS origins |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_HOST` | Yes | Redis hostname |
| `REDIS_PORT` | Yes | Redis port (default: 6379) |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens (min 32 chars) |
| `COOKIE_SECRET` | Yes | Secret for signing cookies (min 32 chars) |
| `API_URL` | Yes | Public URL of the API |
| `FRONTEND_URL` | Yes | Public URL of the frontend |
| `AZURE_TENANT_ID` | No | Azure AD tenant ID (for SSO) |
| `AZURE_CLIENT_ID` | No | Azure AD client ID (for SSO) |
| `AZURE_CLIENT_SECRET` | No | Azure AD client secret (for SSO) |
| `TWILIO_*` | No | Twilio credentials for SMS/voice |
| `SENDGRID_*` | No | SendGrid credentials for email |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook URL |
| `TEAMS_WEBHOOK_URL` | No | Microsoft Teams webhook URL |
| `LOG_LEVEL` | No | Log level: debug, info, warn, error (default: info) |
| `RATE_LIMIT` | No | Max requests per minute (default: 1000) |

### Generating Secrets

Generate strong random secrets for `JWT_SECRET` and `COOKIE_SECRET`:

```bash
# Generate a 64-character random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use openssl
openssl rand -hex 32
```

## Database Setup

### Option 1: Managed PostgreSQL (Recommended for Production)

Use a managed PostgreSQL service for production:

- **AWS RDS**: PostgreSQL 15+
- **Azure Database**: for PostgreSQL 15+
- **Google Cloud SQL**: PostgreSQL 15+
- **DigitalOcean Managed Databases**
- **Supabase** (includes built-in backups)

**Connection Example:**
```bash
DATABASE_URL=postgresql://user:password@your-db-host:5432/openalert?sslmode=require
```

### Option 2: Self-Hosted PostgreSQL

#### Install PostgreSQL 15

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15
```

**RHEL/CentOS:**
```bash
sudo dnf install postgresql15-server postgresql15-contrib
sudo postgresql-15-setup initdb
sudo systemctl enable postgresql-15
sudo systemctl start postgresql-15
```

#### Create Database and User

```bash
sudo -u postgres psql

CREATE DATABASE openalert;
CREATE USER openalert WITH ENCRYPTED PASSWORD 'your-strong-password';
GRANT ALL PRIVILEGES ON DATABASE openalert TO openalert;
\q
```

#### Configure PostgreSQL Authentication

Edit `/etc/postgresql/15/main/pg_hba.conf`:

```
# Allow OpenAlert to connect
host    openalert    openalert    127.0.0.1/32    md5
host    openalert    openalert    ::1/128         md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Run Database Migrations

```bash
cd apps/api
npm run db:push
```

This creates all necessary tables and indexes.

### Create Superadmin User

Create the initial superadmin account:

```bash
npm run db:ensure-superadmin
```

This creates a default superadmin user:
- **Email**: `admin@openalert.local`
- **Password**: `admin123` (change immediately after first login)

**Important**: Change the default password immediately:

```bash
# Update via SQL
psql $DATABASE_URL -c "UPDATE users SET password_hash = crypt('new-secure-password', gen_salt('bf', 10)) WHERE email = 'admin@openalert.local';"
```

### Seed Test Data (Optional)

For testing, you can seed sample data:

```bash
npm run db:seed:test
```

This creates:
- Sample teams
- Sample services
- Sample users
- Sample on-call schedules
- Sample escalation policies

**Note**: Do NOT run this in production with real data.

## Docker Deployment

### Build Production Image

```bash
docker build -f docker/Dockerfile.production -t openalert-api:1.0.0 .
```

### Docker Compose (Simple Production)

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: openalert-postgres
    environment:
      POSTGRES_USER: openalert
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: openalert
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openalert"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - openalert

  redis:
    image: redis:7-alpine
    container_name: openalert-redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - openalert

  api:
    image: openalert-api:1.0.0
    container_name: openalert-api
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://openalert:${POSTGRES_PASSWORD}@postgres:5432/openalert
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: ${JWT_SECRET}
      COOKIE_SECRET: ${COOKIE_SECRET}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
      API_URL: ${API_URL}
      FRONTEND_URL: ${FRONTEND_URL}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - openalert
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health/live', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  openalert:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
```

### Run with Docker Compose

```bash
# Set environment variables
export POSTGRES_PASSWORD="your-strong-password"
export JWT_SECRET="your-jwt-secret"
export COOKIE_SECRET="your-cookie-secret"
export ALLOWED_ORIGINS="https://openalert.example.com"
export API_URL="https://openalert.example.com"
export FRONTEND_URL="https://openalert.example.com"

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f api

# Stop services
docker-compose -f docker-compose.prod.yml down
```

### Run Migrations in Docker

```bash
docker exec openalert-api npm run db:push
```

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.28+)
- kubectl configured
- Helm 3.x (optional, for easier management)

### Namespace

Create a namespace for OpenAlert:

```bash
kubectl create namespace openalert
```

### Secrets

Create Kubernetes secrets for sensitive data:

```bash
kubectl create secret generic openalert-secrets \
  --from-literal=database-url='postgresql://openalert:password@postgres:5432/openalert' \
  --from-literal=jwt-secret='your-jwt-secret' \
  --from-literal=cookie-secret='your-cookie-secret' \
  --namespace=openalert

# Optional: Notification provider secrets
kubectl create secret generic openalert-notifications \
  --from-literal=twilio-sid='your-twilio-sid' \
  --from-literal=twilio-token='your-twilio-token' \
  --from-literal=sendgrid-key='your-sendgrid-key' \
  --namespace=openalert
```

### ConfigMap

Create a ConfigMap for non-sensitive configuration:

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: openalert-config
  namespace: openalert
data:
  NODE_ENV: "production"
  PORT: "3001"
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
  LOG_LEVEL: "info"
  RATE_LIMIT: "1000"
  ALLOWED_ORIGINS: "https://openalert.example.com"
  API_URL: "https://openalert.example.com"
  FRONTEND_URL: "https://openalert.example.com"
```

Apply:
```bash
kubectl apply -f k8s/configmap.yaml
```

### PostgreSQL Deployment

**Option 1: Use External Managed Database (Recommended)**

Update the database URL in secrets to point to your managed database.

**Option 2: Deploy PostgreSQL in Kubernetes**

```yaml
# k8s/postgres.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: openalert
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
  storageClassName: standard
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: openalert
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: "openalert"
        - name: POSTGRES_USER
          value: "openalert"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: openalert-secrets
              key: postgres-password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: openalert
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  clusterIP: None
```

Apply:
```bash
kubectl apply -f k8s/postgres.yaml
```

### Redis Deployment

```yaml
# k8s/redis.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: openalert
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: openalert
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command: ["redis-server", "--appendonly", "yes"]
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: redis-storage
        persistentVolumeClaim:
          claimName: redis-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: openalert
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

Apply:
```bash
kubectl apply -f k8s/redis.yaml
```

### OpenAlert API Deployment

```yaml
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openalert-api
  namespace: openalert
spec:
  replicas: 3
  selector:
    matchLabels:
      app: openalert-api
  template:
    metadata:
      labels:
        app: openalert-api
    spec:
      containers:
      - name: api
        image: openalert-api:1.0.0
        imagePullPolicy: Always
        ports:
        - containerPort: 3001
          name: http
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: openalert-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: openalert-secrets
              key: jwt-secret
        - name: COOKIE_SECRET
          valueFrom:
            secretKeyRef:
              name: openalert-secrets
              key: cookie-secret
        envFrom:
        - configMapRef:
            name: openalert-config
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: openalert-api
  namespace: openalert
spec:
  type: ClusterIP
  selector:
    app: openalert-api
  ports:
  - port: 80
    targetPort: 3001
    protocol: TCP
    name: http
```

Apply:
```bash
kubectl apply -f k8s/api-deployment.yaml
```

### Horizontal Pod Autoscaler (HPA)

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: openalert-api-hpa
  namespace: openalert
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: openalert-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

Apply:
```bash
kubectl apply -f k8s/hpa.yaml
```

### Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: openalert-ingress
  namespace: openalert
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "2m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - openalert.example.com
    secretName: openalert-tls
  rules:
  - host: openalert.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: openalert-api
            port:
              number: 80
```

Apply:
```bash
kubectl apply -f k8s/ingress.yaml
```

### Run Database Migrations

```bash
# Get a running pod
POD=$(kubectl get pods -n openalert -l app=openalert-api -o jsonpath='{.items[0].metadata.name}')

# Run migrations
kubectl exec -n openalert $POD -- npm run db:push
```

### Verify Deployment

```bash
# Check pod status
kubectl get pods -n openalert

# Check services
kubectl get svc -n openalert

# Check ingress
kubectl get ingress -n openalert

# View logs
kubectl logs -n openalert -l app=openalert-api -f

# Test health endpoint
kubectl exec -n openalert $POD -- curl http://localhost:3001/health
```

## Reverse Proxy Configuration

### Nginx

**Install Nginx:**
```bash
sudo apt install nginx
```

**Configure Site:**

Create `/etc/nginx/sites-available/openalert`:

```nginx
# Upstream backend
upstream openalert_backend {
    server 127.0.0.1:3001;
    keepalive 32;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name openalert.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name openalert.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/openalert.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/openalert.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Body size (for alert payloads)
    client_max_body_size 2M;

    # Proxy timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_http_version 1.1;

    # API endpoints
    location / {
        proxy_pass http://openalert_backend;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://openalert_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files (if serving frontend via Nginx)
    # location /static/ {
    #     root /var/www/openalert;
    #     expires 30d;
    #     add_header Cache-Control "public, immutable";
    # }
}
```

**Enable Site:**
```bash
sudo ln -s /etc/nginx/sites-available/openalert /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**Obtain SSL Certificate (Let's Encrypt):**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d openalert.example.com
```

## Monitoring Setup

### Prometheus

**Install Prometheus:**
```bash
# Download and extract
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*
```

**Configure Prometheus:**

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'openalert'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

**Run Prometheus:**
```bash
./prometheus --config.file=prometheus.yml
```

Access at `http://localhost:9090`

### Grafana

**Install Grafana:**
```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

Access at `http://localhost:3000` (default login: admin/admin)

**Add Prometheus Data Source:**
1. Go to Configuration > Data Sources
2. Add Prometheus
3. URL: `http://localhost:9090`
4. Save & Test

**Import OpenAlert Dashboard:**

Create a dashboard with panels for:
- Active incidents
- Incident creation rate
- Mean Time to Acknowledge (MTTA)
- Mean Time to Resolve (MTTR)
- Alert ingestion rate
- Critical incidents

Query examples:
```promql
# Active incidents
openalert_active_incidents

# MTTA (seconds)
openalert_mtta_seconds

# MTTR (seconds)
openalert_mttr_seconds

# Incident rate (per minute)
rate(openalert_incidents_total[5m])
```

## Backup and Recovery

### Database Backups

**Automated Daily Backups (PostgreSQL):**

Create backup script `/usr/local/bin/backup-openalert-db.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/openalert"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/openalert_$DATE.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Perform backup
pg_dump -h localhost -U openalert openalert | gzip > $BACKUP_FILE

# Delete backups older than 30 days
find $BACKUP_DIR -name "openalert_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

Make executable:
```bash
chmod +x /usr/local/bin/backup-openalert-db.sh
```

**Schedule with cron:**
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-openalert-db.sh >> /var/log/openalert-backup.log 2>&1
```

### Redis Persistence

Redis is configured with AOF (Append-Only File) for persistence.

**Backup Redis Data:**
```bash
# Redis saves to /data/appendonly.aof
# Copy to backup location
cp /var/lib/redis/appendonly.aof /var/backups/openalert/redis_$(date +%Y%m%d).aof
```

### Restore from Backup

**Restore PostgreSQL:**
```bash
# Stop OpenAlert
sudo systemctl stop openalert

# Drop and recreate database
sudo -u postgres psql -c "DROP DATABASE openalert;"
sudo -u postgres psql -c "CREATE DATABASE openalert OWNER openalert;"

# Restore from backup
gunzip -c /var/backups/openalert/openalert_YYYYMMDD_HHMMSS.sql.gz | psql -U openalert openalert

# Start OpenAlert
sudo systemctl start openalert
```

**Restore Redis:**
```bash
# Stop Redis
sudo systemctl stop redis

# Replace AOF file
sudo cp /var/backups/openalert/redis_YYYYMMDD.aof /var/lib/redis/appendonly.aof
sudo chown redis:redis /var/lib/redis/appendonly.aof

# Start Redis
sudo systemctl start redis
```

### Disaster Recovery Plan

1. **Regular Backups**: Daily database backups, weekly full system backups
2. **Offsite Storage**: Copy backups to S3, Azure Blob, or similar
3. **Test Restores**: Monthly restore tests to verify backup integrity
4. **Documentation**: Maintain runbooks for disaster scenarios
5. **Monitoring**: Alert on backup failures
6. **Replication**: Consider PostgreSQL streaming replication for HA

## Upgrading

### Pre-Upgrade Checklist

- [ ] Review changelog and breaking changes
- [ ] Backup database
- [ ] Test upgrade in staging environment
- [ ] Schedule maintenance window
- [ ] Notify team of planned downtime

### Docker Upgrade

```bash
# Pull new image
docker pull openalert-api:1.1.0

# Stop current container
docker-compose -f docker-compose.prod.yml down

# Update docker-compose.prod.yml with new version
# ...

# Start with new version
docker-compose -f docker-compose.prod.yml up -d

# Run migrations if needed
docker exec openalert-api npm run db:push

# Verify
docker logs openalert-api
curl https://openalert.example.com/health
```

### Kubernetes Upgrade

```bash
# Update image version in deployment
kubectl set image deployment/openalert-api api=openalert-api:1.1.0 -n openalert

# Watch rollout
kubectl rollout status deployment/openalert-api -n openalert

# Run migrations
POD=$(kubectl get pods -n openalert -l app=openalert-api -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n openalert $POD -- npm run db:push

# Verify
kubectl get pods -n openalert
curl https://openalert.example.com/health
```

### Rollback

**Docker:**
```bash
docker-compose -f docker-compose.prod.yml down
# Update to previous version
docker-compose -f docker-compose.prod.yml up -d
```

**Kubernetes:**
```bash
kubectl rollout undo deployment/openalert-api -n openalert
kubectl rollout status deployment/openalert-api -n openalert
```

## Next Steps

After deployment:

1. **Security**: Review [SECURITY.md](SECURITY.md) for hardening
2. **Monitoring**: Set up alerts in Prometheus/Grafana
3. **Integrations**: Configure webhooks from monitoring systems
4. **Users**: Create teams and add users
5. **Testing**: Send test alerts to verify end-to-end flow

## Support

For deployment assistance:
- Check [PRODUCTION-CHECKLIST.md](PRODUCTION-CHECKLIST.md)
- Review [MONITORING.md](MONITORING.md) for observability
- Visit [GitHub Issues](https://github.com/yourusername/openalert/issues)
