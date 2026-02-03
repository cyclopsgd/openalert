# OpenAlert Monitoring and Observability Guide

Complete guide to monitoring, logging, and observability for OpenAlert.

## Table of Contents

- [Overview](#overview)
- [Application Logging](#application-logging)
- [Metrics](#metrics)
- [Health Checks](#health-checks)
- [Alerting](#alerting)
- [Grafana Dashboards](#grafana-dashboards)
- [Distributed Tracing](#distributed-tracing)
- [Troubleshooting](#troubleshooting)
- [Performance Monitoring](#performance-monitoring)

## Overview

Effective monitoring of OpenAlert ensures:
- Early detection of issues
- Performance optimization
- Incident post-mortems
- Capacity planning
- SLA compliance

**Monitoring Stack:**
- **Logs**: Structured JSON logs via NestJS Logger
- **Metrics**: Prometheus metrics exposed at `/metrics`
- **Health**: Kubernetes-compatible health checks
- **Dashboards**: Grafana for visualization
- **Alerts**: Prometheus Alertmanager for notifications

## Application Logging

### Log Levels

OpenAlert supports standard log levels:

| Level | When to Use | Example |
|-------|-------------|---------|
| `error` | Critical failures | Database connection lost, unhandled exceptions |
| `warn` | Warnings that don't stop execution | Rate limit approaching, slow query |
| `info` | Important events | User logged in, incident created, webhook received |
| `debug` | Detailed diagnostic info | Request/response bodies, query execution |

### Configuration

Set log level via environment variable:

```bash
# In .env
LOG_LEVEL=info  # error | warn | info | debug
```

**Recommended Settings:**
- Development: `debug`
- Staging: `info`
- Production: `info` or `warn`

### Log Format

Logs are structured JSON for machine parsing:

```json
{
  "timestamp": "2024-02-03T10:30:45.123Z",
  "level": "info",
  "context": "IncidentsService",
  "message": "Incident created",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": 123,
  "incidentId": 456,
  "severity": "critical"
}
```

**Key Fields:**
- `timestamp`: ISO 8601 timestamp
- `level`: Log level
- `context`: Module/service name
- `message`: Human-readable message
- `correlationId`: Request tracking ID
- Additional context fields (userId, incidentId, etc.)

### Correlation IDs

Every HTTP request gets a unique correlation ID for tracing:

```http
GET /incidents/123
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000
```

All logs for that request include the same correlationId:

```json
{
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Fetching incident",
  "incidentId": 123
}
{
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Incident found",
  "incidentId": 123,
  "status": "triggered"
}
```

**Use Cases:**
- Trace request through system
- Debug specific user actions
- Identify related log entries

### Log Aggregation

**Recommended Solutions:**

1. **ELK Stack (Elasticsearch, Logstash, Kibana)**
   - Centralized log storage
   - Full-text search
   - Visualization and dashboards

2. **Loki + Grafana**
   - Label-based indexing
   - Efficient for containerized apps
   - Integrated with Grafana

3. **Cloud Solutions**
   - **AWS CloudWatch Logs**
   - **Azure Monitor Logs**
   - **Google Cloud Logging**
   - **Datadog Logs**

**Example: Shipping Logs to Loki**

```yaml
# docker-compose.yml
services:
  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
```

```yaml
# promtail-config.yml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: openalert
    static_configs:
      - targets:
          - localhost
        labels:
          job: openalert
          __path__: /var/log/openalert/*.log
```

### Log Queries

**Example Queries (Loki):**

```logql
# All errors in last hour
{job="openalert"} |= "error" | json

# Logs for specific correlation ID
{job="openalert"} | json | correlationId="550e8400-e29b-41d4-a716-446655440000"

# Slow database queries
{job="openalert"} |= "slow query" | json | duration > 1000

# Failed authentication attempts
{job="openalert"} | json | context="AuthService" | level="warn"
```

### Sensitive Data

**Never log:**
- Passwords (plain or hashed)
- JWT tokens
- API keys
- Credit card numbers
- Full email addresses (in some cases)

**Redact Sensitive Data:**

```typescript
// Bad
logger.log(`User logged in: ${user.email} with password ${password}`);

// Good
logger.log(`User logged in`, { userId: user.id, email: redact(user.email) });

function redact(email: string): string {
  const [user, domain] = email.split('@');
  return `${user.substring(0, 2)}***@${domain}`;
}
```

## Metrics

### Prometheus Endpoint

OpenAlert exposes Prometheus metrics at:

```
GET /metrics
```

**Example Output:**

```
# HELP openalert_active_incidents Number of active incidents by status
# TYPE openalert_active_incidents gauge
openalert_active_incidents{status="triggered"} 12
openalert_active_incidents{status="acknowledged"} 5

# HELP openalert_critical_incidents Number of critical severity incidents
# TYPE openalert_critical_incidents gauge
openalert_critical_incidents 3

# HELP openalert_mtta_seconds Mean Time To Acknowledge in seconds
# TYPE openalert_mtta_seconds gauge
openalert_mtta_seconds 245

# HELP openalert_mttr_seconds Mean Time To Resolve in seconds
# TYPE openalert_mttr_seconds gauge
openalert_mttr_seconds 1823

# HELP openalert_incidents_total Total number of incidents created
# TYPE openalert_incidents_total counter
openalert_incidents_total{severity="critical"} 156
openalert_incidents_total{severity="high"} 423
openalert_incidents_total{severity="medium"} 891

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/incidents",status="200",le="0.1"} 1250
http_request_duration_seconds_bucket{method="GET",route="/incidents",status="200",le="0.5"} 1485
http_request_duration_seconds_bucket{method="GET",route="/incidents",status="200",le="1"} 1500
http_request_duration_seconds_sum{method="GET",route="/incidents",status="200"} 125.43
http_request_duration_seconds_count{method="GET",route="/incidents",status="200"} 1500
```

### Available Metrics

#### Business Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `openalert_active_incidents` | Gauge | Active incidents by status | status |
| `openalert_incidents_total` | Counter | Total incidents created | severity |
| `openalert_critical_incidents` | Gauge | Current critical incidents | - |
| `openalert_mtta_seconds` | Gauge | Mean Time To Acknowledge | - |
| `openalert_mttr_seconds` | Gauge | Mean Time To Resolve | - |
| `openalert_alerts_received_total` | Counter | Total alerts received | integration_type |
| `openalert_notifications_sent_total` | Counter | Total notifications sent | channel |
| `openalert_escalations_triggered_total` | Counter | Total escalations triggered | - |

#### System Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `http_request_duration_seconds` | Histogram | HTTP request duration | method, route, status |
| `http_requests_total` | Counter | Total HTTP requests | method, route, status |
| `websocket_connections` | Gauge | Active WebSocket connections | - |
| `database_query_duration_seconds` | Histogram | Database query duration | query_type |
| `database_connections` | Gauge | Active database connections | state |
| `redis_commands_total` | Counter | Total Redis commands | command |
| `queue_jobs_total` | Counter | Total queue jobs processed | queue, status |
| `queue_jobs_active` | Gauge | Currently processing jobs | queue |

### Prometheus Configuration

**Install Prometheus:**

```bash
# Download Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*
```

**Configure Scraping:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'openalert-api'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

**Run Prometheus:**

```bash
./prometheus --config.file=prometheus.yml
```

Access at `http://localhost:9090`

### Kubernetes Service Monitor

For Kubernetes deployments with Prometheus Operator:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: openalert-api
  namespace: openalert
  labels:
    app: openalert-api
spec:
  selector:
    matchLabels:
      app: openalert-api
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

## Health Checks

### Health Endpoints

OpenAlert provides three health check endpoints:

#### 1. Overall Health

```http
GET /health
```

**Response (Healthy):**
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up"
    }
  }
}
```

**Response (Unhealthy - 503):**
```json
{
  "status": "error",
  "info": {
    "database": {
      "status": "up"
    }
  },
  "error": {
    "redis": {
      "status": "down",
      "message": "Connection refused"
    }
  },
  "details": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "down",
      "message": "Connection refused"
    }
  }
}
```

#### 2. Liveness Probe

```http
GET /health/live
```

Returns 200 OK if application is running (doesn't check dependencies).

**Use Case**: Kubernetes liveness probe - restart pod if unhealthy.

```yaml
# Kubernetes deployment
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
```

#### 3. Readiness Probe

```http
GET /health/ready
```

Returns 200 OK if application is ready to serve traffic (checks database and Redis).

**Use Case**: Kubernetes readiness probe - don't send traffic until ready.

```yaml
# Kubernetes deployment
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Health Check Dependencies

OpenAlert health checks verify:

1. **Database (PostgreSQL)**
   - Connection successful
   - Can execute simple query

2. **Redis**
   - Connection successful
   - Can execute PING command

**Custom Health Indicators:**

You can add custom health indicators for additional dependencies:

```typescript
@Injectable()
export class ExternalAPIHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await axios.get('https://api.example.com/health', { timeout: 5000 });
      return this.getStatus(key, true);
    } catch (error) {
      return this.getStatus(key, false, { message: error.message });
    }
  }
}
```

## Alerting

### Prometheus Alerting Rules

Configure alerts for critical conditions:

```yaml
# prometheus-alerts.yml
groups:
  - name: openalert
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} req/s"

      # Slow response time
      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow API response time"
          description: "P95 latency is {{ $value }}s"

      # Database connection issues
      - alert: DatabaseDown
        expr: up{job="openalert-api"} == 0 or database_connections{state="active"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection lost"
          description: "Cannot connect to PostgreSQL"

      # Redis connection issues
      - alert: RedisDown
        expr: redis_up{job="openalert-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis connection lost"
          description: "Cannot connect to Redis"

      # High memory usage
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      # High CPU usage
      - alert: HighCPUUsage
        expr: rate(process_cpu_seconds_total[5m]) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value | humanizePercentage }}"

      # Disk space low
      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Disk space running low"
          description: "Only {{ $value | humanizePercentage }} disk space remaining"

      # Too many active incidents
      - alert: TooManyActiveIncidents
        expr: openalert_active_incidents > 50
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Large number of active incidents"
          description: "{{ $value }} active incidents"

      # Critical incidents not acknowledged
      - alert: UnacknowledgedCriticalIncidents
        expr: openalert_active_incidents{status="triggered",severity="critical"} > 0
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: "Critical incidents not acknowledged"
          description: "{{ $value }} critical incidents have been open for >15 minutes"

      # High MTTA
      - alert: HighMTTA
        expr: openalert_mtta_seconds > 900
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Mean Time To Acknowledge is high"
          description: "MTTA is {{ $value }}s (15 minutes)"

      # High MTTR
      - alert: HighMTTR
        expr: openalert_mttr_seconds > 3600
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Mean Time To Resolve is high"
          description: "MTTR is {{ $value }}s (1 hour)"
```

**Load Alerts:**

```bash
./prometheus --config.file=prometheus.yml --rules.alert.for-grace-period=1m
```

### Alertmanager Configuration

Forward Prometheus alerts to notification channels:

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
      continue: true
    - match:
        severity: warning
      receiver: 'slack-notifications'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR-PAGERDUTY-INTEGRATION-KEY'
```

## Grafana Dashboards

### Setup Grafana

**Install:**

```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

Access at `http://localhost:3000` (default: admin/admin)

### Add Prometheus Data Source

1. Configuration > Data Sources > Add data source
2. Select Prometheus
3. URL: `http://localhost:9090`
4. Save & Test

### OpenAlert Dashboard

Create a dashboard with these panels:

#### 1. Active Incidents (Gauge)

```promql
openalert_active_incidents
```

#### 2. Incidents by Severity (Pie Chart)

```promql
openalert_incidents_total
```

#### 3. Incident Creation Rate (Graph)

```promql
rate(openalert_incidents_total[5m])
```

#### 4. MTTA (Gauge)

```promql
openalert_mtta_seconds
```

#### 5. MTTR (Gauge)

```promql
openalert_mttr_seconds
```

#### 6. API Response Time (Graph)

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

#### 7. API Request Rate (Graph)

```promql
rate(http_requests_total[5m])
```

#### 8. Error Rate (Graph)

```promql
rate(http_requests_total{status=~"5.."}[5m])
```

#### 9. WebSocket Connections (Graph)

```promql
websocket_connections
```

#### 10. Database Query Duration (Graph)

```promql
histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m]))
```

### Dashboard JSON

Export and import dashboards as JSON for consistency across environments.

## Distributed Tracing

**Status**: Not yet implemented

**Planned**: Integration with OpenTelemetry and Jaeger for distributed tracing.

**Future Capabilities:**
- Trace requests across microservices
- Visualize service dependencies
- Identify performance bottlenecks
- Track async job processing

## Troubleshooting

### Common Issues

#### High CPU Usage

**Symptoms:**
- Slow response times
- High `process_cpu_seconds_total` metric

**Investigation:**
```bash
# Check CPU usage
docker stats openalert-api

# Profile with Node.js
node --prof apps/api/dist/main.js
node --prof-process isolate-*.log > processed.txt
```

**Potential Causes:**
- Inefficient database queries
- Infinite loops
- Heavy computation in request handlers

#### High Memory Usage

**Symptoms:**
- OOM (Out of Memory) errors
- Container restarts
- High `process_resident_memory_bytes` metric

**Investigation:**
```bash
# Check memory usage
docker stats openalert-api

# Heap snapshot
node --inspect apps/api/dist/main.js
# Use Chrome DevTools to capture heap snapshot
```

**Potential Causes:**
- Memory leaks
- Large result sets not paginated
- Caching without limits
- WebSocket connections not cleaned up

#### Database Connection Errors

**Symptoms:**
- `ECONNREFUSED` errors
- `/health/ready` returns 503

**Investigation:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
curl http://localhost:3001/health | jq
```

**Potential Causes:**
- PostgreSQL not running
- Incorrect DATABASE_URL
- Firewall blocking connection
- Max connections exceeded

#### Slow Queries

**Symptoms:**
- High `database_query_duration_seconds` metric
- Slow API responses

**Investigation:**
```sql
-- Enable slow query logging in PostgreSQL
ALTER DATABASE openalert SET log_min_duration_statement = 1000;

-- View slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

**Potential Causes:**
- Missing indexes
- Full table scans
- N+1 query problem
- Large result sets

#### Webhook Failures

**Symptoms:**
- Alerts not creating incidents
- 400/401 errors in monitoring system

**Investigation:**
```bash
# Check recent logs
docker logs openalert-api --tail=100 | grep webhook

# Test webhook manually
curl -X POST http://localhost:3001/webhooks/v1/your-key \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","severity":"low"}'
```

**Potential Causes:**
- Invalid integration key
- Malformed payload
- Rate limiting
- Integration inactive

### Debug Mode

Enable debug logging:

```bash
# In .env
LOG_LEVEL=debug
```

Restart and observe detailed logs:

```bash
docker logs -f openalert-api
```

### Performance Profiling

**Use Node.js profiler:**

```bash
node --prof apps/api/dist/main.js
# Run load test
# Stop server (Ctrl+C)
node --prof-process isolate-*.log > profile.txt
less profile.txt
```

**Use clinic.js for deeper analysis:**

```bash
npm install -g clinic
clinic doctor -- node apps/api/dist/main.js
# Run load test
# Stop server (Ctrl+C)
# Opens browser with analysis
```

## Performance Monitoring

### Key Performance Indicators (KPIs)

| KPI | Target | Critical |
|-----|--------|----------|
| API Response Time (P95) | < 500ms | > 2s |
| API Response Time (P99) | < 1s | > 5s |
| Error Rate | < 0.1% | > 1% |
| MTTA | < 5 minutes | > 15 minutes |
| MTTR | < 30 minutes | > 2 hours |
| Database Query Time (P95) | < 100ms | > 500ms |
| WebSocket Latency | < 100ms | > 500ms |
| Uptime | > 99.9% | < 99.0% |

### Load Testing

**Use Artillery for load testing:**

```yaml
# artillery-config.yml
config:
  target: 'https://openalert.example.com'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Spike"
  defaults:
    headers:
      Authorization: 'Bearer YOUR_TOKEN'

scenarios:
  - name: "List incidents"
    flow:
      - get:
          url: "/incidents"
      - think: 1

  - name: "Get incident details"
    flow:
      - get:
          url: "/incidents/{{ $randomNumber(1, 100) }}"
      - think: 2

  - name: "Send webhook"
    flow:
      - post:
          url: "/webhooks/v1/your-integration-key"
          json:
            title: "Load test alert"
            severity: "low"
```

**Run load test:**

```bash
npm install -g artillery
artillery run artillery-config.yml
```

## Best Practices

### Logging

- Use appropriate log levels
- Include correlation IDs
- Don't log sensitive data
- Use structured logging (JSON)
- Centralize logs for analysis

### Metrics

- Monitor business metrics (MTTA, MTTR)
- Monitor system metrics (CPU, memory, disk)
- Set up alerts for critical conditions
- Review metrics regularly
- Correlate metrics with incidents

### Health Checks

- Implement deep health checks (check dependencies)
- Use liveness and readiness probes in Kubernetes
- Monitor health check endpoints
- Alert on health check failures

### Alerting

- Alert on symptoms, not causes
- Set appropriate thresholds
- Avoid alert fatigue (tune alerts)
- Include runbook links in alerts
- Route alerts to appropriate teams

### Dashboards

- Create role-specific dashboards (ops, dev, business)
- Include SLOs and SLIs
- Use consistent time ranges
- Add annotations for deployments
- Share dashboards across teams

## Support

For monitoring assistance:
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for setup
- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
- Visit [GitHub Issues](https://github.com/yourusername/openalert/issues)
