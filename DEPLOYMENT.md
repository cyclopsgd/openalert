# OpenAlert Production Deployment

Complete guide to deploying OpenAlert to production.

## Quick Links

- **[Quickstart Guide](docs/DEPLOYMENT-QUICKSTART.md)** - Get started in 30 minutes
- **[Full Deployment Guide](docs/PRODUCTION-DEPLOYMENT.md)** - Comprehensive production deployment
- **[Production Checklist](docs/PRODUCTION-CHECKLIST.md)** - Pre and post-deployment verification
- **[Docker Guide](docker/README.md)** - Docker Compose deployment details
- **[Kubernetes Guide](k8s/README.md)** - Kubernetes deployment details

## Deployment Options

### 1. Docker Compose (Recommended for Getting Started)

**Best for:**
- Single server deployments
- Small to medium teams (< 50 users)
- Quick setup and testing
- Limited infrastructure

**Pros:**
- Simple setup (< 30 minutes)
- Lower resource requirements
- Easier to troubleshoot
- Good for learning

**Cons:**
- Single point of failure
- Manual scaling
- Limited high availability

**Quick Start:**
```bash
git clone https://github.com/yourusername/openalert.git
cd openalert
cp .env.production.example .env.production
# Configure .env.production
docker-compose -f docker/docker-compose.prod.yml up -d
```

[Full Docker Compose Guide →](docker/README.md)

---

### 2. Kubernetes (Recommended for Production)

**Best for:**
- Multi-server deployments
- Large teams (50+ users)
- High availability requirements
- Auto-scaling needs
- Enterprise deployments

**Pros:**
- High availability
- Auto-scaling
- Self-healing
- Rolling updates
- Better resource utilization

**Cons:**
- More complex setup
- Requires Kubernetes knowledge
- Higher resource requirements
- More operational overhead

**Quick Start:**
```bash
git clone https://github.com/yourusername/openalert.git
cd openalert/k8s
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f .
```

[Full Kubernetes Guide →](k8s/README.md)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Load Balancer                       │
│                    (Nginx / Ingress)                    │
└─────────────────────────────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
            ▼                             ▼
┌───────────────────────┐     ┌───────────────────────┐
│   Frontend (React)    │     │  Backend (NestJS)     │
│   - Static files      │     │  - REST API           │
│   - Nginx server      │     │  - WebSocket          │
└───────────────────────┘     │  - Queue workers      │
                              └───────────────────────┘
                                        │
                      ┌─────────────────┴─────────────────┐
                      │                                   │
                      ▼                                   ▼
              ┌──────────────┐                  ┌──────────────┐
              │  PostgreSQL  │                  │    Redis     │
              │  - Primary   │                  │  - Cache     │
              │  - Data      │                  │  - Queues    │
              └──────────────┘                  └──────────────┘
```

## System Requirements

### Minimum (Development/Testing)
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 20 GB SSD
- **Expected Load**: Testing only

### Small Deployment
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **Expected Load**: Up to 100 incidents/day, 10 users

### Medium Deployment
- **CPU**: 8 cores
- **RAM**: 16 GB
- **Storage**: 200 GB SSD
- **Expected Load**: Up to 1000 incidents/day, 50 users

### Large Deployment
- **CPU**: 16+ cores
- **RAM**: 32+ GB
- **Storage**: 500+ GB SSD
- **Expected Load**: 10000+ incidents/day, 200+ users

## Pre-Deployment Checklist

### Infrastructure
- [ ] Server(s) provisioned
- [ ] Domain name registered
- [ ] DNS configured
- [ ] SSL certificate obtained
- [ ] Firewall configured
- [ ] Backup storage configured

### Software
- [ ] Docker installed (20.10+) OR
- [ ] Kubernetes cluster ready (1.24+)
- [ ] kubectl configured (for K8s)
- [ ] Git installed

### Configuration
- [ ] `.env.production` configured
- [ ] Strong secrets generated
- [ ] Email provider configured (SendGrid)
- [ ] Azure AD configured (if using SSO)
- [ ] SSL certificates in place

### Security
- [ ] Firewall rules (only 80, 443 open)
- [ ] Database not exposed publicly
- [ ] Redis not exposed publicly
- [ ] Strong passwords for all services
- [ ] Secrets not in version control

## Deployment Steps

### Docker Compose

1. **Prepare Environment**
   ```bash
   git clone https://github.com/yourusername/openalert.git
   cd openalert
   cp .env.production.example .env.production
   ```

2. **Configure**
   - Edit `.env.production`
   - Generate strong secrets
   - Configure email, SSO, etc.

3. **SSL Certificate**
   - Get Let's Encrypt certificate OR
   - Use existing certificate
   - Place in `./ssl/` directory

4. **Deploy**
   ```bash
   docker-compose -f docker/docker-compose.prod.yml up -d
   ```

5. **Initialize**
   ```bash
   docker-compose -f docker/docker-compose.prod.yml exec backend npm run db:push
   ```

### Kubernetes

1. **Prepare Cluster**
   ```bash
   kubectl apply -f k8s/namespace.yaml
   ```

2. **Configure Secrets**
   ```bash
   cp k8s/secrets.yaml.example k8s/secrets.yaml
   # Edit secrets.yaml
   kubectl apply -f k8s/secrets.yaml
   ```

3. **Deploy Services**
   ```bash
   kubectl apply -f k8s/
   ```

4. **Configure Ingress**
   - Update domain in `ingress.yaml`
   - Configure SSL/TLS

5. **Verify**
   ```bash
   kubectl get pods -n openalert
   ```

## Post-Deployment

### Verification
- [ ] Health checks passing
- [ ] Can access frontend
- [ ] Can log in
- [ ] Can create incidents
- [ ] Email notifications working
- [ ] SSL certificate valid

### Setup
- [ ] Create teams
- [ ] Add users
- [ ] Configure services
- [ ] Set up on-call schedules
- [ ] Create escalation policies
- [ ] Configure integrations

### Monitoring
- [ ] Set up monitoring dashboards
- [ ] Configure alerts
- [ ] Verify backups
- [ ] Set up log aggregation

## Maintenance

### Daily
- Monitor health checks
- Check error logs
- Verify backups completed

### Weekly
- Review metrics
- Check for updates
- Test backup restoration

### Monthly
- Update dependencies
- Security audit
- Performance review
- Capacity planning

## Troubleshooting

### Common Issues

**Containers not starting:**
```bash
# Check logs
docker-compose logs
# or
kubectl logs <pod-name>
```

**Database connection errors:**
```bash
# Test connectivity
docker-compose exec backend npm run db:test
```

**SSL issues:**
```bash
# Verify certificate
openssl s_client -connect your-domain.com:443
```

**High memory usage:**
```bash
# Check resources
docker stats
# or
kubectl top pods
```

## Scaling

### Docker Compose
```bash
docker-compose -f docker/docker-compose.prod.yml up -d --scale backend=3
```

### Kubernetes
```bash
# Manual scaling
kubectl scale deployment backend --replicas=5 -n openalert

# Auto-scaling (HPA)
kubectl apply -f k8s/hpa.yaml
```

## Backup and Recovery

### Automated Backups
- Daily PostgreSQL backups (2 AM)
- 7-day retention by default
- Stored in `./backups/` or cloud storage

### Manual Backup
```bash
# Docker Compose
docker-compose -f docker/docker-compose.prod.yml exec backup /backup.sh

# Kubernetes
kubectl create job manual-backup --from=cronjob/postgres-backup -n openalert
```

### Restore
```bash
# Docker Compose
./docker/scripts/restore.sh backup.sql.gz

# Kubernetes
kubectl exec -it postgres-0 -n openalert -- /restore.sh backup.sql.gz
```

## Updates and Rollbacks

### Docker Compose
```bash
# Update
docker-compose -f docker/docker-compose.prod.yml pull
docker-compose -f docker/docker-compose.prod.yml up -d

# Rollback
docker-compose -f docker/docker-compose.prod.yml down
# Deploy previous version
```

### Kubernetes
```bash
# Update
kubectl set image deployment/backend backend=openalert/backend:v1.2.0 -n openalert

# Rollback
kubectl rollout undo deployment/backend -n openalert
```

## Security Best Practices

1. **Secrets Management**
   - Use strong, random secrets (min 32 chars)
   - Never commit secrets to Git
   - Rotate regularly (90 days)

2. **Network Security**
   - Only expose ports 80, 443
   - Use HTTPS/TLS everywhere
   - Configure firewall rules

3. **Access Control**
   - Enable RBAC
   - Principle of least privilege
   - Regular access reviews

4. **Updates**
   - Keep software updated
   - Security patches ASAP
   - Regular dependency updates

5. **Monitoring**
   - Log all access
   - Monitor for anomalies
   - Set up alerts

## Support

### Documentation
- [Deployment Quickstart](docs/DEPLOYMENT-QUICKSTART.md)
- [Production Deployment Guide](docs/PRODUCTION-DEPLOYMENT.md)
- [Production Checklist](docs/PRODUCTION-CHECKLIST.md)
- [Docker Guide](docker/README.md)
- [Kubernetes Guide](k8s/README.md)

### Help
- GitHub Issues: https://github.com/yourusername/openalert/issues
- Documentation: https://docs.openalert.io
- Community: https://community.openalert.io

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

**Ready to deploy?** Start with the [Quickstart Guide](docs/DEPLOYMENT-QUICKSTART.md).
