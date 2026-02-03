# OpenAlert Integration Guide

Complete guide to integrating monitoring systems with OpenAlert for alert ingestion and incident management.

## Table of Contents

- [Overview](#overview)
- [Integration Setup](#integration-setup)
- [Webhook Formats](#webhook-formats)
- [Supported Integrations](#supported-integrations)
- [Custom Webhooks](#custom-webhooks)
- [Testing Webhooks](#testing-webhooks)
- [Troubleshooting](#troubleshooting)

## Overview

OpenAlert receives alerts from external monitoring systems via webhooks. When an alert is received:

1. The webhook is validated and transformed to OpenAlert's standard format
2. The alert is deduplicated using a SHA-256 fingerprint
3. An incident is created or updated based on the alert status
4. Escalation policies are triggered for new incidents
5. Team members are notified according to their notification preferences
6. Real-time updates are sent via WebSocket

## Integration Setup

### Step 1: Create a Service

Before receiving alerts, create a service in OpenAlert:

```bash
POST /services
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Production API",
  "slug": "production-api",
  "description": "Main production API service",
  "teamId": 1,
  "escalationPolicyId": 1
}
```

### Step 2: Create an Integration

Create an integration for your monitoring system:

```bash
POST /integrations
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Prometheus Alertmanager",
  "type": "prometheus",
  "serviceId": 1,
  "config": {
    "autoResolve": true,
    "severity": "high"
  }
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Prometheus Alertmanager",
  "type": "prometheus",
  "serviceId": 1,
  "integrationKey": "f7a3c8b9e1d4a2f6c9e7b3d1a8f4c2e9",
  "isActive": true,
  "createdAt": "2024-02-03T10:00:00Z"
}
```

**Save the `integrationKey`** - you'll use this in your webhook URL.

### Step 3: Configure Your Monitoring System

Use the integration key in your webhook URL:

```
https://your-openalert-instance.com/webhooks/{type}/{integrationKey}
```

Replace `{type}` with your integration type:
- `prometheus` - Prometheus Alertmanager
- `grafana` - Grafana Alerting
- `azure` - Azure Monitor
- `datadog` - Datadog
- `v1` - Generic webhook (auto-detects format)

## Webhook Formats

### OpenAlert Standard Format

All webhooks are transformed to this standard format internally:

```json
{
  "title": "High CPU Usage",
  "severity": "high",
  "description": "CPU usage has exceeded 90% for the last 5 minutes",
  "source": "prometheus",
  "labels": {
    "host": "web-server-01",
    "environment": "production",
    "metric": "cpu_usage"
  },
  "annotations": {
    "runbook_url": "https://wiki.example.com/runbooks/high-cpu",
    "dashboard": "https://grafana.example.com/d/cpu"
  },
  "status": "firing",
  "firedAt": "2024-02-03T10:30:00Z"
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Alert title (max 500 chars) |
| `severity` | enum | Yes | One of: critical, high, medium, low, info |
| `description` | string | No | Detailed description |
| `source` | string | No | Alert source system |
| `labels` | object | No | Key-value metadata for grouping |
| `annotations` | object | No | Key-value additional information |
| `status` | enum | No | firing (default), resolved |
| `firedAt` | ISO8601 | No | When alert started (defaults to current time) |

## Supported Integrations

### Prometheus Alertmanager

**Webhook URL:**
```
https://your-openalert-instance.com/webhooks/prometheus/{integrationKey}
```

**Alertmanager Configuration:**

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'openalert'

receivers:
  - name: 'openalert'
    webhook_configs:
      - url: 'https://your-openalert-instance.com/webhooks/prometheus/f7a3c8b9e1d4a2f6c9e7b3d1a8f4c2e9'
        send_resolved: true
```

**Alert Rules Example:**

```yaml
# prometheus-rules.yml
groups:
  - name: example
    interval: 30s
    rules:
      - alert: HighCPU
        expr: cpu_usage_percent > 90
        for: 5m
        labels:
          severity: high
          team: devops
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is {{ $value }}% on {{ $labels.instance }}"
          runbook_url: "https://wiki.example.com/runbooks/high-cpu"
```

**Payload Format:**

Prometheus Alertmanager sends:
```json
{
  "version": "4",
  "groupKey": "...",
  "status": "firing",
  "receiver": "openalert",
  "groupLabels": {
    "alertname": "HighCPU"
  },
  "commonLabels": {
    "alertname": "HighCPU",
    "severity": "high",
    "instance": "web-server-01"
  },
  "commonAnnotations": {
    "summary": "High CPU usage on web-server-01",
    "description": "CPU usage is 95% on web-server-01"
  },
  "externalURL": "http://alertmanager:9093",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighCPU",
        "severity": "high",
        "instance": "web-server-01"
      },
      "annotations": {
        "summary": "High CPU usage on web-server-01",
        "description": "CPU usage is 95% on web-server-01",
        "runbook_url": "https://wiki.example.com/runbooks/high-cpu"
      },
      "startsAt": "2024-02-03T10:25:00Z",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "http://prometheus:9090/graph?g0.expr=..."
    }
  ]
}
```

### Grafana Alerting

**Webhook URL:**
```
https://your-openalert-instance.com/webhooks/grafana/{integrationKey}
```

**Grafana Contact Point Configuration:**

1. Navigate to **Alerting** > **Contact points**
2. Click **New contact point**
3. Choose **Webhook** as the type
4. Enter the webhook URL
5. Click **Test** to verify
6. Save the contact point

**Payload Format:**

Grafana sends:
```json
{
  "receiver": "openalert",
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighResponseTime",
        "severity": "critical",
        "service": "api-gateway"
      },
      "annotations": {
        "summary": "API response time above threshold",
        "description": "Response time is 2500ms (threshold: 1000ms)"
      },
      "startsAt": "2024-02-03T10:30:00Z",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "https://grafana.example.com/alerting/grafana/abc123/view",
      "fingerprint": "a1b2c3d4e5f6",
      "silenceURL": "https://grafana.example.com/alerting/silence/new?...",
      "dashboardURL": "https://grafana.example.com/d/dashboard123",
      "panelURL": "https://grafana.example.com/d/dashboard123?viewPanel=5",
      "values": {
        "B": 2500
      }
    }
  ],
  "groupLabels": {},
  "commonLabels": {
    "alertname": "HighResponseTime",
    "severity": "critical"
  },
  "commonAnnotations": {},
  "externalURL": "https://grafana.example.com/"
}
```

### Azure Monitor

**Webhook URL:**
```
https://your-openalert-instance.com/webhooks/azure/{integrationKey}
```

**Azure Monitor Configuration:**

1. Navigate to **Monitor** > **Alerts** > **Action groups**
2. Create a new action group
3. Add a **Webhook** action
4. Enter the webhook URL
5. Select **Enable common alert schema** (recommended)

**Payload Format (Common Schema):**

```json
{
  "schemaId": "azureMonitorCommonAlertSchema",
  "data": {
    "essentials": {
      "alertId": "/subscriptions/.../providers/Microsoft.Insights/...",
      "alertRule": "High CPU Alert",
      "severity": "Sev2",
      "signalType": "Metric",
      "monitorCondition": "Fired",
      "monitoringService": "Platform",
      "alertTargetIDs": [
        "/subscriptions/.../resourceGroups/myRG/providers/Microsoft.Compute/virtualMachines/vm1"
      ],
      "originAlertId": "...",
      "firedDateTime": "2024-02-03T10:30:00.0000000Z",
      "description": "CPU usage is above 90%",
      "essentialsVersion": "1.0",
      "alertContextVersion": "1.0"
    },
    "alertContext": {
      "properties": null,
      "conditionType": "SingleResourceMultipleMetricCriteria",
      "condition": {
        "windowSize": "PT5M",
        "allOf": [
          {
            "metricName": "Percentage CPU",
            "metricNamespace": "Microsoft.Compute/virtualMachines",
            "operator": "GreaterThan",
            "threshold": "90",
            "timeAggregation": "Average",
            "dimensions": [],
            "metricValue": 95.2
          }
        ]
      }
    }
  }
}
```

### Datadog

**Webhook URL:**
```
https://your-openalert-instance.com/webhooks/datadog/{integrationKey}
```

**Datadog Webhook Configuration:**

1. Navigate to **Integrations** > **Webhooks**
2. Click **New Webhook**
3. Enter name and webhook URL
4. Add the webhook to your monitor's notification list: `@webhook-openalert`

**Monitor Notification Example:**
```
{{#is_alert}}
CPU usage is critical on {{host.name}}
{{/is_alert}}

@webhook-openalert
```

**Payload Format:**

Datadog sends:
```json
{
  "id": "1234567890",
  "alert_transition": "Triggered",
  "alert_type": "error",
  "event_msg": "CPU usage is above 90%",
  "title": "[Triggered] High CPU on web-server-01",
  "org_id": "12345",
  "org_name": "MyOrg",
  "priority": "normal",
  "snapshot": "https://app.datadoghq.com/...",
  "tags": [
    "host:web-server-01",
    "env:production",
    "service:api"
  ],
  "metric": "system.cpu.usage",
  "last_updated": "2024-02-03T10:30:00Z"
}
```

## Custom Webhooks

For monitoring systems not listed above, use the generic webhook endpoint with OpenAlert's standard format.

**Webhook URL:**
```
https://your-openalert-instance.com/webhooks/v1/{integrationKey}
```

**Minimal Example:**

```bash
curl -X POST https://your-openalert-instance.com/webhooks/v1/your-integration-key \
  -H "Content-Type: application/json" \
  -d '{
    "title": "High CPU Usage",
    "severity": "high"
  }'
```

**Complete Example:**

```bash
curl -X POST https://your-openalert-instance.com/webhooks/v1/your-integration-key \
  -H "Content-Type: application/json" \
  -d '{
    "title": "High CPU Usage on web-server-01",
    "severity": "critical",
    "description": "CPU usage has exceeded 90% for the last 5 minutes",
    "source": "custom-monitor",
    "labels": {
      "host": "web-server-01",
      "environment": "production",
      "datacenter": "us-east-1",
      "application": "api-gateway"
    },
    "annotations": {
      "runbook_url": "https://wiki.example.com/runbooks/high-cpu",
      "dashboard": "https://monitoring.example.com/dashboard/cpu",
      "impact": "API response times may be degraded"
    },
    "status": "firing",
    "firedAt": "2024-02-03T10:30:00Z"
  }'
```

**Resolving an Alert:**

Send the same alert with `status: "resolved"`:

```bash
curl -X POST https://your-openalert-instance.com/webhooks/v1/your-integration-key \
  -H "Content-Type: application/json" \
  -d '{
    "title": "High CPU Usage on web-server-01",
    "severity": "critical",
    "status": "resolved",
    "labels": {
      "host": "web-server-01"
    }
  }'
```

**Note:** The fingerprint is calculated from the title and labels, so these must match the original alert for proper deduplication.

### Severity Mapping

Map your monitoring system's severity levels to OpenAlert's:

| OpenAlert | Common Equivalents |
|-----------|-------------------|
| `critical` | Critical, Sev0, P0, Emergency |
| `high` | High, Sev1, P1, Alert |
| `medium` | Medium, Sev2, P2, Warning |
| `low` | Low, Sev3, P3, Notice |
| `info` | Info, Sev4, P4, Informational |

### Python Integration Example

```python
import requests
import json

def send_openalert_webhook(integration_key, title, severity, **kwargs):
    """
    Send an alert to OpenAlert

    Args:
        integration_key: Your integration key
        title: Alert title
        severity: One of: critical, high, medium, low, info
        **kwargs: Additional fields (description, labels, annotations, etc.)
    """
    url = f'https://your-openalert-instance.com/webhooks/v1/{integration_key}'

    payload = {
        'title': title,
        'severity': severity,
        **kwargs
    }

    response = requests.post(url, json=payload)
    response.raise_for_status()

    return response.json()

# Usage
send_openalert_webhook(
    integration_key='your-key',
    title='Database Connection Pool Exhausted',
    severity='critical',
    description='Connection pool is at 100% capacity',
    source='database-monitor',
    labels={
        'database': 'postgres-primary',
        'environment': 'production'
    },
    annotations={
        'runbook_url': 'https://wiki.example.com/db-pool'
    }
)
```

### Node.js Integration Example

```javascript
const axios = require('axios');

async function sendOpenAlertWebhook(integrationKey, alert) {
  const url = `https://your-openalert-instance.com/webhooks/v1/${integrationKey}`;

  const response = await axios.post(url, {
    title: alert.title,
    severity: alert.severity,
    description: alert.description,
    labels: alert.labels,
    annotations: alert.annotations,
    status: alert.status || 'firing'
  });

  return response.data;
}

// Usage
sendOpenAlertWebhook('your-key', {
  title: 'API Error Rate Spike',
  severity: 'high',
  description: 'Error rate increased to 5% (threshold: 1%)',
  labels: {
    service: 'api-gateway',
    environment: 'production'
  },
  annotations: {
    dashboard: 'https://grafana.example.com/d/errors'
  }
});
```

## Testing Webhooks

### Option 1: curl

Test your webhook configuration with curl:

```bash
curl -X POST https://your-openalert-instance.com/webhooks/v1/your-integration-key \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Alert",
    "severity": "low",
    "description": "This is a test alert to verify integration"
  }'
```

**Expected Response (202 Accepted):**
```json
{
  "status": "accepted",
  "alertsProcessed": 1,
  "alertIds": [123]
}
```

### Option 2: Monitoring System Test

Most monitoring systems have built-in webhook testing:

- **Prometheus**: Trigger a test alert using PromQL
- **Grafana**: Use the "Test" button in Contact Point settings
- **Azure Monitor**: Use "Test action group" feature
- **Datadog**: Use "Test webhook" in webhook settings

### Option 3: Manual Alert Creation

Create a test alert via the OpenAlert API:

```bash
curl -X POST https://your-openalert-instance.com/alerts/test \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "integrationId": 1,
    "title": "Manual Test Alert",
    "severity": "low"
  }'
```

### Verification

After sending a test webhook:

1. Check the API response for `alertIds`
2. Query the alert: `GET /alerts/{alertId}`
3. Verify an incident was created: `GET /incidents`
4. Check that notifications were sent (if escalation policy configured)
5. View real-time updates in WebSocket logs

## Troubleshooting

### Webhooks Not Received

**Check Integration Status:**
```bash
GET /integrations/{id}
Authorization: Bearer {token}
```

Verify `isActive: true`

**Check Network Connectivity:**
```bash
# From your monitoring system
curl -v https://your-openalert-instance.com/health
```

**Check Firewall Rules:**
- Ensure OpenAlert is accessible from your monitoring system
- Check that port 443 (HTTPS) is open
- Verify SSL certificate is valid

### Alerts Not Creating Incidents

**Check Service Configuration:**
- Verify the integration is linked to a service
- Ensure the service has an escalation policy (if notifications are required)

**Check Alert Routing Rules:**
```bash
GET /alert-routing
Authorization: Bearer {token}
```

Routing rules may be suppressing or routing alerts differently.

**Check Deduplication:**
Alerts with identical fingerprints update existing alerts rather than creating new ones.

### Incorrect Severity Mapping

**Prometheus:**
Ensure your alert rules include the `severity` label:
```yaml
labels:
  severity: high  # Must be: critical, high, medium, low, info
```

**Custom Webhooks:**
Verify the `severity` field matches OpenAlert's enum values exactly (case-sensitive).

### Missing Alert Data

**Check Payload Format:**
Enable debug logging to see raw payloads:

```bash
# In .env
LOG_LEVEL=debug
```

View logs:
```bash
docker logs openalert-api | grep "Received webhook"
```

**Transform Validation:**
The webhook transformer validates and extracts:
- `title` (required)
- `severity` (required)
- `description` (optional)
- `labels` (optional)
- `annotations` (optional)

Missing required fields result in a 400 Bad Request.

### Rate Limiting

Webhook endpoints are rate limited to **100 requests per minute per integration key**.

If you exceed this limit:
```json
{
  "statusCode": 429,
  "message": "Too Many Requests"
}
```

**Solutions:**
- Batch alerts in your monitoring system
- Use alert grouping (Prometheus/Grafana)
- Contact support to increase limits

### SSL/TLS Errors

**Self-Signed Certificates:**
If using self-signed certificates, you may need to disable SSL verification in your monitoring system (not recommended for production).

**Certificate Expired:**
Ensure your SSL certificate is valid:
```bash
curl -v https://your-openalert-instance.com/health
```

### Webhook Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 202 | Accepted | Webhook processed successfully |
| 400 | Bad Request | Invalid payload format |
| 401 | Unauthorized | Invalid integration key |
| 404 | Not Found | Integration not found or inactive |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | OpenAlert internal error |

## Best Practices

### 1. Use Descriptive Titles
```json
{
  "title": "High CPU usage on web-server-01 (95%)"
}
```

Better than:
```json
{
  "title": "Alert triggered"
}
```

### 2. Include Runbook URLs
```json
{
  "annotations": {
    "runbook_url": "https://wiki.example.com/runbooks/high-cpu"
  }
}
```

This helps responders quickly find resolution steps.

### 3. Use Labels for Grouping
```json
{
  "labels": {
    "environment": "production",
    "datacenter": "us-east-1",
    "service": "api-gateway"
  }
}
```

Labels enable powerful filtering and routing.

### 4. Send Resolved Alerts
```json
{
  "title": "High CPU usage on web-server-01",
  "severity": "critical",
  "status": "resolved"
}
```

This auto-resolves incidents when issues are fixed.

### 5. Test Integrations Regularly
Set up synthetic tests to verify webhook delivery:
```bash
# Weekly cron job
0 0 * * 0 curl -X POST https://your-openalert-instance.com/webhooks/v1/key -d '{"title":"Weekly Test","severity":"info"}'
```

## Support

For additional help:
- Check the [API Guide](API-GUIDE.md) for authentication and API usage
- Review the [Security Guide](SECURITY.md) for secure configuration
- Visit [GitHub Issues](https://github.com/yourusername/openalert/issues)
