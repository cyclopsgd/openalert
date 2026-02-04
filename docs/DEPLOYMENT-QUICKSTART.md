# OpenAlert Deployment Quickstart

Get OpenAlert up and running in production in under 30 minutes.

## Choose Your Deployment Method

- **[Docker Compose](#docker-compose)** - Best for single-server deployments
- **[Kubernetes](#kubernetes)** - Best for multi-server, high-availability deployments

---

## Docker Compose

### Prerequisites

- Ubuntu 20.04+ (or similar Linux)
- Docker 20.10+
- Docker Compose 2.0+
- Domain name with DNS configured
- 8GB RAM minimum

### Installation (5 minutes)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Clone Repository (1 minute)

```bash
# Clone repository
git clone https://github.com/yourusername/openalert.git
cd openalert
```

### Configure Environment (5 minutes)

```bash
# Copy environment template
cp .env.production.example .env.production

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
COOKIE_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Update .env.production
nano .env.production
```

**Required changes in `.env.production`:**

```env
# Your domain
API_URL=https://your-domain.com/api
FRONTEND_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com

# Use generated secrets
JWT_SECRET=<paste generated secret>
COOKIE_SECRET=<paste generated secret>
POSTGRES_PASSWORD=<paste generated secret>

# Email (SendGrid)
SENDGRID_API_KEY=SG.your-key-here
SENDGRID_FROM_EMAIL=alerts@your-domain.com

# Optional: Azure AD for SSO
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
```

### SSL Certificate (5 minutes)

**Option A: Let's Encrypt (Recommended)**

```bash
# Install certbot
sudo apt install certbot -y

# Stop any web servers
sudo systemctl stop nginx apache2 2>/dev/null || true

# Get certificate
sudo certbot certonly --standalone \
  -d your-domain.com \
  -d www.your-domain.com \
  --agree-tos \
  --email admin@your-domain.com

# Copy certificates
sudo mkdir -p ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/
sudo chmod 644 ssl/*.pem

# Set up auto-renewal
echo "0 0 * * * certbot renew --quiet && docker-compose -f $(pwd)/docker/docker-compose.prod.yml restart nginx" | sudo crontab -
```

**Option B: Self-Signed (Testing Only)**

```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem \
  -out ssl/fullchain.pem \
  -subj "/CN=your-domain.com"
```

### Prepare Directories (1 minute)

```bash
# Create data directories
mkdir -p data/postgres data/redis backups/postgres logs/nginx

# Set permissions
chmod 755 data backups logs
```

### Build and Deploy (10 minutes)

```bash
# Build images
docker build -f docker/Dockerfile.backend -t openalert/backend:latest .
docker build -f docker/Dockerfile.frontend \
  --build-arg VITE_API_URL=https://your-domain.com/api \
  --build-arg VITE_WS_URL=wss://your-domain.com \
  -t openalert/frontend:latest .

# Start services
docker-compose -f docker/docker-compose.prod.yml up -d

# Wait for services to start
sleep 30

# Check status
docker-compose -f docker/docker-compose.prod.yml ps
```

### Initialize Database (2 minutes)

```bash
# Run migrations
docker-compose -f docker/docker-compose.prod.yml exec backend npm run db:push

# Create superadmin (optional)
docker-compose -f docker/docker-compose.prod.yml exec backend npm run setup:superadmin
```

### Verify Deployment (1 minute)

```bash
# Test health endpoints
curl https://your-domain.com/health
curl https://your-domain.com/api/health/live

# View logs
docker-compose -f docker/docker-compose.prod.yml logs backend
```

### Access Application

Open in browser: `https://your-domain.com`

**Done! Your OpenAlert instance is live.**

---

## Kubernetes

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Helm 3+ (optional)
- Domain name
- 16GB RAM minimum (across cluster)

### Quick Deploy (10 minutes)

```bash
# Clone repository
git clone https://github.com/yourusername/openalert.git
cd openalert/k8s

# Install nginx-ingress (if not installed)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Install cert-manager (if not installed)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create namespace
kubectl apply -f namespace.yaml

# Configure secrets
cp secrets.yaml.example secrets.yaml
# Edit secrets.yaml with base64-encoded values
nano secrets.yaml
kubectl apply -f secrets.yaml

# Update ConfigMap with your domain
nano configmap.yaml
kubectl apply -f configmap.yaml

# Deploy database layer
kubectl apply -f pvc.yaml
kubectl apply -f postgres-statefulset.yaml
kubectl apply -f redis-deployment.yaml

# Wait for databases
kubectl wait --for=condition=ready pod -l component=postgres -n openalert --timeout=300s
kubectl wait --for=condition=ready pod -l component=redis -n openalert --timeout=300s

# Deploy application
kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f services.yaml

# Configure ingress (update domain first)
nano ingress.yaml
kubectl apply -f ingress.yaml

# Enable auto-scaling
kubectl apply -f hpa.yaml

# Check status
kubectl get all -n openalert
```

### Configure SSL (5 minutes)

```bash
# Create Let's Encrypt ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@your-domain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Check certificate
kubectl get certificate -n openalert
```

### Initialize Database (2 minutes)

```bash
# Run migrations
kubectl exec -it deployment/backend -n openalert -- npm run db:push

# Create superadmin
kubectl exec -it deployment/backend -n openalert -- npm run setup:superadmin
```

### Verify Deployment (1 minute)

```bash
# Check pods
kubectl get pods -n openalert

# Get ingress IP
kubectl get ingress -n openalert

# Test endpoints
curl https://your-domain.com/health
```

**Done! Your OpenAlert cluster is live.**

---

## Post-Deployment Steps

### 1. Set Up Monitoring

#### Docker Compose

```bash
# View logs
docker-compose -f docker/docker-compose.prod.yml logs -f

# Monitor resources
docker stats
```

#### Kubernetes

```bash
# View logs
kubectl logs -l app=openalert -n openalert -f

# Monitor resources
kubectl top pods -n openalert
```

### 2. Configure Backups

#### Docker Compose

```bash
# Manual backup
docker-compose -f docker/docker-compose.prod.yml exec backup /backup.sh

# Backups are automatically scheduled (daily at 2 AM)
```

#### Kubernetes

```bash
# Create backup CronJob
kubectl create cronjob postgres-backup \
  --image=postgres:15-alpine \
  --schedule="0 2 * * *" \
  -n openalert \
  -- /scripts/backup.sh
```

### 3. Test Email Notifications

1. Log in to OpenAlert
2. Go to Settings > Integrations
3. Create a test integration
4. Send test alert
5. Verify email received

### 4. Configure First Service

1. Go to Services
2. Click "New Service"
3. Fill in details
4. Create integration key
5. Configure your monitoring tool

### 5. Set Up On-Call Schedule

1. Go to On-Call > Schedules
2. Create new schedule
3. Add rotation
4. Add team members
5. Save schedule

---

## Next Steps

- [ ] Review [Production Checklist](./PRODUCTION-CHECKLIST.md)
- [ ] Set up monitoring and alerting
- [ ] Configure all notification channels
- [ ] Train team on incident response
- [ ] Document runbooks
- [ ] Plan disaster recovery

---

## Common Issues

### Docker Compose Issues

**Containers not starting:**
```bash
docker-compose -f docker/docker-compose.prod.yml ps
docker-compose -f docker/docker-compose.prod.yml logs
```

**Database connection failed:**
```bash
# Check PostgreSQL is running
docker-compose -f docker/docker-compose.prod.yml exec postgres pg_isready
```

**Permission denied:**
```bash
# Fix permissions
sudo chown -R 1001:1001 data/
sudo chown -R 999:999 data/postgres
```

### Kubernetes Issues

**Pods pending:**
```bash
# Check events
kubectl get events -n openalert --sort-by='.lastTimestamp'

# Check PVCs
kubectl get pvc -n openalert
```

**Image pull errors:**
```bash
# Check deployment
kubectl describe deployment backend -n openalert

# Update image
kubectl set image deployment/backend backend=openalert/backend:latest -n openalert
```

**Database not ready:**
```bash
# Check PostgreSQL logs
kubectl logs -l component=postgres -n openalert

# Restart PostgreSQL
kubectl rollout restart statefulset/postgres -n openalert
```

---

## Getting Help

- Documentation: `/docs/`
- GitHub Issues: https://github.com/yourusername/openalert/issues
- Community: https://community.openalert.io

---

## Security Reminders

- [ ] Change all default passwords
- [ ] Use strong, random secrets (min 32 characters)
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall (only ports 80, 443)
- [ ] Regular backups
- [ ] Keep software updated
- [ ] Monitor logs for suspicious activity

**Never commit `.env.production` or `secrets.yaml` to version control!**
