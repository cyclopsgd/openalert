# OpenAlert Kubernetes Deployment

This directory contains Kubernetes manifests for deploying OpenAlert to a Kubernetes cluster.

## Quick Start

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Create secrets (update secrets.yaml.example first)
kubectl apply -f secrets.yaml

# Create ConfigMaps
kubectl apply -f configmap.yaml

# Create Persistent Volume Claims
kubectl apply -f pvc.yaml

# Deploy PostgreSQL
kubectl apply -f postgres-statefulset.yaml

# Deploy Redis
kubectl apply -f redis-deployment.yaml

# Deploy Application
kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml

# Create Services
kubectl apply -f services.yaml

# Create Ingress (update domain in ingress.yaml first)
kubectl apply -f ingress.yaml

# Enable Auto-scaling (optional)
kubectl apply -f hpa.yaml

# Apply Network Policies (optional)
kubectl apply -f network-policies.yaml
```

## Files Overview

### Core Resources

- `namespace.yaml` - Creates the `openalert` namespace
- `configmap.yaml` - Application configuration
- `secrets.yaml.example` - Template for secrets (copy to secrets.yaml)
- `pvc.yaml` - Persistent Volume Claims for data storage

### Database & Cache

- `postgres-statefulset.yaml` - PostgreSQL StatefulSet with persistent storage
- `redis-deployment.yaml` - Redis deployment for caching and queues

### Application

- `backend-deployment.yaml` - Backend API deployment
- `frontend-deployment.yaml` - Frontend static files deployment
- `services.yaml` - Kubernetes Services for all components

### Networking

- `ingress.yaml` - Ingress configuration with TLS
- `network-policies.yaml` - Network segmentation rules

### Scaling

- `hpa.yaml` - Horizontal Pod Autoscaler configuration

## Prerequisites

### Required Tools

- `kubectl` - Kubernetes CLI
- `helm` (optional) - For installing additional components
- Kubernetes cluster (1.24+)

### Cluster Requirements

- **Minimum**: 3 nodes, 8 CPU, 16 GB RAM
- **Recommended**: 5+ nodes, 16+ CPU, 32+ GB RAM
- Storage class with dynamic provisioning
- Ingress controller (nginx recommended)
- cert-manager (for Let's Encrypt)

### Install Prerequisites

#### Nginx Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```

#### cert-manager (for SSL)

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

#### Metrics Server (for HPA)

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

## Configuration

### 1. Create Secrets

```bash
# Copy template
cp secrets.yaml.example secrets.yaml

# Edit secrets.yaml with your base64-encoded values
# Generate base64: echo -n 'your-secret' | base64

# Apply secrets
kubectl apply -f secrets.yaml
```

**Important secrets:**
- `POSTGRES_PASSWORD` - Database password
- `JWT_SECRET` - JWT signing key (min 32 chars)
- `COOKIE_SECRET` - Cookie signing key (min 32 chars)
- `SENDGRID_API_KEY` - Email notifications
- `AZURE_AD_CLIENT_SECRET` - SSO authentication

### 2. Update ConfigMap

Edit `configmap.yaml` with your configuration:

```yaml
data:
  API_URL: "https://your-domain.com/api"
  FRONTEND_URL: "https://your-domain.com"
```

### 3. Configure Ingress

Update `ingress.yaml` with your domain:

```yaml
spec:
  tls:
    - hosts:
        - your-domain.com  # Update this
      secretName: openalert-tls
  rules:
    - host: your-domain.com  # Update this
```

### 4. Configure SSL Certificate

**Option A: Let's Encrypt (Recommended)**

Create ClusterIssuer:

```bash
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

**Option B: Manual Certificate**

```bash
kubectl create secret tls openalert-tls \
  --cert=path/to/fullchain.pem \
  --key=path/to/privkey.pem \
  -n openalert
```

## Deployment Steps

### Step 1: Create Namespace

```bash
kubectl apply -f namespace.yaml

# Verify
kubectl get namespace openalert
```

### Step 2: Apply Secrets and ConfigMaps

```bash
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml

# Verify
kubectl get secrets -n openalert
kubectl get configmaps -n openalert
```

### Step 3: Create Storage

```bash
kubectl apply -f pvc.yaml

# Wait for PVCs to be bound
kubectl get pvc -n openalert -w
```

### Step 4: Deploy Database Layer

```bash
# Deploy PostgreSQL
kubectl apply -f postgres-statefulset.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l component=postgres -n openalert --timeout=300s

# Deploy Redis
kubectl apply -f redis-deployment.yaml

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l component=redis -n openalert --timeout=300s

# Verify databases
kubectl get pods -n openalert
```

### Step 5: Deploy Application

```bash
# Deploy backend
kubectl apply -f backend-deployment.yaml

# Deploy frontend
kubectl apply -f frontend-deployment.yaml

# Create services
kubectl apply -f services.yaml

# Wait for deployments
kubectl wait --for=condition=available deployment -l app=openalert -n openalert --timeout=300s

# Verify
kubectl get deployments -n openalert
kubectl get pods -n openalert
```

### Step 6: Configure Networking

```bash
# Create ingress
kubectl apply -f ingress.yaml

# Verify ingress
kubectl get ingress -n openalert

# Check ingress IP/hostname
kubectl get ingress openalert-ingress -n openalert
```

### Step 7: Enable Auto-scaling (Optional)

```bash
kubectl apply -f hpa.yaml

# Verify HPA
kubectl get hpa -n openalert
```

### Step 8: Apply Network Policies (Optional)

```bash
kubectl apply -f network-policies.yaml

# Verify
kubectl get networkpolicies -n openalert
```

## Verification

### Check All Resources

```bash
# Overview
kubectl get all -n openalert

# Detailed pod status
kubectl get pods -n openalert -o wide

# Check services
kubectl get services -n openalert

# Check ingress
kubectl get ingress -n openalert
```

### Check Logs

```bash
# Backend logs
kubectl logs -l component=backend -n openalert --tail=50 -f

# Frontend logs
kubectl logs -l component=frontend -n openalert --tail=50 -f

# PostgreSQL logs
kubectl logs -l component=postgres -n openalert --tail=50 -f

# All pods
kubectl logs -l app=openalert -n openalert --tail=50 -f
```

### Test Health Endpoints

```bash
# Get ingress IP
INGRESS_IP=$(kubectl get ingress openalert-ingress -n openalert -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Test health endpoints
curl http://$INGRESS_IP/health
curl http://$INGRESS_IP/api/health/live
curl http://$INGRESS_IP/api/health/ready
```

### Execute Commands in Pods

```bash
# Shell into backend pod
kubectl exec -it deployment/backend -n openalert -- sh

# Run migrations
kubectl exec -it deployment/backend -n openalert -- npm run db:push

# Create superadmin
kubectl exec -it deployment/backend -n openalert -- npm run setup:superadmin
```

## Maintenance

### Update Application

```bash
# Update backend image
kubectl set image deployment/backend \
  backend=openalert/backend:v1.2.0 \
  -n openalert

# Monitor rollout
kubectl rollout status deployment/backend -n openalert

# Update frontend image
kubectl set image deployment/frontend \
  frontend=openalert/frontend:v1.2.0 \
  -n openalert

kubectl rollout status deployment/frontend -n openalert
```

### Rollback

```bash
# View rollout history
kubectl rollout history deployment/backend -n openalert

# Rollback to previous version
kubectl rollout undo deployment/backend -n openalert

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=2 -n openalert
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment backend --replicas=5 -n openalert

# Check scaling
kubectl get deployment backend -n openalert

# View HPA status
kubectl get hpa -n openalert
kubectl describe hpa backend-hpa -n openalert
```

### Backup Database

```bash
# Create backup CronJob
kubectl create job --from=cronjob/postgres-backup manual-backup-$(date +%Y%m%d) -n openalert

# Check backup job
kubectl get jobs -n openalert

# View backup logs
kubectl logs job/manual-backup-YYYYMMDD -n openalert
```

### Restore Database

```bash
# Copy backup to pod
kubectl cp backup.sql.gz openalert/postgres-0:/tmp/backup.sql.gz

# Restore
kubectl exec -it postgres-0 -n openalert -- sh -c \
  "gunzip -c /tmp/backup.sql.gz | psql -U openalert openalert"
```

## Monitoring

### View Metrics

```bash
# Pod metrics
kubectl top pods -n openalert

# Node metrics
kubectl top nodes

# HPA status
kubectl get hpa -n openalert --watch
```

### View Events

```bash
# Recent events
kubectl get events -n openalert --sort-by='.lastTimestamp'

# Watch events
kubectl get events -n openalert --watch
```

### Debug Pod Issues

```bash
# Describe pod
kubectl describe pod <pod-name> -n openalert

# Check pod logs
kubectl logs <pod-name> -n openalert

# Previous pod logs (after crash)
kubectl logs <pod-name> -n openalert --previous

# Events for specific resource
kubectl describe deployment backend -n openalert
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n openalert

# Describe pod
kubectl describe pod <pod-name> -n openalert

# Check events
kubectl get events -n openalert --sort-by='.lastTimestamp'

# Common issues:
# - Image pull errors: Check image name and registry credentials
# - CrashLoopBackOff: Check logs with kubectl logs
# - Pending: Check PVC status and node resources
```

### Database Connection Issues

```bash
# Test database connectivity
kubectl exec -it deployment/backend -n openalert -- \
  node -e "const pg = require('pg'); const client = new pg.Client(process.env.DATABASE_URL); client.connect().then(() => console.log('Connected!')).catch(err => console.error(err));"

# Check PostgreSQL is ready
kubectl get pods -l component=postgres -n openalert

# View PostgreSQL logs
kubectl logs -l component=postgres -n openalert
```

### Ingress Issues

```bash
# Check ingress status
kubectl get ingress -n openalert

# Describe ingress
kubectl describe ingress openalert-ingress -n openalert

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

### SSL/TLS Issues

```bash
# Check certificate
kubectl get certificate -n openalert

# Describe certificate
kubectl describe certificate openalert-tls -n openalert

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```

### High Resource Usage

```bash
# Check pod resources
kubectl top pods -n openalert

# Check node resources
kubectl top nodes

# Describe resource limits
kubectl describe deployment backend -n openalert | grep -A 5 "Limits"
```

## Cleanup

### Delete OpenAlert

```bash
# Delete all resources
kubectl delete -f .

# Or delete namespace (removes everything)
kubectl delete namespace openalert
```

### Delete Specific Components

```bash
# Delete application only (keep database)
kubectl delete deployment backend frontend -n openalert

# Delete ingress
kubectl delete ingress openalert-ingress -n openalert
```

## Production Checklist

See [PRODUCTION-CHECKLIST.md](../docs/PRODUCTION-CHECKLIST.md) for complete checklist.

Quick checklist:
- [ ] Secrets configured with strong passwords
- [ ] Domain configured in ingress
- [ ] SSL certificate working
- [ ] Database persistent storage configured
- [ ] Backups configured
- [ ] Monitoring configured
- [ ] Resource limits set
- [ ] HPA configured
- [ ] Network policies applied (optional)
- [ ] Health checks passing

## Support

For issues and questions:
- Documentation: `/docs/`
- GitHub Issues: https://github.com/yourusername/openalert/issues
- Kubernetes Docs: https://kubernetes.io/docs/
