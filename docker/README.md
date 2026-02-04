# OpenAlert Docker Deployment

This directory contains Docker configurations for deploying OpenAlert.

## Quick Start

### Development

```bash
# Start development environment
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Production

```bash
# Configure environment
cp ../.env.production.example ../.env.production
# Edit .env.production with your settings

# Build images
docker build -f Dockerfile.backend -t openalert/backend:latest ..
docker build -f Dockerfile.frontend -t openalert/frontend:latest ..

# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```

## Files

### Docker Compose Files

- `docker-compose.yml` - Development environment
- `docker-compose.prod.yml` - Production environment with all optimizations

### Dockerfiles

- `Dockerfile.backend` - Multi-stage build for NestJS backend
- `Dockerfile.frontend` - Multi-stage build for React frontend

### Nginx Configuration

- `nginx/nginx.conf` - Main nginx configuration
- `nginx/nginx-prod.conf` - Production reverse proxy configuration
- `nginx/frontend.conf` - Frontend SPA configuration
- `nginx/ssl.conf` - SSL/TLS settings

### Scripts

- `scripts/backup.sh` - Database backup script
- `scripts/restore.sh` - Database restore script

### Configuration

- `redis/redis.conf` - Redis configuration
- `postgres/init/01-init.sql` - PostgreSQL initialization

## Production Deployment

See [PRODUCTION-DEPLOYMENT.md](../docs/PRODUCTION-DEPLOYMENT.md) for complete guide.

### Prerequisites

1. Docker 20.10+
2. Docker Compose 2.0+
3. Domain with DNS configured
4. SSL certificate

### Quick Deployment Checklist

- [ ] Configure `.env.production`
- [ ] Set strong secrets (JWT_SECRET, COOKIE_SECRET, POSTGRES_PASSWORD)
- [ ] Place SSL certificates in `./ssl/`
- [ ] Create data directories
- [ ] Build images
- [ ] Start services
- [ ] Run migrations
- [ ] Verify deployment

## Maintenance

### Backup Database

```bash
docker-compose -f docker-compose.prod.yml exec backup /backup.sh
```

### Restore Database

```bash
./scripts/restore.sh /path/to/backup.sql.gz
```

### Update Application

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Recreate services
docker-compose -f docker-compose.prod.yml up -d

# Or rebuild from source
docker-compose -f docker-compose.prod.yml up -d --build
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100
```

### Scale Services

```bash
# Scale backend to 5 instances
docker-compose -f docker-compose.prod.yml up -d --scale backend=5
```

## Troubleshooting

### Containers not starting

```bash
# Check status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### Database connection issues

```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U openalert
```

### High memory usage

```bash
# Check resource usage
docker stats

# Adjust resource limits in docker-compose.prod.yml
```

## Security

### Best Practices

1. Use strong, random secrets
2. Keep images updated
3. Enable SSL/TLS
4. Restrict database access
5. Regular backups
6. Monitor logs
7. Update regularly

### Scanning for Vulnerabilities

```bash
# Scan backend image
docker scan openalert/backend:latest

# Scan frontend image
docker scan openalert/frontend:latest
```

## Support

For issues and questions:
- Documentation: `/docs/`
- GitHub Issues: https://github.com/yourusername/openalert/issues
