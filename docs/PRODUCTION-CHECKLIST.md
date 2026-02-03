# OpenAlert Production Checklist

Use this checklist to ensure your OpenAlert deployment is production-ready.

## Pre-Deployment

### Environment Configuration

- [ ] **Environment variables configured**
  - [ ] `NODE_ENV=production`
  - [ ] `DATABASE_URL` points to production database
  - [ ] `REDIS_HOST` and `REDIS_PORT` configured
  - [ ] `JWT_SECRET` set (min 32 characters, random)
  - [ ] `COOKIE_SECRET` set (min 32 characters, random)
  - [ ] `ALLOWED_ORIGINS` configured with production URLs
  - [ ] `API_URL` and `FRONTEND_URL` set correctly
  - [ ] `LOG_LEVEL` set to `info` or `warn`

- [ ] **Secrets are secure**
  - [ ] JWT_SECRET is cryptographically random (not a simple string)
  - [ ] COOKIE_SECRET is cryptographically random
  - [ ] Database password is strong (min 16 characters)
  - [ ] Secrets stored in environment variables or secret manager (not in code)
  - [ ] `.env` file not committed to version control

### Database Setup

- [ ] **PostgreSQL configured**
  - [ ] PostgreSQL 15+ installed or managed service provisioned
  - [ ] Database `openalert` created
  - [ ] Database user created with appropriate permissions
  - [ ] Connection string tested
  - [ ] SSL/TLS enabled for database connections
  - [ ] Connection pooling configured (if using external pool)

- [ ] **Migrations applied**
  - [ ] Run `npm run db:push` to create all tables
  - [ ] Verify all tables exist: `psql $DATABASE_URL -c "\dt"`
  - [ ] Check indexes: `psql $DATABASE_URL -c "\di"`

- [ ] **Superadmin created**
  - [ ] Run `npm run db:ensure-superadmin`
  - [ ] Default password changed immediately
  - [ ] Additional admin users created as needed

### Redis Setup

- [ ] **Redis configured**
  - [ ] Redis 7+ installed or managed service provisioned
  - [ ] Redis accessible from application
  - [ ] Connection tested
  - [ ] Persistence enabled (AOF or RDB)
  - [ ] Memory limits configured appropriately

### SSL/TLS Certificates

- [ ] **SSL certificate obtained**
  - [ ] Valid SSL certificate installed
  - [ ] Certificate covers your domain (e.g., `openalert.example.com`)
  - [ ] Certificate auto-renewal configured (if using Let's Encrypt)
  - [ ] Certificate expiry monitoring set up

### Authentication

- [ ] **Authentication configured**
  - [ ] Azure Entra ID configured (if using SSO)
    - [ ] AZURE_TENANT_ID set
    - [ ] AZURE_CLIENT_ID set
    - [ ] AZURE_CLIENT_SECRET set
    - [ ] Redirect URI registered in Azure: `{API_URL}/auth/callback`
  - [ ] OR Local authentication enabled
    - [ ] Password requirements documented
    - [ ] Password reset process defined

## Security

### Network Security

- [ ] **Firewall configured**
  - [ ] Only necessary ports exposed (443 for HTTPS, optionally 22 for SSH)
  - [ ] Database port (5432) not publicly accessible
  - [ ] Redis port (6379) not publicly accessible
  - [ ] Firewall rules tested

- [ ] **CORS configured**
  - [ ] `ALLOWED_ORIGINS` set to specific domains (not `*`)
  - [ ] CORS tested with production frontend

- [ ] **Rate limiting enabled**
  - [ ] `RATE_LIMIT` configured (default: 1000 req/min)
  - [ ] Rate limiting tested
  - [ ] Webhook rate limits appropriate for expected load

### Application Security

- [ ] **Security headers enabled**
  - [ ] Helmet.js security headers active (default in OpenAlert)
  - [ ] HSTS header enabled
  - [ ] X-Frame-Options set
  - [ ] CSP configured

- [ ] **HTTPS enforced**
  - [ ] All traffic redirected from HTTP to HTTPS
  - [ ] HSTS header includes subdomains
  - [ ] SSL Labs scan shows A+ rating

- [ ] **Input validation**
  - [ ] All endpoints use DTOs with class-validator
  - [ ] File upload limits configured (1MB for alerts)
  - [ ] SQL injection prevention verified (parameterized queries)

- [ ] **Dependencies updated**
  - [ ] Run `npm audit` and fix critical vulnerabilities
  - [ ] All dependencies up to date
  - [ ] Vulnerability scanning scheduled

## Monitoring and Logging

### Health Checks

- [ ] **Health endpoints configured**
  - [ ] `/health` returns 200 OK
  - [ ] `/health/live` liveness probe working
  - [ ] `/health/ready` readiness probe working
  - [ ] Health checks include database connectivity
  - [ ] Health checks include Redis connectivity

### Metrics

- [ ] **Prometheus metrics enabled**
  - [ ] `/metrics` endpoint accessible
  - [ ] Metrics include:
    - [ ] `openalert_active_incidents`
    - [ ] `openalert_incidents_total`
    - [ ] `openalert_critical_incidents`
    - [ ] `openalert_mtta_seconds`
    - [ ] `openalert_mttr_seconds`
  - [ ] Prometheus scraping OpenAlert metrics

### Logging

- [ ] **Logging configured**
  - [ ] `LOG_LEVEL` set appropriately (info or warn for production)
  - [ ] Logs include correlation IDs
  - [ ] Structured logging format
  - [ ] Log rotation configured (if not using container logging)
  - [ ] Log aggregation set up (ELK, Loki, CloudWatch, etc.)

### Alerting

- [ ] **Monitoring alerts configured**
  - [ ] Alert on high error rate
  - [ ] Alert on slow response times (>1s p95)
  - [ ] Alert on database connection failures
  - [ ] Alert on Redis connection failures
  - [ ] Alert on high memory usage (>80%)
  - [ ] Alert on high CPU usage (>80%)
  - [ ] Alert on disk space low (<20% free)
  - [ ] Alert on SSL certificate expiring (<30 days)

## Backup and Recovery

### Backups

- [ ] **Database backups configured**
  - [ ] Automated daily backups scheduled
  - [ ] Backup retention policy defined (30 days recommended)
  - [ ] Backups stored offsite (S3, Azure Blob, etc.)
  - [ ] Backup encryption enabled

- [ ] **Redis backups configured**
  - [ ] AOF or RDB persistence enabled
  - [ ] Redis data backed up regularly
  - [ ] Backup location documented

### Disaster Recovery

- [ ] **Recovery plan documented**
  - [ ] Database restore procedure tested
  - [ ] Redis restore procedure tested
  - [ ] RTO (Recovery Time Objective) defined
  - [ ] RPO (Recovery Point Objective) defined
  - [ ] Runbook for disaster recovery created

- [ ] **Backup restoration tested**
  - [ ] Restore tested in staging environment
  - [ ] Restore time measured
  - [ ] Data integrity verified after restore

## Performance

### Resource Limits

- [ ] **Container/VM resources configured**
  - [ ] Memory limits set (min 2GB for API in production)
  - [ ] CPU limits set appropriately
  - [ ] Disk I/O sufficient for database operations

### Scaling

- [ ] **Horizontal scaling configured** (if applicable)
  - [ ] Load balancer configured
  - [ ] Multiple API instances running
  - [ ] Session affinity configured (if needed for WebSockets)
  - [ ] Redis used for shared state
  - [ ] Horizontal Pod Autoscaler configured (Kubernetes)

### Database Performance

- [ ] **Database optimized**
  - [ ] Indexes verified (check schema.ts for index definitions)
  - [ ] Query performance tested
  - [ ] Connection pooling configured
  - [ ] Slow query logging enabled

## Notification Providers

### Email (SendGrid)

- [ ] **SendGrid configured** (if using email notifications)
  - [ ] `SENDGRID_API_KEY` set
  - [ ] `SENDGRID_FROM_EMAIL` set and verified
  - [ ] Test email sent successfully
  - [ ] SPF and DKIM configured for domain

### SMS/Voice (Twilio)

- [ ] **Twilio configured** (if using SMS/voice)
  - [ ] `TWILIO_ACCOUNT_SID` set
  - [ ] `TWILIO_AUTH_TOKEN` set
  - [ ] `TWILIO_PHONE_NUMBER` set
  - [ ] Test SMS sent successfully
  - [ ] Test voice call made successfully

### Slack

- [ ] **Slack configured** (if using Slack)
  - [ ] `SLACK_WEBHOOK_URL` set
  - [ ] Test message sent to Slack
  - [ ] Webhook URL secured

### Microsoft Teams

- [ ] **Teams configured** (if using Teams)
  - [ ] `TEAMS_WEBHOOK_URL` set
  - [ ] Test message sent to Teams
  - [ ] Webhook URL secured

## Application Setup

### Teams and Users

- [ ] **Initial teams created**
  - [ ] At least one team created
  - [ ] Team members added
  - [ ] Team roles assigned appropriately

- [ ] **User accounts created**
  - [ ] Admin users created
  - [ ] Responder users created
  - [ ] User roles assigned correctly
  - [ ] Phone numbers added (for SMS/voice notifications)
  - [ ] Email addresses verified

### Services

- [ ] **Services configured**
  - [ ] Production services created
  - [ ] Services assigned to teams
  - [ ] Service descriptions filled in
  - [ ] Service slugs unique and meaningful

### Escalation Policies

- [ ] **Escalation policies created**
  - [ ] At least one escalation policy per service
  - [ ] Escalation levels configured
  - [ ] Escalation delays set appropriately (5-15 minutes recommended)
  - [ ] On-call schedules linked to policies

### On-Call Schedules

- [ ] **Schedules configured**
  - [ ] On-call schedules created
  - [ ] Rotations added
  - [ ] Participants assigned
  - [ ] Timezone configured correctly
  - [ ] Schedule tested ("Who's on call?" endpoint)

### Integrations

- [ ] **Monitoring integrations configured**
  - [ ] Integration keys generated for each service
  - [ ] Webhook URLs provided to monitoring systems
  - [ ] Integration types set correctly (prometheus, grafana, etc.)
  - [ ] Test alerts sent successfully

### Alert Routing

- [ ] **Routing rules configured** (if using custom routing)
  - [ ] Routing rules created
  - [ ] Rule priorities set
  - [ ] Routing conditions tested
  - [ ] Default route configured

## Testing

### End-to-End Testing

- [ ] **Full incident flow tested**
  - [ ] Send test webhook from monitoring system
  - [ ] Verify alert received
  - [ ] Verify incident created
  - [ ] Verify notifications sent
  - [ ] Verify escalation triggered
  - [ ] Acknowledge incident
  - [ ] Resolve incident
  - [ ] Verify incident resolved

- [ ] **WebSocket functionality tested**
  - [ ] Real-time incident updates working
  - [ ] Real-time alert updates working
  - [ ] WebSocket authentication working

- [ ] **API endpoints tested**
  - [ ] All critical endpoints return 200 OK
  - [ ] Authentication working
  - [ ] Authorization working (RBAC)
  - [ ] Error handling working

### Load Testing

- [ ] **Load testing performed**
  - [ ] API can handle expected request volume
  - [ ] Webhook endpoint can handle alert volume
  - [ ] Database performance acceptable under load
  - [ ] Redis performance acceptable under load
  - [ ] No memory leaks detected

## Documentation

### Internal Documentation

- [ ] **Runbooks created**
  - [ ] Database maintenance procedures
  - [ ] Backup and restore procedures
  - [ ] Incident response procedures
  - [ ] Common troubleshooting steps

- [ ] **Configuration documented**
  - [ ] Environment variables documented
  - [ ] Architecture diagram created
  - [ ] Network diagram created
  - [ ] Dependency list maintained

### User Documentation

- [ ] **User guides available**
  - [ ] How to create incidents
  - [ ] How to acknowledge/resolve incidents
  - [ ] How to configure on-call schedules
  - [ ] How to set notification preferences
  - [ ] How to view status pages

## Compliance and Legal

### Data Protection

- [ ] **GDPR compliance** (if applicable)
  - [ ] Privacy policy created
  - [ ] Data retention policy defined
  - [ ] User data export capability
  - [ ] User data deletion capability
  - [ ] Cookie consent implemented (if needed)

- [ ] **Data encryption**
  - [ ] Data in transit encrypted (HTTPS/TLS)
  - [ ] Database connections encrypted
  - [ ] Backups encrypted
  - [ ] Sensitive data hashed (passwords)

### Access Control

- [ ] **Access controls implemented**
  - [ ] RBAC system configured
  - [ ] Principle of least privilege followed
  - [ ] Admin access restricted
  - [ ] Audit logging enabled
  - [ ] Session timeouts configured (7-day JWT expiry)

## Post-Deployment

### Smoke Testing

- [ ] **Basic functionality verified**
  - [ ] Can log in
  - [ ] Can view incidents
  - [ ] Can create service
  - [ ] Can create integration
  - [ ] Can send test webhook
  - [ ] Can receive notifications

### Monitoring Setup

- [ ] **Dashboards created**
  - [ ] Grafana dashboard for OpenAlert metrics
  - [ ] Dashboard shows key metrics (MTTA, MTTR, active incidents)
  - [ ] Dashboard accessible to operations team

### Team Training

- [ ] **Team trained on OpenAlert**
  - [ ] Incident response procedures reviewed
  - [ ] On-call rotation explained
  - [ ] Notification preferences configured
  - [ ] Escalation policies understood

### Communication

- [ ] **Stakeholders notified**
  - [ ] Team informed of go-live date
  - [ ] Monitoring integrations updated
  - [ ] Old alerting system deprecated (if applicable)
  - [ ] Support contacts distributed

## Ongoing Maintenance

### Regular Tasks

- [ ] **Weekly**
  - [ ] Review error logs
  - [ ] Check backup success
  - [ ] Review incident metrics

- [ ] **Monthly**
  - [ ] Update dependencies (`npm update`)
  - [ ] Run security audit (`npm audit`)
  - [ ] Test backup restoration
  - [ ] Review and update documentation

- [ ] **Quarterly**
  - [ ] Review and update escalation policies
  - [ ] Review on-call schedules
  - [ ] Conduct disaster recovery drill
  - [ ] Review system capacity and plan for growth

---

## Sign-Off

Once all items are checked, have the following roles sign off:

- [ ] **DevOps Engineer**: ___________________ Date: _______
- [ ] **Security Engineer**: ___________________ Date: _______
- [ ] **Engineering Manager**: ___________________ Date: _______
- [ ] **Product Owner**: ___________________ Date: _______

**Notes:**

---

**Production Go-Live Date**: ______________

**Production URL**: https://openalert.example.com
