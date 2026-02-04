# OpenAlert Production Deployment Guide

This guide covers deploying OpenAlert to production using Docker Compose or Kubernetes.

## Table of Contents

- [Prerequisites](#prerequisites)
- [System Requirements](#system-requirements)
- [Deployment Options](#deployment-options)
  - [Docker Compose](#docker-compose-deployment)
  - [Kubernetes](#kubernetes-deployment)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Restore](#backup-and-restore)
- [Scaling](#scaling)
- [Updates and Rollbacks](#updates-and-rollbacks)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Docker**: Version 20.10+ (for Docker Compose deployment)
- **Docker Compose**: Version 2.0+ (for Docker Compose deployment)
- **Kubernetes**: Version 1.24+ (for Kubernetes deployment)
- **kubectl**: Latest version (for Kubernetes deployment)
- **Git**: For cloning the repository
- **OpenSSL**: For generating secrets

### Required Accounts

- **Domain Name**: Registered domain with DNS access
- **SSL Certificate**: Let's Encrypt (recommended) or commercial certificate
- **SendGrid Account**: For email notifications
- **Azure AD**: For SSO authentication (optional)

---

## System Requirements

### Minimum Requirements (Small Deployment)

- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **Network**: 100 Mbps
- **Expected Load**: Up to 100 incidents/day, 10 concurrent users

### Recommended Requirements (Medium Deployment)

- **CPU**: 8 cores
- **RAM**: 16 GB
- **Storage**: 200 GB SSD
- **Network**: 1 Gbps
- **Expected Load**: Up to 1000 incidents/day, 50 concurrent users

### Enterprise Requirements (Large Deployment)

- **CPU**: 16+ cores
- **RAM**: 32+ GB
- **Storage**: 500+ GB SSD (with RAID)
- **Network**: 10 Gbps
- **Expected Load**: 10000+ incidents/day, 200+ concurrent users

### Component Resource Allocation

| Component | CPU (cores) | Memory (GB) | Storage (GB) |
|-----------|-------------|-------------|--------------|
| PostgreSQL | 2 | 4 | 100+ |
| Redis | 1 | 1 | 10 |
| Backend API | 2-4 | 2-4 | 10 |
| Frontend | 0.5 | 0.5 | 1 |
| Nginx | 1 | 0.5 | 1 |

---

## Deployment Options

### Docker Compose Deployment

Best for: Single server deployments, small to medium teams

#### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/openalert.git
cd openalert
```

#### Step 2: Configure Environment

```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit with your favorite editor
nano .env.production
```

**Critical settings to update:**

```env
# Update with your domain
API_URL=https://your-domain.com/api
FRONTEND_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com

# Generate strong secrets
JWT_SECRET=$(openssl rand -base64 32)
COOKIE_SECRET=$(openssl rand -base64 32)

# Database password
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Email configuration
SENDGRID_API_KEY=SG.your-actual-key
SENDGRID_FROM_EMAIL=alerts@your-domain.com

# Azure AD (if using SSO)
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
```

#### Step 3: Prepare Data Directories

```bash
# Create required directories
mkdir -p data/postgres
mkdir -p data/redis
mkdir -p backups/postgres
mkdir -p logs/nginx
mkdir -p ssl

# Set proper permissions
chmod 755 data backups logs
```

#### Step 4: SSL Certificate Setup

**Option A: Let's Encrypt (Recommended)**

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Copy certificates to ssl directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/
sudo chmod 644 ./ssl/*.pem
```

**Option B: Self-Signed (Development/Testing Only)**

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./ssl/privkey.pem \
  -out ./ssl/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"
```

#### Step 5: Build Images

```bash
# Build backend image
docker build -f docker/Dockerfile.backend -t openalert/backend:latest .

# Build frontend image
docker build -f docker/Dockerfile.frontend \
  --build-arg VITE_API_URL=https://your-domain.com/api \
  --build-arg VITE_WS_URL=wss://your-domain.com \
  -t openalert/frontend:latest .
```

#### Step 6: Deploy

```bash
# Start all services
docker-compose -f docker/docker-compose.prod.yml up -d

# Check status
docker-compose -f docker/docker-compose.prod.yml ps

# View logs
docker-compose -f docker/docker-compose.prod.yml logs -f
```

#### Step 7: Initialize Database

```bash
# Run migrations
docker-compose -f docker/docker-compose.prod.yml exec backend npm run db:push

# Create superadmin (optional)
docker-compose -f docker/docker-compose.prod.yml exec backend npm run setup:superadmin
```

#### Step 8: Verify Deployment

```bash
# Check health endpoints
curl https://your-domain.com/health
curl https://your-domain.com/api/health/live
curl https://your-domain.com/api/health/ready

# Check logs
docker-compose -f docker/docker-compose.prod.yml logs backend
```

---

### Kubernetes Deployment

Best for: Multi-server deployments, high availability, auto-scaling

#### Step 1: Prerequisites

```bash
# Verify kubectl is configured
kubectl cluster-info

# Verify you have access
kubectl get nodes

# Install nginx-ingress-controller (if not already installed)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Install cert-manager (for Let's Encrypt)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

#### Step 2: Create Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

#### Step 3: Configure Secrets

```bash
# Create secrets from environment file
kubectl create secret generic openalert-secrets \
  --from-env-file=.env.production \
  -n openalert

# Or use the template
cp k8s/secrets.yaml.example k8s/secrets.yaml
# Edit k8s/secrets.yaml with your values (base64 encoded)
kubectl apply -f k8s/secrets.yaml
```

#### Step 4: SSL/TLS Certificate

**Option A: Let's Encrypt with cert-manager**

```bash
# Create ClusterIssuer
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
```

**Option B: Manual certificate**

```bash
kubectl create secret tls openalert-tls \
  --cert=path/to/fullchain.pem \
  --key=path/to/privkey.pem \
  -n openalert
```

#### Step 5: Deploy Database and Cache

```bash
# Create persistent volumes
kubectl apply -f k8s/pvc.yaml

# Deploy PostgreSQL
kubectl apply -f k8s/postgres-statefulset.yaml

# Deploy Redis
kubectl apply -f k8s/redis-deployment.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l component=postgres -n openalert --timeout=300s
kubectl wait --for=condition=ready pod -l component=redis -n openalert --timeout=300s
```

#### Step 6: Deploy Application

```bash
# Create ConfigMap
kubectl apply -f k8s/configmap.yaml

# Deploy backend
kubectl apply -f k8s/backend-deployment.yaml

# Deploy frontend
kubectl apply -f k8s/frontend-deployment.yaml

# Create services
kubectl apply -f k8s/services.yaml

# Wait for deployments
kubectl wait --for=condition=available deployment -l app=openalert -n openalert --timeout=300s
```

#### Step 7: Configure Ingress

```bash
# Update k8s/ingress.yaml with your domain
sed -i 's/your-domain.com/actual-domain.com/g' k8s/ingress.yaml

# Apply ingress
kubectl apply -f k8s/ingress.yaml

# Check ingress status
kubectl get ingress -n openalert
```

#### Step 8: Enable Auto-scaling (Optional)

```bash
# Apply HPA
kubectl apply -f k8s/hpa.yaml

# Check HPA status
kubectl get hpa -n openalert
```

#### Step 9: Network Policies (Optional)

```bash
# Apply network policies for security
kubectl apply -f k8s/network-policies.yaml
```

#### Step 10: Verify Deployment

```bash
# Check all resources
kubectl get all -n openalert

# Check pod status
kubectl get pods -n openalert

# Check logs
kubectl logs -l component=backend -n openalert --tail=50

# Test endpoints
curl https://your-domain.com/health
```

---

## SSL/TLS Configuration

### Let's Encrypt (Recommended)

#### Auto-renewal with Docker Compose

```bash
# Add to crontab
0 0 * * * certbot renew --quiet && \
  docker-compose -f /path/to/docker-compose.prod.yml restart nginx
```

#### Auto-renewal with Kubernetes

Cert-manager handles renewal automatically. Verify:

```bash
kubectl get certificate -n openalert
kubectl describe certificate openalert-tls -n openalert
```

### SSL Best Practices

1. Use TLS 1.2 and TLS 1.3 only
2. Disable weak ciphers
3. Enable HSTS (after testing)
4. Use OCSP stapling
5. Regular certificate renewal
6. Monitor certificate expiration

---

## Environment Configuration

### Required Variables

See `.env.production.example` for complete list.

### Secret Management Best Practices

1. **Never commit secrets to Git**
   ```bash
   echo ".env.production" >> .gitignore
   ```

2. **Use strong random secrets**
   ```bash
   openssl rand -base64 32
   ```

3. **Rotate secrets regularly**
   - JWT secrets: Every 90 days
   - Database passwords: Every 180 days
   - API keys: As recommended by provider

4. **Use secret management tools**
   - Kubernetes: Use Secrets
   - Docker: Use Docker Secrets
   - Cloud: Use AWS Secrets Manager, Azure Key Vault, etc.

---

## Database Setup

### Initial Setup

Database is automatically initialized on first run.

### Manual Migrations

```bash
# Docker Compose
docker-compose -f docker/docker-compose.prod.yml exec backend npm run db:push

# Kubernetes
kubectl exec -it deployment/backend -n openalert -- npm run db:push
```

### Database Tuning

PostgreSQL configuration in `docker-compose.prod.yml` is optimized for:
- 4GB RAM
- SSD storage
- 200 max connections

Adjust based on your resources:

```yaml
command:
  - "postgres"
  - "-c"
  - "max_connections=200"
  - "-c"
  - "shared_buffers=1GB"
  # ... other settings
```

---

## Monitoring and Logging

### Health Checks

```bash
# Liveness probe
curl https://your-domain.com/api/health/live

# Readiness probe
curl https://your-domain.com/api/health/ready
```

### View Logs

**Docker Compose:**

```bash
# All services
docker-compose -f docker/docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker/docker-compose.prod.yml logs -f backend

# With timestamps
docker-compose -f docker/docker-compose.prod.yml logs -f --timestamps
```

**Kubernetes:**

```bash
# All pods
kubectl logs -l app=openalert -n openalert --tail=100 -f

# Specific component
kubectl logs -l component=backend -n openalert --tail=100 -f

# Previous pod logs (after crash)
kubectl logs deployment/backend -n openalert --previous
```

### Metrics

Access Prometheus metrics at:
```
https://your-domain.com/api/metrics
```

### Log Aggregation (Recommended)

Consider using:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- CloudWatch (AWS)
- Azure Monitor

---

## Backup and Restore

### Automated Backups

#### Docker Compose

Backup service runs automatically (configured in `docker-compose.prod.yml`):

```yaml
BACKUP_SCHEDULE: "0 2 * * *"  # Daily at 2 AM
BACKUP_RETENTION_DAYS: 7
```

Manual backup:

```bash
docker-compose -f docker/docker-compose.prod.yml exec backup /backup.sh
```

#### Kubernetes

Create CronJob for backups:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: openalert
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15-alpine
            command: ["/scripts/backup.sh"]
          restartPolicy: OnFailure
```

### Manual Backup

```bash
# Docker Compose
docker-compose -f docker/docker-compose.prod.yml exec postgres \
  pg_dump -U openalert openalert | gzip > backup_$(date +%Y%m%d).sql.gz

# Kubernetes
kubectl exec -it statefulset/postgres -n openalert -- \
  pg_dump -U openalert openalert | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore from Backup

```bash
# Docker Compose
gunzip -c backup_20240101.sql.gz | \
  docker-compose -f docker/docker-compose.prod.yml exec -T postgres \
  psql -U openalert openalert

# Kubernetes
gunzip -c backup_20240101.sql.gz | \
  kubectl exec -i statefulset/postgres -n openalert -- \
  psql -U openalert openalert
```

### Backup to Cloud Storage

#### AWS S3

```bash
# Configure in .env.production
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_BACKUP_BUCKET=your-backup-bucket
AWS_REGION=us-east-1

# Backup script automatically uploads to S3
```

#### Azure Blob Storage

```bash
# Install Azure CLI in backup container
az storage blob upload \
  --account-name your-account \
  --container-name backups \
  --file backup.sql.gz \
  --name backup_$(date +%Y%m%d).sql.gz
```

---

## Scaling

### Docker Compose Scaling

```bash
# Scale backend
docker-compose -f docker/docker-compose.prod.yml up -d --scale backend=5

# Verify
docker-compose -f docker/docker-compose.prod.yml ps
```

### Kubernetes Auto-scaling

Configured in `k8s/hpa.yaml`:

```bash
# View HPA status
kubectl get hpa -n openalert

# Describe HPA
kubectl describe hpa backend-hpa -n openalert
```

### Manual Scaling

```bash
# Scale backend to 5 replicas
kubectl scale deployment backend --replicas=5 -n openalert

# Verify
kubectl get deployment backend -n openalert
```

### Database Scaling

For PostgreSQL high availability:
- Use managed services (AWS RDS, Azure Database, GCP Cloud SQL)
- Or implement replication with Patroni/PgPool
- Consider read replicas for read-heavy workloads

---

## Updates and Rollbacks

### Rolling Updates (Kubernetes)

```bash
# Update backend image
kubectl set image deployment/backend \
  backend=openalert/backend:v1.2.0 \
  -n openalert

# Monitor rollout
kubectl rollout status deployment/backend -n openalert

# Check rollout history
kubectl rollout history deployment/backend -n openalert
```

### Rollback (Kubernetes)

```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n openalert

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=2 -n openalert
```

### Zero-Downtime Updates (Docker Compose)

```bash
# Pull new images
docker-compose -f docker/docker-compose.prod.yml pull

# Recreate services with no downtime
docker-compose -f docker/docker-compose.prod.yml up -d --no-deps --build backend

# Verify
docker-compose -f docker/docker-compose.prod.yml ps
```

---

## Troubleshooting

### Common Issues

#### 1. Containers Not Starting

```bash
# Check logs
docker-compose -f docker/docker-compose.prod.yml logs backend

# Check events (Kubernetes)
kubectl get events -n openalert --sort-by='.lastTimestamp'

# Describe pod
kubectl describe pod <pod-name> -n openalert
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
docker-compose -f docker/docker-compose.prod.yml exec backend \
  node -e "const pg = require('pg'); const client = new pg.Client(process.env.DATABASE_URL); client.connect().then(() => console.log('Connected!')).catch(err => console.error(err));"

# Check PostgreSQL logs
docker-compose -f docker/docker-compose.prod.yml logs postgres
```

#### 3. SSL/TLS Issues

```bash
# Test SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Check certificate expiration
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

#### 4. High Memory Usage

```bash
# Check resource usage
docker stats

# Kubernetes
kubectl top pods -n openalert
kubectl top nodes
```

#### 5. Performance Issues

```bash
# Check database performance
docker-compose -f docker/docker-compose.prod.yml exec postgres \
  psql -U openalert -c "SELECT * FROM pg_stat_activity;"

# Check slow queries
docker-compose -f docker/docker-compose.prod.yml exec postgres \
  psql -U openalert -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### Debug Mode

```bash
# Enable debug logging
docker-compose -f docker/docker-compose.prod.yml exec backend \
  sh -c "LOG_LEVEL=debug npm start"
```

### Support Resources

- Documentation: https://docs.openalert.io
- GitHub Issues: https://github.com/yourusername/openalert/issues
- Community: https://community.openalert.io
- Email: support@openalert.io

---

## Security Checklist

Before going to production:

- [ ] Strong, unique secrets generated for all services
- [ ] SSL/TLS configured with valid certificate
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] Database not exposed to public internet
- [ ] Redis not exposed to public internet
- [ ] Firewall configured (only ports 80, 443 open)
- [ ] Regular backups configured and tested
- [ ] Monitoring and alerting set up
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers configured
- [ ] Database credentials secured
- [ ] API keys secured (not in code)
- [ ] Public registration disabled (if applicable)
- [ ] Swagger/API docs disabled in production
- [ ] Error messages don't expose sensitive data
- [ ] Logs don't contain sensitive data
- [ ] Container images scanned for vulnerabilities
- [ ] Dependencies updated to latest secure versions
- [ ] Network policies configured (Kubernetes)
- [ ] Pod security policies configured (Kubernetes)

---

## Next Steps

After deployment:

1. Set up monitoring and alerting
2. Configure backup verification
3. Test disaster recovery procedures
4. Perform security audit
5. Load testing
6. Set up CI/CD pipeline
7. Create runbook for common operations
8. Train team on operations procedures

---

**Need help?** Check the [Production Checklist](./PRODUCTION-CHECKLIST.md) for detailed verification steps.
